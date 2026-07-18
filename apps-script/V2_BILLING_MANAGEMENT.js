/**
 * CMWebs V2 帳單與抄表管理
 *
 * API:
 * - landlord_billing_init
 * - landlord_bills_generate
 *
 * 核心規則：
 * - 以 Workspace 隔離資料。
 * - 依帳單月份決定設備耗損費：
 *   6–9 月使用 equipment_fee_rate_summer；
 *   其他月份使用 equipment_fee_rate_regular。
 * - 電費與耗損費都依本期用電度數計算。
 * - 已繳帳單禁止覆寫。
 * - 同房間、同月份只保留一筆正式帳單。
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 * - V2_WORKSPACE_LANDLORD_ACCESS.gs
 * - V2_PROPERTY_ROOM_MANAGEMENT.gs
 * - V2_WORKSPACE_OPERATION_AUDIT.gs（選用）
 */

const V2_BILLING_SHEETS_ = {
  bills:
    'V2_bills',
  tenantBillView:
    'V2_tenant_bill_view',
  tenantHomeView:
    'V2_tenant_home_view',
  landlordTenantListView:
    'V2_landlord_tenant_list_view',
  landlordHomeView:
    'V2_landlord_home_view',
  properties:
    'V2_properties',
  rooms:
    'V2_rooms',
  contracts:
    'V2_contracts',
  tenants:
    'V2_tenants'
};


/**
 * 帳單與抄表頁初始化。
 */
function getLandlordBillingInitByLineUid_(
  lineUserId,
  billMonth,
  propertyId
) {
  try {
    billingRequireSchema_();

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
      billingNormalizeBillMonth_(
        billMonth
      ) ||
      Utilities.formatDate(
        new Date(),
        'Asia/Taipei',
        'yyyy-MM'
      );

    propertyId =
      billingText_(
        propertyId
      );

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const billingSettings =
      typeof settingsIntegrationGetWorkspaceSettings_ ===
        'function'
        ? settingsIntegrationGetWorkspaceSettings_(
            ss,
            access
          )
        : {
            default_payment_day:
              10,
            default_electricity_fee_rate:
              3,
            summer_equipment_fee_rate:
              3.5,
            regular_equipment_fee_rate:
              2.5,
            default_management_fee:
              0,
            summer_months:
              [
                6,
                7,
                8,
                9
              ],
            summer_months_label:
              '6–9 月'
          };

    const properties =
      billingGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILLING_SHEETS_
            .properties
        ),
        access
      )
        .filter(
          function (row) {
            return (
              billingText_(
                row.account_status ||
                row.property_status ||
                'active'
              ).toLowerCase() !==
              'archived'
            );
          }
        )
        .map(
          function (row) {
            return {
              property_id:
                billingText_(
                  row.property_id
                ),
              property_name:
                billingText_(
                  row.property_name
                ),
              city:
                billingText_(
                  row.city
                ),
              district:
                billingText_(
                  row.district
                )
            };
          }
        )
        .sort(
          function (a, b) {
            return billingCompareText_(
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

    const roomRows =
      billingGetWorkspaceRoomRows_(
        ss,
        access,
        propertyIdMap
      )
        .filter(
          function (row) {
            if (
              billingText_(
                row.account_status ||
                'active'
              ).toLowerCase() ===
              'archived'
            ) {
              return false;
            }

            return (
              !propertyId ||
              billingText_(
                row.property_id
              ) ===
              propertyId
            );
          }
        );

    const contracts =
      billingGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILLING_SHEETS_
            .contracts
        ),
        access
      );

    const tenants =
      billingGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILLING_SHEETS_
            .tenants
        ),
        access
      );

    const tenantMap = {};

    tenants.forEach(
      function (tenant) {
        tenantMap[
          billingText_(
            tenant.tenant_id
          )
        ] =
          tenant;
      }
    );

    const bills =
      billingGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILLING_SHEETS_
            .bills
        ),
        access
      );

    /*
     * 舊資料有時只存在 V2_tenant_bill_view。
     * 正式帳單仍以 V2_bills 為準，但查找上期電錶時合併兩個來源。
     */
    const tenantBillViewRows =
      billingGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILLING_SHEETS_
            .tenantBillView
        ),
        access
      );

    const referenceBills =
      billingMergeReferenceBills_(
        bills,
        tenantBillViewRows
      );

    const billMonthDate =
      billingMonthStart_(
        billMonth
      );

    const monthEnd =
      billingMonthEnd_(
        billMonth
      );

    const contractRoomMap = {};

    contracts.forEach(
      function (contract) {
        if (
          !billingContractOverlapsMonth_(
            contract,
            billMonthDate,
            monthEnd
          )
        ) {
          return;
        }

        const roomId =
          billingText_(
            contract.room_id
          );

        if (!roomId) {
          return;
        }

        const existing =
          contractRoomMap[
            roomId
          ];

        if (
          !existing ||
          billingContractPriority_(
            contract
          ) >=
          billingContractPriority_(
            existing
          )
        ) {
          contractRoomMap[
            roomId
          ] =
            contract;
        }
      }
    );

    const existingBillMap = {};
    const previousBillMap = {};

    bills.forEach(
      function (bill) {
        const roomId =
          billingText_(
            bill.room_id
          );

        if (!roomId) {
          return;
        }

        const rowMonth =
          billingNormalizeBillMonth_(
            bill.bill_month
          );

        if (
          rowMonth ===
          billMonth
        ) {
          const existing =
            existingBillMap[
              roomId
            ];

          if (
            !existing ||
            billingRowUpdatedTime_(
              bill
            ) >=
            billingRowUpdatedTime_(
              existing
            )
          ) {
            existingBillMap[
              roomId
            ] =
              bill;
          }
        }
      }
    );

    referenceBills.forEach(
      function (bill) {
        const roomId =
          billingText_(
            bill.room_id
          );

        if (!roomId) {
          return;
        }

        const rowMonth =
          billingNormalizeBillMonth_(
            bill.bill_month
          );

        if (
          rowMonth &&
          rowMonth <
            billMonth
        ) {
          const existing =
            previousBillMap[
              roomId
            ];

          if (
            !existing ||
            billingNormalizeBillMonth_(
              existing.bill_month
            ) <
              rowMonth ||
            (
              billingNormalizeBillMonth_(
                existing.bill_month
              ) ===
                rowMonth &&
              billingRowUpdatedTime_(
                bill
              ) >=
                billingRowUpdatedTime_(
                  existing
                )
            )
          ) {
            previousBillMap[
              roomId
            ] =
              bill;
          }
        }
      }
    );

    const items =
      roomRows
        .map(
          function (room) {
            const roomId =
              billingText_(
                room.room_id
              );

            const contract =
              contractRoomMap[
                roomId
              ];

            if (!contract) {
              return null;
            }

            const tenantId =
              billingText_(
                contract.tenant_id ||
                room.current_tenant_id
              );

            const tenant =
              tenantMap[
                tenantId
              ] ||
              {};

            const existingBill =
              existingBillMap[
                roomId
              ] ||
              null;

            const previousBill =
              previousBillMap[
                roomId
              ] ||
              null;

            return billingBuildInitItem_(
              room,
              contract,
              tenant,
              existingBill,
              previousBill,
              billMonth,
              billingSettings
            );
          }
        )
        .filter(Boolean)
        .sort(
          function (a, b) {
            const propertyCompare =
              billingCompareText_(
                a.property_name,
                b.property_name
              );

            if (
              propertyCompare !==
              0
            ) {
              return propertyCompare;
            }

            return billingCompareText_(
              a.room_name,
              b.room_name
            );
          }
        );

    const summary = {
      billable_room_count:
        items.length,
      generated_count:
        items.filter(
          function (item) {
            return Boolean(
              item.existing_bill
            );
          }
        ).length,
      unpaid_count:
        items.filter(
          function (item) {
            return (
              item.existing_bill &&
              item.existing_bill
                .payment_status ===
                'unpaid'
            );
          }
        ).length,
      paid_count:
        items.filter(
          function (item) {
            return (
              item.existing_bill &&
              item.existing_bill
                .payment_status ===
                'paid'
            );
          }
        ).length,
      missing_meter_count:
        items.filter(
          function (item) {
            return (
              !item.existing_bill &&
              item.requires_meter
            );
          }
        ).length
    };

    return workspaceResult_(
      true,
      'OK',
      '帳單與抄表資料載入成功',
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
        can_generate:
          billingCanGenerate_(
            access
          ),
        bill_month:
          billMonth,
        season:
          billingIsSummerMonth_(
            billMonth,
            billingSettings
          )
            ? 'summer'
            : 'regular',
        season_label:
          billingIsSummerMonth_(
            billMonth,
            billingSettings
          )
            ? (
                '夏月（' +
                billingSummerMonthsLabel_(
                  billingSettings
                ) +
                '）'
              )
            : '其他月份',
        billing_defaults:
          typeof settingsIntegrationBuildBillingDefaultsView_ ===
            'function'
            ? settingsIntegrationBuildBillingDefaultsView_(
                billingSettings
              )
            : billingSettings,
        selected_property_id:
          propertyId,
        properties:
          properties,
        summary:
          summary,
        diagnostics: {
          formal_bill_count:
            bills.length,
          tenant_bill_view_count:
            tenantBillViewRows.length,
          reference_bill_count:
            referenceBills.length
        },
        items:
          items
      }
    );

  } catch (error) {
    return workspaceResult_(
      false,
      'BILLING_INIT_ERROR',
      '帳單與抄表資料載入失敗：' +
        error.message
    );
  }
}


/**
 * 批次建立或更新帳單。
 *
 * itemsJson:
 * [
 *   {
 *     room_id: "R000001",
 *     selected: true,
 *     previous_meter: 100,
 *     current_meter_reading: 130,
 *     due_date: "2026-07-10",
 *     other_amount: 0,
 *     discount_amount: 0,
 *     note: ""
 *   }
 * ]
 */
function generateLandlordBillsByLineUid_(
  lineUserId,
  billMonth,
  itemsJson
) {
  const lock =
    LockService.getScriptLock();

  let locked = false;

  try {
    billingEnsureSchema_();

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
      billingRequireGenerate_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    billMonth =
      billingNormalizeBillMonth_(
        billMonth
      );

    if (!billMonth) {
      return workspaceResult_(
        false,
        'INVALID_BILL_MONTH',
        '帳單月份格式不正確'
      );
    }

    const items =
      billingParseItemsJson_(
        itemsJson
      ).filter(
        function (item) {
          return (
            item &&
            item.selected !==
              false
          );
        }
      );

    if (
      items.length === 0
    ) {
      return workspaceResult_(
        false,
        'NO_BILL_ITEMS',
        '請至少選擇一個房間'
      );
    }

    lock.waitLock(
      25000
    );

    locked = true;

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const billingSettings =
      typeof settingsIntegrationGetWorkspaceSettings_ ===
        'function'
        ? settingsIntegrationGetWorkspaceSettings_(
            ss,
            access
          )
        : {
            default_payment_day:
              10,
            default_electricity_fee_rate:
              3,
            summer_equipment_fee_rate:
              3.5,
            regular_equipment_fee_rate:
              2.5,
            default_management_fee:
              0,
            summer_months:
              [
                6,
                7,
                8,
                9
              ],
            summer_months_label:
              '6–9 月'
          };

    const propertyRows =
      billingGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILLING_SHEETS_
            .properties
        ),
        access
      );

    const propertyMap = {};

    propertyRows.forEach(
      function (row) {
        propertyMap[
          billingText_(
            row.property_id
          )
        ] =
          row;
      }
    );

    const roomRows =
      billingGetWorkspaceRoomRows_(
        ss,
        access,
        propertyMap
      );

    const roomMap = {};

    roomRows.forEach(
      function (row) {
        roomMap[
          billingText_(
            row.room_id
          )
        ] =
          row;
      }
    );

    const contractRows =
      billingGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILLING_SHEETS_
            .contracts
        ),
        access
      );

    const tenantRows =
      billingGetWorkspaceRows_(
        ss.getSheetByName(
          V2_BILLING_SHEETS_
            .tenants
        ),
        access
      );

    const tenantMap = {};

    tenantRows.forEach(
      function (row) {
        tenantMap[
          billingText_(
            row.tenant_id
          )
        ] =
          row;
      }
    );

    const billSheet =
      ss.getSheetByName(
        V2_BILLING_SHEETS_
          .bills
      );

    const billRows =
      billingGetWorkspaceRows_(
        billSheet,
        access
      );

    const monthStart =
      billingMonthStart_(
        billMonth
      );

    const monthEnd =
      billingMonthEnd_(
        billMonth
      );

    const actor =
      billingActor_(
        access
      );

    const generated = [];
    const skipped = [];
    const errors = [];

    items.forEach(
      function (item) {
        const roomId =
          billingText_(
            item.room_id
          );

        try {
          if (!roomId) {
            throw new Error(
              '缺少房間 ID'
            );
          }

          const room =
            roomMap[
              roomId
            ];

          if (!room) {
            throw new Error(
              '找不到房間或無權限存取'
            );
          }

          const contract =
            billingResolveRoomContractForMonth_(
              contractRows,
              roomId,
              monthStart,
              monthEnd
            );

          if (!contract) {
            throw new Error(
              '此房間在帳單月份沒有有效租約'
            );
          }

          const tenantId =
            billingText_(
              contract.tenant_id ||
              room.current_tenant_id
            );

          const tenant =
            tenantMap[
              tenantId
            ] ||
            {};

          const existingBill =
            billRows.find(
              function (bill) {
                return (
                  billingText_(
                    bill.room_id
                  ) ===
                    roomId &&
                  billingNormalizeBillMonth_(
                    bill.bill_month
                  ) ===
                    billMonth
                );
              }
            ) ||
            null;

          if (
            existingBill &&
            billingIsPaidStatus_(
              existingBill.payment_status
            )
          ) {
            skipped.push({
              room_id:
                roomId,
              room_name:
                billingText_(
                  room.room_name
                ),
              code:
                'PAID_BILL_LOCKED',
              message:
                '已繳帳單不能覆寫'
            });

            return;
          }

          const referenceBillRows =
            billingMergeReferenceBills_(
              billRows,
              billingGetWorkspaceRows_(
                ss.getSheetByName(
                  V2_BILLING_SHEETS_
                    .tenantBillView
                ),
                access
              )
            );

          const previousBill =
            billingResolvePreviousBill_(
              referenceBillRows,
              roomId,
              billMonth
            );

          const calculated =
            billingCalculateBill_(
              room,
              contract,
              tenant,
              existingBill,
              previousBill,
              billMonth,
              item,
              billingSettings
            );

          let billId =
            existingBill
              ? billingText_(
                  existingBill.bill_id
                )
              : '';

          const now =
            new Date();

          if (existingBill) {
            billingSetValues_(
              billSheet,
              existingBill
                .__row_number,
              Object.assign(
                {},
                calculated,
                {
                  bill_id:
                    billId,
                  updated_at:
                    now,
                  updated_by_user_id:
                    actor.user_id,
                  updated_by_membership_id:
                    actor.membership_id
                }
              )
            );
          } else {
            billId =
              workspaceNextId_(
                billSheet,
                'bill_id',
                'B',
                7
              );

            workspaceAppendObject_(
              billSheet,
              Object.assign(
                {
                  bill_id:
                    billId,
                  created_at:
                    now,
                  created_by_user_id:
                    actor.user_id,
                  created_by_membership_id:
                    actor.membership_id
                },
                calculated,
                {
                  updated_at:
                    now,
                  updated_by_user_id:
                    actor.user_id,
                  updated_by_membership_id:
                    actor.membership_id
                }
              )
            );
          }

          calculated.bill_id =
            billId;

          billingSyncBillViews_(
            ss,
            access,
            calculated,
            now
          );

          billingSetValues_(
            ss.getSheetByName(
              V2_BILLING_SHEETS_
                .rooms
            ),
            room.__row_number,
            {
              latest_meter_reading:
                calculated
                  .current_meter_reading,
              latest_meter_bill_month:
                billMonth,
              updated_at:
                now
            }
          );

          generated.push({
            bill_id:
              billId,
            room_id:
              roomId,
            room_name:
              calculated.room_name,
            tenant_id:
              calculated.tenant_id,
            tenant_name:
              calculated.tenant_name,
            bill_month:
              billMonth,
            due_date:
              billingFormatDate_(
                calculated.due_date
              ),
            electricity_usage:
              calculated.electricity_usage,
            electricity_fee_rate:
              calculated.electricity_fee_rate,
            equipment_fee_rate:
              calculated.equipment_fee_rate,
            total_amount:
              calculated.total_amount,
            updated_existing:
              Boolean(
                existingBill
              )
          });

        } catch (itemError) {
          errors.push({
            room_id:
              roomId,
            message:
              itemError.message
          });
        }
      }
    );

    SpreadsheetApp.flush();

    billingRefreshWorkspaceSummaries_(
      ss,
      access
    );

    let teamNotification =
      null;

    if (
      generated.length >
        0 &&
      typeof workspaceNotifyTeam_ ===
        'function'
    ) {
      try {
        const totalAmount =
          generated.reduce(
            function (sum, item) {
              return (
                sum +
                billingNumber_(
                  item.total_amount
                )
              );
            },
            0
          );

        const createdCount =
          generated.filter(
            function (item) {
              return (
                item.updated_existing !==
                true
              );
            }
          ).length;

        const updatedCount =
          generated.length -
          createdCount;

        const bodyLines = [
          '帳單月份：' +
            billMonth,
          '新增帳單：' +
            createdCount +
            ' 筆',
          '更新帳單：' +
            updatedCount +
            ' 筆',
          '帳單總額：NT$ ' +
            Math.round(
              totalAmount
            ).toLocaleString(
              'en-US'
            )
        ];

        if (
          skipped.length >
          0
        ) {
          bodyLines.push(
            '略過：' +
            skipped.length +
            ' 筆'
          );
        }

        if (
          errors.length >
          0
        ) {
          bodyLines.push(
            '失敗：' +
            errors.length +
            ' 筆'
          );
        }

        teamNotification =
          workspaceNotifyTeam_({
            workspace_id:
              billingText_(
                access.workspace &&
                access.workspace
                  .workspace_id
              ),

            landlord_id:
              billingText_(
                access.principal_landlord_id
              ),

            event_type:
              'bill_created',

            title:
              billMonth +
              ' 帳單已建立',

            body:
              bodyLines.join(
                '\n'
              ),

            target_type:
              'bill_batch',

            target_id:
              billMonth,

            action_url:
              'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-bill-notifications.html?bill_month=' +
              encodeURIComponent(
                billMonth
              ),

            severity:
              errors.length >
                0
                ? 'warning'
                : 'info',

            source:
              'landlord_bills_generate',

            metadata: {
              bill_month:
                billMonth,

              generated_count:
                generated.length,

              created_count:
                createdCount,

              updated_count:
                updatedCount,

              skipped_count:
                skipped.length,

              error_count:
                errors.length,

              total_amount:
                totalAmount
            }
          });

      } catch (notificationError) {
        teamNotification = {
          success:
            false,

          code:
            'TEAM_NOTIFICATION_ERROR',

          message:
            notificationError.message
        };
      }
    }

    const result =
      workspaceResult_(
        errors.length === 0,
        errors.length === 0
          ? 'BILLS_GENERATED'
          : (
              generated.length > 0
                ? 'BILLS_PARTIAL_SUCCESS'
                : 'BILLS_GENERATE_FAILED'
            ),
        errors.length === 0
          ? '帳單已建立'
          : (
              generated.length > 0
                ? '部分帳單已建立，部分失敗'
                : '帳單建立失敗'
            ),
        {
          bill_month:
            billMonth,
          generated_count:
            generated.length,
          skipped_count:
            skipped.length,
          error_count:
            errors.length,
          generated:
            generated,
          skipped:
            skipped,
          errors:
            errors,

          team_notification:
            teamNotification &&
            teamNotification.data
              ? teamNotification.data
              : teamNotification
        }
      );

    billingAudit_(
      access,
      'landlord_bills_generate',
      result,
      {
        target_type:
          'bill',
        target_id:
          generated.length === 1
            ? generated[0].bill_id
            : '',
        operation_status:
          errors.length === 0
            ? 'success'
            : 'partial',
        detail:
          'bill_month=' +
          billMonth +
          ', generated=' +
          generated.length +
          ', skipped=' +
          skipped.length +
          ', errors=' +
          errors.length
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'BILLS_GENERATE_ERROR',
      '帳單建立失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


// ==================================================
// Billing calculations
// ==================================================

function billingBuildInitItem_(
  room,
  contract,
  tenant,
  existingBill,
  previousBill,
  billMonth,
  billingSettings
) {
  billingSettings =
    billingSettings ||
    {
      default_payment_day:
        10,
      default_electricity_fee_rate:
        3,
      summer_equipment_fee_rate:
        3.5,
      regular_equipment_fee_rate:
        2.5,
      default_management_fee:
        0,
      summer_months:
        [
          6,
          7,
          8,
          9
        ],
      summer_months_label:
        '6–9 月'
    };
  const propertyId =
    billingText_(
      room.property_id ||
      contract.property_id
    );

  const roomId =
    billingText_(
      room.room_id ||
      contract.room_id
    );

  const rentAmount =
    billingResolvePositiveNumber_(
      [
        room.rent_amount,
        contract.rent_amount,
        contract.monthly_rent
      ],
      0
    );

  const managementFee =
    billingResolveNonNegativeNumber_(
      [
        room.management_fee,
        contract.management_fee,
        contract.monthly_management_fee
      ],
      billingNumber_(
        billingSettings
          .default_management_fee
      )
    );

  const electricityRate =
    billingResolvePositiveNumber_(
      [
        room.electricity_fee_rate,
        room.electricity_rate,
        contract.electricity_fee_rate,
        contract.electricity_rate,
        previousBill
          ? previousBill
              .electricity_fee_rate
          : ''
      ],
      billingNumber_(
        billingSettings
          .default_electricity_fee_rate
      )
    );

  const summerMonths =
    typeof settingsIntegrationResolveSummerMonths_ ===
      'function'
      ? settingsIntegrationResolveSummerMonths_(
          room.equipment_summer_months ||
          contract.equipment_summer_months,
          billingSettings
        )
      : (
          billingSettings.summer_months ||
          [
            6,
            7,
            8,
            9
          ]
        );

  const summerRate =
    billingResolvePositiveNumber_(
      [
        room.equipment_fee_rate_summer,
        room.summer_equipment_fee_rate,
        contract.equipment_fee_rate_summer,
        contract.summer_equipment_fee_rate
      ],
      billingNumber_(
        billingSettings
          .summer_equipment_fee_rate
      )
    );

  const regularRate =
    billingResolvePositiveNumber_(
      [
        room.equipment_fee_rate_regular,
        room.regular_equipment_fee_rate,
        room.non_summer_equipment_fee_rate,
        contract.equipment_fee_rate_regular,
        contract.regular_equipment_fee_rate,
        contract.non_summer_equipment_fee_rate
      ],
      billingNumber_(
        billingSettings
          .regular_equipment_fee_rate
      )
    );

  const equipmentRate =
    billingIsSummerMonth_(
      billMonth,
      summerMonths
    )
      ? summerRate
      : regularRate;

  const meterResolution =
    billingResolvePreviousMeter_(
      room,
      existingBill,
      previousBill,
      billMonth,
      billingSettings
    );

  const previousMeter =
    meterResolution.value;

  const paymentDay =
    billingResolvePaymentDay_(
      room,
      contract,
      billingSettings
    );

  const dueDate =
    existingBill &&
    billingDate_(
      existingBill.due_date
    )
      ? billingFormatDate_(
          existingBill.due_date
        )
      : billingDefaultDueDate_(
          billMonth,
          paymentDay
        );

  const tenantLineUserId =
    billingText_(
      contract.tenant_line_user_id ||
      tenant.tenant_line_user_id ||
      tenant.line_user_id
    );

  return {
    room_id:
      roomId,
    room_name:
      billingText_(
        room.room_name ||
        contract.room_name
      ),
    property_id:
      propertyId,
    property_name:
      billingText_(
        room.property_name ||
        contract.property_name
      ),

    contract_id:
      billingText_(
        contract.contract_id
      ),
    tenant_id:
      billingText_(
        contract.tenant_id ||
        tenant.tenant_id
      ),
    tenant_name:
      billingText_(
        contract.tenant_name ||
        tenant.tenant_name ||
        tenant.name
      ),
    tenant_line_user_id:
      tenantLineUserId,

    rent_amount:
      rentAmount,
    management_fee:
      managementFee,

    previous_meter:
      previousMeter,
    current_meter_reading:
      existingBill
        ? billingResolveCurrentMeter_(
            existingBill
          )
        : '',

    previous_meter_locked:
      meterResolution.locked,

    previous_meter_source:
      meterResolution.source,

    previous_meter_source_label:
      meterResolution.label,

    previous_bill_month:
      meterResolution.previous_bill_month,

    electricity_fee_rate:
      electricityRate,
    equipment_fee_rate_summer:
      summerRate,
    equipment_fee_rate_regular:
      regularRate,
    equipment_fee_rate:
      equipmentRate,
    summer_months:
      summerMonths,

    summer_months_label:
      billingSummerMonthsLabel_(
        summerMonths
      ),

    season:
      billingIsSummerMonth_(
        billMonth,
        summerMonths
      )
        ? 'summer'
        : 'regular',
    season_label:
      billingIsSummerMonth_(
        billMonth,
        summerMonths
      )
        ? (
            '夏月（' +
            billingSummerMonthsLabel_(
              summerMonths
            ) +
            '）'
          )
        : '其他月份',

    due_date:
      dueDate,
    other_amount:
      existingBill
        ? billingNumber_(
            existingBill.other_amount
          )
        : 0,
    discount_amount:
      existingBill
        ? billingNumber_(
            existingBill.discount_amount
          )
        : 0,
    note:
      existingBill
        ? billingText_(
            existingBill.note
          )
        : '',

    requires_meter:
      (
        electricityRate > 0 ||
        equipmentRate > 0
      ),

    existing_bill:
      existingBill
        ? {
            bill_id:
              billingText_(
                existingBill.bill_id
              ),
            bill_status:
              billingText_(
                existingBill.bill_status ||
                'issued'
              ).toLowerCase(),
            payment_status:
              billingNormalizePaymentStatus_(
                existingBill
                  .payment_status
              ),
            sent_status:
              billingText_(
                existingBill.sent_status ||
                'not_sent'
              ).toLowerCase(),
            electricity_usage:
              billingNumber_(
                existingBill
                  .electricity_usage
              ),
            previous_meter:
              previousMeter,
            current_meter_reading:
              billingResolveCurrentMeter_(
                existingBill
              ),
            electricity_amount:
              billingNumber_(
                existingBill
                  .electricity_amount
              ),
            equipment_amount:
              billingNumber_(
                existingBill
                  .equipment_amount
              ),
            total_amount:
              billingNumber_(
                existingBill.total_amount
              )
          }
        : null
  };
}


function billingCalculateBill_(
  room,
  contract,
  tenant,
  existingBill,
  previousBill,
  billMonth,
  input,
  billingSettings
) {
  const item =
    billingBuildInitItem_(
      room,
      contract,
      tenant,
      existingBill,
      previousBill,
      billMonth
    );

  let previousMeter =
    item.previous_meter;

  if (
    !item.previous_meter_locked &&
    billingText_(
      input.previous_meter
    ) !== ''
  ) {
    previousMeter =
      billingNumber_(
        input.previous_meter
      );
  }

  const currentMeterText =
    billingText_(
      input.current_meter_reading
    );

  if (
    item.requires_meter &&
    !currentMeterText
  ) {
    throw new Error(
      item.room_name +
      ' 尚未輸入本期電錶'
    );
  }

  const currentMeter =
    currentMeterText
      ? billingNumber_(
          currentMeterText
        )
      : previousMeter;

  if (
    currentMeter <
    previousMeter
  ) {
    throw new Error(
      item.room_name +
      ' 本期電錶不得小於上期電錶'
    );
  }

  const usage =
    Math.round(
      (
        currentMeter -
        previousMeter
      ) *
      1000
    ) /
    1000;

  const electricityAmount =
    Math.round(
      usage *
      item.electricity_fee_rate
    );

  const equipmentAmount =
    Math.round(
      usage *
      item.equipment_fee_rate
    );

  const otherAmount =
    Math.max(
      0,
      Math.round(
        billingNumber_(
          input.other_amount
        )
      )
    );

  const discountAmount =
    Math.max(
      0,
      Math.round(
        billingNumber_(
          input.discount_amount
        )
      )
    );

  const subtotal =
    Math.round(
      item.rent_amount +
      item.management_fee +
      electricityAmount +
      equipmentAmount +
      otherAmount
    );

  const totalAmount =
    Math.max(
      0,
      subtotal -
      discountAmount
    );

  const dueDate =
    billingDate_(
      input.due_date
    );

  if (!dueDate) {
    throw new Error(
      item.room_name +
      ' 繳款期限格式不正確'
    );
  }

  const workspaceId =
    billingText_(
      contract.workspace_id ||
      room.workspace_id
    ).toUpperCase();

  return {
    workspace_id:
      workspaceId,
    landlord_id:
      billingText_(
        contract.landlord_id ||
        room.landlord_id
      ),
    landlord_line_user_id:
      billingText_(
        contract
          .landlord_line_user_id ||
        room.landlord_line_user_id
      ),

    tenant_id:
      item.tenant_id,
    tenant_user_id:
      billingText_(
        contract.tenant_user_id ||
        tenant.tenant_user_id ||
        tenant.user_id
      ),
    tenant_line_user_id:
      item.tenant_line_user_id,
    tenant_name:
      item.tenant_name,

    contract_id:
      item.contract_id,
    property_id:
      item.property_id,
    property_name:
      item.property_name,
    room_id:
      item.room_id,
    room_name:
      item.room_name,

    bill_month:
      billMonth,
    due_date:
      dueDate,

    rent_amount:
      Math.round(
        item.rent_amount
      ),
    management_fee:
      Math.round(
        item.management_fee
      ),

    previous_meter:
      previousMeter,
    current_meter_reading:
      currentMeter,
    electricity_usage:
      usage,

    electricity_fee_rate:
      item.electricity_fee_rate,
    equipment_fee_rate:
      item.equipment_fee_rate,
    equipment_fee_rate_summer:
      item.equipment_fee_rate_summer,
    equipment_fee_rate_regular:
      item.equipment_fee_rate_regular,
    equipment_fee_season:
      item.season,

    electricity_amount:
      electricityAmount,
    equipment_amount:
      equipmentAmount,
    other_amount:
      otherAmount,
    discount_amount:
      discountAmount,
    subtotal_amount:
      subtotal,
    total_amount:
      totalAmount,

    bill_status:
      'issued',
    payment_status:
      existingBill
        ? billingNormalizePaymentStatus_(
            existingBill
              .payment_status
          )
        : 'unpaid',
    sent_status:
      existingBill
        ? billingText_(
            existingBill.sent_status ||
            'not_sent'
          ).toLowerCase()
        : 'not_sent',

    note:
      billingText_(
        input.note
      )
  };
}


// ==================================================
// View synchronization
// ==================================================

function billingSyncBillViews_(
  ss,
  access,
  bill,
  now
) {
  const tenantBillSheet =
    ss.getSheetByName(
      V2_BILLING_SHEETS_
        .tenantBillView
    );

  const tenantHomeSheet =
    ss.getSheetByName(
      V2_BILLING_SHEETS_
        .tenantHomeView
    );

  const landlordTenantSheet =
    ss.getSheetByName(
      V2_BILLING_SHEETS_
        .landlordTenantListView
    );

  const viewValues =
    Object.assign(
      {},
      bill,
      {
        line_user_id:
          bill
            .tenant_line_user_id ||
          '',
        user_id:
          bill.tenant_user_id ||
          '',
        updated_at:
          now
      }
    );

  billingUpsertById_(
    tenantBillSheet,
    'bill_id',
    bill.bill_id,
    viewValues
  );

  const allBills =
    billingGetWorkspaceRows_(
      ss.getSheetByName(
        V2_BILLING_SHEETS_
          .bills
      ),
      access
    );

  const tenantBills =
    allBills.filter(
      function (row) {
        return (
          billingText_(
            row.tenant_id
          ) ===
          bill.tenant_id
        );
      }
    );

  const unpaidBills =
    tenantBills.filter(
      function (row) {
        return (
          billingNormalizePaymentStatus_(
            row.payment_status
          ) ===
          'unpaid'
        );
      }
    );

  const unpaidTotal =
    unpaidBills.reduce(
      function (sum, row) {
        return (
          sum +
          billingNumber_(
            row.total_amount
          )
        );
      },
      0
    );

  const tenantHomeRow =
    billingFindByTenantId_(
      tenantHomeSheet,
      bill.tenant_id
    );

  if (tenantHomeRow) {
    billingSetValues_(
      tenantHomeSheet,
      tenantHomeRow.__row_number,
      {
        line_user_id:
          bill
            .tenant_line_user_id ||
          tenantHomeRow
            .line_user_id ||
          '',
        tenant_line_user_id:
          bill
            .tenant_line_user_id ||
          tenantHomeRow
            .tenant_line_user_id ||
          '',
        latest_bill_month:
          bill.bill_month,
        latest_due_date:
          bill.due_date,
        latest_total_amount:
          bill.total_amount,
        latest_payment_status:
          bill.payment_status,
        unpaid_bill_count:
          unpaidBills.length,
        unpaid_total_amount:
          unpaidTotal,
        updated_at:
          now
      }
    );
  }

  const landlordTenantRows =
    workspaceGetObjectsWithRow_(
      landlordTenantSheet
    ).filter(
      function (row) {
        return (
          billingText_(
            row.tenant_id
          ) ===
            bill.tenant_id &&
          (
            !row.workspace_id ||
            billingText_(
              row.workspace_id
            ).toUpperCase() ===
              billingText_(
                bill.workspace_id
              ).toUpperCase()
          )
        );
      }
    );

  landlordTenantRows.forEach(
    function (row) {
      billingSetValues_(
        landlordTenantSheet,
        row.__row_number,
        {
          tenant_line_user_id:
            bill
              .tenant_line_user_id ||
            row
              .tenant_line_user_id ||
            '',
          latest_bill_month:
            bill.bill_month,
          latest_due_date:
            bill.due_date,
          latest_total_amount:
            bill.total_amount,
          latest_payment_status:
            bill.payment_status,
          unpaid_bill_count:
            unpaidBills.length,
          unpaid_total_amount:
            unpaidTotal,
          updated_at:
            now
        }
      );
    }
  );
}


function billingRefreshWorkspaceSummaries_(
  ss,
  access
) {
  const bills =
    billingGetWorkspaceRows_(
      ss.getSheetByName(
        V2_BILLING_SHEETS_
          .bills
      ),
      access
    );

  const unpaid =
    bills.filter(
      function (bill) {
        return (
          billingNormalizePaymentStatus_(
            bill.payment_status
          ) ===
          'unpaid'
        );
      }
    );

  const latestMonth =
    bills.reduce(
      function (latest, bill) {
        const month =
          billingNormalizeBillMonth_(
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

  const unpaidTotal =
    unpaid.reduce(
      function (sum, bill) {
        return (
          sum +
          billingNumber_(
            bill.total_amount
          )
        );
      },
      0
    );

  const sheet =
    ss.getSheetByName(
      V2_BILLING_SHEETS_
        .landlordHomeView
    );

  if (!sheet) {
    return;
  }

  const workspaceId =
    billingText_(
      access.workspace
        .workspace_id
    ).toUpperCase();

  workspaceGetObjectsWithRow_(
    sheet
  ).forEach(
    function (row) {
      const rowWorkspaceId =
        billingText_(
          row.workspace_id
        ).toUpperCase();

      const lineUserId =
        billingText_(
          row.line_user_id ||
          row.landlord_line_user_id
        );

      if (
        (
          rowWorkspaceId &&
          rowWorkspaceId ===
            workspaceId
        ) ||
        (
          !rowWorkspaceId &&
          lineUserId ===
            billingText_(
              access.principal_line_user_id
            )
        )
      ) {
        billingSetValues_(
          sheet,
          row.__row_number,
          {
            latest_bill_month:
              latestMonth,
            unpaid_bill_count:
              unpaid.length,
            unpaid_total_amount:
              unpaidTotal,
            updated_at:
              new Date()
          }
        );
      }
    }
  );
}


function billingUpsertById_(
  sheet,
  idHeader,
  idValue,
  values
) {
  if (!sheet) {
    return;
  }

  const existing =
    workspaceGetObjectsWithRow_(
      sheet
    ).find(
      function (row) {
        return (
          billingText_(
            row[idHeader]
          ) ===
          billingText_(
            idValue
          )
        );
      }
    );

  if (existing) {
    billingSetValues_(
      sheet,
      existing.__row_number,
      values
    );

    return;
  }

  workspaceAppendObject_(
    sheet,
    values
  );
}


function billingFindByTenantId_(
  sheet,
  tenantId
) {
  if (!sheet) {
    return null;
  }

  return workspaceGetObjectsWithRow_(
    sheet
  ).find(
    function (row) {
      return (
        billingText_(
          row.tenant_id
        ) ===
        billingText_(
          tenantId
        )
      );
    }
  ) || null;
}


// ==================================================
// Workspace data helpers
// ==================================================

function billingGetWorkspaceRows_(
  sheet,
  access
) {
  if (!sheet) {
    return [];
  }

  const workspaceId =
    billingText_(
      access.workspace
        .workspace_id
    ).toUpperCase();

  const landlordIds =
    (
      access.principals || []
    )
      .map(
        function (principal) {
          return billingText_(
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
        billingText_(
          row.workspace_id
        ).toUpperCase();

      if (rowWorkspaceId) {
        return (
          rowWorkspaceId ===
          workspaceId
        );
      }

      const landlordId =
        billingText_(
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


function billingGetWorkspaceRoomRows_(
  ss,
  access,
  propertyIdMap
) {
  const sheet =
    ss.getSheetByName(
      V2_BILLING_SHEETS_
        .rooms
    );

  if (!sheet) {
    return [];
  }

  const workspaceId =
    billingText_(
      access.workspace
        .workspace_id
    ).toUpperCase();

  const landlordIds =
    (
      access.principals || []
    )
      .map(
        function (principal) {
          return billingText_(
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
        billingText_(
          row.workspace_id
        ).toUpperCase();

      const propertyId =
        billingText_(
          row.property_id
        );

      const landlordId =
        billingText_(
          row.landlord_id
        );

      return (
        rowWorkspaceId ===
          workspaceId ||
        (
          propertyId &&
          propertyIdMap[
            propertyId
          ]
        ) ||
        (
          !rowWorkspaceId &&
          landlordId &&
          landlordIds.indexOf(
            landlordId
          ) >= 0
        )
      );
    }
  );
}


// ==================================================
// Contract and bill resolution
// ==================================================

function billingMergeReferenceBills_(
  formalBills,
  viewBills
) {
  const map = {};

  function addRow(
    row,
    priority
  ) {
    const roomId =
      billingText_(
        row.room_id
      );

    const month =
      billingNormalizeBillMonth_(
        row.bill_month
      );

    if (
      !roomId ||
      !month
    ) {
      return;
    }

    const billId =
      billingText_(
        row.bill_id
      );

    const key =
      billId
        ? 'id:' + billId
        : (
            'room:' +
            roomId +
            ':month:' +
            month
          );

    const existing =
      map[
        key
      ];

    if (
      !existing ||
      priority >
        existing.__source_priority ||
      (
        priority ===
          existing.__source_priority &&
        billingRowUpdatedTime_(
          row
        ) >=
          billingRowUpdatedTime_(
            existing
          )
      )
    ) {
      map[
        key
      ] =
        Object.assign(
          {},
          row,
          {
            __source_priority:
              priority
          }
        );
    }
  }

  (
    viewBills || []
  ).forEach(
    function (row) {
      addRow(
        row,
        1
      );
    }
  );

  (
    formalBills || []
  ).forEach(
    function (row) {
      addRow(
        row,
        2
      );
    }
  );

  return Object.keys(
    map
  ).map(
    function (key) {
      return map[
        key
      ];
    }
  );
}


function billingResolvePreviousMeter_(
  room,
  existingBill,
  previousBill,
  billMonth
) {
  const existingPrevious =
    billingResolveMeterCandidate_(
      existingBill
        ? [
            existingBill.previous_meter,
            existingBill.previous_meter_reading,
            existingBill.last_meter_reading,
            existingBill.prior_meter,
            existingBill.start_meter,
            existingBill.beginning_meter,
            existingBill['上期電錶'],
            existingBill['上期電表'],
            existingBill['上月電錶'],
            existingBill['上月電表']
          ]
        : []
    );

  const previousCurrent =
    billingResolveCurrentMeter_(
      previousBill
    );

  const hasPreviousCurrent =
    Boolean(
      previousBill
    ) &&
    previousCurrent !==
      '' &&
    previousCurrent !==
      null;

  const previousBillMonth =
    previousBill
      ? billingNormalizeBillMonth_(
          previousBill.bill_month
        )
      : '';

  const roomLatestMonth =
    billingNormalizeBillMonth_(
      room.latest_meter_bill_month
    );

  const roomLatest =
    (
      roomLatestMonth &&
      roomLatestMonth <
        billMonth
    )
      ? billingResolveMeterCandidate_(
          [
            room.latest_meter_reading,
            room.current_meter_reading,
            room.last_meter_reading,
            room.meter_reading
          ]
        )
      : null;

  /*
   * 舊匯入帳單常把 previous_meter 留成 0，
   * 但前一個月的 current meter 是完整的。
   * 有前期資料時優先使用前期 current meter。
   */
  if (
    hasPreviousCurrent &&
    (
      existingPrevious ===
        null ||
      existingPrevious <=
        0
    )
  ) {
    return {
      value:
        previousCurrent,
      locked:
        true,
      source:
        'previous_bill',
      label:
        '前期帳單 ' +
        previousBillMonth,
      previous_bill_month:
        previousBillMonth
    };
  }

  if (
    existingPrevious !==
    null
  ) {
    return {
      value:
        existingPrevious,
      locked:
        existingPrevious > 0,
      source:
        'existing_bill',
      label:
        '本期既有帳單',
      previous_bill_month:
        previousBill
          ? billingNormalizeBillMonth_(
              previousBill.bill_month
            )
          : ''
    };
  }

  if (
    hasPreviousCurrent
  ) {
    return {
      value:
        previousCurrent,
      locked:
        true,
      source:
        'previous_bill',
      label:
        '前期帳單 ' +
        previousBillMonth,
      previous_bill_month:
        previousBillMonth
    };
  }

  if (
    roomLatest !==
    null
  ) {
    return {
      value:
        roomLatest,
      locked:
        true,
      source:
        'room_latest',
      label:
        '房間最近抄表 ' +
        roomLatestMonth,
      previous_bill_month:
        roomLatestMonth
    };
  }

  return {
    value:
      0,
    locked:
      false,
    source:
      'manual',
    label:
      '首次抄表，請確認上期電錶',
    previous_bill_month:
      ''
  };
}


function billingResolveCurrentMeter_(
  bill
) {
  if (!bill) {
    return '';
  }

  const value =
    billingResolveMeterCandidate_(
      [
        bill.current_meter_reading,
        bill.current_meter,
        bill.meter_reading,
        bill.meter_current,
        bill.end_meter,
        bill.ending_meter,
        bill.electric_meter,
        bill.electricity_meter,
        bill['本期電錶'],
        bill['本期電表'],
        bill['本月電錶'],
        bill['本月電表'],
        bill['本期度數'],
        bill['本月度數']
      ]
    );

  return value ===
      null
    ? ''
    : value;
}


function billingResolveMeterCandidate_(
  candidates
) {
  const values =
    candidates || [];

  for (
    let index = 0;
    index < values.length;
    index += 1
  ) {
    const raw =
      billingText_(
        values[
          index
        ]
      );

    if (
      raw ===
      ''
    ) {
      continue;
    }

    const number =
      billingNumber_(
        raw
      );

    if (
      Number.isFinite(
        number
      ) &&
      number >= 0
    ) {
      return number;
    }
  }

  return null;
}


function billingRowUpdatedTime_(
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
      billingDate_(
        candidates[index]
      );

    if (date) {
      return date.getTime();
    }
  }

  return 0;
}


function billingResolveRoomContractForMonth_(
  contracts,
  roomId,
  monthStart,
  monthEnd
) {
  return (
    contracts || []
  )
    .filter(
      function (contract) {
        return (
          billingText_(
            contract.room_id
          ) ===
            roomId &&
          billingContractOverlapsMonth_(
            contract,
            monthStart,
            monthEnd
          )
        );
      }
    )
    .sort(
      function (a, b) {
        return (
          billingContractPriority_(
            b
          ) -
          billingContractPriority_(
            a
          )
        );
      }
    )[0] ||
    null;
}


function billingContractOverlapsMonth_(
  contract,
  monthStart,
  monthEnd
) {
  const status =
    billingText_(
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
      'draft',
      'rejected'
    ].indexOf(
      status
    ) >= 0
  ) {
    return false;
  }

  const start =
    billingDate_(
      contract.start_date ||
      contract.contract_start_date ||
      contract.lease_start_date
    );

  const end =
    billingDate_(
      contract.end_date ||
      contract.contract_end_date ||
      contract.lease_end_date
    );

  if (
    !start ||
    !end
  ) {
    return [
      'active',
      'current',
      'effective',
      'signed',
      'approved',
      'upcoming',
      'pending_start'
    ].indexOf(
      status
    ) >= 0;
  }

  return (
    start.getTime() <=
      monthEnd.getTime() &&
    end.getTime() >=
      monthStart.getTime()
  );
}


function billingContractPriority_(
  contract
) {
  const start =
    billingDate_(
      contract.start_date ||
      contract.contract_start_date ||
      contract.created_at
    );

  return start
    ? start.getTime()
    : 0;
}


function billingResolvePreviousBill_(
  bills,
  roomId,
  billMonth
) {
  return (
    bills || []
  )
    .filter(
      function (bill) {
        const month =
          billingNormalizeBillMonth_(
            bill.bill_month
          );

        return (
          billingText_(
            bill.room_id
          ) ===
            roomId &&
          month &&
          month <
            billMonth
        );
      }
    )
    .sort(
      function (a, b) {
        return billingNormalizeBillMonth_(
          b.bill_month
        ).localeCompare(
          billingNormalizeBillMonth_(
            a.bill_month
          )
        );
      }
    )[0] ||
    null;
}


// ==================================================
// Permissions and audit
// ==================================================

function billingCanGenerate_(
  access
) {
  return [
    'owner',
    'admin',
    'manager',
    'accountant'
  ].indexOf(
    billingText_(
      access.membership.role
    ).toLowerCase()
  ) >= 0;
}


function billingRequireGenerate_(
  access
) {
  if (
    billingCanGenerate_(
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
    '目前角色沒有建立或修改帳單的權限'
  );
}


function billingActor_(
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


function billingAudit_(
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
    // 稽核錯誤不阻擋帳單主流程。
  }
}


// ==================================================
// Schema
// ==================================================

function billingEnsureSchema_() {
  workspaceEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  billingEnsureSheet_(
    ss,
    V2_BILLING_SHEETS_
      .bills,
    billingBillHeaders_()
  );

  billingEnsureSheet_(
    ss,
    V2_BILLING_SHEETS_
      .tenantBillView,
    billingBillViewHeaders_()
  );

  const roomSheet =
    ss.getSheetByName(
      V2_BILLING_SHEETS_
        .rooms
    );

  [
    'latest_meter_reading',
    'latest_meter_bill_month'
  ].forEach(
    function (header) {
      workspaceEnsureHeader_(
        roomSheet,
        header
      );
    }
  );

  return true;
}


function billingRequireSchema_() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const required = [
    V2_BILLING_SHEETS_
      .bills,
    V2_BILLING_SHEETS_
      .tenantBillView,
    V2_BILLING_SHEETS_
      .properties,
    V2_BILLING_SHEETS_
      .rooms,
    V2_BILLING_SHEETS_
      .contracts,
    V2_BILLING_SHEETS_
      .tenants
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
    missing.length > 0
  ) {
    throw new Error(
      '缺少必要資料表：' +
      missing.join(
        '、'
      ) +
      '。請先執行 testEnsureBillingSchema()。'
    );
  }

  return true;
}


function billingEnsureSheet_(
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
        billingText_
      );

  const missing =
    headers.filter(
      function (header) {
        return (
          existing.indexOf(
            header
          ) === -1
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

  return sheet;
}


function billingBillHeaders_() {
  return [
    'bill_id',
    'workspace_id',
    'landlord_id',
    'landlord_line_user_id',
    'tenant_id',
    'tenant_user_id',
    'tenant_line_user_id',
    'tenant_name',
    'contract_id',
    'property_id',
    'property_name',
    'room_id',
    'room_name',
    'bill_month',
    'due_date',
    'rent_amount',
    'management_fee',
    'previous_meter',
    'current_meter_reading',
    'electricity_usage',
    'electricity_fee_rate',
    'equipment_fee_rate',
    'equipment_fee_rate_summer',
    'equipment_fee_rate_regular',
    'equipment_fee_season',
    'electricity_amount',
    'equipment_amount',
    'other_amount',
    'discount_amount',
    'subtotal_amount',
    'total_amount',
    'bill_status',
    'payment_status',
    'sent_status',
    'paid_at',
    'payment_id',
    'created_by_user_id',
    'created_by_membership_id',
    'updated_by_user_id',
    'updated_by_membership_id',
    'created_at',
    'updated_at',
    'note'
  ];
}


function billingBillViewHeaders_() {
  return [
    'line_user_id',
    'user_id'
  ].concat(
    billingBillHeaders_()
  );
}


function billingSetValues_(
  sheet,
  rowNumber,
  values
) {
  if (!sheet) {
    return;
  }

  Object.keys(
    values || {}
  ).forEach(
    function (header) {
      workspaceSetFirstExistingOrCreate_(
        sheet,
        rowNumber,
        [
          header
        ],
        header,
        values[header]
      );
    }
  );
}


// ==================================================
// Formatting
// ==================================================

function billingParseItemsJson_(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value;
  }

  const text =
    billingText_(
      value
    );

  if (!text) {
    return [];
  }

  const parsed =
    JSON.parse(
      text
    );

  if (
    !Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      'items_json 必須是陣列'
    );
  }

  return parsed;
}


function billingNormalizeBillMonth_(
  value
) {
  const serialDate =
    billingSheetSerialDate_(
      value
    );

  if (serialDate) {
    return Utilities.formatDate(
      serialDate,
      'Asia/Taipei',
      'yyyy-MM'
    );
  }

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
    billingText_(
      value
    );

  const compactMatch =
    text.match(
      /^(\d{4})(\d{2})$/
    );

  if (compactMatch) {
    const compactMonth =
      Number(
        compactMatch[2]
      );

    if (
      compactMonth >= 1 &&
      compactMonth <= 12
    ) {
      return (
        compactMatch[1] +
        '-' +
        compactMatch[2]
      );
    }
  }

  const chineseMatch =
    text.match(
      /^(\d{4})\s*年\s*(\d{1,2})\s*月/
    );

  const match =
    chineseMatch ||
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


function billingMonthStart_(
  billMonth
) {
  const parts =
    billingNormalizeBillMonth_(
      billMonth
    ).split(
      '-'
    );

  return new Date(
    Number(
      parts[0]
    ),
    Number(
      parts[1]
    ) - 1,
    1
  );
}


function billingMonthEnd_(
  billMonth
) {
  const start =
    billingMonthStart_(
      billMonth
    );

  return new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0
  );
}


function billingIsSummerMonth_(
  billMonth,
  settingsOrMonths
) {
  if (
    typeof settingsIntegrationIsSummerMonth_ ===
    'function'
  ) {
    return settingsIntegrationIsSummerMonth_(
      billMonth,
      settingsOrMonths
    );
  }

  const month =
    Number(
      billingNormalizeBillMonth_(
        billMonth
      ).split(
        '-'
      )[1]
    );

  return (
    month >= 6 &&
    month <= 9
  );
}


function billingSummerMonthsLabel_(
  settingsOrMonths
) {
  if (
    typeof settingsIntegrationSummerMonthsLabel_ ===
    'function'
  ) {
    return settingsIntegrationSummerMonthsLabel_(
      settingsOrMonths
    );
  }

  return '6–9 月';
}


function billingResolvePaymentDay_(
  room,
  contract,
  billingSettings
) {
  const candidates = [
    room.payment_day,
    room.monthly_payment_day,
    room.rent_due_day,
    room.due_day,
    contract.payment_day,
    contract.monthly_payment_day,
    contract.rent_due_day,
    contract.due_day
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const day =
      Math.round(
        billingNumber_(
          candidates[index]
        )
      );

    if (
      day >= 1 &&
      day <= 28
    ) {
      return day;
    }
  }

  const defaultDay =
    Math.round(
      billingNumber_(
        billingSettings &&
        billingSettings
          .default_payment_day
      )
    );

  return (
    defaultDay >=
      1 &&
    defaultDay <=
      28
  )
    ? defaultDay
    : 10;
}



function billingDefaultDueDate_(
  billMonth,
  day
) {
  return (
    billingNormalizeBillMonth_(
      billMonth
    ) +
    '-' +
    String(
      day || 10
    ).padStart(
      2,
      '0'
    )
  );
}


function billingResolvePositiveNumber_(
  candidates,
  fallback
) {
  for (
    let index = 0;
    index <
      candidates.length;
    index += 1
  ) {
    const value =
      billingNumber_(
        candidates[index]
      );

    if (value > 0) {
      return value;
    }
  }

  return billingNumber_(
    fallback
  );
}


function billingResolveNonNegativeNumber_(
  candidates,
  fallback
) {
  for (
    let index = 0;
    index <
      candidates.length;
    index += 1
  ) {
    if (
      billingText_(
        candidates[index]
      ) !== ''
    ) {
      return Math.max(
        0,
        billingNumber_(
          candidates[index]
        )
      );
    }
  }

  return Math.max(
    0,
    billingNumber_(
      fallback
    )
  );
}


function billingNormalizePaymentStatus_(
  value
) {
  const status =
    billingText_(
      value
    ).toLowerCase();

  if (
    [
      'paid',
      'settled',
      'confirmed',
      'complete',
      'completed'
    ].indexOf(
      status
    ) >= 0
  ) {
    return 'paid';
  }

  return 'unpaid';
}


function billingIsPaidStatus_(
  value
) {
  return (
    billingNormalizePaymentStatus_(
      value
    ) ===
    'paid'
  );
}


function billingCompareText_(
  a,
  b
) {
  return billingText_(
    a
  ).localeCompare(
    billingText_(
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


function billingSheetSerialDate_(
  value
) {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value < 20000 ||
    value > 100000
  ) {
    return null;
  }

  const base =
    new Date(
      1899,
      11,
      30
    );

  const wholeDays =
    Math.floor(
      value
    );

  const milliseconds =
    Math.round(
      (
        value -
        wholeDays
      ) *
      86400000
    );

  const date =
    new Date(
      base.getTime() +
      wholeDays *
      86400000 +
      milliseconds
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


function billingDate_(
  value
) {
  if (!value) {
    return null;
  }

  const serialDate =
    billingSheetSerialDate_(
      value
    );

  if (serialDate) {
    serialDate.setHours(
      0,
      0,
      0,
      0
    );

    return serialDate;
  }

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    const date =
      new Date(
        value.getTime()
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
    billingText_(
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

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date;
}


function billingFormatDate_(
  value
) {
  const date =
    billingDate_(
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


function billingText_(
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


function billingNumber_(
  value
) {
  const number =
    Number(
      billingText_(
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

function testEnsureBillingSchema() {
  billingEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const result = {
    success:
      true,
    bills_columns:
      ss.getSheetByName(
        V2_BILLING_SHEETS_
          .bills
      ).getLastColumn(),
    tenant_bill_view_columns:
      ss.getSheetByName(
        V2_BILLING_SHEETS_
          .tenantBillView
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


function diagnoseBillingPreviousMetersByLineUid_(
  lineUserId,
  billMonth
) {
  billingRequireSchema_();

  const access =
    workspaceLandlordResolveAccess_(
      lineUserId,
      {
        require_onboarding:
          false
      }
    );

  if (!access.success) {
    return access;
  }

  billMonth =
    billingNormalizeBillMonth_(
      billMonth
    ) ||
    Utilities.formatDate(
      new Date(),
      'Asia/Taipei',
      'yyyy-MM'
    );

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const formalBills =
    billingGetWorkspaceRows_(
      ss.getSheetByName(
        V2_BILLING_SHEETS_
          .bills
      ),
      access
    );

  const viewBills =
    billingGetWorkspaceRows_(
      ss.getSheetByName(
        V2_BILLING_SHEETS_
          .tenantBillView
      ),
      access
    );

  const referenceBills =
    billingMergeReferenceBills_(
      formalBills,
      viewBills
    );

  const rooms =
    billingGetWorkspaceRoomRows_(
      ss,
      access,
      {}
    );

  const rows =
    rooms.map(
      function (room) {
        const roomId =
          billingText_(
            room.room_id
          );

        const existingBill =
          formalBills.find(
            function (bill) {
              return (
                billingText_(
                  bill.room_id
                ) ===
                  roomId &&
                billingNormalizeBillMonth_(
                  bill.bill_month
                ) ===
                  billMonth
              );
            }
          ) ||
          null;

        const previousBill =
          billingResolvePreviousBill_(
            referenceBills,
            roomId,
            billMonth
          );

        const resolution =
          billingResolvePreviousMeter_(
            room,
            existingBill,
            previousBill,
            billMonth
          );

        return {
          room_id:
            roomId,
          room_name:
            billingText_(
              room.room_name
            ),
          bill_month:
            billMonth,
          existing_bill_id:
            existingBill
              ? existingBill.bill_id || ''
              : '',
          existing_previous_meter:
            existingBill
              ? existingBill.previous_meter
              : '',
          existing_current_meter:
            existingBill
              ? billingResolveCurrentMeter_(
                  existingBill
                )
              : '',
          previous_bill_id:
            previousBill
              ? previousBill.bill_id || ''
              : '',
          previous_bill_month:
            previousBill
              ? billingNormalizeBillMonth_(
                  previousBill.bill_month
                )
              : '',
          previous_bill_current_meter:
            previousBill
              ? billingResolveCurrentMeter_(
                  previousBill
                )
              : '',
          resolved_previous_meter:
            resolution.value,
          source:
            resolution.source,
          source_label:
            resolution.label
        };
      }
    );

  const result = {
    success:
      true,
    bill_month:
      billMonth,
    formal_bill_count:
      formalBills.length,
    view_bill_count:
      viewBills.length,
    reference_bill_count:
      referenceBills.length,
    rooms:
      rows
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
 * 回填既有 V2_bills 的上期電錶，並重新計算用電衍生金額。
 *
 * 注意：
 * - 不改變租金、管理費、其他費用、折扣與付款狀態。
 * - 會更新 previous_meter、electricity_usage、電費、耗損費與總額。
 * - 適合修復因 previous_meter=0 造成的異常高額帳單。
 */
function repairBillingPreviousMetersByLineUid_(
  lineUserId
) {
  billingEnsureSchema_();

  const access =
    workspaceLandlordResolveAccess_(
      lineUserId,
      {
        require_onboarding:
          false
      }
    );

  if (!access.success) {
    return access;
  }

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const billSheet =
    ss.getSheetByName(
      V2_BILLING_SHEETS_
        .bills
    );

  const tenantBillSheet =
    ss.getSheetByName(
      V2_BILLING_SHEETS_
        .tenantBillView
    );

  const formalBills =
    billingGetWorkspaceRows_(
      billSheet,
      access
    );

  const viewBills =
    billingGetWorkspaceRows_(
      tenantBillSheet,
      access
    );

  const referenceBills =
    billingMergeReferenceBills_(
      formalBills,
      viewBills
    );

  const repaired = [];
  const skipped = [];

  formalBills.forEach(
    function (bill) {
      const roomId =
        billingText_(
          bill.room_id
        );

      const billMonth =
        billingNormalizeBillMonth_(
          bill.bill_month
        );

      if (
        !roomId ||
        !billMonth
      ) {
        return;
      }

      const currentMeter =
        billingResolveCurrentMeter_(
          bill
        );

      const existingPrevious =
        billingResolveMeterCandidate_(
          [
            bill.previous_meter,
            bill.previous_meter_reading,
            bill.last_meter_reading,
            bill.prior_meter
          ]
        );

      const previousBill =
        billingResolvePreviousBill_(
          referenceBills,
          roomId,
          billMonth
        );

      const previousCurrent =
        billingResolveCurrentMeter_(
          previousBill
        );

      if (
        currentMeter ===
          '' ||
        previousCurrent ===
          '' ||
        previousCurrent ===
          null ||
        currentMeter <
          previousCurrent
      ) {
        skipped.push({
          bill_id:
            bill.bill_id || '',
          room_id:
            roomId,
          bill_month:
            billMonth,
          reason:
            '缺少可用的前期或本期電錶'
        });

        return;
      }

      if (
        existingPrevious !==
          null &&
        existingPrevious > 0 &&
        Math.abs(
          existingPrevious -
          previousCurrent
        ) <
          0.0001
      ) {
        return;
      }

      const usage =
        Math.round(
          (
            currentMeter -
            previousCurrent
          ) *
          1000
        ) /
        1000;

      const electricityRate =
        billingNumber_(
          bill.electricity_fee_rate
        );

      const equipmentRate =
        billingNumber_(
          bill.equipment_fee_rate
        );

      const electricityAmount =
        Math.round(
          usage *
          electricityRate
        );

      const equipmentAmount =
        Math.round(
          usage *
          equipmentRate
        );

      const rentAmount =
        Math.round(
          billingNumber_(
            bill.rent_amount
          )
        );

      const managementFee =
        Math.round(
          billingNumber_(
            bill.management_fee
          )
        );

      const otherAmount =
        Math.round(
          billingNumber_(
            bill.other_amount
          )
        );

      const discountAmount =
        Math.round(
          billingNumber_(
            bill.discount_amount
          )
        );

      const subtotal =
        Math.round(
          rentAmount +
          managementFee +
          electricityAmount +
          equipmentAmount +
          otherAmount
        );

      const total =
        Math.max(
          0,
          subtotal -
          discountAmount
        );

      const values = {
        previous_meter:
          previousCurrent,
        current_meter_reading:
          currentMeter,
        electricity_usage:
          usage,
        electricity_amount:
          electricityAmount,
        equipment_amount:
          equipmentAmount,
        subtotal_amount:
          subtotal,
        total_amount:
          total,
        updated_at:
          new Date()
      };

      billingSetValues_(
        billSheet,
        bill.__row_number,
        values
      );

      const viewRow =
        workspaceGetObjectsWithRow_(
          tenantBillSheet
        ).find(
          function (row) {
            return (
              (
                bill.bill_id &&
                billingText_(
                  row.bill_id
                ) ===
                  billingText_(
                    bill.bill_id
                  )
              ) ||
              (
                billingText_(
                  row.room_id
                ) ===
                  roomId &&
                billingNormalizeBillMonth_(
                  row.bill_month
                ) ===
                  billMonth
              )
            );
          }
        );

      if (viewRow) {
        billingSetValues_(
          tenantBillSheet,
          viewRow.__row_number,
          values
        );
      }

      repaired.push({
        bill_id:
          bill.bill_id || '',
        room_id:
          roomId,
        room_name:
          bill.room_name || '',
        bill_month:
          billMonth,
        previous_bill_month:
          previousBill
            ? billingNormalizeBillMonth_(
                previousBill.bill_month
              )
            : '',
        previous_meter_before:
          existingPrevious,
        previous_meter_after:
          previousCurrent,
        current_meter:
          currentMeter,
        electricity_usage:
          usage,
        total_amount:
          total
      });
    }
  );

  SpreadsheetApp.flush();

  billingRefreshWorkspaceSummaries_(
    ss,
    access
  );

  const result = {
    success:
      true,
    repaired_count:
      repaired.length,
    skipped_count:
      skipped.length,
    repaired:
      repaired,
    skipped:
      skipped
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


function testDiagnoseBillingPreviousMeters() {
  return diagnoseBillingPreviousMetersByLineUid_(
    getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
    Utilities.formatDate(
      new Date(),
      'Asia/Taipei',
      'yyyy-MM'
    )
  );
}


function testRepairBillingPreviousMeters() {
  return repairBillingPreviousMetersByLineUid_(
    getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID')
  );
}


function testLandlordBillingInit() {
  const result =
    getLandlordBillingInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      Utilities.formatDate(
        new Date(),
        'Asia/Taipei',
        'yyyy-MM'
      ),
      ''
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
