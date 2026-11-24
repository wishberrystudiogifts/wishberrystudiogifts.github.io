/* Wishberry — PRODUCT LINK, the shared code of the new standard (Nov 2026).  Guide: service/README.md.

   product link     = the link the BUYER gets:  https://wishberrystudiogifts.github.io/<hash>
   invitation link  = the link the buyer SENDS: …/product/<folder>/#m=<data>&s=<signature>

   What this file does, by page:
   - 404.html (router):           ProductLink.route()                  /<hash> -> asks the service -> shows the buyer's page
   - buyer page (entry address):  ProductLink.entry({product}) + ProductLink.ready(fn) + ProductLink.invitationLink(packed)
   - recipient page:              ProductLink.recipientPage({product}) + ProductLink.guard(boot)

   A product in mode 'direct' (shared/config.js) never calls the service: entry() opens the maker at once,
   invitationLink() returns an unsigned link and guard() lets every link through — exactly the old behaviour. */
(function () {
  'use strict';
  var CFG = window.WB_CONFIG || { products: {} };
  var HASH_RE = /^[A-Za-z0-9_-]{22}$/;
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var ETSY_NOTICE = "The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.";
  var PL = { state: 'none', session: null, page: null, version: '2026-11-24b' };

  /* ---------- small helpers ---------- */
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) { localStorage.removeItem(k); return null; }
      localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }
  function el(tag, cls, text, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function product(key) {
    var ps = CFG.products || {};
    return typeof key === 'string' && Object.prototype.hasOwnProperty.call(ps, key) ? ps[key] : null;
  }
  function folderPath(p) { return '/' + String(p.folder).replace(/^\/+|\/+$/g, '') + '/'; }
  function folderUrl(p) { return location.origin + folderPath(p); }
  function entryPath(p) { return folderPath(p) + p.entry; }
  function limits(p) {
    var g = CFG.limits || {}, o = (p && p.limits) || {};
    return { ttlHours: o.ttlHours || g.ttlHours || 720, maxOpens: o.maxOpens || g.maxOpens || 300 };
  }
  function ttlWords(h) {
    if (h >= 48 && h % 24 === 0) return (h / 24) + ' days';
    if (h === 24) return '24 hours';
    return h + (h === 1 ? ' hour' : ' hours');
  }
  /* The service address. On a developer's own computer (localhost) the local service is used instead. */
  function serviceUrl() {
    if (LOCAL) return String(store('wb.serviceUrl') || 'http://127.0.0.1:8787').replace(/\/+$/, '');
    return String(CFG.serviceUrl || '').replace(/\/+$/, '');
  }
  function api(method, path, body) {
    var init = { method: method, mode: 'cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
    if (body) { init.headers = { 'Content-Type': 'text/plain;charset=UTF-8' }; init.body = JSON.stringify(body); }
    return fetch(serviceUrl() + path, init).then(function (res) {
      return res.json().then(function (j) { return { status: res.status, body: j || {} }; }, function () { return { status: res.status, body: {} }; });
    });
  }
  function fmtWhen(ms) {
    try {
      return new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) { return new Date(ms).toString(); }
  }
  function b64urlBytes(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  /* The part of the address after "#", read STRICTLY. The page's own code reads it with URLSearchParams (names are
     percent-decoded, a leading "?" is dropped, the first "m" wins), so a signature check that read it any other way
     could approve one "m" while the page showed another. Therefore: "m" and "s" must each be there exactly once,
     spelled plainly, made only of base64url characters, and the browser's own parser must agree. Only a few other
     parts are kept (view, size, autoplay); anything else is dropped. */
  var EXTRA = { view: /^[a-z]{1,12}$/, size: /^[A-Za-z0-9]{1,12}$/, autoplay: /^[01]$/ };
  function parseFragment() {
    var raw = String(location.hash || '').replace(/^#/, '');
    var out = { ok: true, m: null, s: null, extra: [] }, seen = {};
    raw.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='), nameRaw = i < 0 ? kv : kv.slice(0, i), val = i < 0 ? '' : kv.slice(i + 1), name;
      try { name = decodeURIComponent(nameRaw.replace(/\+/g, ' ')).replace(/^\?/, ''); } catch (e) { out.ok = false; return; }
      if (name === 'm' || name === 's') {
        if (seen[name] || nameRaw !== name || !/^[A-Za-z0-9_-]+$/.test(val)) { out.ok = false; return; }
        seen[name] = 1; out[name] = val;
      } else if (Object.prototype.hasOwnProperty.call(EXTRA, nameRaw) && EXTRA[nameRaw].test(val) && !seen['x:' + nameRaw]) {
        seen['x:' + nameRaw] = 1; out.extra.push(nameRaw + '=' + val);
      }
    });
    try {
      var q = new URLSearchParams(raw);
      if (q.getAll('m').length !== (out.m ? 1 : 0) || q.getAll('s').length !== (out.s ? 1 : 0)) out.ok = false;
      if (out.m && q.get('m') !== out.m) out.ok = false;
    } catch (e) { out.ok = false; }
    return out;
  }
  /* After a link has passed the check, the address is rewritten to exactly what was checked — so whatever way the
     page's own code reads it, it can only find the checked "m". (No reload, no hashchange event.) */
  function canonicalize(f) {
    var want = '#m=' + f.m + '&s=' + f.s + (f.extra.length ? '&' + f.extra.join('&') : '');
    if (location.hash === want) return;
    try { history.replaceState(history.state, '', location.pathname + location.search + want); } catch (e) {}
  }
  function framed() { try { return window.top !== window.self; } catch (e) { return true; } }

  /* ---------- simple full-page messages (router and recipient page) ---------- */
  function shell(title) {
    document.title = title;
    document.documentElement.className = (document.documentElement.className + ' wb-plain').replace(/\bwb-gated\b/g, '');
    var b = document.body;
    while (b.firstChild) b.removeChild(b.firstChild);
    b.className = 'wb-page';
    var main = el('main', 'wb-card', null, b);
    return main;
  }
  function shopButtons(main, primaryText, single) {
    var row = el('div', 'wb-btns' + (single ? ' wb-one' : ''), null, main);
    var a = el('a', 'wb-btn wb-primary', primaryText || 'Visit our shop', row);
    a.href = CFG.shopUrl || 'https://wishberrystudiogifts.etsy.com'; a.rel = 'noopener';
    if (single) return;
    var m = el('a', 'wb-btn wb-ghost', 'Message us on Etsy', row);
    m.href = CFG.messageUrl || CFG.shopUrl || 'https://wishberrystudiogifts.etsy.com'; m.rel = 'noopener';
  }
  function showMessage(o) {
    var main = shell(o.title);
    if (o.badge) el('p', 'wb-badge', o.badge, main);
    el('h1', null, o.title, main);
    (o.lines || []).forEach(function (t) { el('p', null, t, main); });
    if (o.retry) {
      var r = el('button', 'wb-btn wb-primary wb-wide', 'Try again', main); r.type = 'button';
      r.addEventListener('click', function () { location.reload(); });
    }
    if (o.shop) shopButtons(main, o.shopText, o.shop === 'single');
    if (o.again) {
      var p = el('p', 'wb-small', null, main);
      var a = el('a', null, o.again.text, p); a.href = o.again.href;
    }
    return main;
  }

  /* ---------- 404.html: the router ---------- */
  function forget(hash) {
    var found = null;
    Object.keys(CFG.products || {}).forEach(function (k) { if (store('wb.pl.' + k) === hash) { store('wb.pl.' + k, null); found = k; } });
    return found;
  }
  function showExpired(d) {
    var p = product(d && d.product), lim = limits(p), lines;
    if (d && d.reason === 'opens') lines = ['Your personal page has been opened ' + (d.maxOpens || lim.maxOpens) + ' times, which is its limit.'];
    else if (d && d.reason === 'withdrawn') lines = ['This personal link is no longer active.'];
    else lines = ['Your personal page stays open for ' + ttlWords(lim.ttlHours) + ' from the first time you open it.'];
    lines.push('Everything you already have is still yours: the files you downloaded from Etsy stay with you, and every link you have already sent keeps working.');
    lines.push('Need more time? Message us on Etsy with your order number — we reply within 24 hours.');
    showMessage({ title: 'This link has expired', lines: lines, shop: true, again: p ? { text: 'I have a new order number', href: entryPath(p) + '?new=1' } : null });
  }
  function showUnknown(key) {
    var p = product(key);
    showMessage({ title: 'We can’t find this link', lines: [
      'Please check that the address is complete.',
      'Bought one of our cards or invitations? Open the link in your “01 START HERE” file and enter your Etsy order number.'
    ], shop: true, again: p && p.mode === 'hash' ? { text: 'Enter my order number', href: entryPath(p) + '?new=1' } : null });
  }
  function showLoading() {
    var main = shell('Opening your page…');
    el('p', 'wb-loading', 'Opening your page…', main);
  }
  function showRetry() {
    showMessage({ title: 'We couldn’t open your page', lines: ['Please check your internet connection and try again.', 'Still stuck? Message us on Etsy — we reply within 24 hours.'], retry: true, shop: true });
  }
  function showSetup() {
    showMessage({ title: 'This page isn’t ready yet', lines: ['Something on our side is not set up for this page. Please message us on Etsy and we will fix it — we reply within 24 hours.'], shop: true });
  }
  function showFramed() {
    var main = showMessage({ title: 'Open this page in its own tab', lines: ['For your safety, your personal page does not open inside another website.'] });
    var a = el('a', 'wb-btn wb-primary wb-wide', 'Open my page', main); a.href = location.href; a.target = '_top'; a.rel = 'noopener';
  }
  function showSlow() {
    showMessage({ title: 'Please try again a little later', lines: ['This page was opened many times from your internet connection in the last hour, so we paused it for a moment. Nothing is lost.', 'Still stuck? Message us on Etsy — we reply within 24 hours.'], retry: true, shop: true });
  }
  function showNotFound() {
    showMessage({ title: 'Page not found', lines: ['Got a card or an invitation link? Open it exactly as you received it — the full link.'], shop: true });
  }
  function mount(hash, d) {
    var p = product(d.product);
    if (!p) return showUnknown(null);
    if (p.mode !== 'hash') { location.replace(entryPath(p)); return; } // the product was switched to 'direct': its buyer address simply works
    store('wb.pl.' + d.product, hash);
    fetch(entryPath(p), { cache: 'no-cache', credentials: 'omit' }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.text();
    }).then(function (html) {
      var session = { product: d.product, hash: hash, expires: d.expires, opens: d.opens, maxOpens: d.maxOpens, firstOpen: d.firstOpen };
      var inject = '<base href="' + folderPath(p) + '"><script>window.__WB_SESSION=' + JSON.stringify(session).replace(/</g, '\\u003c') + ';<\/script>';
      if (!/<head[^>]*>/i.test(html)) throw new Error('no head');
      html = html.replace(/<head[^>]*>/i, function (h) { return h + inject; });
      window.__WB_SESSION = session;
      // The buyer's page replaces this one; the address stays /<hash>. <base> makes its relative paths point into the product folder.
      document.open(); document.write(html); document.close();
    }).catch(function () { showRetry(); });
  }
  PL.route = function () {
    var m = /^\/([A-Za-z0-9_-]{22})\/?$/.exec(location.pathname);
    if (!m) { onReady(showNotFound); return; }
    var hash = m[1];
    // Every opening is counted, so an opening must be a person looking at the page: not another website that loads
    // the address in a hidden frame, and not a browser that prepares the page in advance "just in case".
    if (framed()) { onReady(showFramed); return; }
    function go() {
      onReady(function () {
        showLoading();
        api('POST', '/api/open/' + hash).then(function (r) {
          if (r.status === 200 && r.body && r.body.ok) return mount(hash, r.body);
          if (r.status === 410) return showExpired(r.body);
          if (r.status === 404) return showUnknown(forget(hash));
          if (r.status === 429) return showSlow();
          showRetry();
        }, function () { showRetry(); });
      });
    }
    if (document.prerendering) document.addEventListener('prerenderingchange', go, { once: true }); else go();
  };

  /* ---------- buyer page (the permanent entry address) ---------- */
  PL.entry = function (opts) {
    var key = opts && opts.product, p = product(key);
    PL.page = { kind: 'entry', product: key };
    if (!p || (p.mode !== 'hash' && p.mode !== 'direct')) {
      // not in shared/config.js (or a mode we do not know): the page stays closed rather than open to everyone
      PL.state = 'error';
      document.documentElement.className += ' wb-gated';
      onReady(showSetup);
      return PL.state;
    }
    if (p.mode === 'direct') {
      PL.state = 'maker';
      PL.session = { mode: 'direct', product: key, base: folderUrl(p), sign: false };
      return PL.state;
    }
    var s = window.__WB_SESSION;
    if (s && s.product === key && HASH_RE.test(s.hash)) {
      PL.state = 'maker';
      PL.session = { mode: 'hash', product: key, hash: s.hash, expires: s.expires, opens: s.opens, maxOpens: s.maxOpens, base: folderUrl(p), sign: p.sign !== false };
      return PL.state;
    }
    PL.state = 'gate';
    document.documentElement.className += ' wb-gated';
    onReady(function () { renderGate(key, p); });
    return PL.state;
  };

  /* Runs the maker code only when the buyer may use the page (mode 'direct', or mode 'hash' opened through /<hash>). */
  PL.ready = function (fn) {
    onReady(function () {
      if (PL.state !== 'maker') return;
      if (PL.session.mode === 'hash') renderStatus();
      fn(PL.session);
    });
  };

  function renderStatus() {
    var s = PL.session, bar = el('div', 'wb-status');
    bar.setAttribute('role', 'status');
    el('span', 'wb-lock', '🔒', bar).setAttribute('aria-hidden', 'true');
    el('span', null, 'Your personal link works until ' + fmtWhen(s.expires) + ' · opened ' + s.opens + ' of ' + s.maxOpens, bar);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function b64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  /* digest = base64url(SHA-256(m)): only this fingerprint is sent for signing, never the words themselves. */
  function digestOf(m) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(m)).then(function (buf) { return b64url(new Uint8Array(buf)); });
  }

  /* The link the buyer sends. mode 'hash': signed by the service (only while the product link is valid). */
  PL.invitationLink = function (packed) {
    var s = PL.session || {};
    var url = (s.base || new URL('./', document.baseURI).href) + '#m=' + packed;
    if (s.mode !== 'hash' || s.sign === false) return Promise.resolve(url);
    if (!window.crypto || !crypto.subtle) { var e0 = new Error('crypto'); e0.code = 'browser'; return Promise.reject(e0); }
    return digestOf(packed).then(function (d) {
      // the same words give the same link: no second signature is asked for (each product link has a limited number)
      if (signed[d]) return url + '&s=' + signed[d];
      return api('POST', '/api/sign', { hash: s.hash, d: d }).then(function (r) {
        if (r.status === 200 && r.body && r.body.s) { signed[d] = r.body.s; return url + '&s=' + r.body.s; }
        var e = new Error('sign');
        e.code = r.status === 410 ? 'expired' : r.status === 429 ? (r.body && r.body.error === 'slow_down' ? 'slow' : r.body && r.body.unchecked ? 'unchecked' : 'limit') : 'failed';
        e.max = r.body && r.body.max;
        throw e;
      }, function () { var e = new Error('network'); e.code = 'network'; throw e; });
    });
  };
  var signed = {};
  PL.linkErrorText = function (err) {
    var c = err && err.code;
    if (c === 'expired') return 'Your personal link has expired, so a new link can’t be made. Links you already sent keep working. Need more time? Message us on Etsy.';
    if (c === 'browser') return 'This browser can’t make the link. Please open this page in Chrome or Safari.';
    if (c === 'network') return 'We couldn’t reach our service. Please check your internet connection and tap the button again.';
    if (c === 'limit') return 'Your personal page has made as many links as it can' + (err.max ? ' (' + err.max + ')' : '') + '. Links you already made keep working. Need more? Message us on Etsy.';
    if (c === 'slow') return 'That was a lot of links in a short time. Please wait a few minutes and tap the button again.';
    if (c === 'unchecked') return 'We are still confirming your order with Etsy, so this page can’t make another link just yet. Please try again in a few minutes.';
    return 'Something went wrong while making your link. Please tap the button again.';
  };

  /* ---------- the activation form (mode 'hash', page opened at its own address) ---------- */
  function renderGate(key, p) {
    if (framed()) { showFramed(); return; }
    var q = new URLSearchParams(location.search);
    var saved = store('wb.pl.' + key);
    if (saved && HASH_RE.test(saved) && q.get('new') !== '1') { location.replace('/' + saved); return; }

    var lim = limits(p);
    var gate = el('div', 'wb-gate'); gate.id = 'wb-gate';
    var main = el('main', 'wb-card', null, gate);
    el('p', 'wb-badge', p.name || 'Your purchase', main);
    el('h1', null, 'Open your page', main);
    el('p', 'wb-lead', 'Thank you for your order! Type your Etsy order number to open your personal page.', main);

    var form = el('form', 'wb-form', null, main); form.setAttribute('novalidate', '');
    var lab = el('label', null, 'Etsy order number', form); lab.setAttribute('for', 'wb-order');
    var inp = el('input', null, null, form);
    inp.id = 'wb-order'; inp.name = 'order'; inp.type = 'text'; inp.inputMode = 'numeric'; inp.autocomplete = 'off';
    inp.setAttribute('pattern', '[0-9#\\s]*'); inp.maxLength = 20; inp.placeholder = 'For example: 3712345678';
    var err = el('p', 'wb-err', null, form); err.hidden = true; err.setAttribute('role', 'alert');
    var btn = el('button', 'wb-btn wb-primary wb-wide', 'Open my page ➤', form); btn.type = 'submit';
    var other = el('div', 'wb-other', null, form); other.hidden = true;

    var det = el('details', 'wb-help', null, main);
    el('summary', null, 'Where do I find my order number?', det);
    var ul = el('ul', null, null, det);
    el('li', null, 'In the email Etsy sent you about this purchase — the number after “Order #”.', ul);
    el('li', null, 'On etsy.com: tap You → Purchases, find this order and open its receipt.', ul);

    var steps = el('ol', 'wb-steps', null, main);
    el('li', null, 'Type your order number above.', steps);
    el('li', null, 'Make your ' + (p.kind === 'card' ? 'card' : 'invitation') + ' with your own words.', steps);
    el('li', null, 'Send it, print it or save it.', steps);

    el('p', 'wb-small', 'Your personal page stays open for ' + ttlWords(lim.ttlHours) + ' from the first time you open it (up to ' + lim.maxOpens + ' openings). Your files are yours to keep, and every link you send keeps working after that.', main);
    el('p', 'wb-small', 'Stuck? Message us on Etsy — we reply within 24 hours.', main);
    var legal = el('p', 'wb-small wb-legal', null, main);
    legal.appendChild(document.createTextNode('By opening your page you agree to our short '));
    var ta = el('a', null, 'terms and privacy note', legal); ta.href = '/shared/terms.html'; ta.target = '_blank'; ta.rel = 'noopener';
    legal.appendChild(document.createTextNode('. ' + ETSY_NOTICE));

    document.body.insertBefore(gate, document.body.firstChild);
    try { inp.focus({ preventScroll: true }); } catch (e) {}

    function fail(text) { err.textContent = text; err.hidden = false; btn.disabled = false; btn.textContent = 'Open my page ➤'; }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var order = inp.value.replace(/[\s#.,-]/g, '');
      other.hidden = true; while (other.firstChild) other.removeChild(other.firstChild);
      if (!/^\d{7,14}$/.test(order)) { fail('That doesn’t look like an Etsy order number. It is a number about 10 digits long.'); inp.focus(); return; }
      err.hidden = true; btn.disabled = true; btn.textContent = 'Checking…';
      api('POST', '/api/activate', { order: order, product: key }).then(function (r) {
        var b = r.body || {};
        if (r.status === 200 && b.ok && b.links) {
          var mine = null;
          b.links.forEach(function (l) { if (HASH_RE.test(l.hash) && product(l.product)) { store('wb.pl.' + l.product, l.hash); if (l.product === key) mine = l; } });
          if (mine) { location.replace('/' + mine.hash); return; }
          var others = b.links.filter(function (l) { return HASH_RE.test(l.hash) && product(l.product); });
          if (others.length) {
            fail('This order number is for a different item:');
            others.forEach(function (l) {
              var a = el('a', 'wb-btn wb-ghost wb-wide', 'Open “' + (product(l.product).name || 'your item') + '”', other); a.href = '/' + l.hash;
            });
            other.hidden = false; return;
          }
          return fail('We can’t find that order number for this item. Please check the number and try again.');
        }
        if (r.status === 404) return fail('We can’t find that order number for this item. Please check the number and try again. (Just bought it? Wait a couple of minutes and try again.)');
        if (r.status === 409) return fail('Etsy is still processing your payment. Please try again in a few minutes.');
        if (r.status === 429) return fail('Too many tries. Please wait an hour and try again, or message us on Etsy.');
        if (r.status === 400) return fail('That doesn’t look like an Etsy order number. It is a number about 10 digits long.');
        fail('We couldn’t check your order just now. Please try again in a minute.');
      }, function () { fail('We couldn’t reach our service. Please check your internet connection and try again.'); });
    });
  }

  /* ---------- recipient page ---------- */
  PL.recipientPage = function (opts) { PL.page = { kind: 'recipient', product: opts && opts.product }; };

  /* The buyer's own page may show a not-yet-signed preview inside itself (same site, live session). */
  function previewAllowed(key) {
    function has(w) {
      try { return !!(w && w !== window && w.__WB_SESSION && w.__WB_SESSION.product === key && w.ProductLink && w.ProductLink.state === 'maker'); } catch (e) { return false; }
    }
    return has(window.parent) || has(window.opener);
  }
  function loadKeys() {
    var keys = (window.WB_KEYS || []).filter(function (k) { return typeof k === 'string' && k.length > 40; });
    if (keys.length) return Promise.resolve(keys);
    // No key in shared/keys.js yet (only before "embed-pubkey" has been run at the first release):
    // ask the service once and remember the answer for a day.
    var cached = null; try { cached = JSON.parse(store('wb.keys') || 'null'); } catch (e) {}
    var age = cached ? Date.now() - Number(cached.at) : -1;
    if (cached && cached.url === serviceUrl() && age >= 0 && age < 86400000 && Array.isArray(cached.keys) && cached.keys.length) return Promise.resolve(cached.keys);
    return api('GET', '/api/pubkey').then(function (r) {
      var ks = ((r.body && r.body.keys) || []).map(function (k) { return k.key; }).filter(Boolean);
      if (r.status !== 200 || !ks.length) throw new Error('no key');
      store('wb.keys', JSON.stringify({ at: Date.now(), url: serviceUrl(), keys: ks }));
      return ks;
    });
  }
  function verify(key, m, s) {
    if (!window.crypto || !crypto.subtle) return Promise.resolve('invalid');
    var sig;
    try { sig = b64urlBytes(s); } catch (e) { return Promise.resolve('invalid'); }
    if (sig.length !== 64) return Promise.resolve('invalid');
    return Promise.all([loadKeys(), digestOf(m)]).then(function (both) {
      var keys = both[0], data = new TextEncoder().encode('wb1|' + key + '|' + both[1]);
      var i = 0;
      function next() {
        if (i >= keys.length) return 'invalid';
        var raw; try { raw = b64urlBytes(keys[i++]); } catch (e) { return next(); }
        return crypto.subtle.importKey('raw', raw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
          .then(function (k) { return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, sig, data); })
          .then(function (ok) { return ok ? true : next(); }, function () { return next(); });
      }
      return next();
    }, function () { return 'network'; });
  }
  /* Resolves true (show it), 'invalid', 'network' or 'setup'. */
  PL.recipient = function (opts) {
    var key = (opts && opts.product) || (PL.page && PL.page.product), p = product(key);
    if (!p || (p.mode !== 'hash' && p.mode !== 'direct')) return Promise.resolve('setup'); // unknown product: closed, not open to everyone
    if (p.mode === 'direct' || p.sign === false) return Promise.resolve(true);
    if (previewAllowed(key)) return Promise.resolve(true);
    var f = parseFragment();
    if (!f.ok) return Promise.resolve('invalid');
    if (!f.m) return Promise.resolve(p.allowBare === true && !f.s ? true : 'invalid');
    if (!f.s) return Promise.resolve('invalid');
    return verify(key, f.m, f.s).then(function (ok) {
      if (ok === true) canonicalize(f);
      return ok;
    });
  };
  function showInvalid(kind) {
    if (kind === 'setup') { showSetup(); return; }
    if (kind === 'network') {
      showMessage({ title: 'Please try again', lines: ['We couldn’t finish opening this page. Check your internet connection and try again.'], retry: true });
      return;
    }
    showMessage({ title: 'This link isn’t complete', lines: [
      'A part of this link is missing or was changed, so we can’t open it.',
      'Please ask the person who sent it to send it again — the full link, exactly as they got it.'
    ], shop: 'single' });
  }
  /* Wraps the page's own boot(): it runs only for a link that may be shown. Use it for the first run and for hashchange. */
  PL.guard = function (boot) {
    return function () {
      var check;
      try { check = PL.recipient(); } catch (e) { check = Promise.resolve('invalid'); }
      check.then(function (ok) { if (ok === true) boot(); else showInvalid(ok); }, function () { showInvalid('invalid'); });
    };
  };

  PL.config = CFG;
  PL.serviceUrl = serviceUrl;
  PL.notice = ETSY_NOTICE;
  window.ProductLink = PL;
})();
