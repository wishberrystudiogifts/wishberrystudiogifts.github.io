const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8771/product/new-years-eve-invitation-1-2026-11-27/index.html#m=' + process.argv[2]);
  await p.waitForFunction(() => document.getElementById('stage').classList.contains('still'), null, { timeout: 15000 });
  await p.waitForTimeout(400); await p.screenshot({ path: 'nye/rev/reduce-1.png' });
  await p.click('#stage'); await p.waitForFunction(() => document.getElementById('stage').classList.contains('done'), null, { timeout: 5000 });
  await p.waitForTimeout(500); await p.screenshot({ path: 'nye/rev/reduce-2.png' });
  const st = await p.evaluate(() => ({ txt: getComputedStyle(document.querySelector('#stage .itxt')).opacity, ctl: document.getElementById('controls').classList.contains('show'), sw: document.documentElement.scrollWidth, anims: document.getAnimations().filter(a => a.playState === 'running').length }));
  console.log('reduced motion:', JSON.stringify(st), 'errors', errs.length);
  // CPU 4x slower, normal motion: does the story still reach the end in order?
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); const q = await c2.newPage();
  const cdp = await c2.newCDPSession(q); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now(); await q.goto('http://127.0.0.1:8771/product/new-years-eve-invitation-1-2026-11-27/index.html#autoplay=1&m=' + process.argv[2]);
  await q.waitForFunction(() => document.getElementById('stage').classList.contains('arrive')); const t1 = Date.now();
  await q.waitForFunction(() => document.getElementById('stage').classList.contains('done'), null, { timeout: 30000 }); const t2 = Date.now();
  console.log('4x slower CPU: load to arrival', t1 - t0, 'ms; arrival to buttons', t2 - t1, 'ms (expected about 8600)');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
