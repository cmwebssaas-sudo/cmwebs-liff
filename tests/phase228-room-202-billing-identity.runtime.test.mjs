import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const billingSource = readFileSync(
  new URL('../apps-script/V2_BILLING_MANAGEMENT.js', import.meta.url),
  'utf8'
);
const billingStart = billingSource.indexOf(
  'function billingBuildInitialRentCreditUpdate_('
);
const billingEnd = billingSource.indexOf(
  'function applyLandlordInitialRentCreditByLineUid_',
  billingStart
);

assert.notEqual(
  billingStart,
  -1,
  'billing correction calculation helper must exist'
);
assert.notEqual(
  billingEnd,
  -1,
  'billing correction calculation helper must have a stable boundary'
);

const billingContext = {
  Math,
  Number,
  String,
  Object,
  billingText_: value => value == null ? '' : String(value),
  billingNumber_: value => Number(value) || 0,
  billingInitialRentPaidNote_: amount =>
    '簽約時已收首月租金與管理費，本次帳單已折抵 NT$ ' +
    Math.round(amount).toLocaleString('en-US') + '。'
};

vm.runInNewContext(
  billingSource.slice(billingStart, billingEnd),
  billingContext,
  { filename: 'V2_BILLING_MANAGEMENT.js' }
);

const partiallyCreditedBill = {
  bill_id: 'B202-09',
  rent_amount: 0,
  management_fee: 500,
  electricity_amount: 0,
  equipment_amount: 0,
  other_amount: 0,
  subtotal_amount: 9000,
  discount_amount: 8500,
  total_amount: 500,
  payment_status: 'unpaid',
  tenant_visible_note: '簽約時已收本月租金，本次帳單已折抵 NT$ 8,500。'
};

const correction = billingContext.billingBuildInitialRentCreditUpdate_(
  partiallyCreditedBill
);

assert.equal(correction.success, true);
assert.equal(
  correction.updated.discount_amount,
  9000,
  'a previous rent-only credit must be extended by the remaining management fee'
);
assert.equal(correction.updated.total_amount, 0);
assert.equal(correction.updated.payment_status, 'paid');
assert.match(
  correction.updated.tenant_visible_note,
  /簽約時已收首月租金與管理費.*9,000/
);

const correctionWithOtherCharge = billingContext.billingBuildInitialRentCreditUpdate_(
  {
    ...partiallyCreditedBill,
    other_amount: 300,
    subtotal_amount: 9300,
    total_amount: 800
  }
);

assert.equal(correctionWithOtherCharge.updated.discount_amount, 9000);
assert.equal(
  correctionWithOtherCharge.updated.total_amount,
  300,
  'utility and other charges must remain payable after fixed-charge credit'
);
assert.equal(correctionWithOtherCharge.updated.payment_status, 'unpaid');
assert.equal(correctionWithOtherCharge.management_fee_credit_amount, 500);

const alreadyFullyCredited = billingContext.billingBuildInitialRentCreditUpdate_(
  {
    ...partiallyCreditedBill,
    other_amount: 300,
    subtotal_amount: 9300,
    discount_amount: 9000,
    total_amount: 300,
    tenant_visible_note: '簽約時已收首月租金與管理費，本次帳單已折抵 NT$ 9,000。'
  }
);

assert.equal(alreadyFullyCredited.updated.discount_amount, 9000);
assert.equal(
  alreadyFullyCredited.management_fee_credit_amount,
  0,
  'a completed rent plus management-fee credit must not be doubled'
);

const apiSource = readFileSync(
  new URL('../apps-script/V2_API.js', import.meta.url),
  'utf8'
);
const identityStart = apiSource.indexOf(
  'function v2ResolveLandlordArrearsTenantIdentity_('
);
const identityEnd = apiSource.indexOf(
  '\n\nfunction getLandlordArrearsByLineUid',
  identityStart
);

assert.notEqual(
  identityStart,
  -1,
  'arrears identity resolver must exist'
);
assert.notEqual(
  identityEnd,
  -1,
  'arrears identity resolver must have a stable boundary'
);

const apiContext = { String, Array, Object };
vm.runInNewContext(
  apiSource.slice(identityStart, identityEnd),
  apiContext,
  { filename: 'V2_API.js' }
);

const identity = apiContext.v2ResolveLandlordArrearsTenantIdentity_(
  {
    landlord_id: 'L1',
    workspace_id: 'W1',
    tenant_id: 'T202',
    room_id: 'R202',
    tenant_name: '測試'
  },
  'L1',
  [
    {
      landlord_id: 'L1',
      workspace_id: 'W1',
      tenant_id: 'T202',
      room_id: 'R999',
      tenant_name: '劉政璋（其他房）'
    },
    {
      landlord_id: 'L1',
      workspace_id: 'W1',
      tenant_id: 'T202',
      room_id: 'R202',
      tenant_name: '劉政璋'
    },
    {
      landlord_id: 'L1',
      workspace_id: 'W1',
      tenant_id: 'OTHER',
      room_id: 'R202',
      tenant_name: '不應套用的房客'
    }
  ],
  [
    {
      landlord_id: 'L1',
      workspace_id: 'W1',
      tenant_id: 'T202',
      tenant_name: '房客主檔名稱'
    }
  ]
);

assert.equal(
  identity.tenant_name,
  '劉政璋',
  'arrears must use the room-matched landlord tenant-list identity instead of a stale bill snapshot'
);

console.log('Phase 228 room 202 billing and identity tests passed.');
