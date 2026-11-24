/* Wishberry Studio — personal video maker (20 Nov 2026; test page /lab/video/ from 19 Nov).
   The buyer's own phone or computer makes the video. Our base video (made frame by frame
   on our side, without the message) is decoded frame by frame, the buyer's words are drawn
   on top of every frame, and every frame is encoded again into an H.264 MP4 with a single
   key frame. Nothing is uploaded anywhere: no server, no account. */
(function () {
  'use strict';

  var FAMILY = 'WBFraunces';
  var LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  var LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

  /* Every number below was measured on the frame-by-frame page that makes the base video
     (Playwright, 19 Nov 2026), so the words land exactly where the printed card has them. */
  var TEMPLATES = {
    christmas: {
      base: 'christmas-base.mp4',
      fps: 30,
      // envelope tag ("For Anna"): right/bottom edge of the tag on the 1080x1920 frame
      tag: { right: 789.92, bottom: 1494.68, s: 1.42, rot: -7, maxW: 300,
             fadeAt: 2.95, fadeDur: 0.3, crumpleAt: 2.9, crumpleDur: 1.8,
             bg: '#F4ECDD', fg: '#6E1E1A', shadow: 'rgba(10,5,5,0.35)',
             text: function (d) { return d.t ? 'For ' + d.t : 'With love'; } },
      // inside page: text area between the star and the three dots (frame pixels)
      msg: { x: 595.21, y: 791.15, w: 400.78, h: 425.33, k: 1.0224, max: 30, min: 17, inAt: 5.6, inDur: 0.9, gap: 0.75,
             parts: [
               { when: 't', text: function (d) { return 'Dear ' + d.t + ','; }, weight: 600, size: 1.08, lh: 1.3, color: '#27352B' },
               { text: function (d) { return d.m; }, weight: 400, size: 1, lh: 1.55, color: '#27352B' },
               { when: 's', text: function (d) { return d.s; }, weight: 600, size: 1, lh: 1.35, color: '#5A2A22' }
             ] },
      defaultMessage: 'Wishing you a season full of warmth, joy and light.'
    },
    birthday: {
      base: 'birthday-base.mp4',
      fps: 30,
      tag: { right: 789.92, bottom: 1654.68, s: 1.42, rot: -7, maxW: 300,
             fadeAt: 2.95, fadeDur: 0.3, crumpleAt: 2.9, crumpleDur: 1.8,
             bg: '#FBF7EE', fg: '#8A4653', shadow: 'rgba(74,53,36,0.35)',
             text: function (d) { return d.t ? 'For ' + d.t : 'With love'; } },
      // inside page: text area between the pop-up cake and the three dots
      msg: { x: 595.22, y: 1116.78, w: 400.78, h: 284.23, k: 1.0224, max: 28, min: 15, inAt: 5.8, inDur: 0.9, gap: 0.75,
             parts: [
               { when: 't', text: function (d) { return 'Dear ' + d.t + ','; }, weight: 600, size: 1.08, lh: 1.3, color: '#27352B' },
               { text: function (d) { return d.m; }, weight: 430, size: 1, lh: 1.55, color: '#27352B' },
               { when: 's', text: function (d) { return d.s; }, weight: 600, size: 1, lh: 1.35, color: '#8A4653' }
             ] },
      defaultMessage: 'Wishing you the happiest of birthdays — and a year full of good things.'
    },
    gift: {
      base: 'gift-base.mp4',
      fps: 30,
      tag: { right: 789.92, bottom: 1494.68, s: 1.42, rot: -7, maxW: 300,
             fadeAt: 2.95, fadeDur: 0.3, crumpleAt: 2.9, crumpleDur: 1.8,
             bg: '#F4ECDD', fg: '#6E1E1A', shadow: 'rgba(10,5,5,0.35)',
             text: function (d) { return d.t ? 'A gift for ' + d.t : 'A gift for you'; } },
      msg: { x: 595.21, y: 791.15, w: 400.78, h: 425.33, k: 1.0224, max: 30, min: 17, inAt: 5.6, inDur: 0.9, gap: 0.75,
             parts: [
               { when: 't', text: function (d) { return 'Dear ' + d.t + ','; }, weight: 600, size: 1.08, lh: 1.3, color: '#27352B' },
               { text: function () { return 'YOUR GIFT IS…'; }, style: 'normal', weight: 700, size: 0.68, lh: 1.2, color: '#9C7A2E', spacing: 0.22, after: -0.2 },
               { text: function (d) { return d.m; }, weight: 560, size: 1.12, lh: 1.42, color: '#1F3326', balance: true },
               { when: 's', text: function (d) { return d.s; }, weight: 600, size: 1, lh: 1.35, color: '#5A2A22' }
             ] },
      defaultMessage: 'a little surprise, just for you'
    }
  };

  /* Invitations (24 Nov 2026): the base video is the guest page itself, rendered frame by frame WITHOUT the
     party details and without the buttons (render-page-frames.js), one base video per design (a, b, c).
     The details are laid out by the guest page's own code and CSS (index.html#view=face in a hidden frame),
     read back character by character and drawn on the invitation, following its settle movement and fade.
     Geometry measured on every frame of the base videos (render-page-frames.js MEASURE): error < 0.01 px. */
  var INVITE_GEOM = {
    frame: { W: 1080, H: 1920 }, stage: { W: 600, H: 1100 },       // portrait layout of the guest page
    card: { cx: 300, bottom: 755, s0: 0.9, s1: 1.16, ty1: 127 },    // bottom centre of the 480x672 card, stage units
    settle: { at: 98 / 30, dur: 1.2 },                               // the card grows to its reading size
    text: { at: 4.1, dur: 1.2 }                                      // the details fade in (CSS ease)
  };
  TEMPLATES['christmas-party'] = {
    kind: 'invite', fps: 30, geom: INVITE_GEOM, defaultDesign: 'b',
    bases: { a: 'christmas-party-a-base.mp4', b: 'christmas-party-b-base.mp4', c: 'christmas-party-c-base.mp4' }
  };
  TEMPLATES['new-years-eve'] = {
    kind: 'invite', fps: 30, geom: INVITE_GEOM, defaultDesign: 'b',
    bases: { a: 'new-years-eve-a-base.mp4', b: 'new-years-eve-b-base.mp4', c: 'new-years-eve-c-base.mp4' }
  };

  /* Christmas Card 2 "Snowy Cabin" (24 Nov 2026): the base video is the recipient page itself, rendered frame by frame
     (render-b2.js) with the written side empty and no name on the envelope. The envelope ARRIVES first (the wind brings
     it), so the tap is at 2.3 s. The words are laid out by the recipient page (index.html#view=face in a hidden frame),
     read back and drawn on the turned card; the name is written on the envelope once it has landed and goes with it.
     Geometry measured on every frame of the base video (render-b2.js MEASURE). */
  TEMPLATES['christmas-card-2'] = {
    kind: 'invite', fps: 30, defaultDesign: 'a', bases: { a: 'christmas-card-2-base.mp4' },
    geom: { frame: { W: 1080, H: 1920 }, stage: { W: 600, H: 1100 },
            card: { cx: 300, bottom: 909.76, s0: 1.16, s1: 1.16, ty1: 0 },   // the card is already at its reading size when the words appear
            settle: { at: 0, dur: 1 }, text: { at: 5.8, dur: 0.7 } },
    // name on the envelope: centre on the 1080x1920 frame, frame pixels per envelope unit, the page's own fit (30 -> 15 units, 252 wide)
    label: { cx: 540, cy: 1571.79, rot: -3, unit: 2.007273, size: 30, min: 15, maxW: 252, weight: 700, family: 'Caveat', color: '#4B3524', alpha: 0.92,
             inAt: 2.0, inDur: 0.5, outAt: 4.0, outDur: 0.35,
             text: function (d) { return d && d.t ? 'For ' + d.t : 'With love'; } }
  };

  /* ---------- CSS-identical easing ---------- */
  function bezier(x1, y1, x2, y2) {
    function A(p1, p2) { return 1 - 3 * p2 + 3 * p1; }
    function Bc(p1, p2) { return 3 * p2 - 6 * p1; }
    function C(p1) { return 3 * p1; }
    function calc(t, p1, p2) { return ((A(p1, p2) * t + Bc(p1, p2)) * t + C(p1)) * t; }
    function slope(t, p1, p2) { return 3 * A(p1, p2) * t * t + 2 * Bc(p1, p2) * t + C(p1); }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x, i;
      for (i = 0; i < 8; i++) {
        var s = slope(t, x1, x2);
        if (Math.abs(s) < 1e-7) break;
        t -= (calc(t, x1, x2) - x) / s;
      }
      if (!(t >= 0 && t <= 1) || Math.abs(calc(t, x1, x2) - x) > 1e-5) {
        var lo = 0, hi = 1; t = x;
        for (i = 0; i < 40; i++) { if (calc(t, x1, x2) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      }
      return calc(t, y1, y2);
    };
  }
  var EASE = bezier(0.25, 0.1, 0.25, 1);
  var EASE_OUT = bezier(0, 0, 0.58, 1);
  var CRUMPLE = bezier(0.45, 0, 0.6, 1);

  /* ---------- fonts (same Fraunces files as the card) ---------- */
  var fontsReady = null;
  function loadFonts(root) {
    if (fontsReady) return fontsReady;
    var faces = [
      new FontFace(FAMILY, 'url(' + root + 'fonts/fraunces-latin-full-italic.woff2) format("woff2")', { style: 'italic', weight: '100 900', unicodeRange: LATIN }),
      new FontFace(FAMILY, 'url(' + root + 'fonts/fraunces-latin-ext-full-italic.woff2) format("woff2")', { style: 'italic', weight: '100 900', unicodeRange: LATIN_EXT }),
      new FontFace(FAMILY, 'url(' + root + 'fonts/fraunces-latin-full-normal.woff2) format("woff2")', { style: 'normal', weight: '100 900', unicodeRange: LATIN }),
      new FontFace(FAMILY, 'url(' + root + 'fonts/fraunces-latin-ext-full-normal.woff2) format("woff2")', { style: 'normal', weight: '100 900', unicodeRange: LATIN_EXT })
    ];
    fontsReady = Promise.all(faces.map(function (f) { document.fonts.add(f); return f.load(); }));
    return fontsReady;
  }
  function font(weight, px, style) { return (style || 'italic') + ' ' + weight + ' ' + px.toFixed(2) + 'px ' + FAMILY + ', Georgia, serif'; }

  /* ---------- text layout ---------- */
  function wrap(ctx, text, maxW) {
    var lines = [];
    String(text).replace(/\r/g, '').split('\n').forEach(function (para) {
      var words = para.split(/ +/), line = '';
      if (!para.trim()) { lines.push(''); return; }
      words.forEach(function (w) {
        if (!w) return;
        var tryLine = line ? line + ' ' + w : w;
        if (ctx.measureText(tryLine).width <= maxW) { line = tryLine; return; }
        if (line) { lines.push(line); line = ''; }
        if (ctx.measureText(w).width <= maxW) { line = w; return; }
        var part = '';
        Array.from(w).forEach(function (ch) {
          if (ctx.measureText(part + ch).width > maxW && part) { lines.push(part); part = ch; } else part += ch;
        });
        line = part;
      });
      if (line) lines.push(line);
    });
    return lines;
  }
  function measureSpaced(ctx, text, sp) { return ctx.measureText(text).width + (sp ? sp * Math.max(0, Array.from(text).length - 1) : 0); }
  function wrapBalanced(ctx, text, maxW) {
    // like CSS text-wrap: balance — same number of lines, as even as possible
    var lines = wrap(ctx, text, maxW);
    if (lines.length < 2) return lines;
    var lo = maxW / 2, hi = maxW, i;
    for (i = 0; i < 14; i++) { var mid = (lo + hi) / 2; if (wrap(ctx, text, mid).length > lines.length) lo = mid; else hi = mid; }
    return wrap(ctx, text, hi);
  }
  function layoutMessage(ctx, data, M) {
    var res = null;
    for (var size = M.max; size >= M.min - 1e-9; size -= 0.5) {
      var px = size * M.k, lines = [], h = 0, first = true;
      M.parts.forEach(function (P) {
        if (P.when && !data[P.when]) return;
        var fpx = px * P.size, f = font(P.weight, fpx, P.style), lh = fpx * P.lh, sp = P.spacing ? P.spacing * fpx : 0;
        if (!first) h += M.gap * px;
        first = false;
        ctx.font = f;
        var wrapped = P.spacing ? [P.text(data)] : (P.balance ? wrapBalanced(ctx, P.text(data), M.w) : wrap(ctx, P.text(data), M.w));
        wrapped.forEach(function (l) { lines.push({ text: l, font: f, color: P.color, y: h + lh / 2, sp: sp }); h += lh; });
        if (P.after) h += P.after * fpx;
      });
      res = { lines: lines, height: h, size: size };
      if (h <= M.h) break;
    }
    return res;
  }

  /* ---------- overlays ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function prepareTag(ctx, text, G) {
    var px = 13 * G.s;
    ctx.font = font(500, px);
    var pad = 14 * G.s, maxText = (G.maxW - 28) * G.s, t = text;
    if (ctx.measureText(t).width > maxText) {
      while (t.length > 1 && ctx.measureText(t + '…').width > maxText) t = t.slice(0, -1);
      t = t.trim() + '…';
    }
    var w = ctx.measureText(t).width + 2 * pad, h = 28 * G.s;
    return { text: t, w: w, h: h, cx: G.right - w / 2, cy: G.bottom - h / 2, px: px };
  }
  function tagAlpha(t, G) {
    var a = t < G.fadeAt ? 1 : 1 - EASE((t - G.fadeAt) / G.fadeDur);
    // the crumpled envelope appears on top of the tag as it fades in
    if (t >= G.crumpleAt) { var p = (t - G.crumpleAt) / (G.crumpleDur * 0.16); a *= 1 - (p >= 1 ? 1 : CRUMPLE(p)); }
    return Math.max(0, Math.min(1, a));
  }
  function drawTag(ctx, T, G, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(T.cx, T.cy);
    ctx.rotate(G.rot * Math.PI / 180);
    ctx.shadowColor = G.shadow; ctx.shadowBlur = 8 * G.s; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3 * G.s;
    roundRect(ctx, -T.w / 2, -T.h / 2, T.w, T.h, 4 * G.s);
    ctx.fillStyle = G.bg; ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.font = font(500, T.px); ctx.fillStyle = G.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(T.text, 0, 0);
    ctx.restore();
  }
  function drawMessage(ctx, L, M, t) {
    if (t < M.inAt) return;
    var a = EASE_OUT(Math.min(1, (t - M.inAt) / M.inDur));
    var dy = (1 - a) * 10;
    var top = M.y + (M.h - L.height) / 2 + dy, cx = M.x + M.w / 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    L.lines.forEach(function (l) {
      if (!l.text) return;
      ctx.font = l.font; ctx.fillStyle = l.color;
      if (!l.sp) { ctx.textAlign = 'center'; ctx.fillText(l.text, cx, top + l.y); return; }
      var x = cx - measureSpaced(ctx, l.text, l.sp) / 2;
      ctx.textAlign = 'left';
      Array.from(l.text).forEach(function (ch) { ctx.fillText(ch, x, top + l.y); x += ctx.measureText(ch).width + l.sp; });
    });
    ctx.restore();
  }

  /* ---------- MP4 reading (our own base videos: one H.264 track, no B-frames) ---------- */
  function readBoxes(dv, start, end) {
    var out = [], p = start;
    while (p + 8 <= end) {
      var size = dv.getUint32(p), hdr = 8;
      var type = String.fromCharCode(dv.getUint8(p + 4), dv.getUint8(p + 5), dv.getUint8(p + 6), dv.getUint8(p + 7));
      if (size === 1) { size = Number(dv.getBigUint64(p + 8)); hdr = 16; } else if (size === 0) size = end - p;
      if (size < hdr) break;
      out.push({ type: type, data: p + hdr, end: p + size });
      p += size;
    }
    return out;
  }
  function kids(dv, box, type) { return readBoxes(dv, box.data, box.end).filter(function (b) { return b.type === type; }); }
  function kid(dv, box, type) { return kids(dv, box, type)[0] || null; }
  function demux(buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf), i, j, n;
    var moov = readBoxes(dv, 0, buf.byteLength).filter(function (b) { return b.type === 'moov'; })[0];
    if (!moov) throw new Error('base video: no moov');
    var trak = null, mdia = null;
    kids(dv, moov, 'trak').forEach(function (tk) {
      var md = kid(dv, tk, 'mdia'), hd = md && kid(dv, md, 'hdlr');
      if (!trak && hd && String.fromCharCode(u8[hd.data + 8], u8[hd.data + 9], u8[hd.data + 10], u8[hd.data + 11]) === 'vide') { trak = tk; mdia = md; }
    });
    if (!trak) throw new Error('base video: no video track');
    var mdhd = kid(dv, mdia, 'mdhd');
    var timescale = u8[mdhd.data] === 1 ? dv.getUint32(mdhd.data + 20) : dv.getUint32(mdhd.data + 12);
    var stbl = kid(dv, kid(dv, mdia, 'minf'), 'stbl');
    if (kid(dv, stbl, 'ctts')) throw new Error('base video uses B-frames');
    var stsd = kid(dv, stbl, 'stsd');
    var entry = readBoxes(dv, stsd.data + 8, stsd.end)[0];
    var width = dv.getUint16(entry.data + 24), height = dv.getUint16(entry.data + 26);
    var avcC = readBoxes(dv, entry.data + 78, entry.end).filter(function (b) { return b.type === 'avcC'; })[0];
    if (!avcC) throw new Error('base video is not H.264');
    var description = u8.slice(avcC.data, avcC.end);
    function hx(v) { return (v < 16 ? '0' : '') + v.toString(16); }
    var codec = 'avc1.' + hx(description[1]) + hx(description[2]) + hx(description[3]);
    var stts = kid(dv, stbl, 'stts'), deltas = [];
    n = dv.getUint32(stts.data + 4);
    for (i = 0; i < n; i++) { var c = dv.getUint32(stts.data + 8 + i * 8), d = dv.getUint32(stts.data + 12 + i * 8); for (j = 0; j < c; j++) deltas.push(d); }
    var stsz = kid(dv, stbl, 'stsz'), fixed = dv.getUint32(stsz.data + 4), count = dv.getUint32(stsz.data + 8), sizes = [];
    for (i = 0; i < count; i++) sizes.push(fixed || dv.getUint32(stsz.data + 12 + i * 4));
    var stco = kid(dv, stbl, 'stco'), co64 = kid(dv, stbl, 'co64'), offs = [];
    if (stco) { n = dv.getUint32(stco.data + 4); for (i = 0; i < n; i++) offs.push(dv.getUint32(stco.data + 8 + i * 4)); }
    else { n = dv.getUint32(co64.data + 4); for (i = 0; i < n; i++) offs.push(Number(dv.getBigUint64(co64.data + 8 + i * 8))); }
    var stsc = kid(dv, stbl, 'stsc'), runs = [];
    n = dv.getUint32(stsc.data + 4);
    for (i = 0; i < n; i++) runs.push({ first: dv.getUint32(stsc.data + 8 + i * 12), per: dv.getUint32(stsc.data + 12 + i * 12) });
    var samples = [], s = 0;
    for (var ch = 0; ch < offs.length; ch++) {
      var per = 0;
      for (var r = 0; r < runs.length; r++) if (runs[r].first <= ch + 1) per = runs[r].per;
      for (var o = offs[ch], k = 0; k < per && s < count; k++, s++) { samples.push({ offset: o, size: sizes[s] }); o += sizes[s]; }
    }
    var stss = kid(dv, stbl, 'stss'), keys = null;
    if (stss) { keys = {}; n = dv.getUint32(stss.data + 4); for (i = 0; i < n; i++) keys[dv.getUint32(stss.data + 8 + i * 4) - 1] = true; }
    var t = 0;
    for (i = 0; i < samples.length; i++) {
      samples[i].dts = t; samples[i].dur = deltas[i] || deltas[deltas.length - 1];
      samples[i].key = keys ? !!keys[i] : i === 0; t += samples[i].dur;
    }
    return { codec: codec, description: description, width: width, height: height, timescale: timescale, samples: samples, bytes: u8 };
  }

  /* ---------- H.264 helpers (if an encoder hands out Annex B instead of AVCC) ---------- */
  function toU8(x) {
    if (x instanceof Uint8Array) return new Uint8Array(x);
    if (x instanceof ArrayBuffer) return new Uint8Array(x.slice(0));
    return new Uint8Array(x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength));
  }
  function isAnnexB(b) { return b.length > 4 && b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 1; }
  function splitAnnexB(b) {
    var nals = [], i = 0, start = -1;
    while (i + 3 <= b.length) {
      if (b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 1) {
        if (start >= 0) { var e = i; while (e > start && b[e - 1] === 0) e--; nals.push(b.subarray(start, e)); }
        i += 3; start = i;
      } else i++;
    }
    if (start >= 0) nals.push(b.subarray(start));
    return nals;
  }
  function annexToAvcc(b, params) {
    var nals = splitAnnexB(b), out = [], len = 0;
    nals.forEach(function (nal) {
      var type = nal[0] & 31;
      if (type === 7) { params.sps = toU8(nal); return; }
      if (type === 8) { params.pps = toU8(nal); return; }
      if (type === 9) return; // access unit delimiter
      out.push(nal); len += 4 + nal.length;
    });
    var res = new Uint8Array(len), p = 0;
    out.forEach(function (nal) { new DataView(res.buffer).setUint32(p, nal.length); res.set(nal, p + 4); p += 4 + nal.length; });
    return res;
  }
  function buildAvcC(sps, pps) {
    var a = [1, sps[1], sps[2], sps[3], 0xff, 0xe1, (sps.length >> 8) & 255, sps.length & 255];
    var out = new Uint8Array(a.length + sps.length + 3 + pps.length);
    out.set(a, 0); out.set(sps, a.length);
    var p = a.length + sps.length;
    out[p] = 1; out[p + 1] = (pps.length >> 8) & 255; out[p + 2] = pps.length & 255; out.set(pps, p + 3);
    return out;
  }

  /* ---------- MP4 writing (moov first, so phones and WhatsApp can start it at once) ---------- */
  function cat(list) { var len = 0, i, o = 0; for (i = 0; i < list.length; i++) len += list[i].length; var out = new Uint8Array(len); for (i = 0; i < list.length; i++) { out.set(list[i], o); o += list[i].length; } return out; }
  function B(a) { return a instanceof Uint8Array ? a : new Uint8Array(a); }
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function u16(n) { return [(n >>> 8) & 255, n & 255]; }
  function cc(s) { return [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)]; }
  function box(type) { var body = cat([].slice.call(arguments, 1).map(B)); return cat([B(u32(8 + body.length).concat(cc(type))), body]); }
  function full(type, ver, flags) { return box.apply(null, [type, [ver, (flags >>> 16) & 255, (flags >>> 8) & 255, flags & 255]].concat([].slice.call(arguments, 3))); }
  function zeros(n) { return new Uint8Array(n); }
  var MATRIX = [].concat(u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000));
  function mux(o) {
    var N = o.frames.length, DUR = 1000, TS = o.fps * DUR, movieDur = Math.round(N * 1000 / o.fps), i;
    var sizes = [], keys = [], offs = [], minOff = 0, needCtts = false;
    for (i = 0; i < N; i++) {
      sizes.push(o.frames[i].data.length);
      if (o.frames[i].key) keys.push(i + 1);
      var off = o.frames[i].pts - i; offs.push(off);
      if (off !== 0) needCtts = true;
      if (off < minOff) minOff = off;
    }
    var shift = -minOff;
    function build(chunkOffset) {
      var parts = [
        full('stsd', 0, 0, u32(1), box('avc1', zeros(6), u16(1), zeros(16), u16(o.width), u16(o.height), u32(0x480000), u32(0x480000), u32(0), u16(1), zeros(32), u16(0x18), u16(0xffff), box('avcC', o.description))),
        full('stts', 0, 0, u32(1), u32(N), u32(DUR))
      ];
      if (needCtts) {
        var runs = [], e = [];
        for (i = 0; i < N; i++) { var v = (offs[i] + shift) * DUR; if (runs.length && runs[runs.length - 1].v === v) runs[runs.length - 1].c++; else runs.push({ c: 1, v: v }); }
        runs.forEach(function (r) { e = e.concat(u32(r.c), u32(r.v)); });
        parts.push(full('ctts', 0, 0, u32(runs.length), e));
      }
      var ss = []; keys.forEach(function (k) { ss = ss.concat(u32(k)); });
      parts.push(full('stss', 0, 0, u32(keys.length), ss));
      parts.push(full('stsc', 0, 0, u32(1), u32(1), u32(N), u32(1)));
      var sz = new Uint8Array(N * 4), dvs = new DataView(sz.buffer);
      for (i = 0; i < N; i++) dvs.setUint32(i * 4, sizes[i]);
      parts.push(full('stsz', 0, 0, u32(0), u32(N), sz));
      parts.push(full('stco', 0, 0, u32(1), u32(chunkOffset)));
      var stbl = box.apply(null, ['stbl'].concat(parts));
      var minf = box('minf', full('vmhd', 0, 1, zeros(8)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
      var mdia = box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(TS), u32(N * DUR), u16(0x55c4), u16(0)),
        full('hdlr', 0, 0, u32(0), cc('vide'), zeros(12), B([86, 105, 100, 101, 111, 72, 97, 110, 100, 108, 101, 114, 0])), minf);
      var tk = [full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(movieDur), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(o.width * 65536), u32(o.height * 65536))];
      if (needCtts && shift) tk.push(box('edts', full('elst', 0, 0, u32(1), u32(movieDur), u32(shift * DUR), u32(0x10000))));
      tk.push(mdia);
      var mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movieDur), u32(0x10000), u16(0x100), zeros(10), MATRIX, zeros(24), u32(2));
      return box('moov', mvhd, box.apply(null, ['trak'].concat(tk)));
    }
    var ftyp = box('ftyp', cc('isom'), u32(512), cc('isom'), cc('iso2'), cc('avc1'), cc('mp41'));
    var start = ftyp.length + build(0).length + 8;
    var moov = build(start), total = 0;
    for (i = 0; i < N; i++) total += sizes[i];
    var out = new Uint8Array(start + total);
    out.set(ftyp, 0); out.set(moov, ftyp.length);
    new DataView(out.buffer).setUint32(ftyp.length + moov.length, 8 + total);
    out.set(cc('mdat'), ftyp.length + moov.length + 4);
    for (var p = start, f = 0; f < N; f++) { out.set(o.frames[f].data, p); p += sizes[f]; }
    return out;
  }

  /* ---------- encoder choice ---------- */
  function pickEncoder(W, H, fps, bitrate) {
    var codecs = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.64002a', 'avc1.4d002a', 'avc1.640032', 'avc1.4d0032'];
    var list = [];
    // 1st choice: constant quality (quantizer) — the same quality in every frame, so no visible
    // 'sharpening' a few frames after the start (variable bitrate does that: a jump at 0.1 s)
    codecs.forEach(function (c) { list.push({ codec: c, width: W, height: H, framerate: fps, bitrateMode: 'quantizer', latencyMode: 'quality', avc: { format: 'avc' } }); });
    var extras = [{ latencyMode: 'quality', bitrateMode: 'variable' }, { latencyMode: 'quality' }, {}];
    codecs.forEach(function (c) { extras.forEach(function (ex) { list.push(Object.assign({ codec: c, width: W, height: H, bitrate: bitrate, framerate: fps, avc: { format: 'avc' } }, ex)); }); });
    codecs.forEach(function (c) { list.push({ codec: c, width: W, height: H, bitrate: bitrate, framerate: fps }); });
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve(null);
      var cfg = list[i++];
      return VideoEncoder.isConfigSupported(cfg).then(function (s) { return s.supported ? cfg : next(); }, next);
    }
    return next();
  }

  function supported() {
    return typeof window.VideoEncoder === 'function' && typeof window.VideoDecoder === 'function' && typeof window.VideoFrame === 'function' && typeof window.EncodedVideoChunk === 'function';
  }

  /* ---------- invitations: layout read from the guest page, drawn on every frame ---------- */
  var SETTLE = bezier(0.45, 0, 0.2, 1);
  var LS_OK = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
  function faceMatrix(G, t) {   // face units (480x672) -> frame pixels at time t
    var S = Math.min(G.frame.W / G.stage.W, G.frame.H / G.stage.H);
    var e = SETTLE(Math.max(0, Math.min(1, (t - G.settle.at) / G.settle.dur)));
    var s = G.card.s0 + (G.card.s1 - G.card.s0) * e, ty = G.card.ty1 * e, k = s * S;
    return [k, 0, 0, k, G.frame.W / 2 + (G.card.cx - 240 * s - G.stage.W / 2) * S, G.frame.H / 2 + (G.card.bottom + ty - 672 * s - G.stage.H / 2) * S];
  }
  function detailsAlpha(G, t) { return t < G.text.at ? 0 : EASE(Math.min(1, (t - G.text.at) / G.text.dur)); }
  function fontOf(cs) { return (cs.fontStyle || 'normal') + ' ' + (cs.fontWeight || '400') + ' ' + cs.fontSize + ' ' + cs.fontFamily; }
  function splitTop(s) { // split at commas that are not inside parentheses
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) { var c = s[i]; if (c === '(') depth++; if (c === ')') depth--; if (c === ',' && !depth) { out.push(cur.trim()); cur = ''; } else cur += c; }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function parseShadow(s) { // "rgba(0, 0, 0, 0.35) 0px 1px 10px" (text-shadow) or "drop-shadow(rgba(...) 0px 1px 6px)" (filter)
    if (!s || s === 'none') return null;
    var m = /drop-shadow\((.*)\)\s*$/.exec(s); if (m) s = m[1];
    s = splitTop(s)[0] || '';
    var col = (/(rgba?\([^)]*\)|#[0-9a-f]{3,8}|\b[a-z]+\b)/i.exec(s) || [])[0] || 'rgba(0,0,0,0.5)';
    var nums = s.replace(col, ' ').match(/-?[\d.]+px|-?[\d.]+(?=\s|$)/g) || [];
    var n = nums.map(function (v) { return parseFloat(v) || 0; });
    return { color: col, x: n[0] || 0, y: n[1] || 0, blur: n[2] || 0 };
  }
  function parseGradient(s) { // vertical linear-gradient(...) -> [{at, color}]
    var m = /linear-gradient\((.*)\)\s*$/.exec(s); if (!m) return null;
    var parts = splitTop(m[1]), stops = [];
    if (parts.length && /deg|^to /.test(parts[0])) parts.shift();
    parts.forEach(function (p, i) {
      var q = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(p);
      stops.push({ color: q[1].trim(), at: q[2] !== undefined ? parseFloat(q[2]) / 100 : (parts.length > 1 ? i / (parts.length - 1) : 0) });
    });
    return stops.length ? stops : null;
  }
  function parseMatrix(s) {
    var m = /^matrix\(([^)]*)\)$/.exec(s || ''); if (!m) return null;
    var v = m[1].split(',').map(parseFloat);
    return v.length === 6 && v.every(isFinite) ? v : null;
  }
  function parsePolygon(s, w, h) {
    var m = /^polygon\((.*)\)$/.exec(s || ''); if (!m) return null;
    return splitTop(m[1]).map(function (pt) {
      var xy = pt.trim().split(/\s+/);
      function len(v, ref) { return /%$/.test(v) ? parseFloat(v) / 100 * ref : parseFloat(v) || 0; }
      return [len(xy[0], w) - w / 2, len(xy[1], h) - h / 2];
    });
  }
  function baselineOffset(d, cs) { // CSS px from the top of a character box to its baseline, same font and line height
    var p = d.createElement('div');
    p.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;visibility:hidden;margin:0;padding:0;border:0';
    ['fontStyle', 'fontWeight', 'fontSize', 'lineHeight', 'fontFamily', 'fontStretch', 'letterSpacing'].forEach(function (k) { p.style[k] = cs[k]; });
    var tx = d.createTextNode('Hx'); p.appendChild(tx);
    var mk = d.createElement('span'); mk.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; p.appendChild(mk);
    d.body.appendChild(p);
    var r = d.createRange(); r.setStart(tx, 0); r.setEnd(tx, 1);
    var off = mk.getBoundingClientRect().top - r.getClientRects()[0].top;
    d.body.removeChild(p);
    return off;
  }
  function readFaces(d) { // @font-face rules of the guest page's own stylesheets (the canvas needs the same font files)
    var out = [];
    Array.prototype.forEach.call(d.styleSheets, function (sh) {
      var rules; try { rules = sh.cssRules; } catch (e) { return; }   // other origins (Google Fonts): the buyer page has its own link
      Array.prototype.forEach.call(rules || [], function (r) {
        if (r.type !== 5) return; // CSSFontFaceRule
        var fam = r.style.getPropertyValue('font-family').replace(/^["']|["']$/g, '').trim();
        var u = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(r.style.getPropertyValue('src'));
        if (!fam || !u) return;
        out.push({ family: fam, url: new URL(u[1], sh.href || d.baseURI).href, weight: r.style.getPropertyValue('font-weight') || 'normal',
          style: r.style.getPropertyValue('font-style') || 'normal', range: r.style.getPropertyValue('unicode-range') || '' });
      });
    });
    return out;
  }
  function readInvite(d) {
    var win = d.defaultView, face = d.querySelector('.iface'), txt = face.querySelector('.itxt'), inner = txt.querySelector('.iin');
    // the guest page's own fit (fitFace): shrink everything together until the details fit the empty paper
    var size = 10, guard = 0;
    txt.style.fontSize = size + 'px';
    while (inner.scrollHeight > txt.clientHeight + 1 && size > 6.5 && guard++ < 60) { size -= 0.25; txt.style.fontSize = size + 'px'; }
    var fr = face.getBoundingClientRect(), k = 480 / fr.width, range = d.createRange(), ops = [];
    function fx(v) { return (v - fr.left) * k; }
    function fy(v) { return (v - fr.top) * k; }
    Array.prototype.forEach.call(inner.children, function (el) {
      var cs = win.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (el.classList.contains('orn')) {   // the ornament: two hairlines and a diamond (or a star)
        Array.prototype.forEach.call(el.children, function (c) {
          var s = win.getComputedStyle(c);
          if (s.display === 'none' || s.visibility === 'hidden') return;
          var keep = c.style.transform; c.style.transform = 'none';
          var r = c.getBoundingClientRect(); c.style.transform = keep;
          ops.push({ type: 'shape', cx: fx(r.left + r.width / 2), cy: fy(r.top + r.height / 2), w: r.width * k, h: r.height * k,
            color: s.backgroundColor, alpha: parseFloat(s.opacity), m: parseMatrix(s.transform), clip: parsePolygon(s.clipPath, r.width * k, r.height * k) });
        });
        return;
      }
      var node = el.firstChild;
      if (!node || node.nodeType !== 3 || !node.data) return;
      var fsz = parseFloat(cs.fontSize) || 10;
      var op = { type: 'text', font: fontOf(cs), color: cs.color, shadow: parseShadow(cs.textShadow) || parseShadow(cs.filter),
        ls: parseFloat(cs.letterSpacing) || 0, lines: [] };
      var fill = cs.webkitTextFillColor || cs.getPropertyValue('-webkit-text-fill-color');
      if (fill && /^(transparent|rgba\(0, 0, 0, 0\))$/.test(fill) && /gradient/.test(cs.backgroundImage)) {
        var stops = parseGradient(cs.backgroundImage), b = el.getBoundingClientRect();
        if (stops) op.grad = { y0: fy(b.top), y1: fy(b.bottom), stops: stops };
      }
      var upper = cs.textTransform === 'uppercase', asc = baselineOffset(d, cs), text = node.data, i = 0, line = null;
      while (i < text.length) {
        var n = text.codePointAt(i) > 0xffff ? 2 : 1, ch = text.substr(i, n);
        range.setStart(node, i); range.setEnd(node, i + n); i += n;
        var rs = range.getClientRects(), r = null;
        for (var j = 0; j < rs.length; j++) if (rs[j].width > 0 || rs[j].height > 0) { r = rs[j]; break; }
        if (!r) continue;
        if (/\s/.test(ch)) { if (line) line.chars.push(null); continue; }   // a space ends a word
        var top = fy(r.top);
        if (!line || Math.abs(top - line.top) > fsz * 0.4) { line = { top: top, chars: [] }; op.lines.push(line); }
        line.chars.push({ ch: upper ? ch.toUpperCase() : ch, x: fx(r.left) });
      }
      op.lines.forEach(function (L) {
        L.base = L.top + asc; L.words = [];
        var w = null;
        L.chars.forEach(function (c) {
          if (!c) { w = null; return; }
          if (!w) { w = { text: '', x: c.x, chars: [] }; L.words.push(w); }
          w.text += c.ch; w.chars.push(c);
        });
        delete L.chars;
      });
      ops.push(op);
    });
    return { ops: ops, size: size, faces: readFaces(d) };
  }
  function measureInvite(url) { // the guest page lays out the details (hidden frame, 480x672 = the card's own size)
    return new Promise(function (resolve, reject) {
      var ifr = document.createElement('iframe'), finished = false;
      ifr.setAttribute('aria-hidden', 'true'); ifr.setAttribute('tabindex', '-1'); ifr.title = 'Invitation layout';
      ifr.style.cssText = 'position:fixed;left:-10000px;top:0;width:480px;height:672px;border:0;opacity:0;pointer-events:none';
      var timer = setTimeout(function () { finish(new Error('layout timeout')); }, 30000);
      function finish(err, res) {
        if (finished) return; finished = true; clearTimeout(timer);
        if (ifr.parentNode) ifr.parentNode.removeChild(ifr);
        if (err) reject(err); else resolve(res);
      }
      ifr.onload = function () {
        var d, inner;
        try { d = ifr.contentDocument; inner = d && d.querySelector('.iface .itxt .iin'); } catch (e) { finish(e); return; }
        if (!inner) { finish(new Error('layout')); return; }
        var loads = [];
        Array.prototype.forEach.call(inner.children, function (el) {
          if (el.textContent) loads.push(d.fonts.load(fontOf(d.defaultView.getComputedStyle(el)), el.textContent).catch(function () { return null; }));
        });
        Promise.all(loads)
          .then(function () { return d.fonts.ready; })
          .then(function () { return new Promise(function (r) { setTimeout(r, 60); }); })
          .then(function () { finish(null, readInvite(d)); })
          .catch(function (e) { finish(e || new Error('layout')); });
      };
      ifr.src = url;
      document.body.appendChild(ifr);
    });
  }
  var addedFaces = {};
  function ensureInviteFonts(L) { // the same font files in this page, so the canvas draws exactly what the guest page lays out
    var used = {};
    L.ops.forEach(function (op) { if (op.font) used[op.font.split(/\s\d[\d.]*px\s/)[1].split(',')[0].replace(/["']/g, '').trim().toLowerCase()] = true; });
    L.faces.forEach(function (f) {
      if (!used[f.family.toLowerCase()] || addedFaces[f.family + '|' + f.url]) return;
      try {
        var desc = { weight: f.weight, style: f.style }; if (f.range) desc.unicodeRange = f.range;
        var ff = new FontFace(f.family, 'url("' + f.url + '")', desc);
        document.fonts.add(ff); addedFaces[f.family + '|' + f.url] = true;
      } catch (e) { /* the canvas falls back like the page does */ }
    });
    var seen = {}, loads = [];
    L.ops.forEach(function (op) {
      if (op.type !== 'text' || seen[op.font]) return; seen[op.font] = true;
      var sample = op.lines.map(function (l) { return l.words.map(function (w) { return w.text; }).join(' '); }).join(' ');
      loads.push(document.fonts.load(op.font, sample || 'A').catch(function () { return null; }));
    });
    return Promise.all(loads);
  }
  /* the name written on the envelope (templates with `label`): same font, fit, place and fades as on the recipient page */
  function prepareLabel(G, data) {
    var c = document.createElement('canvas').getContext('2d'), text = G.text(data), size = G.size;
    function f(sz) { return G.weight + ' ' + (sz * G.unit).toFixed(2) + 'px ' + G.family + ', cursive'; }
    c.font = f(size);
    while (c.measureText(text).width > G.maxW * G.unit && size > G.min) { size -= 1; c.font = f(size); }
    var m = c.measureText(text), asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    return { text: text, font: f(size), dy: (isFinite(asc) && isFinite(desc)) ? (asc - desc) / 2 : null };
  }
  function drawLabel(ctx, Lb, G, t) {
    var a = t < G.inAt ? 0 : EASE(Math.min(1, (t - G.inAt) / G.inDur));
    if (t > G.outAt) a *= 1 - EASE(Math.min(1, (t - G.outAt) / G.outDur));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a * G.alpha;
    ctx.translate(G.cx, G.cy); ctx.rotate(G.rot * Math.PI / 180);
    ctx.font = Lb.font; ctx.fillStyle = G.color; ctx.textAlign = 'center';
    if (Lb.dy === null) { ctx.textBaseline = 'middle'; ctx.fillText(Lb.text, 0, 0); }
    else { ctx.textBaseline = 'alphabetic'; ctx.fillText(Lb.text, 0, Lb.dy); }
    ctx.restore();
  }
  function drawInvite(c, L, k) { // c is already in face units; k = face unit -> frame pixel (shadows are in frame pixels)
    L.ops.forEach(function (op) {
      c.save();
      if (op.type === 'shape') {
        c.globalAlpha = isFinite(op.alpha) ? op.alpha : 1;
        c.fillStyle = op.color;
        c.translate(op.cx, op.cy);
        if (op.m) c.transform(op.m[0], op.m[1], op.m[2], op.m[3], op.m[4], op.m[5]);
        if (op.clip && op.clip.length > 2) {
          c.beginPath(); c.moveTo(op.clip[0][0], op.clip[0][1]);
          for (var q = 1; q < op.clip.length; q++) c.lineTo(op.clip[q][0], op.clip[q][1]);
          c.closePath(); c.fill();
        } else c.fillRect(-op.w / 2, -op.h / 2, op.w, op.h);
        c.restore();
        return;
      }
      c.font = op.font; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      if (op.grad) {
        var g = c.createLinearGradient(0, op.grad.y0, 0, op.grad.y1);
        op.grad.stops.forEach(function (s) { try { g.addColorStop(Math.max(0, Math.min(1, s.at)), s.color); } catch (e) { /* skip */ } });
        c.fillStyle = g;
      } else c.fillStyle = op.color;
      if (op.shadow) { c.shadowColor = op.shadow.color; c.shadowOffsetX = op.shadow.x * k; c.shadowOffsetY = op.shadow.y * k; c.shadowBlur = op.shadow.blur * k; }
      var perChar = op.ls && !LS_OK;
      if (op.ls && LS_OK) c.letterSpacing = op.ls + 'px';
      op.lines.forEach(function (Ln) {
        Ln.words.forEach(function (w) {
          if (perChar) w.chars.forEach(function (ch) { c.fillText(ch.ch, ch.x, Ln.base); });
          else c.fillText(w.text, w.x, Ln.base);
        });
      });
      c.restore();
    });
  }

  function encodeVideo(buf, fps, opts, overlay, onProgress, started, extra) { // decode our base video, draw, encode again
    var QP = opts.quantizer || 20, base, canvas, ctx, ecfg;
    base = demux(buf);
    return VideoDecoder.isConfigSupported({ codec: base.codec, description: base.description, codedWidth: base.width, codedHeight: base.height })
      .then(function (ds) {
        if (!ds.supported) throw new Error('decoder ' + base.codec);
        return pickEncoder(base.width, base.height, fps, opts.bitrate || 8000000);
      })
      .then(function (cfg) {
        if (!cfg) throw new Error('encoder');
        ecfg = cfg;
        var W = base.width, H = base.height, N = base.samples.length;
        canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        ctx = canvas.getContext('2d', { alpha: false });
        return new Promise(function (resolve, reject) {
          var frames = [], desc = null, params = {}, failed = null, index = 0;
          function fail(e) { if (!failed) { failed = e || new Error('codec error'); reject(failed); } }
          var encoder = new VideoEncoder({
            output: function (chunk, meta) {
              if (meta && meta.decoderConfig && meta.decoderConfig.description && !desc) desc = toU8(meta.decoderConfig.description);
              var d = new Uint8Array(chunk.byteLength); chunk.copyTo(d);
              if (isAnnexB(d)) d = annexToAvcc(d, params);
              frames.push({ data: d, key: chunk.type === 'key', pts: Math.round(chunk.timestamp * fps / 1e6) });
            },
            error: fail
          });
          encoder.configure(ecfg);
          var decoder = new VideoDecoder({
            output: function (vf) {
              if (failed) { vf.close(); return; }
              var i = index++, t = i / fps;
              ctx.drawImage(vf, 0, 0, W, H); vf.close();
              try { overlay(ctx, t, W, H); } catch (e) { fail(e); return; }
              var nf = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
              encoder.encode(nf, ecfg.bitrateMode === 'quantizer' ? { keyFrame: i === 0, avc: { quantizer: QP } } : { keyFrame: i === 0 });
              nf.close();
              if (onProgress) onProgress(Math.min(1, (i + 1) / N));
            },
            error: fail
          });
          decoder.configure({ codec: base.codec, description: base.description, codedWidth: W, codedHeight: H });
          var k = 0;
          function pump() {
            if (failed) return;
            while (k < N && decoder.decodeQueueSize < 4 && encoder.encodeQueueSize < 4) {
              var s = base.samples[k];
              decoder.decode(new EncodedVideoChunk({ type: s.key ? 'key' : 'delta', timestamp: Math.round(s.dts * 1e6 / base.timescale), duration: Math.round(s.dur * 1e6 / base.timescale), data: base.bytes.subarray(s.offset, s.offset + s.size) }));
              k++;
            }
            if (k < N) { setTimeout(pump, 2); return; }
            decoder.flush()
              .then(function () { return encoder.flush(); })
              .then(function () {
                try { decoder.close(); } catch (e) { /* closed */ }
                try { encoder.close(); } catch (e) { /* closed */ }
                if (failed) return;
                if (frames.length !== N) throw new Error('frames ' + frames.length + '/' + N);
                if (!desc && params.sps && params.pps) desc = buildAvcC(params.sps, params.pps);
                if (!desc) throw new Error('no H.264 parameters');
                var mp4 = mux({ width: W, height: H, fps: fps, frames: frames, description: desc });
                var res = { blob: new Blob([mp4], { type: 'video/mp4' }), seconds: (Date.now() - started) / 1000, codec: ecfg.codec + (ecfg.bitrateMode === 'quantizer' ? ' q' + QP : ' vbr'), frames: N, keyFrames: frames.filter(function (f) { return f.key; }).length };
                Object.keys(extra || {}).forEach(function (x) { res[x] = extra[x]; });
                resolve(res);
              })
              .catch(fail);
          }
          pump();
        });
      });
  }

  function makeInvite(tpl, opts, onProgress) {
    var root = opts.root || '', design = Object.prototype.hasOwnProperty.call(tpl.bases, opts.design) ? opts.design : tpl.defaultDesign;
    var G = tpl.geom, started = Date.now(), lay = null;
    if (!supported()) return Promise.reject(new Error('unsupported'));
    if (!opts.face) return Promise.reject(new Error('face'));
    return measureInvite(opts.face)
      .then(function (L) { lay = L; return ensureInviteFonts(L); })
      .then(function () { return tpl.label ? document.fonts.load(tpl.label.weight + ' 40px ' + tpl.label.family, tpl.label.text(opts.data || {})).catch(function () { return null; }) : null; })
      .then(function () { return fetch(root + tpl.bases[design]); })
      .then(function (r) { if (!r.ok) throw new Error('base video ' + r.status); return r.arrayBuffer(); })
      .then(function (buf) {
        var layer = null, lctx = null, lastKey = '';
        var lab = tpl.label ? prepareLabel(tpl.label, opts.data || {}) : null;
        return encodeVideo(buf, tpl.fps, opts, function (ctx, t, W, H) {
          if (lab) drawLabel(ctx, lab, tpl.label, t);
          var a = detailsAlpha(G, t);
          if (a <= 0) return;
          var M = faceMatrix(G, t), key = M.map(function (v) { return v.toFixed(4); }).join(',');
          if (!layer) { layer = document.createElement('canvas'); layer.width = W; layer.height = H; lctx = layer.getContext('2d'); }
          if (key !== lastKey) {   // the details move only while the card settles; afterwards the same layer is reused
            lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, W, H);
            lctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
            drawInvite(lctx, lay, M[0]);
            lastKey = key;
          }
          ctx.save(); ctx.globalAlpha = a; ctx.drawImage(layer, 0, 0); ctx.restore();   // one layer = the page's group opacity
        }, onProgress, started, { fontSize: lay.size, design: design });
      });
  }

  /* ---------- the whole job ---------- */
  function make(opts, onProgress) {
    var tpl = TEMPLATES[opts.template || 'christmas'];
    if (!tpl) return Promise.reject(new Error('template'));
    if (tpl.kind === 'invite') return makeInvite(tpl, opts, onProgress);
    var root = opts.root || '';
    var data = { t: (opts.data.t || '').trim(), m: (opts.data.m || '').trim() || tpl.defaultMessage, s: (opts.data.s || '').trim() };
    var fps = tpl.fps, started = Date.now(), QP = opts.quantizer || 20;
    if (!supported()) return Promise.reject(new Error('unsupported'));
    var base, canvas, ctx, tag, msg, ecfg;
    return loadFonts(root)
      .then(function () { return fetch(root + tpl.base); })
      .then(function (r) { if (!r.ok) throw new Error('base video ' + r.status); return r.arrayBuffer(); })
      .then(function (buf) {
        base = demux(buf);
        return VideoDecoder.isConfigSupported({ codec: base.codec, description: base.description, codedWidth: base.width, codedHeight: base.height });
      })
      .then(function (ds) {
        if (!ds.supported) throw new Error('decoder ' + base.codec);
        return pickEncoder(base.width, base.height, fps, opts.bitrate || 8000000);
      })
      .then(function (cfg) {
        if (!cfg) throw new Error('encoder');
        ecfg = cfg;
        var W = base.width, H = base.height, N = base.samples.length;
        canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        ctx = canvas.getContext('2d', { alpha: false });
        tag = prepareTag(ctx, tpl.tag.text(data), tpl.tag);
        msg = layoutMessage(ctx, data, tpl.msg);
        return new Promise(function (resolve, reject) {
          var frames = [], desc = null, params = {}, failed = null, index = 0;
          function fail(e) { if (!failed) { failed = e || new Error('codec error'); reject(failed); } }
          var encoder = new VideoEncoder({
            output: function (chunk, meta) {
              if (meta && meta.decoderConfig && meta.decoderConfig.description && !desc) desc = toU8(meta.decoderConfig.description);
              var d = new Uint8Array(chunk.byteLength); chunk.copyTo(d);
              if (isAnnexB(d)) d = annexToAvcc(d, params);
              frames.push({ data: d, key: chunk.type === 'key', pts: Math.round(chunk.timestamp * fps / 1e6) });
            },
            error: fail
          });
          encoder.configure(ecfg);
          var decoder = new VideoDecoder({
            output: function (vf) {
              if (failed) { vf.close(); return; }
              var i = index++, t = i / fps;
              ctx.drawImage(vf, 0, 0, W, H); vf.close();
              drawTag(ctx, tag, tpl.tag, tagAlpha(t, tpl.tag));
              drawMessage(ctx, msg, tpl.msg, t);
              var nf = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
              encoder.encode(nf, ecfg.bitrateMode === 'quantizer' ? { keyFrame: i === 0, avc: { quantizer: QP } } : { keyFrame: i === 0 });
              nf.close();
              if (onProgress) onProgress(Math.min(1, (i + 1) / N));
            },
            error: fail
          });
          decoder.configure({ codec: base.codec, description: base.description, codedWidth: W, codedHeight: H });
          var k = 0;
          function pump() {
            if (failed) return;
            while (k < N && decoder.decodeQueueSize < 4 && encoder.encodeQueueSize < 4) {
              var s = base.samples[k];
              decoder.decode(new EncodedVideoChunk({ type: s.key ? 'key' : 'delta', timestamp: Math.round(s.dts * 1e6 / base.timescale), duration: Math.round(s.dur * 1e6 / base.timescale), data: base.bytes.subarray(s.offset, s.offset + s.size) }));
              k++;
            }
            if (k < N) { setTimeout(pump, 2); return; }
            decoder.flush()
              .then(function () { return encoder.flush(); })
              .then(function () {
                try { decoder.close(); } catch (e) { /* closed */ }
                try { encoder.close(); } catch (e) { /* closed */ }
                if (failed) return;
                if (frames.length !== N) throw new Error('frames ' + frames.length + '/' + N);
                if (!desc && params.sps && params.pps) desc = buildAvcC(params.sps, params.pps);
                if (!desc) throw new Error('no H.264 parameters');
                var mp4 = mux({ width: W, height: H, fps: fps, frames: frames, description: desc });
                resolve({ blob: new Blob([mp4], { type: 'video/mp4' }), seconds: (Date.now() - started) / 1000, codec: ecfg.codec + (ecfg.bitrateMode === 'quantizer' ? ' q' + QP : ' vbr'), frames: N, keyFrames: frames.filter(function (f) { return f.key; }).length, fontSize: msg.size });
              })
              .catch(fail);
          }
          pump();
        });
      });
  }

  window.WishberryVideo = { make: make, supported: supported, templates: TEMPLATES, _demux: demux, _mux: mux };
})();
