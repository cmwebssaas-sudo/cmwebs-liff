import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiSource = readFileSync(
  new URL('../apps-script/V2_API.js', import.meta.url),
  'utf8'
);
const tenantsPage = readFileSync(
  new URL('../landlord-tenants.html', import.meta.url),
  'utf8'
);

assert.match(
  apiSource,
  /current_contract_id:\s*row\.current_contract_id,\s*contract_end_date:\s*row\.contract_end_date\s*\|\|\s*row\.end_date\s*\|\|\s*''/s,
  'landlord_tenants must return the current contract expiry date to the tenant list'
);
assert.match(
  tenantsPage,
  /function formatContractExpiry\(/,
  'tenant list must normalize contract expiry data in one helper'
);
assert.match(
  tenantsPage,
  /level:\s*days\s*<\s*0\s*\n?\s*\?\s*'expired'/s,
  'expired contracts must have a distinct visual state'
);
assert.match(
  tenantsPage,
  /contract-expiry\.expired\s*\{/,
  'expired contracts must use a high-visibility expiry style'
);
assert.match(
  tenantsPage,
  /合約到期日/,
  'tenant cards must label the expiry date explicitly'
);

console.log('Phase 194 landlord tenant expiry display tests passed.');
