/**
 * CMWebs V2 unified notification transport service.
 *
 * Phase 88 staging boundary:
 * - owns LINE Messaging API transport and transport-level audit logs;
 * - supports deterministic tenant / landlord receiver resolution;
 * - does not replace workspace event orchestration or legacy LINE logs;
 * - never stores or returns LINE_CHANNEL_ACCESS_TOKEN.
 */

const V2_NOTIFICATION_SERVICE_SHEETS_ = {
  logs: 'V2_notification_logs',
  tenants: 'V2_tenants',
  landlords: 'V2_landlords',
  users: 'V2_users',
  workspaceMembers: 'V2_workspace_members'
};

const V2_NOTIFICATION_SERVICE_LOG_HEADERS_ = [
  'notification_log_id',
  'created_at',
  'channel',
  'receiver_type',
  'receiver_id',
  'workspace_id',
  'line_user_id',
  'source',
  'event_type',
  'reference_id',
  'message_type',
  'delivery_status',
  'success',
  'code',
  'http_status',
  'error_message',
  'provider_response',
  'metadata_json',
  'queue_id',
  'retry_count'
];


/**
 * Send one LINE text notification and write one transport-level audit row.
 *
 * options.receiver supports:
 * - receiver_type: tenant | landlord | direct
 * - receiver_id: tenant_id / landlord_id / caller-defined direct id
 * - workspace_id: optional isolation key
 * - line_user_id: optional pre-resolved UID
 */
function notificationSendLineText_(options) {
  if (
    typeof notificationQueueEnqueue_ !== 'function' ||
    typeof notificationQueueProcessById_ !== 'function'
  ) {
    return {
      success: false,
      code: 'NOTIFICATION_QUEUE_UNAVAILABLE',
      message: 'Notification queue is unavailable'
    };
  }

  const queued = notificationQueueEnqueue_(options || {});

  if (!queued.success) {
    return queued;
  }

  if (queued.duplicate === true) {
    const alreadySent = queued.data.status === 'sent';
    return {
      success: alreadySent,
      code: alreadySent
        ? 'NOTIFICATION_DUPLICATE'
        : 'NOTIFICATION_DUPLICATE_PENDING',
      message: alreadySent
        ? 'Notification event already sent'
        : 'Notification event already queued',
      data: {
        queue_id: queued.data.queue_id,
        queue_status: queued.data.status,
        retry_count: queued.data.retry_count,
        duplicate: true
      }
    };
  }

  return notificationQueueProcessById_(queued.data.queue_id, true);
}


/**
 * LINE transport invoked only by the notification queue worker.
 */
function notificationDeliverQueuedLine_(job) {
  job = job || {};

  let payload = {};
  try {
    payload = JSON.parse(notificationServiceText_(job.payload) || '{}');
  } catch (error) {
    payload = {};
  }

  const options = {
    receiver: {
      receiver_type: job.receiver_type,
      receiver_id: job.receiver_id,
      workspace_id: job.workspace_id
    },
    text: payload.text || '',
    source: payload.source || '',
    event_type: job.event_type,
    reference_id: job.reference_id,
    metadata: payload.metadata || {}
  };

  const createdAt = new Date();
  const logId = notificationServiceId_('NLG');
  const text = notificationServiceText_(options.text);
  const receiverRequest = options.receiver || {};
  let receiver;

  try {
    receiver = notificationResolveReceiver_(receiverRequest);
  } catch (error) {
    receiver = {
      success: false,
      code: error.code || 'NOTIFICATION_RECEIVER_ERROR',
      message: error.message || '通知收件人解析失敗',
      receiver_type: notificationServiceText_(
        receiverRequest.receiver_type
      ),
      receiver_id: notificationServiceText_(
        receiverRequest.receiver_id
      ),
      workspace_id: notificationServiceText_(
        receiverRequest.workspace_id
      ),
      line_user_id: ''
    };
  }

  const logRecord = {
    notification_log_id: logId,
    created_at: createdAt,
    channel: 'line',
    receiver_type: receiver.receiver_type || '',
    receiver_id: receiver.receiver_id || '',
    workspace_id: receiver.workspace_id || '',
    line_user_id: notificationMaskLineUserId_(receiver.line_user_id),
    source: notificationServiceText_(options.source),
    event_type: notificationServiceText_(options.event_type),
    reference_id: notificationServiceText_(options.reference_id),
    message_type: 'text',
    delivery_status: 'failed',
    success: false,
    code: '',
    http_status: '',
    error_message: '',
    provider_response: '',
    metadata_json: notificationSafeJson_(options.metadata || {}),
    queue_id: notificationServiceText_(job.id),
    retry_count: Number(job.retry_count) || 0
  };

  if (!receiver.success) {
    logRecord.code = receiver.code || 'NOTIFICATION_RECEIVER_NOT_FOUND';
    logRecord.error_message = receiver.message || '通知收件人不存在';
    return notificationFinalizeResult_(logRecord);
  }

  if (!text) {
    logRecord.code = 'NOTIFICATION_TEXT_REQUIRED';
    logRecord.error_message = '通知內容不得為空白';
    return notificationFinalizeResult_(logRecord);
  }

  const token = notificationLineAccessToken_();

  if (!token) {
    logRecord.code = 'LINE_TOKEN_NOT_SET';
    logRecord.error_message = '尚未設定 LINE_CHANNEL_ACCESS_TOKEN';
    return notificationFinalizeResult_(logRecord);
  }

  try {
    const response = UrlFetchApp.fetch(
      'https://api.line.me/v2/bot/message/push',
      {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: 'Bearer ' + token
        },
        payload: JSON.stringify({
          to: receiver.line_user_id,
          messages: [
            {
              type: 'text',
              text: text
            }
          ]
        }),
        muteHttpExceptions: true
      }
    );

    const statusCode = Number(response.getResponseCode()) || 0;
    const responseBody = notificationServiceText_(
      response.getContentText()
    ).slice(0, 1000);

    logRecord.http_status = statusCode;

    if (statusCode >= 200 && statusCode < 300) {
      // A successful LINE response can contain provider-generated delivery
      // metadata that is not required by the notification audit log.
      logRecord.provider_response = '';
      logRecord.delivery_status = 'sent';
      logRecord.success = true;
      logRecord.code = 'OK';
      return notificationFinalizeResult_(logRecord);
    }

    logRecord.provider_response = responseBody;
    logRecord.code = 'LINE_PUSH_FAILED';
    logRecord.error_message =
      'LINE push message failed: HTTP ' + statusCode;
    return notificationFinalizeResult_(logRecord);

  } catch (error) {
    logRecord.code = 'LINE_PUSH_EXCEPTION';
    logRecord.error_message =
      notificationServiceText_(error && error.message) ||
      'LINE push message exception';
    return notificationFinalizeResult_(logRecord);
  }
}


/**
 * Notify one bound tenant after a new bill has been created.
 * Existing bill updates are intentionally skipped so a retried generation
 * request cannot resend the creation notification.
 */
function notificationSendTenantBillCreated_(bill, workspaceId) {
  bill = bill || {};

  if (bill.updated_existing === true) {
    return {
      success: true,
      code: 'NOTIFICATION_SKIPPED_EXISTING_BILL',
      message: 'Existing bill update does not send a creation notification',
      skipped: true
    };
  }

  const tenantId = notificationServiceText_(bill.tenant_id);
  const billId = notificationServiceText_(bill.bill_id);
  const billMonth = notificationServiceText_(bill.bill_month);
  const dueDate = notificationServiceText_(bill.due_date);
  const totalAmount = Number(bill.total_amount) || 0;

  if (!tenantId || !billId || !workspaceId) {
    return {
      success: false,
      code: 'BILL_NOTIFICATION_IDENTITY_INCOMPLETE',
      message: 'Bill notification identity is incomplete'
    };
  }

  return notificationSendLineText_({
    receiver: {
      receiver_type: 'tenant',
      receiver_id: tenantId,
      workspace_id: notificationServiceText_(workspaceId)
    },
    template_key: 'bill_created',
    variables: {
      tenant_name: notificationServiceText_(bill.tenant_name) || '房客',
      month: billMonth || '未提供',
      amount: Math.round(totalAmount).toLocaleString('en-US'),
      due_date: dueDate || '請查看帳單明細'
    },
    source: 'landlord_bills_generate',
    event_type: 'bill_created',
    reference_id: billId,
    metadata: {
      bill_month: billMonth,
      due_date: dueDate,
      total_amount: totalAmount
    }
  });
}


function notificationNotifyTenantBillsCreated_(bills, workspaceId) {
  const results = (Array.isArray(bills) ? bills : []).map(function (bill) {
    return notificationSendTenantBillCreated_(bill, workspaceId);
  });

  return {
    attempted_count: results.filter(function (result) {
      return result && result.skipped !== true;
    }).length,
    sent_count: results.filter(function (result) {
      return result && result.success === true && result.skipped !== true;
    }).length,
    failed_count: results.filter(function (result) {
      return result && result.success !== true;
    }).length,
    skipped_count: results.filter(function (result) {
      return result && result.skipped === true;
    }).length,
    results: results
  };
}


function notificationResolveReceiver_(receiver) {
  receiver = receiver || {};

  const receiverType = notificationServiceText_(
    receiver.receiver_type
  ).toLowerCase();
  const receiverId = notificationServiceText_(
    receiver.receiver_id
  );
  const workspaceId = notificationServiceText_(
    receiver.workspace_id
  );
  const explicitLineUserId = notificationServiceText_(
    receiver.line_user_id
  );

  if (
    ['tenant', 'landlord', 'direct'].indexOf(receiverType) < 0
  ) {
    return notificationReceiverFailure_(
      'NOTIFICATION_RECEIVER_TYPE_INVALID',
      '通知收件人類型不支援',
      receiverType,
      receiverId,
      workspaceId
    );
  }

  if (receiverType === 'tenant') {
    const resolved = notificationResolveTenantReceiver_(receiverId, workspaceId);
    return notificationValidateExplicitReceiverLine_(resolved, explicitLineUserId);
  }

  if (receiverType === 'landlord') {
    const resolved = notificationResolveLandlordReceiver_(receiverId, workspaceId);
    return notificationValidateExplicitReceiverLine_(resolved, explicitLineUserId);
  }

  if (explicitLineUserId) {
    return {
      success: true,
      code: 'OK',
      message: '直接通知收件人已解析',
      receiver_type: receiverType,
      receiver_id: receiverId,
      workspace_id: workspaceId,
      line_user_id: explicitLineUserId
    };
  }

  return notificationReceiverFailure_(
    'NOTIFICATION_LINE_UID_REQUIRED',
    '直接通知必須提供 LINE UID',
    receiverType,
    receiverId,
    workspaceId
  );
}


function notificationResolveTenantReceiver_(tenantId, workspaceId) {
  if (!workspaceId) {
    return notificationReceiverFailure_(
      'NOTIFICATION_WORKSPACE_REQUIRED',
      'Tenant notification 必須提供 workspace_id',
      'tenant',
      tenantId,
      workspaceId
    );
  }

  if (!tenantId) {
    return notificationReceiverFailure_(
      'NOTIFICATION_TENANT_ID_REQUIRED',
      'Tenant receiver 必須提供 tenant_id',
      'tenant',
      tenantId,
      workspaceId
    );
  }

  const matches = notificationServiceRows_(
    V2_NOTIFICATION_SERVICE_SHEETS_.tenants
  ).filter(function (row) {
    return (
      notificationServiceText_(row.tenant_id) === tenantId &&
      notificationServiceText_(row.workspace_id) === workspaceId &&
      notificationServiceActive_(
        row.account_status || row.status || row.binding_status
      )
    );
  });

  if (matches.length !== 1) {
    return notificationReceiverFailure_(
      matches.length > 1
        ? 'NOTIFICATION_TENANT_AMBIGUOUS'
        : 'NOTIFICATION_TENANT_NOT_FOUND',
      matches.length > 1
        ? 'Tenant receiver 關聯不唯一'
        : '找不到 Tenant receiver',
      'tenant',
      tenantId,
      workspaceId
    );
  }

  const row = matches[0];
  const lineUserId = notificationLineUserId_(row, 'tenant');

  if (!lineUserId) {
    return notificationReceiverFailure_(
      'NOTIFICATION_TENANT_NOT_BOUND',
      'Tenant 尚未綁定 LINE',
      'tenant',
      tenantId,
      workspaceId || notificationServiceText_(row.workspace_id)
    );
  }

  return {
    success: true,
    code: 'OK',
    message: 'Tenant receiver 已解析',
    receiver_type: 'tenant',
    receiver_id: tenantId,
    workspace_id:
      workspaceId || notificationServiceText_(row.workspace_id),
    line_user_id: lineUserId
  };
}


function notificationResolveLandlordReceiver_(landlordId, workspaceId) {
  if (!workspaceId) {
    return notificationReceiverFailure_(
      'NOTIFICATION_WORKSPACE_REQUIRED',
      'Landlord notification 必須提供 workspace_id',
      'landlord',
      landlordId,
      workspaceId
    );
  }

  if (!landlordId) {
    return notificationReceiverFailure_(
      'NOTIFICATION_LANDLORD_ID_REQUIRED',
      'Landlord receiver 必須提供 landlord_id',
      'landlord',
      landlordId,
      workspaceId
    );
  }

  const landlords = notificationServiceRows_(
    V2_NOTIFICATION_SERVICE_SHEETS_.landlords
  ).filter(function (row) {
    return (
      notificationServiceText_(row.landlord_id) === landlordId &&
      (!notificationServiceText_(row.workspace_id) ||
        notificationServiceText_(row.workspace_id) === workspaceId) &&
      notificationServiceActive_(row.account_status || row.status)
    );
  });

  if (landlords.length !== 1) {
    return notificationReceiverFailure_(
      landlords.length > 1
        ? 'NOTIFICATION_LANDLORD_AMBIGUOUS'
        : 'NOTIFICATION_LANDLORD_NOT_FOUND',
      landlords.length > 1
        ? 'Landlord receiver 關聯不唯一'
        : '找不到 Landlord receiver',
      'landlord',
      landlordId,
      workspaceId
    );
  }

  const landlord = landlords[0];
  const landlordUserId = notificationServiceText_(
    landlord.landlord_user_id || landlord.user_id
  );
  let lineUserId = notificationLineUserId_(landlord, 'landlord');

  if (!lineUserId && landlordUserId) {
    const users = notificationServiceRows_(
      V2_NOTIFICATION_SERVICE_SHEETS_.users
    ).filter(function (row) {
      return (
        notificationServiceText_(row.user_id) === landlordUserId &&
        notificationServiceActive_(row.account_status || row.status)
      );
    });

    if (users.length !== 1) {
      return notificationReceiverFailure_(
        users.length > 1
          ? 'NOTIFICATION_LANDLORD_USER_AMBIGUOUS'
          : 'NOTIFICATION_LANDLORD_USER_NOT_FOUND',
        users.length > 1
          ? 'Landlord user 關聯不唯一'
          : '找不到 Landlord user',
        'landlord',
        landlordId,
        workspaceId
      );
    }

    lineUserId = notificationLineUserId_(users[0], 'landlord');
  }

  if (workspaceId && landlordUserId) {
    const memberships = notificationServiceRows_(
      V2_NOTIFICATION_SERVICE_SHEETS_.workspaceMembers
    ).filter(function (row) {
      return (
        notificationServiceText_(row.workspace_id) === workspaceId &&
        notificationServiceText_(row.user_id) === landlordUserId &&
        notificationServiceActive_(
          row.member_status || row.status || row.membership_status
        )
      );
    });

    if (memberships.length !== 1) {
      return notificationReceiverFailure_(
        memberships.length > 1
          ? 'NOTIFICATION_LANDLORD_MEMBERSHIP_AMBIGUOUS'
          : 'NOTIFICATION_LANDLORD_WORKSPACE_MISMATCH',
        memberships.length > 1
          ? 'Landlord workspace membership 不唯一'
          : 'Landlord 不屬於指定 Workspace',
        'landlord',
        landlordId,
        workspaceId
      );
    }
  }

  if (!lineUserId) {
    return notificationReceiverFailure_(
      'NOTIFICATION_LANDLORD_NOT_BOUND',
      'Landlord 尚未綁定 LINE',
      'landlord',
      landlordId,
      workspaceId
    );
  }

  return {
    success: true,
    code: 'OK',
    message: 'Landlord receiver 已解析',
    receiver_type: 'landlord',
    receiver_id: landlordId,
    workspace_id:
      workspaceId || notificationServiceText_(landlord.workspace_id),
    line_user_id: lineUserId
  };
}


/**
 * Tenant/landlord recipients are always resolved from their canonical ID and
 * workspace relationship. A supplied LINE UID may only corroborate that
 * result; it must never override it.
 */
function notificationValidateExplicitReceiverLine_(resolved, explicitLineUserId) {
  if (!resolved || resolved.success !== true) return resolved;
  if (!explicitLineUserId || resolved.line_user_id === explicitLineUserId) {
    return resolved;
  }
  return notificationReceiverFailure_(
    'NOTIFICATION_RECEIVER_LINE_UID_MISMATCH',
    '通知收件人 LINE 身分與 Workspace 關聯不一致',
    resolved.receiver_type,
    resolved.receiver_id,
    resolved.workspace_id
  );
}


function notificationReceiverFailure_(
  code,
  message,
  receiverType,
  receiverId,
  workspaceId
) {
  return {
    success: false,
    code: code,
    message: message,
    receiver_type: receiverType || '',
    receiver_id: receiverId || '',
    workspace_id: workspaceId || '',
    line_user_id: ''
  };
}


function notificationFinalizeResult_(logRecord) {
  const logRecorded = notificationAppendLog_(logRecord);
  const success = logRecord.success === true;

  return {
    success: success,
    code: logRecord.code || (success ? 'OK' : 'NOTIFICATION_FAILED'),
    message: success
      ? 'LINE push message success'
      : logRecord.error_message || 'LINE push message failed',
    data: {
      notification_log_id: logRecord.notification_log_id,
      channel: logRecord.channel,
      receiver_type: logRecord.receiver_type,
      receiver_id: logRecord.receiver_id,
      workspace_id: logRecord.workspace_id,
      delivery_status: logRecord.delivery_status,
      http_status: logRecord.http_status,
      log_recorded: logRecorded,
      queue_id: logRecord.queue_id || '',
      retry_count: Number(logRecord.retry_count) || 0
    }
  };
}


function notificationAppendLog_(record) {
  try {
    const sheet = notificationEnsureLogSheet_();
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map(function (header) {
        return notificationServiceText_(header);
      });

    sheet.appendRow(
      headers.map(function (header) {
        return record[header] !== undefined ? record[header] : '';
      })
    );

    return true;
  } catch (error) {
    return false;
  }
}


function notificationUpdateLogRetryCount_(notificationLogId, retryCount) {
  try {
    const sheet = notificationEnsureLogSheet_();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map(notificationServiceText_);
    const idColumn = headers.indexOf('notification_log_id');
    const retryColumn = headers.indexOf('retry_count');

    if (idColumn < 0 || retryColumn < 0 || sheet.getLastRow() < 2) {
      return false;
    }

    const ids = sheet.getRange(2, idColumn + 1, sheet.getLastRow() - 1, 1)
      .getValues();
    for (let index = ids.length - 1; index >= 0; index -= 1) {
      if (notificationServiceText_(ids[index][0]) === notificationLogId) {
        sheet.getRange(index + 2, retryColumn + 1).setValue(retryCount);
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}


function notificationEnsureLogSheet_() {
  const ss = runtimeSpreadsheet_();
  let sheet = ss.getSheetByName(
    V2_NOTIFICATION_SERVICE_SHEETS_.logs
  );

  if (!sheet) {
    sheet = ss.insertSheet(V2_NOTIFICATION_SERVICE_SHEETS_.logs);
    sheet.appendRow(V2_NOTIFICATION_SERVICE_LOG_HEADERS_);
    return sheet;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function (header) {
      return notificationServiceText_(header);
    });

  if (currentHeaders.every(function (header) { return !header; })) {
    sheet
      .getRange(1, 1, 1, V2_NOTIFICATION_SERVICE_LOG_HEADERS_.length)
      .setValues([V2_NOTIFICATION_SERVICE_LOG_HEADERS_]);
    return sheet;
  }

  V2_NOTIFICATION_SERVICE_LOG_HEADERS_.forEach(function (header) {
    if (currentHeaders.indexOf(header) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      currentHeaders.push(header);
    }
  });

  return sheet;
}


function notificationServiceRows_(sheetName) {
  const sheet = runtimeSpreadsheet_().getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  if (typeof workspaceGetObjectsWithRow_ === 'function') {
    return workspaceGetObjectsWithRow_(sheet);
  }

  const values =
    typeof runtimeSnapshotGetValues_ === 'function'
      ? runtimeSnapshotGetValues_(sheet)
      : sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) {
    return notificationServiceText_(header);
  });

  return values.slice(1).map(function (row, index) {
    const object = { _row: index + 2 };
    headers.forEach(function (header, column) {
      if (header) {
        object[header] = row[column];
      }
    });
    return object;
  });
}


function notificationLineUserId_(row, receiverType) {
  row = row || {};

  if (receiverType === 'tenant') {
    return notificationServiceText_(
      row.tenant_line_user_id || row.line_user_id || row.line_uid
    );
  }

  return notificationServiceText_(
    row.landlord_line_user_id || row.line_user_id || row.line_uid
  );
}


function notificationServiceActive_(value) {
  const normalized = notificationServiceText_(value).toLowerCase();
  return !normalized || [
    'active',
    'enabled',
    'bound',
    'owner',
    'manager',
    'staff'
  ].indexOf(normalized) >= 0;
}


function notificationLineAccessToken_() {
  return notificationServiceText_(
    PropertiesService
      .getScriptProperties()
      .getProperty('LINE_CHANNEL_ACCESS_TOKEN')
  );
}


function notificationServiceId_(prefix) {
  const uuid =
    typeof Utilities !== 'undefined' && Utilities.getUuid
      ? Utilities.getUuid().replace(/-/g, '').slice(0, 18).toUpperCase()
      : String(new Date().getTime()) + String(Math.floor(Math.random() * 100000));

  return String(prefix || 'NLG') + uuid;
}


function notificationSafeJson_(value) {
  try {
    return JSON.stringify(
      notificationSanitizeMetadata_(value || {}, 0)
    ).slice(0, 2000);
  } catch (error) {
    return '{}';
  }
}


function notificationSanitizeMetadata_(value, depth) {
  depth = Number(depth) || 0;
  if (depth > 4) return '[truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, 50).map(function (item) {
      return notificationSanitizeMetadata_(item, depth + 1);
    });
  }

  if (value && typeof value === 'object') {
    const clean = {};
    Object.keys(value).slice(0, 100).forEach(function (key) {
      if (/token|secret|password|credential|authorization|private[_-]?key/i.test(key)) {
        clean[key] = '[redacted]';
      } else if (/line[_-]?(user[_-]?)?id|line[_-]?uid/i.test(key)) {
        clean[key] = notificationMaskLineUserId_(value[key]);
      } else {
        clean[key] = notificationSanitizeMetadata_(value[key], depth + 1);
      }
    });
    return clean;
  }

  return value;
}


function notificationMaskLineUserId_(value) {
  const text = notificationServiceText_(value);
  if (text.length <= 8) return text ? '[masked]' : '';
  return text.slice(0, 4) + '…' + text.slice(-4);
}


function notificationServiceText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}
