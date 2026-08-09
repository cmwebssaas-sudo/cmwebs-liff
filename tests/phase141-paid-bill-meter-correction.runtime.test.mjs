import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function assertPaidBillViewSyncBeforeFlush(sourcePath, updateMarker) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const updateAt = source.indexOf(updateMarker);
  const flushAt = source.indexOf('SpreadsheetApp.flush()', updateAt);
  const syncAt = source.indexOf('billingSyncBillViews_(', updateAt);

  assert.notEqual(updateAt, -1, `${sourcePath} must update the formal bill`);
  assert.notEqual(flushAt, -1, `${sourcePath} must flush the settlement`);
  assert.ok(
    syncAt > updateAt && syncAt < flushAt,
    `${sourcePath} must synchronise the tenant bill view after payment settlement and before flush`
  );
}

assertPaidBillViewSyncBeforeFlush(
  'apps-script/V2_PAYMENT_SETTLEMENT.js',
  'updateSettlementRowByObject_(\n      billSheet,'
);

assertPaidBillViewSyncBeforeFlush(
  'apps-script/V2_MANUAL_SETTLEMENT.js',
  'manualSettlementUpdateRowByObject_(\n      billSheet,'
);

function createRuntime({ bills, billViews }) {
  const writes = [];
  const audits = [];
  let schemaEnsures = 0;
  const source = fs.readFileSync(
    'apps-script/V2_BILLING_MANAGEMENT.js',
    'utf8'
  );
  const start = source.indexOf(
    'function repairPaidBillMeterCorrectionByLineUid_('
  );
  const end = source.indexOf(
    '\n\nfunction testDiagnoseBillingPreviousMeters()',
    start
  );

  assert.notEqual(
    start,
    -1,
    'single paid-bill correction helper must exist'
  );
  assert.notEqual(
    end,
    -1,
    'billing diagnostics must follow the correction helper'
  );

  const sheets = {
    V2_bills: { name: 'V2_bills', rows: bills },
    V2_tenant_bill_view: {
      name: 'V2_tenant_bill_view',
      rows: billViews
    }
  };
  const context = {
    Date,
    Error,
    Math,
    Object,
    JSON,
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} })
    },
    SpreadsheetApp: { flush() {} },
    runtimeSpreadsheet_() {
      return { getSheetByName: (name) => sheets[name] };
    },
    billingEnsureSchema_() { schemaEnsures += 1; },
    workspaceLandlordResolveAccess_() {
      return {
        success: true,
        workspace: { workspace_id: 'W-1' },
        membership: { role: 'owner', membership_id: 'WM-1' },
        user: { user_id: 'U-1', name: 'Owner' },
        principals: []
      };
    },
    billingRequireGenerate_() { return { success: true }; },
    billingText_(value) { return value == null ? '' : String(value); },
    billingNumber_(value) { return Number(value) || 0; },
    billingNormalizeBillMonth_(value) {
      return value === '2026-08' ? value : '';
    },
    billingNormalizePaymentStatus_(value) {
      return String(value).toLowerCase() === 'paid' ? 'paid' : 'unpaid';
    },
    billingIsPaidStatus_(value) {
      return String(value).toLowerCase() === 'paid';
    },
    V2_BILLING_SHEETS_: {
      bills: 'V2_bills',
      tenantBillView: 'V2_tenant_bill_view'
    },
    billingGetWorkspaceRows_(sheet) { return sheet.rows; },
    workspaceGetObjectsWithRow_(sheet) { return sheet.rows; },
    billingSetValues_(sheet, rowNumber, values) {
      const row = sheet.rows.find((item) => item.__row_number === rowNumber);
      assert.ok(row, 'write target must exist');
      Object.assign(row, values);
      writes.push({ sheet: sheet.name, rowNumber, values });
    },
    billingAudit_(_access, action, result, meta) {
      audits.push({ action, result, meta });
    },
    workspaceResult_(success, code, message, data) {
      return { success, code, message, data };
    }
  };

  vm.runInNewContext(source.slice(start, end), context);
  return {
    correct: context.repairPaidBillMeterCorrectionByLineUid_,
    preflight: context.repairPaidBillMeterCorrectionByLineUid_,
    writes,
    audits,
    schemaEnsures() { return schemaEnsures; },
    sheets
  };
}

{
  const runtime = createRuntime({
    bills: [paidBill()],
    billViews: [billView()]
  });
  const result = runtime.preflight(
    'owner-line-id',
    correctionInput({ dry_run: true })
  );

  assert.equal(result.success, true);
  assert.equal(result.code, 'PAID_BILL_METER_CORRECTION_READY');
  assert.equal(result.data.previous_meter, 23310.8);
  assert.equal(result.data.corrected_previous_meter, 24815.5);
  assert.equal(result.data.recomputed_total, 7745);
  assert.equal(runtime.writes.length, 0);
  assert.equal(runtime.audits.length, 0);
  assert.equal(runtime.schemaEnsures(), 0);
}

{
  const runtime = createRuntime({
    bills: [paidBill()],
    billViews: [billView({ payment_status: 'unpaid' })]
  });
  const result = runtime.preflight(
    'owner-line-id',
    correctionInput({ dry_run: true })
  );

  assert.equal(result.success, true);
  assert.equal(result.code, 'PAID_BILL_METER_CORRECTION_READY');
  assert.equal(result.data.view_payment_status, 'unpaid');
  assert.equal(result.data.view_payment_status_mismatch, true);
  assert.equal(runtime.writes.length, 0);
  assert.equal(runtime.audits.length, 0);
}

function correctionInput(overrides = {}) {
  return {
    expected_bill_id: 'B-506-2026-08',
    room_name: '506',
    bill_month: '2026-08',
    expected_previous_meter_before: 23310.8,
    corrected_previous_meter: 24815.5,
    expected_current_meter: 24853.3,
    expected_total_amount: 7745,
    reason: 'Production meter baseline correction',
    ...overrides
  };
}

function paidBill(overrides = {}) {
  return {
    bill_id: 'B-506-2026-08',
    workspace_id: 'W-1',
    room_name: '506',
    bill_month: '2026-08',
    payment_status: 'paid',
    previous_meter: 23310.8,
    current_meter_reading: 24853.3,
    electricity_fee_rate: 3,
    equipment_fee_rate: 3.5,
    rent_amount: 7500,
    management_fee: 0,
    other_amount: 0,
    discount_amount: 0,
    total_amount: 17636,
    paid_at: '2026-08-09T00:00:00Z',
    payment_id: 'P-506',
    __row_number: 2,
    ...overrides
  };
}

function billView(overrides = {}) {
  return { ...paidBill(), __row_number: 2, ...overrides };
}

{
  const runtime = createRuntime({
    bills: [paidBill()],
    billViews: [billView()]
  });
  const result = runtime.correct('owner-line-id', correctionInput());

  assert.equal(result.success, true);
  assert.equal(result.code, 'PAID_BILL_METER_CORRECTED');
  assert.equal(runtime.writes.length, 2);
  assert.deepEqual(
    runtime.writes.map((write) => write.sheet).sort(),
    ['V2_bills', 'V2_tenant_bill_view']
  );
  for (const row of [
    runtime.sheets.V2_bills.rows[0],
    runtime.sheets.V2_tenant_bill_view.rows[0]
  ]) {
    assert.equal(row.previous_meter, 24815.5);
    assert.equal(row.current_meter_reading, 24853.3);
    assert.equal(row.electricity_usage, 37.8);
    assert.equal(row.electricity_amount, 113);
    assert.equal(row.equipment_amount, 132);
    assert.equal(row.total_amount, 7745);
    assert.equal(row.payment_status, 'paid');
    assert.equal(row.paid_at, '2026-08-09T00:00:00Z');
    assert.equal(row.payment_id, 'P-506');
  }
  assert.equal(runtime.audits.length, 1);
  assert.equal(runtime.schemaEnsures(), 1);
}

{
  const runtime = createRuntime({
    bills: [paidBill({ rent_amount: 7400 })],
    billViews: [billView()]
  });
  const result = runtime.correct('owner-line-id', correctionInput());

  assert.equal(result.success, false);
  assert.equal(result.code, 'PAID_BILL_TOTAL_MISMATCH');
  assert.equal(runtime.writes.length, 0);
}

{
  const runtime = createRuntime({
    bills: [paidBill()],
    billViews: [billView()]
  });
  const result = runtime.correct(
    'owner-line-id',
    correctionInput({ expected_bill_id: 'B-OTHER' })
  );

  assert.equal(result.success, false);
  assert.equal(result.code, 'PAID_BILL_TARGET_NOT_UNIQUE');
  assert.equal(runtime.writes.length, 0);
}

{
  const runtime = createRuntime({
    bills: [paidBill()],
    billViews: [billView({ workspace_id: 'W-OTHER' })]
  });
  const result = runtime.correct('owner-line-id', correctionInput());

  assert.equal(result.success, false);
  assert.equal(result.code, 'PAID_BILL_VIEW_NOT_FOUND');
  assert.equal(runtime.writes.length, 0);
}

{
  const runtime = createRuntime({
    bills: [paidBill({ payment_status: 'unpaid' })],
    billViews: [billView()]
  });
  const result = runtime.correct('owner-line-id', correctionInput());

  assert.equal(result.success, false);
  assert.equal(result.code, 'PAID_BILL_NOT_PAID');
  assert.equal(runtime.writes.length, 0);
}

{
  const runtime = createRuntime({
    bills: [paidBill()],
    billViews: [billView()]
  });
  const result = runtime.correct(
    'owner-line-id',
    correctionInput({ expected_previous_meter_before: 0 })
  );

  assert.equal(result.success, false);
  assert.equal(result.code, 'INVALID_PAID_BILL_CORRECTION');
  assert.equal(runtime.writes.length, 0);
}

{
  const source = fs.readFileSync(
    'apps-script/V2_BILLING_MANAGEMENT.js',
    'utf8'
  );
  const start = source.indexOf(
    'function repairApprovedRoom506AugustPaidBill_()'
  );
  const end = source.indexOf(
    '\n\nfunction testDiagnoseBillingPreviousMeters()',
    start
  );

  assert.notEqual(
    start,
    -1,
    'approved room-506 one-time entry point must exist'
  );
  assert.notEqual(end, -1);

  let received = null;
  const context = {
    getRequiredScriptProperty_(name) {
      assert.equal(name, 'TEST_LANDLORD_LINE_UID');
      return 'owner-line-id';
    },
    repairPaidBillMeterCorrectionByLineUid_(lineUserId, correction) {
      received = { lineUserId, correction };
      return { success: true };
    }
  };

  vm.runInNewContext(source.slice(start, end), context);
  assert.deepEqual(
    context.repairApprovedRoom506AugustPaidBill_(),
    { success: true }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(received)), {
    lineUserId: 'owner-line-id',
    correction: {
      expected_bill_id: 'B0000016',
      room_name: '506',
      bill_month: '2026-08',
      expected_previous_meter_before: 23310.8,
      corrected_previous_meter: 24815.5,
      expected_current_meter: 24853.3,
      expected_total_amount: 7745,
      reason: '506 房 2026-08 已付款帳單上期電表基準更正'
    }
  });
}

{
  const source = fs.readFileSync(
    'apps-script/V2_BILLING_MANAGEMENT.js',
    'utf8'
  );
  const start = source.indexOf(
    'function testRepairApprovedRoom506AugustPaidBill()'
  );
  const end = source.indexOf(
    '\n\nfunction testDiagnoseBillingPreviousMeters()',
    start
  );

  assert.notEqual(
    start,
    -1,
    'Apps Script executable entry point must use the test prefix'
  );
  assert.notEqual(end, -1);

  let called = 0;
  const context = {
    repairApprovedRoom506AugustPaidBill_() {
      called += 1;
      return { success: true, code: 'PAID_BILL_METER_CORRECTED' };
    }
  };

  vm.runInNewContext(source.slice(start, end), context);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        context.testRepairApprovedRoom506AugustPaidBill()
      )
    ),
    { success: true, code: 'PAID_BILL_METER_CORRECTED' }
  );
  assert.equal(called, 1);
}

{
  const source = fs.readFileSync(
    'apps-script/V2_BILLING_MANAGEMENT.js',
    'utf8'
  );
  const start = source.indexOf(
    'function preflightApprovedRoom506AugustPaidBillCorrection_()'
  );
  const end = source.indexOf(
    '\n\nfunction testDiagnoseBillingPreviousMeters()',
    start
  );

  assert.notEqual(
    start,
    -1,
    'the approved 506 correction needs a read-only preflight entry point'
  );
  assert.notEqual(end, -1);

  let received = null;
  const context = {
    getRequiredScriptProperty_(name) {
      assert.equal(name, 'TEST_LANDLORD_LINE_UID');
      return 'owner-line-id';
    },
    repairPaidBillMeterCorrectionByLineUid_(lineUserId, correction) {
      received = { lineUserId, correction };
      return { success: false, code: 'PAID_BILL_TOTAL_MISMATCH' };
    }
  };

  vm.runInNewContext(source.slice(start, end), context);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        context.preflightApprovedRoom506AugustPaidBillCorrection_()
      )
    ),
    { success: false, code: 'PAID_BILL_TOTAL_MISMATCH' }
  );
  assert.equal(received.lineUserId, 'owner-line-id');
  assert.equal(received.correction.room_name, '506');
  assert.equal(received.correction.expected_total_amount, 7745);
  assert.equal(received.correction.dry_run, true);
}

{
  const source = fs.readFileSync(
    'apps-script/V2_BILLING_MANAGEMENT.js',
    'utf8'
  );
  const start = source.indexOf(
    'function testPreflightApprovedRoom506AugustPaidBillCorrection()'
  );
  const end = source.indexOf(
    '\n\nfunction testDiagnoseBillingPreviousMeters()',
    start
  );

  assert.notEqual(
    start,
    -1,
    'Apps Script must expose a test-prefixed read-only preflight runner'
  );
  assert.notEqual(end, -1);

  let called = 0;
  let logged = null;
  const context = {
    Logger: {
      log(value) { logged = value; }
    },
    preflightApprovedRoom506AugustPaidBillCorrection_() {
      called += 1;
      return { success: false, code: 'PAID_BILL_TOTAL_MISMATCH' };
    }
  };

  vm.runInNewContext(source.slice(start, end), context);
  const result =
    context.testPreflightApprovedRoom506AugustPaidBillCorrection();

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { success: false, code: 'PAID_BILL_TOTAL_MISMATCH' }
  );
  assert.equal(called, 1);
  assert.deepEqual(
    JSON.parse(logged),
    { success: false, code: 'PAID_BILL_TOTAL_MISMATCH' }
  );
}
