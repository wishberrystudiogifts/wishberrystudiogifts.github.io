/* Christmas Party invitation "The party's behind this door" — guest view + shared codec (26 Nov 2026).
   The three faces, the codec, the reply / calendar / directions buttons and the print view are the ones of the first
   Christmas Party invitation (20 Nov 2026); the scene, the envelope, its arrival, the opening and the finale are new
   and belong to this product only.
   ONE story:
     1. ARRIVAL  — a red front door on a snowy evening, the party seen through the side glass. The brass flap of the
                   letter slot lifts, a small kraft envelope slips out, drops on the doormat (a little snow jumps) and
                   is picked up: it comes to the viewer while the door goes out of focus behind it.
     2. OPENING  — tap: the red cord unwinds from the two buttons and drops with its little brass bell, the flap lifts
                   (Scottish plaid liner inside).
     3. THE CARD — the envelope is drawn down off the invitation: the card sits between the inside back and the FRONT
                   POCKET (a layer of its own above the card), so its lower part stays hidden until it is out.
     4. FINALE   — the door comes back into focus and opens a little: golden light falls out over the step, the mat and
                   the snow, the bells on the door swing, shadows of guests pass behind the side glass; the invitation
                   comes forward, the party details write in, and the "I'll be there" button rings like a doorbell.
   Details arrive inside the link (#m=...), are decoded in the browser and only ever inserted with textContent, so a
   crafted link cannot inject markup. Animation = CSS (transform / opacity only); this file builds the scene and
   switches the states. */
(function () {
  'use strict';
  var CFG = window.CARD_CONFIG || {};
  var A = CFG.assetBase || 'assets/';
  var LIMITS = { k: 40, t: 40, h: 50, d: 10, tm: 5, p: 120, n: 80, r: 40, c: 60, rd: 10 };
  var DEF = { k: 'You\u2019re invited to our', t: 'Christmas Party' };
  // three faces, the buyer picks one on the editor page (20 Nov 2026); the choice travels in the link as v
  var DESIGNS = { a: { name: 'Emerald & Gold', paper: false }, b: { name: 'Ivory & Holly', paper: true }, c: { name: 'Champagne Night', paper: false } };
  var DEF_DESIGN = 'b';
  function designOf(v) { return Object.prototype.hasOwnProperty.call(DESIGNS, v) ? v : DEF_DESIGN; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
    var o = {};
    Object.keys(LIMITS).forEach(function (k) { o[k] = typeof d[k] === 'string' ? d[k].slice(0, LIMITS[k]).trim() : ''; });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.d)) o.d = '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.rd)) o.rd = '';
    if (!/^\d{2}:\d{2}$/.test(o.tm)) o.tm = '';
    o.h = o.h.replace(/^hosted\s+by\s+/i, '');
    o.v = typeof d.v === 'string' && Object.prototype.hasOwnProperty.call(DESIGNS, d.v) ? d.v : '';
    return o;
  }
  function full(d) { // what the invitation shows: defaults for the two heading lines
    var x = {}; Object.keys(d).forEach(function (k) { x[k] = d[k]; });
    if (!x.k) x.k = DEF.k;
    if (!x.t) x.t = DEF.t;
    x.v = designOf(x.v);
    return x;
  }
  function readHash() {
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    var data = {};
    if (p.get('m')) { try { data = decode(p.get('m')); } catch (e) { data = {}; } }
    return { data: full(clean(data)), view: p.get('view') || '', size: p.get('size') || '', autoplay: p.get('autoplay') === '1' };
  }

  /* ---------- formatting ---------- */
  function dp(iso) { var a = iso.split('-').map(Number); return { y: a[0], m: a[1], d: a[2], wd: new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay() }; }
  function fmtDate(iso) { if (!iso) return ''; var p = dp(iso); return DAYS[p.wd] + ', ' + MONTHS[p.m - 1] + ' ' + p.d; }
  function fmtShort(iso) { if (!iso) return ''; var p = dp(iso); return MONTHS[p.m - 1] + ' ' + p.d; }
  function fmtTime(hm) { if (!hm) return ''; var a = hm.split(':').map(Number); return ((a[0] % 12) || 12) + ':' + (a[1] < 10 ? '0' : '') + a[1] + ' ' + (a[0] < 12 ? 'AM' : 'PM'); }
  function rsvpText(d) {
    if (!d.r && !d.rd && !d.c) return '';
    var s = 'RSVP';
    if (d.r) s += ' to ' + d.r;
    if (d.rd) s += ' by ' + fmtShort(d.rd);
    return s;
  }
  window.InviteCodec = { encode: encode, decode: decode, clean: clean, full: full, limits: LIMITS, defaults: DEF, designs: DESIGNS, defaultDesign: DEF_DESIGN, fmtDate: fmtDate, fmtTime: fmtTime, fmtShort: fmtShort, rsvpText: rsvpText };
  window.CardCodec = window.InviteCodec;

  /* ---------- tiny DOM helper ---------- */
  function el(tag, cls, style, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) e.setAttribute('style', style);
    if (parent) parent.appendChild(e);
    return e;
  }
  function img(src, cls, style, parent) { var i = el('img', cls, style, parent); i.alt = ''; i.decoding = 'sync'; i.src = src; return i; }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(markup, w, h, parent, style) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('width', w); s.setAttribute('height', h); s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    s.setAttribute('fill', 'none'); s.setAttribute('aria-hidden', 'true');
    if (style) s.setAttribute('style', style);
    s.innerHTML = markup; // static, trusted markup only
    parent.appendChild(s);
    return s;
  }
  var STAR = '<path d="M28 4l6 15 15 6-15 6-6 15-6-15-15-6 15-6z" fill="#CBA84C"/><path d="M28 10l4.5 11.5L44 26l-11.5 4.5L28 42l-4.5-11.5L12 26l11.5-4.5z" fill="#E8D08A" opacity="0.65"/>';
  var DOTS = '<g fill="#C9B88A"><circle cx="4" cy="4" r="3"/><circle cx="22" cy="4" r="3"/><circle cx="40" cy="4" r="3"/></g>';


  /* ---------- the invitation face with the party details ---------- */
  function buildFace(parent, data, print) {
    var v = designOf(data.v);
    var face = el('div', 'iface d-' + v, null, parent);
    img(A + (print ? 'print-' : 'front-') + v + '.jpg', 'art', null, face);
    if (!print && DESIGNS[v].paper) img(A + 'paper.jpg', 'paper', 'opacity:.16', face);
    var txt = el('div', 'itxt', null, face);
    var inner = el('div', 'iin', null, txt);
    function line(cls, text) { if (!text) return null; var e = el('div', cls, null, inner); e.textContent = text; return e; }
    line('kick', data.k);
    line('title', data.t);
    if (data.h) line('host', 'hosted by ' + data.h);
    var orn = el('div', 'orn', null, inner); el('i', null, null, orn); el('b', null, null, orn); el('i', null, null, orn);
    line('date', fmtDate(data.d));
    line('time', fmtTime(data.tm));
    line('place', data.p);
    line('note', data.n);
    line('rsvp', rsvpText(data));
    line('contact', data.c);
    return { root: face, txt: txt, inner: inner };
  }
  function fitFace(f) { // shrink everything together until the details fit the empty paper
    var size = 10, guard = 0;
    f.txt.style.fontSize = size + 'px';
    while (f.inner.scrollHeight > f.txt.clientHeight + 1 && size > 6.5 && guard++ < 60) { size -= 0.25; f.txt.style.fontSize = size + 'px'; }
  }
  function whenReady(f, cb) {
    var im = f.root.querySelector('img.art');
    var go = function () { fitFace(f); if (cb) cb(); };
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var pic = im && !im.complete ? new Promise(function (res) { im.onload = im.onerror = res; }) : Promise.resolve();
    fitFace(f);
    Promise.all([fonts, pic]).then(go, go);
  }

  /* ---------- scene and envelope geometry ----------
     Scene numbers are in the picture's own pixels (written by project/tools/build-scene-party.py); everything else is
     in stage units. Two pictures of the same doorway: upright for phones, wide (mirrored, so the handle is on the left
     in both) for wide screens. */
  var ENV = { W: 312, H: 430, cardS: 297 / 480, cardX: 156, cardBottom: 424, out: 436, pivot: [173.6, 254.8] };
  var BELLS = { w: 182, h: 400, hang: [0.451, 0.105] };
  var SCENES = {
    tall: { sfx: '', w: 1152, h: 2048, door: [349, 211, 420, 1080], slot: [497, 801, 122, 36], knock: [559, 452], bells: [481, 412, 173, 380],
      panes: [[204, 88, [[250, 208], [483, 210], [717, 211], [952, 210]]], [828, 80, [[250, 208], [483, 212], [718, 212], [952, 213]]]],
      mat: [315, 1378, 790, 1482], litA: [222, 200, 519, 1426], litB: [78, 1434, 1020, 615], lamp: [552, 78], gap: [349, 760] },
    wide: { sfx: '-land', w: 1728, h: 1296, door: [761, 152, 379, 858], slot: [892, 615, 117, 38], knock: [953, 338], bells: [891, 306, 137, 302],
      panes: [[594, 100, [[182, 182], [380, 168], [567, 164], [750, 172]]], [1206, 114, [[182, 182], [378, 172], [567, 168], [752, 173]]]],
      mat: [728, 1066, 1163, 1142], litA: [482, 140, 684, 1035], litB: [300, 1092, 1062, 205], lamp: [952, 30], gap: [761, 600] }
  };
  /* env: e = size of the held envelope, (cx, cy) = where it is held, rot = its tilt; fin: where the invitation settles
     (s = size, cx = centre, bottom = lower edge) - moved up, and made smaller only if it must, so the buttons never
     cover it; push: the door comes closer at the end (upright only), so the bells stay in view above the card */
  var LAYOUTS = {
    port: { W: 600, H: 1100, scene: SCENES.tall, sk: 1100 / 2048, sx: -9.375, sy: 0,
      env: { e: 0.95, cx: 300, cy: 640, rot: -2 }, fin: { s: 1.12, cx: 300, bottom: 962 }, push: { s: 1.25, y: -257 }, hintY: 968, hintSize: 21 },
    land: { W: 1200, H: 900, scene: SCENES.wide, sk: 0.764, sx: 0, sy: -50,
      env: { e: 0.9, cx: 310, cy: 420, rot: -2 }, fin: { s: 0.95, cx: 310, bottom: 772 }, push: { s: 1, y: 0 }, hintY: 842, hintSize: 16 }
  };
  // needed before the envelope may arrive / needed only after the tap (loaded meanwhile, never block the arrival)
  var IMAGES = ['env-dropshadow.png', 'env-pocket.webp', 'env-back.webp', 'env-flap.webp', 'env-flapshadow.png', 'env-cord1.webp', 'env-cord2.webp', 'env-cord3.webp', 'env-bell.webp', 'bells.webp'];
  var LATE = ['env-flapin.webp'];
  var T = { landed: 2700, autoplay: 3000, controls: 5300 };   // ms; all on the 100 ms grid (frame-by-frame video render)

  /* ---------- guest view ---------- */
  var stageEl = document.getElementById('stage');
  var ivwrap = document.getElementById('ivwrap');
  var ctl = document.getElementById('controls');
  var state = { timers: [], L: null, face: null, data: null, fin: null, landed: false, opened: false, pending: false, ready: false, finished: false };

  function pickLayout() { return (window.innerWidth / window.innerHeight) < 0.9 ? LAYOUTS.port : LAYOUTS.land; }
  function rnd(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function scaleStage() {
    var L = state.L; if (!L) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var s = Math.min(vw / L.W, vh / L.H);
    stageEl.style.width = L.W + 'px'; stageEl.style.height = L.H + 'px';
    stageEl.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    placeControls(s, vw, vh);
  }

  // Buttons sit under the card. The settled card is moved up - and made smaller only if it must - so the buttons never cover it.
  function placeControls(s, vw, vh) {
    var L = state.L, fin = { s: L.fin.s, cx: L.fin.cx, bottom: L.fin.bottom };
    var offX = (vw - L.W * s) / 2, offY = (vh - L.H * s) / 2;
    if (ctl) {
      var wide = L === LAYOUTS.land;
      ctl.classList.toggle('wide', wide);
      var w = Math.max(0, Math.min(vw - 20, wide ? 560 : 560));
      var cx = offX + fin.cx * s;
      var left = wide ? Math.max(10, Math.min(vw - 10 - w, cx - w / 2)) : (vw - w) / 2;
      ctl.style.width = w + 'px'; ctl.style.left = left + 'px'; ctl.style.right = 'auto';
      var rows = ctl.querySelector('.crows'), rr = rows ? rows.getBoundingClientRect() : null;
      var top = rr ? rr.top : vh;                                  // top of the button rows, px (an open choice panel sits above them)
      var maxBottom = (top - 12 - offY) / s, minTop = (10 - offY) / s;
      if (rr && rr.height > 0 && fin.bottom > maxBottom) fin.bottom = maxBottom;
      if (fin.bottom - 672 * fin.s < minTop) fin.s = Math.max(0.55, (fin.bottom - minTop) / 672);
    }
    state.fin = fin;
    setCardVars();
  }
  function curFin() { return state.fin || state.L.fin; }
  // where the invitation comes to rest, in the envelope's own units (the envelope is scaled and turned about its centre)
  function setCardVars() {
    var L = state.L; if (!L) return;
    var F = curFin(), e = L.env.e, th = L.env.rot * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
    var ax = (ENV.cardX - ENV.W / 2) * e, ay = (ENV.cardBottom - ENV.H / 2) * e;
    var sx = L.env.cx + ax * cs - ay * sn, sy = L.env.cy + ax * sn + ay * cs;        // the card's bottom centre while it is in the envelope (stage)
    var dx = (F.cx - sx) / e, dy = (F.bottom - sy) / e;
    stageEl.style.setProperty('--fx', (dx * cs + dy * sn).toFixed(2) + 'px');
    stageEl.style.setProperty('--fy', (-dx * sn + dy * cs).toFixed(2) + 'px');
    stageEl.style.setProperty('--c1', (F.s / e).toFixed(5));
  }

  function build(data) {
    var L = pickLayout(); state.L = L; state.data = data;
    stageEl.innerHTML = ''; stageEl.className = '';
    var W = L.W, H = L.H, S = L.scene, sfx = S.sfx, e = L.env.e, i, r = rnd(26);
    function st(x, y) { return [L.sx + x * L.sk, L.sy + y * L.sk]; }                 // scene px -> stage units
    var th = L.env.rot * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
    function loc(X, Y) { var dx = (X - L.env.cx) / e, dy = (Y - L.env.cy) / e; return [dx * cs + dy * sn, -dx * sn + dy * cs]; }   // stage -> offset in envelope units

    var cam = el('div', 'cam', null, stageEl);
    // ---- scene (the picture's own pixels, scaled once)
    var sc = el('div', 'scene', 'width:' + S.w + 'px;height:' + S.h + 'px;transform:translate(' + L.sx + 'px,' + L.sy + 'px) scale(' + L.sk + ')', cam);
    var push = el('div', 'push', 'transform-origin:' + (S.door[0] + S.door[2] / 2) + 'px 0', sc);
    img(A + 'bg' + sfx + '.jpg', 'bg', 'width:' + S.w + 'px;height:' + S.h + 'px', push);
    // shadows of guests passing behind the side glass (each pane is a little window of its own, so the glazing bars stay in front)
    S.panes.forEach(function (col, ci) {
      col[2].forEach(function (row) {
        var p = el('div', 'pane', 'left:' + col[0] + 'px;top:' + row[0] + 'px;width:' + col[1] + 'px;height:' + row[1] + 'px', push);
        el('i', 'guest g' + ci, 'top:' + (col[2][1][0] - 30 - row[0]) + 'px;--gw:' + (col[1] + 190) + 'px', p);
        el('b', 'warm w' + ci, null, p);
      });
    });
    // the doorway: what is behind the door, and the leaf that turns on its hinges (right side)
    var D = S.door, dw = el('div', 'doorway', 'left:' + D[0] + 'px;top:' + D[1] + 'px;width:' + D[2] + 'px;height:' + D[3] + 'px', push);
    img(A + 'interior' + sfx + '.jpg', 'interior', null, dw);
    var leaf = el('div', 'leaf', null, dw);
    img(A + 'door' + sfx + '.jpg', 'door', null, leaf);
    var sl = S.slot;
    el('div', 'slit', 'left:' + (sl[0] - D[0] + 5) + 'px;top:' + (sl[1] - D[1] + 5) + 'px;width:' + (sl[2] - 10) + 'px;height:' + (sl[3] - 10) + 'px', leaf);
    img(A + 'slot' + sfx + '.jpg', 'slotflap', null, el('div', 'slotbox', 'left:' + (sl[0] - D[0]) + 'px;top:' + (sl[1] - D[1]) + 'px;width:' + sl[2] + 'px;height:' + sl[3] + 'px', leaf));
    el('div', 'leafshade', null, leaf);
    var B = S.bells;
    img(A + 'bells.webp', 'bells', 'left:' + (B[0] - D[0]) + 'px;top:' + (B[1] - D[1]) + 'px;width:' + B[2] + 'px;height:' + B[3] + 'px;transform-origin:' + (BELLS.hang[0] * 100) + '% ' + (BELLS.hang[1] * 100) + '%', leaf);
    // light that falls out of the door: near (jamb, step, mat) and far (the snow), then the glow at the gap and the lamp
    img(A + 'lit-a' + sfx + '.webp', 'lit a', 'left:' + S.litA[0] + 'px;top:' + S.litA[1] + 'px;width:' + S.litA[2] + 'px;height:' + S.litA[3] + 'px', push);
    img(A + 'lit-b' + sfx + '.webp', 'lit b', 'left:' + S.litB[0] + 'px;top:' + S.litB[1] + 'px;width:' + S.litB[2] + 'px;height:' + S.litB[3] + 'px', push);
    var gr = D[3] * 0.62;
    el('div', 'gapglow', 'left:' + (S.gap[0] + 26 - gr) + 'px;top:' + (S.gap[1] - gr) + 'px;width:' + (2 * gr) + 'px;height:' + (2 * gr) + 'px', push);
    el('div', 'lampglow', 'left:' + (S.lamp[0] - 260) + 'px;top:' + (S.lamp[1] - 260) + 'px;width:520px;height:520px', push);
    // the same picture out of focus (bells included): shown while the envelope is held up
    img(A + 'bg-blur' + sfx + '.jpg', 'blur', 'width:' + S.w + 'px;height:' + S.h + 'px', sc);

    // ---- where the envelope comes from: the slot, the mat
    var slotC = st(sl[0] + sl[2] / 2, sl[1] + sl[3] / 2), matC = st((S.mat[0] + S.mat[2]) / 2, (S.mat[1] + S.mat[3]) / 2);
    var eS = D[2] * L.sk * 0.215 / ENV.W, hS = ENV.H * eS;                             // the envelope at the door's own scale
    var s0 = loc(slotC[0], slotC[1] + 1), s1 = loc(slotC[0], slotC[1] + hS / 2 + 2), m1 = loc(slotC[0] + 5, matC[1] - hS / 2 + 4), m2 = loc(slotC[0] + 9, matC[1] + 3);
    function px(v) { return v.toFixed(2) + 'px'; }
    [['--s0x', s0[0]], ['--s0y', s0[1]], ['--s1x', s1[0]], ['--s1y', s1[1]], ['--m1x', m1[0]], ['--m1y', m1[1]], ['--m2x', m2[0]], ['--m2y', m2[1]]].forEach(function (v) { stageEl.style.setProperty(v[0], px(v[1])); });
    stageEl.style.setProperty('--ks', (eS / e).toFixed(5));
    stageEl.style.setProperty('--camo', px(slotC[0]) + ' ' + px((slotC[1] + matC[1]) / 2 + 30));
    stageEl.style.setProperty('--out', ENV.out + 'px');
    stageEl.style.setProperty('--c0', ENV.cardS.toFixed(5));
    stageEl.style.setProperty('--unrot', (-L.env.rot) + 'deg');
    stageEl.style.setProperty('--pushs', L.push.s);
    stageEl.style.setProperty('--pushy', (L.push.y / L.sk).toFixed(1) + 'px');
    // a little snow jumps where it lands; its shadow on the mat
    el('div', 'matsh', 'left:' + (matC[0] - 34) + 'px;top:' + (matC[1] - 4) + 'px', cam);
    var puff = el('div', 'puff', 'left:' + (slotC[0] + 7) + 'px;top:' + (matC[1] + 6) + 'px', cam);
    for (i = 0; i < 16; i++) {
      var ang = Math.PI * (0.08 + 0.84 * r()), dist = 14 + r() * 34, ps = 2 + r() * 4.5;
      el('i', null, 'width:' + ps.toFixed(1) + 'px;height:' + ps.toFixed(1) + 'px;--px:' + (Math.cos(ang) * dist * (r() < .5 ? -1 : 1)).toFixed(0) + 'px;--py:' + (-Math.sin(ang) * dist * 0.75).toFixed(0) + 'px;--dl:' + (1.16 + r() * 0.08).toFixed(2) + 's', puff);
    }

    // ---- envelope: inside back -> invitation -> FRONT POCKET -> flap, cord and bell
    var root = el('div', 'envroot', 'left:' + (L.env.cx - ENV.W / 2) + 'px;top:' + (L.env.cy - ENV.H / 2) + 'px;transform:rotate(' + L.env.rot + 'deg) scale(' + e + ')', cam);
    var fall = el('div', 'fall', null, root);
    img(A + 'env-dropshadow.png', 'full eshadow', null, el('div', 'eg', null, fall));
    var envB = el('div', 'eg envB', null, fall);
    img(A + 'env-back.webp', 'full', null, envB);
    img(A + 'env-flapin.webp', 'flapin', null, el('div', 'flapBbox', null, envB));
    var rig = el('div', 'cardrig', null, fall);
    var card = el('div', 'card', null, rig);
    var face = buildFace(card, data, false);
    el('div', 'gloss', null, face.root);
    el('div', 'doorlight', null, face.root);     // the light from the open door on the paper
    var envF = el('div', 'eg envF', null, fall);
    img(A + 'env-pocket.webp', 'full', null, envF);
    var label = el('div', 'elabel', null, envF); label.textContent = 'You’re invited';
    img(A + 'env-flapshadow.png', 'full flapsh', null, envF);
    img(A + 'env-flap.webp', 'full flapF', null, el('div', 'flapFbox', null, envF));
    [3, 2, 1].forEach(function (k) { img(A + 'env-cord' + k + '.webp', 'full cord c' + k, null, envF); });
    img(A + 'env-bell.webp', 'full ebell', 'transform-origin:' + ENV.pivot[0] + 'px ' + ENV.pivot[1] + 'px', el('div', 'eg bellfall', null, envF));

    var hint = el('div', 'hint', 'top:' + L.hintY + 'px;font-size:' + L.hintSize + 'px;' + (L === LAYOUTS.land ? 'left:' + (L.env.cx - 300) + 'px;right:auto;width:600px' : ''), stageEl);
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    hint.textContent = (coarse ? 'Tap' : 'Click') + ' the envelope to open';

    state.face = face; state.card = card;
    scaleStage();
    whenReady(face);
  }

  /* ---------- states ---------- */
  function clearTimers() { state.timers.forEach(clearTimeout); state.timers = []; }
  function later(fn, ms) { state.timers.push(setTimeout(fn, ms)); }
  function controls(show) { if (ctl) ctl.classList.toggle('show', !!show); if (!show) closeChoice(); }

  function arrive() {   // the envelope comes out of the letter slot; called only when its pictures are decoded
    clearTimers();
    state.landed = false; state.opened = false; state.finished = false;
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
  function still() {    // reduced motion: the envelope is already held up
    clearTimers();
    stageEl.classList.remove('open', 'arrive', 'instant', 'done', 'wait');
    stageEl.classList.add('still', 'landed');
    state.landed = true; state.opened = false; state.finished = false;
    controls(false);
  }
  function open() {
    if (state.opened || !state.ready) return;
    if (!state.landed) { state.pending = true; stageEl.classList.add('wait'); return; }
    state.opened = true;
    stageEl.classList.remove('wait');
    scaleStage();
    if (state.reduce) stageEl.classList.add('instant');
    stageEl.classList.add('open');
    later(function () { state.finished = true; stageEl.classList.add('done'); controls(true); }, state.reduce ? 300 : T.controls);
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
    var S = state.L.scene, v = designOf(state.data.v);
    var first = IMAGES.concat(['bg' + S.sfx + '.jpg', 'bg-blur' + S.sfx + '.jpg', 'door' + S.sfx + '.jpg', 'slot' + S.sfx + '.jpg', 'front-' + v + '.jpg']);
    LATE.concat(['interior' + S.sfx + '.jpg', 'lit-a' + S.sfx + '.webp', 'lit-b' + S.sfx + '.webp']).forEach(loadOne);
    var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load("400 30px 'Petit Formal Script'"), document.fonts.load("400 16px 'Libre Caslon Text'"), document.fonts.ready]) : Promise.resolve();
    var limit = new Promise(function (res) { setTimeout(res, 6000); });
    return Promise.race([Promise.all(first.map(loadOne).concat([fonts])), limit]);
  }

  /* ---------- RSVP, calendar, directions ---------- */
  function contactKind(c) {
    if (!c) return '';
    if (/@/.test(c)) return 'email';
    return (c.replace(/\D/g, '').length >= 6) ? 'phone' : '';
  }
  function isApple() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document); }
  function rsvpMessage(d, yes) {
    var who = d.r ? 'Hi ' + d.r + '! ' : 'Hi! ';
    var when = d.d ? ' on ' + fmtDate(d.d) : '';
    return yes ? who + 'Yes, I\u2019ll be at the ' + d.t + when + '. Can\u2019t wait! \uD83C\uDF84'
               : who + 'Thank you for inviting me to the ' + d.t + '. Sorry, I can\u2019t make it this time. Merry Christmas! \uD83C\uDF84';
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(y, mo, d, h, mi) { return '' + y + pad(mo) + pad(d) + 'T' + pad(h) + pad(mi) + '00'; }
  function eventTimes(d) { // floating local time; 3 hours by default
    var p = dp(d.d);
    if (!d.tm) { var nx = new Date(Date.UTC(p.y, p.m - 1, p.d + 1)); return { allDay: true, start: '' + p.y + pad(p.m) + pad(p.d), end: '' + nx.getUTCFullYear() + pad(nx.getUTCMonth() + 1) + pad(nx.getUTCDate()) }; }
    var t = d.tm.split(':').map(Number);
    var s = new Date(Date.UTC(p.y, p.m - 1, p.d, t[0], t[1])), e = new Date(s.getTime() + 3 * 3600 * 1000);
    return { allDay: false, start: stamp(p.y, p.m, p.d, t[0], t[1]), end: stamp(e.getUTCFullYear(), e.getUTCMonth() + 1, e.getUTCDate(), e.getUTCHours(), e.getUTCMinutes()) };
  }
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function eventDetails(d) {
    var a = [];
    if (d.h) a.push('Hosted by ' + d.h);
    if (d.n) a.push(d.n);
    var r = rsvpText(d); if (r) a.push(r + (d.c ? ' \u2014 ' + d.c : ''));
    return a.join('\n');
  }
  function icsFile(d) {
    var t = eventTimes(d), now = new Date();
    var dtstamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WishberrystudioGifts//Invitation//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + Date.now().toString(36) + Math.random().toString(36).slice(2) + '@wishberrystudiogifts.github.io', 'DTSTAMP:' + dtstamp,
      t.allDay ? 'DTSTART;VALUE=DATE:' + t.start : 'DTSTART:' + t.start, t.allDay ? 'DTEND;VALUE=DATE:' + t.end : 'DTEND:' + t.end,
      'SUMMARY:' + icsEsc(d.t + (d.h ? ' \u2014 ' + d.h : ''))];
    if (d.p) L.push('LOCATION:' + icsEsc(d.p));
    var det = eventDetails(d); if (det) L.push('DESCRIPTION:' + icsEsc(det));
    L.push('END:VEVENT', 'END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }
  function googleCal(d) {
    var t = eventTimes(d);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(d.t + (d.h ? ' \u2014 ' + d.h : '')) +
      '&dates=' + t.start + '/' + t.end + (d.p ? '&location=' + encodeURIComponent(d.p) : '') + '&details=' + encodeURIComponent(eventDetails(d));
  }
  function mapsUrl(place) {
    return isApple() ? 'https://maps.apple.com/?q=' + encodeURIComponent(place) : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place);
  }

  var choiceEl = null;
  function closeChoice() { if (choiceEl) { choiceEl.innerHTML = ''; choiceEl.hidden = true; } }
  function showChoice(title, items) {
    if (!choiceEl) return;
    choiceEl.innerHTML = '';
    var h = el('div', 'chtitle', null, choiceEl); h.textContent = title;
    var row = el('div', 'crow', null, choiceEl);
    items.forEach(function (it) {
      var a = el(it.href ? 'a' : 'button', 'cbtn', null, row);
      a.textContent = it.label;
      if (it.href) { a.href = it.href; if (it.blank) { a.target = '_blank'; a.rel = 'noopener'; } }
      else a.type = 'button';
      if (it.download) a.setAttribute('download', it.download);
    });
    var x = el('button', 'cbtn ghost', null, row); x.type = 'button'; x.textContent = 'Close'; x.addEventListener('click', closeChoice);
    choiceEl.hidden = false;
  }
  function rsvp(yes) {
    var d = state.data, kind = contactKind(d.c), msg = rsvpMessage(d, yes);
    var items = [];
    if (kind === 'phone') {
      var num = d.c.replace(/[^\d+]/g, ''), digits = num.replace(/\D/g, '').replace(/^00/, '');
      items.push({ label: 'Text message', href: 'sms:' + num + '?&body=' + encodeURIComponent(msg) });
      if (digits.length >= 8) items.push({ label: 'WhatsApp', href: 'https://wa.me/' + digits + '?text=' + encodeURIComponent(msg), blank: true });
    } else if (kind === 'email') {
      items.push({ label: 'Email', href: 'mailto:' + encodeURIComponent(d.c).replace(/%40/g, '@') + '?subject=' + encodeURIComponent('RSVP: ' + d.t) + '&body=' + encodeURIComponent(msg) });
    }
    if (!items.length) return;
    showChoice(yes ? 'Tell ' + (d.r || 'the host') + ' you\u2019re coming \u2014 your reply is ready to send:' : 'Let ' + (d.r || 'the host') + ' know \u2014 your reply is ready to send:', items);
  }
  function calendar() {
    var d = state.data, url = null;
    try { url = URL.createObjectURL(new Blob([icsFile(d)], { type: 'text/calendar;charset=utf-8' })); } catch (e) {}
    var items = [];
    if (url) items.push({ label: isApple() ? 'Apple Calendar' : 'Calendar file (.ics)', href: url, download: 'christmas-party.ics' });
    items.push({ label: 'Google Calendar', href: googleCal(d), blank: true });
    showChoice('Add the party to your calendar:', items);
  }
  function buildControls(d) {
    if (!ctl) return;
    ctl.innerHTML = '';
    choiceEl = el('div', 'choice', null, ctl); choiceEl.hidden = true;
    var rows = el('div', 'crows', null, ctl);
    var kind = contactKind(d.c);
    if (kind) {
      var r1 = el('div', 'crow', null, rows);
      var y = el('button', 'cbtn yes ring', null, r1); y.type = 'button'; y.textContent = '\u2713 I\u2019ll be there'; y.addEventListener('click', function () { rsvp(true); });
      var no = el('button', 'cbtn', null, r1); no.type = 'button'; no.textContent = 'Can\u2019t make it'; no.addEventListener('click', function () { rsvp(false); });
    }
    var r2 = el('div', 'crow', null, rows);
    if (d.d) { var c = el('button', 'cbtn', null, r2); c.type = 'button'; c.textContent = 'Add to calendar'; c.addEventListener('click', calendar); }
    if (d.p) { var m = el('a', 'cbtn', null, r2); m.textContent = 'Directions'; m.href = mapsUrl(d.p); m.target = '_blank'; m.rel = 'noopener'; }
    var r3 = el('div', 'crow', null, rows);
    var rp = el('button', 'cbtn ghost again', null, r3); rp.type = 'button';
    rp.setAttribute('aria-label', 'Watch again'); rp.title = 'Watch again';
    var ic = el('span', null, null, rp); ic.textContent = '\u21BB'; ic.setAttribute('aria-hidden', 'true');
    var lb = el('span', 'lbl', null, rp); lb.textContent = ' Watch again';
    rp.addEventListener('click', function () { if (!state.ready) return; state.autoplay = true; if (state.reduce) { still(); open(); } else arrive(); });
    if (CFG.shopUrl) { var s = el('a', 'cbtn shop', null, r3); s.textContent = 'Send an invitation like this'; s.href = CFG.shopUrl; s.target = '_blank'; s.rel = 'noopener'; }
  }

  /* ---------- face-only view (editor live preview) ---------- */
  function buildFaceView(data) {
    document.body.classList.add('inside-view'); document.documentElement.classList.add('inside-view');
    ivwrap.innerHTML = '';
    var f = buildFace(ivwrap, data, false);
    function sc() { var s = Math.min(window.innerWidth / 480, window.innerHeight / 672); ivwrap.style.transform = 'translate(-50%,-50%) scale(' + s + ')'; }
    sc(); window.onresize = sc;
    whenReady(f);
  }

  /* ---------- print view: 5x7 card, or Letter / A4 with cut marks ---------- */
  function buildPrintView(data, size) {
    size = size === 'letter' || size === 'a4' ? size : '5x7';
    document.documentElement.classList.add('print-view'); document.body.classList.add('print-view');
    var st = document.createElement('style');
    st.textContent = '@page{size:' + (size === 'letter' ? '8.5in 11in' : size === 'a4' ? '210mm 297mm' : '5in 7in') + ';margin:0}';
    document.head.appendChild(st);
    document.body.innerHTML = '';
    var bar = el('div', 'pbar', null, document.body);
    var p1 = el('p', null, null, bar); p1.textContent = size === '5x7' ? 'Your invitation, 5 \u00d7 7 in \u2014 for a print shop or 5\u00d77 card stock.' : 'Your invitation on ' + (size === 'a4' ? 'A4' : 'US Letter') + ' paper \u2014 cut along the corner marks (5 \u00d7 7 in).';
    var p2 = el('p', null, null, bar); p2.textContent = 'In the print window choose \u201cActual size\u201d or 100% (not \u201cFit\u201d), turn off headers and footers, and turn on background graphics. For a PDF, choose \u201cSave as PDF\u201d.';
    var pb = el('button', null, null, bar); pb.type = 'button'; pb.textContent = 'Print / Save as PDF'; pb.addEventListener('click', function () { window.print(); });
    var sheet = el('div', 'psheet s-' + size, null, document.body);
    var cardBox = el('div', 'pcard', null, sheet);
    if (size !== '5x7') ['tl', 'tr', 'bl', 'br'].forEach(function (c) { el('i', 'mk h ' + c, null, cardBox); el('i', 'mk v ' + c, null, cardBox); });
    var f = buildFace(cardBox, data, true);
    whenReady(f, function () { setTimeout(function () { window.print(); }, 350); });
  }

  /* ---------- boot ---------- */
  function boot() {
    var h = readHash();
    if (h.view === 'face' && ivwrap) { buildFaceView(h.data); return; }
    if (h.view === 'print') { buildPrintView(h.data, h.size); return; }
    if (!stageEl) return;
    clearTimers();
    state.autoplay = h.autoplay; state.ready = false; state.pending = false;
    state.reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    buildControls(h.data);
    build(h.data);
    preload().then(function () {
      state.ready = true;
      fitFace(state.face); scaleStage();
      if (state.reduce) still(); else arrive();
    });
  }
  if (stageEl || ivwrap) {
    if (stageEl) {
      stageEl.addEventListener('click', open);
      stageEl.setAttribute('role', 'button'); stageEl.setAttribute('tabindex', '0');
      stageEl.setAttribute('aria-label', 'Open your invitation');
      stageEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      window.addEventListener('resize', function () {
        if (!state.data || document.body.classList.contains('inside-view') || document.body.classList.contains('print-view')) return;
        var L = pickLayout();
        if (L !== state.L && !state.opened) { boot(); } else { scaleStage(); }
      });
    }
    // NEW STANDARD (product link, Nov 2026): the page is shown only for a link that may be shown —
    // in mode 'hash' that is a correctly signed invitation link (or the buyer's own preview); in mode 'direct' every link.
    // If the shared code did not load, the page stays closed (it never opens "just in case").
    var start = window.ProductLink ? window.ProductLink.guard(boot) : function () { document.body.textContent = 'This page could not load completely. Please reload it.'; };
    window.addEventListener('hashchange', function () { if (!document.body.classList.contains('print-view')) start(); });
    start();
  }
})();
