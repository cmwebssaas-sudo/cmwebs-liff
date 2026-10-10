/**
 * CMWebs V2 move-out request workflow (Phase 94 staging only).
 * Notifications are enqueued through Phase 90 and never delivered directly.
 */

const V2_MOVE_OUT_REQUESTS_SHEET_ = 'V2_MOVE_OUT_REQUESTS';

const V2_MOVE_OUT_REQUEST_HEADERS_ = [
  'request_id',
  'created_at',
  'updated_at',
  'workspace_id',
  'landlord_id',
  'tenant_id',
  'tenant_user_id',
  'tenant_name',
  'contract_id',
  'property_id',
  'room_id',
  'room_no',
  'requested_move_out_date',
  'reason',
  'forwarding_address',
  'status',
  'inspection_scheduled_at',
  'inspection_completed_at',
  'inspection_note',
  'settlement_id',
  'created_by',
  'updated_by',
  'move_out_requested_queue_id',
  'inspection_scheduled_queue_id',
  'deposit_settlement_ready_queue_id',
  'deposit_refunded_queue_id',
  'contract_terminated_queue_id'
];

const V2_MOVE_OUT_STATUS_TRANSITIONS_ = {
  requested: ['inspection_scheduled', 'cancelled'],
  inspection_scheduled: ['inspected', 'cancelled'],
  inspected: ['settlement_ready'],
  settlement_ready: ['refunded'],
  refunded: ['completed'],
  completed: [],
  cancelled: []
};


function migrateStagingMoveOutSettlement() {
  runtimeRequireSchemaMigration_();
  moveOutAssertEnabled_();
  const ss = runtimeSpreadsheet_();
  const requestSheet = moveOutEnsureSheet_(
    ss,
    V2_MOVE_OUT_REQUESTS_SHEET_,
    V2_MOVE_OUT_REQUEST_HEADERS_
  );
  const settlementSheet = moveOutEnsureSheet_(
    ss,
    V2_DEPOSIT_SETTLEMENTS_SHEET_,
    V2_DEPOSIT_SETTLEMENT_HEADERS_
  );
  const ledgerValidation = migrateSettlementLedgerSchema();
  const ledgerSheet = runtimeSpreadsheet_().getSheetByName(
    V2_SETTLEMENT_LEDGER_SHEET_
  );
  const repairSheet = ss.getSheetByName('V2_REPAIR_TICKETS');
  if (!repairSheet) throw new Error('V2_REPAIR_TICKETS_NOT_CONFIGURED');
  moveOutEnsureHeaders_(repairSheet, [
    'settlement_chargeable',
    'settlement_cost',
    'settlement_note',
    'deposit_settlement_id'
  ]);

  return {
    success: true,
    environment: 'staging',
    move_out_sheet: requestSheet.getName(),
    settlement_sheet: settlementSheet.getName(),
    settlement_ledger_sheet: ledgerSheet.getName(),
    request_header_count: V2_MOVE_OUT_REQUEST_HEADERS_.length,
    settlement_header_count: V2_DEPOSIT_SETTLEMENT_HEADERS_.length,
    settlement_ledger_header_count: V2_SETTLEMENT_LEDGER_HEADERS_.length,
    settlement_ledger_validation: ledgerValidation,
    repair_settlement_headers: 4
  };
}


function getTenantMoveOutRequestsByLineUid_(lineUserId) {
  const resolved = resolveCanonicalTenantRuntimeByLineUid_(moveOutText_(lineUserId));
  if (!resolved || resolved.success !== true || !resolved.data) {
    return moveOutFailure_(
      resolved && resolved.code || 'TENANT_NOT_FOUND',
      resolved && resolved.message || '查無房客資料'
    );
  }
  const canonical = resolved.data;
  const requests = moveOutRows_(moveOutRequestSheet_()).filter(function (row) {
    return moveOutText_(row.workspace_id) === moveOutText_(canonical.workspace_id) &&
      moveOutText_(row.tenant_id) === moveOutText_(canonical.tenant_id);
  }).map(moveOutPublicRequest_);
  const settlements = moveOutRows_(depositSettlementSheet_()).filter(function (row) {
    return moveOutText_(row.workspace_id) === moveOutText_(canonical.workspace_id) &&
      moveOutText_(row.tenant_id) === moveOutText_(canonical.tenant_id);
  }).map(depositSettlementPublic_);

  return {
    success: true,
    code: 'OK',
    data: {
      tenant_id: moveOutText_(canonical.tenant_id),
      requests: requests,
      settlements: settlements
    }
  };
}


function createTenantMoveOutRequestByLineUid_(
  lineUserId,
  requestedMoveOutDate,
  reason,
  forwardingAddress
) {
  moveOutAssertEnabled_();
  const resolved = resolveCanonicalTenantRuntimeByLineUid_(moveOutText_(lineUserId));
  if (!resolved || resolved.success !== true || !resolved.data) {
    return moveOutFailure_(
      resolved && resolved.code || 'TENANT_NOT_FOUND',
      resolved && resolved.message || '查無房客資料'
    );
  }
  const canonical = resolved.data;
  const recipient = tenantMessageResolveLandlordRecipient_(
    canonical,
    canonical.landlord_tenant_link_row || {}
  );
  if (!recipient || !recipient.workspace_id || !recipient.landlord_id) {
    return moveOutFailure_('MOVE_OUT_LANDLORD_REQUIRED', '找不到退租申請所屬管理團隊');
  }
  if (moveOutText_(recipient.workspace_id) !== moveOutText_(canonical.workspace_id)) {
    return moveOutFailure_('MOVE_OUT_WORKSPACE_CONFLICT', '房客與房東 Workspace 不一致');
  }

  const contract = moveOutFindContract_(canonical.contract_id, canonical.workspace_id);
  if (!contract.success) return contract;
  const contractStatus = moveOutText_(
    contract.data.contract_status || contract.data.status
  ).toLowerCase();
  if (contractStatus !== 'active' && contractStatus !== 'expiring') {
    return moveOutFailure_('MOVE_OUT_CONTRACT_NOT_ACTIVE', '只有有效租約可申請退租');
  }
  requestedMoveOutDate = moveOutDate_(requestedMoveOutDate);
  if (!requestedMoveOutDate) {
    return moveOutFailure_('MOVE_OUT_DATE_INVALID', '預計退租日期格式錯誤');
  }

  const sheet = moveOutRequestSheet_();
  const open = moveOutRows_(sheet).filter(function (row) {
    const status = moveOutText_(row.status).toLowerCase();
    return moveOutText_(row.workspace_id) === moveOutText_(canonical.workspace_id) &&
      moveOutText_(row.contract_id) === moveOutText_(canonical.contract_id) &&
      status !== 'completed' && status !== 'cancelled';
  });
  if (open.length > 1) {
    return moveOutFailure_('MOVE_OUT_REQUEST_CONFLICT', '租約存在多筆未完成退租申請');
  }
  if (open.length === 1) {
    return {
      success: true,
      code: 'MOVE_OUT_REQUEST_ALREADY_EXISTS',
      duplicate: true,
      data: { request: moveOutPublicRequest_(open[0]) }
    };
  }

  const now = new Date();
  const request = {
    request_id: moveOutMakeId_('MOR'),
    created_at: now,
    updated_at: now,
    workspace_id: moveOutText_(canonical.workspace_id),
    landlord_id: moveOutText_(recipient.landlord_id),
    tenant_id: moveOutText_(canonical.tenant_id),
    tenant_user_id: moveOutText_(canonical.tenant_user_id),
    tenant_name: moveOutText_(canonical.tenant_name || canonical.tenant_id),
    contract_id: moveOutText_(canonical.contract_id),
    property_id: moveOutText_(canonical.property_id),
    room_id: moveOutText_(canonical.room_id),
    room_no: moveOutText_(canonical.room_no || canonical.room_name),
    requested_move_out_date: requestedMoveOutDate,
    reason: moveOutText_(reason),
    forwarding_address: moveOutText_(forwardingAddress),
    status: 'requested',
    inspection_scheduled_at: '',
    inspection_completed_at: '',
    inspection_note: '',
    settlement_id: '',
    created_by: moveOutText_(canonical.tenant_user_id || canonical.tenant_id),
    updated_by: moveOutText_(canonical.tenant_user_id || canonical.tenant_id),
    move_out_requested_queue_id: '',
    inspection_scheduled_queue_id: '',
    deposit_settlement_ready_queue_id: '',
    deposit_refunded_queue_id: '',
    contract_terminated_queue_id: ''
  };
  workspaceAppendObject_(sheet, request);
  const stored = moveOutRows_(sheet).filter(function (row) {
    return moveOutText_(row.request_id) === request.request_id;
  })[0] || request;
  const queued = moveOutEnqueue_({
    receiver_type: 'landlord',
    receiver_id: request.landlord_id,
    workspace_id: request.workspace_id,
    line_user_id: moveOutText_(recipient.landlord_line_user_id),
    event_type: 'move_out_requested',
    request: request,
    variables: {
      tenant_name: request.tenant_name,
      room_name: request.room_no || request.room_id,
      move_out_date: requestedMoveOutDate
    }
  });
  if (queued.success && queued.data && queued.data.queue_id && stored.__row_number) {
    moveOutUpdate_(sheet, stored.__row_number, {
      move_out_requested_queue_id: queued.data.queue_id,
      updated_at: new Date()
    });
    stored.move_out_requested_queue_id = queued.data.queue_id;
  }

  return {
    success: true,
    code: 'OK',
    message: '退租申請已建立',
    data: {
      request: moveOutPublicRequest_(stored),
      notification: moveOutQueueSummary_(queued)
    }
  };
}


function getLandlordMoveOutRequestsByLineUid_(lineUserId, status) {
  const access = moveOutLandlordAccess_(lineUserId);
  if (!access.success) return access;
  const workspaceId = moveOutText_(access.workspace.workspace_id);
  const filter = moveOutText_(status).toLowerCase();
  const requests = moveOutRows_(moveOutRequestSheet_()).filter(function (row) {
    return moveOutText_(row.workspace_id) === workspaceId &&
      (!filter || moveOutText_(row.status).toLowerCase() === filter);
  }).map(moveOutPublicRequest_);
  const settlements = moveOutRows_(depositSettlementSheet_()).filter(function (row) {
    return moveOutText_(row.workspace_id) === workspaceId;
  }).map(depositSettlementPublic_);
  return {
    success: true,
    code: 'OK',
    data: {
      workspace_id: workspaceId,
      requests: requests,
      settlements: settlements
    }
  };
}


function scheduleLandlordMoveOutInspectionByLineUid_(
  lineUserId,
  requestId,
  scheduledAt,
  note
) {
  moveOutAssertEnabled_();
  const access = moveOutLandlordAccess_(lineUserId);
  if (!access.success) return access;
  const match = moveOutFindRequest_(requestId, access.workspace.workspace_id);
  if (!match.success) return match;
  const request = match.data;
  const current = moveOutText_(request.status).toLowerCase();
  if (current === 'inspection_scheduled' && moveOutText_(request.inspection_scheduled_at)) {
    return {
      success: true,
      code: 'NO_CHANGE',
      data: { request: moveOutPublicRequest_(request) }
    };
  }
  if ((V2_MOVE_OUT_STATUS_TRANSITIONS_[current] || []).indexOf('inspection_scheduled') < 0) {
    return moveOutFailure_('MOVE_OUT_STATUS_INVALID', '目前狀態不可安排驗屋');
  }
  const inspectionAt = moveOutDateTime_(scheduledAt);
  if (!inspectionAt) {
    return moveOutFailure_('INSPECTION_TIME_INVALID', '驗屋時間格式錯誤');
  }
  const updates = {
    status: 'inspection_scheduled',
    inspection_scheduled_at: inspectionAt,
    inspection_note: moveOutText_(note),
    updated_at: new Date(),
    updated_by: moveOutText_(access.user && access.user.user_id)
  };
  moveOutUpdate_(match.sheet, request.__row_number, updates);
  Object.keys(updates).forEach(function (key) { request[key] = updates[key]; });
  const queued = moveOutEnqueue_({
    receiver_type: 'tenant',
    receiver_id: request.tenant_id,
    workspace_id: request.workspace_id,
    event_type: 'inspection_scheduled',
    request: request,
    variables: {
      tenant_name: request.tenant_name || request.tenant_id,
      inspection_at: moveOutDateTime_(inspectionAt)
    }
  });
  if (queued.success && queued.data && queued.data.queue_id) {
    moveOutUpdate_(match.sheet, request.__row_number, {
      inspection_scheduled_queue_id: queued.data.queue_id,
      updated_at: new Date()
    });
    request.inspection_scheduled_queue_id = queued.data.queue_id;
  }
  return {
    success: true,
    code: 'OK',
    message: '驗屋時間已安排',
    data: {
      request: moveOutPublicRequest_(request),
      notification: moveOutQueueSummary_(queued)
    }
  };
}


function moveOutFindRequest_(requestId, workspaceId) {
  const sheet = moveOutRequestSheet_();
  const matches = moveOutRows_(sheet).filter(function (row) {
    return moveOutText_(row.request_id) === moveOutText_(requestId) &&
      moveOutText_(row.workspace_id) === moveOutText_(workspaceId);
  });
  if (matches.length !== 1) {
    return moveOutFailure_(
      matches.length > 1 ? 'MOVE_OUT_REQUEST_CONFLICT' : 'MOVE_OUT_REQUEST_NOT_FOUND',
      matches.length > 1 ? '退租申請重複，已停止操作' : '找不到退租申請'
    );
  }
  return { success: true, sheet: sheet, data: matches[0] };
}


function moveOutFindContract_(contractId, workspaceId) {
  const sheet = runtimeSpreadsheet_().getSheetByName('V2_contracts');
  if (!sheet) return moveOutFailure_('CONTRACT_SHEET_NOT_CONFIGURED', '找不到租約資料表');
  const matches = moveOutRows_(sheet).filter(function (row) {
    return moveOutText_(row.contract_id) === moveOutText_(contractId) &&
      moveOutText_(row.workspace_id) === moveOutText_(workspaceId);
  });
  if (matches.length !== 1) {
    return moveOutFailure_(
      matches.length > 1 ? 'CONTRACT_CONFLICT' : 'CONTRACT_NOT_FOUND',
      matches.length > 1 ? '租約資料重複，已停止操作' : '找不到租約'
    );
  }
  return { success: true, sheet: sheet, data: matches[0] };
}


function moveOutEnqueue_(options) {
  if (typeof notificationQueueEnqueue_ !== 'function') {
    return moveOutFailure_('NOTIFICATION_QUEUE_UNAVAILABLE', 'Notification queue is unavailable');
  }
  return notificationQueueEnqueue_({
    receiver: {
      receiver_type: options.receiver_type,
      receiver_id: options.receiver_id,
      workspace_id: options.workspace_id,
      line_user_id: options.line_user_id || ''
    },
    event_type: options.event_type,
    template_key: options.event_type,
    variables: options.variables || {},
    source: 'move_out_deposit_workflow',
    reference_id: moveOutText_(options.request.request_id) + ':' + options.event_type,
    metadata: {
      request_id: moveOutText_(options.request.request_id),
      contract_id: moveOutText_(options.request.contract_id),
      tenant_id: moveOutText_(options.request.tenant_id),
      settlement_id: moveOutText_(options.request.settlement_id)
    }
  });
}


function moveOutLandlordAccess_(lineUserId) {
  const access = workspaceLandlordResolveAccess_(
    moveOutText_(lineUserId),
    { require_onboarding: false }
  );
  if (!access || access.success !== true) {
    return moveOutFailure_(
      access && access.code || 'LANDLORD_ACCESS_DENIED',
      access && access.message || '無法確認房東權限'
    );
  }
  return access;
}


function moveOutRequestSheet_() {
  const sheet = runtimeSpreadsheet_().getSheetByName(V2_MOVE_OUT_REQUESTS_SHEET_);
  if (!sheet) throw new Error('MOVE_OUT_REQUEST_SHEET_NOT_CONFIGURED');
  return sheet;
}


function moveOutEnsureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  moveOutEnsureHeaders_(sheet, headers);
  return sheet;
}


function moveOutEnsureHeaders_(sheet, headers) {
  const existing = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(moveOutText_)
    : [];
  const missing = headers.filter(function (header) { return existing.indexOf(header) < 0; });
  if (existing.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (missing.length > 0) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
}


function moveOutRows_(sheet) {
  return workspaceGetObjectsWithRow_(sheet);
}


function moveOutUpdate_(sheet, rowNumber, updates) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(moveOutText_);
  Object.keys(updates).forEach(function (key) {
    const column = headers.indexOf(key);
    if (column >= 0) sheet.getRange(rowNumber, column + 1).setValue(updates[key]);
  });
}


function moveOutPublicRequest_(request) {
  return {
    request_id: moveOutText_(request.request_id),
    workspace_id: moveOutText_(request.workspace_id),
    landlord_id: moveOutText_(request.landlord_id),
    tenant_id: moveOutText_(request.tenant_id),
    tenant_name: moveOutText_(request.tenant_name),
    contract_id: moveOutText_(request.contract_id),
    property_id: moveOutText_(request.property_id),
    room_id: moveOutText_(request.room_id),
    room_no: moveOutText_(request.room_no),
    requested_move_out_date: moveOutDate_(request.requested_move_out_date),
    reason: moveOutText_(request.reason),
    forwarding_address: moveOutText_(request.forwarding_address),
    status: moveOutText_(request.status).toLowerCase(),
    inspection_scheduled_at: moveOutJsonValue_(request.inspection_scheduled_at),
    inspection_completed_at: moveOutJsonValue_(request.inspection_completed_at),
    inspection_note: moveOutText_(request.inspection_note),
    settlement_id: moveOutText_(request.settlement_id),
    created_at: moveOutJsonValue_(request.created_at),
    updated_at: moveOutJsonValue_(request.updated_at)
  };
}


function moveOutDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const match = moveOutText_(value).match(/^(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})/);
  return match
    ? match[1] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[3]).slice(-2)
    : '';
}


function moveOutDateTime_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return moveOutJsonValue_(value);
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : moveOutJsonValue_(date);
}


function moveOutJsonValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    );
  }
  return value || '';
}


function moveOutMakeId_(prefix) {
  return prefix + '-' + Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMddHHmmss'
  ) + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}


function moveOutQueueSummary_(queued) {
  return {
    success: queued && queued.success === true,
    code: queued && queued.code || '',
    queue_id: queued && queued.data && queued.data.queue_id || '',
    duplicate: queued && queued.duplicate === true
  };
}


function moveOutParseJsonArray_(value) {
  try {
    const parsed = JSON.parse(moveOutText_(value) || '[]');
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}


function moveOutAssertEnabled_() {
  runtimeEnvironment_();
  runtimeRequireFeature_('MOVE_OUT_SETTLEMENT');
}


function moveOutFailure_(code, message) {
  return { success: false, code: code, message: message };
}


function moveOutText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}
