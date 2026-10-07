import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile, mkdir, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createVendorWorkOrderServer } from '../_dev/vendor-work-orders/server.mjs';
const max = 10 * 1024 * 1024;
const samples = [
  ['image/jpeg', Buffer.from('ffd8ffe000104a4649460001', 'hex')],
  ['image/png', Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')],
  ['image/webp', Buffer.from('524946460c000000574542505650382000000000', 'hex')],
  ['application/pdf', Buffer.from('%PDF-1.7\n%%EOF')],
];
function raw(server, path, { method = 'GET', headers = {}, bytes } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { const bytes = Buffer.concat(chunks); resolve({ status: res.statusCode, headers: res.headers, bytes,
        json: res.headers['content-type']?.startsWith('application/json') ? JSON.parse(bytes) : null }); });
    });
    req.on('error', reject); req.end(bytes);
  });
}
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'wo-attachments-'));
  const attachmentDir = join(dir, 'private');
  const dataFile = join(dir, 'state.json');
  const server = createVendorWorkOrderServer({ dataFile, attachmentDir, developmentMode: true, clock: () => Date.parse('2026-10-08T04:00:00Z') });
  await server.start();
  t.after(async () => { await server.close(); await rm(dir, { recursive: true, force: true }); });
  async function cookie(principal) {
    const r = await raw(server, '/api/dev/session', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': principal }, bytes: Buffer.from(JSON.stringify({ principal })) });
    assert.equal(r.status, 200); return r.headers['set-cookie'][0].split(';')[0];
  }
  const owner = await cookie('landlord_a');
  const vendor = await cookie('company_a_worker');
  await server.store.transact(s => {
    s.work_orders.push({ id: 'wo', workspace_id: 'ws-a', title: 'Synthetic work', trade: 'cleaning', area: 'Test', location: '', instructions: '', status: 'in_progress', version: 1, created_at: '2026-10-08T04:00:00Z', updated_at: '2026-10-08T04:00:00Z' });
    s.assignments.push({ id: 'as', workspace_id: 'ws-a', work_order_id: 'wo', partner_id: 'company-a', status: 'in_progress', approved_amount_twd: 1500 });
    return s;
  });
  async function upload(type = samples[1][0], bytes = samples[1][1], overrides = {}) {
    const version = (await server.store.readSnapshot()).work_orders[0].version;
    return raw(server, '/api/work-orders/wo/attachments', { method: 'POST', headers: { cookie: vendor, 'content-type': type,
      'x-work-order-version': String(version), 'idempotency-key': randomUUID(), ...overrides }, bytes });
  }
  return { server, dir, dataFile, attachmentDir, cookie, owner, vendor, upload };
}
test('accepts_only_jpeg_png_webp_or_pdf_within_10_mib', async t => {
  const f = await fixture(t);
  for (const [type, bytes] of samples) {
    const r = await f.upload(type, bytes); assert.equal(r.status, 200);
    assert.match(r.json.data.id, /^[0-9a-f-]{36}$/);
    const download = await raw(f.server, `/api/attachments/${r.json.data.id}`, { headers: { cookie: f.owner } });
    assert.equal(download.status, 200); assert.deepEqual(download.bytes, bytes);
    assert.equal(download.headers['content-type'], type);
    assert.equal(download.headers['cache-control'], 'no-store');
    assert.equal(download.headers['x-content-type-options'], 'nosniff');
    assert.match(download.headers['content-disposition'], /^attachment; filename="[0-9a-f-]+\.(jpg|png|webp|pdf)"$/);
  }
  const boundary = Buffer.alloc(max); samples[1][1].copy(boundary);
  assert.equal((await f.upload('image/png', boundary)).status, 200);
  assert.equal((await f.upload('image/png', Buffer.concat([boundary, Buffer.from([0])]))).status, 413);
  assert.equal((await f.upload('image/png', Buffer.concat([boundary, Buffer.from([0])]), { 'transfer-encoding': 'chunked' })).status, 413);
  assert.equal((await f.upload('text/html', Buffer.from('<html>'))).status, 400);
  assert.equal((await f.upload('image/png', Buffer.alloc(0))).status, 400);
  const state = await f.server.store.readSnapshot();
  assert.equal(state.private_attachments.length, 5);
  assert.equal(state.work_order_events.filter(e => e.action === 'attachment-upload').length, 5);
  assert.equal(state.work_order_events.filter(e => e.action === 'attachment-download').length, 4);
  assert.equal((await readdir(f.attachmentDir)).length, 5);
  assert.equal(JSON.stringify(state.private_attachments).includes(f.dir), false);
  assert.equal((await raw(f.server, `/attachments/${state.private_attachments[0].id}`)).status, 404);
});
test('rejects_content_type_signature_mismatch', async t => {
  const f = await fixture(t); const before = await f.server.store.readSnapshot();
  for (const [type] of samples) assert.equal((await f.upload(type, Buffer.from('MZ executable'))).json.code, 'INVALID_ATTACHMENT');
  assert.equal((await f.upload('image/png', samples[0][1])).json.code, 'INVALID_ATTACHMENT');
  for (const [type, bytes] of samples.slice(1)) {
    const disguised = Buffer.from(bytes);
    // ASCII decoding must not discard high bits and turn invalid magic into valid magic.
    disguised[type === 'image/png' ? 12 : 0] |= 0x80;
    assert.equal((await f.upload(type, disguised)).json.code, 'INVALID_ATTACHMENT');
  }
  assert.deepEqual(await f.server.store.readSnapshot(), before);
});
test('rejects_path_traversal', async t => {
  const f = await fixture(t);
  for (const name of ['../state.json', 'a/b.png', 'a\\b.png', '%2e%2e%2fsecret', '.', '..']) {
    assert.equal((await f.upload(undefined, undefined, { 'x-file-name': name })).json.code, 'INVALID_ATTACHMENT');
  }
  for (const path of ['/api/attachments/../state.json', '/api/attachments/%2e%2e%2fstate.json', '/api/attachments/%252e%252e', '/api/attachments/a\\b']) {
    assert.equal((await raw(f.server, path, { headers: { cookie: f.owner } })).status, 404);
  }
  assert.equal((await f.server.store.readSnapshot()).private_attachments.length, 0);
});
test('rejects_cross_workspace_attachment_access', async t => {
  const f = await fixture(t); const uploaded = await f.upload(); assert.equal(uploaded.status, 200);
  const before = await f.server.store.readSnapshot();
  for (const principal of ['landlord_b', 'company_b_worker']) {
    const cookie = await f.cookie(principal);
    assert.equal((await raw(f.server, `/api/attachments/${uploaded.json.data.id}`, { headers: { cookie } })).status, 404);
    assert.equal((await f.upload(undefined, undefined, { cookie })).status, 404);
  }
  assert.deepEqual(await f.server.store.readSnapshot(), before);
});
test('rejects_vendor_without_assignment', async t => {
  const f = await fixture(t); const uploaded = await f.upload(); assert.equal(uploaded.status, 200);
  const cookie = await f.cookie('individual_worker');
  await f.server.store.transact(s => { s.invitations.push({ id: 'inv', workspace_id: 'ws-a', work_order_id: 'wo', partner_id: 'individual-a', status: 'sent' }); return s; });
  const before = await f.server.store.readSnapshot();
  assert.equal((await f.upload(undefined, undefined, { cookie })).status, 403);
  assert.equal((await raw(f.server, `/api/attachments/${uploaded.json.data.id}`, { headers: { cookie } })).status, 403);
  assert.deepEqual(await f.server.store.readSnapshot(), before);
});
test('attachment_replay_revocation_and_failed_commit_leave_no_orphans', async t => {
  const f = await fixture(t);
  const headers = { 'idempotency-key': 'once', 'x-work-order-version': '1' };
  const first = await f.upload(undefined, undefined, headers); assert.equal(first.status, 200);
  assert.deepEqual((await f.upload(undefined, undefined, headers)).json.data, first.json.data);
  assert.equal((await f.upload('application/pdf', samples[3][1], headers)).json.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal((await f.upload(undefined, undefined, { 'x-work-order-version': '1' })).json.code, 'VERSION_CONFLICT');
  // Real filesystem commit failure: the snapshot target cannot be replaced by rename.
  await rm(f.dataFile); await mkdir(f.dataFile);
  const beforeFailure = await f.server.store.readSnapshot();
  assert.equal((await f.upload()).status, 500);
  assert.deepEqual(await f.server.store.readSnapshot(), beforeFailure);
  assert.equal((await readdir(f.attachmentDir)).length, 1);
  assert.equal((await raw(f.server, `/api/attachments/${first.json.data.id}`, { headers: { cookie: f.owner } })).status, 500);
  assert.deepEqual(await f.server.store.readSnapshot(), beforeFailure);
  await rm(f.dataFile, { recursive: true });
  await f.server.store.transact(s => { s.partner_memberships.find(m => m.actor_id === 'worker-a').active = false; return s; });
  assert.equal((await f.upload(undefined, undefined, headers)).status, 403);
  assert.equal((await raw(f.server, `/api/attachments/${first.json.data.id}`, { headers: { cookie: f.vendor } })).status, 403);
});
test('startup_removes_only_unreferenced_private_blob_ids_and_rejects_symlink_blobs', async t => {
  const f = await fixture(t); const uploaded = await f.upload(); assert.equal(uploaded.status, 200);
  await f.server.close();
  const orphan = randomUUID(); await writeFile(join(f.attachmentDir, orphan), 'orphan');
  await writeFile(join(f.attachmentDir, 'operator-note'), 'preserve');
  await f.server.start();
  f.owner = await f.cookie('landlord_a');
  assert.deepEqual((await readdir(f.attachmentDir)).sort(), [uploaded.json.data.id, 'operator-note'].sort());
  const file = join(f.attachmentDir, uploaded.json.data.id);
  await rm(file); await symlink(f.dataFile, file);
  const r = await raw(f.server, `/api/attachments/${uploaded.json.data.id}`, { headers: { cookie: f.owner } });
  assert.equal(r.status, 500);
  assert.equal(r.bytes.includes(Buffer.from('workspace_memberships')), false);
  assert.equal((await readFile(f.dataFile, 'utf8')).includes('attachment-download'), false);
});

test('attachment_permissions_sessions_membership_and_replays_are_checked_every_time', async t => {
  const f = await fixture(t);
  const uploaded = await f.upload(); assert.equal(uploaded.status, 200);
  const path = `/api/attachments/${uploaded.json.data.id}`;
  assert.equal((await stat(f.attachmentDir)).mode & 0o777, 0o700);
  assert.equal((await stat(join(f.attachmentDir, uploaded.json.data.id))).mode & 0o777, 0o600);
  assert.equal((await raw(f.server, path)).status, 401);
  assert.equal((await f.upload(undefined, undefined, { cookie: '' })).status, 401);
  const first = await raw(f.server, path, { headers: { cookie: f.vendor } });
  assert.equal(first.status, 200);
  assert.equal((await raw(f.server, path, { headers: { cookie: f.vendor } })).status, 200);
  let state = await f.server.store.readSnapshot();
  const reads = state.work_order_events.filter(e => e.action === 'attachment-download');
  assert.equal(reads.length, 2); assert.notEqual(reads[0].id, reads[1].id);
  assert.equal(reads[0].attachment_id, uploaded.json.data.id);
  await f.server.store.transact(s => { s.workspace_memberships.find(m => m.actor_id === 'landlord-a').permissions = ['work_order_dispatch']; return s; });
  state = await f.server.store.readSnapshot();
  assert.equal((await raw(f.server, path, { headers: { cookie: f.owner } })).status, 403);
  assert.equal((await f.upload(undefined, undefined, { cookie: f.owner })).status, 403);
  assert.deepEqual(await f.server.store.readSnapshot(), state);
  await f.server.store.transact(s => { s.workspace_partners.find(m => m.partner_id === 'company-a' && m.workspace_id === 'ws-a').active = false; return s; });
  state = await f.server.store.readSnapshot();
  assert.equal((await raw(f.server, path, { headers: { cookie: f.vendor } })).status, 403);
  assert.equal((await f.upload()).status, 403);
  assert.deepEqual(await f.server.store.readSnapshot(), state);
});

test('download_rejects_tampered_blob_before_audit_and_bytes', async t => {
  const f = await fixture(t);
  const uploaded = await f.upload(); assert.equal(uploaded.status, 200);
  const before = await f.server.store.readSnapshot();
  await writeFile(join(f.attachmentDir, uploaded.json.data.id), Buffer.alloc(samples[1][1].length, 65));
  const r = await raw(f.server, `/api/attachments/${uploaded.json.data.id}`, { headers: { cookie: f.owner } });
  assert.equal(r.status, 500);
  assert.deepEqual(await f.server.store.readSnapshot(), before);
});

test('completion_with_attachment_and_acceptance_commit_history_and_inbox_together', async t => {
  const f = await fixture(t);
  const uploaded = await f.upload(); assert.equal(uploaded.status, 200);
  const input = { expected_version: 2, description: 'Finished with synthetic evidence', actual_amount_twd: 1500, attachment_ids: [uploaded.json.data.id] };
  const complete = () => raw(f.server, '/api/assignments/as/completion', { method: 'POST',
    headers: { cookie: f.vendor, 'content-type': 'application/json', 'idempotency-key': 'complete' }, bytes: Buffer.from(JSON.stringify(input)) });
  const before = await f.server.store.readSnapshot();
  await rm(f.dataFile); await mkdir(f.dataFile);
  assert.equal((await complete()).status, 500);
  assert.deepEqual(await f.server.store.readSnapshot(), before);
  await rm(f.dataFile, { recursive: true });
  const completed = await complete(); assert.equal(completed.status, 200);
  assert.equal(completed.json.data.status, 'awaiting_acceptance');
  assert.deepEqual(completed.json.data.completion_reports[0].attachment_ids, [uploaded.json.data.id]);
  const saved = await f.server.store.readSnapshot();
  assert.deepEqual((await complete()).json.data, completed.json.data);
  assert.deepEqual(await f.server.store.readSnapshot(), saved);
  assert.equal(saved.notification_outbox.length, 1);
  assert.equal(saved.notification_outbox[0].event_id, saved.work_order_events.at(-1).id);
  const accepted = await raw(f.server, '/api/work-orders/wo/acceptance', { method: 'POST', headers: {
    cookie: f.owner, 'content-type': 'application/json', 'idempotency-key': 'accept' }, bytes: Buffer.from(JSON.stringify({ expected_version: 3, decision: 'accept' })) });
  assert.equal(accepted.status, 200); assert.equal(accepted.json.data.status, 'completed');
  assert.deepEqual((await f.upload(undefined, undefined, { 'idempotency-key': 'historical-upload', 'x-work-order-version': '1' })).json.code, 'INVALID_TRANSITION');
  assert.equal((await f.upload()).json.code, 'INVALID_TRANSITION');
  assert.equal((await raw(f.server, `/api/attachments/${uploaded.json.data.id}`, { headers: { cookie: f.vendor } })).status, 200);
  const state = await f.server.store.readSnapshot();
  assert.equal(state.notification_outbox.length, 2);
  assert.equal(state.acceptances.length, 1); assert.equal(state.completion_reports.length, 1);
});

test('concurrent_attachment_replays_commit_one_private_blob_and_event', async t => {
  const f = await fixture(t);
  const headers = { 'idempotency-key': 'race', 'x-work-order-version': '1' };
  const results = await Promise.all([f.upload(undefined, undefined, headers), f.upload(undefined, undefined, headers)]);
  assert.equal(results[0].status, 200); assert.equal(results[1].status, 200);
  assert.deepEqual(results[0].json.data, results[1].json.data);
  const state = await f.server.store.readSnapshot();
  assert.equal(state.private_attachments.length, 1);
  assert.equal(state.work_order_events.length, 1);
  assert.equal(state.idempotency_records.length, 1);
  assert.equal((await readdir(f.attachmentDir)).length, 1);
});

test('attachment_storage_rejects_static_root_and_symlink_directory', async t => {
  const staticDir = new URL('../_dev/vendor-work-orders/public/', import.meta.url).pathname;
  assert.throws(() => createVendorWorkOrderServer({ attachmentDir: staticDir }), { code: 'INVALID_ATTACHMENT_STORAGE' });
  assert.throws(() => createVendorWorkOrderServer({ attachmentDir: join(staticDir, 'private') }), { code: 'INVALID_ATTACHMENT_STORAGE' });
  const f = await fixture(t);
  await f.server.close();
  const link = join(f.dir, 'link'); await symlink(f.attachmentDir, link);
  const server = createVendorWorkOrderServer({ dataFile: f.dataFile, attachmentDir: link });
  await assert.rejects(server.start(), { code: 'INVALID_ATTACHMENT_STORAGE' });
});
