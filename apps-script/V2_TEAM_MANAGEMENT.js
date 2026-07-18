
/**
 * CMWebs V2 團隊管理與邀請
 *
 * API:
 * landlord_team_init
 * landlord_team_invite_create
 * landlord_team_invite_cancel
 * landlord_team_member_update
 * landlord_team_member_remove
 * landlord_invitation_init
 * landlord_invitation_accept
 *
 * 依賴 V2_WORKSPACES.gs
 */

const V2_TEAM_JOIN_URL_ =
  'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-join.html';

const V2_TEAM_ASSIGNABLE_ROLES_ = [
  'admin',
  'manager',
  'accountant',
  'maintenance',
  'viewer'
];

function getLandlordTeamInitByLineUid_(lineUserId) {
  try {
    const access = teamAccess_(lineUserId, true);

    if (!access.success) {
      return access;
    }

    teamEnsureSchema_();

    return workspaceResult_(
      true,
      'OK',
      '團隊資料載入成功',
      teamBuildData_(access)
    );
  } catch (error) {
    return workspaceResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' + error.message
    );
  }
}


function createLandlordTeamInvitationByLineUid_(
  lineUserId,
  inviteName,
  inviteRole,
  invitePhone,
  inviteEmail,
  expiresDays,
  note
) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    const access = teamAccess_(lineUserId, true);

    if (!access.success) {
      return access;
    }

    inviteName = workspaceText_(inviteName);
    inviteRole = workspaceText_(inviteRole).toLowerCase();
    invitePhone = workspaceNormalizeTaiwanPhone_(invitePhone);
    inviteEmail = workspaceText_(inviteEmail).toLowerCase();
    expiresDays = Number(expiresDays || 7);
    note = workspaceText_(note);

    const roleCheck = teamCanAssignRole_(
      access.membership.role,
      inviteRole
    );

    if (!roleCheck.success) {
      return roleCheck;
    }

    if (!invitePhone && !inviteEmail) {
      return workspaceResult_(
        false,
        'CONTACT_REQUIRED',
        '請至少輸入手機號碼或 Email'
      );
    }

    if (invitePhone && !/^09\d{8}$/.test(invitePhone)) {
      return workspaceResult_(
        false,
        'INVALID_PHONE',
        '手機號碼格式不正確'
      );
    }

    if (inviteEmail && !workspaceValidEmail_(inviteEmail)) {
      return workspaceResult_(
        false,
        'INVALID_EMAIL',
        'Email 格式不正確'
      );
    }

    if (
      !Number.isInteger(expiresDays) ||
      expiresDays < 1 ||
      expiresDays > 30
    ) {
      return workspaceResult_(
        false,
        'INVALID_EXPIRY',
        '邀請有效天數必須介於 1 至 30 天'
      );
    }

    teamEnsureSchema_();

    lock.waitLock(20000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const workspaceId = workspaceText_(
      access.workspace.workspace_id
    ).toUpperCase();

    teamExpireInvitations_(ss, workspaceId);

    const users = workspaceGetObjectsWithRow_(
      ss.getSheetByName(V2_WORKSPACE_SHEETS_.users)
    );

    const members = workspaceGetObjectsWithRow_(
      ss.getSheetByName(V2_WORKSPACE_SHEETS_.members)
    );

    const matchedUser = users.find(function (user) {
      const phone = workspaceNormalizeTaiwanPhone_(user.phone);
      const email = workspaceText_(user.email).toLowerCase();

      return (
        (invitePhone && phone === invitePhone) ||
        (inviteEmail && email === inviteEmail)
      );
    });

    if (matchedUser) {
      const existing = members.find(function (member) {
        return (
          workspaceText_(member.workspace_id).toUpperCase() ===
            workspaceId &&
          workspaceText_(member.user_id) ===
            workspaceText_(matchedUser.user_id) &&
          workspaceText_(member.member_status).toLowerCase() !==
            'removed'
        );
      });

      if (existing) {
        return workspaceResult_(
          false,
          'ALREADY_MEMBER',
          '此聯絡資料已屬於目前團隊成員'
        );
      }
    }

    const invitationSheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.invitations
    );

    const duplicate = workspaceGetObjectsWithRow_(
      invitationSheet
    ).find(function (row) {
      const sameWorkspace =
        workspaceText_(row.workspace_id).toUpperCase() ===
        workspaceId;

      const pending =
        workspaceText_(row.status).toLowerCase() ===
        'pending';

      const samePhone =
        Boolean(
          invitePhone &&
          workspaceNormalizeTaiwanPhone_(row.invite_phone) ===
            invitePhone
        );

      const sameEmail =
        Boolean(
          inviteEmail &&
          workspaceText_(row.invite_email).toLowerCase() ===
            inviteEmail
        );

      return sameWorkspace && pending && (samePhone || sameEmail);
    });

    if (duplicate) {
      return workspaceResult_(
        false,
        'PENDING_INVITATION_EXISTS',
        '此聯絡資料已有待接受邀請'
      );
    }

    const now = new Date();
    const invitationId = workspaceNextId_(
      invitationSheet,
      'invitation_id',
      'WI',
      6
    );

    const token =
      Utilities.getUuid().replace(/-/g, '') +
      Utilities.getUuid().replace(/-/g, '').slice(0, 12);

    const expiresAt = new Date(
      now.getTime() +
      expiresDays * 24 * 60 * 60 * 1000
    );

    const invitationUrl =
      V2_TEAM_JOIN_URL_ +
      '?token=' +
      encodeURIComponent(token);

    teamEnsurePhoneTextColumn_(
      invitationSheet,
      'invite_phone'
    );

    workspaceAppendObject_(
      invitationSheet,
      {
        invitation_id: invitationId,
        workspace_id: workspaceId,
        invite_name: inviteName,
        invite_role: inviteRole,
        invite_phone: invitePhone,
        invite_email: inviteEmail,
        invite_token: token,
        invitation_url: invitationUrl,
        expires_at: expiresAt,
        status: 'pending',
        invited_by_user_id: access.user.user_id || '',
        invited_by_membership_id:
          access.membership.membership_id || '',
        accepted_by_user_id: '',
        accepted_by_line_user_id: '',
        accepted_at: '',
        cancelled_by_user_id: '',
        cancelled_at: '',
        created_at: now,
        updated_at: now,
        note: note
      }
    );

    workspaceWriteActivityLog_({
      workspace_id: workspaceId,
      user_id: access.user.user_id || '',
      membership_id:
        access.membership.membership_id || '',
      line_user_id: access.lineUserId,
      action: 'team_invitation_created',
      target_type: 'workspace_invitation',
      target_id: invitationId,
      result: 'success',
      detail: 'role=' + inviteRole
    });

    return workspaceResult_(
      true,
      'INVITATION_CREATED',
      '團隊邀請已建立',
      {
        invitation: {
          invitation_id: invitationId,
          invite_name: inviteName,
          invite_role: inviteRole,
          invite_phone:
            workspaceNormalizeTaiwanPhone_(
              invitePhone
            ),
          invite_email: inviteEmail,
          invitation_url: invitationUrl,
          expires_at: expiresAt,
          status: 'pending'
        },
        team: teamBuildData_(access)
      }
    );
  } catch (error) {
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


function cancelLandlordTeamInvitationByLineUid_(
  lineUserId,
  invitationId
) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    const access = teamAccess_(lineUserId, true);

    if (!access.success) {
      return access;
    }

    invitationId = workspaceText_(invitationId);

    if (!invitationId) {
      return workspaceResult_(
        false,
        'MISSING_INVITATION_ID',
        '缺少邀請編號'
      );
    }

    teamEnsureSchema_();

    lock.waitLock(15000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.invitations
    );

    const invitation = workspaceGetObjectsWithRow_(
      sheet
    ).find(function (row) {
      return (
        workspaceText_(row.invitation_id) === invitationId &&
        workspaceText_(row.workspace_id).toUpperCase() ===
          workspaceText_(access.workspace.workspace_id).toUpperCase()
      );
    });

    if (!invitation) {
      return workspaceResult_(
        false,
        'INVITATION_NOT_FOUND',
        '找不到指定邀請'
      );
    }

    if (
      workspaceText_(invitation.status).toLowerCase() !==
      'pending'
    ) {
      return workspaceResult_(
        false,
        'INVITATION_NOT_PENDING',
        '此邀請已無法取消'
      );
    }

    const now = new Date();

    teamSetValues_(
      sheet,
      invitation.__row_number,
      {
        status: 'cancelled',
        cancelled_by_user_id: access.user.user_id || '',
        cancelled_at: now,
        updated_at: now
      }
    );

    return workspaceResult_(
      true,
      'INVITATION_CANCELLED',
      '邀請已取消',
      teamBuildData_(access)
    );
  } catch (error) {
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


function updateLandlordTeamMemberByLineUid_(
  lineUserId,
  membershipId,
  newRole,
  newStatus
) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    const access = teamAccess_(lineUserId, true);

    if (!access.success) {
      return access;
    }

    membershipId = workspaceText_(membershipId);
    newRole = workspaceText_(newRole).toLowerCase();
    newStatus = workspaceText_(newStatus || 'active').toLowerCase();

    if (!membershipId) {
      return workspaceResult_(
        false,
        'MISSING_MEMBERSHIP_ID',
        '缺少成員編號'
      );
    }

    const roleCheck = teamCanAssignRole_(
      access.membership.role,
      newRole
    );

    if (!roleCheck.success) {
      return roleCheck;
    }

    if (['active', 'suspended'].indexOf(newStatus) === -1) {
      return workspaceResult_(
        false,
        'INVALID_MEMBER_STATUS',
        '不支援的成員狀態'
      );
    }

    teamEnsureSchema_();

    lock.waitLock(15000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.members
    );

    const target = workspaceGetObjectsWithRow_(
      sheet
    ).find(function (row) {
      return (
        workspaceText_(row.membership_id) === membershipId &&
        workspaceText_(row.workspace_id).toUpperCase() ===
          workspaceText_(access.workspace.workspace_id).toUpperCase()
      );
    });

    if (!target) {
      return workspaceResult_(
        false,
        'MEMBER_NOT_FOUND',
        '找不到指定團隊成員'
      );
    }

    if (
      workspaceText_(target.membership_id) ===
      workspaceText_(access.membership.membership_id)
    ) {
      return workspaceResult_(
        false,
        'SELF_UPDATE_NOT_ALLOWED',
        '不能修改自己的角色或停用自己的資格'
      );
    }

    if (
      workspaceText_(target.role).toLowerCase() ===
      'owner'
    ) {
      return workspaceResult_(
        false,
        'OWNER_PROTECTED',
        '團隊擁有者不能在此處修改'
      );
    }

    const permissions = workspaceDefaultPermissions_(newRole);

    teamSetValues_(
      sheet,
      target.__row_number,
      {
        role: newRole,
        member_status: newStatus,
        updated_at: new Date(),
        can_manage_team: permissions.can_manage_team,
        can_edit_bank_account:
          permissions.can_edit_bank_account,
        can_approve_payment:
          permissions.can_approve_payment,
        can_edit_contract:
          permissions.can_edit_contract,
        can_terminate_contract:
          permissions.can_terminate_contract,
        can_delete_data:
          permissions.can_delete_data,
        can_export_data:
          permissions.can_export_data
      }
    );

    return workspaceResult_(
      true,
      'MEMBER_UPDATED',
      '成員資料已更新',
      teamBuildData_(access)
    );
  } catch (error) {
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


function removeLandlordTeamMemberByLineUid_(
  lineUserId,
  membershipId
) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    const access = teamAccess_(lineUserId, true);

    if (!access.success) {
      return access;
    }

    membershipId = workspaceText_(membershipId);

    teamEnsureSchema_();

    lock.waitLock(15000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.members
    );

    const target = workspaceGetObjectsWithRow_(
      sheet
    ).find(function (row) {
      return (
        workspaceText_(row.membership_id) === membershipId &&
        workspaceText_(row.workspace_id).toUpperCase() ===
          workspaceText_(access.workspace.workspace_id).toUpperCase()
      );
    });

    if (!target) {
      return workspaceResult_(
        false,
        'MEMBER_NOT_FOUND',
        '找不到指定團隊成員'
      );
    }

    if (
      workspaceText_(target.membership_id) ===
      workspaceText_(access.membership.membership_id)
    ) {
      return workspaceResult_(
        false,
        'SELF_REMOVE_NOT_ALLOWED',
        '不能將自己移出目前團隊'
      );
    }

    if (
      workspaceText_(target.role).toLowerCase() ===
      'owner'
    ) {
      return workspaceResult_(
        false,
        'OWNER_PROTECTED',
        '團隊擁有者不能直接移除'
      );
    }

    teamSetValues_(
      sheet,
      target.__row_number,
      {
        member_status: 'removed',
        is_primary: false,
        updated_at: new Date()
      }
    );

    return workspaceResult_(
      true,
      'MEMBER_REMOVED',
      '成員已移出團隊',
      teamBuildData_(access)
    );
  } catch (error) {
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


function getLandlordInvitationInit_(
  inviteToken,
  lineUserId
) {
  try {
    teamEnsureSchema_();

    inviteToken = workspaceText_(inviteToken);
    lineUserId = workspaceText_(lineUserId);

    if (!inviteToken) {
      return workspaceResult_(
        false,
        'MISSING_INVITE_TOKEN',
        '邀請連結缺少 token'
      );
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let invitation = teamFindInvitation_(ss, inviteToken);

    if (!invitation) {
      return workspaceResult_(
        false,
        'INVITATION_NOT_FOUND',
        '找不到此團隊邀請'
      );
    }

    teamExpireInvitation_(ss, invitation);
    invitation = teamFindInvitation_(ss, inviteToken);

    const workspace = workspaceGetObjectsWithRow_(
      ss.getSheetByName(V2_WORKSPACE_SHEETS_.workspaces)
    ).find(function (row) {
      return (
        workspaceText_(row.workspace_id).toUpperCase() ===
        workspaceText_(invitation.workspace_id).toUpperCase()
      );
    }) || {};

    let user = null;
    let membership = null;

    if (lineUserId) {
      user = workspaceGetObjectsWithRow_(
        ss.getSheetByName(V2_WORKSPACE_SHEETS_.users)
      ).find(function (row) {
        return workspaceText_(row.line_user_id) === lineUserId;
      }) || null;

      if (user) {
        membership = workspaceGetObjectsWithRow_(
          ss.getSheetByName(V2_WORKSPACE_SHEETS_.members)
        ).find(function (row) {
          return (
            workspaceText_(row.workspace_id).toUpperCase() ===
              workspaceText_(invitation.workspace_id).toUpperCase() &&
            workspaceText_(row.user_id) ===
              workspaceText_(user.user_id) &&
            workspaceText_(row.member_status).toLowerCase() !==
              'removed'
          );
        }) || null;
      }
    }

    const alreadyMember =
      Boolean(
        membership &&
        workspaceIsActiveStatus_(
          membership.member_status || 'active'
        )
      );

    const status = workspaceText_(invitation.status).toLowerCase();

    return workspaceResult_(
      true,
      'OK',
      '邀請資料載入成功',
      {
        invitation: {
          invitation_id: invitation.invitation_id || '',
          workspace_id: invitation.workspace_id || '',
          workspace_name: workspace.workspace_name || '',
          invite_name: invitation.invite_name || '',
          invite_role: invitation.invite_role || '',
          invite_phone_masked:
            teamMaskPhone_(invitation.invite_phone),
          invite_email_masked:
            teamMaskEmail_(invitation.invite_email),
          expires_at: invitation.expires_at || '',
          status: status,
          note: invitation.note || ''
        },
        existing_user: user
          ? {
              user_id: user.user_id || '',
              name: user.name || '',
              phone: user.phone || '',
              email: user.email || ''
            }
          : null,
        existing_membership: membership
          ? {
              membership_id: membership.membership_id || '',
              role: membership.role || '',
              member_status: membership.member_status || ''
            }
          : null,
        already_member: alreadyMember,
        can_accept:
          status === 'pending' &&
          !alreadyMember &&
          workspaceIsActiveStatus_(
            workspace.account_status || 'active'
          )
      }
    );
  } catch (error) {
    return workspaceResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' + error.message
    );
  }
}


function acceptLandlordInvitationByLineUid_(
  lineUserId,
  inviteToken,
  displayName,
  phone,
  email,
  profileDisplayName,
  profilePictureUrl
) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    teamEnsureSchema_();

    lineUserId = workspaceText_(lineUserId);
    inviteToken = workspaceText_(inviteToken);
    displayName = workspaceText_(displayName);
    phone = workspaceNormalizeTaiwanPhone_(phone);
    email = workspaceText_(email).toLowerCase();

    if (!lineUserId) {
      return workspaceResult_(
        false,
        'MISSING_LINE_UID',
        '無法取得 LINE User ID'
      );
    }

    lock.waitLock(20000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let invitation = teamFindInvitation_(ss, inviteToken);

    if (!invitation) {
      return workspaceResult_(
        false,
        'INVITATION_NOT_FOUND',
        '找不到此團隊邀請'
      );
    }

    teamExpireInvitation_(ss, invitation);
    invitation = teamFindInvitation_(ss, inviteToken);

    const status = workspaceText_(invitation.status).toLowerCase();

    if (status !== 'pending') {
      return workspaceResult_(
        false,
        'INVITATION_NOT_AVAILABLE',
        status === 'expired'
          ? '此邀請已過期'
          : status === 'cancelled'
            ? '此邀請已取消'
            : '此邀請已被使用'
      );
    }

    const requiredPhone =
      workspaceNormalizeTaiwanPhone_(invitation.invite_phone);

    const requiredEmail =
      workspaceText_(invitation.invite_email).toLowerCase();

    if (requiredPhone && phone !== requiredPhone) {
      return workspaceResult_(
        false,
        'PHONE_MISMATCH',
        '手機號碼與邀請資料不一致'
      );
    }

    if (requiredEmail && email !== requiredEmail) {
      return workspaceResult_(
        false,
        'EMAIL_MISMATCH',
        'Email 與邀請資料不一致'
      );
    }

    if (phone && !/^09\d{8}$/.test(phone)) {
      return workspaceResult_(
        false,
        'INVALID_PHONE',
        '手機號碼格式不正確'
      );
    }

    if (email && !workspaceValidEmail_(email)) {
      return workspaceResult_(
        false,
        'INVALID_EMAIL',
        'Email 格式不正確'
      );
    }

    const workspace = workspaceGetObjectsWithRow_(
      ss.getSheetByName(V2_WORKSPACE_SHEETS_.workspaces)
    ).find(function (row) {
      return (
        workspaceText_(row.workspace_id).toUpperCase() ===
        workspaceText_(invitation.workspace_id).toUpperCase()
      );
    });

    if (
      !workspace ||
      !workspaceIsActiveStatus_(
        workspace.account_status || 'active'
      )
    ) {
      return workspaceResult_(
        false,
        'WORKSPACE_INACTIVE',
        '此管理團隊目前無法加入'
      );
    }

    const usersSheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.users
    );

    const membersSheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.members
    );

    let user = workspaceGetObjectsWithRow_(
      usersSheet
    ).find(function (row) {
      return workspaceText_(row.line_user_id) === lineUserId;
    }) || null;

    const now = new Date();

    if (user) {
      if (
        !workspaceIsActiveStatus_(
          user.account_status || 'active'
        )
      ) {
        return workspaceResult_(
          false,
          'USER_ACCOUNT_INACTIVE',
          '此使用者帳號目前不是啟用狀態'
        );
      }

      displayName =
        displayName ||
        user.name ||
        profileDisplayName;

      if (!displayName) {
        return workspaceResult_(
          false,
          'NAME_REQUIRED',
          '請輸入姓名'
        );
      }

      teamSetValues_(
        usersSheet,
        user.__row_number,
        {
          name: displayName,
          phone: phone || user.phone || '',
          email: email || user.email || '',
          active_workspace_id: invitation.workspace_id,
          profile_display_name:
            profileDisplayName ||
            user.profile_display_name ||
            '',
          profile_picture_url:
            profilePictureUrl ||
            user.profile_picture_url ||
            '',
          updated_at: now
        }
      );

      user = workspaceGetObjectsWithRow_(
        usersSheet
      ).find(function (row) {
        return workspaceText_(row.line_user_id) === lineUserId;
      });
    } else {
      displayName =
        displayName ||
        profileDisplayName ||
        invitation.invite_name;

      if (!displayName) {
        return workspaceResult_(
          false,
          'NAME_REQUIRED',
          '請輸入姓名'
        );
      }

      const duplicate = workspaceGetObjectsWithRow_(
        usersSheet
      ).find(function (row) {
        return (
          (phone &&
            workspaceNormalizeTaiwanPhone_(row.phone) === phone) ||
          (email &&
            workspaceText_(row.email).toLowerCase() === email)
        );
      });

      if (duplicate) {
        return workspaceResult_(
          false,
          'CONTACT_ALREADY_REGISTERED',
          '此手機或 Email 已屬於其他 LINE 帳號'
        );
      }

      const userId = workspaceNextId_(
        usersSheet,
        'user_id',
        'U',
        6
      );

      workspaceAppendObject_(
        usersSheet,
        {
          user_id: userId,
          created_at: now,
          updated_at: now,
          role: 'landlord',
          name: displayName,
          phone: phone,
          email: email,
          line_user_id: lineUserId,
          account_status: 'active',
          active_workspace_id: invitation.workspace_id,
          profile_display_name: profileDisplayName,
          profile_picture_url: profilePictureUrl,
          note: 'Created from workspace invitation'
        }
      );

      user = workspaceGetObjectsWithRow_(
        usersSheet
      ).find(function (row) {
        return workspaceText_(row.user_id) === userId;
      });
    }

    const workspaceId =
      workspaceText_(invitation.workspace_id).toUpperCase();

    let membership = workspaceGetObjectsWithRow_(
      membersSheet
    ).find(function (row) {
      return (
        workspaceText_(row.workspace_id).toUpperCase() ===
          workspaceId &&
        workspaceText_(row.user_id) ===
          workspaceText_(user.user_id)
      );
    }) || null;

    const role = workspaceText_(invitation.invite_role).toLowerCase();
    const permissions = workspaceDefaultPermissions_(role);

    const memberValues = {
      role: role,
      member_status: 'active',
      joined_at:
        membership && membership.joined_at
          ? membership.joined_at
          : now,
      invited_by_user_id:
        invitation.invited_by_user_id || '',
      updated_at: now,
      display_name: user.name || '',
      line_user_id: lineUserId,
      phone: user.phone || '',
      email: user.email || '',
      can_manage_team: permissions.can_manage_team,
      can_edit_bank_account:
        permissions.can_edit_bank_account,
      can_approve_payment:
        permissions.can_approve_payment,
      can_edit_contract:
        permissions.can_edit_contract,
      can_terminate_contract:
        permissions.can_terminate_contract,
      can_delete_data:
        permissions.can_delete_data,
      can_export_data:
        permissions.can_export_data,
      note: 'Accepted workspace invitation'
    };

    if (membership) {
      teamSetValues_(
        membersSheet,
        membership.__row_number,
        memberValues
      );
    } else {
      const membershipId = workspaceNextId_(
        membersSheet,
        'membership_id',
        'WM',
        6
      );

      workspaceAppendObject_(
        membersSheet,
        Object.assign(
          {
            membership_id: membershipId,
            workspace_id: workspaceId,
            user_id: user.user_id,
            is_primary: false,
            created_at: now
          },
          memberValues
        )
      );
    }

    const invitationSheet = ss.getSheetByName(
      V2_WORKSPACE_SHEETS_.invitations
    );

    teamSetValues_(
      invitationSheet,
      invitation.__row_number,
      {
        status: 'accepted',
        accepted_by_user_id: user.user_id || '',
        accepted_by_line_user_id: lineUserId,
        accepted_at: now,
        updated_at: now
      }
    );

    return workspaceResult_(
      true,
      'INVITATION_ACCEPTED',
      '已加入管理團隊',
      {
        route:
          workspaceOnboardingComplete_(workspace.onboarding_status)
            ? 'home'
            : 'entry',
        workspace_id: workspaceId,
        workspace_name: workspace.workspace_name || '',
        role: role
      }
    );
  } catch (error) {
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


// -------------------- helpers --------------------

function teamAccess_(lineUserId, requireManageTeam) {
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

  workspaceEnsureLegacyLandlordContext_(ss, lineUserId);

  const context = workspaceResolveContextByLineUid_(ss, lineUserId);

  if (!context.user) {
    return workspaceResult_(
      false,
      'REGISTRATION_REQUIRED',
      '請先建立房東帳號'
    );
  }

  if (!context.activeWorkspace || !context.activeMembership) {
    return workspaceResult_(
      false,
      'WORKSPACE_REQUIRED',
      '找不到目前管理團隊'
    );
  }

  const permissions = workspaceBuildPermissionView_(
    context.activeMembership
  );

  if (
    requireManageTeam &&
    !permissions.can_manage_team
  ) {
    return workspaceResult_(
      false,
      'PERMISSION_DENIED',
      '目前角色沒有管理團隊的權限'
    );
  }

  return {
    success: true,
    lineUserId: lineUserId,
    context: context,
    user: context.user,
    workspace: context.activeWorkspace,
    membership: context.activeMembership,
    permissions: permissions
  };
}


function teamBuildData_(access) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const workspaceId = workspaceText_(
    access.workspace.workspace_id
  ).toUpperCase();

  teamExpireInvitations_(ss, workspaceId);

  const users = workspaceGetObjectsWithRow_(
    ss.getSheetByName(V2_WORKSPACE_SHEETS_.users)
  );

  const userMap = {};

  users.forEach(function (user) {
    userMap[workspaceText_(user.user_id)] = user;
  });

  const members = workspaceGetObjectsWithRow_(
    ss.getSheetByName(V2_WORKSPACE_SHEETS_.members)
  )
    .filter(function (member) {
      return (
        workspaceText_(member.workspace_id).toUpperCase() ===
          workspaceId &&
        workspaceText_(member.member_status).toLowerCase() !==
          'removed'
      );
    })
    .map(function (member) {
      const user =
        userMap[workspaceText_(member.user_id)] || {};

      return {
        membership_id: member.membership_id || '',
        user_id: member.user_id || '',
        name:
          user.name ||
          member.display_name ||
          '未命名成員',
        phone: user.phone || member.phone || '',
        email: user.email || member.email || '',
        role: member.role || '',
        role_label: teamRoleLabel_(member.role),
        member_status: member.member_status || '',
        is_self:
          workspaceText_(member.membership_id) ===
          workspaceText_(access.membership.membership_id),
        protected:
          workspaceText_(member.role).toLowerCase() ===
          'owner',
        joined_at: member.joined_at || ''
      };
    })
    .sort(function (a, b) {
      const order = {
        owner: 0,
        admin: 1,
        manager: 2,
        accountant: 3,
        maintenance: 4,
        viewer: 5
      };

      return (
        (order[a.role] === undefined ? 99 : order[a.role]) -
        (order[b.role] === undefined ? 99 : order[b.role])
      );
    });

  const invitations = workspaceGetObjectsWithRow_(
    ss.getSheetByName(V2_WORKSPACE_SHEETS_.invitations)
  )
    .filter(function (row) {
      return (
        workspaceText_(row.workspace_id).toUpperCase() ===
        workspaceId
      );
    })
    .map(function (row) {
      return {
        invitation_id: row.invitation_id || '',
        invite_name: row.invite_name || '',
        invite_role: row.invite_role || '',
        role_label: teamRoleLabel_(row.invite_role),
        invite_phone:
          workspaceNormalizeTaiwanPhone_(
            row.invite_phone
          ),
        invite_email: row.invite_email || '',
        invitation_url:
          row.invitation_url ||
          V2_TEAM_JOIN_URL_ +
            '?token=' +
            encodeURIComponent(row.invite_token || ''),
        expires_at: row.expires_at || '',
        status: row.status || '',
        created_at: row.created_at || '',
        note: row.note || ''
      };
    })
    .sort(function (a, b) {
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });

  return {
    user: workspaceBuildUserView_(access.user),
    workspace: workspaceBuildWorkspaceView_(access.workspace),
    current_membership:
      workspaceBuildMembershipView_(access.membership),
    permissions: access.permissions,
    summary: {
      member_count: members.length,
      active_member_count:
        members.filter(function (member) {
          return workspaceIsActiveStatus_(
            member.member_status || 'active'
          );
        }).length,
      pending_invitation_count:
        invitations.filter(function (invitation) {
          return (
            workspaceText_(invitation.status).toLowerCase() ===
            'pending'
          );
        }).length
    },
    members: members,
    invitations: invitations,
    role_options:
      teamRoleOptions_(access.membership.role)
  };
}


function teamCanAssignRole_(actorRole, targetRole) {
  actorRole = workspaceText_(actorRole).toLowerCase();
  targetRole = workspaceText_(targetRole).toLowerCase();

  if (
    V2_TEAM_ASSIGNABLE_ROLES_.indexOf(targetRole) === -1
  ) {
    return workspaceResult_(
      false,
      'INVALID_ROLE',
      '不支援的團隊角色'
    );
  }

  if (actorRole !== 'owner' && targetRole === 'admin') {
    return workspaceResult_(
      false,
      'OWNER_REQUIRED',
      '只有團隊擁有者可以指派管理員'
    );
  }

  if (['owner', 'admin'].indexOf(actorRole) === -1) {
    return workspaceResult_(
      false,
      'PERMISSION_DENIED',
      '目前角色沒有指派成員角色的權限'
    );
  }

  return { success: true };
}


function teamRoleOptions_(actorRole) {
  actorRole = workspaceText_(actorRole).toLowerCase();

  return V2_TEAM_ASSIGNABLE_ROLES_
    .filter(function (role) {
      return actorRole === 'owner' || role !== 'admin';
    })
    .map(function (role) {
      return {
        value: role,
        label: teamRoleLabel_(role),
        description: teamRoleDescription_(role),
        permissions: workspaceDefaultPermissions_(role)
      };
    });
}


function teamRoleLabel_(role) {
  const map = {
    owner: '擁有者',
    admin: '管理員',
    manager: '營運管理',
    accountant: '帳務人員',
    maintenance: '維修人員',
    viewer: '唯讀成員'
  };

  return map[workspaceText_(role).toLowerCase()] ||
    workspaceText_(role) ||
    '-';
}


function teamRoleDescription_(role) {
  const map = {
    admin:
      '可管理團隊、收款、帳單、合約及大部分後台功能。',
    manager:
      '可處理房客、付款確認、合約、續約與日常租務。',
    accountant:
      '可處理收款帳號、付款回報、銷帳與財務匯出。',
    maintenance:
      '主要處理報修、房客聯絡與維修進度。',
    viewer:
      '僅能查看授權資料，不能修改或審核。'
  };

  return map[workspaceText_(role).toLowerCase()] || '';
}


function teamEnsureSchema_() {
  workspaceEnsureSchema_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(
    V2_WORKSPACE_SHEETS_.invitations
  );

  [
    'invite_name',
    'invitation_url',
    'invited_by_membership_id',
    'accepted_by_line_user_id',
    'cancelled_by_user_id',
    'cancelled_at'
  ].forEach(function (header) {
    workspaceEnsureHeader_(sheet, header);
  });

  teamEnsurePhoneTextColumn_(
    sheet,
    'invite_phone'
  );

  return true;
}


function teamEnsurePhoneTextColumn_(
  sheet,
  headerName
) {
  if (!sheet) {
    return;
  }

  const headers =
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
        workspaceText_
      );

  const index =
    headers.indexOf(
      headerName
    );

  if (index < 0) {
    return;
  }

  const rowCount =
    Math.max(
      sheet.getMaxRows() - 1,
      1
    );

  sheet
    .getRange(
      2,
      index + 1,
      rowCount,
      1
    )
    .setNumberFormat(
      '@'
    );
}


function teamFindInvitation_(ss, token) {
  return workspaceGetObjectsWithRow_(
    ss.getSheetByName(V2_WORKSPACE_SHEETS_.invitations)
  ).find(function (row) {
    return workspaceText_(row.invite_token) === token;
  }) || null;
}


function teamExpireInvitations_(ss, workspaceId) {
  const sheet = ss.getSheetByName(
    V2_WORKSPACE_SHEETS_.invitations
  );

  workspaceGetObjectsWithRow_(sheet).forEach(function (row) {
    if (
      workspaceText_(row.workspace_id).toUpperCase() ===
      workspaceId
    ) {
      teamExpireInvitation_(ss, row);
    }
  });
}


function teamExpireInvitation_(ss, invitation) {
  if (
    workspaceText_(invitation.status).toLowerCase() !==
    'pending'
  ) {
    return;
  }

  const expiresAt = new Date(invitation.expires_at);

  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() >= new Date().getTime()
  ) {
    return;
  }

  teamSetValues_(
    ss.getSheetByName(V2_WORKSPACE_SHEETS_.invitations),
    invitation.__row_number,
    {
      status: 'expired',
      updated_at: new Date()
    }
  );
}


function teamSetValues_(sheet, rowNumber, values) {
  Object.keys(values || {}).forEach(function (header) {
    workspaceSetFirstExistingOrCreate_(
      sheet,
      rowNumber,
      [header],
      header,
      values[header]
    );
  });
}


function repairTeamInvitationPhones_() {
  teamEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      V2_WORKSPACE_SHEETS_
        .invitations
    );

  teamEnsurePhoneTextColumn_(
    sheet,
    'invite_phone'
  );

  const rows =
    workspaceGetObjectsWithRow_(
      sheet
    );

  const repaired = [];

  rows.forEach(
    function (row) {
      const original =
        workspaceText_(
          row.invite_phone
        );

      const normalized =
        workspaceNormalizeTaiwanPhone_(
          original
        );

      if (
        !normalized ||
        normalized ===
          original
      ) {
        return;
      }

      teamSetValues_(
        sheet,
        row.__row_number,
        {
          invite_phone:
            normalized,
          updated_at:
            new Date()
        }
      );

      repaired.push({
        invitation_id:
          row.invitation_id ||
          '',
        before:
          original,
        after:
          normalized
      });
    }
  );

  SpreadsheetApp.flush();

  const result = {
    success:
      true,
    repaired_count:
      repaired.length,
    repaired:
      repaired
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


function testRepairTeamInvitationPhones() {
  return repairTeamInvitationPhones_();
}


function teamMaskPhone_(value) {
  const phone = workspaceNormalizeTaiwanPhone_(value);

  return phone.length === 10
    ? phone.slice(0, 4) + '***' + phone.slice(-3)
    : '';
}


function teamMaskEmail_(value) {
  const email = workspaceText_(value).toLowerCase();

  if (!email || email.indexOf('@') < 1) {
    return '';
  }

  const parts = email.split('@');
  const name = parts[0];

  return (
    name.charAt(0) +
    '***' +
    (name.length > 1 ? name.charAt(name.length - 1) : '') +
    '@' +
    parts[1]
  );
}


function testEnsureV2TeamSchema() {
  teamEnsureSchema_();

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(V2_WORKSPACE_SHEETS_.invitations);

  const result = {
    success: true,
    sheet_name: sheet.getName(),
    columns: sheet.getLastColumn()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testLandlordTeamInit() {
  const result = getLandlordTeamInitByLineUid_(
    getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID')
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
