// ==================================================
// V2 Payment Report Settlement
// 房東確認付款回報後正式建立付款紀錄及銷帳
// ==================================================

const V2_PAYMENT_SHEET_NAME = 'V2_payments';
const V2_BILL_SHEET_NAME = 'V2_bills';
const V2_PAYMENT_REPORT_SHEET_NAME = 'V2_payment_reports';


/**
 * 房東確認付款回報並正式銷帳
 *
 * v2_action=landlord_payment_report_settle
 */
function settleLandlordPaymentReportByLineUid_(
  landlordLineUserId,
  reportId,
  landlordNote
) {
  const action =
    'landlord_payment_report_settle';

  const lock =
    LockService.getScriptLock();

  try {
    landlordLineUserId =
      String(
        landlordLineUserId || ''
      ).trim();

    reportId =
      String(
        reportId || ''
      ).trim();

    landlordNote =
      String(
        landlordNote || ''
      ).trim();

    if (!landlordLineUserId) {
      return {
        success: false,
        code:
          'MISSING_LANDLORD_LINE_UID',
        message:
          '缺少房東 LINE UID'
      };
    }

    if (!reportId) {
      return {
        success: false,
        code:
          'MISSING_REPORT_ID',
        message:
          '缺少付款回報 ID'
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

    if (!lock.tryLock(30000)) {
      return {
        success: false,
        code: 'REQUEST_BUSY',
        message:
          '系統正在處理其他付款，請稍後再試'
      };
    }

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const reportSheet =
      ensureSettlementPaymentReportSheet_(
        ss
      );

    const billSheet =
      ensureSettlementBillSheet_(
        ss
      );

    const paymentSheet =
      ensureSettlementPaymentSheet_(
        ss
      );

    const reportData =
      findSettlementRowByHeader_(
        reportSheet,
        'report_id',
        reportId
      );

    if (!reportData) {
      return {
        success: false,
        code: 'REPORT_NOT_FOUND',
        message:
          '找不到指定付款回報'
      };
    }

    const report =
      reportData.object;

    if (
      String(
        report
          .landlord_line_user_id ||
        ''
      ).trim() !== landlordLineUserId
    ) {
      return {
        success: false,
        code:
          'REPORT_NOT_OWNED_BY_LANDLORD',
        message:
          '此付款回報不屬於目前房東'
      };
    }

    const reportStatus =
  String(
    report.status || ''
  )
    .trim()
    .toLowerCase();

const matchedPaymentId =
  String(
    report.matched_payment_id ||
    ''
  ).trim();

/*
 * 已經有 matched_payment_id，
 * 代表正式付款紀錄與銷帳都已完成。
 * 前端重送時直接回傳原結果，避免重複建立付款紀錄。
 */
if (
  reportStatus === 'confirmed' &&
  matchedPaymentId
) {
  return {
    success: true,
    code: 'ALREADY_SETTLED',
    message: '此付款回報已完成銷帳',

    data: {
      report_id:
        reportId,

      payment_id:
        matchedPaymentId,

      bill_id:
        report.bill_id || '',

      status:
        'confirmed',

      bill_payment_status:
        'paid',

      tenant_notification_success:
        null
    }
  };
}

/*
 * 相容舊版流程：
 *
 * 舊版 landlord_payment_report_update
 * 可能已先將 status 改為 confirmed，
 * 但 matched_payment_id 仍是空白，
 * 代表只有人工確認，尚未正式建立付款紀錄及銷帳。
 *
 * 因此允許以下狀態進入正式銷帳：
 * - pending
 * - payment_reported
 * - confirmed，但 matched_payment_id 必須是空白
 */
const settleableStatuses = [
  'pending',
  'payment_reported',
  'confirmed'
];

if (
  settleableStatuses.indexOf(
    reportStatus
  ) === -1
) {
  return {
    success: false,
    code:
      'REPORT_STATUS_NOT_SETTLEABLE',
    message:
      '此付款回報目前不能進行銷帳'
  };
}

    const billId =
      String(
        report.bill_id || ''
      ).trim();

    if (!billId) {
      return {
        success: false,
        code:
          'REPORT_BILL_ID_EMPTY',
        message:
          '付款回報缺少帳單 ID'
      };
    }

    const billData =
      findSettlementRowByHeader_(
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
          '找不到付款回報對應的帳單'
      };
    }

    const bill =
      billData.object;

    if (
      String(
        bill.landlord_id || ''
      ).trim() !==
      String(
        report.landlord_id || ''
      ).trim()
    ) {
      return {
        success: false,
        code:
          'BILL_LANDLORD_MISMATCH',
        message:
          '帳單與付款回報的房東資料不一致'
      };
    }

    if (
      String(
        bill.tenant_id || ''
      ).trim() !==
      String(
        report.tenant_id || ''
      ).trim()
    ) {
      return {
        success: false,
        code:
          'BILL_TENANT_MISMATCH',
        message:
          '帳單與付款回報的房客資料不一致'
      };
    }

    const billPaymentStatus =
      String(
        bill.payment_status || ''
      )
        .trim()
        .toLowerCase();

    /*
     * 帳單已繳但付款回報尚未完成時，
     * 不再建立第二筆付款紀錄。
     */
    if (
      billPaymentStatus === 'paid'
    ) {
      return {
        success: false,
        code:
          'BILL_ALREADY_PAID',
        message:
          '此帳單已經是已繳狀態，請勿重複銷帳'
      };
    }

    const billAmount =
      Number(
        bill.total_amount || 0
      );

    const reportedAmount =
      Number(
        report.reported_amount ||
        report.bill_total_amount ||
        0
      );

    if (
      billAmount <= 0 ||
      reportedAmount <= 0
    ) {
      return {
        success: false,
        code:
          'INVALID_PAYMENT_AMOUNT',
        message:
          '帳單或回報金額不正確'
      };
    }

    /*
     * 第一版只允許全額付款。
     * 未來要支援部分付款時再增加 balance。
     */
    if (
      Math.round(billAmount) !==
      Math.round(reportedAmount)
    ) {
      return {
        success: false,
        code:
          'PAYMENT_AMOUNT_MISMATCH',
        message:
          '回報金額與帳單總額不一致，無法自動銷帳'
      };
    }

    const existingPayment =
      findExistingSettlementPayment_(
        paymentSheet,
        reportId,
        billId
      );

    if (existingPayment) {
      return {
        success: false,
        code:
          'PAYMENT_ALREADY_EXISTS',
        message:
          '此付款回報已建立付款紀錄，請勿重複處理'
      };
    }

    const now =
      new Date();

    const paymentId =
      makeSettlementPaymentId_();

    const paymentDate =
      normalizeSettlementDate_(
        report.reported_paid_date,
        now
      );

    const paymentRecord = {
      payment_id:
        paymentId,

      created_at:
        now,

      updated_at:
        now,

      landlord_id:
        report.landlord_id ||
        bill.landlord_id ||
        '',

      property_id:
        bill.property_id || '',

      room_id:
        report.room_id ||
        bill.room_id ||
        '',

      contract_id:
        bill.contract_id || '',

      tenant_id:
        report.tenant_id ||
        bill.tenant_id ||
        '',

      user_id:
        report.tenant_user_id ||
        bill.user_id ||
        '',

      bill_id:
        billId,

      bill_month:
        report.bill_month ||
        bill.bill_month ||
        '',

      payment_date:
        paymentDate,

      amount:
        reportedAmount,

      payment_method:
        'bank_transfer',

      bank_last5:
        report.reported_last5 ||
        '',

      status:
        'confirmed',

      source:
        'tenant_payment_report',

      source_ref_id:
        reportId,

      confirmed_by:
        landlordLineUserId,

      note:
        landlordNote ||
        '房東確認付款回報後正式銷帳'
    };

    appendSettlementObjectRow_(
      paymentSheet,
      paymentRecord
    );

    /*
     * 更新 V2_bills
     */
    updateSettlementRowByObject_(
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
          appendSettlementNote_(
            bill.notes || '',
            '付款回報銷帳：' +
            reportId +
            '／付款ID：' +
            paymentId
          )
      }
    );

    /*
     * 更新 V2_payment_reports
     */
    updateSettlementRowByObject_(
  reportSheet,
  reportData.rowIndex,
  {
    status:
      'confirmed',

    matched_payment_id:
      paymentId,

    confirmed_at:
      now,

    confirmed_by:
      landlordLineUserId,

    rejected_at:
      '',

    reject_reason:
      '',

    updated_at:
      now,

    note:
      appendSettlementNote_(
        report.note || '',
        landlordNote ||
        '已正式銷帳'
      )
  }
);

/*
 * 同步回 V1：
 * - 1.每月帳單表
 * - 3.歷史帳單總表
 *
 * 共用 V2_MANUAL_SETTLEMENT.gs 的同步函式。
 */
const legacySyncResult =
  manualSettlementSyncLegacy_(
    ss,
    bill,
    paymentDate,
    paymentId
  );

SpreadsheetApp.flush();

    const noticeText =
      buildSettlementSuccessNotice_({
        tenant_name:
          report.tenant_name ||
          bill.tenant_name ||
          '',

        room_name:
          report.room_name ||
          bill.room_name ||
          '',

        bill_month:
          report.bill_month ||
          bill.bill_month ||
          '',

        amount:
          reportedAmount,

        reported_last5:
          report.reported_last5 ||
          '',

        payment_id:
          paymentId
      });

    const tenantLineUserId =
      String(
        report
          .tenant_line_user_id ||
        ''
      ).trim();

    let pushResult = {
      success: false,
      code:
        'TENANT_LINE_UID_EMPTY',
      message:
        '房客尚未綁定 LINE'
    };

    if (tenantLineUserId) {
      pushResult =
        pushLineTextMessage_(
          tenantLineUserId,
          noticeText
        );
    }

    cmwebsLogLineMessage_({
      direction:
        'outgoing',

      source:
        'payment_settlement',

      landlord_line_user_id:
        landlordLineUserId,

      tenant_line_user_id:
        tenantLineUserId,

      tenant_id:
        report.tenant_id || '',

      tenant_user_id:
        report.tenant_user_id ||
        '',

      tenant_name:
        report.tenant_name || '',

      room_list:
        report.room_name || '',

      message_type:
        'payment_settlement_confirmed',

      message_text:
        noticeText,

      status:
        pushResult.success
          ? 'success'
          : 'failed',

      note:
        pushResult.success
          ? 'payment settlement notice sent'
          : pushResult.message
    });

    logLiffAccess_({
      lineUserId:
        landlordLineUserId,

      userId:
        '',

      role:
        'landlord',

      action:
        action,

      targetId:
        reportId,

      result:
        'success',

      errorMessage:
        '',

      notes:
        'payment_id=' +
        paymentId +
        ', bill_id=' +
        billId
    });

    let resultMessage =
  pushResult.success
    ? '付款已確認並完成正式銷帳，房客已收到通知'
    : '付款已確認並完成正式銷帳，但房客 LINE 通知未成功';

if (
  legacySyncResult.monthly.status !==
    'updated' ||
  legacySyncResult.history.status !==
    'updated'
) {
  resultMessage +=
    '。V1 帳單同步未完全成功，請查看同步結果';
}

return {
  success: true,
  code: 'OK',
  message:
    resultMessage,

  data: {
    report_id:
      reportId,

    payment_id:
      paymentId,

    bill_id:
      billId,

    status:
      'confirmed',

    bill_payment_status:
      'paid',

    payment_amount:
      reportedAmount,

    payment_date:
      paymentDate,

    tenant_notification_success:
      pushResult.success === true,

    legacy_sync: {
      monthly:
        legacySyncResult.monthly,

      history:
        legacySyncResult.history
    }
  }
};

  } catch (error) {
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
        reportId || '',

      result:
        'failed',

      errorMessage:
        error.message
    });

    return {
      success: false,
      code:
        'SETTLEMENT_ERROR',
      message:
        '付款銷帳失敗：' +
        error.message
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      // 忽略釋放鎖定失敗
    }
  }
}


/**
 * 確保 V2_payments 存在且欄位完整
 */
function ensureSettlementPaymentSheet_(
  ss
) {
  let sheet =
    ss.getSheetByName(
      V2_PAYMENT_SHEET_NAME
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
    'confirmed_by',
    'note'
  ];

  if (!sheet) {
    sheet =
      ss.insertSheet(
        V2_PAYMENT_SHEET_NAME
      );

    sheet.appendRow(headers);

    return sheet;
  }

  ensureSettlementHeaders_(
    sheet,
    headers
  );

  return sheet;
}


/**
 * 確保 V2_bills 銷帳欄位存在
 */
function ensureSettlementBillSheet_(
  ss
) {
  const sheet =
    ss.getSheetByName(
      V2_BILL_SHEET_NAME
    );

  if (!sheet) {
    throw new Error(
      '找不到工作表：' +
      V2_BILL_SHEET_NAME
    );
  }

  ensureSettlementHeaders_(
    sheet,
    [
      'bill_id',
      'payment_status',
      'paid_at',
      'payment_id',
      'updated_at',
      'notes'
    ]
  );

  return sheet;
}


/**
 * 確保 V2_payment_reports 欄位存在
 */
function ensureSettlementPaymentReportSheet_(
  ss
) {
  const sheet =
    ss.getSheetByName(
      V2_PAYMENT_REPORT_SHEET_NAME
    );

  if (!sheet) {
    throw new Error(
      '找不到工作表：' +
      V2_PAYMENT_REPORT_SHEET_NAME
    );
  }

  ensureSettlementHeaders_(
    sheet,
    [
      'report_id',
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
      'updated_at',
      'note'
    ]
  );

  return sheet;
}


/**
 * 補上缺少欄位，不改動原欄位順序
 */
function ensureSettlementHeaders_(
  sheet,
  requiredHeaders
) {
  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  let currentHeaders =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(function (header) {
        return String(
          header || ''
        ).trim();
      });

  if (
    currentHeaders.every(
      function (header) {
        return header === '';
      }
    )
  ) {
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
        currentHeaders.indexOf(
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

        currentHeaders.push(
          header
        );
      }
    }
  );
}


/**
 * 依欄位值尋找資料列
 */
function findSettlementRowByHeader_(
  sheet,
  targetHeader,
  targetValue
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
        return String(
          header || ''
        ).trim();
      }
    );

  const headerMap = {};

  headers.forEach(
    function (header, index) {
      if (header) {
        headerMap[header] =
          index;
      }
    }
  );

  if (
    headerMap[targetHeader] ===
    undefined
  ) {
    return null;
  }

  const expected =
    String(
      targetValue || ''
    ).trim();

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    const actual =
      String(
        values[index][
          headerMap[targetHeader]
        ] || ''
      ).trim();

    if (actual === expected) {
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
 * 檢查是否已有付款紀錄
 */
function findExistingSettlementPayment_(
  paymentSheet,
  reportId,
  billId
) {
  if (
    !paymentSheet ||
    paymentSheet.getLastRow() < 2
  ) {
    return null;
  }

  const values =
    paymentSheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      function (header) {
        return String(
          header || ''
        ).trim();
      }
    );

  const sourceRefIndex =
    headers.indexOf(
      'source_ref_id'
    );

  const billIdIndex =
    headers.indexOf(
      'bill_id'
    );

  const statusIndex =
    headers.indexOf(
      'status'
    );

  if (
    sourceRefIndex === -1 ||
    billIdIndex === -1
  ) {
    return null;
  }

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    const row =
      values[index];

    const sameReport =
      String(
        row[sourceRefIndex] || ''
      ).trim() === reportId;

    const sameBill =
      String(
        row[billIdIndex] || ''
      ).trim() === billId;

    const status =
      statusIndex >= 0
        ? String(
            row[statusIndex] || ''
          )
            .trim()
            .toLowerCase()
        : '';

    if (
      (sameReport || sameBill) &&
      status !== 'void' &&
      status !== 'cancelled'
    ) {
      return row;
    }
  }

  return null;
}


/**
 * 依表頭順序新增資料
 */
function appendSettlementObjectRow_(
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
        return String(
          header || ''
        ).trim();
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
}


/**
 * 依欄位名稱更新資料列
 */
function updateSettlementRowByObject_(
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
        return String(
          header || ''
        ).trim();
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


/**
 * 產生付款 ID
 */
function makeSettlementPaymentId_() {
  const now =
    new Date();

  return (
    'PAY-' +
    Utilities.formatDate(
      now,
      V2_TIMEZONE,
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


/**
 * 標準化付款日期
 */
function normalizeSettlementDate_(
  value,
  fallbackDate
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
    '[object Date]'
  ) {
    return value;
  }

  const text =
    String(
      value || ''
    ).trim();

  if (text) {
    const parsed =
      new Date(
        text + 'T12:00:00'
      );

    if (
      !isNaN(
        parsed.getTime()
      )
    ) {
      return parsed;
    }
  }

  return fallbackDate ||
    new Date();
}


/**
 * 附加備註
 */
function appendSettlementNote_(
  originalNote,
  newNote
) {
  originalNote =
    String(
      originalNote || ''
    ).trim();

  newNote =
    String(
      newNote || ''
    ).trim();

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


/**
 * 建立銷帳成功 LINE 通知
 */
function buildSettlementSuccessNotice_(
  data
) {
  return [
    '【CMWebs 付款已確認】',
    '',
    (
      data.tenant_name ||
      '房客'
    ) + ' 您好：',
    '',
    '房東已確認收到您的款項，帳單已完成正式銷帳。',
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
    '付款金額：NT$ ' +
      Math.round(
        Number(
          data.amount || 0
        )
      ).toLocaleString(
        'zh-TW'
      ),
    '匯款後 5 碼：' +
      (
        data.reported_last5 ||
        '-'
      ),
    '付款紀錄：' +
      (
        data.payment_id ||
        '-'
      ),
    '',
    '您可至帳單頁查看最新繳款狀態，謝謝。'
  ].join('\n');
}


/**
 * 測試建立或補齊正式付款表欄位
 */
function testEnsureSettlementSheets() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const paymentSheet =
    ensureSettlementPaymentSheet_(
      ss
    );

  const billSheet =
    ensureSettlementBillSheet_(
      ss
    );

  const reportSheet =
    ensureSettlementPaymentReportSheet_(
      ss
    );

  Logger.log(
    JSON.stringify({
      payment_sheet:
        paymentSheet.getName(),

      bill_sheet:
        billSheet.getName(),

      report_sheet:
        reportSheet.getName()
    })
  );
}