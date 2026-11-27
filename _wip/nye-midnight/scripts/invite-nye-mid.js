  /* ---------- scene and envelope geometry ----------
     Scene numbers are in the picture's own pixels (project/tools/build-scene-midnight.py); everything else is in stage
     units. Two pictures of the same table: upright for phones (a clear lane down the middle - the envelope slides in
     from the bottom edge), wide for wide screens (it comes from the far side, between the watch and the glass). */
  var ENV = { W: 312, H: 430, cardS: 281 / 480, cardX: 156, cardBottom: 424, out: 352, seal: [156, 214] };
  var SCENES = {
    tall: { sfx: '', w: 1152, h: 2048, sparklers: [[1121, 870, 300], [1068, 1554, 300]] },
    wide: { sfx: '-land', w: 1728, h: 1296, sparklers: [[1240, 828, 250]] }
  };
  /* env: e = size of the envelope lying on the table, (cx, cy) = where it comes to rest, rot = its turn there,
     tilt = how far the table leans away from the lens; from: where the slide starts (offset from rest, its turn and
     size there); lead: the envelope's leading edge (0 = its top edge, 1 = its bottom edge);
     fin: where the invitation settles (s = size, cx = centre, bottom = lower edge) - moved up, and made smaller only
     if it must, so the buttons never cover it; fw: fireworks seen in the polished stone [x, y, size, colour, delay] */
  var LAYOUTS = {
    port: { W: 600, H: 1100, scene: SCENES.tall, sk: 0.545, sx: -14, sy: -2,
      env: { e: 0.74, cx: 291, cy: 565, rot: 4, tilt: 7 }, from: { x: 34, y: 770, rot: -36, s: 1.04 }, lead: 0,
      fin: { s: 1.1, cx: 300, bottom: 962 }, hintY: 762, hintSize: 19, fwy: 0.86,
      fw: [[300, 330, 430, 'gold', 0.7], [120, 640, 360, 'silver', 1.25], [455, 800, 380, 'blue', 1.75], [150, 960, 400, 'gold', 2.35], [430, 120, 340, 'silver', 2.9], [300, 1010, 360, 'blue', 3.6]] },
    land: { W: 1200, H: 900, scene: SCENES.wide, sk: 0.764, sx: -60, sy: -45,
      env: { e: 0.74, cx: 494, cy: 456, rot: -3, tilt: 39 }, from: { x: -8, y: -640, rot: 13, s: 0.72 }, lead: 1,
      fin: { s: 0.95, cx: 600, bottom: 772 }, hintY: 842, hintSize: 16, fwy: 0.6,
      fw: [[560, 300, 520, 'gold', 0.7], [240, 420, 420, 'silver', 1.25], [930, 420, 440, 'blue', 1.75], [330, 720, 460, 'gold', 2.35], [1010, 160, 380, 'silver', 2.9], [700, 760, 420, 'blue', 3.6]] }
  };
  /* three loose confetti discs lie in the envelope's way: [place along its leading edge 0..1, picture, size] -
     the numbers of their push (when it reaches them, how far they run on) are in invite.css (generated) */
  var DISCS = [[0.20, 'disc-a.webp', 40], [0.56, 'disc-s.webp', 34], [0.83, 'disc-b.webp', 38]];
  var DISC_K = [0.110, 0.062, 0.140];   // how much of the slide is left when the edge reaches each disc (same numbers in the generated keyframes)
  var DISC_G = [30, 20, 38];            // how far beyond the resting edge each disc ends (stage units)
  var DISC_L = [-28, 9, 32];            // sideways drift
  var IMAGES = ['env-dropshadow.png', 'env-pocket.webp', 'env-back.webp', 'env-flap.webp', 'env-flapshadow.png', 'env-band.webp', 'env-seal.webp', 'env-hand.webp', 'disc-a.webp', 'disc-b.webp', 'disc-s.webp', 'flare.webp'];
  var LATE = ['env-flapin.webp', 'fw-gold.webp', 'fw-silver.webp', 'fw-blue.webp', 'disc-far.webp', 'star.webp'];
  var T = { landed: 2600, autoplay: 3000, controls: 5600 };   // ms; all on the 100 ms grid (frame-by-frame video render)

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
      var w = Math.max(0, Math.min(vw - 20, 560));
      var cx = offX + fin.cx * s;
      var left = wide ? Math.max(10, Math.min(vw - 10 - w, cx - w / 2)) : (vw - w) / 2;
      ctl.style.width = w + 'px'; ctl.style.left = left + 'px'; ctl.style.right = 'auto';
      var rows = ctl.querySelector('.crows'), rr = rows ? rows.getBoundingClientRect() : null;
      var top = rr ? rr.top : vh;
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
    var S = L.scene, sfx = S.sfx, e = L.env.e, i, r = rnd(2027), port = L === LAYOUTS.port;
    function st(x, y) { return [L.sx + x * L.sk, L.sy + y * L.sk]; }                 // scene px -> stage units
    var th = L.env.rot * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th), ct = Math.cos(L.env.tilt * Math.PI / 180);
    function loc(dX, dY) { dX /= e; dY /= e; return [dX * cs + dY * sn, -dX * sn + dY * cs]; }     // stage vector -> envelope units
    function out(u, v) { var x = (u - ENV.W / 2) * e, y = (v - ENV.H / 2) * e * ct; return [L.env.cx + x * cs - y * sn, L.env.cy + x * sn + y * cs]; }   // envelope point -> stage
    function px(v) { return v.toFixed(2) + 'px'; }

    var cam = el('div', 'cam', null, stageEl);
    // ---- scene (the picture's own pixels, scaled once)
    var sc = el('div', 'scene', 'width:' + S.w + 'px;height:' + S.h + 'px;transform:translate(' + L.sx + 'px,' + L.sy + 'px) scale(' + L.sk + ')', cam);
    img(A + 'bg' + sfx + '.jpg', 'bg', 'width:' + S.w + 'px;height:' + S.h + 'px', sc);
    // ---- fireworks, as the polished marble shows them (small pictures; never a screen-sized gradient)
    L.fw.forEach(function (f, k) {
      img(A + 'fw-' + f[3] + '.webp', 'fw', 'left:' + (f[0] - f[2] / 2) + 'px;top:' + (f[1] - f[2] / 2) + 'px;width:' + f[2] + 'px;height:' + f[2] + 'px;--dl:' + f[4] + 's;--per:' + (5.6 + (k % 3) * 0.9).toFixed(1) + 's', cam);
    });
    // ---- the sparklers breathe from the start, and flare at midnight
    S.sparklers.forEach(function (p, k) {
      var c = st(p[0], p[1]), d = p[2] * L.sk;
      img(A + 'flare.webp', 'flare f' + k, 'left:' + (c[0] - d / 2) + 'px;top:' + (c[1] - d / 2) + 'px;width:' + d + 'px;height:' + d + 'px', cam);
    });

    // ---- the slide: where it starts (in the envelope's own units), and the loose discs in its way
    var a0 = loc(L.from.x, L.from.y);
    stageEl.style.setProperty('--ax', px(a0[0])); stageEl.style.setProperty('--ay', px(a0[1]));
    stageEl.style.setProperty('--ar', L.from.rot + 'deg'); stageEl.style.setProperty('--as', L.from.s);
    stageEl.style.setProperty('--tilt', L.env.tilt + 'deg'); stageEl.style.setProperty('--fwy', L.fwy);
    stageEl.style.setProperty('--out', '-' + ENV.out + 'px');
    stageEl.style.setProperty('--c0', ENV.cardS.toFixed(5));
    stageEl.style.setProperty('--unrot', (-L.env.rot) + 'deg');
    var sealC = out(ENV.seal[0], ENV.seal[1]);
    stageEl.style.setProperty('--camo', px(sealC[0]) + ' ' + px(sealC[1]));
    var tl = Math.hypot(L.from.x, L.from.y), tux = -L.from.x / tl, tuy = -L.from.y / tl;     // unit vector of the slide
    stageEl.style.setProperty('--tx', px(-L.from.x)); stageEl.style.setProperty('--ty', px(-L.from.y));
    DISCS.forEach(function (d, k) {
      var edge = out(ENV.W * d[0], L.lead ? ENV.H : 0), sz = d[2] * (port ? 1 : 0.86);
      var x0 = edge[0] - tux * (tl * DISC_K[k] - sz * 0.42), y0 = edge[1] - tuy * (tl * DISC_K[k] - sz * 0.42);      // where it lies before the push
      var p = el('div', 'pd pd' + k, 'left:' + (x0 - sz / 2) + 'px;top:' + (y0 - sz / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px;' +
        '--gx:' + px(tux * DISC_G[k] - tuy * DISC_L[k]) + ';--gy:' + px(tuy * DISC_G[k] + tux * DISC_L[k]) + ';--dr:' + [140, -95, 210][k] + 'deg', cam);
      img(A + d[1], null, 'transform:rotate(' + [20, 140, 250][k] + 'deg)', p);
    });

    // ---- envelope: three sheets of the same place, so the invitation can leave the middle one and come to the lens:
    //      1 inside back (+ shadow on the table)  2 invitation  3 FRONT POCKET, flap, the two halves of the band and the seal
    function root(cls) {
      var ro = el('div', 'envroot ' + cls, 'left:' + (L.env.cx - ENV.W / 2) + 'px;top:' + (L.env.cy - ENV.H / 2) + 'px;transform:rotate(' + L.env.rot + 'deg) scale(' + e + ')', cam);
      return ro;
    }
    var rb = root('rb');
    var sb = el('div', 'slide', null, rb);
    img(A + 'env-dropshadow.png', 'eshadow', null, el('div', 'eg tl', null, sb));
    var envB = el('div', 'eg tl envB', null, sb);
    img(A + 'env-back.webp', 'full', null, envB);
    img(A + 'env-flapin.webp', 'flapin', null, el('div', 'flapBbox', null, envB));
    var rc = root('rc');
    var cbox = el('div', 'eg tl cardbox', null, el('div', 'slide', null, rc));
    var rig = el('div', 'cardrig', null, cbox);
    var card = el('div', 'card', null, rig);
    var face = buildFace(card, data, false);
    el('div', 'gloss', null, face.root);
    var fl = el('div', 'fwl', null, face.root); el('i', 'l1', null, fl); el('i', 'l2', null, fl); el('i', 'l3', null, fl);   // fireworks light passing over the paper
    var rf = root('rf');
    var envF = el('div', 'eg tl envF', null, el('div', 'slide', null, rf));
    img(A + 'env-pocket.webp', 'full', null, envF);
    var label = el('div', 'elabel', null, envF); label.textContent = 'You’re invited';
    img(A + 'env-flapshadow.png', 'full flapsh', null, envF);
    img(A + 'env-flap.webp', 'full flapF', null, el('div', 'flapFbox', null, envF));
    // the band is held by the seal: at midnight its two halves let go and slide off to the sides; the little clock stays on the pocket
    img(A + 'env-band.webp', 'full', null, el('div', 'bandh bl', null, envF));
    img(A + 'env-band.webp', 'full', 'left:-156px', el('div', 'bandh br', null, envF));
    img(A + 'env-seal.webp', 'full', null, envF);
    img(A + 'env-hand.webp', 'full hand', 'transform-origin:' + ENV.seal[0] + 'px ' + ENV.seal[1] + 'px', envF);
    img(A + 'flare.webp', 'glint', 'left:' + (ENV.seal[0] - 70) + 'px;top:' + (ENV.seal[1] - 70) + 'px', envF);

    // ---- midnight confetti: it falls towards the table (from near the lens), lands and stays - on the marble and on the envelope
    var conf = el('div', 'conf', null, cam), n = port ? 24 : 30, pics = ['disc-a.webp', 'disc-b.webp', 'disc-s.webp', 'star.webp'];
    for (i = 0; i < n; i++) {
      var star = i % 4 === 3, sz = star ? 13 + r() * 9 : 22 + r() * 16, x = 20 + r() * (L.W - 40), y = 30 + r() * (L.H - 60);
      var c = el('div', 'cf', 'left:' + (x - sz / 2).toFixed(1) + 'px;top:' + (y - sz / 2).toFixed(1) + 'px;width:' + sz.toFixed(1) + 'px;height:' + sz.toFixed(1) + 'px;' +
        '--ox:' + px((x - L.W / 2) * (0.35 + r() * 0.3) + (r() - 0.5) * 70) + ';--oy:' + px((y - L.H / 2) * (0.35 + r() * 0.3) - 30 - r() * 60) + ';--z:' + (1.5 + r() * 0.9).toFixed(2) +
        ';--rz:' + Math.round(r() * 360) + 'deg;--dl:' + (0.8 + r() * 1.5).toFixed(2) + 's;--du:' + (1.5 + r() * 0.9).toFixed(2) + 's', conf);
      img(A + pics[star ? 3 : i % 3], null, '--fl:' + (r() < 0.5 ? 1 : -1) * (2 + Math.round(r() * 2)) * 180 + 'deg', c);
    }
    el('div', 'veil', null, cam);     // the table falls into shade when the invitation comes to the lens (one flat colour, no gradient)
    // a few pieces pass close to the lens, out of focus, in front of the invitation
    var near = el('div', 'near', null, stageEl);
    for (i = 0; i < (port ? 4 : 6); i++) {
      var nz = 64 + r() * 60, nx = r() * (port ? 0.05 : 0.2) * L.W;     // down the two edges, half out of the picture, so they never sit on the words
      img(A + 'disc-far.webp', 'nf', 'left:' + (i % 2 ? L.W - nz * 0.5 - nx : nx - nz * 0.5).toFixed(0) + 'px;top:-180px;width:' + nz.toFixed(0) + 'px;height:' + nz.toFixed(0) + 'px;--sw:' + px((r() - 0.5) * 30) +
        ';--fall:' + (L.H + 380) + 'px;--dl:' + (2.4 + r() * 1.5).toFixed(2) + 's;--du:' + (2.0 + r() * 0.8).toFixed(2) + 's;--o:' + (0.34 + r() * 0.2).toFixed(2), near);
    }

    el('div', 'edge t', 'height:' + (port ? 66 : 150) + 'px', stageEl); el('div', 'edge b', 'height:' + (port ? 152 : 66) + 'px', stageEl);   // whichever edge the envelope comes from is the darker one
    var hint = el('div', 'hint', 'top:' + L.hintY + 'px;font-size:' + L.hintSize + 'px;' + 'left:' + (L.env.cx - (port ? 6 : 0) - 300) + 'px;right:auto;width:600px', stageEl);
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

  function arrive() {   // the envelope slides onto the table; called only when its pictures are decoded
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
  function still() {    // reduced motion: the envelope already lies on the table
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
      var i = new Image(), tries = 0;
      i.onload = function () { (i.decode ? i.decode() : Promise.resolve()).then(res, res); };
      i.onerror = function () { if (tries++ < 1) { setTimeout(function () { i.src = A + n + '?r=1'; }, 400); } else res(); };   // one more try (a host may answer 503 once right after a release)
      i.src = A + n;
    });
  }
  var FACE_FONTS = { a: ["400 30px 'Italiana'", "500 14px 'Cinzel'", "500 16px 'Cormorant Garamond'"], b: ["400 30px 'Limelight'", "400 16px 'Poiret One'", "400 16px 'Josefin Sans'"], c: ["400 30px 'Pinyon Script'", "400 16px 'Playfair Display'", "600 12px 'Josefin Sans'"] };
  function preload() {  // the arrival never starts with a half-loaded scene or envelope; the finale's pictures load meanwhile
    var S = state.L.scene, v = designOf(state.data.v);
    var first = IMAGES.concat(['bg' + S.sfx + '.jpg', 'front-' + v + '.jpg']);
    LATE.forEach(loadOne);
    var fonts = document.fonts && document.fonts.load ? Promise.all(FACE_FONTS[v].concat(["500 14px 'Cinzel'"]).map(function (f) { return document.fonts.load(f); }).concat([document.fonts.ready])) : Promise.resolve();
    var limit = new Promise(function (res) { setTimeout(res, 6000); });
    return Promise.race([Promise.all(first.map(loadOne).concat([fonts])), limit]);
  }
