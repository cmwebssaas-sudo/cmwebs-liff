import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const landlordRequestsPage = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');
const landlordCreatePage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const tenantContractPage = readFileSync(new URL('../tenant-contract.html', import.meta.url), 'utf8');

for (const [name, source] of [
  ['landlord-contract-requests.html', landlordRequestsPage],
  ['landlord-tenant-create.html', landlordCreatePage],
  ['tenant-contract.html', tenantContractPage]
]) {
  assert.match(source, /async function fetchStatusJson\(url\)/, `${name} must use fetch status helper`);
  assert.match(source, /return response\.json\(\);/, `${name} must parse JSON status responses`);
}

assert.match(landlordRequestsPage, /fetchStatusJson\(url\)/);
assert.match(landlordCreatePage, /fetchStatusJson\(url\)/);
assert.match(tenantContractPage, /fetchStatusJson\(url\)/);

console.log('Phase 161 status polling CORS tests passed.');
