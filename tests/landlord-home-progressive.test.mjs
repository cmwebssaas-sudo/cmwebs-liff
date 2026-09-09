import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../landlord-home.html', import.meta.url), 'utf8');
const load = source.slice(source.indexOf('    async function loadPage()'), source.indexOf('\n    setAppHeight();', source.indexOf('    async function loadPage()')));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const requests = [], rendered = [], errors = [], toasts = [], busy = [];
const status = { textContent: '' };
const context = vm.createContext({
  pageRequestToken_: 0, homeLoadInProgress_: false, homeRendered_: false,
  ensureLandlordAuthReady: async () => true,
  setRefreshLoading: value => busy.push(value),
  jsonpRequest: (action, params) => { const item = deferred(); requests.push({ ...item, section: params.section }); return item.promise; },
  unwrapData: result => result.data,
  renderHome: (home, summary, preserve) => rendered.push({ home, summary, preserve }),
  buildActionSummary: () => ({ paymentPending: 3 }),
  requestDashboardReport_: () => { assert.ok(rendered.length, 'core renders before charts start'); return Promise.resolve({}); },
  loadDashboardReport_: () => Promise.resolve(),
  renderError: error => errors.push(error), showToast: message => toasts.push(message),
  document: { getElementById: () => status }
});
vm.runInContext(load, context);
const tick = () => new Promise(resolve => setImmediate(resolve));
const first = context.loadPage();
await tick();
await context.loadPage();
assert.equal(requests.length, 1, 'rapid refresh clicks cannot create extra requests');
assert.equal(requests[0].section, 'home');
requests[0].resolve({ data: { home: { latest_total_amount: 100 } } });
await tick();
assert.equal(rendered.length, 1, 'core appears while action query is still pending');
assert.equal(rendered[0].summary, null, 'unknown counts must not be reported as zero');
assert.equal(requests[1].section, 'actions');
requests[1].reject(new Error('slow secondary module'));
await first;
assert.equal(errors.length, 0, 'secondary failure does not replace the useful home');
assert.match(status.textContent, /暫時無法更新/);
assert.equal(busy.at(-1), false);
const refresh = context.loadPage(); await tick();
requests[2].reject(Object.assign(new Error('API 載入逾時'), { code: 'API_TIMEOUT' }));
await refresh;
assert.equal(errors.length, 0);
assert.match(toasts[0], /上次資料/);
const denied = context.loadPage(); await tick();
requests[3].reject(Object.assign(new Error('Session expired'), { code: 'SESSION_EXPIRED' }));
await denied;
assert.equal(errors.length, 1, 'auth failure must not retain old financial data');
assert.equal(context.homeRendered_, false);

const accessSource = readFileSync(new URL('../apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js', import.meta.url), 'utf8');
const bootstrap = accessSource.slice(accessSource.indexOf('function getWorkspaceLandlordHomeBootstrapByLineUid_('), accessSource.indexOf('function workspaceLandlordBootstrapLegacyIdentity_('));
let homeReads = 0, actionReads = 0;
const backend = vm.createContext({
  workspaceLandlordProxy_: (uid, action, policy, executor) => executor(uid, {}),
  SpreadsheetApp: { getActiveSpreadsheet: () => ({}) },
  workspaceDashboardLoadData_: () => { homeReads++; return {}; },
  workspaceDashboardBuildHomeResult_: () => ({ success: true, data: { amount: 100 } }),
  workspaceLandlordBootstrapLegacyIdentity_: () => ({}),
  workspaceLandlordBootstrapResultData_: result => result.data,
  workspaceResult_: (success, code, message) => ({ success, code, message })
});
for (const name of ['getLandlordContractRequestsInitByLineUid_', 'getLandlordPaymentReportsInitByLineUid', 'getLandlordMessagesInitByLineUid', 'landlordInitiatedContractListByAccess_']) {
  backend[name] = () => { actionReads++; return { success: true, data: {} }; };
}
vm.runInContext(bootstrap, backend);
assert.equal(backend.getWorkspaceLandlordHomeBootstrapByLineUid_('fixture', 'home').success, true);
assert.equal(homeReads, 1); assert.equal(actionReads, 0);
assert.equal(backend.getWorkspaceLandlordHomeBootstrapByLineUid_('fixture', 'actions').success, true);
assert.equal(homeReads, 1, 'actions must not repeat the core dashboard scans');
assert.equal(actionReads, 4);
backend.getWorkspaceLandlordHomeBootstrapByLineUid_('fixture');
assert.equal(homeReads, 2); assert.equal(actionReads, 8, 'legacy combined response remains compatible');
backend.getLandlordMessagesInitByLineUid = () => ({ success: false, code: 'MODULE_FAILURE' });
assert.equal(backend.getWorkspaceLandlordHomeBootstrapByLineUid_('fixture', 'actions').success, false);
console.log('Progressive home, refresh deduplication and failure isolation passed');
