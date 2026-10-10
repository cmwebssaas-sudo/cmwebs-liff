/** Central route authorization for verified tenant and Workspace identities. */

const V2_RBAC_LANDLORD_ROUTE_POLICIES_ = {
  landlord_entry_status: 'authenticated',
  landlord_register_submit: 'authenticated',
  landlord_invitation_init: 'authenticated',
  landlord_invitation_accept: 'authenticated',
  landlord_workspace_create: 'authenticated',

  landlord_onboarding_init: 'workspace_read',
  landlord_team_init: 'workspace_read',
  landlord_workspace_activity_init: 'workspace_read',
  landlord_notifications_init: 'workspace_read',
  landlord_notification_mark_read: 'workspace_read',
  landlord_notifications_mark_all_read: 'workspace_read',
  landlord_settings_init: 'workspace_read',
  landlord_announcements_init: 'workspace_read',
  landlord_tenant_checkins_init: 'workspace_read',
  landlord_bill_notifications_init: 'workspace_read',
  landlord_billing_init: 'workspace_read',
  landlord_tenant_create_init: 'workspace_read',
  landlord_properties_init: 'workspace_read',
  landlord_workspace_context: 'workspace_read',
  landlord_workspace_switch: 'workspace_read',
  landlord_repairs_init: 'workspace_read',
  landlord_home: 'workspace_read',
  landlord_arrears: 'workspace_read',
  landlord_tenants: 'workspace_read',
  landlord_line_logs: 'workspace_read',
  landlord_messages_init: 'workspace_read',
  landlord_payment_reports_init: 'workspace_read',
  landlord_paid_bills_init: 'workspace_read',
  landlord_contracts_init: 'workspace_read',
  landlord_billing_lifecycle_init: 'workspace_read',
  landlord_move_out_requests_init: 'workspace_read',
  landlord_contract_requests_init: 'workspace_read',

  landlord_team_invite_create: 'team_manage',
  landlord_team_invite_cancel: 'team_manage',
  landlord_team_member_update: 'team_manage',
  landlord_team_member_remove: 'team_manage',

  landlord_onboarding_save: 'settings_write',
  landlord_onboarding_complete: 'settings_write',
  landlord_settings_save_profile: 'workspace_read',
  landlord_settings_save_workspace: 'settings_write',
  landlord_settings_save_payment: 'settings_write',
  landlord_settings_save_preferences: 'settings_write',

  landlord_announcement_send: 'operations_write',
  landlord_announcement_retry: 'operations_write',
  landlord_tenant_checkin_save: 'operations_write',
  landlord_tenant_checkin_send_welcome: 'operations_write',
  landlord_tenant_create: 'operations_write',
  landlord_repair_update: 'operations_write',

  landlord_send_tenant_message: 'message_write',
  landlord_message_update: 'message_write',

  landlord_bill_notifications_send: 'payment_write',
  landlord_bills_generate: 'payment_write',
  landlord_payment_report_update: 'payment_write',
  landlord_payment_report_settle: 'payment_write',
  landlord_bill_manual_settle: 'payment_write',
  landlord_bill_reopen: 'payment_write',
  landlord_contract_bill_generate: 'payment_write',
  landlord_bill_payment_confirm: 'payment_write',
  landlord_deposit_refund_confirm: 'payment_and_terminate',

  landlord_property_save: 'contract_write',
  landlord_property_archive: 'contract_write',
  landlord_room_save: 'contract_write',
  landlord_room_archive: 'contract_write',
  landlord_contract_create: 'contract_write',
  landlord_contract_update: 'contract_write',
  landlord_contract_activate: 'contract_write',
  landlord_contract_status_update: 'contract_write',
  landlord_contract_delete: 'delete_data',
  landlord_move_out_inspection_schedule: 'contract_write',
  landlord_move_out_inspection_complete: 'contract_write',
  landlord_contract_request_update: 'contract_write'
};


function rbacAuthorizeRoute_(lineUserId, action, parameters) {
  action = String(action || '').trim();
  if (!action) return rbacFailure_('ROUTE_REQUIRED', 'Route is required');

  if (/^tenant_/.test(action)) {
    if (typeof workspaceLandlordResolveAccess_ !== 'function') {
      return rbacFailure_(
        'RBAC_MODULE_REQUIRED',
        '找不到房東身份授權模組'
      );
    }

    const landlordAccess = workspaceLandlordResolveAccess_(
      String(lineUserId || ''),
      { require_onboarding: false }
    );
    if (landlordAccess && landlordAccess.success === true) {
      return rbacFailure_(
        'CROSS_ROLE_DENIED',
        '房東身份不得存取房客路由'
      );
    }

    return {
      success: true,
      principal_type: 'tenant',
      line_user_id: String(lineUserId || '')
    };
  }

  if (!/^landlord_/.test(action)) {
    return rbacFailure_('ROUTE_NOT_AUTHORIZED', 'Route is not authorized');
  }

  const policy = V2_RBAC_LANDLORD_ROUTE_POLICIES_[action];
  if (!policy) {
    return rbacFailure_('RBAC_POLICY_MISSING', 'Landlord route has no RBAC policy');
  }
  if (policy === 'authenticated') {
    return {
      success: true,
      principal_type: 'landlord_candidate',
      policy: policy
    };
  }

  const access = workspaceLandlordResolveAccess_(
    String(lineUserId || ''),
    { require_onboarding: false }
  );
  if (!access || access.success !== true) return access;

  const role = String(access.membership && access.membership.role || '').toLowerCase();
  const permissions = access.permissions || {};
  const workspaceId = String(
    access.workspace && access.workspace.workspace_id || ''
  );
  const requestedWorkspaceId = String(
    parameters && parameters.workspace_id || ''
  ).trim();
  if (requestedWorkspaceId && requestedWorkspaceId !== workspaceId) {
    return rbacFailure_(
      'WORKSPACE_ACCESS_DENIED',
      'Requested Workspace does not match the authenticated membership'
    );
  }
  let allowed = false;

  if (policy === 'workspace_read') allowed = true;
  if (policy === 'team_manage') allowed = Boolean(permissions.can_manage_team);
  if (policy === 'settings_write') allowed = role === 'owner' || role === 'admin';
  if (policy === 'operations_write') {
    allowed = ['owner', 'admin', 'manager', 'maintenance'].indexOf(role) >= 0;
  }
  if (policy === 'message_write') {
    allowed = workspaceLandlordCheckPolicy_(access, 'message_write').success === true;
  }
  if (policy === 'payment_write') {
    allowed = workspaceLandlordCheckPolicy_(access, 'payment_write').success === true;
  }
  if (policy === 'contract_write') {
    allowed = workspaceLandlordCheckPolicy_(access, 'contract_write').success === true;
  }
  if (policy === 'payment_and_terminate') {
    allowed = Boolean(
      permissions.can_approve_payment && permissions.can_terminate_contract
    );
  }
  if (policy === 'delete_data') allowed = Boolean(permissions.can_delete_data);

  if (!allowed) {
    return rbacFailure_(
      'PERMISSION_DENIED',
      'Workspace role is not authorized for this route'
    );
  }

  return {
    success: true,
    principal_type: 'workspace_member',
    policy: policy,
    workspace_id: workspaceId,
    role: role
  };
}


function rbacFailure_(code, message) {
  return {
    success: false,
    code: String(code || 'PERMISSION_DENIED'),
    message: String(message || 'Permission denied'),
    data: null
  };
}
