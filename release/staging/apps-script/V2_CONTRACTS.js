/**
 * CMWebs V2 lease lifecycle (Phase 92 staging only).
 *
 * Physical sheet stays V2_contracts for compatibility with existing runtime.
 * Notifications are enqueued through Phase 90 and never sent directly here.
 */

const V2_CONTRACTS_SHEET_ = 'V2_contracts';

const V2_CONTRACTS_REQUIRED_HEADERS_ = [
  'contract_id',
  'created_at',
  'updated_at',
  'workspace_id',
  'landlord_id',
  'tenant_id',
  'tenant_user_id',
  'property_id',
  'room_id',
  'contract_status',
  'start_date',
  'end_date',
  'monthly_rent',
  'deposit_amount',
  'payment_due_day',
  'terms',
  'note',
  'created_by',
  'updated_by',
  'activated_at',
  'ended_at',
  'terminated_at',
  'cancelled_at',
  'deleted_at',
  'expiry_notification_queue_id',
  'expiry_notified_at',
  'renewed_from_contract_id'
];

const V2_CONTRACT_STATUS_TRANSITIONS_ = {
  draft: ['active', 'cancelled'],
  active: ['expiring', 'ended', 'terminated'],
  expiring: ['renewed', 'ended', 'terminated'],
  renewed: [],
  ended: [],
  terminated: [],
  cancelled: [],
  deleted: []
};


function migrateStagingContractLifecycle() {
  runtimeRequireSchemaMigration_();
  contractLifecycleAssertEnabled_();

  const ss = runtimeSpreadsheet_();
  let sheet = ss.getSheetByName(V2_CONTRACTS_SHEET_);
  let created = false;
  if (!sheet) {
    sheet = ss.insertSheet(V2_CONTRACTS_SHEET_);
    created = true;
  }
  contractLifecycleEnsureHeaders_(sheet);

  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'processContractExpiryNotifications';
  });
  let triggerCreated = false;
  if (triggers.length === 0) {
    ScriptApp.newTrigger('processContractExpiryNotifications')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();
    triggerCreated = true;
  }

  return {
    success: true,
    environment: 'staging',
    module: 'V2_CONTRACTS',
    physical_sheet: V2_CONTRACTS_SHEET_,
    sheet_created: created,
    required_header_count: V2_CONTRACTS_REQUIRED_HEADERS_.length,
    expiry_trigger_count: triggers.length + (triggerCreated ? 1 : 0),
    trigger_created: triggerCreated
  };
}


function getLandlordContractsByLineUid_(lineUserId, status) {
  const access = contractLifecycleAccess_(lineUserId);
  if (!access.success) return access;

  const workspaceId = contractLifecycleText_(access.workspace.workspace_id);
  const statusFilter = contractLifecycleText_(status).toLowerCase();
  const contracts = contractLifecycleRows_(contractLifecycleSheet_())
    .filter(function (row) {
      if (contractLifecycleText_(row.workspace_id) !== workspaceId) return false;
      const rowStatus = contractLifecycleStatus_(row);
      if (rowStatus === 'deleted') return false;
      return !statusFilter || rowStatus === statusFilter;
    })
    .map(contractLifecyclePublic_);

  return {
    success: true,
    code: 'OK',
    data: { workspace_id: workspaceId, contracts: contracts }
  };
}


function createLandlordContractByLineUid_(lineUserId, input) {
  const access = contractLifecycleAccess_(lineUserId);
  if (!access.success) return access;
  input = input || {};

  const workspaceId = contractLifecycleText_(access.workspace.workspace_id);
  const tenantId = contractLifecycleText_(input.tenant_id);
  const propertyId = contractLifecycleText_(input.property_id);
  const roomId = contractLifecycleText_(input.room_id);
  if (!tenantId || !propertyId || !roomId) {
    return contractLifecycleFailure_(
      'CONTRACT_RELATION_REQUIRED',
      'tenant、property 與 room 為必要欄位'
    );
  }

  const relation = contractLifecycleResolveRelation_(
    workspaceId,
    tenantId,
    propertyId,
    roomId
  );
  if (!relation.success) return relation;

  const startDate = contractLifecycleDateText_(input.start_date);
  const endDate = contractLifecycleDateText_(input.end_date);
  if (!startDate || !endDate || startDate > endDate) {
    return contractLifecycleFailure_(
      'CONTRACT_DATE_INVALID',
      '租約起訖日期不完整或順序錯誤'
    );
  }

  const monthlyRent = Number(input.monthly_rent);
  const depositAmount = Number(input.deposit_amount || 0);
  const dueDay = Number(input.payment_due_day || 1);
  if (!isFinite(monthlyRent) || monthlyRent < 0) {
    return contractLifecycleFailure_('CONTRACT_RENT_INVALID', '月租金格式錯誤');
  }
  if (!isFinite(depositAmount) || depositAmount < 0) {
    return contractLifecycleFailure_('CONTRACT_DEPOSIT_INVALID', '押金格式錯誤');
  }
  if (!isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
    return contractLifecycleFailure_('CONTRACT_DUE_DAY_INVALID', '繳租日必須為 1 至 31');
  }

  const now = new Date();
  const record = {
    contract_id: contractLifecycleMakeId_(),
    created_at: now,
    updated_at: now,
    workspace_id: workspaceId,
    landlord_id: contractLifecycleText_(
      access.principal_landlord_id || relation.landlord_id
    ),
    tenant_id: tenantId,
    tenant_user_id: contractLifecycleText_(relation.tenant_user_id),
    property_id: propertyId,
    room_id: roomId,
    contract_status: 'draft',
    start_date: startDate,
    end_date: endDate,
    monthly_rent: monthlyRent,
    deposit_amount: depositAmount,
    payment_due_day: dueDay,
    terms: contractLifecycleText_(input.terms),
    note: contractLifecycleText_(input.note),
    created_by: contractLifecycleText_(access.user && access.user.user_id),
    updated_by: contractLifecycleText_(access.user && access.user.user_id),
    activated_at: '',
    ended_at: '',
    terminated_at: '',
    cancelled_at: '',
    deleted_at: '',
    expiry_notification_queue_id: '',
    expiry_notified_at: '',
    renewed_from_contract_id: contractLifecycleText_(
      input.renewed_from_contract_id
    )
  };

  const sheet = contractLifecycleSheet_();
  workspaceAppendObject_(sheet, record);

  return {
    success: true,
    code: 'OK',
    message: '租約草稿已建立',
    data: { contract: contractLifecyclePublic_(record) }
  };
}


function updateLandlordContractByLineUid_(lineUserId, contractId, input) {
  const access = contractLifecycleAccess_(lineUserId);
  if (!access.success) return access;
  input = input || {};

  const match = contractLifecycleFindForWorkspace_(
    contractId,
    access.workspace.workspace_id
  );
  if (!match.success) return match;
  const contract = match.contract;
  if (contractLifecycleStatus_(contract) !== 'draft') {
    return contractLifecycleFailure_(
      'CONTRACT_NOT_EDITABLE',
      '只有草稿租約可修改主要條件'
    );
  }

  const updates = {};
  ['start_date', 'end_date'].forEach(function (key) {
    if (input[key] !== undefined) updates[key] = contractLifecycleDateText_(input[key]);
  });
  ['monthly_rent', 'deposit_amount', 'payment_due_day'].forEach(function (key) {
    if (input[key] !== undefined && input[key] !== '') updates[key] = Number(input[key]);
  });
  ['terms', 'note'].forEach(function (key) {
    if (input[key] !== undefined) updates[key] = contractLifecycleText_(input[key]);
  });

  const startDate = updates.start_date || contractLifecycleDateText_(contract.start_date);
  const endDate = updates.end_date || contractLifecycleDateText_(contract.end_date);
  if (!startDate || !endDate || startDate > endDate) {
    return contractLifecycleFailure_('CONTRACT_DATE_INVALID', '租約日期錯誤');
  }
  if (updates.payment_due_day !== undefined &&
      (updates.payment_due_day < 1 || updates.payment_due_day > 31)) {
    return contractLifecycleFailure_('CONTRACT_DUE_DAY_INVALID', '繳租日必須為 1 至 31');
  }
  if (updates.monthly_rent !== undefined && updates.monthly_rent < 0) {
    return contractLifecycleFailure_('CONTRACT_RENT_INVALID', '月租金格式錯誤');
  }
  if (updates.deposit_amount !== undefined && updates.deposit_amount < 0) {
    return contractLifecycleFailure_('CONTRACT_DEPOSIT_INVALID', '押金格式錯誤');
  }

  updates.updated_at = new Date();
  updates.updated_by = contractLifecycleText_(access.user && access.user.user_id);
  contractLifecycleUpdateColumns_(match.sheet, contract.__row_number, updates);
  Object.keys(updates).forEach(function (key) { contract[key] = updates[key]; });

  return {
    success: true,
    code: 'OK',
    message: '租約草稿已更新',
    data: { contract: contractLifecyclePublic_(contract) }
  };
}


function activateLandlordContractByLineUid_(lineUserId, contractId) {
  const access = contractLifecycleAccess_(lineUserId);
  if (!access.success) return access;

  const match = contractLifecycleFindForWorkspace_(
    contractId,
    access.workspace.workspace_id
  );
  if (!match.success) return match;
  const contract = match.contract;
  if (contractLifecycleStatus_(contract) !== 'draft') {
    return contractLifecycleFailure_(
      'CONTRACT_ACTIVATION_INVALID',
      '只有草稿租約可啟用'
    );
  }

  const conflicts = contractLifecycleRows_(match.sheet).filter(function (row) {
    if (contractLifecycleText_(row.contract_id) === contractLifecycleText_(contract.contract_id)) {
      return false;
    }
    if (contractLifecycleText_(row.workspace_id) !== contractLifecycleText_(contract.workspace_id)) {
      return false;
    }
    const status = contractLifecycleStatus_(row);
    if (status !== 'active' && status !== 'expiring') return false;
    const sameTenant = contractLifecycleText_(row.tenant_id) ===
      contractLifecycleText_(contract.tenant_id);
    const sameRoom = contractLifecycleText_(row.room_id) ===
      contractLifecycleText_(contract.room_id);
    return (sameTenant || sameRoom) && contractLifecycleOverlaps_(row, contract);
  });
  if (conflicts.length > 0) {
    return contractLifecycleFailure_(
      'ACTIVE_CONTRACT_CONFLICT',
      '同一房客或房間已有日期重疊的有效租約'
    );
  }

  const now = new Date();
  const updates = {
    contract_status: 'active',
    activated_at: now,
    updated_at: now,
    updated_by: contractLifecycleText_(access.user && access.user.user_id)
  };
  contractLifecycleUpdateColumns_(match.sheet, contract.__row_number, updates);
  Object.keys(updates).forEach(function (key) { contract[key] = updates[key]; });

  return {
    success: true,
    code: 'OK',
    message: '租約已啟用',
    data: { contract: contractLifecyclePublic_(contract) }
  };
}


function updateLandlordContractStatusByLineUid_(
  lineUserId,
  contractId,
  nextStatus,
  note
) {
  const access = contractLifecycleAccess_(lineUserId);
  if (!access.success) return access;
  const match = contractLifecycleFindForWorkspace_(
    contractId,
    access.workspace.workspace_id
  );
  if (!match.success) return match;

  const contract = match.contract;
  const currentStatus = contractLifecycleStatus_(contract);
  nextStatus = contractLifecycleText_(nextStatus).toLowerCase();
  if (currentStatus === nextStatus) {
    return {
      success: true,
      code: 'NO_CHANGE',
      data: { contract: contractLifecyclePublic_(contract) }
    };
  }
  if ((V2_CONTRACT_STATUS_TRANSITIONS_[currentStatus] || []).indexOf(nextStatus) === -1) {
    return contractLifecycleFailure_(
      'INVALID_CONTRACT_STATUS_TRANSITION',
      '不允許從 ' + currentStatus + ' 變更為 ' + nextStatus
    );
  }

  const now = new Date();
  const updates = {
    contract_status: nextStatus,
    note: contractLifecycleText_(note) || contractLifecycleText_(contract.note),
    updated_at: now,
    updated_by: contractLifecycleText_(access.user && access.user.user_id)
  };
  if (nextStatus === 'ended') updates.ended_at = now;
  if (nextStatus === 'terminated') updates.terminated_at = now;
  if (nextStatus === 'cancelled') updates.cancelled_at = now;
  contractLifecycleUpdateColumns_(match.sheet, contract.__row_number, updates);
  Object.keys(updates).forEach(function (key) { contract[key] = updates[key]; });

  return {
    success: true,
    code: 'OK',
    message: '租約狀態已更新',
    data: { contract: contractLifecyclePublic_(contract) }
  };
}


function deleteLandlordContractByLineUid_(lineUserId, contractId) {
  const access = contractLifecycleAccess_(lineUserId);
  if (!access.success) return access;
  const match = contractLifecycleFindForWorkspace_(
    contractId,
    access.workspace.workspace_id
  );
  if (!match.success) return match;

  const status = contractLifecycleStatus_(match.contract);
  if (status !== 'draft' && status !== 'cancelled') {
    return contractLifecycleFailure_(
      'CONTRACT_DELETE_INVALID',
      '只有草稿或已取消租約可移除'
    );
  }

  const now = new Date();
  contractLifecycleUpdateColumns_(match.sheet, match.contract.__row_number, {
    contract_status: 'deleted',
    deleted_at: now,
    updated_at: now,
    updated_by: contractLifecycleText_(access.user && access.user.user_id)
  });

  return {
    success: true,
    code: 'OK',
    message: '租約草稿已移除',
    data: { contract_id: contractLifecycleText_(contractId), deleted: true }
  };
}


function processContractExpiryNotifications() {
  contractLifecycleAssertEnabled_();
  const sheet = contractLifecycleSheet_();
  const now = new Date();
  const today = contractLifecycleDateText_(now);
  const reminderDays = contractLifecycleExpiryDays_();
  const horizon = new Date(now.getTime() + reminderDays * 86400000);
  const horizonText = contractLifecycleDateText_(horizon);

  const results = contractLifecycleRows_(sheet).filter(function (row) {
    const status = contractLifecycleStatus_(row);
    const endDate = contractLifecycleDateText_(row.end_date);
    return (status === 'active' || status === 'expiring') &&
      endDate >= today && endDate <= horizonText &&
      !contractLifecycleText_(row.expiry_notification_queue_id);
  }).map(function (contract) {
    const queued = contractLifecycleEnqueueExpiry_(contract);
    if (queued.success && queued.data) {
      const updates = {
        contract_status: 'expiring',
        expiry_notification_queue_id: queued.data.queue_id || '',
        expiry_notified_at: new Date(),
        updated_at: new Date(),
        updated_by: 'system:contract_expiry_worker'
      };
      contractLifecycleUpdateColumns_(sheet, contract.__row_number, updates);
    }
    return {
      contract_id: contractLifecycleText_(contract.contract_id),
      success: queued.success === true,
      queue_id: queued.data && queued.data.queue_id || '',
      code: queued.code || ''
    };
  });

  return {
    success: results.every(function (item) { return item.success; }),
    reminder_days: reminderDays,
    processed_count: results.length,
    queued_count: results.filter(function (item) { return item.success; }).length,
    results: results
  };
}


function contractLifecycleEnqueueExpiry_(contract) {
  if (typeof notificationQueueEnqueue_ !== 'function') {
    return contractLifecycleFailure_(
      'NOTIFICATION_QUEUE_UNAVAILABLE',
      'Notification queue is unavailable'
    );
  }
  return notificationQueueEnqueue_({
    receiver: {
      receiver_type: 'tenant',
      receiver_id: contractLifecycleText_(contract.tenant_id),
      workspace_id: contractLifecycleText_(contract.workspace_id)
    },
    event_type: 'contract_expiring',
    event_id: 'contract:' + contractLifecycleText_(contract.contract_id) +
      ':expiring:' + contractLifecycleDateText_(contract.end_date),
    actor_type: 'system',
    actor_id: 'contract_expiry_worker',
    resource_type: 'contract',
    resource_id: contractLifecycleText_(contract.contract_id),
    template_key: 'contract_expiring',
    variables: {
      tenant_name: contractLifecycleTenantName_(contract),
      end_date: contractLifecycleDateText_(contract.end_date)
    },
    source: 'contract_lifecycle',
    reference_id: contractLifecycleText_(contract.contract_id) + ':' +
      contractLifecycleDateText_(contract.end_date),
    metadata: {
      contract_id: contractLifecycleText_(contract.contract_id),
      tenant_id: contractLifecycleText_(contract.tenant_id),
      room_id: contractLifecycleText_(contract.room_id)
    }
  });
}


function contractLifecycleAccess_(lineUserId) {
  const access = workspaceLandlordResolveCanonicalScopedAccess_(
    contractLifecycleText_(lineUserId),
    { require_onboarding: false }
  );
  if (!access || access.success !== true) {
    return contractLifecycleFailure_(
      access && access.code || 'LANDLORD_ACCESS_DENIED',
      access && access.message || '無法確認房東權限'
    );
  }
  return access;
}


function contractLifecycleResolveRelation_(workspaceId, tenantId, propertyId, roomId) {
  const ss = runtimeSpreadsheet_();
  const specs = [
    { sheet: 'V2_tenants', id: 'tenant_id', value: tenantId },
    { sheet: 'V2_properties', id: 'property_id', value: propertyId },
    { sheet: 'V2_rooms', id: 'room_id', value: roomId }
  ];
  const resolved = {};

  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const sheet = ss.getSheetByName(spec.sheet);
    if (!sheet) {
      return contractLifecycleFailure_('CONTRACT_RELATION_SHEET_MISSING', spec.sheet + ' 不存在');
    }
    const matches = workspaceGetObjectsWithRow_(sheet).filter(function (row) {
      return contractLifecycleText_(row[spec.id]) === spec.value &&
        contractLifecycleText_(row.workspace_id) === workspaceId;
    });
    if (matches.length !== 1) {
      return contractLifecycleFailure_(
        matches.length > 1 ? 'CONTRACT_RELATION_CONFLICT' : 'CONTRACT_RELATION_NOT_FOUND',
        spec.sheet + ' 關聯資料不唯一或不存在'
      );
    }
    resolved[spec.sheet] = matches[0];
  }

  const room = resolved.V2_rooms;
  if (contractLifecycleText_(room.property_id) !== propertyId) {
    return contractLifecycleFailure_(
      'ROOM_PROPERTY_MISMATCH',
      'room 不屬於指定 property'
    );
  }

  return {
    success: true,
    tenant_user_id: contractLifecycleText_(
      resolved.V2_tenants.tenant_user_id || resolved.V2_tenants.user_id
    ),
    landlord_id: contractLifecycleText_(
      resolved.V2_tenants.landlord_id || resolved.V2_properties.landlord_id
    )
  };
}


function contractLifecycleFindForWorkspace_(contractId, workspaceId) {
  const sheet = contractLifecycleSheet_();
  const matches = contractLifecycleRows_(sheet).filter(function (row) {
    return contractLifecycleText_(row.contract_id) === contractLifecycleText_(contractId) &&
      contractLifecycleText_(row.workspace_id) === contractLifecycleText_(workspaceId) &&
      contractLifecycleStatus_(row) !== 'deleted';
  });
  if (matches.length !== 1) {
    return contractLifecycleFailure_(
      matches.length > 1 ? 'CONTRACT_CONFLICT' : 'CONTRACT_NOT_FOUND',
      matches.length > 1 ? '租約資料重複，已停止操作' : '找不到指定租約'
    );
  }
  return { success: true, sheet: sheet, contract: matches[0] };
}


function contractLifecycleSheet_() {
  const sheet = runtimeSpreadsheet_().getSheetByName(V2_CONTRACTS_SHEET_);
  if (!sheet) {
    const error = new Error('Contract sheet is not configured');
    error.code = 'CONTRACT_SHEET_NOT_CONFIGURED';
    throw error;
  }
  return sheet;
}


function contractLifecycleEnsureHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  const existing = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(contractLifecycleText_)
    : [];
  const missing = V2_CONTRACTS_REQUIRED_HEADERS_.filter(function (header) {
    return existing.indexOf(header) === -1;
  });
  if (existing.length === 0) {
    sheet.getRange(1, 1, 1, V2_CONTRACTS_REQUIRED_HEADERS_.length)
      .setValues([V2_CONTRACTS_REQUIRED_HEADERS_]);
  } else if (missing.length > 0) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
}


function contractLifecycleRows_(sheet) {
  return workspaceGetObjectsWithRow_(sheet);
}


function contractLifecycleUpdateColumns_(sheet, rowNumber, updates) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(contractLifecycleText_);
  Object.keys(updates).forEach(function (key) {
    const column = headers.indexOf(key);
    if (column >= 0) sheet.getRange(rowNumber, column + 1).setValue(updates[key]);
  });
}


function contractLifecycleStatus_(contract) {
  return contractLifecycleText_(
    contract.contract_status || contract.status || 'draft'
  ).toLowerCase();
}


function contractLifecycleOverlaps_(left, right) {
  const leftStart = contractLifecycleDateText_(left.start_date);
  const leftEnd = contractLifecycleDateText_(left.end_date);
  const rightStart = contractLifecycleDateText_(right.start_date);
  const rightEnd = contractLifecycleDateText_(right.end_date);
  return Boolean(leftStart && leftEnd && rightStart && rightEnd) &&
    leftStart <= rightEnd && rightStart <= leftEnd;
}


function contractLifecycleTenantName_(contract) {
  const sheet = runtimeSpreadsheet_().getSheetByName('V2_tenants');
  if (!sheet) return contractLifecycleText_(contract.tenant_id);
  const matches = workspaceGetObjectsWithRow_(sheet).filter(function (row) {
    return contractLifecycleText_(row.tenant_id) === contractLifecycleText_(contract.tenant_id) &&
      contractLifecycleText_(row.workspace_id) === contractLifecycleText_(contract.workspace_id);
  });
  return matches.length === 1
    ? contractLifecycleText_(matches[0].tenant_name || matches[0].tenant_id)
    : contractLifecycleText_(contract.tenant_id);
}


function contractLifecycleExpiryDays_() {
  const raw = PropertiesService.getScriptProperties().getProperty(
    'CONTRACT_EXPIRY_REMINDER_DAYS'
  );
  const value = Number(raw || 30);
  return isFinite(value) ? Math.max(1, Math.min(value, 180)) : 30;
}


function contractLifecyclePublic_(contract) {
  return {
    contract_id: contractLifecycleText_(contract.contract_id),
    workspace_id: contractLifecycleText_(contract.workspace_id),
    landlord_id: contractLifecycleText_(contract.landlord_id),
    tenant_id: contractLifecycleText_(contract.tenant_id),
    property_id: contractLifecycleText_(contract.property_id),
    room_id: contractLifecycleText_(contract.room_id),
    contract_status: contractLifecycleStatus_(contract),
    start_date: contractLifecycleDateText_(contract.start_date),
    end_date: contractLifecycleDateText_(contract.end_date),
    monthly_rent: Number(contract.monthly_rent) || 0,
    deposit_amount: Number(contract.deposit_amount) || 0,
    payment_due_day: Number(contract.payment_due_day) || 1,
    terms: contractLifecycleText_(contract.terms),
    note: contractLifecycleText_(contract.note),
    created_at: contractLifecycleJsonValue_(contract.created_at),
    updated_at: contractLifecycleJsonValue_(contract.updated_at),
    activated_at: contractLifecycleJsonValue_(contract.activated_at),
    ended_at: contractLifecycleJsonValue_(contract.ended_at),
    terminated_at: contractLifecycleJsonValue_(contract.terminated_at),
    cancelled_at: contractLifecycleJsonValue_(contract.cancelled_at),
    renewed_from_contract_id: contractLifecycleText_(contract.renewed_from_contract_id)
  };
}


function contractLifecycleDateText_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const text = contractLifecycleText_(value);
  const match = text.match(/^(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})/);
  if (!match) return '';
  return match[1] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[3]).slice(-2);
}


function contractLifecycleJsonValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    );
  }
  return value || '';
}


function contractLifecycleMakeId_() {
  return 'CTR-' + Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMddHHmmss'
  ) + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}


function contractLifecycleAssertEnabled_() {
  runtimeEnvironment_();
  runtimeRequireFeature_('LEASE_LIFECYCLE');
}


function contractLifecycleFailure_(code, message) {
  return { success: false, code: code, message: message };
}


function contractLifecycleText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}
