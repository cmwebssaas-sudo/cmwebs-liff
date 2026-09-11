import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const checkoutPage = readFileSync(new URL('../landlord-tenant-checkout.html', import.meta.url), 'utf8');

assert.match(checkoutPage, /快速結案/);
assert.match(checkoutPage, /手動應收金額/);
assert.match(checkoutPage, /實際退款金額/);
assert.match(checkoutPage, /settlement_mode/);
assert.match(checkoutPage, /manual_receivable_amount/);
assert.match(checkoutPage, /manual_refund_amount/);
assert.match(checkoutPage, /scrollIntoView/);
assert.match(checkoutPage, /押金扣除說明/);
assert.match(checkoutPage, /不要求電表照片|不需要電表照片/);

console.log('Phase 253 landlord checkout quick closeout UI RED/GREEN tests passed.');
