import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { createPreviewServer, previewHtml } from '../scripts/preview-asset-valuation.mjs';

const backend = vm.createContext({ console, Date });
vm.runInContext(readFileSync(new URL('../apps-script/V2_REPORTING_DASHBOARD.js', import.meta.url), 'utf8'), backend);
const url = new URL('../assets/js/cmwebs-asset-valuation.js', import.meta.url);
const frontend = vm.createContext({});
if (existsSync(url)) vm.runInContext(readFileSync(url, 'utf8'), frontend);
const plain = value => JSON.parse(JSON.stringify(value));

test('sale scenario separates profit from cash after debt and never treats gross rent as net', () => {
  const sale = frontend.CMWebsAssetValuation.saleScenario;
  assert.equal(typeof sale, 'function');
  const inputs = { price: '3000000', tax: '100000', agent: '60000', other: '', loan: '500000', operating: '200000' };
  const value = sale(4000000, 2000000, 800000, inputs);
  assert.equal(value.sale_price, 3000000);
  assert.equal(value.sale_profit, 840000);
  assert.equal(value.sale_return, 42);
  assert.equal(value.cash_received, 2340000);
  assert.equal(value.total_profit, 1440000);
  assert.equal(value.total_return, 72);
  assert.equal(sale(4000000, 2000000, 800000, { ...inputs, price: '' }).sale_profit, 1840000);
  assert.equal(sale(4000000, 2000000, 800000, { ...inputs, operating: '' }).total_profit, null);
  assert.equal(sale(4000000, 2000000, 800000, { ...inputs, loan: '' }).cash_received, null);
  assert.equal(sale(4000000, 2000000, 800000, { ...inputs, tax: '' }).sale_profit, null);
  assert.equal(sale(4000000, null, 800000, inputs).sale_profit, null);
  assert.equal(sale(4000000, 0, 800000, inputs).sale_return, null);
  assert.equal(sale(null, 2000000, 800000, { ...inputs, price: '' }).sale_profit, null);
  assert.ok(Math.abs(sale(4000000, 2000000, 800000, { ...inputs, price: '1000000' }).sale_return + 58) < 1e-10);
  for (const bad of ['-1', 'Infinity', 'abc']) assert.throws(() => sale(4000000, 2000000, 800000, { ...inputs, tax: bad }), /sale/i);
  assert.throws(() => sale(4000000, 2000000, 800000, { ...inputs, tax: '1e308', agent: '1e308' }), /sale/i);
});

test('sale inputs immediately update profit and cost reference without changing income charts', () => {
  const nodes = new Map();
  const node = () => ({ innerHTML: '', textContent: '', value: '', dataset: {}, handlers: {}, insertAdjacentHTML() {}, addEventListener(type, fn) { this.handlers[type] = fn; }, setAttribute() {}, removeAttribute() {} });
  const investments = ['purchase', 'renovation'].map(key => Object.assign(node(), { dataset: { investment: key } }));
  const inputs = ['price', 'tax', 'agent', 'other', 'loan', 'operating'].map(key => Object.assign(node(), { dataset: { sale: key } }));
  const host = { innerHTML: '', querySelector(key) { if (!nodes.has(key)) nodes.set(key, node()); return nodes.get(key); }, querySelectorAll(key) { return key === '[data-investment]' ? investments : key === '[data-sale]' ? inputs : []; } };
  frontend.CMWebsAssetValuation.mount(host, [{ year: 2024, collected: 100000, recorded_months: 12, months: [] }]);
  const original = nodes.get('[data-charts]').innerHTML;
  investments[0].value = '2000000'; investments[0].handlers.input();
  assert.match(nodes.get('[data-investment-error]').textContent, /裝修/);
  investments[1].value = '0'; investments[1].handlers.input();
  assert.match(nodes.get('[data-valuation-chart]').innerHTML, /總投入成本.*2,000,000/);
  for (const input of inputs) { input.value = input.dataset.sale === 'price' ? '3000000' : '0'; input.handlers.input(); }
  assert.match(nodes.get('[data-sale-result]').innerHTML, /NT\$ 1,000,000/);
  assert.match(nodes.get('[data-sale-result]').innerHTML, /50%/);
  assert.match(nodes.get('[data-sale-chart]').innerHTML, /3,000,000/);
  assert.equal(nodes.get('[data-charts]').innerHTML, original);
  inputs[1].validity = { badInput: true }; inputs[1].handlers.input();
  assert.equal(nodes.get('[data-sale-result]').innerHTML, '');
});

test('preview property selection rerenders scoped synthetic years without a production request', () => {
  const html = previewHtml();
  const startup = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(body => body.includes('async function initLineUserId'));
  let data;
  const context = vm.createContext({ URL, URLSearchParams, location: { href: 'http://127.0.0.1/', search: '' }, innerHeight: 800,
    document: { documentElement: { style: { setProperty() {} } }, getElementById() { return { insertAdjacentHTML() {} }; } }, addEventListener() {}, console });
  context.window = context;
  assert.ok(startup.includes('function loadPreviewReport'), 'preview has no usable property reload');
  vm.runInContext(startup.slice(0, startup.lastIndexOf('function loadPreviewReport')), context);
  context.render = value => { data = value; };
  context.showToast = () => {};
  const previewStart = startup.slice(startup.lastIndexOf('function loadPreviewReport'));
  assert.ok(previewStart.startsWith('function loadPreviewReport'), 'preview has no usable property reload');
  vm.runInContext(previewStart, context);
  assert.equal(data.properties.length, 2);
  const all = data.annual_income.reduce((sum, row) => sum + row.collected, 0);
  context.changeProperty('preview-a');
  assert.equal(data.annual_income.reduce((sum, row) => sum + row.collected, 0), all * .6);
  context.changeProperty('preview-b');
  assert.equal(data.annual_income.reduce((sum, row) => sum + row.collected, 0), all * .4);
  context.changeProperty('');
  assert.equal(data.annual_income.reduce((sum, row) => sum + row.collected, 0), all);
});

test('synthetic preview identifies every money card as demonstration instead of real accounting', () => {
  const html = previewHtml();
  assert.match(html, /這是示範數字，不是您的實際帳務/);
  assert.match(html, /\.av-metrics small::before/);
  assert.match(html, /示範｜/);
  assert.match(html, /尚未連接您的正式收入資料/);
});

test('revenue page has desktop navigation while mobile keeps its fixed bottom shell', () => {
  const page = readFileSync(new URL('../landlord-revenue-dashboard.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../assets/css/cmwebs-asset-valuation.css', import.meta.url), 'utf8');
  assert.match(page, /class="app-shell av-desktop"/);
  assert.match(page, /aria-label="房東桌面導覽"/);
  assert.match(page, /aria-current="page"[^>]*>營收與資產/);
  assert.match(css, /min-width:1024px/);
  assert.match(css, /\.av-desktop \.bottom-nav \{ display: none;/);
  assert.match(page, /\.bottom-nav \{ position:absolute/);
});

test('investment returns distinguish actual collected income, invested capital and annual expenses', () => {
  const returns = frontend.CMWebsAssetValuation.investmentReturns;
  assert.equal(typeof returns, 'function');
  const rows = [{ collected: 100 }, { collected: 200 }];
  const value = returns(rows, 200, { purchase: '1000', renovation: '200', other: '' }, '50');
  assert.equal(value.total_collected, 300);
  assert.equal(value.total_invested, 1200);
  assert.equal(value.cumulative_gross_return, 25);
  assert.equal(value.annual_gross_return, 200 / 1200 * 100);
  assert.equal(value.annual_net_return, 12.5);
  assert.equal(returns(rows, 200, { purchase: '', renovation: '200' }, '').annual_gross_return, null);
  assert.equal(returns(rows, 200, { purchase: '0', renovation: '0' }, '0').cumulative_gross_return, null);
  assert.equal(returns(rows, 200, { purchase: '1000', renovation: '0' }, '').annual_net_return, null);
  for (const bad of ['-1', 'Infinity', 'abc']) assert.throws(() => returns(rows, 200, { purchase: bad, renovation: '0' }, ''), /investment/i);
  assert.throws(() => returns(rows, 200, { purchase: '1e308', renovation: '1e308' }, ''), /investment/i);
});

test('actual widget events show year/month details, rotate pie and retain charts during cost entry', () => {
  const nodes = new Map();
  const node = () => ({ innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, handlers: {}, attrs: {},
    insertAdjacentHTML() {}, addEventListener(name, handler) { this.handlers[name] = handler; },
    setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; } });
  const purchase = Object.assign(node(), { dataset: { investment: 'purchase' } });
  const renovation = Object.assign(node(), { dataset: { investment: 'renovation' } });
  const arc = Object.assign(node(), { dataset: { pieMonth: '2024-01', rotation: '-90' } });
  const host = { innerHTML: '', querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); },
    querySelectorAll(selector) { return selector === '[data-investment]' ? [purchase, renovation] : selector === '[data-rotation]' ? [arc] : []; } };
  frontend.CMWebsAssetValuation.mount(host, [{ year: 2024, collected: 100, recorded_months: 2, months: [{ month: '2024-01', collected: 50 }, { month: '2024-02', collected: 50 }] }]);
  const charts = nodes.get('[data-charts]');
  assert.match(charts.innerHTML, /data-chart-year="2024"/);
  assert.match(charts.innerHTML, /<path data-pie-month="2024-01"/);
  assert.match(charts.innerHTML, /最高：NT\$ 100 · 最低：NT\$ 100/);
  const originalCharts = charts.innerHTML;
  purchase.value = '1000'; purchase.handlers.input();
  renovation.value = '0'; renovation.handlers.input();
  assert.equal(charts.innerHTML, originalCharts);
  assert.match(nodes.get('[data-returns]').innerHTML, /10%/);
  charts.handlers.click({ type: 'click', target: { closest() { return { dataset: { chartYear: '2024' } }; } } });
  assert.match(nodes.get('[data-chart-detail]').innerHTML, /2024-02：NT\$ 50/);
  let prevented = false;
  charts.handlers.keydown({ type: 'keydown', key: 'Enter', preventDefault() { prevented = true; }, target: { closest() { return { dataset: { pieMonth: '2024-01' } }; } } });
  assert.equal(prevented, true);
  assert.match(nodes.get('[data-chart-detail]').innerHTML, /50\.00%/);
  assert.equal(nodes.get('[data-pie-ring]').style.transform, 'rotate(-90deg)');
  const motion = nodes.get('[data-motion]');
  motion.handlers.click({ currentTarget: motion });
  assert.equal(nodes.get('.av-chart-grid').attrs['data-paused'], 'true');
  assert.equal(motion.textContent, '繼續圖表動畫');
  purchase.validity = { badInput: true }; purchase.handlers.input();
  assert.match(nodes.get('[data-investment-error]').textContent, /投入成本/);
  assert.equal(nodes.get('[data-returns]').innerHTML, '');
});

test('motion is finite, reduced-motion cannot be overridden, and full-share pie uses a real ring path', () => {
  const css = readFileSync(new URL('../assets/css/cmwebs-asset-valuation.css', import.meta.url), 'utf8');
  assert.match(css, /@keyframes av-grow/);
  assert.match(css, /@keyframes av-draw/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /animation: none !important; transition: none !important/);
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /data-paused=true\] \* \{ animation: none !important; transition: none;/, 'paused redraw must show final geometry, not freeze the invisible first frame');
  const nodes = new Map();
  const host = { innerHTML: '', querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', value: '', insertAdjacentHTML() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {} }); return nodes.get(selector); }, querySelectorAll() { return []; } };
  frontend.CMWebsAssetValuation.mount(host, [{ year: 2024, collected: 100, recorded_months: 1, months: [{ month: '2024-01', collected: 100 }] }]);
  assert.match(nodes.get('[data-charts]').innerHTML, /fill-rule="evenodd"/);
  assert.doesNotMatch(nodes.get('[data-charts]').innerHTML, /NaN|Infinity/);
});

test('all-history income respects workspace/property, paid confirmation and cutoff without changing period KPIs', () => {
  const bill = (id, month, amount, extra = {}) => ({ bill_id: id, bill_month: month, total_amount: amount, payment_status: 'paid', workspace_id: 'W1', property_id: 'P1', ...extra });
  const result = backend.revenueDashboardAggregate_({
    properties: [{ property_id: 'P1', workspace_id: 'W1' }, { property_id: 'P2', workspace_id: 'W1' }],
    bills: [bill('old', '2013-07', 1200, { notes: '人工按月分配' }), bill('zero', '2013-08', 300, { payment_status: 'pending' }),
      bill('current', '2026-01', 900), bill('partial', '2026-02', 1000, { payment_status: 'pending' }),
      bill('void', '2026-01', 100, { bill_status: 'cancelled' }), bill('future', '2026-12', 900),
      bill('other-workspace', '2026-01', 800, { workspace_id: 'W2' }), bill('other-property', '2026-01', 700, { property_id: 'P2' })],
    payments: [{ bill_id: 'partial', amount: 200, status: 'confirmed', workspace_id: 'W1' },
      { bill_id: 'partial', amount: 500, status: 'pending', workspace_id: 'W1' },
      { bill_id: 'partial', amount: 800, status: 'confirmed', workspace_id: 'W2' }]
  }, { workspace_id: 'W1', property_id: 'P1', from_month: '2026-01', to_month: '2026-01', as_of: '2026-10-04' });
  assert.equal(result.kpis.collected, 900);
  assert.deepEqual(plain(result.annual_income), [
    { year: 2013, collected: 1200, recorded_months: 2, allocated_bill_count: 1, months: [{ month: '2013-07', collected: 1200 }, { month: '2013-08', collected: 0 }] },
    { year: 2026, collected: 1100, recorded_months: 2, allocated_bill_count: 0, months: [{ month: '2026-01', collected: 900 }, { month: '2026-02', collected: 200 }] }
  ]);
});

test('four rate scenarios use recorded annual income, never annualize a partial year', () => {
  assert.ok(frontend.CMWebsAssetValuation, 'valuation model not yet implemented');
  for (const [rate, expected] of [[2, 6000000], [3, 4000000], [4, 3000000], [4.5, 2666666.6666666665]]) {
    const value = frontend.CMWebsAssetValuation.calculate({ collected: 120000, recorded_months: 6 }, rate, '');
    assert.ok(Math.abs(value.gross_value - expected) < .000001);
    assert.equal(value.net_value, null);
  }
});

test('net scenario requires an explicit expense, rejects invalid rates/costs and nonpositive income', () => {
  assert.ok(frontend.CMWebsAssetValuation);
  const calculate = frontend.CMWebsAssetValuation.calculate;
  assert.equal(calculate({ collected: 120000 }, 4, '20000').net_value, 2500000);
  assert.equal(calculate({ collected: 120000 }, 4, '0').net_value, 3000000);
  assert.equal(calculate({ collected: 120000 }, 4, '120000').net_value, null);
  assert.equal(calculate({ collected: 0 }, 4, '').gross_value, null);
  assert.throws(() => calculate({ collected: 120000 }, 0, ''), /rate/i);
  for (const value of ['-1', 'abc', 'Infinity']) assert.throws(() => calculate({ collected: 120000 }, 4, value), /expense/i);
});

test('desktop email report reuses shared session without LINE init or redirect', async () => {
  const page = readFileSync(new URL('../landlord-revenue-dashboard.html', import.meta.url), 'utf8');
  const script = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(body => body.includes('async function initLineUserId'));
  let lineCalls = 0;
  let requestConfig;
  const context = vm.createContext({ URL, URLSearchParams, location: { href: 'https://example.test/landlord-revenue-dashboard.html', search: '' },
    document: { documentElement: { style: { setProperty() {} } } },
    liff: { async init() { lineCalls++; }, isLoggedIn() { return false; } },
    CMWebsLandlordAuth: { init() { return this; }, getMode() { return 'email'; }, getRequestAuthParams() { return { landlord_session_token: 'synthetic-session' }; } },
    CMWebsLandlordApi: { async request(config) { requestConfig = config; return { success: true, data: { annual_income: [] } }; } },
    innerHeight: 800, addEventListener() {}, setTimeout, clearTimeout, console });
  context.window = context;
  vm.runInContext(script.replace(/\(async function \(\) \{ try \{ if \(await initLineUserId\(\)\)[\s\S]*?\}\(\)\);/, ''), context);
  assert.equal(await context.initLineUserId(), true);
  assert.equal(lineCalls, 0);
  const response = await context.jsonpRequest('landlord_revenue_dashboard_init', { range: '12m' });
  assert.equal(response.success, true);
  assert.equal(requestConfig.action, 'landlord_revenue_dashboard_init');
  assert.equal(requestConfig.params.range, '12m');
});

test('valuation curves neither bridge a missing year nor plot unavailable value as zero', () => {
  const nodes = new Map();
  const node = () => ({ innerHTML: '', textContent: '', value: '', insertAdjacentHTML() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {} });
  const host = { innerHTML: '', querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); }, querySelectorAll() { return []; } };
  frontend.CMWebsAssetValuation.mount(host, [
    { year: 2023, collected: 100, recorded_months: 1, months: [] },
    { year: 2025, collected: 200, recorded_months: 1, months: [] },
    { year: 2026, collected: 0, recorded_months: 1, months: [] }
  ]);
  const graphs = nodes.get('[data-charts]').innerHTML;
  const valuation = graphs.split('<article>')[3];
  assert.equal((valuation.match(/<circle /g) || []).length, 2, 'zero income has no asset estimate point');
  assert.equal((valuation.match(/<polyline /g) || []).length, 0, 'missing year must not be bridged');
});

test('empty annual response never manufactures income', () => {
  const result = backend.revenueDashboardAggregate_({}, { workspace_id: 'W1', from_month: '2026-01', to_month: '2026-01', as_of: '2026-10-04' });
  assert.deepEqual(plain(result.annual_income), []);
  const host = { innerHTML: '' };
  frontend.CMWebsAssetValuation.mount(host, []);
  assert.match(host.innerHTML, /沒有可用/);
  frontend.CMWebsAssetValuation.mount(host, undefined);
  assert.match(host.innerHTML, /尚未提供年度資料/);
});

test('highest and average valuation choose real annual income and exclude partial years by default', () => {
  assert.equal(typeof frontend.CMWebsAssetValuation.basis, 'function');
  const rows = [{year:2023,collected:120000,recorded_months:12}, {year:2024,collected:180000,recorded_months:12}, {year:2025,collected:10000,recorded_months:2}];
  assert.equal(frontend.CMWebsAssetValuation.basis(rows, 'highest', 2025).row.collected, 180000);
  assert.equal(frontend.CMWebsAssetValuation.basis(rows, 'highest', 2025).row.year, 2024);
  assert.equal(frontend.CMWebsAssetValuation.basis(rows, 'average', 2025).row.collected, 150000);
  assert.equal(frontend.CMWebsAssetValuation.basis(rows, 'average', 2025, true).row.collected, 310000 / 3);
  assert.equal(frontend.CMWebsAssetValuation.basis([rows[2]], 'average', 2025).row, null);
  assert.equal(frontend.CMWebsAssetValuation.calculate({collected:150000}, 2, '').gross_value, 7500000);
});

test('badInput on expense control cannot be mistaken for a blank cost', () => {
  const nodes = new Map();
  const node = () => ({innerHTML:'',textContent:'',value:'',validity:{badInput:false},insertAdjacentHTML() {},addEventListener() {},setAttribute() {},removeAttribute() {}});
  const host = {innerHTML:'',querySelector(selector) {if (!nodes.has(selector)) nodes.set(selector,node());return nodes.get(selector);},querySelectorAll(){return [];} };
  nodes.set('[data-expense]', {...node(),validity:{badInput:true}});
  frontend.CMWebsAssetValuation.mount(host,[{year:2026,collected:144000,recorded_months:6,months:[]}]);
  assert.match(nodes.get('[data-error]').textContent,/請輸入/);
});

test('average basis visibly requests average costs for the same included years', () => {
  const nodes = new Map();
  const node = () => ({innerHTML:'',textContent:'',value:'',insertAdjacentHTML(){},addEventListener(type, fn){this[type]=fn;},setAttribute(){},removeAttribute(){}});
  const average = {...node(),dataset:{basis:'average'}};
  const host = {innerHTML:'',querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},querySelectorAll(selector){return selector==='[data-basis]'?[average]:[];}};
  frontend.CMWebsAssetValuation.mount(host,[{year:2023,collected:120,recorded_months:12,months:[]},{year:2024,collected:180,recorded_months:12,months:[]},{year:2026,collected:50,recorded_months:1,months:[]}]);
  average.click();
  assert.match(nodes.get('[data-cost-label]')?.textContent || '',/平均年度營運成本/);
  assert.match(nodes.get('[data-cost-label]').textContent,/2023、2024/);
});

test('desktop existing LINE login remains usable without an email token', async () => {
  const page = readFileSync(new URL('../landlord-revenue-dashboard.html', import.meta.url), 'utf8');
  const script = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(body => body.includes('async function initLineUserId'));
  let lineCalls = 0;
  const context = vm.createContext({URL,URLSearchParams,location:{href:'https://example.test/landlord-revenue-dashboard.html',search:''},document:{documentElement:{style:{setProperty(){}}}},
    CMWebsLandlordAuth:{init(){return this;},getMode(){return 'email';},getRequestAuthParams(){return {}; }},
    liff:{async init(){lineCalls++;},isLoggedIn(){return true;},async getProfile(){return {userId:'synthetic-line-id'};}},
    innerHeight:800,addEventListener(){},setTimeout,clearTimeout,console });
  context.window=context;
  vm.runInContext(script.replace(/\(async function \(\) \{ try \{ if \(await initLineUserId\(\)\)[\s\S]*?\}\(\)\);/, ''),context);
  assert.equal(await context.initLineUserId(),true);
  assert.equal(lineCalls,1);
  assert.equal(context.location.href,'https://example.test/landlord-revenue-dashboard.html');
});

test('annual and existing period income share the exact same status rules', () => {
  const result = backend.revenueDashboardAggregate_({properties:[{property_id:'P1',workspace_id:'W1'}],bills:[
    {bill_id:'B1',bill_month:'2026-01',workspace_id:'W1',property_id:'P1',total_amount:1200,bill_status:'reversed',payment_status:'paid'}
  ]},{workspace_id:'W1',from_month:'2026-01',to_month:'2026-01',as_of:'2026-10-04'});
  assert.equal(result.annual_income[0]?.collected,result.kpis.collected);
});

test('preview is loopback-only synthetic output and denies private files and POST', async () => {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(base + '/');
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
    const page = await response.text();
    assert.match(page,/本機功能預覽/);
    assert.doesNotMatch(page,/<script src="https:/);
    assert.equal((await fetch(base + '/docs/CMWEBS_CURRENT_STATE.md')).status,404);
    assert.equal((await fetch(base + '/', {method:'POST'})).status,405);
    assert.equal((await fetch(base + '/mobile')).status,200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
