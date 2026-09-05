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

const V2_MONTHLY_BILL_SUMMARY_OUTBOX_PROPERTY_ =
  'V2_MONTHLY_BILL_SUMMARY_OUTBOX';

const V2_MONTHLY_BILL_NOTIFICATION_SENDING_TIMEOUT_MS_ =
  2 * 60 * 60 * 1000;


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


function billNotificationRecoverStaleSendingBills_(
  ss,
  billSheet,
  bills,
  billMonth
) {
  if (
    !ss ||
    !billSheet ||
    typeof billNotificationSetRowValues_ !==
      'function'
  ) {
    return 0;
  }

  const tenantBillSheet =
    typeof V2_BILL_NOTIFICATION_SHEETS_ ===
      'undefined'
      ? null
      : ss.getSheetByName(
          V2_BILL_NOTIFICATION_SHEETS_
            .tenantBillView
        );

  const now =
    new Date();

  const recoveredBills = [];

  (bills || []).forEach(
    function (bill) {
      const sentStatus =
        monthlyBillNotificationText_(
          bill &&
          bill.sent_status
        ).toLowerCase();

      if (
        sentStatus !==
        'sending' ||
        monthlyBillNotificationNormalizeBillMonth_(
          bill &&
          bill.bill_month
        ) !==
        monthlyBillNotificationNormalizeBillMonth_(
          billMonth
        )
      ) {
        return;
      }

      const updatedAt =
        bill &&
        bill.updated_at;

      const updatedAtMs =
        updatedAt instanceof Date
          ? updatedAt.getTime()
          : new Date(
              updatedAt
            ).getTime();

      if (
        !isFinite(updatedAtMs) ||
        now.getTime() - updatedAtMs <
          V2_MONTHLY_BILL_NOTIFICATION_SENDING_TIMEOUT_MS_
      ) {
        return;
      }

      const values = {
        sent_status:
          'failed',
        last_send_error:
          '上次帳單通知中斷，為避免重複發送已轉為失敗，請人工確認後重試',
        updated_at:
          now
      };

      try {
        billNotificationSetRowValues_(
          billSheet,
          bill.__row_number,
          values
        );

        if (
          tenantBillSheet &&
          typeof billNotificationSyncViewStatus_ ===
            'function'
        ) {
          billNotificationSyncViewStatus_(
            tenantBillSheet,
            bill.bill_id,
            values
          );
        }

        recoveredBills.push(
          bill
        );
      } catch (error) {
        // 保留 sending，等待下一次唯讀／人工處理，避免未知結果自動重發。
      }
    }
  );

  return recoveredBills;
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
    0 &&
    Number(
      skippedCount
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
        '沒有成功、失敗或未送出的帳單，不發送房東摘要',
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

  const notificationPayload = {
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
        group.workspace_id
          ? ''
          : group.landlord_line_user_id,
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
  };

  const summaryOutboxQueued =
    billNotificationQueueMonthlySummaryRetry_(
      group,
      billMonth,
      notificationPayload
    );

  let result;

  try {
    result = workspaceNotifyTeam_(
      notificationPayload
    );
  } catch (error) {
    result = {
      success:
        false,
      code:
        'WORKSPACE_NOTIFICATION_ERROR',
      message:
        error && error.message
          ? error.message
      : String(error)
    };
  }

  if (
    summaryOutboxQueued ===
      null &&
    !(
      result &&
      result.data &&
      result.data.notification_id
    )
  ) {
    result = {
      success:
        false,
      code:
        'MONTHLY_BILL_SUMMARY_OUTBOX_ERROR',
      message:
        '房東摘要重試佇列寫入失敗，請人工確認',
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

  const resultData =
    result && result.data
      ? result.data
      : {};

  if (
    resultData.notification_id
  ) {
    try {
      billNotificationMarkMonthlySummaryRecorded_(
        group,
        billMonth,
        resultData.notification_id
      );
      billNotificationRemoveMonthlySummaryRetry_(
        group,
        billMonth
      );
    } catch (error) {
      // 保留帶有 notification_id 的 outbox 記錄，下一輪不會重送成功通知。
    }
  }

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


function billNotificationSummaryOutboxKey_(
  group,
  billMonth
) {
  return [
    monthlyBillNotificationText_(
      group &&
      group.workspace_id
    ).toUpperCase() ||
      monthlyBillNotificationText_(
        group &&
        group.landlord_id
      ),
    monthlyBillNotificationNormalizeBillMonth_(
      billMonth
    ),
    monthlyBillNotificationText_(
      group &&
      group.landlord_line_user_id
    )
  ].join(
    '\u0000'
  );
}


function billNotificationReadMonthlySummaryOutbox_() {
  if (
    typeof PropertiesService ===
      'undefined'
  ) {
    return {};
  }

  try {
    const raw =
      PropertiesService
        .getScriptProperties()
        .getProperty(
          V2_MONTHLY_BILL_SUMMARY_OUTBOX_PROPERTY_
        );

    return raw
      ? JSON.parse(raw)
      : {};
  } catch (error) {
    return {};
  }
}


function billNotificationWriteMonthlySummaryOutbox_(
  records
) {
  if (
    typeof PropertiesService ===
      'undefined'
  ) {
    return;
  }

  PropertiesService
    .getScriptProperties()
    .setProperty(
      V2_MONTHLY_BILL_SUMMARY_OUTBOX_PROPERTY_,
      JSON.stringify(
        records ||
        {}
      )
    );

  return true;
}


function billNotificationWithSummaryOutboxLock_(
  callback
) {
  if (
    typeof LockService ===
      'undefined'
  ) {
    return callback();
  }

  const lock =
    LockService.getDocumentLock() ||
    LockService.getUserLock();

  if (!lock) {
    return callback();
  }

  let locked =
    false;

  try {
    lock.waitLock(
      25000
    );
    locked =
      true;
    return callback();
  } catch (error) {
    return null;
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


function billNotificationQueueMonthlySummaryRetry_(
  group,
  billMonth,
  payload
) {
  if (
    typeof PropertiesService ===
      'undefined'
  ) {
    return;
  }

  return billNotificationWithSummaryOutboxLock_(
    function () {
      const records =
        billNotificationReadMonthlySummaryOutbox_();

      const key =
        billNotificationSummaryOutboxKey_(
          group,
          billMonth
        );

      records[key] = {
        workspace_id:
          monthlyBillNotificationText_(
            group &&
            group.workspace_id
          ).toUpperCase(),
        bill_month:
          monthlyBillNotificationNormalizeBillMonth_(
            billMonth
          ),
        body:
          monthlyBillNotificationText_(
            payload &&
            payload.body
          ),
        fallback_line_user_id:
          monthlyBillNotificationText_(
            payload &&
            payload.fallback_line_user_id
          ),
        recipient_line_user_ids:
          Array.isArray(
            payload &&
            payload.recipient_line_user_ids
          )
            ? payload.recipient_line_user_ids
            : [],
        queued_at:
          new Date().toISOString()
      };

      return billNotificationWriteMonthlySummaryOutbox_(
        records
      );
    }
  );
}


function billNotificationRemoveMonthlySummaryRetry_(
  group,
  billMonth
) {
  if (
    typeof PropertiesService ===
      'undefined'
  ) {
    return;
  }

  billNotificationWithSummaryOutboxLock_(
    function () {
      const records =
        billNotificationReadMonthlySummaryOutbox_();

      const exactKey =
        billNotificationSummaryOutboxKey_(
          group,
          billMonth
        );

      delete records[exactKey];

      const workspaceId =
        monthlyBillNotificationText_(
          group &&
          group.workspace_id
        ).toUpperCase();

      const normalizedMonth =
        monthlyBillNotificationNormalizeBillMonth_(
          billMonth
        );

      Object.keys(
        records
      ).forEach(
        function (key) {
          const record =
            records[key] ||
            {};

          if (
            monthlyBillNotificationText_(
              record.workspace_id
            ).toUpperCase() ===
            workspaceId &&
            monthlyBillNotificationNormalizeBillMonth_(
              record.bill_month
            ) ===
            normalizedMonth
          ) {
            delete records[key];
          }
        }
      );

      billNotificationWriteMonthlySummaryOutbox_(
        records
      );
    }
  );
}


function billNotificationMarkMonthlySummaryRecorded_(
  group,
  billMonth,
  notificationId
) {
  if (
    typeof PropertiesService ===
      'undefined'
  ) {
    return;
  }

  billNotificationWithSummaryOutboxLock_(
    function () {
      const records =
        billNotificationReadMonthlySummaryOutbox_();

      const workspaceId =
        monthlyBillNotificationText_(
          group &&
          group.workspace_id
        ).toUpperCase();

      const normalizedMonth =
        monthlyBillNotificationNormalizeBillMonth_(
          billMonth
        );

      Object.keys(
        records
      ).forEach(
        function (key) {
          const record =
            records[key] ||
            {};

          if (
            monthlyBillNotificationText_(
              record.workspace_id
            ).toUpperCase() ===
            workspaceId &&
            monthlyBillNotificationNormalizeBillMonth_(
              record.bill_month
            ) ===
            normalizedMonth
          ) {
            record.notification_id =
              monthlyBillNotificationText_(
                notificationId
              );
            records[key] =
              record;
          }
        }
      );

      billNotificationWriteMonthlySummaryOutbox_(
        records
      );
    }
  );
}


function billNotificationGetMonthlySummaryOutboxCandidates_(
  billMonth
) {
  const records =
    billNotificationReadMonthlySummaryOutbox_();

  const normalizedMonth =
    monthlyBillNotificationNormalizeBillMonth_(
      billMonth
    );

  return Object.keys(
    records
  )
    .map(
      function (key) {
        return records[key];
      }
    )
    .filter(
      function (record) {
        return (
          record &&
          !record.notification_id &&
          monthlyBillNotificationNormalizeBillMonth_(
            record.bill_month
          ) ===
          normalizedMonth &&
          monthlyBillNotificationText_(
            record.body
          )
        );
      }
    )
    .map(
      function (record) {
        return {
          notification_id:
            '',
          workspace_id:
            monthlyBillNotificationText_(
              record.workspace_id
            ).toUpperCase(),
          body:
            monthlyBillNotificationText_(
              record.body
            ),
          fallback_line_user_id:
            monthlyBillNotificationText_(
              record.fallback_line_user_id
            ),
          recipient_line_user_ids:
            Array.isArray(
              record.recipient_line_user_ids
            )
              ? record.recipient_line_user_ids
              : []
        };
      }
    );
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
    return billNotificationGetMonthlySummaryOutboxCandidates_(
      billMonth
    );
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
    return billNotificationGetMonthlySummaryOutboxCandidates_(
      billMonth
    );
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

  const pending = Object.keys(
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
          fallback_line_user_id:
            '',
          recipient_line_user_ids:
            lineUserIds
        };
      }
    )
    .filter(Boolean);

  billNotificationGetMonthlySummaryOutboxCandidates_(
    billMonth
  ).forEach(
    function (candidate) {
      if (
        candidate.workspace_id &&
        latestByWorkspace[
          candidate.workspace_id
        ]
      ) {
        return;
      }

      if (
        !pending.some(
          function (item) {
            return (
              item.workspace_id ===
              candidate.workspace_id
            );
          }
        )
      ) {
        pending.push(candidate);
      }
    }
  );

  return pending;
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
          fallback_line_user_id:
            item.fallback_line_user_id ||
            '',
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

      if (
        data.notification_id
      ) {
        try {
          billNotificationMarkMonthlySummaryRecorded_(
            {
              workspace_id:
                item.workspace_id
            },
            billMonth,
            data.notification_id
          );
          billNotificationRemoveMonthlySummaryRetry_(
            {
              workspace_id:
                item.workspace_id
            },
            billMonth
          );
        } catch (error) {
          // 保留帶有 notification_id 的 outbox 記錄，下一輪不會重送成功通知。
        }
      }

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

    const recoveredStaleSendingBills =
      billNotificationRecoverStaleSendingBills_(
        ss,
        billSheet,
        bills,
        billMonth
      );

    const staleSendingRecoveredCount =
      recoveredStaleSendingBills.length;

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
    let finalizationWarningCount = 0;
    let landlordSummarySentCount = 0;
    let landlordSummaryFailedCount = 0;
    let landlordSummarySkippedCount = 0;

    recoveredStaleSendingBills.forEach(
      function (bill) {
        const workspaceId =
          monthlyBillNotificationText_(
            bill &&
            bill.workspace_id
          ).toUpperCase();
        const landlordId =
          monthlyBillNotificationText_(
            bill &&
            bill.landlord_id
          );
        const landlordLineUserId =
          monthlyBillNotificationText_(
            bill &&
            bill.landlord_line_user_id
          );
        const summaryKey = [
          workspaceId
            ? 'workspace'
            : 'legacy',
          workspaceId || landlordId,
          workspaceId
            ? ''
            : landlordLineUserId
        ].join(
          '\u0000'
        );

        if (!landlordSummaries[summaryKey]) {
          landlordSummaries[summaryKey] = {
            workspace_id:
              workspaceId,
            landlord_id:
              landlordId,
            landlord_line_user_id:
              landlordLineUserId,
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
          1;
        landlordSummaries[summaryKey].failed_count +=
          1;
        failedCount +=
          1;

        groupResults.push({
          workspace_id:
            workspaceId,
          landlord_id:
            landlordId,
          landlord_line_user_id:
            landlordLineUserId,
          requested_count:
            1,
          sent_count:
            0,
          failed_count:
            1,
          skipped_count:
            0,
          success:
            false,
          code:
            'STALE_SENDING_RECOVERED',
          message:
            '上次帳單通知中斷，已轉為失敗並需人工確認'
        });
      }
    );

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

        const finalizationWarnings =
          Array.isArray(
            resultData.finalization_warnings
          )
            ? resultData.finalization_warnings
            : [];

        finalizationWarningCount +=
          finalizationWarnings.length;

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
          finalization_warnings:
            finalizationWarnings,
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
            0 &&
            summary.skipped_count <=
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
      ) +
      staleSendingRecoveredCount;

    return {
      success:
        failedCount === 0 &&
        landlordSummaryFailedCount === 0 &&
        finalizationWarningCount === 0,
      code:
        failedCount === 0 &&
        landlordSummaryFailedCount === 0 &&
        finalizationWarningCount === 0
          ? 'MONTHLY_BILL_NOTIFICATIONS_SENT'
          : 'MONTHLY_BILL_NOTIFICATIONS_PARTIAL',
      message:
        failedCount === 0 &&
        landlordSummaryFailedCount === 0 &&
        finalizationWarningCount === 0
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
            stale_sending_recovered_count:
              staleSendingRecoveredCount,
            landlord_summary_sent_count:
              landlordSummarySentCount,
            landlord_summary_failed_count:
              landlordSummaryFailedCount,
            landlord_summary_skipped_count:
              landlordSummarySkippedCount,
            finalization_warning_count:
              finalizationWarningCount,
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
