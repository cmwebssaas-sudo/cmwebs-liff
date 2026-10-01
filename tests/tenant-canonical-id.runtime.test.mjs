import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function fixture(tenantId, includeTenant = true) {
  const access = {
    success: true, line_user_id: 'fixture-landlord-line', principal_landlord_id: 'L1',
    principal: { landlord_id: 'L1', landlord_name: 'Fixture landlord' },
    principals: [{ landlord_id: 'L1' }], user: { user_id: 'LU1' },
    workspace: { workspace_id: 'W1' }, membership: { membership_id: 'M1' }
  };
  const contract = {
    contract_id: 'C-current', workspace_id: 'W1', landlord_id: 'L1', tenant_id: tenantId,
    tenant_name: 'Fixture tenant', room_id: 'R1', room_name: 'Fixture room',
    start_date: '2026-01-01', end_date: '2099-12-31', contract_status: 'active',
    legacy_signed_pdf_url: 'https://fixture.invalid/contract.pdf'
  };
  const data = {
    properties: [], property_id_map: {}, rooms: [{ room_id: 'R1', account_status: 'active' }],
    tenants: includeTenant ? [{ tenant_id: tenantId, tenant_name: 'Fixture tenant', account_status: 'active' }] : [],
    users: [], bills: [], tenant_view_rows: [], contracts: [contract]
  };
  const documents = ['legacy_contract', 'identity_front', 'identity_back'].map(type => ({
    document_id: 'D-' + type, workspace_id: 'W1', landlord_id: 'L1', tenant_id: tenantId,
    contract_id: 'C-current', document_type: type, file_name: type + '.jpg',
    mime_type: 'image/jpeg', byte_size: 3, status: 'stored'
  }));
  const sheets = {};
  const context = vm.createContext({
    console, Utilities: { formatDate: value => new Date(value).toISOString().slice(0, 10) },
    v2CanonicalBillIsOutstanding_: () => false,
    runtimeSpreadsheet_: () => ({
      getSheetByName: name => sheets[name],
      insertSheet: () => { throw new Error('Unexpected schema write'); }
    }),
    lmSheetObjects_: sheet => sheet.rows
  });
  for (const name of ['V2_CONTRACT_RENEWAL_HISTORY', 'V2_API', 'V2_WORKSPACE_DASHBOARD_NATIVE', 'V2_LANDLORD_CONTRACT_DOCUMENTS']) {
    vm.runInContext(readFileSync(new URL('../apps-script/' + name + '.js', import.meta.url), 'utf8'), context, { filename: name + '.js' });
  }
  const sheet = (headers, rows) => ({
    rows, getLastColumn: () => headers.length,
    getRange: (_row, column, _rows, columns = 1) => ({
      getDisplayValues: () => [headers.slice(column - 1, column - 1 + columns)],
      setValue: () => { throw new Error('Unexpected header write'); },
      setValues: () => { throw new Error('Unexpected header write'); }
    })
  });
  sheets.V2_contracts = sheet(Object.keys(contract), [
    contract,
    { ...contract, workspace_id: 'W2', contract_id: 'C-foreign-workspace' },
    { ...contract, landlord_id: 'L2', contract_id: 'C-foreign-landlord' }
  ]);
  sheets.V2_contract_documents = sheet(Array.from(context.LD_CONTRACT_DOCUMENT_HEADERS_), [
    ...documents,
    { ...documents[0], document_id: 'D-foreign-workspace', workspace_id: 'W2' },
    { ...documents[0], document_id: 'D-foreign-landlord', landlord_id: 'L2' },
    { ...documents[0], document_id: 'D-other-tenant', tenant_id: 'tenant-other', contract_id: 'C-other' }
  ]);
  context.workspaceDashboardExecute_ = (_uid, action, executor) => {
    assert.equal(action, 'landlord_tenants');
    return executor(null, access, data);
  };
  return { context, data, sheets, access };
}

for (const [label, tenantId, includeTenant] of [
  ['generated lowercase ID', 'tenant-fixture-uuid', true],
  ['contract-only fallback', 'tenant-fixture-uuid', false],
  ['existing uppercase ID', 'T000020', true]
]) {
  test('native tenant projection preserves the ' + label + ' for history and document reads', () => {
    const { context, data, sheets } = fixture(tenantId, includeTenant);
    const before = JSON.stringify({ data, sheets });
    const response = context.getWorkspaceLandlordTenantsNativeByLineUid_('fixture-landlord-line');
    assert.equal(response.success, true);
    assert.equal(response.data.tenants.length, 1);
    const tenant = response.data.tenants[0];
    assert.equal(tenant.tenant_id, tenantId, 'lookup-map casing must not replace the stored identity');
    assert.deepEqual(Array.from(tenant.contract_history, item => item.contract_id), ['C-current']);
    const owner = { landlord_id: 'L1', workspace_id: 'W1' };
    const documents = context.ldGetContractDocuments_(owner, '', tenant.tenant_id);
    assert.deepEqual(Array.from(documents, item => item.document_id).sort(), [
      'D-identity_back', 'D-identity_front', 'D-legacy_contract'
    ]);
    const legacy = context.ldGetLegacyContractDocuments_(owner, '', tenant.tenant_id);
    assert.equal(legacy.length, 1);
    assert.equal(legacy[0].contract_id, 'C-current', 'foreign workspace/landlord and unrelated tenant remain excluded');
    assert.equal(JSON.stringify({ data, sheets }), before, 'read projection must not rewrite stored identities or records');
  });
}
