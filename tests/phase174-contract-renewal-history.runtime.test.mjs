import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const sourcePath = new URL('../apps-script/V2_CONTRACT_RENEWAL_HISTORY.js', import.meta.url);
assert.equal(existsSync(sourcePath), true, 'renewal history module must exist before runtime tests can run');
const source = readFileSync(sourcePath, 'utf8');

const context = {
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  RegExp,
  Utilities: {
    getUuid: () => 'renewal-test-uuid'
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'V2_CONTRACT_RENEWAL_HISTORY.js' });

const previous = {
  contract_id: 'C603-2026',
  workspace_id: 'W1',
  tenant_id: 'T603',
  room_id: 'R603',
  start_date: '2025-10-01',
  end_date: '2026-09-30',
  rent_amount: 24000,
  monthly_rent: 24000,
  management_fee: 500,
  monthly_management_fee: 500,
  deposit_amount: 48000,
  other_fixed_fee_amount: 300,
  other_fixed_fee_note: '網路費',
  payment_day: 5,
  monthly_payment_day: 5,
  terms_snapshot_json: '{"pets":false,"quiet_hours":"22:00"}',
  contract_status: 'active',
  special_offer_enabled: true,
  special_offer_notice_days: 30,
  special_offer_clause: '租約期滿如不再續約，提前30個日曆日通知，免收違約金。'
};

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const defaults = context.contractRenewalHistoryBuildDefaults_(previous, {
  now: '2026-08-27T00:00:00.000Z'
});

assert.deepEqual(plain(defaults), {
  start_date: '2026-10-01',
  end_date: '2027-09-30',
  term_months: 12,
  rent_amount: 24000,
  management_fee: 500,
  deposit_amount: 48000,
  other_fixed_fee_amount: 300,
  other_fixed_fee_note: '網路費',
  monthly_payment_day: 5,
  terms_snapshot_json: previous.terms_snapshot_json,
  special_offer_enabled: true,
  special_offer_notice_days: 30,
  special_offer_applies_to: 'expiry_non_renewal',
  special_offer_waiver_type: 'breach_penalty_waived',
  special_offer_clause: '租約期滿如不再續約，提前30個日曆日通知，免收違約金。',
  identity_document_mode: 'optional'
});

const oldFamily = context.contractRenewalHistoryResolveFamily_(previous, []);
assert.deepEqual(plain(oldFamily), {
  contract_family_id: 'C603-2026',
  renewal_sequence: 1
});

const versionTwo = context.contractRenewalHistoryBuildVersionFields_(previous, defaults, {
  contract_id: 'C603-2027'
});
assert.equal(versionTwo.contract_id, 'C603-2027');
assert.equal(versionTwo.contract_family_id, 'C603-2026');
assert.equal(Number(versionTwo.renewal_sequence), 2);
assert.equal(versionTwo.renewed_from_contract_id, 'C603-2026');

const versionThree = context.contractRenewalHistoryBuildVersionFields_(
  Object.assign({}, previous, {
    contract_id: 'C603-2027',
    contract_family_id: 'C603-2026',
    renewal_sequence: 2
  }),
  defaults,
  { contract_id: 'C603-2028' }
);
assert.equal(versionThree.contract_family_id, 'C603-2026');
assert.equal(Number(versionThree.renewal_sequence), 3);
assert.equal(versionThree.renewed_from_contract_id, 'C603-2027');

const offerContract = Object.assign({}, previous, {
  special_offer_enabled: true,
  special_offer_notice_days: 30,
  contract_end_date: '2026-09-30'
});
assert.deepEqual(
  plain(context.contractRenewalHistoryEvaluateNotice_(offerContract, '2026-08-31')),
  {
    applicable: true,
    decision: 'waived',
    notice_date: '2026-08-31',
    contract_end_date: '2026-09-30',
    notice_days: 30,
    days_before_expiry: 30,
    reason: 'NOTICE_PERIOD_MET'
  }
);
assert.equal(
  context.contractRenewalHistoryEvaluateNotice_(offerContract, '2026-09-01').decision,
  'landlord_review'
);
assert.equal(
  context.contractRenewalHistoryEvaluateNotice_(offerContract, '2026-08-31', {
    event: 'early_termination'
  }).applicable,
  false
);

const listed = context.contractRenewalHistoryList_([
  Object.assign({}, previous, { contract_status: 'renewed' }),
  Object.assign({}, versionThree, { contract_status: 'pending_tenant_signature' }),
  Object.assign({}, versionTwo, { contract_status: 'active' })
]);
assert.deepEqual(listed.map(item => item.contract_id), ['C603-2026', 'C603-2027', 'C603-2028']);
assert.equal(listed.filter(item => item.is_current).length, 1);
assert.equal(listed.find(item => item.contract_id === 'C603-2027').is_current, true);
assert.equal(listed.find(item => item.contract_id === 'C603-2026').read_only, true);

const carried = context.contractRenewalHistoryBuildCarriedDocumentReference_({
  document_id: 'DOC-OLD-FRONT',
  workspace_id: 'W1',
  tenant_id: 'T603',
  contract_id: 'C603-2026',
  document_type: 'identity_front',
  file_name: 'id-front.png',
  mime_type: 'image/png',
  sha256: 'hash-old',
  drive_file_id: 'drive-old'
}, 'C603-2027');
assert.deepEqual(plain(carried), {
  contract_id: 'C603-2027',
  document_type: 'identity_front',
  file_name: 'id-front.png',
  mime_type: 'image/png',
  sha256: 'hash-old',
  document_origin: 'carried_forward',
  source_document_id: 'DOC-OLD-FRONT',
  drive_file_id: 'drive-old'
});

console.log('Phase 174 contract renewal history runtime RED/GREEN tests passed.');
