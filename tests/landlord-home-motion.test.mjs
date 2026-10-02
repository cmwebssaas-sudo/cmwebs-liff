import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const file = new URL('../landlord-home-motion.js', import.meta.url);
const source = existsSync(file) ? readFileSync(file, 'utf8') : '';

// Only the browser boundary is simulated; every transition runs the shipped controller.
function fixture(reduced = false) {
  class Element extends EventTarget {
    attributes = new Map();
    textContent = '';
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key); }
  }
  const media = Object.assign(new EventTarget(), { matches: reduced });
  const document = Object.assign(new EventTarget(), { hidden: false });
  const observers = [];
  const window = { matchMedia: () => media, IntersectionObserver: class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  } };
  vm.runInNewContext(source, { window, document });
  assert.equal(typeof window.CMWebsHomeMotion?.mount, 'function', 'homepage has a working motion controller');
  function host() {
    const root = new Element();
    const button = new Element();
    const status = new Element();
    root.querySelector = selector => selector === '[data-motion-toggle]' ? button : status;
    root.button = button;
    root.status = status;
    return root;
  }
  const root = host();
  window.CMWebsHomeMotion.mount(root);
  return { root, host, window, document, media, observers };
}

test('chart motion begins enabled and can be paused and resumed without changing chart contents', () => {
  const { root } = fixture();
  root.textContent = 'NT$ 3,500 | 95.0% | 30 天 2 份';
  assert.equal(root.getAttribute('data-motion'), 'running');
  root.button.dispatchEvent(new Event('click'));
  assert.equal(root.getAttribute('data-motion'), 'paused');
  assert.equal(root.button.getAttribute('aria-pressed'), 'true');
  root.button.dispatchEvent(new Event('click'));
  assert.equal(root.getAttribute('data-motion'), 'running');
  assert.equal(root.button.getAttribute('aria-pressed'), 'false');
  assert.equal(root.textContent, 'NT$ 3,500 | 95.0% | 30 天 2 份');
});

test('system reduced motion cannot be overridden by the animation button', () => {
  const { root, media } = fixture(true);
  assert.equal(root.getAttribute('data-motion'), 'reduced');
  assert.equal(root.button.disabled, true);
  root.button.dispatchEvent(new Event('click'));
  assert.equal(root.getAttribute('data-motion'), 'reduced');
  media.matches = false;
  media.dispatchEvent(new Event('change'));
  assert.equal(root.getAttribute('data-motion'), 'running');
  assert.equal(root.button.disabled, false);
});

test('a reduced-motion change immediately stops animation and preserves an earlier manual pause', () => {
  const { root, media } = fixture();
  root.button.dispatchEvent(new Event('click'));
  media.matches = true;
  media.dispatchEvent(new Event('change'));
  assert.equal(root.getAttribute('data-motion'), 'reduced');
  media.matches = false;
  media.dispatchEvent(new Event('change'));
  assert.equal(root.getAttribute('data-motion'), 'paused');
});

test('hidden tabs and offscreen charts suspend motion; returning does not cancel a manual pause', () => {
  const { root, document, observers } = fixture();
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(root.getAttribute('data-motion'), 'suspended');
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(root.getAttribute('data-motion'), 'running');
  observers[0].callback([{ isIntersecting: false }]);
  assert.equal(root.getAttribute('data-motion'), 'suspended');
  root.button.dispatchEvent(new Event('click'));
  observers[0].callback([{ isIntersecting: true }]);
  assert.equal(root.getAttribute('data-motion'), 'paused');
});

test('refresh retains the pause choice and disconnects old controls and observers', () => {
  const { root, host, window, observers } = fixture();
  root.button.dispatchEvent(new Event('click'));
  const next = host();
  window.CMWebsHomeMotion.mount(next);
  assert.equal(observers[0].disconnected, true);
  assert.equal(next.getAttribute('data-motion'), 'paused');
  root.button.dispatchEvent(new Event('click'));
  assert.equal(next.getAttribute('data-motion'), 'paused');
  next.button.dispatchEvent(new Event('click'));
  assert.equal(next.getAttribute('data-motion'), 'running');
});

test('error cleanup stops observing discarded charts', () => {
  const { window, observers, root, media } = fixture();
  window.CMWebsHomeMotion.unmount();
  assert.equal(observers[0].disconnected, true);
  media.matches = true;
  media.dispatchEvent(new Event('change'));
  assert.equal(root.getAttribute('data-motion'), 'running');
});

test('resuming after a manual pause keeps one-time entrances settled instead of restarting them', () => {
  const { root } = fixture();
  assert.equal(root.getAttribute('data-motion-entrance'), 'initial');
  root.button.dispatchEvent(new Event('click'));
  assert.equal(root.getAttribute('data-motion-entrance'), 'settled');
  root.button.dispatchEvent(new Event('click'));
  assert.equal(root.getAttribute('data-motion-entrance'), 'settled');
});

test('returning from reduced motion does not replay a previously static chart', () => {
  const { root, media } = fixture(true);
  assert.equal(root.getAttribute('data-motion-entrance'), 'settled');
  media.matches = false;
  media.dispatchEvent(new Event('change'));
  assert.equal(root.getAttribute('data-motion-entrance'), 'settled');
});

test('the real full-page error renderer disconnects the removed chart controller', () => {
  const { window, document, observers } = fixture();
  const html = readFileSync(new URL('../landlord-home.html', import.meta.url), 'utf8');
  const start = html.indexOf('function renderError(');
  const end = html.indexOf('function setRefreshLoading(', start);
  const app = { innerHTML: '' };
  document.getElementById = () => app;
  const context = { document, CMWebsHomeMotion: window.CMWebsHomeMotion, safeHtml: value => value };
  vm.runInNewContext(html.slice(start, end), context);
  context.renderError('fixture error');
  assert.equal(observers[0].disconnected, true);
  assert.match(app.innerHTML, /fixture error/);
});
