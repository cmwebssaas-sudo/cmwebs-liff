import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dispatcherSource = readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);
const source = readFileSync(
  new URL('../apps-script/V2_REPORTING_DASHBOARD.js', import.meta.url),
  'utf8'
);
const context = { console, Date, Math, Number, String, Object, Array, JSON };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'V2_REPORTING_DASHBOARD.js' });

assert.equal(
  typeof context.revenueDashboardAggregate_,
  'function',
  'the reporting module must expose the pure aggregator for runtime tests'
);

const result = context.revenueDashboardAggregate_(
  {
    properties: [
      { property_id: 'P1', property_name: '物件一', workspace_id: 'W1', landlord_id: 'L1' },
      { property_id: 'P2', property_name: '物件二', workspace_id: 'W2', landlord_id: 'L2' }
    ],
    bills: [
      { bill_id: 'B1', property_id: 'P1', workspace_id: 'W1', bill_month: '2026-07', bill_status: 'issued', total_amount: '1000' },
      { bill_id: 'B2', property_id: 'P1', workspace_id: 'W1', bill_month: '2026-08', bill_status: 'paid', total_amount: '2000' },
      { bill_id: 'B3', property_id: 'P1', workspace_id: 'W1', bill_month: '2026-08', bill_status: 'issued', total_amount: '500', due_date: '2026-08-05' },
      { bill_id: 'B4', property_id: 'P2', workspace_id: 'W2', bill_month: '2026-08', bill_status: 'paid', total_amount: '9000' }
    ],
    payments: [
      { payment_id: 'PAY1', bill_id: 'B1', workspace_id: 'W1', status: 'confirmed', amount: '1000' },
      { payment_id: 'PAY1-DUP', bill_id: 'B1', workspace_id: 'W1', status: 'confirmed', amount: '1000' }
    ]
  },
  {
    workspace_id: 'W1',
    landlord_id: 'L1',
    from_month: '2026-07',
    to_month: '2026-08',
    as_of: '2026-08-20'
  }
);

assert.deepEqual(
  JSON.parse(JSON.stringify(result.months)),
  [
    { month: '2026-07', receivable: 1000, collected: 1000, outstanding: 0, collection_rate: 1 },
    { month: '2026-08', receivable: 2500, collected: 2000, outstanding: 500, collection_rate: 0.8 }
  ]
);
assert.deepEqual(JSON.parse(JSON.stringify(result.kpis)), {
  receivable: 3500,
  collected: 3000,
  outstanding: 500,
  collection_rate: 3000 / 3500
});
assert.deepEqual(JSON.parse(JSON.stringify(result.properties)), [
  { property_id: 'P1', property_name: '物件一', receivable: 3500, collected: 3000, outstanding: 500, collection_rate: 3000 / 3500 }
]);
assert.equal(result.has_data, true);
assert.match(dispatcherSource, /landlord_revenue_dashboard_init/);
assert.match(
  readFileSync(new URL('../docs/04-API-ROUTES.md', import.meta.url), 'utf8'),
  /Route count: \*\*84\*\*/
);

const empty = context.revenueDashboardAggregate_(
  { properties: [], bills: [], payments: [] },
  { workspace_id: 'W1', from_month: '2026-09', to_month: '2026-09' }
);
assert.equal(empty.has_data, false);
assert.deepEqual(empty.months, []);
assert.deepEqual(JSON.parse(JSON.stringify(empty.kpis)), {
  receivable: 0,
  collected: 0,
  outstanding: 0,
  collection_rate: null
});

console.log('Phase 150 revenue dashboard runtime tests passed.');
