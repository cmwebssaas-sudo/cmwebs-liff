import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../landlord-billing.html', import.meta.url),
  'utf8'
);

assert.match(
  source,
  /const initialRentCreditPendingBillIds = new Set\(\);/,
  'the clear-amount action must keep a per-bill pending guard'
);

assert.match(
  source,
  /const initialRentCreditCompletedBillIds = new Set\(\);/,
  'the clear-amount action must keep a per-bill completion state'
);

assert.match(
  source,
  /class="detail-toggle initial-rent-credit-button"[\s\S]*data-bill-id="\$\{safeHtml\(item\.existing_bill\.bill_id\)\}"/,
  'the clear-amount button must be addressable by bill id'
);

assert.match(
  source,
  /jsonpRequest\([\s\S]*'landlord_bill_apply_initial_rent_credit'[\s\S]*\},\s*1\s*\)/,
  'the mutating clear-amount request must not use the read-request retry'
);

assert.match(
  source,
  /清除金額完成/,
  'the UI must explicitly tell the landlord that clearing the amount completed'
);

assert.match(
  source,
  /清除金額結果未確認，請先按重新整理確認；未再次送出。/,
  'an ambiguous timeout must instruct the landlord not to submit the mutation again'
);

assert.match(
  source,
  /loadPage\(\s*false,\s*\{\s*suppressError:\s*true\s*\}\s*\)/,
  'the mutation flow must use a silent readback after the write result is ambiguous'
);

assert.match(
  source,
  /async function loadPage\(showLoading, options\)/,
  'loadPage must support a readback mode that does not replace the page with a generic error'
);

assert.match(
  source,
  /initialRentCreditCompletedBillIds\.has\(/,
  'the rendered card must retain the completed state and prevent another clear click'
);

console.log('Phase 230 room 202 clear feedback UI tests passed.');
