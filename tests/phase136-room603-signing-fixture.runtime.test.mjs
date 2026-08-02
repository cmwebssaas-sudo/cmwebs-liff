import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../apps-script/V2_ROOM_603_SIGNING_FIXTURE.js', import.meta.url), 'utf8');

class Sheet {
  constructor(headers, rows) { this.headers = headers; this.rows = rows; }
  getLastRow() { return this.rows.length + 1; }
  getLastColumn() { return this.headers.length; }
  getDataRange() { return { getValues: () => [this.headers, ...this.rows] }; }
  getRange(row, column, height = 1, width = 1) { return row === 1 ? { getDisplayValues: () => [this.headers.slice(column - 1, column - 1 + width)] } : { setValue: value => { this.rows[row - 2][column - 1] = value; } }; }
}

const headers = {
  V2_contracts: ['contract_id','workspace_id','tenant_id','room_id','room_name','contract_status','signing_mode','tenant_signed_at','tenant_signature_artifact_id','tenant_signing_submission_status','tenant_signing_submitted_at','updated_at'],
  V2_rooms: ['room_id','workspace_id','room_name','room_status','current_contract_id','current_tenant_id'],
  V2_tenants: ['tenant_id','tenant_user_id','workspace_id','status'],
  V2_users: ['user_id','line_user_id','role','account_status'],
  V2_workspaces: ['workspace_id','account_status','onboarding_status'],
  V2_workspace_members: ['workspace_id','user_id','role','member_status','line_user_id'],
  V2_bills: ['bill_id','bill_status'],
  V2_contract_artifacts: ['workspace_id','tenant_id','contract_id','status']
};

function runtime(options = {}) {
  const sheets = {
    V2_contracts: new Sheet(headers.V2_contracts, [['C000019','W000001','T000020','R000019','603',options.contractStatus || 'terminated','','','','','', '']]),
    V2_rooms: new Sheet(headers.V2_rooms, [['R000019','W000001','603',options.roomStatus || 'vacant','','']]),
    V2_tenants: new Sheet(headers.V2_tenants, [['T000020','U020','W000001','active']]),
    V2_users: new Sheet(headers.V2_users, [['U020','U020','tenant','active'], ['Uowner','Uowner','landlord','active']]),
    V2_workspaces: new Sheet(headers.V2_workspaces, [['W000001','active','completed']]),
    V2_workspace_members: new Sheet(headers.V2_workspace_members, [['W000001','Uowner','owner','active','Uowner']]),
    V2_bills: new Sheet(headers.V2_bills, [['BILL-202607-C000019',options.billStatus || 'cancelled']]),
    V2_contract_artifacts: new Sheet(headers.V2_contract_artifacts, [['W000001','T000020','C000019','stored']])
  };
  const audits = [];
  const context = {
    String, Object, Array, Date, Error, JSON,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] }), flush() {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    getRequiredScriptProperty_: () => 'Uowner',
    workspaceOnboardingComplete_: () => true,
    workspaceRecordOperationActor_: (_access, action, result, meta) => audits.push({ action, result, meta })
  };
  vm.createContext(context); vm.runInContext(source, context);
  return { api: context, sheets, audits };
}

{
  const { api, sheets } = runtime();
  const preview = api.previewRoom603NewTenantSigningFixture();
  assert.equal(preview.success, true); assert.equal(preview.data.dry_run, true);
  assert.equal(sheets.V2_contracts.rows[0][5], 'terminated');
  const result = api.activateRoom603NewTenantSigningFixture();
  assert.equal(result.success, true); assert.equal(sheets.V2_contracts.rows[0][5], 'pending_tenant_signature');
  assert.equal(sheets.V2_contracts.rows[0][6], 'new_tenant');
  assert.equal(sheets.V2_rooms.rows[0][3], 'occupied');
  assert.equal(sheets.V2_contract_artifacts.rows[0][3], 'superseded');
  assert.equal(sheets.V2_bills.rows[0][1], 'cancelled');
  const inspect = api.inspectRoom603SigningFixture();
  assert.equal(inspect.success, true); assert.equal(inspect.data.state.contract_status, 'pending_tenant_signature');
  const repeat = api.activateRoom603NewTenantSigningFixture();
  assert.equal(repeat.success, false); assert.equal(repeat.code, 'FIXTURE_GUARD_FAILED');
}
{
  const { api, sheets } = runtime({ billStatus: 'issued' });
  const result = api.previewRoom603NewTenantSigningFixture();
  assert.equal(result.success, false); assert.equal(result.code, 'FIXTURE_GUARD_FAILED');
  assert.equal(sheets.V2_contracts.rows[0][5], 'terminated');
}
{
  const { api, sheets } = runtime({ contractStatus: 'pending_tenant_signature', roomStatus: 'occupied' });
  sheets.V2_contracts.rows[0][6] = 'new_tenant';
  const result = api.closeRoom603NewTenantSigningFixture();
  assert.equal(result.success, true); assert.equal(sheets.V2_contracts.rows[0][5], 'terminated');
  assert.equal(sheets.V2_rooms.rows[0][3], 'vacant');
}

console.log('Phase 136 Room 603 signing-fixture runtime mocks passed.');
