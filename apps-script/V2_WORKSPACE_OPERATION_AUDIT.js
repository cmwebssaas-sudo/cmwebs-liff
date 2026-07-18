/**
 * CMWebs V2 Workspace operation actor and audit.
 *
 * API:
 * - landlord_workspace_activity_init
 *
 * Dependencies:
 * - V2_WORKSPACES.gs
 * - V2_WORKSPACE_LANDLORD_ACCESS.gs
 */

const V2_WORKSPACE_OPERATION_AUDIT_SHEET_ =
  'V2_workspace_operation_audit';

const V2_WORKSPACE_OPERATION_AUDIT_HEADERS_ = [
  'operation_audit_id',
  'workspace_id',
  'workspace_name',
  'actor_user_id',
  'actor_membership_id',
  'actor_name',
  'actor_role',
  'actor_line_user_id',
  'principal_landlord_id',
  'principal_line_user_id',
  'delegated',
  'action',
  'action_label',
  'category',
  'target_type',
  'target_id',
  'secondary_target_id',
  'result',
  'result_code',
  'result_message',
  'detail',
  'created_at'
];


function getLandlordWorkspaceActivityByLineUid_(
  lineUserId,
  limit,
  actionFilter
) {
  try {
    if (
      typeof workspaceLandlordResolveAccess_ !==
      'function'
    ) {
      return workspaceResult_(
        false,
        'WORKSPACE_ACCESS_MODULE_REQUIRED',
        '找不到 Workspace 營運授權模組'
      );
    }

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
      workspaceAuditCheckReadPermission_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    workspaceEnsureOperationAuditSchema_();

    limit =
      Number(
        limit || 100
      );

    if (
      !Number.isInteger(
        limit
      ) ||
      limit < 1
    ) {
      limit = 100;
    }

    limit =
      Math.min(
        limit,
        300
      );

    actionFilter =
      workspaceText_(
        actionFilter
      ).toLowerCase();

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const sheet =
      ss.getSheetByName(
        V2_WORKSPACE_OPERATION_AUDIT_SHEET_
      );

    const workspaceId =
      workspaceText_(
        access.workspace.workspace_id
      ).toUpperCase();

    const activities =
      workspaceGetObjectsWithRow_(
        sheet
      )
        .filter(
          function (row) {
            if (
              workspaceText_(
                row.workspace_id
              ).toUpperCase() !==
              workspaceId
            ) {
              return false;
            }

            if (!actionFilter) {
              return true;
            }

            return (
              workspaceText_(
                row.action
              ).toLowerCase() ===
                actionFilter ||
              workspaceText_(
                row.category
              ).toLowerCase() ===
                actionFilter
            );
          }
        )
        .sort(
          function (a, b) {
            return (
              workspaceAuditDateNumber_(
                b.created_at
              ) -
              workspaceAuditDateNumber_(
                a.created_at
              )
            );
          }
        )
        .slice(
          0,
          limit
        )
        .map(
          workspaceAuditBuildView_
        );

    return workspaceResult_(
      true,
      'OK',
      '操作紀錄載入成功',
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
        summary: {
          total:
            activities.length,
          success:
            activities.filter(
              function (item) {
                return (
                  item.result ===
                  'success'
                );
              }
            ).length,
          failed:
            activities.filter(
              function (item) {
                return (
                  item.result ===
                  'failed'
                );
              }
            ).length,
          delegated:
            activities.filter(
              function (item) {
                return (
                  item.delegated ===
                  true
                );
              }
            ).length
        },
        activities:
          activities,
        filters: [
          {
            value:
              '',
            label:
              '全部'
          },
          {
            value:
              'payment',
            label:
              '付款與帳單'
          },
          {
            value:
              'message',
            label:
              '房客訊息'
          },
          {
            value:
              'contract',
            label:
              '合約'
          },
          {
            value:
              'property',
            label:
              '物件與房間'
          },
          {
            value:
              'tenant',
            label:
              '房客與租約建立'
          }
        ]
      }
    );

  } catch (error) {
    return workspaceResult_(
      false,
      'WORKSPACE_ACTIVITY_ERROR',
      '操作紀錄載入失敗：' +
        error.message
    );
  }
}


function workspaceRecordOperationActor_(
  access,
  action,
  result,
  meta
) {
  try {
    workspaceEnsureOperationAuditSchema_();

    meta =
      meta || {};

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const sheet =
      ss.getSheetByName(
        V2_WORKSPACE_OPERATION_AUDIT_SHEET_
      );

    const now =
      new Date();

    const success =
      Boolean(
        result &&
        result.success === true
      );

    const actor =
      workspaceBuildOperationActorView_(
        access
      );

    const auditId =
      workspaceNextId_(
        sheet,
        'operation_audit_id',
        'OA',
        7
      );

    const record = {
      operation_audit_id:
        auditId,
      workspace_id:
        access.workspace.workspace_id ||
        '',
      workspace_name:
        access.workspace.workspace_name ||
        '',
      actor_user_id:
        actor.user_id,
      actor_membership_id:
        actor.membership_id,
      actor_name:
        actor.name,
      actor_role:
        actor.role,
      actor_line_user_id:
        actor.line_user_id,
      principal_landlord_id:
        access.principal_landlord_id ||
        '',
      principal_line_user_id:
        access.principal_line_user_id ||
        '',
      delegated:
        access.delegated === true,
      action:
        action,
      action_label:
        workspaceAuditActionLabel_(
          action,
          meta
        ),
      category:
        workspaceAuditActionCategory_(
          action
        ),
      target_type:
        workspaceText_(
          meta.target_type
        ),
      target_id:
        workspaceText_(
          meta.target_id
        ),
      secondary_target_id:
        workspaceText_(
          meta.secondary_target_id
        ),
      result:
        success
          ? 'success'
          : 'failed',
      result_code:
        workspaceText_(
          result &&
          result.code
            ? result.code
            : ''
        ),
      result_message:
        workspaceText_(
          result &&
          result.message
            ? result.message
            : ''
        ),
      detail:
        workspaceAuditBuildDetail_(
          meta
        ),
      created_at:
        now
    };

    workspaceAppendObject_(
      sheet,
      record
    );

    let stampResult = null;

    if (
      success &&
      record.target_type &&
      record.target_id
    ) {
      stampResult =
        workspaceStampOperationActorToTarget_(
          access,
          action,
          record.target_type,
          record.target_id,
          now,
          meta
        );
    }

    SpreadsheetApp.flush();

    return {
      success:
        true,
      code:
        'OPERATION_AUDITED',
      message:
        '已記錄實際操作人',
      data: {
        operation_audit_id:
          auditId,
        actor:
          actor,
        action:
          action,
        action_label:
          record.action_label,
        category:
          record.category,
        target_type:
          record.target_type,
        target_id:
          record.target_id,
        result:
          record.result,
        created_at:
          now,
        target_stamp:
          stampResult
      }
    };

  } catch (error) {
    return {
      success:
        false,
      code:
        'OPERATION_AUDIT_FAILED',
      message:
        error.message
    };
  }
}


function workspaceStampOperationActorToTarget_(
  access,
  action,
  targetType,
  targetId,
  now,
  meta
) {
  const config =
    workspaceAuditTargetConfig_(
      targetType
    );

  if (!config) {
    return {
      success:
        false,
      code:
        'TARGET_TYPE_NOT_SUPPORTED'
    };
  }

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      config.sheet_name
    );

  if (!sheet) {
    return {
      success:
        false,
      code:
        'TARGET_SHEET_NOT_FOUND',
      sheet_name:
        config.sheet_name
    };
  }

  const row =
    workspaceGetObjectsWithRow_(
      sheet
    ).find(
      function (item) {
        return (
          workspaceText_(
            item[
              config.id_header
            ]
          ) ===
          targetId
        );
      }
    );

  if (!row) {
    return {
      success:
        false,
      code:
        'TARGET_ROW_NOT_FOUND',
      sheet_name:
        config.sheet_name,
      target_id:
        targetId
    };
  }

  const actor =
    workspaceBuildOperationActorView_(
      access
    );

  const values = {
    workspace_id:
      access.workspace.workspace_id ||
      '',
    last_action:
      action,
    last_action_at:
      now,
    last_action_by_user_id:
      actor.user_id,
    last_action_by_membership_id:
      actor.membership_id,
    last_action_by_name:
      actor.name,
    last_action_by_role:
      actor.role,
    last_action_by_line_user_id:
      actor.line_user_id,
    actual_actor_user_id:
      actor.user_id,
    actual_actor_membership_id:
      actor.membership_id,
    actual_actor_name:
      actor.name,
    actual_actor_role:
      actor.role,
    actual_actor_line_user_id:
      actor.line_user_id
  };

  Object.assign(
    values,
    workspaceAuditSemanticActorFields_(
      action,
      actor,
      now,
      meta
    )
  );

  workspaceAuditSetValues_(
    sheet,
    row.__row_number,
    values
  );

  return {
    success:
      true,
    code:
      'TARGET_STAMPED',
    sheet_name:
      config.sheet_name,
    row_number:
      row.__row_number,
    target_id:
      targetId
  };
}


function workspaceAuditSemanticActorFields_(
  action,
  actor,
  now,
  meta
) {
  let prefix = '';

  if (
    action ===
    'landlord_message_update'
  ) {
    prefix =
      'handled';
  }

  if (
    action ===
      'landlord_payment_report_update' ||
    action ===
      'landlord_payment_report_settle'
  ) {
    prefix =
      'reviewed';
  }

  if (
    action ===
    'landlord_bill_manual_settle'
  ) {
    prefix =
      'settled';
  }

  if (
    action ===
    'landlord_bill_reopen'
  ) {
    prefix =
      'reopened';
  }

  if (
    action ===
    'landlord_contract_request_update'
  ) {
    prefix =
      'decision';
  }

  const values = {};

  if (prefix) {
    values[
      prefix +
      '_at'
    ] =
      now;

    values[
      prefix +
      '_by_user_id'
    ] =
      actor.user_id;

    values[
      prefix +
      '_by_membership_id'
    ] =
      actor.membership_id;

    values[
      prefix +
      '_by_name'
    ] =
      actor.name;

    values[
      prefix +
      '_by_role'
    ] =
      actor.role;

    values[
      prefix +
      '_by_line_user_id'
    ] =
      actor.line_user_id;
  }

  if (
    meta &&
    meta.operation_status
  ) {
    values.actual_operation_status =
      workspaceText_(
        meta.operation_status
      );
  }

  return values;
}


function workspaceAuditTargetConfig_(
  targetType
) {
  const configs = {
    payment_report: {
      sheet_name:
        'V2_payment_reports',
      id_header:
        'report_id'
    },
    bill: {
      sheet_name:
        'V2_bills',
      id_header:
        'bill_id'
    },
    tenant_message: {
      sheet_name:
        'V2_tenant_messages',
      id_header:
        'message_id'
    },
    contract_request: {
      sheet_name:
        'V2_contract_requests',
      id_header:
        'request_id'
    },
    property: {
      sheet_name:
        'V2_properties',
      id_header:
        'property_id'
    },
    room: {
      sheet_name:
        'V2_rooms',
      id_header:
        'room_id'
    },
    tenant: {
      sheet_name:
        'V2_tenants',
      id_header:
        'tenant_id'
    }
  };

  return (
    configs[
      workspaceText_(
        targetType
      ).toLowerCase()
    ] ||
    null
  );
}


function workspaceEnsureOperationAuditSchema_() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(
      V2_WORKSPACE_OPERATION_AUDIT_SHEET_
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        V2_WORKSPACE_OPERATION_AUDIT_SHEET_
      );

    sheet
      .getRange(
        1,
        1,
        1,
        V2_WORKSPACE_OPERATION_AUDIT_HEADERS_
          .length
      )
      .setValues([
        V2_WORKSPACE_OPERATION_AUDIT_HEADERS_
      ]);

    sheet.setFrozenRows(
      1
    );

    return sheet;
  }

  V2_WORKSPACE_OPERATION_AUDIT_HEADERS_
    .forEach(
      function (header) {
        workspaceEnsureHeader_(
          sheet,
          header
        );
      }
    );

  return sheet;
}


function workspaceAuditCheckReadPermission_(
  access
) {
  const role =
    workspaceText_(
      access.membership.role
    ).toLowerCase();

  const permissions =
    access.permissions || {};

  if (
    [
      'owner',
      'admin',
      'manager',
      'accountant'
    ].indexOf(
      role
    ) >= 0 ||
    workspaceBoolean_(
      permissions.can_manage_team
    ) ||
    workspaceBoolean_(
      permissions.can_export_data
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
    '目前角色沒有查看團隊操作紀錄的權限'
  );
}


function workspaceBuildOperationActorView_(
  access
) {
  return {
    user_id:
      workspaceText_(
        access.user.user_id
      ),
    membership_id:
      workspaceText_(
        access.membership
          .membership_id
      ),
    name:
      workspaceText_(
        access.user.name ||
        access.membership
          .display_name
      ),
    role:
      workspaceText_(
        access.membership.role
      ).toLowerCase(),
    role_label:
      workspaceAuditRoleLabel_(
        access.membership.role
      ),
    line_user_id:
      workspaceText_(
        access.line_user_id ||
        access.user.line_user_id
      )
  };
}


function workspaceAuditBuildView_(
  row
) {
  return {
    operation_audit_id:
      row.operation_audit_id || '',
    workspace_id:
      row.workspace_id || '',
    workspace_name:
      row.workspace_name || '',
    actor_user_id:
      row.actor_user_id || '',
    actor_membership_id:
      row.actor_membership_id || '',
    actor_name:
      row.actor_name || '',
    actor_role:
      row.actor_role || '',
    actor_role_label:
      workspaceAuditRoleLabel_(
        row.actor_role
      ),
    actor_line_user_id:
      row.actor_line_user_id || '',
    delegated:
      workspaceBoolean_(
        row.delegated
      ),
    principal_landlord_id:
      row.principal_landlord_id || '',
    action:
      row.action || '',
    action_label:
      row.action_label ||
      workspaceAuditActionLabel_(
        row.action,
        {}
      ),
    category:
      row.category ||
      workspaceAuditActionCategory_(
        row.action
      ),
    target_type:
      row.target_type || '',
    target_id:
      row.target_id || '',
    secondary_target_id:
      row.secondary_target_id || '',
    result:
      workspaceText_(
        row.result
      ).toLowerCase(),
    result_code:
      row.result_code || '',
    result_message:
      row.result_message || '',
    detail:
      row.detail || '',
    created_at:
      row.created_at || ''
  };
}


function workspaceAuditActionCategory_(
  action
) {
  action =
    workspaceText_(
      action
    ).toLowerCase();

  if (
    action.indexOf(
      'payment'
    ) >= 0 ||
    action.indexOf(
      'bill'
    ) >= 0
  ) {
    return 'payment';
  }

  if (
    action.indexOf(
      'message'
    ) >= 0
  ) {
    return 'message';
  }

  if (
    action.indexOf(
      'contract'
    ) >= 0
  ) {
    return 'contract';
  }

  if (
    action.indexOf(
      'property'
    ) >= 0 ||
    action.indexOf(
      'room'
    ) >= 0
  ) {
    return 'property';
  }

  if (
    action.indexOf(
      'tenant'
    ) >= 0
  ) {
    return 'tenant';
  }

  return 'other';
}


function workspaceAuditActionLabel_(
  action,
  meta
) {
  const labels = {
    landlord_send_tenant_message:
      '傳送房客訊息',
    landlord_message_update:
      '更新房客訊息',
    landlord_payment_report_update:
      '處理付款回報',
    landlord_payment_report_settle:
      '確認付款並銷帳',
    landlord_bill_manual_settle:
      '手動銷帳',
    landlord_bill_reopen:
      '撤銷銷帳',
    landlord_bills_generate:
      '建立或更新月租帳單',
    landlord_bill_notifications_send:
      '發送或重新發送帳單通知',
    landlord_tenant_checkin_save:
      '更新房客入住報到',
    landlord_tenant_checkin_send_welcome:
      '發送房客入住通知',
    landlord_announcement_send:
      '發送房客公告',
    landlord_announcement_retry:
      '重試房客公告送達',
    landlord_settings_save_profile:
      '更新個人資料',
    landlord_settings_save_workspace:
      '更新管理團隊設定',
    landlord_settings_save_payment:
      '更新預設收款帳號',
    landlord_settings_save_preferences:
      '更新帳務與通知偏好',
    landlord_contract_request_update:
      '處理合約申請',
    landlord_property_create:
      '建立物件',
    landlord_property_update:
      '更新物件',
    landlord_property_archive:
      '封存物件',
    landlord_room_create:
      '建立房間',
    landlord_room_update:
      '更新房間',
    landlord_room_archive:
      '封存房間',
    landlord_tenant_lease_create:
      '建立房客與初始租約'
  };

  let label =
    labels[
      workspaceText_(
        action
      ).toLowerCase()
    ] ||
    workspaceText_(
      action
    );

  const status =
    workspaceText_(
      meta &&
      meta.operation_status
        ? meta.operation_status
        : ''
    ).toLowerCase();

  const statusLabels = {
    confirmed:
      '確認',
    rejected:
      '駁回',
    approved:
      '核准',
    completed:
      '完成',
    processing:
      '處理中',
    replied:
      '已回覆',
    closed:
      '已結案',
    reopened:
      '重新開啟'
  };

  if (
    status &&
    statusLabels[status]
  ) {
    label +=
      '・' +
      statusLabels[status];
  }

  return label;
}


function workspaceAuditRoleLabel_(
  role
) {
  const labels = {
    owner:
      '擁有者',
    admin:
      '管理員',
    manager:
      '營運管理',
    accountant:
      '帳務人員',
    maintenance:
      '維修人員',
    viewer:
      '唯讀成員'
  };

  return (
    labels[
      workspaceText_(
        role
      ).toLowerCase()
    ] ||
    workspaceText_(
      role
    ) ||
    '-'
  );
}


function workspaceAuditBuildDetail_(
  meta
) {
  meta =
    meta || {};

  const parts = [];

  if (meta.operation_status) {
    parts.push(
      'status=' +
      workspaceText_(
        meta.operation_status
      )
    );
  }

  if (meta.tenant_id) {
    parts.push(
      'tenant_id=' +
      workspaceText_(
        meta.tenant_id
      )
    );
  }

  if (meta.tenant_user_id) {
    parts.push(
      'tenant_user_id=' +
      workspaceText_(
        meta.tenant_user_id
      )
    );
  }

  if (meta.message_type) {
    parts.push(
      'message_type=' +
      workspaceText_(
        meta.message_type
      )
    );
  }

  if (meta.detail) {
    parts.push(
      workspaceText_(
        meta.detail
      )
    );
  }

  return parts
    .join(', ')
    .slice(
      0,
      500
    );
}


function workspaceAuditSetValues_(
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


function workspaceAuditDateNumber_(
  value
) {
  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return value.getTime();
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();
}


function testEnsureWorkspaceOperationAuditSchema() {
  const sheet =
    workspaceEnsureOperationAuditSchema_();

  const result = {
    success:
      true,
    sheet_name:
      sheet.getName(),
    rows:
      sheet.getLastRow(),
    columns:
      sheet.getLastColumn()
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


function testLandlordWorkspaceActivityInit() {
  const result =
    getLandlordWorkspaceActivityByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      100,
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
