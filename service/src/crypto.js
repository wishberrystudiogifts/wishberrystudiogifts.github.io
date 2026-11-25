// Small crypto helpers (WebCrypto only, no dependencies).

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64url(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function randomToken(nBytes = 32) {
  const b = new Uint8Array(nBytes);
  crypto.getRandomValues(b);
  return b64url(b);
}

async function hmacKey(keyBytes) {
  return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hmac(keyBytes, message) {
  const key = await hmacKey(keyBytes);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** The product link hash: first 22 characters of base64url(HMAC-SHA-256(HASH_KEY, product + ":" + receipt_id)). */
export async function linkHash(keyBytes, product, order) {
  return b64url(await hmac(keyBytes, product + ':' + order)).slice(0, 22);
}

/** What we keep instead of the order number itself. */
export async function orderKey(keyBytes, order) {
  return b64url(await hmac(keyBytes, 'order:' + order));
}

/** What we keep instead of the visitor's IP address (rate limit counter only). */
export async function ipKey(keyBytes, ip) {
  return b64url(await hmac(keyBytes, 'ip:' + ip)).slice(0, 22);
}

export async function sha256(input) {
  const bytes = typeof input === 'string' ? enc.encode(input) : input;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

// ---- invitation link signature: ECDSA P-256 / SHA-256, raw 64-byte signature, base64url ----

export async function generateSigningKey() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const kid = b64url(await sha256(pubRaw)).slice(0, 8);
  return { kid, alg: 'ES256', jwk, pub: b64url(pubRaw), created: Date.now() };
}

export async function importSigningKey(stored) {
  return crypto.subtle.importKey('jwk', stored.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/**
 * The exact bytes that are signed: "wb1|<product>|<digest>", where digest = base64url(SHA-256(m)) and m is the exact
 * text after "#m=" in the invitation link. The page computes the digest itself, so the words of the invitation never
 * reach the service. The product key is part of it, so a signature made for one product never fits another.
 */
export function signingInput(product, digest) {
  return enc.encode('wb1|' + product + '|' + digest);
}

export async function signInvitation(privateKey, product, digest) {
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, signingInput(product, digest));
  return b64url(sig);
}

// ---- order number kept encrypted only while its check with Etsy is still pending ----

async function pendingKey(keyBytes) {
  const base = await crypto.subtle.importKey('raw', keyBytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('pending-order-v1') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sealOrder(keyBytes, order) {
  const key = await pendingKey(keyBytes);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(order)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0); out.set(ct, iv.length);
  return b64url(out);
}

export async function openOrder(keyBytes, sealed) {
  const all = unb64url(sealed);
  const key = await pendingKey(keyBytes);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12));
  return dec.decode(pt);
}
