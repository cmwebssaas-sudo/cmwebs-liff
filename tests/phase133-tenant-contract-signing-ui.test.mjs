import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../tenant-contract.html', import.meta.url),
  'utf8'
);

const signingRender = source.match(
  /function renderTenantSigningWorkflow\(\)[\s\S]*?async function handleTenantArtifactSelect/
)?.[0] || '';
const signingSubmit = source.match(
  /async function submitTenantContractSigning\(\)[\s\S]*?async function uploadTenantContractArtifact/
)?.[0] || '';

assert.match(source, /tenant_contract_auth_init/);
assert.match(source, /tenant_contract_artifact_upload_submit/);
assert.match(source, /tenant_contract_sign_submit/);
assert.match(source, /tenant_contract_sign_status/);
assert.match(source, /await initializeTenantSigningSession\(\);[\s\S]*?renderTenantSigningWorkflow\(\);/);
assert.match(source, /SIGNABLE_CONTRACT_NOT_FOUND[\s\S]*?await loadPage\(\);/);
assert.match(source, /TENANT_SIGNING_MODE === 'renewal'[\s\S]*?\['signature'\]/);
assert.match(signingRender, /!submitted && !isRenewal/);
assert.match(signingRender, /identity_front/);
assert.match(signingRender, /identity_back/);
assert.match(signingRender, /tenantSignatureCanvas/);
assert.match(signingRender, /tenantSigningConsent/);
assert.match(signingRender, /送交簽署資料/);
assert.match(source, /function clearTenantSignature\(\)/);
assert.match(source, /function tenantSigningReadyToSubmit\(\)/);
assert.match(source, /CONTRACT_SIGNING_SCHEMA_NOT_READY/);
assert.match(signingSubmit, /consent: true/);
assert.doesNotMatch(signingSubmit, /line_user_id|tenant_id|workspace_id|landlord_id|signing_mode:/);
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.match(source, /min-height: 44px/);
assert.match(source, /safe-area-inset-bottom/);
assert.match(source, /@media \(max-width: 420px\)/);
assert.match(source, /@media \(max-width: 360px\)/);
assert.match(source, /\.signing-summary\s*\{\s*display: grid;[\s\S]*?minmax\(0, 1fr\)/);
assert.match(source, /\.signature-pad canvas\s*\{[\s\S]*?width: 100%/);
assert.match(source, /\.signing-sticky-action\s*\{[\s\S]*?bottom: calc\(var\(--nav-height\)/);
assert.match(source, /const LIFF_ID\s*=\s*'2010314940-iJB1D6sN'/);
assert.match(source, /AKfycby5n2iXv0z5Y99dpBATTkKHaF56bnHNZRdMmVh5aZKU8ciGa_Nc0vJzXaO120LT81X6Og\/exec/);

console.log('Phase 133 tenant-contract signing UI static tests passed.');
