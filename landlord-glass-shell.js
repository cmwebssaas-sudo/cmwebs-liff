/*
 * Entrance motion for the bright glass shell. Cards fade up in a short
 * stagger the first time real content appears (static cards at load, then
 * the first data render). Refreshes, filters and later re-renders do not
 * replay it. Without this script, or with reduced motion, cards simply
 * appear in place.
 */
(function (global) {
  'use strict';
  const doc = global.document;
  const reduceMotion = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const SELECTOR = '.card, .dashboard-card, .section-card, .dashboard-kpi, .property-card, .request-card, .desktop-table-wrap';
  const SKIP = '.home-skeleton-page, .loading, .loading-card, .loading-text, [hidden]';
  const STEP_S = 0.06;
  const MAX_STEPS = 8;
  const SETTLE_MS = 450;
  const GIVE_UP_MS = 15000;

  // Only the outermost matching elements in a batch move; nested cards ride
  // along with their parent.
  function outermost(nodes) {
    const found = [];
    nodes.forEach(function (node) {
      if (node.nodeType !== 1) return;
      const candidates = node.matches(SELECTOR) ? [node] : Array.prototype.slice.call(node.querySelectorAll(SELECTOR));
      candidates.forEach(function (el) {
        if (el.closest(SKIP) || el.closest('.glass-rise')) return;
        if (found.some(function (other) { return other.contains(el); })) return;
        found.push(el);
      });
    });
    return found;
  }

  function rise(elements) {
    elements.forEach(function (el, index) {
      el.style.setProperty('--rise-delay', (Math.min(index, MAX_STEPS) * STEP_S).toFixed(2) + 's');
      el.classList.add('glass-rise');
      el.addEventListener('animationend', function done(event) {
        if (event.target !== el) return;
        el.removeEventListener('animationend', done);
        el.classList.remove('glass-rise');
        el.style.removeProperty('--rise-delay');
      });
    });
    return elements.length;
  }

  function start() {
    const shell = doc.querySelector('.app-shell');
    if (!shell || reduceMotion.matches || !global.MutationObserver) return;
    rise(outermost([shell]));

    // Watch for the first data render, then stop shortly after it lands.
    let settleTimer = 0;
    const observer = new global.MutationObserver(function (records) {
      const added = [];
      records.forEach(function (record) { Array.prototype.push.apply(added, record.addedNodes); });
      if (rise(outermost(added)) && !settleTimer) settleTimer = global.setTimeout(stop, SETTLE_MS);
    });
    const giveUp = global.setTimeout(stop, GIVE_UP_MS);
    function stop() {
      observer.disconnect();
      global.clearTimeout(giveUp);
    }
    observer.observe(shell, { childList: true, subtree: true });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
