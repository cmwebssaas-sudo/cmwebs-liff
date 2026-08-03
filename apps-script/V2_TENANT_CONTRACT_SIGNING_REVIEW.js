// Native V2 landlord review for tenant-submitted contract signing. It never invokes legacy signing bridges.
const V2_TENANT_CONTRACT_SIGNING_REVIEW_LIST_ACTION_ = 'landlord_contract_signing_reviews_init';
const V2_TENANT_CONTRACT_SIGNING_REVIEW_UPDATE_ACTION_ = 'landlord_contract_signing_review_update';
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
}

function getLandlordContractSigningReviewsByLineUid_(lineUserId) {
  const access = tenantContractSigningReviewResolveAccess_(lineUserId, 'read');
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

function updateLandlordContractSigningReviewByLineUid_(lineUserId, contractId, decision, reviewNote) {
  const access = tenantContractSigningReviewResolveAccess_(lineUserId, 'contract_write');
  if (!access.success) return access;
  const normalizedDecision = tenantContractSigningReviewText_(decision).toLowerCase();
  if (['approve', 'reject'].indexOf(normalizedDecision) === -1) return tenantContractSigningReviewError_('REVIEW_DECISION_INVALID');
  const schema = tenantContractSigningReviewSchema_(SpreadsheetApp.getActiveSpreadsheet());
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

  const now = new Date().toISOString();
  const actor = access.data;
  const updates = {
    tenant_signing_submission_status: finalStatus,
    contract_status: normalizedDecision === 'approve' ? 'active' : tenantContractSigningReviewText_(contract.contract_status),
    tenant_signing_reviewed_at: now,
    tenant_signing_reviewed_by_user_id: tenantContractSigningReviewText_(actor.user.user_id),
    tenant_signing_reviewed_by_membership_id: tenantContractSigningReviewText_(actor.membership.membership_id),
    tenant_signing_review_note: tenantContractSigningReviewText_(reviewNote),
    updated_at: now
  };
  tenantContractSigningReviewUpdateRow_(schema.data.sheet, contract, updates);
  return {
    success: true,
    code: 'OK',
    data: tenantContractSigningReviewPublicResult_(Object.assign({}, contract, updates), false)
  };
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
