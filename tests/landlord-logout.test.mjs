import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const LOGGED_OUT_URL = 'landlord-entry.html?mode=email&logged_out=1';
const TOKEN_KEY = 'cmwebs_landlord_session_token';
const SANDBOX_ORIGIN = 'https://n-fixture-script.googleusercontent.com';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

// The desktop sidebar calls logout() and returns, so logout alone must leave
// the page. Before this it resolved without navigating anywhere.
function authPage({ token = '' } = {}) {
  const redirects = [];
  const timers = [];
  const listeners = [];
  const forms = [];
  const buttons = [{ disabled: false, textContent: '登出' }];
  const local = memoryStorage({ cmwebs_landlord_home_cache_v1: '{}' });
  const session = memoryStorage(token ? { [TOKEN_KEY]: token } : {});
  const element = tag => {
    const node = { tag, style: {}, children: [], appendChild(child) { this.children.push(child); }, setAttribute() {} };
    if (tag === 'form') {
      node.submit = () => forms.push(node);
      forms.current = node;
    }
    return node;
  };
  const context = vm.createContext({
    URL, URLSearchParams, Date, Math, clearTimeout() {},
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
    location: { href: 'https://example.test/landlord-home.html', replace: url => redirects.push(url) }
  });
  context.window = Object.assign(context, {
    localStorage: local,
    sessionStorage: session,
    addEventListener: (name, listener) => listeners.push(listener),
    removeEventListener() {}
  });
  context.document = {
    createElement: element,
    body: { appendChild() {} },
    querySelectorAll: selector => (selector === '.desktop-logout-button' ? buttons : [])
  };
  vm.runInContext(read('landlord-auth.js'), context);
  const auth = context.CMWebsLandlordAuth.init({ apiUrl: 'https://script.example.test/exec', entryPage: 'landlord-entry.html', returnTo: 'landlord-home.html' });
  const answer = payload => {
    const id = forms[0].children.find(child => child.name === 'request_id').value;
    listeners.at(-1)({ source: null, origin: SANDBOX_ORIGIN, data: { source: 'CMWEBS_APPS_SCRIPT', requestId: id, payload } });
  };
  const field = name => forms[0].children.find(child => child.name === name)?.value;
  return { auth, answer, buttons, field, forms, local, redirects, session, timers };
}

test('a LINE logout leaves the page at once without calling the backend', async () => {
  const page = authPage();
  await page.auth.logout();
  assert.deepEqual(page.redirects, [LOGGED_OUT_URL]);
  assert.equal(page.forms.length, 0);
  assert.equal(page.local.getItem('cmwebs_landlord_home_cache_v1'), null);
});

test('an Email logout clears the token first and leaves after the backend answers', async () => {
  const page = authPage({ token: 'token-fixture' });
  const finished = page.auth.logout();
  assert.equal(page.session.getItem(TOKEN_KEY), null, 'the token goes before any answer');
  assert.deepEqual(page.redirects, [], 'stays until the revoke answers');
  assert.equal(page.field('action'), 'landlord_email_session_revoke');
  assert.equal(page.field('landlord_session_token'), 'token-fixture');
  page.answer({ success: true, code: 'OK' });
  await finished;
  assert.deepEqual(page.redirects, [LOGGED_OUT_URL]);
});

test('a slow or rejected revoke still leaves the page', async () => {
  const slow = authPage({ token: 'token-fixture' });
  const slowFinished = slow.auth.logout();
  const timer = slow.timers.at(-1);
  assert.equal(timer.delay, 10000, 'logout does not wait the full bridge timeout');
  timer.callback();
  await slowFinished;
  assert.deepEqual(slow.redirects, [LOGGED_OUT_URL]);

  const expired = authPage({ token: 'token-fixture' });
  const expiredFinished = expired.auth.logout();
  expired.answer({ success: false, code: 'SESSION_EXPIRED', message: '請重新登入' });
  await expiredFinished;
  assert.deepEqual(expired.redirects, [LOGGED_OUT_URL], 'no competing auth-error redirect');
});

test('the button shows progress and a second click starts nothing new', async () => {
  const page = authPage({ token: 'token-fixture' });
  const first = page.auth.logout();
  const second = page.auth.logout();
  assert.equal(first, second);
  assert.equal(page.forms.length, 1);
  assert.equal(page.buttons[0].disabled, true);
  assert.equal(page.buttons[0].textContent, '登出中…');
  page.answer({ success: true, code: 'OK' });
  await first;
  assert.equal(page.redirects.length, 1);
});

test('no page redirects again after logout, which would drop the logged-out step', () => {
  for (const name of [
    'landlord-home', 'landlord-arrears', 'landlord-contract-requests', 'landlord-properties',
    'landlord-revenue-dashboard', 'landlord-rooms', 'landlord-settings', 'landlord-tenant-detail',
    'landlord-tenants'
  ]) {
    const source = read(`${name}.html`);
    assert.match(source, /CMWebsLandlordAuth\.logout\(\);\s*return;/, name);
    assert.doesNotMatch(source, /logout\(\)\s*\.(then|finally)/, name);
  }
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

function entryPage({ loggedIn = true, inClient = false, initError = null } = {}) {
  const calls = [];
  const rendered = [];
  const url = 'https://example.test/landlord-entry.html?mode=email&logged_out=1';
  const context = vm.createContext({
    URL, LIFF_ID: 'liff-fixture', location: { href: url },
    LINE_FALLBACK_INTENT_KEY: 'cmwebs_landlord_line_fallback_intent',
    sessionStorage: memoryStorage({
      cmwebs_landlord_return_to: 'landlord-rooms.html',
      cmwebs_landlord_line_fallback_intent: '1'
    }),
    history: { replaceState: (state, title, next) => calls.push(['url', next]) },
    renderEmailLogin: state => rendered.push(state),
    liff: {
      init: async () => { if (initError) throw initError; calls.push(['init']); },
      isLoggedIn: () => loggedIn,
      isInClient: () => inClient,
      logout: () => calls.push(['logout'])
    }
  });
  vm.runInContext([extract('clearLineFallbackIntent'), extract('finishLogout')].join('\n'), context);
  return { calls, context, rendered };
}

test('the entry page logs LINE out, drops the marker and shows the login form', async () => {
  const { calls, context, rendered } = entryPage();
  await context.finishLogout();
  assert.deepEqual(calls, [
    ['init'],
    ['logout'],
    ['url', 'https://example.test/landlord-entry.html?mode=email']
  ]);
  assert.equal(rendered[0].message, '你已登出。');
  assert.equal(context.sessionStorage.getItem('cmwebs_landlord_return_to'), null, 'the next login starts clean');
  assert.equal(context.sessionStorage.getItem('cmwebs_landlord_line_fallback_intent'), null);
});

test('the LINE app and a signed-out browser skip liff.logout', async () => {
  for (const options of [{ inClient: true }, { loggedIn: false }]) {
    const { calls, context, rendered } = entryPage(options);
    await context.finishLogout();
    assert.equal(calls.some(([name]) => name === 'logout'), false);
    assert.equal(rendered[0].message, '你已登出。');
  }
});

test('a failed LINE logout says so and keeps the marker for a refresh', async () => {
  const { calls, context, rendered } = entryPage({ initError: new Error('network') });
  await context.finishLogout();
  assert.deepEqual(calls, []);
  assert.equal(rendered[0].error, true);
  assert.match(rendered[0].message, /LINE 登出未完成/);
});

test('the entry page never starts automatic login on the logged-out visit', () => {
  assert.match(entrySource, /if \(LOGGED_OUT_MODE\) finishLogout\(\);\s*else loadPage\(\);/);
  assert.equal(entrySource.match(/\n\s*loadPage\(\);\n\s*<\/script>/), null);
});
