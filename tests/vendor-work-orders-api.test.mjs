import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createWorkOrderStore } from '../_dev/vendor-work-orders/store.mjs';
import { createVendorWorkOrderServer } from '../_dev/vendor-work-orders/server.mjs';
import { createSyntheticFixtures } from '../_dev/vendor-work-orders/fixtures.mjs';
import { projectDirectory } from '../_dev/vendor-work-orders/domain.mjs';

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
    '/fixtures.mjs', '/api/work-orders', '/.codex-local/vendor-work-orders/state.json', '/index.html']) {
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

async function authenticated(t, principal = 'landlord_a', server) {
  server ||= await running(t, { developmentMode: true });
  const result = await call(server, '/api/dev/session', { method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': `login-${principal}` }, body: { principal } });
  const cookie = result.headers['set-cookie'][0].split(';')[0];
  return { server, api: (path, method = 'GET', body, key = 'key') => call(server, path, {
    method, headers: { cookie, 'content-type': 'application/json', 'idempotency-key': key }, body }) };
}
const agreementInput = { partner_id: 'company-a', title: 'Cleaning', trade: 'cleaning', property_id: 'property-a',
  price_twd: 1600, starts_at: '2026-01-01T00:00:00Z', ends_at: '2027-01-01T00:00:00Z', active: true };

test('creates_company_and_individual_partner', async t => {
  const { server, api } = await authenticated(t);
  for (const type of ['company', 'individual']) {
    const r = await api('/api/partners', 'POST', { type, name: `  Test ${type}  `, trades: ['cleaning', 'other'],
      service_areas: ['north'], workspace_id: 'ws-b', role: 'admin', secret: 'hidden' }, type);
    assert.equal(r.status, 200);
    assert.equal(r.json.data.name, `Test ${type}`);
    assert.equal(r.json.data.workspace_id, 'ws-a');
    assert.equal('secret' in r.json.data, false);
  }
  assert.equal((await api('/api/partners')).json.data.length, 4);
  assert.equal((await server.store.readSnapshot()).work_order_events.length, 2);
});

test('partner_skills_allow_multiple_named_other_trades_and_private_fields_never_escape', async t => {
  const { server, api } = await authenticated(t);
  const skills = [{ trade: 'other', name: 'Painting' }, { trade: 'other', name: 'Pruning' }];
  const changed = await api('/api/partners/company-a', 'PATCH', { skills, service_areas: ['north', 'south'] });
  assert.equal(changed.status, 200);
  assert.deepEqual(changed.json.data.skills, skills);
  await server.store.transact(s => {
    s.partner_skills[0].private_note = 'hidden';
    s.partner_memberships[0].private_note = 'hidden';
    s.priority_rules.push({ workspace_id: 'ws-a', property_id: 'p', trade: 'other', partner_id: 'company-a', rank: 1, private_note: 'hidden' });
    return s;
  });
  for (const path of ['/api/partners', '/api/service-agreements', '/api/priority-rules']) {
    assert.equal(JSON.stringify((await api(path)).json.data).includes('hidden'), false);
  }
});
test('partner_list_is_workspace_scoped', async t => {
  const a = await authenticated(t);
  const b = await authenticated(t, 'landlord_b', a.server);
  assert.deepEqual((await b.api('/api/partners')).json.data.map(p => p.id), ['company-b']);
  await a.server.store.transact(s => { s.partners[0].bank = 'hidden'; s.workspace_partners[0].private_note = 'hidden'; return s; });
  const view = (await a.api('/api/partners')).json.data;
  assert.equal(view.length, 2);
  assert.equal(JSON.stringify(view).includes('hidden'), false);
  assert.equal((await b.api('/api/partners/company-a', 'PATCH', { name: 'Intruder' })).status, 404);
});
test('scopes_member_permissions_to_active_membership', async t => {
  const a = await authenticated(t);
  const worker = await authenticated(t, 'company_a_worker', a.server);
  assert.deepEqual((await worker.api('/api/partners')).json.data.map(p => p.id), ['company-a']);
  assert.equal((await worker.api('/api/partners', 'POST', { type: 'company', name: 'Forbidden', role: 'landlord' })).status, 403);
  assert.equal((await worker.api('/api/priority-rules')).status, 403);
  const added = await a.api('/api/partners/company-a/memberships', 'POST', { actor_id: 'synthetic-extra', member_role: 'worker', active: true });
  assert.equal(added.status, 200);
  assert.equal(added.json.data.actor_id, 'synthetic-extra');
  assert.equal((await a.server.store.readSnapshot()).partner_memberships.filter(m => m.partner_id === 'company-a').length, 3);
});
test('disabled_member_loses_access_but_events_remain', async t => {
  const a = await authenticated(t);
  const worker = await authenticated(t, 'company_a_worker', a.server);
  const r = await a.api('/api/partners/company-a/memberships/worker-a', 'PATCH', { active: false });
  assert.equal(r.status, 200);
  const before = await a.server.store.readSnapshot();
  assert.equal((await worker.api('/api/partners')).status, 403);
  assert.deepEqual((await a.server.store.readSnapshot()).work_order_events, before.work_order_events);
  assert.equal(before.partner_memberships.find(m => m.actor_id === 'worker-a').active, false);
  assert.equal(before.work_order_events.length, 1);
  assert.equal((await a.api('/api/partners/company-a', 'PATCH', { active: false }, 'disable')).status, 200);
  const manager = await authenticated(t, 'landlord_b', a.server);
  assert.equal((await manager.api('/api/partners')).json.data.length, 1);
});

test('accepted_non_alphanumeric_member_id_can_be_deactivated_without_losing_history', async t => {
  const { server, api } = await authenticated(t);
  const actor_id = 'worker@example.com';
  const actor = { actor_id, workspace_id: 'ws-a', partner_id: 'company-a', role: 'vendor' };
  const created = await api('/api/partners/company-a/memberships', 'POST', { actor_id, member_role: 'worker' }, 'create-email');
  assert.equal(created.status, 200);
  const before = await server.store.readSnapshot();
  assert.equal(projectDirectory(before, actor, 'partners')[0].id, 'company-a');
  const changed = await api(`/api/partners/company-a/memberships/${encodeURIComponent(actor_id)}`, 'PATCH', { active: false }, 'disable-email');
  assert.equal(changed.status, 200);
  const after = await server.store.readSnapshot();
  assert.throws(() => projectDirectory(after, actor, 'partners'), { code: 'FORBIDDEN' });
  assert.deepEqual(after.work_order_events.slice(0, before.work_order_events.length), before.work_order_events);
  assert.equal(after.work_order_events.length, before.work_order_events.length + 1);
  assert.equal(after.partner_memberships.find(m => m.actor_id === actor_id).active, false);
  const replay = await api('/api/partners/company-a/memberships/worker%40example.com', 'PATCH', { active: false }, 'disable-email');
  assert.deepEqual(replay.json.data, changed.json.data);
  assert.deepEqual(await server.store.readSnapshot(), after);
});

test('membership_ids_reject_encoded_route_traversal_and_malformed_segments', async t => {
  const { server, api } = await authenticated(t);
  const before = await server.store.readSnapshot();
  for (const actor_id of ['../worker', 'a/b', 'a\\b', '.', '..', 'worker%40example.com', 'a?b', 'a#b', 'a\u0000b', '\ud800']) {
    assert.equal((await api('/api/partners/company-a/memberships', 'POST', { actor_id, member_role: 'worker' }, actor_id.replace(/[^a-z]/g, '') || 'dots')).json.code, 'INVALID_MEMBER');
  }
  for (const segment of ['%2e%2e%2fworker-a', 'worker-a%2f..', 'worker-a%5c..', '%252e%252e', '%2e%2e', '%', '%ZZ', 'worker-a%3Ffoo', 'worker-a%23foo']) {
    const response = await api(`/api/partners/company-a/memberships/${segment}`, 'PATCH', { active: false }, 'invalid-segment');
    assert.equal(response.status, 400);
    assert.equal(response.json.code, 'INVALID_MEMBER');
  }
  assert.deepEqual(await server.store.readSnapshot(), before);
});
test('priority_rank_is_unique_per_trade_scope', async t => {
  const { api } = await authenticated(t);
  const body = { property_id: 'p1', trade: 'cleaning', rules: [{ partner_id: 'company-a', rank: 1 }, { partner_id: 'individual-a', rank: 2 }] };
  assert.equal((await api('/api/partners/company-a', 'PATCH', { trades: ['cleaning'] }, 'skills-a')).status, 200);
  assert.equal((await api('/api/partners/individual-a', 'PATCH', { trades: ['cleaning'] }, 'skills-i')).status, 200);
  assert.equal((await api('/api/priority-rules', 'PUT', body)).status, 200);
  assert.equal((await api('/api/priority-rules', 'PUT', { ...body, rules: body.rules.map(r => ({ ...r, rank: 1 })) }, 'duplicate')).json.code, 'PRIORITY_CONFLICT');
  assert.equal((await api('/api/priority-rules', 'PUT', { ...body, property_id: 'p2' }, 'other-property')).status, 200);
  assert.equal((await api('/api/priority-rules')).json.data.length, 4);
});
test('agreement_edit_does_not_change_existing_price_snapshot', async t => {
  const { server, api } = await authenticated(t);
  await api('/api/partners/company-a', 'PATCH', { trades: ['cleaning'] }, 'skills');
  const created = await api('/api/service-agreements', 'POST', agreementInput);
  assert.equal(created.status, 200);
  const first = created.json.data;
  await server.store.transact(s => { s.assignments.push({ id: 'historic', workspace_id: 'ws-a', agreement_snapshot: first }); return s; });
  const edited = await api('/api/service-agreements', 'POST', { ...agreementInput, agreement_id: first.agreement_id,
    expected_version: 1, price_twd: 2000 }, 'edit');
  assert.equal(edited.status, 200);
  assert.equal(edited.json.data.version, 2);
  const s = await server.store.readSnapshot();
  assert.equal(s.service_agreements.filter(a => a.agreement_id === first.agreement_id).length, 2);
  assert.equal(s.assignments[0].agreement_snapshot.price_twd, 1600);
  const worker = await authenticated(t, 'company_a_worker', server);
  assert.equal((await worker.api('/api/service-agreements')).json.data.every(a => a.partner_id === 'company-a'), true);
});
test('invalid_partner_or_priority_transaction_writes_nothing', async t => {
  const { server, api } = await authenticated(t);
  const before = await server.store.readSnapshot();
  for (const [path, method, body, code] of [
    ['/api/partners', 'POST', { type: 'company', name: '' }, 'INVALID_PARTNER'],
    ['/api/partners/company-a', 'PATCH', { trades: ['invalid'] }, 'INVALID_TRADE'],
    ['/api/priority-rules', 'PUT', { property_id: 'p', trade: 'cleaning', rules: [{ partner_id: 'foreign', rank: 1 }] }, 'INVALID_PARTNER'],
    ['/api/service-agreements', 'POST', { ...agreementInput, price_twd: -1 }, 'INVALID_AMOUNT'],
  ]) {
    assert.equal((await api(path, method, body, code)).json.code, code);
    assert.deepEqual(await server.store.readSnapshot(), before);
  }
});
test('directory_mutations_replay_normalized_body_and_reject_conflicts', async t => {
  const { server, api } = await authenticated(t);
  const first = await api('/api/partners', 'POST', { type: 'company', name: ' Example ' });
  assert.equal(first.status, 200);
  const before = await server.store.readSnapshot();
  const replay = await api('/api/partners', 'POST', { name: 'Example', type: 'company', workspace_id: 'ignored' });
  assert.deepEqual(replay.json.data, first.json.data);
  assert.deepEqual(await server.store.readSnapshot(), before);
  assert.equal((await api('/api/partners', 'POST', { type: 'company', name: 'Different' })).json.code, 'IDEMPOTENCY_CONFLICT');
  assert.deepEqual(await server.store.readSnapshot(), before);
  const pair = await Promise.all([api('/api/partners', 'POST', { type: 'individual', name: 'Concurrent' }, 'race'), api('/api/partners', 'POST', { type: 'individual', name: 'Concurrent' }, 'race')]);
  assert.deepEqual(pair[0].json.data, pair[1].json.data);
  const reopened = createWorkOrderStore({ filePath: join(await directory(t), 'other.json') });
  await reopened.transact(() => before);
  assert.equal((await reopened.readSnapshot()).idempotency_records.length, 1);
});

test('store_rejects_duplicate_directory_keys_and_rewriting_history', async t => {
  const { server, api } = await authenticated(t);
  await api('/api/partners', 'POST', { name: 'History', type: 'individual' });
  const before = await server.store.readSnapshot();
  for (const damage of [
    s => s.partner_memberships.push({ ...s.partner_memberships[0] }),
    s => s.workspace_partners.push({ ...s.workspace_partners[0] }),
    s => s.service_agreements.push({ ...s.service_agreements[0], id: 'duplicate-version', agreement_id: 'agreement-a' }),
    s => { s.service_agreements[0].price_twd = 9999; },
    s => { s.work_order_events[0].action = 'forged'; },
    s => s.priority_rules.push(...[1, 2].map(i => ({ workspace_id: 'ws-a', property_id: 'p', trade: 'cleaning', partner_id: `p${i}`, rank: 1 }))),
  ]) {
    await assert.rejects(server.store.transact(s => { damage(s); return s; }), { code: 'INVALID_SNAPSHOT' });
    assert.deepEqual(await server.store.readSnapshot(), before);
  }
});
test('every_directory_mutation_requires_key_and_rechecks_permission_on_replay', async t => {
  const a = await authenticated(t);
  const loggedIn = await call(a.server, '/api/dev/session', { method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'login-landlord_a' }, body: { principal: 'landlord_a' } });
  const cookie = loggedIn.headers['set-cookie'][0].split(';')[0];
  for (const [path, method, body] of [
    ['/api/partners', 'POST', { name: 'Test', type: 'company' }],
    ['/api/partners/company-a', 'PATCH', { active: false }],
    ['/api/partners/company-a/memberships', 'POST', { actor_id: 'extra', member_role: 'worker' }],
    ['/api/partners/company-a/memberships/worker-a', 'PATCH', { active: false }],
    ['/api/priority-rules', 'PUT', { property_id: 'p', trade: 'cleaning', rules: [] }],
    ['/api/service-agreements', 'POST', agreementInput],
  ]) {
    assert.equal((await call(a.server, path, { method, headers: { cookie, 'content-type': 'application/json' }, body })).json.code, 'IDEMPOTENCY_KEY_REQUIRED');
  }
  const input = { name: 'Original', type: 'company' };
  const created = await a.api('/api/partners', 'POST', input, 'original');
  await a.api(`/api/partners/${created.json.data.id}`, 'PATCH', { name: 'Changed' }, 'edit');
  assert.deepEqual((await a.api('/api/partners', 'POST', input, 'original')).json.data, created.json.data);
  await a.server.store.transact(s => { s.workspace_memberships[0].permissions = ['work_order_read']; return s; });
  const before = await a.server.store.readSnapshot();
  assert.equal((await a.api('/api/partners', 'POST', input, 'original')).status, 403);
  assert.deepEqual(await a.server.store.readSnapshot(), before);
});
test('agreement_rejects_unsupported_trade_stale_version_and_cross_workspace_edits', async t => {
  const a = await authenticated(t);
  assert.equal((await a.api('/api/service-agreements', 'POST', agreementInput)).json.code, 'INVALID_TRADE');
  await a.api('/api/partners/company-a', 'PATCH', { trades: ['cleaning'] }, 'skills');
  const created = await a.api('/api/service-agreements', 'POST', agreementInput);
  const id = created.json.data.agreement_id;
  const input = { ...agreementInput, agreement_id: id, expected_version: 1, active: false };
  assert.equal((await a.api('/api/service-agreements', 'POST', input, 'disable')).status, 200);
  assert.equal((await a.api('/api/service-agreements', 'POST', input, 'stale')).json.code, 'VERSION_CONFLICT');
  const b = await authenticated(t, 'landlord_b', a.server);
  assert.equal((await b.api('/api/service-agreements', 'POST', { ...input, partner_id: 'company-b' })).json.code, 'INVALID_TRADE');
  await b.api('/api/partners/company-b', 'PATCH', { trades: ['cleaning'] }, 'skills');
  assert.equal((await b.api('/api/service-agreements', 'POST', { ...input, partner_id: 'company-b' })).status, 404);
  assert.equal((await a.api('/api/service-agreements', 'POST', { ...agreementInput, ends_at: '2025-01-01T00:00:00Z' }, 'dates')).json.code, 'INVALID_AGREEMENT');
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
