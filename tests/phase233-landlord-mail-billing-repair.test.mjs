import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const settingsSource = readFileSync(
  new URL('../landlord-settings.html', import.meta.url),
  'utf8'
);
const notificationsSource = readFileSync(
  new URL('../landlord-bill-notifications.html', import.meta.url),
  'utf8'
);
const dispatcherSource = readFileSync(
  new URL('../apps-script/V2_AUTO_PAYMENT_REMINDER.js', import.meta.url),
  'utf8'
);
const billNotificationSource = readFileSync(
  new URL('../apps-script/V2_BILL_NOTIFICATIONS.js', import.meta.url),
  'utf8'
);
const routerSource = readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);

assert.match(
  settingsSource,
  /\.keyboard-open\s+\.bottom-nav[\s\S]*display:\s*none/,
  'settings page must hide the fixed bottom navigation while the keyboard is open'
);
assert.match(
  settingsSource,
  /function setKeyboardOpen\(/,
  'settings page must track keyboard visibility'
);
assert.match(
  settingsSource,
  /focusin[\s\S]*scrollIntoView/,
  'settings page must scroll the focused field into the visible viewport'
);

assert.match(
  notificationsSource,
  /id="manualMonthlySendButton"[\s\S]*手動發送本月帳單/,
  'bill notification page must expose a one-click monthly manual send button'
);
assert.match(
  notificationsSource,
  /function sendCurrentMonthNotSent\(/,
  'bill notification page must implement the monthly manual send action'
);
assert.match(
  notificationsSource,
  /landlord_monthly_bill_notifications_send/,
  'monthly manual send must use a dedicated backend action'
);
assert.match(
  routerSource,
  /landlord_monthly_bill_notifications_send/,
  'API dispatcher must expose the monthly manual send route'
);

const selectorStart = billNotificationSource.indexOf(
  'function billNotificationSelectRequestedBills_('
);
const selectorEnd = billNotificationSource.indexOf(
  '\n\nfunction sendLandlordBillNotificationsByLineUid_',
  selectorStart
);
assert.notEqual(selectorStart, -1, 'bill selector helper must exist');
assert.notEqual(selectorEnd, -1, 'bill selector helper boundary must exist');

const selectorContext = {
  billNotificationText_: value => String(value == null ? '' : value).trim()
};
vm.runInNewContext(
  billNotificationSource.slice(selectorStart, selectorEnd),
  selectorContext,
  { filename: 'V2_BILL_NOTIFICATIONS.js' }
);

assert.deepEqual(
  selectorContext.billNotificationSelectRequestedBills_(
    [
      { bill_id: 'not-sent', sent_status: 'not_sent' },
      { bill_id: 'failed', sent_status: 'failed' },
      { bill_id: 'sent', sent_status: 'sent' }
    ],
    ['not-sent', 'failed', 'sent'],
    { allowed_sent_statuses: ['not_sent', 'failed'] }
  ).map(bill => bill.bill_id),
  ['not-sent', 'failed'],
  'monthly manual send must never re-send already sent bills'
);

const eligibilityStart = billNotificationSource.indexOf(
  'function billNotificationIsManualMonthlyBillEligible_('
);
const eligibilityEnd = billNotificationSource.indexOf(
  '\n\nfunction sendLandlordMonthlyBillNotificationsByLineUid_',
  eligibilityStart
);
assert.notEqual(eligibilityStart, -1, 'monthly manual eligibility helper must exist');
assert.notEqual(eligibilityEnd, -1, 'monthly manual eligibility helper boundary must exist');

const eligibilityContext = {
  billNotificationText_: value => String(value == null ? '' : value).trim(),
  billNotificationNormalizeBillMonth_: value => {
    const match = String(value == null ? '' : value).match(/^(\d{4})[-\/](\d{1,2})/);
    return match ? `${match[1]}-${String(Number(match[2])).padStart(2, '0')}` : '';
  }
};
vm.runInNewContext(
  billNotificationSource.slice(eligibilityStart, eligibilityEnd),
  eligibilityContext,
  { filename: 'V2_BILL_NOTIFICATIONS.js' }
);

assert.equal(
  eligibilityContext.billNotificationIsManualMonthlyBillEligible_(
    { bill_id: 'B1', bill_month: '2026-09', payment_status: 'unpaid', sent_status: 'not_sent' },
    '2026-09'
  ),
  true
);
assert.equal(
  eligibilityContext.billNotificationIsManualMonthlyBillEligible_(
    { bill_id: 'B2', bill_month: '2026/9', payment_status: 'unpaid', sent_status: 'failed' },
    '2026-09'
  ),
  true
);
for (const bill of [
  { bill_id: 'B3', bill_month: '2026-09', payment_status: 'unpaid', sent_status: 'sent' },
  { bill_id: 'B4', bill_month: '2026-09', payment_status: 'paid', sent_status: 'not_sent' },
  { bill_id: 'B5', bill_month: '2026-09', bill_status: 'voided', payment_status: 'unpaid', sent_status: 'not_sent' }
]) {
  assert.equal(
    eligibilityContext.billNotificationIsManualMonthlyBillEligible_(bill, '2026-09'),
    false,
    `manual monthly send must exclude ${bill.bill_id}`
  );
}

const syncStart = dispatcherSource.indexOf(
  'function syncV2AutomaticPaymentReminderTrigger()'
);
const syncEnd = dispatcherSource.indexOf(
  '\n\n/**\n * 移除自動催繳觸發器。',
  syncStart
);
assert.notEqual(syncStart, -1, 'trigger sync helper must exist');
assert.notEqual(syncEnd, -1, 'trigger sync helper boundary must exist');

let installedCount = 0;
let removedCount = 0;
let currentTriggers = [];
const syncContext = {
  AUTO_REMINDER_TRIGGER_HANDLER: 'runV2AutomaticPaymentReminders',
  autoReminderGetSpreadsheet_: () => ({}),
  autoReminderBuildAllWorkspaceSchedules_: () => [],
  ScriptApp: {
    getProjectTriggers: () => currentTriggers
  },
  installV2AutomaticPaymentReminderTrigger: () => {
    installedCount += 1;
    currentTriggers = [{ getHandlerFunction: () => 'runV2AutomaticPaymentReminders' }];
  },
  removeV2AutomaticPaymentReminderTrigger: () => {
    removedCount += 1;
    currentTriggers = [];
  },
  Logger: { log: () => {} }
};
vm.runInNewContext(
  dispatcherSource.slice(syncStart, syncEnd),
  syncContext,
  { filename: 'V2_AUTO_PAYMENT_REMINDER.js' }
);

const triggerInstallResult = syncContext.syncV2AutomaticPaymentReminderTrigger();
assert.equal(installedCount, 1, 'monthly billing must install the hourly dispatcher even when overdue reminders are disabled');
assert.equal(triggerInstallResult.data.trigger_installed, true);

const triggerCountBeforeDisabledSync = currentTriggers.length;
syncContext.syncV2AutomaticPaymentReminderTrigger();
assert.equal(currentTriggers.length, triggerCountBeforeDisabledSync);
assert.equal(removedCount, 0, 'disabling overdue reminders must not remove the monthly billing dispatcher');

console.log('Phase 233 landlord mail and monthly billing repair tests passed.');
