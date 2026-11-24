// D1 access: table names, schema that creates itself, tiny key-value store, event log.
import { b64url, unb64url, generateSigningKey, importSigningKey } from './crypto.js';

/** Table names. Previews set TABLE_PREFIX (for example "pv_") so that they never touch the live tables. */
export function tables(env) {
  const raw = String(env.TABLE_PREFIX || '').toLowerCase();
  const p = /^[a-z][a-z0-9_]{0,15}$/.test(raw) ? raw : '';
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
