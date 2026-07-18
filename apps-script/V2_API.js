const V2_TIMEZONE = 'Asia/Taipei';
const V2_PAYMENT_REMINDER_MIN_DAYS_OVERDUE = 1;

const V2_SHEETS = {
  tenantHomeView: 'V2_tenant_home_view',
  tenantBillView: 'V2_tenant_bill_view',
  landlordHomeView: 'V2_landlord_home_view',
  landlordArrearsView: 'V2_landlord_arrears_view',
  landlordTenantListView: 'V2_landlord_tenant_list_view',
  liffAccessLogs: 'V2_liff_access_logs',
  lineMessageLogs: 'V2_line_message_logs',
  paymentReports: 'V2_payment_reports',
  tenantMessages: 'V2_tenant_messages',

  bills: 'V2_bills',
  legacyBillHistory: '3.歷史帳單總表'
};


// ==================================================
// Tenant Home
// ==================================================

function getTenantHomeByLineUid(lineUserId) {
  const action = 'tenant_home';

  try {
    lineUserId = String(lineUserId || '').trim();

    if (!lineUserId) {
      logLiffAccess_({
        lineUserId: '',
        userId: '',
        role: 'tenant',
        action,
        targetId: '',
        result: 'failed',
        errorMessage: 'line_user_id is required'
      });

      return {
        success: false,
        code: 'MISSING_LINE_UID',
        message: '缺少 LINE UID',
        data: null
      };
    }

    const rows = getSheetObjects_(V2_SHEETS.tenantHomeView);

    const tenantHome = rows.find(row => {
      return String(row.line_user_id || '').trim() === lineUserId;
    });

    if (!tenantHome) {
      logLiffAccess_({
        lineUserId,
        userId: '',
        role: 'tenant',
        action,
        targetId: '',
        result: 'failed',
        errorMessage: 'tenant home not found'
      });

      return {
        success: false,
        code: 'TENANT_NOT_FOUND',
        message: '查無房客資料，請先完成身份綁定',
        data: null
      };
    }

    if (String(tenantHome.account_status || '').toLowerCase() !== 'active') {
      logLiffAccess_({
        lineUserId,
        userId: tenantHome.user_id,
        role: 'tenant',
        action,
        targetId: tenantHome.tenant_id,
        result: 'failed',
        errorMessage: 'account is not active'
      });

      return {
        success: false,
        code: 'ACCOUNT_NOT_ACTIVE',
        message: '帳號目前不是啟用狀態',
        data: null
      };
    }

    const data = {
      line_user_id: tenantHome.line_user_id,
      user_id: tenantHome.user_id,
      tenant_id: tenantHome.tenant_id,
      tenant_name: tenantHome.tenant_name,
      room_list: tenantHome.room_list,
      latest_bill_month: tenantHome.latest_bill_month,
      latest_due_date: tenantHome.latest_due_date,
      latest_total_amount: Number(tenantHome.latest_total_amount || 0),
      latest_payment_status: tenantHome.latest_payment_status,
      unpaid_bill_count: Number(tenantHome.unpaid_bill_count || 0),
      unpaid_total_amount: Number(tenantHome.unpaid_total_amount || 0),
      account_status: tenantHome.account_status,
      updated_at: tenantHome.updated_at
    };

    logLiffAccess_({
      lineUserId,
      userId: tenantHome.user_id,
      role: 'tenant',
      action,
      targetId: tenantHome.tenant_id,
      result: 'success',
      errorMessage: ''
    });

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data
    };

  } catch (error) {
    logLiffAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'tenant',
      action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message,
      data: null
    };
  }
}


function testGetTenantHomeByLineUid() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(V2_SHEETS.tenantHomeView);

  const testLineUserId = sheet.getRange('A2').getValue();
  const result = getTenantHomeByLineUid(testLineUserId);

  Logger.log(JSON.stringify(result, null, 2));
}


// ==================================================
// Tenant Bills
// ==================================================

function getTenantBillsByLineUid(lineUserId) {
  const action = 'tenant_bills';

  try {
    lineUserId = String(lineUserId || '').trim();

    if (!lineUserId) {
      logLiffAccess_({
        lineUserId: '',
        userId: '',
        role: 'tenant',
        action,
        targetId: '',
        result: 'failed',
        errorMessage: 'line_user_id is required'
      });

      return {
        success: false,
        code: 'MISSING_LINE_UID',
        message: '缺少 LINE UID',
        data: []
      };
    }

    const rows = getSheetObjects_(V2_SHEETS.tenantBillView);

    const bills = rows
      .filter(row => String(row.line_user_id || '').trim() === lineUserId)
      .map(row => ({
        line_user_id: row.line_user_id,
        user_id: row.user_id,
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name,
        room_id: row.room_id,
        room_name: row.room_name,
        bill_id: row.bill_id,
        bill_month: row.bill_month,
        due_date: row.due_date,
        rent_amount: Number(row.rent_amount || 0),
        management_fee: Number(row.management_fee || 0),
        previous_meter: row.previous_meter,
        current_meter_reading: row.current_meter_reading,
        electricity_usage: Number(row.electricity_usage || 0),
        electricity_fee_rate: Number(row.electricity_fee_rate || 0),
        equipment_fee_rate: Number(row.equipment_fee_rate || 0),
        electricity_amount: Number(row.electricity_amount || 0),
        equipment_amount: Number(row.equipment_amount || 0),
        other_amount: Number(row.other_amount || 0),
        discount_amount: Number(row.discount_amount || 0),
        total_amount: Number(row.total_amount || 0),
        bill_status: row.bill_status,
        payment_status: row.payment_status,
        sent_status: row.sent_status,
        updated_at: row.updated_at
      }));

    if (bills.length === 0) {
      logLiffAccess_({
        lineUserId,
        userId: '',
        role: 'tenant',
        action,
        targetId: '',
        result: 'failed',
        errorMessage: 'tenant bills not found'
      });

      return {
        success: false,
        code: 'BILLS_NOT_FOUND',
        message: '查無帳單資料',
        data: []
      };
    }

    logLiffAccess_({
      lineUserId,
      userId: bills[0].user_id,
      role: 'tenant',
      action,
      targetId: bills[0].tenant_id,
      result: 'success',
      errorMessage: ''
    });

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data: bills
    };

  } catch (error) {
    logLiffAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'tenant',
      action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message,
      data: []
    };
  }
}


function testGetTenantBillsByLineUid() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(V2_SHEETS.tenantBillView);

  const testLineUserId = sheet.getRange('A2').getValue();
  const result = getTenantBillsByLineUid(testLineUserId);

  Logger.log(JSON.stringify(result, null, 2));
}


// ==================================================
// Landlord Home
// ==================================================

function getLandlordHomeByLineUid(lineUserId) {
  const action = 'landlord_home';

  try {
    lineUserId = String(lineUserId || '').trim();

    if (!lineUserId) {
      logLiffAccess_({
        lineUserId: '',
        userId: '',
        role: 'landlord',
        action,
        targetId: '',
        result: 'failed',
        errorMessage: 'line_user_id is required'
      });

      return {
        success: false,
        code: 'MISSING_LINE_UID',
        message: '缺少 LINE UID',
        data: null
      };
    }

    const rows = getSheetObjects_(V2_SHEETS.landlordHomeView);

    const landlordHome = rows.find(row => {
      return String(row.line_user_id || '').trim() === lineUserId;
    });

    if (!landlordHome) {
      logLiffAccess_({
        lineUserId,
        userId: '',
        role: 'landlord',
        action,
        targetId: '',
        result: 'failed',
        errorMessage: 'landlord home not found'
      });

      return {
        success: false,
        code: 'LANDLORD_NOT_FOUND',
        message: '查無房東資料，請先完成身份綁定',
        data: null
      };
    }

    if (String(landlordHome.account_status || '').toLowerCase() !== 'active') {
      logLiffAccess_({
        lineUserId,
        userId: landlordHome.user_id,
        role: 'landlord',
        action,
        targetId: landlordHome.landlord_id,
        result: 'failed',
        errorMessage: 'account is not active'
      });

      return {
        success: false,
        code: 'ACCOUNT_NOT_ACTIVE',
        message: '帳號目前不是啟用狀態',
        data: null
      };
    }

    const data = {
      line_user_id: landlordHome.line_user_id,
      user_id: landlordHome.user_id,
      landlord_id: landlordHome.landlord_id,
      landlord_name: landlordHome.landlord_name,

      room_count: Number(landlordHome.room_count || 0),
      tenant_count: Number(landlordHome.tenant_count || 0),

      latest_bill_month: landlordHome.latest_bill_month,
      latest_bill_count: Number(landlordHome.latest_bill_count || 0),
      latest_total_amount: Number(landlordHome.latest_total_amount || 0),

      unpaid_bill_count: Number(landlordHome.unpaid_bill_count || 0),
      unpaid_total_amount: Number(landlordHome.unpaid_total_amount || 0),

      paid_bill_count: Number(landlordHome.paid_bill_count || 0),
      paid_total_amount: Number(landlordHome.paid_total_amount || 0),

      account_status: landlordHome.account_status,
      updated_at: landlordHome.updated_at
    };

    logLiffAccess_({
      lineUserId,
      userId: landlordHome.user_id,
      role: 'landlord',
      action,
      targetId: landlordHome.landlord_id,
      result: 'success',
      errorMessage: ''
    });

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data
    };

  } catch (error) {
    logLiffAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'landlord',
      action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message,
      data: null
    };
  }
}


function testGetLandlordHomeByLineUid() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(V2_SHEETS.landlordHomeView);

  const testLineUserId = sheet.getRange('A2').getValue();
  const result = getLandlordHomeByLineUid(testLineUserId);

  Logger.log(JSON.stringify(result, null, 2));
}


// ==================================================
// Landlord Arrears
// ==================================================

// ==================================================
// Landlord Arrears
// 欠款頁直接讀取 V2_bills 即時狀態
// ==================================================

function getLandlordArrearsByLineUid(
  lineUserId
) {
  const action =
    'landlord_arrears';

  try {
    lineUserId =
      String(
        lineUserId || ''
      ).trim();

    if (!lineUserId) {
      return {
        success: false,
        code:
          'MISSING_LINE_UID',
        message:
          '缺少 LINE UID',

        data: {
          landlord: null,
          summary: {
            arrears_count: 0,
            unpaid_total_amount: 0,
            auto_reminder_active_count: 0,
            reminded_bill_count: 0,
            reminder_total_count: 0,
            manual_follow_up_count: 0
          },
          arrears: []
        }
      };
    }

    /*
     * 先確認目前登入者是有效房東，
     * 並取得 landlord_id。
     */
    const homeResult =
      getLandlordHomeByLineUid(
        lineUserId
      );

    if (
      !homeResult ||
      homeResult.success !== true
    ) {
      return {
        success: false,
        code:
          homeResult &&
          homeResult.code
            ? homeResult.code
            : 'LANDLORD_NOT_FOUND',

        message:
          homeResult &&
          homeResult.message
            ? homeResult.message
            : '查無房東資料，請先完成身份綁定',

        data: {
          landlord: null,
          summary: {
            arrears_count: 0,
            unpaid_total_amount: 0,
            auto_reminder_active_count: 0,
            reminded_bill_count: 0,
            reminder_total_count: 0,
            manual_follow_up_count: 0
          },
          arrears: []
        }
      };
    }

    const landlord =
      homeResult.data || {};

    const landlordId =
      String(
        landlord.landlord_id || ''
      ).trim();

    if (!landlordId) {
      return {
        success: false,
        code:
          'MISSING_LANDLORD_ID',
        message:
          '房東資料缺少 landlord_id',

        data: {
          landlord: null,
          summary: {
            arrears_count: 0,
            unpaid_total_amount: 0,
            auto_reminder_active_count: 0,
            reminded_bill_count: 0,
            reminder_total_count: 0,
            manual_follow_up_count: 0
          },
          arrears: []
        }
      };
    }

    /*
     * V2_bills 才是付款狀態的正式來源。
     *
     * 房東確認已繳、撤銷已繳、V1 同步、
     * 自動催繳狀態，都直接更新這張表。
     */
    const billRows =
      getSheetObjects_(
        V2_SHEETS.bills
      );

    const arrears =
      billRows
        .filter(function (row) {
          const rowLandlordId =
            String(
              row.landlord_id || ''
            ).trim();

          const paymentStatus =
            String(
              row.payment_status || ''
            )
              .trim()
              .toLowerCase();

          return (
            rowLandlordId ===
              landlordId &&
            paymentStatus ===
              'unpaid'
          );
        })
        .map(function (row) {
          const daysOverdue =
            calculateV2ArrearsDaysOverdue_(
              row.due_date
            );

          const reminderCount =
            Math.max(
              0,
              Number(
                row.reminder_count || 0
              )
            );

          const lastReminderStage =
            Math.max(
              0,
              Number(
                row.last_reminder_stage || 0
              )
            );

          const manualFollowUpRequired =
            normalizeV2Boolean_(
              row.manual_follow_up_required
            );

          const reminderStatus =
            getV2ArrearsReminderStatus_(
              daysOverdue,
              reminderCount,
              lastReminderStage,
              manualFollowUpRequired
            );

          const nextReminderDay =
            getV2ArrearsNextReminderDay_(
              daysOverdue,
              lastReminderStage,
              manualFollowUpRequired
            );

          return {
            line_user_id:
              lineUserId,

            user_id:
              row.user_id || '',

            landlord_id:
              row.landlord_id || '',

            landlord_name:
              landlord.landlord_name ||
              '',

            tenant_id:
              row.tenant_id || '',

            tenant_name:
              row.tenant_name || '',

            room_id:
              row.room_id || '',

            room_name:
              row.room_name || '',

            bill_id:
              row.bill_id || '',

            bill_month:
              row.bill_month || '',

            due_date:
              row.due_date || '',

            total_amount:
              Number(
                row.total_amount || 0
              ),

            bill_status:
              row.bill_status || '',

            payment_status:
              row.payment_status || '',

            sent_status:
              row.sent_status || '',

            days_overdue:
              daysOverdue,

            /*
             * 自動催繳狀態
             */
            reminder_count:
              reminderCount,

            last_reminder_at:
              row.last_reminder_at || '',

            last_reminder_stage:
              lastReminderStage,

            manual_follow_up_required:
              manualFollowUpRequired,

            manual_follow_up_at:
              row.manual_follow_up_at || '',

            reminder_status:
              reminderStatus,

            next_reminder_day:
              nextReminderDay,

            next_reminder_label:
              nextReminderDay > 0
                ? '逾期第 ' +
                  nextReminderDay +
                  ' 天'
                : '',

            account_status:
              landlord.account_status ||
              'active',

            updated_at:
              row.updated_at || ''
          };
        });

    /*
     * 先依繳款期限排序，
     * 同日期再依房號排序。
     */
    arrears.sort(
      function (a, b) {
        const dueA =
          normalizeV2ArrearsDateKey_(
            a.due_date
          );

        const dueB =
          normalizeV2ArrearsDateKey_(
            b.due_date
          );

        if (dueA !== dueB) {
          return dueA.localeCompare(
            dueB
          );
        }

        return String(
          a.room_name || ''
        ).localeCompare(
          String(
            b.room_name || ''
          ),
          'zh-TW',
          {
            numeric: true
          }
        );
      }
    );

    const unpaidTotalAmount =
      arrears.reduce(
        function (
          total,
          item
        ) {
          return (
            total +
            Number(
              item.total_amount ||
              0
            )
          );
        },
        0
      );

    const remindedBillCount =
      arrears.filter(
        function (item) {
          return (
            Number(
              item.reminder_count || 0
            ) > 0 ||
            Number(
              item.last_reminder_stage || 0
            ) > 0
          );
        }
      ).length;

    const reminderTotalCount =
      arrears.reduce(
        function (
          total,
          item
        ) {
          return (
            total +
            Number(
              item.reminder_count || 0
            )
          );
        },
        0
      );

    const manualFollowUpCount =
      arrears.filter(
        function (item) {
          return (
            item.manual_follow_up_required ===
            true
          );
        }
      ).length;

    const autoReminderActiveCount =
      arrears.filter(
        function (item) {
          return (
            item.manual_follow_up_required !==
              true &&
            Number(
              item.days_overdue || 0
            ) >= 2
          );
        }
      ).length;

    try {
      logLiffAccess_({
        lineUserId:
          lineUserId,

        userId:
          landlord.user_id || '',

        role:
          'landlord',

        action:
          action,

        targetId:
          landlordId,

        result:
          'success',

        errorMessage:
          '',

        notes:
          [
            'source=V2_bills',
            'arrears_count=' +
              arrears.length,
            'reminded_bill_count=' +
              remindedBillCount,
            'manual_follow_up_count=' +
              manualFollowUpCount
          ].join(', ')
      });
    } catch (logError) {
      // 存取紀錄失敗不影響查詢
    }

    return {
      success: true,
      code:
        'OK',
      message:
        '查詢成功',

      data: {
        landlord: {
          line_user_id:
            landlord.line_user_id ||
            lineUserId,

          user_id:
            landlord.user_id || '',

          landlord_id:
            landlordId,

          landlord_name:
            landlord.landlord_name ||
            '',

          room_count:
            Number(
              landlord.room_count ||
              0
            ),

          tenant_count:
            Number(
              landlord.tenant_count ||
              0
            ),

          account_status:
            landlord.account_status ||
            'active',

          updated_at:
            landlord.updated_at || ''
        },

        summary: {
          arrears_count:
            arrears.length,

          unpaid_total_amount:
            unpaidTotalAmount,

          /*
           * 自動催繳總覽
           */
          auto_reminder_active_count:
            autoReminderActiveCount,

          reminded_bill_count:
            remindedBillCount,

          reminder_total_count:
            reminderTotalCount,

          manual_follow_up_count:
            manualFollowUpCount,

          reminder_schedule:
            [2, 6, 15],

          data_source:
            'V2_bills',

          updated_at:
            new Date()
        },

        arrears:
          arrears
      }
    };

  } catch (error) {
    try {
      logLiffAccess_({
        lineUserId:
          lineUserId || '',

        userId:
          '',

        role:
          'landlord',

        action:
          action,

        targetId:
          '',

        result:
          'failed',

        errorMessage:
          error &&
          error.message
            ? error.message
            : String(error)
      });
    } catch (logError) {
      // 忽略紀錄錯誤
    }

    return {
      success: false,
      code:
        'SYSTEM_ERROR',

      message:
        '系統錯誤：' +
        (
          error &&
          error.message
            ? error.message
            : String(error)
        ),

      data: {
        landlord: null,

        summary: {
          arrears_count: 0,
          unpaid_total_amount: 0,
          auto_reminder_active_count: 0,
          reminded_bill_count: 0,
          reminder_total_count: 0,
          manual_follow_up_count: 0
        },

        arrears: []
      }
    };
  }
}


/**
 * 將試算表中的布林值、1、TRUE、是等格式統一轉成 Boolean。
 */
function normalizeV2Boolean_(
  value
) {
  if (value === true) {
    return true;
  }

  if (
    value === false ||
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return false;
  }

  const text =
    String(
      value
    )
      .trim()
      .toLowerCase();

  return [
    'true',
    '1',
    'yes',
    'y',
    '是',
    '需要',
    'required'
  ].indexOf(text) !== -1;
}


/**
 * 依催繳紀錄判定欠款目前階段。
 */
function getV2ArrearsReminderStatus_(
  daysOverdue,
  reminderCount,
  lastReminderStage,
  manualFollowUpRequired
) {
  if (manualFollowUpRequired) {
    return 'manual_required';
  }

  if (
    Number(
      lastReminderStage || 0
    ) >= 15
  ) {
    return 'final_sent';
  }

  if (
    Number(
      lastReminderStage || 0
    ) >= 6
  ) {
    return 'second_sent';
  }

  if (
    Number(
      lastReminderStage || 0
    ) >= 2 ||
    Number(
      reminderCount || 0
    ) > 0
  ) {
    return 'first_sent';
  }

  if (
    Number(
      daysOverdue || 0
    ) >= 2
  ) {
    return 'scheduled';
  }

  return 'not_started';
}


/**
 * 計算下一個自動催繳階段。
 *
 * 規則：
 * - 逾期第 2 天
 * - 逾期第 6 天
 * - 逾期第 15 天
 * - 之後轉人工處理
 */
function getV2ArrearsNextReminderDay_(
  daysOverdue,
  lastReminderStage,
  manualFollowUpRequired
) {
  if (manualFollowUpRequired) {
    return 0;
  }

  const overdue =
    Number(
      daysOverdue || 0
    );

  const stage =
    Number(
      lastReminderStage || 0
    );

  if (
    stage >= 15 ||
    overdue > 15
  ) {
    return 0;
  }

  if (stage >= 6) {
    return 15;
  }

  if (stage >= 2) {
    return 6;
  }

  if (overdue < 2) {
    return 2;
  }

  if (overdue < 6) {
    return 6;
  }

  return 15;
}


/**
 * 將工作表日期轉成 yyyy-MM-dd。
 */
function normalizeV2ArrearsDateKey_(
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

  const text =
    String(
      value || ''
    ).trim();

  if (!text) {
    return '9999-12-31';
  }

  /*
   * 支援：
   * 2026-07-10
   * 2026/07/10
   * 2026-07-09T16:00:00.000Z
   */
  const match =
    text.match(
      /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/
    );

  if (match) {
    return (
      match[1] +
      '-' +
      String(
        Number(match[2])
      ).padStart(
        2,
        '0'
      ) +
      '-' +
      String(
        Number(match[3])
      ).padStart(
        2,
        '0'
      )
    );
  }

  const parsed =
    new Date(text);

  if (
    !isNaN(
      parsed.getTime()
    )
  ) {
    return Utilities.formatDate(
      parsed,
      'Asia/Taipei',
      'yyyy-MM-dd'
    );
  }

  return '9999-12-31';
}


/**
 * 計算台北時區逾期天數。
 */
function calculateV2ArrearsDaysOverdue_(
  dueDateValue
) {
  const dueDateKey =
    normalizeV2ArrearsDateKey_(
      dueDateValue
    );

  if (
    dueDateKey ===
    '9999-12-31'
  ) {
    return 0;
  }

  const todayKey =
    Utilities.formatDate(
      new Date(),
      'Asia/Taipei',
      'yyyy-MM-dd'
    );

  const dueDate =
    new Date(
      dueDateKey +
      'T00:00:00+08:00'
    );

  const today =
    new Date(
      todayKey +
      'T00:00:00+08:00'
    );

  const days =
    Math.floor(
      (
        today.getTime() -
        dueDate.getTime()
      ) /
      86400000
    );

  return Math.max(
    0,
    days
  );
}


/**
 * 測試 603 是否已重新進入欠款資料。
 */
function testLandlordArrearsIncludes603() {
  const landlordLineUserId =
    getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID');

  const result =
    getLandlordArrearsByLineUid(
      landlordLineUserId
    );

  const arrears =
    result &&
    result.data &&
    Array.isArray(
      result.data.arrears
    )
      ? result.data.arrears
      : [];

  const room603 =
    arrears.filter(
      function (item) {
        return (
          String(
            item.room_name ||
            ''
          ).trim() === '603'
        );
      }
    );

  Logger.log(
    JSON.stringify(
      {
        success:
          result.success,

        code:
          result.code,

        data_source:
          result.data &&
          result.data.summary
            ? result.data
                .summary
                .data_source
            : '',

        arrears_count:
          arrears.length,

        room_603_found:
          room603.length > 0,

        room_603:
          room603
      },
      null,
      2
    )
  );

  return result;
}


// ==================================================
// Landlord Tenants
// ==================================================

function getLandlordTenantsByLineUid(lineUserId) {
  const action = 'landlord_tenants';

  try {
    lineUserId = String(lineUserId || '').trim();

    if (!lineUserId) {
      logLiffAccess_({
        lineUserId: '',
        userId: '',
        role: 'landlord',
        action,
        targetId: '',
        result: 'failed',
        errorMessage: 'line_user_id is required'
      });

      return {
        success: false,
        code: 'MISSING_LINE_UID',
        message: '缺少 LINE UID',
        data: {
          landlord: null,
          summary: {},
          tenants: []
        }
      };
    }

    const homeResult = getLandlordHomeByLineUid(lineUserId);

    if (!homeResult || homeResult.success !== true) {
      logLiffAccess_({
        lineUserId,
        userId: '',
        role: 'landlord',
        action,
        targetId: '',
        result: 'failed',
        errorMessage: homeResult && homeResult.message ? homeResult.message : 'landlord not found'
      });

      return {
        success: false,
        code: homeResult && homeResult.code ? homeResult.code : 'LANDLORD_NOT_FOUND',
        message: homeResult && homeResult.message ? homeResult.message : '查無房東資料，請先完成身份綁定',
        data: {
          landlord: null,
          summary: {},
          tenants: []
        }
      };
    }

    const landlord = homeResult.data;
    const rows = getSheetObjects_(V2_SHEETS.landlordTenantListView);

    const tenants = rows
      .filter(row => String(row.line_user_id || '').trim() === lineUserId)
      .map(row => ({
        line_user_id: row.line_user_id,
        user_id: row.user_id,
        landlord_id: row.landlord_id,
        landlord_name: row.landlord_name,

        tenant_line_user_id: row.tenant_line_user_id,
        tenant_user_id: row.tenant_user_id,
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name,

        tenant_phone: row.tenant_phone,
        tenant_email: row.tenant_email,
        tenant_binding_status: row.tenant_binding_status,

        room_list: row.room_list,

        latest_bill_month: row.latest_bill_month,
        latest_due_date: row.latest_due_date,
        latest_total_amount: Number(row.latest_total_amount || 0),
        latest_payment_status: row.latest_payment_status,

        unpaid_bill_count: Number(row.unpaid_bill_count || 0),
        unpaid_total_amount: Number(row.unpaid_total_amount || 0),

        tenant_account_status: row.tenant_account_status,
        updated_at: row.updated_at
      }));

    const tenantCount = tenants.length;

    const unpaidTenantCount = tenants.filter(item => {
      return (
        Number(item.unpaid_bill_count || 0) > 0 ||
        String(item.latest_payment_status || '').toLowerCase() === 'unpaid'
      );
    }).length;

    const paidTenantCount = tenants.filter(item => {
      return String(item.latest_payment_status || '').toLowerCase() === 'paid';
    }).length;

    const unpaidTotalAmount = tenants.reduce((sum, item) => {
      return sum + Number(item.unpaid_total_amount || 0);
    }, 0);

    const latestTotalAmount = tenants.reduce((sum, item) => {
      return sum + Number(item.latest_total_amount || 0);
    }, 0);

    logLiffAccess_({
      lineUserId,
      userId: landlord.user_id || '',
      role: 'landlord',
      action,
      targetId: landlord.landlord_id || '',
      result: 'success',
      errorMessage: '',
      notes: 'tenant_count=' + tenantCount
    });

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data: {
        landlord: {
          line_user_id: landlord.line_user_id,
          user_id: landlord.user_id,
          landlord_id: landlord.landlord_id,
          landlord_name: landlord.landlord_name,
          room_count: Number(landlord.room_count || 0),
          tenant_count: Number(landlord.tenant_count || 0),
          account_status: landlord.account_status,
          updated_at: landlord.updated_at
        },
        summary: {
          tenant_count: tenantCount,
          unpaid_tenant_count: unpaidTenantCount,
          paid_tenant_count: paidTenantCount,
          unpaid_total_amount: unpaidTotalAmount,
          latest_total_amount: latestTotalAmount
        },
        tenants
      }
    };

  } catch (error) {
    logLiffAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'landlord',
      action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message,
      data: {
        landlord: null,
        summary: {},
        tenants: []
      }
    };
  }
}


function testGetLandlordTenantsByLineUid() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(V2_SHEETS.landlordTenantListView);

  const testLineUserId = sheet.getRange('A2').getValue();
  const result = getLandlordTenantsByLineUid(testLineUserId);

  Logger.log(JSON.stringify(result, null, 2));
}


// ==================================================
// LINE Message Sending
// ==================================================

/**
 * 房東從 LIFF 傳 LINE 訊息給指定房客
 * v2_action=landlord_send_tenant_message
 */
function landlordSendTenantMessageByLineUid_(
  landlordLineUserId,
  tenantId,
  tenantUserId,
  messageType,
  messageText
) {
  let reminderLock = null;
  let reminderLockAcquired = false;

  try {
    landlordLineUserId = String(
      landlordLineUserId || ''
    ).trim();

    tenantId = String(
      tenantId || ''
    ).trim();

    tenantUserId = String(
      tenantUserId || ''
    ).trim();

    messageType = String(
      messageType || ''
    )
      .trim()
      .toLowerCase();

    messageText = String(
      messageText || ''
    ).trim();

    if (!landlordLineUserId) {
      return {
        success: false,
        code: 'MISSING_LANDLORD_LINE_UID',
        message: '缺少房東 LINE User ID'
      };
    }

    if (!tenantId && !tenantUserId) {
      return {
        success: false,
        code: 'MISSING_TENANT_ID',
        message: '缺少 tenant_id 或 tenant_user_id'
      };
    }

    const allowedMessageTypes = [
      'payment_reminder',
      'custom'
    ];

    if (
      allowedMessageTypes.indexOf(
        messageType
      ) === -1
    ) {
      return {
        success: false,
        code: 'INVALID_MESSAGE_TYPE',
        message: '缺少或不支援的訊息類型'
      };
    }

    if (messageText.length > 500) {
      return {
        success: false,
        code: 'MESSAGE_TOO_LONG',
        message: '自訂訊息最多 500 字'
      };
    }

    if (
      messageType === 'custom' &&
      !messageText
    ) {
      return {
        success: false,
        code: 'EMPTY_MESSAGE_TEXT',
        message: '請輸入要傳送的 LINE 訊息'
      };
    }

    const rows = getSheetObjects_(
      V2_SHEETS.landlordTenantListView
    );

    const tenant = rows.find(row => {
      const rowLandlordLineUserId =
        String(
          row.line_user_id || ''
        ).trim();

      const rowTenantId =
        String(
          row.tenant_id || ''
        ).trim();

      const rowTenantUserId =
        String(
          row.tenant_user_id || ''
        ).trim();

      return (
        rowLandlordLineUserId ===
          landlordLineUserId &&
        (
          (
            tenantId &&
            rowTenantId === tenantId
          ) ||
          (
            tenantUserId &&
            rowTenantUserId ===
              tenantUserId
          )
        )
      );
    });

    if (!tenant) {
      cmwebsLogLineMessage_({
        direction: 'outgoing',
        source: 'landlord_liff',
        landlord_line_user_id:
          landlordLineUserId,
        tenant_id: tenantId,
        tenant_user_id:
          tenantUserId,
        tenant_line_user_id: '',
        tenant_name: '',
        room_list: '',
        message_type:
          messageType,
        message_text:
          messageText,
        status: 'failed',
        note:
          'tenant not found under landlord'
      });

      return {
        success: false,
        code: 'TENANT_NOT_FOUND',
        message:
          '找不到此房東名下的房客資料'
      };
    }

    const tenantLineUserId =
      String(
        tenant.tenant_line_user_id ||
        ''
      ).trim();

    if (!tenantLineUserId) {
      cmwebsLogLineMessage_({
        direction: 'outgoing',
        source: 'landlord_liff',
        landlord_line_user_id:
          landlordLineUserId,
        tenant_line_user_id: '',
        tenant_id:
          tenant.tenant_id ||
          tenantId,
        tenant_user_id:
          tenant.tenant_user_id ||
          tenantUserId,
        tenant_name:
          tenant.tenant_name,
        room_list:
          tenant.room_list,
        message_type:
          messageType,
        message_text:
          messageText,
        status: 'failed',
        note:
          'tenant_line_user_id empty'
      });

      return {
        success: false,
        code:
          'TENANT_LINE_UID_EMPTY',
        message:
          '此房客尚未完成 LINE 綁定，無法推播 LINE 訊息'
      };
    }

    const bindingStatus =
      String(
        tenant.tenant_binding_status ||
        ''
      )
        .trim()
        .toLowerCase();

    if (
      bindingStatus &&
      bindingStatus !== 'bound' &&
      bindingStatus !==
        'checked_in' &&
      bindingStatus !== 'active'
    ) {
      cmwebsLogLineMessage_({
        direction: 'outgoing',
        source: 'landlord_liff',
        landlord_line_user_id:
          landlordLineUserId,
        tenant_line_user_id:
          tenantLineUserId,
        tenant_id:
          tenant.tenant_id ||
          tenantId,
        tenant_user_id:
          tenant.tenant_user_id ||
          tenantUserId,
        tenant_name:
          tenant.tenant_name,
        room_list:
          tenant.room_list,
        message_type:
          messageType,
        message_text:
          messageText,
        status: 'failed',
        note:
          'tenant binding status invalid: ' +
          bindingStatus
      });

      return {
        success: false,
        code: 'TENANT_NOT_BOUND',
        message:
          '此房客目前不是已綁定狀態，無法推播 LINE 訊息'
      };
    }

    const resolvedTenantId =
      String(
        tenant.tenant_id ||
        tenantId ||
        ''
      ).trim();

    const resolvedTenantUserId =
      String(
        tenant.tenant_user_id ||
        tenant.user_id ||
        tenantUserId ||
        ''
      ).trim();

    if (
      messageType ===
      'payment_reminder'
    ) {
      reminderLock =
        LockService.getScriptLock();

      reminderLockAcquired =
        reminderLock.tryLock(15000);

      if (!reminderLockAcquired) {
        return {
          success: false,
          code: 'REQUEST_BUSY',
          message:
            '系統正在處理另一筆催繳請求，請稍後再試'
        };
      }

      const unpaidBills =
        getTenantUnpaidBillsFromBillView_(
          resolvedTenantId,
          resolvedTenantUserId,
          tenantLineUserId
        );

      if (unpaidBills.length === 0) {
        logPaymentReminderBlocked_({
          landlordLineUserId,
          tenant,
          tenantLineUserId,
          code:
            'TENANT_HAS_NO_UNPAID_BILL',
          message:
            '此房客目前沒有未繳帳單，系統已阻止催繳'
        });

        return {
          success: false,
          code:
            'TENANT_HAS_NO_UNPAID_BILL',
          message:
            '此房客目前沒有未繳帳單，系統已阻止催繳'
        };
      }

      const overdueBills =
        getTenantOverdueBillsForReminder_(
          landlordLineUserId,
          resolvedTenantId,
          resolvedTenantUserId,
          tenantLineUserId
        );

      if (overdueBills.length === 0) {
        logPaymentReminderBlocked_({
          landlordLineUserId,
          tenant,
          tenantLineUserId,
          code: 'BILL_NOT_OVERDUE',
          message:
            '此房客的帳單尚未逾期，逾期第 ' +
            V2_PAYMENT_REMINDER_MIN_DAYS_OVERDUE +
            ' 天起才能發送催繳提醒'
        });

        return {
          success: false,
          code: 'BILL_NOT_OVERDUE',
          message:
            '此房客的帳單尚未逾期，逾期第 ' +
            V2_PAYMENT_REMINDER_MIN_DAYS_OVERDUE +
            ' 天起才能發送催繳提醒'
        };
      }

      if (
        hasPendingPaymentReportForTenant_(
          resolvedTenantId,
          resolvedTenantUserId,
          tenantLineUserId
        )
      ) {
        logPaymentReminderBlocked_({
          landlordLineUserId,
          tenant,
          tenantLineUserId,
          code:
            'PAYMENT_REPORT_PENDING',
          message:
            '此房客已有待確認付款回報，系統已暫停催繳'
        });

        return {
          success: false,
          code:
            'PAYMENT_REPORT_PENDING',
          message:
            '此房客已有待確認付款回報，系統已暫停催繳'
        };
      }

      if (
        hasPaymentReminderSentToday_(
          landlordLineUserId,
          resolvedTenantId,
          resolvedTenantUserId,
          tenantLineUserId
        )
      ) {
        logPaymentReminderBlocked_({
          landlordLineUserId,
          tenant,
          tenantLineUserId,
          code:
            'PAYMENT_REMINDER_ALREADY_SENT_TODAY',
          message:
            '此房客今天已成功發送過繳款提醒，系統已阻止重複發送'
        });

        return {
          success: false,
          code:
            'PAYMENT_REMINDER_ALREADY_SENT_TODAY',
          message:
            '此房客今天已成功發送過繳款提醒，系統已阻止重複發送'
        };
      }
    }

    const text =
      buildTenantLineMessage_(
        tenant,
        messageType,
        messageText
      );

    const pushResult =
      pushLineTextMessage_(
        tenantLineUserId,
        text
      );

    if (!pushResult.success) {
      cmwebsLogLineMessage_({
        direction: 'outgoing',
        source: 'landlord_liff',
        landlord_line_user_id:
          landlordLineUserId,
        tenant_line_user_id:
          tenantLineUserId,
        tenant_id:
          resolvedTenantId,
        tenant_user_id:
          resolvedTenantUserId,
        tenant_name:
          tenant.tenant_name,
        room_list:
          tenant.room_list,
        message_type:
          messageType,
        message_text: text,
        status: 'failed',
        note:
          pushResult.message ||
          'LINE push failed'
      });

      return pushResult;
    }

    cmwebsLogLineMessage_({
      direction: 'outgoing',
      source: 'landlord_liff',
      landlord_line_user_id:
        landlordLineUserId,
      tenant_line_user_id:
        tenantLineUserId,
      tenant_id:
        resolvedTenantId,
      tenant_user_id:
        resolvedTenantUserId,
      tenant_name:
        tenant.tenant_name,
      room_list:
        tenant.room_list,
      message_type:
        messageType,
      message_text: text,
      status: 'success',
      note: 'LINE message sent'
    });

    return {
      success: true,
      code: 'OK',
      message: 'LINE 訊息已送出',
      data: {
        tenant_id:
          resolvedTenantId,
        tenant_user_id:
          resolvedTenantUserId,
        tenant_name:
          tenant.tenant_name,
        tenant_line_user_id:
          tenantLineUserId,
        room_list:
          tenant.room_list,
        message_type:
          messageType
      }
    };

  } catch (err) {
    cmwebsLogLineMessage_({
      direction: 'outgoing',
      source: 'landlord_liff',
      landlord_line_user_id:
        landlordLineUserId,
      tenant_line_user_id: '',
      tenant_id:
        tenantId,
      tenant_user_id:
        tenantUserId,
      tenant_name: '',
      room_list: '',
      message_type:
        messageType,
      message_text:
        messageText,
      status: 'error',
      note:
        err && err.message
          ? err.message
          : String(err)
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message:
        err && err.message
          ? err.message
          : String(err)
    };

  } finally {
    if (
      reminderLock &&
      reminderLockAcquired
    ) {
      try {
        reminderLock.releaseLock();
      } catch (error) {
        // 釋放鎖定失敗不影響主流程
      }
    }
  }
}


/**
 * 取得房客目前全部未繳帳單
 */
function getTenantUnpaidBillsFromBillView_(
  tenantId,
  tenantUserId,
  tenantLineUserId
) {
  tenantId = String(
    tenantId || ''
  ).trim();

  tenantUserId = String(
    tenantUserId || ''
  ).trim();

  tenantLineUserId = String(
    tenantLineUserId || ''
  ).trim();

  const rows = getSheetObjects_(
    V2_SHEETS.tenantBillView
  );

  return rows.filter(row => {
    const sameTenant =
      (
        tenantId &&
        String(
          row.tenant_id || ''
        ).trim() === tenantId
      ) ||
      (
        tenantUserId &&
        String(
          row.user_id ||
          row.tenant_user_id ||
          ''
        ).trim() ===
          tenantUserId
      ) ||
      (
        tenantLineUserId &&
        String(
          row.line_user_id ||
          row.tenant_line_user_id ||
          ''
        ).trim() ===
          tenantLineUserId
      );

    if (!sameTenant) {
      return false;
    }

    return (
      String(
        row.payment_status || ''
      )
        .trim()
        .toLowerCase() ===
      'unpaid'
    );
  });
}


/**
 * 取得房客目前可催繳的逾期帳單
 *
 * 規則：
 * - 必須屬於目前房東
 * - payment_status 必須是 unpaid
 * - days_overdue 必須達到設定天數
 */
function getTenantOverdueBillsForReminder_(
  landlordLineUserId,
  tenantId,
  tenantUserId,
  tenantLineUserId
) {
  landlordLineUserId = String(
    landlordLineUserId || ''
  ).trim();

  tenantId = String(
    tenantId || ''
  ).trim();

  tenantUserId = String(
    tenantUserId || ''
  ).trim();

  tenantLineUserId = String(
    tenantLineUserId || ''
  ).trim();

  const rows = getSheetObjects_(
    V2_SHEETS.landlordArrearsView
  );

  return rows.filter(row => {
    const rowLandlordLineUserId =
      String(
        row.line_user_id ||
        row.landlord_line_user_id ||
        ''
      ).trim();

    if (
      rowLandlordLineUserId !==
      landlordLineUserId
    ) {
      return false;
    }

    const sameTenant =
      (
        tenantId &&
        String(
          row.tenant_id || ''
        ).trim() === tenantId
      ) ||
      (
        tenantUserId &&
        String(
          row.tenant_user_id ||
          ''
        ).trim() ===
          tenantUserId
      ) ||
      (
        tenantLineUserId &&
        String(
          row.tenant_line_user_id ||
          ''
        ).trim() ===
          tenantLineUserId
      );

    if (!sameTenant) {
      return false;
    }

    const paymentStatus =
      String(
        row.payment_status || ''
      )
        .trim()
        .toLowerCase();

    const daysOverdue =
      Number(
        row.days_overdue || 0
      );

    return (
      paymentStatus === 'unpaid' &&
      daysOverdue >=
        V2_PAYMENT_REMINDER_MIN_DAYS_OVERDUE
    );
  });
}


/**
 * 檢查房客是否已有待確認付款回報
 */
function hasPendingPaymentReportForTenant_(
  tenantId,
  tenantUserId,
  tenantLineUserId
) {
  tenantId = String(
    tenantId || ''
  ).trim();

  tenantUserId = String(
    tenantUserId || ''
  ).trim();

  tenantLineUserId = String(
    tenantLineUserId || ''
  ).trim();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      V2_SHEETS.paymentReports
    );

  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return false;
  }

  const rows = getSheetObjects_(
    V2_SHEETS.paymentReports
  );

  return rows.some(row => {
    const status =
      String(
        row.status || ''
      )
        .trim()
        .toLowerCase();

    if (status !== 'pending') {
      return false;
    }

    return (
      (
        tenantId &&
        String(
          row.tenant_id || ''
        ).trim() === tenantId
      ) ||
      (
        tenantUserId &&
        String(
          row.tenant_user_id ||
          ''
        ).trim() ===
          tenantUserId
      ) ||
      (
        tenantLineUserId &&
        String(
          row.tenant_line_user_id ||
          ''
        ).trim() ===
          tenantLineUserId
      )
    );
  });
}


/**
 * 檢查同一房東、同一房客今天是否已成功發送催繳
 */
function hasPaymentReminderSentToday_(
  landlordLineUserId,
  tenantId,
  tenantUserId,
  tenantLineUserId
) {
  landlordLineUserId = String(
    landlordLineUserId || ''
  ).trim();

  tenantId = String(
    tenantId || ''
  ).trim();

  tenantUserId = String(
    tenantUserId || ''
  ).trim();

  tenantLineUserId = String(
    tenantLineUserId || ''
  ).trim();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      V2_SHEETS.lineMessageLogs
    );

  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return false;
  }

  const rows = getSheetObjects_(
    V2_SHEETS.lineMessageLogs
  );

  const today =
    Utilities.formatDate(
      new Date(),
      V2_TIMEZONE,
      'yyyy-MM-dd'
    );

  return rows.some(row => {
    const rowMessageType =
      String(
        row.message_type || ''
      )
        .trim()
        .toLowerCase();

    const rowStatus =
      String(
        row.status || ''
      )
        .trim()
        .toLowerCase();

    const rowDirection =
      String(
        row.direction || ''
      )
        .trim()
        .toLowerCase();

    if (
      rowMessageType !==
        'payment_reminder' ||
      rowStatus !== 'success' ||
      (
        rowDirection &&
        rowDirection !== 'outgoing'
      )
    ) {
      return false;
    }

    const rowLandlordLineUserId =
      String(
        row.landlord_line_user_id ||
        ''
      ).trim();

    if (
      landlordLineUserId &&
      rowLandlordLineUserId !==
        landlordLineUserId
    ) {
      return false;
    }

    const sameTenant =
      (
        tenantId &&
        String(
          row.tenant_id || ''
        ).trim() === tenantId
      ) ||
      (
        tenantUserId &&
        String(
          row.tenant_user_id || ''
        ).trim() ===
          tenantUserId
      ) ||
      (
        tenantLineUserId &&
        String(
          row.tenant_line_user_id ||
          ''
        ).trim() ===
          tenantLineUserId
      );

    if (!sameTenant) {
      return false;
    }

    return (
      getDateKey_(
        row.created_at
      ) === today
    );
  });
}


/**
 * 將日期轉成 yyyy-MM-dd，兼容日期物件與試算表文字
 */
function getDateKey_(value) {
  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      V2_TIMEZONE,
      'yyyy-MM-dd'
    );
  }

  const parsedDate =
    new Date(value);

  if (
    !isNaN(
      parsedDate.getTime()
    )
  ) {
    return Utilities.formatDate(
      parsedDate,
      V2_TIMEZONE,
      'yyyy-MM-dd'
    );
  }

  const match =
    String(value).match(
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/
    );

  if (!match) {
    return '';
  }

  return (
    match[1] +
    '-' +
    String(
      Number(match[2])
    ).padStart(2, '0') +
    '-' +
    String(
      Number(match[3])
    ).padStart(2, '0')
  );
}


/**
 * 記錄被後端阻止的催繳請求
 */
function logPaymentReminderBlocked_(
  data
) {
  try {
    const tenant =
      data.tenant || {};

    cmwebsLogLineMessage_({
      direction: 'outgoing',
      source: 'landlord_liff',
      landlord_line_user_id:
        data.landlordLineUserId ||
        '',
      tenant_line_user_id:
        data.tenantLineUserId ||
        '',
      tenant_id:
        tenant.tenant_id ||
        '',
      tenant_user_id:
        tenant.tenant_user_id ||
        tenant.user_id ||
        '',
      tenant_name:
        tenant.tenant_name ||
        '',
      room_list:
        tenant.room_list ||
        '',
      message_type:
        'payment_reminder',
      message_text: '',
      status: 'blocked',
      note:
        String(
          data.code || ''
        ) +
        '｜' +
        String(
          data.message || ''
        )
    });

  } catch (error) {
    // 紀錄失敗不影響主流程
  }
}


/**
 * 建立要傳給房客的 LINE 文字訊息
 */
function buildTenantLineMessage_(tenant, messageType, messageText) {
  const tenantName = tenant.tenant_name || '房客';
  const landlordName = tenant.landlord_name || '房東';
  const roomList = tenant.room_list || '-';
  const billMonth = tenant.latest_bill_month || '-';
  const dueDate = formatDateForLine_(tenant.latest_due_date);
  const unpaidAmount = Number(tenant.unpaid_total_amount || 0);
  const latestAmount = Number(tenant.latest_total_amount || 0);
  const paymentStatus = String(tenant.latest_payment_status || '').toLowerCase();

  const amount = paymentStatus === 'paid' ? latestAmount : unpaidAmount;

  if (messageType === 'custom') {
    return [
      '【CMWebs 租屋通知】',
      '',
      tenantName + ' 您好：',
      '',
      messageText,
      '',
      '房號：' + roomList,
      '',
      '此訊息由 ' + landlordName + ' 透過 CMWebs 租屋管理系統發送。'
    ].join('\n');
  }

  if (messageType === 'payment_reminder') {
    return [
      '【CMWebs 租屋繳費提醒】',
      '',
      tenantName + ' 您好：',
      '',
      '這裡是 ' + landlordName + ' 的租屋管理系統提醒。',
      '您目前有租屋帳款尚未完成繳款。',
      '',
      '房號：' + roomList,
      '帳單月份：' + billMonth,
      '繳款期限：' + dueDate,
      '未繳金額：NT$ ' + Math.round(amount).toLocaleString('zh-TW'),
      '',
      '若您已完成繳款，請忽略此訊息或與房東確認。',
      '謝謝您。'
    ].join('\n');
  }

  return [
    '【CMWebs 租屋通知】',
    '',
    tenantName + ' 您好：',
    '',
    '這裡是 ' + landlordName + ' 的租屋管理系統通知。',
    '',
    '房號：' + roomList,
    '',
    '請您查看租屋相關資訊，謝謝。'
  ].join('\n');
}


/**
 * 呼叫 LINE Messaging API Push Message
 */
function pushLineTextMessage_(toLineUserId, text) {
  const token = PropertiesService
    .getScriptProperties()
    .getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  if (!token) {
    return {
      success: false,
      code: 'LINE_TOKEN_NOT_SET',
      message: '尚未設定 LINE_CHANNEL_ACCESS_TOKEN'
    };
  }

  const url = 'https://api.line.me/v2/bot/message/push';

  const payload = {
    to: toLineUserId,
    messages: [
      {
        type: 'text',
        text: text
      }
    ]
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = res.getResponseCode();
  const body = res.getContentText();

  if (statusCode >= 200 && statusCode < 300) {
    return {
      success: true,
      code: 'OK',
      message: 'LINE push message success'
    };
  }

  return {
    success: false,
    code: 'LINE_PUSH_FAILED',
    message: 'LINE push message failed: HTTP ' + statusCode + ' / ' + body
  };
}


// ==================================================
// LINE Message Logs / Webhook Incoming
// ==================================================

/**
 * 房東查詢 LINE 訊息發送與回覆紀錄
 * v2_action=landlord_line_logs
 */
function getLandlordLineLogsByLineUid(lineUserId, tenantId, tenantUserId) {
  const action = 'landlord_line_logs';

  try {
    lineUserId = String(lineUserId || '').trim();
    tenantId = String(tenantId || '').trim();
    tenantUserId = String(tenantUserId || '').trim();

    if (!lineUserId) {
      logLiffAccess_({
        lineUserId: '',
        userId: '',
        role: 'landlord',
        action,
        targetId: '',
        result: 'failed',
        errorMessage: 'line_user_id is required'
      });

      return {
        success: false,
        code: 'MISSING_LINE_UID',
        message: '缺少 LINE UID',
        data: {
          logs: []
        }
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(V2_SHEETS.lineMessageLogs);

    if (!sheet) {
      return {
        success: true,
        code: 'OK',
        message: '目前沒有 LINE 訊息紀錄',
        data: {
          logs: []
        }
      };
    }

    const rows = getSheetObjects_(V2_SHEETS.lineMessageLogs);

    let logs = rows.filter(row => {
      const rowLandlordLineUserId = String(row.landlord_line_user_id || '').trim();
      const rowTenantId = String(row.tenant_id || '').trim();
      const rowTenantUserId = String(row.tenant_user_id || '').trim();

      if (rowLandlordLineUserId !== lineUserId) {
        return false;
      }

      if (tenantId && rowTenantId !== tenantId) {
        return false;
      }

      if (tenantUserId && rowTenantUserId !== tenantUserId) {
        return false;
      }

      return true;
    });

    logs = logs
      .map(row => ({
        created_at: row.created_at,
        direction: row.direction,
        source: row.source,
        line_message_id: row.line_message_id,
        reply_token: row.reply_token,

        landlord_line_user_id: row.landlord_line_user_id,
        tenant_line_user_id: row.tenant_line_user_id,
        tenant_id: row.tenant_id,
        tenant_user_id: row.tenant_user_id,
        tenant_name: row.tenant_name,
        room_list: row.room_list,

        message_type: row.message_type,
        message_text: row.message_text,
        status: row.status,
        note: row.note
      }))
      .sort((a, b) => {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();

        if (isNaN(da) && isNaN(db)) return 0;
        if (isNaN(da)) return 1;
        if (isNaN(db)) return -1;

        return db - da;
      });

    logLiffAccess_({
      lineUserId,
      userId: '',
      role: 'landlord',
      action,
      targetId: tenantId || tenantUserId || '',
      result: 'success',
      errorMessage: '',
      notes: 'line_logs_count=' + logs.length
    });

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data: {
        logs
      }
    };

  } catch (error) {
    logLiffAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'landlord',
      action,
      targetId: tenantId || tenantUserId || '',
      result: 'failed',
      errorMessage: error.message
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message,
      data: {
        logs: []
      }
    };
  }
}


/**
 * LINE Webhook 主處理函式
 * doPost(e) 會呼叫這個函式
 */
function handleLineWebhook_(postBody) {
  try {
    const bodyText = String(postBody || '').trim();

    if (!bodyText) {
      return {
        success: true,
        code: 'EMPTY_BODY',
        message: 'Webhook body empty'
      };
    }

    const body = JSON.parse(bodyText);
    const events = Array.isArray(body.events) ? body.events : [];

    if (events.length === 0) {
      return {
        success: true,
        code: 'NO_EVENTS',
        message: 'No webhook events'
      };
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    events.forEach(event => {
      const result = processLineWebhookEvent_(event);

      if (result && result.success === true && result.processed === true) {
        processed++;
      } else if (result && result.skipped === true) {
        skipped++;
      } else {
        errors++;
      }
    });

    return {
      success: true,
      code: 'OK',
      message: 'LINE webhook processed',
      data: {
        total: events.length,
        processed,
        skipped,
        errors
      }
    };

  } catch (err) {
    cmwebsLogLineMessage_({
      direction: 'incoming',
      source: 'line_webhook',
      line_message_id: '',
      reply_token: '',
      landlord_line_user_id: '',
      tenant_line_user_id: '',
      tenant_id: '',
      tenant_user_id: '',
      tenant_name: '',
      room_list: '',
      message_type: 'webhook_error',
      message_text: '',
      status: 'error',
      note: err && err.message ? err.message : String(err)
    });

    return {
      success: false,
      code: 'WEBHOOK_ERROR',
      message: err && err.message ? err.message : String(err)
    };
  }
}


/**
 * 處理單一 LINE webhook event
 */
function processLineWebhookEvent_(event) {
  try {
    if (!event) {
      return {
        success: true,
        skipped: true,
        reason: 'empty event'
      };
    }

    const eventType = String(event.type || '');
    const source = event.source || {};
    const tenantLineUserId = String(source.userId || '').trim();
    const replyToken = String(event.replyToken || '').trim();

    if (!tenantLineUserId) {
      return {
        success: true,
        skipped: true,
        reason: 'source.userId empty'
      };
    }

    const tenant = findTenantByTenantLineUserId_(tenantLineUserId);

    // 只先處理使用者傳來的 message event
    if (eventType !== 'message') {
      cmwebsLogLineMessage_({
        direction: 'incoming',
        source: 'line_webhook',
        line_message_id: '',
        reply_token: replyToken,

        landlord_line_user_id: tenant ? tenant.line_user_id : '',
        tenant_line_user_id: tenantLineUserId,
        tenant_id: tenant ? tenant.tenant_id : '',
        tenant_user_id: tenant ? tenant.tenant_user_id : '',
        tenant_name: tenant ? tenant.tenant_name : '',
        room_list: tenant ? tenant.room_list : '',

        message_type: 'event_' + eventType,
        message_text: '',
        status: tenant ? 'received' : 'unmatched',
        note: tenant ? 'non-message event received' : 'tenant not found by tenant_line_user_id'
      });

      return {
        success: true,
        processed: true,
        reason: 'non-message event logged'
      };
    }

    const message = event.message || {};
    const lineMessageId = String(message.id || '').trim();
    const lineMessageType = String(message.type || '').trim();

    if (lineMessageId && isLineMessageAlreadyLogged_(lineMessageId, 'incoming')) {
      return {
        success: true,
        skipped: true,
        reason: 'duplicate message id'
      };
    }

    let messageText = '';

    if (lineMessageType === 'text') {
      messageText = String(message.text || '');
    } else {
      messageText = '[非文字訊息：' + lineMessageType + ']';
    }

    cmwebsLogLineMessage_({
      direction: 'incoming',
      source: 'tenant_line',
      line_message_id: lineMessageId,
      reply_token: replyToken,

      landlord_line_user_id: tenant ? tenant.line_user_id : '',
      tenant_line_user_id: tenantLineUserId,
      tenant_id: tenant ? tenant.tenant_id : '',
      tenant_user_id: tenant ? tenant.tenant_user_id : '',
      tenant_name: tenant ? tenant.tenant_name : '',
      room_list: tenant ? tenant.room_list : '',

      message_type: lineMessageType === 'text' ? 'incoming_text' : 'incoming_' + lineMessageType,
      message_text: messageText,
      status: tenant ? 'received' : 'unmatched',
      note: tenant ? 'tenant message received' : 'tenant not found by tenant_line_user_id'
    });

    return {
      success: true,
      processed: true
    };

  } catch (err) {
    cmwebsLogLineMessage_({
      direction: 'incoming',
      source: 'line_webhook',
      line_message_id: '',
      reply_token: '',
      landlord_line_user_id: '',
      tenant_line_user_id: '',
      tenant_id: '',
      tenant_user_id: '',
      tenant_name: '',
      room_list: '',
      message_type: 'event_error',
      message_text: '',
      status: 'error',
      note: err && err.message ? err.message : String(err)
    });

    return {
      success: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}


/**
 * 用房客 LINE UID 反查房客資料
 */
function findTenantByTenantLineUserId_(tenantLineUserId) {
  tenantLineUserId = String(tenantLineUserId || '').trim();

  if (!tenantLineUserId) {
    return null;
  }

  const rows = getSheetObjects_(V2_SHEETS.landlordTenantListView);

  return rows.find(row => {
    return String(row.tenant_line_user_id || '').trim() === tenantLineUserId;
  }) || null;
}


/**
 * 避免 LINE webhook redelivery 重複寫入同一則訊息
 */
function isLineMessageAlreadyLogged_(lineMessageId, direction) {
  lineMessageId = String(lineMessageId || '').trim();
  direction = String(direction || '').trim();

  if (!lineMessageId) {
    return false;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(V2_SHEETS.lineMessageLogs);

  if (!sheet) {
    return false;
  }

  const rows = getSheetObjects_(V2_SHEETS.lineMessageLogs);

  return rows.some(row => {
    return (
      String(row.line_message_id || '').trim() === lineMessageId &&
      String(row.direction || '').trim() === direction
    );
  });
}


/**
 * LINE 訊息紀錄
 * 若沒有 V2_line_message_logs，會自動建立
 * 若舊表缺欄位，會自動補欄位
 */
function cmwebsLogLineMessage_(data) {
  try {
    const sheet = ensureLineMessageLogSheet_();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(header => String(header || '').trim());

    const rowObj = {
      created_at: new Date(),

      direction: data.direction || 'outgoing',
      source: data.source || 'landlord_liff',
      line_message_id: data.line_message_id || '',
      reply_token: data.reply_token || '',

      landlord_line_user_id: data.landlord_line_user_id || '',
      tenant_line_user_id: data.tenant_line_user_id || '',
      tenant_id: data.tenant_id || '',
      tenant_user_id: data.tenant_user_id || '',
      tenant_name: data.tenant_name || '',
      room_list: data.room_list || '',

      message_type: data.message_type || '',
      message_text: data.message_text || '',
      status: data.status || '',
      note: data.note || ''
    };

    const row = headers.map(header => rowObj[header] !== undefined ? rowObj[header] : '');

    sheet.appendRow(row);

  } catch (err) {
    // log 失敗不能影響主流程
  }
}


/**
 * 確保 V2_line_message_logs 存在，且欄位完整
 */
function ensureLineMessageLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(V2_SHEETS.lineMessageLogs);

  const requiredHeaders = [
    'created_at',

    'direction',
    'source',
    'line_message_id',
    'reply_token',

    'landlord_line_user_id',
    'tenant_line_user_id',
    'tenant_id',
    'tenant_user_id',
    'tenant_name',
    'room_list',

    'message_type',
    'message_text',
    'status',
    'note'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(V2_SHEETS.lineMessageLogs);
    sheet.appendRow(requiredHeaders);
    return sheet;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(header => String(header || '').trim());

  if (currentHeaders.every(header => header === '')) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return sheet;
  }

  requiredHeaders.forEach(header => {
    if (currentHeaders.indexOf(header) === -1) {
      const newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(header);
      currentHeaders.push(header);
    }
  });

  return sheet;
}


/**
 * 測試：手動模擬一筆 LINE 文字訊息 webhook
 */
function testHandleLineWebhook() {
  const sample = {
    events: [
      {
        type: 'message',
        replyToken: 'TEST_REPLY_TOKEN',
        source: {
          type: 'user',
          userId: '請換成某位房客的 tenant_line_user_id'
        },
        message: {
          id: 'TEST-MSG-' + new Date().getTime(),
          type: 'text',
          text: '這是房客測試回覆'
        }
      }
    ]
  };

  const result = handleLineWebhook_(JSON.stringify(sample));

  Logger.log(JSON.stringify(result, null, 2));
}


// ==================================================
// Output Helpers
// ==================================================

function jsonOutput_(obj, callback) {
  const json = JSON.stringify(obj);
  const cb = String(callback || '').trim();

  if (cb !== '') {
    return ContentService
      .createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}


function htmlBridgeOutput_(obj, requestId) {
  const envelope = {
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: requestId || '',
    payload: obj
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
<script>
  window.parent.postMessage(${JSON.stringify(envelope).replace(/</g, '\\u003c')}, '*');
</script>
</body>
</html>
`;

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


// ==================================================
// Sheet Helpers
// ==================================================

function getSheetObjects_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }

  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) {
    return [];
  }

  const headers = values[0].map(header => String(header || '').trim());
  const rows = values.slice(1);

  return rows
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};

      headers.forEach((header, index) => {
        if (header) {
          obj[header] = row[index];
        }
      });

      return obj;
    });
}


// ==================================================
// Logs
// ==================================================

function logLiffAccess_(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(V2_SHEETS.liffAccessLogs);

    if (!sheet) {
      sheet = ss.insertSheet(V2_SHEETS.liffAccessLogs);
      sheet.appendRow([
        'log_id',
        'created_at',
        'line_user_id',
        'user_id',
        'role',
        'action',
        'target_id',
        'result',
        'error_message',
        'user_agent',
        'ip_hint',
        'notes'
      ]);
    }

    const now = new Date();
    const timestamp = Utilities.formatDate(now, V2_TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    const logId =
      'LOG-' +
      Utilities.formatDate(now, V2_TIMEZONE, 'yyyyMMddHHmmss') +
      '-' +
      Math.floor(Math.random() * 10000);

    sheet.appendRow([
      logId,
      timestamp,
      params.lineUserId || '',
      params.userId || '',
      params.role || '',
      params.action || '',
      params.targetId || '',
      params.result || '',
      params.errorMessage || '',
      params.userAgent || '',
      params.ipHint || '',
      params.notes || ''
    ]);

  } catch (err) {
    // log 失敗不能影響主流程
  }
}




// ==================================================
// Date Helpers
// ==================================================

function formatDateForLine_(value) {
  if (!value) return '-';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, V2_TIMEZONE, 'yyyy-MM-dd');
  }

  const text = String(value);

  if (text.indexOf('T') >= 0) {
    const d = new Date(text);

    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, V2_TIMEZONE, 'yyyy-MM-dd');
    }
  }

  return text;
}


// ==================================================
// Test Helpers
// ==================================================

function testLineTokenProperty() {
  const token = PropertiesService
    .getScriptProperties()
    .getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  Logger.log(token ? '已讀到 LINE token，長度：' + token.length : '沒有讀到 LINE token');
}

function testUrlFetchPermission() {
  const res = UrlFetchApp.fetch('https://api.line.me', {
    method: 'get',
    muteHttpExceptions: true
  });

  Logger.log('UrlFetchApp permission OK, status=' + res.getResponseCode());
}


// ==================================================
// V1 Paid Status → V2 Bills Sync
// ==================================================

/**
 * 將 V1「3.歷史帳單總表」的已繳狀態同步到 V2_bills
 *
 * 規則：
 * 1. 只把 V1 的「已繳」同步成 V2 paid
 * 2. 不會把 V2 paid 降回 unpaid
 * 3. 依 legacy_ref 比對：
 *    old_bill_YYYY-MM_room_房號
 * 4. 同步時更新 updated_at、notes
 */
function syncV1PaidBillsToV2() {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const legacySheet = ss.getSheetByName(
      V2_SHEETS.legacyBillHistory
    );

    const v2BillSheet = ss.getSheetByName(
      V2_SHEETS.bills
    );

    if (!legacySheet) {
      throw new Error(
        '找不到 V1 工作表：' +
        V2_SHEETS.legacyBillHistory
      );
    }

    if (!v2BillSheet) {
      throw new Error(
        '找不到 V2 工作表：' +
        V2_SHEETS.bills
      );
    }

    if (legacySheet.getLastRow() < 2) {
      return {
        success: true,
        code: 'NO_V1_DATA',
        message: 'V1 沒有可同步資料',
        data: {
          v1_paid_count: 0,
          matched_count: 0,
          updated_count: 0,
          already_paid_count: 0,
          not_found_count: 0,
          not_found: []
        }
      };
    }

    if (v2BillSheet.getLastRow() < 2) {
      return {
        success: false,
        code: 'NO_V2_BILLS',
        message: 'V2_bills 沒有帳單資料'
      };
    }

    const legacyValues =
      legacySheet.getDataRange().getValues();

    const v2Values =
      v2BillSheet.getDataRange().getValues();

    const legacyHeaders = legacyValues[0].map(
      header => String(header || '').trim()
    );

    const v2Headers = v2Values[0].map(
      header => String(header || '').trim()
    );

    const legacyHeaderMap =
      buildHeaderMap_(legacyHeaders);

    const v2HeaderMap =
      buildHeaderMap_(v2Headers);

    validateRequiredHeaders_(
      legacyHeaderMap,
      [
        '結帳年份',
        '結帳月份',
        '房號',
        '繳費狀態'
      ],
      V2_SHEETS.legacyBillHistory
    );

    validateRequiredHeaders_(
      v2HeaderMap,
      [
        'bill_id',
        'bill_month',
        'room_name',
        'payment_status',
        'updated_at',
        'legacy_ref'
      ],
      V2_SHEETS.bills
    );

    /*
     * 建立 V2 legacy_ref 索引
     * key = old_bill_2026-07_room_101
     * value = V2 資料列陣列索引
     */
    const v2IndexByLegacyRef = {};

    for (let i = 1; i < v2Values.length; i++) {
      const row = v2Values[i];

      const legacyRef = normalizeText_(
        row[v2HeaderMap.legacy_ref]
      );

      if (legacyRef) {
        v2IndexByLegacyRef[legacyRef] = i;
      }
    }

    const now = new Date();

    let v1PaidCount = 0;
    let matchedCount = 0;
    let updatedCount = 0;
    let alreadyPaidCount = 0;
    let notFoundCount = 0;

    const notFound = [];
    const updatedBills = [];

    for (let i = 1; i < legacyValues.length; i++) {
      const legacyRow = legacyValues[i];

      const paymentStatus = normalizeText_(
        legacyRow[
          legacyHeaderMap['繳費狀態']
        ]
      );

      if (!isLegacyPaidStatus_(paymentStatus)) {
        continue;
      }

      v1PaidCount++;

      const year = normalizeLegacyYear_(
        legacyRow[
          legacyHeaderMap['結帳年份']
        ]
      );

      const month = normalizeLegacyMonth_(
        legacyRow[
          legacyHeaderMap['結帳月份']
        ]
      );

      const roomName = normalizeRoomName_(
        legacyRow[
          legacyHeaderMap['房號']
        ]
      );

      if (!year || !month || !roomName) {
        notFoundCount++;

        notFound.push({
          sheet_row: i + 1,
          reason: 'V1 年份、月份或房號不完整',
          year: year,
          month: month,
          room_name: roomName
        });

        continue;
      }

      const billMonth =
        year + '-' + month;

      const legacyRef =
        'old_bill_' +
        billMonth +
        '_room_' +
        roomName;

      const v2ArrayIndex =
        v2IndexByLegacyRef[legacyRef];

      if (
        v2ArrayIndex === undefined ||
        v2ArrayIndex === null
      ) {
        notFoundCount++;

        notFound.push({
          sheet_row: i + 1,
          reason: 'V2_bills 找不到相符 legacy_ref',
          legacy_ref: legacyRef,
          bill_month: billMonth,
          room_name: roomName
        });

        continue;
      }

      matchedCount++;

      const v2Row =
        v2Values[v2ArrayIndex];

      const currentV2Status =
        normalizeText_(
          v2Row[
            v2HeaderMap.payment_status
          ]
        ).toLowerCase();

      if (currentV2Status === 'paid') {
        alreadyPaidCount++;
        continue;
      }

      v2Row[
        v2HeaderMap.payment_status
      ] = 'paid';

      v2Row[
        v2HeaderMap.updated_at
      ] = now;

      if (
        v2HeaderMap.notes !== undefined
      ) {
        const oldNote = normalizeText_(
          v2Row[v2HeaderMap.notes]
        );

        const syncNote =
          'V1已繳同步：' +
          Utilities.formatDate(
            now,
            V2_TIMEZONE,
            'yyyy-MM-dd HH:mm:ss'
          );

        v2Row[v2HeaderMap.notes] =
          appendUniqueNote_(
            oldNote,
            syncNote
          );
      }

      updatedCount++;

      updatedBills.push({
        bill_id:
          v2Row[v2HeaderMap.bill_id],

        bill_month:
          v2Row[v2HeaderMap.bill_month],

        room_name:
          v2Row[v2HeaderMap.room_name],

        legacy_ref:
          legacyRef
      });
    }

    /*
     * 批次寫回整個 V2_bills 資料區
     * 避免逐格更新造成效能問題
     */
    if (updatedCount > 0) {
      v2BillSheet
        .getRange(
          2,
          1,
          v2Values.length - 1,
          v2Values[0].length
        )
        .setValues(
          v2Values.slice(1)
        );
    }

    appendV1V2SyncLog_({
      sync_type:
        'v1_paid_to_v2_bills',

      result:
        'success',

      v1_paid_count:
        v1PaidCount,

      matched_count:
        matchedCount,

      updated_count:
        updatedCount,

      already_paid_count:
        alreadyPaidCount,

      not_found_count:
        notFoundCount,

      note:
        notFoundCount > 0
          ? JSON.stringify(
              notFound.slice(0, 20)
            )
          : ''
    });

    return {
      success: true,
      code: 'OK',
      message:
        'V1 已繳狀態同步完成',

      data: {
        v1_paid_count:
          v1PaidCount,

        matched_count:
          matchedCount,

        updated_count:
          updatedCount,

        already_paid_count:
          alreadyPaidCount,

        not_found_count:
          notFoundCount,

        updated_bills:
          updatedBills,

        not_found:
          notFound
      }
    };

  } catch (error) {
    appendV1V2SyncLog_({
      sync_type:
        'v1_paid_to_v2_bills',

      result:
        'failed',

      v1_paid_count: 0,
      matched_count: 0,
      updated_count: 0,
      already_paid_count: 0,
      not_found_count: 0,

      note:
        error.message
    });

    return {
      success: false,
      code: 'SYNC_ERROR',
      message:
        '同步失敗：' +
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
 * 建立欄位名稱索引
 */
function buildHeaderMap_(headers) {
  const map = {};

  headers.forEach(
    (header, index) => {
      const key =
        String(header || '').trim();

      if (key) {
        map[key] = index;
      }
    }
  );

  return map;
}


/**
 * 驗證必要欄位
 */
function validateRequiredHeaders_(
  headerMap,
  requiredHeaders,
  sheetName
) {
  const missing =
    requiredHeaders.filter(
      header =>
        headerMap[header] === undefined
    );

  if (missing.length > 0) {
    throw new Error(
      sheetName +
      ' 缺少欄位：' +
      missing.join(', ')
    );
  }
}


/**
 * V1 繳費狀態是否代表已繳
 */
function isLegacyPaidStatus_(value) {
  const text =
    normalizeText_(value)
      .replace(/\s+/g, '')
      .toLowerCase();

  return [
    '已繳',
    '已繳款',
    '已付款',
    'paid',
    'completed'
  ].indexOf(text) !== -1;
}


/**
 * V1 年份格式轉換
 */
function normalizeLegacyYear_(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }

  if (
    Object.prototype.toString.call(value) ===
    '[object Date]'
  ) {
    return Utilities.formatDate(
      value,
      V2_TIMEZONE,
      'yyyy'
    );
  }

  const match =
    String(value).match(/\d{4}/);

  return match
    ? match[0]
    : '';
}


/**
 * V1 月份格式轉換
 * 7月 → 07
 * 07 → 07
 */
function normalizeLegacyMonth_(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }

  if (
    Object.prototype.toString.call(value) ===
    '[object Date]'
  ) {
    return Utilities.formatDate(
      value,
      V2_TIMEZONE,
      'MM'
    );
  }

  const match =
    String(value).match(/\d{1,2}/);

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


/**
 * 標準化房號
 */
function normalizeRoomName_(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  let text =
    String(value).trim();

  if (!text) {
    return '';
  }

  /*
   * Google Sheet 可能把 101 讀成數字，
   * String 後仍會是 101。
   */
  text = text.replace(
    /\.0+$/,
    ''
  );

  return text;
}


/**
 * 標準化文字
 */
function normalizeText_(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


/**
 * 附加備註，避免完全相同內容重複寫入
 */
function appendUniqueNote_(
  originalNote,
  newNote
) {
  originalNote =
    normalizeText_(originalNote);

  newNote =
    normalizeText_(newNote);

  if (!newNote) {
    return originalNote;
  }

  if (
    originalNote.indexOf(newNote) !== -1
  ) {
    return originalNote;
  }

  return originalNote
    ? originalNote + '｜' + newNote
    : newNote;
}


/**
 * 寫入同步紀錄
 */
function appendV1V2SyncLog_(data) {
  try {
    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const sheetName =
      'V2_sync_logs';

    let sheet =
      ss.getSheetByName(
        sheetName
      );

    const headers = [
      'created_at',
      'sync_type',
      'result',
      'v1_paid_count',
      'matched_count',
      'updated_count',
      'already_paid_count',
      'not_found_count',
      'note'
    ];

    if (!sheet) {
      sheet =
        ss.insertSheet(
          sheetName
        );

      sheet.appendRow(
        headers
      );
    }

    sheet.appendRow([
      new Date(),
      data.sync_type || '',
      data.result || '',
      Number(
        data.v1_paid_count || 0
      ),
      Number(
        data.matched_count || 0
      ),
      Number(
        data.updated_count || 0
      ),
      Number(
        data.already_paid_count || 0
      ),
      Number(
        data.not_found_count || 0
      ),
      data.note || ''
    ]);

  } catch (error) {
    // 同步紀錄失敗不能影響主流程
  }
}


/**
 * 測試同步並查看執行結果
 */
function testSyncV1PaidBillsToV2() {
  const result =
    syncV1PaidBillsToV2();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

// ==================================================
// V1 → V2 已繳狀態自動同步觸發器
// ==================================================

/**
 * 安裝 V1 已繳狀態自動同步觸發器
 *
 * 執行一次即可。
 * 系統會先刪除既有同名觸發器，避免重複建立。
 */
function installV1PaidSyncTrigger() {
  const handlerName =
    'syncV1PaidBillsToV2';

  const triggers =
    ScriptApp.getProjectTriggers();

  triggers.forEach(function (trigger) {
    if (
      trigger.getHandlerFunction() ===
      handlerName
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp
    .newTrigger(handlerName)
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log(
    JSON.stringify({
      success: true,
      message:
        '已建立 V1 → V2 已繳狀態同步觸發器',
      interval_minutes: 5,
      handler:
        handlerName
    })
  );
}


/**
 * 移除 V1 → V2 同步觸發器
 */
function removeV1PaidSyncTrigger() {
  const handlerName =
    'syncV1PaidBillsToV2';

  let removedCount = 0;

  ScriptApp
    .getProjectTriggers()
    .forEach(function (trigger) {
      if (
        trigger.getHandlerFunction() ===
        handlerName
      ) {
        ScriptApp.deleteTrigger(trigger);
        removedCount++;
      }
    });

  Logger.log(
    JSON.stringify({
      success: true,
      removed_count:
        removedCount
    })
  );
}


/**
 * 查看同步觸發器是否已建立
 */
function checkV1PaidSyncTrigger() {
  const handlerName =
    'syncV1PaidBillsToV2';

  const matchedTriggers =
    ScriptApp
      .getProjectTriggers()
      .filter(function (trigger) {
        return (
          trigger.getHandlerFunction() ===
          handlerName
        );
      });

  Logger.log(
    JSON.stringify({
      success: true,
      installed:
        matchedTriggers.length > 0,
      trigger_count:
        matchedTriggers.length,
      handler:
        handlerName
    })
  );
}