import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const detailPage = readFileSync(new URL('../landlord-tenant-detail.html', import.meta.url), 'utf8');
const checkoutPage = readFileSync(new URL('../landlord-tenant-checkout.html', import.meta.url), 'utf8');
const requestsPage = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');
const tenantContractPage = readFileSync(new URL('../tenant-contract.html', import.meta.url), 'utf8');
const terminationPage = readFileSync(new URL('../tenant-termination.html', import.meta.url), 'utf8');

assert.match(detailPage, /function goTenantCheckout\(contractId\)/);
assert.match(detailPage, /landlord-tenant-checkout\.html/);
assert.match(checkoutPage, /landlord_contract_checkout_init/);
assert.match(checkoutPage, /landlord_contract_checkout_complete/);
assert.match(requestsPage, /房東確認後自動詢問房客/);
assert.doesNotMatch(requestsPage, /onclick="sendRenewalInquiry\(/);
assert.doesNotMatch(requestsPage, /onclick="sendRenewalContract\(/);
assert.doesNotMatch(tenantContractPage, /onclick="goRequestPage\(\s*'tenant-termination\.html'/);
assert.match(tenantContractPage, /退租由房東處理/);
assert.match(terminationPage, /請等待房東辦理退房/);

console.log('Phase 203 landlord-led renewal checkout UI RED/GREEN tests passed.');
