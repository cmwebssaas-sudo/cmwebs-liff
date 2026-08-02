/**
 * CMWebs V2 Workspace 原生房東首頁／欠款／房客清單
 *
 * 目的：
 * - 不再依賴 V2_landlord_home_view.line_user_id 的舊房東登入鍵。
 * - 直接依目前 Workspace、landlord_id、property_id 讀取正式資料。
 * - 解決新註冊 Workspace 房東可進入物件／帳單頁，
 *   但首頁、欠款、房客頁回傳 LANDLORD_NOT_FOUND 的問題。
 *
 * 公開函式：
 * - getWorkspaceLandlordHomeNativeByLineUid_
 * - getWorkspaceLandlordArrearsNativeByLineUid_
 * - getWorkspaceLandlordTenantsNativeByLineUid_
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 * - V2_WORKSPACE_LANDLORD_ACCESS.gs
 */

const V2_WORKSPACE_DASHBOARD_SHEETS_ = {
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
  bills:
    'V2_bills',
  landlordHomeView:
    'V2_landlord_home_view',
  landlordTenantListView:
    'V2_landlord_tenant_list_view'
};


// ==================================================
// Public API
// ==================================================

function getWorkspaceLandlordHomeNativeByLineUid_(
  lineUserId
) {
  return workspaceDashboardExecute_(
    lineUserId,
    'landlord_home',
    function (
      ss,
      access,
      data
    ) {
      return workspaceDashboardBuildHomeResult_(
        access,
        data
      );
    }
  );
}


function getWorkspaceLandlordArrearsNativeByLineUid_(
  lineUserId
) {
  return workspaceDashboardExecute_(
    lineUserId,
    'landlord_arrears',
    function (
      ss,
      access,
      data
    ) {
      const home =
        workspaceDashboardBuildHomeData_(
          access,
          data
        );

      const today =
        workspaceDashboardToday_();

      const arrears =
        data.bills
          .filter(
            function (bill) {
              return (
                workspaceDashboardPaymentStatus_(
                  bill.payment_status
                ) ===
                'unpaid'
              );
            }
          )
          .map(
            function (bill) {
              const daysOverdue =
                workspaceDashboardDaysOverdue_(
                  bill.due_date,
                  today
                );

              const reminderCount =
                Math.max(
                  0,
                  workspaceDashboardNumber_(
                    bill.reminder_count
                  )
                );

              const lastReminderStage =
                Math.max(
                  0,
                  workspaceDashboardNumber_(
                    bill.last_reminder_stage
                  )
                );

              const manualFollowUp =
                workspaceDashboardBoolean_(
                  bill.manual_follow_up_required
                );

              const reminderStatus =
                workspaceDashboardReminderStatus_(
                  daysOverdue,
                  reminderCount,
                  lastReminderStage,
                  manualFollowUp
                );

              const nextReminderDay =
                workspaceDashboardNextReminderDay_(
                  daysOverdue,
                  lastReminderStage,
                  manualFollowUp
                );

              return {
                line_user_id:
                  access.line_user_id ||
                  '',

                user_id:
                  workspaceDashboardText_(
                    bill.tenant_user_id ||
                    bill.user_id
                  ),

                landlord_id:
                  workspaceDashboardText_(
                    bill.landlord_id ||
                    home.landlord_id
                  ),

                landlord_name:
                  home.landlord_name ||
                  '',

                tenant_id:
                  workspaceDashboardText_(
                    bill.tenant_id
                  ),

                tenant_name:
                  workspaceDashboardText_(
                    bill.tenant_name
                  ),

                room_id:
                  workspaceDashboardText_(
                    bill.room_id
                  ),

                room_name:
                  workspaceDashboardText_(
                    bill.room_name
                  ),

                bill_id:
                  workspaceDashboardText_(
                    bill.bill_id
                  ),

                bill_month:
                  workspaceDashboardNormalizeMonth_(
                    bill.bill_month
                  ) ||
                  workspaceDashboardText_(
                    bill.bill_month
                  ),

                due_date:
                  workspaceDashboardFormatDate_(
                    bill.due_date
                  ),

                total_amount:
                  workspaceDashboardNumber_(
                    bill.total_amount
                  ),

                bill_status:
                  workspaceDashboardText_(
                    bill.bill_status ||
                    'issued'
                  ),

                payment_status:
                  workspaceDashboardPaymentStatus_(
                    bill.payment_status
                  ),

                sent_status:
                  workspaceDashboardText_(
                    bill.sent_status ||
                    'not_sent'
                  ),

                days_overdue:
                  daysOverdue,

                reminder_count:
                  reminderCount,

                last_reminder_at:
                  bill.last_reminder_at ||
                  '',

                last_reminder_stage:
                  lastReminderStage,

                manual_follow_up_required:
                  manualFollowUp,

                manual_follow_up_at:
                  bill.manual_follow_up_at ||
                  '',

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

                tenant_line_user_id:
                  workspaceDashboardResolveTenantLineUid_(
                    data,
                    bill.tenant_id,
                    bill.tenant_user_id,
                    bill.contract_id,
                    bill.tenant_line_user_id
                  ),

                account_status:
                  home.account_status ||
                  'active',

                updated_at:
                  bill.updated_at ||
                  ''
              };
            }
          )
          .sort(
            function (a, b) {
              const dueCompare =
                workspaceDashboardText_(
                  a.due_date
                ).localeCompare(
                  workspaceDashboardText_(
                    b.due_date
                  )
                );

              if (
                dueCompare !==
                0
              ) {
                return dueCompare;
              }

              return workspaceDashboardCompareText_(
                a.room_name,
                b.room_name
              );
            }
          );

      const unpaidTotal =
        arrears.reduce(
          function (
            total,
            item
          ) {
            return (
              total +
              workspaceDashboardNumber_(
                item.total_amount
              )
            );
          },
          0
        );

      const remindedBillCount =
        arrears.filter(
          function (item) {
            return (
              item.reminder_count > 0 ||
              item.last_reminder_stage > 0
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
              workspaceDashboardNumber_(
                item.reminder_count
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
              item.days_overdue >= 2
            );
          }
        ).length;

      return workspaceDashboardAttachContext_(
        {
          success:
            true,
          code:
            'OK',
          message:
            '查詢成功',
          data: {
            landlord:
              workspaceDashboardLandlordSummary_(
                home
              ),
            summary: {
              arrears_count:
                arrears.length,
              unpaid_total_amount:
                unpaidTotal,
              auto_reminder_active_count:
                autoReminderActiveCount,
              reminded_bill_count:
                remindedBillCount,
              reminder_total_count:
                reminderTotalCount,
              manual_follow_up_count:
                manualFollowUpCount
            },
            arrears:
              arrears
          }
        },
        access
      );
    }
  );
}


function getWorkspaceLandlordTenantsNativeByLineUid_(
  lineUserId
) {
  return workspaceDashboardExecute_(
    lineUserId,
    'landlord_tenants',
    function (
      ss,
      access,
      data
    ) {
      const home =
        workspaceDashboardBuildHomeData_(
          access,
          data
        );

      const tenants =
        workspaceDashboardBuildTenantList_(
          access,
          data
        );

      const unpaidTenantCount =
        tenants.filter(
          function (tenant) {
            return (
              tenant.unpaid_bill_count > 0 ||
              tenant.latest_payment_status ===
                'unpaid'
            );
          }
        ).length;

      const paidTenantCount =
        tenants.filter(
          function (tenant) {
            return (
              tenant.latest_payment_status ===
              'paid'
            );
          }
        ).length;

      const unpaidTotalAmount =
        tenants.reduce(
          function (
            total,
            tenant
          ) {
            return (
              total +
              workspaceDashboardNumber_(
                tenant.unpaid_total_amount
              )
            );
          },
          0
        );

      const latestTotalAmount =
        tenants.reduce(
          function (
            total,
            tenant
          ) {
            return (
              total +
              workspaceDashboardNumber_(
                tenant.latest_total_amount
              )
            );
          },
          0
        );

      return workspaceDashboardAttachContext_(
        {
          success:
            true,
          code:
            'OK',
          message:
            '查詢成功',
          data: {
            landlord:
              workspaceDashboardLandlordSummary_(
                home
              ),
            summary: {
              tenant_count:
                tenants.length,
              unpaid_tenant_count:
                unpaidTenantCount,
              paid_tenant_count:
                paidTenantCount,
              unpaid_total_amount:
                unpaidTotalAmount,
              latest_total_amount:
                latestTotalAmount
            },
            tenants:
              tenants
          }
        },
        access
      );
    }
  );
}


// ==================================================
// Execution and data loading
// ==================================================

function workspaceDashboardExecute_(
  lineUserId,
  action,
  executor
) {
  try {
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

    const data =
      workspaceDashboardLoadData_(
        ss,
        access
      );

    const result =
      executor(
        ss,
        access,
        data
      );

    try {
      if (
        typeof workspaceLandlordLog_ ===
        'function'
      ) {
        workspaceLandlordLog_(
          access,
          action,
          Boolean(
            result &&
            result.success ===
              true
          ),
          result &&
          result.message
            ? result.message
            : ''
        );
      }
    } catch (logError) {
      // 存取紀錄錯誤不阻擋主流程。
    }

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'WORKSPACE_DASHBOARD_ERROR',
      'Workspace 儀表板讀取錯誤：' +
        error.message
    );
  }
}


function workspaceDashboardLoadData_(
  ss,
  access
) {
  const propertyRows =
    workspaceDashboardRowsForAccess_(
      ss.getSheetByName(
        V2_WORKSPACE_DASHBOARD_SHEETS_
          .properties
      ),
      access,
      null
    );

  const propertyIdMap = {};

  propertyRows.forEach(
    function (property) {
      const propertyId =
        workspaceDashboardText_(
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
    workspaceDashboardRowsForAccess_(
      ss.getSheetByName(
        V2_WORKSPACE_DASHBOARD_SHEETS_
          .rooms
      ),
      access,
      propertyIdMap
    );

  const contracts =
    workspaceDashboardRowsForAccess_(
      ss.getSheetByName(
        V2_WORKSPACE_DASHBOARD_SHEETS_
          .contracts
      ),
      access,
      propertyIdMap
    );

  const bills =
    workspaceDashboardRowsForAccess_(
      ss.getSheetByName(
        V2_WORKSPACE_DASHBOARD_SHEETS_
          .bills
      ),
      access,
      propertyIdMap
    );

  const contractTenantIdMap = {};

  contracts.forEach(
    function (contract) {
      const tenantId =
        workspaceDashboardText_(
          contract.tenant_id
        ).toUpperCase();

      if (tenantId) {
        contractTenantIdMap[
          tenantId
        ] = true;
      }
    }
  );

  bills.forEach(
    function (bill) {
      const tenantId =
        workspaceDashboardText_(
          bill.tenant_id
        ).toUpperCase();

      if (tenantId) {
        contractTenantIdMap[
          tenantId
        ] = true;
      }
    }
  );

  const tenantSheet =
    ss.getSheetByName(
      V2_WORKSPACE_DASHBOARD_SHEETS_
        .tenants
    );

  const tenants =
    (
      tenantSheet
        ? workspaceGetObjectsWithRow_(
            tenantSheet
          )
        : []
    ).filter(
      function (tenant) {
        if (
          workspaceDashboardRowMatchesAccess_(
            tenant,
            access,
            propertyIdMap
          )
        ) {
          return true;
        }

        const tenantId =
          workspaceDashboardText_(
            tenant.tenant_id
          ).toUpperCase();

        return Boolean(
          tenantId &&
          contractTenantIdMap[
            tenantId
          ]
        );
      }
    );

  const userSheet =
    ss.getSheetByName(
      V2_WORKSPACE_DASHBOARD_SHEETS_
        .users
    );

  const users =
    userSheet
      ? workspaceGetObjectsWithRow_(
          userSheet
        )
      : [];

  const tenantViewSheet =
    ss.getSheetByName(
      V2_WORKSPACE_DASHBOARD_SHEETS_
        .landlordTenantListView
    );

  const tenantViewRows =
    tenantViewSheet
      ? workspaceGetObjectsWithRow_(
          tenantViewSheet
        ).filter(
          function (row) {
            if (
              workspaceDashboardRowMatchesAccess_(
                row,
                access,
                propertyIdMap
              )
            ) {
              return true;
            }

            const tenantId =
              workspaceDashboardText_(
                row.tenant_id
              ).toUpperCase();

            return Boolean(
              tenantId &&
              contractTenantIdMap[
                tenantId
              ]
            );
          }
        )
      : [];

  return {
    properties:
      propertyRows,
    property_id_map:
      propertyIdMap,
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
    tenant_view_rows:
      tenantViewRows
  };
}


function workspaceDashboardRowsForAccess_(
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
      return workspaceDashboardRowMatchesAccess_(
        row,
        access,
        propertyIdMap
      );
    }
  );
}


function workspaceDashboardRowMatchesAccess_(
  row,
  access,
  propertyIdMap
) {
  const workspaceId =
    workspaceDashboardText_(
      access.workspace
        .workspace_id
    ).toUpperCase();

  const rowWorkspaceId =
    workspaceDashboardText_(
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
          return workspaceDashboardText_(
            principal.landlord_id
          );
        }
      )
      .filter(Boolean);

  const landlordLineIds =
    (
      access.principals ||
      []
    )
      .map(
        function (principal) {
          return workspaceDashboardText_(
            principal.line_user_id
          );
        }
      )
      .filter(Boolean);

  const landlordId =
    workspaceDashboardText_(
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

  const rowLandlordLineId =
    workspaceDashboardText_(
      row.landlord_line_user_id ||
      row.line_user_id
    );

  if (
    rowLandlordLineId &&
    landlordLineIds.indexOf(
      rowLandlordLineId
    ) >= 0
  ) {
    return true;
  }

  const propertyId =
    workspaceDashboardText_(
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


// ==================================================
// Home
// ==================================================

function workspaceDashboardBuildHomeResult_(
  access,
  data
) {
  return workspaceDashboardAttachContext_(
    {
      success:
        true,
      code:
        'OK',
      message:
        '查詢成功',
      data:
        workspaceDashboardBuildHomeData_(
          access,
          data
        )
    },
    access
  );
}


function workspaceDashboardBuildHomeData_(
  access,
  data
) {
  const activeRooms =
    data.rooms.filter(
      function (room) {
        return (
          workspaceDashboardText_(
            room.account_status ||
            room.room_status ||
            'active'
          ).toLowerCase() !==
          'archived'
        );
      }
    );

  const activeContracts =
    data.contracts.filter(
      workspaceDashboardContractIsCurrent_
    );

  const activeTenantIds = {};

  activeContracts.forEach(
    function (contract) {
      const tenantId =
        workspaceDashboardText_(
          contract.tenant_id
        ).toUpperCase();

      if (tenantId) {
        activeTenantIds[
          tenantId
        ] = true;
      }
    }
  );

  const latestMonth =
    data.bills.reduce(
      function (
        latest,
        bill
      ) {
        const month =
          workspaceDashboardNormalizeMonth_(
            bill.bill_month
          );

        return (
          month &&
          month > latest
        )
          ? month
          : latest;
      },
      ''
    );

  const latestBills =
    latestMonth
      ? data.bills.filter(
          function (bill) {
            return (
              workspaceDashboardNormalizeMonth_(
                bill.bill_month
              ) ===
              latestMonth
            );
          }
        )
      : [];

  const paidBills =
    latestBills.filter(
      function (bill) {
        return (
          workspaceDashboardPaymentStatus_(
            bill.payment_status
          ) ===
          'paid'
        );
      }
    );

  const unpaidBills =
    latestBills.filter(
      function (bill) {
        return (
          workspaceDashboardPaymentStatus_(
            bill.payment_status
          ) ===
          'unpaid'
        );
      }
    );

  const latestTotal =
    workspaceDashboardSum_(
      latestBills,
      'total_amount'
    );

  const paidTotal =
    workspaceDashboardSum_(
      paidBills,
      'total_amount'
    );

  const unpaidTotal =
    workspaceDashboardSum_(
      unpaidBills,
      'total_amount'
    );

  const principal =
    access.principal ||
    {};

  const currentUser =
    access.user ||
    {};

  return {
    line_user_id:
      access.line_user_id ||
      principal.line_user_id ||
      '',

    user_id:
      currentUser.user_id ||
      principal.landlord_user_id ||
      '',

    landlord_id:
      principal.landlord_id ||
      access.principal_landlord_id ||
      '',

    landlord_name:
      principal.landlord_name ||
      currentUser.name ||
      access.membership
        .display_name ||
      '房東',

    room_count:
      activeRooms.length,

    tenant_count:
      Object.keys(
        activeTenantIds
      ).length,

    latest_bill_month:
      latestMonth,

    latest_bill_count:
      latestBills.length,

    latest_total_amount:
      latestTotal,

    unpaid_bill_count:
      unpaidBills.length,

    unpaid_total_amount:
      unpaidTotal,

    paid_bill_count:
      paidBills.length,

    paid_total_amount:
      paidTotal,

    account_status:
      'active',

    updated_at:
      new Date(),

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
        : access.membership
  };
}


function workspaceDashboardLandlordSummary_(
  home
) {
  return {
    line_user_id:
      home.line_user_id ||
      '',
    user_id:
      home.user_id ||
      '',
    landlord_id:
      home.landlord_id ||
      '',
    landlord_name:
      home.landlord_name ||
      '',
    room_count:
      workspaceDashboardNumber_(
        home.room_count
      ),
    tenant_count:
      workspaceDashboardNumber_(
        home.tenant_count
      ),
    account_status:
      home.account_status ||
      'active',
    updated_at:
      home.updated_at ||
      ''
  };
}


// ==================================================
// Tenant list
// ==================================================

function workspaceDashboardBuildTenantList_(
  access,
  data
) {
  const tenantById = {};
  const userById = {};
  const viewByTenantId = {};
  const contractsByTenantId = {};
  const billsByTenantId = {};

  data.tenants.forEach(
    function (tenant) {
      const tenantId =
        workspaceDashboardText_(
          tenant.tenant_id
        ).toUpperCase();

      if (tenantId) {
        tenantById[
          tenantId
        ] =
          tenant;
      }
    }
  );

  data.users.forEach(
    function (user) {
      const userId =
        workspaceDashboardText_(
          user.user_id
        );

      if (userId) {
        userById[
          userId
        ] =
          user;
      }
    }
  );

  data.tenant_view_rows.forEach(
    function (row) {
      const tenantId =
        workspaceDashboardText_(
          row.tenant_id
        ).toUpperCase();

      if (!tenantId) {
        return;
      }

      const existing =
        viewByTenantId[
          tenantId
        ];

      if (
        !existing ||
        workspaceDashboardRowTime_(
          row
        ) >=
        workspaceDashboardRowTime_(
          existing
        )
      ) {
        viewByTenantId[
          tenantId
        ] =
          row;
      }
    }
  );

  data.contracts.forEach(
    function (contract) {
      const tenantId =
        workspaceDashboardText_(
          contract.tenant_id
        ).toUpperCase();

      if (!tenantId) {
        return;
      }

      if (
        !contractsByTenantId[
          tenantId
        ]
      ) {
        contractsByTenantId[
          tenantId
        ] = [];
      }

      contractsByTenantId[
        tenantId
      ].push(
        contract
      );
    }
  );

  data.bills.forEach(
    function (bill) {
      const tenantId =
        workspaceDashboardText_(
          bill.tenant_id
        ).toUpperCase();

      if (!tenantId) {
        return;
      }

      if (
        !billsByTenantId[
          tenantId
        ]
      ) {
        billsByTenantId[
          tenantId
        ] = [];
      }

      billsByTenantId[
        tenantId
      ].push(
        bill
      );
    }
  );

  const tenantIds = {};

  Object.keys(
    tenantById
  ).forEach(
    function (tenantId) {
      tenantIds[
        tenantId
      ] = true;
    }
  );

  Object.keys(
    viewByTenantId
  ).forEach(
    function (tenantId) {
      tenantIds[
        tenantId
      ] = true;
    }
  );

  Object.keys(
    contractsByTenantId
  ).forEach(
    function (tenantId) {
      tenantIds[
        tenantId
      ] = true;
    }
  );

  Object.keys(
    billsByTenantId
  ).forEach(
    function (tenantId) {
      tenantIds[
        tenantId
      ] = true;
    }
  );

  return Object.keys(
    tenantIds
  )
    .map(
      function (tenantId) {
        const tenant =
          tenantById[
            tenantId
          ] ||
          {};

        const view =
          viewByTenantId[
            tenantId
          ] ||
          {};

        const contracts =
          (
            contractsByTenantId[
              tenantId
            ] ||
            []
          ).slice();

        contracts.sort(
          function (a, b) {
            return (
              workspaceDashboardContractTime_(
                b
              ) -
              workspaceDashboardContractTime_(
                a
              )
            );
          }
        );

        const currentContract =
          contracts.find(
            workspaceDashboardContractIsCurrent_
          ) ||
          contracts[0] ||
          {};

        const tenantBills =
          (
            billsByTenantId[
              tenantId
            ] ||
            []
          ).slice();

        tenantBills.sort(
          function (a, b) {
            const monthCompare =
              workspaceDashboardNormalizeMonth_(
                b.bill_month
              ).localeCompare(
                workspaceDashboardNormalizeMonth_(
                  a.bill_month
                )
              );

            if (
              monthCompare !==
              0
            ) {
              return monthCompare;
            }

            return (
              workspaceDashboardRowTime_(
                b
              ) -
              workspaceDashboardRowTime_(
                a
              )
            );
          }
        );

        const latestBill =
          tenantBills[0] ||
          {};

        const unpaidBills =
          tenantBills.filter(
            function (bill) {
              return (
                workspaceDashboardPaymentStatus_(
                  bill.payment_status
                ) ===
                'unpaid'
              );
            }
          );

        const tenantUserId =
          workspaceDashboardText_(
            tenant.tenant_user_id ||
            tenant.user_id ||
            view.tenant_user_id ||
            view.user_id ||
            currentContract
              .tenant_user_id
          );

        const user =
          userById[
            tenantUserId
          ] ||
          {};

        const tenantLineUserId =
          workspaceDashboardResolveTenantLineUid_(
            data,
            tenantId,
            tenantUserId,
            currentContract.contract_id,
            tenant.tenant_line_user_id ||
            tenant.line_user_id ||
            view.tenant_line_user_id ||
            currentContract
              .tenant_line_user_id ||
            latestBill
              .tenant_line_user_id
          );

        const roomNames = {};

        contracts.forEach(
          function (contract) {
            const roomName =
              workspaceDashboardText_(
                contract.room_name
              );

            if (roomName) {
              roomNames[
                roomName
              ] = true;
            }
          }
        );

        const roomList =
          workspaceDashboardText_(
            view.room_list ||
            tenant.room_list ||
            currentContract.room_name
          ) ||
          Object.keys(
            roomNames
          ).sort(
            workspaceDashboardCompareText_
          ).join(
            '、'
          );

        return {
          line_user_id:
            access.line_user_id ||
            '',

          user_id:
            access.user.user_id ||
            '',

          landlord_id:
            access.principal_landlord_id ||
            '',

          landlord_name:
            access.principal
              .landlord_name ||
            access.user.name ||
            '房東',

          tenant_line_user_id:
            tenantLineUserId,

          tenant_user_id:
            tenantUserId,

          tenant_id:
            tenantId,

          tenant_name:
            workspaceDashboardText_(
              tenant.tenant_name ||
              tenant.name ||
              view.tenant_name ||
              currentContract
                .tenant_name ||
              latestBill.tenant_name ||
              user.name
            ),

          tenant_phone:
            workspaceDashboardText_(
              tenant.tenant_phone ||
              tenant.phone ||
              view.tenant_phone ||
              user.phone
            ),

          tenant_email:
            workspaceDashboardText_(
              tenant.tenant_email ||
              tenant.email ||
              view.tenant_email ||
              user.email
            ),

          tenant_binding_status:
            tenantLineUserId
              ? 'bound'
              : 'unbound',

          room_list:
            roomList,

          latest_bill_month:
            workspaceDashboardNormalizeMonth_(
              latestBill.bill_month
            ) ||
            workspaceDashboardText_(
              latestBill.bill_month
            ),

          latest_due_date:
            workspaceDashboardFormatDate_(
              latestBill.due_date
            ),

          latest_total_amount:
            workspaceDashboardNumber_(
              latestBill.total_amount
            ),

          latest_payment_status:
            latestBill.bill_id
              ? workspaceDashboardPaymentStatus_(
                  latestBill.payment_status
                )
              : '',

          unpaid_bill_count:
            unpaidBills.length,

          unpaid_total_amount:
            workspaceDashboardSum_(
              unpaidBills,
              'total_amount'
            ),

          tenant_account_status:
            workspaceDashboardText_(
              tenant.account_status ||
              tenant.tenant_account_status ||
              view.tenant_account_status ||
              user.account_status ||
              'active'
            ),

          current_contract_id:
            workspaceDashboardText_(
              currentContract.contract_id
            ),

          current_contract_status:
            workspaceDashboardText_(
              currentContract.contract_status ||
              currentContract.status
            ),

          updated_at:
            tenant.updated_at ||
            view.updated_at ||
            currentContract.updated_at ||
            latestBill.updated_at ||
            ''
        };
      }
    )
    .filter(
      function (tenant) {
        return Boolean(
          tenant.tenant_id ||
          tenant.tenant_name
        );
      }
    )
    .sort(
      function (a, b) {
        const roomCompare =
          workspaceDashboardCompareText_(
            a.room_list,
            b.room_list
          );

        if (
          roomCompare !==
          0
        ) {
          return roomCompare;
        }

        return workspaceDashboardCompareText_(
          a.tenant_name,
          b.tenant_name
        );
      }
    );
}


// ==================================================
// Tenant LINE binding resolver
// ==================================================

function workspaceDashboardResolveTenantLineUid_(
  data,
  tenantId,
  tenantUserId,
  contractId,
  directValue
) {
  const candidates = [];

  function add(
    value
  ) {
    value =
      workspaceDashboardText_(
        value
      );

    if (
      value &&
      /^U[a-zA-Z0-9_-]{20,}$/.test(
        value
      ) &&
      candidates.indexOf(
        value
      ) < 0
    ) {
      candidates.push(
        value
      );
    }
  }

  add(
    directValue
  );

  tenantId =
    workspaceDashboardText_(
      tenantId
    ).toUpperCase();

  tenantUserId =
    workspaceDashboardText_(
      tenantUserId
    );

  contractId =
    workspaceDashboardText_(
      contractId
    );

  data.tenants.forEach(
    function (tenant) {
      if (
        tenantId &&
        workspaceDashboardText_(
          tenant.tenant_id
        ).toUpperCase() ===
          tenantId
      ) {
        add(
          tenant.tenant_line_user_id ||
          tenant.line_user_id
        );
      }
    }
  );

  data.users.forEach(
    function (user) {
      if (
        tenantUserId &&
        workspaceDashboardText_(
          user.user_id
        ) ===
          tenantUserId
      ) {
        add(
          user.line_user_id ||
          user.tenant_line_user_id
        );
      }
    }
  );

  data.tenant_view_rows.forEach(
    function (row) {
      if (
        tenantId &&
        workspaceDashboardText_(
          row.tenant_id
        ).toUpperCase() ===
          tenantId
      ) {
        add(
          row.tenant_line_user_id
        );
      }
    }
  );

  data.contracts.forEach(
    function (contract) {
      const matches =
        (
          tenantId &&
          workspaceDashboardText_(
            contract.tenant_id
          ).toUpperCase() ===
            tenantId
        ) ||
        (
          contractId &&
          workspaceDashboardText_(
            contract.contract_id
          ) ===
            contractId
        );

      if (matches) {
        add(
          contract.tenant_line_user_id
        );
      }
    }
  );

  data.bills.forEach(
    function (bill) {
      if (
        tenantId &&
        workspaceDashboardText_(
          bill.tenant_id
        ).toUpperCase() ===
          tenantId
      ) {
        add(
          bill.tenant_line_user_id
        );
      }
    }
  );

  return candidates.length ===
    1
    ? candidates[0]
    : (
        candidates.length > 0
          ? candidates[0]
          : ''
      );
}


// ==================================================
// Contract, reminder and formatting helpers
// ==================================================

function workspaceDashboardContractIsCurrent_(
  contract
) {
  const status =
    workspaceDashboardText_(
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
    workspaceDashboardToday_();

  const start =
    workspaceDashboardDate_(
      contract.start_date ||
      contract.contract_start_date ||
      contract.lease_start_date
    );

  const end =
    workspaceDashboardDate_(
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
    'active',
    'current',
    'effective',
    'signed',
    'approved'
  ].indexOf(
    status
  ) >= 0;
}


function workspaceDashboardContractTime_(
  contract
) {
  const candidates = [
    contract.start_date,
    contract.contract_start_date,
    contract.lease_start_date,
    contract.updated_at,
    contract.created_at
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const date =
      workspaceDashboardDate_(
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


function workspaceDashboardReminderStatus_(
  daysOverdue,
  reminderCount,
  lastStage,
  manualFollowUp
) {
  if (manualFollowUp) {
    return 'manual_follow_up';
  }

  if (
    daysOverdue < 2
  ) {
    return 'waiting';
  }

  if (
    lastStage >= 3
  ) {
    return 'final_sent';
  }

  if (
    reminderCount > 0 ||
    lastStage > 0
  ) {
    return 'reminding';
  }

  return 'ready';
}


function workspaceDashboardNextReminderDay_(
  daysOverdue,
  lastStage,
  manualFollowUp
) {
  if (manualFollowUp) {
    return 0;
  }

  const days = [
    2,
    5,
    8
  ];

  for (
    let index =
      Math.max(
        0,
        Math.round(
          lastStage
        )
      );
    index < days.length;
    index += 1
  ) {
    if (
      daysOverdue <
      days[index]
    ) {
      return days[index];
    }
  }

  return 0;
}


function workspaceDashboardDaysOverdue_(
  value,
  today
) {
  const dueDate =
    workspaceDashboardDate_(
      value
    );

  if (!dueDate) {
    return 0;
  }

  const diff =
    Math.floor(
      (
        today.getTime() -
        dueDate.getTime()
      ) /
      86400000
    );

  return Math.max(
    0,
    diff
  );
}


function workspaceDashboardToday_() {
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


function workspaceDashboardAttachContext_(
  result,
  access
) {
  if (
    typeof workspaceLandlordAttachContext_ ===
    'function'
  ) {
    return workspaceLandlordAttachContext_(
      result,
      access
    );
  }

  return result;
}


function workspaceDashboardSum_(
  rows,
  header
) {
  return (
    rows ||
    []
  ).reduce(
    function (
      total,
      row
    ) {
      return (
        total +
        workspaceDashboardNumber_(
          row[
            header
          ]
        )
      );
    },
    0
  );
}


function workspaceDashboardPaymentStatus_(
  value
) {
  const status =
    workspaceDashboardText_(
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


function workspaceDashboardBoolean_(
  value
) {
  if (
    value ===
    true
  ) {
    return true;
  }

  const text =
    workspaceDashboardText_(
      value
    ).toLowerCase();

  return [
    'true',
    '1',
    'yes',
    'y',
    'on'
  ].indexOf(
    text
  ) >= 0;
}


function workspaceDashboardNormalizeMonth_(
  value
) {
  const date =
    workspaceDashboardDate_(
      value
    );

  if (
    value instanceof Date ||
    (
      typeof value ===
        'number' &&
      value >= 20000
    )
  ) {
    return date
      ? Utilities.formatDate(
          date,
          'Asia/Taipei',
          'yyyy-MM'
        )
      : '';
  }

  const text =
    workspaceDashboardText_(
      value
    );

  const compact =
    text.match(
      /^(\d{4})(\d{2})$/
    );

  if (compact) {
    return (
      compact[1] +
      '-' +
      compact[2]
    );
  }

  const match =
    text.match(
      /^(\d{4})[-\/年](\d{1,2})/
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


function workspaceDashboardDate_(
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
    const copy =
      new Date(
        value.getTime()
      );

    copy.setHours(
      0,
      0,
      0,
      0
    );

    return copy;
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

    const date =
      new Date(
        base.getTime() +
        Math.floor(
          value
        ) *
        86400000
      );

    date.setHours(
      0,
      0,
      0,
      0
    );

    return date;
  }

  const text =
    workspaceDashboardText_(
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

    date.setHours(
      0,
      0,
      0,
      0
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

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  parsed.setHours(
    0,
    0,
    0,
    0
  );

  return parsed;
}


function workspaceDashboardFormatDate_(
  value
) {
  const date =
    workspaceDashboardDate_(
      value
    );

  return date
    ? Utilities.formatDate(
        date,
        'Asia/Taipei',
        'yyyy-MM-dd'
      )
    : workspaceDashboardText_(
        value
      );
}


function workspaceDashboardRowTime_(
  row
) {
  const candidates = [
    row.updated_at,
    row.created_at,
    row.due_date,
    row.bill_month
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const date =
      workspaceDashboardDate_(
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


function workspaceDashboardCompareText_(
  a,
  b
) {
  return workspaceDashboardText_(
    a
  ).localeCompare(
    workspaceDashboardText_(
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


function workspaceDashboardText_(
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


function workspaceDashboardNumber_(
  value
) {
  const number =
    Number(
      workspaceDashboardText_(
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

function testWorkspaceLandlordHomeNative() {
  const result =
    getWorkspaceLandlordHomeNativeByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID')
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


function testWorkspaceLandlordArrearsNative() {
  const result =
    getWorkspaceLandlordArrearsNativeByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID')
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


function testWorkspaceLandlordTenantsNative() {
  const result =
    getWorkspaceLandlordTenantsNativeByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID')
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

