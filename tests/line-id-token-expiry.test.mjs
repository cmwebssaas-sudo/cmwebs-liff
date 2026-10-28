import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const NOW = Date.UTC(2026, 9, 29, 4, 0, 0);
const EXPIRED = Math.floor(NOW / 1000) - 600;
const FRESH = Math.floor(NOW / 1000) + 3000;

// A desktop browser keeps LIFF's 30-day access token, but the ID token that
// Apps Script verifies with LINE lasts one hour. Once it expires every
// protected request fails with AUTH_REQUIRED until LINE login runs again.
function browser({ exp = EXPIRED, inClient = false, loggedIn = true, href } = {}) {
  const calls = [];
  const storage = new Map();
  const window = {
    calls,
    location: { href: href || 'https://example.test/cmwebs/landlord-home.html?tab=rooms&code=private&state=private' },
    sessionStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    liff: {
      isLoggedIn: () => loggedIn,
      isInClient: () => inClient,
      getIDToken: () => 'id-token-fixture',
      getDecodedIDToken: () => ({ exp }),
      logout: () => calls.push(['logout']),
      login: options => calls.push(['login', options.redirectUri])
    }
  };
  window.window = window;
  const FixedDate = class extends Date { static now() { return NOW; } };
  return vm.createContext(Object.assign(window, { URL, URLSearchParams, Set, String, Number, Math, Date: FixedDate, Object, Error, JSON }));
}

test('an expired ID token in an external browser starts one fresh LINE login', () => {
  const context = browser();
  vm.runInContext(read('liff-request-auth.js'), context);
  const auth = context.CMWebsLiffRequestAuth;
  assert.equal(auth.idTokenExpired(), true);
  assert.equal(auth.getIdToken(), '');
  assert.deepEqual(context.calls, [
    ['logout'],
    ['login', 'https://example.test/cmwebs/landlord-home.html?tab=rooms']
  ], 'returns to the same page without replaying the OAuth code');
  assert.throws(
    () => auth.withIdToken('https://example.test/exec?v2_action=landlord_home'),
    { code: 'AUTH_REQUIRED' },
    'no expired token is sent while the login redirect runs'
  );
  assert.equal(context.calls.length, 2, 'the guard blocks a second redirect');
});

test('the relogin guard hands the token to the server instead of looping', () => {
  const context = browser();
  vm.runInContext(read('liff-request-auth.js'), context);
  context.sessionStorage.setItem('cmwebs_line_id_token_relogin_at', String(NOW - 30000));
  assert.equal(context.CMWebsLiffRequestAuth.getIdToken(), 'id-token-fixture');
  assert.deepEqual(context.calls, []);
});

test('fresh tokens, the LINE app and an uninitialised SDK never redirect', () => {
  const fresh = browser({ exp: FRESH });
  vm.runInContext(read('liff-request-auth.js'), fresh);
  assert.equal(fresh.CMWebsLiffRequestAuth.getIdToken(), 'id-token-fixture');
  assert.equal(fresh.CMWebsLiffRequestAuth.idTokenExpired(), false);

  const native = browser({ inClient: true });
  vm.runInContext(read('liff-request-auth.js'), native);
  assert.equal(native.CMWebsLiffRequestAuth.getIdToken(), 'id-token-fixture');

  const loggedOut = browser({ loggedIn: false });
  vm.runInContext(read('liff-request-auth.js'), loggedOut);
  assert.equal(loggedOut.CMWebsLiffRequestAuth.getIdToken(), 'id-token-fixture');

  const uninitialised = browser();
  uninitialised.liff.isLoggedIn = () => { throw new Error('liffId is necessary for liff.init()'); };
  uninitialised.liff.getIDToken = () => { throw new Error('liffId is necessary for liff.init()'); };
  uninitialised.liff.getDecodedIDToken = () => { throw new Error('liffId is necessary for liff.init()'); };
  vm.runInContext(read('liff-request-auth.js'), uninitialised);
  assert.equal(uninitialised.CMWebsLiffRequestAuth.getIdToken(), '');

  for (const context of [fresh, native, loggedOut, uninitialised]) assert.deepEqual(context.calls, []);
});

test('landlord auth params use the shared renewal', () => {
  const context = browser();
  vm.runInContext(read('liff-request-auth.js'), context);
  vm.runInContext(read('landlord-auth.js'), context);
  const auth = context.CMWebsLandlordAuth.init({ liffId: 'synthetic', lineUserId: 'U-fixture' });
  assert.deepEqual({ ...auth.getRequestAuthParams() }, { line_user_id: 'U-fixture', id_token: '' });
  assert.equal(context.calls[1][0], 'login');
});

const entrySource = read('landlord-entry.html');
function extract(name) {
  const marker = 'function ' + name + '(';
  const start = entrySource.indexOf(marker);
  let depth = 0;
  for (let i = entrySource.indexOf('{', start); i < entrySource.length; i++) {
    if (entrySource[i] === '{') depth++;
    if (entrySource[i] === '}' && --depth === 0) {
      return (entrySource.slice(start - 6, start) === 'async ' ? 'async ' : '') + entrySource.slice(start, i + 1);
    }
  }
  throw new Error('missing ' + name);
}

function entry({ exp = EXPIRED, inClient = false, guarded = false, status } = {}) {
  const app = { innerHTML: '' };
  const context = browser({ exp, inClient, href: 'https://example.test/cmwebs/landlord-entry.html?code=private' });
  Object.assign(context.location, { origin: 'https://example.test', pathname: '/cmwebs/landlord-entry.html', protocol: 'https:', replace() {} });
  vm.runInContext(read('liff-request-auth.js'), context);
  if (guarded) context.sessionStorage.setItem('cmwebs_line_id_token_relogin_at', String(NOW - 1000));
  Object.assign(context, {
    TEST_MODE: false, EMAIL_LOGIN_MODE: false, EXPLICIT_LINE_LOGIN_CHOICE: false, LIFF_ID: 'fixture-liff',
    STAY_MODE: false, RETURN_TO: 'landlord-home.html', LINE_USER_ID: '', innerWidth: 390,
    safeHtml: String, initAuthClient: () => null, hasLineFallbackIntent: () => false,
    clearLineFallbackIntent() {}, isInvitationReturnTo: () => false, resolveReturnTo: () => 'landlord-home.html',
    renderEmailLogin() { throw new Error('LINE path must not show the Email form'); },
    fetchStatusJson: async () => { context.calls.push(['status']); return status; },
    document: { getElementById: () => app, querySelectorAll: () => [] }
  });
  context.liff.init = async () => {};
  context.liff.getProfile = async () => { context.calls.push(['profile']); return { userId: 'U-fixture' }; };
  vm.runInContext('let entryReloginInFlight_=false;\n' + [
    'isEntryLineSessionError', 'entryWebRedirectUri', 'entryReloginUrl', 'renderEntryLoginExpired',
    'restartEntryLineLogin', 'renderError', 'initLine', 'loadPage'
  ].map(extract).join('\n'), context);
  return { context, app };
}

test('entry renews an expired ID token before asking for the LINE profile', async () => {
  const { context } = entry();
  assert.equal(await context.initLine(), false);
  assert.deepEqual(context.calls, [
    ['logout'],
    ['login', 'https://example.test/cmwebs/landlord-entry.html?return_to=landlord-home.html']
  ]);
});

test('entry inside the LINE app shows the re-login card for an expired ID token', async () => {
  const { context, app } = entry({ inClient: true });
  assert.equal(await context.initLine(), false);
  assert.match(app.innerHTML, /LINE 登入已過期/);
  assert.deepEqual(context.calls, []);
});

test('entry continues with a fresh token or once the relogin guard is set', async () => {
  const fresh = entry({ exp: FRESH });
  assert.equal(await fresh.context.initLine(), true);
  assert.deepEqual(fresh.context.calls, [['profile']]);

  const guarded = entry({ guarded: true });
  assert.equal(await guarded.context.initLine(), true);
  assert.deepEqual(guarded.context.calls, [['profile']]);
});

test('a backend AUTH_REQUIRED shows the re-login card, not a dead-end error', async () => {
  const { context, app } = entry({
    exp: FRESH,
    status: { success: false, code: 'AUTH_REQUIRED', message: '請重新登入後再試' }
  });
  await context.loadPage();
  assert.match(app.innerHTML, /LINE 登入已過期/);
  assert.match(app.innerHTML, /重新登入 LINE/);
  assert.doesNotMatch(app.innerHTML, /房東入口載入失敗|landlord-register/);

  const other = entry({ exp: FRESH, status: { success: false, code: 'WORKSPACE_MISSING', message: '找不到管理團隊' } });
  await other.context.loadPage();
  assert.match(other.app.innerHTML, /房東入口載入失敗/);
  assert.match(other.app.innerHTML, /找不到管理團隊/);
});
