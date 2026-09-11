import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiDocs = readFileSync(new URL('../docs/04-API-ROUTES.md', import.meta.url), 'utf8');
const dataModel = readFileSync(new URL('../docs/05-DATA-MODEL.md', import.meta.url), 'utf8');
const matrix = readFileSync(new URL('../docs/09-TEST-MATRIX.md', import.meta.url), 'utf8');

assert.match(apiDocs, /手動快速結案/);
assert.match(apiDocs, /manual_receivable_amount/);
assert.match(dataModel, /manual_refund_amount/);
assert.match(dataModel, /settlement_mode/);
assert.match(matrix, /Phase 252/);
assert.match(matrix, /快速結案/);

console.log('Phase 254 landlord checkout quick closeout documentation RED/GREEN tests passed.');
