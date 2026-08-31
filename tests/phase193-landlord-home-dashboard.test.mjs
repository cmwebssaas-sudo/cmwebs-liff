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

console.log('Phase 193 landlord home dashboard data contract tests passed.');
