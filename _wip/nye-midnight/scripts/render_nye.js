// Frame-by-frame render of the guest page of the New Year's Eve invitation "Midnight" (27 Nov 2026; from render-party-door.js) - after render-page-frames.js
// (20/24 Nov) and render-b2.js (24/25 Nov): Playwright's fake clock drives the page's timers; after every step every
// animation is paused and set to (frame time - the frame time at which it was first seen). The page starts by itself
// (#autoplay=1: arrival at once, the tap at 3.0 s), so nothing is clicked. All timers are on the 100 ms grid.
// H.264 CRF 18, one key frame, BT.709 matrix + tags, yuv420p, faststart, no audio.
// Usage: node render.js <url> <out.mp4> <w> <h> [seconds=12.4] [extraCss]
//   X264_EXTRA=bframes=0  (base video of "Make it a video")   MEASURE=<file.json> (rect of .iface + opacity of .itxt per frame)
//   FILL=1.8  scale of the 600x1100 stage (9:16 frame: 1.8 fills 1080 wide, 30 px cut top and bottom; no side bars)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8771/';
(async () => {
  const [url, out, w, h, secArg, extraCss] = process.argv.slice(2);
  const W = +w, H = +h, FPS = 30, SEC = +(secArg || 12.4), N = Math.round(FPS * SEC);
  const X264 = 'keyint=9999:min-keyint=9999:scenecut=0' + (process.env.X264_EXTRA ? ':' + process.env.X264_EXTRA : '');
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  try {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
    let css = '';
    for (const st of ['normal', 'italic']) css += `@font-face{font-family:'Fraunces';font-style:${st};font-weight:100 900;font-display:block;src:url(${BASE}video/fonts/fraunces-latin-full-${st}.woff2) format('woff2');unicode-range:${LAT}}\n`;
    await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
    await ctx.route(/fonts\.gstatic\.com/, r => r.abort());
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.clock.install({ time: 0 }); await p.clock.pauseAt(1000);
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForFunction(() => document.getElementById('stage').classList.contains('arrive'), null, { timeout: 20000 });
    const fill = process.env.FILL ? `#stage{transform:translate(-50%,-50%) scale(${process.env.FILL})!important}` : '';
    await p.addStyleTag({ content: '.hint{display:none!important}' + fill + (extraCss || '') });
    for (const f of ["500 14px 'Cinzel'", "500 16px 'Cormorant Garamond'"]) if (!(await p.evaluate(f => document.fonts.check(f), f))) throw new Error('font not loaded: ' + f);
    await p.evaluate(() => { window.__seen = new Map(); });
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-x264-params', X264,
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=bicubic+accurate_rnd+full_chroma_int,format=yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
    let vt = 0; const measure = []; const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      const t = Math.round((i * 1000) / FPS * 1000) / 1000;
      if (t > vt) { await p.clock.runFor(t - vt); vt = t; }
      await p.evaluate(t => { for (const a of document.getAnimations()) { if (!window.__seen.has(a)) window.__seen.set(a, t); a.pause(); a.currentTime = Math.max(0, t - window.__seen.get(a)); } }, t);
      if (process.env.MEASURE) measure.push(await p.evaluate(t => {
        const f = document.querySelector('#stage .iface'), x = document.querySelector('#stage .itxt'), r = f.getBoundingClientRect();
        return { t: t / 1000, x: +r.left.toFixed(3), y: +r.top.toFixed(3), w: +r.width.toFixed(3), h: +r.height.toFixed(3), a: +(+getComputedStyle(x).opacity).toFixed(4) };
      }, t));
      const buf = await p.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 93 === 0) console.log(`frame ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end(); await done;
    if (process.env.MEASURE) fs.writeFileSync(process.env.MEASURE, JSON.stringify(measure));
    console.log(`MP4 ${out} frames=${N} pageErrors=${errs.length ? errs.join(' | ') : 0}`);
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exit(1); });
