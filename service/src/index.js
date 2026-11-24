// Wishberry product link service — Cloudflare Worker + D1.
//
//   POST /api/activate      { order, product? }  -> the buyer's personal product link(s) for that order
//   POST /api/open/{hash}                          -> counts one opening, checks the deadline and the limit
//   POST /api/sign          { hash, d }           -> signature for an invitation link; d = SHA-256 of its data (only while the product link is valid)
//   GET  /api/pubkey                               -> public key(s) the site uses to check signatures
//   GET  /api/status                               -> is the service up, is the shop connected (no secrets)
//   GET  /etsy/connect, /etsy/callback             -> the shop owner connects the shop once (OAuth 2.0 + PKCE)
//
// Guide for people: service/README.md.
import { ensureSchema, getSigningKey, tables } from './db.js';
import { settings, isAllowedOrigin, isMockMode } from './settings.js';
import { activate, openLink, signLink, recheckOrder } from './links.js';
import { startConnect, finishConnect, etsyStatus } from './etsy.js';
import { homePage, connectError, connectDone, ETSY_NOTICE } from './pages.js';

const MAX_BODY = 16 * 1024;

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

/** The page sends JSON as text/plain (no CORS preflight needed); we accept JSON whatever the content type says. */
async function readBody(request) {
  const text = await request.text();
  if (!text) return {};
  if (text.length > MAX_BODY) return null;
  try {
    const o = JSON.parse(text);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch (e) {
    return null;
  }
}

function clientIp(request, env) {
  if (isMockMode(env)) {
    const t = request.headers.get('X-Test-IP'); // tests only; ignored on the live service
    if (t) return 'test:' + t.slice(0, 40);
  }
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

export default {
  async fetch(request, env, ctx) {
    const cfg = settings(env);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method.toUpperCase();

    try {
      if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(cfg, request) });

      if (path.startsWith('/api/')) {
        // A browser on another website may not use the API. (Requests without an Origin header — tests, monitoring — are allowed.)
        const origin = request.headers.get('Origin');
        if (origin && !isAllowedOrigin(cfg, origin)) return json(cfg, request, 403, { ok: false, error: 'origin' });
        if (!env.DB) return json(cfg, request, 500, { ok: false, error: 'no_database' });
        await ensureSchema(env);

        if (path === '/api/status' && method === 'GET') {
          const st = await etsyStatus(env);
          const sk = await getSigningKey(env);
          return json(cfg, request, 200, {
            ok: true,
            service: 'product-link',
            stage: env.STAGE || 'production',
            tables: tables(env).prefix || '',
            verifier: isMockMode(env) ? 'mock' : 'etsy',
            etsy: { apiKey: st.apiKey, connected: st.connected, reconnectNeeded: st.reconnectNeeded, shop: st.shop, lastOk: st.lastOk, lastError: st.lastError },
            signKey: sk.kid,
            defaults: cfg.defaults,
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
          if (!body) return json(cfg, request, 400, { ok: false, error: 'bad_request' });
          const r = await activate(env, { order: body.order, product: body.product, ip: clientIp(request, env) });
          return json(cfg, request, r.http, r.body);
        }

        const open = /^\/api\/open\/([^/]+)$/.exec(path);
        if (open && method === 'POST') {
          const r = await openLink(env, open[1]);
          if (r.recheck) ctx.waitUntil(recheckOrder(env, r.recheck).catch((e) => console.log('recheck failed', e && e.message)));
          return json(cfg, request, r.http, r.body);
        }

        if (path === '/api/sign' && method === 'POST') {
          const body = await readBody(request);
          if (!body) return json(cfg, request, 400, { ok: false, error: 'bad_request' });
          const r = await signLink(env, { hash: body.hash, d: body.d });
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
};
