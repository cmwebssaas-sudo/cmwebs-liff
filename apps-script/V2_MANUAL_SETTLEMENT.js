// ==================================================
// CMWebs V2 Manual Settlement
// 房東手動確認帳單已繳並正式銷帳
// ==================================================

const MANUAL_SETTLEMENT_BILLS_SHEET =
  'V2_bills';

const MANUAL_SETTLEMENT_PAYMENTS_SHEET =
  'V2_payments';

const MANUAL_SETTLEMENT_TENANT_LIST_VIEW =
  'V2_landlord_tenant_list_view';

const MANUAL_SETTLEMENT_LANDLORD_HOME_VIEW =
  'V2_landlord_home_view';

const MANUAL_SETTLEMENT_TENANTS_SHEET =
  'V2_tenants';

const MANUAL_SETTLEMENT_LANDLORDS_SHEET =
  'V2_landlords';

const MANUAL_SETTLEMENT_PROPERTIES_SHEET =
  'V2_properties';

const MANUAL_SETTLEMENT_LEGACY_MONTHLY_SHEET =
  '1.每月帳單表';

const MANUAL_SETTLEMENT_LEGACY_HISTORY_SHEET =
  '3.歷史帳單總表';

const MANUAL_SETTLEMENT_AUDIT_SHEET =
  'V2_manual_settlement_logs';


// ==================================================
// 主函式
// ==================================================

/**
 * 房東手動確認帳單已繳
 *
 * 預計路由：
 * v2_action=landlord_bill_manual_settle
 *
 * @param {string} landlordLineUserId 房東 LINE UID
 * @param {string} billId 帳單 ID
 * @param {string} paymentDateText 付款日期 YYYY-MM-DD
 * @param {string} paymentMethod 付款方式
 * @param {number|string} paymentAmount 付款金額
 * @param {string} bankLast5 匯款後 5 碼
 * @param {string} confirmationSource 確認依據
 * @param {string} landlordNote 房東備註
 * @param {boolean|string} notifyTenant 是否通知房客
 */
function manualSettleLandlordBillByLineUid_(
  landlordLineUserId,
  billId,
  paymentDateText,
  paymentMethod,
  paymentAmount,
  bankLast5,
  confirmationSource,
  landlordNote,
  notifyTenant
) {
  const action =
    'landlord_bill_manual_settle';

  const lock =
    LockService.getScriptLock();

  let paymentSheet = null;
  let paymentRowIndex = 0;
  let paymentId = '';
  let billUpdated = false;

  try {
    landlordLineUserId =
      manualSettlementText_(
        landlordLineUserId
      );

    billId =
      manualSettlementText_(
        billId
      );

    paymentMethod =
      manualSettlementText_(
        paymentMethod
      ).toLowerCase();

    bankLast5 =
      manualSettlementText_(
        bankLast5
      );

    confirmationSource =
      manualSettlementText_(
        confirmationSource
      ).toLowerCase();

    landlordNote =
      manualSettlementText_(
        landlordNote
      );

    const shouldNotifyTenant =
      manualSettlementBoolean_(
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

    const allowedPaymentMethods = [
      'bank_transfer',
      'cash',
      'other'
    ];

    if (
      allowedPaymentMethods.indexOf(
        paymentMethod
      ) === -1
    ) {
      return {
        success: false,
        code:
          'INVALID_PAYMENT_METHOD',
        message:
          '付款方式不正確'
      };
    }

    const allowedConfirmationSources = [
      'private_message',
      'transfer_screenshot',
      'phone',
      'onsite_cash',
      'other'
    ];

    if (
      allowedConfirmationSources.indexOf(
        confirmationSource
      ) === -1
    ) {
      return {
        success: false,
        code:
          'INVALID_CONFIRMATION_SOURCE',
        message:
          '確認依據不正確'
      };
    }

    if (
      bankLast5 &&
      !/^\d{5}$/.test(bankLast5)
    ) {
      return {
        success: false,
        code:
          'INVALID_BANK_LAST5',
        message:
          '匯款後 5 碼必須是 5 位數字'
      };
    }

    if (landlordNote.length > 300) {
      return {
        success: false,
        code:
          'LANDLORD_NOTE_TOO_LONG',
        message:
          '房東備註最多 300 字'
      };
    }

    const parsedPaymentAmount =
      Number(paymentAmount);

    if (
      !isFinite(parsedPaymentAmount) ||
      parsedPaymentAmount <= 0
    ) {
      return {
        success: false,
        code:
          'INVALID_PAYMENT_AMOUNT',
        message:
          '付款金額不正確'
      };
    }

    const paymentDate =
      manualSettlementParseDate_(
        paymentDateText
      );

    if (!paymentDate) {
      return {
        success: false,
        code:
          'INVALID_PAYMENT_DATE',
        message:
          '付款日期不正確'
      };
    }

    if (!lock.tryLock(30000)) {
      return {
        success: false,
        code:
          'REQUEST_BUSY',
        message:
          '系統正在處理其他付款，請稍後再試'
      };
    }

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const billSheet =
      manualSettlementEnsureBillSheet_(
        ss
      );

    paymentSheet =
      manualSettlementEnsurePaymentSheet_(
        ss
      );

    manualSettlementEnsureAuditSheet_(
      ss
    );

    const billData =
      manualSettlementFindRowByHeader_(
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

    const landlordIdentity =
      manualSettlementResolveLandlord_(
        ss,
        landlordLineUserId
      );

    if (!landlordIdentity) {
      return {
        success: false,
        code:
          'LANDLORD_NOT_FOUND',
        message:
          '查無房東資料或尚未完成綁定'
      };
    }

    const billLandlordId =
      manualSettlementText_(
        bill.landlord_id
      );

    if (
      billLandlordId &&
      landlordIdentity.landlord_id &&
      billLandlordId !==
        landlordIdentity.landlord_id
    ) {
      return {
        success: false,
        code:
          'BILL_NOT_OWNED_BY_LANDLORD',
        message:
          '此帳單不屬於目前房東'
      };
    }

    const currentPaymentStatus =
      manualSettlementText_(
        bill.payment_status
      ).toLowerCase();

    const currentPaymentId =
      manualSettlementText_(
        bill.payment_id
      );

    /*
     * 已完成正式銷帳時採冪等回傳，
     * 避免前端重送造成第二筆付款紀錄。
     */
    if (
      currentPaymentStatus === 'paid' &&
      currentPaymentId
    ) {
      return {
        success: true,
        code:
          'ALREADY_SETTLED',
        message:
          '此帳單已完成銷帳',

        data: {
          bill_id:
            billId,

          payment_id:
            currentPaymentId,

          payment_status:
            'paid',

          tenant_notification_success:
            null
        }
      };
    }

    if (
      currentPaymentStatus === 'paid'
    ) {
      return {
        success: false,
        code:
          'BILL_ALREADY_PAID',
        message:
          '此帳單已標記為已繳，請勿重複銷帳'
      };
    }

    const billTotalAmount =
      Number(
        bill.total_amount || 0
      );

    if (
      !isFinite(billTotalAmount) ||
      billTotalAmount <= 0
    ) {
      return {
        success: false,
        code:
          'INVALID_BILL_AMOUNT',
        message:
          '帳單總額不正確'
      };
    }

    /*
     * 第一版只允許全額銷帳。
     * 部分付款未來再另建 balance 邏輯。
     */
    if (
      Math.round(parsedPaymentAmount) !==
      Math.round(billTotalAmount)
    ) {
      return {
        success: false,
        code:
          'PAYMENT_AMOUNT_MISMATCH',
        message:
          '付款金額必須等於帳單總額 NT$ ' +
          Math.round(
            billTotalAmount
          ).toLocaleString('zh-TW')
      };
    }

    const existingPayment =
      manualSettlementFindExistingPayment_(
        paymentSheet,
        billId
      );

    if (existingPayment) {
      return {
        success: false,
        code:
          'PAYMENT_RECORD_ALREADY_EXISTS',
        message:
          '此帳單已存在有效付款紀錄，請先檢查 V2_payments'
      };
    }

    const now =
      new Date();

    paymentId =
      manualSettlementMakePaymentId_();

    const tenantIdentity =
      manualSettlementResolveTenant_(
        ss,
        landlordLineUserId,
        bill
      );

    const paymentRecord = {
      payment_id:
        paymentId,

      created_at:
        now,

      updated_at:
        now,

      landlord_id:
        bill.landlord_id || '',

      property_id:
        bill.property_id || '',

      room_id:
        bill.room_id || '',

      contract_id:
        bill.contract_id || '',

      tenant_id:
        bill.tenant_id || '',

      user_id:
        bill.user_id || '',

      bill_id:
        billId,

      bill_month:
        bill.bill_month || '',

      payment_date:
        paymentDate,

      amount:
        parsedPaymentAmount,

      payment_method:
        paymentMethod,

      bank_last5:
        bankLast5,

      status:
        'confirmed',

      source:
        'landlord_manual_settlement',

      source_ref_id:
        billId,

      confirmation_source:
        confirmationSource,

      confirmed_by:
        landlordLineUserId,

      note:
        landlordNote ||
        '房東手動確認已繳'
    };

    paymentRowIndex =
      manualSettlementAppendObjectRow_(
        paymentSheet,
        paymentRecord
      );

    const billNote =
      [
        '房東手動銷帳',
        '付款ID：' + paymentId,
        '確認依據：' +
          manualSettlementConfirmationSourceText_(
            confirmationSource
          )
      ].join('／');

    manualSettlementUpdateRowByObject_(
      billSheet,
      billData.rowIndex,
      {
        payment_status:
          'paid',

        paid_at:
          paymentDate,

        payment_id:
          paymentId,

        updated_at:
          now,

        notes:
          manualSettlementAppendNote_(
            bill.notes || '',
            billNote
          )
      }
    );

    billUpdated = true;

    /*
     * 同步回 V1。
     * V1 同步錯誤不會回滾 V2 正式付款，
     * 但會完整寫入稽核紀錄。
     */
    const legacySyncResult =
      manualSettlementSyncLegacy_(
        ss,
        bill,
        paymentDate,
        paymentId
      );

    SpreadsheetApp.flush();

    let tenantNotificationResult = {
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

    const tenantLineUserId =
      manualSettlementText_(
        tenantIdentity
          ? tenantIdentity
              .tenant_line_user_id
          : ''
      );

    const noticeText =
      manualSettlementBuildTenantNotice_({
        tenant_name:
          tenantIdentity &&
          tenantIdentity.tenant_name
            ? tenantIdentity.tenant_name
            : bill.tenant_name || '',

        room_name:
          bill.room_name || '',

        bill_month:
          bill.bill_month || '',

        amount:
          parsedPaymentAmount,

        payment_date:
          paymentDate,

        payment_method:
          paymentMethod,

        bank_last5:
          bankLast5,

        payment_id:
          paymentId
      });

    if (
      shouldNotifyTenant &&
      tenantLineUserId
    ) {
      const pushResult =
        pushLineTextMessage_(
          tenantLineUserId,
          noticeText
        );

      tenantNotificationResult = {
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

      cmwebsLogLineMessage_({
        direction:
          'outgoing',

        source:
          'landlord_manual_settlement',

        landlord_line_user_id:
          landlordLineUserId,

        tenant_line_user_id:
          tenantLineUserId,

        tenant_id:
          bill.tenant_id || '',

        tenant_user_id:
          bill.user_id || '',

        tenant_name:
          tenantIdentity &&
          tenantIdentity.tenant_name
            ? tenantIdentity.tenant_name
            : bill.tenant_name || '',

        room_list:
          bill.room_name || '',

        message_type:
          'manual_payment_settlement_confirmed',

        message_text:
          noticeText,

        status:
          tenantNotificationResult.success
            ? 'success'
            : 'failed',

        note:
          tenantNotificationResult.success
            ? 'manual settlement notice sent'
            : tenantNotificationResult.message
      });
    }

    manualSettlementWriteAuditLog_(
      ss,
      {
        action:
          action,

        landlord_line_user_id:
          landlordLineUserId,

        landlord_id:
          bill.landlord_id || '',

        bill_id:
          billId,

        payment_id:
          paymentId,

        tenant_id:
          bill.tenant_id || '',

        tenant_name:
          tenantIdentity &&
          tenantIdentity.tenant_name
            ? tenantIdentity.tenant_name
            : bill.tenant_name || '',

        room_name:
          bill.room_name || '',

        amount:
          parsedPaymentAmount,

        payment_date:
          paymentDate,

        payment_method:
          paymentMethod,

        confirmation_source:
          confirmationSource,

        notify_tenant:
          shouldNotifyTenant,

        notification_status:
          shouldNotifyTenant
            ? (
                tenantNotificationResult.success
                  ? 'success'
                  : 'failed'
              )
            : 'not_requested',

        legacy_monthly_status:
          legacySyncResult.monthly.status,

        legacy_history_status:
          legacySyncResult.history.status,

        result:
          'success',

        error_message:
          '',

        note:
          landlordNote || ''
      }
    );

    logLiffAccess_({
      lineUserId:
        landlordLineUserId,

      userId:
        landlordIdentity.user_id || '',

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
          'payment_id=' +
            paymentId,

          'legacy_monthly=' +
            legacySyncResult
              .monthly.status,

          'legacy_history=' +
            legacySyncResult
              .history.status
        ].join(', ')
    });

    let message =
      '帳單已完成手動銷帳';

    if (shouldNotifyTenant) {
      message +=
        tenantNotificationResult.success
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
        '。V1 同步結果請查看稽核紀錄';
    }

    return {
      success: true,
      code:
        'OK',
      message:
        message,

      data: {
        bill_id:
          billId,

        payment_id:
          paymentId,

        payment_status:
          'paid',

        payment_amount:
          parsedPaymentAmount,

        payment_date:
          paymentDate,

        payment_method:
          paymentMethod,

        confirmation_source:
          confirmationSource,

        tenant_notification_success:
          shouldNotifyTenant
            ? tenantNotificationResult.success
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
    /*
     * 若付款紀錄已新增但帳單尚未成功更新，
     * 將該付款紀錄標記為 void，避免假付款紀錄。
     */
    if (
      paymentSheet &&
      paymentRowIndex > 1 &&
      !billUpdated
    ) {
      try {
        manualSettlementUpdateRowByObject_(
          paymentSheet,
          paymentRowIndex,
          {
            status:
              'void',

            updated_at:
              new Date(),

            note:
              '銷帳失敗，自動作廢：' +
              error.message
          }
        );
      } catch (rollbackError) {
        // 避免回滾失敗覆蓋原錯誤
      }
    }

    try {
      const ss =
        SpreadsheetApp
          .getActiveSpreadsheet();

      manualSettlementWriteAuditLog_(
        ss,
        {
          action:
            action,

          landlord_line_user_id:
            landlordLineUserId || '',

          landlord_id:
            '',

          bill_id:
            billId || '',

          payment_id:
            paymentId || '',

          tenant_id:
            '',

          tenant_name:
            '',

          room_name:
            '',

          amount:
            Number(
              paymentAmount || 0
            ),

          payment_date:
            paymentDateText || '',

          payment_method:
            paymentMethod || '',

          confirmation_source:
            confirmationSource || '',

          notify_tenant:
            manualSettlementBoolean_(
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
            landlordNote || ''
        }
      );
    } catch (auditError) {
      // 稽核紀錄失敗不可覆蓋主錯誤
    }

    try {
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
    } catch (logError) {
      // 忽略存取紀錄錯誤
    }

    return {
      success: false,
      code:
        'MANUAL_SETTLEMENT_ERROR',
      message:
        '手動銷帳失敗：' +
        error.message
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      // 尚未取得鎖定時忽略
    }
  }
}


// ==================================================
// V2 工作表
// ==================================================

/**
 * 確保 V2_bills 及必要欄位存在
 */
function manualSettlementEnsureBillSheet_(
  ss
) {
  const sheet =
    ss.getSheetByName(
      MANUAL_SETTLEMENT_BILLS_SHEET
    );

  if (!sheet) {
    throw new Error(
      '找不到工作表：' +
      MANUAL_SETTLEMENT_BILLS_SHEET
    );
  }

  manualSettlementEnsureHeaders_(
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
      'payment_status',
      'paid_at',
      'payment_id',
      'updated_at',
      'legacy_source',
      'legacy_ref',
      'notes'
    ]
  );

  return sheet;
}


/**
 * 確保 V2_payments 及必要欄位存在
 */
function manualSettlementEnsurePaymentSheet_(
  ss
) {
  let sheet =
    ss.getSheetByName(
      MANUAL_SETTLEMENT_PAYMENTS_SHEET
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
    'note'
  ];

  if (!sheet) {
    sheet =
      ss.insertSheet(
        MANUAL_SETTLEMENT_PAYMENTS_SHEET
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

  manualSettlementEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


/**
 * 確保人工銷帳稽核表存在
 */
function manualSettlementEnsureAuditSheet_(
  ss
) {
  let sheet =
    ss.getSheetByName(
      MANUAL_SETTLEMENT_AUDIT_SHEET
    );

  const headers = [
    'created_at',
    'action',
    'landlord_line_user_id',
    'landlord_id',
    'bill_id',
    'payment_id',
    'tenant_id',
    'tenant_name',
    'room_name',
    'amount',
    'payment_date',
    'payment_method',
    'confirmation_source',
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
        MANUAL_SETTLEMENT_AUDIT_SHEET
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

  manualSettlementEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


/**
 * 補上缺少欄位，不更動原欄位順序
 */
function manualSettlementEnsureHeaders_(
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
        return manualSettlementText_(
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
// 權限與資料識別
// ==================================================

/**
 * 解析房東資料
 */
function manualSettlementResolveLandlord_(
  ss,
  landlordLineUserId
) {
  const candidateSheets = [
    MANUAL_SETTLEMENT_TENANT_LIST_VIEW,
    MANUAL_SETTLEMENT_LANDLORD_HOME_VIEW,
    MANUAL_SETTLEMENT_LANDLORDS_SHEET
  ];

  for (
    let index = 0;
    index < candidateSheets.length;
    index++
  ) {
    const sheet =
      ss.getSheetByName(
        candidateSheets[index]
      );

    if (
      !sheet ||
      sheet.getLastRow() < 2
    ) {
      continue;
    }

    const rows =
      manualSettlementGetObjects_(
        sheet
      );

    for (
      let rowIndex = 0;
      rowIndex < rows.length;
      rowIndex++
    ) {
      const row =
        rows[rowIndex];

      const rowLineUserId =
        manualSettlementText_(
          row.line_user_id ||
          row.landlord_line_user_id
        );

      if (
        rowLineUserId ===
        landlordLineUserId
      ) {
        return {
          landlord_id:
            manualSettlementText_(
              row.landlord_id
            ),

          user_id:
            manualSettlementText_(
              row.landlord_user_id ||
              row.user_id
            ),

          landlord_name:
            manualSettlementText_(
              row.landlord_name ||
              row.owner_name
            )
        };
      }
    }
  }

  return null;
}


/**
 * 解析房客 LINE 與顯示資料
 */
function manualSettlementResolveTenant_(
  ss,
  landlordLineUserId,
  bill
) {
  const tenantId =
    manualSettlementText_(
      bill.tenant_id
    );

  const tenantUserId =
    manualSettlementText_(
      bill.user_id
    );

  const listSheet =
    ss.getSheetByName(
      MANUAL_SETTLEMENT_TENANT_LIST_VIEW
    );

  if (
    listSheet &&
    listSheet.getLastRow() >= 2
  ) {
    const rows =
      manualSettlementGetObjects_(
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
        manualSettlementText_(
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
          manualSettlementText_(
            row.tenant_id
          ) === tenantId
        ) ||
        (
          tenantUserId &&
          manualSettlementText_(
            row.tenant_user_id ||
            row.user_id
          ) === tenantUserId
        );

      if (!sameTenant) {
        continue;
      }

      return {
        tenant_id:
          manualSettlementText_(
            row.tenant_id
          ),

        tenant_user_id:
          manualSettlementText_(
            row.tenant_user_id ||
            row.user_id
          ),

        tenant_line_user_id:
          manualSettlementText_(
            row.tenant_line_user_id
          ),

        tenant_name:
          manualSettlementText_(
            row.tenant_name
          ),

        room_list:
          manualSettlementText_(
            row.room_list
          )
      };
    }
  }

  const tenantSheet =
    ss.getSheetByName(
      MANUAL_SETTLEMENT_TENANTS_SHEET
    );

  if (
    tenantSheet &&
    tenantSheet.getLastRow() >= 2
  ) {
    const rows =
      manualSettlementGetObjects_(
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
          manualSettlementText_(
            row.tenant_id
          ) === tenantId
        ) ||
        (
          tenantUserId &&
          manualSettlementText_(
            row.user_id ||
            row.tenant_user_id
          ) === tenantUserId
        );

      if (!sameTenant) {
        continue;
      }

      return {
        tenant_id:
          manualSettlementText_(
            row.tenant_id
          ),

        tenant_user_id:
          manualSettlementText_(
            row.user_id ||
            row.tenant_user_id
          ),

        tenant_line_user_id:
          manualSettlementText_(
            row.line_user_id ||
            row.tenant_line_user_id
          ),

        tenant_name:
          manualSettlementText_(
            row.tenant_name ||
            row.name
          ),

        room_list:
          manualSettlementText_(
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
      manualSettlementText_(
        bill.tenant_name
      ),

    room_list:
      manualSettlementText_(
        bill.room_name
      )
  };
}


// ==================================================
// 付款紀錄與帳單資料
// ==================================================

/**
 * 檢查帳單是否已有有效付款紀錄
 */
function manualSettlementFindExistingPayment_(
  paymentSheet,
  billId
) {
  if (
    !paymentSheet ||
    paymentSheet.getLastRow() < 2
  ) {
    return null;
  }

  const rows =
    manualSettlementGetObjects_(
      paymentSheet
    );

  for (
    let index = 0;
    index < rows.length;
    index++
  ) {
    const row =
      rows[index];

    if (
      manualSettlementText_(
        row.bill_id
      ) !== billId
    ) {
      continue;
    }

    const status =
      manualSettlementText_(
        row.status
      ).toLowerCase();

    if (
      status !== 'void' &&
      status !== 'cancelled' &&
      status !== 'rejected'
    ) {
      return row;
    }
  }

  return null;
}


/**
 * 依欄位值尋找資料列
 */
function manualSettlementFindRowByHeader_(
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
        return manualSettlementText_(
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
    manualSettlementText_(
      expectedValue
    );

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    const actualValue =
      manualSettlementText_(
        values[index][targetIndex]
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


/**
 * 依表頭順序新增物件資料
 */
function manualSettlementAppendObjectRow_(
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
        return manualSettlementText_(
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


/**
 * 依欄位名稱更新資料列
 */
function manualSettlementUpdateRowByObject_(
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
        return manualSettlementText_(
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


// ==================================================
// V1 同步
// ==================================================

/**
 * 同步至 V1 月帳單表與歷史帳單表
 */
function manualSettlementSyncLegacy_(
  ss,
  bill,
  paymentDate,
  paymentId
) {
  const legacyCodes =
    manualSettlementResolveLegacyCodes_(
      ss,
      bill
    );

  return {
    monthly:
      manualSettlementSyncLegacyMonthly_(
        ss,
        bill,
        paymentDate,
        paymentId,
        legacyCodes
      ),

    history:
      manualSettlementSyncLegacyHistory_(
        ss,
        bill,
        paymentDate,
        paymentId,
        legacyCodes
      )
  };
}


/**
 * 同步 V1「1.每月帳單表」
 */
function manualSettlementSyncLegacyMonthly_(
  ss,
  bill,
  paymentDate,
  paymentId,
  legacyCodes
) {
  const sheet =
    ss.getSheetByName(
      MANUAL_SETTLEMENT_LEGACY_MONTHLY_SHEET
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
        return manualSettlementText_(
          header
        );
      }
    );

  const map =
    manualSettlementHeaderMap_(
      headers
    );

  const roomHeader =
    manualSettlementFindHeader_(
      map,
      [
        '房號'
      ]
    );

  const monthHeader =
    manualSettlementFindHeader_(
      map,
      [
        '帳單年月',
        '帳單月份'
      ]
    );

  const statusHeader =
    manualSettlementFindHeader_(
      map,
      [
        '繳費狀態',
        '付款狀態'
      ]
    );

  if (
    !roomHeader ||
    !monthHeader ||
    !statusHeader
  ) {
    return {
      status:
        'missing_headers',

      updated_count:
        0,

      message:
        '1.每月帳單表缺少房號、月份或繳費狀態欄位'
    };
  }

  const targetRoom =
    manualSettlementText_(
      bill.room_name
    );

  const targetBillMonth =
    manualSettlementNormalizeBillMonth_(
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
      manualSettlementNormalizeRoom_(
        row[map[roomHeader]]
      );

    if (
      room !==
      manualSettlementNormalizeRoom_(
        targetRoom
      )
    ) {
      continue;
    }

    if (
      !manualSettlementLegacyMonthMatches_(
        row[map[monthHeader]],
        targetBillMonth
      )
    ) {
      continue;
    }

    if (
      !manualSettlementLegacyCodeMatches_(
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

  const narrowedMatches =
    manualSettlementNarrowMatchesByTenant_(
      sheet,
      matches,
      headers,
      bill.tenant_name
    );

  if (
    narrowedMatches.length === 0
  ) {
    return {
      status:
        'not_found',

      updated_count:
        0,

      message:
        '1.每月帳單表找不到相符帳單'
    };
  }

  if (
    narrowedMatches.length > 1
  ) {
    return {
      status:
        'ambiguous',

      updated_count:
        0,

      message:
        '1.每月帳單表找到多筆相符資料，為避免誤改已停止同步'
    };
  }

  manualSettlementUpdateLegacyRow_(
    sheet,
    narrowedMatches[0],
    headers,
    paymentDate,
    paymentId
  );

  return {
    status:
      'updated',

    updated_count:
      1,

    row:
      narrowedMatches[0],

    message:
      '1.每月帳單表已同步'
  };
}


/**
 * 同步 V1「3.歷史帳單總表」
 */
function manualSettlementSyncLegacyHistory_(
  ss,
  bill,
  paymentDate,
  paymentId,
  legacyCodes
) {
  const sheet =
    ss.getSheetByName(
      MANUAL_SETTLEMENT_LEGACY_HISTORY_SHEET
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
        return manualSettlementText_(
          header
        );
      }
    );

  const map =
    manualSettlementHeaderMap_(
      headers
    );

  const yearHeader =
    manualSettlementFindHeader_(
      map,
      [
        '結帳年份',
        '帳單年份'
      ]
    );

  const monthHeader =
    manualSettlementFindHeader_(
      map,
      [
        '結帳月份',
        '帳單月份'
      ]
    );

  const roomHeader =
    manualSettlementFindHeader_(
      map,
      [
        '房號'
      ]
    );

  const statusHeader =
    manualSettlementFindHeader_(
      map,
      [
        '繳費狀態',
        '付款狀態'
      ]
    );

  if (
    !yearHeader ||
    !monthHeader ||
    !roomHeader ||
    !statusHeader
  ) {
    return {
      status:
        'missing_headers',

      updated_count:
        0,

      message:
        '3.歷史帳單總表缺少年、月、房號或繳費狀態欄位'
    };
  }

  const targetBillMonth =
    manualSettlementNormalizeBillMonth_(
      bill.bill_month
    );

  const parts =
    targetBillMonth.split('-');

  const targetYear =
    parts[0] || '';

  const targetMonth =
    parts[1] || '';

  const targetRoom =
    manualSettlementNormalizeRoom_(
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
      manualSettlementNormalizeYear_(
        row[map[yearHeader]]
      );

    const rowMonth =
      manualSettlementNormalizeMonth_(
        row[map[monthHeader]]
      );

    const rowRoom =
      manualSettlementNormalizeRoom_(
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
      !manualSettlementLegacyCodeMatches_(
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

  const narrowedMatches =
    manualSettlementNarrowMatchesByTenant_(
      sheet,
      matches,
      headers,
      bill.tenant_name
    );

  if (
    narrowedMatches.length === 0
  ) {
    return {
      status:
        'not_found',

      updated_count:
        0,

      message:
        '3.歷史帳單總表找不到相符帳單'
    };
  }

  if (
    narrowedMatches.length > 1
  ) {
    return {
      status:
        'ambiguous',

      updated_count:
        0,

      message:
        '3.歷史帳單總表找到多筆相符資料，為避免誤改已停止同步'
    };
  }

  manualSettlementUpdateLegacyRow_(
    sheet,
    narrowedMatches[0],
    headers,
    paymentDate,
    paymentId
  );

  return {
    status:
      'updated',

    updated_count:
      1,

    row:
      narrowedMatches[0],

    message:
      '3.歷史帳單總表已同步'
  };
}


/**
 * 更新 V1 帳單列
 */
function manualSettlementUpdateLegacyRow_(
  sheet,
  rowIndex,
  headers,
  paymentDate,
  paymentId
) {
  const updates = {
    '繳費狀態':
      '已繳',

    '付款狀態':
      '已繳',

    '催繳狀態':
      '已銷帳',

    '付款日期':
      paymentDate,

    '繳款日期':
      paymentDate,

    '入帳日期':
      paymentDate,

    '付款編號':
      paymentId,

    '付款ID':
      paymentId,

    'payment_id':
      paymentId
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


/**
 * 解析 V2 對應的 V1 房東及建案代碼
 */
function manualSettlementResolveLegacyCodes_(
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
      MANUAL_SETTLEMENT_LANDLORDS_SHEET
    );

  if (
    landlordSheet &&
    landlordSheet.getLastRow() >= 2
  ) {
    const rows =
      manualSettlementGetObjects_(
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
        manualSettlementText_(
          row.landlord_id
        ) ===
        manualSettlementText_(
          bill.landlord_id
        )
      ) {
        result.landlord_code =
          manualSettlementFirstValue_(
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
      MANUAL_SETTLEMENT_PROPERTIES_SHEET
    );

  if (
    propertySheet &&
    propertySheet.getLastRow() >= 2
  ) {
    const rows =
      manualSettlementGetObjects_(
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
        manualSettlementText_(
          row.property_id
        ) ===
        manualSettlementText_(
          bill.property_id
        )
      ) {
        result.property_code =
          manualSettlementFirstValue_(
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


/**
 * V1 房東／建案代碼比對
 */
function manualSettlementLegacyCodeMatches_(
  row,
  headerMap,
  legacyCodes
) {
  const landlordHeader =
    manualSettlementFindHeader_(
      headerMap,
      [
        '歸屬房東代碼',
        '房東代碼'
      ]
    );

  const propertyHeader =
    manualSettlementFindHeader_(
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
      manualSettlementText_(
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
      manualSettlementText_(
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


/**
 * 多筆結果時再用租客姓名縮小範圍
 */
function manualSettlementNarrowMatchesByTenant_(
  sheet,
  matches,
  headers,
  tenantName
) {
  if (
    matches.length <= 1
  ) {
    return matches;
  }

  tenantName =
    manualSettlementText_(
      tenantName
    );

  if (!tenantName) {
    return matches;
  }

  const tenantHeaders = [
    '租客姓名',
    '房客姓名',
    'tenant_name'
  ];

  let tenantColumnIndex = -1;

  for (
    let index = 0;
    index < tenantHeaders.length;
    index++
  ) {
    tenantColumnIndex =
      headers.indexOf(
        tenantHeaders[index]
      );

    if (
      tenantColumnIndex >= 0
    ) {
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
          manualSettlementText_(
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

/**
 * 建立手動銷帳通知
 */
function manualSettlementBuildTenantNotice_(
  data
) {
  const lines = [
    '【CMWebs 付款已確認】',
    '',
    (
      data.tenant_name ||
      '房客'
    ) + ' 您好：',
    '',
    '房東已確認收到您的款項，帳單已完成銷帳。',
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
    '付款日期：' +
      manualSettlementFormatDate_(
        data.payment_date
      ),
    '付款金額：NT$ ' +
      Math.round(
        Number(
          data.amount || 0
        )
      ).toLocaleString(
        'zh-TW'
      ),
    '付款方式：' +
      manualSettlementPaymentMethodText_(
        data.payment_method
      )
  ];

  if (data.bank_last5) {
    lines.push(
      '匯款後 5 碼：' +
      data.bank_last5
    );
  }

  lines.push(
    '付款紀錄：' +
      (
        data.payment_id ||
        '-'
      )
  );

  lines.push('');
  lines.push(
    '您可至帳單頁查看最新繳款狀態，謝謝。'
  );

  return lines.join('\n');
}


// ==================================================
// 稽核紀錄
// ==================================================

/**
 * 寫入人工銷帳稽核紀錄
 */
function manualSettlementWriteAuditLog_(
  ss,
  data
) {
  const sheet =
    manualSettlementEnsureAuditSheet_(
      ss
    );

  manualSettlementAppendObjectRow_(
    sheet,
    {
      created_at:
        new Date(),

      action:
        data.action || '',

      landlord_line_user_id:
        data.landlord_line_user_id || '',

      landlord_id:
        data.landlord_id || '',

      bill_id:
        data.bill_id || '',

      payment_id:
        data.payment_id || '',

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

      payment_date:
        data.payment_date || '',

      payment_method:
        data.payment_method || '',

      confirmation_source:
        data.confirmation_source || '',

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
// 共用工具
// ==================================================

function manualSettlementGetObjects_(
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
        return manualSettlementText_(
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


function manualSettlementHeaderMap_(
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


function manualSettlementFindHeader_(
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


function manualSettlementFirstValue_(
  object,
  keys
) {
  for (
    let index = 0;
    index < keys.length;
    index++
  ) {
    const value =
      manualSettlementText_(
        object[keys[index]]
      );

    if (value) {
      return value;
    }
  }

  return '';
}


function manualSettlementText_(
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


function manualSettlementBoolean_(
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


function manualSettlementParseDate_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
    '[object Date]'
  ) {
    return isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  const text =
    manualSettlementText_(
      value
    );

  if (!text) {
    return null;
  }

  const match =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const date =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0
    );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}


function manualSettlementMakePaymentId_() {
  const timezone =
    (
      typeof V2_TIMEZONE !==
        'undefined' &&
      V2_TIMEZONE
    )
      ? V2_TIMEZONE
      : 'Asia/Taipei';

  return (
    'PAY-MANUAL-' +
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


function manualSettlementAppendNote_(
  originalNote,
  newNote
) {
  originalNote =
    manualSettlementText_(
      originalNote
    );

  newNote =
    manualSettlementText_(
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


function manualSettlementNormalizeBillMonth_(
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
    manualSettlementText_(
      value
    );

  const fullMatch =
    text.match(
      /(\d{4})\D*(\d{1,2})/
    );

  if (!fullMatch) {
    return '';
  }

  const month =
    Number(fullMatch[2]);

  if (
    month < 1 ||
    month > 12
  ) {
    return '';
  }

  return (
    fullMatch[1] +
    '-' +
    String(month).padStart(
      2,
      '0'
    )
  );
}


function manualSettlementLegacyMonthMatches_(
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
    manualSettlementText_(
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


function manualSettlementNormalizeYear_(
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
    manualSettlementText_(
      value
    ).match(
      /\d{4}/
    );

  return match
    ? match[0]
    : '';
}


function manualSettlementNormalizeMonth_(
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
    manualSettlementText_(
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


function manualSettlementNormalizeRoom_(
  value
) {
  return manualSettlementText_(
    value
  ).replace(
    /\.0+$/,
    ''
  );
}


function manualSettlementPaymentMethodText_(
  value
) {
  const map = {
    bank_transfer:
      '銀行轉帳',

    cash:
      '現金',

    other:
      '其他'
  };

  return (
    map[
      manualSettlementText_(
        value
      ).toLowerCase()
    ] ||
    manualSettlementText_(
      value
    ) ||
    '-'
  );
}


function manualSettlementConfirmationSourceText_(
  value
) {
  const map = {
    private_message:
      '房客私訊',

    transfer_screenshot:
      '轉帳截圖',

    phone:
      '電話通知',

    onsite_cash:
      '現場收款',

    other:
      '其他'
  };

  return (
    map[
      manualSettlementText_(
        value
      ).toLowerCase()
    ] ||
    manualSettlementText_(
      value
    ) ||
    '-'
  );
}


function manualSettlementFormatDate_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      'Asia/Taipei',
      'yyyy-MM-dd'
    );
  }

  return manualSettlementText_(
    value
  ) || '-';
}


// ==================================================
// 安裝測試
// ==================================================

/**
 * 先執行一次，建立／補齊：
 * - V2_payments
 * - V2_bills 欄位
 * - V2_manual_settlement_logs
 *
 * 不會修改任何帳單狀態。
 */
function testEnsureManualSettlementSheets() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const billSheet =
    manualSettlementEnsureBillSheet_(
      ss
    );

  const paymentSheet =
    manualSettlementEnsurePaymentSheet_(
      ss
    );

  const auditSheet =
    manualSettlementEnsureAuditSheet_(
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

      audit_sheet:
        auditSheet.getName(),

      message:
        '人工銷帳後端工作表檢查完成'
    })
  );
}

// ==================================================
// V2 已繳帳單 → V1 補同步
// ==================================================

/**
 * 將 V2 已經標記為 paid 的帳單補同步回 V1。
 *
 * 適用情況：
 * - 付款回報流程先完成 V2 銷帳
 * - V1 每月帳單／歷史帳單尚未更新
 *
 * 可重複執行。
 */
function repairV2PaidBillsToV1() {
  const lock =
    LockService.getScriptLock();

  try {
    if (!lock.tryLock(30000)) {
      return {
        success: false,
        code: 'REQUEST_BUSY',
        message:
          '系統正在執行其他同步，請稍後再試'
      };
    }

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const billSheet =
      ss.getSheetByName(
        MANUAL_SETTLEMENT_BILLS_SHEET
      );

    if (
      !billSheet ||
      billSheet.getLastRow() < 2
    ) {
      return {
        success: false,
        code: 'NO_V2_BILLS',
        message:
          'V2_bills 沒有帳單資料'
      };
    }

    const bills =
      manualSettlementGetObjects_(
        billSheet
      );

    const paidBills =
      bills.filter(function (bill) {
        return (
          manualSettlementText_(
            bill.payment_status
          ).toLowerCase() ===
          'paid'
        );
      });

    let processedCount = 0;
    let monthlyUpdatedCount = 0;
    let historyUpdatedCount = 0;
    let fullySyncedCount = 0;
    let incompleteCount = 0;

    const incomplete = [];

    paidBills.forEach(function (bill) {
      const billId =
        manualSettlementText_(
          bill.bill_id
        );

      if (!billId) {
        return;
      }

      const paymentDate =
        manualSettlementResolveRepairDate_(
          bill.paid_at ||
          bill.updated_at ||
          new Date()
        );

      const paymentId =
        manualSettlementText_(
          bill.payment_id
        ) ||
        (
          'V2-PAID-' +
          billId
        );

      const syncResult =
        manualSettlementSyncLegacy_(
          ss,
          bill,
          paymentDate,
          paymentId
        );

      processedCount++;

      if (
        syncResult.monthly.status ===
        'updated'
      ) {
        monthlyUpdatedCount++;
      }

      if (
        syncResult.history.status ===
        'updated'
      ) {
        historyUpdatedCount++;
      }

      if (
        syncResult.monthly.status ===
          'updated' &&
        syncResult.history.status ===
          'updated'
      ) {
        fullySyncedCount++;
      } else {
        incompleteCount++;

        incomplete.push({
          bill_id:
            billId,

          room_name:
            bill.room_name || '',

          bill_month:
            bill.bill_month || '',

          monthly_status:
            syncResult.monthly.status,

          monthly_message:
            syncResult.monthly.message,

          history_status:
            syncResult.history.status,

          history_message:
            syncResult.history.message
        });
      }
    });

    SpreadsheetApp.flush();

    const result = {
      success: true,
      code: 'OK',
      message:
        'V2 已繳帳單補同步完成',

      data: {
        paid_bill_count:
          paidBills.length,

        processed_count:
          processedCount,

        monthly_updated_count:
          monthlyUpdatedCount,

        history_updated_count:
          historyUpdatedCount,

        fully_synced_count:
          fullySyncedCount,

        incomplete_count:
          incompleteCount,

        incomplete:
          incomplete
      }
    };

    Logger.log(
      JSON.stringify({
        success:
          result.success,

        paid_bill_count:
          paidBills.length,

        processed_count:
          processedCount,

        fully_synced_count:
          fullySyncedCount,

        incomplete_count:
          incompleteCount
      })
    );

    return result;

  } catch (error) {
    const result = {
      success: false,
      code:
        'V2_TO_V1_REPAIR_ERROR',

      message:
        'V2 已繳帳單補同步失敗：' +
        error.message
    };

    Logger.log(
      JSON.stringify(result)
    );

    return result;

  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      // 尚未取得鎖定時忽略
    }
  }
}


/**
 * 補同步日期格式處理
 */
function manualSettlementResolveRepairDate_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  const text =
    manualSettlementText_(value);

  if (text) {
    const parsed =
      new Date(text);

    if (
      !isNaN(
        parsed.getTime()
      )
    ) {
      return parsed;
    }
  }

  return new Date();
}


/**
 * 只補同步單一帳單。
 *
 * 修改 billId 後執行，
 * 適合確認特定帳單同步結果。
 */
function testRepairSinglePaidBillToV1() {
  const billId =
    'BILL-202607-C000019';

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const billSheet =
    ss.getSheetByName(
      MANUAL_SETTLEMENT_BILLS_SHEET
    );

  if (!billSheet) {
    throw new Error(
      '找不到 V2_bills'
    );
  }

  const billData =
    manualSettlementFindRowByHeader_(
      billSheet,
      'bill_id',
      billId
    );

  if (!billData) {
    throw new Error(
      '找不到帳單：' +
      billId
    );
  }

  const bill =
    billData.object;

  if (
    manualSettlementText_(
      bill.payment_status
    ).toLowerCase() !==
    'paid'
  ) {
    throw new Error(
      '此帳單目前不是 paid'
    );
  }

  const paymentDate =
    manualSettlementResolveRepairDate_(
      bill.paid_at ||
      bill.updated_at ||
      new Date()
    );

  const paymentId =
    manualSettlementText_(
      bill.payment_id
    ) ||
    (
      'V2-PAID-' +
      billId
    );

  const result =
    manualSettlementSyncLegacy_(
      ss,
      bill,
      paymentDate,
      paymentId
    );

  SpreadsheetApp.flush();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}