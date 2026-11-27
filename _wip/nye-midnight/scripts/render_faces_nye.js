// the three faces with the sample details (the page's own lettering), 1500x2100: index.html#view=face at 480x672 x3.125
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const [outDir] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 480, height: 672 }, deviceScaleFactor: 3.125 });
  const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  let css = ''; for (const st of ['normal', 'italic']) css += `@font-face{font-family:'Fraunces';font-style:${st};font-weight:100 900;font-display:block;src:url(http://127.0.0.1:8771/video/fonts/fraunces-latin-full-${st}.woff2) format('woff2');unicode-range:${LAT}}\n`;
  await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: css })); await ctx.route(/fonts\.gstatic\.com/, r => r.abort());
  for (const v of ['a', 'b', 'c']) {
    const o = { v, t: 'New Year\u2019s Eve Party', h: 'Emma & Jack', d: '2026-12-31', tm: '21:00', p: 'The Loft, 45 Harbor Street', n: 'Black tie optional. Champagne at midnight.', r: 'Emma', c: '+1 555 014 2233', rd: '2026-12-27' };
    const m = Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8771/product/new-years-eve-invitation-1-2026-11-27/index.html#view=face&m=' + m, { waitUntil: 'load' });
    await p.waitForSelector('.iface .itxt'); await p.waitForTimeout(300);
    await p.evaluate(async () => { await document.fonts.load("500 14px 'Cinzel'"); await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => null))); });
    if (!(await p.evaluate(() => document.fonts.check("500 14px 'Cinzel'")))) throw new Error('Cinzel not loaded');
    await p.addStyleTag({ content: 'html,body{background:#000!important}.iface{box-shadow:none!important}.iface img.art{content:url(assets/print-' + v + '.jpg)}' });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${outDir}/face-${v}.png` }); await p.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
