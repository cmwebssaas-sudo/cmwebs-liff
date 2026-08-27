import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const sourcePath = new URL('../apps-script/V2_CONTRACT_RENEWAL_HISTORY.js', import.meta.url);
const landlordSource = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');
assert.equal(existsSync(sourcePath), true, 'renewal history module must exist before runtime tests can run');
const source = readFileSync(sourcePath, 'utf8');

const context = {
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  RegExp,
  Utilities: {
    getUuid: () => 'renewal-test-uuid'
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'V2_CONTRACT_RENEWAL_HISTORY.js' });

const previous = {
  contract_id: 'C603-2026',
  workspace_id: 'W1',
  tenant_id: 'T603',
  room_id: 'R603',
  start_date: '2025-10-01',
  end_date: '2026-09-30',
  rent_amount: 24000,
  monthly_rent: 24000,
  management_fee: 500,
  monthly_management_fee: 500,
  deposit_amount: 48000,
  other_fixed_fee_amount: 300,
  other_fixed_fee_note: '網路費',
  payment_day: 5,
  monthly_payment_day: 5,
  terms_snapshot_json: '{"pets":false,"quiet_hours":"22:00"}',
  contract_status: 'active',
  special_offer_enabled: true,
  special_offer_notice_days: 30,
  special_offer_clause: '租約期滿如不再續約，提前30個日曆日通知，免收違約金。'
};

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const defaults = context.contractRenewalHistoryBuildDefaults_(previous, {
  now: '2026-08-27T00:00:00.000Z'
});

assert.deepEqual(plain(defaults), {
  start_date: '2026-10-01',
  end_date: '2027-09-30',
  term_months: 12,
  rent_amount: 24000,
  management_fee: 500,
  deposit_amount: 48000,
  other_fixed_fee_amount: 300,
  other_fixed_fee_note: '網路費',
  monthly_payment_day: 5,
  terms_snapshot_json: previous.terms_snapshot_json,
  special_offer_enabled: true,
  special_offer_notice_days: 30,
  special_offer_applies_to: 'expiry_non_renewal',
  special_offer_waiver_type: 'breach_penalty_waived',
  special_offer_clause: '租約期滿如不再續約，提前30個日曆日通知，免收違約金。',
  identity_document_mode: 'optional'
});

const oldFamily = context.contractRenewalHistoryResolveFamily_(previous, []);
assert.deepEqual(plain(oldFamily), {
  contract_family_id: 'C603-2026',
  renewal_sequence: 1
});

const versionTwo = context.contractRenewalHistoryBuildVersionFields_(previous, defaults, {
  contract_id: 'C603-2027'
});
assert.equal(versionTwo.contract_id, 'C603-2027');
assert.equal(versionTwo.contract_family_id, 'C603-2026');
assert.equal(Number(versionTwo.renewal_sequence), 2);
assert.equal(versionTwo.renewed_from_contract_id, 'C603-2026');

const versionThree = context.contractRenewalHistoryBuildVersionFields_(
  Object.assign({}, previous, {
    contract_id: 'C603-2027',
    contract_family_id: 'C603-2026',
    renewal_sequence: 2
  }),
  defaults,
  { contract_id: 'C603-2028' }
);
assert.equal(versionThree.contract_family_id, 'C603-2026');
assert.equal(Number(versionThree.renewal_sequence), 3);
assert.equal(versionThree.renewed_from_contract_id, 'C603-2027');

const offerContract = Object.assign({}, previous, {
  special_offer_enabled: true,
  special_offer_notice_days: 30,
  contract_end_date: '2026-09-30'
});
assert.deepEqual(
  plain(context.contractRenewalHistoryEvaluateNotice_(offerContract, '2026-08-31')),
  {
    applicable: true,
    decision: 'waived',
    notice_date: '2026-08-31',
    contract_end_date: '2026-09-30',
    notice_days: 30,
    days_before_expiry: 30,
    reason: 'NOTICE_PERIOD_MET'
  }
);
assert.equal(
  context.contractRenewalHistoryEvaluateNotice_(offerContract, '2026-09-01').decision,
  'landlord_review'
);
assert.equal(
  context.contractRenewalHistoryEvaluateNotice_(offerContract, '2026-08-31', {
    event: 'early_termination'
  }).applicable,
  false
);

const listed = context.contractRenewalHistoryList_([
  Object.assign({}, previous, { contract_status: 'renewed' }),
  Object.assign({}, versionThree, { contract_status: 'pending_tenant_signature' }),
  Object.assign({}, versionTwo, { contract_status: 'active' })
]);
assert.deepEqual(listed.map(item => item.contract_id), ['C603-2026', 'C603-2027', 'C603-2028']);
assert.equal(listed.filter(item => item.is_current).length, 1);
assert.equal(listed.find(item => item.contract_id === 'C603-2027').is_current, true);
assert.equal(listed.find(item => item.contract_id === 'C603-2026').read_only, true);

const carried = context.contractRenewalHistoryBuildCarriedDocumentReference_({
  document_id: 'DOC-OLD-FRONT',
  workspace_id: 'W1',
  tenant_id: 'T603',
  contract_id: 'C603-2026',
  document_type: 'identity_front',
  file_name: 'id-front.png',
  mime_type: 'image/png',
  sha256: 'hash-old',
  drive_file_id: 'drive-old'
}, 'C603-2027');
assert.deepEqual(plain(carried), {
  contract_id: 'C603-2027',
  document_type: 'identity_front',
  file_name: 'id-front.png',
  mime_type: 'image/png',
  sha256: 'hash-old',
  document_origin: 'carried_forward',
  source_document_id: 'DOC-OLD-FRONT',
  drive_file_id: 'drive-old'
});

console.log('Phase 174 contract renewal history runtime RED/GREEN tests passed.');

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

const landlordContractHeaders = [
  'contract_id', 'workspace_id', 'landlord_id', 'landlord_line_user_id', 'landlord_name',
  'tenant_id', 'tenant_user_id', 'tenant_line_user_id', 'tenant_name', 'tenant_phone', 'tenant_email',
  'property_id', 'property_name', 'property_address', 'room_id', 'room_name',
  'start_date', 'contract_start_date', 'end_date', 'contract_end_date',
  'rent_amount', 'monthly_rent', 'management_fee', 'monthly_management_fee', 'deposit_months',
  'deposit_amount', 'payment_day', 'monthly_payment_day', 'electricity_fee_rate', 'equipment_fee_rate',
  'other_fixed_fee_amount', 'other_fixed_fee_note', 'terms_snapshot_json',
  'contract_status', 'status', 'account_status', 'signing_mode', 'contract_origin', 'invite_id',
  'contract_content', 'contract_version', 'previous_contract_id', 'renewed_from_contract_id',
  'renewed_to_contract_id', 'renewal_request_id', 'contract_family_id', 'renewal_sequence',
  'special_offer_enabled', 'special_offer_notice_days', 'special_offer_applies_to',
  'special_offer_waiver_type', 'special_offer_clause', 'special_offer_decision',
  'special_offer_notice_date', 'special_offer_days_before_expiry', 'special_offer_decision_reason',
  'identity_document_mode', 'tenant_signing_submission_status', 'created_by_user_id',
  'created_by_membership_id', 'created_at', 'updated_at', 'note'
];

const landlordInviteHeaders = [
  'invite_id', 'workspace_id', 'contract_id', 'room_id', 'landlord_user_id', 'landlord_membership_id',
  'claim_code_hash', 'status', 'expires_at', 'claimed_at', 'claimed_line_user_id', 'cancelled_at',
  'created_at', 'updated_at'
];

function landlordRowFor(headers, values) {
  return headers.map(header => values[header] === undefined ? '' : values[header]);
}

function makeLandlordRuntime() {
  const previous = landlordRowFor(landlordContractHeaders, {
    contract_id: 'C603-2026', workspace_id: 'W1', landlord_id: 'L1', landlord_line_user_id: 'landlord-line', landlord_name: '房東甲',
    tenant_id: 'T603', tenant_user_id: 'U603', tenant_line_user_id: 'tenant-line', tenant_name: '測試房客', tenant_phone: '0912345678',
    property_id: 'P1', property_name: '幸福公寓', property_address: '台北市測試路 1 號', room_id: 'R603', room_name: '603',
    start_date: '2025-10-01', contract_start_date: '2025-10-01', end_date: '2026-09-30', contract_end_date: '2026-09-30',
    rent_amount: 24000, monthly_rent: 24000, management_fee: 500, monthly_management_fee: 500, deposit_months: 2,
    deposit_amount: 48000, payment_day: 5, monthly_payment_day: 5, electricity_fee_rate: 5, equipment_fee_rate: 0,
    other_fixed_fee_amount: 300, other_fixed_fee_note: '網路費', terms_snapshot_json: '{"pets":false}',
    contract_status: 'active', status: 'active', account_status: 'active', contract_origin: 'legacy',
    special_offer_enabled: true, special_offer_notice_days: 30, special_offer_clause: '舊條款',
    identity_document_mode: 'required', created_at: '2025-09-01T00:00:00.000Z', updated_at: '2025-09-01T00:00:00.000Z'
  });
  const sheets = {
    V2_properties: new Sheet(['property_id', 'workspace_id', 'landlord_id', 'property_name', 'property_address'], [['P1', 'W1', 'L1', '幸福公寓', '台北市測試路 1 號']]),
    V2_rooms: new Sheet(['room_id', 'workspace_id', 'landlord_id', 'property_id', 'room_name', 'room_status', 'account_status', 'current_contract_id', 'current_tenant_id'], [['R603', 'W1', 'L1', 'P1', '603', 'occupied', 'active', 'C603-2026', 'T603']]),
    V2_users: new Sheet(['user_id', 'workspace_id', 'landlord_id', 'line_user_id', 'role', 'status', 'account_status'], []),
    V2_tenants: new Sheet(['tenant_id', 'tenant_user_id', 'user_id', 'workspace_id', 'landlord_id', 'tenant_line_user_id', 'tenant_name', 'tenant_phone', 'tenant_email', 'property_id', 'room_id', 'current_contract_id', 'tenant_binding_status', 'binding_status', 'account_status', 'tenant_account_status'], []),
    V2_contracts: new Sheet(landlordContractHeaders, [previous]),
    V2_contract_invites: new Sheet(landlordInviteHeaders, [])
  };
  let uuid = 0;
  const context = {
    Date, Math, Number, String, Object, Array, JSON, RegExp,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => 'landlord-renewal-' + (++uuid),
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()].map(byte => byte > 127 ? byte - 256 : byte),
      DigestAlgorithm: { SHA_256: 'SHA_256' }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'V2_CONTRACT_RENEWAL_HISTORY.js' });
  vm.runInContext(landlordSource, context, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });
  return { api: context, sheets, previous };
}

const landlordAccess = {
  success: true,
  line_user_id: 'landlord-line',
  principal_line_user_id: 'landlord-line',
  workspace: { workspace_id: 'W1' },
  user: { user_id: 'landlord-user', name: '房東甲' },
  membership: { membership_id: 'membership-1', role: 'owner' },
  principals: [{ landlord_id: 'L1' }]
};

{
  const { api, sheets, previous } = makeLandlordRuntime();
  const result = api.landlordInitiatedContractCreateRenewal_(landlordAccess, {
    previous_contract_id: 'C603-2026'
  });
  assert.equal(result.success, true, result.code);
  assert.notEqual(result.data.contract.contract_id, 'C603-2026');
  assert.equal(result.data.contract.renewed_from_contract_id, 'C603-2026');
  assert.equal(result.data.contract.contract_family_id, 'C603-2026');
  assert.equal(Number(result.data.contract.renewal_sequence), 2);
  assert.equal(result.data.contract.start_date, '2026-10-01');
  assert.equal(result.data.contract.end_date, '2027-09-30');
  assert.equal(Number(result.data.contract.rent_amount), 24000);
  assert.equal(Number(result.data.contract.management_fee), 500);
  assert.equal(Number(result.data.contract.deposit_amount), 48000);
  assert.equal(Number(result.data.contract.other_fixed_fee_amount), 300);
  assert.equal(Number(result.data.contract.monthly_payment_day), 5);
  assert.equal(result.data.contract.identity_document_mode, 'optional');
  assert.equal(result.data.contract.special_offer_notice_days, 30);
  assert.equal(sheets.V2_contracts.rows.length, 2);
  assert.equal(sheets.V2_contracts.rows[0][landlordContractHeaders.indexOf('end_date')], previous[landlordContractHeaders.indexOf('end_date')]);
  assert.equal(sheets.V2_contracts.rows[0][landlordContractHeaders.indexOf('rent_amount')], previous[landlordContractHeaders.indexOf('rent_amount')]);
  assert.equal(sheets.V2_contracts.rows[0][landlordContractHeaders.indexOf('renewed_to_contract_id')], '');
}
