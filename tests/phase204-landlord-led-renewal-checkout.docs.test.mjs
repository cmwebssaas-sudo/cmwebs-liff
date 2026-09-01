import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiDocs = readFileSync(new URL('../docs/04-API-ROUTES.md', import.meta.url), 'utf8');
const matrix = readFileSync(new URL('../docs/09-TEST-MATRIX.md', import.meta.url), 'utf8');
const changelog = readFileSync(new URL('../docs/CMWEBS_CHANGELOG.md', import.meta.url), 'utf8');

assert.match(apiDocs, /landlord_contract_checkout_init/);
assert.match(apiDocs, /landlord_contract_checkout_complete/);
assert.match(apiDocs, /自動詢問房客/);
assert.match(apiDocs, /checkout_idempotency_key/);
assert.match(apiDocs, /原合約.*(?:日期|全文).*不.*覆寫/);
assert.match(matrix, /Phase 202/);
assert.match(matrix, /UNVERIFIED/);
assert.match(changelog, /房東主導續約/);
assert.match(changelog, /未部署/);

console.log('Phase 204 landlord-led renewal checkout documentation tests passed.');
