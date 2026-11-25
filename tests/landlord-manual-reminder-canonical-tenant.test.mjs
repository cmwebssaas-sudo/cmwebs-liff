import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (name) => fs.readFileSync(new URL('../apps-script/' + name, import.meta.url), 'utf8');

const sandbox = {
  console,
  Utilities: {
    formatDate(value, timezone, format) {
      const date = new Date(value);
      if (format === 'yyyy-MM') {
        const taipei = new Date(date.getTime() + 8 * 3600 * 1000);
        return taipei.getUTCFullYear() + '-' + String(taipei.getUTCMonth() + 1).padStart(2, '0');
      }
      if (format === 'yyyy-MM-dd') {
        return [
          date.getUTCFullYear(),
          String(date.getUTCMonth() + 1).padStart(2, '0'),
          String(date.getUTCDate()).padStart(2, '0')
        ].join('-');
      }
      return '10';
    }
  }
};
vm.createContext(sandbox);
vm.runInContext(read('V2_AUTO_PAYMENT_REMINDER.js'), sandbox);
vm.runInContext(read('V2_API.js'), sandbox);

const LANDLORD_LINE = 'LINE-LANDLORD';
const sheets = {
  V2_landlords: [
    { line_user_id: LANDLORD_LINE, landlord_id: 'L1', landlord_name: '房東' },
    { line_user_id: 'LINE-OTHER', landlord_id: 'L2', landlord_name: '別的房東' }
  ],
  // 舊房客：workspace_id／landlord_id 空白，也不在 V2_landlord_tenant_list_view
  V2_tenants: [
    { tenant_id: 'T4', user_id: 'U6', tenant_name: '房客', binding_status: 'bound', line_user_id: 'LINE-T4', tenant_line_user_id: 'LINE-T4', landlord_id: '' }
  ],
  V2_contracts: [
    { contract_id: 'C18', tenant_id: 'T4', landlord_id: 'L1', contract_status: 'active', end_date: '2026/9/30' }
  ],
  V2_bills: [
    { bill_id: 'B60', bill_month: '2026-10', tenant_id: 'T4', user_id: '', landlord_id: 'L1', room_name: '602', due_date: '2026/10/10', total_amount: '26223', bill_status: 'issued', payment_status: 'paid' },
    { bill_id: 'B79', bill_month: new Date('2026-10-31T16:00:00Z'), tenant_id: 'T4', user_id: '', landlord_id: 'L1', room_name: '602', due_date: '2026/11/10', total_amount: '25593', bill_status: 'issued', payment_status: 'unpaid' }
  ],
  V2_landlord_tenant_list_view: [{ line_user_id: '#REF!' }],
  V2_landlord_arrears_view: [{ line_user_id: '#REF!' }]
};
sandbox.getSheetObjects_ = (name) => (sheets[name] || []).map((row) => ({ ...row }));

const now = new Date('2026-11-25T03:00:00Z');
const tenant = sandbox.landlordMessageResolveTenant_(LANDLORD_LINE, 'T4', '', now);

assert.ok(tenant, 'legacy tenant missing from the old view must still be found');
assert.equal(tenant.tenant_line_user_id, 'LINE-T4');
assert.equal(tenant.tenant_binding_status, 'bound');
assert.equal(tenant.room_list, '602');
assert.equal(tenant.latest_bill_month, '2026-11');
assert.equal(tenant.unpaid_total_amount, 25593);
assert.deepEqual(tenant.unpaid_bills.map((b) => b.bill_id), ['B79']);
assert.deepEqual(tenant.overdue_bills.map((b) => b.bill_id), ['B79']);

const message = sandbox.buildTenantLineMessage_(tenant, 'payment_reminder', '');
assert.match(message, /房號：602/);
assert.match(message, /帳單月份：2026-11/);
assert.match(message, /未繳金額：NT\$ 25,593/);

assert.equal(
  sandbox.landlordMessageResolveTenant_('LINE-OTHER', 'T4', '', now),
  null,
  'another landlord must not reach this tenant'
);
assert.equal(sandbox.landlordMessageResolveTenant_(LANDLORD_LINE, 'T-NONE', '', now), null);

const beforeDue = sandbox.landlordMessageResolveTenant_(LANDLORD_LINE, 'T4', '', new Date('2026-11-09T03:00:00Z'));
assert.equal(beforeDue.unpaid_bills.length, 1);
assert.equal(beforeDue.overdue_bills.length, 0, 'not overdue before the due date');

// 手動催繳成功後，逾期帳單 reminder_count +1、更新 last_reminder_at
const billGrid = [
  ['bill_id', 'reminder_count', 'last_reminder_at', 'last_reminder_stage'],
  ['B60', 2, '', 15],
  ['B79', '', '', '']
];
const billSheet = {
  getLastRow: () => billGrid.length,
  getLastColumn: () => billGrid[0].length,
  getRange(row, col, rows = 1, cols = 1) {
    return {
      getValues: () => billGrid.slice(row - 1, row - 1 + rows).map((r) => r.slice(col - 1, col - 1 + cols)),
      getValue: () => billGrid[row - 1][col - 1],
      setValue: (value) => { billGrid[row - 1][col - 1] = value; }
    };
  }
};
sandbox.runtimeSpreadsheet_ = () => ({ getSheetByName: (name) => (name === 'V2_bills' ? billSheet : null) });
sandbox.landlordMessageRecordManualReminder_(tenant.overdue_bills);
assert.equal(billGrid[2][1], 1, 'manual reminder counts toward 已成功催繳');
assert.equal(Object.prototype.toString.call(billGrid[2][2]), '[object Date]');
assert.equal(billGrid[2][3], '', 'manual reminder does not change the automatic stage');
assert.equal(billGrid[1][1], 2, 'other bills untouched');
sandbox.landlordMessageRecordManualReminder_(tenant.overdue_bills);
assert.equal(billGrid[2][1], 2);

console.log('Landlord manual reminder canonical tenant tests passed.');
