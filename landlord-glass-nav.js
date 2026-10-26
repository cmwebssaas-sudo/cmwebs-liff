/*
 * iOS-style liquid glass bottom navigation for landlord pages (phones only).
 * At rest a soft pill sits behind the current tab. Pressing lifts the pill
 * into a clear lens slightly larger than the tab; it follows the finger,
 * stretches sideways while it travels, then settles on the chosen tab. The
 * bar itself never grows. Keyboard and reduced-motion users keep the plain
 * button click.
 */
(function (global) {
  'use strict';
  const doc = global.document;
  const reduceMotion = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const PRESS_SCALE = [1.12, 1.22];
  const NAVIGATE_DELAY_MS = 220;

  function enhance(nav) {
    const inner = nav.querySelector('.bottom-nav-inner');
    if (!inner || inner.querySelector('.glass-pill')) return;
    const items = Array.prototype.slice.call(inner.querySelectorAll('.nav-item'));
    if (!items.length) return;

    const pill = doc.createElement('span');
    pill.className = 'glass-pill';
    pill.setAttribute('aria-hidden', 'true');
    inner.insertBefore(pill, inner.firstChild);
    nav.classList.add('glass-ready');

    let current = items.findIndex(function (item) { return item.classList.contains('active'); });
    if (current >= 0) nav.classList.add('has-active');
    let x = 0;
    let gesture = null;
    let suppressUntil = 0;

    function cell(index) {
      const box = inner.getBoundingClientRect(), rect = items[index].getBoundingClientRect();
      return { left: rect.left - box.left, width: rect.width };
    }
    function restingX(index) { return cell(index).left + 4; }
    function bounds() { return [restingX(0), restingX(items.length - 1)]; }
    function followX(clientX) {
      const range = bounds(), width = cell(0).width - 8;
      const wanted = clientX - inner.getBoundingClientRect().left - width / 2;
      return Math.max(range[0], Math.min(range[1], wanted));
    }
    function indexAt(clientX) {
      let best = 0, distance = Infinity;
      items.forEach(function (item, index) {
        const rect = item.getBoundingClientRect(), d = Math.abs(clientX - (rect.left + rect.width / 2));
        if (d < distance) { best = index; distance = d; }
      });
      return best;
    }
    function magnify(index) {
      items.forEach(function (item, i) { item.classList.toggle('is-under-lens', i === index); });
    }
    function setPill(nextX, scaleX, scaleY) {
      x = nextX;
      if (pill.getAnimations) pill.getAnimations().forEach(function (animation) { animation.cancel(); });
      pill.style.transform = 'translateX(' + nextX + 'px) scale(' + (scaleX || 1) + ',' + (scaleY || 1) + ')';
    }
    function layout() {
      pill.style.width = Math.max(0, cell(0).width - 8) + 'px';
      setPill(restingX(current >= 0 ? current : 0));
    }
    // Travel to the chosen tab, stretching sideways mid-way like the iOS tab bar.
    function travel(to) {
      const from = x, distance = Math.abs(to - from), stretch = 1 + Math.min(distance / 160, 0.4);
      x = to;
      pill.style.transform = 'translateX(' + to + 'px) scale(1,1)';
      if (!pill.animate) return Promise.resolve();
      return pill.animate([
        { transform: 'translateX(' + from + 'px) scale(' + PRESS_SCALE[0] + ',' + PRESS_SCALE[1] + ')' },
        { transform: 'translateX(' + (from + (to - from) * 0.6) + 'px) scale(' + (PRESS_SCALE[0] * stretch) + ',' + (PRESS_SCALE[1] / stretch) + ')', offset: 0.45 },
        { transform: 'translateX(' + to + 'px) scale(' + PRESS_SCALE[0] + ',' + PRESS_SCALE[1] + ')', offset: 0.75 },
        { transform: 'translateX(' + to + 'px) scale(1,1)' }
      ], { duration: 380, easing: 'cubic-bezier(.25, 1, .4, 1)' }).finished.catch(function () {});
    }
    function release() {
      gesture = null;
      magnify(-1);
      nav.classList.remove('is-lensing');
    }

    inner.addEventListener('pointerdown', function (event) {
      if (reduceMotion.matches || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      gesture = { id: event.pointerId, startX: event.clientX, dragging: false };
      suppressUntil = Infinity;
      if (inner.setPointerCapture) inner.setPointerCapture(event.pointerId);
      setPill(current >= 0 ? restingX(current) : followX(event.clientX), PRESS_SCALE[0], PRESS_SCALE[1]);
      nav.classList.add('is-lensing');
      const target = followX(event.clientX);
      global.requestAnimationFrame(function () {
        if (!gesture) return;
        if (Math.abs(target - x) > 1) travel(target).then(function () { if (gesture) setPill(target, PRESS_SCALE[0], PRESS_SCALE[1]); });
        magnify(indexAt(event.clientX));
      });
    });
    inner.addEventListener('pointermove', function (event) {
      if (!gesture || event.pointerId !== gesture.id) return;
      if (!gesture.dragging && Math.abs(event.clientX - gesture.startX) < 6) return;
      gesture.dragging = true;
      const next = followX(event.clientX), speed = Math.min(Math.abs(next - x) / 40, 0.2);
      setPill(next, PRESS_SCALE[0] + speed, PRESS_SCALE[1] - speed / 2);
      magnify(indexAt(event.clientX));
    });
    inner.addEventListener('pointerup', function (event) {
      if (!gesture || event.pointerId !== gesture.id) return;
      const index = indexAt(event.clientX), item = items[index];
      gesture = null;
      // The native click that follows this pointerup is suppressed below.
      suppressUntil = Date.now() + 400;
      const settled = travel(restingX(index));
      magnify(index);
      if (index !== current) {
        global.setTimeout(function () { item.click(); }, NAVIGATE_DELAY_MS);
      }
      settled.then(function () {
        release();
        if (index !== current) {
          if (current >= 0) items[current].classList.remove('active');
          item.classList.add('active');
          current = index;
          nav.classList.add('has-active');
        }
      });
    });
    inner.addEventListener('pointercancel', function () {
      suppressUntil = 0;
      release();
      layout();
    });
    // Pointer gestures navigate themselves; keyboard clicks (detail 0) and our
    // own programmatic click pass through unchanged.
    inner.addEventListener('click', function (event) {
      if (event.detail > 0 && Date.now() < suppressUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    global.addEventListener('resize', layout);
    layout();
  }

  function start() {
    Array.prototype.forEach.call(doc.querySelectorAll('.bottom-nav'), enhance);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
  global.CMWebsGlassNav = { enhance: enhance };
})(window);
