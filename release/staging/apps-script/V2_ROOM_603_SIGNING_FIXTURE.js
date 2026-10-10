// Controlled internal fixture for Room 603 native-contract-signing tests.
// It is deliberately not a Web App route and defaults to dry-run.

const V2_ROOM_603_FIXTURE_ = {
  workspace_id: 'W000001',
  property_id: 'PSTG086L',
  room_id: 'R000019',
  room_name: '603',
  tenant_id: 'T000020',
  contract_id: 'C000019',
  cancelled_bill_id: 'BILL-202607-C000019',
  previous_staging_tenant_id: 'TSTG082'
};

const V2_ROOM_603_FIXTURE_CONTRACT_HEADERS_ = [
  ['contract_id'], ['workspace_id'], ['tenant_id'], ['room_id'],
  ['room_name', 'room_no', 'room_number'], ['contract_status', 'status']
];

const V2_ROOM_603_FIXTURE_ROOM_HEADERS_ = [
  ['room_id'], ['workspace_id'], ['room_name', 'room_no', 'room_number'],
  ['room_status', 'status']
];

const V2_ROOM_603_FIXTURE_ARTIFACT_HEADERS_ = [
  ['workspace_id'], ['tenant_id'], ['contract_id'], ['status']
];

/** Read-only preflight. It never changes data, Drive, Properties, or LINE. */
function previewRoom603NewTenantSigningFixture() {
  return runRoom603SigningFixture_(false);
}

/** Read-only state check for the approved 603 fixture; it never changes data. */
function inspectRoom603SigningFixture() {
  const ss = runtimeSpreadsheet_();
  const setup = room603FixtureRead_(ss);
  if (!setup.success) return setup;
  const access = room603FixtureResolveAccessReadOnly_(ss);
  if (!access.success) return access;
  return room603FixtureResult_(true, 'OK', '603 測試租約狀態已讀取', {
    target: room603FixturePublicTarget_(),
    state: room603FixtureSafeSnapshot_(setup.data),
    stored_artifact_count: setup.data.stored_artifacts.length
  });
}

/** Explicitly opens only the approved 603 test fixture for new_tenant signing. */
function activateRoom603NewTenantSigningFixture() {
  return runRoom603SigningFixture_(true);
}

/** Explicitly returns only the approved fixture to its normal terminated state. */
function closeRoom603NewTenantSigningFixture() {
  return runRoom603SigningFixtureClose_(true);
}

/**
 * Explicitly moves the current existing staging test identity from TSTG082
 * to the approved 603 fixture. It never accepts a caller-provided UID.
 */
function rebindRoom603ToCurrentStagingIdentity() {
  const ss = runtimeSpreadsheet_();
  const access = room603FixtureResolveAccessReadOnly_(ss);
  if (!access.success) {
    room603FixtureRebindLog_(access);
    return access;
  }

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) {
      const busy = room603FixtureResult_(false, 'REQUEST_BUSY', '603 測試身份正在由其他操作使用');
      room603FixtureRebindLog_(busy);
      return busy;
    }

    const result = room603FixtureRebind_(ss);
    room603FixtureAudit_(access.data.access, 'rebind', result.success ? 'success' : 'failed', {
      source_tenant_id: V2_ROOM_603_FIXTURE_.previous_staging_tenant_id,
      target: room603FixturePublicTarget_(),
      changed_rows: result.data && result.data.changed_rows || 0,
      code: result.code
    });
    room603FixtureRebindLog_(result);
    return result;
  } catch (error) {
    const failed = room603FixtureResult_(false, 'FIXTURE_REBIND_FAILED', '603 測試身份未完成切換；請查看操作稽核後再重試');
    room603FixtureAudit_(access.data.access, 'rebind', 'failed', { code: failed.code });
    room603FixtureRebindLog_(failed);
    return failed;
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/**
 * One-time staging setup for the approved Room 603 test tenant.
 *
 * The seed is deliberately separate from the open/close switch: it creates
 * only missing canonical rows and always leaves the fixture closed.
 */
function seedRoom603TestTenantFixture() {
  const ss = runtimeSpreadsheet_();
  const access = room603FixtureResolveAccessReadOnly_(ss);
  if (!access.success) {
    room603FixtureSeedLog_(access);
    return access;
  }

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) {
      const busy = room603FixtureResult_(false, 'REQUEST_BUSY', '603 測試資料正在由其他操作使用');
      room603FixtureSeedLog_(busy);
      return busy;
    }

    const plan = room603FixtureSeedPlan_(ss);
    if (!plan.success) {
      room603FixtureSeedLog_(plan);
      return plan;
    }

    if (plan.operations.length === 0) {
      const unchanged = room603FixtureResult_(true, 'UNCHANGED', '603 測試房客基準資料已存在，未寫入', {
        created_rows: 0,
        state: room603FixtureSeedPublicState_(plan.data)
      });
      room603FixtureSeedAudit_(access.data.access, 'success', unchanged.code, 0);
      room603FixtureSeedLog_(unchanged);
      return unchanged;
    }

    plan.operations.forEach(function (operation) {
      room603FixtureAppendFields_(operation.sheet, operation.values);
    });
    SpreadsheetApp.flush();

    const verification = room603FixtureSeedRead_(ss);
    if (!verification.success) {
      room603FixtureSeedAudit_(access.data.access, 'failed', verification.code, plan.operations.length);
      return room603FixtureResult_(false, 'FIXTURE_SEED_VERIFY_FAILED', '603 測試資料寫入後驗證失敗', {
        created_rows: plan.operations.length,
        verification_code: verification.code
      });
    }

    const state = room603FixtureSeedPublicState_(verification.data);
    if (state.contract_status !== 'terminated' || state.room_status !== 'vacant' || state.bill_status !== 'cancelled') {
      room603FixtureSeedAudit_(access.data.access, 'failed', 'FIXTURE_SEED_STATE_INVALID', plan.operations.length);
      return room603FixtureResult_(false, 'FIXTURE_SEED_STATE_INVALID', '603 測試資料未停留在關閉基準狀態', {
        created_rows: plan.operations.length,
        state: state
      });
    }

    const seeded = room603FixtureResult_(true, 'SEEDED', '603 測試房客基準資料已建立，維持關閉狀態', {
      created_rows: plan.operations.length,
      state: state
    });
    room603FixtureSeedAudit_(access.data.access, 'success', seeded.code, plan.operations.length);
    room603FixtureSeedLog_(seeded);
    return seeded;
  } catch (error) {
    room603FixtureSeedAudit_(access.data.access, 'failed', 'FIXTURE_SEED_WRITE_FAILED', 0);
    const failed = room603FixtureResult_(false, 'FIXTURE_SEED_WRITE_FAILED', '603 測試房客基準資料建立失敗，請查看操作稽核後再處理');
    room603FixtureSeedLog_(failed);
    return failed;
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function room603FixtureSeedLog_(result) {
  try {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log('[ROOM603_SEED] ' + JSON.stringify({
        success: result && result.success === true,
        code: result && result.code || '',
        created_rows: result && result.data && result.data.created_rows || 0
      }));
    }
  } catch (_) {}
}

function runRoom603SigningFixture_(execute) {
  return room603FixtureRun_(execute === true, 'open');
}

function runRoom603SigningFixtureClose_(execute) {
  return room603FixtureRun_(execute === true, 'close');
}

function room603FixtureRun_(execute, mode) {
  const ss = runtimeSpreadsheet_();
  const setup = room603FixtureRead_(ss);
  if (!setup.success) return setup;

  const access = room603FixtureResolveAccessReadOnly_(ss);
  if (!access.success) return access;

  const checks = room603FixtureChecks_(setup.data, mode);
  if (Object.keys(checks).some(function (key) { return checks[key] !== true; })) {
    const failed = room603FixtureResult_(false, 'FIXTURE_GUARD_FAILED', '603 測試租約不符合受控切換條件', {
      dry_run: true, mode: mode, checks: checks
    });
    room603FixtureSwitchLog_(failed, mode);
    return failed;
  }

  const legacySchema = !room603FixtureSupportsSigningSchema_(setup.data);
  const result = room603FixtureResult_(true, execute ? 'READY_TO_EXECUTE' : 'DRY_RUN_OK', execute
    ? (legacySchema ? '603 測試房客已開啟為 active 測試狀態' : '603 測試租約已開啟為 new_tenant 簽署狀態')
    : '603 測試租約 preflight 通過，尚未寫入', {
    dry_run: !execute,
    mode: mode,
    target: room603FixturePublicTarget_(),
    compatibility_mode: legacySchema ? 'legacy_staging_status' : 'native_signing_fields',
    stored_artifact_count: setup.data.stored_artifacts.length
  });
  if (!execute) {
    room603FixtureSwitchLog_(result, mode);
    return result;
  }

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) {
      const busy = room603FixtureResult_(false, 'REQUEST_BUSY', '603 測試工具正在由其他操作使用');
      room603FixtureSwitchLog_(busy, mode);
      return busy;
    }
    const locked = room603FixtureRead_(ss);
    if (!locked.success) {
      room603FixtureSwitchLog_(locked, mode);
      return locked;
    }
    const lockedChecks = room603FixtureChecks_(locked.data, mode);
    if (Object.keys(lockedChecks).some(function (key) { return lockedChecks[key] !== true; })) {
      const changed = room603FixtureResult_(false, 'FIXTURE_GUARD_CHANGED', '取得鎖定後 603 測試資料已變更，未寫入', { dry_run: true, mode: mode, checks: lockedChecks });
      room603FixtureSwitchLog_(changed, mode);
      return changed;
    }
    const now = new Date().toISOString();
    room603FixtureWrite_(locked.data, mode, now);
    SpreadsheetApp.flush();
    room603FixtureAudit_(access.data.access, mode, 'success', {
      target: room603FixturePublicTarget_(),
      stored_artifact_count: locked.data.stored_artifacts.length,
      before: room603FixtureSafeSnapshot_(locked.data)
    });
    room603FixtureSwitchLog_(result, mode);
    return result;
  } catch (error) {
    room603FixtureAudit_(access.data.access, mode, 'failed', { code: 'FIXTURE_WRITE_FAILED' });
    const failed = room603FixtureResult_(false, 'FIXTURE_WRITE_FAILED', '603 測試租約未完成切換；請查看操作稽核後再重試');
    room603FixtureSwitchLog_(failed, mode);
    return failed;
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function room603FixtureSeedPlan_(ss) {
  const snapshot = room603FixtureSeedRead_(ss);
  if (!snapshot.success) return snapshot;

  const data = snapshot.data;
  if (!data.property) {
    return room603FixtureResult_(false, 'FIXTURE_TARGET_CONFLICT', '603 測試資料缺少同一 Workspace 的既有物件，拒絕寫入');
  }
  const operations = [];
  const values = room603FixtureSeedValues_();

  if (!data.user) operations.push({ name: 'V2_users', sheet: data.sheets.V2_users, values: values.user });
  if (!data.tenant) operations.push({ name: 'V2_tenants', sheet: data.sheets.V2_tenants, values: values.tenant });
  if (!data.room) operations.push({ name: 'V2_rooms', sheet: data.sheets.V2_rooms, values: values.room });
  if (!data.contract) operations.push({ name: 'V2_contracts', sheet: data.sheets.V2_contracts, values: values.contract });
  if (!data.bill) operations.push({ name: 'V2_bills', sheet: data.sheets.V2_bills, values: values.bill });
  if (data.sheets.V2_contract_artifacts && data.artifacts.length === 0) operations.push({ name: 'V2_contract_artifacts', sheet: data.sheets.V2_contract_artifacts, values: values.artifact });

  return { success: true, data: data, operations: operations };
}

function room603FixtureSeedRead_(ss) {
  const names = ['V2_users', 'V2_tenants', 'V2_properties', 'V2_rooms', 'V2_contracts', 'V2_bills', 'V2_contract_artifacts'];
  const sheets = {};
  const rows = {};
  const required = {
    V2_users: [['user_id'], ['role'], ['account_status']],
    V2_tenants: [['tenant_id'], ['tenant_user_id', 'user_id'], ['workspace_id'], ['account_status', 'tenant_account_status']],
    V2_properties: [['property_id'], ['workspace_id'], ['status']],
    V2_rooms: [['room_id'], ['workspace_id'], ['room_name', 'room_no', 'room_number'], ['room_status', 'status']],
    V2_contracts: [['contract_id'], ['workspace_id'], ['tenant_id'], ['room_id'], ['room_name', 'room_no', 'room_number'], ['contract_status', 'status']],
    V2_bills: [['bill_id'], ['bill_status']],
    V2_contract_artifacts: [['workspace_id'], ['tenant_id'], ['contract_id'], ['status']]
  };

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    sheets[name] = ss.getSheetByName(name);
    if (!sheets[name] && name !== 'V2_contract_artifacts') return room603FixtureResult_(false, 'FIXTURE_SCHEMA_NOT_READY', '缺少 ' + name + '，拒絕建立 603 測試資料');
    if (!sheets[name]) {
      rows[name] = [];
      continue;
    }
    const headers = room603FixtureHeaders_(sheets[name]);
    const missing = required[name].filter(function (aliases) {
      return room603FixtureHeaderIndex_(headers, aliases) < 0;
    });
    if (missing.length > 0) return room603FixtureResult_(false, 'FIXTURE_SCHEMA_NOT_READY', name + ' 缺少 603 seed 所需欄位');
    rows[name] = room603FixtureRows_(sheets[name]);
  }

  const target = V2_ROOM_603_FIXTURE_;
  const users = rows.V2_users.filter(function (row) { return room603FixtureSeedField_(row, ['user_id']) === 'U000022'; });
  const tenants = rows.V2_tenants.filter(function (row) { return room603FixtureSeedField_(row, ['tenant_id']) === target.tenant_id; });
  const properties = rows.V2_properties.filter(function (row) { return room603FixtureSeedField_(row, ['property_id']) === target.property_id; });
  const rooms = rows.V2_rooms.filter(function (row) { return room603FixtureSeedField_(row, ['room_id']) === target.room_id; });
  const contracts = rows.V2_contracts.filter(function (row) { return room603FixtureSeedField_(row, ['contract_id']) === target.contract_id; });
  const bills = rows.V2_bills.filter(function (row) { return room603FixtureSeedField_(row, ['bill_id']) === target.cancelled_bill_id; });
  const artifacts = rows.V2_contract_artifacts.filter(function (row) {
    return room603FixtureSeedField_(row, ['workspace_id']) === target.workspace_id &&
      room603FixtureSeedField_(row, ['tenant_id']) === target.tenant_id &&
      room603FixtureSeedField_(row, ['contract_id']) === target.contract_id;
  });

  const duplicate = users.length > 1 || tenants.length > 1 || properties.length > 1 || rooms.length > 1 || contracts.length > 1 || bills.length > 1;
  if (duplicate) return room603FixtureResult_(false, 'FIXTURE_TARGET_CONFLICT', '603 測試資料已有重複 target row，拒絕寫入');

  const conflicts = [];
  if (properties.length !== 1) conflicts.push('property.missing');
  if (properties.length === 1 && room603FixtureSeedField_(properties[0], ['workspace_id']) !== target.workspace_id) conflicts.push('property.workspace_id');
  if (properties.length === 1 && !room603FixtureActive_(room603FixtureSeedField_(properties[0], ['status', 'account_status']))) conflicts.push('property.status');
  if (users.length === 1 && room603FixtureSeedField_(users[0], ['role']).toLowerCase() !== 'tenant') conflicts.push('user.role');
  if (users.length === 1 && !room603FixtureActive_(room603FixtureSeedField_(users[0], ['account_status', 'status']))) conflicts.push('user.account_status');
  if (tenants.length === 1 && room603FixtureSeedField_(tenants[0], ['workspace_id']) !== target.workspace_id) conflicts.push('tenant.workspace_id');
  if (tenants.length === 1 && room603FixtureSeedField_(tenants[0], ['tenant_user_id', 'user_id']) !== 'U000022') conflicts.push('tenant.user_id');
  if (tenants.length === 1 && !room603FixtureSeedFieldMatchesIfPresent_(tenants[0], ['property_id'], target.property_id)) conflicts.push('tenant.property_id');
  if (rooms.length === 1 && room603FixtureSeedField_(rooms[0], ['workspace_id']) !== target.workspace_id) conflicts.push('room.workspace_id');
  if (rooms.length === 1 && room603FixtureSeedField_(rooms[0], ['room_name', 'room_no', 'room_number']) !== target.room_name) conflicts.push('room.room_name');
  if (rooms.length === 1 && !room603FixtureSeedFieldMatchesIfPresent_(rooms[0], ['property_id'], target.property_id)) conflicts.push('room.property_id');
  if (contracts.length === 1) {
    if (room603FixtureSeedField_(contracts[0], ['workspace_id']) !== target.workspace_id) conflicts.push('contract.workspace_id');
    if (room603FixtureSeedField_(contracts[0], ['tenant_id']) !== target.tenant_id) conflicts.push('contract.tenant_id');
    if (room603FixtureSeedField_(contracts[0], ['room_id']) !== target.room_id) conflicts.push('contract.room_id');
    if (room603FixtureSeedField_(contracts[0], ['room_name', 'room_no', 'room_number']) !== target.room_name) conflicts.push('contract.room_name');
    if (!room603FixtureSeedFieldMatchesIfPresent_(contracts[0], ['property_id'], target.property_id)) conflicts.push('contract.property_id');
    if (room603FixtureSeedField_(contracts[0], ['contract_status']).toLowerCase() !== 'terminated') conflicts.push('contract.open_state');
  }
  if (bills.length === 1 && !room603FixtureSeedFieldMatchesIfPresent_(bills[0], ['property_id'], target.property_id)) conflicts.push('bill.property_id');
  if (rooms.length === 1 && room603FixtureSeedField_(rooms[0], ['room_status', 'status']).toLowerCase() !== 'vacant') conflicts.push('room.open_state');
  if (bills.length === 1 && room603FixtureSeedField_(bills[0], ['bill_status']).toLowerCase() !== 'cancelled') conflicts.push('bill.bill_status');
  if (conflicts.length > 0) return room603FixtureResult_(false, 'FIXTURE_TARGET_CONFLICT', '603 測試資料存在關聯衝突，拒絕覆寫', { fields: conflicts });

  return {
    success: true,
    data: {
      sheets: sheets,
      user: users[0] || null,
      tenant: tenants[0] || null,
      property: properties[0] || null,
      room: rooms[0] || null,
      contract: contracts[0] || null,
      bill: bills[0] || null,
      artifacts: artifacts
    }
  };
}

function room603FixtureSeedValues_() {
  const tenantLineUserId = room603FixtureOptionalScriptProperty_('TEST_TENANT_LINE_UID');
  const now = new Date().toISOString();
  const displayName = '603 測試房客';
  return {
    user: {
      user_id: 'U000022', line_user_id: tenantLineUserId, tenant_line_user_id: tenantLineUserId,
      role: 'tenant', status: 'active', account_status: 'active', display_name: displayName,
      full_name: displayName, name: displayName, note: 'CMWebs staging Room 603 test fixture'
    },
    tenant: {
      tenant_id: 'T000020', tenant_user_id: 'U000022', user_id: 'U000022', workspace_id: 'W000001',
      landlord_id: 'L000001', property_id: 'PSTG086L', room_id: 'R000019', room_name: '603',
      tenant_line_user_id: tenantLineUserId, line_user_id: tenantLineUserId, tenant_name: displayName,
      display_name: displayName, name: displayName, status: 'active', account_status: 'active',
      note: 'CMWebs staging Room 603 test fixture'
    },
    room: {
      room_id: 'R000019', workspace_id: 'W000001', landlord_id: 'L000001', property_id: 'PSTG086L',
      room_name: '603', room_no: '603', room_number: '603', status: 'vacant', room_status: 'vacant',
      account_status: 'active', monthly_rent: 10000, rent_amount: 10000, deposit_amount: 20000,
      note: 'CMWebs staging Room 603 test fixture'
    },
    contract: {
      contract_id: 'C000019', workspace_id: 'W000001', landlord_id: 'L000001', tenant_id: 'T000020',
      tenant_user_id: 'U000022', property_id: 'PSTG086L', room_id: 'R000019', room_name: '603',
      room_no: '603', contract_status: 'terminated', status: 'terminated', signing_mode: '',
      tenant_signed_at: '', tenant_signature_artifact_id: '', tenant_signing_submission_status: '',
      tenant_signing_submitted_at: '', monthly_rent: 10000, rent_amount: 10000, deposit_amount: 20000,
      start_date: '2026-08-01', end_date: '2027-07-31', updated_at: now,
      note: 'CMWebs staging Room 603 test fixture'
    },
    bill: {
      bill_id: 'BILL-202607-C000019', workspace_id: 'W000001', landlord_id: 'L000001',
      tenant_id: 'T000020', contract_id: 'C000019', property_id: 'PSTG086L', room_id: 'R000019',
      room_name: '603', bill_month: '2026-07', bill_status: 'cancelled', payment_status: 'cancelled',
      amount: 10000, bill_amount: 10000, total_amount: 10000, note: 'Historical cancelled staging fixture bill'
    },
    artifact: {
      artifact_id: 'ARTIFACT-C000019-BASELINE', workspace_id: 'W000001', tenant_id: 'T000020',
      contract_id: 'C000019', artifact_type: 'contract_pdf', status: 'stored',
      note: 'CMWebs staging Room 603 test fixture'
    }
  };
}

function room603FixtureSeedPublicState_(data) {
  return {
    contract_status: data.contract ? room603FixtureSeedField_(data.contract, ['contract_status']) : '',
    room_status: data.room ? room603FixtureSeedField_(data.room, ['room_status', 'status']) : '',
    bill_status: data.bill ? room603FixtureSeedField_(data.bill, ['bill_status']) : ''
  };
}

function room603FixtureSeedAudit_(access, result, code, createdRows) {
  try {
    workspaceRecordOperationActor_(access, 'room603_signing_fixture_seed', {
      success: result === 'success', code: code, message: '603 測試房客 seed 操作'
    }, {
      target_type: 'room603_signing_fixture', target_id: V2_ROOM_603_FIXTURE_.contract_id,
      secondary_target_id: V2_ROOM_603_FIXTURE_.room_id,
      detail: JSON.stringify({ code: code, created_rows: createdRows })
    });
  } catch (_) {}
}

function room603FixtureAppendFields_(sheet, values) {
  const headers = room603FixtureHeaders_(sheet);
  const row = headers.map(function () { return ''; });
  Object.keys(values).forEach(function (name) {
    const index = room603FixtureHeaderIndex_(headers, [name]);
    if (index >= 0) row[index] = values[name];
  });
  sheet.appendRow(row);
}

function room603FixtureHeaderIndex_(headers, aliases) {
  const normalized = headers.map(function (header) { return room603FixtureText_(header).toLowerCase(); });
  for (let i = 0; i < aliases.length; i++) {
    const index = normalized.indexOf(room603FixtureText_(aliases[i]).toLowerCase());
    if (index >= 0) return index;
  }
  return -1;
}

function room603FixtureSeedField_(row, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    if (Object.prototype.hasOwnProperty.call(row, aliases[i]) && room603FixtureText_(row[aliases[i]]) !== '') return room603FixtureText_(row[aliases[i]]);
  }
  for (let i = 0; i < aliases.length; i++) {
    if (Object.prototype.hasOwnProperty.call(row, aliases[i])) return room603FixtureText_(row[aliases[i]]);
  }
  return '';
}

function room603FixtureSeedFieldMatchesIfPresent_(row, aliases, expected) {
  for (let i = 0; i < aliases.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(row, aliases[i])) continue;
    if (room603FixtureText_(row[aliases[i]]) !== expected) return false;
  }
  return true;
}

function room603FixtureOptionalScriptProperty_(name) {
  try {
    if (typeof PropertiesService !== 'undefined') {
      return room603FixtureText_(PropertiesService.getScriptProperties().getProperty(name));
    }
  } catch (_) {}
  return '';
}

/**
 * Resolve the existing owner/admin actor without creating legacy records or
 * repairing Workspace schema. The preview route remains genuinely read-only.
 */
function room603FixtureResolveAccessReadOnly_(ss) {
  let lineUserId = room603FixtureOptionalScriptProperty_('TEST_LANDLORD_LINE_UID');
  const workspaceId = V2_ROOM_603_FIXTURE_.workspace_id;
  const usersSheet = ss.getSheetByName('V2_users');
  const workspacesSheet = ss.getSheetByName('V2_workspaces');
  const membersSheet = ss.getSheetByName('V2_workspace_members');

  if (!usersSheet || !workspacesSheet || !membersSheet) {
    return room603FixtureResult_(
      false,
      'FIXTURE_AUTHORIZATION_SCHEMA_MISSING',
      '603 測試工具缺少既有 Workspace authorization 資料，拒絕切換'
    );
  }

  const users = room603FixtureRows_(usersSheet);
  const workspaces = room603FixtureRows_(workspacesSheet);
  const members = room603FixtureRows_(membersSheet);
  const workspaceMatches = workspaces.filter(function (workspace) {
    return room603FixtureText_(workspace.workspace_id).toUpperCase() ===
      workspaceId;
  });

  if (workspaceMatches.length !== 1) {
    return room603FixtureResult_(
      false,
      'FIXTURE_ACTOR_OR_WORKSPACE_AMBIGUOUS',
      '603 測試工具找不到唯一既有 owner/admin actor 或 Workspace'
    );
  }

  const workspace = workspaceMatches[0];
  if (!lineUserId) {
    const ownerAdminMemberships = members.filter(function (membership) {
      const role = room603FixtureText_(membership.role).toLowerCase();
      return (
        room603FixtureText_(membership.workspace_id).toUpperCase() === workspaceId &&
        ['owner', 'admin'].indexOf(role) >= 0 &&
        room603FixtureActive_(membership.member_status || membership.status)
      );
    });
    if (ownerAdminMemberships.length !== 1) {
      return room603FixtureResult_(
        false,
        ownerAdminMemberships.length ? 'FIXTURE_ACTOR_AMBIGUOUS' : 'FIXTURE_OWNER_ADMIN_NOT_FOUND',
        '603 測試工具需要唯一既有的 active owner/admin membership'
      );
    }
    const derivedMembership = ownerAdminMemberships[0];
    const derivedUsers = users.filter(function (user) {
      return room603FixtureText_(user.user_id) === room603FixtureText_(derivedMembership.user_id);
    });
    if (derivedUsers.length !== 1) {
      return room603FixtureResult_(
        false,
        'FIXTURE_ACTOR_AMBIGUOUS',
        '603 測試工具找不到 owner/admin membership 對應的唯一使用者'
      );
    }
    lineUserId = room603FixtureText_(
      derivedMembership.line_user_id || derivedMembership.line_uid ||
      derivedUsers[0].line_user_id || derivedUsers[0].line_uid
    );
    if (!lineUserId) {
      return room603FixtureResult_(
        false,
        'FIXTURE_OWNER_LINE_IDENTITY_MISSING',
        '603 測試工具的既有 owner/admin 缺少 LINE identity'
      );
    }
  }

  const userMatches = users.filter(function (user) {
    return room603FixtureText_(user.line_user_id || user.line_uid) === lineUserId;
  });
  if (userMatches.length !== 1) {
    return room603FixtureResult_(
      false,
      'FIXTURE_ACTOR_OR_WORKSPACE_AMBIGUOUS',
      '603 測試工具找不到唯一既有 owner/admin actor 或 Workspace'
    );
  }

  const user = userMatches[0];
  const memberships = members.filter(function (membership) {
    const role = room603FixtureText_(membership.role).toLowerCase();
    const memberLineUserId = room603FixtureText_(membership.line_user_id || membership.line_uid);
    return (
      room603FixtureText_(membership.workspace_id).toUpperCase() ===
        workspaceId &&
      room603FixtureText_(membership.user_id) ===
        room603FixtureText_(user.user_id) &&
      ['owner', 'admin'].indexOf(role) >= 0 &&
      room603FixtureActive_(membership.member_status || membership.status) &&
      (!memberLineUserId || memberLineUserId === lineUserId)
    );
  });

  if (memberships.length !== 1) {
    return room603FixtureResult_(
      false,
      memberships.length
        ? 'FIXTURE_ACTOR_AMBIGUOUS'
        : 'FIXTURE_OWNER_ADMIN_NOT_FOUND',
      '603 測試工具需要唯一既有的 active owner/admin membership'
    );
  }

  // This internal staging fixture requires an active Workspace and an active
  // owner/admin membership, but does not require the product onboarding gate.
  // The gate controls normal product access; this function is an explicitly
  // owner-run test-data switch and never exposes a normal user route.
  if (
    !room603FixtureActive_(user.account_status) ||
    !room603FixtureActive_(workspace.account_status)
  ) {
    return room603FixtureResult_(
      false,
      'FIXTURE_ACTOR_OR_WORKSPACE_INACTIVE',
      '603 測試工具的既有 actor 或 Workspace 目前不可用'
    );
  }

  return room603FixtureResult_(
    true,
    'READ_ONLY_AUTHORIZED',
    '已解析唯一既有 owner/admin actor；未建立或修復任何身份',
    {
      access: {
        success: true,
        line_user_id: lineUserId,
        user: user,
        workspace: workspace,
        membership: memberships[0],
        permissions: {},
        principals: [],
        principal: null,
        delegated: false,
        read_only_resolution: true
      }
    }
  );
}

function room603FixtureRead_(ss) {
  const names = ['V2_contracts', 'V2_rooms', 'V2_tenants', 'V2_users', 'V2_bills', 'V2_contract_artifacts'];
  const sheets = {};
  for (let i = 0; i < names.length; i++) {
    sheets[names[i]] = ss.getSheetByName(names[i]);
    if (!sheets[names[i]] && names[i] !== 'V2_contract_artifacts') return room603FixtureResult_(false, 'FIXTURE_SCHEMA_NOT_READY', '缺少 ' + names[i] + '，拒絕切換');
  }
  const rows = {};
  Object.keys(sheets).forEach(function (name) { rows[name] = sheets[name] ? room603FixtureRows_(sheets[name]) : []; });
  if (!room603FixtureHasHeaders_(sheets.V2_contracts, V2_ROOM_603_FIXTURE_CONTRACT_HEADERS_) ||
      !room603FixtureHasHeaders_(sheets.V2_rooms, V2_ROOM_603_FIXTURE_ROOM_HEADERS_) ||
      (sheets.V2_contract_artifacts && !room603FixtureHasHeaders_(sheets.V2_contract_artifacts, V2_ROOM_603_FIXTURE_ARTIFACT_HEADERS_))) {
    return room603FixtureResult_(false, 'FIXTURE_SCHEMA_NOT_READY', '603 受控切換所需簽署欄位未就緒');
  }
  const target = V2_ROOM_603_FIXTURE_;
  const contracts = rows.V2_contracts.filter(function (row) { return room603FixtureText_(row.contract_id) === target.contract_id; });
  const rooms = rows.V2_rooms.filter(function (row) { return room603FixtureText_(row.room_id) === target.room_id; });
  const tenants = rows.V2_tenants.filter(function (row) { return room603FixtureText_(row.tenant_id) === target.tenant_id; });
  const bills = rows.V2_bills.filter(function (row) { return room603FixtureText_(row.bill_id) === target.cancelled_bill_id; });
  if (contracts.length !== 1 || rooms.length !== 1 || tenants.length !== 1 || bills.length !== 1) {
    return room603FixtureResult_(false, 'FIXTURE_TARGET_AMBIGUOUS', '603 目標租約、房間、房客或歷史帳單不是唯一記錄');
  }
  const tenant = tenants[0];
  const users = rows.V2_users.filter(function (row) {
    return room603FixtureText_(row.user_id) === room603FixtureText_(tenant.tenant_user_id || tenant.user_id);
  });
  if (users.length !== 1) return room603FixtureResult_(false, 'FIXTURE_TENANT_USER_AMBIGUOUS', '603 測試房客沒有唯一既有使用者記錄');
  const stored = rows.V2_contract_artifacts.filter(function (row) {
    return room603FixtureText_(row.workspace_id) === target.workspace_id && room603FixtureText_(row.tenant_id) === target.tenant_id && room603FixtureText_(row.contract_id) === target.contract_id && room603FixtureText_(row.status).toLowerCase() === 'stored';
  });
  return { success: true, data: { sheets: sheets, contracts: rows.V2_contracts, contract: contracts[0], room: rooms[0], tenant: tenant, user: users[0], bill: bills[0], stored_artifacts: stored } };
}

function room603FixtureRebind_(ss) {
  const setup = room603FixtureRead_(ss);
  if (!setup.success) return setup;

  const tenantSheet = ss.getSheetByName('V2_tenants');
  const userSheet = ss.getSheetByName('V2_users');
  if (!tenantSheet || !userSheet) return room603FixtureResult_(false, 'FIXTURE_REBIND_SCHEMA_MISSING', '603 測試身份切換缺少房客或使用者資料');

  const tenantRows = room603FixtureRows_(tenantSheet);
  const userRows = room603FixtureRows_(userSheet);
  const sourceTenants = tenantRows.filter(function (row) {
    return room603FixtureText_(row.tenant_id).toUpperCase() === V2_ROOM_603_FIXTURE_.previous_staging_tenant_id;
  });
  if (sourceTenants.length !== 1) return room603FixtureResult_(false, 'FIXTURE_SOURCE_TENANT_AMBIGUOUS', '找不到唯一既有 staging 測試房客，拒絕改綁');

  const sourceTenant = sourceTenants[0];
  const sourceUserId = room603FixtureText_(sourceTenant.tenant_user_id || sourceTenant.user_id);
  const sourceUsers = userRows.filter(function (row) { return room603FixtureText_(row.user_id) === sourceUserId; });
  if (sourceUsers.length !== 1) return room603FixtureResult_(false, 'FIXTURE_SOURCE_USER_AMBIGUOUS', '找不到既有 staging 測試房客的唯一使用者，拒絕改綁');

  const sourceLineUserId = room603FixtureText_(
    sourceTenant.tenant_line_user_id || sourceTenant.line_user_id ||
    sourceUsers[0].line_user_id || sourceUsers[0].tenant_line_user_id
  );
  if (!sourceLineUserId) return room603FixtureResult_(false, 'FIXTURE_SOURCE_IDENTITY_MISSING', '既有 staging 測試房客沒有可移轉的 LINE identity');

  const targetTenantId = V2_ROOM_603_FIXTURE_.tenant_id;
  const targetUserId = room603FixtureText_(setup.data.tenant.tenant_user_id || setup.data.tenant.user_id);
  if (targetUserId !== 'U000022') return room603FixtureResult_(false, 'FIXTURE_TARGET_CONFLICT', '603 目標房客使用者不是核准的 U000022，拒絕改綁');
  const targetContractStatus = room603FixtureText_(setup.data.contract.contract_status || setup.data.contract.status).toLowerCase();
  if (targetContractStatus !== 'active') return room603FixtureResult_(false, 'FIXTURE_TARGET_NOT_OPEN', '603 尚未處於可供前端測試的 active 狀態');
  if (!room603FixtureHasAnyHeaders_(tenantSheet, ['tenant_line_user_id', 'line_user_id']) || !room603FixtureHasAnyHeaders_(userSheet, ['line_user_id', 'tenant_line_user_id'])) {
    return room603FixtureResult_(false, 'FIXTURE_REBIND_SCHEMA_MISSING', '603 測試身份切換缺少 LINE identity 欄位');
  }

  const now = new Date().toISOString();
  let changedRows = 0;
  changedRows += room603FixtureApplyBindingState_(tenantSheet, sourceTenant._sheet_row, '', 'unbound', now);
  changedRows += room603FixtureApplyBindingState_(tenantSheet, setup.data.tenant._sheet_row, sourceLineUserId, 'bound', now);
  changedRows += room603FixtureApplyBindingState_(userSheet, sourceUsers[0]._sheet_row, '', 'unbound', now);
  const targetUser = userRows.find(function (row) { return room603FixtureText_(row.user_id) === targetUserId; });
  if (!targetUser) return room603FixtureResult_(false, 'FIXTURE_TARGET_USER_MISSING', '603 測試房客使用者不存在，拒絕改綁');
  changedRows += room603FixtureApplyBindingState_(userSheet, targetUser._sheet_row, sourceLineUserId, 'bound', now);

  const configs = [
    { name: 'V2_tenant_home_view', line: ['line_user_id', 'tenant_line_user_id'], binding: true },
    { name: 'V2_tenant_bill_view', line: ['line_user_id', 'tenant_line_user_id'], binding: false },
    { name: 'V2_landlord_tenant_list_view', line: ['tenant_line_user_id'], binding: true },
    { name: 'V2_contracts', line: ['tenant_line_user_id'], binding: false },
    { name: 'V2_bills', line: ['tenant_line_user_id'], binding: false },
    { name: 'V2_payment_reports', line: ['tenant_line_user_id'], binding: false },
    { name: 'V2_tenant_messages', line: ['tenant_line_user_id'], binding: false }
  ];
  configs.forEach(function (config) {
    const sheet = ss.getSheetByName(config.name);
    if (!sheet || sheet.getLastRow() < 2) return;
    room603FixtureRows_(sheet).forEach(function (row) {
      const rowTenantId = room603FixtureText_(row.tenant_id).toUpperCase();
      const rowUserId = room603FixtureText_(row.tenant_user_id || row.user_id);
      const rowContractId = room603FixtureText_(row.contract_id || row.current_contract_id);
      const sourceMatch = rowTenantId === V2_ROOM_603_FIXTURE_.previous_staging_tenant_id || rowUserId === sourceUserId;
      const targetMatch = rowTenantId === targetTenantId || rowUserId === targetUserId || rowContractId === V2_ROOM_603_FIXTURE_.contract_id;
      if (sourceMatch) {
        changedRows += room603FixtureApplyLinkedBindingState_(sheet, row._sheet_row, config.line, '', config.binding ? 'unbound' : '', now);
      } else if (targetMatch) {
        changedRows += room603FixtureApplyLinkedBindingState_(sheet, row._sheet_row, config.line, sourceLineUserId, config.binding ? 'bound' : '', now);
      }
    });
  });

  SpreadsheetApp.flush();
  const verifiedTenants = room603FixtureRows_(tenantSheet);
  const verifiedSource = verifiedTenants.find(function (row) { return room603FixtureText_(row.tenant_id).toUpperCase() === V2_ROOM_603_FIXTURE_.previous_staging_tenant_id; });
  const verifiedTarget = verifiedTenants.find(function (row) { return room603FixtureText_(row.tenant_id).toUpperCase() === targetTenantId; });
  if (room603FixtureText_(verifiedSource.tenant_line_user_id || verifiedSource.line_user_id) !== '' || room603FixtureText_(verifiedTarget.tenant_line_user_id || verifiedTarget.line_user_id) !== sourceLineUserId) {
    return room603FixtureResult_(false, 'FIXTURE_REBIND_VERIFY_FAILED', '603 測試身份切換後驗證失敗，請勿繼續前端測試');
  }
  return room603FixtureResult_(true, 'REBIND_COMPLETE', '目前 staging 測試身份已改綁 603', {
    target: room603FixturePublicTarget_(),
    source_tenant_id: V2_ROOM_603_FIXTURE_.previous_staging_tenant_id,
    changed_rows: changedRows
  });
}

function room603FixtureApplyBindingState_(sheet, row, lineUserId, bindingStatus, now) {
  room603FixtureSetExistingHeaders_(sheet, row, ['tenant_line_user_id', 'line_user_id'], lineUserId);
  room603FixtureSetExistingHeaders_(sheet, row, ['tenant_binding_status', 'binding_status'], bindingStatus);
  room603FixtureSetExistingHeaders_(sheet, row, ['bound_at', 'binding_at', 'line_bound_at'], bindingStatus === 'bound' ? now : '');
  room603FixtureSetExistingHeaders_(sheet, row, ['updated_at', 'last_updated_at'], now);
  return 1;
}

function room603FixtureApplyLinkedBindingState_(sheet, row, lineHeaders, lineUserId, bindingStatus, now) {
  room603FixtureSetExistingHeaders_(sheet, row, lineHeaders, lineUserId);
  if (bindingStatus) room603FixtureSetExistingHeaders_(sheet, row, ['tenant_binding_status', 'binding_status'], bindingStatus);
  if (bindingStatus) room603FixtureSetExistingHeaders_(sheet, row, ['bound_at', 'binding_at', 'line_bound_at'], bindingStatus === 'bound' ? now : '');
  room603FixtureSetExistingHeaders_(sheet, row, ['updated_at', 'last_updated_at'], now);
  return 1;
}

function room603FixtureChecks_(data, mode) {
  const target = V2_ROOM_603_FIXTURE_;
  const contract = data.contract;
  const room = data.room;
  const tenant = data.tenant;
  const user = data.user;
  const signableStatuses = ['pending_tenant_signature', 'awaiting_tenant_signature'];
  const contractStatus = room603FixtureText_(contract.contract_status).toLowerCase();
  const roomStatus = room603FixtureText_(room.room_status || room.status).toLowerCase();
  const legacySchema = !room603FixtureSupportsSigningSchema_(data);
  const openContractStatuses = legacySchema ? ['active'] : signableStatuses;
  const expectedInactive = mode === 'open'
    ? contractStatus === 'terminated'
    : (openContractStatuses.indexOf(contractStatus) >= 0 && (legacySchema || room603FixtureText_(contract.signing_mode).toLowerCase() === 'new_tenant'));
  const noOtherSignable = data.contracts.filter(function (row) {
    const rowStatus = room603FixtureText_(row.contract_status || row.status).toLowerCase();
    return room603FixtureText_(row.workspace_id) === target.workspace_id && room603FixtureText_(row.tenant_id) === target.tenant_id && room603FixtureText_(row.contract_id) !== target.contract_id && openContractStatuses.indexOf(rowStatus) >= 0;
  }).length === 0;
  return {
    exact_contract_workspace: room603FixtureText_(contract.workspace_id) === target.workspace_id,
    exact_contract_tenant: room603FixtureText_(contract.tenant_id) === target.tenant_id,
    exact_contract_room: room603FixtureText_(contract.room_id) === target.room_id && room603FixtureText_(contract.room_name || contract.room_no || contract.room_number) === target.room_name,
    exact_room_workspace: room603FixtureText_(room.workspace_id) === target.workspace_id && room603FixtureText_(room.room_name || room.room_no || room.room_number) === target.room_name,
    tenant_active: room603FixtureActive_(tenant.status || tenant.account_status),
    tenant_user_active: room603FixtureText_(user.role).toLowerCase() === 'tenant' && room603FixtureActive_(user.status || user.account_status),
    historical_bill_remains_cancelled: room603FixtureText_(data.bill.bill_status).toLowerCase() === 'cancelled',
    no_other_signable_contract: noOtherSignable,
    expected_fixture_state: expectedInactive,
    expected_room_state: mode === 'open' ? roomStatus === 'vacant' : roomStatus === 'occupied'
  };
}

function room603FixtureWrite_(data, mode, now) {
  const open = mode === 'open';
  const legacySchema = !room603FixtureSupportsSigningSchema_(data);
  const openStatus = legacySchema ? 'active' : 'pending_tenant_signature';
  room603FixtureSetValues_(data.sheets.V2_contracts, data.contract._sheet_row, {
    contract_status: open ? openStatus : 'terminated',
    status: open ? openStatus : 'terminated',
    signing_mode: open ? 'new_tenant' : '',
    tenant_signed_at: '', tenant_signature_artifact_id: '',
    tenant_signing_submission_status: '', tenant_signing_submitted_at: '', updated_at: now
  });
  room603FixtureSetValues_(data.sheets.V2_rooms, data.room._sheet_row, {
    room_status: open ? 'occupied' : 'vacant',
    status: open ? 'occupied' : 'vacant',
    current_contract_id: open ? V2_ROOM_603_FIXTURE_.contract_id : '',
    current_tenant_id: open ? V2_ROOM_603_FIXTURE_.tenant_id : ''
  });
  if (open) {
    data.stored_artifacts.forEach(function (artifact) {
      room603FixtureSetValues_(data.sheets.V2_contract_artifacts, artifact._sheet_row, { status: 'superseded' });
    });
  }
}

function room603FixtureSetValues_(sheet, row, values) {
  const headers = room603FixtureHeaders_(sheet);
  Object.keys(values).forEach(function (name) {
    const aliases = name === 'contract_status'
      ? ['contract_status', 'status']
      : name === 'room_status'
        ? ['room_status', 'status']
        : [name];
    const index = room603FixtureHeaderIndex_(headers, aliases);
    if (index < 0) return;
    sheet.getRange(row, index + 1).setValue(values[name]);
  });
}

function room603FixtureSetExistingHeaders_(sheet, row, names, value) {
  const headers = room603FixtureHeaders_(sheet);
  names.forEach(function (name) {
    const index = room603FixtureHeaderIndex_(headers, [name]);
    if (index >= 0) sheet.getRange(row, index + 1).setValue(value);
  });
}

function room603FixtureAudit_(access, mode, result, detail) {
  try {
    workspaceRecordOperationActor_(access, 'room603_signing_fixture_' + mode, { success: result === 'success', code: result === 'success' ? 'OK' : 'FIXTURE_WRITE_FAILED', message: result === 'success' ? '603 受控簽署測試切換完成' : '603 受控簽署測試切換失敗' }, {
      target_type: 'room603_signing_fixture', target_id: V2_ROOM_603_FIXTURE_.contract_id,
      secondary_target_id: V2_ROOM_603_FIXTURE_.room_id, detail: JSON.stringify(detail || {})
    });
  } catch (_) {}
}

function room603FixtureHeaders_(sheet) { return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(room603FixtureText_); }
function room603FixtureHasHeaders_(sheet, required) { const headers = room603FixtureHeaders_(sheet); return required.every(function (aliases) { return room603FixtureHeaderIndex_(headers, Array.isArray(aliases) ? aliases : [aliases]) >= 0; }); }
function room603FixtureHasAnyHeaders_(sheet, aliases) { return room603FixtureHeaderIndex_(room603FixtureHeaders_(sheet), aliases) >= 0; }
function room603FixtureRows_(sheet) { if (sheet.getLastRow() < 2) return []; const values = sheet.getDataRange().getValues(); const headers = values.shift().map(room603FixtureText_); return values.map(function (row, index) { const item = { _sheet_row: index + 2 }; headers.forEach(function (header, column) { item[header] = row[column]; }); return item; }); }
function room603FixtureActive_(value) { const text = room603FixtureText_(value).toLowerCase(); return text === '' || text === 'active'; }
function room603FixtureText_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function room603FixturePublicTarget_() { return { workspace_id: V2_ROOM_603_FIXTURE_.workspace_id, room_id: V2_ROOM_603_FIXTURE_.room_id, room_name: V2_ROOM_603_FIXTURE_.room_name, tenant_id: V2_ROOM_603_FIXTURE_.tenant_id, contract_id: V2_ROOM_603_FIXTURE_.contract_id }; }
function room603FixtureSafeSnapshot_(data) { return { contract_status: room603FixtureText_(data.contract.contract_status), signing_mode: room603FixtureText_(data.contract.signing_mode), room_status: room603FixtureText_(data.room.room_status || data.room.status), bill_status: room603FixtureText_(data.bill.bill_status) }; }
function room603FixtureSupportsSigningSchema_(data) { return room603FixtureHeaderIndex_(room603FixtureHeaders_(data.sheets.V2_contracts), ['signing_mode']) >= 0; }
function room603FixtureSwitchLog_(result, mode) {
  try {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log('[ROOM603_SWITCH] ' + JSON.stringify({
        mode: mode,
        success: result && result.success === true,
        code: result && result.code || '',
        compatibility_mode: result && result.data && result.data.compatibility_mode || ''
      }));
    }
  } catch (_) {}
}
function room603FixtureRebindLog_(result) {
  try {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log('[ROOM603_REBIND] ' + JSON.stringify({
        success: result && result.success === true,
        code: result && result.code || '',
        source_tenant_id: V2_ROOM_603_FIXTURE_.previous_staging_tenant_id,
        target_tenant_id: V2_ROOM_603_FIXTURE_.tenant_id,
        changed_rows: result && result.data && result.data.changed_rows || 0
      }));
    }
  } catch (_) {}
}
function room603FixtureResult_(success, code, message, data) { return { success: success, code: code, message: message, data: data || {} }; }
