/**
 * CMWebs V2 房客首次登入綁定
 *
 * Code.gs 路由：
 * - tenant_binding_status
 * - tenant_bind_submit
 */

const V2_TENANT_BINDING_SHEETS_ = {
  tenants: 'V2_tenants',
  users: 'V2_users',
  contracts: 'V2_contracts',
  tenantHomeView: 'V2_tenant_home_view',
  landlordTenantListView: 'V2_landlord_tenant_list_view',
  bindingLogs: 'V2_tenant_binding_logs'
};

const V2_TENANT_BINDING_TIMEZONE_ = 'Asia/Taipei';
const V2_TENANT_BINDING_MAX_FAILURES_ = 5;
const V2_TENANT_BINDING_BLOCK_SECONDS_ = 600;


/**
 * 查詢 LINE 帳號是否已綁定房客。
 */
function getTenantBindingStatusByLineUid_(lineUserId) {
  const action = 'tenant_binding_status';

  try {
    lineUserId = tenantBindingText_(lineUserId);

    if (!lineUserId) {
      return tenantBindingResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID',
        {
          bound: false,
          account_active: false,
          tenant: null
        }
      );
    }

    const ss = runtimeSpreadsheet_();
    const tenant = tenantBindingResolveByLineUid_(ss, lineUserId);

    if (!tenant) {
      tenantBindingLogAccess_({
        lineUserId,
        userId: '',
        role: 'tenant',
        action,
        targetId: '',
        result: 'success',
        errorMessage: '',
        notes: 'unbound'
      });

      return tenantBindingResult_(
        true,
        'UNBOUND',
        '尚未完成房客綁定',
        {
          bound: false,
          account_active: false,
          tenant: null
        }
      );
    }

    const accountStatus = tenantBindingText_(
      tenant.account_status ||
      tenant.tenant_account_status ||
      tenant.status ||
      'active'
    ).toLowerCase();

    const accountActive = tenantBindingIsActiveStatus_(accountStatus);

    tenantBindingLogAccess_({
      lineUserId,
      userId:
        tenant.user_id ||
        tenant.tenant_user_id ||
        '',
      role: 'tenant',
      action,
      targetId: tenant.tenant_id || '',
      result: 'success',
      errorMessage: '',
      notes:
        accountActive
          ? 'bound'
          : 'bound_account_inactive'
    });

    return tenantBindingResult_(
      true,
      accountActive
        ? 'BOUND'
        : 'BOUND_ACCOUNT_INACTIVE',
      accountActive
        ? '已完成房客綁定'
        : '房客帳號目前不是啟用狀態',
      {
        bound: true,
        account_active: accountActive,
        tenant: {
          tenant_id: tenant.tenant_id || '',
          tenant_name:
            tenant.tenant_name ||
            tenant.name ||
            '',
          room_name:
            tenant.room_name ||
            tenant.room_list ||
            '',
          user_id:
            tenant.user_id ||
            tenant.tenant_user_id ||
            '',
          account_status: accountStatus,
          bound_at:
            tenant.bound_at ||
            tenant.binding_at ||
            ''
        }
      }
    );

  } catch (error) {
    tenantBindingLogAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'tenant',
      action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return tenantBindingResult_(
      false,
      tenantBindingRuntimeErrorCode_(error),
      '系統錯誤：' + error.message,
      {
        bound: false,
        account_active: false,
        tenant: null
      }
    );
  }
}


/**
 * 房客首次登入綁定。
 */
function bindTenantByLineUid_(lineUserId, phoneNumber, fixtureOptions) {
  const action = 'tenant_bind_submit';
  const lock = LockService.getScriptLock();
  const metrics = tenantBindingCreateMetrics_();
  const testOptions = tenantBindingFixtureOptions_(fixtureOptions);
  let locked = false;
  let snapshot = null;
  let coreCommitted = false;

  try {
    lineUserId = tenantBindingText_(lineUserId);
    phoneNumber = tenantBindingNormalizePhone_(phoneNumber);

    if (!lineUserId) {
      return tenantBindingResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID'
      );
    }

    if (!/^09\d{8}$/.test(phoneNumber)) {
      tenantBindingRecordFailure_(lineUserId);

      return tenantBindingResult_(
        false,
        'INVALID_PHONE_NUMBER',
        '請輸入正確的台灣手機號碼，例如 0912345678'
      );
    }

    const failureCount = tenantBindingFailureCount_(lineUserId);

    if (failureCount >= V2_TENANT_BINDING_MAX_FAILURES_) {
      tenantBindingWriteLog_({
        line_user_id: lineUserId,
        tenant_id: '',
        result: 'blocked',
        code: 'TOO_MANY_ATTEMPTS',
        message: '驗證失敗次數過多',
        note: 'failure_count=' + failureCount
      });

      return tenantBindingResult_(
        false,
        'TOO_MANY_ATTEMPTS',
        '驗證失敗次數過多，請 10 分鐘後再試'
      );
    }

    let ss = runtimeSpreadsheet_();
    snapshot = tenantBindingCreateRequestSnapshot_(ss, metrics);

    const schemaStartedAt = Date.now();
    tenantBindingValidateRuntimeSchema_(snapshot);
    metrics.schema_prepare_ms = Date.now() - schemaStartedAt;

    const tenantEntry = tenantBindingSnapshotEntry_(
      snapshot,
      V2_TENANT_BINDING_SHEETS_.tenants
    );
    const tenantSheet = tenantEntry.sheet;

    if (!tenantSheet) {
      return tenantBindingResult_(
        false,
        'TENANT_SHEET_NOT_FOUND',
        '找不到 V2_tenants 工作表'
      );
    }

    const lookupStartedAt = Date.now();
    const matchedTenants = tenantBindingFindTenantsByPhone_(
      snapshot,
      phoneNumber
    );
    metrics.lookup_snapshot_ms += Date.now() - lookupStartedAt;

    if (matchedTenants.length === 0) {
      tenantBindingRecordFailure_(lineUserId);

      tenantBindingWriteLog_({
        line_user_id: lineUserId,
        tenant_id: '',
        result: 'failed',
        code: 'PHONE_NOT_FOUND',
        message: '查無符合的房客資料',
        note:
          'phone=' +
          tenantBindingMaskPhone_(phoneNumber)
      });

      return tenantBindingResult_(
        false,
        'PHONE_NOT_FOUND',
        '查無符合的房客資料，請確認手機號碼是否與租約登記資料一致'
      );
    }

    if (matchedTenants.length > 1) {
      return tenantBindingResult_(
        false,
        'PHONE_BOUND_TO_OTHER_TENANT',
        '此手機號碼對應多筆租屋資料，請聯絡房東協助綁定',
        {
          bound: false
        }
      );
    }

    let tenant = matchedTenants[0];
    const tenantId = tenantBindingText_(
      tenant.tenant_id
    ).toUpperCase();

    const accountStatus = tenantBindingText_(
      tenant.account_status ||
      tenant.tenant_account_status ||
      tenant.status ||
      'active'
    ).toLowerCase();

    if (!tenantBindingIsActiveStatus_(accountStatus)) {
      tenantBindingWriteLog_({
        line_user_id: lineUserId,
        tenant_id: tenantId,
        result: 'failed',
        code: 'ACCOUNT_NOT_ACTIVE',
        message: '房客帳號未啟用'
      });

      return tenantBindingResult_(
        false,
        'ACCOUNT_NOT_ACTIVE',
        '房客帳號目前不是啟用狀態，請聯絡房東'
      );
    }

    let activeContract = tenantBindingResolveActiveContract_(
      ss,
      tenant,
      snapshot
    );

    if (!activeContract) {
      tenantBindingWriteLog_({
        line_user_id: lineUserId,
        tenant_id: tenantId,
        result: 'failed',
        code: 'ACTIVE_CONTRACT_NOT_FOUND',
        message: '找不到有效合約'
      });

      return tenantBindingResult_(
        false,
        'ACTIVE_CONTRACT_NOT_FOUND',
        '目前找不到有效或尚未到期的租賃合約，請聯絡房東'
      );
    }

    const uniquenessStartedAt = Date.now();
    let targetIdentity = tenantBindingNormalizeTargetIdentity_(
      tenant,
      activeContract
    );
    let ownershipDecision = tenantBindingEvaluateOwnership_(
      snapshot,
      lineUserId,
      targetIdentity
    );

    if (ownershipDecision.code !== 'NEW_BINDING') {
      metrics.uniqueness_check_ms =
        Date.now() - uniquenessStartedAt;
      return tenantBindingOwnershipResult_(
        ownershipDecision,
        tenant,
        activeContract,
        lineUserId
      );
    }

    if (
      typeof testOptions.beforeFinalOwnershipCheck === 'function'
    ) {
      testOptions.beforeFinalOwnershipCheck(
        snapshot,
        targetIdentity,
        ss
      );
    }

    const lockStartedAt = Date.now();
    lock.waitLock(15000);
    metrics.lock_wait_ms = Date.now() - lockStartedAt;
    locked = true;

    // Re-read canonical binding sources after acquiring ScriptLock. Reusing
    // the pre-lock snapshot here would leave a time-of-check/time-of-use gap.
    ss = runtimeSpreadsheet_();
    snapshot = tenantBindingCreateRequestSnapshot_(ss, metrics);
    tenantBindingValidateRuntimeSchema_(snapshot);

    const lockedMatches = tenantBindingFindTenantsByPhone_(
      snapshot,
      phoneNumber
    );

    if (
      lockedMatches.length !== 1 ||
      tenantBindingText_(lockedMatches[0].tenant_id).toUpperCase() !==
        targetIdentity.tenant_id
    ) {
      return tenantBindingOwnershipResult_(
        {
          code: 'BINDING_DATA_CONFLICT',
          manual_repair_required: true
        },
        tenant,
        activeContract,
        lineUserId
      );
    }

    tenant = lockedMatches[0];

    const lockedAccountStatus = tenantBindingText_(
      tenant.account_status ||
      tenant.tenant_account_status ||
      tenant.status ||
      'active'
    ).toLowerCase();
    activeContract = tenantBindingResolveActiveContract_(
      ss,
      tenant,
      snapshot
    );

    if (
      !tenantBindingIsActiveStatus_(lockedAccountStatus) ||
      !activeContract
    ) {
      return tenantBindingOwnershipResult_(
        {
          code: 'BINDING_DATA_CONFLICT',
          manual_repair_required: true
        },
        tenant,
        activeContract || {},
        lineUserId
      );
    }

    const lockedTargetIdentity = tenantBindingNormalizeTargetIdentity_(
      tenant,
      activeContract
    );

    if (!tenantBindingSameTargetIdentity_(
      targetIdentity,
      lockedTargetIdentity
    )) {
      return tenantBindingOwnershipResult_(
        {
          code: 'BINDING_DATA_CONFLICT',
          manual_repair_required: true
        },
        tenant,
        activeContract,
        lineUserId
      );
    }

    targetIdentity = lockedTargetIdentity;
    ownershipDecision = tenantBindingEvaluateOwnership_(
      snapshot,
      lineUserId,
      targetIdentity
    );
    metrics.uniqueness_check_ms = Date.now() - uniquenessStartedAt;

    if (ownershipDecision.code !== 'NEW_BINDING') {
      return tenantBindingOwnershipResult_(
        ownershipDecision,
        tenant,
        activeContract,
        lineUserId
      );
    }

    const now = new Date();

    const mutationStartedAt = Date.now();
    const patches = tenantBindingBuildMutationPatches_(
      snapshot,
      tenant,
      activeContract,
      lineUserId,
      now
    );
    const mutationPlan = tenantBindingBuildMutationPlan_(
      patches,
      testOptions
    );
    const transactionResult =
      tenantBindingApplyCompensatingTransaction_(
        mutationPlan,
        metrics,
        testOptions
      );
    metrics.mutation_write_ms = Date.now() - mutationStartedAt;

    if (!transactionResult.ok) {
      return tenantBindingResult_(
        false,
        transactionResult.code,
        transactionResult.code === 'BINDING_ROLLBACK_FAILED'
          ? '綁定寫入失敗且回復未完成，請聯絡管理員人工確認'
          : '綁定寫入失敗，資料已回復，請稍後再試',
        {
          bound: false,
          rollback_attempted:
            transactionResult.rollback_attempted,
          rollback_succeeded:
            transactionResult.rollback_succeeded,
          manual_repair_required:
            transactionResult.manual_repair_required === true,
          inconsistent_range:
            transactionResult.inconsistent_range || ''
        }
      );
    }

    coreCommitted = true;
    tenantBindingClearFailures_(lineUserId);

    const roomName = tenantBindingText_(
      tenant.room_name ||
      tenant.room_list ||
      activeContract.room_name ||
      activeContract.room_id
    );

    const auditStartedAt = Date.now();
    const auditResult = tenantBindingWriteBoundAudit_(
      {
        log_id: tenantBindingBoundAuditId_(
          tenantId,
          tenantBindingText_(activeContract.contract_id)
        ),
        line_user_id: lineUserId,
        tenant_id: tenantId,
        tenant_name:
          tenant.tenant_name ||
          tenant.name ||
          '',
        room_name: roomName,
        result: 'success',
        code: 'BOUND',
        message: '房客綁定成功',
        note:
          'contract_id=' +
          tenantBindingText_(
            activeContract.contract_id
          ) +
          ', phone=' +
          tenantBindingMaskPhone_(phoneNumber)
      },
      ss,
      metrics,
      testOptions
    );

    const accessAuditOk = tenantBindingLogAccess_({
      lineUserId,
      userId:
        tenant.tenant_user_id ||
        tenant.user_id ||
        '',
      role: 'tenant',
      action,
      targetId: tenantId,
      result: 'success',
      errorMessage: '',
      notes: 'phone binding completed'
    }, metrics, testOptions);
    metrics.audit_log_write_ms = Date.now() - auditStartedAt;

    const auditWarning =
      !auditResult.ok || accessAuditOk !== true;

    return tenantBindingResult_(
      true,
      'BOUND',
      '房客綁定成功',
      {
        tenant_id: tenantId,
        tenant_name:
          tenant.tenant_name ||
          tenant.name ||
          '',
        room_name: roomName,
        contract_id:
          activeContract.contract_id ||
          '',
        bound_at: now,
        bound: true,
        idempotent: false,
        audit_warning: auditWarning,
        audit_warning_code:
          auditWarning
            ? 'BINDING_AUDIT_INCOMPLETE'
            : ''
      }
    );

  } catch (error) {
    try {
      Logger.log(
        '[STAGING_TENANT_BINDING_ERROR] ' +
        tenantBindingText_(error && error.code || 'SYSTEM_ERROR')
      );
    } catch (ignored) {
      // A sanitized Logger record must not alter binding state.
    }

    return tenantBindingResult_(
      false,
      tenantBindingRuntimeErrorCode_(error),
      '系統錯誤：' + error.message,
      {
        bound: coreCommitted,
        manual_repair_required: coreCommitted
      }
    );

  } finally {
    metrics.total_binding_duration_ms =
      Date.now() - metrics.started_at_ms;
    metrics.full_sheet_reads_saved = Math.max(
      metrics.full_sheet_reads_before -
        metrics.full_sheet_reads_after,
      0
    );
    tenantBindingLogMetrics_(metrics);

    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * Phase 83 staging-only request snapshot and write planner.
 *
 * This snapshot lives only for one bind request. It is deliberately not
 * backed by CacheService because identity and uniqueness checks must use the
 * current Sheet state while the ScriptLock is held.
 */
function tenantBindingCreateMetrics_() {
  return {
    started_at_ms: Date.now(),
    total_binding_duration_ms: 0,
    lock_wait_ms: 0,
    schema_prepare_ms: 0,
    lookup_snapshot_ms: 0,
    uniqueness_check_ms: 0,
    mutation_write_ms: 0,
    spreadsheet_flush_ms: 0,
    audit_log_write_ms: 0,
    full_sheet_reads_before: 0,
    full_sheet_reads_after: 0,
    full_sheet_reads_saved: 0,
    batch_write_count: 0,
    cell_level_write_count: 0,
    binding_status_reconciliation_ms: 0
  };
}


function tenantBindingLogMetrics_(metrics) {
  try {
    Logger.log(
      '[STAGING_TENANT_BINDING_METRICS] ' +
      JSON.stringify({
        total_binding_duration_ms:
          metrics.total_binding_duration_ms,
        lock_wait_ms: metrics.lock_wait_ms,
        schema_prepare_ms: metrics.schema_prepare_ms,
        lookup_snapshot_ms: metrics.lookup_snapshot_ms,
        uniqueness_check_ms: metrics.uniqueness_check_ms,
        mutation_write_ms: metrics.mutation_write_ms,
        spreadsheet_flush_ms: metrics.spreadsheet_flush_ms,
        audit_log_write_ms: metrics.audit_log_write_ms,
        full_sheet_reads_before: metrics.full_sheet_reads_before,
        full_sheet_reads_after: metrics.full_sheet_reads_after,
        full_sheet_reads_saved: metrics.full_sheet_reads_saved,
        batch_write_count: metrics.batch_write_count,
        cell_level_write_count: metrics.cell_level_write_count,
        binding_status_reconciliation_ms:
          metrics.binding_status_reconciliation_ms
      })
    );
  } catch (error) {
    // Observability must never affect binding.
  }
}


function tenantBindingCreateRequestSnapshot_(ss, metrics) {
  return {
    spreadsheet: ss,
    metrics: metrics,
    entries: {}
  };
}


function tenantBindingSnapshotEntry_(snapshot, sheetName) {
  if (
    Object.prototype.hasOwnProperty.call(
      snapshot.entries,
      sheetName
    )
  ) {
    return snapshot.entries[sheetName];
  }

  const sheet = snapshot.spreadsheet.getSheetByName(sheetName);
  const entry = {
    sheet_name: sheetName,
    sheet: sheet || null,
    headers: [],
    header_map: {},
    values: [],
    rows: [],
    has_data: false
  };

  snapshot.entries[sheetName] = entry;

  if (!sheet || sheet.getLastColumn() < 1) {
    return entry;
  }

  if (sheet.getLastRow() >= 2) {
    snapshot.metrics.full_sheet_reads_before += 1;
    snapshot.metrics.full_sheet_reads_after += 1;
    entry.values = sheet.getDataRange().getValues();
    entry.has_data = true;
  } else {
    entry.values = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues();
  }

  entry.headers = (entry.values[0] || []).map(tenantBindingText_);
  entry.headers.forEach(function (header, index) {
    if (header) {
      entry.header_map[header] = index;
    }
  });

  entry.rows = entry.values.slice(1).map(function (values, index) {
    const row = {
      __row_number: index + 2,
      __raw_values: values
    };

    entry.headers.forEach(function (header, column) {
      if (header) {
        row[header] = values[column];
      }
    });

    return row;
  });

  return entry;
}


function tenantBindingSnapshotRows_(snapshot, sheetName) {
  const wasLoaded = Object.prototype.hasOwnProperty.call(
    snapshot.entries,
    sheetName
  );
  const entry = tenantBindingSnapshotEntry_(snapshot, sheetName);

  if (wasLoaded && entry.has_data) {
    snapshot.metrics.full_sheet_reads_before += 1;
  }

  return entry.rows;
}


function tenantBindingFixtureOptions_(options) {
  return (
    options &&
    options.__phase83_fixture === true
  )
    ? options
    : {};
}


function tenantBindingNormalizeTargetIdentity_(tenant, contract) {
  return {
    tenant_id: tenantBindingText_(tenant.tenant_id).toUpperCase(),
    tenant_user_id: tenantBindingText_(
      tenant.tenant_user_id || tenant.user_id
    ),
    contract_id: tenantBindingText_(contract.contract_id).toUpperCase(),
    workspace_id: tenantBindingText_(
      contract.workspace_id || tenant.workspace_id
    ).toUpperCase(),
    property_id: tenantBindingText_(
      contract.property_id || tenant.property_id
    ).toUpperCase(),
    room_id: tenantBindingText_(
      contract.room_id || tenant.room_id
    ).toUpperCase()
  };
}


function tenantBindingSameTargetIdentity_(left, right) {
  return [
    'tenant_id',
    'tenant_user_id',
    'contract_id',
    'workspace_id',
    'property_id',
    'room_id'
  ].every(function (key) {
    return tenantBindingText_(left[key]).toUpperCase() ===
      tenantBindingText_(right[key]).toUpperCase();
  });
}


function tenantBindingFindTenantsByPhone_(snapshot, phoneNumber) {
  const tenantRows = tenantBindingSnapshotRows_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.tenants
  );
  const userRows = tenantBindingSnapshotRows_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.users
  );
  const listRows = tenantBindingSnapshotRows_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.landlordTenantListView
  );
  const usersById = {};
  const listByTenantId = {};

  userRows.forEach(function (row) {
    const userId = tenantBindingText_(row.user_id);

    if (userId) {
      usersById[userId] = row;
    }
  });

  listRows.forEach(function (row) {
    const tenantId = tenantBindingText_(row.tenant_id).toUpperCase();

    if (tenantId && !listByTenantId[tenantId]) {
      listByTenantId[tenantId] = row;
    }
  });

  return tenantRows.filter(function (tenant) {
    const userId = tenantBindingText_(
      tenant.tenant_user_id || tenant.user_id
    );
    const tenantId = tenantBindingText_(tenant.tenant_id).toUpperCase();
    const registeredPhone = tenantBindingResolveRegisteredPhone_(
      tenant,
      usersById[userId] || {},
      listByTenantId[tenantId] || {}
    );

    return registeredPhone === phoneNumber;
  });
}


function tenantBindingTargetCanonicalRecords_(snapshot, target) {
  const definitions = [
    {
      name: 'tenant',
      sheet: V2_TENANT_BINDING_SHEETS_.tenants,
      uid_fields: ['tenant_line_user_id', 'line_user_id'],
      match: function (row) {
        return tenantBindingText_(row.tenant_id).toUpperCase() ===
          target.tenant_id;
      }
    },
    {
      name: 'user',
      sheet: V2_TENANT_BINDING_SHEETS_.users,
      uid_fields: ['line_user_id', 'tenant_line_user_id'],
      match: function (row) {
        return tenantBindingText_(row.user_id) === target.tenant_user_id;
      }
    },
    {
      name: 'contract',
      sheet: V2_TENANT_BINDING_SHEETS_.contracts,
      uid_fields: ['tenant_line_user_id'],
      match: function (row) {
        return tenantBindingText_(row.contract_id).toUpperCase() ===
          target.contract_id;
      }
    },
    {
      name: 'tenant_home_view',
      sheet: V2_TENANT_BINDING_SHEETS_.tenantHomeView,
      uid_fields: ['tenant_line_user_id', 'line_user_id'],
      match: function (row) {
        return (
          tenantBindingText_(row.tenant_id).toUpperCase() ===
            target.tenant_id &&
          tenantBindingText_(
            row.contract_id || row.current_contract_id
          ).toUpperCase() ===
            target.contract_id
        );
      }
    },
    {
      name: 'landlord_tenant_list_view',
      sheet: V2_TENANT_BINDING_SHEETS_.landlordTenantListView,
      uid_fields: ['tenant_line_user_id'],
      match: function (row) {
        return (
          tenantBindingText_(row.tenant_id).toUpperCase() ===
            target.tenant_id &&
          tenantBindingText_(
            row.contract_id || row.current_contract_id
          ).toUpperCase() ===
            target.contract_id
        );
      }
    }
  ];

  return definitions.map(function (definition) {
    return {
      name: definition.name,
      sheet: definition.sheet,
      uid_fields: definition.uid_fields,
      rows: tenantBindingSnapshotRows_(snapshot, definition.sheet)
        .filter(definition.match)
    };
  });
}


function tenantBindingRowUidValues_(row, fields) {
  const values = [];

  fields.forEach(function (field) {
    const value = tenantBindingText_(row[field]);

    if (value && values.indexOf(value) < 0) {
      values.push(value);
    }
  });

  return values;
}


function tenantBindingCollectUidOccurrences_(snapshot, lineUserId) {
  const tenants = tenantBindingSnapshotRows_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.tenants
  );
  const tenantIdsByUserId = {};

  tenants.forEach(function (tenant) {
    const userId = tenantBindingText_(
      tenant.tenant_user_id || tenant.user_id
    );
    const tenantId = tenantBindingText_(tenant.tenant_id).toUpperCase();

    if (!userId || !tenantId) return;
    tenantIdsByUserId[userId] = tenantIdsByUserId[userId] || [];

    if (tenantIdsByUserId[userId].indexOf(tenantId) < 0) {
      tenantIdsByUserId[userId].push(tenantId);
    }
  });

  const definitions = [
    {
      sheet: V2_TENANT_BINDING_SHEETS_.tenants,
      fields: ['tenant_line_user_id', 'line_user_id'],
      tenantId: function (row) {
        return tenantBindingText_(row.tenant_id).toUpperCase();
      }
    },
    {
      sheet: V2_TENANT_BINDING_SHEETS_.users,
      fields: ['line_user_id', 'tenant_line_user_id'],
      tenantId: function (row) {
        const ids = tenantIdsByUserId[tenantBindingText_(row.user_id)] || [];
        return ids.length === 1 ? ids[0] : '';
      }
    },
    {
      sheet: V2_TENANT_BINDING_SHEETS_.contracts,
      fields: ['tenant_line_user_id'],
      tenantId: function (row) {
        return tenantBindingText_(row.tenant_id).toUpperCase();
      }
    },
    {
      sheet: V2_TENANT_BINDING_SHEETS_.tenantHomeView,
      fields: ['tenant_line_user_id', 'line_user_id'],
      tenantId: function (row) {
        return tenantBindingText_(row.tenant_id).toUpperCase();
      }
    },
    {
      sheet: V2_TENANT_BINDING_SHEETS_.landlordTenantListView,
      fields: ['tenant_line_user_id'],
      tenantId: function (row) {
        return tenantBindingText_(row.tenant_id).toUpperCase();
      }
    }
  ];
  const occurrences = [];

  definitions.forEach(function (definition) {
    tenantBindingSnapshotRows_(snapshot, definition.sheet)
      .forEach(function (row) {
        const matches = definition.fields.some(function (field) {
          return tenantBindingText_(row[field]) === lineUserId;
        });

        if (matches) {
          occurrences.push({
            sheet: definition.sheet,
            row: row.__row_number,
            tenant_id: definition.tenantId(row)
          });
        }
      });
  });

  return occurrences;
}


function tenantBindingEvaluateOwnership_(snapshot, lineUserId, target) {
  const targetRecords = tenantBindingTargetCanonicalRecords_(snapshot, target);
  const malformedTarget = targetRecords.some(function (record) {
    return record.rows.length !== 1;
  });

  if (malformedTarget) {
    return {
      code: 'BINDING_DATA_CONFLICT',
      manual_repair_required: true
    };
  }

  const inconsistentTarget = targetRecords.some(function (record) {
    return !tenantBindingCanonicalRecordMatchesTarget_(
      record.name,
      record.rows[0],
      target
    );
  });

  if (inconsistentTarget) {
    return {
      code: 'BINDING_DATA_CONFLICT',
      manual_repair_required: true
    };
  }

  const occurrences = tenantBindingCollectUidOccurrences_(
    snapshot,
    lineUserId
  );
  const occurrenceTenantIds = [];
  let unknownOccurrence = false;

  occurrences.forEach(function (occurrence) {
    if (!occurrence.tenant_id) {
      unknownOccurrence = true;
      return;
    }

    if (occurrenceTenantIds.indexOf(occurrence.tenant_id) < 0) {
      occurrenceTenantIds.push(occurrence.tenant_id);
    }
  });

  if (unknownOccurrence || occurrenceTenantIds.length > 1) {
    return {
      code: 'BINDING_DATA_CONFLICT',
      manual_repair_required: true
    };
  }

  if (
    occurrenceTenantIds.length === 1 &&
    occurrenceTenantIds[0] !== target.tenant_id
  ) {
    return {
      code: 'UID_BOUND_TO_OTHER_TENANT',
      manual_repair_required: false
    };
  }

  const targetUidValues = [];
  let targetRowConflict = false;

  targetRecords.forEach(function (record) {
    const values = tenantBindingRowUidValues_(
      record.rows[0],
      record.uid_fields
    );

    if (values.length > 1) {
      targetRowConflict = true;
    }

    values.forEach(function (value) {
      if (targetUidValues.indexOf(value) < 0) {
        targetUidValues.push(value);
      }
    });
  });

  if (targetRowConflict || targetUidValues.length > 1) {
    return {
      code: 'BINDING_DATA_CONFLICT',
      manual_repair_required: true
    };
  }

  if (occurrenceTenantIds.length === 1) {
    const everyRecordMatches = targetRecords.every(function (record) {
      const values = tenantBindingRowUidValues_(
        record.rows[0],
        record.uid_fields
      );
      return values.length === 1 && values[0] === lineUserId;
    });

    return everyRecordMatches
      ? {
          code: 'BOUND',
          idempotent: true,
          manual_repair_required: false
        }
      : {
          code: 'BINDING_DATA_CONFLICT',
          manual_repair_required: true
        };
  }

  if (targetUidValues.length === 1) {
    return {
      code: 'TARGET_TENANT_BOUND_TO_OTHER_UID',
      manual_repair_required: false
    };
  }

  return {
    code: 'NEW_BINDING',
    idempotent: false,
    manual_repair_required: false
  };
}


function tenantBindingCanonicalRecordMatchesTarget_(name, row, target) {
  const fieldsByRecord = {
    tenant: [
      ['tenant_id', 'tenant_id'],
      ['tenant_user_id', 'tenant_user_id'],
      ['workspace_id', 'workspace_id'],
      ['property_id', 'property_id'],
      ['room_id', 'room_id']
    ],
    user: [
      ['user_id', 'tenant_user_id']
    ],
    contract: [
      ['tenant_id', 'tenant_id'],
      ['contract_id', 'contract_id'],
      ['workspace_id', 'workspace_id'],
      ['property_id', 'property_id'],
      ['room_id', 'room_id']
    ],
    tenant_home_view: [
      ['tenant_id', 'tenant_id'],
      ['tenant_user_id', 'tenant_user_id'],
      ['current_contract_id', 'contract_id'],
      ['workspace_id', 'workspace_id'],
      ['property_id', 'property_id'],
      ['room_id', 'room_id']
    ],
    landlord_tenant_list_view: [
      ['tenant_id', 'tenant_id'],
      ['tenant_user_id', 'tenant_user_id'],
      ['current_contract_id', 'contract_id'],
      ['workspace_id', 'workspace_id'],
      ['property_id', 'property_id'],
      ['room_id', 'room_id']
    ]
  };

  return (fieldsByRecord[name] || []).every(function (mapping) {
    const rowField = mapping[0];
    const targetField = mapping[1];

    // Legacy-compatible projections may omit a field entirely. If the field
    // exists, however, blank or mismatched identity data is a hard conflict.
    if (!Object.prototype.hasOwnProperty.call(row, rowField)) {
      return true;
    }

    return tenantBindingText_(row[rowField]).toUpperCase() ===
      tenantBindingText_(target[targetField]).toUpperCase();
  });
}


function tenantBindingOwnershipResult_(
  decision,
  tenant,
  activeContract,
  lineUserId
) {
  if (decision.code === 'BOUND') {
    tenantBindingClearFailures_(tenantBindingText_(lineUserId));

    return tenantBindingResult_(
      true,
      'BOUND',
      '此 LINE 帳號已完成房客綁定',
      {
        bound: true,
        idempotent: true,
        tenant_id: tenantBindingText_(tenant.tenant_id).toUpperCase(),
        tenant_name: tenant.tenant_name || tenant.name || '',
        room_name:
          tenant.room_name ||
          tenant.room_list ||
          activeContract.room_name ||
          activeContract.room_id ||
          '',
        contract_id: activeContract.contract_id || ''
      }
    );
  }

  const messages = {
    UID_BOUND_TO_OTHER_TENANT:
      '此 LINE 帳號已綁定其他房客，請聯絡管理員',
    TARGET_TENANT_BOUND_TO_OTHER_UID:
      '此房客已綁定其他 LINE 帳號，請聯絡管理員',
    BINDING_DATA_CONFLICT:
      '房客綁定資料不一致，請聯絡管理員人工確認'
  };

  return tenantBindingResult_(
    false,
    decision.code,
    messages[decision.code] || '房客綁定驗證失敗',
    {
      bound: false,
      manual_repair_required:
        decision.manual_repair_required === true
    }
  );
}


function tenantBindingSchemaError_(sheetName, detail) {
  const error = new Error(
    'Staging tenant binding schema is not ready: ' +
    sheetName +
    (detail ? ' (' + detail + ')' : '')
  );
  error.code = 'TENANT_BINDING_SCHEMA_INVALID';
  return error;
}


function tenantBindingRequireSheet_(snapshot, sheetName) {
  const entry = tenantBindingSnapshotEntry_(snapshot, sheetName);

  if (!entry.sheet) {
    throw tenantBindingSchemaError_(sheetName, 'missing sheet');
  }

  return entry;
}


function tenantBindingRequireOneHeader_(entry, candidates) {
  const found = candidates.find(function (header) {
    return entry.header_map[header] !== undefined;
  });

  if (!found) {
    throw tenantBindingSchemaError_(
      entry.sheet_name,
      'missing ' + candidates.join('|')
    );
  }

  return found;
}


function tenantBindingRequireExactHeaders_(entry, expected) {
  const actual = entry.headers.slice(0, expected.length);

  if (
    actual.length !== expected.length ||
    actual.some(function (header, index) {
      return header !== expected[index];
    })
  ) {
    throw tenantBindingSchemaError_(
      entry.sheet_name,
      'header order mismatch'
    );
  }
}


function tenantBindingValidateRuntimeSchema_(snapshot) {
  const tenant = tenantBindingRequireSheet_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.tenants
  );
  const users = tenantBindingRequireSheet_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.users
  );
  const contracts = tenantBindingRequireSheet_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.contracts
  );
  const home = tenantBindingRequireSheet_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.tenantHomeView
  );
  const list = tenantBindingRequireSheet_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.landlordTenantListView
  );

  [tenant, users, contracts, home, list].forEach(function (entry) {
    tenantBindingRequireOneHeader_(entry, ['tenant_id', 'user_id']);
    tenantBindingRequireOneHeader_(entry, ['updated_at', 'last_updated_at']);
  });

  tenantBindingRequireOneHeader_(tenant, [
    'tenant_line_user_id',
    'line_user_id'
  ]);
  tenantBindingRequireOneHeader_(tenant, [
    'tenant_binding_status',
    'binding_status'
  ]);
  tenantBindingRequireOneHeader_(tenant, [
    'bound_at',
    'binding_at',
    'line_bound_at'
  ]);

  tenantBindingRequireOneHeader_(users, [
    'line_user_id',
    'tenant_line_user_id'
  ]);
  tenantBindingRequireOneHeader_(users, [
    'binding_status',
    'tenant_binding_status'
  ]);
  tenantBindingRequireOneHeader_(users, ['bound_at', 'binding_at']);

  tenantBindingRequireOneHeader_(contracts, ['tenant_line_user_id']);
  tenantBindingRequireOneHeader_(home, ['line_user_id']);
  tenantBindingRequireOneHeader_(home, ['tenant_line_user_id']);
  tenantBindingRequireOneHeader_(home, [
    'tenant_binding_status',
    'binding_status'
  ]);
  tenantBindingRequireOneHeader_(home, [
    'bound_at',
    'binding_at',
    'line_bound_at'
  ]);
  tenantBindingRequireOneHeader_(list, ['tenant_line_user_id']);
  tenantBindingRequireOneHeader_(list, [
    'tenant_binding_status',
    'binding_status'
  ]);
  tenantBindingRequireOneHeader_(list, [
    'bound_at',
    'binding_at',
    'line_bound_at'
  ]);

  [
    'V2_tenant_bill_view',
    'V2_bills',
    'V2_payment_reports',
    'V2_tenant_messages'
  ].forEach(function (sheetName) {
    const entry = tenantBindingSnapshotEntry_(snapshot, sheetName);

    if (!entry.sheet) {
      return;
    }

    tenantBindingRequireOneHeader_(entry, ['tenant_line_user_id']);
    tenantBindingRequireOneHeader_(entry, ['updated_at', 'last_updated_at']);
  });

  const bindingLog = tenantBindingRequireSheet_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.bindingLogs
  );
  tenantBindingRequireExactHeaders_(bindingLog, [
    'log_id',
    'created_at',
    'line_user_id',
    'tenant_id',
    'tenant_name',
    'room_name',
    'result',
    'code',
    'message',
    'note'
  ]);

  const accessLog = tenantBindingRequireSheet_(
    snapshot,
    'V2_liff_access_logs'
  );
  tenantBindingRequireExactHeaders_(accessLog, [
    'log_id',
    'created_at',
    'line_user_id',
    'user_id',
    'role',
    'action',
    'target_id',
    'result',
    'error_message',
    'user_agent',
    'ip_hint',
    'notes'
  ]);
}


function tenantBindingQueuePatch_(patches, entry, row, candidates, value) {
  const header = tenantBindingRequireOneHeader_(entry, candidates);
  const column = entry.header_map[header];
  const key = entry.sheet_name + ':' + row.__row_number;

  if (!patches[key]) {
    patches[key] = {
      entry: entry,
      row_number: row.__row_number,
      columns: {}
    };
  }

  patches[key].columns[column] = value;
}


function tenantBindingQueueStandardPatch_(
  patches,
  entry,
  row,
  lineUserId,
  now,
  options
) {
  options = options || {};

  if (options.line_user_id) {
    tenantBindingQueuePatch_(patches, entry, row, ['line_user_id'], lineUserId);
  }

  if (options.tenant_line_user_id) {
    tenantBindingQueuePatch_(
      patches,
      entry,
      row,
      ['tenant_line_user_id'],
      lineUserId
    );
  }

  if (options.binding_status) {
    tenantBindingQueuePatch_(
      patches,
      entry,
      row,
      ['tenant_binding_status', 'binding_status'],
      'bound'
    );
    tenantBindingQueuePatch_(
      patches,
      entry,
      row,
      ['bound_at', 'binding_at', 'line_bound_at'],
      now
    );
  }

  tenantBindingQueuePatch_(
    patches,
    entry,
    row,
    ['updated_at', 'last_updated_at'],
    now
  );
}


function tenantBindingBuildMutationPatches_(
  snapshot,
  tenant,
  activeContract,
  lineUserId,
  now
) {
  const patches = {};
  const tenantEntry = tenantBindingSnapshotEntry_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.tenants
  );

  tenantBindingQueuePatch_(
    patches,
    tenantEntry,
    tenant,
    ['tenant_line_user_id', 'line_user_id'],
    lineUserId
  );
  tenantBindingQueueStandardPatch_(
    patches,
    tenantEntry,
    tenant,
    lineUserId,
    now,
    { binding_status: true }
  );

  const tenantId = tenantBindingText_(tenant.tenant_id).toUpperCase();
  const tenantUserId = tenantBindingText_(
    tenant.tenant_user_id || tenant.user_id
  );
  const contractId = tenantBindingText_(activeContract.contract_id);
  const userEntry = tenantBindingSnapshotEntry_(
    snapshot,
    V2_TENANT_BINDING_SHEETS_.users
  );
  const user = userEntry.rows.find(function (row) {
    return tenantBindingText_(row.user_id) === tenantUserId;
  });

  if (user) {
    tenantBindingQueuePatch_(
      patches,
      userEntry,
      user,
      ['line_user_id', 'tenant_line_user_id'],
      lineUserId
    );
    tenantBindingQueueStandardPatch_(
      patches,
      userEntry,
      user,
      lineUserId,
      now,
      { binding_status: true }
    );
  }

  [
    {
      sheet: V2_TENANT_BINDING_SHEETS_.tenantHomeView,
      line: true,
      tenant_line: true,
      binding: true
    },
    {
      sheet: 'V2_tenant_bill_view',
      line: true,
      tenant_line: true,
      binding: false
    },
    {
      sheet: V2_TENANT_BINDING_SHEETS_.landlordTenantListView,
      line: false,
      tenant_line: true,
      binding: true
    },
    {
      sheet: V2_TENANT_BINDING_SHEETS_.contracts,
      line: false,
      tenant_line: true,
      binding: false
    },
    {
      sheet: 'V2_bills',
      line: false,
      tenant_line: true,
      binding: false
    },
    {
      sheet: 'V2_payment_reports',
      line: false,
      tenant_line: true,
      binding: false
    },
    {
      sheet: 'V2_tenant_messages',
      line: false,
      tenant_line: true,
      binding: false
    }
  ].forEach(function (config) {
    const entry = tenantBindingSnapshotEntry_(snapshot, config.sheet);

    if (!entry.sheet || entry.rows.length === 0) {
      return;
    }

    entry.rows.forEach(function (row) {
      const matchesTenant =
        tenantId &&
        tenantBindingText_(row.tenant_id).toUpperCase() === tenantId;
      const matchesUser =
        !matchesTenant &&
        tenantUserId &&
        tenantBindingText_(row.tenant_user_id || row.user_id) === tenantUserId;
      const matchesContract =
        !matchesTenant &&
        !matchesUser &&
        contractId &&
        tenantBindingText_(row.contract_id || row.current_contract_id) ===
          contractId;

      if (!matchesTenant && !matchesUser && !matchesContract) {
        return;
      }

      tenantBindingQueueStandardPatch_(
        patches,
        entry,
        row,
        lineUserId,
        now,
        {
          line_user_id: config.line,
          tenant_line_user_id: config.tenant_line,
          binding_status: config.binding
        }
      );
    });
  });

  return Object.keys(patches).map(function (key) {
    return patches[key];
  });
}


function tenantBindingBuildMutationPlan_(patches, testOptions) {
  const sheetOrder = {
    V2_tenants: 10,
    V2_users: 20,
    V2_contracts: 30,
    V2_tenant_home_view: 40,
    V2_landlord_tenant_list_view: 50,
    V2_tenant_bill_view: 60,
    V2_bills: 70,
    V2_payment_reports: 80,
    V2_tenant_messages: 90
  };
  const plan = [];

  patches.forEach(function (patch) {
    const columns = Object.keys(patch.columns)
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      });

    if (columns.length === 0) return;

    const groups = [];
    columns.forEach(function (column) {
      const last = groups[groups.length - 1];

      if (!last || column !== last[last.length - 1] + 1) {
        groups.push([column]);
      } else {
        last.push(column);
      }
    });

    groups.forEach(function (group) {
      const start = group[0];
      const afterValues = group.map(function (column) {
        return patch.columns[column];
      });
      const beforeValues = group.map(function (column) {
        const sourceRow = patch.entry.values[patch.row_number - 1] || [];
        return sourceRow[column] === undefined ? '' : sourceRow[column];
      });

      if (tenantBindingValuesEqual_(beforeValues, afterValues)) {
        return;
      }

      plan.push({
        sheet_name: patch.entry.sheet_name,
        sheet: patch.entry.sheet,
        row: patch.row_number,
        column: start + 1,
        width: group.length,
        before_values: [beforeValues],
        after_values: [afterValues],
        purpose:
          'tenant_binding:' +
          patch.entry.sheet_name +
          ':row_' +
          patch.row_number
      });
    });
  });

  plan.sort(function (a, b) {
    return (
      (sheetOrder[a.sheet_name] || 999) -
        (sheetOrder[b.sheet_name] || 999) ||
      a.row - b.row ||
      a.column - b.column
    );
  });

  if (testOptions) {
    testOptions.observedMutationCount = plan.length;
  }

  return plan;
}


function tenantBindingValuesEqual_(left, right) {
  if (left.length !== right.length) return false;

  return left.every(function (value, index) {
    const other = right[index];

    if (value instanceof Date && other instanceof Date) {
      return value.getTime() === other.getTime();
    }

    return value === other;
  });
}


function tenantBindingValidateMutationPlan_(plan) {
  plan.forEach(function (mutation) {
    if (
      !mutation.sheet ||
      mutation.row < 2 ||
      mutation.column < 1 ||
      mutation.width < 1 ||
      mutation.before_values.length !== 1 ||
      mutation.after_values.length !== 1 ||
      mutation.before_values[0].length !== mutation.width ||
      mutation.after_values[0].length !== mutation.width ||
      mutation.row > mutation.sheet.getLastRow() ||
      mutation.column + mutation.width - 1 >
        mutation.sheet.getLastColumn()
    ) {
      const error = new Error('Invalid tenant binding mutation plan');
      error.code = 'TENANT_BINDING_MUTATION_PLAN_INVALID';
      throw error;
    }

    // Resolve every Range before the first write so bad dimensions fail early.
    mutation.range = mutation.sheet.getRange(
      mutation.row,
      mutation.column,
      1,
      mutation.width
    );
  });
}


function tenantBindingApplyCompensatingTransaction_(
  plan,
  metrics,
  testOptions
) {
  const appliedMutations = [];

  try {
    tenantBindingValidateMutationPlan_(plan);

    if (testOptions.failBeforeFirstMutation === true) {
      throw new Error('Injected failure before first mutation');
    }

    plan.forEach(function (mutation, index) {
      mutation.range.setValues(mutation.after_values);
      metrics.batch_write_count += 1;
      appliedMutations.push(mutation);

      if (testOptions.failAfterMutationIndex === index) {
        throw new Error('Injected failure after mutation ' + index);
      }
    });

    const flushStartedAt = Date.now();
    SpreadsheetApp.flush();
    metrics.spreadsheet_flush_ms += Date.now() - flushStartedAt;

    const failedVerification = plan.find(function (mutation) {
      return !tenantBindingValuesEqual_(
        mutation.range.getValues()[0],
        mutation.after_values[0]
      );
    });

    if (failedVerification) {
      throw new Error(
        'Binding verification failed at ' +
        failedVerification.sheet_name
      );
    }

    return {
      ok: true,
      code: 'BOUND',
      applied_count: appliedMutations.length
    };

  } catch (forwardError) {
    return tenantBindingRollbackAppliedMutations_(
      appliedMutations,
      metrics,
      testOptions,
      forwardError
    );
  }
}


function tenantBindingRollbackAppliedMutations_(
  appliedMutations,
  metrics,
  testOptions,
  forwardError
) {
  let rollbackError = null;
  let inconsistentRange = '';
  const reversed = appliedMutations.slice().reverse();

  reversed.forEach(function (mutation, rollbackIndex) {
    try {
      if (testOptions.failRollbackAtIndex === rollbackIndex) {
        throw new Error('Injected rollback failure ' + rollbackIndex);
      }

      mutation.range.setValues(mutation.before_values);
      metrics.batch_write_count += 1;
    } catch (error) {
      rollbackError = rollbackError || error;
      inconsistentRange = inconsistentRange ||
        tenantBindingMutationRangeLabel_(mutation);
    }
  });

  if (appliedMutations.length > 0) {
    const flushStartedAt = Date.now();
    SpreadsheetApp.flush();
    metrics.spreadsheet_flush_ms += Date.now() - flushStartedAt;
  }

  appliedMutations.forEach(function (mutation) {
    try {
      const restored = tenantBindingValuesEqual_(
        mutation.range.getValues()[0],
        mutation.before_values[0]
      );

      if (!restored && !inconsistentRange) {
        inconsistentRange = tenantBindingMutationRangeLabel_(mutation);
      }
    } catch (error) {
      rollbackError = rollbackError || error;
      inconsistentRange = inconsistentRange ||
        tenantBindingMutationRangeLabel_(mutation);
    }
  });

  const rollbackSucceeded =
    !rollbackError && !inconsistentRange;

  if (!rollbackSucceeded) {
    try {
      Logger.log(
        '[STAGING_TENANT_BINDING_ROLLBACK_FAILED] ' +
        (inconsistentRange || 'unverified_range')
      );
    } catch (ignored) {
      // Sanitized operational signal only.
    }
  }

  return {
    ok: false,
    code: rollbackSucceeded
      ? 'SYSTEM_ERROR'
      : 'BINDING_ROLLBACK_FAILED',
    rollback_attempted: appliedMutations.length > 0,
    rollback_succeeded: rollbackSucceeded,
    manual_repair_required: !rollbackSucceeded,
    inconsistent_range: inconsistentRange,
    error_code: tenantBindingText_(forwardError && forwardError.code)
  };
}


function tenantBindingMutationRangeLabel_(mutation) {
  return (
    mutation.sheet_name +
    '!R' +
    mutation.row +
    'C' +
    mutation.column +
    ':W' +
    mutation.width
  );
}


/**
 * 讀取可選工作表；不存在時回傳空陣列。
 */
function tenantBindingGetOptionalObjects_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);

  return sheet
    ? tenantBindingGetObjectsWithRow_(sheet)
    : [];
}


/**
 * 從房客、使用者或房客清單中取得登記手機號碼。
 */
function tenantBindingResolveRegisteredPhone_(
  tenant,
  user,
  tenantListRow
) {
  const candidates = [
    tenant.tenant_phone,
    tenant.phone,
    tenant.mobile,
    tenant.mobile_phone,
    tenant.contact_phone,

    user.tenant_phone,
    user.phone,
    user.mobile,
    user.mobile_phone,
    user.contact_phone,

    tenantListRow.tenant_phone,
    tenantListRow.phone,
    tenantListRow.mobile,
    tenantListRow.mobile_phone,
    tenantListRow.contact_phone
  ];

  for (let index = 0; index < candidates.length; index++) {
    const normalized = tenantBindingNormalizePhone_(
      candidates[index]
    );

    if (normalized) {
      return normalized;
    }
  }

  return '';
}


/**
 * 台灣手機號碼正規化。
 *
 * 支援：
 * - 0912345678
 * - 912345678
 * - 886912345678
 * - +886 912 345 678
 */
function tenantBindingNormalizePhone_(value) {
  let digits = tenantBindingDigits_(value);

  if (!digits) {
    return '';
  }

  if (
    digits.indexOf('8860') === 0 &&
    digits.length === 13
  ) {
    digits =
      '0' +
      digits.slice(4);
  } else if (
    digits.indexOf('886') === 0 &&
    digits.length === 12
  ) {
    digits =
      '0' +
      digits.slice(3);
  } else if (
    digits.length === 9 &&
    digits.charAt(0) === '9'
  ) {
    digits =
      '0' +
      digits;
  }

  return digits;
}


function tenantBindingMaskPhone_(phoneNumber) {
  const phone = tenantBindingNormalizePhone_(
    phoneNumber
  );

  if (phone.length !== 10) {
    return '';
  }

  return (
    phone.slice(0, 2) +
    '******' +
    phone.slice(-2)
  );
}



/**
 * 依 LINE UID 找房客。
 */
function tenantBindingResolveByLineUid_(ss, lineUserId, snapshot) {
  const sheetNames = [
    V2_TENANT_BINDING_SHEETS_.tenantHomeView,
    V2_TENANT_BINDING_SHEETS_.landlordTenantListView,
    V2_TENANT_BINDING_SHEETS_.tenants
  ];

  for (let i = 0; i < sheetNames.length; i++) {
    const sheet = ss.getSheetByName(sheetNames[i]);

    if (!sheet) {
      continue;
    }

    const rows = snapshot
      ? tenantBindingSnapshotRows_(snapshot, sheetNames[i])
      : tenantBindingGetObjectsWithRow_(sheet);

    const row = rows.find(
      function (item) {
        return (
          tenantBindingText_(
            item.tenant_line_user_id ||
            item.line_user_id
          ) === lineUserId
        );
      }
    );

    if (row) {
      return row;
    }
  }

  return null;
}


/**
 * 找有效或尚未到期合約。
 */
function tenantBindingResolveActiveContract_(ss, tenant, snapshot) {
  const sheet = ss.getSheetByName(
    V2_TENANT_BINDING_SHEETS_.contracts
  );

  if (!sheet) {
    return null;
  }

  const tenantId = tenantBindingText_(tenant.tenant_id).toUpperCase();
  const roomId = tenantBindingText_(tenant.room_id);

  const sourceRows = snapshot
    ? tenantBindingSnapshotRows_(
        snapshot,
        V2_TENANT_BINDING_SHEETS_.contracts
      )
    : tenantBindingGetObjectsWithRow_(sheet);

  const rows = sourceRows
    .filter(function (row) {
      const rowTenantId = tenantBindingText_(row.tenant_id).toUpperCase();
      const rowRoomId = tenantBindingText_(row.room_id);

      return (
        rowTenantId === tenantId &&
        (
          !roomId ||
          !rowRoomId ||
          rowRoomId === roomId
        )
      );
    })
    .filter(tenantBindingContractIsUsable_);

  rows.sort(function (a, b) {
    return (
      tenantBindingTimeValue_(
        b.end_date ||
        b.contract_end_date ||
        b.lease_end_date ||
        b.updated_at
      ) -
      tenantBindingTimeValue_(
        a.end_date ||
        a.contract_end_date ||
        a.lease_end_date ||
        a.updated_at
      )
    );
  });

  return rows[0] || null;
}


function tenantBindingContractIsUsable_(contract) {
  const status = tenantBindingText_(
    contract.contract_status ||
    contract.status ||
    contract.account_status
  ).toLowerCase();

  if (
    [
      'active',
      'valid',
      'current',
      'enabled',
      '啟用',
      '有效'
    ].indexOf(status) >= 0
  ) {
    return true;
  }

  const endDate = tenantBindingDateObject_(
    contract.end_date ||
    contract.contract_end_date ||
    contract.lease_end_date
  );

  if (!endDate) {
    return false;
  }

  return (
    endDate.getTime() >=
    tenantBindingTaipeiToday_().getTime()
  );
}


/**
 * 寫入 V2_tenants。
 */
function tenantBindingUpdateTenantRow_(
  sheet,
  rowNumber,
  lineUserId,
  now
) {
  const map = tenantBindingHeaderMap_(sheet);
  const lineHeaders = [
    'tenant_line_user_id',
    'line_user_id'
  ];

  let hasLineHeader = false;

  lineHeaders.forEach(function (header) {
    if (map[header] !== undefined) {
      sheet
        .getRange(rowNumber, map[header] + 1)
        .setValue(lineUserId);

      hasLineHeader = true;
    }
  });

  if (!hasLineHeader) {
    const column = tenantBindingEnsureHeader_(
      sheet,
      'tenant_line_user_id'
    );

    sheet.getRange(rowNumber, column).setValue(lineUserId);
  }

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    rowNumber,
    [
      'tenant_binding_status',
      'binding_status'
    ],
    'tenant_binding_status',
    'bound'
  );

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    rowNumber,
    [
      'bound_at',
      'binding_at',
      'line_bound_at'
    ],
    'bound_at',
    now
  );

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    rowNumber,
    [
      'updated_at',
      'last_updated_at'
    ],
    'updated_at',
    now
  );
}


/**
 * V2_users 存在時同步 LINE UID。
 */
function tenantBindingUpdateUserRowIfPresent_(
  ss,
  tenant,
  lineUserId,
  now
) {
  const sheet = ss.getSheetByName(
    V2_TENANT_BINDING_SHEETS_.users
  );

  if (!sheet) {
    return;
  }

  const userId = tenantBindingText_(
    tenant.tenant_user_id ||
    tenant.user_id
  );

  if (!userId) {
    return;
  }

  const rows = tenantBindingGetObjectsWithRow_(sheet);

  const user = rows.find(function (row) {
    return tenantBindingText_(row.user_id) === userId;
  });

  if (!user) {
    return;
  }

  const duplicate = rows.find(function (row) {
    return (
      tenantBindingText_(row.line_user_id) === lineUserId &&
      tenantBindingText_(row.user_id) !== userId
    );
  });

  if (duplicate) {
    throw new Error(
      '此 LINE 帳號已綁定其他系統使用者'
    );
  }

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    user.__row_number,
    [
      'line_user_id',
      'tenant_line_user_id'
    ],
    'line_user_id',
    lineUserId
  );

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    user.__row_number,
    [
      'binding_status',
      'tenant_binding_status'
    ],
    'binding_status',
    'bound'
  );

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    user.__row_number,
    [
      'bound_at',
      'binding_at'
    ],
    'bound_at',
    now
  );

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    user.__row_number,
    [
      'updated_at',
      'last_updated_at'
    ],
    'updated_at',
    now
  );
}


/**
 * 綁定完成後同步所有 V2 view 與營運資料。
 *
 * landlord tenant list 的 line_user_id 是房東查詢鍵，不可覆蓋；
 * 該表只更新 tenant_line_user_id。
 */
function tenantBindingSyncLineUidAcrossData_(
  ss,
  tenant,
  activeContract,
  lineUserId,
  now
) {
  const tenantId =
    tenantBindingText_(
      tenant.tenant_id
    ).toUpperCase();

  const tenantUserId =
    tenantBindingText_(
      tenant.tenant_user_id ||
      tenant.user_id
    );

  const contractId =
    tenantBindingText_(
      activeContract &&
      activeContract.contract_id
        ? activeContract.contract_id
        : ''
    );

  const configs = [
    {
      sheet_name:
        V2_TENANT_BINDING_SHEETS_
          .tenantHomeView,
      set_line_user_id:
        true,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        true
    },
    {
      sheet_name:
        'V2_tenant_bill_view',
      set_line_user_id:
        true,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        false
    },
    {
      sheet_name:
        V2_TENANT_BINDING_SHEETS_
          .landlordTenantListView,
      set_line_user_id:
        false,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        true
    },
    {
      sheet_name:
        V2_TENANT_BINDING_SHEETS_
          .contracts,
      set_line_user_id:
        false,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        false
    },
    {
      sheet_name:
        'V2_bills',
      set_line_user_id:
        false,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        false
    },
    {
      sheet_name:
        'V2_payment_reports',
      set_line_user_id:
        false,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        false
    },
    {
      sheet_name:
        'V2_tenant_messages',
      set_line_user_id:
        false,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        false
    }
  ];

  configs.forEach(
    function (config) {
      const sheet =
        ss.getSheetByName(
          config.sheet_name
        );

      if (
        !sheet ||
        sheet.getLastRow() < 2
      ) {
        return;
      }

      const rows =
        tenantBindingGetObjectsWithRow_(
          sheet
        );

      rows.forEach(
        function (row) {
          const rowTenantId =
            tenantBindingText_(
              row.tenant_id
            ).toUpperCase();

          const rowTenantUserId =
            tenantBindingText_(
              row.tenant_user_id ||
              row.user_id
            );

          const rowContractId =
            tenantBindingText_(
              row.contract_id ||
              row.current_contract_id
            );

          const matchesTenant =
            tenantId &&
            rowTenantId ===
              tenantId;

          const matchesUser =
            !matchesTenant &&
            tenantUserId &&
            rowTenantUserId ===
              tenantUserId;

          const matchesContract =
            !matchesTenant &&
            !matchesUser &&
            contractId &&
            rowContractId ===
              contractId;

          if (
            !matchesTenant &&
            !matchesUser &&
            !matchesContract
          ) {
            return;
          }

          if (
            config.set_line_user_id
          ) {
            tenantBindingSetFirstExistingOrCreate_(
              sheet,
              row.__row_number,
              [
                'line_user_id'
              ],
              'line_user_id',
              lineUserId
            );
          }

          if (
            config
              .set_tenant_line_user_id
          ) {
            tenantBindingSetFirstExistingOrCreate_(
              sheet,
              row.__row_number,
              [
                'tenant_line_user_id'
              ],
              'tenant_line_user_id',
              lineUserId
            );
          }

          if (
            config.set_binding_status
          ) {
            tenantBindingSetFirstExistingOrCreate_(
              sheet,
              row.__row_number,
              [
                'tenant_binding_status',
                'binding_status'
              ],
              'tenant_binding_status',
              'bound'
            );

            tenantBindingSetFirstExistingOrCreate_(
              sheet,
              row.__row_number,
              [
                'bound_at',
                'binding_at',
                'line_bound_at'
              ],
              'bound_at',
              now
            );
          }

          tenantBindingSetFirstExistingOrCreate_(
            sheet,
            row.__row_number,
            [
              'updated_at',
              'last_updated_at'
            ],
            'updated_at',
            now
          );
        }
      );
    }
  );
}


/**
 * 綁定紀錄。
 */
function tenantBindingBoundAuditId_(tenantId, contractId) {
  return (
    'BOUND-' +
    tenantBindingText_(tenantId).toUpperCase() +
    '-' +
    tenantBindingText_(contractId).toUpperCase()
  );
}


function tenantBindingWriteBoundAudit_(
  record,
  spreadsheet,
  metrics,
  testOptions
) {
  if (testOptions.failAuditWrite === true) {
    return {
      ok: false,
      duplicate: false,
      warning_code: 'BINDING_AUDIT_INCOMPLETE'
    };
  }

  return tenantBindingWriteLog_(record, spreadsheet, metrics);
}


function tenantBindingWriteLog_(record, spreadsheet, metrics) {
  try {
    const ss = spreadsheet || runtimeSpreadsheet_();
    const sheet = ss.getSheetByName(
      V2_TENANT_BINDING_SHEETS_.bindingLogs
    );

    if (!sheet) {
      throw tenantBindingSchemaError_(
        V2_TENANT_BINDING_SHEETS_.bindingLogs,
        'missing sheet'
      );
    }

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map(tenantBindingText_);

    const canonicalHeaders = [
      'log_id',
      'created_at',
      'line_user_id',
      'tenant_id',
      'tenant_name',
      'room_name',
      'result',
      'code',
      'message',
      'note'
    ];

    if (
      canonicalHeaders.some(function (header, index) {
        return headers[index] !== header;
      })
    ) {
      throw tenantBindingSchemaError_(
        V2_TENANT_BINDING_SHEETS_.bindingLogs,
        'header order mismatch'
      );
    }

    const data = Object.assign(
      {
        log_id: tenantBindingMakeLogId_(),
        created_at: new Date(),
        line_user_id: '',
        tenant_id: '',
        tenant_name: '',
        room_name: '',
        result: '',
        code: '',
        message: '',
        note: ''
      },
      record || {}
    );

    if (data.log_id && sheet.getLastRow() >= 2) {
      const existingIds = sheet
        .getRange(2, 1, sheet.getLastRow() - 1, 1)
        .getValues()
        .map(function (row) {
          return tenantBindingText_(row[0]);
        });

      if (existingIds.indexOf(tenantBindingText_(data.log_id)) >= 0) {
        return {
          ok: true,
          duplicate: true
        };
      }
    }

    sheet
      .getRange(sheet.getLastRow() + 1, 1, 1, canonicalHeaders.length)
      .setValues([canonicalHeaders.map(function (header) {
        return (
          data[header] !== undefined
            ? data[header]
            : ''
        );
      })]);

    if (metrics) {
      metrics.batch_write_count += 1;
    }

    return {
      ok: true,
      duplicate: false
    };

  } catch (error) {
    try {
      Logger.log(
        '[STAGING_TENANT_BINDING_AUDIT_WARNING] ' +
        tenantBindingText_(error && error.message)
      );
    } catch (ignored) {
      // Audit is explicitly non-blocking after persisted binding.
    }

    return {
      ok: false,
      duplicate: false,
      warning_code: 'BINDING_AUDIT_INCOMPLETE'
    };
  }
}


function tenantBindingEnsureLogSheet_() {
  const ss = runtimeSpreadsheet_();
  let sheet = ss.getSheetByName(
    V2_TENANT_BINDING_SHEETS_.bindingLogs
  );

  const headers = [
    'log_id',
    'created_at',
    'line_user_id',
    'tenant_id',
    'tenant_name',
    'room_name',
    'result',
    'code',
    'message',
    'note'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(
      V2_TENANT_BINDING_SHEETS_.bindingLogs
    );

    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    return sheet;
  }

  headers.forEach(function (header) {
    tenantBindingEnsureHeader_(sheet, header);
  });

  return sheet;
}


/**
 * 驗證失敗限制。
 */
function tenantBindingFailureCount_(lineUserId) {
  return Number(
    CacheService
      .getScriptCache()
      .get(tenantBindingFailureKey_(lineUserId)) ||
    0
  );
}


function tenantBindingRecordFailure_(lineUserId) {
  const cache = CacheService.getScriptCache();
  const key = tenantBindingFailureKey_(lineUserId);
  const count = Number(cache.get(key) || 0) + 1;

  cache.put(
    key,
    String(count),
    V2_TENANT_BINDING_BLOCK_SECONDS_
  );
}


function tenantBindingClearFailures_(lineUserId) {
  CacheService
    .getScriptCache()
    .remove(
      tenantBindingFailureKey_(lineUserId)
    );
}


function tenantBindingFailureKey_(lineUserId) {
  return (
    'tenant_bind_fail_' +
    tenantBindingText_(lineUserId).slice(-24)
  );
}


/**
 * 工作表工具。
 */
function tenantBindingGetObjectsWithRow_(sheet) {
  if (
    !sheet ||
    sheet.getLastRow() < 2 ||
    sheet.getLastColumn() < 1
  ) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(tenantBindingText_);

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


function tenantBindingHeaderMap_(sheet) {
  const headers = sheet
    .getRange(
      1,
      1,
      1,
      Math.max(sheet.getLastColumn(), 1)
    )
    .getValues()[0];

  const map = {};

  headers.forEach(function (header, index) {
    const key = tenantBindingText_(header);

    if (key) {
      map[key] = index;
    }
  });

  return map;
}


function tenantBindingEnsureHeader_(sheet, header) {
  const map = tenantBindingHeaderMap_(sheet);

  if (map[header] !== undefined) {
    return map[header] + 1;
  }

  const column = sheet.getLastColumn() + 1;
  sheet.getRange(1, column).setValue(header);

  return column;
}


function tenantBindingSetFirstExistingOrCreate_(
  sheet,
  rowNumber,
  candidates,
  createHeader,
  value
) {
  const map = tenantBindingHeaderMap_(sheet);

  const existing = candidates.find(function (header) {
    return map[header] !== undefined;
  });

  const column = existing
    ? map[existing] + 1
    : tenantBindingEnsureHeader_(
        sheet,
        createHeader
      );

  sheet.getRange(rowNumber, column).setValue(value);
}


/**
 * 一般工具。
 */
function tenantBindingText_(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value).trim();
}


function tenantBindingDigits_(value) {
  return tenantBindingText_(value).replace(/\D/g, '');
}


function tenantBindingIsActiveStatus_(status) {
  return (
    [
      'active',
      'enabled',
      'valid',
      'current',
      '啟用',
      '有效'
    ].indexOf(
      tenantBindingText_(status).toLowerCase()
    ) >= 0
  );
}


function tenantBindingDateObject_(value) {
  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return value;
  }

  const text = tenantBindingText_(value);

  if (!text) {
    return null;
  }

  const exact = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (exact) {
    return new Date(
      Number(exact[1]),
      Number(exact[2]) - 1,
      Number(exact[3]),
      0,
      0,
      0,
      0
    );
  }

  const date = new Date(text);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}


function tenantBindingTaipeiToday_() {
  return tenantBindingDateObject_(
    Utilities.formatDate(
      new Date(),
      V2_TENANT_BINDING_TIMEZONE_,
      'yyyy-MM-dd'
    )
  );
}


function tenantBindingTimeValue_(value) {
  const date = tenantBindingDateObject_(value);
  return date ? date.getTime() : 0;
}


function tenantBindingMakeLogId_() {
  return (
    'TBL-' +
    Utilities.formatDate(
      new Date(),
      V2_TENANT_BINDING_TIMEZONE_,
      'yyyyMMddHHmmss'
    ) +
    '-' +
    Math.floor(1000 + Math.random() * 9000)
  );
}


function tenantBindingResult_(success, code, message, data) {
  return {
    success: success === true,
    code: code || '',
    message: message || '',
    data:
      data === undefined
        ? null
        : data
  };
}


function tenantBindingRuntimeErrorCode_(error) {
  const code = tenantBindingText_(
    error && error.code
  );

  return (
    code === 'STAGING_SPREADSHEET_NOT_CONFIGURED' ||
    code === 'STAGING_SPREADSHEET_UNAVAILABLE' ||
    code === 'TENANT_BINDING_SCHEMA_INVALID'
  )
    ? code
    : 'SYSTEM_ERROR';
}


function tenantBindingLogAccess_(payload, metrics, testOptions) {
  if (testOptions && testOptions.failAuditWrite === true) {
    return false;
  }

  if (typeof logLiffAccess_ === 'function') {
    try {
      logLiffAccess_(payload, metrics);
      return true;
    } catch (error) {
      // 不影響主要流程。
      return false;
    }
  }

  return false;
}


// ==================================================
// Existing binding diagnosis and repair
// ==================================================

function diagnoseAllTenantLineBindings_() {
  const ss =
    runtimeSpreadsheet_();

  const index =
    tenantBindingBuildLineCandidateIndex_(
      ss
    );

  const tenantSheet =
    ss.getSheetByName(
      V2_TENANT_BINDING_SHEETS_
        .tenants
    );

  if (!tenantSheet) {
    return {
      success:
        false,
      code:
        'TENANT_SHEET_NOT_FOUND',
      message:
        '找不到 V2_tenants'
    };
  }

  const tenants =
    tenantBindingGetObjectsWithRow_(
      tenantSheet
    );

  const rows =
    tenants.map(
      function (tenant) {
        const tenantId =
          tenantBindingText_(
            tenant.tenant_id
          ).toUpperCase();

        const tenantUserId =
          tenantBindingText_(
            tenant.tenant_user_id ||
            tenant.user_id
          );

        const candidates =
          tenantBindingResolveLineCandidates_(
            index,
            tenantId,
            tenantUserId
          );

        return {
          tenant_id:
            tenantId,
          tenant_name:
            tenantBindingText_(
              tenant.tenant_name ||
              tenant.name
            ),
          tenant_phone:
            tenantBindingText_(
              tenant.tenant_phone ||
              tenant.phone
            ),
          room_list:
            tenantBindingResolveTenantRoomList_(
              index,
              tenantId
            ),
          current_tenant_line_user_id:
            tenantBindingText_(
              tenant.tenant_line_user_id ||
              tenant.line_user_id
            ),
          candidate_count:
            candidates.length,
          candidate_line_user_ids:
            candidates,
          status:
            candidates.length ===
              0
              ? 'unbound'
              : (
                  candidates.length ===
                    1
                    ? 'resolvable'
                    : 'conflict'
                )
        };
      }
    );

  const result = {
    success:
      true,
    tenant_count:
      rows.length,
    resolvable_count:
      rows.filter(
        function (row) {
          return (
            row.status ===
            'resolvable'
          );
        }
      ).length,
    unbound_count:
      rows.filter(
        function (row) {
          return (
            row.status ===
            'unbound'
          );
        }
      ).length,
    conflict_count:
      rows.filter(
        function (row) {
          return (
            row.status ===
            'conflict'
          );
        }
      ).length,
    tenants:
      rows
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


function repairAllTenantLineBindings_() {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    lock.waitLock(
      25000
    );

    locked =
      true;

    const ss =
      runtimeSpreadsheet_();

    const index =
      tenantBindingBuildLineCandidateIndex_(
        ss
      );

    const tenantSheet =
      ss.getSheetByName(
        V2_TENANT_BINDING_SHEETS_
          .tenants
      );

    if (!tenantSheet) {
      return {
        success:
          false,
        code:
          'TENANT_SHEET_NOT_FOUND',
        message:
          '找不到 V2_tenants'
      };
    }

    const tenants =
      tenantBindingGetObjectsWithRow_(
        tenantSheet
      );

    const repaired = [];
    const unbound = [];
    const conflicts = [];

    tenants.forEach(
      function (tenant) {
        const tenantId =
          tenantBindingText_(
            tenant.tenant_id
          ).toUpperCase();

        const tenantUserId =
          tenantBindingText_(
            tenant.tenant_user_id ||
            tenant.user_id
          );

        const candidates =
          tenantBindingResolveLineCandidates_(
            index,
            tenantId,
            tenantUserId
          );

        const roomList =
          tenantBindingResolveTenantRoomList_(
            index,
            tenantId
          );

        if (
          candidates.length ===
          0
        ) {
          unbound.push({
            tenant_id:
              tenantId,
            tenant_name:
              tenantBindingText_(
                tenant.tenant_name ||
                tenant.name
              ),
            room_list:
              roomList
          });

          return;
        }

        if (
          candidates.length >
          1
        ) {
          conflicts.push({
            tenant_id:
              tenantId,
            tenant_name:
              tenantBindingText_(
                tenant.tenant_name ||
                tenant.name
              ),
            room_list:
              roomList,
            candidate_line_user_ids:
              candidates
          });

          return;
        }

        const lineUserId =
          candidates[0];

        const now =
          new Date();

        tenantBindingUpdateTenantRow_(
          tenantSheet,
          tenant.__row_number,
          lineUserId,
          now
        );

        tenantBindingUpdateUserRowIfPresent_(
          ss,
          tenant,
          lineUserId,
          now
        );

        const activeContract =
          tenantBindingResolveBestContractForTenant_(
            index,
            tenantId
          );

        tenantBindingSyncLineUidAcrossData_(
          ss,
          tenant,
          activeContract ||
          {},
          lineUserId,
          now
        );

        repaired.push({
          tenant_id:
            tenantId,
          tenant_name:
            tenantBindingText_(
              tenant.tenant_name ||
              tenant.name
            ),
          room_list:
            roomList,
          tenant_line_user_id:
            lineUserId
        });
      }
    );

    SpreadsheetApp.flush();

    const result = {
      success:
        conflicts.length ===
        0,
      code:
        conflicts.length ===
          0
          ? 'TENANT_BINDINGS_REPAIRED'
          : 'TENANT_BINDINGS_PARTIAL',
      message:
        conflicts.length ===
          0
          ? '房客 LINE 綁定資料已同步'
          : '部分房客存在多個 LINE UID，未自動覆蓋',
      repaired_count:
        repaired.length,
      unbound_count:
        unbound.length,
      conflict_count:
        conflicts.length,
      repaired:
        repaired,
      unbound:
        unbound,
      conflicts:
        conflicts
    };

    Logger.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


function tenantBindingBuildLineCandidateIndex_(
  ss
) {
  const sheetNames = [
    V2_TENANT_BINDING_SHEETS_
      .tenants,
    V2_TENANT_BINDING_SHEETS_
      .users,
    V2_TENANT_BINDING_SHEETS_
      .contracts,
    V2_TENANT_BINDING_SHEETS_
      .tenantHomeView,
    V2_TENANT_BINDING_SHEETS_
      .landlordTenantListView,
    'V2_tenant_bill_view',
    'V2_bills',
    'V2_payment_reports',
    'V2_tenant_messages'
  ];

  const index = {
    tenant_candidates:
      {},
    user_candidates:
      {},
    contracts_by_tenant:
      {},
    room_names_by_tenant:
      {}
  };

  sheetNames.forEach(
    function (sheetName) {
      const sheet =
        ss.getSheetByName(
          sheetName
        );

      if (
        !sheet ||
        sheet.getLastRow() <
        2
      ) {
        return;
      }

      const rows =
        tenantBindingGetObjectsWithRow_(
          sheet
        );

      rows.forEach(
        function (row) {
          const tenantId =
            tenantBindingText_(
              row.tenant_id
            ).toUpperCase();

          const tenantUserId =
            tenantBindingText_(
              row.tenant_user_id ||
              (
                sheetName ===
                  V2_TENANT_BINDING_SHEETS_
                    .users
                  ? row.user_id
                  : ''
              )
            );

          const contractId =
            tenantBindingText_(
              row.contract_id ||
              row.current_contract_id
            );

          const lineCandidates = [];

          function addLine(
            value
          ) {
            value =
              tenantBindingText_(
                value
              );

            if (
              tenantBindingLooksLikeLineUid_(
                value
              ) &&
              lineCandidates.indexOf(
                value
              ) <
              0
            ) {
              lineCandidates.push(
                value
              );
            }
          }

          if (
            sheetName ===
            V2_TENANT_BINDING_SHEETS_
              .landlordTenantListView
          ) {
            addLine(
              row.tenant_line_user_id
            );
          } else if (
            sheetName ===
              V2_TENANT_BINDING_SHEETS_
                .contracts ||
            sheetName ===
              'V2_bills' ||
            sheetName ===
              'V2_payment_reports' ||
            sheetName ===
              'V2_tenant_messages'
          ) {
            addLine(
              row.tenant_line_user_id
            );
          } else {
            addLine(
              row.tenant_line_user_id
            );
            addLine(
              row.line_user_id
            );
          }

          lineCandidates.forEach(
            function (lineUserId) {
              if (tenantId) {
                tenantBindingIndexAdd_(
                  index
                    .tenant_candidates,
                  tenantId,
                  lineUserId
                );
              }

              if (tenantUserId) {
                tenantBindingIndexAdd_(
                  index
                    .user_candidates,
                  tenantUserId,
                  lineUserId
                );
              }
            }
          );

          if (
            tenantId &&
            (
              sheetName ===
                V2_TENANT_BINDING_SHEETS_
                  .contracts ||
              contractId
            )
          ) {
            if (
              !index
                .contracts_by_tenant[
                  tenantId
                ]
            ) {
              index
                .contracts_by_tenant[
                  tenantId
                ] = [];
            }

            index
              .contracts_by_tenant[
                tenantId
              ].push(
                row
              );
          }

          if (tenantId) {
            const roomName =
              tenantBindingText_(
                row.room_name ||
                row.room_list
              );

            if (roomName) {
              tenantBindingIndexAdd_(
                index
                  .room_names_by_tenant,
                tenantId,
                roomName
              );
            }
          }
        }
      );
    }
  );

  return index;
}


function tenantBindingResolveLineCandidates_(
  index,
  tenantId,
  tenantUserId
) {
  const values = [];

  function addAll(
    list
  ) {
    (
      list ||
      []
    ).forEach(
      function (value) {
        if (
          values.indexOf(
            value
          ) <
          0
        ) {
          values.push(
            value
          );
        }
      }
    );
  }

  addAll(
    index
      .tenant_candidates[
        tenantId
      ]
  );

  addAll(
    index
      .user_candidates[
        tenantUserId
      ]
  );

  return values;
}


function tenantBindingResolveBestContractForTenant_(
  index,
  tenantId
) {
  const rows =
    (
      index
        .contracts_by_tenant[
          tenantId
        ] ||
      []
    ).slice();

  rows.sort(
    function (a, b) {
      return (
        tenantBindingContractTime_(
          b
        ) -
        tenantBindingContractTime_(
          a
        )
      );
    }
  );

  return rows.find(
    function (contract) {
      return tenantBindingContractLooksActive_(
        contract
      );
    }
  ) ||
  rows[0] ||
  null;
}


function tenantBindingResolveTenantRoomList_(
  index,
  tenantId
) {
  return (
    index
      .room_names_by_tenant[
        tenantId
      ] ||
    []
  )
    .slice()
    .sort(
      function (a, b) {
        return tenantBindingText_(
          a
        ).localeCompare(
          tenantBindingText_(
            b
          ),
          'zh-Hant',
          {
            numeric:
              true
          }
        );
      }
    )
    .join(
      '、'
    );
}


function tenantBindingContractLooksActive_(
  contract
) {
  const status =
    tenantBindingText_(
      contract.contract_status ||
      contract.status
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
    ) >=
    0
  ) {
    return false;
  }

  const now =
    new Date();

  now.setHours(
    0,
    0,
    0,
    0
  );

  const start =
    tenantBindingSafeDate_(
      contract.start_date ||
      contract.contract_start_date
    );

  const end =
    tenantBindingSafeDate_(
      contract.end_date ||
      contract.contract_end_date
    );

  if (
    start &&
    start.getTime() >
    now.getTime()
  ) {
    return false;
  }

  if (
    end &&
    end.getTime() <
    now.getTime()
  ) {
    return false;
  }

  return true;
}


function tenantBindingContractTime_(
  contract
) {
  const candidates = [
    contract.start_date,
    contract.contract_start_date,
    contract.updated_at,
    contract.created_at
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const date =
      tenantBindingSafeDate_(
        candidates[
          index
        ]
      );

    if (date) {
      return date.getTime();
    }
  }

  return 0;
}


function tenantBindingSafeDate_(
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
    return value;
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


function tenantBindingLooksLikeLineUid_(
  value
) {
  return /^U[a-zA-Z0-9_-]{20,}$/.test(
    tenantBindingText_(
      value
    )
  );
}


function tenantBindingIndexAdd_(
  map,
  key,
  value
) {
  if (
    !key ||
    !value
  ) {
    return;
  }

  if (!map[key]) {
    map[key] = [];
  }

  if (
    map[key].indexOf(
      value
    ) <
    0
  ) {
    map[key].push(
      value
    );
  }
}


function testDiagnoseAllTenantLineBindings() {
  return diagnoseAllTenantLineBindings_();
}


function testRepairAllTenantLineBindings() {
  return repairAllTenantLineBindings_();
}


/**
 * 測試函式。
 */
function testEnsureV2TenantBindingLogsSheet() {
  const sheet = tenantBindingEnsureLogSheet_();

  const result = {
    success: true,
    sheet_name: sheet.getName(),
    last_column: sheet.getLastColumn()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testTenantBindingStatus() {
  const result = getTenantBindingStatusByLineUid_(
    getRequiredScriptProperty_('TEST_TENANT_LINE_UID')
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testTenantBindingSchema() {
  const ss = runtimeSpreadsheet_();
  const result = {};

  [
    V2_TENANT_BINDING_SHEETS_.tenants,
    V2_TENANT_BINDING_SHEETS_.users,
    V2_TENANT_BINDING_SHEETS_.contracts,
    V2_TENANT_BINDING_SHEETS_.tenantHomeView
  ].forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);

    result[sheetName] = sheet
      ? {
          exists: true,
          rows: sheet.getLastRow(),
          columns: sheet.getLastColumn(),
          headers: sheet
            .getRange(
              1,
              1,
              1,
              Math.max(sheet.getLastColumn(), 1)
            )
            .getValues()[0]
        }
      : {
          exists: false
        };
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
