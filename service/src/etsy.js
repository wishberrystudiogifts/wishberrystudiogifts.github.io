// Etsy Open API v3 — a Seller App for OUR shop only: OAuth 2.0 (authorization code + PKCE), tokens kept in D1,
// and one read of one receipt per activation. NOT TESTED AGAINST THE LIVE API (24 Nov 2026) — written from
// developer.etsy.com/documentation (authentication, requests) and the published OpenAPI types; tested against a local stand-in.
//
// Rules this file follows (project rule "Etsy — yellow", 23 Nov 2026): the fewest possible requests —
// one receipt request per activation, the answer is kept, the token is refreshed only when it has run out,
// nothing runs on a schedule, and after an error there is at most one retry.
import { b64url, randomToken, sha256 } from './crypto.js';
import { kvGet, kvPut, kvDelete, logEvent, tables } from './db.js';
import { settings } from './settings.js';

const DEFAULTS = {
  auth: 'https://www.etsy.com/oauth/connect',
  token: 'https://api.etsy.com/v3/public/oauth/token',
  api: 'https://api.etsy.com/v3/application',
};
const TIMEOUT_MS = 8000;
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

/** Addresses of the Etsy API. The three ETSY_*_URL variables exist only so tests can point at a local stand-in. */
function urls(env) {
  return {
    auth: env.ETSY_AUTH_URL || DEFAULTS.auth,
    token: env.ETSY_TOKEN_URL || DEFAULTS.token,
    api: (env.ETSY_API_URL || DEFAULTS.api).replace(/\/+$/, ''),
  };
}

export function hasApiKey(env) {
  return !!(env.ETSY_KEYSTRING && env.ETSY_SHARED_SECRET);
}

/** x-api-key = keystring:shared_secret (required since 9 Feb 2026). */
function apiKey(env) {
  return env.ETSY_KEYSTRING + ':' + env.ETSY_SHARED_SECRET;
}

async function timedFetch(url, init) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(res) {
  try { return await res.json(); } catch (e) { return null; }
}

// ---------------------------------------------------------------- stored connection

export async function getConnection(env) {
  const v = await kvGet(env, 'etsy_token');
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return null; }
}

async function saveConnection(env, conn) {
  await kvPut(env, 'etsy_token', JSON.stringify(conn));
}

async function setHealth(env, patch) {
  let cur = {};
  try { cur = JSON.parse((await kvGet(env, 'etsy_health')) || '{}'); } catch (e) {}
  await kvPut(env, 'etsy_health', JSON.stringify({ ...cur, ...patch }));
}

export async function etsyStatus(env) {
  const conn = await getConnection(env);
  let health = {};
  try { health = JSON.parse((await kvGet(env, 'etsy_health')) || '{}'); } catch (e) {}
  return {
    apiKey: hasApiKey(env),
    connected: !!(conn && conn.refresh_token) && !health.reconnect,
    reconnectNeeded: !!health.reconnect,
    shop: conn ? conn.shop_name || null : null,
    connectedAt: conn ? conn.connected_at || null : null,
    lastOk: health.lastOk || null,
    lastError: health.lastError || null,
  };
}

// ---------------------------------------------------------------- OAuth: connect and callback

function callbackUrl(request) {
  return new URL(request.url).origin + '/etsy/callback';
}

/** GET /etsy/connect — the shop owner opens this once and taps "Allow" on Etsy. */
export async function startConnect(request, env) {
  if (!hasApiKey(env)) return { error: 'no_api_key' };
  const st = await etsyStatus(env);
  if (st.connected) return { error: 'already_connected', shop: st.shop };

  const t = tables(env);
  // forget states that were never used
  await env.DB.prepare(`DELETE FROM ${t.kv} WHERE k LIKE 'oauth_state:%' AND updated < ?1`).bind(Date.now() - STATE_MAX_AGE_MS).run();

  const state = randomToken(24);
  const verifier = randomToken(32); // 43 characters from [A-Za-z0-9_-]
  const challenge = b64url(await sha256(verifier));
  await kvPut(env, 'oauth_state:' + state, JSON.stringify({ verifier, created: Date.now() }));

  const cfg = settings(env);
  const u = new URL(urls(env).auth);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', env.ETSY_KEYSTRING);
  u.searchParams.set('redirect_uri', callbackUrl(request));
  u.searchParams.set('scope', (cfg.etsy && cfg.etsy.scopes) || 'transactions_r');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return { redirect: u.toString() };
}

async function tokenRequest(env, form) {
  const res = await timedFetch(urls(env).token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-api-key': apiKey(env), Accept: 'application/json' },
    body: new URLSearchParams(form).toString(),
  });
  return { status: res.status, json: await readJson(res) };
}

async function apiGet(env, path, accessToken) {
  const headers = { 'x-api-key': apiKey(env), Accept: 'application/json' };
  if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
  const res = await timedFetch(urls(env).api + path, { method: 'GET', headers });
  return { status: res.status, json: await readJson(res) };
}

/** GET /etsy/callback — Etsy sends the owner back here with ?code&state. */
export async function finishConnect(request, env) {
  const q = new URL(request.url).searchParams;
  if (q.get('error')) return { error: 'denied', detail: q.get('error') };
  const state = q.get('state') || '';
  const code = q.get('code') || '';
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(state) || !code) return { error: 'bad_request' };

  const raw = await kvGet(env, 'oauth_state:' + state);
  await kvDelete(env, 'oauth_state:' + state); // one use only
  if (!raw) return { error: 'state' };
  let saved;
  try { saved = JSON.parse(raw); } catch (e) { return { error: 'state' }; }
  if (!saved.verifier || Date.now() - saved.created > STATE_MAX_AGE_MS) return { error: 'state' };

  let tok;
  try {
    tok = await tokenRequest(env, {
      grant_type: 'authorization_code',
      client_id: env.ETSY_KEYSTRING,
      redirect_uri: callbackUrl(request),
      code,
      code_verifier: saved.verifier,
    });
  } catch (e) {
    return { error: 'token_network' };
  }
  if (tok.status !== 200 || !tok.json || !tok.json.access_token || !tok.json.refresh_token) {
    await logEvent(env, 'etsy_connect_failed', 'token http ' + tok.status + ' ' + ((tok.json && (tok.json.error || tok.json.error_description)) || ''));
    return { error: 'token', detail: tok.status };
  }

  // Which shop is this? It must be OUR shop, otherwise the connection is thrown away.
  const cfg = settings(env);
  const access = tok.json.access_token;
  const userId = /^\d+\./.test(access) ? access.split('.')[0] : null;
  let shopId = null;
  try {
    const me = await apiGet(env, '/users/me', access);
    if (me.status === 200 && me.json && me.json.shop_id) shopId = String(me.json.shop_id);
  } catch (e) {}
  if (!shopId) shopId = userId; // Etsy: "This number is also a valid shop ID for the user's shop."
  if (!shopId) return { error: 'shop_unknown' };

  let shopName = null;
  const wantId = cfg.etsy && cfg.etsy.shopId ? String(cfg.etsy.shopId) : null;
  if (wantId) {
    if (wantId !== shopId) {
      await logEvent(env, 'etsy_connect_refused', 'another shop tried to connect');
      return { error: 'wrong_shop' };
    }
  } else {
    let shop;
    try { shop = await apiGet(env, '/shops/' + shopId, access); } catch (e) { return { error: 'shop_network' }; }
    if (shop.status !== 200 || !shop.json || !shop.json.shop_name) {
      await logEvent(env, 'etsy_connect_failed', 'shop lookup http ' + shop.status);
      return { error: 'shop_lookup', detail: shop.status };
    }
    shopName = String(shop.json.shop_name);
    const want = String((cfg.etsy && cfg.etsy.shopName) || '');
    if (!want || shopName.toLowerCase() !== want.toLowerCase()) {
      await logEvent(env, 'etsy_connect_refused', 'another shop tried to connect');
      return { error: 'wrong_shop' };
    }
  }

  const now = Date.now();
  await saveConnection(env, {
    access_token: access,
    refresh_token: tok.json.refresh_token,
    expires_at: now + Math.max(60, Number(tok.json.expires_in) || 3600) * 1000,
    user_id: userId,
    shop_id: shopId,
    shop_name: shopName,
    connected_at: now,
    refreshed_at: now,
  });
  await setHealth(env, { reconnect: false, lastError: null });
  await logEvent(env, 'etsy_connected', 'shop ' + (shopName || shopId));
  return { ok: true, shop: shopName || shopId };
}

// ---------------------------------------------------------------- access token (refreshed only when it has run out)

async function refresh(env, conn) {
  let tok;
  try {
    tok = await tokenRequest(env, { grant_type: 'refresh_token', client_id: env.ETSY_KEYSTRING, refresh_token: conn.refresh_token });
  } catch (e) {
    return { error: 'network' };
  }
  if (tok.status === 200 && tok.json && tok.json.access_token) {
    const now = Date.now();
    const next = {
      ...conn,
      access_token: tok.json.access_token,
      refresh_token: tok.json.refresh_token || conn.refresh_token,
      expires_at: now + Math.max(60, Number(tok.json.expires_in) || 3600) * 1000,
      refreshed_at: now,
    };
    await saveConnection(env, next);
    return { conn: next };
  }
  // Another instance may have refreshed a moment ago (the refresh token can change on every refresh).
  const again = await getConnection(env);
  if (again && again.access_token !== conn.access_token && again.expires_at - 60000 > Date.now()) return { conn: again };
  if (tok.status === 400 || tok.status === 401) {
    // the refresh token is no longer valid (90 days unused, or access was removed on Etsy): the owner has to connect again
    await setHealth(env, { reconnect: true, lastError: { at: Date.now(), what: 'refresh http ' + tok.status } });
    await logEvent(env, 'etsy_reconnect_needed', 'refresh http ' + tok.status);
    return { error: 'reconnect' };
  }
  return { error: 'http_' + tok.status };
}

async function currentConnection(env, { force = false } = {}) {
  const conn = await getConnection(env);
  if (!conn || !conn.refresh_token) return { error: 'not_connected' };
  if (!force && conn.access_token && conn.expires_at - 60000 > Date.now()) return { conn };
  return refresh(env, conn);
}

// ---------------------------------------------------------------- the one question we ask Etsy

/**
 * Reads one receipt of our shop.
 * Returns { result: 'ok', listingIds } | { result: 'not_found' } | { result: 'not_paid' } | { result: 'error', reason }.
 * 'error' always means "our side or Etsy could not answer" — the caller lets the buyer in and checks again later.
 */
export async function verifyReceipt(env, order) {
  if (!hasApiKey(env)) return { result: 'error', reason: 'no_api_key' };
  let c = await currentConnection(env);
  if (c.error) return { result: 'error', reason: c.error };

  const ask = (conn) => apiGet(env, '/shops/' + conn.shop_id + '/receipts/' + order, conn.access_token);
  let res;
  let retried = false;
  try {
    res = await ask(c.conn);
  } catch (e) {
    retried = true;
    try { res = await ask(c.conn); } catch (e2) { res = null; }
  }
  if (res && res.status === 401 && !retried) {
    // the token was refused: refresh once, ask once more
    retried = true;
    c = await currentConnection(env, { force: true });
    if (c.error) return { result: 'error', reason: c.error };
    try { res = await ask(c.conn); } catch (e) { res = null; }
  } else if (res && res.status >= 500 && !retried) {
    retried = true;
    try { res = await ask(c.conn); } catch (e) { res = null; }
  }

  if (!res) {
    await setHealth(env, { lastError: { at: Date.now(), what: 'network' } });
    return { result: 'error', reason: 'network' };
  }
  if (res.status === 200 && res.json && res.json.receipt_id) {
    const r = res.json;
    const status = String(r.status || '').toLowerCase();
    const listingIds = Array.isArray(r.transactions)
      ? r.transactions.map((t) => Number(t && t.listing_id)).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    await setHealth(env, { lastOk: Date.now(), lastError: null });
    if (status === 'canceled' || status === 'fully refunded') return { result: 'not_found' };
    if (r.is_paid === true || status === 'paid' || status === 'completed') return { result: 'ok', listingIds };
    return { result: 'not_paid' };
  }
  if (res.status === 404 || res.status === 400) {
    // Etsy says plainly: there is no such order in our shop
    await setHealth(env, { lastOk: Date.now(), lastError: null });
    return { result: 'not_found' };
  }
  await setHealth(env, { lastError: { at: Date.now(), what: 'http ' + res.status } });
  await logEvent(env, 'etsy_error', 'receipt http ' + res.status);
  return { result: 'error', reason: 'http_' + res.status };
}
