import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tenantPage = readFileSync(new URL('../tenant-contract.html', import.meta.url), 'utf8');
const landlordPage = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');

for (const marker of ['完整合約內容', '閱讀完整合約', 'tenantSignatureCanvas', 'tenantSigningConsent', '送交簽署資料']) {
  assert.match(tenantPage, new RegExp(marker), `missing tenant signing marker: ${marker}`);
}
assert.match(tenantPage, /details[^>]+open/);
assert.match(tenantPage, /tenant_signing_submitted_at|tenant_signed_at/);
for (const marker of ['完整合約', '檢視完整合約', 'contract_document', 'terms_document', '核准生效']) {
  assert.match(landlordPage, new RegExp(marker), `missing landlord review marker: ${marker}`);
}
assert.match(landlordPage, /review-contract-content/);

console.log('Phase 155 complete contract UI tests passed.');
