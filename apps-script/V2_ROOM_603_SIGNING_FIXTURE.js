// Controlled internal fixture for Room 603 native-contract-signing tests.
// It is deliberately not a Web App route and defaults to dry-run.

const V2_ROOM_603_FIXTURE_ = {
  workspace_id: 'W000001',
  room_id: 'R000019',
  room_name: '603',
  tenant_id: 'T000020',
  contract_id: 'C000019',
  cancelled_bill_id: 'BILL-202607-C000019'
};

const V2_ROOM_603_FIXTURE_CONTRACT_HEADERS_ = [
  'contract_id', 'workspace_id', 'tenant_id', 'room_id', 'room_name',
  'contract_status', 'signing_mode', 'tenant_signed_at',
  'tenant_signature_artifact_id', 'tenant_signing_submission_status',
  'tenant_signing_submitted_at', 'updated_at'
];

const V2_ROOM_603_FIXTURE_ROOM_HEADERS_ = [
  'room_id', 'workspace_id', 'room_name', 'room_status',
  'current_contract_id', 'current_tenant_id'
];

const V2_ROOM_603_FIXTURE_ARTIFACT_HEADERS_ = [
  'workspace_id', 'tenant_id', 'contract_id', 'status'
];

/** Read-only preflight. It never changes data, Drive, Properties, or LINE. */
function previewRoom603NewTenantSigningFixture() {
  return runRoom603SigningFixture_(false);
}

/** Read-only state check for the approved 603 fixture; it never changes data. */
function inspectRoom603SigningFixture() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

function runRoom603SigningFixture_(execute) {
  return room603FixtureRun_(execute === true, 'open');
}

function runRoom603SigningFixtureClose_(execute) {
  return room603FixtureRun_(execute === true, 'close');
}

function room603FixtureRun_(execute, mode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const setup = room603FixtureRead_(ss);
  if (!setup.success) return setup;

  const access = room603FixtureResolveAccessReadOnly_(ss);
  if (!access.success) return access;

  const checks = room603FixtureChecks_(setup.data, mode);
  if (Object.keys(checks).some(function (key) { return checks[key] !== true; })) {
    return room603FixtureResult_(false, 'FIXTURE_GUARD_FAILED', '603 測試租約不符合受控切換條件', {
      dry_run: true, mode: mode, checks: checks
    });
  }

  const result = room603FixtureResult_(true, execute ? 'READY_TO_EXECUTE' : 'DRY_RUN_OK', execute ? '603 測試租約已開啟為 new_tenant 簽署狀態' : '603 測試租約 preflight 通過，尚未寫入', {
    dry_run: !execute,
    mode: mode,
    target: room603FixturePublicTarget_(),
    stored_artifact_count: setup.data.stored_artifacts.length
  });
  if (!execute) return result;

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) return room603FixtureResult_(false, 'REQUEST_BUSY', '603 測試工具正在由其他操作使用');
    const locked = room603FixtureRead_(ss);
    if (!locked.success) return locked;
    const lockedChecks = room603FixtureChecks_(locked.data, mode);
    if (Object.keys(lockedChecks).some(function (key) { return lockedChecks[key] !== true; })) {
      return room603FixtureResult_(false, 'FIXTURE_GUARD_CHANGED', '取得鎖定後 603 測試資料已變更，未寫入', { dry_run: true, mode: mode, checks: lockedChecks });
    }
    const now = new Date().toISOString();
    room603FixtureWrite_(locked.data, mode, now);
    SpreadsheetApp.flush();
    room603FixtureAudit_(access.data.access, mode, 'success', {
      target: room603FixturePublicTarget_(),
      stored_artifact_count: locked.data.stored_artifacts.length,
      before: room603FixtureSafeSnapshot_(locked.data)
    });
    return result;
  } catch (error) {
    room603FixtureAudit_(access.data.access, mode, 'failed', { code: 'FIXTURE_WRITE_FAILED' });
    return room603FixtureResult_(false, 'FIXTURE_WRITE_FAILED', '603 測試租約未完成切換；請查看操作稽核後再重試');
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/**
 * Resolve the existing owner/admin actor without creating legacy records or
 * repairing Workspace schema. The preview route remains genuinely read-only.
 */
function room603FixtureResolveAccessReadOnly_(ss) {
  const lineUserId = room603FixtureText_(
    getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID')
  );
  const workspaceId = V2_ROOM_603_FIXTURE_.workspace_id;
  const usersSheet = ss.getSheetByName('V2_users');
  const workspacesSheet = ss.getSheetByName('V2_workspaces');
  const membersSheet = ss.getSheetByName('V2_workspace_members');

  if (!lineUserId || !usersSheet || !workspacesSheet || !membersSheet) {
    return room603FixtureResult_(
      false,
      'FIXTURE_AUTHORIZATION_SCHEMA_MISSING',
      '603 測試工具缺少既有 Workspace authorization 資料，拒絕切換'
    );
  }

  const users = room603FixtureRows_(usersSheet);
  const workspaces = room603FixtureRows_(workspacesSheet);
  const members = room603FixtureRows_(membersSheet);
  const userMatches = users.filter(function (user) {
    return room603FixtureText_(user.line_user_id) === lineUserId;
  });
  const workspaceMatches = workspaces.filter(function (workspace) {
    return room603FixtureText_(workspace.workspace_id).toUpperCase() ===
      workspaceId;
  });

  if (userMatches.length !== 1 || workspaceMatches.length !== 1) {
    return room603FixtureResult_(
      false,
      'FIXTURE_ACTOR_OR_WORKSPACE_AMBIGUOUS',
      '603 測試工具找不到唯一既有 owner/admin actor 或 Workspace'
    );
  }

  const user = userMatches[0];
  const workspace = workspaceMatches[0];
  const memberships = members.filter(function (membership) {
    const role = room603FixtureText_(membership.role).toLowerCase();
    const memberLineUserId = room603FixtureText_(membership.line_user_id);
    return (
      room603FixtureText_(membership.workspace_id).toUpperCase() ===
        workspaceId &&
      room603FixtureText_(membership.user_id) ===
        room603FixtureText_(user.user_id) &&
      ['owner', 'admin'].indexOf(role) >= 0 &&
      room603FixtureActive_(membership.member_status) &&
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

  if (
    !room603FixtureActive_(user.account_status) ||
    !room603FixtureActive_(workspace.account_status) ||
    typeof workspaceOnboardingComplete_ !== 'function' ||
    !workspaceOnboardingComplete_(workspace.onboarding_status)
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
    if (!sheets[names[i]]) return room603FixtureResult_(false, 'FIXTURE_SCHEMA_NOT_READY', '缺少 ' + names[i] + '，拒絕切換');
  }
  const rows = {};
  Object.keys(sheets).forEach(function (name) { rows[name] = room603FixtureRows_(sheets[name]); });
  if (!room603FixtureHasHeaders_(sheets.V2_contracts, V2_ROOM_603_FIXTURE_CONTRACT_HEADERS_) ||
      !room603FixtureHasHeaders_(sheets.V2_rooms, V2_ROOM_603_FIXTURE_ROOM_HEADERS_) ||
      !room603FixtureHasHeaders_(sheets.V2_contract_artifacts, V2_ROOM_603_FIXTURE_ARTIFACT_HEADERS_)) {
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

function room603FixtureChecks_(data, mode) {
  const target = V2_ROOM_603_FIXTURE_;
  const contract = data.contract;
  const room = data.room;
  const tenant = data.tenant;
  const user = data.user;
  const signableStatuses = ['pending_tenant_signature', 'awaiting_tenant_signature'];
  const contractStatus = room603FixtureText_(contract.contract_status).toLowerCase();
  const roomStatus = room603FixtureText_(room.room_status || room.status).toLowerCase();
  const expectedInactive = mode === 'open'
    ? contractStatus === 'terminated'
    : (signableStatuses.indexOf(contractStatus) >= 0 && room603FixtureText_(contract.signing_mode).toLowerCase() === 'new_tenant');
  const noOtherSignable = data.contracts.filter(function (row) {
    return room603FixtureText_(row.workspace_id) === target.workspace_id && room603FixtureText_(row.tenant_id) === target.tenant_id && room603FixtureText_(row.contract_id) !== target.contract_id && signableStatuses.indexOf(room603FixtureText_(row.contract_status).toLowerCase()) >= 0;
  }).length === 0;
  return {
    exact_contract_workspace: room603FixtureText_(contract.workspace_id) === target.workspace_id,
    exact_contract_tenant: room603FixtureText_(contract.tenant_id) === target.tenant_id,
    exact_contract_room: room603FixtureText_(contract.room_id) === target.room_id && room603FixtureText_(contract.room_name) === target.room_name,
    exact_room_workspace: room603FixtureText_(room.workspace_id) === target.workspace_id && room603FixtureText_(room.room_name) === target.room_name,
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
  room603FixtureSetValues_(data.sheets.V2_contracts, data.contract._sheet_row, {
    contract_status: open ? 'pending_tenant_signature' : 'terminated',
    signing_mode: open ? 'new_tenant' : '',
    tenant_signed_at: '', tenant_signature_artifact_id: '',
    tenant_signing_submission_status: '', tenant_signing_submitted_at: '', updated_at: now
  });
  room603FixtureSetValues_(data.sheets.V2_rooms, data.room._sheet_row, {
    room_status: open ? 'occupied' : 'vacant',
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
    const index = headers.indexOf(name);
    if (index < 0) throw new Error('missing fixture header: ' + name);
    sheet.getRange(row, index + 1).setValue(values[name]);
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
function room603FixtureHasHeaders_(sheet, required) { const headers = room603FixtureHeaders_(sheet); return required.every(function (name) { return headers.indexOf(name) >= 0; }); }
function room603FixtureRows_(sheet) { if (sheet.getLastRow() < 2) return []; const values = sheet.getDataRange().getValues(); const headers = values.shift().map(room603FixtureText_); return values.map(function (row, index) { const item = { _sheet_row: index + 2 }; headers.forEach(function (header, column) { item[header] = row[column]; }); return item; }); }
function room603FixtureActive_(value) { const text = room603FixtureText_(value).toLowerCase(); return text === '' || text === 'active'; }
function room603FixtureText_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function room603FixturePublicTarget_() { return { workspace_id: V2_ROOM_603_FIXTURE_.workspace_id, room_id: V2_ROOM_603_FIXTURE_.room_id, room_name: V2_ROOM_603_FIXTURE_.room_name, tenant_id: V2_ROOM_603_FIXTURE_.tenant_id, contract_id: V2_ROOM_603_FIXTURE_.contract_id }; }
function room603FixtureSafeSnapshot_(data) { return { contract_status: room603FixtureText_(data.contract.contract_status), signing_mode: room603FixtureText_(data.contract.signing_mode), room_status: room603FixtureText_(data.room.room_status || data.room.status), bill_status: room603FixtureText_(data.bill.bill_status) }; }
function room603FixtureResult_(success, code, message, data) { return { success: success, code: code, message: message, data: data || {} }; }
