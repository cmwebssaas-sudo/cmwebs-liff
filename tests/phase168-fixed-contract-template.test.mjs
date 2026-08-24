import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const documentSigningPath =
  'apps-script/V2_CONTRACT_DOCUMENT_SIGNING.js';
const sessionPath =
  'apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js';
const submissionPath =
  'apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js';
const tenantUiPath = 'tenant-contract.html';

assert.equal(
  existsSync(documentSigningPath),
  true,
  'fixed-template document signing module must exist'
);

const documentSigningSource = readFileSync(
  documentSigningPath,
  'utf8'
);
const sessionSource = readFileSync(sessionPath, 'utf8');
const submissionSource = readFileSync(submissionPath, 'utf8');
const tenantUiSource = readFileSync(tenantUiPath, 'utf8');

assert.match(
  documentSigningSource,
  /CMWEBS_CONTRACT_TEMPLATE_DOCUMENT_ID/,
  'the template must be selected from Script Properties'
);
assert.match(
  documentSigningSource,
  /makeCopy\(/,
  'signing must copy the fixed Google Doc before writing tenant data'
);
assert.match(
  documentSigningSource,
  /DocumentApp\.openById\(/,
  'the copied Google Doc must be opened for native writeback'
);
assert.match(
  documentSigningSource,
  /乙方簽名|signature/i,
  'the fixed document module must handle the signature position'
);
assert.match(
  documentSigningSource,
  /findText\([\s\S]*乙方簽名/,
  'the fixed document module must support the text signature slot in the supplied template'
);
assert.match(
  documentSigningSource,
  /簽署狀態：待承租人簽署。/,
  'the supplied template pending marker must be promoted after signing'
);

assert.match(
  sessionSource,
  /tenantContractDocumentPreview_\(/,
  'tenant preview must read the fixed template'
);
assert.doesNotMatch(
  sessionSource,
  /文件版本：CMWebs V2\.1 標準格式/,
  'the tenant signing session must not fall back to a different standard contract'
);
assert.match(
  submissionSource,
  /tenantContractDocumentMaterialize_\(/,
  'submission must materialize the fixed template as the signed document'
);
assert.match(
  submissionSource,
  /tenant_signed_document_record_id/,
  'submission must persist the signed document record on the contract'
);
assert.match(
  tenantUiSource,
  /完整合約內容（固定版型）/,
  'the tenant UI must render the supplied fixed-template contract content'
);

const runtime = { String, Object, Array, Math };
vm.createContext(runtime);
vm.runInContext(documentSigningSource, runtime);
let insertedIndex = null;
let insertedBlob = null;
let signatureWidth = 300;
let signatureHeight = 100;
let signatureText = '乙方簽名（線上簽署）：＿＿＿＿＿＿＿＿＿＿（待簽署）';
const signatureImage = {
  getWidth: () => signatureWidth,
  getHeight: () => signatureHeight,
  setWidth: value => { signatureWidth = value; },
  setHeight: value => { signatureHeight = value; }
};
const paragraph = {
  getChildIndex: () => 4,
  insertInlineImage: (index, blob) => {
    insertedIndex = index;
    insertedBlob = blob;
    return signatureImage;
  }
};
const text = {
  asText: () => text,
  getParent: () => paragraph,
  setText: value => { signatureText = value; }
};
const body = {
  getNumChildren: () => 0,
  findText: () => ({ getElement: () => text })
};
assert.equal(
  runtime.tenantContractDocumentReplaceSignature_(body, 'signature-blob'),
  true,
  'the supplied text signature slot must accept the captured signature image'
);
assert.equal(signatureText, '乙方簽名（線上簽署）：');
assert.equal(insertedIndex, 5);
assert.equal(insertedBlob, 'signature-blob');
assert.equal(signatureWidth, 220);
assert.equal(signatureHeight, 73);

console.log('Phase 168 fixed contract template tests passed.');
