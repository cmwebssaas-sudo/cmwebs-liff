# Paper Contract Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增房東可用的手動補登紙本合約流程，讓紙本已簽的新房客或既有房客直接建立有效／即將生效租約，保存私有紙本文件，不產生電子簽署邀請或 LINE 訊息。

**Architecture:** 新增責任單一的 `V2_LANDLORD_PAPER_CONTRACT_BACKFILL.js`，以既有房東 review session、Workspace 權限、`V2_contracts` canonical row、`V2_contract_documents` 私有附件表與既有 view writer 為基礎。一次 POST action 在 ScriptLock 內重讀 scope、驗證所有輸入、保存紙本文件，再建立房客／租約／房間指向；既有線上新租與續約狀態機保持不變。前端在既有房客詳細頁與物件房間入口提供 `paper_backfill` 模式，使用同一個表單元件但不顯示邀請或簽署步驟。

**Tech Stack:** Google Apps Script、Google Sheets、Google Drive private files、LINE LIFF JSONP/POST bridge、靜態 HTML、Node.js built-in `assert`／`vm` runtime tests。

**Spec:** `docs/superpowers/specs/2026-09-03-paper-contract-backfill-design.md`

## Global Constraints

- 使用既有 Workspace `contract_write` landlord session，body 中的 `workspace_id`、`landlord_id`、`tenant_id`、`room_id` 不作為授權來源。
- 紙本合約 PDF／JPG／PNG 必填；身分證正反面選填；補登直接有效／即將生效；不建立 `V2_contract_requests`、不邀請、不簽署、不發 LINE。
- `V2_contracts`、`V2_tenants`、`V2_users`、房間 pointer、view 與文件索引均維持 Workspace scope；既有合約、帳單與付款不覆寫。
- 新增 route 必須同步更新 `docs/04-API-ROUTES.md`、測試與 `docs/09-TEST-MATRIX.md`；如需欄位只做 additive-only guard。
- 不取得巢狀 ScriptLock；不提交任何 secret、Drive ID、LINE UID token、個資或 Production 資料。
- 所有程式先有會失敗的測試；每個 RED 都要先執行並確認是功能缺少，再寫最小實作。
- 本分支只產生 local candidate；不執行 Apps Script deploy、GitHub Pages publish、Sheet migration、LINE 或真實交易。

---

### Task 1: 建立後端補登 API 的 failing runtime tests

**Files:**
- Create: `tests/phase209-paper-contract-backfill.runtime.test.mjs`
- Read: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`
- Read: `apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js`
- Read: `apps-script/V2_TENANT_LEASE_ONBOARDING.js`

**Interfaces:**
- Test the planned production interfaces `landlordPaperContractBackfillValidateInput_`, `landlordPaperContractBackfillBySession_`, and `landlordPaperContractBackfillHandlePost_`.
- Test result envelopes use `{ success, code, data }`; successful data exposes `contract`, `tenant`, `room`, and `paper_document` summaries without Base64 or Drive ID.

- [ ] **Step 1: Write the failing test for a new paper tenant.**

  Build a small VM fixture with `V2_properties`, `V2_rooms`, `V2_users`, `V2_tenants`, `V2_contracts`, `V2_contract_documents`, and landlord view sheets. The fixture must provide a room `R202`, a landlord access object for `W1`, a PDF Base64 payload, and stubs for the existing session/schema/row helpers. Assert that `landlordPaperContractBackfillBySession_('session-1', input)` returns an active contract, sets `signing_mode` and `contract_origin` to `paper_backfill`, appends one tenant, one user, one contract, one private document, and points room 202 to that contract.

  The test must also assert `V2_contract_invites` remains absent or row-count zero and `sendLineMessage`/notification stubs are never called.

- [ ] **Step 2: Add failing validation and idempotency cases.**

  Add assertions for missing `paper_contract_file`, invalid MIME, invalid Base64, file larger than 8 MB, invalid date, room already occupied, overlapping contract, cross-Workspace room, duplicate active tenant phone, and missing `idempotency_key`. For the same valid request, assert the second call returns `IDEMPOTENT` with no additional rows or document; for the same key and a changed rent, assert `IDEMPOTENCY_CONFLICT`.

- [ ] **Step 3: Add the existing-tenant and optional-ID cases.**

  Seed an existing tenant in `W1` and assert the backfill reuses the same `tenant_id`/`tenant_user_id`, appends one contract and paper document, and does not append a second tenant. Run a request without identity files and assert success; run another with `identity_front` and `identity_back` payloads and assert two optional documents are indexed against the created contract.

- [ ] **Step 4: Run the focused test to prove RED.**

  Run:

  ```bash
  node tests/phase209-paper-contract-backfill.runtime.test.mjs
  ```

  Expected result: FAIL because the new backfill functions do not exist yet. If the test errors during fixture setup instead of failing on the missing behavior, fix only the test harness and repeat until the failure identifies the missing production interface.

### Task 2: Implement the atomic paper-backfill backend

**Files:**
- Create: `apps-script/V2_LANDLORD_PAPER_CONTRACT_BACKFILL.js`
- Modify: `apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js`
- Modify: `apps-script/程式碼.js`
- Test: `tests/phase209-paper-contract-backfill.runtime.test.mjs`

**Interfaces:**
- Produce `landlordPaperContractBackfillIsRequest_(rawBody)`, `landlordPaperContractBackfillHandlePost_(request)`, `landlordPaperContractBackfillValidateInput_(input)`, and `landlordPaperContractBackfillBySession_(sessionToken, input)`.
- Add a lock-aware document primitive `storeLandlordContractDocumentForAccess_(access, documentInput, options)` that writes a private `V2_contract_documents` row without acquiring a second ScriptLock; the existing standalone upload route continues to use its current lock-protected path.

- [ ] **Step 1: Add pure input normalization and validation.**

  Normalize Taiwan phones using the existing landlord helper, normalize ISO dates to `YYYY-MM-DD`, parse non-negative money, and validate the inclusive date range. Require a paper file with `application/pdf`, `image/jpeg`, or `image/png`, decode Base64, and reject empty or over-8MB bytes with explicit codes. Treat identity files as optional but apply the same file validation when present. Return normalized input only; do not access Sheets or Drive from this helper.

- [ ] **Step 2: Add session route handling and Workspace access.**

  Parse only JSON POST bodies with `v2_action`/`action` equal to `landlord_contract_paper_backfill`. Resolve `request.session_token` through `landlordInitiatedContractAccessFromSession_(sessionToken, 'contract_write')`; reject invalid sessions before reading client-supplied scope. Accept `request.input` as the payload when it is an object, otherwise accept the request body.

- [ ] **Step 3: Re-read canonical rows and reject conflicts inside the existing contract lock.**

  Use `landlordInitiatedContractWithScriptLock_` and `landlordInitiatedContractSchema_` to re-read the selected room, property, tenants, contracts, and users. Verify room/property Workspace ownership, reject archived/occupied rooms, reject any active/upcoming/open contract whose date range overlaps, and check the normalized idempotency key against a backfill contract/document marker. Existing-tenant mode must verify that the supplied tenant belongs to the same Workspace and room scope; new-tenant mode must reject an active duplicate phone.

- [ ] **Step 4: Add the lock-aware private document writer.**

  Refactor only the reusable part of `V2_LANDLORD_CONTRACT_DOCUMENTS.js` so it accepts already-validated bytes, creates a private Drive file, appends `document_type=legacy_contract`, `document_origin=paper_backfill`, Workspace/landlord/tenant/contract IDs, SHA-256, MIME, byte size, and an idempotency key. Add identity files only when supplied. The helper must return a document summary without Base64 or Drive ID in the API response. On a later Sheet write failure, trash newly created Drive files when that operation is safe and record a failure result; never report a successful active lease with a missing document.

- [ ] **Step 5: Create or reuse canonical tenant data and append the paper contract.**

  For a new tenant, create a tenant user with blank LINE identity, `role=tenant`, `status=active`, and the existing unbound landlord-created tenant shape. For an existing tenant, reuse its IDs and update only the provided profile fields. Append a complete `V2_contracts` snapshot with `contract_status=active` when the start date is on/before Taiwan today and the end date is not past, otherwise the existing supported upcoming status; use `signed_at` for the paper signed date, `tenant_signing_submission_status=approved`, blank `invite_id`, blank `tenant_signed_at`, and no electronic artifact fields. Set `signing_mode=paper_backfill` and `contract_origin=paper_backfill`.

- [ ] **Step 6: Update room and view pointers after canonical rows exist.**

  Update `V2_rooms.current_contract_id`, `current_tenant_id`, `current_tenant_name`, and the existing room occupancy/account fields according to the contract status. Upsert the landlord tenant list and tenant home view with the new contract pointer. Do not create a bill or alter existing bills/payments. Return IDs and statuses only.

- [ ] **Step 7: Run the focused test to reach GREEN.**

  Run:

  ```bash
  node tests/phase209-paper-contract-backfill.runtime.test.mjs
  ```

  Expected result: all Phase 209 runtime assertions pass. If a test fails, fix the implementation while preserving the test and rerun the focused test before moving to UI work.

### Task 3: Add visible landlord entry points and paper-backfill form

**Files:**
- Modify: `landlord-tenant-create.html`
- Modify: `landlord-tenant-detail.html`
- Modify: `landlord-properties.html`
- Modify: `landlord-tenants.html`
- Create: `tests/phase210-paper-contract-backfill.ui.test.mjs`

**Interfaces:**
- The pages navigate to `landlord-tenant-create.html?mode=paper_backfill` and pass only non-authoritative UI context such as `room_id` or `tenant_id`; the server session determines ownership.
- The form submits the `landlord_contract_paper_backfill` POST action with `session_token`, `input`, paper file metadata/Base64, optional identity file metadata/Base64, and a generated idempotency key.

- [ ] **Step 1: Write failing UI tests for both entrances and copy.**

  Assert the room management page and tenant detail page contain the visible text `手動補登紙本合約` and the `mode=paper_backfill` navigation. Assert the create page contains `landlord_contract_paper_backfill`, a required paper contract file input, optional identity-file labels, and no QR/invite/confirmation-code copy inside the paper-backfill branch. Assert the normal `simple_new` branch still contains `landlord_contract_initiate_new` and its existing invite copy.

- [ ] **Step 2: Run the UI test to prove RED.**

  Run:

  ```bash
  node tests/phase210-paper-contract-backfill.ui.test.mjs
  ```

  Expected result: FAIL because the entry markers and form mode do not exist yet.

- [ ] **Step 3: Add the paper-backfill mode to the existing create page.**

  Keep the current mobile shell and bottom navigation. Render the selected room/tenant context, tenant fields, lease dates, rent/deposit, existing fee fields, paper signed date, required paper-file picker, optional identity pickers, note, and one `確認補登紙本合約` button. Preserve existing simple-new and renewal rendering unchanged outside the mode branch.

- [ ] **Step 4: Add file encoding and single-submit behavior.**

  Read files as Base64 in the browser, enforce the existing 8MB limit before POST, show selected file names and upload progress, disable the button during the request, and never persist file contents or session tokens to localStorage. On success show the created contract status and paper-document saved state; on failure keep the form values and show the server code/message.

- [ ] **Step 5: Add room and tenant-detail navigation.**

  Add the room-level button for an empty/new occupant path and the tenant-detail button for an existing tenant path. Pass `room_id`, `tenant_id`, and `property_id` only as display/selection context. Do not replace the existing `查看房客資料`, renewal, checkout, or document-history actions.

- [ ] **Step 6: Run the UI test to reach GREEN.**

  Run:

  ```bash
  node tests/phase210-paper-contract-backfill.ui.test.mjs
  ```

  Expected result: all entry, field, required/optional, and branch-isolation assertions pass.

### Task 4: Document the API and regression boundary

**Files:**
- Modify: `docs/04-API-ROUTES.md`
- Modify: `docs/09-TEST-MATRIX.md`
- Modify: `docs/CMWEBS_CHANGELOG.md`
- Modify: `docs/CMWEBS_CURRENT_STATE.md`
- Modify: `docs/CMWEBS_V2_1_CODEX_EXECUTION_RECORD.md`
- Test: `tests/phase211-paper-contract-backfill.docs.test.mjs`

**Interfaces:**
- Documentation identifies `landlord_contract_paper_backfill` as POST-only, session/Workspace `contract_write` protected, direct-effective, paper-file-required, and no-LINE.
- The test matrix records Phase 209/210/211 as local candidate evidence and keeps authenticated mobile/Drive/Production state `HUMAN_REQUIRED` until separately verified.

- [ ] **Step 1: Write the failing documentation test.**

  Assert the API route table contains the new action and exact no-invite/no-LINE boundary, the test matrix contains Phase 209, and the changelog/current-state candidate sections contain the paper-file-required and optional-ID rules.

- [ ] **Step 2: Run the documentation test to prove RED.**

  Run:

  ```bash
  node tests/phase211-paper-contract-backfill.docs.test.mjs
  ```

  Expected result: FAIL because the new route and Phase 209 documentation are absent.

- [ ] **Step 3: Update API, test matrix, and current-state records.**

  Add only the new route and candidate evidence. Record that the implementation is local-only, no migration/deployment/data/LINE action occurred, and rollback for a future release is the current Apps Script immutable version plus current GitHub Pages revision. Do not claim mobile or authenticated Production acceptance.

- [ ] **Step 4: Run the documentation test to reach GREEN.**

  Run:

  ```bash
  node tests/phase211-paper-contract-backfill.docs.test.mjs
  ```

  Expected result: all route/documentation assertions pass.

### Task 5: Full candidate verification and commit

**Files:**
- Modify only files listed in Tasks 1–4.
- Test: all `tests/*.test.mjs`

**Interfaces:**
- The candidate must expose the route in the dispatcher, pass the exact route/handler validator, and retain all existing contract/checkout/renewal behavior.

- [ ] **Step 1: Run focused runtime, UI, and docs tests together.**

  Run:

  ```bash
  node tests/phase209-paper-contract-backfill.runtime.test.mjs
  node tests/phase210-paper-contract-backfill.ui.test.mjs
  node tests/phase211-paper-contract-backfill.docs.test.mjs
  ```

  Expected result: all three commands exit 0.

- [ ] **Step 2: Run full Node tests and project validation.**

  Run the repository's available validation command and the authoritative validator with the candidate's actual route count:

  ```bash
  npm run validate
  node scripts/validate-project.js --root . --apps-dir apps-script --html-dir . --expected-routes 84
  ```

  If `npm run validate` is unavailable in this isolated main-based worktree, record that exact evidence and continue with the direct validator; do not substitute a guessed result.

- [ ] **Step 3: Run syntax, diff, and secret checks.**

  Run:

  ```bash
  for file in apps-script/*.js; do node --check "$file"; done
  git diff --check
  git status --short --branch
  ```

  Confirm no duplicate top-level declarations, no credentials, no hardcoded LINE UID, no Base64/file content in docs, and no changes outside the feature files.

- [ ] **Step 4: Review requirements against the spec.**

  Re-read the approved spec and verify: paper file required; IDs optional; direct effective/upcoming status; existing tenant identity reuse; no requests/invites/LINE; overlap and Workspace protection; append-only historical behavior; private document binding; idempotency; no bills/payments mutation; room and tenant views updated.

- [ ] **Step 5: Commit the local candidate.**

  ```bash
  git add apps-script/V2_LANDLORD_PAPER_CONTRACT_BACKFILL.js apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js apps-script/程式碼.js landlord-tenant-create.html landlord-tenant-detail.html landlord-properties.html landlord-tenants.html tests/phase209-paper-contract-backfill.runtime.test.mjs tests/phase210-paper-contract-backfill.ui.test.mjs tests/phase211-paper-contract-backfill.docs.test.mjs docs/04-API-ROUTES.md docs/09-TEST-MATRIX.md docs/CMWEBS_CHANGELOG.md docs/CMWEBS_CURRENT_STATE.md docs/CMWEBS_V2_1_CODEX_EXECUTION_RECORD.md docs/superpowers/specs/2026-09-03-paper-contract-backfill-design.md docs/superpowers/plans/2026-09-03-paper-contract-backfill.md
  git commit -m "feat: add paper contract backfill flow"
  ```

  Report the commit, test counts, validator result, changed files, known risks, deployment steps, rollback target, and the separate authorization still required for Production release.
