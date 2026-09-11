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

const context = {
  Date, Math, Number, String, Object, Array, JSON, RegExp, console
};
vm.createContext(context);
vm.runInContext(checkoutSource, context, { filename: 'V2_CONTRACT_CHECKOUT.js' });

const contract = {
  start_date: '2025-09-01',
  rent_amount: 7500,
  deposit_amount: 15000
};

const manual = context.landlordContractCheckoutSettlementCalculate_({
  settlement_mode: 'manual',
  contract,
  move_out_date: '2026-09-07',
  manual_receivable_amount: 3200,
  manual_refund_amount: 10000,
  deposit_deduction_amount: 500,
  deposit_deduction_note: '家具清潔費由房東與房客確認後手動結算'
});

assert.equal(manual.success, true, manual.code);
assert.deepEqual(JSON.parse(JSON.stringify(manual.data)), {
  settlement_mode: 'manual',
  settlement_start_date: '2026-09-01',
  move_out_date: '2026-09-07',
  rent_days: 7,
  days_in_month: 30,
  rent_amount: 0,
  start_meter_reading: 0,
  end_meter_reading: 0,
  electricity_usage: 0,
  electricity_amount: 0,
  equipment_amount: 0,
  previous_electricity_amount: 0,
  previous_equipment_amount: 0,
  subtotal_amount: 3200,
  deposit_amount: 15000,
  deposit_deduction_amount: 500,
  deposit_refund_amount: 10000,
  tenant_balance_due: 3200,
  manual_receivable_amount: 3200,
  manual_refund_amount: 10000
});

const missingManualAmount = context.landlordContractCheckoutSettlementValidateInput_({
  settlement_mode: 'manual',
  contract,
  move_out_date: '2026-09-07',
  manual_refund_amount: 10000,
  deposit_deduction_amount: 0
});
assert.equal(missingManualAmount.success, false);
assert.equal(missingManualAmount.code, 'CHECKOUT_MANUAL_SETTLEMENT_REQUIRED');

const excessiveRefund = context.landlordContractCheckoutSettlementValidateInput_({
  settlement_mode: 'manual',
  contract,
  move_out_date: '2026-09-07',
  manual_receivable_amount: 0,
  manual_refund_amount: 15001,
  deposit_deduction_amount: 0
});
assert.equal(excessiveRefund.success, false);
assert.equal(excessiveRefund.code, 'CHECKOUT_MANUAL_REFUND_INVALID');

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
        setValues: values => { (values[0] || []).forEach((value, index) => { this.headers[column - 1 + index] = value; }); }
      };
    }
    return {
      setValue: value => { this.rows[row - 2][column - 1] = value; },
      getValues: () => this.rows.slice(row - 2, row - 2 + height).map(item => item.slice(column - 1, column - 1 + width)),
      getDisplayValues: () => this.rows.slice(row - 2, row - 2 + height).map(item => item.slice(column - 1, column - 1 + width))
    };
  }
  appendRow(row) { this.rows.push(row.slice()); }
}

function rowFor(headers, values) {
  return headers.map(header => values[header] === undefined ? '' : values[header]);
}

const contractHeaders = [
  'contract_id', 'workspace_id', 'landlord_id', 'tenant_id', 'room_id', 'start_date', 'end_date',
  'rent_amount', 'deposit_amount', 'contract_status', 'status', 'checkout_status', 'checkout_source',
  'checkout_idempotency_key'
];
const roomHeaders = ['room_id', 'workspace_id', 'landlord_id', 'room_status', 'current_contract_id', 'current_tenant_id', 'current_tenant_name'];
const tenantHeaders = ['tenant_id', 'workspace_id', 'landlord_id', 'current_contract_id'];
const settlementHeaders = [
  'settlement_id', 'workspace_id', 'landlord_id', 'contract_id', 'tenant_id', 'room_id', 'settlement_start_date',
  'move_out_date', 'rent_days', 'days_in_month', 'rent_amount', 'start_meter_reading', 'end_meter_reading',
  'electricity_usage', 'electricity_amount', 'equipment_amount', 'deposit_amount', 'deposit_deduction_amount',
  'deposit_refund_amount', 'subtotal_amount', 'tenant_balance_due', 'start_meter_document_id', 'end_meter_document_id',
  'settlement_note', 'settlement_status', 'idempotency_key', 'created_at', 'created_by_user_id', 'completed_at',
  'settlement_mode', 'manual_receivable_amount', 'manual_refund_amount', 'deposit_deduction_note'
];

const manualApplySheets = {
  V2_contracts: new ApiSheet(contractHeaders, [rowFor(contractHeaders, {
    contract_id: 'manual-contract', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T1', room_id: 'R1',
    start_date: '2025-09-01', end_date: '2026-09-05', rent_amount: 7500, deposit_amount: 15000,
    contract_status: 'expired', status: 'expired'
  })]),
  V2_rooms: new ApiSheet(roomHeaders, [rowFor(roomHeaders, {
    room_id: 'R1', workspace_id: 'W1', landlord_id: 'L1', room_status: 'occupied',
    current_contract_id: 'manual-contract', current_tenant_id: 'T1', current_tenant_name: '王小明'
  })]),
  V2_tenants: new ApiSheet(tenantHeaders, [rowFor(tenantHeaders, {
    tenant_id: 'T1', workspace_id: 'W1', landlord_id: 'L1', current_contract_id: 'manual-contract'
  })]),
  V2_checkout_settlements: new ApiSheet(settlementHeaders)
};
const manualApplyContext = {
  Date, Math, Number, String, Object, Array, JSON, RegExp, console,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => manualApplySheets[name] || null }) },
  Utilities: { getUuid: () => 'manual-settlement-id-1' }
};
vm.createContext(manualApplyContext);
vm.runInContext(initiatedSource, manualApplyContext, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });
vm.runInContext(checkoutSource, manualApplyContext, { filename: 'V2_CONTRACT_CHECKOUT.js' });
const manualApplyAccess = {
  success: true,
  workspace: { workspace_id: 'W1' },
  user: { user_id: 'landlord-user' },
  membership: { membership_id: 'membership-1', role: 'owner' },
  principals: [{ landlord_id: 'L1' }]
};
const manualApplyResult = manualApplyContext.landlordContractCheckoutSettlementApplyUnlocked_(
  manualApplyAccess,
  { data: {
    contracts: manualApplySheets.V2_contracts,
    rooms: manualApplySheets.V2_rooms,
    tenants: manualApplySheets.V2_tenants,
    bills: null,
    documents: null,
    settlements: manualApplySheets.V2_checkout_settlements
  } },
  {
    contract_id: 'manual-contract', settlement_mode: 'manual', move_out_date: '2026-09-07',
    manual_receivable_amount: 3200, manual_refund_amount: 10000, deposit_deduction_amount: 500,
    deposit_deduction_note: '家具清潔費', idempotency_key: 'manual-settlement-operation-1'
  }
);
assert.equal(manualApplyResult.success, true, manualApplyResult.code);
assert.equal(manualApplyResult.data.settlement_mode, 'manual');
assert.equal(manualApplyResult.data.tenant_balance_due, 3200);
assert.equal(manualApplyResult.data.deposit_refund_amount, 10000);
assert.equal(manualApplySheets.V2_checkout_settlements.rows.length, 1);
const manualRow = manualApplySheets.V2_checkout_settlements.rows[0];
assert.equal(manualRow[settlementHeaders.indexOf('start_meter_document_id')], '');
assert.equal(manualRow[settlementHeaders.indexOf('end_meter_document_id')], '');
assert.equal(manualRow[settlementHeaders.indexOf('manual_receivable_amount')], 3200);
assert.equal(manualRow[settlementHeaders.indexOf('manual_refund_amount')], 10000);

manualApplySheets.V2_contracts.rows.push(rowFor(contractHeaders, {
  contract_id: 'manual-complete-contract', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T2', room_id: 'R2',
  start_date: '2025-09-01', end_date: '2026-09-05', rent_amount: 7500, deposit_amount: 12000,
  contract_status: 'expired', status: 'expired'
}));
manualApplySheets.V2_rooms.rows.push(rowFor(roomHeaders, {
  room_id: 'R2', workspace_id: 'W1', landlord_id: 'L1', room_status: 'occupied',
  current_contract_id: 'manual-complete-contract', current_tenant_id: 'T2', current_tenant_name: '李小華'
}));
manualApplySheets.V2_tenants.rows.push(rowFor(tenantHeaders, {
  tenant_id: 'T2', workspace_id: 'W1', landlord_id: 'L1', current_contract_id: 'manual-complete-contract'
}));
const completedCheckout = manualApplyContext.landlordContractCheckoutApplyUnlocked_(
  manualApplyAccess,
  { data: {
    contracts: manualApplySheets.V2_contracts,
    rooms: manualApplySheets.V2_rooms,
    tenants: manualApplySheets.V2_tenants,
    bills: null,
    documents: null,
    settlements: manualApplySheets.V2_checkout_settlements
  } },
  {
    contract_id: 'manual-complete-contract', settlement_mode: 'manual', move_out_date: '2026-09-07',
    manual_receivable_amount: 1800, manual_refund_amount: 9000, deposit_deduction_amount: 0,
    idempotency_key: 'manual-complete-operation-1'
  }
);
assert.equal(completedCheckout.success, true, completedCheckout.code);
assert.equal(completedCheckout.data.settlement_mode, 'manual');
assert.equal(completedCheckout.data.tenant_balance_due, 1800);
assert.equal(completedCheckout.data.deposit_refund_amount, 9000);
const completedContractRow = manualApplySheets.V2_contracts.rows[1];
const completedRoomRow = manualApplySheets.V2_rooms.rows[1];
const completedTenantRow = manualApplySheets.V2_tenants.rows[1];
assert.equal(completedContractRow[contractHeaders.indexOf('checkout_status')], 'completed');
assert.equal(completedRoomRow[roomHeaders.indexOf('room_status')], 'vacant');
assert.equal(completedRoomRow[roomHeaders.indexOf('current_contract_id')], '');
assert.equal(completedTenantRow[tenantHeaders.indexOf('current_contract_id')], '');

console.log('Phase 252 landlord checkout quick closeout runtime RED/GREEN tests passed.');
