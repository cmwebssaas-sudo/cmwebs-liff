import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const signingSource = readFileSync(
  new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url),
  'utf8'
);
const pageSource = readFileSync(
  new URL('../tenant-contract.html', import.meta.url),
  'utf8'
);

function extractFunction(source, name, endMarker) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} must end before ${endMarker}`);
  return source.slice(start, end);
}

test('tenant signing payload falls back to the verified Workspace receiving account and preserves leading zeroes', () => {
  const context = {
    Array,
    Date,
    Error,
    Math,
    Number,
    Object,
    String,
    tenantBillsRuntimeDefaultPaymentAccount_(identity) {
      assert.equal(identity.workspace_id, 'WS-240');
      assert.equal(identity.contract_row.contract_id, 'C-240');
      return {
        bank_code: '700',
        bank_name: '郵局',
        branch_name: '中正分行',
        bank_account: '001234567890',
        bank_account_name: '房東收款戶',
        payment_note: '簽約付款請保留收據。',
        bank_account_cover_available: true,
        bank_account_cover_file_name: '存摺封面.png'
      };
    }
  };

  vm.runInNewContext(
    signingSource + '\nthis.signingContractView = tenantLiffSigningContractView_;',
    context,
    { filename: 'V2_TENANT_LIFF_SIGNING_SESSION.js' }
  );

  const view = context.signingContractView([
    {
      contract_id: 'C-240',
      workspace_id: 'WS-240',
      landlord_id: 'L-240',
      signing_mode: 'new_tenant',
      rent_amount: 8500,
      deposit_amount: 17000
    }
  ], {
    contract_id: 'C-240',
    workspace_id: 'WS-240',
    landlord_id: 'L-240',
    signing_mode: 'new_tenant',
    rent_amount: 8500,
    deposit_amount: 17000
  }, 'new_tenant', {});

  assert.equal(view.bank_account, '001234567890');
  assert.equal(view.bank_name, '郵局');
  assert.equal(view.bank_branch, '中正分行');
  assert.equal(view.bank_account_name, '房東收款戶');
  assert.equal(view.bank_account_cover_available, true);
  assert.equal(view.bank_account_cover_file_name, '存摺封面.png');
});

test('tenant signing workflow renders the deposit and first-rent payment account clearly', () => {
  assert.match(pageSource, /renderTenantSigningPaymentInfo\(contract\)/);

  const context = {
    Number,
    String,
    isFinite,
    rawText(value) {
      return value === null || value === undefined ? '' : String(value);
    },
    safeText(value) {
      const text = String(value === null || value === undefined ? '' : value).trim();
      return text || '-';
    },
    escapeHtml(value) {
      return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
    money(value) {
      return 'NT$ ' + Math.round(Number(value || 0)).toLocaleString('zh-TW');
    }
  };

  vm.runInNewContext(
    extractFunction(pageSource, 'renderTenantSigningPaymentInfo', '\n\n    function renderTenantContractHistory_'),
    context,
    { filename: 'tenant-contract.html' }
  );

  const html = context.renderTenantSigningPaymentInfo({
    rent_amount: 8500,
    deposit_amount: 17000,
    bank_name: '郵局',
    bank_branch: '中正分行',
    bank_account: '001234567890',
    bank_account_name: '房東收款戶',
    bank_account_cover_available: true
  });

  assert.match(html, /簽約付款資訊/);
  assert.match(html, /押金／首月租金合計/);
  assert.match(html, /NT\$ 25,500/);
  assert.match(html, /001234567890/);
  assert.match(html, /郵局/);
  assert.match(html, /存摺封面/);

  const missingAccount = context.renderTenantSigningPaymentInfo({
    rent_amount: 8500,
    deposit_amount: 17000
  });
  assert.match(missingAccount, /尚未提供房東收款帳號/);
});

console.log('Phase 240 tenant contract signing payment-account tests passed.');
