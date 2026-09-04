import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const billingSource = readFileSync(
  new URL('../apps-script/V2_BILLING_MANAGEMENT.js', import.meta.url),
  'utf8'
);
const rentStart = billingSource.indexOf('function billingCalculateRentForBillMonth_(');
const buildStart = billingSource.indexOf('function billingBuildInitItem_(');
const buildEnd = billingSource.indexOf('\n\nfunction billingCalculateBill_', buildStart);
const calculateStart = billingSource.indexOf('function billingCalculateBill_(');
const calculateEnd = billingSource.indexOf('\n\n// ==================================================\n// View synchronization', calculateStart);

assert.notEqual(rentStart, -1, 'billing rent helper must exist');
assert.notEqual(buildStart, -1, 'billing init builder must exist');
assert.notEqual(buildEnd, -1, 'billing init builder must have a boundary');
assert.notEqual(calculateStart, -1, 'billing calculator must exist');
assert.notEqual(calculateEnd, -1, 'billing calculator must have a boundary');

const context = {
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  billingText_: value => value == null ? '' : String(value),
  billingNumber_: value => Number(value) || 0,
  billingDate_: value => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day);
  },
  billingMonthStart_: value => {
    const [year, month] = String(value).split('-').map(Number);
    return new Date(year, month - 1, 1);
  },
  billingMonthEnd_: value => {
    const [year, month] = String(value).split('-').map(Number);
    return new Date(year, month, 0);
  }
};

vm.runInNewContext(billingSource.slice(rentStart, buildStart), context, {
  filename: 'V2_BILLING_MANAGEMENT.js'
});

Object.assign(context, {
  billingResolvePositiveNumber_: (values, fallback) => {
    const value = values.map(Number).find(item => Number.isFinite(item) && item > 0);
    return value === undefined ? Number(fallback) || 0 : value;
  },
  billingResolveNonNegativeNumber_: (values, fallback) => {
    const value = values.map(Number).find(item => Number.isFinite(item) && item >= 0);
    return value === undefined ? Number(fallback) || 0 : value;
  },
  billingIsSummerMonth_: () => false,
  billingResolvePreviousMeter_: () => ({
    value: 0,
    locked: false,
    source: 'manual',
    label: '尚無上期抄表來源',
    previous_bill_month: ''
  }),
  billingResolveCurrentMeter_: bill => Number(bill.current_meter_reading) || 0,
  billingNormalizePaymentStatus_: value => String(value || 'unpaid').toLowerCase(),
  billingResolvePaymentDay_: () => 10,
  billingDefaultDueDate_: () => '2026-09-10',
  billingSummerMonthsLabel_: () => '6–9 月'
});

vm.runInNewContext(billingSource.slice(buildStart, buildEnd), context, {
  filename: 'V2_BILLING_MANAGEMENT.js'
});

const room = {
  workspace_id: 'W1',
  landlord_id: 'L1',
  room_id: 'R202',
  room_name: '202',
  property_id: 'P1',
  property_name: '測試物件',
  rent_amount: 8500,
  management_fee: 0,
  electricity_fee_rate: 0,
  equipment_fee_rate: 0
};
const tenant = { tenant_id: 'T202', tenant_name: '202 房客' };
const paidAtSigning = {
  contract_id: 'C202',
  tenant_id: 'T202',
  start_date: '2026-09-01',
  end_date: '2027-08-31',
  rent_amount: 8500,
  management_fee: 0,
  electricity_fee_rate: 0,
  equipment_fee_rate: 0,
  initial_rent_paid_month: '2026-09',
  initial_rent_paid_amount: 8500
};
const existingBill = {
  bill_id: 'B202-09',
  rent_amount: 8500,
  payment_status: 'unpaid',
  current_meter_reading: 0
};

vm.runInNewContext(billingSource.slice(calculateStart, calculateEnd), context, {
  filename: 'V2_BILLING_MANAGEMENT.js'
});

const existingCalculated = context.billingCalculateBill_(
  room,
  paidAtSigning,
  tenant,
  existingBill,
  null,
  '2026-09',
  {
    current_meter_reading: '',
    due_date: '2026-09-10',
    other_amount: 0,
    discount_amount: 0,
    note: '',
    tenant_visible_note: ''
  },
  {}
);

assert.equal(existingCalculated.discount_amount, 8500);
assert.equal(existingCalculated.total_amount, 0);
assert.equal(existingCalculated.payment_status, 'paid');
assert.match(existingCalculated.tenant_visible_note, /簽約時已收本月租金/);

const tenantsPage = readFileSync(
  new URL('../landlord-tenants.html', import.meta.url),
  'utf8'
);

assert.match(tenantsPage, /快速續約/);
assert.match(tenantsPage, /function goTenantRenewal\(\s*tenant,\s*event\s*\)/);
assert.match(
  tenantsPage,
  /canQuickRenew = Boolean\([\s\S]*?contractExpiry[\s\S]*?['"]expired['"][\s\S]*?\)/,
  'expiring tenant cards must gate the direct renewal action by contract expiry'
);
assert.match(
  tenantsPage,
  /快速續約[\s\S]*?goTenantRenewal\(/,
  'expiring tenant cards must expose a direct renewal action'
);
assert.match(tenantsPage, /params\.set\('previous_contract_id', contractId\)/);

console.log('Phase 226 prepaid rent and quick renewal tests passed.');
