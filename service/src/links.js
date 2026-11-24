// The heart of the service: activation (order number -> personal product link), opening (count + limits), signing.
import { tables, getHashKey, getSigningKey, logEvent } from './db.js';
import { linkHash, orderKey, ipKey, sealOrder, openOrder, signInvitation } from './crypto.js';
import { settings, productOf, productKeys, limitsFor } from './settings.js';
import { verifierFor } from './verifiers.js';

export const HASH_RE = /^[A-Za-z0-9_-]{22}$/;
const HOUR = 3600000;

/** "1234567890", "#1234567890", "1234 567 890" -> "1234567890"; anything else -> null. */
export function normalizeOrder(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).replace(/[\s#.,-]/g, '');
  return /^\d{7,14}$/.test(s) ? s : null;
}

function parseBag(json) {
  try { const o = JSON.parse(json || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}

/**
 * Which of our NEW products does this order unlock?
 * bag = { l: [listing ids] } from Etsy, { p: [product keys] } from a test order, { h: [hinted products] } while unchecked.
 */
function productsFor(cfg, bag, hint) {
  const out = [];
  if (Array.isArray(bag.p)) {
    for (const k of bag.p) if (productOf(cfg, k) && !out.includes(k)) out.push(k);
    return out;
  }
  if (Array.isArray(bag.l)) {
    const ids = bag.l.map(Number);
    for (const key of productKeys(cfg)) {
      const p = productOf(cfg, key);
      if (p.lab) continue; // a lab product is never unlocked by a real order
      if ((p.listingIds || []).map(Number).some((id) => ids.includes(id))) out.push(key);
    }
    // Launch grace: the page's own product has no listing ID in the settings yet -> any paid order of our shop unlocks it.
    const hp = hint ? productOf(cfg, hint) : null;
    if (hp && !hp.lab && !(hp.listingIds || []).length && !out.includes(hint)) out.push(hint);
    return out;
  }
  if (Array.isArray(bag.h)) {
    for (const k of bag.h) if (productOf(cfg, k) && !out.includes(k)) out.push(k);
  }
  return out;
}

async function bumpAttempts(env, key, ip) {
  const t = tables(env);
  const win = Math.floor(Date.now() / HOUR);
  const k = await ipKey(key, ip || 'unknown');
  const row = await env.DB.prepare(
    `INSERT INTO ${t.attempts} (ip_key, win, n) VALUES (?1, ?2, 1)
     ON CONFLICT(ip_key, win) DO UPDATE SET n = n + 1 RETURNING n`).bind(k, win).first();
  const n = row ? row.n : 1;
  if (n === 1) {
    // first attempt of this visitor in this hour: forget counters of earlier hours (we do not keep them)
    await env.DB.prepare(`DELETE FROM ${t.attempts} WHERE win < ?1`).bind(win - 1).run();
  }
  return n;
}

/** Creates the link record if it does not exist yet. An existing record is NEVER reset — the same order cannot get a new deadline. */
async function ensureLink(env, cfg, key, product, order, oKey, verified, now) {
  const t = tables(env);
  const lim = limitsFor(cfg, product);
  const hash = await linkHash(key, product, order);
  await env.DB.prepare(
    `INSERT INTO ${t.links} (hash, product, order_key, created, max_opens, ttl_ms, expires, max_signs, verified)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(hash) DO UPDATE SET verified = MAX(verified, excluded.verified)`)
    .bind(hash, product, oKey, now, lim.maxOpens, lim.ttlMs, lim.ttlStartsAt === 'created' ? now + lim.ttlMs : null, lim.maxSigns, verified ? 1 : 0).run();
  return hash;
}

async function linksFor(env, cfg, key, products, order, oKey, verified, now) {
  const out = [];
  for (const product of products) {
    out.push({ product, hash: await ensureLink(env, cfg, key, product, order, oKey, verified, now) });
  }
  return out;
}

async function saveOrder(env, oKey, fields, now) {
  const t = tables(env);
  await env.DB.prepare(
    `INSERT INTO ${t.orders} (order_key, status, products, sealed_order, source, created, checked_at, rechecks, note)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, 0, ?7)
     ON CONFLICT(order_key) DO UPDATE SET status = excluded.status, products = excluded.products,
       sealed_order = excluded.sealed_order, source = excluded.source, checked_at = excluded.checked_at,
       rechecks = ${t.orders}.rechecks + 1, note = excluded.note`)
    .bind(oKey, fields.status, JSON.stringify(fields.bag || {}), fields.sealed || null, fields.source || null, now, fields.note || null).run();
}

/** After Etsy has answered for an order that was let in unchecked: confirm the links it really unlocks, withdraw the others. */
async function settleLinks(env, oKey, keepProducts) {
  const t = tables(env);
  const rows = (await env.DB.prepare(`SELECT hash, product FROM ${t.links} WHERE order_key = ?1`).bind(oKey).all()).results || [];
  for (const r of rows) {
    if (keepProducts.includes(r.product)) {
      await env.DB.prepare(`UPDATE ${t.links} SET verified = 1 WHERE hash = ?1`).bind(r.hash).run();
    } else {
      await env.DB.prepare(`UPDATE ${t.links} SET revoked = 1 WHERE hash = ?1 AND verified = 0`).bind(r.hash).run();
    }
  }
}

// ---------------------------------------------------------------- POST /api/activate

export async function activate(env, input) {
  const cfg = settings(env);
  const order = normalizeOrder(input.order);
  if (!order) return { http: 400, body: { ok: false, error: 'bad_order' } };
  const hint = productOf(cfg, input.product) ? input.product : null;

  const t = tables(env);
  const key = await getHashKey(env);
  const oKey = await orderKey(key, order);
  const now = Date.now();
  const act = cfg.activation || {};
  const maxAttempts = Number(act.maxAttemptsPerHour) > 0 ? Number(act.maxAttemptsPerHour) : 10;
  const negMs = (Number(act.negativeCacheMinutes) >= 0 ? Number(act.negativeCacheMinutes) : 15) * 60000;
  const recheckMs = (Number(act.recheckMinutes) >= 0 ? Number(act.recheckMinutes) : 30) * 60000;
  const maxRechecks = Number(act.maxRechecks) >= 0 ? Number(act.maxRechecks) : 5;
  const notFound = { http: 404, body: { ok: false, error: 'not_found' } };

  const row = await env.DB.prepare(`SELECT * FROM ${t.orders} WHERE order_key = ?1`).bind(oKey).first();
  const bag = row ? parseBag(row.products) : {};

  // 1) Already confirmed earlier: answer from our own record, Etsy is not asked again.
  if (row && row.status === 'ok') {
    const products = productsFor(cfg, bag, hint);
    if (products.length) return { http: 200, body: { ok: true, verified: true, links: await linksFor(env, cfg, key, products, order, oKey, true, now) } };
    if (await bumpAttempts(env, key, input.ip) > maxAttempts) return { http: 429, body: { ok: false, error: 'rate_limited' } };
    return notFound;
  }

  // Everything below may cost a request to Etsy, so it is counted per visitor.
  if (await bumpAttempts(env, key, input.ip) > maxAttempts) return { http: 429, body: { ok: false, error: 'rate_limited' } };

  // 2) Etsy said "no such order" a moment ago: do not ask again for a few minutes.
  if (row && row.status === 'rejected' && now - (row.checked_at || 0) < negMs) return notFound;

  // 3) Let in unchecked earlier and it is too soon (or too often) to ask Etsy again: the same links stay as they are.
  if (row && row.status === 'pending') {
    const hints = Array.isArray(bag.h) ? bag.h.slice() : [];
    if (hint && !hints.includes(hint)) hints.push(hint);
    const tooSoon = now - (row.checked_at || 0) < recheckMs || (row.rechecks || 0) >= maxRechecks;
    if (tooSoon) {
      const products = productsFor(cfg, { h: hints }, null);
      if (!products.length) return notFound;
      if (hints.length !== (bag.h || []).length) {
        await env.DB.prepare(`UPDATE ${t.orders} SET products = ?2 WHERE order_key = ?1`).bind(oKey, JSON.stringify({ h: hints })).run();
      }
      return { http: 200, body: { ok: true, verified: false, links: await linksFor(env, cfg, key, products, order, oKey, false, now) } };
    }
    bag.h = hints;
  }

  // 4) Ask the verifier (a test order never reaches Etsy).
  const verifier = verifierFor(env, order);
  let v;
  try { v = await verifier.verify(order); } catch (e) { v = { result: 'error', reason: 'exception' }; }

  if (v.result === 'ok') {
    const newBag = v.products ? { p: v.products } : { l: v.listingIds || [] };
    await saveOrder(env, oKey, { status: 'ok', bag: newBag, source: verifier.name }, now);
    const products = productsFor(cfg, newBag, hint);
    if (row && row.status === 'pending') await settleLinks(env, oKey, products);
    if (!products.length) {
      await logEvent(env, 'order_without_our_product', 'a paid order of our shop without a new-standard product' + (hint ? ' (page: ' + hint + ')' : ''));
      return notFound;
    }
    if (!v.products && hint && products.includes(hint) && !(productOf(cfg, hint).listingIds || []).length) {
      await logEvent(env, 'launch_grace', hint + ': unlocked by a paid order while listingIds is empty — add the listing ID to config.json');
    }
    return { http: 200, body: { ok: true, verified: true, links: await linksFor(env, cfg, key, products, order, oKey, true, now) } };
  }

  if (v.result === 'not_found') {
    await saveOrder(env, oKey, { status: 'rejected', bag: {}, source: verifier.name }, now);
    if (row && row.status === 'pending') await settleLinks(env, oKey, []);
    return notFound;
  }

  if (v.result === 'not_paid') {
    // nothing is remembered: the buyer simply tries again when the payment has gone through
    return { http: 409, body: { ok: false, error: 'not_paid' } };
  }

  // 5) Our own error, or Etsy cannot be reached: let the buyer in, write it down, check later.
  //    A lab product is let in this way only by a test order, never by a number that would have gone to Etsy.
  const hints = (Array.isArray(bag.h) ? bag.h.slice() : []);
  if (hint && !hints.includes(hint)) hints.push(hint);
  const products = productsFor(cfg, { h: hints }, null).filter((k) => verifier.name === 'mock' || !productOf(cfg, k).lab);
  if (!products.length) return { http: 503, body: { ok: false, error: 'unavailable' } };
  await saveOrder(env, oKey, { status: 'pending', bag: { h: products }, sealed: await sealOrder(key, order), source: verifier.name, note: String(v.reason || '').slice(0, 60) }, now);
  await logEvent(env, 'let_in_unchecked', products.join(',') + ' — ' + (v.reason || 'error'));
  return { http: 200, body: { ok: true, verified: false, links: await linksFor(env, cfg, key, products, order, oKey, false, now) } };
}

// ---------------------------------------------------------------- later check of an order that was let in unchecked

export async function recheckOrder(env, oKey) {
  const cfg = settings(env);
  const t = tables(env);
  const act = cfg.activation || {};
  const recheckMs = (Number(act.recheckMinutes) >= 0 ? Number(act.recheckMinutes) : 30) * 60000;
  const maxRechecks = Number(act.maxRechecks) >= 0 ? Number(act.maxRechecks) : 5;
  const now = Date.now();
  // claim the check in one statement, so two openings at the same moment do not both ask Etsy
  const row = await env.DB.prepare(
    `UPDATE ${t.orders} SET checked_at = ?2, rechecks = rechecks + 1
     WHERE order_key = ?1 AND status = 'pending' AND sealed_order IS NOT NULL AND rechecks < ?3 AND (checked_at IS NULL OR checked_at <= ?4)
     RETURNING products, sealed_order`).bind(oKey, now, maxRechecks, now - recheckMs).first();
  if (!row) return 'skipped';
  const key = await getHashKey(env);
  let order;
  try { order = await openOrder(key, row.sealed_order); } catch (e) { return 'unreadable'; }
  const verifier = verifierFor(env, order);
  let v;
  try { v = await verifier.verify(order); } catch (e) { v = { result: 'error' }; }
  const bag = parseBag(row.products);
  if (v.result === 'ok') {
    const newBag = v.products ? { p: v.products } : { l: v.listingIds || [] };
    let keep = [];
    for (const h of (bag.h || [])) for (const k of productsFor(cfg, newBag, h)) if (!keep.includes(k)) keep.push(k);
    if (!(bag.h || []).length) keep = productsFor(cfg, newBag, null);
    await env.DB.prepare(`UPDATE ${t.orders} SET status = 'ok', products = ?2, sealed_order = NULL, source = ?3, note = NULL WHERE order_key = ?1`)
      .bind(oKey, JSON.stringify(newBag), verifier.name).run();
    await settleLinks(env, oKey, keep);
    await logEvent(env, 'checked_later', 'confirmed: ' + (keep.join(',') || 'no new-standard product'));
    return 'confirmed';
  }
  if (v.result === 'not_found') {
    await env.DB.prepare(`UPDATE ${t.orders} SET status = 'rejected', products = '{}', sealed_order = NULL, source = ?2, note = NULL WHERE order_key = ?1`)
      .bind(oKey, verifier.name).run();
    await settleLinks(env, oKey, []);
    await logEvent(env, 'checked_later', 'no such order — link withdrawn');
    return 'withdrawn';
  }
  return 'still_pending';
}

// ---------------------------------------------------------------- POST /api/open/{hash}

export async function openLink(env, hash) {
  if (!HASH_RE.test(hash)) return { http: 404, body: { ok: false, error: 'not_found' } };
  const t = tables(env);
  const now = Date.now();
  // The check and the count are ONE statement, so two openings at the same moment can never both slip past the limit.
  const row = await env.DB.prepare(
    `UPDATE ${t.links}
        SET opens = opens + 1,
            first_open = COALESCE(first_open, ?2),
            last_open = ?2,
            expires = COALESCE(expires, ?2 + ttl_ms)
      WHERE hash = ?1 AND revoked = 0 AND opens < max_opens AND (expires IS NULL OR expires > ?2)
      RETURNING product, opens, max_opens, first_open, last_open, expires, verified, order_key`).bind(hash, now).first();
  if (row) {
    return {
      http: 200,
      recheck: row.verified ? null : row.order_key,
      body: { ok: true, product: row.product, opens: row.opens, maxOpens: row.max_opens, firstOpen: row.first_open, lastOpen: row.last_open, expires: row.expires, now },
    };
  }
  const cur = await env.DB.prepare(`SELECT product, opens, max_opens, expires, revoked FROM ${t.links} WHERE hash = ?1`).bind(hash).first();
  if (!cur) return { http: 404, body: { ok: false, error: 'not_found' } };
  const reason = cur.revoked ? 'withdrawn' : cur.expires !== null && cur.expires <= now ? 'time' : 'opens';
  return { http: 410, body: { ok: false, error: 'expired', reason, product: cur.product, opens: cur.opens, maxOpens: cur.max_opens, expires: cur.expires, now } };
}

// ---------------------------------------------------------------- POST /api/sign

export async function signLink(env, input) {
  const hash = typeof input.hash === 'string' ? input.hash : '';
  const digest = typeof input.d === 'string' ? input.d : '';
  if (!HASH_RE.test(hash)) return { http: 404, body: { ok: false, error: 'not_found' } };
  // d = base64url(SHA-256(m)) — 43 characters. The invitation text itself is never sent to us.
  if (!/^[A-Za-z0-9_-]{43}$/.test(digest)) return { http: 400, body: { ok: false, error: 'bad_digest' } };
  const t = tables(env);
  const now = Date.now();
  // Only a link that has been opened, has not run out and has not been withdrawn may sign. Signing is not an opening.
  const row = await env.DB.prepare(
    `UPDATE ${t.links} SET signs = signs + 1
      WHERE hash = ?1 AND revoked = 0 AND first_open IS NOT NULL AND expires IS NOT NULL AND expires > ?2
        AND opens <= max_opens AND (max_signs = 0 OR signs < max_signs)
      RETURNING product, expires`).bind(hash, now).first();
  if (!row) {
    const cur = await env.DB.prepare(`SELECT revoked, expires, first_open, signs, max_signs FROM ${t.links} WHERE hash = ?1`).bind(hash).first();
    if (!cur) return { http: 404, body: { ok: false, error: 'not_found' } };
    if (!cur.revoked && cur.first_open === null) return { http: 409, body: { ok: false, error: 'not_opened' } };
    if (!cur.revoked && cur.first_open !== null && cur.expires > now && cur.max_signs > 0 && cur.signs >= cur.max_signs) {
      return { http: 429, body: { ok: false, error: 'sign_limit' } };
    }
    return { http: 410, body: { ok: false, error: 'expired', reason: cur.revoked ? 'withdrawn' : 'time' } };
  }
  const sk = await getSigningKey(env);
  return { http: 200, body: { ok: true, s: await signInvitation(sk.privateKey, row.product, digest), kid: sk.kid, expires: row.expires } };
}
