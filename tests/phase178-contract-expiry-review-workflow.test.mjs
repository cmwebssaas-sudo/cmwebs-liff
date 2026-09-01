import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const expiryModule = new URL('../apps-script/V2_CONTRACT_EXPIRY_RENEWALS.js', import.meta.url);
const initiatedContracts = readFileSync(
  new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url),
  'utf8'
);
const requestsPage = readFileSync(
  new URL('../landlord-contract-requests.html', import.meta.url),
  'utf8'
);
const tenantsPage = readFileSync(
  new URL('../landlord-tenants.html', import.meta.url),
  'utf8'
);

assert.equal(
  existsSync(expiryModule),
  true,
  'contract expiry scheduler module must exist'
);

const expirySource = readFileSync(expiryModule, 'utf8');

assert.match(expirySource, /function contractExpiryRenewalRunDaily_\(/);
assert.match(expirySource, /function installContractExpiryRenewalDailyTrigger\(\)/);
assert.match(
  expirySource,
  /function installContractExpiryRenewalDailyTrigger\(\)\s*\{\s*return contractExpiryRenewalEnsureDailyTrigger_\(\);\s*\}/
);
assert.match(expirySource, /function contractExpiryRenewalEnsureDailyTrigger_\(/);
assert.match(expirySource, /function contractExpiryRenewalPrepareDraft_\(/);
assert.match(expirySource, /function contractExpiryRenewalNotifyLandlord_\(/);
assert.match(expirySource, /V2_CONTRACT_EXPIRY_RENEWAL_DRAFT_STATUS_\s*=\s*'pending_landlord_review'/);
assert.match(expirySource, /60/);
assert.match(expirySource, /30/);
assert.match(expirySource, /atHour\(V2_CONTRACT_EXPIRY_RENEWAL_TRIGGER_HOUR_\)/);
assert.match(
  initiatedContracts,
  /'landlord_contract_renewal_review_confirm'/,
  'landlord confirmation action must be routed'
);
assert.match(
  initiatedContracts,
  /function landlordInitiatedContractConfirmRenewalReview_/,
  'confirmation must record landlord review before tenant inquiry'
);
assert.match(requestsPage, /待房東審查/);
assert.match(requestsPage, /詢問房客續約意願/);
assert.match(requestsPage, /landlord_contract_renewal_review_confirm/);
assert.match(tenantsPage, /contract_end_date/);
assert.match(tenantsPage, /function formatContractExpiry/);
assert.match(tenantsPage, /合約到期/);

console.log('Phase 178 contract expiry review workflow tests passed.');
