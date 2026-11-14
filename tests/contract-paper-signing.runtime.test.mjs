import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// 紙本續約：房東下載待簽 PDF、上傳房客手簽檔案後，續約用與線上核准相同的流程生效。
const sources = ['V2_CONTRACT_RENEWAL_HISTORY.js', 'V2_LANDLORD_INITIATED_CONTRACTS.js', 'V2_CONTRACT_PAPER_SIGNING.js']
  .map(name => [name, readFileSync(new URL('../apps-script/' + name, import.meta.url), 'utf8')]);

class Sheet {
  constructor(headers, rows = []) { this.headers = headers.slice(); this.rows = rows.map(row => row.slice()); }
  getLastRow() { return this.rows.length + 1; }
  getLastColumn() { return this.headers.length; }
  getDataRange() { return { getValues: () => [this.headers, ...this.rows] }; }
  appendRow(row) { this.rows.push(row.slice()); }
  getRange(row, column, height = 1, width = 1) {
    const source = () => (row === 1 ? this.headers : this.rows[row - 2]);
    return {
      getDisplayValues: () => [source().slice(column - 1, column - 1 + width)],
      getValues: () => [source().slice(column - 1, column - 1 + width)],
      setValue: value => { source()[column - 1] = value; },
      setValues: matrix => matrix[0].forEach((value, offset) => { source()[column - 1 + offset] = value; })
    };
  }
}

const H = {
  properties: ['property_id', 'workspace_id', 'landlord_id', 'property_name', 'property_address', 'account_status'],
  rooms: ['room_id', 'workspace_id', 'landlord_id', 'property_id', 'room_name', 'room_status', 'account_status', 'current_contract_id', 'current_tenant_id', 'current_tenant_name', 'updated_at'],
  users: ['user_id', 'workspace_id', 'status', 'account_status'],
  tenants: ['tenant_id', 'user_id', 'tenant_user_id', 'workspace_id', 'tenant_name', 'tenant_line_user_id', 'line_user_id', 'tenant_binding_status', 'binding_status', 'account_status', 'tenant_account_status', 'current_contract_id', 'updated_at'],
  contracts: ['contract_id', 'workspace_id', 'landlord_id', 'tenant_id', 'user_id', 'tenant_user_id', 'tenant_line_user_id', 'tenant_name', 'tenant_phone', 'property_id', 'property_name', 'room_id', 'room_name', 'start_date', 'end_date', 'rent_amount', 'management_fee', 'deposit_amount', 'payment_day', 'contract_status', 'status', 'account_status', 'signing_mode', 'contract_origin', 'invite_id', 'contract_content', 'previous_contract_id', 'renewed_to_contract_id', 'signed_at', 'tenant_signed_at', 'tenant_signing_submission_status', 'tenant_signing_submitted_at', 'tenant_signing_reviewed_at', 'tenant_signing_reviewed_by_user_id', 'tenant_signing_reviewed_by_membership_id', 'tenant_signing_review_note', 'updated_at'],
  invites: ['invite_id', 'workspace_id', 'contract_id', 'room_id', 'status', 'expires_at', 'cancelled_at', 'updated_at'],
  landlordView: ['tenant_id', 'workspace_id', 'current_contract_id', 'contract_status'],
  tenantView: ['tenant_id', 'workspace_id', 'current_contract_id', 'contract_status']
};
const row = (headers, values) => headers.map(header => values[header] === undefined ? '' : values[header]);

const CONTENT = [
  '房屋租賃契約書 ',
  '第一條:甲方將坐落測試路 1 號 403出租予乙方。',
  '【電子簽署證明】 ',
  '簽署狀態：待承租人簽署。 ',
  '簽署時間：待完成 數位軌跡：系統於房客完成簽署後記錄。 ',
  '乙方簽名（線上簽署）：＿＿＿＿＿＿＿＿＿＿（待簽署）',
  '續約優惠條款：租約期滿如不再續約，提前30個日曆日通知，免收違約金。'
].join('\n');

const access = {
  success: true,
  line_user_id: 'landlord-line',
  workspace: { workspace_id: 'W1' },
  user: { user_id: 'landlord-user', landlord_id: 'L1' },
  membership: { membership_id: 'M1', role: 'owner' },
  principals: [{ landlord_id: 'L1' }]
};

// Mirrors the no88 renewals of 2026-11-10: tenant row without workspace_id,
// renewal row without tenant_user_id, still waiting for the tenant.
function setup({ status = 'pending_tenant_signature', submission = 'pending', mode = 'renewal' } = {}) {
  const sheets = {
    V2_properties: new Sheet(H.properties, [row(H.properties, { property_id: 'P1', workspace_id: 'W1', landlord_id: 'L1', property_name: 'no88', account_status: 'active' })]),
    V2_rooms: new Sheet(H.rooms, [row(H.rooms, { room_id: 'R1', workspace_id: 'W1', landlord_id: 'L1', property_id: 'P1', room_name: '403', room_status: 'occupied', account_status: 'active', current_contract_id: 'C-old', current_tenant_id: 'T2' })]),
    V2_users: new Sheet(H.users, [row(H.users, { user_id: 'U4', workspace_id: '', status: 'active' })]),
    V2_tenants: new Sheet(H.tenants, [row(H.tenants, { tenant_id: 'T2', user_id: 'U4', workspace_id: '', tenant_name: '黃先生', tenant_line_user_id: 'line-T2', current_contract_id: 'C-old', tenant_binding_status: 'bound', account_status: 'active' })]),
    V2_contracts: new Sheet(H.contracts, [
      row(H.contracts, { contract_id: 'C-old', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T2', user_id: 'U4', tenant_line_user_id: 'line-T2', tenant_name: '黃先生', room_id: 'R1', room_name: '403', contract_status: 'active', status: 'active', account_status: 'active' }),
      row(H.contracts, { contract_id: 'C-new', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T2', tenant_line_user_id: 'line-T2', tenant_name: '黃先生', room_id: 'R1', room_name: '403', contract_status: status, status: 'pending', account_status: 'pending', signing_mode: mode, contract_origin: 'landlord_initiated', invite_id: 'INV1', contract_content: CONTENT, previous_contract_id: 'C-old', tenant_signing_submission_status: submission })
    ]),
    V2_contract_invites: new Sheet(H.invites, [row(H.invites, { invite_id: 'INV1', workspace_id: 'W1', contract_id: 'C-new', room_id: 'R1', status: 'pending', expires_at: '2026-11-11T13:00:00.000Z' })]),
    V2_landlord_tenant_list_view: new Sheet(H.landlordView),
    V2_tenant_home_view: new Sheet(H.tenantView)
  };
  const documents = [];
  const removed = [];
  const pdfTexts = [];
  let storeFailsAt = 0;
  const context = {
    Date, Math, Number, String, Object, Array, JSON, RegExp, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] || null }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      getUuid: (() => { let n = 0; return () => 'uuid-' + (++n); })(),
      computeDigest: (_a, value) => [...crypto.createHash('sha256').update(String(value)).digest()].map(b => b > 127 ? b - 256 : b),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      formatDate: () => '2026-11-14'
    },
    DocumentApp: {
      HorizontalAlignment: { CENTER: 'CENTER' },
      create: () => {
        const lines = [];
        const paragraph = { setFontSize: () => paragraph, setAlignment: () => paragraph, setBold: () => paragraph };
        const body = {
          setMarginTop: () => body, setMarginBottom: () => body, setMarginLeft: () => body, setMarginRight: () => body,
          appendParagraph: text => { lines.push(text); return paragraph; },
          getChild: () => ({ removeFromParent: () => {} })
        };
        return { getId: () => 'tmp-doc', getBody: () => body, saveAndClose: () => pdfTexts.push(lines.join('\n')) };
      }
    },
    DriveApp: { getFileById: () => ({ getAs: () => ({ getBytes: () => [37, 80, 68, 70] }), setTrashed: () => {} }) },
    storeLandlordContractDocumentForAccess_: (_access, input) => {
      if (storeFailsAt && documents.length + 1 === storeFailsAt) return { success: false, code: 'DOCUMENT_WRITE_FAILED' };
      const document = Object.assign({ document_id: 'doc-' + (documents.length + 1), status: 'stored', landlord_id: 'L1', workspace_id: 'W1' }, input);
      documents.push(document);
      return { success: true, data: { document_id: document.document_id, file_name: input.file_name, idempotent: false } };
    },
    ldEnsureContractDocumentsSheet_: () => ({}),
    ldFindDocumentByIdempotency_: (_sheet, landlordId, contractId, tenantId, type, key, workspaceId) => documents.find(d =>
      d.landlord_id === landlordId && d.contract_id === contractId && d.tenant_id === tenantId && d.document_type === type && d.idempotency_key === key && d.workspace_id === workspaceId) || null,
    removeLandlordContractDocumentForBackfill_: id => { removed.push(id); const at = documents.findIndex(d => d.document_id === id); if (at >= 0) documents.splice(at, 1); return true; }
  };
  vm.createContext(context);
  sources.forEach(([name, source]) => vm.runInContext(source, context, { filename: name }));
  const rows = name => context.landlordInitiatedContractRows_(sheets[name]);
  return { api: context, sheets, rows, documents, removed, pdfTexts, failStoreAt: n => { storeFailsAt = n; } };
}

const upload = (files = 2, key = 'paper-key-0001') => ({
  contract_id: 'C-new', paper_signed_at: '2026-11-13', idempotency_key: key,
  files: Array.from({ length: files }, (_, i) => ({ file_name: 'page' + (i + 1) + '.jpg', mime_type: 'image/jpeg', base64: 'AAAA' }))
});

test('download builds a paper version of the stored contract text once', () => {
  const runtime = setup();
  const first = runtime.api.contractPaperSigningByAccess_(access, 'landlord_contract_paper_signing_document', { contract_id: 'C-new' });
  assert.equal(first.success, true, first.code);
  const text = runtime.pdfTexts[0];
  assert.match(text, /第一條:甲方將坐落測試路 1 號 403出租予乙方/);
  assert.match(text, /乙方簽名：＿+　　簽署日期：　　年　　月　　日/);
  assert.match(text, /續約優惠條款/);
  assert.doesNotMatch(text, /電子簽署證明|線上簽署|簽署狀態：|數位軌跡/);
  assert.equal(runtime.documents[0].document_type, 'paper_unsigned_contract');
  assert.equal(runtime.rows('V2_contracts')[1].contract_content, CONTENT, 'stored contract text is unchanged');

  const second = runtime.api.contractPaperSigningByAccess_(access, 'landlord_contract_paper_signing_document', { contract_id: 'C-new' });
  assert.equal(second.code, 'IDEMPOTENT');
  assert.equal(second.data.document_id, first.data.document_id);
  assert.equal(runtime.pdfTexts.length, 1);
});

test('upload stores the signed pages and activates the legacy-tenant renewal', () => {
  const runtime = setup();
  const result = runtime.api.contractPaperSigningByAccess_(access, 'landlord_contract_paper_signing_upload', upload(2));
  assert.equal(result.success, true, result.code);
  const [previous, renewal] = runtime.rows('V2_contracts');
  assert.equal(previous.contract_status, 'renewed');
  assert.equal(previous.renewed_to_contract_id, 'C-new');
  assert.equal(renewal.contract_status, 'active');
  assert.equal(renewal.tenant_signing_submission_status, 'approved');
  assert.equal(renewal.tenant_signed_at, '2026-11-13');
  assert.match(renewal.tenant_signing_review_note, /^紙本簽署：/);
  assert.equal(runtime.rows('V2_contract_invites')[0].status, 'cancelled');
  assert.equal(runtime.rows('V2_tenants')[0].current_contract_id, 'C-new');
  assert.equal(runtime.rows('V2_rooms')[0].current_contract_id, 'C-new');
  assert.deepEqual(runtime.documents.map(d => d.document_type), ['paper_signed_contract', 'paper_signed_contract']);

  const again = runtime.api.contractPaperSigningByAccess_(access, 'landlord_contract_paper_signing_upload', upload(2));
  assert.equal(again.code, 'IDEMPOTENT', 'a double tap after success reports done');
  assert.equal(runtime.documents.length, 2);
});

test('upload is refused, with nothing stored, when the renewal cannot be paper-signed', () => {
  for (const [options, code] of [
    [{ submission: 'submitted' }, 'TENANT_ALREADY_SIGNED_ONLINE'],
    [{ status: 'pending_landlord_review' }, 'CONTRACT_NOT_PAPER_SIGNABLE'],
    [{ mode: 'new_tenant' }, 'PAPER_SIGNING_RENEWAL_ONLY']
  ]) {
    const runtime = setup(options);
    const result = runtime.api.contractPaperSigningByAccess_(access, 'landlord_contract_paper_signing_upload', upload(1));
    assert.equal(result.code, code);
    assert.equal(runtime.documents.length, 0);
  }
  const runtime = setup();
  assert.equal(runtime.api.contractPaperSigningByAccess_(access, 'landlord_contract_paper_signing_upload', Object.assign(upload(1), { paper_signed_at: '2026-12-01' })).code, 'INVALID_PAPER_SIGNED_DATE');
  assert.equal(runtime.api.contractPaperSigningByAccess_(access, 'landlord_contract_paper_signing_upload', upload(11)).code, 'PAPER_FILES_REQUIRED');
  const otherWorkspace = Object.assign({}, access, { workspace: { workspace_id: 'W2' } });
  assert.equal(runtime.api.contractPaperSigningByAccess_(otherWorkspace, 'landlord_contract_paper_signing_upload', upload(1)).code, 'CONTRACT_NOT_FOUND');
});

test('stored pages are removed when activation fails or a later page fails', () => {
  const runtime = setup();
  runtime.sheets.V2_contracts.rows[0][H.contracts.indexOf('contract_status')] = 'terminated';
  const result = runtime.api.contractPaperSigningByAccess_(access, 'landlord_contract_paper_signing_upload', upload(2));
  assert.equal(result.success, false);
  assert.deepEqual(runtime.removed, ['doc-1', 'doc-2']);
  assert.equal(runtime.rows('V2_contracts')[1].contract_status, 'pending_tenant_signature');
  assert.equal(runtime.rows('V2_contract_invites')[0].status, 'pending');

  const partial = setup();
  partial.failStoreAt(2);
  assert.equal(partial.api.contractPaperSigningByAccess_(access, 'landlord_contract_paper_signing_upload', upload(3)).success, false);
  assert.deepEqual(partial.removed, ['doc-1']);
});
