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
  tenantUiSource,
  /簽署成功[\s\S]*簽名圖片與簽署日期已寫入簽署版 Google 文件/,
  'the tenant must receive an explicit success signal after submission'
);

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
  /function tenantContractDocumentMaterialize_\([\s\S]*signatureDriveFileId/
);
assert.match(
  documentSigningSource,
  /DriveApp\.getFileById\(signatureDriveFileId\)/,
  'Google Docs writeback must use the stored Drive file ID for the signature image'
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
  /function tenantContractDocumentSignatureImage_\(/,
  'the signed preview must expose the stored signature image to the authenticated preview'
);
assert.match(
  documentSigningSource,
  /signature_image/,
  'the fixed document preview must carry signature image data separately from contract text'
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
assert.match(
  sessionSource,
  /signature_image:\s*preview\.signature_image/,
  'the authenticated tenant session must pass the signature image to the mobile preview'
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

const runtime = {
  String,
  Object,
  Array,
  Math,
  Date,
  Utilities: {
    formatDate: (value, _timezone, pattern) => {
      const date = new Date(value);
      if (pattern === 'yyyy/MM/dd HH:mm:ss') return '2026/08/25 14:55:56';
      if (pattern === 'yyyy') return '2026';
      if (pattern === 'M') return '8';
      if (pattern === 'd') return '25';
      throw new Error(`unexpected format: ${pattern}`);
    }
  }
};
vm.createContext(runtime);
vm.runInContext(documentSigningSource, runtime);

const signedPreview = runtime.tenantContractDocumentBuildPreviewText_(
  [
    '簽署狀態：待房客完成線上簽署。',
    '簽署時間：{{簽約時間}}',
    '乙方簽名（線上簽署）：＿＿＿＿（待簽署）',
    '西元{{簽約年}}年{{簽約月}}月{{簽約日}}日'
  ].join('\n'),
  {
    tenant_signing_submission_status: 'submitted',
    tenant_signed_at: '2026-08-25T06:55:56.000Z'
  },
  {},
  new Date('2026-08-25T06:55:56.000Z')
);
assert.match(signedPreview, /簽署狀態：✅/);
assert.match(signedPreview, /簽署時間：2026\/08\/25 14:55:56/);
assert.match(signedPreview, /簽名圖片已回寫至簽署版 Google 文件/);
assert.match(signedPreview, /西元2026年8月25日/);
assert.doesNotMatch(signedPreview, /待房客完成線上簽署|待簽署/);

const artifactSheet = {
  getLastRow: () => 2,
  getDataRange: () => ({
    getValues: () => [
      [
        'artifact_id',
        'workspace_id',
        'tenant_id',
        'contract_id',
        'artifact_type',
        'drive_file_id',
        'mime_type',
        'status'
      ],
      [
        'art-sign',
        'ws-1',
        'tenant-1',
        'contract-1',
        'signature',
        'drive-sign',
        'image/png',
        'stored'
      ]
    ]
  })
};
runtime.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheetByName: name => name === 'V2_contract_artifacts' ? artifactSheet : null
  })
};
runtime.DriveApp = {
  getFileById: id => {
    assert.equal(id, 'drive-sign');
    return {
      getBlob: () => ({
        getContentType: () => 'image/png',
        getBytes: () => [1, 2, 3]
      })
    };
  }
};
runtime.Utilities.base64Encode = bytes => bytes.join(',') === '1,2,3' ? 'AQID' : '';
const signatureImagePreview = runtime.tenantContractDocumentSignatureImage_({
  tenant_signature_artifact_id: 'art-sign',
  workspace_id: 'ws-1',
  tenant_id: 'tenant-1',
  contract_id: 'contract-1',
  tenant_signing_submission_status: 'submitted'
});
assert.equal(signatureImagePreview.mime_type, 'image/png');
assert.equal(
  signatureImagePreview.base64,
  'AQID',
  'the signed preview must read only the matching stored signature artifact'
);

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
