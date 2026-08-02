/**
 * CMWebs V2 房客報到管理
 *
 * API:
 * - landlord_tenant_checkins_init
 * - landlord_tenant_checkin_save
 * - landlord_tenant_checkin_send_welcome
 *
 * 功能：
 * - 依目前 Workspace 列出有效／即將開始的租約。
 * - 顯示 LINE 綁定、預定入住日、鑰匙交付與報到狀態。
 * - 建立獨立 V2_tenant_checkins 紀錄，並同步租約與 view。
 * - 對已完成 LINE 綁定的房客發送入住通知。
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 * - V2_WORKSPACE_LANDLORD_ACCESS.gs
 * - V2_WORKSPACE_OPERATION_AUDIT.gs（選用）
 */

const V2_TENANT_CHECKIN_SHEETS_ = {
  checkins:
    'V2_tenant_checkins',
  contracts:
    'V2_contracts',
  tenants:
    'V2_tenants',
  users:
    'V2_users',
  properties:
    'V2_properties',
  rooms:
    'V2_rooms',
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

const V2_TENANT_CHECKIN_LIFF_URL_ =
  'https://liff.line.me/2010314940-iJB1D6sN';


/**
 * 房客報到管理頁初始化。
 */
function getLandlordTenantCheckinsInitByLineUid_(
  lineUserId,
  propertyId,
  statusFilter
) {
  try {
    tenantCheckinEnsureSchema_();

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

    propertyId =
      tenantCheckinText_(
        propertyId
      );

    statusFilter =
      tenantCheckinNormalizeFilter_(
        statusFilter
      );

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const data =
      tenantCheckinLoadData_(
        ss,
        access
      );

    const propertyMap = {};
    const roomMap = {};
    const tenantMap = {};
    const userMap = {};
    const checkinMap = {};

    data.properties.forEach(
      function (property) {
        propertyMap[
          tenantCheckinText_(
            property.property_id
          )
        ] =
          property;
      }
    );

    data.rooms.forEach(
      function (room) {
        roomMap[
          tenantCheckinText_(
            room.room_id
          )
        ] =
          room;
      }
    );

    data.tenants.forEach(
      function (tenant) {
        tenantMap[
          tenantCheckinText_(
            tenant.tenant_id
          ).toUpperCase()
        ] =
          tenant;
      }
    );

    data.users.forEach(
      function (user) {
        userMap[
          tenantCheckinText_(
            user.user_id
          )
        ] =
          user;
      }
    );

    data.checkins.forEach(
      function (checkin) {
        const contractId =
          tenantCheckinText_(
            checkin.contract_id
          );

        if (!contractId) {
          return;
        }

        const existing =
          checkinMap[
            contractId
          ];

        if (
          !existing ||
          tenantCheckinRowTime_(
            checkin
          ) >=
          tenantCheckinRowTime_(
            existing
          )
        ) {
          checkinMap[
            contractId
          ] =
            checkin;
        }
      }
    );

    let items =
      data.contracts
        .filter(
          tenantCheckinContractVisible_
        )
        .map(
          function (contract) {
            const contractId =
              tenantCheckinText_(
                contract.contract_id
              );

            const tenantId =
              tenantCheckinText_(
                contract.tenant_id
              ).toUpperCase();

            const tenantUserId =
              tenantCheckinText_(
                contract.tenant_user_id
              );

            const roomId =
              tenantCheckinText_(
                contract.room_id
              );

            const room =
              roomMap[
                roomId
              ] ||
              {};

            const propertyIdValue =
              tenantCheckinText_(
                contract.property_id ||
                room.property_id
              );

            const property =
              propertyMap[
                propertyIdValue
              ] ||
              {};

            const tenant =
              tenantMap[
                tenantId
              ] ||
              {};

            const user =
              userMap[
                tenantUserId
              ] ||
              {};

            const checkin =
              checkinMap[
                contractId
              ] ||
              {};

            const binding =
              tenantCheckinResolveLineBinding_(
                data,
                contract,
                tenant,
                user
              );

            return tenantCheckinBuildItem_(
              access,
              contract,
              tenant,
              user,
              room,
              property,
              checkin,
              binding
            );
          }
        );

    const properties =
      data.properties
        .map(
          function (property) {
            return {
              property_id:
                tenantCheckinText_(
                  property.property_id
                ),
              property_name:
                tenantCheckinText_(
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
            return tenantCheckinCompareText_(
              a.property_name,
              b.property_name
            );
          }
        );

    if (
      propertyId &&
      !properties.some(
        function (property) {
          return (
            property.property_id ===
            propertyId
          );
        }
      )
    ) {
      propertyId =
        '';
    }

    if (propertyId) {
      items =
        items.filter(
          function (item) {
            return (
              item.property_id ===
              propertyId
            );
          }
        );
    }

    if (
      statusFilter !==
      'all'
    ) {
      items =
        items.filter(
          function (item) {
            return (
              item.display_status ===
              statusFilter
            );
          }
        );
    }

    items.sort(
      function (a, b) {
        const statusOrder = {
          ready:
            1,
          unbound:
            2,
          pending:
            3,
          upcoming:
            4,
          completed:
            5,
          cancelled:
            6
        };

        const orderCompare =
          (
            statusOrder[
              a.display_status
            ] ||
            99
          ) -
          (
            statusOrder[
              b.display_status
            ] ||
            99
          );

        if (
          orderCompare !==
          0
        ) {
          return orderCompare;
        }

        const dateCompare =
          tenantCheckinText_(
            a.contract_start_date
          ).localeCompare(
            tenantCheckinText_(
              b.contract_start_date
            )
          );

        if (
          dateCompare !==
          0
        ) {
          return dateCompare;
        }

        const propertyCompare =
          tenantCheckinCompareText_(
            a.property_name,
            b.property_name
          );

        if (
          propertyCompare !==
          0
        ) {
          return propertyCompare;
        }

        return tenantCheckinCompareText_(
          a.room_name,
          b.room_name
        );
      }
    );

    const allItems =
      data.contracts
        .filter(
          tenantCheckinContractVisible_
        )
        .map(
          function (contract) {
            const contractId =
              tenantCheckinText_(
                contract.contract_id
              );

            const tenantId =
              tenantCheckinText_(
                contract.tenant_id
              ).toUpperCase();

            const tenantUserId =
              tenantCheckinText_(
                contract.tenant_user_id
              );

            const room =
              roomMap[
                tenantCheckinText_(
                  contract.room_id
                )
              ] ||
              {};

            const property =
              propertyMap[
                tenantCheckinText_(
                  contract.property_id ||
                  room.property_id
                )
              ] ||
              {};

            const tenant =
              tenantMap[
                tenantId
              ] ||
              {};

            const user =
              userMap[
                tenantUserId
              ] ||
              {};

            const checkin =
              checkinMap[
                contractId
              ] ||
              {};

            return tenantCheckinBuildItem_(
              access,
              contract,
              tenant,
              user,
              room,
              property,
              checkin,
              tenantCheckinResolveLineBinding_(
                data,
                contract,
                tenant,
                user
              )
            );
          }
        );

    const summary = {
      total_count:
        allItems.length,
      ready_count:
        allItems.filter(
          function (item) {
            return (
              item.display_status ===
              'ready'
            );
          }
        ).length,
      pending_count:
        allItems.filter(
          function (item) {
            return (
              item.display_status ===
              'pending'
            );
          }
        ).length,
      upcoming_count:
        allItems.filter(
          function (item) {
            return (
              item.display_status ===
              'upcoming'
            );
          }
        ).length,
      completed_count:
        allItems.filter(
          function (item) {
            return (
              item.display_status ===
              'completed'
            );
          }
        ).length,
      unbound_count:
        allItems.filter(
          function (item) {
            return (
              item.display_status ===
              'unbound'
            );
          }
        ).length
    };

    return workspaceResult_(
      true,
      'OK',
      '房客報到資料載入成功',
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

        can_manage:
          tenantCheckinCanManage_(
            access
          ),

        tenant_liff_url:
          V2_TENANT_CHECKIN_LIFF_URL_,

        selected_property_id:
          propertyId,

        status_filter:
          statusFilter,

        properties:
          properties,

        summary:
          summary,

        items:
          items
      }
    );

  } catch (error) {
    return workspaceResult_(
      false,
      'TENANT_CHECKINS_INIT_ERROR',
      '房客報到資料載入失敗：' +
        error.message
    );
  }
}


/**
 * 新增或更新報到紀錄。
 */
function saveLandlordTenantCheckinByLineUid_(
  lineUserId,
  contractId,
  scheduledDate,
  checkinStatus,
  keyHandoverStatus,
  firstMeterReading,
  note
) {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    tenantCheckinEnsureSchema_();

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
      tenantCheckinRequireManage_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    contractId =
      tenantCheckinText_(
        contractId
      );

    scheduledDate =
      tenantCheckinNormalizeDateText_(
        scheduledDate
      );

    checkinStatus =
      tenantCheckinNormalizeStatus_(
        checkinStatus
      );

    keyHandoverStatus =
      tenantCheckinNormalizeKeyStatus_(
        keyHandoverStatus
      );

    note =
      tenantCheckinText_(
        note
      ).slice(
        0,
        1000
      );

    if (!contractId) {
      return workspaceResult_(
        false,
        'CONTRACT_ID_REQUIRED',
        '缺少租約編號'
      );
    }

    if (
      firstMeterReading !==
        '' &&
      firstMeterReading !==
        null &&
      firstMeterReading !==
        undefined
    ) {
      firstMeterReading =
        tenantCheckinNumber_(
          firstMeterReading
        );

      if (
        firstMeterReading <
        0
      ) {
        return workspaceResult_(
          false,
          'INVALID_FIRST_METER',
          '入住電錶不得小於 0'
        );
      }
    } else {
      firstMeterReading =
        '';
    }

    lock.waitLock(
      25000
    );

    locked =
      true;

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const contractSheet =
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .contracts
      );

    const contracts =
      tenantCheckinGetWorkspaceRows_(
        contractSheet,
        access
      );

    const contract =
      contracts.find(
        function (row) {
          return (
            tenantCheckinText_(
              row.contract_id
            ) ===
            contractId
          );
        }
      );

    if (!contract) {
      return workspaceResult_(
        false,
        'CONTRACT_NOT_FOUND',
        '找不到租約或目前團隊無權限存取'
      );
    }

    const checkinSheet =
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .checkins
      );

    const checkins =
      tenantCheckinGetWorkspaceRows_(
        checkinSheet,
        access
      );

    const existing =
      checkins.find(
        function (row) {
          return (
            tenantCheckinText_(
              row.contract_id
            ) ===
            contractId
          );
        }
      ) ||
      null;

    const now =
      new Date();

    const actor = {
      user_id:
        access.user.user_id ||
        '',
      membership_id:
        access.membership
          .membership_id ||
        ''
    };

    const checkedInAt =
      checkinStatus ===
        'completed'
        ? (
            existing &&
            existing.checked_in_at
              ? existing.checked_in_at
              : now
          )
        : '';

    const values = {
      checkin_id:
        existing
          ? existing.checkin_id
          : tenantCheckinGenerateId_(),

      workspace_id:
        tenantCheckinText_(
          access.workspace
            .workspace_id
        ).toUpperCase(),

      landlord_id:
        tenantCheckinText_(
          contract.landlord_id ||
          access.principal_landlord_id
        ),

      contract_id:
        contractId,

      tenant_id:
        tenantCheckinText_(
          contract.tenant_id
        ),

      tenant_user_id:
        tenantCheckinText_(
          contract.tenant_user_id
        ),

      tenant_name:
        tenantCheckinText_(
          contract.tenant_name
        ),

      tenant_phone:
        tenantCheckinText_(
          contract.tenant_phone
        ),

      tenant_line_user_id:
        tenantCheckinText_(
          contract.tenant_line_user_id
        ),

      property_id:
        tenantCheckinText_(
          contract.property_id
        ),

      property_name:
        tenantCheckinText_(
          contract.property_name
        ),

      room_id:
        tenantCheckinText_(
          contract.room_id
        ),

      room_name:
        tenantCheckinText_(
          contract.room_name
        ),

      contract_start_date:
        tenantCheckinFormatDate_(
          contract.start_date ||
          contract.contract_start_date
        ),

      contract_end_date:
        tenantCheckinFormatDate_(
          contract.end_date ||
          contract.contract_end_date
        ),

      scheduled_checkin_date:
        scheduledDate,

      checkin_status:
        checkinStatus,

      checked_in_at:
        checkedInAt,

      checked_in_by_user_id:
        checkinStatus ===
          'completed'
          ? actor.user_id
          : '',

      checked_in_by_membership_id:
        checkinStatus ===
          'completed'
          ? actor.membership_id
          : '',

      key_handover_status:
        keyHandoverStatus,

      first_meter_reading:
        firstMeterReading,

      note:
        note,

      created_by_user_id:
        existing
          ? existing.created_by_user_id ||
            actor.user_id
          : actor.user_id,

      created_by_membership_id:
        existing
          ? existing.created_by_membership_id ||
            actor.membership_id
          : actor.membership_id,

      created_at:
        existing
          ? existing.created_at ||
            now
          : now,

      updated_at:
        now
    };

    if (existing) {
      tenantCheckinSetRowValues_(
        checkinSheet,
        existing.__row_number,
        values
      );
    } else {
      tenantCheckinAppendObject_(
        checkinSheet,
        values
      );
    }

    const contractSync = {
      checkin_status:
        checkinStatus,
      scheduled_checkin_date:
        scheduledDate,
      checked_in_at:
        checkedInAt,
      key_handover_status:
        keyHandoverStatus,
      checkin_note:
        note,
      checkin_updated_at:
        now
    };

    tenantCheckinSetRowValues_(
      contractSheet,
      contract.__row_number,
      contractSync
    );

    tenantCheckinSyncViews_(
      ss,
      contractId,
      contract.tenant_id,
      contractSync
    );

    SpreadsheetApp.flush();

    const result =
      workspaceResult_(
        true,
        'TENANT_CHECKIN_SAVED',
        checkinStatus ===
          'completed'
          ? '房客報到已完成'
          : (
              checkinStatus ===
                'cancelled'
                ? '房客報到已取消'
                : '房客報到資料已儲存'
            ),
        {
          checkin_id:
            values.checkin_id,
          contract_id:
            contractId,
          checkin_status:
            checkinStatus,
          checked_in_at:
            tenantCheckinFormatDateTime_(
              checkedInAt
            ),
          scheduled_checkin_date:
            scheduledDate,
          key_handover_status:
            keyHandoverStatus,
          first_meter_reading:
            firstMeterReading,
          note:
            note
        }
      );

    tenantCheckinAudit_(
      access,
      'landlord_tenant_checkin_save',
      result,
      {
        target_type:
          'contract',
        target_id:
          contractId,
        operation_status:
          'success',
        detail:
          'status=' +
          checkinStatus +
          ', key=' +
          keyHandoverStatus
      }
    );

    if (
      typeof workspaceNotifyTeam_ ===
      'function'
    ) {
      try {
        const title =
          checkinStatus ===
            'completed'
            ? '房客報到已完成'
            : (
                checkinStatus ===
                  'cancelled'
                  ? '房客報到已取消'
                  : '房客報到資料已更新'
              );

        const bodyLines = [
          '房客：' +
            (
              values.tenant_name ||
              values.tenant_id ||
              '-'
            ),
          '物件／房間：' +
            (
              values.property_name ||
              '-'
            ) +
            '／' +
            (
              values.room_name ||
              '-'
            ),
          '預定入住日：' +
            (
              scheduledDate ||
              '-'
            ),
          '報到狀態：' +
            checkinStatus,
          '鑰匙交付：' +
            keyHandoverStatus
        ];

        if (
          firstMeterReading !==
            ''
        ) {
          bodyLines.push(
            '入住電錶：' +
            firstMeterReading
          );
        }

        const notification =
          workspaceNotifyTeam_({
            workspace_id:
              values.workspace_id,

            landlord_id:
              values.landlord_id,

            event_type:
              'checkin',

            title:
              title,

            body:
              bodyLines.join(
                '\n'
              ),

            target_type:
              'tenant_checkin',

            target_id:
              values.checkin_id,

            action_url:
              'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-tenant-checkin.html',

            severity:
              checkinStatus ===
                'cancelled'
                ? 'warning'
                : 'info',

            source:
              'landlord_tenant_checkin_save',

            created_by_user_id:
              actor.user_id,

            metadata: {
              contract_id:
                contractId,

              tenant_id:
                values.tenant_id,

              room_id:
                values.room_id,

              checkin_status:
                checkinStatus,

              key_handover_status:
                keyHandoverStatus
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
            'CHECKIN_TEAM_NOTIFICATION_ERROR',

          message:
            notificationError.message
        };
      }
    }

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'TENANT_CHECKIN_SAVE_ERROR',
      '房客報到儲存失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * 發送入住報到 LINE 通知。
 */
function sendLandlordTenantCheckinWelcomeByLineUid_(
  lineUserId,
  contractId
) {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    tenantCheckinEnsureSchema_();

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
      tenantCheckinRequireManage_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    contractId =
      tenantCheckinText_(
        contractId
      );

    if (!contractId) {
      return workspaceResult_(
        false,
        'CONTRACT_ID_REQUIRED',
        '缺少租約編號'
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
      tenantCheckinLoadData_(
        ss,
        access
      );

    const contract =
      data.contracts.find(
        function (row) {
          return (
            tenantCheckinText_(
              row.contract_id
            ) ===
            contractId
          );
        }
      );

    if (!contract) {
      return workspaceResult_(
        false,
        'CONTRACT_NOT_FOUND',
        '找不到租約或目前團隊無權限存取'
      );
    }

    const tenantId =
      tenantCheckinText_(
        contract.tenant_id
      ).toUpperCase();

    const tenantUserId =
      tenantCheckinText_(
        contract.tenant_user_id
      );

    const tenant =
      data.tenants.find(
        function (row) {
          return (
            tenantCheckinText_(
              row.tenant_id
            ).toUpperCase() ===
            tenantId
          );
        }
      ) ||
      {};

    const user =
      data.users.find(
        function (row) {
          return (
            tenantCheckinText_(
              row.user_id
            ) ===
            tenantUserId
          );
        }
      ) ||
      {};

    const binding =
      tenantCheckinResolveLineBinding_(
        data,
        contract,
        tenant,
        user
      );

    if (
      binding.conflict
    ) {
      return workspaceResult_(
        false,
        'TENANT_LINE_BINDING_CONFLICT',
        '此房客找到多個 LINE UID，請先確認綁定資料'
      );
    }

    if (
      !binding.line_user_id
    ) {
      return workspaceResult_(
        false,
        'TENANT_LINE_UNBOUND',
        '房客尚未完成 LINE 綁定'
      );
    }

    const property =
      data.properties.find(
        function (row) {
          return (
            tenantCheckinText_(
              row.property_id
            ) ===
            tenantCheckinText_(
              contract.property_id
            )
          );
        }
      ) ||
      {};

    const room =
      data.rooms.find(
        function (row) {
          return (
            tenantCheckinText_(
              row.room_id
            ) ===
            tenantCheckinText_(
              contract.room_id
            )
          );
        }
      ) ||
      {};

    const checkinSheet =
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .checkins
      );

    const checkins =
      tenantCheckinGetWorkspaceRows_(
        checkinSheet,
        access
      );

    let checkin =
      checkins.find(
        function (row) {
          return (
            tenantCheckinText_(
              row.contract_id
            ) ===
            contractId
          );
        }
      ) ||
      null;

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

    const item =
      tenantCheckinBuildItem_(
        access,
        contract,
        tenant,
        user,
        room,
        property,
        checkin ||
        {},
        binding
      );

    const message =
      tenantCheckinBuildWelcomeMessage_(
        item
      );

    const response =
      UrlFetchApp.fetch(
        'https://api.line.me/v2/bot/message/push',
        {
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
                binding.line_user_id,
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
      );

    const statusCode =
      response.getResponseCode();

    const responseText =
      response.getContentText();

    const now =
      new Date();

    if (!checkin) {
      const values = {
        checkin_id:
          tenantCheckinGenerateId_(),
        workspace_id:
          tenantCheckinText_(
            access.workspace
              .workspace_id
          ).toUpperCase(),
        landlord_id:
          tenantCheckinText_(
            contract.landlord_id ||
            access.principal_landlord_id
          ),
        contract_id:
          contractId,
        tenant_id:
          contract.tenant_id ||
          '',
        tenant_user_id:
          contract.tenant_user_id ||
          '',
        tenant_name:
          contract.tenant_name ||
          '',
        tenant_phone:
          contract.tenant_phone ||
          '',
        tenant_line_user_id:
          binding.line_user_id,
        property_id:
          contract.property_id ||
          '',
        property_name:
          property.property_name ||
          contract.property_name ||
          '',
        room_id:
          contract.room_id ||
          '',
        room_name:
          room.room_name ||
          contract.room_name ||
          '',
        contract_start_date:
          tenantCheckinFormatDate_(
            contract.start_date ||
            contract.contract_start_date
          ),
        contract_end_date:
          tenantCheckinFormatDate_(
            contract.end_date ||
            contract.contract_end_date
          ),
        scheduled_checkin_date:
          tenantCheckinFormatDate_(
            contract.start_date ||
            contract.contract_start_date
          ),
        checkin_status:
          'pending',
        key_handover_status:
          'pending',
        welcome_sent_status:
          '',
        welcome_send_count:
          0,
        created_by_user_id:
          access.user.user_id ||
          '',
        created_by_membership_id:
          access.membership
            .membership_id ||
          '',
        created_at:
          now,
        updated_at:
          now
      };

      tenantCheckinAppendObject_(
        checkinSheet,
        values
      );

      checkin =
        tenantCheckinGetWorkspaceRows_(
          checkinSheet,
          access
        ).find(
          function (row) {
            return (
              tenantCheckinText_(
                row.checkin_id
              ) ===
              values.checkin_id
            );
          }
        ) ||
        null;
    }

    const currentCount =
      Math.max(
        0,
        Math.round(
          tenantCheckinNumber_(
            checkin
              ? checkin.welcome_send_count
              : 0
          )
        )
      );

    const success =
      statusCode >= 200 &&
      statusCode < 300;

    const statusValues = {
      tenant_line_user_id:
        binding.line_user_id,
      welcome_sent_status:
        success
          ? 'sent'
          : 'failed',
      welcome_sent_at:
        success
          ? now
          : (
              checkin
                ? checkin.welcome_sent_at
                : ''
            ),
      welcome_last_attempt_at:
        now,
      welcome_send_count:
        success
          ? currentCount + 1
          : currentCount,
      welcome_last_error:
        success
          ? ''
          : (
              'HTTP ' +
              statusCode +
              ' / ' +
              responseText
            ),
      updated_at:
        now
    };

    if (
      checkin &&
      checkin.__row_number
    ) {
      tenantCheckinSetRowValues_(
        checkinSheet,
        checkin.__row_number,
        statusValues
      );
    }

    tenantCheckinSyncLineUid_(
      ss,
      contract,
      binding.line_user_id,
      now
    );

    tenantCheckinAppendLineLog_(
      ss,
      access,
      item,
      message,
      success
        ? 'success'
        : 'failed',
      success
        ? 'HTTP ' +
          statusCode
        : statusValues
            .welcome_last_error
    );

    SpreadsheetApp.flush();

    if (!success) {
      let teamNotification =
        null;

      if (
        typeof workspaceNotifyTeam_ ===
        'function'
      ) {
        try {
          teamNotification =
            workspaceNotifyTeam_({
              workspace_id:
                tenantCheckinText_(
                  access.workspace &&
                  access.workspace
                    .workspace_id
                ),

              landlord_id:
                tenantCheckinText_(
                  contract.landlord_id ||
                  access.principal_landlord_id
                ),

              event_type:
                'line_failure',

              title:
                '入住通知 LINE 發送失敗',

              body:
                [
                  '房客：' +
                    (
                      item.tenant_name ||
                      tenantId ||
                      '-'
                    ),
                  '房間：' +
                    (
                      item.room_name ||
                      '-'
                    ),
                  'HTTP 狀態：' +
                    statusCode,
                  '錯誤內容：' +
                    responseText
                ].join(
                  '\n'
                ),

              target_type:
                'tenant_checkin',

              target_id:
                contractId,

              action_url:
                'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-tenant-checkin.html',

              severity:
                'error',

              source:
                'landlord_tenant_checkin_send_welcome',

              metadata: {
                contract_id:
                  contractId,

                tenant_id:
                  tenantId,

                status_code:
                  statusCode
              }
            });

        } catch (notificationError) {
          teamNotification = {
            success:
              false,

            message:
              notificationError.message
          };
        }
      }

      return workspaceResult_(
        false,
        'TENANT_CHECKIN_WELCOME_SEND_FAILED',
        '入住通知發送失敗：HTTP ' +
          statusCode,
        {
          status_code:
            statusCode,

          response:
            responseText,

          team_notification:
            teamNotification &&
            teamNotification.data
              ? teamNotification.data
              : teamNotification
        }
      );
    }

    const result =
      workspaceResult_(
        true,
        'TENANT_CHECKIN_WELCOME_SENT',
        currentCount > 0
          ? '入住通知已重新發送'
          : '入住通知已發送',
        {
          contract_id:
            contractId,
          tenant_line_user_id:
            binding.line_user_id,
          welcome_send_count:
            currentCount + 1,
          welcome_sent_at:
            tenantCheckinFormatDateTime_(
              now
            )
        }
      );

    tenantCheckinAudit_(
      access,
      'landlord_tenant_checkin_send_welcome',
      result,
      {
        target_type:
          'contract',
        target_id:
          contractId,
        operation_status:
          'success',
        detail:
          'tenant_id=' +
          tenantId
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'TENANT_CHECKIN_WELCOME_ERROR',
      '入住通知發送失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


// ==================================================
// Data loading and item building
// ==================================================

function tenantCheckinLoadData_(
  ss,
  access
) {
  const properties =
    tenantCheckinGetWorkspaceRows_(
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .properties
      ),
      access
    ).filter(
      function (row) {
        return (
          tenantCheckinText_(
            row.account_status ||
            row.property_status ||
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
        tenantCheckinText_(
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
    tenantCheckinGetWorkspaceRows_(
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .rooms
      ),
      access,
      propertyIdMap
    );

  const contracts =
    tenantCheckinGetWorkspaceRows_(
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .contracts
      ),
      access,
      propertyIdMap
    );

  const bills =
    tenantCheckinGetWorkspaceRows_(
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .bills
      ),
      access,
      propertyIdMap
    );

  const tenantHomeRows =
    tenantCheckinGetWorkspaceRows_(
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .tenantHomeView
      ),
      access,
      propertyIdMap
    );

  const tenantListRows =
    tenantCheckinGetWorkspaceRows_(
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .landlordTenantListView
      ),
      access,
      propertyIdMap
    );

  const tenantBillRows =
    tenantCheckinGetWorkspaceRows_(
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .tenantBillView
      ),
      access,
      propertyIdMap
    );

  const relevantTenantIds = {};
  const relevantUserIds = {};

  contracts.forEach(
    function (contract) {
      const tenantId =
        tenantCheckinText_(
          contract.tenant_id
        ).toUpperCase();

      const userId =
        tenantCheckinText_(
          contract.tenant_user_id
        );

      if (tenantId) {
        relevantTenantIds[
          tenantId
        ] = true;
      }

      if (userId) {
        relevantUserIds[
          userId
        ] = true;
      }
    }
  );

  const tenantSheet =
    ss.getSheetByName(
      V2_TENANT_CHECKIN_SHEETS_
        .tenants
    );

  const tenants =
    tenantSheet
      ? workspaceGetObjectsWithRow_(
          tenantSheet
        ).filter(
          function (tenant) {
            const tenantId =
              tenantCheckinText_(
                tenant.tenant_id
              ).toUpperCase();

            return (
              relevantTenantIds[
                tenantId
              ] ||
              tenantCheckinRowMatchesWorkspace_(
                tenant,
                access,
                propertyIdMap
              )
            );
          }
        )
      : [];

  tenants.forEach(
    function (tenant) {
      const userId =
        tenantCheckinText_(
          tenant.tenant_user_id ||
          tenant.user_id
        );

      if (userId) {
        relevantUserIds[
          userId
        ] = true;
      }
    }
  );

  const userSheet =
    ss.getSheetByName(
      V2_TENANT_CHECKIN_SHEETS_
        .users
    );

  const users =
    userSheet
      ? workspaceGetObjectsWithRow_(
          userSheet
        ).filter(
          function (user) {
            return Boolean(
              relevantUserIds[
                tenantCheckinText_(
                  user.user_id
                )
              ]
            );
          }
        )
      : [];

  const checkins =
    tenantCheckinGetWorkspaceRows_(
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .checkins
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
    bills:
      bills,
    tenant_home_rows:
      tenantHomeRows,
    tenant_list_rows:
      tenantListRows,
    tenant_bill_rows:
      tenantBillRows,
    checkins:
      checkins
  };
}


function tenantCheckinBuildItem_(
  access,
  contract,
  tenant,
  user,
  room,
  property,
  checkin,
  binding
) {
  const contractStartDate =
    tenantCheckinFormatDate_(
      contract.start_date ||
      contract.contract_start_date
    );

  const contractEndDate =
    tenantCheckinFormatDate_(
      contract.end_date ||
      contract.contract_end_date
    );

  const today =
    tenantCheckinToday_();

  const startDate =
    tenantCheckinDate_(
      contractStartDate
    );

  const storedStatus =
    tenantCheckinNormalizeStatus_(
      checkin.checkin_status ||
      contract.checkin_status ||
      'pending'
    );

  const scheduledDate =
    tenantCheckinFormatDate_(
      checkin.scheduled_checkin_date ||
      contract.scheduled_checkin_date ||
      contractStartDate
    );

  const scheduledDateValue =
    tenantCheckinDate_(
      scheduledDate
    );

  let displayStatus =
    'pending';

  if (
    storedStatus ===
    'completed'
  ) {
    displayStatus =
      'completed';

  } else if (
    storedStatus ===
    'cancelled'
  ) {
    displayStatus =
      'cancelled';

  } else if (
    !binding.line_user_id
  ) {
    displayStatus =
      'unbound';

  } else if (
    startDate &&
    startDate.getTime() >
      today.getTime()
  ) {
    displayStatus =
      'upcoming';

  } else if (
    scheduledDateValue &&
    scheduledDateValue.getTime() >
      today.getTime()
  ) {
    displayStatus =
      'pending';

  } else {
    displayStatus =
      'ready';
  }

  const tenantName =
    tenantCheckinText_(
      contract.tenant_name ||
      tenant.tenant_name ||
      tenant.name ||
      user.name ||
      '房客'
    );

  const tenantPhone =
    tenantCheckinText_(
      contract.tenant_phone ||
      tenant.tenant_phone ||
      tenant.phone ||
      user.phone
    );

  const propertyName =
    tenantCheckinText_(
      contract.property_name ||
      property.property_name ||
      room.property_name
    );

  const roomName =
    tenantCheckinText_(
      contract.room_name ||
      room.room_name
    );

  const item = {
    contract_id:
      tenantCheckinText_(
        contract.contract_id
      ),

    workspace_id:
      tenantCheckinText_(
        access.workspace
          .workspace_id
      ).toUpperCase(),

    landlord_id:
      tenantCheckinText_(
        contract.landlord_id ||
        access.principal_landlord_id
      ),

    tenant_id:
      tenantCheckinText_(
        contract.tenant_id
      ),

    tenant_user_id:
      tenantCheckinText_(
        contract.tenant_user_id
      ),

    tenant_name:
      tenantName,

    tenant_phone:
      tenantPhone,

    tenant_email:
      tenantCheckinText_(
        contract.tenant_email ||
        tenant.tenant_email ||
        tenant.email ||
        user.email
      ),

    tenant_line_user_id:
      binding.line_user_id,

    tenant_line_binding_source:
      binding.source,

    tenant_line_binding_conflict:
      binding.conflict,

    property_id:
      tenantCheckinText_(
        contract.property_id ||
        room.property_id
      ),

    property_name:
      propertyName,

    room_id:
      tenantCheckinText_(
        contract.room_id
      ),

    room_name:
      roomName,

    contract_start_date:
      contractStartDate,

    contract_end_date:
      contractEndDate,

    contract_status:
      tenantCheckinText_(
        contract.contract_status ||
        contract.status ||
        'active'
      ),

    scheduled_checkin_date:
      scheduledDate,

    checkin_status:
      storedStatus,

    display_status:
      displayStatus,

    display_status_label:
      tenantCheckinStatusLabel_(
        displayStatus
      ),

    checked_in_at:
      tenantCheckinFormatDateTime_(
        checkin.checked_in_at ||
        contract.checked_in_at
      ),

    key_handover_status:
      tenantCheckinNormalizeKeyStatus_(
        checkin.key_handover_status ||
        contract.key_handover_status ||
        'pending'
      ),

    first_meter_reading:
      checkin.first_meter_reading !==
        undefined &&
      checkin.first_meter_reading !==
        null
        ? checkin.first_meter_reading
        : '',

    note:
      tenantCheckinText_(
        checkin.note ||
        contract.checkin_note
      ),

    welcome_sent_status:
      tenantCheckinText_(
        checkin.welcome_sent_status
      ) ||
      'not_sent',

    welcome_sent_at:
      tenantCheckinFormatDateTime_(
        checkin.welcome_sent_at
      ),

    welcome_send_count:
      Math.max(
        0,
        Math.round(
          tenantCheckinNumber_(
            checkin.welcome_send_count
          )
        )
      ),

    welcome_last_error:
      tenantCheckinText_(
        checkin.welcome_last_error
      )
  };

  item.binding_invitation_text =
    tenantCheckinBuildBindingInvitation_(
      item
    );

  item.welcome_message_preview =
    tenantCheckinBuildWelcomeMessage_(
      item
    );

  return item;
}


function tenantCheckinContractVisible_(
  contract
) {
  const status =
    tenantCheckinText_(
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
    ) >=
    0
  ) {
    return false;
  }

  const endDate =
    tenantCheckinDate_(
      contract.end_date ||
      contract.contract_end_date
    );

  if (
    endDate &&
    endDate.getTime() <
      tenantCheckinToday_()
        .getTime()
  ) {
    return false;
  }

  return true;
}


// ==================================================
// LINE binding and message
// ==================================================

function tenantCheckinResolveLineBinding_(
  data,
  contract,
  tenant,
  user
) {
  const candidates = [];

  function add(
    value,
    source
  ) {
    value =
      tenantCheckinText_(
        value
      );

    if (
      !/^U[a-zA-Z0-9_-]{20,}$/.test(
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

  add(
    contract.tenant_line_user_id,
    'V2_contracts'
  );

  add(
    tenant.tenant_line_user_id ||
    tenant.line_user_id,
    'V2_tenants'
  );

  add(
    user.line_user_id ||
    user.tenant_line_user_id,
    'V2_users'
  );

  const tenantId =
    tenantCheckinText_(
      contract.tenant_id ||
      tenant.tenant_id
    ).toUpperCase();

  const tenantUserId =
    tenantCheckinText_(
      contract.tenant_user_id ||
      tenant.tenant_user_id ||
      tenant.user_id
    );

  const contractId =
    tenantCheckinText_(
      contract.contract_id
    );

  data.tenant_home_rows.forEach(
    function (row) {
      if (
        tenantCheckinText_(
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

  data.tenant_list_rows.forEach(
    function (row) {
      if (
        tenantCheckinText_(
          row.tenant_id
        ).toUpperCase() ===
        tenantId
      ) {
        add(
          row.tenant_line_user_id,
          'V2_landlord_tenant_list_view'
        );
      }
    }
  );

  data.tenant_bill_rows.forEach(
    function (row) {
      if (
        tenantCheckinText_(
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
          tenantId &&
          tenantCheckinText_(
            bill.tenant_id
          ).toUpperCase() ===
          tenantId
        ) ||
        (
          tenantUserId &&
          tenantCheckinText_(
            bill.tenant_user_id
          ) ===
          tenantUserId
        ) ||
        (
          contractId &&
          tenantCheckinText_(
            bill.contract_id
          ) ===
          contractId
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


function tenantCheckinBuildBindingInvitation_(
  item
) {
  return [
    (
      item.tenant_name ||
      '您好'
    ) +
    '，您好：',
    '',
    '請使用本人 LINE 開啟 CMWebs 房客入口，完成租約帳號綁定：',
    V2_TENANT_CHECKIN_LIFF_URL_,
    '',
    '開啟後請輸入租約登記的手機號碼。',
    '完成綁定後，即可查看租約、帳單、付款回報與房東訊息。',
    '',
    '房間：' +
      (
        item.property_name ||
        '-'
      ) +
      ' / ' +
      (
        item.room_name ||
        '-'
      )
  ].join(
    '\n'
  );
}


function tenantCheckinBuildWelcomeMessage_(
  item
) {
  const isResend =
    tenantCheckinNumber_(
      item.welcome_send_count
    ) > 0;

  return [
    isResend
      ? '【CMWebs 入住報到通知｜重新發送】'
      : '【CMWebs 入住報到通知】',
    '',
    (
      item.tenant_name ||
      '房客'
    ) +
    ' 您好：',
    '',
    '您的租屋入住資料已建立，請確認以下內容。',
    '',
    '物件：' +
      (
        item.property_name ||
        '-'
      ),
    '房間：' +
      (
        item.room_name ||
        '-'
      ),
    '租約期間：' +
      (
        item.contract_start_date ||
        '-'
      ) +
      ' 至 ' +
      (
        item.contract_end_date ||
        '-'
      ),
    '預定報到日：' +
      (
        item.scheduled_checkin_date ||
        item.contract_start_date ||
        '-'
      ),
    '',
    '請使用本人 LINE 開啟 CMWebs 房客入口：',
    V2_TENANT_CHECKIN_LIFF_URL_,
    '',
    '您可在系統中查看租約、帳單、付款回報與房東訊息。',
    '入住資料若有異動，請直接與房東聯絡。'
  ].join(
    '\n'
  );
}


// ==================================================
// Synchronization
// ==================================================

function tenantCheckinSyncViews_(
  ss,
  contractId,
  tenantId,
  values
) {
  [
    V2_TENANT_CHECKIN_SHEETS_
      .landlordTenantListView,
    V2_TENANT_CHECKIN_SHEETS_
      .tenantHomeView
  ].forEach(
    function (sheetName) {
      const sheet =
        ss.getSheetByName(
          sheetName
        );

      if (!sheet) {
        return;
      }

      const rows =
        workspaceGetObjectsWithRow_(
          sheet
        );

      rows.forEach(
        function (row) {
          const matches =
            (
              contractId &&
              tenantCheckinText_(
                row.current_contract_id ||
                row.contract_id
              ) ===
              tenantCheckinText_(
                contractId
              )
            ) ||
            (
              tenantId &&
              tenantCheckinText_(
                row.tenant_id
              ).toUpperCase() ===
              tenantCheckinText_(
                tenantId
              ).toUpperCase()
            );

          if (matches) {
            tenantCheckinSetRowValues_(
              sheet,
              row.__row_number,
              values
            );
          }
        }
      );
    }
  );
}


function tenantCheckinSyncLineUid_(
  ss,
  contract,
  lineUserId,
  now
) {
  const contractId =
    tenantCheckinText_(
      contract.contract_id
    );

  const tenantId =
    tenantCheckinText_(
      contract.tenant_id
    ).toUpperCase();

  const tenantUserId =
    tenantCheckinText_(
      contract.tenant_user_id
    );

  const sheetRules = [
    {
      name:
        V2_TENANT_CHECKIN_SHEETS_
          .contracts,
      match:
        function (row) {
          return (
            tenantCheckinText_(
              row.contract_id
            ) ===
            contractId
          );
        }
    },
    {
      name:
        V2_TENANT_CHECKIN_SHEETS_
          .tenants,
      match:
        function (row) {
          return (
            tenantCheckinText_(
              row.tenant_id
            ).toUpperCase() ===
            tenantId
          );
        }
    },
    {
      name:
        V2_TENANT_CHECKIN_SHEETS_
          .users,
      match:
        function (row) {
          return (
            tenantCheckinText_(
              row.user_id
            ) ===
            tenantUserId
          );
        }
    },
    {
      name:
        V2_TENANT_CHECKIN_SHEETS_
          .landlordTenantListView,
      match:
        function (row) {
          return (
            tenantCheckinText_(
              row.tenant_id
            ).toUpperCase() ===
            tenantId
          );
        }
    },
    {
      name:
        V2_TENANT_CHECKIN_SHEETS_
          .tenantHomeView,
      match:
        function (row) {
          return (
            tenantCheckinText_(
              row.tenant_id
            ).toUpperCase() ===
            tenantId
          );
        }
    },
    {
      name:
        V2_TENANT_CHECKIN_SHEETS_
          .tenantBillView,
      match:
        function (row) {
          return (
            tenantCheckinText_(
              row.tenant_id
            ).toUpperCase() ===
            tenantId
          );
        }
    },
    {
      name:
        V2_TENANT_CHECKIN_SHEETS_
          .bills,
      match:
        function (row) {
          return (
            tenantCheckinText_(
              row.tenant_id
            ).toUpperCase() ===
            tenantId
          );
        }
    }
  ];

  sheetRules.forEach(
    function (rule) {
      const sheet =
        ss.getSheetByName(
          rule.name
        );

      if (!sheet) {
        return;
      }

      workspaceGetObjectsWithRow_(
        sheet
      ).forEach(
        function (row) {
          if (!rule.match(row)) {
            return;
          }

          tenantCheckinSetRowValues_(
            sheet,
            row.__row_number,
            {
              tenant_line_user_id:
                lineUserId,
              line_user_id:
                (
                  rule.name ===
                    V2_TENANT_CHECKIN_SHEETS_
                      .tenantHomeView ||
                  rule.name ===
                    V2_TENANT_CHECKIN_SHEETS_
                      .tenantBillView ||
                  rule.name ===
                    V2_TENANT_CHECKIN_SHEETS_
                      .tenants ||
                  rule.name ===
                    V2_TENANT_CHECKIN_SHEETS_
                      .users
                )
                  ? lineUserId
                  : row.line_user_id,
              tenant_binding_status:
                'bound',
              binding_status:
                'bound',
              bound_at:
                row.bound_at ||
                now,
              updated_at:
                now
            }
          );
        }
      );
    }
  );
}


function tenantCheckinAppendLineLog_(
  ss,
  access,
  item,
  message,
  status,
  note
) {
  const sheet =
    tenantCheckinEnsureLineLogSheet_(
      ss
    );

  tenantCheckinAppendObject_(
    sheet,
    {
      created_at:
        new Date(),
      direction:
        'outgoing',
      source:
        'landlord_tenant_checkin',
      workspace_id:
        tenantCheckinText_(
          access.workspace
            .workspace_id
        ).toUpperCase(),
      landlord_line_user_id:
        tenantCheckinText_(
          access
            .principal_line_user_id ||
          access.line_user_id
        ),
      tenant_line_user_id:
        item.tenant_line_user_id ||
        '',
      tenant_id:
        item.tenant_id ||
        '',
      tenant_user_id:
        item.tenant_user_id ||
        '',
      tenant_name:
        item.tenant_name ||
        '',
      room_list:
        item.room_name ||
        '',
      contract_id:
        item.contract_id ||
        '',
      message_type:
        'tenant_checkin_welcome',
      message_text:
        message || '',
      status:
        status || '',
      note:
        note || ''
    }
  );
}


// ==================================================
// Permission and audit
// ==================================================

function tenantCheckinCanManage_(
  access
) {
  return [
    'owner',
    'admin',
    'manager'
  ].indexOf(
    tenantCheckinText_(
      access.membership.role
    ).toLowerCase()
  ) >= 0;
}


function tenantCheckinRequireManage_(
  access
) {
  if (
    tenantCheckinCanManage_(
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
    '目前角色沒有管理房客報到的權限'
  );
}


function tenantCheckinAudit_(
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
    // 稽核失敗不阻擋主流程。
  }
}


// ==================================================
// Workspace and schema
// ==================================================

function tenantCheckinGetWorkspaceRows_(
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
      return tenantCheckinRowMatchesWorkspace_(
        row,
        access,
        propertyIdMap
      );
    }
  );
}


function tenantCheckinRowMatchesWorkspace_(
  row,
  access,
  propertyIdMap
) {
  const workspaceId =
    tenantCheckinText_(
      access.workspace
        .workspace_id
    ).toUpperCase();

  const rowWorkspaceId =
    tenantCheckinText_(
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
          return tenantCheckinText_(
            principal.landlord_id
          );
        }
      )
      .filter(Boolean);

  const landlordId =
    tenantCheckinText_(
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
    tenantCheckinText_(
      row.property_id
    );

  return Boolean(
    propertyId &&
    propertyIdMap &&
    propertyIdMap[
      propertyId
    ]
  );
}


function tenantCheckinEnsureSchema_() {
  if (
    typeof workspaceEnsureSchema_ ===
    'function'
  ) {
    workspaceEnsureSchema_();
  }

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  tenantCheckinEnsureSheet_(
    ss,
    V2_TENANT_CHECKIN_SHEETS_
      .checkins,
    [
      'checkin_id',
      'workspace_id',
      'landlord_id',
      'contract_id',
      'tenant_id',
      'tenant_user_id',
      'tenant_name',
      'tenant_phone',
      'tenant_line_user_id',
      'property_id',
      'property_name',
      'room_id',
      'room_name',
      'contract_start_date',
      'contract_end_date',
      'scheduled_checkin_date',
      'checkin_status',
      'checked_in_at',
      'checked_in_by_user_id',
      'checked_in_by_membership_id',
      'key_handover_status',
      'first_meter_reading',
      'note',
      'welcome_sent_status',
      'welcome_sent_at',
      'welcome_last_attempt_at',
      'welcome_send_count',
      'welcome_last_error',
      'created_by_user_id',
      'created_by_membership_id',
      'created_at',
      'updated_at'
    ]
  );

  [
    V2_TENANT_CHECKIN_SHEETS_
      .contracts,
    V2_TENANT_CHECKIN_SHEETS_
      .landlordTenantListView,
    V2_TENANT_CHECKIN_SHEETS_
      .tenantHomeView
  ].forEach(
    function (sheetName) {
      const sheet =
        ss.getSheetByName(
          sheetName
        );

      if (sheet) {
        tenantCheckinEnsureHeaders_(
          sheet,
          [
            'checkin_status',
            'scheduled_checkin_date',
            'checked_in_at',
            'key_handover_status',
            'checkin_note',
            'checkin_updated_at'
          ]
        );
      }
    }
  );

  tenantCheckinEnsureLineLogSheet_(
    ss
  );

  return true;
}


function tenantCheckinEnsureLineLogSheet_(
  ss
) {
  return tenantCheckinEnsureSheet_(
    ss,
    V2_TENANT_CHECKIN_SHEETS_
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
      'contract_id',
      'message_type',
      'message_text',
      'status',
      'note'
    ]
  );
}


function tenantCheckinEnsureSheet_(
  ss,
  sheetName,
  headers
) {
  let sheet =
    ss.getSheetByName(
      sheetName
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        sheetName
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

  tenantCheckinEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


function tenantCheckinEnsureHeaders_(
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
        tenantCheckinText_
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


function tenantCheckinSetRowValues_(
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
        tenantCheckinText_
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


function tenantCheckinAppendObject_(
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
        tenantCheckinText_
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

function tenantCheckinNormalizeFilter_(
  value
) {
  const filter =
    tenantCheckinText_(
      value
    ).toLowerCase();

  return [
    'all',
    'ready',
    'pending',
    'upcoming',
    'completed',
    'unbound',
    'cancelled'
  ].indexOf(
    filter
  ) >= 0
    ? filter
    : 'all';
}


function tenantCheckinNormalizeStatus_(
  value
) {
  const status =
    tenantCheckinText_(
      value
    ).toLowerCase();

  return [
    'pending',
    'completed',
    'cancelled'
  ].indexOf(
    status
  ) >= 0
    ? status
    : 'pending';
}


function tenantCheckinNormalizeKeyStatus_(
  value
) {
  const status =
    tenantCheckinText_(
      value
    ).toLowerCase();

  return [
    'pending',
    'completed',
    'not_required'
  ].indexOf(
    status
  ) >= 0
    ? status
    : 'pending';
}


function tenantCheckinStatusLabel_(
  status
) {
  const labels = {
    ready:
      '可報到',
    pending:
      '待報到',
    upcoming:
      '即將入住',
    completed:
      '已完成',
    unbound:
      '尚未綁定 LINE',
    cancelled:
      '已取消'
  };

  return labels[
    status
  ] ||
  '待報到';
}


function tenantCheckinNormalizeDateText_(
  value
) {
  const date =
    tenantCheckinDate_(
      value
    );

  return date
    ? Utilities.formatDate(
        date,
        'Asia/Taipei',
        'yyyy-MM-dd'
      )
    : '';
}


function tenantCheckinFormatDate_(
  value
) {
  const date =
    tenantCheckinDate_(
      value
    );

  return date
    ? Utilities.formatDate(
        date,
        'Asia/Taipei',
        'yyyy-MM-dd'
      )
    : tenantCheckinText_(
        value
      );
}


function tenantCheckinFormatDateTime_(
  value
) {
  const date =
    tenantCheckinDate_(
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


function tenantCheckinDate_(
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

  const text =
    tenantCheckinText_(
      value
    );

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {
    const parts =
      text.split(
        '-'
      );

    const date =
      new Date(
        Number(
          parts[0]
        ),
        Number(
          parts[1]
        ) - 1,
        Number(
          parts[2]
        )
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const parsed =
    new Date(
      value
    );

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}


function tenantCheckinToday_() {
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


function tenantCheckinGenerateId_() {
  return (
    'TCI' +
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


function tenantCheckinRowTime_(
  row
) {
  const candidates = [
    row.updated_at,
    row.checked_in_at,
    row.created_at
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const date =
      tenantCheckinDate_(
        candidates[
          index
        ]
      );

    if (date) {
      return date.getTime();
    }
  }

  return 0;
}


function tenantCheckinCompareText_(
  a,
  b
) {
  return tenantCheckinText_(
    a
  ).localeCompare(
    tenantCheckinText_(
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


function tenantCheckinText_(
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


function tenantCheckinNumber_(
  value
) {
  const number =
    Number(
      tenantCheckinText_(
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

function testEnsureTenantCheckinSchema() {
  tenantCheckinEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const result = {
    success:
      true,
    checkin_columns:
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .checkins
      ).getLastColumn(),
    contract_columns:
      ss.getSheetByName(
        V2_TENANT_CHECKIN_SHEETS_
          .contracts
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


function testLandlordTenantCheckinsInit() {
  const result =
    getLandlordTenantCheckinsInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      '',
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


function testTenantCheckinWelcomePreview() {
  const result =
    getLandlordTenantCheckinsInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      '',
      'all'
    );

  const item =
    result &&
    result.success &&
    result.data &&
    result.data.items
      ? result.data.items[0]
      : null;

  const output = {
    success:
      Boolean(
        item
      ),
    contract_id:
      item
        ? item.contract_id
        : '',
    binding_text:
      item
        ? item.binding_invitation_text
        : '',
    welcome_message:
      item
        ? item.welcome_message_preview
        : ''
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
