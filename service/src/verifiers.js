// Order verifiers. Both answer the same question — "is this order number a paid order of ours, and what is in it?" —
// with { result: 'ok', listingIds? , products? } | { result: 'not_found' } | { result: 'not_paid' } | { result: 'busy' } | { result: 'error', reason }.
import { verifyReceipt } from './etsy.js';
import { settings, isMockMode, productOf } from './settings.js';

/**
 * Test orders from config.json → mock (single numbers in "orders", whole runs of numbers in "ranges"). Never talks to Etsy.
 * On the live service a test order can do exactly one thing: unlock a product marked lab:true. Everything else it might
 * say ("error", an unknown status, a real product) is answered as "no such order" there.
 */
export class MockVerifier {
  constructor(env) { this.env = env; this.cfg = settings(env); this.name = 'mock'; }

  find(order) {
    const m = this.cfg.mock || {};
    if (m.orders && Object.prototype.hasOwnProperty.call(m.orders, order)) return m.orders[order] || {};
    if (Array.isArray(m.ranges) && /^\d{1,15}$/.test(order)) {
      const n = Number(order);
      for (const r of m.ranges) {
        if (r && Number.isSafeInteger(r.from) && Number.isSafeInteger(r.to) && n >= r.from && n <= r.to) return r;
      }
    }
    return null;
  }

  has(order) { return this.find(order) !== null; }

  async verify(order) {
    const o = this.find(order);
    if (!o) return { result: 'not_found' };
    const mockAll = isMockMode(this.env);
    const status = String(o.status || 'paid');
    if (status === 'unpaid') return mockAll ? { result: 'not_paid' } : { result: 'not_found' };
    if (status === 'error') return mockAll ? { result: 'error', reason: 'mock_error' } : { result: 'not_found' };
    if (status === 'busy') return mockAll ? { result: 'busy' } : { result: 'not_found' };
    if (status !== 'paid') return { result: 'not_found' };
    const products = (Array.isArray(o.products) ? o.products : []).filter((k) => {
      const p = productOf(this.cfg, k);
      return p && (mockAll || p.lab === true);
    });
    if (!products.length) return { result: 'not_found' };
    return { result: 'ok', products };
  }
}

/** The real thing: one read of one receipt through the official Etsy Open API v3. */
export class EtsyVerifier {
  constructor(env) { this.env = env; this.name = 'etsy'; }
  async verify(order) { return verifyReceipt(this.env, order); }
}

/** Test orders go to the MockVerifier; everything else to Etsy — unless VERIFIER=mock, where Etsy is never called. */
export function verifierFor(env, order) {
  const mock = new MockVerifier(env);
  if (mock.has(order) || isMockMode(env)) return mock;
  return new EtsyVerifier(env);
}
