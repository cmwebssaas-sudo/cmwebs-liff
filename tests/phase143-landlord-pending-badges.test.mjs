import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('landlord-more.html', 'utf8');

for (const badgeId of [
  'paymentReportPendingBadge',
  'contractRequestPendingBadge',
  'notificationUnreadBadge'
]) {
  const matches = source.match(new RegExp(`id="${badgeId}"`, 'g')) || [];
  assert.equal(matches.length, 1, `${badgeId} must be a unique menu badge`);
}

assert.match(
  source,
  /\.pending-count-badge\s*\{[\s\S]*?background:\s*#e5484d;[\s\S]*?color:\s*#fff;/,
  'pending badges must use the shared red badge style'
);

for (const action of [
  'landlord_payment_reports_init',
  'landlord_contract_requests_init',
  'landlord_notifications_init'
]) {
  assert.match(source, new RegExp(`jsonpRequest\\(\\s*'${action}'`));
}

function extractFunction(name) {
  const functionStart = source.indexOf(`function ${name}(`);
  assert.notEqual(functionStart, -1, `${name} must exist`);
  const asyncStart = source.lastIndexOf('async ', functionStart);
  const start =
    asyncStart >= 0 &&
    source.slice(asyncStart, functionStart) === 'async '
      ? asyncStart
      : functionStart;
  const openingBrace = source.indexOf('{', functionStart);
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`Could not extract ${name}`);
}

const elements = new Map([
  ['badge', { hidden: true, textContent: '' }]
]);
const context = {
  Math,
  Number,
  String,
  document: {
    getElementById(id) {
      return elements.get(id) || null;
    }
  }
};

vm.runInNewContext(
  [
    extractFunction('formatPendingBadgeCount'),
    extractFunction('setPendingBadge'),
    extractFunction('hidePendingBadge')
  ].join('\n'),
  context
);

assert.equal(context.formatPendingBadgeCount(1), '1');
assert.equal(context.formatPendingBadgeCount(99), '99');
assert.equal(context.formatPendingBadgeCount(100), '99+');
assert.equal(context.formatPendingBadgeCount(0), '');
assert.equal(context.formatPendingBadgeCount('not-a-count'), '');

context.setPendingBadge('badge', 1);
assert.deepEqual(elements.get('badge'), { hidden: false, textContent: '1' });
context.setPendingBadge('badge', 0);
assert.deepEqual(elements.get('badge'), { hidden: true, textContent: '' });
context.setPendingBadge('badge', 'invalid');
assert.deepEqual(elements.get('badge'), { hidden: true, textContent: '' });

const contractElements = new Map([
  ['contractPendingValue', { hidden: false, textContent: '' }],
  ['contractMenuBadge', { hidden: false, textContent: '', className: '' }],
  ['contractRequestPendingBadge', { hidden: true, textContent: '' }],
  ['paymentReportPendingBadge', { hidden: false, textContent: '4' }],
  ['notificationUnreadBadge', { hidden: false, textContent: '7' }]
]);
const contractContext = {
  Math,
  Number,
  String,
  document: {
    getElementById(id) {
      return contractElements.get(id) || null;
    }
  }
};

vm.runInNewContext(
  [
    extractFunction('formatPendingBadgeCount'),
    extractFunction('setPendingBadge'),
    extractFunction('hidePendingBadge'),
    extractFunction('setContractSummary')
  ].join('\n'),
  contractContext
);

contractContext.setContractSummary({ requests: [null] });
assert.deepEqual(
  contractElements.get('contractRequestPendingBadge'),
  { hidden: true, textContent: '' },
  'a malformed fulfilled contract item must hide only the contract badge'
);
assert.deepEqual(
  contractElements.get('paymentReportPendingBadge'),
  { hidden: false, textContent: '4' },
  'a malformed contract item must not clear a loaded payment badge'
);
assert.deepEqual(
  contractElements.get('notificationUnreadBadge'),
  { hidden: false, textContent: '7' },
  'a malformed contract item must not clear a loaded notification badge'
);

const orchestrationElements = new Map([
  ['refreshButton', {
    classList: {
      add() {},
      remove() {}
    }
  }],
  ['contractPendingValue', { textContent: '' }],
  ['contractMenuBadge', { textContent: '', className: '' }],
  ['contractRequestPendingBadge', { hidden: false, textContent: 'stale' }],
  ['paymentReportPendingBadge', { hidden: true, textContent: '' }],
  ['notificationUnreadBadge', { hidden: true, textContent: '' }],
  ['workspaceValue', { textContent: '' }],
  ['workspaceCountValue', { textContent: '' }],
  ['workspaceMenuBadge', { textContent: '', className: '' }]
]);
const requestedActions = [];
const orchestrationContext = {
  Math,
  Number,
  String,
  Object,
  Promise,
  console,
  requestedActions,
  document: {
    getElementById(id) {
      return orchestrationElements.get(id) || null;
    }
  }
};

vm.runInNewContext(
  [
    "let LINE_USER_ID = 'landlord-line-user';",
    `const jsonpRequest = function (action) {
      requestedActions.push(action);
      const responses = {
        landlord_contract_requests_init: {
          success: true,
          data: { requests: [null] }
        },
        landlord_workspace_context: {
          success: true,
          data: { active_workspace: {}, workspaces: [] }
        },
        landlord_payment_reports_init: {
          success: true,
          data: { summary: { pending: 4 } }
        },
        landlord_notifications_init: {
          success: true,
          data: { summary: { unread_count: 7 } }
        }
      };
      return Promise.resolve(responses[action]);
    };`,
    "const initLineUserId = async function () { throw new Error('unexpected LIFF initialisation'); };",
    extractFunction('formatPendingBadgeCount'),
    extractFunction('setPendingBadge'),
    extractFunction('hidePendingBadge'),
    extractFunction('setPendingBadgeFromSummary'),
    extractFunction('setContractSummary'),
    extractFunction('setSummaryError'),
    extractFunction('setWorkspaceSummary'),
    extractFunction('setWorkspaceSummaryError'),
    extractFunction('loadSummary')
  ].join('\n'),
  orchestrationContext
);

await orchestrationContext.loadSummary();
assert.deepEqual(
  requestedActions,
  [
    'landlord_contract_requests_init',
    'landlord_workspace_context',
    'landlord_payment_reports_init',
    'landlord_notifications_init'
  ],
  'loadSummary must execute the complete existing JSONP summary orchestration'
);
assert.deepEqual(
  orchestrationElements.get('contractRequestPendingBadge'),
  { hidden: true, textContent: '' },
  'the malformed fulfilled contract response must hide only the contract badge'
);
assert.deepEqual(
  orchestrationElements.get('paymentReportPendingBadge'),
  { hidden: false, textContent: '4' },
  'loadSummary must retain the fulfilled payment summary despite malformed contract data'
);
assert.deepEqual(
  orchestrationElements.get('notificationUnreadBadge'),
  { hidden: false, textContent: '7' },
  'loadSummary must retain the fulfilled notification summary despite malformed contract data'
);

function sourceSegment(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} must exist`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end === -1 ? source.length : end);
}

const paymentFailure = sourceSegment(
  "if (\n          paymentResult &&",
  "if (\n          notificationResult &&"
);
assert.match(
  paymentFailure,
  /else \{\s*hidePendingBadge\(\s*'paymentReportPendingBadge'\s*\);\s*\}/,
  'a rejected payment request must hide only the payment badge'
);
assert.doesNotMatch(paymentFailure, /notificationUnreadBadge|contractRequestPendingBadge/);

const notificationFailure = sourceSegment(
  "if (\n          notificationResult &&",
  "if (\n          workspaceResult &&"
);
assert.match(
  notificationFailure,
  /else \{\s*hidePendingBadge\(\s*'notificationUnreadBadge'\s*\);\s*\}/,
  'a rejected notification request must hide only the notification badge'
);
assert.doesNotMatch(notificationFailure, /paymentReportPendingBadge|contractRequestPendingBadge/);

const contractFailure = sourceSegment(
  'function setSummaryError(message) {',
  'async function loadSummary() {'
);
assert.match(
  contractFailure,
  /hidePendingBadge\(\s*'contractRequestPendingBadge'\s*\);/,
  'a rejected contract request must hide only the contract badge'
);
assert.doesNotMatch(contractFailure, /paymentReportPendingBadge|notificationUnreadBadge/);

for (const page of [
  'landlord-more.html',
  'landlord-arrears.html',
  'landlord-paid-bills.html'
]) {
  const pageSource = readFileSync(page, 'utf8');
  assert.doesNotMatch(
    pageSource,
    /goPage\('landlord-payment-reports\.html'\)/,
    `${page} must not route landlord navigation to tenant payment submission`
  );
}

console.log('Phase 143 landlord pending badge tests passed.');
