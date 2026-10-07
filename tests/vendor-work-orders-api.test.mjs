import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createWorkOrderStore } from '../_dev/vendor-work-orders/store.mjs';
import { createVendorWorkOrderServer } from '../_dev/vendor-work-orders/server.mjs';
import { createSyntheticFixtures } from '../_dev/vendor-work-orders/fixtures.mjs';

async function directory(t) {
  const dir = await mkdtemp(join(tmpdir(), 'vendor-api-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function running(t, options = {}) {
  const dir = await directory(t);
  const server = createVendorWorkOrderServer({ port: 0, dataFile: join(dir, 'state.json'), ...options });
  await server.start();
  t.after(() => server.close());
  return server;
}
function call(server, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, json: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
const login = (server, principal = 'landlord_a') => call(server, '/api/dev/session', {
  method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'session-key' }, body: { principal },
});

test('server_binds_to_loopback_only', async t => {
  for (const host of ['0.0.0.0', 'localhost', '::1', 'example.com']) {
    assert.throws(() => createVendorWorkOrderServer({ host }), { code: 'LOOPBACK_ONLY' });
  }
  const server = await running(t);
  assert.equal(server.address().address, '127.0.0.1');
});
test('dev_session_rejects_unknown_fixture', async t => {
  const server = await running(t, { developmentMode: true });
  const result = await login(server, 'real-landlord');
  assert.equal(result.status, 400);
  assert.equal(result.json.code, 'INVALID_PRINCIPAL');
  assert.equal(result.headers['set-cookie'], undefined);
});
test('api_rejects_missing_session', async t => {
  const server = await running(t);
  const result = await call(server, '/api/session');
  assert.equal(result.status, 401);
  assert.equal(result.json.code, 'SESSION_REQUIRED');
});
test('store_reopens_persisted_snapshot', async t => {
  const filePath = join(await directory(t), 'nested', 'state.json');
  const store = createWorkOrderStore({ filePath });
  await store.transact(() => createSyntheticFixtures().state);
  const reopened = createWorkOrderStore({ filePath });
  assert.deepEqual(await reopened.readSnapshot(), createSyntheticFixtures().state);
  const detached = await store.readSnapshot();
  detached.partners.length = 0;
  assert.equal((await store.readSnapshot()).partners.length, 3);
});
test('failed_transaction_preserves_previous_snapshot', async t => {
  const filePath = join(await directory(t), 'state.json');
  const store = createWorkOrderStore({ filePath });
  await store.transact(() => createSyntheticFixtures().state);
  const before = await readFile(filePath, 'utf8');
  await assert.rejects(store.transact(state => { state.partners.length = 0; throw Error('private path'); }));
  await assert.rejects(store.transact(state => { state.quotes = null; return state; }), { code: 'INVALID_SNAPSHOT' });
  assert.equal(await readFile(filePath, 'utf8'), before);
  assert.deepEqual(await store.readSnapshot(), createSyntheticFixtures().state);
});
test('serializes_writers_and_recovers_after_rejection', async t => {
  const store = createWorkOrderStore({ filePath: join(await directory(t), 'state.json') });
  const first = store.transact(async state => {
    await new Promise(resolve => setTimeout(resolve, 20));
    state.partners.push({ id: 'one', type: 'individual', name: 'Synthetic One', active: true });
    return state;
  });
  const second = store.transact(state => {
    state.partners.push({ id: 'two', type: 'company', name: 'Synthetic Two', active: true });
    return state;
  });
  await Promise.all([first, second]);
  assert.deepEqual((await store.readSnapshot()).partners.map(p => p.id), ['one', 'two']);
  await assert.rejects(store.transact(() => ({})));
  await store.transact(state => state);
});
test('failed_atomic_rename_preserves_memory_and_cleans_temp', async t => {
  const dir = await directory(t);
  const filePath = join(dir, 'state.json');
  const store = createWorkOrderStore({ filePath });
  const before = await store.readSnapshot();
  await mkdir(filePath);
  await assert.rejects(store.transact(() => createSyntheticFixtures().state));
  assert.deepEqual(await store.readSnapshot(), before);
  assert.deepEqual(await readdir(dir), ['state.json']);
});
test('validates_entire_snapshot_and_rejects_lossy_json', async t => {
  const store = createWorkOrderStore({ filePath: join(await directory(t), 'state.json') });
  for (const damage of [s => { s.partners.push(null); }, s => { s.quotes.push({ id: 'q', total_twd: NaN }); },
    s => { s.partners.push({ id: 'p', value: undefined }); }, s => { s.schema_version = 2; },
    s => { s.extra = []; }, s => { s.assignments.push({ id: 'a', approved_amount_twd: -1 }); },
    s => { s.quotes.push({ id: 'q', total_twd: '1500' }); }]) {
    await assert.rejects(store.transact(state => { damage(state); return state; }), { code: 'INVALID_SNAPSHOT' });
  }
});
test('fixture_session_is_explicit_cookie_scoped_and_expires', async t => {
  const disabled = await running(t);
  assert.equal((await login(disabled)).status, 404);
  let now = Date.parse('2026-10-08T00:00:00Z');
  const server = await running(t, { developmentMode: true, clock: () => now });
  const result = await login(server);
  assert.equal(result.status, 200);
  const setCookie = result.headers['set-cookie'][0];
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Max-Age=28800/);
  assert.match(setCookie, /Expires=Thu, 08 Oct 2026 08:00:00 GMT/);
  const cookie = setCookie.split(';')[0];
  const session = await call(server, '/api/session', { headers: { cookie } });
  assert.deepEqual(session.json.data.actor, createSyntheticFixtures().principals.landlord_a);
  now += 8 * 60 * 60 * 1000;
  assert.equal((await call(server, '/api/session', { headers: { cookie } })).status, 401);
});
test('rejects_nonloopback_host_origin_and_unlisted_paths_without_leaks', async t => {
  const server = await running(t, { developmentMode: true });
  for (const headers of [{ host: 'evil.example' }, { origin: 'https://evil.example' },
    { origin: 'null' }, { origin: 'http://127.0.0.1:1' }]) {
    assert.equal((await call(server, '/api/session', { headers })).status, 403);
  }
  for (const path of ['/../store.mjs', '/%2e%2e/store.mjs', '/public/../../README.md',
    '/fixtures.mjs', '/api/partners', '/api/work-orders', '/.codex-local/vendor-work-orders/state.json', '/index.html']) {
    const result = await call(server, path);
    assert.equal(result.status, 404);
    assert.equal(result.json.success, false);
    assert.equal(typeof result.json.request_id, 'string');
    assert.doesNotMatch(result.text, /\/Users\/|\/tmp\/|ENOENT|stack|filePath/);
  }
  const malformed = await call(server, '/api/dev/session', { method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'bad' }, body: { principal: {} } });
  assert.equal(malformed.status, 400);
  assert.doesNotMatch(malformed.text, /stack|TypeError/);
});
test('session_creation_requires_key_and_replays_without_new_cookie', async t => {
  const server = await running(t, { developmentMode: true });
  const missing = await call(server, '/api/dev/session', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: { principal: 'landlord_a' } });
  assert.equal(missing.json.code, 'IDEMPOTENCY_KEY_REQUIRED');
  const first = await login(server);
  const replay = await login(server);
  assert.equal(replay.headers['set-cookie'][0], first.headers['set-cookie'][0]);
  assert.equal((await login(server, 'landlord_b')).json.code, 'IDEMPOTENCY_CONFLICT');
});
test('session_read_rechecks_active_membership', async t => {
  const server = await running(t, { developmentMode: true });
  const loggedIn = await login(server);
  const cookie = loggedIn.headers['set-cookie'][0].split(';')[0];
  await server.store.transact(state => {
    state.workspace_memberships.find(row => row.actor_id === 'landlord-a').active = false;
    return state;
  });
  assert.equal((await call(server, '/api/session', { headers: { cookie } })).status, 403);
  assert.equal((await login(server)).status, 403);
});
