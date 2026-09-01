import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const sourcePath = new URL('../apps-script/V2_CONTRACT_RENEWAL_HISTORY.js', import.meta.url);
const landlordSource = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');
const requestSource = readFileSync(new URL('../apps-script/V2_CONTRACT_REQUESTS.js', import.meta.url), 'utf8');
const signingSubmissionSource = readFileSync(new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js', import.meta.url), 'utf8');
const documentSource = readFileSync(new URL('../apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js', import.meta.url), 'utf8');
assert.equal(existsSync(sourcePath), true, 'renewal history module must exist before runtime tests can run');
const source = readFileSync(sourcePath, 'utf8');
const signingSessionSource = readFileSync(new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../apps-script/V2_API.js', import.meta.url), 'utf8');

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
  electricity_fee_rate: 6,
  equipment_fee_rate: 2,
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
  start_date: '2026-09-30',
  end_date: '2027-09-29',
  term_months: 12,
  rent_amount: 24000,
  management_fee: 500,
  deposit_amount: 48000,
  electricity_fee_rate: 6,
  equipment_fee_rate: 2,
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

const history = context.contractRenewalHistoryBuildReadModel_([
  Object.assign({}, previous, { contract_status: 'renewed' }),
  Object.assign({}, versionTwo, { tenant_id: 'T603', contract_status: 'renewed' }),
  Object.assign({}, versionThree, { tenant_id: 'T603', contract_status: 'active' }),
  Object.assign({}, versionThree, { contract_id: 'OTHER-TENANT', tenant_id: 'OTHER', contract_status: 'active' })
], Object.assign({}, versionThree, { tenant_id: 'T603' }));
assert.deepEqual(history.map(item => item.contract_id), ['C603-2026', 'C603-2027', 'C603-2028']);
assert.equal(history.find(item => item.contract_id === 'C603-2028').is_current, true);
assert.equal(history.every(item => item.read_only), true);
assert.equal(history.every(item => item.contract_family_id === 'C603-2026'), true);

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

{
  class MigrationSheet {
    constructor(headers) {
      this.headers = headers.slice();
    }

    getLastColumn() { return this.headers.length; }

    getRange(_row, column, _height = 1, width = 1) {
      return {
        getValues: () => [this.headers.slice(column - 1, column - 1 + width)],
        getDisplayValues: () => [this.headers.slice(column - 1, column - 1 + width)],
        setValues: values => {
          (values[0] || []).forEach((value, index) => {
            this.headers[column - 1 + index] = value;
          });
        }
      };
    }
  }

  const migrationSheets = {
    V2_contracts: new MigrationSheet(['contract_id']),
    V2_contract_requests: new MigrationSheet(['request_id']),
    V2_contract_documents: new MigrationSheet(['document_id'])
  };
  const migrationContext = {
    Date, Math, Number, String, Object, Array, JSON, RegExp, Error,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => {
        throw new Error('active spreadsheet is unavailable in execution API');
      }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: name => name === 'CMWEBS_SPREADSHEET_ID' ? 'production-sheet-id' : ''
      })
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} })
    },
    runtimeSpreadsheet_: () => ({
      getSheetByName: name => migrationSheets[name] || null
    })
  };
  vm.createContext(migrationContext);
  vm.runInContext(source, migrationContext, { filename: 'V2_CONTRACT_RENEWAL_HISTORY.js' });

  const firstRun = migrationContext.runV2ContractRenewalHistoryProductionMigration();
  assert.equal(firstRun.success, true, firstRun.code);
  assert.ok(firstRun.data.added_headers.contracts.includes('contract_family_id'));
  assert.ok(firstRun.data.added_headers.requests.includes('requested_deposit_amount'));
  assert.deepEqual(plain(firstRun.data.added_headers.documents), ['document_origin', 'source_document_id']);

  const secondRun = migrationContext.runV2ContractRenewalHistoryProductionMigration();
  assert.deepEqual(plain(secondRun.data.added_headers), {
    contracts: [],
    requests: [],
    documents: []
  });
}

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
      setValue: value => {
        if (!this.rows[row - 2]) this.rows[row - 2] = new Array(this.headers.length).fill('');
        this.rows[row - 2][column - 1] = value;
      },
      setValues: values => {
        values.forEach((valuesRow, rowIndex) => {
          if (!this.rows[row - 2 + rowIndex]) this.rows[row - 2 + rowIndex] = new Array(this.headers.length).fill('');
          valuesRow.forEach((value, columnIndex) => { this.rows[row - 2 + rowIndex][column - 1 + columnIndex] = value; });
        });
      }
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
  assert.equal(result.data.contract.start_date, '2026-09-30');
  assert.equal(result.data.contract.end_date, '2027-09-29');
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

{
  const requestHeaders = landlordContractHeaders.concat([
    'renewed_at', 'renewal_request_id', 'terminated_at', 'termination_request_id'
  ]);
  const previous = landlordRowFor(requestHeaders, {
    contract_id: 'C603-2026', workspace_id: 'W1', tenant_id: 'T603', room_id: 'R603',
    start_date: '2025-10-01', end_date: '2026-09-30', rent_amount: 24000,
    management_fee: 500, deposit_amount: 48000, payment_day: 5,
    contract_status: 'active', status: 'active', account_status: 'active'
  });
  const contracts = new Sheet(requestHeaders, [previous]);
  const spreadsheet = { getSheetByName: name => name === 'V2_contracts' ? contracts : null };
  const requestContext = {
    Date, Math, Number, String, Object, Array, JSON, RegExp, Error,
    Utilities: {
      getUuid: () => 'request-uuid',
      formatDate: (value, _timezone, _pattern) => new Date(value).toISOString().slice(0, 10)
    },
    Logger: { log() {} },
    runtimeSnapshotGetValues_: sheet => sheet.getDataRange().getValues()
  };
  vm.createContext(requestContext);
  vm.runInContext(source, requestContext, { filename: 'V2_CONTRACT_RENEWAL_HISTORY.js' });
  vm.runInContext(requestSource, requestContext, { filename: 'V2_CONTRACT_REQUESTS.js' });
  const request = {
    request_id: 'REQ-603-RENEWAL-1',
    request_type: 'renewal',
    contract_id: 'C603-2026',
    approved_start_date: '2026-10-01',
    approved_end_date: '2027-09-30',
    approved_term_months: 12,
    approved_rent_amount: 24000,
    approved_management_fee: 500,
    status: 'approved'
  };
  const result = requestContext.contractRequestApplyCompletedRequestToContract_(spreadsheet, request, 'landlord-line');
  assert.equal(result.success, true, result.code);
  assert.equal(contracts.rows.length, 2);
  assert.equal(contracts.rows[0][requestHeaders.indexOf('end_date')], '2026-09-30');
  assert.equal(contracts.rows[0][requestHeaders.indexOf('rent_amount')], 24000);
  assert.equal(contracts.rows[0][requestHeaders.indexOf('contract_status')], 'renewed');
  assert.notEqual(contracts.rows[1][requestHeaders.indexOf('contract_id')], 'C603-2026');
  assert.equal(contracts.rows[1][requestHeaders.indexOf('renewed_from_contract_id')], 'C603-2026');
  assert.equal(contracts.rows[1][requestHeaders.indexOf('identity_document_mode')], 'optional');
  const firstAppliedId = contracts.rows[1][requestHeaders.indexOf('contract_id')];
  const retry = requestContext.contractRequestApplyCompletedRequestToContract_(spreadsheet, request, 'landlord-line');
  assert.equal(retry.success, true, retry.code);
  assert.equal(retry.data.applied_contract_id, firstAppliedId);
  assert.equal(retry.data.idempotent, true);
  assert.equal(contracts.rows.length, 2);

  const requestRows = requestContext.contractRequestGetObjects_(contracts);
  const currentContract = requestRows.find(row => row.contract_id === firstAppliedId);
  const identity = {
    tenant_id: 'T603',
    tenant_name: '測試房客',
    room_id: 'R603',
    room_name: '603',
    landlord_id: 'L1',
    landlord_name: '房東甲'
  };
  const historyView = requestContext.contractRequestBuildContractHistory_(spreadsheet, currentContract, identity);
  assert.deepEqual(historyView.map(item => item.contract_id), ['C603-2026', firstAppliedId]);
  assert.equal(historyView.find(item => item.contract_id === firstAppliedId).is_current, true);
  assert.equal(historyView.every(item => item.read_only), true);

  requestContext.runtimeSpreadsheet_ = () => spreadsheet;
  requestContext.contractRequestResolveTenantIdentity_ = () => identity;
  requestContext.contractRequestResolveCurrentContract_ = () => currentContract;
  requestContext.contractRequestGetTenantRequests_ = () => [];
  requestContext.contractRequestLogAccess_ = () => {};
  const tenantInit = requestContext.getTenantContractInitByLineUid_('tenant-line');
  assert.equal(tenantInit.success, true, tenantInit.code);
  assert.deepEqual(tenantInit.data.contract_history.map(item => item.contract_id), ['C603-2026', firstAppliedId]);

  const offerContract = {
    start_date: '2025-10-01',
    end_date: '2026-09-30',
    rent_amount: 24000,
    management_fee: 500,
    deposit_amount: 48000,
    payment_day: 5,
    special_offer_enabled: true,
    special_offer_notice_days: 30,
    special_offer_clause: '租約期滿如不再續約，提前30個日曆日通知，免收違約金。'
  };
  const eligibleNotice = requestContext.contractRequestValidateRequestData_(
    'termination',
    { requested_date: '2026-08-31', termination_type: 'non_renewal', move_out_date: '2026-09-30' },
    offerContract
  );
  assert.equal(eligibleNotice.success, true, eligibleNotice.code);
  assert.equal(eligibleNotice.data.special_offer_decision, 'waived');
  assert.equal(eligibleNotice.data.special_offer_days_before_expiry, 30);
  assert.equal(eligibleNotice.data.penalty_status, 'waived');

  const lateNotice = requestContext.contractRequestValidateRequestData_(
    'termination',
    { requested_date: '2026-09-01', termination_type: 'non_renewal', move_out_date: '2026-09-30' },
    offerContract
  );
  assert.equal(lateNotice.success, true, lateNotice.code);
  assert.equal(lateNotice.data.special_offer_decision, 'landlord_review');
  assert.equal(lateNotice.data.special_offer_days_before_expiry, 29);
  assert.equal(lateNotice.data.penalty_status, 'landlord_review');

  const earlyNotice = requestContext.contractRequestValidateRequestData_(
    'termination',
    { requested_date: '2026-08-31', termination_type: 'early_termination', move_out_date: '2026-09-15' },
    offerContract
  );
  assert.equal(earlyNotice.success, true, earlyNotice.code);
  assert.equal(earlyNotice.data.special_offer_decision, 'not_applicable');
  assert.equal(earlyNotice.data.special_offer_applies, false);
  assert.equal(earlyNotice.data.penalty_status, 'pending');

  const eligibleApproval = requestContext.contractRequestValidateLandlordApproval_(
    {
      request_type: 'termination',
      termination_type: 'non_renewal',
      current_end_date: '2026-09-30',
      move_out_date: '2026-09-30',
      special_offer_decision: 'waived'
    },
    { penalty_status: 'charged', penalty_amount: 24000 }
  );
  assert.equal(eligibleApproval.success, true, eligibleApproval.code);
  assert.equal(eligibleApproval.data.penalty_status, 'waived');
  assert.equal(eligibleApproval.data.penalty_amount, 0);

  const reviewWithoutDecision = requestContext.contractRequestValidateLandlordApproval_(
    {
      request_type: 'termination',
      termination_type: 'non_renewal',
      current_end_date: '2026-09-30',
      move_out_date: '2026-09-30',
      special_offer_decision: 'landlord_review'
    },
    {}
  );
  assert.equal(reviewWithoutDecision.success, false);
  assert.equal(reviewWithoutDecision.code, 'PENALTY_DECISION_REQUIRED');

  const reviewedCharge = requestContext.contractRequestValidateLandlordApproval_(
    {
      request_type: 'termination',
      termination_type: 'non_renewal',
      current_end_date: '2026-09-30',
      move_out_date: '2026-09-30',
      special_offer_decision: 'landlord_review'
    },
    { penalty_status: 'charged', penalty_amount: 24000, penalty_note: '房東核准收取' }
  );
  assert.equal(reviewedCharge.success, true, reviewedCharge.code);
  assert.equal(reviewedCharge.data.penalty_status, 'charged');
  assert.equal(reviewedCharge.data.penalty_amount, 24000);
}

{
  const signingContext = {
    Date, Math, Number, String, Object, Array, JSON, RegExp,
    tenantLiffSigningText_: value => String(value == null ? '' : value).trim()
  };
  vm.createContext(signingContext);
  vm.runInContext(source, signingContext, { filename: 'V2_CONTRACT_RENEWAL_HISTORY.js' });
  vm.runInContext(signingSessionSource, signingContext, { filename: 'V2_TENANT_LIFF_SIGNING_SESSION.js' });
  vm.runInContext(signingSubmissionSource, signingContext, { filename: 'V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js' });
  const signingHistoryRows = [
    Object.assign({}, previous, {
      contract_status: 'renewed',
      contract_family_id: 'C603-2026',
      renewal_sequence: 1
    }),
    {
      contract_id: 'C603-2027',
      workspace_id: 'W1',
      tenant_id: 'T603',
      room_id: 'R603',
      start_date: '2026-10-01',
      end_date: '2027-09-30',
      rent_amount: 24000,
      management_fee: 500,
      contract_status: 'pending_tenant_signature',
      signing_mode: 'renewal',
      contract_family_id: 'C603-2026',
      renewal_sequence: 2,
      renewed_from_contract_id: 'C603-2026'
    }
  ];
  const signingHistory = signingContext.tenantLiffSigningContractHistoryView_(
    signingHistoryRows,
    signingHistoryRows[1],
    { tenant_name: '測試房客', room_name: '603' }
  );
  assert.deepEqual(signingHistory.map(item => item.contract_id), ['C603-2026', 'C603-2027']);
  assert.equal(signingHistory.find(item => item.contract_id === 'C603-2027').is_current, true);
  assert.equal(signingHistory.every(item => item.read_only), true);
  const renewalClaims = { workspace_id: 'W1', tenant_id: 'T603', contract_id: 'C603-2027' };
  const signature = [{ workspace_id: 'W1', tenant_id: 'T603', contract_id: 'C603-2027', artifact_type: 'signature', artifact_id: 'SIG-NEW', drive_file_id: 'drive-new', status: 'stored' }];
  const renewalResult = signingContext.tenantContractSigningRequiredArtifacts_(signature, renewalClaims, 'renewal');
  assert.equal(renewalResult.success, true, renewalResult.code);
  assert.equal(renewalResult.data.signature_artifact_id, 'SIG-NEW');
  assert.equal(signingContext.tenantContractSigningRequiredArtifacts_(signature, renewalClaims, 'new_tenant').code, 'REQUIRED_ARTIFACT_MISSING');
  assert.equal(signingContext.tenantContractSigningRequiredArtifacts_([
    { workspace_id: 'W1', tenant_id: 'T603', contract_id: 'C603-2026', artifact_type: 'signature', artifact_id: 'SIG-OLD', drive_file_id: 'drive-old', status: 'stored' }
  ], renewalClaims, 'renewal').code, 'REQUIRED_ARTIFACT_MISSING');
  assert.equal(signingContext.tenantContractSigningRequiredArtifacts_(signature, renewalClaims, 'unknown').code, 'SIGNING_MODE_NOT_READY');
}

{
  const landlordApiContext = { Date, Math, Number, String, Object, Array, JSON, RegExp };
  vm.createContext(landlordApiContext);
  vm.runInContext(source, landlordApiContext, { filename: 'V2_CONTRACT_RENEWAL_HISTORY.js' });
  vm.runInContext(apiSource, landlordApiContext, { filename: 'V2_API.js' });
  const contractRows = [
    {
      contract_id: 'C603-2026', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T603', room_id: 'R603',
      start_date: '2025-10-01', end_date: '2026-09-30', rent_amount: 24000, management_fee: 500,
      contract_status: 'renewed', contract_family_id: 'C603-2026', renewal_sequence: 1
    },
    {
      contract_id: 'C603-2027', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T603', room_id: 'R603',
      start_date: '2026-10-01', end_date: '2027-09-30', rent_amount: 24000, management_fee: 500,
      contract_status: 'active', contract_family_id: 'C603-2026', renewal_sequence: 2, renewed_from_contract_id: 'C603-2026'
    },
    {
      contract_id: 'OTHER-2027', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'OTHER', room_id: 'R604',
      start_date: '2026-10-01', end_date: '2027-09-30', contract_status: 'active', contract_family_id: 'OTHER-2026', renewal_sequence: 2
    }
  ];
  landlordApiContext.runtimeSpreadsheet_ = () => ({ getSheetByName: () => null });
  landlordApiContext.getLandlordHomeByLineUid = () => ({
    success: true,
    data: { landlord_id: 'L1', landlord_name: '房東甲', workspace_id: 'W1', line_user_id: 'landlord-line' }
  });
  landlordApiContext.getSheetObjects_ = sheetName => {
    if (sheetName === 'V2_landlord_tenant_list_view') {
      return [{
        line_user_id: 'landlord-line', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T603',
        tenant_name: '測試房客', room_id: 'R603', room_list: '603', current_contract_id: 'C603-2027',
        tenant_binding_status: 'bound', tenant_account_status: 'active'
      }];
    }
    if (sheetName === 'V2_contracts') return contractRows;
    return [];
  };
  landlordApiContext.logLiffAccess_ = () => {};
  const result = landlordApiContext.getLandlordTenantsByLineUid('landlord-line');
  assert.equal(result.success, true, result.code);
  assert.deepEqual(result.data.tenants[0].contract_history.map(item => item.contract_id), ['C603-2026', 'C603-2027']);
  assert.equal(result.data.tenants[0].contract_history.find(item => item.contract_id === 'C603-2027').is_current, true);
}

{
  const documentHeaders = [
    'document_id', 'workspace_id', 'landlord_id', 'landlord_line_user_id', 'tenant_id', 'contract_id',
    'document_type', 'file_name', 'mime_type', 'byte_size', 'sha256', 'idempotency_key', 'drive_file_id',
    'status', 'created_at', 'created_by_user_id', 'note', 'document_origin', 'source_document_id'
  ];
  const documentSheet = new Sheet(documentHeaders, [
    landlordRowFor(documentHeaders, {
      document_id: 'DOC-FRONT-OLD', workspace_id: 'W1', landlord_id: 'L1', landlord_line_user_id: 'landlord-line',
      tenant_id: 'T603', contract_id: 'C603-2026', document_type: 'identity_front', file_name: 'front.png',
      mime_type: 'image/png', byte_size: 128, sha256: 'hash-front', drive_file_id: 'drive-front', status: 'stored'
    }),
    landlordRowFor(documentHeaders, {
      document_id: 'DOC-BACK-OLD', workspace_id: 'W1', landlord_id: 'L1', landlord_line_user_id: 'landlord-line',
      tenant_id: 'T603', contract_id: 'C603-2026', document_type: 'identity_back', file_name: 'back.png',
      mime_type: 'image/png', byte_size: 128, sha256: 'hash-back', drive_file_id: 'drive-back', status: 'stored'
    })
  ]);
  const contractHeaders = ['contract_id', 'workspace_id', 'landlord_id', 'tenant_id'];
  const contractSheet = new Sheet(contractHeaders, [
    landlordRowFor(contractHeaders, { contract_id: 'C603-2026', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T603' }),
    landlordRowFor(contractHeaders, { contract_id: 'C603-2027', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T603' })
  ]);
  const spreadsheet = {
    getSheetByName: name => name === 'V2_contract_documents' ? documentSheet : (name === 'V2_contracts' ? contractSheet : null),
    insertSheet: () => documentSheet
  };
  const documentContext = {
    Date, Math, Number, String, Object, Array, JSON, RegExp, Error,
    runtimeSpreadsheet_: () => spreadsheet,
    lmResolveLandlord_: () => ({ landlord_id: 'L1', landlord_user_id: 'landlord-user', workspace_id: 'W1' }),
    lmSheetObjects_: sheet => {
      const values = sheet.getDataRange().getValues();
      const headers = values.shift();
      return values.map((row, index) => Object.assign({ _sheet_row: index + 2 }, ...headers.map((header, column) => ({ [header]: row[column] }))));
    },
    lmLogAccess_: () => {},
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { getUuid: (() => { let n = 0; return () => 'doc-reference-' + (++n); })() }
  };
  vm.createContext(documentContext);
  vm.runInContext(documentSource, documentContext, { filename: 'V2_LANDLORD_CONTRACT_DOCUMENTS.js' });
  const result = documentContext.carryForwardLandlordContractDocumentsByLineUid_('landlord-line', 'C603-2026', 'C603-2027');
  assert.equal(result.success, true, result.code);
  assert.equal(result.data.documents.length, 2);
  assert.equal(documentSheet.rows.length, 4);
  assert.equal(documentSheet.rows[2][documentHeaders.indexOf('document_origin')], 'carried_forward');
  assert.equal(documentSheet.rows[2][documentHeaders.indexOf('source_document_id')], 'DOC-FRONT-OLD');
  assert.equal(documentSheet.rows[2][documentHeaders.indexOf('drive_file_id')], 'drive-front');
  assert.equal(documentSheet.rows[0][documentHeaders.indexOf('contract_id')], 'C603-2026');
}
