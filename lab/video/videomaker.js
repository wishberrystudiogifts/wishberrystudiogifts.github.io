/* Wishberry Studio — personal video maker (test version, 19 Nov 2026).
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
             fadeAt: 2.95, fadeDur: 0.3, crumpleAt: 2.9, crumpleDur: 1.8 },
      // inside page: text area between the star and the three dots (frame pixels)
      msg: { x: 595.21, y: 791.15, w: 400.78, h: 425.33, k: 1.0224, max: 30, min: 17, inAt: 5.6, inDur: 0.9 },
      defaultMessage: 'Wishing you a season full of warmth, joy and light.'
    }
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
      new FontFace(FAMILY, 'url(' + root + 'fonts/fraunces-latin-ext-full-italic.woff2) format("woff2")', { style: 'italic', weight: '100 900', unicodeRange: LATIN_EXT })
    ];
    fontsReady = Promise.all(faces.map(function (f) { document.fonts.add(f); return f.load(); }));
    return fontsReady;
  }
  function font(weight, px) { return 'italic ' + weight + ' ' + px.toFixed(2) + 'px ' + FAMILY + ', Georgia, serif'; }

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
  function layoutMessage(ctx, data, M) {
    var res = null;
    for (var size = M.max; size >= M.min - 1e-9; size -= 0.5) {
      var px = size * M.k, blocks = [];
      if (data.t) blocks.push({ text: 'Dear ' + data.t + ',', font: font(600, px * 1.08), color: '#27352B', lh: px * 1.08 * 1.3 });
      blocks.push({ text: data.m, font: font(400, px), color: '#27352B', lh: px * 1.55 });
      if (data.s) blocks.push({ text: data.s, font: font(600, px), color: '#5A2A22', lh: px * 1.35 });
      var gap = px * 0.75, lines = [], h = 0;
      blocks.forEach(function (bk, bi) {
        ctx.font = bk.font;
        if (bi) h += gap;
        wrap(ctx, bk.text, M.w).forEach(function (l) { lines.push({ text: l, font: bk.font, color: bk.color, y: h + bk.lh / 2 }); h += bk.lh; });
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
    ctx.shadowColor = 'rgba(10,5,5,0.35)'; ctx.shadowBlur = 8 * G.s; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3 * G.s;
    roundRect(ctx, -T.w / 2, -T.h / 2, T.w, T.h, 4 * G.s);
    ctx.fillStyle = '#F4ECDD'; ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.font = font(500, T.px); ctx.fillStyle = '#6E1E1A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
    L.lines.forEach(function (l) { if (!l.text) return; ctx.font = l.font; ctx.fillStyle = l.color; ctx.fillText(l.text, cx, top + l.y); });
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

  /* ---------- the whole job ---------- */
  function make(opts, onProgress) {
    var tpl = TEMPLATES[opts.template || 'christmas'];
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
        tag = prepareTag(ctx, data.t ? 'For ' + data.t : 'With love', tpl.tag);
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
