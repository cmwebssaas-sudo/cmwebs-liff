/**
 * CMWebs V2 Workspace / Team Foundation
 *
 * 目的：
 * - 將「房東帳號」與「共同管理空間」分離。
 * - 同一個工作區可由多位成員共同管理同一物件與房間。
 * - 保留 V2_landlords / landlord_id，讓現有頁面與 API 可以逐步遷移。
 *
 * Code.gs API 路由：
 * - landlord_entry_status
 * - landlord_register_submit
 * - landlord_workspace_context
 * - landlord_workspace_switch
 *
 * 第一階段建立的資料表：
 * - V2_users
 * - V2_landlords
 * - V2_workspaces
 * - V2_workspace_members
 * - V2_workspace_invitations
 * - V2_member_scopes
 * - V2_property_owners
 * - V2_workspace_activity_logs
 */

const V2_WORKSPACE_SHEETS_ = {
  users: 'V2_users',
  landlords: 'V2_landlords',
  landlordHomeView: 'V2_landlord_home_view',
  landlordTenantListView: 'V2_landlord_tenant_list_view',

  workspaces: 'V2_workspaces',
  members: 'V2_workspace_members',
  invitations: 'V2_workspace_invitations',
  memberScopes: 'V2_member_scopes',
  propertyOwners: 'V2_property_owners',
  activityLogs: 'V2_workspace_activity_logs'
};

const V2_WORKSPACE_TIMEZONE_ = 'Asia/Taipei';

const V2_WORKSPACE_ROLES_ = [
  'owner',
  'admin',
  'manager',
  'accountant',
  'maintenance',
  'viewer'
];


// ==================================================
// Public API
// ==================================================

/**
 * 房東 LIFF 入口狀態。
 *
 * route：
 * - register：尚未建立帳號
 * - onboarding：已建立帳號與工作區，但尚未完成初始設定
 * - home：已完成初始設定
 * - blocked：帳號、工作區或成員資格停用
 */
function getLandlordEntryStatusByLineUid_(lineUserId) {
  const action = 'landlord_entry_status';
  let lock = null;
  let locked = false;

  try {
    lineUserId = workspaceText_(lineUserId);

    if (!lineUserId) {
      return workspaceResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID',
        workspaceEmptyEntryData_()
      );
    }

    workspaceEnsureSchema_();

    lock = LockService.getScriptLock();
    lock.waitLock(15000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 舊版房東首次進入時，自動建立工作區與 owner membership。
    workspaceEnsureLegacyLandlordContext_(ss, lineUserId);

    const context = workspaceResolveContextByLineUid_(ss, lineUserId);

    if (!context.user) {
      workspaceLogAccess_({
        lineUserId: lineUserId,
        userId: '',
        role: 'landlord',
        action: action,
        targetId: '',
        result: 'success',
        errorMessage: '',
        notes: 'route=register'
      });

      return workspaceResult_(
        true,
        'REGISTRATION_REQUIRED',
        '尚未建立房東帳號',
        {
          registered: false,
          account_active: false,
          route: 'register',
          user: null,
          active_workspace: null,
          active_membership: null,
          workspaces: []
        }
      );
    }

    const userStatus = workspaceText_(
      context.user.account_status || 'active'
    ).toLowerCase();

    const userActive = workspaceIsActiveStatus_(userStatus);

    if (!userActive) {
      return workspaceResult_(
        true,
        'USER_ACCOUNT_INACTIVE',
        '房東帳號目前不是啟用狀態',
        workspaceBuildEntryData_(context, 'blocked', false)
      );
    }

    if (!context.activeWorkspace || !context.activeMembership) {
      return workspaceResult_(
        true,
        'WORKSPACE_REQUIRED',
        '尚未建立或加入管理團隊',
        workspaceBuildEntryData_(context, 'onboarding', true)
      );
    }

    const workspaceStatus = workspaceText_(
      context.activeWorkspace.account_status || 'active'
    ).toLowerCase();

    const memberStatus = workspaceText_(
      context.activeMembership.member_status || 'active'
    ).toLowerCase();

    if (
      !workspaceIsActiveStatus_(workspaceStatus) ||
      !workspaceIsActiveStatus_(memberStatus)
    ) {
      return workspaceResult_(
        true,
        'WORKSPACE_ACCESS_INACTIVE',
        '目前的管理團隊或成員資格不是啟用狀態',
        workspaceBuildEntryData_(context, 'blocked', true)
      );
    }

    const onboardingStatus = workspaceText_(
      context.activeWorkspace.onboarding_status || 'pending'
    ).toLowerCase();

    const route = workspaceOnboardingComplete_(onboardingStatus)
      ? 'home'
      : 'onboarding';

    workspaceLogAccess_({
      lineUserId: lineUserId,
      userId: context.user.user_id || '',
      role: 'landlord',
      action: action,
      targetId: context.activeWorkspace.workspace_id || '',
      result: 'success',
      errorMessage: '',
      notes: 'route=' + route
    });

    return workspaceResult_(
      true,
      route === 'home'
        ? 'READY'
        : 'ONBOARDING_REQUIRED',
      route === 'home'
        ? '已完成房東登入準備'
        : '請完成管理團隊初始設定',
      workspaceBuildEntryData_(context, route, true)
    );

  } catch (error) {
    workspaceLogAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'landlord',
      action: action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return workspaceResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' + error.message,
      workspaceEmptyEntryData_()
    );

  } finally {
    if (locked && lock) {
      lock.releaseLock();
    }
  }
}


/**
 * 新房東自行註冊。
 *
 * 一次建立：
 * - V2_users
 * - V2_landlords（舊系統相容）
 * - V2_workspaces
 * - V2_workspace_members（owner）
 */
function registerLandlordWorkspaceByLineUid_(
  lineUserId,
  landlordName,
  phone,
  email,
  workspaceName,
  profileDisplayName,
  profilePictureUrl
) {
  const action = 'landlord_register_submit';
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lineUserId = workspaceText_(lineUserId);
    landlordName = workspaceText_(landlordName);
    phone = workspaceNormalizeTaiwanPhone_(phone);
    email = workspaceText_(email).toLowerCase();
    workspaceName = workspaceText_(workspaceName);
    profileDisplayName = workspaceText_(profileDisplayName);
    profilePictureUrl = workspaceText_(profilePictureUrl);

    if (!lineUserId) {
      return workspaceResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID'
      );
    }

    if (!landlordName || landlordName.length > 60) {
      return workspaceResult_(
        false,
        'INVALID_LANDLORD_NAME',
        '請輸入 1 至 60 字的姓名'
      );
    }

    if (!/^09\d{8}$/.test(phone)) {
      return workspaceResult_(
        false,
        'INVALID_PHONE',
        '請輸入正確的台灣手機號碼，例如 0912345678'
      );
    }

    if (email && !workspaceValidEmail_(email)) {
      return workspaceResult_(
        false,
        'INVALID_EMAIL',
        'Email 格式不正確'
      );
    }

    if (!workspaceName) {
      workspaceName = landlordName + '的管理團隊';
    }

    if (workspaceName.length > 80) {
      return workspaceResult_(
        false,
        'WORKSPACE_NAME_TOO_LONG',
        '管理團隊名稱最多 80 字'
      );
    }

    workspaceEnsureSchema_();

    lock.waitLock(20000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 舊房東不應建立第二組帳號，先執行相容遷移。
    workspaceEnsureLegacyLandlordContext_(ss, lineUserId);

    const existingContext = workspaceResolveContextByLineUid_(
      ss,
      lineUserId
    );

    if (existingContext.user) {
      return workspaceResult_(
        true,
        'ALREADY_REGISTERED',
        '此 LINE 帳號已建立房東帳號',
        workspaceBuildEntryData_(
          existingContext,
          existingContext.activeWorkspace &&
          workspaceOnboardingComplete_(
            existingContext.activeWorkspace.onboarding_status
          )
            ? 'home'
            : 'onboarding',
          true
        )
      );
    }

    const usersSheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.users
    );

    const existingPhoneUser = workspaceGetObjectsWithRow_(
      usersSheet
    ).find(function (row) {
      const rowRole = workspaceText_(row.role).toLowerCase();
      const rowPhone = workspaceNormalizeTaiwanPhone_(
        row.phone ||
        row.mobile ||
        row.user_phone ||
        row.landlord_phone
      );

      return (
        rowRole === 'landlord' &&
        rowPhone === phone
      );
    });

    if (existingPhoneUser) {
      return workspaceResult_(
        false,
        'PHONE_ALREADY_REGISTERED',
        '此手機號碼已建立房東帳號，請使用原本的 LINE 帳號登入或聯絡系統管理員'
      );
    }

    const now = new Date();
    const userId = workspaceNextId_(usersSheet, 'user_id', 'U', 6);

    const workspaceSheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.workspaces
    );
    const workspaceId = workspaceNextId_(
      workspaceSheet,
      'workspace_id',
      'W',
      6
    );

    const memberSheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.members
    );
    const membershipId = workspaceNextId_(
      memberSheet,
      'membership_id',
      'WM',
      6
    );

    const landlordSheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.landlords
    );
    const landlordId = workspaceNextId_(
      landlordSheet,
      'landlord_id',
      'L',
      6
    );

    workspaceAppendObject_(usersSheet, {
      user_id: userId,
      created_at: now,
      updated_at: now,
      role: 'landlord',
      name: landlordName,
      phone: phone,
      email: email,
      line_user_id: lineUserId,
      account_status: 'active',
      active_workspace_id: workspaceId,
      profile_display_name: profileDisplayName,
      profile_picture_url: profilePictureUrl,
      note: ''
    });

    workspaceAppendObject_(workspaceSheet, {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      workspace_type: 'rental_management',
      account_status: 'active',
      onboarding_status: 'pending',
      created_by_user_id: userId,
      default_currency: 'TWD',
      timezone: V2_WORKSPACE_TIMEZONE_,
      created_at: now,
      updated_at: now,
      note: ''
    });

    workspaceAppendObject_(memberSheet, Object.assign(
      {
        membership_id: membershipId,
        workspace_id: workspaceId,
        user_id: userId,
        role: 'owner',
        member_status: 'active',
        is_primary: true,
        joined_at: now,
        invited_by_user_id: '',
        created_at: now,
        updated_at: now,
        display_name: landlordName,
        line_user_id: lineUserId,
        phone: phone,
        email: email,
        note: ''
      },
      workspaceDefaultPermissions_('owner')
    ));

    // 保留 legacy landlord row，讓目前 landlord_home / arrears / tenants 等頁面可繼續使用。
    workspaceAppendObject_(landlordSheet, {
      landlord_id: landlordId,
      created_at: now,
      updated_at: now,
      landlord_user_id: userId,
      user_id: userId,
      landlord_line_user_id: lineUserId,
      line_user_id: lineUserId,
      landlord_name: landlordName,
      landlord_phone: phone,
      landlord_email: email,
      workspace_id: workspaceId,
      account_status: 'active',
      onboarding_status: 'pending',
      note: 'Created by landlord self-registration'
    });

    SpreadsheetApp.flush();

    workspaceWriteActivityLog_({
      workspace_id: workspaceId,
      user_id: userId,
      membership_id: membershipId,
      line_user_id: lineUserId,
      action: 'landlord_registered',
      target_type: 'workspace',
      target_id: workspaceId,
      result: 'success',
      detail: 'landlord_id=' + landlordId
    });

    workspaceLogAccess_({
      lineUserId: lineUserId,
      userId: userId,
      role: 'landlord',
      action: action,
      targetId: workspaceId,
      result: 'success',
      errorMessage: '',
      notes: 'registration completed'
    });

    return workspaceResult_(
      true,
      'REGISTERED',
      '房東帳號與管理團隊已建立',
      {
        registered: true,
        account_active: true,
        route: 'onboarding',
        user: {
          user_id: userId,
          name: landlordName,
          phone: phone,
          email: email,
          line_user_id: lineUserId,
          account_status: 'active',
          active_workspace_id: workspaceId
        },
        landlord: {
          landlord_id: landlordId
        },
        active_workspace: {
          workspace_id: workspaceId,
          workspace_name: workspaceName,
          workspace_type: 'rental_management',
          account_status: 'active',
          onboarding_status: 'pending'
        },
        active_membership: {
          membership_id: membershipId,
          role: 'owner',
          member_status: 'active'
        },
        workspaces: [
          {
            workspace_id: workspaceId,
            workspace_name: workspaceName,
            role: 'owner',
            member_status: 'active',
            onboarding_status: 'pending',
            is_active: true
          }
        ]
      }
    );

  } catch (error) {
    workspaceLogAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'landlord',
      action: action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return workspaceResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' + error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * 取得目前工作區與權限內容。
 */
function getLandlordWorkspaceContextByLineUid_(lineUserId) {
  const action = 'landlord_workspace_context';

  try {
    lineUserId = workspaceText_(lineUserId);

    if (!lineUserId) {
      return workspaceResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID'
      );
    }

    workspaceEnsureSchema_();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const context = workspaceResolveContextByLineUid_(ss, lineUserId);

    if (!context.user) {
      return workspaceResult_(
        false,
        'REGISTRATION_REQUIRED',
        '尚未建立房東帳號'
      );
    }

    if (!context.activeWorkspace || !context.activeMembership) {
      return workspaceResult_(
        false,
        'WORKSPACE_ACCESS_NOT_FOUND',
        '找不到可使用的管理團隊'
      );
    }

    workspaceLogAccess_({
      lineUserId: lineUserId,
      userId: context.user.user_id || '',
      role: 'landlord',
      action: action,
      targetId: context.activeWorkspace.workspace_id || '',
      result: 'success',
      errorMessage: ''
    });

    return workspaceResult_(
      true,
      'OK',
      '查詢成功',
      workspaceBuildContextData_(context)
    );

  } catch (error) {
    return workspaceResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' + error.message
    );
  }
}


/**
 * 切換目前工作區。
 */
function setLandlordActiveWorkspaceByLineUid_(lineUserId, workspaceId) {
  const action = 'landlord_workspace_switch';
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lineUserId = workspaceText_(lineUserId);
    workspaceId = workspaceText_(workspaceId).toUpperCase();

    if (!lineUserId) {
      return workspaceResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID'
      );
    }

    if (!workspaceId) {
      return workspaceResult_(
        false,
        'MISSING_WORKSPACE_ID',
        '缺少管理團隊 ID'
      );
    }

    workspaceEnsureSchema_();

    lock.waitLock(15000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const context = workspaceResolveContextByLineUid_(ss, lineUserId);

    if (!context.user) {
      return workspaceResult_(
        false,
        'REGISTRATION_REQUIRED',
        '尚未建立房東帳號'
      );
    }

    const membership = context.memberships.find(function (item) {
      return (
        workspaceText_(item.workspace_id).toUpperCase() === workspaceId &&
        workspaceIsActiveStatus_(item.member_status || 'active')
      );
    });

    if (!membership) {
      return workspaceResult_(
        false,
        'WORKSPACE_ACCESS_DENIED',
        '您沒有此管理團隊的使用權限'
      );
    }

    const workspace = context.workspaceRows.find(function (item) {
      return workspaceText_(item.workspace_id).toUpperCase() === workspaceId;
    });

    if (!workspace || !workspaceIsActiveStatus_(workspace.account_status || 'active')) {
      return workspaceResult_(
        false,
        'WORKSPACE_INACTIVE',
        '管理團隊目前不是啟用狀態'
      );
    }

    const usersSheet = ss.getSheetByName(V2_WORKSPACE_SHEETS_.users);

    workspaceSetFirstExistingOrCreate_(
      usersSheet,
      context.user.__row_number,
      ['active_workspace_id'],
      'active_workspace_id',
      workspaceId
    );

    workspaceSetFirstExistingOrCreate_(
      usersSheet,
      context.user.__row_number,
      ['updated_at'],
      'updated_at',
      new Date()
    );

    SpreadsheetApp.flush();

    workspaceWriteActivityLog_({
      workspace_id: workspaceId,
      user_id: context.user.user_id || '',
      membership_id: membership.membership_id || '',
      line_user_id: lineUserId,
      action: 'workspace_switched',
      target_type: 'workspace',
      target_id: workspaceId,
      result: 'success',
      detail: ''
    });

    const refreshedContext = workspaceResolveContextByLineUid_(ss, lineUserId);

    return workspaceResult_(
      true,
      'WORKSPACE_SWITCHED',
      '已切換管理團隊',
      workspaceBuildContextData_(refreshedContext)
    );

  } catch (error) {
    workspaceLogAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'landlord',
      action: action,
      targetId: workspaceId || '',
      result: 'failed',
      errorMessage: error.message
    });

    return workspaceResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' + error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


// ==================================================
// Legacy landlord migration
// ==================================================

/**
 * 將現有 V2_landlords 自動建立為一人工作區。
 * 重複執行不會重複建立。
 */
function migrateExistingLandlordsToWorkspaces_() {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    workspaceEnsureSchema_();

    lock.waitLock(30000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const landlordSheet = ss.getSheetByName(V2_WORKSPACE_SHEETS_.landlords);
    const landlords = workspaceGetObjectsWithRow_(landlordSheet);

    let migratedCount = 0;
    let skippedCount = 0;
    const details = [];

    landlords.forEach(function (landlord) {
      const lineUserId = workspaceText_(
        landlord.landlord_line_user_id ||
        landlord.line_user_id
      );

      if (!lineUserId) {
        skippedCount++;
        details.push({
          landlord_id: landlord.landlord_id || '',
          result: 'skipped',
          message: 'missing line_user_id'
        });
        return;
      }

      const result = workspaceEnsureLegacyLandlordContext_(
        ss,
        lineUserId
      );

      if (result && result.created) {
        migratedCount++;
        details.push({
          landlord_id: landlord.landlord_id || '',
          workspace_id: result.workspace_id || '',
          result: 'migrated'
        });
      } else {
        skippedCount++;
        details.push({
          landlord_id: landlord.landlord_id || '',
          workspace_id: result ? result.workspace_id || '' : '',
          result: 'already_ready'
        });
      }
    });

    SpreadsheetApp.flush();

    return workspaceResult_(
      true,
      'MIGRATION_COMPLETED',
      '現有房東工作區遷移完成',
      {
        landlord_count: landlords.length,
        migrated_count: migratedCount,
        skipped_count: skippedCount,
        details: details
      }
    );

  } catch (error) {
    return workspaceResult_(
      false,
      'MIGRATION_ERROR',
      '遷移失敗：' + error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * 為單一舊版房東建立 user / workspace / owner membership。
 */
function workspaceEnsureLegacyLandlordContext_(ss, lineUserId) {
  const landlordSheet = ss.getSheetByName(V2_WORKSPACE_SHEETS_.landlords);
  const landlordRows = workspaceGetObjectsWithRow_(landlordSheet);

  const landlord = landlordRows.find(function (row) {
    return workspaceText_(
      row.landlord_line_user_id || row.line_user_id
    ) === lineUserId;
  });

  if (!landlord) {
    return null;
  }

  const usersSheet = ss.getSheetByName(V2_WORKSPACE_SHEETS_.users);
  const workspaceSheet = ss.getSheetByName(V2_WORKSPACE_SHEETS_.workspaces);
  const memberSheet = ss.getSheetByName(V2_WORKSPACE_SHEETS_.members);

  const userRows = workspaceGetObjectsWithRow_(usersSheet);
  const preferredUserId = workspaceText_(
    landlord.landlord_user_id || landlord.user_id
  );

  let user = userRows.find(function (row) {
    return workspaceText_(row.line_user_id) === lineUserId;
  });

  // 舊資料可能已有 user_id，但尚未寫入 LINE UID。
  if (!user && preferredUserId) {
    user = userRows.find(function (row) {
      return workspaceText_(row.user_id) === preferredUserId;
    }) || null;

    if (user) {
      workspaceSetFirstExistingOrCreate_(
        usersSheet,
        user.__row_number,
        ['line_user_id'],
        'line_user_id',
        lineUserId
      );

      workspaceSetFirstExistingOrCreate_(
        usersSheet,
        user.__row_number,
        ['role'],
        'role',
        'landlord'
      );

      workspaceSetFirstExistingOrCreate_(
        usersSheet,
        user.__row_number,
        ['account_status'],
        'account_status',
        landlord.account_status || 'active'
      );

      workspaceSetFirstExistingOrCreate_(
        usersSheet,
        user.__row_number,
        ['updated_at'],
        'updated_at',
        new Date()
      );

      user = workspaceGetObjectsWithRow_(usersSheet).find(function (row) {
        return workspaceText_(row.user_id) === preferredUserId;
      }) || user;
    }
  }

  const now = new Date();
  let created = false;

  if (!user) {
    const userId = preferredUserId ||
      workspaceNextId_(usersSheet, 'user_id', 'U', 6);

    workspaceAppendObject_(usersSheet, {
      user_id: userId,
      created_at: landlord.created_at || now,
      updated_at: now,
      role: 'landlord',
      name:
        landlord.landlord_name ||
        landlord.name ||
        '房東',
      phone:
        landlord.landlord_phone ||
        landlord.phone ||
        '',
      email:
        landlord.landlord_email ||
        landlord.email ||
        '',
      line_user_id: lineUserId,
      account_status:
        landlord.account_status || 'active',
      active_workspace_id: '',
      profile_display_name: '',
      profile_picture_url: '',
      note: 'Migrated from V2_landlords'
    });

    user = workspaceGetObjectsWithRow_(usersSheet).find(function (row) {
      return workspaceText_(row.user_id) === userId;
    });

    created = true;
  }

  const userId = workspaceText_(user.user_id);
  const memberRows = workspaceGetObjectsWithRow_(memberSheet);

  let memberships = memberRows.filter(function (row) {
    return workspaceText_(row.user_id) === userId;
  });

  let workspaceId = workspaceText_(landlord.workspace_id).toUpperCase();

  if (!workspaceId && memberships.length > 0) {
    workspaceId = workspaceText_(memberships[0].workspace_id).toUpperCase();
  }

  const workspaceRows = workspaceGetObjectsWithRow_(workspaceSheet);
  let workspace = workspaceRows.find(function (row) {
    return workspaceText_(row.workspace_id).toUpperCase() === workspaceId;
  });

  if (!workspace) {
    workspaceId = workspaceNextId_(
      workspaceSheet,
      'workspace_id',
      'W',
      6
    );

    const legacyStats = workspaceResolveLegacyLandlordStats_(
      ss,
      lineUserId,
      landlord.landlord_id
    );

    const onboardingStatus = (
      legacyStats.room_count > 0 ||
      legacyStats.tenant_count > 0
    )
      ? 'completed'
      : workspaceText_(landlord.onboarding_status || 'pending');

    workspaceAppendObject_(workspaceSheet, {
      workspace_id: workspaceId,
      workspace_name:
        workspaceText_(landlord.workspace_name) ||
        workspaceText_(landlord.landlord_name || landlord.name) +
          '的管理團隊',
      workspace_type: 'rental_management',
      account_status:
        landlord.account_status || 'active',
      onboarding_status:
        onboardingStatus || 'pending',
      created_by_user_id: userId,
      default_currency: 'TWD',
      timezone: V2_WORKSPACE_TIMEZONE_,
      created_at: landlord.created_at || now,
      updated_at: now,
      note: 'Migrated from legacy landlord ' +
        workspaceText_(landlord.landlord_id)
    });

    workspace = workspaceGetObjectsWithRow_(workspaceSheet).find(function (row) {
      return workspaceText_(row.workspace_id) === workspaceId;
    });

    created = true;
  }

  let membership = memberships.find(function (row) {
    return workspaceText_(row.workspace_id).toUpperCase() === workspaceId;
  });

  if (!membership) {
    const membershipId = workspaceNextId_(
      memberSheet,
      'membership_id',
      'WM',
      6
    );

    workspaceAppendObject_(memberSheet, Object.assign(
      {
        membership_id: membershipId,
        workspace_id: workspaceId,
        user_id: userId,
        role: 'owner',
        member_status: 'active',
        is_primary: true,
        joined_at: landlord.created_at || now,
        invited_by_user_id: '',
        created_at: landlord.created_at || now,
        updated_at: now,
        display_name:
          landlord.landlord_name ||
          landlord.name ||
          '',
        line_user_id: lineUserId,
        phone:
          landlord.landlord_phone ||
          landlord.phone ||
          '',
        email:
          landlord.landlord_email ||
          landlord.email ||
          '',
        note: 'Migrated owner membership'
      },
      workspaceDefaultPermissions_('owner')
    ));

    membership = workspaceGetObjectsWithRow_(memberSheet).find(function (row) {
      return workspaceText_(row.membership_id) === membershipId;
    });

    created = true;
  }

  workspaceSetFirstExistingOrCreate_(
    usersSheet,
    user.__row_number,
    ['active_workspace_id'],
    'active_workspace_id',
    workspaceId
  );

  workspaceSetFirstExistingOrCreate_(
    usersSheet,
    user.__row_number,
    ['updated_at'],
    'updated_at',
    now
  );

  workspaceSetFirstExistingOrCreate_(
    landlordSheet,
    landlord.__row_number,
    ['workspace_id'],
    'workspace_id',
    workspaceId
  );

  workspaceSetFirstExistingOrCreate_(
    landlordSheet,
    landlord.__row_number,
    ['landlord_user_id', 'user_id'],
    'landlord_user_id',
    userId
  );

  workspaceSetFirstExistingOrCreate_(
    landlordSheet,
    landlord.__row_number,
    ['updated_at'],
    'updated_at',
    now
  );

  if (created) {
    workspaceWriteActivityLog_({
      workspace_id: workspaceId,
      user_id: userId,
      membership_id: membership ? membership.membership_id || '' : '',
      line_user_id: lineUserId,
      action: 'legacy_landlord_migrated',
      target_type: 'landlord',
      target_id: landlord.landlord_id || '',
      result: 'success',
      detail: ''
    });
  }

  return {
    created: created,
    workspace_id: workspaceId,
    user_id: userId,
    membership_id: membership ? membership.membership_id || '' : ''
  };
}


// ==================================================
// Context resolution
// ==================================================

function workspaceResolveContextByLineUid_(ss, lineUserId) {
  const usersSheet = ss.getSheetByName(V2_WORKSPACE_SHEETS_.users);
  const memberSheet = ss.getSheetByName(V2_WORKSPACE_SHEETS_.members);
  const workspaceSheet = ss.getSheetByName(V2_WORKSPACE_SHEETS_.workspaces);

  const userRows = workspaceGetObjectsWithRow_(usersSheet);
  const memberRows = workspaceGetObjectsWithRow_(memberSheet);
  const workspaceRows = workspaceGetObjectsWithRow_(workspaceSheet);

  const user = userRows.find(function (row) {
    return workspaceText_(row.line_user_id) === lineUserId;
  }) || null;

  if (!user) {
    return {
      user: null,
      memberships: [],
      workspaceRows: workspaceRows,
      activeWorkspace: null,
      activeMembership: null
    };
  }

  const userId = workspaceText_(user.user_id);

  const memberships = memberRows.filter(function (row) {
    return workspaceText_(row.user_id) === userId;
  });

  let activeWorkspaceId = workspaceText_(
    user.active_workspace_id
  ).toUpperCase();

  if (
    !activeWorkspaceId ||
    !memberships.some(function (row) {
      return (
        workspaceText_(row.workspace_id).toUpperCase() === activeWorkspaceId &&
        workspaceIsActiveStatus_(row.member_status || 'active')
      );
    })
  ) {
    const primaryMembership = memberships.find(function (row) {
      return (
        workspaceBoolean_(row.is_primary) &&
        workspaceIsActiveStatus_(row.member_status || 'active')
      );
    });

    const fallbackMembership = memberships.find(function (row) {
      return workspaceIsActiveStatus_(row.member_status || 'active');
    });

    activeWorkspaceId = workspaceText_(
      (primaryMembership || fallbackMembership || {}).workspace_id
    ).toUpperCase();
  }

  const activeMembership = memberships.find(function (row) {
    return workspaceText_(row.workspace_id).toUpperCase() === activeWorkspaceId;
  }) || null;

  const activeWorkspace = workspaceRows.find(function (row) {
    return workspaceText_(row.workspace_id).toUpperCase() === activeWorkspaceId;
  }) || null;

  return {
    user: user,
    memberships: memberships,
    workspaceRows: workspaceRows,
    activeWorkspace: activeWorkspace,
    activeMembership: activeMembership
  };
}


function workspaceBuildEntryData_(context, route, accountActive) {
  return {
    registered: Boolean(context.user),
    account_active: accountActive === true,
    route: route,
    user: context.user
      ? workspaceBuildUserView_(context.user)
      : null,
    active_workspace: context.activeWorkspace
      ? workspaceBuildWorkspaceView_(context.activeWorkspace)
      : null,
    active_membership: context.activeMembership
      ? workspaceBuildMembershipView_(context.activeMembership)
      : null,
    workspaces: workspaceBuildWorkspaceList_(context)
  };
}


function workspaceBuildContextData_(context) {
  return {
    user: workspaceBuildUserView_(context.user),
    active_workspace: workspaceBuildWorkspaceView_(context.activeWorkspace),
    active_membership: workspaceBuildMembershipView_(context.activeMembership),
    permissions: workspaceBuildPermissionView_(context.activeMembership),
    workspaces: workspaceBuildWorkspaceList_(context)
  };
}


function workspaceBuildUserView_(row) {
  return {
    user_id: row.user_id || '',
    role: row.role || '',
    name: row.name || '',
    phone: row.phone || '',
    email: row.email || '',
    line_user_id: row.line_user_id || '',
    account_status: row.account_status || '',
    active_workspace_id: row.active_workspace_id || '',
    profile_display_name: row.profile_display_name || '',
    profile_picture_url: row.profile_picture_url || ''
  };
}


function workspaceBuildWorkspaceView_(row) {
  return {
    workspace_id: row.workspace_id || '',
    workspace_name: row.workspace_name || '',
    workspace_type: row.workspace_type || '',
    account_status: row.account_status || '',
    onboarding_status: row.onboarding_status || '',
    created_by_user_id: row.created_by_user_id || '',
    default_currency: row.default_currency || 'TWD',
    timezone: row.timezone || V2_WORKSPACE_TIMEZONE_,
    created_at: row.created_at || '',
    updated_at: row.updated_at || ''
  };
}


function workspaceBuildMembershipView_(row) {
  return {
    membership_id: row.membership_id || '',
    workspace_id: row.workspace_id || '',
    user_id: row.user_id || '',
    role: row.role || '',
    member_status: row.member_status || '',
    is_primary: workspaceBoolean_(row.is_primary),
    joined_at: row.joined_at || '',
    display_name: row.display_name || ''
  };
}


function workspaceBuildPermissionView_(membership) {
  if (!membership) {
    return workspaceDefaultPermissions_('viewer');
  }

  const defaults = workspaceDefaultPermissions_(membership.role || 'viewer');

  Object.keys(defaults).forEach(function (key) {
    if (membership[key] !== undefined && membership[key] !== '') {
      defaults[key] = workspaceBoolean_(membership[key]);
    }
  });

  return defaults;
}


function workspaceBuildWorkspaceList_(context) {
  const activeWorkspaceId = context.activeWorkspace
    ? workspaceText_(context.activeWorkspace.workspace_id)
    : '';

  return context.memberships.map(function (membership) {
    const workspaceId = workspaceText_(membership.workspace_id);
    const workspace = context.workspaceRows.find(function (row) {
      return workspaceText_(row.workspace_id) === workspaceId;
    }) || {};

    return {
      workspace_id: workspaceId,
      workspace_name: workspace.workspace_name || workspaceId,
      workspace_type: workspace.workspace_type || '',
      account_status: workspace.account_status || '',
      onboarding_status: workspace.onboarding_status || '',
      membership_id: membership.membership_id || '',
      role: membership.role || '',
      member_status: membership.member_status || '',
      is_primary: workspaceBoolean_(membership.is_primary),
      is_active: workspaceId === activeWorkspaceId
    };
  }).sort(function (a, b) {
    if (a.is_active && !b.is_active) {
      return -1;
    }

    if (!a.is_active && b.is_active) {
      return 1;
    }

    return workspaceText_(a.workspace_name).localeCompare(
      workspaceText_(b.workspace_name)
    );
  });
}


function workspaceEmptyEntryData_() {
  return {
    registered: false,
    account_active: false,
    route: 'register',
    user: null,
    active_workspace: null,
    active_membership: null,
    workspaces: []
  };
}


// ==================================================
// Schema
// ==================================================

function workspaceEnsureSchema_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  workspaceEnsureSheet_(ss, V2_WORKSPACE_SHEETS_.users, [
    'user_id',
    'created_at',
    'updated_at',
    'role',
    'name',
    'phone',
    'email',
    'line_user_id',
    'account_status',
    'active_workspace_id',
    'profile_display_name',
    'profile_picture_url',
    'note'
  ]);

  workspaceEnsureSheet_(ss, V2_WORKSPACE_SHEETS_.landlords, [
    'landlord_id',
    'created_at',
    'updated_at',
    'landlord_user_id',
    'user_id',
    'landlord_line_user_id',
    'line_user_id',
    'landlord_name',
    'landlord_phone',
    'landlord_email',
    'workspace_id',
    'account_status',
    'onboarding_status',
    'note'
  ]);

  workspaceEnsureSheet_(ss, V2_WORKSPACE_SHEETS_.workspaces, [
    'workspace_id',
    'workspace_name',
    'workspace_type',
    'account_status',
    'onboarding_status',
    'created_by_user_id',
    'default_currency',
    'timezone',
    'created_at',
    'updated_at',
    'note'
  ]);

  workspaceEnsureSheet_(ss, V2_WORKSPACE_SHEETS_.members, [
    'membership_id',
    'workspace_id',
    'user_id',
    'role',
    'member_status',
    'is_primary',
    'joined_at',
    'invited_by_user_id',
    'created_at',
    'updated_at',
    'display_name',
    'line_user_id',
    'phone',
    'email',
    'can_manage_team',
    'can_edit_bank_account',
    'can_approve_payment',
    'can_edit_contract',
    'can_terminate_contract',
    'can_delete_data',
    'can_export_data',
    'note'
  ]);

  workspaceEnsureSheet_(ss, V2_WORKSPACE_SHEETS_.invitations, [
    'invitation_id',
    'workspace_id',
    'invite_role',
    'invite_phone',
    'invite_email',
    'invite_token',
    'expires_at',
    'status',
    'invited_by_user_id',
    'accepted_by_user_id',
    'accepted_at',
    'created_at',
    'updated_at',
    'note'
  ]);

  workspaceEnsureSheet_(ss, V2_WORKSPACE_SHEETS_.memberScopes, [
    'scope_id',
    'membership_id',
    'workspace_id',
    'scope_type',
    'property_id',
    'room_id',
    'permission_level',
    'created_at',
    'updated_at',
    'note'
  ]);

  workspaceEnsureSheet_(ss, V2_WORKSPACE_SHEETS_.propertyOwners, [
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
  ]);

  workspaceEnsureSheet_(ss, V2_WORKSPACE_SHEETS_.activityLogs, [
    'log_id',
    'created_at',
    'workspace_id',
    'user_id',
    'membership_id',
    'line_user_id',
    'action',
    'target_type',
    'target_id',
    'result',
    'detail'
  ]);

  return true;
}


function workspaceEnsureSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  if (sheet.getLastColumn() < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  const currentHeaders = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0]
    .map(workspaceText_);

  if (currentHeaders.every(function (header) { return header === ''; })) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  headers.forEach(function (header) {
    if (currentHeaders.indexOf(header) === -1) {
      const column = sheet.getLastColumn() + 1;
      sheet.getRange(1, column).setValue(header);
      currentHeaders.push(header);
    }
  });

  return sheet;
}


// ==================================================
// Permissions
// ==================================================

function workspaceDefaultPermissions_(role) {
  role = workspaceText_(role).toLowerCase();

  const permissions = {
    can_manage_team: false,
    can_edit_bank_account: false,
    can_approve_payment: false,
    can_edit_contract: false,
    can_terminate_contract: false,
    can_delete_data: false,
    can_export_data: false
  };

  if (role === 'owner') {
    Object.keys(permissions).forEach(function (key) {
      permissions[key] = true;
    });
    return permissions;
  }

  if (role === 'admin') {
    permissions.can_manage_team = true;
    permissions.can_edit_bank_account = true;
    permissions.can_approve_payment = true;
    permissions.can_edit_contract = true;
    permissions.can_terminate_contract = true;
    permissions.can_export_data = true;
    return permissions;
  }

  if (role === 'manager') {
    permissions.can_approve_payment = true;
    permissions.can_edit_contract = true;
    permissions.can_terminate_contract = true;
    return permissions;
  }

  if (role === 'accountant') {
    permissions.can_edit_bank_account = true;
    permissions.can_approve_payment = true;
    permissions.can_export_data = true;
    return permissions;
  }

  return permissions;
}


// ==================================================
// Legacy statistics
// ==================================================

function workspaceResolveLegacyLandlordStats_(ss, lineUserId, landlordId) {
  const result = {
    room_count: 0,
    tenant_count: 0
  };

  const homeSheet = ss.getSheetByName(
    V2_WORKSPACE_SHEETS_.landlordHomeView
  );

  const homeRow = workspaceGetObjectsWithRow_(homeSheet).find(function (row) {
    return (
      workspaceText_(row.line_user_id || row.landlord_line_user_id) === lineUserId ||
      (
        landlordId &&
        workspaceText_(row.landlord_id) === workspaceText_(landlordId)
      )
    );
  });

  if (homeRow) {
    result.room_count = workspaceNumber_(homeRow.room_count);
    result.tenant_count = workspaceNumber_(homeRow.tenant_count);
  }

  if (result.tenant_count === 0) {
    const listSheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.landlordTenantListView
    );

    const tenantRows = workspaceGetObjectsWithRow_(listSheet).filter(function (row) {
      return (
        workspaceText_(row.line_user_id || row.landlord_line_user_id) === lineUserId ||
        (
          landlordId &&
          workspaceText_(row.landlord_id) === workspaceText_(landlordId)
        )
      );
    });

    result.tenant_count = tenantRows.length;

    if (result.room_count === 0) {
      const roomIds = {};

      tenantRows.forEach(function (row) {
        const roomId = workspaceText_(row.room_id || row.room_name || row.room_list);
        if (roomId) {
          roomIds[roomId] = true;
        }
      });

      result.room_count = Object.keys(roomIds).length;
    }
  }

  return result;
}


// ==================================================
// Sheet utilities
// ==================================================

function workspaceGetObjectsWithRow_(sheet) {
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(workspaceText_);

  return values.slice(1).map(function (row, index) {
    const object = {
      __row_number: index + 2
    };

    headers.forEach(function (header, column) {
      if (header) {
        object[header] = row[column];
      }
    });

    return object;
  });
}


function workspaceAppendObject_(sheet, record) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(workspaceText_);

  const row = headers.map(function (header) {
    return record[header] !== undefined
      ? record[header]
      : '';
  });

  sheet.appendRow(row);
}


function workspaceHeaderMap_(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0];

  const map = {};

  headers.forEach(function (header, index) {
    const key = workspaceText_(header);
    if (key) {
      map[key] = index;
    }
  });

  return map;
}


function workspaceEnsureHeader_(sheet, header) {
  const map = workspaceHeaderMap_(sheet);

  if (map[header] !== undefined) {
    return map[header] + 1;
  }

  const column = sheet.getLastColumn() + 1;
  sheet.getRange(1, column).setValue(header);
  return column;
}


function workspaceSetFirstExistingOrCreate_(
  sheet,
  rowNumber,
  candidates,
  createHeader,
  value
) {
  const map = workspaceHeaderMap_(sheet);

  const existing = candidates.find(function (header) {
    return map[header] !== undefined;
  });

  const column = existing
    ? map[existing] + 1
    : workspaceEnsureHeader_(sheet, createHeader);

  sheet.getRange(rowNumber, column).setValue(value);
}


function workspaceNextId_(sheet, headerName, prefix, digits) {
  const rows = workspaceGetObjectsWithRow_(sheet);
  let maxValue = 0;

  rows.forEach(function (row) {
    const value = workspaceText_(row[headerName]);
    const match = value.match(new RegExp('^' + prefix + '(\\d+)$', 'i'));

    if (match) {
      maxValue = Math.max(maxValue, Number(match[1]) || 0);
    }
  });

  return prefix + String(maxValue + 1).padStart(digits || 6, '0');
}


// ==================================================
// Logs
// ==================================================

function workspaceWriteActivityLog_(record) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = workspaceEnsureSheet_(
      ss,
      V2_WORKSPACE_SHEETS_.activityLogs,
      [
        'log_id',
        'created_at',
        'workspace_id',
        'user_id',
        'membership_id',
        'line_user_id',
        'action',
        'target_type',
        'target_id',
        'result',
        'detail'
      ]
    );

    workspaceAppendObject_(sheet, Object.assign(
      {
        log_id: workspaceMakeId_('WLOG', 6),
        created_at: new Date(),
        workspace_id: '',
        user_id: '',
        membership_id: '',
        line_user_id: '',
        action: '',
        target_type: '',
        target_id: '',
        result: '',
        detail: ''
      },
      record || {}
    ));

  } catch (error) {
    // 紀錄失敗不影響主流程。
  }
}


function workspaceLogAccess_(payload) {
  if (typeof logLiffAccess_ === 'function') {
    try {
      logLiffAccess_(payload);
    } catch (error) {
      // 不影響主要流程。
    }
  }
}


// ==================================================
// General utilities
// ==================================================

function workspaceText_(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}


function workspaceNumber_(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}


function workspaceBoolean_(value) {
  if (value === true || value === 1) {
    return true;
  }

  const text = workspaceText_(value).toLowerCase();

  return [
    'true',
    '1',
    'yes',
    'y',
    '是'
  ].indexOf(text) >= 0;
}


function workspaceIsActiveStatus_(status) {
  return [
    'active',
    'enabled',
    'valid',
    'current',
    '啟用',
    '有效'
  ].indexOf(workspaceText_(status).toLowerCase()) >= 0;
}


function workspaceOnboardingComplete_(status) {
  return [
    'completed',
    'complete',
    'done',
    '已完成'
  ].indexOf(workspaceText_(status).toLowerCase()) >= 0;
}


function workspaceNormalizeTaiwanPhone_(value) {
  let digits = workspaceText_(value).replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.indexOf('8860') === 0 && digits.length === 13) {
    digits = '0' + digits.slice(4);
  } else if (digits.indexOf('886') === 0 && digits.length === 12) {
    digits = '0' + digits.slice(3);
  } else if (digits.length === 9 && digits.charAt(0) === '9') {
    digits = '0' + digits;
  }

  return digits;
}


function workspaceValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workspaceText_(value));
}


function workspaceMakeId_(prefix, randomDigits) {
  const randomMax = Math.pow(10, randomDigits || 6);
  const randomValue = Math.floor(Math.random() * randomMax);

  return (
    prefix + '-' +
    Utilities.formatDate(
      new Date(),
      V2_WORKSPACE_TIMEZONE_,
      'yyyyMMddHHmmss'
    ) + '-' +
    String(randomValue).padStart(randomDigits || 6, '0')
  );
}


function workspaceResult_(success, code, message, data) {
  return {
    success: success === true,
    code: code || '',
    message: message || '',
    data: data === undefined ? null : data
  };
}


// ==================================================
// Tests
// ==================================================

/**
 * 第一步先執行此函式。
 */
function testEnsureV2WorkspaceSchema() {
  workspaceEnsureSchema_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};

  [
    V2_WORKSPACE_SHEETS_.users,
    V2_WORKSPACE_SHEETS_.landlords,
    V2_WORKSPACE_SHEETS_.workspaces,
    V2_WORKSPACE_SHEETS_.members,
    V2_WORKSPACE_SHEETS_.invitations,
    V2_WORKSPACE_SHEETS_.memberScopes,
    V2_WORKSPACE_SHEETS_.propertyOwners,
    V2_WORKSPACE_SHEETS_.activityLogs
  ].forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);

    result[sheetName] = {
      exists: Boolean(sheet),
      rows: sheet ? sheet.getLastRow() : 0,
      columns: sheet ? sheet.getLastColumn() : 0,
      headers: sheet
        ? sheet
            .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
            .getValues()[0]
        : []
    };
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


/**
 * 第二步執行：把目前 L000001 等舊房東建立為 workspace owner。
 */
function testMigrateExistingLandlordsToWorkspaces() {
  const result = migrateExistingLandlordsToWorkspaces_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


/**
 * 第三步執行：測試目前房東 UID 入口狀態。
 */
function testLandlordEntryStatus() {
  const result = getLandlordEntryStatusByLineUid_(
    getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID')
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testLandlordWorkspaceContext() {
  const result = getLandlordWorkspaceContextByLineUid_(
    getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID')
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
