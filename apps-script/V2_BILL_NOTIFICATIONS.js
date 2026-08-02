/**
 * CMWebs V2 LINE 帳單通知
 *
 * API:
 * - landlord_bill_notifications_init
 * - landlord_bill_notifications_send
 *
 * 核心規則：
 * - 只允許目前 Workspace 的房東團隊操作。
 * - 已繳帳單不發送催繳通知。
 * - 房客尚未完成 LINE 綁定時不可發送。
 * - 已發送帳單可重新發送，並累計 send_count。
 * - 批次使用 UrlFetchApp.fetchAll()，減少逐筆網路等待。
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 * - V2_WORKSPACE_LANDLORD_ACCESS.gs
 * - V2_WORKSPACE_OPERATION_AUDIT.gs（選用）
 */

const V2_BILL_NOTIFICATION_SHEETS_ = {
  bills:
    'V2_bills',
  tenantBillView:
    'V2_tenant_bill_view',
  tenantHomeView:
    'V2_tenant_home_view',
  tenants:
    'V2_tenants',
  users:
    'V2_users',
  contracts:
    'V2_contracts',
  landlordTenantListView:
    'V2_landlord_tenant_list_view',
  properties:
    'V2_properties',
  lineMessageLogs:
    'V2_line_message_logs'
};

const V2_BILL_NOTIFICATION_TENANT_LIFF_URL_ =
  'https://liff.line.me/2010314940-iJB1D6sN';


/**
 * 帳單通知管理頁初始化。
 */
function getLandlordBillNotificationsInitByLineUid_(
  lineUserId,
  billMonth,
  propertyId,
  statusFilter
) {
  try {
    billNotificationRequireSchema_();

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

    billMonth =
      billNotificationNormalizeBillMonth_(
        billMonth
      ) ||
      Utilities.formatDate(
        new Date(),
        'Asia/Taipei',
        'yyyy-MM'
      );

    propertyId =
      billNotificationText_(
        propertyId
      );

    statusFilter =
      billNotificationNormalizeFilter_(
        statusFilter
      );

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const bills =
      billNotificationGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILL_NOTIFICATION_SHEETS_
            .bills
        ),
        access
      )
        .filter(
          function (bill) {
            return (
              billNotificationNormalizeBillMonth_(
                bill.bill_month
              ) ===
              billMonth
            );
          }
        );

    const tenantRows =
      billNotificationGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILL_NOTIFICATION_SHEETS_
            .tenants
        ),
        access
      );

    const tenantHomeRows =
      billNotificationGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILL_NOTIFICATION_SHEETS_
            .tenantHomeView
        ),
        access
      );

    const propertyRows =
      billNotificationGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILL_NOTIFICATION_SHEETS_
            .properties
        ),
        access
      )
        .filter(
          function (property) {
            return (
              billNotificationText_(
                property.account_status ||
                property.property_status ||
                'active'
              ).toLowerCase() !==
              'archived'
            );
          }
        );

    const tenantMap = {};
    const tenantHomeMap = {};

    tenantRows.forEach(
      function (tenant) {
        tenantMap[
          billNotificationText_(
            tenant.tenant_id
          )
        ] =
          tenant;
      }
    );

    tenantHomeRows.forEach(
      function (row) {
        tenantHomeMap[
          billNotificationText_(
            row.tenant_id
          )
        ] =
          row;
      }
    );

    const bindingIndex =
      billNotificationBuildBindingIndex_(
        ss,
        access
      );

    const properties =
      propertyRows
        .map(
          function (property) {
            return {
              property_id:
                billNotificationText_(
                  property.property_id
                ),
              property_name:
                billNotificationText_(
                  property.property_name
                )
            };
          }
        )
        .sort(
          function (a, b) {
            return billNotificationCompareText_(
              a.property_name,
              b.property_name
            );
          }
        );

    const propertyIdMap = {};

    properties.forEach(
      function (property) {
        propertyIdMap[
          property.property_id
        ] = true;
      }
    );

    if (
      propertyId &&
      !propertyIdMap[
        propertyId
      ]
    ) {
      propertyId =
        '';
    }

    let items =
      bills.map(
        function (bill) {
          const tenantId =
            billNotificationText_(
              bill.tenant_id
            );

          return billNotificationBuildItem_(
            bill,
            tenantMap[
              tenantId
            ] ||
            {},
            tenantHomeMap[
              tenantId
            ] ||
            {},
            bindingIndex
          );
        }
      );

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
              item.notification_status ===
              statusFilter
            );
          }
        );
    }

    items.sort(
      function (a, b) {
        const propertyCompare =
          billNotificationCompareText_(
            a.property_name,
            b.property_name
          );

        if (
          propertyCompare !==
          0
        ) {
          return propertyCompare;
        }

        return billNotificationCompareText_(
          a.room_name,
          b.room_name
        );
      }
    );

    const allItems =
      bills.map(
        function (bill) {
          const tenantId =
            billNotificationText_(
              bill.tenant_id
            );

          return billNotificationBuildItem_(
            bill,
            tenantMap[
              tenantId
            ] ||
            {},
            tenantHomeMap[
              tenantId
            ] ||
            {},
            bindingIndex
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
              item.notification_status ===
              'not_sent'
            );
          }
        ).length,
      sent_count:
        allItems.filter(
          function (item) {
            return (
              item.notification_status ===
              'sent'
            );
          }
        ).length,
      failed_count:
        allItems.filter(
          function (item) {
            return (
              item.notification_status ===
              'failed'
            );
          }
        ).length,
      unbound_count:
        allItems.filter(
          function (item) {
            return (
              item.notification_status ===
              'unbound'
            );
          }
        ).length,
      paid_count:
        allItems.filter(
          function (item) {
            return (
              item.notification_status ===
              'paid'
            );
          }
        ).length
    };

    return workspaceResult_(
      true,
      'OK',
      '帳單通知資料載入成功',
      {
        workspace:
          workspaceBuildWorkspaceView_(
            access.workspace
          ),
        current_user:
          workspaceBuildUserView_(
            access.user
          ),
        current_membership:
          workspaceBuildMembershipView_(
            access.membership
          ),
        can_send:
          billNotificationCanSend_(
            access
          ),
        bill_month:
          billMonth,
        selected_property_id:
          propertyId,
        status_filter:
          statusFilter,
        tenant_liff_url:
          V2_BILL_NOTIFICATION_TENANT_LIFF_URL_,
        properties:
          properties,
        summary:
          summary,
        binding_diagnostics: {
          indexed_tenant_count:
            Object.keys(
              bindingIndex
                .by_tenant_id
            ).length,
          indexed_user_count:
            Object.keys(
              bindingIndex
                .by_user_id
            ).length,
          indexed_contract_count:
            Object.keys(
              bindingIndex
                .by_contract_id
            ).length
        },
        items:
          items
      }
    );

  } catch (error) {
    return workspaceResult_(
      false,
      'BILL_NOTIFICATIONS_INIT_ERROR',
      '帳單通知資料載入失敗：' +
        error.message
    );
  }
}


/**
 * 批次發送或重新發送帳單通知。
 *
 * billIdsJson:
 * ["B0000001", "B0000002"]
 */
function sendLandlordBillNotificationsByLineUid_(
  lineUserId,
  billIdsJson
) {
  const lock =
    LockService.getScriptLock();

  let locked = false;

  try {
    billNotificationEnsureSchema_();

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
      billNotificationRequireSend_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    const billIds =
      billNotificationParseBillIds_(
        billIdsJson
      );

    if (
      billIds.length ===
      0
    ) {
      return workspaceResult_(
        false,
        'NO_BILLS_SELECTED',
        '請至少選擇一筆帳單'
      );
    }

    lock.waitLock(
      25000
    );

    locked = true;

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

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const billSheet =
      ss.getSheetByName(
        V2_BILL_NOTIFICATION_SHEETS_
          .bills
      );

    const tenantBillSheet =
      ss.getSheetByName(
        V2_BILL_NOTIFICATION_SHEETS_
          .tenantBillView
      );

    const bills =
      billNotificationGetWorkspaceRows_(
        billSheet,
        access
      );

    const tenantRows =
      billNotificationGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILL_NOTIFICATION_SHEETS_
            .tenants
        ),
        access
      );

    const tenantHomeRows =
      billNotificationGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILL_NOTIFICATION_SHEETS_
            .tenantHomeView
        ),
        access
      );

    const tenantMap = {};
    const tenantHomeMap = {};

    tenantRows.forEach(
      function (tenant) {
        tenantMap[
          billNotificationText_(
            tenant.tenant_id
          )
        ] =
          tenant;
      }
    );

    tenantHomeRows.forEach(
      function (row) {
        tenantHomeMap[
          billNotificationText_(
            row.tenant_id
          )
        ] =
          row;
      }
    );

    const bindingIndex =
      billNotificationBuildBindingIndex_(
        ss,
        access
      );

    const billIdMap = {};

    billIds.forEach(
      function (billId) {
        billIdMap[
          billId
        ] = true;
      }
    );

    const selectedBills =
      bills.filter(
        function (bill) {
          return Boolean(
            billIdMap[
              billNotificationText_(
                bill.bill_id
              )
            ]
          );
        }
      );

    const missingBillIds =
      billIds.filter(
        function (billId) {
          return !selectedBills.some(
            function (bill) {
              return (
                billNotificationText_(
                  bill.bill_id
                ) ===
                billId
              );
            }
          );
        }
      );

    const actor =
      billNotificationActor_(
        access
      );

    const prepared = [];
    const skipped = [];
    const logRows = [];

    selectedBills.forEach(
      function (bill) {
        const tenantId =
          billNotificationText_(
            bill.tenant_id
          );

        const item =
          billNotificationBuildItem_(
            bill,
            tenantMap[
              tenantId
            ] ||
            {},
            tenantHomeMap[
              tenantId
            ] ||
            {},
            bindingIndex
          );

        if (
          item.notification_status ===
          'paid'
        ) {
          skipped.push({
            bill_id:
              item.bill_id,
            room_name:
              item.room_name,
            code:
              'PAID_BILL_SKIPPED',
            message:
              '已繳帳單不發送催繳通知'
          });

          return;
        }

        if (
          item.notification_status ===
          'unbound'
        ) {
          const now =
            new Date();

          billNotificationSetRowValues_(
            billSheet,
            bill.__row_number,
            {
              sent_status:
                'unbound',
              last_send_error:
                '房客尚未完成 LINE 綁定',
              updated_at:
                now
            }
          );

          billNotificationSyncViewStatus_(
            tenantBillSheet,
            item.bill_id,
            {
              sent_status:
                'unbound',
              last_send_error:
                '房客尚未完成 LINE 綁定',
              updated_at:
                now
            }
          );

          skipped.push({
            bill_id:
              item.bill_id,
            room_name:
              item.room_name,
            code:
              'TENANT_LINE_UNBOUND',
            message:
              '房客尚未完成 LINE 綁定'
          });

          logRows.push(
            billNotificationBuildLogRow_(
              access,
              item,
              '',
              'blocked',
              '房客尚未完成 LINE 綁定'
            )
          );

          return;
        }

        const message =
          billNotificationBuildMessage_(
            item
          );

        prepared.push({
          bill:
            bill,
          item:
            item,
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
                  item
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

    const sent = [];
    const failed = [];

    const chunks =
      billNotificationChunk_(
        prepared,
        50
      );

    chunks.forEach(
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

            const item =
              entry.item;

            const bill =
              entry.bill;

            const statusCode =
              response
                .getResponseCode();

            const responseText =
              response
                .getContentText();

            const now =
              new Date();

            const currentCount =
              Math.max(
                0,
                Math.round(
                  billNotificationNumber_(
                    bill.send_count
                  )
                )
              );

            if (
              statusCode >= 200 &&
              statusCode < 300
            ) {
              const values = {
                tenant_line_user_id:
                  item.tenant_line_user_id,
                sent_status:
                  'sent',
                sent_at:
                  now,
                last_sent_at:
                  now,
                send_count:
                  currentCount + 1,
                last_send_error:
                  '',
                last_sent_by_user_id:
                  actor.user_id,
                last_sent_by_membership_id:
                  actor.membership_id,
                updated_at:
                  now
              };

              billNotificationSetRowValues_(
                billSheet,
                bill.__row_number,
                values
              );

              billNotificationSyncViewStatus_(
                tenantBillSheet,
                item.bill_id,
                values
              );

              sent.push({
                bill_id:
                  item.bill_id,
                room_name:
                  item.room_name,
                tenant_name:
                  item.tenant_name,
                tenant_line_user_id:
                  item
                    .tenant_line_user_id,
                send_count:
                  currentCount + 1,
                resent:
                  currentCount > 0
              });

              logRows.push(
                billNotificationBuildLogRow_(
                  access,
                  item,
                  entry.message,
                  'success',
                  'HTTP ' +
                  statusCode
                )
              );

            } else {
              const errorMessage =
                'HTTP ' +
                statusCode +
                ' / ' +
                responseText;

              const values = {
                sent_status:
                  'failed',
                last_send_error:
                  errorMessage,
                last_sent_at:
                  now,
                last_sent_by_user_id:
                  actor.user_id,
                last_sent_by_membership_id:
                  actor.membership_id,
                updated_at:
                  now
              };

              billNotificationSetRowValues_(
                billSheet,
                bill.__row_number,
                values
              );

              billNotificationSyncViewStatus_(
                tenantBillSheet,
                item.bill_id,
                values
              );

              failed.push({
                bill_id:
                  item.bill_id,
                room_name:
                  item.room_name,
                tenant_name:
                  item.tenant_name,
                status_code:
                  statusCode,
                message:
                  errorMessage
              });

              logRows.push(
                billNotificationBuildLogRow_(
                  access,
                  item,
                  entry.message,
                  'failed',
                  errorMessage
                )
              );
            }
          }
        );
      }
    );

    missingBillIds.forEach(
      function (billId) {
        skipped.push({
          bill_id:
            billId,
          code:
            'BILL_NOT_FOUND',
          message:
            '找不到帳單或無權限存取'
        });
      }
    );

    billNotificationAppendLogs_(
      ss,
      logRows
    );

    SpreadsheetApp.flush();

    const result =
      workspaceResult_(
        failed.length === 0,
        failed.length === 0
          ? 'BILL_NOTIFICATIONS_SENT'
          : (
              sent.length > 0
                ? 'BILL_NOTIFICATIONS_PARTIAL'
                : 'BILL_NOTIFICATIONS_FAILED'
            ),
        failed.length === 0
          ? '帳單通知已發送'
          : (
              sent.length > 0
                ? '部分帳單通知已發送'
                : '帳單通知發送失敗'
            ),
        {
          requested_count:
            billIds.length,
          sent_count:
            sent.length,
          failed_count:
            failed.length,
          skipped_count:
            skipped.length,
          sent:
            sent,
          failed:
            failed,
          skipped:
            skipped
        }
      );

    billNotificationAudit_(
      access,
      'landlord_bill_notifications_send',
      result,
      {
        target_type:
          'bill',
        target_id:
          sent.length === 1
            ? sent[0].bill_id
            : '',
        operation_status:
          failed.length === 0
            ? 'success'
            : (
                sent.length > 0
                  ? 'partial'
                  : 'failed'
              ),
        detail:
          'requested=' +
          billIds.length +
          ', sent=' +
          sent.length +
          ', failed=' +
          failed.length +
          ', skipped=' +
          skipped.length
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'BILL_NOTIFICATIONS_SEND_ERROR',
      '帳單通知發送失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


// ==================================================
// Tenant LINE binding resolution
// ==================================================

function billNotificationBuildBindingIndex_(
  ss,
  access
) {
  const index = {
    by_tenant_id:
      {},
    by_user_id:
      {},
    by_contract_id:
      {}
  };

  function add(
    map,
    key,
    value,
    source
  ) {
    key =
      billNotificationText_(
        key
      );

    value =
      billNotificationText_(
        value
      );

    if (
      !key ||
      !billNotificationLooksLikeLineUid_(
        value
      )
    ) {
      return;
    }

    if (!map[key]) {
      map[key] = [];
    }

    if (
      !map[key].some(
        function (entry) {
          return (
            entry.line_user_id ===
            value
          );
        }
      )
    ) {
      map[key].push({
        line_user_id:
          value,
        source:
          source
      });
    }
  }

  function scan(
    sheetName,
    options
  ) {
    const sheet =
      ss.getSheetByName(
        sheetName
      );

    if (
      !sheet ||
      sheet.getLastRow() <
      2
    ) {
      return;
    }

    let rows =
      workspaceGetObjectsWithRow_(
        sheet
      );

    if (
      options.workspace_scoped ===
      true
    ) {
      rows =
        billNotificationGetWorkspaceRows_(
          sheet,
          access
        );
    }

    rows.forEach(
      function (row) {
        const tenantId =
          billNotificationText_(
            row.tenant_id
          );

        const userId =
          billNotificationText_(
            row.tenant_user_id ||
            (
              options.user_sheet
                ? row.user_id
                : ''
            )
          );

        const contractId =
          billNotificationText_(
            row.contract_id ||
            row.current_contract_id
          );

        const values = [];

        if (
          options.allow_line_user_id
        ) {
          values.push(
            row.line_user_id
          );
        }

        values.push(
          row.tenant_line_user_id
        );

        values.forEach(
          function (lineUserId) {
            add(
              index.by_tenant_id,
              tenantId,
              lineUserId,
              sheetName
            );

            add(
              index.by_user_id,
              userId,
              lineUserId,
              sheetName
            );

            add(
              index.by_contract_id,
              contractId,
              lineUserId,
              sheetName
            );
          }
        );
      }
    );
  }

  scan(
    V2_BILL_NOTIFICATION_SHEETS_
      .tenants,
    {
      workspace_scoped:
        true,
      allow_line_user_id:
        true
    }
  );

  scan(
    V2_BILL_NOTIFICATION_SHEETS_
      .tenantHomeView,
    {
      workspace_scoped:
        true,
      allow_line_user_id:
        true
    }
  );

  scan(
    V2_BILL_NOTIFICATION_SHEETS_
      .tenantBillView,
    {
      workspace_scoped:
        true,
      allow_line_user_id:
        true
    }
  );

  scan(
    V2_BILL_NOTIFICATION_SHEETS_
      .landlordTenantListView,
    {
      workspace_scoped:
        true,
      allow_line_user_id:
        false
    }
  );

  scan(
    V2_BILL_NOTIFICATION_SHEETS_
      .contracts,
    {
      workspace_scoped:
        true,
      allow_line_user_id:
        false
    }
  );

  scan(
    V2_BILL_NOTIFICATION_SHEETS_
      .bills,
    {
      workspace_scoped:
        true,
      allow_line_user_id:
        false
    }
  );

  scan(
    V2_BILL_NOTIFICATION_SHEETS_
      .users,
    {
      workspace_scoped:
        false,
      user_sheet:
        true,
      allow_line_user_id:
        true
    }
  );

  return index;
}


function billNotificationResolveTenantLineUid_(
  bill,
  tenant,
  tenantHome,
  index
) {
  const candidates = [];

  function add(
    value,
    source
  ) {
    value =
      billNotificationText_(
        value
      );

    if (
      !billNotificationLooksLikeLineUid_(
        value
      )
    ) {
      return;
    }

    const existing =
      candidates.find(
        function (entry) {
          return (
            entry.line_user_id ===
            value
          );
        }
      );

    if (!existing) {
      candidates.push({
        line_user_id:
          value,
        source:
          source
      });
    }
  }

  add(
    bill.tenant_line_user_id,
    'V2_bills'
  );

  add(
    tenant.tenant_line_user_id ||
    tenant.line_user_id,
    'V2_tenants'
  );

  add(
    tenantHome.tenant_line_user_id ||
    tenantHome.line_user_id,
    'V2_tenant_home_view'
  );

  const tenantId =
    billNotificationText_(
      bill.tenant_id ||
      tenant.tenant_id ||
      tenantHome.tenant_id
    );

  const userId =
    billNotificationText_(
      bill.tenant_user_id ||
      tenant.tenant_user_id ||
      tenant.user_id ||
      tenantHome.tenant_user_id ||
      tenantHome.user_id
    );

  const contractId =
    billNotificationText_(
      bill.contract_id ||
      tenantHome.contract_id
    );

  [
    index.by_tenant_id[
      tenantId
    ],
    index.by_user_id[
      userId
    ],
    index.by_contract_id[
      contractId
    ]
  ].forEach(
    function (entries) {
      (
        entries ||
        []
      ).forEach(
        function (entry) {
          add(
            entry.line_user_id,
            entry.source
          );
        }
      );
    }
  );

  return {
    line_user_id:
      candidates.length >
      0
        ? candidates[0]
            .line_user_id
        : '',
    source:
      candidates.length >
      0
        ? candidates[0]
            .source
        : '',
    conflict:
      candidates.length >
      1,
    candidates:
      candidates.map(
        function (entry) {
          return entry.line_user_id;
        }
      )
  };
}


function billNotificationLooksLikeLineUid_(
  value
) {
  return /^U[a-zA-Z0-9_-]{20,}$/.test(
    billNotificationText_(
      value
    )
  );
}


// ==================================================
// Item and message building
// ==================================================

function billNotificationBuildItem_(
  bill,
  tenant,
  tenantHome,
  bindingIndex
) {
  const paymentStatus =
    billNotificationNormalizePaymentStatus_(
      bill.payment_status
    );

  const bindingResolution =
    billNotificationResolveTenantLineUid_(
      bill,
      tenant,
      tenantHome,
      bindingIndex ||
      {
        by_tenant_id:
          {},
        by_user_id:
          {},
        by_contract_id:
          {}
      }
    );

  const tenantLineUserId =
    bindingResolution.line_user_id;

  const sentStatus =
    billNotificationText_(
      bill.sent_status ||
      'not_sent'
    ).toLowerCase();

  const notificationStatus =
    paymentStatus ===
      'paid'
      ? 'paid'
      : (
          !tenantLineUserId
            ? 'unbound'
            : (
                sentStatus ===
                  'sent'
                  ? 'sent'
                  : (
                      sentStatus ===
                        'failed'
                        ? 'failed'
                        : 'not_sent'
                    )
              )
        );

  const item = {
    bill_id:
      billNotificationText_(
        bill.bill_id
      ),
    workspace_id:
      billNotificationText_(
        bill.workspace_id
      ).toUpperCase(),
    bill_month:
      billNotificationNormalizeBillMonth_(
        bill.bill_month
      ),
    due_date:
      billNotificationFormatDate_(
        bill.due_date
      ),

    property_id:
      billNotificationText_(
        bill.property_id
      ),
    property_name:
      billNotificationText_(
        bill.property_name
      ),
    room_id:
      billNotificationText_(
        bill.room_id
      ),
    room_name:
      billNotificationText_(
        bill.room_name
      ),

    tenant_id:
      billNotificationText_(
        bill.tenant_id ||
        tenant.tenant_id
      ),
    tenant_name:
      billNotificationText_(
        bill.tenant_name ||
        tenant.tenant_name ||
        tenant.name ||
        '房客'
      ),
    tenant_line_user_id:
      tenantLineUserId,

    tenant_line_binding_source:
      bindingResolution.source,

    tenant_line_binding_conflict:
      bindingResolution.conflict,

    tenant_line_binding_candidates:
      bindingResolution.candidates,

    rent_amount:
      billNotificationNumber_(
        bill.rent_amount
      ),
    management_fee:
      billNotificationNumber_(
        bill.management_fee
      ),
    electricity_usage:
      billNotificationNumber_(
        bill.electricity_usage
      ),
    electricity_amount:
      billNotificationNumber_(
        bill.electricity_amount
      ),
    equipment_amount:
      billNotificationNumber_(
        bill.equipment_amount
      ),
    other_amount:
      billNotificationNumber_(
        bill.other_amount
      ),
    discount_amount:
      billNotificationNumber_(
        bill.discount_amount
      ),
    total_amount:
      billNotificationNumber_(
        bill.total_amount
      ),

    payment_status:
      paymentStatus,
    sent_status:
      sentStatus,
    notification_status:
      notificationStatus,
    notification_status_label:
      billNotificationStatusLabel_(
        notificationStatus
      ),

    sent_at:
      billNotificationFormatDateTime_(
        bill.sent_at ||
        bill.last_sent_at
      ),
    last_sent_at:
      billNotificationFormatDateTime_(
        bill.last_sent_at ||
        bill.sent_at
      ),
    send_count:
      Math.max(
        0,
        Math.round(
          billNotificationNumber_(
            bill.send_count
          )
        )
      ),
    last_send_error:
      billNotificationText_(
        bill.last_send_error
      ),

    eligible:
      (
        paymentStatus !==
          'paid' &&
        Boolean(
          tenantLineUserId
        )
      )
  };

  item.message_preview =
    billNotificationBuildMessage_(
      item
    );

  return item;
}


function billNotificationBuildMessage_(
  item
) {
  const title =
    item.send_count > 0
      ? '【CMWebs 租屋帳單通知｜重新發送】'
      : '【CMWebs 租屋帳單通知】';

  const lines = [
    title,
    '',
    (
      item.tenant_name ||
      '房客'
    ) +
    ' 您好：',
    '',
    '您的租屋帳單已建立，請確認以下內容。',
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
    '帳單月份：' +
      (
        item.bill_month ||
        '-'
      ),
    '繳款期限：' +
      (
        item.due_date ||
        '-'
      ),
    '',
    '月租：NT$ ' +
      billNotificationMoneyText_(
        item.rent_amount
      ),
    '管理費：NT$ ' +
      billNotificationMoneyText_(
        item.management_fee
      ),
    '電費：NT$ ' +
      billNotificationMoneyText_(
        item.electricity_amount
      ),
    '設備耗損費：NT$ ' +
      billNotificationMoneyText_(
        item.equipment_amount
      )
  ];

  if (
    item.other_amount > 0
  ) {
    lines.push(
      '其他費用：NT$ ' +
      billNotificationMoneyText_(
        item.other_amount
      )
    );
  }

  if (
    item.discount_amount > 0
  ) {
    lines.push(
      '折扣：-NT$ ' +
      billNotificationMoneyText_(
        item.discount_amount
      )
    );
  }

  lines.push(
    '',
    '本期應繳：NT$ ' +
      billNotificationMoneyText_(
        item.total_amount
      ),
    '',
    '請使用本人 LINE 開啟 CMWebs 查看帳單明細與付款回報：',
    V2_BILL_NOTIFICATION_TENANT_LIFF_URL_,
    '',
    '若您已完成繳款，請忽略此訊息或與房東確認。'
  );

  return lines.join(
    '\n'
  );
}


function billNotificationStatusLabel_(
  status
) {
  const labels = {
    not_sent:
      '待發送',
    sent:
      '已發送',
    failed:
      '發送失敗',
    unbound:
      '尚未綁定 LINE',
    paid:
      '已繳'
  };

  return labels[
    status
  ] ||
  '未知';
}


// ==================================================
// View and log synchronization
// ==================================================

function billNotificationSyncViewStatus_(
  sheet,
  billId,
  values
) {
  if (!sheet) {
    return;
  }

  const row =
    workspaceGetObjectsWithRow_(
      sheet
    ).find(
      function (item) {
        return (
          billNotificationText_(
            item.bill_id
          ) ===
          billNotificationText_(
            billId
          )
        );
      }
    );

  if (!row) {
    return;
  }

  billNotificationSetRowValues_(
    sheet,
    row.__row_number,
    values
  );
}


function billNotificationBuildLogRow_(
  access,
  item,
  message,
  status,
  note
) {
  return {
    created_at:
      new Date(),
    direction:
      'outgoing',
    source:
      'landlord_bill_notifications',
    line_message_id:
      '',
    reply_token:
      '',

    workspace_id:
      billNotificationText_(
        access.workspace
          .workspace_id
      ).toUpperCase(),

    landlord_line_user_id:
      billNotificationText_(
        access
          .principal_line_user_id
      ),

    tenant_line_user_id:
      item
        .tenant_line_user_id ||
      '',
    tenant_id:
      item.tenant_id ||
      '',
    tenant_user_id:
      '',
    tenant_name:
      item.tenant_name ||
      '',
    room_list:
      item.room_name ||
      '',

    bill_id:
      item.bill_id ||
      '',
    bill_month:
      item.bill_month ||
      '',

    message_type:
      'bill_notification',
    message_text:
      message || '',
    status:
      status || '',
    note:
      note || ''
  };
}


function billNotificationAppendLogs_(
  ss,
  rows
) {
  if (
    !rows ||
    rows.length === 0
  ) {
    return;
  }

  const sheet =
    billNotificationEnsureLineLogSheet_(
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
        billNotificationText_
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


// ==================================================
// Permissions and audit
// ==================================================

function billNotificationCanSend_(
  access
) {
  return [
    'owner',
    'admin',
    'manager',
    'accountant'
  ].indexOf(
    billNotificationText_(
      access.membership.role
    ).toLowerCase()
  ) >= 0;
}


function billNotificationRequireSend_(
  access
) {
  if (
    billNotificationCanSend_(
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
    '目前角色沒有發送帳單通知的權限'
  );
}


function billNotificationActor_(
  access
) {
  return {
    user_id:
      access.user.user_id ||
      '',
    membership_id:
      access.membership
        .membership_id ||
      '',
    name:
      access.user.name ||
      access.membership
        .display_name ||
      '',
    role:
      access.membership.role ||
      ''
  };
}


function billNotificationAudit_(
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
        meta || {}
      );
    }
  } catch (error) {
    // 稽核錯誤不阻擋 LINE 發送主流程。
  }
}


// ==================================================
// Workspace and schema helpers
// ==================================================

function billNotificationGetWorkspaceRows_(
  sheet,
  access
) {
  if (!sheet) {
    return [];
  }

  const workspaceId =
    billNotificationText_(
      access.workspace
        .workspace_id
    ).toUpperCase();

  const landlordIds =
    (
      access.principals || []
    )
      .map(
        function (principal) {
          return billNotificationText_(
            principal.landlord_id
          );
        }
      )
      .filter(Boolean);

  return workspaceGetObjectsWithRow_(
    sheet
  ).filter(
    function (row) {
      const rowWorkspaceId =
        billNotificationText_(
          row.workspace_id
        ).toUpperCase();

      if (rowWorkspaceId) {
        return (
          rowWorkspaceId ===
          workspaceId
        );
      }

      const landlordId =
        billNotificationText_(
          row.landlord_id
        );

      return (
        landlordId &&
        landlordIds.indexOf(
          landlordId
        ) >= 0
      );
    }
  );
}


function billNotificationEnsureSchema_() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const billSheet =
    ss.getSheetByName(
      V2_BILL_NOTIFICATION_SHEETS_
        .bills
    );

  const tenantBillSheet =
    ss.getSheetByName(
      V2_BILL_NOTIFICATION_SHEETS_
        .tenantBillView
    );

  if (
    !billSheet ||
    !tenantBillSheet
  ) {
    throw new Error(
      '缺少 V2_bills 或 V2_tenant_bill_view'
    );
  }

  const headers = [
    'sent_status',
    'sent_at',
    'last_sent_at',
    'send_count',
    'last_send_error',
    'last_sent_by_user_id',
    'last_sent_by_membership_id'
  ];

  billNotificationEnsureHeaders_(
    billSheet,
    headers
  );

  billNotificationEnsureHeaders_(
    tenantBillSheet,
    headers
  );

  billNotificationEnsureLineLogSheet_(
    ss
  );

  return true;
}


function billNotificationRequireSchema_() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const required = [
    V2_BILL_NOTIFICATION_SHEETS_
      .bills,
    V2_BILL_NOTIFICATION_SHEETS_
      .tenantBillView,
    V2_BILL_NOTIFICATION_SHEETS_
      .tenants,
    V2_BILL_NOTIFICATION_SHEETS_
      .tenantHomeView,
    V2_BILL_NOTIFICATION_SHEETS_
      .properties
  ];

  const missing =
    required.filter(
      function (sheetName) {
        return (
          !ss.getSheetByName(
            sheetName
          )
        );
      }
    );

  if (
    missing.length >
    0
  ) {
    throw new Error(
      '缺少必要資料表：' +
      missing.join(
        '、'
      ) +
      '。請先執行 testEnsureBillNotificationSchema()。'
    );
  }

  return true;
}


function billNotificationEnsureLineLogSheet_(
  ss
) {
  let sheet =
    ss.getSheetByName(
      V2_BILL_NOTIFICATION_SHEETS_
        .lineMessageLogs
    );

  const headers = [
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
    'bill_id',
    'bill_month',
    'message_type',
    'message_text',
    'status',
    'note'
  ];

  if (!sheet) {
    sheet =
      ss.insertSheet(
        V2_BILL_NOTIFICATION_SHEETS_
          .lineMessageLogs
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

  billNotificationEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


function billNotificationEnsureHeaders_(
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
        billNotificationText_
      );

  const missing =
    requiredHeaders.filter(
      function (header) {
        return (
          existing.indexOf(
            header
          ) === -1
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
        sheet.getLastColumn() + 1,
        1,
        missing.length
      )
      .setValues([
        missing
      ]);
  }
}


function billNotificationSetRowValues_(
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
        billNotificationText_
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
    values || {}
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


// ==================================================
// Formatting helpers
// ==================================================

function billNotificationParseBillIds_(
  value
) {
  let parsed = value;

  if (
    !Array.isArray(
      parsed
    )
  ) {
    const text =
      billNotificationText_(
        value
      );

    parsed =
      text
        ? JSON.parse(
            text
          )
        : [];
  }

  if (
    !Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      'bill_ids_json 必須是陣列'
    );
  }

  const seen = {};

  return parsed
    .map(
      billNotificationText_
    )
    .filter(
      function (billId) {
        if (
          !billId ||
          seen[
            billId
          ]
        ) {
          return false;
        }

        seen[
          billId
        ] = true;

        return true;
      }
    );
}


function billNotificationNormalizeFilter_(
  value
) {
  const filter =
    billNotificationText_(
      value
    ).toLowerCase();

  return [
    'all',
    'not_sent',
    'sent',
    'failed',
    'unbound',
    'paid'
  ].indexOf(
    filter
  ) >= 0
    ? filter
    : 'all';
}


function billNotificationNormalizePaymentStatus_(
  value
) {
  const status =
    billNotificationText_(
      value
    ).toLowerCase();

  return [
    'paid',
    'settled',
    'confirmed',
    'complete',
    'completed'
  ].indexOf(
    status
  ) >= 0
    ? 'paid'
    : 'unpaid';
}


function billNotificationNormalizeBillMonth_(
  value
) {
  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return Utilities.formatDate(
      value,
      'Asia/Taipei',
      'yyyy-MM'
    );
  }

  const text =
    billNotificationText_(
      value
    );

  const match =
    text.match(
      /^(\d{4})[-\/](\d{1,2})/
    );

  if (!match) {
    return '';
  }

  const month =
    Number(
      match[2]
    );

  if (
    month < 1 ||
    month > 12
  ) {
    return '';
  }

  return (
    match[1] +
    '-' +
    String(
      month
    ).padStart(
      2,
      '0'
    )
  );
}


function billNotificationFormatDate_(
  value
) {
  const date =
    billNotificationDate_(
      value
    );

  return date
    ? Utilities.formatDate(
        date,
        'Asia/Taipei',
        'yyyy-MM-dd'
      )
    : billNotificationText_(
        value
      );
}


function billNotificationFormatDateTime_(
  value
) {
  const date =
    billNotificationDate_(
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


function billNotificationDate_(
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


function billNotificationChunk_(
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


function billNotificationMoneyText_(
  value
) {
  return Math.round(
    billNotificationNumber_(
      value
    )
  ).toLocaleString(
    'zh-TW'
  );
}


function billNotificationCompareText_(
  a,
  b
) {
  return billNotificationText_(
    a
  ).localeCompare(
    billNotificationText_(
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


function billNotificationText_(
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


function billNotificationNumber_(
  value
) {
  const number =
    Number(
      billNotificationText_(
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

function testEnsureBillNotificationSchema() {
  billNotificationEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const result = {
    success:
      true,
    bills_columns:
      ss.getSheetByName(
        V2_BILL_NOTIFICATION_SHEETS_
          .bills
      ).getLastColumn(),
    tenant_bill_view_columns:
      ss.getSheetByName(
        V2_BILL_NOTIFICATION_SHEETS_
          .tenantBillView
      ).getLastColumn(),
    line_log_columns:
      ss.getSheetByName(
        V2_BILL_NOTIFICATION_SHEETS_
          .lineMessageLogs
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


function testLandlordBillNotificationsInit() {
  const result =
    getLandlordBillNotificationsInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      Utilities.formatDate(
        new Date(),
        'Asia/Taipei',
        'yyyy-MM'
      ),
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


/**
 * 不會實際發送，只輸出指定月份第一筆可發送帳單的訊息預覽。
 */
function testBillNotificationMessagePreview() {
  const result =
    getLandlordBillNotificationsInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      Utilities.formatDate(
        new Date(),
        'Asia/Taipei',
        'yyyy-MM'
      ),
      '',
      'all'
    );

  const item =
    result &&
    result.success &&
    result.data &&
    result.data.items
      ? result.data.items.find(
          function (row) {
            return row.eligible;
          }
        )
      : null;

  const output = {
    success:
      Boolean(
        item
      ),
    bill_id:
      item
        ? item.bill_id
        : '',
    message:
      item
        ? item.message_preview
        : '找不到可發送帳單'
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
