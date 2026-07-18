/**
 * CMWebs V2 公告發送與送達管理
 *
 * API：
 * - landlord_announcements_init
 * - landlord_announcement_send
 * - landlord_announcement_retry
 *
 * 功能：
 * - 向目前 Workspace 的全部、指定物件或指定房客發送 LINE 公告。
 * - 自動辨識房客 LINE 綁定，阻擋衝突帳號。
 * - 保存公告主檔、逐房客送達結果與 LINE 訊息紀錄。
 * - 支援重試失敗及原先未綁定、後來完成綁定的房客。
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 * - V2_WORKSPACE_LANDLORD_ACCESS.gs
 * - V2_WORKSPACE_OPERATION_AUDIT.gs（選用）
 */

const V2_ANNOUNCEMENT_SHEETS_ = {
  announcements:
    'V2_announcements',
  recipients:
    'V2_announcement_recipients',
  properties:
    'V2_properties',
  rooms:
    'V2_rooms',
  contracts:
    'V2_contracts',
  tenants:
    'V2_tenants',
  users:
    'V2_users',
  landlordTenantListView:
    'V2_landlord_tenant_list_view',
  tenantHomeView:
    'V2_tenant_home_view',
  tenantBillView:
    'V2_tenant_bill_view',
  bills:
    'V2_bills',
  lineMessageLogs:
    'V2_line_message_logs'
};

const V2_ANNOUNCEMENT_TENANT_LIFF_URL_ =
  'https://liff.line.me/2010314940-iJB1D6sN';

/*
 * Google Sheets 單一檔案有總儲存格上限。
 * 建立公告資料表前，先釋放各工作表尾端未使用的空白列／欄。
 */
const V2_ANNOUNCEMENT_CELL_CAPACITY_ = {
  workbook_limit:
    10000000,

  /*
   * 新增工作表時預留較寬鬆空間。
   * 建立完成後會立即縮小新工作表。
   */
  reserve_per_new_sheet:
    60000,

  minimum_free_cells:
    20000,

  /*
   * 整理既有工作表時保留的成長空間。
   */
  row_buffer:
    50,

  column_buffer:
    2,

  minimum_rows:
    100,

  minimum_columns:
    10
};


/**
 * 公告頁初始化。
 */
function getLandlordAnnouncementsInitByLineUid_(
  lineUserId,
  historyFilter
) {
  try {
    announcementEnsureSchema_();

    const access =
      workspaceLandlordResolveAccess_(
        lineUserId,
        {
          require_onboarding:
            true
        }
      );

    if (!access.success) {
      return access;
    }

    historyFilter =
      announcementNormalizeHistoryFilter_(
        historyFilter
      );

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const data =
      announcementLoadWorkspaceData_(
        ss,
        access
      );

    const recipients =
      announcementBuildAudienceRecipients_(
        data
      );

    const recipientRows =
      announcementGetWorkspaceRows_(
        ss.getSheetByName(
          V2_ANNOUNCEMENT_SHEETS_
            .recipients
        ),
        access
      );

    let announcements =
      announcementGetWorkspaceRows_(
        ss.getSheetByName(
          V2_ANNOUNCEMENT_SHEETS_
            .announcements
        ),
        access
      )
        .map(
          function (announcement) {
            return announcementBuildHistoryItem_(
              announcement,
              recipientRows
            );
          }
        );

    if (
      historyFilter !==
      'all'
    ) {
      announcements =
        announcements.filter(
          function (item) {
            return (
              item.status ===
              historyFilter
            );
          }
        );
    }

    announcements.sort(
      function (a, b) {
        return (
          announcementTime_(
            b.created_at
          ) -
          announcementTime_(
            a.created_at
          )
        );
      }
    );

    const summary = {
      announcement_count:
        announcements.length,

      sent_count:
        announcements.filter(
          function (item) {
            return (
              item.status ===
              'sent'
            );
          }
        ).length,

      partial_count:
        announcements.filter(
          function (item) {
            return (
              item.status ===
              'partial'
            );
          }
        ).length,

      failed_count:
        announcements.filter(
          function (item) {
            return (
              item.status ===
              'failed'
            );
          }
        ).length,

      delivered_recipient_count:
        announcements.reduce(
          function (total, item) {
            return (
              total +
              announcementNumber_(
                item.sent_count
              )
            );
          },
          0
        )
    };

    return workspaceResult_(
      true,
      'OK',
      '公告資料載入成功',
      {
        workspace:
          typeof workspaceBuildWorkspaceView_ ===
            'function'
            ? workspaceBuildWorkspaceView_(
                access.workspace
              )
            : access.workspace,

        current_user:
          typeof workspaceBuildUserView_ ===
            'function'
            ? workspaceBuildUserView_(
                access.user
              )
            : access.user,

        current_membership:
          typeof workspaceBuildMembershipView_ ===
            'function'
            ? workspaceBuildMembershipView_(
                access.membership
              )
            : access.membership,

        can_send:
          announcementCanSend_(
            access
          ),

        tenant_liff_url:
          V2_ANNOUNCEMENT_TENANT_LIFF_URL_,

        history_filter:
          historyFilter,

        properties:
          data.properties
            .map(
              function (property) {
                return {
                  property_id:
                    announcementText_(
                      property.property_id
                    ),
                  property_name:
                    announcementText_(
                      property.property_name
                    )
                };
              }
            )
            .filter(
              function (property) {
                return Boolean(
                  property.property_id
                );
              }
            )
            .sort(
              function (a, b) {
                return announcementCompareText_(
                  a.property_name,
                  b.property_name
                );
              }
            ),

        audience_summary: {
          total_count:
            recipients.length,

          bound_count:
            recipients.filter(
              function (recipient) {
                return (
                  recipient.binding_status ===
                  'bound'
                );
              }
            ).length,

          unbound_count:
            recipients.filter(
              function (recipient) {
                return (
                  recipient.binding_status ===
                  'unbound'
                );
              }
            ).length,

          conflict_count:
            recipients.filter(
              function (recipient) {
                return (
                  recipient.binding_status ===
                  'conflict'
                );
              }
            ).length
        },

        recipients:
          recipients,

        summary:
          summary,

        announcements:
          announcements
      }
    );

  } catch (error) {
    return workspaceResult_(
      false,
      'ANNOUNCEMENTS_INIT_ERROR',
      '公告資料載入失敗：' +
        error.message
    );
  }
}


/**
 * 發送新公告。
 */
function sendLandlordAnnouncementByLineUid_(
  lineUserId,
  title,
  body,
  category,
  priority,
  audienceType,
  propertyId,
  tenantIdsJson
) {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    announcementEnsureSchema_();

    const access =
      workspaceLandlordResolveAccess_(
        lineUserId,
        {
          require_onboarding:
            true
        }
      );

    if (!access.success) {
      return access;
    }

    const permission =
      announcementRequireSend_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    title =
      announcementText_(
        title
      );

    body =
      announcementText_(
        body
      );

    category =
      announcementNormalizeCategory_(
        category
      );

    priority =
      announcementNormalizePriority_(
        priority
      );

    audienceType =
      announcementNormalizeAudienceType_(
        audienceType
      );

    propertyId =
      announcementText_(
        propertyId
      );

    const selectedTenantIds =
      announcementParseTenantIds_(
        tenantIdsJson
      );

    if (
      title.length < 2 ||
      title.length > 80
    ) {
      return workspaceResult_(
        false,
        'INVALID_ANNOUNCEMENT_TITLE',
        '公告標題需為 2 至 80 個字'
      );
    }

    if (
      body.length < 2 ||
      body.length > 1200
    ) {
      return workspaceResult_(
        false,
        'INVALID_ANNOUNCEMENT_BODY',
        '公告內容需為 2 至 1200 個字'
      );
    }

    if (
      audienceType ===
        'property' &&
      !propertyId
    ) {
      return workspaceResult_(
        false,
        'PROPERTY_REQUIRED',
        '請選擇公告物件'
      );
    }

    if (
      audienceType ===
        'selected' &&
      selectedTenantIds.length ===
        0
    ) {
      return workspaceResult_(
        false,
        'TENANT_SELECTION_REQUIRED',
        '請至少選擇一位房客'
      );
    }

    lock.waitLock(
      25000
    );

    locked =
      true;

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const data =
      announcementLoadWorkspaceData_(
        ss,
        access
      );

    const allRecipients =
      announcementBuildAudienceRecipients_(
        data
      );

    const targetRecipients =
      announcementFilterRecipients_(
        allRecipients,
        audienceType,
        propertyId,
        selectedTenantIds
      );

    if (
      targetRecipients.length ===
      0
    ) {
      return workspaceResult_(
        false,
        'NO_ANNOUNCEMENT_RECIPIENTS',
        '目前條件沒有可選擇的有效租約房客'
      );
    }

    const token =
      PropertiesService
        .getScriptProperties()
        .getProperty(
          'LINE_CHANNEL_ACCESS_TOKEN'
        );

    if (!token) {
      return workspaceResult_(
        false,
        'LINE_TOKEN_NOT_SET',
        '尚未設定 LINE_CHANNEL_ACCESS_TOKEN'
      );
    }

    const now =
      new Date();

    const announcementId =
      announcementGenerateId_(
        'ANN'
      );

    const property =
      data.properties.find(
        function (row) {
          return (
            announcementText_(
              row.property_id
            ) ===
            propertyId
          );
        }
      ) ||
      {};

    const announcementSheet =
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .announcements
      );

    const recipientSheet =
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .recipients
      );

    const actor = {
      user_id:
        access.user.user_id ||
        '',
      membership_id:
        access.membership
          .membership_id ||
        ''
    };

    const mainRow = {
      announcement_id:
        announcementId,

      workspace_id:
        announcementText_(
          access.workspace
            .workspace_id
        ).toUpperCase(),

      landlord_id:
        announcementText_(
          access.principal_landlord_id
        ),

      title:
        title,

      body:
        body,

      category:
        category,

      priority:
        priority,

      audience_type:
        audienceType,

      audience_property_id:
        audienceType ===
          'property'
          ? propertyId
          : '',

      audience_property_name:
        audienceType ===
          'property'
          ? announcementText_(
              property.property_name
            )
          : '',

      audience_tenant_ids:
        audienceType ===
          'selected'
          ? JSON.stringify(
              selectedTenantIds
            )
          : '[]',

      target_count:
        targetRecipients.length,

      bound_count:
        targetRecipients.filter(
          function (recipient) {
            return (
              recipient.binding_status ===
              'bound'
            );
          }
        ).length,

      unbound_count:
        targetRecipients.filter(
          function (recipient) {
            return (
              recipient.binding_status ===
              'unbound'
            );
          }
        ).length,

      conflict_count:
        targetRecipients.filter(
          function (recipient) {
            return (
              recipient.binding_status ===
              'conflict'
            );
          }
        ).length,

      sent_count:
        0,

      failed_count:
        0,

      status:
        'sending',

      created_by_user_id:
        actor.user_id,

      created_by_membership_id:
        actor.membership_id,

      created_at:
        now,

      sent_at:
        '',

      updated_at:
        now
    };

    announcementAppendObject_(
      announcementSheet,
      mainRow
    );

    const prepared = [];
    const recipientRecords = [];

    targetRecipients.forEach(
      function (recipient) {
        const message =
          announcementBuildMessage_(
            title,
            body,
            category,
            priority,
            recipient
          );

        const record = {
          announcement_recipient_id:
            announcementGenerateId_(
              'ANR'
            ),

          announcement_id:
            announcementId,

          workspace_id:
            mainRow.workspace_id,

          tenant_id:
            recipient.tenant_id,

          tenant_user_id:
            recipient.tenant_user_id,

          tenant_name:
            recipient.tenant_name,

          tenant_phone:
            recipient.tenant_phone,

          tenant_line_user_id:
            recipient.tenant_line_user_id,

          binding_status:
            recipient.binding_status,

          property_id:
            recipient.property_id,

          property_name:
            recipient.property_name,

          room_list:
            recipient.room_list,

          send_status:
            recipient.binding_status ===
              'bound'
              ? 'queued'
              : recipient.binding_status,

          sent_at:
            '',

          last_attempt_at:
            '',

          send_count:
            0,

          last_error:
            recipient.binding_status ===
              'unbound'
              ? '房客尚未完成 LINE 綁定'
              : (
                  recipient.binding_status ===
                    'conflict'
                    ? '房客存在多個 LINE UID'
                    : ''
                ),

          message_text:
            message,

          created_at:
            now,

          updated_at:
            now
        };

        recipientRecords.push(
          record
        );

        if (
          recipient.binding_status ===
          'bound'
        ) {
          prepared.push({
            recipient:
              recipient,
            record:
              record,
            message:
              message,

            request: {
              url:
                'https://api.line.me/v2/bot/message/push',

              method:
                'post',

              contentType:
                'application/json',

              headers: {
                Authorization:
                  'Bearer ' +
                  token
              },

              payload:
                JSON.stringify({
                  to:
                    recipient
                      .tenant_line_user_id,

                  messages: [
                    {
                      type:
                        'text',
                      text:
                        message
                    }
                  ]
                }),

              muteHttpExceptions:
                true
            }
          });
        }
      }
    );

    const responsesByRecipientId = {};

    announcementChunk_(
      prepared,
      50
    ).forEach(
      function (chunk) {
        const responses =
          UrlFetchApp.fetchAll(
            chunk.map(
              function (entry) {
                return entry.request;
              }
            )
          );

        responses.forEach(
          function (response, index) {
            const entry =
              chunk[
                index
              ];

            const code =
              response.getResponseCode();

            const responseText =
              response.getContentText();

            responsesByRecipientId[
              entry.record
                .announcement_recipient_id
            ] = {
              success:
                code >= 200 &&
                code < 300,

              status_code:
                code,

              response_text:
                responseText
            };
          }
        );
      }
    );

    let sentCount = 0;
    let failedCount = 0;
    let unboundCount = 0;
    let conflictCount = 0;

    const logRows = [];

    recipientRecords.forEach(
      function (record) {
        const response =
          responsesByRecipientId[
            record
              .announcement_recipient_id
          ];

        if (response) {
          record.last_attempt_at =
            now;

          if (
            response.success
          ) {
            record.send_status =
              'sent';

            record.sent_at =
              now;

            record.send_count =
              1;

            record.last_error =
              '';

            sentCount +=
              1;

          } else {
            record.send_status =
              'failed';

            record.last_error =
              'HTTP ' +
              response.status_code +
              ' / ' +
              response.response_text;

            failedCount +=
              1;
          }

          logRows.push(
            announcementBuildLineLog_(
              access,
              record,
              response.success
                ? 'success'
                : 'failed',

              response.success
                ? 'HTTP ' +
                  response.status_code
                : record.last_error
            )
          );

        } else if (
          record.send_status ===
          'unbound'
        ) {
          unboundCount +=
            1;

          logRows.push(
            announcementBuildLineLog_(
              access,
              record,
              'blocked',
              record.last_error
            )
          );

        } else if (
          record.send_status ===
          'conflict'
        ) {
          conflictCount +=
            1;

          logRows.push(
            announcementBuildLineLog_(
              access,
              record,
              'blocked',
              record.last_error
            )
          );
        }

        record.updated_at =
          now;

        announcementAppendObject_(
          recipientSheet,
          record
        );
      }
    );

    const finalStatus =
      announcementResolveOverallStatus_(
        targetRecipients.length,
        sentCount,
        failedCount,
        unboundCount,
        conflictCount
      );

    mainRow.sent_count =
      sentCount;

    mainRow.failed_count =
      failedCount;

    mainRow.unbound_count =
      unboundCount;

    mainRow.conflict_count =
      conflictCount;

    mainRow.status =
      finalStatus;

    mainRow.sent_at =
      sentCount > 0
        ? now
        : '';

    mainRow.updated_at =
      now;

    const createdMain =
      workspaceGetObjectsWithRow_(
        announcementSheet
      ).find(
        function (row) {
          return (
            announcementText_(
              row.announcement_id
            ) ===
            announcementId
          );
        }
      );

    if (createdMain) {
      announcementSetRowValues_(
        announcementSheet,
        createdMain.__row_number,
        mainRow
      );
    }

    announcementAppendLineLogs_(
      ss,
      logRows
    );

    SpreadsheetApp.flush();

    const success =
      sentCount > 0 &&
      failedCount === 0;

    const result =
      workspaceResult_(
        success,
        finalStatus ===
          'sent'
          ? 'ANNOUNCEMENT_SENT'
          : (
              sentCount > 0
                ? 'ANNOUNCEMENT_PARTIAL'
                : 'ANNOUNCEMENT_NOT_DELIVERED'
            ),

        finalStatus ===
          'sent'
          ? '公告已發送'
          : (
              sentCount > 0
                ? '公告已部分送達'
                : '公告尚未送達任何房客'
            ),

        {
          announcement_id:
            announcementId,

          status:
            finalStatus,

          target_count:
            targetRecipients.length,

          sent_count:
            sentCount,

          failed_count:
            failedCount,

          unbound_count:
            unboundCount,

          conflict_count:
            conflictCount
        }
      );

    announcementAudit_(
      access,
      'landlord_announcement_send',
      result,
      {
        target_type:
          'announcement',

        target_id:
          announcementId,

        operation_status:
          finalStatus,

        detail:
          'target=' +
          targetRecipients.length +
          ', sent=' +
          sentCount +
          ', failed=' +
          failedCount +
          ', unbound=' +
          unboundCount +
          ', conflict=' +
          conflictCount
      }
    );

    if (
      typeof workspaceNotifyTeam_ ===
      'function'
    ) {
      try {
        const bodyLines = [
          '公告標題：' +
            (
              mainRow.title ||
              mainRow.announcement_title ||
              '-'
            ),
          '目標房客：' +
            targetRecipients.length +
            ' 位',
          '成功送達：' +
            sentCount +
            ' 位',
          '發送失敗：' +
            failedCount +
            ' 位',
          '尚未綁定：' +
            unboundCount +
            ' 位',
          '綁定衝突：' +
            conflictCount +
            ' 位'
        ];

        const notification =
          workspaceNotifyTeam_({
            workspace_id:
              announcementText_(
                access.workspace &&
                access.workspace
                  .workspace_id
              ),

            landlord_id:
              announcementText_(
                access.principal_landlord_id
              ),

            event_type:
              'announcement_result',

            title:
              finalStatus ===
                'sent'
                ? '公告已全部送達'
                : (
                    sentCount >
                      0
                      ? '公告已部分送達'
                      : '公告發送未成功'
                  ),

            body:
              bodyLines.join(
                '\n'
              ),

            target_type:
              'announcement',

            target_id:
              announcementId,

            action_url:
              'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-announcements.html',

            severity:
              (
                failedCount >
                  0 ||
                unboundCount >
                  0 ||
                conflictCount >
                  0
              )
                ? 'warning'
                : 'info',

            source:
              'landlord_announcement_send',

            created_by_user_id:
              announcementText_(
                access.user &&
                access.user
                  .user_id
              ),

            metadata: {
              announcement_id:
                announcementId,

              target_count:
                targetRecipients.length,

              sent_count:
                sentCount,

              failed_count:
                failedCount,

              unbound_count:
                unboundCount,

              conflict_count:
                conflictCount
            }
          });

        result.data.team_notification =
          notification &&
          notification.data
            ? notification.data
            : notification;

      } catch (notificationError) {
        result.data.team_notification = {
          success:
            false,

          code:
            'ANNOUNCEMENT_TEAM_NOTIFICATION_ERROR',

          message:
            notificationError.message
        };
      }
    }

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'ANNOUNCEMENT_SEND_ERROR',
      '公告發送失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * 重試先前失敗、未綁定或衝突的公告收件人。
 */
function retryLandlordAnnouncementByLineUid_(
  lineUserId,
  announcementId
) {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    announcementEnsureSchema_();

    const access =
      workspaceLandlordResolveAccess_(
        lineUserId,
        {
          require_onboarding:
            true
        }
      );

    if (!access.success) {
      return access;
    }

    const permission =
      announcementRequireSend_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    announcementId =
      announcementText_(
        announcementId
      );

    if (!announcementId) {
      return workspaceResult_(
        false,
        'ANNOUNCEMENT_ID_REQUIRED',
        '缺少公告編號'
      );
    }

    lock.waitLock(
      25000
    );

    locked =
      true;

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const announcementSheet =
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .announcements
      );

    const recipientSheet =
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .recipients
      );

    const announcement =
      announcementGetWorkspaceRows_(
        announcementSheet,
        access
      ).find(
        function (row) {
          return (
            announcementText_(
              row.announcement_id
            ) ===
            announcementId
          );
        }
      );

    if (!announcement) {
      return workspaceResult_(
        false,
        'ANNOUNCEMENT_NOT_FOUND',
        '找不到公告或目前團隊無權限存取'
      );
    }

    const recipientRows =
      announcementGetWorkspaceRows_(
        recipientSheet,
        access
      ).filter(
        function (row) {
          return (
            announcementText_(
              row.announcement_id
            ) ===
            announcementId
          );
        }
      );

    const retryRows =
      recipientRows.filter(
        function (row) {
          return [
            'failed',
            'unbound',
            'conflict'
          ].indexOf(
            announcementText_(
              row.send_status
            ).toLowerCase()
          ) >= 0;
        }
      );

    if (
      retryRows.length ===
      0
    ) {
      return workspaceResult_(
        false,
        'NO_RETRY_RECIPIENTS',
        '此公告目前沒有需要重試的房客'
      );
    }

    const data =
      announcementLoadWorkspaceData_(
        ss,
        access
      );

    const currentRecipients =
      announcementBuildAudienceRecipients_(
        data
      );

    const currentMap = {};

    currentRecipients.forEach(
      function (recipient) {
        currentMap[
          recipient.tenant_id
        ] =
          recipient;
      }
    );

    const token =
      PropertiesService
        .getScriptProperties()
        .getProperty(
          'LINE_CHANNEL_ACCESS_TOKEN'
        );

    if (!token) {
      return workspaceResult_(
        false,
        'LINE_TOKEN_NOT_SET',
        '尚未設定 LINE_CHANNEL_ACCESS_TOKEN'
      );
    }

    const now =
      new Date();

    const prepared = [];
    let stillBlocked = 0;

    retryRows.forEach(
      function (row) {
        const current =
          currentMap[
            announcementText_(
              row.tenant_id
            ).toUpperCase()
          ] ||
          null;

        if (
          !current ||
          current.binding_status !==
            'bound'
        ) {
          const bindingStatus =
            current
              ? current.binding_status
              : 'unbound';

          announcementSetRowValues_(
            recipientSheet,
            row.__row_number,
            {
              tenant_line_user_id:
                current
                  ? current.tenant_line_user_id
                  : '',

              binding_status:
                bindingStatus,

              send_status:
                bindingStatus,

              last_attempt_at:
                now,

              last_error:
                bindingStatus ===
                  'conflict'
                  ? '房客存在多個 LINE UID'
                  : '房客尚未完成 LINE 綁定',

              updated_at:
                now
            }
          );

          stillBlocked +=
            1;

          return;
        }

        const message =
          announcementBuildMessage_(
            announcement.title,
            announcement.body,
            announcement.category,
            announcement.priority,
            current
          );

        prepared.push({
          row:
            row,

          current:
            current,

          message:
            message,

          request: {
            url:
              'https://api.line.me/v2/bot/message/push',

            method:
              'post',

            contentType:
              'application/json',

            headers: {
              Authorization:
                'Bearer ' +
                token
            },

            payload:
              JSON.stringify({
                to:
                  current
                    .tenant_line_user_id,

                messages: [
                  {
                    type:
                      'text',
                    text:
                      message
                  }
                ]
              }),

            muteHttpExceptions:
              true
          }
        });
      }
    );

    let sentNow = 0;
    let failedNow = 0;
    const logRows = [];

    announcementChunk_(
      prepared,
      50
    ).forEach(
      function (chunk) {
        const responses =
          UrlFetchApp.fetchAll(
            chunk.map(
              function (entry) {
                return entry.request;
              }
            )
          );

        responses.forEach(
          function (response, index) {
            const entry =
              chunk[
                index
              ];

            const row =
              entry.row;

            const current =
              entry.current;

            const code =
              response.getResponseCode();

            const responseText =
              response.getContentText();

            const success =
              code >= 200 &&
              code < 300;

            const sendCount =
              Math.max(
                0,
                Math.round(
                  announcementNumber_(
                    row.send_count
                  )
                )
              ) +
              (
                success
                  ? 1
                  : 0
              );

            const values = {
              tenant_line_user_id:
                current
                  .tenant_line_user_id,

              binding_status:
                'bound',

              send_status:
                success
                  ? 'sent'
                  : 'failed',

              sent_at:
                success
                  ? now
                  : row.sent_at,

              last_attempt_at:
                now,

              send_count:
                sendCount,

              last_error:
                success
                  ? ''
                  : (
                      'HTTP ' +
                      code +
                      ' / ' +
                      responseText
                    ),

              message_text:
                entry.message,

              updated_at:
                now
            };

            announcementSetRowValues_(
              recipientSheet,
              row.__row_number,
              values
            );

            if (success) {
              sentNow +=
                1;
            } else {
              failedNow +=
                1;
            }

            logRows.push(
              announcementBuildLineLog_(
                access,
                Object.assign(
                  {},
                  row,
                  current,
                  values,
                  {
                    announcement_id:
                      announcementId,
                    message_text:
                      entry.message
                  }
                ),

                success
                  ? 'success'
                  : 'failed',

                success
                  ? 'HTTP ' +
                    code
                  : values.last_error
              )
            );
          }
        );
      }
    );

    announcementAppendLineLogs_(
      ss,
      logRows
    );

    SpreadsheetApp.flush();

    const refreshedRows =
      announcementGetWorkspaceRows_(
        recipientSheet,
        access
      ).filter(
        function (row) {
          return (
            announcementText_(
              row.announcement_id
            ) ===
            announcementId
          );
        }
      );

    const stats =
      announcementRecipientStats_(
        refreshedRows
      );

    const finalStatus =
      announcementResolveOverallStatus_(
        stats.target_count,
        stats.sent_count,
        stats.failed_count,
        stats.unbound_count,
        stats.conflict_count
      );

    announcementSetRowValues_(
      announcementSheet,
      announcement.__row_number,
      {
        bound_count:
          stats.bound_count,

        unbound_count:
          stats.unbound_count,

        conflict_count:
          stats.conflict_count,

        sent_count:
          stats.sent_count,

        failed_count:
          stats.failed_count,

        status:
          finalStatus,

        sent_at:
          stats.sent_count > 0
            ? (
                announcement.sent_at ||
                now
              )
            : '',

        updated_at:
          now
      }
    );

    SpreadsheetApp.flush();

    const result =
      workspaceResult_(
        sentNow > 0 &&
        failedNow === 0,

        sentNow > 0
          ? (
              finalStatus ===
                'sent'
                ? 'ANNOUNCEMENT_RETRY_SENT'
                : 'ANNOUNCEMENT_RETRY_PARTIAL'
            )
          : 'ANNOUNCEMENT_RETRY_NOT_DELIVERED',

        sentNow > 0
          ? (
              finalStatus ===
                'sent'
                ? '公告重試已全部送達'
                : '公告重試已部分送達'
            )
          : '本次重試尚未送達任何房客',

        {
          announcement_id:
            announcementId,

          status:
            finalStatus,

          retried_count:
            prepared.length,

          sent_now:
            sentNow,

          failed_now:
            failedNow,

          still_blocked_count:
            stillBlocked,

          totals:
            stats
        }
      );

    announcementAudit_(
      access,
      'landlord_announcement_retry',
      result,
      {
        target_type:
          'announcement',

        target_id:
          announcementId,

        operation_status:
          finalStatus,

        detail:
          'sent_now=' +
          sentNow +
          ', failed_now=' +
          failedNow +
          ', blocked=' +
          stillBlocked
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'ANNOUNCEMENT_RETRY_ERROR',
      '公告重試失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


// ==================================================
// Workspace data and audience
// ==================================================

function announcementLoadWorkspaceData_(
  ss,
  access
) {
  const properties =
    announcementGetWorkspaceRows_(
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .properties
      ),
      access
    ).filter(
      function (property) {
        return (
          announcementText_(
            property.account_status ||
            property.property_status ||
            'active'
          ).toLowerCase() !==
          'archived'
        );
      }
    );

  const propertyIdMap = {};

  properties.forEach(
    function (property) {
      const propertyId =
        announcementText_(
          property.property_id
        );

      if (propertyId) {
        propertyIdMap[
          propertyId
        ] = true;
      }
    }
  );

  const rooms =
    announcementGetWorkspaceRows_(
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .rooms
      ),
      access,
      propertyIdMap
    );

  const contracts =
    announcementGetWorkspaceRows_(
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .contracts
      ),
      access,
      propertyIdMap
    ).filter(
      announcementContractIsCurrent_
    );

  const tenantIdMap = {};
  const userIdMap = {};

  contracts.forEach(
    function (contract) {
      const tenantId =
        announcementText_(
          contract.tenant_id
        ).toUpperCase();

      const userId =
        announcementText_(
          contract.tenant_user_id
        );

      if (tenantId) {
        tenantIdMap[
          tenantId
        ] = true;
      }

      if (userId) {
        userIdMap[
          userId
        ] = true;
      }
    }
  );

  const tenantSheet =
    ss.getSheetByName(
      V2_ANNOUNCEMENT_SHEETS_
        .tenants
    );

  const tenants =
    tenantSheet
      ? workspaceGetObjectsWithRow_(
          tenantSheet
        ).filter(
          function (tenant) {
            const tenantId =
              announcementText_(
                tenant.tenant_id
              ).toUpperCase();

            return Boolean(
              tenantIdMap[
                tenantId
              ]
            );
          }
        )
      : [];

  tenants.forEach(
    function (tenant) {
      const userId =
        announcementText_(
          tenant.tenant_user_id ||
          tenant.user_id
        );

      if (userId) {
        userIdMap[
          userId
        ] = true;
      }
    }
  );

  const userSheet =
    ss.getSheetByName(
      V2_ANNOUNCEMENT_SHEETS_
        .users
    );

  const users =
    userSheet
      ? workspaceGetObjectsWithRow_(
          userSheet
        ).filter(
          function (user) {
            return Boolean(
              userIdMap[
                announcementText_(
                  user.user_id
                )
              ]
            );
          }
        )
      : [];

  const tenantListRows =
    announcementGetWorkspaceRows_(
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .landlordTenantListView
      ),
      access,
      propertyIdMap
    );

  const tenantHomeRows =
    announcementGetWorkspaceRows_(
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .tenantHomeView
      ),
      access,
      propertyIdMap
    );

  const tenantBillRows =
    announcementGetWorkspaceRows_(
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .tenantBillView
      ),
      access,
      propertyIdMap
    );

  const bills =
    announcementGetWorkspaceRows_(
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .bills
      ),
      access,
      propertyIdMap
    );

  return {
    properties:
      properties,
    rooms:
      rooms,
    contracts:
      contracts,
    tenants:
      tenants,
    users:
      users,
    tenant_list_rows:
      tenantListRows,
    tenant_home_rows:
      tenantHomeRows,
    tenant_bill_rows:
      tenantBillRows,
    bills:
      bills
  };
}


function announcementBuildAudienceRecipients_(
  data
) {
  const propertyMap = {};
  const roomMap = {};
  const tenantMap = {};
  const userMap = {};
  const grouped = {};

  data.properties.forEach(
    function (property) {
      propertyMap[
        announcementText_(
          property.property_id
        )
      ] =
        property;
    }
  );

  data.rooms.forEach(
    function (room) {
      roomMap[
        announcementText_(
          room.room_id
        )
      ] =
        room;
    }
  );

  data.tenants.forEach(
    function (tenant) {
      tenantMap[
        announcementText_(
          tenant.tenant_id
        ).toUpperCase()
      ] =
        tenant;
    }
  );

  data.users.forEach(
    function (user) {
      userMap[
        announcementText_(
          user.user_id
        )
      ] =
        user;
    }
  );

  data.contracts.forEach(
    function (contract) {
      const tenantId =
        announcementText_(
          contract.tenant_id
        ).toUpperCase();

      if (!tenantId) {
        return;
      }

      const room =
        roomMap[
          announcementText_(
            contract.room_id
          )
        ] ||
        {};

      const propertyId =
        announcementText_(
          contract.property_id ||
          room.property_id
        );

      const property =
        propertyMap[
          propertyId
        ] ||
        {};

      if (!grouped[tenantId]) {
        const tenant =
          tenantMap[
            tenantId
          ] ||
          {};

        const tenantUserId =
          announcementText_(
            contract.tenant_user_id ||
            tenant.tenant_user_id ||
            tenant.user_id
          );

        const user =
          userMap[
            tenantUserId
          ] ||
          {};

        grouped[tenantId] = {
          tenant_id:
            tenantId,

          tenant_user_id:
            tenantUserId,

          tenant_name:
            announcementText_(
              contract.tenant_name ||
              tenant.tenant_name ||
              tenant.name ||
              user.name ||
              '房客'
            ),

          tenant_phone:
            announcementText_(
              contract.tenant_phone ||
              tenant.tenant_phone ||
              tenant.phone ||
              user.phone
            ),

          tenant_email:
            announcementText_(
              contract.tenant_email ||
              tenant.tenant_email ||
              tenant.email ||
              user.email
            ),

          contracts:
            [],

          property_ids:
            [],

          property_names:
            [],

          room_names:
            [],

          direct_line_values: [
            {
              value:
                contract
                  .tenant_line_user_id,
              source:
                'V2_contracts'
            },
            {
              value:
                tenant
                  .tenant_line_user_id ||
                tenant.line_user_id,
              source:
                'V2_tenants'
            },
            {
              value:
                user.line_user_id ||
                user
                  .tenant_line_user_id,
              source:
                'V2_users'
            }
          ]
        };
      }

      const group =
        grouped[
          tenantId
        ];

      group.contracts.push(
        contract
      );

      announcementPushUnique_(
        group.property_ids,
        propertyId
      );

      announcementPushUnique_(
        group.property_names,
        announcementText_(
          contract.property_name ||
          property.property_name ||
          room.property_name
        )
      );

      announcementPushUnique_(
        group.room_names,
        announcementText_(
          contract.room_name ||
          room.room_name
        )
      );

      group.direct_line_values.push({
        value:
          contract
            .tenant_line_user_id,
        source:
          'V2_contracts'
      });
    }
  );

  return Object.keys(
    grouped
  ).map(
    function (tenantId) {
      const group =
        grouped[
          tenantId
        ];

      const binding =
        announcementResolveLineBinding_(
          data,
          group
        );

      return {
        tenant_id:
          group.tenant_id,

        tenant_user_id:
          group.tenant_user_id,

        tenant_name:
          group.tenant_name,

        tenant_phone:
          group.tenant_phone,

        tenant_email:
          group.tenant_email,

        tenant_line_user_id:
          binding.line_user_id,

        binding_status:
          binding.conflict
            ? 'conflict'
            : (
                binding.line_user_id
                  ? 'bound'
                  : 'unbound'
              ),

        binding_source:
          binding.source,

        binding_candidates:
          binding.candidates,

        property_ids:
          group.property_ids,

        property_names:
          group.property_names,

        property_id:
          group.property_ids[0] ||
          '',

        property_name:
          group.property_names.join(
            '、'
          ),

        room_list:
          group.room_names
            .slice()
            .sort(
              announcementCompareText_
            )
            .join(
              '、'
            )
      };
    }
  ).sort(
    function (a, b) {
      const propertyCompare =
        announcementCompareText_(
          a.property_name,
          b.property_name
        );

      if (
        propertyCompare !==
        0
      ) {
        return propertyCompare;
      }

      const roomCompare =
        announcementCompareText_(
          a.room_list,
          b.room_list
        );

      if (
        roomCompare !==
        0
      ) {
        return roomCompare;
      }

      return announcementCompareText_(
        a.tenant_name,
        b.tenant_name
      );
    }
  );
}


function announcementResolveLineBinding_(
  data,
  group
) {
  const candidates = [];

  function add(
    value,
    source
  ) {
    value =
      announcementText_(
        value
      );

    if (
      !announcementLooksLikeLineUid_(
        value
      )
    ) {
      return;
    }

    if (
      !candidates.some(
        function (entry) {
          return (
            entry.line_user_id ===
            value
          );
        }
      )
    ) {
      candidates.push({
        line_user_id:
          value,
        source:
          source
      });
    }
  }

  group.direct_line_values.forEach(
    function (entry) {
      add(
        entry.value,
        entry.source
      );
    }
  );

  const tenantId =
    group.tenant_id;

  const userId =
    group.tenant_user_id;

  data.tenant_list_rows.forEach(
    function (row) {
      if (
        announcementText_(
          row.tenant_id
        ).toUpperCase() ===
        tenantId
      ) {
        /*
         * 此 view 的 line_user_id 是房東登入鍵，
         * 僅使用 tenant_line_user_id。
         */
        add(
          row.tenant_line_user_id,
          'V2_landlord_tenant_list_view'
        );
      }
    }
  );

  data.tenant_home_rows.forEach(
    function (row) {
      if (
        announcementText_(
          row.tenant_id
        ).toUpperCase() ===
        tenantId
      ) {
        add(
          row.tenant_line_user_id ||
          row.line_user_id,
          'V2_tenant_home_view'
        );
      }
    }
  );

  data.tenant_bill_rows.forEach(
    function (row) {
      if (
        announcementText_(
          row.tenant_id
        ).toUpperCase() ===
        tenantId
      ) {
        add(
          row.tenant_line_user_id ||
          row.line_user_id,
          'V2_tenant_bill_view'
        );
      }
    }
  );

  data.bills.forEach(
    function (bill) {
      const matches =
        (
          announcementText_(
            bill.tenant_id
          ).toUpperCase() ===
          tenantId
        ) ||
        (
          userId &&
          announcementText_(
            bill.tenant_user_id
          ) ===
          userId
        );

      if (matches) {
        add(
          bill.tenant_line_user_id,
          'V2_bills'
        );
      }
    }
  );

  return {
    line_user_id:
      candidates.length > 0
        ? candidates[0]
            .line_user_id
        : '',

    source:
      candidates.length > 0
        ? candidates[0]
            .source
        : '',

    conflict:
      candidates.length > 1,

    candidates:
      candidates.map(
        function (entry) {
          return entry.line_user_id;
        }
      )
  };
}


function announcementFilterRecipients_(
  recipients,
  audienceType,
  propertyId,
  tenantIds
) {
  const tenantIdMap = {};

  tenantIds.forEach(
    function (tenantId) {
      tenantIdMap[
        tenantId
      ] = true;
    }
  );

  return recipients.filter(
    function (recipient) {
      if (
        audienceType ===
        'all'
      ) {
        return true;
      }

      if (
        audienceType ===
        'property'
      ) {
        return (
          recipient.property_ids
            .indexOf(
              propertyId
            ) >= 0
        );
      }

      return Boolean(
        tenantIdMap[
          recipient.tenant_id
        ]
      );
    }
  );
}


// ==================================================
// Announcement history and message
// ==================================================

function announcementBuildHistoryItem_(
  announcement,
  allRecipientRows
) {
  const announcementId =
    announcementText_(
      announcement.announcement_id
    );

  const recipients =
    allRecipientRows.filter(
      function (row) {
        return (
          announcementText_(
            row.announcement_id
          ) ===
          announcementId
        );
      }
    );

  const stats =
    announcementRecipientStats_(
      recipients
    );

  return {
    announcement_id:
      announcementId,

    title:
      announcementText_(
        announcement.title
      ),

    body:
      announcementText_(
        announcement.body
      ),

    category:
      announcementNormalizeCategory_(
        announcement.category
      ),

    category_label:
      announcementCategoryLabel_(
        announcement.category
      ),

    priority:
      announcementNormalizePriority_(
        announcement.priority
      ),

    priority_label:
      announcementPriorityLabel_(
        announcement.priority
      ),

    audience_type:
      announcementNormalizeAudienceType_(
        announcement.audience_type
      ),

    audience_label:
      announcementAudienceLabel_(
        announcement
      ),

    audience_property_id:
      announcementText_(
        announcement
          .audience_property_id
      ),

    audience_property_name:
      announcementText_(
        announcement
          .audience_property_name
      ),

    target_count:
      stats.target_count ||
      announcementNumber_(
        announcement.target_count
      ),

    bound_count:
      stats.bound_count,

    sent_count:
      stats.sent_count,

    failed_count:
      stats.failed_count,

    unbound_count:
      stats.unbound_count,

    conflict_count:
      stats.conflict_count,

    pending_retry_count:
      stats.failed_count +
      stats.unbound_count +
      stats.conflict_count,

    status:
      announcementText_(
        announcement.status
      ).toLowerCase() ||
      announcementResolveOverallStatus_(
        stats.target_count,
        stats.sent_count,
        stats.failed_count,
        stats.unbound_count,
        stats.conflict_count
      ),

    status_label:
      announcementStatusLabel_(
        announcement.status
      ),

    created_at:
      announcementFormatDateTime_(
        announcement.created_at
      ),

    sent_at:
      announcementFormatDateTime_(
        announcement.sent_at
      ),

    updated_at:
      announcementFormatDateTime_(
        announcement.updated_at
      ),

    recipients:
      recipients.map(
        function (row) {
          return {
            tenant_id:
              announcementText_(
                row.tenant_id
              ),

            tenant_name:
              announcementText_(
                row.tenant_name
              ),

            room_list:
              announcementText_(
                row.room_list
              ),

            binding_status:
              announcementText_(
                row.binding_status
              ),

            send_status:
              announcementText_(
                row.send_status
              ),

            send_count:
              announcementNumber_(
                row.send_count
              ),

            sent_at:
              announcementFormatDateTime_(
                row.sent_at
              ),

            last_error:
              announcementText_(
                row.last_error
              )
          };
        }
      )
  };
}


function announcementBuildMessage_(
  title,
  body,
  category,
  priority,
  recipient
) {
  const priorityPrefix =
    priority ===
      'urgent'
      ? '【重要】'
      : (
          priority ===
            'emergency'
            ? '【緊急】'
            : ''
        );

  const lines = [
    priorityPrefix +
      '【CMWebs ' +
      announcementCategoryLabel_(
        category
      ) +
      '】',
    '',
    recipient.tenant_name +
      ' 您好：',
    '',
    title,
    '',
    body,
    '',
    '適用房間：' +
      (
        recipient.property_name ||
        '-'
      ) +
      ' / ' +
      (
        recipient.room_list ||
        '-'
      ),
    '',
    '房客入口：',
    V2_ANNOUNCEMENT_TENANT_LIFF_URL_
  ];

  if (
    priority ===
      'emergency'
  ) {
    lines.push(
      '',
      '本訊息為緊急公告，請儘速確認。'
    );
  }

  return lines.join(
    '\n'
  );
}


function announcementBuildLineLog_(
  access,
  recipientRecord,
  status,
  note
) {
  return {
    created_at:
      new Date(),

    direction:
      'outgoing',

    source:
      'landlord_announcement',

    workspace_id:
      announcementText_(
        access.workspace
          .workspace_id
      ).toUpperCase(),

    landlord_line_user_id:
      announcementText_(
        access
          .principal_line_user_id ||
        access.line_user_id
      ),

    tenant_line_user_id:
      announcementText_(
        recipientRecord
          .tenant_line_user_id
      ),

    tenant_id:
      announcementText_(
        recipientRecord.tenant_id
      ),

    tenant_user_id:
      announcementText_(
        recipientRecord
          .tenant_user_id
      ),

    tenant_name:
      announcementText_(
        recipientRecord.tenant_name
      ),

    room_list:
      announcementText_(
        recipientRecord.room_list
      ),

    announcement_id:
      announcementText_(
        recipientRecord
          .announcement_id
      ),

    message_type:
      'announcement',

    message_text:
      announcementText_(
        recipientRecord.message_text
      ),

    status:
      status,

    note:
      note
  };
}


function announcementRecipientStats_(
  rows
) {
  const stats = {
    target_count:
      rows.length,

    bound_count:
      0,

    sent_count:
      0,

    failed_count:
      0,

    unbound_count:
      0,

    conflict_count:
      0
  };

  rows.forEach(
    function (row) {
      const bindingStatus =
        announcementText_(
          row.binding_status
        ).toLowerCase();

      const sendStatus =
        announcementText_(
          row.send_status
        ).toLowerCase();

      if (
        bindingStatus ===
        'bound'
      ) {
        stats.bound_count +=
          1;
      }

      if (
        sendStatus ===
        'sent'
      ) {
        stats.sent_count +=
          1;
      } else if (
        sendStatus ===
        'failed'
      ) {
        stats.failed_count +=
          1;
      } else if (
        sendStatus ===
        'unbound'
      ) {
        stats.unbound_count +=
          1;
      } else if (
        sendStatus ===
        'conflict'
      ) {
        stats.conflict_count +=
          1;
      }
    }
  );

  return stats;
}


function announcementResolveOverallStatus_(
  targetCount,
  sentCount,
  failedCount,
  unboundCount,
  conflictCount
) {
  if (
    targetCount > 0 &&
    sentCount ===
      targetCount
  ) {
    return 'sent';
  }

  if (
    sentCount > 0
  ) {
    return 'partial';
  }

  if (
    failedCount > 0 ||
    unboundCount > 0 ||
    conflictCount > 0
  ) {
    return 'failed';
  }

  return 'failed';
}


// ==================================================
// Permission, audit, workspace
// ==================================================

function announcementCanSend_(
  access
) {
  return [
    'owner',
    'admin',
    'manager'
  ].indexOf(
    announcementText_(
      access.membership.role
    ).toLowerCase()
  ) >= 0;
}


function announcementRequireSend_(
  access
) {
  if (
    announcementCanSend_(
      access
    )
  ) {
    return {
      success:
        true
    };
  }

  return workspaceResult_(
    false,
    'PERMISSION_DENIED',
    '目前角色沒有發送公告的權限'
  );
}


function announcementAudit_(
  access,
  action,
  result,
  meta
) {
  try {
    if (
      typeof workspaceRecordOperationActor_ ===
      'function'
    ) {
      workspaceRecordOperationActor_(
        access,
        action,
        result,
        meta ||
        {}
      );
    }
  } catch (error) {
    // 稽核失敗不阻擋公告主流程。
  }
}


function announcementGetWorkspaceRows_(
  sheet,
  access,
  propertyIdMap
) {
  if (!sheet) {
    return [];
  }

  return workspaceGetObjectsWithRow_(
    sheet
  ).filter(
    function (row) {
      return announcementRowMatchesWorkspace_(
        row,
        access,
        propertyIdMap
      );
    }
  );
}


function announcementRowMatchesWorkspace_(
  row,
  access,
  propertyIdMap
) {
  const workspaceId =
    announcementText_(
      access.workspace
        .workspace_id
    ).toUpperCase();

  const rowWorkspaceId =
    announcementText_(
      row.workspace_id
    ).toUpperCase();

  if (rowWorkspaceId) {
    return (
      rowWorkspaceId ===
      workspaceId
    );
  }

  const landlordIds =
    (
      access.principals ||
      []
    )
      .map(
        function (principal) {
          return announcementText_(
            principal.landlord_id
          );
        }
      )
      .filter(Boolean);

  const landlordId =
    announcementText_(
      row.landlord_id
    );

  if (
    landlordId &&
    landlordIds.indexOf(
      landlordId
    ) >= 0
  ) {
    return true;
  }

  const propertyId =
    announcementText_(
      row.property_id ||
      row.audience_property_id
    );

  return Boolean(
    propertyId &&
    propertyIdMap &&
    propertyIdMap[
      propertyId
    ]
  );
}


// ==================================================
// Spreadsheet cell-capacity maintenance
// ==================================================

function announcementEnsureCapacityForNewSheet_(
  ss,
  sheetName
) {
  let diagnosis =
    announcementDiagnoseCellCapacity_(
      ss
    );

  const requiredCells =
    V2_ANNOUNCEMENT_CELL_CAPACITY_
      .reserve_per_new_sheet +
    V2_ANNOUNCEMENT_CELL_CAPACITY_
      .minimum_free_cells;

  if (
    diagnosis.free_cells >=
    requiredCells
  ) {
    return diagnosis;
  }

  const compactResult =
    announcementCompactSpreadsheetCapacity_(
      ss
    );

  diagnosis =
    compactResult.after;

  if (
    diagnosis.free_cells <
    requiredCells
  ) {
    const largestSheets =
      diagnosis.sheets
        .slice(
          0,
          8
        )
        .map(
          function (sheet) {
            return (
              sheet.sheet_name +
              '：' +
              sheet.allocated_cells
            );
          }
        )
        .join(
          '；'
        );

    throw new Error(
      '建立 ' +
      sheetName +
      ' 前仍沒有足夠的試算表容量。目前配置 ' +
      diagnosis.total_cells +
      ' 個儲存格、剩餘 ' +
      diagnosis.free_cells +
      ' 個。占用較大的工作表：' +
      largestSheets
    );
  }

  return diagnosis;
}


function announcementDiagnoseCellCapacity_(
  ss
) {
  const sheets =
    ss.getSheets()
      .map(
        function (sheet) {
          const maxRows =
            sheet.getMaxRows();

          const maxColumns =
            sheet.getMaxColumns();

          const lastRow =
            Math.max(
              sheet.getLastRow(),
              1
            );

          const lastColumn =
            Math.max(
              sheet.getLastColumn(),
              1
            );

          return {
            sheet_name:
              sheet.getName(),

            max_rows:
              maxRows,

            max_columns:
              maxColumns,

            last_data_row:
              lastRow,

            last_data_column:
              lastColumn,

            allocated_cells:
              maxRows *
              maxColumns,

            used_rectangle_cells:
              lastRow *
              lastColumn,

            reclaimable_cells:
              Math.max(
                0,
                maxRows *
                maxColumns -
                Math.max(
                  lastRow +
                    V2_ANNOUNCEMENT_CELL_CAPACITY_
                      .row_buffer,
                  V2_ANNOUNCEMENT_CELL_CAPACITY_
                    .minimum_rows
                ) *
                Math.max(
                  lastColumn +
                    V2_ANNOUNCEMENT_CELL_CAPACITY_
                      .column_buffer,
                  V2_ANNOUNCEMENT_CELL_CAPACITY_
                    .minimum_columns
                )
              )
          };
        }
      )
      .sort(
        function (a, b) {
          return (
            b.allocated_cells -
            a.allocated_cells
          );
        }
      );

  const totalCells =
    sheets.reduce(
      function (total, sheet) {
        return (
          total +
          sheet.allocated_cells
        );
      },
      0
    );

  return {
    workbook_limit:
      V2_ANNOUNCEMENT_CELL_CAPACITY_
        .workbook_limit,

    sheet_count:
      sheets.length,

    total_cells:
      totalCells,

    free_cells:
      Math.max(
        0,
        V2_ANNOUNCEMENT_CELL_CAPACITY_
          .workbook_limit -
        totalCells
      ),

    usage_percent:
      Math.round(
        (
          totalCells /
          V2_ANNOUNCEMENT_CELL_CAPACITY_
            .workbook_limit
        ) *
        10000
      ) /
      100,

    sheets:
      sheets
  };
}


function announcementCompactSpreadsheetCapacity_(
  ss
) {
  const before =
    announcementDiagnoseCellCapacity_(
      ss
    );

  const changes = [];
  const errors = [];

  ss.getSheets().forEach(
    function (sheet) {
      const sheetName =
        sheet.getName();

      try {
        const maxRows =
          sheet.getMaxRows();

        const maxColumns =
          sheet.getMaxColumns();

        const lastRow =
          Math.max(
            sheet.getLastRow(),
            1
          );

        const lastColumn =
          Math.max(
            sheet.getLastColumn(),
            1
          );

        const targetRows =
          Math.min(
            maxRows,
            Math.max(
              lastRow +
                V2_ANNOUNCEMENT_CELL_CAPACITY_
                  .row_buffer,
              V2_ANNOUNCEMENT_CELL_CAPACITY_
                .minimum_rows
            )
          );

        const targetColumns =
          Math.min(
            maxColumns,
            Math.max(
              lastColumn +
                V2_ANNOUNCEMENT_CELL_CAPACITY_
                  .column_buffer,
              V2_ANNOUNCEMENT_CELL_CAPACITY_
                .minimum_columns
            )
          );

        let removedRows =
          0;

        let removedColumns =
          0;

        if (
          maxRows >
          targetRows
        ) {
          removedRows =
            maxRows -
            targetRows;

          sheet.deleteRows(
            targetRows + 1,
            removedRows
          );
        }

        if (
          maxColumns >
          targetColumns
        ) {
          removedColumns =
            maxColumns -
            targetColumns;

          sheet.deleteColumns(
            targetColumns + 1,
            removedColumns
          );
        }

        if (
          removedRows > 0 ||
          removedColumns > 0
        ) {
          changes.push({
            sheet_name:
              sheetName,

            removed_rows:
              removedRows,

            removed_columns:
              removedColumns,

            before_cells:
              maxRows *
              maxColumns,

            after_cells:
              sheet.getMaxRows() *
              sheet.getMaxColumns()
          });
        }

      } catch (error) {
        errors.push({
          sheet_name:
            sheetName,

          message:
            error.message
        });
      }
    }
  );

  SpreadsheetApp.flush();

  const after =
    announcementDiagnoseCellCapacity_(
      ss
    );

  return {
    success:
      errors.length ===
      0,

    before:
      before,

    after:
      after,

    freed_cells:
      Math.max(
        0,
        before.total_cells -
        after.total_cells
      ),

    changed_sheet_count:
      changes.length,

    changes:
      changes,

    errors:
      errors
  };
}


function announcementResizeNewSheet_(
  sheet,
  requiredColumns
) {
  const targetRows =
    V2_ANNOUNCEMENT_CELL_CAPACITY_
      .minimum_rows;

  const targetColumns =
    Math.max(
      requiredColumns,
      V2_ANNOUNCEMENT_CELL_CAPACITY_
        .minimum_columns
    );

  if (
    sheet.getMaxRows() >
    targetRows
  ) {
    sheet.deleteRows(
      targetRows + 1,
      sheet.getMaxRows() -
      targetRows
    );
  }

  if (
    sheet.getMaxColumns() >
    targetColumns
  ) {
    sheet.deleteColumns(
      targetColumns + 1,
      sheet.getMaxColumns() -
      targetColumns
    );
  }

  if (
    sheet.getMaxColumns() <
    requiredColumns
  ) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      requiredColumns -
      sheet.getMaxColumns()
    );
  }
}


// ==================================================
// Schema and logs
// ==================================================

function announcementEnsureSchema_() {
  if (
    typeof workspaceEnsureSchema_ ===
    'function'
  ) {
    workspaceEnsureSchema_();
  }

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  announcementEnsureSheet_(
    ss,
    V2_ANNOUNCEMENT_SHEETS_
      .announcements,
    [
      'announcement_id',
      'workspace_id',
      'landlord_id',
      'title',
      'body',
      'category',
      'priority',
      'audience_type',
      'audience_property_id',
      'audience_property_name',
      'audience_tenant_ids',
      'target_count',
      'bound_count',
      'unbound_count',
      'conflict_count',
      'sent_count',
      'failed_count',
      'status',
      'created_by_user_id',
      'created_by_membership_id',
      'created_at',
      'sent_at',
      'updated_at'
    ]
  );

  announcementEnsureSheet_(
    ss,
    V2_ANNOUNCEMENT_SHEETS_
      .recipients,
    [
      'announcement_recipient_id',
      'announcement_id',
      'workspace_id',
      'tenant_id',
      'tenant_user_id',
      'tenant_name',
      'tenant_phone',
      'tenant_line_user_id',
      'binding_status',
      'property_id',
      'property_name',
      'room_list',
      'send_status',
      'sent_at',
      'last_attempt_at',
      'send_count',
      'last_error',
      'message_text',
      'created_at',
      'updated_at'
    ]
  );

  announcementEnsureLineLogSheet_(
    ss
  );

  return true;
}


function announcementEnsureLineLogSheet_(
  ss
) {
  return announcementEnsureSheet_(
    ss,
    V2_ANNOUNCEMENT_SHEETS_
      .lineMessageLogs,
    [
      'created_at',
      'direction',
      'source',
      'line_message_id',
      'reply_token',
      'workspace_id',
      'landlord_line_user_id',
      'tenant_line_user_id',
      'tenant_id',
      'tenant_user_id',
      'tenant_name',
      'room_list',
      'announcement_id',
      'message_type',
      'message_text',
      'status',
      'note'
    ]
  );
}


function announcementAppendLineLogs_(
  ss,
  rows
) {
  if (
    !rows ||
    rows.length ===
      0
  ) {
    return;
  }

  const sheet =
    announcementEnsureLineLogSheet_(
      ss
    );

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0]
      .map(
        announcementText_
      );

  const values =
    rows.map(
      function (row) {
        return headers.map(
          function (header) {
            return row[
              header
            ] !==
              undefined
              ? row[
                  header
                ]
              : '';
          }
        );
      }
    );

  sheet
    .getRange(
      sheet.getLastRow() + 1,
      1,
      values.length,
      headers.length
    )
    .setValues(
      values
    );
}


function announcementEnsureSheet_(
  ss,
  sheetName,
  headers
) {
  let sheet =
    ss.getSheetByName(
      sheetName
    );

  if (!sheet) {
    /*
     * insertSheet() 本身會先配置一張新工作表。
     * 試算表接近總儲存格上限時，必須先縮減既有工作表
     * 尾端沒有內容的空白列與空白欄。
     */
    announcementEnsureCapacityForNewSheet_(
      ss,
      sheetName
    );

    try {
      sheet =
        ss.insertSheet(
          sheetName
        );

    } catch (error) {
      const diagnosis =
        announcementDiagnoseCellCapacity_(
          ss
        );

      throw new Error(
        '無法建立 ' +
        sheetName +
        '。目前試算表配置約 ' +
        diagnosis.total_cells +
        ' 個儲存格，剩餘約 ' +
        diagnosis.free_cells +
        ' 個。請先執行 testCompactAnnouncementSpreadsheetCapacity，再重新執行 Schema 測試。原始錯誤：' +
        error.message
      );
    }

    /*
     * 新工作表建立後立即縮到實際需要的尺寸，
     * 避免每張新表長期保留大量空白儲存格。
     */
    announcementResizeNewSheet_(
      sheet,
      headers.length
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

    sheet.setFrozenRows(
      1
    );

    return sheet;
  }

  announcementEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


function announcementEnsureHeaders_(
  sheet,
  requiredHeaders
) {
  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  const existing =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(
        announcementText_
      );

  const missing =
    requiredHeaders.filter(
      function (header) {
        return (
          existing.indexOf(
            header
          ) ===
          -1
        );
      }
    );

  if (
    missing.length > 0
  ) {
    sheet
      .getRange(
        1,
        sheet.getLastColumn() + 1,
        1,
        missing.length
      )
      .setValues([
        missing
      ]);
  }
}


function announcementSetRowValues_(
  sheet,
  rowNumber,
  values
) {
  if (
    !sheet ||
    rowNumber < 2
  ) {
    return;
  }

  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(
        announcementText_
      );

  const row =
    sheet
      .getRange(
        rowNumber,
        1,
        1,
        lastColumn
      )
      .getValues()[0];

  Object.keys(
    values ||
    {}
  ).forEach(
    function (header) {
      const index =
        headers.indexOf(
          header
        );

      if (index >= 0) {
        row[
          index
        ] =
          values[
            header
          ];
      }
    }
  );

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      lastColumn
    )
    .setValues([
      row
    ]);
}


function announcementAppendObject_(
  sheet,
  object
) {
  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(
        announcementText_
      );

  const row =
    headers.map(
      function (header) {
        return object[
          header
        ] !==
          undefined
          ? object[
              header
            ]
          : '';
      }
    );

  sheet.appendRow(
    row
  );
}


// ==================================================
// Formatting helpers
// ==================================================

function announcementNormalizeHistoryFilter_(
  value
) {
  const filter =
    announcementText_(
      value
    ).toLowerCase();

  return [
    'all',
    'sent',
    'partial',
    'failed'
  ].indexOf(
    filter
  ) >= 0
    ? filter
    : 'all';
}


function announcementNormalizeCategory_(
  value
) {
  const category =
    announcementText_(
      value
    ).toLowerCase();

  return [
    'general',
    'maintenance',
    'utility',
    'payment',
    'emergency'
  ].indexOf(
    category
  ) >= 0
    ? category
    : 'general';
}


function announcementNormalizePriority_(
  value
) {
  const priority =
    announcementText_(
      value
    ).toLowerCase();

  return [
    'normal',
    'urgent',
    'emergency'
  ].indexOf(
    priority
  ) >= 0
    ? priority
    : 'normal';
}


function announcementNormalizeAudienceType_(
  value
) {
  const type =
    announcementText_(
      value
    ).toLowerCase();

  return [
    'all',
    'property',
    'selected'
  ].indexOf(
    type
  ) >= 0
    ? type
    : 'all';
}


function announcementParseTenantIds_(
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
      announcementText_(
        value
      );

    values =
      text
        ? JSON.parse(
            text
          )
        : [];
  }

  if (
    !Array.isArray(
      values
    )
  ) {
    throw new Error(
      'tenant_ids_json 必須是陣列'
    );
  }

  const seen = {};

  return values
    .map(
      function (tenantId) {
        return announcementText_(
          tenantId
        ).toUpperCase();
      }
    )
    .filter(
      function (tenantId) {
        if (
          !tenantId ||
          seen[
            tenantId
          ]
        ) {
          return false;
        }

        seen[
          tenantId
        ] = true;

        return true;
      }
    );
}


function announcementCategoryLabel_(
  value
) {
  const labels = {
    general:
      '管理公告',
    maintenance:
      '維修公告',
    utility:
      '水電公告',
    payment:
      '繳費公告',
    emergency:
      '緊急公告'
  };

  return labels[
    announcementNormalizeCategory_(
      value
    )
  ];
}


function announcementPriorityLabel_(
  value
) {
  const labels = {
    normal:
      '一般',
    urgent:
      '重要',
    emergency:
      '緊急'
  };

  return labels[
    announcementNormalizePriority_(
      value
    )
  ];
}


function announcementAudienceLabel_(
  announcement
) {
  const type =
    announcementNormalizeAudienceType_(
      announcement.audience_type
    );

  if (
    type ===
    'property'
  ) {
    return (
      '指定物件：' +
      (
        announcementText_(
          announcement
            .audience_property_name
        ) ||
        '-'
      )
    );
  }

  if (
    type ===
    'selected'
  ) {
    return '指定房客';
  }

  return '全部有效租約房客';
}


function announcementStatusLabel_(
  value
) {
  const status =
    announcementText_(
      value
    ).toLowerCase();

  const labels = {
    sending:
      '發送中',
    sent:
      '已送達',
    partial:
      '部分送達',
    failed:
      '未送達'
  };

  return labels[
    status
  ] ||
  '未送達';
}


function announcementContractIsCurrent_(
  contract
) {
  const status =
    announcementText_(
      contract.contract_status ||
      contract.status ||
      contract.account_status
    ).toLowerCase();

  if (
    [
      'terminated',
      'ended',
      'expired',
      'cancelled',
      'canceled',
      'closed',
      'archived',
      'void',
      'voided',
      'deleted',
      'rejected',
      'draft'
    ].indexOf(
      status
    ) >= 0
  ) {
    return false;
  }

  const today =
    announcementToday_();

  const start =
    announcementDate_(
      contract.start_date ||
      contract.contract_start_date ||
      contract.lease_start_date
    );

  const end =
    announcementDate_(
      contract.end_date ||
      contract.contract_end_date ||
      contract.lease_end_date
    );

  if (
    start &&
    start.getTime() >
      today.getTime()
  ) {
    return false;
  }

  if (
    end &&
    end.getTime() <
      today.getTime()
  ) {
    return false;
  }

  if (
    start ||
    end
  ) {
    return true;
  }

  return [
    '',
    'active',
    'current',
    'effective',
    'signed',
    'approved'
  ].indexOf(
    status
  ) >= 0;
}


function announcementLooksLikeLineUid_(
  value
) {
  return /^U[a-zA-Z0-9_-]{20,}$/.test(
    announcementText_(
      value
    )
  );
}


function announcementPushUnique_(
  list,
  value
) {
  value =
    announcementText_(
      value
    );

  if (
    value &&
    list.indexOf(
      value
    ) <
    0
  ) {
    list.push(
      value
    );
  }
}


function announcementGenerateId_(
  prefix
) {
  return (
    prefix +
    Utilities.getUuid()
      .replace(
        /-/g,
        ''
      )
      .slice(
        0,
        17
      )
      .toUpperCase()
  );
}


function announcementChunk_(
  items,
  size
) {
  const result = [];

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    result.push(
      items.slice(
        index,
        index + size
      )
    );
  }

  return result;
}


function announcementFormatDateTime_(
  value
) {
  const date =
    announcementDate_(
      value
    );

  return date
    ? Utilities.formatDate(
        date,
        'Asia/Taipei',
        'yyyy-MM-dd HH:mm'
      )
    : '';
}


function announcementTime_(
  value
) {
  const date =
    announcementDate_(
      value
    );

  return date
    ? date.getTime()
    : 0;
}


function announcementDate_(
  value
) {
  if (!value) {
    return null;
  }

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return new Date(
      value.getTime()
    );
  }

  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >= 20000 &&
    value <= 100000
  ) {
    const base =
      new Date(
        1899,
        11,
        30
      );

    return new Date(
      base.getTime() +
      Math.floor(
        value
      ) *
      86400000
    );
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


function announcementToday_() {
  const date =
    new Date();

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date;
}


function announcementCompareText_(
  a,
  b
) {
  return announcementText_(
    a
  ).localeCompare(
    announcementText_(
      b
    ),
    'zh-Hant',
    {
      numeric:
        true,
      sensitivity:
        'base'
    }
  );
}


function announcementText_(
  value
) {
  return value ===
      undefined ||
    value ===
      null
    ? ''
    : String(
        value
      ).trim();
}


function announcementNumber_(
  value
) {
  const number =
    Number(
      announcementText_(
        value
      ).replace(
        /,/g,
        ''
      )
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


// ==================================================
// Tests
// ==================================================

function testDiagnoseAnnouncementSpreadsheetCapacity() {
  const result =
    announcementDiagnoseCellCapacity_(
      SpreadsheetApp
        .getActiveSpreadsheet()
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


function testCompactAnnouncementSpreadsheetCapacity() {
  const result =
    announcementCompactSpreadsheetCapacity_(
      SpreadsheetApp
        .getActiveSpreadsheet()
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


function testEnsureAnnouncementSchema() {
  announcementEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const result = {
    success:
      true,

    announcement_columns:
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .announcements
      ).getLastColumn(),

    recipient_columns:
      ss.getSheetByName(
        V2_ANNOUNCEMENT_SHEETS_
          .recipients
      ).getLastColumn()
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


function testLandlordAnnouncementsInit() {
  const result =
    getLandlordAnnouncementsInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      'all'
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


function testAnnouncementMessagePreview() {
  const result =
    getLandlordAnnouncementsInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      'all'
    );

  const recipient =
    result &&
    result.success &&
    result.data &&
    result.data.recipients
      ? result.data.recipients[0]
      : null;

  const output = {
    success:
      Boolean(
        recipient
      ),

    tenant_name:
      recipient
        ? recipient.tenant_name
        : '',

    message:
      recipient
        ? announcementBuildMessage_(
            '公共區域清潔通知',
            '明日上午 10:00 將進行公共區域清潔，請勿在走道堆放私人物品。',
            'general',
            'normal',
            recipient
          )
        : '找不到目前有效租約房客'
  };

  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  return output;
}
