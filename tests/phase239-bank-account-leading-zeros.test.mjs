import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../apps-script/V2_SYSTEM_SETTINGS.js', import.meta.url),
  'utf8'
);
const apiSource = readFileSync(
  new URL('../apps-script/V2_API.js', import.meta.url),
  'utf8'
);
const authSource = readFileSync(
  new URL('../landlord-auth.js', import.meta.url),
  'utf8'
);
const landlordSettingsSource = readFileSync(
  new URL('../landlord-settings.html', import.meta.url),
  'utf8'
);
const tenantBillsPageSource = readFileSync(
  new URL('../tenant-bills.html', import.meta.url),
  'utf8'
);
const tenantPaymentReportPageSource = readFileSync(
  new URL('../tenant-payment-report.html', import.meta.url),
  'utf8'
);
const dispatcherSource = readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);

function makeSheet() {
  const calls = [];
  const headers = [
    'payment_account_id',
    'workspace_id',
    'bank_account',
    'updated_at'
  ];
  const row = ['PA-239', 'WS-239', '001234567890', ''];

  return {
    calls,
    getLastColumn() {
      return headers.length;
    },
    getRange(rowNumber, column, rowCount, columnCount) {
      const isRowRead = rowCount === 1 && columnCount === headers.length;
      return {
        getValues() {
          assert.equal(isRowRead, true);
          calls.push(['getValues', rowNumber, column]);
          return [rowNumber === 1 ? headers : row];
        },
        setValues(values) {
          calls.push(['setValues', rowNumber, values[0][2]]);
        },
        setNumberFormat(format) {
          calls.push(['setNumberFormat', rowNumber, column, format]);
        }
      };
    }
  };
}

test('bank account writes preserve leading zeros as plain text', () => {
  const context = {
    Array,
    Date,
    Error,
    Math,
    Number,
    Object,
    RegExp,
    String
  };

  vm.runInNewContext(source, context, {
    filename: 'V2_SYSTEM_SETTINGS.js'
  });

  const sheet = makeSheet();
  context.systemSettingsSetRowValues_(
    sheet,
    2,
    {
      bank_account: '001234567890',
      updated_at: new Date('2026-09-07T00:00:00Z')
    }
  );

  const formatIndex = sheet.calls.findIndex(
    call => call[0] === 'setNumberFormat'
  );
  const writeIndex = sheet.calls.findIndex(
    call => call[0] === 'setValues'
  );

  assert.notEqual(formatIndex, -1);
  assert.equal(sheet.calls[formatIndex][3], '@');
  assert.ok(formatIndex < writeIndex);
  assert.equal(sheet.calls[writeIndex][2], '001234567890');
});

test('tenant payment account publishes cover metadata without exposing the Drive id', () => {
  const context = {
    Array,
    Date,
    Error,
    Math,
    Number,
    Object,
    RegExp,
    String
  };

  vm.runInNewContext(
    apiSource +
      '\nthis.publicPaymentAccount = tenantBillsRuntimePublicPaymentAccount_;',
    context,
    { filename: 'V2_API.js' }
  );

  const result = context.publicPaymentAccount({
    bank_code: '700',
    bank_account: '001234567890',
    bank_account_name: '收款戶名',
    bank_account_cover_file_id: 'drive-secret-id',
    bank_account_cover_file_name: 'bank-cover.png'
  });

  assert.equal(result.bank_account, '001234567890');
  assert.equal(result.bank_account_cover_available, true);
  assert.equal(result.bank_account_cover_file_name, 'bank-cover.png');
  assert.equal(
    Object.hasOwn(result, 'bank_account_cover_file_id'),
    false
  );
});

test('new payment account rows format the bank account column before writing', () => {
  const context = {
    Array,
    Date,
    Error,
    Math,
    Number,
    Object,
    RegExp,
    String
  };

  vm.runInNewContext(source, context, {
    filename: 'V2_SYSTEM_SETTINGS.js'
  });

  const calls = [];
  const headers = ['payment_account_id', 'bank_account'];
  const sheet = {
    getLastColumn() {
      return headers.length;
    },
    getLastRow() {
      return 1;
    },
    getRange(rowNumber, column, rowCount, columnCount) {
      return {
        getValues() {
          return [headers];
        },
        setNumberFormat(format) {
          calls.push(['setNumberFormat', rowNumber, column, format]);
        },
        setValues(values) {
          calls.push(['setValues', rowNumber, values[0][1]]);
        }
      };
    },
    appendRow(values) {
      calls.push(['appendRow', values[1]]);
    }
  };

  context.systemSettingsAppendObject_(sheet, {
    payment_account_id: 'PA-239',
    bank_account: '001234567890'
  });

  assert.equal(calls[0][0], 'setNumberFormat');
  assert.equal(calls[0][3], '@');
  assert.equal(calls[1][0], 'setValues');
  assert.equal(calls[1][1], 2);
  assert.equal(calls[1][2], '001234567890');
});

test('landlord auth exposes a protected bridge for both email and LINE sessions', () => {
  const context = {
    window: {
      innerWidth: 390,
      matchMedia() {
        return { matches: false };
      },
      sessionStorage: {
        getItem() { return ''; },
        setItem() {},
        removeItem() {}
      }
    },
    document: {},
    URL,
    URLSearchParams,
    Promise,
    Math,
    Date,
    Number,
    String,
    Object,
    clearTimeout,
    setTimeout
  };

  vm.runInNewContext(authSource, context, {
    filename: 'landlord-auth.js'
  });

  context.window.CMWebsLandlordAuth.init({
    apiUrl: 'https://example.test/exec',
    lineUserId: 'line-landlord'
  });

  assert.equal(
    typeof context.window.CMWebsLandlordAuth.requestProtected,
    'function'
  );
});

test('landlord and tenant pages expose the payment-account cover flow', () => {
  assert.match(landlordSettingsSource, /id="bankAccountCover"/);
  assert.match(
    landlordSettingsSource,
    /function uploadPaymentAccountCover\(/
  );
  assert.match(tenantBillsPageSource, /查看銀行帳戶封面/);
  assert.match(
    tenantBillsPageSource,
    /function openPaymentAccountCover\(/
  );
  assert.match(tenantPaymentReportPageSource, /查看銀行帳戶封面/);
  assert.match(
    tenantPaymentReportPageSource,
    /function openPaymentAccountCover\(/
  );
});

test('dispatcher exposes the protected upload and tenant cover routes', () => {
  assert.match(
    dispatcherSource,
    /landlord_settings_upload_payment_account_cover/
  );
  assert.match(dispatcherSource, /tenant_payment_account_cover/);
});
