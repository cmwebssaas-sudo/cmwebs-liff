import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const apiSource = readFileSync(
  new URL('../apps-script/V2_API.js', import.meta.url),
  'utf8'
);
const billsPageSource = readFileSync(
  new URL('../tenant-bills.html', import.meta.url),
  'utf8'
);
const reportPageSource = readFileSync(
  new URL('../tenant-payment-report.html', import.meta.url),
  'utf8'
);
const reportApiSource = readFileSync(
  new URL(
    '../apps-script/V2_TENANT_PAYMENT_REPORTS.js',
    import.meta.url
  ),
  'utf8'
);

function sheetFromRows(rows) {
  const headers = [
    ...new Set(rows.flatMap(row => Object.keys(row)))
  ];

  return {
    values: [
      headers,
      ...rows.map(row =>
        headers.map(header => row[header] ?? '')
      )
    ]
  };
}

function tenantBillsPayload(rowsBySheet) {
  const sheets = Object.fromEntries(
    Object.entries(rowsBySheet).map(([name, rows]) => [
      name,
      sheetFromRows(rows)
    ])
  );
  const context = {
    Array,
    Date,
    Error,
    JSON,
    Math,
    Number,
    Object,
    String,
    Utilities: {
      formatDate(value, timezone, pattern) {
        assert.equal(timezone, 'Asia/Taipei');
        return pattern === 'yyyy-MM'
          ? '2026-09'
          : '2026-09-10';
      }
    },
    runtimeSpreadsheet_() {
      return {
        getSheetByName(name) {
          return sheets[name] || null;
        }
      };
    },
    runtimeSnapshotGetValues_(sheet) {
      return sheet.values;
    },
    v2CanonicalBillPaymentStatus_(value) {
      return String(value || '').trim() || 'unpaid';
    },
    v2CanonicalTenantBillingProjection_(rows) {
      return { bills: rows };
    }
  };

  vm.runInNewContext(apiSource, context, {
    filename: 'V2_API.js'
  });

  return context.tenantBillsRuntimePayload_('line-tenant');
}

function extractFunction(source, name, endMarker) {
  const start = source.indexOf(`    function ${name}(`);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} must end before ${endMarker}`);

  return source.slice(start, end);
}

function htmlContext() {
  return {
    rawText(value) {
      return value == null ? '' : String(value);
    },
    safeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  };
}

test('tenant bills fall back to the matching active contract account when the Workspace default is absent', () => {
  const result = tenantBillsPayload({
    V2_tenants: [{
      tenant_id: 'T-238',
      tenant_line_user_id: 'line-tenant',
      tenant_user_id: 'U-238',
      tenant_name: '房客 238',
      workspace_id: 'WS-238',
      current_contract_id: 'C-238',
      account_status: 'active'
    }],
    V2_contracts: [{
      contract_id: 'C-238',
      tenant_id: 'T-238',
      tenant_user_id: 'U-238',
      workspace_id: 'WS-238',
      property_id: 'P-238',
      room_id: 'R-238',
      room_name: '238',
      contract_status: 'active',
      bank_name: '合約收款銀行',
      bank_account: '238001122334',
      bank_account_name: '合約收款戶名'
    }],
    V2_bills: [{
      bill_id: 'B-238',
      tenant_id: 'T-238',
      tenant_user_id: 'U-238',
      workspace_id: 'WS-238',
      contract_id: 'C-238',
      room_id: 'R-238',
      room_name: '238',
      bill_month: '2026-09',
      due_date: '2026-09-10',
      total_amount: 8500,
      payment_status: 'unpaid'
    }],
    V2_workspace_payment_accounts: []
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(result.data.payment_account)),
    {
      bank_code: '',
      bank_name: '合約收款銀行',
      branch_name: '',
      bank_account: '238001122334',
      bank_account_name: '合約收款戶名',
      payment_note: ''
    }
  );
});

test('tenant bills fall back to the active contract landlord account when the Workspace default and contract account are absent', () => {
  const result = tenantBillsPayload({
    V2_tenants: [{
      tenant_id: 'T-239',
      tenant_line_user_id: 'line-tenant',
      tenant_user_id: 'U-239',
      tenant_name: '房客 239',
      workspace_id: 'WS-239',
      current_contract_id: 'C-239',
      account_status: 'active'
    }],
    V2_contracts: [{
      contract_id: 'C-239',
      tenant_id: 'T-239',
      tenant_user_id: 'U-239',
      landlord_id: 'L-239',
      workspace_id: 'WS-239',
      property_id: 'P-239',
      room_id: 'R-239',
      room_name: '239',
      contract_status: 'active'
    }],
    V2_bills: [{
      bill_id: 'B-239',
      tenant_id: 'T-239',
      tenant_user_id: 'U-239',
      workspace_id: 'WS-239',
      contract_id: 'C-239',
      room_id: 'R-239',
      room_name: '239',
      bill_month: '2026-09',
      due_date: '2026-09-10',
      total_amount: 8500,
      payment_status: 'unpaid'
    }],
    V2_workspace_payment_accounts: [],
    V2_landlords: [{
      landlord_id: 'L-239',
      workspace_id: 'WS-239',
      bank_code: '004',
      bank_name: '臺灣銀行',
      bank_branch: '中山分行',
      bank_account: '239001122334',
      bank_account_name: '房東收款帳戶',
      payment_note: '請填寫匯款後五碼'
    }]
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(result.data.payment_account)),
    {
      bank_code: '004',
      bank_name: '臺灣銀行',
      branch_name: '中山分行',
      bank_account: '239001122334',
      bank_account_name: '房東收款帳戶',
      payment_note: '請填寫匯款後五碼'
    }
  );
});

test('tenant bills preserve compatible landlord account column aliases used by the contract page', () => {
  const result = tenantBillsPayload({
    V2_tenants: [{
      tenant_id: 'T-239-ALIAS',
      tenant_line_user_id: 'line-tenant',
      workspace_id: 'WS-239-ALIAS',
      current_contract_id: 'C-239-ALIAS',
      account_status: 'active'
    }],
    V2_contracts: [{
      contract_id: 'C-239-ALIAS',
      tenant_id: 'T-239-ALIAS',
      landlord_id: 'L-239-ALIAS',
      workspace_id: 'WS-239-ALIAS',
      room_id: 'R-239-ALIAS',
      room_name: '239-A',
      contract_status: 'active'
    }],
    V2_bills: [{
      bill_id: 'B-239-ALIAS',
      tenant_id: 'T-239-ALIAS',
      workspace_id: 'WS-239-ALIAS',
      contract_id: 'C-239-ALIAS',
      room_id: 'R-239-ALIAS',
      room_name: '239-A',
      bill_month: '2026-09',
      due_date: '2026-09-10',
      total_amount: 8500,
      payment_status: 'unpaid'
    }],
    V2_workspace_payment_accounts: [],
    V2_landlords: [{
      landlord_id: 'L-239-ALIAS',
      workspace_id: 'WS-239-ALIAS',
      銀行名稱: '相容銀行',
      匯款帳號: '239998877665',
      戶名: '相容收款戶名',
      匯款備註: '請保留交易明細'
    }]
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(result.data.payment_account)),
    {
      bank_code: '',
      bank_name: '相容銀行',
      branch_name: '',
      bank_account: '239998877665',
      bank_account_name: '相容收款戶名',
      payment_note: '請保留交易明細'
    }
  );
});

test('tenant bills never use a landlord account outside the active lease Workspace or landlord', () => {
  const result = tenantBillsPayload({
    V2_tenants: [{
      tenant_id: 'T-239',
      tenant_line_user_id: 'line-tenant',
      tenant_user_id: 'U-239',
      workspace_id: 'WS-239',
      current_contract_id: 'C-239',
      account_status: 'active'
    }],
    V2_contracts: [{
      contract_id: 'C-239',
      tenant_id: 'T-239',
      tenant_user_id: 'U-239',
      landlord_id: 'L-239',
      workspace_id: 'WS-239',
      room_id: 'R-239',
      room_name: '239',
      contract_status: 'active'
    }],
    V2_bills: [{
      bill_id: 'B-239',
      tenant_id: 'T-239',
      tenant_user_id: 'U-239',
      workspace_id: 'WS-239',
      contract_id: 'C-239',
      room_id: 'R-239',
      room_name: '239',
      bill_month: '2026-09',
      due_date: '2026-09-10',
      total_amount: 8500,
      payment_status: 'unpaid'
    }],
    V2_workspace_payment_accounts: [],
    V2_landlords: [{
      landlord_id: 'L-239',
      workspace_id: 'WS-OTHER',
      bank_account: 'should-not-leak'
    }, {
      landlord_id: 'L-OTHER',
      workspace_id: 'WS-239',
      bank_account: 'should-not-leak'
    }]
  });

  assert.equal(result.data.payment_account, null);
});

test('My Bills renders the receiving account in a visible page card', () => {
  const context = htmlContext();

  vm.runInNewContext(
    extractFunction(
      billsPageSource,
      'tenantPaymentAccountCardHtml_',
      '\n\n    function renderBillList('
    ),
    context,
    { filename: 'tenant-bills.html' }
  );

  const html = context.tenantPaymentAccountCardHtml_({
    bank_code: '004',
    bank_name: '臺灣銀行',
    branch_name: '中山分行',
    bank_account: '123456789012',
    bank_account_name: 'CMWebs 收款帳戶',
    payment_note: '匯款後請回報 <後五碼>'
  });

  assert.match(html, /轉帳收款資訊/);
  assert.match(html, /123456789012/);
  assert.match(html, /匯款後請回報 &lt;後五碼&gt;/);
  assert.match(
    billsPageSource,
    /tenantPaymentAccountCardHtml_\(paymentAccount\)/
  );
});

test('payment-report init publishes and renders the same receiving account', () => {
  const expectedAccount = {
    bank_code: '004',
    bank_name: '臺灣銀行',
    branch_name: '中山分行',
    bank_account: '123456789012',
    bank_account_name: 'CMWebs 收款帳戶',
    payment_note: '匯款後請回報後五碼。'
  };
  const context = {
    Array,
    Boolean,
    Date,
    Error,
    JSON,
    Math,
    Number,
    Object,
    String
  };

  vm.runInNewContext(reportApiSource, context, {
    filename: 'V2_TENANT_PAYMENT_REPORTS.js'
  });

  context.tenantPaymentReportResolveCanonicalContext_ = () => ({
    success: true,
    data: {
      line_user_id: 'line-tenant',
      tenant_id: 'T-238',
      tenant_user_id: 'U-238',
      tenant_name: '房客 238',
      contract_id: 'C-238',
      workspace_id: 'WS-238',
      room_id: 'R-238',
      room_name: '238'
    }
  });
  context.tenantPaymentReportBuildTenant_ = canonical => canonical;
  context.tenantPaymentReportCanonicalBillRows_ = () => [];
  context.tenantPaymentReportGetReports_ = () => [];
  context.tenantPaymentReportLogAccess_ = () => {};
  context.tenantBillsRuntimeDefaultPaymentAccount_ = identity => {
    assert.equal(identity.workspace_id, 'WS-238');
    assert.equal(identity.contract_id, 'C-238');
    return expectedAccount;
  };

  const result = context.getTenantPaymentReportInitByLineUid(
    'line-tenant'
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(result.data.payment_account)),
    expectedAccount
  );

  const pageContext = htmlContext();

  vm.runInNewContext(
    extractFunction(
      reportPageSource,
      'tenantPaymentAccountCardHtml_',
      '\n\n    function renderPage('
    ),
    pageContext,
    { filename: 'tenant-payment-report.html' }
  );

  const html = pageContext.tenantPaymentAccountCardHtml_(
    expectedAccount
  );

  assert.match(html, /轉帳收款資訊/);
  assert.match(html, /123456789012/);
  assert.match(
    reportPageSource,
    /tenantPaymentAccountCardHtml_\(paymentAccount\)/
  );
});
