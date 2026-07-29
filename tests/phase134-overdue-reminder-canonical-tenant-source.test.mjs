import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../apps-script/V2_AUTO_PAYMENT_REMINDER.js', import.meta.url),
  'utf8'
);

const sandbox = {
  Utilities: {
    formatDate(value, timezone, format) {
      assert.equal(timezone, 'Asia/Taipei');
      const date = new Date(value);

      if (format === 'H') {
        return '10';
      }

      if (format === 'yyyy-MM-dd') {
        return [
          date.getUTCFullYear(),
          String(date.getUTCMonth() + 1).padStart(2, '0'),
          String(date.getUTCDate()).padStart(2, '0')
        ].join('-');
      }

      throw new Error('Unexpected date format: ' + format);
    }
  }
};

vm.runInNewContext(
  source +
    '\n;globalThis.__test = { autoReminderBuildContext_, autoReminderBuildPlan_ };',
  sandbox,
  { filename: 'V2_AUTO_PAYMENT_REMINDER.js' }
);

assert.match(
  source,
  /const AUTO_REMINDER_TENANTS_SHEET = 'V2_tenants';/,
  'the authoritative tenant table must be the reminder eligibility source'
);
assert.doesNotMatch(
  source,
  /autoReminderRequireSheet_\(\s*ss,\s*AUTO_REMINDER_TENANT_VIEW_SHEET\s*\)/,
  'the landlord tenant view must not be required by the reminder dispatcher'
);

const now = new Date('2026-07-29T02:00:00Z');
const bill = {
  bill_id: 'BILL-TEST-FINAL-STAGE',
  bill_month: '2026-07',
  room_name: 'TEST-ROOM',
  total_amount: '9000',
  due_date: '2026-07-10',
  payment_status: 'unpaid',
  bill_status: 'issued',
  landlord_id: 'LANDLORD-TEST',
  tenant_id: 'TENANT-TEST',
  tenant_user_id: 'USER-TEST',
  contract_id: 'CONTRACT-TEST',
  workspace_id: 'WORKSPACE-TEST'
};

const directTenantRow = {
  tenant_id: 'TENANT-TEST',
  user_id: 'USER-TEST',
  line_user_id: 'LINE-TEST',
  display_name: '測試房客',
  binding_status: 'bound',
  account_status: 'active'
};

const context = sandbox.__test.autoReminderBuildContext_(
  [directTenantRow],
  [
    {
      contract_id: 'CONTRACT-TEST',
      contract_status: 'active',
      start_date: '2026-01-01',
      end_date: '2027-01-01'
    }
  ],
  [
    {
      landlord_id: 'LANDLORD-TEST',
      landlord_name: '測試房東',
      line_user_id: 'LANDLORD-LINE-TEST'
    }
  ],
  [
    {
      bill_id: bill.bill_id,
      reminder_stage: '2',
      status: 'success'
    },
    {
      bill_id: bill.bill_id,
      reminder_stage: '6',
      status: 'success'
    }
  ],
  [],
  [
    {
      workspace_id: 'WORKSPACE-TEST',
      account_status: 'active'
    }
  ],
  [
    {
      workspace_id: 'WORKSPACE-TEST',
      auto_overdue_reminder: 'true',
      overdue_reminder_hour: '10',
      overdue_reminder_days_json: '[2,6,15]'
    }
  ],
  null,
  now,
  false
);

const plan = sandbox.__test.autoReminderBuildPlan_([bill], context, now);

assert.equal(plan.eligibleBillCount, 1);
assert.equal(plan.skippedItems.length, 0);
assert.equal(plan.sendGroups.length, 1);
assert.equal(plan.sendGroups[0].items.length, 1);
assert.equal(plan.sendGroups[0].items[0].stage, 15);
assert.equal(plan.sendGroups[0].tenantLineUserId, 'LINE-TEST');
assert.equal(plan.sendGroups[0].tenantName, '測試房客');

console.log('Phase 134 canonical tenant reminder-source tests passed.');
