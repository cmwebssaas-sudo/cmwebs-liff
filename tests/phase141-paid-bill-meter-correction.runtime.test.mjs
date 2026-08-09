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

function assertSettlementScopesBillBeforeViewSync(sourcePath) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const accessAt = source.indexOf('const billingAccess =');
  const scopeAt = source.indexOf(
    'billingBillMatchesAccessScope_(bill, billingAccess)',
    accessAt
  );
  const syncAt = source.indexOf('billingSyncBillViews_(', accessAt);

  assert.notEqual(
    accessAt,
    -1,
    `${sourcePath} must resolve the authenticated billing access scope`
  );
  assert.ok(
    scopeAt > accessAt && scopeAt < syncAt,
    `${sourcePath} must scope the bill through billingBillMatchesAccessScope_ before synchronising views`
  );
}

assertPaidBillViewSyncBeforeFlush(
  'apps-script/V2_PAYMENT_SETTLEMENT.js',
  'updateSettlementRowByObjectVerified_(\n      billSheet,'
);

assertPaidBillViewSyncBeforeFlush(
  'apps-script/V2_MANUAL_SETTLEMENT.js',
  'manualSettlementUpdateRowByObjectVerified_(\n      billSheet,'
);

assertSettlementScopesBillBeforeViewSync(
  'apps-script/V2_PAYMENT_SETTLEMENT.js'
);

assertSettlementScopesBillBeforeViewSync(
  'apps-script/V2_MANUAL_SETTLEMENT.js'
);

for (const [sourcePath, helperName] of [
  ['apps-script/V2_PAYMENT_SETTLEMENT.js', 'updateSettlementRowByObjectVerified_'],
  ['apps-script/V2_MANUAL_SETTLEMENT.js', 'manualSettlementUpdateRowByObjectVerified_']
]) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const helperAt = source.indexOf(`function ${helperName}(`);
  const helperEnd = source.indexOf('\n\nfunction ', helperAt + 1);
  const helperSource = source.slice(
    helperAt,
    helperEnd === -1 ? source.length : helperEnd
  );

  assert.notEqual(helperAt, -1, `${sourcePath} must expose ${helperName}`);
  assert.match(
    helperSource,
    /setValues\(\[nextRow\]\)/,
    `${helperName} must perform one whole-row write`
  );
  assert.match(
    helperSource,
    /SETTLEMENT_ROW_WRITE_UNVERIFIED/,
    `${helperName} must reject an unverified row state`
  );
}

function extractSettlementHelper(sourcePath, helperName, dependencies = '') {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const helperAt = source.indexOf(`function ${helperName}(`);
  const helperEnd = source.indexOf('\n\nfunction ', helperAt + 1);

  assert.notEqual(helperAt, -1, `${sourcePath} must expose ${helperName}`);

  return `${dependencies}\n${source.slice(
    helperAt,
    helperEnd === -1 ? source.length : helperEnd
  )}`;
}

function createVerifiedRowSheet({
  headers,
  row,
  afterWriteReadback,
  failOnRowRead = 1
}) {
  const state = { headers: [...headers], row: [...row], readCount: 0 };

  return {
    state,
    getLastColumn() { return state.headers.length; },
    getLastRow() { return state.row.length ? 2 : 1; },
    getRange(rowIndex, columnIndex, _numRows, numColumns) {
      const start = columnIndex - 1;
      const read = () => {
        if (rowIndex === 1) return state.headers.slice(start, start + numColumns);
        state.readCount += 1;
        if (afterWriteReadback && state.readCount >= failOnRowRead) {
          return afterWriteReadback(state.row.slice(start, start + numColumns));
        }
        return state.row.slice(start, start + numColumns);
      };

      return {
        getValues() { return [read()]; },
        setValues(values) {
          const next = values[0];
          next.forEach((value, index) => { state.row[start + index] = value; });
        }
      };
    }
  };
}

for (const [sourcePath, helperName, dependencies] of [
  [
    'apps-script/V2_PAYMENT_SETTLEMENT.js',
    'updateSettlementRowByObjectVerified_',
    extractSettlementHelper(
      'apps-script/V2_PAYMENT_SETTLEMENT.js',
      'settlementRowValueMatches_'
    )
  ],
  [
    'apps-script/V2_MANUAL_SETTLEMENT.js',
    'manualSettlementUpdateRowByObjectVerified_',
    extractSettlementHelper(
      'apps-script/V2_MANUAL_SETTLEMENT.js',
      'manualSettlementRowValueMatches_',
      'function manualSettlementText_(value) { return value == null ? \'\' : String(value).trim(); }'
    )
  ]
]) {
  const context = {};
  vm.runInNewContext(
    extractSettlementHelper(sourcePath, helperName, dependencies),
    context
  );

  const successfulSheet = createVerifiedRowSheet({
    headers: ['payment_id', 'status', 'note'],
    row: ['PAY-3', 'confirmed', 'original']
  });
  const verified = context[helperName](
    successfulSheet,
    2,
    { status: 'void' }
  );

  assert.equal(
    verified.payment_id,
    'PAY-3',
    `${helperName} must return a verified row object rather than an array`
  );

  const sheet = createVerifiedRowSheet({
    headers: ['payment_id', 'status', 'note'],
    row: ['PAY-3', 'confirmed', 'original'],
    afterWriteReadback(row) {
      return [row[0], 'confirmed', row[2]];
    },
    failOnRowRead: 2
  });

  assert.throws(
    () => context[helperName](sheet, 2, { status: 'void' }),
    /SETTLEMENT_ROW_WRITE_UNVERIFIED/,
    `${helperName} must execute its real post-write read-back before accepting a payment void`
  );
  assert.equal(
    sheet.state.row[1],
    'void',
    `${helperName} test must simulate the real write occurring before the failed read-back`
  );
}

for (const [sourcePath, helperName, dependencies] of [
  [
    'apps-script/V2_PAYMENT_SETTLEMENT.js',
    'appendSettlementObjectRowVerified_',
    extractSettlementHelper(
      'apps-script/V2_PAYMENT_SETTLEMENT.js',
      'settlementRowValueMatches_'
    )
  ],
  [
    'apps-script/V2_MANUAL_SETTLEMENT.js',
    'manualSettlementAppendObjectRowVerified_',
    extractSettlementHelper(
      'apps-script/V2_MANUAL_SETTLEMENT.js',
      'manualSettlementRowValueMatches_',
      'function manualSettlementText_(value) { return value == null ? \'\' : String(value).trim(); }'
    )
  ]
]) {
  const context = {};
  vm.runInNewContext(
    extractSettlementHelper(sourcePath, helperName, dependencies),
    context
  );

  const sheet = createVerifiedRowSheet({
    headers: ['payment_id', 'status', 'note'],
    row: []
  });
  const appended = context[helperName](sheet, {
    payment_id: 'PAY-1', status: 'confirmed', note: 'test'
  });

  assert.equal(appended.rowIndex, 2, `${helperName} must return its deterministic row index`);
  assert.equal(appended.object.payment_id, 'PAY-1');
  assert.equal(sheet.state.row[0], 'PAY-1');

  const readbackFailingSheet = createVerifiedRowSheet({
    headers: ['payment_id', 'status', 'note'],
    row: [],
    afterWriteReadback(row) {
      return ['', row[1], row[2]];
    }
  });

  assert.throws(
    () => context[helperName](readbackFailingSheet, {
      payment_id: 'PAY-2', status: 'confirmed', note: 'test'
    }),
    (error) => error.message === 'SETTLEMENT_ROW_WRITE_UNVERIFIED' && error.settlementRowIndex === 2,
    `${helperName} must expose the deterministic row index when post-write read-back is unverified`
  );
}

function scopeFixtureMatchesBill(bill, access) {
  const text = (value) => String(value || '').trim().toUpperCase();
  const billWorkspaceId = text(bill.workspace_id);
  const workspaceId = text(access.workspace.workspace_id);

  if (billWorkspaceId) {
    return billWorkspaceId === workspaceId;
  }

  const billLandlordId = text(bill.landlord_id);
  return Boolean(billLandlordId) && access.principals.some(
    (principal) => text(principal.landlord_id) === billLandlordId
  );
}

function createPaymentSettlementScopeRuntime({
  bill,
  access,
  existingPayment = true,
  forceSyncFailure = false,
  forcePreflightFailure = false,
  forcePaymentAppendFailure = false,
  forcePaymentAppendIdentityMismatch = false,
  forcePaymentVoidFailure = false,
  forcePaymentReadbackFailure = false,
  forceBillRestoreFailure = false
}) {
  const source = fs.readFileSync(
    'apps-script/V2_PAYMENT_SETTLEMENT.js',
    'utf8'
  );
  const start = source.indexOf(
    'function settleLandlordPaymentReportByLineUid_('
  );
  const end = source.indexOf(
    'function ensureSettlementPaymentSheet_(', start
  );
  const writes = [];
  const syncCalls = [];
  const scopeCalls = [];
  const ensureCalls = [];
  let downstreamCalls = 0;
  const report = {
    report_id: 'REPORT-1',
    landlord_line_user_id: 'owner-line-id',
    status: bill.payment_id ? 'confirmed' : 'pending',
    matched_payment_id: bill.payment_id || '',
    bill_id: bill.bill_id,
    landlord_id: bill.landlord_id,
    tenant_id: bill.tenant_id,
    reported_amount: bill.total_amount
  };
  const sheets = {
    V2_payment_reports: { row: report },
    V2_bills: { row: bill },
    V2_payments: { row: null }
  };
  const context = {
    V2_PAYMENT_REPORT_SHEET_NAME: 'V2_payment_reports',
    V2_BILL_SHEET_NAME: 'V2_bills',
    LockService: {
      getScriptLock() {
        return { tryLock() { return true; }, releaseLock() {} };
      }
    },
    runtimeSpreadsheet_() {
      return { getSheetByName(name) { return sheets[name] || null; } };
    },
    ensureSettlementPaymentReportSheet_() {
      ensureCalls.push('report');
      return sheets.V2_payment_reports;
    },
    ensureSettlementBillSheet_() {
      ensureCalls.push('bill');
      return sheets.V2_bills;
    },
    ensureSettlementPaymentSheet_() {
      ensureCalls.push('payment');
      return sheets.V2_payments;
    },
    findSettlementRowByHeader_(sheet, header, value) {
      if (
        forcePaymentReadbackFailure &&
        sheet === sheets.V2_payments
      ) {
        throw new Error('forced payment readback failure');
      }
      if (
        sheet === sheets.V2_payments &&
        (!sheet.row || sheet.row[header] !== value)
      ) {
        return null;
      }
      return { rowIndex: 2, object: sheet.row };
    },
    v2CanonicalBillIsVoided_() { return false; },
    workspaceLandlordResolveAccess_() { return access; },
    billingBillMatchesAccessScope_(candidate, candidateAccess) {
      scopeCalls.push({ candidate, candidateAccess });
      return scopeFixtureMatchesBill(candidate, candidateAccess);
    },
    findExistingSettlementPayment_() {
      downstreamCalls += 1;
      return existingPayment ? { payment_id: 'EXISTING-1' } : null;
    },
    makeSettlementPaymentId_() { return 'PAY-NEW-1'; },
    normalizeSettlementDate_() { return new Date('2026-08-09T00:00:00Z'); },
    appendSettlementNote_(_current, appended) { return appended; },
    appendSettlementObjectRow_(sheet, object) {
      writes.push('append');
      sheet.row = { ...object };
      return 2;
    },
    appendSettlementObjectRowVerified_(sheet, object) {
      writes.push('verified-append');
      sheet.row = { ...object };
      if (forcePaymentAppendIdentityMismatch) {
        sheet.row.payment_id = 'PAY-CORRUPTED';
      }
      if (forcePaymentAppendFailure) {
        const error = new Error('forced payment append readback failure');
        error.settlementRowIndex = 2;
        throw error;
      }
      return { rowIndex: 2, object: sheet.row };
    },
    updateSettlementRowByObject_(sheet, _rowIndex, updates) {
      if (
        forceBillRestoreFailure &&
        sheet === sheets.V2_bills &&
        updates.payment_status === 'unpaid'
      ) {
        sheet.row.payment_status = updates.payment_status;
        throw new Error('forced bill restore failure');
      }
      if (
        forcePaymentVoidFailure &&
        sheet === sheets.V2_payments &&
        updates.status === 'void'
      ) {
        if (
          forcePaymentVoidFailure === 'after_status' ||
          forcePaymentVoidFailure === 'readback'
        ) {
          sheet.row.status = 'void';
        }
        throw new Error('forced payment void failure');
      }
      writes.push('update');
      Object.assign(sheet.row, updates);
    },
    updateSettlementRowByObjectVerified_(sheet, _rowIndex, updates) {
      if (
        forceBillRestoreFailure &&
        sheet === sheets.V2_bills &&
        updates.payment_status === 'unpaid'
      ) {
        sheet.row.payment_status = updates.payment_status;
        throw new Error('forced bill restore failure');
      }
      if (
        forcePaymentVoidFailure &&
        sheet === sheets.V2_payments &&
        updates.status === 'void'
      ) {
        if (
          forcePaymentVoidFailure === 'after_status' ||
          forcePaymentVoidFailure === 'readback'
        ) {
          sheet.row.status = 'void';
        }
        throw new Error('forced payment void failure');
      }
      writes.push('verified-update');
      Object.assign(sheet.row, updates);
    },
    billingPreflightBillViews_() {
      if (forcePreflightFailure) throw new Error('forced view preflight failure');
    },
    billingSyncBillViews_() {
      syncCalls.push(true);
      if (forceSyncFailure) throw new Error('forced view sync failure');
    },
    logLiffAccess_() {}
  };

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  vm.runInNewContext(source.slice(start, end), context);
  return {
    settle() {
      return context.settleLandlordPaymentReportByLineUid_(
        'owner-line-id',
        'REPORT-1',
        ''
      );
    },
    writes,
    syncCalls,
    scopeCalls,
    ensureCalls,
    sheets,
    get downstreamCalls() { return downstreamCalls; }
  };
}

function createManualSettlementScopeRuntime({
  bill,
  access,
  existingPayment = true,
  forceSyncFailure = false,
  forcePreflightFailure = false,
  forcePaymentAppendFailure = false,
  forcePaymentAppendIdentityMismatch = false,
  forcePaymentVoidFailure = false,
  forcePaymentReadbackFailure = false,
  forceBillRestoreFailure = false
}) {
  const source = fs.readFileSync(
    'apps-script/V2_MANUAL_SETTLEMENT.js',
    'utf8'
  );
  const start = source.indexOf(
    'function manualSettleLandlordBillByLineUid_('
  );
  const end = source.indexOf(
    'function manualSettlementEnsureBillSheet_(', start
  );
  const writes = [];
  const syncCalls = [];
  const scopeCalls = [];
  const ensureCalls = [];
  let downstreamCalls = 0;
  const sheets = {
    V2_bills: { row: bill },
    V2_payments: { row: null }
  };
  const context = {
    MANUAL_SETTLEMENT_BILLS_SHEET: 'V2_bills',
    LockService: {
      getScriptLock() {
        return { tryLock() { return true; }, releaseLock() {} };
      }
    },
    manualSettlementText_(value) {
      return value == null ? '' : String(value).trim();
    },
    manualSettlementBoolean_() { return false; },
    manualSettlementParseDate_() { return new Date('2026-08-09T00:00:00Z'); },
    runtimeSpreadsheet_() {
      return { getSheetByName(name) { return sheets[name] || null; } };
    },
    manualSettlementEnsureBillSheet_() {
      ensureCalls.push('bill');
      return sheets.V2_bills;
    },
    manualSettlementEnsurePaymentSheet_() {
      ensureCalls.push('payment');
      return sheets.V2_payments;
    },
    manualSettlementEnsureAuditSheet_() { ensureCalls.push('audit'); },
    manualSettlementFindRowByHeader_(sheet, header, value) {
      if (
        forcePaymentReadbackFailure &&
        sheet === sheets.V2_payments
      ) {
        throw new Error('forced payment readback failure');
      }
      if (
        sheet === sheets.V2_payments &&
        (!sheet.row || sheet.row[header] !== value)
      ) {
        return null;
      }
      return { rowIndex: 2, object: sheet.row };
    },
    v2CanonicalBillIsVoided_() { return false; },
    manualSettlementResolveLandlord_() {
      return { landlord_id: String(bill.landlord_id || '').trim() };
    },
    workspaceLandlordResolveAccess_() { return access; },
    billingBillMatchesAccessScope_(candidate, candidateAccess) {
      scopeCalls.push({ candidate, candidateAccess });
      return scopeFixtureMatchesBill(candidate, candidateAccess);
    },
    manualSettlementFindExistingPayment_() {
      downstreamCalls += 1;
      return existingPayment ? { payment_id: 'EXISTING-1' } : null;
    },
    manualSettlementMakePaymentId_() { return 'PAY-MANUAL-1'; },
    manualSettlementResolveTenant_() { return null; },
    manualSettlementConfirmationSourceText_() { return '私訊'; },
    manualSettlementAppendNote_(_current, appended) { return appended; },
    manualSettlementAppendObjectRow_(sheet, object) {
      writes.push('append');
      sheet.row = { ...object };
      return 2;
    },
    manualSettlementAppendObjectRowVerified_(sheet, object) {
      writes.push('verified-append');
      sheet.row = { ...object };
      if (forcePaymentAppendIdentityMismatch) {
        sheet.row.payment_id = 'PAY-CORRUPTED';
      }
      if (forcePaymentAppendFailure) {
        const error = new Error('forced payment append readback failure');
        error.settlementRowIndex = 2;
        throw error;
      }
      return { rowIndex: 2, object: sheet.row };
    },
    manualSettlementUpdateRowByObject_(sheet, _rowIndex, updates) {
      if (
        forceBillRestoreFailure &&
        sheet === sheets.V2_bills &&
        updates.payment_status === 'unpaid'
      ) {
        Object.assign(sheet.row, updates);
        throw new Error('forced bill restore failure');
      }
      if (
        forcePaymentVoidFailure &&
        sheet === sheets.V2_payments &&
        updates.status === 'void'
      ) {
        if (forcePaymentVoidFailure === 'after_status') {
          sheet.row.status = 'void';
        }
        throw new Error('forced payment void failure');
      }
      writes.push('update');
      Object.assign(sheet.row, updates);
    },
    manualSettlementUpdateRowByObjectVerified_(sheet, _rowIndex, updates) {
      if (
        forceBillRestoreFailure &&
        sheet === sheets.V2_bills &&
        updates.payment_status === 'unpaid'
      ) {
        Object.assign(sheet.row, updates);
        throw new Error('forced bill restore failure');
      }
      if (
        forcePaymentVoidFailure &&
        sheet === sheets.V2_payments &&
        updates.status === 'void'
      ) {
        if (forcePaymentVoidFailure === 'after_status') {
          sheet.row.status = 'void';
        }
        throw new Error('forced payment void failure');
      }
      writes.push('verified-update');
      Object.assign(sheet.row, updates);
    },
    billingPreflightBillViews_() {
      if (forcePreflightFailure) throw new Error('forced view preflight failure');
    },
    billingSyncBillViews_() {
      syncCalls.push(true);
      if (forceSyncFailure) throw new Error('forced view sync failure');
    },
    manualSettlementWriteAuditLog_() {},
    logLiffAccess_() {}
  };

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  vm.runInNewContext(source.slice(start, end), context);
  return {
    settle() {
      return context.manualSettleLandlordBillByLineUid_(
        'owner-line-id',
        bill.bill_id,
        '2026-08-09',
        'bank_transfer',
        bill.total_amount,
        '',
        'private_message',
        '',
        false
      );
    },
    writes,
    syncCalls,
    scopeCalls,
    ensureCalls,
    sheets,
    get downstreamCalls() { return downstreamCalls; }
  };
}

function assertSettlementScopeGate(runtimeFactory) {
  const access = {
    success: true,
    workspace: { workspace_id: 'W-current' },
    principals: [{ landlord_id: 'legacy-owner' }]
  };
  const crossWorkspaceRuntime = runtimeFactory({
    bill: {
      bill_id: 'B-cross-workspace',
      workspace_id: 'W-other',
      landlord_id: 'legacy-owner',
      tenant_id: 'T-1',
      payment_status: 'unpaid',
      total_amount: 100
    },
    access
  });
  const crossWorkspaceResult = crossWorkspaceRuntime.settle();

  assert.equal(crossWorkspaceResult.code, 'BILL_WORKSPACE_MISMATCH');
  assert.equal(crossWorkspaceRuntime.scopeCalls.length, 1);
  assert.equal(crossWorkspaceRuntime.downstreamCalls, 0);
  assert.deepEqual(
    crossWorkspaceRuntime.ensureCalls,
    [],
    'cross-Workspace rejection must happen before every schema-mutating ensure helper'
  );
  assert.deepEqual(crossWorkspaceRuntime.writes, []);
  assert.deepEqual(crossWorkspaceRuntime.syncCalls, []);

  const terminalCrossWorkspaceRuntime = runtimeFactory({
    bill: {
      bill_id: 'B-cross-workspace-paid',
      workspace_id: 'W-other',
      landlord_id: 'legacy-owner',
      tenant_id: 'T-1',
      payment_status: 'paid',
      payment_id: 'PAY-SECRET',
      total_amount: 100
    },
    access
  });
  const terminalCrossWorkspaceResult = terminalCrossWorkspaceRuntime.settle();

  assert.equal(terminalCrossWorkspaceResult.code, 'BILL_WORKSPACE_MISMATCH');
  assert.deepEqual(terminalCrossWorkspaceRuntime.ensureCalls, []);

  const legacyRuntime = runtimeFactory({
    bill: {
      bill_id: 'B-legacy',
      workspace_id: '',
      landlord_id: ' LEGACY-OWNER ',
      tenant_id: 'T-1',
      payment_status: 'unpaid',
      total_amount: 100
    },
    access
  });
  const legacyResult = legacyRuntime.settle();

  assert.match(
    legacyResult.code,
    /^PAYMENT(?:_RECORD)?_ALREADY_EXISTS$/,
    'an authorized legacy bill must pass the scope gate into the downstream payment check'
  );
  assert.equal(legacyRuntime.scopeCalls.length, 1);
  assert.equal(legacyRuntime.downstreamCalls, 1);
  assert.deepEqual(legacyRuntime.writes, []);
  assert.deepEqual(legacyRuntime.syncCalls, []);
}

assertSettlementScopeGate(createPaymentSettlementScopeRuntime);
assertSettlementScopeGate(createManualSettlementScopeRuntime);

for (const runtimeFactory of [
  createPaymentSettlementScopeRuntime,
  createManualSettlementScopeRuntime
]) {
  const bill = {
    bill_id: 'B-append-identity-mismatch',
    workspace_id: 'W-current',
    landlord_id: 'legacy-owner',
    tenant_id: 'T-1',
    payment_status: 'unpaid',
    payment_id: '',
    paid_at: '',
    updated_at: 'before',
    notes: 'original note',
    total_amount: 100
  };
  const runtime = runtimeFactory({
    bill,
    access: {
      success: true,
      workspace: { workspace_id: 'W-current' },
      principals: [{ landlord_id: 'legacy-owner' }]
    },
    existingPayment: false,
    forcePaymentAppendFailure: true,
    forcePaymentAppendIdentityMismatch: true
  });

  const result = runtime.settle();

  assert.equal(result.success, false);
  assert.equal(
    result.code,
    'SETTLEMENT_COMPENSATION_UNVERIFIED',
    'an append whose deterministic row cannot be matched by payment ID must fail explicitly rather than claim a generic retryable error'
  );
  assert.equal(runtime.sheets.V2_payments.row.status, 'confirmed');
  assert.equal(bill.payment_status, 'unpaid');
}

for (const runtimeFactory of [
  createPaymentSettlementScopeRuntime,
  createManualSettlementScopeRuntime
]) {
  const bill = {
    bill_id: 'B-sync-failure',
    workspace_id: 'W-current',
    landlord_id: 'legacy-owner',
    tenant_id: 'T-1',
    payment_status: 'unpaid',
    payment_id: '',
    paid_at: '',
    updated_at: 'before',
    notes: 'original note',
    total_amount: 100
  };
  const runtime = runtimeFactory({
    bill,
    access: {
      success: true,
      workspace: { workspace_id: 'W-current' },
      principals: [{ landlord_id: 'legacy-owner' }]
    },
    existingPayment: false,
    forceSyncFailure: true
  });

  const result = runtime.settle();

  assert.equal(result.success, false);
  assert.match(result.code, /^(?:SETTLEMENT_ERROR|MANUAL_SETTLEMENT_ERROR)$/);
  assert.equal(runtime.sheets.V2_payments.row.status, 'void');
  assert.equal(bill.payment_status, 'unpaid');
  assert.equal(bill.payment_id, '');
  assert.equal(bill.paid_at, '');
  assert.equal(bill.updated_at, 'before');
  assert.equal(bill.notes, 'original note');
}

for (const runtimeFactory of [
  createPaymentSettlementScopeRuntime,
  createManualSettlementScopeRuntime
]) {
  const bill = {
    bill_id: 'B-preflight-failure',
    workspace_id: 'W-current',
    landlord_id: 'legacy-owner',
    tenant_id: 'T-1',
    payment_status: 'unpaid',
    payment_id: '',
    paid_at: '',
    updated_at: 'before',
    notes: 'original note',
    total_amount: 100
  };
  const runtime = runtimeFactory({
    bill,
    access: {
      success: true,
      workspace: { workspace_id: 'W-current' },
      principals: [{ landlord_id: 'legacy-owner' }]
    },
    existingPayment: false,
    forcePreflightFailure: true,
    forceSyncFailure: true
  });

  const result = runtime.settle();

  assert.equal(result.success, false);
  assert.equal(runtime.sheets.V2_payments.row, null);
  assert.equal(bill.payment_status, 'unpaid');
  assert.equal(bill.payment_id, '');
  assert.equal(bill.updated_at, 'before');
  assert.equal(bill.notes, 'original note');
}

for (const runtimeFactory of [
  createPaymentSettlementScopeRuntime,
  createManualSettlementScopeRuntime
]) {
  const bill = {
    bill_id: 'B-append-readback-failure',
    workspace_id: 'W-current',
    landlord_id: 'legacy-owner',
    tenant_id: 'T-1',
    payment_status: 'unpaid',
    payment_id: '',
    paid_at: '',
    updated_at: 'before',
    notes: 'original note',
    total_amount: 100
  };
  const runtime = runtimeFactory({
    bill,
    access: {
      success: true,
      workspace: { workspace_id: 'W-current' },
      principals: [{ landlord_id: 'legacy-owner' }]
    },
    existingPayment: false,
    forcePaymentAppendFailure: true
  });

  const result = runtime.settle();

  assert.equal(result.success, false);
  assert.equal(result.code, 'SETTLEMENT_COMPENSATION_UNVERIFIED');
  assert.equal(
    runtime.sheets.V2_payments.row.status,
    'void',
    'a payment appended before its read-back failure must be voided rather than orphaned'
  );
  assert.equal(bill.payment_status, 'unpaid');
  assert.equal(bill.payment_id, '');
}

for (const runtimeFactory of [
  createPaymentSettlementScopeRuntime,
  createManualSettlementScopeRuntime
]) {
  const bill = {
    bill_id: 'B-compensation-fallback',
    workspace_id: 'W-current',
    landlord_id: 'legacy-owner',
    tenant_id: 'T-1',
    payment_status: 'unpaid',
    payment_id: '',
    paid_at: '',
    updated_at: 'before',
    notes: 'original note',
    total_amount: 100
  };
  const runtime = runtimeFactory({
    bill,
    access: {
      success: true,
      workspace: { workspace_id: 'W-current' },
      principals: [{ landlord_id: 'legacy-owner' }]
    },
    existingPayment: false,
    forceSyncFailure: true,
    forcePaymentVoidFailure: true
  });

  const result = runtime.settle();

  assert.equal(result.success, false);
  assert.equal(result.code, 'SETTLEMENT_COMPENSATION_UNVERIFIED');
  assert.equal(runtime.sheets.V2_payments.row.status, 'confirmed');
  assert.equal(bill.payment_status, 'unpaid');
  assert.equal(bill.payment_id, '');
}

for (const runtimeFactory of [
  createPaymentSettlementScopeRuntime,
  createManualSettlementScopeRuntime
]) {
  const bill = {
    bill_id: 'B-partial-void-compensation',
    workspace_id: 'W-current',
    landlord_id: 'legacy-owner',
    tenant_id: 'T-1',
    payment_status: 'unpaid',
    payment_id: '',
    paid_at: '',
    updated_at: 'before',
    notes: 'original note',
    total_amount: 100
  };
  const runtime = runtimeFactory({
    bill,
    access: {
      success: true,
      workspace: { workspace_id: 'W-current' },
      principals: [{ landlord_id: 'legacy-owner' }]
    },
    existingPayment: false,
    forceSyncFailure: true,
    forcePaymentVoidFailure: 'after_status'
  });

  const result = runtime.settle();

  assert.equal(result.success, false);
  assert.equal(runtime.sheets.V2_payments.row.status, 'void');
  assert.equal(bill.payment_status, 'unpaid');
  assert.equal(bill.payment_id, '');
}

for (const [label, options] of [
  ['payment void partial write', {
    forcePaymentVoidFailure: 'after_status'
  }],
  ['payment void readback failure', {
    forcePaymentVoidFailure: 'readback',
    forcePaymentReadbackFailure: true
  }],
  ['bill restore partial write', {
    forceBillRestoreFailure: true
  }]
]) {
  for (const runtimeFactory of [
    createPaymentSettlementScopeRuntime,
    createManualSettlementScopeRuntime
  ]) {
    const bill = {
      bill_id: `B-unverified-${label}`,
      workspace_id: 'W-current',
      landlord_id: 'legacy-owner',
      tenant_id: 'T-1',
      payment_status: 'unpaid',
      payment_id: '',
      paid_at: '',
      updated_at: 'before',
      notes: 'original note',
      total_amount: 100
    };
    const runtime = runtimeFactory({
      bill,
      access: {
        success: true,
        workspace: { workspace_id: 'W-current' },
        principals: [{ landlord_id: 'legacy-owner' }]
      },
      existingPayment: false,
      forceSyncFailure: true,
      ...options
    });

    const result = runtime.settle();

    assert.equal(
      result.code,
      'SETTLEMENT_COMPENSATION_UNVERIFIED',
      `${label} must not return a generic settlement failure after an unverified compensation state`
    );
  }
}

{
  const source = fs.readFileSync(
    'apps-script/V2_BILLING_MANAGEMENT.js',
    'utf8'
  );
  const start = source.indexOf(
    'function billingBillMatchesAccessScope_('
  );
  const end = source.indexOf(
    '\n\nfunction billingGetWorkspaceRows_(',
    start
  );

  assert.notEqual(
    start,
    -1,
    'bill scope predicate must exist'
  );
  assert.notEqual(
    end,
    -1,
    'bill scope predicate must precede workspace bill rows'
  );

  const context = {
    billingText_(value) {
      return value == null ? '' : String(value).trim();
    }
  };

  vm.runInNewContext(source.slice(start, end), context);

  const access = {
    workspace: { workspace_id: 'W-current' },
    principals: [
      { landlord_id: 'legacy-owner' }
    ]
  };

  assert.equal(
    context.billingBillMatchesAccessScope_(
      { workspace_id: 'w-CURRENT', landlord_id: 'other-owner' },
      access
    ),
    true,
    'current Workspace bill must match regardless of legacy landlord'
  );
  assert.equal(
    context.billingBillMatchesAccessScope_(
      { workspace_id: 'W-other', landlord_id: 'legacy-owner' },
      access
    ),
    false,
    'Workspace bill must not fall back to a legacy principal'
  );
  assert.equal(
    context.billingBillMatchesAccessScope_(
      { workspace_id: '', landlord_id: ' LEGACY-OWNER ' },
      access
    ),
    true,
    'legacy bill must match a normalized authenticated principal'
  );
  assert.equal(
    context.billingBillMatchesAccessScope_(
      { workspace_id: '', landlord_id: 'other-owner' },
      access
    ),
    false,
    'legacy bill without an authenticated principal must not match'
  );
}

{
  const source = fs.readFileSync(
    'apps-script/V2_BILLING_MANAGEMENT.js',
    'utf8'
  );
  const start = source.indexOf(
    'function billingBillMatchesAccessScope_('
  );
  const end = source.indexOf(
    '\n\nfunction billingGetWorkspaceRoomRows_(',
    start
  );

  assert.notEqual(start, -1);
  assert.notEqual(
    end,
    -1,
    'generic Workspace row helper must precede room rows'
  );

  const context = {
    V2_BILLING_SHEETS_: {
      bills: 'V2_bills'
    },
    billingText_(value) {
      return value == null ? '' : String(value).trim();
    },
    workspaceGetObjectsWithRow_(sheet) {
      return sheet.rows;
    }
  };

  vm.runInNewContext(source.slice(start, end), context);

  const access = {
    workspace: { workspace_id: 'W-current' },
    principals: [
      { landlord_id: 'legacy-owner' }
    ]
  };
  const row = {
    workspace_id: '',
    landlord_id: 'LEGACY-OWNER'
  };
  const scopedRows = function (sheetName) {
    return context.billingGetWorkspaceRows_(
      {
        getName() { return sheetName; },
        rows: [row]
      },
      access
    );
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(scopedRows('V2_properties'))),
    [],
    'generic Workspace row helper must retain legacy landlord case semantics'
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(scopedRows('V2_bills'))),
    [row],
    'V2_bills must use the normalized canonical bill scope predicate'
  );
}

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

function createBillViewSyncRuntime({ bills, billViews, tenantHomes, landlordTenants }) {
  const source = fs.readFileSync(
    'apps-script/V2_BILLING_MANAGEMENT.js',
    'utf8'
  );
  const start = source.indexOf('function billingSelectLatestTenantBill_(');
  const end = source.indexOf('\n\nfunction billingRefreshWorkspaceSummaries_(', start);

  assert.notEqual(start, -1, 'latest tenant-bill selector must exist');
  assert.notEqual(end, -1, 'view sync section must precede workspace summaries');

  const sheets = {
    V2_bills: { name: 'V2_bills', rows: bills },
    V2_tenant_bill_view: { name: 'V2_tenant_bill_view', rows: billViews },
    V2_tenant_home_view: { name: 'V2_tenant_home_view', rows: tenantHomes },
    V2_landlord_tenant_list_view: {
      name: 'V2_landlord_tenant_list_view',
      rows: landlordTenants
    }
  };
  const context = {
    V2_BILLING_SHEETS_: {
      bills: 'V2_bills',
      tenantBillView: 'V2_tenant_bill_view',
      tenantHomeView: 'V2_tenant_home_view',
      landlordTenantListView: 'V2_landlord_tenant_list_view'
    },
    billingText_(value) { return value == null ? '' : String(value).trim(); },
    billingNumber_(value) { return Number(value) || 0; },
    billingNormalizeBillMonth_(value) {
      const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
      return match ? value : '';
    },
    billingNormalizePaymentStatus_(value) {
      return String(value).toLowerCase() === 'paid' ? 'paid' : 'unpaid';
    },
    v2CanonicalBillIsVoided_(bill) {
      return ['void', 'voided', 'cancelled', 'canceled'].includes(
        String(bill.bill_status || '').toLowerCase()
      );
    },
    billingGetWorkspaceRows_(sheet) { return sheet.rows; },
    workspaceGetObjectsWithRow_(sheet) { return sheet.rows; },
    billingSetValues_(sheet, rowNumber, values) {
      const row = sheet.rows.find((item) => item.__row_number === rowNumber);
      assert.ok(row, 'view update target must exist');
      Object.assign(row, values);
    },
    billingUpsertById_(sheet, idHeader, idValue, values) {
      const row = sheet.rows.find((item) => item[idHeader] === idValue);
      assert.ok(row, 'exact bill view must exist for this harness');
      Object.assign(row, values);
    },
    billingFindByTenantId_: null
  };

  vm.runInNewContext(source.slice(start, end), context);
  const findStart = source.indexOf('function billingFindByTenantId_(');
  const findEnd = source.indexOf(
    '\n\n// ==================================================\n// Workspace data helpers',
    findStart
  );
  assert.notEqual(findStart, -1, 'tenant projection selector must exist');
  assert.notEqual(findEnd, -1, 'tenant projection selector must be bounded');
  vm.runInNewContext(source.slice(findStart, findEnd), context);
  return { sheets, sync: context.billingSyncBillViews_, select: context.billingSelectLatestTenantBill_ };
}

{
  const julyPaid = paidBill({
    bill_id: 'B-506-2026-07',
    bill_month: '2026-07',
    total_amount: 7000,
    due_date: '2026-07-05',
    tenant_id: 'T-506',
    __row_number: 12
  });
  const august = paidBill({
    bill_id: 'B-506-2026-08',
    bill_month: '2026-08',
    total_amount: 8000,
    due_date: '2026-08-05',
    payment_status: 'unpaid',
    tenant_id: 'T-506',
    __row_number: 13
  });
  const voided = paidBill({
    bill_id: 'B-506-voided',
    bill_month: '2026-06',
    total_amount: 9000,
    payment_status: 'unpaid',
    bill_status: 'voided',
    tenant_id: 'T-506',
    __row_number: 14
  });
  const cancelled = paidBill({
    bill_id: 'B-506-cancelled',
    bill_month: '2026-05',
    total_amount: 10000,
    payment_status: 'unpaid',
    bill_status: 'cancelled',
    tenant_id: 'T-506',
    __row_number: 15
  });
  const runtime = createBillViewSyncRuntime({
    bills: [julyPaid, august, voided, cancelled],
    billViews: [billView({ ...julyPaid }), billView({ ...august })],
    tenantHomes: [{ tenant_id: 'T-506', workspace_id: 'W-1', __row_number: 22 }],
    landlordTenants: [{ tenant_id: 'T-506', workspace_id: 'W-1', __row_number: 32 }]
  });

  assert.equal(
    runtime.select([august, { ...august, bill_id: 'B-506-2026-08-later', __row_number: 99 }]).bill_id,
    'B-506-2026-08-later',
    'same normalized month must use row number as a deterministic fallback'
  );

  runtime.sync(
    { getSheetByName(name) { return runtime.sheets[name]; } },
    { workspace: { workspace_id: 'W-1' } },
    julyPaid,
    '2026-08-09T01:00:00Z'
  );

  const julyView = runtime.sheets.V2_tenant_bill_view.rows[0];
  const tenantHome = runtime.sheets.V2_tenant_home_view.rows[0];
  const landlordTenant = runtime.sheets.V2_landlord_tenant_list_view.rows[0];
  assert.equal(julyView.bill_id, 'B-506-2026-07');
  assert.equal(julyView.payment_status, 'paid');
  for (const summary of [tenantHome, landlordTenant]) {
    assert.equal(summary.latest_bill_month, '2026-08');
    assert.equal(summary.latest_total_amount, 8000);
    assert.equal(summary.latest_due_date, '2026-08-05');
    assert.equal(summary.latest_payment_status, 'unpaid');
    assert.equal(summary.unpaid_bill_count, 1);
    assert.equal(summary.unpaid_total_amount, 8000);
  }
}

for (const allowedProjectionWorkspace of ['W-current', '']) {
  const legacyBill = paidBill({
    bill_id: 'B-legacy-projection',
    workspace_id: '',
    landlord_id: 'legacy-owner',
    tenant_id: 'T-legacy',
    bill_month: '2026-08',
    payment_status: 'paid'
  });
  const tenantOther = {
    tenant_id: 'T-legacy',
    workspace_id: 'W-other',
    latest_payment_status: 'other-before',
    __row_number: 20
  };
  const tenantAllowed = {
    tenant_id: 'T-legacy',
    workspace_id: allowedProjectionWorkspace,
    latest_payment_status: 'allowed-before',
    __row_number: 21
  };
  const landlordOther = {
    tenant_id: 'T-legacy',
    workspace_id: 'W-other',
    latest_payment_status: 'other-before',
    __row_number: 30
  };
  const landlordAllowed = {
    tenant_id: 'T-legacy',
    workspace_id: allowedProjectionWorkspace,
    latest_payment_status: 'allowed-before',
    __row_number: 31
  };
  const runtime = createBillViewSyncRuntime({
    bills: [legacyBill],
    billViews: [billView({ ...legacyBill })],
    tenantHomes: [tenantOther, tenantAllowed],
    landlordTenants: [landlordOther, landlordAllowed]
  });

  runtime.sync(
    { getSheetByName(name) { return runtime.sheets[name]; } },
    { workspace: { workspace_id: 'W-current' } },
    legacyBill,
    '2026-08-09T01:00:00Z'
  );

  assert.equal(tenantOther.latest_payment_status, 'other-before');
  assert.equal(landlordOther.latest_payment_status, 'other-before');
  assert.equal(tenantAllowed.latest_payment_status, 'paid');
  assert.equal(landlordAllowed.latest_payment_status, 'paid');
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
    bills: [paidBill()],
    billViews: [billView({ payment_status: 'unpaid' })]
  });
  const result = runtime.correct('owner-line-id', correctionInput());

  assert.equal(result.success, true);
  assert.equal(result.code, 'PAID_BILL_METER_CORRECTED');
  assert.equal(
    runtime.sheets.V2_tenant_bill_view.rows[0].payment_status,
    'paid',
    'the corrected tenant bill view must retain the canonical paid state'
  );
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
