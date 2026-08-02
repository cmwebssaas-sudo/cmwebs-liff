/**
 * CMWebs V2 Workspace Operational Access Layer
 *
 * 目的：
 * - 將現有以 landlord_line_user_id / landlord_id 為核心的房東 API，
 *   接到 V2_users → V2_workspace_members → V2_workspaces 權限模型。
 * - 受邀加入同一 Workspace 的團隊成員，可以依角色權限共用原房東資料。
 * - 保留原有 Legacy API 與資料表，採代理方式逐步遷移。
 *
 * 本檔新增的路由代理函式：
 * - getWorkspaceLandlordHomeByLineUid_
 * - getWorkspaceLandlordArrearsByLineUid_
 * - getWorkspaceLandlordTenantsByLineUid_
 * - getWorkspaceLandlordLineLogsByLineUid_
 * - workspaceLandlordSendTenantMessageByLineUid_
 * - getWorkspaceLandlordMessagesInitByLineUid_
 * - updateWorkspaceLandlordTenantMessageByLineUid_
 * - getWorkspaceLandlordPaymentReportsInitByLineUid_
 * - updateWorkspaceLandlordPaymentReportByLineUid_
 * - settleWorkspaceLandlordPaymentReportByLineUid_
 * - manualSettleWorkspaceLandlordBillByLineUid_
 * - reopenWorkspaceLandlordBillByLineUid_
 * - getWorkspaceLandlordPaidBillsInitByLineUid_
 * - getWorkspaceLandlordContractRequestsInitByLineUid_
 * - updateWorkspaceLandlordContractRequestByLineUid_
 *
 * 依賴：
 * - V2_WORKSPACES.gs
 * - V2_API.gs
 * - V2_LANDLORD_MANAGEMENT.gs
 * - V2_CONTRACT_REQUESTS_TERMS_PENALTY.gs
 * - 既有付款銷帳相關 Apps Script 檔案
 */

const V2_WORKSPACE_OPERATIONAL_SHEETS_ = [
  {
    sheet_name:
      'V2_bills',
    landlord_id_headers: [
      'landlord_id'
    ],
    landlord_line_headers: [
      'landlord_line_user_id',
      'line_user_id'
    ]
  },
  {
    sheet_name:
      'V2_payments',
    landlord_id_headers: [
      'landlord_id'
    ],
    landlord_line_headers: [
      'landlord_line_user_id'
    ]
  },
  {
    sheet_name:
      'V2_payment_reports',
    landlord_id_headers: [
      'landlord_id'
    ],
    landlord_line_headers: [
      'landlord_line_user_id'
    ]
  },
  {
    sheet_name:
      'V2_tenant_messages',
    landlord_id_headers: [
      'landlord_id'
    ],
    landlord_line_headers: [
      'landlord_line_user_id'
    ]
  },
  {
    sheet_name:
      'V2_contract_requests',
    landlord_id_headers: [
      'landlord_id'
    ],
    landlord_line_headers: [
      'landlord_line_user_id'
    ]
  },
  {
    sheet_name:
      'V2_contracts',
    landlord_id_headers: [
      'landlord_id'
    ],
    landlord_line_headers: [
      'landlord_line_user_id'
    ]
  },
  {
    sheet_name:
      'V2_line_message_logs',
    landlord_id_headers: [
      'landlord_id'
    ],
    landlord_line_headers: [
      'landlord_line_user_id',
      'sender_line_user_id'
    ]
  },
  {
    sheet_name:
      'V2_properties',
    landlord_id_headers: [
      'landlord_id'
    ],
    landlord_line_headers: []
  },
  {
    sheet_name:
      'V2_rooms',
    landlord_id_headers: [
      'landlord_id'
    ],
    landlord_line_headers: []
  }
];


// ==================================================
// Read proxies
// ==================================================

function getWorkspaceLandlordHomeByLineUid_(
  lineUserId
) {
  /*
   * Workspace 原生首頁優先。
   * 即使 Code.gs 仍呼叫舊 wrapper，也不再落回
   * V2_landlord_home_view.line_user_id 的 Legacy 查詢。
   */
  if (
    typeof getWorkspaceLandlordHomeNativeByLineUid_ ===
    'function'
  ) {
    return getWorkspaceLandlordHomeNativeByLineUid_(
      lineUserId
    );
  }

  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_home',
    'read',
    function (principalLineUserId) {
      if (
        typeof getLandlordHomeByLineUid !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'WORKSPACE_NATIVE_FUNCTION_NOT_FOUND',
          '找不到 Workspace 原生首頁函式，請確認 V2_WORKSPACE_DASHBOARD_NATIVE.gs 已加入專案'
        );
      }

      return getLandlordHomeByLineUid(
        principalLineUserId
      );
    }
  );
}


function getWorkspaceLandlordArrearsByLineUid_(
  lineUserId
) {
  /*
   * 舊 Code.gs 的 landlord_arrears 路由仍會呼叫此 wrapper。
   * 這裡直接轉到 Workspace 原生欠款查詢，阻止 LANDLORD_NOT_FOUND。
   */
  if (
    typeof getWorkspaceLandlordArrearsNativeByLineUid_ ===
    'function'
  ) {
    return getWorkspaceLandlordArrearsNativeByLineUid_(
      lineUserId
    );
  }

  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_arrears',
    'read',
    function (principalLineUserId) {
      if (
        typeof getLandlordArrearsByLineUid !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'WORKSPACE_NATIVE_FUNCTION_NOT_FOUND',
          '找不到 Workspace 原生欠款函式，請確認 V2_WORKSPACE_DASHBOARD_NATIVE.gs 已加入專案'
        );
      }

      return getLandlordArrearsByLineUid(
        principalLineUserId
      );
    }
  );
}


function getWorkspaceLandlordTenantsByLineUid_(
  lineUserId
) {
  /*
   * 舊 Code.gs 的 landlord_tenants 路由仍會呼叫此 wrapper。
   * 這裡直接轉到 Workspace 原生房客清單。
   */
  if (
    typeof getWorkspaceLandlordTenantsNativeByLineUid_ ===
    'function'
  ) {
    return getWorkspaceLandlordTenantsNativeByLineUid_(
      lineUserId
    );
  }

  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_tenants',
    'read',
    function (principalLineUserId) {
      if (
        typeof getLandlordTenantsByLineUid !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'WORKSPACE_NATIVE_FUNCTION_NOT_FOUND',
          '找不到 Workspace 原生房客函式，請確認 V2_WORKSPACE_DASHBOARD_NATIVE.gs 已加入專案'
        );
      }

      return getLandlordTenantsByLineUid(
        principalLineUserId
      );
    }
  );
}


function getWorkspaceLandlordLineLogsByLineUid_(
  lineUserId,
  tenantId,
  tenantUserId
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_line_logs',
    'read',
    function (principalLineUserId) {
      if (
        typeof getLandlordLineLogsByLineUid !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'LEGACY_FUNCTION_NOT_FOUND',
          '找不到 LINE 紀錄查詢函式'
        );
      }

      return getLandlordLineLogsByLineUid(
        principalLineUserId,
        tenantId,
        tenantUserId
      );
    }
  );
}


function getWorkspaceLandlordMessagesInitByLineUid_(
  lineUserId
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_messages_init',
    'read',
    function (principalLineUserId) {
      if (
        typeof getLandlordMessagesInitByLineUid !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'LEGACY_FUNCTION_NOT_FOUND',
          '找不到房客訊息管理函式'
        );
      }

      return getLandlordMessagesInitByLineUid(
        principalLineUserId
      );
    }
  );
}


function getWorkspaceLandlordPaymentReportsInitByLineUid_(
  lineUserId
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_payment_reports_init',
    'read',
    function (principalLineUserId) {
      if (
        typeof getLandlordPaymentReportsInitByLineUid !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'LEGACY_FUNCTION_NOT_FOUND',
          '找不到付款回報管理函式'
        );
      }

      return getLandlordPaymentReportsInitByLineUid(
        principalLineUserId
      );
    }
  );
}


function getWorkspaceLandlordPaidBillsInitByLineUid_(
  lineUserId
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_paid_bills_init',
    'read',
    function (principalLineUserId) {
      if (
        typeof getLandlordPaidBillsInitByLineUid_ !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'LEGACY_FUNCTION_NOT_FOUND',
          '找不到已繳帳單查詢函式'
        );
      }

      return getLandlordPaidBillsInitByLineUid_(
        principalLineUserId
      );
    }
  );
}


function getWorkspaceLandlordContractRequestsInitByLineUid_(
  lineUserId
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_contract_requests_init',
    'read',
    function (principalLineUserId) {
      if (
        typeof getLandlordContractRequestsInitByLineUid_ !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'LEGACY_FUNCTION_NOT_FOUND',
          '找不到合約申請管理函式'
        );
      }

      return getLandlordContractRequestsInitByLineUid_(
        principalLineUserId
      );
    }
  );
}


// ==================================================
// Write proxies
// ==================================================

function workspaceLandlordSendTenantMessageByLineUid_(
  lineUserId,
  tenantId,
  tenantUserId,
  messageType,
  messageText
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_send_tenant_message',
    'message_write',
    function (principalLineUserId) {
      if (
        typeof landlordSendTenantMessageByLineUid_ !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'LEGACY_FUNCTION_NOT_FOUND',
          '找不到房客訊息發送函式'
        );
      }

      return landlordSendTenantMessageByLineUid_(
        principalLineUserId,
        tenantId,
        tenantUserId,
        messageType,
        messageText
      );
    }
  );
}


function updateWorkspaceLandlordTenantMessageByLineUid_(
  lineUserId,
  messageId,
  status,
  landlordReply
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_message_update',
    'message_write',
    function (principalLineUserId) {
      if (
        typeof updateLandlordTenantMessageByLineUid_ !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'LEGACY_FUNCTION_NOT_FOUND',
          '找不到房客訊息更新函式'
        );
      }

      return updateLandlordTenantMessageByLineUid_(
        principalLineUserId,
        messageId,
        status,
        landlordReply
      );
    }
  );
}


function updateWorkspaceLandlordPaymentReportByLineUid_(
  lineUserId,
  reportId,
  decision,
  rejectReason,
  landlordNote
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_payment_report_update',
    'payment_write',
    function (principalLineUserId) {
      if (
        typeof updateLandlordPaymentReportByLineUid_ !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'LEGACY_FUNCTION_NOT_FOUND',
          '找不到付款回報處理函式'
        );
      }

      return updateLandlordPaymentReportByLineUid_(
        principalLineUserId,
        reportId,
        decision,
        rejectReason,
        landlordNote
      );
    }
  );
}


function settleWorkspaceLandlordPaymentReportByLineUid_(
  lineUserId,
  reportId,
  landlordNote
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_payment_report_settle',
    'payment_write',
    function (principalLineUserId) {
      if (
        typeof settleLandlordPaymentReportByLineUid_ !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'SETTLEMENT_FUNCTION_NOT_FOUND',
          '找不到付款回報正式銷帳函式'
        );
      }

      return settleLandlordPaymentReportByLineUid_(
        principalLineUserId,
        reportId,
        landlordNote
      );
    }
  );
}


function manualSettleWorkspaceLandlordBillByLineUid_(
  lineUserId,
  billId,
  paymentDate,
  paymentMethod,
  paymentAmount,
  bankLast5,
  confirmationSource,
  landlordNote,
  notifyTenant
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_bill_manual_settle',
    'payment_write',
    function (principalLineUserId) {
      if (
        typeof manualSettleLandlordBillByLineUid_ !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'SETTLEMENT_FUNCTION_NOT_FOUND',
          '找不到手動銷帳函式'
        );
      }

      return manualSettleLandlordBillByLineUid_(
        principalLineUserId,
        billId,
        paymentDate,
        paymentMethod,
        paymentAmount,
        bankLast5,
        confirmationSource,
        landlordNote,
        notifyTenant
      );
    }
  );
}


function reopenWorkspaceLandlordBillByLineUid_(
  lineUserId,
  billId,
  reversalReason,
  notifyTenant
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_bill_reopen',
    'payment_write',
    function (principalLineUserId) {
      if (
        typeof reopenLandlordBillByLineUid_ !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'SETTLEMENT_FUNCTION_NOT_FOUND',
          '找不到撤銷銷帳函式'
        );
      }

      return reopenLandlordBillByLineUid_(
        principalLineUserId,
        billId,
        reversalReason,
        notifyTenant
      );
    }
  );
}


function updateWorkspaceLandlordContractRequestByLineUid_(
  lineUserId,
  requestId,
  newStatus,
  landlordNote,
  decisionData
) {
  return workspaceLandlordProxy_(
    lineUserId,
    'landlord_contract_request_update',
    'contract_write',
    function (principalLineUserId) {
      if (
        typeof updateLandlordContractRequestByLineUid_ !==
        'function'
      ) {
        return workspaceResult_(
          false,
          'LEGACY_FUNCTION_NOT_FOUND',
          '找不到合約申請處理函式'
        );
      }

      return updateLandlordContractRequestByLineUid_(
        principalLineUserId,
        requestId,
        newStatus,
        landlordNote,
        decisionData
      );
    }
  );
}


// ==================================================
// Proxy core
// ==================================================

function workspaceLandlordProxy_(
  lineUserId,
  action,
  policy,
  executor
) {
  try {
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
      workspaceLandlordCheckPolicy_(
        access,
        policy
      );

    if (!permission.success) {
      workspaceLandlordLog_(
        access,
        action,
        false,
        permission.message
      );

      return permission;
    }

    const result =
      executor(
        access.principal_line_user_id,
        access
      );

    const attached =
      workspaceLandlordAttachContext_(
        result,
        access
      );

    workspaceLandlordLog_(
      access,
      action,
      Boolean(
        attached &&
        attached.success === true
      ),
      attached &&
      attached.message
        ? attached.message
        : ''
    );

    return attached;

  } catch (error) {
    return workspaceResult_(
      false,
      'WORKSPACE_ACCESS_ERROR',
      'Workspace 存取錯誤：' +
        error.message
    );
  }
}


function workspaceLandlordResolveAccess_(
  lineUserId,
  options
) {
  lineUserId =
    workspaceText_(
      lineUserId
    );

  options =
    options || {};

  if (!lineUserId) {
    return workspaceResult_(
      false,
      'MISSING_LINE_UID',
      '缺少 LINE User ID'
    );
  }

  if (
    typeof workspaceEnsureSchema_ !==
    'function'
  ) {
    return workspaceResult_(
      false,
      'WORKSPACE_MODULE_REQUIRED',
      '找不到 Workspace 基礎模組'
    );
  }

  workspaceEnsureSchema_();

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
      '請先建立或加入房東管理團隊'
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

  if (
    !context.activeWorkspace ||
    !context.activeMembership
  ) {
    return workspaceResult_(
      false,
      'WORKSPACE_REQUIRED',
      '找不到目前管理團隊'
    );
  }

  if (
    !workspaceIsActiveStatus_(
      context.activeWorkspace.account_status ||
      'active'
    )
  ) {
    return workspaceResult_(
      false,
      'WORKSPACE_INACTIVE',
      '目前管理團隊不是啟用狀態'
    );
  }

  if (
    !workspaceIsActiveStatus_(
      context.activeMembership.member_status ||
      'active'
    )
  ) {
    return workspaceResult_(
      false,
      'MEMBERSHIP_INACTIVE',
      '目前成員資格不是啟用狀態'
    );
  }

  if (
    options.require_onboarding ===
      true &&
    !workspaceOnboardingComplete_(
      context.activeWorkspace
        .onboarding_status
    )
  ) {
    return workspaceResult_(
      false,
      'ONBOARDING_REQUIRED',
      '請先完成管理團隊初始設定',
      {
        route:
          'onboarding',
        workspace:
          workspaceBuildWorkspaceView_(
            context.activeWorkspace
          )
      }
    );
  }

  const principals =
    workspaceLandlordResolvePrincipals_(
      ss,
      context
    );

  const principal =
    principals.length > 0
      ? principals[0]
      : null;

  if (
    !principal ||
    !principal.line_user_id
  ) {
    return workspaceResult_(
      false,
      'LEGACY_LANDLORD_IDENTITY_REQUIRED',
      '目前管理團隊尚未建立可供既有租務 API 使用的主要房東身份'
    );
  }

  return {
    success: true,
    line_user_id:
      lineUserId,
    user:
      context.user,
    workspace:
      context.activeWorkspace,
    membership:
      context.activeMembership,
    permissions:
      workspaceBuildPermissionView_(
        context.activeMembership
      ),
    principals:
      principals,
    principal:
      principal,
    principal_line_user_id:
      principal.line_user_id,
    principal_landlord_id:
      principal.landlord_id,
    delegated:
      principal.line_user_id !==
      lineUserId
  };
}


function workspaceLandlordResolvePrincipals_(
  ss,
  context
) {
  const workspaceId =
    workspaceText_(
      context.activeWorkspace
        .workspace_id
    ).toUpperCase();

  const landlordsSheet =
    ss.getSheetByName(
      V2_WORKSPACE_SHEETS_
        .landlords
    );

  const usersSheet =
    ss.getSheetByName(
      V2_WORKSPACE_SHEETS_
        .users
    );

  const membersSheet =
    ss.getSheetByName(
      V2_WORKSPACE_SHEETS_
        .members
    );

  const landlords =
    workspaceGetObjectsWithRow_(
      landlordsSheet
    );

  const users =
    workspaceGetObjectsWithRow_(
      usersSheet
    );

  const members =
    workspaceGetObjectsWithRow_(
      membersSheet
    );

  const userMap = {};

  users.forEach(
    function (user) {
      userMap[
        workspaceText_(
          user.user_id
        )
      ] =
        user;
    }
  );

  const ownerMemberships =
    members
      .filter(
        function (membership) {
          return (
            workspaceText_(
              membership.workspace_id
            ).toUpperCase() ===
              workspaceId &&
            workspaceText_(
              membership.role
            ).toLowerCase() ===
              'owner' &&
            workspaceIsActiveStatus_(
              membership.member_status ||
              'active'
            )
          );
        }
      )
      .sort(
        function (a, b) {
          const primaryA =
            workspaceBoolean_(
              a.is_primary
            )
              ? 0
              : 1;

          const primaryB =
            workspaceBoolean_(
              b.is_primary
            )
              ? 0
              : 1;

          return (
            primaryA -
            primaryB
          );
        }
      );

  const ownerUserIds =
    ownerMemberships.map(
      function (membership) {
        return workspaceText_(
          membership.user_id
        );
      }
    );

  const workspaceCreatedBy =
    workspaceText_(
      context.activeWorkspace
        .created_by_user_id
    );

  const directRows =
    landlords.filter(
      function (landlord) {
        return (
          workspaceText_(
            landlord.workspace_id
          ).toUpperCase() ===
          workspaceId
        );
      }
    );

  const inferredRows =
    landlords.filter(
      function (landlord) {
        const landlordUserId =
          workspaceText_(
            landlord.landlord_user_id ||
            landlord.user_id
          );

        const landlordLineUid =
          workspaceText_(
            landlord.landlord_line_user_id ||
            landlord.line_user_id
          );

        const ownerLineMatch =
          ownerMemberships.some(
            function (membership) {
              const ownerUser =
                userMap[
                  workspaceText_(
                    membership.user_id
                  )
                ] || {};

              return (
                landlordLineUid &&
                landlordLineUid ===
                  workspaceText_(
                    ownerUser.line_user_id
                  )
              );
            }
          );

        return (
          ownerUserIds.indexOf(
            landlordUserId
          ) >= 0 ||
          (
            workspaceCreatedBy &&
            landlordUserId ===
              workspaceCreatedBy
          ) ||
          ownerLineMatch
        );
      }
    );

  const combined = [];
  const seen = {};

  directRows
    .concat(
      inferredRows
    )
    .forEach(
      function (landlord) {
        const key =
          workspaceText_(
            landlord.landlord_id
          ) ||
          workspaceText_(
            landlord.landlord_line_user_id ||
            landlord.line_user_id
          );

        if (
          key &&
          !seen[key]
        ) {
          seen[key] = true;
          combined.push(
            landlord
          );
        }
      }
    );

  const principals =
    combined.map(
      function (landlord) {
        const landlordUserId =
          workspaceText_(
            landlord.landlord_user_id ||
            landlord.user_id
          );

        const user =
          userMap[
            landlordUserId
          ] || {};

        const lineUserId =
          workspaceText_(
            landlord.landlord_line_user_id ||
            landlord.line_user_id ||
            user.line_user_id
          );

        let score = 0;

        if (
          landlordUserId &&
          landlordUserId ===
            workspaceCreatedBy
        ) {
          score += 100;
        }

        if (
          ownerUserIds.indexOf(
            landlordUserId
          ) >= 0
        ) {
          score += 80;
        }

        if (
          workspaceIsActiveStatus_(
            landlord.account_status ||
            'active'
          )
        ) {
          score += 30;
        }

        if (lineUserId) {
          score += 20;
        }

        return {
          landlord_id:
            workspaceText_(
              landlord.landlord_id
            ),
          landlord_name:
            workspaceText_(
              landlord.landlord_name ||
              landlord.name ||
              user.name
            ),
          landlord_user_id:
            landlordUserId,
          line_user_id:
            lineUserId,
          account_status:
            workspaceText_(
              landlord.account_status ||
              'active'
            ),
          score:
            score
        };
      }
    );

  if (principals.length === 0) {
    ownerMemberships.forEach(
      function (membership) {
        const user =
          userMap[
            workspaceText_(
              membership.user_id
            )
          ] || {};

        const lineUserId =
          workspaceText_(
            user.line_user_id ||
            membership.line_user_id
          );

        if (lineUserId) {
          principals.push({
            landlord_id:
              '',
            landlord_name:
              workspaceText_(
                user.name ||
                membership.display_name
              ),
            landlord_user_id:
              workspaceText_(
                user.user_id ||
                membership.user_id
              ),
            line_user_id:
              lineUserId,
            account_status:
              workspaceText_(
                user.account_status ||
                'active'
              ),
            score:
              50
          });
        }
      }
    );
  }

  principals.sort(
    function (a, b) {
      return (
        Number(
          b.score || 0
        ) -
        Number(
          a.score || 0
        )
      );
    }
  );

  return principals;
}


function workspaceLandlordCheckPolicy_(
  access,
  policy
) {
  policy =
    workspaceText_(
      policy || 'read'
    ).toLowerCase();

  const role =
    workspaceText_(
      access.membership.role
    ).toLowerCase();

  const permissions =
    access.permissions || {};

  if (policy === 'read') {
    return {
      success: true
    };
  }

  if (
    policy ===
    'message_write'
  ) {
    if (
      [
        'owner',
        'admin',
        'manager',
        'maintenance'
      ].indexOf(
        role
      ) >= 0
    ) {
      return {
        success: true
      };
    }

    return workspaceResult_(
      false,
      'PERMISSION_DENIED',
      '目前角色沒有處理房客訊息的權限'
    );
  }

  if (
    policy ===
    'payment_write'
  ) {
    if (
      workspaceBoolean_(
        permissions.can_approve_payment
      )
    ) {
      return {
        success: true
      };
    }

    return workspaceResult_(
      false,
      'PERMISSION_DENIED',
      '目前角色沒有付款確認或銷帳權限'
    );
  }

  if (
    policy ===
    'contract_write'
  ) {
    if (
      workspaceBoolean_(
        permissions.can_edit_contract
      )
    ) {
      return {
        success: true
      };
    }

    return workspaceResult_(
      false,
      'PERMISSION_DENIED',
      '目前角色沒有合約審核權限'
    );
  }

  return workspaceResult_(
    false,
    'UNKNOWN_ACCESS_POLICY',
    '不支援的 Workspace 存取政策'
  );
}


function workspaceLandlordAttachContext_(
  result,
  access
) {
  if (
    !result ||
    typeof result !==
      'object'
  ) {
    result =
      workspaceResult_(
        false,
        'INVALID_LEGACY_RESULT',
        '既有 API 回傳格式不正確'
      );
  }

  const contextView =
    workspaceLandlordBuildContextView_(
      access
    );

  result.workspace_context =
    contextView;

  if (
    result.data &&
    typeof result.data ===
      'object' &&
    !Array.isArray(
      result.data
    )
  ) {
    result.data.workspace_context =
      contextView;

    if (!result.data.workspace) {
      result.data.workspace =
        contextView.workspace;
    }

    if (!result.data.current_user) {
      result.data.current_user =
        contextView.current_user;
    }

    if (
      !result.data
        .current_membership
    ) {
      result.data.current_membership =
        contextView.current_membership;
    }

    if (!result.data.permissions) {
      result.data.permissions =
        contextView.permissions;
    }

    if (
      result.data.landlord &&
      typeof result.data.landlord ===
        'object'
    ) {
      result.data.landlord.workspace_id =
        contextView.workspace
          .workspace_id;

      result.data.landlord.workspace_name =
        contextView.workspace
          .workspace_name;

      result.data.landlord.current_role =
        contextView.current_membership
          .role;

      result.data.landlord.access_mode =
        contextView.access_mode;
    }
  }

  return result;
}


function workspaceLandlordBuildContextView_(
  access
) {
  return {
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
    access_mode:
      access.delegated
        ? 'workspace_delegate'
        : 'legacy_landlord_identity',
    delegated:
      access.delegated === true,
    principal_landlord_id:
      access.principal_landlord_id ||
      '',
    principal_line_user_id:
      access.principal_line_user_id ||
      '',
    accessible_landlord_ids:
      access.principals.map(
        function (principal) {
          return (
            principal.landlord_id ||
            ''
          );
        }
      ).filter(
        function (value) {
          return Boolean(
            value
          );
        }
      )
  };
}


function workspaceLandlordLog_(
  access,
  action,
  success,
  detail
) {
  try {
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
          'workspace_' +
          action,
        target_type:
          'workspace',
        target_id:
          access.workspace.workspace_id ||
          '',
        result:
          success
            ? 'success'
            : 'failed',
        detail:
          'principal_line_user_id=' +
          (
            access.principal_line_user_id ||
            ''
          ) +
          ', delegated=' +
          (
            access.delegated
              ? 'true'
              : 'false'
          ) +
          (
            detail
              ? ', message=' +
                workspaceText_(
                  detail
                ).slice(
                  0,
                  300
                )
              : ''
          )
      });
    }

    if (
      typeof logLiffAccess_ ===
      'function'
    ) {
      logLiffAccess_({
        lineUserId:
          access.line_user_id ||
          '',
        userId:
          access.user.user_id ||
          '',
        role:
          'landlord',
        action:
          action,
        targetId:
          access.workspace.workspace_id ||
          '',
        result:
          success
            ? 'success'
            : 'failed',
        errorMessage:
          success
            ? ''
            : workspaceText_(
                detail
              ),
        notes:
          'workspace_delegate=' +
          (
            access.delegated
              ? 'true'
              : 'false'
          )
      });
    }
  } catch (error) {
    // 紀錄失敗不影響主要 API。
  }
}


// ==================================================
// workspace_id data migration
// ==================================================

/**
 * 將既有營運資料補上 workspace_id。
 *
 * 手動執行一次即可；可重複執行。
 * 不修改已經有 workspace_id 的資料。
 */
function migrateV2OperationalDataToWorkspaceIds() {
  workspaceEnsureSchema_();

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const landlordsSheet =
    ss.getSheetByName(
      V2_WORKSPACE_SHEETS_
        .landlords
    );

  const landlordRows =
    workspaceGetObjectsWithRow_(
      landlordsSheet
    );

  const landlordIdMap = {};
  const lineUidMap = {};

  landlordRows.forEach(
    function (landlord) {
      const workspaceId =
        workspaceText_(
          landlord.workspace_id
        ).toUpperCase();

      if (!workspaceId) {
        return;
      }

      const landlordId =
        workspaceText_(
          landlord.landlord_id
        );

      const lineUserId =
        workspaceText_(
          landlord.landlord_line_user_id ||
          landlord.line_user_id
        );

      if (landlordId) {
        landlordIdMap[
          landlordId
        ] =
          workspaceId;
      }

      if (lineUserId) {
        lineUidMap[
          lineUserId
        ] =
          workspaceId;
      }
    }
  );

  const result = {
    success:
      true,
    updated_total:
      0,
    sheets:
      {}
  };

  V2_WORKSPACE_OPERATIONAL_SHEETS_
    .forEach(
      function (config) {
        const sheet =
          ss.getSheetByName(
            config.sheet_name
          );

        if (!sheet) {
          result.sheets[
            config.sheet_name
          ] = {
            exists:
              false,
            updated:
              0
          };

          return;
        }

        workspaceEnsureHeader_(
          sheet,
          'workspace_id'
        );

        const rows =
          workspaceGetObjectsWithRow_(
            sheet
          );

        let updated = 0;

        rows.forEach(
          function (row) {
            if (
              workspaceText_(
                row.workspace_id
              )
            ) {
              return;
            }

            let workspaceId = '';

            config.landlord_id_headers
              .some(
                function (header) {
                  const landlordId =
                    workspaceText_(
                      row[header]
                    );

                  if (
                    landlordId &&
                    landlordIdMap[
                      landlordId
                    ]
                  ) {
                    workspaceId =
                      landlordIdMap[
                        landlordId
                      ];

                    return true;
                  }

                  return false;
                }
              );

            if (!workspaceId) {
              config.landlord_line_headers
                .some(
                  function (header) {
                    const lineUserId =
                      workspaceText_(
                        row[header]
                      );

                    if (
                      lineUserId &&
                      lineUidMap[
                        lineUserId
                      ]
                    ) {
                      workspaceId =
                        lineUidMap[
                          lineUserId
                        ];

                      return true;
                    }

                    return false;
                  }
                );
            }

            if (!workspaceId) {
              return;
            }

            workspaceSetFirstExistingOrCreate_(
              sheet,
              row.__row_number,
              [
                'workspace_id'
              ],
              'workspace_id',
              workspaceId
            );

            updated++;
          }
        );

        result.sheets[
          config.sheet_name
        ] = {
          exists:
            true,
          rows:
            rows.length,
          updated:
            updated
        };

        result.updated_total +=
          updated;
      }
    );

  SpreadsheetApp.flush();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


// ==================================================
// Tests
// ==================================================

function testWorkspaceLandlordAccessContext() {
  const result =
    workspaceLandlordResolveAccess_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID'),
      {
        require_onboarding:
          true
      }
    );

  const output =
    result.success
      ? workspaceLandlordBuildContextView_(
          result
        )
      : result;

  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  return output;
}


function testWorkspaceLandlordHomeProxy() {
  const result =
    getWorkspaceLandlordHomeByLineUid_(
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


/**
 * 驗證目前正式路由所呼叫的三個 compatibility wrapper。
 * 此測試刻意呼叫舊函式名稱，確認它們已轉入 Workspace Native。
 */
function testWorkspaceDashboardCompatibilityRoutes() {
  const lineUserId =
    getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID');

  const result = {
    home:
      getWorkspaceLandlordHomeByLineUid_(
        lineUserId
      ),
    arrears:
      getWorkspaceLandlordArrearsByLineUid_(
        lineUserId
      ),
    tenants:
      getWorkspaceLandlordTenantsByLineUid_(
        lineUserId
      )
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
