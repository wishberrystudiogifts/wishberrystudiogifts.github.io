// Wishberry product link service — Cloudflare Worker + D1.
//
//   POST /api/activate      { order, product? }  -> the buyer's personal product link(s) for that order
//   POST /api/open/{hash}                          -> counts one opening, checks the deadline and the limit
//   POST /api/sign          { hash, d }           -> signature for an invitation link; d = SHA-256 of its data (only while the product link is valid)
//   GET  /api/pubkey                               -> public key(s) the site uses to check signatures
//   GET  /api/status                               -> is the service up, is the shop connected (no secrets, no buyer data)
//   GET  /etsy/connect, /etsy/callback             -> the shop owner connects the shop once (OAuth 2.0 + PKCE)
//   once a day (cron)                              -> tidy-up of our own tables; it never calls Etsy
//
// Guide for people: service/README.md.
import { ensureSchema, getSigningKey, tables, housekeeping, kvGet, kvPut } from './db.js';
import { settings, isAllowedOrigin, isMockMode, productKeys, productOf, limitsFor } from './settings.js';
import { activate, openLink, signLink, recheckOrder } from './links.js';
import { startConnect, finishConnect, etsyStatus } from './etsy.js';
import { homePage, connectError, connectDone, ETSY_NOTICE } from './pages.js';

const MAX_BODY = 4 * 1024; // the largest honest request is about 100 characters

function corsHeaders(cfg, request) {
  const origin = request.headers.get('Origin');
  const h = { Vary: 'Origin' };
  if (origin && isAllowedOrigin(cfg, origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function json(cfg, request, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...corsHeaders(cfg, request),
    },
  });
}

/**
 * The page sends JSON as text/plain (no CORS preflight needed); we accept JSON whatever the content type says.
 * The size is checked BEFORE and WHILE reading — a large upload is dropped, never held in memory.
 * Answers an object, or null (not JSON / not an object), or 'too_large'.
 */
async function readBody(request) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY) return 'too_large';
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      try { await reader.cancel(); } catch (e) {}
      return 'too_large';
    }
    chunks.push(value);
  }
  if (!size) return {};
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  try {
    const o = JSON.parse(new TextDecoder().decode(all));
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch (e) {
    return null;
  }
}

function clientIp(request, env) {
  if (isMockMode(env)) {
    const t = request.headers.get('X-Test-IP'); // tests only; ignored on the live service
    if (t) return t.slice(0, 60);
  }
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// Tidy-up also runs from ordinary traffic, at most once a day, in case the daily cron is ever not set up.
let tidyLooked = 0;
async function maybeTidy(env) {
  const now = Date.now();
  if (now - tidyLooked < 3600000) return;
  tidyLooked = now;
  const last = Number(await kvGet(env, 'tidy_at')) || 0;
  if (now - last < 86400000) return;
  await kvPut(env, 'tidy_at', String(now));
  await housekeeping(env);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method.toUpperCase();
    let cfg = {};

    try {
      cfg = settings(env);
      if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(cfg, request) });

      if (path.startsWith('/api/')) {
        // A browser on another website may not use the API. (Requests without an Origin header — tests, monitoring — are allowed.)
        const origin = request.headers.get('Origin');
        if (origin && !isAllowedOrigin(cfg, origin)) return json(cfg, request, 403, { ok: false, error: 'origin' });
        if (!env.DB) return json(cfg, request, 500, { ok: false, error: 'no_database' });
        await ensureSchema(env);
        ctx.waitUntil(maybeTidy(env).catch((e) => console.log('tidy failed', e && e.message)));

        if (path === '/api/status' && method === 'GET') {
          const st = await etsyStatus(env);
          const sk = await getSigningKey(env);
          const mock = isMockMode(env);
          const lim = limitsFor(cfg, '');
          const attention = [];
          for (const k of productKeys(cfg)) {
            const p = productOf(cfg, k);
            if (!p.lab && !(p.listingIds || []).length) attention.push(k + ': no Etsy listing ID in config.json yet — any paid order of the shop unlocks it');
          }
          if (!mock && !st.apiKey) attention.push('the Etsy API key is not set — every order number is let in unchecked');
          else if (!mock && !st.connected) attention.push(st.reconnectNeeded ? 'the shop has to be connected to Etsy again (open /etsy/connect) — until then every order number is let in unchecked' : 'the shop is not connected to Etsy yet (open /etsy/connect) — until then every order number is let in unchecked');
          else if (!mock && !st.proven) attention.push('no real order has been read from Etsy yet — until the first one, a "no" from Etsy is not trusted');
          return json(cfg, request, 200, {
            ok: true,
            service: 'product-link',
            stage: env.STAGE || 'production',
            tables: tables(env).prefix || '',
            verifier: mock ? 'mock' : 'etsy',
            etsy: { apiKey: st.apiKey, connected: st.connected, reconnectNeeded: st.reconnectNeeded, proven: st.proven },
            signKey: sk.kid,
            limits: { ttlHours: lim.ttlMs / 3600000, maxOpens: lim.maxOpens, maxSigns: lim.maxSigns },
            attention,
            notice: ETSY_NOTICE,
            now: Date.now(),
          });
        }

        if (path === '/api/pubkey' && method === 'GET') {
          const sk = await getSigningKey(env);
          return json(cfg, request, 200, { ok: true, alg: 'ES256', format: 'P-256 public key, raw uncompressed point, base64url', keys: [{ kid: sk.kid, key: sk.pub }] });
        }

        if (path === '/api/activate' && method === 'POST') {
          const body = await readBody(request);
          if (body === 'too_large') return json(cfg, request, 413, { ok: false, error: 'too_large' });
          if (!body) return json(cfg, request, 400, { ok: false, error: 'bad_request' });
          const r = await activate(env, { order: body.order, product: body.product, ip: clientIp(request, env) });
          return json(cfg, request, r.http, r.body);
        }

        const open = /^\/api\/open\/([^/]+)$/.exec(path);
        if (open && method === 'POST') {
          const r = await openLink(env, open[1], clientIp(request, env));
          if (r.recheck) ctx.waitUntil(recheckOrder(env, r.recheck).catch((e) => console.log('recheck failed', e && e.message)));
          return json(cfg, request, r.http, r.body);
        }

        if (path === '/api/sign' && method === 'POST') {
          const body = await readBody(request);
          if (body === 'too_large') return json(cfg, request, 413, { ok: false, error: 'too_large' });
          if (!body) return json(cfg, request, 400, { ok: false, error: 'bad_request' });
          const r = await signLink(env, { hash: body.hash, d: body.d, ip: clientIp(request, env) });
          if (r.recheck) ctx.waitUntil(recheckOrder(env, r.recheck).catch((e) => console.log('recheck failed', e && e.message)));
          return json(cfg, request, r.http, r.body);
        }

        return json(cfg, request, 404, { ok: false, error: 'no_such_endpoint' });
      }

      if (path === '/etsy/connect' && method === 'GET') {
        if (!env.DB) return connectError('no_api_key');
        await ensureSchema(env);
        const r = await startConnect(request, env);
        if (r.error) return connectError(r.error, r.shop);
        return new Response(null, { status: 302, headers: { Location: r.redirect, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
      }

      if (path === '/etsy/callback' && method === 'GET') {
        await ensureSchema(env);
        const r = await finishConnect(request, env);
        if (r.error) return connectError(r.error, r.detail);
        return connectDone(r.shop);
      }

      if (path === '/' && method === 'GET') return homePage(env);

      return json(cfg, request, 404, { ok: false, error: 'not_found' });
    } catch (e) {
      console.log('error', path.replace(/[A-Za-z0-9_-]{22}/g, ':hash'), e && (e.stack || e.message)); // never print a buyer's hash
      return json(cfg, request, 500, { ok: false, error: 'server_error' });
    }
  },

  /** Daily tidy-up (wrangler.jsonc → triggers.crons). It works only on our own tables and never calls Etsy. */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        await ensureSchema(env);
        await kvPut(env, 'tidy_at', String(Date.now()));
        await housekeeping(env);
      } catch (e) {
        console.log('tidy failed', e && e.message);
      }
    })());
  },
};
