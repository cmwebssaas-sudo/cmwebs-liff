import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../landlord-home.html', import.meta.url),
  'utf8'
);

function extractFunction(name) {
  const functionStart = source.indexOf(`function ${name}(`);
  assert.notEqual(functionStart, -1, `${name} must exist`);
  const asyncStart = source.lastIndexOf('async ', functionStart);
  const start =
    asyncStart >= 0 &&
    source.slice(asyncStart, functionStart) === 'async '
      ? asyncStart
      : functionStart;
  const openingBrace = source.indexOf('{', functionStart);
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`Could not extract ${name}`);
}

const context = { Math, Number, String, Object, Array };
vm.createContext(context);
vm.runInContext(
  [
    extractFunction('normaliseLandlordDashboardData_'),
    extractFunction('contractExpiryBuckets_'),
    extractFunction('dashboardSeriesColor_')
  ].join('\n'),
  context
);

const report = context.normaliseLandlordDashboardData_({
  months: [{ month: '2026-08', receivable: 287500, collected: 264000, outstanding: 23500 }],
  occupancy: { occupancy_rate: 0.95 },
  contract_expiry: [
    { bucket: '0-30', count: 2 },
    { bucket: '31-60', count: 4 }
  ]
});

assert.deepEqual(JSON.parse(JSON.stringify(report.months)), [
  { month: '2026-08', receivable: 287500, collected: 264000, outstanding: 23500 }
]);
assert.equal(report.occupancy.occupancy_rate, 0.95);
assert.deepEqual(JSON.parse(JSON.stringify(context.contractExpiryBuckets_(report.contract_expiry))), [
  { key: '30d', label: '30 天', count: 2 },
  { key: '60d', label: '60 天', count: 4 },
  { key: '90d', label: '90 天', count: 0 }
]);
assert.equal(context.dashboardSeriesColor_('receivable'), '#2F6FED');
assert.equal(context.dashboardSeriesColor_('collected'), '#06C755');
assert.equal(context.dashboardSeriesColor_('outstanding'), '#FF6259');

const emptyReport = context.normaliseLandlordDashboardData_({
  months: null,
  occupancy: { occupancy_rate: 'not-a-rate' },
  contract_expiry: [{ bucket: '90+', count: 'not-a-count' }]
});

assert.deepEqual(JSON.parse(JSON.stringify(emptyReport.months)), []);
assert.equal(emptyReport.occupancy.occupancy_rate, 0);
assert.deepEqual(JSON.parse(JSON.stringify(context.contractExpiryBuckets_(emptyReport.contract_expiry))), [
  { key: '30d', label: '30 天', count: 0 },
  { key: '60d', label: '60 天', count: 0 },
  { key: '90d', label: '90 天', count: 0 }
]);

for (const marker of [
  '本月營運總覽',
  '近 12 個月收租趨勢',
  '查看收入明細',
  '入住率',
  '合約到期',
  '30 天',
  '60 天',
  '90 天',
  'landlordRevenueChart',
  'landlordOccupancyChart',
  'landlordContractExpiryChart',
  'landlordDashboardState',
  '#2F6FED',
  '#06C755',
  '#FF6259',
  'aria-label="應收',
  'aria-label="已收',
  'aria-label="欠款'
]) {
  assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')), `missing dashboard UI marker: ${marker}`);
}

const mobileCssStart = source.indexOf('@media (max-width: 390px)');
const mobileCss = source.slice(mobileCssStart, source.indexOf('</style>'));
assert.match(
  mobileCss,
  /\.dashboard-kpi-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/,
  'mobile KPI cards must use two columns so currency values remain readable'
);
assert.match(
  mobileCss,
  /\.dashboard-kpi-value\s*\{[\s\S]*?overflow:\s*visible[\s\S]*?text-overflow:\s*clip/,
  'mobile KPI currency values must not be truncated with an ellipsis'
);

const chartElements = new Map([
  ['landlordDashboardState', { innerHTML: '' }],
  ['homeRoot', { innerHTML: 'home-content' }]
]);
const chartContext = {
  Math,
  Number,
  String,
  Object,
  Array,
  document: {
    getElementById(id) {
      return chartElements.get(id) || null;
    }
  }
};

vm.runInNewContext(
  [
    extractFunction('normaliseLandlordDashboardData_'),
    extractFunction('contractExpiryBuckets_'),
    extractFunction('dashboardSeriesColor_'),
    extractFunction('dashboardNumber_'),
    extractFunction('dashboardMoney_'),
    extractFunction('dashboardPercent_'),
    extractFunction('dashboardEscape_'),
    extractFunction('dashboardLineChartSvg_'),
    extractFunction('dashboardDonutSvg_'),
    extractFunction('dashboardExpiryChartSvg_'),
    extractFunction('renderLandlordDashboardCharts_'),
    extractFunction('renderLandlordDashboardError_')
  ].join('\n'),
  chartContext
);

chartContext.renderLandlordDashboardCharts_({
  months: report.months,
  occupancy: report.occupancy,
  contract_expiry: report.contract_expiry
});
assert.match(
  chartElements.get('landlordDashboardState').innerHTML,
  /landlordRevenueChart/
);
assert.match(
  chartElements.get('landlordDashboardState').innerHTML,
  /landlordOccupancyChart/
);
assert.match(
  chartElements.get('landlordDashboardState').innerHTML,
  /landlordContractExpiryChart/
);
assert.match(
  chartElements.get('landlordDashboardState').innerHTML,
  /30 天 2 份/
);
assert.match(
  chartElements.get('landlordDashboardState').innerHTML,
  /60 天 4 份/
);
assert.match(
  chartElements.get('landlordDashboardState').innerHTML,
  /90 天 0 份/
);

chartContext.renderLandlordDashboardError_('圖表暫時無法載入');
assert.match(
  chartElements.get('landlordDashboardState').innerHTML,
  /圖表暫時無法載入/
);
assert.equal(
  chartElements.get('homeRoot').innerHTML,
  'home-content',
  'chart-local errors must not replace the home root'
);

for (const marker of [
  'JSONP_REQUEST_TIMEOUT_MS',
  'JSONP_REQUEST_MAX_ATTEMPTS',
  'JSONP_REQUEST_RETRY_DELAY_MS',
  'function jsonpRequestOnce(',
  'function jsonpRequest(',
  'script.onerror',
  'retryOnTimeout',
  'function shouldRetryDashboardRequest_(',
  'function loadDashboardReport_(',
  'pageRequestToken_'
]) {
  assert.ok(source.includes(marker), `missing resilient loading marker: ${marker}`);
}

const requestContext = {};
vm.runInNewContext(
  [extractFunction('shouldRetryDashboardRequest_')].join('\n'),
  requestContext
);
assert.equal(
  requestContext.shouldRetryDashboardRequest_({ message: 'API 載入逾時' }, 1, 2),
  true
);
assert.equal(
  requestContext.shouldRetryDashboardRequest_({ message: '網路錯誤' }, 1, 2),
  false,
  'network errors must not be retried'
);
assert.equal(
  requestContext.shouldRetryDashboardRequest_({ message: 'API 載入逾時' }, 2, 2),
  false,
  'the final timeout attempt must not be retried'
);

const loadPageSource = extractFunction('loadPage');
assert.ok(
  source.includes('function requestDashboardReport_('),
  'dashboard report requests must be startable before the homepage bootstrap finishes'
);
const reportRequestStartIndex = loadPageSource.indexOf('requestDashboardReport_(');
const bootstrapRequestIndex = loadPageSource.indexOf("'landlord_home_bootstrap'");
assert.ok(
  reportRequestStartIndex >= 0 && reportRequestStartIndex < bootstrapRequestIndex,
  'dashboard report request must start before the blocking homepage bootstrap request'
);
assert.ok(
  loadPageSource.indexOf('renderHome(') >= 0,
  'bootstrap success must render the shell'
);
assert.ok(
  loadPageSource.indexOf('loadDashboardReport_(') >= 0,
  'dashboard report must load after the shell'
);
assert.ok(
  loadPageSource.indexOf('renderHome(') < loadPageSource.indexOf('loadDashboardReport_('),
  'dashboard report must not block the initial home shell'
);

function createJsonpRuntime(appendScript) {
  const runtime = {
    Math,
    Number,
    String,
    Object,
    Array,
    Promise,
    URL,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout,
    clearTimeout,
    API_URL: 'https://example.test/exec',
    LINE_USER_ID: 'U-test',
    TEST_MODE: false,
    JSONP_REQUEST_TIMEOUT_MS: 5,
    JSONP_REQUEST_RETRY_DELAY_MS: 1,
    JSONP_REQUEST_MAX_ATTEMPTS: 2,
    document: {
      createElement() {
        return { parentNode: null };
      },
      body: {
        appendChild: appendScript
      }
    }
  };
  runtime.window = runtime;
  return runtime;
}

let attemptCount = 0;
let retryRuntime;
retryRuntime = createJsonpRuntime((script) => {
  attemptCount += 1;
  script.parentNode = {
    removeChild() {
      script.parentNode = null;
    }
  };

  if (attemptCount === 2) {
    const callbackName = decodeURIComponent(
      script.src.split('callback=')[1].split('&')[0]
    );
    setTimeout(() => {
      retryRuntime[callbackName]({ success: true });
    }, 0);
  }
});
vm.runInNewContext(
  [
    extractFunction('jsonpRequestOnce'),
    extractFunction('shouldRetryDashboardRequest_'),
    extractFunction('jsonpRequest')
  ].join('\n'),
  retryRuntime
);

const retryResult = await retryRuntime.jsonpRequest(
  'landlord_revenue_dashboard_init',
  {},
  { timeoutMs: 5, maxAttempts: 2, retryOnTimeout: true }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(retryResult)),
  { success: true }
);
assert.equal(attemptCount, 2, 'read timeout should retry exactly once');

let errorScript;
const errorRuntime = createJsonpRuntime((script) => {
  errorScript = script;
  script.parentNode = {
    removeChild() {
      script.parentNode = null;
    }
  };
  script.onerror();
});
vm.runInNewContext(
  [extractFunction('jsonpRequestOnce')].join('\n'),
  errorRuntime
);
await assert.rejects(
  errorRuntime.jsonpRequestOnce(
    'landlord_revenue_dashboard_init',
    {},
    1000
  ),
  /API 路由執行失敗/
);
assert.equal(errorScript.parentNode, null, 'script.onerror must clean up the script');

console.log('Phase 193 landlord home dashboard data contract tests passed.');
