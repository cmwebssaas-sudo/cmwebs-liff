import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const sessionSource = readFileSync(new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url), 'utf8');
const submitSource = readFileSync(new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js', import.meta.url), 'utf8');

class Sheet {
  constructor(headers, rows = []) { this.headers = headers; this.rows = rows; }
  getLastRow() { return this.rows.length + 1; }
  getLastColumn() { return this.headers.length; }
  getDataRange() { return { getValues: () => [this.headers, ...this.rows] }; }
  getRange(row, column, height = 1, width = 1) {
    if (row === 1) return { getDisplayValues: () => [this.headers] };
    return {
      setValue: value => { this.rows[row - 2][column - 1] = value; },
      getDisplayValues: () => [this.rows[row - 2].slice(column - 1, column - 1 + width)]
    };
  }
}

const contractHeaders = [
  'contract_id', 'workspace_id', 'tenant_id', 'contract_status', 'signing_mode',
  'start_date', 'end_date', 'rent_amount', 'management_fee', 'deposit_amount',
  'monthly_payment_day', 'contract_content', 'previous_contract_id',
  'tenant_signed_at', 'tenant_signature_artifact_id',
  'tenant_signed_document_record_id',
  'tenant_signing_submission_status', 'tenant_signing_submitted_at', 'updated_at'
];
const artifactHeaders = ['artifact_id', 'workspace_id', 'tenant_id', 'contract_id', 'artifact_type', 'drive_file_id', 'status'];

function makeRuntime(mode = 'new_tenant', options = {}) {
  const props = new Map([
    ['CMWEBS_LINE_LOGIN_CHANNEL_ID', 'channel-1'],
    ['CMWEBS_LIFF_SESSION_HMAC_SECRET', 'session-secret']
  ]);
  const cache = new Map();
  const current = ['contract-1', 'ws-1', 'tenant-1', 'pending_tenant_signature', mode, '2026-08-01', '2027-07-31', 25000, 1000, 50000, 5, '第一條\n本租約以雙方確認內容為準。', options.previous ? 'contract-0' : '', '', '', '', '', '', ''];
  const contracts = options.previous
    ? [['contract-0', 'ws-1', 'tenant-1', 'active', 'renewal', '2025-08-01', '2026-07-31', 24000, 800, 48000, 3, '舊租約', '', '', '', '', '', '', ''], current]
    : [current];
  const requiredTypes = mode === 'new_tenant' ? ['identity_front', 'identity_back', 'signature'] : ['signature'];
  const artifactRows = requiredTypes.map((type, index) => ['artifact-' + index, 'ws-1', 'tenant-1', 'contract-1', type, 'drive-file-' + index, 'stored']);
  const sheets = {
    V2_users: new Sheet(['user_id', 'line_user_id', 'role', 'status'], [['user-1', 'Utenant', 'tenant', 'active']]),
    V2_tenants: new Sheet(['tenant_id', 'tenant_user_id', 'line_user_id', 'workspace_id', 'status', 'tenant_name', 'room_name'], [['tenant-1', 'user-1', 'Utenant', 'ws-1', 'active', '王小明', 'A-101']]),
    V2_contracts: new Sheet(contractHeaders, contracts),
    V2_contract_artifacts: new Sheet(artifactHeaders, artifactRows)
  };
  const materializeCalls = [];
  const context = {
    JSON, String, Number, Math, Date, RegExp, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key) || null }) },
    CacheService: { getScriptCache: () => ({ put: (key, value) => cache.set(key, value), get: key => cache.get(key) || null, remove: key => cache.delete(key) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ iss: 'https://access.line.me', aud: 'channel-1', sub: 'Utenant', exp: Math.floor(Date.now() / 1000) + 60, iat: Math.floor(Date.now() / 1000) }) }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeHmacSha256Signature: (value, key) => [...crypto.createHmac('sha256', key).update(value).digest()].map(byte => byte > 127 ? byte - 256 : byte),
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      base64DecodeWebSafe: value => Buffer.from(value, 'base64url'),
      newBlob: value => ({ getDataAsString: () => Buffer.from(value).toString() })
    },
    tenantContractDocumentPreview_: () => ({
      available: true,
      source: 'fixed_google_doc_template',
      version: 'fixed-google-doc-template',
      content: '房屋租賃契約書\n第一條\n第十五條'
    }),
    tenantContractDocumentEnsureContractColumns_: () => {},
    tenantContractDocumentResolveTenant_: (_ss, claims, contract) => ({
      tenant_id: claims.tenant_id,
      tenant_name: contract.tenant_name || '王小明',
      phone: '0912345678'
    }),
    tenantContractDocumentMaterialize_: (contract, _tenant, signatureArtifactId, signatureDriveFileId) => {
      materializeCalls.push({ signatureArtifactId, signatureDriveFileId });
      return {
        success: true,
        code: 'OK',
        data: {
          document_record_id: 'document-' + contract.contract_id + '-' + signatureArtifactId
        }
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(sessionSource, context);
  vm.runInContext(submitSource, context);
  return { api: context, sheets, props, materializeCalls };
}

function sessionFor(api) {
  const result = api.tenantLiffSigningAuthenticate_('id-token');
  assert.equal(result.success, true, result.code);
  return result.data.session_token;
}

function requestFor(token, overrides = {}) {
  return { session_token: token, consent: true, ...overrides };
}

{
  const { api } = makeRuntime();
  const result = api.tenantLiffSigningAuthenticate_('id-token');
  assert.equal(result.success, true);
  assert.equal(result.data.contract.terms_document.available, true);
  assert.deepEqual([...result.data.artifact_requirements], ['identity_front', 'identity_back', 'signature']);
  assert.equal(result.data.contract.renewal_comparison.available, false);
}

{
  const { api } = makeRuntime('renewal', { previous: true });
  const result = api.tenantLiffSigningAuthenticate_('id-token');
  assert.equal(result.success, true);
  assert.deepEqual([...result.data.artifact_requirements], ['signature']);
  assert.equal(result.data.contract.renewal_comparison.available, true);
  assert.equal(result.data.contract.renewal_comparison.items.find(item => item.label === '月租').changed, true);
}

{
  const { api, sheets } = makeRuntime();
  const token = sessionFor(api);
  assert.equal(api.tenantContractSigningSubmit_(requestFor(token, { consent: false })).code, 'CONSENT_REQUIRED');
  sheets.V2_contract_artifacts.rows = sheets.V2_contract_artifacts.rows.filter(row => row[4] !== 'identity_back');
  assert.equal(api.tenantContractSigningSubmit_(requestFor(token)).code, 'REQUIRED_ARTIFACT_MISSING');
}

{
  const { api, sheets, materializeCalls } = makeRuntime();
  const token = sessionFor(api);
  const result = api.tenantContractSigningSubmit_(requestFor(token));
  assert.equal(result.success, true, result.code);
  assert.equal(result.data.signing_status, 'submitted');
  const statusIndex = contractHeaders.indexOf('contract_status');
  const submitIndex = contractHeaders.indexOf('tenant_signing_submission_status');
  assert.equal(sheets.V2_contracts.rows[0][statusIndex], 'pending_tenant_signature');
  assert.equal(sheets.V2_contracts.rows[0][submitIndex], 'submitted');
  assert.deepEqual(materializeCalls[0], {
    signatureArtifactId: 'artifact-2',
    signatureDriveFileId: 'drive-file-2'
  });
  assert.equal(api.tenantContractSigningSubmit_(requestFor(token)).code, 'IDEMPOTENT');
  assert.deepEqual(materializeCalls[1], {
    signatureArtifactId: 'artifact-2',
    signatureDriveFileId: 'drive-file-2'
  });
}

{
  const { api, sheets } = makeRuntime();
  const token = sessionFor(api);
  sheets.V2_contracts.headers = sheets.V2_contracts.headers.filter(header => header !== 'tenant_signed_at');
  assert.equal(api.tenantContractSigningSubmit_(requestFor(token)).code, 'CONTRACT_SIGNING_SCHEMA_NOT_READY');
}

{
  const { api } = makeRuntime('renewal');
  const token = sessionFor(api);
  const post = { action: 'tenant_contract_sign_submit', request_id: 'a'.repeat(22), poll_secret: 'b'.repeat(43), ...requestFor(token) };
  assert.equal(api.tenantContractSigningHandleSubmitPost_(JSON.stringify(post)).success, true);
  assert.equal(api.tenantContractSigningReadExchange_(post.request_id, 'wrong'.repeat(11)).code, 'SIGNING_EXCHANGE_DENIED');
  assert.equal(api.tenantContractSigningReadExchange_(post.request_id, post.poll_secret).success, true);
  assert.equal(api.tenantContractSigningReadExchange_(post.request_id, post.poll_secret).code, 'SIGNING_EXCHANGE_NOT_FOUND');
}

console.log('Phase 132 tenant-contract signing submission runtime mocks passed.');
