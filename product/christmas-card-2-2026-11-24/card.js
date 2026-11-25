/* Christmas Card 2 "Snowy Cabin" — recipient view + shared codec (24 Nov 2026; scene and finale redone 25 Nov 2026).
   Text arrives inside the link (#m=...), is decoded in the browser and only ever inserted with textContent,
   so a crafted link cannot inject markup.
   ONE story — "a letter that comes home" (all of it belongs to this product only):
     the card's picture shows the cabin from afar; the scene is the DOORSTEP of that cabin, seen from above.
     1. ARRIVAL  — the winter wind slides the envelope in over the porch boards from the right: a low flight, it touches,
                   slides, takes one short hop and comes to rest, turned a few degrees; powder snow streams past, a few
                   grains stay on the boards and a little snow is left against its windward edge; then the name appears.
     2. OPENING  — tap: the jute twine with the wax seal slips off, the flap lifts (paper turning on its fold, the
                   snowflake liner inside), warm light comes from inside.
     3. THE CARD — slides up OUT of the pocket: it sits between the inside back and the FRONT POCKET, which is a layer
                   of its own above the card, so the lower part of the card stays hidden until it is out.
     4. FINALE   — the envelope is gone, the card comes forward and turns over to the written side; the lantern flame
                   flares and its warm light spreads over the boards, while frost draws crystal ferns on the wood
                   around the card — everywhere except where the lantern's warmth reaches; ice glints; calm flicker.
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

  /* ---------- layouts (stage units; two pictures of the same place, one upright, one wide) ---------- */
  var ENV = { W: 312, H: 430, cardS: 297 / 480, cardBottom: 424, rise: -430 };
  /* Scene numbers are in the picture's own pixels; everything else is in stage units. flame = the candle flame,
     lr = radius of the lantern's glow, glints = [x, y, birth 0..1] of the ice sparks (tips of the frost crystals;
     written by project/tools/build-frost-b2.py together with the six frost layers). */
  var SCENES = {
    tall: { bg: 'bg.jpg', lit: ['bg-lit-near.webp', 'bg-lit-far.webp'], frost: 'frost', w: 1152, h: 2048 },
    wide: { bg: 'bg-land.jpg', lit: ['bg-land-lit-near.webp', 'bg-land-lit-far.webp'], frost: 'frost-land', w: 1728, h: 1296 }
  };
  var LAYOUTS = {
    port: { W: 600, H: 1100, scene: SCENES.tall, sk: 1100 / 2048, sx: -9.375, sy: 0, flame: [54.5, 132.5], lr: 190,
      env: { e: 1, cx: 290, cy: 690, rot: 3 }, card: { s: 1.05, cx: 300, cy: 560 }, hintY: 958, hintSize: 25,
      glints: [[478.7,173.9,0.928],[340.1,1010.3,0.737],[121.5,998.2,0.924],[18.6,955.3,0.283],[499.7,979.7,0.94],[499.8,99.0,0.694],[19.4,586.8,0.427],[568.5,500.7,0.608],[550.0,919.3,0.873],[580.5,623.8,0.502],[307.4,954.6,0.863],[101.3,940.5,0.739],[222.0,974.5,0.962],[587.7,225.4,0.47],[586.4,319.9,0.357],[21.4,754.9,0.378]] },
    land: { W: 1200, H: 900, scene: SCENES.wide, sk: 1200 / 1728, sx: 0, sy: 0, flame: [239.6, 302.1], lr: 250,
      env: { e: 0.9, cx: 600, cy: 640, rot: 3 }, card: { s: 1.02, cx: 600, cy: 450 }, hintY: 850, hintSize: 22,
      glints: [[812.8,61.1,1.0],[559.0,812.5,0.442],[508.0,844.2,0.401],[902.0,89.4,0.705],[991.6,178.1,1.0],[943.3,807.0,1.0],[1002.2,710.5,0.982],[1034.4,243.7,0.93],[1019.6,833.4,0.904],[675.2,84.1,0.44],[874.6,679.3,0.899],[187.6,750.6,1.0],[1127.0,516.6,1.0],[854.7,849.9,0.917],[1071.4,88.8,0.915],[1013.0,390.0,0.965]] }
  };
  var FROST_N = 6;
  // needed before the envelope may arrive / needed only after the tap (loaded meanwhile, never block the arrival)
  var IMAGES = ['env-pocket.webp', 'env-back.webp', 'env-flap.webp', 'env-flapin.webp', 'env-flapshadow.png',
    'env-bundle.webp', 'env-dropshadow.png', 'env-flapbshadow.png', 'env-drift.webp', 'front.jpg'];
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
  function lateImages(L) {
    var a = L.scene.lit.concat(['paper.jpg']);
    for (var k = 1; k <= FROST_N; k++) a.push(L.scene.frost + '-' + k + '.webp');
    return a;
  }

  function build(data) {
    var L = pickLayout(); state.L = L; state.data = data;
    stageEl.innerHTML = '';
    stageEl.className = '';
    var W = L.W, H = L.H, e = L.env.e, i, r = rnd(25);
    var th = L.env.rot * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
    function toStage(x, y) {   // envelope units -> stage units (the envelope is scaled and turned about its centre)
      var dx = (x - ENV.W / 2) * e, dy = (y - ENV.H / 2) * e;
      return [L.env.cx + dx * cs - dy * sn, L.env.cy + dx * sn + dy * cs];
    }

    // scene: the picture and the same picture in lantern light (near pool + far wash)
    var S = L.scene;
    var sc = el('div', 'scene', 'width:' + S.w + 'px;height:' + S.h + 'px;transform:translate(' + L.sx + 'px,' + L.sy + 'px) scale(' + L.sk + ')', stageEl);
    img(A + S.bg, 'bg', 'width:' + S.w + 'px;height:' + S.h + 'px', sc);
    img(A + S.lit[0], 'lit near', 'width:' + S.w + 'px;height:' + S.h + 'px', sc);
    img(A + S.lit[1], 'lit far', 'width:' + S.w + 'px;height:' + S.h + 'px', sc);
    // the lantern's living flame
    var lant = el('div', 'lant', 'left:' + L.flame[0] + 'px;top:' + L.flame[1] + 'px', stageEl);
    [['g1', 1], ['g2', 0.55], ['core', 0.2]].forEach(function (g) {
      var rr = L.lr * g[1];
      el('i', g[0], 'left:' + (-rr) + 'px;top:' + (-rr) + 'px;width:' + (2 * rr) + 'px;height:' + (2 * rr) + 'px', lant);
    });
    // frost (six layers by birth time) and its ice glints
    var frost = el('div', 'frost', null, stageEl);
    for (i = 1; i <= FROST_N; i++) img(A + S.frost + '-' + i + '.webp', null, 'animation-delay:' + (2.1 + (i - 1) * 0.5).toFixed(1) + 's', frost);
    var gl = el('div', 'glints', null, stageEl);
    L.glints.forEach(function (g) {
      var sv = svg('<circle cx="15" cy="15" r="6" fill="#fff" opacity=".35"/><path d="M15 0l1.7 13.3L30 15l-13.3 1.7L15 30l-1.7-13.3L0 15l13.3-1.7z" fill="#fff"/>', 30, 30, gl);
      var size = 0.45 + r() * 0.75;
      sv.setAttribute('style', 'left:' + g[0] + 'px;top:' + g[1] + 'px;width:' + (30 * size).toFixed(1) + 'px;height:' + (30 * size).toFixed(1) + 'px;margin:' + (-15 * size).toFixed(1) + 'px 0 0 ' + (-15 * size).toFixed(1) + 'px;' +
        '--o:' + (0.65 + r() * 0.35).toFixed(2) + ';--d:' + (2.6 + r() * 2.2).toFixed(1) + 's;--dl:' + (2.5 + g[2] * 2.9 + r() * 0.5).toFixed(2) + 's');
    });

    // grains of snow the wind leaves on the boards (to windward of the envelope and along its way)
    var grains = el('div', 'grains', null, stageEl);
    for (i = 0; i < 16; i++) {
      var lee = i % 4 === 0, gp = toStage(lee ? -12 - r() * 46 : ENV.W + 16 + r() * 150, -40 + r() * 500), gs = 2 + r() * 3.6;
      el('i', null, 'left:' + gp[0].toFixed(0) + 'px;top:' + gp[1].toFixed(0) + 'px;width:' + gs.toFixed(1) + 'px;height:' + (gs * (0.75 + r() * 0.4)).toFixed(1) + 'px;--dl:' + (0.5 + r() * 1.1).toFixed(2) + 's', grains);
    }

    // envelope
    var root = el('div', 'envroot', 'left:' + (L.env.cx - ENV.W / 2) + 'px;top:' + (L.env.cy - ENV.H / 2) + 'px;transform:rotate(' + L.env.rot + 'deg) scale(' + e + ')', stageEl);
    img(A + 'env-dropshadow.png', 'gshadow', null, el('div', 'fly', null, el('div', 'soff', null, root)));   // the shadow follows the flight, away from the lantern
    img(A + 'env-flapbshadow.png', 'fbsh', null, root);
    var envB = el('div', 'envB', null, root);
    img(A + 'env-back.webp', 'eback', null, envB);
    el('div', 'inglow', null, envB);
    var fbB = el('div', 'flapBbox', null, envB), flapB = el('div', 'flapB', null, fbB);
    img(A + 'env-flapin.webp', 'flapin', null, flapB);

    // card: front = the picture, back = the written side
    var rig = el('div', 'cardrig', null, root);
    el('div', 'csh a', null, rig); el('div', 'csh b', null, rig);
    var c3 = el('div', 'card3d', null, el('div', 'cardpersp', null, rig));
    var front = el('div', 'cface front', null, c3);
    img(A + 'front.jpg', null, null, front); el('div', 'gloss', null, front); el('div', 'warm', null, front);
    var back = el('div', 'cface backside', null, c3);
    var face = buildFace(back, data); state.face = face;
    el('div', 'warm', null, back);

    // front of the envelope: pocket (its own layer ABOVE the card), name, flap, twine with seal, blown snow
    var envF = el('div', 'envF', null, root);
    var fr = el('div', 'fr', null, el('div', 'fly', null, envF));
    img(A + 'env-pocket.webp', 'epocket', null, fr);
    var label = el('span', null, null, el('span', 'lw', null, el('div', 'elabel', null, fr)));
    label.textContent = data.t ? ('For ' + data.t) : 'With love';
    img(A + 'env-flapshadow.png', 'flapsh', null, fr);
    img(A + 'env-flap.webp', 'flap', null, el('div', 'flapFbox', null, fr));
    img(A + 'env-bundle.webp', 'bundle', null, fr);
    img(A + 'env-drift.webp', 'drift', null, fr);   // a little powder snow left against the windward edge
    el('div', 'lwarm', null, fr);    // the lantern's flicker on the paper
    el('div', 'fshade', null, fr);   // the paper darkens while it is in the air
    var puff = el('div', 'puff', null, root);
    for (i = 0; i < 22; i++) {   // where it touches down: a fine spray of grains from the leading (left) and lower edges
      var onLeft = r() < 0.6, px = onLeft ? r() * 10 : r() * 180, py = onLeft ? 40 + r() * 380 : 420 + r() * 10, ps = 2.5 + r() * 6, first = r() < 0.4;
      el('i', null, 'left:' + px.toFixed(0) + 'px;top:' + py.toFixed(0) + 'px;width:' + ps.toFixed(1) + 'px;height:' + ps.toFixed(1) + 'px;margin:' + (-ps / 2).toFixed(1) + 'px 0 0 ' + (-ps / 2).toFixed(1) + 'px;' +
        '--px:' + Math.round(-(14 + r() * 58)) + 'px;--py:' + Math.round((r() * 2 - 0.7) * 24) + 'px;--dl:' + ((first ? 0.82 : 1.58) + r() * 0.1).toFixed(2) + 's', puff);
    }

    // card geometry for this layout (envelope units): where the card comes to rest, upright, at its reading size
    var c1 = L.card.s / e;
    var dx = (L.card.cx - L.env.cx) / e, dy = (L.card.cy - L.env.cy) / e;
    var lx = ENV.W / 2 + dx * cs + dy * sn, ly = ENV.H / 2 - dx * sn + dy * cs, hgt = 336 * c1;
    stageEl.style.setProperty('--c0', ENV.cardS.toFixed(5));
    stageEl.style.setProperty('--c1', c1.toFixed(5));
    stageEl.style.setProperty('--rise', ENV.rise + 'px');
    stageEl.style.setProperty('--fx', (lx - ENV.W / 2 + hgt * sn).toFixed(2) + 'px');
    stageEl.style.setProperty('--fy', (ly - ENV.cardBottom + hgt * cs).toFixed(2) + 'px');
    stageEl.style.setProperty('--unrot', (-L.env.rot) + 'deg');

    // wind: powder snow streaming from the right, low over the boards (grains + soft veils)
    var gust = el('div', 'gust', null, stageEl);
    for (i = 0; i < 34; i++) {
      var sz = 2.5 + r() * 7, y0 = H * (0.18 + r() * 0.74), dy2 = 30 + r() * 150, big = sz > 8;
      el('i', null, 'width:' + sz.toFixed(1) + 'px;height:' + sz.toFixed(1) + 'px;' + (big ? 'filter:blur(1.2px);' : '') +
        '--x0:' + Math.round(W + 40 + r() * 160) + 'px;--y0:' + Math.round(y0) + 'px;' +
        '--x1:' + Math.round(W * (0.38 + r() * 0.3)) + 'px;--y1:' + Math.round(y0 + dy2 * (0.35 + r() * 0.3)) + 'px;' +
        '--x2:' + Math.round(-50 - r() * 90) + 'px;--y2:' + Math.round(y0 + dy2) + 'px;' +
        '--o:' + (0.45 + r() * 0.45).toFixed(2) + ';--d:' + (0.95 + r() * 0.6).toFixed(2) + 's;--dl:' + (r() * 1.25).toFixed(2) + 's', gust);
    }
    for (i = 0; i < 4; i++) {
      var vw = W * (0.7 + r() * 0.5), vh = 70 + r() * 80, vy = H * (0.3 + i * 0.14 + r() * 0.08);
      el('b', null, 'width:' + vw.toFixed(0) + 'px;height:' + vh.toFixed(0) + 'px;' +
        '--x0:' + Math.round(W * 0.75) + 'px;--y0:' + Math.round(vy) + 'px;--x2:' + Math.round(-vw * 0.95) + 'px;--y2:' + Math.round(vy + 30 + r() * 40) + 'px;' +
        '--o:' + (0.55 + r() * 0.4).toFixed(2) + ';--d:' + (1.15 + r() * 0.4).toFixed(2) + 's;--dl:' + (i * 0.22 + r() * 0.15).toFixed(2) + 's', gust);
    }

    // helpers: the glow from inside the envelope, the hint
    var hs = 560 * e, hc = toStage(ENV.W / 2, 70);
    el('div', 'halo', 'left:' + (hc[0] - hs / 2) + 'px;top:' + (hc[1] - hs / 2) + 'px;width:' + hs + 'px;height:' + hs + 'px', stageEl);
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
  function loadOne(n) {
    return new Promise(function (res) {
      var i = new Image();
      i.onload = function () { (i.decode ? i.decode() : Promise.resolve()).then(res, res); };
      i.onerror = res;
      i.src = A + n;
    });
  }
  function preload() {  // the arrival never starts with a half-loaded envelope; the finale's pictures load meanwhile
    var jobs = IMAGES.concat([state.L.scene.bg]).map(loadOne);
    lateImages(state.L).forEach(loadOne);
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
