import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');

class Sheet {
  constructor(headers, rows = []) {
    this.headers = headers.slice();
    this.rows = rows.map(row => row.slice());
  }

  getLastRow() { return this.rows.length + 1; }
  getLastColumn() { return this.headers.length; }
  getDataRange() { return { getValues: () => [this.headers.slice(), ...this.rows.map(row => row.slice())] }; }

  getRange(row, column, height = 1, width = 1) {
    if (row === 1) {
      return {
        getValues: () => [this.headers.slice(column - 1, column - 1 + width)],
        getDisplayValues: () => [this.headers.slice(column - 1, column - 1 + width)],
        setValues: values => {
          (values[0] || []).forEach((value, index) => { this.headers[column - 1 + index] = value; });
        }
      };
    }
    return {
      getValues: () => this.rows.slice(row - 2, row - 2 + height).map(item => item.slice(column - 1, column - 1 + width)),
      getDisplayValues: () => this.rows.slice(row - 2, row - 2 + height).map(item => item.slice(column - 1, column - 1 + width)),
      setValue: value => { this.rows[row - 2][column - 1] = value; },
      setValues: values => values.forEach((valuesRow, rowIndex) => valuesRow.forEach((value, columnIndex) => {
        this.rows[row - 2 + rowIndex][column - 1 + columnIndex] = value;
      }))
    };
  }

  appendRow(row) { this.rows.push(row.slice()); }
}

const CONTRACT_HEADERS = [
  'contract_id', 'workspace_id', 'landlord_id', 'landlord_line_user_id', 'landlord_name',
  'tenant_id', 'tenant_user_id', 'tenant_line_user_id', 'tenant_name', 'tenant_phone', 'tenant_email',
  'property_id', 'property_name', 'property_address', 'room_id', 'room_name',
  'start_date', 'contract_start_date', 'end_date', 'contract_end_date',
  'rent_amount', 'monthly_rent', 'management_fee', 'monthly_management_fee',
  'deposit_amount', 'payment_day', 'monthly_payment_day', 'contract_status', 'status', 'account_status',
  'signing_mode', 'contract_origin', 'invite_id', 'contract_content', 'contract_version',
  'previous_contract_id', 'renewed_to_contract_id', 'tenant_signing_submission_status',
  'created_by_user_id', 'created_by_membership_id', 'created_at', 'updated_at', 'note'
];
const USER_HEADERS = ['user_id', 'workspace_id', 'landlord_id', 'line_user_id', 'role', 'status', 'account_status', 'created_at', 'updated_at'];
const TENANT_HEADERS = ['tenant_id', 'tenant_user_id', 'user_id', 'workspace_id', 'landlord_id', 'tenant_line_user_id', 'line_user_id', 'tenant_name', 'name', 'tenant_phone', 'phone', 'tenant_email', 'email', 'property_id', 'property_name', 'room_id', 'room_name', 'current_contract_id', 'tenant_binding_status', 'binding_status', 'account_status', 'tenant_account_status', 'created_at', 'updated_at'];
const INVITE_HEADERS = [
  'invite_id', 'workspace_id', 'contract_id', 'room_id', 'landlord_user_id', 'landlord_membership_id',
  'claim_code_hash', 'status', 'expires_at', 'claimed_at', 'claimed_line_user_id', 'cancelled_at', 'created_at', 'updated_at'
];

const access = {
  success: true,
  line_user_id: 'landlord-line',
  principal_line_user_id: 'landlord-line',
  workspace: { workspace_id: 'W1' },
  user: { user_id: 'landlord-user', name: '房東甲' },
  membership: { membership_id: 'membership-1', role: 'owner' },
  principals: [{ landlord_id: 'L1' }]
};

function rowFor(headers, values) {
  return headers.map(header => values[header] === undefined ? '' : values[header]);
}

function makeRuntime() {
  const properties = new Sheet(
    ['property_id', 'workspace_id', 'landlord_id', 'property_name', 'property_address', 'account_status'],
    [['P1', 'W1', 'L1', '幸福公寓', '台北市測試路 1 號', 'active']]
  );
  const rooms = new Sheet(
    ['room_id', 'workspace_id', 'landlord_id', 'property_id', 'room_name', 'room_status', 'account_status', 'current_contract_id', 'current_tenant_id', 'current_tenant_name'],
    [['R202', 'W1', 'L1', 'P1', '202', 'vacant', 'active', '', '', '']]
  );
  const users = new Sheet(USER_HEADERS, []);
  const tenants = new Sheet(TENANT_HEADERS, []);
  const contracts = new Sheet(CONTRACT_HEADERS, []);
  const invites = new Sheet(INVITE_HEADERS, []);
  const sheets = { V2_properties: properties, V2_rooms: rooms, V2_users: users, V2_tenants: tenants, V2_contracts: contracts, V2_contract_invites: invites };
  const cache = new Map();
  let uuid = 0;
  const context = {
    Date, Math, Number, String, Object, Array, JSON, RegExp,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => 'uuid-' + (++uuid),
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()].map(byte => byte > 127 ? byte - 256 : byte),
      computeHmacSha256Signature: (value, key) => [...crypto.createHmac('sha256', String(key)).update(String(value)).digest()].map(byte => byte > 127 ? byte - 256 : byte),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url')
    },
    CacheService: { getScriptCache: () => ({ put: (key, value) => cache.set(key, value), get: key => cache.get(key) || null, remove: key => cache.delete(key) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => ({ CMWEBS_LINE_LOGIN_CHANNEL_ID: 'channel-1', CMWEBS_LIFF_SESSION_HMAC_SECRET: 'session-secret' }[key] || null) }) },
    tenantContractSigningReviewText_: value => String(value == null ? '' : value).trim(),
    tenantLiffSigningText_: value => String(value == null ? '' : value).trim(),
    tenantContractSigningReviewError_: code => ({ success: false, code, message: 'contract error' }),
    workspaceResult_: (success, code, message) => ({ success, code, message, data: null })
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });
  context.tenantContractSigningReviewAccessFromSession_ = (_token, _permission) => ({ success: true, data: access });
  context.workspaceLandlordResolveAccess_ = () => access;
  context.workspaceLandlordCheckPolicy_ = () => ({ success: true, code: 'OK' });
  context.landlordEmailAuthResolveSession_ = () => ({ success: false, code: 'AUTH_REQUIRED' });
  return { api: context, sheets };
}

const input = {
  property_id: 'P1', room_id: 'R202', start_date: '2026-08-17', end_date: '2027-08-16',
  rent_amount: 8500, management_fee: 500, deposit_amount: 18000, payment_day: 10,
  tenant_name: '', tenant_phone: '', tenant_email: ''
};

function useEmailInviteWriteSession(api, { allowed = true } = {}) {
  api.tenantContractSigningReviewAccessFromSession_ = (_token, permission) => {
    assert.equal(permission, 'contract_write');
    return { success: false, code: 'LANDLORD_REVIEW_SESSION_INVALID', message: 'native session required' };
  };
  api.landlordEmailAuthResolveSession_ = (token, requestId, touch, options) => {
    assert.equal(token, 'email-session');
    assert.equal(requestId, '');
    assert.equal(touch, false);
    assert.equal(options.require_onboarding, true);
    return {
      success: true,
      code: 'OK',
      data: {
        user_id: 'landlord-user',
        workspace_id: 'W1',
        role: 'owner',
        user: { user_id: 'landlord-user', line_user_id: 'landlord-line' },
        membership: { membership_id: 'membership-1', role: 'owner' },
        workspace: { workspace_id: 'W1' },
        session: { status: 'active' }
      }
    };
  };
  api.workspaceLandlordResolveAccess_ = (lineSub, options) => {
    assert.equal(lineSub, 'landlord-line');
    assert.equal(options.skip_schema_ensure, true);
    assert.equal(options.skip_legacy_context_creation, true);
    return access;
  };
  api.workspaceLandlordCheckPolicy_ = (currentAccess, policy) => {
    assert.equal(currentAccess, access);
    assert.equal(policy, 'contract_write');
    return allowed
      ? { success: true, code: 'OK' }
      : { success: false, code: 'WORKSPACE_PERMISSION_DENIED' };
  };
}

{
  const { api, sheets } = makeRuntime();
  const created = api.landlordInitiatedContractCreateNew_(access, input);
  assert.equal(created.success, true, created.code);
  const oldInviteId = created.data.invite.invite_id;
  const listed = api.landlordInitiatedContractListByAccess_(access);
  assert.equal(listed.success, true, listed.code);
  assert.equal(listed.data.items.length, 1);
  assert.equal(listed.data.items[0].invite_id, oldInviteId);
  assert.match(listed.data.items[0].invite_url, new RegExp(oldInviteId));

  const reissued = api.landlordInitiatedContractReissueBySession_('review-session', oldInviteId);
  assert.equal(reissued.success, true, reissued.code);
  assert.notEqual(reissued.data.invite.invite_id, oldInviteId);
  assert.equal(reissued.data.invite.confirmation_code.length, 6);
  assert.equal(sheets.V2_contract_invites.rows[0][7], 'cancelled');
  assert.equal(sheets.V2_contract_invites.rows.length, 2);
  assert.equal(sheets.V2_contracts.rows[0][32], reissued.data.invite.invite_id);

  const listedAgain = api.landlordInitiatedContractListByAccess_(access);
  assert.equal(listedAgain.data.items[0].invite_id, reissued.data.invite.invite_id);
  assert.match(listedAgain.data.items[0].invite_url, new RegExp(reissued.data.invite.invite_id));
  assert.equal(listedAgain.data.items[0].invite_url.includes(reissued.data.invite.confirmation_code), false);

  const stale = api.landlordInitiatedContractReissueBySession_('review-session', oldInviteId);
  assert.equal(stale.success, false);
  assert.equal(stale.code, 'INVITE_STALE');
}

{
  const { api } = makeRuntime();
  assert.equal(api.landlordInitiatedContractIsRequest_({ action: 'landlord_contract_invite_reissue' }), true);
  const missing = api.landlordInitiatedContractReissueBySession_('review-session', 'missing-invite');
  assert.equal(missing.success, false);
  assert.equal(missing.code, 'INVITE_NOT_FOUND');
}

{
  const { api, sheets } = makeRuntime();
  const created = api.landlordInitiatedContractCreateNew_(access, input);
  useEmailInviteWriteSession(api);

  const reissued = api.landlordInitiatedContractReissueBySession_(
    'email-session', created.data.invite.invite_id
  );

  assert.equal(reissued.success, true, reissued.code);
  assert.equal(sheets.V2_contract_invites.rows[0][7], 'cancelled');
  assert.equal(sheets.V2_contract_invites.rows[1][7], 'pending');
  assert.equal(sheets.V2_contracts.rows[0][32], reissued.data.invite.invite_id);
}

{
  const { api, sheets } = makeRuntime();
  const created = api.landlordInitiatedContractCreateNew_(access, input);
  useEmailInviteWriteSession(api);

  const cancelled = api.landlordInitiatedContractCancelBySession_(
    'email-session', created.data.invite.invite_id
  );

  assert.equal(cancelled.success, true, cancelled.code);
  assert.equal(sheets.V2_contract_invites.rows[0][7], 'cancelled');
  assert.equal(sheets.V2_contracts.rows[0][27], 'cancelled');
}

{
  const { api, sheets } = makeRuntime();
  const created = api.landlordInitiatedContractCreateNew_(access, input);
  useEmailInviteWriteSession(api, { allowed: false });

  const rejected = api.landlordInitiatedContractCancelBySession_(
    'email-session', created.data.invite.invite_id
  );

  assert.equal(rejected.success, false);
  assert.equal(rejected.code, 'WORKSPACE_PERMISSION_DENIED');
  assert.equal(sheets.V2_contract_invites.rows[0][7], 'pending');
  assert.equal(sheets.V2_contracts.rows[0][27], 'pending_tenant_signature');
}

{
  const { api, sheets } = makeRuntime();
  sheets.V2_contracts = new Sheet(
    ['contract_id', 'workspace_id', 'room_id', 'contract_status', 'status'],
    [['legacy-quick-506', 'W1', 'R506', 'pending_tenant_signature', 'pending']]
  );
  sheets.V2_contract_invites.appendRow(rowFor(INVITE_HEADERS, {
    invite_id: 'invite-506',
    workspace_id: 'W1',
    contract_id: 'legacy-quick-506',
    room_id: 'R506',
    status: 'pending',
    expires_at: '2026-10-01T00:00:00.000Z'
  }));

  const listed = api.landlordInitiatedContractListByAccess_(access);
  assert.equal(listed.success, true, listed.code);
  assert.equal(listed.data.items.length, 1,
    'an invite-linked quick lease must remain visible when legacy contract headers are absent');
  assert.equal(listed.data.items[0].invite_id, 'invite-506');
  assert.match(listed.data.items[0].invite_url, /invite-506/);
}

{
  const { api, sheets } = makeRuntime();
  sheets.V2_contracts = new Sheet(
    ['contract_id', 'workspace_id', 'room_id', 'contract_status', 'status'],
    [['legacy-quick-506', 'W1', 'R506', 'pending_tenant_signature', 'pending']]
  );
  sheets.V2_contract_invites.appendRow(rowFor(INVITE_HEADERS, {
    invite_id: 'invite-506-legacy',
    workspace_id: 'W1',
    contract_id: 'legacy-quick-506',
    room_id: 'R506',
    status: 'pending',
    expires_at: '2026-10-01T00:00:00.000Z',
    created_at: '2026-09-29T00:00:00.000Z'
  }));

  const reissued = api.landlordInitiatedContractReissueBySession_(
    'review-session', 'invite-506-legacy'
  );

  assert.equal(reissued.success, true, reissued.code);
  assert.notEqual(reissued.data.invite.invite_id, 'invite-506-legacy');
  assert.equal(sheets.V2_contract_invites.rows[0][7], 'cancelled');
  assert.equal(sheets.V2_contract_invites.rows.length, 2);
  const listed = api.landlordInitiatedContractListByAccess_(access);
  assert.equal(listed.data.items[0].invite_id, reissued.data.invite.invite_id);
}

{
  const { api, sheets } = makeRuntime();
  sheets.V2_contracts = new Sheet(
    ['contract_id', 'workspace_id', 'room_id', 'contract_status', 'status'],
    [['legacy-quick-506', 'W1', 'R506', 'pending_tenant_signature', 'pending']]
  );
  sheets.V2_contract_invites.appendRow(rowFor(INVITE_HEADERS, {
    invite_id: 'invite-506-legacy-cancel',
    workspace_id: 'W1',
    contract_id: 'legacy-quick-506',
    room_id: 'R506',
    status: 'pending'
  }));

  const cancelled = api.landlordInitiatedContractCancelBySession_(
    'review-session', 'invite-506-legacy-cancel'
  );

  assert.equal(cancelled.success, true, cancelled.code);
  assert.equal(sheets.V2_contract_invites.rows[0][7], 'cancelled');
  assert.equal(sheets.V2_contracts.rows[0][3], 'cancelled');
}

{
  const { api, sheets } = makeRuntime();
  sheets.V2_contracts = new Sheet(
    ['contract_id', 'workspace_id', 'room_id', 'contract_status', 'status'],
    [['legacy-quick-506', 'W2', 'R506', 'pending_tenant_signature', 'pending']]
  );
  sheets.V2_contract_invites.appendRow(rowFor(INVITE_HEADERS, {
    invite_id: 'invite-506-cross-workspace',
    workspace_id: 'W1',
    contract_id: 'legacy-quick-506',
    room_id: 'R506',
    status: 'pending'
  }));

  const cancelled = api.landlordInitiatedContractCancelBySession_(
    'review-session', 'invite-506-cross-workspace'
  );

  assert.equal(cancelled.success, false);
  assert.equal(cancelled.code, 'CONTRACT_NOT_FOUND');
  assert.equal(sheets.V2_contract_invites.rows[0][7], 'pending');
  assert.equal(sheets.V2_contracts.rows[0][3], 'pending_tenant_signature');
}

{
  const { api, sheets } = makeRuntime();
  sheets.V2_contracts = new Sheet(
    ['contract_id', 'workspace_id', 'room_id', 'contract_status', 'status', 'contract_origin'],
    [['legacy-quick-506', 'W1', 'R506', 'pending_tenant_signature', 'pending', 'tenant_created']]
  );
  sheets.V2_contract_invites.appendRow(rowFor(INVITE_HEADERS, {
    invite_id: 'invite-506-wrong-origin',
    workspace_id: 'W1',
    contract_id: 'legacy-quick-506',
    room_id: 'R506',
    status: 'pending'
  }));

  const reissued = api.landlordInitiatedContractReissueBySession_(
    'review-session', 'invite-506-wrong-origin'
  );
  const cancelled = api.landlordInitiatedContractCancelBySession_(
    'review-session', 'invite-506-wrong-origin'
  );

  assert.equal(reissued.success, false);
  assert.equal(reissued.code, 'CONTRACT_NOT_FOUND');
  assert.equal(cancelled.success, false);
  assert.equal(cancelled.code, 'CONTRACT_NOT_FOUND');
  assert.equal(sheets.V2_contract_invites.rows[0][7], 'pending');
  assert.equal(sheets.V2_contracts.rows[0][3], 'pending_tenant_signature');
}

{
  const { api, sheets } = makeRuntime();
  sheets.V2_contracts = new Sheet(
    ['contract_id', 'workspace_id', 'room_id', 'contract_status', 'status'],
    [['legacy-quick-506', 'W1', 'R506', 'pending_tenant_signature', 'pending']]
  );
  ['invite-506-old', 'invite-506-current'].forEach((inviteId, index) => {
    sheets.V2_contract_invites.appendRow(rowFor(INVITE_HEADERS, {
      invite_id: inviteId,
      workspace_id: 'W1',
      contract_id: 'legacy-quick-506',
      room_id: 'R506',
      status: 'pending',
      created_at: `2026-09-${index + 28}T00:00:00.000Z`
    }));
  });

  const reissued = api.landlordInitiatedContractReissueBySession_(
    'review-session', 'invite-506-old'
  );
  assert.equal(reissued.success, false);
  assert.equal(reissued.code, 'INVITE_STALE');
  assert.deepEqual(sheets.V2_contract_invites.rows.map(row => row[7]), ['pending', 'pending']);
  assert.equal(sheets.V2_contracts.rows[0][3], 'pending_tenant_signature');

  const cancelled = api.landlordInitiatedContractCancelBySession_(
    'review-session', 'invite-506-old'
  );
  assert.equal(cancelled.success, true, cancelled.code);
  assert.deepEqual(sheets.V2_contract_invites.rows.map(row => row[7]), ['cancelled', 'pending']);
  assert.equal(sheets.V2_contracts.rows[0][3], 'pending_tenant_signature');
}

console.log('Phase 163 landlord contract invite retrieval runtime RED/GREEN tests passed.');
