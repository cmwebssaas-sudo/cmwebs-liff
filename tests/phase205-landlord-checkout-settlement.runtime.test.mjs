import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const initiatedSource = readFileSync(
  new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url),
  'utf8'
);
const documentsSource = readFileSync(
  new URL('../apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js', import.meta.url),
  'utf8'
);
const checkoutSource = readFileSync(
  new URL('../apps-script/V2_CONTRACT_CHECKOUT.js', import.meta.url),
  'utf8'
);

const context = {
  Date, Math, Number, String, Object, Array, JSON, RegExp, console
};
vm.createContext(context);
vm.runInContext(checkoutSource, context, { filename: 'V2_CONTRACT_CHECKOUT.js' });

function rowFor(headers, values) {
  return headers.map(header => values[header] === undefined ? '' : values[header]);
}

const contract = {
  start_date: '2025-09-01',
  rent_amount: 7500,
  deposit_amount: 15000,
  electricity_fee_rate: 3,
  equipment_fee_rate: 3.5
};
context.landlordInitiatedContractText_ = value => value === undefined || value === null ? '' : String(value).trim();

assert.equal(
  context.landlordContractCheckoutOriginalEndDate_({
    end_date: new Date(Date.UTC(2026, 8, 5))
  }),
  '2026-09-05'
);

const result = context.landlordContractCheckoutSettlementCalculate_({
  contract,
  previousBill: {
    bill_id: 'bill-2026-08-506',
    bill_month: '2026-08',
    payment_status: 'unpaid',
    electricity_amount: 120,
    equipment_amount: 80
  },
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 110,
  depositDeductionAmount: 500,
  depositDeductionNote: '浴室門片損壞'
});

assert.equal(result.success, true, result.code);
assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
  settlement_start_date: '2026-09-01',
  move_out_date: '2026-09-07',
  rent_days: 7,
  days_in_month: 30,
  rent_amount: 1750,
  start_meter_reading: 100,
  end_meter_reading: 110,
  electricity_usage: 10,
  electricity_amount: 30,
  equipment_amount: 35,
  previous_electricity_amount: 120,
  previous_equipment_amount: 80,
  subtotal_amount: 2015,
  deposit_amount: 15000,
  deposit_deduction_amount: 500,
  deposit_refund_amount: 14500,
  tenant_balance_due: 1515
});

const invalidMeter = context.landlordContractCheckoutSettlementValidateInput_({
  contract,
  moveOutDate: '2026-09-07',
  startMeterReading: 110,
  endMeterReading: 100,
  depositDeductionAmount: 0
});
assert.equal(invalidMeter.success, false);
assert.equal(invalidMeter.code, 'CHECKOUT_METER_READING_INVALID');

const invalidDate = context.landlordContractCheckoutSettlementValidateInput_({
  contract,
  moveOutDate: '2025-08-31',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 0
});
assert.equal(invalidDate.success, false);
assert.equal(invalidDate.code, 'CHECKOUT_MOVE_OUT_DATE_INVALID');

const excessiveDeduction = context.landlordContractCheckoutSettlementValidateInput_({
  contract,
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 15001
});
assert.equal(excessiveDeduction.success, false);
assert.equal(excessiveDeduction.code, 'CHECKOUT_DEPOSIT_DEDUCTION_INVALID');

const missingDeductionNote = context.landlordContractCheckoutSettlementValidateInput_({
  contract,
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 1
});
assert.equal(missingDeductionNote.success, false);
assert.equal(missingDeductionNote.code, 'CHECKOUT_DEPOSIT_DEDUCTION_NOTE_REQUIRED');

const paidPreviousBill = context.landlordContractCheckoutSettlementCalculate_({
  contract,
  previousBill: {
    bill_id: 'bill-2026-08-506',
    bill_month: '2026-08',
    payment_status: 'paid',
    electricity_amount: 120,
    equipment_amount: 80
  },
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 0
});
assert.equal(paidPreviousBill.success, true, paidPreviousBill.code);
assert.equal(paidPreviousBill.data.previous_electricity_amount, 0);
assert.equal(paidPreviousBill.data.previous_equipment_amount, 0);

const sheetDatePreviousBill = context.landlordContractCheckoutSettlementCalculate_({
  contract,
  previousBill: {
    bill_id: 'bill-2026-08-506-date',
    bill_month: new Date(Date.UTC(2026, 7, 1)),
    payment_status: 'unpaid',
    electricity_amount: 120,
    equipment_amount: 80
  },
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 0
});
assert.equal(sheetDatePreviousBill.success, true, sheetDatePreviousBill.code);
assert.equal(sheetDatePreviousBill.data.previous_electricity_amount, 120);
assert.equal(sheetDatePreviousBill.data.previous_equipment_amount, 80);

const voidPreviousBill = context.landlordContractCheckoutSettlementCalculate_({
  contract,
  previousBill: {
    bill_id: 'bill-2026-08-506-void',
    bill_month: '2026-08',
    bill_status: 'voided',
    electricity_amount: 120,
    equipment_amount: 80
  },
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 0
});
assert.equal(voidPreviousBill.success, true, voidPreviousBill.code);
assert.equal(voidPreviousBill.data.previous_electricity_amount, 0);
assert.equal(voidPreviousBill.data.previous_equipment_amount, 0);

context.settingsIntegrationGetWorkspaceSettings_ = () => ({
  default_electricity_fee_rate: 4.2,
  summer_equipment_fee_rate: 5.5,
  regular_equipment_fee_rate: 2.1,
  summer_months: [6, 7, 8, 9]
});
context.settingsIntegrationResolveSummerMonths_ = (_sourceValue, settings) => settings.summer_months;
const settingsRates = context.landlordContractCheckoutSettlementResolveRates_(
  null,
  { workspace: { workspace_id: 'W1' } },
  { electricity_fee_rate: '', equipment_fee_rate: '' },
  { electricity_rate: '', equipment_fee_rate_regular: '' },
  '2026-09-01'
);
assert.deepEqual(JSON.parse(JSON.stringify(settingsRates)), {
  electricity_fee_rate: 4.2,
  equipment_fee_rate: 5.5
});
const contractRatesWin = context.landlordContractCheckoutSettlementResolveRates_(
  null,
  { workspace: { workspace_id: 'W1' } },
  { electricity_fee_rate: 3, equipment_fee_rate: 3.5 },
  {},
  '2026-09-01'
);
assert.deepEqual(JSON.parse(JSON.stringify(contractRatesWin)), {
  electricity_fee_rate: 3,
  equipment_fee_rate: 3.5
});

const absentPreviousBill = context.landlordContractCheckoutSettlementCalculate_({
  contract,
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 0
});
assert.equal(absentPreviousBill.success, true, absentPreviousBill.code);
assert.equal(absentPreviousBill.data.previous_electricity_amount, 0);
assert.equal(absentPreviousBill.data.previous_equipment_amount, 0);

const settlementSheet = {
  headers: ['legacy_column'],
  getLastColumn() { return this.headers.length; },
  getRange(_row, column, _height, width) {
    return {
      getValues: () => [this.headers.slice(column - 1, column - 1 + width)],
      setValues: values => { this.headers.splice(column - 1, 0, ...values[0]); }
    };
  }
};
const spreadsheet = {
  getSheetByName: name => name === 'V2_checkout_settlements' ? settlementSheet : null
};
const schema = context.landlordContractCheckoutSettlementEnsureSheet_(spreadsheet);
assert.equal(schema.success, true, schema.code);
assert.equal(settlementSheet.headers[0], 'legacy_column');
assert.equal(settlementSheet.headers.includes('settlement_id'), true);
assert.equal(settlementSheet.headers.includes('completed_at'), true);
const schemaAgain = context.landlordContractCheckoutSettlementEnsureSheet_(spreadsheet);
assert.equal(schemaAgain.success, true, schemaAgain.code);
assert.deepEqual(JSON.parse(JSON.stringify(schemaAgain.data.added_headers)), []);

class ApiSheet {
  constructor(headers, rows = []) {
    this.headers = headers.slice();
    this.rows = rows.map(row => row.slice());
  }

  getLastRow() { return this.rows.length + 1; }
  getLastColumn() { return this.headers.length; }
  getDataRange() { return { getValues: () => [this.headers.slice(), ...this.rows.map(row => row.slice())] }; }
  getRange(row, column, height = 1, width = 1) {
    if (row === 1) {
      return {
        getValues: () => [this.headers.slice(column - 1, column - 1 + width)],
        getDisplayValues: () => [this.headers.slice(column - 1, column - 1 + width)],
        setValues: values => {
          const incoming = values[0] || [];
          incoming.forEach((value, index) => { this.headers[column - 1 + index] = value; });
        }
      };
    }
    return {
      getValues: () => this.rows.slice(row - 2, row - 2 + height).map(item => item.slice(column - 1, column - 1 + width)),
      getDisplayValues: () => this.rows.slice(row - 2, row - 2 + height).map(item => item.slice(column - 1, column - 1 + width)),
      setValue: value => { this.rows[row - 2][column - 1] = value; },
      setValues: values => { values.forEach((valuesRow, rowIndex) => { valuesRow.forEach((value, columnIndex) => { this.rows[row - 2 + rowIndex][column - 1 + columnIndex] = value; }); }); }
    };
  }
  appendRow(row) { this.rows.push(row.slice()); }
}

const API_CONTRACT_HEADERS = [...new Set([
  'contract_id', 'workspace_id', 'landlord_id', 'tenant_id', 'tenant_name', 'property_id', 'property_name',
  'property_address', 'room_id', 'room_name', 'start_date', 'contract_start_date', 'end_date', 'contract_end_date',
  'rent_amount', 'monthly_rent', 'management_fee', 'monthly_management_fee', 'deposit_amount', 'payment_day',
  'monthly_payment_day', 'electricity_fee_rate', 'equipment_fee_rate', 'contract_status', 'status', 'account_status',
  'signing_mode', 'invite_id', 'renewal_tenant_intent', 'previous_contract_id', 'updated_at',
  'contract_family_id', 'renewal_sequence', 'renewed_from_contract_id', 'renewed_to_contract_id', 'renewal_request_id',
  'other_fixed_fee_amount', 'other_fixed_fee_note', 'terms_snapshot_json', 'special_offer_enabled',
  'special_offer_notice_days', 'special_offer_applies_to', 'special_offer_waiver_type', 'special_offer_clause',
  'special_offer_decision', 'special_offer_notice_date', 'special_offer_days_before_expiry', 'special_offer_decision_reason',
  'identity_document_mode', 'renewal_review_status', 'renewal_review_prepared_at', 'renewal_review_confirmed_at',
  'renewal_review_reminded_30d_at', 'renewal_inquiry_status', 'renewal_inquiry_sent_at', 'renewal_inquiry_responded_at',
  'renewal_tenant_intent_at', 'checkout_status', 'checkout_source', 'checkout_requested_at', 'checkout_completed_at',
  'checkout_move_out_date', 'checkout_note', 'checkout_idempotency_key', 'terminated_at'
])];
const API_ROOM_HEADERS = ['room_id', 'workspace_id', 'landlord_id', 'property_id', 'room_name', 'room_status', 'account_status', 'current_contract_id', 'current_tenant_id', 'current_tenant_name', 'updated_at'];
const API_TENANT_HEADERS = ['tenant_id', 'tenant_user_id', 'user_id', 'workspace_id', 'landlord_id', 'tenant_line_user_id', 'line_user_id', 'tenant_name', 'name', 'room_id', 'current_contract_id', 'tenant_binding_status', 'binding_status', 'account_status', 'tenant_account_status', 'updated_at'];
const API_INVITE_HEADERS = ['invite_id', 'workspace_id', 'contract_id', 'room_id', 'landlord_user_id', 'landlord_membership_id', 'claim_code_hash', 'status', 'expires_at', 'claimed_at', 'claimed_line_user_id', 'cancelled_at', 'created_at', 'updated_at'];
const API_BILL_HEADERS = ['bill_id', 'workspace_id', 'landlord_id', 'tenant_id', 'contract_id', 'room_id', 'bill_month', 'rent_amount', 'electricity_amount', 'equipment_amount', 'bill_status', 'payment_status'];
const API_DOCUMENT_HEADERS = ['document_id', 'workspace_id', 'landlord_id', 'tenant_id', 'contract_id', 'document_type', 'status'];
const API_SETTLEMENT_HEADERS = [
  'settlement_id', 'workspace_id', 'landlord_id', 'contract_id', 'tenant_id', 'room_id', 'previous_bill_id', 'previous_bill_month',
  'previous_electricity_amount', 'previous_equipment_amount', 'settlement_start_date', 'move_out_date', 'rent_days', 'days_in_month',
  'rent_amount', 'start_meter_reading', 'end_meter_reading', 'electricity_usage', 'electricity_fee_rate', 'equipment_fee_rate',
  'electricity_amount', 'equipment_amount', 'deposit_amount', 'deposit_deduction_amount', 'deposit_refund_amount', 'subtotal_amount',
  'tenant_balance_due', 'start_meter_document_id', 'end_meter_document_id', 'settlement_note', 'settlement_status', 'idempotency_key',
  'created_at', 'created_by_user_id', 'completed_at'
];

function makeSettlementApiRuntime() {
  const access = {
    success: true,
    line_user_id: 'landlord-line',
    principal_line_user_id: 'landlord-line',
    principal_landlord_id: 'L1',
    workspace: { workspace_id: 'W1', workspace_name: '測試 Workspace' },
    user: { user_id: 'landlord-user', name: '房東甲' },
    membership: { membership_id: 'membership-1', role: 'owner' },
    principals: [{ landlord_id: 'L1' }]
  };
  const contract = rowFor(API_CONTRACT_HEADERS, {
    contract_id: 'old-contract', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'tenant-1', tenant_name: '王小明',
    property_id: 'P1', property_name: '幸福公寓', property_address: '台北市測試路 1 號', room_id: 'R506', room_name: '506',
    start_date: new Date(Date.UTC(2025, 8, 1)), contract_start_date: new Date(Date.UTC(2025, 8, 1)), end_date: new Date(Date.UTC(2026, 8, 5)), contract_end_date: new Date(Date.UTC(2026, 8, 5)),
    rent_amount: 7500, monthly_rent: 7500, management_fee: 0, monthly_management_fee: 0, deposit_amount: 15000,
    payment_day: 5, monthly_payment_day: 5, electricity_fee_rate: 3, equipment_fee_rate: 3.5,
    contract_status: 'expired', status: 'expired', account_status: 'active', signing_mode: 'legacy', invite_id: '',
    renewal_tenant_intent: '', updated_at: '2026-09-01T00:00:00.000Z'
  });
  const sheets = {
    V2_properties: new ApiSheet(['property_id', 'workspace_id', 'landlord_id', 'property_name', 'property_address', 'account_status'], [['P1', 'W1', 'L1', '幸福公寓', '台北市測試路 1 號', 'active']]),
    V2_rooms: new ApiSheet(API_ROOM_HEADERS, [rowFor(API_ROOM_HEADERS, { room_id: 'R506', workspace_id: 'W1', landlord_id: 'L1', property_id: 'P1', room_name: '506', room_status: 'occupied', account_status: 'active', current_contract_id: 'old-contract', current_tenant_id: 'tenant-1', current_tenant_name: '王小明' })]),
    V2_users: new ApiSheet(['user_id', 'workspace_id', 'landlord_id', 'line_user_id', 'role', 'status', 'account_status'], []),
    V2_tenants: new ApiSheet(API_TENANT_HEADERS, [rowFor(API_TENANT_HEADERS, { tenant_id: 'tenant-1', tenant_user_id: 'tenant-user-1', user_id: 'tenant-user-1', workspace_id: 'W1', landlord_id: 'L1', tenant_line_user_id: 'tenant-line', line_user_id: 'tenant-line', tenant_name: '王小明', name: '王小明', room_id: 'R506', current_contract_id: 'old-contract', tenant_binding_status: 'bound', binding_status: 'bound', account_status: 'active', tenant_account_status: 'active' })]),
    V2_contracts: new ApiSheet(API_CONTRACT_HEADERS, [contract]),
    V2_contract_invites: new ApiSheet(API_INVITE_HEADERS, []),
    V2_bills: new ApiSheet(API_BILL_HEADERS, [rowFor(API_BILL_HEADERS, { bill_id: 'bill-2026-08-506', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'tenant-1', contract_id: 'old-contract', room_id: 'R506', bill_month: new Date(Date.UTC(2026, 7, 1)), rent_amount: 7500, electricity_amount: 120, equipment_amount: 80, bill_status: 'issued', payment_status: 'unpaid' })]),
    V2_contract_documents: new ApiSheet(API_DOCUMENT_HEADERS, [
      rowFor(API_DOCUMENT_HEADERS, { document_id: 'doc-start', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'tenant-1', contract_id: 'old-contract', document_type: 'checkout_start_meter', status: 'stored' }),
      rowFor(API_DOCUMENT_HEADERS, { document_id: 'doc-end', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'tenant-1', contract_id: 'old-contract', document_type: 'checkout_end_meter', status: 'stored' })
    ]),
    V2_checkout_settlements: new ApiSheet(API_SETTLEMENT_HEADERS, [])
  };
  const context = {
    Date, Math, Number, String, Object, Array, JSON, RegExp, console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    tenantContractSigningReviewAccessFromSession_: () => ({ success: true, data: access }),
    workspaceLandlordCheckPolicy_: () => ({ success: true, code: 'OK' }),
    workspaceRecordOperationActor_: () => ({ success: true, code: 'OPERATION_AUDITED' }),
    Utilities: { getUuid: () => 'settlement-id-1' }
  };
  vm.createContext(context);
  vm.runInContext(initiatedSource, context, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });
  vm.runInContext(checkoutSource, context, { filename: 'V2_CONTRACT_CHECKOUT.js' });
  vm.runInContext(documentsSource, context, { filename: 'V2_LANDLORD_CONTRACT_DOCUMENTS.js' });
  return { api: context, access, sheets };
}

const settlementRuntime = makeSettlementApiRuntime();
assert.match(documentsSource, /checkout_start_meter/);
assert.match(documentsSource, /checkout_end_meter/);
assert.equal(settlementRuntime.api.landlordInitiatedContractIsRequest_({ action: 'landlord_contract_checkout_settlement_init' }), true);
assert.equal(settlementRuntime.api.landlordInitiatedContractIsRequest_({ action: 'landlord_contract_checkout_settlement_preview' }), true);
assert.equal(settlementRuntime.api.landlordInitiatedContractIsRequest_({ action: 'landlord_contract_checkout_evidence_upload' }), true);
const checkoutInit = settlementRuntime.api.landlordContractCheckoutInitBySession_('session-token', 'old-contract');
assert.equal(checkoutInit.success, true, checkoutInit.code);
assert.equal(checkoutInit.data.default_move_out_date, '2026-09-05');
const unsupportedEvidence = settlementRuntime.api.landlordContractCheckoutEvidenceUploadBySession_('session-token', {
  contract_id: 'old-contract', tenant_id: 'tenant-1', document_type: 'identity_front', file_name: 'identity.jpg',
  mime_type: 'image/jpeg', base64: 'aGVsbG8=', idempotency_key: 'evidence-test-1'
});
assert.equal(unsupportedEvidence.success, false);
assert.equal(unsupportedEvidence.code, 'INVALID_CHECKOUT_EVIDENCE_TYPE');
let delegatedUploadArgs = null;
settlementRuntime.api.uploadLandlordContractDocumentByLineUid_ = (...args) => {
  delegatedUploadArgs = args;
  return { success: true, code: 'OK', data: { document_id: 'doc-start' } };
};
const uploadedEvidence = settlementRuntime.api.landlordContractCheckoutEvidenceUploadBySession_('session-token', {
  contract_id: 'old-contract', tenant_id: 'tenant-1', workspace_id: 'W2', document_type: 'checkout_start_meter',
  file_name: 'meter-start.jpg', mime_type: 'image/jpeg', base64: 'aGVsbG8=', idempotency_key: 'evidence-test-2'
});
assert.equal(uploadedEvidence.success, true, uploadedEvidence.code);
assert.equal(delegatedUploadArgs[0], 'landlord-line');
assert.equal(delegatedUploadArgs[1], 'old-contract');
assert.equal(delegatedUploadArgs[2], 'tenant-1');
assert.equal(delegatedUploadArgs[3], 'checkout_start_meter');
const settlementInit = settlementRuntime.api.landlordContractCheckoutSettlementInitBySession_('session-token', 'old-contract', '2026-09-07');
assert.equal(settlementInit.success, true, settlementInit.code);
assert.equal(settlementInit.data.settlement.settlement_start_date, '2026-09-01');
assert.equal(settlementInit.data.settlement.previous_electricity_amount, 120);
assert.equal(settlementInit.data.settlement.previous_equipment_amount, 80);
assert.equal(settlementInit.data.settlement.previous_bill_month, '2026-08');
assert.equal(settlementInit.data.settlement.deposit_amount, 15000);
assert.equal(settlementInit.data.settlement.electricity_fee_rate, 3);
assert.equal(settlementInit.data.settlement.equipment_fee_rate, 3.5);
assert.equal(settlementRuntime.sheets.V2_checkout_settlements.rows.length, 0);

const settlementPreview = settlementRuntime.api.landlordContractCheckoutSettlementPreviewBySession_('session-token', {
  contract_id: 'old-contract', move_out_date: '2026-09-07', start_meter_reading: 100, end_meter_reading: 110,
  deposit_deduction_amount: 500, deposit_deduction_note: '浴室門片損壞'
});
assert.equal(settlementPreview.success, true, settlementPreview.code);
assert.equal(settlementPreview.data.settlement.rent_amount, 1750);
assert.equal(settlementPreview.data.settlement.subtotal_amount, 2015);
assert.equal(settlementRuntime.sheets.V2_checkout_settlements.rows.length, 0);

const settlementSchema = settlementRuntime.api.landlordContractCheckoutSettlementSchema_(settlementRuntime.api.SpreadsheetApp.getActiveSpreadsheet(), false);
const persistedSettlement = settlementRuntime.api.landlordContractCheckoutSettlementApplyUnlocked_(
  settlementRuntime.access,
  settlementSchema,
  {
    contract_id: 'old-contract', move_out_date: '2026-09-07', start_meter_reading: 100, end_meter_reading: 110,
    deposit_deduction_amount: 500, deposit_deduction_note: '浴室門片損壞', start_meter_document_id: 'doc-start',
    end_meter_document_id: 'doc-end', settlement_note: '506 退房結算', idempotency_key: 'settlement-test-1'
  }
);
assert.equal(persistedSettlement.success, true, persistedSettlement.code);
assert.equal(persistedSettlement.data.settlement_id, 'settlement-id-1');
assert.equal(settlementRuntime.sheets.V2_checkout_settlements.rows.length, 1);
const persistedHeaders = settlementRuntime.sheets.V2_checkout_settlements.headers;
const persistedRow = settlementRuntime.sheets.V2_checkout_settlements.rows[0];
assert.equal(persistedRow[persistedHeaders.indexOf('previous_bill_id')], 'bill-2026-08-506');
assert.equal(persistedRow[persistedHeaders.indexOf('tenant_balance_due')], 1515);
assert.equal(persistedRow[persistedHeaders.indexOf('deposit_refund_amount')], 14500);

console.log('Phase 205 landlord checkout settlement runtime RED/GREEN tests passed.');
