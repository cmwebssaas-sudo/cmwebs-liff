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
assert.match(
  tenantDetailPage,
  /['"]Content-Type['"]\s*:\s*['"]text\/plain(?:;charset=UTF-8)?['"]/
);
assert.doesNotMatch(
  tenantDetailPage,
  /['"]Content-Type['"]\s*:\s*['"]application\/json['"]/
);
assert.match(tenantDetailPage, /tenantDocumentContractSelect/);
assert.match(tenantDetailPage, /tenantDocumentLegacyFile/);
assert.match(tenantDetailPage, /tenantDocumentIdFrontFile/);
assert.match(tenantDetailPage, /tenantDocumentIdBackFile/);
assert.match(tenantDetailPage, /tenantDocumentSelfieFile/);
assert.match(tenantDetailPage, /下載/);
assert.match(tenantDetailPage, /列印/);
assert.match(tenantDetailPage, /tenant-document-upload-state/);
assert.match(tenantDetailPage, /tenant-document-upload-state\[hidden\]/);
assert.match(tenantDetailPage, /is-complete/);
assert.match(tenantDetailPage, /tenantDocumentTypeIcon/);
assert.match(tenantDetailPage, /已上傳，無需重複上傳/);
assert.match(tenantDetailPage, /markTenantDocumentTypeUploaded/);
assert.match(tenantDetailPage, /isTenantDocumentTypeUploaded/);
assert.match(tenantDetailPage, /tenant-document-upload-actions/);
assert.match(tenantDetailPage, /bindTenantDocumentUploadActions/);
assert.match(tenantDetailPage, /data-tenant-document-upload-action/);
assert.match(tenantDetailPage, /tenant-document-drop-zone/);
assert.match(tenantDetailPage, /bindTenantDocumentDropZones/);
assert.match(tenantDetailPage, /data-tenant-document-drop-input/);
assert.match(tenantDetailPage, /dataTransfer\.files/);
assert.match(tenantDetailPage, /openTenantDocumentPrintWindow/);
const printWindowOpenIndex = tenantDetailPage.indexOf(
  'printOnly ? openTenantDocumentPrintWindow() : null'
);
const printRequestIndex = tenantDetailPage.indexOf(
  "'landlord_contract_document_download'"
);
assert.ok(
  printWindowOpenIndex >= 0 && printWindowOpenIndex < printRequestIndex,
  '列印視窗必須在文件下載 API 請求前建立'
);
assert.match(overviewPage, /openTenantDocumentPrintWindow/);
const overviewPrintWindowOpenIndex = overviewPage.indexOf(
  'printOnly ? openTenantDocumentPrintWindow() : null'
);
const overviewPrintRequestIndex = overviewPage.indexOf(
  "'landlord_contract_document_download'"
);
assert.ok(
  overviewPrintWindowOpenIndex >= 0 &&
    overviewPrintWindowOpenIndex < overviewPrintRequestIndex,
  '文件總覽列印視窗必須在文件下載 API 請求前建立'
);
assert.doesNotMatch(tenantDetailPage, /tenant-document-actions/);
assert.doesNotMatch(tenantDetailPage, /tenantInput/);

assert.match(overviewPage, /文件總覽/);
assert.match(overviewPage, /文件歸檔方式/);
assert.match(overviewPage, /landlord-tenant-detail\.html\?tenant_id=/);
assert.doesNotMatch(overviewPage, /id="tenantInput"/);
assert.match(morePage, /文件總覽/);
assert.match(morePage, /上傳請從房客資料進入/);

console.log('Tenant detail contract documents UI tests passed.');
