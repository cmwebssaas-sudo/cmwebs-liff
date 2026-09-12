import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const tenantDetail = readFileSync('landlord-tenant-detail.html', 'utf8');
const reviewModule = readFileSync(
  'apps-script/V2_LANDLORD_LIFF_SIGNING_REVIEW_SESSION.js',
  'utf8'
);
const signingReview = readFileSync(
  'apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js',
  'utf8'
);
const initiatedContracts = readFileSync(
  'apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js',
  'utf8'
);

assert.match(
  tenantDetail,
  /<link rel="stylesheet" href="landlord-responsive\.css" \/>/,
  'tenant detail must load the shared desktop responsive shell'
);
assert.match(
  tenantDetail,
  /<div class="app-shell desktop-ready">/,
  'tenant detail must opt into the desktop shell'
);
assert.match(
  tenantDetail,
  /<aside class="desktop-sidebar"[^>]*>/,
  'tenant detail must provide desktop navigation'
);
assert.match(
  tenantDetail,
  /<main class="page desktop-main">/,
  'tenant detail must render content in the desktop main column'
);
assert.match(
  tenantDetail,
  /function updateDesktopChrome\(/,
  'tenant detail must update Workspace and role context in the desktop shell'
);

assert.match(
  reviewModule,
  /function resolveLandlordContractSigningReviewSession_\(/,
  'contract review backend must have a shared session resolver'
);
assert.match(
  signingReview,
  /resolveLandlordContractSigningReviewSession_\(sessionToken, policy\)/,
  'native contract review access must use the shared session resolver'
);
assert.match(
  initiatedContracts,
  /resolveLandlordContractSigningReviewSession_\(sessionToken, policy\)/,
  'landlord-initiated contract access must use the shared session resolver'
);

const runtime = {
  JSON,
  String,
  Number,
  Math,
  Date,
  Object,
  Array,
  V2_LANDLORD_SIGNING_REVIEW_AUTH_PURPOSE_: 'landlord_contract_signing_review',
  Utilities: {},
  PropertiesService: {}
};
vm.createContext(runtime);
vm.runInContext(reviewModule, runtime);
const nativeFailure = {
  success: false,
  code: 'LANDLORD_REVIEW_SESSION_INVALID'
};
let emailResolveCalls = 0;
runtime.verifyLandlordContractSigningReviewSessionToken_ = () => nativeFailure;
runtime.landlordEmailAuthResolveSession_ = () => {
  emailResolveCalls += 1;
  return {
    success: true,
    data: {
      session: {
        issued_at: '2026-09-13T00:00:00.000Z',
        expires_at: '2026-09-13T12:00:00.000Z'
      },
      user: {
        user_id: 'user-1',
        line_user_id: 'line-1'
      },
      membership: {
        membership_id: 'membership-1'
      },
      workspace: {
        workspace_id: 'workspace-1'
      },
      user_id: 'user-1',
      workspace_id: 'workspace-1'
    }
  };
};

const readSession = runtime.resolveLandlordContractSigningReviewSession_(
  'email-token',
  'read'
);
assert.equal(readSession.success, true);
assert.equal(readSession.data.source, 'email_session');
assert.equal(readSession.data.line_sub, 'line-1');
assert.equal(emailResolveCalls, 1);

const writeSession = runtime.resolveLandlordContractSigningReviewSession_(
  'email-token',
  'contract_write'
);
assert.equal(writeSession, nativeFailure);
assert.equal(
  emailResolveCalls,
  1,
  'non-read policies must not fall back to Email sessions'
);

console.log('Phase 259 desktop tenant detail and Email contract-read tests passed.');
