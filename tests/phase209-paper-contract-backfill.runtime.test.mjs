import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const backfillPath = new URL('../apps-script/V2_LANDLORD_PAPER_CONTRACT_BACKFILL.js', import.meta.url);
const backfillSource = existsSync(backfillPath) ? readFileSync(backfillPath, 'utf8') : '';

const CONTRACT_HEADERS = [
  'contract_id', 'workspace_id', 'landlord_id', 'landlord_line_user_id', 'landlord_name',
  'tenant_id', 'tenant_user_id', 'tenant_line_user_id', 'tenant_name', 'tenant_phone', 'tenant_email',
  'property_id', 'property_name', 'property_address', 'room_id', 'room_name',
  'start_date', 'contract_start_date', 'end_date', 'contract_end_date',
  'rent_amount', 'monthly_rent', 'management_fee', 'monthly_management_fee',
  'deposit_months', 'deposit_amount', 'payment_day', 'monthly_payment_day',
  'electricity_fee_rate', 'equipment_fee_rate', 'contract_status', 'status', 'account_status',
  'signed_at', 'tenant_signed_at', 'tenant_signing_submission_status', 'signing_mode', 'contract_origin',
  'invite_id', 'contract_content', 'contract_version', 'paper_backfill_idempotency_key', 'paper_backfill_payload_hash',
  'created_by_user_id', 'created_by_membership_id', 'created_at', 'updated_at', 'note'
];

const DOCUMENT_HEADERS = [
  'document_id', 'workspace_id', 'landlord_id', 'landlord_line_user_id', 'tenant_id', 'contract_id',
  'document_type', 'file_name', 'mime_type', 'byte_size', 'sha256', 'idempotency_key', 'drive_file_id',
  'status', 'created_at', 'created_by_user_id', 'note', 'document_origin', 'source_document_id'
];

const ROOM_HEADERS = [
  'room_id', 'workspace_id', 'landlord_id', 'property_id', 'property_name', 'room_name',
  'room_status', 'account_status', 'current_contract_id', 'current_tenant_id', 'current_tenant_name'
];

const TENANT_HEADERS = [
  'tenant_id', 'tenant_user_id', 'user_id', 'workspace_id', 'landlord_id', 'landlord_line_user_id',
  'tenant_line_user_id', 'line_user_id', 'tenant_name', 'name', 'tenant_phone', 'phone',
  'tenant_email', 'email', 'property_id', 'property_name', 'room_id', 'room_name', 'room_list',
  'current_contract_id', 'tenant_binding_status', 'binding_status', 'account_status',
  'tenant_account_status', 'created_by_user_id', 'created_by_membership_id', 'created_at', 'updated_at', 'note'
];

const USER_HEADERS = [
  'user_id', 'workspace_id', 'landlord_id', 'line_user_id', 'role', 'name', 'phone', 'email',
  'status', 'account_status', 'active_workspace_id', 'created_by_user_id', 'created_at', 'updated_at', 'note'
];

const PROPERTY_HEADERS = [
  'property_id', 'workspace_id', 'landlord_id', 'property_name', 'property_address', 'account_status'
];

const VIEW_HEADERS = [
  'line_user_id', 'user_id', 'workspace_id', 'landlord_id', 'landlord_name', 'tenant_line_user_id',
  'tenant_user_id', 'tenant_id', 'tenant_name', 'tenant_phone', 'tenant_email', 'tenant_binding_status',
  'property_id', 'property_name', 'room_id', 'room_list', 'tenant_account_status',
  'current_contract_id', 'contract_status', 'contract_start_date', 'contract_end_date', 'created_at', 'updated_at'
];

const PDF_BASE64 = Buffer.from('paper-contract-202', 'utf8').toString('base64');
const ID_FRONT_BASE64 = Buffer.from('id-front-202', 'utf8').toString('base64');
const ID_BACK_BASE64 = Buffer.from('id-back-202', 'utf8').toString('base64');

class FakeSheet {
  constructor(name, headers, rows = []) {
    this.name = name;
    this.headers = headers.slice();
    this.rows = rows.map(row => row.slice());
  }

  getName() { return this.name; }
  getLastColumn() { return this.headers.length; }
  getLastRow() { return this.rows.length + 1; }
  appendRow(row) { this.rows.push(row.slice()); }
  deleteRow(rowNumber) { this.rows.splice(rowNumber - 2, 1); }
  getRange(row, column, numRows = 1, numColumns = this.headers.length) {
    return {
      getValues: () => {
        if (row === 1) return [this.headers.slice(column - 1, column - 1 + numColumns)];
        return this.rows.slice(row - 2, row - 2 + numRows).map(item => item.slice(column - 1, column - 1 + numColumns));
      },
      setValues: values => {
        if (row === 1) {
          this.headers = values[0].slice();
          return;
        }
        values.forEach((value, index) => { this.rows[row - 2 + index] = value.slice(); });
      },
      setValue: value => {
        if (row === 1) this.headers[column - 1] = value;
        else {
          if (!this.rows[row - 2]) this.rows[row - 2] = [];
          this.rows[row - 2][column - 1] = value;
        }
      },
      getValue: () => row === 1 ? this.headers[column - 1] : (this.rows[row - 2] || [])[column - 1]
    };
  }
  getDataRange() {
    return { getValues: () => [this.headers.slice(), ...this.rows.map(row => row.slice())] };
  }
}

function rowFor(headers, values) {
  return headers.map(header => values[header] === undefined ? '' : values[header]);
}

function objects(sheet) {
  return sheet.rows.map((row, index) => {
    const object = { _sheet_row: index + 2 };
    sheet.headers.forEach((header, column) => { object[header] = row[column] === undefined ? '' : row[column]; });
    return object;
  });
}

function makeRuntime(options = {}) {
  const state = {
    now: options.now || '2026-09-03T00:00:00.000Z',
    uuid: 0,
    lineCalls: [],
    driveFiles: [],
    sheets: {
      V2_properties: new FakeSheet('V2_properties', PROPERTY_HEADERS, [rowFor(PROPERTY_HEADERS, {
        property_id: 'P1', workspace_id: 'W1', landlord_id: 'L1', property_name: '測試公寓', property_address: '台北市測試路', account_status: 'active'
      })]),
      V2_rooms: new FakeSheet('V2_rooms', ROOM_HEADERS, [rowFor(ROOM_HEADERS, {
        room_id: 'R202', workspace_id: 'W1', landlord_id: 'L1', property_id: 'P1', property_name: '測試公寓', room_name: '202', room_status: options.roomStatus || 'vacant', account_status: 'active', current_contract_id: options.currentContractId || '', current_tenant_id: '', current_tenant_name: ''
      })]),
      V2_users: new FakeSheet('V2_users', USER_HEADERS, options.users || []),
      V2_tenants: new FakeSheet('V2_tenants', TENANT_HEADERS, options.tenants || []),
      V2_contracts: new FakeSheet('V2_contracts', CONTRACT_HEADERS, options.contracts || []),
      V2_contract_documents: new FakeSheet('V2_contract_documents', DOCUMENT_HEADERS, options.documents || []),
      V2_landlord_tenant_list_view: new FakeSheet('V2_landlord_tenant_list_view', VIEW_HEADERS, []),
      V2_tenant_home_view: new FakeSheet('V2_tenant_home_view', VIEW_HEADERS, [])
    }
  };

  const access = {
    success: true,
    user: { user_id: 'landlord-user-1', name: '房東' },
    membership: { membership_id: 'membership-1' },
    workspace: { workspace_id: 'W1', workspace_name: 'W1' },
    principals: [{ landlord_id: 'L1', landlord_name: '房東' }],
    principal_landlord_id: 'L1',
    principal_line_user_id: 'Ulandlord',
    principal: { landlord_name: '房東' }
  };

  const context = {
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    JSON,
    RegExp,
    Boolean,
    Buffer,
    console,
    isFinite,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => state.sheets[name] || null }) },
    Utilities: {
      getUuid: () => `generated-${++state.uuid}`,
      base64Decode: value => Array.from(Buffer.from(String(value), 'base64')),
      computeDigest: (_algorithm, value) => Array.from(Buffer.from(String(value), 'utf8'))
    },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE' },
      Permission: { NONE: 'NONE' }
    },
    landlordInitiatedContractWithScriptLock_: operation => operation(),
    landlordInitiatedContractAccessFromSession_: (token, policy) => token === 'session-1' && policy === 'contract_write'
      ? access
      : { success: false, code: 'LANDLORD_REVIEW_SESSION_INVALID', message: '房東 session 無效' },
    landlordInitiatedContractSchema_: () => ({ success: true, code: 'OK', data: {
      properties: state.sheets.V2_properties,
      rooms: state.sheets.V2_rooms,
      users: state.sheets.V2_users,
      tenants: state.sheets.V2_tenants,
      contracts: state.sheets.V2_contracts,
      documents: state.sheets.V2_contract_documents,
      landlordTenantListView: state.sheets.V2_landlord_tenant_list_view,
      tenantHomeView: state.sheets.V2_tenant_home_view
    }}),
    landlordInitiatedContractActor_: () => ({ user_id: 'landlord-user-1', membership_id: 'membership-1', name: '房東' }),
    landlordInitiatedContractLandlordId_: () => 'L1',
    landlordInitiatedContractWorkspaceId_: () => 'W1',
    landlordInitiatedContractText_: value => value === undefined || value === null ? '' : String(value).trim(),
    landlordInitiatedContractNormalizePhone_: value => {
      let digits = String(value || '').replace(/\D/g, '');
      return digits.length === 9 && digits.startsWith('9') ? `0${digits}` : digits;
    },
    lmSheetObjects_: sheet => sheet ? objects(sheet) : [],
    sendLineMessage: (...args) => state.lineCalls.push(args),
    pushLineMessage_: (...args) => state.lineCalls.push(args),
    notifyWorkspace_: (...args) => state.lineCalls.push(args),
    storeLandlordContractDocumentForAccess_: (receivedAccess, input) => {
      assert.equal(receivedAccess, access);
      const sheet = state.sheets.V2_contract_documents;
      const existing = objects(sheet).find(row => row.idempotency_key === input.idempotency_key);
      if (existing) {
        return existing.sha256 === input.sha256
          ? { success: true, code: 'IDEMPOTENT', data: { document_id: existing.document_id, document_type: existing.document_type, status: 'stored', idempotent: true } }
          : { success: false, code: 'IDEMPOTENCY_CONFLICT', message: '文件冪等鍵衝突' };
      }
      const documentId = `document-${sheet.rows.length + 1}`;
      sheet.appendRow(rowFor(sheet.headers, {
        document_id: documentId,
        workspace_id: 'W1', landlord_id: 'L1', landlord_line_user_id: 'Ulandlord',
        tenant_id: input.tenant_id, contract_id: input.contract_id,
        document_type: input.document_type, file_name: input.file_name,
        mime_type: input.mime_type, byte_size: input.byte_size,
        sha256: input.sha256, idempotency_key: input.idempotency_key,
        drive_file_id: `private-drive-${documentId}`, status: 'stored',
        created_at: state.now, created_by_user_id: 'landlord-user-1',
        note: input.note, document_origin: 'paper_backfill', source_document_id: ''
      }));
      state.driveFiles.push(documentId);
      return { success: true, code: 'OK', data: { document_id: documentId, document_type: input.document_type, status: 'stored', idempotent: false } };
    },
    removeLandlordContractDocumentForBackfill_: documentId => {
      const sheet = state.sheets.V2_contract_documents;
      const index = objects(sheet).findIndex(row => row.document_id === documentId);
      if (index >= 0) sheet.deleteRow(index + 2);
    }
  };

  vm.createContext(context);
  if (backfillSource) vm.runInContext(backfillSource, context, { filename: 'V2_LANDLORD_PAPER_CONTRACT_BACKFILL.js' });
  return { context, state, access };
}

function baseInput(overrides = {}) {
  return {
    room_id: 'R202',
    property_id: 'P1',
    tenant_name: '五先生',
    tenant_phone: '0912345678',
    tenant_email: 'tenant@example.com',
    start_date: '2026-09-01',
    end_date: '2027-08-31',
    rent_amount: 7500,
    management_fee: 0,
    deposit_months: 2,
    deposit_amount: 15000,
    payment_day: 5,
    electricity_fee_rate: 3,
    equipment_fee_rate: 3.5,
    paper_signed_at: '2026-09-03',
    paper_contract_file: {
      file_name: '202-紙本租約.pdf',
      mime_type: 'application/pdf',
      base64: PDF_BASE64
    },
    note: '現場紙本簽署後補登',
    idempotency_key: 'paper-backfill-202-20260903',
    ...overrides
  };
}

function countRows(runtime) {
  return Object.fromEntries(Object.entries(runtime.state.sheets).map(([name, sheet]) => [name, sheet.rows.length]));
}

function tenantRow(runtime, tenantId) {
  return objects(runtime.state.sheets.V2_tenants).find(row => row.tenant_id === tenantId);
}

function contractRow(runtime, contractId) {
  return objects(runtime.state.sheets.V2_contracts).find(row => row.contract_id === contractId);
}

function roomRow(runtime) {
  return objects(runtime.state.sheets.V2_rooms)[0];
}

assert.equal(typeof makeRuntime, 'function');

{
  const runtime = makeRuntime();
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput());
  assert.equal(result.success, true, result.message || result.code);
  assert.equal(result.data.contract.contract_status, 'active');
  assert.equal(result.data.contract.signing_mode, 'paper_backfill');
  assert.equal(result.data.contract.contract_origin, 'paper_backfill');
  assert.equal(result.data.contract.tenant_signing_submission_status, 'approved');
  assert.equal(result.data.contract.signed_at, '2026-09-03');
  assert.equal(result.data.paper_document.document_type, 'legacy_contract');
  assert.equal(result.data.paper_document.document_origin, 'paper_backfill');
  assert.equal(result.data.paper_document.base64, undefined);
  assert.equal(result.data.paper_document.drive_file_id, undefined);
  assert.equal(runtime.state.sheets.V2_tenants.rows.length, 1);
  assert.equal(runtime.state.sheets.V2_users.rows.length, 1);
  assert.equal(runtime.state.sheets.V2_contracts.rows.length, 1);
  assert.equal(runtime.state.sheets.V2_contract_documents.rows.length, 1);
  assert.equal(roomRow(runtime).current_contract_id, result.data.contract.contract_id);
  assert.equal(roomRow(runtime).current_tenant_id, result.data.tenant.tenant_id);
  assert.equal(runtime.state.lineCalls.length, 0);
  assert.equal(runtime.state.sheets.V2_contract_invites, undefined);
}

{
  const runtime = makeRuntime();
  const before = countRows(runtime);
  const missingFile = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput({ paper_contract_file: null }));
  assert.equal(missingFile.success, false);
  assert.equal(missingFile.code, 'PAPER_CONTRACT_REQUIRED');
  assert.deepEqual(countRows(runtime), before);
}

for (const fileOverride of [
  { mime_type: 'text/plain' },
  { base64: '%%%not-base64%%%' },
  { base64: Buffer.alloc(8 * 1024 * 1024 + 1, 'x').toString('base64') }
]) {
  const runtime = makeRuntime();
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput({ paper_contract_file: { ...baseInput().paper_contract_file, ...fileOverride } }));
  assert.equal(result.success, false);
  assert.match(result.code, /PAPER_CONTRACT|INVALID_FILE/);
  assert.equal(runtime.state.sheets.V2_contracts.rows.length, 0);
  assert.equal(runtime.state.sheets.V2_contract_documents.rows.length, 0);
}

for (const inputOverride of [
  { start_date: '2026-09-04', end_date: '2026-09-03' },
  { idempotency_key: '' },
  { tenant_phone: '0800000000' },
  { room_id: 'R404' }
]) {
  const runtime = makeRuntime();
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput(inputOverride));
  assert.equal(result.success, false);
  assert.equal(runtime.state.sheets.V2_contracts.rows.length, 0);
}

{
  const runtime = makeRuntime({ roomStatus: 'occupied', currentContractId: 'existing-contract' });
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput());
  assert.equal(result.success, false);
  assert.equal(result.code, 'ROOM_ALREADY_OCCUPIED');
}

{
  const runtime = makeRuntime({
    currentContractId: 'existing-contract',
    contracts: [rowFor(CONTRACT_HEADERS, {
      contract_id: 'existing-contract', workspace_id: 'W1', landlord_id: 'L1', room_id: 'R202', tenant_id: 'old-tenant',
      start_date: '2026-01-01', end_date: '2026-12-31', contract_status: 'active'
    })]
  });
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput());
  assert.equal(result.success, false);
  assert.equal(result.code, 'ROOM_ALREADY_OCCUPIED');
}

{
  const runtime = makeRuntime({ contracts: [rowFor(CONTRACT_HEADERS, {
    contract_id: 'old-contract', workspace_id: 'W1', landlord_id: 'L1', room_id: 'R202', tenant_id: 'old-tenant',
    start_date: '2026-09-01', end_date: '2026-09-30', contract_status: 'active'
  })] });
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput());
  assert.equal(result.success, false);
  assert.equal(result.code, 'ROOM_CONTRACT_OVERLAP');
}

{
  const runtime = makeRuntime();
  const first = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput());
  assert.equal(first.success, true, first.message || first.code);
  const before = countRows(runtime);
  const second = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput());
  assert.equal(second.success, true, second.message || second.code);
  assert.equal(second.code, 'IDEMPOTENT');
  assert.deepEqual(countRows(runtime), before);
  const conflict = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput({ rent_amount: 8000 }));
  assert.equal(conflict.success, false);
  assert.equal(conflict.code, 'IDEMPOTENCY_CONFLICT');
  assert.deepEqual(countRows(runtime), before);
}

{
  const existingTenant = rowFor(TENANT_HEADERS, {
    tenant_id: 'tenant-existing', tenant_user_id: 'user-existing', user_id: 'user-existing', workspace_id: 'W1', landlord_id: 'L1',
    tenant_line_user_id: 'Utenant-existing', line_user_id: 'Utenant-existing',
    tenant_name: '既有房客', name: '既有房客', tenant_phone: '0911111111', phone: '0911111111',
    property_id: 'P1', property_name: '測試公寓', room_id: '', room_name: '', account_status: 'active', tenant_account_status: 'active', tenant_binding_status: 'bound', binding_status: 'bound'
  });
  const existingUser = rowFor(USER_HEADERS, {
    user_id: 'user-existing', workspace_id: 'W1', landlord_id: 'L1', line_user_id: 'Utenant-existing', role: 'tenant', name: '既有房客', phone: '0911111111', status: 'active', account_status: 'active'
  });
  const runtime = makeRuntime({ tenants: [existingTenant], users: [existingUser] });
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput({
    tenant_id: 'tenant-existing', tenant_name: '既有房客', tenant_phone: '0911111111', idempotency_key: 'paper-existing-1'
  }));
  assert.equal(result.success, true, result.message || result.code);
  assert.equal(result.data.tenant.tenant_id, 'tenant-existing');
  assert.equal(result.data.tenant.tenant_user_id, 'user-existing');
  assert.equal(runtime.state.sheets.V2_tenants.rows.length, 1);
  assert.equal(runtime.state.sheets.V2_users.rows.length, 1);
  assert.equal(tenantRow(runtime, 'tenant-existing').tenant_line_user_id, 'Utenant-existing');
  assert.equal(tenantRow(runtime, 'tenant-existing').tenant_binding_status, 'bound');
  assert.equal(objects(runtime.state.sheets.V2_users).find(row => row.user_id === 'user-existing').line_user_id, 'Utenant-existing');
}

{
  const runtime = makeRuntime();
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput({
    idempotency_key: 'paper-without-id',
    identity_front_file: null,
    identity_back_file: null
  }));
  assert.equal(result.success, true, result.message || result.code);
  assert.equal(runtime.state.sheets.V2_contract_documents.rows.length, 1);
}

{
  const runtime = makeRuntime();
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput({
    idempotency_key: 'paper-upcoming-1',
    start_date: '2026-09-10',
    end_date: '2027-09-09'
  }));
  assert.equal(result.success, true, result.message || result.code);
  assert.equal(result.data.contract.contract_status, 'upcoming');
  assert.equal(result.data.room.room_status, 'vacant');
  assert.equal(roomRow(runtime).room_status, 'vacant');
  assert.equal(roomRow(runtime).current_contract_id, result.data.contract.contract_id);
}

{
  const runtime = makeRuntime();
  const contracts = runtime.state.sheets.V2_contracts;
  const originalHeaders = contracts.headers.slice();
  contracts.headers = contracts.headers.filter(header => header !== 'paper_backfill_payload_hash');
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput());
  assert.equal(result.success, false);
  assert.equal(result.code, 'PAPER_BACKFILL_SCHEMA_NOT_READY');
  assert.deepEqual(contracts.headers, contracts.headers.filter(header => header !== 'paper_backfill_payload_hash'));
  assert.equal(contracts.headers.length, originalHeaders.length - 1);
  assert.equal(contracts.rows.length, 0);
}

{
  const runtime = makeRuntime();
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput({
    idempotency_key: 'paper-with-id',
    identity_front_file: { file_name: 'id-front.jpg', mime_type: 'image/jpeg', base64: ID_FRONT_BASE64 },
    identity_back_file: { file_name: 'id-back.jpg', mime_type: 'image/jpeg', base64: ID_BACK_BASE64 }
  }));
  assert.equal(result.success, true, result.message || result.code);
  assert.equal(runtime.state.sheets.V2_contract_documents.rows.length, 3);
  assert.deepEqual(
    runtime.state.sheets.V2_contract_documents.rows.map(row => row[DOCUMENT_HEADERS.indexOf('document_type')]).sort(),
    ['identity_back', 'identity_front', 'legacy_contract']
  );
}

{
  const runtime = makeRuntime();
  const result = runtime.context.landlordPaperContractBackfillBySession_('bad-session', baseInput());
  assert.equal(result.success, false);
  assert.equal(result.code, 'LANDLORD_REVIEW_SESSION_INVALID');
  assert.equal(runtime.state.sheets.V2_contracts.rows.length, 0);
}

{
  const runtime = makeRuntime();
  const tenantHomeView = runtime.state.sheets.V2_tenant_home_view;
  tenantHomeView.appendRow = () => { throw new Error('simulated tenant view failure'); };
  const result = runtime.context.landlordPaperContractBackfillBySession_('session-1', baseInput({ idempotency_key: 'paper-view-rollback' }));
  assert.equal(result.success, false);
  assert.equal(result.code, 'PAPER_BACKFILL_WRITE_FAILED');
  assert.equal(runtime.state.sheets.V2_tenants.rows.length, 0);
  assert.equal(runtime.state.sheets.V2_users.rows.length, 0);
  assert.equal(runtime.state.sheets.V2_contracts.rows.length, 0);
  assert.equal(runtime.state.sheets.V2_contract_documents.rows.length, 0);
  assert.equal(runtime.state.sheets.V2_landlord_tenant_list_view.rows.length, 0);
}

console.log('Phase 209 paper contract backfill runtime tests passed.');
