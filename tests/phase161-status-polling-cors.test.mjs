import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const landlordRequestsPage = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');
const landlordCreatePage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const tenantContractPage = readFileSync(new URL('../tenant-contract.html', import.meta.url), 'utf8');
const productionApiPath = 'AKfycbwnnuIFZ22eO6MxMnWOYHovgMT2xuTbcIgzbq4qmxXE3gjGoTJFcBGXlsNDS-lqr3EILQ';

for (const [name, source] of [
  ['tenant-contract.html', tenantContractPage]
]) {
  assert.match(source, /async function fetchStatusJson\(url\)/, `${name} must use fetch status helper`);
  assert.match(source, /return response\.json\(\);/, `${name} must parse JSON status responses`);
}

assert.match(landlordRequestsPage, /fetchStatusJson\(url\)/);
// Native landlord exchange behavior is covered by the runtime regression:
// Apps Script status JSONP avoids dependence on redirect CORS response access.
assert.match(tenantContractPage, /fetchStatusJson\(url\)/);
assert.match(landlordCreatePage, /function jsonpRequestWithoutLineUserId\(/);
assert.match(landlordCreatePage, /landlord_contract_signing_review_auth_status/);
assert.doesNotMatch(
  landlordCreatePage.match(/function callLandlordReviewAuthStatus\([\s\S]*?\n    }/)?.[0] || '',
  /fetchStatusJson\(/,
  'mobile landlord create auth status must use JSONP instead of fetch redirect handling'
);

for (const [name, source] of [
  ['landlord-contract-requests.html', landlordRequestsPage],
  ['landlord-tenant-create.html', landlordCreatePage],
  ['tenant-contract.html', tenantContractPage]
]) {
  assert.match(source, new RegExp(productionApiPath), `${name} must target the serving Production Apps Script`);
}

console.log('Phase 161 status polling CORS tests passed.');
