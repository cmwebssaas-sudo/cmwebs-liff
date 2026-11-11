import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const dir = new URL('../apps-script/', import.meta.url);
const read = name => readFileSync(new URL(name, dir), 'utf8');
const signing = 'synthetic-signing';
const tenantUser = 'U' + 'c'.repeat(32);

function fn(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

// Same tenant LINE user in two Workspaces, as happens under one provider.
const listRows = [
  { tenant_id: 'T_OLD', workspace_id: 'W000001', tenant_line_user_id: tenantUser, tenant_name: '舊房客', line_user_id: 'U_LANDLORD_OLD', room_list: '101' },
  { tenant_id: 'T_NEW', workspace_id: 'W_TEST', tenant_line_user_id: tenantUser, tenant_name: '新房客', line_user_id: 'U_LANDLORD_NEW', room_list: '201' }
];

function context(workspaces = 'W_TEST') {
  const logs = [];
  const cache = new Map();
  const properties = { LINE_REGISTRY_SIGNING_SECRET: signing, READ_REPLICA_URL: 'https://worker.test', CMWEBS_LINE_WORKER_WORKSPACES: workspaces };
  const ctx = {
    Date, JSON, String, Math, Number, Object, Array,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] ?? null }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key) ?? null, put: (key, value) => cache.set(key, value) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    Utilities: { Charset: { UTF_8: 'utf8' }, computeHmacSha256Signature: (value, key) => [...createHmac('sha256', key).update(value).digest()] },
    V2_SHEETS: { landlordTenantListView: 'V2_landlord_tenant_list_view' },
    getSheetObjects_: name => name === 'V2_landlord_tenant_list_view' ? listRows : [],
    landlordEmailAuthConstantEquals_: (a, b) => a === b,
    isLineMessageAlreadyLogged_: () => false,
    cmwebsLogLineMessage_: entry => logs.push(entry)
  };
  const api = read('V2_API.js');
  const identity = read('V2_LINE_IDENTITY.js');
  const sources = [
    api.slice(api.indexOf('let LINE_WORKER_ROUTE_CONFIG_'), api.indexOf('function lineSendRoute_')),
    fn(read('V2_READ_REPLICA_SYNC.js'), 'readReplicaHex_'),
    fn(read('V2_READ_AUTHORIZATION.js'), 'readAuthorizationMac_'),
    identity.slice(identity.indexOf('let LINE_OWN_CHANNEL_WORKSPACES_'), identity.indexOf('// Looks up a landlord')),
    fn(api, 'handleLineWebhook_'), fn(api, 'processLineWebhookEvent_'), fn(api, 'findTenantByTenantLineUserId_'),
    read('V3_LINE_WEBHOOK.js')
  ];
  vm.runInNewContext(sources.join('\n'), ctx);
  return { ctx, logs };
}

function envelope(payload, { secret = signing, timestamp = Date.now(), nonce = randomUUID() } = {}) {
  const text = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update('cmwebs-line-webhook-v1\n' + timestamp + '\n' + nonce + '\n' + text).digest('hex');
  return { action: 'line_worker_webhook', timestamp, nonce, payload: text, signature };
}
const message = id => ({ type: 'message', webhookEventId: 'E' + id, replyToken: 'r', source: { type: 'user', userId: tenantUser },
  message: { id, type: 'text', text: '合成訊息' } });

test('forwarded events match tenants of the verified Workspace only', () => {
  const { ctx, logs } = context();
  const result = ctx.lineWorkerWebhookHandle_(envelope({ workspace_id: 'w_test', destination: 'U' + 'b'.repeat(32), events: [message('1')] }));
  assert.equal(result.success, true);
  assert.deepEqual({ ...result.data }, { processed: 1, skipped: 0, errors: 0 });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].tenant_id, 'T_NEW');
  assert.equal(logs[0].landlord_line_user_id, 'U_LANDLORD_NEW');
});

test('an unknown tenant in the verified Workspace is logged as unmatched, never as another Workspace tenant', () => {
  const { ctx, logs } = context('W_OTHER');
  ctx.lineWorkerWebhookHandle_(envelope({ workspace_id: 'W_OTHER', destination: 'U' + 'b'.repeat(32), events: [message('2')] }));
  assert.equal(logs[0].tenant_id, '');
  assert.equal(logs[0].status, 'unmatched');
});

test('bad signatures, replays, stale requests and Workspaces off the list are refused', () => {
  const { ctx, logs } = context();
  const body = { workspace_id: 'W_TEST', destination: 'U' + 'b'.repeat(32), events: [message('3')] };
  assert.equal(ctx.lineWorkerWebhookHandle_(envelope(body, { secret: 'wrong' })).code, 'LINE_WEBHOOK_REJECTED');
  assert.equal(ctx.lineWorkerWebhookHandle_(envelope(body, { timestamp: Date.now() - 600000 })).code, 'LINE_WEBHOOK_REJECTED');
  const once = envelope(body);
  assert.equal(ctx.lineWorkerWebhookHandle_(once).success, true);
  assert.equal(ctx.lineWorkerWebhookHandle_(once).code, 'LINE_WEBHOOK_REJECTED');
  assert.equal(ctx.lineWorkerWebhookHandle_(envelope({ ...body, workspace_id: 'W000001' })).code, 'LINE_WEBHOOK_WORKSPACE_NOT_ENABLED');
  assert.equal(ctx.lineWorkerWebhookHandle_({ ...envelope(body), extra: 1 }).code, 'LINE_WEBHOOK_REJECTED');
  assert.equal(logs.length, 1);
});

test('with an empty Worker list every forwarded request is refused', () => {
  const { ctx, logs } = context('');
  assert.equal(ctx.lineWorkerWebhookHandle_(envelope({ workspace_id: 'W_TEST', destination: 'U' + 'b'.repeat(32), events: [message('4')] })).code,
    'LINE_WEBHOOK_WORKSPACE_NOT_ENABLED');
  assert.equal(logs.length, 0);
});

test('the existing webhook still matches tenants across all Workspaces as before', () => {
  const { ctx, logs } = context();
  const result = ctx.handleLineWebhook_(JSON.stringify({ events: [message('5')] }));
  assert.equal(result.success, true);
  assert.equal(logs[0].tenant_id, 'T_OLD');
  const api = read('V2_API.js');
  assert.match(fn(api, 'handleLineWebhook_'), /processLineWebhookEvent_\(event\);/);
});

test('the dispatcher routes only the signed action to the new handler and keeps the old fallthrough', () => {
  const main = read('程式碼.js');
  assert.match(main, /if \(action === 'line_worker_webhook'\) \{\s*const webhookResult=lineWorkerWebhookHandle_\(request\);/);
  assert.match(main, /: handleLineWebhook_\(postBody\);/);
});
