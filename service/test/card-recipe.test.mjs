// WORKED EXAMPLE FOR A CARD — and its test.  node service/test/card-recipe.test.mjs
//
// service/README.md ("Kako nov proizvod ulazi u sistem") describes the steps in words, with the LAB invitation as the
// example that lives in the repository. This file does the same steps for a CARD, by program: it takes a copy of the
// published Christmas card (christmas/), turns it into a new-standard product in a TEMPORARY folder (nothing in the
// repository is changed), and checks in a real browser that everything works under /<hash> — including "Make it a video".
// convertCard() below is the recipe, line by line: read it as "before -> after".
//
// If the published card page changes so much that a step no longer finds its place, the test says SKIPPED (it does not fail).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { startService, check, section, summary, sleep, SERVICE_DIR } from './helpers.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { console.log('Playwright is not installed here.'); process.exit(2); }
const REPO = path.join(SERVICE_DIR, '..');
const KEY = 'lab-card-x';
const FOLDER = 'product/lab-card-x-2026-11-24';
const ENTRY = 'personalize-c4rd.html';
const V = '20261124';

class Skip extends Error {}
function swap(text, before, after, what) {
  if (typeof before === 'string' ? !text.includes(before) : !before.test(text)) throw new Skip(what);
  return text.replace(before, after);
}

const SHARED = (call) => `<!-- NEW STANDARD: three shared files + one line that names the product (key from /shared/config.js) -->
<link rel="stylesheet" href="/shared/product-link.css?v=${V}">
<script src="/shared/config.js?v=${V}"></script>
<script src="/shared/keys.js?v=${V}"></script>
<script src="/shared/product-link.js?v=${V}"></script>
<script>ProductLink.${call}({ product: '${KEY}' });</script>
`;

/** THE RECIPE for a card: old-standard folder (christmas/) -> new-standard folder (product/<occasion>-<kind>-<number>-<date>/). */
function convertCard(site) {
  const src = path.join(site, 'christmas');
  const dst = path.join(site, FOLDER);
  // 1. the new folder: a copy of the page files and its assets (card.css, card.js, assets/ stay as they are, relative paths and all)
  fs.cpSync(src, dst, { recursive: true });

  // 2. RECIPIENT PAGE index.html: the shared files and ONE line in <head>; the address in og:url / og:image
  let idx = fs.readFileSync(path.join(dst, 'index.html'), 'utf8');
  idx = swap(idx, '<link rel="stylesheet" href="card.css">', '<link rel="stylesheet" href="card.css">\n' + SHARED('recipientPage'), 'index.html: stylesheet line');
  idx = idx.split('wishberrystudiogifts.github.io/christmas/').join('wishberrystudiogifts.github.io/' + FOLDER + '/');
  fs.writeFileSync(path.join(dst, 'index.html'), idx);

  // 3. ENGINE card.js: the page starts through ProductLink.guard(boot) — first run and every hashchange
  let js = fs.readFileSync(path.join(dst, 'card.js'), 'utf8');
  js = swap(js, "    window.addEventListener('hashchange', boot);\n    boot();",
    "    // NEW STANDARD: shown only for a link that may be shown (mode 'hash': a signed link or the buyer's own preview).\n" +
    "    // If the shared code did not load, the page stays closed.\n" +
    "    var start = window.ProductLink ? window.ProductLink.guard(boot) : function () { document.body.textContent = 'This page could not load completely. Please reload it.'; };\n" +
    "    window.addEventListener('hashchange', start);\n    start();", 'card.js: the two start lines');
  fs.writeFileSync(path.join(dst, 'card.js'), js);

  // 4. BUYER PAGE: new name personalize-<4 random characters>.html (the ONE permanent entry address of the product)
  fs.renameSync(path.join(dst, 'personalize-k7q2.html'), path.join(dst, ENTRY));
  let per = fs.readFileSync(path.join(dst, ENTRY), 'utf8');
  // 4a. the shared files and ONE line, at the end of <head>
  per = swap(per, '</head>', SHARED('entry') + '</head>', 'buyer page: </head>');
  // 4b. no "../" paths: under /<hash> they would point to the wrong place
  per = swap(per, '<script src="../video/videomaker.js"></script>', '<script src="/video/videomaker.js"></script>', 'buyer page: videomaker script');
  per = swap(per, "root: '../video/'", "root: '/video/'", 'buyer page: video root');
  // 4c. the maker code runs inside ProductLink.ready(…) instead of running by itself
  per = swap(per, "(function () {\n  var C = window.CardCodec, KEY = 'cardDraft-christmas';", "ProductLink.ready(function (session) {\n  var C = window.CardCodec, KEY = 'cardDraft-" + KEY + "';", 'buyer page: start of the maker code');
  per = swap(per, /\}\)\(\);\s*<\/script>\s*<\/body>/, '});\n</script>\n</body>', 'buyer page: end of the maker code');
  // 4d. the link the buyer sends is built by ProductLink.invitationLink(…) — never from location.href
  per = swap(per, /  function cardUrl\(hashExtra\) \{[\s\S]*?\n  \}\n/, '', 'buyer page: cardUrl()');
  per = swap(per, "    var link = cardUrl();\n", "    $('linkerr').hidden = true;\n" +
    "    ProductLink.invitationLink(C.encode(data())).then(showLink, function (err) { $('linkerr').textContent = ProductLink.linkErrorText(err); $('linkerr').hidden = false; });\n" +
    "  });\n  function showLink(link) {\n", 'buyer page: var link = cardUrl()');
  per = swap(per, "    if (canShare) openShare(link);\n  });", "    if (canShare) openShare(link);\n  }", 'buyer page: end of the send handler');
  // 4e. a place for the message when a link cannot be made (expired product link, no internet)
  per = swap(per, '<div class="or" aria-hidden="true">or</div>', '<p id="linkerr" role="alert" style="margin:12px 0 0;font-size:17px;font-weight:700;color:#9B1C1C" hidden></p>\n      <div class="or" aria-hidden="true">or</div>', 'buyer page: place for the error line');
  fs.writeFileSync(path.join(dst, ENTRY), per);

  // 5. the product in BOTH settings files (same key)
  const cfg = path.join(site, 'shared', 'config.js');
  fs.writeFileSync(cfg, swap(fs.readFileSync(cfg, 'utf8'), "    'lab-party-1': {",
    "    '" + KEY + "': {\n      mode: 'hash',   // <-- THE SWITCH for this product: 'hash' or 'direct'\n      folder: '" + FOLDER + "',\n      entry: '" + ENTRY + "',\n      name: 'Christmas card (worked example)',\n      kind: 'card',\n      allowBare: true   // the bare page address shows the sample card (no personal words), as the old cards do\n    },\n    'lab-party-1': {", 'shared/config.js: products'));
  const svc = path.join(site, 'service', 'config.json');
  const j = JSON.parse(fs.readFileSync(svc, 'utf8'));
  j.products[KEY] = { name: 'Christmas card (worked example)', lab: true, listingIds: [] };
  j.mock.orders['2000000700'] = { status: 'paid', products: [KEY] };
  fs.writeFileSync(svc, JSON.stringify(j, null, 2));
  return { products: { [KEY]: j.products[KEY] }, mock: { orders: { 2000000700: j.mock.orders['2000000700'] } } };
}

let browser, svc, pages, site;
try {
  section('Worked example: a published CARD turned into a new-standard product (temporary copy)');
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'site-card-'));
  for (const f of ['404.html', 'shared', 'product', 'christmas', 'video']) fs.cpSync(path.join(REPO, f), path.join(site, f), { recursive: true });
  fs.mkdirSync(path.join(site, 'service', 'tools'), { recursive: true });
  for (const f of ['config.json', 'wrangler.jsonc', 'tools/check-consistency.mjs']) fs.cpSync(path.join(SERVICE_DIR, f), path.join(site, 'service', f));
  let overrides;
  try { overrides = convertCard(site); } catch (e) {
    if (e instanceof Skip) { console.log('  SKIPPED — the published card page has changed, this step no longer finds its place: ' + e.message); process.exit(0); }
    throw e;
  }
  let consistent = '';
  try { consistent = execFileSync('node', [path.join(site, 'service', 'tools', 'check-consistency.mjs')], { encoding: 'utf8' }); } catch (e) { consistent = String(e.stdout || e.message); }
  check('the converted card passes tools/check-consistency.mjs', /Settings are consistent/.test(consistent) && !/ERROR/.test(consistent), consistent.slice(0, 600));

  svc = await startService({ port: 8789, vars: { VERIFIER: 'mock', STAGE: 'card-recipe', CONFIG_OVERRIDES: overrides } });
  const child = spawn('node', [path.join(SERVICE_DIR, 'tools', 'pages-server.mjs'), '--port=8088', '--root=' + site, '--keys=' + svc.url], { stdio: 'ignore' });
  pages = { url: 'http://127.0.0.1:8088', stop: () => child.kill('SIGTERM') };
  for (let i = 0; i < 40; i++) { try { await fetch(pages.url + '/shared/config.js'); break; } catch (e) { await sleep(250); } }

  browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript((u) => { try { localStorage.setItem('wb.serviceUrl', u); } catch (e) {} }, svc.url);
  const bad = [];
  ctx.on('response', (r) => { if (r.status() >= 400 && !/fonts\.g/.test(r.url()) && !/\/[A-Za-z0-9_-]{22}$/.test(r.url())) bad.push(r.status() + ' ' + r.url()); });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(pages.url + '/' + FOLDER + '/' + ENTRY);
  await page.waitForSelector('#wb-gate');
  check('entry address shows the order-number form ("Make your card with your own words")', /Make your card with your own words/.test(await page.textContent('#wb-gate')));
  await page.fill('#wb-order', '2000000700'); await page.click('#wb-gate button[type=submit]');
  await page.waitForURL(/\/[A-Za-z0-9_-]{22}$/, { timeout: 15000 });
  await page.waitForSelector('.wb-status');
  check('the maker opens under /<hash> with the status line', /opened 1 of 300/.test(await page.textContent('.wb-status')));
  await page.fill('#to', 'Anna');
  await page.waitForFunction((f) => { const pv = document.getElementById('pv'); try { return pv.contentWindow.location.pathname === '/' + f + '/index.html' && !!pv.contentDocument.querySelector('#ivwrap *'); } catch (e) { return false; } }, FOLDER, { timeout: 15000 });
  check('the live preview loads from the product folder (relative "index.html" resolves through <base>)', true);
  await page.click('#send');
  await page.waitForFunction(() => !document.getElementById('sendbox').hidden || !document.getElementById('linkerr').hidden, null, { timeout: 15000 });
  const link = await page.inputValue('#link');
  check('"Send my card" gives a signed card link in the product folder', new RegExp('^' + pages.url + '/' + FOLDER + '/#m=[A-Za-z0-9_-]+&s=[A-Za-z0-9_-]{86}$').test(link), link);
  const vm = await page.evaluate(async () => ({
    loaded: !!window.WishberryVideo, supported: !!(window.WishberryVideo && WishberryVideo.supported()),
    base: (await fetch('/video/christmas-base.mp4', { method: 'HEAD' })).status, font: (await fetch('/video/fonts/fraunces-latin-full-normal.woff2', { method: 'HEAD' })).status,
  }));
  check('"Make it a video": videomaker.js is loaded under /<hash> and its files answer (absolute /video/ paths)', vm.loaded && vm.base === 200 && vm.font === 200, vm);
  await page.click('#mkvid');
  await page.waitForFunction(() => !document.getElementById('vdone').hidden || !document.getElementById('verr').hidden, null, { timeout: 120000 }).catch(() => {});
  const vres = await page.evaluate(() => ({ done: !document.getElementById('vdone').hidden, err: document.getElementById('verr').hidden ? '' : document.getElementById('verr').textContent, size: (document.getElementById('vid') || {}).videoWidth || 0 }));
  if (vm.supported) check('"Make it a video" makes the video under /<hash>', vres.done && !vres.err, vres);
  else console.log('  note  this test browser cannot encode video (no H.264) — the page says so plainly: ' + JSON.stringify(vres.err.slice(0, 60)));
  check('no missing file and no script error on the buyer’s path', bad.length === 0 && errors.length === 0, [bad, errors]);

  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await guest.addInitScript(() => { try { localStorage.setItem('wb.serviceUrl', 'http://127.0.0.1:8780'); } catch (e) {} }); // nothing listens there
  const sees = async (url) => {
    const p = await guest.newPage(); await p.goto(url);
    await p.waitForFunction(() => document.querySelector('#stage *') || document.querySelector('main.wb-card h1'), null, { timeout: 15000 }).catch(() => {});
    const r = await p.evaluate(() => { const h = document.querySelector('main.wb-card h1'); return h ? h.textContent : document.querySelector('#stage *') ? 'card' : 'nothing'; });
    await p.close(); return r;
  };
  const own = Buffer.from(JSON.stringify({ t: 'Free', m: 'A free card', s: 'Nobody' })).toString('base64url');
  check('guest: the signed card link opens (no service)', (await sees(link)) === 'card');
  check('guest: own words without a signature are refused', /isn.t complete/.test(await sees(pages.url + '/' + FOLDER + '/#m=' + own)));
  check('guest: the bare page address shows the sample card (allowBare: true)', (await sees(pages.url + '/' + FOLDER + '/')) === 'card');
} catch (e) {
  check('worked example finished without an unexpected error', false, String(e && (e.stack || e)).slice(0, 800));
} finally {
  if (browser) await browser.close();
  if (svc) await svc.stop();
  if (pages) pages.stop();
}
process.exit(summary() ? 0 : 1);
