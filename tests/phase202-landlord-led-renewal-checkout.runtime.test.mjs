import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const initiatedSource = readFileSync(
  new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url),
  'utf8'
);
const checkoutSource = readFileSync(
  new URL('../apps-script/V2_CONTRACT_CHECKOUT.js', import.meta.url),
  'utf8'
);

class Sheet {
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

const CONTRACT_HEADERS = [
  'contract_id', 'workspace_id', 'landlord_id', 'landlord_line_user_id', 'landlord_name',
  'tenant_id', 'tenant_user_id', 'tenant_line_user_id', 'tenant_name', 'property_id', 'property_name',
  'property_address', 'room_id', 'room_name', 'start_date', 'contract_start_date', 'end_date',
  'contract_end_date', 'rent_amount', 'monthly_rent', 'management_fee', 'monthly_management_fee',
  'deposit_amount', 'payment_day', 'monthly_payment_day', 'contract_status', 'status', 'account_status',
  'signing_mode', 'contract_origin', 'invite_id', 'contract_content', 'renewal_tenant_intent',
  'renewal_review_status', 'renewal_inquiry_status', 'previous_contract_id', 'created_by_user_id',
  'created_by_membership_id', 'tenant_signing_submission_status', 'updated_at'
];
const ROOM_HEADERS = ['room_id', 'workspace_id', 'landlord_id', 'property_id', 'room_name', 'room_status', 'account_status', 'current_contract_id', 'current_tenant_id', 'current_tenant_name', 'updated_at'];
const TENANT_HEADERS = ['tenant_id', 'tenant_user_id', 'user_id', 'workspace_id', 'landlord_id', 'tenant_line_user_id', 'line_user_id', 'tenant_name', 'name', 'room_id', 'current_contract_id', 'tenant_binding_status', 'binding_status', 'account_status', 'tenant_account_status', 'updated_at'];
const VIEW_HEADERS = ['tenant_id', 'workspace_id', 'tenant_user_id', 'user_id', 'tenant_line_user_id', 'line_user_id', 'tenant_name', 'room_id', 'room_name', 'current_contract_id', 'contract_status', 'updated_at'];
const SETTLEMENT_HEADERS = [
  'settlement_id', 'workspace_id', 'landlord_id', 'contract_id', 'tenant_id', 'room_id', 'previous_bill_id', 'previous_bill_month',
  'previous_electricity_amount', 'previous_equipment_amount', 'settlement_start_date', 'move_out_date', 'rent_days', 'days_in_month',
  'rent_amount', 'start_meter_reading', 'end_meter_reading', 'electricity_usage', 'electricity_fee_rate', 'equipment_fee_rate',
  'electricity_amount', 'equipment_amount', 'deposit_amount', 'deposit_deduction_amount', 'deposit_refund_amount', 'subtotal_amount',
  'tenant_balance_due', 'start_meter_document_id', 'end_meter_document_id', 'settlement_note', 'settlement_status', 'idempotency_key',
  'created_at', 'created_by_user_id', 'completed_at'
];
const DOCUMENT_HEADERS = ['document_id', 'workspace_id', 'landlord_id', 'tenant_id', 'contract_id', 'document_type', 'status'];

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

function rowFor(headers, values) {
  return headers.map(header => values[header] === undefined ? '' : values[header]);
}

function makeCheckoutRuntime() {
  const contract = rowFor(CONTRACT_HEADERS, {
    contract_id: 'old-contract', workspace_id: 'W1', landlord_id: 'L1', landlord_line_user_id: 'landlord-line', landlord_name: '房東甲',
    tenant_id: 'tenant-1', tenant_user_id: 'tenant-user-1', tenant_line_user_id: 'tenant-line', tenant_name: '王小明',
    property_id: 'P1', property_name: '幸福公寓', property_address: '台北市測試路 1 號', room_id: 'R603', room_name: '603',
    start_date: '2025-09-01', contract_start_date: '2025-09-01', end_date: '2026-07-31', contract_end_date: '2026-07-31',
    rent_amount: 24000, monthly_rent: 24000, management_fee: 800, monthly_management_fee: 800, deposit_amount: 48000,
    payment_day: 5, monthly_payment_day: 5, contract_status: 'expired', status: 'expired', account_status: 'active',
    signing_mode: '', contract_origin: 'legacy', contract_content: '不可覆寫的原合約全文', tenant_signing_submission_status: 'completed', updated_at: '2026-07-31T00:00:00.000Z'
  });
  const sheets = {
    V2_properties: new Sheet(['property_id', 'workspace_id', 'landlord_id', 'property_name', 'property_address', 'account_status'], [['P1', 'W1', 'L1', '幸福公寓', '台北市測試路 1 號', 'active']]),
    V2_rooms: new Sheet(ROOM_HEADERS, [rowFor(ROOM_HEADERS, { room_id: 'R603', workspace_id: 'W1', landlord_id: 'L1', property_id: 'P1', room_name: '603', room_status: 'occupied', account_status: 'active', current_contract_id: 'old-contract', current_tenant_id: 'tenant-1', current_tenant_name: '王小明' })]),
    V2_users: new Sheet(['user_id', 'workspace_id', 'landlord_id', 'line_user_id', 'role', 'status', 'account_status'], []),
    V2_tenants: new Sheet(TENANT_HEADERS, [rowFor(TENANT_HEADERS, { tenant_id: 'tenant-1', tenant_user_id: 'tenant-user-1', user_id: 'tenant-user-1', workspace_id: 'W1', landlord_id: 'L1', tenant_line_user_id: 'tenant-line', line_user_id: 'tenant-line', tenant_name: '王小明', name: '王小明', room_id: 'R603', current_contract_id: 'old-contract', tenant_binding_status: 'bound', binding_status: 'bound', account_status: 'active', tenant_account_status: 'active' })]),
    V2_contracts: new Sheet(CONTRACT_HEADERS, [contract]),
    V2_contract_invites: new Sheet(['invite_id', 'workspace_id', 'contract_id', 'room_id', 'landlord_user_id', 'landlord_membership_id', 'claim_code_hash', 'status', 'expires_at', 'claimed_at', 'claimed_line_user_id', 'cancelled_at', 'created_at', 'updated_at'], []),
    V2_landlord_tenant_list_view: new Sheet(VIEW_HEADERS, [rowFor(VIEW_HEADERS, { tenant_id: 'tenant-1', workspace_id: 'W1', tenant_user_id: 'tenant-user-1', user_id: 'tenant-user-1', tenant_line_user_id: 'tenant-line', line_user_id: 'tenant-line', tenant_name: '王小明', room_id: 'R603', room_name: '603', current_contract_id: 'old-contract', contract_status: 'expired' })]),
    V2_tenant_home_view: new Sheet(VIEW_HEADERS, [rowFor(VIEW_HEADERS, { tenant_id: 'tenant-1', workspace_id: 'W1', tenant_user_id: 'tenant-user-1', user_id: 'tenant-user-1', tenant_line_user_id: 'tenant-line', line_user_id: 'tenant-line', tenant_name: '王小明', room_id: 'R603', room_name: '603', current_contract_id: 'old-contract', contract_status: 'expired' })]),
    V2_contract_documents: new Sheet(DOCUMENT_HEADERS, [
      rowFor(DOCUMENT_HEADERS, { document_id: 'doc-start', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'tenant-1', contract_id: 'old-contract', document_type: 'checkout_start_meter', status: 'stored' }),
      rowFor(DOCUMENT_HEADERS, { document_id: 'doc-end', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'tenant-1', contract_id: 'old-contract', document_type: 'checkout_end_meter', status: 'stored' })
    ]),
    V2_checkout_settlements: new Sheet(SETTLEMENT_HEADERS, [])
  };
  const pushedMessages = [];
  const auditCalls = [];
  const context = {
    Date, Math, Number, String, Object, Array, JSON, RegExp, console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    tenantContractSigningReviewAccessFromSession_: (_token, _policy) => ({ success: true, data: access }),
    workspaceRecordOperationActor_: (...args) => { auditCalls.push(args); return { success: true, code: 'OPERATION_AUDITED' }; },
    workspaceLandlordCheckPolicy_: () => ({ success: true, code: 'OK' }),
    workspaceNotifyTeam_: () => ({ success: true, code: 'OK' }),
    pushLineTextMessage_: (lineUserId, message) => { pushedMessages.push({ lineUserId, message }); return { success: true, code: 'OK' }; }
  };
  vm.createContext(context);
  vm.runInContext(initiatedSource, context, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });
  vm.runInContext(checkoutSource, context, { filename: 'V2_CONTRACT_CHECKOUT.js' });
  return { api: context, sheets, pushedMessages, auditCalls, contract: sheets.V2_contracts.rows[0], room: sheets.V2_rooms.rows[0], tenant: sheets.V2_tenants.rows[0] };
}

const context = { Date, Math, Number, String, Object, Array, JSON, RegExp };
vm.createContext(context);
vm.runInContext(initiatedSource, context, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });

const pendingRenewal = {
  contract_id: 'renewal-1',
  signing_mode: 'renewal',
  contract_status: 'pending_landlord_review',
  renewal_review_status: 'pending',
  renewal_inquiry_status: 'pending',
  renewal_tenant_intent: 'pending',
  invite_id: ''
};

const reviewed = context.landlordInitiatedContractRenewalReviewTransition_(
  pendingRenewal,
  '2026-09-01T00:00:00.000Z'
);
assert.equal(reviewed.success, true, reviewed.code);
assert.equal(reviewed.send_inquiry, true);
assert.equal(reviewed.updates.renewal_review_status, 'confirmed');
assert.equal(reviewed.updates.renewal_inquiry_status, 'sent');
assert.equal(reviewed.updates.renewal_tenant_intent, 'pending');

const inquiryAlreadySent = context.landlordInitiatedContractRenewalInquiryTransition_({
  ...pendingRenewal,
  renewal_review_status: 'confirmed',
  renewal_inquiry_status: 'sent'
}, '2026-09-01T00:00:00.000Z');
assert.equal(inquiryAlreadySent.success, false);
assert.equal(inquiryAlreadySent.code, 'RENEWAL_INQUIRY_ALREADY_SENT');

const declined = context.landlordInitiatedContractRenewalIntentTransition_({
  ...pendingRenewal,
  renewal_review_status: 'confirmed',
  renewal_inquiry_status: 'sent'
}, 'declined', '2026-09-01T00:00:00.000Z');
assert.equal(declined.success, true, declined.code);
assert.equal(declined.updates.renewal_tenant_intent, 'declined');

const runtime = makeCheckoutRuntime();
const init = runtime.api.landlordContractCheckoutInitBySession_('session-token', 'old-contract');
assert.equal(init.success, true, init.code);
assert.equal(init.data.contract.original_end_date, '2026-07-31');
assert.equal(init.data.default_move_out_date, '2026-07-31');

const missingSettlement = runtime.api.landlordContractCheckoutCompleteBySession_('session-token', {
  contract_id: 'old-contract', move_out_date: '2026-09-01', idempotency_key: 'checkout-missing-settlement'
});
assert.equal(missingSettlement.success, false);
assert.equal(missingSettlement.code, 'CHECKOUT_SETTLEMENT_REQUIRED');
assert.equal(runtime.contract[25], 'expired');
assert.equal(runtime.room[5], 'occupied');
assert.equal(runtime.tenant[10], 'old-contract');
assert.equal(runtime.sheets.V2_checkout_settlements.rows.length, 0);

const completed = runtime.api.landlordContractCheckoutCompleteBySession_('session-token', {
  contract_id: 'old-contract', move_out_date: '2026-09-01',
  note: '已完成點交，私下確認不續約', settlement_note: '退房點交完成',
  start_meter_reading: 100, end_meter_reading: 100, deposit_deduction_amount: 0,
  start_meter_document_id: 'doc-start', end_meter_document_id: 'doc-end', idempotency_key: 'checkout-test-1'
});
assert.equal(completed.success, true, completed.code);
assert.equal(completed.data.checkout_status, 'completed');
assert.match(completed.data.settlement_id, /^checkout-settlement-/);
assert.equal(completed.data.tenant_balance_due, 800);
assert.equal(runtime.sheets.V2_checkout_settlements.rows.length, 1);
assert.equal(runtime.contract[25], 'terminated');
assert.equal(runtime.contract[16], '2026-07-31');
assert.equal(runtime.contract[31], '不可覆寫的原合約全文');
assert.equal(runtime.room[5], 'vacant');
assert.equal(runtime.room[7], '');
assert.equal(runtime.tenant[10], '');
assert.equal(runtime.sheets.V2_landlord_tenant_list_view.rows[0][9], '');
assert.equal(runtime.sheets.V2_tenant_home_view.rows[0][9], '');
assert.equal(runtime.pushedMessages.length, 0);
assert.equal(runtime.auditCalls.length, 1);

const repeated = runtime.api.landlordContractCheckoutCompleteBySession_('session-token', {
  contract_id: 'old-contract', move_out_date: '2026-09-01', idempotency_key: 'checkout-test-1'
});
assert.equal(repeated.success, true, repeated.code);
assert.equal(repeated.data.idempotent, true);
assert.equal(repeated.data.settlement_id, completed.data.settlement_id);
assert.equal(runtime.auditCalls.length, 1);

const differentKey = runtime.api.landlordContractCheckoutCompleteBySession_('session-token', {
  contract_id: 'old-contract', move_out_date: '2026-09-01', idempotency_key: 'checkout-test-2'
});
assert.equal(differentKey.success, false);
assert.equal(differentKey.code, 'CHECKOUT_ALREADY_COMPLETED');
assert.equal(runtime.sheets.V2_checkout_settlements.rows.length, 1);

const invalidDate = runtime.api.landlordContractCheckoutValidateTarget_(
  { ...runtime.api.landlordInitiatedContractRows_(runtime.sheets.V2_contracts)[0], contract_status: 'expired', start_date: '2025-09-01', workspace_id: 'W1', contract_id: 'old-contract' },
  { room_id: 'R603', workspace_id: 'W1', current_contract_id: 'old-contract' },
  [],
  { workspace_id: 'W1', move_out_date: '2024-01-01' }
);
assert.equal(invalidDate.success, false);
assert.equal(invalidDate.code, 'CHECKOUT_MOVE_OUT_DATE_INVALID');

const crossWorkspace = runtime.api.landlordContractCheckoutValidateTarget_(
  { contract_id: 'old-contract', workspace_id: 'W1', contract_status: 'expired', start_date: '2025-09-01' },
  { room_id: 'R603', workspace_id: 'W1', current_contract_id: 'old-contract' },
  [],
  { workspace_id: 'W2', move_out_date: '2026-09-01' }
);
assert.equal(crossWorkspace.success, false);
assert.equal(crossWorkspace.code, 'WORKSPACE_ACCESS_DENIED');

const siblingCases = [
  [{ contract_id: 'new-active', workspace_id: 'W1', room_id: 'R603', contract_status: 'active' }, 'CHECKOUT_NEWER_CONTRACT_EXISTS'],
  [{ contract_id: 'new-signing', workspace_id: 'W1', room_id: 'R603', contract_status: 'pending_tenant_signature', signing_mode: 'renewal', renewal_tenant_intent: 'pending' }, 'CHECKOUT_NEWER_CONTRACT_EXISTS'],
  [{ contract_id: 'new-declined', workspace_id: 'W1', room_id: 'R603', contract_status: 'pending_landlord_review', signing_mode: 'renewal', renewal_tenant_intent: 'declined' }, null]
];
siblingCases.forEach(([sibling, expectedCode]) => {
  const result = runtime.api.landlordContractCheckoutValidateTarget_(
    { contract_id: 'old-contract', workspace_id: 'W1', room_id: 'R603', contract_status: 'expired', start_date: '2025-09-01' },
    { room_id: 'R603', workspace_id: 'W1', current_contract_id: 'old-contract' },
    [sibling],
    { workspace_id: 'W1', move_out_date: '2026-09-01' }
  );
  assert.equal(result.success, expectedCode === null, expectedCode || result.code);
  if (expectedCode) assert.equal(result.code, expectedCode);
});

console.log('Phase 202 landlord-led renewal checkout runtime RED/GREEN tests passed.');
