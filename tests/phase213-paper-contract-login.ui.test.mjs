import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const propertiesPage = readFileSync(new URL('../landlord-properties.html', import.meta.url), 'utf8');
const createPage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../apps-script/V2_TENANT_LEASE_ONBOARDING.js', import.meta.url), 'utf8');

assert.match(propertiesPage, /paper_backfill_replacement_eligible/);
assert.match(propertiesPage, /supersede_contract_id/);
assert.match(propertiesPage, /補登紙本並建立房客登入/);
assert.match(createPage, /REQUESTED_SUPERSEDE_CONTRACT_ID/);
assert.match(createPage, /supersede_contract_id:/);
assert.match(createPage, /房客登入入口/);
assert.match(createPage, /首次登入請輸入.*手機號碼.*綁定/);
assert.match(onboardingSource, /selectedTenantContract/);
assert.match(onboardingSource, /supersedeContractId/);
assert.match(onboardingSource, /rent_amount:/);
assert.match(onboardingSource, /contract_start_date:/);

console.log('Phase 213 paper contract login UI tests passed.');
