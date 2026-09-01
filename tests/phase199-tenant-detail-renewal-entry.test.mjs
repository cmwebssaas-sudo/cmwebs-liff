import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tenantDetailSource = readFileSync(
  new URL('../landlord-tenant-detail.html', import.meta.url),
  'utf8'
);
const contractRequestsSource = readFileSync(
  new URL('../landlord-contract-requests.html', import.meta.url),
  'utf8'
);

assert.match(
  tenantDetailSource,
  /function goTenantRenewal\(contractId\)[\s\S]*?mode[\s\S]*?renewal[\s\S]*?previous_contract_id/,
  'tenant detail must navigate directly to the one-page renewal form with the selected contract'
);
assert.match(
  tenantDetailSource,
  /function renderContractHistory\(contracts\)[\s\S]*?goTenantRenewal\(/,
  'each eligible contract version must expose the renewal entry from tenant detail'
);
assert.match(
  tenantDetailSource,
  /const canRenew = \['active', 'expired', 'approved', 'completed'\]/,
  'only current or completed predecessor contract states may expose renewal'
);
assert.match(
  tenantDetailSource,
  /目前合約|已到期合約|發起續約/,
  'tenant detail must explain or label the renewal entry'
);
assert.doesNotMatch(
  contractRequestsSource,
  /function startLandlordRenewal\(/,
  'contract request page must not remain the primary renewal entry'
);
assert.doesNotMatch(
  contractRequestsSource,
  /從現有或已到期合約發起續約/,
  'contract request page must focus on processing existing requests'
);

console.log('Phase 199 tenant detail renewal entry tests passed.');
