import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../tenant-contract.html', import.meta.url),
  'utf8'
);
const releaseSource = readFileSync(
  new URL('../frontend-release.js', import.meta.url),
  'utf8'
);
const tenantBindSource = readFileSync(
  new URL('../tenant-bind.html', import.meta.url),
  'utf8'
);
const tenantHomeSource = readFileSync(
  new URL('../tenant-home.html', import.meta.url),
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
assert.match(source, /function renderTenantSigningTerms_\(terms\)/);
assert.match(signingRender, /renderTenantSigningTerms_\(terms\)/);
assert.match(source, /terms\.signature_image/);
assert.match(source, /signing-signature-image/);
assert.match(source, /data:\$\{mimeType\};base64,\$\{base64\}/);
assert.match(source, /function clearTenantSignature\(\)/);
assert.match(source, /function tenantSigningReadyToSubmit\(\)/);
assert.match(source, /CONTRACT_SIGNING_SCHEMA_NOT_READY/);
assert.match(signingSubmit, /consent: true/);
assert.match(source, /result\.data && result\.data\.terms_document/);
assert.doesNotMatch(signingSubmit, /line_user_id|tenant_id|workspace_id|landlord_id|signing_mode:/);
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.match(source, /min-height: 44px/);
assert.match(source, /safe-area-inset-bottom/);
assert.match(source, /@media \(max-width: 420px\)/);
assert.match(source, /@media \(max-width: 360px\)/);
assert.match(source, /\.signing-summary\s*\{\s*display: grid;[\s\S]*?minmax\(0, 1fr\)/);
assert.match(source, /\.signature-pad canvas\s*\{[\s\S]*?width: 100%/);
assert.match(source, /\.signing-action\s*\{[\s\S]*?padding-top: 18px;[\s\S]*?background: #ffffff;/);
assert.doesNotMatch(source, /\.signing-sticky-action/);
assert.doesNotMatch(source, /\.signing-action\s*\{[\s\S]*?position:\s*(?:fixed|sticky)/);
assert.match(source, /const LIFF_ID\s*=\s*'2010314940-iJB1D6sN'/);
assert.match(source, /AKfycbwnnuIFZ22eO6MxMnWOYHovgMT2xuTbcIgzbq4qmxXE3gjGoTJFcBGXlsNDS-lqr3EILQ\/exec/);
assert.match(
  releaseSource,
  /20260902-renewal-date-prefill-v2/,
  'the frontend cache version must advance when the tenant contract preview changes'
);
for (const pageSource of [tenantBindSource, tenantHomeSource, source]) {
  assert.match(
    pageSource,
    /frontend-release\.js\?v=20260902-renewal-date-prefill-v2/,
    'tenant entry pages must bypass the cached frontend release script'
  );
}

console.log('Phase 133 tenant-contract signing UI static tests passed.');
