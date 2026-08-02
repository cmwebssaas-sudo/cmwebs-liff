/**
 * CMWebs V2 房東首次初始設定
 *
 * API：
 * - landlord_onboarding_init
 * - landlord_onboarding_save
 * - landlord_onboarding_complete
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 */

const V2_LANDLORD_ONBOARDING_SHEETS_ = {
  landlords:
    'V2_landlords',
  workspaces:
    'V2_workspaces',
  members:
    'V2_workspace_members',
  paymentAccounts:
    'V2_workspace_payment_accounts',
  properties:
    'V2_properties',
  rooms:
    'V2_rooms',
  propertyOwners:
    'V2_property_owners'
};


/**
 * 初始設定頁載入。
 */
function getLandlordOnboardingInitByLineUid_(
  lineUserId
) {
  const action =
    'landlord_onboarding_init';

  try {
    lineUserId =
      onboardingText_(
        lineUserId
      );

    if (!lineUserId) {
      return onboardingResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID'
      );
    }

    onboardingEnsureSchema_();

    const contextResult =
      getLandlordWorkspaceContextByLineUid_(
        lineUserId
      );

    if (
      !contextResult ||
      contextResult.success !== true
    ) {
      return onboardingResult_(
        false,
        contextResult &&
        contextResult.code
          ? contextResult.code
          : 'WORKSPACE_CONTEXT_NOT_FOUND',
        contextResult &&
        contextResult.message
          ? contextResult.message
          : '找不到房東管理團隊'
      );
    }

    const context =
      contextResult.data || {};

    const permissionCheck =
      onboardingCheckPermission_(
        context
      );

    if (!permissionCheck.success) {
      return permissionCheck;
    }

    const workspace =
      context.active_workspace || {};

    const data =
      onboardingBuildData_(
        lineUserId,
        context,
        workspace.workspace_id
      );

    onboardingLogAccess_({
      lineUserId:
        lineUserId,
      userId:
        context.user &&
        context.user.user_id
          ? context.user.user_id
          : '',
      role:
        'landlord',
      action:
        action,
      targetId:
        workspace.workspace_id || '',
      result:
        'success',
      errorMessage:
        '',
      notes:
        'step=' +
        data.progress.current_step
    });

    return onboardingResult_(
      true,
      'OK',
      '初始設定資料載入成功',
      data
    );

  } catch (error) {
    onboardingLogAccess_({
      lineUserId:
        lineUserId || '',
      userId:
        '',
      role:
        'landlord',
      action:
        action,
      targetId:
        '',
      result:
        'failed',
      errorMessage:
        error.message
    });

    return onboardingResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' +
        error.message
    );
  }
}


/**
 * 儲存單一步驟。
 *
 * step:
 * - payment
 * - property
 * - room
 */
function saveLandlordOnboardingStepByLineUid_(
  lineUserId,
  step,
  payload
) {
  const action =
    'landlord_onboarding_save';

  const lock =
    LockService.getScriptLock();

  let locked = false;

  try {
    lineUserId =
      onboardingText_(
        lineUserId
      );

    step =
      onboardingText_(
        step
      ).toLowerCase();

    payload =
      payload || {};

    if (!lineUserId) {
      return onboardingResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID'
      );
    }

    if (
      [
        'payment',
        'property',
        'room'
      ].indexOf(step) === -1
    ) {
      return onboardingResult_(
        false,
        'INVALID_STEP',
        '不支援的初始設定步驟'
      );
    }

    onboardingEnsureSchema_();

    lock.waitLock(20000);
    locked = true;

    const contextResult =
      getLandlordWorkspaceContextByLineUid_(
        lineUserId
      );

    if (
      !contextResult ||
      contextResult.success !== true
    ) {
      return onboardingResult_(
        false,
        contextResult &&
        contextResult.code
          ? contextResult.code
          : 'WORKSPACE_CONTEXT_NOT_FOUND',
        contextResult &&
        contextResult.message
          ? contextResult.message
          : '找不到房東管理團隊'
      );
    }

    const context =
      contextResult.data || {};

    const permissionCheck =
      onboardingCheckPermission_(
        context
      );

    if (!permissionCheck.success) {
      return permissionCheck;
    }

    const workspace =
      context.active_workspace || {};

    const workspaceId =
      onboardingText_(
        workspace.workspace_id
      ).toUpperCase();

    const userId =
      context.user &&
      context.user.user_id
        ? onboardingText_(
            context.user.user_id
          )
        : '';

    const membershipId =
      context.active_membership &&
      context.active_membership.membership_id
        ? onboardingText_(
            context.active_membership.membership_id
          )
        : '';

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const landlord =
      onboardingResolveLandlord_(
        ss,
        lineUserId,
        workspaceId
      );

    if (!landlord) {
      return onboardingResult_(
        false,
        'LANDLORD_NOT_FOUND',
        '找不到房東相容資料'
      );
    }

    let targetId = '';

    if (step === 'payment') {
      targetId =
        onboardingSavePayment_(
          ss,
          workspaceId,
          userId,
          landlord,
          payload
        );
    }

    if (step === 'property') {
      targetId =
        onboardingSaveProperty_(
          ss,
          workspaceId,
          userId,
          landlord,
          payload
        );
    }

    if (step === 'room') {
      targetId =
        onboardingSaveRoom_(
          ss,
          workspaceId,
          userId,
          landlord,
          payload
        );
    }

    onboardingSetWorkspaceProgress_(
      ss,
      workspaceId,
      step,
      targetId
    );

    SpreadsheetApp.flush();

    if (
      typeof workspaceWriteActivityLog_ ===
      'function'
    ) {
      workspaceWriteActivityLog_({
        workspace_id:
          workspaceId,
        user_id:
          userId,
        membership_id:
          membershipId,
        line_user_id:
          lineUserId,
        action:
          'onboarding_' +
          step +
          '_saved',
        target_type:
          step,
        target_id:
          targetId,
        result:
          'success',
        detail:
          ''
      });
    }

    const refreshed =
      onboardingBuildData_(
        lineUserId,
        context,
        workspaceId
      );

    onboardingLogAccess_({
      lineUserId:
        lineUserId,
      userId:
        userId,
      role:
        'landlord',
      action:
        action,
      targetId:
        targetId,
      result:
        'success',
      errorMessage:
        '',
      notes:
        'step=' +
        step
    });

    return onboardingResult_(
      true,
      'SAVED',
      '資料已儲存',
      refreshed
    );

  } catch (error) {
    onboardingLogAccess_({
      lineUserId:
        lineUserId || '',
      userId:
        '',
      role:
        'landlord',
      action:
        action,
      targetId:
        '',
      result:
        'failed',
      errorMessage:
        error.message
    });

    return onboardingResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * 完成初始設定。
 */
function completeLandlordOnboardingByLineUid_(
  lineUserId
) {
  const action =
    'landlord_onboarding_complete';

  const lock =
    LockService.getScriptLock();

  let locked = false;

  try {
    lineUserId =
      onboardingText_(
        lineUserId
      );

    if (!lineUserId) {
      return onboardingResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID'
      );
    }

    onboardingEnsureSchema_();

    lock.waitLock(20000);
    locked = true;

    const contextResult =
      getLandlordWorkspaceContextByLineUid_(
        lineUserId
      );

    if (
      !contextResult ||
      contextResult.success !== true
    ) {
      return onboardingResult_(
        false,
        contextResult &&
        contextResult.code
          ? contextResult.code
          : 'WORKSPACE_CONTEXT_NOT_FOUND',
        contextResult &&
        contextResult.message
          ? contextResult.message
          : '找不到房東管理團隊'
      );
    }

    const context =
      contextResult.data || {};

    const permissionCheck =
      onboardingCheckPermission_(
        context
      );

    if (!permissionCheck.success) {
      return permissionCheck;
    }

    const workspace =
      context.active_workspace || {};

    const workspaceId =
      onboardingText_(
        workspace.workspace_id
      ).toUpperCase();

    const userId =
      context.user &&
      context.user.user_id
        ? onboardingText_(
            context.user.user_id
          )
        : '';

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const currentData =
      onboardingBuildData_(
        lineUserId,
        context,
        workspaceId
      );

    const missing = [];

    if (
      !currentData.progress.payment_completed
    ) {
      missing.push(
        '收款帳號'
      );
    }

    if (
      !currentData.progress.property_completed
    ) {
      missing.push(
        '第一個物件'
      );
    }

    if (
      !currentData.progress.room_completed
    ) {
      missing.push(
        '第一個房間'
      );
    }

    if (missing.length > 0) {
      return onboardingResult_(
        false,
        'ONBOARDING_INCOMPLETE',
        '請先完成：' +
          missing.join('、'),
        currentData
      );
    }

    const now =
      new Date();

    const workspaceSheet =
      ss.getSheetByName(
        V2_LANDLORD_ONBOARDING_SHEETS_
          .workspaces
      );

    const workspaceRow =
      onboardingFindRow_(
        workspaceSheet,
        'workspace_id',
        workspaceId
      );

    if (!workspaceRow) {
      return onboardingResult_(
        false,
        'WORKSPACE_NOT_FOUND',
        '找不到管理團隊'
      );
    }

    onboardingSetValue_(
      workspaceSheet,
      workspaceRow.__row_number,
      'onboarding_status',
      'completed'
    );

    onboardingSetValue_(
      workspaceSheet,
      workspaceRow.__row_number,
      'onboarding_step',
      'completed'
    );

    onboardingSetValue_(
      workspaceSheet,
      workspaceRow.__row_number,
      'onboarding_completed_at',
      now
    );

    onboardingSetValue_(
      workspaceSheet,
      workspaceRow.__row_number,
      'updated_at',
      now
    );

    const landlord =
      onboardingResolveLandlord_(
        ss,
        lineUserId,
        workspaceId
      );

    if (landlord) {
      const landlordSheet =
        ss.getSheetByName(
          V2_LANDLORD_ONBOARDING_SHEETS_
            .landlords
        );

      onboardingSetValue_(
        landlordSheet,
        landlord.__row_number,
        'onboarding_status',
        'completed'
      );

      onboardingSetValue_(
        landlordSheet,
        landlord.__row_number,
        'onboarding_completed_at',
        now
      );

      onboardingSetValue_(
        landlordSheet,
        landlord.__row_number,
        'updated_at',
        now
      );
    }

    SpreadsheetApp.flush();

    if (
      typeof workspaceWriteActivityLog_ ===
      'function'
    ) {
      workspaceWriteActivityLog_({
        workspace_id:
          workspaceId,
        user_id:
          userId,
        membership_id:
          context.active_membership &&
          context.active_membership.membership_id
            ? context.active_membership.membership_id
            : '',
        line_user_id:
          lineUserId,
        action:
          'onboarding_completed',
        target_type:
          'workspace',
        target_id:
          workspaceId,
        result:
          'success',
        detail:
          'property_id=' +
          currentData.property.property_id +
          ', room_id=' +
          currentData.room.room_id
      });
    }

    onboardingLogAccess_({
      lineUserId:
        lineUserId,
      userId:
        userId,
      role:
        'landlord',
      action:
        action,
      targetId:
        workspaceId,
      result:
        'success',
      errorMessage:
        '',
      notes:
        'completed'
    });

    return onboardingResult_(
      true,
      'COMPLETED',
      '初始設定已完成',
      {
        route:
          'home',
        workspace_id:
          workspaceId,
        onboarding_status:
          'completed'
      }
    );

  } catch (error) {
    onboardingLogAccess_({
      lineUserId:
        lineUserId || '',
      userId:
        '',
      role:
        'landlord',
      action:
        action,
      targetId:
        '',
      result:
        'failed',
      errorMessage:
        error.message
    });

    return onboardingResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


// ==================================================
// Save handlers
// ==================================================

function onboardingSavePayment_(
  ss,
  workspaceId,
  userId,
  landlord,
  payload
) {
  const bankCode =
    onboardingText_(
      payload.bank_code
    );

  const bankName =
    onboardingText_(
      payload.bank_name
    );

  const branchName =
    onboardingText_(
      payload.branch_name
    );

  const bankAccount =
    onboardingText_(
      payload.bank_account
    ).replace(/\s/g, '');

  const bankAccountName =
    onboardingText_(
      payload.bank_account_name
    );

  const paymentNote =
    onboardingText_(
      payload.payment_note
    );

  if (
    !/^\d{3}$/.test(
      bankCode
    )
  ) {
    throw new Error(
      '銀行代碼必須是 3 位數字'
    );
  }

  if (!bankName) {
    throw new Error(
      '請輸入銀行名稱'
    );
  }

  if (
    !/^[0-9]{6,20}$/.test(
      bankAccount
    )
  ) {
    throw new Error(
      '請輸入 6 至 20 位數字的銀行帳號'
    );
  }

  if (!bankAccountName) {
    throw new Error(
      '請輸入銀行戶名'
    );
  }

  const sheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .paymentAccounts
    );

  const existing =
    onboardingGetObjects_(
      sheet
    ).find(
      function (row) {
        return (
          onboardingText_(
            row.workspace_id
          ).toUpperCase() ===
            workspaceId &&
          onboardingBoolean_(
            row.is_default
          )
        );
      }
    );

  const now =
    new Date();

  let accountId = '';

  if (existing) {
    accountId =
      onboardingText_(
        existing.payment_account_id
      );

    onboardingSetValues_(
      sheet,
      existing.__row_number,
      {
        bank_code:
          bankCode,
        bank_name:
          bankName,
        branch_name:
          branchName,
        bank_account:
          bankAccount,
        bank_account_name:
          bankAccountName,
        payment_note:
          paymentNote,
        is_default:
          true,
        account_status:
          'active',
        updated_at:
          now
      }
    );
  } else {
    accountId =
      onboardingNextId_(
        sheet,
        'payment_account_id',
        'PA',
        6
      );

    onboardingAppend_(
      sheet,
      {
        payment_account_id:
          accountId,
        workspace_id:
          workspaceId,
        account_name:
          '預設收款帳號',
        bank_code:
          bankCode,
        bank_name:
          bankName,
        branch_name:
          branchName,
        bank_account:
          bankAccount,
        bank_account_name:
          bankAccountName,
        payment_note:
          paymentNote,
        is_default:
          true,
        account_status:
          'active',
        created_by_user_id:
          userId,
        created_at:
          now,
        updated_at:
          now,
        note:
          ''
      }
    );
  }

  const landlordSheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .landlords
    );

  onboardingSetValues_(
    landlordSheet,
    landlord.__row_number,
    {
      bank_code:
        bankCode,
      bank_name:
        bankName,
      bank_branch:
        branchName,
      bank_account:
        bankAccount,
      bank_account_name:
        bankAccountName,
      payment_note:
        paymentNote,
      default_payment_account_id:
        accountId,
      updated_at:
        now
    }
  );

  return accountId;
}


function onboardingSaveProperty_(
  ss,
  workspaceId,
  userId,
  landlord,
  payload
) {
  const propertyName =
    onboardingText_(
      payload.property_name
    );

  const city =
    onboardingText_(
      payload.city
    );

  const district =
    onboardingText_(
      payload.district
    );

  const propertyAddress =
    onboardingText_(
      payload.property_address
    );

  const propertyType =
    onboardingText_(
      payload.property_type
    ).toLowerCase();

  if (!propertyName) {
    throw new Error(
      '請輸入物件名稱'
    );
  }

  if (!city) {
    throw new Error(
      '請輸入縣市'
    );
  }

  if (!district) {
    throw new Error(
      '請輸入行政區'
    );
  }

  if (!propertyAddress) {
    throw new Error(
      '請輸入物件地址'
    );
  }

  const allowedTypes = [
    'apartment',
    'suite',
    'building',
    'house',
    'shop',
    'office',
    'other'
  ];

  if (
    allowedTypes.indexOf(
      propertyType
    ) === -1
  ) {
    throw new Error(
      '請選擇正確的物件類型'
    );
  }

  const sheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .properties
    );

  const workspaceSheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .workspaces
    );

  const workspaceRow =
    onboardingFindRow_(
      workspaceSheet,
      'workspace_id',
      workspaceId
    );

  let propertyId =
    workspaceRow
      ? onboardingText_(
          workspaceRow.first_property_id
        )
      : '';

  let existing =
    propertyId
      ? onboardingFindRow_(
          sheet,
          'property_id',
          propertyId
        )
      : null;

  if (!existing) {
    existing =
      onboardingGetObjects_(
        sheet
      ).find(
        function (row) {
          return (
            onboardingText_(
              row.workspace_id
            ).toUpperCase() ===
              workspaceId &&
            onboardingBoolean_(
              row.is_onboarding_property
            )
          );
        }
      ) || null;
  }

  const now =
    new Date();

  const landlordId =
    onboardingText_(
      landlord.landlord_id
    );

  if (existing) {
    propertyId =
      onboardingText_(
        existing.property_id
      );

    onboardingSetValues_(
      sheet,
      existing.__row_number,
      {
        workspace_id:
          workspaceId,
        landlord_id:
          landlordId,
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
        is_onboarding_property:
          true,
        updated_at:
          now
      }
    );
  } else {
    propertyId =
      onboardingNextId_(
        sheet,
        'property_id',
        'P',
        6
      );

    onboardingAppend_(
      sheet,
      {
        property_id:
          propertyId,
        workspace_id:
          workspaceId,
        landlord_id:
          landlordId,
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
        is_onboarding_property:
          true,
        created_by_user_id:
          userId,
        created_at:
          now,
        updated_at:
          now,
        note:
          ''
      }
    );
  }

  onboardingUpsertPropertyOwner_(
    ss,
    workspaceId,
    propertyId,
    userId,
    landlord
  );

  return propertyId;
}


function onboardingSaveRoom_(
  ss,
  workspaceId,
  userId,
  landlord,
  payload
) {
  const workspaceSheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .workspaces
    );

  const workspaceRow =
    onboardingFindRow_(
      workspaceSheet,
      'workspace_id',
      workspaceId
    );

  const propertyId =
    workspaceRow
      ? onboardingText_(
          workspaceRow.first_property_id
        )
      : '';

  if (!propertyId) {
    throw new Error(
      '請先完成第一個物件設定'
    );
  }

  const propertySheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .properties
    );

  const property =
    onboardingFindRow_(
      propertySheet,
      'property_id',
      propertyId
    );

  if (!property) {
    throw new Error(
      '找不到第一個物件資料'
    );
  }

  const roomName =
    onboardingText_(
      payload.room_name
    );

  const rentAmount =
    onboardingMoney_(
      payload.rent_amount
    );

  const managementFee =
    onboardingMoney_(
      payload.management_fee
    );

  const electricityRate =
    onboardingMoney_(
      payload.electricity_fee_rate
    );

  const equipmentRate =
    onboardingMoney_(
      payload.equipment_fee_rate
    );

  const paymentDay =
    Number(
      payload.payment_day
    );

  const depositMonths =
    Number(
      payload.deposit_months
    );

  if (!roomName) {
    throw new Error(
      '請輸入房號或房間名稱'
    );
  }

  if (rentAmount <= 0) {
    throw new Error(
      '每月租金必須大於 0'
    );
  }

  if (
    managementFee < 0 ||
    electricityRate < 0 ||
    equipmentRate < 0
  ) {
    throw new Error(
      '費用不得為負數'
    );
  }

  if (
    !Number.isInteger(
      paymentDay
    ) ||
    paymentDay < 1 ||
    paymentDay > 28
  ) {
    throw new Error(
      '每月繳款日請輸入 1 至 28'
    );
  }

  if (
    !Number.isFinite(
      depositMonths
    ) ||
    depositMonths < 0 ||
    depositMonths > 12
  ) {
    throw new Error(
      '押金月數請輸入 0 至 12'
    );
  }

  const sheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .rooms
    );

  let roomId =
    workspaceRow
      ? onboardingText_(
          workspaceRow.first_room_id
        )
      : '';

  let existing =
    roomId
      ? onboardingFindRow_(
          sheet,
          'room_id',
          roomId
        )
      : null;

  if (!existing) {
    existing =
      onboardingGetObjects_(
        sheet
      ).find(
        function (row) {
          return (
            onboardingText_(
              row.workspace_id
            ).toUpperCase() ===
              workspaceId &&
            onboardingText_(
              row.property_id
            ) ===
              propertyId &&
            onboardingBoolean_(
              row.is_onboarding_room
            )
          );
        }
      ) || null;
  }

  const duplicate =
    onboardingGetObjects_(
      sheet
    ).find(
      function (row) {
        const sameName =
          onboardingText_(
            row.room_name
          ).toLowerCase() ===
          roomName.toLowerCase();

        const sameProperty =
          onboardingText_(
            row.property_id
          ) ===
          propertyId;

        const notCurrent =
          !existing ||
          onboardingText_(
            row.room_id
          ) !==
          onboardingText_(
            existing.room_id
          );

        return (
          sameName &&
          sameProperty &&
          notCurrent
        );
      }
    );

  if (duplicate) {
    throw new Error(
      '此物件已存在相同房號或房間名稱'
    );
  }

  const landlordId =
    onboardingText_(
      landlord.landlord_id
    );

  const now =
    new Date();

  if (existing) {
    roomId =
      onboardingText_(
        existing.room_id
      );

    onboardingSetValues_(
      sheet,
      existing.__row_number,
      {
        workspace_id:
          workspaceId,
        property_id:
          propertyId,
        landlord_id:
          landlordId,
        property_name:
          property.property_name || '',
        room_name:
          roomName,
        room_status:
          'vacant',
        account_status:
          'active',
        rent_amount:
          rentAmount,
        management_fee:
          managementFee,
        electricity_fee_rate:
          electricityRate,
        equipment_fee_rate:
          equipmentRate,
        payment_day:
          paymentDay,
        monthly_payment_day:
          paymentDay,
        deposit_months:
          depositMonths,
        is_onboarding_room:
          true,
        updated_at:
          now
      }
    );
  } else {
    roomId =
      onboardingNextId_(
        sheet,
        'room_id',
        'R',
        6
      );

    onboardingAppend_(
      sheet,
      {
        room_id:
          roomId,
        workspace_id:
          workspaceId,
        property_id:
          propertyId,
        landlord_id:
          landlordId,
        property_name:
          property.property_name || '',
        room_name:
          roomName,
        room_status:
          'vacant',
        account_status:
          'active',
        rent_amount:
          rentAmount,
        management_fee:
          managementFee,
        electricity_fee_rate:
          electricityRate,
        equipment_fee_rate:
          equipmentRate,
        payment_day:
          paymentDay,
        monthly_payment_day:
          paymentDay,
        deposit_months:
          depositMonths,
        is_onboarding_room:
          true,
        created_by_user_id:
          userId,
        created_at:
          now,
        updated_at:
          now,
        note:
          ''
      }
    );
  }

  return roomId;
}


// ==================================================
// Data building
// ==================================================

function onboardingBuildData_(
  lineUserId,
  context,
  workspaceId
) {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const workspaceSheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .workspaces
    );

  const workspace =
    onboardingFindRow_(
      workspaceSheet,
      'workspace_id',
      workspaceId
    ) || {};

  const payment =
    onboardingGetObjects_(
      ss.getSheetByName(
        V2_LANDLORD_ONBOARDING_SHEETS_
          .paymentAccounts
      )
    ).find(
      function (row) {
        return (
          onboardingText_(
            row.workspace_id
          ).toUpperCase() ===
            workspaceId &&
          onboardingBoolean_(
            row.is_default
          ) &&
          onboardingActive_(
            row.account_status ||
            'active'
          )
        );
      }
    ) || {};

  let propertyId =
    onboardingText_(
      workspace.first_property_id
    );

  let property =
    propertyId
      ? onboardingFindRow_(
          ss.getSheetByName(
            V2_LANDLORD_ONBOARDING_SHEETS_
              .properties
          ),
          'property_id',
          propertyId
        )
      : null;

  if (!property) {
    property =
      onboardingGetObjects_(
        ss.getSheetByName(
          V2_LANDLORD_ONBOARDING_SHEETS_
            .properties
        )
      ).find(
        function (row) {
          return (
            onboardingText_(
              row.workspace_id
            ).toUpperCase() ===
              workspaceId &&
            onboardingBoolean_(
              row.is_onboarding_property
            )
          );
        }
      ) || {};
  }

  propertyId =
    onboardingText_(
      property.property_id
    );

  let roomId =
    onboardingText_(
      workspace.first_room_id
    );

  let room =
    roomId
      ? onboardingFindRow_(
          ss.getSheetByName(
            V2_LANDLORD_ONBOARDING_SHEETS_
              .rooms
          ),
          'room_id',
          roomId
        )
      : null;

  if (!room) {
    room =
      onboardingGetObjects_(
        ss.getSheetByName(
          V2_LANDLORD_ONBOARDING_SHEETS_
            .rooms
        )
      ).find(
        function (row) {
          return (
            onboardingText_(
              row.workspace_id
            ).toUpperCase() ===
              workspaceId &&
            (
              !propertyId ||
              onboardingText_(
                row.property_id
              ) ===
                propertyId
            ) &&
            onboardingBoolean_(
              row.is_onboarding_room
            )
          );
        }
      ) || {};
  }

  const paymentCompleted =
    Boolean(
      onboardingText_(
        payment.payment_account_id
      ) &&
      onboardingText_(
        payment.bank_code
      ) &&
      onboardingText_(
        payment.bank_account
      ) &&
      onboardingText_(
        payment.bank_account_name
      )
    );

  const propertyCompleted =
    Boolean(
      onboardingText_(
        property.property_id
      ) &&
      onboardingText_(
        property.property_name
      ) &&
      onboardingText_(
        property.property_address ||
        property.address
      )
    );

  const roomCompleted =
    Boolean(
      onboardingText_(
        room.room_id
      ) &&
      onboardingText_(
        room.room_name
      ) &&
      onboardingMoney_(
        room.rent_amount
      ) > 0
    );

  let currentStep =
    'payment';

  if (paymentCompleted) {
    currentStep =
      'property';
  }

  if (
    paymentCompleted &&
    propertyCompleted
  ) {
    currentStep =
      'room';
  }

  if (
    paymentCompleted &&
    propertyCompleted &&
    roomCompleted
  ) {
    currentStep =
      'review';
  }

  const completed =
    workspaceOnboardingComplete_(
      workspace.onboarding_status
    );

  if (completed) {
    currentStep =
      'completed';
  }

  return {
    user:
      context.user || {},
    workspace:
      context.active_workspace || {},
    membership:
      context.active_membership || {},
    permissions:
      context.permissions || {},
    progress: {
      current_step:
        currentStep,
      payment_completed:
        paymentCompleted,
      property_completed:
        propertyCompleted,
      room_completed:
        roomCompleted,
      completed:
        completed,
      onboarding_status:
        workspace.onboarding_status ||
        'pending'
    },
    payment: {
      payment_account_id:
        payment.payment_account_id || '',
      bank_code:
        payment.bank_code || '',
      bank_name:
        payment.bank_name || '',
      branch_name:
        payment.branch_name || '',
      bank_account:
        payment.bank_account || '',
      bank_account_name:
        payment.bank_account_name || '',
      payment_note:
        payment.payment_note || ''
    },
    property: {
      property_id:
        property.property_id || '',
      property_name:
        property.property_name || '',
      city:
        property.city || '',
      district:
        property.district || '',
      property_address:
        property.property_address ||
        property.address ||
        '',
      property_type:
        property.property_type ||
        'apartment'
    },
    room: {
      room_id:
        room.room_id || '',
      property_id:
        room.property_id ||
        property.property_id ||
        '',
      room_name:
        room.room_name || '',
      rent_amount:
        onboardingMoney_(
          room.rent_amount
        ),
      management_fee:
        onboardingMoney_(
          room.management_fee
        ),
      electricity_fee_rate:
        onboardingMoney_(
          room.electricity_fee_rate
        ),
      equipment_fee_rate:
        onboardingMoney_(
          room.equipment_fee_rate
        ),
      payment_day:
        Number(
          room.payment_day ||
          room.monthly_payment_day ||
          10
        ),
      deposit_months:
        Number(
          room.deposit_months ||
          2
        )
    }
  };
}


// ==================================================
// Schema and relations
// ==================================================

function onboardingEnsureSchema_() {
  if (
    typeof workspaceEnsureSchema_ ===
    'function'
  ) {
    workspaceEnsureSchema_();
  }

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  onboardingEnsureSheet_(
    ss,
    V2_LANDLORD_ONBOARDING_SHEETS_
      .paymentAccounts,
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

  onboardingEnsureSheet_(
    ss,
    V2_LANDLORD_ONBOARDING_SHEETS_
      .properties,
    [
      'property_id',
      'workspace_id',
      'landlord_id',
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
      'created_at',
      'updated_at',
      'note'
    ]
  );

  onboardingEnsureSheet_(
    ss,
    V2_LANDLORD_ONBOARDING_SHEETS_
      .rooms,
    [
      'room_id',
      'workspace_id',
      'property_id',
      'landlord_id',
      'property_name',
      'room_name',
      'room_status',
      'account_status',
      'rent_amount',
      'management_fee',
      'electricity_fee_rate',
      'equipment_fee_rate',
      'payment_day',
      'monthly_payment_day',
      'deposit_months',
      'is_onboarding_room',
      'created_by_user_id',
      'created_at',
      'updated_at',
      'note'
    ]
  );

  onboardingEnsureHeaders_(
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .workspaces
    ),
    [
      'onboarding_step',
      'onboarding_completed_at',
      'default_payment_account_id',
      'first_property_id',
      'first_room_id'
    ]
  );

  onboardingEnsureHeaders_(
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .landlords
    ),
    [
      'bank_code',
      'bank_name',
      'bank_branch',
      'bank_account',
      'bank_account_name',
      'payment_note',
      'default_payment_account_id',
      'onboarding_completed_at'
    ]
  );

  return true;
}


function onboardingSetWorkspaceProgress_(
  ss,
  workspaceId,
  step,
  targetId
) {
  const sheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .workspaces
    );

  const workspace =
    onboardingFindRow_(
      sheet,
      'workspace_id',
      workspaceId
    );

  if (!workspace) {
    throw new Error(
      '找不到管理團隊'
    );
  }

  const values = {
    onboarding_status:
      'in_progress',
    onboarding_step:
      step,
    updated_at:
      new Date()
  };

  if (step === 'payment') {
    values.default_payment_account_id =
      targetId;
  }

  if (step === 'property') {
    values.first_property_id =
      targetId;
  }

  if (step === 'room') {
    values.first_room_id =
      targetId;
  }

  onboardingSetValues_(
    sheet,
    workspace.__row_number,
    values
  );
}


function onboardingResolveLandlord_(
  ss,
  lineUserId,
  workspaceId
) {
  const sheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .landlords
    );

  const rows =
    onboardingGetObjects_(
      sheet
    );

  /*
   * 多 Workspace 時必須先用 workspace_id 精準匹配。
   *
   * 舊版邏輯使用 sameLine || sameWorkspace，當同一房東建立第二個
   * Workspace 時，可能先命中第一個 Workspace 的 landlord row。
   */
  const workspaceMatch =
    rows.find(
      function (row) {
        return (
          onboardingText_(
            row.workspace_id
          ).toUpperCase() ===
          workspaceId
        );
      }
    );

  if (workspaceMatch) {
    return workspaceMatch;
  }

  /*
   * 僅供尚未完成 Workspace 遷移的舊資料 fallback。
   */
  return rows.find(
    function (row) {
      return (
        onboardingText_(
          row.line_user_id ||
          row.landlord_line_user_id
        ) ===
        lineUserId
      );
    }
  ) || null;
}


function onboardingUpsertPropertyOwner_(
  ss,
  workspaceId,
  propertyId,
  userId,
  landlord
) {
  const sheet =
    ss.getSheetByName(
      V2_LANDLORD_ONBOARDING_SHEETS_
        .propertyOwners
    );

  const existing =
    onboardingGetObjects_(
      sheet
    ).find(
      function (row) {
        return (
          onboardingText_(
            row.workspace_id
          ).toUpperCase() ===
            workspaceId &&
          onboardingText_(
            row.property_id
          ) ===
            propertyId &&
          onboardingText_(
            row.owner_user_id
          ) ===
            userId
        );
      }
    );

  const now =
    new Date();

  const values = {
    workspace_id:
      workspaceId,
    property_id:
      propertyId,
    owner_user_id:
      userId,
    owner_name:
      landlord.landlord_name ||
      '',
    owner_phone:
      landlord.landlord_phone ||
      '',
    ownership_percentage:
      100,
    is_primary_owner:
      true,
    payment_recipient:
      true,
    updated_at:
      now,
    note:
      'Created during onboarding'
  };

  if (existing) {
    onboardingSetValues_(
      sheet,
      existing.__row_number,
      values
    );

    return;
  }

  onboardingAppend_(
    sheet,
    Object.assign(
      {
        property_owner_id:
          onboardingNextId_(
            sheet,
            'property_owner_id',
            'PO',
            6
          ),
        created_at:
          now
      },
      values
    )
  );
}


function onboardingCheckPermission_(
  context
) {
  const membership =
    context.active_membership || {};

  const role =
    onboardingText_(
      membership.role
    ).toLowerCase();

  const permissions =
    context.permissions || {};

  if (
    [
      'owner',
      'admin'
    ].indexOf(role) >= 0 ||
    onboardingBoolean_(
      permissions.can_edit_bank_account
    )
  ) {
    return {
      success: true
    };
  }

  return onboardingResult_(
    false,
    'PERMISSION_DENIED',
    '目前的團隊角色沒有執行初始設定的權限'
  );
}


// ==================================================
// Sheet utilities
// ==================================================

function onboardingEnsureSheet_(
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

    return sheet;
  }

  onboardingEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


function onboardingEnsureHeaders_(
  sheet,
  headers
) {
  if (!sheet) {
    return;
  }

  if (
    sheet.getLastColumn() < 1
  ) {
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

    return;
  }

  const current =
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
        onboardingText_
      );

  if (
    current.every(
      function (value) {
        return value === '';
      }
    )
  ) {
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

    return;
  }

  headers.forEach(
    function (header) {
      if (
        current.indexOf(
          header
        ) === -1
      ) {
        const column =
          sheet.getLastColumn() +
          1;

        sheet
          .getRange(
            1,
            column
          )
          .setValue(
            header
          );

        current.push(
          header
        );
      }
    }
  );
}


function onboardingGetObjects_(
  sheet
) {
  if (
    !sheet ||
    sheet.getLastRow() < 2 ||
    sheet.getLastColumn() < 1
  ) {
    return [];
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      onboardingText_
    );

  return values
    .slice(1)
    .map(
      function (row, index) {
        const item = {
          __row_number:
            index + 2
        };

        headers.forEach(
          function (
            header,
            column
          ) {
            if (header) {
              item[header] =
                row[column];
            }
          }
        );

        return item;
      }
    );
}


function onboardingFindRow_(
  sheet,
  header,
  value
) {
  const target =
    onboardingText_(
      value
    ).toUpperCase();

  return onboardingGetObjects_(
    sheet
  ).find(
    function (row) {
      return (
        onboardingText_(
          row[header]
        ).toUpperCase() ===
        target
      );
    }
  ) || null;
}


function onboardingHeaderMap_(
  sheet
) {
  const values =
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
      .getValues()[0];

  const map = {};

  values.forEach(
    function (
      value,
      index
    ) {
      const header =
        onboardingText_(
          value
        );

      if (header) {
        map[header] =
          index;
      }
    }
  );

  return map;
}


function onboardingSetValue_(
  sheet,
  rowNumber,
  header,
  value
) {
  onboardingEnsureHeaders_(
    sheet,
    [
      header
    ]
  );

  const map =
    onboardingHeaderMap_(
      sheet
    );

  sheet
    .getRange(
      rowNumber,
      map[header] + 1
    )
    .setValue(
      value
    );
}


function onboardingSetValues_(
  sheet,
  rowNumber,
  values
) {
  Object.keys(
    values || {}
  ).forEach(
    function (header) {
      onboardingSetValue_(
        sheet,
        rowNumber,
        header,
        values[header]
      );
    }
  );
}


function onboardingAppend_(
  sheet,
  record
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
        onboardingText_
      );

  sheet.appendRow(
    headers.map(
      function (header) {
        return (
          record[header] !==
          undefined
            ? record[header]
            : ''
        );
      }
    )
  );
}


function onboardingNextId_(
  sheet,
  header,
  prefix,
  digits
) {
  let maxValue = 0;

  onboardingGetObjects_(
    sheet
  ).forEach(
    function (row) {
      const value =
        onboardingText_(
          row[header]
        );

      const match =
        value.match(
          new RegExp(
            '^' +
            prefix +
            '(\\d+)$',
            'i'
          )
        );

      if (match) {
        maxValue =
          Math.max(
            maxValue,
            Number(
              match[1]
            ) || 0
          );
      }
    }
  );

  return (
    prefix +
    String(
      maxValue + 1
    ).padStart(
      digits || 6,
      '0'
    )
  );
}


// ==================================================
// General utilities
// ==================================================

function onboardingText_(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value).trim();
}


function onboardingMoney_(
  value
) {
  const number =
    Number(
      value || 0
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return Math.round(
    number * 100
  ) / 100;
}


function onboardingBoolean_(
  value
) {
  if (
    value === true ||
    value === 1
  ) {
    return true;
  }

  return (
    [
      'true',
      '1',
      'yes',
      'y',
      '是'
    ].indexOf(
      onboardingText_(
        value
      ).toLowerCase()
    ) >= 0
  );
}


function onboardingActive_(
  value
) {
  return (
    [
      'active',
      'enabled',
      'valid',
      'current',
      '啟用',
      '有效'
    ].indexOf(
      onboardingText_(
        value
      ).toLowerCase()
    ) >= 0
  );
}


function onboardingResult_(
  success,
  code,
  message,
  data
) {
  return {
    success:
      success === true,
    code:
      code || '',
    message:
      message || '',
    data:
      data === undefined
        ? null
        : data
  };
}


function onboardingLogAccess_(
  payload
) {
  if (
    typeof logLiffAccess_ ===
    'function'
  ) {
    try {
      logLiffAccess_(
        payload
      );
    } catch (error) {
      // 不影響主要流程。
    }
  }
}


// ==================================================
// Tests
// ==================================================

function testEnsureV2LandlordOnboardingSchema() {
  onboardingEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const result = {};

  [
    V2_LANDLORD_ONBOARDING_SHEETS_
      .paymentAccounts,
    V2_LANDLORD_ONBOARDING_SHEETS_
      .properties,
    V2_LANDLORD_ONBOARDING_SHEETS_
      .rooms
  ].forEach(
    function (sheetName) {
      const sheet =
        ss.getSheetByName(
          sheetName
        );

      result[sheetName] = {
        exists:
          Boolean(sheet),
        rows:
          sheet
            ? sheet.getLastRow()
            : 0,
        columns:
          sheet
            ? sheet.getLastColumn()
            : 0
      };
    }
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


function testLandlordOnboardingInit() {
  const result =
    getLandlordOnboardingInitByLineUid_(
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
