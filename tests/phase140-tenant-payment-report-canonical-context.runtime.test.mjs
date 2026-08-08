import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CANONICAL_CONTEXT = {
  line_user_id: 'tenant-line-canonical',
  tenant_id: 'tenant-canonical',
  tenant_user_id: 'tenant-user-canonical',
  tenant_name: 'Canonical Tenant',
  contract_id: 'contract-canonical',
  workspace_id: 'workspace-canonical',
  property_id: 'property-canonical',
  property_name: 'Canonical Property',
  room_id: 'room-canonical',
  room_name: '506',
  landlord_id: 'landlord-canonical',
  landlord_line_user_id: 'landlord-line-canonical'
};

function canonicalBill(overrides = {}) {
  return {
    line_user_id: CANONICAL_CONTEXT.line_user_id,
    tenant_id: CANONICAL_CONTEXT.tenant_id,
    contract_id: CANONICAL_CONTEXT.contract_id,
    workspace_id: CANONICAL_CONTEXT.workspace_id,
    room_id: CANONICAL_CONTEXT.room_id,
    room_name: '506',
    bill_id: 'bill-canonical',
    bill_month: '2026-08',
    total_amount: 12345,
    payment_status: 'unpaid',
    bill_status: 'active',
    ...overrides
  };
}

function createRuntime(options = {}) {
  const fixtures = {
    appendedReports: [],
    teamNotifications: [],
    resolverCalls: 0
  };
  const rowsBySheet = {
    V2_tenant_bill_view: [
      options.bill || canonicalBill()
    ],
    V2_payment_reports: options.reports || []
  };
  const context = {
    Boolean,
    Date,
    Error,
    JSON,
    Math,
    Number,
    Object,
    String,
    Utilities: {
      formatDate() {
        return '2026-08-08';
      }
    },
    getSheetObjects_(sheetName) {
      if (sheetName === 'V2_landlord_tenant_list_view') {
        throw new Error('compatibility view is unavailable');
      }

      return rowsBySheet[sheetName] || [];
    },
    getTenantHomeByLineUid() {
      return {
        success: true,
        data: {
          tenant_id: 'view-tenant-id',
          tenant_name: 'View Tenant'
        }
      };
    },
    resolveCanonicalTenantRuntimeByLineUid_(lineUserId, resolverOptions) {
      fixtures.resolverCalls += 1;
      fixtures.resolverLineUserId = lineUserId;
      fixtures.resolverOptions = resolverOptions;
      return options.resolverResult || {
        success: true,
        code: 'OK',
        message: '房客 runtime 身份解析成功',
        data: CANONICAL_CONTEXT
      };
    },
    runtimeSpreadsheet_() {
      return {
        getSheetByName(name) {
          return name === 'V2_payment_reports' ? {} : null;
        }
      };
    },
    v2CanonicalBillIsVoided_(bill) {
      return bill.bill_status === 'cancelled' || bill.bill_status === 'voided';
    },
    workspaceNotifyTeam_(payload) {
      fixtures.teamNotifications.push(payload);
      return { success: true, data: { sent_count: 1 } };
    }
  };
  const source = fs.readFileSync('apps-script/V2_TENANT_PAYMENT_REPORTS.js', 'utf8');

  vm.runInNewContext(source, context);
  context.tenantPaymentReportAppend_ = (report) => {
    fixtures.appendedReports.push(report);
  };

  return {
    fixtures,
    submit: context.submitTenantPaymentReportByLineUid_
  };
}

function submit(runtime) {
  return runtime.submit(
    CANONICAL_CONTEXT.line_user_id,
    'bill-canonical',
    '12345',
    '2026-08-08',
    'canonical context test'
  );
}

{
  const runtime = createRuntime();
  const result = submit(runtime);

  assert.equal(result.success, true);
  assert.equal(result.code, 'OK');
  assert.equal(runtime.fixtures.appendedReports.length, 1);
  assert.equal(runtime.fixtures.resolverCalls, 1);
  assert.equal(runtime.fixtures.resolverLineUserId, CANONICAL_CONTEXT.line_user_id);
  assert.equal(runtime.fixtures.resolverOptions.include_bill_master, false);
}

{
  const runtime = createRuntime();
  const result = submit(runtime);
  const report = runtime.fixtures.appendedReports[0];
  const notice = runtime.fixtures.teamNotifications[0];

  assert.equal(result.success, true);
  assert.equal(report.landlord_id, 'landlord-canonical');
  assert.equal(report.landlord_line_user_id, 'landlord-line-canonical');
  assert.equal(report.tenant_id, 'tenant-canonical');
  assert.equal(report.tenant_user_id, 'tenant-user-canonical');
  assert.equal(report.room_id, 'room-canonical');
  assert.equal(notice.workspace_id, 'workspace-canonical');
  assert.equal(notice.landlord_id, 'landlord-canonical');
  assert.equal(notice.fallback_line_user_id, 'landlord-line-canonical');
}

for (const [field, conflictingValue] of [
  ['tenant_id', 'tenant-conflict'],
  ['contract_id', 'contract-conflict'],
  ['room_id', 'room-conflict'],
  ['workspace_id', 'workspace-conflict']
]) {
  const runtime = createRuntime({
    bill: canonicalBill({ [field]: conflictingValue })
  });
  const result = submit(runtime);

  assert.equal(result.success, false, `${field} conflict must fail closed`);
  assert.equal(result.code, 'BILL_NOT_FOUND');
  assert.equal(runtime.fixtures.appendedReports.length, 0);
  assert.equal(runtime.fixtures.teamNotifications.length, 0);
}

{
  const runtime = createRuntime({
    resolverResult: {
      success: false,
      code: 'TENANT_RUNTIME_WORKSPACE_CONFLICT',
      message: '房客不屬於指定 Workspace',
      data: null
    }
  });
  const result = submit(runtime);

  assert.equal(result.success, false);
  assert.equal(result.code, 'TENANT_RUNTIME_WORKSPACE_CONFLICT');
  assert.equal(result.message, '房客不屬於指定 Workspace');
  assert.equal(runtime.fixtures.appendedReports.length, 0);
  assert.equal(runtime.fixtures.teamNotifications.length, 0);
}

for (const [name, expectedCode, bill, reports] of [
  ['cancelled', 'BILL_CANCELLED', canonicalBill({ bill_status: 'cancelled' }), []],
  ['paid', 'BILL_ALREADY_PAID', canonicalBill({ payment_status: 'paid' }), []],
  ['pending report', 'PAYMENT_REPORT_ALREADY_PENDING', canonicalBill(), [{
    bill_id: 'bill-canonical',
    tenant_id: CANONICAL_CONTEXT.tenant_id,
    status: 'pending'
  }]]
]) {
  const runtime = createRuntime({ bill, reports });
  const result = submit(runtime);

  assert.equal(result.success, false, `${name} bill must not submit`);
  assert.equal(result.code, expectedCode);
  assert.equal(runtime.fixtures.appendedReports.length, 0);
  assert.equal(runtime.fixtures.teamNotifications.length, 0);
}
