import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../apps-script/V2_MONTHLY_BILL_NOTIFICATIONS.js', import.meta.url), 'utf8');
function runtime() {
  const stored = new Map();
  const context = { Date, Utilities: { formatDate(date, timezone, format) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).map(part => [part.type, part.value]));
    if (format === 'd') return parts.day;
    if (format === 'H') return parts.hour;
    if (format === 'yyyy-MM') return `${parts.year}-${parts.month}`;
    throw new Error(`Unexpected format ${format}`);
  } } };
  context.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
  context.PropertiesService = { getScriptProperties: () => ({
    getProperty: key => stored.get(key) || null,
    setProperty: (key, value) => stored.set(key, value),
    deleteProperty: key => stored.delete(key)
  }) };
  context.Utilities.getUuid = () => 'synthetic-claim';
  vm.runInNewContext(source, context);
  return context;
}

test('monthly notification cannot open before Taiwan noon on the fifth', () => {
  const context = runtime();
  assert.equal(context.billNotificationIsMonthlyDispatchDue_(5, 0), false);
  assert.equal(context.billNotificationIsMonthlyDispatchDue_(5, 11), false);
  assert.equal(context.billNotificationIsMonthlyDispatchDue_(4, 23), false);
  assert.equal(context.billNotificationIsMonthlyDispatchDue_(5, 12), true);
  assert.equal(context.billNotificationIsMonthlyDispatchDue_(5, 23), true);
  assert.equal(context.billNotificationIsMonthlyDispatchDue_(6, 0), true);
});

test('monthly dispatch selects date-valued Sheet months without resending sent or paid bills', () => {
  const context = runtime();
  const bill = {
    bill_id: 'SYNTHETIC-OCT', workspace_id: 'SYNTHETIC-WORKSPACE',
    landlord_id: 'SYNTHETIC-LANDLORD', landlord_line_user_id: 'synthetic-owner',
    bill_month: new Date('2026-09-30T16:00:00Z'),
    bill_status: 'issued', payment_status: 'unpaid', sent_status: 'not_sent'
  };
  const groups = context.billNotificationBuildMonthlyDispatchGroups_([
    bill,
    { ...bill, bill_id: 'SENT', sent_status: 'sent' },
    { ...bill, bill_id: 'PAID', payment_status: 'paid' },
    { ...bill, bill_id: 'VOID', bill_status: 'cancelled' },
    { ...bill, bill_id: 'SEPT', bill_month: new Date('2026-09-01T00:00:00Z') },
    { ...bill, bill_id: 'INVALID', bill_month: new Date(NaN) }
  ], '2026-10');
  assert.deepEqual(JSON.parse(JSON.stringify(groups)), [{
    workspace_id: 'SYNTHETIC-WORKSPACE', landlord_id: 'SYNTHETIC-LANDLORD',
    landlord_line_user_id: 'synthetic-owner', bill_ids: ['SYNTHETIC-OCT']
  }]);
});

test('monthly month normalization preserves Taiwan boundary and text compatibility', () => {
  const context = runtime();
  for (const [input, expected] of [
    [new Date('2026-09-30T15:59:59Z'), '2026-09'],
    [new Date('2026-09-30T16:00:00Z'), '2026-10'],
    ['2026/10/01', '2026-10'], ['2026-10', '2026-10']
  ]) assert.equal(context.monthlyBillNotificationNormalizeBillMonth_(input), expected);
});

test('real dispatcher returns before reading bills or sending at 11:59 Taiwan', () => {
  const result = runtime().runV2MonthlyBillNotifications(new Date('2026-10-05T03:59:59Z'));
  assert.equal(result.success, true);
  assert.equal(result.code, 'MONTHLY_BILL_NOT_DUE');
  assert.equal(result.data.sent_count, 0);
  assert.equal(result.data.dispatch_hour, 12);
  assert.equal(result.data.local_hour, 11);
});

test('real dispatcher reaches billing storage only from noon, including catch-up', () => {
  for (const timestamp of ['2026-10-05T04:00:00Z', '2026-10-05T04:05:00Z', '2026-10-05T16:00:00Z']) {
    const context = runtime();
    context.runtimeSpreadsheet_ = () => { throw new Error('storage-boundary-reached'); };
    const result = context.runV2MonthlyBillNotifications(new Date(timestamp));
    assert.equal(result.code, 'MONTHLY_BILL_NOTIFICATIONS_ERROR');
    assert.match(result.message, /storage-boundary-reached/);
  }
});

test('overlapping timer entrances skip while first dispatch owns claim, then release', () => {
  const context = runtime();
  const properties = new Map();
  let held = false;
  const lock = {
    tryLock() { assert.equal(held, false); held = true; return true; },
    releaseLock() { held = false; }
  };
  context.LockService = { getScriptLock: () => lock };
  context.PropertiesService = { getScriptProperties: () => ({
    getProperty: key => properties.get(key) || null,
    setProperty: (key, value) => properties.set(key, value),
    deleteProperty: key => properties.delete(key)
  }) };
  context.Utilities.getUuid = () => 'synthetic-claim';
  let storageCalls = 0;
  context.runtimeSpreadsheet_ = () => {
    assert.equal(held, false, 'claim lock must be released before notification module locks');
    storageCalls++;
    const nested = context.runV2MonthlyBillNotifications(new Date('2026-10-05T04:00:00Z'));
    assert.equal(nested.code, 'MONTHLY_BILL_DISPATCH_BUSY');
    throw new Error('storage-boundary-reached');
  };
  for (let invocation = 0; invocation < 2; invocation++) {
    const result = context.runV2MonthlyBillNotifications(new Date('2026-10-05T04:00:00Z'));
    assert.equal(result.code, 'MONTHLY_BILL_NOTIFICATIONS_ERROR');
    assert.equal(properties.size, 0, 'claim released after error');
  }
  assert.equal(storageCalls, 2);
});
