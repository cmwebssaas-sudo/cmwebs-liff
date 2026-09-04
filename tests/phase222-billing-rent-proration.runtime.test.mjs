import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../apps-script/V2_BILLING_MANAGEMENT.js', import.meta.url),
  'utf8'
);
const start = source.indexOf('function billingCalculateRentForBillMonth_(');
const end = source.indexOf('\n\nfunction billingBuildInitItem_', start);

assert.notEqual(start, -1, 'billing rent proration helper must exist');
assert.notEqual(end, -1, 'billing rent proration helper must precede billingBuildInitItem_');

const context = {
  Date,
  Math,
  Number,
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

vm.runInNewContext(source.slice(start, end), context, {
  filename: 'V2_BILLING_MANAGEMENT.js'
});

const buildStart = source.indexOf('function billingBuildInitItem_(');
const buildEnd = source.indexOf('\n\nfunction billingCalculateBill_', buildStart);

assert.notEqual(buildStart, -1, 'billing init item builder must exist');
assert.notEqual(buildEnd, -1, 'billing init item builder must precede billing calculation');

Object.assign(context, {
  billingText_: value => value == null ? '' : String(value),
  billingResolvePositiveNumber_: (values, fallback) => {
    const value = values.map(Number).find(item => Number.isFinite(item) && item > 0);
    return value === undefined ? Number(fallback) || 0 : value;
  },
  billingResolveNonNegativeNumber_: (values, fallback) => {
    const value = values.map(Number).find(item => Number.isFinite(item) && item >= 0);
    return value === undefined ? Number(fallback) || 0 : value;
  },
  billingIsSummerMonth_: () => true,
  billingResolvePreviousMeter_: () => ({
    value: 0,
    locked: false,
    source: 'manual',
    label: '尚無上期抄表來源',
    previous_bill_month: ''
  }),
  billingResolveCurrentMeter_: bill => Number(bill.current_meter_reading) || 0,
  billingNormalizePaymentStatus_: () => 'unpaid',
  billingResolvePaymentDay_: () => 10,
  billingDefaultDueDate_: () => '2026-08-10',
  billingSummerMonthsLabel_: () => '6–9 月'
});

vm.runInNewContext(source.slice(buildStart, buildEnd), context, {
  filename: 'V2_BILLING_MANAGEMENT.js'
});

const contract = {
  start_date: '2026-08-07',
  end_date: '2027-08-06'
};

const august = context.billingCalculateRentForBillMonth_(31000, contract, '2026-08');
assert.equal(august.monthly_rent_amount, 31000);
assert.equal(august.occupied_days, 25);
assert.equal(august.days_in_month, 31);
assert.equal(august.rent_amount, 25000);
assert.equal(august.is_prorated, true);

const september = context.billingCalculateRentForBillMonth_(31000, contract, '2026-09');
assert.equal(september.monthly_rent_amount, 31000);
assert.equal(september.occupied_days, 30);
assert.equal(september.days_in_month, 30);
assert.equal(september.rent_amount, 31000);
assert.equal(september.is_prorated, false);

const initialAugustBill = context.billingBuildInitItem_(
  { room_id: 'R302', room_name: '302', rent_amount: 31000 },
  { ...contract, contract_id: 'C302', tenant_id: 'T302' },
  { tenant_id: 'T302', tenant_name: '測試房客' },
  null,
  null,
  '2026-08',
  {}
);
assert.equal(initialAugustBill.rent_amount, 25000);
assert.equal(initialAugustBill.rent_is_prorated, true);
assert.equal(initialAugustBill.rent_occupied_days, 25);

const historicalAugustBill = context.billingBuildInitItem_(
  { room_id: 'R302', room_name: '302', rent_amount: 31000 },
  { ...contract, contract_id: 'C302', tenant_id: 'T302' },
  { tenant_id: 'T302', tenant_name: '測試房客' },
  { rent_amount: 31000, other_amount: 0, discount_amount: 0, note: '' },
  null,
  '2026-08',
  {}
);
assert.equal(historicalAugustBill.rent_amount, 31000);
assert.equal(historicalAugustBill.rent_is_prorated, false);
assert.equal(historicalAugustBill.rent_occupied_days, null);

console.log('Phase 222 billing rent proration runtime tests passed.');
