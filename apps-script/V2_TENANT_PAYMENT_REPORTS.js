/**
 * CMWebs V2 房客付款回報後端
 *
 * Code.gs 已有路由：
 * - tenant_payment_report_init
 * - tenant_payment_report_submit
 *
 * 此檔案只需新增到同一個 Apps Script 專案，儲存後重新部署。
 */

const V2_TENANT_PAYMENT_REPORT_SHEETS_ = {
  tenantBillView:
    'V2_tenant_bill_view',
  landlordTenantListView:
    'V2_landlord_tenant_list_view',
  paymentReports:
    'V2_payment_reports'
};


/**
 * 房客付款回報頁初始化
 */
function getTenantPaymentReportInitByLineUid(
  lineUserId
) {
  const action =
    'tenant_payment_report_init';

  try {
    lineUserId =
      String(
        lineUserId || ''
      ).trim();

    if (!lineUserId) {
      return tenantPaymentReportResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE UID',
        {
          tenant: null,
          bills: [],
          reports: []
        }
      );
    }

    const homeResult =
      getTenantHomeByLineUid(
        lineUserId
      );

    if (
      !homeResult ||
      homeResult.success !== true
    ) {
      return tenantPaymentReportResult_(
        false,
        homeResult &&
        homeResult.code
          ? homeResult.code
          : 'TENANT_NOT_FOUND',
        homeResult &&
        homeResult.message
          ? homeResult.message
          : '查無房客資料，請先完成身份綁定',
        {
          tenant: null,
          bills: [],
          reports: []
        }
      );
    }

    const tenant =
      homeResult.data || {};

    const billRows =
      getSheetObjects_(
        V2_TENANT_PAYMENT_REPORT_SHEETS_
          .tenantBillView
      );

    const bills =
      billRows
        .filter(function (row) {
          const rowLineUserId =
            String(
              row.line_user_id ||
              ''
            ).trim();

          const status =
            String(
              row.payment_status ||
              ''
            )
              .trim()
              .toLowerCase();

          return (
            rowLineUserId ===
              lineUserId &&
            status !== 'paid'
          );
        })
        .map(
          tenantPaymentReportBuildBill_
        )
        .sort(function (a, b) {
          return String(
            b.bill_month || ''
          ).localeCompare(
            String(
              a.bill_month || ''
            )
          );
        });

    const reports =
      tenantPaymentReportGetReports_(
        tenant.tenant_id
      );

    tenantPaymentReportLogAccess_({
      lineUserId:
        lineUserId,
      userId:
        tenant.user_id || '',
      role:
        'tenant',
      action:
        action,
      targetId:
        tenant.tenant_id || '',
      result:
        'success',
      errorMessage:
        '',
      notes:
        'reportable_bills=' +
        bills.length +
        ', reports=' +
        reports.length
    });

    return tenantPaymentReportResult_(
      true,
      'OK',
      '查詢成功',
      {
        tenant:
          tenant,
        bills:
          bills,
        reports:
          reports
      }
    );

  } catch (error) {
    tenantPaymentReportLogAccess_({
      lineUserId:
        lineUserId || '',
      userId:
        '',
      role:
        'tenant',
      action:
        action,
      targetId:
        '',
      result:
        'failed',
      errorMessage:
        error.message
    });

    return tenantPaymentReportResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' +
        error.message,
      {
        tenant: null,
        bills: [],
        reports: []
      }
    );
  }
}


/**
 * 房客送出付款回報
 */
function submitTenantPaymentReportByLineUid_(
  lineUserId,
  billId,
  reportedLast5,
  reportedPaidDate,
  note
) {
  const action =
    'tenant_payment_report_submit';

  try {
    lineUserId =
      String(
        lineUserId || ''
      ).trim();

    billId =
      String(
        billId || ''
      ).trim();

    reportedLast5 =
      String(
        reportedLast5 || ''
      ).trim();

    reportedPaidDate =
      String(
        reportedPaidDate || ''
      ).trim();

    note =
      String(
        note || ''
      ).trim();

    if (!lineUserId) {
      return tenantPaymentReportResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE UID'
      );
    }

    if (!billId) {
      return tenantPaymentReportResult_(
        false,
        'MISSING_BILL_ID',
        '請選擇要回報的帳單'
      );
    }

    if (
      !/^\d{5}$/.test(
        reportedLast5
      )
    ) {
      return tenantPaymentReportResult_(
        false,
        'INVALID_LAST5',
        '請輸入正確的匯款後 5 碼'
      );
    }

    if (
      reportedPaidDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(
        reportedPaidDate
      )
    ) {
      return tenantPaymentReportResult_(
        false,
        'INVALID_PAID_DATE',
        '付款日期格式錯誤'
      );
    }

    if (
      note.length > 200
    ) {
      return tenantPaymentReportResult_(
        false,
        'NOTE_TOO_LONG',
        '備註最多 200 字'
      );
    }

    const homeResult =
      getTenantHomeByLineUid(
        lineUserId
      );

    if (
      !homeResult ||
      homeResult.success !== true
    ) {
      return tenantPaymentReportResult_(
        false,
        homeResult &&
        homeResult.code
          ? homeResult.code
          : 'TENANT_NOT_FOUND',
        homeResult &&
        homeResult.message
          ? homeResult.message
          : '查無房客資料，請先完成身份綁定'
      );
    }

    const tenant =
      homeResult.data || {};

    const linkRows =
      getSheetObjects_(
        V2_TENANT_PAYMENT_REPORT_SHEETS_
          .landlordTenantListView
      );

    const tenantLink =
      linkRows.find(function (row) {
        return (
          String(
            row.tenant_line_user_id ||
            ''
          ).trim() ===
            lineUserId ||
          String(
            row.tenant_id ||
            ''
          ).trim() ===
            String(
              tenant.tenant_id ||
              ''
            ).trim()
        );
      });

    if (!tenantLink) {
      return tenantPaymentReportResult_(
        false,
        'TENANT_LANDLORD_LINK_NOT_FOUND',
        '找不到房客與房東的關聯資料'
      );
    }

    const billRows =
      getSheetObjects_(
        V2_TENANT_PAYMENT_REPORT_SHEETS_
          .tenantBillView
      );

    const bill =
      billRows.find(function (row) {
        return (
          String(
            row.line_user_id ||
            ''
          ).trim() ===
            lineUserId &&
          String(
            row.bill_id ||
            ''
          ).trim() ===
            billId
        );
      });

    if (!bill) {
      return tenantPaymentReportResult_(
        false,
        'BILL_NOT_FOUND',
        '找不到指定帳單'
      );
    }

    const paymentStatus =
      String(
        bill.payment_status ||
        ''
      )
        .trim()
        .toLowerCase();

    if (paymentStatus === 'paid') {
      return tenantPaymentReportResult_(
        false,
        'BILL_ALREADY_PAID',
        '此帳單已繳清，不需要重複回報'
      );
    }

    const existingReport =
      tenantPaymentReportFindBlocking_(
        billId,
        tenant.tenant_id
      );

    if (existingReport) {
      return tenantPaymentReportResult_(
        false,
        'PAYMENT_REPORT_ALREADY_PENDING',
        '此帳單已有處理中的付款回報，請等待房東確認'
      );
    }

    const now =
      new Date();

    if (!reportedPaidDate) {
      reportedPaidDate =
        Utilities.formatDate(
          now,
          'Asia/Taipei',
          'yyyy-MM-dd'
        );
    }

    const landlordLineUserId =
      String(
        tenantLink.line_user_id ||
        tenantLink.landlord_line_user_id ||
        ''
      ).trim();

    const report = {
      report_id:
        tenantPaymentReportMakeId_(),
      created_at:
        now,
      updated_at:
        now,

      landlord_id:
        tenantLink.landlord_id ||
        '',
      landlord_line_user_id:
        landlordLineUserId,

      tenant_id:
        tenant.tenant_id ||
        '',
      tenant_user_id:
        tenant.user_id ||
        tenantLink.tenant_user_id ||
        '',
      tenant_line_user_id:
        lineUserId,
      tenant_name:
        tenant.tenant_name ||
        tenantLink.tenant_name ||
        '',

      room_id:
        bill.room_id ||
        '',
      room_name:
        bill.room_name ||
        tenant.room_list ||
        tenantLink.room_list ||
        '',

      bill_id:
        bill.bill_id ||
        '',
      bill_month:
        bill.bill_month ||
        '',
      bill_total_amount:
        Number(
          bill.total_amount ||
          0
        ),

      reported_amount:
        Number(
          bill.total_amount ||
          0
        ),
      reported_last5:
        reportedLast5,
      reported_paid_date:
        reportedPaidDate,

      status:
        'pending',
      matched_payment_id:
        '',

      confirmed_at:
        '',
      confirmed_by:
        '',
      rejected_at:
        '',
      rejected_by:
        '',
      reject_reason:
        '',

      note:
        note
    };

    tenantPaymentReportAppend_(
      report
    );

    const noticeText =
      tenantPaymentReportNoticeText_(
        report
      );


    let pushResult = {
      success:
        false,

      message:
        '管理團隊通知模組尚未載入'
    };

    if (
      typeof workspaceNotifyTeam_ ===
      'function'
    ) {
      pushResult =
        workspaceNotifyTeam_({
          workspace_id:
            tenantLink.workspace_id ||
            '',

          landlord_id:
            report.landlord_id,

          event_type:
            'payment_report',

          title:
            '收到新的付款回報',

          body:
            noticeText,

          target_type:
            'payment_report',

          target_id:
            report.report_id,

          action_url:
            'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-payment-reports.html',

          severity:
            'info',

          source:
            'tenant_payment_report',

          fallback_line_user_id:
            landlordLineUserId,

          metadata: {
            tenant_id:
              report.tenant_id,

            tenant_name:
              report.tenant_name,

            room_name:
              report.room_name,

            bill_id:
              report.bill_id,

            bill_month:
              report.bill_month
          }
        });

    } else if (
      landlordLineUserId &&
      typeof pushLineTextMessage_ ===
        'function'
    ) {
      pushResult =
        pushLineTextMessage_(
          landlordLineUserId,
          noticeText
        );
    }

    tenantPaymentReportLogAccess_({
      lineUserId:
        lineUserId,
      userId:
        report.tenant_user_id ||
        '',
      role:
        'tenant',
      action:
        action,
      targetId:
        report.report_id,
      result:
        'success',
      errorMessage:
        '',
      notes:
        'bill_id=' +
        billId
    });

    return tenantPaymentReportResult_(
      true,
      'OK',
      '付款回報已送出，請等待房東確認',
      {
        report_id:
          report.report_id,
        bill_id:
          report.bill_id,
        bill_month:
          report.bill_month,
        reported_last5:
          report.reported_last5,
        reported_paid_date:
          report.reported_paid_date,
        status:
          report.status,
        landlord_notification_success:
          Boolean(
            pushResult &&
            (
              pushResult.success ===
                true ||
              (
                pushResult.data &&
                (
                  pushResult.data.sent_count >
                    0 ||
                  pushResult.data.preference_enabled ===
                    false
                )
              )
            )
          ),

        team_notification:
          pushResult &&
          pushResult.data
            ? pushResult.data
            : pushResult
      }
    );

  } catch (error) {
    tenantPaymentReportLogAccess_({
      lineUserId:
        lineUserId || '',
      userId:
        '',
      role:
        'tenant',
      action:
        action,
      targetId:
        billId || '',
      result:
        'failed',
      errorMessage:
        error.message
    });

    return tenantPaymentReportResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' +
        error.message
    );
  }
}


function tenantPaymentReportBuildBill_(
  row
) {
  return {
    line_user_id:
      row.line_user_id,
    user_id:
      row.user_id,
    tenant_id:
      row.tenant_id,
    tenant_name:
      row.tenant_name,
    room_id:
      row.room_id,
    room_name:
      row.room_name,
    bill_id:
      row.bill_id,
    bill_month:
      row.bill_month,
    due_date:
      row.due_date,
    rent_amount:
      Number(
        row.rent_amount ||
        0
      ),
    management_fee:
      Number(
        row.management_fee ||
        0
      ),
    electricity_amount:
      Number(
        row.electricity_amount ||
        0
      ),
    equipment_amount:
      Number(
        row.equipment_amount ||
        0
      ),
    other_amount:
      Number(
        row.other_amount ||
        0
      ),
    discount_amount:
      Number(
        row.discount_amount ||
        0
      ),
    total_amount:
      Number(
        row.total_amount ||
        0
      ),
    bill_status:
      row.bill_status,
    payment_status:
      row.payment_status,
    sent_status:
      row.sent_status,
    updated_at:
      row.updated_at
  };
}


function tenantPaymentReportGetReports_(
  tenantId
) {
  tenantId =
    String(
      tenantId || ''
    ).trim();

  if (!tenantId) {
    return [];
  }

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      V2_TENANT_PAYMENT_REPORT_SHEETS_
        .paymentReports
    );

  if (!sheet) {
    return [];
  }

  return getSheetObjects_(
    V2_TENANT_PAYMENT_REPORT_SHEETS_
      .paymentReports
  )
    .filter(function (row) {
      return (
        String(
          row.tenant_id ||
          ''
        ).trim() ===
        tenantId
      );
    })
    .map(function (row) {
      return {
        report_id:
          row.report_id,
        created_at:
          row.created_at,
        updated_at:
          row.updated_at,

        landlord_id:
          row.landlord_id,
        landlord_line_user_id:
          row.landlord_line_user_id,

        tenant_id:
          row.tenant_id,
        tenant_user_id:
          row.tenant_user_id,
        tenant_line_user_id:
          row.tenant_line_user_id,
        tenant_name:
          row.tenant_name,

        room_id:
          row.room_id,
        room_name:
          row.room_name,

        bill_id:
          row.bill_id,
        bill_month:
          row.bill_month,
        bill_total_amount:
          Number(
            row.bill_total_amount ||
            0
          ),

        reported_amount:
          Number(
            row.reported_amount ||
            0
          ),
        reported_last5:
          row.reported_last5,
        reported_paid_date:
          row.reported_paid_date,

        status:
          row.status,
        matched_payment_id:
          row.matched_payment_id,

        confirmed_at:
          row.confirmed_at,
        confirmed_by:
          row.confirmed_by,
        rejected_at:
          row.rejected_at,
        rejected_by:
          row.rejected_by,
        reject_reason:
          row.reject_reason,

        note:
          row.note
      };
    })
    .sort(function (a, b) {
      const aTime =
        new Date(
          a.updated_at ||
          a.created_at ||
          0
        ).getTime();

      const bTime =
        new Date(
          b.updated_at ||
          b.created_at ||
          0
        ).getTime();

      return bTime - aTime;
    });
}


function tenantPaymentReportFindBlocking_(
  billId,
  tenantId
) {
  billId =
    String(
      billId || ''
    ).trim();

  tenantId =
    String(
      tenantId || ''
    ).trim();

  if (
    !billId ||
    !tenantId
  ) {
    return null;
  }

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      V2_TENANT_PAYMENT_REPORT_SHEETS_
        .paymentReports
    );

  if (!sheet) {
    return null;
  }

  return getSheetObjects_(
    V2_TENANT_PAYMENT_REPORT_SHEETS_
      .paymentReports
  ).find(function (row) {
    const status =
      String(
        row.status || ''
      )
        .trim()
        .toLowerCase();

    return (
      String(
        row.bill_id || ''
      ).trim() ===
        billId &&
      String(
        row.tenant_id || ''
      ).trim() ===
        tenantId &&
      [
        'pending',
        'approved',
        'confirmed',
        'settled',
        'payment_reported'
      ].indexOf(status) >= 0
    );
  }) || null;
}


function tenantPaymentReportAppend_(
  report
) {
  const sheet =
    tenantPaymentReportEnsureSheet_();

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
    headers.map(function (header) {
      return (
        report[header] !==
        undefined
          ? report[header]
          : ''
      );
    });

  sheet.appendRow(row);
}


function tenantPaymentReportEnsureSheet_() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(
      V2_TENANT_PAYMENT_REPORT_SHEETS_
        .paymentReports
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
    'rejected_by',
    'reject_reason',

    'note'
  ];

  if (!sheet) {
    sheet =
      ss.insertSheet(
        V2_TENANT_PAYMENT_REPORT_SHEETS_
          .paymentReports
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

  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  const existingHeaders =
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
    existingHeaders.every(
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
        headers.length
      )
      .setValues([
        headers
      ]);

    return sheet;
  }

  headers.forEach(function (header) {
    if (
      existingHeaders.indexOf(
        header
      ) === -1
    ) {
      const column =
        sheet.getLastColumn() +
        1;

      sheet
        .getRange(
          1,
          column
        )
        .setValue(
          header
        );

      existingHeaders.push(
        header
      );
    }
  });

  return sheet;
}


function tenantPaymentReportNoticeText_(
  report
) {
  return [
    '【CMWebs 付款回報】',
    '',
    '房客已送出付款回報，請確認是否入帳。',
    '',
    '房客：' +
      (
        report.tenant_name ||
        '-'
      ),
    '房號：' +
      (
        report.room_name ||
        '-'
      ),
    '帳單月份：' +
      (
        report.bill_month ||
        '-'
      ),
    '帳單金額：NT$ ' +
      Math.round(
        Number(
          report.bill_total_amount ||
          0
        )
      ).toLocaleString(
        'zh-TW'
      ),
    '匯款後 5 碼：' +
      (
        report.reported_last5 ||
        '-'
      ),
    '付款日期：' +
      (
        report.reported_paid_date ||
        '-'
      ),
    '',
    '狀態：待房東確認'
  ].join('\n');
}


function tenantPaymentReportMakeId_() {
  return (
    'PR-' +
    Utilities.formatDate(
      new Date(),
      'Asia/Taipei',
      'yyyyMMddHHmmss'
    ) +
    '-' +
    Math.floor(
      1000 +
      Math.random() * 9000
    )
  );
}


function tenantPaymentReportResult_(
  success,
  code,
  message,
  data
) {
  return {
    success:
      success === true,
    code:
      code || '',
    message:
      message || '',
    data:
      data === undefined
        ? null
        : data
  };
}


function tenantPaymentReportLogAccess_(
  payload
) {
  if (
    typeof logLiffAccess_ ===
    'function'
  ) {
    try {
      logLiffAccess_(
        payload
      );
    } catch (error) {
      // 存取紀錄失敗不影響主流程。
    }
  }
}


/**
 * 測試：建立或補齊 V2_payment_reports
 */
function testEnsureV2PaymentReportsSheet() {
  const sheet =
    tenantPaymentReportEnsureSheet_();

  Logger.log(
    JSON.stringify({
      success: true,
      sheet_name:
        sheet.getName(),
      last_column:
        sheet.getLastColumn()
    })
  );

  return {
    success: true,
    sheet_name:
      sheet.getName(),
    last_column:
      sheet.getLastColumn()
  };
}


/**
 * 測試：付款回報初始化
 */
function testTenantPaymentReportInit() {
  const result =
    getTenantPaymentReportInitByLineUid(
      getRequiredScriptProperty_('TEST_TENANT_LINE_UID')
    );

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
