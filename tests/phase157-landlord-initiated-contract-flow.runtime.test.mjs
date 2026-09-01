import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const sourcePath = new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url);
const renewalHistorySource = readFileSync(new URL('../apps-script/V2_CONTRACT_RENEWAL_HISTORY.js', import.meta.url), 'utf8');
const expiryRenewalSource = readFileSync(new URL('../apps-script/V2_CONTRACT_EXPIRY_RENEWALS.js', import.meta.url), 'utf8');
const signingSessionSource = readFileSync(new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url), 'utf8');
const signingSubmissionSource = readFileSync(new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js', import.meta.url), 'utf8');
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
  'renewed_from_contract_id', 'contract_family_id', 'renewal_sequence', 'renewal_request_id',
  'renewal_review_status', 'renewal_review_prepared_at', 'renewal_review_confirmed_at', 'renewal_review_reminded_30d_at',
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

function isoDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const previousContractEndDate = isoDateOffset(1);

function makeRuntime({ withInviteSheet = true, withPrevious = false, previousStatus = 'active' } = {}) {
  const scriptProperties = new Map([
    ['CMWEBS_LINE_LOGIN_CHANNEL_ID', 'channel-1'],
    ['CMWEBS_LIFF_SESSION_HMAC_SECRET', 'session-secret']
  ]);
  const cache = new Map();
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
      start_date: '2025-09-01', contract_start_date: '2025-09-01', end_date: previousContractEndDate, contract_end_date: previousContractEndDate,
      rent_amount: 24000, monthly_rent: 24000, management_fee: 800, monthly_management_fee: 800, deposit_amount: 48000,
      payment_day: 5, monthly_payment_day: 5, contract_status: previousStatus, status: previousStatus, account_status: 'active',
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
  const pushedMessages = [];
  const context = {
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    JSON,
    RegExp,
    console,
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
      computeHmacSha256Signature: (value, key) => [...crypto.createHmac('sha256', String(key)).update(String(value)).digest()].map(byte => byte > 127 ? byte - 256 : byte),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      base64DecodeWebSafe: value => Buffer.from(value, 'base64url'),
      newBlob: value => ({ getDataAsString: () => Buffer.from(value).toString() })
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => scriptProperties.get(key) || null }) },
    CacheService: { getScriptCache: () => ({ put: (key, value) => cache.set(key, value), get: key => cache.get(key) || null, remove: key => cache.delete(key) }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ iss: 'https://access.line.me', aud: 'channel-1', sub: 'new-tenant-line', exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000) }) }) },
    tenantContractSigningReviewText_: value => String(value == null ? '' : value).trim(),
    tenantLiffSigningText_: value => String(value == null ? '' : value).trim(),
    tenantContractSigningReviewError_: code => ({ success: false, code, message: 'contract error' }),
    workspaceResult_: (success, code, message) => ({ success, code, message, data: null }),
    workspaceNotifyTeam_: () => ({ success: true, code: 'OK' }),
    pushLineTextMessage_: (lineUserId, message) => {
      pushedMessages.push({ lineUserId, message });
      return { success: true, code: 'OK' };
    }
  };
  vm.createContext(context);
  vm.runInContext(renewalHistorySource, context, { filename: 'V2_CONTRACT_RENEWAL_HISTORY.js' });
  vm.runInContext(source, context, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });
  vm.runInContext(expiryRenewalSource, context, { filename: 'V2_CONTRACT_EXPIRY_RENEWALS.js' });
  vm.runInContext(signingSessionSource, context, { filename: 'V2_TENANT_LIFF_SIGNING_SESSION.js' });
  context.verifyLandlordContractSigningReviewSessionToken_ = () => ({ success: false, code: 'LANDLORD_REVIEW_SESSION_INVALID' });
  return { api: context, sheets, pushedMessages };
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
  const { api, sheets } = makeRuntime({ withPrevious: true, previousStatus: 'expired' });
  const result = api.landlordInitiatedContractCreateDirectRenewal_(access, {
    previous_contract_id: 'old-contract',
    start_date: '2026-09-01',
    end_date: '2027-08-31',
    rent_amount: 26000,
    management_fee: 1000,
    deposit_amount: 52000,
    payment_day: 5,
    special_offer_enabled: true,
    special_offer_notice_days: 30,
    special_offer_clause: '租約期滿如不再續約，提前30個日曆日通知，免收違約金。'
  });
  assert.equal(result.success, true, result.code);
  assert.equal(result.data.contract.contract_status, 'pending_tenant_signature');
  assert.equal(result.data.contract.signing_mode, 'renewal');
  assert.equal(result.data.contract.previous_contract_id, 'old-contract');
  assert.equal(result.data.contract.contract_version, 'fixed-google-doc-template-1');
  assert.equal(result.data.contract.renewal_review_status, 'confirmed');
  assert.equal(result.data.contract.renewal_inquiry_status, 'manual_direct');
  assert.equal(result.data.contract.renewal_tenant_intent, 'manual_direct');
  assert.equal(result.data.contract.special_offer_enabled, true);
  assert.equal(result.data.contract.special_offer_notice_days, 30);
  assert.match(result.data.contract.contract_content, /提前30個日曆日通知，免收違約金/);
  assert.equal(result.data.invite.invite_id, result.data.contract.invite_id);
  assert.equal(result.data.invite.confirmation_code.length, 6);
  assert.equal(sheets.V2_contracts.rows.length, 2);
  assert.equal(sheets.V2_contracts.rows[0][27], 'expired');
  assert.equal(sheets.V2_contract_invites.rows.length, 1);
}

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
  const { api, sheets, pushedMessages } = makeRuntime({ withPrevious: true });
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
  assert.equal(result.data.contract.contract_status, 'pending_landlord_review');
  assert.equal(result.data.contract.signing_mode, 'renewal');
  assert.equal(result.data.contract.previous_contract_id, 'old-contract');
  assert.equal(result.data.contract.tenant_id, 'tenant-1');
  assert.equal(sheets.V2_users.rows.length, 0);
  assert.equal(sheets.V2_tenants.rows.length, 0);
  assert.equal(sheets.V2_rooms.rows[0][5], 'vacant');
  assert.equal(sheets.V2_contract_invites.rows.length, 0);

  const edited = api.landlordInitiatedContractUpdateRenewalDraft_(
    access,
    result.data.contract.contract_id,
    {
      start_date: '2026-09-01',
      end_date: '2027-08-31',
      rent_amount: 27000,
      management_fee: 1200,
      deposit_amount: 54000,
      payment_day: 8,
      special_offer_enabled: true,
      special_offer_clause: '續約期滿前提前30天通知，免收違約金。'
    }
  );
  assert.equal(edited.success, true, edited.code);
  assert.equal(edited.data.contract.rent_amount, 27000);
  assert.equal(edited.data.contract.management_fee, 1200);
  assert.equal(edited.data.contract.special_offer_enabled, true);
  assert.match(edited.data.contract.contract_content, /提前30天通知，免收違約金/);

  const confirmed = api.landlordInitiatedContractConfirmRenewalReview_(
    access,
    result.data.contract.contract_id
  );
  assert.equal(confirmed.success, true, confirmed.code);
  assert.equal(confirmed.data.contract.contract_status, 'pending_landlord_review');
  assert.equal(confirmed.data.contract.renewal_review_status, 'confirmed');
  assert.equal(confirmed.data.invite, null);
  assert.equal(sheets.V2_contract_invites.rows.length, 0);
  assert.equal(pushedMessages.length, 1);
  assert.equal(pushedMessages[0].lineUserId, 'tenant-line');
  assert.equal(confirmed.data.contract.renewal_inquiry_status, 'sent');
  assert.equal(confirmed.data.next_action, 'tenant_contract_renewal_intent');

  const accepted = api.landlordInitiatedContractUpdateRenewalIntentByLineUid_(
    'tenant-line',
    result.data.contract.contract_id,
    'accepted'
  );
  assert.equal(accepted.success, true, accepted.code);
  assert.equal(accepted.data.intent, 'accepted');
  assert.equal(accepted.data.contract.contract_status, 'pending_tenant_signature');
  assert.equal(sheets.V2_contract_invites.rows.length, 1);
  assert.equal(pushedMessages.length, 2);
  assert.equal(pushedMessages[1].lineUserId, 'tenant-line');
  assert.match(pushedMessages[1].message, /簽署/);

  const duplicateAccepted = api.landlordInitiatedContractUpdateRenewalIntentByLineUid_(
    'tenant-line',
    result.data.contract.contract_id,
    'accepted'
  );
  assert.equal(duplicateAccepted.success, true, duplicateAccepted.code);
  assert.equal(duplicateAccepted.code, 'RENEWAL_INTENT_ALREADY_RECORDED');
  assert.equal(sheets.V2_contract_invites.rows.length, 1);
  assert.equal(pushedMessages.length, 2);
}

{
  const { api, sheets, pushedMessages } = makeRuntime({ withPrevious: true });
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
  const confirmed = api.landlordInitiatedContractConfirmRenewalReview_(access, result.data.contract.contract_id);
  assert.equal(confirmed.success, true, confirmed.code);
  const declined = api.landlordInitiatedContractUpdateRenewalIntentByLineUid_(
    'tenant-line',
    result.data.contract.contract_id,
    'declined'
  );
  assert.equal(declined.success, true, declined.code);
  assert.equal(declined.data.intent, 'declined');
  assert.equal(declined.data.contract.checkout_status, 'pending');
  assert.equal(declined.data.contract.checkout_source, 'tenant_declined');
  assert.equal(declined.data.contract.checkout_move_out_date, previousContractEndDate);
  assert.equal(sheets.V2_contract_invites.rows.length, 0);
  assert.equal(pushedMessages.length, 1);
}

{
  const { api } = makeRuntime({ withPrevious: true });
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
  const confirmed = api.landlordInitiatedContractConfirmRenewalReview_(access, result.data.contract.contract_id);
  assert.equal(confirmed.success, true, confirmed.code);
  const sent = api.landlordInitiatedContractSendRenewal_(access, result.data.contract.contract_id);
  assert.equal(sent.success, false);
  assert.equal(sent.code, 'RENEWAL_TENANT_INTENT_REQUIRED');
}

{
  const { api } = makeRuntime({ withPrevious: true });
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
  const confirmed = api.landlordInitiatedContractConfirmRenewalReview_(access, result.data.contract.contract_id);
  assert.equal(confirmed.success, true, confirmed.code);
  const duplicateReview = api.landlordInitiatedContractConfirmRenewalReview_(access, result.data.contract.contract_id);
  assert.equal(duplicateReview.success, true, duplicateReview.code);
  assert.equal(duplicateReview.code, 'RENEWAL_REVIEW_ALREADY_CONFIRMED');
  assert.equal(duplicateReview.data.contract.renewal_inquiry_status, 'sent');
  assert.equal(duplicateReview.data.next_action, 'tenant_contract_renewal_intent');
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
  const sent = api.landlordInitiatedContractSendRenewal_(access, result.data.contract.contract_id);
  assert.equal(sent.success, false);
  assert.equal(sent.code, 'RENEWAL_REVIEW_REQUIRED');
  assert.equal(sheets.V2_contract_invites.rows.length, 0);
}

{
  const { api, sheets } = makeRuntime({ withPrevious: true });
  const firstRun = api.contractExpiryRenewalRunDaily_();
  assert.equal(firstRun.success, true, firstRun.code);
  assert.equal(firstRun.data.prepared.length, 1);
  assert.equal(sheets.V2_contracts.rows.length, 2);
  assert.equal(sheets.V2_contracts.rows[1][27], 'pending_landlord_review');

  const secondRun = api.contractExpiryRenewalRunDaily_();
  assert.equal(secondRun.success, true, secondRun.code);
  assert.equal(secondRun.data.prepared.length, 0);
  assert.equal(sheets.V2_contracts.rows.length, 2);
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
  assert.equal(api.landlordInitiatedContractIsRequest_({ action: 'landlord_contract_initiate_renewal_direct' }), true);
  assert.equal(api.landlordInitiatedContractIsRequest_({ action: 'landlord_contract_renewal_review_confirm' }), true);
  assert.equal(api.landlordInitiatedContractIsRequest_({ action: 'tenant_contract_sign_submit' }), false);
  const result = api.landlordInitiatedContractHandlePost_(JSON.stringify({ action: 'landlord_contract_initiate_new', session_token: 'invalid' }));
  assert.equal(result.success, false);
  assert.equal(result.code, 'LANDLORD_REVIEW_SESSION_INVALID');
  assert.match(dispatcherSource, /landlordInitiatedContractIsRequest_\(postBody\)/);
  assert.match(dispatcherSource, /landlordInitiatedContractHandlePost_\(postBody\)/);
  assert.match(dispatcherSource, /landlordInitiatedContractReadExchange_/);
  assert.match(dispatcherSource, /landlord_contract_initiated_init/);
  assert.match(dispatcherSource, /landlord_contract_renewal_review_confirm/);
  assert.match(dispatcherSource, /landlord_contract_initiate_renewal_direct/);
  assert.match(dispatcherSource, /landlord_contract_initiated_status/);
  assert.match(dispatcherSource, /tenantLiffSigningIsInviteAuthRequest_\(postBody\)/);
  assert.match(dispatcherSource, /tenantLiffSigningHandleInviteAuthPost_\(postBody\)/);
  assert.match(dispatcherSource, /tenant_contract_invite_auth_status/);
  assert.match(signingSubmissionSource, /tenant_contract_invite_submit/);
  assert.match(landlordAccessSource, /function getWorkspaceLandlordInitiatedContractsInitBySession_/);
  assert.match(landlordAccessSource, /function cancelWorkspaceLandlordInitiatedContractBySession_/);
}

{
  const { api } = makeRuntime();
  assert.equal(typeof api.tenantLiffSigningInviteAuthenticate_, 'function');
  const created = api.landlordInitiatedContractCreateNew_(access, newInput);
  assert.equal(created.success, true, created.code);
  const result = api.tenantLiffSigningInviteAuthenticate_(
    created.data.invite.invite_id,
    created.data.invite.confirmation_code,
    'id-token',
    { tenant_name: '現場房客', tenant_phone: '0912345678', tenant_email: '' }
  );
  assert.equal(result.success, true, result.code);
  assert.equal(result.data.contract.signing_mode, 'new_tenant');
  assert.deepEqual([...result.data.artifact_requirements], ['identity_front', 'identity_back', 'signature']);
  assert.equal(result.data.session_token.split('.').length, 2);
  assert.equal(api.tenantLiffSigningInviteAuthenticate_(
    created.data.invite.invite_id,
    created.data.invite.confirmation_code,
    'id-token',
    { tenant_name: '現場房客', tenant_phone: '0912345678' }
  ).code, 'INVITE_ALREADY_CLAIMED');
}

console.log('Phase 157 landlord-initiated contract runtime RED/GREEN tests passed.');
