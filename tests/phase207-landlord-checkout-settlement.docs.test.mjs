import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiDocs = readFileSync(new URL('../docs/04-API-ROUTES.md', import.meta.url), 'utf8');
const matrix = readFileSync(new URL('../docs/09-TEST-MATRIX.md', import.meta.url), 'utf8');
const changelog = readFileSync(new URL('../docs/CMWEBS_CHANGELOG.md', import.meta.url), 'utf8');
const currentState = readFileSync(new URL('../docs/CMWEBS_CURRENT_STATE.md', import.meta.url), 'utf8');
const executionRecord = readFileSync(new URL('../docs/CMWEBS_V2_1_CODEX_EXECUTION_RECORD.md', import.meta.url), 'utf8');

assert.match(apiDocs, /landlord_contract_checkout_settlement_init/);
assert.match(apiDocs, /landlord_contract_checkout_settlement_preview/);
assert.match(apiDocs, /landlord_contract_checkout_evidence_upload/);
assert.match(apiDocs, /V2_checkout_settlements/);
assert.match(apiDocs, /checkout_start_meter/);
assert.match(apiDocs, /CHECKOUT_SETTLEMENT_REQUIRED/);
assert.match(matrix, /Phase 205/);
assert.match(matrix, /Phase 206/);
assert.match(matrix, /Phase 207/);
assert.match(changelog, /退房結算/);
assert.match(changelog, /上月.*電費.*設備/);
assert.match(changelog, /9\/1.*9\/7/);
assert.match(changelog, /HUMAN_REQUIRED/);
assert.match(currentState, /20260902-landlord-checkout-settlement-v1/);
assert.match(currentState, /未部署|尚未部署|HUMAN_REQUIRED/);
assert.match(executionRecord, /checkout settlement|退房結算/);

console.log('Phase 207 landlord checkout settlement documentation RED/GREEN tests passed.');
