/**
 * CMWebs V2 Workspace 團隊通知中心
 *
 * API：
 * - landlord_notifications_init
 * - landlord_notification_mark_read
 * - landlord_notifications_mark_all_read
 *
 * 其他模組可呼叫：
 * workspaceNotifyTeam_({
 *   workspace_id,
 *   landlord_id,
 *   event_type,
 *   title,
 *   body,
 *   target_type,
 *   target_id,
 *   action_url,
 *   severity,
 *   source,
 *   fallback_line_user_id,
 *   metadata
 * })
 */

const V2_WORKSPACE_NOTIFICATION_SHEETS_ = {
  users:
    'V2_users',

  landlords:
    'V2_landlords',

  workspaces:
    'V2_workspaces',

  members:
    'V2_workspace_members',

  settings:
    'V2_workspace_settings',

  notifications:
    'V2_workspace_notifications',

  deliveries:
    'V2_workspace_notification_deliveries'
};

const V2_WORKSPACE_NOTIFICATION_DEFAULTS_ = {
  notify_bill_created:
    true,

  notify_payment_report:
    true,

  notify_tenant_message:
    true,

  notify_overdue:
    true,

  notify_contract:
    true,

  notify_checkin:
    true,

  notify_announcement_result:
    true,

  notify_line_failure:
    true
};


/**
 * 建立通知、解析團隊收件人並發送 LINE。
 */
function workspaceNotifyTeam_(
  payload
) {
  payload =
    payload ||
    {};

  /*
   * 付款回報、帳單、催繳、報到與公告模組本身可能已持有
   * ScriptLock。通知模組改用獨立的 DocumentLock，避免巢狀
   * ScriptLock 導致等待逾時。
   */
  const lock =
    LockService.getDocumentLock() ||
    LockService.getUserLock();

  let locked =
    false;

  try {
    workspaceNotificationEnsureSchema_();

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const eventType =
      workspaceNotificationEventType_(
        payload.event_type
      );

    const config =
      workspaceNotificationEventConfig_(
        eventType
      );

    const workspaceId =
      workspaceNotificationResolveWorkspaceId_(
        ss,
        payload.workspace_id,
        payload.landlord_id
      );

    if (!workspaceId) {
      return workspaceNotificationResult_(
        false,
        'WORKSPACE_NOT_FOUND',
        '找不到通知所屬的管理團隊'
      );
    }

    const title =
      workspaceNotificationText_(
        payload.title
      ).slice(
        0,
        120
      );

    const body =
      workspaceNotificationText_(
        payload.body
      ).slice(
        0,
        3000
      );

    if (!title || !body) {
      return workspaceNotificationResult_(
        false,
        'NOTIFICATION_CONTENT_REQUIRED',
        '通知標題與內容不可空白'
      );
    }

    lock.waitLock(
      25000
    );

    locked =
      true;

    const workspace =
      workspaceNotificationFind_(
        ss.getSheetByName(
          V2_WORKSPACE_NOTIFICATION_SHEETS_
            .workspaces
        ),
        'workspace_id',
        workspaceId
      ) ||
      {};

    const preferenceEnabled =
      workspaceNotificationPreferenceEnabled_(
        ss,
        workspaceId,
        config.preference_key
      );

    const recipients =
      workspaceNotificationRecipients_(
        ss,
        workspaceId,
        config,
        payload
      );

    if (
      recipients.length ===
        0 &&
      workspaceNotificationText_(
        payload.fallback_line_user_id
      )
    ) {
      recipients.push({
        membership_id:
          '',

        user_id:
          '',

        line_user_id:
          workspaceNotificationText_(
            payload.fallback_line_user_id
          ),

        display_name:
          '主要房東',

        role:
          'owner'
      });
    }

    const now =
      new Date();

    const notificationId =
      workspaceNotificationId_(
        'NTF'
      );

    const notification = {
      notification_id:
        notificationId,

      workspace_id:
        workspaceId,

      workspace_name:
        workspaceNotificationText_(
          workspace.workspace_name
        ),

      event_type:
        eventType,

      event_label:
        config.label,

      event_title:
        title,

      event_body:
        body,

      severity:
        workspaceNotificationSeverity_(
          payload.severity
        ),

      target_type:
        workspaceNotificationText_(
          payload.target_type
        ),

      target_id:
        workspaceNotificationText_(
          payload.target_id
        ),

      action_url:
        workspaceNotificationText_(
          payload.action_url
        ),

      source:
        workspaceNotificationText_(
          payload.source
        ),

      preference_key:
        config.preference_key,

      preference_enabled:
        preferenceEnabled,

      created_by_user_id:
        workspaceNotificationText_(
          payload.created_by_user_id
        ),

      recipient_count:
        recipients.length,

      sent_count:
        0,

      failed_count:
        0,

      skipped_count:
        0,

      status:
        'pending',

      metadata_json:
        workspaceNotificationJson_(
          payload.metadata ||
          {}
        ),

      created_at:
        now,

      updated_at:
        now
    };

    workspaceNotificationAppend_(
      ss.getSheetByName(
        V2_WORKSPACE_NOTIFICATION_SHEETS_
          .notifications
      ),
      notification
    );

    const deliveries =
      recipients.map(
        function (recipient) {
          return workspaceNotificationDeliver_(
            notification,
            recipient,
            preferenceEnabled,
            now
          );
        }
      );

    const sentCount =
      deliveries.filter(
        function (item) {
          return (
            item.delivery_status ===
            'sent'
          );
        }
      ).length;

    const failedCount =
      deliveries.filter(
        function (item) {
          return (
            item.delivery_status ===
            'failed'
          );
        }
      ).length;

    const skippedCount =
      deliveries.filter(
        function (item) {
          return [
            'skipped_disabled',
            'skipped_unbound'
          ].indexOf(
            item.delivery_status
          ) >=
          0;
        }
      ).length;

    let status =
      'stored';

    if (
      sentCount >
        0 &&
      failedCount ===
        0 &&
      skippedCount ===
        0
    ) {
      status =
        'sent';

    } else if (
      sentCount >
      0
    ) {
      status =
        'partial';

    } else if (
      failedCount >
      0
    ) {
      status =
        'failed';

    } else if (
      !preferenceEnabled
    ) {
      status =
        'stored_only';
    }

    workspaceNotificationUpdateByKey_(
      ss.getSheetByName(
        V2_WORKSPACE_NOTIFICATION_SHEETS_
          .notifications
      ),
      'notification_id',
      notificationId,
      {
        sent_count:
          sentCount,

        failed_count:
          failedCount,

        skipped_count:
          skippedCount,

        status:
          status,

        updated_at:
          new Date()
      }
    );

    SpreadsheetApp.flush();

    return workspaceNotificationResult_(
      true,
      'NOTIFICATION_RECORDED',
      status ===
        'sent'
        ? '團隊通知已送達'
        : (
            status ===
              'stored_only'
              ? '通知已記錄，此類 LINE 通知目前關閉'
              : '通知已記錄'
          ),
      {
        success:
          sentCount >
            0 ||
          preferenceEnabled ===
            false,

        notification_id:
          notificationId,

        workspace_id:
          workspaceId,

        event_type:
          eventType,

        preference_key:
          config.preference_key,

        preference_enabled:
          preferenceEnabled,

        recipient_count:
          recipients.length,

        sent_count:
          sentCount,

        failed_count:
          failedCount,

        skipped_count:
          skippedCount,

        status:
          status,

        deliveries:
          deliveries.map(
            workspaceNotificationDeliveryView_
          )
      }
    );

  } catch (error) {
    return workspaceNotificationResult_(
      false,
      'WORKSPACE_NOTIFICATION_ERROR',
      '團隊通知處理失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * 通知中心初始化。
 */
function getLandlordNotificationsInitByLineUid_(
  lineUserId,
  statusFilter,
  eventFilter
) {
  try {
    workspaceNotificationEnsureSchema_();

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

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const workspaceId =
      workspaceNotificationText_(
        access.workspace
          .workspace_id
      ).toUpperCase();

    statusFilter =
      workspaceNotificationStatusFilter_(
        statusFilter
      );

    eventFilter =
      workspaceNotificationEventFilter_(
        eventFilter
      );

    const membershipId =
      workspaceNotificationText_(
        access.membership
          .membership_id
      );

    const userId =
      workspaceNotificationText_(
        access.user
          .user_id
      );

    const deliveries =
      workspaceNotificationObjects_(
        ss.getSheetByName(
          V2_WORKSPACE_NOTIFICATION_SHEETS_
            .deliveries
        )
      );

    const deliveryByNotificationId = {};

    deliveries.forEach(
      function (delivery) {
        if (
          workspaceNotificationText_(
            delivery.workspace_id
          ).toUpperCase() !==
          workspaceId
        ) {
          return;
        }

        const matchesMember =
          membershipId &&
          workspaceNotificationText_(
            delivery.membership_id
          ) ===
          membershipId;

        const matchesUser =
          userId &&
          workspaceNotificationText_(
            delivery.user_id
          ) ===
          userId;

        if (
          matchesMember ||
          matchesUser
        ) {
          deliveryByNotificationId[
            workspaceNotificationText_(
              delivery.notification_id
            )
          ] =
            delivery;
        }
      }
    );

    const allItems =
      workspaceNotificationObjects_(
        ss.getSheetByName(
          V2_WORKSPACE_NOTIFICATION_SHEETS_
            .notifications
        )
      )
        .filter(
          function (item) {
            return (
              workspaceNotificationText_(
                item.workspace_id
              ).toUpperCase() ===
              workspaceId
            );
          }
        )
        .map(
          function (item) {
            return workspaceNotificationView_(
              item,
              deliveryByNotificationId[
                workspaceNotificationText_(
                  item.notification_id
                )
              ] ||
              null
            );
          }
        )
        .sort(
          function (a, b) {
            return (
              b.created_at_value -
              a.created_at_value
            );
          }
        );

    const filtered =
      allItems
        .filter(
          function (item) {
            if (
              statusFilter ===
                'unread' &&
              item.read_status ===
                'read'
            ) {
              return false;
            }

            if (
              statusFilter ===
                'failed' &&
              [
                'partial',
                'failed'
              ].indexOf(
                item.status
              ) ===
              -1
            ) {
              return false;
            }

            if (
              eventFilter !==
                'all' &&
              item.event_type !==
                eventFilter
            ) {
              return false;
            }

            return true;
          }
        )
        .slice(
          0,
          120
        );

    return workspaceNotificationResult_(
      true,
      'OK',
      '通知中心載入成功',
      {
        workspace:
          typeof workspaceBuildWorkspaceView_ ===
            'function'
            ? workspaceBuildWorkspaceView_(
                access.workspace
              )
            : access.workspace,

        current_membership:
          typeof workspaceBuildMembershipView_ ===
            'function'
            ? workspaceBuildMembershipView_(
                access.membership
              )
            : access.membership,

        summary: {
          total_count:
            allItems.length,

          unread_count:
            allItems.filter(
              function (item) {
                return (
                  item.read_status !==
                  'read'
                );
              }
            ).length,

          sent_count:
            allItems.filter(
              function (item) {
                return (
                  item.status ===
                  'sent'
                );
              }
            ).length,

          issue_count:
            allItems.filter(
              function (item) {
                return [
                  'partial',
                  'failed'
                ].indexOf(
                  item.status
                ) >=
                0;
              }
            ).length
        },

        status_filter:
          statusFilter,

        event_filter:
          eventFilter,

        event_options:
          workspaceNotificationEventOptions_(),

        notifications:
          filtered
      }
    );

  } catch (error) {
    return workspaceNotificationResult_(
      false,
      'LANDLORD_NOTIFICATIONS_INIT_ERROR',
      '通知中心載入失敗：' +
        error.message
    );
  }
}


/**
 * 單筆已讀。
 */
function markLandlordNotificationReadByLineUid_(
  lineUserId,
  notificationId
) {
  return workspaceNotificationMarkRead_(
    lineUserId,
    notificationId,
    false
  );
}


/**
 * 全部已讀。
 */
function markAllLandlordNotificationsReadByLineUid_(
  lineUserId
) {
  return workspaceNotificationMarkRead_(
    lineUserId,
    '',
    true
  );
}


function workspaceNotificationMarkRead_(
  lineUserId,
  notificationId,
  markAll
) {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    workspaceNotificationEnsureSchema_();

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

    notificationId =
      workspaceNotificationText_(
        notificationId
      );

    if (
      markAll !==
        true &&
      !notificationId
    ) {
      return workspaceNotificationResult_(
        false,
        'NOTIFICATION_ID_REQUIRED',
        '缺少通知編號'
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

    const workspaceId =
      workspaceNotificationText_(
        access.workspace
          .workspace_id
      ).toUpperCase();

    const membershipId =
      workspaceNotificationText_(
        access.membership
          .membership_id
      );

    const userId =
      workspaceNotificationText_(
        access.user
          .user_id
      );

    const notificationRows =
      workspaceNotificationObjects_(
        ss.getSheetByName(
          V2_WORKSPACE_NOTIFICATION_SHEETS_
            .notifications
        )
      )
        .filter(
          function (item) {
            if (
              workspaceNotificationText_(
                item.workspace_id
              ).toUpperCase() !==
              workspaceId
            ) {
              return false;
            }

            return (
              markAll ===
                true ||
              workspaceNotificationText_(
                item.notification_id
              ) ===
              notificationId
            );
          }
        );

    if (
      markAll !==
        true &&
      notificationRows.length ===
        0
    ) {
      return workspaceNotificationResult_(
        false,
        'NOTIFICATION_NOT_FOUND',
        '找不到此通知'
      );
    }

    const deliverySheet =
      ss.getSheetByName(
        V2_WORKSPACE_NOTIFICATION_SHEETS_
          .deliveries
      );

    const deliveries =
      workspaceNotificationObjects_(
        deliverySheet
      );

    const now =
      new Date();

    let updatedCount =
      0;

    notificationRows.forEach(
      function (notification) {
        const id =
          workspaceNotificationText_(
            notification.notification_id
          );

        const delivery =
          deliveries.find(
            function (item) {
              if (
                workspaceNotificationText_(
                  item.notification_id
                ) !==
                id
              ) {
                return false;
              }

              return (
                (
                  membershipId &&
                  workspaceNotificationText_(
                    item.membership_id
                  ) ===
                  membershipId
                ) ||
                (
                  userId &&
                  workspaceNotificationText_(
                    item.user_id
                  ) ===
                  userId
                )
              );
            }
          );

        if (delivery) {
          if (
            workspaceNotificationText_(
              delivery.read_status
            ).toLowerCase() !==
            'read'
          ) {
            workspaceNotificationUpdateRow_(
              deliverySheet,
              delivery.__row_number,
              {
                read_status:
                  'read',

                read_at:
                  now,

                updated_at:
                  now
              }
            );

            updatedCount +=
              1;
          }

          return;
        }

        workspaceNotificationAppend_(
          deliverySheet,
          {
            delivery_id:
              workspaceNotificationId_(
                'NTD'
              ),

            notification_id:
              id,

            workspace_id:
              workspaceId,

            membership_id:
              membershipId,

            user_id:
              userId,

            line_user_id:
              workspaceNotificationText_(
                access.user
                  .line_user_id
              ),

            display_name:
              workspaceNotificationText_(
                access.membership
                  .display_name ||
                access.user
                  .profile_display_name ||
                access.user
                  .name
              ),

            role:
              workspaceNotificationText_(
                access.membership
                  .role
              ),

            delivery_status:
              'center_only',

            delivered_at:
              '',

            read_status:
              'read',

            read_at:
              now,

            send_count:
              0,

            last_error:
              '',

            created_at:
              now,

            updated_at:
              now
          }
        );

        updatedCount +=
          1;
      }
    );

    SpreadsheetApp.flush();

    return workspaceNotificationResult_(
      true,
      markAll
        ? 'ALL_NOTIFICATIONS_MARKED_READ'
        : 'NOTIFICATION_MARKED_READ',
      markAll
        ? '全部通知已標示為已讀'
        : '通知已標示為已讀',
      {
        updated_count:
          updatedCount,

        notification_id:
          notificationId
      }
    );

  } catch (error) {
    return workspaceNotificationResult_(
      false,
      'NOTIFICATION_READ_UPDATE_ERROR',
      '通知已讀更新失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


// ==================================================
// Recipient and delivery
// ==================================================

function workspaceNotificationRecipients_(
  ss,
  workspaceId,
  config,
  payload
) {
  const users =
    workspaceNotificationObjects_(
      ss.getSheetByName(
        V2_WORKSPACE_NOTIFICATION_SHEETS_
          .users
      )
    );

  const userById = {};

  users.forEach(
    function (user) {
      const id =
        workspaceNotificationText_(
          user.user_id
        );

      if (id) {
        userById[
          id
        ] =
          user;
      }
    }
  );

  const seenUser = {};
  const seenLine = {};

  return workspaceNotificationObjects_(
    ss.getSheetByName(
      V2_WORKSPACE_NOTIFICATION_SHEETS_
        .members
    )
  )
    .filter(
      function (member) {
        if (
          workspaceNotificationText_(
            member.workspace_id
          ).toUpperCase() !==
          workspaceId
        ) {
          return false;
        }

        if (
          !workspaceNotificationActive_(
            member.member_status
          )
        ) {
          return false;
        }

        return workspaceNotificationEligible_(
          member,
          config
        );
      }
    )
    .map(
      function (member) {
        const user =
          userById[
            workspaceNotificationText_(
              member.user_id
            )
          ] ||
          {};

        return {
          membership_id:
            workspaceNotificationText_(
              member.membership_id
            ),

          user_id:
            workspaceNotificationText_(
              member.user_id
            ),

          line_user_id:
            workspaceNotificationText_(
              member.line_user_id ||
              user.line_user_id
            ),

          display_name:
            workspaceNotificationText_(
              member.display_name ||
              user.profile_display_name ||
              user.name
            ),

          role:
            workspaceNotificationText_(
              member.role
            ).toLowerCase()
        };
      }
    )
    .filter(
      function (recipient) {
        const userKey =
          recipient.user_id ||
          recipient.membership_id;

        if (
          userKey &&
          seenUser[
            userKey
          ]
        ) {
          return false;
        }

        if (userKey) {
          seenUser[
            userKey
          ] =
            true;
        }

        if (
          recipient.line_user_id
        ) {
          if (
            seenLine[
              recipient.line_user_id
            ]
          ) {
            return false;
          }

          seenLine[
            recipient.line_user_id
          ] =
            true;
        }

        return true;
      }
    );
}


function workspaceNotificationEligible_(
  member,
  config
) {
  const role =
    workspaceNotificationText_(
      member.role
    ).toLowerCase();

  if (
    config.roles.indexOf(
      role
    ) >=
    0
  ) {
    return true;
  }

  return config.permissions.some(
    function (permission) {
      return workspaceNotificationBoolean_(
        member[
          permission
        ]
      );
    }
  );
}


function workspaceNotificationDeliver_(
  notification,
  recipient,
  preferenceEnabled,
  now
) {
  const delivery = {
    delivery_id:
      workspaceNotificationId_(
        'NTD'
      ),

    notification_id:
      notification.notification_id,

    workspace_id:
      notification.workspace_id,

    membership_id:
      recipient.membership_id ||
      '',

    user_id:
      recipient.user_id ||
      '',

    line_user_id:
      recipient.line_user_id ||
      '',

    display_name:
      recipient.display_name ||
      '',

    role:
      recipient.role ||
      '',

    delivery_status:
      'pending',

    delivered_at:
      '',

    read_status:
      'unread',

    read_at:
      '',

    send_count:
      0,

    last_error:
      '',

    created_at:
      now,

    updated_at:
      now
  };

  if (!preferenceEnabled) {
    delivery.delivery_status =
      'skipped_disabled';

    workspaceNotificationAppend_(
      SpreadsheetApp
        .getActiveSpreadsheet()
        .getSheetByName(
          V2_WORKSPACE_NOTIFICATION_SHEETS_
            .deliveries
        ),
      delivery
    );

    return delivery;
  }

  if (
    !recipient.line_user_id
  ) {
    delivery.delivery_status =
      'skipped_unbound';

    delivery.last_error =
      '成員尚未綁定 LINE';

    workspaceNotificationAppend_(
      SpreadsheetApp
        .getActiveSpreadsheet()
        .getSheetByName(
          V2_WORKSPACE_NOTIFICATION_SHEETS_
            .deliveries
        ),
      delivery
    );

    return delivery;
  }

  try {
    if (
      typeof pushLineTextMessage_ !==
      'function'
    ) {
      throw new Error(
        '找不到 pushLineTextMessage_'
      );
    }

    const result =
      pushLineTextMessage_(
        recipient.line_user_id,
        workspaceNotificationLineText_(
          notification,
          recipient
        )
      );

    const success =
      !result ||
      result.success !==
        false;

    delivery.delivery_status =
      success
        ? 'sent'
        : 'failed';

    delivery.delivered_at =
      success
        ? new Date()
        : '';

    delivery.send_count =
      1;

    delivery.last_error =
      success
        ? ''
        : workspaceNotificationText_(
            result &&
            result.message
          );

  } catch (error) {
    delivery.delivery_status =
      'failed';

    delivery.send_count =
      1;

    delivery.last_error =
      error.message;
  }

  delivery.updated_at =
    new Date();

  workspaceNotificationAppend_(
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        V2_WORKSPACE_NOTIFICATION_SHEETS_
          .deliveries
      ),
    delivery
  );

  workspaceNotificationLogLine_(
    notification,
    recipient,
    delivery
  );

  return delivery;
}


function workspaceNotificationLineText_(
  notification,
  recipient
) {
  const lines = [
    '【CMWebs ' +
      notification.event_label +
      '】',
    '',
    (
      recipient.display_name ||
      '管理團隊成員'
    ) +
      ' 您好：',
    '',
    notification.event_title,
    '',
    notification.event_body
  ];

  if (
    notification.action_url
  ) {
    lines.push(
      '',
      '查看詳情：',
      notification.action_url
    );
  }

  return lines.join(
    '\n'
  );
}


function workspaceNotificationLogLine_(
  notification,
  recipient,
  delivery
) {
  if (
    typeof cmwebsLogLineMessage_ !==
    'function'
  ) {
    return;
  }

  try {
    cmwebsLogLineMessage_({
      direction:
        'outgoing',

      source:
        notification.source ||
        'workspace_notification',

      landlord_line_user_id:
        recipient.line_user_id ||
        '',

      tenant_line_user_id:
        '',

      tenant_id:
        '',

      tenant_user_id:
        '',

      tenant_name:
        '',

      room_list:
        '',

      message_type:
        'workspace_' +
        notification.event_type,

      message_text:
        workspaceNotificationLineText_(
          notification,
          recipient
        ),

      status:
        delivery.delivery_status ===
          'sent'
          ? 'success'
          : 'failed',

      note:
        'notification_id=' +
        notification.notification_id +
        (
          delivery.last_error
            ? ', error=' +
              delivery.last_error
            : ''
        )
    });

  } catch (error) {
    // LINE 紀錄失敗不阻擋通知。
  }
}


// ==================================================
// Preferences and event config
// ==================================================

function workspaceNotificationPreferenceEnabled_(
  ss,
  workspaceId,
  preferenceKey
) {
  if (!preferenceKey) {
    return true;
  }

  const setting =
    workspaceNotificationFind_(
      ss.getSheetByName(
        V2_WORKSPACE_NOTIFICATION_SHEETS_
          .settings
      ),
      'workspace_id',
      workspaceId
    ) ||
    {};

  return workspaceNotificationBooleanDefault_(
    setting[
      preferenceKey
    ],
    V2_WORKSPACE_NOTIFICATION_DEFAULTS_[
      preferenceKey
    ] !==
    false
  );
}


function workspaceNotificationEventConfig_(
  eventType
) {
  const configs = {
    payment_report: {
      label:
        '付款回報',

      category:
        'payment',

      preference_key:
        'notify_payment_report',

      roles: [
        'owner',
        'admin',
        'manager',
        'accountant'
      ],

      permissions: [
        'can_approve_payment'
      ]
    },

    contract: {
      label:
        '租約事件',

      category:
        'contract',

      preference_key:
        'notify_contract',

      roles: [
        'owner',
        'admin',
        'manager'
      ],

      permissions: [
        'can_edit_contract',
        'can_terminate_contract'
      ]
    },

    tenant_message: {
      label:
        '房客訊息',

      category:
        'message',

      preference_key:
        'notify_tenant_message',

      roles: [
        'owner',
        'admin',
        'manager',
        'maintenance'
      ],

      permissions: []
    },

    bill_created: {
      label:
        '帳單事件',

      category:
        'billing',

      preference_key:
        'notify_bill_created',

      roles: [
        'owner',
        'admin',
        'manager',
        'accountant'
      ],

      permissions: [
        'can_approve_payment'
      ]
    },

    overdue: {
      label:
        '欠款提醒',

      category:
        'overdue',

      preference_key:
        'notify_overdue',

      roles: [
        'owner',
        'admin',
        'manager',
        'accountant'
      ],

      permissions: [
        'can_approve_payment'
      ]
    },

    checkin: {
      label:
        '房客報到',

      category:
        'checkin',

      preference_key:
        'notify_checkin',

      roles: [
        'owner',
        'admin',
        'manager'
      ],

      permissions: []
    },

    announcement_result: {
      label:
        '公告結果',

      category:
        'announcement',

      preference_key:
        'notify_announcement_result',

      roles: [
        'owner',
        'admin',
        'manager'
      ],

      permissions: []
    },

    line_failure: {
      label:
        'LINE 發送異常',

      category:
        'system',

      preference_key:
        'notify_line_failure',

      roles: [
        'owner',
        'admin',
        'manager'
      ],

      permissions: []
    },

    system: {
      label:
        '系統通知',

      category:
        'system',

      preference_key:
        '',

      roles: [
        'owner',
        'admin',
        'manager'
      ],

      permissions: []
    }
  };

  return configs[
    eventType
  ] ||
  configs.system;
}


function workspaceNotificationEventOptions_() {
  return [
    {
      value:
        'all',
      label:
        '全部類型'
    },
    {
      value:
        'payment_report',
      label:
        '付款回報'
    },
    {
      value:
        'contract',
      label:
        '租約事件'
    },
    {
      value:
        'tenant_message',
      label:
        '房客訊息'
    },
    {
      value:
        'bill_created',
      label:
        '帳單事件'
    },
    {
      value:
        'overdue',
      label:
        '欠款提醒'
    },
    {
      value:
        'checkin',
      label:
        '房客報到'
    },
    {
      value:
        'announcement_result',
      label:
        '公告結果'
    },
    {
      value:
        'line_failure',
      label:
        'LINE 異常'
    }
  ];
}


// ==================================================
// Views
// ==================================================

function workspaceNotificationView_(
  item,
  delivery
) {
  const eventType =
    workspaceNotificationEventType_(
      item.event_type
    );

  const config =
    workspaceNotificationEventConfig_(
      eventType
    );

  const createdValue =
    workspaceNotificationDateValue_(
      item.created_at
    );

  return {
    notification_id:
      workspaceNotificationText_(
        item.notification_id
      ),

    event_type:
      eventType,

    event_label:
      workspaceNotificationText_(
        item.event_label ||
        config.label
      ),

    category:
      config.category,

    event_title:
      workspaceNotificationText_(
        item.event_title
      ),

    event_body:
      workspaceNotificationText_(
        item.event_body
      ),

    severity:
      workspaceNotificationSeverity_(
        item.severity
      ),

    target_type:
      workspaceNotificationText_(
        item.target_type
      ),

    target_id:
      workspaceNotificationText_(
        item.target_id
      ),

    action_url:
      workspaceNotificationText_(
        item.action_url
      ),

    preference_enabled:
      workspaceNotificationBooleanDefault_(
        item.preference_enabled,
        true
      ),

    recipient_count:
      workspaceNotificationNumber_(
        item.recipient_count
      ),

    sent_count:
      workspaceNotificationNumber_(
        item.sent_count
      ),

    failed_count:
      workspaceNotificationNumber_(
        item.failed_count
      ),

    skipped_count:
      workspaceNotificationNumber_(
        item.skipped_count
      ),

    status:
      workspaceNotificationStatus_(
        item.status
      ),

    status_label:
      workspaceNotificationStatusLabel_(
        item.status
      ),

    delivery_status:
      delivery
        ? workspaceNotificationText_(
            delivery.delivery_status
          )
        : 'center_only',

    read_status:
      delivery &&
      workspaceNotificationText_(
        delivery.read_status
      ).toLowerCase() ===
        'read'
        ? 'read'
        : 'unread',

    read_at:
      delivery
        ? workspaceNotificationDateText_(
            delivery.read_at
          )
        : '',

    created_at:
      workspaceNotificationDateText_(
        item.created_at
      ),

    created_at_value:
      createdValue
  };
}


function workspaceNotificationDeliveryView_(
  item
) {
  return {
    membership_id:
      item.membership_id ||
      '',

    user_id:
      item.user_id ||
      '',

    display_name:
      item.display_name ||
      '',

    role:
      item.role ||
      '',

    delivery_status:
      item.delivery_status ||
      '',

    delivered_at:
      workspaceNotificationDateText_(
        item.delivered_at
      ),

    last_error:
      item.last_error ||
      ''
  };
}


// ==================================================
// Schema and sheet helpers
// ==================================================

function workspaceNotificationEnsureSchema_() {
  if (
    typeof workspaceEnsureSchema_ ===
    'function'
  ) {
    workspaceEnsureSchema_();
  }

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  workspaceNotificationEnsureSheet_(
    ss,
    V2_WORKSPACE_NOTIFICATION_SHEETS_
      .notifications,
    [
      'notification_id',
      'workspace_id',
      'workspace_name',
      'event_type',
      'event_label',
      'event_title',
      'event_body',
      'severity',
      'target_type',
      'target_id',
      'action_url',
      'source',
      'preference_key',
      'preference_enabled',
      'created_by_user_id',
      'recipient_count',
      'sent_count',
      'failed_count',
      'skipped_count',
      'status',
      'metadata_json',
      'created_at',
      'updated_at'
    ]
  );

  workspaceNotificationEnsureSheet_(
    ss,
    V2_WORKSPACE_NOTIFICATION_SHEETS_
      .deliveries,
    [
      'delivery_id',
      'notification_id',
      'workspace_id',
      'membership_id',
      'user_id',
      'line_user_id',
      'display_name',
      'role',
      'delivery_status',
      'delivered_at',
      'read_status',
      'read_at',
      'send_count',
      'last_error',
      'created_at',
      'updated_at'
    ]
  );

  return true;
}


function workspaceNotificationEnsureSheet_(
  ss,
  sheetName,
  headers
) {
  let sheet =
    ss.getSheetByName(
      sheetName
    );

  if (!sheet) {
    if (
      typeof announcementEnsureCapacityForNewSheet_ ===
      'function'
    ) {
      announcementEnsureCapacityForNewSheet_(
        ss,
        sheetName
      );

    } else if (
      typeof systemSettingsCompactWorkbookCapacity_ ===
      'function'
    ) {
      systemSettingsCompactWorkbookCapacity_(
        ss
      );
    }

    sheet =
      ss.insertSheet(
        sheetName
      );

    const targetRows =
      100;

    const targetColumns =
      Math.max(
        headers.length,
        10
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
      headers.length
    ) {
      sheet.insertColumnsAfter(
        sheet.getMaxColumns(),
        headers.length -
        sheet.getMaxColumns()
      );
    }

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

  workspaceNotificationEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


function workspaceNotificationEnsureHeaders_(
  sheet,
  required
) {
  const existing =
    sheet
      .getRange(
        1,
        1,
        1,
        Math.max(
          sheet.getLastColumn(),
          1
        )
      )
      .getValues()[0]
      .map(
        workspaceNotificationText_
      );

  const missing =
    required.filter(
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
    missing.length >
    0
  ) {
    sheet
      .getRange(
        1,
        sheet.getLastColumn() +
        1,
        1,
        missing.length
      )
      .setValues([
        missing
      ]);
  }
}


function workspaceNotificationObjects_(
  sheet
) {
  if (!sheet) {
    return [];
  }

  if (
    typeof workspaceGetObjectsWithRow_ ===
    'function'
  ) {
    return workspaceGetObjectsWithRow_(
      sheet
    );
  }

  if (
    sheet.getLastRow() <
    2
  ) {
    return [];
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      workspaceNotificationText_
    );

  return values
    .slice(
      1
    )
    .map(
      function (row, index) {
        const item = {
          __row_number:
            index +
            2
        };

        headers.forEach(
          function (header, column) {
            item[
              header
            ] =
              row[
                column
              ];
          }
        );

        return item;
      }
    );
}


function workspaceNotificationFind_(
  sheet,
  header,
  value
) {
  const expected =
    workspaceNotificationText_(
      value
    ).toUpperCase();

  return workspaceNotificationObjects_(
    sheet
  ).find(
    function (item) {
      return (
        workspaceNotificationText_(
          item[
            header
          ]
        ).toUpperCase() ===
        expected
      );
    }
  ) ||
  null;
}


function workspaceNotificationAppend_(
  sheet,
  item
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
      .map(
        workspaceNotificationText_
      );

  sheet.appendRow(
    headers.map(
      function (header) {
        return item[
          header
        ] !==
          undefined
          ? item[
              header
            ]
          : '';
      }
    )
  );
}


function workspaceNotificationUpdateByKey_(
  sheet,
  keyHeader,
  keyValue,
  values
) {
  const item =
    workspaceNotificationFind_(
      sheet,
      keyHeader,
      keyValue
    );

  if (!item) {
    return false;
  }

  workspaceNotificationUpdateRow_(
    sheet,
    item.__row_number,
    values
  );

  return true;
}


function workspaceNotificationUpdateRow_(
  sheet,
  rowNumber,
  values
) {
  const lastColumn =
    sheet.getLastColumn();

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
        workspaceNotificationText_
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

      if (
        index >=
        0
      ) {
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


// ==================================================
// Normalization
// ==================================================

function workspaceNotificationResolveWorkspaceId_(
  ss,
  workspaceId,
  landlordId
) {
  workspaceId =
    workspaceNotificationText_(
      workspaceId
    ).toUpperCase();

  if (workspaceId) {
    return workspaceId;
  }

  landlordId =
    workspaceNotificationText_(
      landlordId
    );

  if (!landlordId) {
    return '';
  }

  const landlord =
    workspaceNotificationFind_(
      ss.getSheetByName(
        V2_WORKSPACE_NOTIFICATION_SHEETS_
          .landlords
      ),
      'landlord_id',
      landlordId
    );

  return landlord
    ? workspaceNotificationText_(
        landlord.workspace_id
      ).toUpperCase()
    : '';
}


function workspaceNotificationEventType_(
  value
) {
  const eventType =
    workspaceNotificationText_(
      value
    ).toLowerCase();

  return [
    'payment_report',
    'contract',
    'tenant_message',
    'bill_created',
    'overdue',
    'checkin',
    'announcement_result',
    'line_failure'
  ].indexOf(
    eventType
  ) >=
  0
    ? eventType
    : 'system';
}


function workspaceNotificationEventFilter_(
  value
) {
  const eventType =
    workspaceNotificationText_(
      value
    ).toLowerCase();

  return eventType ===
    'all'
    ? 'all'
    : workspaceNotificationEventType_(
        eventType
      );
}


function workspaceNotificationStatusFilter_(
  value
) {
  const status =
    workspaceNotificationText_(
      value
    ).toLowerCase();

  return [
    'all',
    'unread',
    'failed'
  ].indexOf(
    status
  ) >=
  0
    ? status
    : 'all';
}


function workspaceNotificationSeverity_(
  value
) {
  const severity =
    workspaceNotificationText_(
      value
    ).toLowerCase();

  return [
    'normal',
    'info',
    'warning',
    'urgent',
    'error'
  ].indexOf(
    severity
  ) >=
  0
    ? severity
    : 'normal';
}


function workspaceNotificationStatus_(
  value
) {
  const status =
    workspaceNotificationText_(
      value
    ).toLowerCase();

  return [
    'sent',
    'partial',
    'failed',
    'stored_only',
    'stored'
  ].indexOf(
    status
  ) >=
  0
    ? status
    : 'stored';
}


function workspaceNotificationStatusLabel_(
  value
) {
  const labels = {
    sent:
      '已送達',

    partial:
      '部分送達',

    failed:
      '發送失敗',

    stored_only:
      '僅通知中心',

    stored:
      '已記錄'
  };

  return labels[
    workspaceNotificationStatus_(
      value
    )
  ];
}


function workspaceNotificationActive_(
  value
) {
  return [
    'active',
    'enabled',
    'joined',
    'accepted',
    '啟用'
  ].indexOf(
    workspaceNotificationText_(
      value ||
      'active'
    ).toLowerCase()
  ) >=
  0;
}


function workspaceNotificationBoolean_(
  value
) {
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
    workspaceNotificationText_(
      value
    ).toLowerCase()
  ) >=
  0;
}


function workspaceNotificationBooleanDefault_(
  value,
  fallback
) {
  if (
    value ===
      '' ||
    value ===
      undefined ||
    value ===
      null
  ) {
    return fallback;
  }

  return workspaceNotificationBoolean_(
    value
  );
}


function workspaceNotificationNumber_(
  value
) {
  const number =
    Number(
      workspaceNotificationText_(
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


function workspaceNotificationDateValue_(
  value
) {
  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return value.getTime();
  }

  const parsed =
    new Date(
      value
    );

  return Number.isNaN(
    parsed.getTime()
  )
    ? 0
    : parsed.getTime();
}


function workspaceNotificationDateText_(
  value
) {
  if (!value) {
    return '';
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          value
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return workspaceNotificationText_(
      value
    );
  }

  return Utilities.formatDate(
    date,
    'Asia/Taipei',
    'yyyy/MM/dd HH:mm'
  );
}


function workspaceNotificationJson_(
  value
) {
  try {
    return JSON.stringify(
      value ||
      {}
    );
  } catch (error) {
    return '{}';
  }
}


function workspaceNotificationId_(
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


function workspaceNotificationText_(
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


function workspaceNotificationResult_(
  success,
  code,
  message,
  data
) {
  if (
    typeof workspaceResult_ ===
    'function'
  ) {
    return workspaceResult_(
      success,
      code,
      message,
      data
    );
  }

  return {
    success:
      success ===
      true,

    code:
      code ||
      '',

    message:
      message ||
      '',

    data:
      data ||
      {}
  };
}


// ==================================================
// Tests
// ==================================================

function testEnsureWorkspaceNotificationSchema() {
  workspaceNotificationEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const result = {
    success:
      true,

    notification_columns:
      ss.getSheetByName(
        V2_WORKSPACE_NOTIFICATION_SHEETS_
          .notifications
      ).getLastColumn(),

    delivery_columns:
      ss.getSheetByName(
        V2_WORKSPACE_NOTIFICATION_SHEETS_
          .deliveries
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


function testWorkspaceNotificationRecipients() {
  workspaceNotificationEnsureSchema_();

  const access =
    workspaceLandlordResolveAccess_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      {
        require_onboarding:
          true
      }
    );

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const workspaceId =
    access &&
    access.success
      ? workspaceNotificationText_(
          access.workspace
            .workspace_id
        ).toUpperCase()
      : '';

  const config =
    workspaceNotificationEventConfig_(
      'payment_report'
    );

  const result = {
    success:
      Boolean(
        workspaceId
      ),

    workspace_id:
      workspaceId,

    preference_enabled:
      workspaceNotificationPreferenceEnabled_(
        ss,
        workspaceId,
        config.preference_key
      ),

    recipients:
      workspaceNotificationRecipients_(
        ss,
        workspaceId,
        config,
        {}
      )
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


function testLandlordNotificationsInit() {
  const result =
    getLandlordNotificationsInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      'all',
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
