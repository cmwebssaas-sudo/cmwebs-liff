import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ids = {
  line: 'tenant-line-canonical',
  tenant: 'tenant-canonical',
  user: 'tenant-user-canonical',
  contract: 'contract-canonical',
  workspace: 'workspace-canonical',
  property: 'property-canonical',
  room: 'room-canonical',
  landlord: 'landlord-canonical',
  landlordLine: 'landlord-line-canonical',
  bill: 'bill-canonical'
};

const bill = {
  line_user_id: ids.line,
  tenant_id: ids.tenant,
  contract_id: ids.contract,
  workspace_id: ids.workspace,
  room_id: ids.room,
  room_name: '601',
  bill_id: ids.bill,
  bill_month: '2026-08',
  total_amount: 20281,
  payment_status: 'unpaid',
  bill_status: 'active'
};

const rows = {
  V2_tenants: [{
    tenant_id: ids.tenant,
    tenant_line_user_id: ids.line,
    tenant_user_id: ids.user,
    tenant_name: '謝易玲',
    workspace_id: ids.workspace,
    property_id: ids.property,
    room_id: ids.room,
    landlord_id: ids.landlord,
    account_status: 'active'
  }],
  V2_contracts: [{
    tenant_id: ids.tenant,
    tenant_user_id: ids.user,
    contract_id: ids.contract,
    contract_status: 'active',
    workspace_id: ids.workspace,
    property_id: ids.property,
    room_id: ids.room,
    landlord_id: ids.landlord,
    landlord_line_user_id: ids.landlordLine
  }],
  V2_properties: [{
    property_id: ids.property,
    property_name: '測試物件',
    workspace_id: ids.workspace,
    landlord_id: ids.landlord
  }],
  V2_rooms: [{
    room_id: ids.room,
    room_name: '601',
    workspace_id: ids.workspace,
    property_id: ids.property
  }],
  V2_tenant_home_view: [],
  V2_tenant_bill_view: [
    bill,
    {
      line_user_id: ids.line,
      updated_at: '2026-08-09T00:00:00.000Z'
    }
  ]
};

function sheet(rowsForSheet) {
  const headers = Object.keys(rowsForSheet[0] || {});
  return {
    values: [headers, ...rowsForSheet.map((row) => headers.map((key) => row[key] ?? ''))]
  };
}

const sheets = Object.fromEntries(
  Object.entries(rows).map(([name, sheetRows]) => [name, sheet(sheetRows)])
);
const fixtures = { reports: [], notices: [] };
const context = {
  Boolean,
  Date,
  Error,
  JSON,
  Math,
  Number,
  Object,
  String,
  Utilities: { formatDate: () => '2026-08-09' },
  runtimeSnapshotGetValues_: (value) => value.values,
  runtimeSnapshotGetContext_: () => null,
  runtimeSnapshotSetContext_: () => {},
  runtimeSnapshotRecordAvoidedReads_: () => {},
  runtimeSpreadsheet_: () => ({
    getSheetByName(name) {
      return name === 'V2_payment_reports' ? {} : (sheets[name] || null);
    }
  }),
  getSheetObjects_(name) {
    if (name === 'V2_payment_reports') return fixtures.reports;
    return rows[name] || [];
  },
  workspaceNotifyTeam_(payload) {
    fixtures.notices.push(payload);
    return { success: true, data: { sent_count: 1 } };
  }
};

vm.runInNewContext(
  readFileSync('apps-script/V2_TENANT_RUNTIME_RESOLVER.js', 'utf8'),
  context
);
vm.runInNewContext(
  readFileSync('apps-script/V2_TENANT_PAYMENT_REPORTS.js', 'utf8'),
  context
);
context.tenantPaymentReportAppend_ = (report) => fixtures.reports.push(report);

const identity = context.resolveCanonicalTenantRuntimeByLineUid_(ids.line, {
  include_bill_master: false,
  include_landlord_tenant_list_view: false
});

assert.equal(identity.success, true);
assert.equal(identity.data.workspace_id, ids.workspace);
assert.equal(identity.data.landlord_line_user_id, ids.landlordLine);

const init = context.getTenantPaymentReportInitByLineUid(ids.line);
assert.equal(init.success, true);
assert.equal(init.data.tenant.tenant_id, ids.tenant);
assert.equal(init.data.bills.length, 1);
assert.equal(init.data.bills[0].bill_id, ids.bill);

const result = context.submitTenantPaymentReportByLineUid_(
  ids.line,
  ids.bill,
  '37532',
  '2026-08-09',
  '已匯款'
);

assert.equal(result.success, true);
assert.equal(fixtures.reports.length, 1);
assert.equal(fixtures.reports[0].landlord_id, ids.landlord);
assert.equal(fixtures.reports[0].workspace_id, undefined);
assert.equal(fixtures.notices[0].workspace_id, ids.workspace);
assert.equal(
  fixtures.notices[0].action_url,
  'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-payment-report-review.html'
);

console.log('Phase 145 tenant payment runtime tests passed.');
