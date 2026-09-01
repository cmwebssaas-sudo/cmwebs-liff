import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const createPage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const requestsPage = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');
const tenantDetailPage = readFileSync(new URL('../landlord-tenant-detail.html', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../apps-script/V2_TENANT_LEASE_ONBOARDING.js', import.meta.url), 'utf8');
const initiatedSource = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');
const signingSessionSource = readFileSync(new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url), 'utf8');
const dispatcherSource = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');
const tenantContractPage = readFileSync(new URL('../tenant-contract.html', import.meta.url), 'utf8');

assert.match(initiatedSource, /function landlordInitiatedContractCreateDirectRenewal_\(access, input\)/);
assert.match(initiatedSource, /'landlord_contract_initiate_renewal_direct'/);
assert.match(initiatedSource, /\['active', 'expired', 'approved', 'completed'\]/);
assert.match(initiatedSource, /fixed-google-doc-template-1/);
assert.match(initiatedSource, /renewal_inquiry_status: 'manual_direct'/);
assert.match(initiatedSource, /renewal_tenant_intent: 'manual_direct'/);
assert.match(initiatedSource, /\['new_tenant', 'renewal'\]/);
assert.match(signingSessionSource, /const artifactRequirements = signingMode === 'renewal'/);

assert.match(dispatcherSource, /'landlord_contract_initiate_renewal_direct'/);
assert.match(dispatcherSource, /e\.parameter\.previous_contract_id/);
assert.match(onboardingSource, /previousContractId/);
assert.match(onboardingSource, /renewal_source:/);

assert.match(createPage, /REQUESTED_CONTRACT_MODE/);
assert.match(createPage, /REQUESTED_PREVIOUS_CONTRACT_ID/);
assert.match(createPage, /id="specialOfferEnabled"/);
assert.match(createPage, /提前 30 天通知不續約，免收違約金/);
assert.match(createPage, /landlord_contract_initiate_renewal_direct/);
assert.match(createPage, /previous_contract_id:/);

assert.doesNotMatch(requestsPage, /function startLandlordRenewal\(/);
assert.match(tenantDetailPage, /function goTenantRenewal\(contractId\)/);
assert.match(tenantDetailPage, /onclick="goTenantRenewal\(/);
assert.match(tenantDetailPage, /發起續約/);
assert.match(tenantContractPage, /TENANT_SIGNING_MODE = signingMode/);
assert.match(tenantContractPage, /artifact_requirements/);

console.log('Phase 198 direct renewal signing static checks passed.');
