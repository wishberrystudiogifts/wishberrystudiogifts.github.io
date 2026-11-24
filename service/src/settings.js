// Settings: service/config.json, optionally adjusted by the CONFIG_OVERRIDES variable (tests only).
import base from '../config.json';

function merge(a, b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b === undefined ? a : b;
  const out = a && typeof a === 'object' && !Array.isArray(a) ? { ...a } : {};
  for (const k of Object.keys(b)) out[k] = merge(out[k], b[k]);
  return out;
}

const cache = new Map();

/** The settings in force. CONFIG_OVERRIDES is a Worker variable (never request data); the live service does not set it. */
export function settings(env) {
  const ov = env.CONFIG_OVERRIDES || '';
  if (!cache.has(ov)) {
    let cfg = base;
    if (ov) {
      try { cfg = merge(base, typeof ov === 'string' ? JSON.parse(ov) : ov); } catch (e) { console.log('CONFIG_OVERRIDES ignored:', e.message); }
    }
    cache.set(ov, cfg);
  }
  return cache.get(ov);
}

export function isMockMode(env) {
  return String(env.VERIFIER || '').toLowerCase() === 'mock';
}

/** A product entry, or null. Keys that start with "_" are notes/examples. */
export function productOf(cfg, key) {
  if (typeof key !== 'string' || !key || key[0] === '_') return null;
  const p = cfg.products && Object.prototype.hasOwnProperty.call(cfg.products, key) ? cfg.products[key] : null;
  return p && typeof p === 'object' ? p : null;
}

export function productKeys(cfg) {
  return Object.keys(cfg.products || {}).filter((k) => k[0] !== '_' && productOf(cfg, k));
}

/** Limits for a product: the product's own numbers, else the defaults. */
export function limitsFor(cfg, key) {
  const d = cfg.defaults || {};
  const p = productOf(cfg, key) || {};
  const pick = (name, fallback) => (p[name] !== undefined ? p[name] : d[name] !== undefined ? d[name] : fallback);
  const ttlHours = Number(pick('ttlHours', 24));
  const maxOpens = Math.floor(Number(pick('maxOpens', 300)));
  const maxSigns = Math.floor(Number(pick('maxSigns', 0)));
  return {
    ttlMs: Math.max(1000, Math.round((Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 24) * 3600000)),
    maxOpens: Number.isFinite(maxOpens) && maxOpens > 0 ? maxOpens : 300,
    maxSigns: Number.isFinite(maxSigns) && maxSigns > 0 ? maxSigns : 0,
    ttlStartsAt: pick('ttlStartsAt', 'firstOpen') === 'created' ? 'created' : 'firstOpen',
    sign: pick('signInvitations', true) !== false,
  };
}

/** CORS: only our site, and localhost for tests. */
export function isAllowedOrigin(cfg, origin) {
  if (!origin) return false;
  if ((cfg.allowedOrigins || []).includes(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin);
}
