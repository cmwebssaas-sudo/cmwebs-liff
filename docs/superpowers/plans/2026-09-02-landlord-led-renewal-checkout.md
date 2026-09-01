# Landlord-Led Renewal and Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將到期續約改為房東確認後自動詢問房客、房客同意後自動發送新版簽署邀請，並提供房東從房客詳細頁直接完成退房的標準流程。

**Architecture:** 續約仍使用 `V2_contracts` 的 append-only 版本鏈；房東確認與房客意願回覆改為同一個受控狀態機，邀請及 LINE 通知沿用既有模組。退房採新增的房東 session 保護 POST action，將退房狀態寫在原合約的 additive-only 欄位，保留原合約全文與原租期日期，並同步清除房客／房間目前指向。

**Tech Stack:** Google Apps Script JavaScript、Google Sheets、LINE LIFF、靜態 HTML/CSS/JavaScript、Node.js built-in test runner、repository validator。

**Spec:** `docs/superpowers/specs/2026-09-02-landlord-led-renewal-checkout-design.md`

## Global Constraints

- 本次屬 V2.1 standard digital contract / operational-stability scope；不新增 V3/V4、多租戶客製、共用 LINE OA 或第三方簽章。
- `workspace_id` 是資料主鍵；所有房東讀寫都必須重新驗證 Workspace、membership、role、房間、房客與合約範圍。
- 已簽署或完成的合約全文、簽名 artifact 與原租期日期保持唯讀；續約只能建立 linked append-only version，退房只記錄獨立 checkout 欄位。
- 新流程不建立 `V2_contract_requests` termination request；舊申請資料與既有審核 route 保留相容讀取。
- `ScriptLock` 不得巢狀取得；同一操作的 wrapper 只取得一次 lock，LINE push 與 Sheet write 的失敗必須可安全重試。
- 不建立版本式正式檔名；只修改既有正式檔案或新增職責單一的 `V2_CONTRACT_CHECKOUT.js` 與 `landlord-tenant-checkout.html`。
- 本次不執行 Apps Script、GitHub Pages、Google Sheet、Properties、trigger、LINE 或 Production 部署；完成後提供 release-ready 證據與 rollback 說明。

---

### Task 1: Make landlord review and tenant intent transitions automatic

**Files:**
- Modify: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`
- Modify: `apps-script/V2_CONTRACT_RENEWAL_HISTORY.js`
- Modify: `apps-script/程式碼.js`
- Test: `tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs`
- Modify: `tests/phase196-landlord-renewal-consent.test.mjs`
- Modify: `tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs`

**Interfaces:**
- `landlordInitiatedContractRenewalReviewTransition_(contract, nowIso)` remains pure, returns `send_inquiry: true`, and never creates a signing invite.
- `landlordInitiatedContractConfirmRenewalReview_(access, contractId)` pushes the tenant inquiry before persisting the inquiry-sent state and returns `data.next_action === 'tenant_contract_renewal_intent'`.
- `landlordInitiatedContractUpdateRenewalIntentByLineUid_(tenantLineUserId, contractId, decision)` returns the accepted invite or the declined checkout state in `data.contract`.
- `landlordInitiatedContractCreateRenewalInviteUnlocked_(access, schema, contract, extraUpdates)` remains the only invite creation primitive and is called from the accepted branch while the existing lock is held.

- [ ] **Step 1: Write the failing runtime tests**

Extend the existing Sheet-backed VM fixture with a bound tenant and expired predecessor. Assert that review sets `renewal_inquiry_status` to `sent` and produces one tenant push; acceptance sets `contract_status` to `pending_tenant_signature`, creates one invite, produces one signing push, and remains unchanged on duplicate acceptance. Add a decline case asserting `checkout_status === 'pending'`, `checkout_source === 'tenant_declined'`, `checkout_move_out_date === predecessor.end_date`, and zero invites.

Run `node --test tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs`.

Expected: FAIL because the current code leaves inquiry pending, requires a second landlord action, and has no checkout state.

- [ ] **Step 2: Extend the additive contract schema fields**

Add these fields to both the initiated-contract schema ensure list and the renewal-history migration list, preserving existing columns and append-only migration:

```js
['checkout_status', 'checkout_source', 'checkout_requested_at',
 'checkout_completed_at', 'checkout_move_out_date', 'checkout_note',
 'checkout_idempotency_key']
```

Initialize them as empty strings in `landlordInitiatedContractContractObject_`.

- [ ] **Step 3: Implement automatic landlord review inquiry**

Extract `landlordInitiatedContractSendRenewalInquiryUnlocked_(access, schema, contract, nowIso)`. It validates renewal mode, confirmed review, bound tenant, and no invite; pushes the inquiry first; then writes review/inquiry timestamps. `landlordInitiatedContractConfirmRenewalReview_` calls it under its one lock. Repeated confirmation when inquiry is already `sent` or `responded` returns the existing state without another LINE push.

- [ ] **Step 4: Implement automatic signing invite after acceptance**

Inside the existing intent lock, apply the accepted transition and call the unlocked invite primitive with `notify_tenant: true`. The message includes the invite URL, one-time code, room, and term summary. Push failure prevents invite append and returns the existing error; duplicate acceptance never creates or sends a second invite. Update landlord notification copy to say accepted contracts were sent for signing and declined contracts are waiting for checkout. Keep `landlord_contract_renewal_send` as a compatibility action for old accepted records.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
node --test tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs tests/phase196-landlord-renewal-consent.test.mjs tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
```

Expected: PASS for automatic inquiry, one invite, one signing push, declined checkout state, and retained compatibility behavior. Commit only the listed backend/test files with `git commit -m "feat: automate landlord-led renewal consent"`.

### Task 2: Add the Workspace-protected landlord checkout lifecycle

**Files:**
- Create: `apps-script/V2_CONTRACT_CHECKOUT.js`
- Modify: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`
- Modify: `apps-script/V2_API.js`
- Modify: `apps-script/程式碼.js`
- Test: `tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs`

**Interfaces:**
- `landlordContractCheckoutInitBySession_(sessionToken, contractId)` returns `{ contract, tenant, room, eligibility }` from the session Workspace without writing.
- `landlordContractCheckoutCompleteBySession_(sessionToken, input)` accepts `{ contract_id, move_out_date, note, idempotency_key }` and returns `{ contract_id, checkout_status, move_out_date, idempotent }`.
- `landlordContractCheckoutValidateTarget_(contract, room, siblings, input)` is a pure guard for Workspace, pointer, status, newer-renewal, and date checks.
- `landlordContractCheckoutApplyUnlocked_(access, schema, input)` is the only checkout writer and runs under the existing single lock.

- [ ] **Step 1: Write failing checkout tests**

Add a current room/tenant pointer to the fixture and assert:

```js
const completed = runtime.api.landlordContractCheckoutCompleteBySession_('session-token', {
  contract_id: 'old-contract', move_out_date: '2026-09-01',
  note: '已完成點交，私下確認不續約', idempotency_key: 'checkout-test-1'
});
assert.equal(completed.data.checkout_status, 'completed');
assert.equal(runtime.contract.contract_status, 'terminated');
assert.equal(runtime.contract.end_date, '2026-07-31');
assert.equal(runtime.room.room_status, 'vacant');
assert.equal(runtime.room.current_contract_id, '');
assert.equal(runtime.tenant.current_contract_id, '');
assert.equal(runtime.pushedMessages.length, 0);

const repeated = runtime.api.landlordContractCheckoutCompleteBySession_('session-token', {
  contract_id: 'old-contract', move_out_date: '2026-09-01', idempotency_key: 'checkout-test-1'
});
assert.equal(repeated.data.idempotent, true);
```

Also assert rejection for a cross-Workspace target, stale room pointer, invalid date, newer active renewal, and signing-in-progress renewal. Run the focused test and confirm it fails because the module/actions do not exist.

- [ ] **Step 2: Implement session-scoped init and route registration**

In `V2_CONTRACT_CHECKOUT.js`, resolve the existing landlord signing-review session with read policy for init and `contract_write` policy for complete. Re-read exact Workspace rows and return the original end date as the default move-out date. Register `landlord_contract_checkout_init` and `landlord_contract_checkout_complete` in `landlordInitiatedContractIsRequest_` and route them in `landlordInitiatedContractHandlePostDirect_` without acquiring a second lock.

- [ ] **Step 3: Implement the fail-closed guard and lifecycle write**

Allow only `active`, `expired`, `approved`, or `completed` predecessor status while the room still points to that contract. Permit a pending renewal only when its tenant intent is `declined`; reject newer active or signing siblings. Require a valid ISO move-out date on or after the original start date and never change the original `end_date` or `contract_content`.

Within `landlordContractCheckoutApplyUnlocked_`, update the contract to `terminated` and set all checkout fields plus `terminated_at`; set the room to `vacant` with empty current pointers; clear the tenant current contract pointer; and clear the existing landlord/tenant view current pointers. Preserve all master, bill, payment, document, and signature rows. After releasing the lock, call `workspaceRecordOperationActor_` with `landlord_contract_checkout_complete`; audit failure does not undo a successful transaction.

- [ ] **Step 4: Run focused checkout tests and commit**

Run `node --test tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs`. Expected: PASS for completion, idempotency, declined-to-checkout, original-date preservation, no tenant LINE push, and all fail-closed guards. Commit with `git commit -m "feat: add landlord manual checkout lifecycle"`.

### Task 3: Simplify landlord and tenant UI around the new state machine

**Files:**
- Create: `landlord-tenant-checkout.html`
- Modify: `landlord-tenant-detail.html`
- Modify: `landlord-contract-requests.html`
- Modify: `tenant-contract.html`
- Modify: `tenant-renewal.html`
- Modify: `tenant-termination.html`
- Test: `tests/phase203-landlord-led-renewal-checkout.ui.test.mjs`
- Modify: `tests/phase196-landlord-renewal-consent.test.mjs`
- Modify: `tests/phase198-direct-renewal-signing.test.mjs`

**Interfaces:**
- `goTenantCheckout(contractId)` navigates from the tenant detail contract card to `landlord-tenant-checkout.html`.
- The checkout page uses the established signed landlord session exchange and calls `landlord_contract_checkout_init` / `landlord_contract_checkout_complete`; it never sends a LINE message.
- `landlord-contract-requests.html` displays automatic inquiry and automatic signing status, while legacy backend actions remain callable for compatibility.
- Tenant-visible pages explain that renewal is initiated by the landlord and checkout is handled by the landlord; historical request records remain readable without a new submit CTA.

- [ ] **Step 1: Write failing UI tests**

Create static assertions for the new detail-page entry point and checkout actions:

```js
assert.match(detailPage, /function goTenantCheckout\(contractId\)/);
assert.match(detailPage, /landlord-tenant-checkout\.html/);
assert.match(checkoutPage, /landlord_contract_checkout_init/);
assert.match(checkoutPage, /landlord_contract_checkout_complete/);
assert.match(requestsPage, /房東確認後自動詢問房客/);
assert.doesNotMatch(requestsPage, /onclick="sendRenewalInquiry\(/);
assert.doesNotMatch(requestsPage, /onclick="sendRenewalContract\(/);
assert.doesNotMatch(tenantContractPage, /onclick="goRequestPage\(\s*'tenant-termination\.html'/);
assert.match(tenantContractPage, /退租由房東處理/);
assert.match(terminationPage, /請等待房東辦理退房/);
```

Run the focused UI tests and confirm they fail because the new page and visible-flow copy/actions are not present.

- [ ] **Step 2: Add the landlord checkout page and detail entry**

Build `landlord-tenant-checkout.html` from the existing mobile shell conventions. Load the target contract by signed session, show the immutable original end date, prefill the move-out date with that date, allow an explicit move-out date and note, require a confirmation step, and submit a stable idempotency key. Render success, already-completed, stale-target, and permission errors clearly. Add the `手動辦理退房` action to the eligible contract card and `待辦理退房` when a declined renewal is pending. Preserve the existing tenant-detail navigation and mobile safe-area behavior.

- [ ] **Step 3: Remove the redundant landlord and tenant clicks**

Replace the landlord request page's second inquiry and manual signing buttons with state text that review automatically asks the tenant and acceptance automatically sends the signing invite. Keep compatibility functions/routes out of the visible new path. Change tenant acceptance copy to say the formal signing invite has been sent by LINE. Remove the tenant termination submit CTA and make `tenant-renewal.html` / `tenant-termination.html` informational or historical-only pages that direct the tenant to wait for landlord action.

- [ ] **Step 4: Run focused UI and compatibility tests and commit**

Run:

```bash
node --test tests/phase203-landlord-led-renewal-checkout.ui.test.mjs tests/phase196-landlord-renewal-consent.test.mjs tests/phase198-direct-renewal-signing.test.mjs
```

Expected: PASS for the landlord-only checkout entry, passive tenant surface, automatic status copy, and preserved direct-renewal compatibility. Commit with `git commit -m "feat: simplify landlord renewal checkout UI"`.

### Task 4: Record API, schema, test-matrix, and release evidence

**Files:**
- Modify: `docs/04-API-ROUTES.md`
- Modify: `docs/09-TEST-MATRIX.md`
- Modify: `docs/CMWEBS_CHANGELOG.md`
- Modify: `tests/phase178-contract-expiry-review-workflow.test.mjs`
- Modify: `tests/phase159-landlord-initiated-contract-flow.ui.test.mjs`

- [ ] **Step 1: Write failing documentation assertions**

Add a documentation test that requires the two checkout POST actions, automatic inquiry/signing semantics, additive checkout fields, and the explicit boundary that the original contract dates/content are not overwritten. Run it and confirm the current API/test-matrix/changelog documentation fails the assertions.

- [ ] **Step 2: Update the API and operational documentation**

Update the POST action table to document `landlord_contract_checkout_init` and `landlord_contract_checkout_complete`, revise review-confirm/tenant-intent behavior, and describe idempotency, permissions, and preserved original records. Add Phase 202/203 local candidate rows to the test matrix and mark Apps Script, LIFF, LINE, scheduled, and Production acceptance as `HUMAN_REQUIRED` / `UNVERIFIED` until separately executed. Append a changelog entry that explicitly says the candidate is not deployed.

- [ ] **Step 3: Run the repository validation baseline**

Run:

```bash
node /Users/hans/CMWebs/cmwebs-liff/scripts/validate-project.js \
  --root /Users/hans/CMWebs/cmwebs-liff/.worktrees/simplify-expired-renewal-signing-20260901 \
  --apps-dir apps-script --html-dir . --expected-routes 83
node --test tests/*.test.mjs
git diff --check
```

Investigate and fix only failures caused by this feature; do not mask unrelated dirty-worktree failures. Commit the documentation and final regression updates with `git commit -m "docs: record landlord-led renewal checkout candidate"`.

### Task 5: Final release-ready handoff without deployment

- [ ] Inspect `git status`, current branch, commit log, complete diff, generated test output, and validator output.
- [ ] Confirm no `clasp`, GitHub Pages, Google Sheets, Properties, trigger, LINE, or Production mutation was performed by this implementation turn.
- [ ] Report changed files, state-machine behavior, tests run, known limits, rollback commits, and exact next deployment/UAT actions.
- [ ] Label source/test evidence separately from Apps Script serving, authenticated landlord mobile, tenant LINE, and Production evidence; unresolved live checks remain `HUMAN_REQUIRED`, `UNVERIFIED`, or `UNKNOWN`.

## Self-Review Checklist

- [ ] Every design requirement has an implementation task and a test.
- [ ] No placeholder, invented route, or unexplained product decision remains in the plan.
- [ ] Existing direct renewal, signed-record immutability, workspace authorization, and legacy compatibility boundaries remain intact.
- [ ] Checkout is landlord-only, idempotent, fail-closed, and does not notify the tenant.
- [ ] No nested lock, duplicate top-level declaration, version-suffix filename, or destructive data migration is introduced.
- [ ] Validation and rollback steps are concrete and reproducible from the isolated worktree.
