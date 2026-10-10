import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const page = readFileSync(new URL('../landlord-more.html', import.meta.url), 'utf8');
assert.match(page, /landlord-auth\.js\?v=/, 'More must load shared landlord authentication');
assert.match(page, /landlord-responsive\.css\?v=/, 'More must use the desktop shell styles');
assert.match(page, /class="app-shell desktop-ready"/, 'More must expose the desktop shell');
assert.match(page, /class="desktop-sidebar"/, 'More must retain desktop navigation');

const script = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .find(body => body.includes('async function loadSummary'));
assert.ok(script);

let mode = 'email';
let token = 'session-present';
const bridgeActions = [];
const lineActions = [];
let lineLoginCalls = 0;
let idTokenCalls = 0;
const subscriptionRequests = [];
let replaced = '';
const dom = new Map();
const element = () => ({
  textContent: '', hidden: false,
  classList: { add() {}, remove() {} },
  setAttribute() {}
});
const auth = {
  init() { return this; },
  getMode() { return mode; },
  getRequestAuthParams() {
    return token ? { response_mode: 'bridge', landlord_session_token: token } : { line_user_id: '' };
  },
  async request(action) {
    bridgeActions.push(action);
    return { success: true, data: { summary: { pending: 0 } } };
  },
  async requestProtected(action, params) {
    subscriptionRequests.push({ action, params });
    return { success: true, data: { mode: 'observe', status: 'NONE', rooms_used: 21, rooms_max: null } };
  },
  handleAuthFailure() { return false; }
};
const location = {
  href: 'https://example.test/cmwebs-liff/landlord-more.html',
  search: '', pathname: '/cmwebs-liff/landlord-more.html',
  replace(value) { replaced = value; }
};
const context = {
  URL, URLSearchParams, location,
  document: {
    documentElement: { style: { setProperty() {} } },
    body: { classList: { add() {}, remove() {} } },
    addEventListener() {},
    getElementById(id) {
      if (!dom.has(id)) dom.set(id, element());
      return dom.get(id);
    }
  },
  sessionStorage: { setItem() {} },
  CMWebsLandlordAuth: auth,
  CMWebsLandlordApi: {
    async request({ action }) {
      lineActions.push(action);
      return { success: true, data: { summary: { pending: 0 } } };
    }
  },
  liff: {
    async init() { lineLoginCalls++; },
    isLoggedIn() { return true; },
    getIDToken() {
      idTokenCalls++;
      if (!lineLoginCalls) throw new Error('LIFF is not initialized');
      return 'isolated-line-id-token';
    },
    async getProfile() { return { userId: 'line-user' }; }
  },
  visualViewport: { height: 900, addEventListener() {} },
  innerHeight: 900, addEventListener() {},
  setTimeout() { return 1; }, clearTimeout() {},
  console: { warn() {} }
};
context.window = context;
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../platform-core-subscription.js', import.meta.url), 'utf8'), context);
vm.runInContext(script.replace(/\n\s*loadSummary\(\);\s*$/, '\n'), context);

assert.equal(await context.ensureLandlordAuthReady(), true);
assert.equal(lineLoginCalls, 0, 'Email session must never initialize LIFF');
const emailResult = await context.jsonpRequest('landlord_workspace_context', {});
assert.equal(emailResult.success, true);
assert.deepEqual(bridgeActions, ['landlord_workspace_context']);
assert.deepEqual(lineActions, []);

await context.loadSummary();
assert.match(dom.get('platformCoreSubscriptionStatus').textContent, /無有效訂閱/,
  'Email subscription card must reach the protected backend while LIFF remains uninitialized');
assert.equal(idTokenCalls, 0, 'Email subscription reads must not call the LINE SDK');
assert.equal(subscriptionRequests[0].action, 'landlord_subscription_init');
assert.equal(subscriptionRequests[0].params.id_token, undefined);

token = '';
assert.equal(await context.ensureLandlordAuthReady(), false);
assert.equal(new URL(replaced).pathname, '/cmwebs-liff/landlord-entry.html');
assert.equal(new URL(replaced).searchParams.get('mode'), 'email');
assert.equal(new URL(replaced).searchParams.get('return_to'), 'landlord-more.html');
assert.equal(lineLoginCalls, 0, 'Missing desktop session must not fall back to LINE');

mode = 'line';
assert.equal(await context.ensureLandlordAuthReady(), true);
assert.equal(lineLoginCalls, 1);
await context.jsonpRequest('landlord_workspace_context', {});
assert.deepEqual(lineActions, ['landlord_workspace_context']);

await context.loadSummary();
assert.match(dom.get('platformCoreSubscriptionStatus').textContent, /無有效訂閱/);
assert.equal(idTokenCalls, 1, 'LINE subscription reads must retain verified ID-token transport');
assert.equal(subscriptionRequests[1].params.id_token, 'isolated-line-id-token');

console.log('Landlord More desktop Email authentication regression passed.');
