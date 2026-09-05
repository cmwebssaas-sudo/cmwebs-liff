/**
 * CMWebs V2 每月租金帳單通知 Dispatcher
 *
 * 規則：
 * - 每小時由既有的 V2 自動催繳 dispatcher 呼叫一次。
 * - 台北時間每月 5 號起，補發當月已建立但尚未發送的未繳帳單。
 * - 只挑選 issued、unpaid、not_sent 帳單；已發送、已繳、取消帳單不重送。
 * - 實際 LINE 發送沿用 landlord_bill_notifications_send 的權限、綁定、
 *   log 與 sent_status 寫回流程。
 *
 * 這個模組不負責自動建立帳單。帳單仍須先經過既有的帳務建立流程，
 * 因為電費／設備耗損費可能需要本期電錶讀數。
 */

const V2_MONTHLY_BILL_NOTIFICATION_TIMEZONE_ =
  'Asia/Taipei';

const V2_MONTHLY_BILL_NOTIFICATION_DAY_ =
  5;

const V2_MONTHLY_BILL_NOTIFICATION_BILLS_SHEET_ =
  'V2_bills';


function billNotificationIsMonthlyDispatchDue_(
  dayOfMonth
) {
  return (
    Number(dayOfMonth) >=
    V2_MONTHLY_BILL_NOTIFICATION_DAY_
  );
}


function monthlyBillNotificationText_(
  value
) {
  return String(
    value === undefined ||
    value === null
      ? ''
      : value
  ).trim();
}


function monthlyBillNotificationNormalizeBillMonth_(
  value
) {
  const text =
    monthlyBillNotificationText_(
      value
    );

  const match =
    text.match(
      /^(\d{4})[-\/](\d{1,2})/
    );

  if (match) {
    return (
      match[1] +
      '-' +
      String(
        Number(match[2])
      ).padStart(2, '0')
    );
  }

  return text;
}


function billNotificationIsMonthlyBillVoided_(
  bill
) {
  return [
    'void',
    'voided',
    'cancelled',
    'canceled',
    'cancel',
    '作廢',
    '取消',
    '已取消'
  ].indexOf(
    monthlyBillNotificationText_(
      bill && bill.bill_status
    ).toLowerCase()
  ) >= 0;
}


function billNotificationIsMonthlyBillPaid_(
  bill
) {
  return [
    'paid',
    'settled',
    'confirmed',
    'complete',
    'completed',
    '已繳',
    '已繳清',
    '已付款'
  ].indexOf(
    monthlyBillNotificationText_(
      bill && bill.payment_status
    ).toLowerCase()
  ) >= 0;
}


function billNotificationIsMonthlyBillIssued_(
  bill
) {
  const status =
    monthlyBillNotificationText_(
      bill && bill.bill_status ||
      'issued'
    ).toLowerCase();

  return (
    status ===
      'issued' ||
    status === ''
  );
}


function billNotificationBuildMonthlyDispatchGroups_(
  bills,
  billMonth
) {
  const groups = {};

  (bills || []).forEach(
    function (bill) {
      const billId =
        monthlyBillNotificationText_(
          bill && bill.bill_id
        );

      const landlordLineUserId =
        monthlyBillNotificationText_(
          bill && bill.landlord_line_user_id
        );

      const sentStatus =
        monthlyBillNotificationText_(
          bill && bill.sent_status ||
          'not_sent'
        ).toLowerCase();

      if (
        !billId ||
        !landlordLineUserId ||
        monthlyBillNotificationNormalizeBillMonth_(
          bill && bill.bill_month
        ) !==
        monthlyBillNotificationNormalizeBillMonth_(
          billMonth
        ) ||
        !billNotificationIsMonthlyBillIssued_(
          bill
        ) ||
        billNotificationIsMonthlyBillVoided_(
          bill
        ) ||
        billNotificationIsMonthlyBillPaid_(
          bill
        ) ||
        sentStatus !==
          'not_sent'
      ) {
        return;
      }

      if (!groups[landlordLineUserId]) {
        groups[landlordLineUserId] = [];
      }

      groups[landlordLineUserId].push(
        billId
      );
    }
  );

  return Object.keys(groups)
    .sort()
    .map(
      function (landlordLineUserId) {
        return {
          landlord_line_user_id:
            landlordLineUserId,
          bill_ids:
            groups[landlordLineUserId]
              .slice()
              .sort()
        };
      }
    );
}


function runV2MonthlyBillNotifications(
  nowOverride
) {
  const now =
    nowOverride instanceof Date
      ? nowOverride
      : new Date();

  const dayOfMonth = Number(
    Utilities.formatDate(
      now,
      V2_MONTHLY_BILL_NOTIFICATION_TIMEZONE_,
      'd'
    )
  );

  const billMonth =
    Utilities.formatDate(
      now,
      V2_MONTHLY_BILL_NOTIFICATION_TIMEZONE_,
      'yyyy-MM'
    );

  const baseData = {
    bill_month:
      billMonth,
    day_of_month:
      dayOfMonth,
    dispatch_day:
      V2_MONTHLY_BILL_NOTIFICATION_DAY_,
    timezone:
      V2_MONTHLY_BILL_NOTIFICATION_TIMEZONE_,
    catch_up:
      dayOfMonth >
      V2_MONTHLY_BILL_NOTIFICATION_DAY_
  };

  if (
    !billNotificationIsMonthlyDispatchDue_(
      dayOfMonth
    )
  ) {
    return {
      success:
        true,
      code:
        'MONTHLY_BILL_NOT_DUE',
      message:
        '尚未到每月帳單通知日',
      data:
        Object.assign(
          {},
          baseData,
          {
            candidate_count:
              0,
            group_count:
              0,
            sent_count:
              0,
            failed_count:
              0,
            skipped_count:
              0,
            groups: []
          }
        )
    };
  }

  try {
    const ss =
      runtimeSpreadsheet_();

    const billSheet =
      ss.getSheetByName(
        V2_MONTHLY_BILL_NOTIFICATION_BILLS_SHEET_
      );

    if (!billSheet) {
      throw new Error(
        '缺少 V2_bills'
      );
    }

    const bills =
      workspaceGetObjectsWithRow_(
        billSheet
      );

    const groups =
      billNotificationBuildMonthlyDispatchGroups_(
        bills,
        billMonth
      );

    const groupResults = [];
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    groups.forEach(
      function (group) {
        let result;

        try {
          result =
            sendLandlordBillNotificationsByLineUid_(
              group.landlord_line_user_id,
              JSON.stringify(
                group.bill_ids
              )
            );
        } catch (error) {
          result = {
            success:
              false,
            code:
              'MONTHLY_BILL_NOTIFICATION_GROUP_ERROR',
            message:
              error && error.message
                ? error.message
                : String(error)
          };
        }

        const resultData =
          result && result.data
            ? result.data
            : {};

        const sent = Number(
          resultData.sent_count
        ) || 0;

        const failed = Number(
          resultData.failed_count
        ) || 0;

        const skipped = Number(
          resultData.skipped_count
        ) || 0;

        sentCount += sent;
        failedCount += failed;
        skippedCount += skipped;

        groupResults.push({
          landlord_line_user_id:
            group.landlord_line_user_id,
          requested_count:
            group.bill_ids.length,
          sent_count:
            sent,
          failed_count:
            failed,
          skipped_count:
            skipped,
          success:
            Boolean(
              result &&
              result.success === true
            ),
          code:
            result && result.code
              ? result.code
              : '',
          message:
            result && result.message
              ? result.message
              : ''
        });
      }
    );

    const candidateCount =
      groups.reduce(
        function (total, group) {
          return total + group.bill_ids.length;
        },
        0
      );

    return {
      success:
        failedCount === 0,
      code:
        failedCount === 0
          ? 'MONTHLY_BILL_NOTIFICATIONS_SENT'
          : 'MONTHLY_BILL_NOTIFICATIONS_PARTIAL',
      message:
        failedCount === 0
          ? '每月租金帳單通知 Dispatcher 執行完成'
          : '每月租金帳單通知部分失敗，請查看帳單通知紀錄',
      data:
        Object.assign(
          {},
          baseData,
          {
            candidate_count:
              candidateCount,
            group_count:
              groups.length,
            sent_count:
              sentCount,
            failed_count:
              failedCount,
            skipped_count:
              skippedCount,
            groups:
              groupResults
          }
        )
    };

  } catch (error) {
    return {
      success:
        false,
      code:
        'MONTHLY_BILL_NOTIFICATIONS_ERROR',
      message:
        '每月租金帳單通知執行失敗：' +
        (
          error && error.message
            ? error.message
            : String(error)
        ),
      data:
        Object.assign(
          {},
          baseData,
          {
            candidate_count:
              0,
            group_count:
              0,
            sent_count:
              0,
            failed_count:
              0,
            skipped_count:
              0,
            groups: []
          }
        )
    };
  }
}
