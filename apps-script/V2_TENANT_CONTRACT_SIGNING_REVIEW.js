// Native V2 landlord review for tenant-submitted contract signing. It never invokes legacy signing bridges.
const V2_TENANT_CONTRACT_SIGNING_REVIEW_LIST_ACTION_ = 'landlord_contract_signing_reviews_init';
const V2_TENANT_CONTRACT_SIGNING_REVIEW_UPDATE_ACTION_ = 'landlord_contract_signing_review_update';
const V2_TENANT_CONTRACT_SIGNING_REVIEW_EXCHANGE_TTL_SECONDS_ = 60;
const V2_TENANT_CONTRACT_SIGNING_REVIEW_NOTE_MAX_LENGTH_ = 1000;
const V2_TENANT_CONTRACT_SIGNING_REVIEW_AUDIT_HEADERS_ = [
  'tenant_signing_reviewed_at',
  'tenant_signing_reviewed_by_user_id',
  'tenant_signing_reviewed_by_membership_id',
  'tenant_signing_review_note'
];
const V2_TENANT_CONTRACT_SIGNING_REVIEW_REQUIRED_HEADERS_ = [
  'contract_id',
  'workspace_id',
  'tenant_id',
  'contract_status',
  'tenant_signing_submission_status',
  'updated_at'
].concat(V2_TENANT_CONTRACT_SIGNING_REVIEW_AUDIT_HEADERS_);

function migrateV2TenantContractSigningReviewSchema_(ss) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const sheet = ss && ss.getSheetByName('V2_contracts');
    if (!sheet) return tenantContractSigningReviewError_('CONTRACT_SIGNING_REVIEW_SCHEMA_NOT_READY');
    const headers = tenantContractSigningReviewHeaders_(sheet);
    const addedHeaders = V2_TENANT_CONTRACT_SIGNING_REVIEW_AUDIT_HEADERS_.filter(function (header) {
      return headers.indexOf(header) === -1;
    });
    if (addedHeaders.length) {
      sheet.getRange(1, sheet.getLastColumn() + 1, 1, addedHeaders.length).setValues([addedHeaders]);
    }
    return { success: true, code: 'OK', data: { added_headers: addedHeaders } };
  } catch (_) {
    return tenantContractSigningReviewError_('CONTRACT_SIGNING_REVIEW_SCHEMA_MIGRATION_FAILED');
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function getLandlordContractSigningReviewsBySessionToken_(sessionToken) {
  const access = tenantContractSigningReviewAccessFromSession_(sessionToken, 'read');
  if (!access.success) return access;
  const schema = tenantContractSigningReviewSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const workspaceId = tenantContractSigningReviewText_(access.data.workspace.workspace_id);
  const items = tenantContractSigningReviewRows_(schema.data.sheet).filter(function (contract) {
    return tenantContractSigningReviewText_(contract.workspace_id) === workspaceId &&
      tenantContractSigningReviewText_(contract.tenant_signing_submission_status).toLowerCase() === 'submitted';
  }).map(tenantContractSigningReviewPublicContract_);
  return { success: true, code: 'OK', data: { items: items, count: items.length } };
}

function updateLandlordContractSigningReviewBySessionToken_(sessionToken, contractId, decision, reviewNote) {
  const access = tenantContractSigningReviewAccessFromSession_(sessionToken, 'contract_write');
  if (!access.success) return access;
  const normalizedDecision = tenantContractSigningReviewText_(decision).toLowerCase();
  if (['approve', 'reject'].indexOf(normalizedDecision) === -1) return tenantContractSigningReviewError_('REVIEW_DECISION_INVALID');
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schema = tenantContractSigningReviewSchema_(ss);
    if (!schema.success) return schema;
    const workspaceId = tenantContractSigningReviewText_(access.data.workspace.workspace_id);
    const contract = tenantContractSigningReviewRows_(schema.data.sheet).find(function (row) {
      return tenantContractSigningReviewText_(row.contract_id) === tenantContractSigningReviewText_(contractId) &&
        tenantContractSigningReviewText_(row.workspace_id) === workspaceId;
    });
    if (!contract) return tenantContractSigningReviewError_('CONTRACT_NOT_FOUND');
    const submissionStatus = tenantContractSigningReviewText_(contract.tenant_signing_submission_status).toLowerCase();
    const finalStatus = normalizedDecision === 'approve' ? 'approved' : 'rejected';
    if (submissionStatus === finalStatus) {
      return { success: true, code: 'IDEMPOTENT', data: tenantContractSigningReviewPublicResult_(contract, true) };
    }
    if (['approved', 'rejected'].indexOf(submissionStatus) !== -1) return tenantContractSigningReviewError_('REVIEW_ALREADY_FINALIZED');
    if (submissionStatus !== 'submitted') return tenantContractSigningReviewError_('CONTRACT_NOT_SUBMITTED');
    const contractStatus = tenantContractSigningReviewText_(contract.contract_status).toLowerCase();
    if (['pending_tenant_signature', 'awaiting_tenant_signature'].indexOf(contractStatus) === -1) {
      return tenantContractSigningReviewError_('CONTRACT_NOT_SIGNABLE');
    }
    const signingMode = tenantContractSigningReviewText_(contract.signing_mode).toLowerCase();
    if (['new_tenant', 'renewal'].indexOf(signingMode) === -1) {
      return tenantContractSigningReviewError_('SIGNING_MODE_NOT_READY');
    }
    const normalizedReviewNote = tenantContractSigningReviewText_(reviewNote);
    if (normalizedReviewNote.length > V2_TENANT_CONTRACT_SIGNING_REVIEW_NOTE_MAX_LENGTH_) {
      return tenantContractSigningReviewError_('REVIEW_NOTE_TOO_LONG');
    }

    if (normalizedDecision === 'approve') {
      const artifactSheet = ss.getSheetByName('V2_contract_artifacts');
      if (!artifactSheet || typeof tenantContractSigningRequiredArtifacts_ !== 'function' || typeof tenantLiffSigningRows_ !== 'function') {
        return tenantContractSigningReviewError_('CONTRACT_SIGNING_ARTIFACTS_NOT_READY');
      }
      const artifacts = tenantContractSigningRequiredArtifacts_(
        tenantLiffSigningRows_(artifactSheet),
        {
          contract_id: tenantContractSigningReviewText_(contract.contract_id),
          tenant_id: tenantContractSigningReviewText_(contract.tenant_id),
          workspace_id: workspaceId
        },
        signingMode
      );
      if (!artifacts || artifacts.success !== true) {
        return tenantContractSigningReviewError_((artifacts && artifacts.code) || 'REQUIRED_ARTIFACT_MISSING');
      }
    }

    const now = new Date().toISOString();
    const actor = access.data;
    const updates = {
      tenant_signing_submission_status: finalStatus,
      contract_status: normalizedDecision === 'approve' ? 'active' : tenantContractSigningReviewText_(contract.contract_status),
      tenant_signing_reviewed_at: now,
      tenant_signing_reviewed_by_user_id: tenantContractSigningReviewText_(actor.user.user_id),
      tenant_signing_reviewed_by_membership_id: tenantContractSigningReviewText_(actor.membership.membership_id),
      tenant_signing_review_note: normalizedReviewNote,
      updated_at: now
    };
    tenantContractSigningReviewUpdateRow_(schema.data.sheet, contract, updates);
    return {
      success: true,
      code: 'OK',
      data: tenantContractSigningReviewPublicResult_(Object.assign({}, contract, updates), false)
    };
  } catch (_) {
    return tenantContractSigningReviewError_('REVIEW_UPDATE_FAILED');
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function landlordContractSigningReviewIsExchangeRequest_(body) {
  try {
    const action = tenantContractSigningReviewText_(JSON.parse(String(body || '')).action);
    return [
      'landlord_contract_signing_reviews_fetch',
      'landlord_contract_signing_review_update_submit'
    ].indexOf(action) >= 0;
  } catch (_) {
    return false;
  }
}

function landlordContractSigningReviewHandleExchangePost_(body) {
  let request;
  try { request = JSON.parse(String(body || '')); } catch (_) { return tenantContractSigningReviewError_('INVALID_JSON'); }
  const action = tenantContractSigningReviewText_(request && request.action);
  const operation = action === 'landlord_contract_signing_reviews_fetch'
    ? 'list'
    : action === 'landlord_contract_signing_review_update_submit'
      ? 'update'
      : '';
  if (!operation) return tenantContractSigningReviewError_('INVALID_ACTION');
  const requestId = tenantContractSigningReviewText_(request.request_id);
  const pollSecret = tenantContractSigningReviewText_(request.poll_secret);
  if (!/^[A-Za-z0-9_-]{22,}$/.test(requestId) || !/^[A-Za-z0-9_-]{43,}$/.test(pollSecret)) {
    return tenantContractSigningReviewError_('INVALID_EXCHANGE_CREDENTIAL');
  }
  let secret;
  try { secret = landlordContractSigningReviewSessionSecret_(); } catch (_) { return tenantContractSigningReviewError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  const result = operation === 'list'
    ? getLandlordContractSigningReviewsBySessionToken_(request.session_token)
    : updateLandlordContractSigningReviewBySessionToken_(
      request.session_token,
      tenantContractSigningReviewText_(request.contract_id),
      tenantContractSigningReviewText_(request.decision),
      tenantContractSigningReviewText_(request.review_note)
    );
  CacheService.getScriptCache().put(
    tenantContractSigningReviewExchangeKey_(operation, requestId),
    JSON.stringify({
      poll_hash: landlordContractSigningReviewHmacHex_(pollSecret, secret),
      result: result
    }),
    V2_TENANT_CONTRACT_SIGNING_REVIEW_EXCHANGE_TTL_SECONDS_
  );
  return { success: true, code: 'EXCHANGE_ACCEPTED' };
}

function landlordContractSigningReviewReadResultExchange_(operation, requestId, pollSecret) {
  operation = tenantContractSigningReviewText_(operation);
  if (['list', 'update'].indexOf(operation) === -1) return tenantContractSigningReviewError_('INVALID_ACTION');
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const raw = CacheService.getScriptCache().get(
      tenantContractSigningReviewExchangeKey_(operation, requestId)
    );
    if (!raw) return tenantContractSigningReviewError_('REVIEW_EXCHANGE_NOT_FOUND');
    let entry;
    try { entry = JSON.parse(raw); } catch (_) { return tenantContractSigningReviewError_('REVIEW_EXCHANGE_INVALID'); }
    let secret;
    try { secret = landlordContractSigningReviewSessionSecret_(); } catch (_) { return tenantContractSigningReviewError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
    if (!landlordContractSigningReviewConstantEquals_(entry.poll_hash, landlordContractSigningReviewHmacHex_(pollSecret, secret))) {
      return tenantContractSigningReviewError_('REVIEW_EXCHANGE_DENIED');
    }
    CacheService.getScriptCache().remove(
      tenantContractSigningReviewExchangeKey_(operation, requestId)
    );
    return entry.result || tenantContractSigningReviewError_('REVIEW_EXCHANGE_INVALID');
  } catch (_) {
    return tenantContractSigningReviewError_('REVIEW_EXCHANGE_READ_FAILED');
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function tenantContractSigningReviewExchangeKey_(operation, requestId) {
  return 'landlord_contract_signing_review:' + tenantContractSigningReviewText_(operation) + ':' + tenantContractSigningReviewText_(requestId);
}

function getLandlordContractSigningReviewsByLineUid_() {
  return tenantContractSigningReviewError_('LANDLORD_REVIEW_SESSION_REQUIRED');
}

function updateLandlordContractSigningReviewByLineUid_() {
  return tenantContractSigningReviewError_('LANDLORD_REVIEW_SESSION_REQUIRED');
}

function tenantContractSigningReviewAccessFromSession_(sessionToken, policy) {
  if (typeof verifyLandlordContractSigningReviewSessionToken_ !== 'function') {
    return tenantContractSigningReviewError_('LANDLORD_REVIEW_SESSION_MODULE_REQUIRED');
  }
  const session = verifyLandlordContractSigningReviewSessionToken_(sessionToken);
  if (!session || session.success !== true || !session.data) {
    return tenantContractSigningReviewError_((session && session.code) || 'LANDLORD_REVIEW_SESSION_INVALID');
  }
  const access = tenantContractSigningReviewResolveAccess_(session.data.line_sub, policy);
  if (!access.success) return access;
  const claims = session.data;
  if (
    tenantContractSigningReviewText_(access.data.user.user_id) !== tenantContractSigningReviewText_(claims.user_id) ||
    tenantContractSigningReviewText_(access.data.membership.membership_id) !== tenantContractSigningReviewText_(claims.membership_id) ||
    tenantContractSigningReviewText_(access.data.workspace.workspace_id) !== tenantContractSigningReviewText_(claims.workspace_id)
  ) {
    return tenantContractSigningReviewError_('LANDLORD_REVIEW_SESSION_PRINCIPAL_INVALID');
  }
  return access;
}

function tenantContractSigningReviewResolveAccess_(lineUserId, policy) {
  if (typeof workspaceLandlordResolveAccess_ !== 'function' || typeof workspaceLandlordCheckPolicy_ !== 'function') {
    return tenantContractSigningReviewError_('WORKSPACE_ACCESS_MODULE_REQUIRED');
  }
  const access = workspaceLandlordResolveAccess_(lineUserId, {
    skip_schema_ensure: true,
    skip_legacy_context_creation: true
  });
  if (!access || access.success !== true || !access.workspace || !access.user || !access.membership) {
    return tenantContractSigningReviewError_((access && access.code) || 'WORKSPACE_ACCESS_DENIED');
  }
  const policyResult = workspaceLandlordCheckPolicy_(access, policy);
  if (!policyResult || policyResult.success !== true) {
    return tenantContractSigningReviewError_((policyResult && policyResult.code) || 'WORKSPACE_PERMISSION_DENIED');
  }
  return {
    success: true,
    data: {
      workspace: access.workspace,
      user: access.user,
      membership: access.membership
    }
  };
}

function tenantContractSigningReviewSchema_(ss) {
  const sheet = ss && ss.getSheetByName('V2_contracts');
  if (!sheet || !tenantContractSigningReviewHasHeaders_(tenantContractSigningReviewHeaders_(sheet), V2_TENANT_CONTRACT_SIGNING_REVIEW_REQUIRED_HEADERS_)) {
    return tenantContractSigningReviewError_('CONTRACT_SIGNING_REVIEW_SCHEMA_NOT_READY');
  }
  return { success: true, data: { sheet: sheet } };
}

function tenantContractSigningReviewRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(tenantContractSigningReviewText_);
  return values.slice(1).map(function (row, index) {
    const result = { _sheet_row: index + 2 };
    headers.forEach(function (header, column) { result[header] = row[column]; });
    return result;
  });
}

function tenantContractSigningReviewUpdateRow_(sheet, contract, updates) {
  const headers = tenantContractSigningReviewHeaders_(sheet);
  Object.keys(updates).forEach(function (header) {
    const column = headers.indexOf(header);
    if (column >= 0) sheet.getRange(contract._sheet_row, column + 1).setValue(updates[header]);
  });
}

function tenantContractSigningReviewHeaders_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(tenantContractSigningReviewText_);
}

function tenantContractSigningReviewHasHeaders_(headers, required) {
  return required.every(function (header) { return headers.indexOf(header) >= 0; });
}

function tenantContractSigningReviewPublicContract_(contract) {
  return {
    contract_id: tenantContractSigningReviewText_(contract.contract_id),
    workspace_id: tenantContractSigningReviewText_(contract.workspace_id),
    tenant_id: tenantContractSigningReviewText_(contract.tenant_id),
    contract_status: tenantContractSigningReviewText_(contract.contract_status),
    tenant_signing_submission_status: tenantContractSigningReviewText_(contract.tenant_signing_submission_status),
    tenant_signing_submitted_at: contract.tenant_signing_submitted_at || '',
    tenant_signed_at: contract.tenant_signed_at || ''
  };
}

function tenantContractSigningReviewPublicResult_(contract, idempotent) {
  return Object.assign(tenantContractSigningReviewPublicContract_(contract), {
    reviewed_at: contract.tenant_signing_reviewed_at || '',
    reviewed_by_user_id: tenantContractSigningReviewText_(contract.tenant_signing_reviewed_by_user_id),
    reviewed_by_membership_id: tenantContractSigningReviewText_(contract.tenant_signing_reviewed_by_membership_id),
    review_note: tenantContractSigningReviewText_(contract.tenant_signing_review_note),
    idempotent: idempotent === true
  });
}

function tenantContractSigningReviewText_(value) {
  return String(value == null ? '' : value).trim();
}

function tenantContractSigningReviewError_(code) {
  return { success: false, code: code, message: '合約簽署審核失敗' };
}
