/**
 * ==============================================================
 * CMWebs V2 正式自動催繳
 * ==============================================================
 * 規則：
 * - 逾期第 2 天：第一次自動催繳
 * - 逾期第 6 天：第二次自動催繳
 * - 逾期第 15 天：最後一次自動催繳
 * - 逾期第 16 天起：停止自動催繳，轉房東人工處理
 *
 * 補送規則：
 * - 排程若錯過指定日，會補送目前應進入的最高階段。
 * - 歷史欠款若已逾期 15 天以上，只補送第 15 天最終通知一次，
 *   不會補發第 2 天與第 6 天通知。
 *
 * 防重規則：
 * - 同一 bill_id + reminder_stage 成功後，不再重複發送。
 * - 同一房東、同一房客、同一次執行最多推送一則 LINE。
 * - 同一房客有多張欠款時，會合併成一則通知。
 *
 * 依賴既有函式：
 * - pushLineTextMessage_(toLineUserId, text)
 * - cmwebsLogLineMessage_(data)（存在時會同步寫入 LINE 訊息紀錄）
 */

const AUTO_REMINDER_TIMEZONE = 'Asia/Taipei';
const AUTO_REMINDER_TRIGGER_HOUR = 10;

/*
 * 舊版固定 2、6、15 天。
 * 新版會優先讀取各 Workspace 的 V2_workspace_settings。
 * 此常數只作為尚未建立設定資料時的安全預設。
 */
const AUTO_REMINDER_STAGES = [
  1,
  3,
  7
];

const AUTO_REMINDER_BILLS_SHEET = 'V2_bills';
const AUTO_REMINDER_TENANT_VIEW_SHEET = 'V2_landlord_tenant_list_view';
const AUTO_REMINDER_LANDLORD_VIEW_SHEET = 'V2_landlord_home_view';
const AUTO_REMINDER_LANDLORDS_SHEET = 'V2_landlords';
const AUTO_REMINDER_WORKSPACES_SHEET = 'V2_workspaces';
const AUTO_REMINDER_WORKSPACE_SETTINGS_SHEET = 'V2_workspace_settings';
const AUTO_REMINDER_LOG_SHEET = 'V2_payment_reminder_logs';

const AUTO_REMINDER_TRIGGER_HANDLER =
  'runV2AutomaticPaymentReminders';

const AUTO_REMINDER_LOG_HEADERS = [
  'reminder_log_id',
  'created_at',
  'run_id',
  'workspace_id',
  'workspace_name',
  'timezone',
  'configured_reminder_days',
  'landlord_id',
  'landlord_line_user_id',
  'tenant_id',
  'tenant_user_id',
  'tenant_line_user_id',
  'tenant_name',
  'bill_id',
  'bill_month',
  'room_name',
  'due_date',
  'days_overdue',
  'reminder_stage',
  'scheduled_day',
  'status',
  'line_message_id',
  'error_message',
  'message_text',
  'manual_follow_up_required',
  'notes'
];

const AUTO_REMINDER_BILL_TRACKING_HEADERS = [
  'reminder_count',
  'last_reminder_at',
  'last_reminder_stage',
  'manual_follow_up_required',
  'manual_follow_up_at'
];


// ==============================================================
// 對外執行函式
// ==============================================================

/**
 * 建立／補齊催繳紀錄表及 V2_bills 追蹤欄位。
 * 不會傳送 LINE。
 */
function testV2AutomaticPaymentReminderWorkspaceSchedules() {
  const ss =
    autoReminderGetSpreadsheet_();

  const result = {
    success:
      true,

    code:
      'OK',

    message:
      'Workspace 自動催繳設定讀取完成',

    data: {
      schedules:
        autoReminderBuildAllWorkspaceSchedules_(
          ss,
          new Date(),
          false
        )
    }
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


function testEnsureV2AutomaticPaymentReminderSheet() {
  const ss = autoReminderGetSpreadsheet_();
  const logSheet = autoReminderEnsureLogSheet_(ss);
  const billSheet = autoReminderRequireSheet_(ss, AUTO_REMINDER_BILLS_SHEET);

  autoReminderEnsureHeaders_(
    billSheet,
    AUTO_REMINDER_BILL_TRACKING_HEADERS
  );

  const result = {
    success: true,
    code: 'OK',
    message: '自動催繳工作表與欄位已就緒',
    data: {
      log_sheet: logSheet.getName(),
      bill_sheet: billSheet.getName(),
      trigger_mode:
        'hourly_workspace_dispatcher',
      default_timezone:
        AUTO_REMINDER_TIMEZONE,
      default_trigger_hour:
        AUTO_REMINDER_TRIGGER_HOUR,
      default_reminder_days:
        AUTO_REMINDER_STAGES.slice()
    }
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


/**
 * 預覽今天預計發送的自動催繳名單。
 * 不寫入、不發送 LINE、不變更帳單。
 */
function previewV2AutomaticPaymentReminders() {
  const result =
    autoReminderExecute_({
      dryRun:
        true,

      /*
       * 手動預覽時忽略目前時段，但仍尊重 Workspace
       * 是否啟用自動提醒以及設定的提醒天數。
       */
      ignoreSchedule:
        true,

      now:
        new Date()
    });

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * 預覽「目前這一小時」排程實際會處理的 Workspace。
 * 不寫入、不發送 LINE。
 */
function previewV2AutomaticPaymentRemindersScheduledNow() {
  const result =
    autoReminderExecute_({
      dryRun:
        true,

      ignoreSchedule:
        false,

      now:
        new Date()
    });

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * 正式執行自動催繳。
 * 此函式也是每日時間觸發器的執行入口。
 */
function runV2AutomaticPaymentReminders() {
  const result =
    autoReminderExecute_({
      dryRun:
        false,

      ignoreSchedule:
        false,

      now:
        new Date()
    });

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * 安裝每日自動催繳觸發器。
 * 預設每天台北時間上午 10 點附近執行。
 * 會先刪除同名舊觸發器，避免重複安裝。
 */
function installV2AutomaticPaymentReminderTrigger() {
  removeV2AutomaticPaymentReminderTrigger();

  /*
   * 多 Workspace 可設定不同時區與發送小時，
   * 因此改為每小時執行一次 Dispatcher。
   * 實際是否發送由各 Workspace 的設定判斷。
   */
  const trigger =
    ScriptApp
      .newTrigger(
        AUTO_REMINDER_TRIGGER_HANDLER
      )
      .timeBased()
      .everyHours(
        1
      )
      .create();

  const result = {
    success:
      true,

    code:
      'OK',

    message:
      '每小時自動催繳 Dispatcher 已建立',

    data: {
      handler_function:
        AUTO_REMINDER_TRIGGER_HANDLER,

      trigger_mode:
        'every_hours_1',

      workspace_schedule_source:
        AUTO_REMINDER_WORKSPACE_SETTINGS_SHEET,

      default_timezone:
        AUTO_REMINDER_TIMEZONE,

      default_hour:
        AUTO_REMINDER_TRIGGER_HOUR,

      default_reminder_days:
        AUTO_REMINDER_STAGES.slice(),

      trigger_id:
        trigger.getUniqueId()
    }
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * 依全部 Workspace 的啟用狀態同步觸發器。
 *
 * - 至少一個 Workspace 啟用：確保存在一個每小時觸發器。
 * - 全部停用：移除觸發器。
 */
function syncV2AutomaticPaymentReminderTrigger() {
  const ss =
    autoReminderGetSpreadsheet_();

  const schedules =
    autoReminderBuildAllWorkspaceSchedules_(
      ss,
      new Date(),
      true
    );

  const enabledCount =
    schedules.filter(
      function (schedule) {
        return (
          schedule.workspace_active !==
            false &&
          schedule.enabled ===
            true
        );
      }
    ).length;

  const currentTriggers =
    ScriptApp
      .getProjectTriggers()
      .filter(
        function (trigger) {
          return (
            trigger.getHandlerFunction() ===
            AUTO_REMINDER_TRIGGER_HANDLER
          );
        }
      );

  let action =
    'unchanged';

  if (
    enabledCount >
      0 &&
    currentTriggers.length ===
      0
  ) {
    installV2AutomaticPaymentReminderTrigger();

    action =
      'installed';

  } else if (
    enabledCount ===
      0 &&
    currentTriggers.length >
      0
  ) {
    removeV2AutomaticPaymentReminderTrigger();

    action =
      'removed';

  } else if (
    currentTriggers.length >
    1
  ) {
    installV2AutomaticPaymentReminderTrigger();

    action =
      'deduplicated';
  }

  const finalTriggers =
    ScriptApp
      .getProjectTriggers()
      .filter(
        function (trigger) {
          return (
            trigger.getHandlerFunction() ===
            AUTO_REMINDER_TRIGGER_HANDLER
          );
        }
      );

  const result = {
    success:
      true,

    code:
      'OK',

    message:
      '自動催繳觸發器已同步',

    data: {
      action:
        action,

      enabled_workspace_count:
        enabledCount,

      workspace_count:
        schedules.length,

      trigger_installed:
        finalTriggers.length >
        0,

      trigger_count:
        finalTriggers.length,

      trigger_mode:
        'hourly_workspace_dispatcher',

      schedules:
        schedules
    }
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * 移除自動催繳觸發器。
 */
function removeV2AutomaticPaymentReminderTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removedCount = 0;

  triggers.forEach(function (trigger) {
    if (
      trigger.getHandlerFunction() ===
      'runV2AutomaticPaymentReminders'
    ) {
      ScriptApp.deleteTrigger(trigger);
      removedCount++;
    }
  });

  const result = {
    success: true,
    code: 'OK',
    message: '自動催繳觸發器清理完成',
    data: {
      removed_count: removedCount
    }
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


/**
 * 檢查目前是否已安裝自動催繳觸發器。
 */
function inspectV2AutomaticPaymentReminderTriggers() {
  const rows = ScriptApp
    .getProjectTriggers()
    .filter(function (trigger) {
      return (
        trigger.getHandlerFunction() ===
        AUTO_REMINDER_TRIGGER_HANDLER
      );
    })
    .map(function (trigger) {
      return {
        handler_function:
          trigger.getHandlerFunction(),

        event_type:
          String(
            trigger.getEventType()
          ),

        trigger_mode:
          'hourly_workspace_dispatcher',
        trigger_source: String(trigger.getTriggerSource()),
        trigger_id: trigger.getUniqueId()
      };
    });

  const result = {
    success: true,
    code: 'OK',
    message: '觸發器查詢完成',
    data: {
      installed: rows.length > 0,
      count: rows.length,
      triggers: rows
    }
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


// ==============================================================
// 主執行流程
// ==============================================================

function autoReminderExecute_(options) {
  options = options || {};

  const dryRun =
    options.dryRun ===
    true;

  const ignoreSchedule =
    options.ignoreSchedule ===
    true;

  const now =
    options.now instanceof Date
      ? options.now
      : new Date();

  const runId = autoReminderMakeId_('REM-RUN', now);
  const todayKey = autoReminderDateKey_(now);

  let lock = null;

  try {
    if (!dryRun) {
      lock = LockService.getScriptLock();
      lock.waitLock(30000);
    }

    const ss = autoReminderGetSpreadsheet_();
    const billSheet = autoReminderRequireSheet_(
      ss,
      AUTO_REMINDER_BILLS_SHEET
    );
    const tenantSheet = autoReminderRequireSheet_(
      ss,
      AUTO_REMINDER_TENANT_VIEW_SHEET
    );
    const landlordSheet = autoReminderRequireSheet_(
      ss,
      AUTO_REMINDER_LANDLORD_VIEW_SHEET
    );
    const logSheet =
      autoReminderEnsureLogSheet_(
        ss
      );

    const landlordRegistryRows =
      autoReminderGetObjects_(
        ss.getSheetByName(
          AUTO_REMINDER_LANDLORDS_SHEET
        )
      );

    const workspaceRows =
      autoReminderGetObjects_(
        ss.getSheetByName(
          AUTO_REMINDER_WORKSPACES_SHEET
        )
      );

    const workspaceSettingsRows =
      autoReminderGetObjects_(
        ss.getSheetByName(
          AUTO_REMINDER_WORKSPACE_SETTINGS_SHEET
        )
      );

    autoReminderEnsureHeaders_(
      billSheet,
      AUTO_REMINDER_BILL_TRACKING_HEADERS
    );

    const bills =
      autoReminderGetObjects_(
        billSheet
      );

    const tenantRows =
      autoReminderGetObjects_(
        tenantSheet
      );

    const landlordRows =
      autoReminderGetObjects_(
        landlordSheet
      );

    const logRows =
      autoReminderGetObjects_(
        logSheet
      );

    const context =
      autoReminderBuildContext_(
        tenantRows,
        landlordRows,
        logRows,
        landlordRegistryRows,
        workspaceRows,
        workspaceSettingsRows,
        ss,
        now,
        ignoreSchedule
      );

    const plan = autoReminderBuildPlan_(
      bills,
      context,
      now
    );

    const result = {
      success: true,
      code: 'OK',
      message: dryRun
        ? '自動催繳預覽完成，未發送 LINE'
        : '自動催繳執行完成',
      data: {
        dry_run: dryRun,
        run_id: runId,
        today: todayKey,
        dispatcher_timezone:
          AUTO_REMINDER_TIMEZONE,

        schedule_enforced:
          !ignoreSchedule,

        schedule_source:
          AUTO_REMINDER_WORKSPACE_SETTINGS_SHEET,

        default_reminder_days:
          AUTO_REMINDER_STAGES.slice(),

        workspace_schedules:
          autoReminderContextScheduleSummary_(
            context
          ),

        scanned_bill_count:
          bills.length,
        unpaid_issued_count: plan.unpaidIssuedCount,
        eligible_bill_count: plan.eligibleBillCount,
        send_group_count: plan.sendGroups.length,
        manual_follow_up_count: plan.manualItems.length,
        skipped_count: plan.skippedItems.length,

        success_group_count: 0,
        failed_group_count: 0,
        success_bill_count: 0,
        failed_bill_count: 0,
        manual_marked_count: 0,

        send_groups: [],
        manual_follow_up: plan.manualItems,
        skipped: plan.skippedItems
      }
    };

    if (dryRun) {
      result.data.send_groups = plan.sendGroups.map(function (group) {
        return autoReminderPreviewGroup_(group);
      });

      return result;
    }

    if (typeof pushLineTextMessage_ !== 'function') {
      throw new Error(
        '找不到 pushLineTextMessage_，請確認 V2_API.gs 的 LINE Push 函式仍存在'
      );
    }

    // 已完成 Workspace 設定的最終催繳階段，並進入下一天者，標記為人工處理。
    plan.manualItems.forEach(function (item) {
      const changed = autoReminderMarkManualFollowUp_(
        billSheet,
        logSheet,
        item,
        runId,
        now,
        context
      );

      if (changed) {
        result.data.manual_marked_count++;
      }
    });

    plan.sendGroups.forEach(function (group) {
      const messageText = autoReminderBuildMessage_(group);
      let pushResult = null;

      try {
        pushResult = pushLineTextMessage_(
          group.tenantLineUserId,
          messageText
        );
      } catch (pushError) {
        pushResult = {
          success: false,
          code: 'LINE_PUSH_EXCEPTION',
          message: pushError && pushError.message
            ? pushError.message
            : String(pushError)
        };
      }

      const pushSuccess = Boolean(
        pushResult && pushResult.success === true
      );

      const lineMessageId = autoReminderText_(
        pushResult && (
          pushResult.line_message_id ||
          pushResult.message_id
        )
      );

      const groupSummary = autoReminderPreviewGroup_(group);
      groupSummary.status = pushSuccess ? 'success' : 'failed';
      groupSummary.error_message = pushSuccess
        ? ''
        : autoReminderText_(
            pushResult && pushResult.message
          );

      result.data.send_groups.push(groupSummary);

      if (pushSuccess) {
        result.data.success_group_count++;
      } else {
        result.data.failed_group_count++;
      }

      group.items.forEach(function (item) {
        autoReminderAppendLog_(logSheet, {
          reminder_log_id: autoReminderMakeId_('REM', now),
          created_at:
            now,

          run_id:
            runId,

          workspace_id:
            item.workspaceId,

          workspace_name:
            item.workspaceName,

          timezone:
            item.timezone,

          configured_reminder_days:
            item.reminderStages.join(
              ','
            ),

          landlord_id:
            item.landlordId,
          landlord_line_user_id: item.landlordLineUserId,
          tenant_id: item.tenantId,
          tenant_user_id: item.tenantUserId,
          tenant_line_user_id: item.tenantLineUserId,
          tenant_name: item.tenantName,
          bill_id: item.billId,
          bill_month: item.billMonth,
          room_name: item.roomName,
          due_date: item.dueDate,
          days_overdue: item.daysOverdue,
          reminder_stage: String(item.stage),
          scheduled_day: item.stage,
          status: pushSuccess ? 'success' : 'failed',
          line_message_id: lineMessageId,
          error_message: pushSuccess
            ? ''
            : autoReminderText_(
                pushResult && pushResult.message
              ),
          message_text: messageText,
          manual_follow_up_required:
            item.daysOverdue >=
              item.manualFollowUpDay &&
            item.stage ===
              item.finalStage,
          notes: 'automatic_payment_reminder'
        });

        if (pushSuccess) {
          autoReminderUpdateBillAfterSuccess_(
            billSheet,
            item,
            now
          );

          context.successStageKeys[
            autoReminderStageKey_(
              item.billId,
              item.stage
            )
          ] = true;

          result.data.success_bill_count++;

          if (
            item.stage ===
              item.finalStage &&
            item.daysOverdue >=
              item.manualFollowUpDay
          ) {
            const manualChanged = autoReminderMarkManualFollowUp_(
              billSheet,
              logSheet,
              item,
              runId,
              now,
              context
            );

            if (manualChanged) {
              result.data.manual_marked_count++;
            }
          }
        } else {
          result.data.failed_bill_count++;
        }
      });

      autoReminderWriteLineMessageLog_(
        group,
        messageText,
        pushSuccess,
        pushResult,
        runId,
        lineMessageId
      );
    });

    result.data.team_notifications =
      autoReminderNotifyWorkspaceTeams_(
        plan,
        result,
        now
      );

    SpreadsheetApp.flush();
    return result;

  } catch (error) {
    return {
      success: false,
      code: 'AUTO_PAYMENT_REMINDER_ERROR',
      message:
        '自動催繳執行失敗：' +
        (
          error && error.message
            ? error.message
            : String(error)
        ),
      data: {
        dry_run: dryRun,
        run_id: runId,
        today: todayKey
      }
    };

  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // 不影響主流程
      }
    }
  }
}


// ==============================================================
// Workspace 團隊通知
// ==============================================================

function autoReminderNotifyWorkspaceTeams_(
  plan,
  result,
  now
) {
  if (
    typeof workspaceNotifyTeam_ !==
    'function'
  ) {
    return [];
  }

  const workspaceMap = {};

  function ensureWorkspace(
    workspaceId,
    workspaceName,
    landlordId,
    landlordLineUserId
  ) {
    const key =
      autoReminderText_(
        workspaceId
      ).toUpperCase() ||
      (
        'LANDLORD|' +
        autoReminderText_(
          landlordId
        )
      );

    if (
      !workspaceMap[
        key
      ]
    ) {
      workspaceMap[
        key
      ] = {
        workspace_id:
          autoReminderText_(
            workspaceId
          ).toUpperCase(),

        workspace_name:
          autoReminderText_(
            workspaceName
          ),

        landlord_id:
          autoReminderText_(
            landlordId
          ),

        landlord_line_user_id:
          autoReminderText_(
            landlordLineUserId
          ),

        success_groups:
          0,

        failed_groups:
          0,

        success_bills:
          0,

        failed_bills:
          0,

        manual_items:
          0,

        rooms:
          [],

        errors:
          []
      };
    }

    return workspaceMap[
      key
    ];
  }

  plan.sendGroups.forEach(
    function (group, index) {
      const summary =
        result.data.send_groups[
          index
        ] ||
        {};

      const bucket =
        ensureWorkspace(
          group.workspaceId,
          group.workspaceName,
          group.landlordId,
          group.landlordLineUserId
        );

      if (
        summary.status ===
        'success'
      ) {
        bucket.success_groups +=
          1;

        bucket.success_bills +=
          group.items.length;

      } else {
        bucket.failed_groups +=
          1;

        bucket.failed_bills +=
          group.items.length;

        if (
          summary.error_message
        ) {
          bucket.errors.push(
            summary.error_message
          );
        }
      }

      group.items.forEach(
        function (item) {
          const roomLabel =
            (
              item.roomName ||
              '-'
            ) +
            '（逾期 ' +
            item.daysOverdue +
            ' 天）';

          if (
            bucket.rooms.indexOf(
              roomLabel
            ) ===
            -1
          ) {
            bucket.rooms.push(
              roomLabel
            );
          }
        }
      );
    }
  );

  plan.manualItems.forEach(
    function (item) {
      const bucket =
        ensureWorkspace(
          item.workspaceId,
          item.workspaceName,
          item.landlordId,
          item.landlordLineUserId
        );

      bucket.manual_items +=
        1;

      const roomLabel =
        (
          item.roomName ||
          '-'
        ) +
        '（轉人工處理）';

      if (
        bucket.rooms.indexOf(
          roomLabel
        ) ===
        -1
      ) {
        bucket.rooms.push(
          roomLabel
        );
      }
    }
  );

  const notifications = [];

  Object.keys(
    workspaceMap
  ).forEach(
    function (key) {
      const item =
        workspaceMap[
          key
        ];

      if (
        item.success_groups >
          0 ||
        item.manual_items >
          0
      ) {
        const lines = [
          '自動催繳已完成。',
          '成功通知：' +
            item.success_groups +
            ' 組／' +
            item.success_bills +
            ' 筆帳單'
        ];

        if (
          item.manual_items >
          0
        ) {
          lines.push(
            '轉人工處理：' +
            item.manual_items +
            ' 筆'
          );
        }

        if (
          item.rooms.length >
          0
        ) {
          lines.push(
            '房間：' +
            item.rooms
              .slice(
                0,
                6
              )
              .join(
                '、'
              )
          );
        }

        try {
          const response =
            workspaceNotifyTeam_({
              workspace_id:
                item.workspace_id,

              landlord_id:
                item.landlord_id,

              event_type:
                'overdue',

              title:
                item.manual_items >
                  0
                  ? '催繳完成，部分帳單需人工處理'
                  : '自動催繳已完成',

              body:
                lines.join(
                  '\n'
                ),

              target_type:
                'overdue_batch',

              target_id:
                result.data.run_id,

              action_url:
                'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-arrears.html',

              severity:
                item.manual_items >
                  0
                  ? 'warning'
                  : 'info',

              source:
                'automatic_payment_reminder',

              fallback_line_user_id:
                item.landlord_line_user_id,

              metadata: {
                run_id:
                  result.data.run_id,

                success_group_count:
                  item.success_groups,

                success_bill_count:
                  item.success_bills,

                manual_follow_up_count:
                  item.manual_items
              }
            });

          notifications.push(
            response &&
            response.data
              ? response.data
              : response
          );

        } catch (error) {
          notifications.push({
            success:
              false,

            code:
              'OVERDUE_TEAM_NOTIFICATION_ERROR',

            message:
              error.message
          });
        }
      }

      if (
        item.failed_groups >
        0
      ) {
        const lines = [
          '自動催繳 LINE 發送出現異常。',
          '失敗通知：' +
            item.failed_groups +
            ' 組／' +
            item.failed_bills +
            ' 筆帳單'
        ];

        if (
          item.rooms.length >
          0
        ) {
          lines.push(
            '房間：' +
            item.rooms
              .slice(
                0,
                6
              )
              .join(
                '、'
              )
          );
        }

        if (
          item.errors.length >
          0
        ) {
          lines.push(
            '錯誤：' +
            item.errors
              .slice(
                0,
                3
              )
              .join(
                '；'
              )
          );
        }

        try {
          const response =
            workspaceNotifyTeam_({
              workspace_id:
                item.workspace_id,

              landlord_id:
                item.landlord_id,

              event_type:
                'line_failure',

              title:
                '自動催繳 LINE 發送失敗',

              body:
                lines.join(
                  '\n'
                ),

              target_type:
                'overdue_batch',

              target_id:
                result.data.run_id,

              action_url:
                'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-arrears.html',

              severity:
                'error',

              source:
                'automatic_payment_reminder',

              fallback_line_user_id:
                item.landlord_line_user_id,

              metadata: {
                run_id:
                  result.data.run_id,

                failed_group_count:
                  item.failed_groups,

                failed_bill_count:
                  item.failed_bills
              }
            });

          notifications.push(
            response &&
            response.data
              ? response.data
              : response
          );

        } catch (error) {
          notifications.push({
            success:
              false,

            code:
              'LINE_FAILURE_TEAM_NOTIFICATION_ERROR',

            message:
              error.message
          });
        }
      }
    }
  );

  return notifications;
}


// ==============================================================
// 建立催繳計畫
// ==============================================================

function autoReminderBuildPlan_(
  bills,
  context,
  now
) {
  const groups = {};
  const manualItems = [];
  const skippedItems = [];

  let unpaidIssuedCount = 0;
  let eligibleBillCount = 0;

  bills.forEach(
    function (bill) {
      const billId =
        autoReminderText_(
          bill.bill_id
        );

      const paymentStatus =
        autoReminderNormalizePaymentStatus_(
          bill.payment_status
        );

      const billStatus =
        autoReminderNormalizeBillStatus_(
          bill.bill_status
        );

      if (
        paymentStatus !==
        'unpaid'
      ) {
        return;
      }

      if (
        billStatus !==
        'issued'
      ) {
        return;
      }

      unpaidIssuedCount +=
        1;

      if (!billId) {
        skippedItems.push({
          bill_id:
            '',

          room_name:
            autoReminderText_(
              bill.room_name
            ),

          reason:
            '帳單缺少 bill_id'
        });

        return;
      }

      const landlordId =
        autoReminderText_(
          bill.landlord_id
        );

      const tenantId =
        autoReminderText_(
          bill.tenant_id
        );

      const tenantUserId =
        autoReminderText_(
          bill.tenant_user_id ||
          bill.user_id
        );

      const tenant =
        context.tenantById[
          tenantId
        ] ||
        context.tenantByUserId[
          tenantUserId
        ] ||
        null;

      const landlord =
        context.landlordById[
          landlordId
        ] ||
        null;

      const workspaceId =
        autoReminderResolveWorkspaceId_(
          bill,
          tenant,
          landlord,
          landlordId,
          context
        );

      const schedule =
        autoReminderResolveWorkspaceSchedule_(
          context,
          workspaceId
        );

      if (
        schedule.workspace_active ===
        false
      ) {
        return;
      }

      if (
        schedule.enabled !==
        true
      ) {
        return;
      }

      if (
        !context.ignoreSchedule &&
        schedule.due_now !==
        true
      ) {
        return;
      }

      const timezone =
        schedule.timezone ||
        AUTO_REMINDER_TIMEZONE;

      const dueDate =
        autoReminderDateKey_(
          bill.due_date,
          timezone
        );

      const daysOverdue =
        autoReminderDaysOverdue_(
          bill.due_date,
          now,
          timezone
        );

      const reminderStages =
        schedule.reminder_days
          .slice()
          .sort(
            function (a, b) {
              return a - b;
            }
          );

      const stage =
        autoReminderResolveStage_(
          daysOverdue,
          reminderStages
        );

      if (!stage) {
        return;
      }

      const finalStage =
        reminderStages[
          reminderStages.length -
          1
        ];

      const manualFollowUpDay =
        finalStage +
        1;

      const stageKey =
        autoReminderStageKey_(
          billId,
          stage
        );

      const maxSuccessfulStage =
        Number(
          context
            .maxSuccessStageByBill[
              billId
            ] ||
          0
        );

      const item = {
        sheetRow:
          bill._sheet_row,

        billId:
          billId,

        billMonth:
          autoReminderBillMonth_(
            bill.bill_month,
            timezone
          ),

        roomId:
          autoReminderText_(
            bill.room_id
          ),

        roomName:
          autoReminderText_(
            bill.room_name
          ),

        totalAmount:
          autoReminderNumber_(
            bill.total_amount
          ),

        dueDate:
          dueDate,

        daysOverdue:
          daysOverdue,

        stage:
          stage,

        finalStage:
          finalStage,

        manualFollowUpDay:
          manualFollowUpDay,

        reminderStages:
          reminderStages,

        workspaceId:
          workspaceId,

        workspaceName:
          schedule.workspace_name ||
          '',

        timezone:
          timezone,

        scheduledHour:
          schedule.hour,

        landlordId:
          landlordId,

        landlordName:
          autoReminderText_(
            landlord &&
            landlord.landlord_name
          ),

        landlordLineUserId:
          autoReminderText_(
            landlord &&
            landlord.line_user_id
          ),

        tenantId:
          tenantId,

        tenantUserId:
          autoReminderText_(
            (
              tenant &&
              (
                tenant.tenant_user_id ||
                tenant.user_id
              )
            ) ||
            tenantUserId
          ),

        tenantLineUserId:
          autoReminderText_(
            tenant &&
            tenant
              .tenant_line_user_id
          ),

        tenantName:
          autoReminderText_(
            bill.tenant_name ||
            (
              tenant &&
              tenant.tenant_name
            )
          ),

        tenantBindingStatus:
          autoReminderText_(
            tenant &&
            tenant
              .tenant_binding_status
          ),

        tenantAccountStatus:
          autoReminderText_(
            tenant &&
            (
              tenant
                .tenant_account_status ||
              tenant.account_status
            )
          )
      };

      /*
       * 最終階段已成功，且已進入下一天：
       * 不再自動催繳，轉房東人工處理。
       */
      if (
        daysOverdue >=
          manualFollowUpDay &&
        maxSuccessfulStage >=
          finalStage
      ) {
        manualItems.push(
          autoReminderPublicItem_(
            item
          )
        );

        return;
      }

      /*
       * 精確階段已成功，或歷史成功階段比目前階段更高，
       * 均視為已完成，避免設定天數調整後重複發送舊階段。
       */
      if (
        context
          .successStageKeys[
            stageKey
          ] ||
        maxSuccessfulStage >=
          stage
      ) {
        return;
      }

      if (
        !landlordId ||
        !landlord
      ) {
        skippedItems.push(
          autoReminderSkippedItem_(
            item,
            '找不到房東資料'
          )
        );

        return;
      }

      if (
        !tenantId ||
        !tenant
      ) {
        skippedItems.push(
          autoReminderSkippedItem_(
            item,
            '找不到房客資料'
          )
        );

        return;
      }

      if (
        !item
          .tenantLineUserId
      ) {
        skippedItems.push(
          autoReminderSkippedItem_(
            item,
            '房客尚未綁定 LINE'
          )
        );

        return;
      }

      if (
        !autoReminderIsBindingUsable_(
          item
            .tenantBindingStatus
        )
      ) {
        skippedItems.push(
          autoReminderSkippedItem_(
            item,
            '房客 LINE 綁定狀態不可用'
          )
        );

        return;
      }

      if (
        !autoReminderIsAccountActive_(
          item
            .tenantAccountStatus
        )
      ) {
        skippedItems.push(
          autoReminderSkippedItem_(
            item,
            '房客帳號不是啟用狀態'
          )
        );

        return;
      }

      eligibleBillCount +=
        1;

      const groupKey = [
        workspaceId ||
          'legacy',
        landlordId,
        tenantId,
        item.tenantLineUserId
      ].join(
        '|'
      );

      if (
        !groups[
          groupKey
        ]
      ) {
        groups[
          groupKey
        ] = {
          groupKey:
            groupKey,

          workspaceId:
            workspaceId,

          workspaceName:
            item.workspaceName,

          timezone:
            timezone,

          reminderStages:
            reminderStages,

          finalStage:
            finalStage,

          landlordId:
            landlordId,

          landlordName:
            item.landlordName ||
            '房東',

          landlordLineUserId:
            item.landlordLineUserId,

          tenantId:
            tenantId,

          tenantUserId:
            item.tenantUserId,

          tenantLineUserId:
            item.tenantLineUserId,

          tenantName:
            item.tenantName ||
            '房客',

          items:
            []
        };
      }

      groups[
        groupKey
      ].items.push(
        item
      );
    }
  );

  const sendGroups =
    Object.keys(
      groups
    )
      .map(
        function (key) {
          const group =
            groups[
              key
            ];

          group.items.sort(
            function (a, b) {
              if (
                a.daysOverdue !==
                b.daysOverdue
              ) {
                return (
                  b.daysOverdue -
                  a.daysOverdue
                );
              }

              return String(
                a.roomName
              ).localeCompare(
                String(
                  b.roomName
                ),
                'zh-TW',
                {
                  numeric:
                    true
                }
              );
            }
          );

          group.messageStage =
            group.items.reduce(
              function (
                maxStage,
                item
              ) {
                return Math.max(
                  maxStage,
                  item.stage
                );
              },
              0
            );

          group.totalAmount =
            group.items.reduce(
              function (
                sum,
                item
              ) {
                return (
                  sum +
                  item.totalAmount
                );
              },
              0
            );

          return group;
        }
      )
      .sort(
        function (a, b) {
          if (
            a.messageStage !==
            b.messageStage
          ) {
            return (
              b.messageStage -
              a.messageStage
            );
          }

          return String(
            a.tenantName
          ).localeCompare(
            String(
              b.tenantName
            ),
            'zh-TW'
          );
        }
      );

  return {
    unpaidIssuedCount:
      unpaidIssuedCount,

    eligibleBillCount:
      eligibleBillCount,

    sendGroups:
      sendGroups,

    manualItems:
      manualItems,

    skippedItems:
      skippedItems
  };
}


function autoReminderResolveStage_(
  daysOverdue,
  reminderStages
) {
  const stages =
    autoReminderNormalizeStages_(
      reminderStages
    );

  let resolved =
    0;

  stages.forEach(
    function (stage) {
      if (
        daysOverdue >=
        stage
      ) {
        resolved =
          stage;
      }
    }
  );

  return resolved;
}


// ==============================================================
// LINE 訊息
// ==============================================================

function autoReminderBuildMessage_(group) {
  const stage =
    Number(
      group.messageStage ||
      0
    );

  const reminderStages =
    autoReminderNormalizeStages_(
      group.reminderStages
    );

  const finalStage =
    reminderStages[
      reminderStages.length -
      1
    ];

  const firstStage =
    reminderStages[0];

  const isFinal =
    stage >=
    finalStage;

  const isFollowUp =
    !isFinal &&
    stage >
    firstStage;

  const title =
    isFinal
      ? '【CMWebs 最終租屋繳費提醒】'
      : '【CMWebs 租屋繳費提醒】';

  let intro =
    '';

  let ending =
    '';

  if (isFinal) {
    intro =
      '系統顯示您的租屋帳款已逾期較長時間，這是最後一次自動催繳通知。';

    ending =
      '請儘速完成繳款或主動聯絡房東說明。此後將轉由房東人工處理。';

  } else if (isFollowUp) {
    intro =
      '系統再次提醒，您目前仍有租屋帳款尚未完成繳款。';

    ending =
      '請儘速完成繳款；完成後請至 CMWebs「回報付款」提交資料。';

  } else {
    intro =
      '系統提醒，您目前有租屋帳款已逾期尚未完成繳款。';

    ending =
      '請完成繳款後至 CMWebs「回報付款」提交資料。';
  }

  const lines = [
    title,
    '',
    (group.tenantName || '房客') + ' 您好：',
    '',
    intro,
    ''
  ];

  group.items.forEach(function (item, index) {
    if (group.items.length > 1) {
      lines.push('帳單 ' + (index + 1));
    }

    lines.push('房號：' + (item.roomName || '-'));
    lines.push('帳單月份：' + (item.billMonth || '-'));
    lines.push('繳款期限：' + (item.dueDate || '-'));
    lines.push('逾期天數：' + item.daysOverdue + ' 天');
    lines.push(
      '未繳金額：NT$ ' +
      Math.round(item.totalAmount || 0).toLocaleString('zh-TW')
    );

    if (index < group.items.length - 1) {
      lines.push('');
    }
  });

  if (group.items.length > 1) {
    lines.push('');
    lines.push(
      '未繳合計：NT$ ' +
      Math.round(group.totalAmount || 0).toLocaleString('zh-TW')
    );
  }

  lines.push('');
  lines.push(ending);
  lines.push('');
  lines.push(
    '此訊息由 ' +
    (group.landlordName || '房東') +
    ' 的 CMWebs 租屋管理系統自動發送。'
  );

  return lines.join('\n');
}


function autoReminderWriteLineMessageLog_(
  group,
  messageText,
  success,
  pushResult,
  runId,
  lineMessageId
) {
  if (typeof cmwebsLogLineMessage_ !== 'function') {
    return;
  }

  try {
    cmwebsLogLineMessage_({
      direction: 'outgoing',
      source: 'auto_payment_reminder',
      line_message_id: lineMessageId || '',
      reply_token: '',

      landlord_line_user_id: group.landlordLineUserId || '',
      tenant_line_user_id: group.tenantLineUserId || '',
      tenant_id: group.tenantId || '',
      tenant_user_id: group.tenantUserId || '',
      tenant_name: group.tenantName || '',
      room_list: group.items
        .map(function (item) {
          return item.roomName;
        })
        .filter(Boolean)
        .join(', '),

      message_type:
        'automatic_payment_reminder_stage_' +
        group.messageStage,
      message_text: messageText,
      status: success ? 'success' : 'failed',
      note: success
        ? 'run_id=' + runId
        : 'run_id=' + runId + '; ' +
          autoReminderText_(
            pushResult && pushResult.message
          )
    });
  } catch (logError) {
    // LINE 訊息紀錄失敗，不影響催繳主流程。
  }
}


// ==============================================================
// 人工處理與帳單追蹤欄位
// ==============================================================

function autoReminderUpdateBillAfterSuccess_(billSheet, item, now) {
  const headerMap = autoReminderHeaderMap_(billSheet);
  const rowNumber = Number(item.sheetRow || 0);

  if (rowNumber < 2) {
    return;
  }

  const reminderCountColumn = headerMap.reminder_count;
  const lastReminderAtColumn = headerMap.last_reminder_at;
  const lastReminderStageColumn = headerMap.last_reminder_stage;

  if (reminderCountColumn) {
    const currentCount = autoReminderNumber_(
      billSheet
        .getRange(rowNumber, reminderCountColumn)
        .getValue()
    );

    billSheet
      .getRange(rowNumber, reminderCountColumn)
      .setValue(currentCount + 1);
  }

  if (lastReminderAtColumn) {
    billSheet
      .getRange(rowNumber, lastReminderAtColumn)
      .setValue(now);
  }

  if (lastReminderStageColumn) {
    billSheet
      .getRange(rowNumber, lastReminderStageColumn)
      .setValue(item.stage);
  }
}


function autoReminderMarkManualFollowUp_(
  billSheet,
  logSheet,
  item,
  runId,
  now,
  context
) {
  const billId = item.billId;

  if (!billId) {
    return false;
  }

  const alreadyLogged = Boolean(
    context.manualRequiredBillIds[billId]
  );

  const headerMap = autoReminderHeaderMap_(billSheet);
  const rowNumber = Number(item.sheetRow || 0);

  if (rowNumber >= 2) {
    if (headerMap.manual_follow_up_required) {
      billSheet
        .getRange(
          rowNumber,
          headerMap.manual_follow_up_required
        )
        .setValue(true);
    }

    if (headerMap.manual_follow_up_at) {
      const currentValue = billSheet
        .getRange(
          rowNumber,
          headerMap.manual_follow_up_at
        )
        .getValue();

      if (!currentValue) {
        billSheet
          .getRange(
            rowNumber,
            headerMap.manual_follow_up_at
          )
          .setValue(now);
      }
    }
  }

  if (alreadyLogged) {
    return false;
  }

  autoReminderAppendLog_(logSheet, {
    reminder_log_id: autoReminderMakeId_('REM-MANUAL', now),
    created_at:
      now,

    run_id:
      runId,

    workspace_id:
      item.workspaceId,

    workspace_name:
      item.workspaceName,

    timezone:
      item.timezone,

    configured_reminder_days:
      item.reminderStages.join(
        ','
      ),

    landlord_id:
      item.landlordId,
    landlord_line_user_id: item.landlordLineUserId,
    tenant_id: item.tenantId,
    tenant_user_id: item.tenantUserId,
    tenant_line_user_id: item.tenantLineUserId,
    tenant_name: item.tenantName,
    bill_id: item.billId,
    bill_month: item.billMonth,
    room_name: item.roomName,
    due_date: item.dueDate,
    days_overdue: item.daysOverdue,
    reminder_stage: 'manual',
    scheduled_day:
      item.manualFollowUpDay,
    status: 'manual_required',
    line_message_id: '',
    error_message: '',
    message_text: '',
    manual_follow_up_required: true,
    notes:
      '第 ' +
      item.finalStage +
      ' 天最終催繳完成，轉房東人工處理'
  });

  context.manualRequiredBillIds[billId] = true;
  return true;
}


// ==============================================================
// 索引與防重
// ==============================================================

function autoReminderBuildContext_(
  tenantRows,
  landlordRows,
  logRows,
  landlordRegistryRows,
  workspaceRows,
  workspaceSettingsRows,
  ss,
  now,
  ignoreSchedule
) {
  const tenantById = {};
  const tenantByUserId = {};
  const landlordById = {};
  const workspaceByLandlordId = {};
  const workspaceRowsById = {};
  const workspaceSettingsById = {};
  const successStageKeys = {};
  const maxSuccessStageByBill = {};
  const manualRequiredBillIds = {};

  tenantRows.forEach(
    function (row) {
      const tenantId =
        autoReminderText_(
          row.tenant_id
        );

      const userId =
        autoReminderText_(
          row.tenant_user_id ||
          row.user_id
        );

      if (tenantId) {
        tenantById[
          tenantId
        ] =
          row;
      }

      if (userId) {
        tenantByUserId[
          userId
        ] =
          row;
      }
    }
  );

  landlordRows.forEach(
    function (row) {
      const landlordId =
        autoReminderText_(
          row.landlord_id
        );

      if (landlordId) {
        landlordById[
          landlordId
        ] =
          row;
      }
    }
  );

  landlordRegistryRows.forEach(
    function (row) {
      const landlordId =
        autoReminderText_(
          row.landlord_id
        );

      const workspaceId =
        autoReminderText_(
          row.workspace_id
        ).toUpperCase();

      if (
        landlordId &&
        workspaceId
      ) {
        workspaceByLandlordId[
          landlordId
        ] =
          workspaceId;
      }

      if (
        landlordId &&
        !landlordById[
          landlordId
        ]
      ) {
        landlordById[
          landlordId
        ] =
          row;
      }
    }
  );

  workspaceRows.forEach(
    function (row) {
      const workspaceId =
        autoReminderText_(
          row.workspace_id
        ).toUpperCase();

      if (workspaceId) {
        workspaceRowsById[
          workspaceId
        ] =
          row;
      }
    }
  );

  workspaceSettingsRows.forEach(
    function (row) {
      const workspaceId =
        autoReminderText_(
          row.workspace_id
        ).toUpperCase();

      if (workspaceId) {
        workspaceSettingsById[
          workspaceId
        ] =
          row;
      }
    }
  );

  logRows.forEach(
    function (row) {
      const billId =
        autoReminderText_(
          row.bill_id
        );

      const stageText =
        autoReminderText_(
          row.reminder_stage
        );

      const stage =
        Number(
          stageText
        );

      const status =
        autoReminderText_(
          row.status
        ).toLowerCase();

      if (
        billId &&
        status ===
          'success' &&
        Number.isFinite(
          stage
        ) &&
        stage >
          0
      ) {
        successStageKeys[
          autoReminderStageKey_(
            billId,
            stage
          )
        ] =
          true;

        maxSuccessStageByBill[
          billId
        ] =
          Math.max(
            Number(
              maxSuccessStageByBill[
                billId
              ] ||
              0
            ),
            stage
          );
      }

      if (
        billId &&
        status ===
          'manual_required'
      ) {
        manualRequiredBillIds[
          billId
        ] =
          true;
      }
    }
  );

  return {
    ss:
      ss,

    now:
      now,

    ignoreSchedule:
      ignoreSchedule ===
      true,

    tenantById:
      tenantById,

    tenantByUserId:
      tenantByUserId,

    landlordById:
      landlordById,

    workspaceByLandlordId:
      workspaceByLandlordId,

    workspaceRowsById:
      workspaceRowsById,

    workspaceSettingsById:
      workspaceSettingsById,

    workspaceScheduleById:
      {},

    successStageKeys:
      successStageKeys,

    maxSuccessStageByBill:
      maxSuccessStageByBill,

    manualRequiredBillIds:
      manualRequiredBillIds
  };
}


function autoReminderStageKey_(billId, stage) {
  return (
    autoReminderText_(
      billId
    ) +
    '|' +
    String(
      stage
    )
  );
}


function autoReminderResolveWorkspaceId_(
  bill,
  tenant,
  landlord,
  landlordId,
  context
) {
  return autoReminderText_(
    bill.workspace_id ||
    (
      tenant &&
      tenant.workspace_id
    ) ||
    (
      landlord &&
      landlord.workspace_id
    ) ||
    context
      .workspaceByLandlordId[
        landlordId
      ]
  ).toUpperCase();
}


function autoReminderResolveWorkspaceSchedule_(
  context,
  workspaceId
) {
  const key =
    workspaceId ||
    '__LEGACY_DEFAULT__';

  if (
    context.workspaceScheduleById[
      key
    ]
  ) {
    return context
      .workspaceScheduleById[
        key
      ];
  }

  const workspaceRow =
    workspaceId
      ? context
          .workspaceRowsById[
            workspaceId
          ] ||
        {}
      : {};

  const settingsRow =
    workspaceId
      ? context
          .workspaceSettingsById[
            workspaceId
          ] ||
        {}
      : {};

  let settings =
    null;

  if (
    workspaceId &&
    typeof settingsIntegrationGetWorkspaceSettings_ ===
      'function'
  ) {
    try {
      settings =
        settingsIntegrationGetWorkspaceSettings_(
          context.ss,
          workspaceId
        );
    } catch (error) {
      settings =
        null;
    }
  }

  settings =
    settings ||
    autoReminderSettingsFromRow_(
      workspaceId,
      settingsRow
    );

  const timezone =
    autoReminderNormalizeTimezone_(
      settings.timezone ||
      workspaceRow.timezone ||
      AUTO_REMINDER_TIMEZONE
    );

  const hour =
    autoReminderIntegerInRange_(
      settings.overdue_reminder_hour,
      0,
      23,
      AUTO_REMINDER_TRIGGER_HOUR
    );

  const reminderDays =
    autoReminderNormalizeStages_(
      settings.overdue_reminder_days
    );

  const enabled =
    autoReminderBooleanDefault_(
      settings.auto_overdue_reminder,
      true
    );

  const workspaceStatus =
    autoReminderText_(
      workspaceRow.account_status ||
      'active'
    ).toLowerCase();

  const workspaceActive =
    [
      'inactive',
      'disabled',
      'archived',
      'closed',
      '停用',
      '封存'
    ].indexOf(
      workspaceStatus
    ) ===
    -1;

  const localHour =
    Number(
      Utilities.formatDate(
        context.now ||
        new Date(),
        timezone,
        'H'
      )
    );

  const schedule = {
    workspace_id:
      workspaceId,

    workspace_name:
      autoReminderText_(
        workspaceRow.workspace_name
      ),

    workspace_active:
      workspaceActive,

    enabled:
      enabled,

    timezone:
      timezone,

    hour:
      hour,

    local_hour:
      localHour,

    reminder_days:
      reminderDays,

    final_stage:
      reminderDays[
        reminderDays.length -
        1
      ],

    manual_follow_up_day:
      reminderDays[
        reminderDays.length -
        1
      ] +
      1,

    due_now:
      context.ignoreSchedule ===
        true ||
      localHour ===
        hour
  };

  context.workspaceScheduleById[
    key
  ] =
    schedule;

  return schedule;
}


function autoReminderSettingsFromRow_(
  workspaceId,
  row
) {
  return {
    workspace_id:
      workspaceId,

    timezone:
      autoReminderText_(
        row.timezone ||
        AUTO_REMINDER_TIMEZONE
      ),

    auto_overdue_reminder:
      autoReminderBooleanDefault_(
        row.auto_overdue_reminder,
        true
      ),

    overdue_reminder_hour:
      autoReminderIntegerInRange_(
        row.overdue_reminder_hour,
        0,
        23,
        AUTO_REMINDER_TRIGGER_HOUR
      ),

    overdue_reminder_days:
      autoReminderParseReminderDays_(
        row.overdue_reminder_days_json
      )
  };
}


function autoReminderBuildAllWorkspaceSchedules_(
  ss,
  now,
  ignoreSchedule
) {
  const workspaceRows =
    autoReminderGetObjects_(
      ss.getSheetByName(
        AUTO_REMINDER_WORKSPACES_SHEET
      )
    );

  const settingsRows =
    autoReminderGetObjects_(
      ss.getSheetByName(
        AUTO_REMINDER_WORKSPACE_SETTINGS_SHEET
      )
    );

  const workspaceRowsById = {};
  const workspaceSettingsById = {};

  workspaceRows.forEach(
    function (row) {
      const workspaceId =
        autoReminderText_(
          row.workspace_id
        ).toUpperCase();

      if (workspaceId) {
        workspaceRowsById[
          workspaceId
        ] =
          row;
      }
    }
  );

  settingsRows.forEach(
    function (row) {
      const workspaceId =
        autoReminderText_(
          row.workspace_id
        ).toUpperCase();

      if (workspaceId) {
        workspaceSettingsById[
          workspaceId
        ] =
          row;
      }
    }
  );

  const workspaceIds = {};

  Object.keys(
    workspaceRowsById
  ).forEach(
    function (workspaceId) {
      workspaceIds[
        workspaceId
      ] =
        true;
    }
  );

  Object.keys(
    workspaceSettingsById
  ).forEach(
    function (workspaceId) {
      workspaceIds[
        workspaceId
      ] =
        true;
    }
  );

  const context = {
    ss:
      ss,

    now:
      now ||
      new Date(),

    ignoreSchedule:
      ignoreSchedule ===
      true,

    workspaceRowsById:
      workspaceRowsById,

    workspaceSettingsById:
      workspaceSettingsById,

    workspaceScheduleById:
      {}
  };

  return Object.keys(
    workspaceIds
  )
    .sort()
    .map(
      function (workspaceId) {
        return autoReminderResolveWorkspaceSchedule_(
          context,
          workspaceId
        );
      }
    );
}


function autoReminderContextScheduleSummary_(
  context
) {
  const ids = {};

  Object.keys(
    context.workspaceRowsById ||
    {}
  ).forEach(
    function (workspaceId) {
      ids[
        workspaceId
      ] =
        true;
    }
  );

  Object.keys(
    context.workspaceSettingsById ||
    {}
  ).forEach(
    function (workspaceId) {
      ids[
        workspaceId
      ] =
        true;
    }
  );

  Object.keys(
    context.workspaceScheduleById ||
    {}
  ).forEach(
    function (workspaceId) {
      if (
        workspaceId !==
        '__LEGACY_DEFAULT__'
      ) {
        ids[
          workspaceId
        ] =
          true;
      }
    }
  );

  return Object.keys(
    ids
  )
    .sort()
    .map(
      function (workspaceId) {
        return autoReminderResolveWorkspaceSchedule_(
          context,
          workspaceId
        );
      }
    );
}


function autoReminderNormalizeStages_(
  value
) {
  const stages =
    autoReminderParseReminderDays_(
      value
    );

  return stages.length >
    0
    ? stages
    : AUTO_REMINDER_STAGES.slice();
}


function autoReminderParseReminderDays_(
  value
) {
  let values =
    value;

  if (
    !Array.isArray(
      values
    )
  ) {
    const text =
      autoReminderText_(
        value
      );

    if (!text) {
      values =
        AUTO_REMINDER_STAGES.slice();

    } else {
      try {
        values =
          JSON.parse(
            text
          );
      } catch (error) {
        values =
          text.split(
            /[,，\s]+/
          );
      }
    }
  }

  const seen = {};

  return (
    Array.isArray(
      values
    )
      ? values
      : []
  )
    .map(
      function (item) {
        return Math.round(
          Number(
            item
          )
        );
      }
    )
    .filter(
      function (day) {
        if (
          !Number.isFinite(
            day
          ) ||
          day <
          1 ||
          day >
          365 ||
          seen[
            day
          ]
        ) {
          return false;
        }

        seen[
          day
        ] =
          true;

        return true;
      }
    )
    .sort(
      function (a, b) {
        return a - b;
      }
    );
}


function autoReminderNormalizeTimezone_(
  value
) {
  const timezone =
    autoReminderText_(
      value
    );

  try {
    Utilities.formatDate(
      new Date(),
      timezone,
      'yyyy-MM-dd'
    );

    return timezone;

  } catch (error) {
    return AUTO_REMINDER_TIMEZONE;
  }
}


function autoReminderBooleanDefault_(
  value,
  fallback
) {
  if (
    value ===
      '' ||
    value ===
      null ||
    value ===
      undefined
  ) {
    return fallback;
  }

  if (
    value ===
    true
  ) {
    return true;
  }

  return [
    '1',
    'true',
    'yes',
    'y',
    'on',
    'enabled',
    'active'
  ].indexOf(
    autoReminderText_(
      value
    ).toLowerCase()
  ) >=
  0;
}


function autoReminderIntegerInRange_(
  value,
  min,
  max,
  fallback
) {
  const number =
    Math.round(
      Number(
        value
      )
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <
      min ||
    number >
      max
  ) {
    return fallback;
  }

  return number;
}


// ==============================================================
// 催繳紀錄表
// ==============================================================

function autoReminderEnsureLogSheet_(ss) {
  let sheet = ss.getSheetByName(AUTO_REMINDER_LOG_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(AUTO_REMINDER_LOG_SHEET);
    sheet
      .getRange(
        1,
        1,
        1,
        AUTO_REMINDER_LOG_HEADERS.length
      )
      .setValues([AUTO_REMINDER_LOG_HEADERS]);

    sheet.setFrozenRows(1);
    return sheet;
  }

  autoReminderEnsureHeaders_(
    sheet,
    AUTO_REMINDER_LOG_HEADERS
  );

  sheet.setFrozenRows(1);
  return sheet;
}


function autoReminderAppendLog_(sheet, record) {
  const headers = autoReminderHeaders_(sheet);
  const row = headers.map(function (header) {
    return record[header] !== undefined
      ? record[header]
      : '';
  });

  sheet.appendRow(row);
}


// ==============================================================
// 顯示資料
// ==============================================================

function autoReminderPreviewGroup_(group) {
  return {
    workspace_id:
      group.workspaceId,

    workspace_name:
      group.workspaceName,

    timezone:
      group.timezone,

    configured_reminder_days:
      group.reminderStages,

    landlord_id:
      group.landlordId,

    landlord_name:
      group.landlordName,
    tenant_id: group.tenantId,
    tenant_name: group.tenantName,
    tenant_line_user_id: group.tenantLineUserId,
    message_stage: group.messageStage,
    bill_count: group.items.length,
    total_amount: group.totalAmount,
    bills: group.items.map(function (item) {
      return autoReminderPublicItem_(item);
    }),
    message_text: autoReminderBuildMessage_(group)
  };
}


function autoReminderPublicItem_(item) {
  return {
    workspace_id:
      item.workspaceId,

    workspace_name:
      item.workspaceName,

    timezone:
      item.timezone,

    configured_reminder_days:
      item.reminderStages,

    bill_id:
      item.billId,

    bill_month:
      item.billMonth,
    room_name: item.roomName,
    tenant_id: item.tenantId,
    tenant_name: item.tenantName,
    due_date: item.dueDate,
    days_overdue: item.daysOverdue,
    reminder_stage: item.stage,
    total_amount: item.totalAmount,
    final_reminder_stage:
      item.finalStage,

    manual_follow_up_day:
      item.manualFollowUpDay,

    manual_follow_up_required:
      item.daysOverdue >=
        item.manualFollowUpDay &&
      item.stage ===
        item.finalStage
  };
}


function autoReminderSkippedItem_(item, reason) {
  const result = autoReminderPublicItem_(item);
  result.reason = reason;
  return result;
}


// ==============================================================
// 日期、狀態及一般工具
// ==============================================================

function autoReminderGetSpreadsheet_() {
  const spreadsheetId = PropertiesService
    .getScriptProperties()
    .getProperty('CMWEBS_SPREADSHEET_ID');

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      '找不到綁定的試算表。請在 Script Properties 設定 CMWEBS_SPREADSHEET_ID'
    );
  }

  return ss;
}


/**
 * 可選：將目前綁定試算表 ID 儲存到 Script Properties。
 * 時間觸發器若無法取得 Active Spreadsheet，可先執行一次此函式。
 */
function saveV2AutomaticPaymentReminderSpreadsheetId() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('目前沒有可用的綁定試算表');
  }

  PropertiesService
    .getScriptProperties()
    .setProperty(
      'CMWEBS_SPREADSHEET_ID',
      ss.getId()
    );

  const result = {
    success: true,
    code: 'OK',
    message: '試算表 ID 已儲存',
    data: {
      spreadsheet_id: ss.getId(),
      spreadsheet_name: ss.getName()
    }
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function autoReminderRequireSheet_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('找不到工作表：' + sheetName);
  }

  return sheet;
}


function autoReminderGetObjects_(sheet) {
  if (
    !sheet ||
    sheet.getLastRow() < 2 ||
    sheet.getLastColumn() < 1
  ) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) {
    return autoReminderText_(header);
  });

  return values.slice(1).map(function (row, index) {
    const object = {
      _sheet_row: index + 2
    };

    headers.forEach(function (header, columnIndex) {
      if (header) {
        object[header] = row[columnIndex];
      }
    });

    return object;
  });
}


function autoReminderEnsureHeaders_(sheet, requiredHeaders) {
  if (sheet.getLastColumn() < 1) {
    sheet
      .getRange(1, 1, 1, requiredHeaders.length)
      .setValues([requiredHeaders]);
    return;
  }

  let headers = autoReminderHeaders_(sheet);

  if (headers.every(function (header) { return !header; })) {
    sheet
      .getRange(1, 1, 1, requiredHeaders.length)
      .setValues([requiredHeaders]);
    return;
  }

  requiredHeaders.forEach(function (header) {
    if (headers.indexOf(header) === -1) {
      const newColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, newColumn).setValue(header);
      headers.push(header);
    }
  });
}


function autoReminderHeaders_(sheet) {
  if (sheet.getLastColumn() < 1) {
    return [];
  }

  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(function (header) {
      return autoReminderText_(header);
    });
}


function autoReminderHeaderMap_(sheet) {
  const map = {};

  autoReminderHeaders_(sheet).forEach(function (header, index) {
    if (header) {
      map[header] = index + 1;
    }
  });

  return map;
}


function autoReminderNormalizePaymentStatus_(value) {
  const text = autoReminderText_(value)
    .replace(/\s+/g, '')
    .toLowerCase();

  if (
    text === 'unpaid' ||
    text.indexOf('未繳') !== -1 ||
    text.indexOf('欠款') !== -1
  ) {
    return 'unpaid';
  }

  if (
    text === 'paid' ||
    text.indexOf('已繳') !== -1 ||
    text.indexOf('已銷帳') !== -1
  ) {
    return 'paid';
  }

  return text;
}


function autoReminderNormalizeBillStatus_(value) {
  const text = autoReminderText_(value)
    .replace(/\s+/g, '')
    .toLowerCase();

  if (
    text === 'issued' ||
    text === '已建立' ||
    text === '已開立' ||
    text === '開立'
  ) {
    return 'issued';
  }

  return text;
}


function autoReminderIsBindingUsable_(value) {
  const text = autoReminderText_(value)
    .replace(/\s+/g, '')
    .toLowerCase();

  if (!text) {
    return true;
  }

  return [
    'bound',
    'active',
    '已綁定',
    '綁定'
  ].indexOf(text) !== -1;
}


function autoReminderIsAccountActive_(value) {
  const text = autoReminderText_(value)
    .replace(/\s+/g, '')
    .toLowerCase();

  if (!text) {
    return true;
  }

  const inactiveValues = [
    'inactive',
    'disabled',
    'terminated',
    'closed',
    '停用',
    '終止',
    '已退租',
    '退租'
  ];

  return inactiveValues.indexOf(text) === -1;
}


function autoReminderDateKey_(
  value,
  timezone
) {
  timezone =
    autoReminderNormalizeTimezone_(
      timezone ||
      AUTO_REMINDER_TIMEZONE
    );
  if (
    Object.prototype.toString.call(value) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      timezone,
      'yyyy-MM-dd'
    );
  }

  if (
    typeof value === 'number' &&
    isFinite(value) &&
    value > 20000 &&
    value < 100000
  ) {
    const date = new Date(
      Date.UTC(1899, 11, 30) +
      value * 86400000
    );

    return Utilities.formatDate(
      date,
      timezone,
      'yyyy-MM-dd'
    );
  }

  const text = autoReminderText_(value);

  if (!text) {
    return '';
  }

  const directMatch = text.match(
    /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/
  );

  if (directMatch) {
    return [
      directMatch[1],
      String(Number(directMatch[2])).padStart(2, '0'),
      String(Number(directMatch[3])).padStart(2, '0')
    ].join('-');
  }

  const parsed = new Date(text);

  if (isNaN(parsed.getTime())) {
    return '';
  }

  return Utilities.formatDate(
    parsed,
    AUTO_REMINDER_TIMEZONE,
    'yyyy-MM-dd'
  );
}


function autoReminderDaysOverdue_(
  dueDateValue,
  now,
  timezone
) {
  const dueKey =
    autoReminderDateKey_(
      dueDateValue,
      timezone
    );

  const todayKey =
    autoReminderDateKey_(
      now,
      timezone
    );

  if (
    !dueKey ||
    !todayKey
  ) {
    return 0;
  }

  const dueParts =
    dueKey.split(
      '-'
    ).map(
      Number
    );

  const todayParts =
    todayKey.split(
      '-'
    ).map(
      Number
    );

  const dueUtc =
    Date.UTC(
      dueParts[0],
      dueParts[1] -
        1,
      dueParts[2]
    );

  const todayUtc =
    Date.UTC(
      todayParts[0],
      todayParts[1] -
        1,
      todayParts[2]
    );

  return Math.max(
    0,
    Math.floor(
      (
        todayUtc -
        dueUtc
      ) /
      86400000
    )
  );
}


function autoReminderBillMonth_(
  value,
  timezone
) {
  timezone =
    autoReminderNormalizeTimezone_(
      timezone ||
      timezone
    );
  if (
    Object.prototype.toString.call(value) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      timezone,
      'yyyy-MM'
    );
  }

  if (
    typeof value === 'number' &&
    isFinite(value) &&
    value > 20000 &&
    value < 100000
  ) {
    const date = new Date(
      Date.UTC(1899, 11, 30) +
      value * 86400000
    );

    return Utilities.formatDate(
      date,
      timezone,
      'yyyy-MM'
    );
  }

  const text = autoReminderText_(value);
  const match = text.match(/(\d{4})\D*(\d{1,2})/);

  if (!match) {
    return text;
  }

  return (
    match[1] +
    '-' +
    String(Number(match[2])).padStart(2, '0')
  );
}


function autoReminderMakeId_(prefix, now) {
  const timestamp = Utilities.formatDate(
    now || new Date(),
    AUTO_REMINDER_TIMEZONE,
    'yyyyMMddHHmmss'
  );

  const randomPart = String(
    Math.floor(Math.random() * 1000000)
  ).padStart(6, '0');

  return (
    autoReminderText_(prefix || 'REM') +
    '-' +
    timestamp +
    '-' +
    randomPart
  );
}


function autoReminderText_(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value).trim();
}


function autoReminderNumber_(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return 0;
  }

  const number = Number(
    String(value)
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, '')
  );

  return isFinite(number)
    ? number
    : 0;
}
