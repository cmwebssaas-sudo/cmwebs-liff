import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routeDoc = readFileSync(new URL('../docs/04-API-ROUTES.md', import.meta.url), 'utf8');
const matrixDoc = readFileSync(new URL('../docs/09-TEST-MATRIX.md', import.meta.url), 'utf8');
const changelogDoc = readFileSync(new URL('../docs/CMWEBS_CHANGELOG.md', import.meta.url), 'utf8');
const currentStateDoc = readFileSync(new URL('../docs/CMWEBS_CURRENT_STATE.md', import.meta.url), 'utf8');
const executionDoc = readFileSync(new URL('../docs/CMWEBS_V2_1_CODEX_EXECUTION_RECORD.md', import.meta.url), 'utf8');
const dispatcherSource = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../apps-script/V2_TENANT_LEASE_ONBOARDING.js', import.meta.url), 'utf8');
const backfillSource = readFileSync(new URL('../apps-script/V2_LANDLORD_PAPER_CONTRACT_BACKFILL.js', import.meta.url), 'utf8');

assert.match(routeDoc, /landlord_contract_paper_backfill/);
assert.match(routeDoc, /紙本合約/);
assert.match(routeDoc, /不.*電子邀請|不.*LINE|不.*合約申請/);
assert.match(matrixDoc, /Phase 209|paper contract backfill/i);
assert.match(changelogDoc, /補登紙本合約|紙本合約補登/);
assert.match(currentStateDoc, /paper-contract backfill|paper contract backfill|紙本合約/i);
assert.match(executionDoc, /paper-contract backfill|paper contract backfill|紙本合約/i);
assert.match(currentStateDoc, /未部署|尚未部署|HUMAN_REQUIRED/);
assert.match(dispatcherSource, /landlordPaperContractBackfillIsRequest_\(postBody\)/);
assert.match(dispatcherSource, /e\.parameter\.tenant_id \|\| ''/);
assert.match(onboardingSource, /selectedTenantId/);
assert.match(onboardingSource, /selected_tenant:/);
assert.match(routeDoc, /does not add Sheet headers or run migration/);
assert.doesNotMatch(backfillSource, /ldEnsureContractDocumentsSheet_\(\)/);

console.log('Phase 211 paper contract backfill documentation tests passed.');
