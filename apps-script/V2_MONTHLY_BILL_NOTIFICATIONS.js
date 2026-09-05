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

      const workspaceId =
        monthlyBillNotificationText_(
          bill && bill.workspace_id
        ).toUpperCase();

      const landlordId =
        monthlyBillNotificationText_(
          bill && bill.landlord_id
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

      const groupKey = [
        workspaceId,
        landlordId,
        landlordLineUserId
      ].join(
        '\u0000'
      );

      if (!groups[groupKey]) {
        groups[groupKey] = {
          workspace_id:
            workspaceId,
          landlord_id:
            landlordId,
          landlord_line_user_id:
            landlordLineUserId,
          bill_ids: []
        };
      }

      groups[groupKey].bill_ids.push(
        billId
      );
    }
  );

  return Object.keys(groups)
    .sort()
    .map(
      function (groupKey) {
        const group = groups[groupKey];

        return {
          workspace_id:
            group.workspace_id,
          landlord_id:
            group.landlord_id,
          landlord_line_user_id:
            group.landlord_line_user_id,
          bill_ids:
            group.bill_ids
              .slice()
              .sort()
        };
      }
    );
}


function billNotificationBuildLandlordMonthlySummaryText_(
  billMonth,
  sentCount,
  failedCount,
  skippedCount
) {
  const normalizedMonth =
    monthlyBillNotificationNormalizeBillMonth_(
      billMonth
    );

  const monthMatch =
    normalizedMonth.match(
      /^(\d{4})-(\d{2})$/
    );

  const monthLabel =
    monthMatch
      ? monthMatch[1] +
        '年' +
        Number(
          monthMatch[2]
        ) +
        '月'
      : normalizedMonth;

  const sent = Math.max(
    0,
    Math.round(
      Number(
        sentCount
      ) ||
      0
    )
  );

  const failed = Math.max(
    0,
    Math.round(
      Number(
        failedCount
      ) ||
      0
    )
  );

  const skipped = Math.max(
    0,
    Math.round(
      Number(
        skippedCount
      ) ||
      0
    )
  );

  return (
    '本月（' +
    monthLabel +
    '）租金帳單已發出，共 ' +
    sent +
    ' 筆' +
    (
      failed >
      0
      ? '；另有 ' +
          failed +
          ' 筆發送失敗，請查看帳單通知紀錄'
        : ''
    ) +
    (
      skipped >
      0
        ? '；另有 ' +
          skipped +
          ' 筆未送出，請查看帳單通知紀錄'
        : ''
    ) +
    '。'
  );
}


function billNotificationSendLandlordMonthlySummary_(
  group,
  billMonth,
  sentCount,
  failedCount,
  skippedCount
) {
  if (
    Number(
      sentCount
    ) <=
    0 &&
    Number(
      failedCount
    ) <=
    0
  ) {
    return {
      success:
        true,
      delivered:
        false,
      code:
        'MONTHLY_BILL_LANDLORD_SUMMARY_SKIPPED',
      message:
        '沒有成功發送的帳單，不發送房東摘要',
      data: {
        sent_count:
          0,
        failed_count:
          0,
        skipped_count:
          1
      }
    };
  }

  if (
    typeof workspaceNotifyTeam_ !==
    'function'
  ) {
    return {
      success:
        false,
      delivered:
        false,
      code:
        'WORKSPACE_NOTIFICATION_MODULE_REQUIRED',
      message:
        '找不到團隊通知模組',
      data: {
        sent_count:
          0,
        failed_count:
          1,
        skipped_count:
          0
      }
    };
  }

  const result =
    workspaceNotifyTeam_({
      workspace_id:
        group.workspace_id,
      landlord_id:
        group.landlord_id,
      event_type:
        'bill_created',
      title:
        '本月租金帳單已發出',
      body:
        billNotificationBuildLandlordMonthlySummaryText_(
          billMonth,
          sentCount,
          failedCount,
          skippedCount
        ),
      target_type:
        'monthly_bill_dispatch',
      target_id:
        billMonth,
      severity:
        Number(
          failedCount
        ) >
        0
          ? 'warning'
          : 'info',
      source:
        'monthly_bill_notification_dispatcher',
      fallback_line_user_id:
        group.landlord_line_user_id,
      metadata: {
        bill_month:
          billMonth,
        sent_count:
          Number(
            sentCount
          ) ||
          0,
        failed_count:
          Number(
            failedCount
          ) ||
          0,
        skipped_count:
          Number(
            skippedCount
          ) ||
          0
      }
    });

  const resultData =
    result && result.data
      ? result.data
      : {};

  const sent = Number(
    resultData.sent_count
  ) ||
    0;

  const failed = Number(
    resultData.failed_count
  ) ||
    (
      result &&
      result.success ===
        false
        ? 1
        : 0
    );

  const skipped = Number(
    resultData.skipped_count
  ) ||
    0;

  return {
    success:
      Boolean(
        result &&
        result.success ===
          true
      ),
    delivered:
      sent >
      0,
    code:
      result && result.code
        ? result.code
        : '',
    message:
      result && result.message
        ? result.message
        : '',
    data: {
      sent_count:
        sent,
      failed_count:
        failed,
      skipped_count:
        skipped,
      status:
        resultData.status ||
        ''
    }
  };
}


function billNotificationFindPendingMonthlySummaryRetries_(
  ss,
  billMonth
) {
  if (
    !ss ||
    typeof workspaceGetObjectsWithRow_ !==
      'function' ||
    typeof V2_WORKSPACE_NOTIFICATION_SHEETS_ ===
      'undefined'
  ) {
    return [];
  }

  const notificationSheet =
    ss.getSheetByName(
      V2_WORKSPACE_NOTIFICATION_SHEETS_
        .notifications
    );

  const deliverySheet =
    ss.getSheetByName(
      V2_WORKSPACE_NOTIFICATION_SHEETS_
        .deliveries
    );

  if (!notificationSheet || !deliverySheet) {
    return [];
  }

  const normalizedMonth =
    monthlyBillNotificationNormalizeBillMonth_(
      billMonth
    );

  const notifications =
    workspaceGetObjectsWithRow_(
      notificationSheet
    );

  const deliveries =
    workspaceGetObjectsWithRow_(
      deliverySheet
    );

  const latestByWorkspace = {};

  notifications.forEach(
    function (notification) {
      if (
        monthlyBillNotificationText_(
          notification &&
          notification.event_type
        ) !==
        'bill_created' ||
        monthlyBillNotificationText_(
          notification &&
          notification.target_type
        ) !==
        'monthly_bill_dispatch' ||
        monthlyBillNotificationNormalizeBillMonth_(
          notification &&
          notification.target_id
        ) !==
        normalizedMonth
      ) {
        return;
      }

      const workspaceId =
        monthlyBillNotificationText_(
          notification &&
          notification.workspace_id
        ).toUpperCase();

      if (workspaceId) {
        latestByWorkspace[
          workspaceId
        ] = notification;
      }
    }
  );

  return Object.keys(
    latestByWorkspace
  )
    .sort()
    .map(
      function (workspaceId) {
        const notification =
          latestByWorkspace[
            workspaceId
          ];

        if (
          [
            'failed',
            'partial'
          ].indexOf(
            monthlyBillNotificationText_(
              notification.status
            ).toLowerCase()
          ) <
          0
        ) {
          return null;
        }

        const recipientLineUserIds = {};

        deliveries.forEach(
          function (delivery) {
            if (
              monthlyBillNotificationText_(
                delivery &&
                delivery.notification_id
              ) !==
              monthlyBillNotificationText_(
                notification.notification_id
              ) ||
              [
                'failed',
                'skipped_unbound'
              ].indexOf(
                monthlyBillNotificationText_(
                  delivery &&
                  delivery.delivery_status
                ).toLowerCase()
              ) <
              0
            ) {
              return;
            }

            const lineUserId =
              monthlyBillNotificationText_(
                delivery &&
                delivery.line_user_id
              );

            if (lineUserId) {
              recipientLineUserIds[
                lineUserId
              ] = true;
            }
          }
        );

        const lineUserIds =
          Object.keys(
            recipientLineUserIds
          ).sort();

        if (
          lineUserIds.length ===
          0
        ) {
          return null;
        }

        return {
          notification_id:
            monthlyBillNotificationText_(
              notification.notification_id
            ),
          workspace_id:
            workspaceId,
          body:
            monthlyBillNotificationText_(
              notification.event_body
            ),
          recipient_line_user_ids:
            lineUserIds
        };
      }
    )
    .filter(Boolean);
}


function billNotificationRetryPendingMonthlySummaries_(
  ss,
  billMonth
) {
  const pending =
    billNotificationFindPendingMonthlySummaryRetries_(
      ss,
      billMonth
    );

  if (
    pending.length ===
    0 ||
    typeof workspaceNotifyTeam_ !==
      'function'
  ) {
    return [];
  }

  return pending.map(
    function (item) {
      let result;

      try {
        result = workspaceNotifyTeam_({
          workspace_id:
            item.workspace_id,
          event_type:
            'bill_created',
          title:
            '本月租金帳單已發出',
          body:
            item.body,
          target_type:
            'monthly_bill_dispatch',
          target_id:
            billMonth,
          severity:
            'warning',
          source:
            'monthly_bill_notification_dispatcher_retry',
          recipient_line_user_ids:
            item.recipient_line_user_ids,
          metadata: {
            bill_month:
              billMonth,
            retry_of_notification_id:
              item.notification_id
          }
        });
      } catch (error) {
        result = {
          success:
            false,
          data: {
            failed_count:
              item.recipient_line_user_ids.length
          }
        };
      }

      const data =
        result &&
        result.data
          ? result.data
          : {};

      return {
        workspace_id:
          item.workspace_id,
        notification_id:
          item.notification_id,
        sent_count:
          Number(
            data.sent_count
          ) ||
          0,
        failed_count:
          Number(
            data.failed_count
          ) ||
          (
            result &&
            result.success ===
              false
              ? item.recipient_line_user_ids.length
              : 0
          ),
        skipped_count:
          Number(
            data.skipped_count
          ) ||
          0,
        code:
          result &&
          result.code
            ? result.code
            : '',
        message:
          result &&
          result.message
            ? result.message
            : ''
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
            landlord_summary_sent_count:
              0,
            landlord_summary_failed_count:
              0,
            landlord_summary_skipped_count:
              0,
            landlord_summaries:
              [],
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
    const landlordSummaries = {};
    const landlordSummaryResults = [];
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let landlordSummarySentCount = 0;
    let landlordSummaryFailedCount = 0;
    let landlordSummarySkippedCount = 0;

    const retryResults =
      billNotificationRetryPendingMonthlySummaries_(
        ss,
        billMonth
      );

    retryResults.forEach(
      function (retry) {
        landlordSummarySentCount +=
          retry.sent_count;
        landlordSummaryFailedCount +=
          retry.failed_count;
        landlordSummarySkippedCount +=
          retry.skipped_count;

        landlordSummaryResults.push({
          workspace_id:
            retry.workspace_id,
          landlord_id:
            '',
          landlord_line_user_id:
            '',
          bill_count:
            0,
          bill_failed_count:
            0,
          sent_count:
            retry.sent_count,
          failed_count:
            retry.failed_count,
          skipped_count:
            retry.skipped_count,
          delivered:
            retry.sent_count > 0,
          code:
            retry.code,
          message:
            retry.message,
          status:
            'retry'
        });
      }
    );

    groups.forEach(
      function (group) {
        let result;

        try {
          result =
            sendLandlordBillNotificationsByLineUid_(
              group.landlord_line_user_id,
              JSON.stringify(
                group.bill_ids
              ),
              {
                workspace_id:
                  group.workspace_id,
                only_unsent:
                  true
              }
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
        ) ||
          (
            result &&
            result.success ===
              false
              ? Number(
                  resultData.requested_count
                ) ||
                group.bill_ids.length
              : 0
          );

        const skipped = Number(
          resultData.skipped_count
        ) || 0;

        sentCount += sent;
        failedCount += failed;
        skippedCount += skipped;

        const summaryKey = [
          group.workspace_id
            ? 'workspace'
            : 'legacy',
          group.workspace_id ||
            group.landlord_id,
          group.workspace_id
            ? ''
            : group.landlord_line_user_id
        ].join(
          '\u0000'
        );

        if (!landlordSummaries[summaryKey]) {
          landlordSummaries[summaryKey] = {
            workspace_id:
              group.workspace_id,
            landlord_id:
              group.landlord_id,
            landlord_line_user_id:
              group.landlord_line_user_id,
            requested_count:
              0,
            sent_count:
              0,
            failed_count:
              0,
            skipped_count:
              0
          };
        }

        landlordSummaries[summaryKey].requested_count +=
          group.bill_ids.length;
        landlordSummaries[summaryKey].sent_count +=
          sent;
        landlordSummaries[summaryKey].failed_count +=
          failed;
        landlordSummaries[summaryKey].skipped_count +=
          skipped;

        groupResults.push({
          workspace_id:
            group.workspace_id,
          landlord_id:
            group.landlord_id,
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

    Object.keys(
      landlordSummaries
    )
      .sort()
      .forEach(
        function (summaryKey) {
          const summary =
            landlordSummaries[
              summaryKey
            ];

          if (
            summary.sent_count <=
            0 &&
            summary.failed_count <=
            0
          ) {
            return;
          }

          const summaryResult =
            billNotificationSendLandlordMonthlySummary_(
              summary,
              billMonth,
              summary.sent_count,
              summary.failed_count,
              summary.skipped_count
            );

          const summaryData =
            summaryResult &&
            summaryResult.data
              ? summaryResult.data
              : {};

          const sent = Number(
            summaryData.sent_count
          ) ||
            0;

          const failed = Number(
            summaryData.failed_count
          ) ||
            0;

          const skipped = Number(
            summaryData.skipped_count
          ) ||
            0;

          landlordSummarySentCount +=
            sent;
          landlordSummaryFailedCount +=
            failed;

          if (
            skipped >
            0 ||
            (
              sent ===
              0 &&
              failed ===
              0
            )
          ) {
            landlordSummarySkippedCount +=
              Math.max(
                1,
                skipped
              );
          }

          landlordSummaryResults.push({
            workspace_id:
              summary.workspace_id,
            landlord_id:
              summary.landlord_id,
            landlord_line_user_id:
              summary.landlord_line_user_id,
            bill_count:
              summary.sent_count,
            bill_failed_count:
              summary.failed_count,
            sent_count:
              sent,
            failed_count:
              failed,
            skipped_count:
              skipped,
            delivered:
              Boolean(
                summaryResult &&
                summaryResult.delivered ===
                  true
              ),
            code:
              summaryResult &&
              summaryResult.code
                ? summaryResult.code
                : '',
            message:
              summaryResult &&
              summaryResult.message
                ? summaryResult.message
                : '',
            status:
              summaryData.status ||
              ''
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
        failedCount === 0 &&
        landlordSummaryFailedCount === 0,
      code:
        failedCount === 0 &&
        landlordSummaryFailedCount === 0
          ? 'MONTHLY_BILL_NOTIFICATIONS_SENT'
          : 'MONTHLY_BILL_NOTIFICATIONS_PARTIAL',
      message:
        failedCount === 0 &&
        landlordSummaryFailedCount === 0
          ? (
              landlordSummarySkippedCount >
              0
                ? '每月租金帳單已發送，但房東摘要未透過 LINE 送達'
                : '每月租金帳單通知 Dispatcher 執行完成'
            )
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
            landlord_summary_sent_count:
              landlordSummarySentCount,
            landlord_summary_failed_count:
              landlordSummaryFailedCount,
            landlord_summary_skipped_count:
              landlordSummarySkippedCount,
            landlord_summaries:
              landlordSummaryResults,
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
            landlord_summary_sent_count:
              0,
            landlord_summary_failed_count:
              0,
            landlord_summary_skipped_count:
              0,
            landlord_summaries:
              [],
            groups: []
          }
        )
    };
  }
}
