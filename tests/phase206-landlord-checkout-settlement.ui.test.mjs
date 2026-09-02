import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const checkoutPage = readFileSync(new URL('../landlord-tenant-checkout.html', import.meta.url), 'utf8');

assert.match(checkoutPage, /landlord_contract_checkout_settlement_init/);
assert.match(checkoutPage, /landlord_contract_checkout_settlement_preview/);
assert.match(checkoutPage, /landlord_contract_checkout_evidence_upload/);
assert.match(checkoutPage, /9\/1 電表度數/);
assert.match(checkoutPage, /退房日電表度數/);
assert.match(checkoutPage, /兩張電表照片/);
assert.match(checkoutPage, /押金扣除/);
assert.match(checkoutPage, /應補繳/);
assert.match(checkoutPage, /押金應退/);
assert.match(checkoutPage, /含退房日，共 7 天/);
assert.match(checkoutPage, /accept="image\/jpeg,image\/png"/g);
assert.match(checkoutPage, /start_meter_reading/);
assert.match(checkoutPage, /end_meter_reading/);
assert.match(checkoutPage, /start_meter_document_id/);
assert.match(checkoutPage, /end_meter_document_id/);
assert.match(checkoutPage, /deposit_deduction_amount/);
assert.match(checkoutPage, /deposit_deduction_note/);
assert.doesNotMatch(checkoutPage, /landlord_contract_checkout_complete',[\s\S]*?input:\s*\{\s*contract_id:[\s\S]*?note,\s*idempotency_key/);

console.log('Phase 206 landlord checkout settlement UI RED/GREEN tests passed.');
