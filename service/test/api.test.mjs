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
const ORIGIN = 'https://wishberrystudiogifts.github.io';

async function digestOf(m) { return b64u(await subtle.digest('SHA-256', new TextEncoder().encode(m))); }
async function verifySig(pub, product, m, s) {
  const key = await subtle.importKey('raw', Buffer.from(pub, 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(s, 'base64url'), new TextEncoder().encode('wb1|' + product + '|' + (await digestOf(m))));
}
const PY = 'import sqlite3,sys,json\nc=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row\nrows=[dict(r) for r in c.execute(sys.argv[2])]\nc.commit()\nprint(json.dumps(rows))';
/** Reads (or, while the service is stopped, changes) the local D1 file. */
function sql(file, query) {
  return JSON.parse(execFileSync('python3', ['-c', PY, file, query], { encoding: 'utf8' }));
}
/** Looks for a text in every file of the local D1 database (not in wrangler's own local request traces). */
function rawContains(stateDir, needle) {
  const dir = stateDir + '/v3/d1';
  let found = false;
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = d + '/' + f.name; if (f.isDirectory()) walk(p); else if (fs.readFileSync(p).includes(needle)) found = true; } })(dir);
  return found;
}
/** The counters work per clock hour / minute: do not start a part a moment before the clock turns. */
async function awayFromClockEdge(unitMs, needMs) {
  const left = unitMs - (Date.now() % unitMs);
  if (left < needMs) { console.log('  (waiting ' + Math.ceil(left / 1000) + ' s for the clock to turn)'); await sleep(left + 300); }
}

const OVERRIDES_A = {
  products: {
    't-open3': { name: 't', maxOpens: 3 },
    't-ttl': { name: 't', ttlHours: 0.0006 },
    't-conc': { name: 't', maxOpens: 5 },
    't-created': { name: 't', ttlStartsAt: 'created', ttlHours: 0.0006 },
    't-signs': { name: 't', maxSigns: 2 },
    't-nosign': { name: 't', signInvitations: false },
    't-plain': { name: 't' },
  },
  mock: {
    ranges: [
      { from: 1000001000, to: 1000001999, status: 'paid', products: ['lab-party-1'] },
      { from: 2100000000, to: 2100000099, status: 'error' },
    ],
    orders: {
      2000000001: { status: 'paid', products: ['t-open3'] },
      2000000002: { status: 'paid', products: ['t-ttl'] },
      2000000003: { status: 'paid', products: ['t-conc'] },
      2000000004: { status: 'paid', products: ['t-created'] },
      2000000005: { status: 'paid', products: ['t-signs'] },
      2000000006: { status: 'paid', products: ['t-open3', 't-ttl'] },
      2000000007: { status: 'paid', products: ['t-nosign'] },
      2000000008: { status: 'paid', products: ['t-plain'] },
      2000000009: { status: 'paid', products: ['t-plain'] },
      2000000500: { status: 'error' },
      2000000501: { status: 'error' },
      2000000503: { status: 'busy' },
      2000000777: { status: 'something-new' },
    },
  },
  activation: { maxAttemptsPerHour: 10, negativeCacheMinutes: 2, retryCheckSeconds: 1, recheckMinutes: 0, maxRechecks: 3, maxUncheckedPerHour: 4, uncheckedMaxSigns: 2 },
};

async function partA() {
  section('A. mock mode — hashes, limits, signatures, rate limit, CORS');
  await awayFromClockEdge(3600000, 150000);
  const svc = await startService({ port: 8791, vars: { VERIFIER: 'mock', STAGE: 'test', CONFIG_OVERRIDES: OVERRIDES_A } });
  const S = svc.url;
  const act = (order, product, ip) => call(S, 'POST', '/api/activate', { order, product }, ip ? { 'X-Test-IP': ip } : {});
  const open = (h) => call(S, 'POST', '/api/open/' + h);
  const sign = async (h, text) => call(S, 'POST', '/api/sign', { hash: h, d: await digestOf(text) });
  try {
    // (a) same order -> same hash and the same counter; invalid -> error
    const a1 = await act('2000000001', 't-open3', 'a');
    const a2 = await act('#2000 000 001', 't-open3', 'a');
    const h1 = a1.body.links[0].hash;
    check('(a) activation gives a 22-character hash', a1.status === 200 && HASH_RE.test(h1), a1.body);
    check('(a) the same order number gives the same hash (also typed with # and spaces)', a2.body.links[0].hash === h1);
    check('(a) leading zeros do not make a second link for the same order', (await act('0002000000001', 't-open3', 'a')).body.links[0].hash === h1);
    check('(a) the number sent as a JSON number gives the same hash', (await act(2000000001, 't-open3', 'a')).body.links[0].hash === h1);
    const lab = await act('1000000001', 'lab-party-1', 'a');
    check('(a) another order -> another hash', lab.status === 200 && lab.body.links[0].hash !== h1);
    const labRange = await act('1000001234', 'lab-party-1', 'a');
    check('(a) LAB: any number 1000001000-1000001999 is a fresh test order with its own link', labRange.status === 200 && labRange.body.links[0].hash !== lab.body.links[0].hash, labRange.body);
    const two = await act('2000000006', 't-open3', 'a');
    check('(a) one order with two products -> two different hashes, one per product', two.body.links.length === 2 && two.body.links[0].hash !== two.body.links[1].hash && two.body.links.every((l) => HASH_RE.test(l.hash)));
    check('(a) unknown order -> 404 not_found', (await act('2999999999', 't-open3', 'a')).status === 404);
    check('(a) "no such order" test number -> 404 with the same message', (await act('1000000404', 'lab-party-1', 'a')).body.error === 'not_found');
    check('(a) not a number -> 400 bad_order', (await act('hello', 't-open3', 'a')).status === 400);
    check('(a) a number that is far too long -> 400 bad_order', (await act('1'.repeat(70), 't-open3', 'a')).status === 400);
    check('(a) unpaid order -> 409 not_paid', (await act('1000000402', 'lab-party-1', 'a')).status === 409);
    check('(a) a test order with a status the service does not know is NOT treated as paid', (await act('2000000777', 't-open3', 'a2')).status === 404);

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
    check('(c) typing the number with leading zeros gives NO new deadline either', (await act('02000000002', 't-ttl', 'c')).body.links[0].hash === ht);
    const sgExpired = await sign(ht, 'x');
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
    const early = await sign(hl, m);
    check('(e) a link that was never opened cannot sign (409)', early.status === 409, early.body);
    await open(hl);
    const sg = await sign(hl, m);
    check('(e) signature is issued for an open product link', sg.status === 200 && /^[A-Za-z0-9_-]{86}$/.test(sg.body.s), sg.body);
    check('(e) signature verifies with the public key', await verifySig(pub, 'lab-party-1', m, sg.body.s));
    check('(e) changed data -> signature does not verify', !(await verifySig(pub, 'lab-party-1', m + 'A', sg.body.s)));
    check('(e) the same signature does not fit another product', !(await verifySig(pub, 't-open3', m, sg.body.s)));
    check('(e) sign with an unknown hash -> 404', (await call(S, 'POST', '/api/sign', { hash: 'AAAAAAAAAAAAAAAAAAAAAA', d: await digestOf(m) })).status === 404);
    check('(e) sign refuses anything that is not a SHA-256 digest (the text itself is never accepted)', (await call(S, 'POST', '/api/sign', { hash: hl, d: m })).status === 400);
    const openedBefore = (await open(hl)).body.opens;
    await sign(hl, 'again');
    check('(e) signing is not counted as an opening', (await open(hl)).body.opens === openedBefore + 1);
    check('(e) default: one product link may sign 100 invitation links', sg.body.maxSigns === 100 && sg.body.signs === 1, sg.body);
    const sl = await act('2000000005', 't-signs', 'e'); const hs = sl.body.links[0].hash; await open(hs);
    const s1 = await sign(hs, '1');
    const s2 = await sign(hs, '2');
    const s3 = await sign(hs, '3');
    check('(e) setting maxSigns 2: the third signature is refused (429 sign_limit)', s1.status === 200 && s2.status === 200 && s3.status === 429 && s3.body.error === 'sign_limit', s3.body);
    const ns = await act('2000000007', 't-nosign', 'e'); await open(ns.body.links[0].hash);
    const nsSig = await sign(ns.body.links[0].hash, 'x');
    check('(e) a product with signInvitations:false gets no signature from the service (409)', nsSig.status === 409 && nsSig.body.error === 'signing_off', nsSig.body);

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
    check('a visitor over the limit learns nothing — not even about a number that is already activated (429, no link)', (await act('2000000001', 't-open3', 'guesser')).status === 429);
    check('another visitor is not affected', (await act('2900000098', 't-open3', 'someone-else')).status === 404);
    let allOk = true;
    for (let i = 0; i < 14; i++) if ((await act('2000000001', 't-open3', 'returning-buyer')).status !== 200) allOk = false;
    check('a buyer who re-enters a confirmed order number is never rate-limited', allOk);
    let all404 = true;
    for (let i = 0; i < 15; i++) if ((await act('2910000001', 't-open3', 'retyper')).status !== 404) all404 = false;
    check('retyping the SAME wrong number 15 times is one counted try, not fifteen', all404 && (await act('2910000002', 't-open3', 'retyper')).status === 404);
    const par = await Promise.all(Array.from({ length: 25 }, (_, i) => act('29200000' + String(10 + i), 't-open3', 'burst-guesser')));
    check('25 simultaneous guesses from one visitor -> exactly 10 are looked at, 15 are stopped', par.filter((r) => r.status === 404).length === 10 && par.filter((r) => r.status === 429).length === 15, par.map((r) => r.status).join(','));
    for (let i = 0; i < 10; i++) await act('29300000' + String(10 + i), 't-open3', '2001:db8:1:2::' + (i + 1).toString(16));
    check('IPv6: ten guesses from ten addresses of the SAME /64 count together — the next address of that /64 is stopped', (await act('2930000099', 't-open3', '2001:db8:1:2:ffff:1:2:3')).status === 429);
    check('IPv6: a different /64 is not affected', (await act('2930000098', 't-open3', '2001:db8:1:3::1')).status === 404);
    for (let i = 0; i < 10; i++) await act('29400000' + String(10 + i), 't-open3', '203.0.113.9');
    check('an IPv4 address written the IPv6 way (::ffff:…) is the same visitor', (await act('2940000099', 't-open3', '::ffff:203.0.113.9')).status === 429);

    // unchecked ("soft") entry when the verifier cannot answer
    const soft = await act('2000000500', 'lab-party-1', 's');
    check('verifier cannot answer -> the buyer is let in (verified:false)', soft.status === 200 && soft.body.verified === false && soft.body.links.length === 1, soft.body);
    const hsoft = soft.body.links[0].hash;
    check('the unchecked link opens', (await open(hsoft)).status === 200);
    const more = await act('2000000500', 't-open3', 's');
    check('an unchecked order cannot collect a second product (503 busy, no link)', more.status === 503 && more.body.error === 'busy' && !more.body.links, more.body);
    check('...and the buyer who comes back with the same number gets the same link', (await act('2000000500', 'lab-party-1', 's')).body.links[0].hash === hsoft);
    const u1 = await sign(hsoft, 'u1'); const u2 = await sign(hsoft, 'u2');
    await sleep(1300);
    const u3 = await sign(hsoft, 'u3');
    check('short outage: an unchecked link may sign only a few invitation links (here 2) until the order is confirmed', u1.status === 200 && u2.status === 200 && u3.status === 429 && u3.body.unchecked === true, [u1.status, u2.status, u3.body]);
    const noHint = await call(S, 'POST', '/api/activate', { order: '2000000501' }, { 'X-Test-IP': 's2' });
    check('verifier cannot answer and the page named no product -> 503, no link', noHint.status === 503 && !noHint.body.links);
    const bz = await act('2000000503', 'lab-party-1', 's3');
    check('"too many requests right now" lets nobody in: 503 busy, no link', bz.status === 503 && bz.body.error === 'busy' && !bz.body.links, bz.body);
    const caps = [];
    for (let i = 0; i < 5; i++) caps.push((await act('21000000' + String(10 + i), 't-plain', 'cap' + i)).status);
    check('overall brake: only so many NEW unchecked orders per hour (here 4: one above + three), then 503', caps.join(',') === '200,200,200,503,503', caps);

    // CORS and origin
    const bad = await call(S, 'POST', '/api/open/' + hl, null, { Origin: 'https://evil.example' });
    check('a browser on another site is refused (403)', bad.status === 403 && !bad.headers.get('access-control-allow-origin'));
    const good = await call(S, 'POST', '/api/open/' + hl, null, { Origin: ORIGIN });
    check('our site is allowed (CORS header echoes it)', good.status === 200 && good.headers.get('access-control-allow-origin') === ORIGIN);
    const loc = await call(S, 'POST', '/api/open/' + hl, null, { Origin: 'http://localhost:8080' });
    check('localhost is allowed for tests', loc.headers.get('access-control-allow-origin') === 'http://localhost:8080');
    const pre = await fetch(S + '/api/activate', { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } });
    check('preflight answered', pre.status === 204 && pre.headers.get('access-control-allow-methods').includes('POST'));
    check('unknown endpoint -> 404 JSON', (await call(S, 'GET', '/api/nothing')).status === 404);
    check('GET on a POST endpoint does nothing', (await call(S, 'GET', '/api/open/' + hl)).status === 404);
    check('a body larger than 4 KB is refused before it is read (413)', (await call(S, 'POST', '/api/activate', { order: '1'.repeat(20000) })).status === 413);
    const big = new ReadableStream({ start(ctl) { for (let i = 0; i < 200; i++) ctl.enqueue(new TextEncoder().encode('x'.repeat(65536))); ctl.close(); } });
    let streamed;
    try { streamed = (await fetch(S + '/api/activate', { method: 'POST', body: big, duplex: 'half', headers: { 'Content-Type': 'text/plain' } })).status; } catch (e) { streamed = 'connection closed'; }
    check('a 13 MB upload without a declared length is cut off, not swallowed', streamed === 413 || streamed === 'connection closed', streamed);

    // what is really stored
    const w1 = await act('2000000008', 't-plain', 'w'); const hw1 = w1.body.links[0].hash; await open(hw1);
    const w2 = await act('2000000009', 't-plain', 'w'); const hw2 = w2.body.links[0].hash; await open(hw2);
    const dbFile = findSqlite(svc.dir)[0];
    const links = sql(dbFile, 'SELECT * FROM links');
    const orders = sql(dbFile, 'SELECT * FROM orders');
    const row = links.find((l) => l.hash === h1);
    check('(2) record per hash: product, created, first_open, last_open, opens, max_opens, expires', row && row.product === 't-open3' && row.opens === 3 && row.max_opens === 3 && row.first_open > 0 && row.last_open >= row.first_open && row.expires > row.first_open && row.created > 0, row);
    check('(H) no order number is stored in plain text anywhere in the database files', !['2000000001', '2000000002', '2000000500', '1000000001', '2900000099', '2100000010'].some((n) => rawContains(svc.dir, n)));
    check('(H) no visitor address is stored in plain text', !['guesser', 'returning-buyer', '2001:db8', '203.0.113.9'].some((n) => rawContains(svc.dir, n)));
    check('(H) an unchecked order is kept sealed, a confirmed one is not kept at all', orders.some((o) => o.status === 'pending' && o.sealed_order) && orders.filter((o) => o.status === 'ok').every((o) => o.sealed_order === null));
    check('(H) the database holds no invitation text', !rawContains(svc.dir, 'eyJ0IjoiQ2hyaXN0bWFzIFBhcnR5In0'));
    const st = await call(S, 'GET', '/api/status');
    check('status endpoint answers without secrets and without sales timing', st.status === 200 && st.body.verifier === 'mock' && !/hash_key|lastOk|lastError|shop_name/.test(JSON.stringify(st.body)) && Array.isArray(st.body.attention), st.body);
    check('status lists products that still have no Etsy listing ID', st.body.attention.some((x) => x.startsWith('t-plain:')), st.body.attention);
    const softRow = links.find((l) => l.hash === hsoft);
    check('unchecked link after a short outage carries the small allowance (max_signs 2), a confirmed one the normal 100', softRow.max_signs === 2 && softRow.verified === 0 && links.find((l) => l.hash === hl).max_signs === 100, softRow);

    // ---- the service is stopped, the database is aged by hand, the service starts again on the same database
    await svc.stop();
    const now = Date.now(), hour = Math.floor(now / 3600000);
    sql(dbFile, `UPDATE links SET revoked = 1 WHERE hash = '${hw1}'`);
    sql(dbFile, `UPDATE links SET revoked = 2 WHERE hash = '${hw2}'`);
    sql(dbFile, `INSERT INTO attempts (ip_key, win, n) VALUES ('oldvisitoroldvisitor00', ${hour - 5}, 3), ('g:unchecked', ${hour - 60}, 2), ('g:etsy:min', ${Math.floor(now / 60000) - 2000}, 1), ('g:etsy:day', ${Math.floor(now / 86400000) - 40}, 1), ('g:etsy:day', ${Math.floor(now / 86400000) - 1}, 7)`);
    sql(dbFile, `UPDATE orders SET created = created - ${8 * 86400000} WHERE status = 'pending'`);
    sql(dbFile, `INSERT INTO kv (k, v, updated) VALUES ('oauth_state:old', '{}', ${now - 2 * 3600000})`);
    sql(dbFile, `INSERT INTO log (at, kind, detail) VALUES (${now - 200 * 86400000}, 'old', 'x')`);
    const svc2 = await startService({ port: 8790, persist: svc.dir, vars: { VERIFIER: 'mock', STAGE: 'test', CONFIG_OVERRIDES: OVERRIDES_A } });
    try {
      const S2 = svc2.url;
      const act2 = (order, product, ip) => call(S2, 'POST', '/api/activate', { order, product }, { 'X-Test-IP': ip });
      const open2 = (h) => call(S2, 'POST', '/api/open/' + h);
      check('a link withdrawn by the service is closed (410 "withdrawn")', (await open2(hw1)).body.reason === 'withdrawn');
      const back = await act2('2000000008', 't-plain', 'w2');
      check('...and opens again once the order is confirmed (an automatic withdrawal is lifted)', back.body.links[0].hash === hw1 && (await open2(hw1)).status === 200);
      await act2('2000000009', 't-plain', 'w2');
      check('a link blocked BY THE OWNER (revoked = 2) stays blocked, whatever is activated', (await open2(hw2)).status === 410);
      const tidy = await fetch(S2 + '/__scheduled?cron=17+3+*+*+*');
      await sleep(800);
      const att = sql(dbFile, 'SELECT ip_key, win, n FROM attempts');
      check('daily tidy-up runs (' + tidy.status + ') and deletes visitor counters of earlier hours', !att.some((a) => a.ip_key === 'oldvisitoroldvisitor00') && !att.some((a) => !a.ip_key.startsWith('g:') && a.win < hour - 1), att.slice(0, 5));
      check('tidy-up: old overall counters go, yesterday\'s Etsy day counter stays', !att.some((a) => a.ip_key === 'g:unchecked' && a.win === hour - 60) && !att.some((a) => a.ip_key === 'g:etsy:min') && att.filter((a) => a.ip_key === 'g:etsy:day').length === 1, att.filter((a) => a.ip_key.startsWith('g:')));
      const ord2 = sql(dbFile, 'SELECT status, sealed_order FROM orders');
      check('tidy-up: an order number that could not be checked for 7 days is no longer kept, not even sealed', !ord2.some((o) => o.sealed_order) && ord2.some((o) => o.status === 'unchecked'), ord2.filter((o) => o.status !== 'ok'));
      check('tidy-up: unused sign-in states and notes older than 180 days are deleted', sql(dbFile, "SELECT COUNT(*) AS n FROM kv WHERE k LIKE 'oauth_state:%'")[0].n === 0 && sql(dbFile, "SELECT COUNT(*) AS n FROM log WHERE kind = 'old'")[0].n === 0);
      check('tidy-up never touches a link record', sql(dbFile, 'SELECT COUNT(*) AS n FROM links')[0].n === links.length);
    } finally { await svc2.stop(); }

    // preview isolation: same database, TABLE_PREFIX -> own tables
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

    // a wrong TABLE_PREFIX must stop the service, not send it to the live tables
    const bp = await startService({ port: 8792, persist: svc.dir, anyAnswer: true, vars: { VERIFIER: 'mock', TABLE_PREFIX: 'Bad-Prefix', CONFIG_OVERRIDES: OVERRIDES_A } });
    try {
      const r = await call(bp.url, 'POST', '/api/open/' + hl);
      check('a TABLE_PREFIX that is not well-formed stops the service (500) instead of using the live tables', r.status === 500 && sql(dbFile, `SELECT opens FROM links WHERE hash = '${hl}'`)[0].opens === links.find((l) => l.hash === hl).opens, r.body);
    } finally { await bp.stop(); }
  } finally { await svc.stop(); }
}

const OVERRIDES_B = {
  products: { 'card-a': { name: 'Card A', listingIds: [555001] }, 'card-b': { name: 'Card B', listingIds: [] } },
  mock: { orders: { 2000000099: { status: 'paid', products: ['card-a', 'lab-party-1'] } } },
  activation: { maxAttemptsPerHour: 500, negativeCacheMinutes: 0.02, retryCheckSeconds: 1, recheckMinutes: 0, maxRechecks: 50, maxUncheckedPerHour: 100, uncheckedMaxSigns: 2, maxEtsyPerMinute: 1000, maxEtsyPerDay: 100000 },
};

async function partB() {
  section('B. live-like mode — the Etsy path against a local stand-in (NOT the real Etsy API)');
  const fake = await startFakeEtsy({ port: 8793 });
  const svc = await startService({ port: 8794, vars: { ...fake.vars, VERIFIER: 'etsy', STAGE: 'test-live', CONFIG_OVERRIDES: OVERRIDES_B } }); // VERIFIER set explicitly: a local .dev.vars may say "mock"
  const S = svc.url, F = fake.state;
  const act = (order, product) => call(S, 'POST', '/api/activate', { order, product });
  const open = (h) => call(S, 'POST', '/api/open/' + h);
  const sign = async (h, text) => call(S, 'POST', '/api/sign', { hash: h, d: await digestOf(text) });
  const n = (k) => F.counts[k] || 0;
  const status = async () => (await call(S, 'GET', '/api/status')).body;
  try {
    let st = await status();
    check('before connecting: API key present, shop not connected, and the status says what that means', st.etsy.apiKey === true && st.etsy.connected === false && st.verifier === 'etsy' && st.attention.some((x) => /not connected to Etsy yet/.test(x)), st);

    // not connected -> our side cannot check -> buyer is let in, nothing is sent to Etsy
    F.receipts = {
      3000000002: { listings: [555001] }, 3000000003: { listings: [999] }, 3000000004: { status: 'open', is_paid: false, listings: [555001] },
      3000000005: { status: 'canceled', is_paid: false, listings: [555001] }, 3000000006: { listings: [555001] }, 3000000007: { listings: [555001] },
      3000000011: { listings: [555001] }, 3000000013: { listings: [555001] }, 3000000014: { listings: [555001] }, 3000000015: { listings: [555001] }, 3000000016: { listings: [555001] },
    };
    const pre = await act('3000000001', 'card-a');
    check('shop not connected yet -> buyer let in unchecked, no request to Etsy', pre.status === 200 && pre.body.verified === false && n('receipt') === 0, pre.body);
    const preLab = await act('3000000001', 'lab-party-1');
    check('a lab product is never let in unchecked by a non-test number (same number)', preLab.status === 503 && !preLab.body.links, preLab.body);
    const preLab2 = await act('3000000020', 'lab-party-1');
    check('a lab product is never let in unchecked by a non-test number (fresh number)', preLab2.status === 503 && !preLab2.body.links, preLab2.body);

    // test orders on the live service
    const tl = await act('2000000099', 'card-a');
    check('live service: a TEST order unlocks only a lab product, never a real one', tl.status === 200 && tl.body.links.length === 1 && tl.body.links[0].product === 'lab-party-1', tl.body);
    const t500 = await act('1000000500', 'card-a');
    const t503 = await act('1000000503', 'card-a');
    const t402 = await act('1000000402', 'card-a');
    check('live service: the public test numbers "error" / "busy" / "unpaid" open NO real product (404 each)', t500.status === 404 && t503.status === 404 && t402.status === 404 && !t500.body.links, [t500.body, t503.body, t402.body]);
    check('live service: a LAB test number still opens the LAB product', (await act('1000001500', 'lab-party-1')).status === 200);

    // connect: another shop is refused
    F.shopName = 'SomebodyElsesShop';
    const wrong = await connectShop(S);
    check('connect: another shop is refused and nothing is saved', wrong.status === 400 && /nije naša radnja/.test(wrong.text) && (await status()).etsy.connected === false, wrong.text.slice(0, 200));
    F.deny = true; F.shopName = 'WishberrystudioGifts';
    const denied = await connectShop(S);
    check('connect: owner taps "Deny" -> clear message, not connected', denied.status === 400 && /nije odobreno/.test(denied.text));
    F.deny = false;
    const ok = await connectShop(S);
    const au = new URL(ok.authorizeUrl);
    check('connect: authorize request has code + PKCE S256 + state + scope transactions_r', au.searchParams.get('response_type') === 'code' && au.searchParams.get('code_challenge_method') === 'S256' && au.searchParams.get('scope') === 'transactions_r' && au.searchParams.get('state').length >= 16 && au.searchParams.get('code_challenge').length === 43);
    check('connect: callback address is <service>/etsy/callback', au.searchParams.get('redirect_uri') === S + '/etsy/callback');
    check('connect: our shop -> connected', ok.status === 200 && /Povezano/.test(ok.text), ok.text.slice(0, 200));
    st = await status();
    check('status shows the shop as connected, and that no real order has been read yet', st.etsy.connected === true && st.etsy.proven === false && st.attention.some((x) => /no real order has been read/.test(x)), st);
    const again = await fetch(S + '/etsy/connect', { redirect: 'manual' });
    check('connect: already connected -> nobody else can connect over it', again.status === 200 && /već povezana/.test(await again.text()));
    const replay = await fetch(ok.callbackUrl, { redirect: 'manual' });
    check('connect: the callback address cannot be used twice', replay.status === 400);
    const forged = await fetch(S + '/etsy/callback?code=x&state=' + 'A'.repeat(32), { redirect: 'manual' });
    check('connect: a made-up callback is refused', forged.status === 400);
    check('x-api-key was accepted by the stand-in (format keystring:secret)', n('bad_key') === 0 && n('token_code') >= 1);

    // "never worked live" rule: until one receipt has been read successfully, a "no" from Etsy turns nobody away
    const un = await act('3000000777', 'card-a');
    check('first days: Etsy says "not found" before any receipt was ever read -> the buyer is still let in (one request)', un.status === 200 && un.body.verified === false && n('receipt:3000000777') === 1, un.body);

    // one receipt request per activation; the answer is kept
    const r0 = n('receipt');
    const p1 = await act('3000000002', 'card-a');
    check('paid order with our listing -> product link (verified)', p1.status === 200 && p1.body.verified === true && p1.body.links[0].product === 'card-a', p1.body);
    check('exactly ONE request to Etsy for this activation', n('receipt') - r0 === 1 && n('receipt:3000000002') === 1, F.counts);
    const p2 = await act('3000000002', 'card-a');
    check('same order again -> same hash, ZERO new requests to Etsy', p2.body.links[0].hash === p1.body.links[0].hash && n('receipt:3000000002') === 1);
    st = await status();
    check('after the first receipt was read: the connection counts as proven, nothing needs attention for Etsy', st.etsy.proven === true && !st.attention.some((x) => /Etsy (yet|again)|no real order/.test(x)), st);
    await sleep(1100);
    const un2 = await act('3000000777', 'card-a');
    const unOpen = await open(un.body.links[0].hash);
    check('...and from then on "not found" is believed: the made-up number is refused and its link withdrawn', un2.status === 404 && unOpen.status === 410 && unOpen.body.reason === 'withdrawn', [un2.body, unOpen.body]);

    const q1 = await act('3000000003', 'card-a');
    check('paid order WITHOUT our new product -> 404, same message as "no such order"', q1.status === 404 && q1.body.error === 'not_found');
    const q2 = await act('3000000003', 'card-b');
    check('launch grace: product without a listing ID yet is unlocked by any paid order of our shop — and Etsy is not asked again', q2.status === 200 && q2.body.links[0].product === 'card-b' && n('receipt:3000000003') === 1, q2.body);

    const nf1 = await act('3000000999', 'card-a');
    const nf2 = await act('3000000999', 'card-a');
    check('no such order -> 404; asked again right away -> answered from memory (one request in total)', nf1.status === 404 && nf2.status === 404 && n('receipt:3000000999') === 1);

    const np = await act('3000000004', 'card-a');
    const npAgain = await act('3000000004', 'card-a');
    check('order not paid yet -> 409 not_paid; a second tap right away does not ask Etsy again', np.status === 409 && npAgain.status === 409 && n('receipt:3000000004') === 1);
    F.receipts[3000000004] = { status: 'paid', is_paid: true, listings: [555001] };
    await sleep(1100);
    check('...and after the payment went through -> product link', (await act('3000000004', 'card-a')).status === 200);
    check('canceled order -> 404', (await act('3000000005', 'card-a')).status === 404);

    const db = findSqlite(svc.dir)[0];
    const linkRow = (h) => sql(db, "SELECT verified, revoked, order_key, max_signs, signs FROM links WHERE hash = '" + h + "'")[0];
    check('a link let in while the shop was not connected is not held back (normal 100 invitation links)', linkRow(pre.body.links[0].hash).max_signs === 100);

    // Etsy answers 500 twice -> one retry -> buyer let in -> checked later on the next opening
    F.fail.server = 2;
    const sp = await act('3000000006', 'card-a');
    check('Etsy error -> exactly one retry (2 requests), buyer let in unchecked', sp.status === 200 && sp.body.verified === false && n('receipt:3000000006') === 2, [sp.body, F.counts]);
    const hsp = sp.body.links[0].hash;
    check('...with the small allowance of an unchecked link (2 invitation links here)', linkRow(hsp).max_signs === 2);
    check('unchecked link opens', (await open(hsp)).status === 200);
    await sleep(900); // the later check runs after the answer was sent
    let lrow = linkRow(hsp);
    check('checked later: Etsy confirmed -> link marked verified, stays open, normal allowance again', lrow.verified === 1 && lrow.revoked === 0 && lrow.max_signs === 100 && (await open(hsp)).status === 200, lrow);
    check('checked later: the sealed order number is deleted once confirmed', sql(db, "SELECT sealed_order, status FROM orders WHERE order_key = '" + lrow.order_key + "'")[0].sealed_order === null);

    // a longer outage: the buyer reaches the small allowance, Etsy comes back, the very next "create link" works
    F.fail.server = 1000;
    const sx = await act('3000000011', 'card-a');
    const hx = sx.body.links[0].hash;
    await open(hx);
    const x1 = await sign(hx, 'x1'); const x2 = await sign(hx, 'x2');
    await sleep(1200);
    const x3 = await sign(hx, 'x3');
    check('longer outage: third invitation link waits (429, "unchecked")', x1.status === 200 && x2.status === 200 && x3.status === 429 && x3.body.unchecked === true, [x1.status, x2.status, x3.body]);
    F.fail.server = 0;
    await sleep(1200);
    const x4 = await sign(hx, 'x4');
    check('...Etsy is back: the next try asks Etsy at once, the order is confirmed and the link is signed', x4.status === 200 && linkRow(hx).verified === 1 && linkRow(hx).max_signs === 100, [x4.body, linkRow(hx)]);

    // the order that was let in before the shop was connected does not exist -> withdrawn at the later check
    const hpre = pre.body.links[0].hash;
    check('order let in before connecting: first opening still works', (await open(hpre)).status === 200);
    await sleep(900);
    const gone = await open(hpre);
    check('...Etsy then says "no such order" -> the link is withdrawn (410)', gone.status === 410 && gone.body.reason === 'withdrawn', gone.body);

    // withdrawn by mistake, confirmed later -> opens again
    F.fail.server = 2;
    const w = await act('3000000012', 'card-a'); const hw = w.body.links[0].hash;
    await open(hw); await sleep(900);
    const wGone = await open(hw);
    F.receipts[3000000012] = { listings: [555001] };
    await sleep(1400);
    const wBack = await act('3000000012', 'card-a');
    check('a link that was withdrawn opens again as soon as Etsy confirms the order', wGone.status === 410 && wBack.status === 200 && wBack.body.verified === true && (await open(hw)).status === 200, [wGone.body, wBack.body]);

    // Etsy says "too many requests" -> nobody is let in; "forbidden" is OUR problem -> the buyer is let in
    F.fail.rate = 1;
    const rl = await act('3000000013', 'card-a');
    check('Etsy answers 429 -> 503 "busy", NO link, no retry', rl.status === 503 && rl.body.error === 'busy' && !rl.body.links && n('receipt:3000000013') === 1, [rl.body, F.counts]);
    check('...a minute later the same buyer gets in normally', (await act('3000000013', 'card-a')).body.verified === true);
    F.fail.forbidden = 1;
    const fb = await act('3000000014', 'card-a');
    check('Etsy answers 403 (key or permission problem = our side) -> the buyer is let in unchecked, not turned away', fb.status === 200 && fb.body.verified === false, fb.body);

    // access token refused once -> one refresh, then the receipt
    const tr0 = n('token_refresh');
    F.fail.unauthorized = 1;
    const rf = await act('3000000007', 'card-a');
    check('token refused -> refreshed once and the order is confirmed', rf.status === 200 && rf.body.verified === true && n('token_refresh') - tr0 === 1, [rf.body, F.counts]);
    const tr1 = n('token_refresh');
    await act('3000000002', 'card-a');
    check('no token refresh when nothing needs Etsy', n('token_refresh') === tr1);
    // two buyers at the same moment, both tokens refused: one refresh wins, the other must not conclude "connect again"
    F.fail.unauthorized = 2;
    const [c1, c2] = await Promise.all([act('3000000015', 'card-a'), act('3000000016', 'card-a')]);
    st = await status();
    check('two refreshes at the same moment: both buyers are confirmed and nobody is told to reconnect', c1.body.verified === true && c2.body.verified === true && st.etsy.reconnectNeeded === false && st.etsy.connected === true, [c1.body, c2.body, st.etsy]);

    // refresh token dead -> owner must connect again; buyers are still let in
    F.refreshInvalid = true; F.fail.unauthorized = 1;
    F.receipts[3000000008] = { listings: [555001] };
    const dead = await act('3000000008', 'card-a');
    st = await status();
    check('refresh token no longer valid -> buyer let in, status says "reconnect needed"', dead.status === 200 && dead.body.verified === false && st.etsy.reconnectNeeded === true && st.etsy.connected === false && st.attention.some((x) => /connected to Etsy again/.test(x)), [dead.body, st]);
    const tokBefore = n('token'), recBefore = n('receipt');
    F.receipts[3000000009] = { listings: [555001] };
    const dead2 = await act('3000000009', 'card-a');
    check('...and while that stands, the next buyer is let in without a single request to Etsy', dead2.status === 200 && dead2.body.verified === false && n('token') === tokBefore && n('receipt') === recBefore, [dead2.body, F.counts]);
    F.refreshInvalid = false;
    const re = await connectShop(S);
    check('owner connects again -> connected', re.status === 200 && (await status()).etsy.connected === true);

    check('database holds no order number in plain text (live-like run)', !['3000000001', '3000000002', '3000000006', '3000000999', '3000000777'].some((x) => rawContains(svc.dir, x)));
    check('tokens are stored in D1 only (kv table)', sql(db, "SELECT COUNT(*) AS n FROM kv WHERE k = 'etsy_token'")[0].n === 1);
    const kinds = sql(db, 'SELECT kind, detail FROM log');
    check('the owner\'s notes hold no order number and no hash', !kinds.some((k) => /\d{7,}/.test(k.detail || '') || /[A-Za-z0-9_-]{22}/.test(k.detail || '')), kinds.filter((k) => /\d{7,}/.test(k.detail || '')));
    console.log('  requests the stand-in saw:', JSON.stringify(F.counts));
  } finally { await svc.stop(); await fake.stop(); }
}

async function partC() {
  section('C. our own brake on requests to Etsy');
  const fake = await startFakeEtsy({ port: 8795 });
  const svc = await startService({ port: 8796, vars: { ...fake.vars, VERIFIER: 'etsy', STAGE: 'test-live', CONFIG_OVERRIDES: { products: { 'card-a': { name: 'Card A', listingIds: [555001] } }, activation: { maxAttemptsPerHour: 500, maxEtsyPerMinute: 2 } } } });
  const F = fake.state;
  try {
    F.receipts = { 4000000001: { listings: [555001] }, 4000000002: { listings: [555001] }, 4000000003: { listings: [555001] } };
    await connectShop(svc.url);
    await awayFromClockEdge(60000, 8000);
    const r = [];
    for (const o of ['4000000001', '4000000002', '4000000003']) r.push(await call(svc.url, 'POST', '/api/activate', { order: o, product: 'card-a' }));
    check('setting maxEtsyPerMinute 2: the third order in the same minute waits (503 busy) and Etsy sees only two requests', r[0].status === 200 && r[1].status === 200 && r[2].status === 503 && r[2].body.error === 'busy' && (F.counts.receipt || 0) === 2, [r.map((x) => x.status), F.counts]);
  } finally { await svc.stop(); await fake.stop(); }
}

await partA();
await partB();
await partC();
process.exit(summary() ? 0 : 1);
