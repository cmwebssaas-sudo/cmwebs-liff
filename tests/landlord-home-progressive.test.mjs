import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../landlord-home.html', import.meta.url), 'utf8');
const load = source.slice(source.indexOf('    async function loadPage()'), source.indexOf('\n    setAppHeight();', source.indexOf('    async function loadPage()')));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

// Only browser/network boundaries are fake; the real loadPage source runs.
function homeFixture(cachedEntry = null) {
  const requests = [], reports = [], rendered = [], charts = [], errors = [], toasts = [], busy = [], live = [], cacheWrites = [];
  let cacheCleared = 0;
  const status = { textContent: '' };
  const context = vm.createContext({
    pageRequestToken_: 0, homeLoadInProgress_: false, homeRendered_: false, homeShown_: null,
    ensureLandlordAuthReady: async () => true,
    setRefreshLoading: value => busy.push(value),
    jsonpRequest: (action, params) => { const item = deferred(); requests.push({ ...item, section: params.section }); return item.promise; },
    unwrapData: result => result.data,
    renderHome: (home, summary, preserve, options) => rendered.push({ home, summary, preserve, options: options || {} }),
    renderLandlordDashboardCharts_: report => charts.push(report),
    buildActionSummary: () => ({ paymentPending: 3 }),
    requestDashboardReport_: () => { const item = deferred(); reports.push(item); return item.promise; },
    loadDashboardReport_: () => Promise.resolve(),
    homeCacheIdentity_: async () => 'identity-hash',
    readHomeCache_: identity => identity === 'identity-hash' ? cachedEntry : null,
    writeHomeCache_: (identity, patch) => cacheWrites.push({ identity, patch }),
    clearHomeCache_: () => { cacheCleared++; cachedEntry = null; },
    setHomeLiveStatus_: (state, text) => live.push({ state, text }),
    renderError: error => errors.push(error), showToast: message => toasts.push(message),
    document: { getElementById: () => status }
  });
  vm.runInContext(load, context);
  return { context, requests, reports, rendered, charts, errors, toasts, busy, live, status, cacheWrites, cleared: () => cacheCleared };
}

{
  const f = homeFixture();
  const first = f.context.loadPage();
  await tick();
  await f.context.loadPage();
  assert.deepEqual(f.requests.map(item => item.section), ['home', 'actions'],
    'home and action reads start together; rapid refresh clicks cannot create extra requests');
  assert.equal(f.reports.length, 1, 'the chart read starts with them instead of waiting for the first render');
  assert.equal(f.rendered.length, 0, 'nothing is painted before data or a matching snapshot exists');
  f.requests[0].resolve({ data: { home: { latest_total_amount: 100 } } });
  await tick();
  assert.equal(f.rendered.length, 1, 'core appears while action query is still pending');
  assert.equal(f.rendered[0].summary, null, 'unknown counts must not be reported as zero');
  assert.deepEqual(JSON.parse(JSON.stringify(f.cacheWrites.at(-1))), { identity: 'identity-hash', patch: { home: { latest_total_amount: 100 } } });
  f.requests[1].reject(new Error('slow secondary module'));
  f.reports[0].resolve({ data: { months: [] } });
  await first;
  assert.equal(f.errors.length, 0, 'secondary failure does not replace the useful home');
  assert.match(f.status.textContent, /暫時無法更新/);
  assert.equal(f.busy.at(-1), false);

  const refresh = f.context.loadPage(); await tick();
  f.requests[2].reject(Object.assign(new Error('API 載入逾時'), { code: 'API_TIMEOUT' }));
  await refresh;
  assert.equal(f.errors.length, 0);
  assert.match(f.toasts[0], /上次資料/);
  assert.equal(f.live.at(-1).state, 'error', 'the hero says the figures could not be refreshed');
  assert.equal(f.cleared(), 0, 'a timeout keeps the last good snapshot');

  const denied = f.context.loadPage(); await tick();
  f.requests[4].reject(Object.assign(new Error('Session expired'), { code: 'SESSION_EXPIRED' }));
  await denied;
  assert.equal(f.errors.length, 1, 'auth failure must not retain old financial data');
  assert.equal(f.context.homeRendered_, false);
  assert.equal(f.cleared(), 1, 'auth failure drops the browser snapshot');
}

{
  const cached = { saved_at: 1791650000000, home: { paid_total_amount: 80 }, report: { months: [1] },
    action_summary: { paymentPending: 1 } };
  const f = homeFixture(cached);
  const run = f.context.loadPage();
  await tick();
  assert.equal(f.rendered.length, 1, 'a matching snapshot paints before the network answers');
  assert.equal(f.rendered[0].home, cached.home);
  assert.equal(f.rendered[0].options.staleSavedAt, cached.saved_at, 'cached figures are labelled as old');
  assert.deepEqual(f.charts, [cached.report]);
  assert.match(f.status.textContent, /上次待辦數量/);
  f.requests[0].resolve({ data: { home: { paid_total_amount: 90 } } });
  await tick();
  assert.equal(f.rendered[1].home.paid_total_amount, 90);
  assert.equal(f.rendered[1].options.keepDashboard, true, 'fresh figures replace the hero without blanking the cached chart');
  assert.equal(f.rendered[1].options.staleSavedAt, undefined);
  f.requests[1].resolve({ data: {} });
  f.reports[0].resolve({ data: { months: [2] } });
  await run;
  assert.equal(f.rendered.at(-1).preserve, true, 'late counts still update in place');
  assert.ok(f.cacheWrites.some(item => item.patch.report && item.patch.report.months[0] === 2));
  assert.ok(f.cacheWrites.some(item => item.patch.action_summary));
}

{
  const f = homeFixture({ saved_at: 1, home: { paid_total_amount: 1 } });
  f.context.homeCacheIdentity_ = async () => '';
  f.context.readHomeCache_ = identity => identity ? { home: {} } : null;
  const run = f.context.loadPage(); await tick();
  assert.equal(f.rendered.length, 0, 'no verified identity means no snapshot');
  f.requests[0].resolve({ data: { home: {} } }); f.requests[1].resolve({ data: {} }); f.reports[0].resolve({ data: {} });
  await run;
}

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
