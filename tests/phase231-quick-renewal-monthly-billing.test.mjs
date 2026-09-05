import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const tenantsPage = readFileSync(
  new URL('../landlord-tenants.html', import.meta.url),
  'utf8'
);

assert.match(
  tenantsPage,
  /quick-renewal-icon/,
  'quick renewal must use a vector icon rather than a plain text-only block'
);
assert.match(
  tenantsPage,
  /quick-renewal[\s\S]*?aria-label="快速續約"/,
  'quick renewal must expose a descriptive accessible label'
);
assert.match(
  tenantsPage,
  /tenant-action-button\.quick-renewal:focus-visible/,
  'quick renewal must provide a visible keyboard focus state'
);
assert.match(
  tenantsPage,
  /prefers-reduced-motion/,
  'quick renewal motion must respect reduced-motion preferences'
);
assert.match(
  tenantsPage,
  /快速續約[\s\S]*?合約即將到期／已到期/,
  'quick renewal must retain the expiry context'
);

const monthlySource = readFileSync(
  new URL('../apps-script/V2_MONTHLY_BILL_NOTIFICATIONS.js', import.meta.url),
  'utf8'
);
const monthlyStart = monthlySource.indexOf(
  'function billNotificationIsMonthlyDispatchDue_('
);
const monthlyEnd = monthlySource.indexOf(
  '\n\nfunction billNotificationBuildMonthlyDispatchGroups_',
  monthlyStart
);
const groupStart = monthlySource.indexOf(
  'function billNotificationBuildMonthlyDispatchGroups_('
);
const groupEnd = monthlySource.indexOf(
  '\n\nfunction runV2MonthlyBillNotifications',
  groupStart
);

assert.notEqual(monthlyStart, -1, 'monthly dispatch due helper must exist');
assert.notEqual(monthlyEnd, -1, 'monthly dispatch due helper must have a boundary');
assert.notEqual(groupStart, -1, 'monthly dispatch grouping helper must exist');
assert.notEqual(groupEnd, -1, 'monthly dispatch grouping helper must have a boundary');

const context = {
  Number,
  String,
  Object,
  Array,
  V2_MONTHLY_BILL_NOTIFICATION_DAY_: 5,
  monthlyBillNotificationText_: value => value == null ? '' : String(value).trim(),
  monthlyBillNotificationNormalizeBillMonth_: value => {
    const text = String(value == null ? '' : value).trim();
    const match = text.match(/^(\d{4})[-/](\d{1,2})/);
    return match
      ? `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`
      : text;
  }
};

vm.runInNewContext(
  monthlySource.slice(monthlyStart, monthlyEnd),
  context,
  { filename: 'V2_MONTHLY_BILL_NOTIFICATIONS.js' }
);
vm.runInNewContext(
  monthlySource.slice(groupStart, groupEnd),
  context,
  { filename: 'V2_MONTHLY_BILL_NOTIFICATIONS.js' }
);

assert.equal(
  context.billNotificationIsMonthlyDispatchDue_(4),
  false,
  'monthly bill notification must not run before the fifth'
);
assert.equal(
  context.billNotificationIsMonthlyDispatchDue_(5),
  true,
  'monthly bill notification must run on the fifth'
);
assert.equal(
  context.billNotificationIsMonthlyDispatchDue_(6),
  true,
  'monthly bill notification must catch up after a missed fifth'
);

const groups = context.billNotificationBuildMonthlyDispatchGroups_(
  [
    {
      bill_id: 'B-2',
      bill_month: '2026/09',
      bill_status: 'issued',
      payment_status: 'unpaid',
      sent_status: 'not_sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'B-paid',
      bill_month: '2026-09',
      bill_status: 'issued',
      payment_status: 'paid',
      sent_status: 'not_sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'B-sent',
      bill_month: '2026-09',
      bill_status: 'issued',
      payment_status: 'unpaid',
      sent_status: 'sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'B-void',
      bill_month: '2026-09',
      bill_status: 'cancelled',
      payment_status: 'unpaid',
      sent_status: 'not_sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'B-draft',
      bill_month: '2026-09',
      bill_status: 'draft',
      payment_status: 'unpaid',
      sent_status: 'not_sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'B-1',
      bill_month: '2026-09',
      bill_status: 'issued',
      payment_status: 'unpaid',
      sent_status: 'not_sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    }
  ],
  '2026-09'
);

assert.deepEqual(
  JSON.parse(JSON.stringify(groups)),
  [
    {
      landlord_line_user_id: 'Uowner123456789012345678901',
      bill_ids: ['B-1', 'B-2']
    }
  ],
  'dispatcher must select only current-month unpaid, issued, not-sent bills and sort ids deterministically'
);

const autoReminderSource = readFileSync(
  new URL('../apps-script/V2_AUTO_PAYMENT_REMINDER.js', import.meta.url),
  'utf8'
);
assert.match(
  autoReminderSource,
  /runV2MonthlyBillNotifications\(\)/,
  'the existing hourly dispatcher must invoke monthly bill notifications'
);

console.log('Phase 231 quick renewal and monthly bill notification tests passed.');
