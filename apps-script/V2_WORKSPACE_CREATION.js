/**
 * CMWebs V2 新增管理團隊
 *
 * API:
 * - landlord_workspace_create
 *
 * 用途：
 * - 已註冊房東或受邀成員，可建立第二個以上獨立 Workspace。
 * - 每個新 Workspace 都建立獨立的 legacy landlord identity，
 *   避免同一 LINE UID 在舊版 view/API 中混用不同團隊資料。
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 */

const V2_ADDITIONAL_WORKSPACE_MAX_ = 20;

const V2_ADDITIONAL_WORKSPACE_TYPES_ = [
  'rental_management',
  'property_management',
  'co_ownership'
];


function createAdditionalLandlordWorkspaceByLineUid_(
  lineUserId,
  workspaceName,
  workspaceType,
  note
) {
  const action =
    'landlord_workspace_create';

  const lock =
    LockService.getScriptLock();

  let locked = false;

  try {
    lineUserId =
      workspaceText_(
        lineUserId
      );

    workspaceName =
      workspaceText_(
        workspaceName
      );

    workspaceType =
      workspaceText_(
        workspaceType ||
        'rental_management'
      ).toLowerCase();

    note =
      workspaceText_(
        note
      );

    if (!lineUserId) {
      return workspaceResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID'
      );
    }

    if (
      !workspaceName ||
      workspaceName.length > 80
    ) {
      return workspaceResult_(
        false,
        'INVALID_WORKSPACE_NAME',
        '請輸入 1 至 80 字的管理團隊名稱'
      );
    }

    if (
      V2_ADDITIONAL_WORKSPACE_TYPES_
        .indexOf(
          workspaceType
        ) === -1
    ) {
      return workspaceResult_(
        false,
        'INVALID_WORKSPACE_TYPE',
        '不支援的管理團隊類型'
      );
    }

    if (note.length > 300) {
      return workspaceResult_(
        false,
        'NOTE_TOO_LONG',
        '備註最多 300 字'
      );
    }

    workspaceEnsureSchema_();

    lock.waitLock(
      20000
    );

    locked = true;

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    workspaceEnsureLegacyLandlordContext_(
      ss,
      lineUserId
    );

    const context =
      workspaceResolveContextByLineUid_(
        ss,
        lineUserId
      );

    if (!context.user) {
      return workspaceResult_(
        false,
        'REGISTRATION_REQUIRED',
        '請先建立房東帳號或接受團隊邀請'
      );
    }

    if (
      !workspaceIsActiveStatus_(
        context.user.account_status ||
        'active'
      )
    ) {
      return workspaceResult_(
        false,
        'USER_ACCOUNT_INACTIVE',
        '使用者帳號目前不是啟用狀態'
      );
    }

    const activeMemberships =
      context.memberships.filter(
        function (membership) {
          return (
            workspaceText_(
              membership.member_status
            ).toLowerCase() !==
            'removed'
          );
        }
      );

    if (
      activeMemberships.length >=
      V2_ADDITIONAL_WORKSPACE_MAX_
    ) {
      return workspaceResult_(
        false,
        'WORKSPACE_LIMIT_REACHED',
        '每個帳號最多可加入或建立 ' +
        V2_ADDITIONAL_WORKSPACE_MAX_ +
        ' 個管理團隊'
      );
    }

    const membershipWorkspaceIds = {};

    activeMemberships.forEach(
      function (membership) {
        membershipWorkspaceIds[
          workspaceText_(
            membership.workspace_id
          ).toUpperCase()
        ] = true;
      }
    );

    const duplicateName =
      context.workspaceRows.find(
        function (workspace) {
          const sameMembership =
            membershipWorkspaceIds[
              workspaceText_(
                workspace.workspace_id
              ).toUpperCase()
            ] === true;

          const sameName =
            workspaceText_(
              workspace.workspace_name
            ).toLowerCase() ===
            workspaceName.toLowerCase();

          return (
            sameMembership &&
            sameName &&
            workspaceText_(
              workspace.account_status ||
              'active'
            ).toLowerCase() !==
            'deleted'
          );
        }
      );

    if (duplicateName) {
      return workspaceResult_(
        false,
        'DUPLICATE_WORKSPACE_NAME',
        '您已有相同名稱的管理團隊'
      );
    }

    const usersSheet =
      ss.getSheetByName(
        V2_WORKSPACE_SHEETS_
          .users
      );

    const workspaceSheet =
      ss.getSheetByName(
        V2_WORKSPACE_SHEETS_
          .workspaces
      );

    const memberSheet =
      ss.getSheetByName(
        V2_WORKSPACE_SHEETS_
          .members
      );

    const landlordSheet =
      ss.getSheetByName(
        V2_WORKSPACE_SHEETS_
          .landlords
      );

    const now =
      new Date();

    const workspaceId =
      workspaceNextId_(
        workspaceSheet,
        'workspace_id',
        'W',
        6
      );

    const membershipId =
      workspaceNextId_(
        memberSheet,
        'membership_id',
        'WM',
        6
      );

    const landlordId =
      workspaceNextId_(
        landlordSheet,
        'landlord_id',
        'L',
        6
      );

    const principalUid =
      workspaceBuildLegacyPrincipalAlias_(
        workspaceId
      );

    const userId =
      workspaceText_(
        context.user.user_id
      );

    const userName =
      workspaceText_(
        context.user.name ||
        context.user.profile_display_name ||
        '房東'
      );

    const userPhone =
      workspaceNormalizeTaiwanPhone_(
        context.user.phone
      );

    const userEmail =
      workspaceText_(
        context.user.email
      ).toLowerCase();

    workspaceAppendObject_(
      workspaceSheet,
      {
        workspace_id:
          workspaceId,
        workspace_name:
          workspaceName,
        workspace_type:
          workspaceType,
        account_status:
          'active',
        onboarding_status:
          'pending',
        onboarding_step:
          'payment',
        created_by_user_id:
          userId,
        default_currency:
          'TWD',
        timezone:
          V2_WORKSPACE_TIMEZONE_,
        created_at:
          now,
        updated_at:
          now,
        note:
          note
      }
    );

    workspaceAppendObject_(
      memberSheet,
      Object.assign(
        {
          membership_id:
            membershipId,
          workspace_id:
            workspaceId,
          user_id:
            userId,
          role:
            'owner',
          member_status:
            'active',
          is_primary:
            activeMemberships.length === 0,
          joined_at:
            now,
          invited_by_user_id:
            '',
          created_at:
            now,
          updated_at:
            now,
          display_name:
            userName,
          line_user_id:
            lineUserId,
          phone:
            userPhone,
          email:
            userEmail,
          note:
            'Created as additional workspace owner'
        },
        workspaceDefaultPermissions_(
          'owner'
        )
      )
    );

    /*
     * 不直接重複使用真實 LINE UID。
     *
     * 舊版 landlord_home_view、tenant list view 等資料仍以 line_user_id
     * 當查詢鍵。若同一人建立多個 Workspace 且全部使用相同 LINE UID，
     * 舊 API 的 find() 只會命中第一個房東資料。
     *
     * 因此每個新增 Workspace 建立獨立的內部 principal UID。
     * 真實 LINE UID 保存在 actual_owner_line_user_id。
     */
    workspaceAppendObject_(
      landlordSheet,
      {
        landlord_id:
          landlordId,
        created_at:
          now,
        updated_at:
          now,
        landlord_user_id:
          userId,
        user_id:
          userId,

        landlord_line_user_id:
          principalUid,
        line_user_id:
          principalUid,

        actual_owner_line_user_id:
          lineUserId,
        workspace_principal_uid:
          principalUid,
        workspace_principal_type:
          'internal_workspace_alias',

        landlord_name:
          userName,
        landlord_phone:
          userPhone,
        landlord_email:
          userEmail,

        workspace_id:
          workspaceId,
        account_status:
          'active',
        onboarding_status:
          'pending',
        note:
          'Created as additional workspace'
      }
    );

    workspaceSetFirstExistingOrCreate_(
      usersSheet,
      context.user.__row_number,
      [
        'active_workspace_id'
      ],
      'active_workspace_id',
      workspaceId
    );

    workspaceSetFirstExistingOrCreate_(
      usersSheet,
      context.user.__row_number,
      [
        'updated_at'
      ],
      'updated_at',
      now
    );

    SpreadsheetApp.flush();

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
        'workspace_created',
      target_type:
        'workspace',
      target_id:
        workspaceId,
      result:
        'success',
      detail:
        'landlord_id=' +
        landlordId +
        ', principal_uid=' +
        principalUid
    });

    workspaceLogAccess_({
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
        'additional workspace created'
    });

    const refreshed =
      workspaceResolveContextByLineUid_(
        ss,
        lineUserId
      );

    return workspaceResult_(
      true,
      'WORKSPACE_CREATED',
      '新的管理團隊已建立',
      Object.assign(
        {
          route:
            'onboarding',
          created_workspace: {
            workspace_id:
              workspaceId,
            workspace_name:
              workspaceName,
            workspace_type:
              workspaceType,
            account_status:
              'active',
            onboarding_status:
              'pending'
          },
          created_membership: {
            membership_id:
              membershipId,
            role:
              'owner',
            member_status:
              'active'
          },
          legacy_landlord: {
            landlord_id:
              landlordId,
            workspace_principal_uid:
              principalUid
          }
        },
        workspaceBuildContextData_(
          refreshed
        )
      )
    );

  } catch (error) {
    workspaceLogAccess_({
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

    return workspaceResult_(
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


function workspaceBuildLegacyPrincipalAlias_(
  workspaceId
) {
  workspaceId =
    workspaceText_(
      workspaceId
    ).toUpperCase();

  return (
    'WSP_' +
    workspaceId
  );
}


function testCreateAdditionalWorkspace() {
  const result =
    createAdditionalLandlordWorkspaceByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      '第二管理團隊測試',
      'rental_management',
      'Apps Script test'
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
