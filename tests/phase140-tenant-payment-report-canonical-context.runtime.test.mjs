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

function billIdCounts(rows) {
  return (rows || []).reduce((counts, row) => {
    const key = String(row.bill_id || '').trim().toUpperCase();

    if (key) {
      counts[key] = (counts[key] || 0) + 1;
    }

    return counts;
  }, {});
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
  const masterBills = options.masterBills !== undefined
    ? options.masterBills
    : [
        options.masterBill ||
        rowsBySheet.V2_tenant_bill_view[0]
      ];
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
        data: {
          ...CANONICAL_CONTEXT,
          bill_rows: masterBills,
          bill_master_id_counts: billIdCounts(masterBills),
          tenant_bill_rows: [rowsBySheet.V2_tenant_bill_view[0]]
        }
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
    init: context.getTenantPaymentReportInitByLineUid,
    submit: context.submitTenantPaymentReportByLineUid_
  };
}

function sheetFromRows(rows) {
  const headers = Object.keys(rows[0] || {});

  return {
    values: [
      headers,
      ...rows.map((row) => headers.map((header) => row[header] || ''))
    ]
  };
}

function createResolverBackedRuntime(options = {}) {
  const fixtures = {
    appendedReports: [],
    teamNotifications: []
  };
  const sheetRows = {
    V2_tenants: [{
      tenant_id: CANONICAL_CONTEXT.tenant_id,
      tenant_line_user_id: CANONICAL_CONTEXT.line_user_id,
      tenant_user_id: CANONICAL_CONTEXT.tenant_user_id,
      tenant_name: CANONICAL_CONTEXT.tenant_name,
      property_id: CANONICAL_CONTEXT.property_id,
      workspace_id: CANONICAL_CONTEXT.workspace_id,
      room_id: CANONICAL_CONTEXT.room_id,
      landlord_id: CANONICAL_CONTEXT.landlord_id,
      account_status: options.tenantAccountStatus || 'active'
    }],
    V2_contracts: [{
      tenant_id: CANONICAL_CONTEXT.tenant_id,
      tenant_user_id: CANONICAL_CONTEXT.tenant_user_id,
      contract_id: CANONICAL_CONTEXT.contract_id,
      contract_status: 'active',
      property_id: CANONICAL_CONTEXT.property_id,
      workspace_id: CANONICAL_CONTEXT.workspace_id,
      room_id: CANONICAL_CONTEXT.room_id,
      landlord_id: CANONICAL_CONTEXT.landlord_id,
      landlord_line_user_id: CANONICAL_CONTEXT.landlord_line_user_id
    }],
    V2_properties: [{
      property_id: CANONICAL_CONTEXT.property_id,
      property_name: CANONICAL_CONTEXT.property_name,
      workspace_id: CANONICAL_CONTEXT.workspace_id,
      landlord_id: CANONICAL_CONTEXT.landlord_id
    }],
    V2_rooms: [{
      room_id: CANONICAL_CONTEXT.room_id,
      room_name: CANONICAL_CONTEXT.room_name,
      workspace_id: CANONICAL_CONTEXT.workspace_id,
      property_id: CANONICAL_CONTEXT.property_id
    }],
    V2_tenant_home_view: [],
    V2_tenant_bill_view: [options.bill || canonicalBill()],
    V2_bills: options.masterBills !== undefined
      ? options.masterBills
      : [options.masterBill || options.bill || canonicalBill()]
  };
  const sheets = Object.fromEntries(
    Object.entries(sheetRows)
      .filter(([name]) => !(options.missingSheets || []).includes(name))
      .map(([name, rows]) => [name, sheetFromRows(rows)])
  );
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
    runtimeSnapshotGetValues_(sheet) {
      return sheet.values;
    },
    runtimeSnapshotGetContext_() {
      return null;
    },
    runtimeSnapshotSetContext_() {},
    runtimeSnapshotRecordAvoidedReads_() {},
    runtimeSpreadsheet_() {
      return {
        getSheetByName(name) {
          if (name === 'V2_payment_reports') {
            return {};
          }

          return sheets[name] || null;
        }
      };
    },
    getSheetObjects_(sheetName) {
      if (sheetName === 'V2_landlord_tenant_list_view') {
        throw new Error('payment module must not read the compatibility view');
      }

      if (sheetName === 'V2_payment_reports') {
        return options.reports || [];
      }

      return sheetRows[sheetName] || [];
    },
    v2CanonicalBillIsVoided_(bill) {
      return bill.bill_status === 'cancelled' || bill.bill_status === 'voided';
    },
    workspaceNotifyTeam_(payload) {
      fixtures.teamNotifications.push(payload);
      return { success: true, data: { sent_count: 1 } };
    }
  };
  const resolverSource = fs.readFileSync('apps-script/V2_TENANT_RUNTIME_RESOLVER.js', 'utf8');
  const paymentSource = fs.readFileSync('apps-script/V2_TENANT_PAYMENT_REPORTS.js', 'utf8');

  vm.runInNewContext(resolverSource, context);
  vm.runInNewContext(paymentSource, context);
  context.tenantPaymentReportAppend_ = (report) => {
    fixtures.appendedReports.push(report);
  };

  return {
    fixtures,
    init: context.getTenantPaymentReportInitByLineUid,
    resolve: context.resolveCanonicalTenantRuntimeByLineUid_,
    submit: context.submitTenantPaymentReportByLineUid_
  };
}

function submit(runtime, options = {}) {
  return runtime.submit(
    options.lineUserId || CANONICAL_CONTEXT.line_user_id,
    options.billId || 'bill-canonical',
    '12345',
    '2026-08-08',
    'canonical context test'
  );
}

{
  const runtime = createResolverBackedRuntime();
  const identity = runtime.resolve(
    CANONICAL_CONTEXT.line_user_id,
    {
      include_bill_master: false,
      include_landlord_tenant_list_view: false
    }
  );
  const result = submit(runtime);

  assert.equal(identity.success, true);
  assert.equal(identity.data.workspace_id, CANONICAL_CONTEXT.workspace_id);
  assert.equal(result.success, true);
  assert.equal(runtime.fixtures.appendedReports.length, 1);
  assert.equal(runtime.fixtures.teamNotifications.length, 1);
}

{
  const runtime = createResolverBackedRuntime();
  const identity = runtime.resolve(
    CANONICAL_CONTEXT.line_user_id,
    { include_bill_master: false }
  );

  assert.equal(identity.success, false);
  assert.equal(identity.code, 'TENANT_RUNTIME_SHEET_MISSING');
}

{
  const runtime = createResolverBackedRuntime({
    missingSheets: ['V2_contracts']
  });
  const result = submit(runtime);

  assert.equal(result.success, false);
  assert.equal(result.code, 'TENANT_RUNTIME_SHEET_MISSING');
  assert.equal(runtime.fixtures.appendedReports.length, 0);
  assert.equal(runtime.fixtures.teamNotifications.length, 0);
}

{
  const runtime = createResolverBackedRuntime({
    tenantAccountStatus: 'suspended'
  });
  const result = submit(runtime);

  assert.equal(result.success, false);
  assert.equal(result.code, 'ACCOUNT_NOT_ACTIVE');
  assert.equal(result.message, '帳號目前不是啟用狀態');
  assert.equal(runtime.fixtures.appendedReports.length, 0);
  assert.equal(runtime.fixtures.teamNotifications.length, 0);
}

{
  const runtime = createRuntime();
  const result = submit(runtime);

  assert.equal(result.success, true);
  assert.equal(result.code, 'OK');
  assert.equal(runtime.fixtures.appendedReports.length, 1);
  assert.equal(runtime.fixtures.resolverCalls, 1);
  assert.equal(runtime.fixtures.resolverLineUserId, CANONICAL_CONTEXT.line_user_id);
  assert.equal(runtime.fixtures.resolverOptions.include_bill_master, true);
}

{
  const runtime = createResolverBackedRuntime({
    bill: canonicalBill({
      bill_id: 'B0000024',
      room_name: '302',
      discount_amount: 0,
      total_amount: 8790
    }),
    masterBill: canonicalBill({
      line_user_id: '',
      bill_id: 'B0000024',
      room_name: '302',
      discount_amount: 1645,
      total_amount: 7145
    })
  });
  const init = runtime.init(CANONICAL_CONTEXT.line_user_id);
  const result = submit(runtime, { billId: 'B0000024' });
  const report = runtime.fixtures.appendedReports[0];

  assert.equal(init.success, true);
  assert.equal(init.data.bills.length, 1);
  assert.equal(
    init.data.bills[0].total_amount,
    7145,
    'payment report selection must prefer the canonical bill amount over a stale tenant view'
  );
  assert.equal(result.success, true);
  assert.equal(report.bill_total_amount, 7145);
  assert.equal(report.reported_amount, 7145);
}

{
  const runtime = createResolverBackedRuntime({
    masterBills: [],
    bill: canonicalBill({
      bill_id: 'legacy-view-only'
    })
  });
  const init = runtime.init(CANONICAL_CONTEXT.line_user_id);
  const result = submit(runtime, { billId: 'legacy-view-only' });

  assert.equal(init.success, true);
  assert.equal(init.data.bills.length, 1);
  assert.equal(result.success, true);
  assert.equal(runtime.fixtures.appendedReports.length, 1);
}

{
  const runtime = createResolverBackedRuntime({
    masterBills: [],
    bill: canonicalBill({
      line_user_id: '',
      bill_id: 'blank-line-view'
    })
  });
  const init = runtime.init(CANONICAL_CONTEXT.line_user_id);
  const result = submit(runtime, { billId: 'blank-line-view' });

  assert.equal(init.success, true);
  assert.equal(init.data.bills.length, 0);
  assert.equal(result.success, false);
  assert.equal(result.code, 'BILL_NOT_FOUND');
  assert.equal(runtime.fixtures.appendedReports.length, 0);
}

{
  const first = canonicalBill({
    bill_id: 'duplicate-master',
    total_amount: 7145
  });
  const runtime = createResolverBackedRuntime({
    bill: canonicalBill({
      bill_id: 'duplicate-master',
      total_amount: 8790
    }),
    masterBills: [
      first,
      { ...first, total_amount: 8790 }
    ]
  });
  const init = runtime.init(CANONICAL_CONTEXT.line_user_id);
  const result = submit(runtime, { billId: 'duplicate-master' });

  assert.equal(init.success, false);
  assert.equal(init.code, 'DUPLICATE_BILL_ID');
  assert.equal(result.success, false);
  assert.equal(result.code, 'DUPLICATE_BILL_ID');
  assert.equal(runtime.fixtures.appendedReports.length, 0);
}

{
  const billId = 'foreign-master-collision';
  const runtime = createResolverBackedRuntime({
    bill: canonicalBill({ bill_id: billId }),
    masterBills: [canonicalBill({
      line_user_id: '',
      tenant_id: 'foreign-tenant',
      contract_id: 'foreign-contract',
      workspace_id: 'foreign-workspace',
      room_id: 'foreign-room',
      bill_id: billId
    })]
  });
  const init = runtime.init(CANONICAL_CONTEXT.line_user_id);
  const result = submit(runtime, { billId });

  assert.equal(init.success, false);
  assert.equal(init.code, 'BILL_ID_SCOPE_CONFLICT');
  assert.equal(result.success, false);
  assert.equal(result.code, 'BILL_ID_SCOPE_CONFLICT');
  assert.equal(runtime.fixtures.appendedReports.length, 0);
}

{
  const currentBill = canonicalBill({
    bill_id: 'current-contract-bill',
    total_amount: 7145
  });
  const runtime = createResolverBackedRuntime({
    bill: currentBill,
    masterBills: [
      currentBill,
      canonicalBill({
        bill_id: 'historical-contract-bill',
        contract_id: 'historical-contract',
        room_id: 'historical-room',
        total_amount: 8790
      })
    ]
  });
  const init = runtime.init(CANONICAL_CONTEXT.line_user_id);
  const result = submit(runtime, {
    billId: 'current-contract-bill'
  });

  assert.equal(init.success, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(
      init.data.bills.map((bill) => bill.bill_id)
    )),
    ['current-contract-bill']
  );
  assert.equal(result.success, true);
  assert.equal(runtime.fixtures.appendedReports.length, 1);
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
  assert.equal(result.code, 'BILL_ID_SCOPE_CONFLICT');
  assert.equal(runtime.fixtures.appendedReports.length, 0);
  assert.equal(runtime.fixtures.teamNotifications.length, 0);
}

for (const [name, runtimeOptions, submitOptions, expectedCode] of [
  [
    'bill line_user_id',
    { bill: canonicalBill({ line_user_id: 'different-bill-line' }) },
    {},
    'BILL_ID_SCOPE_CONFLICT'
  ],
  [
    'canonical LINE UID',
    {
      resolverResult: {
        success: true,
        code: 'OK',
        message: '房客 runtime 身份解析成功',
        data: {
          ...CANONICAL_CONTEXT,
          line_user_id: 'different-canonical-line'
        }
      }
    },
    {},
    'BILL_NOT_FOUND'
  ],
  ['bill ID', {}, { billId: 'bill-mismatch' }, 'BILL_NOT_FOUND']
]) {
  const runtime = createRuntime(runtimeOptions);
  const result = submit(runtime, submitOptions);

  assert.equal(result.success, false, `${name} mismatch must fail closed`);
  assert.equal(result.code, expectedCode);
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
