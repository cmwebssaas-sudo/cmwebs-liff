'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const backendSource = fs.readFileSync(
  path.join(root, 'apps-script', 'V2_TENANT_BINDING_PHONE.js'),
  'utf8'
);
const frontendSource = fs.readFileSync(
  path.join(root, 'frontend', 'tenant-bind.html'),
  'utf8'
);

const CORE_SHEETS = [
  'V2_tenants',
  'V2_users',
  'V2_contracts',
  'V2_tenant_home_view',
  'V2_landlord_tenant_list_view',
  'V2_tenant_bill_view',
  'V2_bills',
  'V2_payment_reports',
  'V2_tenant_messages'
];

class MockRange {
  constructor(sheet, row, column, rows, columns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rows = rows || 1;
    this.columns = columns || 1;
  }

  getValues() {
    const result = [];
    for (let r = 0; r < this.rows; r += 1) {
      const values = [];
      for (let c = 0; c < this.columns; c += 1) {
        values.push(
          (this.sheet.values[this.row - 1 + r] || [])[this.column - 1 + c] ?? ''
        );
      }
      result.push(values);
    }
    return result;
  }

  setValues(values) {
    this.sheet.stats.batchWrites += 1;
    for (let r = 0; r < values.length; r += 1) {
      while (this.sheet.values.length < this.row + r) {
        this.sheet.values.push([]);
      }
      for (let c = 0; c < values[r].length; c += 1) {
        this.sheet.values[this.row - 1 + r][this.column - 1 + c] = values[r][c];
      }
    }
    return this;
  }

  setValue(value) {
    this.sheet.stats.cellWrites += 1;
    return this.setValues([[value]]);
  }
}

class MockSheet {
  constructor(name, values, stats) {
    this.name = name;
    this.values = values.map(row => row.slice());
    this.stats = stats;
  }

  getName() { return this.name; }
  getLastRow() { return this.values.length; }
  getLastColumn() {
    return this.values.reduce((max, row) => Math.max(max, row.length), 0);
  }
  getDataRange() {
    this.stats.fullReads += 1;
    return new MockRange(this, 1, 1, this.getLastRow(), this.getLastColumn());
  }
  getRange(row, column, rows, columns) {
    return new MockRange(this, row, column, rows, columns);
  }
}

class MockSpreadsheet {
  constructor(sheets) { this.sheets = sheets; }
  getSheetByName(name) { return this.sheets[name] || null; }
}

function table(headers, rows) {
  return [headers].concat(rows.map(row => headers.map(header => row[header] ?? '')));
}

function appendObjectRow(sheet, record) {
  const headers = sheet.values[0];
  sheet.values.push(headers.map(header => record[header] ?? ''));
}

function fixture(options = {}) {
  const stats = {
    fullReads: 0,
    batchWrites: 0,
    cellWrites: 0,
    flushes: 0,
    logs: [],
    lockWaits: 0,
    lockReleases: 0
  };
  const uid = options.uid || 'Ufixture-phase83-tenant';
  const canonicalUid = options.boundUid || '';
  const partialUid = options.partialUid ? uid : '';
  const accountStatus = options.accountStatus || 'active';
  const phone = options.phone || '0900000001';
  const tenantHeaders = [
    'tenant_id', 'tenant_user_id', 'tenant_name', 'tenant_phone',
    'account_status', 'tenant_line_user_id', 'tenant_binding_status',
    'bound_at', 'updated_at', 'workspace_id', 'property_id', 'room_id', 'room_name'
  ];
  if (options.missingSchema) {
    tenantHeaders.splice(tenantHeaders.indexOf('bound_at'), 1);
  }
  const base = {
    V2_tenants: table(tenantHeaders, [{
      tenant_id: 'TFIX001', tenant_user_id: 'UFIX001',
      tenant_name: 'Fixture Tenant', tenant_phone: phone,
      account_status: accountStatus, tenant_line_user_id: canonicalUid || partialUid,
      tenant_binding_status: canonicalUid || partialUid ? 'bound' : '',
      bound_at: canonicalUid || partialUid ? '2026-07-22 00:00:00' : '',
      updated_at: '2026-07-22 00:00:00', workspace_id: 'WFIX001',
      property_id: 'PFIX001', room_id: 'RFIX001', room_name: 'STG-FIXTURE'
    }]),
    V2_users: table(
      ['user_id', 'phone', 'line_user_id', 'binding_status', 'bound_at', 'updated_at'],
      [{ user_id: 'UFIX001', phone, line_user_id: canonicalUid,
        binding_status: canonicalUid ? 'bound' : '', bound_at: '', updated_at: '' }]
    ),
    V2_contracts: table(
      ['contract_id', 'tenant_id', 'workspace_id', 'property_id', 'room_id',
        'contract_status', 'end_date', 'tenant_line_user_id', 'updated_at'],
      [{ contract_id: 'CFIX001', tenant_id: 'TFIX001', workspace_id: 'WFIX001',
        property_id: 'PFIX001', room_id: 'RFIX001', contract_status: 'active',
        end_date: '2027-07-22', tenant_line_user_id: canonicalUid, updated_at: '' }]
    ),
    V2_tenant_home_view: table(
      ['tenant_id', 'tenant_user_id', 'contract_id', 'workspace_id', 'property_id',
        'room_id', 'room_name', 'line_user_id', 'tenant_line_user_id',
        'tenant_binding_status', 'bound_at', 'updated_at'],
      [{ tenant_id: 'TFIX001', tenant_user_id: 'UFIX001', contract_id: 'CFIX001',
        workspace_id: 'WFIX001', property_id: 'PFIX001', room_id: 'RFIX001',
        room_name: 'STG-FIXTURE', line_user_id: canonicalUid,
        tenant_line_user_id: canonicalUid,
        tenant_binding_status: canonicalUid ? 'bound' : '', bound_at: '', updated_at: '' }]
    ),
    V2_landlord_tenant_list_view: table(
      ['tenant_id', 'tenant_user_id', 'contract_id', 'workspace_id', 'property_id',
        'room_id', 'tenant_phone', 'tenant_line_user_id', 'tenant_binding_status',
        'bound_at', 'updated_at'],
      [{ tenant_id: 'TFIX001', tenant_user_id: 'UFIX001', contract_id: 'CFIX001',
        workspace_id: 'WFIX001', property_id: 'PFIX001', room_id: 'RFIX001',
        tenant_phone: phone, tenant_line_user_id: canonicalUid,
        tenant_binding_status: canonicalUid ? 'bound' : '', bound_at: '', updated_at: '' }]
    ),
    V2_tenant_bill_view: table(
      ['tenant_id', 'tenant_user_id', 'contract_id', 'tenant_line_user_id', 'updated_at'], []
    ),
    V2_bills: table(
      ['tenant_id', 'tenant_user_id', 'contract_id', 'tenant_line_user_id', 'updated_at'], []
    ),
    V2_payment_reports: table(
      ['tenant_id', 'tenant_user_id', 'contract_id', 'tenant_line_user_id', 'updated_at'], []
    ),
    V2_tenant_messages: table(
      ['tenant_id', 'tenant_user_id', 'contract_id', 'tenant_line_user_id', 'updated_at'], []
    ),
    V2_tenant_binding_logs: table(
      ['log_id', 'created_at', 'line_user_id', 'tenant_id', 'tenant_name',
        'room_name', 'result', 'code', 'message', 'note'], []
    ),
    V2_liff_access_logs: table(
      ['log_id', 'created_at', 'line_user_id', 'user_id', 'role', 'action',
        'target_id', 'result', 'error_message', 'user_agent', 'ip_hint', 'notes'], []
    )
  };
  const sheets = {};
  Object.keys(base).forEach(name => {
    sheets[name] = new MockSheet(name, base[name], stats);
  });
  const spreadsheet = new MockSpreadsheet(sheets);
  const cache = new Map();
  const lock = {
    waitLock() { stats.lockWaits += 1; },
    releaseLock() { stats.lockReleases += 1; }
  };
  const context = {
    console,
    Date,
    Math,
    JSON,
    Object,
    Number,
    String,
    Array,
    Error,
    RegExp,
    runtimeSpreadsheet_: () => spreadsheet,
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: { flush() { stats.flushes += 1; } },
    CacheService: {
      getScriptCache: () => ({
        get: key => cache.get(key) || null,
        put: (key, value) => cache.set(key, value),
        remove: key => cache.delete(key)
      })
    },
    Utilities: {
      formatDate: date => new Date(date).toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    },
    Logger: { log: message => stats.logs.push(String(message)) },
    logLiffAccess_: (payload, metrics) => {
      const sheet = spreadsheet.getSheetByName('V2_liff_access_logs');
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, 12).setValues([[
        'LOG-FIXTURE', new Date(), payload.lineUserId || '', payload.userId || '',
        payload.role || '', payload.action || '', payload.targetId || '',
        payload.result || '', payload.errorMessage || '', '', '', payload.notes || ''
      ]]);
      if (metrics) metrics.batch_write_count += 1;
    }
  };
  vm.createContext(context);
  vm.runInContext(backendSource, context, {
    filename: 'V2_TENANT_BINDING_PHONE.js'
  });
  return { context, spreadsheet, stats, uid, phone };
}

function addTenantIdentity(f, options = {}) {
  const record = {
    tenantId: options.tenantId || 'TFIX002',
    userId: options.userId || 'UFIX002',
    contractId: options.contractId || 'CFIX002',
    workspaceId: options.workspaceId || 'WFIX001',
    propertyId: options.propertyId || 'PFIX001',
    roomId: options.roomId || 'RFIX002',
    phone: options.phone || '0900000002',
    uid: options.uid || ''
  };
  appendObjectRow(f.spreadsheet.sheets.V2_tenants, {
    tenant_id: record.tenantId, tenant_user_id: record.userId,
    tenant_name: 'Other Fixture Tenant', tenant_phone: record.phone,
    account_status: 'active', tenant_line_user_id: record.uid,
    tenant_binding_status: record.uid ? 'bound' : '', bound_at: '', updated_at: '',
    workspace_id: record.workspaceId, property_id: record.propertyId,
    room_id: record.roomId, room_name: 'STG-OTHER'
  });
  appendObjectRow(f.spreadsheet.sheets.V2_users, {
    user_id: record.userId, phone: record.phone, line_user_id: record.uid,
    binding_status: record.uid ? 'bound' : '', bound_at: '', updated_at: ''
  });
  appendObjectRow(f.spreadsheet.sheets.V2_contracts, {
    contract_id: record.contractId, tenant_id: record.tenantId,
    workspace_id: record.workspaceId, property_id: record.propertyId,
    room_id: record.roomId, contract_status: 'active', end_date: '2027-07-22',
    tenant_line_user_id: record.uid, updated_at: ''
  });
  appendObjectRow(f.spreadsheet.sheets.V2_tenant_home_view, {
    tenant_id: record.tenantId, tenant_user_id: record.userId,
    contract_id: record.contractId, workspace_id: record.workspaceId,
    property_id: record.propertyId, room_id: record.roomId, room_name: 'STG-OTHER',
    line_user_id: record.uid, tenant_line_user_id: record.uid,
    tenant_binding_status: record.uid ? 'bound' : '', bound_at: '', updated_at: ''
  });
  appendObjectRow(f.spreadsheet.sheets.V2_landlord_tenant_list_view, {
    tenant_id: record.tenantId, tenant_user_id: record.userId,
    contract_id: record.contractId, workspace_id: record.workspaceId,
    property_id: record.propertyId, room_id: record.roomId,
    tenant_phone: record.phone, tenant_line_user_id: record.uid,
    tenant_binding_status: record.uid ? 'bound' : '', bound_at: '', updated_at: ''
  });
  return record;
}

function normalized(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalized);
  return value;
}

function coreSnapshot(f) {
  const snapshot = {};
  CORE_SHEETS.forEach(name => {
    snapshot[name] = normalized(f.spreadsheet.sheets[name].values);
  });
  return snapshot;
}

function assertCoreState(f, expected, message) {
  assert.deepStrictEqual(coreSnapshot(f), expected, message);
}

function bindingLogCount(f) {
  const sheet = f.spreadsheet.sheets.V2_tenant_binding_logs;
  const headers = sheet.values[0];
  const codeColumn = headers.indexOf('code');
  return sheet.values.slice(1).filter(row => row[codeColumn] === 'BOUND').length;
}

function assertUnbound(f) {
  const tenants = f.spreadsheet.sheets.V2_tenants;
  const headers = tenants.values[0];
  const uidColumn = headers.indexOf('tenant_line_user_id');
  const statusColumn = headers.indexOf('tenant_binding_status');
  assert.strictEqual(tenants.values[1][uidColumn], '');
  assert.strictEqual(tenants.values[1][statusColumn], '');
}

function setCanonicalTargetUidInSpreadsheet(spreadsheet, uid) {
  [
    ['V2_tenants', ['tenant_line_user_id']],
    ['V2_users', ['line_user_id']],
    ['V2_contracts', ['tenant_line_user_id']],
    ['V2_tenant_home_view', ['line_user_id', 'tenant_line_user_id']],
    ['V2_landlord_tenant_list_view', ['tenant_line_user_id']]
  ].forEach(([sheetName, fields]) => {
    const sheet = spreadsheet.sheets[sheetName];
    const headers = sheet.values[0];
    const row = sheet.values[1];
    fields.forEach(field => {
      row[headers.indexOf(field)] = uid;
    });
  });
}

function phase83Options(extra = {}) {
  return Object.assign({ __phase83_fixture: true }, extra);
}

function runBackendCases() {
  let successSummary = null;
  let mutationBoundaryCount = 0;
  let conflictFixtureCount = 0;

  {
    const f = fixture();
    const options = phase83Options();
    const result = f.context.bindTenantByLineUid_(f.uid, f.phone, options);
    assert.strictEqual(result.success, true, 'new binding should succeed');
    assert.strictEqual(result.code, 'BOUND');
    assert.strictEqual(result.data.idempotent, false);
    assert.strictEqual(f.stats.cellWrites, 0, 'normal path must not call setValue');
    assert.strictEqual(f.stats.flushes, 1, 'normal path must flush once');
    assert.ok(
      f.stats.fullReads <= 10,
      'pre-lock and locked snapshots should each read core sheets at most once'
    );
    assert.strictEqual(bindingLogCount(f), 1, 'new binding must have one BOUND log');
    assert.strictEqual(f.stats.lockReleases, 1, 'success must release ScriptLock');
    mutationBoundaryCount = options.observedMutationCount;
    assert.ok(mutationBoundaryCount > 0, 'fixture must expose mutation boundaries');
    const metric = f.stats.logs.find(line => line.includes('STAGING_TENANT_BINDING_METRICS'));
    assert.ok(metric, 'metrics must be logged');
    successSummary = JSON.parse(metric.slice(metric.indexOf('{')));
  }

  // Exact same UID + phone + tenant is canonical idempotent BOUND.
  {
    const f = fixture({ boundUid: 'Ufixture-phase83-tenant' });
    const result = f.context.bindTenantByLineUid_(f.uid, f.phone);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.code, 'BOUND');
    assert.strictEqual(result.data.bound, true);
    assert.strictEqual(result.data.idempotent, true);
    assert.strictEqual(f.stats.batchWrites, 0, 'idempotent path must not write');
    assert.strictEqual(f.stats.flushes, 0, 'idempotent path must not flush');
    assert.strictEqual(bindingLogCount(f), 0, 'idempotent path must not duplicate BOUND');
    assert.strictEqual(f.stats.lockReleases, 0, 'idempotent read path does not lock');
    conflictFixtureCount += 1;
  }

  // Supplied UID belongs consistently to another tenant.
  {
    const f = fixture();
    addTenantIdentity(f, { uid: f.uid });
    const before = coreSnapshot(f);
    const result = f.context.bindTenantByLineUid_(f.uid, f.phone);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'UID_BOUND_TO_OTHER_TENANT');
    assert.strictEqual(result.data.bound, false);
    assert.strictEqual(f.stats.batchWrites, 0);
    assert.strictEqual(bindingLogCount(f), 0);
    assertCoreState(f, before, 'UID conflict must not mutate canonical data');
    assert.strictEqual(f.stats.lockReleases, 0);
    conflictFixtureCount += 1;
  }

  // Target tenant belongs to another UID.
  {
    const f = fixture({ boundUid: 'Ufixture-other-account' });
    const before = coreSnapshot(f);
    const result = f.context.bindTenantByLineUid_(f.uid, f.phone);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'TARGET_TENANT_BOUND_TO_OTHER_UID');
    assert.strictEqual(f.stats.batchWrites, 0);
    assert.strictEqual(bindingLogCount(f), 0);
    assertCoreState(f, before);
    assert.strictEqual(f.stats.lockReleases, 0);
    conflictFixtureCount += 1;
  }

  // Partial UID ownership is fail-closed and never repaired inline.
  {
    const f = fixture({ partialUid: true });
    const before = coreSnapshot(f);
    const result = f.context.bindTenantByLineUid_(f.uid, f.phone);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'BINDING_DATA_CONFLICT');
    assert.strictEqual(result.data.manual_repair_required, true);
    assert.strictEqual(f.stats.batchWrites, 0);
    assert.strictEqual(bindingLogCount(f), 0);
    assertCoreState(f, before);
    assert.strictEqual(f.stats.lockReleases, 0);
    conflictFixtureCount += 1;
  }

  // Canonical projections must agree on the normalized identity chain.
  {
    const f = fixture();
    const home = f.spreadsheet.sheets.V2_tenant_home_view;
    const workspaceColumn = home.values[0].indexOf('workspace_id');
    home.values[1][workspaceColumn] = 'WFIX-CONFLICT';
    const before = coreSnapshot(f);
    const result = f.context.bindTenantByLineUid_(f.uid, f.phone);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'BINDING_DATA_CONFLICT');
    assert.strictEqual(result.data.manual_repair_required, true);
    assert.strictEqual(f.stats.batchWrites, 0);
    assert.strictEqual(bindingLogCount(f), 0);
    assertCoreState(f, before);
    assert.strictEqual(f.stats.lockReleases, 0);
    conflictFixtureCount += 1;
  }

  // One phone resolving to multiple tenants is never first-row-wins.
  {
    const f = fixture();
    addTenantIdentity(f, { phone: f.phone });
    const before = coreSnapshot(f);
    const result = f.context.bindTenantByLineUid_(f.uid, f.phone);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'PHONE_BOUND_TO_OTHER_TENANT');
    assert.strictEqual(f.stats.batchWrites, 0);
    assert.strictEqual(bindingLogCount(f), 0);
    assertCoreState(f, before);
    assert.strictEqual(f.stats.lockReleases, 0);
    conflictFixtureCount += 1;
  }

  // Simulated ownership change after the first check is caught by final check.
  {
    const f = fixture();
    let stateAfterConcurrentOwner = null;
    const options = phase83Options({
      beforeFinalOwnershipCheck(snapshot, target, spreadsheet) {
        setCanonicalTargetUidInSpreadsheet(
          spreadsheet,
          'Ufixture-concurrent-owner'
        );
        stateAfterConcurrentOwner = coreSnapshot(f);
      }
    });
    const result = f.context.bindTenantByLineUid_(f.uid, f.phone, options);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'TARGET_TENANT_BOUND_TO_OTHER_UID');
    assert.strictEqual(f.stats.batchWrites, 0);
    assert.strictEqual(bindingLogCount(f), 0);
    assertCoreState(
      f,
      stateAfterConcurrentOwner,
      'binding request must not overwrite the simulated concurrent owner'
    );
    assert.strictEqual(f.stats.lockReleases, 1);
    conflictFixtureCount += 1;
  }

  // Fault controls without the internal fixture marker are ignored.
  {
    const f = fixture();
    const result = f.context.bindTenantByLineUid_(
      f.uid,
      f.phone,
      { failBeforeFirstMutation: true }
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.code, 'BOUND');
  }

  // Failure before first mutation: no writes, logs, or state changes.
  {
    const f = fixture();
    const before = coreSnapshot(f);
    const result = f.context.bindTenantByLineUid_(
      f.uid,
      f.phone,
      phase83Options({ failBeforeFirstMutation: true })
    );
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'SYSTEM_ERROR');
    assert.strictEqual(result.data.rollback_attempted, false);
    assert.strictEqual(result.data.rollback_succeeded, true);
    assert.strictEqual(f.stats.batchWrites, 0);
    assert.strictEqual(bindingLogCount(f), 0);
    assertCoreState(f, before);
    assertUnbound(f);
    assert.strictEqual(f.stats.lockReleases, 1);
  }

  // Every core mutation boundary must restore exact before-values.
  for (let index = 0; index < mutationBoundaryCount; index += 1) {
    const f = fixture();
    const before = coreSnapshot(f);
    const result = f.context.bindTenantByLineUid_(
      f.uid,
      f.phone,
      phase83Options({ failAfterMutationIndex: index })
    );
    assert.strictEqual(result.success, false, `boundary ${index} must fail`);
    assert.strictEqual(result.code, 'SYSTEM_ERROR', `boundary ${index} code`);
    assert.strictEqual(result.data.rollback_attempted, true);
    assert.strictEqual(result.data.rollback_succeeded, true);
    assert.strictEqual(result.data.manual_repair_required, false);
    assert.strictEqual(bindingLogCount(f), 0);
    assertCoreState(f, before, `boundary ${index} must restore all core sheets`);
    assertUnbound(f);
    assert.strictEqual(f.stats.lockReleases, 1, `boundary ${index} releases lock`);
  }

  // Forward failure plus injected rollback failure fails closed.
  {
    const f = fixture();
    const result = f.context.bindTenantByLineUid_(
      f.uid,
      f.phone,
      phase83Options({ failAfterMutationIndex: 1, failRollbackAtIndex: 0 })
    );
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'BINDING_ROLLBACK_FAILED');
    assert.strictEqual(result.data.bound, false);
    assert.strictEqual(result.data.rollback_attempted, true);
    assert.strictEqual(result.data.rollback_succeeded, false);
    assert.strictEqual(result.data.manual_repair_required, true);
    assert.ok(result.data.inconsistent_range, 'failed rollback identifies range');
    assert.strictEqual(bindingLogCount(f), 0);
    assert.strictEqual(f.stats.lockReleases, 1, 'rollback failure releases lock');
  }

  // A committed core binding remains BOUND when post-commit audit fails.
  {
    const f = fixture();
    const result = f.context.bindTenantByLineUid_(
      f.uid,
      f.phone,
      phase83Options({ failAuditWrite: true })
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.code, 'BOUND');
    assert.strictEqual(result.data.bound, true);
    assert.strictEqual(result.data.audit_warning, true);
    assert.strictEqual(result.data.audit_warning_code, 'BINDING_AUDIT_INCOMPLETE');
    assert.strictEqual(bindingLogCount(f), 0);
    assert.strictEqual(f.stats.lockReleases, 1);

    const retry = f.context.bindTenantByLineUid_(f.uid, f.phone);
    assert.strictEqual(retry.success, true);
    assert.strictEqual(retry.code, 'BOUND');
    assert.strictEqual(retry.data.idempotent, true);
    assert.strictEqual(bindingLogCount(f), 0, 'idempotent retry must not synthesize audit');
  }

  // Repeated successful request has one transaction and one deterministic audit.
  {
    const f = fixture();
    const first = f.context.bindTenantByLineUid_(f.uid, f.phone);
    const writesAfterFirst = f.stats.batchWrites;
    const second = f.context.bindTenantByLineUid_(f.uid, f.phone);
    assert.strictEqual(first.success, true);
    assert.strictEqual(second.success, true);
    assert.strictEqual(second.code, 'BOUND');
    assert.strictEqual(second.data.idempotent, true);
    assert.strictEqual(f.stats.batchWrites, writesAfterFirst);
    assert.strictEqual(bindingLogCount(f), 1);
    assert.strictEqual(f.stats.lockReleases, 1);
  }

  {
    const f = fixture();
    const result = f.context.bindTenantByLineUid_(f.uid, '0900999999');
    assert.strictEqual(result.code, 'PHONE_NOT_FOUND');
    assert.strictEqual(f.stats.flushes, 0);
  }

  {
    const f = fixture({ accountStatus: 'inactive' });
    const result = f.context.bindTenantByLineUid_(f.uid, f.phone);
    assert.strictEqual(result.code, 'ACCOUNT_NOT_ACTIVE');
    assert.strictEqual(f.stats.flushes, 0);
  }

  {
    const f = fixture({ missingSchema: true });
    const result = f.context.bindTenantByLineUid_(f.uid, f.phone);
    assert.strictEqual(result.code, 'TENANT_BINDING_SCHEMA_INVALID');
    assert.strictEqual(f.stats.flushes, 0);
    assert.strictEqual(f.stats.lockReleases, 0, 'pre-lock schema error acquires no lock');
  }

  return { successSummary, mutationBoundaryCount, conflictFixtureCount };
}

function runFrontendCases() {
  const functionMatch = frontendSource.match(
    /function classifyBindingReconciliation_\(statusResult\) \{[\s\S]*?\n    \}/
  );
  assert.ok(functionMatch, 'reconciliation classifier must exist');
  const context = {};
  vm.createContext(context);
  vm.runInContext(functionMatch[0], context);

  assert.strictEqual(
    context.classifyBindingReconciliation_({
      success: true,
      code: 'BOUND',
      data: { bound: true, account_active: true }
    }),
    'BOUND',
    'timeout reconciliation should accept eventual BOUND'
  );
  assert.strictEqual(
    context.classifyBindingReconciliation_({
      success: true,
      code: 'UNBOUND',
      data: { bound: false, account_active: false }
    }),
    'UNBOUND',
    'timeout reconciliation should leave UNBOUND retryable'
  );

  assert.ok(
    frontendSource.includes('if (BINDING_SUBMIT_PROMISE)'),
    'repeated clicks must use a single-flight guard'
  );
  assert.strictEqual(
    (frontendSource.match(/'tenant_bind_submit'/g) || []).length,
    1,
    'reconciliation must never issue a second mutation request'
  );
  assert.ok(
    frontendSource.includes("'tenant_binding_status'"),
    'ambiguous failures must query binding status'
  );
}

const summary = runBackendCases();
runFrontendCases();
console.log('Phase 83A.1 fixture tests: PASS');
console.log('Phase 83A.1 mutation boundaries: ' + summary.mutationBoundaryCount);
console.log('Phase 83A.1 conflict fixtures: ' + summary.conflictFixtureCount);
console.log('Phase 83A.1 duplicate BOUND logs: 0');
console.log('Phase 83A.1 fixture metrics: ' + JSON.stringify(summary.successSummary));
