/* Christmas Card 2 "Snowy Cabin" — recipient view + shared codec (24 Nov 2026).
   Text arrives inside the link (#m=...), is decoded in the browser and only ever inserted with textContent,
   so a crafted link cannot inject markup.
   The story (all of it belongs to this product only):
     1. ARRIVAL  — the winter wind carries the envelope in among blown snow; it flutters, its shadow follows it over
                   the snow, it settles in front of the cabin with a small puff and the name appears in ink.
     2. OPENING  — tap: the jute twine with the wax seal slips off, the flap lifts (paper turning on its fold, the
                   snowflake liner inside), warm light comes from inside.
     3. THE CARD — slides up OUT of the pocket: it sits between the inside back and the FRONT POCKET, which is a layer
                   of its own above the card, so the lower part of the card stays hidden until it is out.
     4. FINALE   — the envelope is gone, the card comes forward, turns over to the written side;
                   northern lights wake behind the firs and the cabin's glow spreads over the snow.
   Animation = CSS (transform/opacity only); this file builds the scene and switches the states. */
(function () {
  'use strict';
  var CFG = window.CARD_CONFIG || {};
  var A = CFG.assetBase || 'assets/';
  var LIMITS = { t: 40, m: 300, s: 60 };

  /* ---------- codec (shared with the editor) ---------- */
  function encode(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function clean(d) {
    d = d && typeof d === 'object' ? d : {};
    function s(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
    return { t: s(d.t, LIMITS.t).trim(), m: s(d.m, LIMITS.m).trim(), s: s(d.s, LIMITS.s).trim() };
  }
  function readHash() {
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    var data = {};
    if (p.get('m')) { try { data = decode(p.get('m')); } catch (e) { data = {}; } }
    data = clean(data);
    if (!data.m) data.m = CFG.defaultMessage || '';
    return { data: data, view: p.get('view') || '', autoplay: p.get('autoplay') === '1' };
  }
  window.CardCodec = { encode: encode, decode: decode, clean: clean, limits: LIMITS };

  /* ---------- tiny DOM helpers ---------- */
  function el(tag, cls, style, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) e.setAttribute('style', style);
    if (parent) parent.appendChild(e);
    return e;
  }
  function img(src, cls, style, parent) { var i = el('img', cls, style, parent); i.alt = ''; i.decoding = 'sync'; i.src = src; return i; }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(markup, w, h, parent, cls) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('width', w); s.setAttribute('height', h); s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('fill', 'none'); s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    s.innerHTML = markup; // static, trusted markup only
    parent.appendChild(s);
    return s;
  }
  function rnd(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* the string of eight lights from the cabin's eave (the same detail as on the front) and three sparks */
  var LIGHTS = (function () {
    var pts = [[14, 16], [66, 33], [120, 43], [174, 48], [226, 48], [280, 43], [334, 33], [386, 16]];
    var cols = ['#F2B24C', '#C24A4F', '#F2B24C', '#4C8A66', '#F2B24C', '#C24A4F', '#F2B24C', '#4C8A66'];
    var s = '<path d="M4 10 Q200 78 396 10" stroke="#3A4664" stroke-width="1.6" stroke-linecap="round"/>';
    pts.forEach(function (p, i) {
      s += '<circle cx="' + p[0] + '" cy="' + (p[1] + 11) + '" r="13" fill="' + cols[i] + '" opacity=".16"/>' +
        '<rect x="' + (p[0] - 3) + '" y="' + (p[1] - 1) + '" width="6" height="6" rx="1.5" fill="#3A4664"/>' +
        '<path d="M' + (p[0] - 5.5) + ' ' + (p[1] + 9) + ' q5.5 -7 11 0 q0 9 -5.5 12 q-5.5 -3 -5.5 -12z" fill="' + cols[i] + '"/>' +
        '<path d="M' + (p[0] - 2.4) + ' ' + (p[1] + 9.5) + ' q1 -2.6 3.2 -2.9" stroke="#FFF6DD" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>';
    });
    return s;
  })();
  var SPARKS = '<path d="M50 2l3.6 9.4L63 15l-9.4 3.6L50 28l-3.6-9.4L37 15l9.4-3.6z" fill="#C9A24B"/>' +
    '<path d="M16 9l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#C9A24B" opacity=".8"/><path d="M84 9l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#C9A24B" opacity=".8"/>';

  /* ---------- the written side of the card ---------- */
  function buildFace(parent, data) {
    var face = el('div', 'iface', null, parent);
    img(A + 'paper.jpg', 'paper', null, face);
    el('div', 'frame', null, face);
    svg(LIGHTS, 400, 74, face, 'orn-top');
    svg(SPARKS, 100, 30, face, 'orn-bot');
    var txt = el('div', 'itxt', null, face), inner = el('div', 'iin', null, txt);
    var g = el('div', 'greet', null, inner); if (data.t) g.textContent = 'Dear ' + data.t + ',';
    var m = el('div', 'msg', null, inner); m.textContent = data.m;
    var s = el('div', 'sign', null, inner); if (data.s) s.textContent = data.s;
    return { face: face, txt: txt, inner: inner };
  }
  function fitFace(f) { // shrink everything together until the words fit the paper (the video engine does exactly the same)
    var size = 10, guard = 0;
    f.txt.style.fontSize = size + 'px';
    while (f.inner.scrollHeight > f.txt.clientHeight + 1 && size > 6.5 && guard++ < 60) { size -= 0.25; f.txt.style.fontSize = size + 'px'; }
    return size;
  }
  function fitLabel(l) {
    var size = 30, guard = 0;   // l = the <span> inside .elabel
    l.style.fontSize = size + 'px';
    while (l.offsetWidth - 12 > 252 && size > 15 && guard++ < 40) { size -= 1; l.style.fontSize = size + 'px'; }   // 12 = the span's side padding
  }
  function whenFonts(cb) {
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load("500 30px Caveat"), document.fonts.load("700 30px Caveat"), document.fonts.load("700 20px 'Amatic SC'")]).then(cb, cb);
    } else cb();
  }

  /* ---------- layouts (stage units; the scene is the same picture, cropped for each) ---------- */
  var ENV = { W: 312, H: 430, cardS: 297 / 480, cardBottom: 424, rise: -430 };
  /* Two views of the same place: an upright picture for phones (and the vertical videos) and a wide one for computers
     (and the horizontal listing video). Numbers of each scene are in ITS picture's pixels. aur[0] = height of the
     northern-lights box = just above the bottom of the foreground layer (below it the lights would lie over the trees). */
  var SCENES = {
    tall: { bg: 'bg.jpg', fg: 'fg.webp', w: 1152, h: 2048, aur: [572, [-150, -30, 1452, 612], [-260, 60, 1600, 560], [60, -110, 1300, 560]],
      winglow: [180, 770, 780, 300], hearth: [-175, 500, 1500, 960], tint: [560, 1488], smoke: [456, 664] },
    wide: { bg: 'bg-land.jpg', fg: 'fg-land.webp', w: 1728, h: 1296, aur: [498, [-220, -70, 2160, 720], [-380, 30, 2460, 650], [90, -160, 1960, 680]],
      winglow: [690, 590, 720, 290], hearth: [270, 320, 1560, 950], tint: [800, 496], smoke: [1042, 546] }
  };
  var LAYOUTS = {
    port: { W: 600, H: 1100, scene: SCENES.tall, sk: 1100 / 2048, sx: -9.375, sy: 0, env: { e: 1.15, cx: 300, bottom: 1050 },
      card: { s: 1.1, cx: 300, cy: 525 }, hintY: 1061, hintSize: 25 },
    land: { W: 1200, H: 900, scene: SCENES.wide, sk: 1200 / 1728, sx: 0, sy: 0, env: { e: 0.92, cx: 425, bottom: 868 },
      card: { s: 1.16, cx: 425, cy: 448 }, hintY: 872, hintSize: 22 }
  };
  var IMAGES = ['env-pocket.webp', 'env-back.webp', 'env-flap.webp', 'env-flapin.webp', 'env-flapshadow.png',
    'env-bundle.webp', 'env-snow.webp', 'env-dropshadow.png', 'front.jpg', 'paper.jpg', 'aurora-a.webp', 'aurora-b.webp', 'smoke.webp'];
  var T = { landed: 2100, autoplay: 2300, controls: 4400 };   // ms; all on the 100 ms grid (frame-by-frame video render)

  var stageEl = document.getElementById('stage');
  var ivwrap = document.getElementById('ivwrap');
  var state = { timers: [], L: null, data: null, face: null, landed: false, opened: false, pending: false, ready: false };

  function pickLayout() { return (window.innerWidth / window.innerHeight) < 0.9 ? LAYOUTS.port : LAYOUTS.land; }
  function scaleStage() {
    var L = state.L; if (!L) return;
    var s = Math.min(window.innerWidth / L.W, window.innerHeight / L.H);
    stageEl.style.width = L.W + 'px'; stageEl.style.height = L.H + 'px';
    stageEl.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
  }

  function build(data) {
    var L = pickLayout(); state.L = L; state.data = data;
    stageEl.innerHTML = '';
    stageEl.className = '';
    var W = L.W, H = L.H, e = L.env.e, i, r = rnd(24);
    var envLeft = L.env.cx - ENV.W * e / 2, envTop = L.env.bottom - ENV.H * e;

    // scene: the picture, northern lights BEHIND the firs (the foreground layer has a transparent sky), glows, chimney smoke
    var S = L.scene;
    function box(b) { return 'left:' + b[0] + 'px;top:' + b[1] + 'px;width:' + b[2] + 'px;height:' + b[3] + 'px'; }
    var sc = el('div', 'scene', 'width:' + S.w + 'px;height:' + S.h + 'px;transform:translate(' + L.sx + 'px,' + L.sy + 'px) scale(' + L.sk + ')', stageEl);
    img(A + S.bg, 'bg', 'width:' + S.w + 'px;height:' + S.h + 'px', sc);
    var aur = el('div', 'aur', 'width:' + S.w + 'px;height:' + S.aur[0] + 'px', sc);
    img(A + 'aurora-a.webp', null, null, el('div', 'al a1', box(S.aur[1]), aur));
    img(A + 'aurora-b.webp', null, null, el('div', 'al a2', box(S.aur[2]), aur));
    img(A + 'aurora-a.webp', null, null, el('div', 'al a3', box(S.aur[3]) + ';transform:scaleX(-1)', aur));
    img(A + S.fg, 'fg', 'width:' + S.w + 'px', sc);
    el('div', 'tint', 'top:' + S.tint[0] + 'px;width:' + S.w + 'px;height:' + S.tint[1] + 'px', sc);
    el('div', 'winglow', box(S.winglow), sc);
    el('div', 'hearth', box(S.hearth), sc);
    var sm = el('div', 'smokes', 'left:' + S.smoke[0] + 'px;top:' + S.smoke[1] + 'px', sc);
    for (i = 0; i < 3; i++) img(A + 'smoke.webp', null, null, sm);

    // blown snow of the arrival
    var gust = el('div', 'gust', null, stageEl);
    for (i = 0; i < 30; i++) {
      var sz = 3 + r() * 8, y0 = -80 + r() * H * 0.78, dy = 90 + r() * 240, big = sz > 8.5;
      el('i', null, 'width:' + sz.toFixed(1) + 'px;height:' + sz.toFixed(1) + 'px;' + (big ? 'filter:blur(1.2px);' : '') +
        '--x0:' + Math.round(-60 - r() * 160) + 'px;--y0:' + Math.round(y0) + 'px;' +
        '--x1:' + Math.round(W * (0.3 + r() * 0.3)) + 'px;--y1:' + Math.round(y0 + dy * (0.35 + r() * 0.3)) + 'px;' +
        '--x2:' + Math.round(W + 40 + r() * 80) + 'px;--y2:' + Math.round(y0 + dy) + 'px;' +
        '--o:' + (0.5 + r() * 0.45).toFixed(2) + ';--d:' + (1.05 + r() * 0.6).toFixed(2) + 's;--dl:' + (r() * 1.15).toFixed(2) + 's', gust);
    }

    // envelope
    var root = el('div', 'envroot', 'left:' + envLeft + 'px;top:' + envTop + 'px;transform:scale(' + e + ')', stageEl);
    el('div', 'fshadow', null, root);
    img(A + 'env-dropshadow.png', 'gshadow', null, root);
    var envB = el('div', 'envB', null, root);
    img(A + 'env-back.webp', 'eback', null, envB);
    el('div', 'inglow', null, envB);
    var fbB = el('div', 'flapBbox', null, envB), flapB = el('div', 'flapB', null, fbB);
    img(A + 'env-flapin.webp', 'flapin', null, flapB);

    // card: front = the picture, back = the written side
    var rig = el('div', 'cardrig', null, root);
    var c3 = el('div', 'card3d', null, el('div', 'cardpersp', null, rig));
    var front = el('div', 'cface front', null, c3);
    img(A + 'front.jpg', null, null, front); el('div', 'gloss', null, front);
    var back = el('div', 'cface backside', null, c3);
    var face = buildFace(back, data); state.face = face;

    // front of the envelope: pocket (its own layer ABOVE the card), name, flap, twine with seal
    var envF = el('div', 'envF', null, root);
    var fr = el('div', 'fr', null, el('div', 'fy', null, el('div', 'fx', null, envF)));
    img(A + 'env-pocket.webp', 'epocket', null, fr);
    var label = el('span', null, null, el('span', 'lw', null, el('div', 'elabel', null, fr)));
    label.textContent = data.t ? ('For ' + data.t) : 'With love';
    img(A + 'env-flapshadow.png', 'flapsh', null, fr);
    img(A + 'env-flap.webp', 'flap', null, el('div', 'flapFbox', null, fr));
    img(A + 'env-bundle.webp', 'bundle', null, fr);
    img(A + 'env-snow.webp', 'esnow', null, fr);
    el('div', 'fshade', null, fr);   // the paper darkens and brightens as it turns in the air
    var puff = el('div', 'puff', null, root);
    for (i = 0; i < 30; i++) {   // landing: a fine spray of snow grains along the bottom edge (grains, not discs)
      var px = 4 + r() * 304, ps = 2.5 + r() * 6.5;
      el('i', null, 'left:' + px.toFixed(0) + 'px;top:' + (419 + r() * 12).toFixed(0) + 'px;width:' + ps.toFixed(1) + 'px;height:' + ps.toFixed(1) + 'px;margin:' + (-ps / 2).toFixed(1) + 'px 0 0 ' + (-ps / 2).toFixed(1) + 'px;' +
        '--px:' + Math.round((px - 156) * 0.42 + (r() * 2 - 1) * 22) + 'px;--py:' + Math.round(-(6 + r() * 44)) + 'px;animation-delay:' + (1.96 + r() * 0.12).toFixed(2) + 's', puff);
    }

    // card geometry for this layout (envelope units)
    var c1 = L.card.s / e;
    var fx = (L.card.cx - envLeft) / e - ENV.W / 2;
    var fy = (L.card.cy + 672 * L.card.s / 2 - envTop) / e - ENV.cardBottom;
    stageEl.style.setProperty('--c0', ENV.cardS.toFixed(5));
    stageEl.style.setProperty('--c1', c1.toFixed(5));
    stageEl.style.setProperty('--rise', ENV.rise + 'px');
    stageEl.style.setProperty('--fx', fx.toFixed(2) + 'px');
    stageEl.style.setProperty('--fy', fy.toFixed(2) + 'px');

    // finale helpers
    var hs = 560 * e;
    el('div', 'halo', 'left:' + (L.env.cx - hs / 2) + 'px;top:' + (envTop + 70 * e - hs / 2) + 'px;width:' + hs + 'px;height:' + hs + 'px', stageEl);
    var emb = el('div', 'embers', null, stageEl);
    for (i = 0; i < 14; i++) {
      var side = i % 2 ? 1 : -1, ex = W / 2 + side * W * (0.30 + r() * 0.19), es = 5 + r() * 5;
      el('i', null, 'left:' + ex.toFixed(0) + 'px;top:' + (H * (0.62 + r() * 0.34)).toFixed(0) + 'px;width:' + es.toFixed(1) + 'px;height:' + es.toFixed(1) + 'px;' +
        '--ex:' + Math.round((r() * 2 - 1) * 46) + 'px;--ey:' + Math.round(-(200 + r() * 300)) + 'px;--o:' + (0.55 + r() * 0.4).toFixed(2) +
        ';--d:' + (3.4 + r() * 2.4).toFixed(1) + 's;--dl:' + (2.2 + r() * 4.2).toFixed(1) + 's', emb);
    }
    var hint = el('div', 'hint', 'top:' + L.hintY + 'px;font-size:' + L.hintSize + 'px', stageEl);
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    hint.textContent = (coarse ? 'Tap' : 'Click') + ' the envelope to open';

    state.label = label;
    scaleStage();
    fitFace(face); fitLabel(label);
    whenFonts(function () { fitFace(face); fitLabel(label); });
  }

  /* ---------- states ---------- */
  function clearTimers() { state.timers.forEach(clearTimeout); state.timers = []; }
  function later(fn, ms) { state.timers.push(setTimeout(fn, ms)); }
  function controls(show) { var c = document.getElementById('controls'); if (c) c.classList.toggle('show', !!show); }

  function arrive() {   // the envelope flies in; called only when its pictures are decoded
    clearTimers();
    state.landed = false; state.opened = false;
    stageEl.classList.remove('open', 'landed', 'still', 'instant', 'done', 'arrive');
    controls(false);
    void stageEl.offsetWidth;
    stageEl.classList.add('arrive');
    later(function () {
      state.landed = true; stageEl.classList.add('landed');
      if (state.pending) { state.pending = false; open(); }
    }, T.landed);
    if (state.autoplay) later(open, T.autoplay);
  }
  function still() {    // reduced motion: the envelope is already there
    clearTimers();
    stageEl.classList.remove('open', 'arrive', 'instant', 'done');
    stageEl.classList.add('still', 'landed');
    state.landed = true; state.opened = false;
    controls(false);
  }
  function open() {
    if (state.opened || !state.ready) return;
    if (!state.landed) { state.pending = true; stageEl.classList.add('wait'); return; }
    state.opened = true;
    stageEl.classList.remove('wait');
    if (state.reduce) stageEl.classList.add('instant');
    stageEl.classList.add('open');
    later(function () { stageEl.classList.add('done'); controls(true); }, state.reduce ? 300 : T.controls);
  }
  function preload() {  // the arrival never starts with a half-loaded envelope
    var jobs = IMAGES.concat([state.L.scene.bg, state.L.scene.fg]).map(function (n) {
      return new Promise(function (res) {
        var i = new Image();
        i.onload = function () { (i.decode ? i.decode() : Promise.resolve()).then(res, res); };
        i.onerror = res;
        i.src = A + n;
      });
    });
    var fonts = new Promise(function (res) { whenFonts(res); });
    var limit = new Promise(function (res) { setTimeout(res, 6000); });
    return Promise.race([Promise.all(jobs.concat([fonts])), limit]);
  }

  /* ---------- written-side-only view (editor live preview, video engine) ---------- */
  function buildFaceView(data) {
    document.body.classList.add('inside-view'); document.documentElement.classList.add('inside-view');
    ivwrap.innerHTML = '';
    var f = buildFace(ivwrap, data);
    function sc() { var s = Math.min(window.innerWidth / 480, window.innerHeight / 672); ivwrap.style.transform = 'translate(-50%,-50%) scale(' + s + ')'; }
    sc(); window.onresize = sc;
    fitFace(f);
    whenFonts(function () { fitFace(f); });
  }

  /* ---------- boot ---------- */
  function boot() {
    var h = readHash();
    if ((h.view === 'face' || h.view === 'inside') && ivwrap) { buildFaceView(h.data); return; }
    if (!stageEl) return;
    state.autoplay = h.autoplay; state.ready = false; state.pending = false;
    state.reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    build(h.data);
    preload().then(function () {
      state.ready = true;
      fitFace(state.face); fitLabel(state.label);
      if (state.reduce) still(); else arrive();
    });
  }
  if (stageEl || ivwrap) {
    if (stageEl) {
      stageEl.addEventListener('click', open);
      stageEl.setAttribute('role', 'button'); stageEl.setAttribute('tabindex', '0');
      stageEl.setAttribute('aria-label', 'Open the card');
      stageEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      var rp = document.getElementById('replay');
      if (rp) rp.addEventListener('click', function () { if (!state.ready) return; state.autoplay = true; if (state.reduce) { still(); open(); } else arrive(); });
      var shop = document.getElementById('shop');
      if (shop && CFG.shopUrl) { shop.href = CFG.shopUrl; shop.target = '_blank'; shop.rel = 'noopener'; shop.hidden = false; }
      window.addEventListener('resize', function () {
        if (!state.data || document.body.classList.contains('inside-view')) return;
        var L = pickLayout();
        if (L !== state.L && !state.opened) { boot(); } else { scaleStage(); }
      });
    }
    // NEW STANDARD: shown only for a link that may be shown (mode 'hash': a signed link or the buyer's own preview;
    // mode 'direct': every link). If the shared code did not load, the page stays closed.
    var start = window.ProductLink ? window.ProductLink.guard(boot) : function () { document.body.textContent = 'This page could not load completely. Please reload it.'; };
    window.addEventListener('hashchange', start);
    start();
  }
})();
