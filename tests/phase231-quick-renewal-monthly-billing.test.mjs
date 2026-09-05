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
const summaryStart = monthlySource.indexOf(
  'function billNotificationBuildLandlordMonthlySummaryText_('
);
const summaryEnd = monthlySource.indexOf(
  '\n\nfunction billNotificationSendLandlordMonthlySummary_',
  summaryStart
);

assert.notEqual(monthlyStart, -1, 'monthly dispatch due helper must exist');
assert.notEqual(monthlyEnd, -1, 'monthly dispatch due helper must have a boundary');
assert.notEqual(groupStart, -1, 'monthly dispatch grouping helper must exist');
assert.notEqual(groupEnd, -1, 'monthly dispatch grouping helper must have a boundary');
assert.notEqual(summaryStart, -1, 'landlord monthly summary text helper must exist');
assert.notEqual(summaryEnd, -1, 'landlord monthly summary text helper must have a boundary');

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
  },
  billNotificationText_: value => value == null ? '' : String(value).trim()
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
      workspace_id: 'WS-1',
      landlord_id: 'L-1',
      bill_month: '2026/09',
      bill_status: 'issued',
      payment_status: 'unpaid',
      sent_status: 'not_sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'B-paid',
      workspace_id: 'WS-1',
      landlord_id: 'L-1',
      bill_month: '2026-09',
      bill_status: 'issued',
      payment_status: 'paid',
      sent_status: 'not_sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'B-sent',
      workspace_id: 'WS-1',
      landlord_id: 'L-1',
      bill_month: '2026-09',
      bill_status: 'issued',
      payment_status: 'unpaid',
      sent_status: 'sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'B-void',
      workspace_id: 'WS-1',
      landlord_id: 'L-1',
      bill_month: '2026-09',
      bill_status: 'cancelled',
      payment_status: 'unpaid',
      sent_status: 'not_sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'B-draft',
      workspace_id: 'WS-1',
      landlord_id: 'L-1',
      bill_month: '2026-09',
      bill_status: 'draft',
      payment_status: 'unpaid',
      sent_status: 'not_sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'B-1',
      workspace_id: 'WS-1',
      landlord_id: 'L-1',
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
      workspace_id: 'WS-1',
      landlord_id: 'L-1',
      landlord_line_user_id: 'Uowner123456789012345678901',
      bill_ids: ['B-1', 'B-2']
    }
  ],
  'dispatcher must select only current-month unpaid, issued, not-sent bills and sort ids deterministically'
);

const isolatedGroups = context.billNotificationBuildMonthlyDispatchGroups_(
  [
    {
      bill_id: 'WS1-BILL',
      workspace_id: 'WS-1',
      landlord_id: 'L-1',
      bill_month: '2026-09',
      bill_status: 'issued',
      payment_status: 'unpaid',
      sent_status: 'not_sent',
      landlord_line_user_id: 'Uowner123456789012345678901'
    },
    {
      bill_id: 'WS2-BILL',
      workspace_id: 'WS-2',
      landlord_id: 'L-2',
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
  JSON.parse(JSON.stringify(isolatedGroups)),
  [
    {
      workspace_id: 'WS-1',
      landlord_id: 'L-1',
      landlord_line_user_id: 'Uowner123456789012345678901',
      bill_ids: ['WS1-BILL']
    },
    {
      workspace_id: 'WS-2',
      landlord_id: 'L-2',
      landlord_line_user_id: 'Uowner123456789012345678901',
      bill_ids: ['WS2-BILL']
    }
  ],
  'monthly bill summaries must not merge different Workspaces that reuse a LINE identity'
);

vm.runInNewContext(
  monthlySource.slice(summaryStart, summaryEnd),
  context,
  { filename: 'V2_MONTHLY_BILL_NOTIFICATIONS.js' }
);

assert.equal(
  context.billNotificationBuildLandlordMonthlySummaryText_('2026-09', 2, 0),
  '本月（2026年9月）租金帳單已發出，共 2 筆。',
  'landlord summary must state the bill month and successful send count'
);
assert.equal(
  context.billNotificationBuildLandlordMonthlySummaryText_('2026-09', 2, 1),
  '本月（2026年9月）租金帳單已發出，共 2 筆；另有 1 筆發送失敗，請查看帳單通知紀錄。',
  'landlord summary must disclose partial send failures'
);
assert.equal(
  context.billNotificationBuildLandlordMonthlySummaryText_('2026-09', 0, 1, 1),
  '本月（2026年9月）租金帳單已發出，共 0 筆；另有 1 筆發送失敗，請查看帳單通知紀錄；另有 1 筆未送出，請查看帳單通知紀錄。',
  'landlord summary must disclose total failures and skipped bills'
);

const summarySendStart = monthlySource.indexOf(
  'function billNotificationSendLandlordMonthlySummary_('
);
const summarySendEnd = monthlySource.indexOf(
  '\n\nfunction runV2MonthlyBillNotifications',
  summarySendStart
);
assert.notEqual(summarySendStart, -1, 'landlord monthly summary sender must exist');
assert.notEqual(summarySendEnd, -1, 'landlord monthly summary sender must have a boundary');

const summaryCalls = [];
context.workspaceNotifyTeam_ = payload => {
  summaryCalls.push(payload);
  return {
    success: true,
    code: 'NOTIFICATION_RECORDED',
    data: {
      sent_count: 1,
      failed_count: 0,
      skipped_count: 0,
      status: 'sent'
    }
  };
};
vm.runInNewContext(
  monthlySource.slice(summarySendStart, summarySendEnd),
  context,
  { filename: 'V2_MONTHLY_BILL_NOTIFICATIONS.js' }
);

const summarySendResult = context.billNotificationSendLandlordMonthlySummary_(
  {
    workspace_id: 'WS-1',
    landlord_id: 'L-1',
    landlord_line_user_id: 'Uowner123456789012345678901'
  },
  '2026-09',
  2,
  0
);
assert.equal(summarySendResult.delivered, true, 'successful landlord summary delivery must be reported');
assert.equal(summaryCalls.length, 1, 'one landlord summary notification must be recorded');
assert.equal(summaryCalls[0].workspace_id, 'WS-1', 'landlord summary must stay in the bill Workspace');
assert.equal(summaryCalls[0].fallback_line_user_id, '', 'Workspace summaries must not bypass membership validation with a fallback LINE UID');
assert.equal(summaryCalls[0].event_type, 'bill_created');
assert.equal(summaryCalls[0].body, '本月（2026年9月）租金帳單已發出，共 2 筆。');

const skippedSummaryResult = context.billNotificationSendLandlordMonthlySummary_(
  {
    workspace_id: 'WS-1',
    landlord_id: 'L-1',
    landlord_line_user_id: 'Uowner123456789012345678901'
  },
  '2026-09',
  0,
  1
);
assert.equal(skippedSummaryResult.delivered, true, 'total tenant bill failures must still notify the landlord');
assert.equal(summaryCalls.length, 2, 'total tenant bill failures must create a landlord notification');
assert.match(
  summaryCalls[1].body,
  /共 0 筆；另有 1 筆發送失敗/,
  'total tenant bill failures must be visible in the landlord message'
);

const skippedOnlySummaryResult = context.billNotificationSendLandlordMonthlySummary_(
  {
    workspace_id: 'WS-1',
    landlord_id: 'L-1',
    landlord_line_user_id: 'Uowner123456789012345678901'
  },
  '2026-09',
  0,
  0,
  1
);
assert.equal(skippedOnlySummaryResult.delivered, true, 'all skipped bills must still notify the landlord');
assert.equal(summaryCalls.length, 3, 'all skipped bills must create a landlord notification');
assert.match(
  summaryCalls[2].body,
  /共 0 筆；另有 1 筆未送出/,
  'all skipped bills must be visible in the landlord message'
);

context.V2_WORKSPACE_NOTIFICATION_SHEETS_ = {
  notifications: 'notifications',
  deliveries: 'deliveries'
};
const retryRows = new Map([
  ['notifications', [
    {
      notification_id: 'NTF-1',
      workspace_id: 'WS-1',
      event_type: 'bill_created',
      target_type: 'monthly_bill_dispatch',
      target_id: '2026-09',
      event_body: '本月（2026年9月）租金帳單已發出，共 2 筆。',
      status: 'failed'
    }
  ]],
  ['deliveries', [
    {
      notification_id: 'NTF-1',
      delivery_status: 'failed',
      line_user_id: 'Uretry123456789012345678901'
    }
  ]]
]);
context.workspaceGetObjectsWithRow_ = sheet => retryRows.get(sheet) || [];
const retryResults = context.billNotificationRetryPendingMonthlySummaries_(
  { getSheetByName: name => name },
  '2026-09'
);
assert.equal(retryResults.length, 1, 'failed landlord summaries must be retried independently');
assert.deepEqual(
  summaryCalls[3].recipient_line_user_ids,
  ['Uretry123456789012345678901'],
  'summary retries must target only the failed LINE recipient'
);
assert.equal(retryResults[0].sent_count, 1, 'successful summary retry must be counted');

assert.match(
  monthlySource,
  /workspaceNotifyTeam_\(/,
  'monthly dispatcher must record and deliver the landlord summary through the workspace notification center'
);
assert.match(
  monthlySource,
  /event_type:\s*['"]bill_created['"]/,
  'landlord summary must use the existing bill notification preference and recipient rules'
);
assert.match(
  monthlySource,
  /billNotificationRetryPendingMonthlySummaries_/,
  'failed landlord summaries must have an independent retry path'
);
const autoReminderSource = readFileSync(
  new URL('../apps-script/V2_AUTO_PAYMENT_REMINDER.js', import.meta.url),
  'utf8'
);

const billNotificationSource = readFileSync(
  new URL('../apps-script/V2_BILL_NOTIFICATIONS.js', import.meta.url),
  'utf8'
);
assert.match(
  billNotificationSource,
  /LINE 批次傳送結果不明，為避免自動重發已標記失敗/,
  'ambiguous LINE batch delivery must not remain eligible for automatic resend'
);
const requestedBillSelectorStart = billNotificationSource.indexOf(
  'function billNotificationSelectRequestedBills_('
);
const requestedBillSelectorEnd = billNotificationSource.indexOf(
  '\n\nfunction sendLandlordBillNotificationsByLineUid_',
  requestedBillSelectorStart
);
assert.notEqual(
  requestedBillSelectorStart,
  -1,
  'bill notification dispatch must have a requested-bill selector'
);
assert.notEqual(
  requestedBillSelectorEnd,
  -1,
  'bill notification requested-bill selector must have a boundary'
);

const billSelectorContext = {
  Boolean,
  String,
  Object,
  Array,
  billNotificationText_: value => value == null ? '' : String(value).trim()
};
vm.runInNewContext(
  billNotificationSource.slice(requestedBillSelectorStart, requestedBillSelectorEnd),
  billSelectorContext,
  { filename: 'V2_BILL_NOTIFICATIONS.js' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(
    billSelectorContext.billNotificationSelectRequestedBills_(
      [
        { bill_id: 'B-1', sent_status: 'not_sent' },
        { bill_id: 'B-2', sent_status: 'sent' }
      ],
      ['B-1', 'B-2'],
      { only_unsent: true }
    )
  )),
  [{ bill_id: 'B-1', sent_status: 'not_sent' }],
  'monthly dispatch must re-check sent_status after acquiring the send lock'
);

const workspacesSource = readFileSync(
  new URL('../apps-script/V2_WORKSPACES.js', import.meta.url),
  'utf8'
);
const contextResolverStart = workspacesSource.indexOf(
  'function workspaceResolveContextByLineUid_('
);
const contextResolverEnd = workspacesSource.indexOf(
  '\n\nfunction workspaceBuildEntryData_',
  contextResolverStart
);
assert.notEqual(contextResolverStart, -1, 'workspace context resolver must exist');
assert.notEqual(contextResolverEnd, -1, 'workspace context resolver must have a boundary');

const sheetRows = new Map([
  ['users', [{ user_id: 'U-1', line_user_id: 'line-owner', active_workspace_id: 'WS-1' }]],
  ['members', [
    { user_id: 'U-1', workspace_id: 'WS-1', is_primary: true, member_status: 'active' },
    { user_id: 'U-1', workspace_id: 'WS-2', is_primary: false, member_status: 'active' }
  ]],
  ['workspaces', [
    { workspace_id: 'WS-1', account_status: 'active' },
    { workspace_id: 'WS-2', account_status: 'active' }
  ]]
]);
const contextResolver = {
  workspaceText_: value => value == null ? '' : String(value).trim(),
  workspaceGetObjectsWithRow_: sheet => sheetRows.get(sheet) || [],
  workspaceIsActiveStatus_: value => String(value || 'active').toLowerCase() === 'active',
  workspaceBoolean_: value => value === true || String(value).toLowerCase() === 'true',
  V2_WORKSPACE_SHEETS_: { users: 'users', members: 'members', workspaces: 'workspaces' }
};
vm.runInNewContext(
  workspacesSource.slice(contextResolverStart, contextResolverEnd),
  contextResolver,
  { filename: 'V2_WORKSPACES.js' }
);
const requestedWorkspaceContext = contextResolver.workspaceResolveContextByLineUid_(
  { getSheetByName: name => name },
  'line-owner',
  { workspace_id: 'WS-2' }
);
assert.equal(
  requestedWorkspaceContext.activeWorkspace.workspace_id,
  'WS-2',
  'background bill dispatch must resolve the explicitly requested Workspace'
);
assert.equal(
  requestedWorkspaceContext.activeMembership.workspace_id,
  'WS-2',
  'background bill dispatch must use the requested Workspace membership'
);

context.workspaceNotifyTeam_ = () => ({
  success: false,
  code: 'WORKSPACE_NOTIFICATION_ERROR',
  message: 'notification failed'
});
const failedSummaryResult = context.billNotificationSendLandlordMonthlySummary_(
  {
    workspace_id: 'WS-1',
    landlord_id: 'L-1',
    landlord_line_user_id: 'Uowner123456789012345678901'
  },
  '2026-09',
  2,
  0
);
assert.equal(
  failedSummaryResult.success,
  false,
  'failed landlord summary delivery must not be reported as successful'
);
assert.equal(
  failedSummaryResult.data.failed_count,
  1,
  'failed landlord summary delivery must count an error without a data payload'
);

assert.match(
  autoReminderSource,
  /runV2MonthlyBillNotifications\(\)/,
  'the existing hourly dispatcher must invoke monthly bill notifications'
);

console.log('Phase 231 quick renewal and monthly bill notification tests passed.');
