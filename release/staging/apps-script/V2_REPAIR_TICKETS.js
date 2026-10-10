/**
 * CMWebs V2 repair ticket workflow (Phase 91 staging only).
 *
 * Business events enqueue notifications through Phase 90. This module never
 * calls LINE or UrlFetchApp directly.
 */

const V2_REPAIR_TICKETS_SHEET_ = 'V2_REPAIR_TICKETS';

const V2_REPAIR_TICKET_HEADERS_ = [
  'ticket_id',
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
  'source_message_id',
  'category',
  'priority',
  'title',
  'description',
  'preferred_contact_time',
  'status',
  'assigned_user_id',
  'landlord_note',
  'acknowledged_at',
  'started_at',
  'completed_at',
  'closed_at',
  'created_by',
  'updated_by',
  'landlord_notification_queue_id',
  'tenant_notification_queue_id'
];

const V2_REPAIR_STATUS_TRANSITIONS_ = {
  open: ['acknowledged', 'in_progress', 'closed'],
  acknowledged: ['in_progress', 'closed'],
  in_progress: ['completed', 'closed'],
  completed: ['closed'],
  closed: []
};


function migrateStagingRepairTickets() {
  runtimeRequireSchemaMigration_();
  runtimeRequireFeature_('REPAIR_WORKFLOW');

  const ss = runtimeSpreadsheet_();
  let sheet = ss.getSheetByName(V2_REPAIR_TICKETS_SHEET_);
  let created = false;

  if (!sheet) {
    sheet = ss.insertSheet(V2_REPAIR_TICKETS_SHEET_);
    created = true;
  }

  repairTicketEnsureHeaders_(sheet);

  return {
    success: true,
    environment: 'staging',
    sheet: V2_REPAIR_TICKETS_SHEET_,
    created: created,
    header_count: V2_REPAIR_TICKET_HEADERS_.length
  };
}


/**
 * Configure TEST_TENANT_LINE_UID from the existing isolated STG086 fixture.
 * The UID is never accepted from a caller and never returned unmasked.
 */
function migrateStagingRepairTestIdentity() {
  if (
    typeof runtimeEnvironment_ !== 'function' ||
    runtimeEnvironment_() !== 'staging'
  ) {
    throw new Error('STAGING_ONLY_REPAIR_IDENTITY_MIGRATION');
  }

  const tenants = runtimeSpreadsheet_().getSheetByName('V2_tenants');
  if (!tenants) throw new Error('STAGING_TENANTS_SHEET_NOT_FOUND');

  const matches = workspaceGetObjectsWithRow_(tenants).filter(function (row) {
    return repairTicketText_(row.tenant_id) === 'TSTG086';
  });
  if (matches.length !== 1) {
    throw new Error('STAGING_REPAIR_TEST_TENANT_NOT_UNIQUE');
  }

  const lineUserId = repairTicketText_(
    matches[0].line_user_id ||
    matches[0].line_uid ||
    matches[0].tenant_line_uid
  );
  if (!lineUserId) throw new Error('STAGING_REPAIR_TEST_UID_MISSING');

  PropertiesService.getScriptProperties().setProperty(
    'TEST_TENANT_LINE_UID',
    lineUserId
  );

  return {
    success: true,
    environment: 'staging',
    tenant_id: 'TSTG086',
    property_key: 'TEST_TENANT_LINE_UID',
    line_uid_masked: lineUserId.slice(0, 4) + '…' + lineUserId.slice(-4)
  };
}


/**
 * One-time staging-only end-to-end smoke test.
 *
 * It creates and closes one audit-preserved ticket, queues both notifications,
 * then lets the Phase 90 worker deliver them. No UID is accepted or returned.
 */
function runStagingRepairWorkflowSmokeTest() {
  if (
    typeof runtimeEnvironment_ !== 'function' ||
    runtimeEnvironment_() !== 'staging'
  ) {
    throw new Error('STAGING_ONLY_REPAIR_WORKFLOW_TEST');
  }

  const tenantLineUserId = repairTicketText_(
    PropertiesService.getScriptProperties().getProperty(
      'TEST_TENANT_LINE_UID'
    )
  );
  if (!tenantLineUserId) {
    throw new Error('TEST_TENANT_LINE_UID_NOT_CONFIGURED');
  }

  const canonicalResult = resolveCanonicalTenantRuntimeByLineUid_(
    tenantLineUserId
  );
  if (!canonicalResult || canonicalResult.success !== true) {
    return {
      success: false,
      stage: 'tenant_resolver',
      code: canonicalResult && canonicalResult.code || 'TENANT_NOT_FOUND'
    };
  }

  const canonical = canonicalResult.data;
  const recipient = tenantMessageResolveLandlordRecipient_(
    canonical,
    canonical.landlord_tenant_link_row || {}
  );
  const landlordLineUserId = repairTicketText_(
    recipient && recipient.landlord_line_user_id
  );
  if (!landlordLineUserId) {
    return {
      success: false,
      stage: 'landlord_recipient',
      code: 'LANDLORD_RECIPIENT_NOT_FOUND'
    };
  }

  const smokeTitle = '[Phase 91] staging repair workflow smoke test';
  const existing = repairTicketRows_(repairTicketSheet_()).filter(function (row) {
    return repairTicketText_(row.title) === smokeTitle &&
      repairTicketText_(row.tenant_id) === repairTicketText_(canonical.tenant_id) &&
      repairTicketText_(row.status) !== 'closed';
  });
  const created = existing.length === 1
    ? {
        success: true,
        code: 'REUSED_OPEN_SMOKE_TICKET',
        data: {
          ticket: repairTicketPublic_(existing[0]),
          notification: {
            success: Boolean(existing[0].landlord_notification_queue_id),
            data: {
              queue_id: existing[0].landlord_notification_queue_id || ''
            }
          }
        }
      }
    : createTenantRepairTicketByLineUid_(
        tenantLineUserId,
        smokeTitle,
        'Staging-only repair workflow validation. No production data.',
        'normal',
        '',
        ''
      );
  if (!created.success) {
    return { success: false, stage: 'create', result: created };
  }

  const ticketId = created.data.ticket.ticket_id;
  const inProgress = updateLandlordRepairTicketByLineUid_(
    landlordLineUserId,
    ticketId,
    'in_progress',
    'Phase 91 staging validation started'
  );
  if (!inProgress.success) {
    return { success: false, stage: 'in_progress', result: inProgress };
  }

  const completed = updateLandlordRepairTicketByLineUid_(
    landlordLineUserId,
    ticketId,
    'completed',
    'Phase 91 staging validation completed'
  );
  if (!completed.success) {
    return { success: false, stage: 'completed', result: completed };
  }

  const closed = updateLandlordRepairTicketByLineUid_(
    landlordLineUserId,
    ticketId,
    'closed',
    'Phase 91 staging validation closed'
  );
  if (!closed.success) {
    return { success: false, stage: 'closed', result: closed };
  }

  const worker = processNotificationQueue();
  const persisted = repairTicketRows_(repairTicketSheet_()).filter(function (row) {
    return repairTicketText_(row.ticket_id) === ticketId;
  });

  return {
    success: persisted.length === 1 &&
      repairTicketText_(persisted[0].status) === 'closed',
    environment: 'staging',
    ticket_id: ticketId,
    tenant_resolved: Boolean(canonical.tenant_id),
    landlord_recipient_resolved: true,
    workspace_isolated: repairTicketText_(canonical.workspace_id) ===
      repairTicketText_(recipient.workspace_id),
    created: created.success,
    in_progress: inProgress.success,
    completed: completed.success,
    closed: closed.success,
    landlord_notification_queued: Boolean(
      created.data.notification && created.data.notification.success
    ),
    tenant_notification_queued: Boolean(
      completed.data.notification && completed.data.notification.success
    ),
    worker_processed_count: Number(worker.processed_count) || 0,
    worker_sent_count: Number(worker.sent_count) || 0,
    worker_retrying_count: Number(worker.retrying_count) || 0,
    worker_failed_count: Number(worker.failed_count) || 0
  };
}


function createTenantRepairTicketByLineUid_(
  lineUserId,
  title,
  description,
  priority,
  contactTime,
  sourceMessageId
) {
  lineUserId = repairTicketText_(lineUserId);
  title = repairTicketText_(title);
  description = repairTicketText_(description);
  priority = repairTicketText_(priority).toLowerCase() === 'urgent'
    ? 'urgent'
    : 'normal';

  if (!lineUserId) {
    return repairTicketFailure_('MISSING_LINE_UID', '缺少 LINE UID');
  }
  if (!title || !description) {
    return repairTicketFailure_(
      'REPAIR_CONTENT_REQUIRED',
      '報修標題與內容不得為空白'
    );
  }

  const resolved = resolveCanonicalTenantRuntimeByLineUid_(lineUserId);
  if (!resolved || resolved.success !== true || !resolved.data) {
    return repairTicketFailure_(
      resolved && resolved.code ? resolved.code : 'TENANT_NOT_FOUND',
      resolved && resolved.message ? resolved.message : '查無房客資料'
    );
  }

  const canonical = resolved.data;
  const recipient = tenantMessageResolveLandlordRecipient_(
    canonical,
    canonical.landlord_tenant_link_row || {}
  );

  if (!recipient || !recipient.workspace_id || !recipient.landlord_id) {
    return repairTicketFailure_(
      'REPAIR_LANDLORD_CONTEXT_REQUIRED',
      '找不到報修所屬管理團隊'
    );
  }

  const now = new Date();
  const ticket = {
    ticket_id: repairTicketMakeId_(),
    created_at: now,
    updated_at: now,
    workspace_id: repairTicketText_(recipient.workspace_id),
    landlord_id: repairTicketText_(recipient.landlord_id),
    tenant_id: repairTicketText_(canonical.tenant_id),
    tenant_user_id: repairTicketText_(canonical.tenant_user_id),
    tenant_name: repairTicketText_(canonical.tenant_name || canonical.tenant_id),
    contract_id: repairTicketText_(canonical.contract_id),
    property_id: repairTicketText_(canonical.property_id),
    room_id: repairTicketText_(canonical.room_id),
    room_no: repairTicketText_(
      canonical.room_no || canonical.room_name || canonical.room_list
    ),
    source_message_id: repairTicketText_(sourceMessageId),
    category: 'repair',
    priority: priority,
    title: title,
    description: description,
    preferred_contact_time: repairTicketText_(contactTime),
    status: 'open',
    assigned_user_id: '',
    landlord_note: '',
    acknowledged_at: '',
    started_at: '',
    completed_at: '',
    closed_at: '',
    created_by: repairTicketText_(canonical.tenant_user_id || canonical.tenant_id),
    updated_by: repairTicketText_(canonical.tenant_user_id || canonical.tenant_id),
    landlord_notification_queue_id: '',
    tenant_notification_queue_id: ''
  };

  const sheet = repairTicketSheet_();
  workspaceAppendObject_(sheet, ticket);

  const notification = repairTicketEnqueueLandlordNotification_(ticket, recipient);
  if (notification.success && notification.data) {
    ticket.landlord_notification_queue_id = notification.data.queue_id || '';
    repairTicketUpdateColumns_(sheet, sheet.getLastRow(), {
      landlord_notification_queue_id: ticket.landlord_notification_queue_id,
      updated_at: new Date()
    });
  }

  return {
    success: true,
    code: 'OK',
    message: notification.success
      ? '報修已建立，房東通知已排入佇列'
      : '報修已建立，但房東通知排程失敗',
    data: {
      ticket: repairTicketPublic_(ticket),
      notification: notification
    }
  };
}


function getTenantRepairTicketsByLineUid_(lineUserId) {
  const resolved = resolveCanonicalTenantRuntimeByLineUid_(
    repairTicketText_(lineUserId)
  );
  if (!resolved || resolved.success !== true || !resolved.data) {
    return repairTicketFailure_(
      resolved && resolved.code ? resolved.code : 'TENANT_NOT_FOUND',
      resolved && resolved.message ? resolved.message : '查無房客資料'
    );
  }

  const canonical = resolved.data;
  const rows = repairTicketRows_(repairTicketSheet_()).filter(function (row) {
    return repairTicketText_(row.workspace_id) === repairTicketText_(canonical.workspace_id) &&
      repairTicketText_(row.tenant_id) === repairTicketText_(canonical.tenant_id);
  });

  return {
    success: true,
    code: 'OK',
    data: {
      tenant_id: repairTicketText_(canonical.tenant_id),
      tickets: rows.map(repairTicketPublic_)
    }
  };
}


function getLandlordRepairTicketsByLineUid_(lineUserId, status) {
  const access = workspaceLandlordResolveAccess_(
    repairTicketText_(lineUserId),
    { require_onboarding: false }
  );
  if (!access || access.success !== true) {
    return repairTicketFailure_(
      access && access.code ? access.code : 'LANDLORD_ACCESS_DENIED',
      access && access.message ? access.message : '無法確認房東權限'
    );
  }

  const workspaceId = repairTicketText_(access.workspace.workspace_id);
  const filterStatus = repairTicketText_(status).toLowerCase();
  const rows = repairTicketRows_(repairTicketSheet_()).filter(function (row) {
    if (repairTicketText_(row.workspace_id) !== workspaceId) return false;
    return !filterStatus || repairTicketText_(row.status).toLowerCase() === filterStatus;
  });

  return {
    success: true,
    code: 'OK',
    data: {
      workspace_id: workspaceId,
      tickets: rows.map(repairTicketPublic_)
    }
  };
}


function updateLandlordRepairTicketByLineUid_(
  lineUserId,
  ticketId,
  nextStatus,
  landlordNote
) {
  const access = workspaceLandlordResolveAccess_(
    repairTicketText_(lineUserId),
    { require_onboarding: false }
  );
  if (!access || access.success !== true) {
    return repairTicketFailure_(
      access && access.code ? access.code : 'LANDLORD_ACCESS_DENIED',
      access && access.message ? access.message : '無法確認房東權限'
    );
  }

  const workspaceId = repairTicketText_(access.workspace.workspace_id);
  ticketId = repairTicketText_(ticketId);
  nextStatus = repairTicketText_(nextStatus).toLowerCase();
  const sheet = repairTicketSheet_();
  const matches = repairTicketRows_(sheet).filter(function (row) {
    return repairTicketText_(row.ticket_id) === ticketId &&
      repairTicketText_(row.workspace_id) === workspaceId;
  });

  if (matches.length !== 1) {
    return repairTicketFailure_(
      matches.length > 1 ? 'REPAIR_TICKET_CONFLICT' : 'REPAIR_TICKET_NOT_FOUND',
      matches.length > 1 ? '報修資料重複，已停止更新' : '找不到指定報修'
    );
  }

  const ticket = matches[0];
  const currentStatus = repairTicketText_(ticket.status).toLowerCase();
  if (currentStatus === nextStatus) {
    return {
      success: true,
      code: 'NO_CHANGE',
      message: '報修狀態未變更',
      data: { ticket: repairTicketPublic_(ticket), notification: null }
    };
  }

  const allowed = V2_REPAIR_STATUS_TRANSITIONS_[currentStatus] || [];
  if (allowed.indexOf(nextStatus) === -1) {
    return repairTicketFailure_(
      'INVALID_REPAIR_STATUS_TRANSITION',
      '不允許從 ' + currentStatus + ' 變更為 ' + nextStatus
    );
  }

  const now = new Date();
  const updates = {
    status: nextStatus,
    landlord_note: repairTicketText_(landlordNote),
    assigned_user_id: repairTicketText_(access.user && access.user.user_id),
    updated_by: repairTicketText_(access.user && access.user.user_id),
    updated_at: now
  };
  if (nextStatus === 'acknowledged') updates.acknowledged_at = now;
  if (nextStatus === 'in_progress') updates.started_at = now;
  if (nextStatus === 'completed') updates.completed_at = now;
  if (nextStatus === 'closed') updates.closed_at = now;

  repairTicketUpdateColumns_(sheet, ticket.__row_number, updates);
  Object.keys(updates).forEach(function (key) {
    ticket[key] = updates[key];
  });

  let notification = null;
  if (
    nextStatus === 'completed' ||
    (nextStatus === 'closed' && currentStatus !== 'completed')
  ) {
    notification = repairTicketEnqueueTenantCompletion_(ticket, nextStatus);
    if (notification.success && notification.data) {
      ticket.tenant_notification_queue_id = notification.data.queue_id || '';
      repairTicketUpdateColumns_(sheet, ticket.__row_number, {
        tenant_notification_queue_id: ticket.tenant_notification_queue_id,
        updated_at: new Date()
      });
    }
  }

  return {
    success: true,
    code: 'OK',
    message: '報修狀態已更新',
    data: {
      ticket: repairTicketPublic_(ticket),
      notification: notification
    }
  };
}


function repairTicketEnqueueLandlordNotification_(ticket, recipient) {
  if (typeof notificationQueueEnqueue_ !== 'function') {
    return repairTicketFailure_(
      'NOTIFICATION_QUEUE_UNAVAILABLE',
      'Notification queue is unavailable'
    );
  }

  return notificationQueueEnqueue_({
    receiver: {
      receiver_type: 'landlord',
      receiver_id: ticket.landlord_id,
      workspace_id: ticket.workspace_id,
      line_user_id: repairTicketText_(recipient.landlord_line_user_id)
    },
    event_type: 'tenant_repair',
    event_id: 'repair:' + repairTicketText_(ticket.ticket_id) + ':created',
    actor_type: 'tenant',
    actor_id: repairTicketText_(ticket.tenant_id),
    resource_type: 'repair_ticket',
    resource_id: repairTicketText_(ticket.ticket_id),
    template_key: 'tenant_repair',
    variables: {
      tenant_name: repairTicketText_(
        recipient.tenant_name || ticket.tenant_id
      ),
      room_name: ticket.room_no || ticket.room_id,
      title: ticket.title,
      body: ticket.description
    },
    source: 'repair_ticket_workflow',
    reference_id: ticket.ticket_id,
    metadata: {
      ticket_id: ticket.ticket_id,
      tenant_id: ticket.tenant_id,
      contract_id: ticket.contract_id,
      room_id: ticket.room_id
    }
  });
}


function repairTicketEnqueueTenantCompletion_(ticket, nextStatus) {
  if (typeof notificationQueueEnqueue_ !== 'function') {
    return repairTicketFailure_(
      'NOTIFICATION_QUEUE_UNAVAILABLE',
      'Notification queue is unavailable'
    );
  }

  return notificationQueueEnqueue_({
    receiver: {
      receiver_type: 'tenant',
      receiver_id: ticket.tenant_id,
      workspace_id: ticket.workspace_id
    },
    event_type: 'repair_completed',
    event_id: 'repair:' + repairTicketText_(ticket.ticket_id) + ':' +
      repairTicketText_(nextStatus),
    actor_type: 'landlord',
    actor_id: repairTicketText_(ticket.landlord_id),
    resource_type: 'repair_ticket',
    resource_id: repairTicketText_(ticket.ticket_id),
    template_key: 'repair_completed',
    variables: {
      tenant_name: ticket.tenant_name || ticket.tenant_id,
      ticket_id: ticket.ticket_id,
      status_label: nextStatus === 'completed' ? '已完成' : '已關閉',
      title: ticket.title,
      landlord_note: repairTicketText_(ticket.landlord_note) || '無'
    },
    source: 'repair_ticket_workflow',
    reference_id: ticket.ticket_id + ':' + nextStatus,
    metadata: {
      ticket_id: ticket.ticket_id,
      tenant_id: ticket.tenant_id,
      status: nextStatus
    }
  });
}


function repairTicketSheet_() {
  const sheet = runtimeSpreadsheet_().getSheetByName(V2_REPAIR_TICKETS_SHEET_);
  if (!sheet) {
    const error = new Error('Repair ticket sheet is not configured');
    error.code = 'REPAIR_TICKET_SHEET_NOT_CONFIGURED';
    throw error;
  }
  repairTicketEnsureHeaders_(sheet);
  return sheet;
}


function repairTicketEnsureHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  const existing = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(repairTicketText_)
    : [];
  const missing = V2_REPAIR_TICKET_HEADERS_.filter(function (header) {
    return existing.indexOf(header) === -1;
  });
  if (existing.length === 0) {
    sheet.getRange(1, 1, 1, V2_REPAIR_TICKET_HEADERS_.length)
      .setValues([V2_REPAIR_TICKET_HEADERS_]);
  } else if (missing.length > 0) {
    sheet.getRange(1, existing.length + 1, 1, missing.length)
      .setValues([missing]);
  }
}


function repairTicketRows_(sheet) {
  return workspaceGetObjectsWithRow_(sheet);
}


function repairTicketUpdateColumns_(sheet, rowNumber, updates) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(repairTicketText_);
  Object.keys(updates).forEach(function (key) {
    const column = headers.indexOf(key);
    if (column >= 0) {
      sheet.getRange(rowNumber, column + 1).setValue(updates[key]);
    }
  });
}


function repairTicketPublic_(ticket) {
  return {
    ticket_id: repairTicketText_(ticket.ticket_id),
    created_at: repairTicketJsonValue_(ticket.created_at),
    updated_at: repairTicketJsonValue_(ticket.updated_at),
    workspace_id: repairTicketText_(ticket.workspace_id),
    tenant_id: repairTicketText_(ticket.tenant_id),
    contract_id: repairTicketText_(ticket.contract_id),
    property_id: repairTicketText_(ticket.property_id),
    room_id: repairTicketText_(ticket.room_id),
    room_no: repairTicketText_(ticket.room_no),
    category: repairTicketText_(ticket.category),
    priority: repairTicketText_(ticket.priority),
    title: repairTicketText_(ticket.title),
    description: repairTicketText_(ticket.description),
    preferred_contact_time: repairTicketText_(ticket.preferred_contact_time),
    status: repairTicketText_(ticket.status),
    landlord_note: repairTicketText_(ticket.landlord_note),
    acknowledged_at: repairTicketJsonValue_(ticket.acknowledged_at),
    started_at: repairTicketJsonValue_(ticket.started_at),
    completed_at: repairTicketJsonValue_(ticket.completed_at),
    closed_at: repairTicketJsonValue_(ticket.closed_at)
  };
}


function repairTicketJsonValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return value || '';
}


function repairTicketMakeId_() {
  return 'RPR-' + Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMddHHmmss'
  ) + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}


function repairTicketFailure_(code, message) {
  return { success: false, code: code, message: message };
}


function repairTicketText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}
