import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const reviewSource = readFileSync(
  new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js', import.meta.url),
  'utf8'
);

const reviewRuntime = {
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  tenantContractDocumentPreview_: () => ({
    available: true,
    version: 'fixed-google-doc-template',
    content: '房屋租賃契約書\n房號：603\n乙方簽名（線上簽署）',
    signature_image: {
      mime_type: 'image/png',
      base64: 'AQID'
    }
  })
};
vm.createContext(reviewRuntime);
vm.runInContext(reviewSource, reviewRuntime, {
  filename: 'V2_TENANT_CONTRACT_SIGNING_REVIEW.js'
});

const contract = {
  contract_id: 'C603',
  workspace_id: 'W1',
  tenant_id: 'T603',
  tenant_name: '測試房客',
  room_name: '603',
  contract_status: 'pending_tenant_signature',
  tenant_signing_submission_status: 'submitted',
  tenant_signed_at: '2026-08-26T01:00:00.000Z',
  signing_mode: 'renewal'
};

const landlordReview = reviewRuntime.tenantContractSigningReviewPublicContract_(contract);
assert.equal(landlordReview.terms_document.signature_image.mime_type, 'image/png');
assert.equal(
  landlordReview.terms_document.signature_image.base64,
  'AQID',
  'the landlord review read model must include the stored tenant signature preview'
);

const landlordReviewSource = readFileSync(
  new URL('../landlord-contract-requests.html', import.meta.url),
  'utf8'
);
assert.match(
  landlordReviewSource,
  /signature_image/,
  'the landlord review card must render the signed preview payload'
);
assert.match(
  landlordReviewSource,
  /native_signing_reviews_error/,
  'the landlord page must retain native-review route errors instead of hiding them as an empty queue'
);

const tenantDetailSource = readFileSync(
  new URL('../landlord-tenant-detail.html', import.meta.url),
  'utf8'
);
const dispatcherSource = readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);
assert.match(tenantDetailSource, /landlord_contract_documents_init/);
assert.equal(
  existsSync(new URL('../apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js', import.meta.url)),
  true,
  'the Apps Script document module must be part of the same release tree as the tenant-detail page'
);
assert.match(
  dispatcherSource,
  /landlord_contract_documents_init/,
  'the document-management init route must be registered in the dispatcher'
);

console.log('Phase 169 landlord signed-contract view regression tests passed.');
