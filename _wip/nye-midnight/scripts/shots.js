// frame shots of the guest page at given times (ms), with Playwright's fake clock (same stepping as the video render)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [url, w, h, timesArg, outPrefix, scaleArg, extraCss] = process.argv.slice(2);
  const times = timesArg.split(',').map(Number);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(scaleArg || 1), reducedMotion: process.env.REDUCE ? 'reduce' : 'no-preference', hasTouch: !!process.env.TOUCH });
  const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  let css = '';
  for (const st of ['normal', 'italic']) css += `@font-face{font-family:'Fraunces';font-style:${st};font-weight:100 900;font-display:block;src:url(http://127.0.0.1:8771/video/fonts/fraunces-latin-full-${st}.woff2) format('woff2');unicode-range:${LAT}}\n`;
  await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
  await ctx.route(/fonts\.gstatic\.com/, r => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('requestfailed', r => errs.push('failed: ' + r.url()));
  await p.clock.install({ time: 0 }); await p.clock.pauseAt(1000);
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => { const s = document.getElementById('stage'); return s && (s.classList.contains('arrive') || s.classList.contains('still')); }, null, { timeout: 15000 });
  if (extraCss) await p.addStyleTag({ content: extraCss });
  await p.evaluate(() => { window.__seen = new Map(); });
  let vt = 0;
  for (const t of times) {
    // step in 100 ms pieces so timers and animations are seen as in the video render
    while (vt < t) { const d = Math.min(100, t - vt); await p.clock.runFor(d); vt += d;
      await p.evaluate(t => { for (const a of document.getAnimations()) { if (!window.__seen.has(a)) window.__seen.set(a, t); a.pause(); a.currentTime = Math.max(0, t - window.__seen.get(a)); } }, vt); }
    await p.evaluate(t => { for (const a of document.getAnimations()) { if (!window.__seen.has(a)) window.__seen.set(a, t); a.pause(); a.currentTime = Math.max(0, t - window.__seen.get(a)); } }, vt);
    await p.screenshot({ path: `${outPrefix}-${String(t).padStart(5, '0')}.png` });
  }
  console.log('errors:', errs.length ? errs.join(' | ') : 0);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
