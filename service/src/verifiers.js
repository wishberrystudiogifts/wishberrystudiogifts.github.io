// Order verifiers. Both answer the same question — "is this order number a paid order of ours, and what is in it?" —
// with { result: 'ok', listingIds? , products? } | { result: 'not_found' } | { result: 'not_paid' } | { result: 'error', reason }.
import { verifyReceipt } from './etsy.js';
import { settings, isMockMode, productOf } from './settings.js';

/** Test orders from config.json → mock.orders. Never talks to Etsy. */
export class MockVerifier {
  constructor(env) { this.env = env; this.cfg = settings(env); this.name = 'mock'; }

  has(order) {
    const orders = (this.cfg.mock && this.cfg.mock.orders) || {};
    return Object.prototype.hasOwnProperty.call(orders, order);
  }

  async verify(order) {
    if (!this.has(order)) return { result: 'not_found' };
    const o = this.cfg.mock.orders[order] || {};
    const status = String(o.status || 'paid');
    if (status === 'not_found') return { result: 'not_found' };
    if (status === 'unpaid') return { result: 'not_paid' };
    if (status === 'error') return { result: 'error', reason: 'mock_error' };
    // On the live service a test order may only ever unlock a lab product.
    const mockAll = isMockMode(this.env);
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
