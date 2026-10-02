import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../landlord-home.html', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../landlord-auth.js', import.meta.url), 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1]
  .replace('\n    loadPage();', '');

// Real homepage and shared auth; only browser/network/timer boundaries are fake.
function fixture({ email = false, testMode = false } = {}) {
  const scripts = [], timers = new Map(), nodes = new Map();
  let serial = 0, appWrites = 0;
  function element(id, classes = '') {
    const tokens = new Set(classes.split(/\s+/).filter(Boolean));
    return {
      id, textContent: '', innerHTML: '',
      classList: {
        contains: token => tokens.has(token),
        remove: token => tokens.delete(token),
        toggle(token, enabled) { if (enabled) tokens.add(token); else tokens.delete(token); }
      },
      setAttribute() {},
      replaceWith(replacement) { nodes.set(id, replacement); }
    };
  }
  const app = {
    get innerHTML() { return this.html || ''; },
    set innerHTML(value) {
      this.html = value; appWrites++;
      for (const id of nodes.keys()) if (id !== 'app') nodes.delete(id);
      // Derive available nodes from the real renderer, not a pre-seeded ID list.
      for (const [, attrs] of value.matchAll(/<[a-z][\w-]*\b([^>]*)>/gi)) {
        const id = attrs.match(/\bid="([^"]+)"/);
        if (id) nodes.set(id[1], element(id[1], attrs.match(/\bclass="([^"]*)"/)?.[1] || ''));
      }
    }
  };
  nodes.set('app', app);
  const document = {
    documentElement: { style: { setProperty() {} } },
    getElementById: id => nodes.get(id) || null,
    createElement: tag => ({ tagName: tag, remove() { this.removed = true; } }),
    head: { appendChild: node => scripts.push(node) }
  };
  const storage = new Map(email ? [['cmwebs_landlord_session_token', 'synthetic-session']] : []);
  const context = vm.createContext({
    URL, URLSearchParams, document, innerWidth: 390, innerHeight: 844,
    location: { href: 'https://example.invalid/landlord-home.html', search: testMode ? '?test=1' : '' },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    addEventListener() {}, matchMedia: () => ({ matches: false }),
    setTimeout: callback => { timers.set(++serial, callback); return serial; },
    clearTimeout: id => timers.delete(id)
  });
  context.window = context;
  vm.runInContext(auth, context);
  vm.runInContext(inline, context);
  const sdkCalls = [];
  function installSdk(loggedIn = true) {
    context.liff = {
      init: async options => sdkCalls.push(['init', options.liffId]),
      isLoggedIn: () => loggedIn,
      login: options => sdkCalls.push(['login', options.redirectUri]),
      getProfile: async () => { sdkCalls.push(['profile']); return { userId: 'synthetic-line-user' }; }
    };
  }
  return { context, scripts, timers, nodes, app, writes: () => appWrites, sdkCalls, installSdk };
}

test('homepage does not put third-party SDK downloads on the HTML parser critical path', () => {
  const blocking = [...html.matchAll(/<script\b([^>]*)>/g)]
    .map(match => match[1]).filter(attrs => /src="https?:/.test(attrs) && !/\b(async|defer)\b/.test(attrs));
  assert.equal(blocking.length, 0, 'the shell must be renderable before LINE SDK arrives');
});

test('Email session reaches protected bootstrap readiness without downloading LINE SDK', async () => {
  const f = fixture({ email: true });
  assert.equal(await f.context.ensureLandlordAuthReady(), true);
  assert.equal(f.scripts.length, 0);
  assert.equal(f.context.CMWebsLandlordAuth.getRequestAuthParams().response_mode, 'bridge');
});

test('LINE readiness waits for one lazy SDK download before resolving the real profile', async () => {
  const f = fixture();
  const ready = f.context.ensureLandlordAuthReady().catch(error => error);
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, 'https://static.line-scdn.net/liff/edge/2/sdk.js');
  assert.equal(f.scripts[0].async, true);
  assert.equal(f.sdkCalls.length, 0);
  f.installSdk(); f.scripts[0].onload();
  assert.equal(await ready, true);
  assert.equal(f.context.CMWebsLandlordAuth.getRequestAuthParams().line_user_id, 'synthetic-line-user');
  assert.deepEqual(f.sdkCalls.map(call => call[0]), ['init', 'profile']);
  assert.equal(f.timers.size, 0);
});

for (const failure of ['error', 'timeout', 'missing SDK']) {
  test(`SDK ${failure} fails closed and a manual retry can download again`, async () => {
    const f = fixture();
    const first = f.context.ensureLandlordAuthReady().catch(error => error);
    assert.equal(f.scripts.length, 1);
    const oldOnload = f.scripts[0].onload;
    if (failure === 'error') f.scripts[0].onerror();
    else if (failure === 'timeout') [...f.timers.values()][0]();
    else f.scripts[0].onload();
    assert.match((await first).message, /LIFF SDK/);
    assert.equal(f.context.CMWebsLandlordAuth.getRequestAuthParams().line_user_id, '');
    assert.equal(f.scripts[0].removed, true);
    assert.equal(f.timers.size, 0);
    const second = f.context.ensureLandlordAuthReady().catch(error => error);
    assert.equal(f.scripts.length, 2);
    oldOnload(); // Late callbacks from a timed-out attempt cannot settle its retry.
    f.installSdk(); f.scripts[1].onload();
    assert.equal(await second, true);
  });
}

test('an already loaded LINE SDK is reused and signed-out users still go through LINE login', async () => {
  const f = fixture();
  f.installSdk(false);
  assert.equal(await f.context.ensureLandlordAuthReady(), false);
  assert.equal(f.scripts.length, 0);
  assert.deepEqual(f.sdkCalls.map(call => call[0]), ['init', 'login']);
  assert.match(f.sdkCalls[1][1], /landlord-entry\.html\?return_to=landlord-home\.html/);
});

test('late action counts update in place without replacing KPI, chart or focused action nodes', () => {
  const f = fixture();
  const home = { latest_total_amount: 1000, paid_total_amount: 800, unpaid_total_amount: 200 };
  f.context.renderHome(home, null);
  const firstHtml = f.app.innerHTML;
  const firstNodes = new Map(f.nodes);
  assert.equal(f.nodes.get('homeActionSection').classList.contains('actions-pending'), true);
  const summary = { paymentPending: 3, contractPending: 2, contractApproved: 1, landlordInitiatedPending: 4,
    messagePending: 5, messageProcessing: 2, messageUrgent: 1 };
  f.context.renderHome(home, summary, true);
  assert.equal(f.writes(), 1, 'secondary counts must not rebuild the entire home');
  assert.equal(f.app.innerHTML, firstHtml);
  for (const [id, node] of firstNodes) assert.equal(f.nodes.get(id), node, `${id} must remain connected`);
  assert.equal(f.nodes.get('homeActionSection').classList.contains('actions-pending'), false,
    'successful secondary counts must clear the pending state');
  assert.match(f.nodes.get('homePaymentBadge').innerHTML, /3 筆/);
  assert.match(f.nodes.get('homeContractBadge').innerHTML, /7 筆/);
  assert.match(f.nodes.get('homeMessageBadge').innerHTML, /緊急 1/);
  assert.equal(f.nodes.get('homeContractDesc').textContent, '待審 2 筆・待完成 1 筆・房東發起 4 筆');
  assert.equal(f.nodes.get('homeMessageDesc').textContent, '待處理 5 筆・處理中 2 筆');
  assert.equal(f.nodes.get('homeActionStatus').textContent, '點擊直接處理');
});
