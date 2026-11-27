/* Christmas card "A light in the window" (Gold Lantern, new version 27 Nov 2026) — recipient view + shared codec.
   Text arrives inside the link (#m=...), is decoded in the browser and only ever inserted with textContent,
   so a crafted link cannot inject markup.
   ONE story — "your light has arrived" (all of it belongs to this product only):
     the card's picture is a golden lantern; the scene is a window sill on a winter evening, seen steeply from above:
     a mug of cocoa, dried orange, a red scarf, and behind the misted glass a snowy town.
     1. ARRIVAL  — a finger writes the name on the misted glass (a drop or two runs down); the envelope drops in
                   from above, lands on its lower edge on the sill behind the scarf's edge (a small bounce) and
                   comes to rest leaning on the window frame; we lean in to it.
     2. OPENING  — tap: the flap lifts with its gold wax seal, the slice of dried orange and the star anise
                   (the green liner with gold lanterns inside).
     3. THE CARD — slides up OUT of the pocket (it sits between the inside back and the FRONT POCKET, a layer of its
                   own above the card), we lean back and the card comes forward.
     4. FINALE   — the candle in the card's lantern flickers and catches; its warmth clears the mist from the glass
                   (the name goes with it), snow is falling outside and the windows of the town light up one by one,
                   as an answer; then the card turns over to the written side.
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

  /* a small lantern (the picture's own detail) and a sprig line for the written side */
  var GOLD = '#A9812F';
  var LANTERN = '<path d="M50 6a7 7 0 1 1 0 14a7 7 0 1 1 0-14z" stroke="' + GOLD + '" stroke-width="1.6"/>' +
    '<path d="M38 30q12-12 24 0" stroke="' + GOLD + '" stroke-width="1.6" stroke-linecap="round"/><path d="M50 20v4" stroke="' + GOLD + '" stroke-width="1.6"/>' +
    '<path d="M32 36h36l-4-6H36z" fill="' + GOLD + '" opacity=".9"/>' +
    '<path d="M35 36v44h30V36" stroke="' + GOLD + '" stroke-width="1.6"/><path d="M45 36v44M55 36v44" stroke="' + GOLD + '" stroke-width=".8" opacity=".6"/>' +
    '<path d="M30 80h40v5H30z" fill="' + GOLD + '" opacity=".9"/><path d="M34 85h32l-3 7H37z" stroke="' + GOLD + '" stroke-width="1.4"/>' +
    '<path d="M50 50c4 6 5 9 5 12a5 5 0 0 1-10 0c0-3 1-6 5-12z" fill="#E0A63A"/><path d="M50 57c1.6 2.6 2 4 2 5.4a2 2 0 0 1-4 0c0-1.4.4-2.800 2-5.400z" fill="#FFF0C4"/>' +
    '<path d="M47 67h6v13h-6z" fill="' + GOLD + '" opacity=".45"/>';
  var SPRIG = '<path d="M8 13h46M86 13h46" stroke="' + GOLD + '" stroke-width="1" stroke-linecap="round" opacity=".7"/>' +
    '<path d="M70 3l2.300 6.700L79 12l-6.700 2.300L70 21l-2.300-6.700L61 12l6.700-2.300z" fill="' + GOLD + '"/>' +
    '<circle cx="58" cy="13" r="1.4" fill="' + GOLD + '"/><circle cx="82" cy="13" r="1.4" fill="' + GOLD + '"/>';

  /* ---------- the written side of the card ---------- */
  function buildFace(parent, data) {
    var face = el('div', 'iface', null, parent);
    img(A + 'paper.jpg', 'paper', null, face);
    el('div', 'frame', null, face);
    svg(LANTERN, 100, 104, face, 'orn-top');
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
  /* the name on the glass: one line, as big as the pane allows; written with a fingertip - a thick round stroke, every
     letter a little off its line and a little turned (the video engine draws it the same way: videomaker.js, `glass`) */
  function nameRot(i) { return (((i * 37 + 11) % 9) - 4) * 0.9; }
  function nameDy(i, size) { return (((i * 53 + 7) % 5) - 2) * 0.018 * size; }
  function fitName(nm, max, start) {
    var size = start, guard = 0, ink = nm.texts[1], w;
    function set(sz) { nm.texts.forEach(function (t) { t.style.fontSize = sz + 'px'; }); return ink.getComputedTextLength(); }
    w = set(size);
    while (w + 28 > max && size > 26 && guard++ < 80) { size -= 2; w = set(size); }
    var n = Array.from(nm.text).length, rot = [], dy = [], prev = 0, i;
    for (i = 0; i < n; i++) { rot.push(nameRot(i).toFixed(2)); var y = nameDy(i, size); dy.push((y - prev).toFixed(2)); prev = y; }
    var lineH = 1.05 * size;
    nm.svg.setAttribute('width', (w + 28).toFixed(1)); nm.svg.setAttribute('height', lineH.toFixed(1));
    nm.texts.forEach(function (t, k) {
      t.setAttribute('x', 14); t.setAttribute('y', (0.8 * size).toFixed(1)); t.setAttribute('rotate', rot.join(' ')); t.setAttribute('dy', dy.join(' '));
      t.style.strokeWidth = ((k ? 0.056 : 0.12) * size).toFixed(2) + 'px';
    });
    nm.span.style.setProperty('--dtop', (0.82 * size).toFixed(1) + 'px');
  }
  function whenFonts(cb) {
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load("400 40px 'Patrick Hand'"), document.fonts.load("400 20px 'EB Garamond'"), document.fonts.load("italic 500 20px 'EB Garamond'"), document.fonts.load("500 20px 'EB Garamond'")]).then(cb, cb);
    } else cb();
  }

  /* ---------- layouts (stage units; two pictures of the same sill, one upright, one wide) ----------
     Scene numbers are in the picture's own pixels (written by project/tools/build-scene-window.py); everything else
     is in stage units. env: where the envelope lies on the scarf (e = its size there, in the picture's own scale),
     lean = where it stood by the mug before it slipped (offset in envelope units, tilt); cam: how far we lean in
     (z) and where the envelope is then (x, y); fin: where the card settles; name: where the finger writes. */
  var ENV = { W: 312, H: 430, cardS: 297 / 480, cardX: 156, cardBottom: 424, out: 436 };
  var FLAME = [0.5122, 0.6032];
  var SCENES = {
    tall: { sfx: '', w: 1152, h: 2048, occ: [740, 875, 153, 354], glass: [[226, 0], [1096, 0], [951, 905], [316, 756]], box: [226, 0, 871, 906],
      lit: [[367, 521, 645, 158], [269, 331, 476, 183], [651, 206, 293, 151], [586, 181, 433, 103], [251, 143, 815, 134], [530, 49, 412, 131]] },
    wide: { sfx: '-land', w: 1728, h: 1296, occ: [821, 634, 216, 302], glass: [[214, 0], [1491, 0], [1392, 598], [340, 610]], box: [214, 0, 1278, 611],
      lit: [[620, 558, 585, 52], [321, 481, 1087, 132], [1049, 363, 205, 127], [259, 143, 1059, 208], [532, 62, 936, 157], [212, 0, 502, 190]] }
  };
  var LAYOUTS = {
    port: { W: 600, H: 1100, scene: SCENES.tall, sk: 1100 / 2048, sx: -9.375, sy: 0,
      env: { e: 0.42, cx: 474, cy: 522, rot: 8 }, cam: { z: 2.15, x: 325, y: 590 },
      fin: { s: 0.86, cx: 300, bottom: 972 }, name: { cx: 345, cy: 196, max: 300, size: 84, rot: 3 }, hintY: 930, hintSize: 21 },
    land: { W: 1200, H: 900, scene: SCENES.wide, sk: 900 / 1296, sx: 0, sy: 0,
      env: { e: 0.5, cx: 700, cy: 508, rot: 1 }, cam: { z: 2.0, x: 520, y: 450 },
      fin: { s: 0.92, cx: 884, bottom: 806 }, name: { cx: 436, cy: 186, max: 430, size: 96, rot: 1 }, hintY: 838, hintSize: 17 }
  };
  var NFOG = 5, NLIT = 6;
  // needed before the arrival may start / needed only after the tap (loaded meanwhile, never block the arrival)
  var IMAGES = ['env-dropshadow.png', 'env-pocket.webp', 'env-back.webp', 'env-flap.webp', 'env-flapshadow.png', 'env-seal.webp', 'front.jpg'];
  var LATE = ['env-flapin.webp', 'paper.jpg'];
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
    stageEl.innerHTML = ''; stageEl.className = '';
    var S = L.scene, sfx = S.sfx, e = L.env.e, i, r = rnd(27);
    function st(x, y) { return [L.sx + x * L.sk, L.sy + y * L.sk]; }                 // scene px -> stage units
    var th = L.env.rot * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
    function px(v) { return v.toFixed(2) + 'px'; }

    var cam = el('div', 'cam', null, stageEl);
    // ---- scene: the sill with the town's lights off, the lights (near -> far), snow behind the glass, the mist, the name
    var sc = el('div', 'scene', 'width:' + S.w + 'px;height:' + S.h + 'px;transform:translate(' + L.sx + 'px,' + L.sy + 'px) scale(' + L.sk + ')', cam);
    img(A + 'bg' + sfx + '.jpg', 'bg', 'width:' + S.w + 'px;height:' + S.h + 'px', sc);
    S.lit.forEach(function (b, k) {
      img(A + 'lit' + sfx + '-' + (k + 1) + '.webp', 'lit', 'left:' + b[0] + 'px;top:' + b[1] + 'px;width:' + b[2] + 'px;height:' + b[3] + 'px;--dl:' + (4.3 + k * 0.36).toFixed(2) + 's', sc);
    });
    var B = S.box, clip = S.glass.map(function (p) { return (p[0] - B[0]) + 'px ' + (p[1] - B[1]) + 'px'; }).join(',');
    var snow = el('div', 'snowbox', 'left:' + B[0] + 'px;top:' + B[1] + 'px;width:' + B[2] + 'px;height:' + B[3] + 'px;clip-path:polygon(' + clip + ');-webkit-clip-path:polygon(' + clip + ')', sc);
    for (i = 0; i < 46; i++) {
      var fs = 3 + r() * 6, dur = 5 + r() * 6;
      el('i', null, 'left:' + (r() * 100).toFixed(1) + '%;width:' + fs.toFixed(1) + 'px;height:' + fs.toFixed(1) + 'px;--o:' + (0.35 + r() * 0.5).toFixed(2) + ';--d:' + dur.toFixed(1) + 's;--dl:' + (-r() * dur).toFixed(2) + 's;--dx:' + Math.round((r() - 0.3) * 120) + 'px;--fall:' + (B[3] + 30) + 'px' + (fs > 6.5 ? ';filter:blur(1.4px)' : ''), snow);
    }
    for (i = 1; i <= NFOG; i++) img(A + 'fog' + sfx + '-' + i + '.webp', 'fog', 'left:' + B[0] + 'px;top:' + B[1] + 'px;width:' + B[2] + 'px;height:' + B[3] + 'px;--dl:' + (3.8 + (i - 1) * 0.36).toFixed(2) + 's', sc);
    // the name on the glass (stage units, inside the camera so it stays on the pane)
    var N = L.name, gn = el('div', 'gname', 'left:' + (N.cx - 300) + 'px;top:' + (N.cy - 80) + 'px;width:600px;transform:rotate(' + N.rot + 'deg)', cam);
    var nameSpan = el('span', null, null, el('span', 'lw', null, gn));
    var nsv = document.createElementNS(SVGNS, 'svg'); nsv.setAttribute('class', 'gsvg'); nsv.setAttribute('aria-hidden', 'true'); nameSpan.appendChild(nsv);
    var nm = { span: nameSpan, svg: nsv, texts: [], text: data.t || 'For you' };
    ['halo', 'ink'].forEach(function (c) { var t = document.createElementNS(SVGNS, 'text'); t.setAttribute('class', c); t.textContent = nm.text; nsv.appendChild(t); nm.texts.push(t); });
    [[0.22, 34, 1.2], [0.57, 58, 1.4], [0.84, 26, 1.55]].forEach(function (d) {
      el('b', null, 'left:' + (d[0] * 100) + '%;height:' + d[1] + 'px;--dl:' + d[2] + 's', nameSpan);
    });

    // ---- envelope: inside back -> card -> FRONT POCKET -> flap, orange slice, seal
    var root = el('div', 'envroot', 'left:' + (L.env.cx - ENV.W / 2) + 'px;top:' + (L.env.cy - ENV.H / 2) + 'px;transform:rotate(' + L.env.rot + 'deg) scale(' + e + ')', cam);
    img(A + 'env-dropshadow.png', 'eshadow', null, root);
    el('div', 'econtact', null, root);                                                  // where its lower edge touches the sill
    var lean = el('div', 'lean', null, root);
    var envB = el('div', 'eg envB', null, lean);
    img(A + 'env-back.webp', 'full', null, envB);
    img(A + 'env-flapin.webp', 'flapin', null, el('div', 'flapBbox', null, envB));
    var rig = el('div', 'cardrig', null, lean);
    var card = el('div', 'card', null, rig);
    var c3 = el('div', 'card3d', null, el('div', 'cardpersp', null, card));
    var front = el('div', 'cface front', null, c3);
    img(A + 'front.jpg', null, null, front); el('div', 'gloss', null, front);
    var fl = el('div', 'flame', 'left:' + (FLAME[0] * 100) + '%;top:' + (FLAME[1] * 100) + '%', front);
    el('i', 'f3', null, fl); el('i', 'f1', null, fl); el('i', 'f2', null, fl);
    el('div', 'tsh', null, front);
    var back = el('div', 'cface backside', null, c3);
    var face = buildFace(back, data); state.face = face;
    el('div', 'tsh', null, back);
    var envF = el('div', 'eg envF', null, lean);
    img(A + 'env-pocket.webp', 'full', null, envF);
    img(A + 'env-flapshadow.png', 'full flapsh', null, envF);
    img(A + 'env-flap.webp', 'full flapF', null, el('div', 'flapFbox', null, envF));
    img(A + 'env-seal.webp', 'full flapF', null, el('div', 'flapFbox', null, envF));   // the seal, the orange slice and the anise sit on the flap and turn with it
    el('div', 'elight', null, envF);
    el('div', 'eshade', null, envF);                                                    // the scarf's shadow on its lower left corner
    // the scarf's edge, a layer of its own ABOVE the envelope (the same pixels as the picture below): the envelope
    // stands on the sill BEHIND the scarf. In stage units, so the envelope's own turn and size are undone here.
    var O = S.occ, occ = el('div', 'occ', 'transform:scale(' + (1 / e) + ') rotate(' + (-L.env.rot) + 'deg)', root);
    img(A + 'occ' + sfx + '.webp', null, 'left:' + (O[0] * L.sk + L.sx - L.env.cx) + 'px;top:' + (O[1] * L.sk + L.sy - L.env.cy) + 'px;width:' + (O[2] * L.sk) + 'px;height:' + (O[3] * L.sk) + 'px', occ);

    // ---- numbers for the CSS
    var F = L.fin;
    var ax = (ENV.cardX - ENV.W / 2) * e, ay = (ENV.cardBottom - ENV.H / 2) * e;
    var bx = L.env.cx + ax * cs - ay * sn, by = L.env.cy + ax * sn + ay * cs;        // the card's bottom centre while it is in the envelope (stage)
    var dx = (F.cx - bx) / e, dy = (F.bottom - by) / e;
    var vars = {
      '--fx': px(dx * cs + dy * sn), '--fy': px(-dx * sn + dy * cs), '--c0': ENV.cardS.toFixed(5), '--c1': (F.s / e).toFixed(5),
      '--unrot': (-L.env.rot) + 'deg', '--out': ENV.out + 'px',
      '--camo': px(L.env.cx) + ' ' + px(L.env.cy), '--camz': L.cam.z, '--camx': px(L.cam.x - L.env.cx), '--camy': px(L.cam.y - L.env.cy),
      '--dy': px(-(L.env.cy + ENV.H * e / 2 + 40) / e)
    };
    Object.keys(vars).forEach(function (k) { stageEl.style.setProperty(k, vars[k]); });
    // the lantern's light on the room, around the flame of the settled card
    var gx = F.cx + (FLAME[0] - 0.5) * 480 * F.s, gy = F.bottom - (1 - FLAME[1]) * 672 * F.s, gr = 520;
    cam.insertBefore(el('div', 'lglow', 'left:' + (gx - gr) + 'px;top:' + (gy - gr) + 'px;width:' + (2 * gr) + 'px;height:' + (2 * gr) + 'px'), root);

    el('div', 'shade', null, stageEl);
    el('div', 'grain', null, stageEl);
    var hint = el('div', 'hint', 'top:' + L.hintY + 'px;font-size:' + L.hintSize + 'px', stageEl);
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    hint.textContent = (coarse ? 'Tap' : 'Click') + ' the envelope to open';

    state.name = nm;
    scaleStage();
    fitFace(face); fitName(nm, N.max, N.size);
    whenFonts(function () { fitFace(face); fitName(nm, N.max, N.size); });
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
  function still() {    // reduced motion: the envelope already lies on the scarf, the name is on the glass
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
    var sfx = state.L.scene.sfx, first = IMAGES.concat(['bg' + sfx + '.jpg', 'occ' + sfx + '.webp']), k;
    for (k = 1; k <= NFOG; k++) first.push('fog' + sfx + '-' + k + '.webp');
    var late = LATE.slice(); for (k = 1; k <= NLIT; k++) late.push('lit' + sfx + '-' + k + '.webp');
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
      fitFace(state.face); fitName(state.name, state.L.name.max, state.L.name.size);
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
