import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const sourcePath = new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url);
const dispatcherSource = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');
const landlordAccessSource = readFileSync(new URL('../apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js', import.meta.url), 'utf8');
assert.equal(existsSync(sourcePath), true, 'landlord initiation module must exist before runtime tests can run');
const source = readFileSync(sourcePath, 'utf8');

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
          const incoming = values[0] || [];
          incoming.forEach((value, index) => { this.headers[column - 1 + index] = value; });
        }
      };
    }
    return {
      getValues: () => this.rows.slice(row - 2, row - 2 + height).map(item => item.slice(column - 1, column - 1 + width)),
      getDisplayValues: () => this.rows.slice(row - 2, row - 2 + height).map(item => item.slice(column - 1, column - 1 + width)),
      setValue: value => { this.rows[row - 2][column - 1] = value; },
      setValues: values => { values.forEach((valuesRow, rowIndex) => { valuesRow.forEach((value, columnIndex) => { this.rows[row - 2 + rowIndex][column - 1 + columnIndex] = value; }); }); }
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

function rowFor(headers, values) {
  return headers.map(header => values[header] === undefined ? '' : values[header]);
}

function makeRuntime({ withInviteSheet = true, withPrevious = false } = {}) {
  const properties = new Sheet(
    ['property_id', 'workspace_id', 'landlord_id', 'property_name', 'property_address', 'account_status'],
    [['P1', 'W1', 'L1', '幸福公寓', '台北市測試路 1 號', 'active']]
  );
  const rooms = new Sheet(
    ['room_id', 'workspace_id', 'landlord_id', 'property_id', 'room_name', 'room_status', 'account_status', 'current_contract_id', 'current_tenant_id', 'current_tenant_name'],
    [['R603', 'W1', 'L1', 'P1', '603', 'vacant', 'active', '', '', '']]
  );
  const users = new Sheet(USER_HEADERS, []);
  const tenants = new Sheet(TENANT_HEADERS, []);
  const previous = withPrevious
    ? rowFor(CONTRACT_HEADERS, {
      contract_id: 'old-contract', workspace_id: 'W1', landlord_id: 'L1', landlord_line_user_id: 'landlord-line', landlord_name: '房東甲',
      tenant_id: 'tenant-1', tenant_user_id: 'tenant-user-1', tenant_line_user_id: 'tenant-line', tenant_name: '王小明', tenant_phone: '0912345678',
      property_id: 'P1', property_name: '幸福公寓', property_address: '台北市測試路 1 號', room_id: 'R603', room_name: '603',
      start_date: '2025-09-01', contract_start_date: '2025-09-01', end_date: '2026-08-31', contract_end_date: '2026-08-31',
      rent_amount: 24000, monthly_rent: 24000, management_fee: 800, monthly_management_fee: 800, deposit_amount: 48000,
      payment_day: 5, monthly_payment_day: 5, contract_status: 'active', status: 'active', account_status: 'active',
      signing_mode: '', contract_origin: 'legacy', tenant_binding_status: 'active',
      created_at: '2025-08-01T00:00:00.000Z', updated_at: '2025-08-01T00:00:00.000Z'
    })
    : null;
  const contracts = new Sheet(CONTRACT_HEADERS, previous ? [previous] : []);
  const invites = new Sheet(INVITE_HEADERS, []);
  const sheets = {
    V2_properties: properties,
    V2_rooms: rooms,
    V2_users: users,
    V2_tenants: tenants,
    V2_contracts: contracts
  };
  if (withInviteSheet) sheets.V2_contract_invites = invites;

  let uuid = 0;
  const context = {
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    JSON,
    RegExp,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: name => sheets[name] || null
      })
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} })
    },
    Utilities: {
      getUuid: () => 'uuid-' + (++uuid),
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()].map(byte => byte > 127 ? byte - 256 : byte),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      base64DecodeWebSafe: value => Buffer.from(value, 'base64url'),
      newBlob: value => ({ getDataAsString: () => Buffer.from(value).toString() })
    },
    tenantContractSigningReviewText_: value => String(value == null ? '' : value).trim(),
    tenantLiffSigningText_: value => String(value == null ? '' : value).trim(),
    tenantContractSigningReviewError_: code => ({ success: false, code, message: 'contract error' }),
    workspaceResult_: (success, code, message) => ({ success, code, message, data: null })
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });
  context.verifyLandlordContractSigningReviewSessionToken_ = () => ({ success: false, code: 'LANDLORD_REVIEW_SESSION_INVALID' });
  return { api: context, sheets };
}

const access = {
  success: true,
  line_user_id: 'landlord-line',
  principal_line_user_id: 'landlord-line',
  workspace: { workspace_id: 'W1' },
  user: { user_id: 'landlord-user', name: '房東甲' },
  membership: { membership_id: 'membership-1', role: 'owner' },
  principals: [{ landlord_id: 'L1' }]
};

const newInput = {
  property_id: 'P1',
  room_id: 'R603',
  start_date: '2026-09-01',
  end_date: '2027-08-31',
  rent_amount: 25000,
  management_fee: 1000,
  deposit_amount: 50000,
  payment_day: 5,
  tenant_name: '',
  tenant_phone: '',
  tenant_email: ''
};

{
  const { api, sheets } = makeRuntime();
  const result = api.landlordInitiatedContractCreateNew_(access, newInput);
  assert.equal(result.success, true, result.code);
  assert.equal(result.data.contract.contract_status, 'pending_tenant_signature');
  assert.equal(result.data.contract.signing_mode, 'new_tenant');
  assert.equal(result.data.contract.tenant_binding_status, 'pending_claim');
  assert.match(result.data.contract.contract_content, /租賃契約書/);
  assert.match(result.data.contract.contract_content, /603/);
  assert.equal(sheets.V2_rooms.rows[0][5], 'vacant');
  assert.equal(sheets.V2_rooms.rows[0][7], '');
  assert.equal(sheets.V2_contracts.rows[0][27], 'pending_tenant_signature');
  assert.equal(sheets.V2_tenants.rows[0][20], 'pending');
  assert.equal(result.data.invite.confirmation_code.length, 6);
  assert.equal(result.data.invite.url.includes(result.data.invite.confirmation_code), false);
  assert.equal(sheets.V2_contract_invites.rows[0][6].includes(result.data.invite.confirmation_code), false);
}

{
  const { api, sheets } = makeRuntime({ withPrevious: true });
  const result = api.landlordInitiatedContractCreateRenewal_(access, {
    previous_contract_id: 'old-contract',
    start_date: '2026-09-01',
    end_date: '2027-08-31',
    rent_amount: 26000,
    management_fee: 1000,
    deposit_amount: 52000,
    payment_day: 5
  });
  assert.equal(result.success, true, result.code);
  assert.equal(result.data.contract.contract_status, 'pending_tenant_signature');
  assert.equal(result.data.contract.signing_mode, 'renewal');
  assert.equal(result.data.contract.previous_contract_id, 'old-contract');
  assert.equal(result.data.contract.tenant_id, 'tenant-1');
  assert.equal(sheets.V2_users.rows.length, 0);
  assert.equal(sheets.V2_tenants.rows.length, 0);
  assert.equal(sheets.V2_rooms.rows[0][5], 'vacant');
}

{
  const { api } = makeRuntime({ withInviteSheet: false });
  const result = api.landlordInitiatedContractCreateNew_(access, newInput);
  assert.equal(result.success, false);
  assert.equal(result.code, 'CONTRACT_INVITE_SCHEMA_NOT_READY');
}

{
  const { api } = makeRuntime();
  assert.equal(typeof api.landlordInitiatedContractIsRequest_, 'function');
  assert.equal(api.landlordInitiatedContractIsRequest_({ action: 'landlord_contract_initiate_new' }), true);
  assert.equal(api.landlordInitiatedContractIsRequest_({ action: 'landlord_contract_initiate_renewal' }), true);
  assert.equal(api.landlordInitiatedContractIsRequest_({ action: 'tenant_contract_sign_submit' }), false);
  const result = api.landlordInitiatedContractHandlePost_(JSON.stringify({ action: 'landlord_contract_initiate_new', session_token: 'invalid' }));
  assert.equal(result.success, false);
  assert.equal(result.code, 'LANDLORD_REVIEW_SESSION_INVALID');
  assert.match(dispatcherSource, /landlordInitiatedContractIsRequest_\(postBody\)/);
  assert.match(dispatcherSource, /landlordInitiatedContractHandlePost_\(postBody\)/);
  assert.match(dispatcherSource, /landlord_contract_initiated_init/);
  assert.match(landlordAccessSource, /function getWorkspaceLandlordInitiatedContractsInitBySession_/);
  assert.match(landlordAccessSource, /function cancelWorkspaceLandlordInitiatedContractBySession_/);
}

console.log('Phase 157 landlord-initiated contract runtime RED/GREEN tests passed.');
