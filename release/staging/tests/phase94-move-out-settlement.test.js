'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appsDir = path.join(__dirname, '..', 'apps-script');
const sourceNames = [
  'V2_CONTRACTS.js',
  'V2_MOVE_OUT_REQUESTS.js',
  'V2_SETTLEMENT_TRANSACTION.js',
  'V2_DEPOSIT_SETTLEMENTS.js'
];
const sources = sourceNames.map(name => fs.readFileSync(path.join(appsDir, name), 'utf8'));

function sheet(headers, rows = []) {
  const values = [headers.slice(), ...rows.map(row => headers.map(h => row[h] ?? ''))];
  return {
    values,
    getName: () => 'fixture',
    getLastRow: () => values.length,
    getLastColumn: () => values[0].length,
    appendRow: row => values.push(row.slice()),
    deleteRow: row => values.splice(row - 1, 1),
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

function rows(input) {
  return input.values.slice(1).map((row, index) => {
    const object = { __row_number: index + 2 };
    input.values[0].forEach((header, column) => { object[header] = row[column]; });
    return object;
  });
}

const requestHeaders = [
  'request_id', 'created_at', 'updated_at', 'workspace_id', 'landlord_id',
  'tenant_id', 'tenant_user_id', 'tenant_name', 'contract_id', 'property_id',
  'room_id', 'room_no', 'requested_move_out_date', 'reason',
  'forwarding_address', 'status', 'inspection_scheduled_at',
  'inspection_completed_at', 'inspection_note', 'settlement_id', 'created_by',
  'updated_by', 'move_out_requested_queue_id', 'inspection_scheduled_queue_id',
  'deposit_settlement_ready_queue_id', 'deposit_refunded_queue_id',
  'contract_terminated_queue_id'
];

const settlementHeaders = [
  'settlement_id', 'idempotency_key', 'request_id', 'created_at', 'updated_at', 'workspace_id',
  'landlord_id', 'tenant_id', 'tenant_user_id', 'tenant_name', 'contract_id',
  'property_id', 'room_id', 'deposit_amount', 'unpaid_bill_amount',
  'repair_cost_amount', 'total_deductions', 'refund_amount',
  'tenant_balance_due', 'unpaid_bill_ids_json', 'repair_items_json', 'status',
  'ready_at', 'refunded_at', 'refund_method', 'refund_reference',
  'confirmed_by', 'inspection_note', 'created_by', 'updated_by'
];

function fixture() {
  const repairHeaders = [
    'ticket_id', 'created_at', 'updated_at', 'workspace_id', 'landlord_id',
    'tenant_id', 'tenant_user_id', 'tenant_name', 'contract_id', 'property_id',
    'room_id', 'room_no', 'status', 'settlement_chargeable', 'settlement_cost',
    'settlement_note', 'deposit_settlement_id', 'updated_by'
  ];
  const sheets = {
    V2_MOVE_OUT_REQUESTS: sheet(requestHeaders),
    V2_DEPOSIT_SETTLEMENTS: sheet(settlementHeaders),
    V2_contracts: sheet(
      [
        'contract_id', 'workspace_id', 'landlord_id', 'tenant_id',
        'tenant_user_id', 'property_id', 'room_id', 'contract_status',
        'start_date', 'end_date', 'monthly_rent', 'deposit_amount',
        'payment_due_day', 'note', 'updated_at', 'updated_by', 'terminated_at'
      ],
      [{
        contract_id: 'C94', workspace_id: 'W94', landlord_id: 'L94',
        tenant_id: 'T94', tenant_user_id: 'TU94', property_id: 'P94',
        room_id: 'R94', contract_status: 'active', start_date: '2026-01-01',
        end_date: '2027-01-01', monthly_rent: 12000, deposit_amount: 30000,
        payment_due_day: 5
      }]
    ),
    V2_bills: sheet(
      [
        'bill_id', 'workspace_id', 'tenant_id', 'contract_id',
        'total_amount', 'bill_status', 'payment_status'
      ],
      [
        {
          bill_id: 'B94-UNPAID', workspace_id: 'W94', tenant_id: 'T94',
          contract_id: 'C94', total_amount: 2000, bill_status: 'issued',
          payment_status: 'unpaid'
        },
        {
          bill_id: 'B94-PAID', workspace_id: 'W94', tenant_id: 'T94',
          contract_id: 'C94', total_amount: 1000, bill_status: 'paid',
          payment_status: 'paid'
        }
      ]
    ),
    V2_REPAIR_TICKETS: sheet(
      repairHeaders,
      [{
        ticket_id: 'R94', workspace_id: 'W94', landlord_id: 'L94',
        tenant_id: 'T94', tenant_user_id: 'TU94', tenant_name: 'Tenant 94',
        contract_id: 'C94', property_id: 'P94', room_id: 'R94', room_no: '94A',
        status: 'completed'
      }]
    ),
    V2_SETTLEMENT_LEDGER: sheet([
      'ledger_id', 'idempotency_key', 'operation', 'status', 'created_at',
      'updated_at', 'workspace_id', 'actor_user_id', 'request_id',
      'settlement_id', 'before_json', 'result_json', 'error_code',
      'error_message', 'committed_at', 'rolled_back_at'
    ])
  };
  let workspace = 'W94';
  const queued = [];
  let uuidCounter = 0;
  const context = {
    console, Date, Object, JSON, Math, isFinite, isNaN,
    Utilities: {
      formatDate(value, zone, pattern) {
        const date = new Date(value);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        if (pattern === 'yyyy-MM-dd') return `${yyyy}-${mm}-${dd}`;
        if (pattern === 'yyyyMMddHHmmss') return `${yyyy}${mm}${dd}120000`;
        return `${yyyy}-${mm}-${dd}T12:00:00+08:00`;
      },
      getUuid: () => `9400000${++uuidCounter}-abcd`
    },
    Session: { getScriptTimeZone: () => 'Asia/Taipei' },
    runtimeEnvironment_: () => 'staging',
    runtimeRequireFeature_: () => true,
    runtimeSpreadsheet_: () => ({ getSheetByName: name => sheets[name] || null }),
    SpreadsheetApp: { flush() {} },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock() {} })
    },
    workspaceGetObjectsWithRow_: rows,
    workspaceAppendObject_: (input, record) => input.appendRow(
      input.values[0].map(header => record[header] === undefined ? '' : record[header])
    ),
    workspaceLandlordResolveAccess_: () => ({
      success: true,
      workspace: { workspace_id: workspace },
      user: { user_id: 'UL94' },
      principal_landlord_id: 'L94'
    }),
    resolveCanonicalTenantRuntimeByLineUid_: () => ({
      success: true,
      data: {
        workspace_id: 'W94', landlord_id: 'L94', tenant_id: 'T94',
        tenant_user_id: 'TU94', tenant_name: 'Tenant 94', contract_id: 'C94',
        property_id: 'P94', room_id: 'R94', room_no: '94A',
        landlord_tenant_link_row: {}
      }
    }),
    tenantMessageResolveLandlordRecipient_: () => ({
      workspace_id: 'W94', landlord_id: 'L94', landlord_line_user_id: 'Ulandlord94'
    }),
    notificationQueueEnqueue_: options => {
      queued.push(options);
      return {
        success: true,
        code: 'NOTIFICATION_QUEUED',
        data: { queue_id: `Q94-${queued.length}`, status: 'pending' }
      };
    }
  };
  vm.createContext(context);
  sources.forEach(source => vm.runInContext(source, context));
  return {
    context, sheets, queued,
    setWorkspace: value => { workspace = value; }
  };
}

function createAndSchedule(f) {
  const created = f.context.createTenantMoveOutRequestByLineUid_(
    'Utenant94', '2026-08-31', '租約期滿', 'Test forwarding address'
  );
  assert.strictEqual(created.success, true);
  assert.strictEqual(created.data.request.status, 'requested');
  const scheduled = f.context.scheduleLandlordMoveOutInspectionByLineUid_(
    'Ulandlord94', created.data.request.request_id,
    '2026-08-30T10:00:00+08:00', 'Inspection fixture'
  );
  assert.strictEqual(scheduled.success, true);
  assert.strictEqual(scheduled.data.request.status, 'inspection_scheduled');
  return scheduled.data.request;
}

function testMoveOutSettlementAndRefund() {
  const f = fixture();
  const request = createAndSchedule(f);
  const completed = f.context.completeLandlordMoveOutInspectionByLineUid_(
    'Ulandlord94',
    request.request_id,
    [{ ticket_id: 'R94', amount: 5000, note: 'Repair deduction' }],
    'Inspection completed',
    'phase94-prepare-0001'
  );
  assert.strictEqual(completed.success, true);
  assert.strictEqual(completed.data.settlement.deposit_amount, 30000);
  assert.strictEqual(completed.data.settlement.unpaid_bill_amount, 2000);
  assert.strictEqual(completed.data.settlement.repair_cost_amount, 5000);
  assert.strictEqual(completed.data.settlement.refund_amount, 23000);
  assert.strictEqual(completed.data.settlement.tenant_balance_due, 0);

  const repaired = rows(f.sheets.V2_REPAIR_TICKETS)[0];
  assert.strictEqual(Number(repaired.settlement_cost), 5000);
  assert.strictEqual(repaired.deposit_settlement_id, completed.data.settlement.settlement_id);

  const refunded = f.context.confirmLandlordDepositRefundByLineUid_(
    'Ulandlord94', completed.data.settlement.settlement_id,
    'bank_transfer', 'STAGING-REF-94', 'phase94-refund-0001'
  );
  assert.strictEqual(refunded.success, true);
  assert.strictEqual(refunded.data.settlement.status, 'refunded');
  assert.strictEqual(refunded.data.request.status, 'completed');
  assert.strictEqual(rows(f.sheets.V2_contracts)[0].contract_status, 'terminated');
  const replay = f.context.confirmLandlordDepositRefundByLineUid_(
    'Ulandlord94', completed.data.settlement.settlement_id,
    'bank_transfer', 'STAGING-REF-94', 'phase94-refund-0001'
  );
  assert.strictEqual(replay.success, true);
  assert.strictEqual(replay.idempotent_replay, true);
  assert.deepStrictEqual(
    f.queued.map(item => item.event_type),
    [
      'move_out_requested',
      'inspection_scheduled',
      'deposit_settlement_ready',
      'deposit_refunded',
      'contract_terminated'
    ]
  );
}

function testWorkspaceIsolation() {
  const f = fixture();
  const request = createAndSchedule(f);
  f.setWorkspace('OTHER');
  const list = f.context.getLandlordMoveOutRequestsByLineUid_('Uother', '');
  assert.strictEqual(list.success, true);
  assert.strictEqual(list.data.requests.length, 0);
  const complete = f.context.completeLandlordMoveOutInspectionByLineUid_(
    'Uother', request.request_id, [], 'Blocked', 'phase94-other-0001'
  );
  assert.strictEqual(complete.success, false);
  assert.strictEqual(complete.code, 'MOVE_OUT_REQUEST_NOT_FOUND');
}

function testInvalidRepairDeduction() {
  const f = fixture();
  const request = createAndSchedule(f);
  const result = f.context.completeLandlordMoveOutInspectionByLineUid_(
    'Ulandlord94', request.request_id,
    [{ ticket_id: 'OTHER', amount: 5000 }], 'Blocked', 'phase94-invalid-0001'
  );
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.code, 'REPAIR_TICKET_NOT_FOUND');
  assert.strictEqual(rows(f.sheets.V2_DEPOSIT_SETTLEMENTS).length, 0);
}

function testTransactionRollbackProtection() {
  const f = fixture();
  const request = createAndSchedule(f);
  f.context.notificationQueueEnqueue_ = () => {
    throw new Error('fixture notification failure');
  };
  const result = f.context.completeLandlordMoveOutInspectionByLineUid_(
    'Ulandlord94', request.request_id,
    [{ ticket_id: 'R94', amount: 5000 }],
    'Rollback fixture', 'phase94-rollback-0001'
  );
  assert.strictEqual(result.success, false);
  assert.strictEqual(rows(f.sheets.V2_DEPOSIT_SETTLEMENTS).length, 0);
  assert.strictEqual(rows(f.sheets.V2_MOVE_OUT_REQUESTS)[0].status, 'inspection_scheduled');
  assert.strictEqual(rows(f.sheets.V2_REPAIR_TICKETS)[0].deposit_settlement_id, '');
  assert.strictEqual(rows(f.sheets.V2_SETTLEMENT_LEDGER)[0].status, 'rolled_back');
}

function testLedgerSchemaValidation() {
  const f = fixture();
  const result = f.context.settlementTransactionValidateLedger_(
    f.sheets.V2_SETTLEMENT_LEDGER
  );
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.missing_headers.length, 0);
  assert.strictEqual(result.duplicate_key_count, 0);
  assert.strictEqual(result.rollback_protection_ready, true);
}

function testQueueOnlyTransport() {
  const lifecycleSource = sources[1] + sources[3];
  assert.ok(!/UrlFetchApp\s*\./.test(lifecycleSource));
  assert.ok(!/pushLineTextMessage_\s*\(/.test(lifecycleSource));
  assert.ok(lifecycleSource.includes('notificationQueueEnqueue_'));
}

testMoveOutSettlementAndRefund();
testWorkspaceIsolation();
testInvalidRepairDeduction();
testTransactionRollbackProtection();
testLedgerSchemaValidation();
testQueueOnlyTransport();

console.log('Phase 94 move-out and deposit settlement tests: PASS');
