// D1 access: table names, schema that creates itself, tiny key-value store, event log.
import { b64url, unb64url, generateSigningKey, importSigningKey } from './crypto.js';

/**
 * Table names. Previews set TABLE_PREFIX (for example "pv_") so that they never touch the live tables.
 * A prefix that is set but not well-formed stops the service: silently falling back to the live tables would be worse.
 */
export function tables(env) {
  const raw = env.TABLE_PREFIX === undefined || env.TABLE_PREFIX === null ? '' : String(env.TABLE_PREFIX);
  if (raw !== '' && !/^[a-z][a-z0-9_]{0,15}$/.test(raw)) throw new Error('TABLE_PREFIX is not valid (lower-case letter, then up to 15 letters, digits or _)');
  const p = raw;
  return { prefix: p, links: p + 'links', orders: p + 'orders', kv: p + 'kv', attempts: p + 'attempts', log: p + 'log' };
}

const schemaReady = new Map(); // table prefix -> Promise

/** Creates the tables on the first request of this instance. Nothing is ever migrated by hand. */
export function ensureSchema(env) {
  const t = tables(env);
  if (!schemaReady.has(t.prefix)) {
    const stmts = [
      `CREATE TABLE IF NOT EXISTS ${t.links} (
         hash TEXT PRIMARY KEY,
         product TEXT NOT NULL,
         order_key TEXT NOT NULL,
         created INTEGER NOT NULL,
         first_open INTEGER,
         last_open INTEGER,
         opens INTEGER NOT NULL DEFAULT 0,
         max_opens INTEGER NOT NULL,
         ttl_ms INTEGER NOT NULL,
         expires INTEGER,
         signs INTEGER NOT NULL DEFAULT 0,
         max_signs INTEGER NOT NULL DEFAULT 0,
         verified INTEGER NOT NULL DEFAULT 0,
         revoked INTEGER NOT NULL DEFAULT 0
       )`,
      `CREATE INDEX IF NOT EXISTS ${t.links}_order ON ${t.links} (order_key)`,
      `CREATE TABLE IF NOT EXISTS ${t.orders} (
         order_key TEXT PRIMARY KEY,
         status TEXT NOT NULL,
         products TEXT NOT NULL DEFAULT '[]',
         sealed_order TEXT,
         source TEXT,
         created INTEGER NOT NULL,
         checked_at INTEGER,
         rechecks INTEGER NOT NULL DEFAULT 0,
         note TEXT
       )`,
      `CREATE TABLE IF NOT EXISTS ${t.kv} (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS ${t.attempts} (ip_key TEXT NOT NULL, win INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ip_key, win))`,
      `CREATE TABLE IF NOT EXISTS ${t.log} (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, detail TEXT)`,
    ].map((sql) => env.DB.prepare(sql.replace(/\s+/g, ' ')));
    const p = env.DB.batch(stmts).catch((e) => { schemaReady.delete(t.prefix); throw e; });
    schemaReady.set(t.prefix, p);
  }
  return schemaReady.get(t.prefix);
}

export async function kvGet(env, k) {
  const t = tables(env);
  const row = await env.DB.prepare(`SELECT v FROM ${t.kv} WHERE k = ?1`).bind(k).first();
  return row ? row.v : null;
}

export async function kvPut(env, k, v) {
  const t = tables(env);
  await env.DB.prepare(
    `INSERT INTO ${t.kv} (k, v, updated) VALUES (?1, ?2, ?3)
     ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated = excluded.updated`).bind(k, v, Date.now()).run();
}

export async function kvDelete(env, k) {
  const t = tables(env);
  await env.DB.prepare(`DELETE FROM ${t.kv} WHERE k = ?1`).bind(k).run();
}

/** Returns the stored value, creating it once if it is missing. Safe when two instances start at the same moment: the first insert wins. */
export async function kvInit(env, k, make) {
  const have = await kvGet(env, k);
  if (have !== null) return have;
  const t = tables(env);
  const fresh = await make();
  await env.DB.prepare(`INSERT OR IGNORE INTO ${t.kv} (k, v, updated) VALUES (?1, ?2, ?3)`).bind(k, fresh, Date.now()).run();
  return kvGet(env, k);
}

/** Reads a value and removes it in one statement (one use only, even when two requests arrive together). */
export async function kvTake(env, k) {
  const t = tables(env);
  const row = await env.DB.prepare(`DELETE FROM ${t.kv} WHERE k = ?1 RETURNING v`).bind(k).first();
  return row ? row.v : null;
}

// Counters per time window, kept in the "attempts" table: per visitor (a keyed code of the address, never the address)
// and a few overall ones ("g:…"). One statement adds and returns the new count, so simultaneous requests cannot slip past a limit.
export async function counterBump(env, key, win) {
  const t = tables(env);
  const row = await env.DB.prepare(
    `INSERT INTO ${t.attempts} (ip_key, win, n) VALUES (?1, ?2, 1)
     ON CONFLICT(ip_key, win) DO UPDATE SET n = n + 1 RETURNING n`).bind(key, win).first();
  return row ? row.n : 1;
}

export async function counterGet(env, key, win) {
  const t = tables(env);
  const row = await env.DB.prepare(`SELECT n FROM ${t.attempts} WHERE ip_key = ?1 AND win = ?2`).bind(key, win).first();
  return row ? row.n : 0;
}

const keyCache = new Map(); // prefix -> { hashKey: Uint8Array, signing: {...} }

function cacheFor(env) {
  const p = tables(env).prefix;
  if (!keyCache.has(p)) keyCache.set(p, {});
  return keyCache.get(p);
}

/** HASH_KEY: 32 random bytes made by the service itself on first use and kept in D1. Nobody types it in. */
export async function getHashKey(env) {
  const c = cacheFor(env);
  if (!c.hashKey) {
    const v = await kvInit(env, 'hash_key', async () => {
      const b = new Uint8Array(32);
      crypto.getRandomValues(b);
      return b64url(b);
    });
    c.hashKey = unb64url(v);
  }
  return c.hashKey;
}

/** The key pair that signs invitation links: made by the service itself on first use and kept in D1. */
export async function getSigningKey(env) {
  const c = cacheFor(env);
  if (!c.signing) {
    const v = await kvInit(env, 'sign_key_1', async () => JSON.stringify(await generateSigningKey()));
    const stored = JSON.parse(v);
    c.signing = { kid: stored.kid, pub: stored.pub, created: stored.created, privateKey: await importSigningKey(stored) };
  }
  return c.signing;
}

/** A short note for the owner (read in the D1 console). Never put an order number or an IP address in here. */
export async function logEvent(env, kind, detail) {
  try {
    const t = tables(env);
    await env.DB.prepare(`INSERT INTO ${t.log} (at, kind, detail) VALUES (?1, ?2, ?3)`)
      .bind(Date.now(), String(kind).slice(0, 40), detail == null ? null : String(detail).slice(0, 300)).run();
  } catch (e) {
    console.log('log failed', kind, e && e.message);
  }
}

/**
 * Daily tidy-up (Cloudflare cron, see wrangler.jsonc; also started by ordinary traffic at most once a day).
 * It never calls Etsy and never touches a link record.
 * - visitor counters of earlier hours are deleted (we do not keep them);
 * - an order number that could not be checked for 7 days is no longer kept, not even sealed;
 * - sign-in states that were never used are deleted;
 * - the owner's event notes are kept for 180 days.
 */
export async function housekeeping(env) {
  const t = tables(env);
  const now = Date.now();
  const hour = Math.floor(now / 3600000);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM ${t.attempts} WHERE ip_key NOT LIKE 'g:%' AND win < ?1`).bind(hour - 1),
    env.DB.prepare(`DELETE FROM ${t.attempts} WHERE ip_key LIKE 'g:%' AND ip_key NOT LIKE 'g:etsy:%' AND win < ?1`).bind(hour - 48),
    env.DB.prepare(`DELETE FROM ${t.attempts} WHERE ip_key = 'g:etsy:min' AND win < ?1`).bind(Math.floor(now / 60000) - 1440),
    env.DB.prepare(`DELETE FROM ${t.attempts} WHERE ip_key = 'g:etsy:day' AND win < ?1`).bind(Math.floor(now / 86400000) - 30),
    env.DB.prepare(`UPDATE ${t.orders} SET sealed_order = NULL, status = 'unchecked' WHERE status = 'pending' AND created < ?1`).bind(now - 7 * 86400000),
    env.DB.prepare(`DELETE FROM ${t.orders} WHERE status IN ('rejected', 'unpaid') AND checked_at < ?1`).bind(now - 86400000),
    env.DB.prepare(`DELETE FROM ${t.kv} WHERE k LIKE 'oauth_state:%' AND updated < ?1`).bind(now - 3600000),
    env.DB.prepare(`DELETE FROM ${t.log} WHERE at < ?1`).bind(now - 180 * 86400000),
  ]);
}
