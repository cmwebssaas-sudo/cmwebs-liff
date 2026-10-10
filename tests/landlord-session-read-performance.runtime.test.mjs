import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = name => readFileSync(new URL('../apps-script/' + name, import.meta.url), 'utf8');
const token = 'synthetic-performance-session';
const secret = 'synthetic-performance-key';
const hash = value => crypto.createHmac('sha256', secret).update(value).digest('hex');
const versionKey = 'cmwebs:v2:readonly-sheet-version';

// Only Google service boundaries are simulated. Session, membership, schema,
// snapshot, principal and POST dispatch all execute their production functions.
function setup() {
  const metrics = { fullReads: {}, headerReads: 0, writes: 0, hashes: 0, cacheGets: [], cachePuts: [], reports: [] };
  const cache = new Map();
  const sheets = new Map();
  const properties = { CMWEBS_EMAIL_LOGIN_HASH_SECRET: secret };
  const spreadsheet = {
    getId: () => 'fixture-spreadsheet',
    getSheetByName: name => sheets.get(name) || null,
    insertSheet(name) {
      const sheet = new Sheet(name, sheets.size + 1);
      sheets.set(name, sheet);
      return sheet;
    }
  };
  class Sheet {
    constructor(name, id) { this.name = name; this.id = id; this.values = [[]]; }
    getParent() { return spreadsheet; }
    getName() { return this.name; }
    getSheetId() { return this.id; }
    getLastRow() { return this.values.length; }
    getLastColumn() { return this.values[0].length; }
    getDataRange() {
      return { getValues: () => {
        metrics.fullReads[this.name] = (metrics.fullReads[this.name] || 0) + 1;
        return this.values.map(row => row.slice());
      } };
    }
    getRange(row, column, height = 1, width = 1) {
      return {
        getValues: () => {
          metrics.headerReads++;
          return Array.from({ length: height }, (_, i) =>
            Array.from({ length: width }, (_, j) => this.values[row - 1 + i]?.[column - 1 + j] ?? ''));
        },
        setValue: value => {
          metrics.writes++;
          this.values[row - 1] ||= [];
          this.values[row - 1][column - 1] = value;
        },
        setValues: values => values.forEach((cells, i) => cells.forEach((value, j) =>
          this.getRange(row + i, column + j).setValue(value)))
      };
    }
    appendRow(row) { metrics.writes++; this.values.push(row.slice()); }
  }
  const ctx = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] || null }) },
    CacheService: { getScriptCache: () => ({
      get: key => { metrics.cacheGets.push(key); return cache.get(key) || null; },
      put: (key, value) => { metrics.cachePuts.push(key); cache.set(key, value); }
    }) },
    Utilities: {
      formatDate: date => date.toISOString(),
      computeHmacSha256Signature: value => {
        metrics.hashes++;
        return [...Buffer.from(hash(value), 'hex')].map(byte => byte > 127 ? byte - 256 : byte);
      }
    },
    Logger: { log: message => {
      if (message.startsWith('[V2_RUNTIME_SNAPSHOT] '))
        metrics.reports.push(JSON.parse(message.slice('[V2_RUNTIME_SNAPSHOT] '.length)));
    } },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'allow' },
      createHtmlOutput: html => ({ html, setXFrameOptionsMode() { return this; } })
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => text }) },
    bankReceiptPostRequest_: () => ({ handled: false }),
    repairRouteRequestFromPostBody_: () => ({ handled: false })
  });
  for (const name of ['V2_RUNTIME_SNAPSHOT.js', 'V2_WORKSPACES.js', 'V2_WORKSPACE_LANDLORD_ACCESS.js',
    'V2_LANDLORD_EMAIL_AUTH.js', 'V2_API.js', 'V3_PLATFORM_CORE_SUBSCRIPTIONS.js', 'V3_PLATFORM_CORE_ROOM_CAPACITY.js']) {
    vm.runInContext(read(name), ctx, { filename: name });
  }
  const dispatcher = read('程式碼.js');
  vm.runInContext(dispatcher.slice(dispatcher.indexOf('function doPost(e)')), ctx);
  ctx.workspaceEnsureSchema_();
  function seed(name, record) {
    const sheet = sheets.get(name) || spreadsheet.insertSheet(name);
    for (const key of Object.keys(record)) if (!sheet.values[0].includes(key)) sheet.values[0].push(key);
    sheet.values.push(sheet.values[0].map(key => record[key] ?? ''));
    return sheet;
  }
  function change(name, field, value) {
    const sheet = sheets.get(name);
    sheet.values[1][sheet.values[0].indexOf(field)] = value;
  }
  seed('V2_users', { user_id: 'USER_FIXTURE', line_user_id: 'LINE_FIXTURE', role: 'landlord',
    account_status: 'active', active_workspace_id: 'WS_FIXTURE', email: 'fixture@example.test',
    email_verified_at: '2026-01-01T00:00:00.000Z', email_login_enabled: 'true' });
  seed('V2_workspaces', { workspace_id: 'WS_FIXTURE', account_status: 'active', onboarding_status: 'completed' });
  seed('V2_workspace_members', { user_id: 'USER_FIXTURE', workspace_id: 'WS_FIXTURE',
    membership_id: 'MEM_FIXTURE', role: 'owner', member_status: 'active', is_primary: true });
  seed('V2_landlords', { landlord_id: 'LANDLORD_FIXTURE', workspace_id: 'WS_FIXTURE',
    landlord_user_id: 'USER_FIXTURE', landlord_line_user_id: 'LINE_FIXTURE', account_status: 'active' });
  seed('V2_landlord_email_sessions', { session_id: 'SESSION_FIXTURE', session_token_hash: hash('session:' + token),
    user_id: 'USER_FIXTURE', workspace_id: 'WS_FIXTURE', role: 'owner', status: 'active',
    expires_at: '2050-01-01T00:00:00.000Z', last_seen_at: '2026-01-01T00:00:00.000Z' });
  seed('V2_rooms', { room_id: 'ROOM_FIXTURE', workspace_id: 'WS_FIXTURE', account_status: 'active', room_status: 'vacant' });
  seed('V2_rooms', { room_id: 'ROOM_OTHER', workspace_id: 'WS_OTHER', account_status: 'active', room_status: 'vacant' });
  ctx.runtimeSnapshotFinish_();
  cache.clear();
  function resetMetrics() {
    Object.assign(metrics, { fullReads: {}, headerReads: 0, writes: 0, hashes: 0, cacheGets: [], cachePuts: [], reports: [] });
  }
  resetMetrics();
  function request(action = 'landlord_email_session_status', overrides = {}) {
    const body = { action, response_mode: 'bridge', request_id: 'fixture-request', landlord_session_token: token, ...overrides };
    const output = ctx.doPost({ postData: { contents: JSON.stringify(body) } });
    assert.ok(output.html, 'must return the real controlled HTML bridge');
    return JSON.parse(output.html.match(/postMessage\((.*), '\*'\)/)[1]).payload;
  }
  return { ctx, metrics, cache, sheets, properties, seed, change, request, resetMetrics };
}

test('session restoration authenticates once, reads each auth sheet once and performs no schema/session writes', t => {
  const s = setup();
  const result = s.request();
  assert.equal(result.success, true, result.code);
  assert.equal(result.data.workspace_id, 'WS_FIXTURE');
  t.diagnostic(JSON.stringify({ action: 'session_status', ...s.metrics }));
  assert.equal(s.metrics.hashes, 1, 'same token must not be resolved twice by dispatcher');
  assert.deepEqual(s.metrics.fullReads, {
    V2_landlord_email_sessions: 1, V2_users: 1, V2_workspace_members: 1, V2_workspaces: 1, V2_landlords: 1
  });
  assert.equal(s.metrics.headerReads, 0, 'login restoration must not scan schema headers');
  assert.equal(s.metrics.writes, 0, 'read must not touch session metadata');
  assert.equal(s.metrics.cachePuts.length, 0, 'authentication must not populate shared sheet cache or invalidate business reads');
});

test('status ignores shared snapshots and observes revocation on the next request', () => {
  const s = setup();
  // Warm the existing business-read cache with an active session.
  s.ctx.runtimeSnapshotBegin_('landlord_properties_init');
  s.ctx.resolveLandlordPrincipal_({ landlord_session_token: token });
  s.ctx.runtimeSnapshotFinish_();
  s.change('V2_landlord_email_sessions', 'revoked_at', '2026-10-11T00:00:00.000Z');
  assert.equal(s.request().code, 'SESSION_REVOKED');
});

for (const [name, table, field, value, expectedCode] of [
  ['expired', 'V2_landlord_email_sessions', 'expires_at', '2020-01-01T00:00:00Z', 'SESSION_EXPIRED'],
  ['disabled Email', 'V2_users', 'email_login_enabled', 'false', 'AUTH_REQUIRED'],
  ['disabled user', 'V2_users', 'account_status', 'inactive', 'AUTH_REQUIRED'],
  ['revoked membership', 'V2_workspace_members', 'member_status', 'inactive', 'WORKSPACE_FORBIDDEN'],
  ['changed role', 'V2_workspace_members', 'role', 'viewer', 'WORKSPACE_FORBIDDEN'],
  ['changed workspace', 'V2_landlord_email_sessions', 'workspace_id', 'WS_OTHER', 'WORKSPACE_FORBIDDEN']
]) {
  test('fresh session read rejects ' + name + ' without writing', () => {
    const s = setup();
    assert.equal(s.request().success, true);
    s.change(table, field, value);
    s.resetMetrics();
    assert.equal(s.request().code, expectedCode);
    assert.equal(s.metrics.writes, 0);
  });
}

test('missing POST credentials are rejected before touching Sheets', () => {
  const s = setup();
  for (const field of ['request_id', 'landlord_session_token']) {
    assert.equal(s.request(undefined, { [field]: '' }).code, 'MISSING_REQUIRED_FIELD');
  }
  assert.deepEqual(s.metrics.fullReads, {});
});

for (const action of ['landlord_email_session_status', 'landlord_subscription_init']) {
  test(action + ' returns a controlled bridge error when an auth sheet is missing', () => {
    const s = setup();
    s.sheets.delete('V2_landlord_email_sessions');
    const result = s.request(action);
    assert.equal(result.success, false);
    assert.equal(result.code, action === 'landlord_email_session_status' ? 'AUTH_UNAVAILABLE' : 'SUBSCRIPTION_UNAVAILABLE');
    assert.equal(s.sheets.has('V2_landlord_email_sessions'), false, 'read must not repair schema');
    assert.equal(s.metrics.writes, 0);
    assert.equal(s.ctx.runtimeSnapshotIsReadEnabled_(), false, 'request state must be cleared after failure');
    assert.equal(s.metrics.reports.length, 1, 'bridge cleanup and finally must not finish the request twice');
  });
}

test('invalid token and caller-supplied workspace/role cannot authorize a session', () => {
  const s = setup();
  assert.equal(s.request(undefined, { landlord_session_token: 'unknown-token', workspace_id: 'WS_FIXTURE', role: 'owner' }).code, 'AUTH_REQUIRED');
  const valid = s.request(undefined, { workspace_id: 'WS_OTHER', role: 'admin' });
  assert.equal(valid.data.workspace_id, 'WS_FIXTURE');
  assert.equal(valid.data.role, 'owner');
});

test('changing the active Workspace between requests invalidates the issued session', () => {
  const s = setup();
  assert.equal(s.request().success, true);
  s.seed('V2_workspaces', { workspace_id: 'WS_OTHER', account_status: 'active', onboarding_status: 'completed' });
  s.seed('V2_workspace_members', { user_id: 'USER_FIXTURE', workspace_id: 'WS_OTHER', role: 'owner', member_status: 'active' });
  s.seed('V2_landlords', { landlord_id: 'LANDLORD_OTHER', workspace_id: 'WS_OTHER', landlord_line_user_id: 'LINE_OTHER' });
  s.change('V2_users', 'active_workspace_id', 'WS_OTHER');
  assert.equal(s.request().code, 'WORKSPACE_FORBIDDEN');
});

test('logout still persists revocation and invalidates the existing business cache', () => {
  const s = setup();
  s.cache.set(versionKey, 'before-logout');
  assert.equal(s.request('landlord_email_session_revoke').success, true);
  assert.ok(s.metrics.writes > 0);
  assert.notEqual(s.cache.get(versionKey), 'before-logout');
  assert.equal(s.request().code, 'SESSION_REVOKED');
});

test('subscription summary reuses request reads without schema checks, session writes or business-cache invalidation', t => {
  const s = setup();
  s.cache.set(versionKey, 'business-generation');
  const result = s.request('landlord_subscription_init');
  assert.equal(result.success, true, result.code);
  assert.equal(result.data.mode, 'legacy');
  assert.equal(result.data.rooms_used, 1, 'count stays scoped to the authenticated Workspace');
  t.diagnostic(JSON.stringify({ action: 'subscription_init', ...s.metrics }));
  assert.equal(s.metrics.headerReads, 0);
  assert.equal(s.metrics.writes, 0);
  assert.equal(s.metrics.fullReads.V2_users, 1);
  assert.equal(s.metrics.fullReads.V2_workspace_members, 1);
  assert.equal(s.cache.get(versionKey), 'business-generation');
});

test('subscription read still queries Core each time and propagates unavailability', () => {
  const s = setup();
  s.seed('V3_platform_core_workspace_links', { workspace_id: 'WS_FIXTURE', platform_company_id: 'com_fixture',
    product_id: 'prd_fixture', status: 'LINKED', mode: 'observe', linked_at: '', updated_at: '' });
  Object.assign(s.properties, { CMWEBS_PLATFORM_CORE_ENVIRONMENT: 'staging',
    CMWEBS_PLATFORM_CORE_BASE_URL: 'https://core.example.test', CMWEBS_PLATFORM_CORE_PRODUCT_ID: 'prd_fixture',
    CMWEBS_PLATFORM_CORE_SERVICE_TOKEN: 'fixture-core-token' });
  let calls = 0;
  s.ctx.UrlFetchApp = { fetch: () => {
    calls++;
    return { getResponseCode: () => calls === 1 ? 200 : 503,
      getContentText: () => JSON.stringify({ request_id: 'req_fixture', company_id: 'com_fixture', product_id: 'prd_fixture',
        external_company_id: 'WS_FIXTURE', evaluated_at: new Date(Date.now() - 1000).toISOString(),
        expires_at: new Date(Date.now() + 20000).toISOString(), subscriptions: [], entitlements: [] }) };
  } };
  assert.equal(s.request('landlord_subscription_init').success, true);
  assert.equal(s.request('landlord_subscription_init').code, 'SUBSCRIPTION_UNAVAILABLE');
  assert.equal(calls, 2);
  assert.equal(s.metrics.writes, 0);
});

test('common read cache resolves its namespace once per request and observes a write on the next request', () => {
  const s = setup();
  const first = s.sheets.get('V2_rooms');
  const second = s.seed('V2_properties', { property_id: 'PROPERTY_FIXTURE' });
  s.cache.set(versionKey, 'before');
  s.resetMetrics();
  s.ctx.runtimeSnapshotBegin_('landlord_properties_init');
  s.ctx.runtimeSnapshotGetValues_(first);
  s.ctx.runtimeSnapshotGetValues_(second);
  s.ctx.runtimeSnapshotFinish_();
  assert.equal(s.metrics.cacheGets.filter(key => key === versionKey).length, 1);
  s.change('V2_rooms', 'room_status', 'occupied');
  s.ctx.runtimeSnapshotBegin_('landlord_room_save');
  s.ctx.runtimeSnapshotFinish_();
  s.ctx.runtimeSnapshotBegin_('landlord_properties_init');
  assert.equal(s.ctx.runtimeSnapshotGetValues_(first)[1][first.values[0].indexOf('room_status')], 'occupied');
  s.ctx.runtimeSnapshotFinish_();
});

test('an unavailable or corrupt shared cache falls back to Sheets', () => {
  for (const unavailable of [false, true]) {
    const s = setup();
    s.ctx.CacheService = { getScriptCache: () => {
      if (unavailable) throw new Error('unavailable');
      return { get: key => key === versionKey ? 'generation' : '{bad-json', put() { throw new Error('full'); } };
    } };
    s.ctx.runtimeSnapshotBegin_('landlord_properties_init');
    const rows = s.ctx.runtimeSnapshotGetValues_(s.sheets.get('V2_rooms'));
    assert.equal(rows[1][0], 'ROOM_FIXTURE');
    assert.equal(s.metrics.fullReads.V2_rooms, 1);
    s.ctx.runtimeSnapshotFinish_();
  }
});
