# 房東發起新租／續約線上簽署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 V2.1 local candidate 中完成房東發起新租／續約、房客 LINE 邀請簽署、房東核准後才生效的完整閉環。

**Architecture:** 新增一個小型 Apps Script contract-initiation 模組，負責邀請、待簽租約、暫存房客及續約版本；沿用既有 Workspace landlord review session、native tenant signing artifact/session 與 `V2_contracts` canonical row。邀請網址只帶非敏感 `invite_id`，一次性確認碼由房東畫面另行提供，房客以 LINE 驗證後才取得短期 server session。

**Tech Stack:** Google Apps Script ES5-style global modules、Google Sheets rows、LINE LIFF 2 SDK、JSONP/POST exchange、Node.js `.mjs` runtime mocks、HTML static assertions。

## Global Constraints

- V2.1 只做 standard digital-contract completion；不引入 V3/V4、多租戶 SaaS、第三方電子簽章或客製分支。
- `workspace_id`、RBAC、Workspace isolation 是每個讀寫路徑的必要控制點。
- `signing_mode` 必須由後端從 canonical contract/session 推導，瀏覽器不可指定 tenant、Workspace、landlord、LINE identity 或模式作為寫入權限。
- 新租必要附件為 `identity_front`、`identity_back`、`signature`；續約只能要求 `signature`。
- 房客簽名只寫入 submitted evidence，不能直接變更 `contract_status`；只有房東核准流程可 activation。
- Tokens、ID tokens、身份圖片、簽名、Drive IDs 與內部 metadata 不得放入 URL、browser storage 或 console。
- Apps Script、Sheets、Properties、triggers、LINE、LIFF、GitHub Pages 與 Production 不在本次部署範圍。
- 不新增版本式正式檔名；新增 source 檔使用責任導向名稱，不使用 `_FIXED`、`final-` 或其他 suffix。
- 每個 implementation slice 都先寫 failing test，確認 RED 後才寫 production code。

---

## File map

| File | Responsibility |
|---|---|
| `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js` | New/renewal initiation, `V2_contract_invites` schema, invite claim, provisional tenant data, invitation public view, and finalization helpers. |
| `apps-script/程式碼.js` | Dispatch new landlord and tenant invite routes; preserve existing compatibility routes. |
| `apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js` | Add invite-auth exchange and server-derived new-tenant signing session. |
| `apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js` | Accept invite session ownership and keep submission status-only behavior. |
| `apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js` | Invoke mode-specific post-approval finalization while retaining serialized review decision checks. |
| `apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js` | Add landlord-session-backed initiation wrappers and Workspace-scoped list/cancel operations. |
| `landlord-tenant-create.html` | Render available rooms, create a pending new-tenant invite, and show QR/link/confirmation code. |
| `landlord-contract-requests.html` | Show landlord-created pending invitations and use the existing native review queue for approval. |
| `tenant-contract.html` | Read `invite_id`, perform invite authentication, collect new-tenant fields, and keep renewal signature-only. |
| `tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs` | Runtime RED/GREEN coverage for schema, initiation, invite claim, renewal, idempotency and finalization. |
| `tests/phase158-landlord-initiated-contract-flow-ui.test.mjs` | Static assertions for landlord invite UI, tenant mode UI, QR safety and existing mobile shell. |
| `docs/04-API-ROUTES.md` | Add the new route inventory and transport/authority contracts. |
| `docs/CMWEBS_CHANGELOG.md` | Record local-only implementation candidate and validation boundary. |

---

### Task 1: Lock the contract initiation state machine with failing runtime tests

**Files:**
- Create: `tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs`
- Create: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`

**Interfaces:**
- Produces `landlordInitiatedContractCreateNew_`, `landlordInitiatedContractCreateRenewal_`, `landlordInitiatedContractListBySession_`, `landlordInitiatedContractCancelBySession_`, `landlordInitiatedContractInviteClaim_`, and `landlordInitiatedContractFinalizeApproval_` for later dispatcher and review tasks.
- Uses `V2_contracts`, `V2_users`, `V2_tenants`, `V2_rooms`, `V2_properties`, `V2_contract_artifacts`, and the new `V2_contract_invites` sheet.

- [ ] **Step 1: Write the failing runtime test for new vacant-room initiation.**

  Build the existing repository-style VM sheet harness with canonical headers and assert the behavior below:

  ```js
  const result = api.landlordInitiatedContractCreateNew_(access, {
    property_id: 'P1', room_id: 'R603', start_date: '2026-09-01', end_date: '2027-08-31',
    rent_amount: 25000, management_fee: 1000, deposit_amount: 50000, payment_day: 5,
    tenant_name: '', tenant_phone: '', tenant_email: ''
  });
  assert.equal(result.success, true);
  assert.equal(result.data.contract.contract_status, 'pending_tenant_signature');
  assert.equal(result.data.contract.signing_mode, 'new_tenant');
  assert.equal(sheets.V2_rooms.rows[0][roomStatusColumn], 'vacant');
  assert.equal(sheets.V2_contracts.rows[0][contractStatusColumn], 'pending_tenant_signature');
  assert.equal(result.data.invite.confirmation_code.length, 6);
  assert.equal(result.data.invite.url.includes(result.data.invite.confirmation_code), false);
  ```

  The test must also assert that no active tenant view row or active bill is created and that missing required contract terms return `CONTRACT_INITIATION_INVALID`.

- [ ] **Step 2: Run the new test and verify the expected RED failure.**

  Run:

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  ```

  Expected: fail because `landlordInitiatedContractCreateNew_` and the initiation module do not exist yet. Fix only test-harness mistakes if the failure is an import or syntax error.

- [ ] **Step 3: Implement the minimum schema and initiation engine.**

  In `V2_LANDLORD_INITIATED_CONTRACTS.js` define `V2_LANDLORD_INITIATED_CONTRACT_INVITE_SHEET_` as `V2_contract_invites` and `V2_LANDLORD_INITIATED_CONTRACT_INVITE_HEADERS_` as the 14-column list `invite_id`, `workspace_id`, `contract_id`, `room_id`, `landlord_user_id`, `landlord_membership_id`, `claim_code_hash`, `status`, `expires_at`, `claimed_at`, `claimed_line_user_id`, `cancelled_at`, `created_at`, `updated_at`. Implement these exact function signatures: `landlordInitiatedContractCreateNew_(access, input)`, `landlordInitiatedContractCreateRenewal_(access, input)`, `landlordInitiatedContractListBySession_(sessionToken)`, `landlordInitiatedContractCancelBySession_(sessionToken, inviteId)`, `landlordInitiatedContractInviteClaim_(inviteId, confirmationCode, lineSub, tenantData)`, and `landlordInitiatedContractFinalizeApproval_(ss, access, contract, now)`. Each function must validate input and return the specified result/error envelope. Use the existing `tenantContractSigningReviewAccessFromSession_` and `workspaceLandlordCheckPolicy_` helpers when available; never trust a browser-supplied actor ID. Read, claim, submit, and approval paths must return `CONTRACT_INVITE_SCHEMA_NOT_READY` when the invite sheet or required headers are absent. Schema creation is limited to an explicit local/test migration helper and is not called by a normal request. Generate an opaque UUID `invite_id`, store only the SHA-256/HMAC digest of the six-digit confirmation code, and keep the raw code only in the immediate response.

  New initiation must create a provisional tenant identity with `pending_claim` status only when the canonical contract requires a tenant ID; it must not populate active tenant views, room current pointers, occupied state, or bills. Renewal must copy the existing tenant identity, set `previous_contract_id`, set `signing_mode = renewal`, and reject a non-active predecessor or a cross-Workspace predecessor.

- [ ] **Step 4: Run the runtime test and verify GREEN.**

  Run:

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  ```

  Expected: PASS for the new initiation and renewal cases. The test must prove the raw confirmation code is not present in the invite URL or stored invite row.

- [ ] **Step 5: Commit the isolated domain slice.**

  ```bash
  git add apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  git commit -m "feat: add landlord initiated contract state engine"
  ```

---

### Task 2: Add authenticated landlord initiation routes and Workspace wrappers

**Files:**
- Modify: `apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js`
- Modify: `apps-script/程式碼.js`
- Modify: `tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs`

**Interfaces:**
- Consumes `landlordInitiatedContractCreateNew_`, `landlordInitiatedContractCreateRenewal_`, `landlordInitiatedContractListBySession_`, and `landlordInitiatedContractCancelBySession_`.
- Produces `landlord_contract_initiate_new`, `landlord_contract_initiate_renewal`, `landlord_contract_initiated_init`, and `landlord_contract_invite_cancel` routes. Write requests accept `session_token` only; no raw `line_user_id` is used as write authority.

- [ ] **Step 1: Add failing dispatcher and session-auth tests.**

  Extend the runtime harness to load the dispatcher and assert:

  ```js
  assert.equal(api.landlordInitiatedContractIsRequest_({ action: 'landlord_contract_initiate_new' }), true);
  assert.equal(api.landlordInitiatedContractIsRequest_({ action: 'landlord_contract_initiate_renewal' }), true);
  assert.equal(api.landlordInitiatedContractHandlePost_({ action: 'landlord_contract_initiate_new', session_token: 'invalid' }).code, 'LANDLORD_REVIEW_SESSION_INVALID');
  ```

- [ ] **Step 2: Run the test and verify RED.**

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  ```

  Expected: fail because the new request detector/handler and dispatcher branches do not exist.

- [ ] **Step 3: Implement the route handlers.**

  Add to `V2_LANDLORD_INITIATED_CONTRACTS.js`:

  ```js
  function landlordInitiatedContractIsRequest_(request) { /* exact action allow-list */ }
  function landlordInitiatedContractHandlePost_(body) { /* parse, verify session, dispatch, JSON-safe result */ }
  ```

  Add `doPost` branches before the legacy webhook fallback and add `doGet` compatibility responses that fail closed with `LANDLORD_INITIATED_CONTRACT_POST_REQUIRED` for the mutation routes. Use the existing one-time exchange pattern only for reads that need a JSONP response; never put `session_token` in a URL.

  Add Workspace wrappers in `V2_WORKSPACE_LANDLORD_ACCESS.js` for page bootstrap and cancellation. The wrappers may accept the current LIFF line identity only for server-side session bootstrap/read resolution; the initiation mutation itself must call `tenantContractSigningReviewAccessFromSession_(session_token, 'contract_write')`.

- [ ] **Step 4: Run focused runtime tests and existing landlord review tests.**

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  node tests/phase138-native-contract-signing-review.runtime.test.mjs
  node tests/phase140-landlord-contract-signing-review-session.runtime.test.mjs
  ```

  Expected: all PASS; forged session, missing session, cross-Workspace session, and raw URL mutation attempts remain denied.

- [ ] **Step 5: Commit the route slice.**

  ```bash
  git add apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js apps-script/程式碼.js tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  git commit -m "feat: expose authenticated landlord contract initiation routes"
  ```

---

### Task 3: Add LINE invite authentication for an unbound new tenant

**Files:**
- Modify: `apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js`
- Modify: `apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js`
- Modify: `apps-script/程式碼.js`
- Modify: `tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs`

**Interfaces:**
- Consumes `landlordInitiatedContractInviteClaim_` and returns the same server-derived signing contract shape used by `tenant-contract.html`.
- Produces `tenant_contract_invite_auth_init`, `tenant_contract_invite_auth_status`, and `tenant_contract_invite_submit` handling. Existing bound-tenant `tenant_contract_auth_init` remains unchanged for renewal.

- [ ] **Step 1: Write failing tests for invite claim and mode separation.**

  Add tests that call the invite auth function with a valid mocked LINE ID token and assert:

  ```js
  const result = api.tenantLiffSigningInviteAuthenticate_('invite-1', '123456', 'id-token', {
    tenant_name: '現場房客', tenant_phone: '0912345678', tenant_email: ''
  });
  assert.equal(result.success, true);
  assert.equal(result.data.contract.signing_mode, 'new_tenant');
  assert.deepEqual([...result.data.artifact_requirements], ['identity_front', 'identity_back', 'signature']);
  assert.equal(api.tenantLiffSigningInviteAuthenticate_('invite-1', '123456', 'id-token', {}).code, 'INVITE_ALREADY_CLAIMED');
  ```

  Also assert a renewal contract authenticated through the normal tenant session returns only `['signature']`, while a browser-supplied `signing_mode: 'new_tenant'` is ignored.

- [ ] **Step 2: Run the test and verify RED.**

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  ```

  Expected: fail because invite authentication and its session claims do not exist.

- [ ] **Step 3: Implement invite auth and invite-session ownership.**

  Add invite-specific constants and helpers to `V2_TENANT_LIFF_SIGNING_SESSION.js`. Verify LINE ID tokens using the existing channel property, call `landlordInitiatedContractInviteClaim_` to resolve the invite and confirmation-code digest inside a lock, record `claimed_line_user_id`, and create a short-lived HMAC session whose claims contain only the server-derived `invite_id`, `contract_id`, `tenant_id`, `workspace_id`, `line_sub`, `signing_mode`, and expiry. Do not create an active tenant mapping at claim time.

  Extend the submission schema/ownership path so `tenant_contract_invite_submit` accepts only the invite session and reuses the existing stored artifact checks. It must set `tenant_signing_submission_status = submitted`, preserve `contract_status`, and reject mismatched contract, tenant, Workspace, or mode claims.

  Add POST handlers and GET exchange status handlers in `程式碼.js`; responses must use the existing HMAC poll-secret exchange pattern and must not echo ID tokens or confirmation codes.

- [ ] **Step 4: Run invite, signing, and regression tests.**

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  node tests/phase132-tenant-contract-signing-submission.runtime.test.mjs
  node tests/phase133-tenant-contract-signing-ui.test.mjs
  node tests/phase154-contract-complete.runtime.test.mjs
  ```

  Expected: all PASS; signature alone cannot activate a contract and renewal still has no identity-upload requirement.

- [ ] **Step 5: Commit the invite-auth slice.**

  ```bash
  git add apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js apps-script/程式碼.js tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  git commit -m "feat: add one-time LINE invite signing session"
  ```

---

### Task 4: Finalize approval for new tenant and renewal without overwriting history

**Files:**
- Modify: `apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js`
- Modify: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`
- Modify: `tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs`

**Interfaces:**
- Consumes the existing serialized `updateLandlordContractSigningReviewBySessionToken_` decision path and `landlordInitiatedContractFinalizeApproval_`.
- Produces active binding/room/view updates only after approval, with renewal predecessor linkage and idempotent final decisions.

- [ ] **Step 1: Write failing approval-finalization tests.**

  Assert both modes:

  ```js
  const approvedNew = api.updateLandlordContractSigningReviewBySessionToken_('review-session', 'new-contract', 'approve', 'ok');
  assert.equal(approvedNew.success, true);
  assert.equal(sheets.V2_contracts.rows[newIndex][statusColumn], 'active');
  assert.equal(sheets.V2_rooms.rows[0][roomStatusColumn], 'occupied');
  assert.equal(sheets.V2_tenants.rows[provisionalIndex][accountStatusColumn], 'active');

  const approvedRenewal = api.updateLandlordContractSigningReviewBySessionToken_('review-session', 'renewal-contract', 'approve', 'ok');
  assert.equal(sheets.V2_contracts.rows[oldIndex][contractStatusColumn], 'renewed');
  assert.equal(sheets.V2_contracts.rows[renewalIndex][previousIdColumn], 'old-contract');
  assert.equal(sheets.V2_rooms.rows[0][currentContractColumn], 'renewal-contract');
  ```

  Add assertions that missing tenant data, missing artifacts, cross-Workspace predecessor, occupied-room conflict, repeated same decision, and opposite final decision all fail closed.

- [ ] **Step 2: Run the test and verify RED.**

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  ```

  Expected: approval changes only `contract_status` today and does not finalize the provisional tenant or renewal predecessor.

- [ ] **Step 3: Implement mode-specific finalization inside the existing lock.**

  In `updateLandlordContractSigningReviewBySessionToken_`, retain the current decision/idempotency/artifact checks, then call `landlordInitiatedContractFinalizeApproval_` before returning success. New-tenant finalization must validate claimed invite, required tenant fields and exact Workspace, then activate the provisional user/tenant, update tenant views and room pointers, and leave old data untouched. Renewal finalization must re-read the predecessor, set predecessor `renewed`, set `renewed_to_contract_id`, point the room/current contract to the new active row, and never create a second tenant identity. Rejection must not alter the old active contract or room state.

  Add explicit required headers to the local schema contract; if a required finalization header is absent return `CONTRACT_FINALIZATION_SCHEMA_NOT_READY` without partial writes. Use row updates only after all validations have passed.

- [ ] **Step 4: Run the focused approval and full contract regression tests.**

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  node tests/phase138-native-contract-signing-review.runtime.test.mjs
  node tests/phase154-contract-complete.runtime.test.mjs
  node tests/phase156-mobile-contract-reporting-regression.test.mjs
  ```

  Expected: PASS; tenant signature remains non-activating until landlord approval, and legacy/renewal read models remain intact.

- [ ] **Step 5: Commit the finalization slice.**

  ```bash
  git add apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  git commit -m "feat: finalize landlord initiated contracts after approval"
  ```

---

### Task 5: Connect landlord and tenant mobile UI to the new modes

**Files:**
- Modify: `landlord-tenant-create.html`
- Modify: `landlord-contract-requests.html`
- Modify: `tenant-contract.html`
- Create: `tests/phase158-landlord-initiated-contract-flow-ui.test.mjs`

**Interfaces:**
- Consumes the new route envelopes and the server-derived session data from Tasks 2–4.
- Produces mobile UI with no token in storage, a QR/link/confirmation-code result for landlords, and conditional new-tenant vs renewal fields for tenants.

- [ ] **Step 1: Write failing static UI tests.**

  Assert the pages contain these exact behavioral markers:

  ```js
  assert.match(landlordCreate, /landlord_contract_initiated_init/);
  assert.match(landlordCreate, /landlord_contract_initiate_new/);
  assert.match(landlordCreate, /確認碼/);
  assert.match(landlordCreate, /QRCode|qr-code|QR/);
  assert.doesNotMatch(landlordCreate, /localStorage|sessionStorage/);
  assert.match(landlordRequests, /待房客開啟|待簽署|待房東核准/);
  assert.match(tenantPage, /tenant_contract_invite_auth_init/);
  assert.match(tenantPage, /invite_id/);
  assert.match(tenantPage, /TENANT_SIGNING_MODE === 'renewal'/);
  assert.doesNotMatch(tenantSigningRender, /identity_front[\s\S]*?TENANT_SIGNING_MODE === 'renewal'/);
  ```

  Preserve the existing fixed shell markers: `html, body` overflow hidden, `.app-shell`, `.page`, `.bottom-nav`, safe-area padding and the current LIFF/API constants.

- [ ] **Step 2: Run the test and verify RED.**

  ```bash
  node tests/phase158-landlord-initiated-contract-flow-ui.test.mjs
  ```

  Expected: fail because the landlord invite actions and tenant invite-auth markers are not present.

- [ ] **Step 3: Implement landlord UI.**

  Replace the normal direct-create submit in `landlord-tenant-create.html` with `landlord_contract_initiate_new` through the authenticated landlord session. Keep the existing room/property/rent/date validation, add optional tenant prefill, and render the returned `invite.url`, QR image generated from the non-secret URL, confirmation code, expiry and status. Add a renewal entry point in the contract-request page that sends only the selected active contract ID and edited terms. Add cancel/reissue controls using the authenticated route, not a raw line UID write.

- [ ] **Step 4: Implement tenant UI.**

  In `tenant-contract.html`, read only `invite_id` from the query string. When present, initialize `tenant_contract_invite_auth_init`, collect confirmation code and new-tenant basic data, then render the same full contract document and artifact upload/signature workflow. When absent, preserve existing bound-tenant auth for renewal. Display identity upload controls only when `TENANT_SIGNING_MODE === 'new_tenant'`; for renewal display the predecessor comparison and signature only. Do not persist sessions or artifacts to browser storage.

- [ ] **Step 5: Run UI and existing visual/static regressions.**

  ```bash
  node tests/phase158-landlord-initiated-contract-flow-ui.test.mjs
  node tests/phase133-tenant-contract-signing-ui.test.mjs
  node tests/phase155-contract-complete-ui.test.mjs
  node tests/phase156-mobile-contract-reporting-regression.test.mjs
  ```

  Expected: all PASS with the existing mobile shell and full contract content preserved.

- [ ] **Step 6: Commit the UI slice.**

  ```bash
  git add landlord-tenant-create.html landlord-contract-requests.html tenant-contract.html tests/phase158-landlord-initiated-contract-flow-ui.test.mjs
  git commit -m "feat: connect landlord initiated contract mobile flows"
  ```

---

### Task 6: Update route documentation and perform release-gate verification

**Files:**
- Modify: `docs/04-API-ROUTES.md`
- Modify: `docs/CMWEBS_CHANGELOG.md`
- Modify: `tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs`
- Modify: `tests/phase158-landlord-initiated-contract-flow-ui.test.mjs`

**Interfaces:**
- Documents the exact route names, transport, authority, fail-closed errors, and local-only release boundary.
- No new Production or external account action is allowed in this task.

- [ ] **Step 1: Add failing documentation assertions.**

  Extend the two test files to read `docs/04-API-ROUTES.md` and assert each route is listed once:

  ```js
  for (const route of [
    'landlord_contract_initiated_init', 'landlord_contract_initiate_new',
    'landlord_contract_initiate_renewal', 'landlord_contract_invite_cancel',
    'tenant_contract_invite_auth_init', 'tenant_contract_invite_auth_status',
    'tenant_contract_invite_submit'
  ]) assert.equal((routeDoc.match(new RegExp('`' + route + '`', 'g')) || []).length, 1);
  ```

- [ ] **Step 2: Run the test and verify RED.**

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  ```

  Expected: fail because the new routes are not in the route inventory.

- [ ] **Step 3: Update route and changelog documentation.**

  Add the new route table entries with POST/JSONP transport, session authority, no-secret URL rule, and explicit fail-closed codes. Add a changelog entry stating the branch/commit is a local V2.1 candidate only; do not write serving versions, credentials, user data, or claims of Production deployment.

- [ ] **Step 4: Run all affected tests and syntax verification.**

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  node tests/phase158-landlord-initiated-contract-flow-ui.test.mjs
  node tests/phase129-legacy-signed-contract-sync.test.mjs
  node tests/phase130-verified-liff-signing-session.test.mjs
  node tests/phase130-verified-liff-signing-session.runtime.test.mjs
  node tests/phase131-contract-artifact-storage.runtime.test.mjs
  node tests/phase132-tenant-contract-signing-submission.runtime.test.mjs
  node tests/phase133-tenant-contract-signing-ui.test.mjs
  node tests/phase138-native-contract-signing-review.runtime.test.mjs
  node tests/phase140-landlord-contract-signing-review-session.runtime.test.mjs
  node tests/phase154-contract-complete.runtime.test.mjs
  node tests/phase155-contract-complete-ui.test.mjs
  node tests/phase156-mobile-contract-reporting-regression.test.mjs
  git diff --check
  for file in apps-script/*.js; do node --check "$file"; done
  ```

  Expected: all Node tests, syntax checks, and diff checks PASS. `npm run validate` must be attempted once; this checkout is known to have no `package.json`, so an `ENOENT` result is reported as unavailable rather than converted into a false pass.

- [ ] **Step 5: Review final diff and commit documentation.**

  ```bash
  git diff --stat origin/main...HEAD
  git status --short --branch
  git add docs/04-API-ROUTES.md docs/CMWEBS_CHANGELOG.md tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs tests/phase158-landlord-initiated-contract-flow-ui.test.mjs
  git commit -m "docs: record landlord initiated contract routes"
  ```

  Final report must include exact branch/HEAD, test counts, `npm run validate` availability, schema scope, deployment status (`NOT_DEPLOYED`), and rollback reference (`HUMAN_REQUIRED` unless freshly verified). Do not push, merge, deploy, or touch Production as part of this plan.
