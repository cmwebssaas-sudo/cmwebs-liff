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
      const date = new Date(value);
      if (format === 'H') return '10';
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

const now = new Date('2026-11-25T02:00:00Z');

function planFor(contractRows) {
  const bill = {
    bill_id: 'B-EXPIRED-LEASE',
    bill_month: '2026-11',
    room_name: '602',
    total_amount: '25593',
    due_date: '2026-11-10',
    payment_status: 'unpaid',
    bill_status: 'issued',
    landlord_id: 'L1',
    tenant_id: 'T1',
    tenant_user_id: 'U1',
    contract_id: 'C1',
    workspace_id: 'W1'
  };
  const context = sandbox.__test.autoReminderBuildContext_(
    [{
      tenant_id: 'T1',
      user_id: 'U1',
      line_user_id: 'LINE-T1',
      tenant_name: '房客',
      binding_status: 'bound',
      account_status: 'active'
    }],
    contractRows,
    [{ landlord_id: 'L1', landlord_name: '房東', line_user_id: 'LINE-L1' }],
    [],
    [],
    [{ workspace_id: 'W1', account_status: 'active' }],
    [{
      workspace_id: 'W1',
      auto_overdue_reminder: 'true',
      overdue_reminder_hour: '10',
      overdue_reminder_days_json: '[2,6,15]'
    }],
    null,
    now,
    false
  );
  return sandbox.__test.autoReminderBuildPlan_([bill], context, now);
}

for (const [label, contracts] of [
  ['lease ended before the bill and renewal not yet done', [{
    contract_id: 'C1',
    contract_status: 'active',
    start_date: '2023-10-01',
    end_date: '2026-09-30'
  }]],
  ['contract row missing', []],
  ['contract marked expired', [{
    contract_id: 'C1',
    contract_status: 'expired',
    start_date: '2023-10-01',
    end_date: '2026-09-30'
  }]]
]) {
  const plan = planFor(contracts);
  assert.equal(plan.skippedItems.length, 0, label);
  assert.equal(plan.sendGroups.length, 1, label);
  assert.equal(plan.sendGroups[0].items[0].stage, 15, label);
  assert.equal(plan.sendGroups[0].tenantLineUserId, 'LINE-T1', label);
}

console.log('Overdue reminder ignores lease expiry tests passed.');
