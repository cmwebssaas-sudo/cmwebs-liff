import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const page = read('landlord-revenue-dashboard.html');
const moduleSource = read('assets/js/cmwebs-asset-valuation.js');

// The revenue charts follow the dataviz method: validated categorical slots,
// each money entity keeps one colour, thin marks, ink text and a hover layer.
test('revenue page charts use one validated colour per money entity', () => {
  assert.match(page, /const VIZ = \{ receivable: '#2a78d6', collected: '#1baf7a', outstanding: '#eb6834', contracts: '#6250d6'/);
  assert.match(moduleSource, /const viz = \{ income: '#1baf7a', value: '#2a78d6', cost: '#eb6834', loss: '#d03b3b'/);
  assert.doesNotMatch(moduleSource, /const colors = \[/, 'no twelve-colour month palette');
  assert.doesNotMatch(page, /stroke-width="3"/, 'lines are 2px');
  assert.doesNotMatch(page, /class="donut-chart"/);
  assert.match(page, /<svg id="overdueRatioChart" class="meter-chart"/);
  assert.match(page, /<svg id="occupancyChart" class="meter-chart"/);
});

test('KPI values and chart text stay in ink colours', () => {
  assert.doesNotMatch(page, /metric-value (?:green|red)/);
  assert.match(page, /<i class="metric-key" style="background:' \+ VIZ\.receivable \+ '"><\/i>本期應收/);
  assert.match(page, /svg \.viz-value \{ fill:var\(--ink\);/);
});

test('monthly chart tooltip lists every series and builds text safely', () => {
  const tooltip = page.slice(page.indexOf('function bindChartTooltip('), page.indexOf('function renderBarChart('));
  assert.match(tooltip, /SERIES\.forEach/);
  assert.match(tooltip, /title\.textContent = text\(row\.month\)/);
  assert.doesNotMatch(tooltip, /innerHTML/);
  assert.match(tooltip, /addEventListener\('focus'/, 'keyboard focus shows the same readout');
  assert.match(page, /class="viz-hit"[^]*?tabindex="0"/);
});

test('compact money labels use 萬 and 億 with clean axis steps', () => {
  const start = page.indexOf('function compactMoney(');
  const end = page.indexOf('function monthLabel(');
  const context = { number: value => Number(value) || 0 };
  vm.createContext(context);
  vm.runInContext(page.slice(start, end), context);
  assert.equal(context.compactMoney(9800), '9,800');
  assert.equal(context.compactMoney(196000), '19.6萬');
  assert.equal(context.compactMoney(120000000), '1.2億');
  assert.deepEqual({ ...context.niceScale(224000, 4) }, { top: 240000, step: 60000 });
});

test('valuation charts draw at the card width with rounded bars and month columns', () => {
  const nodes = new Map();
  const node = () => ({ innerHTML: '', textContent: '', value: '', clientWidth: 900, insertAdjacentHTML() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {} });
  const host = { innerHTML: '', querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); }, querySelectorAll() { return []; } };
  const context = { Map, Math, Number, String, Array, Object, JSON, Error, Intl };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(moduleSource, context);
  context.CMWebsAssetValuation.mount(host, [
    { year: 2025, collected: 2400000, recorded_months: 12, months: [{ month: '2025-01', collected: 200000 }] },
    { year: 2026, collected: 2600000, recorded_months: 12, months: [{ month: '2026-01', collected: 200000 }, { month: '2026-02', collected: 240000 }] }
  ]);
  const charts = nodes.get('[data-charts]').innerHTML;
  assert.match(charts, /viewBox="0 0 413 204"/, 'two columns of a 900px card');
  assert.match(charts, /<path class="av-mark av-bar" d="M[\d.]+ 172V[\d.]+A4 4 0 0 1/, 'bars have a 4px rounded data end');
  assert.match(charts, /data-month="2026-02"/);
  assert.match(charts, /億/, '2% valuation of 2.6M is shown in 億');
  assert.match(charts, /stroke-width="2" stroke-linecap="round"/);
  assert.doesNotMatch(charts, /NaN|Infinity/);
});
