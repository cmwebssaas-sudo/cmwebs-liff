import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../apps-script/V2_REPORTING_DASHBOARD.js', import.meta.url),
  'utf8'
);
const context = { console, Date, Math, Number, String, Object, Array, JSON };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'V2_REPORTING_DASHBOARD.js' });

const result = context.revenueDashboardAggregate_(
  {
    properties: [
      { property_id: 'P1', property_name: '物件一', workspace_id: 'W1', landlord_id: 'L1' }
    ],
    rooms: [
      { room_id: 'R1', property_id: 'P1', workspace_id: 'W1', room_status: 'occupied' },
      { room_id: 'R2', property_id: 'P1', workspace_id: 'W1', room_status: 'vacant' },
      { room_id: 'R3', property_id: 'P1', workspace_id: 'W1', room_status: 'inactive' }
    ],
    contracts: [
      { contract_id: 'C1', property_id: 'P1', room_id: 'R1', workspace_id: 'W1', contract_status: 'active', end_date: '2026-08-25' },
      { contract_id: 'C2', property_id: 'P1', room_id: 'R2', workspace_id: 'W1', contract_status: 'active', end_date: '2026-09-25' },
      { contract_id: 'C3', property_id: 'P1', room_id: 'R3', workspace_id: 'W1', contract_status: 'terminated', end_date: '2026-08-01' }
    ],
    bills: [
      { bill_id: 'B1', property_id: 'P1', workspace_id: 'W1', bill_month: '2026-08', due_date: '2026-08-05', bill_status: 'issued', total_amount: 1000 },
      { bill_id: 'B2', property_id: 'P1', workspace_id: 'W1', bill_month: '2026-08', due_date: '2026-08-20', bill_status: 'issued', total_amount: 2000 },
      { bill_id: 'B3', property_id: 'P1', workspace_id: 'W1', bill_month: '2026-08', due_date: '2026-08-30', bill_status: 'issued', total_amount: 3000 },
      { bill_id: 'B4', property_id: 'P1', workspace_id: 'W1', bill_month: '2026-08', due_date: '2026-08-10', bill_status: 'issued', total_amount: 4000 }
    ],
    payments: [
      { payment_id: 'PAY1', bill_id: 'B1', workspace_id: 'W1', status: 'confirmed', amount: 1000 },
      { payment_id: 'PAY2', bill_id: 'B2', workspace_id: 'W1', status: 'confirmed', amount: 500 }
    ]
  },
  {
    workspace_id: 'W1',
    landlord_id: 'L1',
    from_month: '2026-08',
    to_month: '2026-08',
    as_of: '2026-08-21'
  }
);

assert.deepEqual(JSON.parse(JSON.stringify(result.kpis)), {
  receivable: 10000,
  collected: 1500,
  outstanding: 8500,
  collection_rate: 0.15
});
assert.deepEqual(JSON.parse(JSON.stringify(result.metrics)), {
  bill_count: 4,
  paid_count: 1,
  partial_count: 1,
  pending_count: 1,
  overdue_count: 2,
  overdue_amount: 5500,
  overdue_ratio: 0.55,
  overdue_bill_ratio: 0.5
});
assert.deepEqual(JSON.parse(JSON.stringify(result.status_distribution)), [
  { status: 'paid', label: '已繳款', count: 1, amount: 1000 },
  { status: 'partial', label: '部分繳款', count: 1, amount: 2000 },
  { status: 'pending', label: '待繳款', count: 1, amount: 3000 },
  { status: 'overdue', label: '遲繳', count: 1, amount: 4000 }
]);
assert.deepEqual(JSON.parse(JSON.stringify(result.overdue_aging)), [
  { bucket: '1-7', label: '1–7 天', count: 1, amount: 1500 },
  { bucket: '8-30', label: '8–30 天', count: 1, amount: 4000 },
  { bucket: '31-60', label: '31–60 天', count: 0, amount: 0 },
  { bucket: '61+', label: '61 天以上', count: 0, amount: 0 }
]);
assert.deepEqual(JSON.parse(JSON.stringify(result.occupancy)), {
  total: 3,
  occupied: 1,
  vacant: 1,
  inactive: 1,
  occupancy_rate: 0.5,
  distribution: [
    { status: 'occupied', label: '已入住', count: 1 },
    { status: 'vacant', label: '空房', count: 1 },
    { status: 'inactive', label: '停用', count: 1 }
  ]
});
assert.deepEqual(JSON.parse(JSON.stringify(result.contract_expiry)), [
  { bucket: '0-30', label: '30 天內', count: 1 },
  { bucket: '31-60', label: '31–60 天', count: 1 },
  { bucket: '61-90', label: '61–90 天', count: 0 },
  { bucket: '90+', label: '90 天以上', count: 0 }
]);
assert.equal(result.monthly_status[0].overdue_ratio, 0.55);
assert.equal(result.has_data, true);

console.log('Phase 152 revenue dashboard visual aggregates tests passed.');
