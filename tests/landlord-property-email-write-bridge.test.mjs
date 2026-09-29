import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('apps-script/程式碼.js', 'utf8');
const apiSource = readFileSync('apps-script/V2_API.js', 'utf8');
const emailSource = readFileSync('apps-script/V2_LANDLORD_EMAIL_AUTH.js', 'utf8');
const actions = {
  landlord_property_save: ['saveLandlordPropertyByLineUid_', [
    'property_id', 'property_name', 'city', 'district', 'property_address',
    'property_type', 'payment_account_id', 'note'
  ]],
  landlord_property_archive: ['archiveLandlordPropertyByLineUid_', [
    'property_id', 'archive_reason'
  ]],
  landlord_room_save: ['saveLandlordRoomByLineUid_', [
    'room_id', 'property_id', 'room_name', 'rent_amount', 'management_fee',
    'electricity_fee_rate', 'equipment_fee_rate', 'equipment_fee_rate_summer',
    'equipment_fee_rate_regular', 'payment_day', 'deposit_months',
    'deposit_amount', 'room_status', 'note'
  ]],
  landlord_room_account_toggle: ['setLandlordRoomAccountToggleByLineUid_', [
    'room_id', 'enabled'
  ]],
  landlord_room_archive: ['archiveLandlordRoomByLineUid_', [
    'room_id', 'archive_reason'
  ]]
};

function extract(name, text = source) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(text);
  assert.ok(match, `${name} must exist`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = text.indexOf('{', match.index); index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return text.slice(match.index, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

function fixture(authState, principalWorkspaceId = 'W1') {
  const calls = [];
  const context = {
    JSON, String, Object, Error, Number, Math, Date,
    runtimeSnapshotBegin_() {}, runtimeSnapshotFinish_() {},
    landlordEmailAuthPostRequires_(request, fields) {
      return fields.every(field => request[field])
        ? null : { success: false, code: 'AUTH_REQUIRED' };
    },
    resolveLandlordPrincipal_(request) {
      return request.landlord_session_token === 'VALID'
        ? { success: true, data: { principal_line_user_id: 'SERVER_RESOLVED', workspace_id: principalWorkspaceId } }
        : { success: false, code: 'SESSION_EXPIRED' };
    },
    htmlBridgeOutput_: (result, requestId) => ({ transport: 'bridge', result, requestId }),
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: value => ({
        transport: 'fallback', value, setMimeType() { return this; }
      })
    },
    tenantLiffSigningIsAuthRequest_: () => false,
    tenantLiffSigningIsInviteAuthRequest_: () => false,
    landlordContractSigningReviewIsAuthRequest_: () => false,
    landlordContractSigningReviewIsExchangeRequest_: () => false,
    landlordPaperContractBackfillIsRequest_: () => false,
    landlordInitiatedContractIsRequest_: () => false,
    tenantContractArtifactIsUploadRequest_: () => false,
    tenantContractSigningIsSubmitRequest_: () => false,
    legacyContractSignedSyncIsRequest_: () => false,
    handleLineWebhook_: () => ({ success: false, code: 'WEBHOOK_FALLBACK' })
  };
  for (const [action, [handler]] of Object.entries(actions)) {
    context[handler] = (...args) => {
      calls.push({ action, args });
      return { success: true, code: 'OK', data: { action } };
    };
  }
  if (authState) {
    const session = {
      status: authState.sessionStatus || 'active',
      revoked_at: authState.revoked ? '2026-09-28T00:00:00Z' : '',
      expires_at: authState.expired ? '2026-09-28T00:00:00Z' : '2026-09-30T00:00:00Z',
      user_id: 'U1', workspace_id: authState.sessionWorkspace || 'W1',
      role: authState.sessionRole || 'owner'
    };
    const user = { user_id: 'U1', line_user_id: 'SERVER_RESOLVED' };
    const access = {
      success: !authState.accessDenied,
      code: authState.accessDenied ? 'WORKSPACE_FORBIDDEN' : 'OK',
      workspace: { workspace_id: authState.currentWorkspace || 'W1' },
      membership: { role: authState.currentRole || 'owner' }
    };
    Object.assign(context, {
      runtimeSnapshotIsReadEnabled_: () => false,
      landlordEmailAuthSessionSheet_: () => ({}),
      landlordEmailAuthFindSessionByToken_: token => token === 'VALID' ? session : null,
      landlordEmailAuthNowIso_: () => '2026-09-29T00:00:00Z',
      landlordEmailAuthText_: value => value == null ? '' : String(value).trim(),
      landlordEmailAuthTimestamp_: value => Date.parse(value),
      landlordEmailAuthUpdateRow_: () => {},
      landlordEmailAuthFindUserById_: () => user,
      landlordEmailAuthUserCanLogin_: () => !authState.userDisabled,
      landlordEmailAuthResolveUserAccess_: () => access,
      landlordEmailAuthWorkspaceId_: value => value.workspace.workspace_id,
      landlordEmailAuthRole_: value => value.membership.role,
      landlordEmailAuthWorkspace_: value => value.workspace,
      landlordEmailAuthMembership_: value => value.membership,
      landlordEmailAuthResult_: (success, code, message, data) => ({ success, code, message, data }),
      landlordEmailAuthError_: (code, message) => ({ success: false, code, message })
    });
  }
  vm.createContext(context);
  if (authState) {
    vm.runInContext([
      extract('landlordEmailAuthResolveSession_', emailSource),
      extract('resolveLandlordEmailSession_', emailSource),
      extract('resolveLandlordPrincipal_', apiSource)
    ].join('\n'), context);
  }
  vm.runInContext([
    'repairRouteIsAction_', 'repairRouteDecodeFormBody_',
    'repairRouteQueryAction_', 'repairRouteRequestFromPostBody_'
  ].map(name => extract(name)).join('\n'), context);
  vm.runInContext(source.slice(source.indexOf('function doPost(e)')), context);
  return { context, calls };
}

function request(action, token = 'VALID') {
  return {
    action, response_mode: 'bridge', request_id: 'REQ',
    landlord_session_token: token,
    property_id: 'P1', property_name: 'Building', city: 'Taipei',
    district: 'District', property_address: 'Address', property_type: 'apartment',
    payment_account_id: 'A1', note: 'Note', archive_reason: 'Reason',
    room_id: 'R1', room_name: '506', rent_amount: '7500', management_fee: '0',
    electricity_fee_rate: '5', equipment_fee_rate: '2',
    equipment_fee_rate_summer: '3', equipment_fee_rate_regular: '2',
    payment_day: '10', deposit_months: '2', deposit_amount: '15000',
    room_status: 'vacant', enabled: 'true'
  };
}

test('property and room Email writes use a server-resolved principal and exact existing handlers', () => {
  for (const [action, [, fields]] of Object.entries(actions)) {
    const { context, calls } = fixture();
    const body = request(action);
    const response = context.doPost({ postData: { contents: JSON.stringify(body) } });
    assert.equal(response.transport, 'bridge', `${action} must not fall through to LINE webhook`);
    assert.equal(response.result.code, 'OK');
    assert.equal(response.requestId, 'REQ');
    assert.deepEqual(calls, [{ action, args: [
      'SERVER_RESOLVED', ...fields.map(field => body[field]), 'W1'
    ] }]);
  }
});

test('property and room Email writes fail closed without a valid session', () => {
  for (const action of Object.keys(actions)) {
    for (const token of ['', 'EXPIRED']) {
      const { context, calls } = fixture();
      const response = context.doPost({
        postData: { contents: JSON.stringify(request(action, token)) }
      });
      assert.equal(response.transport, 'bridge');
      assert.equal(response.result.code, token ? 'SESSION_EXPIRED' : 'AUTH_REQUIRED');
      assert.equal(calls.length, 0, `${action} must not mutate without a valid session`);
    }
  }
});

test('form bridge reads the POST body and never inherits a query credential', () => {
  const valid = fixture();
  const validBody = request('landlord_property_save');
  const validResponse = valid.context.doPost({
    postData: { contents: new URLSearchParams(validBody).toString() },
    parameter: validBody
  });
  assert.equal(validResponse.transport, 'bridge');
  assert.equal(validResponse.result.code, 'OK');
  assert.equal(valid.calls.length, 1);

  const injected = fixture();
  const body = {
    action: 'landlord_property_save', response_mode: 'bridge', request_id: 'REQ'
  };
  const response = injected.context.doPost({
    postData: { contents: new URLSearchParams(body).toString() },
    queryString: 'landlord_session_token=VALID',
    parameter: { ...body, landlord_session_token: 'VALID' }
  });
  assert.equal(response.transport, 'bridge');
  assert.equal(response.result.code, 'AUTH_REQUIRED');
  assert.equal(injected.calls.length, 0);
});

test('room account toggle preserves an explicit false in JSON POST requests', () => {
  const { context, calls } = fixture();
  const body = request('landlord_room_account_toggle');
  body.enabled = false;
  const response = context.doPost({ postData: { contents: JSON.stringify(body) } });
  assert.equal(response.result.code, 'OK');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args[2], false);
});

test('Email write bridge fails closed if the resolved session has no Workspace', () => {
  const { context, calls } = fixture(undefined, '');
  const response = context.doPost({
    postData: { contents: JSON.stringify(request('landlord_room_save')) }
  });
  assert.equal(response.result.success, false);
  assert.equal(calls.length, 0);
});

test('all existing write handlers receive an optional expected Workspace binding', () => {
  const backend = readFileSync('apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js', 'utf8');
  for (const [, [handler, fields]] of Object.entries(actions)) {
    const seen = [];
    const context = vm.createContext({
      LockService: { getScriptLock: () => ({ releaseLock() {} }) },
      propertyRoomEnsureSchema_: () => {},
      propertyRoomText_: value => value == null ? '' : String(value).trim(),
      workspaceLandlordResolveAccess_: (lineUserId, options) => {
        seen.push({ lineUserId, options });
        return { success: false, code: 'STOP' };
      }
    });
    vm.runInContext(extract(handler, backend), context);
    const result = context[handler](
      'SERVER_RESOLVED', ...fields.map(() => ''), 'W1'
    );
    assert.equal(result.code, 'STOP', `${handler} must stop after access denial`);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].options.workspace_id, 'W1',
      `${handler} must resolve the session Workspace rather than the mutable active Workspace`);
  }
});

test('actual session resolver rejects revoked, expired, disabled and cross-workspace writes', () => {
  const scenarios = [
    [{ revoked: true }, 'SESSION_REVOKED'],
    [{ expired: true }, 'SESSION_EXPIRED'],
    [{ userDisabled: true }, 'AUTH_REQUIRED'],
    [{ accessDenied: true }, 'WORKSPACE_FORBIDDEN'],
    [{ sessionWorkspace: 'W2' }, 'WORKSPACE_FORBIDDEN'],
    [{ sessionRole: 'admin' }, 'WORKSPACE_FORBIDDEN']
  ];
  for (const [state, expectedCode] of scenarios) {
    const { context, calls } = fixture(state);
    const response = context.doPost({
      postData: { contents: JSON.stringify(request('landlord_room_save')) }
    });
    assert.equal(response.result.code, expectedCode);
    assert.equal(calls.length, 0, `${expectedCode} must not reach a write handler`);
  }
  const valid = fixture({});
  const response = valid.context.doPost({
    postData: { contents: JSON.stringify(request('landlord_room_save')) }
  });
  assert.equal(response.result.code, 'OK');
  assert.equal(valid.calls.length, 1);
});
