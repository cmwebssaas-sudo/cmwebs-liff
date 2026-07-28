// ==================================================
// CMWebs V2 Bill Cancellation
// Authenticated internal billing maintenance only.
// ==================================================

const V2_BILL_CANCELLATION_BILLS_SHEET_ =
  'V2_bills';

const V2_BILL_CANCELLATION_PAYMENTS_SHEET_ =
  'V2_payments';

const V2_BILL_CANCELLATION_PAYMENT_REPORTS_SHEET_ =
  'V2_payment_reports';

const V2_BILL_CANCELLATION_MANUAL_SETTLEMENT_LOGS_SHEET_ =
  'V2_manual_settlement_logs';

const V2_BILL_CANCELLATION_USERS_SHEET_ =
  'V2_users';

const V2_BILL_CANCELLATION_WORKSPACES_SHEET_ =
  'V2_workspaces';

const V2_BILL_CANCELLATION_MEMBERS_SHEET_ =
  'V2_workspace_members';

const V2_BILL_CANCELLATION_AUDIT_ACTION_ =
  'bill_cancelled';

const V2_BILL_CANCELLATION_HEADERS_ = [
  'cancelled_at',
  'cancelled_by_user_id',
  'cancelled_by_membership_id',
  'cancelled_by_name',
  'cancellation_reason'
];


/**
 * Shared canonical service. The caller must already hold verified Workspace
 * access; this function is intentionally not a public Web App route.
 */
function cancelV2BillForAccess_(
  access,
  billId,
  reason,
  targetGuard
) {
  let lock = null;

  try {
    const permission =
      v2BillCancellationRequirePermission_(
        access
      );

    if (!permission.success) {
      return permission;
    }

    billId = workspaceText_(billId);
    reason = workspaceText_(reason);

    if (!billId) {
      return v2BillCancellationResult_(
        false,
        'MISSING_BILL_ID',
        '缺少帳單 ID'
      );
    }

    if (!reason) {
      return v2BillCancellationResult_(
        false,
        'MISSING_CANCELLATION_REASON',
        '取消帳單必須填寫原因'
      );
    }

    if (reason.length > 300) {
      return v2BillCancellationResult_(
        false,
        'CANCELLATION_REASON_TOO_LONG',
        '取消原因最多 300 字'
      );
    }

    const ss = runtimeSpreadsheet_();
    const billSheet =
      v2BillCancellationRequireBillSheet_(ss);

    const schema =
      v2BillCancellationSchemaPlan_(billSheet);

    if (schema.missing_headers.length) {
      return v2BillCancellationResult_(
        false,
        'SCHEMA_MIGRATION_REQUIRED',
        '帳單取消欄位尚未完成受控 migration',
        schema
      );
    }

    const selection =
      v2BillCancellationResolveBill_(
        billSheet,
        access,
        billId
      );

    if (!selection.success) {
      return selection;
    }

    let bill = selection.data.bill;
    let before = v2BillCancellationResultData_(
      bill,
      false
    );

    if (v2CanonicalBillIsVoided_(bill)) {
      return v2BillCancellationResult_(
        true,
        'ALREADY_CANCELLED',
        '帳單已取消，未重寫原取消紀錄',
        v2BillCancellationMutationData_(
          before,
          before,
          true
        )
      );
    }

    const eligibility =
      v2BillCancellationEligibility_(
        ss,
        billSheet,
        bill
      );

    if (!eligibility.success) {
      return v2BillCancellationResult_(
        false,
        eligibility.code,
        eligibility.message,
        eligibility.data
      );
    }

    lock = LockService.getScriptLock();

    if (!lock.tryLock(30000)) {
      return v2BillCancellationResult_(
        false,
        'REQUEST_BUSY',
        '系統正在處理其他帳務，請稍後再試'
      );
    }

    const lockedSelection =
      v2BillCancellationResolveBill_(
        billSheet,
        access,
        billId
      );

    if (!lockedSelection.success) {
      return lockedSelection;
    }

    bill = lockedSelection.data.bill;
    before = v2BillCancellationResultData_(bill, false);

    const lockedEligibility =
      v2BillCancellationEligibility_(
        ss,
        billSheet,
        bill
      );

    if (!lockedEligibility.success) {
      return v2BillCancellationResult_(
        false,
        lockedEligibility.code,
        lockedEligibility.message,
        lockedEligibility.data
      );
    }

    if (targetGuard) {
      const lockedTargetChecks =
        v2BillCancellationTargetChecks_(
          bill,
          access,
          targetGuard
        );

      if (Object.keys(lockedTargetChecks).some(function (key) {
        return lockedTargetChecks[key] !== true;
      })) {
        return v2BillCancellationResult_(
          false,
          'TARGET_BILL_GUARD_FAILED',
          '目標帳單在取得 mutation lock 後已不符合已核准條件',
          { checks: lockedTargetChecks }
        );
      }
    }

    const now = new Date();
    const actor = v2BillCancellationActor_(access);

    v2BillCancellationSetValues_(
      billSheet,
      bill.__row_number,
      {
        bill_status: 'cancelled',
        cancelled_at: now,
        cancelled_by_user_id: actor.user_id,
        cancelled_by_membership_id: actor.membership_id,
        cancelled_by_name: actor.name,
        cancellation_reason: reason,
        updated_at: now,
        updated_by_user_id: actor.user_id,
        updated_by_membership_id: actor.membership_id
      }
    );

    const cancelledBill = Object.assign(
      {},
      bill,
      {
        bill_status: 'cancelled',
        cancelled_at: now,
        cancelled_by_user_id: actor.user_id,
        cancelled_by_membership_id: actor.membership_id,
        cancelled_by_name: actor.name,
        cancellation_reason: reason,
        updated_at: now,
        updated_by_user_id: actor.user_id,
        updated_by_membership_id: actor.membership_id
      }
    );

    // Keep legacy/materialized views aligned too. Canonical V2 readers derive
    // outstanding state from V2_bills, while payment-report and dashboard
    // compatibility views must immediately receive the cancellation marker.
    if (typeof billingSyncBillViews_ !== 'function' ||
        typeof billingRefreshWorkspaceSummaries_ !== 'function') {
      throw new Error('帳務取消整合服務不可用');
    }
    billingSyncBillViews_(ss, access, cancelledBill, now);
    billingRefreshWorkspaceSummaries_(ss, access);

    SpreadsheetApp.flush();

    v2BillCancellationAudit_(
      access,
      'success',
      {
        bill_id: billId,
        tenant_id: bill.tenant_id || '',
        contract_id: bill.contract_id || '',
        amount: bill.total_amount || 0,
        reason: reason
      }
    );

    return v2BillCancellationResult_(
      true,
      'CANCELLED',
      '帳單已取消，不會視為已付款',
      v2BillCancellationMutationData_(
        before,
        v2BillCancellationResultData_(
          cancelledBill,
          false
        ),
        false
      )
    );

  } catch (error) {
    v2BillCancellationAudit_(
      access,
      'failed',
      {
        bill_id: billId || '',
        error: error.message
      }
    );

    return v2BillCancellationResult_(
      false,
      'BILL_CANCELLATION_ERROR',
      '取消帳單失敗：' + error.message
    );

  } finally {
    try {
      if (lock) {
        lock.releaseLock();
      }
    } catch (error) {
      // Lock was not acquired or was already released.
    }
  }
}


/**
 * Explicit, authenticated schema rehearsal/migration. It defaults to a
 * read-only plan; only the literal MIGRATE mode appends the additive headers.
 */
function runPhase126BillCancellationSchemaMigration_(
  landlordLineUserId,
  execute
) {
  const access =
    workspaceLandlordResolveAccess_(
      workspaceText_(
        landlordLineUserId
      ),
      {
        require_onboarding: true
      }
    );
  const permission =
    v2BillCancellationRequirePermission_(access);

  if (!permission.success) {
    return permission;
  }

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(30000)) {
    return v2BillCancellationResult_(
      false,
      'REQUEST_BUSY',
      '系統正在處理其他帳務，請稍後再試'
    );
  }

  try {
    const sheet = v2BillCancellationRequireBillSheet_(
      runtimeSpreadsheet_()
    );
    const plan = v2BillCancellationSchemaPlan_(sheet);
    const shouldMigrate =
      workspaceText_(execute) === 'MIGRATE';

    if (!shouldMigrate) {
      return v2BillCancellationResult_(
        true,
        'SCHEMA_REHEARSAL_OK',
        'Schema rehearsal completed; no columns changed',
        Object.assign({}, plan, { dry_run: true })
      );
    }

    plan.missing_headers.forEach(function (header) {
      workspaceEnsureHeader_(sheet, header);
    });
    SpreadsheetApp.flush();

    v2BillCancellationAuditSchema_(
      access,
      'success',
      plan.missing_headers
    );

    return v2BillCancellationResult_(
      true,
      plan.missing_headers.length
        ? 'SCHEMA_MIGRATED'
        : 'SCHEMA_ALREADY_CURRENT',
      '帳單取消 schema 已受控完成',
      {
        dry_run: false,
        added_headers: plan.missing_headers
      }
    );
  } catch (error) {
    v2BillCancellationAuditSchema_(
      access,
      'failed',
      []
    );
    return v2BillCancellationResult_(
      false,
      'SCHEMA_MIGRATION_ERROR',
      '帳單取消 schema migration 失敗：' + error.message
    );
  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      // Lock was already released.
    }
  }
}


/**
 * Narrow, dry-run-by-default runner for the separately authorized correction.
 * This is an Apps Script internal operation, not a public route.
 */
function runPhase126TargetBillCancellation_(
  landlordLineUserId,
  execute
) {
  const target = {
    bill_id: 'BILL-202607-C000019',
    tenant_id: 'T000020',
    contract_id: 'C000019',
    room_name: '603',
    bill_month: '2026-07',
    total_amount: 24500,
    expected_bill_status: 'issued',
    expected_projection: {
      tenant: { amount: 0, count: 0 },
      landlord_current_month: { amount: 27687, count: 3 },
      landlord_arrears: { amount: 36455, count: 4 }
    },
    reason:
      'Production test bill removed before internal operations go-live'
  };

  const ss = runtimeSpreadsheet_();
  const billSheet =
    v2BillCancellationRequireBillSheet_(ss);
  const selection =
    v2BillCancellationResolveExactBillReadOnly_(
      billSheet,
      target.bill_id
    );

  if (!selection.success) {
    return selection;
  }

  const bill = selection.data.bill;
  const accessResult =
    resolveV2BillCancellationAccessReadOnly_(
      ss,
      landlordLineUserId,
      bill.workspace_id
    );

  if (!accessResult.success) {
    return accessResult;
  }

  const access = accessResult.data.access;
  const schema = v2BillCancellationSchemaPlan_(billSheet);
  const paymentEligibility =
    v2BillCancellationPaymentEligibility_(ss, bill);
  const eligibility = v2BillCancellationEligibility_(
    ss,
    billSheet,
    bill
  );
  const checks = Object.assign({
    exactly_one_bill_record:
      v2BillCancellationBillIdMatchCount_(
        billSheet,
        target.bill_id
      ) === 1
  }, v2BillCancellationTargetChecks_(
    bill,
    access,
    target
  ), {
    cancellation_schema_ready:
      schema.missing_headers.length === 0,
    execution_eligibility:
      eligibility.success === true,
    payment_eligible:
      paymentEligibility.eligible === true,
    unpaid:
      v2BillCancellationIsUnpaid_(bill)
  });

  if (Object.keys(checks).some(function (key) {
    return checks[key] !== true;
  })) {
    return v2BillCancellationResult_(
      false,
      'TARGET_BILL_GUARD_FAILED',
      '目標帳單與已核准的取消條件不一致',
      {
        dry_run: true,
        checks: checks,
        authorization: accessResult.data.authorization,
        eligibility: eligibility,
        payment_eligibility: paymentEligibility
      }
    );
  }

  const projection =
    v2BillCancellationProjection_(
      billSheet,
      access,
      bill
    );
  const projectionChecks =
    v2BillCancellationProjectionMatchesTarget_(
      projection,
      target.expected_projection
    );

  if (Object.keys(projectionChecks).some(function (key) {
    return projectionChecks[key] !== true;
  })) {
    return v2BillCancellationResult_(
      false,
      'TARGET_PROJECTION_GUARD_FAILED',
      '目標帳單的 canonical 預估影響與已核准範圍不一致',
      {
        dry_run: true,
        checks: checks,
        projection_checks: projectionChecks,
        projection: projection,
        authorization: accessResult.data.authorization,
        eligibility: eligibility,
        payment_eligibility: paymentEligibility
      }
    );
  }

  const beforeFingerprint =
    v2BillCancellationDryRunFingerprint_(bill);

  const shouldExecute =
    execute === true ||
    workspaceText_(execute) ===
      'EXECUTE';

  if (!shouldExecute) {
    const afterBill = v2BillCancellationResolveBill_(
      billSheet,
      access,
      target.bill_id
    );
    const afterFingerprint = afterBill.success
      ? v2BillCancellationDryRunFingerprint_(
          afterBill.data.bill
        )
      : '';

    return v2BillCancellationResult_(
      true,
      'DRY_RUN_OK',
      '目標帳單檢查通過；未執行取消',
      {
        dry_run: true,
        checks: checks,
        authorization: accessResult.data.authorization,
        eligibility: eligibility,
        payment_eligibility: paymentEligibility,
        projection: projection,
        isolation: {
          hypothetically_excluded_bill_ids: [target.bill_id],
          other_bill_ids_retained:
            projection.other_bill_ids_retained,
          records_proposed_to_mutate: 1,
          other_bills_proposed_to_change: 0
        },
        no_write_proof: {
          before_fingerprint: beforeFingerprint,
          after_fingerprint: afterFingerprint,
          unchanged: beforeFingerprint === afterFingerprint
        },
        before: v2BillCancellationResultData_(
          bill,
          false
        ),
        after: null
      }
    );
  }

  const executeSelection =
    v2BillCancellationResolveExactBillReadOnly_(
      billSheet,
      target.bill_id
    );
  const executeAccessResult = executeSelection.success
    ? resolveV2BillCancellationAccessReadOnly_(
        ss,
        landlordLineUserId,
        executeSelection.data.bill.workspace_id
      )
    : executeSelection;

  if (!executeAccessResult.success) {
    return executeAccessResult;
  }

  return cancelV2BillForAccess_(
    executeAccessResult.data.access,
    target.bill_id,
    target.reason,
    target
  );
}


/**
 * Pure actor authorization for cancellation rehearsals.  This intentionally
 * reads existing V2 records directly and must never call Workspace schema,
 * legacy identity, membership, or audit helpers because those may repair
 * historical data as a side effect.
 */
function resolveV2BillCancellationAccessReadOnly_(
  ss,
  lineUserId,
  workspaceId
) {
  lineUserId = workspaceText_(lineUserId);
  workspaceId = workspaceText_(workspaceId).toUpperCase();

  if (!lineUserId || !workspaceId) {
    return v2BillCancellationReadOnlyAccessFailure_(
      'READ_ONLY_IDENTITY_REQUIRED',
      '缺少既有 actor 或 Workspace identity'
    );
  }

  const usersSheet = ss.getSheetByName(
    V2_BILL_CANCELLATION_USERS_SHEET_
  );
  const workspacesSheet = ss.getSheetByName(
    V2_BILL_CANCELLATION_WORKSPACES_SHEET_
  );
  const membersSheet = ss.getSheetByName(
    V2_BILL_CANCELLATION_MEMBERS_SHEET_
  );

  if (!usersSheet || !workspacesSheet || !membersSheet) {
    return v2BillCancellationReadOnlyAccessFailure_(
      'READ_ONLY_AUTHORIZATION_SCHEMA_MISSING',
      '缺少既有 Workspace authorization 資料，拒絕讀寫以外的修復'
    );
  }

  const users = workspaceGetObjectsWithRow_(usersSheet);
  const workspaces = workspaceGetObjectsWithRow_(workspacesSheet);
  const members = workspaceGetObjectsWithRow_(membersSheet);
  const userMatches = users.filter(function (user) {
    return workspaceText_(user.line_user_id) === lineUserId;
  });
  const workspaceMatches = workspaces.filter(function (workspace) {
    return workspaceText_(workspace.workspace_id).toUpperCase() ===
      workspaceId;
  });

  if (userMatches.length !== 1 || workspaceMatches.length !== 1) {
    return v2BillCancellationReadOnlyAccessFailure_(
      'READ_ONLY_ACTOR_OR_WORKSPACE_AMBIGUOUS',
      'actor 或 Workspace 不是唯一既有記錄'
    );
  }

  const user = userMatches[0];
  const workspace = workspaceMatches[0];
  const userId = workspaceText_(user.user_id);
  const membershipMatches = members.filter(function (membership) {
    const role = workspaceText_(membership.role).toLowerCase();
    const membershipLineUserId = workspaceText_(
      membership.line_user_id
    );

    return (
      workspaceText_(membership.workspace_id).toUpperCase() ===
        workspaceId &&
      workspaceText_(membership.user_id) === userId &&
      ['owner', 'admin'].indexOf(role) >= 0 &&
      v2BillCancellationIsActiveStatus_(membership.member_status) &&
      (!membershipLineUserId || membershipLineUserId === lineUserId)
    );
  });

  if (membershipMatches.length !== 1) {
    return v2BillCancellationReadOnlyAccessFailure_(
      membershipMatches.length
        ? 'READ_ONLY_ACTOR_AMBIGUOUS'
        : 'READ_ONLY_OWNER_ADMIN_NOT_FOUND',
      '找不到唯一既有 owner/admin membership，拒絕建立或修復身份'
    );
  }

  if (
    !v2BillCancellationIsActiveStatus_(user.account_status) ||
    !v2BillCancellationIsActiveStatus_(workspace.account_status) ||
    !workspaceOnboardingComplete_(workspace.onboarding_status)
  ) {
    return v2BillCancellationReadOnlyAccessFailure_(
      'READ_ONLY_ACTOR_OR_WORKSPACE_INACTIVE',
      '既有 actor 或 Workspace 未啟用'
    );
  }

  const membership = membershipMatches[0];
  const access = {
    success: true,
    line_user_id: lineUserId,
    user: user,
    workspace: workspace,
    membership: membership,
    permissions: workspaceBuildPermissionView_(membership),
    principals: [],
    principal: null,
    delegated: false,
    read_only_resolution: true
  };

  return v2BillCancellationResult_(
    true,
    'READ_ONLY_AUTHORIZED',
    '已解析唯一既有 owner/admin actor；未執行任何修復',
    {
      access: access,
      authorization: {
        authorization_result: 'AUTHORIZED',
        authorization_source: 'V2_workspace_members + V2_users',
        actor_user_id: v2BillCancellationMaskReference_(user.user_id),
        actor_membership_id: v2BillCancellationMaskReference_(
          membership.membership_id
        ),
        actor_display_name: workspaceText_(
          user.display_name || membership.display_name
        ),
        actor_role: workspaceText_(membership.role).toLowerCase(),
        workspace_id: v2BillCancellationMaskReference_(workspace.workspace_id),
        read_only_resolution: true,
        writes_attempted: 0
      }
    }
  );
}


function v2BillCancellationReadOnlyAccessFailure_(code, message) {
  return v2BillCancellationResult_(
    false,
    code,
    message,
    {
      authorization: {
        authorization_result: 'DENIED',
        read_only_resolution: true,
        writes_attempted: 0
      }
    }
  );
}


function v2BillCancellationIsActiveStatus_(status) {
  const normalized = workspaceText_(status).toLowerCase();

  return !normalized || [
    'active',
    'enabled',
    '啟用',
    '正常'
  ].indexOf(normalized) >= 0;
}


function v2BillCancellationResolveExactBillReadOnly_(billSheet, billId) {
  const matches = workspaceGetObjectsWithRow_(billSheet).filter(
    function (row) {
      return workspaceText_(row.bill_id) === workspaceText_(billId);
    }
  );

  if (matches.length !== 1) {
    return v2BillCancellationResult_(
      false,
      matches.length
        ? 'AMBIGUOUS_BILL_RECORD'
        : 'BILL_NOT_FOUND',
      '目標帳單不是唯一既有記錄'
    );
  }

  return v2BillCancellationResult_(
    true,
    'OK',
    '目標帳單已唯讀解析',
    { bill: matches[0] }
  );
}


function v2BillCancellationTargetChecks_(bill, access, target) {
  return {
    workspace_id:
      v2CanonicalBillingKey_(bill.workspace_id) ===
        v2CanonicalBillingKey_(
          access.workspace && access.workspace.workspace_id
        ),
    bill_id:
      workspaceText_(bill.bill_id) === target.bill_id,
    tenant_id:
      workspaceText_(bill.tenant_id) === target.tenant_id,
    contract_id:
      workspaceText_(bill.contract_id) === target.contract_id,
    room_name:
      workspaceText_(bill.room_name) === target.room_name,
    room_id:
      Boolean(workspaceText_(bill.room_id)),
    bill_month:
      v2CanonicalBillMonthKey_(bill.bill_month) === target.bill_month,
    total_amount:
      Math.round(Number(bill.total_amount || 0)) === target.total_amount,
    payment_status:
      workspaceText_(bill.payment_status).toLowerCase() === 'unpaid',
    bill_status:
      workspaceText_(bill.bill_status).toLowerCase() ===
        target.expected_bill_status,
    not_cancelled: !v2CanonicalBillIsVoided_(bill),
    cancellation_fields_blank:
      v2BillCancellationAuditFieldsBlank_(bill)
  };
}


/**
 * The mutation path and the dry-run share this fail-closed eligibility gate.
 * It reads the same persisted payment sources used by settlement and never
 * creates a missing sheet or header.
 */
function v2BillCancellationEligibility_(ss, billSheet, bill) {
  const schema = v2BillCancellationSchemaPlan_(billSheet);

  if (schema.missing_headers.length) {
    return {
      success: false,
      code: 'SCHEMA_MIGRATION_REQUIRED',
      message: '帳單取消欄位尚未完成受控 migration',
      data: schema
    };
  }

  if (v2CanonicalBillIsVoided_(bill)) {
    return {
      success: false,
      code: 'BILL_ALREADY_CANCELLED',
      message: '帳單已取消，不能再次取消',
      data: v2BillCancellationResultData_(bill, true)
    };
  }

  if (!v2BillCancellationAuditFieldsBlank_(bill)) {
    return {
      success: false,
      code: 'CANCELLATION_AUDIT_CONFLICT',
      message: '帳單 cancellation audit 欄位不為空白，拒絕覆寫',
      data: v2BillCancellationResultData_(bill, false)
    };
  }

  const paymentEligibility =
    v2BillCancellationPaymentEligibility_(ss, bill);

  if (!paymentEligibility.eligible) {
    return {
      success: false,
      code: 'BILL_HAS_CONFIRMED_PAYMENT',
      message: '已有付款或銷帳紀錄的帳單不可取消',
      data: paymentEligibility
    };
  }

  if (!v2BillCancellationIsUnpaid_(bill)) {
    return {
      success: false,
      code: 'BILL_NOT_UNPAID',
      message: '只有未繳帳單可以取消',
      data: v2BillCancellationResultData_(bill, false)
    };
  }

  return {
    success: true,
    code: 'ELIGIBLE',
    message: '帳單可取消',
    data: paymentEligibility
  };
}


function v2BillCancellationProjection_(billSheet, access, targetBill) {
  const workspaceBills = v2CanonicalBillsForWorkspace_(
    workspaceGetObjectsWithRow_(billSheet),
    access.workspace && access.workspace.workspace_id
  );
  const excludedBillIds = [targetBill.bill_id];
  const tenantIdentity = {
    workspace_id: targetBill.workspace_id,
    tenant_id: targetBill.tenant_id,
    contract_id: targetBill.contract_id
  };
  const tenantBills = v2CanonicalBillsForTenantContract_(
    workspaceBills,
    tenantIdentity
  );
  const tenantBefore = v2CanonicalOutstandingSummary_(tenantBills);
  const tenantAfter = v2CanonicalOutstandingSummary_(
    tenantBills,
    excludedBillIds
  );
  const currentMonthBefore =
    v2CanonicalWorkspaceCurrentMonthOutstandingSummary_(
      workspaceBills
    );
  const currentMonthAfter =
    v2CanonicalWorkspaceCurrentMonthOutstandingSummary_(
      workspaceBills,
      excludedBillIds
    );
  const arrearsBefore = v2CanonicalOutstandingSummary_(workspaceBills);
  const arrearsAfter = v2CanonicalOutstandingSummary_(
    workspaceBills,
    excludedBillIds
  );

  return {
    tenant: {
      before: v2BillCancellationProjectionSummary_(tenantBefore),
      after: v2BillCancellationProjectionSummary_(tenantAfter)
    },
    landlord_current_month: {
      bill_month: currentMonthBefore.bill_month,
      before: v2BillCancellationProjectionSummary_(currentMonthBefore),
      after: v2BillCancellationProjectionSummary_(currentMonthAfter)
    },
    landlord_arrears: {
      before: v2BillCancellationProjectionSummary_(arrearsBefore),
      after: v2BillCancellationProjectionSummary_(arrearsAfter)
    },
    target_bill_ids_hypothetically_excluded: excludedBillIds,
    other_bill_ids_retained: arrearsAfter.bill_ids
  };
}


function v2BillCancellationProjectionSummary_(summary) {
  return {
    amount: Number(summary.unpaid_total_amount || 0),
    count: Number(summary.unpaid_bill_count || 0),
    bill_ids: (summary.bill_ids || []).slice()
  };
}


function v2BillCancellationProjectionMatchesTarget_(projection, expected) {
  return {
    tenant_amount:
      projection.tenant.after.amount === expected.tenant.amount,
    tenant_count:
      projection.tenant.after.count === expected.tenant.count,
    landlord_current_month_amount:
      projection.landlord_current_month.after.amount ===
        expected.landlord_current_month.amount,
    landlord_current_month_count:
      projection.landlord_current_month.after.count ===
        expected.landlord_current_month.count,
    landlord_arrears_amount:
      projection.landlord_arrears.after.amount ===
        expected.landlord_arrears.amount,
    landlord_arrears_count:
      projection.landlord_arrears.after.count ===
        expected.landlord_arrears.count
  };
}


function v2BillCancellationBillIdMatchCount_(billSheet, billId) {
  return workspaceGetObjectsWithRow_(billSheet).filter(function (row) {
    return workspaceText_(row.bill_id) === workspaceText_(billId);
  }).length;
}


function v2BillCancellationAuditFieldsBlank_(bill) {
  return V2_BILL_CANCELLATION_HEADERS_.every(function (header) {
    return !workspaceText_(bill && bill[header]);
  });
}


function v2BillCancellationDryRunFingerprint_(bill) {
  return JSON.stringify({
    bill_id: workspaceText_(bill.bill_id),
    total_amount: Number(bill.total_amount || 0),
    bill_status: workspaceText_(bill.bill_status),
    payment_status: workspaceText_(bill.payment_status),
    cancelled_at: workspaceText_(bill.cancelled_at),
    cancelled_by_user_id: workspaceText_(bill.cancelled_by_user_id),
    cancelled_by_membership_id: workspaceText_(
      bill.cancelled_by_membership_id
    ),
    cancelled_by_name: workspaceText_(bill.cancelled_by_name),
    cancellation_reason: workspaceText_(bill.cancellation_reason)
  });
}


function v2BillCancellationRequirePermission_(access) {
  if (!access || access.success !== true) {
    return access || v2BillCancellationResult_(
      false,
      'WORKSPACE_ACCESS_REQUIRED',
      '需要有效 Workspace 授權'
    );
  }

  const role = workspaceText_(
    access.membership && access.membership.role
  ).toLowerCase();

  if (['owner', 'admin'].indexOf(role) === -1) {
    return v2BillCancellationResult_(
      false,
      'PERMISSION_DENIED',
      '只有 Workspace owner 或 admin 可以取消帳單'
    );
  }

  return { success: true };
}


function v2BillCancellationRequireBillSheet_(ss) {
  const sheet = ss.getSheetByName(
    V2_BILL_CANCELLATION_BILLS_SHEET_
  );

  if (!sheet) {
    throw new Error('找不到 V2_bills');
  }

  return sheet;
}


function v2BillCancellationSchemaPlan_(billSheet) {
  const map = workspaceHeaderMap_(billSheet);
  const missingHeaders =
    V2_BILL_CANCELLATION_HEADERS_.filter(
      function (header) {
        return map[header] === undefined;
      }
    );

  return {
    sheet: V2_BILL_CANCELLATION_BILLS_SHEET_,
    required_headers:
      V2_BILL_CANCELLATION_HEADERS_.slice(),
    missing_headers: missingHeaders
  };
}


function v2BillCancellationResolveBill_(
  billSheet,
  access,
  billId
) {
  const workspaceId = workspaceText_(
    access.workspace && access.workspace.workspace_id
  ).toUpperCase();

  if (!workspaceId) {
    return v2BillCancellationResult_(
      false,
      'MISSING_WORKSPACE_ID',
      '授權內容缺少 workspace_id'
    );
  }

  const idMatches = workspaceGetObjectsWithRow_(
    billSheet
  ).filter(function (row) {
    return workspaceText_(row.bill_id) === billId;
  });

  if (idMatches.length === 0) {
    return v2BillCancellationResult_(
      false,
      'BILL_NOT_FOUND',
      '找不到指定帳單'
    );
  }

  const workspaceMatches = idMatches.filter(
    function (row) {
      return workspaceText_(
        row.workspace_id
      ).toUpperCase() === workspaceId;
    }
  );

  if (workspaceMatches.length === 0) {
    return v2BillCancellationResult_(
      false,
      'CROSS_WORKSPACE_BILL_DENIED',
      '帳單不屬於目前 Workspace'
    );
  }

  if (
    idMatches.length !== 1 ||
    workspaceMatches.length !== 1
  ) {
    return v2BillCancellationResult_(
      false,
      'AMBIGUOUS_BILL_RECORD',
      '帳單 ID 存在衝突，拒絕取消'
    );
  }

  return v2BillCancellationResult_(
    true,
    'OK',
    '帳單已解析',
    { bill: workspaceMatches[0] }
  );
}


function v2BillCancellationHasConfirmedPayment_(
  ss,
  bill
) {
  return v2BillCancellationPaymentEligibility_(ss, bill)
    .real_payment_confirmed === true;
}


/**
 * Read every canonical evidence source that can mean a bill has already been
 * collected. References are masked so an internal dry-run result cannot leak
 * payment or LINE identifiers.
 */
function v2BillCancellationPaymentEligibility_(ss, bill) {
  const confirmedEvidence = [];
  const unverifiableEvidence = [];
  const billId = workspaceText_(bill && bill.bill_id);
  const paymentStatus = workspaceText_(
    bill && bill.payment_status
  ).toLowerCase();
  const paymentId = workspaceText_(bill && bill.payment_id);

  if (v2CanonicalBillPaymentStatus_(paymentStatus) === 'paid') {
    confirmedEvidence.push({ source: 'bill.payment_status' });
  }

  if (paymentId) {
    confirmedEvidence.push({
      source: 'bill.payment_id',
      reference: v2BillCancellationMaskReference_(paymentId)
    });
  }

  v2BillCancellationReadSheetRows_(
    ss,
    V2_BILL_CANCELLATION_PAYMENTS_SHEET_
  ).forEach(function (payment) {
    const status = workspaceText_(
      payment.status || payment.payment_status
    ).toLowerCase();

    if (
      workspaceText_(payment.bill_id) === billId &&
      v2CanonicalBillPaymentStatus_(status) === 'paid'
    ) {
      confirmedEvidence.push({
        source: 'V2_payments',
        reference: v2BillCancellationMaskReference_(
          payment.payment_id || payment.source_ref_id
        )
      });
    }
  });

  v2BillCancellationReadSheetRows_(
    ss,
    V2_BILL_CANCELLATION_PAYMENT_REPORTS_SHEET_
  ).forEach(function (report) {
    const status = workspaceText_(report.status).toLowerCase();
    const matchedPaymentId = workspaceText_(
      report.matched_payment_id
    );

    if (
      workspaceText_(report.bill_id) === billId &&
      ['confirmed', 'settled'].indexOf(status) >= 0 &&
      (matchedPaymentId || status === 'settled')
    ) {
      confirmedEvidence.push({
        source: 'V2_payment_reports',
        reference: v2BillCancellationMaskReference_(
          matchedPaymentId || report.report_id
        )
      });
    }
  });

  v2BillCancellationReadSheetRows_(
    ss,
    V2_BILL_CANCELLATION_MANUAL_SETTLEMENT_LOGS_SHEET_
  ).forEach(function (entry) {
    const result = workspaceText_(entry.result).toLowerCase();
    const action = workspaceText_(entry.action).toLowerCase();
    const isManualSettlement =
      workspaceText_(entry.bill_id) === billId &&
      action === 'landlord_bill_manual_settle';

    if (
      isManualSettlement &&
      ['success', 'confirmed', 'settled'].indexOf(result) >= 0
    ) {
      confirmedEvidence.push({
        source: 'V2_manual_settlement_logs',
        reference: v2BillCancellationMaskReference_(entry.payment_id)
      });
      return;
    }

    if (
      isManualSettlement &&
      !Object.prototype.hasOwnProperty.call(entry, 'result')
    ) {
      unverifiableEvidence.push({
        source: 'V2_manual_settlement_logs_legacy',
        reference: v2BillCancellationMaskReference_(entry.payment_id)
      });
    }
  });

  const eligible =
    confirmedEvidence.length === 0 &&
    unverifiableEvidence.length === 0;

  return {
    eligible: eligible,
    real_payment_confirmed: confirmedEvidence.length > 0,
    confirmed_payment_match_count: confirmedEvidence.length,
    confirmed_payment_references: confirmedEvidence,
    unverifiable_payment_match_count:
      unverifiableEvidence.length,
    unverifiable_payment_references: unverifiableEvidence,
    payment_eligibility_result:
      confirmedEvidence.length > 0
        ? 'INELIGIBLE_CONFIRMED_PAYMENT'
        : (
          unverifiableEvidence.length > 0
            ? 'INELIGIBLE_UNVERIFIABLE_PAYMENT_EVIDENCE'
            : 'ELIGIBLE_NO_CONFIRMED_PAYMENT'
        )
  };
}


function v2BillCancellationReadSheetRows_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);

  return sheet
    ? workspaceGetObjectsWithRow_(sheet)
    : [];
}


function v2BillCancellationIsVoidedPaymentStatus_(status) {
  return [
    'void',
    'voided',
    'cancelled',
    'canceled',
    'reversed',
    'rejected'
  ].indexOf(status) >= 0;
}


function v2BillCancellationMaskReference_(value) {
  const text = workspaceText_(value);

  if (!text) {
    return 'masked';
  }

  return '***' + text.slice(-4);
}


function v2BillCancellationIsUnpaid_(bill) {
  return (
    !v2CanonicalBillIsVoided_(bill) &&
    workspaceText_(
      bill.payment_status
    ).toLowerCase() === 'unpaid'
  );
}


function v2BillCancellationSetValues_(
  sheet,
  rowNumber,
  values
) {
  Object.keys(values).forEach(function (header) {
    workspaceSetFirstExistingOrCreate_(
      sheet,
      rowNumber,
      [header],
      header,
      values[header]
    );
  });
}


function v2BillCancellationActor_(access) {
  const user = access.user || {};
  const membership = access.membership || {};

  return {
    user_id: workspaceText_(user.user_id),
    membership_id: workspaceText_(
      membership.membership_id
    ),
    name: workspaceText_(
      user.name || membership.display_name
    )
  };
}


function v2BillCancellationAudit_(
  access,
  result,
  detail
) {
  billingAudit_(
    access,
    V2_BILL_CANCELLATION_AUDIT_ACTION_,
    { success: result === 'success' },
    {
      category: 'payment',
      target_type: 'bill',
      target_id: detail.bill_id || '',
      detail: JSON.stringify(detail || {})
    }
  );
}


function v2BillCancellationAuditSchema_(
  access,
  result,
  headers
) {
  billingAudit_(
    access,
    'bill_cancellation_schema_migrated',
    { success: result === 'success' },
    {
      category: 'system',
      target_type: 'schema',
      target_id: V2_BILL_CANCELLATION_BILLS_SHEET_,
      detail: JSON.stringify({ headers: headers || [] })
    }
  );
}


function v2BillCancellationResultData_(bill, idempotent) {
  return {
    bill_id: workspaceText_(bill.bill_id),
    workspace_id: workspaceText_(bill.workspace_id),
    tenant_id: workspaceText_(bill.tenant_id),
    contract_id: workspaceText_(bill.contract_id),
    room_id: workspaceText_(bill.room_id),
    room_name: workspaceText_(bill.room_name),
    bill_month: v2CanonicalBillMonthKey_(bill.bill_month),
    due_date: bill.due_date || '',
    total_amount: Number(bill.total_amount || 0),
    bill_status: workspaceText_(bill.bill_status),
    payment_status: workspaceText_(bill.payment_status),
    cancelled_at: bill.cancelled_at || '',
    cancellation_reason: bill.cancellation_reason || '',
    idempotent: idempotent === true
  };
}


function v2BillCancellationMutationData_(
  before,
  after,
  idempotent
) {
  return {
    before: before,
    after: after,
    idempotent: idempotent === true
  };
}


function v2BillCancellationResult_(
  success,
  code,
  message,
  data
) {
  return {
    success: success === true,
    code: code,
    message: message,
    data: data || null
  };
}
