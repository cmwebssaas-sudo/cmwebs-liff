import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../landlord-billing.html', import.meta.url),
  'utf8'
);
const start = source.indexOf('function billCard(');
const end = source.indexOf('\n    function baseItem(', start);

assert.notEqual(start, -1, 'billCard must exist');
assert.notEqual(end, -1, 'billCard must have a stable boundary');

const context = {
  Number,
  String,
  Math,
  rawText: value => value == null ? '' : String(value),
  safeHtml: value => String(value == null ? '' : value),
  money: value => String(Math.round(Number(value || 0))),
  formatRate: value => String(value == null ? '' : value),
  baseItem: (label, value) => `<base>${label}:${value}</base>`,
  calculationItem: (_index, key, label) => `<calc>${key}:${label}</calc>`
};

vm.runInNewContext(source.slice(start, end), context, {
  filename: 'landlord-billing.html'
});

const partiallyCredited = context.billCard({
  room_name: '202',
  property_name: '測試物件',
  tenant_name: '202 房客',
  rent_amount: 8500,
  management_fee: 500,
  discount_amount: 8500,
  tenant_visible_note: '簽約時已收首月租金，本次帳單已折抵 NT$ 8,500。',
  existing_bill: {
    bill_id: 'B202-09',
    payment_status: 'unpaid'
  }
}, 0);

assert.match(
  partiallyCredited,
  /首月租金＋管理費已於簽約時收取，套用折抵/,
  'a rent-only credit must still expose the correction action for the unpaid management fee'
);

const fullyCredited = context.billCard({
  room_name: '202',
  property_name: '測試物件',
  tenant_name: '202 房客',
  rent_amount: 8500,
  management_fee: 500,
  discount_amount: 9000,
  tenant_visible_note: '簽約時已收首月租金與管理費，本次帳單已折抵 NT$ 9,000。',
  existing_bill: {
    bill_id: 'B202-09',
    payment_status: 'paid'
  }
}, 0);

assert.doesNotMatch(
  fullyCredited,
  /首月租金＋管理費已於簽約時收取，套用折抵/,
  'a fully credited bill must not expose a duplicate correction action'
);

console.log('Phase 227 initial management credit visibility UI tests passed.');
