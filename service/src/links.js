// The heart of the service: activation (order number -> personal product link), opening (count + limits), signing.
import { tables, getHashKey, getSigningKey, logEvent, counterBump, counterGet } from './db.js';
import { linkHash, orderKey, ipKey, sealOrder, openOrder, signInvitation } from './crypto.js';
import { settings, productOf, productKeys, limitsFor } from './settings.js';
import { verifierFor } from './verifiers.js';

export const HASH_RE = /^[A-Za-z0-9_-]{22}$/;
const HOUR = 3600000;

/**
 * "1234567890", "#1234567890", "1234 567 890", "0001234567890" -> "1234567890"; anything else -> null.
 * Leading zeros are dropped, so one order always has ONE spelling (and therefore one link).
 */
export function normalizeOrder(raw) {
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw <= 0) return null;
  } else if (typeof raw !== 'string' || raw.length > 60) {
    return null;
  }
  const s = String(raw).normalize('NFKC').replace(/[\s#.,-]/g, '').replace(/^0+/, '');
  return /^[1-9]\d{6,13}$/.test(s) ? s : null;
}

function expandV6(ip) {
  let s = ip;
  const pct = s.indexOf('%');
  if (pct >= 0) s = s.slice(0, pct);
  const m4 = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (m4) s = m4[1] + ((Number(m4[2]) << 8) | Number(m4[3])).toString(16) + ':' + ((Number(m4[4]) << 8) | Number(m4[5])).toString(16);
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * Who is trying: an IPv4 address as it is; an IPv6 address by its first half (/64) — one home or phone owns the whole
 * second half, so counting single IPv6 addresses would count nothing.
 */
export function visitorOf(ip) {
  const s = String(ip || 'unknown').trim().toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return 'v4:' + s;
  if (s.includes(':')) {
    const g = expandV6(s);
    if (g) {
      if (!g[0] && !g[1] && !g[2] && !g[3] && !g[4] && g[5] === 0xffff) return 'v4:' + (g[6] >> 8) + '.' + (g[6] & 255) + '.' + (g[7] >> 8) + '.' + (g[7] & 255);
      return 'v6:' + g.slice(0, 4).map((n) => n.toString(16)).join(':');
    }
  }
  return 'x:' + s.slice(0, 60);
}

function parseBag(json) {
  try { const o = JSON.parse(json || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}

function activationSettings(cfg) {
  const a = cfg.activation || {};
  const num = (v, d, min = 0) => (v === undefined || v === null || !Number.isFinite(Number(v)) || Number(v) < min ? d : Number(v));
  const recheckMs = num(a.recheckMinutes, 30) * 60000;
  return {
    maxAttempts: num(a.maxAttemptsPerHour, 10, 1),
    negMs: num(a.negativeCacheMinutes, 2) * 60000,
    retryMs: num(a.retryCheckSeconds, 60) * 1000,
    recheckMs,
    fastRechecks: num(a.maxRechecks, 5),
    slowRecheckMs: Math.max(recheckMs, num(a.slowRecheckHours, 6) * HOUR),
    maxUnchecked: num(a.maxUncheckedPerHour, 30, 1),
    uncheckedSigns: Math.floor(num(a.uncheckedMaxSigns, 5)),
    opensPerVisitor: Math.floor(num(a.maxOpensPerVisitorHour, 60)),
    signsPerVisitor: Math.floor(num(a.maxSignsPerVisitorHour, 40)),
  };
}

/**
 * A brake per visitor and clock hour on openings ("o") and signatures ("s"), so that one source cannot use up a link's
 * whole allowance in a second. Over the brake nothing is counted on the link itself. 0 = no brake.
 */
async function visitorBudget(env, ip, kind, max) {
  if (!(max > 0)) return true;
  const who = await ipKey(await getHashKey(env), visitorOf(ip));
  return (await counterBump(env, who + ':' + kind, Math.floor(Date.now() / HOUR))) <= max;
}
const slowDown = { http: 429, body: { ok: false, error: 'slow_down' } };

// Reasons for which EVERY buyer is let in for as long as they last (the shop is not connected to Etsy yet, or the
// connection has never once worked). Their links are not held back; all other reasons are short outages.
const STANDING_REASONS = new Set(['no_api_key', 'not_connected', 'reconnect', 'unproven']);

/**
 * Which of our NEW products does this order unlock?
 * bag = { l: [listing ids] } from Etsy, { p: [product keys] } from a test order.
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
  }
  return out;
}

/** Everything the order unlocks for the pages the buyer came from (or, with no page named, everything it contains). */
function unlocked(cfg, bag, hints) {
  const out = [];
  for (const h of (hints.length ? hints : [null])) for (const k of productsFor(cfg, bag, h)) if (!out.includes(k)) out.push(k);
  return out;
}

/**
 * Creates the link record if it does not exist yet. An existing record is NEVER reset — the same order cannot get a new
 * deadline or new openings. Only two things can change on a record that exists: it becomes "confirmed" when Etsy
 * confirms the order (which also lifts an automatic withdrawal and the small allowance of an unchecked link).
 */
async function ensureLink(env, cfg, key, product, order, oKey, verified, now, signCap) {
  const t = tables(env);
  const lim = limitsFor(cfg, product);
  const hash = await linkHash(key, product, order);
  let maxSigns = lim.maxSigns;
  if (!verified && signCap > 0) maxSigns = maxSigns > 0 ? Math.min(maxSigns, signCap) : signCap;
  await env.DB.prepare(
    `INSERT INTO ${t.links} (hash, product, order_key, created, max_opens, ttl_ms, expires, max_signs, verified)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(hash) DO UPDATE SET
       max_signs = CASE WHEN verified = 0 AND excluded.verified = 1 THEN ?10 ELSE max_signs END,
       revoked = CASE WHEN excluded.verified = 1 AND revoked = 1 THEN 0 ELSE revoked END,
       verified = MAX(verified, excluded.verified)`)
    .bind(hash, product, oKey, now, lim.maxOpens, lim.ttlMs, lim.ttlStartsAt === 'created' ? now + lim.ttlMs : null, maxSigns, verified ? 1 : 0, lim.maxSigns).run();
  return hash;
}

async function linksFor(env, cfg, key, products, order, oKey, verified, now, signCap) {
  const out = [];
  for (const product of products) {
    out.push({ product, hash: await ensureLink(env, cfg, key, product, order, oKey, verified, now, signCap || 0) });
  }
  return out;
}

/** Writes what we know about an order. "rechecks" counts only the later checks (see recheckOrder), never the buyer's own tries. */
async function saveOrder(env, oKey, fields, now) {
  const t = tables(env);
  await env.DB.prepare(
    `INSERT INTO ${t.orders} (order_key, status, products, sealed_order, source, created, checked_at, rechecks, note)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, 0, ?7)
     ON CONFLICT(order_key) DO UPDATE SET
       created = CASE WHEN status = 'unchecked' THEN excluded.created ELSE created END,
       rechecks = CASE WHEN excluded.status = 'pending' AND status <> 'pending' THEN 0 ELSE rechecks END,
       status = excluded.status, products = excluded.products, sealed_order = excluded.sealed_order,
       source = excluded.source, checked_at = excluded.checked_at, note = excluded.note`)
    .bind(oKey, fields.status, JSON.stringify(fields.bag || {}), fields.sealed || null, fields.source || null, now, fields.note || null).run();
}

/**
 * After Etsy has answered for an order that was let in unchecked: confirm the links it really unlocks, withdraw the others.
 * revoked: 0 = fine · 1 = withdrawn by this service (lifted again if Etsy later confirms) · 2 = blocked by the owner by hand (never lifted by code).
 */
async function settleLinks(env, cfg, oKey, keepProducts) {
  const t = tables(env);
  const rows = (await env.DB.prepare(`SELECT hash, product FROM ${t.links} WHERE order_key = ?1`).bind(oKey).all()).results || [];
  for (const r of rows) {
    if (keepProducts.includes(r.product)) {
      await env.DB.prepare(`UPDATE ${t.links} SET verified = 1, max_signs = ?2, revoked = CASE WHEN revoked = 1 THEN 0 ELSE revoked END WHERE hash = ?1`)
        .bind(r.hash, limitsFor(cfg, r.product).maxSigns).run();
    } else {
      await env.DB.prepare(`UPDATE ${t.links} SET revoked = 1 WHERE hash = ?1 AND verified = 0 AND revoked = 0`).bind(r.hash).run();
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
  const S = activationSettings(cfg);
  const key = await getHashKey(env);
  const now = Date.now();
  const win = Math.floor(now / HOUR);
  const visitor = await ipKey(key, visitorOf(input.ip));
  const tooMany = { http: 429, body: { ok: false, error: 'rate_limited' } };
  const notFound = { http: 404, body: { ok: false, error: 'not_found' } };
  const busy = { http: 503, body: { ok: false, error: 'busy' } };

  // 0) A visitor who has used up the tries of this hour learns nothing more — not even about a number that is already known.
  if (await counterGet(env, visitor, win) >= S.maxAttempts) return tooMany;
  /** One counted try. What counts: every check that may cost a request to Etsy, and every miss. A buyer's own repeats do not. */
  const countTry = async () => {
    const n = await counterBump(env, visitor, win);
    if (n === 1) {
      // first try of this visitor in this hour: forget the visitor counters of earlier hours (we do not keep them)
      await env.DB.prepare(`DELETE FROM ${t.attempts} WHERE win < ?1 AND ip_key NOT LIKE 'g:%'`).bind(win - 1).run();
    }
    return n <= S.maxAttempts;
  };

  const oKey = await orderKey(key, order);
  const row = await env.DB.prepare(`SELECT * FROM ${t.orders} WHERE order_key = ?1`).bind(oKey).first();
  const bag = row ? parseBag(row.products) : {};
  const answer = async (products, verified, signCap) => ({
    http: 200,
    body: { ok: true, verified, links: await linksFor(env, cfg, key, products, order, oKey, verified, now, signCap) },
  });

  // 1) Already confirmed earlier: answer from our own record, Etsy is not asked again.
  if (row && row.status === 'ok') {
    const products = unlocked(cfg, bag, hint ? [hint] : []);
    if (products.length) return answer(products, true);
    return (await countTry()) ? notFound : tooMany;
  }

  // 2) Asked a moment ago and the answer was "no" or "not paid yet": the same answer, without asking again and without counting.
  if (row && row.status === 'rejected' && now - (row.checked_at || 0) < S.negMs) return notFound;
  if (row && row.status === 'unpaid' && now - (row.checked_at || 0) < S.retryMs) return { http: 409, body: { ok: false, error: 'not_paid' } };

  // 3) Let in unchecked earlier. The links it has stay as they are; nothing new is added until Etsy has confirmed the order.
  const pendingHints = row && row.status === 'pending' && Array.isArray(bag.h) ? bag.h.filter((k) => productOf(cfg, k)) : [];
  const samePending = async () => {
    if (!pendingHints.length || (hint && !pendingHints.includes(hint))) return busy;
    return answer(pendingHints, false);
  };
  if (row && row.status === 'pending' && now - (row.checked_at || 0) < S.retryMs) return samePending();

  // 4) Ask the verifier (a test order never reaches Etsy). This is a counted try.
  if (!(await countTry())) return tooMany;
  const verifier = verifierFor(env, order);
  let v;
  try { v = await verifier.verify(order); } catch (e) { v = { result: 'error', reason: 'exception' }; }

  if (v.result === 'ok') {
    const newBag = v.products ? { p: v.products } : { l: v.listingIds || [] };
    const products = unlocked(cfg, newBag, [...pendingHints, ...(hint && !pendingHints.includes(hint) ? [hint] : [])]);
    await saveOrder(env, oKey, { status: 'ok', bag: newBag, source: verifier.name }, now);
    if (row && row.status === 'pending') await settleLinks(env, cfg, oKey, products);
    if (!products.length) {
      await logEvent(env, 'order_without_our_product', 'a paid order of our shop without a new-standard product' + (hint ? ' (page: ' + hint + ')' : ''));
      return notFound;
    }
    if (!v.products && hint && products.includes(hint) && !(productOf(cfg, hint).listingIds || []).length) {
      await logEvent(env, 'launch_grace', hint + ': unlocked by a paid order while listingIds is empty — add the listing ID to config.json');
    }
    return answer(products, true);
  }

  if (v.result === 'not_found') {
    await saveOrder(env, oKey, { status: 'rejected', bag: {}, source: verifier.name }, now);
    if (row && row.status === 'pending') {
      await settleLinks(env, cfg, oKey, []);
      await logEvent(env, 'checked_later', 'no such order — link withdrawn');
    }
    return notFound;
  }

  if (row && row.status === 'pending') {
    // still no clear answer for an order that is already in: note that we asked, and leave everything as it is
    await env.DB.prepare(`UPDATE ${t.orders} SET checked_at = ?2 WHERE order_key = ?1 AND status = 'pending'`).bind(oKey, now).run();
    return samePending();
  }

  if (v.result === 'not_paid') {
    await saveOrder(env, oKey, { status: 'unpaid', bag: {}, source: verifier.name }, now);
    return { http: 409, body: { ok: false, error: 'not_paid' } };
  }

  // "busy" = too many requests right now (Etsy's limit or our own brake): nobody is let in, the buyer tries again in a minute.
  if (v.result !== 'error') return busy;

  // 5) OUR error, or Etsy cannot be reached: let the buyer in, write it down, check later.
  //    - only for the product whose page the buyer came from;
  //    - a lab product only by a test order, a real product never by a test order on the live service (the mock verifier
  //      answers "error" only in mock mode);
  //    - only so many new unchecked orders per hour overall.
  const hp = hint ? productOf(cfg, hint) : null;
  if (!hp || (hp.lab && verifier.name !== 'mock')) return busy;
  if (await counterBump(env, 'g:unchecked', win) > S.maxUnchecked) {
    await logEvent(env, 'unchecked_cap', 'more than ' + S.maxUnchecked + ' unchecked orders in one hour — further buyers are asked to try again later');
    return busy;
  }
  const reason = String(v.reason || 'error').slice(0, 60);
  await saveOrder(env, oKey, { status: 'pending', bag: { h: [hint] }, sealed: await sealOrder(key, order), source: verifier.name, note: reason }, now);
  await logEvent(env, 'let_in_unchecked', hint + ' — ' + reason);
  return answer([hint], false, STANDING_REASONS.has(reason) ? 0 : S.uncheckedSigns);
}

// ---------------------------------------------------------------- later check of an order that was let in unchecked

/**
 * Asks once more about an order that was let in unchecked. Started in the background by an opening or a signing of its
 * link — never by a timer. At most once per "recheckMinutes" for the first few times, then at most once per
 * "slowRecheckHours"; there is no "never again".
 */
export async function recheckOrder(env, oKey, opts = {}) {
  const cfg = settings(env);
  const t = tables(env);
  const S = activationSettings(cfg);
  const now = Date.now();
  const fastMs = opts.minAgeMs !== undefined ? opts.minAgeMs : S.recheckMs;
  const slowMs = opts.minAgeMs !== undefined ? opts.minAgeMs : S.slowRecheckMs;
  // claim the check in one statement, so two openings at the same moment do not both ask Etsy
  const row = await env.DB.prepare(
    `UPDATE ${t.orders} SET checked_at = ?2, rechecks = rechecks + 1
      WHERE order_key = ?1 AND status = 'pending' AND sealed_order IS NOT NULL
        AND (checked_at IS NULL OR checked_at <= ?2 - CASE WHEN rechecks < ?3 THEN ?4 ELSE ?5 END)
      RETURNING products, sealed_order`).bind(oKey, now, S.fastRechecks, fastMs, slowMs).first();
  if (!row) return 'skipped';
  const key = await getHashKey(env);
  let order;
  try { order = await openOrder(key, row.sealed_order); } catch (e) { return 'unreadable'; }
  const verifier = verifierFor(env, order);
  let v;
  try { v = await verifier.verify(order); } catch (e) { v = { result: 'error' }; }
  const hints = (parseBag(row.products).h || []).filter((k) => productOf(cfg, k));
  if (v.result === 'ok') {
    const newBag = v.products ? { p: v.products } : { l: v.listingIds || [] };
    const keep = unlocked(cfg, newBag, hints);
    await env.DB.prepare(`UPDATE ${t.orders} SET status = 'ok', products = ?2, sealed_order = NULL, source = ?3, note = NULL WHERE order_key = ?1`)
      .bind(oKey, JSON.stringify(newBag), verifier.name).run();
    await settleLinks(env, cfg, oKey, keep);
    await logEvent(env, 'checked_later', 'confirmed: ' + (keep.join(',') || 'no new-standard product'));
    return 'confirmed';
  }
  if (v.result === 'not_found') {
    await env.DB.prepare(`UPDATE ${t.orders} SET status = 'rejected', products = '{}', sealed_order = NULL, source = ?2, note = NULL WHERE order_key = ?1`)
      .bind(oKey, verifier.name).run();
    await settleLinks(env, cfg, oKey, []);
    await logEvent(env, 'checked_later', 'no such order — link withdrawn');
    return 'withdrawn';
  }
  return 'still_pending';
}

// ---------------------------------------------------------------- POST /api/open/{hash}

export async function openLink(env, hash, ip) {
  if (!HASH_RE.test(hash)) return { http: 404, body: { ok: false, error: 'not_found' } };
  if (!(await visitorBudget(env, ip, 'o', activationSettings(settings(env)).opensPerVisitor))) return slowDown;
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

async function trySign(env, hash, now) {
  const t = tables(env);
  // Only a link that has been opened, has not run out and has not been withdrawn may sign. Signing is not an opening.
  return env.DB.prepare(
    `UPDATE ${t.links} SET signs = signs + 1
      WHERE hash = ?1 AND revoked = 0 AND first_open IS NOT NULL AND expires IS NOT NULL AND expires > ?2
        AND opens <= max_opens AND (max_signs = 0 OR signs < max_signs)
      RETURNING product, expires, verified, order_key, signs, max_signs`).bind(hash, now).first();
}

export async function signLink(env, input) {
  const hash = typeof input.hash === 'string' ? input.hash : '';
  const digest = typeof input.d === 'string' ? input.d : '';
  if (!HASH_RE.test(hash)) return { http: 404, body: { ok: false, error: 'not_found' } };
  // d = base64url(SHA-256(m)) — 43 characters. The invitation text itself is never sent to us.
  if (!/^[A-Za-z0-9_-]{43}$/.test(digest)) return { http: 400, body: { ok: false, error: 'bad_digest' } };
  const cfg = settings(env);
  const t = tables(env);
  const now = Date.now();
  if (!(await visitorBudget(env, input.ip, 's', activationSettings(cfg).signsPerVisitor))) return slowDown;

  const pre = await env.DB.prepare(`SELECT product FROM ${t.links} WHERE hash = ?1`).bind(hash).first();
  if (!pre) return { http: 404, body: { ok: false, error: 'not_found' } };
  // a product that is not in the settings (any more), or whose invitations are not signed, gets no signature
  if (!productOf(cfg, pre.product) || !limitsFor(cfg, pre.product).sign) return { http: 409, body: { ok: false, error: 'signing_off' } };

  let row = await trySign(env, hash, now);
  if (!row) {
    const cur = await env.DB.prepare(`SELECT revoked, expires, first_open, signs, max_signs, verified, order_key FROM ${t.links} WHERE hash = ?1`).bind(hash).first();
    if (!cur) return { http: 404, body: { ok: false, error: 'not_found' } };
    if (!cur.revoked && cur.first_open === null) return { http: 409, body: { ok: false, error: 'not_opened' } };
    const atLimit = !cur.revoked && cur.first_open !== null && cur.expires > now && cur.max_signs > 0 && cur.signs >= cur.max_signs;
    if (atLimit && !cur.verified) {
      // an unchecked link has used its small allowance: ask about the order right now (not more often than once a minute)
      const S = activationSettings(cfg);
      let outcome = 'skipped';
      try { outcome = await recheckOrder(env, cur.order_key, { minAgeMs: S.retryMs }); } catch (e) {}
      if (outcome === 'confirmed') row = await trySign(env, hash, now);
      if (!row && outcome === 'withdrawn') return { http: 410, body: { ok: false, error: 'expired', reason: 'withdrawn' } };
      if (!row) return { http: 429, body: { ok: false, error: 'sign_limit', unchecked: true } };
    } else if (atLimit) {
      return { http: 429, body: { ok: false, error: 'sign_limit', max: cur.max_signs } };
    } else {
      return { http: 410, body: { ok: false, error: 'expired', reason: cur.revoked ? 'withdrawn' : 'time' } };
    }
  }
  const sk = await getSigningKey(env);
  return {
    http: 200,
    recheck: row.verified ? null : row.order_key,
    body: { ok: true, s: await signInvitation(sk.privateKey, row.product, digest), kid: sk.kid, expires: row.expires, signs: row.signs, maxSigns: row.max_signs },
  };
}
