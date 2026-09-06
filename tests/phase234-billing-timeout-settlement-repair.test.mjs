import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function extractPageFunction(source, declaration) {
  const start = source.indexOf(declaration);
  const end = source.indexOf('\n\n    function ', start + declaration.length);

  assert.notEqual(start, -1, `${declaration} must exist`);

  return source.slice(start, end === -1 ? source.length : end);
}

const notificationPage = fs.readFileSync(
  'landlord-bill-notifications.html',
  'utf8'
);

{
  const timers = [];
  const appendedScripts = [];
  const document = {
    createElement() {
      return { parentNode: null };
    },
    body: {
      appendChild(script) {
        script.parentNode = this;
        appendedScripts.push(script);
      },
      removeChild(script) {
        script.parentNode = null;
      }
    }
  };
  const context = {
    API_URL: 'https://example.invalid/api',
    LINE_USER_ID: 'landlord-line-id',
    Date: { now: () => 1 },
    Math: { floor: () => 1, random: () => 0 },
    Promise,
    encodeURIComponent,
    document,
    window: {},
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {}
  };

  vm.runInNewContext(
    extractPageFunction(notificationPage, '    function jsonpRequest('),
    context
  );

  const request = context.jsonpRequest(
    'landlord_monthly_bill_notifications_send',
    { bill_month: '2026-09' },
    0,
    { retryOnTimeout: false }
  );

  while (timers.length) {
    timers.shift()();
  }

  await assert.rejects(
    request,
    (error) => error && error.code === 'API_TIMEOUT',
    'a caller that disables timeout retries must receive a typed timeout error'
  );
  assert.equal(
    appendedScripts.length,
    1,
    'a timed-out monthly-bill write must never be sent a second time automatically'
  );
}

{
  const button = { disabled: false, textContent: '手動發送本月帳單' };
  const calls = { jsonp: null, reloads: [], toasts: [] };
  const timeout = new Error('API request timed out');
  timeout.code = 'API_TIMEOUT';
  const context = {
    document: {
      getElementById(id) {
        assert.equal(id, 'manualMonthlySendButton');
        return button;
      }
    },
    getSelectedMonth() { return '2026-09'; },
    async jsonpRequest(...args) {
      calls.jsonp = args;
      throw timeout;
    },
    async loadPage(showLoading) {
      calls.reloads.push(showLoading);
    },
    showToast(...args) {
      calls.toasts.push(args);
    },
    Number
  };

  vm.runInNewContext(
    extractPageFunction(notificationPage, '    async function sendCurrentMonthNotSent()'),
    context
  );

  await context.sendCurrentMonthNotSent();

  assert.equal(
    calls.jsonp[3].retryOnTimeout,
    false,
    'manual monthly issuance must explicitly opt out of automatic write retries'
  );
  assert.deepEqual(
    calls.reloads,
    [false],
    'after a write timeout the page must refresh read-only status before asking for another action'
  );
  assert.match(
    calls.toasts[0][0],
    /未自動重送/,
    'timeout feedback must tell the landlord that the system did not resend the bill'
  );
  assert.equal(calls.toasts[0][1], false);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, '手動發送本月帳單');
}

{
  const tenantPage = fs.readFileSync('landlord-tenants.html', 'utf8');

  assert.match(
    tenantPage,
    /\.tenant-actions\.has-quick-renewal\s+\.tenant-action-button\.quick-renewal\s*\{[\s\S]*?background:\s*linear-gradient\([\s\S]*?#06c755[\s\S]*?color:\s*#ffffff;/,
    'the mobile quick-renewal selector must outrank the white action-button rule and retain a readable green CTA'
  );
}
