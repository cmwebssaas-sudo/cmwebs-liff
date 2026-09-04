import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function extractFunction(source, name, endMarker) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} must end before ${endMarker}`);

  return source.slice(start, end);
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

const billingSource = readFileSync(
  new URL('../apps-script/V2_BILLING_MANAGEMENT.js', import.meta.url),
  'utf8'
);
const billingContext = {
  Math,
  billingText_: text,
  billingNumber_: value => Number(value) || 0,
  billingInitialRentCreditForBillMonth_: () => 0,
  billingDate_: value => text(value) || null,
  billingNormalizePaymentStatus_: value => text(value) || 'unpaid',
  billingBuildInitItem_: () => ({
    tenant_id: 'T302',
    tenant_line_user_id: 'line-302',
    tenant_name: '測試房客',
    contract_id: 'C302',
    property_id: 'P1',
    property_name: '測試物件',
    room_id: 'R302',
    room_name: '302',
    rent_amount: 8500,
    management_fee: 0,
    previous_meter: 100,
    previous_meter_locked: false,
    electricity_fee_rate: 0,
    equipment_fee_rate: 0,
    equipment_fee_rate_summer: 0,
    equipment_fee_rate_regular: 0,
    season: 'regular',
    requires_meter: false
  })
};

vm.runInNewContext(
  extractFunction(
    billingSource,
    'billingCalculateBill_',
    '\n\n// ==================================================\n// View synchronization'
  ),
  billingContext,
  { filename: 'V2_BILLING_MANAGEMENT.js' }
);

const calculatedBill = billingContext.billingCalculateBill_(
  { workspace_id: 'WS1' },
  {
    workspace_id: 'WS1',
    landlord_id: 'L1',
    landlord_line_user_id: 'landlord-line',
    tenant_user_id: 'U302'
  },
  { tenant_user_id: 'U302' },
  null,
  null,
  '2026-09',
  {
    current_meter_reading: '',
    due_date: '2026-09-10',
    other_amount: 0,
    discount_amount: 1645,
    note: '房東內部核對：已確認原帳單。',
    tenant_visible_note: '8/1–8/6 超收租金折抵。'
  },
  {}
);

assert.equal(
  calculatedBill.note,
  '房東內部核對：已確認原帳單。',
  'bill calculation must retain the landlord-only note'
);
assert.equal(
  calculatedBill.tenant_visible_note,
  '8/1–8/6 超收租金折抵。',
  'bill calculation must retain the tenant-visible adjustment explanation'
);

vm.runInNewContext(
  extractFunction(
    billingSource,
    'billingBillHeaders_',
    '\n\nfunction billingBillViewHeaders_'
  ),
  billingContext,
  { filename: 'V2_BILLING_MANAGEMENT.js' }
);

assert.ok(
  billingContext.billingBillHeaders_().includes('tenant_visible_note'),
  'billing schema must add the tenant-visible explanation field without replacing the internal note'
);

const apiSource = readFileSync(
  new URL('../apps-script/V2_API.js', import.meta.url),
  'utf8'
);
const apiContext = {
  tenantBillsRuntimeFirst_: (row, keys) =>
    keys.map(key => row[key]).find(value => text(value)) || '',
  tenantBillsRuntimeText_: text,
  tenantBillsRuntimeFormatMonth_: value => text(value),
  tenantBillsRuntimeFormatDate_: value => text(value),
  tenantBillsRuntimeNumber_: value => Number(value) || 0,
  tenantBillsRuntimeJsonSafeValue_: value => value,
  v2CanonicalBillPaymentStatus_: value => text(value) || 'unpaid'
};

vm.runInNewContext(
  extractFunction(
    apiSource,
    'tenantBillsRuntimePublicBill_',
    '\n\nfunction tenantBillsRuntimePayload_'
  ),
  apiContext,
  { filename: 'V2_API.js' }
);

const tenantBill = apiContext.tenantBillsRuntimePublicBill_(
  {
    bill_id: 'B0000024',
    bill_month: '2026-09',
    room_name: '302',
    discount_amount: 1645,
    total_amount: 7145,
    payment_status: 'unpaid',
    note: '房東內部核對：已確認原帳單。',
    tenant_visible_note: '8/1–8/6 超收租金折抵。'
  },
  {
    tenant_id: 'T302',
    tenant_user_id: 'U302',
    tenant_name: '測試房客',
    workspace_id: 'WS1',
    contract_id: 'C302'
  }
);

assert.equal(
  tenantBill.tenant_visible_note,
  '8/1–8/6 超收租金折抵。',
  'tenant bill API must expose the tenant-visible explanation'
);
assert.equal(
  Object.hasOwn(tenantBill, 'note'),
  false,
  'tenant bill API must not expose the landlord-only note'
);

const tenantPageSource = readFileSync(
  new URL('../tenant-bills.html', import.meta.url),
  'utf8'
);
const adjustmentContext = {
  Math,
  pickValue: (value, keys, fallback) =>
    keys.map(key => value[key]).find(item => item != null && String(item).trim()) ?? fallback,
  pickNumber: (value, keys, fallback) => {
    const found = keys.map(key => value[key]).find(item => item != null && String(item).trim());
    return found == null ? fallback : Number(found) || 0;
  }
};

vm.runInNewContext(
  extractFunction(
    tenantPageSource,
    'tenantVisibleAdjustmentOf',
    '\n\n    function '
  ),
  adjustmentContext,
  { filename: 'tenant-bills.html' }
);

const adjustment = adjustmentContext.tenantVisibleAdjustmentOf({
  discount_amount: 1645,
  tenant_visible_note: '8/1–8/6 超收租金折抵。',
  note: '不得外洩的房東內部備註'
});

assert.equal(
  adjustment.amount,
  1645,
  'tenant UI helper must show the bill adjustment amount'
);
assert.equal(
  adjustment.note,
  '8/1–8/6 超收租金折抵。',
  'tenant UI helper must use only the tenant-visible explanation'
);
assert.equal(
  adjustment.visible,
  true,
  'tenant UI helper must show the adjustment detail when an amount or explanation exists'
);

const privateOnlyAdjustment = adjustmentContext.tenantVisibleAdjustmentOf({
  note: '不得外洩的房東內部備註'
});

assert.equal(
  privateOnlyAdjustment.note,
  '',
  'tenant UI helper must never fall back to the landlord-only note'
);
assert.equal(
  privateOnlyAdjustment.visible,
  false,
  'tenant UI helper must not render an adjustment explanation for an internal note alone'
);

const notificationSource = readFileSync(
  new URL('../apps-script/V2_BILL_NOTIFICATIONS.js', import.meta.url),
  'utf8'
);
const notificationContext = {
  V2_BILL_NOTIFICATION_TENANT_LIFF_URL_: 'https://example.test/tenant-bills.html',
  billNotificationMoneyText_: value => String(Math.round(Number(value) || 0))
};

vm.runInNewContext(
  extractFunction(
    notificationSource,
    'billNotificationBuildMessage_',
    '\n\nfunction billNotificationStatusLabel_'
  ),
  notificationContext,
  { filename: 'V2_BILL_NOTIFICATIONS.js' }
);

const tenantNotification = notificationContext.billNotificationBuildMessage_({
  send_count: 0,
  tenant_name: '測試房客',
  property_name: '測試物件',
  room_name: '302',
  bill_month: '2026-09',
  due_date: '2026-09-10',
  rent_amount: 8500,
  management_fee: 0,
  electricity_amount: 134,
  equipment_amount: 156,
  other_amount: 0,
  discount_amount: 1645,
  total_amount: 7145,
  tenant_visible_note: '8/1–8/6 超收租金折抵。'
});

assert.match(
  tenantNotification,
  /8\/1–8\/6 超收租金折抵。/,
  'a manually sent tenant bill notification must include the tenant-visible adjustment explanation'
);

console.log('Phase 223 tenant-visible adjustment detail runtime tests passed.');
