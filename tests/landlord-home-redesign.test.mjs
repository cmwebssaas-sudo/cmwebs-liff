import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const source = readFileSync(new URL('../landlord-home.html', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../landlord-auth.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../landlord-home.css', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.search(new RegExp('(async )?function ' + name + '\\('));
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  };
}

function cacheContext(localStorage, authParams = {}) {
  const context = vm.createContext({
    TEST_MODE: false, TextEncoder, Uint8Array, JSON, Date, Number, Object, Array, String,
    window: {
      localStorage,
      crypto: webcrypto,
      CMWebsLandlordAuth: { getRequestAuthParams: () => authParams }
    }
  });
  vm.runInContext([
    "const HOME_CACHE_STORAGE_KEY = 'cmwebs_landlord_home_cache_v1';",
    'const HOME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;',
    extractFunction('homeCacheStore_'),
    extractFunction('homeCacheIdentity_'),
    extractFunction('clearHomeCache_'),
    extractFunction('readHomeCache_'),
    extractFunction('writeHomeCache_')
  ].join('\n'), context);
  return context;
}

test('snapshot identity is a one-way hash that never stores the session token', async () => {
  const storage = memoryStorage();
  const email = cacheContext(storage, { landlord_session_token: 'secret-session-token' });
  const id = await email.homeCacheIdentity_();
  assert.match(id, /^[0-9a-f]{64}$/);
  email.writeHomeCache_(id, { home: { paid_total_amount: 10 } }, 1000);
  const stored = storage.getItem('cmwebs_landlord_home_cache_v1');
  assert.doesNotMatch(stored, /secret-session-token/);
  const line = cacheContext(storage, { line_user_id: 'U-synthetic' });
  assert.notEqual(await line.homeCacheIdentity_(), id, 'LINE and Email identities never share a snapshot');
  assert.equal(await cacheContext(storage, {}).homeCacheIdentity_(), '', 'no verified identity, no snapshot');
});

test('a snapshot is only returned to the same identity within 24 hours', () => {
  const storage = memoryStorage();
  const context = cacheContext(storage);
  context.writeHomeCache_('owner-a', { home: { paid_total_amount: 10 } }, 1000);
  context.writeHomeCache_('owner-a', { report: { months: [] } }, 5000);
  const entry = context.readHomeCache_('owner-a', 2000);
  assert.equal(entry.home.paid_total_amount, 10);
  assert.equal(entry.saved_at, 1000, 'report updates do not make old KPI figures look newer');
  assert.ok(entry.report);
  assert.equal(context.readHomeCache_('owner-b', 2000), null, 'another account never sees the figures');
  assert.equal(storage.getItem('cmwebs_landlord_home_cache_v1'), null, 'a mismatched entry is removed');

  context.writeHomeCache_('owner-a', { home: { paid_total_amount: 10 } }, 1000);
  assert.equal(context.readHomeCache_('owner-a', 1000 + 24 * 60 * 60 * 1000), null, 'expired after one day');
  context.writeHomeCache_('owner-a', { report: { months: [] } }, 1000);
  assert.equal(storage.getItem('cmwebs_landlord_home_cache_v1'), null, 'charts alone are never stored');
  storage.setItem('cmwebs_landlord_home_cache_v1', '{broken');
  assert.equal(context.readHomeCache_('owner-a', 1000), null);
  assert.equal(storage.getItem('cmwebs_landlord_home_cache_v1'), null, 'corrupt data is discarded');
});

test('storage that throws never breaks the homepage', () => {
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const context = cacheContext(throwing);
  assert.equal(context.readHomeCache_('owner-a', 1), null);
  assert.doesNotThrow(() => context.writeHomeCache_('owner-a', { home: {} }, 1));
  assert.doesNotThrow(() => context.clearHomeCache_());
});

test('shared auth clears the homepage snapshot on logout and authorization failure', async () => {
  for (const finish of ['logout', 'failure']) {
    const local = memoryStorage({ cmwebs_landlord_home_cache_v1: '{"v":1}' });
    const session = memoryStorage({ cmwebs_landlord_session_token: 'synthetic' });
    const context = vm.createContext({
      URL, URLSearchParams, Date, Math, setTimeout, clearTimeout,
      location: { href: 'https://example.invalid/landlord-home.html', search: '', replace() {} }
    });
    context.window = Object.assign(context, { localStorage: local, sessionStorage: session, addEventListener() {} });
    context.document = { createElement: () => ({ appendChild() {}, setAttribute() {}, style: {} }), body: { appendChild() {} } };
    vm.runInContext(auth, context);
    if (finish === 'logout') {
      context.CMWebsLandlordAuth.logout().catch(() => {});
    } else {
      context.CMWebsLandlordAuth.handleAuthFailure({ success: false, code: 'SESSION_EXPIRED', message: 'expired' });
    }
    assert.equal(local.getItem('cmwebs_landlord_home_cache_v1'), null, `${finish} removes the snapshot`);
  }
});

test('income curve geometry and growth labels follow the collected months', () => {
  const context = vm.createContext({ Math, Number, String, Array });
  vm.runInContext([
    extractFunction('dashboardNumber_'),
    extractFunction('dashboardTrendGeometry_'),
    extractFunction('dashboardTrendDelta_')
  ].join('\n'), context);
  const rows = [
    { month: '2026-08', collected: 100 },
    { month: '2026-09', collected: 150 },
    { month: '2026-10', collected: 120 }
  ];
  const geometry = context.dashboardTrendGeometry_(rows);
  assert.equal(geometry.points.length, 3);
  assert.equal(geometry.points[0].x, geometry.padX, 'the first month is not clipped at the edge');
  assert.equal(geometry.points[2].x, geometry.width - geometry.padX);
  assert.ok(geometry.points[1].y < geometry.points[2].y && geometry.points[2].y < geometry.points[0].y,
    'higher income is drawn higher');
  assert.ok(geometry.points.every(point => point.y >= 0 && point.y <= geometry.baseline));
  assert.match(geometry.line, /^M[\d. ]+( C[\d. ]+){2}$/);
  assert.match(geometry.area, / Z$/);
  assert.equal(context.dashboardTrendGeometry_([]).line, '');

  assert.deepEqual({ ...context.dashboardTrendDelta_(100, 120) }, { direction: 'up', text: '+20.0%' });
  assert.deepEqual({ ...context.dashboardTrendDelta_(200, 150) }, { direction: 'down', text: '−25.0%' });
  assert.deepEqual({ ...context.dashboardTrendDelta_(0, 10) }, { direction: 'flat', text: '新增收入' });
  assert.deepEqual({ ...context.dashboardTrendDelta_(0, 0) }, { direction: 'flat', text: '—' });
});

test('hero keeps accessible values and reduced motion stops every new animation', () => {
  for (const marker of [
    'aria-label="收款率 ${paidRate.toFixed(1)}%"',
    'aria-label="已收 ${dashboardMoney_(paidTotal)}"',
    'id="homeLiveStatus"',
    'home-hero-enter',
    'data-trend-chart tabindex="0"',
    "goPage('landlord-settings.html')"
  ]) {
    assert.ok(source.includes(marker), `missing homepage marker: ${marker}`);
  }
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .home-hero-enter'));
  for (const selector of ['.home-hero-enter .home-ring svg', '.home-roll .av-number-track', '.home-skeleton']) {
    assert.ok(reduced.includes(selector), `${selector} must stop under reduced motion`);
  }
  assert.match(css, /@keyframes home-ring-spin \{ from \{ transform: rotate\(270deg\); \} to \{ transform: rotate\(-90deg\); \} \}/,
    'the ring turns once counter-clockwise into place');
});
