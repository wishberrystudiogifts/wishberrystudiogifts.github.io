// Browser tests of the SITE side of the product link (Playwright, phone 390 px), all local:
//   node service/test/site.test.mjs
// Starts: the service three times (normal limits · maxOpens 3 · a deadline of a few seconds), a static server that behaves
// like GitHub Pages, and a second copy of the site with the LAB product switched to mode 'direct' by changing ONE line.
// Screenshots land in service/test/shots/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { startService, call, check, section, summary, sleep, SERVICE_DIR } from './helpers.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { console.log('Playwright is not installed here (npm i -g playwright, or run where it is pre-installed).'); process.exit(2); }
const REPO = path.join(SERVICE_DIR, '..');
const SHOTS = path.join(SERVICE_DIR, 'test', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const LAB = '/product/lab-party-1-2026-11-24/';
const ENTRY = LAB + 'personalize-l4b7.html';
const HASH_URL = /^http:\/\/127\.0\.0\.1:\d+\/[A-Za-z0-9_-]{22}$/;
const LIVE_SERVICE = 'https://product-link.wishberrystudiogifts.workers.dev';

// ---- Fraunces from the npm package when Google Fonts is blocked (work environment); otherwise the real thing loads ----
function findFraunces() {
  for (const base of [path.join(REPO, 'video', 'fonts'), path.join(REPO, 'lab', 'video', 'fonts')]) {
    const n = path.join(base, 'fraunces-latin-full-normal.woff2'), i = path.join(base, 'fraunces-latin-full-italic.woff2');
    if (fs.existsSync(n) && fs.existsSync(i)) return { n, i };
  }
  return null;
}
const FR = findFraunces();
async function localFonts(context) {
  if (!FR) return;
  await context.route('**://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body:
    "@font-face{font-family:'Fraunces';font-style:normal;font-weight:100 900;font-display:block;src:url(https://fonts.gstatic.com/l/n.woff2) format('woff2')}" +
    "@font-face{font-family:'Fraunces';font-style:italic;font-weight:100 900;font-display:block;src:url(https://fonts.gstatic.com/l/i.woff2) format('woff2')}" }));
  await context.route('**://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(r.request().url().endsWith('i.woff2') ? FR.i : FR.n) }));
}

async function startPages(port, root, keysFrom) {
  const args = [path.join(SERVICE_DIR, 'tools', 'pages-server.mjs'), '--port=' + port, '--root=' + root];
  if (keysFrom) args.push('--keys=' + keysFrom);
  const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 40; i++) { try { await fetch('http://127.0.0.1:' + port + '/shared/config.js'); break; } catch (e) { if (i === 39) throw new Error('pages server: ' + log); await sleep(250); } }
  return { url: 'http://127.0.0.1:' + port, stop: () => child.kill('SIGTERM') };
}

/** A phone: 390 x 844, touch. svc = which service this "phone" talks to (the site code uses it only on localhost). */
async function phone(browser, svc, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...extra });
  await localFonts(ctx);
  await ctx.addInitScript((u) => { try { if (u) localStorage.setItem('wb.serviceUrl', u); } catch (e) {} window.print = function () { window.__printed = (window.__printed || 0) + 1; }; }, svc || '');
  return ctx;
}
function track(ctx) {
  const seen = { service: [], failed: [], bad: [] };
  ctx.on('request', (r) => { const u = r.url(); if (/^http:\/\/127\.0\.0\.1:879\d\//.test(u) || u.startsWith(LIVE_SERVICE)) seen.service.push(r.method() + ' ' + u); });
  ctx.on('requestfailed', (r) => { if (!/fonts\.g/.test(r.url())) seen.failed.push(r.url()); });
  ctx.on('response', (r) => { if (r.status() >= 400 && !/fonts\.g/.test(r.url())) seen.bad.push(r.status() + ' ' + r.url()); });
  return seen;
}
async function activate(page, site, order) {
  await page.goto(site + ENTRY + '?new=1');
  await page.waitForSelector('#wb-gate');
  await page.fill('#wb-order', order);
  await page.click('#wb-gate button[type=submit]');
}
async function fillParty(page) {
  await page.fill('#h', 'The Millers'); await page.fill('#d', '2026-12-19'); await page.fill('#tm', '19:00'); await page.fill('#p', '24 Holly Lane, Springfield');
}
async function makeLink(page) {
  await page.click('#send');
  await page.waitForFunction(() => !document.getElementById('sendbox').hidden || !document.getElementById('linkerr').hidden, null, { timeout: 15000 });
  return page.inputValue('#link');
}
/** What a guest sees: 'invitation' (envelope scene built), 'invalid', 'retry' or 'other'. */
async function guestSees(ctx, url) {
  const p = await ctx.newPage();
  await p.goto(url);
  await p.waitForFunction(() => document.querySelector('#stage *') || document.querySelector('main.wb-card h1'), null, { timeout: 15000 }).catch(() => {});
  const r = await p.evaluate(() => {
    const h = document.querySelector('main.wb-card h1');
    if (h) return /isn.t complete/.test(h.textContent) ? 'invalid' : /try again/i.test(h.textContent) ? 'retry' : 'other:' + h.textContent;
    return document.querySelector('#stage *') ? 'invitation' : 'nothing';
  });
  await p.close();
  return r;
}

/** Like guestSees, with what is on the page and what the address became. Waits for the card face (view=face) or a message page. */
async function guestDetail(ctx, url) {
  const p = await ctx.newPage();
  await p.goto(url);
  await p.waitForFunction(() => document.querySelector('.iface') || document.querySelector('#stage *') || document.querySelector('main.wb-card h1'), null, { timeout: 15000 }).catch(() => {});
  await sleep(250);
  const r = await p.evaluate(() => {
    const h = document.querySelector('main.wb-card h1');
    return { kind: h ? (/isn.t complete/.test(h.textContent) ? 'invalid' : 'other:' + h.textContent) : (document.querySelector('.iface') || document.querySelector('#stage *')) ? 'invitation' : 'nothing', text: document.body.innerText, hash: location.hash };
  });
  await p.close();
  return r;
}

const OV = (extra) => ({ products: { 'lab-b': { name: 'Other item', lab: true }, ...(extra || {}) }, mock: { orders: { 2000000050: { status: 'paid', products: ['lab-b'] } } } });

let browser, S1, S2, S3, P1, P2, P3, P5, P6, P7, tmpDirect, tmpTwo, tmpNoProd, tmpNoScript;
try {
  // ---------- start everything ----------
  S1 = await startService({ port: 8797, vars: { VERIFIER: 'mock', STAGE: 'e2e', CONFIG_OVERRIDES: OV() } });
  S2 = await startService({ port: 8798, vars: { VERIFIER: 'mock', STAGE: 'e2e-opens', CONFIG_OVERRIDES: OV({ 'lab-party-1': { maxOpens: 3 } }) } });
  S3 = await startService({ port: 8799, vars: { VERIFIER: 'mock', STAGE: 'e2e-ttl', CONFIG_OVERRIDES: OV({ 'lab-party-1': { ttlHours: 0.0014 } }) } });
  P1 = await startPages(8081, REPO, S1.url);

  // a copy of the site where ONE line of shared/config.js is changed: mode 'hash' -> 'direct'
  tmpDirect = fs.mkdtempSync(path.join(os.tmpdir(), 'site-direct-'));
  execFileSync('git', ['-C', REPO, 'checkout-index', '-a', '-f', '--prefix=' + tmpDirect + '/']);
  for (const f of ['404.html', 'shared', 'product']) fs.cpSync(path.join(REPO, f), path.join(tmpDirect, f), { recursive: true }); // working copy, not only what is committed
  const cfgFile = path.join(tmpDirect, 'shared', 'config.js');
  const before = fs.readFileSync(cfgFile, 'utf8').split('\n');
  const after = before.map((l) => (/^\s*mode: 'hash',\s*\/\/ <-- THE SWITCH/.test(l) ? l.replace("'hash'", "'direct'") : l));
  fs.writeFileSync(cfgFile, after.join('\n'));
  const changed = before.filter((l, i) => l !== after[i]).length;
  P2 = await startPages(8082, tmpDirect, null);

  // a copy with a second (pretend) product, to see the "this order is for another item" message
  tmpTwo = fs.mkdtempSync(path.join(os.tmpdir(), 'site-two-'));
  for (const f of ['404.html', 'shared', 'product']) fs.cpSync(path.join(REPO, f), path.join(tmpTwo, f), { recursive: true });
  const c3 = path.join(tmpTwo, 'shared', 'config.js');
  fs.writeFileSync(c3, fs.readFileSync(c3, 'utf8').replace("    'lab-party-1': {", "    'lab-b': { mode: 'hash', folder: 'product/lab-party-1-2026-11-24', entry: 'personalize-l4b7.html', name: 'Other item' },\n    'lab-party-1': {"));
  fs.writeFileSync(path.join(tmpTwo, 'evil.html'), '<!doctype html><meta charset="utf-8"><script>window.__WB_SESSION={product:"lab-party-1",hash:"AAAAAAAAAAAAAAAAAAAAAA"};window.ProductLink={state:"maker"};</script><iframe id="f" style="width:390px;height:700px"></iframe><script>document.getElementById("f").src="http://127.0.0.1:8083' + LAB + 'index.html#view=face&m="+location.hash.slice(1);</script>');
  fs.writeFileSync(path.join(tmpTwo, 'frame.html'), '<!doctype html><meta charset="utf-8"><p>another website</p><iframe id="f" style="width:390px;height:600px"></iframe><script>document.getElementById("f").src="http://127.0.0.1:8081/"+location.hash.slice(1);</script>');
  P3 = await startPages(8083, tmpTwo, S1.url);
  // the site as it was before the first release: shared/keys.js empty (since 26 Nov 2026 the repository holds the
  // production key, so this copy empties it - the check below is about the empty-list path, not about the real key)
  const tmpNoKeys = fs.mkdtempSync(path.join(os.tmpdir(), 'site-nokeys-'));
  for (const f of ['404.html', 'index.html', 'shared', 'product', 'video']) if (fs.existsSync(path.join(REPO, f))) fs.cpSync(path.join(REPO, f), path.join(tmpNoKeys, f), { recursive: true });
  fs.writeFileSync(path.join(tmpNoKeys, 'shared', 'keys.js'), 'window.WB_KEYS = [];\n');
  P5 = await startPages(8085, tmpNoKeys, null);
  // two broken copies: the product is missing from shared/config.js · the shared code is missing altogether
  tmpNoProd = fs.mkdtempSync(path.join(os.tmpdir(), 'site-noprod-'));
  for (const f of ['404.html', 'shared', 'product']) fs.cpSync(path.join(REPO, f), path.join(tmpNoProd, f), { recursive: true });
  const c6 = path.join(tmpNoProd, 'shared', 'config.js');
  fs.writeFileSync(c6, fs.readFileSync(c6, 'utf8').replace("    'lab-party-1': {", "    'renamed-by-mistake': {"));
  P6 = await startPages(8086, tmpNoProd, S1.url);
  tmpNoScript = fs.mkdtempSync(path.join(os.tmpdir(), 'site-noscript-'));
  for (const f of ['404.html', 'shared', 'product']) fs.cpSync(path.join(REPO, f), path.join(tmpNoScript, f), { recursive: true });
  fs.rmSync(path.join(tmpNoScript, 'shared', 'product-link.js'));
  P7 = await startPages(8087, tmpNoScript, S1.url);

  try { browser = await pw.chromium.launch(); } catch (e) { browser = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome' }); }

  // ================================================================== the buyer's path in mode 'hash'
  section('Mode "hash": order number -> /<hash> -> maker -> signed invitation link');
  const ctx = await phone(browser, S1.url);
  const seen = track(ctx);
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(P1.url + ENTRY);
  await page.waitForSelector('#wb-gate');
  check('entry address in mode "hash" shows the activation form, not the maker', await page.isVisible('#wb-order') && !(await page.isVisible('#send')));
  check('(h) Fraunces is loaded for the screenshots', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check("600 20px 'Fraunces'"); }));
  const small = await page.evaluate(() => [...document.querySelectorAll('#wb-gate *')].filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.tagName + ':' + getComputedStyle(e).fontSize));
  check('(h) activation form: every text is at least 16 px', small.length === 0, small);
  check('(h) activation form: no sideways scrolling at 390 px', await page.evaluate(() => document.documentElement.scrollWidth <= 390));
  check('(F) activation form: one field, one big button, three steps', (await page.locator('#wb-gate input').count()) === 1 && (await page.locator('#wb-gate button').count()) === 1 && (await page.locator('#wb-gate .wb-steps li').count()) === 3);
  check('(H) the Etsy API notice is on the form', (await page.textContent('#wb-gate')).includes("The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc."));
  await page.screenshot({ path: path.join(SHOTS, '1-aktivacija-390.png'), fullPage: true });

  await page.fill('#wb-order', 'hello'); await page.click('#wb-gate button[type=submit]');
  check('form: letters -> plain message, nothing sent', /doesn.t look like an Etsy order number/.test(await page.textContent('.wb-err')) && seen.service.length === 0);
  await page.fill('#wb-order', '1000000404'); await page.click('#wb-gate button[type=submit]');
  await page.waitForFunction(() => /can.t find/.test(document.querySelector('.wb-err').textContent));
  check('form: wrong number -> "We can’t find that order number"', true);
  await page.fill('#wb-order', '1000000402'); await page.click('#wb-gate button[type=submit]');
  await page.waitForFunction(() => /still processing/.test(document.querySelector('.wb-err').textContent));
  check('form: unpaid order -> "Etsy is still processing your payment"', true);
  await page.screenshot({ path: path.join(SHOTS, '1b-aktivacija-greska-390.png') });
  await page.fill('#wb-order', '1000000503'); await page.click('#wb-gate button[type=submit]');
  await page.waitForFunction(() => /couldn.t check your order just now/.test(document.querySelector('.wb-err').textContent));
  check('form: service too busy to check -> "We couldn’t check your order just now. Please try again in a minute."', true);

  await page.fill('#wb-order', '1000000001'); await page.click('#wb-gate button[type=submit]');
  await page.waitForURL(HASH_URL, { timeout: 15000 });
  await page.waitForSelector('.wb-status');
  const hashUrl = page.url();
  check('(f) the product link is the site address + 22 characters, nothing else', HASH_URL.test(hashUrl) && !hashUrl.includes('?') && !hashUrl.includes('#'), hashUrl);
  check('(f) the address holds no product name and no order number', !/lab|party|1000000001/.test(new URL(hashUrl).pathname));
  const status = await page.textContent('.wb-status');
  check('(F) maker shows "Your personal link works until … · opened 1 of 300"', /Your personal link works until .+ · opened 1 of 300/.test(status), status);
  check('the activation call carried only the order number and the product key', seen.service.filter((s) => s.includes('/api/activate')).length === 4 && seen.service.some((s) => /POST .*\/api\/open\/[A-Za-z0-9_-]{22}$/.test(s)), seen.service);

  // (i) everything on the maker works under /<hash>
  await page.waitForFunction(() => [...document.querySelectorAll('.dz img')].every((i) => i.complete && i.naturalWidth > 0));
  check('(i) design thumbnails load under /<hash> (relative paths resolve into the product folder)', true);
  await page.click('.dz[data-v="c"]');
  await fillParty(page);
  await page.waitForFunction(() => { const f = document.getElementById('pv'); try { return f.contentDocument.querySelector('.iface') && /lab-party-1-2026-11-24\/index\.html/.test(f.contentWindow.location.href); } catch (e) { return false; } }, null, { timeout: 15000 });
  const pvText = await page.evaluate(() => document.getElementById('pv').contentDocument.body.innerText);
  check('(i) live preview shows the buyer’s own details (unsigned preview allowed only inside the buyer’s page)', /MILLERS|Millers/.test(pvText) && /Holly Lane/.test(pvText), pvText.slice(0, 120));
  check('(i) preview picked design C', await page.evaluate(() => !!document.getElementById('pv').contentDocument.querySelector('.iface.d-c')));
  await page.screenshot({ path: path.join(SHOTS, '2-pravljenje-390.png'), fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(SHOTS, '2a-pravljenje-vrh-390.png') });
  await page.click('#see');
  await page.waitForFunction(() => { try { return !!document.getElementById('full').contentDocument.querySelector('#stage *'); } catch (e) { return false; } }, null, { timeout: 15000 });
  check('(i) "Watch it open" plays the invitation in the overlay', true);
  await page.click('#close');
  const link = await makeLink(page);
  const signed = /^http:\/\/127\.0\.0\.1:8081\/product\/lab-party-1-2026-11-24\/#m=[A-Za-z0-9_-]+&s=[A-Za-z0-9_-]{86}$/.test(link);
  check('(i) "Send my invitation" gives an invitation link in the product folder with a signature', signed, link);
  check('(i) WhatsApp / mail buttons carry the same link', (await page.getAttribute('#wa', 'href')).includes(encodeURIComponent(link)) && (await page.getAttribute('#mail', 'href')).includes(encodeURIComponent(link)));
  await page.locator('#sendbox').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(SHOTS, '3-link-za-slanje-390.png') });
  await page.click('#send'); await sleep(500);
  const signReq = seen.service.filter((s) => s.includes('/api/sign'));
  check('signing sent one request — and tapping the button again with the same words does not use up another signature', signReq.length === 1 && (await page.inputValue('#link')) === link, signReq);
  const [popup] = await Promise.all([ctx.waitForEvent('page'), page.click('.pb[data-size="5x7"]')]);
  await popup.waitForFunction(() => document.body && document.body.classList.contains('print-view') && document.querySelector('.pcard .iface'), null, { timeout: 15000 });
  await popup.waitForFunction(() => window.__printed > 0, null, { timeout: 15000 });
  check('(i) "Print it with your details" opens the print page and calls print', /Holly Lane/.test(await popup.evaluate(() => document.querySelector('.pcard').innerText)));
  check('(J) LAB: the print page is marked "TEST COPY" across the card', /TEST COPY/.test(await popup.evaluate(() => getComputedStyle(document.querySelector('.pcard'), '::after').content)));
  await popup.setViewportSize({ width: 600, height: 900 });
  await popup.screenshot({ path: path.join(SHOTS, '9-lab-stampa-test-copy.png'), fullPage: true });
  await popup.close();
  check('(i) the draft is remembered on the device', await page.evaluate(() => /Holly Lane/.test(localStorage.getItem('inviteDraft-lab-party-1') || '')));
  const badNow = seen.bad.filter((b) => !/^404 http:\/\/127\.0\.0\.1:8081\/[A-Za-z0-9_-]{22}$/.test(b) && !/\/api\/activate/.test(b));
  check('(i) no missing file anywhere on the buyer’s path (only the /<hash> address itself answers 404, by design)', badNow.length === 0 && seen.failed.length === 0, [badNow, seen.failed]);
  check('no script error on the buyer’s page', pageErrors.length === 0, pageErrors);

  // returning buyer
  await page.goto(P1.url + ENTRY);
  await page.waitForURL(HASH_URL, { timeout: 15000 });
  await page.waitForSelector('.wb-status');
  check('a buyer who comes back through the START HERE address lands on the personal page (and it is counted)', page.url() === hashUrl && /opened 2 of 300/.test(await page.textContent('.wb-status')));

  // ================================================================== the guest
  section('The guest: invitation link without any service; signature checks');
  const guestCtx = await phone(browser, 'http://127.0.0.1:8790'); // nothing listens there: the guest has NO service
  const gseen = track(guestCtx);
  check('(e) correct signed link opens', (await guestSees(guestCtx, link)) === 'invitation');
  const m = /#m=([^&]+)&s=(.+)$/.exec(link);
  const flip = (s, i) => s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);
  check('(e) one changed character in the data -> refused', (await guestSees(guestCtx, link.replace(m[1], flip(m[1], 12)))) === 'invalid');
  check('(e) one changed character in the signature -> refused', (await guestSees(guestCtx, link.replace(m[2], flip(m[2], 30)))) === 'invalid');
  check('(e) signature cut off -> refused', (await guestSees(guestCtx, link.slice(0, -10))) === 'invalid');
  check('(e) link without a signature -> refused', (await guestSees(guestCtx, link.split('&s=')[0])) === 'invalid');
  const own = Buffer.from(JSON.stringify({ v: 'b', t: 'Free Party', d: '2026-12-24', p: 'Anywhere' })).toString('base64url');
  check('(e) hand-made link (own data, no signature) -> refused', (await guestSees(guestCtx, P1.url + LAB + '#m=' + own)) === 'invalid');
  check('(e) hand-made data with a signature borrowed from a real link -> refused', (await guestSees(guestCtx, P1.url + LAB + '#m=' + own + '&s=' + m[2])) === 'invalid');
  check('(e) the old shortcuts #autoplay / #view=face / #view=print without a signature -> refused', (await guestSees(guestCtx, P1.url + LAB + '#autoplay=1&m=' + own)) === 'invalid' && (await guestSees(guestCtx, P1.url + LAB + 'index.html#view=face&m=' + own)) === 'invalid' && (await guestSees(guestCtx, P1.url + LAB + 'index.html#view=print&size=a4&m=' + own)) === 'invalid');
  check('(e) the bare page address without a link -> refused (no free default invitation)', (await guestSees(guestCtx, P1.url + LAB)) === 'invalid');
  const gp = await guestCtx.newPage();
  await gp.goto(link); await gp.waitForSelector('#stage *');
  await gp.evaluate((h) => { location.hash = h; }, '#m=' + own);
  await gp.waitForSelector('main.wb-card h1');
  check('(e) changing the address of an open invitation by hand -> refused too', /isn.t complete/.test(await gp.textContent('main.wb-card h1')));
  await gp.screenshot({ path: path.join(SHOTS, '5-gost-neispravan-link-390.png') });
  await gp.close();
  // the address is read strictly: one "m", one "s", spelled plainly — and afterwards rewritten to exactly what was checked
  const B = P1.url + LAB + 'index.html';
  const twoM = await guestDetail(guestCtx, B + '#m=' + own + '&m=' + m[1] + '&s=' + m[2] + '&view=face');
  const encM = await guestDetail(guestCtx, B + '#%6d=' + own + '&m=' + m[1] + '&s=' + m[2] + '&view=face');
  const qM = await guestDetail(guestCtx, B + '#?m=' + own + '&m=' + m[1] + '&s=' + m[2] + '&view=face');
  const twoS = await guestDetail(guestCtx, B + '#m=' + m[1] + '&s=' + m[2] + '&s=' + m[2] + '&view=face');
  check('(e) FORGERY: own data smuggled in front of a real signed link (second "m", "%6d", "?m", second "s") -> refused', [twoM, encM, qM, twoS].every((r) => r.kind === 'invalid'), [twoM.kind, encM.kind, qM.kind, twoS.kind]);
  const xm = await guestDetail(guestCtx, B + '#xm=' + own + '&junk=1&m=' + m[1] + '&s=' + m[2] + '&view=face');
  check('(e) extra parts around a real signed link are dropped: the page shows the SIGNED invitation and the address is rewritten to exactly what was checked', xm.kind === 'invitation' && /Holly Lane/.test(xm.text) && !/Anywhere/.test(xm.text) && xm.hash === '#m=' + m[1] + '&s=' + m[2] + '&view=face', [xm.kind, xm.hash.slice(0, 40), xm.text.slice(0, 80)]);
  check('(5) the guest page never called the service', gseen.service.length === 0, gseen.service);
  // a forged "buyer page" on another origin cannot unlock the preview
  const ev = await guestCtx.newPage();
  await ev.goto('http://localhost:8083/evil.html#' + own);
  await sleep(1500);
  const evFrame = ev.frames().find((f) => f.url().includes('index.html'));
  check('(e) another website that pretends to be the buyer’s page cannot show an unsigned invitation', evFrame && /isn.t complete/.test(await evFrame.evaluate(() => (document.querySelector('main.wb-card h1') || {}).textContent || '')));
  await ev.close();

  // another website loads the buyer's product link in a frame: it must not count as an opening
  const frCtx = await phone(browser, S1.url);
  const frSeen = track(frCtx);
  const fr = await frCtx.newPage();
  await fr.goto('http://localhost:8083/frame.html#' + new URL(hashUrl).pathname.slice(1));
  await sleep(1500);
  const inner = fr.frames().find((f) => /^http:\/\/127\.0\.0\.1:8081\//.test(f.url()));
  const innerText = inner ? await inner.evaluate(() => document.body.innerText) : '';
  check('another website cannot use up a buyer’s openings by loading the product link in a hidden frame (no opening is counted)', /Open this page in its own tab/.test(innerText) && frSeen.service.filter((x) => x.includes('/api/open/')).length === 0, [innerText.slice(0, 80), frSeen.service]);
  await frCtx.close();

  // mistakes on OUR side must leave a page closed, never open to everyone
  const brCtx = await phone(browser, S1.url);
  const np1 = await brCtx.newPage();
  await np1.goto(P6.url + ENTRY); await np1.waitForSelector('main.wb-card h1');
  const np1Text = await np1.textContent('h1');
  const np2 = await guestDetail(brCtx, link.replace(':8081', ':8086'));
  const np3 = await guestDetail(brCtx, P6.url + LAB + '#m=' + own);
  check('product missing from shared/config.js -> buyer page and recipient page stay CLOSED ("This page isn’t ready yet")', /isn.t ready yet/.test(np1Text) && (await np1.locator('#send').count()) === 0 && /isn.t ready yet/.test(np2.kind) && /isn.t ready yet/.test(np3.kind), [np1Text, np2.kind, np3.kind]);
  const ns = await brCtx.newPage();
  await ns.goto(P7.url + LAB + '#m=' + own); await sleep(1200);
  const nsText = await ns.evaluate(() => document.body.innerText);
  const nsBuilt = await ns.evaluate(() => !!document.querySelector('#stage *, .iface'));
  await ns.goto(P7.url + ENTRY); await sleep(800);
  await ns.fill('#h', 'x').catch(() => {}); await ns.click('#send', { timeout: 2000 }).catch(() => {}); await sleep(500);
  const nsLink = await ns.evaluate(() => { const l = document.getElementById('link'); return l ? l.value : ''; });
  check('shared code failed to load -> the recipient page stays closed and the buyer page makes nothing', /could not load completely/.test(nsText) && !nsBuilt && nsLink === '', [nsText.slice(0, 80), nsBuilt, nsLink]);
  await brCtx.close();

  // (d) the service is switched off: invitations keep working for guests
  await S1.stop(); S1 = null;
  const offCtx = await phone(browser, 'http://127.0.0.1:8797');
  const offSeen = track(offCtx);
  const g = await offCtx.newPage();
  await g.goto(link);
  await g.waitForSelector('#stage *', { timeout: 15000 });
  await g.click('#stage');
  await sleep(6500);
  check('(d) SERVICE OFF: the invitation still opens for a guest (envelope, card, details)', /Holly Lane/.test(await g.evaluate(() => document.body.innerText)));
  check('(d) SERVICE OFF: the guest page did not even try to call it', offSeen.service.length === 0, offSeen.service);
  await g.screenshot({ path: path.join(SHOTS, '4-gost-servis-ugasen-390.png') });
  await g.close();
  const off = await offCtx.newPage();
  await off.goto(hashUrl);
  await off.waitForSelector('main.wb-card h1');
  check('SERVICE OFF: the product link shows "We couldn’t open your page" with Try again', /couldn.t open your page/.test(await off.textContent('h1')) && (await off.locator('button', { hasText: 'Try again' }).count()) === 1);
  await off.goto(P1.url + ENTRY + '?new=1'); await off.waitForSelector('#wb-gate');
  await off.fill('#wb-order', '1000000002'); await off.click('#wb-gate button[type=submit]');
  await off.waitForFunction(() => /couldn.t reach our service/.test(document.querySelector('.wb-err').textContent));
  check('SERVICE OFF: the activation form says so and lets the buyer try again', true);
  await off.close();

  // ================================================================== limits seen by the buyer
  section('Limits as the buyer sees them');
  const c2 = await phone(browser, S2.url);
  const p2 = await c2.newPage();
  await activate(p2, P1.url, '1000000002');
  await p2.waitForURL(HASH_URL); await p2.waitForSelector('.wb-status');
  const h2 = p2.url();
  check('limit 3: status says "opened 1 of 3"', /opened 1 of 3/.test(await p2.textContent('.wb-status')));
  await fillParty(p2);
  const link2 = await makeLink(p2);
  // before the first release shared/keys.js is empty: the recipient page asks the service for the key (and only then)
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const te = new TextEncoder();
  const attackerPub = Buffer.from(await webcrypto.subtle.exportKey('raw', kp.publicKey)).toString('base64url');
  const ownData = Buffer.from(JSON.stringify({ v: 'b', t: 'Free Party', d: '2026-12-24', p: 'Anywhere' })).toString('base64url');
  const ownDigest = Buffer.from(await webcrypto.subtle.digest('SHA-256', te.encode(ownData))).toString('base64url');
  const ownSig = Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, te.encode('wb1|lab-party-1|' + ownDigest))).toString('base64url');
  const kctx = await phone(browser, S2.url);
  await kctx.addInitScript(([u, k]) => { try { localStorage.setItem('wb.keys', JSON.stringify({ at: Date.now() + 10 * 365 * 86400000, url: u, keys: [k] })); } catch (e) {} }, [S2.url, attackerPub]);
  const kseen = track(kctx);
  const planted = await guestSees(kctx, P5.url + LAB + '#m=' + ownData + '&s=' + ownSig);
  const honest = await guestSees(kctx, link2.replace(':8081', ':8085'));
  check('keys.js still empty: a key planted in the browser "from the future" is ignored — a link signed with it is refused, a real one opens', planted === 'invalid' && honest === 'invitation' && kseen.service.some((x) => x.includes('/api/pubkey')), [planted, honest, kseen.service]);
  await kctx.close();
  await p2.reload(); await p2.waitForSelector('.wb-status');
  await p2.reload(); await p2.waitForSelector('.wb-status');
  check('limit 3: third opening still works', /opened 3 of 3/.test(await p2.textContent('.wb-status')));
  await p2.reload(); await p2.waitForSelector('main.wb-card h1');
  const expText = await p2.textContent('main.wb-card');
  check('(b) limit 3: the fourth opening shows "This link has expired"', /This link has expired/.test(expText) && /opened 3 times/.test(expText), expText.slice(0, 200));
  check('(A) expired page: button to the shop and "Message us on Etsy"', (await p2.getAttribute('a.wb-primary', 'href')) === 'https://wishberrystudiogifts.etsy.com' && /Message us on Etsy/.test(await p2.textContent('.wb-btns')));
  check('expired page reassures: files stay, sent links keep working', /files you downloaded from Etsy stay with you/.test(expText) && /already sent keeps working/.test(expText));
  await p2.screenshot({ path: path.join(SHOTS, '6-istekao-390.png'), fullPage: true });
  await p2.goto(P1.url + ENTRY); // comes back through START HERE: remembered link -> expired page again, no loop
  await p2.waitForSelector('main.wb-card h1');
  check('expired link + START HERE address -> the expired page (no endless redirect)', /This link has expired/.test(await p2.textContent('h1')));
  await p2.click('text=I have a new order number');
  await p2.waitForSelector('#wb-order');
  check('expired page: "I have a new order number" opens the form', true);
  await p2.fill('#wb-order', '1000000002'); await p2.click('#wb-gate button[type=submit]');
  await p2.waitForURL(HASH_URL); await p2.waitForFunction(() => /expired/.test((document.querySelector('main.wb-card h1') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  check('(c) the same order number again does NOT give a fresh link', p2.url() === h2 && /This link has expired/.test(await p2.textContent('h1')));

  const c3x = await phone(browser, S3.url);
  const p3 = await c3x.newPage();
  await activate(p3, P1.url, '1000000003');
  await p3.waitForURL(HASH_URL); await p3.waitForSelector('.wb-status');
  await fillParty(p3);
  const early = await makeLink(p3);
  check('short deadline: link made before the deadline', /&s=/.test(early));
  await sleep(5600);
  await p3.fill('#n', 'Changed after the deadline');
  await p3.click('#send');
  await p3.waitForFunction(() => !document.getElementById('linkerr').hidden, null, { timeout: 15000 });
  check('(c) after the deadline the open page cannot make a new link — plain message', /has expired/.test(await p3.textContent('#linkerr')) && (await p3.isHidden('#sendbox')));
  await p3.screenshot({ path: path.join(SHOTS, '7-istekao-tokom-rada-390.png') });
  await p3.reload(); await p3.waitForSelector('main.wb-card h1');
  check('(c) after the deadline the product link shows "This link has expired"', /This link has expired/.test(await p3.textContent('h1')));
  P1b: {
    const gctx = await phone(browser, 'http://127.0.0.1:8790');
    // keys served by P1 belong to S1; this link was signed by S3 (its own key), so check it against S3's key copy
    const P4 = await startPages(8084, REPO, S3.url);
    check('(5) an invitation sent BEFORE the product link expired still opens AFTER it expired', (await guestSees(gctx, early.replace(':8081', ':8084'))) === 'invitation');
    P4.stop(); await gctx.close();
  }

  // unknown addresses
  const cu = await phone(browser, S2.url);
  const pu = await cu.newPage();
  await pu.goto(P1.url + '/abcdefghijklmnopqrstuv'); await pu.waitForSelector('main.wb-card h1');
  check('(A) unknown hash -> "We can’t find this link"', /can.t find this link/.test(await pu.textContent('h1')));
  await pu.goto(P1.url + '/some/old/page.html'); await pu.waitForSelector('main.wb-card h1');
  check('(A) any other unknown address -> plain "Page not found"', /Page not found/.test(await pu.textContent('h1')));
  await pu.goto(P1.url + '/short'); await pu.waitForSelector('main.wb-card h1');
  check('(A) a short unknown address is not treated as a hash', /Page not found/.test(await pu.textContent('h1')));

  // another item in the same order
  const c4 = await phone(browser, S2.url);
  const p4 = await c4.newPage();
  await p4.goto(P3.url + ENTRY + '?new=1'); await p4.waitForSelector('#wb-gate');
  await p4.fill('#wb-order', '2000000050'); await p4.click('#wb-gate button[type=submit]');
  await p4.waitForSelector('.wb-other a');
  check('(K) order holds ANOTHER new product: the page says so and offers the right one', /different item/.test(await p4.textContent('.wb-err')) && /Other item/.test(await p4.textContent('.wb-other a')) && /^\/[A-Za-z0-9_-]{22}$/.test(await p4.getAttribute('.wb-other a', 'href')));

  // ================================================================== mode 'direct'
  section('Mode "direct" (reserve): the same files, one changed line, no service at all');
  check('(j) the switch is exactly ONE changed line in shared/config.js', changed === 1, changed);
  const cd = await phone(browser, null);
  const dseen = track(cd);
  const allReq = [];
  cd.on('request', (r) => allReq.push(r.url()));
  const pd = await cd.newPage();
  const derr = []; pd.on('pageerror', (e) => derr.push(e.message));
  await pd.goto(P2.url + ENTRY);
  await pd.waitForSelector('#send', { state: 'visible' });
  check('(j) direct: the entry address opens the maker at once — no order number, no status line', (await pd.locator('#wb-gate').count()) === 0 && (await pd.locator('.wb-status').count()) === 0);
  await fillParty(pd);
  await pd.waitForFunction(() => { try { return !!document.getElementById('pv').contentDocument.querySelector('.iface'); } catch (e) { return false; } });
  const dlink = await makeLink(pd);
  check('(j) direct: the invitation link has no signature', /\/product\/lab-party-1-2026-11-24\/#m=[A-Za-z0-9_-]+$/.test(dlink), dlink);
  const [dpop] = await Promise.all([cd.waitForEvent('page'), pd.click('.pb[data-size="a4"]')]);
  await dpop.waitForFunction(() => window.__printed > 0, null, { timeout: 15000 });
  await dpop.close();
  check('(j) direct: guest opens the unsigned link', (await guestSees(cd, dlink)) === 'invitation');
  check('(j) direct: a link that was signed earlier (in mode "hash") still opens', (await guestSees(cd, link.replace(':8081', ':8082'))) === 'invitation');
  check('(j) direct: the bare page address shows the sample invitation, as the old pages do', (await guestSees(cd, P2.url + LAB)) === 'invitation');
  const outside = allReq.filter((u) => !u.startsWith(P2.url) && !/fonts\.g/.test(u) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('about:'));
  check('(j) direct: NOT ONE request to the service on the whole path (maker, link, print, guest)', dseen.service.length === 0 && outside.length === 0, [dseen.service, outside]);
  check('(j) direct: no script error', derr.length === 0, derr);
  await pd.evaluate(() => window.scrollTo(0, 0));
  await pd.screenshot({ path: path.join(SHOTS, '8-direct-pravljenje-390.png') });
  // and back: the unsigned link is NOT accepted once the product is in mode 'hash'
  const cb = await phone(browser, 'http://127.0.0.1:8790');
  check('(j) back in mode "hash": an unsigned link from the direct period is refused — why the mode is chosen BEFORE the first sale', (await guestSees(cb, dlink.replace(':8082', ':8081'))) === 'invalid');
  const pb = await cb.newPage();
  await pb.goto(P1.url + ENTRY + '?new=1'); await pb.waitForSelector('#wb-gate');
  check('(j) back in mode "hash": the same entry address asks for the order number again', await pb.isVisible('#wb-order'));
  // a product link issued while in mode 'hash', opened after the switch to 'direct' -> simply the buyer address
  const cs = await phone(browser, S2.url);
  const ps = await cs.newPage();
  await ps.goto(P2.url + new URL(h2).pathname.replace(/.$/, (ch) => (ch === 'x' ? 'y' : 'x'))); await ps.waitForSelector('main.wb-card h1');
  const psH1 = await ps.textContent('h1');
  check('direct: an unknown /<hash> is still answered by the router', /can.t find this link|couldn.t open/.test(psH1), psH1);

  // ================================================================== old pages
  section('Published pages (old standard) are untouched');
  const names = execFileSync('git', ['-C', REPO, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }) + execFileSync('git', ['-C', REPO, 'diff', '--name-status', 'main', 'HEAD'], { encoding: 'utf8' });
  const touched = names.split('\n').filter(Boolean).filter((l) => !/^(A|\?\?)\s/.test(l) || /\s(christmas|birthday|christmas-gift|christmas-party|new-years-eve|video|lab)\//.test(l) || /\sindex\.html$/.test(l));
  // A NEW product with "Make it a video" has to put two things outside its own folder (PIPELINE §9 and §16, 25 Nov 2026):
  // its base video  video/<product>-base.mp4  (a file main does not have) and its own entry in the shared engine
  // video/videomaker.js — ADDED lines only. Both are allowed here; anything else in video/ is still an error, and the
  // engine is then probed below: an OLD card must come out the same with the engine of this branch as with the one on main.
  const onMain = (f) => { try { execFileSync('git', ['-C', REPO, 'cat-file', '-e', 'main:' + f], { stdio: 'ignore' }); return true; } catch (e) { return false; } };
  const newBaseVideo = (l) => { const m = /^\s?(?:A|M|\?\?)\s+(video\/[a-z0-9-]+-base\.mp4)$/.exec(l); return !!m && !onMain(m[1]); };
  const engineStat = execFileSync('git', ['-C', REPO, 'diff', '--numstat', 'main', '--', 'video/videomaker.js'], { encoding: 'utf8' }).trim().split(/\s+/);   // "added deleted path" of the working tree against main; empty = unchanged
  const engineChanged = engineStat.length >= 3;
  const engineOnlyAdds = engineChanged && engineStat[1] === '0' && Number(engineStat[0]) > 0;
  const allowed = (l) => /^\s?M\s+(service|shared|product)\/|^\s?M\s+404\.html/.test(l) || newBaseVideo(l) || (engineOnlyAdds && /^\s?M\s+video\/videomaker\.js$/.test(l));
  check('(g) git: no existing file is changed or removed; nothing is added inside the old product folders (a new product may add its own base video and ADD its entry to video/videomaker.js)', touched.filter((l) => !allowed(l)).length === 0, touched.filter((l) => !allowed(l)));
  const co = await phone(browser, S2.url);
  const oseen = track(co);
  const po = await co.newPage();
  await po.goto(P1.url + '/christmas-party/personalize-p8x5.html');
  await po.waitForSelector('#send', { state: 'visible' });
  await fillParty(po);
  const olink = await makeLink(po);
  check('(g) old Christmas Party buyer page: opens at once and makes its link exactly as before', /^http:\/\/127\.0\.0\.1:8081\/christmas-party\/#m=[A-Za-z0-9_-]+$/.test(olink), olink);
  check('(g) old invitation link opens for a guest', (await guestSees(co, olink)) === 'invitation');
  await po.goto(P1.url + '/christmas/personalize-k7q2.html');
  await po.waitForSelector('#send', { state: 'visible' });
  await po.fill('#to', 'Anna'); await po.click('#send');
  await po.waitForFunction(() => !document.getElementById('sendbox').hidden);
  const clink = await po.inputValue('#link');
  const cg = await co.newPage(); await cg.goto(clink); await cg.waitForSelector('#stage *');
  check('(g) old Christmas card buyer page and recipient page work as before', /\/christmas\/#m=/.test(clink));
  check('(g) the old pages make no request to the service', oseen.service.length === 0, oseen.service);
  await cg.close();
  if (engineChanged) {
    // the probe that goes with the allowance above: the old Christmas card makes its video twice — with the engine of this
    // branch and with the engine of main (served in its place) — and the two must agree: length, picture size, three frames.
    // The encoder is not byte-for-byte repeatable, so the pictures are compared, not the files. Needs a browser with H.264.
    let vb = null;
    try { vb = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome' }); } catch (e) { vb = null; }
    const mainEngine = execFileSync('git', ['-C', REPO, 'show', 'main:video/videomaker.js'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const oldCardVideo = async (engineText) => {
      const c = await phone(vb, S2.url);
      if (engineText) await c.route('**/video/videomaker.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: engineText }));
      const p = await c.newPage();
      await p.goto(P1.url + '/christmas/personalize-k7q2.html'); await p.waitForSelector('#send', { state: 'visible' });
      await p.fill('#to', 'Anna');
      if (!(await p.evaluate(() => !!(window.WishberryVideo && WishberryVideo.supported())))) { await c.close(); return { unsupported: true }; }
      await p.click('#mkvid');
      await p.waitForFunction(() => !document.getElementById('vdone').hidden || !document.getElementById('verr').hidden, null, { timeout: 180000 });
      const r = await p.evaluate(async () => {
        if (document.getElementById('vdone').hidden) return { err: document.getElementById('verr').textContent };
        const v = document.getElementById('vid'); v.pause();
        if (!(v.duration > 0)) await new Promise((res) => v.addEventListener('loadedmetadata', res, { once: true }));
        const cv = document.createElement('canvas'); cv.width = 180; cv.height = 320; const g = cv.getContext('2d', { willReadFrequently: true });
        const frames = [];
        for (const k of [0.3, 0.55, 0.85]) {
          await new Promise((res) => { v.addEventListener('seeked', res, { once: true }); v.currentTime = v.duration * k; });
          await new Promise((res) => setTimeout(res, 120));
          g.drawImage(v, 0, 0, 180, 320); const d = g.getImageData(0, 0, 180, 320).data; const grey = [];
          for (let i = 0; i < d.length; i += 4) grey.push(Math.round((d[i] + d[i + 1] + d[i + 2]) / 3));
          frames.push(grey);
        }
        return { duration: +v.duration.toFixed(2), w: v.videoWidth, h: v.videoHeight, frames };
      });
      await c.close(); return r;
    };
    if (!vb) check('(g) video engine probe: an old card makes the same video with the engine of this branch as with the engine of main', false, 'no Chrome with H.264 on this machine (/usr/bin/google-chrome) — the probe could not run');
    else {
      const a = await oldCardVideo(null), b = await oldCardVideo(mainEngine);
      await vb.close();
      if (a.unsupported || b.unsupported) check('(g) video engine probe: an old card makes the same video with the engine of this branch as with the engine of main', false, 'this browser cannot encode H.264 — the probe could not run');
      else if (a.err || b.err) check('(g) video engine probe: an old card makes the same video with the engine of this branch as with the engine of main', false, { branch: a.err || 'ok', main: b.err || 'ok' });
      else {
        // each frame pair: mean difference (0-255) and the share of pixels that differ strongly (> 32) — two encodings of the
        // same pictures differ by a little noise everywhere; a moved, missing or late line of text differs strongly in a few places
        const far = a.frames.map((f, i) => f.reduce((s, x, j) => s + Math.abs(x - b.frames[i][j]), 0) / f.length);
        const strong = a.frames.map((f, i) => f.reduce((s, x, j) => s + (Math.abs(x - b.frames[i][j]) > 32 ? 1 : 0), 0) / f.length);
        const seen = { branch: [a.duration, a.w, a.h], main: [b.duration, b.w, b.h], meanDifference: far.map((x) => +x.toFixed(2)), stronglyDifferentShare: strong.map((x) => +x.toFixed(4)) };
        console.log('  note  engine probe: ' + JSON.stringify(seen));
        check('(g) video engine probe: an old card (Christmas) makes the same video with the engine of this branch as with the engine of main — length, picture size, three frames',
          a.duration === b.duration && a.w === b.w && a.h === b.h && Math.max(...far) < 2.5 && Math.max(...strong) < 0.002, seen);
      }
    }
  }
} catch (e) {
  check('test run finished without an unexpected error', false, String(e && (e.stack || e)).slice(0, 800));
} finally {
  if (browser) await browser.close();
  for (const s of [S1, S2, S3]) if (s) await s.stop();
  for (const p of [P1, P2, P3, P5, P6, P7]) if (p) p.stop();
}
process.exit(summary() ? 0 : 1);
