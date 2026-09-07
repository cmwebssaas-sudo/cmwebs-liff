import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const apiSource = readFileSync(
  new URL('../apps-script/V2_API.js', import.meta.url),
  'utf8'
);
const pageSource = readFileSync(
  new URL('../tenant-bills.html', import.meta.url),
  'utf8'
);

function sheetFromRows(rows) {
  const headers = [
    ...new Set(
      rows.flatMap(row => Object.keys(row))
    )
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

test('tenant bill runtime publishes only its workspace default eligible receiving account', () => {
  const result = tenantBillsPayload({
    V2_tenants: [
      {
        tenant_id: 'T-101',
        tenant_line_user_id: 'line-tenant',
        tenant_user_id: 'U-101',
        tenant_name: '房客測試',
        workspace_id: 'WS-101',
        current_contract_id: 'C-101',
        account_status: 'active'
      }
    ],
    V2_contracts: [
      {
        contract_id: 'C-101',
        tenant_id: 'T-101',
        tenant_user_id: 'U-101',
        workspace_id: 'WS-101',
        property_id: 'P-101',
        room_id: 'R-101',
        room_name: '101',
        contract_status: 'active'
      }
    ],
    V2_bills: [
      {
        bill_id: 'B-101',
        tenant_id: 'T-101',
        tenant_user_id: 'U-101',
        workspace_id: 'WS-101',
        contract_id: 'C-101',
        room_id: 'R-101',
        room_name: '101',
        bill_month: '2026-09',
        due_date: '2026-09-10',
        total_amount: 8500,
        payment_status: 'unpaid'
      }
    ],
    V2_workspace_payment_accounts: [
      {
        workspace_id: 'WS-OTHER',
        bank_name: '不得外洩銀行',
        bank_account: '999999999999',
        bank_account_name: '不得外洩戶名',
        is_default: true,
        account_status: 'active'
      },
      {
        workspace_id: 'WS-101',
        bank_name: '已封存銀行',
        bank_account: '111111111111',
        bank_account_name: '舊戶名',
        is_default: true,
        account_status: 'archived'
      },
      {
        workspace_id: 'WS-101',
        bank_code: '004',
        bank_name: '臺灣銀行',
        branch_name: '中山分行',
        bank_account: '123456789012',
        bank_account_name: 'CMWebs 收款帳戶',
        payment_note: '匯款後請回報帳號後五碼。',
        is_default: true,
        account_status: 'active'
      }
    ]
  });

  assert.equal(
    result.data.payment_account.bank_code,
    '004'
  );
  assert.equal(
    result.data.payment_account.bank_name,
    '臺灣銀行'
  );
  assert.equal(
    result.data.payment_account.branch_name,
    '中山分行'
  );
  assert.equal(
    result.data.payment_account.bank_account,
    '123456789012'
  );
  assert.equal(
    result.data.payment_account.bank_account_name,
    'CMWebs 收款帳戶'
  );
  assert.equal(
    result.data.payment_account.payment_note,
    '匯款後請回報帳號後五碼。'
  );
  assert.equal(
    Object.hasOwn(
      result.data.payment_account,
      'workspace_id'
    ),
    false
  );
});

test('tenant bill detail renders an escaped receiving-account section', () => {
  const context = {
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

  vm.runInNewContext(
    extractFunction(
      pageSource,
      'tenantBillPaymentAccountDetailHtml_',
      '\n\n    function openBillDetail('
    ),
    context,
    { filename: 'tenant-bills.html' }
  );

  const html = context.tenantBillPaymentAccountDetailHtml_({
    bank_code: '004',
    bank_name: '臺灣銀行',
    branch_name: '中山分行',
    bank_account: '123456789012',
    bank_account_name: 'CMWebs 收款帳戶',
    payment_note: '請填後五碼 <確認>'
  });

  assert.match(html, /轉帳收款資訊/);
  assert.match(html, /004 臺灣銀行/);
  assert.match(html, /中山分行/);
  assert.match(html, /123456789012/);
  assert.match(html, /CMWebs 收款帳戶/);
  assert.match(html, /請填後五碼 &lt;確認&gt;/);
});
