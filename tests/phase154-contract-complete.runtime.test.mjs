import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sessionSource = readFileSync(
  new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url),
  'utf8'
);
const reviewSource = readFileSync(
  new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js', import.meta.url),
  'utf8'
);
const context = { Date, Math, Number, String, Object, Array, JSON };
vm.createContext(context);
vm.runInContext(sessionSource, context, { filename: 'V2_TENANT_LIFF_SIGNING_SESSION.js' });
vm.runInContext(reviewSource, context, { filename: 'V2_TENANT_CONTRACT_SIGNING_REVIEW.js' });

const contract = {
  contract_id: 'C1',
  workspace_id: 'W1',
  tenant_id: 'T1',
  landlord_name: '房東甲',
  tenant_name: '房客乙',
  property_name: '幸福公寓',
  property_address: '台北市測試路 1 號',
  room_name: '603',
  start_date: '2026-08-01',
  end_date: '2027-07-31',
  rent_amount: 25000,
  management_fee: 1000,
  deposit_amount: 50000,
  monthly_payment_day: 5,
  contract_status: 'pending_tenant_signature',
  signing_mode: 'new_tenant'
};

const view = context.tenantLiffSigningContractView_([contract], contract, 'new_tenant');
assert.equal(view.terms_document.available, true, 'a complete contract must be available when canonical fields are present');
assert.match(view.terms_document.content, /租賃契約書/);
for (const section of ['當事人', '租賃標的', '租賃期間', '租金與押金', '付款方式', '使用與修繕', '提前終止', '爭議處理', '簽署確認']) {
  assert.match(view.terms_document.content, new RegExp(section), `missing generated contract section: ${section}`);
}
assert.match(view.terms_document.content, /房東甲/);
assert.match(view.terms_document.content, /603/);
assert.match(view.terms_document.content, /25,000|25000/);
assert.equal(view.terms_document.source, 'generated_standard_contract');

const reviewView = context.tenantContractSigningReviewPublicContract_(contract);
assert.equal(reviewView.terms_document.available, true);
assert.match(reviewView.terms_document.content, /租賃契約書/);
assert.equal(reviewView.contract_snapshot.contract_id, 'C1');
assert.equal(reviewView.contract_snapshot.room_name, '603');

console.log('Phase 154 complete contract runtime tests passed.');
