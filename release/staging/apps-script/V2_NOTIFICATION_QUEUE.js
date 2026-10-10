/**
 * CMWebs V2 durable notification queue (Phase 90 staging only).
 */

const V2_NOTIFICATION_QUEUE_SHEET_ = 'V2_NOTIFICATION_QUEUE';

const V2_NOTIFICATION_QUEUE_HEADERS_ = [
  'id',
  'dedupe_key',
  'event_type',
  'receiver_type',
  'receiver_id',
  'workspace_id',
  'reference_id',
  'template_key',
  'payload',
  'status',
  'retry_count',
  'next_retry_at',
  'created_at',
  'updated_at',
  'processing_at',
  'sent_at',
  'last_error',
  'last_code',
  'last_http_status'
];

const V2_NOTIFICATION_QUEUE_TERMINAL_STATUSES_ = [
  'sent',
  'failed'
];


function notificationQueueEnqueue_(options) {
  runtimeRequireFeature_('NOTIFICATION_QUEUE');
  options = options || {};

  const receiver = options.receiver || {};
  const eventType = notificationQueueText_(options.event_type) || 'line_message';
  const receiverType = notificationQueueText_(receiver.receiver_type).toLowerCase();
  const receiverId = notificationQueueText_(receiver.receiver_id);
  const workspaceId = notificationQueueText_(receiver.workspace_id);
  const referenceId = notificationQueueText_(options.reference_id);
  const templateKey = notificationQueueText_(options.template_key).toLowerCase();
  const variables = options.variables || {};
  let text = notificationQueueText_(options.text);

  if (templateKey) {
    if (typeof notificationTemplateRender_ !== 'function') {
      return notificationQueueFailure_(
        'NOTIFICATION_TEMPLATE_SERVICE_UNAVAILABLE',
        'Notification template service is unavailable'
      );
    }

    const rendered = notificationTemplateRender_(templateKey, variables);
    if (!rendered.success) {
      return rendered;
    }
    text = rendered.text;
  }

  if (!receiverType || !text) {
    return notificationQueueFailure_(
      'NOTIFICATION_JOB_INVALID',
      'Notification receiver and content are required'
    );
  }

  if (
    ['tenant', 'landlord'].indexOf(receiverType) >= 0 &&
    (!receiverId || !workspaceId)
  ) {
    return notificationQueueFailure_(
      'NOTIFICATION_RECEIVER_SCOPE_REQUIRED',
      'Tenant/Landlord notification 必須提供 receiver_id 與 workspace_id'
    );
  }

  const id = notificationQueueId_();
  const receiverRequest = {
    receiver_type: receiverType,
    receiver_id: receiverId,
    workspace_id: workspaceId,
    line_user_id: notificationQueueText_(receiver.line_user_id)
  };
  const resolvedReceiver = typeof notificationResolveReceiver_ === 'function'
    ? notificationResolveReceiver_(receiverRequest)
    : null;

  if (
    ['tenant', 'landlord'].indexOf(receiverType) >= 0 &&
    (!resolvedReceiver || resolvedReceiver.success !== true)
  ) {
    return notificationQueueFailure_(
      resolvedReceiver && resolvedReceiver.code ||
        'NOTIFICATION_RECEIVER_RESOLUTION_REQUIRED',
      resolvedReceiver && resolvedReceiver.message ||
        '通知收件人無法以 Workspace 關聯解析'
    );
  }

  const event = notificationQueueBuildEventEnvelope_(
    options,
    id,
    receiverType,
    receiverId,
    workspaceId
  );
  const memberKey = notificationQueueText_(
    options.metadata && (
      options.metadata.membership_id || options.metadata.user_id
    )
  );
  const dedupeKey = referenceId
    ? [
        eventType,
        receiverType,
        receiverId,
        workspaceId,
        referenceId,
        memberKey
      ].join('|')
    : id;
  const now = new Date();
  const payload = notificationQueueSafeJson_({
    text: text,
    variables: variables,
    source: notificationQueueText_(options.source),
    metadata: typeof notificationSanitizeMetadata_ === 'function'
      ? notificationSanitizeMetadata_(options.metadata || {}, 0)
      : {},
    // The worker re-resolves this tuple; it does not trust a caller-provided
    // LINE UID as a recipient override.
    event_id: event.event_id,
    workspace_id: event.workspace_id,
    actor_type: event.actor_type,
    actor_id: event.actor_id,
    resource_type: event.resource_type,
    resource_id: event.resource_id,
    receiver_type: event.receiver_type,
    receiver_id: event.receiver_id,
    line_user_id: ''
  });

  const lock = notificationQueueLock_();
  let locked = false;

  try {
    lock.waitLock(5000);
    locked = true;

    const sheet = notificationQueueEnsureSheet_();
    const existing = notificationQueueRows_(sheet).filter(function (row) {
      return notificationQueueText_(row.dedupe_key) === dedupeKey;
    });

    if (existing.length > 0) {
      const job = existing[0];
      return {
        success: true,
        code: 'NOTIFICATION_DUPLICATE',
        message: 'Notification event already exists',
        duplicate: true,
        data: notificationQueuePublicJob_(job)
      };
    }

    const job = {
      id: id,
      dedupe_key: dedupeKey,
      event_type: eventType,
      receiver_type: receiverType,
      receiver_id: receiverId,
      workspace_id: workspaceId,
      reference_id: referenceId,
      template_key: templateKey,
      payload: payload,
      status: 'pending',
      retry_count: 0,
      next_retry_at: now,
      created_at: now,
      updated_at: now,
      processing_at: '',
      sent_at: '',
      last_error: '',
      last_code: '',
      last_http_status: ''
    };

    sheet.appendRow(V2_NOTIFICATION_QUEUE_HEADERS_.map(function (header) {
      return job[header] !== undefined ? job[header] : '';
    }));

    job._row = sheet.getLastRow();

    return {
      success: true,
      code: 'NOTIFICATION_QUEUED',
      message: 'Notification queued',
      duplicate: false,
      data: notificationQueuePublicJob_(job)
    };

  } catch (error) {
    return notificationQueueFailure_(
      'NOTIFICATION_QUEUE_ERROR',
      notificationQueueText_(error && error.message) ||
        'Notification queue failed'
    );

  } finally {
    if (locked) lock.releaseLock();
  }
}


function notificationQueueProcessById_(queueId, force) {
  queueId = notificationQueueText_(queueId);

  const claim = notificationQueueClaim_(queueId, force === true);
  if (!claim.success || !claim.job) {
    return claim;
  }

  const job = claim.job;
  let delivery;

  try {
    delivery = notificationDeliverQueuedLine_(job);
  } catch (error) {
    delivery = {
      success: false,
      code: 'NOTIFICATION_WORKER_EXCEPTION',
      message: notificationQueueText_(error && error.message) ||
        'Notification worker failed',
      data: {
        http_status: ''
      }
    };
  }

  return notificationQueueCompleteAttempt_(job, delivery);
}


function processNotificationQueue() {
  runtimeRequireFeature_('NOTIFICATION_QUEUE');
  return notificationQueueWorker_(20);
}


/**
 * One-time staging migration. It creates/extends queue and log sheets and
 * installs one five-minute worker trigger. Production must use a separately
 * reviewed migration.
 */
function migrateStagingNotificationReliability() {
  runtimeRequireSchemaMigration_();
  runtimeRequireFeature_('NOTIFICATION_QUEUE');

  const queueSheet = notificationQueueEnsureSheet_();
  const logSheet = notificationEnsureLogSheet_();
  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'processNotificationQueue';
  });

  let triggerCreated = false;
  if (triggers.length === 0) {
    ScriptApp.newTrigger('processNotificationQueue')
      .timeBased()
      .everyMinutes(5)
      .create();
    triggerCreated = true;
  }

  return {
    success: true,
    environment: 'staging',
    queue_sheet: queueSheet.getName(),
    log_sheet: logSheet.getName(),
    worker_trigger_count: triggers.length + (triggerCreated ? 1 : 0),
    trigger_created: triggerCreated
  };
}


function notificationQueueWorker_(limit) {
  limit = Math.max(1, Math.min(Number(limit) || 20, 50));

  const now = new Date();
  const staleRecovery = notificationQueueRecoverStaleProcessing_(now);
  const jobs = notificationQueueRows_(notificationQueueEnsureSheet_())
    .filter(function (job) {
      const status = notificationQueueText_(job.status).toLowerCase();
      if (status !== 'pending' && status !== 'retrying') return false;
      const nextRetry = notificationQueueDate_(job.next_retry_at);
      return !nextRetry || nextRetry.getTime() <= now.getTime();
    })
    .slice(0, limit);

  const results = jobs.map(function (job) {
    return notificationQueueProcessById_(job.id, false);
  });

  return {
    success: results.every(function (result) {
      return result && result.success === true;
    }),
    processed_count: results.length,
    sent_count: results.filter(function (result) {
      return result && result.success === true &&
        result.data && result.data.queue_status === 'sent';
    }).length,
    retrying_count: results.filter(function (result) {
      return result && result.data && result.data.queue_status === 'retrying';
    }).length,
    failed_count: results.filter(function (result) {
      return result && result.data && result.data.queue_status === 'failed';
    }).length,
    stale_recovered_count: staleRecovery.recovered_count,
    stale_failed_count: staleRecovery.failed_count,
    results: results
  };
}


function notificationQueueRecoverStaleProcessing_(now) {
  const lock = notificationQueueLock_();
  let locked = false;
  const summary = { recovered_count: 0, failed_count: 0 };
  try {
    lock.waitLock(5000);
    locked = true;
    const sheet = notificationQueueEnsureSheet_();
    const cutoff = (now || new Date()).getTime() -
      notificationQueueProcessingTimeoutMs_();
    notificationQueueRows_(sheet).forEach(function (job) {
      if (notificationQueueText_(job.status).toLowerCase() !== 'processing') {
        return;
      }
      const processingAt = notificationQueueDate_(job.processing_at);
      if (!processingAt || processingAt.getTime() > cutoff) return;

      const retryCount = Number(job.retry_count) + 1;
      job.retry_count = retryCount;
      job.processing_at = '';
      job.updated_at = now || new Date();
      job.last_code = 'NOTIFICATION_PROCESSING_TIMEOUT';
      job.last_error = 'Notification worker processing lease expired';
      job.last_http_status = '';
      if (retryCount >= 3) {
        job.status = 'failed';
        job.next_retry_at = '';
        summary.failed_count += 1;
      } else {
        job.status = 'retrying';
        job.next_retry_at = now || new Date();
        summary.recovered_count += 1;
      }
      notificationQueueWriteJob_(sheet, job);
    });
    return summary;
  } finally {
    if (locked) lock.releaseLock();
  }
}


function notificationQueueProcessingTimeoutMs_() {
  const value = Number(
    PropertiesService.getScriptProperties()
      .getProperty('CMWEBS_NOTIFICATION_PROCESSING_TIMEOUT_MINUTES')
  );
  const minutes = Math.max(5, Math.min(value || 10, 60));
  return minutes * 60 * 1000;
}


function notificationQueueClaim_(queueId, force) {
  const lock = notificationQueueLock_();
  let locked = false;

  try {
    lock.waitLock(5000);
    locked = true;

    const sheet = notificationQueueEnsureSheet_();
    const job = notificationQueueRows_(sheet).filter(function (row) {
      return notificationQueueText_(row.id) === queueId;
    })[0];

    if (!job) {
      return notificationQueueFailure_(
        'NOTIFICATION_JOB_NOT_FOUND',
        'Notification job does not exist'
      );
    }

    const status = notificationQueueText_(job.status).toLowerCase();

    if (status === 'sent') {
      return {
        success: true,
        code: 'NOTIFICATION_DUPLICATE',
        message: 'Notification already sent',
        duplicate: true,
        data: notificationQueuePublicJob_(job)
      };
    }

    if (status === 'processing') {
      return notificationQueueFailure_(
        'NOTIFICATION_ALREADY_PROCESSING',
        'Notification is already processing',
        notificationQueuePublicJob_(job)
      );
    }

    if (status === 'failed' && !force) {
      return notificationQueueFailure_(
        'NOTIFICATION_RETRY_EXHAUSTED',
        'Notification retry limit reached',
        notificationQueuePublicJob_(job)
      );
    }

    if (!force && status === 'retrying') {
      const nextRetry = notificationQueueDate_(job.next_retry_at);
      if (nextRetry && nextRetry.getTime() > Date.now()) {
        return notificationQueueFailure_(
          'NOTIFICATION_NOT_DUE',
          'Notification retry is not due',
          notificationQueuePublicJob_(job)
        );
      }
    }

    job.status = 'processing';
    job.processing_at = new Date();
    job.updated_at = job.processing_at;
    notificationQueueWriteJob_(sheet, job);

    return {
      success: true,
      code: 'NOTIFICATION_PROCESSING',
      message: 'Notification claimed by worker',
      job: job
    };

  } catch (error) {
    return notificationQueueFailure_(
      'NOTIFICATION_QUEUE_CLAIM_ERROR',
      notificationQueueText_(error && error.message) ||
        'Notification claim failed'
    );

  } finally {
    if (locked) lock.releaseLock();
  }
}


function notificationQueueCompleteAttempt_(job, delivery) {
  const lock = notificationQueueLock_();
  let locked = false;

  try {
    lock.waitLock(5000);
    locked = true;

    const sheet = notificationQueueEnsureSheet_();
    const current = notificationQueueRows_(sheet).filter(function (row) {
      return notificationQueueText_(row.id) === notificationQueueText_(job.id);
    })[0];

    if (!current) {
      return notificationQueueFailure_(
        'NOTIFICATION_JOB_NOT_FOUND',
        'Notification job disappeared after delivery'
      );
    }

    const now = new Date();
    current.updated_at = now;
    current.processing_at = '';
    current.last_code = notificationQueueText_(delivery && delivery.code);
    current.last_error = delivery && delivery.success === true
      ? ''
      : notificationQueueText_(delivery && delivery.message);
    current.last_http_status = delivery && delivery.data
      ? delivery.data.http_status || ''
      : '';

    if (delivery && delivery.success === true) {
      current.status = 'sent';
      current.sent_at = now;
      current.next_retry_at = '';
    } else {
      const retryCount = Number(current.retry_count) + 1;
      current.retry_count = retryCount;
      current.sent_at = '';

      if (retryCount >= 3) {
        current.status = 'failed';
        current.next_retry_at = '';
      } else {
        current.status = 'retrying';
        current.next_retry_at = new Date(
          now.getTime() + notificationQueueRetryDelayMs_(retryCount)
        );
      }

      if (
        delivery && delivery.data && delivery.data.notification_log_id &&
        typeof notificationUpdateLogRetryCount_ === 'function'
      ) {
        notificationUpdateLogRetryCount_(
          delivery.data.notification_log_id,
          retryCount
        );
      }
    }

    notificationQueueWriteJob_(sheet, current);

    const result = delivery || notificationQueueFailure_(
      'NOTIFICATION_DELIVERY_EMPTY',
      'Notification delivery returned no result'
    );
    result.data = result.data || {};
    result.data.queue_id = current.id;
    result.data.queue_status = current.status;
    result.data.retry_count = Number(current.retry_count) || 0;
    result.data.next_retry_at = current.next_retry_at || '';
    result.data.sent_at = current.sent_at || '';
    return result;

  } catch (error) {
    return notificationQueueFailure_(
      'NOTIFICATION_QUEUE_COMPLETE_ERROR',
      notificationQueueText_(error && error.message) ||
        'Notification attempt completion failed'
    );

  } finally {
    if (locked) lock.releaseLock();
  }
}


function notificationQueueRetryDelayMs_(retryCount) {
  return Number(retryCount) === 1
    ? 5 * 60 * 1000
    : 30 * 60 * 1000;
}


function notificationQueueEnsureSheet_() {
  const ss = runtimeSpreadsheet_();
  let sheet = ss.getSheetByName(V2_NOTIFICATION_QUEUE_SHEET_);

  if (!sheet) {
    sheet = ss.insertSheet(V2_NOTIFICATION_QUEUE_SHEET_);
    sheet.appendRow(V2_NOTIFICATION_QUEUE_HEADERS_);
    return sheet;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(notificationQueueText_);

  if (headers.every(function (header) { return !header; })) {
    sheet.getRange(1, 1, 1, V2_NOTIFICATION_QUEUE_HEADERS_.length)
      .setValues([V2_NOTIFICATION_QUEUE_HEADERS_]);
    return sheet;
  }

  V2_NOTIFICATION_QUEUE_HEADERS_.forEach(function (header) {
    if (headers.indexOf(header) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      headers.push(header);
    }
  });

  return sheet;
}


function notificationQueueRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(notificationQueueText_);

  return values.slice(1).map(function (valuesRow, index) {
    const row = { _row: index + 2 };
    headers.forEach(function (header, column) {
      if (header) row[header] = valuesRow[column];
    });
    return row;
  });
}


function notificationQueueWriteJob_(sheet, job) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(notificationQueueText_);

  sheet.getRange(job._row, 1, 1, headers.length).setValues([
    headers.map(function (header) {
      return job[header] !== undefined ? job[header] : '';
    })
  ]);
}


function notificationQueuePublicJob_(job) {
  return {
    queue_id: notificationQueueText_(job.id),
    event_type: notificationQueueText_(job.event_type),
    receiver_type: notificationQueueText_(job.receiver_type),
    receiver_id: notificationQueueText_(job.receiver_id),
    workspace_id: notificationQueueText_(job.workspace_id),
    reference_id: notificationQueueText_(job.reference_id),
    status: notificationQueueText_(job.status),
    retry_count: Number(job.retry_count) || 0,
    next_retry_at: job.next_retry_at || '',
    created_at: job.created_at || '',
    sent_at: job.sent_at || ''
  };
}


/**
 * Every queued business event carries a stable, self-describing envelope.
 * Defaults preserve compatibility for older callers while keeping receiver
 * selection explicit and workspace-scoped.
 */
function notificationQueueBuildEventEnvelope_(
  options,
  queueId,
  receiverType,
  receiverId,
  workspaceId
) {
  options = options || {};
  const metadata = options.metadata || {};
  return {
    event_id: notificationQueueText_(
      options.event_id || metadata.event_id || queueId
    ),
    workspace_id: notificationQueueText_(workspaceId),
    actor_type: notificationQueueText_(
      options.actor_type || metadata.actor_type || 'system'
    ),
    actor_id: notificationQueueText_(
      options.actor_id || metadata.actor_id || 'notification_service'
    ),
    resource_type: notificationQueueText_(
      options.resource_type || metadata.resource_type || 'notification'
    ),
    resource_id: notificationQueueText_(
      options.resource_id || metadata.resource_id ||
        options.reference_id || queueId
    ),
    receiver_type: notificationQueueText_(receiverType),
    receiver_id: notificationQueueText_(receiverId)
  };
}


function notificationQueueFailure_(code, message, data) {
  return {
    success: false,
    code: code,
    message: message,
    data: data || {}
  };
}


function notificationQueueDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}


function notificationQueueLock_() {
  return LockService.getDocumentLock() || LockService.getUserLock();
}


function notificationQueueId_() {
  return typeof notificationServiceId_ === 'function'
    ? notificationServiceId_('NQ')
    : 'NQ' + String(new Date().getTime()) +
      String(Math.floor(Math.random() * 100000));
}


function notificationQueueSafeJson_(value) {
  try {
    return JSON.stringify(value || {}).slice(0, 10000);
  } catch (error) {
    return '{}';
  }
}


function notificationQueueText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}
