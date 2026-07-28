import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const source = readFileSync(new URL('../apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js', import.meta.url), 'utf8');
const artifactSource = readFileSync(new URL('../apps-script/V2_CONTRACT_ARTIFACT_STORAGE.js', import.meta.url), 'utf8');
const submissionSource = readFileSync(new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js', import.meta.url), 'utf8');
const dispatcher = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../tenant-contract.html', import.meta.url), 'utf8');

for (const required of [
  'CMWEBS_LINE_LOGIN_CHANNEL_ID', 'CMWEBS_LIFF_SESSION_HMAC_SECRET',
  'https://api.line.me/oauth2/v2.1/verify', 'UrlFetchApp.fetch',
  'tenant_contract_auth_init', 'tenant_contract_auth_status',
  'createTenantLiffSessionToken_', 'verifyTenantLiffSessionToken_',
  'V2_TENANT_LIFF_AUTH_TTL_SECONDS_ = 600', 'tenantLiffSigningConstantEquals_',
  'tenantLiffSigningResolvePrincipal_', 'CacheService.getScriptCache()'
]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.match(source, /claims\.iss !== 'https:\/\/access\.line\.me'/);
assert.match(source, /claims\.aud !== channelId/);
assert.match(source, /Number\(claims\.exp\) <= now/);
assert.match(source, /TENANT_USER_NOT_ACTIVE|TENANT_MAPPING_NOT_FOUND|WORKSPACE_MEMBERSHIP_INVALID/);
assert.match(source, /SIGNABLE_CONTRACT_NOT_FOUND/);
assert.match(source, /AUTH_EXCHANGE_DENIED/);
assert.match(dispatcher, /tenantLiffSigningIsAuthRequest_\(postBody\)/);
assert.match(dispatcher, /tenant_contract_auth_status/);
assert.match(page, /liff\.getIDToken\(\)/);
assert.match(page, /crypto\.getRandomValues/);
assert.match(page, /tenant_contract_auth_init/);
assert.match(page, /tenant_contract_auth_status/);
assert.match(page.match(/async function loadPage\(\)[\s\S]*?async function main/)?.[0] || '', /tenant_contract_init/);
assert.doesNotMatch(page.match(/initializeTenantSigningSession\(\)[\s\S]*?\n    }/)?.[0] || '', /line_user_id|LINE_USER_ID/);
assert.doesNotMatch(source, /CMWEBS_LEGACY_CONTRACT_SYNC_HMAC_SECRET/);
assert.match(artifactSource, /CMWEBS_CONTRACT_SIGNING_DRIVE_ROOT_FOLDER_ID/);
assert.match(artifactSource, /verifyTenantLiffSessionToken_/);
assert.match(artifactSource, /ARTIFACT_TYPE_NOT_ALLOWED/);
assert.match(artifactSource, /CONTRACT_ARTIFACT_SCHEMA_NOT_READY/);
assert.match(artifactSource, /setTrashed\(true\)/);
assert.match(artifactSource, /DriveApp\.Access\.PRIVATE/);
assert.doesNotMatch(artifactSource, /contract_status\s*=/);
assert.match(dispatcher, /tenant_contract_artifact_upload_status/);
assert.match(dispatcher, /tenantContractArtifactIsUploadRequest_\(postBody\)/);
assert.match(dispatcher, /tenant_contract_sign_status/);
assert.match(dispatcher, /tenantContractSigningIsSubmitRequest_\(postBody\)/);
assert.match(page, /tenant_contract_artifact_upload_submit/);
assert.match(page, /tenant_contract_artifact_upload_status/);
assert.match(page, /簽署模式尚未就緒，請重新驗證/);
assert.doesNotMatch(page.match(/async function uploadTenantContractArtifact[\s\S]*?function tenantContractArtifactBase64/)?.[0] || '', /line_user_id|workspace_id|tenant_id|landlord_id|signing_mode:/);
assert.match(submissionSource, /tenant_contract_sign_submit/);
assert.match(submissionSource, /verifyTenantLiffSessionToken_/);
assert.match(submissionSource, /CONTRACT_SIGNING_SCHEMA_NOT_READY/);
assert.match(submissionSource, /REQUIRED_ARTIFACT_MISSING/);
assert.match(submissionSource, /tenant_signing_submission_status: 'submitted'/);
assert.doesNotMatch(submissionSource, /contract_status\s*=/);

console.log('Phase 130 verified LIFF signing-session static tests passed.');
