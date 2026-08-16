# 房東發起合約邀請回查與重新產生 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓房東在離開建立頁後，仍能在合約申請管理找回 202 等房東發起合約的 QR／邀請連結，並可在確認碼遺失時安全重新產生邀請。

**Architecture:** Apps Script 以既有房東 signing-review session、Workspace read/contract_write policy 與 ScriptLock 保護回查及重發；清單只回傳非敏感邀請資訊，重發只在成功回應中回傳新確認碼。GitHub Pages 的合約申請管理頁保留現有入口，將查詢錯誤與空清單分開呈現，並以同頁 modal 顯示 QR、連結及一次性確認碼。房東首頁沿用既有 bootstrap，在後端提供房東發起待處理數，避免前端自行猜測資料。

**Tech Stack:** Google Apps Script `.js`、Google Sheets schema、GitHub Pages 靜態 HTML/JavaScript、Node.js ESM runtime/UI tests。

## Global Constraints

- 使用隔離分支 `/private/tmp/cmwebs-landlord-initiated-contract-flow-20260816`，不得修改 root dirty worktree。
- 不新增 `*_FIXED.*`、`*_WITH_SETTINGS.*`、`complete-*`、`final-*` 或 `new-*` 版本式檔名。
- `workspace_id` 是資料隔離主鍵；所有房東讀寫都必須重新驗證 Workspace、角色與 policy。
- 確認碼只存 SHA-256 digest；既有確認碼不可回查，只有重發成功回應可回傳新明文確認碼。
- 使用既有 Apps Script Web App URL、既有 signing-review session 與 JSONP one-time exchange，不在 URL 放 session token 或確認碼。
- 房東發起合約資料缺少、授權失敗、route/schema/exchange 失敗時，前端不得把錯誤轉成「0 筆」。
- 每個修改階段都要跑受影響測試、`git diff --check`、`node --check` 與專案 validator；Production 只做已授權部署與唯讀驗證。

---

## File Map

- Modify: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js` — 抽出 Workspace-scoped 清單、修正 current invite join、加入 session-protected invite reissue action。
- Modify: `apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js` — 將房東發起待處理資料接入首頁 bootstrap。
- Modify: `apps-script/程式碼.js` — 將新增 POST action 納入 route dispatcher 的 POST-only gate。
- Modify: `landlord-contract-requests.html` — 明確顯示查詢錯誤、清單操作、QR/link modal、複製與重發流程。
- Modify: `landlord-home.html` — 顯示後端回傳的房東發起待處理數。
- Modify: `docs/04-API-ROUTES.md` — 更新 `landlord_contract_invite_reissue` route 與候選 route 說明。
- Create: `tests/phase163-landlord-contract-invite-retrieval.runtime.test.mjs` — 清單、Workspace scope、current invite join、重發與安全性 runtime tests。
- Modify: `tests/phase159-landlord-initiated-contract-flow.ui.test.mjs` — 驗證回查錯誤、QR/link modal、複製及重發 UI markers。
- Create: `tests/phase164-landlord-contract-invite-retrieval.home.test.mjs` — 驗證首頁使用 `landlord_initiated_contracts` 後端資料計數，不自行猜測狀態。

### Task 1: Add failing backend retrieval and reissue tests

**Files:**
- Create: `tests/phase163-landlord-contract-invite-retrieval.runtime.test.mjs`
- Read: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`

**Interfaces:**
- Consumes: `landlordInitiatedContractCreateNew_(access, input)` and the existing `Sheet` test-double pattern from `tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs`.
- Produces: executable expectations for `landlordInitiatedContractListBySession_`, `landlordInitiatedContractReissueBySession_`, `landlord_contract_invite_reissue`, and the public response envelope.

- [ ] **Step 1: Build the isolated runtime fixture.**

  Copy the existing phase-157 `Sheet` test double and create one `W1` workspace with a vacant `R202` room, a property, and the required users/tenants/contracts/invites sheets. Load the landlord-initiated Apps Script source in a VM and stub the verified session access as follows:

  ```js
  context.tenantContractSigningReviewAccessFromSession_ = (token, policy) => {
    if (token !== 'review-token') {
      return { success: false, code: 'LANDLORD_REVIEW_SESSION_INVALID', data: null };
    }
    if (policy === 'contract_write' || policy === 'read') {
      return {
        success: true,
        data: {
          workspace: { workspace_id: 'W1' },
          user: { user_id: 'landlord-user', name: '房東甲' },
          membership: { membership_id: 'membership-1', role: 'owner' }
        }
      };
    }
    return { success: false, code: 'WORKSPACE_PERMISSION_DENIED', data: null };
  };
  ```

- [ ] **Step 2: Write the failing list assertions.**

  Create a pending landlord-initiated contract and call `landlordInitiatedContractListBySession_('review-token')`. Assert `success === true`, one item, room `202`, the current invite URL, `invite_status === 'pending'`, and an empty confirmation-code field. Add a second Workspace row and assert it is not returned. Add an old cancelled invite for the same contract and assert the current `contract.invite_id` selects the current pending invite instead of the old row.

- [ ] **Step 3: Write the failing reissue assertions.**

  Call `landlordInitiatedContractReissueBySession_('review-token', oldInviteId)` and assert the response contains a different `invite_id`, a six-digit `confirmation_code`, a new URL, and `status === 'pending'`. Assert the old invite row is `cancelled`, its hash does not contain the new code, the contract points to the new invite ID, and exactly one current invite is pending. Assert the response never includes `claim_code_hash`.

- [ ] **Step 4: Write failure and authorization assertions.**

  Assert an invalid session returns `LANDLORD_REVIEW_SESSION_INVALID`; a claimed invite returns `INVITE_ALREADY_CLAIMED`; a stale invite not equal to the contract’s current `invite_id` returns `INVITE_STALE`; and a second reissue of the cancelled old invite cannot create another active invite.

- [ ] **Step 5: Run the new test to verify it fails.**

  Run:

  ```bash
  node tests/phase163-landlord-contract-invite-retrieval.runtime.test.mjs
  ```

  Expected: FAIL because `landlordInitiatedContractReissueBySession_` and `landlord_contract_invite_reissue` do not exist yet, and the list currently selects the first invite row rather than the contract’s current invite.

### Task 2: Implement Apps Script list, reissue, and routing

**Files:**
- Modify: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`
- Modify: `apps-script/程式碼.js`
- Modify: `apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js`
- Test: `tests/phase163-landlord-contract-invite-retrieval.runtime.test.mjs`

**Interfaces:**
- Consumes: verified `tenantContractSigningReviewAccessFromSession_(sessionToken, policy)`; existing `landlordInitiatedContractWithScriptLock_`; existing invite schema and public invite helpers.
- Produces: `landlordInitiatedContractListByAccess_(access)`, `landlordInitiatedContractListBySession_(sessionToken)`, `landlordInitiatedContractReissueBySession_(sessionToken, inviteId)`, and POST action `landlord_contract_invite_reissue`.

- [ ] **Step 1: Refactor list selection around a Workspace-scoped helper.**

  Add `landlordInitiatedContractListByAccess_(access)` that requires a valid Workspace/user/membership context, loads `landlordInitiatedContractSchema_`, filters only `contract_origin === 'landlord_initiated'` and `contract_status` in `pending_tenant_signature`/`awaiting_tenant_signature`, and joins the invite by both `contract_id` and `contract.invite_id`. If no current invite exists, return the contract with an empty invite status and no URL so the UI can show a data problem rather than an invented link. Keep `landlordInitiatedContractListBySession_` responsible for session validation and delegate its successful `access.data.workspace.workspace_id` to the helper.

- [ ] **Step 2: Correct the public contract invite projection.**

  Extend `landlordInitiatedContractPublicContract_(contract, tenant, invite)` so `invite_status` and `invite_expires_at` come from the matched invite, while `invite_id` and `invite_url` remain derived from the current contract/invite ID. Update the existing create/list call sites to pass the invite explicitly. Never include `claim_code_hash` or `confirmation_code` in this projection.

- [ ] **Step 3: Implement the locked reissue operation.**

  Add:

  ```js
  function landlordInitiatedContractReissueBySession_(sessionToken, inviteId) {
    return landlordInitiatedContractWithScriptLock_(function () {
      const access = tenantContractSigningReviewAccessFromSession_(sessionToken, 'contract_write');
      if (!access || access.success !== true) return access;
      return landlordInitiatedContractReissueByAccessUnlocked_(access.data, inviteId);
    });
  }
  ```

  In the unlocked helper, scope the invite and contract to `access.data.workspace.workspace_id`, require `contract_origin === 'landlord_initiated'`, require the supplied invite to equal `contract.invite_id`, reject `claimed`/`completed` invites, mark the old invite `cancelled`, create a new UUID/6-digit code/digest/24-hour expiry, append the new invite, update the contract’s `invite_id` and `updated_at`, and return `landlordInitiatedContractPublicInvite_(newInvite, confirmationCode)` plus the public contract. Use the existing ScriptLock for serialization and preserve all contract, room, tenant, and billing fields.

- [ ] **Step 4: Add the POST-only action to all dispatch lists.**

  Add `landlord_contract_invite_reissue` to `landlordInitiatedContractIsRequest_`, route it in `landlordInitiatedContractHandlePostDirect_`, and add it to `程式碼.js`’s JSONP rejection list so a direct `v2_action` call returns `LANDLORD_INITIATED_CONTRACT_POST_REQUIRED` instead of bypassing the session exchange.

- [ ] **Step 5: Add the home bootstrap projection.**

  In `getWorkspaceLandlordHomeBootstrapByLineUid_`, call `landlordInitiatedContractListByAccess_(access)` after the existing Workspace read proxy has authenticated the landlord, and attach its data as `landlord_initiated_contracts`. Do not fail the entire homepage when the optional invite schema is unavailable; return an empty data envelope plus `landlord_initiated_contracts_error` so the contract page can still show the specific error after its own verified session flow.

- [ ] **Step 6: Run the backend tests and syntax checks.**

  Run:

  ```bash
  node tests/phase163-landlord-contract-invite-retrieval.runtime.test.mjs
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  node tests/phase158-landlord-initiated-contract-activation.runtime.test.mjs
  node tests/phase162-landlord-initiated-contract-pricing-and-schema.test.mjs
  node --check apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js
  node --check apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js
  node --check apps-script/程式碼.js
  ```

  Expected: all runtime tests PASS and the new reissue test proves the old invite cannot remain the current active invite.

- [ ] **Step 7: Commit the backend slice.**

  ```bash
  git add apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js apps-script/程式碼.js tests/phase163-landlord-contract-invite-retrieval.runtime.test.mjs
  git commit -m "feat: support landlord contract invite retrieval"
  ```

### Task 3: Add failing frontend and homepage contract-count tests

**Files:**
- Modify: `tests/phase159-landlord-initiated-contract-flow.ui.test.mjs`
- Create: `tests/phase164-landlord-contract-invite-retrieval.home.test.mjs`
- Read: `landlord-contract-requests.html`, `landlord-home.html`

**Interfaces:**
- Consumes: backend action strings and response fields from Task 2.
- Produces: static acceptance checks for visible recovery controls and backend-driven homepage count.

- [ ] **Step 1: Extend the existing UI test with required markers.**

  Add assertions for `landlord_contract_invite_reissue`, `landlord_contract_initiated_contracts_error` or its equivalent error state, `查看 QR／邀請連結`, `重新產生邀請`, `navigator.clipboard`, `quickchart.io/qr`, and the explicit “確認碼不會再次顯示” copy.

- [ ] **Step 2: Add the homepage count test.**

  Read `landlord-home.html` and assert it consumes `landlord_initiated_contracts`, computes a dedicated pending count from the returned items, includes that count in the contract action count, and renders “房東發起” in the contract-management description. Assert the source does not create the count from a hard-coded room number or from a browser-only `INITIATED_CONTRACTS` list.

- [ ] **Step 3: Run tests to verify the new markers fail.**

  ```bash
  node tests/phase159-landlord-initiated-contract-flow.ui.test.mjs
  node tests/phase164-landlord-contract-invite-retrieval.home.test.mjs
  ```

  Expected: FAIL until the request page and homepage are updated.

### Task 4: Implement QR/link retrieval, copy, reissue modal, and explicit list errors

**Files:**
- Modify: `landlord-contract-requests.html`
- Test: `tests/phase159-landlord-initiated-contract-flow.ui.test.mjs`

**Interfaces:**
- Consumes: `PAGE_DATA.landlord_initiated_contracts`, `PAGE_DATA.landlord_initiated_contracts_error`, `landlord_contract_invite_reissue` response `{ data: { contract, invite } }`.
- Produces: same-page `inviteModal`, `openLandlordInviteModal(contractId)`, `copyActiveInviteLink()`, and `reissueLandlordInvite(inviteId)` functions usable from each pending contract card.

- [ ] **Step 1: Add modal state and markup.**

  Add `INITIATED_CONTRACT_ERROR`, `ACTIVE_INVITE_CONTRACT`, and `ACTIVE_INVITE_DATA` state. Add an `inviteModal` inside `.app-shell`, above the bottom nav, with a scrollable modal sheet, QR image area, full link text, copy button, one-time confirmation-code area, reissue button, close button, and an ARIA live status element. Keep `body.modal-open` and safe-area behavior consistent with existing modals.

- [ ] **Step 2: Stop swallowing initiated-list errors.**

  Change the `loadPage()` initiated-contract promise to return `{ items, error }` instead of silently returning `[]` on catch. Store the error in `PAGE_DATA.landlord_initiated_contracts_error`; render a retryable error card inside the “房東發起合約” section. Render the empty state only when the request succeeded and `items.length === 0`.

- [ ] **Step 3: Render retrieval actions per contract.**

  In `renderLandlordInitiatedContractSection()`, retain the current Workspace-scoped pending statuses and add room/date/tenant/invite-status details. Replace the raw invite URL line with a `查看 QR／邀請連結` button. Show `重新產生邀請` only for an unclaimed pending/expired/cancelled invite with a valid current `invite_id`; for claimed invites show “房客已認領，請等待簽署” and do not offer reissue. Keep the existing cancel flow.

- [ ] **Step 4: Implement modal rendering and safe link copy.**

  Add a URL helper that only uses the server-provided `invite_url` and builds the existing QuickChart URL with `encodeURIComponent`. `openLandlordInviteModal(contractId)` must show the QR and link but never fabricate or reveal a confirmation code from the list. `copyActiveInviteLink()` must try `navigator.clipboard.writeText()` and fall back to a selected hidden textarea; update the live status and show an alert on failure.

- [ ] **Step 5: Implement confirmed reissue.**

  `reissueLandlordInvite(inviteId)` must use `showConfirm()` with the exact warning that the old QR/link becomes invalid immediately. On success, replace the in-memory contract invite fields, show the modal with the new QR/link and one-time confirmation code, and keep the success modal open until the landlord closes it. On failure, leave the old list data visible and show the server error; never claim that reissue succeeded without the response.

- [ ] **Step 6: Run the frontend tests and source checks.**

  ```bash
  node tests/phase159-landlord-initiated-contract-flow.ui.test.mjs
  node --check <(sed -n '/<script>/,/<\/script>/p' landlord-contract-requests.html | sed '1d;$d')
  git diff --check
  ```

  Expected: UI markers pass; error state, QR/link modal, copy fallback, and reissue warning are present in the source.

- [ ] **Step 7: Commit the request-page slice.**

  ```bash
  git add landlord-contract-requests.html tests/phase159-landlord-initiated-contract-flow.ui.test.mjs
  git commit -m "feat: let landlords recover contract invites"
  ```

### Task 5: Implement backend-driven homepage pending count

**Files:**
- Modify: `landlord-home.html`
- Test: `tests/phase164-landlord-contract-invite-retrieval.home.test.mjs`

**Interfaces:**
- Consumes: `bootstrap.landlord_initiated_contracts.items` returned by Task 2, where each item has `status`, `contract_status`, `invite_status`, and `contract_origin`.
- Produces: `actionSummary.landlordInitiatedPending` and a home contract-management card that includes this count.

- [ ] **Step 1: Add the count helper.**

  Add a small helper adjacent to `buildActionSummary()`:

  ```js
  function countPendingLandlordInitiatedContracts(data) {
    const items = data && Array.isArray(data.items) ? data.items : [];
    return items.filter(function (item) {
      const origin = String(item.contract_origin || '').trim().toLowerCase();
      const status = String(item.contract_status || item.status || '').trim().toLowerCase();
      return origin === 'landlord_initiated' && ['pending', 'pending_tenant_signature', 'awaiting_tenant_signature'].indexOf(status) >= 0;
    }).length;
  }
  ```

  Pass `bootstrap.landlord_initiated_contracts` into `buildActionSummary()` and include the helper result in `contractActionCount`.

- [ ] **Step 2: Render the count without replacing existing counts.**

  Preserve existing `待審` and `待完成` counts and append `房東發起 ${actionSummary.landlordInitiatedPending} 筆` to the description. Use the same contract-management link so the landlord can open the page and retrieve the QR/link.

- [ ] **Step 3: Run homepage and regression tests.**

  ```bash
  node tests/phase164-landlord-contract-invite-retrieval.home.test.mjs
  node tests/phase160-landlord-entry-handoff-and-contract-loading.test.mjs
  git diff --check
  ```

- [ ] **Step 4: Commit the homepage slice.**

  ```bash
  git add landlord-home.html tests/phase164-landlord-contract-invite-retrieval.home.test.mjs
  git commit -m "feat: count landlord initiated contracts on home"
  ```

### Task 6: Update API documentation and run the complete local gate

**Files:**
- Modify: `docs/04-API-ROUTES.md`
- Read: `docs/EXECUTION_RECORD.md`, `docs/00-HANDOFF-INDEX.md`

**Interfaces:**
- Consumes: final route/action names and response/security behavior from Tasks 2–5.
- Produces: repository documentation that matches source and a reproducible local verification record.

- [ ] **Step 1: Update route inventory and candidate route table.**

  Add `landlord_contract_invite_reissue` to the route inventory and table. Document that it is POST-only, requires a landlord review session plus Workspace `contract_write`, invalidates the old unclaimed invite, returns the new QR source URL/link and confirmation code only once, and never returns existing confirmation codes or digests.

- [ ] **Step 2: Run all affected tests.**

  ```bash
  node tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  node tests/phase158-landlord-initiated-contract-activation.runtime.test.mjs
  node tests/phase159-landlord-initiated-contract-flow.ui.test.mjs
  node tests/phase160-landlord-entry-handoff-and-contract-loading.test.mjs
  node tests/phase162-landlord-initiated-contract-pricing-and-schema.test.mjs
  node tests/phase163-landlord-contract-invite-retrieval.runtime.test.mjs
  node tests/phase164-landlord-contract-invite-retrieval.home.test.mjs
  ```

- [ ] **Step 3: Run syntax, project validation, and diff checks.**

  ```bash
  node --check apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js
  node --check apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js
  node --check apps-script/程式碼.js
  node /Users/hans/CMWebs/cmwebs-liff/scripts/validate-project.js --root /private/tmp/cmwebs-landlord-initiated-contract-flow-20260816 --apps-dir apps-script --html-dir . --expected-routes 82
  git diff --check
  git status --short --branch
  ```

  Expected: all tests pass, validator reports no duplicate top-level declarations or missing route registration, and the only changes are the documented feature files.

- [ ] **Step 4: Commit documentation and record deployment handoff.**

  ```bash
  git add docs/04-API-ROUTES.md
  git commit -m "docs: document landlord invite reissue route"
  ```

  Record the exact branch/HEAD, test commands, validator output, Apps Script serving version to deploy, Pages commit, and rollback targets before any Production write.

### Task 7: Deploy and verify the completed feature

**Files:**
- No source changes; deploy the verified branch artifacts only.
- Evidence: `docs/EXECUTION_RECORD.md` or the active release handoff location selected by the repository workflow.

**Interfaces:**
- Consumes: clean, tested feature branch from Task 6 and the existing production clasp/Pages deployment workflow.
- Produces: deployed Apps Script version and GitHub Pages build where the contract page lists the existing 202 invite and supports QR/link recovery.

- [ ] **Step 1: Reconcile branch and serving source before deployment.**

  Run `git status --short --branch`, `git log -1 --oneline`, and the repository’s existing source/deployment reconciliation checks. Confirm no untracked files or unrelated root-worktree changes are included.

- [ ] **Step 2: Deploy Apps Script first.**

  Use the existing isolated production clasp configuration, create a new Apps Script version, update the existing serving deployment without changing its Web App URL, and record the serving version. Do not create test data and do not send LINE messages.

- [ ] **Step 3: Deploy GitHub Pages.**

  Push the tested branch through the repository’s approved Pages workflow only after the Apps Script route is available. Verify the published `landlord-contract-requests.html` contains the new action/modal markers and references the same fixed API URL.

- [ ] **Step 4: Run read-only production verification.**

  Using the existing signed-in landlord browser session, open the real contract management page, confirm the `landlord_contract_initiated_init` exchange no longer renders a hidden error as 0, confirm room 202 is present when its invite is in the current Workspace, open the QR/link modal, and verify the displayed link is the server-provided invite URL. Do not invoke reissue or create/alter a contract during verification unless the user separately authorizes that write.

- [ ] **Step 5: Prepare rollback evidence.**

  Record the previous Apps Script serving version and previous Pages commit. If deployment verification fails, restore only the serving pointers; do not delete or mutate existing contract/invite rows.

