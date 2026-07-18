/**
 * CMWebs V2 房客建檔與初始租約
 *
 * API:
 * - landlord_tenant_create_init
 * - landlord_tenant_create
 *
 * 流程：
 * 1. 房東選擇目前 Workspace 的物件與房間。
 * 2. 輸入房客姓名、手機、租期與租金條件。
 * 3. 建立 V2_users / V2_tenants / V2_contracts。
 * 4. 同步建立房東房客清單與房客首頁 view row。
 * 5. 房客使用本人 LINE 開啟 LIFF，以租約登記手機完成綁定。
 *
 * 權限：
 * - owner / admin / manager 可建立。
 * - 其他角色只能查看既有房客，不可建立租約。
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 * - V2_WORKSPACE_LANDLORD_ACCESS.gs
 * - V2_PROPERTY_ROOM_MANAGEMENT.gs
 * - V2_WORKSPACE_OPERATION_AUDIT.gs（選用）
 */

const V2_TENANT_LEASE_SHEETS_ = {
  users:
    'V2_users',
  tenants:
    'V2_tenants',
  contracts:
    'V2_contracts',
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
    'V2_bills'
};

const V2_TENANT_LIFF_URL_ =
  'https://liff.line.me/2010314940-iJB1D6sN';

const V2_TENANT_LEASE_MAX_TERM_DAYS_ =
  3650;


/**
 * 建立房客頁初始化。
 */
function getLandlordTenantCreateInitByLineUid_(
  lineUserId,
  selectedPropertyId,
  selectedRoomId
) {
  try {
    const startedAt =
      new Date().getTime();

    tenantLeaseRequireReadSchema_();

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

    selectedPropertyId =
      tenantLeaseText_(
        selectedPropertyId
      );

    selectedRoomId =
      tenantLeaseText_(
        selectedRoomId
      );

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const properties =
      tenantLeaseGetWorkspaceRows_(
        ss.getSheetByName(
          V2_TENANT_LEASE_SHEETS_
            .properties
        ),
        access,
        [
          'landlord_id'
        ]
      )
        .filter(
          function (row) {
            return (
              tenantLeaseText_(
                row.account_status ||
                row.property_status ||
                'active'
              ).toLowerCase() !==
              'archived'
            );
          }
        );

    const rooms =
      tenantLeaseGetWorkspaceRooms_(
        ss,
        access,
        properties
      ).filter(
        function (row) {
          return (
            tenantLeaseText_(
              row.account_status ||
                'active'
            ).toLowerCase() !==
              'archived'
          );
        }
      );

    const contracts =
      tenantLeaseGetWorkspaceRows_(
        ss.getSheetByName(
          V2_TENANT_LEASE_SHEETS_
            .contracts
        ),
        access,
        [
          'landlord_id'
        ]
      );

    const roomContracts = {};

    contracts.forEach(
      function (contract) {
        const roomId =
          tenantLeaseText_(
            contract.room_id
          );

        if (!roomId) {
          return;
        }

        if (!roomContracts[roomId]) {
          roomContracts[roomId] =
            [];
        }

        roomContracts[roomId].push(
          contract
        );
      }
    );

    const propertyMap = {};

    properties.forEach(
      function (property) {
        propertyMap[
          tenantLeaseText_(
            property.property_id
          )
        ] =
          property;
      }
    );

    const roomViews =
      rooms
        .map(
          function (room) {
            const propertyId =
              tenantLeaseText_(
                room.property_id
              );

            const property =
              propertyMap[
                propertyId
              ] ||
              {};

            const currentContract =
              tenantLeaseResolveCurrentOrUpcomingContract_(
                roomContracts[
                  tenantLeaseText_(
                    room.room_id
                  )
                ] || []
              );

            return {
              room_id:
                room.room_id || '',
              property_id:
                propertyId,
              property_name:
                tenantLeaseText_(
                  property.property_name ||
                  room.property_name
                ),
              room_name:
                tenantLeaseText_(
                  room.room_name
                ),
              room_status:
                tenantLeaseText_(
                  room.room_status ||
                  'vacant'
                ).toLowerCase(),
              account_status:
                tenantLeaseText_(
                  room.account_status ||
                  'active'
                ).toLowerCase(),

              rent_amount:
                tenantLeaseMoney_(
                  room.rent_amount
                ),
              management_fee:
                tenantLeaseMoney_(
                  room.management_fee
                ),
              electricity_fee_rate:
                tenantLeaseMoney_(
                  room.electricity_fee_rate
                ),
              equipment_fee_rate:
                tenantLeaseMoney_(
                  room.equipment_fee_rate
                ),
              payment_day:
                tenantLeaseInteger_(
                  room.payment_day ||
                  room.monthly_payment_day ||
                  10
                ),
              deposit_months:
                tenantLeaseNumber_(
                  room.deposit_months ||
                  2
                ),

              has_current_or_upcoming_contract:
                Boolean(
                  currentContract
                ),
              existing_contract:
                currentContract
                  ? {
                      contract_id:
                        currentContract
                          .contract_id ||
                        '',
                      tenant_id:
                        currentContract
                          .tenant_id ||
                        '',
                      tenant_name:
                        currentContract
                          .tenant_name ||
                        '',
                      start_date:
                        currentContract
                          .start_date ||
                        currentContract
                          .contract_start_date ||
                        '',
                      end_date:
                        currentContract
                          .end_date ||
                        currentContract
                          .contract_end_date ||
                        '',
                      contract_status:
                        currentContract
                          .contract_status ||
                        currentContract
                          .status ||
                        ''
                    }
                  : null
            };
          }
        )
        .sort(
          function (a, b) {
            const propertyCompare =
              tenantLeaseCompareText_(
                a.property_name,
                b.property_name
              );

            if (propertyCompare !== 0) {
              return propertyCompare;
            }

            return tenantLeaseCompareText_(
              a.room_name,
              b.room_name
            );
          }
        );

    const propertyViews =
      properties
        .map(
          function (property) {
            const propertyId =
              tenantLeaseText_(
                property.property_id
              );

            return {
              property_id:
                propertyId,
              property_name:
                tenantLeaseText_(
                  property.property_name
                ),
              city:
                property.city ||
                '',
              district:
                property.district ||
                '',
              property_address:
                property.property_address ||
                property.address ||
                '',
              property_type:
                property.property_type ||
                '',
              rooms:
                roomViews.filter(
                  function (room) {
                    return (
                      room.property_id ===
                      propertyId
                    );
                  }
                )
            };
          }
        )
        .sort(
          function (a, b) {
            return tenantLeaseCompareText_(
              a.property_name,
              b.property_name
            );
          }
        );

    if (
      selectedRoomId &&
      !roomViews.some(
        function (room) {
          return (
            room.room_id ===
            selectedRoomId
          );
        }
      )
    ) {
      selectedRoomId =
        '';
    }

    if (
      selectedPropertyId &&
      !propertyViews.some(
        function (property) {
          return (
            property.property_id ===
            selectedPropertyId
          );
        }
      )
    ) {
      selectedPropertyId =
        '';
    }

    if (
      selectedRoomId &&
      !selectedPropertyId
    ) {
      const selectedRoom =
        roomViews.find(
          function (room) {
            return (
              room.room_id ===
              selectedRoomId
            );
          }
        );

      selectedPropertyId =
        selectedRoom
          ? selectedRoom.property_id
          : '';
    }

    const canCreate =
      tenantLeaseCanCreate_(
        access
      );

    return workspaceResult_(
      true,
      'OK',
      '建立房客資料載入成功',
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
        can_create:
          canCreate,
        selected_property_id:
          selectedPropertyId,
        selected_room_id:
          selectedRoomId,
        tenant_liff_url:
          V2_TENANT_LIFF_URL_,
        defaults: {
          start_date:
            tenantLeaseFormatDate_(
              new Date()
            ),
          end_date:
            tenantLeaseDefaultEndDate_(
              new Date()
            ),
          payment_day:
            10,
          deposit_months:
            2
        },
        properties:
          propertyViews,
        rooms:
          roomViews,
        diagnostics: {
          elapsed_ms:
            new Date().getTime() -
            startedAt,
          property_count:
            propertyViews.length,
          room_count:
            roomViews.length
        }
      }
    );

  } catch (error) {
    return workspaceResult_(
      false,
      'TENANT_CREATE_INIT_ERROR',
      '建立房客資料載入失敗：' +
        error.message
    );
  }
}


/**
 * 建立房客與正式租約。
 */
function createLandlordTenantLeaseByLineUid_(
  lineUserId,
  tenantName,
  tenantPhone,
  tenantEmail,
  propertyId,
  roomId,
  startDateValue,
  endDateValue,
  rentAmount,
  managementFee,
  depositMonths,
  depositAmount,
  paymentDay,
  electricityFeeRate,
  equipmentFeeRate,
  note
) {
  const lock =
    LockService.getScriptLock();

  let locked = false;

  try {
    tenantLeaseEnsureSchema_();

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
      tenantLeaseRequireCreate_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    tenantName =
      tenantLeaseText_(
        tenantName
      );

    tenantPhone =
      tenantLeaseNormalizePhone_(
        tenantPhone
      );

    tenantEmail =
      tenantLeaseText_(
        tenantEmail
      ).toLowerCase();

    propertyId =
      tenantLeaseText_(
        propertyId
      );

    roomId =
      tenantLeaseText_(
        roomId
      );

    const startDate =
      tenantLeaseDate_(
        startDateValue
      );

    const endDate =
      tenantLeaseDate_(
        endDateValue
      );

    rentAmount =
      tenantLeaseMoney_(
        rentAmount
      );

    managementFee =
      tenantLeaseMoney_(
        managementFee
      );

    depositMonths =
      tenantLeaseNumber_(
        depositMonths
      );

    depositAmount =
      tenantLeaseMoney_(
        depositAmount
      );

    paymentDay =
      tenantLeaseInteger_(
        paymentDay
      );

    electricityFeeRate =
      tenantLeaseMoney_(
        electricityFeeRate
      );

    equipmentFeeRate =
      tenantLeaseMoney_(
        equipmentFeeRate
      );

    note =
      tenantLeaseText_(
        note
      );

    if (
      !tenantName ||
      tenantName.length > 80
    ) {
      return workspaceResult_(
        false,
        'INVALID_TENANT_NAME',
        '請輸入 1 至 80 字的房客姓名'
      );
    }

    if (
      !/^09\d{8}$/.test(
        tenantPhone
      )
    ) {
      return workspaceResult_(
        false,
        'INVALID_TENANT_PHONE',
        '請輸入正確的台灣手機號碼，例如 0912345678'
      );
    }

    if (
      tenantEmail &&
      !tenantLeaseValidEmail_(
        tenantEmail
      )
    ) {
      return workspaceResult_(
        false,
        'INVALID_TENANT_EMAIL',
        '房客 Email 格式不正確'
      );
    }

    if (
      !propertyId ||
      !roomId
    ) {
      return workspaceResult_(
        false,
        'PROPERTY_ROOM_REQUIRED',
        '請選擇物件與房間'
      );
    }

    if (
      !startDate ||
      !endDate
    ) {
      return workspaceResult_(
        false,
        'INVALID_CONTRACT_DATE',
        '請輸入正確的租約開始與結束日期'
      );
    }

    if (
      startDate.getTime() >
      endDate.getTime()
    ) {
      return workspaceResult_(
        false,
        'CONTRACT_DATE_ORDER_ERROR',
        '租約結束日期不得早於開始日期'
      );
    }

    const termDays =
      Math.round(
        (
          endDate.getTime() -
          startDate.getTime()
        ) /
        86400000
      ) +
      1;

    if (
      termDays >
      V2_TENANT_LEASE_MAX_TERM_DAYS_
    ) {
      return workspaceResult_(
        false,
        'CONTRACT_TERM_TOO_LONG',
        '單一租約期間不得超過 10 年'
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
      equipmentFeeRate < 0
    ) {
      return workspaceResult_(
        false,
        'INVALID_FEE_AMOUNT',
        '管理費與計費單價不得為負數'
      );
    }

    if (
      depositMonths < 0 ||
      depositMonths > 12
    ) {
      return workspaceResult_(
        false,
        'INVALID_DEPOSIT_MONTHS',
        '押金月數請輸入 0 至 12'
      );
    }

    if (depositAmount < 0) {
      return workspaceResult_(
        false,
        'INVALID_DEPOSIT_AMOUNT',
        '押金金額不得為負數'
      );
    }

    if (
      paymentDay < 1 ||
      paymentDay > 28
    ) {
      return workspaceResult_(
        false,
        'INVALID_PAYMENT_DAY',
        '每月繳款日請輸入 1 至 28'
      );
    }

    if (note.length > 500) {
      return workspaceResult_(
        false,
        'NOTE_TOO_LONG',
        '備註最多 500 字'
      );
    }

    lock.waitLock(
      20000
    );

    locked = true;

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const propertySheet =
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .properties
      );

    const roomSheet =
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .rooms
      );

    const property =
      tenantLeaseFindWorkspaceTarget_(
        propertySheet,
        access,
        'property_id',
        propertyId
      );

    const room =
      tenantLeaseFindWorkspaceTarget_(
        roomSheet,
        access,
        'room_id',
        roomId
      );

    if (
      !property ||
      tenantLeaseText_(
        property.account_status ||
        property.property_status ||
        'active'
      ).toLowerCase() ===
        'archived'
    ) {
      return workspaceResult_(
        false,
        'PROPERTY_NOT_AVAILABLE',
        '找不到指定物件或物件已封存'
      );
    }

    if (
      !room ||
      tenantLeaseText_(
        room.account_status ||
        'active'
      ).toLowerCase() ===
        'archived'
    ) {
      return workspaceResult_(
        false,
        'ROOM_NOT_AVAILABLE',
        '找不到指定房間或房間已封存'
      );
    }

    if (
      tenantLeaseText_(
        room.property_id
      ) !==
      propertyId
    ) {
      return workspaceResult_(
        false,
        'ROOM_PROPERTY_MISMATCH',
        '房間不屬於所選物件'
      );
    }

    const tenantSheet =
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .tenants
      );

    const duplicatePhoneTenant =
      workspaceGetObjectsWithRow_(
        tenantSheet
      ).find(
        function (tenant) {
          const status =
            tenantLeaseText_(
              tenant.account_status ||
              tenant.tenant_account_status ||
              'active'
            ).toLowerCase();

          if (
            [
              'archived',
              'inactive',
              'ended',
              'terminated',
              'deleted'
            ].indexOf(
              status
            ) >= 0
          ) {
            return false;
          }

          return (
            tenantLeaseNormalizePhone_(
              tenant.tenant_phone ||
              tenant.phone ||
              tenant.mobile_phone ||
              tenant.contact_phone
            ) ===
            tenantPhone
          );
        }
      );

    if (duplicatePhoneTenant) {
      return workspaceResult_(
        false,
        'TENANT_PHONE_ALREADY_ACTIVE',
        '此手機號碼已有啟用中的房客資料。為避免 LINE 綁定到錯誤租約，請先確認原資料。'
      );
    }

    const contractSheet =
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .contracts
      );

    const overlappingContract =
      tenantLeaseFindOverlappingContract_(
        contractSheet,
        access,
        roomId,
        startDate,
        endDate
      );

    if (overlappingContract) {
      return workspaceResult_(
        false,
        'ROOM_CONTRACT_OVERLAP',
        '此房間在所選租期已有租約：' +
          (
            overlappingContract
              .contract_id ||
            '未編號租約'
          ) +
          '，請調整日期或選擇其他房間。',
        {
          existing_contract: {
            contract_id:
              overlappingContract
                .contract_id ||
              '',
            tenant_name:
              overlappingContract
                .tenant_name ||
              '',
            start_date:
              overlappingContract
                .start_date ||
              overlappingContract
                .contract_start_date ||
              '',
            end_date:
              overlappingContract
                .end_date ||
              overlappingContract
                .contract_end_date ||
              ''
          }
        }
      );
    }

    const usersSheet =
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .users
      );

    const landlordListSheet =
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .landlordTenantListView
      );

    const tenantHomeSheet =
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .tenantHomeView
      );

    const now =
      new Date();

    const actor =
      tenantLeaseActor_(
        access
      );

    const workspaceId =
      tenantLeaseText_(
        access.workspace
          .workspace_id
      ).toUpperCase();

    const landlordId =
      tenantLeaseText_(
        access.principal_landlord_id
      );

    const principalLineUserId =
      tenantLeaseText_(
        access.principal_line_user_id
      );

    const landlordName =
      tenantLeaseText_(
        access.principal
          .landlord_name ||
        access.workspace
          .workspace_name ||
        access.user.name
      );

    const tenantUserId =
      workspaceNextId_(
        usersSheet,
        'user_id',
        'U',
        6
      );

    const tenantId =
      workspaceNextId_(
        tenantSheet,
        'tenant_id',
        'T',
        6
      );

    const contractId =
      workspaceNextId_(
        contractSheet,
        'contract_id',
        'C',
        6
      );

    if (
      depositAmount === 0 &&
      depositMonths > 0
    ) {
      depositAmount =
        Math.round(
          rentAmount *
          depositMonths
        );
    }

    const today =
      tenantLeaseTaipeiToday_();

    const contractStatus =
      startDate.getTime() >
        today.getTime()
        ? 'upcoming'
        : 'active';

    const propertyName =
      tenantLeaseText_(
        property.property_name
      );

    const propertyAddress =
      tenantLeaseText_(
        property.property_address ||
        property.address
      );

    const roomName =
      tenantLeaseText_(
        room.room_name
      );

    workspaceAppendObject_(
      usersSheet,
      {
        user_id:
          tenantUserId,
        created_at:
          now,
        updated_at:
          now,
        role:
          'tenant',
        name:
          tenantName,
        phone:
          tenantPhone,
        email:
          tenantEmail,
        line_user_id:
          '',
        account_status:
          'active',
        active_workspace_id:
          workspaceId,
        profile_display_name:
          '',
        profile_picture_url:
          '',
        created_by_user_id:
          actor.user_id,
        note:
          'Created by landlord tenant onboarding'
      }
    );

    workspaceAppendObject_(
      tenantSheet,
      {
        tenant_id:
          tenantId,
        tenant_user_id:
          tenantUserId,
        user_id:
          tenantUserId,

        workspace_id:
          workspaceId,
        landlord_id:
          landlordId,
        landlord_line_user_id:
          principalLineUserId,

        tenant_line_user_id:
          '',
        line_user_id:
          '',

        tenant_name:
          tenantName,
        name:
          tenantName,
        tenant_phone:
          tenantPhone,
        phone:
          tenantPhone,
        tenant_email:
          tenantEmail,
        email:
          tenantEmail,

        property_id:
          propertyId,
        property_name:
          propertyName,
        room_id:
          roomId,
        room_name:
          roomName,
        room_list:
          roomName,

        current_contract_id:
          contractId,

        tenant_binding_status:
          'unbound',
        binding_status:
          'unbound',
        account_status:
          'active',
        tenant_account_status:
          'active',

        created_by_user_id:
          actor.user_id,
        created_by_membership_id:
          actor.membership_id,
        created_at:
          now,
        updated_at:
          now,
        note:
          note
      }
    );

    workspaceAppendObject_(
      contractSheet,
      {
        contract_id:
          contractId,
        workspace_id:
          workspaceId,

        landlord_id:
          landlordId,
        landlord_line_user_id:
          principalLineUserId,
        landlord_name:
          landlordName,

        tenant_id:
          tenantId,
        tenant_user_id:
          tenantUserId,
        tenant_line_user_id:
          '',
        tenant_name:
          tenantName,
        tenant_phone:
          tenantPhone,
        tenant_email:
          tenantEmail,

        property_id:
          propertyId,
        property_name:
          propertyName,
        property_address:
          propertyAddress,

        room_id:
          roomId,
        room_name:
          roomName,

        start_date:
          startDate,
        contract_start_date:
          startDate,
        end_date:
          endDate,
        contract_end_date:
          endDate,

        rent_amount:
          rentAmount,
        monthly_rent:
          rentAmount,
        management_fee:
          managementFee,
        monthly_management_fee:
          managementFee,

        deposit_months:
          depositMonths,
        deposit_amount:
          depositAmount,

        payment_day:
          paymentDay,
        monthly_payment_day:
          paymentDay,

        electricity_fee_rate:
          electricityFeeRate,
        equipment_fee_rate:
          equipmentFeeRate,

        contract_status:
          contractStatus,
        status:
          contractStatus,
        account_status:
          'active',

        signed_at:
          now,
        created_by_user_id:
          actor.user_id,
        created_by_membership_id:
          actor.membership_id,
        created_at:
          now,
        updated_at:
          now,
        note:
          note
      }
    );

    tenantLeaseUpsertLandlordTenantView_(
      landlordListSheet,
      {
        line_user_id:
          principalLineUserId,
        user_id:
          access.principal
            .landlord_user_id ||
          access.user.user_id ||
          '',
        workspace_id:
          workspaceId,
        landlord_id:
          landlordId,
        landlord_name:
          landlordName,

        tenant_line_user_id:
          '',
        tenant_user_id:
          tenantUserId,
        tenant_id:
          tenantId,
        tenant_name:
          tenantName,

        tenant_phone:
          tenantPhone,
        tenant_email:
          tenantEmail,
        tenant_binding_status:
          'unbound',

        property_id:
          propertyId,
        property_name:
          propertyName,
        room_id:
          roomId,
        room_list:
          roomName,

        latest_bill_month:
          '',
        latest_due_date:
          '',
        latest_total_amount:
          0,
        latest_payment_status:
          '',

        unpaid_bill_count:
          0,
        unpaid_total_amount:
          0,

        tenant_account_status:
          'active',
        current_contract_id:
          contractId,
        contract_status:
          contractStatus,
        contract_start_date:
          startDate,
        contract_end_date:
          endDate,

        created_at:
          now,
        updated_at:
          now
      }
    );

    tenantLeaseUpsertTenantHomeView_(
      tenantHomeSheet,
      {
        line_user_id:
          '',
        tenant_line_user_id:
          '',
        user_id:
          tenantUserId,
        tenant_user_id:
          tenantUserId,
        tenant_id:
          tenantId,
        tenant_name:
          tenantName,

        workspace_id:
          workspaceId,
        landlord_id:
          landlordId,
        landlord_name:
          landlordName,
        landlord_line_user_id:
          principalLineUserId,

        property_id:
          propertyId,
        property_name:
          propertyName,
        room_id:
          roomId,
        room_name:
          roomName,
        room_list:
          roomName,

        current_contract_id:
          contractId,
        contract_status:
          contractStatus,
        contract_start_date:
          startDate,
        contract_end_date:
          endDate,

        latest_bill_month:
          '',
        latest_due_date:
          '',
        latest_total_amount:
          0,
        latest_payment_status:
          '',

        unpaid_bill_count:
          0,
        unpaid_total_amount:
          0,

        tenant_phone:
          tenantPhone,
        tenant_email:
          tenantEmail,
        tenant_binding_status:
          'unbound',

        account_status:
          'active',
        created_at:
          now,
        updated_at:
          now
      }
    );

    tenantLeaseSetValues_(
      roomSheet,
      room.__row_number,
      {
        room_status:
          'occupied',
        current_contract_id:
          contractId,
        current_tenant_id:
          tenantId,
        current_tenant_name:
          tenantName,
        updated_by_user_id:
          actor.user_id,
        updated_by_membership_id:
          actor.membership_id,
        updated_at:
          now
      }
    );

    SpreadsheetApp.flush();

    const invitationMessage =
      tenantLeaseBuildInvitationMessage_(
        tenantName,
        roomName,
        tenantPhone
      );

    const result =
      workspaceResult_(
        true,
        'TENANT_LEASE_CREATED',
        '房客與租約已建立',
        {
          tenant: {
            tenant_id:
              tenantId,
            tenant_user_id:
              tenantUserId,
            tenant_name:
              tenantName,
            tenant_phone:
              tenantPhone,
            tenant_phone_masked:
              tenantLeaseMaskPhone_(
                tenantPhone
              ),
            tenant_email:
              tenantEmail,
            tenant_binding_status:
              'unbound'
          },
          contract: {
            contract_id:
              contractId,
            contract_status:
              contractStatus,
            start_date:
              tenantLeaseFormatDate_(
                startDate
              ),
            end_date:
              tenantLeaseFormatDate_(
                endDate
              ),
            rent_amount:
              rentAmount,
            management_fee:
              managementFee,
            deposit_months:
              depositMonths,
            deposit_amount:
              depositAmount,
            payment_day:
              paymentDay
          },
          property: {
            property_id:
              propertyId,
            property_name:
              propertyName,
            property_address:
              propertyAddress
          },
          room: {
            room_id:
              roomId,
            room_name:
              roomName
          },
          binding: {
            tenant_liff_url:
              V2_TENANT_LIFF_URL_,
            registered_phone:
              tenantPhone,
            registered_phone_masked:
              tenantLeaseMaskPhone_(
                tenantPhone
              ),
            invitation_message:
              invitationMessage
          }
        }
      );

    tenantLeaseAudit_(
      access,
      'landlord_tenant_lease_create',
      result,
      {
        target_type:
          'tenant',
        target_id:
          tenantId,
        secondary_target_id:
          contractId,
        operation_status:
          contractStatus,
        detail:
          'room_id=' +
          roomId +
          ', phone=' +
          tenantLeaseMaskPhone_(
            tenantPhone
          )
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'TENANT_LEASE_CREATE_ERROR',
      '房客與租約建立失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


// ==================================================
// View synchronization
// ==================================================

function tenantLeaseUpsertLandlordTenantView_(
  sheet,
  values
) {
  const existing =
    workspaceGetObjectsWithRow_(
      sheet
    ).find(
      function (row) {
        return (
          tenantLeaseText_(
            row.tenant_id
          ) ===
          tenantLeaseText_(
            values.tenant_id
          )
        );
      }
    );

  if (existing) {
    tenantLeaseSetValues_(
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


function tenantLeaseUpsertTenantHomeView_(
  sheet,
  values
) {
  const existing =
    workspaceGetObjectsWithRow_(
      sheet
    ).find(
      function (row) {
        return (
          tenantLeaseText_(
            row.tenant_id
          ) ===
          tenantLeaseText_(
            values.tenant_id
          )
        );
      }
    );

  if (existing) {
    tenantLeaseSetValues_(
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


// ==================================================
// Contract validation
// ==================================================

function tenantLeaseFindOverlappingContract_(
  contractSheet,
  access,
  roomId,
  requestedStart,
  requestedEnd
) {
  return tenantLeaseGetWorkspaceRows_(
    contractSheet,
    access,
    [
      'landlord_id'
    ]
  ).find(
    function (contract) {
      if (
        tenantLeaseText_(
          contract.room_id
        ) !==
        roomId
      ) {
        return false;
      }

      if (
        !tenantLeaseContractBlocksDates_(
          contract
        )
      ) {
        return false;
      }

      const existingStart =
        tenantLeaseDate_(
          contract.start_date ||
          contract.contract_start_date ||
          contract.lease_start_date
        );

      const existingEnd =
        tenantLeaseDate_(
          contract.end_date ||
          contract.contract_end_date ||
          contract.lease_end_date
        );

      if (
        !existingStart ||
        !existingEnd
      ) {
        return true;
      }

      return (
        requestedStart.getTime() <=
          existingEnd.getTime() &&
        requestedEnd.getTime() >=
          existingStart.getTime()
      );
    }
  ) || null;
}


function tenantLeaseResolveCurrentOrUpcomingContract_(
  contracts
) {
  const rows =
    (
      contracts || []
    )
      .filter(
        tenantLeaseContractBlocksDates_
      )
      .sort(
        function (a, b) {
          return (
            tenantLeaseTimeValue_(
              a.start_date ||
              a.contract_start_date ||
              a.created_at
            ) -
            tenantLeaseTimeValue_(
              b.start_date ||
              b.contract_start_date ||
              b.created_at
            )
          );
        }
      );

  return rows[0] || null;
}


function tenantLeaseContractBlocksDates_(
  contract
) {
  const status =
    tenantLeaseText_(
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
      'deleted'
    ].indexOf(
      status
    ) >= 0
  ) {
    return false;
  }

  const endDate =
    tenantLeaseDate_(
      contract.end_date ||
      contract.contract_end_date ||
      contract.lease_end_date
    );

  if (!endDate) {
    return [
      'active',
      'current',
      'effective',
      'signed',
      'upcoming',
      'approved',
      'pending_start'
    ].indexOf(
      status
    ) >= 0;
  }

  return (
    endDate.getTime() >=
    tenantLeaseTaipeiToday_()
      .getTime()
  );
}


// ==================================================
// Workspace data helpers
// ==================================================

/**
 * 讀取目前 Workspace 的房間。
 *
 * 相容舊資料：
 * - workspace_id 正確者直接納入。
 * - property_id 屬於目前 Workspace 者也納入。
 * - workspace_id 空白時，再以 landlord_id fallback。
 */
function tenantLeaseGetWorkspaceRooms_(
  ss,
  access,
  properties
) {
  const sheet =
    ss.getSheetByName(
      V2_TENANT_LEASE_SHEETS_
        .rooms
    );

  if (!sheet) {
    return [];
  }

  const workspaceId =
    tenantLeaseText_(
      access.workspace.workspace_id
    ).toUpperCase();

  const propertyIds =
    (
      properties || []
    )
      .map(
        function (property) {
          return tenantLeaseText_(
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
          return tenantLeaseText_(
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
        tenantLeaseText_(
          row.workspace_id
        ).toUpperCase();

      const propertyId =
        tenantLeaseText_(
          row.property_id
        );

      const landlordId =
        tenantLeaseText_(
          row.landlord_id
        );

      if (
        rowWorkspaceId ===
        workspaceId
      ) {
        return true;
      }

      if (
        propertyId &&
        propertyIds.indexOf(
          propertyId
        ) >= 0
      ) {
        return true;
      }

      return (
        !rowWorkspaceId &&
        landlordId &&
        landlordIds.indexOf(
          landlordId
        ) >= 0
      );
    }
  );
}


function tenantLeaseGetWorkspaceRows_(
  sheet,
  access,
  landlordIdHeaders
) {
  if (!sheet) {
    return [];
  }

  const workspaceId =
    tenantLeaseText_(
      access.workspace.workspace_id
    ).toUpperCase();

  const landlordIds =
    (
      access.principals || []
    )
      .map(
        function (principal) {
          return tenantLeaseText_(
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
        tenantLeaseText_(
          row.workspace_id
        ).toUpperCase();

      if (rowWorkspaceId) {
        return (
          rowWorkspaceId ===
          workspaceId
        );
      }

      return (
        landlordIdHeaders || []
      ).some(
        function (header) {
          return (
            landlordIds.indexOf(
              tenantLeaseText_(
                row[header]
              )
            ) >= 0
          );
        }
      );
    }
  );
}


function tenantLeaseFindWorkspaceTarget_(
  sheet,
  access,
  idHeader,
  idValue
) {
  return tenantLeaseGetWorkspaceRows_(
    sheet,
    access,
    [
      'landlord_id'
    ]
  ).find(
    function (row) {
      return (
        tenantLeaseText_(
          row[idHeader]
        ) ===
        idValue
      );
    }
  ) || null;
}


// ==================================================
// Permissions and audit
// ==================================================

function tenantLeaseCanCreate_(
  access
) {
  return (
    [
      'owner',
      'admin',
      'manager'
    ].indexOf(
      tenantLeaseText_(
        access.membership.role
      ).toLowerCase()
    ) >= 0
  );
}


function tenantLeaseRequireCreate_(
  access
) {
  if (
    tenantLeaseCanCreate_(
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
    '目前角色沒有建立房客與租約的權限'
  );
}


function tenantLeaseActor_(
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
      '',
    line_user_id:
      access.line_user_id ||
      access.user.line_user_id ||
      ''
  };
}


function tenantLeaseAudit_(
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

      return;
    }

    if (
      typeof workspaceWriteActivityLog_ ===
      'function'
    ) {
      workspaceWriteActivityLog_({
        workspace_id:
          access.workspace.workspace_id ||
          '',
        user_id:
          access.user.user_id ||
          '',
        membership_id:
          access.membership
            .membership_id ||
          '',
        line_user_id:
          access.line_user_id ||
          '',
        action:
          action,
        target_type:
          meta.target_type ||
          '',
        target_id:
          meta.target_id ||
          '',
        result:
          result &&
          result.success
            ? 'success'
            : 'failed',
        detail:
          meta.detail ||
          ''
      });
    }
  } catch (error) {
    // 稽核失敗不阻擋主流程。
  }
}


// ==================================================
// Schema
// ==================================================

function tenantLeaseEnsureSchema_() {
  workspaceEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  tenantLeaseEnsureSheet_(
    ss,
    V2_TENANT_LEASE_SHEETS_
      .tenants,
    [
      'tenant_id',
      'tenant_user_id',
      'user_id',
      'workspace_id',
      'landlord_id',
      'landlord_line_user_id',
      'tenant_line_user_id',
      'line_user_id',
      'tenant_name',
      'name',
      'tenant_phone',
      'phone',
      'tenant_email',
      'email',
      'property_id',
      'property_name',
      'room_id',
      'room_name',
      'room_list',
      'current_contract_id',
      'tenant_binding_status',
      'binding_status',
      'account_status',
      'tenant_account_status',
      'bound_at',
      'created_by_user_id',
      'created_by_membership_id',
      'created_at',
      'updated_at',
      'note'
    ]
  );

  tenantLeaseEnsureSheet_(
    ss,
    V2_TENANT_LEASE_SHEETS_
      .contracts,
    [
      'contract_id',
      'workspace_id',
      'landlord_id',
      'landlord_line_user_id',
      'landlord_name',
      'tenant_id',
      'tenant_user_id',
      'tenant_line_user_id',
      'tenant_name',
      'tenant_phone',
      'tenant_email',
      'property_id',
      'property_name',
      'property_address',
      'room_id',
      'room_name',
      'start_date',
      'contract_start_date',
      'end_date',
      'contract_end_date',
      'rent_amount',
      'monthly_rent',
      'management_fee',
      'monthly_management_fee',
      'deposit_months',
      'deposit_amount',
      'payment_day',
      'monthly_payment_day',
      'electricity_fee_rate',
      'equipment_fee_rate',
      'contract_status',
      'status',
      'account_status',
      'signed_at',
      'created_by_user_id',
      'created_by_membership_id',
      'created_at',
      'updated_at',
      'note'
    ]
  );

  tenantLeaseEnsureSheet_(
    ss,
    V2_TENANT_LEASE_SHEETS_
      .landlordTenantListView,
    [
      'line_user_id',
      'user_id',
      'workspace_id',
      'landlord_id',
      'landlord_name',
      'tenant_line_user_id',
      'tenant_user_id',
      'tenant_id',
      'tenant_name',
      'tenant_phone',
      'tenant_email',
      'tenant_binding_status',
      'property_id',
      'property_name',
      'room_id',
      'room_list',
      'latest_bill_month',
      'latest_due_date',
      'latest_total_amount',
      'latest_payment_status',
      'unpaid_bill_count',
      'unpaid_total_amount',
      'tenant_account_status',
      'current_contract_id',
      'contract_status',
      'contract_start_date',
      'contract_end_date',
      'created_at',
      'updated_at'
    ]
  );

  tenantLeaseEnsureSheet_(
    ss,
    V2_TENANT_LEASE_SHEETS_
      .tenantHomeView,
    [
      'line_user_id',
      'tenant_line_user_id',
      'user_id',
      'tenant_user_id',
      'tenant_id',
      'tenant_name',
      'workspace_id',
      'landlord_id',
      'landlord_name',
      'landlord_line_user_id',
      'property_id',
      'property_name',
      'room_id',
      'room_name',
      'room_list',
      'current_contract_id',
      'contract_status',
      'contract_start_date',
      'contract_end_date',
      'latest_bill_month',
      'latest_due_date',
      'latest_total_amount',
      'latest_payment_status',
      'unpaid_bill_count',
      'unpaid_total_amount',
      'tenant_phone',
      'tenant_email',
      'tenant_binding_status',
      'account_status',
      'created_at',
      'updated_at'
    ]
  );

  tenantLeaseEnsureSheet_(
    ss,
    V2_TENANT_LEASE_SHEETS_
      .tenantBillView,
    [
      'line_user_id',
      'tenant_line_user_id',
      'user_id',
      'tenant_user_id',
      'tenant_id',
      'tenant_name',
      'workspace_id',
      'landlord_id',
      'room_id',
      'room_name',
      'bill_id',
      'bill_month',
      'due_date',
      'total_amount',
      'payment_status',
      'updated_at'
    ]
  );

  const roomSheet =
    ss.getSheetByName(
      V2_TENANT_LEASE_SHEETS_
        .rooms
    );

  [
    'current_contract_id',
    'current_tenant_id',
    'current_tenant_name'
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


function tenantLeaseEnsureSheet_(
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
        tenantLeaseText_
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
 * 公開讀取 API 只驗證必要資料表，不進行欄位增修。
 */
function tenantLeaseRequireReadSchema_() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const requiredSheets = [
    V2_TENANT_LEASE_SHEETS_
      .properties,
    V2_TENANT_LEASE_SHEETS_
      .rooms,
    V2_TENANT_LEASE_SHEETS_
      .contracts,
    V2_TENANT_LEASE_SHEETS_
      .tenants
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
      '。請先執行 testEnsureTenantLeaseSchema()。'
    );
  }

  return true;
}


function tenantLeaseSetValues_(
  sheet,
  rowNumber,
  values
) {
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
// Formatting and validation
// ==================================================

function tenantLeaseBuildInvitationMessage_(
  tenantName,
  roomName,
  tenantPhone
) {
  return (
    tenantName +
    ' 您好，房東已建立您的租屋資料（' +
    roomName +
    '）。\n\n' +
    '請使用本人 LINE 開啟以下連結：\n' +
    V2_TENANT_LIFF_URL_ +
    '\n\n' +
    '進入後輸入租約登記手機號碼 ' +
    tenantPhone +
    '，並勾選「我確認這是本人 LINE 帳號」完成綁定。'
  );
}


function tenantLeaseNormalizePhone_(
  value
) {
  let digits =
    tenantLeaseText_(
      value
    ).replace(
      /\D/g,
      ''
    );

  if (
    digits.indexOf(
      '8860'
    ) === 0 &&
    digits.length === 13
  ) {
    digits =
      '0' +
      digits.slice(
        4
      );
  } else if (
    digits.indexOf(
      '886'
    ) === 0 &&
    digits.length === 12
  ) {
    digits =
      '0' +
      digits.slice(
        3
      );
  } else if (
    digits.length === 9 &&
    digits.charAt(
      0
    ) === '9'
  ) {
    digits =
      '0' +
      digits;
  }

  return digits;
}


function tenantLeaseMaskPhone_(
  value
) {
  const phone =
    tenantLeaseNormalizePhone_(
      value
    );

  if (
    phone.length !== 10
  ) {
    return '';
  }

  return (
    phone.slice(
      0,
      2
    ) +
    '******' +
    phone.slice(
      -2
    )
  );
}


function tenantLeaseValidEmail_(
  value
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    tenantLeaseText_(
      value
    )
  );
}


function tenantLeaseDefaultEndDate_(
  startDate
) {
  const date =
    new Date(
      startDate.getTime()
    );

  date.setFullYear(
    date.getFullYear() +
    1
  );

  date.setDate(
    date.getDate() -
    1
  );

  return tenantLeaseFormatDate_(
    date
  );
}


function tenantLeaseFormatDate_(
  value
) {
  const date =
    value instanceof Date
      ? value
      : tenantLeaseDate_(
          value
        );

  if (!date) {
    return '';
  }

  return Utilities.formatDate(
    date,
    'Asia/Taipei',
    'yyyy-MM-dd'
  );
}


function tenantLeaseTaipeiToday_() {
  return tenantLeaseDate_(
    Utilities.formatDate(
      new Date(),
      'Asia/Taipei',
      'yyyy-MM-dd'
    )
  );
}


function tenantLeaseDate_(
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
    tenantLeaseText_(
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
        ) -
          1,
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


function tenantLeaseTimeValue_(
  value
) {
  const date =
    tenantLeaseDate_(
      value
    );

  return date
    ? date.getTime()
    : 0;
}


function tenantLeaseCompareText_(
  valueA,
  valueB
) {
  return tenantLeaseText_(
    valueA
  ).localeCompare(
    tenantLeaseText_(
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


function tenantLeaseText_(
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


function tenantLeaseNumber_(
  value
) {
  const number =
    Number(
      tenantLeaseText_(
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


function tenantLeaseInteger_(
  value
) {
  return Math.round(
    tenantLeaseNumber_(
      value
    )
  );
}


function tenantLeaseMoney_(
  value
) {
  return Math.round(
    tenantLeaseNumber_(
      value
    )
  );
}


// ==================================================
// Tests
// ==================================================

function testEnsureTenantLeaseSchema() {
  tenantLeaseEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const result = {
    success:
      true,
    tenants:
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .tenants
      ).getLastColumn(),
    contracts:
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .contracts
      ).getLastColumn(),
    landlord_tenant_view:
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .landlordTenantListView
      ).getLastColumn(),
    tenant_home_view:
      ss.getSheetByName(
        V2_TENANT_LEASE_SHEETS_
          .tenantHomeView
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


function testLandlordTenantCreateInitTimed() {
  const startedAt =
    new Date().getTime();

  const result =
    getLandlordTenantCreateInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      '',
      ''
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


function testLandlordTenantCreateInit() {
  const result =
    getLandlordTenantCreateInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      '',
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
