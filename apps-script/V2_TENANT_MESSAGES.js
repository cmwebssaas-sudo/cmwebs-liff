/**
 * CMWebs V2 房客訊息／報修後端
 *
 * 對應 Code.gs 路由：
 * - tenant_message_init
 * - tenant_message_submit
 *
 * 依賴既有函式：
 * - getTenantHomeByLineUid()
 * - getSheetObjects_()
 * - logLiffAccess_()
 * - pushLineTextMessage_()
 * - cmwebsLogLineMessage_()
 */

const V2_TENANT_MESSAGE_SHEETS_ = {
  landlordTenantListView:
    'V2_landlord_tenant_list_view',
  tenantMessages:
    'V2_tenant_messages'
};


/**
 * 房客傳訊頁初始化
 */
function getTenantMessageInitByLineUid(
  lineUserId
) {
  const action =
    'tenant_message_init';

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
          tenant: null,
          messages: []
        }
      };
    }

    const homeResult =
      getTenantHomeByLineUid(
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
            : 'TENANT_NOT_FOUND',
        message:
          homeResult &&
          homeResult.message
            ? homeResult.message
            : '查無房客資料，請先完成身份綁定',
        data: {
          tenant: null,
          messages: []
        }
      };
    }

    const tenant =
      homeResult.data || {};

    const links =
      getSheetObjects_(
        V2_TENANT_MESSAGE_SHEETS_
          .landlordTenantListView
      );

    const tenantLink =
      links.find(function (row) {
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
      return {
        success: false,
        code:
          'TENANT_LANDLORD_LINK_NOT_FOUND',
        message:
          '找不到房客與房東的關聯資料',
        data: {
          tenant: tenant,
          messages: []
        }
      };
    }

    const messages =
      getTenantMessages_(
        tenant.tenant_id
      );

    logLiffAccess_({
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
        'messages=' +
        messages.length
    });

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data: {
        tenant: {
          line_user_id:
            lineUserId,
          user_id:
            tenant.user_id || '',
          tenant_id:
            tenant.tenant_id || '',
          tenant_name:
            tenant.tenant_name || '',
          room_list:
            tenant.room_list || '',

          landlord_id:
            tenantLink.landlord_id ||
            '',
          landlord_name:
            tenantLink.landlord_name ||
            '',
          landlord_line_user_id:
            tenantLink.line_user_id ||
            tenantLink.landlord_line_user_id ||
            ''
        },
        messages:
          messages
      }
    };

  } catch (error) {
    logLiffAccess_({
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

    return {
      success: false,
      code:
        'SYSTEM_ERROR',
      message:
        '系統錯誤：' +
        error.message,
      data: {
        tenant: null,
        messages: []
      }
    };
  }
}


/**
 * 房客送出訊息或報修
 */
function submitTenantMessageByLineUid_(
  lineUserId,
  messageCategory,
  messageTitle,
  messageBody,
  priority,
  contactTime
) {
  const action =
    'tenant_message_submit';

  try {
    lineUserId =
      String(
        lineUserId || ''
      ).trim();

    messageCategory =
      String(
        messageCategory || ''
      )
        .trim()
        .toLowerCase();

    messageTitle =
      String(
        messageTitle || ''
      ).trim();

    messageBody =
      String(
        messageBody || ''
      ).trim();

    priority =
      String(
        priority || 'normal'
      )
        .trim()
        .toLowerCase();

    contactTime =
      String(
        contactTime || ''
      ).trim();

    if (!lineUserId) {
      return {
        success: false,
        code:
          'MISSING_LINE_UID',
        message:
          '缺少 LINE UID'
      };
    }

    const allowedCategories = [
      'general',
      'repair',
      'payment',
      'contract',
      'other'
    ];

    if (
      allowedCategories.indexOf(
        messageCategory
      ) === -1
    ) {
      return {
        success: false,
        code:
          'INVALID_MESSAGE_CATEGORY',
        message:
          '請選擇正確的訊息類型'
      };
    }

    if (!messageTitle) {
      return {
        success: false,
        code:
          'EMPTY_MESSAGE_TITLE',
        message:
          '請輸入訊息標題'
      };
    }

    if (
      messageTitle.length > 60
    ) {
      return {
        success: false,
        code:
          'MESSAGE_TITLE_TOO_LONG',
        message:
          '訊息標題最多 60 字'
      };
    }

    if (!messageBody) {
      return {
        success: false,
        code:
          'EMPTY_MESSAGE_BODY',
        message:
          '請輸入訊息內容'
      };
    }

    if (
      messageBody.length > 500
    ) {
      return {
        success: false,
        code:
          'MESSAGE_BODY_TOO_LONG',
        message:
          '訊息內容最多 500 字'
      };
    }

    if (
      priority !== 'normal' &&
      priority !== 'urgent'
    ) {
      priority =
        'normal';
    }

    const homeResult =
      getTenantHomeByLineUid(
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
            : 'TENANT_NOT_FOUND',
        message:
          homeResult &&
          homeResult.message
            ? homeResult.message
            : '查無房客資料，請先完成身份綁定'
      };
    }

    const tenant =
      homeResult.data || {};

    const links =
      getSheetObjects_(
        V2_TENANT_MESSAGE_SHEETS_
          .landlordTenantListView
      );

    const tenantLink =
      links.find(function (row) {
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
      return {
        success: false,
        code:
          'TENANT_LANDLORD_LINK_NOT_FOUND',
        message:
          '找不到房客與房東的關聯資料'
      };
    }

    const landlordLineUserId =
      String(
        tenantLink.line_user_id ||
        tenantLink.landlord_line_user_id ||
        ''
      ).trim();

    const now =
      new Date();

    const messageId =
      tenantMessageMakeId_();

    const messageRecord = {
      message_id:
        messageId,
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
        tenantLink.room_id ||
        '',
      room_name:
        tenant.room_list ||
        tenantLink.room_list ||
        tenantLink.room_name ||
        '',

      message_category:
        messageCategory,
      message_title:
        messageTitle,
      message_body:
        messageBody,
      priority:
        priority,
      preferred_contact_time:
        contactTime,

      status:
        'pending',

      landlord_reply:
        '',
      replied_at:
        '',
      closed_at:
        '',

      note:
        ''
    };

    appendTenantMessage_(
      messageRecord
    );

    const notifyText =
      buildTenantMessageNoticeText_(
        messageRecord
      );


    let pushResult = {
      success:
        false,

      code:
        'WORKSPACE_NOTIFICATION_UNAVAILABLE',

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
            messageRecord.landlord_id,

          event_type:
            'tenant_message',

          title:
            (
              messageRecord.priority ===
                'urgent'
                ? '緊急房客訊息：'
                : '收到房客訊息：'
            ) +
            (
              messageRecord.message_title ||
              messageRecord.message_category ||
              '未命名'
            ),

          body:
            notifyText,

          target_type:
            'tenant_message',

          target_id:
            messageRecord.message_id,

          action_url:
            'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-messages.html',

          severity:
            messageRecord.priority ===
              'urgent'
              ? 'urgent'
              : 'info',

          source:
            'tenant_message_form',

          fallback_line_user_id:
            landlordLineUserId,

          metadata: {
            tenant_id:
              messageRecord.tenant_id,

            tenant_name:
              messageRecord.tenant_name,

            room_name:
              messageRecord.room_name,

            message_category:
              messageRecord.message_category,

            priority:
              messageRecord.priority
          }
        });

    } else if (
      landlordLineUserId
    ) {
      pushResult =
        pushLineTextMessage_(
          landlordLineUserId,
          notifyText
        );
    }

    logLiffAccess_({
      lineUserId:
        lineUserId,
      userId:
        messageRecord.tenant_user_id ||
        '',
      role:
        'tenant',
      action:
        action,
      targetId:
        messageId,
      result:
        'success',
      errorMessage:
        '',
      notes:
        'category=' +
        messageCategory +
        ', priority=' +
        priority
    });

    return {
      success: true,
      code: 'OK',
      message:
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
          ? '訊息已送出，管理團隊通知已處理'
          : '訊息已送出，但管理團隊 LINE 通知未成功',
      data: {
        message_id:
          messageId,
        message_category:
          messageCategory,
        message_title:
          messageTitle,
        priority:
          priority,
        status:
          'pending',
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
    };

  } catch (error) {
    logLiffAccess_({
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

    return {
      success: false,
      code:
        'SYSTEM_ERROR',
      message:
        '系統錯誤：' +
        error.message
    };
  }
}


/**
 * 查詢房客送出的訊息
 */
function getTenantMessages_(
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
      V2_TENANT_MESSAGE_SHEETS_
        .tenantMessages
    );

  if (!sheet) {
    return [];
  }

  const rows =
    getSheetObjects_(
      V2_TENANT_MESSAGE_SHEETS_
        .tenantMessages
    );

  return rows
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
        message_id:
          row.message_id,
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

        message_category:
          row.message_category,
        message_title:
          row.message_title,
        message_body:
          row.message_body,
        priority:
          row.priority,
        preferred_contact_time:
          row.preferred_contact_time,

        status:
          row.status,

        landlord_reply:
          row.landlord_reply,
        replied_at:
          row.replied_at,
        closed_at:
          row.closed_at,

        note:
          row.note
      };
    })
    .sort(function (a, b) {
      const da =
        new Date(
          a.created_at
        ).getTime();

      const db =
        new Date(
          b.created_at
        ).getTime();

      if (
        Number.isNaN(da) &&
        Number.isNaN(db)
      ) {
        return 0;
      }

      if (
        Number.isNaN(da)
      ) {
        return 1;
      }

      if (
        Number.isNaN(db)
      ) {
        return -1;
      }

      return db - da;
    })
    .slice(0, 50);
}


/**
 * 新增房客訊息
 */
function appendTenantMessage_(
  record
) {
  const sheet =
    ensureTenantMessageSheet_();

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
        record[header] !==
        undefined
          ? record[header]
          : ''
      );
    });

  sheet.appendRow(row);
}


/**
 * 確保 V2_tenant_messages 存在且欄位完整
 */
function ensureTenantMessageSheet_() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(
      V2_TENANT_MESSAGE_SHEETS_
        .tenantMessages
    );

  const requiredHeaders = [
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
    sheet =
      ss.insertSheet(
        V2_TENANT_MESSAGE_SHEETS_
          .tenantMessages
      );

    sheet.appendRow(
      requiredHeaders
    );

    return sheet;
  }

  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  const currentHeaders =
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

    return sheet;
  }

  requiredHeaders.forEach(
    function (header) {
      if (
        currentHeaders.indexOf(
          header
        ) === -1
      ) {
        const newColumn =
          sheet.getLastColumn() +
          1;

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

  return sheet;
}


/**
 * 建立房客訊息通知文字
 */
function buildTenantMessageNoticeText_(
  record
) {
  const categoryMap = {
    general:
      '一般詢問',
    repair:
      '報修',
    payment:
      '繳費問題',
    contract:
      '合約問題',
    other:
      '其他'
  };

  const categoryText =
    categoryMap[
      record.message_category
    ] ||
    record.message_category ||
    '-';

  const priorityText =
    record.priority ===
    'urgent'
      ? '急件'
      : '一般';

  const lines = [
    '【CMWebs 房客訊息】',
    '',
    '房客：' +
      (
        record.tenant_name ||
        '-'
      ),
    '房號：' +
      (
        record.room_name ||
        '-'
      ),
    '類型：' +
      categoryText,
    '優先程度：' +
      priorityText,
    '',
    '標題：' +
      (
        record.message_title ||
        '-'
      ),
    '',
    record.message_body ||
      '-'
  ];

  if (
    record.preferred_contact_time
  ) {
    lines.push('');
    lines.push(
      '方便聯絡時間：' +
      record
        .preferred_contact_time
    );
  }

  return lines.join('\n');
}


/**
 * 建立房客訊息 ID
 */
function tenantMessageMakeId_() {
  const now =
    new Date();

  return (
    'TM-' +
    Utilities.formatDate(
      now,
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


/**
 * 測試建立工作表
 */
function testEnsureV2TenantMessagesSheet() {
  const sheet =
    ensureTenantMessageSheet_();

  Logger.log(
    'Tenant message sheet ready: ' +
    sheet.getName()
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
 * 測試房客訊息初始化
 */
function testTenantMessageInit() {
  const result =
    getTenantMessageInitByLineUid(
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
