// phone screenshots (390x844 @3x, touch) of the guest page and the buyer page for the listing images
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs');
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
async function ctxOf(b, base) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  let css = '';
  for (const st of ['normal', 'italic']) css += `@font-face{font-family:'Fraunces';font-style:${st};font-weight:100 900;font-display:block;src:url(${base}video/fonts/fraunces-latin-full-${st}.woff2) format('woff2');unicode-range:${LAT}}\n`;
  await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
  await ctx.route(/fonts\.gstatic\.com/, r => r.abort());
  return ctx;
}
const STEP = t => { for (const a of document.getAnimations()) { if (!window.__seen.has(a)) window.__seen.set(a, t); a.pause(); a.currentTime = Math.max(0, t - window.__seen.get(a)); } };
(async () => {
  const [what, out, m] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const F = 'product/new-years-eve-invitation-1-2026-11-27/';
  if (what === 'guest') {
    const base = 'http://127.0.0.1:8771/', ctx = await ctxOf(b, base), p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: 0 }); await p.clock.pauseAt(1000);
    await p.goto(base + F + 'index.html#autoplay=1&m=' + m, { waitUntil: 'load' });
    await p.waitForFunction(() => document.getElementById('stage').classList.contains('arrive'));
    if (!(await p.evaluate(() => document.fonts.check("500 14px 'Cinzel'")))) throw new Error('Cinzel not loaded');
    await p.evaluate(() => { window.__seen = new Map(); });
    let vt = 0;
    for (const t of (process.env.TIMES ? process.env.TIMES.split(',').map(Number) : [1300, 2900, 4500, 5500, 6300, 10000])) {
      while (vt < t) { const d = Math.min(100, t - vt); await p.clock.runFor(d); vt += d; await p.evaluate(STEP, vt); }
      await p.screenshot({ path: `${out}/guest-${String(t).padStart(5, '0')}.png` });
    }
    await p.evaluate(() => document.querySelector('.cbtn.yes').click()); await p.clock.runFor(100); vt += 100; await p.evaluate(STEP, vt);
    await p.screenshot({ path: `${out}/guest-reply.png` });
    await p.evaluate(() => { [...document.querySelectorAll('.choice .cbtn')].pop().click(); [...document.querySelectorAll('.crows .cbtn')].find(x => /calendar/.test(x.textContent)).click(); });
    await p.clock.runFor(100); vt += 100; await p.evaluate(STEP, vt);
    await p.screenshot({ path: `${out}/guest-calendar.png` });
    console.log('guest errors:', errs.length ? errs.join(' | ') : 0);
  } else if (what === 'gate') {
    const base = 'http://127.0.0.1:8772/', ctx = await ctxOf(b, base), p = await ctx.newPage();
    await p.goto(base + F + 'personalize-t8nz.html', { waitUntil: 'load' }); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}/buyer-gate.png` });
    const inp = await p.$('input'); if (inp) { await inp.fill('3456789012'); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/buyer-gate-filled.png` }); }
    console.log('gate text:', (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 700));
  } else {
    const base = 'http://127.0.0.1:8771/', ctx = await ctxOf(b, base), p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push('console: ' + x.text()); });
    await p.goto(base + F + 'personalize-t8nz.html', { waitUntil: 'load' });
    await p.waitForSelector('#t');
    await p.click('.dz[data-v="a"]'); await p.fill('#h', 'Emma & Jack'); await p.fill('#d', '2026-12-31'); await p.fill('#tm', '21:00'); await p.fill('#p', 'The Loft, 45 Harbor Street'); await p.fill('#n', 'Black tie optional. Champagne at midnight.');
    await p.fill('#r', 'Emma'); await p.fill('#c', '+1 555 014 2233'); await p.fill('#rd', '2026-12-27');
    await p.waitForTimeout(1500); await p.evaluate(async () => { await document.fonts.ready; document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); }); await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/buyer-top.png` });
    await p.evaluate(() => { document.getElementById('d').scrollIntoView({ block: 'start' }); window.scrollBy(0, -150); }); await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/buyer-form.png` });
    await p.evaluate(() => { navigator.share = undefined; });
    await p.click('#send'); await p.waitForFunction(() => !document.getElementById('sendbox').hidden, null, { timeout: 15000 }); await p.waitForTimeout(900);
    console.log('link:', await p.inputValue('#link'));
    await p.evaluate(() => { const l = document.getElementById('link'); l.value = l.value.replace(/^http:\/\/127\.0\.0\.1:\d+/, 'https://wishberrystudiogifts.github.io'); });   // the picture shows the real address, not the test server
    await p.evaluate(() => { document.getElementById('sendbox').scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); }); await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/buyer-send.png` });
    if (process.env.VIDEO) {
      const t0 = Date.now();
      await p.click('#mkvid');
      await p.waitForFunction(() => !document.getElementById('vdone').hidden || !document.getElementById('verr').hidden, null, { timeout: 240000 });
      const res = await p.evaluate(async () => {
        const err = document.getElementById('verr').hidden ? '' : document.getElementById('verr').textContent; if (err) return { err };
        const v = document.getElementById('vid'); const buf = await (await fetch(v.src)).arrayBuffer();
        let bin = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
        return { b64: btoa(bin) };
      });
      if (res.err) console.log('VIDEO ERROR: ' + res.err);
      else { fs.writeFileSync(`${out}/personal-video-${process.env.VIDEO}.mp4`, Buffer.from(res.b64, 'base64')); console.log('video made in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s'); }
      await p.evaluate(() => { const v = document.getElementById('vid'); v.pause(); v.currentTime = 10.5; }); await p.waitForTimeout(900);
      await p.evaluate(() => { document.getElementById('mkvid').scrollIntoView({ block: 'start' }); window.scrollBy(0, -60); }); await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/buyer-video.png` });
    }
    console.log('buyer errors:', errs.length ? errs.join(' | ') : 0);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
