/**
 * CMWebs V2 物件與房間管理
 *
 * API:
 * - landlord_properties_init
 * - landlord_property_save
 * - landlord_property_archive
 * - landlord_room_save
 * - landlord_room_archive
 *
 * 權限：
 * - owner / admin / manager 可新增與修改
 * - 其他啟用成員可查看
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 * - V2_WORKSPACE_LANDLORD_ACCESS.gs
 * - V2_WORKSPACE_OPERATION_AUDIT.gs（選用）
 */

const V2_PROPERTY_ROOM_SHEETS_ = {
  properties: 'V2_properties',
  rooms: 'V2_rooms',
  propertyOwners: 'V2_property_owners',
  paymentAccounts: 'V2_payment_accounts',
  contracts: 'V2_contracts',
  bills: 'V2_bills'
};

const V2_PROPERTY_TYPES_ = [
  'apartment',
  'suite',
  'building',
  'house',
  'shop',
  'office',
  'other'
];

const V2_ROOM_MANUAL_STATUSES_ = [
  'vacant',
  'maintenance',
  'unavailable'
];


function getLandlordPropertiesInitByLineUid_(
  lineUserId,
  includeArchived
) {
  try {
    const startedAt =
      new Date().getTime();

    propertyRoomRequireReadSchema_();

    const access =
      workspaceLandlordResolveAccess_(
        lineUserId,
        {
          require_onboarding: true
        }
      );

    if (!access.success) {
      return access;
    }

    includeArchived =
      propertyRoomBoolean_(
        includeArchived
      );

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const roomDefaults =
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
            default_deposit_months:
              2,
            summer_months:
              [
                6,
                7,
                8,
                9
              ],
            summer_months_csv:
              '6,7,8,9',
            summer_months_label:
              '6–9 月'
          };

    const properties =
      propertyRoomGetWorkspaceProperties_(
        ss,
        access,
        includeArchived
      );

    const rooms =
      propertyRoomGetWorkspaceRooms_(
        ss,
        access,
        includeArchived
      );

    const contractRows =
      propertyRoomGetWorkspaceRows_(
        ss.getSheetByName(
          V2_PROPERTY_ROOM_SHEETS_
            .contracts
        ),
        access,
        [
          'landlord_id'
        ]
      );

    const currentContractRoomMap = {};
    const latestContractRoomMap = {};

    contractRows.forEach(
      function (contract) {
        const roomId =
          propertyRoomText_(
            contract.room_id
          );

        if (!roomId) {
          return;
        }

        const existingLatest =
          latestContractRoomMap[
            roomId
          ];

        if (
          !existingLatest ||
          propertyRoomContractTimeValue_(
            contract
          ) >=
          propertyRoomContractTimeValue_(
            existingLatest
          )
        ) {
          latestContractRoomMap[
            roomId
          ] =
            contract;
        }

        if (
          propertyRoomContractIsActive_(
            contract
          )
        ) {
          const existingCurrent =
            currentContractRoomMap[
              roomId
            ];

          if (
            !existingCurrent ||
            propertyRoomContractTimeValue_(
              contract
            ) >=
            propertyRoomContractTimeValue_(
              existingCurrent
            )
          ) {
            currentContractRoomMap[
              roomId
            ] =
              contract;
          }
        }
      }
    );

    const roomIdMap = {};

    rooms.forEach(
      function (room) {
        const roomId =
          propertyRoomText_(
            room.room_id
          );

        if (roomId) {
          roomIdMap[
            roomId
          ] = true;
        }
      }
    );

    const billRows =
      propertyRoomGetRowsByRoomIds_(
        ss.getSheetByName(
          V2_PROPERTY_ROOM_SHEETS_
            .bills
        ),
        roomIdMap
      );

    const latestBillRoomMap =
      propertyRoomBuildLatestBillRoomMap_(
        billRows
      );

    const ownerRows =
      propertyRoomGetWorkspaceRows_(
        ss.getSheetByName(
          V2_PROPERTY_ROOM_SHEETS_.propertyOwners
        ),
        access,
        []
      );

    const ownerMap = {};

    ownerRows.forEach(function (row) {
      const propertyId =
        propertyRoomText_(
          row.property_id
        );

      if (!ownerMap[propertyId]) {
        ownerMap[propertyId] = [];
      }

      ownerMap[propertyId].push({
        property_owner_id:
          row.property_owner_id || '',
        owner_user_id:
          row.owner_user_id || '',
        owner_name:
          row.owner_name || '',
        owner_phone:
          row.owner_phone || '',
        ownership_percentage:
          propertyRoomNumber_(
            row.ownership_percentage
          ),
        is_primary_owner:
          propertyRoomBoolean_(
            row.is_primary_owner
          ),
        payment_recipient:
          propertyRoomBoolean_(
            row.payment_recipient
          )
      });
    });

    const roomMap = {};

    rooms.forEach(function (room) {
      const propertyId =
        propertyRoomText_(
          room.property_id
        );

      if (!roomMap[propertyId]) {
        roomMap[propertyId] = [];
      }

      roomMap[propertyId].push(
        propertyRoomBuildRoomView_(
          room,
          currentContractRoomMap,
          latestContractRoomMap,
          latestBillRoomMap
        )
      );
    });

    Object.keys(roomMap).forEach(
      function (propertyId) {
        roomMap[propertyId].sort(
          function (a, b) {
            return propertyRoomCompareText_(
              a.room_name,
              b.room_name
            );
          }
        );
      }
    );

    const propertyViews =
      properties
        .map(function (property) {
          const propertyId =
            propertyRoomText_(
              property.property_id
            );

          const propertyRooms =
            roomMap[propertyId] || [];

          return propertyRoomBuildPropertyView_(
            property,
            propertyRooms,
            ownerMap[propertyId] || []
          );
        })
        .sort(function (a, b) {
          if (
            a.account_status !==
            b.account_status
          ) {
            return a.account_status ===
              'active'
              ? -1
              : 1;
          }

          return propertyRoomCompareText_(
            a.property_name,
            b.property_name
          );
        });

    const allRoomViews = [];

    propertyViews.forEach(
      function (property) {
        property.rooms.forEach(
          function (room) {
            allRoomViews.push(room);
          }
        );
      }
    );

    const paymentAccounts =
      propertyRoomGetWorkspaceRows_(
        ss.getSheetByName(
          V2_PROPERTY_ROOM_SHEETS_.paymentAccounts
        ),
        access,
        []
      )
        .filter(function (row) {
          return propertyRoomText_(
            row.account_status || 'active'
          ).toLowerCase() !==
            'archived';
        })
        .map(function (row) {
          return {
            payment_account_id:
              row.payment_account_id || '',
            account_name:
              row.account_name || '',
            bank_code:
              row.bank_code || '',
            bank_name:
              row.bank_name || '',
            bank_account_last5:
              propertyRoomMaskAccount_(
                row.bank_account
              ),
            is_default:
              propertyRoomBoolean_(
                row.is_default
              )
          };
        });

    return workspaceResult_(
      true,
      'OK',
      '物件與房間資料載入成功',
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
        permissions:
          access.permissions || {},
        can_write:
          propertyRoomCanWrite_(
            access
          ),
        include_archived:
          includeArchived,
        summary: {
          property_count:
            propertyViews.filter(
              function (property) {
                return property.account_status ===
                  'active';
              }
            ).length,
          archived_property_count:
            propertyViews.filter(
              function (property) {
                return property.account_status ===
                  'archived';
              }
            ).length,
          room_count:
            allRoomViews.filter(
              function (room) {
                return room.account_status ===
                  'active';
              }
            ).length,
          vacant_room_count:
            allRoomViews.filter(
              function (room) {
                return (
                  room.account_status ===
                    'active' &&
                  room.effective_status ===
                    'vacant'
                );
              }
            ).length,
          occupied_room_count:
            allRoomViews.filter(
              function (room) {
                return (
                  room.account_status ===
                    'active' &&
                  room.effective_status ===
                    'occupied'
                );
              }
            ).length,
          maintenance_room_count:
            allRoomViews.filter(
              function (room) {
                return (
                  room.account_status ===
                    'active' &&
                  room.effective_status ===
                    'maintenance'
                );
              }
            ).length
        },
        property_types:
          propertyRoomPropertyTypeOptions_(),
        room_statuses:
          propertyRoomRoomStatusOptions_(),
        room_defaults:
          typeof settingsIntegrationBuildBillingDefaultsView_ ===
            'function'
            ? settingsIntegrationBuildBillingDefaultsView_(
                roomDefaults
              )
            : roomDefaults,
        payment_accounts:
          paymentAccounts,
        properties:
          propertyViews,
        diagnostics: {
          elapsed_ms:
            new Date().getTime() -
            startedAt,
          raw_property_count:
            properties.length,
          raw_room_count:
            rooms.length,
          contract_count:
            contractRows.length,
          active_contract_room_count:
            Object.keys(
              currentContractRoomMap
            ).length,
          latest_contract_room_count:
            Object.keys(
              latestContractRoomMap
            ).length,
          bill_count:
            billRows.length,
          latest_bill_room_count:
            Object.keys(
              latestBillRoomMap
            ).length
        }
      }
    );

  } catch (error) {
    return workspaceResult_(
      false,
      'PROPERTY_ROOM_INIT_ERROR',
      '物件資料載入失敗：' +
        error.message
    );
  }
}


function saveLandlordPropertyByLineUid_(
  lineUserId,
  propertyId,
  propertyName,
  city,
  district,
  propertyAddress,
  propertyType,
  paymentAccountId,
  note
) {
  const lock =
    LockService.getScriptLock();

  let locked = false;

  try {
    propertyRoomEnsureSchema_();

    const access =
      workspaceLandlordResolveAccess_(
        lineUserId,
        {
          require_onboarding: true
        }
      );

    if (!access.success) {
      return access;
    }

    const permission =
      propertyRoomRequireWrite_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    propertyId =
      propertyRoomText_(
        propertyId
      );

    propertyName =
      propertyRoomText_(
        propertyName
      );

    city =
      propertyRoomText_(
        city
      );

    district =
      propertyRoomText_(
        district
      );

    propertyAddress =
      propertyRoomText_(
        propertyAddress
      );

    propertyType =
      propertyRoomText_(
        propertyType
      ).toLowerCase();

    paymentAccountId =
      propertyRoomText_(
        paymentAccountId
      );

    note =
      propertyRoomText_(
        note
      );

    if (
      !propertyName ||
      propertyName.length > 100
    ) {
      return workspaceResult_(
        false,
        'INVALID_PROPERTY_NAME',
        '請輸入 1 至 100 字的物件名稱'
      );
    }

    if (
      !city ||
      !district ||
      !propertyAddress
    ) {
      return workspaceResult_(
        false,
        'PROPERTY_ADDRESS_REQUIRED',
        '請完整輸入縣市、行政區與物件地址'
      );
    }

    if (
      V2_PROPERTY_TYPES_.indexOf(
        propertyType
      ) === -1
    ) {
      return workspaceResult_(
        false,
        'INVALID_PROPERTY_TYPE',
        '請選擇正確的物件類型'
      );
    }

    if (note.length > 500) {
      return workspaceResult_(
        false,
        'NOTE_TOO_LONG',
        '備註最多 500 字'
      );
    }

    lock.waitLock(20000);
    locked = true;

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const sheet =
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_.properties
      );

    let existing = null;

    if (propertyId) {
      existing =
        propertyRoomFindWorkspaceTarget_(
          sheet,
          access,
          'property_id',
          propertyId
        );

      if (!existing) {
        return workspaceResult_(
          false,
          'PROPERTY_NOT_FOUND',
          '找不到指定物件或無權限存取'
        );
      }
    }

    const duplicate =
      propertyRoomGetWorkspaceProperties_(
        ss,
        access,
        true
      ).find(function (row) {
        return (
          propertyRoomText_(
            row.property_name
          ).toLowerCase() ===
            propertyName.toLowerCase() &&
          propertyRoomText_(
            row.property_id
          ) !==
            propertyId &&
          propertyRoomText_(
            row.account_status || 'active'
          ).toLowerCase() !==
            'archived'
        );
      });

    if (duplicate) {
      return workspaceResult_(
        false,
        'DUPLICATE_PROPERTY_NAME',
        '目前管理團隊已有相同名稱的物件'
      );
    }

    if (
      paymentAccountId &&
      !propertyRoomPaymentAccountBelongsToWorkspace_(
        ss,
        access,
        paymentAccountId
      )
    ) {
      return workspaceResult_(
        false,
        'PAYMENT_ACCOUNT_NOT_FOUND',
        '找不到指定收款帳號'
      );
    }

    const now =
      new Date();

    const actor =
      propertyRoomActor_(
        access
      );

    const values = {
      workspace_id:
        propertyRoomText_(
          access.workspace.workspace_id
        ).toUpperCase(),
      landlord_id:
        access.principal_landlord_id || '',
      landlord_line_user_id:
        access.principal_line_user_id || '',
      property_name:
        propertyName,
      city:
        city,
      district:
        district,
      property_address:
        propertyAddress,
      address:
        propertyAddress,
      property_type:
        propertyType,
      property_status:
        'active',
      account_status:
        'active',
      default_payment_account_id:
        paymentAccountId ||
        access.workspace
          .default_payment_account_id ||
        '',
      is_onboarding_property:
        false,
      updated_by_user_id:
        actor.user_id,
      updated_by_membership_id:
        actor.membership_id,
      updated_at:
        now,
      note:
        note
    };

    let savedPropertyId =
      propertyId;

    if (existing) {
      propertyRoomSetValues_(
        sheet,
        existing.__row_number,
        values
      );
    } else {
      savedPropertyId =
        workspaceNextId_(
          sheet,
          'property_id',
          'P',
          6
        );

      workspaceAppendObject_(
        sheet,
        Object.assign(
          {
            property_id:
              savedPropertyId,
            created_by_user_id:
              actor.user_id,
            created_by_membership_id:
              actor.membership_id,
            created_at:
              now
          },
          values
        )
      );

      propertyRoomEnsurePrimaryOwner_(
        ss,
        access,
        savedPropertyId
      );
    }

    SpreadsheetApp.flush();

    const result =
      workspaceResult_(
        true,
        existing
          ? 'PROPERTY_UPDATED'
          : 'PROPERTY_CREATED',
        existing
          ? '物件資料已更新'
          : '物件已建立',
        {
          property_id:
            savedPropertyId
        }
      );

    propertyRoomAudit_(
      access,
      existing
        ? 'landlord_property_update'
        : 'landlord_property_create',
      result,
      {
        target_type:
          'property',
        target_id:
          savedPropertyId,
        detail:
          'property_name=' +
          propertyName
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'PROPERTY_SAVE_ERROR',
      '物件儲存失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


function archiveLandlordPropertyByLineUid_(
  lineUserId,
  propertyId,
  archiveReason
) {
  const lock =
    LockService.getScriptLock();

  let locked = false;

  try {
    propertyRoomEnsureSchema_();

    const access =
      workspaceLandlordResolveAccess_(
        lineUserId,
        {
          require_onboarding: true
        }
      );

    if (!access.success) {
      return access;
    }

    const permission =
      propertyRoomRequireWrite_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    propertyId =
      propertyRoomText_(
        propertyId
      );

    archiveReason =
      propertyRoomText_(
        archiveReason
      );

    if (!propertyId) {
      return workspaceResult_(
        false,
        'MISSING_PROPERTY_ID',
        '缺少物件編號'
      );
    }

    if (!archiveReason) {
      return workspaceResult_(
        false,
        'ARCHIVE_REASON_REQUIRED',
        '請輸入封存原因'
      );
    }

    lock.waitLock(20000);
    locked = true;

    const propertySheet =
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_.properties
      );

    const property =
      propertyRoomFindWorkspaceTarget_(
        propertySheet,
        access,
        'property_id',
        propertyId
      );

    if (!property) {
      return workspaceResult_(
        false,
        'PROPERTY_NOT_FOUND',
        '找不到指定物件或無權限存取'
      );
    }

    const activeRooms =
      propertyRoomGetWorkspaceRooms_(
        ss,
        access,
        true
      ).filter(function (room) {
        return (
          propertyRoomText_(
            room.property_id
          ) ===
            propertyId &&
          propertyRoomText_(
            room.account_status || 'active'
          ).toLowerCase() !==
            'archived'
        );
      });

    if (activeRooms.length > 0) {
      return workspaceResult_(
        false,
        'PROPERTY_HAS_ACTIVE_ROOMS',
        '請先封存此物件下的所有房間'
      );
    }

    const actor =
      propertyRoomActor_(
        access
      );

    const now =
      new Date();

    propertyRoomSetValues_(
      propertySheet,
      property.__row_number,
      {
        property_status:
          'archived',
        account_status:
          'archived',
        archived_at:
          now,
        archived_by_user_id:
          actor.user_id,
        archived_by_membership_id:
          actor.membership_id,
        archive_reason:
          archiveReason,
        updated_at:
          now
      }
    );

    SpreadsheetApp.flush();

    const result =
      workspaceResult_(
        true,
        'PROPERTY_ARCHIVED',
        '物件已封存',
        {
          property_id:
            propertyId
        }
      );

    propertyRoomAudit_(
      access,
      'landlord_property_archive',
      result,
      {
        target_type:
          'property',
        target_id:
          propertyId,
        detail:
          archiveReason
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'PROPERTY_ARCHIVE_ERROR',
      '物件封存失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


function saveLandlordRoomByLineUid_(
  lineUserId,
  roomId,
  propertyId,
  roomName,
  rentAmount,
  managementFee,
  electricityFeeRate,
  equipmentFeeRate,
  equipmentFeeRateSummer,
  equipmentFeeRateRegular,
  paymentDay,
  depositMonths,
  depositAmount,
  roomStatus,
  note
) {
  const lock =
    LockService.getScriptLock();

  let locked = false;

  try {
    propertyRoomEnsureSchema_();

    const access =
      workspaceLandlordResolveAccess_(
        lineUserId,
        {
          require_onboarding: true
        }
      );

    if (!access.success) {
      return access;
    }

    const permission =
      propertyRoomRequireWrite_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const roomDefaults =
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
            default_deposit_months:
              2,
            summer_months:
              [
                6,
                7,
                8,
                9
              ],
            summer_months_csv:
              '6,7,8,9'
          };

    const managementFeeText =
      propertyRoomText_(
        managementFee
      );

    const electricityFeeRateText =
      propertyRoomText_(
        electricityFeeRate
      );

    const paymentDayText =
      propertyRoomText_(
        paymentDay
      );

    roomId =
      propertyRoomText_(
        roomId
      );

    propertyId =
      propertyRoomText_(
        propertyId
      );

    roomName =
      propertyRoomText_(
        roomName
      );

    rentAmount =
      propertyRoomMoney_(
        rentAmount
      );

    managementFee =
      managementFeeText
        ? propertyRoomMoney_(
            managementFeeText
          )
        : propertyRoomMoney_(
            roomDefaults
              .default_management_fee
          );

    electricityFeeRate =
      electricityFeeRateText
        ? propertyRoomRate_(
            electricityFeeRateText
          )
        : propertyRoomRate_(
            roomDefaults
              .default_electricity_fee_rate
          );

    equipmentFeeRate =
      propertyRoomRate_(
        equipmentFeeRate
      );

    const equipmentSummerText =
      propertyRoomText_(
        equipmentFeeRateSummer
      );

    const equipmentRegularText =
      propertyRoomText_(
        equipmentFeeRateRegular
      );

    equipmentFeeRateSummer =
      propertyRoomRate_(
        equipmentSummerText
      );

    equipmentFeeRateRegular =
      propertyRoomRate_(
        equipmentRegularText
      );

    /*
     * 舊版只傳單一 equipment_fee_rate 時，兩個季節沿用舊值。
     * 新增房間未填時，改用目前 Workspace 的帳務預設。
     */
    if (
      !equipmentSummerText
    ) {
      equipmentFeeRateSummer =
        equipmentFeeRate > 0
          ? equipmentFeeRate
          : propertyRoomRate_(
              roomDefaults
                .summer_equipment_fee_rate
            );
    }

    if (
      !equipmentRegularText
    ) {
      equipmentFeeRateRegular =
        equipmentFeeRate > 0
          ? equipmentFeeRate
          : propertyRoomRate_(
              roomDefaults
                .regular_equipment_fee_rate
            );
    }

    equipmentFeeRate =
      propertyRoomEquipmentRateForMonth_(
        equipmentFeeRateSummer,
        equipmentFeeRateRegular,
        new Date(),
        roomDefaults.summer_months
      );

    paymentDay =
      paymentDayText
        ? Number(
            paymentDayText
          )
        : Number(
            roomDefaults
              .default_payment_day
          );

    const depositMonthsText =
      propertyRoomText_(
        depositMonths
      );

    const depositAmountText =
      propertyRoomText_(
        depositAmount
      );

    depositMonths =
      propertyRoomNumber_(
        depositMonthsText
      );

    depositAmount =
      propertyRoomMoney_(
        depositAmountText
      );

    if (
      !depositAmountText &&
      !depositMonthsText
    ) {
      depositMonths =
        propertyRoomNumber_(
          roomDefaults
            .default_deposit_months
        );
    }

    /*
     * 新版以押金金額為主要輸入；舊版仍可能只傳 deposit_months。
     * 未傳金額時，自動以月租 × 押金月數轉換，保持舊頁面相容。
     */
    if (
      !depositAmountText &&
      depositMonths > 0
    ) {
      depositAmount =
        Math.round(
          rentAmount *
          depositMonths
        );
    }

    if (
      depositAmountText &&
      rentAmount > 0
    ) {
      depositMonths =
        Math.round(
          (
            depositAmount /
            rentAmount
          ) *
          100
        ) /
        100;
    }

    roomStatus =
      propertyRoomText_(
        roomStatus || 'vacant'
      ).toLowerCase();

    note =
      propertyRoomText_(
        note
      );

    if (!propertyId) {
      return workspaceResult_(
        false,
        'MISSING_PROPERTY_ID',
        '請選擇所屬物件'
      );
    }

    if (
      !roomName ||
      roomName.length > 80
    ) {
      return workspaceResult_(
        false,
        'INVALID_ROOM_NAME',
        '請輸入 1 至 80 字的房號或房間名稱'
      );
    }

    if (rentAmount <= 0) {
      return workspaceResult_(
        false,
        'INVALID_RENT_AMOUNT',
        '每月租金必須大於 0'
      );
    }

    if (
      managementFee < 0 ||
      electricityFeeRate < 0 ||
      equipmentFeeRateSummer < 0 ||
      equipmentFeeRateRegular < 0
    ) {
      return workspaceResult_(
        false,
        'INVALID_FEE_AMOUNT',
        '管理費與計費單價不得為負數'
      );
    }

    if (
      electricityFeeRate > 30 ||
      equipmentFeeRateSummer > 30 ||
      equipmentFeeRateRegular > 30
    ) {
      return workspaceResult_(
        false,
        'FEE_RATE_TOO_HIGH',
        '每度計費單價不得超過 30 元'
      );
    }

    if (
      !Number.isInteger(
        paymentDay
      ) ||
      paymentDay < 1 ||
      paymentDay > 28
    ) {
      return workspaceResult_(
        false,
        'INVALID_PAYMENT_DAY',
        '每月繳款日請輸入 1 至 28'
      );
    }

    if (
      !Number.isFinite(
        depositAmount
      ) ||
      depositAmount < 0
    ) {
      return workspaceResult_(
        false,
        'INVALID_DEPOSIT_AMOUNT',
        '押金金額不得為負數'
      );
    }

    if (
      rentAmount > 0 &&
      depositAmount >
        rentAmount * 12
    ) {
      return workspaceResult_(
        false,
        'DEPOSIT_AMOUNT_TOO_HIGH',
        '押金金額不得超過 12 個月租金'
      );
    }

    if (
      V2_ROOM_MANUAL_STATUSES_.indexOf(
        roomStatus
      ) === -1
    ) {
      return workspaceResult_(
        false,
        'INVALID_ROOM_STATUS',
        '不支援的房間狀態'
      );
    }

    if (note.length > 500) {
      return workspaceResult_(
        false,
        'NOTE_TOO_LONG',
        '備註最多 500 字'
      );
    }

    lock.waitLock(20000);
    locked = true;

    const propertySheet =
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_.properties
      );

    const property =
      propertyRoomFindWorkspaceTarget_(
        propertySheet,
        access,
        'property_id',
        propertyId
      );

    if (
      !property ||
      propertyRoomText_(
        property.account_status || 'active'
      ).toLowerCase() ===
        'archived'
    ) {
      return workspaceResult_(
        false,
        'PROPERTY_NOT_AVAILABLE',
        '找不到指定物件或物件已封存'
      );
    }

    const roomSheet =
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_.rooms
      );

    let existing = null;

    if (roomId) {
      existing =
        propertyRoomFindWorkspaceTarget_(
          roomSheet,
          access,
          'room_id',
          roomId
        );

      if (!existing) {
        return workspaceResult_(
          false,
          'ROOM_NOT_FOUND',
          '找不到指定房間或無權限存取'
        );
      }

      if (
        propertyRoomText_(
          existing.property_id
        ) !==
        propertyId
      ) {
        return workspaceResult_(
          false,
          'ROOM_PROPERTY_CHANGE_NOT_ALLOWED',
          '既有房間不能直接移動到其他物件'
        );
      }
    }

    const duplicate =
      propertyRoomGetWorkspaceRooms_(
        ss,
        access,
        true
      ).find(function (row) {
        return (
          propertyRoomText_(
            row.property_id
          ) ===
            propertyId &&
          propertyRoomText_(
            row.room_name
          ).toLowerCase() ===
            roomName.toLowerCase() &&
          propertyRoomText_(
            row.room_id
          ) !==
            roomId &&
          propertyRoomText_(
            row.account_status || 'active'
          ).toLowerCase() !==
            'archived'
        );
      });

    if (duplicate) {
      return workspaceResult_(
        false,
        'DUPLICATE_ROOM_NAME',
        '此物件已有相同房號或房間名稱'
      );
    }

    const hasActiveContract =
      roomId
        ? propertyRoomHasActiveContract_(
            ss,
            access,
            roomId
          )
        : false;

    if (hasActiveContract) {
      roomStatus =
        'occupied';
    }

    const now =
      new Date();

    const actor =
      propertyRoomActor_(
        access
      );

    const values = {
      workspace_id:
        propertyRoomText_(
          access.workspace.workspace_id
        ).toUpperCase(),
      property_id:
        propertyId,
      landlord_id:
        access.principal_landlord_id || '',
      landlord_line_user_id:
        access.principal_line_user_id || '',
      property_name:
        property.property_name || '',
      room_name:
        roomName,
      room_status:
        roomStatus,
      account_status:
        'active',
      rent_amount:
        rentAmount,
      management_fee:
        managementFee,
      electricity_fee_rate:
        electricityFeeRate,
      equipment_fee_rate:
        equipmentFeeRate,
      equipment_fee_rate_summer:
        equipmentFeeRateSummer,
      equipment_fee_rate_regular:
        equipmentFeeRateRegular,
      equipment_summer_months:
        typeof settingsIntegrationSummerMonthsCsv_ ===
          'function'
          ? settingsIntegrationSummerMonthsCsv_(
              roomDefaults.summer_months
            )
          : (
              roomDefaults.summer_months_csv ||
              '6,7,8,9'
            ),
      payment_day:
        paymentDay,
      monthly_payment_day:
        paymentDay,
      deposit_months:
        depositMonths,
      deposit_amount:
        depositAmount,
      is_onboarding_room:
        false,
      updated_by_user_id:
        actor.user_id,
      updated_by_membership_id:
        actor.membership_id,
      updated_at:
        now,
      note:
        note
    };

    let savedRoomId =
      roomId;

    if (existing) {
      propertyRoomSetValues_(
        roomSheet,
        existing.__row_number,
        values
      );
    } else {
      savedRoomId =
        workspaceNextId_(
          roomSheet,
          'room_id',
          'R',
          6
        );

      workspaceAppendObject_(
        roomSheet,
        Object.assign(
          {
            room_id:
              savedRoomId,
            created_by_user_id:
              actor.user_id,
            created_by_membership_id:
              actor.membership_id,
            created_at:
              now
          },
          values
        )
      );
    }

    SpreadsheetApp.flush();

    const result =
      workspaceResult_(
        true,
        existing
          ? 'ROOM_UPDATED'
          : 'ROOM_CREATED',
        existing
          ? '房間資料已更新'
          : '房間已建立',
        {
          room_id:
            savedRoomId,
          property_id:
            propertyId
        }
      );

    propertyRoomAudit_(
      access,
      existing
        ? 'landlord_room_update'
        : 'landlord_room_create',
      result,
      {
        target_type:
          'room',
        target_id:
          savedRoomId,
        secondary_target_id:
          propertyId,
        operation_status:
          roomStatus,
        detail:
          'room_name=' +
          roomName
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'ROOM_SAVE_ERROR',
      '房間儲存失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


function archiveLandlordRoomByLineUid_(
  lineUserId,
  roomId,
  archiveReason
) {
  const lock =
    LockService.getScriptLock();

  let locked = false;

  try {
    propertyRoomEnsureSchema_();

    const access =
      workspaceLandlordResolveAccess_(
        lineUserId,
        {
          require_onboarding: true
        }
      );

    if (!access.success) {
      return access;
    }

    const permission =
      propertyRoomRequireWrite_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    roomId =
      propertyRoomText_(
        roomId
      );

    archiveReason =
      propertyRoomText_(
        archiveReason
      );

    if (!roomId) {
      return workspaceResult_(
        false,
        'MISSING_ROOM_ID',
        '缺少房間編號'
      );
    }

    if (!archiveReason) {
      return workspaceResult_(
        false,
        'ARCHIVE_REASON_REQUIRED',
        '請輸入封存原因'
      );
    }

    lock.waitLock(20000);
    locked = true;

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const roomSheet =
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_.rooms
      );

    const room =
      propertyRoomFindWorkspaceTarget_(
        roomSheet,
        access,
        'room_id',
        roomId
      );

    if (!room) {
      return workspaceResult_(
        false,
        'ROOM_NOT_FOUND',
        '找不到指定房間或無權限存取'
      );
    }

    if (
      propertyRoomHasActiveContract_(
        ss,
        access,
        roomId
      ) ||
      propertyRoomText_(
        room.room_status
      ).toLowerCase() ===
        'occupied'
    ) {
      return workspaceResult_(
        false,
        'ROOM_HAS_ACTIVE_CONTRACT',
        '此房間仍有有效租約，不能封存'
      );
    }

    const actor =
      propertyRoomActor_(
        access
      );

    const now =
      new Date();

    propertyRoomSetValues_(
      roomSheet,
      room.__row_number,
      {
        room_status:
          'archived',
        account_status:
          'archived',
        archived_at:
          now,
        archived_by_user_id:
          actor.user_id,
        archived_by_membership_id:
          actor.membership_id,
        archive_reason:
          archiveReason,
        updated_at:
          now
      }
    );

    SpreadsheetApp.flush();

    const result =
      workspaceResult_(
        true,
        'ROOM_ARCHIVED',
        '房間已封存',
        {
          room_id:
            roomId
        }
      );

    propertyRoomAudit_(
      access,
      'landlord_room_archive',
      result,
      {
        target_type:
          'room',
        target_id:
          roomId,
        secondary_target_id:
          room.property_id || '',
        detail:
          archiveReason
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'ROOM_ARCHIVE_ERROR',
      '房間封存失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


// -------------------- Data helpers --------------------

function propertyRoomGetWorkspaceProperties_(
  ss,
  access,
  includeArchived
) {
  return propertyRoomGetWorkspaceRows_(
    ss.getSheetByName(
      V2_PROPERTY_ROOM_SHEETS_.properties
    ),
    access,
    [
      'landlord_id'
    ]
  ).filter(function (row) {
    return (
      includeArchived ||
      propertyRoomText_(
        row.account_status || 'active'
      ).toLowerCase() !==
        'archived'
    );
  });
}


function propertyRoomGetWorkspaceRooms_(
  ss,
  access,
  includeArchived
) {
  const roomSheet =
    ss.getSheetByName(
      V2_PROPERTY_ROOM_SHEETS_
        .rooms
    );

  if (!roomSheet) {
    return [];
  }

  const workspaceId =
    propertyRoomText_(
      access.workspace.workspace_id
    ).toUpperCase();

  const properties =
    propertyRoomGetWorkspaceProperties_(
      ss,
      access,
      true
    );

  const propertyIds =
    properties
      .map(
        function (property) {
          return propertyRoomText_(
            property.property_id
          );
        }
      )
      .filter(Boolean);

  const landlordIds =
    (
      access.principals || []
    )
      .map(
        function (principal) {
          return propertyRoomText_(
            principal.landlord_id
          );
        }
      )
      .filter(Boolean);

  return workspaceGetObjectsWithRow_(
    roomSheet
  ).filter(
    function (row) {
      const rowWorkspaceId =
        propertyRoomText_(
          row.workspace_id
        ).toUpperCase();

      const propertyId =
        propertyRoomText_(
          row.property_id
        );

      const landlordId =
        propertyRoomText_(
          row.landlord_id
        );

      const belongsToWorkspace =
        rowWorkspaceId ===
          workspaceId ||
        (
          propertyId &&
          propertyIds.indexOf(
            propertyId
          ) >= 0
        ) ||
        (
          !rowWorkspaceId &&
          landlordId &&
          landlordIds.indexOf(
            landlordId
          ) >= 0
        );

      if (!belongsToWorkspace) {
        return false;
      }

      return (
        includeArchived ||
        propertyRoomText_(
          row.account_status ||
          'active'
        ).toLowerCase() !==
          'archived'
      );
    }
  );
}


function propertyRoomGetWorkspaceRows_(
  sheet,
  access,
  landlordIdHeaders
) {
  if (!sheet) {
    return [];
  }

  const workspaceId =
    propertyRoomText_(
      access.workspace.workspace_id
    ).toUpperCase();

  const landlordIds =
    access.principals
      .map(function (principal) {
        return propertyRoomText_(
          principal.landlord_id
        );
      })
      .filter(Boolean);

  return workspaceGetObjectsWithRow_(
    sheet
  ).filter(function (row) {
    const rowWorkspaceId =
      propertyRoomText_(
        row.workspace_id
      ).toUpperCase();

    if (rowWorkspaceId) {
      return rowWorkspaceId ===
        workspaceId;
    }

    return (
      landlordIdHeaders || []
    ).some(function (header) {
      return landlordIds.indexOf(
        propertyRoomText_(
          row[header]
        )
      ) >= 0;
    });
  });
}


function propertyRoomFindWorkspaceTarget_(
  sheet,
  access,
  idHeader,
  idValue
) {
  return propertyRoomGetWorkspaceRows_(
    sheet,
    access,
    [
      'landlord_id'
    ]
  ).find(function (row) {
    return propertyRoomText_(
      row[idHeader]
    ) ===
      idValue;
  }) || null;
}


function propertyRoomBuildPropertyView_(
  property,
  rooms,
  owners
) {
  const activeRooms =
    rooms.filter(function (room) {
      return room.account_status ===
        'active';
    });

  return {
    property_id:
      property.property_id || '',
    workspace_id:
      property.workspace_id || '',
    landlord_id:
      property.landlord_id || '',
    property_name:
      propertyRoomText_(
        property.property_name
      ),
    city:
      property.city || '',
    district:
      property.district || '',
    property_address:
      property.property_address ||
      property.address ||
      '',
    property_type:
      property.property_type || '',
    property_type_label:
      propertyRoomPropertyTypeLabel_(
        property.property_type
      ),
    property_status:
      propertyRoomText_(
        property.property_status ||
        property.account_status ||
        'active'
      ).toLowerCase(),
    account_status:
      propertyRoomText_(
        property.account_status ||
        'active'
      ).toLowerCase(),
    default_payment_account_id:
      property.default_payment_account_id || '',
    note:
      property.note || '',
    owners:
      owners,
    summary: {
      room_count:
        activeRooms.length,
      vacant_count:
        activeRooms.filter(
          function (room) {
            return room.effective_status ===
              'vacant';
          }
        ).length,
      occupied_count:
        activeRooms.filter(
          function (room) {
            return room.effective_status ===
              'occupied';
          }
        ).length,
      maintenance_count:
        activeRooms.filter(
          function (room) {
            return room.effective_status ===
              'maintenance';
          }
        ).length
    },
    rooms:
      rooms
  };
}


function propertyRoomBuildRoomView_(
  room,
  currentContractRoomMap,
  latestContractRoomMap,
  latestBillRoomMap
) {
  const roomId =
    propertyRoomText_(
      room.room_id
    );

  const currentContract =
    currentContractRoomMap &&
    currentContractRoomMap[
      roomId
    ]
      ? currentContractRoomMap[
          roomId
        ]
      : null;

  const latestContract =
    latestContractRoomMap &&
    latestContractRoomMap[
      roomId
    ]
      ? latestContractRoomMap[
          roomId
        ]
      : null;

  const financialContract =
    currentContract ||
    latestContract ||
    {};

  const hasActiveContract =
    Boolean(
      currentContract
    );

  const storedStatus =
    propertyRoomText_(
      room.room_status ||
      'vacant'
    ).toLowerCase();

  const effectiveStatus =
    hasActiveContract
      ? 'occupied'
      : (
          storedStatus ===
            'occupied'
            ? 'vacant'
            : storedStatus
        );

  const roomRent =
    propertyRoomNumber_(
      room.rent_amount
    );

  const contractRent =
    propertyRoomNumber_(
      financialContract.rent_amount ||
      financialContract.monthly_rent
    );

  const latestBill =
    latestBillRoomMap &&
    latestBillRoomMap[
      roomId
    ]
      ? latestBillRoomMap[
          roomId
        ]
      : null;

  const paymentDay =
    propertyRoomResolvePaymentDay_(
      room,
      financialContract,
      latestBill
    );

  const resolvedRent =
    roomRent > 0
      ? roomRent
      : contractRent;

  const depositMonths =
    propertyRoomResolveDepositMonths_(
      room,
      financialContract,
      resolvedRent
    );

  const depositAmount =
    propertyRoomResolveDepositAmount_(
      room,
      financialContract,
      resolvedRent,
      depositMonths
    );

  return {
    room_id:
      roomId,
    property_id:
      propertyRoomText_(
        room.property_id
      ),
    property_name:
      propertyRoomText_(
        room.property_name ||
        financialContract.property_name
      ),
    room_name:
      propertyRoomText_(
        room.room_name ||
        financialContract.room_name
      ),
    room_status:
      storedStatus,
    effective_status:
      effectiveStatus,
    effective_status_label:
      propertyRoomRoomStatusLabel_(
        effectiveStatus
      ),
    account_status:
      propertyRoomText_(
        room.account_status ||
        'active'
      ).toLowerCase(),

    rent_amount:
      roomRent > 0
        ? Math.round(
            roomRent
          )
        : Math.round(
            contractRent
          ),

    management_fee:
      propertyRoomFallbackMoney_(
        room.management_fee,
        financialContract.management_fee ||
        financialContract.monthly_management_fee
      ),

    electricity_fee_rate:
      propertyRoomResolvePositiveRate_(
        [
          room.electricity_fee_rate,
          room.electricity_rate,
          room.power_fee_rate,
          financialContract.electricity_fee_rate,
          financialContract.electricity_rate,
          financialContract.power_fee_rate,
          latestBill
            ? latestBill.electricity_fee_rate
            : '',
          latestBill
            ? latestBill.electricity_rate
            : ''
        ],
        0
      ),

    equipment_fee_rate_summer:
      propertyRoomResolveEquipmentSeasonRate_(
        room,
        financialContract,
        latestBill,
        true
      ),

    equipment_fee_rate_regular:
      propertyRoomResolveEquipmentSeasonRate_(
        room,
        financialContract,
        latestBill,
        false
      ),

    equipment_fee_rate:
      propertyRoomEquipmentRateForMonth_(
        propertyRoomResolveEquipmentSeasonRate_(
          room,
          financialContract,
          latestBill,
          true
        ),
        propertyRoomResolveEquipmentSeasonRate_(
          room,
          financialContract,
          latestBill,
          false
        ),
        new Date(),
        room.equipment_summer_months ||
        financialContract
          .equipment_summer_months
      ),

    equipment_fee_season:
      propertyRoomIsSummerMonth_(
        new Date(),
        room.equipment_summer_months ||
        financialContract
          .equipment_summer_months
      )
        ? 'summer'
        : 'regular',

    equipment_fee_season_label:
      propertyRoomIsSummerMonth_(
        new Date(),
        room.equipment_summer_months ||
        financialContract
          .equipment_summer_months
      )
        ? (
            '夏月（' +
            (
              typeof settingsIntegrationSummerMonthsLabel_ ===
                'function'
                ? settingsIntegrationSummerMonthsLabel_(
                    typeof settingsIntegrationParseMonths_ ===
                      'function'
                      ? settingsIntegrationParseMonths_(
                          room.equipment_summer_months ||
                          financialContract
                            .equipment_summer_months
                        )
                      : [
                          6,
                          7,
                          8,
                          9
                        ]
                  )
                : '6–9 月'
            ) +
            '）'
          )
        : '其他月份',

    payment_day:
      paymentDay,

    deposit_months:
      depositMonths,

    deposit_amount:
      depositAmount,

    current_contract_id:
      currentContract
        ? propertyRoomText_(
            currentContract.contract_id
          )
        : '',

    latest_contract_id:
      latestContract
        ? propertyRoomText_(
            latestContract.contract_id
          )
        : '',

    current_tenant_id:
      currentContract
        ? propertyRoomText_(
            currentContract.tenant_id
          )
        : propertyRoomText_(
            room.current_tenant_id
          ),

    current_tenant_name:
      currentContract
        ? propertyRoomText_(
            currentContract.tenant_name
          )
        : propertyRoomText_(
            room.current_tenant_name
          ),

    has_active_contract:
      hasActiveContract,

    financial_source:
      roomRent > 0
        ? 'room'
        : (
            contractRent > 0
              ? 'contract'
              : 'empty'
          ),

    payment_day_source:
      propertyRoomPaymentDaySource_(
        room,
        financialContract,
        latestBill
      ),

    deposit_months_source:
      propertyRoomDepositMonthsSource_(
        room,
        financialContract,
        resolvedRent
      ),

    deposit_amount_source:
      propertyRoomDepositAmountSource_(
        room,
        financialContract,
        resolvedRent,
        depositMonths
      ),

    note:
      room.note || ''
  };
}


function propertyRoomHasActiveContract_(
  ss,
  access,
  roomId
) {
  const contracts =
    propertyRoomGetWorkspaceRows_(
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_.contracts
      ),
      access,
      [
        'landlord_id'
      ]
    );

  return contracts.some(function (contract) {
    return (
      propertyRoomText_(
        contract.room_id
      ) ===
        roomId &&
      propertyRoomContractIsActive_(
        contract
      )
    );
  });
}


function propertyRoomHasActiveContractRaw_(
  ss,
  roomId
) {
  const sheet =
    ss.getSheetByName(
      V2_PROPERTY_ROOM_SHEETS_.contracts
    );

  if (!sheet) {
    return false;
  }

  return workspaceGetObjectsWithRow_(
    sheet
  ).some(function (contract) {
    return (
      propertyRoomText_(
        contract.room_id
      ) ===
        propertyRoomText_(
          roomId
        ) &&
      propertyRoomContractIsActive_(
        contract
      )
    );
  });
}


function propertyRoomContractIsActive_(
  contract
) {
  const status =
    propertyRoomText_(
      contract.contract_status ||
      contract.status
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
      'deleted'
    ].indexOf(
      status
    ) >= 0
  ) {
    return false;
  }

  const startDate =
    propertyRoomDate_(
      contract.start_date ||
      contract.contract_start_date ||
      contract.lease_start_date
    );

  const endDate =
    propertyRoomDate_(
      contract.end_date ||
      contract.contract_end_date ||
      contract.lease_end_date
    );

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  /*
   * 即使舊資料仍標記 active，只要租期已結束就不能再顯示出租中。
   * upcoming 租約也不代表房間今天已被占用。
   */
  if (
    startDate &&
    startDate.getTime() >
      today.getTime()
  ) {
    return false;
  }

  if (
    endDate &&
    endDate.getTime() <
      today.getTime()
  ) {
    return false;
  }

  if (
    [
      'upcoming',
      'pending_start',
      'draft',
      'pending',
      'requested'
    ].indexOf(
      status
    ) >= 0
  ) {
    return false;
  }

  if (
    [
      'active',
      'current',
      'effective',
      'approved',
      'signed'
    ].indexOf(
      status
    ) >= 0
  ) {
    return true;
  }

  return Boolean(
    startDate &&
    startDate.getTime() <=
      today.getTime() &&
    (
      !endDate ||
      endDate.getTime() >=
        today.getTime()
    )
  );
}


function propertyRoomContractTimeValue_(
  contract
) {
  const candidates = [
    contract.start_date,
    contract.contract_start_date,
    contract.lease_start_date,
    contract.signed_at,
    contract.updated_at,
    contract.created_at
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const date =
      propertyRoomDate_(
        candidates[index]
      );

    if (date) {
      return date.getTime();
    }
  }

  return 0;
}


// -------------------- Relations and permissions --------------------

function propertyRoomEnsurePrimaryOwner_(
  ss,
  access,
  propertyId
) {
  const sheet =
    ss.getSheetByName(
      V2_PROPERTY_ROOM_SHEETS_.propertyOwners
    );

  if (!sheet) {
    return;
  }

  const existing =
    propertyRoomGetWorkspaceRows_(
      sheet,
      access,
      []
    ).find(function (row) {
      return propertyRoomText_(
        row.property_id
      ) ===
        propertyId;
    });

  if (existing) {
    return;
  }

  const ownerContext =
    propertyRoomResolveWorkspaceOwner_(
      ss,
      access
    );

  const now =
    new Date();

  workspaceAppendObject_(
    sheet,
    {
      property_owner_id:
        workspaceNextId_(
          sheet,
          'property_owner_id',
          'PO',
          6
        ),
      workspace_id:
        propertyRoomText_(
          access.workspace.workspace_id
        ).toUpperCase(),
      property_id:
        propertyId,
      owner_user_id:
        ownerContext.user_id,
      owner_name:
        ownerContext.name,
      owner_phone:
        ownerContext.phone,
      ownership_percentage:
        100,
      is_primary_owner:
        true,
      payment_recipient:
        true,
      created_at:
        now,
      updated_at:
        now,
      note:
        'Default Workspace primary owner'
    }
  );
}


function propertyRoomResolveWorkspaceOwner_(
  ss,
  access
) {
  const members =
    workspaceGetObjectsWithRow_(
      ss.getSheetByName(
        V2_WORKSPACE_SHEETS_.members
      )
    );

  const users =
    workspaceGetObjectsWithRow_(
      ss.getSheetByName(
        V2_WORKSPACE_SHEETS_.users
      )
    );

  const workspaceId =
    propertyRoomText_(
      access.workspace.workspace_id
    ).toUpperCase();

  const ownerMembership =
    members.find(function (membership) {
      return (
        propertyRoomText_(
          membership.workspace_id
        ).toUpperCase() ===
          workspaceId &&
        propertyRoomText_(
          membership.role
        ).toLowerCase() ===
          'owner' &&
        workspaceIsActiveStatus_(
          membership.member_status ||
          'active'
        )
      );
    });

  const ownerUser =
    ownerMembership
      ? users.find(function (user) {
          return propertyRoomText_(
            user.user_id
          ) ===
            propertyRoomText_(
              ownerMembership.user_id
            );
        })
      : null;

  return {
    user_id:
      ownerUser
        ? ownerUser.user_id || ''
        : access.user.user_id || '',
    name:
      ownerUser
        ? ownerUser.name || ''
        : access.user.name || '',
    phone:
      ownerUser
        ? ownerUser.phone || ''
        : access.user.phone || ''
  };
}


function propertyRoomPaymentAccountBelongsToWorkspace_(
  ss,
  access,
  paymentAccountId
) {
  return propertyRoomGetWorkspaceRows_(
    ss.getSheetByName(
      V2_PROPERTY_ROOM_SHEETS_.paymentAccounts
    ),
    access,
    []
  ).some(function (row) {
    return (
      propertyRoomText_(
        row.payment_account_id
      ) ===
        paymentAccountId &&
      propertyRoomText_(
        row.account_status || 'active'
      ).toLowerCase() !==
        'archived'
    );
  });
}


function propertyRoomCanWrite_(
  access
) {
  return [
    'owner',
    'admin',
    'manager'
  ].indexOf(
    propertyRoomText_(
      access.membership.role
    ).toLowerCase()
  ) >= 0;
}


function propertyRoomRequireWrite_(
  access
) {
  if (
    propertyRoomCanWrite_(
      access
    )
  ) {
    return {
      success: true
    };
  }

  return workspaceResult_(
    false,
    'PERMISSION_DENIED',
    '目前角色沒有新增或修改物件與房間的權限'
  );
}


function propertyRoomActor_(
  access
) {
  return {
    user_id:
      access.user.user_id || '',
    membership_id:
      access.membership
        .membership_id || '',
    name:
      access.user.name ||
      access.membership
        .display_name ||
      '',
    role:
      access.membership.role || '',
    line_user_id:
      access.line_user_id ||
      access.user.line_user_id ||
      ''
  };
}


function propertyRoomAudit_(
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
    } else if (
      typeof workspaceWriteActivityLog_ ===
      'function'
    ) {
      workspaceWriteActivityLog_({
        workspace_id:
          access.workspace.workspace_id || '',
        user_id:
          access.user.user_id || '',
        membership_id:
          access.membership
            .membership_id || '',
        line_user_id:
          access.line_user_id || '',
        action:
          action,
        target_type:
          meta.target_type || '',
        target_id:
          meta.target_id || '',
        result:
          result &&
          result.success
            ? 'success'
            : 'failed',
        detail:
          meta.detail || ''
      });
    }
  } catch (error) {
    // Audit failure does not block the main operation.
  }
}


// -------------------- Schema and display helpers --------------------

function propertyRoomEnsureSchema_() {
  workspaceEnsureSchema_();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  propertyRoomEnsureSheet_(
    ss,
    V2_PROPERTY_ROOM_SHEETS_.properties,
    [
      'property_id',
      'workspace_id',
      'landlord_id',
      'landlord_line_user_id',
      'property_name',
      'city',
      'district',
      'property_address',
      'address',
      'property_type',
      'property_status',
      'account_status',
      'default_payment_account_id',
      'is_onboarding_property',
      'created_by_user_id',
      'created_by_membership_id',
      'updated_by_user_id',
      'updated_by_membership_id',
      'created_at',
      'updated_at',
      'archived_at',
      'archived_by_user_id',
      'archived_by_membership_id',
      'archive_reason',
      'note'
    ]
  );

  propertyRoomEnsureSheet_(
    ss,
    V2_PROPERTY_ROOM_SHEETS_.rooms,
    [
      'room_id',
      'workspace_id',
      'property_id',
      'landlord_id',
      'landlord_line_user_id',
      'property_name',
      'room_name',
      'room_status',
      'account_status',
      'rent_amount',
      'management_fee',
      'electricity_fee_rate',
      'equipment_fee_rate',
      'equipment_fee_rate_summer',
      'equipment_fee_rate_regular',
      'equipment_summer_months',
      'payment_day',
      'monthly_payment_day',
      'deposit_months',
      'deposit_amount',
      'is_onboarding_room',
      'created_by_user_id',
      'created_by_membership_id',
      'updated_by_user_id',
      'updated_by_membership_id',
      'created_at',
      'updated_at',
      'archived_at',
      'archived_by_user_id',
      'archived_by_membership_id',
      'archive_reason',
      'note'
    ]
  );

  propertyRoomEnsureSheet_(
    ss,
    V2_PROPERTY_ROOM_SHEETS_.propertyOwners,
    [
      'property_owner_id',
      'workspace_id',
      'property_id',
      'owner_user_id',
      'owner_name',
      'owner_phone',
      'ownership_percentage',
      'is_primary_owner',
      'payment_recipient',
      'created_at',
      'updated_at',
      'note'
    ]
  );

  propertyRoomEnsureSheet_(
    ss,
    V2_PROPERTY_ROOM_SHEETS_.paymentAccounts,
    [
      'payment_account_id',
      'workspace_id',
      'account_name',
      'bank_code',
      'bank_name',
      'branch_name',
      'bank_account',
      'bank_account_name',
      'payment_note',
      'is_default',
      'account_status',
      'created_by_user_id',
      'created_at',
      'updated_at',
      'note'
    ]
  );

  return true;
}


function propertyRoomEnsureSheet_(
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

  const currentHeaders =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(
        propertyRoomText_
      );

  const missingHeaders =
    headers.filter(
      function (header) {
        return (
          currentHeaders.indexOf(
            header
          ) === -1
        );
      }
    );

  if (
    missingHeaders.length >
    0
  ) {
    sheet
      .getRange(
        1,
        sheet.getLastColumn() + 1,
        1,
        missingHeaders.length
      )
      .setValues([
        missingHeaders
      ]);
  }

  return sheet;
}


/**
 * 公開讀取 API 不修改欄位，只檢查必要資料表。
 */
function propertyRoomRequireReadSchema_() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const requiredSheets = [
    V2_PROPERTY_ROOM_SHEETS_
      .properties,
    V2_PROPERTY_ROOM_SHEETS_
      .rooms,
    V2_PROPERTY_ROOM_SHEETS_
      .contracts
  ];

  const missing =
    requiredSheets.filter(
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
      '。請先執行 testEnsurePropertyRoomSchema()。'
    );
  }

  return true;
}


function propertyRoomSetValues_(
  sheet,
  rowNumber,
  values
) {
  Object.keys(
    values || {}
  ).forEach(function (header) {
    workspaceSetFirstExistingOrCreate_(
      sheet,
      rowNumber,
      [
        header
      ],
      header,
      values[header]
    );
  });
}


function propertyRoomPropertyTypeOptions_() {
  return V2_PROPERTY_TYPES_.map(
    function (type) {
      return {
        value:
          type,
        label:
          propertyRoomPropertyTypeLabel_(
            type
          )
      };
    }
  );
}


function propertyRoomPropertyTypeLabel_(
  type
) {
  const labels = {
    apartment:
      '公寓／華廈',
    suite:
      '套房',
    building:
      '整棟',
    house:
      '透天／住宅',
    shop:
      '店面',
    office:
      '辦公室',
    other:
      '其他'
  };

  return labels[
    propertyRoomText_(
      type
    ).toLowerCase()
  ] ||
    propertyRoomText_(
      type
    ) ||
    '-';
}


function propertyRoomRoomStatusOptions_() {
  return V2_ROOM_MANUAL_STATUSES_.map(
    function (status) {
      return {
        value:
          status,
        label:
          propertyRoomRoomStatusLabel_(
            status
          )
      };
    }
  );
}


function propertyRoomRoomStatusLabel_(
  status
) {
  const labels = {
    vacant:
      '空房',
    occupied:
      '已出租',
    maintenance:
      '維修中',
    unavailable:
      '暫停使用',
    archived:
      '已封存'
  };

  return labels[
    propertyRoomText_(
      status
    ).toLowerCase()
  ] ||
    propertyRoomText_(
      status
    ) ||
    '-';
}


function propertyRoomMaskAccount_(
  value
) {
  const digits =
    propertyRoomText_(
      value
    ).replace(
      /\D/g,
      ''
    );

  if (!digits) {
    return '';
  }

  return '•••• ' +
    digits.slice(-5);
}


function propertyRoomGetRowsByRoomIds_(
  sheet,
  roomIdMap
) {
  if (
    !sheet ||
    !roomIdMap
  ) {
    return [];
  }

  return workspaceGetObjectsWithRow_(
    sheet
  ).filter(
    function (row) {
      return Boolean(
        roomIdMap[
          propertyRoomText_(
            row.room_id
          )
        ]
      );
    }
  );
}


function propertyRoomBuildLatestBillRoomMap_(
  billRows
) {
  const result = {};

  (
    billRows || []
  ).forEach(
    function (bill) {
      const roomId =
        propertyRoomText_(
          bill.room_id
        );

      if (!roomId) {
        return;
      }

      const existing =
        result[
          roomId
        ];

      if (
        !existing ||
        propertyRoomBillTimeValue_(
          bill
        ) >=
        propertyRoomBillTimeValue_(
          existing
        )
      ) {
        result[
          roomId
        ] =
          bill;
      }
    }
  );

  return result;
}


function propertyRoomBillTimeValue_(
  bill
) {
  const candidates = [
    bill.due_date,
    bill.bill_month,
    bill.updated_at,
    bill.created_at
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const date =
      propertyRoomDate_(
        candidates[index]
      );

    if (date) {
      return date.getTime();
    }
  }

  return 0;
}


function propertyRoomDayOfMonth_(
  value
) {
  const date =
    propertyRoomDate_(
      value
    );

  if (!date) {
    return 0;
  }

  const day =
    date.getDate();

  return (
    day >= 1 &&
    day <= 28
  )
    ? day
    : 0;
}


function propertyRoomResolvePaymentDay_(
  room,
  contract,
  latestBill
) {
  const candidates = [
    room.payment_day,
    room.monthly_payment_day,
    room.rent_due_day,
    room.due_day,

    contract.monthly_payment_day,
    contract.payment_day,
    contract.rent_due_day,
    contract.due_day,
    contract.billing_day,
    contract.bill_day
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const day =
      propertyRoomPositiveInteger_(
        candidates[index]
      );

    if (
      day >= 1 &&
      day <= 28
    ) {
      return day;
    }
  }

  return latestBill
    ? propertyRoomDayOfMonth_(
        latestBill.due_date
      )
    : 0;
}


function propertyRoomPaymentDaySource_(
  room,
  contract,
  latestBill
) {
  if (
    propertyRoomPositiveInteger_(
      room.payment_day ||
      room.monthly_payment_day ||
      room.rent_due_day ||
      room.due_day
    ) > 0
  ) {
    return 'room';
  }

  if (
    propertyRoomPositiveInteger_(
      contract.monthly_payment_day ||
      contract.payment_day ||
      contract.rent_due_day ||
      contract.due_day ||
      contract.billing_day ||
      contract.bill_day
    ) > 0
  ) {
    return 'contract';
  }

  if (
    latestBill &&
    propertyRoomDayOfMonth_(
      latestBill.due_date
    ) > 0
  ) {
    return 'bill';
  }

  return 'empty';
}


function propertyRoomResolveDepositAmount_(
  room,
  contract,
  rentAmount,
  depositMonths
) {
  const roomAmount =
    propertyRoomNumber_(
      room.deposit_amount ||
      room.deposit ||
      room.security_deposit
    );

  if (roomAmount > 0) {
    return Math.round(
      roomAmount
    );
  }

  const contractAmount =
    propertyRoomNumber_(
      contract.deposit_amount ||
      contract.deposit ||
      contract.security_deposit
    );

  if (contractAmount > 0) {
    return Math.round(
      contractAmount
    );
  }

  const rent =
    propertyRoomNumber_(
      rentAmount
    );

  const months =
    propertyRoomNumber_(
      depositMonths
    );

  if (
    rent > 0 &&
    months > 0
  ) {
    return Math.round(
      rent *
      months
    );
  }

  return 0;
}


function propertyRoomDepositAmountSource_(
  room,
  contract,
  rentAmount,
  depositMonths
) {
  if (
    propertyRoomNumber_(
      room.deposit_amount ||
      room.deposit ||
      room.security_deposit
    ) > 0
  ) {
    return 'room_amount';
  }

  if (
    propertyRoomNumber_(
      contract.deposit_amount ||
      contract.deposit ||
      contract.security_deposit
    ) > 0
  ) {
    return 'contract_amount';
  }

  if (
    propertyRoomNumber_(
      rentAmount
    ) > 0 &&
    propertyRoomNumber_(
      depositMonths
    ) > 0
  ) {
    return 'derived_from_months';
  }

  return 'empty';
}


function propertyRoomResolveDepositMonths_(
  room,
  contract,
  rentAmount
) {
  const roomMonths =
    propertyRoomNumber_(
      room.deposit_months ||
      room.deposit_month ||
      room.security_deposit_months
    );

  if (roomMonths > 0) {
    return roomMonths;
  }

  const contractMonths =
    propertyRoomNumber_(
      contract.deposit_months ||
      contract.deposit_month ||
      contract.security_deposit_months
    );

  if (contractMonths > 0) {
    return contractMonths;
  }

  const depositAmount =
    propertyRoomNumber_(
      contract.deposit_amount ||
      contract.deposit ||
      contract.security_deposit ||
      room.deposit_amount ||
      room.deposit ||
      room.security_deposit
    );

  const rent =
    propertyRoomNumber_(
      rentAmount
    );

  if (
    depositAmount > 0 &&
    rent > 0
  ) {
    const derived =
      Math.round(
        (
          depositAmount /
          rent
        ) *
        2
      ) /
      2;

    if (
      derived > 0 &&
      derived <= 12
    ) {
      return derived;
    }
  }

  return 0;
}


function propertyRoomDepositMonthsSource_(
  room,
  contract,
  rentAmount
) {
  if (
    propertyRoomNumber_(
      room.deposit_months ||
      room.deposit_month ||
      room.security_deposit_months
    ) > 0
  ) {
    return 'room';
  }

  if (
    propertyRoomNumber_(
      contract.deposit_months ||
      contract.deposit_month ||
      contract.security_deposit_months
    ) > 0
  ) {
    return 'contract_months';
  }

  const depositAmount =
    propertyRoomNumber_(
      contract.deposit_amount ||
      contract.deposit ||
      contract.security_deposit ||
      room.deposit_amount ||
      room.deposit ||
      room.security_deposit
    );

  if (
    depositAmount > 0 &&
    propertyRoomNumber_(
      rentAmount
    ) > 0
  ) {
    return 'derived_from_amount';
  }

  return 'empty';
}


function propertyRoomRate_(
  value
) {
  const number =
    propertyRoomNumber_(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return Math.round(
    number * 1000
  ) / 1000;
}


function propertyRoomResolvePositiveRate_(
  candidates,
  fallbackValue
) {
  const values =
    candidates || [];

  for (
    let index = 0;
    index < values.length;
    index += 1
  ) {
    const rate =
      propertyRoomRate_(
        values[index]
      );

    if (rate > 0) {
      return rate;
    }
  }

  return propertyRoomRate_(
    fallbackValue
  );
}


function propertyRoomIsSummerMonth_(
  value,
  summerMonthsValue
) {
  if (
    typeof settingsIntegrationIsSummerMonth_ ===
    'function'
  ) {
    const months =
      typeof settingsIntegrationParseMonths_ ===
        'function'
        ? settingsIntegrationParseMonths_(
            summerMonthsValue
          )
        : [];

    return settingsIntegrationIsSummerMonth_(
      value,
      months.length >
        0
        ? months
        : [
            6,
            7,
            8,
            9
          ]
    );
  }

  const date =
    value instanceof Date
      ? value
      : propertyRoomDate_(
          value
        );

  const month =
    date
      ? date.getMonth() + 1
      : new Date().getMonth() + 1;

  return (
    month >= 6 &&
    month <= 9
  );
}


function propertyRoomBillMonthNumber_(
  bill
) {
  if (!bill) {
    return 0;
  }

  const date =
    propertyRoomDate_(
      bill.bill_month ||
      bill.due_date
    );

  return date
    ? date.getMonth() + 1
    : 0;
}


function propertyRoomResolveEquipmentSeasonRate_(
  room,
  contract,
  latestBill,
  summer
) {
  const seasonalCandidates =
    summer
      ? [
          room.equipment_fee_rate_summer,
          room.summer_equipment_fee_rate,
          contract.equipment_fee_rate_summer,
          contract.summer_equipment_fee_rate
        ]
      : [
          room.equipment_fee_rate_regular,
          room.regular_equipment_fee_rate,
          room.non_summer_equipment_fee_rate,
          contract.equipment_fee_rate_regular,
          contract.regular_equipment_fee_rate,
          contract.non_summer_equipment_fee_rate
        ];

  const seasonalRate =
    propertyRoomResolvePositiveRate_(
      seasonalCandidates,
      0
    );

  if (seasonalRate > 0) {
    return seasonalRate;
  }

  const billMonth =
    propertyRoomBillMonthNumber_(
      latestBill
    );

  const billMatchesSeason =
    billMonth > 0 &&
    (
      summer
        ? (
            billMonth >= 6 &&
            billMonth <= 9
          )
        : (
            billMonth < 6 ||
            billMonth > 9
          )
    );

  if (billMatchesSeason) {
    const billRate =
      propertyRoomResolvePositiveRate_(
        [
          latestBill.equipment_fee_rate,
          latestBill.equipment_rate
        ],
        0
      );

    if (billRate > 0) {
      return billRate;
    }
  }

  const legacyRate =
    propertyRoomResolvePositiveRate_(
      [
        room.equipment_fee_rate,
        room.equipment_rate,
        contract.equipment_fee_rate,
        contract.equipment_rate
      ],
      0
    );

  if (legacyRate > 0) {
    return legacyRate;
  }

  return summer
    ? 3.5
    : 2.5;
}


function propertyRoomEquipmentRateForMonth_(
  summerRate,
  regularRate,
  value,
  summerMonthsValue
) {
  return propertyRoomIsSummerMonth_(
    value,
    summerMonthsValue
  )
    ? propertyRoomRate_(
        summerRate
      )
    : propertyRoomRate_(
        regularRate
      );
}


function propertyRoomFallbackMoney_(
  primaryValue,
  fallbackValue
) {
  if (
    propertyRoomText_(
      primaryValue
    ) !== ''
  ) {
    return propertyRoomMoney_(
      primaryValue
    );
  }

  return propertyRoomMoney_(
    fallbackValue
  );
}


function propertyRoomFallbackNumber_(
  primaryValue,
  fallbackValue
) {
  if (
    propertyRoomText_(
      primaryValue
    ) !== ''
  ) {
    return propertyRoomNumber_(
      primaryValue
    );
  }

  return propertyRoomNumber_(
    fallbackValue
  );
}


function propertyRoomPositiveInteger_(
  value
) {
  const number =
    Math.round(
      propertyRoomNumber_(
        value
      )
    );

  return number > 0
    ? number
    : 0;
}


function propertyRoomCompareText_(
  valueA,
  valueB
) {
  return propertyRoomText_(
    valueA
  ).localeCompare(
    propertyRoomText_(
      valueB
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


function propertyRoomText_(
  value
) {
  return value ===
      undefined ||
    value ===
      null
    ? ''
    : String(value).trim();
}


function propertyRoomNumber_(
  value
) {
  const number =
    Number(
      String(
        value ===
          undefined ||
        value ===
          null
          ? ''
          : value
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


function propertyRoomMoney_(
  value
) {
  return Math.round(
    propertyRoomNumber_(
      value
    )
  );
}


function propertyRoomBoolean_(
  value
) {
  if (
    value === true ||
    value === false
  ) {
    return value;
  }

  return [
    '1',
    'true',
    'yes',
    'y',
    'on'
  ].indexOf(
    propertyRoomText_(
      value
    ).toLowerCase()
  ) >= 0;
}


function propertyRoomDate_(
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
    return value;
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


// -------------------- Repair and tests --------------------

function repairWorkspacePropertyRoomLinksByLineUid_(
  lineUserId
) {
  propertyRoomEnsureSchema_();

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

  const roomSheet =
    ss.getSheetByName(
      V2_PROPERTY_ROOM_SHEETS_
        .rooms
    );

  const workspaceId =
    propertyRoomText_(
      access.workspace.workspace_id
    ).toUpperCase();

  const properties =
    propertyRoomGetWorkspaceProperties_(
      ss,
      access,
      true
    );

  const propertyIds =
    properties
      .map(
        function (property) {
          return propertyRoomText_(
            property.property_id
          );
        }
      )
      .filter(Boolean);

  const propertyMap = {};

  properties.forEach(
    function (property) {
      propertyMap[
        propertyRoomText_(
          property.property_id
        )
      ] =
        property;
    }
  );

  const landlordIds =
    (
      access.principals || []
    )
      .map(
        function (principal) {
          return propertyRoomText_(
            principal.landlord_id
          );
        }
      )
      .filter(Boolean);

  const firstRoomId =
    propertyRoomText_(
      access.workspace.first_room_id
    );

  const firstPropertyId =
    propertyRoomText_(
      access.workspace.first_property_id
    );

  const repaired = [];

  workspaceGetObjectsWithRow_(
    roomSheet
  ).forEach(
    function (room) {
      const roomId =
        propertyRoomText_(
          room.room_id
        );

      let propertyId =
        propertyRoomText_(
          room.property_id
        );

      const landlordId =
        propertyRoomText_(
          room.landlord_id
        );

      const directPropertyMatch =
        propertyId &&
        propertyIds.indexOf(
          propertyId
        ) >= 0;

      const firstRoomMatch =
        firstRoomId &&
        roomId ===
          firstRoomId;

      const singlePropertyLegacyMatch =
        !propertyId &&
        properties.length ===
          1 &&
        landlordId &&
        landlordIds.indexOf(
          landlordId
        ) >= 0;

      if (
        !directPropertyMatch &&
        !firstRoomMatch &&
        !singlePropertyLegacyMatch
      ) {
        return;
      }

      if (!propertyId) {
        propertyId =
          firstPropertyId ||
          (
            properties[0]
              ? properties[0]
                  .property_id
              : ''
          );
      }

      const property =
        propertyMap[
          propertyId
        ] ||
        properties[0] ||
        {};

      propertyRoomSetValues_(
        roomSheet,
        room.__row_number,
        {
          workspace_id:
            workspaceId,
          property_id:
            propertyId,
          landlord_id:
            landlordId ||
            access.principal_landlord_id ||
            '',
          landlord_line_user_id:
            room.landlord_line_user_id ||
            access.principal_line_user_id ||
            '',
          property_name:
            room.property_name ||
            property.property_name ||
            '',
          room_status:
            room.room_status ||
            'vacant',
          account_status:
            room.account_status ||
            'active',
          updated_at:
            new Date()
        }
      );

      repaired.push({
        room_id:
          roomId,
        property_id:
          propertyId,
        workspace_id:
          workspaceId
      });
    }
  );

  SpreadsheetApp.flush();

  const afterRooms =
    propertyRoomGetWorkspaceRooms_(
      ss,
      access,
      true
    );

  return workspaceResult_(
    true,
    'PROPERTY_ROOM_LINKS_REPAIRED',
    '物件與房間關聯已檢查完成',
    {
      workspace_id:
        workspaceId,
      property_count:
        properties.length,
      repaired_count:
        repaired.length,
      room_count_after:
        afterRooms.length,
      repaired:
        repaired
    }
  );
}


function testRepairWorkspacePropertyRoomLinks() {
  const result =
    repairWorkspacePropertyRoomLinksByLineUid_(
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


function repairWorkspaceRoomFinancialDataByLineUid_(
  lineUserId
) {
  propertyRoomEnsureSchema_();

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

  const roomSheet =
    ss.getSheetByName(
      V2_PROPERTY_ROOM_SHEETS_
        .rooms
    );

  const rooms =
    propertyRoomGetWorkspaceRooms_(
      ss,
      access,
      true
    );

  const contracts =
    propertyRoomGetWorkspaceRows_(
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_
          .contracts
      ),
      access,
      [
        'landlord_id'
      ]
    );

  const roomIdMap = {};

  rooms.forEach(
    function (room) {
      const roomId =
        propertyRoomText_(
          room.room_id
        );

      if (roomId) {
        roomIdMap[
          roomId
        ] = true;
      }
    }
  );

  const billRows =
    propertyRoomGetRowsByRoomIds_(
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_
          .bills
      ),
      roomIdMap
    );

  const latestBillMap =
    propertyRoomBuildLatestBillRoomMap_(
      billRows
    );

  const currentMap = {};
  const latestMap = {};

  contracts.forEach(
    function (contract) {
      const roomId =
        propertyRoomText_(
          contract.room_id
        );

      if (!roomId) {
        return;
      }

      if (
        !latestMap[roomId] ||
        propertyRoomContractTimeValue_(
          contract
        ) >=
        propertyRoomContractTimeValue_(
          latestMap[roomId]
        )
      ) {
        latestMap[roomId] =
          contract;
      }

      if (
        propertyRoomContractIsActive_(
          contract
        ) &&
        (
          !currentMap[roomId] ||
          propertyRoomContractTimeValue_(
            contract
          ) >=
          propertyRoomContractTimeValue_(
            currentMap[roomId]
          )
        )
      ) {
        currentMap[roomId] =
          contract;
      }
    }
  );

  const repaired = [];

  rooms.forEach(
    function (room) {
      const roomId =
        propertyRoomText_(
          room.room_id
        );

      const contract =
        currentMap[roomId] ||
        latestMap[roomId] ||
        {};

      const latestBill =
        latestBillMap[
          roomId
        ] ||
        null;

      const values = {};

      const roomRent =
        propertyRoomNumber_(
          room.rent_amount
        );

      const contractRent =
        propertyRoomNumber_(
          contract.rent_amount ||
          contract.monthly_rent
        );

      if (
        roomRent <= 0 &&
        contractRent > 0
      ) {
        values.rent_amount =
          Math.round(
            contractRent
          );
      }

      if (
        propertyRoomText_(
          room.management_fee
        ) === ''
      ) {
        values.management_fee =
          propertyRoomMoney_(
            contract.management_fee ||
            contract.monthly_management_fee
          );
      }

      const resolvedElectricityRate =
        propertyRoomResolvePositiveRate_(
          [
            room.electricity_fee_rate,
            room.electricity_rate,
            contract.electricity_fee_rate,
            contract.electricity_rate,
            latestBill
              ? latestBill.electricity_fee_rate
              : '',
            latestBill
              ? latestBill.electricity_rate
              : ''
          ],
          0
        );

      if (
        propertyRoomRate_(
          room.electricity_fee_rate
        ) <= 0 &&
        resolvedElectricityRate > 0
      ) {
        values.electricity_fee_rate =
          resolvedElectricityRate;
      }

      const summerEquipmentRate =
        propertyRoomResolveEquipmentSeasonRate_(
          room,
          contract,
          latestBill,
          true
        );

      const regularEquipmentRate =
        propertyRoomResolveEquipmentSeasonRate_(
          room,
          contract,
          latestBill,
          false
        );

      if (
        propertyRoomRate_(
          room.equipment_fee_rate_summer
        ) <= 0
      ) {
        values.equipment_fee_rate_summer =
          summerEquipmentRate;
      }

      if (
        propertyRoomRate_(
          room.equipment_fee_rate_regular
        ) <= 0
      ) {
        values.equipment_fee_rate_regular =
          regularEquipmentRate;
      }

      values.equipment_summer_months =
        '6,7,8,9';

      values.equipment_fee_rate =
        propertyRoomEquipmentRateForMonth_(
          summerEquipmentRate,
          regularEquipmentRate,
          new Date()
        );

      const resolvedPaymentDay =
        propertyRoomResolvePaymentDay_(
          room,
          contract,
          latestBillMap[
            roomId
          ] ||
          null
        );

      if (
        propertyRoomPositiveInteger_(
          room.payment_day ||
          room.monthly_payment_day
        ) === 0 &&
        resolvedPaymentDay > 0
      ) {
        values.payment_day =
          resolvedPaymentDay;
        values.monthly_payment_day =
          resolvedPaymentDay;
      }

      const resolvedDepositMonths =
        propertyRoomResolveDepositMonths_(
          room,
          contract,
          roomRent > 0
            ? roomRent
            : contractRent
        );

      if (
        propertyRoomNumber_(
          room.deposit_months
        ) <= 0 &&
        resolvedDepositMonths > 0
      ) {
        values.deposit_months =
          resolvedDepositMonths;
      }

      const resolvedDepositAmount =
        propertyRoomResolveDepositAmount_(
          room,
          contract,
          roomRent > 0
            ? roomRent
            : contractRent,
          resolvedDepositMonths
        );

      if (
        propertyRoomNumber_(
          room.deposit_amount
        ) <= 0 &&
        resolvedDepositAmount > 0
      ) {
        values.deposit_amount =
          resolvedDepositAmount;
      }

      if (
        currentMap[roomId]
      ) {
        values.room_status =
          'occupied';
        values.current_contract_id =
          propertyRoomText_(
            contract.contract_id
          );
        values.current_tenant_id =
          propertyRoomText_(
            contract.tenant_id
          );
        values.current_tenant_name =
          propertyRoomText_(
            contract.tenant_name
          );
      } else if (
        propertyRoomText_(
          room.room_status
        ).toLowerCase() ===
          'occupied'
      ) {
        values.room_status =
          'vacant';
        values.current_contract_id =
          '';
        values.current_tenant_id =
          '';
        values.current_tenant_name =
          '';
      }

      if (
        Object.keys(
          values
        ).length === 0
      ) {
        return;
      }

      values.updated_at =
        new Date();

      propertyRoomSetValues_(
        roomSheet,
        room.__row_number,
        values
      );

      repaired.push({
        room_id:
          roomId,
        contract_id:
          propertyRoomText_(
            contract.contract_id
          ),
        fields:
          Object.keys(
            values
          )
      });
    }
  );

  SpreadsheetApp.flush();

  return workspaceResult_(
    true,
    'ROOM_FINANCIAL_DATA_REPAIRED',
    '房間租金與租約狀態已回填',
    {
      room_count:
        rooms.length,
      contract_count:
        contracts.length,
      bill_count:
        billRows.length,
      repaired_count:
        repaired.length,
      repaired:
        repaired
    }
  );
}


function diagnoseWorkspaceRoomPaymentDepositByLineUid_(
  lineUserId
) {
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

  const rooms =
    propertyRoomGetWorkspaceRooms_(
      ss,
      access,
      true
    );

  const contracts =
    propertyRoomGetWorkspaceRows_(
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_
          .contracts
      ),
      access,
      [
        'landlord_id'
      ]
    );

  const roomIdMap = {};

  rooms.forEach(
    function (room) {
      roomIdMap[
        propertyRoomText_(
          room.room_id
        )
      ] = true;
    }
  );

  const bills =
    propertyRoomGetRowsByRoomIds_(
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_
          .bills
      ),
      roomIdMap
    );

  const latestBillMap =
    propertyRoomBuildLatestBillRoomMap_(
      bills
    );

  const latestContractMap = {};

  contracts.forEach(
    function (contract) {
      const roomId =
        propertyRoomText_(
          contract.room_id
        );

      if (
        roomId &&
        (
          !latestContractMap[roomId] ||
          propertyRoomContractTimeValue_(
            contract
          ) >=
          propertyRoomContractTimeValue_(
            latestContractMap[roomId]
          )
        )
      ) {
        latestContractMap[roomId] =
          contract;
      }
    }
  );

  const rows =
    rooms.map(
      function (room) {
        const roomId =
          propertyRoomText_(
            room.room_id
          );

        const contract =
          latestContractMap[
            roomId
          ] ||
          {};

        const rent =
          propertyRoomNumber_(
            room.rent_amount ||
            contract.rent_amount ||
            contract.monthly_rent
          );

        const bill =
          latestBillMap[
            roomId
          ] ||
          null;

        return {
          room_id:
            roomId,
          room_name:
            propertyRoomText_(
              room.room_name
            ),

          room_payment_day:
            room.payment_day ||
            room.monthly_payment_day ||
            '',

          contract_payment_day:
            contract.monthly_payment_day ||
            contract.payment_day ||
            contract.rent_due_day ||
            contract.due_day ||
            '',

          latest_bill_due_date:
            bill
              ? bill.due_date || ''
              : '',

          resolved_payment_day:
            propertyRoomResolvePaymentDay_(
              room,
              contract,
              bill
            ),

          room_deposit_months:
            room.deposit_months ||
            '',

          contract_deposit_months:
            contract.deposit_months ||
            contract.deposit_month ||
            '',

          deposit_amount:
            contract.deposit_amount ||
            contract.deposit ||
            '',

          rent_amount:
            rent,

          resolved_deposit_months:
            propertyRoomResolveDepositMonths_(
              room,
              contract,
              rent
            ),

          resolved_deposit_amount:
            propertyRoomResolveDepositAmount_(
              room,
              contract,
              rent,
              propertyRoomResolveDepositMonths_(
                room,
                contract,
                rent
              )
            )
        };
      }
    );

  const result = {
    success:
      true,
    room_count:
      rows.length,
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


function testDiagnoseWorkspaceRoomPaymentDeposit() {
  return diagnoseWorkspaceRoomPaymentDepositByLineUid_(
    getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID')
  );
}


function testRepairWorkspaceRoomFinancialData() {
  const result =
    repairWorkspaceRoomFinancialDataByLineUid_(
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


function testLandlordPropertiesInitTimed() {
  const startedAt =
    new Date().getTime();

  const result =
    getLandlordPropertiesInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      true
    );

  const output = {
    elapsed_ms:
      new Date().getTime() -
      startedAt,
    result:
      result
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


function testEnsurePropertyRoomSchema() {
  propertyRoomEnsureSchema_();

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const result = {
    success:
      true,
    properties:
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_.properties
      ).getLastColumn(),
    rooms:
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_.rooms
      ).getLastColumn(),
    property_owners:
      ss.getSheetByName(
        V2_PROPERTY_ROOM_SHEETS_.propertyOwners
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


function testLandlordPropertiesInit() {
  const result =
    getLandlordPropertiesInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      true
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
