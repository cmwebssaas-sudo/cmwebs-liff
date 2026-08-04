import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';

const reviewUrl = new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js', import.meta.url);
assert.equal(
  existsSync(reviewUrl),
  true,
  'native landlord signing-review module must exist before this lifecycle can be released'
);

const sessionSource = readFileSync(new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url), 'utf8');
const submitSource = readFileSync(new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js', import.meta.url), 'utf8');
const reviewSource = readFileSync(reviewUrl, 'utf8');
const dispatcherSource = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');
const tenantContractPage = readFileSync(new URL('../tenant-contract.html', import.meta.url), 'utf8');
const landlordRequestPage = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');

class Sheet {
  constructor(headers, rows = []) {
    this.headers = headers.slice();
    this.rows = rows.map(row => row.slice());
  }

  getLastRow() { return this.rows.length + 1; }
  getLastColumn() { return this.headers.length; }
  getDataRange() { return { getValues: () => [this.headers, ...this.rows] }; }

  getRange(row, column, height = 1, width = 1) {
    const setCell = (targetRow, targetColumn, value) => {
      if (targetRow === 1) {
        this.headers[targetColumn - 1] = value;
        return;
      }
      const dataRow = this.rows[targetRow - 2];
      while (dataRow.length < targetColumn) dataRow.push('');
      dataRow[targetColumn - 1] = value;
    };
    const values = () => {
      const source = row === 1 ? this.headers : this.rows[row - 2];
      return [source.slice(column - 1, column - 1 + width)];
    };
    return {
      getDisplayValues: values,
      getValues: values,
      setValue: value => setCell(row, column, value),
      setValues: matrix => matrix.forEach((line, rowIndex) => line.forEach((value, columnIndex) => setCell(row + rowIndex, column + columnIndex, value)))
    };
  }
}

const signingHeaders = [
  'contract_id', 'workspace_id', 'tenant_id', 'contract_status', 'signing_mode',
  'tenant_signed_at', 'tenant_signature_artifact_id',
  'tenant_signing_submission_status', 'tenant_signing_submitted_at', 'updated_at'
];

function makeRuntime(options = {}) {
  const contractRows = [
    ['contract-submitted', 'ws-1', 'tenant-1', 'pending_tenant_signature', 'new_tenant', '2026-08-01T00:00:00.000Z', 'artifact-signature', 'submitted', '2026-08-01T00:00:00.000Z', ''],
    ['contract-rejected', 'ws-1', 'tenant-1', 'pending_tenant_signature', 'new_tenant', '2026-08-01T00:00:00.000Z', 'artifact-signature', 'rejected', '2026-08-01T00:00:00.000Z', ''],
    ['contract-other-workspace', 'ws-2', 'tenant-2', 'pending_tenant_signature', 'new_tenant', '2026-08-01T00:00:00.000Z', 'artifact-other', 'submitted', '2026-08-01T00:00:00.000Z', '']
  ];
  const sheets = {
    V2_contracts: new Sheet(signingHeaders, contractRows),
    V2_contract_artifacts: new Sheet(['artifact_id', 'workspace_id', 'tenant_id', 'contract_id', 'artifact_type', 'status'], [
      ['artifact-front-submitted', 'ws-1', 'tenant-1', 'contract-submitted', 'identity_front', 'stored'],
      ['artifact-back-submitted', 'ws-1', 'tenant-1', 'contract-submitted', 'identity_back', 'stored'],
      ['artifact-signature-submitted', 'ws-1', 'tenant-1', 'contract-submitted', 'signature', 'stored'],
      ['artifact-front', 'ws-1', 'tenant-1', 'contract-rejected', 'identity_front', 'stored'],
      ['artifact-back', 'ws-1', 'tenant-1', 'contract-rejected', 'identity_back', 'stored'],
      ['artifact-signature', 'ws-1', 'tenant-1', 'contract-rejected', 'signature', 'stored']
    ])
  };
  const state = {
    allowed: options.allowed !== false,
    sessionValid: options.sessionValid !== false,
    lockWaits: 0,
    lockReleases: 0,
    exchangeCache: new Map()
  };
  const context = {
    JSON, String, Number, Math, Date, RegExp, Error, Object, Array,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null }) },
    LockService: { getScriptLock: () => ({
      waitLock() { state.lockWaits += 1; },
      releaseLock() { state.lockReleases += 1; }
    }) },
    CacheService: { getScriptCache: () => ({
      put: (key, value) => state.exchangeCache.set(key, value),
      get: key => state.exchangeCache.get(key) || null,
      remove: key => state.exchangeCache.delete(key)
    }) },
    workspaceLandlordResolveAccess_: () => ({
      success: true,
      workspace: { workspace_id: 'ws-1' },
      user: { user_id: 'landlord-1', display_name: '林房東' },
      membership: { membership_id: 'member-1', role: 'owner' }
    }),
    workspaceLandlordCheckPolicy_: () => state.allowed
      ? { success: true }
      : { success: false, code: 'WORKSPACE_PERMISSION_DENIED' },
    verifyLandlordContractSigningReviewSessionToken_: () => state.sessionValid
      ? {
          success: true,
          data: {
            line_sub: 'landlord-line',
            user_id: 'landlord-1',
            membership_id: 'member-1',
            workspace_id: 'ws-1'
          }
        }
      : { success: false, code: 'LANDLORD_REVIEW_SESSION_INVALID' },
    landlordContractSigningReviewSessionSecret_: () => 'review-exchange-secret',
    landlordContractSigningReviewHmacHex_: (value, key) => crypto.createHmac('sha256', String(key)).update(String(value)).digest('hex'),
    landlordContractSigningReviewConstantEquals_: (left, right) => String(left) === String(right),
    tenantLiffSigningText_: value => String(value == null ? '' : value).trim(),
    tenantLiffSigningRows_: sheet => {
      if (!sheet || sheet.getLastRow() < 2) return [];
      const values = sheet.getDataRange().getValues();
      const headers = values[0].map(value => String(value).trim());
      return values.slice(1).map((row, index) => Object.assign(
        { _sheet_row: index + 2 },
        Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] == null ? '' : row[headerIndex]]))
      ));
    },
    tenantContractSigningHeaders_: sheet => sheet.headers.slice(),
    tenantContractSigningHasHeaders_: (headers, required) => required.every(header => headers.includes(header)),
    tenantContractSigningUpdateContract_: (sheet, contract, updates) => {
      Object.entries(updates).forEach(([header, value]) => sheet.getRange(contract._sheet_row, sheet.headers.indexOf(header) + 1).setValue(value));
    },
    tenantContractSigningPublicResult_: (contract, idempotent) => ({
      contract_id: String(contract.contract_id),
      signing_status: String(contract.tenant_signing_submission_status || 'submitted'),
      idempotent: idempotent === true
    }),
    tenantContractSigningSubmitError_: code => ({ success: false, code }),
    verifyTenantLiffSessionToken_: () => ({ success: true, data: { contract_id: 'contract-rejected', tenant_id: 'tenant-1', workspace_id: 'ws-1' } }),
    tenantContractSigningRequiredArtifacts_: () => ({ success: true, data: { signature_artifact_id: 'artifact-signature' } })
  };
  vm.createContext(context);
  vm.runInContext(sessionSource, context);
  vm.runInContext(submitSource, context);
  vm.runInContext(reviewSource, context);
  context.verifyTenantLiffSessionToken_ = () => ({
    success: true,
    data: {
      contract_id: 'contract-rejected',
      tenant_id: 'tenant-1',
      workspace_id: 'ws-1'
    }
  });
  return { api: context, sheets, state };
}

function reviewSessionToken() {
  return 'server-verified-landlord-review-session';
}

{
  const { api, sheets } = makeRuntime();
  assert.equal(
    api.getLandlordContractSigningReviewsBySessionToken_(reviewSessionToken()).code,
    'CONTRACT_SIGNING_REVIEW_SCHEMA_NOT_READY'
  );
  const migration = api.migrateV2TenantContractSigningReviewSchema_(
    { getSheetByName: name => sheets[name] || null }
  );
  assert.equal(migration.success, true, migration.code);
  assert.deepEqual([...migration.data.added_headers], [
    'tenant_signing_reviewed_at',
    'tenant_signing_reviewed_by_user_id',
    'tenant_signing_reviewed_by_membership_id',
    'tenant_signing_review_note'
  ]);
  const beforeRetry = sheets.V2_contracts.headers.slice();
  assert.equal(api.migrateV2TenantContractSigningReviewSchema_({ getSheetByName: name => sheets[name] || null }).data.added_headers.length, 0);
  assert.deepEqual(sheets.V2_contracts.headers, beforeRetry);
}

{
  const { api, sheets, state } = makeRuntime();
  api.migrateV2TenantContractSigningReviewSchema_({ getSheetByName: name => sheets[name] || null });
  const requestId = 'review-list-request-id-123';
  const pollSecret = 'review-list-poll-secret-12345678901234567890';
  const submitted = api.landlordContractSigningReviewHandleExchangePost_(JSON.stringify({
    action: 'landlord_contract_signing_reviews_fetch',
    request_id: requestId,
    poll_secret: pollSecret,
    session_token: reviewSessionToken()
  }));
  assert.equal(submitted.code, 'EXCHANGE_ACCEPTED');
  const listed = api.landlordContractSigningReviewReadExchange_('list', requestId, pollSecret);
  assert.equal(listed.success, true, listed.code);
  assert.deepEqual([...listed.data.items.map(item => item.contract_id)], ['contract-submitted']);
  assert.equal([...state.exchangeCache.values()].some(value => String(value).includes(reviewSessionToken())), false, 'cached JSONP exchange results must not retain the review session token');
}

{
  const { api, sheets } = makeRuntime();
  api.migrateV2TenantContractSigningReviewSchema_({ getSheetByName: name => sheets[name] || null });
  const listed = api.getLandlordContractSigningReviewsBySessionToken_(reviewSessionToken());
  assert.equal(listed.success, true, listed.code);
  assert.deepEqual([...listed.data.items.map(item => item.contract_id)], ['contract-submitted']);
  assert.equal(listed.data.items[0].workspace_id, 'ws-1');
  assert.equal(listed.data.items[0].tenant_signing_submission_status, 'submitted');
}

{
  const { api, sheets, state } = makeRuntime();
  api.migrateV2TenantContractSigningReviewSchema_({ getSheetByName: name => sheets[name] || null });
  state.allowed = false;
  assert.equal(api.updateLandlordContractSigningReviewBySessionToken_(reviewSessionToken(), 'contract-submitted', 'approve', '').code, 'WORKSPACE_PERMISSION_DENIED');
  state.allowed = true;
  assert.equal(api.updateLandlordContractSigningReviewBySessionToken_(reviewSessionToken(), 'contract-other-workspace', 'approve', '').code, 'CONTRACT_NOT_FOUND');
}

{
  const { api, sheets, state } = makeRuntime();
  api.migrateV2TenantContractSigningReviewSchema_({ getSheetByName: name => sheets[name] || null });
  const approved = api.updateLandlordContractSigningReviewBySessionToken_(reviewSessionToken(), 'contract-submitted', 'approve', '資料完整');
  assert.equal(approved.success, true, approved.code);
  assert.equal(approved.data.contract_status, 'active');
  assert.equal(approved.data.tenant_signing_submission_status, 'approved');
  assert.equal(approved.data.idempotent, false);
  assert.equal(approved.data.reviewed_by_user_id, 'landlord-1');
  assert.equal(api.updateLandlordContractSigningReviewBySessionToken_(reviewSessionToken(), 'contract-submitted', 'approve', '資料完整').code, 'IDEMPOTENT');
  assert.equal(api.updateLandlordContractSigningReviewBySessionToken_(reviewSessionToken(), 'contract-submitted', 'reject', '改變主意').code, 'REVIEW_ALREADY_FINALIZED');
  assert.equal(state.lockWaits, 3, 'every final-decision attempt must be serialized by ScriptLock');
  assert.equal(state.lockReleases, 3, 'every acquired review lock must be released');
}

{
  const { api, sheets } = makeRuntime();
  api.migrateV2TenantContractSigningReviewSchema_({ getSheetByName: name => sheets[name] || null });
  const rejected = api.updateLandlordContractSigningReviewBySessionToken_(reviewSessionToken(), 'contract-rejected', 'reject', '請補正資料');
  assert.equal(rejected.success, true, rejected.code);
  assert.equal(rejected.data.contract_status, 'pending_tenant_signature');
  assert.equal(rejected.data.tenant_signing_submission_status, 'rejected');
  const resubmitted = api.tenantContractSigningSubmit_({ session_token: 'ignored', consent: true });
  assert.equal(resubmitted.success, true, resubmitted.code);
  assert.equal(resubmitted.data.signing_status, 'submitted');
  const reviewNoteColumn = sheets.V2_contracts.headers.indexOf('tenant_signing_review_note');
  const reviewedAtColumn = sheets.V2_contracts.headers.indexOf('tenant_signing_reviewed_at');
  assert.equal(sheets.V2_contracts.rows[1][reviewNoteColumn], '');
  assert.equal(sheets.V2_contracts.rows[1][reviewedAtColumn], '');
}

{
  const { api, sheets } = makeRuntime();
  api.migrateV2TenantContractSigningReviewSchema_({ getSheetByName: name => sheets[name] || null });
  const signatureStatusColumn = sheets.V2_contract_artifacts.headers.indexOf('status');
  sheets.V2_contract_artifacts.rows[2][signatureStatusColumn] = 'removed';
  assert.equal(
    api.updateLandlordContractSigningReviewBySessionToken_(reviewSessionToken(), 'contract-submitted', 'approve', '附件已驗證').code,
    'REQUIRED_ARTIFACT_MISSING',
    'approval must revalidate required stored artifacts, not trust an earlier submission alone'
  );
}

{
  const { api, sheets, state } = makeRuntime({ sessionValid: false });
  api.migrateV2TenantContractSigningReviewSchema_({ getSheetByName: name => sheets[name] || null });
  assert.equal(
    api.getLandlordContractSigningReviewsBySessionToken_('forged-query-line-user-id').code,
    'LANDLORD_REVIEW_SESSION_INVALID',
    'a caller-provided LINE UID must never authorize native signing-review access'
  );
  assert.equal(state.lockWaits, 0);
}

assert.equal(reviewSource.includes('legacyContract'), false, 'native signing review must not call the legacy signed-contract bridge');
assert.equal(dispatcherSource.includes("'landlord_contract_signing_reviews_init'"), true, 'review list route must be dispatched');
assert.equal(dispatcherSource.includes("'landlord_contract_signing_review_update'"), true, 'review update route must be dispatched');
assert.equal(dispatcherSource.includes("'landlord_contract_signing_review_auth_status'"), true, 'review session status route must be dispatched');
assert.equal(dispatcherSource.includes("'landlord_contract_signing_reviews_fetch_status'"), true, 'list exchange status route must be dispatched');
assert.equal(dispatcherSource.includes("'landlord_contract_signing_review_update_status'"), true, 'update exchange status route must be dispatched');
assert.equal(tenantContractPage.includes('審核退回，請補正後重新送交'), true, 'tenant must see a rejected native signing state');
assert.equal(landlordRequestPage.includes('initializeNativeSigningReviewSession'), true, 'landlord must obtain a server-verified review session before native review access');
assert.equal(landlordRequestPage.includes("'landlord_contract_signing_reviews_fetch'"), true, 'native review list must use a POST exchange');
assert.equal(landlordRequestPage.includes("'landlord_contract_signing_review_update_submit'"), true, 'native review update must use a POST exchange');
assert.equal(landlordRequestPage.includes('review_session_token: NATIVE_SIGNING_REVIEW_SESSION_TOKEN'), false, 'native review session tokens must never be appended to a JSONP URL');
console.log('Phase 138 native tenant-contract signing-review runtime mocks passed.');
