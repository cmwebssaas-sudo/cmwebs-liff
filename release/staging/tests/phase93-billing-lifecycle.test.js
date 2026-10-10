'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appsDir = path.join(__dirname, '..', 'apps-script');
const sources = [
  'V2_BILLS.js',
  'V2_PAYMENTS.js',
  'V2_API.js'
].map(name => fs.readFileSync(path.join(appsDir, name), 'utf8'));

function sheet(headers, rows = []) {
  const values = [headers.slice(), ...rows.map(row => headers.map(h => row[h] ?? ''))];
  return {
    values,
    getName: () => 'fixture',
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

const billHeaders = [
  'bill_id', 'created_at', 'updated_at', 'workspace_id', 'landlord_id',
  'tenant_id', 'tenant_user_id', 'user_id', 'tenant_line_user_id',
  'tenant_name', 'contract_id', 'property_id', 'room_id', 'room_name',
  'bill_month', 'due_date', 'rent_amount', 'management_fee',
  'electricity_amount', 'equipment_amount', 'other_amount', 'discount_amount',
  'total_amount', 'bill_status', 'payment_status', 'issued_at', 'paid_at',
  'payment_id', 'created_by', 'updated_by', 'bill_created_queue_id',
  'payment_due_queue_id', 'payment_overdue_queue_id', 'notes'
];

const paymentHeaders = [
  'payment_id', 'created_at', 'updated_at', 'workspace_id', 'landlord_id',
  'tenant_id', 'tenant_user_id', 'user_id', 'contract_id', 'property_id',
  'room_id', 'bill_id', 'bill_month', 'payment_date', 'amount',
  'payment_method', 'bank_last5', 'status', 'source', 'source_ref_id',
  'confirmation_source', 'confirmed_at', 'confirmed_by', 'rejected_at',
  'rejection_reason', 'note', 'payment_confirmed_queue_id'
];

function rows(input) {
  return input.values.slice(1).map((row, index) => {
    const object = { __row_number: index + 2 };
    input.values[0].forEach((header, column) => { object[header] = row[column]; });
    return object;
  });
}

function fixture() {
  const sheets = {
    V2_bills: sheet(billHeaders),
    V2_payments: sheet(paymentHeaders),
    V2_contracts: sheet(
      [
        'contract_id', 'workspace_id', 'landlord_id', 'tenant_id',
        'tenant_user_id', 'property_id', 'room_id', 'contract_status',
        'start_date', 'end_date', 'monthly_rent', 'payment_due_day'
      ],
      [{
        contract_id: 'C93', workspace_id: 'W93', landlord_id: 'L93',
        tenant_id: 'T93', tenant_user_id: 'TU93', property_id: 'P93',
        room_id: 'R93', contract_status: 'active', start_date: '2026-01-01',
        end_date: '2027-12-31', monthly_rent: 13000, payment_due_day: 5
      }]
    ),
    V2_tenants: sheet(
      [
        'tenant_id', 'tenant_user_id', 'tenant_name', 'tenant_line_user_id',
        'workspace_id', 'landlord_id', 'account_status'
      ],
      [{
        tenant_id: 'T93', tenant_user_id: 'TU93', tenant_name: 'Tenant 93',
        tenant_line_user_id: 'Utenant93', workspace_id: 'W93',
        landlord_id: 'L93', account_status: 'active'
      }]
    ),
    V2_rooms: sheet(
      ['room_id', 'property_id', 'workspace_id', 'room_no'],
      [{ room_id: 'R93', property_id: 'P93', workspace_id: 'W93', room_no: '93A' }]
    ),
    V2_tenant_bill_view: sheet(['bill_id', 'tenant_id', 'workspace_id'])
  };
  let workspace = 'W93';
  const queued = [];
  let uuidCounter = 0;
  const lock = {
    tryLock: () => true,
    releaseLock: () => {}
  };
  const context = {
    console, Date, Object, JSON, Math, isFinite,
    Utilities: {
      formatDate(value, zone, pattern) {
        const date = new Date(value);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        if (pattern === 'yyyy-MM') return `${yyyy}-${mm}`;
        if (pattern === 'yyyy-MM-dd') return `${yyyy}-${mm}-${dd}`;
        if (pattern === 'yyyyMMddHHmmss') return `${yyyy}${mm}${dd}120000`;
        return `${yyyy}-${mm}-${dd}T12:00:00+08:00`;
      },
      getUuid: () => `9300000${++uuidCounter}-abcd`
    },
    Session: { getScriptTimeZone: () => 'Asia/Taipei' },
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: { flush: () => {} },
    runtimeEnvironment_: () => 'staging',
    runtimeRequireFeature_: () => true,
    runtimeSpreadsheet_: () => ({
      getSheetByName: name => sheets[name] || null,
      insertSheet(name) {
        sheets[name] = sheet([]);
        return sheets[name];
      }
    }),
    workspaceLandlordResolveAccess_: () => ({
      success: true,
      workspace: { workspace_id: workspace },
      user: { user_id: 'UL93' },
      principal_landlord_id: 'L93'
    }),
    workspaceGetObjectsWithRow_: rows,
    workspaceAppendObject_: (input, record) => input.appendRow(
      input.values[0].map(header => record[header] === undefined ? '' : record[header])
    ),
    notificationQueueEnqueue_: options => {
      queued.push(options);
      return {
        success: true,
        code: 'NOTIFICATION_QUEUED',
        data: { queue_id: `Q93-${queued.length}`, status: 'pending' }
      };
    },
    runtimeSnapshotGetValues_: input => input.values,
    runtimeSnapshotFinish_: () => {},
    logLiffAccess_: () => {}
  };
  vm.createContext(context);
  sources.forEach(source => vm.runInContext(source, context));
  return {
    context, sheets, queued,
    setWorkspace: value => { workspace = value; }
  };
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function createBill(f, dueDay) {
  return f.context.generateContractMonthlyBillByLineUid_(
    'Ulandlord93',
    'C93',
    currentMonth(),
    { payment_due_day: dueDay || 5 }
  );
}

function testCreateAndTenantView() {
  const f = fixture();
  const created = createBill(f);
  assert.strictEqual(created.success, true);
  assert.strictEqual(created.data.bill.bill_status, 'issued');
  assert.strictEqual(created.data.bill.payment_status, 'unpaid');
  assert.strictEqual(created.data.bill.total_amount, 13000);
  assert.strictEqual(f.queued[0].event_type, 'bill_created');

  const tenantPayload = f.context.getTenantBillsRuntimePayloadByLineUid_('Utenant93');
  assert.strictEqual(tenantPayload.success, true);
  assert.strictEqual(tenantPayload.count, 1);
  assert.strictEqual(tenantPayload.bills[0].bill_id, created.data.bill.bill_id);
  assert.strictEqual(tenantPayload.bills[0].total_amount, 13000);
}

function testLandlordConfirmPayment() {
  const f = fixture();
  const created = createBill(f);
  const confirmed = f.context.confirmLandlordBillPaymentByLineUid_(
    'Ulandlord93',
    created.data.bill.bill_id,
    { amount: 13000, payment_method: 'bank_transfer', payment_date: new Date() }
  );
  assert.strictEqual(confirmed.success, true);
  assert.strictEqual(confirmed.data.bill.bill_status, 'paid');
  assert.strictEqual(confirmed.data.bill.payment_status, 'paid');
  assert.strictEqual(confirmed.data.payment.status, 'confirmed');
  assert.strictEqual(f.queued[1].event_type, 'payment_confirmed');
  assert.strictEqual(rows(f.sheets.V2_payments).length, 1);

  const duplicate = f.context.confirmLandlordBillPaymentByLineUid_(
    'Ulandlord93', created.data.bill.bill_id, { amount: 13000 }
  );
  assert.strictEqual(duplicate.success, true);
  assert.strictEqual(duplicate.code, 'PAYMENT_ALREADY_CONFIRMED');
  assert.strictEqual(rows(f.sheets.V2_payments).length, 1);
}

function testDueAndOverdueQueue() {
  const f = fixture();
  const now = new Date();
  const created = createBill(f, now.getDate());
  const due = f.context.processBillingLifecycleNotifications();
  assert.strictEqual(due.success, true);
  assert.ok(f.queued.some(item => item.event_type === 'payment_due'));

  const yesterday = new Date(now.getTime() - 86400000);
  const bill = rows(f.sheets.V2_bills)[0];
  f.context.billingLifecycleUpdate_(f.sheets.V2_bills, bill.__row_number, {
    due_date: yesterday,
    payment_overdue_queue_id: ''
  });
  const overdue = f.context.processBillingLifecycleNotifications();
  assert.strictEqual(overdue.success, true);
  assert.ok(f.queued.some(item => item.event_type === 'payment_overdue'));
  assert.strictEqual(rows(f.sheets.V2_bills)[0].bill_status, 'overdue');
}

function testWorkspaceIsolation() {
  const f = fixture();
  const created = createBill(f);
  f.setWorkspace('OTHER');
  const list = f.context.getLandlordBillingLifecycleByLineUid_(
    'Uother', currentMonth(), ''
  );
  assert.strictEqual(list.success, true);
  assert.strictEqual(list.data.bill_count, 0);
  const confirm = f.context.confirmLandlordBillPaymentByLineUid_(
    'Uother', created.data.bill.bill_id, { amount: 13000 }
  );
  assert.strictEqual(confirm.success, false);
  assert.strictEqual(confirm.code, 'BILL_NOT_FOUND');
}

function testQueueOnlyTransport() {
  const lifecycleSource = sources[0] + sources[1];
  assert.ok(!/UrlFetchApp\s*\./.test(lifecycleSource));
  assert.ok(!/pushLineTextMessage_\s*\(/.test(lifecycleSource));
  assert.ok(lifecycleSource.includes('notificationQueueEnqueue_'));
}

testCreateAndTenantView();
testLandlordConfirmPayment();
testDueAndOverdueQueue();
testWorkspaceIsolation();
testQueueOnlyTransport();

console.log('Phase 93 billing lifecycle tests: PASS');
