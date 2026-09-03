// V2.1 landlord paper-contract backfill.
// This is a landlord-only recovery path for contracts already signed on paper.
// It never creates an electronic invite, signing session, tenant request, or LINE message.
// A paper conversion may cancel one matching, unclaimed electronic draft so the
// original row remains auditable without competing with the paper contract.

var V2_LANDLORD_PAPER_BACKFILL_DOCUMENT_MAX_BYTES_ = 8 * 1024 * 1024;
var V2_LANDLORD_PAPER_BACKFILL_OPEN_STATUSES_ = [
  'active', 'current', 'effective', 'signed', 'upcoming', 'approved', 'pending_start',
  'pending', 'pending_landlord_review', 'pending_tenant_signature', 'awaiting_tenant_signature'
];
var V2_LANDLORD_PAPER_BACKFILL_CLOSED_STATUSES_ = [
  'archived', 'renewed', 'terminated', 'cancelled', 'expired', 'inactive', 'deleted', 'voided', 'rejected'
];
var V2_LANDLORD_PAPER_BACKFILL_CONTRACT_HEADERS_ = [
  'paper_backfill_idempotency_key',
  'paper_backfill_payload_hash'
];
var V2_LANDLORD_PAPER_BACKFILL_REPLACEMENT_STATUSES_ = [
  'pending_tenant_signature', 'awaiting_tenant_signature'
];
var V2_LANDLORD_PAPER_BACKFILL_REPLACEMENT_INVITE_STATUSES_ = [
  'pending'
];
var V2_LANDLORD_PAPER_BACKFILL_REPLACEMENT_INVITE_HEADERS_ = [
  'invite_id', 'workspace_id', 'contract_id', 'status', 'cancelled_at', 'updated_at'
];

function landlordPaperContractBackfillLegacyPendingReplacementEligible_(contract) {
  if (!contract) return false;
  var status = landlordPaperContractBackfillText_(contract.contract_status || contract.status).toLowerCase();
  return V2_LANDLORD_PAPER_BACKFILL_REPLACEMENT_STATUSES_.indexOf(status) >= 0 &&
    landlordPaperContractBackfillText_(contract.contract_id) !== '' &&
    landlordPaperContractBackfillText_(contract.tenant_id) !== '' &&
    landlordPaperContractBackfillText_(contract.contract_origin) === '' &&
    landlordPaperContractBackfillText_(contract.invite_id) === '' &&
    landlordPaperContractBackfillText_(contract.tenant_line_user_id || contract.line_user_id) === '';
}

function landlordPaperContractBackfillEnsureHeaders_(sheet, requiredHeaders) {
  if (!sheet || typeof sheet.getLastColumn !== 'function' || typeof sheet.getRange !== 'function') {
    return landlordPaperContractBackfillError_('PAPER_BACKFILL_SCHEMA_MIGRATION_NOT_READY', '紙本補登合約資料表尚未就緒', { added_headers: [] });
  }
  var currentWidth = Number(sheet.getLastColumn()) || 0;
  if (currentWidth <= 0) {
    return landlordPaperContractBackfillError_('PAPER_BACKFILL_SCHEMA_MIGRATION_NOT_READY', '紙本補登合約資料表缺少既有欄位', { added_headers: [] });
  }
  var headerRange = sheet.getRange(1, 1, 1, currentWidth);
  var headerValues = typeof headerRange.getDisplayValues === 'function'
    ? headerRange.getDisplayValues()[0]
    : headerRange.getValues()[0];
  var currentHeaders = (headerValues || []).map(landlordPaperContractBackfillText_);
  var missing = (Array.isArray(requiredHeaders) ? requiredHeaders : []).filter(function(header) {
    return currentHeaders.indexOf(header) < 0;
  });
  if (missing.length) sheet.getRange(1, currentWidth + 1, 1, missing.length).setValues([missing]);
  return { success: true, code: 'OK', data: { added_headers: missing } };
}

function migrateV2LandlordPaperContractBackfillSchema_(ss) {
  ss = ss || (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet ? SpreadsheetApp.getActiveSpreadsheet() : null);
  if (!ss || typeof ss.getSheetByName !== 'function') {
    return landlordPaperContractBackfillError_('PAPER_BACKFILL_SCHEMA_MIGRATION_NOT_READY', '找不到 Production 試算表', {
      missing_sheets: ['V2_contracts'],
      added_headers: { contracts: [] }
    });
  }
  if (typeof LockService === 'undefined' || !LockService || typeof LockService.getScriptLock !== 'function') {
    return landlordPaperContractBackfillError_('PAPER_BACKFILL_SCHEMA_MIGRATION_NOT_READY', '找不到 migration 鎖定模組', {
      missing_sheets: [],
      added_headers: { contracts: [] }
    });
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var contracts = ss.getSheetByName('V2_contracts');
    if (!contracts) {
      return landlordPaperContractBackfillError_('PAPER_BACKFILL_SCHEMA_MIGRATION_NOT_READY', '找不到 V2_contracts 資料表', {
        missing_sheets: ['V2_contracts'],
        added_headers: { contracts: [] }
      });
    }
    var result = landlordPaperContractBackfillEnsureHeaders_(contracts, V2_LANDLORD_PAPER_BACKFILL_CONTRACT_HEADERS_);
    if (!result.success) {
      return landlordPaperContractBackfillError_(result.code, result.message, {
        missing_sheets: [],
        added_headers: { contracts: (result.data && result.data.added_headers) || [] }
      });
    }
    return {
      success: true,
      code: 'OK',
      data: {
        migration: 'paper_contract_backfill_additive_v1',
        added_headers: { contracts: result.data.added_headers }
      }
    };
  } catch (error) {
    return landlordPaperContractBackfillError_('PAPER_BACKFILL_SCHEMA_MIGRATION_FAILED', '紙本補登欄位 migration 失敗', {
      missing_sheets: [],
      added_headers: { contracts: [] },
      error: landlordPaperContractBackfillText_(error && error.message)
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function landlordPaperContractBackfillResolveProductionSpreadsheet_() {
  if (typeof PropertiesService === 'undefined' ||
      !PropertiesService ||
      typeof PropertiesService.getScriptProperties !== 'function' ||
      typeof runtimeSpreadsheet_ !== 'function') {
    throw new Error('PRODUCTION_SPREADSHEET_RESOLVER_REQUIRED');
  }
  var spreadsheetId = landlordPaperContractBackfillText_(
    PropertiesService.getScriptProperties().getProperty('CMWEBS_SPREADSHEET_ID')
  );
  if (!spreadsheetId) throw new Error('PRODUCTION_SPREADSHEET_REFERENCE_REQUIRED');
  var spreadsheet = runtimeSpreadsheet_(spreadsheetId);
  if (!spreadsheet || typeof spreadsheet.getSheetByName !== 'function') {
    throw new Error('PRODUCTION_SPREADSHEET_REFERENCE_REQUIRED');
  }
  return spreadsheet;
}

function runV2LandlordPaperContractBackfillProductionMigration() {
  return migrateV2LandlordPaperContractBackfillSchema_(
    landlordPaperContractBackfillResolveProductionSpreadsheet_()
  );
}

function landlordPaperContractBackfillError_(code, message, data) {
  return {
    success: false,
    code: code,
    message: message,
    data: data || null
  };
}

function landlordPaperContractBackfillIsRequest_(body) {
  var request = body;
  if (typeof body === 'string') {
    try {
      request = JSON.parse(body);
    } catch (_) {
      return false;
    }
  }
  var action = landlordPaperContractBackfillText_(request && (request.action || request.v2_action));
  return action === 'landlord_contract_paper_backfill';
}

function landlordPaperContractBackfillHandlePost_(body) {
  var request = body;
  if (typeof body === 'string') {
    try {
      request = JSON.parse(body);
    } catch (_) {
      return landlordPaperContractBackfillError_('INVALID_JSON', '補登資料格式無效');
    }
  }
  if (!landlordPaperContractBackfillIsRequest_(request)) {
    return landlordPaperContractBackfillError_('INVALID_ACTION', '不支援的紙本合約補登操作');
  }
  var input = request && request.input && typeof request.input === 'object' ? request.input : request;
  return landlordPaperContractBackfillBySession_(request.session_token || '', input);
}

function landlordPaperContractBackfillBySession_(sessionToken, input) {
  if (typeof landlordInitiatedContractAccessFromSession_ !== 'function') {
    return landlordPaperContractBackfillError_('LANDLORD_REVIEW_SESSION_MODULE_REQUIRED', '找不到房東 session 模組');
  }
  var access = landlordInitiatedContractAccessFromSession_(sessionToken, 'contract_write');
  if (!access || access.success !== true) return access || landlordPaperContractBackfillError_('LANDLORD_REVIEW_SESSION_INVALID', '房東 session 無效');

  var normalized = landlordPaperContractBackfillValidateInput_(input || {});
  if (!normalized.success) return normalized;
  if (typeof landlordInitiatedContractWithScriptLock_ !== 'function') {
    return landlordPaperContractBackfillError_('CONTRACT_LOCK_MODULE_REQUIRED', '找不到合約操作鎖定模組');
  }
  return landlordInitiatedContractWithScriptLock_(function() {
    return landlordPaperContractBackfillCreateUnlocked_(access, normalized.data);
  });
}

function landlordPaperContractBackfillValidateInput_(input) {
  var source = input || {};
  var roomId = landlordPaperContractBackfillText_(source.room_id);
  var propertyId = landlordPaperContractBackfillText_(source.property_id);
  var tenantId = landlordPaperContractBackfillText_(source.tenant_id);
  var tenantName = landlordPaperContractBackfillText_(source.tenant_name);
  var tenantPhone = landlordPaperContractBackfillNormalizePhone_(source.tenant_phone);
  var tenantEmail = landlordPaperContractBackfillText_(source.tenant_email).toLowerCase();
  var startDate = landlordPaperContractBackfillDate_(source.start_date);
  var endDate = landlordPaperContractBackfillDate_(source.end_date);
  var paperSignedAt = landlordPaperContractBackfillDate_(source.paper_signed_at || source.signed_at);
  var idempotencyKey = landlordPaperContractBackfillText_(source.idempotency_key);
  var supersedeContractId = landlordPaperContractBackfillText_(source.supersede_contract_id);

  if (!roomId) return landlordPaperContractBackfillError_('ROOM_REQUIRED', '請選擇房間');
  if (!tenantName || tenantName.length > 80) return landlordPaperContractBackfillError_('INVALID_TENANT_NAME', '請輸入 1 至 80 字的房客姓名');
  if (!/^09\d{8}$/.test(tenantPhone)) return landlordPaperContractBackfillError_('INVALID_TENANT_PHONE', '請輸入正確的台灣手機號碼');
  if (tenantEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantEmail)) return landlordPaperContractBackfillError_('INVALID_TENANT_EMAIL', '房客 Email 格式不正確');
  if (!startDate || !endDate || startDate > endDate) return landlordPaperContractBackfillError_('INVALID_LEASE_DATE', '租約起訖日不正確');
  if (!paperSignedAt) return landlordPaperContractBackfillError_('INVALID_PAPER_SIGNED_DATE', '請輸入紙本簽約日');
  if (!idempotencyKey || idempotencyKey.length > 160) return landlordPaperContractBackfillError_('INVALID_IDEMPOTENCY_KEY', '缺少或不正確的補登冪等鍵');

  var moneyFields = [
    ['rent_amount', 'INVALID_RENT_AMOUNT', true],
    ['management_fee', 'INVALID_MANAGEMENT_FEE', false],
    ['deposit_amount', 'INVALID_DEPOSIT_AMOUNT', false],
    ['electricity_fee_rate', 'INVALID_ELECTRICITY_FEE_RATE', false],
    ['equipment_fee_rate', 'INVALID_EQUIPMENT_FEE_RATE', false]
  ];
  var amounts = {};
  for (var i = 0; i < moneyFields.length; i += 1) {
    var field = moneyFields[i][0];
    var value = landlordPaperContractBackfillMoney_(source[field]);
    if (value < 0 || (moneyFields[i][2] && value <= 0)) {
      return landlordPaperContractBackfillError_(moneyFields[i][1], '費用欄位不正確');
    }
    amounts[field] = value;
  }

  var depositMonths = landlordPaperContractBackfillNumber_(source.deposit_months);
  if (depositMonths < 0) return landlordPaperContractBackfillError_('INVALID_DEPOSIT_MONTHS', '押金月數不正確');
  var paymentDay = landlordPaperContractBackfillNumber_(source.payment_day || source.monthly_payment_day);
  if (!paymentDay || paymentDay < 1 || paymentDay > 31 || Math.floor(paymentDay) !== paymentDay) return landlordPaperContractBackfillError_('INVALID_PAYMENT_DAY', '付款日必須是 1 至 31');

  var paperFile = landlordPaperContractBackfillNormalizeFile_(source.paper_contract_file, true, 'PAPER_CONTRACT');
  if (!paperFile.success) return paperFile;
  var identityFront = landlordPaperContractBackfillNormalizeFile_(source.identity_front_file, false, 'IDENTITY_FRONT');
  if (!identityFront.success) return identityFront;
  var identityBack = landlordPaperContractBackfillNormalizeFile_(source.identity_back_file, false, 'IDENTITY_BACK');
  if (!identityBack.success) return identityBack;

  var normalized = {
    room_id: roomId,
    property_id: propertyId,
    tenant_id: tenantId,
    tenant_name: tenantName,
    tenant_phone: tenantPhone,
    tenant_email: tenantEmail,
    start_date: startDate,
    end_date: endDate,
    paper_signed_at: paperSignedAt,
    rent_amount: amounts.rent_amount,
    management_fee: amounts.management_fee,
    deposit_months: depositMonths,
    deposit_amount: amounts.deposit_amount,
    payment_day: paymentDay,
    electricity_fee_rate: amounts.electricity_fee_rate,
    equipment_fee_rate: amounts.equipment_fee_rate,
    note: landlordPaperContractBackfillText_(source.note),
    idempotency_key: idempotencyKey,
    paper_contract_file: paperFile.data,
    identity_front_file: identityFront.data,
    identity_back_file: identityBack.data,
    supersede_contract_id: supersedeContractId
  };
  normalized.payload_hash = landlordPaperContractBackfillPayloadHash_(normalized);
  return { success: true, code: 'OK', data: normalized };
}

function landlordPaperContractBackfillCreateUnlocked_(access, input) {
  var schema = landlordPaperContractBackfillSchema_();
  if (!schema.success) return schema;
  var workspaceId = landlordPaperContractBackfillWorkspaceId_(access);
  var landlordId = landlordPaperContractBackfillLandlordId_(access);
  if (!workspaceId || !landlordId) return landlordPaperContractBackfillError_('WORKSPACE_ACCESS_DENIED', 'Workspace 權限無效');

  var room = landlordPaperContractBackfillFindScopedRow_(schema.data.rooms, access, 'room_id', input.room_id);
  if (!room) return landlordPaperContractBackfillError_('ROOM_NOT_FOUND', '找不到房間或房間不屬於目前 Workspace');
  var propertyId = input.property_id || landlordPaperContractBackfillText_(room.property_id);
  var property = landlordPaperContractBackfillFindScopedRow_(schema.data.properties, access, 'property_id', propertyId);
  if (!property) return landlordPaperContractBackfillError_('PROPERTY_NOT_FOUND', '找不到物件');
  if (landlordPaperContractBackfillText_(room.property_id) !== landlordPaperContractBackfillText_(property.property_id)) return landlordPaperContractBackfillError_('ROOM_PROPERTY_MISMATCH', '房間不屬於所選物件');
  var contracts = landlordPaperContractBackfillRows_(schema.data.contracts);
  var existingByKey = contracts.find(function(row) {
    return landlordPaperContractBackfillText_(row.workspace_id) === workspaceId &&
      landlordPaperContractBackfillText_(row.paper_backfill_idempotency_key) === input.idempotency_key;
  });
  if (existingByKey) {
    if (!landlordPaperContractBackfillExistingPayloadMatches_(existingByKey, input, schema.data.documents)) return landlordPaperContractBackfillError_('IDEMPOTENCY_CONFLICT', '相同補登冪等鍵已有不同資料');
    return landlordPaperContractBackfillExistingResult_(schema, existingByKey, access);
  }

  var roomCurrentContractId = landlordPaperContractBackfillText_(room.current_contract_id);
  var replacementContract = null;
  var replacementInvite = null;
  var replacementMode = '';
  if (input.supersede_contract_id) {
    if (landlordPaperContractBackfillHeaders_(schema.data.contracts).indexOf('previous_contract_id') < 0) {
      return landlordPaperContractBackfillError_('PAPER_BACKFILL_SCHEMA_NOT_READY', '紙本轉換需要 previous_contract_id 欄位');
    }
    replacementContract = contracts.find(function(row) {
      return landlordPaperContractBackfillText_(row.contract_id) === input.supersede_contract_id &&
        landlordPaperContractBackfillText_(row.workspace_id) === workspaceId &&
        (!landlordPaperContractBackfillText_(row.landlord_id) || landlordPaperContractBackfillText_(row.landlord_id) === landlordId);
    });
    if (!replacementContract) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_CONTRACT_NOT_FOUND', '找不到可轉換的原電子合約');
    if (landlordPaperContractBackfillText_(replacementContract.room_id) !== input.room_id) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_SCOPE_MISMATCH', '原合約與房間資料不一致');
    var replacementStatus = landlordPaperContractBackfillText_(replacementContract.contract_status || replacementContract.status || '').toLowerCase();
    if (input.tenant_id) {
      if (landlordPaperContractBackfillText_(replacementContract.tenant_id) !== input.tenant_id) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_SCOPE_MISMATCH', '原電子合約與房客資料不一致');
      if (landlordPaperContractBackfillText_(replacementContract.contract_origin).toLowerCase() === 'landlord_initiated' && V2_LANDLORD_PAPER_BACKFILL_REPLACEMENT_STATUSES_.indexOf(replacementStatus) >= 0) {
        replacementMode = 'electronic';
      } else if (landlordPaperContractBackfillLegacyPendingReplacementEligible_(replacementContract)) {
        replacementMode = 'legacy_pending';
      } else {
        return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_NOT_ELIGIBLE', '只有尚未完成房客簽署的電子合約或未綁定的舊待啟用合約可以轉為紙本補登');
      }
    } else {
      replacementMode = 'orphan';
      var sourceTenantId = landlordPaperContractBackfillText_(replacementContract.tenant_id);
      var sourceTenant = sourceTenantId ? landlordPaperContractBackfillFindScopedRow_(schema.data.tenants, access, 'tenant_id', sourceTenantId) : null;
      if (sourceTenant) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_TENANT_REQUIRED', '原合約仍有房客資料，請從房客詳細資料補登');
      if (V2_LANDLORD_PAPER_BACKFILL_OPEN_STATUSES_.indexOf(replacementStatus) < 0) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_ORPHAN_NOT_ELIGIBLE', '原合約狀態不可進行資料不完整補登');
      if (landlordPaperContractBackfillText_(replacementContract.tenant_line_user_id || replacementContract.line_user_id)) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_ORPHAN_BOUND', '原合約已有 LINE 綁定，不能以資料不完整方式取代');
    }
    if (roomCurrentContractId && roomCurrentContractId !== input.supersede_contract_id) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_ROOM_MISMATCH', '房間目前指向其他合約，無法轉換');
    if (replacementMode === 'electronic') {
      if (!schema.data.invites) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_SCHEMA_NOT_READY', '找不到原電子合約邀請資料表');
      var missingInviteHeaders = V2_LANDLORD_PAPER_BACKFILL_REPLACEMENT_INVITE_HEADERS_.filter(function(header) {
        return landlordPaperContractBackfillHeaders_(schema.data.invites).indexOf(header) < 0;
      });
      if (missingInviteHeaders.length) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_SCHEMA_NOT_READY', '原電子合約邀請欄位尚未就緒', { missing_headers: missingInviteHeaders });
      replacementInvite = landlordPaperContractBackfillRows_(schema.data.invites).find(function(row) {
        return landlordPaperContractBackfillText_(row.invite_id) === landlordPaperContractBackfillText_(replacementContract.invite_id) &&
          landlordPaperContractBackfillText_(row.contract_id) === input.supersede_contract_id &&
          landlordPaperContractBackfillText_(row.workspace_id) === workspaceId;
      });
      if (!replacementInvite || V2_LANDLORD_PAPER_BACKFILL_REPLACEMENT_INVITE_STATUSES_.indexOf(landlordPaperContractBackfillText_(replacementInvite.status).toLowerCase()) < 0) {
        return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_INVITE_NOT_ELIGIBLE', '原電子合約邀請不存在、已取消或已被使用');
      }
    } else if (replacementMode === 'orphan' && schema.data.invites && landlordPaperContractBackfillText_(replacementContract.invite_id)) {
      replacementInvite = landlordPaperContractBackfillRows_(schema.data.invites).find(function(row) {
        return landlordPaperContractBackfillText_(row.invite_id) === landlordPaperContractBackfillText_(replacementContract.invite_id) &&
          landlordPaperContractBackfillText_(row.contract_id) === input.supersede_contract_id &&
          landlordPaperContractBackfillText_(row.workspace_id) === workspaceId;
      }) || null;
      if (replacementInvite && V2_LANDLORD_PAPER_BACKFILL_REPLACEMENT_INVITE_STATUSES_.indexOf(landlordPaperContractBackfillText_(replacementInvite.status).toLowerCase()) < 0) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_ORPHAN_INVITE_NOT_ELIGIBLE', '原合約邀請已被使用或已關閉，不能進行資料不完整補登');
    }
    if (landlordPaperContractBackfillText_(replacementContract.tenant_line_user_id || replacementContract.line_user_id)) return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_TENANT_BOUND', '原電子合約已有房客 LINE 綁定，請先走原簽署流程');
  }

  if (!replacementContract && (landlordPaperContractBackfillText_(room.room_status).toLowerCase() === 'occupied' || (roomCurrentContractId && contracts.some(function(row) {
    return landlordPaperContractBackfillText_(row.contract_id) === roomCurrentContractId &&
      V2_LANDLORD_PAPER_BACKFILL_OPEN_STATUSES_.indexOf(landlordPaperContractBackfillText_(row.contract_status || row.status || row.account_status).toLowerCase()) >= 0;
  })))) return landlordPaperContractBackfillError_('ROOM_ALREADY_OCCUPIED', '房間目前已有有效租約');
  if (landlordPaperContractBackfillText_(room.account_status).toLowerCase() === 'archived') return landlordPaperContractBackfillError_('ROOM_ARCHIVED', '房間已封存');

  var today = landlordPaperContractBackfillToday_();
  if (input.end_date < today) return landlordPaperContractBackfillError_('LEASE_ALREADY_EXPIRED', '租約結束日已過，請使用歷史合約或退房流程');
  var overlapping = contracts.find(function(row) {
    if (landlordPaperContractBackfillText_(row.workspace_id) !== workspaceId || landlordPaperContractBackfillText_(row.room_id) !== input.room_id) return false;
    if (replacementContract && landlordPaperContractBackfillText_(row.contract_id) === input.supersede_contract_id) return false;
    var status = landlordPaperContractBackfillText_(row.contract_status || row.status || row.account_status).toLowerCase();
    if (V2_LANDLORD_PAPER_BACKFILL_CLOSED_STATUSES_.indexOf(status) >= 0) return false;
    if (V2_LANDLORD_PAPER_BACKFILL_OPEN_STATUSES_.indexOf(status) < 0) return false;
    var rowStart = landlordPaperContractBackfillDate_(row.start_date || row.contract_start_date);
    var rowEnd = landlordPaperContractBackfillDate_(row.end_date || row.contract_end_date);
    return !rowStart || !rowEnd || landlordPaperContractBackfillDateRangesOverlap_(rowStart, rowEnd, input.start_date, input.end_date);
  });
  if (overlapping) return landlordPaperContractBackfillError_('ROOM_CONTRACT_OVERLAP', '此房間在所選租期已有租約');

  var tenant = null;
  var user = null;
  if (input.tenant_id) {
    tenant = landlordPaperContractBackfillFindScopedRow_(schema.data.tenants, access, 'tenant_id', input.tenant_id);
    if (!tenant) return landlordPaperContractBackfillError_('TENANT_NOT_FOUND', '找不到房客或房客不屬於目前 Workspace');
    var tenantRoomId = landlordPaperContractBackfillText_(tenant.room_id);
    if (tenantRoomId && tenantRoomId !== input.room_id) return landlordPaperContractBackfillError_('TENANT_ROOM_MISMATCH', '既有房客目前不屬於此房間');
    user = landlordPaperContractBackfillFindScopedRow_(schema.data.users, access, 'user_id', tenant.tenant_user_id || tenant.user_id);
    if (!user) return landlordPaperContractBackfillError_('TENANT_USER_NOT_FOUND', '找不到既有房客使用者資料');
    if (replacementContract && landlordPaperContractBackfillText_(tenant.tenant_line_user_id || tenant.line_user_id || (user && user.line_user_id))) {
      return landlordPaperContractBackfillError_('PAPER_REPLACEMENT_TENANT_BOUND', '原電子合約已有房客 LINE 綁定，請先走原簽署流程');
    }
    if (contracts.some(function(row) {
      if (replacementContract && landlordPaperContractBackfillText_(row.contract_id) === input.supersede_contract_id) return false;
      return landlordPaperContractBackfillText_(row.tenant_id) === input.tenant_id &&
        V2_LANDLORD_PAPER_BACKFILL_OPEN_STATUSES_.indexOf(landlordPaperContractBackfillText_(row.contract_status || row.status || row.account_status).toLowerCase()) >= 0;
    })) return landlordPaperContractBackfillError_('TENANT_ALREADY_ACTIVE', '既有房客已有有效租約');
  } else {
    var duplicatePhone = landlordPaperContractBackfillRows_(schema.data.tenants).find(function(row) {
      var status = landlordPaperContractBackfillText_(row.account_status || row.tenant_account_status || row.status || 'active').toLowerCase();
      if (V2_LANDLORD_PAPER_BACKFILL_CLOSED_STATUSES_.indexOf(status) >= 0) return false;
      return landlordPaperContractBackfillNormalizePhone_(row.tenant_phone || row.phone || row.mobile_phone) === input.tenant_phone;
    });
    if (duplicatePhone) return landlordPaperContractBackfillError_('TENANT_PHONE_ALREADY_ACTIVE', '此手機號碼已有啟用中的房客資料');
  }

  var now = new Date().toISOString();
  var actor = landlordPaperContractBackfillActor_(access);
  var tenantId = tenant ? landlordPaperContractBackfillText_(tenant.tenant_id) : landlordPaperContractBackfillUuid_('tenant');
  var tenantUserId = tenant ? landlordPaperContractBackfillText_(tenant.tenant_user_id || tenant.user_id) : landlordPaperContractBackfillUuid_('user');
  var contractId = landlordPaperContractBackfillUuid_('contract');
  var status = input.start_date > today ? 'upcoming' : 'active';
  var roomStatus = status === 'active' ? 'occupied' : (landlordPaperContractBackfillText_(room.room_status) || 'vacant');
  var contractNote = input.note;
  if (replacementContract) {
    var replacementLabel = replacementMode === 'orphan'
      ? '紙本補登取代房間既有但缺少房客資料的合約：'
      : replacementMode === 'legacy_pending'
        ? '紙本補登取代舊待啟用合約：'
        : '紙本補登取代未完成電子合約：';
    contractNote = (contractNote ? contractNote + '\n' : '') + replacementLabel + input.supersede_contract_id;
  }
  var contract = landlordPaperContractBackfillBuildContract_(access, actor, property, room, input, {
    contract_id: contractId,
    tenant_id: tenantId,
    tenant_user_id: tenantUserId,
    tenant_name: input.tenant_name,
    tenant_phone: input.tenant_phone,
    tenant_email: input.tenant_email,
    contract_status: status,
    status: status,
    account_status: status,
    signed_at: input.paper_signed_at,
    tenant_signed_at: '',
    tenant_signing_submission_status: 'approved',
    signing_mode: 'paper_backfill',
    contract_origin: 'paper_backfill',
    invite_id: '',
    previous_contract_id: replacementContract ? input.supersede_contract_id : '',
    contract_content: landlordPaperContractBackfillContent_(access, property, room, input),
    contract_version: 'paper-contract-document-1',
    paper_backfill_idempotency_key: input.idempotency_key,
    paper_backfill_payload_hash: input.payload_hash,
    created_by_user_id: actor.user_id,
    created_by_membership_id: actor.membership_id,
    created_at: now,
    updated_at: now,
    note: contractNote
  });
  var tenantObject = landlordPaperContractBackfillBuildTenant_(access, actor, property, room, input, tenantId, tenantUserId, contractId, now);
  var userObject = landlordPaperContractBackfillBuildUser_(access, actor, input, tenantUserId, now);
  if (tenant) {
    tenantObject.tenant_line_user_id = landlordPaperContractBackfillText_(tenant.tenant_line_user_id || tenant.line_user_id);
    tenantObject.line_user_id = landlordPaperContractBackfillText_(tenant.line_user_id || tenant.tenant_line_user_id);
    tenantObject.tenant_binding_status = replacementContract ? 'unbound' : landlordPaperContractBackfillText_(tenant.tenant_binding_status || tenant.binding_status || 'unbound');
    tenantObject.binding_status = replacementContract ? 'unbound' : landlordPaperContractBackfillText_(tenant.binding_status || tenant.tenant_binding_status || 'unbound');
    tenantObject.tenant_line_user_id = replacementContract ? '' : tenantObject.tenant_line_user_id;
    tenantObject.line_user_id = replacementContract ? '' : tenantObject.line_user_id;
    tenantObject.account_status = replacementContract ? 'active' : tenantObject.account_status;
    tenantObject.tenant_account_status = replacementContract ? 'active' : tenantObject.tenant_account_status;
    tenantObject.created_at = tenant.created_at || tenantObject.created_at;
    tenantObject.created_by_user_id = tenant.created_by_user_id || tenantObject.created_by_user_id;
    tenantObject.created_by_membership_id = tenant.created_by_membership_id || tenantObject.created_by_membership_id;
  }
  if (user) {
    userObject.line_user_id = replacementContract ? '' : landlordPaperContractBackfillText_(user.line_user_id);
    userObject.status = replacementContract ? 'active' : (user.status || userObject.status);
    userObject.account_status = replacementContract ? 'active' : (user.account_status || userObject.account_status);
    userObject.created_at = user.created_at || userObject.created_at;
    userObject.created_by_user_id = user.created_by_user_id || userObject.created_by_user_id;
  }
  var transaction = {
    newRows: [],
    originalRows: [],
    documents: [],
    createdViewRows: []
  };

  try {
    var documentResults = landlordPaperContractBackfillStoreDocuments_(access, schema.data.documents, input, tenantId, contractId, actor, now);
    if (!documentResults.success) {
      transaction.documents = documentResults.data && documentResults.data.documents ? documentResults.data.documents : [];
      return landlordPaperContractBackfillRollbackResult_(transaction, documentResults);
    }
    transaction.documents = documentResults.data.documents || [];

    if (!tenant) {
      landlordPaperContractBackfillAppend_(schema.data.users, userObject);
      transaction.newRows.push({ sheet: schema.data.users, idHeader: 'user_id', id: tenantUserId });
      landlordPaperContractBackfillAppend_(schema.data.tenants, tenantObject);
      transaction.newRows.push({ sheet: schema.data.tenants, idHeader: 'tenant_id', id: tenantId });
      tenant = landlordPaperContractBackfillFindRowById_(schema.data.tenants, 'tenant_id', tenantId);
      user = landlordPaperContractBackfillFindRowById_(schema.data.users, 'user_id', tenantUserId);
    } else {
      transaction.originalRows.push({ sheet: schema.data.tenants, row: tenant });
      landlordPaperContractBackfillUpdate_(schema.data.tenants, tenant, tenantObject);
      transaction.originalRows.push({ sheet: schema.data.users, row: user });
      landlordPaperContractBackfillUpdate_(schema.data.users, user, userObject);
      tenant = landlordPaperContractBackfillFindRowById_(schema.data.tenants, 'tenant_id', tenantId);
      user = landlordPaperContractBackfillFindRowById_(schema.data.users, 'user_id', tenantUserId);
    }

    landlordPaperContractBackfillAppend_(schema.data.contracts, contract);
    transaction.newRows.push({ sheet: schema.data.contracts, idHeader: 'contract_id', id: contractId });
    if (replacementContract) {
      transaction.originalRows.push({ sheet: schema.data.contracts, row: replacementContract });
      landlordPaperContractBackfillUpdate_(schema.data.contracts, replacementContract, {
        contract_status: 'cancelled', status: 'cancelled', account_status: 'cancelled', updated_at: now,
        note: landlordPaperContractBackfillText_(replacementContract.note) + (landlordPaperContractBackfillText_(replacementContract.note) ? '\n' : '') + '紙本補登取代：' + contractId
      });
      if (replacementInvite) {
        transaction.originalRows.push({ sheet: schema.data.invites, row: replacementInvite });
        landlordPaperContractBackfillUpdate_(schema.data.invites, replacementInvite, { status: 'cancelled', cancelled_at: now, updated_at: now });
      }
    }
    var roomBefore = landlordPaperContractBackfillFindRowById_(schema.data.rooms, 'room_id', input.room_id);
    transaction.originalRows.push({ sheet: schema.data.rooms, row: roomBefore });
    landlordPaperContractBackfillUpdate_(schema.data.rooms, roomBefore, {
      room_status: roomStatus,
      account_status: 'active',
      current_contract_id: contractId,
      current_tenant_id: tenantId,
      current_tenant_name: input.tenant_name,
      updated_by_user_id: actor.user_id,
      updated_by_membership_id: actor.membership_id,
      updated_at: now
    });

    var views = landlordPaperContractBackfillViewValues_(access, actor, property, room, input, tenantId, tenantUserId, contractId, status, now);
    landlordPaperContractBackfillUpsertViewTracked_(transaction, schema.data.landlordTenantListView, views);
    landlordPaperContractBackfillUpsertViewTracked_(transaction, schema.data.tenantHomeView, views);
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.flush) SpreadsheetApp.flush();

    return {
      success: true,
      code: 'PAPER_CONTRACT_BACKFILLED',
      message: '紙本合約已補登',
      data: {
        tenant: landlordPaperContractBackfillTenantResponse_(tenantObject),
        contract: landlordPaperContractBackfillContractResponse_(contract),
        room: { room_id: input.room_id, room_name: landlordPaperContractBackfillText_(room.room_name), room_status: roomStatus, current_contract_id: contractId, current_tenant_id: tenantId },
        paper_document: documentResults.data.documents[0],
        binding: { tenant_id: tenantId, binding_status: 'unbound' }
      }
    };
  } catch (error) {
    landlordPaperContractBackfillRollback_(transaction);
    return landlordPaperContractBackfillError_('PAPER_BACKFILL_WRITE_FAILED', '紙本合約補登失敗，未完成有效租約建立', { detail: landlordPaperContractBackfillText_(error && error.message) });
  }
}

function landlordPaperContractBackfillSchema_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || typeof ss.getSheetByName !== 'function') return landlordPaperContractBackfillError_('PAPER_BACKFILL_SCHEMA_NOT_READY', '合約資料表尚未就緒');
  var documents = ss.getSheetByName('V2_contract_documents');
  var sheets = {
    properties: ss.getSheetByName('V2_properties'),
    rooms: ss.getSheetByName('V2_rooms'),
    users: ss.getSheetByName('V2_users'),
    tenants: ss.getSheetByName('V2_tenants'),
    contracts: ss.getSheetByName('V2_contracts'),
    invites: ss.getSheetByName('V2_contract_invites'),
    documents: documents,
    landlordTenantListView: ss.getSheetByName('V2_landlord_tenant_list_view'),
    tenantHomeView: ss.getSheetByName('V2_tenant_home_view')
  };
  var required = ['properties', 'rooms', 'users', 'tenants', 'contracts', 'documents'].filter(function(key) { return !sheets[key]; });
  if (required.length) return landlordPaperContractBackfillError_('PAPER_BACKFILL_SCHEMA_NOT_READY', '缺少必要資料表：' + required.join(', '));
  var headers = landlordPaperContractBackfillHeaders_(sheets.contracts);
  var missing = V2_LANDLORD_PAPER_BACKFILL_CONTRACT_HEADERS_.filter(function(header) { return headers.indexOf(header) < 0; });
  if (missing.length) return landlordPaperContractBackfillError_('PAPER_BACKFILL_SCHEMA_NOT_READY', '紙本補登欄位尚未就緒', { missing_headers: missing });
  return { success: true, code: 'OK', data: sheets };
}

function landlordPaperContractBackfillStoreDocuments_(access, sheet, input, tenantId, contractId, actor, now) {
  if (typeof storeLandlordContractDocumentForAccess_ !== 'function') return landlordPaperContractBackfillError_('DOCUMENT_STORAGE_MODULE_REQUIRED', '找不到私有合約文件儲存模組');
  var files = [
    { type: 'legacy_contract', file: input.paper_contract_file },
    { type: 'identity_front', file: input.identity_front_file },
    { type: 'identity_back', file: input.identity_back_file }
  ];
  var stored = [];
  for (var i = 0; i < files.length; i += 1) {
    if (!files[i].file) continue;
    var file = files[i].file;
    var result = storeLandlordContractDocumentForAccess_(access, {
      tenant_id: tenantId,
      contract_id: contractId,
      document_type: files[i].type,
      file_name: file.file_name,
      mime_type: file.mime_type,
      base64: file.base64,
      file_bytes: file.bytes,
      byte_size: file.byte_size,
      sha256: file.sha256,
      idempotency_key: input.idempotency_key + ':' + files[i].type,
      note: input.note,
      document_origin: 'paper_backfill',
      created_by_user_id: actor.user_id,
      created_at: now
    }, { lock_held: true, sheet: sheet });
    if (!result || result.success !== true) {
      var failure = result || landlordPaperContractBackfillError_('PAPER_DOCUMENT_WRITE_FAILED', '紙本文件保存失敗');
      failure.data = Object.assign({}, failure.data || {}, { documents: stored });
      return failure;
    }
    stored.push(Object.assign({}, result.data || {}, { document_type: files[i].type, document_origin: 'paper_backfill' }));
  }
  return { success: true, code: 'OK', data: { documents: stored } };
}

function landlordPaperContractBackfillBuildContract_(access, actor, property, room, input, extra) {
  var contract = {
    contract_id: '',
    workspace_id: landlordPaperContractBackfillWorkspaceId_(access),
    landlord_id: landlordPaperContractBackfillLandlordId_(access),
    landlord_line_user_id: landlordPaperContractBackfillText_(access.line_user_id || access.principal_line_user_id),
    landlord_name: actor.name,
    tenant_id: '', tenant_user_id: '', tenant_line_user_id: '', tenant_name: '', tenant_phone: '', tenant_email: '',
    property_id: landlordPaperContractBackfillText_(property.property_id),
    property_name: landlordPaperContractBackfillText_(property.property_name || room.property_name),
    property_address: landlordPaperContractBackfillText_(property.property_address || property.address),
    room_id: landlordPaperContractBackfillText_(room.room_id),
    room_name: landlordPaperContractBackfillText_(room.room_name),
    start_date: input.start_date, contract_start_date: input.start_date,
    end_date: input.end_date, contract_end_date: input.end_date,
    rent_amount: input.rent_amount, monthly_rent: input.rent_amount,
    management_fee: input.management_fee, monthly_management_fee: input.management_fee,
    deposit_months: input.deposit_months, deposit_amount: input.deposit_amount,
    payment_day: input.payment_day, monthly_payment_day: input.payment_day,
    electricity_fee_rate: input.electricity_fee_rate, equipment_fee_rate: input.equipment_fee_rate,
    contract_status: 'active', status: 'active', account_status: 'active', signed_at: '', tenant_signed_at: '',
    tenant_signing_submission_status: 'approved', signing_mode: 'paper_backfill', contract_origin: 'paper_backfill',
    invite_id: '', contract_content: '', contract_version: 'paper-contract-document-1', previous_contract_id: '',
    created_by_user_id: actor.user_id, created_by_membership_id: actor.membership_id, created_at: '', updated_at: '', note: input.note
  };
  return Object.assign(contract, extra || {});
}

function landlordPaperContractBackfillBuildTenant_(access, actor, property, room, input, tenantId, tenantUserId, contractId, now) {
  return {
    tenant_id: tenantId, tenant_user_id: tenantUserId, user_id: tenantUserId,
    workspace_id: landlordPaperContractBackfillWorkspaceId_(access), landlord_id: landlordPaperContractBackfillLandlordId_(access),
    landlord_line_user_id: landlordPaperContractBackfillText_(access.line_user_id || access.principal_line_user_id),
    tenant_line_user_id: '', line_user_id: '', tenant_name: input.tenant_name, name: input.tenant_name,
    tenant_phone: input.tenant_phone, phone: input.tenant_phone, tenant_email: input.tenant_email, email: input.tenant_email,
    property_id: property.property_id, property_name: property.property_name || room.property_name,
    room_id: room.room_id, room_name: room.room_name, room_list: room.room_name, current_contract_id: contractId,
    tenant_binding_status: 'unbound', binding_status: 'unbound', account_status: 'active', tenant_account_status: 'active',
    created_by_user_id: actor.user_id, created_by_membership_id: actor.membership_id, created_at: now, updated_at: now, note: input.note
  };
}

function landlordPaperContractBackfillBuildUser_(access, actor, input, tenantUserId, now) {
  return {
    user_id: tenantUserId, workspace_id: landlordPaperContractBackfillWorkspaceId_(access), landlord_id: landlordPaperContractBackfillLandlordId_(access),
    line_user_id: '', role: 'tenant', name: input.tenant_name, phone: input.tenant_phone, email: input.tenant_email,
    status: 'active', account_status: 'active', active_workspace_id: landlordPaperContractBackfillWorkspaceId_(access),
    created_by_user_id: actor.user_id, created_at: now, updated_at: now, note: 'Created by landlord paper contract backfill'
  };
}

function landlordPaperContractBackfillContent_(access, property, room, input) {
  if (typeof landlordInitiatedContractBuildDocument_ === 'function') {
    try { return landlordInitiatedContractBuildDocument_(access, property, room, input, input.tenant_name) || ''; } catch (_) {}
  }
  return JSON.stringify({
    landlord_name: landlordPaperContractBackfillText_(access.user && access.user.name),
    tenant_name: input.tenant_name,
    tenant_phone: input.tenant_phone,
    property_name: property.property_name || room.property_name || '',
    room_name: room.room_name || '',
    start_date: input.start_date, end_date: input.end_date,
    rent_amount: input.rent_amount, management_fee: input.management_fee,
    deposit_amount: input.deposit_amount, payment_day: input.payment_day,
    source: 'paper_backfill'
  });
}

function landlordPaperContractBackfillViewValues_(access, actor, property, room, input, tenantId, tenantUserId, contractId, status, now) {
  return {
    line_user_id: '', user_id: tenantUserId, workspace_id: landlordPaperContractBackfillWorkspaceId_(access),
    landlord_id: landlordPaperContractBackfillLandlordId_(access), landlord_name: actor.name, tenant_line_user_id: '',
    tenant_user_id: tenantUserId, tenant_id: tenantId, tenant_name: input.tenant_name, tenant_phone: input.tenant_phone,
    tenant_email: input.tenant_email, tenant_binding_status: 'unbound', binding_status: 'unbound',
    tenant_account_status: 'active', account_status: 'active', property_id: property.property_id,
    property_name: property.property_name || room.property_name || '', room_id: room.room_id, room_name: room.room_name,
    room_list: room.room_name, current_contract_id: contractId, contract_status: status,
    contract_start_date: input.start_date, contract_end_date: input.end_date, created_at: now, updated_at: now
  };
}

function landlordPaperContractBackfillExistingResult_(schema, existing, access) {
  var existingStatus = landlordPaperContractBackfillText_(existing.contract_status || existing.status || 'active').toLowerCase();
  var existingTenant = landlordPaperContractBackfillRows_(schema.data.tenants).find(function(row) {
    return landlordPaperContractBackfillText_(row.tenant_id) === landlordPaperContractBackfillText_(existing.tenant_id);
  });
  var existingBindingStatus = landlordPaperContractBackfillText_((existingTenant && (existingTenant.tenant_binding_status || existingTenant.binding_status)) || (existingTenant && (existingTenant.tenant_line_user_id || existingTenant.line_user_id) ? 'bound' : '') || existing.tenant_binding_status || 'unbound');
  var document = landlordPaperContractBackfillRows_(schema.data.documents).find(function(row) {
    return landlordPaperContractBackfillText_(row.contract_id) === landlordPaperContractBackfillText_(existing.contract_id) &&
      landlordPaperContractBackfillText_(row.document_type) === 'legacy_contract';
  });
  return {
    success: true,
    code: 'IDEMPOTENT',
    message: '紙本合約補登已完成，重複請求直接回傳既有資料',
    data: {
      tenant: { tenant_id: landlordPaperContractBackfillText_(existing.tenant_id), tenant_user_id: landlordPaperContractBackfillText_(existing.tenant_user_id), tenant_name: landlordPaperContractBackfillText_(existing.tenant_name), tenant_phone: landlordPaperContractBackfillMaskPhone_(existing.tenant_phone) },
      contract: landlordPaperContractBackfillContractResponse_(existing),
      room: { room_id: landlordPaperContractBackfillText_(existing.room_id), room_name: landlordPaperContractBackfillText_(existing.room_name), room_status: existingStatus === 'upcoming' ? landlordPaperContractBackfillText_(existing.room_status || 'vacant') : 'occupied', current_contract_id: landlordPaperContractBackfillText_(existing.contract_id), current_tenant_id: landlordPaperContractBackfillText_(existing.tenant_id) },
      paper_document: document ? { document_id: landlordPaperContractBackfillText_(document.document_id), document_type: 'legacy_contract', document_origin: 'paper_backfill', status: landlordPaperContractBackfillText_(document.status || 'stored') } : null,
      binding: { tenant_id: landlordPaperContractBackfillText_(existing.tenant_id), binding_status: existingBindingStatus }
    }
  };
}

function landlordPaperContractBackfillExistingPayloadMatches_(row, input, documentsSheet) {
  if (landlordPaperContractBackfillText_(row.paper_backfill_payload_hash)) return landlordPaperContractBackfillText_(row.paper_backfill_payload_hash) === input.payload_hash;
  var document = landlordPaperContractBackfillRows_(documentsSheet).find(function(item) {
    return landlordPaperContractBackfillText_(item.contract_id) === landlordPaperContractBackfillText_(row.contract_id) && landlordPaperContractBackfillText_(item.document_type) === 'legacy_contract';
  });
  return landlordPaperContractBackfillText_(row.room_id) === input.room_id &&
    landlordPaperContractBackfillDate_(row.start_date || row.contract_start_date) === input.start_date &&
    landlordPaperContractBackfillDate_(row.end_date || row.contract_end_date) === input.end_date &&
    landlordPaperContractBackfillMoney_(row.rent_amount) === input.rent_amount &&
    (!document || landlordPaperContractBackfillText_(document.sha256) === input.paper_contract_file.sha256);
}

function landlordPaperContractBackfillRollbackResult_(transaction, result) {
  landlordPaperContractBackfillRollback_(transaction);
  return result;
}

function landlordPaperContractBackfillRollback_(transaction) {
  var i;
  for (i = (transaction.documents || []).length - 1; i >= 0; i -= 1) {
    if (typeof removeLandlordContractDocumentForBackfill_ === 'function') {
      try { removeLandlordContractDocumentForBackfill_(transaction.documents[i].document_id); } catch (_) {}
    }
  }
  for (i = (transaction.createdViewRows || []).length - 1; i >= 0; i -= 1) {
    landlordPaperContractBackfillDeleteCompositeRow_(transaction.createdViewRows[i].sheet, transaction.createdViewRows[i].row);
  }
  for (i = (transaction.newRows || []).length - 1; i >= 0; i -= 1) landlordPaperContractBackfillDeleteById_(transaction.newRows[i].sheet, transaction.newRows[i].idHeader, transaction.newRows[i].id);
  for (i = (transaction.originalRows || []).length - 1; i >= 0; i -= 1) landlordPaperContractBackfillRestore_(transaction.originalRows[i].sheet, transaction.originalRows[i].row);
}

function landlordPaperContractBackfillFindScopedRow_(sheet, access, idHeader, idValue) {
  var workspaceId = landlordPaperContractBackfillWorkspaceId_(access);
  var landlordIds = (access.principals || []).map(function(item) { return landlordPaperContractBackfillText_(item.landlord_id); });
  return landlordPaperContractBackfillRows_(sheet).find(function(row) {
    if (landlordPaperContractBackfillText_(row[idHeader]) !== landlordPaperContractBackfillText_(idValue)) return false;
    var rowWorkspace = landlordPaperContractBackfillText_(row.workspace_id);
    return rowWorkspace === workspaceId || (!rowWorkspace && landlordIds.indexOf(landlordPaperContractBackfillText_(row.landlord_id)) >= 0);
  }) || null;
}

function landlordPaperContractBackfillFindRowById_(sheet, idHeader, idValue) {
  return landlordPaperContractBackfillRows_(sheet).find(function(row) { return landlordPaperContractBackfillText_(row[idHeader]) === landlordPaperContractBackfillText_(idValue); }) || null;
}

function landlordPaperContractBackfillUpsertViewTracked_(transaction, sheet, values) {
  if (!sheet) return;
  var target = landlordPaperContractBackfillRows_(sheet).find(function(row) {
    return landlordPaperContractBackfillText_(row.tenant_id) === landlordPaperContractBackfillText_(values.tenant_id) && landlordPaperContractBackfillText_(row.workspace_id) === landlordPaperContractBackfillText_(values.workspace_id);
  });
  if (target) {
    transaction.originalRows.push({ sheet: sheet, row: target });
    landlordPaperContractBackfillUpdate_(sheet, target, values);
    return;
  }
  landlordPaperContractBackfillAppend_(sheet, values);
  var created = landlordPaperContractBackfillRows_(sheet).find(function(row) {
    return landlordPaperContractBackfillText_(row.tenant_id) === landlordPaperContractBackfillText_(values.tenant_id) && landlordPaperContractBackfillText_(row.workspace_id) === landlordPaperContractBackfillText_(values.workspace_id);
  });
  if (!created) throw new Error('paper backfill view append could not be verified');
  transaction.createdViewRows.push({ sheet: sheet, row: created });
}

function landlordPaperContractBackfillAppend_(sheet, object) {
  var headers = landlordPaperContractBackfillHeaders_(sheet);
  sheet.appendRow(headers.map(function(header) { return object[header] === undefined ? '' : object[header]; }));
}

function landlordPaperContractBackfillUpdate_(sheet, row, updates) {
  if (!sheet || !row) return;
  var headers = landlordPaperContractBackfillHeaders_(sheet);
  Object.keys(updates || {}).forEach(function(header) {
    var column = headers.indexOf(header);
    if (column >= 0) sheet.getRange(row._sheet_row || row.__row_number, column + 1).setValue(updates[header]);
  });
}

function landlordPaperContractBackfillDeleteById_(sheet, idHeader, idValue) {
  if (!sheet || typeof sheet.deleteRow !== 'function') return;
  var row = landlordPaperContractBackfillFindRowById_(sheet, idHeader, idValue);
  if (row) sheet.deleteRow(row._sheet_row || row.__row_number);
}

function landlordPaperContractBackfillDeleteCompositeRow_(sheet, row) {
  if (!sheet || !row || typeof sheet.deleteRow !== 'function') return;
  var current = landlordPaperContractBackfillRows_(sheet).find(function(candidate) {
    return landlordPaperContractBackfillText_(candidate.tenant_id) === landlordPaperContractBackfillText_(row.tenant_id) && landlordPaperContractBackfillText_(candidate.workspace_id) === landlordPaperContractBackfillText_(row.workspace_id);
  });
  if (current) sheet.deleteRow(current._sheet_row || current.__row_number);
}

function landlordPaperContractBackfillRestore_(sheet, row) {
  if (!sheet || !row) return;
  var headers = landlordPaperContractBackfillHeaders_(sheet);
  var values = headers.map(function(header) { return row[header] === undefined ? '' : row[header]; });
  sheet.getRange(row._sheet_row || row.__row_number, 1, 1, headers.length).setValues([values]);
}

function landlordPaperContractBackfillRows_(sheet) {
  if (!sheet) return [];
  if (typeof landlordInitiatedContractRows_ === 'function') return landlordInitiatedContractRows_(sheet) || [];
  if (typeof lmSheetObjects_ === 'function') return lmSheetObjects_(sheet) || [];
  var values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  var headers = values.shift().map(landlordPaperContractBackfillText_);
  return values.map(function(row, index) {
    var object = { _sheet_row: index + 2 };
    headers.forEach(function(header, column) { object[header] = row[column]; });
    return object;
  });
}

function landlordPaperContractBackfillHeaders_(sheet) {
  if (!sheet) return [];
  if (typeof landlordInitiatedContractHeaders_ === 'function') return landlordInitiatedContractHeaders_(sheet);
  var lastColumn = Number(sheet.getLastColumn && sheet.getLastColumn()) || 0;
  return lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(landlordPaperContractBackfillText_) : [];
}

function landlordPaperContractBackfillContractResponse_(contract) {
  return {
    contract_id: landlordPaperContractBackfillText_(contract.contract_id),
    tenant_id: landlordPaperContractBackfillText_(contract.tenant_id),
    tenant_name: landlordPaperContractBackfillText_(contract.tenant_name),
    room_id: landlordPaperContractBackfillText_(contract.room_id),
    room_name: landlordPaperContractBackfillText_(contract.room_name),
    property_id: landlordPaperContractBackfillText_(contract.property_id),
    property_name: landlordPaperContractBackfillText_(contract.property_name),
    contract_status: landlordPaperContractBackfillText_(contract.contract_status || contract.status),
    start_date: landlordPaperContractBackfillDate_(contract.start_date || contract.contract_start_date),
    end_date: landlordPaperContractBackfillDate_(contract.end_date || contract.contract_end_date),
    rent_amount: landlordPaperContractBackfillMoney_(contract.rent_amount || contract.monthly_rent),
    management_fee: landlordPaperContractBackfillMoney_(contract.management_fee || contract.monthly_management_fee),
    deposit_amount: landlordPaperContractBackfillMoney_(contract.deposit_amount),
    signed_at: landlordPaperContractBackfillDate_(contract.signed_at),
    tenant_signing_submission_status: landlordPaperContractBackfillText_(contract.tenant_signing_submission_status),
    signing_mode: landlordPaperContractBackfillText_(contract.signing_mode),
    contract_origin: landlordPaperContractBackfillText_(contract.contract_origin),
    previous_contract_id: landlordPaperContractBackfillText_(contract.previous_contract_id)
  };
}

function landlordPaperContractBackfillTenantResponse_(tenant) {
  return {
    tenant_id: landlordPaperContractBackfillText_(tenant.tenant_id),
    tenant_user_id: landlordPaperContractBackfillText_(tenant.tenant_user_id || tenant.user_id),
    tenant_name: landlordPaperContractBackfillText_(tenant.tenant_name || tenant.name),
    tenant_phone: landlordPaperContractBackfillText_(tenant.tenant_phone || tenant.phone),
    tenant_binding_status: landlordPaperContractBackfillText_(tenant.tenant_binding_status || tenant.binding_status)
  };
}

function landlordPaperContractBackfillNormalizeFile_(value, required, label) {
  if (!value) return required ? landlordPaperContractBackfillError_(label + '_REQUIRED', '請上傳紙本合約檔案') : { success: true, code: 'OK', data: null };
  var fileName = landlordPaperContractBackfillText_(value.file_name || value.name);
  var mimeType = landlordPaperContractBackfillText_(value.mime_type || value.type).toLowerCase();
  var base64 = landlordPaperContractBackfillText_(value.base64);
  if (!fileName || !mimeType || !base64) return landlordPaperContractBackfillError_('INVALID_FILE_PAYLOAD', '上傳檔案資料不完整');
  if (['application/pdf', 'image/jpeg', 'image/png'].indexOf(mimeType) < 0) return landlordPaperContractBackfillError_('INVALID_FILE_MIME_TYPE', '僅支援 PDF、JPG、PNG');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) return landlordPaperContractBackfillError_('INVALID_FILE_BASE64', '上傳檔案不是合法 Base64');
  var bytes;
  try { bytes = Utilities.base64Decode(base64); } catch (_) { return landlordPaperContractBackfillError_('INVALID_FILE_BASE64', '上傳檔案不是合法 Base64'); }
  if (!bytes || !bytes.length) return landlordPaperContractBackfillError_('INVALID_FILE_BASE64', '上傳檔案內容為空');
  if (bytes.length > V2_LANDLORD_PAPER_BACKFILL_DOCUMENT_MAX_BYTES_) return landlordPaperContractBackfillError_('INVALID_FILE_SIZE', '檔案大小不可超過 8MB');
  return { success: true, code: 'OK', data: {
    file_name: fileName,
    mime_type: mimeType,
    base64: base64,
    bytes: bytes,
    byte_size: bytes.length,
    sha256: landlordPaperContractBackfillSha256_(bytes)
  }};
}

function landlordPaperContractBackfillSha256_(bytes) {
  if (typeof ldComputeSha256Hex_ === 'function') return ldComputeSha256Hex_(bytes);
  if (typeof Utilities !== 'undefined' && Utilities.computeDigest) {
    var algorithm = Utilities.DigestAlgorithm && Utilities.DigestAlgorithm.SHA_256;
    var digest = Utilities.computeDigest(algorithm, bytes);
    return (digest || []).map(function(byte) { return ('0' + (byte < 0 ? byte + 256 : byte).toString(16)).slice(-2); }).join('');
  }
  return (bytes || []).join(',');
}

function landlordPaperContractBackfillPayloadHash_(input) {
  var payload = [
    input.room_id, input.property_id, input.tenant_id, input.tenant_name, input.tenant_phone, input.tenant_email,
    input.start_date, input.end_date, input.paper_signed_at, input.rent_amount, input.management_fee,
    input.deposit_months, input.deposit_amount, input.payment_day, input.electricity_fee_rate,
    input.equipment_fee_rate, input.supersede_contract_id, input.paper_contract_file.sha256,
    input.identity_front_file ? input.identity_front_file.sha256 : '', input.identity_back_file ? input.identity_back_file.sha256 : ''
  ].join('|');
  var bytes = [];
  for (var i = 0; i < payload.length; i += 1) bytes.push(payload.charCodeAt(i));
  return landlordPaperContractBackfillSha256_(bytes);
}

function landlordPaperContractBackfillDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) return Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd');
    return value.toISOString().slice(0, 10);
  }
  var text = landlordPaperContractBackfillText_(value);
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  var date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]) ? match[0] : '';
}

function landlordPaperContractBackfillToday_() {
  if (typeof tenantLeaseTaipeiToday_ === 'function') return landlordPaperContractBackfillDate_(tenantLeaseTaipeiToday_());
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  return new Date().toISOString().slice(0, 10);
}

function landlordPaperContractBackfillDateRangesOverlap_(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function landlordPaperContractBackfillMoney_(value) {
  var number = Number(landlordPaperContractBackfillText_(value).replace(/,/g, ''));
  return isFinite(number) ? number : -1;
}

function landlordPaperContractBackfillNumber_(value) {
  var number = Number(landlordPaperContractBackfillText_(value).replace(/,/g, ''));
  return isFinite(number) ? number : 0;
}

function landlordPaperContractBackfillNormalizePhone_(value) {
  var phone = landlordPaperContractBackfillText_(value).replace(/\D/g, '');
  if (phone.length === 9 && phone.charAt(0) === '9') phone = '0' + phone;
  return phone;
}

function landlordPaperContractBackfillText_(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function landlordPaperContractBackfillWorkspaceId_(access) {
  if (typeof landlordInitiatedContractWorkspaceId_ === 'function') return landlordInitiatedContractWorkspaceId_(access);
  return landlordPaperContractBackfillText_(access && access.workspace && access.workspace.workspace_id).toUpperCase();
}

function landlordPaperContractBackfillLandlordId_(access) {
  if (typeof landlordInitiatedContractLandlordId_ === 'function') return landlordInitiatedContractLandlordId_(access);
  return landlordPaperContractBackfillText_(access && access.principals && access.principals[0] && access.principals[0].landlord_id);
}

function landlordPaperContractBackfillActor_(access) {
  if (typeof landlordInitiatedContractActor_ === 'function') return landlordInitiatedContractActor_(access);
  return { user_id: landlordPaperContractBackfillText_(access.user && access.user.user_id), membership_id: landlordPaperContractBackfillText_(access.membership && access.membership.membership_id), name: landlordPaperContractBackfillText_(access.user && access.user.name) || '房東' };
}

function landlordPaperContractBackfillUuid_(prefix) {
  var uuid = typeof Utilities !== 'undefined' && Utilities.getUuid ? Utilities.getUuid() : String(new Date().getTime()) + '-' + Math.random();
  return prefix + '-' + uuid;
}

function landlordPaperContractBackfillMaskPhone_(value) {
  var phone = landlordPaperContractBackfillNormalizePhone_(value);
  return phone.length === 10 ? phone.slice(0, 4) + '****' + phone.slice(-2) : phone;
}
