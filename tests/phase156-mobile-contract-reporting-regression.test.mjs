import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const reportingSource = readFileSync(
  new URL('../apps-script/V2_REPORTING_DASHBOARD.js', import.meta.url),
  'utf8'
);
const tenantPage = readFileSync(
  new URL('../tenant-contract.html', import.meta.url),
  'utf8'
);

const context = { console, Date, Math, Number, String, Object, Array, JSON };
vm.createContext(context);
vm.runInContext(reportingSource, context, {
  filename: 'V2_REPORTING_DASHBOARD.js'
});

const result = context.revenueDashboardAggregate_(
  {
    properties: [
      { property_id: 'P1', property_name: '物件一', workspace_id: 'W1' }
    ],
    bills: [
      {
        bill_id: 'B1',
        property_id: 'P1',
        workspace_id: 'W1',
        bill_month: new Date('2026-07-01T00:00:00+08:00'),
        due_date: new Date('2026-07-05T00:00:00+08:00'),
        bill_status: 'issued',
        total_amount: 12000
      }
    ],
    payments: []
  },
  {
    workspace_id: 'W1',
    from_month: '2026-07',
    to_month: '2026-07',
    as_of: '2026-07-20'
  }
);

assert.deepEqual(JSON.parse(JSON.stringify(result.months)), [
  {
    month: '2026-07',
    receivable: 12000,
    collected: 0,
    outstanding: 12000,
    collection_rate: 0
  }
]);
assert.equal(result.metrics.bill_count, 1);
assert.equal(result.metrics.overdue_count, 1);
assert.equal(result.has_data, true);

assert.match(
  tenantPage,
  /function shouldFallbackToReadOnlyContract_\(code\)/,
  'tenant page must define a safe read-only fallback for signing bootstrap failures'
);
assert.match(
  tenantPage,
  /shouldFallbackToReadOnlyContract_\(signingError\.code\)/,
  'tenant page must try the read-only contract route after signing bootstrap failure'
);
assert.match(
  tenantPage,
  /renderTenantSigningFailure\(/,
  'tenant page must still show a signing failure when the read-only fallback also fails'
);

console.log('Phase 156 mobile contract/reporting regression tests passed.');
