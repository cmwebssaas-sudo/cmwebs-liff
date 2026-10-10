import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(path, 'utf8');

const tenantReports = read('apps-script/V2_TENANT_PAYMENT_REPORTS.js');
const settlement = read('apps-script/V2_PAYMENT_SETTLEMENT.js');
const landlordManagement = read('apps-script/V2_LANDLORD_MANAGEMENT.js');
const landlordMore = read('landlord-more.html');
const landlordHome = read('landlord-home.html');
const legacyLandlordReports = read('landlord-payment-reports.html');
const landlordEntry = read('landlord-entry.html');

assert.match(
  tenantReports,
  /function tenantPaymentReportResolveCanonicalContext_/,
  'payment reports must resolve tenant context from canonical runtime data'
);
assert.match(
  tenantReports,
  /include_landlord_tenant_list_view\s*:\s*false/,
  'payment reports must not require the incomplete compatibility view'
);
assert.match(
  tenantReports,
  /landlord-payment-report-review\.html/,
  'payment report notifications must open the landlord review page'
);
assert.doesNotMatch(
  tenantReports,
  /action_url\s*:\s*['"][^'"]*landlord-payment-reports\.html['"]/
);

assert.equal(
  existsSync('landlord-payment-report-review.html'),
  true,
  'the landlord review entry page must be published in the repository'
);
assert.match(legacyLandlordReports, /landlord-payment-report-review\.html/);
assert.match(legacyLandlordReports, /location\.replace\(target\.href\)/);

const landlordReview = read('landlord-payment-report-review.html');
assert.match(landlordReview, /const LIFF_ID\s*=\s*['"]2010314940-EjX1qbb8['"]/);
assert.match(landlordReview, /landlord-entry\.html/);
assert.match(landlordReview, /landlord_payment_reports_init/);
assert.match(landlordReview, /landlord_payment_report_(?:settle|update)/);
assert.doesNotMatch(
  landlordReview,
  /liff\.login\(\s*\{\s*redirectUri\s*:\s*location\.href/
);

function extractApiUrl(source, label) {
  const match = source.match(
    /const API_URL\s*=\s*['"]([^'"]+)['"]/s
  );
  assert.ok(match, `${label} must define API_URL`);
  return match[1];
}

assert.equal(
  extractApiUrl(landlordReview, 'landlord payment review'),
  extractApiUrl(landlordEntry, 'landlord entry'),
  'payment review must call the same Production Apps Script Web App as the login gateway'
);
assert.equal(
  extractApiUrl(landlordHome, 'landlord home'),
  extractApiUrl(landlordEntry, 'landlord entry'),
  'landlord home must call the same Production Apps Script Web App as the login gateway'
);

for (const source of [landlordMore, landlordHome]) {
  assert.match(source, /landlord-payment-report-review\.html/);
  assert.doesNotMatch(source, /landlord-payment-reports\.html/);
}

assert.match(
  landlordMore,
  /id=["']paymentReportPendingBadge["'][^>]*class=["'][^"']*pending-count-badge/
);
assert.match(
  landlordMore,
  /id=["']notificationUnreadBadge["'][^>]*class=["'][^"']*pending-count-badge/
);
assert.match(
  landlordMore,
  /\.pending-count-badge\[hidden\]\s*\{\s*display:\s*none\s*!important;/
);
assert.match(landlordMore, /landlord_notifications_init/);
assert.match(landlordMore, /normalisePendingBadgeCount/);
assert.match(
  landlordHome,
  /function countPendingPaymentReports\(/,
  'landlord home must calculate payment pending count from report details'
);
assert.match(landlordReview, /bottom-nav-inner/);
assert.match(landlordReview, /class=["']nav-item active["']/);
assert.doesNotMatch(landlordReview, /nav-button/);

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

assert.match(
  landlordManagement,
  /function lmResolveEffectivePaymentReportStatus_\(/,
  'landlord management must reconcile already-paid bills when reading reports'
);

const settlementStatusContext = {
  String,
  Array,
  Object
};
vm.runInNewContext(
  extractFunction(
    landlordManagement,
    'lmResolveEffectivePaymentReportStatus_'
  ) + '\n' + extractFunction(landlordManagement, 'lmText_'),
  settlementStatusContext
);

const stalePendingReport = {
  status: 'pending',
  matched_payment_id: ''
};
const alreadyPaidBill = {
  payment_status: 'paid',
  payment_id: 'PAY-001'
};
const reconciledReport = settlementStatusContext.lmResolveEffectivePaymentReportStatus_(
  stalePendingReport,
  alreadyPaidBill
);
assert.equal(reconciledReport.status, 'confirmed');
assert.equal(reconciledReport.matched_payment_id, 'PAY-001');

const matchedPendingReport = settlementStatusContext.lmResolveEffectivePaymentReportStatus_(
  { status: 'payment_reported', matched_payment_id: 'PAY-002' },
  null
);
assert.equal(matchedPendingReport.status, 'confirmed');

const stillPendingReport = settlementStatusContext.lmResolveEffectivePaymentReportStatus_(
  stalePendingReport,
  { payment_status: 'unpaid', payment_id: '' }
);
assert.equal(stillPendingReport.status, 'pending');

const badgeElements = new Map([
  ['paymentReportPendingBadge', { hidden: false, textContent: 'old' }],
  ['notificationUnreadBadge', { hidden: false, textContent: 'old' }]
]);
const badgeContext = {
  Math,
  Number,
  Object,
  document: {
    getElementById(id) {
      return badgeElements.get(id) || null;
    }
  }
};
vm.runInNewContext(
  [
    extractFunction(landlordMore, 'normalisePendingBadgeCount'),
    extractFunction(landlordMore, 'formatPendingBadgeCount'),
    extractFunction(landlordMore, 'setPendingBadge'),
    extractFunction(landlordMore, 'hidePendingBadge')
  ].join('\n'),
  badgeContext
);
assert.equal(badgeContext.formatPendingBadgeCount(0), '');
assert.equal(badgeContext.formatPendingBadgeCount(3), '3');
assert.equal(badgeContext.formatPendingBadgeCount(true), '');
badgeContext.setPendingBadge('notificationUnreadBadge', 0);
assert.deepEqual(badgeElements.get('notificationUnreadBadge'), { hidden: true, textContent: '' });
badgeContext.setPendingBadge('paymentReportPendingBadge', 2);
assert.deepEqual(badgeElements.get('paymentReportPendingBadge'), { hidden: false, textContent: '2' });

const homeActionContext = {
  Math,
  Number,
  Array
};
vm.runInNewContext(
  [
    extractFunction(landlordHome, 'numberValue'),
    extractFunction(landlordHome, 'findSummaryNumber'),
    extractFunction(landlordHome, 'countPendingPaymentReports'),
    extractFunction(landlordHome, 'buildActionSummary')
  ].join('\n'),
  homeActionContext
);
const homeActionSummary = homeActionContext.buildActionSummary(
  {},
  {
    summary: { pending: 2 },
    reports: [
      { status: 'confirmed' },
      { status: 'confirmed' },
      { status: 'rejected' }
    ]
  },
  {}
);
assert.equal(homeActionSummary.paymentPending, 0);

const reviewSummaryContext = { String, Array };
vm.runInNewContext(
  [
    extractFunction(landlordReview, 'rawText'),
    extractFunction(landlordReview, 'buildReviewSummary')
  ].join('\n'),
  reviewSummaryContext
);
const reviewSummary = reviewSummaryContext.buildReviewSummary({
  summary: { pending: 2 },
  reports: [
    { status: 'confirmed' },
    { status: 'confirmed' },
    { status: 'rejected' }
  ]
});
assert.equal(reviewSummary.total, 3);
assert.equal(reviewSummary.pending, 0);
assert.equal(reviewSummary.confirmed, 2);
assert.equal(reviewSummary.rejected, 1);
assert.equal(reviewSummary.voided, 0);

assert.match(
  settlement,
  /workspaceLandlordResolveAccess_\(\s*landlordLineUserId/
);
assert.match(
  settlement,
  /principalLandlordIds\.indexOf\(\s*reportLandlordId\s*\)\s*!==\s*-1/
);

console.log('Phase 144 landlord payment flow tests passed.');
