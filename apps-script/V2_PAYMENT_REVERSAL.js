// ==================================================
// CMWebs V2 Payment Reversal
// 撤銷已繳、作廢付款、恢復欠款
// ==================================================

const PAYMENT_REVERSAL_BILLS_SHEET =
  'V2_bills';

const PAYMENT_REVERSAL_PAYMENTS_SHEET =
  'V2_payments';

const PAYMENT_REVERSAL_REPORTS_SHEET =
  'V2_payment_reports';

const PAYMENT_REVERSAL_TENANT_LIST_VIEW =
  'V2_landlord_tenant_list_view';

const PAYMENT_REVERSAL_LANDLORD_HOME_VIEW =
  'V2_landlord_home_view';

const PAYMENT_REVERSAL_TENANTS_SHEET =
  'V2_tenants';

const PAYMENT_REVERSAL_LANDLORDS_SHEET =
  'V2_landlords';

const PAYMENT_REVERSAL_PROPERTIES_SHEET =
  'V2_properties';

const PAYMENT_REVERSAL_LEGACY_MONTHLY_SHEET =
  '1.每月帳單表';

const PAYMENT_REVERSAL_LEGACY_HISTORY_SHEET =
  '3.歷史帳單總表';

const PAYMENT_REVERSAL_AUDIT_SHEET =
  'V2_payment_reversal_logs';


// ==================================================
// 主函式
// ==================================================

/**
 * 房東撤銷帳單已繳狀態，恢復為欠款
 *
 * 預計路由：
 * v2_action=landlord_bill_reopen
 *
 * @param {string} landlordLineUserId 房東 LINE UID
 * @param {string} billId 帳單 ID
 * @param {string} reversalReason 撤銷原因
 * @param {boolean|string} notifyTenant 是否通知房客
 */
function reopenLandlordBillByLineUid_(
  landlordLineUserId,
  billId,
  reversalReason,
  notifyTenant
) {
  const action =
    'landlord_bill_reopen';

  const lock =
    LockService.getScriptLock();

  let reversalId = '';

  try {
    landlordLineUserId =
      paymentReversalText_(
        landlordLineUserId
      );

    billId =
      paymentReversalText_(
        billId
      );

    reversalReason =
      paymentReversalText_(
        reversalReason
      );

    const shouldNotifyTenant =
      paymentReversalBoolean_(
        notifyTenant,
        true
      );

    if (!landlordLineUserId) {
      return {
        success: false,
        code:
          'MISSING_LANDLORD_LINE_UID',
        message:
          '缺少房東 LINE UID'
      };
    }

    if (!billId) {
      return {
        success: false,
        code:
          'MISSING_BILL_ID',
        message:
          '缺少帳單 ID'
      };
    }

    if (!reversalReason) {
      return {
        success: false,
        code:
          'MISSING_REVERSAL_REASON',
        message:
          '請填寫撤銷銷帳原因'
      };
    }

    if (reversalReason.length < 3) {
      return {
        success: false,
        code:
          'REVERSAL_REASON_TOO_SHORT',
        message:
          '撤銷原因至少需要 3 個字'
      };
    }

    if (reversalReason.length > 300) {
      return {
        success: false,
        code:
          'REVERSAL_REASON_TOO_LONG',
        message:
          '撤銷原因最多 300 字'
      };
    }

    if (!lock.tryLock(30000)) {
      return {
        success: false,
        code:
          'REQUEST_BUSY',
        message:
          '系統正在處理其他帳務，請稍後再試'
      };
    }

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const billSheet =
      paymentReversalEnsureBillSheet_(
        ss
      );

    const paymentSheet =
      paymentReversalEnsurePaymentSheet_(
        ss
      );

    const reportSheet =
      paymentReversalEnsureReportSheet_(
        ss
      );

    paymentReversalEnsureAuditSheet_(
      ss
    );

    const landlord =
      paymentReversalResolveLandlord_(
        ss,
        landlordLineUserId
      );

    if (!landlord) {
      return {
        success: false,
        code:
          'LANDLORD_NOT_FOUND',
        message:
          '查無房東資料或尚未完成綁定'
      };
    }

    const billData =
      paymentReversalFindRowByHeader_(
        billSheet,
        'bill_id',
        billId
      );

    if (!billData) {
      return {
        success: false,
        code:
          'BILL_NOT_FOUND',
        message:
          '找不到指定帳單'
      };
    }

    const bill =
      billData.object;

    const billLandlordId =
      paymentReversalText_(
        bill.landlord_id
      );

    if (
      billLandlordId &&
      landlord.landlord_id &&
      billLandlordId !==
        landlord.landlord_id
    ) {
      return {
        success: false,
        code:
          'BILL_NOT_OWNED_BY_LANDLORD',
        message:
          '此帳單不屬於目前房東'
      };
    }

    const activePayments =
      paymentReversalFindActivePayments_(
        paymentSheet,
        billId
      );

    const currentPaymentStatus =
      paymentReversalText_(
        bill.payment_status
      ).toLowerCase();

    const currentPaymentId =
      paymentReversalText_(
        bill.payment_id
      );

    /*
     * 帳單已經是 unpaid，且沒有任何有效付款紀錄，
     * 視為已完成恢復欠款，採冪等回傳。
     */
    if (
      currentPaymentStatus === 'unpaid' &&
      activePayments.length === 0 &&
      !currentPaymentId
    ) {
      return {
        success: true,
        code:
          'ALREADY_REOPENED',
        message:
          '此帳單目前已是未繳狀態',

        data: {
          bill_id:
            billId,

          payment_status:
            'unpaid',

          voided_payment_count:
            0,

          voided_report_count:
            0,

          tenant_notification_success:
            null
        }
      };
    }

    const now =
      new Date();

    reversalId =
      paymentReversalMakeId_();

    const voidedPaymentIds = [];

    /*
     * 所有屬於此帳單的有效付款紀錄都標記為 void。
     * 不刪除原始付款資料，保留帳務稽核軌跡。
     */
    activePayments.forEach(
      function (paymentData) {
        const payment =
          paymentData.object;

        const paymentId =
          paymentReversalText_(
            payment.payment_id
          );

        if (paymentId) {
          voidedPaymentIds.push(
            paymentId
          );
        }

        paymentReversalUpdateRowByObject_(
          paymentSheet,
          paymentData.rowIndex,
          {
            status:
              'void',

            voided_at:
              now,

            voided_by:
              landlordLineUserId,

            void_reason:
              reversalReason,

            reversal_id:
              reversalId,

            updated_at:
              now,

            note:
              paymentReversalAppendNote_(
                payment.note || '',
                '撤銷銷帳：' +
                reversalReason +
                '／撤銷ID：' +
                reversalId
              )
          }
        );
      }
    );

    /*
     * 將帳單恢復為未繳。
     */
    paymentReversalUpdateRowByObject_(
      billSheet,
      billData.rowIndex,
      {
        payment_status:
          'unpaid',

        paid_at:
          '',

        payment_id:
          '',

        reopened_at:
          now,

        reopened_by:
          landlordLineUserId,

        reopen_reason:
          reversalReason,

        reversal_id:
          reversalId,

        updated_at:
          now,

        notes:
          paymentReversalAppendNote_(
            bill.notes || '',
            '撤銷銷帳並恢復未繳：' +
            reversalReason +
            '／撤銷ID：' +
            reversalId
          )
      }
    );

    /*
     * 將此帳單相關付款回報標記為 voided。
     * matched_payment_id 保留，不清除，確保能追查原付款紀錄。
     */
    const voidedReportResult =
      paymentReversalVoidReports_(
        reportSheet,
        billId,
        voidedPaymentIds,
        landlordLineUserId,
        reversalReason,
        reversalId,
        now
      );

    /*
     * 同步回 V1：
     * - 1.每月帳單表
     * - 3.歷史帳單總表
     */
    const legacySyncResult =
      paymentReversalSyncLegacy_(
        ss,
        bill,
        reversalReason,
        reversalId
      );

    SpreadsheetApp.flush();

    const tenant =
      paymentReversalResolveTenant_(
        ss,
        landlordLineUserId,
        bill
      );

    const tenantLineUserId =
      paymentReversalText_(
        tenant
          ? tenant
              .tenant_line_user_id
          : ''
      );

    const noticeText =
      paymentReversalBuildTenantNotice_({
        tenant_name:
          tenant &&
          tenant.tenant_name
            ? tenant.tenant_name
            : bill.tenant_name || '',

        room_name:
          bill.room_name || '',

        bill_month:
          bill.bill_month || '',

        amount:
          Number(
            bill.total_amount || 0
          ),

        reason:
          reversalReason,

        reversal_id:
          reversalId
      });

    let notificationResult = {
      requested:
        shouldNotifyTenant,

      success:
        false,

      code:
        shouldNotifyTenant
          ? 'TENANT_LINE_UID_EMPTY'
          : 'NOT_REQUESTED',

      message:
        shouldNotifyTenant
          ? '房客尚未綁定 LINE'
          : '未要求通知房客'
    };

    if (
      shouldNotifyTenant &&
      tenantLineUserId
    ) {
      if (
        typeof pushLineTextMessage_ ===
        'function'
      ) {
        const pushResult =
          pushLineTextMessage_(
            tenantLineUserId,
            noticeText
          );

        notificationResult = {
          requested:
            true,

          success:
            pushResult &&
            pushResult.success === true,

          code:
            pushResult &&
            pushResult.code
              ? pushResult.code
              : '',

          message:
            pushResult &&
            pushResult.message
              ? pushResult.message
              : ''
        };
      } else {
        notificationResult = {
          requested:
            true,

          success:
            false,

          code:
            'LINE_PUSH_FUNCTION_NOT_FOUND',

          message:
            '找不到 LINE 推播函式'
        };
      }

      if (
        typeof cmwebsLogLineMessage_ ===
        'function'
      ) {
        cmwebsLogLineMessage_({
          direction:
            'outgoing',

          source:
            'payment_reversal',

          landlord_line_user_id:
            landlordLineUserId,

          tenant_line_user_id:
            tenantLineUserId,

          tenant_id:
            bill.tenant_id || '',

          tenant_user_id:
            bill.user_id || '',

          tenant_name:
            tenant &&
            tenant.tenant_name
              ? tenant.tenant_name
              : bill.tenant_name || '',

          room_list:
            bill.room_name || '',

          message_type:
            'payment_settlement_voided',

          message_text:
            noticeText,

          status:
            notificationResult.success
              ? 'success'
              : 'failed',

          note:
            notificationResult.success
              ? 'payment reversal notice sent'
              : notificationResult.message
        });
      }
    }

    paymentReversalWriteAuditLog_(
      ss,
      {
        reversal_id:
          reversalId,

        action:
          action,

        landlord_line_user_id:
          landlordLineUserId,

        landlord_id:
          bill.landlord_id || '',

        bill_id:
          billId,

        bill_month:
          bill.bill_month || '',

        tenant_id:
          bill.tenant_id || '',

        tenant_name:
          tenant &&
          tenant.tenant_name
            ? tenant.tenant_name
            : bill.tenant_name || '',

        room_name:
          bill.room_name || '',

        amount:
          Number(
            bill.total_amount || 0
          ),

        voided_payment_ids:
          voidedPaymentIds.join(','),

        voided_payment_count:
          voidedPaymentIds.length,

        voided_report_count:
          voidedReportResult
            .voided_count,

        reversal_reason:
          reversalReason,

        notify_tenant:
          shouldNotifyTenant,

        notification_status:
          shouldNotifyTenant
            ? (
                notificationResult.success
                  ? 'success'
                  : 'failed'
              )
            : 'not_requested',

        legacy_monthly_status:
          legacySyncResult
            .monthly.status,

        legacy_history_status:
          legacySyncResult
            .history.status,

        result:
          'success',

        error_message:
          '',

        note:
          ''
      }
    );

    if (
      typeof logLiffAccess_ ===
      'function'
    ) {
      logLiffAccess_({
        lineUserId:
          landlordLineUserId,

        userId:
          landlord.user_id || '',

        role:
          'landlord',

        action:
          action,

        targetId:
          billId,

        result:
          'success',

        errorMessage:
          '',

        notes:
          [
            'reversal_id=' +
              reversalId,

            'voided_payments=' +
              voidedPaymentIds.length,

            'voided_reports=' +
              voidedReportResult
                .voided_count,

            'legacy_monthly=' +
              legacySyncResult
                .monthly.status,

            'legacy_history=' +
              legacySyncResult
                .history.status
          ].join(', ')
      });
    }

    let message =
      '已撤銷銷帳，帳單已恢復為未繳';

    if (shouldNotifyTenant) {
      message +=
        notificationResult.success
          ? '，房客已收到 LINE 通知'
          : '，但房客 LINE 通知未成功';
    }

    if (
      legacySyncResult.monthly.status !==
        'updated' ||
      legacySyncResult.history.status !==
        'updated'
    ) {
      message +=
        '。V1 同步未完全成功，請查看撤銷紀錄';
    }

    return {
      success: true,
      code:
        'OK',
      message:
        message,

      data: {
        reversal_id:
          reversalId,

        bill_id:
          billId,

        payment_status:
          'unpaid',

        voided_payment_ids:
          voidedPaymentIds,

        voided_payment_count:
          voidedPaymentIds.length,

        voided_report_count:
          voidedReportResult
            .voided_count,

        reversal_reason:
          reversalReason,

        tenant_notification_success:
          shouldNotifyTenant
            ? notificationResult.success
            : null,

        legacy_sync: {
          monthly:
            legacySyncResult.monthly,

          history:
            legacySyncResult.history
        }
      }
    };

  } catch (error) {
    try {
      const ss =
        SpreadsheetApp
          .getActiveSpreadsheet();

      paymentReversalWriteAuditLog_(
        ss,
        {
          reversal_id:
            reversalId || '',

          action:
            action,

          landlord_line_user_id:
            landlordLineUserId || '',

          landlord_id:
            '',

          bill_id:
            billId || '',

          bill_month:
            '',

          tenant_id:
            '',

          tenant_name:
            '',

          room_name:
            '',

          amount:
            0,

          voided_payment_ids:
            '',

          voided_payment_count:
            0,

          voided_report_count:
            0,

          reversal_reason:
            reversalReason || '',

          notify_tenant:
            paymentReversalBoolean_(
              notifyTenant,
              true
            ),

          notification_status:
            'not_sent',

          legacy_monthly_status:
            'not_processed',

          legacy_history_status:
            'not_processed',

          result:
            'failed',

          error_message:
            error.message,

          note:
            ''
        }
      );
    } catch (auditError) {
      // 稽核紀錄失敗不覆蓋主錯誤
    }

    try {
      if (
        typeof logLiffAccess_ ===
        'function'
      ) {
        logLiffAccess_({
          lineUserId:
            landlordLineUserId || '',

          userId:
            '',

          role:
            'landlord',

          action:
            action,

          targetId:
            billId || '',

          result:
            'failed',

          errorMessage:
            error.message
        });
      }
    } catch (logError) {
      // 忽略存取紀錄錯誤
    }

    return {
      success: false,
      code:
        'PAYMENT_REVERSAL_ERROR',
      message:
        '撤銷銷帳失敗：' +
        error.message
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      // 未取得鎖定時忽略
    }
  }
}


// ==================================================
// V2 工作表
// ==================================================

function paymentReversalEnsureBillSheet_(
  ss
) {
  const sheet =
    ss.getSheetByName(
      PAYMENT_REVERSAL_BILLS_SHEET
    );

  if (!sheet) {
    throw new Error(
      '找不到工作表：' +
      PAYMENT_REVERSAL_BILLS_SHEET
    );
  }

  paymentReversalEnsureHeaders_(
    sheet,
    [
      'bill_id',
      'bill_month',
      'contract_id',
      'tenant_id',
      'user_id',
      'room_id',
      'property_id',
      'landlord_id',
      'room_name',
      'tenant_name',
      'total_amount',
      'bill_status',
      'payment_status',
      'paid_at',
      'payment_id',
      'reopened_at',
      'reopened_by',
      'reopen_reason',
      'reversal_id',
      'updated_at',
      'legacy_source',
      'legacy_ref',
      'notes'
    ]
  );

  return sheet;
}


function paymentReversalEnsurePaymentSheet_(
  ss
) {
  let sheet =
    ss.getSheetByName(
      PAYMENT_REVERSAL_PAYMENTS_SHEET
    );

  const headers = [
    'payment_id',
    'created_at',
    'updated_at',
    'landlord_id',
    'property_id',
    'room_id',
    'contract_id',
    'tenant_id',
    'user_id',
    'bill_id',
    'bill_month',
    'payment_date',
    'amount',
    'payment_method',
    'bank_last5',
    'status',
    'source',
    'source_ref_id',
    'confirmation_source',
    'confirmed_by',
    'voided_at',
    'voided_by',
    'void_reason',
    'reversal_id',
    'note'
  ];

  if (!sheet) {
    sheet =
      ss.insertSheet(
        PAYMENT_REVERSAL_PAYMENTS_SHEET
      );

    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([
        headers
      ]);

    return sheet;
  }

  paymentReversalEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


function paymentReversalEnsureReportSheet_(
  ss
) {
  let sheet =
    ss.getSheetByName(
      PAYMENT_REVERSAL_REPORTS_SHEET
    );

  const headers = [
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
    sheet =
      ss.insertSheet(
        PAYMENT_REVERSAL_REPORTS_SHEET
      );

    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([
        headers
      ]);

    return sheet;
  }

  paymentReversalEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


function paymentReversalEnsureAuditSheet_(
  ss
) {
  let sheet =
    ss.getSheetByName(
      PAYMENT_REVERSAL_AUDIT_SHEET
    );

  const headers = [
    'created_at',
    'reversal_id',
    'action',
    'landlord_line_user_id',
    'landlord_id',
    'bill_id',
    'bill_month',
    'tenant_id',
    'tenant_name',
    'room_name',
    'amount',
    'voided_payment_ids',
    'voided_payment_count',
    'voided_report_count',
    'reversal_reason',
    'notify_tenant',
    'notification_status',
    'legacy_monthly_status',
    'legacy_history_status',
    'result',
    'error_message',
    'note'
  ];

  if (!sheet) {
    sheet =
      ss.insertSheet(
        PAYMENT_REVERSAL_AUDIT_SHEET
      );

    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([
        headers
      ]);

    return sheet;
  }

  paymentReversalEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


function paymentReversalEnsureHeaders_(
  sheet,
  requiredHeaders
) {
  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  let headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(function (header) {
        return paymentReversalText_(
          header
        );
      });

  const allEmpty =
    headers.every(
      function (header) {
        return header === '';
      }
    );

  if (allEmpty) {
    sheet
      .getRange(
        1,
        1,
        1,
        requiredHeaders.length
      )
      .setValues([
        requiredHeaders
      ]);

    return;
  }

  requiredHeaders.forEach(
    function (header) {
      if (
        headers.indexOf(
          header
        ) === -1
      ) {
        const newColumn =
          sheet.getLastColumn() + 1;

        sheet
          .getRange(
            1,
            newColumn
          )
          .setValue(
            header
          );

        headers.push(
          header
        );
      }
    }
  );
}


// ==================================================
// 權限與房客資料
// ==================================================

function paymentReversalResolveLandlord_(
  ss,
  landlordLineUserId
) {
  const candidateSheets = [
    PAYMENT_REVERSAL_TENANT_LIST_VIEW,
    PAYMENT_REVERSAL_LANDLORD_HOME_VIEW,
    PAYMENT_REVERSAL_LANDLORDS_SHEET
  ];

  for (
    let sheetIndex = 0;
    sheetIndex <
      candidateSheets.length;
    sheetIndex++
  ) {
    const sheet =
      ss.getSheetByName(
        candidateSheets[
          sheetIndex
        ]
      );

    if (
      !sheet ||
      sheet.getLastRow() < 2
    ) {
      continue;
    }

    const rows =
      paymentReversalGetObjects_(
        sheet
      );

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row =
        rows[index];

      const rowLineUserId =
        paymentReversalText_(
          row.line_user_id ||
          row.landlord_line_user_id
        );

      if (
        rowLineUserId ===
        landlordLineUserId
      ) {
        return {
          landlord_id:
            paymentReversalText_(
              row.landlord_id
            ),

          user_id:
            paymentReversalText_(
              row.landlord_user_id ||
              row.user_id
            ),

          landlord_name:
            paymentReversalText_(
              row.landlord_name ||
              row.owner_name
            )
        };
      }
    }
  }

  return null;
}


function paymentReversalResolveTenant_(
  ss,
  landlordLineUserId,
  bill
) {
  const tenantId =
    paymentReversalText_(
      bill.tenant_id
    );

  const tenantUserId =
    paymentReversalText_(
      bill.user_id
    );

  const listSheet =
    ss.getSheetByName(
      PAYMENT_REVERSAL_TENANT_LIST_VIEW
    );

  if (
    listSheet &&
    listSheet.getLastRow() >= 2
  ) {
    const rows =
      paymentReversalGetObjects_(
        listSheet
      );

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row =
        rows[index];

      const rowLandlordLineUserId =
        paymentReversalText_(
          row.line_user_id ||
          row.landlord_line_user_id
        );

      if (
        rowLandlordLineUserId !==
        landlordLineUserId
      ) {
        continue;
      }

      const sameTenant =
        (
          tenantId &&
          paymentReversalText_(
            row.tenant_id
          ) === tenantId
        ) ||
        (
          tenantUserId &&
          paymentReversalText_(
            row.tenant_user_id ||
            row.user_id
          ) === tenantUserId
        );

      if (!sameTenant) {
        continue;
      }

      return {
        tenant_id:
          paymentReversalText_(
            row.tenant_id
          ),

        tenant_user_id:
          paymentReversalText_(
            row.tenant_user_id ||
            row.user_id
          ),

        tenant_line_user_id:
          paymentReversalText_(
            row.tenant_line_user_id
          ),

        tenant_name:
          paymentReversalText_(
            row.tenant_name
          ),

        room_list:
          paymentReversalText_(
            row.room_list
          )
      };
    }
  }

  const tenantSheet =
    ss.getSheetByName(
      PAYMENT_REVERSAL_TENANTS_SHEET
    );

  if (
    tenantSheet &&
    tenantSheet.getLastRow() >= 2
  ) {
    const rows =
      paymentReversalGetObjects_(
        tenantSheet
      );

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row =
        rows[index];

      const sameTenant =
        (
          tenantId &&
          paymentReversalText_(
            row.tenant_id
          ) === tenantId
        ) ||
        (
          tenantUserId &&
          paymentReversalText_(
            row.user_id ||
            row.tenant_user_id
          ) === tenantUserId
        );

      if (!sameTenant) {
        continue;
      }

      return {
        tenant_id:
          tenantId,

        tenant_user_id:
          tenantUserId,

        tenant_line_user_id:
          paymentReversalText_(
            row.line_user_id ||
            row.tenant_line_user_id
          ),

        tenant_name:
          paymentReversalText_(
            row.tenant_name ||
            row.name
          ),

        room_list:
          paymentReversalText_(
            bill.room_name
          )
      };
    }
  }

  return {
    tenant_id:
      tenantId,

    tenant_user_id:
      tenantUserId,

    tenant_line_user_id:
      '',

    tenant_name:
      paymentReversalText_(
        bill.tenant_name
      ),

    room_list:
      paymentReversalText_(
        bill.room_name
      )
  };
}


// ==================================================
// 付款與付款回報作廢
// ==================================================

function paymentReversalFindActivePayments_(
  paymentSheet,
  billId
) {
  if (
    !paymentSheet ||
    paymentSheet.getLastRow() < 2
  ) {
    return [];
  }

  const values =
    paymentSheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      function (header) {
        return paymentReversalText_(
          header
        );
      }
    );

  const billIdIndex =
    headers.indexOf(
      'bill_id'
    );

  const statusIndex =
    headers.indexOf(
      'status'
    );

  if (billIdIndex < 0) {
    return [];
  }

  const results = [];

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    const row =
      values[index];

    if (
      paymentReversalText_(
        row[billIdIndex]
      ) !== billId
    ) {
      continue;
    }

    const status =
      statusIndex >= 0
        ? paymentReversalText_(
            row[statusIndex]
          ).toLowerCase()
        : '';

    if (
      status === 'void' ||
      status === 'cancelled' ||
      status === 'rejected'
    ) {
      continue;
    }

    const object = {};

    headers.forEach(
      function (
        header,
        columnIndex
      ) {
        if (header) {
          object[header] =
            row[columnIndex];
        }
      }
    );

    results.push({
      rowIndex:
        index + 1,

      object:
        object
    });
  }

  return results;
}


function paymentReversalVoidReports_(
  reportSheet,
  billId,
  voidedPaymentIds,
  landlordLineUserId,
  reversalReason,
  reversalId,
  now
) {
  if (
    !reportSheet ||
    reportSheet.getLastRow() < 2
  ) {
    return {
      voided_count:
        0,

      report_ids:
        []
    };
  }

  const values =
    reportSheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      function (header) {
        return paymentReversalText_(
          header
        );
      }
    );

  const map =
    paymentReversalHeaderMap_(
      headers
    );

  if (
    map.bill_id === undefined
  ) {
    return {
      voided_count:
        0,

      report_ids:
        []
    };
  }

  let voidedCount = 0;
  const reportIds = [];

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    const row =
      values[index];

    const rowBillId =
      paymentReversalText_(
        row[map.bill_id]
      );

    const matchedPaymentId =
      map.matched_payment_id !==
        undefined
        ? paymentReversalText_(
            row[
              map.matched_payment_id
            ]
          )
        : '';

    const related =
      rowBillId === billId ||
      (
        matchedPaymentId &&
        voidedPaymentIds.indexOf(
          matchedPaymentId
        ) !== -1
      );

    if (!related) {
      continue;
    }

    const currentStatus =
      map.status !== undefined
        ? paymentReversalText_(
            row[map.status]
          ).toLowerCase()
        : '';

    if (
      currentStatus ===
        'voided'
    ) {
      continue;
    }

    const reportId =
      map.report_id !== undefined
        ? paymentReversalText_(
            row[map.report_id]
          )
        : '';

    if (reportId) {
      reportIds.push(
        reportId
      );
    }

    const rowObject = {};

    headers.forEach(
      function (
        header,
        columnIndex
      ) {
        if (header) {
          rowObject[header] =
            row[columnIndex];
        }
      }
    );

    paymentReversalUpdateRowByObject_(
      reportSheet,
      index + 1,
      {
        status:
          'voided',

        voided_at:
          now,

        voided_by:
          landlordLineUserId,

        void_reason:
          reversalReason,

        reversal_id:
          reversalId,

        updated_at:
          now,

        note:
          paymentReversalAppendNote_(
            rowObject.note || '',
            '付款銷帳已撤銷：' +
            reversalReason +
            '／撤銷ID：' +
            reversalId
          )
      }
    );

    voidedCount++;
  }

  return {
    voided_count:
      voidedCount,

    report_ids:
      reportIds
  };
}


// ==================================================
// V1 恢復未繳
// ==================================================

function paymentReversalSyncLegacy_(
  ss,
  bill,
  reversalReason,
  reversalId
) {
  const legacyCodes =
    paymentReversalResolveLegacyCodes_(
      ss,
      bill
    );

  return {
    monthly:
      paymentReversalSyncLegacyMonthly_(
        ss,
        bill,
        legacyCodes,
        reversalReason,
        reversalId
      ),

    history:
      paymentReversalSyncLegacyHistory_(
        ss,
        bill,
        legacyCodes,
        reversalReason,
        reversalId
      )
  };
}


function paymentReversalSyncLegacyMonthly_(
  ss,
  bill,
  legacyCodes,
  reversalReason,
  reversalId
) {
  const sheet =
    ss.getSheetByName(
      PAYMENT_REVERSAL_LEGACY_MONTHLY_SHEET
    );

  if (!sheet) {
    return {
      status:
        'sheet_not_found',

      updated_count:
        0,

      message:
        '找不到 1.每月帳單表'
    };
  }

  if (sheet.getLastRow() < 2) {
    return {
      status:
        'no_data',

      updated_count:
        0,

      message:
        '1.每月帳單表沒有資料'
    };
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      function (header) {
        return paymentReversalText_(
          header
        );
      }
    );

  const map =
    paymentReversalHeaderMap_(
      headers
    );

  const roomHeader =
    paymentReversalFindHeader_(
      map,
      [
        '房號'
      ]
    );

  const monthHeader =
    paymentReversalFindHeader_(
      map,
      [
        '帳單年月',
        '帳單月份'
      ]
    );

  if (
    !roomHeader ||
    !monthHeader
  ) {
    return {
      status:
        'missing_headers',

      updated_count:
        0,

      message:
        '1.每月帳單表缺少房號或帳單年月欄位'
    };
  }

  const targetRoom =
    paymentReversalNormalizeRoom_(
      bill.room_name
    );

  const targetBillMonth =
    paymentReversalNormalizeBillMonth_(
      bill.bill_month
    );

  const matches = [];

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    const row =
      values[index];

    const room =
      paymentReversalNormalizeRoom_(
        row[map[roomHeader]]
      );

    if (room !== targetRoom) {
      continue;
    }

    if (
      !paymentReversalLegacyMonthMatches_(
        row[map[monthHeader]],
        targetBillMonth
      )
    ) {
      continue;
    }

    if (
      !paymentReversalLegacyCodeMatches_(
        row,
        map,
        legacyCodes
      )
    ) {
      continue;
    }

    matches.push(
      index + 1
    );
  }

  const narrowed =
    paymentReversalNarrowMatchesByTenant_(
      sheet,
      matches,
      headers,
      bill.tenant_name
    );

  if (narrowed.length === 0) {
    return {
      status:
        'not_found',

      updated_count:
        0,

      message:
        '1.每月帳單表找不到相符帳單'
    };
  }

  if (narrowed.length > 1) {
    return {
      status:
        'ambiguous',

      updated_count:
        0,

      message:
        '1.每月帳單表找到多筆相符資料，已停止同步'
    };
  }

  paymentReversalUpdateLegacyRow_(
    sheet,
    narrowed[0],
    headers,
    reversalReason,
    reversalId
  );

  return {
    status:
      'updated',

    updated_count:
      1,

    row:
      narrowed[0],

    message:
      '1.每月帳單表已恢復未繳'
  };
}


function paymentReversalSyncLegacyHistory_(
  ss,
  bill,
  legacyCodes,
  reversalReason,
  reversalId
) {
  const sheet =
    ss.getSheetByName(
      PAYMENT_REVERSAL_LEGACY_HISTORY_SHEET
    );

  if (!sheet) {
    return {
      status:
        'sheet_not_found',

      updated_count:
        0,

      message:
        '找不到 3.歷史帳單總表'
    };
  }

  if (sheet.getLastRow() < 2) {
    return {
      status:
        'no_data',

      updated_count:
        0,

      message:
        '3.歷史帳單總表沒有資料'
    };
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      function (header) {
        return paymentReversalText_(
          header
        );
      }
    );

  const map =
    paymentReversalHeaderMap_(
      headers
    );

  const yearHeader =
    paymentReversalFindHeader_(
      map,
      [
        '結帳年份',
        '帳單年份'
      ]
    );

  const monthHeader =
    paymentReversalFindHeader_(
      map,
      [
        '結帳月份',
        '帳單月份'
      ]
    );

  const roomHeader =
    paymentReversalFindHeader_(
      map,
      [
        '房號'
      ]
    );

  if (
    !yearHeader ||
    !monthHeader ||
    !roomHeader
  ) {
    return {
      status:
        'missing_headers',

      updated_count:
        0,

      message:
        '3.歷史帳單總表缺少年、月或房號欄位'
    };
  }

  const targetBillMonth =
    paymentReversalNormalizeBillMonth_(
      bill.bill_month
    );

  const parts =
    targetBillMonth.split('-');

  const targetYear =
    parts[0] || '';

  const targetMonth =
    parts[1] || '';

  const targetRoom =
    paymentReversalNormalizeRoom_(
      bill.room_name
    );

  const matches = [];

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    const row =
      values[index];

    const rowYear =
      paymentReversalNormalizeYear_(
        row[map[yearHeader]]
      );

    const rowMonth =
      paymentReversalNormalizeMonth_(
        row[map[monthHeader]]
      );

    const rowRoom =
      paymentReversalNormalizeRoom_(
        row[map[roomHeader]]
      );

    if (
      rowYear !== targetYear ||
      rowMonth !== targetMonth ||
      rowRoom !== targetRoom
    ) {
      continue;
    }

    if (
      !paymentReversalLegacyCodeMatches_(
        row,
        map,
        legacyCodes
      )
    ) {
      continue;
    }

    matches.push(
      index + 1
    );
  }

  const narrowed =
    paymentReversalNarrowMatchesByTenant_(
      sheet,
      matches,
      headers,
      bill.tenant_name
    );

  if (narrowed.length === 0) {
    return {
      status:
        'not_found',

      updated_count:
        0,

      message:
        '3.歷史帳單總表找不到相符帳單'
    };
  }

  if (narrowed.length > 1) {
    return {
      status:
        'ambiguous',

      updated_count:
        0,

      message:
        '3.歷史帳單總表找到多筆相符資料，已停止同步'
    };
  }

  paymentReversalUpdateLegacyRow_(
    sheet,
    narrowed[0],
    headers,
    reversalReason,
    reversalId
  );

  return {
    status:
      'updated',

    updated_count:
      1,

    row:
      narrowed[0],

    message:
      '3.歷史帳單總表已恢復未繳'
  };
}


function paymentReversalUpdateLegacyRow_(
  sheet,
  rowIndex,
  headers,
  reversalReason,
  reversalId
) {
  const updates = {
    '繳費狀態':
      '未繳',

    '付款狀態':
      '未繳',

    '繳款狀態':
      '未繳',

    '催繳狀態':
      '',

    '催繳次數':
      0,

    '上次催繳日期':
      '',

    '付款日期':
      '',

    '繳款日期':
      '',

    '入帳日期':
      '',

    '付款編號':
      '',

    '付款ID':
      '',

    'payment_id':
      '',

    '撤銷原因':
      reversalReason,

    '撤銷ID':
      reversalId
  };

  Object.keys(updates)
    .forEach(
      function (header) {
        const columnIndex =
          headers.indexOf(
            header
          );

        if (columnIndex < 0) {
          return;
        }

        sheet
          .getRange(
            rowIndex,
            columnIndex + 1
          )
          .setValue(
            updates[header]
          );
      }
    );
}


// ==================================================
// V1 代碼解析
// ==================================================

function paymentReversalResolveLegacyCodes_(
  ss,
  bill
) {
  const result = {
    landlord_code:
      '',

    property_code:
      ''
  };

  const landlordSheet =
    ss.getSheetByName(
      PAYMENT_REVERSAL_LANDLORDS_SHEET
    );

  if (
    landlordSheet &&
    landlordSheet.getLastRow() >= 2
  ) {
    const rows =
      paymentReversalGetObjects_(
        landlordSheet
      );

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row =
        rows[index];

      if (
        paymentReversalText_(
          row.landlord_id
        ) ===
        paymentReversalText_(
          bill.landlord_id
        )
      ) {
        result.landlord_code =
          paymentReversalFirstValue_(
            row,
            [
              'landlord_code',
              'legacy_landlord_code',
              '房東代碼'
            ]
          );

        break;
      }
    }
  }

  const propertySheet =
    ss.getSheetByName(
      PAYMENT_REVERSAL_PROPERTIES_SHEET
    );

  if (
    propertySheet &&
    propertySheet.getLastRow() >= 2
  ) {
    const rows =
      paymentReversalGetObjects_(
        propertySheet
      );

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row =
        rows[index];

      if (
        paymentReversalText_(
          row.property_id
        ) ===
        paymentReversalText_(
          bill.property_id
        )
      ) {
        result.property_code =
          paymentReversalFirstValue_(
            row,
            [
              'property_code',
              'legacy_property_code',
              'building_code',
              '建案代碼'
            ]
          );

        break;
      }
    }
  }

  return result;
}


function paymentReversalLegacyCodeMatches_(
  row,
  headerMap,
  legacyCodes
) {
  const landlordHeader =
    paymentReversalFindHeader_(
      headerMap,
      [
        '歸屬房東代碼',
        '房東代碼'
      ]
    );

  const propertyHeader =
    paymentReversalFindHeader_(
      headerMap,
      [
        '建案代碼'
      ]
    );

  if (
    legacyCodes.landlord_code &&
    landlordHeader
  ) {
    const rowLandlordCode =
      paymentReversalText_(
        row[
          headerMap[
            landlordHeader
          ]
        ]
      );

    if (
      rowLandlordCode !==
      legacyCodes.landlord_code
    ) {
      return false;
    }
  }

  if (
    legacyCodes.property_code &&
    propertyHeader
  ) {
    const rowPropertyCode =
      paymentReversalText_(
        row[
          headerMap[
            propertyHeader
          ]
        ]
      );

    if (
      rowPropertyCode !==
      legacyCodes.property_code
    ) {
      return false;
    }
  }

  return true;
}


function paymentReversalNarrowMatchesByTenant_(
  sheet,
  matches,
  headers,
  tenantName
) {
  if (matches.length <= 1) {
    return matches;
  }

  tenantName =
    paymentReversalText_(
      tenantName
    );

  if (!tenantName) {
    return matches;
  }

  const candidates = [
    '租客姓名',
    '房客姓名',
    'tenant_name'
  ];

  let tenantColumnIndex = -1;

  for (
    let index = 0;
    index < candidates.length;
    index++
  ) {
    tenantColumnIndex =
      headers.indexOf(
        candidates[index]
      );

    if (tenantColumnIndex >= 0) {
      break;
    }
  }

  if (tenantColumnIndex < 0) {
    return matches;
  }

  const narrowed =
    matches.filter(
      function (rowIndex) {
        return (
          paymentReversalText_(
            sheet
              .getRange(
                rowIndex,
                tenantColumnIndex + 1
              )
              .getValue()
          ) === tenantName
        );
      }
    );

  return narrowed.length > 0
    ? narrowed
    : matches;
}


// ==================================================
// LINE 通知
// ==================================================

function paymentReversalBuildTenantNotice_(
  data
) {
  return [
    '【CMWebs 付款狀態調整通知】',
    '',
    (
      data.tenant_name ||
      '房客'
    ) + ' 您好：',
    '',
    '房東已撤銷先前的付款確認，此帳單目前已恢復為未繳狀態。',
    '',
    '房號：' +
      (
        data.room_name ||
        '-'
      ),
    '帳單月份：' +
      (
        data.bill_month ||
        '-'
      ),
    '帳單金額：NT$ ' +
      Math.round(
        Number(
          data.amount || 0
        )
      ).toLocaleString(
        'zh-TW'
      ),
    '調整原因：' +
      (
        data.reason ||
        '-'
      ),
    '調整紀錄：' +
      (
        data.reversal_id ||
        '-'
      ),
    '',
    '請重新確認付款狀況；如有疑問，請直接聯絡房東。'
  ].join('\n');
}


// ==================================================
// 稽核紀錄
// ==================================================

function paymentReversalWriteAuditLog_(
  ss,
  data
) {
  const sheet =
    paymentReversalEnsureAuditSheet_(
      ss
    );

  paymentReversalAppendObjectRow_(
    sheet,
    {
      created_at:
        new Date(),

      reversal_id:
        data.reversal_id || '',

      action:
        data.action || '',

      landlord_line_user_id:
        data.landlord_line_user_id || '',

      landlord_id:
        data.landlord_id || '',

      bill_id:
        data.bill_id || '',

      bill_month:
        data.bill_month || '',

      tenant_id:
        data.tenant_id || '',

      tenant_name:
        data.tenant_name || '',

      room_name:
        data.room_name || '',

      amount:
        Number(
          data.amount || 0
        ),

      voided_payment_ids:
        data.voided_payment_ids || '',

      voided_payment_count:
        Number(
          data.voided_payment_count ||
          0
        ),

      voided_report_count:
        Number(
          data.voided_report_count ||
          0
        ),

      reversal_reason:
        data.reversal_reason || '',

      notify_tenant:
        data.notify_tenant === true,

      notification_status:
        data.notification_status || '',

      legacy_monthly_status:
        data.legacy_monthly_status || '',

      legacy_history_status:
        data.legacy_history_status || '',

      result:
        data.result || '',

      error_message:
        data.error_message || '',

      note:
        data.note || ''
    }
  );
}


// ==================================================
// 共用資料工具
// ==================================================

function paymentReversalFindRowByHeader_(
  sheet,
  headerName,
  expectedValue
) {
  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return null;
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      function (header) {
        return paymentReversalText_(
          header
        );
      }
    );

  const targetIndex =
    headers.indexOf(
      headerName
    );

  if (targetIndex < 0) {
    return null;
  }

  expectedValue =
    paymentReversalText_(
      expectedValue
    );

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    const actualValue =
      paymentReversalText_(
        values[index][
          targetIndex
        ]
      );

    if (
      actualValue ===
      expectedValue
    ) {
      const object = {};

      headers.forEach(
        function (
          header,
          columnIndex
        ) {
          if (header) {
            object[header] =
              values[index][
                columnIndex
              ];
          }
        }
      );

      return {
        rowIndex:
          index + 1,

        object:
          object
      };
    }
  }

  return null;
}


function paymentReversalUpdateRowByObject_(
  sheet,
  rowIndex,
  updates
) {
  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0]
      .map(function (header) {
        return paymentReversalText_(
          header
        );
      });

  Object.keys(updates)
    .forEach(
      function (header) {
        const columnIndex =
          headers.indexOf(
            header
          );

        if (columnIndex < 0) {
          return;
        }

        sheet
          .getRange(
            rowIndex,
            columnIndex + 1
          )
          .setValue(
            updates[header]
          );
      }
    );
}


function paymentReversalAppendObjectRow_(
  sheet,
  object
) {
  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0]
      .map(function (header) {
        return paymentReversalText_(
          header
        );
      });

  const row =
    headers.map(
      function (header) {
        return (
          object[header] !==
          undefined
        )
          ? object[header]
          : '';
      }
    );

  sheet.appendRow(row);

  return sheet.getLastRow();
}


function paymentReversalGetObjects_(
  sheet
) {
  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return [];
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      function (header) {
        return paymentReversalText_(
          header
        );
      }
    );

  return values
    .slice(1)
    .map(
      function (row) {
        const object = {};

        headers.forEach(
          function (
            header,
            index
          ) {
            if (header) {
              object[header] =
                row[index];
            }
          }
        );

        return object;
      }
    );
}


function paymentReversalHeaderMap_(
  headers
) {
  const map = {};

  headers.forEach(
    function (header, index) {
      if (header) {
        map[header] =
          index;
      }
    }
  );

  return map;
}


function paymentReversalFindHeader_(
  headerMap,
  candidates
) {
  for (
    let index = 0;
    index < candidates.length;
    index++
  ) {
    if (
      headerMap[
        candidates[index]
      ] !== undefined
    ) {
      return candidates[index];
    }
  }

  return '';
}


function paymentReversalFirstValue_(
  object,
  keys
) {
  for (
    let index = 0;
    index < keys.length;
    index++
  ) {
    const value =
      paymentReversalText_(
        object[keys[index]]
      );

    if (value) {
      return value;
    }
  }

  return '';
}


function paymentReversalText_(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


function paymentReversalBoolean_(
  value,
  defaultValue
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return defaultValue === true;
  }

  if (
    value === true ||
    value === 1
  ) {
    return true;
  }

  const text =
    String(value)
      .trim()
      .toLowerCase();

  return [
    '1',
    'true',
    'yes',
    'on'
  ].indexOf(text) !== -1;
}


function paymentReversalMakeId_() {
  const timezone =
    (
      typeof V2_TIMEZONE !==
        'undefined' &&
      V2_TIMEZONE
    )
      ? V2_TIMEZONE
      : 'Asia/Taipei';

  return (
    'REV-' +
    Utilities.formatDate(
      new Date(),
      timezone,
      'yyyyMMddHHmmss'
    ) +
    '-' +
    String(
      Math.floor(
        Math.random() * 10000
      )
    ).padStart(
      4,
      '0'
    )
  );
}


function paymentReversalAppendNote_(
  originalNote,
  newNote
) {
  originalNote =
    paymentReversalText_(
      originalNote
    );

  newNote =
    paymentReversalText_(
      newNote
    );

  if (!newNote) {
    return originalNote;
  }

  if (
    originalNote.indexOf(
      newNote
    ) !== -1
  ) {
    return originalNote;
  }

  return originalNote
    ? originalNote +
      '｜' +
      newNote
    : newNote;
}


function paymentReversalNormalizeBillMonth_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
    '[object Date]'
  ) {
    return Utilities.formatDate(
      value,
      'Asia/Taipei',
      'yyyy-MM'
    );
  }

  const text =
    paymentReversalText_(
      value
    );

  const match =
    text.match(
      /(\d{4})\D*(\d{1,2})/
    );

  if (!match) {
    return '';
  }

  const month =
    Number(match[2]);

  if (
    month < 1 ||
    month > 12
  ) {
    return '';
  }

  return (
    match[1] +
    '-' +
    String(month).padStart(
      2,
      '0'
    )
  );
}


function paymentReversalLegacyMonthMatches_(
  legacyValue,
  targetBillMonth
) {
  if (!targetBillMonth) {
    return false;
  }

  const targetParts =
    targetBillMonth.split('-');

  const targetYear =
    targetParts[0];

  const targetMonth =
    targetParts[1];

  if (
    Object.prototype
      .toString
      .call(legacyValue) ===
    '[object Date]'
  ) {
    return (
      Utilities.formatDate(
        legacyValue,
        'Asia/Taipei',
        'yyyy-MM'
      ) === targetBillMonth
    );
  }

  const text =
    paymentReversalText_(
      legacyValue
    );

  const yearMonthMatch =
    text.match(
      /(\d{4})\D*(\d{1,2})/
    );

  if (yearMonthMatch) {
    return (
      yearMonthMatch[1] ===
        targetYear &&
      String(
        Number(
          yearMonthMatch[2]
        )
      ).padStart(
        2,
        '0'
      ) === targetMonth
    );
  }

  const monthMatch =
    text.match(
      /(\d{1,2})/
    );

  if (!monthMatch) {
    return false;
  }

  return (
    String(
      Number(
        monthMatch[1]
      )
    ).padStart(
      2,
      '0'
    ) === targetMonth
  );
}


function paymentReversalNormalizeYear_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
    '[object Date]'
  ) {
    return Utilities.formatDate(
      value,
      'Asia/Taipei',
      'yyyy'
    );
  }

  const match =
    paymentReversalText_(
      value
    ).match(
      /\d{4}/
    );

  return match
    ? match[0]
    : '';
}


function paymentReversalNormalizeMonth_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
    '[object Date]'
  ) {
    return Utilities.formatDate(
      value,
      'Asia/Taipei',
      'MM'
    );
  }

  const match =
    paymentReversalText_(
      value
    ).match(
      /\d{1,2}/
    );

  if (!match) {
    return '';
  }

  const month =
    Number(match[0]);

  if (
    month < 1 ||
    month > 12
  ) {
    return '';
  }

  return String(month).padStart(
    2,
    '0'
  );
}


function paymentReversalNormalizeRoom_(
  value
) {
  return paymentReversalText_(
    value
  ).replace(
    /\.0+$/,
    ''
  );
}


// ==================================================
// 安裝檢查
// ==================================================

/**
 * 執行一次，建立或補齊撤銷銷帳所需欄位。
 * 不會改動任何帳單或付款狀態。
 */
function testEnsurePaymentReversalSheets() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const billSheet =
    paymentReversalEnsureBillSheet_(
      ss
    );

  const paymentSheet =
    paymentReversalEnsurePaymentSheet_(
      ss
    );

  const reportSheet =
    paymentReversalEnsureReportSheet_(
      ss
    );

  const auditSheet =
    paymentReversalEnsureAuditSheet_(
      ss
    );

  Logger.log(
    JSON.stringify({
      success:
        true,

      bill_sheet:
        billSheet.getName(),

      payment_sheet:
        paymentSheet.getName(),

      report_sheet:
        reportSheet.getName(),

      audit_sheet:
        auditSheet.getName(),

      message:
        '撤銷銷帳後端工作表檢查完成'
    })
  );
}