import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(
  new URL('../apps-script/' + name, import.meta.url),
  'utf8'
);

const nativeSource = read('V2_WORKSPACE_DASHBOARD_NATIVE.js');
const loadStart = nativeSource.indexOf('function workspaceDashboardLoadData_(');
const loadEnd = nativeSource.indexOf('\n\n\nfunction workspaceDashboardRowsForAccess_(', loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart);

const sheets = {
  V2_properties: { name: 'V2_properties', rows: [{ property_id: 'P1' }] },
  V2_rooms: { name: 'V2_rooms', rows: [{ room_id: 'R1', property_id: 'P1' }] },
  V2_contracts: { name: 'V2_contracts', rows: [{ contract_id: 'C1', property_id: 'P1', tenant_id: 'T1' }] },
  V2_tenants: { name: 'V2_tenants', rows: [{ tenant_id: 'T1', property_id: 'P1' }] },
  V2_users: { name: 'V2_users', rows: [{ user_id: 'U1' }] },
  V2_bills: { name: 'V2_bills', rows: [{ bill_id: 'B1', property_id: 'P1', tenant_id: 'T1' }] },
  V2_landlord_tenant_list_view: { name: 'V2_landlord_tenant_list_view', rows: [{ tenant_id: 'T1' }] }
};

const requested = [];
const context = {
  Object,
  String,
  V2_WORKSPACE_DASHBOARD_SHEETS_: {
    properties: 'V2_properties',
    rooms: 'V2_rooms',
    contracts: 'V2_contracts',
    tenants: 'V2_tenants',
    users: 'V2_users',
    bills: 'V2_bills',
    landlordTenantListView: 'V2_landlord_tenant_list_view'
  },
  workspaceDashboardText_: value => value === undefined || value === null ? '' : String(value),
  workspaceDashboardRowsForAccess_: (sheet) => {
    if (!sheet) return [];
    requested.push(sheet.name);
    return sheet.rows.slice();
  },
  workspaceGetObjectsWithRow_: sheet => {
    if (!sheet) return [];
    requested.push(sheet.name);
    return sheet.rows.slice();
  },
  workspaceDashboardRowMatchesAccess_: () => true
};
vm.createContext(context);
vm.runInContext(
  nativeSource.slice(loadStart, loadEnd) +
    '\nthis.api = { workspaceDashboardLoadData_ };',
  context
);

const ss = {
  getSheetByName(name) {
    return sheets[name] || null;
  }
};
const access = {
  workspace: { workspace_id: 'W1' },
  principals: []
};

const arrearsData = context.api.workspaceDashboardLoadData_(ss, access, { mode: 'arrears' });
assert.deepEqual(JSON.parse(JSON.stringify(requested)), [
  'V2_properties',
  'V2_bills'
], 'arrears reads must not scan unrelated dashboard sheets');
assert.equal(arrearsData.rooms.length, 0);
assert.equal(arrearsData.contracts.length, 0);
assert.equal(arrearsData.tenants.length, 0);
assert.equal(arrearsData.users.length, 0);
assert.equal(arrearsData.tenant_view_rows.length, 0);

requested.length = 0;
const homeData = context.api.workspaceDashboardLoadData_(ss, access, { mode: 'home' });
assert.deepEqual(JSON.parse(JSON.stringify(requested)), [
  'V2_properties',
  'V2_rooms',
  'V2_contracts',
  'V2_bills',
  'V2_tenants',
  'V2_users'
], 'home reads must omit the legacy tenant list view');
assert.equal(homeData.tenant_view_rows.length, 0);

console.log('Phase 248 landlord read fast path regression test passed.');

const snapshotSource = read('V2_RUNTIME_SNAPSHOT.js');
const snapshotEnd = snapshotSource.indexOf('\n\nfunction runtimeSnapshotFinish_(');
assert.ok(snapshotEnd > 0);

const cacheValues = new Map();
let sheetReads = 0;
const snapshotContext = {
  Object,
  String,
  Date,
  CacheService: {
    getScriptCache() {
      return {
        get(key) { return cacheValues.get(key) || null; },
        put(key, value) { cacheValues.set(key, value); }
      };
    }
  },
  Logger: { log() {} }
};
vm.createContext(snapshotContext);
vm.runInContext(
  snapshotSource.slice(0, snapshotEnd) +
    '\nthis.api = { runtimeSnapshotBegin_, runtimeSnapshotGetValues_ };',
  snapshotContext
);

const sheet = {
  getParent() { return { getId() { return 'spreadsheet-fixture'; } }; },
  getSheetId() { return 17; },
  getDataRange() {
    sheetReads += 1;
    return { getValues() { return [['id'], ['row-1']]; } };
  }
};

snapshotContext.api.runtimeSnapshotBegin_('landlord_arrears');
snapshotContext.api.runtimeSnapshotGetValues_(sheet);
snapshotContext.api.runtimeSnapshotBegin_('landlord_arrears');
const sharedCachedValues = snapshotContext.api.runtimeSnapshotGetValues_(sheet);
assert.deepEqual(JSON.parse(JSON.stringify(sharedCachedValues)), [['id'], ['row-1']]);
assert.equal(sheetReads, 1, 'read-only sheet values should be reused across requests');

console.log('Phase 248 shared read cache regression test passed.');

const emailAuthSource = read('V2_LANDLORD_EMAIL_AUTH.js');
const emailResolverStart = emailAuthSource.indexOf('function resolveLandlordEmailSession_(');
const emailResolverEnd = emailAuthSource.indexOf('\n\nfunction landlordEmailAuthIssueChallenge_(', emailResolverStart);
assert.ok(emailResolverStart >= 0 && emailResolverEnd > emailResolverStart);

const resolverCalls = [];
const emailResolverContext = {
  runtimeSnapshotIsReadEnabled_: () => true,
  landlordEmailAuthResolveSession_: (...args) => {
    resolverCalls.push(args);
    return { success: true };
  }
};
vm.createContext(emailResolverContext);
vm.runInContext(
  emailAuthSource.slice(emailResolverStart, emailResolverEnd) +
    '\nthis.api = { resolveLandlordEmailSession_ };',
  emailResolverContext
);
emailResolverContext.api.resolveLandlordEmailSession_(
  'session-fixture',
  'request-fixture',
  { require_onboarding: true }
);
assert.equal(resolverCalls[0][3].require_onboarding, true);

console.log('Phase 248 email access reuse regression test passed.');
