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
assert.match(tenantDetailPage, /預覽/);
assert.match(tenantDetailPage, /tenant-document-upload-state/);
assert.match(tenantDetailPage, /tenant-document-upload-state\[hidden\]/);
assert.match(tenantDetailPage, /is-complete/);
assert.match(tenantDetailPage, /tenantDocumentTypeIcon/);
assert.match(tenantDetailPage, /已上傳，無需重複上傳/);
assert.match(tenantDetailPage, /markTenantDocumentTypeUploaded/);
assert.match(tenantDetailPage, /isTenantDocumentTypeUploaded/);
assert.match(tenantDetailPage, /tenant-document-preview-action/);
assert.match(tenantDetailPage, /bindTenantDocumentPreviewActions/);
assert.match(tenantDetailPage, /data-tenant-document-preview-action/);
assert.doesNotMatch(
  tenantDetailPage,
  /data-tenant-document-upload-action="(?:download|print)"/
);
assert.match(tenantDetailPage, /tenant-document-drop-zone/);
assert.match(tenantDetailPage, /bindTenantDocumentDropZones/);
assert.match(tenantDetailPage, /data-tenant-document-drop-input/);
assert.match(tenantDetailPage, /dataTransfer\.files/);
assert.match(tenantDetailPage, /tenant-document-action-modal/);
assert.match(tenantDetailPage, /openTenantDocumentActionModal/);
assert.match(tenantDetailPage, /tenantDocumentPreviewFrame/);
assert.match(tenantDetailPage, /tenantDocumentPreviewDownload/);
assert.match(tenantDetailPage, /printTenantDocumentPreview/);
assert.match(tenantDetailPage, /shareTenantDocumentPreview/);
assert.match(tenantDetailPage, /data-tenant-document-print/);
assert.match(tenantDetailPage, /data-tenant-document-share/);
assert.doesNotMatch(tenantDetailPage, /openTenantDocumentPrintWindow/);
assert.doesNotMatch(
  tenantDetailPage,
  /window\.open\(\s*['"]['"]\s*,\s*['"]_blank['"]/
);
assert.match(overviewPage, /document-action-modal/);
assert.match(overviewPage, /openDocumentActionModal/);
assert.match(overviewPage, /documentPreviewFrame/);
assert.match(overviewPage, /data-action="preview"/);
assert.match(overviewPage, /documentPreviewDownload/);
assert.match(overviewPage, /printDocumentPreview/);
assert.match(overviewPage, /shareDocumentPreview/);
assert.match(overviewPage, /data-document-print/);
assert.match(overviewPage, /data-document-share/);
assert.doesNotMatch(overviewPage, /data-action="(?:download|print)"/);
assert.doesNotMatch(overviewPage, /openTenantDocumentPrintWindow/);
assert.doesNotMatch(
  overviewPage,
  /window\.open\(\s*['"]['"]\s*,\s*['"]_blank['"]/
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
