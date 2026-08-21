import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tenantDetailPage = readFileSync(
  new URL('../landlord-tenant-detail.html', import.meta.url),
  'utf8'
);
const overviewPage = readFileSync(
  new URL('../landlord-contract-documents.html', import.meta.url),
  'utf8'
);
const morePage = readFileSync(
  new URL('../landlord-more.html', import.meta.url),
  'utf8'
);

assert.match(tenantDetailPage, /文件與身份驗證/);
assert.match(tenantDetailPage, /landlord_contract_documents_init/);
assert.match(tenantDetailPage, /tenant_id:\s*TENANT_ID/);
assert.match(tenantDetailPage, /landlord_contract_document_upload/);
assert.match(tenantDetailPage, /tenantDocumentContractSelect/);
assert.match(tenantDetailPage, /tenantDocumentLegacyFile/);
assert.match(tenantDetailPage, /tenantDocumentIdFrontFile/);
assert.match(tenantDetailPage, /tenantDocumentIdBackFile/);
assert.match(tenantDetailPage, /tenantDocumentSelfieFile/);
assert.match(tenantDetailPage, /下載/);
assert.match(tenantDetailPage, /列印/);
assert.doesNotMatch(tenantDetailPage, /tenantInput/);

assert.match(overviewPage, /文件總覽/);
assert.match(overviewPage, /文件歸檔方式/);
assert.match(overviewPage, /landlord-tenant-detail\.html\?tenant_id=/);
assert.doesNotMatch(overviewPage, /id="tenantInput"/);
assert.match(morePage, /文件總覽/);
assert.match(morePage, /上傳請從房客資料進入/);

console.log('Tenant detail contract documents UI tests passed.');
