// API tests of the product link service. Everything runs locally: `wrangler dev --local` with an empty database
// and a stand-in for the Etsy API. Nothing here touches Cloudflare or Etsy.
//   node service/test/api.test.mjs
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { startService, startFakeEtsy, connectShop, call, check, section, summary, sleep, findSqlite } from './helpers.mjs';

const subtle = webcrypto.subtle;
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const HASH_RE = /^[A-Za-z0-9_-]{22}$/;

async function digestOf(m) { return b64u(await subtle.digest('SHA-256', new TextEncoder().encode(m))); }
async function verifySig(pub, product, m, s) {
  const key = await subtle.importKey('raw', Buffer.from(pub, 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(s, 'base64url'), new TextEncoder().encode('wb1|' + product + '|' + (await digestOf(m))));
}
function sql(file, query) {
  const out = execFileSync('python3', ['-c', 'import sqlite3,sys,json\nc=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row\nprint(json.dumps([dict(r) for r in c.execute(sys.argv[2])]))', file, query], { encoding: 'utf8' });
  return JSON.parse(out);
}
/** Looks for a text in every file of the local D1 database (not in wrangler's own local request traces). */
function rawContains(stateDir, needle) {
  const dir = stateDir + '/v3/d1';
  let found = false;
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = d + '/' + f.name; if (f.isDirectory()) walk(p); else if (fs.readFileSync(p).includes(needle)) found = true; } })(dir);
  return found;
}

const OVERRIDES_A = {
  products: {
    't-open3': { name: 't', maxOpens: 3 },
    't-ttl': { name: 't', ttlHours: 0.0006 },
    't-conc': { name: 't', maxOpens: 5 },
    't-created': { name: 't', ttlStartsAt: 'created', ttlHours: 0.0006 },
    't-signs': { name: 't', maxSigns: 2 },
  },
  mock: { orders: {
    2000000001: { status: 'paid', products: ['t-open3'] },
    2000000002: { status: 'paid', products: ['t-ttl'] },
    2000000003: { status: 'paid', products: ['t-conc'] },
    2000000004: { status: 'paid', products: ['t-created'] },
    2000000005: { status: 'paid', products: ['t-signs'] },
    2000000006: { status: 'paid', products: ['t-open3', 't-ttl'] },
    2000000500: { status: 'error' },
    2000000501: { status: 'error' },
  } },
  activation: { maxAttemptsPerHour: 10, negativeCacheMinutes: 15, recheckMinutes: 0, maxRechecks: 3 },
};

async function partA() {
  section('A. mock mode — hashes, limits, signatures, rate limit, CORS');
  const svc = await startService({ port: 8791, vars: { VERIFIER: 'mock', STAGE: 'test', CONFIG_OVERRIDES: OVERRIDES_A } });
  const S = svc.url;
  const act = (order, product, ip) => call(S, 'POST', '/api/activate', { order, product }, ip ? { 'X-Test-IP': ip } : {});
  const open = (h) => call(S, 'POST', '/api/open/' + h);
  try {
    // (a) same order -> same hash and the same counter; invalid -> error
    const a1 = await act('2000000001', 't-open3', 'a');
    const a2 = await act('#2000 000 001', 't-open3', 'a');
    const h1 = a1.body.links[0].hash;
    check('(a) activation gives a 22-character hash', a1.status === 200 && HASH_RE.test(h1), a1.body);
    check('(a) the same order number gives the same hash (also typed with # and spaces)', a2.body.links[0].hash === h1);
    const lab = await act('1000000001', 'lab-party-1', 'a');
    check('(a) another order -> another hash', lab.status === 200 && lab.body.links[0].hash !== h1);
    const two = await act('2000000006', 't-open3', 'a');
    check('(a) one order with two products -> two different hashes, one per product', two.body.links.length === 2 && two.body.links[0].hash !== two.body.links[1].hash && two.body.links.every((l) => HASH_RE.test(l.hash)));
    check('(a) unknown order -> 404 not_found', (await act('2999999999', 't-open3', 'a')).status === 404);
    check('(a) "no such order" test number -> 404 with the same message', (await act('1000000404', 'lab-party-1', 'a')).body.error === 'not_found');
    check('(a) not a number -> 400 bad_order', (await act('hello', 't-open3', 'a')).status === 400);
    check('(a) unpaid order -> 409 not_paid', (await act('1000000402', 'lab-party-1', 'a')).status === 409);

    // (b) maxOpens 3 -> the fourth opening is refused; firstOpen / lastOpen are written
    const o1 = await open(h1); await sleep(15);
    const o2 = await open(h1); await sleep(15);
    const o3 = await open(h1);
    const o4 = await open(h1);
    check('(b) openings 1-3 succeed and are counted 1, 2, 3', [o1, o2, o3].every((o) => o.status === 200) && o1.body.opens === 1 && o2.body.opens === 2 && o3.body.opens === 3, [o1.body, o3.body]);
    check('(b) the fourth opening is refused: 410, reason "opens"', o4.status === 410 && o4.body.reason === 'opens', o4.body);
    check('(b) firstOpen stays, lastOpen moves', o3.body.firstOpen === o1.body.firstOpen && o3.body.lastOpen > o1.body.lastOpen);
    check('(b) deadline = first opening + 24 h', o1.body.expires - o1.body.firstOpen === 24 * 3600000);
    const a3 = await act('2000000001', 't-open3', 'a');
    check('(a) activating again changes nothing: same hash, counter not reset', a3.body.links[0].hash === h1 && (await open(h1)).status === 410);

    // (c) short deadline -> expires; a new activation does NOT bring it back
    const t = await act('2000000002', 't-ttl', 'c');
    const ht = t.body.links[0].hash;
    const ot = await open(ht);
    check('(c) short deadline: first opening works', ot.status === 200 && ot.body.expires - ot.body.firstOpen < 3000, ot.body);
    await sleep(2600);
    const ot2 = await open(ht);
    check('(c) after the deadline: 410, reason "time"', ot2.status === 410 && ot2.body.reason === 'time', ot2.body);
    const t2 = await act('2000000002', 't-ttl', 'c');
    check('(c) activating again gives the same hash and NO new deadline', t2.body.links[0].hash === ht && (await open(ht)).status === 410);
    const sgExpired = await call(S, 'POST', '/api/sign', { hash: ht, d: await digestOf('x') });
    check('(c) an expired product link cannot sign new invitation links (410)', sgExpired.status === 410, sgExpired.body);
    // the clock starts at the first opening, not at activation
    const idle = await act('2000000006', 't-ttl', 'c');
    const hIdle = idle.body.links.find((l) => l.product === 't-ttl').hash;
    await sleep(2600);
    check('(c) a link that was never opened does not expire while it waits (clock starts at first opening)', (await open(hIdle)).status === 200);
    // ttlStartsAt: "created"
    const cr = await act('2000000004', 't-created', 'c');
    await sleep(2600);
    check('(c) setting ttlStartsAt "created": the clock starts at activation', (await open(cr.body.links[0].hash)).status === 410);

    // (e) signatures
    const pub = (await call(S, 'GET', '/api/pubkey')).body.keys[0].key;
    const hl = lab.body.links[0].hash;
    const m = 'eyJ0IjoiQ2hyaXN0bWFzIFBhcnR5In0';
    const early = await call(S, 'POST', '/api/sign', { hash: hl, d: await digestOf(m) });
    check('(e) a link that was never opened cannot sign (409)', early.status === 409, early.body);
    await open(hl);
    const sg = await call(S, 'POST', '/api/sign', { hash: hl, d: await digestOf(m) });
    check('(e) signature is issued for an open product link', sg.status === 200 && /^[A-Za-z0-9_-]{86}$/.test(sg.body.s), sg.body);
    check('(e) signature verifies with the public key', await verifySig(pub, 'lab-party-1', m, sg.body.s));
    check('(e) changed data -> signature does not verify', !(await verifySig(pub, 'lab-party-1', m + 'A', sg.body.s)));
    check('(e) the same signature does not fit another product', !(await verifySig(pub, 't-open3', m, sg.body.s)));
    check('(e) sign with an unknown hash -> 404', (await call(S, 'POST', '/api/sign', { hash: 'AAAAAAAAAAAAAAAAAAAAAA', d: await digestOf(m) })).status === 404);
    check('(e) sign refuses anything that is not a SHA-256 digest (the text itself is never accepted)', (await call(S, 'POST', '/api/sign', { hash: hl, d: m })).status === 400);
    const openedBefore = (await open(hl)).body.opens;
    await call(S, 'POST', '/api/sign', { hash: hl, d: await digestOf('again') });
    check('(e) signing is not counted as an opening', (await open(hl)).body.opens === openedBefore + 1);
    const sl = await act('2000000005', 't-signs', 'e'); const hs = sl.body.links[0].hash; await open(hs);
    const s1 = await call(S, 'POST', '/api/sign', { hash: hs, d: await digestOf('1') });
    const s2 = await call(S, 'POST', '/api/sign', { hash: hs, d: await digestOf('2') });
    const s3 = await call(S, 'POST', '/api/sign', { hash: hs, d: await digestOf('3') });
    check('(e) optional setting maxSigns: third signature refused (429)', s1.status === 200 && s2.status === 200 && s3.status === 429, s3.body);

    // simultaneous openings
    const c = await act('2000000003', 't-conc', 'x');
    const hc = c.body.links[0].hash;
    const burst = await Promise.all(Array.from({ length: 25 }, () => open(hc)));
    const okCount = burst.filter((r) => r.status === 200).length;
    check('25 simultaneous openings with a limit of 5 -> exactly 5 succeed', okCount === 5 && burst.filter((r) => r.status === 410).length === 20, okCount);
    check('counter after the burst is exactly 5', new Set(burst.filter((r) => r.status === 200).map((r) => r.body.opens)).size === 5);

    // guessing a hash
    check('(f) guessed hash -> 404', (await open('abcdefghijklmnopqrstuv')).status === 404);
    check('(f) malformed hash -> 404', (await open('short')).status === 404);

    // rate limit per visitor
    let last = null;
    for (let i = 0; i < 10; i++) last = await act('29000000' + String(10 + i), 't-open3', 'guesser');
    const eleventh = await act('2900000099', 't-open3', 'guesser');
    check('ten wrong order numbers pass through (404), the eleventh is stopped (429)', last.status === 404 && eleventh.status === 429, [last.status, eleventh.status]);
    check('another visitor is not affected', (await act('2900000098', 't-open3', 'someone-else')).status === 404);
    let allOk = true;
    for (let i = 0; i < 14; i++) if ((await act('2000000001', 't-open3', 'returning-buyer')).status !== 200) allOk = false;
    check('a buyer who re-enters a confirmed order number is never rate-limited', allOk);

    // unchecked ("soft") entry when the verifier cannot answer
    const soft = await act('2000000500', 'lab-party-1', 's');
    check('verifier cannot answer -> the buyer is let in (verified:false)', soft.status === 200 && soft.body.verified === false && soft.body.links.length === 1, soft.body);
    check('the unchecked link opens', (await open(soft.body.links[0].hash)).status === 200);
    check('verifier cannot answer and the page named no product -> 503, no link', (await call(S, 'POST', '/api/activate', { order: '2000000501' }, { 'X-Test-IP': 's2' })).status === 503);

    // CORS and origin
    const bad = await call(S, 'POST', '/api/open/' + hl, null, { Origin: 'https://evil.example' });
    check('a browser on another site is refused (403)', bad.status === 403 && !bad.headers.get('access-control-allow-origin'));
    const good = await call(S, 'POST', '/api/open/' + hl, null, { Origin: 'https://wishberrystudiogifts.github.io' });
    check('our site is allowed (CORS header echoes it)', good.status === 200 && good.headers.get('access-control-allow-origin') === 'https://wishberrystudiogifts.github.io');
    const loc = await call(S, 'POST', '/api/open/' + hl, null, { Origin: 'http://localhost:8080' });
    check('localhost is allowed for tests', loc.headers.get('access-control-allow-origin') === 'http://localhost:8080');
    const pre = await fetch(S + '/api/activate', { method: 'OPTIONS', headers: { Origin: 'https://wishberrystudiogifts.github.io', 'Access-Control-Request-Method': 'POST' } });
    check('preflight answered', pre.status === 204 && pre.headers.get('access-control-allow-methods').includes('POST'));
    check('unknown endpoint -> 404 JSON', (await call(S, 'GET', '/api/nothing')).status === 404);
    check('GET on a POST endpoint does nothing', (await call(S, 'GET', '/api/open/' + hl)).status === 404);
    check('a huge body is refused', (await call(S, 'POST', '/api/activate', { order: '1'.repeat(20000) })).status === 400);

    // what is really stored
    const dbFile = findSqlite(svc.dir)[0];
    const links = sql(dbFile, 'SELECT * FROM links');
    const orders = sql(dbFile, 'SELECT * FROM orders');
    const row = links.find((l) => l.hash === h1);
    check('(2) record per hash: product, created, first_open, last_open, opens, max_opens, expires', row && row.product === 't-open3' && row.opens === 3 && row.max_opens === 3 && row.first_open > 0 && row.last_open >= row.first_open && row.expires > row.first_open && row.created > 0, row);
    check('(H) no order number is stored in plain text anywhere in the database files', !['2000000001', '2000000002', '2000000500', '1000000001', '2900000099'].some((n) => rawContains(svc.dir, n)));
    check('(H) no visitor address is stored in plain text', !rawContains(svc.dir, 'guesser') && !rawContains(svc.dir, 'returning-buyer'));
    check('(H) an unchecked order is kept sealed, a confirmed one is not kept at all', orders.some((o) => o.status === 'pending' && o.sealed_order) && orders.filter((o) => o.status === 'ok').every((o) => o.sealed_order === null));
    check('(H) the database holds no invitation text', !rawContains(svc.dir, 'eyJ0IjoiQ2hyaXN0bWFzIFBhcnR5In0'));
    const st = await call(S, 'GET', '/api/status');
    check('status endpoint answers without secrets', st.status === 200 && st.body.verifier === 'mock' && !JSON.stringify(st.body).includes('hash_key'));

    // preview isolation: same database, TABLE_PREFIX -> own tables
    await svc.stop();
    const pv = await startService({ port: 8792, persist: svc.dir, vars: { VERIFIER: 'mock', STAGE: 'preview', TABLE_PREFIX: 'pv_', CONFIG_OVERRIDES: OVERRIDES_A } });
    try {
      const stp = await call(pv.url, 'GET', '/api/status');
      check('preview: uses its own tables (prefix pv_)', stp.body.tables === 'pv_' && stp.body.stage === 'preview');
      check('preview: a live hash is unknown there', (await call(pv.url, 'POST', '/api/open/' + hl)).status === 404);
      const pk = (await call(pv.url, 'GET', '/api/pubkey')).body.keys[0].key;
      check('preview: has its own signing key', pk !== pub);
      const pa = await call(pv.url, 'POST', '/api/activate', { order: '1000000001', product: 'lab-party-1' });
      check('preview: the same order gives a different hash (own HASH_KEY)', pa.status === 200 && pa.body.links[0].hash !== lab.body.links[0].hash);
      const liveRows = sql(dbFile, 'SELECT COUNT(*) AS n FROM links')[0].n;
      check('preview: the live tables are untouched', liveRows === links.length);
    } finally { await pv.stop(); }
  } finally { await svc.stop(); }
}

const OVERRIDES_B = {
  products: { 'card-a': { name: 'Card A', listingIds: [555001] }, 'card-b': { name: 'Card B', listingIds: [] } },
  mock: { orders: { 2000000099: { status: 'paid', products: ['card-a', 'lab-party-1'] } } },
  activation: { maxAttemptsPerHour: 500, negativeCacheMinutes: 15, recheckMinutes: 0, maxRechecks: 3 },
};

async function partB() {
  section('B. live-like mode — the Etsy path against a local stand-in (NOT the real Etsy API)');
  const fake = await startFakeEtsy({ port: 8793 });
  const svc = await startService({ port: 8794, vars: { ...fake.vars, VERIFIER: 'etsy', STAGE: 'test-live', CONFIG_OVERRIDES: OVERRIDES_B } }); // VERIFIER set explicitly: a local .dev.vars may say "mock"
  const S = svc.url, F = fake.state;
  const act = (order, product) => call(S, 'POST', '/api/activate', { order, product });
  const open = (h) => call(S, 'POST', '/api/open/' + h);
  const n = (k) => F.counts[k] || 0;
  try {
    let st = (await call(S, 'GET', '/api/status')).body;
    check('before connecting: API key present, shop not connected', st.etsy.apiKey === true && st.etsy.connected === false && st.verifier === 'etsy');

    // not connected -> our side cannot check -> buyer is let in, nothing is sent to Etsy
    F.receipts = { 3000000002: { listings: [555001] }, 3000000003: { listings: [999] }, 3000000004: { status: 'open', is_paid: false, listings: [555001] }, 3000000005: { status: 'canceled', is_paid: false, listings: [555001] }, 3000000006: { listings: [555001] }, 3000000007: { listings: [555001] } };
    const pre = await act('3000000001', 'card-a');
    check('shop not connected yet -> buyer let in unchecked, no request to Etsy', pre.status === 200 && pre.body.verified === false && n('receipt') === 0, pre.body);
    const preLab = await act('3000000001', 'lab-party-1');
    check('a lab product is never let in unchecked by a non-test number', !preLab.body.links || !preLab.body.links.some((l) => l.product === 'lab-party-1'), preLab.body);

    // test order on the live service unlocks only the lab product
    const tl = await act('2000000099', 'card-a');
    check('live service: a TEST order unlocks only a lab product, never a real one', tl.status === 200 && tl.body.links.length === 1 && tl.body.links[0].product === 'lab-party-1', tl.body);

    // connect: another shop is refused
    F.shopName = 'SomebodyElsesShop';
    const wrong = await connectShop(S);
    check('connect: another shop is refused and nothing is saved', wrong.status === 400 && /nije naša radnja/.test(wrong.text) && (await call(S, 'GET', '/api/status')).body.etsy.connected === false, wrong.text.slice(0, 200));
    F.deny = true; F.shopName = 'WishberrystudioGifts';
    const denied = await connectShop(S);
    check('connect: owner taps "Deny" -> clear message, not connected', denied.status === 400 && /nije odobreno/.test(denied.text));
    F.deny = false;
    const ok = await connectShop(S);
    const au = new URL(ok.authorizeUrl);
    check('connect: authorize request has code + PKCE S256 + state + scope transactions_r', au.searchParams.get('response_type') === 'code' && au.searchParams.get('code_challenge_method') === 'S256' && au.searchParams.get('scope') === 'transactions_r' && au.searchParams.get('state').length >= 16 && au.searchParams.get('code_challenge').length === 43);
    check('connect: callback address is <service>/etsy/callback', au.searchParams.get('redirect_uri') === S + '/etsy/callback');
    check('connect: our shop -> connected', ok.status === 200 && /Povezano/.test(ok.text), ok.text.slice(0, 200));
    st = (await call(S, 'GET', '/api/status')).body;
    check('status shows the connected shop', st.etsy.connected === true && st.etsy.shop === 'WishberrystudioGifts');
    const again = await fetch(S + '/etsy/connect', { redirect: 'manual' });
    check('connect: already connected -> nobody else can connect over it', again.status === 200 && /već povezana/.test(await again.text()));
    const replay = await fetch(ok.callbackUrl, { redirect: 'manual' });
    check('connect: the callback address cannot be used twice', replay.status === 400);
    const forged = await fetch(S + '/etsy/callback?code=x&state=' + 'A'.repeat(32), { redirect: 'manual' });
    check('connect: a made-up callback is refused', forged.status === 400);
    check('x-api-key was accepted by the stand-in (format keystring:secret)', n('bad_key') === 0 && n('token_code') >= 1);

    // one receipt request per activation; the answer is kept
    const r0 = n('receipt');
    const p1 = await act('3000000002', 'card-a');
    check('paid order with our listing -> product link (verified)', p1.status === 200 && p1.body.verified === true && p1.body.links[0].product === 'card-a', p1.body);
    check('exactly ONE request to Etsy for this activation', n('receipt') - r0 === 1 && n('receipt:3000000002') === 1, F.counts);
    const p2 = await act('3000000002', 'card-a');
    check('same order again -> same hash, ZERO new requests to Etsy', p2.body.links[0].hash === p1.body.links[0].hash && n('receipt:3000000002') === 1);

    const q1 = await act('3000000003', 'card-a');
    check('paid order WITHOUT our new product -> 404, same message as "no such order"', q1.status === 404 && q1.body.error === 'not_found');
    const q2 = await act('3000000003', 'card-b');
    check('launch grace: product without a listing ID yet is unlocked by any paid order of our shop — and Etsy is not asked again', q2.status === 200 && q2.body.links[0].product === 'card-b' && n('receipt:3000000003') === 1, q2.body);

    const nf1 = await act('3000000999', 'card-a');
    const nf2 = await act('3000000999', 'card-a');
    check('no such order -> 404; asked again right away -> answered from memory (one request in total)', nf1.status === 404 && nf2.status === 404 && n('receipt:3000000999') === 1);

    const np = await act('3000000004', 'card-a');
    check('order not paid yet -> 409 not_paid', np.status === 409);
    F.receipts[3000000004] = { status: 'paid', is_paid: true, listings: [555001] };
    check('...and after the payment went through -> product link', (await act('3000000004', 'card-a')).status === 200);
    check('canceled order -> 404', (await act('3000000005', 'card-a')).status === 404);

    // Etsy answers 500 twice -> one retry -> buyer let in -> checked later on the next opening
    F.fail.server = 2;
    const sp = await act('3000000006', 'card-a');
    check('Etsy error -> exactly one retry (2 requests), buyer let in unchecked', sp.status === 200 && sp.body.verified === false && n('receipt:3000000006') === 2, [sp.body, F.counts]);
    const hsp = sp.body.links[0].hash;
    check('unchecked link opens', (await open(hsp)).status === 200);
    await sleep(900); // the later check runs after the answer was sent
    const db = findSqlite(svc.dir)[0];
    const sqlq = (q) => JSON.parse(execFileSync('python3', ['-c', 'import sqlite3,sys,json\nc=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row\nprint(json.dumps([dict(r) for r in c.execute(sys.argv[2])]))', db, q], { encoding: 'utf8' }));
    let lrow = sqlq("SELECT verified, revoked, order_key FROM links WHERE hash = '" + hsp + "'")[0];
    check('checked later: Etsy confirmed -> link marked verified, stays open', lrow.verified === 1 && lrow.revoked === 0 && (await open(hsp)).status === 200, lrow);
    check('checked later: the sealed order number is deleted once confirmed', sqlq("SELECT sealed_order, status FROM orders WHERE order_key = '" + lrow.order_key + "'")[0].sealed_order === null);

    // the order that was let in before the shop was connected does not exist -> withdrawn at the later check
    const hpre = pre.body.links[0].hash;
    check('order let in before connecting: first opening still works', (await open(hpre)).status === 200);
    await sleep(900);
    const gone = await open(hpre);
    check('...Etsy then says "no such order" -> the link is withdrawn (410)', gone.status === 410 && gone.body.reason === 'withdrawn', gone.body);

    // access token refused once -> one refresh, then the receipt
    const tr0 = n('token_refresh');
    F.fail.unauthorized = 1;
    const rf = await act('3000000007', 'card-a');
    check('token refused -> refreshed once and the order is confirmed', rf.status === 200 && rf.body.verified === true && n('token_refresh') - tr0 === 1, [rf.body, F.counts]);
    const tr1 = n('token_refresh');
    await act('3000000002', 'card-a');
    check('no token refresh when nothing needs Etsy', n('token_refresh') === tr1);

    // refresh token dead -> owner must connect again; buyers are still let in
    F.refreshInvalid = true; F.fail.unauthorized = 1;
    F.receipts[3000000008] = { listings: [555001] };
    const dead = await act('3000000008', 'card-a');
    st = (await call(S, 'GET', '/api/status')).body;
    check('refresh token no longer valid -> buyer let in, status says "reconnect needed"', dead.status === 200 && dead.body.verified === false && st.etsy.reconnectNeeded === true && st.etsy.connected === false, [dead.body, st.etsy]);
    F.refreshInvalid = false;
    const re = await connectShop(S);
    check('owner connects again -> connected', re.status === 200 && (await call(S, 'GET', '/api/status')).body.etsy.connected === true);

    check('database holds no order number in plain text (live-like run)', !['3000000001', '3000000002', '3000000006', '3000000999'].some((x) => rawContains(svc.dir, x)));
    check('tokens are stored in D1 only (kv table)', sqlq("SELECT COUNT(*) AS n FROM kv WHERE k = 'etsy_token'")[0].n === 1);
    console.log('  requests the stand-in saw:', JSON.stringify(F.counts));
  } finally { await svc.stop(); await fake.stop(); }
}

await partA();
await partB();
process.exit(summary() ? 0 : 1);
