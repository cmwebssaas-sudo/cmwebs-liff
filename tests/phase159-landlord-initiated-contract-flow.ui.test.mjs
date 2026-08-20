import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const createPage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const requestsPage = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');
const tenantPage = readFileSync(new URL('../tenant-contract.html', import.meta.url), 'utf8');

assert.match(createPage, /landlord_contract_initiate_new/);
assert.match(createPage, /confirmation_code/);
assert.match(createPage, /invite\.url/);
assert.match(createPage, /quickchart\.io\/qr/);
assert.match(createPage, /landlord_contract_initiate_renewal/);
assert.match(createPage, /previous_contract_id/);
assert.match(createPage, /tenant_name/);
assert.match(requestsPage, /landlord_contract_initiated_init/);
assert.match(requestsPage, /landlord_contract_invite_reissue/);
assert.match(requestsPage, /重新產生邀請/);
assert.match(requestsPage, /quickchart\.io\/qr/);
assert.match(requestsPage, /複製邀請連結/);
assert.match(requestsPage, /確認碼/);
assert.match(requestsPage, /landlord_contract_initiate_renewal/);
assert.match(requestsPage, /previous_contract_id/);
assert.match(tenantPage, /invite_id/);
assert.match(tenantPage, /tenant_contract_invite_auth_init/);
assert.match(tenantPage, /tenant_contract_invite_auth_status/);
assert.match(tenantPage, /tenant_contract_invite_submit/);
assert.match(tenantPage, /tenantInviteConfirmationCode/);
assert.match(tenantPage, /tenantInvitePhone/);
assert.equal(/localStorage\.setItem\([^)]*session_token/.test(tenantPage), false, 'tenant signing session must not be persisted in localStorage');

console.log('Phase 159 landlord-initiated contract UI RED/GREEN tests passed.');
