// Native V2 final signing submission. It never chooses or mutates contract_status.
const V2_TENANT_CONTRACT_SIGNING_SUBMIT_ACTION_ = 'tenant_contract_sign_submit';
const V2_TENANT_CONTRACT_SIGNING_STATUS_ACTION_ = 'tenant_contract_sign_status';
const V2_TENANT_CONTRACT_SIGNING_EXCHANGE_TTL_SECONDS_ = 60;
const V2_TENANT_CONTRACT_SIGNING_CONTRACT_HEADERS_ = [
  'contract_id', 'workspace_id', 'tenant_id', 'contract_status', 'signing_mode',
  'tenant_signed_at', 'tenant_signature_artifact_id',
  'tenant_signing_submission_status', 'tenant_signing_submitted_at', 'updated_at'
];
const V2_TENANT_CONTRACT_SIGNING_ARTIFACT_HEADERS_ = [
  'artifact_id', 'workspace_id', 'tenant_id', 'contract_id', 'artifact_type', 'status'
];

function tenantContractSigningIsSubmitRequest_(body) {
  try { return JSON.parse(String(body || '')).action === V2_TENANT_CONTRACT_SIGNING_SUBMIT_ACTION_; } catch (_) { return false; }
}

function tenantContractSigningHandleSubmitPost_(body) {
  let request;
  try { request = JSON.parse(String(body || '')); } catch (_) { return tenantContractSigningSubmitError_('INVALID_JSON'); }
  if (!request || request.action !== V2_TENANT_CONTRACT_SIGNING_SUBMIT_ACTION_) return tenantContractSigningSubmitError_('INVALID_ACTION');
  const requestId = tenantLiffSigningText_(request.request_id);
  const pollSecret = tenantLiffSigningText_(request.poll_secret);
  if (!/^[A-Za-z0-9_-]{22,}$/.test(requestId) || !/^[A-Za-z0-9_-]{43,}$/.test(pollSecret)) return tenantContractSigningSubmitError_('INVALID_EXCHANGE_CREDENTIAL');
  let exchangeSecret;
  try { exchangeSecret = tenantLiffSigningSessionSecret_(); } catch (_) { return tenantContractSigningSubmitError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  const result = tenantContractSigningSubmit_(request);
  CacheService.getScriptCache().put(tenantContractSigningExchangeKey_(requestId), JSON.stringify({
    poll_hash: tenantLiffSigningHmacHex_(pollSecret, exchangeSecret), result: result
  }), V2_TENANT_CONTRACT_SIGNING_EXCHANGE_TTL_SECONDS_);
  return { success: true, code: 'EXCHANGE_ACCEPTED' };
}

function tenantContractSigningReadExchange_(requestId, pollSecret) {
  const raw = CacheService.getScriptCache().get(tenantContractSigningExchangeKey_(requestId));
  if (!raw) return tenantContractSigningSubmitError_('SIGNING_EXCHANGE_NOT_FOUND');
  let entry;
  try { entry = JSON.parse(raw); } catch (_) { return tenantContractSigningSubmitError_('SIGNING_EXCHANGE_INVALID'); }
  let exchangeSecret;
  try { exchangeSecret = tenantLiffSigningSessionSecret_(); } catch (_) { return tenantContractSigningSubmitError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  if (!tenantLiffSigningConstantEquals_(entry.poll_hash, tenantLiffSigningHmacHex_(pollSecret, exchangeSecret))) return tenantContractSigningSubmitError_('SIGNING_EXCHANGE_DENIED');
  CacheService.getScriptCache().remove(tenantContractSigningExchangeKey_(requestId));
  return entry.result || tenantContractSigningSubmitError_('SIGNING_EXCHANGE_INVALID');
}

function tenantContractSigningSubmit_(request) {
  if (request.consent !== true) return tenantContractSigningSubmitError_('CONSENT_REQUIRED');
  const session = verifyTenantLiffSessionToken_(request.session_token);
  if (!session.success) return tenantContractSigningSubmitError_(session.code || 'SESSION_TOKEN_INVALID');
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schema = tenantContractSigningSchema_(ss);
    if (!schema.success) return schema;
    const contract = tenantContractSigningOwnedContract_(schema.data.contracts, session.data);
    if (!contract) return tenantContractSigningSubmitError_('CONTRACT_OWNERSHIP_INVALID');
    const status = tenantLiffSigningText_(contract.contract_status).toLowerCase();
    if (['pending_tenant_signature', 'awaiting_tenant_signature'].indexOf(status) === -1) return tenantContractSigningSubmitError_('CONTRACT_NOT_SIGNABLE');
    const signingMode = tenantLiffSigningText_(contract.signing_mode).toLowerCase();
    if (['new_tenant', 'renewal'].indexOf(signingMode) === -1) return tenantContractSigningSubmitError_('SIGNING_MODE_NOT_READY');
    if (tenantLiffSigningText_(contract.tenant_signing_submission_status) === 'submitted') return { success: true, code: 'IDEMPOTENT', data: tenantContractSigningPublicResult_(contract, true) };
    const artifacts = tenantContractSigningRequiredArtifacts_(schema.data.artifacts, session.data, signingMode);
    if (!artifacts.success) return artifacts;
    const now = new Date().toISOString();
    const updates = {
      tenant_signed_at: now,
      tenant_signature_artifact_id: artifacts.data.signature_artifact_id,
      tenant_signing_submission_status: 'submitted',
      tenant_signing_submitted_at: now,
      updated_at: now
    };
    // A re-submission supersedes only the current review fields when that local migration is present.
    [
      'tenant_signing_reviewed_at',
      'tenant_signing_reviewed_by_user_id',
      'tenant_signing_reviewed_by_membership_id',
      'tenant_signing_review_note'
    ].forEach(function (header) {
      if (schema.data.contractHeaders.indexOf(header) >= 0) updates[header] = '';
    });
    tenantContractSigningUpdateContract_(schema.data.contractSheet, contract, updates);
    const updated = Object.assign({}, contract, updates);
    return { success: true, code: 'OK', data: tenantContractSigningPublicResult_(updated, false) };
  } catch (_) {
    return tenantContractSigningSubmitError_('SIGNING_SUBMISSION_FAILED');
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function tenantContractSigningSchema_(ss) {
  const contractSheet = ss.getSheetByName('V2_contracts');
  const artifactSheet = ss.getSheetByName('V2_contract_artifacts');
  if (!contractSheet || !artifactSheet) return tenantContractSigningSubmitError_('CONTRACT_SIGNING_SCHEMA_NOT_READY');
  const contractHeaders = tenantContractSigningHeaders_(contractSheet);
  const artifactHeaders = tenantContractSigningHeaders_(artifactSheet);
  if (!tenantContractSigningHasHeaders_(contractHeaders, V2_TENANT_CONTRACT_SIGNING_CONTRACT_HEADERS_) || !tenantContractSigningHasHeaders_(artifactHeaders, V2_TENANT_CONTRACT_SIGNING_ARTIFACT_HEADERS_)) return tenantContractSigningSubmitError_('CONTRACT_SIGNING_SCHEMA_NOT_READY');
  return { success: true, data: { contractSheet: contractSheet, contracts: tenantLiffSigningRows_(contractSheet), artifacts: tenantLiffSigningRows_(artifactSheet), contractHeaders: contractHeaders } };
}

function tenantContractSigningOwnedContract_(contracts, claims) {
  return contracts.find(function (row) {
    return tenantLiffSigningText_(row.contract_id) === claims.contract_id && tenantLiffSigningText_(row.tenant_id) === claims.tenant_id && tenantLiffSigningText_(row.workspace_id) === claims.workspace_id;
  }) || null;
}

function tenantContractSigningRequiredArtifacts_(artifacts, claims, signingMode) {
  const required = signingMode === 'new_tenant' ? ['identity_front', 'identity_back', 'signature'] : ['signature'];
  const found = {};
  artifacts.forEach(function (row) {
    if (tenantLiffSigningText_(row.contract_id) === claims.contract_id && tenantLiffSigningText_(row.tenant_id) === claims.tenant_id && tenantLiffSigningText_(row.workspace_id) === claims.workspace_id && tenantLiffSigningText_(row.status) === 'stored') found[tenantLiffSigningText_(row.artifact_type)] = tenantLiffSigningText_(row.artifact_id);
  });
  if (required.some(function (type) { return !found[type]; })) return tenantContractSigningSubmitError_('REQUIRED_ARTIFACT_MISSING');
  return { success: true, data: { signature_artifact_id: found.signature } };
}

function tenantContractSigningUpdateContract_(sheet, contract, updates) {
  const headers = tenantContractSigningHeaders_(sheet);
  Object.keys(updates).forEach(function (name) {
    const index = headers.indexOf(name);
    sheet.getRange(contract._sheet_row, index + 1).setValue(updates[name]);
  });
}

function tenantContractSigningHeaders_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(tenantLiffSigningText_);
}

function tenantContractSigningHasHeaders_(headers, required) {
  return required.every(function (name) { return headers.indexOf(name) >= 0; });
}

function tenantContractSigningPublicResult_(contract, idempotent) {
  return {
    contract_id: tenantLiffSigningText_(contract.contract_id),
    signing_status: tenantLiffSigningText_(contract.tenant_signing_submission_status) || 'submitted',
    submitted_at: contract.tenant_signing_submitted_at || contract.tenant_signed_at || '',
    idempotent: idempotent === true
  };
}

function tenantContractSigningExchangeKey_(requestId) { return 'tenant_contract_signing:' + String(requestId || ''); }
function tenantContractSigningSubmitError_(code) { return { success: false, code: code, message: '合約簽署送交失敗' }; }
