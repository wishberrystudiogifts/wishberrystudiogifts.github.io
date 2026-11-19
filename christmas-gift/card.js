/* Personalized animated CHRISTMAS GIFT card (gift voucher) — recipient view + shared codec (same codec as /christmas/).
   Inside: "Your gift is…" + the buyer's gift text (19 Nov 2026, P-261119-1).
   Text arrives inside the link (#m=...), is decoded in the browser and only ever
   inserted with textContent, so a crafted link cannot inject markup. */
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

  /* ---------- the inside page with the buyer's words ---------- */
  function buildInside(parent, data, baseFont) {
    var ins = el('div', 'inside', null, parent);
    svg(STAR, 56, 56, ins, null).setAttribute('class', 'star');
    var txt = el('div', 'txt', 'font-size:' + baseFont + 'px', ins);
    if (data.t) { var g = el('div', 'greet', null, txt); g.textContent = 'Dear ' + data.t + ','; }
    var k = el('div', 'kicker', null, txt); k.textContent = 'Your gift is\u2026';
    var m = el('div', 'msg', null, txt); m.textContent = data.m;
    if (data.s) { var sg = el('div', 'sign', null, txt); sg.textContent = data.s; }
    svg(DOTS, 44, 8, ins, null).setAttribute('class', 'dots');
    img(A + 'paper.jpg', 'paper', 'opacity:.5', ins);
    el('div', 'gutter-l', null, ins);
    return { root: ins, txt: txt, base: baseFont };
  }
  function fitText(parts) {
    var f = parts.base, t = parts.txt;
    t.style.fontSize = f + 'px';
    var guard = 0;
    while (t.scrollHeight > t.clientHeight + 1 && f > 13 && guard++ < 40) { f -= 1; t.style.fontSize = f + 'px'; }
  }

  /* ---------- layouts (stage units) ---------- */
  var LAYOUTS = {
    land: { W: 1200, H: 900, bgPos: '22% center', area: { x: 80, y: 81, w: 960, h: 700 },
      card: { left: 480, bottom: 180, s: 0.72, hide: 640 }, env: { cx: 720, bottom: 0, s: 1, clip: 5 },
      hintY: 818, hintSize: 15, fadeCover: false, font: 28, shadow: { cx: 820, cy: 800, rx: 310 } },
    port: { W: 600, H: 1100, bgPos: '20% center', area: { x: 0, y: 0, w: 600, h: 984 },
      card: { left: 60, bottom: 229, s: 0.9, hide: 640 }, env: { cx: 300, bottom: 0, s: 1.2, clip: 6 },
      hintY: 1028, hintSize: 22, fadeCover: true, font: 33, shadow: { cx: 300, cy: 990, rx: 270 } }
  };

  /* ---------- recipient view ---------- */
  var stageEl = document.getElementById('stage');
  var ivwrap = document.getElementById('ivwrap');
  var state = { playing: false, timers: [], L: null, parts: null, data: null, built: false };

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

    // card
    // the card sits in a clip box that ends just above the envelope's soft bottom edge,
    // so it never shows under the envelope (env.clip = faded edge of env-body x scale, rounded up; 17 Nov 2026)
    var cardClip = el('div', 'cardclip', 'clip-path:inset(0 0 ' + (L.env.bottom + L.env.clip) + 'px 0)', area);
    var card = el('div', 'card', 'left:' + L.card.left + 'px;bottom:' + L.card.bottom + 'px', cardClip);
    var persp = el('div', 'persp', null, card);
    var parts = buildInside(persp, data, L.font);
    var cover = el('div', 'cover', null, persp);
    var front = el('div', 'face front', null, cover);
    img(A + 'front.jpg', 'art', null, front);
    img(A + 'paper.jpg', 'paper', 'opacity:.22', front);
    el('div', 'gloss', null, front); el('div', 'edge-l', null, front);
    var back = el('div', 'face back', null, cover);
    el('div', 'frame', null, back);
    svg('<path d="M20 4l4.5 11 11 4.5-11 4.5-4.5 11-4.5-11-11-4.5 11-4.5z" fill="#CBA84C"/>', 40, 40, back, 'display:block');
    img(A + 'paper.jpg', 'paper', 'opacity:.5', back);
    el('div', 'gutter-r', null, back);

    // envelope (outer = scale, inner = fade)
    var envX = L.env.cx - 210;
    var envOuter = el('div', 'envwrap', 'left:' + envX + 'px;bottom:' + L.env.bottom + 'px;transform:scale(' + L.env.s + ')', area);
    var envInner = el('div', null, 'position:absolute;inset:0', envOuter);
    img(A + 'env-body.webp', 'env-body', null, envInner);
    var tag = el('div', 'tag', null, envInner);
    tag.textContent = data.t ? ('A gift for ' + data.t) : 'A gift for you';
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

    state.parts = parts;
    state.n = { card: card, cover: cover, front: front, back: back, envInner: envInner, flap: flap, crum: crum, fx: fx, fxBack: fxBack, hint: hint };
    reset();
    scaleStage();
    fitText(parts);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitText(parts); });
  }

  function T(e, v) { e.style.transition = v; }
  function reset() {
    var n = state.n, L = state.L;
    state.timers.forEach(clearTimeout); state.timers = [];
    state.playing = false; state.finished = false;
    [n.card, n.cover, n.flap, n.envInner, n.front, n.back].forEach(function (e) { T(e, 'none'); });
    n.card.style.transform = 'translateY(' + L.card.hide + 'px) scale(' + L.card.s + ')';
    n.cover.style.transform = 'rotateY(0deg)';
    n.flap.style.transform = 'rotateX(0deg)';
    n.envInner.style.opacity = '1';
    n.front.style.opacity = '1'; n.back.style.opacity = '1';
    n.crum.style.animation = 'none'; n.crum.style.opacity = '0';
    n.fx.innerHTML = ''; n.fxBack.innerHTML = '';
    n.hint.classList.remove('off');
    stageEl.classList.remove('done');
    var c = document.getElementById('controls'); if (c) c.classList.remove('show');
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
    T(n.cover, 'transform 1.5s cubic-bezier(0.45, 0, 0.2, 1) 3.4s');
    n.cover.style.transform = 'rotateY(-165deg)';
    if (L.fadeCover) {
      T(n.front, 'opacity 0.6s ease 4.15s'); T(n.back, 'opacity 0.6s ease 4.15s');
      n.front.style.opacity = '0'; n.back.style.opacity = '0';
    }
    state.timers.push(setTimeout(startFx, 3900));
    state.timers.push(setTimeout(function () {
      state.finished = true; stageEl.classList.add('done');
      var c = document.getElementById('controls'); if (c) c.classList.add('show');
    }, 6800));
  }

  function finishNow() { // reduced motion: show the open card straight away
    var n = state.n, L = state.L;
    n.hint.classList.add('off');
    n.card.style.transform = 'translateY(0px) scale(' + L.card.s + ')';
    n.envInner.style.opacity = '0';
    n.cover.style.transform = 'rotateY(-165deg)';
    if (L.fadeCover) { n.front.style.opacity = '0'; n.back.style.opacity = '0'; }
    state.playing = true; state.finished = true; stageEl.classList.add('done');
    var c = document.getElementById('controls'); if (c) c.classList.add('show');
  }

  /* ---------- effects: sparks, sleigh, gold dust, snow ---------- */
  function startFx() {
    var L = state.L, fx = state.n.fx, fxb = state.n.fxBack, W = L.W, H = L.H;
    // card geometry in stage units
    var cw = 480 * L.card.s, ch = 672 * L.card.s;
    var cx = L.area.x + L.card.left + 240, bottom = L.area.y + L.area.h - L.card.bottom, top = bottom - ch;
    var k = W / 1200;
    // sparks
    var sp = el('div', null, 'position:absolute;left:' + (cx + 0.013 * W) + 'px;top:' + (top + 0.35 * ch) + 'px;width:0;height:0;z-index:6', fx);
    [[9, '#F2C14E', -240, -200, 1.5, .6], [7, '#F7D98C', -150, -290, 1.4, .65], [8, '#CBA84C', -60, -330, 1.5, .6], [9, '#F2C14E', 60, -320, 1.45, .68],
     [7, '#F7D98C', 160, -280, 1.4, .62], [9, '#CBA84C', 250, -190, 1.5, .66], [6, '#A33434', -200, -110, 1.3, .7], [6, '#A33434', 210, -100, 1.3, .72],
     [6, '#F4ECDD', -290, -40, 1.35, .64], [6, '#F4ECDD', 300, -30, 1.35, .6], [7, '#F2C14E', -120, -180, 1.2, 1.15], [7, '#F7D98C', 0, -240, 1.2, 1.2],
     [7, '#F2C14E', 130, -170, 1.2, 1.18], [5, '#CBA84C', -70, -120, 1.15, 1.25], [5, '#CBA84C', 80, -110, 1.15, 1.22]].forEach(function (s) {
      el('div', null, 'position:absolute;width:' + s[0] + 'px;height:' + s[0] + 'px;border-radius:50%;background:' + s[1] + ';--dx:' + (s[2] * Math.max(k, .6)) + 'px;--dy:' + s[3] + 'px;animation:spark ' + s[4] + 's ease-out ' + s[5] + 's forwards;opacity:0', sp);
    });
    // sleigh silhouette crossing the room above the mantel (gift: 0.311 H higher than the Christmas card)
    var sl = el('div', null, 'position:absolute;left:0;top:0;width:360px;height:120px;opacity:0', fxb);
    svg('<path d="M100 58 Q170 40 308 46" stroke="#C99B4A" stroke-width="2" opacity="0.8"/><line x1="8" y1="84" x2="100" y2="84" stroke="#3A2515" stroke-width="3" stroke-linecap="round"/><path d="M100 84 q12 0 12 -10" stroke="#3A2515" stroke-width="3" stroke-linecap="round"/><line x1="24" y1="78" x2="24" y2="84" stroke="#3A2515" stroke-width="3"/><line x1="80" y1="78" x2="80" y2="84" stroke="#3A2515" stroke-width="3"/><rect x="12" y="58" width="84" height="20" rx="8" fill="#2A1712"/><path d="M96 66 q14 -2 12 -16" stroke="#2A1712" stroke-width="6" stroke-linecap="round"/><circle cx="22" cy="50" r="11" fill="#241410"/><rect x="30" y="36" width="26" height="24" rx="8" fill="#2A1712"/><circle cx="52" cy="36" r="7" fill="#2A1712"/><path d="M45 31 L60 26 L52 18 Z" fill="#2A1712"/>' +
      [140, 215, 290].map(function (x, i) { var y = 62 - i * 2; return '<g><ellipse cx="' + x + '" cy="' + y + '" rx="15" ry="9" fill="#241410"/><circle cx="' + (x + 18) + '" cy="' + (y - 14) + '" r="6.5" fill="#241410"/><path d="M' + (x - 8) + ' ' + (y + 8) + ' l-6 12 M' + (x - 2) + ' ' + (y + 8) + ' l-2 14 M' + (x + 6) + ' ' + (y + 8) + ' l4 12 M' + (x + 11) + ' ' + (y + 6) + ' l6 12" stroke="#241410" stroke-width="3" stroke-linecap="round"/><circle cx="' + (x - 16) + '" cy="' + (y - 2) + '" r="2.5" fill="#F2C14E"/></g>'; }).join('') +
      '<circle cx="6" cy="92" r="3.5" fill="#F2C14E" opacity="0.85"/><circle cx="16" cy="100" r="2.8" fill="#F2C14E" opacity="0.55"/><circle cx="28" cy="106" r="2.2" fill="#F2C14E" opacity="0.35"/>', 360, 120, sl, 'display:block');
    var sk = L === LAYOUTS.port ? 0.7 : 1;
    if (sl.animate) {
      sl.animate([
        { transform: 'translate(' + (-0.3 * W) + 'px,' + (0.589 * H) + 'px) scale(' + (0.9 * sk) + ') rotate(-16deg)', opacity: 0 },
        { offset: 0.08, opacity: 1 },
        { offset: 0.52, transform: 'translate(' + (0.3 * W) + 'px,' + (0.056 * H) + 'px) scale(' + (1.25 * sk) + ') rotate(-15deg)', opacity: 1 },
        { offset: 0.92, opacity: 1 },
        { transform: 'translate(' + (1.05 * W) + 'px,' + (-0.478 * H) + 'px) scale(' + (1.45 * sk) + ') rotate(-13deg)', opacity: 0 }
      ], { duration: 4600, delay: 1150, easing: 'ease-in-out', fill: 'forwards' });
    }
    // gold dust trail following the sleigh
    var dust = el('div', null, 'position:absolute;inset:0', fxb);
    var x0 = 0.1 * W, y0 = 0.507 * H, x1 = 0.933 * W, y1 = -0.26 * H;   // gift: path 0.311 H higher than Christmas (over the mantel, not the table)
    for (var i = 0; i < 20; i++) {
      var t = i / 19, sz = [8, 6, 9, 5, 8, 6, 9, 5, 8, 6, 10, 5, 8, 6, 9, 5, 8, 6, 7, 6][i];
      var col = ['#F7D98C', '#FFF6DF', '#F2C14E'][i % 3];
      el('div', null, 'position:absolute;left:' + (x0 + (x1 - x0) * t) + 'px;top:' + (y0 + (y1 - y0) * t) + 'px;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + col +
        ';box-shadow:0 0 ' + (sz * 2) + 'px ' + Math.round(sz * .6) + 'px rgba(242,193,78,.85);animation:dustfall ' + (3 + (i % 3) * .2) + 's ease-in ' + (1.5 + 3.2 * t) + 's forwards;opacity:0', dust);
    }
    for (var j = 0; j < 8; j++) {
      var tt = (j + 0.3) / 8, d = el('div', null, 'position:absolute;left:' + (x0 + (x1 - x0) * tt) + 'px;top:' + (y0 + (y1 - y0) * tt) + 'px;animation:dustfall 3.3s ease-in ' + (1.6 + 2.9 * tt) + 's forwards;opacity:0', dust);
      svg('<path d="M8 0l1.8 6.2L16 8l-6.2 1.8L8 16l-1.8-6.2L0 8l6.2-1.8z" fill="' + ['#F2C14E', '#FFF6DF', '#F7D98C'][j % 3] + '"/>', 16, 16, d, 'display:block;animation:dusttwinkle ' + (0.65 + (j % 4) * .07) + 's ease-in-out infinite alternate');
    }
    // snow
    var snow = el('div', null, 'position:absolute;inset:0;z-index:6;overflow:hidden', fx);
    var rnd = mulberry(7);
    var tiers = [[14, 3, 5, 0, .45, .6, 8.3, 10.4], [14, 6, 9, .8, .62, .8, 6.6, 8.2], [8, 13, 16, 2.2, .74, .92, 5.3, 6.6], [3, 19, 22, 3.5, .8, .85, 4.7, 5.2]];
    tiers.forEach(function (tr) {
      for (var q = 0; q < Math.round(tr[0] * (W / 1200 + 0.4) / 1.4); q++) {
        var size = tr[1] + rnd() * (tr[2] - tr[1]);
        el('div', null, 'position:absolute;left:' + (rnd() * W) + 'px;top:-30px;width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
          'background:radial-gradient(circle at 35% 35%,rgba(255,255,255,.98),rgba(255,255,255,.55) 60%,rgba(255,255,255,0) 100%);' +
          (tr[3] ? 'filter:blur(' + tr[3] + 'px);' : '') + '--sw:' + Math.round((rnd() * 2 - 1) * 80) + 'px;--o:' + (tr[4] + rnd() * (tr[5] - tr[4])).toFixed(2) + ';--fall:' + (H + 80) + 'px;' +
          'animation:snowfall ' + (tr[6] + rnd() * (tr[7] - tr[6])).toFixed(1) + 's linear ' + (rnd() * 4.2).toFixed(1) + 's infinite;opacity:0', snow);
      }
    });
  }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- inside-only view (editor live preview) ---------- */
  function buildInsideView(data) {
    document.body.classList.add('inside-view'); document.documentElement.classList.add('inside-view');
    ivwrap.innerHTML = '';
    var parts = buildInside(ivwrap, data, 30);
    function sc() { var s = Math.min(window.innerWidth / 480, window.innerHeight / 672); ivwrap.style.transform = 'translate(-50%,-50%) scale(' + s + ')'; }
    sc(); window.onresize = sc;
    fitText(parts);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitText(parts); });
  }

  /* ---------- boot ---------- */
  function boot() {
    var h = readHash();
    if (h.view === 'inside' && ivwrap) { buildInsideView(h.data); return; }
    if (!stageEl) return;
    build(h.data);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { finishNow(); startFx(); }
    else if (h.autoplay) state.timers.push(setTimeout(play, 700));
  }
  if (stageEl || ivwrap) {
    if (stageEl) {
      stageEl.addEventListener('click', function () { if (!state.playing) play(); });
      stageEl.setAttribute('role', 'button'); stageEl.setAttribute('tabindex', '0');
      stageEl.setAttribute('aria-label', 'Open your gift card');
      stageEl.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !state.playing) { e.preventDefault(); play(); } });
      var rp = document.getElementById('replay');
      if (rp) rp.addEventListener('click', function () { reset(); requestAnimationFrame(function () { requestAnimationFrame(play); }); });
      var shop = document.getElementById('shop');
      if (shop && CFG.shopUrl) { shop.href = CFG.shopUrl; shop.target = '_blank'; shop.rel = 'noopener'; shop.hidden = false; }
      window.addEventListener('resize', function () {
        if (!state.data || document.body.classList.contains('inside-view')) return;
        var L = pickLayout();
        if (L !== state.L && !state.playing) { build(state.data); } else { scaleStage(); }
      });
    }
    window.addEventListener('hashchange', boot);
    boot();
  }
})();
