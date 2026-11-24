// Helpers for the tests: start the service locally (wrangler dev --local, its own empty database), a stand-in for the Etsy API, small asserts.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const SERVICE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
const failed = [];
export function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed.push(name); console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}
export function section(title) { console.log('\n== ' + title); }
export function summary() {
  console.log('\n' + passed + ' passed, ' + failed.length + ' failed' + (failed.length ? ':\n  - ' + failed.join('\n  - ') : ''));
  return failed.length === 0;
}

/** Starts `wrangler dev --local` with its own empty database folder. vars become Worker variables. */
export async function startService({ port, vars = {}, persist }) {
  const dir = persist || fs.mkdtempSync(path.join(os.tmpdir(), 'pl-state-'));
  const args = ['wrangler', 'dev', '--local', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', dir];
  for (const [k, v] of Object.entries(vars)) args.push('--var', k + ':' + (typeof v === 'string' ? v : JSON.stringify(v)));
  const child = spawn('npx', args, { cwd: SERVICE_DIR, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const url = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(url + '/api/status'); if (r.ok) break; } catch (e) {}
    if (i === 79) throw new Error('service did not start:\n' + log.slice(-2000));
    await sleep(500);
  }
  return {
    url, dir,
    log: () => log,
    async stop() {
      try { process.kill(-child.pid, 'SIGTERM'); } catch (e) {}
      await sleep(700);
      try { process.kill(-child.pid, 'SIGKILL'); } catch (e) {}
    },
  };
}

export async function call(base, method, pathname, body, headers = {}) {
  const res = await fetch(base + pathname, { method, headers: body ? { 'Content-Type': 'text/plain', ...headers } : headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, body: json, text, headers: res.headers };
}

/** Finds the local D1 file of a service started above (to look at what is really stored). */
export function findSqlite(dir) {
  const out = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p); else if (f.name.endsWith('.sqlite') && !f.name.includes('metadata')) out.push(p);
    }
  })(dir);
  return out;
}

/**
 * A stand-in for the Etsy Open API v3, shaped after developer.etsy.com/documentation:
 * /oauth/connect (answers "Allow" at once), POST /v3/public/oauth/token, /v3/application/users/me, /shops/{id}, /shops/{id}/receipts/{id}.
 * It checks what a real client must send (x-api-key = keystring:secret, Bearer token, PKCE S256) and counts every request.
 */
export async function startFakeEtsy({ port, keystring = 'testkeystring', secret = 'testsecret', shopName = 'WishberrystudioGifts', userId = 12345, shopId = 777 }) {
  const state = {
    counts: {}, challenges: new Map(), codes: new Map(), access: null, refresh: null, serial: 0,
    expiresIn: 3600, receipts: {}, fail: {}, shopName, deny: false, refreshInvalid: false, log: [],
  };
  const bump = (k) => { state.counts[k] = (state.counts[k] || 0) + 1; };
  const json = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const issue = () => { state.serial++; state.access = userId + '.access' + state.serial; state.refresh = userId + '.refresh' + state.serial; return { access_token: state.access, token_type: 'Bearer', expires_in: state.expiresIn, refresh_token: state.refresh }; };

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    let body = '';
    for await (const c of req) body += c;
    const key = req.headers['x-api-key'];
    state.log.push(req.method + ' ' + u.pathname);

    if (u.pathname === '/oauth/connect') {
      bump('authorize');
      const q = u.searchParams;
      const bad = q.get('response_type') !== 'code' || q.get('client_id') !== keystring || q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge') || !q.get('state') || !/^https?:\/\//.test(q.get('redirect_uri') || '');
      if (bad) { res.writeHead(400); res.end('bad authorize request'); return; }
      state.lastScope = q.get('scope'); state.lastRedirect = q.get('redirect_uri');
      const back = new URL(q.get('redirect_uri'));
      if (state.deny) { back.searchParams.set('error', 'access_denied'); back.searchParams.set('state', q.get('state')); }
      else {
        const code = 'code' + (++state.serial);
        state.codes.set(code, { challenge: q.get('code_challenge'), redirect: q.get('redirect_uri') });
        back.searchParams.set('code', code); back.searchParams.set('state', q.get('state'));
      }
      res.writeHead(302, { Location: back.toString() }); res.end(); return;
    }

    if (u.pathname === '/v3/public/oauth/token' && req.method === 'POST') {
      bump('token');
      if (key !== keystring + ':' + secret) return json(res, 403, { error: 'invalid api key' });
      const f = new URLSearchParams(body);
      if (f.get('client_id') !== keystring) return json(res, 400, { error: 'invalid_client' });
      if (f.get('grant_type') === 'authorization_code') {
        bump('token_code');
        const c = state.codes.get(f.get('code')); state.codes.delete(f.get('code'));
        const expect = c ? createHash('sha256').update(f.get('code_verifier') || '').digest('base64url') : null;
        if (!c || expect !== c.challenge || (f.get('redirect_uri') && f.get('redirect_uri') !== c.redirect)) return json(res, 400, { error: 'invalid_grant' });
        return json(res, 200, issue());
      }
      if (f.get('grant_type') === 'refresh_token') {
        bump('token_refresh');
        if (state.refreshInvalid || f.get('refresh_token') !== state.refresh) return json(res, 400, { error: 'invalid_grant' });
        return json(res, 200, issue());
      }
      return json(res, 400, { error: 'unsupported_grant_type' });
    }

    if (u.pathname.startsWith('/v3/application/')) {
      if (key !== keystring + ':' + secret) { bump('bad_key'); return json(res, 403, { error: 'invalid api key' }); }
      const p = u.pathname.slice('/v3/application'.length);
      const auth = req.headers.authorization || '';
      const shopMatch = /^\/shops\/(\d+)$/.exec(p);
      if (shopMatch) { bump('shop'); return json(res, 200, { shop_id: Number(shopMatch[1]), shop_name: state.shopName }); }
      if (auth !== 'Bearer ' + state.access || state.fail.unauthorized) { bump('unauthorized'); if (state.fail.unauthorized > 0) state.fail.unauthorized--; return json(res, 401, { error: 'invalid_token' }); }
      if (p === '/users/me') { bump('me'); return json(res, 200, { user_id: userId, shop_id: shopId }); }
      const rm = /^\/shops\/(\d+)\/receipts\/(\d+)$/.exec(p);
      if (rm) {
        bump('receipt'); bump('receipt:' + rm[2]);
        if (Number(rm[1]) !== shopId) return json(res, 404, { error: 'Resource not found' });
        if (state.fail.server > 0) { state.fail.server--; return json(res, 500, { error: 'boom' }); }
        const r = state.receipts[rm[2]];
        if (!r) return json(res, 404, { error: 'Resource not found' });
        return json(res, 200, { receipt_id: Number(rm[2]), status: r.status || 'paid', is_paid: r.is_paid !== undefined ? r.is_paid : true, transactions: (r.listings || []).map((id, i) => ({ transaction_id: 1000 + i, listing_id: id, is_digital: true })) });
      }
    }
    res.writeHead(404); res.end('not found');
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + port;
  return { state, base, vars: { ETSY_KEYSTRING: keystring, ETSY_SHARED_SECRET: secret, ETSY_AUTH_URL: base + '/oauth/connect', ETSY_TOKEN_URL: base + '/v3/public/oauth/token', ETSY_API_URL: base + '/v3/application' }, stop: () => new Promise((r) => server.close(r)) };
}

/** Follows the redirects of the connect flow the way the owner's browser would: service -> Etsy "Allow" -> service callback. */
export async function connectShop(serviceUrl) {
  const a = await fetch(serviceUrl + '/etsy/connect', { redirect: 'manual' });
  if (a.status !== 302) return { status: a.status, text: await a.text(), step: 'connect' };
  const b = await fetch(a.headers.get('location'), { redirect: 'manual' });
  if (b.status !== 302) return { status: b.status, text: await b.text(), step: 'authorize' };
  const c = await fetch(b.headers.get('location'), { redirect: 'manual' });
  return { status: c.status, text: await c.text(), step: 'callback', authorizeUrl: a.headers.get('location'), callbackUrl: b.headers.get('location') };
}
