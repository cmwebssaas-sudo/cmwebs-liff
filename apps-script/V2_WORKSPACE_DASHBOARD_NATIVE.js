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
 * - getWorkspaceLandlordPaymentCalendarNativeByLineUid_
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 * - V2_WORKSPACE_LANDLORD_ACCESS.gs
 * - V2_API.gs（landlordContractHistoryView_）
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

      const lineUidLookup = workspaceDashboardLineUidLookup_(data);

      const arrears =
        data.bills
          .filter(
            function (bill) {
              return v2CanonicalBillIsOutstanding_(
                bill
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
                    bill.tenant_line_user_id,
                    lineUidLookup
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


/**
 * 繳費月曆：本月與前兩個月，每間房一列。
 * 已繳／未繳沿用欠款頁的 canonical 規則，兩邊的數字才會一致。
 * 只回傳房間、房客姓名與帳單金額，不回傳 LINE ID、電話或銀行資料。
 */
function getWorkspaceLandlordPaymentCalendarNativeByLineUid_(
  lineUserId
) {
  return workspaceDashboardExecute_(
    lineUserId,
    'landlord_payment_calendar',
    function (
      ss,
      access,
      data
    ) {
      return workspaceDashboardAttachContext_(
        {
          success: true,
          code: 'OK',
          message: '查詢成功',
          data: workspacePaymentCalendarBuild_(
            data,
            workspaceDashboardToday_()
          )
        },
        access
      );
    }
  );
}


const WORKSPACE_PAYMENT_CALENDAR_MONTH_COUNT_ = 3;

// 越前面越需要房東處理；三個月的排序以每間房最差的狀態為準。
const WORKSPACE_PAYMENT_CALENDAR_RANK_ = {
  overdue: 0,
  unpaid: 1,
  no_bill: 2,
  paid: 3,
  vacant: 4
};


function workspacePaymentCalendarBuild_(
  data,
  today
) {
  const text = workspaceDashboardText_;
  const currentMonth = workspaceDashboardNormalizeMonth_(today);
  const months = [];

  for (
    let offset = WORKSPACE_PAYMENT_CALENDAR_MONTH_COUNT_ - 1;
    offset >= 0;
    offset -= 1
  ) {
    months.push(workspacePaymentCalendarShiftMonth_(currentMonth, -offset));
  }

  const propertyNames = {};
  (data.properties || []).forEach(function (property) {
    const propertyId = text(property.property_id);
    if (propertyId) {
      propertyNames[propertyId] = text(property.property_name);
    }
  });

  const tenantNames = {};
  (data.tenants || []).forEach(function (tenant) {
    const tenantId = text(tenant.tenant_id).toUpperCase();
    if (tenantId) {
      tenantNames[tenantId] = text(tenant.tenant_name || tenant.name);
    }
  });

  const rowsByKey = {};
  const rows = [];

  function rowFor(key, source) {
    if (!rowsByKey[key]) {
      const propertyId = text(source.property_id);
      rowsByKey[key] = {
        room_id: text(source.room_id),
        room_name: text(source.room_name) || text(source.room_id) || '未指定房間',
        property_id: propertyId,
        property_name: propertyNames[propertyId] || '',
        tenant_id: '',
        tenant_name: '',
        occupied_now: false,
        bills_by_month: {},
        leases_by_month: {}
      };
      rows.push(rowsByKey[key]);
    }
    return rowsByKey[key];
  }

  (data.rooms || []).forEach(function (room) {
    const roomId = text(room.room_id);
    if (!roomId || !workspaceDashboardRoomIsOperational_(room)) {
      return;
    }
    const row = rowFor(roomId, room);
    const roomStatus = text(room.room_status || room.status).toLowerCase();
    const currentTenantId = text(room.current_tenant_id).toUpperCase();
    row.occupied_now = Boolean(
      currentTenantId ||
      text(room.current_contract_id) ||
      ['occupied', 'rented', 'leased', '已入住'].indexOf(roomStatus) >= 0
    );
    if (currentTenantId) {
      row.tenant_id = currentTenantId;
      row.tenant_name = tenantNames[currentTenantId] || '';
    }
  });

  // 停用房間若在這三個月仍有帳單，也要列出來，未繳帳單才不會漏看。
  (data.bills || []).forEach(function (bill) {
    if (v2CanonicalBillIsVoided_(bill)) {
      return;
    }
    const month = workspaceDashboardNormalizeMonth_(bill.bill_month);
    if (months.indexOf(month) < 0) {
      return;
    }
    const key = text(bill.room_id) || 'bill:' + text(bill.bill_id);
    const row = rowFor(key, bill);
    (row.bills_by_month[month] = row.bills_by_month[month] || []).push(bill);
  });

  (data.contracts || []).forEach(function (contract) {
    const row = rowsByKey[text(contract.room_id)];
    if (!row || !workspacePaymentCalendarContractCounts_(contract)) {
      return;
    }
    const start = workspaceDashboardDate_(
      contract.start_date ||
      contract.contract_start_date ||
      contract.lease_start_date
    );
    let end = workspaceDashboardDate_(
      contract.end_date ||
      contract.contract_end_date ||
      contract.lease_end_date
    );
    const moveOut = workspaceDashboardDate_(contract.checkout_move_out_date);
    if (moveOut && (!end || moveOut.getTime() < end.getTime())) {
      end = moveOut;
    }
    if (!start && !end && !workspaceDashboardContractIsCurrent_(contract)) {
      return;
    }
    months.forEach(function (month) {
      const bounds = workspacePaymentCalendarMonthBounds_(month);
      if (!start && !end && month !== currentMonth) {
        return;
      }
      if (
        (start && start.getTime() > bounds.last.getTime()) ||
        (end && end.getTime() < bounds.first.getTime())
      ) {
        return;
      }
      row.leases_by_month[month] = contract;
    });
  });

  rows.forEach(function (row) {
    row.cells = months.map(function (month) {
      return workspacePaymentCalendarCell_(
        row,
        month,
        month === currentMonth,
        today
      );
    });

    // tenant_id lets the landlord open the tenant from the calendar. A name
    // and ID are only combined when they belong to the same person.
    for (
      let index = months.length - 1;
      index >= 0 && !(row.tenant_id && row.tenant_name);
      index -= 1
    ) {
      const bills = row.bills_by_month[months[index]] || [];
      const source = bills.length > 0
        ? bills[bills.length - 1]
        : row.leases_by_month[months[index]];
      if (!source) {
        continue;
      }
      const tenantId = text(source.tenant_id).toUpperCase();
      const tenantName = text(source.tenant_name) || tenantNames[tenantId] || '';
      if (
        (row.tenant_id && tenantId && tenantId !== row.tenant_id) ||
        (row.tenant_name && tenantName && tenantName !== row.tenant_name)
      ) {
        continue;
      }
      row.tenant_id = row.tenant_id || tenantId;
      row.tenant_name = row.tenant_name || tenantName;
    }

    row.worst_status = row.cells.reduce(function (worst, cell) {
      return WORKSPACE_PAYMENT_CALENDAR_RANK_[cell.status] <
        WORKSPACE_PAYMENT_CALENDAR_RANK_[worst]
        ? cell.status
        : worst;
    }, 'vacant');
    row.max_days_overdue = row.cells.reduce(function (max, cell) {
      return Math.max(max, cell.days_overdue);
    }, 0);
    row.unpaid_amount = row.cells.reduce(function (total, cell) {
      return total + cell.unpaid_amount;
    }, 0);

    delete row.bills_by_month;
    delete row.leases_by_month;
    delete row.occupied_now;
  });

  rows.sort(function (a, b) {
    return (
      WORKSPACE_PAYMENT_CALENDAR_RANK_[a.worst_status] -
        WORKSPACE_PAYMENT_CALENDAR_RANK_[b.worst_status] ||
      b.max_days_overdue - a.max_days_overdue ||
      workspaceDashboardCompareText_(a.property_name, b.property_name) ||
      workspaceDashboardCompareText_(a.room_name, b.room_name)
    );
  });

  return {
    as_of: workspaceDashboardFormatDate_(today),
    current_month: currentMonth,
    months: months.map(function (month, index) {
      const counts = {
        paid: 0,
        unpaid: 0,
        overdue: 0,
        no_bill: 0,
        vacant: 0
      };
      let paidAmount = 0;
      let unpaidAmount = 0;

      rows.forEach(function (row) {
        const cell = row.cells[index];
        counts[cell.status] += 1;
        paidAmount += cell.total_amount - cell.unpaid_amount;
        unpaidAmount += cell.unpaid_amount;
      });

      return {
        month: month,
        room_count: rows.length,
        billed_count: counts.paid + counts.unpaid + counts.overdue,
        paid_count: counts.paid,
        unpaid_count: counts.unpaid,
        overdue_count: counts.overdue,
        no_bill_count: counts.no_bill,
        vacant_count: counts.vacant,
        paid_amount: paidAmount,
        unpaid_amount: unpaidAmount
      };
    }),
    rooms: rows
  };
}


function workspacePaymentCalendarCell_(
  row,
  month,
  isCurrentMonth,
  today
) {
  const bills = row.bills_by_month[month] || [];
  const cell = {
    month: month,
    status: '',
    bill_count: bills.length,
    total_amount: 0,
    unpaid_amount: 0,
    days_overdue: 0,
    due_date: ''
  };

  if (bills.length === 0) {
    cell.status =
      row.leases_by_month[month] || (isCurrentMonth && row.occupied_now)
        ? 'no_bill'
        : 'vacant';
    return cell;
  }

  let earliestUnpaidDue = '';
  bills.forEach(function (bill) {
    const amount = workspaceDashboardNumber_(bill.total_amount);
    const dueDate = workspaceDashboardFormatDate_(bill.due_date);
    cell.total_amount += amount;
    if (!v2CanonicalBillIsOutstanding_(bill)) {
      return;
    }
    cell.unpaid_amount += amount;
    cell.days_overdue = Math.max(
      cell.days_overdue,
      workspaceDashboardDaysOverdue_(bill.due_date, today)
    );
    if (dueDate && (!earliestUnpaidDue || dueDate < earliestUnpaidDue)) {
      earliestUnpaidDue = dueDate;
    }
  });

  const hasUnpaid = bills.some(v2CanonicalBillIsOutstanding_);
  cell.status = !hasUnpaid
    ? 'paid'
    : cell.days_overdue > 0
      ? 'overdue'
      : 'unpaid';
  cell.due_date =
    earliestUnpaidDue ||
    workspaceDashboardFormatDate_(bills[bills.length - 1].due_date);
  return cell;
}


function workspacePaymentCalendarContractCounts_(
  contract
) {
  const status = workspaceDashboardText_(
    contract.contract_status ||
    contract.status
  ).toLowerCase();

  // 已結束或到期的租約仍代表當時有人住；未生效或作廢的不算。
  return !(
    /^pending/.test(status) ||
    [
      'draft',
      'void',
      'voided',
      'cancelled',
      'canceled',
      'rejected',
      'deleted',
      'archived'
    ].indexOf(status) >= 0
  );
}


function workspacePaymentCalendarShiftMonth_(
  month,
  delta
) {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + delta;
  const shiftedYear = year + Math.floor(index / 12);
  const shiftedMonth = ((index % 12) + 12) % 12 + 1;

  return String(shiftedYear) + '-' + String(shiftedMonth).padStart(2, '0');
}


function workspacePaymentCalendarMonthBounds_(
  month
) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;

  return {
    first: new Date(year, monthIndex, 1),
    last: new Date(year, monthIndex + 1, 0)
  };
}


function getWorkspaceLandlordTenantsNativeByLineUid_(
  lineUserId,
  readView
) {
  const result = workspaceDashboardExecute_(
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
          data,
          true
        );

      const tenants =
        workspaceDashboardBuildTenantList_(
          access,
          data,
          readView
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
  return readView === 'summary'
    ? workspaceLandlordReadSummary_(result, 'tenants') : result;
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
            true,
          skip_schema_ensure:
            true
        }
      );

    if (!access.success) {
      return access;
    }

    const ss =
      runtimeSpreadsheet_();

    const data =
      workspaceDashboardLoadData_(
        ss,
        access,
        {
          mode:
            action === 'landlord_arrears'
              ? 'arrears'
              : action === 'landlord_home'
                ? 'home'
                : action === 'landlord_payment_calendar'
                  ? 'calendar'
                  : 'full'
        }
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
  access,
  options
) {
  options = options || {};
  const mode =
    workspaceDashboardText_(
      options.mode || 'full'
    ).toLowerCase();
  const arrearsOnly = mode === 'arrears';

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
    arrearsOnly
      ? []
      : workspaceDashboardRowsForAccess_(
          ss.getSheetByName(
            V2_WORKSPACE_DASHBOARD_SHEETS_
              .rooms
          ),
          access,
          propertyIdMap
        );

  const contracts =
    arrearsOnly
      ? []
      : workspaceDashboardRowsForAccess_(
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

  if (arrearsOnly) {
    return {
      properties:
        propertyRows,
      property_id_map:
        propertyIdMap,
      rooms: [],
      contracts: [],
      tenants: [],
      users: [],
      bills: bills,
      tenant_view_rows: []
    };
  }

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

  // The payment calendar needs room, lease, bill and tenant names only.
  if (mode === 'calendar') {
    return {
      properties:
        propertyRows,
      property_id_map:
        propertyIdMap,
      rooms: rooms,
      contracts: contracts,
      tenants: tenants,
      users: [],
      bills: bills,
      tenant_view_rows: []
    };
  }

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
    mode === 'home'
      ? null
      : ss.getSheetByName(
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

  if (typeof workspaceLandlordLegacyParentsMatchAccess_ === 'function' &&
    !workspaceLandlordLegacyParentsMatchAccess_(row,access)) return false;

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
  data,
  landlordSummaryOnly
) {
  const activeRooms =
    data.rooms.filter(
      workspaceDashboardRoomIsOperational_
    );

  const activeContracts =
    data.contracts.filter(
      workspaceDashboardContractIsCurrent_
    );

  const tenantsById = {};
  const roomsById = {};

  data.tenants.forEach(function (tenant) {
    const tenantId = workspaceDashboardText_(tenant.tenant_id).toUpperCase();
    if (tenantId) {
      tenantsById[tenantId] = tenant;
    }
  });

  data.rooms.forEach(function (room) {
    const roomId = workspaceDashboardText_(room.room_id);
    if (roomId) {
      roomsById[roomId] = room;
    }
  });

  const activeTenantIds = {};

  activeContracts.forEach(
    function (contract) {
      const tenantId =
        workspaceDashboardText_(
          contract.tenant_id
        ).toUpperCase();

      if (tenantId) {
        const tenant = tenantsById[tenantId] || {};

        if (
          workspaceDashboardTenantIsOperational_(tenant) &&
          workspaceDashboardContractRoomIsOperational_(
            contract,
            roomsById
          )
        ) {
          activeTenantIds[tenantId] = true;
        }
      }
    }
  );

  // Tenant responses consume only the landlord summary. Keep its operational
  // counts and current timestamp, without computing discarded home bill KPIs.
  if (landlordSummaryOnly === true) {
    const principal = access.principal || {};
    const currentUser = access.user || {};
    return {
      line_user_id: access.line_user_id || principal.line_user_id || '',
      user_id: currentUser.user_id || principal.landlord_user_id || '',
      landlord_id: principal.landlord_id || access.principal_landlord_id || '',
      landlord_name: principal.landlord_name || currentUser.name ||
        access.membership.display_name || '房東',
      room_count: activeRooms.length,
      tenant_count: Object.keys(activeTenantIds).length,
      account_status: 'active',
      updated_at: new Date()
    };
  }

  const activeBills =
    data.bills.filter(
      function (bill) {
        return !v2CanonicalBillIsVoided_(
          bill
        );
      }
    );

  const latestMonth =
    activeBills.reduce(
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
      ? activeBills.filter(
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
        return v2CanonicalBillIsOutstanding_(
          bill
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


/**
 * Operational rooms are the only rooms that may appear in current landlord
 * counts and current-tenant workflows.  Historical room rows are retained but
 * inactive, archived, unavailable, and maintenance rooms are deliberately
 * excluded from operational summaries.
 */
function workspaceDashboardRoomIsOperational_(
  room
) {
  const accountStatus =
    workspaceDashboardText_(
      room && room.account_status ||
      'active'
    ).toLowerCase();

  return [
    'active',
    'enabled',
    '啟用',
    '正常'
  ].indexOf(accountStatus) >= 0;
}


function workspaceDashboardTenantIsOperational_(
  tenant
) {
  const accountStatus =
    workspaceDashboardText_(
      tenant && (
        tenant.account_status ||
        tenant.tenant_account_status ||
        tenant.status
      ) ||
      'active'
    ).toLowerCase();

  return [
    'active',
    'enabled',
    '啟用',
    '正常'
  ].indexOf(accountStatus) >= 0;
}


function workspaceDashboardContractRoomIsOperational_(
  contract,
  roomsById
) {
  const roomId =
    workspaceDashboardText_(
      contract && contract.room_id
    );

  if (!roomId) {
    return true;
  }

  const room = roomsById[roomId];

  return Boolean(
    room &&
    workspaceDashboardRoomIsOperational_(room)
  );
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
  data,
  readView
) {
  const lineUidLookup = workspaceDashboardLineUidLookup_(data);
  const tenantById = {};
  const userById = {};
  const viewByTenantId = {};
  const contractsByTenantId = {};
  const billsByTenantId = {};
  const roomsById = {};

  data.rooms.forEach(
    function (room) {
      const roomId =
        workspaceDashboardText_(
          room.room_id
        );

      if (roomId) {
        roomsById[roomId] = room;
      }
    }
  );

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
            function (contract) {
              // Scheduled paper records always need the exact association
              // fallback, including after their start date has arrived.
              const scheduledPaper = contract.contract_origin === 'paper_backfill' &&
                contract.signing_mode === 'paper_backfill' &&
                ['upcoming', 'pending_start'].indexOf(workspaceDashboardText_(contract.contract_status || contract.status).toLowerCase()) >= 0;
              return !scheduledPaper && workspaceDashboardContractIsCurrent_(contract);
            }
          ) ||
          contracts.find(function (contract) {
            return workspaceDashboardUpcomingPaperBackfillForTenant_(
              contract, tenant, roomsById, access
            );
          }) ||
          contracts.find(
            workspaceDashboardContractIsRenewalRecoveryEligible_
          ) ||
          {};

        if (
          !workspaceDashboardTenantIsOperational_(
            tenant
          ) ||
          !currentContract.contract_id ||
          !workspaceDashboardContractRoomIsOperational_(
            currentContract,
            roomsById
          )
        ) {
          return null;
        }

        // Case-folded map keys are only for lookup; API consumers need the
        // stored identity for exact contract, document and meter associations.
        const canonicalTenantId =
          workspaceDashboardText_(
            tenant.tenant_id ||
            currentContract.tenant_id ||
            view.tenant_id
          );

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
              return v2CanonicalBillIsOutstanding_(
                bill
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
              .tenant_line_user_id,
            lineUidLookup
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
            canonicalTenantId,

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

          property_id:
            workspaceDashboardText_(
              currentContract.property_id ||
              view.property_id ||
              tenant.property_id
            ),

          room_id:
            workspaceDashboardText_(
              currentContract.room_id ||
              view.room_id ||
              tenant.room_id
            ),

          contract_end_date:
            workspaceDashboardFormatDate_(
              currentContract.end_date ||
              currentContract.contract_end_date ||
              currentContract.lease_end_date
            ),

          contract_start_date:
            workspaceDashboardFormatDate_(
              currentContract.start_date ||
              currentContract.contract_start_date ||
              currentContract.lease_start_date
            ),

          current_contract_status:
            contractRenewalHistoryEffectiveStatus_(currentContract),

          // The summary projection removes this entire field. Keep default
          // readers complete and skip only work the explicit summary discards.
          contract_history:
            readView !== 'summary' &&
            typeof landlordContractHistoryView_ ===
              'function'
              ? landlordContractHistoryView_(
                  contracts,
                  {
                    tenant_id:
                      canonicalTenantId,
                    workspace_id:
                      access.workspace &&
                      access.workspace.workspace_id,
                    room_id:
                      currentContract.room_id,
                    current_contract_id:
                      currentContract.contract_id
                  },
                  null
                )
              : [],

          updated_at:
            tenant.updated_at ||
            view.updated_at ||
            currentContract.updated_at ||
            latestBill.updated_at ||
            ''
        };
      }
    )
    .filter(Boolean)
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

function workspaceDashboardLineUidLookup_(data) {
  const lists = [
    ['tenants', 'tenant_id', true],
    ['users', 'user_id', false],
    ['tenant_view_rows', 'tenant_id', true],
    ['contracts', 'tenant_id', true],
    ['contracts', 'contract_id', false],
    ['bills', 'tenant_id', true]
  ];
  // The builder reads status, rooms and dates before resolving a binding.
  // Only inert Sheet cells may be indexed: accessors or custom coercion could
  // otherwise mutate a key after map construction. Unusual snapshots scan.
  for (const name of ['rooms', 'tenants', 'users', 'tenant_view_rows', 'contracts', 'bills']) {
    const collection = Object.getOwnPropertyDescriptor(data, name);
    if (!collection || collection.get || collection.set || !Array.isArray(collection.value)) return null;
    for (const row of collection.value) {
      if (!row || typeof row !== 'object') return null;
      const prototype = Object.getPrototypeOf(row);
      if (prototype !== null && prototype !== Object.prototype) return null;
      for (const field of Reflect.ownKeys(row)) {
        if (typeof field !== 'string') return null;
        const descriptor = Object.getOwnPropertyDescriptor(row, field);
        if (!descriptor || descriptor.get || descriptor.set) return null;
        const value = descriptor.value;
        if (value !== null && !['undefined', 'string', 'number', 'boolean'].includes(typeof value)) {
          // Native dates have no custom properties/coercion; subclasses and
          // decorated dates retain the original conditional behavior instead.
          if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Date.prototype || Reflect.ownKeys(value).length) return null;
          // A Proxy can imitate the prototype/keys but lacks Date's internal
          // slot. Invoke the intrinsic, never a source method or valueOf trap.
          try { Date.prototype.getTime.call(value); } catch (_) { return null; }
        }
      }
      for (const field of ['tenant_id', 'user_id', 'tenant_user_id', 'contract_id', 'line_user_id', 'tenant_line_user_id']) {
        const descriptor = Object.getOwnPropertyDescriptor(row, field);
        if (!descriptor && field in row) return null;
        const value = descriptor && descriptor.value;
        if (value !== null && !['undefined', 'string', 'number', 'boolean'].includes(typeof value)) return null;
      }
    }
  }
  const maps = lists.map(function (definition) {
    const map = new Map();
    data[definition[0]].forEach(function (row, index) {
      const text = workspaceDashboardText_(row[definition[1]]);
      const key = definition[2] ? text.toUpperCase() : text;
      if (!key) return;
      const matches = map.get(key) || [];
      matches.push({ row: row, index: index });
      map.set(key, matches);
    });
    return map;
  });
  function rows(map, key) { return (map.get(key) || []).map(function (item) { return item.row; }); }
  return {
    tenants: function (key) { return rows(maps[0], key); },
    users: function (key) { return rows(maps[1], key); },
    views: function (key) { return rows(maps[2], key); },
    bills: function (key) { return rows(maps[5], key); },
    contracts: function (tenant, contract) {
      const matches = new Map();
      for (const item of (maps[3].get(tenant) || []).concat(maps[4].get(contract) || [])) matches.set(item.index, item.row);
      return Array.from(matches).sort(function (a, b) { return a[0] - b[0]; }).map(function (item) { return item[1]; });
    }
  };
}

function workspaceDashboardResolveTenantLineUid_(
  data,
  tenantId,
  tenantUserId,
  contractId,
  directValue,
  lookup
) {
  // Coercing unusual caller values can mutate later source keys. Keep those
  // calls on the original scans, before any normalization or candidate read.
  if ([tenantId, tenantUserId, contractId, directValue].some(function (value) {
    return value !== null && !['undefined', 'string', 'number', 'boolean'].includes(typeof value);
  })) lookup = null;
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

  (lookup ? lookup.tenants(tenantId) : data.tenants).forEach(
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

  (lookup ? lookup.users(tenantUserId) : data.users).forEach(
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

  (lookup ? lookup.views(tenantId) : data.tenant_view_rows).forEach(
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

  (lookup ? lookup.contracts(tenantId, contractId) : data.contracts).forEach(
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

  (lookup ? lookup.bills(tenantId) : data.bills).forEach(
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

  // 尚未簽署完成的續約版本不能取代原租約；起租日已過也一樣。
  if (
    workspaceDashboardContractIsUnsignedRenewal_(
      contract,
      status
    )
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


function workspaceDashboardContractIsUnsignedRenewal_(
  contract,
  status
) {
  const text = workspaceDashboardText_;
  const renewal =
    text(contract.signing_mode).toLowerCase() === 'renewal' ||
    Boolean(text(contract.renewed_from_contract_id)) ||
    Boolean(text(contract.previous_contract_id));

  return renewal && [
    'pending_landlord_review',
    'pending_tenant_signature',
    'awaiting_tenant_signature'
  ].indexOf(status) >= 0;
}


function workspaceDashboardUpcomingPaperBackfillForTenant_(contract, tenant, roomsById, access) {
  const text = workspaceDashboardText_;
  const room = roomsById[text(contract.room_id)];
  const workspaceId = text(access.workspace.workspace_id);
  const start = workspaceDashboardDate_(contract.start_date || contract.contract_start_date);
  const end = workspaceDashboardDate_(contract.end_date || contract.contract_end_date);
  // A future electronic/unknown contract is not tenancy evidence. A signed
  // paper backfill is discoverable only through its exact current associations.
  return Boolean(
    room && workspaceId &&
    text(contract.workspace_id) === workspaceId &&
    text(tenant.workspace_id) === workspaceId &&
    text(room.workspace_id) === workspaceId &&
    text(room.property_id) &&
    text(contract.property_id) === text(room.property_id) &&
    text(tenant.property_id) === text(room.property_id) &&
    text(contract.contract_origin) === 'paper_backfill' &&
    text(contract.signing_mode) === 'paper_backfill' &&
    ['upcoming', 'pending_start'].indexOf(text(contract.contract_status || contract.status).toLowerCase()) >= 0 &&
    text(contract.contract_id) && text(contract.tenant_id) === text(tenant.tenant_id) &&
    text(room.current_contract_id) === text(contract.contract_id) &&
    text(tenant.current_contract_id) === text(contract.contract_id) &&
    text(room.current_tenant_id) === text(tenant.tenant_id) &&
    text(tenant.room_id) === text(room.room_id) &&
    start && end && end.getTime() >= start.getTime()
  );
}


/**
 * Keep an operational tenant visible when the latest contract has just
 * expired and no renewal draft was created before the expiry date.  This is
 * only a read-model fallback for the manual renewal entry; it does not make
 * an expired contract current or mutate the contract history.
 */
function workspaceDashboardContractIsRenewalRecoveryEligible_(
  contract
) {
  const status =
    workspaceDashboardText_(
      contract.contract_status ||
      contract.status ||
      contract.account_status
    ).toLowerCase();

  const endDate =
    workspaceDashboardDate_(
      contract.end_date ||
      contract.contract_end_date ||
      contract.lease_end_date
    );

  return [
    'active',
    'expired',
    'approved',
    'completed'
  ].indexOf(status) >= 0 && (
    status === 'expired' ||
    !endDate ||
    endDate.getTime() < workspaceDashboardToday_().getTime()
  );
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

  if (lastStage >= 15) {
    return 'final_sent';
  }

  if (lastStage >= 6) {
    return 'second_sent';
  }

  if (
    lastStage >= 2 ||
    reminderCount > 0
  ) {
    return 'first_sent';
  }

  if (daysOverdue >= 2) {
    return 'ready';
  }

  return 'waiting';
}


function workspaceDashboardNextReminderDay_(
  daysOverdue,
  lastStage,
  manualFollowUp
) {
  if (manualFollowUp || lastStage >= 15) {
    return 0;
  }

  if (lastStage >= 6) {
    return 15;
  }

  if (lastStage >= 2) {
    return 6;
  }

  if (daysOverdue < 2) {
    return 2;
  }

  if (daysOverdue < 6) {
    return 6;
  }

  return 15;
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
  return v2CanonicalBillPaymentStatus_(
    value
  );
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


function testWorkspaceLandlordPaymentCalendarNative() {
  const result =
    getWorkspaceLandlordPaymentCalendarNativeByLineUid_(
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
