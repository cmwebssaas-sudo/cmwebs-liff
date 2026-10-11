import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const apiSource = readFileSync(new URL('../landlord-api.js', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../landlord-auth.js', import.meta.url), 'utf8');
const page = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
// Hashing runs on the platform crypto queue, so wait for the observable
// outcome instead of a fixed number of turns (CI machines are slower).
async function until(condition, label) {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for ' + label);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
const stored = storage => () => storage.getItem('cmwebs_landlord_read_cache_v1') !== null;

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  };
}

// Real landlord-api.js; only storage, crypto and the bridge transport are fake.
function apiFixture({ storage = memoryStorage(), token = 'session-a', respond } = {}) {
  const calls = [];
  const body = { children: [], appendChild(node) { this.children.push(node); } };
  const document = {
    body, head: body,
    getElementById: id => body.children.find(node => node.id === id) || null,
    createElement: () => ({ style: {}, setAttribute() {}, remove() { body.children.splice(body.children.indexOf(this), 1); } }),
    addEventListener() {}
  };
  const context = vm.createContext({
    TextEncoder, Uint8Array, JSON, Date, Number, Object, Array, String, Promise, Map, Math,
    setTimeout, clearTimeout, document, localStorage: storage, crypto: webcrypto,
    addEventListener() {}, requestAnimationFrame: fn => fn(),
    CMWebsLandlordAuth: {
      getRequestAuthParams: () => ({ response_mode: 'bridge', landlord_session_token: token }),
      request: (action, params) => {
        calls.push({ action, params });
        return Promise.resolve(respond ? respond(action, params) : { success: true, data: { action } });
      }
    }
  });
  context.window = context;
  vm.runInContext(apiSource, context);
  return { api: context.CMWebsLandlordApi, storage, calls, document };
}

test('a snapshot paints only for the same identity and is replaced by the fresh result', async () => {
  const storage = memoryStorage();
  const first = apiFixture({ storage });
  const fresh = Promise.resolve({ success: true, data: { tenants: ['A'] } });
  let painted = null;
  first.api.snapshot('landlord_tenants', {}, fresh, cached => { painted = cached; });
  await until(stored(storage), 'first store');
  assert.equal(painted, null, 'nothing cached on the first visit');
  assert.match(storage.getItem('cmwebs_landlord_read_cache_v1'), /tenants/);
  assert.doesNotMatch(storage.getItem('cmwebs_landlord_read_cache_v1'), /session-a/, 'the token itself is never stored');

  const second = apiFixture({ storage });
  let release;
  const slow = new Promise(resolve => { release = resolve; });
  second.api.snapshot('landlord_tenants', {}, slow, cached => { painted = cached; });
  await until(() => painted !== null, 'cached paint');
  assert.deepEqual(JSON.parse(JSON.stringify(painted)), { success: true, data: { tenants: ['A'] } });
  assert.match(second.document.getElementById('cmwebsSnapshotNotice').textContent, /的資料・更新中/);
  release({ success: true, data: { tenants: ['A', 'B'] } });
  await until(() => second.document.getElementById('cmwebsSnapshotNotice') === null, 'notice removal');
  assert.equal(second.document.getElementById('cmwebsSnapshotNotice'), null, 'the old-data notice goes away');

  let other = null;
  const third = apiFixture({ storage, token: 'session-b' });
  third.api.snapshot('landlord_tenants', {}, new Promise(() => {}), cached => { other = cached; });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(other, null, 'another account never sees the list');
});

test('authorization failures and successful writes drop every snapshot', async () => {
  const storage = memoryStorage();
  const fixture = apiFixture({ storage, respond: action => (
    action === 'landlord_room_update' ? { success: true } : { success: true, data: {} }
  ) });
  await fixture.api.snapshot('landlord_arrears', {}, Promise.resolve({ success: true, data: { bills: [] } }), null);
  await until(stored(storage), 'arrears store');
  await fixture.api.request({ action: 'landlord_room_update', params: {} });
  await tick();
  assert.equal(storage.getItem('cmwebs_landlord_read_cache_v1'), null, 'a write invalidates old lists');

  await fixture.api.snapshot('landlord_arrears', {}, Promise.resolve({ success: true, data: {} }), null);
  await until(stored(storage), 'second arrears store');
  const denied = Promise.reject(Object.assign(new Error('expired'), { code: 'SESSION_EXPIRED' }));
  fixture.api.snapshot('landlord_arrears', {}, denied, null);
  await denied.catch(() => {}); await tick();
  assert.equal(storage.getItem('cmwebs_landlord_read_cache_v1'), null, 'auth failure clears snapshots');

  await fixture.api.snapshot('landlord_billing_init', {}, Promise.resolve({ success: true, data: {} }), null);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(storage.getItem('cmwebs_landlord_read_cache_v1'), null, 'only approved list reads are stored');
});

test('prefetch fills a snapshot once and skips while it is younger than ten minutes', async () => {
  const fixture = apiFixture();
  await fixture.api.prefetch({ action: 'landlord_tenants', params: {} });
  await until(stored(fixture.storage), 'prefetch store');
  await fixture.api.prefetch({ action: 'landlord_tenants', params: {} });
  await fixture.api.prefetch({ action: 'landlord_billing_init', params: {} });
  assert.deepEqual(fixture.calls.map(call => call.action), ['landlord_tenants']);
});

test('logout clears the page snapshots as well as the homepage snapshot', () => {
  const local = memoryStorage();
  local.setItem('cmwebs_landlord_read_cache_v1', '{}');
  local.setItem('cmwebs_landlord_home_cache_v1', '{}');
  const session = memoryStorage();
  session.setItem('cmwebs_landlord_session_token', 'synthetic');
  const context = vm.createContext({ URL, URLSearchParams, Date, Math, setTimeout, clearTimeout,
    location: { href: 'https://example.invalid/', search: '', replace() {} } });
  context.window = Object.assign(context, { localStorage: local, sessionStorage: session, addEventListener() {} });
  context.document = { createElement: () => ({ appendChild() {}, setAttribute() {}, style: {} }), body: { appendChild() {} } };
  vm.runInContext(authSource, context);
  context.CMWebsLandlordAuth.logout().catch(() => {});
  assert.equal(local.getItem('cmwebs_landlord_read_cache_v1'), null);
  assert.equal(local.getItem('cmwebs_landlord_home_cache_v1'), null);
});

test('main inner pages paint snapshots and no longer block on the LINE SDK', () => {
  for (const [file, action] of [
    ['landlord-tenants.html', 'landlord_tenants'],
    ['landlord-rooms.html', 'landlord_room_center_init'],
    ['landlord-arrears.html', 'landlord_arrears'],
    ['landlord-properties.html', 'landlord_properties_init'],
    ['landlord-revenue-dashboard.html', 'landlord_revenue_dashboard_init']
  ]) {
    const source = page(file);
    assert.ok(source.includes(`CMWebsLandlordApi.snapshot('${action}'`), `${file} paints its last ${action}`);
    assert.doesNotMatch(source, /<script src="https:\/\/static\.line-scdn\.net\/liff/, `${file} must not block on the SDK`);
    assert.match(source, /CMWebsLandlordApi\.loadLiffSdk\(\)/, `${file} loads the SDK on demand`);
    assert.match(source, /<script src="landlord-api\.js\?v=/, `${file} loads the shared module`);
  }
  const home = page('landlord-home.html');
  assert.match(home, /function scheduleInnerPagePrefetch_\(/);
  assert.match(home, /landlord_arrears[\s\S]*?Email bridge|Email bridge[\s\S]*?landlord_arrears/, 'arrears is not prefetched for Email sessions');
});
