import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const settingsSource = readFileSync(
  new URL('../apps-script/V2_SYSTEM_SETTINGS.js', import.meta.url),
  'utf8'
);
const apiSource = readFileSync(
  new URL('../apps-script/V2_API.js', import.meta.url),
  'utf8'
);
const signingSource = readFileSync(
  new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url),
  'utf8'
);
const coverSource = readFileSync(
  new URL('../apps-script/V2_PAYMENT_ACCOUNT_COVER.js', import.meta.url),
  'utf8'
);
const settingsPageSource = readFileSync(
  new URL('../landlord-settings.html', import.meta.url),
  'utf8'
);
const dispatcherSource = readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);

test('payment-account settings exposes every active account and one explicit enabled account', () => {
  const context = {
    Array,
    Date,
    Error,
    Math,
    Number,
    Object,
    RegExp,
    String,
    systemSettingsText_(value) {
      return value === null || value === undefined
        ? ''
        : String(value).trim();
    },
    systemSettingsBoolean_(value) {
      return value === true || value === 1 || value === '1' || value === 'true';
    },
    systemSettingsMaskBankAccount_(value) {
      const account = String(value || '');
      return account ? '*'.repeat(Math.max(0, account.length - 4)) + account.slice(-4) : '';
    }
  };

  vm.runInNewContext(
    settingsSource +
      '\nthis.buildPaymentViews = systemSettingsBuildPaymentAccountsViews_;',
    context,
    { filename: 'V2_SYSTEM_SETTINGS.js' }
  );

  const views = context.buildPaymentViews([
    {
      payment_account_id: 'PA-1',
      account_name: '郵局帳戶',
      bank_name: '郵局',
      bank_account: '001111111111',
      is_default: false,
      account_status: 'active'
    },
    {
      payment_account_id: 'PA-2',
      account_name: '備用帳戶',
      bank_name: '銀行',
      bank_account: '002222222222',
      is_default: true,
      account_status: 'active'
    },
    {
      payment_account_id: 'PA-3',
      account_name: '已封存帳戶',
      bank_name: '銀行',
      bank_account: '003333333333',
      is_default: false,
      account_status: 'archived'
    }
  ], true);

  assert.deepEqual(
    views.map(item => item.payment_account_id),
    ['PA-1', 'PA-2']
  );
  assert.equal(views.find(item => item.is_default).payment_account_id, 'PA-2');
  assert.equal(views[0].bank_account, '001111111111');
});

test('enabling an account clears the previous enabled flag in the same Workspace', () => {
  const helperStart = settingsSource.indexOf(
    'function systemSettingsSetDefaultPaymentAccount_('
  );
  const helperEnd = settingsSource.indexOf(
    '\n\nfunction systemSettingsFindDefaultPaymentAccount_',
    helperStart
  );
  assert.notEqual(helperStart, -1);
  assert.notEqual(helperEnd, -1);

  const rows = [
    {
      payment_account_id: 'PA-1',
      workspace_id: 'WS-241',
      is_default: true,
      account_status: 'active',
      __row_number: 2
    },
    {
      payment_account_id: 'PA-2',
      workspace_id: 'WS-241',
      is_default: false,
      account_status: 'active',
      __row_number: 3
    }
  ];
  const context = {
    Array,
    Date,
    Error,
    Math,
    Number,
    Object,
    RegExp,
    String,
    V2_SYSTEM_SETTINGS_SHEETS_: {
      paymentAccounts: 'V2_workspace_payment_accounts'
    },
    systemSettingsText_(value) {
      return value === null || value === undefined
        ? ''
        : String(value).trim();
    },
    systemSettingsBoolean_(value) {
      return value === true || value === 1 || value === '1' || value === 'true';
    },
    systemSettingsFindPaymentAccountById_(_ss, _workspaceId, id) {
      return rows.find(item => item.payment_account_id === id) || null;
    },
    systemSettingsFindPaymentAccounts_() {
      return rows;
    },
    systemSettingsSetRowValues_(_sheet, rowNumber, values) {
      const row = rows.find(item => item.__row_number === rowNumber);
      Object.assign(row, values);
    },
    systemSettingsSyncLegacyDefaultPaymentAccount_() {},
    workspaceResult_(success, code, message, data) {
      return { success, code, message, data: data || {} };
    }
  };

  vm.runInNewContext(
    settingsSource.slice(helperStart, helperEnd) +
      '\nthis.enablePaymentAccount = systemSettingsSetDefaultPaymentAccount_;',
    context,
    { filename: 'V2_SYSTEM_SETTINGS.js' }
  );

  const result = context.enablePaymentAccount(
    {
      getSheetByName() {
        return {};
      }
    },
    'WS-241',
    'PA-2',
    {},
    new Date()
  );

  assert.equal(result.success, true);
  assert.deepEqual(
    rows.map(item => item.is_default),
    [false, true]
  );
});

test('tenant bill runtime uses the landlord-selected account instead of the first row', () => {
  const context = {
    Array,
    Date,
    Error,
    Math,
    Number,
    Object,
    RegExp,
    String,
    runtimeSpreadsheet_() {
      return {
        getSheetByName() {
          return {};
        }
      };
    },
    V2_SHEETS: {
      workspacePaymentAccounts: 'V2_workspace_payment_accounts',
      landlords: 'V2_landlords'
    },
    runtimeSnapshotGetValues_() {
      return [
        ['payment_account_id', 'workspace_id', 'bank_name', 'bank_account', 'is_default', 'account_status'],
        ['PA-1', 'WS-241', '郵局', '001111111111', false, 'active'],
        ['PA-2', 'WS-241', '銀行', '002222222222', true, 'active']
      ];
    },
    getSheetObjects_() {
      return [];
    }
  };

  vm.runInNewContext(
    apiSource +
      '\nthis.defaultPayment = tenantBillsRuntimeDefaultPaymentAccount_;',
    context,
    { filename: 'V2_API.js' }
  );

  const result = context.defaultPayment({ workspace_id: 'WS-241' });
  assert.equal(result.bank_account, '002222222222');
});

test('tenant signing uses the landlord-selected account when a legacy contract has another account', () => {
  const context = {
    Array,
    Date,
    Error,
    Math,
    Number,
    Object,
    RegExp,
    String,
    tenantBillsRuntimeDefaultPaymentAccount_() {
      return {
        bank_account: '009999999999',
        bank_name: '啟用銀行',
        branch_name: '啟用分行',
        bank_account_name: '啟用戶名'
      };
    }
  };

  vm.runInNewContext(
    signingSource +
      '\nthis.resolveSigningPayment = tenantLiffSigningContractPaymentAccount_;',
    context,
    { filename: 'V2_TENANT_LIFF_SIGNING_SESSION.js' }
  );

  const payment = context.resolveSigningPayment({
    workspace_id: 'WS-241',
    bank_account: '001111111111',
    bank_name: '舊合約銀行'
  });

  assert.equal(payment.bank_account, '009999999999');
  assert.equal(payment.bank_name, '啟用銀行');
});

test('selected account cover upload targets the requested account id', () => {
  assert.match(coverSource, /request\.payment_account_id/);
  assert.match(coverSource, /systemSettingsFindPaymentAccountById_/);
  assert.match(settingsPageSource, /payment_account_id:/);
  assert.match(settingsPageSource, /上傳帳戶封面/);
});

test('landlord settings exposes account switching action and authenticated bridge handling', () => {
  assert.match(settingsPageSource, /landlord_settings_set_default_payment/);
  assert.match(settingsPageSource, /function activatePaymentAccount\(/);
  assert.match(dispatcherSource, /landlord_settings_set_default_payment/);
  assert.match(dispatcherSource, /landlord_settings_save_payment/);
});

console.log('Phase 241 payment-account multiplexing tests loaded.');
