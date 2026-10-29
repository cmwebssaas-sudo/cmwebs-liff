import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// Email login runs before any session exists. Its failures must stay on the
// login form with a message that says what happened, not a generic network hint.
function bridge() {
  const listeners = new Set();
  const forms = [];
  const element = tag => ({
    tagName: tag.toUpperCase(), style: {}, children: [], contentWindow: {},
    appendChild(child) { this.children.push(child); return child; },
    removeChild() {}, setAttribute() {},
    submit() { forms.push(this); },
    remove() {}
  });
  const context = {
    URL, URLSearchParams, JSON, String, Number, Boolean, Math, Date, Error, Promise, Object,
    setTimeout: () => 0, clearTimeout() {},
    document: { body: element('body'), createElement: element, getElementById: () => null },
    location: {
      href: 'https://example.test/landlord-entry.html?mode=email&return_to=landlord-home.html',
      origin: 'https://example.test', pathname: '/landlord-entry.html', search: '', hash: '',
      replace(value) { context.replaced = value; }
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener: (type, callback) => type === 'message' && listeners.add(callback),
    removeEventListener: (type, callback) => listeners.delete(callback),
    console: { warn() {}, error() {} }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read('landlord-auth.js'), context);
  const auth = context.CMWebsLandlordAuth.init({
    apiUrl: 'https://script.google.com/macros/s/example/exec',
    returnTo: 'landlord-home.html',
    entryPage: 'landlord-entry.html'
  });
  function reply(payload) {
    const form = forms.at(-1);
    const requestId = form.children.find(field => field.name === 'request_id').value;
    for (const callback of [...listeners]) {
      callback({ origin: 'https://n-fixture-script.googleusercontent.com', source: {}, data: { source: 'CMWEBS_APPS_SCRIPT', requestId, payload } });
    }
  }
  return { context, auth, reply };
}

const notEnabled = { success: false, code: 'AUTH_REQUIRED', message: '請重新確認 Email 或驗證狀態' };

test('an Email that cannot log in yet keeps the login form instead of redirecting', async () => {
  const { context, auth, reply } = bridge();
  const request = auth.requestEmailCode('owner@example.com');
  reply(notEnabled);
  await assert.rejects(request, { code: 'AUTH_REQUIRED' });
  assert.equal(context.replaced, undefined, 'mode=email must not be dropped by an entry redirect');

  const verify = auth.verifyEmailCode('challenge-1', '123456');
  reply(notEnabled);
  await assert.rejects(verify, { code: 'AUTH_REQUIRED' });
  assert.equal(context.replaced, undefined);
});

test('protected requests still return to the entry page on AUTH_REQUIRED', async () => {
  const { context, auth, reply } = bridge();
  const request = auth.requestProtected('landlord_home', {});
  reply(notEnabled);
  await assert.rejects(request, { code: 'AUTH_REQUIRED' });
  assert.match(context.replaced, /^landlord-entry\.html\?return_to=landlord-home\.html/);
});

const entrySource = read('landlord-entry.html');
const start = entrySource.indexOf('function emailMessageText(');
const emailMessageText = new Function(
  entrySource.slice(start, entrySource.indexOf('\n    }\n', start) + 6) + 'return emailMessageText;'
)();
const requestFallback = '驗證碼寄送失敗，請確認網路後再試。';

test('not enabled, delivery failure and timeout each get their own message', () => {
  const messages = {
    AUTH_REQUIRED: emailMessageText('AUTH_REQUIRED', requestFallback),
    EMAIL_DELIVERY_FAILED: emailMessageText('EMAIL_DELIVERY_FAILED', requestFallback),
    API_TIMEOUT: emailMessageText('API_TIMEOUT', requestFallback)
  };
  assert.match(messages.AUTH_REQUIRED, /尚未開通 Email 登入/);
  assert.match(messages.AUTH_REQUIRED, /先用 LINE 登入.*設定.*Email 驗證/);
  assert.match(messages.EMAIL_DELIVERY_FAILED, /無法寄出驗證碼/);
  assert.match(messages.API_TIMEOUT, /逾時/);
  assert.equal(new Set(Object.values(messages)).size, 3);
  for (const message of Object.values(messages)) assert.notEqual(message, requestFallback);
});

test('existing codes keep their messages and unknown codes keep the fallback', () => {
  assert.equal(emailMessageText('RATE_LIMITED', requestFallback), '驗證碼請求過於頻繁，請稍後再試。');
  assert.equal(emailMessageText('CHALLENGE_EXPIRED', requestFallback), '驗證碼已過期，請重新取得新的驗證碼。');
  assert.equal(emailMessageText('SOMETHING_ELSE', requestFallback), requestFallback);
});
