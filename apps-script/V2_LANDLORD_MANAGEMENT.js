// ==================================================
// CMWebs V2 Landlord Management
// 恢復房東付款回報管理與房客訊息／報修管理後端
// ==================================================

var LM_SHEETS_ = {
  landlordTenantListView: 'V2_landlord_tenant_list_view',
  landlordHomeView: 'V2_landlord_home_view',
  landlords: 'V2_landlords',
  paymentReports: 'V2_payment_reports',
  tenantMessages: 'V2_tenant_messages'
};


// ==================================================
// 付款回報管理
// ==================================================

/**
 * 房東付款回報管理頁初始化
 * v2_action=landlord_payment_reports_init
 */
function getLandlordPaymentReportsInitByLineUid(landlordLineUserId) {
  var action = 'landlord_payment_reports_init';
  var emptyData = {
    landlord: null,
    summary: {
      total: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      voided: 0
    },
    reports: []
  };

  try {
    landlordLineUserId = lmText_(landlordLineUserId);

    if (!landlordLineUserId) {
      return {
        success: false,
        code: 'MISSING_LANDLORD_LINE_UID',
        message: '缺少房東 LINE UID',
        data: emptyData
      };
    }

    var landlord = lmResolveLandlord_(landlordLineUserId);

    if (!landlord) {
      return {
        success: false,
        code: 'LANDLORD_NOT_FOUND',
        message: '查無房東資料或尚未完成綁定',
        data: emptyData
      };
    }

    var reports = getLandlordPaymentReports_(landlordLineUserId);

    var summary = {
      total: reports.length,
      pending: lmCountStatus_(reports, ['pending', 'payment_reported']),
      confirmed: lmCountStatus_(reports, ['confirmed']),
      rejected: lmCountStatus_(reports, ['rejected']),
      voided: lmCountStatus_(reports, ['voided', 'void'])
    };

    lmLogAccess_({
      lineUserId: landlordLineUserId,
      userId: landlord.landlord_user_id || '',
      role: 'landlord',
      action: action,
      targetId: landlord.landlord_id || '',
      result: 'success',
      errorMessage: '',
      notes: 'reports=' + reports.length
    });

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data: {
        landlord: landlord,
        summary: summary,
        reports: reports
      }
    };

  } catch (error) {
    lmLogAccess_({
      lineUserId: landlordLineUserId || '',
      userId: '',
      role: 'landlord',
      action: action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message,
      data: emptyData
    };
  }
}


/**
 * 取得指定房東的付款回報。
 */
function getLandlordPaymentReports_(landlordLineUserId) {
  landlordLineUserId = lmText_(landlordLineUserId);

  if (!landlordLineUserId) {
    return [];
  }

  var landlord = lmResolveLandlord_(landlordLineUserId);
  var landlordId = landlord ? lmText_(landlord.landlord_id) : '';
  var sheet = lmEnsurePaymentReportSheet_();

  if (sheet.getLastRow() < 2) {
    return [];
  }

  var rows = lmSheetObjects_(sheet);

  return rows
    .filter(function (row) {
      var rowLineUid = lmText_(row.landlord_line_user_id);
      var rowLandlordId = lmText_(row.landlord_id);

      return (
        rowLineUid === landlordLineUserId ||
        (!!landlordId && rowLandlordId === landlordId)
      );
    })
    .map(function (row) {
      return {
        report_id: row.report_id,
        created_at: row.created_at,
        updated_at: row.updated_at,

        landlord_id: row.landlord_id,
        landlord_line_user_id: row.landlord_line_user_id,

        tenant_id: row.tenant_id,
        tenant_user_id: row.tenant_user_id,
        tenant_line_user_id: row.tenant_line_user_id,
        tenant_name: row.tenant_name,

        room_id: row.room_id,
        room_name: row.room_name,

        bill_id: row.bill_id,
        bill_month: row.bill_month,
        bill_total_amount: Number(row.bill_total_amount || 0),

        reported_amount: Number(row.reported_amount || 0),
        reported_last5: row.reported_last5,
        reported_paid_date: row.reported_paid_date,

        status: row.status,
        matched_payment_id: row.matched_payment_id,

        confirmed_at: row.confirmed_at,
        confirmed_by: row.confirmed_by,
        rejected_at: row.rejected_at,
        reject_reason: row.reject_reason,

        voided_at: row.voided_at,
        voided_by: row.voided_by,
        void_reason: row.void_reason,
        reversal_id: row.reversal_id,

        note: row.note
      };
    })
    .sort(lmPaymentReportSort_);
}


/**
 * 房東確認或駁回付款回報。
 *
 * confirmed：優先交由正式銷帳函式處理。
 * rejected：更新回報狀態並通知房客。
 */
function updateLandlordPaymentReportByLineUid_(
  landlordLineUserId,
  reportId,
  decision,
  rejectReason,
  landlordNote
) {
  var action = 'landlord_payment_report_update';

  try {
    landlordLineUserId = lmText_(landlordLineUserId);
    reportId = lmText_(reportId);
    decision = lmText_(decision).toLowerCase();
    rejectReason = lmText_(rejectReason);
    landlordNote = lmText_(landlordNote);

    if (!landlordLineUserId) {
      return {
        success: false,
        code: 'MISSING_LANDLORD_LINE_UID',
        message: '缺少房東 LINE UID'
      };
    }

    if (!reportId) {
      return {
        success: false,
        code: 'MISSING_REPORT_ID',
        message: '缺少付款回報 ID'
      };
    }

    if (decision !== 'confirmed' && decision !== 'rejected') {
      return {
        success: false,
        code: 'INVALID_DECISION',
        message: '處理結果必須是確認或駁回'
      };
    }

    if (decision === 'confirmed') {
      if (typeof settleLandlordPaymentReportByLineUid_ === 'function') {
        return settleLandlordPaymentReportByLineUid_(
          landlordLineUserId,
          reportId,
          landlordNote
        );
      }

      return {
        success: false,
        code: 'SETTLEMENT_FUNCTION_NOT_FOUND',
        message: '找不到正式銷帳函式，請確認 V2_PAYMENT_SETTLEMENT.gs 已存在'
      };
    }

    if (!rejectReason) {
      return {
        success: false,
        code: 'EMPTY_REJECT_REASON',
        message: '駁回付款回報時，請輸入原因'
      };
    }

    if (rejectReason.length > 300) {
      return {
        success: false,
        code: 'REJECT_REASON_TOO_LONG',
        message: '駁回原因最多 300 字'
      };
    }

    if (landlordNote.length > 300) {
      return {
        success: false,
        code: 'LANDLORD_NOTE_TOO_LONG',
        message: '房東備註最多 300 字'
      };
    }

    var lock = LockService.getScriptLock();

    if (!lock.tryLock(30000)) {
      return {
        success: false,
        code: 'REQUEST_BUSY',
        message: '系統正在處理其他資料，請稍後再試'
      };
    }

    try {
      var sheet = lmEnsurePaymentReportSheet_();
      var target = lmFindOwnedRow_(
        sheet,
        'report_id',
        reportId,
        landlordLineUserId
      );

      if (!target) {
        return {
          success: false,
          code: 'REPORT_NOT_FOUND',
          message: '找不到指定付款回報，或此資料不屬於目前房東'
        };
      }

      var report = target.object;
      var currentStatus = lmText_(report.status).toLowerCase();
      var matchedPaymentId = lmText_(report.matched_payment_id);

      if (currentStatus === 'voided' || currentStatus === 'void') {
        return {
          success: false,
          code: 'REPORT_ALREADY_VOIDED',
          message: '此付款回報已撤銷，不能再駁回'
        };
      }

      if (currentStatus === 'confirmed' || matchedPaymentId) {
        return {
          success: false,
          code: 'REPORT_ALREADY_SETTLED',
          message: '此付款回報已正式銷帳；需先使用撤銷銷帳功能'
        };
      }

      if (currentStatus === 'rejected') {
        return {
          success: true,
          code: 'ALREADY_REJECTED',
          message: '此付款回報已駁回',
          data: {
            report_id: reportId,
            status: 'rejected',
            reject_reason: report.reject_reason || rejectReason
          }
        };
      }

      var now = new Date();
      var note = lmAppendNote_(report.note, landlordNote);

      lmUpdateRow_(sheet, target.rowIndex, {
        status: 'rejected',
        updated_at: now,
        rejected_at: now,
        reject_reason: rejectReason,
        confirmed_at: '',
        confirmed_by: '',
        note: note
      });

      SpreadsheetApp.flush();

      var noticeText = lmBuildPaymentRejectNotice_({
        tenant_name: report.tenant_name,
        room_name: report.room_name,
        bill_month: report.bill_month,
        reported_amount: report.reported_amount,
        reported_last5: report.reported_last5,
        reject_reason: rejectReason
      });

      var pushResult = lmPushText_(
        lmText_(report.tenant_line_user_id),
        noticeText
      );

      lmLogLine_({
        direction: 'outgoing',
        source: 'landlord_payment_report_result',
        landlord_line_user_id: landlordLineUserId,
        tenant_line_user_id: report.tenant_line_user_id || '',
        tenant_id: report.tenant_id || '',
        tenant_user_id: report.tenant_user_id || '',
        tenant_name: report.tenant_name || '',
        room_list: report.room_name || '',
        message_type: 'payment_report_rejected',
        message_text: noticeText,
        status: pushResult.success ? 'success' : 'failed',
        note: pushResult.success
          ? 'payment report rejection sent to tenant'
          : pushResult.message
      });

      lmLogAccess_({
        lineUserId: landlordLineUserId,
        userId: '',
        role: 'landlord',
        action: action,
        targetId: reportId,
        result: 'success',
        errorMessage: '',
        notes: 'decision=rejected'
      });

      return {
        success: true,
        code: 'OK',
        message: pushResult.success
          ? '付款回報已駁回，房客已收到通知'
          : '付款回報已駁回，但房客 LINE 通知未成功',
        data: {
          report_id: reportId,
          status: 'rejected',
          reject_reason: rejectReason,
          tenant_notification_success: pushResult.success === true,
          updated_at: now
        }
      };

    } finally {
      try {
        lock.releaseLock();
      } catch (ignore) {}
    }

  } catch (error) {
    lmLogAccess_({
      lineUserId: landlordLineUserId || '',
      userId: '',
      role: 'landlord',
      action: action,
      targetId: reportId || '',
      result: 'failed',
      errorMessage: error.message
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message
    };
  }
}


// ==================================================
// 房客訊息／報修管理
// ==================================================

/**
 * 房東訊息管理頁初始化
 * v2_action=landlord_messages_init
 */
function getLandlordMessagesInitByLineUid(landlordLineUserId) {
  var action = 'landlord_messages_init';
  var emptyData = {
    landlord: null,
    summary: {
      total: 0,
      pending: 0,
      processing: 0,
      urgent: 0,
      completed: 0
    },
    messages: []
  };

  try {
    landlordLineUserId = lmText_(landlordLineUserId);

    if (!landlordLineUserId) {
      return {
        success: false,
        code: 'MISSING_LANDLORD_LINE_UID',
        message: '缺少房東 LINE UID',
        data: emptyData
      };
    }

    var landlord = lmResolveLandlord_(landlordLineUserId);

    if (!landlord) {
      return {
        success: false,
        code: 'LANDLORD_NOT_FOUND',
        message: '查無房東資料或尚未完成綁定',
        data: emptyData
      };
    }

    var messages = getLandlordTenantMessages_(landlordLineUserId);

    var summary = {
      total: messages.length,
      pending: lmCountStatus_(messages, ['pending']),
      processing: lmCountStatus_(messages, ['processing', 'replied']),
      urgent: messages.filter(function (item) {
        var status = lmText_(item.status).toLowerCase();
        var priority = lmText_(item.priority).toLowerCase();

        return (
          priority === 'urgent' &&
          ['completed', 'closed', 'rejected'].indexOf(status) === -1
        );
      }).length,
      completed: lmCountStatus_(messages, ['completed', 'closed'])
    };

    lmLogAccess_({
      lineUserId: landlordLineUserId,
      userId: landlord.landlord_user_id || '',
      role: 'landlord',
      action: action,
      targetId: landlord.landlord_id || '',
      result: 'success',
      errorMessage: '',
      notes: 'messages=' + messages.length
    });

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data: {
        landlord: landlord,
        summary: summary,
        messages: messages
      }
    };

  } catch (error) {
    lmLogAccess_({
      lineUserId: landlordLineUserId || '',
      userId: '',
      role: 'landlord',
      action: action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message,
      data: emptyData
    };
  }
}


/**
 * 取得指定房東的房客訊息。
 */
function getLandlordTenantMessages_(landlordLineUserId) {
  landlordLineUserId = lmText_(landlordLineUserId);

  if (!landlordLineUserId) {
    return [];
  }

  var landlord = lmResolveLandlord_(landlordLineUserId);
  var landlordId = landlord ? lmText_(landlord.landlord_id) : '';
  var sheet = lmEnsureTenantMessageSheet_();

  if (sheet.getLastRow() < 2) {
    return [];
  }

  var rows = lmSheetObjects_(sheet);

  return rows
    .filter(function (row) {
      var rowLineUid = lmText_(row.landlord_line_user_id);
      var rowLandlordId = lmText_(row.landlord_id);

      return (
        rowLineUid === landlordLineUserId ||
        (!!landlordId && rowLandlordId === landlordId)
      );
    })
    .map(function (row) {
      return {
        message_id: row.message_id,
        created_at: row.created_at,
        updated_at: row.updated_at,

        landlord_id: row.landlord_id,
        landlord_line_user_id: row.landlord_line_user_id,

        tenant_id: row.tenant_id,
        tenant_user_id: row.tenant_user_id,
        tenant_line_user_id: row.tenant_line_user_id,
        tenant_name: row.tenant_name,

        room_id: row.room_id,
        room_name: row.room_name,

        message_category: row.message_category,
        message_title: row.message_title,
        message_body: row.message_body,
        priority: row.priority,
        preferred_contact_time: row.preferred_contact_time,

        status: row.status,
        landlord_reply: row.landlord_reply,
        replied_at: row.replied_at,
        closed_at: row.closed_at,
        note: row.note
      };
    })
    .sort(lmTenantMessageSort_);
}


/**
 * 房東更新訊息狀態或回覆房客
 * v2_action=landlord_message_update
 */
function updateLandlordTenantMessageByLineUid_(
  landlordLineUserId,
  messageId,
  status,
  landlordReply
) {
  var action = 'landlord_message_update';

  try {
    landlordLineUserId = lmText_(landlordLineUserId);
    messageId = lmText_(messageId);
    status = lmText_(status).toLowerCase();
    landlordReply = lmText_(landlordReply);

    if (!landlordLineUserId) {
      return {
        success: false,
        code: 'MISSING_LANDLORD_LINE_UID',
        message: '缺少房東 LINE UID'
      };
    }

    if (!messageId) {
      return {
        success: false,
        code: 'MISSING_MESSAGE_ID',
        message: '缺少訊息 ID'
      };
    }

    var allowedStatuses = [
      'pending',
      'processing',
      'replied',
      'completed',
      'closed',
      'rejected'
    ];

    if (allowedStatuses.indexOf(status) === -1) {
      return {
        success: false,
        code: 'INVALID_STATUS',
        message: '訊息處理狀態不正確'
      };
    }

    if (landlordReply.length > 500) {
      return {
        success: false,
        code: 'LANDLORD_REPLY_TOO_LONG',
        message: '房東回覆最多 500 字'
      };
    }

    if (status === 'replied' && !landlordReply) {
      return {
        success: false,
        code: 'EMPTY_LANDLORD_REPLY',
        message: '選擇已回覆時，請輸入回覆內容'
      };
    }

    var lock = LockService.getScriptLock();

    if (!lock.tryLock(30000)) {
      return {
        success: false,
        code: 'REQUEST_BUSY',
        message: '系統正在處理其他資料，請稍後再試'
      };
    }

    try {
      var sheet = lmEnsureTenantMessageSheet_();
      var target = lmFindOwnedRow_(
        sheet,
        'message_id',
        messageId,
        landlordLineUserId
      );

      if (!target) {
        return {
          success: false,
          code: 'MESSAGE_NOT_FOUND',
          message: '找不到指定訊息，或此訊息不屬於目前房東'
        };
      }

      var record = target.object;
      var now = new Date();
      var updates = {
        status: status,
        updated_at: now
      };

      if (landlordReply) {
        updates.landlord_reply = landlordReply;
        updates.replied_at = now;
      }

      if (['completed', 'closed', 'rejected'].indexOf(status) !== -1) {
        updates.closed_at = now;
      } else {
        updates.closed_at = '';
      }

      lmUpdateRow_(sheet, target.rowIndex, updates);
      SpreadsheetApp.flush();

      var pushResult = {
        success: false,
        code: 'NO_REPLY_TO_SEND',
        message: '沒有需要傳送的回覆'
      };

      if (landlordReply) {
        var replyText = lmBuildLandlordReplyText_({
          tenant_name: record.tenant_name,
          room_name: record.room_name,
          message_title: record.message_title,
          landlord_reply: landlordReply,
          status: status
        });

        pushResult = lmPushText_(
          lmText_(record.tenant_line_user_id),
          replyText
        );

        lmLogLine_({
          direction: 'outgoing',
          source: 'landlord_message_reply',
          landlord_line_user_id: landlordLineUserId,
          tenant_line_user_id: record.tenant_line_user_id || '',
          tenant_id: record.tenant_id || '',
          tenant_user_id: record.tenant_user_id || '',
          tenant_name: record.tenant_name || '',
          room_list: record.room_name || '',
          message_type: 'landlord_message_reply',
          message_text: replyText,
          status: pushResult.success ? 'success' : 'failed',
          note: pushResult.success
            ? 'landlord reply sent to tenant'
            : pushResult.message
        });
      }

      lmLogAccess_({
        lineUserId: landlordLineUserId,
        userId: '',
        role: 'landlord',
        action: action,
        targetId: messageId,
        result: 'success',
        errorMessage: '',
        notes: 'status=' + status + ', reply=' + (landlordReply ? 'yes' : 'no')
      });

      return {
        success: true,
        code: 'OK',
        message: landlordReply
          ? (
              pushResult.success
                ? '訊息已更新，回覆已傳送給房客'
                : '訊息已更新，但 LINE 回覆傳送失敗'
            )
          : '訊息狀態已更新',
        data: {
          message_id: messageId,
          status: status,
          landlord_reply: landlordReply || record.landlord_reply || '',
          tenant_notification_success: landlordReply
            ? pushResult.success === true
            : null,
          updated_at: now
        }
      };

    } finally {
      try {
        lock.releaseLock();
      } catch (ignore) {}
    }

  } catch (error) {
    lmLogAccess_({
      lineUserId: landlordLineUserId || '',
      userId: '',
      role: 'landlord',
      action: action,
      targetId: messageId || '',
      result: 'failed',
      errorMessage: error.message
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message
    };
  }
}


// ==================================================
// 工作表與資料工具
// ==================================================

function lmResolveLandlord_(landlordLineUserId) {
  landlordLineUserId = lmText_(landlordLineUserId);

  var candidateSheets = [
    LM_SHEETS_.landlordTenantListView,
    LM_SHEETS_.landlordHomeView,
    LM_SHEETS_.landlords
  ];

  for (var s = 0; s < candidateSheets.length; s++) {
    var sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(candidateSheets[s]);

    if (!sheet || sheet.getLastRow() < 2) {
      continue;
    }

    var rows = lmSheetObjects_(sheet);

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rowLineUid = lmText_(
        row.line_user_id ||
        row.landlord_line_user_id
      );

      if (rowLineUid === landlordLineUserId) {
        return {
          landlord_id: row.landlord_id || '',
          landlord_user_id:
            row.landlord_user_id ||
            row.user_id || '',
          landlord_line_user_id: landlordLineUserId,
          landlord_name:
            row.landlord_name ||
            row.owner_name ||
            row.name || ''
        };
      }
    }
  }

  return null;
}


function lmEnsurePaymentReportSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LM_SHEETS_.paymentReports);
  var headers = [
    'report_id',
    'created_at',
    'updated_at',
    'landlord_id',
    'landlord_line_user_id',
    'tenant_id',
    'tenant_user_id',
    'tenant_line_user_id',
    'tenant_name',
    'room_id',
    'room_name',
    'bill_id',
    'bill_month',
    'bill_total_amount',
    'reported_amount',
    'reported_last5',
    'reported_paid_date',
    'status',
    'matched_payment_id',
    'confirmed_at',
    'confirmed_by',
    'rejected_at',
    'reject_reason',
    'voided_at',
    'voided_by',
    'void_reason',
    'reversal_id',
    'note'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(LM_SHEETS_.paymentReports);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  lmEnsureHeaders_(sheet, headers);
  return sheet;
}


function lmEnsureTenantMessageSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LM_SHEETS_.tenantMessages);
  var headers = [
    'message_id',
    'created_at',
    'updated_at',
    'landlord_id',
    'landlord_line_user_id',
    'tenant_id',
    'tenant_user_id',
    'tenant_line_user_id',
    'tenant_name',
    'room_id',
    'room_name',
    'message_category',
    'message_title',
    'message_body',
    'priority',
    'preferred_contact_time',
    'status',
    'landlord_reply',
    'replied_at',
    'closed_at',
    'note'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(LM_SHEETS_.tenantMessages);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  lmEnsureHeaders_(sheet, headers);
  return sheet;
}


function lmEnsureHeaders_(sheet, requiredHeaders) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var currentHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function (header) {
      return lmText_(header);
    });

  if (currentHeaders.every(function (header) { return header === ''; })) {
    sheet
      .getRange(1, 1, 1, requiredHeaders.length)
      .setValues([requiredHeaders]);
    return;
  }

  requiredHeaders.forEach(function (header) {
    if (currentHeaders.indexOf(header) === -1) {
      var newColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, newColumn).setValue(header);
      currentHeaders.push(header);
    }
  });
}


function lmSheetObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (header) {
    return lmText_(header);
  });

  return values.slice(1).map(function (row) {
    var object = {};

    headers.forEach(function (header, index) {
      if (header) {
        object[header] = row[index];
      }
    });

    return object;
  });
}


function lmFindOwnedRow_(
  sheet,
  idHeader,
  expectedId,
  landlordLineUserId
) {
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (header) {
    return lmText_(header);
  });
  var map = lmHeaderMap_(headers);
  var landlord = lmResolveLandlord_(landlordLineUserId);
  var landlordId = landlord ? lmText_(landlord.landlord_id) : '';

  if (map[idHeader] === undefined) {
    return null;
  }

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowId = lmText_(row[map[idHeader]]);

    if (rowId !== expectedId) {
      continue;
    }

    var rowLineUid = map.landlord_line_user_id !== undefined
      ? lmText_(row[map.landlord_line_user_id])
      : '';

    var rowLandlordId = map.landlord_id !== undefined
      ? lmText_(row[map.landlord_id])
      : '';

    var owned =
      rowLineUid === landlordLineUserId ||
      (!!landlordId && rowLandlordId === landlordId);

    if (!owned) {
      return null;
    }

    var object = {};
    headers.forEach(function (header, index) {
      if (header) {
        object[header] = row[index];
      }
    });

    return {
      rowIndex: i + 1,
      object: object
    };
  }

  return null;
}


function lmUpdateRow_(sheet, rowIndex, updates) {
  var headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function (header) {
      return lmText_(header);
    });

  Object.keys(updates).forEach(function (header) {
    var columnIndex = headers.indexOf(header);

    if (columnIndex >= 0) {
      sheet
        .getRange(rowIndex, columnIndex + 1)
        .setValue(updates[header]);
    }
  });
}


function lmHeaderMap_(headers) {
  var map = {};

  headers.forEach(function (header, index) {
    if (header) {
      map[header] = index;
    }
  });

  return map;
}


// ==================================================
// 排序、文字與通知工具
// ==================================================

function lmPaymentReportSort_(a, b) {
  var order = {
    pending: 1,
    payment_reported: 1,
    confirmed: 2,
    rejected: 3,
    voided: 4,
    void: 4
  };

  var statusA = order[lmText_(a.status).toLowerCase()] || 99;
  var statusB = order[lmText_(b.status).toLowerCase()] || 99;

  if (statusA !== statusB) {
    return statusA - statusB;
  }

  return lmDateNumber_(b.created_at) - lmDateNumber_(a.created_at);
}


function lmTenantMessageSort_(a, b) {
  var priorityA = lmText_(a.priority).toLowerCase() === 'urgent' ? 0 : 1;
  var priorityB = lmText_(b.priority).toLowerCase() === 'urgent' ? 0 : 1;

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  var order = {
    pending: 1,
    processing: 2,
    replied: 3,
    completed: 4,
    closed: 5,
    rejected: 6
  };

  var statusA = order[lmText_(a.status).toLowerCase()] || 99;
  var statusB = order[lmText_(b.status).toLowerCase()] || 99;

  if (statusA !== statusB) {
    return statusA - statusB;
  }

  return lmDateNumber_(b.created_at) - lmDateNumber_(a.created_at);
}


function lmCountStatus_(items, statuses) {
  return items.filter(function (item) {
    return statuses.indexOf(lmText_(item.status).toLowerCase()) !== -1;
  }).length;
}


function lmDateNumber_(value) {
  var time = new Date(value).getTime();
  return isNaN(time) ? 0 : time;
}


function lmText_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}


function lmAppendNote_(originalNote, newNote) {
  originalNote = lmText_(originalNote);
  newNote = lmText_(newNote);

  if (!newNote) {
    return originalNote;
  }

  if (originalNote.indexOf(newNote) !== -1) {
    return originalNote;
  }

  return originalNote
    ? originalNote + '｜' + newNote
    : newNote;
}


function lmBuildPaymentRejectNotice_(data) {
  return [
    '【CMWebs 付款回報未通過】',
    '',
    (data.tenant_name || '房客') + ' 您好：',
    '',
    '房號：' + (data.room_name || '-'),
    '帳單月份：' + (data.bill_month || '-'),
    '回報金額：NT$ ' + Math.round(Number(data.reported_amount || 0)).toLocaleString('zh-TW'),
    '匯款後 5 碼：' + (data.reported_last5 || '-'),
    '',
    '此次付款回報未通過。',
    '原因：' + (data.reject_reason || '-'),
    '',
    '請重新確認付款資料；如有疑問，請直接聯絡房東。'
  ].join('\n');
}


function lmBuildLandlordReplyText_(data) {
  var statusMap = {
    pending: '待處理',
    processing: '處理中',
    replied: '已回覆',
    completed: '已完成',
    closed: '已結案',
    rejected: '已駁回'
  };

  var statusText =
    statusMap[lmText_(data.status).toLowerCase()] ||
    data.status ||
    '-';

  return [
    '【CMWebs 房東回覆】',
    '',
    (data.tenant_name || '房客') + ' 您好：',
    '',
    '房號：' + (data.room_name || '-'),
    '原訊息：' + (data.message_title || '-'),
    '處理狀態：' + statusText,
    '',
    data.landlord_reply || '-'
  ].join('\n');
}


function lmPushText_(lineUserId, text) {
  lineUserId = lmText_(lineUserId);

  if (!lineUserId) {
    return {
      success: false,
      code: 'LINE_UID_EMPTY',
      message: '房客尚未綁定 LINE'
    };
  }

  if (typeof pushLineTextMessage_ !== 'function') {
    return {
      success: false,
      code: 'LINE_PUSH_FUNCTION_NOT_FOUND',
      message: '找不到 LINE 推播函式'
    };
  }

  return pushLineTextMessage_(lineUserId, text);
}


function lmLogAccess_(data) {
  try {
    if (typeof logLiffAccess_ === 'function') {
      logLiffAccess_(data);
    }
  } catch (ignore) {}
}


function lmLogLine_(data) {
  try {
    if (typeof cmwebsLogLineMessage_ === 'function') {
      cmwebsLogLineMessage_(data);
    }
  } catch (ignore) {}
}


// ==================================================
// 安裝與測試
// ==================================================

/**
 * 執行一次，建立或補齊管理頁所需工作表欄位。
 * 不會修改既有資料狀態。
 */
function testEnsureLandlordManagementSheets() {
  var paymentReportSheet = lmEnsurePaymentReportSheet_();
  var tenantMessageSheet = lmEnsureTenantMessageSheet_();

  Logger.log(JSON.stringify({
    success: true,
    payment_report_sheet: paymentReportSheet.getName(),
    tenant_message_sheet: tenantMessageSheet.getName()
  }, null, 2));
}


/**
 * 測試六個管理函式是否存在，並實際測試兩個初始化 API。
 */
function testLandlordManagementBackend() {
  var landlordLineUserId = getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID');

  var availability = {
    getLandlordPaymentReportsInitByLineUid:
      typeof getLandlordPaymentReportsInitByLineUid,
    getLandlordPaymentReports_:
      typeof getLandlordPaymentReports_,
    updateLandlordPaymentReportByLineUid_:
      typeof updateLandlordPaymentReportByLineUid_,
    getLandlordMessagesInitByLineUid:
      typeof getLandlordMessagesInitByLineUid,
    getLandlordTenantMessages_:
      typeof getLandlordTenantMessages_,
    updateLandlordTenantMessageByLineUid_:
      typeof updateLandlordTenantMessageByLineUid_
  };

  var result = {
    availability: availability,
    payment_reports: getLandlordPaymentReportsInitByLineUid(
      landlordLineUserId
    ),
    messages: getLandlordMessagesInitByLineUid(
      landlordLineUserId
    )
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
