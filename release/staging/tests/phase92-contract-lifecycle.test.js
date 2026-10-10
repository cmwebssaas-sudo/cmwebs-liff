'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'apps-script', 'V2_CONTRACTS.js'),
  'utf8'
);

function sheet(headers, rows = []) {
  const values = [headers.slice(), ...rows.map(row => headers.map(h => row[h] ?? ''))];
  return {
    values,
    getLastRow: () => values.length,
    getLastColumn: () => values[0].length,
    appendRow: row => values.push(row.slice()),
    getRange(row, column, rowCount = 1, columnCount = 1) {
      return {
        getValues: () => values.slice(row - 1, row - 1 + rowCount)
          .map(item => item.slice(column - 1, column - 1 + columnCount)),
        setValues(rowsToSet) {
          rowsToSet.forEach((input, rowOffset) => {
            if (!values[row - 1 + rowOffset]) values[row - 1 + rowOffset] = [];
            input.forEach((value, columnOffset) => {
              values[row - 1 + rowOffset][column - 1 + columnOffset] = value;
            });
          });
        },
        setValue(value) {
          if (!values[row - 1]) values[row - 1] = [];
          values[row - 1][column - 1] = value;
        }
      };
    }
  };
}

const contractHeaders = [
  'contract_id', 'created_at', 'updated_at', 'workspace_id', 'landlord_id',
  'tenant_id', 'tenant_user_id', 'property_id', 'room_id', 'contract_status',
  'start_date', 'end_date', 'monthly_rent', 'deposit_amount',
  'payment_due_day', 'terms', 'note', 'created_by', 'updated_by',
  'activated_at', 'ended_at', 'terminated_at', 'cancelled_at', 'deleted_at',
  'expiry_notification_queue_id', 'expiry_notified_at',
  'renewed_from_contract_id'
];

function fixture() {
  const sheets = {
    V2_contracts: sheet(contractHeaders),
    V2_tenants: sheet(
      ['tenant_id', 'tenant_user_id', 'tenant_name', 'workspace_id', 'landlord_id'],
      [{ tenant_id: 'T92', tenant_user_id: 'UT92', tenant_name: 'Tenant 92', workspace_id: 'W92', landlord_id: 'L92' }]
    ),
    V2_properties: sheet(
      ['property_id', 'workspace_id', 'landlord_id'],
      [{ property_id: 'P92', workspace_id: 'W92', landlord_id: 'L92' }]
    ),
    V2_rooms: sheet(
      ['room_id', 'property_id', 'workspace_id'],
      [{ room_id: 'R92', property_id: 'P92', workspace_id: 'W92' }]
    )
  };
  const queued = [];
  let workspace = 'W92';
  const context = {
    console, Date, Object, isFinite,
    Utilities: {
      formatDate(value, zone, pattern) {
        const date = new Date(value);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        if (pattern === 'yyyy-MM-dd') return `${yyyy}-${mm}-${dd}`;
        return `${yyyy}${mm}${dd}120000`;
      },
      getUuid: () => '92000000-abcd'
    },
    Session: { getScriptTimeZone: () => 'Asia/Taipei' },
    runtimeEnvironment_: () => 'staging',
    runtimeRequireFeature_: () => true,
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => '30' })
    },
    runtimeSpreadsheet_: () => ({ getSheetByName: name => sheets[name] || null }),
    workspaceLandlordResolveAccess_: () => ({
      success: true,
      workspace: { workspace_id: workspace },
      user: { user_id: 'UL92' },
      principal_landlord_id: 'L92'
    }),
    workspaceGetObjectsWithRow_: input => input.values.slice(1).map((row, index) => {
      const object = { __row_number: index + 2 };
      input.values[0].forEach((header, column) => { object[header] = row[column]; });
      return object;
    }),
    workspaceAppendObject_: (input, record) => input.appendRow(
      input.values[0].map(header => record[header] === undefined ? '' : record[header])
    ),
    notificationQueueEnqueue_: options => {
      queued.push(options);
      return {
        success: true,
        code: 'NOTIFICATION_QUEUED',
        data: { queue_id: `Q92-${queued.length}`, status: 'pending' }
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    context, sheets, queued,
    setWorkspace: value => { workspace = value; }
  };
}

function createContract(f) {
  return f.context.createLandlordContractByLineUid_('Ulandlord', {
    tenant_id: 'T92', property_id: 'P92', room_id: 'R92',
    start_date: '2026-07-01', end_date: '2026-08-01',
    monthly_rent: 12000, deposit_amount: 24000, payment_due_day: 5,
    terms: 'Fixture terms'
  });
}

function testCreateAndActivate() {
  const f = fixture();
  const created = createContract(f);
  assert.strictEqual(created.success, true);
  assert.strictEqual(created.data.contract.contract_status, 'draft');
  assert.strictEqual(created.data.contract.workspace_id, 'W92');

  const activated = f.context.activateLandlordContractByLineUid_(
    'Ulandlord', created.data.contract.contract_id
  );
  assert.strictEqual(activated.success, true);
  assert.strictEqual(activated.data.contract.contract_status, 'active');
}

function testContractExpiringNotification() {
  const f = fixture();
  const created = createContract(f);
  f.context.activateLandlordContractByLineUid_(
    'Ulandlord', created.data.contract.contract_id
  );
  const result = f.context.processContractExpiryNotifications();
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.queued_count, 1);
  assert.strictEqual(f.queued.length, 1);
  assert.strictEqual(f.queued[0].event_type, 'contract_expiring');
  assert.strictEqual(f.queued[0].receiver.receiver_type, 'tenant');
  assert.strictEqual(f.queued[0].receiver.workspace_id, 'W92');
  assert.strictEqual(f.queued[0].template_key, 'contract_expiring');

  const rows = f.context.contractLifecycleRows_(f.sheets.V2_contracts);
  assert.strictEqual(rows[0].contract_status, 'expiring');
  assert.ok(rows[0].expiry_notification_queue_id);
  assert.strictEqual(
    f.context.processContractExpiryNotifications().queued_count,
    0,
    'expiry notification must be idempotent'
  );
}

function testWorkspaceIsolation() {
  const f = fixture();
  const created = createContract(f);
  f.setWorkspace('OTHER');
  const list = f.context.getLandlordContractsByLineUid_('Uother', '');
  assert.strictEqual(list.success, true);
  assert.strictEqual(list.data.contracts.length, 0);
  const update = f.context.activateLandlordContractByLineUid_(
    'Uother', created.data.contract.contract_id
  );
  assert.strictEqual(update.success, false);
  assert.strictEqual(update.code, 'CONTRACT_NOT_FOUND');
}

function testNoDirectLineTransport() {
  assert.ok(!/UrlFetchApp\s*\./.test(source));
  assert.ok(!/pushLineTextMessage_\s*\(/.test(source));
  assert.ok(source.includes('notificationQueueEnqueue_'));
  assert.ok(source.includes("runtimeRequireFeature_('LEASE_LIFECYCLE')"));
  assert.ok(source.includes('runtimeRequireSchemaMigration_()'));
}

testCreateAndActivate();
testContractExpiringNotification();
testWorkspaceIsolation();
testNoDirectLineTransport();

console.log('Phase 92 contract lifecycle tests: PASS');
