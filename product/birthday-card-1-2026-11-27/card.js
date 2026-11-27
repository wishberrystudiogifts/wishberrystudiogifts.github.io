/* Birthday card "Make a wish" (Gold Drip Cake, new version 27 Nov 2026) — recipient view + shared codec.
   Text arrives inside the link (#m=...), is decoded in the browser and only ever inserted with textContent,
   so a crafted link cannot inject markup.
   ONE story — "make a wish" (all of it belongs to this product only):
     the card's picture is a three-tier cake with gold drips and THREE lit candles; the scene is a party table seen
     from above: a linen cloth, a gift in dark green paper with a powder-pink satin bow, plates and gold forks,
     a box of matches and spare candles, a pink napkin.
     1. ARRIVAL  — the pink envelope is tossed onto the party table: it comes down from near us (large, turning),
                   lands flat on the cloth with a short skid, its shadow gathering under it; a handful of paper
                   confetti flutters down after it and stays around it; we lean in and their name is written on it.
     2. OPENING  — tap: the round gold sticker with the candle peels off, the flap lifts (ivory liner with gold
                   icing drips inside).
     3. THE CARD — slides up OUT of the pocket (it sits between the inside back and the FRONT POCKET, a layer of its
                   own above the card), we lean back and the card comes forward.
     4. FINALE   — the light in the room goes down to candlelight; the three flames on the cake tremble and are
                   blown out; three thin threads of smoke rise and turn into small gold stars that fly up
                   ("the wish is on its way"); then the card turns over to the written side.
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

  /* three small candles (the picture's own detail) and a line of stars for the written side */
  var GOLD = '#B08A2E';
  function candle(x, h) {
    var top = 78 - h;
    return '<rect x="' + (x - 3.2) + '" y="' + top + '" width="6.4" height="' + h + '" rx="1.6" stroke="' + GOLD + '" stroke-width="1.4"/>' +
      '<path d="M' + (x - 3.2) + ' ' + (top + h * 0.3) + 'l6.4-5M' + (x - 3.2) + ' ' + (top + h * 0.58) + 'l6.4-5M' + (x - 3.2) + ' ' + (top + h * 0.86) + 'l6.4-5" stroke="' + GOLD + '" stroke-width="1" opacity=".7"/>' +
      '<path d="M' + x + ' ' + top + 'v-5" stroke="' + GOLD + '" stroke-width="1.1" stroke-linecap="round"/>' +
      '<path d="M' + x + ' ' + (top - 22) + 'c4.2 6 5.2 9 5.2 11.6a5.2 5.2 0 0 1-10.4 0c0-2.6 1-5.6 5.2-11.6z" fill="#E3AE45"/>' +
      '<path d="M' + x + ' ' + (top - 15) + 'c1.8 2.8 2.2 4.2 2.2 5.6a2.2 2.2 0 0 1-4.4 0c0-1.4.4-2.8 2.2-5.6z" fill="#FFF3CC"/>';
  }
  var CANDLES = candle(30, 40) + candle(50, 52) + candle(70, 40) +
    '<path d="M14 80h72" stroke="' + GOLD + '" stroke-width="1.4" stroke-linecap="round"/><path d="M20 80c4 8 10 8 14 0c4 8 10 8 14 0c4 8 10 8 14 0c4 8 10 8 14 0" stroke="' + GOLD + '" stroke-width="1.2" opacity=".75"/>';
  function star4(cx, cy, r) { var q = r * 0.3; return 'M' + cx + ' ' + (cy - r) + 'l' + q + ' ' + (r - q) + 'l' + (r - q) + ' ' + q + 'l' + (q - r) + ' ' + q + 'l' + (-q) + ' ' + (r - q) + 'l' + (-q) + ' ' + (q - r) + 'l' + (q - r) + ' ' + (-q) + 'l' + (r - q) + ' ' + (-q) + 'z'; }
  var SPRIG = '<path d="M8 13h40M92 13h40" stroke="' + GOLD + '" stroke-width="1" stroke-linecap="round" opacity=".7"/>' +
    '<path d="' + star4(70, 12, 9) + '" fill="' + GOLD + '"/><path d="' + star4(55, 13, 4) + star4(85, 13, 4) + '" fill="' + GOLD + '" opacity=".85"/>';
  var STARURI = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><radialGradient id="g"><stop offset="0" stop-color="#FFF6D2"/><stop offset=".45" stop-color="#F4CE6A"/><stop offset="1" stop-color="#D9A437"/></radialGradient></defs><path d="' + star4(12, 12, 11) + '" fill="url(#g)"/></svg>') + '")';

  /* ---------- the written side of the card ---------- */
  function buildFace(parent, data) {
    var face = el('div', 'iface', null, parent);
    img(A + 'paper.jpg', 'paper', null, face);
    el('div', 'frame', null, face);
    svg(CANDLES, 100, 92, face, 'orn-top');
    svg(SPRIG, 140, 26, face, 'orn-bot');
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
  /* the name on the envelope: one line, as big as the envelope allows, in the script of icing on a cake
     (the video engine draws it the same way: videomaker.js, `glass` with env) */
  function fitName(nm, max, start, min) {
    var size = start, guard = 0, ink = nm.texts[0], w;
    function set(sz) { nm.texts.forEach(function (t) { t.style.fontSize = sz + 'px'; }); return ink.getComputedTextLength(); }
    w = set(size);
    while (w + 28 > max && size > min && guard++ < 80) { size -= 2; w = set(size); }
    var lineH = 1.05 * size;
    nm.svg.setAttribute('width', (w + 28).toFixed(1)); nm.svg.setAttribute('height', lineH.toFixed(1));
    nm.texts.forEach(function (t) { t.setAttribute('x', 14); t.setAttribute('y', (0.8 * size).toFixed(1)); });
  }
  function whenFonts(cb) {
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load("400 40px 'Cookie'"), document.fonts.load("400 20px 'Newsreader'"), document.fonts.load("italic 500 20px 'Newsreader'"), document.fonts.load("500 20px 'Newsreader'")]).then(cb, cb);
    } else cb();
  }

  /* ---------- layouts (stage units; two pictures of the same table, one upright, one wide) ----------
     Scene numbers are in the picture's own pixels (written by project/tools/build-scene-wish.py); everything else
     is in stage units. env: where the envelope comes to rest on the cloth (e = its size there); tuck: where it starts,
     under the bow on top of the gift (centre, tilt, a little bigger because the box top is nearer to us); cam: how far
     we lean in (z) and where the envelope is then (x, y); fin: where the card settles. */
  var ENV = { W: 312, H: 430, cardS: 297 / 480, cardX: 156, cardBottom: 424, out: 436 };
  var NAME = { cx: 156, cy: 322, max: 204, size: 66, min: 26 };            // on the front pocket, envelope units
  var FLAMES = [   // box and wick of each flame on the card's face (fractions of the face; build-scene-wish.py)
    { box: [0.32333, 0.04762, 0.2, 0.19048], wick: [0.42333, 0.19048] },
    { box: [0.39867, 0.0319, 0.2, 0.19048], wick: [0.499, 0.17476] },
    { box: [0.46667, 0.0481, 0.2, 0.19048], wick: [0.56667, 0.19095] }
  ];
  var SCENES = {
    tall: { sfx: '', w: 1152, h: 2048, bow: [17, 28, 485, 489] },
    wide: { sfx: '-land', w: 1728, h: 1296, bow: [38, 43, 521, 473] }
  };
  var LAYOUTS = {
    port: { W: 600, H: 1100, scene: SCENES.tall, sk: 1100 / 2048, sx: -9.375, sy: 0,
      env: { e: 0.42, cx: 300, cy: 604, rot: -6 }, toss: { x: 330, y: 780, s: 2.5, r: 38 }, cam: { z: 1.85, x: 300, y: 590 }, push: { z: 1.42, x: 300, y: 470 },
      fin: { s: 0.86, cx: 300, bottom: 972 }, hintY: 930, hintSize: 21, rise: 430, conf: { r: 250, kx: 0.72, box: [40, 350, 560, 905] } },
    land: { W: 1200, H: 900, scene: SCENES.wide, sk: 900 / 1296, sx: 0, sy: 0,
      env: { e: 0.42, cx: 520, cy: 590, rot: -5 }, toss: { x: 420, y: 640, s: 2.4, r: 34 }, cam: { z: 1.75, x: 600, y: 450 }, push: { z: 1.3, x: 800, y: 330 },
      fin: { s: 0.92, cx: 884, bottom: 806 }, hintY: 838, hintSize: 17, rise: 300, conf: { r: 250, kx: 1.15, box: [215, 330, 835, 800] } }
  };
  // needed before the arrival may start / needed only after the tap (loaded meanwhile, never block the arrival)
  var IMAGES = ['env-dropshadow.png', 'env-airshadow.png', 'env-pocket.webp', 'env-back.webp', 'env-flap.webp', 'env-flapshadow.png', 'env-seal.webp', 'front.jpg', 'flame-1.webp', 'flame-2.webp', 'flame-3.webp'];
  var LATE = ['env-flapin.webp', 'paper.jpg', 'dim.webp', 'glow.webp', 'smoke-1.webp', 'smoke-2.webp', 'smoke-3.webp'];
  var T = { landed: 2600, autoplay: 2900, controls: 7400 };   // ms; all on the 100 ms grid (frame-by-frame video render)

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
    stageEl.innerHTML = ''; stageEl.className = L === LAYOUTS.port ? 'port' : 'land';
    var S = L.scene, sfx = S.sfx, e = L.env.e, i, r = rnd(19);
    var th = L.env.rot * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
    function px(v) { return v.toFixed(2) + 'px'; }
    function toLocal(dx, dy) { return [(dx * cs + dy * sn) / e, (-dx * sn + dy * cs) / e]; }        // stage offset -> envelope units (the envelope's own turned frame)
    function toEnv(x, y) { var v = toLocal(x - L.env.cx, y - L.env.cy); return [v[0] + ENV.W / 2, v[1] + ENV.H / 2]; }
    var sceneT = 'width:' + S.w + 'px;height:' + S.h + 'px;transform:translate(' + L.sx + 'px,' + L.sy + 'px) scale(' + L.sk + ')';

    var cam = el('div', 'cam', null, stageEl);
    // ---- scene: the table
    var sc = el('div', 'scene', sceneT, cam);
    img(A + 'bg' + sfx + '.jpg', 'bg', 'width:' + S.w + 'px;height:' + S.h + 'px', sc);

    // ---- paper confetti that flutters down after the envelope and stays on the cloth around it (under the envelope and the dimness)
    var cfb = el('div', 'cfbox', null, cam), q = rnd(7), CF = L.conf, cfn = 0, guard = 0;
    var GOLD = 'linear-gradient(118deg,#a97a25 0%,#f6e2a0 44%,#c59636 72%,#a8792a 100%)', PINK = 'linear-gradient(124deg,#e3a2ad 0%,#f8d4da 52%,#e9b0ba 100%)';
    var COL = [GOLD, GOLD, GOLD, PINK, PINK, 'linear-gradient(124deg,#eadcc6 0%,#fffaf0 50%,#ecdfca 100%)', 'linear-gradient(124deg,#234a39 0%,#3d7460 52%,#27503f 100%)'];
    while (cfn < 26 && guard++ < 400) {
      var a = q() * 6.2832, d = 74 + Math.pow(q(), 2) * CF.r, x = L.env.cx + Math.cos(a) * d * CF.kx, y = L.env.cy + 6 + Math.sin(a) * d;
      if (x < CF.box[0] || x > CF.box[2] || y < CF.box[1] || y > CF.box[3]) continue;
      if (Math.abs(x - L.env.cx) < 0.5 * ENV.W * e + 13 && Math.abs(y - L.env.cy) < 0.5 * ENV.H * e + 13) continue;
      var kind = q(), big = q() < 0.4 ? 1.35 : 1, w = (kind < 0.22 ? 9 + q() * 3 : 12 + q() * 6) * big, h = kind < 0.22 ? w : (5.5 + q() * 3) * big, dl = 0.86 + q() * 0.85, du = 0.8 + q() * 0.5, te = Math.round(q() * 40);
      var c = el('div', 'cf', 'left:' + px(x - w / 2) + ';top:' + px(y - h / 2) + ';width:' + px(w) + ';height:' + px(h) + ';--ox:' + px(L.toss.x * (0.18 + q() * 0.5)) + ';--oy:' + px(L.toss.y * (0.3 + q() * 0.45)) + ';--dl:' + dl.toFixed(2) + 's;--du:' + du.toFixed(2) + 's;--rz:' + Math.round(q() * 360) + 'deg', cfb);
      var ci = Math.floor(q() * COL.length); if (kind < 0.22 && ci === 6) ci = 0;                    // no flat green dots
      el('i', null, 'background:' + COL[ci] + (kind < 0.22 ? ';border-radius:50%' : '') + ';--ax:' + (0.3 + q() * 0.7).toFixed(2) + ';--ay:' + (q() * 0.9).toFixed(2) + ';--te:' + te + 'deg;--tn:' + (Math.round(2 + q() * 3) * 360 + te) + 'deg', c);
      cfn++;
    }

    // ---- envelope: inside back -> card -> FRONT POCKET -> flap, sticker; then the room's dimness and the candles' glow (under the card)
    var root = el('div', 'envroot', 'left:' + (L.env.cx - ENV.W / 2) + 'px;top:' + (L.env.cy - ENV.H / 2) + 'px;transform:rotate(' + L.env.rot + 'deg) scale(' + e + ')', cam);
    var shw = el('div', 'shw', null, root);                                                // the shadows follow its way across the table; how far they stand off = how high it is
    img(A + 'env-airshadow.png', 'eshadow eair', null, shw);                               // its wide, soft shadow while it is in the air
    img(A + 'env-dropshadow.png', 'eshadow econ', null, shw);                              // the close shadow once it lies on the cloth
    var toss = el('div', 'toss', null, root), lean = el('div', 'lean', null, toss);        // toss: its way across the table; lean: its size (height) and turn
    var envB = el('div', 'eg envB', null, lean);
    img(A + 'env-back.webp', 'full', null, envB);
    img(A + 'env-flapin.webp', 'flapin', null, el('div', 'flapBbox', null, envB));
    var rig = el('div', 'cardrig', null, lean);
    var card = el('div', 'card', null, rig);
    var c3 = el('div', 'card3d', null, el('div', 'cardpersp', null, card));
    var front = el('div', 'cface front', null, c3);
    img(A + 'front.jpg', null, null, front);
    FLAMES.forEach(function (f, k) {
      var b = f.box, w = el('div', 'flw', 'left:' + (b[0] * 100) + '%;top:' + (b[1] * 100) + '%;width:' + (b[2] * 100) + '%;height:' + (b[3] * 100) + '%;transform-origin:' + ((f.wick[0] - b[0]) / b[2] * 100).toFixed(1) + '% ' + ((f.wick[1] - b[1]) / b[3] * 100).toFixed(1) + '%;--dl:' + (4.2 + k * 0.07).toFixed(2) + 's', front);
      img(A + 'flame-' + (k + 1) + '.webp', null, 'transform-origin:' + ((f.wick[0] - b[0]) / b[2] * 100).toFixed(1) + '% ' + ((f.wick[1] - b[1]) / b[3] * 100).toFixed(1) + '%;animation-delay:' + (-k * 0.37).toFixed(2) + 's', w);
    });
    el('div', 'gloss', null, front);
    el('div', 'cshade', null, front);
    el('div', 'cglow', 'left:' + ((FLAMES[1].wick[0] - 0.62) * 100) + '%;top:' + ((FLAMES[1].wick[1] - 0.2) * 100 - 62 * 480 / 672) + '%;width:124%;height:' + (124 * 480 / 672) + '%', front);
    el('div', 'cdim', null, front);
    el('div', 'tsh', null, front);
    var back = el('div', 'cface backside', null, c3);
    var face = buildFace(back, data); state.face = face;
    el('div', 'tsh', null, back);
    var envF = el('div', 'eg envF', null, lean);
    img(A + 'env-pocket.webp', 'full', null, envF);
    // their name on the envelope (envelope units; the same box as the video engine uses)
    var gn = el('div', 'ename', 'left:' + (NAME.cx - 300) + 'px;top:' + (NAME.cy - 80) + 'px;width:600px', envF);
    var nameSpan = el('span', null, null, el('span', 'lw', null, gn));
    var nsv = document.createElementNS(SVGNS, 'svg'); nsv.setAttribute('class', 'gsvg'); nsv.setAttribute('aria-hidden', 'true'); nameSpan.appendChild(nsv);
    var nm = { span: nameSpan, svg: nsv, texts: [], text: data.t || 'For you' };
    var nt = document.createElementNS(SVGNS, 'text'); nt.setAttribute('class', 'ink'); nt.textContent = nm.text; nsv.appendChild(nt); nm.texts.push(nt);
    img(A + 'env-flapshadow.png', 'full flapsh', null, envF);
    img(A + 'env-flap.webp', 'full flapF', null, el('div', 'flapFbox', null, envF));
    img(A + 'env-seal.webp', 'full flapF', null, el('div', 'flapFbox', null, envF));       // the sticker holds the flap: it lets go of the pocket and lifts with the flap
    el('div', 'elight', null, envF);
    el('div', 'etone', null, envF);                                                     // the room's light on the paper: a little duller and grainier, like the napkin beside it

    // ---- numbers for the CSS
    var F = L.fin;
    var ax = (ENV.cardX - ENV.W / 2) * e, ay = (ENV.cardBottom - ENV.H / 2) * e;
    var bx = L.env.cx + ax * cs - ay * sn, by = L.env.cy + ax * sn + ay * cs;        // the card's bottom centre while it is in the envelope (stage)
    var dx = (F.cx - bx) / e, dy = (F.bottom - by) / e;
    var tk = toLocal(L.toss.x, L.toss.y), tu = Math.sqrt(L.toss.x * L.toss.x + L.toss.y * L.toss.y), sk = toLocal(L.toss.x / tu * 17, L.toss.y / tu * 17);
    var vars = {
      '--fx': px(dx * cs + dy * sn), '--fy': px(-dx * sn + dy * cs), '--c0': ENV.cardS.toFixed(5), '--c1': (F.s / e).toFixed(5),
      '--unrot': (-L.env.rot) + 'deg', '--out': ENV.out + 'px',
      '--camo': px(L.env.cx) + ' ' + px(L.env.cy), '--camz': L.cam.z, '--camx': px(L.cam.x - L.env.cx), '--camy': px(L.cam.y - L.env.cy),
      '--lx': px(tk[0]), '--ly': px(tk[1]), '--lr': L.toss.r + 'deg', '--ls': L.toss.s,
      '--kx': px(sk[0]), '--ky': px(sk[1])
    };
    // the wish: we lean in over the candles (pz) so that the middle wick comes to (push.x, push.y)
    var mw = [F.cx + (FLAMES[1].wick[0] - 0.5) * 480 * F.s, F.bottom - (1 - FLAMES[1].wick[1]) * 672 * F.s], P = L.push;
    vars['--pz'] = P.z; vars['--ptx'] = px(P.x - L.env.cx - (mw[0] - L.env.cx) * P.z); vars['--pty'] = px(P.y - L.env.cy - (mw[1] - L.env.cy) * P.z);
    Object.keys(vars).forEach(function (k) { stageEl.style.setProperty(k, vars[k]); });
    // where the three wicks are when the card has settled (stage)
    var wicks = FLAMES.map(function (f) { return [F.cx + (f.wick[0] - 0.5) * 480 * F.s, F.bottom - (1 - f.wick[1]) * 672 * F.s]; });
    // the candles' light on the room, around the flames (inside the envelope's group, above the dimness, under the card)
    var gc = toEnv(wicks[1][0], wicks[1][1] - 20 * F.s), gr = 640 / e;
    var dc = toEnv(F.cx, F.bottom - 672 * F.s * 0.62);
    // both are small pictures drawn large (one texture each) — very large CSS gradients were re-drawn while the camera moved
    img(A + 'dim.webp', 'dim', 'left:' + (dc[0] - 4356) + 'px;top:' + (dc[1] - 4356) + 'px;width:8712px;height:8712px', lean);
    img(A + 'glow.webp', 'lglow', 'left:' + (gc[0] - gr) + 'px;top:' + (gc[1] - gr) + 'px;width:' + (2 * gr) + 'px;height:' + (2 * gr) + 'px', lean);

    // ---- smoke from the three wicks, then the stars it turns into
    var fxb = el('div', 'fx', null, cam);
    wicks.forEach(function (w, k) {
      var sw = 70 * F.s / 0.86, sh = 176 * F.s / 0.86;
      img(A + 'smoke-' + (k + 1) + '.webp', 'smoke', 'left:' + (w[0] - sw / 2) + 'px;top:' + (w[1] - sh + 2) + 'px;width:' + sw + 'px;height:' + sh + 'px;--dl:' + (4.38 + k * 0.11).toFixed(2) + 's;--sx:' + [1, -1, 1][k] * (0.9 + k * 0.12) + ';--sy:' + (1.25 - k * 0.14), fxb);
    });
    wicks.forEach(function (w, k) {
      for (i = 0; i < 15; i++) {
        var sz = (i % 5 === 1 ? 62 : i % 3 === 0 ? 36 : 22) + r() * 18, d = 2.6 + r() * 1.7, dl = 4.85 + i * 0.185 + r() * 0.12 + k * 0.05;
        var sdx = (r() - 0.5) * 230 + (k - 1) * 52, sdy = -(L.rise * (0.55 + r() * 0.6));
        el('i', 'star', 'left:' + (w[0] - sz / 2 + (r() - 0.5) * 10) + 'px;top:' + (w[1] - 96 * F.s / 0.86 - sz / 2 + (r() - 0.5) * 26) + 'px;width:' + sz.toFixed(1) + 'px;height:' + sz.toFixed(1) + 'px;background-image:' + STARURI + ',radial-gradient(circle,rgba(255,220,130,.5) 0,rgba(255,214,120,.16) 38%,rgba(255,214,120,0) 68%)' +
          ';--dx:' + sdx.toFixed(0) + 'px;--dy:' + sdy.toFixed(0) + 'px;--d:' + d.toFixed(2) + 's;--dl:' + dl.toFixed(2) + 's;--rt:' + Math.round((r() - 0.5) * 240) + 'deg', fxb);
      }
    });

    el('div', 'shade', null, stageEl);
    el('div', 'grain', null, stageEl);
    var hint = el('div', 'hint', 'top:' + L.hintY + 'px;font-size:' + L.hintSize + 'px', stageEl);
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    hint.textContent = (coarse ? 'Tap' : 'Click') + ' the envelope to open';

    state.name = nm;
    scaleStage();
    fitFace(face); fitName(nm, NAME.max, NAME.size, NAME.min);
    whenFonts(function () { fitFace(face); fitName(nm, NAME.max, NAME.size, NAME.min); });
  }

  /* ---------- states ---------- */
  function clearTimers() { state.timers.forEach(clearTimeout); state.timers = []; }
  function later(fn, ms) { state.timers.push(setTimeout(fn, ms)); }
  function controls(show) { var c = document.getElementById('controls'); if (c) c.classList.toggle('show', !!show); }

  function arrive() {   // called only when the pictures of the scene and the envelope are decoded
    clearTimers();
    state.landed = false; state.opened = false;
    stageEl.classList.remove('open', 'landed', 'still', 'instant', 'done', 'arrive', 'wait');
    controls(false);
    void stageEl.offsetWidth;
    stageEl.classList.add('arrive');
    later(function () {
      state.landed = true; stageEl.classList.add('landed');
      if (state.pending) { state.pending = false; open(); }
    }, T.landed);
    if (state.autoplay) later(open, T.autoplay);
  }
  function still() {    // reduced motion: the envelope already lies on the cloth with the name on it
    clearTimers();
    stageEl.classList.remove('open', 'arrive', 'instant', 'done', 'wait');
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
  function preload() {  // the arrival never starts with a half-loaded scene or envelope; the finale's pictures load meanwhile
    var sfx = state.L.scene.sfx, first = IMAGES.concat(['bg' + sfx + '.jpg']);
    var late = LATE.slice();
    late.forEach(loadOne);
    var fonts = new Promise(function (res) { whenFonts(res); });
    var limit = new Promise(function (res) { setTimeout(res, 6000); });
    return Promise.race([Promise.all(first.map(loadOne).concat([fonts])), limit]);
  }

  /* ---------- written-side-only view (editor live preview, video engine) ---------- */
  function buildFaceView(data) {
    document.body.classList.add('inside-view'); document.documentElement.classList.add('inside-view');
    ivwrap.innerHTML = '';
    var f = buildFace(ivwrap, data);
    function sc() { var s = Math.min(window.innerWidth / 480, window.innerHeight / 672); ivwrap.style.transform = 'scale(' + s + ')'; }
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
      fitFace(state.face); fitName(state.name, NAME.max, NAME.size, NAME.min);
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
