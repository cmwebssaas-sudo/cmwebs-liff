import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const worktree = new URL('..', import.meta.url);
const createPage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const tenantsPage = readFileSync(new URL('../landlord-tenants.html', import.meta.url), 'utf8');
const initiatedSource = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');

assert.match(createPage, /SIMPLE_NEW_MODE/);
assert.match(createPage, /function renderSimpleNewContractPage\(/);
assert.match(createPage, /simple_flow:\s*SIMPLE_NEW_MODE/);
assert.match(createPage, /id="termMonths"/);
assert.match(createPage, /房東只需填寫房號、租金、押金與租期/);
assert.match(createPage, /identity_document_mode/);

const tenantActionSource = tenantsPage.slice(
  tenantsPage.indexOf('class="tenant-actions'),
  tenantsPage.indexOf('</section>', tenantsPage.indexOf('class="tenant-actions'))
);
assert.match(tenantActionSource, /contract\.totalActive\s*>\s*0/);
assert.doesNotMatch(
  tenantActionSource,
  /contract\.totalActive\s*>\s*0[\s\S]{0,260}合約申請紀錄[\s\S]{0,260}<\/button>/,
  'a tenant without a pending contract must not receive the history button'
);

const context = {
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  RegExp
};
vm.createContext(context);
vm.runInContext(initiatedSource, context, {
  filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js'
});

const normalized = context.landlordInitiatedContractNormalizeInput_({
  simple_flow: true,
  room_id: 'R506',
  start_date: '2026-09-01',
  term_months: 12,
  rent_amount: '7500',
  deposit_amount: '15000',
  initial_rent_paid: true
});

assert.equal(normalized.success, true, normalized.message);
assert.equal(normalized.data.end_date, '2027-08-31');
assert.equal(normalized.data.term_months, 12);
assert.equal(normalized.data.payment_day, 0);
assert.equal(normalized.data.initial_rent_paid_month, '2026-09');
assert.equal(normalized.data.initial_rent_paid_amount, 7500);

const resolved = context.landlordInitiatedContractResolveNewDefaults_(normalized.data, {
  property_id: 'P1',
  management_fee: 500,
  deposit_months: 2,
  payment_day: 5,
  electricity_fee_rate: 3,
  equipment_fee_rate: 3.5
});

assert.equal(resolved.success, true, resolved.message);
assert.equal(resolved.data.property_id, 'P1');
assert.equal(resolved.data.management_fee, 500);
assert.equal(resolved.data.initial_rent_paid_amount, 8000);
assert.equal(resolved.data.deposit_months, 2);
assert.equal(resolved.data.payment_day, 5);
assert.equal(resolved.data.electricity_fee_rate, 3);
assert.equal(resolved.data.equipment_fee_rate, 3.5);

const mismatch = context.landlordInitiatedContractNormalizeInput_({
  simple_flow: true,
  room_id: 'R506',
  start_date: '2026-09-01',
  end_date: '2027-09-01',
  term_months: 12,
  rent_amount: 7500,
  deposit_amount: 15000
});
assert.equal(mismatch.success, false);
assert.equal(mismatch.code, 'CONTRACT_TERM_MISMATCH');

console.log('Phase 208 simple landlord contract flow RED/GREEN tests passed.');
