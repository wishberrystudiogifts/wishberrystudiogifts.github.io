/* LAB COPY (24 Nov 2026) of the animated CHRISTMAS PARTY INVITATION — guest view + shared codec — as it was on main at acf50e1.
   The only change against /christmas-party/invite.js is the guarded start at the very end (ProductLink.guard).
   Same scene, envelope and opening as /christmas/: the flat invitation rises out of the envelope, settles,
   and the party details write in; then RSVP, "Add to calendar" and "Directions" buttons appear.
   Details arrive inside the link (#m=...), are decoded in the browser and only ever inserted with
   textContent, so a crafted link cannot inject markup. Nothing is sent to any server. */
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
  function img(src, cls, style, parent) { var i = el('img', cls, style, parent); i.src = src; i.alt = ''; return i; }
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

  /* ---------- layouts (stage units) ---------- */
  // card/env/area = /christmas/; fin = where the invitation settles after the envelope is gone (bigger, easier to read)
  var LAYOUTS = {
    land: { W: 1200, H: 900, bgPos: '22% center', area: { x: 80, y: 81, w: 960, h: 700 },
      card: { left: 480, bottom: 180, s: 0.72, hide: 640 }, fin: { s: 0.95, ty: 125 }, env: { cx: 720, bottom: 0, s: 1, clip: 5 },
      hintY: 818, hintSize: 15, shadow: { cx: 820, cy: 800, rx: 310 } },
    port: { W: 600, H: 1100, bgPos: '20% center', area: { x: 0, y: 0, w: 600, h: 984 },
      card: { left: 60, bottom: 229, s: 0.9, hide: 640 }, fin: { s: 1.16, ty: 127 }, env: { cx: 300, bottom: 0, s: 1.2, clip: 6 },
      hintY: 1028, hintSize: 22, shadow: { cx: 300, cy: 990, rx: 270 } }
  };

  /* ---------- guest view ---------- */
  var stageEl = document.getElementById('stage');
  var ivwrap = document.getElementById('ivwrap');
  var ctl = document.getElementById('controls');
  var state = { playing: false, timers: [], L: null, face: null, data: null, fin: null };

  function pickLayout() { return (window.innerWidth / window.innerHeight) < 0.9 ? LAYOUTS.port : LAYOUTS.land; }

  function scaleStage() {
    var L = state.L; if (!L) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var s = Math.min(vw / L.W, vh / L.H);
    stageEl.style.width = L.W + 'px'; stageEl.style.height = L.H + 'px';
    stageEl.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    placeControls(s, vw, vh);
  }

  // Buttons sit under the card (wide screens: centred on the card, which stands right of centre).
  // The settled card is moved up - and made smaller only if it must - so the buttons never cover it.
  function placeControls(s, vw, vh) {
    var L = state.L, fin = { s: L.fin.s, ty: L.fin.ty };
    var offX = (vw - L.W * s) / 2, offY = (vh - L.H * s) / 2;
    if (ctl) {
      var wide = L === LAYOUTS.land;
      ctl.classList.toggle('wide', wide);
      var w = Math.max(0, Math.min(vw - 20, wide ? 760 : 560));
      var cx = offX + (L.area.x + L.card.left + 240) * s;
      var left = wide ? Math.max(10, Math.min(vw - 10 - w, cx - w / 2)) : (vw - w) / 2;
      ctl.style.width = w + 'px'; ctl.style.left = left + 'px'; ctl.style.right = 'auto';
      var rows = ctl.querySelector('.crows'), rr = rows ? rows.getBoundingClientRect() : null;
      var top = rr ? rr.top : vh;                                  // top of the button rows, px (an open choice panel sits above them)
      var base = L.area.y + L.area.h - L.card.bottom;             // card bottom before the settle shift (stage units)
      var maxBottom = (top - 12 - offY) / s, minTop = (10 - offY) / s;
      if (rr && rr.height > 0 && base + fin.ty > maxBottom) {
        var fs = Math.max(0.55, Math.min(fin.s, (maxBottom - minTop) / 672));
        fin.s = fs;
        fin.ty = Math.min(maxBottom, minTop + 672 * fs) - base;
      }
    }
    state.fin = fin;
    if (state.finished && state.n) state.n.card.style.transform = 'translateY(' + fin.ty + 'px) scale(' + fin.s + ')';
  }
  function curFin() { return state.fin || state.L.fin; }

  function build(data) {
    var L = pickLayout(); state.L = L; state.data = data;
    stageEl.innerHTML = '';
    var W = L.W, H = L.H;
    img(A + 'bg.jpg', 'bg', 'object-position:' + L.bgPos, stageEl);
    svg('<defs><radialGradient id="avig" cx="0.5" cy="0.45" r="0.78"><stop offset="58%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.34"/></radialGradient>' +
      '<filter id="ab10" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="11"/></filter></defs>' +
      '<ellipse cx="' + L.shadow.cx + '" cy="' + L.shadow.cy + '" rx="' + L.shadow.rx + '" ry="26" fill="#1A0505" opacity="0.45" filter="url(#ab10)"/>' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#avig)"/>', W, H, stageEl, 'position:absolute;left:0;top:0');

    // ambient motes (always on)
    var motes = el('div', 'motes', null, stageEl);
    [[0.838, 0.826, 9, .25, -12, -107, 13.3, 6.2], [0.878, 0.691, 9, .23, -37, -62, 13.0, .8], [0.137, 0.671, 8, .28, -20, -129, 13.8, 5.2],
     [0.174, 0.367, 5, .18, 58, -89, 10, 1.9], [0.818, 0.669, 6, .26, -39, -72, 11.6, 5.1], [0.541, 0.564, 9, .29, 20, -101, 14, 6.7]].forEach(function (m) {
      el('div', null, 'position:absolute;left:' + (m[0] * W) + 'px;top:' + (m[1] * H) + 'px;width:' + m[2] + 'px;height:' + m[2] + 'px;border-radius:50%;' +
        'background:radial-gradient(circle,rgba(246,205,130,.75),rgba(255,255,255,0));filter:blur(2px);--mo:' + m[3] + ';--mx:' + m[4] + 'px;--my:' + m[5] + 'px;' +
        'animation:motedrift ' + m[6] + 's ease-in-out ' + m[7] + 's infinite;opacity:0', motes);
    });

    var fxBack = el('div', 'fxback', null, stageEl);
    var area = el('div', 'area', 'left:' + L.area.x + 'px;top:' + L.area.y + 'px;width:' + L.area.w + 'px;height:' + L.area.h + 'px', stageEl);


    // card (flat invitation)
    // the card sits in a clip box that ends just above the envelope's soft bottom edge,
    // so it never shows under the envelope (env.clip = faded edge of env-body x scale, rounded up; 17 Nov 2026)
    var cardClip = el('div', 'cardclip', 'clip-path:inset(0 0 ' + (L.env.bottom + L.env.clip) + 'px 0)', area);
    var card = el('div', 'card', 'left:' + L.card.left + 'px;bottom:' + L.card.bottom + 'px', cardClip);
    var face = buildFace(card, data, false);
    el('div', 'gloss', null, face.root);

    // envelope (outer = scale, inner = fade)
    var envX = L.env.cx - 210;
    var envOuter = el('div', 'envwrap', 'left:' + envX + 'px;bottom:' + L.env.bottom + 'px;transform:scale(' + L.env.s + ')', area);
    var envInner = el('div', null, 'position:absolute;inset:0', envOuter);
    img(A + 'env-body.webp', 'env-body', null, envInner);
    var tag = el('div', 'tag', null, envInner);
    tag.textContent = 'You\u2019re invited';
    var flapbox = el('div', 'flapbox', null, envInner);
    var flap = el('div', 'flap', null, flapbox);
    img(A + 'env-flap.webp', null, null, flap);
    el('div', 'inner', null, flap);

    var crumOuter = el('div', 'crumwrap', 'left:' + envX + 'px;bottom:' + L.env.bottom + 'px;transform:scale(' + L.env.s + ')', area);
    var crum = el('div', 'crum', null, crumOuter);
    img(A + 'env-crumpled.webp', null, null, crum);

    var fx = el('div', 'fx', null, stageEl);
    var hint = el('div', 'hint', 'top:' + L.hintY + 'px;font-size:' + L.hintSize + 'px;' + (L === LAYOUTS.land ? 'left:' + (L.env.cx + L.area.x - 300) + 'px;right:auto;width:600px' : ''), stageEl);
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    hint.textContent = (coarse ? 'Tap' : 'Click') + ' the envelope to open';

    state.face = face;
    state.n = { card: card, txt: face.txt, envInner: envInner, flap: flap, crum: crum, fx: fx, fxBack: fxBack, hint: hint };
    reset();
    scaleStage();
    whenReady(face);
  }

  function T(e, v) { e.style.transition = v; }
  function reset() {
    var n = state.n, L = state.L;
    state.timers.forEach(clearTimeout); state.timers = [];
    state.playing = false; state.finished = false;
    [n.card, n.flap, n.envInner, n.txt].forEach(function (e) { T(e, 'none'); });
    n.card.style.transform = 'translateY(' + L.card.hide + 'px) scale(' + L.card.s + ')';
    n.txt.style.opacity = '0';
    n.flap.style.transform = 'rotateX(0deg)';
    n.envInner.style.opacity = '1';
    n.crum.style.animation = 'none'; n.crum.style.opacity = '0';
    n.fx.innerHTML = ''; n.fxBack.innerHTML = '';
    n.hint.classList.remove('off');
    stageEl.classList.remove('done');
    if (ctl) ctl.classList.remove('show');
    closeChoice();
    void stageEl.offsetWidth; // commit the reset before any new transition
  }

  function play() {
    if (state.playing) return;
    var n = state.n, L = state.L;
    state.playing = true;
    n.hint.classList.add('off');
    T(n.flap, 'transform 1.15s cubic-bezier(0.34, 1.18, 0.5, 1) 0s');
    n.flap.style.transform = 'rotateX(-78deg)';
    T(n.card, 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1) 0.55s');
    n.card.style.transform = 'translateY(0px) scale(' + L.card.s + ')';
    T(n.envInner, 'opacity 0.3s ease 2.35s');
    n.envInner.style.opacity = '0';
    n.crum.style.animation = 'crumpleaway 1.8s cubic-bezier(0.45, 0, 0.6, 1) 2.3s both';
    state.timers.push(setTimeout(function () { // settle: a little bigger, centred, easy to read, clear of the buttons
      scaleStage();
      var F = curFin();
      T(n.card, 'transform 1.2s cubic-bezier(0.45, 0, 0.2, 1) 0s');
      n.card.style.transform = 'translateY(' + F.ty + 'px) scale(' + F.s + ')';
    }, 2700));
    T(n.txt, 'opacity 1.2s ease 3.5s');
    n.txt.style.opacity = '1';
    state.timers.push(setTimeout(startFx, 3900));
    state.timers.push(setTimeout(function () {
      state.finished = true; stageEl.classList.add('done');
      if (ctl) ctl.classList.add('show');
    }, 5300));
  }

  function finishNow() { // reduced motion: show the invitation straight away
    var n = state.n, F = curFin();
    n.hint.classList.add('off');
    n.card.style.transform = 'translateY(' + F.ty + 'px) scale(' + F.s + ')';
    n.envInner.style.opacity = '0';
    n.txt.style.opacity = '1';
    state.playing = true; state.finished = true; stageEl.classList.add('done');
    if (ctl) ctl.classList.add('show');
  }

  /* ---------- effects (Christmas Party, own concept 21 Nov 2026): sparks from the card, party string lights that switch on bulb by bulb, a slow fall of gold stars and holly leaves ---------- */
  function startFx() {
    var L = state.L, fx = state.n.fx, fxb = state.n.fxBack, W = L.W, H = L.H;
    // card geometry in stage units
    var F = curFin(), cw = 480 * F.s, ch = 672 * F.s;   // invitation: sparks start from the card where it settles
    var cx = L.area.x + L.card.left + 240, bottom = L.area.y + L.area.h - L.card.bottom + F.ty, top = bottom - ch;
    var k = W / 1200;
    // sparks
    var sp = el('div', null, 'position:absolute;left:' + (cx + 0.013 * W) + 'px;top:' + (top + 0.35 * ch) + 'px;width:0;height:0;z-index:6', fx);
    [[9, '#F2C14E', -240, -200, 1.5, .6], [7, '#F7D98C', -150, -290, 1.4, .65], [8, '#CBA84C', -60, -330, 1.5, .6], [9, '#F2C14E', 60, -320, 1.45, .68],
     [7, '#F7D98C', 160, -280, 1.4, .62], [9, '#CBA84C', 250, -190, 1.5, .66], [6, '#A33434', -200, -110, 1.3, .7], [6, '#A33434', 210, -100, 1.3, .72],
     [6, '#F4ECDD', -290, -40, 1.35, .64], [6, '#F4ECDD', 300, -30, 1.35, .6], [7, '#F2C14E', -120, -180, 1.2, 1.15], [7, '#F7D98C', 0, -240, 1.2, 1.2],
     [7, '#F2C14E', 130, -170, 1.2, 1.18], [5, '#CBA84C', -70, -120, 1.15, 1.25], [5, '#CBA84C', 80, -110, 1.15, 1.22]].forEach(function (s) {
      el('div', null, 'position:absolute;width:' + s[0] + 'px;height:' + s[0] + 'px;border-radius:50%;background:' + s[1] + ';--dx:' + (s[2] * Math.max(k, .6)) + 'px;--dy:' + s[3] + 'px;animation:spark ' + s[4] + 's ease-out ' + s[5] + 's forwards;opacity:0', sp);
    });
    // party string lights: two swags across the top, behind the card; bulbs switch on one by one, then twinkle
    var port = L === LAYOUTS.port, kb = port ? 1.25 : 1.45;
    var y0s = port ? 8 : 6, sag = port ? 58 : 84;
    var lights = el('div', null, 'position:absolute;inset:0;opacity:0;animation:wirein .7s ease-out forwards', fxb);
    var wire = '', pts = [], swags = [[-0.02 * W, 0.5 * W], [0.5 * W, 1.02 * W]];
    swags.forEach(function (sw, si) {
      var xa = sw[0], xb = sw[1], xm = (xa + xb) / 2, yc = y0s + sag * 2;   // quadratic: control point twice the sag
      wire += '<path d="M' + xa + ' ' + y0s + ' Q' + xm + ' ' + yc + ' ' + xb + ' ' + y0s + '" stroke="#2B2116" stroke-width="3" fill="none" opacity="0.9"/>';
      var n = port ? 5 : 7;
      for (var q = 1; q <= n; q++) {
        var t = q / (n + 1), x = (1 - t) * (1 - t) * xa + 2 * (1 - t) * t * xm + t * t * xb, y = (1 - t) * (1 - t) * y0s + 2 * (1 - t) * t * yc + t * t * y0s;
        pts.push([x, y]);
      }
    });
    svg(wire, W, H, lights, 'position:absolute;left:0;top:0');
    var cols = [['#FFD58A', 'rgba(255,196,92,.9)'], ['#E8574A', 'rgba(232,87,74,.85)'], ['#FFF1C9', 'rgba(255,236,190,.9)'], ['#5FB36A', 'rgba(110,200,120,.8)']];
    pts.forEach(function (pt, q) {
      var c = cols[q % 4], dl = (0.35 + q * 0.14).toFixed(2), bw = 13 * kb, bh = 20 * kb;
      var b = el('div', null, 'position:absolute;left:' + (pt[0] - bw / 2) + 'px;top:' + (pt[1] - 3) + 'px;width:' + bw + 'px;height:' + (bh + 8) + 'px', lights);
      el('div', null, 'position:absolute;left:' + (bw / 2 - 3.5 * kb) + 'px;top:0;width:' + (7 * kb) + 'px;height:' + (7 * kb) + 'px;border-radius:2px;background:#2E271C', b);
      el('div', null, 'position:absolute;left:' + (-bw * 1.3) + 'px;top:' + (2 * kb) + 'px;width:' + (bw * 3.6) + 'px;height:' + (bw * 3.6) + 'px;border-radius:50%;background:radial-gradient(circle,' + c[1] + ' 0%,rgba(255,200,110,0) 68%);opacity:0;' +
        'animation:bulbglow .45s ease-out ' + dl + 's forwards, bulbtwinkle ' + (2.2 + (q % 5) * .37).toFixed(2) + 's ease-in-out ' + (+dl + .6).toFixed(2) + 's infinite alternate', b);
      el('div', null, 'position:absolute;left:0;top:' + (6 * kb) + 'px;width:' + bw + 'px;height:' + bh + 'px;border-radius:50% 50% 50% 50% / 42% 42% 58% 58%;background:radial-gradient(circle at 40% 35%,#fff 0%,' + c[0] + ' 45%,' + c[0] + ' 100%);' +
        'filter:brightness(.38) saturate(.6);animation:bulbon .45s ease-out ' + dl + 's forwards', b);
    });
    // a slow fall of gold stars and holly leaves (our own shapes), in front of the scene
    var fall = el('div', null, 'position:absolute;inset:0;z-index:6;overflow:hidden', fx);
    var rnd = mulberry(11), nf = Math.round((port ? 22 : 30));
    for (var f = 0; f < nf; f++) {
      var holly = f % 3 === 2, sz = holly ? 20 + rnd() * 10 : 13 + rnd() * 11;
      var d = el('div', null, 'position:absolute;left:' + (rnd() * W) + 'px;top:-40px;--sw:' + Math.round((rnd() * 2 - 1) * 70) + 'px;--fall:' + (H + 80) + 'px;--o:' + (0.65 + rnd() * 0.3).toFixed(2) + ';' +
        'animation:snowfall ' + (7 + rnd() * 4).toFixed(1) + 's linear ' + (1.2 + rnd() * 3.6).toFixed(1) + 's infinite;opacity:0', fall);
      svg(holly
        ? '<path d="M12 2c1.5 2 3.5 2.3 5 1.6-.4 2 .6 3.6 2.4 4.3-1.8.9-2.3 2.6-1.7 4.4-1.9-.4-3.5.6-4.1 2.3-.6-1.9-2.2-2.8-4.1-2.4.6-1.8.1-3.5-1.7-4.4 1.8-.7 2.8-2.3 2.4-4.3 1.5.7 3.5.4 4.8-1.5z" fill="#2F6B3A" transform="rotate(35 12 12)"/><circle cx="16" cy="16" r="2.6" fill="#C8322B"/><circle cx="15.2" cy="15.2" r=".8" fill="#fff" opacity=".7"/>'
        : '<path d="M12 1l2.6 7.4L22 9l-5.8 4.6L18.2 21 12 16.8 5.8 21l2-7.4L2 9l7.4-.6z" fill="' + ['#F2C14E', '#F7D98C', '#FFE6A8'][f % 3] + '"/>',
        24, 24, d, 'display:block;width:' + sz + 'px;height:' + sz + 'px;animation:leafspin ' + (3 + rnd() * 3).toFixed(1) + 's ease-in-out infinite alternate');
    }
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

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
      var y = el('button', 'cbtn yes', null, r1); y.type = 'button'; y.textContent = '\u2713 I\u2019ll be there'; y.addEventListener('click', function () { rsvp(true); });
      var no = el('button', 'cbtn', null, r1); no.type = 'button'; no.textContent = 'Can\u2019t make it'; no.addEventListener('click', function () { rsvp(false); });
    }
    var r2 = el('div', 'crow', null, rows);
    if (d.d) { var c = el('button', 'cbtn', null, r2); c.type = 'button'; c.textContent = '\uD83D\uDCC5 Add to calendar'; c.addEventListener('click', calendar); }
    if (d.p) { var m = el('a', 'cbtn', null, r2); m.textContent = '\uD83D\uDCCD Directions'; m.href = mapsUrl(d.p); m.target = '_blank'; m.rel = 'noopener'; }
    var r3 = el('div', 'crow', null, rows);
    var rp = el('button', 'cbtn ghost again', null, r3); rp.type = 'button';
    rp.setAttribute('aria-label', 'Watch again'); rp.title = 'Watch again';
    var ic = el('span', null, null, rp); ic.textContent = '\u21BB'; ic.setAttribute('aria-hidden', 'true');
    var lb = el('span', 'lbl', null, rp); lb.textContent = ' Watch again';
    rp.addEventListener('click', function () { reset(); requestAnimationFrame(function () { requestAnimationFrame(play); }); });
    if (CFG.shopUrl) { var s = el('a', 'cbtn shop', null, r3); s.textContent = '\uD83C\uDF81 Send an invitation like this'; s.href = CFG.shopUrl; s.target = '_blank'; s.rel = 'noopener'; }
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
    buildControls(h.data);
    build(h.data);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { scaleStage(); });
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { finishNow(); startFx(); }
    else if (h.autoplay) state.timers.push(setTimeout(play, 700));
  }
  if (stageEl || ivwrap) {
    if (stageEl) {
      stageEl.addEventListener('click', function () { if (!state.playing) play(); });
      stageEl.setAttribute('role', 'button'); stageEl.setAttribute('tabindex', '0');
      stageEl.setAttribute('aria-label', 'Open your invitation');
      stageEl.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !state.playing) { e.preventDefault(); play(); } });
      window.addEventListener('resize', function () {
        if (!state.data || document.body.classList.contains('inside-view') || document.body.classList.contains('print-view')) return;
        var L = pickLayout();
        if (L !== state.L && !state.playing) { build(state.data); } else { scaleStage(); }
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
