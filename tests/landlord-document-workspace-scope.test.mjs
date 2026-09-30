import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js', import.meta.url), 'utf8');
function fixture() {
  let driveReads = 0;
  const contracts = { rows: [
    { contract_id: 'C1', tenant_id: 'T1', workspace_id: 'W1', landlord_id: 'L1' },
    { contract_id: 'C2', tenant_id: 'T2', workspace_id: 'W2', landlord_id: 'L1' }
  ] };
  const docs = { rows: ['1', '2'].map(id => ({
    document_id: 'D' + id, contract_id: 'C' + id, tenant_id: 'T' + id,
    workspace_id: 'W' + id, landlord_id: 'L1', landlord_line_user_id: 'OWNER',
    document_type: 'identity_front', file_name: 'front.jpg', mime_type: 'image/jpeg',
    sha256: 'HASH', idempotency_key: 'SAME_KEY', drive_file_id: 'FILE' + id
  })) };
  const context = {
    runtimeSpreadsheet_: () => ({ getSheetByName: name => name === 'V2_contracts' ? contracts : docs }),
    lmResolveLandlord_: () => ({ landlord_id: 'L1', landlord_user_id: 'U1' }),
    workspaceLandlordResolveAccess_: (uid, options) => ({
      success: true, workspace: { workspace_id: options.workspace_id },
      principal_landlord_id: 'L1', principal_line_user_id: uid, user: { user_id: 'U1' }
    }),
    lmSheetObjects_: sheet => sheet.rows,
    lmLogAccess_() {},
    Utilities: {
      getUuid: () => 'NEW', base64Decode: () => [1], base64Encode: () => 'AQ=='
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    DriveApp: { getFileById() {
      driveReads++;
      return { getBlob: () => ({ getBytes: () => [1] }) };
    } }
  };
  vm.runInNewContext(source, context);
  context.ldEnsureContractDocumentsSheet_ = () => docs;
  context.ldComputeSha256Hex_ = () => 'HASH';
  return { context, driveReads: () => driveReads };
}

test('Email document listing is limited to its verified Workspace even with a shared owner', () => {
  const { context } = fixture();
  const result = context.getLandlordContractDocumentsInitByLineUid_('OWNER', '', '', 'W2');
  assert.equal(result.success, true);
  assert.deepEqual(Array.from(result.data.contracts, row => row.contract_id), ['C2']);
  assert.deepEqual(Array.from(result.data.documents, row => row.document_id), ['D2']);
});

test('Email document download rejects another Workspace before reading private Drive data', () => {
  const { context, driveReads } = fixture();
  const denied = context.getLandlordContractDocumentDownloadByLineUid_('OWNER', 'D1', 'W2');
  assert.equal(denied.success, false);
  assert.equal(driveReads(), 0);
  const allowed = context.getLandlordContractDocumentDownloadByLineUid_('OWNER', 'D2', 'W2');
  assert.equal(allowed.success, true);
  assert.equal(driveReads(), 1);
});

test('Email document upload validates contract Workspace and tenant and scopes idempotency', () => {
  const { context } = fixture();
  const upload = (contract, tenant) => context.uploadLandlordContractDocumentByLineUid_(
    'OWNER', contract, tenant, 'identity_front', 'front.jpg', 'image/jpeg', 'AQ==', 'SAME_KEY', '', 'W2'
  );
  assert.equal(upload('C1', 'T1').success, false);
  assert.equal(upload('C2', 'T1').success, false);
  const allowed = upload('C2', 'T2');
  assert.equal(allowed.success, true);
  assert.equal(allowed.data.document_id, 'D2');
});

test('verified Workspace mismatch fails closed', () => {
  const { context } = fixture();
  context.workspaceLandlordResolveAccess_ = () => ({ success: true, workspace: { workspace_id: 'W1' }, principal_landlord_id: 'L1' });
  assert.equal(context.getLandlordContractDocumentsInitByLineUid_('OWNER', '', '', 'W2').success, false);
});
