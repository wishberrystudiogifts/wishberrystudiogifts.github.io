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
