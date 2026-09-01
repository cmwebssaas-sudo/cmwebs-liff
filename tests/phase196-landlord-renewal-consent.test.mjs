import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const initiatedSource = readFileSync(
  new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url),
  'utf8'
);
const requestsSource = readFileSync(
  new URL('../apps-script/V2_CONTRACT_REQUESTS.js', import.meta.url),
  'utf8'
);
const dispatcherSource = readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);
const landlordPage = readFileSync(
  new URL('../landlord-contract-requests.html', import.meta.url),
  'utf8'
);
const tenantPage = readFileSync(
  new URL('../tenant-contract.html', import.meta.url),
  'utf8'
);
const tenantRenewalPage = readFileSync(
  new URL('../tenant-renewal.html', import.meta.url),
  'utf8'
);

assert.match(initiatedSource, /landlord_contract_renewal_inquiry_send/);
assert.match(initiatedSource, /landlord_contract_renewal_send/);
assert.match(initiatedSource, /renewal_inquiry_status/);
assert.match(initiatedSource, /renewal_tenant_intent/);
assert.match(initiatedSource, /function landlordInitiatedContractSendRenewalInquiry_/);
assert.match(initiatedSource, /function landlordInitiatedContractSendRenewal_/);
assert.match(initiatedSource, /function landlordInitiatedContractUpdateRenewalIntentByLineUid_/);
assert.match(requestsSource, /TENANT_RENEWAL_LANDLORD_INITIATED_ONLY/);
assert.match(dispatcherSource, /tenant_contract_renewal_intent/);
assert.match(landlordPage, /詢問房客續約意願/);
assert.match(landlordPage, /發送合約簽署/);
assert.match(landlordPage, /special_offer_enabled/);
assert.match(tenantPage, /同意續約/);
assert.match(tenantPage, /暫不續約/);
assert.match(tenantRenewalPage, /續約由房東發起/);

const context = { Date, Math, Number, String, Object, Array, JSON, RegExp };
vm.createContext(context);
vm.runInContext(initiatedSource, context, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });

assert.equal(typeof context.landlordInitiatedContractRenewalReviewTransition_, 'function');
const reviewed = context.landlordInitiatedContractRenewalReviewTransition_({
  signing_mode: 'renewal',
  contract_status: 'pending_landlord_review',
  renewal_review_status: 'pending',
  renewal_inquiry_status: 'pending',
  renewal_tenant_intent: 'pending',
  invite_id: ''
}, '2026-09-01T00:00:00.000Z');
assert.equal(reviewed.success, true, reviewed.code);
assert.equal(reviewed.updates.renewal_review_status, 'confirmed');
assert.equal(reviewed.updates.renewal_inquiry_status, 'sent');
assert.equal(reviewed.updates.renewal_tenant_intent, 'pending');
assert.equal(reviewed.send_inquiry, true);
assert.equal(reviewed.create_invite, false, 'landlord review must not create a tenant invite');

const inquiry = context.landlordInitiatedContractRenewalInquiryTransition_({
  signing_mode: 'renewal',
  contract_status: 'pending_landlord_review',
  renewal_review_status: 'confirmed',
  renewal_inquiry_status: 'sent',
  renewal_tenant_intent: 'pending',
  invite_id: ''
}, '2026-09-01T00:00:00.000Z');
assert.equal(inquiry.success, false);
assert.equal(inquiry.code, 'RENEWAL_INQUIRY_ALREADY_SENT');

const accepted = context.landlordInitiatedContractRenewalIntentTransition_({
  signing_mode: 'renewal',
  contract_status: 'pending_landlord_review',
  renewal_review_status: 'confirmed',
  renewal_inquiry_status: 'sent',
  renewal_tenant_intent: 'pending',
  invite_id: ''
}, 'accepted', '2026-09-01T00:00:00.000Z');
assert.equal(accepted.success, true, accepted.code);
assert.equal(accepted.updates.renewal_tenant_intent, 'accepted');

const sendGuard = context.landlordInitiatedContractRenewalSendGuard_({
  signing_mode: 'renewal',
  contract_status: 'pending_landlord_review',
  renewal_review_status: 'confirmed',
  renewal_inquiry_status: 'sent',
  renewal_tenant_intent: 'pending',
  invite_id: ''
});
assert.equal(sendGuard.success, false);
assert.equal(sendGuard.code, 'RENEWAL_TENANT_INTENT_REQUIRED');

console.log('Phase 196 landlord renewal consent tests passed.');
