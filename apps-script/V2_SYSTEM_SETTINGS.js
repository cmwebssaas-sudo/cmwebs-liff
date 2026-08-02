/**
 * CMWebs V2 系統設定
 *
 * API：
 * - landlord_settings_init
 * - landlord_settings_save_profile
 * - landlord_settings_save_workspace
 * - landlord_settings_save_payment
 * - landlord_settings_save_preferences
 *
 * 功能：
 * - 編輯目前登入成員的個人資料。
 * - 編輯目前 Workspace 名稱、時區與幣別。
 * - 編輯 Workspace 預設收款帳號。
 * - 設定帳務預設值、夏月耗損費與通知偏好。
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 * - V2_WORKSPACE_LANDLORD_ACCESS.gs
 * - V2_WORKSPACE_OPERATION_AUDIT.gs（選用）
 */

const V2_SYSTEM_SETTINGS_SHEETS_ = {
  users:
    'V2_users',
  landlords:
    'V2_landlords',
  workspaces:
    'V2_workspaces',
  members:
    'V2_workspace_members',
  paymentAccounts:
    'V2_workspace_payment_accounts',
  settings:
    'V2_workspace_settings'
};

const V2_SYSTEM_SETTINGS_DEFAULTS_ = {
  locale:
    'zh-TW',

  timezone:
    'Asia/Taipei',

  currency:
    'TWD',

  default_payment_day:
    10,

  default_electricity_fee_rate:
    3,

  summer_month_start:
    6,

  summer_month_end:
    9,

  summer_equipment_fee_rate:
    3.5,

  regular_equipment_fee_rate:
    2.5,

  default_management_fee:
    0,

  default_deposit_months:
    2,

  late_fee_type:
    'none',

  late_fee_value:
    0,

  late_fee_grace_days:
    0,

  auto_overdue_reminder:
    true,

  overdue_reminder_hour:
    10,

  overdue_reminder_days_json:
    '[1,3,7]',

  notify_bill_created:
    true,

  notify_payment_report:
    true,

  notify_tenant_message:
    true,

  notify_overdue:
    true,

  notify_contract:
    true,

  notify_checkin:
    true,

  notify_announcement_result:
    true,

  notify_line_failure:
    true,

  announcement_signature:
    'CMWebs 智慧租管',

  bill_message_footer:
    '如已完成付款，請透過房客入口提交付款回報。'
};


/**
 * 系統設定初始化。
 */
function getLandlordSettingsInitByLineUid_(
  lineUserId
) {
  try {
    systemSettingsEnsureSchema_();

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

    const workspaceId =
      systemSettingsText_(
        access.workspace
          .workspace_id
      ).toUpperCase();

    const user =
      systemSettingsFindRow_(
        ss.getSheetByName(
          V2_SYSTEM_SETTINGS_SHEETS_
            .users
        ),
        'user_id',
        access.user.user_id
      ) ||
      access.user ||
      {};

    const membership =
      systemSettingsFindRow_(
        ss.getSheetByName(
          V2_SYSTEM_SETTINGS_SHEETS_
            .members
        ),
        'membership_id',
        access.membership
          .membership_id
      ) ||
      access.membership ||
      {};

    const landlord =
      systemSettingsFindLandlord_(
        ss,
        access
      ) ||
      {};

    const workspace =
      systemSettingsFindRow_(
        ss.getSheetByName(
          V2_SYSTEM_SETTINGS_SHEETS_
            .workspaces
        ),
        'workspace_id',
        workspaceId
      ) ||
      access.workspace ||
      {};

    const payment =
      systemSettingsFindDefaultPaymentAccount_(
        ss,
        workspaceId
      ) ||
      {};

    const setting =
      systemSettingsGetOrCreateWorkspaceSettings_(
        ss,
        access,
        false
      );

    const permissions =
      systemSettingsBuildPermissions_(
        access
      );

    const paymentAccount =
      systemSettingsBuildPaymentView_(
        payment,
        permissions.can_edit_payment
      );

    return workspaceResult_(
      true,
      'OK',
      '系統設定載入成功',
      {
        workspace:
          typeof workspaceBuildWorkspaceView_ ===
            'function'
            ? workspaceBuildWorkspaceView_(
                workspace
              )
            : workspace,

        current_user:
          typeof workspaceBuildUserView_ ===
            'function'
            ? workspaceBuildUserView_(
                user
              )
            : user,

        current_membership:
          typeof workspaceBuildMembershipView_ ===
            'function'
            ? workspaceBuildMembershipView_(
                membership
              )
            : membership,

        permissions:
          permissions,

        profile: {
          user_id:
            systemSettingsText_(
              user.user_id
            ),

          display_name:
            systemSettingsText_(
              membership.display_name ||
              user.profile_display_name ||
              user.name ||
              landlord.landlord_name
            ),

          legal_name:
            systemSettingsText_(
              user.name ||
              landlord.landlord_name
            ),

          phone:
            systemSettingsNormalizePhone_(
              membership.phone ||
              user.phone ||
              landlord.landlord_phone
            ),

          email:
            systemSettingsText_(
              membership.email ||
              user.email ||
              landlord.landlord_email
            ),

          line_user_id:
            systemSettingsText_(
              user.line_user_id ||
              access.line_user_id
            ),

          profile_picture_url:
            systemSettingsText_(
              user.profile_picture_url
            )
        },

        workspace_profile: {
          workspace_id:
            workspaceId,

          workspace_name:
            systemSettingsText_(
              workspace.workspace_name
            ),

          workspace_type:
            systemSettingsText_(
              workspace.workspace_type ||
              'rental_management'
            ),

          timezone:
            systemSettingsNormalizeTimezone_(
              workspace.timezone ||
              setting.timezone ||
              V2_SYSTEM_SETTINGS_DEFAULTS_
                .timezone
            ),

          default_currency:
            systemSettingsNormalizeCurrency_(
              workspace.default_currency ||
              setting.currency ||
              V2_SYSTEM_SETTINGS_DEFAULTS_
                .currency
            ),

          account_status:
            systemSettingsText_(
              workspace.account_status ||
              'active'
            ),

          onboarding_status:
            systemSettingsText_(
              workspace.onboarding_status ||
              'completed'
            ),

          note:
            systemSettingsText_(
              workspace.note
            )
        },

        payment_account:
          paymentAccount,

        preferences:
          systemSettingsBuildPreferencesView_(
            setting,
            workspace
          ),

        option_lists: {
          timezones: [
            {
              value:
                'Asia/Taipei',
              label:
                '台灣時間（UTC+8）'
            },
            {
              value:
                'Asia/Tokyo',
              label:
                '日本時間（UTC+9）'
            }
          ],

          currencies: [
            {
              value:
                'TWD',
              label:
                '新台幣 TWD'
            },
            {
              value:
                'JPY',
              label:
                '日圓 JPY'
            }
          ],

          late_fee_types: [
            {
              value:
                'none',
              label:
                '不自動計算'
            },
            {
              value:
                'fixed',
              label:
                '固定金額'
            },
            {
              value:
                'percent',
              label:
                '應繳金額百分比'
            }
          ]
        }
      }
    );

  } catch (error) {
    return workspaceResult_(
      false,
      'LANDLORD_SETTINGS_INIT_ERROR',
      '系統設定載入失敗：' +
        error.message
    );
  }
}


/**
 * 儲存目前登入成員個人資料。
 */
function saveLandlordSettingsProfileByLineUid_(
  lineUserId,
  displayName,
  legalName,
  phone,
  email
) {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    systemSettingsEnsureSchema_();

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

    displayName =
      systemSettingsText_(
        displayName
      );

    legalName =
      systemSettingsText_(
        legalName
      );

    phone =
      systemSettingsNormalizePhone_(
        phone
      );

    email =
      systemSettingsText_(
        email
      ).toLowerCase();

    if (
      displayName.length <
      1 ||
      displayName.length >
      40
    ) {
      return workspaceResult_(
        false,
        'INVALID_DISPLAY_NAME',
        '顯示名稱需為 1 至 40 個字'
      );
    }

    if (
      legalName.length <
      1 ||
      legalName.length >
      50
    ) {
      return workspaceResult_(
        false,
        'INVALID_LEGAL_NAME',
        '姓名需為 1 至 50 個字'
      );
    }

    if (
      !/^09\d{8}$/.test(
        phone
      )
    ) {
      return workspaceResult_(
        false,
        'INVALID_PHONE',
        '請輸入 09 開頭的 10 位手機號碼'
      );
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      return workspaceResult_(
        false,
        'INVALID_EMAIL',
        '電子郵件格式不正確'
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

    const now =
      new Date();

    const userSheet =
      ss.getSheetByName(
        V2_SYSTEM_SETTINGS_SHEETS_
          .users
      );

    const user =
      systemSettingsFindRow_(
        userSheet,
        'user_id',
        access.user.user_id
      );

    if (!user) {
      return workspaceResult_(
        false,
        'USER_NOT_FOUND',
        '找不到目前使用者資料'
      );
    }

    systemSettingsSetRowValues_(
      userSheet,
      user.__row_number,
      {
        name:
          legalName,

        phone:
          phone,

        email:
          email,

        profile_display_name:
          displayName,

        updated_at:
          now
      }
    );

    const memberSheet =
      ss.getSheetByName(
        V2_SYSTEM_SETTINGS_SHEETS_
          .members
      );

    const membership =
      systemSettingsFindRow_(
        memberSheet,
        'membership_id',
        access.membership
          .membership_id
      );

    if (membership) {
      systemSettingsSetRowValues_(
        memberSheet,
        membership.__row_number,
        {
          display_name:
            displayName,

          phone:
            phone,

          email:
            email,

          updated_at:
            now
        }
      );
    }

    const landlordSheet =
      ss.getSheetByName(
        V2_SYSTEM_SETTINGS_SHEETS_
          .landlords
      );

    const landlord =
      systemSettingsFindLandlord_(
        ss,
        access
      );

    if (landlord) {
      systemSettingsSetRowValues_(
        landlordSheet,
        landlord.__row_number,
        {
          landlord_name:
            legalName,

          landlord_phone:
            phone,

          landlord_email:
            email,

          updated_at:
            now
        }
      );
    }

    SpreadsheetApp.flush();

    const result =
      workspaceResult_(
        true,
        'LANDLORD_PROFILE_SAVED',
        '個人資料已更新',
        {
          display_name:
            displayName,

          legal_name:
            legalName,

          phone:
            phone,

          email:
            email
        }
      );

    systemSettingsAudit_(
      access,
      'landlord_settings_save_profile',
      result,
      {
        target_type:
          'user',

        target_id:
          access.user.user_id,

        operation_status:
          'success',

        detail:
          'profile updated'
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'LANDLORD_PROFILE_SAVE_ERROR',
      '個人資料儲存失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * 儲存 Workspace 資料。
 */
function saveLandlordSettingsWorkspaceByLineUid_(
  lineUserId,
  workspaceName,
  timezone,
  currency,
  note
) {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    systemSettingsEnsureSchema_();

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

    const permissions =
      systemSettingsBuildPermissions_(
        access
      );

    if (
      !permissions.can_edit_workspace
    ) {
      return workspaceResult_(
        false,
        'PERMISSION_DENIED',
        '目前角色沒有編輯管理團隊資料的權限'
      );
    }

    workspaceName =
      systemSettingsText_(
        workspaceName
      );

    timezone =
      systemSettingsNormalizeTimezone_(
        timezone
      );

    currency =
      systemSettingsNormalizeCurrency_(
        currency
      );

    note =
      systemSettingsText_(
        note
      ).slice(
        0,
        500
      );

    if (
      workspaceName.length <
      2 ||
      workspaceName.length >
      60
    ) {
      return workspaceResult_(
        false,
        'INVALID_WORKSPACE_NAME',
        '管理團隊名稱需為 2 至 60 個字'
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

    const workspaceId =
      systemSettingsText_(
        access.workspace
          .workspace_id
      ).toUpperCase();

    const workspaceSheet =
      ss.getSheetByName(
        V2_SYSTEM_SETTINGS_SHEETS_
          .workspaces
      );

    const workspace =
      systemSettingsFindRow_(
        workspaceSheet,
        'workspace_id',
        workspaceId
      );

    if (!workspace) {
      return workspaceResult_(
        false,
        'WORKSPACE_NOT_FOUND',
        '找不到目前管理團隊'
      );
    }

    const now =
      new Date();

    systemSettingsSetRowValues_(
      workspaceSheet,
      workspace.__row_number,
      {
        workspace_name:
          workspaceName,

        timezone:
          timezone,

        default_currency:
          currency,

        note:
          note,

        updated_at:
          now
      }
    );

    const settings =
      systemSettingsGetOrCreateWorkspaceSettings_(
        ss,
        access,
        true
      );

    systemSettingsSetRowValues_(
      ss.getSheetByName(
        V2_SYSTEM_SETTINGS_SHEETS_
          .settings
      ),
      settings.__row_number,
      {
        timezone:
          timezone,

        currency:
          currency,

        updated_at:
          now,

        updated_by_user_id:
          access.user.user_id ||
          ''
      }
    );

    SpreadsheetApp.flush();

    const result =
      workspaceResult_(
        true,
        'WORKSPACE_SETTINGS_SAVED',
        '管理團隊資料已更新',
        {
          workspace_id:
            workspaceId,

          workspace_name:
            workspaceName,

          timezone:
            timezone,

          currency:
            currency,

          note:
            note
        }
      );

    systemSettingsAudit_(
      access,
      'landlord_settings_save_workspace',
      result,
      {
        target_type:
          'workspace',

        target_id:
          workspaceId,

        operation_status:
          'success',

        detail:
          'workspace profile updated'
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'WORKSPACE_SETTINGS_SAVE_ERROR',
      '管理團隊資料儲存失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * 儲存預設收款帳號。
 */
function saveLandlordSettingsPaymentByLineUid_(
  lineUserId,
  bankCode,
  bankName,
  branchName,
  bankAccount,
  bankAccountName,
  paymentNote
) {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    systemSettingsEnsureSchema_();

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

    const permissions =
      systemSettingsBuildPermissions_(
        access
      );

    if (
      !permissions.can_edit_payment
    ) {
      return workspaceResult_(
        false,
        'PERMISSION_DENIED',
        '目前角色沒有編輯收款帳號的權限'
      );
    }

    bankCode =
      systemSettingsText_(
        bankCode
      );

    bankName =
      systemSettingsText_(
        bankName
      );

    branchName =
      systemSettingsText_(
        branchName
      );

    bankAccount =
      systemSettingsText_(
        bankAccount
      ).replace(
        /\s/g,
        ''
      );

    bankAccountName =
      systemSettingsText_(
        bankAccountName
      );

    paymentNote =
      systemSettingsText_(
        paymentNote
      ).slice(
        0,
        500
      );

    if (
      !/^\d{3}$/.test(
        bankCode
      )
    ) {
      return workspaceResult_(
        false,
        'INVALID_BANK_CODE',
        '銀行代碼必須是 3 位數字'
      );
    }

    if (!bankName) {
      return workspaceResult_(
        false,
        'BANK_NAME_REQUIRED',
        '請輸入銀行名稱'
      );
    }

    if (
      !/^[0-9]{6,20}$/.test(
        bankAccount
      )
    ) {
      return workspaceResult_(
        false,
        'INVALID_BANK_ACCOUNT',
        '銀行帳號必須是 6 至 20 位數字'
      );
    }

    if (!bankAccountName) {
      return workspaceResult_(
        false,
        'BANK_ACCOUNT_NAME_REQUIRED',
        '請輸入銀行戶名'
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

    const workspaceId =
      systemSettingsText_(
        access.workspace
          .workspace_id
      ).toUpperCase();

    const paymentSheet =
      ss.getSheetByName(
        V2_SYSTEM_SETTINGS_SHEETS_
          .paymentAccounts
      );

    const existing =
      systemSettingsFindDefaultPaymentAccount_(
        ss,
        workspaceId
      );

    const now =
      new Date();

    let paymentAccountId =
      '';

    if (existing) {
      paymentAccountId =
        systemSettingsText_(
          existing.payment_account_id
        );

      systemSettingsSetRowValues_(
        paymentSheet,
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
      paymentAccountId =
        systemSettingsGenerateId_(
          'PA'
        );

      systemSettingsAppendObject_(
        paymentSheet,
        {
          payment_account_id:
            paymentAccountId,

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
            access.user.user_id ||
            '',

          created_at:
            now,

          updated_at:
            now,

          note:
            ''
        }
      );
    }

    const workspaceSheet =
      ss.getSheetByName(
        V2_SYSTEM_SETTINGS_SHEETS_
          .workspaces
      );

    const workspace =
      systemSettingsFindRow_(
        workspaceSheet,
        'workspace_id',
        workspaceId
      );

    if (workspace) {
      systemSettingsSetRowValues_(
        workspaceSheet,
        workspace.__row_number,
        {
          default_payment_account_id:
            paymentAccountId,

          updated_at:
            now
        }
      );
    }

    const landlord =
      systemSettingsFindLandlord_(
        ss,
        access
      );

    if (landlord) {
      systemSettingsSetRowValues_(
        ss.getSheetByName(
          V2_SYSTEM_SETTINGS_SHEETS_
            .landlords
        ),
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
            paymentAccountId,

          updated_at:
            now
        }
      );
    }

    SpreadsheetApp.flush();

    const result =
      workspaceResult_(
        true,
        'PAYMENT_SETTINGS_SAVED',
        '收款帳號已更新',
        {
          payment_account_id:
            paymentAccountId,

          bank_code:
            bankCode,

          bank_name:
            bankName,

          branch_name:
            branchName,

          bank_account_masked:
            systemSettingsMaskBankAccount_(
              bankAccount
            ),

          bank_account_name:
            bankAccountName,

          payment_note:
            paymentNote
        }
      );

    systemSettingsAudit_(
      access,
      'landlord_settings_save_payment',
      result,
      {
        target_type:
          'payment_account',

        target_id:
          paymentAccountId,

        operation_status:
          'success',

        detail:
          'default payment account updated'
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'PAYMENT_SETTINGS_SAVE_ERROR',
      '收款帳號儲存失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * 儲存帳務預設值與通知偏好。
 */
function saveLandlordSettingsPreferencesByLineUid_(
  lineUserId,
  payloadJson
) {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    systemSettingsEnsureSchema_();

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

    const permissions =
      systemSettingsBuildPermissions_(
        access
      );

    if (
      !permissions.can_edit_preferences
    ) {
      return workspaceResult_(
        false,
        'PERMISSION_DENIED',
        '目前角色沒有編輯帳務與通知設定的權限'
      );
    }

    const payload =
      systemSettingsParsePayload_(
        payloadJson
      );

    const values =
      systemSettingsValidatePreferences_(
        payload
      );

    lock.waitLock(
      25000
    );

    locked =
      true;

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const setting =
      systemSettingsGetOrCreateWorkspaceSettings_(
        ss,
        access,
        true
      );

    const now =
      new Date();

    values.updated_at =
      now;

    values.updated_by_user_id =
      access.user.user_id ||
      '';

    systemSettingsSetRowValues_(
      ss.getSheetByName(
        V2_SYSTEM_SETTINGS_SHEETS_
          .settings
      ),
      setting.__row_number,
      values
    );

    SpreadsheetApp.flush();

    let reminderAutomation =
      null;

    if (
      typeof syncV2AutomaticPaymentReminderTrigger ===
      'function'
    ) {
      try {
        reminderAutomation =
          syncV2AutomaticPaymentReminderTrigger();

      } catch (triggerError) {
        reminderAutomation = {
          success:
            false,

          code:
            'REMINDER_TRIGGER_SYNC_ERROR',

          message:
            triggerError &&
            triggerError.message
              ? triggerError.message
              : String(
                  triggerError
                )
        };
      }
    }

    const result =
      workspaceResult_(
        true,
        'PREFERENCES_SAVED',
        '帳務預設與通知偏好已更新',
        {
          preferences:
            systemSettingsBuildPreferencesView_(
              Object.assign(
                {},
                setting,
                values
              ),
              access.workspace
            ),

          reminder_automation:
            reminderAutomation
        }
      );

    systemSettingsAudit_(
      access,
      'landlord_settings_save_preferences',
      result,
      {
        target_type:
          'workspace_settings',

        target_id:
          setting.workspace_setting_id,

        operation_status:
          'success',

        detail:
          'billing defaults and notifications updated'
      }
    );

    return result;

  } catch (error) {
    return workspaceResult_(
      false,
      'PREFERENCES_SAVE_ERROR',
      '帳務與通知設定儲存失敗：' +
        error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


// ==================================================
// Data views and validation
// ==================================================

function systemSettingsBuildPermissions_(
  access
) {
  const role =
    systemSettingsText_(
      access.membership.role
    ).toLowerCase();

  const permissions =
    access.permissions ||
    {};

  return {
    role:
      role,

    can_edit_profile:
      true,

    can_edit_workspace:
      [
        'owner',
        'admin'
      ].indexOf(
        role
      ) >=
      0,

    can_edit_payment:
      systemSettingsBoolean_(
        permissions
          .can_edit_bank_account
      ) ||
      [
        'owner',
        'admin',
        'accountant'
      ].indexOf(
        role
      ) >=
      0,

    can_edit_preferences:
      [
        'owner',
        'admin'
      ].indexOf(
        role
      ) >=
      0
  };
}


function systemSettingsBuildPaymentView_(
  payment,
  canEdit
) {
  const account =
    systemSettingsText_(
      payment.bank_account
    );

  return {
    payment_account_id:
      systemSettingsText_(
        payment.payment_account_id
      ),

    account_name:
      systemSettingsText_(
        payment.account_name ||
        '預設收款帳號'
      ),

    bank_code:
      systemSettingsText_(
        payment.bank_code
      ),

    bank_name:
      systemSettingsText_(
        payment.bank_name
      ),

    branch_name:
      systemSettingsText_(
        payment.branch_name
      ),

    bank_account:
      canEdit
        ? account
        : '',

    bank_account_masked:
      systemSettingsMaskBankAccount_(
        account
      ),

    bank_account_name:
      systemSettingsText_(
        payment.bank_account_name
      ),

    payment_note:
      systemSettingsText_(
        payment.payment_note
      ),

    is_default:
      systemSettingsBoolean_(
        payment.is_default
      ),

    account_status:
      systemSettingsText_(
        payment.account_status ||
        'active'
      )
  };
}


function systemSettingsBuildPreferencesView_(
  setting,
  workspace
) {
  const defaults =
    V2_SYSTEM_SETTINGS_DEFAULTS_;

  return {
    locale:
      systemSettingsText_(
        setting.locale ||
        defaults.locale
      ),

    timezone:
      systemSettingsNormalizeTimezone_(
        setting.timezone ||
        workspace.timezone ||
        defaults.timezone
      ),

    currency:
      systemSettingsNormalizeCurrency_(
        setting.currency ||
        workspace.default_currency ||
        defaults.currency
      ),

    default_payment_day:
      systemSettingsIntegerInRange_(
        setting.default_payment_day,
        1,
        28,
        defaults.default_payment_day
      ),

    default_electricity_fee_rate:
      systemSettingsNumberInRange_(
        setting.default_electricity_fee_rate,
        0,
        100,
        defaults.default_electricity_fee_rate
      ),

    summer_month_start:
      systemSettingsIntegerInRange_(
        setting.summer_month_start,
        1,
        12,
        defaults.summer_month_start
      ),

    summer_month_end:
      systemSettingsIntegerInRange_(
        setting.summer_month_end,
        1,
        12,
        defaults.summer_month_end
      ),

    summer_equipment_fee_rate:
      systemSettingsNumberInRange_(
        setting.summer_equipment_fee_rate,
        0,
        100,
        defaults.summer_equipment_fee_rate
      ),

    regular_equipment_fee_rate:
      systemSettingsNumberInRange_(
        setting.regular_equipment_fee_rate,
        0,
        100,
        defaults.regular_equipment_fee_rate
      ),

    default_management_fee:
      systemSettingsNumberInRange_(
        setting.default_management_fee,
        0,
        1000000,
        defaults.default_management_fee
      ),

    default_deposit_months:
      systemSettingsNumberInRange_(
        setting.default_deposit_months,
        0,
        12,
        defaults.default_deposit_months
      ),

    late_fee_type:
      systemSettingsNormalizeLateFeeType_(
        setting.late_fee_type ||
        defaults.late_fee_type
      ),

    late_fee_value:
      systemSettingsNumberInRange_(
        setting.late_fee_value,
        0,
        1000000,
        defaults.late_fee_value
      ),

    late_fee_grace_days:
      systemSettingsIntegerInRange_(
        setting.late_fee_grace_days,
        0,
        60,
        defaults.late_fee_grace_days
      ),

    auto_overdue_reminder:
      systemSettingsBooleanDefault_(
        setting.auto_overdue_reminder,
        defaults.auto_overdue_reminder
      ),

    overdue_reminder_hour:
      systemSettingsIntegerInRange_(
        setting.overdue_reminder_hour,
        0,
        23,
        defaults.overdue_reminder_hour
      ),

    overdue_reminder_days:
      systemSettingsParseReminderDays_(
        setting.overdue_reminder_days_json ||
        defaults.overdue_reminder_days_json
      ),

    notify_bill_created:
      systemSettingsBooleanDefault_(
        setting.notify_bill_created,
        defaults.notify_bill_created
      ),

    notify_payment_report:
      systemSettingsBooleanDefault_(
        setting.notify_payment_report,
        defaults.notify_payment_report
      ),

    notify_tenant_message:
      systemSettingsBooleanDefault_(
        setting.notify_tenant_message,
        defaults.notify_tenant_message
      ),

    notify_overdue:
      systemSettingsBooleanDefault_(
        setting.notify_overdue,
        defaults.notify_overdue
      ),

    notify_contract:
      systemSettingsBooleanDefault_(
        setting.notify_contract,
        defaults.notify_contract
      ),

    notify_checkin:
      systemSettingsBooleanDefault_(
        setting.notify_checkin,
        defaults.notify_checkin
      ),

    notify_announcement_result:
      systemSettingsBooleanDefault_(
        setting.notify_announcement_result,
        defaults.notify_announcement_result
      ),

    notify_line_failure:
      systemSettingsBooleanDefault_(
        setting.notify_line_failure,
        defaults.notify_line_failure
      ),

    announcement_signature:
      systemSettingsText_(
        setting.announcement_signature ||
        defaults.announcement_signature
      ),

    bill_message_footer:
      systemSettingsText_(
        setting.bill_message_footer ||
        defaults.bill_message_footer
      )
  };
}


function systemSettingsValidatePreferences_(
  payload
) {
  const paymentDay =
    systemSettingsIntegerInRange_(
      payload.default_payment_day,
      1,
      28,
      0
    );

  if (
    paymentDay <
    1
  ) {
    throw new Error(
      '預設繳款日必須介於 1 至 28 日'
    );
  }

  const summerStart =
    systemSettingsIntegerInRange_(
      payload.summer_month_start,
      1,
      12,
      0
    );

  const summerEnd =
    systemSettingsIntegerInRange_(
      payload.summer_month_end,
      1,
      12,
      0
    );

  if (
    summerStart <
    1 ||
    summerEnd <
    1
  ) {
    throw new Error(
      '夏月起訖月份必須介於 1 至 12 月'
    );
  }

  const reminderDays =
    systemSettingsParseReminderDays_(
      payload.overdue_reminder_days
    );

  const signature =
    systemSettingsText_(
      payload.announcement_signature
    ).slice(
      0,
      80
    );

  const billFooter =
    systemSettingsText_(
      payload.bill_message_footer
    ).slice(
      0,
      300
    );

  return {
    locale:
      systemSettingsText_(
        payload.locale ||
        'zh-TW'
      ),

    timezone:
      systemSettingsNormalizeTimezone_(
        payload.timezone
      ),

    currency:
      systemSettingsNormalizeCurrency_(
        payload.currency
      ),

    default_payment_day:
      paymentDay,

    default_electricity_fee_rate:
      systemSettingsNumberInRange_(
        payload.default_electricity_fee_rate,
        0,
        100,
        0
      ),

    summer_month_start:
      summerStart,

    summer_month_end:
      summerEnd,

    summer_equipment_fee_rate:
      systemSettingsNumberInRange_(
        payload.summer_equipment_fee_rate,
        0,
        100,
        0
      ),

    regular_equipment_fee_rate:
      systemSettingsNumberInRange_(
        payload.regular_equipment_fee_rate,
        0,
        100,
        0
      ),

    default_management_fee:
      systemSettingsNumberInRange_(
        payload.default_management_fee,
        0,
        1000000,
        0
      ),

    default_deposit_months:
      systemSettingsNumberInRange_(
        payload.default_deposit_months,
        0,
        12,
        0
      ),

    late_fee_type:
      systemSettingsNormalizeLateFeeType_(
        payload.late_fee_type
      ),

    late_fee_value:
      systemSettingsNumberInRange_(
        payload.late_fee_value,
        0,
        1000000,
        0
      ),

    late_fee_grace_days:
      systemSettingsIntegerInRange_(
        payload.late_fee_grace_days,
        0,
        60,
        0
      ),

    auto_overdue_reminder:
      systemSettingsBoolean_(
        payload.auto_overdue_reminder
      ),

    overdue_reminder_hour:
      systemSettingsIntegerInRange_(
        payload.overdue_reminder_hour,
        0,
        23,
        10
      ),

    overdue_reminder_days_json:
      JSON.stringify(
        reminderDays
      ),

    notify_bill_created:
      systemSettingsBoolean_(
        payload.notify_bill_created
      ),

    notify_payment_report:
      systemSettingsBoolean_(
        payload.notify_payment_report
      ),

    notify_tenant_message:
      systemSettingsBoolean_(
        payload.notify_tenant_message
      ),

    notify_overdue:
      systemSettingsBoolean_(
        payload.notify_overdue
      ),

    notify_contract:
      systemSettingsBoolean_(
        payload.notify_contract
      ),

    notify_checkin:
      systemSettingsBoolean_(
        payload.notify_checkin
      ),

    notify_announcement_result:
      systemSettingsBoolean_(
        payload.notify_announcement_result
      ),

    notify_line_failure:
      systemSettingsBoolean_(
        payload.notify_line_failure
      ),

    announcement_signature:
      signature ||
      V2_SYSTEM_SETTINGS_DEFAULTS_
        .announcement_signature,

    bill_message_footer:
      billFooter ||
      V2_SYSTEM_SETTINGS_DEFAULTS_
        .bill_message_footer
  };
}


// ==================================================
// Sheet lookup and row helpers
// ==================================================

function systemSettingsFindLandlord_(
  ss,
  access
) {
  const sheet =
    ss.getSheetByName(
      V2_SYSTEM_SETTINGS_SHEETS_
        .landlords
    );

  if (!sheet) {
    return null;
  }

  const rows =
    workspaceGetObjectsWithRow_(
      sheet
    );

  const currentUserId =
    systemSettingsText_(
      access.user.user_id
    );

  const currentLineUserId =
    systemSettingsText_(
      access.line_user_id
    );

  return rows.find(
    function (row) {
      return (
        currentUserId &&
        systemSettingsText_(
          row.user_id ||
          row.landlord_user_id
        ) ===
        currentUserId
      );
    }
  ) ||
  rows.find(
    function (row) {
      return (
        currentLineUserId &&
        systemSettingsText_(
          row.line_user_id ||
          row.landlord_line_user_id
        ) ===
        currentLineUserId
      );
    }
  ) ||
  rows.find(
    function (row) {
      return (
        systemSettingsText_(
          row.landlord_id
        ) ===
        systemSettingsText_(
          access
            .principal_landlord_id
        )
      );
    }
  ) ||
  null;
}


function systemSettingsFindDefaultPaymentAccount_(
  ss,
  workspaceId
) {
  const sheet =
    ss.getSheetByName(
      V2_SYSTEM_SETTINGS_SHEETS_
        .paymentAccounts
    );

  if (!sheet) {
    return null;
  }

  const rows =
    workspaceGetObjectsWithRow_(
      sheet
    ).filter(
      function (row) {
        return (
          systemSettingsText_(
            row.workspace_id
          ).toUpperCase() ===
          workspaceId &&
          systemSettingsText_(
            row.account_status ||
            'active'
          ).toLowerCase() !==
          'archived'
        );
      }
    );

  return rows.find(
    function (row) {
      return systemSettingsBoolean_(
        row.is_default
      );
    }
  ) ||
  rows[0] ||
  null;
}


function systemSettingsGetOrCreateWorkspaceSettings_(
  ss,
  access,
  createIfMissing
) {
  const sheet =
    ss.getSheetByName(
      V2_SYSTEM_SETTINGS_SHEETS_
        .settings
    );

  const workspaceId =
    systemSettingsText_(
      access.workspace
        .workspace_id
    ).toUpperCase();

  let setting =
    systemSettingsFindRow_(
      sheet,
      'workspace_id',
      workspaceId
    );

  if (
    setting ||
    createIfMissing !==
    true
  ) {
    return setting ||
    Object.assign(
      {
        workspace_id:
          workspaceId
      },
      V2_SYSTEM_SETTINGS_DEFAULTS_
    );
  }

  const now =
    new Date();

  const values =
    Object.assign(
      {
        workspace_setting_id:
          systemSettingsGenerateId_(
            'WST'
          ),

        workspace_id:
          workspaceId,

        created_by_user_id:
          access.user.user_id ||
          '',

        updated_by_user_id:
          access.user.user_id ||
          '',

        created_at:
          now,

        updated_at:
          now
      },
      V2_SYSTEM_SETTINGS_DEFAULTS_
    );

  systemSettingsAppendObject_(
    sheet,
    values
  );

  SpreadsheetApp.flush();

  setting =
    systemSettingsFindRow_(
      sheet,
      'workspace_id',
      workspaceId
    );

  return setting ||
  values;
}


function systemSettingsFindRow_(
  sheet,
  header,
  value
) {
  if (!sheet) {
    return null;
  }

  const expected =
    systemSettingsText_(
      value
    ).toUpperCase();

  return workspaceGetObjectsWithRow_(
    sheet
  ).find(
    function (row) {
      return (
        systemSettingsText_(
          row[
            header
          ]
        ).toUpperCase() ===
        expected
      );
    }
  ) ||
  null;
}


function systemSettingsSetRowValues_(
  sheet,
  rowNumber,
  values
) {
  if (
    !sheet ||
    rowNumber <
    2
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
        systemSettingsText_
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

      if (
        index >=
        0
      ) {
        row[
          index
        ] =
          values[
            header
          ];
      }
    }
  );

  /*
   * 手機號碼必須以純文字保存，避免 Google Sheets
   * 把 09 開頭轉成數字後移除前導 0。
   */
  [
    'phone',
    'landlord_phone',
    'tenant_phone'
  ].forEach(
    function (phoneHeader) {
      if (
        values &&
        values[
          phoneHeader
        ] !==
        undefined
      ) {
        const phoneIndex =
          headers.indexOf(
            phoneHeader
          );

        if (
          phoneIndex >=
          0
        ) {
          sheet
            .getRange(
              rowNumber,
              phoneIndex + 1
            )
            .setNumberFormat(
              '@'
            );

          row[
            phoneIndex
          ] =
            systemSettingsNormalizePhone_(
              values[
                phoneHeader
              ]
            );
        }
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


function systemSettingsAppendObject_(
  sheet,
  object
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
        systemSettingsText_
      );

  sheet.appendRow(
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
    )
  );
}


// ==================================================
// Schema and workbook capacity
// ==================================================

function systemSettingsEnsureSchema_() {
  if (
    typeof workspaceEnsureSchema_ ===
    'function'
  ) {
    workspaceEnsureSchema_();
  }

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  systemSettingsEnsureSheet_(
    ss,
    V2_SYSTEM_SETTINGS_SHEETS_
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

  systemSettingsEnsureSheet_(
    ss,
    V2_SYSTEM_SETTINGS_SHEETS_
      .settings,
    [
      'workspace_setting_id',
      'workspace_id',
      'locale',
      'timezone',
      'currency',
      'default_payment_day',
      'default_electricity_fee_rate',
      'summer_month_start',
      'summer_month_end',
      'summer_equipment_fee_rate',
      'regular_equipment_fee_rate',
      'default_management_fee',
      'default_deposit_months',
      'late_fee_type',
      'late_fee_value',
      'late_fee_grace_days',
      'auto_overdue_reminder',
      'overdue_reminder_hour',
      'overdue_reminder_days_json',
      'notify_bill_created',
      'notify_payment_report',
      'notify_tenant_message',
      'notify_overdue',
      'notify_contract',
      'notify_checkin',
      'notify_announcement_result',
      'notify_line_failure',
      'announcement_signature',
      'bill_message_footer',
      'created_by_user_id',
      'updated_by_user_id',
      'created_at',
      'updated_at'
    ]
  );

  systemSettingsEnsureHeaders_(
    ss.getSheetByName(
      V2_SYSTEM_SETTINGS_SHEETS_
        .workspaces
    ),
    [
      'default_payment_account_id'
    ]
  );

  systemSettingsEnsureHeaders_(
    ss.getSheetByName(
      V2_SYSTEM_SETTINGS_SHEETS_
        .landlords
    ),
    [
      'bank_code',
      'bank_name',
      'bank_branch',
      'bank_account',
      'bank_account_name',
      'payment_note',
      'default_payment_account_id'
    ]
  );

  return true;
}


function systemSettingsEnsureSheet_(
  ss,
  sheetName,
  headers
) {
  let sheet =
    ss.getSheetByName(
      sheetName
    );

  if (!sheet) {
    if (
      typeof announcementEnsureCapacityForNewSheet_ ===
      'function'
    ) {
      announcementEnsureCapacityForNewSheet_(
        ss,
        sheetName
      );
    } else {
      systemSettingsCompactWorkbookCapacity_(
        ss
      );
    }

    sheet =
      ss.insertSheet(
        sheetName
      );

    systemSettingsResizeNewSheet_(
      sheet,
      headers.length
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

  systemSettingsEnsureHeaders_(
    sheet,
    headers
  );

  return sheet;
}


function systemSettingsEnsureHeaders_(
  sheet,
  requiredHeaders
) {
  if (!sheet) {
    return;
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
        systemSettingsText_
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


function systemSettingsResizeNewSheet_(
  sheet,
  requiredColumns
) {
  const targetRows =
    100;

  const targetColumns =
    Math.max(
      requiredColumns,
      10
    );

  if (
    sheet.getMaxRows() >
    targetRows
  ) {
    sheet.deleteRows(
      targetRows + 1,
      sheet.getMaxRows() -
      targetRows
    );
  }

  if (
    sheet.getMaxColumns() >
    targetColumns
  ) {
    sheet.deleteColumns(
      targetColumns + 1,
      sheet.getMaxColumns() -
      targetColumns
    );
  }

  if (
    sheet.getMaxColumns() <
    requiredColumns
  ) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      requiredColumns -
      sheet.getMaxColumns()
    );
  }
}


function systemSettingsCompactWorkbookCapacity_(
  ss
) {
  ss.getSheets().forEach(
    function (sheet) {
      const lastRow =
        Math.max(
          sheet.getLastRow(),
          1
        );

      const lastColumn =
        Math.max(
          sheet.getLastColumn(),
          1
        );

      const targetRows =
        Math.max(
          lastRow +
          50,
          100
        );

      const targetColumns =
        Math.max(
          lastColumn +
          2,
          10
        );

      if (
        sheet.getMaxRows() >
        targetRows
      ) {
        sheet.deleteRows(
          targetRows + 1,
          sheet.getMaxRows() -
          targetRows
        );
      }

      if (
        sheet.getMaxColumns() >
        targetColumns
      ) {
        sheet.deleteColumns(
          targetColumns + 1,
          sheet.getMaxColumns() -
          targetColumns
        );
      }
    }
  );

  SpreadsheetApp.flush();
}


// ==================================================
// Existing phone-data repair
// ==================================================

function systemSettingsRepairPhoneLeadingZeros_() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const targets = [
    {
      sheet_name:
        V2_SYSTEM_SETTINGS_SHEETS_
          .users,
      headers: [
        'phone'
      ]
    },
    {
      sheet_name:
        V2_SYSTEM_SETTINGS_SHEETS_
          .landlords,
      headers: [
        'landlord_phone',
        'phone'
      ]
    },
    {
      sheet_name:
        V2_SYSTEM_SETTINGS_SHEETS_
          .members,
      headers: [
        'phone'
      ]
    }
  ];

  const changes = [];
  const errors = [];

  targets.forEach(
    function (target) {
      const sheet =
        ss.getSheetByName(
          target.sheet_name
        );

      if (
        !sheet ||
        sheet.getLastRow() <
        2
      ) {
        return;
      }

      try {
        const lastColumn =
          sheet.getLastColumn();

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
              systemSettingsText_
            );

        target.headers.forEach(
          function (phoneHeader) {
            const columnIndex =
              headers.indexOf(
                phoneHeader
              );

            if (
              columnIndex <
              0
            ) {
              return;
            }

            const rowCount =
              sheet.getLastRow() -
              1;

            const range =
              sheet.getRange(
                2,
                columnIndex + 1,
                rowCount,
                1
              );

            const values =
              range.getValues();

            let changedCount =
              0;

            values.forEach(
              function (row) {
                const before =
                  systemSettingsText_(
                    row[0]
                  );

                const after =
                  systemSettingsNormalizePhone_(
                    before
                  );

                if (
                  after &&
                  after !==
                  before
                ) {
                  row[0] =
                    after;

                  changedCount +=
                    1;
                }
              }
            );

            range.setNumberFormat(
              '@'
            );

            if (
              changedCount >
              0
            ) {
              range.setValues(
                values
              );
            }

            changes.push({
              sheet_name:
                target.sheet_name,

              phone_header:
                phoneHeader,

              changed_count:
                changedCount
            });
          }
        );

      } catch (error) {
        errors.push({
          sheet_name:
            target.sheet_name,

          message:
            error.message
        });
      }
    }
  );

  SpreadsheetApp.flush();

  return {
    success:
      errors.length ===
      0,

    total_changed:
      changes.reduce(
        function (total, item) {
          return (
            total +
            item.changed_count
          );
        },
        0
      ),

    changes:
      changes,

    errors:
      errors
  };
}


// ==================================================
// Formatting and parsing
// ==================================================

function systemSettingsParsePayload_(
  value
) {
  if (
    value &&
    typeof value ===
    'object'
  ) {
    return value;
  }

  const text =
    systemSettingsText_(
      value
    );

  if (!text) {
    return {};
  }

  const parsed =
    JSON.parse(
      text
    );

  if (
    !parsed ||
    typeof parsed !==
    'object' ||
    Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      '設定資料格式不正確'
    );
  }

  return parsed;
}


function systemSettingsParseReminderDays_(
  value
) {
  let values =
    value;

  if (
    !Array.isArray(
      values
    )
  ) {
    const text =
      systemSettingsText_(
        value
      );

    if (!text) {
      values = [
        1,
        3,
        7
      ];

    } else {
      try {
        values =
          JSON.parse(
            text
          );
      } catch (error) {
        values =
          text.split(
            ','
          );
      }
    }
  }

  if (
    !Array.isArray(
      values
    )
  ) {
    values = [];
  }

  const unique = {};

  return values
    .map(
      function (item) {
        return Math.round(
          Number(
            item
          )
        );
      }
    )
    .filter(
      function (item) {
        if (
          !Number.isFinite(
            item
          ) ||
          item <
          0 ||
          item >
          365 ||
          unique[
            item
          ]
        ) {
          return false;
        }

        unique[
          item
        ] = true;

        return true;
      }
    )
    .sort(
      function (a, b) {
        return a - b;
      }
    );
}


function systemSettingsNormalizeTimezone_(
  value
) {
  const timezone =
    systemSettingsText_(
      value
    );

  return [
    'Asia/Taipei',
    'Asia/Tokyo'
  ].indexOf(
    timezone
  ) >=
  0
    ? timezone
    : V2_SYSTEM_SETTINGS_DEFAULTS_
        .timezone;
}


function systemSettingsNormalizeCurrency_(
  value
) {
  const currency =
    systemSettingsText_(
      value
    ).toUpperCase();

  return [
    'TWD',
    'JPY'
  ].indexOf(
    currency
  ) >=
  0
    ? currency
    : V2_SYSTEM_SETTINGS_DEFAULTS_
        .currency;
}


function systemSettingsNormalizeLateFeeType_(
  value
) {
  const type =
    systemSettingsText_(
      value
    ).toLowerCase();

  return [
    'none',
    'fixed',
    'percent'
  ].indexOf(
    type
  ) >=
  0
    ? type
    : 'none';
}


function systemSettingsNormalizePhone_(
  value
) {
  let phone =
    systemSettingsText_(
      value
    )
      .replace(
        /^'/,
        ''
      )
      .replace(
        /[\s\-()]/g,
        ''
      );

  if (
    phone.indexOf(
      '+886'
    ) ===
    0
  ) {
    phone =
      '0' +
      phone.slice(
        4
      );

  } else if (
    phone.indexOf(
      '886'
    ) ===
    0
  ) {
    phone =
      '0' +
      phone.slice(
        3
      );
  }

  /*
   * Google Sheets 若曾把 0911476660 當成數字，
   * 讀回來會變成 911476660。台灣手機號碼為
   * 9 位且以 9 開頭時，自動補回最前面的 0。
   */
  if (
    /^9\d{8}$/.test(
      phone
    )
  ) {
    phone =
      '0' +
      phone;
  }

  return phone;
}


function systemSettingsMaskBankAccount_(
  account
) {
  account =
    systemSettingsText_(
      account
    );

  if (!account) {
    return '';
  }

  if (
    account.length <=
    4
  ) {
    return account;
  }

  return (
    '••••••' +
    account.slice(
      -4
    )
  );
}


function systemSettingsBooleanDefault_(
  value,
  defaultValue
) {
  if (
    value ===
      '' ||
    value ===
      null ||
    value ===
      undefined
  ) {
    return defaultValue;
  }

  return systemSettingsBoolean_(
    value
  );
}


function systemSettingsBoolean_(
  value
) {
  if (
    value ===
    true
  ) {
    return true;
  }

  const text =
    systemSettingsText_(
      value
    ).toLowerCase();

  return [
    '1',
    'true',
    'yes',
    'y',
    'on',
    'active',
    'enabled'
  ].indexOf(
    text
  ) >=
  0;
}


function systemSettingsIntegerInRange_(
  value,
  min,
  max,
  fallback
) {
  const number =
    Math.round(
      Number(
        value
      )
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <
    min ||
    number >
    max
  ) {
    return fallback;
  }

  return number;
}


function systemSettingsNumberInRange_(
  value,
  min,
  max,
  fallback
) {
  const number =
    Number(
      systemSettingsText_(
        value
      ).replace(
        /,/g,
        ''
      )
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <
    min ||
    number >
    max
  ) {
    return fallback;
  }

  return number;
}


function systemSettingsGenerateId_(
  prefix
) {
  return (
    prefix +
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


function systemSettingsAudit_(
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
    // 稽核失敗不阻擋設定儲存。
  }
}


function systemSettingsText_(
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


// ==================================================
// Tests
// ==================================================

function testRepairSystemSettingsPhoneLeadingZeros() {
  const result =
    systemSettingsRepairPhoneLeadingZeros_();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


function testEnsureSystemSettingsSchema() {
  systemSettingsEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const result = {
    success:
      true,

    settings_columns:
      ss.getSheetByName(
        V2_SYSTEM_SETTINGS_SHEETS_
          .settings
      ).getLastColumn(),

    payment_account_columns:
      ss.getSheetByName(
        V2_SYSTEM_SETTINGS_SHEETS_
          .paymentAccounts
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


function testLandlordSettingsInit() {
  const result =
    getLandlordSettingsInitByLineUid_(
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
