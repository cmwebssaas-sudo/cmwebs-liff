import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const initiatedSource = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');
const renewalHistorySource = readFileSync(new URL('../apps-script/V2_CONTRACT_RENEWAL_HISTORY.js', import.meta.url), 'utf8');
const sessionSource = readFileSync(new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url), 'utf8');
const reviewSource = readFileSync(new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js', import.meta.url), 'utf8');

class Sheet {
  constructor(headers, rows = []) { this.headers = headers.slice(); this.rows = rows.map(row => row.slice()); }
  getLastRow() { return this.rows.length + 1; }
  getLastColumn() { return this.headers.length; }
  getDataRange() { return { getValues: () => [this.headers, ...this.rows] }; }
  appendRow(row) { this.rows.push(row.slice()); }
  getRange(row, column, height = 1, width = 1) {
    const setCell = (targetRow, targetColumn, value) => {
      if (targetRow === 1) this.headers[targetColumn - 1] = value;
      else this.rows[targetRow - 2][targetColumn - 1] = value;
    };
    const values = () => {
      const source = row === 1 ? this.headers : this.rows[row - 2];
      return [source.slice(column - 1, column - 1 + width)];
    };
    return {
      getDisplayValues: values,
      getValues: values,
      setValue: value => setCell(row, column, value),
      setValues: matrix => matrix.forEach((line, rowIndex) => line.forEach((value, columnIndex) => setCell(row + rowIndex, column + columnIndex, value)))
    };
  }
}

const headers = {
  properties: ['property_id', 'workspace_id', 'landlord_id', 'property_name', 'property_address', 'account_status'],
  rooms: ['room_id', 'workspace_id', 'landlord_id', 'property_id', 'room_name', 'room_status', 'account_status', 'current_contract_id', 'current_tenant_id', 'current_tenant_name', 'updated_at'],
  users: ['user_id', 'workspace_id', 'landlord_id', 'line_user_id', 'role', 'status', 'account_status', 'active_workspace_id', 'updated_at'],
  tenants: ['tenant_id', 'tenant_user_id', 'user_id', 'workspace_id', 'landlord_id', 'tenant_line_user_id', 'line_user_id', 'tenant_name', 'name', 'tenant_phone', 'phone', 'tenant_email', 'email', 'property_id', 'property_name', 'room_id', 'room_name', 'current_contract_id', 'tenant_binding_status', 'binding_status', 'account_status', 'tenant_account_status', 'bound_at', 'updated_at'],
  contracts: ['contract_id', 'workspace_id', 'landlord_id', 'landlord_line_user_id', 'landlord_name', 'tenant_id', 'tenant_user_id', 'tenant_line_user_id', 'tenant_name', 'tenant_phone', 'tenant_email', 'property_id', 'property_name', 'property_address', 'room_id', 'room_name', 'start_date', 'contract_start_date', 'end_date', 'contract_end_date', 'rent_amount', 'monthly_rent', 'management_fee', 'monthly_management_fee', 'deposit_amount', 'payment_day', 'monthly_payment_day', 'contract_status', 'status', 'account_status', 'signing_mode', 'contract_origin', 'invite_id', 'contract_content', 'contract_version', 'previous_contract_id', 'renewed_to_contract_id', 'tenant_signed_at', 'tenant_signature_artifact_id', 'tenant_signing_submission_status', 'tenant_signing_submitted_at', 'tenant_signing_reviewed_at', 'tenant_signing_reviewed_by_user_id', 'tenant_signing_reviewed_by_membership_id', 'tenant_signing_review_note', 'created_by_user_id', 'created_by_membership_id', 'created_at', 'updated_at'],
  invites: ['invite_id', 'workspace_id', 'contract_id', 'room_id', 'landlord_user_id', 'landlord_membership_id', 'claim_code_hash', 'status', 'expires_at', 'claimed_at', 'claimed_line_user_id', 'cancelled_at', 'created_at', 'updated_at'],
  artifacts: ['artifact_id', 'workspace_id', 'tenant_id', 'contract_id', 'artifact_type', 'status'],
  landlordView: ['tenant_id', 'workspace_id', 'tenant_user_id', 'tenant_line_user_id', 'tenant_name', 'tenant_phone', 'tenant_binding_status', 'tenant_account_status', 'property_id', 'property_name', 'room_id', 'room_list', 'current_contract_id', 'contract_status', 'contract_start_date', 'contract_end_date', 'updated_at'],
  tenantView: ['tenant_id', 'workspace_id', 'tenant_user_id', 'tenant_line_user_id', 'tenant_name', 'property_id', 'property_name', 'room_id', 'room_name', 'current_contract_id', 'contract_status', 'contract_start_date', 'contract_end_date', 'tenant_binding_status', 'account_status', 'updated_at']
};

function row(headersList, values) { return headersList.map(header => values[header] === undefined ? '' : values[header]); }

const access = {
  success: true,
  line_user_id: 'landlord-line',
  principal_line_user_id: 'landlord-line',
  workspace: { workspace_id: 'W1' },
  user: { user_id: 'landlord-user', landlord_id: 'L1', name: '林房東' },
  membership: { membership_id: 'M1', role: 'owner' },
  principals: [{ landlord_id: 'L1' }]
};

function makeRuntime({ renewal = false, includeViews = true } = {}) {
  const previousContract = {
    contract_id: 'old-contract', workspace_id: 'W1', landlord_id: 'L1', landlord_name: '林房東', tenant_id: 'tenant-existing', tenant_user_id: 'user-existing', tenant_line_user_id: 'existing-line', tenant_name: '既有房客', tenant_phone: '0911111111', property_id: 'P1', property_name: '幸福公寓', property_address: '台北市測試路 1 號', room_id: 'R1', room_name: '603', start_date: '2025-08-01', end_date: '2026-07-31', rent_amount: 22000, management_fee: 1000, deposit_amount: 44000, payment_day: 5, contract_status: 'active', status: 'active', account_status: 'active', signing_mode: 'new_tenant', contract_origin: 'legacy', tenant_signing_submission_status: 'approved', created_at: '2025-08-01T00:00:00.000Z', updated_at: '2025-08-01T00:00:00.000Z'
  };
  const sheets = {
    V2_properties: new Sheet(headers.properties, [row(headers.properties, { property_id: 'P1', workspace_id: 'W1', landlord_id: 'L1', property_name: '幸福公寓', property_address: '台北市測試路 1 號', account_status: 'active' })]),
    V2_rooms: new Sheet(headers.rooms, [row(headers.rooms, { room_id: 'R1', workspace_id: 'W1', landlord_id: 'L1', property_id: 'P1', room_name: '603', room_status: renewal ? 'occupied' : 'vacant', account_status: 'active', current_contract_id: renewal ? 'old-contract' : '', current_tenant_id: renewal ? 'tenant-existing' : '', current_tenant_name: renewal ? '既有房客' : '' })]),
    V2_users: new Sheet(headers.users, renewal ? [row(headers.users, { user_id: 'user-existing', workspace_id: 'W1', landlord_id: 'L1', line_user_id: 'existing-line', role: 'tenant', status: 'active', account_status: 'active', active_workspace_id: 'W1' })] : []),
    V2_tenants: new Sheet(headers.tenants, renewal ? [row(headers.tenants, { tenant_id: 'tenant-existing', tenant_user_id: 'user-existing', user_id: 'user-existing', workspace_id: 'W1', landlord_id: 'L1', tenant_line_user_id: 'existing-line', line_user_id: 'existing-line', tenant_name: '既有房客', name: '既有房客', tenant_phone: '0911111111', phone: '0911111111', property_id: 'P1', property_name: '幸福公寓', room_id: 'R1', room_name: '603', current_contract_id: 'old-contract', tenant_binding_status: 'bound', binding_status: 'bound', account_status: 'active', tenant_account_status: 'active' })] : []),
    V2_contracts: new Sheet(headers.contracts, renewal ? [row(headers.contracts, previousContract)] : []),
    V2_contract_invites: new Sheet(headers.invites),
    V2_contract_artifacts: new Sheet(headers.artifacts),
    V2_landlord_tenant_list_view: new Sheet(headers.landlordView),
    V2_tenant_home_view: new Sheet(headers.tenantView)
  };
  if (!includeViews) {
    delete sheets.V2_landlord_tenant_list_view;
    delete sheets.V2_tenant_home_view;
  }
  const context = {
    Date, Math, Number, String, Object, Array, JSON, RegExp, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null, flush: () => {} }), flush: () => {} },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      getUuid: (() => { let n = 0; return () => 'generated-' + (++n); })(),
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()].map(byte => byte > 127 ? byte - 256 : byte),
      DigestAlgorithm: { SHA_256: 'SHA_256' }
    },
    tenantContractSigningReviewAccessFromSession_: () => ({ success: true, data: { workspace: { workspace_id: 'W1' }, user: { user_id: 'landlord-user' }, membership: { membership_id: 'M1' } } }),
    tenantContractSigningReviewText_: value => String(value == null ? '' : value).trim(),
    tenantContractSigningReviewError_: code => ({ success: false, code }),
    tenantContractSigningReviewPublicResult_: (contract, idempotent) => ({ contract_id: contract.contract_id, contract_status: contract.contract_status, tenant_signing_submission_status: contract.tenant_signing_submission_status, idempotent: idempotent === true }),
    tenantLiffSigningRows_: sheet => {
      if (!sheet || sheet.getLastRow() < 2) return [];
      const values = sheet.getDataRange().getValues();
      const sheetHeaders = values[0].map(value => String(value).trim());
      return values.slice(1).map((data, index) => Object.assign({ _sheet_row: index + 2 }, Object.fromEntries(sheetHeaders.map((header, column) => [header, data[column] == null ? '' : data[column]]))));
    },
    tenantContractSigningRequiredArtifacts_: (artifacts, claims, signingMode) => {
      const required = signingMode === 'new_tenant' ? ['identity_front', 'identity_back', 'signature'] : ['signature'];
      const found = new Set(artifacts.filter(item => item.contract_id === claims.contract_id && item.tenant_id === claims.tenant_id && item.workspace_id === claims.workspace_id && item.status === 'stored').map(item => item.artifact_type));
      return required.every(type => found.has(type)) ? { success: true } : { success: false, code: 'REQUIRED_ARTIFACT_MISSING' };
    },
    pushLineTextMessage_: () => ({ success: true })
  };
  vm.createContext(context);
  vm.runInContext(renewalHistorySource, context, { filename: 'V2_CONTRACT_RENEWAL_HISTORY.js' });
  vm.runInContext(initiatedSource, context, { filename: 'V2_LANDLORD_INITIATED_CONTRACTS.js' });
  vm.runInContext(sessionSource, context, { filename: 'V2_TENANT_LIFF_SIGNING_SESSION.js' });
  vm.runInContext(reviewSource, context, { filename: 'V2_TENANT_CONTRACT_SIGNING_REVIEW.js' });
  context.tenantContractSigningReviewAccessFromSession_ = () => ({ success: true, data: { workspace: { workspace_id: 'W1' }, user: { user_id: 'landlord-user' }, membership: { membership_id: 'M1' } } });
  return { api: context, sheets };
}

function input(previousContractId = '') {
  return { property_id: 'P1', room_id: previousContractId ? '' : 'R1', previous_contract_id: previousContractId, start_date: '2026-08-01', end_date: '2027-07-31', rent_amount: 25000, management_fee: 1000, deposit_amount: 50000, payment_day: 5, tenant_name: previousContractId ? '' : '', tenant_phone: '', tenant_email: '' };
}

function markSubmitted(runtime, contractId, tenantId, mode) {
  const contracts = runtime.api.landlordInitiatedContractRows_(runtime.sheets.V2_contracts);
  const contract = contracts.find(item => item.contract_id === contractId);
  runtime.sheets.V2_contracts.rows[contract._sheet_row - 2][headers.contracts.indexOf('tenant_signing_submission_status')] = 'submitted';
  runtime.sheets.V2_contracts.rows[contract._sheet_row - 2][headers.contracts.indexOf('tenant_signed_at')] = '2026-08-02T00:00:00.000Z';
  const artifactTypes = mode === 'new_tenant' ? ['identity_front', 'identity_back', 'signature'] : ['signature'];
  artifactTypes.forEach(type => runtime.sheets.V2_contract_artifacts.appendRow(row(headers.artifacts, { artifact_id: 'artifact-' + type, workspace_id: 'W1', tenant_id: tenantId, contract_id: contractId, artifact_type: type, status: 'stored' })));
}

{
  const runtime = makeRuntime();
  const created = runtime.api.landlordInitiatedContractCreateNew_(access, input());
  assert.equal(created.success, true, created.code);
  runtime.api.landlordInitiatedContractInviteClaim_(created.data.invite.invite_id, created.data.invite.confirmation_code, 'tenant-line', { tenant_name: '新房客', tenant_phone: '0912345678' });
  markSubmitted(runtime, created.data.contract.contract_id, created.data.contract.tenant_id, 'new_tenant');
  const approved = runtime.api.updateLandlordContractSigningReviewBySessionToken_('server-session', created.data.contract.contract_id, 'approve', '資料完整');
  assert.equal(approved.success, true, approved.code);
  const tenant = runtime.api.landlordInitiatedContractRows_(runtime.sheets.V2_tenants)[0];
  const user = runtime.api.landlordInitiatedContractRows_(runtime.sheets.V2_users)[0];
  const room = runtime.api.landlordInitiatedContractRows_(runtime.sheets.V2_rooms)[0];
  assert.equal(tenant.tenant_binding_status, 'bound');
  assert.equal(tenant.account_status, 'active');
  assert.equal(user.status, 'active');
  assert.equal(user.line_user_id, 'tenant-line');
  assert.equal(room.room_status, 'occupied');
  assert.equal(room.current_contract_id, created.data.contract.contract_id);
  assert.equal(room.current_tenant_id, created.data.contract.tenant_id);
  assert.equal(runtime.sheets.V2_landlord_tenant_list_view.rows.length, 1);
  assert.equal(runtime.sheets.V2_tenant_home_view.rows.length, 1);
  assert.equal(runtime.api.updateLandlordContractSigningReviewBySessionToken_('server-session', created.data.contract.contract_id, 'approve', '').code, 'IDEMPOTENT');
  assert.equal(runtime.api.updateLandlordContractSigningReviewBySessionToken_('server-session', created.data.contract.contract_id, 'reject', '').code, 'REVIEW_ALREADY_FINALIZED');
}

{
  const runtime = makeRuntime({ renewal: true });
  const created = runtime.api.landlordInitiatedContractCreateRenewal_(access, input('old-contract'));
  assert.equal(created.success, true, created.code);
  assert.equal(created.data.contract.contract_status, 'pending_landlord_review');
  const confirmed = runtime.api.landlordInitiatedContractConfirmRenewalReview_(access, created.data.contract.contract_id);
  assert.equal(confirmed.success, true, confirmed.code);
  assert.equal(confirmed.data.contract.contract_status, 'pending_landlord_review');
  assert.equal(confirmed.data.contract.renewal_review_status, 'confirmed');
  assert.equal(confirmed.data.contract.renewal_inquiry_status, 'pending');
  assert.equal(confirmed.data.invite, null);
  const inquiry = runtime.api.landlordInitiatedContractSendRenewalInquiry_(access, created.data.contract.contract_id);
  assert.equal(inquiry.success, true, inquiry.code);
  assert.equal(inquiry.data.contract.renewal_inquiry_status, 'sent');
  const accepted = runtime.api.landlordInitiatedContractUpdateRenewalIntentByLineUid_('existing-line', created.data.contract.contract_id, 'accepted');
  assert.equal(accepted.success, true, accepted.code);
  assert.equal(accepted.data.contract.renewal_tenant_intent, 'accepted');
  const sent = runtime.api.landlordInitiatedContractSendRenewal_(access, created.data.contract.contract_id);
  assert.equal(sent.success, true, sent.code);
  assert.equal(sent.data.contract.contract_status, 'pending_tenant_signature');
  markSubmitted(runtime, created.data.contract.contract_id, 'tenant-existing', 'renewal');
  const approved = runtime.api.updateLandlordContractSigningReviewBySessionToken_('server-session', created.data.contract.contract_id, 'approve', '續約完成');
  assert.equal(approved.success, true, approved.code);
  const contracts = runtime.api.landlordInitiatedContractRows_(runtime.sheets.V2_contracts);
  const oldContract = contracts.find(item => item.contract_id === 'old-contract');
  const newContract = contracts.find(item => item.contract_id === created.data.contract.contract_id);
  const tenant = runtime.api.landlordInitiatedContractRows_(runtime.sheets.V2_tenants)[0];
  const room = runtime.api.landlordInitiatedContractRows_(runtime.sheets.V2_rooms)[0];
  assert.equal(oldContract.contract_status, 'renewed');
  assert.equal(oldContract.status, 'archived');
  assert.equal(oldContract.renewed_to_contract_id, newContract.contract_id);
  assert.equal(newContract.contract_status, 'active');
  assert.equal(room.current_contract_id, newContract.contract_id);
  assert.equal(tenant.current_contract_id, newContract.contract_id);
  assert.equal(runtime.sheets.V2_users.rows.length, 1);
  assert.equal(runtime.sheets.V2_tenants.rows.length, 1);
}

{
  const runtime = makeRuntime({ renewal: true });
  const created = runtime.api.landlordInitiatedContractCreateRenewal_(access, input('old-contract'));
  assert.equal(created.success, true, created.code);
  const oldContractBefore = runtime.sheets.V2_contracts.rows[0].slice();
  const invalidDate = runtime.api.landlordInitiatedContractUpdateRenewalDraft_(access, created.data.contract.contract_id, {
    start_date: '2026-02-30',
    end_date: '2027-08-31'
  });
  assert.equal(invalidDate.code, 'CONTRACT_DRAFT_DATE_INVALID');
  const updated = runtime.api.landlordInitiatedContractUpdateRenewalDraft_(access, created.data.contract.contract_id, {
    start_date: '2026-09-01',
    end_date: '2027-08-31'
  });
  assert.equal(updated.success, true, updated.code);
  assert.equal(updated.data.contract.start_date, '2026-09-01');
  assert.equal(updated.data.contract.contract_start_date, '2026-09-01');
  assert.equal(updated.data.contract.end_date, '2027-08-31');
  assert.equal(updated.data.contract.contract_end_date, '2027-08-31');
  assert.match(updated.data.contract.contract_content, /2026-09-01/);
  assert.match(updated.data.contract.contract_content, /2027-08-31/);
  assert.deepEqual(runtime.sheets.V2_contracts.rows[0], oldContractBefore);

  const confirmed = runtime.api.landlordInitiatedContractConfirmRenewalReview_(access, created.data.contract.contract_id);
  assert.equal(confirmed.success, true, confirmed.code);
  const afterSent = runtime.api.landlordInitiatedContractUpdateRenewalDraft_(access, created.data.contract.contract_id, {
    start_date: '2026-10-01',
    end_date: '2027-09-30'
  });
  assert.equal(afterSent.code, 'CONTRACT_DRAFT_NOT_EDITABLE');
}

{
  const runtime = makeRuntime({ renewal: true });
  const created = runtime.api.landlordInitiatedContractCreateRenewal_(access, input('old-contract'));
  assert.equal(created.success, true, created.code);
  const draft = runtime.api.landlordInitiatedContractRows_(runtime.sheets.V2_contracts).find(item => item.contract_id === created.data.contract.contract_id);
  runtime.sheets.V2_contracts.rows[draft._sheet_row - 2][headers.contracts.indexOf('contract_origin')] = 'tenant_submitted';
  const result = runtime.api.landlordInitiatedContractUpdateRenewalDraft_(access, created.data.contract.contract_id, {
    start_date: '2026-09-01',
    end_date: '2027-08-31'
  });
  assert.equal(result.code, 'CONTRACT_DRAFT_NOT_EDITABLE');
}

{
  const runtime = makeRuntime({ includeViews: false });
  const created = runtime.api.landlordInitiatedContractCreateNew_(access, input());
  runtime.api.landlordInitiatedContractInviteClaim_(created.data.invite.invite_id, created.data.invite.confirmation_code, 'tenant-line', { tenant_name: '新房客', tenant_phone: '0912345678' });
  markSubmitted(runtime, created.data.contract.contract_id, created.data.contract.tenant_id, 'new_tenant');
  const before = runtime.sheets.V2_contracts.rows[0].slice();
  const result = runtime.api.updateLandlordContractSigningReviewBySessionToken_('server-session', created.data.contract.contract_id, 'approve', '');
  assert.equal(result.code, 'CONTRACT_FINALIZATION_SCHEMA_NOT_READY');
  assert.deepEqual(runtime.sheets.V2_contracts.rows[0], before);
}

console.log('Phase 158 landlord-initiated contract activation RED/GREEN tests passed.');
