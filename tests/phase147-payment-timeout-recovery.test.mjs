import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(path, 'utf8');

const reviewSource = read('landlord-payment-report-review.html');
const arrearsSource = read('landlord-arrears.html');

function extractFunction(source, name) {
  const asyncMarker = `async function ${name}(`;
  const syncMarker = `function ${name}(`;
  const asyncStart = source.indexOf(asyncMarker);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(syncMarker);
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

const reviewContext = { Array, String };
vm.runInNewContext(
  [
    extractFunction(reviewSource, 'rawText'),
    extractFunction(reviewSource, 'findConfirmedPaymentReport'),
    extractFunction(reviewSource, 'waitForPaymentReportRecoveryDelay'),
    extractFunction(reviewSource, 'recoverTimedOutPaymentReport')
  ].join('\n'),
  reviewContext
);

assert.deepEqual(
  reviewContext.findConfirmedPaymentReport(
    {
      reports: [
        { report_id: 'REPORT-1', status: 'confirmed', matched_payment_id: 'PAY-1' }
      ]
    },
    'REPORT-1'
  ),
  { report_id: 'REPORT-1', status: 'confirmed', matched_payment_id: 'PAY-1' }
);
assert.equal(
  reviewContext.findConfirmedPaymentReport(
    { reports: [{ report_id: 'REPORT-1', status: 'payment_reported' }] },
    'REPORT-1'
  ),
  null
);

reviewContext.setTimeout = (callback) => callback();
reviewContext.jsonpRequest = async (action) => {
  assert.equal(action, 'landlord_payment_reports_init');
  return {
    success: true,
    data: {
      reports: [
        { report_id: 'REPORT-1', status: 'confirmed', matched_payment_id: 'PAY-1' }
      ]
    }
  };
};
assert.equal(
  (await reviewContext.recoverTimedOutPaymentReport('REPORT-1')).matched_payment_id,
  'PAY-1'
);

const arrearsContext = { Array, String };
vm.runInNewContext(
  [
    extractFunction(arrearsSource, 'rawText'),
    extractFunction(arrearsSource, 'hasManualSettlementCommitted'),
    extractFunction(arrearsSource, 'waitForManualSettlementRecoveryDelay'),
    extractFunction(arrearsSource, 'recoverTimedOutManualSettlement')
  ].join('\n'),
  arrearsContext
);

assert.equal(
  arrearsContext.hasManualSettlementCommitted(
    { arrears: [{ bill_id: 'BILL-1', payment_status: 'paid', payment_id: 'PAY-1' }] },
    'BILL-1'
  ),
  true
);
assert.equal(
  arrearsContext.hasManualSettlementCommitted(
    { arrears: [{ bill_id: 'BILL-1', payment_status: 'unpaid', bill_status: 'open' }] },
    'BILL-1'
  ),
  false
);
assert.equal(
  arrearsContext.hasManualSettlementCommitted({ arrears: [] }, 'BILL-1'),
  true,
  'a successful arrears read with the target removed means it is no longer outstanding'
);

arrearsContext.setTimeout = (callback) => callback();
arrearsContext.callApi = async (action) => {
  assert.equal(action, 'landlord_arrears');
  return { success: true, data: { arrears: [] } };
};
assert.equal(
  await arrearsContext.recoverTimedOutManualSettlement('BILL-1'),
  true
);

assert.match(
  reviewSource,
  /API_TIMEOUT[\s\S]*recoverTimedOutPaymentReport/,
  'payment review must reconcile a timeout against authoritative state'
);
assert.match(
  arrearsSource,
  /API_TIMEOUT[\s\S]*recoverTimedOutManualSettlement/,
  'manual settlement must reconcile a timeout against authoritative state'
);
assert.doesNotMatch(
  extractFunction(reviewSource, 'recoverTimedOutPaymentReport'),
  /landlord_payment_report_update/,
  'timeout recovery must never submit the payment decision a second time'
);
assert.doesNotMatch(
  extractFunction(arrearsSource, 'recoverTimedOutManualSettlement'),
  /landlord_bill_manual_settle/,
  'timeout recovery must never submit manual settlement a second time'
);

console.log('Phase 147 payment timeout recovery tests passed.');
