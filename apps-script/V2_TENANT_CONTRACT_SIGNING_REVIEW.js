// Native V2 landlord review for tenant-submitted contract signing. It never invokes legacy signing bridges.
const V2_TENANT_CONTRACT_SIGNING_REVIEW_LIST_ACTION_ = 'landlord_contract_signing_reviews_init';
const V2_TENANT_CONTRACT_SIGNING_REVIEW_UPDATE_ACTION_ = 'landlord_contract_signing_review_update';
const V2_TENANT_CONTRACT_SIGNING_REVIEW_EXCHANGE_TTL_SECONDS_ = 60;
const V2_TENANT_CONTRACT_SIGNING_REVIEW_RESERVATION_TTL_SECONDS_ = 600;
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
  const cache = CacheService.getScriptCache();
  const key = tenantContractSigningReviewExchangeKey_(operation, requestId);
  const pollHash = landlordContractSigningReviewHmacHex_(pollSecret, secret);
  const reserveLock = LockService.getScriptLock();
  try {
    reserveLock.waitLock(5000);
    if (cache.get(key)) return tenantContractSigningReviewError_('REVIEW_EXCHANGE_CONFLICT');
    cache.put(key, JSON.stringify({ poll_hash: pollHash, pending: true }), V2_TENANT_CONTRACT_SIGNING_REVIEW_RESERVATION_TTL_SECONDS_);
  } catch (_) {
    return tenantContractSigningReviewError_('REVIEW_EXCHANGE_CREATE_FAILED');
  } finally {
    try { reserveLock.releaseLock(); } catch (_) {}
  }
  const result = operation === 'list'
    ? getLandlordContractSigningReviewsBySessionToken_(request.session_token)
    : updateLandlordContractSigningReviewBySessionToken_(
      request.session_token,
      tenantContractSigningReviewText_(request.contract_id),
      tenantContractSigningReviewText_(request.decision),
      tenantContractSigningReviewText_(request.review_note)
    );
  const completeLock = LockService.getScriptLock();
  try {
    completeLock.waitLock(5000);
    const raw = cache.get(key);
    if (!raw) return tenantContractSigningReviewError_('REVIEW_EXCHANGE_RESERVATION_MISSING');
    let reservation;
    try { reservation = JSON.parse(raw); } catch (_) { return tenantContractSigningReviewError_('REVIEW_EXCHANGE_RESERVATION_INVALID'); }
    if (reservation.pending !== true || !landlordContractSigningReviewConstantEquals_(reservation.poll_hash, pollHash)) {
      return tenantContractSigningReviewError_('REVIEW_EXCHANGE_RESERVATION_INVALID');
    }
    cache.put(key, JSON.stringify({ poll_hash: pollHash, result: result }), V2_TENANT_CONTRACT_SIGNING_REVIEW_EXCHANGE_TTL_SECONDS_);
    return { success: true, code: 'EXCHANGE_ACCEPTED' };
  } catch (_) {
    return tenantContractSigningReviewError_('REVIEW_EXCHANGE_CREATE_FAILED');
  } finally {
    try { completeLock.releaseLock(); } catch (_) {}
  }
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
    if (entry.pending === true) return tenantContractSigningReviewError_('REVIEW_EXCHANGE_PENDING');
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
  const contractDocument = tenantContractSigningReviewContractDocument_(contract);
  return {
    contract_id: tenantContractSigningReviewText_(contract.contract_id),
    workspace_id: tenantContractSigningReviewText_(contract.workspace_id),
    tenant_id: tenantContractSigningReviewText_(contract.tenant_id),
    contract_status: tenantContractSigningReviewText_(contract.contract_status),
    tenant_signing_submission_status: tenantContractSigningReviewText_(contract.tenant_signing_submission_status),
    tenant_signing_submitted_at: contract.tenant_signing_submitted_at || '',
    tenant_signed_at: contract.tenant_signed_at || '',
    terms_document: contractDocument,
    contract_document: contractDocument,
    contract_snapshot: {
      contract_id: tenantContractSigningReviewText_(contract.contract_id),
      contract_status: tenantContractSigningReviewText_(contract.contract_status),
      signing_mode: tenantContractSigningReviewText_(contract.signing_mode),
      landlord_name: tenantContractSigningReviewText_(contract.landlord_name || contract.owner_name),
      tenant_name: tenantContractSigningReviewText_(contract.tenant_name),
      property_name: tenantContractSigningReviewText_(contract.property_name),
      property_address: tenantContractSigningReviewText_(contract.property_address || contract.address),
      room_name: tenantContractSigningReviewText_(contract.room_name),
      start_date: contract.start_date || contract.contract_start_date || '',
      end_date: contract.end_date || contract.contract_end_date || '',
      rent_amount: contract.rent_amount || contract.monthly_rent || '',
      management_fee: contract.management_fee || contract.monthly_management_fee || '',
      deposit_amount: contract.deposit_amount || '',
      monthly_payment_day: contract.monthly_payment_day || contract.payment_day || ''
    }
  };
}

function tenantContractSigningReviewContractDocument_(contract) {
  contract = contract || {};
  const provided = tenantContractSigningReviewText_(
    contract.contract_content || contract.contract_text || contract.contract_terms || contract.terms_text
  );
  if (provided) {
    return {
      available: true,
      source: 'landlord_provided_contract',
      version: tenantContractSigningReviewText_(contract.contract_version) || 'landlord-provided',
      content: provided
    };
  }
  const required = [
    contract.start_date || contract.contract_start_date,
    contract.end_date || contract.contract_end_date,
    contract.rent_amount || contract.monthly_rent,
    contract.deposit_amount,
    contract.room_name
  ];
  if (required.some(function (value) { return !tenantContractSigningReviewText_(value); })) {
    return { available: false, message: '完整合約必要欄位尚未提供，無法開始審核。' };
  }
  const money = function (value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number).toLocaleString('en-US') : '0';
  };
  const landlord = tenantContractSigningReviewText_(contract.landlord_name || contract.owner_name) || '出租人';
  const tenant = tenantContractSigningReviewText_(contract.tenant_name) || '承租人';
  const property = tenantContractSigningReviewText_(contract.property_name) || '租賃物件';
  const address = tenantContractSigningReviewText_(contract.property_address || contract.address) || '未提供';
  const room = tenantContractSigningReviewText_(contract.room_name);
  const start = tenantContractSigningReviewText_(contract.start_date || contract.contract_start_date);
  const end = tenantContractSigningReviewText_(contract.end_date || contract.contract_end_date);
  const rent = money(contract.rent_amount || contract.monthly_rent);
  const managementFee = money(contract.management_fee || contract.monthly_management_fee);
  const deposit = money(contract.deposit_amount);
  const paymentDay = tenantContractSigningReviewText_(contract.monthly_payment_day || contract.payment_day) || '未提供';
  const bankName = tenantContractSigningReviewText_(contract.bank_name || contract.landlord_bank_name) || '未提供';
  const bankAccount = tenantContractSigningReviewText_(contract.bank_account || contract.landlord_bank_account || contract.payment_account) || '未提供';
  const bankAccountName = tenantContractSigningReviewText_(contract.bank_account_name || contract.account_name) || landlord;
  const note = tenantContractSigningReviewText_(contract.landlord_note || contract.signing_note || contract.renewal_landlord_note) || '無';
  return {
    available: true,
    source: 'generated_standard_contract',
    version: 'v2.1-standard-1',
    content: [
      '租賃契約書',
      '文件版本：CMWebs V2.1 標準格式',
      '',
      '第一條　當事人',
      '出租人：' + landlord,
      '承租人：' + tenant,
      '',
      '第二條　租賃標的',
      '租賃物件：' + property,
      '地址：' + address,
      '房號：' + room,
      '',
      '第三條　租賃期間',
      '自 ' + start + ' 起至 ' + end + ' 止。',
      '',
      '第四條　租金與押金',
      '每月租金：新臺幣 ' + rent + ' 元。',
      '每月管理費：新臺幣 ' + managementFee + ' 元。',
      '押金：新臺幣 ' + deposit + ' 元。',
      '',
      '第五條　付款方式',
      '承租人應於每月 ' + paymentDay + ' 日前完成當期租金及應付費用，並依房東提供的收款方式付款。',
      '收款銀行：' + bankName + '；帳號：' + bankAccount + '；戶名：' + bankAccountName + '。',
      '',
      '第六條　使用與修繕',
      '承租人應以善良管理人之注意使用租賃標的，不得違法、轉租或為影響建物及他人安全之使用。一般耗損以外之損壞，應依責任歸屬負擔修復或賠償。',
      '',
      '第七條　費用與設備',
      '水電、網路、公共費用及其他使用相關費用，依房東公告之計費方式及雙方確認的帳單負擔。設備交付與返還狀況以點交紀錄為準。',
      '',
      '第八條　提前終止',
      '任一方需提前終止租約時，應依租約及相關法令提前通知，並完成費用結清、物品返還及房屋點交。',
      '',
      '第九條　返還與點交',
      '租期屆滿或租約終止時，承租人應返還租賃標的、鑰匙及設備，並恢復合理使用狀態；押金於費用及損害責任確認後依約結算。',
      '',
      '第十條　爭議處理',
      '本契約未約定事項依中華民國相關法令及誠信原則處理；如有爭議，雙方應先協商，協商不成時依適用法令處理。',
      '',
      '第十一條　補充約定',
      note,
      '',
      '第十二條　簽署確認',
      '雙方已閱讀本契約全部條款及重要條件，並以線上簽名及送交紀錄確認本次簽署意旨。合約是否生效仍以房東審核完成及系統狀態為準。'
    ].join('\n')
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
