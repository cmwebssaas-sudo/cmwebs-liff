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
  return { api: context, sheets };
}

const input = {
  property_id: 'P1', room_id: 'R202', start_date: '2026-08-17', end_date: '2027-08-16',
  rent_amount: 8500, management_fee: 500, deposit_amount: 18000, payment_day: 10,
  tenant_name: '', tenant_phone: '', tenant_email: ''
};

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

console.log('Phase 163 landlord contract invite retrieval runtime RED/GREEN tests passed.');
