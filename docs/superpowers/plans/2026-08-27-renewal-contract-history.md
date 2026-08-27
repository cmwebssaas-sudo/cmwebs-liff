# V2.1 舊房客續約合約版本與省工流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 V2.1 local candidate 中完成舊房客到期續約的 append-only 合約版本鏈、完整條件沿用、續約證件選填、30 天不續約優惠判斷、逐版查看與既有簽署審核閉環；任何待簽、駁回或取消的續約都不覆寫原有效合約。

**Architecture:** 以 `V2_contracts` 的一筆資料代表一個租期版本。新增一個責任導向的 `V2_CONTRACT_RENEWAL_HISTORY.js` 共用模組，負責版本鏈、續約預填、優惠判斷、文件引用與歷史 read model；既有房東發起續約與 legacy 房客申請都呼叫同一套 helper。使用既有 `landlord_contract_initiate_renewal`、`tenant_contract_init`、房東房客資料讀取、房東簽署審核與文件路由，除非驗證發現現有 response 無法承載歷史資料，否則不增加 route。所有新版本、request snapshot、文件引用與簽署 artifact 以 append-only 方式寫入；只有核准流程在同一個 ScriptLock 內切換 active 指標。

**Tech Stack:** Google Apps Script ES5-style global modules、Google Sheets additive schema、既有 LINE LIFF/JSONP/POST exchange、Node.js `.mjs` VM runtime mocks、HTML static assertions、`npm run validate`。

**Spec:** `docs/superpowers/specs/2026-08-27-renewal-contract-history-design.md`（使用者已核准；本計畫只授權隔離 worktree 的 local candidate，不授權正式 migration、Apps Script deployment、GitHub Pages publish、LINE 或手機驗收）。

## Global Constraints

- 只在 `/Users/hans/CMWebs/cmwebs-liff/.worktrees/renewal-contract-history-20260827` 實作；root dirty worktree 與其他 worktree 不得修改、清理或 reset。
- 遵守 `AGENTS.md`、`docs/EXECUTION_RECORD.md`、`docs/00-HANDOFF-INDEX.md`、`docs/CMWEBS_PRODUCT_ROADMAP.md`、`docs/CMWEBS_CURRENT_STATE.md`、`docs/CMWEBS_ARCHITECTURE_DECISIONS.md`、`docs/CMWEBS_RELEASE_RULES.md` 的 V2.0/V2.1、Production Consolidation、Gate 0 與證據邊界。
- 每個 source slice 先新增 failing test，確認 RED，再修改最小正式檔名 source；每個 slice 綠燈後建立一個清楚 commit。
- `V2_contracts`、`V2_contract_requests`、`V2_contract_documents` 與 signing artifact 均採 additive schema；不得刪除欄位、清空資料、重建整張 Sheet、覆寫舊合約內容、複製舊簽名證據或刪除舊文件。
- 新增續約版本必須有新的 `contract_id`、`contract_family_id`、`renewal_sequence`；既有舊列缺欄位時只在讀取時 fallback 為自身 family/sequence 1，不做大批量補值。
- 續約預設完整複製上一版的月租、管理費、押金、其他固定費用、付款日與條款／備註；房東可逐項改新版本 snapshot，房間或 Workspace 預設後續變更不得回算已建立版本。
- 首次簽約的 `identity_front`、`identity_back`、`selfie` 與 `signature` 規則維持必填；續約的身份文件選填，未重新上傳時建立不可變來源引用，重新上傳時新增文件列；每個新版本仍必須有自己的簽名 artifact。
- 30 天優惠由後端以收到日期和該版本到期日計算：至少 30 個日曆日自動 `waived`；未滿 30 天為 `landlord_review`，不自動收取也不自動免除；中途提前解約不適用。
- 所有讀寫重新驗證 server session、Workspace、房東 membership、房客、房間、目前 active contract 與版本鏈；瀏覽器傳入的 `workspace_id`、`landlord_id`、`tenant_id`、eligibility、signing mode 不得單獨授權。
- 正常 API request 不執行未授權的 schema migration；缺少必要 headers 時 fail closed 並回傳明確 schema error。只有測試或明確 local migration helper 可新增 header。
- 不新增 `*_FIXED.*`、`final-*`、`new-*` 等版本式正式檔名；不把 token、ID token、銀行資料、身份圖片、簽名 base64、Drive ID 放入 URL、browser storage、console 或 Git。
- 完成前必須通過 `npm run validate`、受影響 runtime/UI tests、`node --test tests/*.test.mjs` 與 `git diff --check`；不以 local PASS、HTTP 200 或 Pages 狀態宣稱 Production/LINE/手機成功。

## File map

| File | Responsibility |
|---|---|
| `apps-script/V2_CONTRACT_RENEWAL_HISTORY.js` | 版本鏈、讀取 fallback、續約預填 snapshot、30 天優惠判斷、文件引用與歷史 read model 的唯一共用來源。 |
| `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js` | 房東發起續約的新版本建立、同一鎖內核准切換、既有邀請與版本欄位整合。 |
| `apps-script/V2_CONTRACT_REQUESTS.js` | legacy 房客續約申請欄位、request snapshot、完成時建立新版本而非更新舊列、不續約優惠判斷。 |
| `apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js` | 文件來源／引用欄位，續約沿用文件時追加 reference row，不複製或覆寫舊 Drive blob。 |
| `apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js` | 保持模式由 server 推導，續約只要求新版本 signature，首次簽約維持身份文件必填。 |
| `apps-script/V2_CONTRACT_ARTIFACT_STORAGE.js` | 對續約文件 artifact requirement、source reference 與新版本簽署證據邊界做回歸保護。 |
| `apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js` | tenant contract init/history、renewal comparison、文件狀態與優惠條款的 server payload。 |
| `apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js` | 房東核准／駁回時沿用新版本 finalization，確認新版本自己的 signature artifact。 |
| `apps-script/V2_API.js`、`apps-script/程式碼.js` | 現有 tenant/landlord contract read route 的 response/dispatcher 整合；只有需要新 action 時同步增 route。 |
| `landlord-tenant-detail.html` | 房客詳細頁的目前合約、歷史版本、每版完整合約與簽名查看、沿用上一版發起續約入口。 |
| `landlord-contract-requests.html` | 續約預填、完整金額／付款／條款差異、30 天優惠編輯、簽署狀態與房東核准畫面。 |
| `tenant-contract.html` | 續約版本與新舊差異、身份文件選填提示、優惠條款、逐版唯讀查看與既有簽署 UI 回歸。 |
| `tests/phase174-contract-renewal-history.runtime.test.mjs` | 共用 helper、三代版本、legacy/landlord flows、文件引用、優惠判斷、權限、idempotency 與 append-only runtime coverage。 |
| `tests/phase175-contract-renewal-history.ui.test.mjs` | 房東詳細頁、續約 review、房客續約頁、mobile shell、既有 route/entry 與錯誤狀態的 static assertions。 |
| `docs/05-DATA-MODEL.md` | 新增欄位、fallback、版本鏈與文件 reference schema。 |
| `docs/04-API-ROUTES.md` | 若 route inventory 或 payload/authorization 改變，更新既有 route contract；未新增 route 也要補 response 欄位說明。 |
| `docs/09-TEST-MATRIX.md` | 新增 Phase 174/175、驗證命令與尚未取得的部署／真機證據邊界。 |
| `docs/CMWEBS_CHANGELOG.md` | 記錄 local candidate 的實作與驗證，不寫成 Production 已部署。 |

---

### Task 1: Establish the failing contract-history domain tests and canonical additive field map

**Files:**
- Create: `tests/phase174-contract-renewal-history.runtime.test.mjs`
- Create: `apps-script/V2_CONTRACT_RENEWAL_HISTORY.js`
- Modify: `tests/phase174-contract-renewal-history.runtime.test.mjs` during red/green iterations

**Interfaces:**
- Produces `contractRenewalHistoryNormalizeContract_`, `contractRenewalHistoryBuildDefaults_`, `contractRenewalHistoryBuildVersionFields_`, `contractRenewalHistoryResolveFamily_`, `contractRenewalHistoryList_`, `contractRenewalHistoryEvaluateNotice_`, `contractRenewalHistoryBuildCarriedDocumentReference_`, and schema/header validation helpers.
- Consumes canonical row objects from `V2_contracts`, `V2_contract_requests`, and `V2_contract_documents`; does not write Sheets itself except through explicitly named append/reference callers in later tasks.
- Uses these exact additive fields: `contract_family_id`, `renewal_sequence`, `renewed_from_contract_id`, `renewed_to_contract_id`, `renewal_request_id`, `other_fixed_fee_amount`, `other_fixed_fee_note`, `monthly_payment_day`, `terms_snapshot_json`, `special_offer_enabled`, `special_offer_notice_days`, `special_offer_applies_to`, `special_offer_waiver_type`, `special_offer_clause`, `special_offer_decision`, `special_offer_notice_date`, `special_offer_days_before_expiry`, `special_offer_decision_reason`, and `identity_document_mode`.

- [ ] **Step 1: Add a VM harness and write the pure-domain RED assertions.**

  Load the new module in the same `vm` style used by `tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs`, with deterministic UUID/date/JSON helpers. Use a previous contract ending `2026-09-30` and assert the exact defaults:

  ```js
  const defaults = api.contractRenewalHistoryBuildDefaults_(previous, {
    now: '2026-08-27T00:00:00.000Z'
  });

  assert.deepEqual(defaults, {
    start_date: '2026-10-01',
    end_date: '2027-09-30',
    term_months: 12,
    rent_amount: 24000,
    management_fee: 500,
    deposit_amount: 48000,
    other_fixed_fee_amount: 300,
    other_fixed_fee_note: '網路費',
    monthly_payment_day: 5,
    terms_snapshot_json: previous.terms_snapshot_json,
    special_offer_enabled: true,
    special_offer_notice_days: 30,
    special_offer_applies_to: 'expiry_non_renewal',
    special_offer_waiver_type: 'breach_penalty_waived',
    special_offer_clause: '租約期滿如不再續約，提前30個日曆日通知，免收違約金。',
    identity_document_mode: 'optional'
  });
  ```

  Add assertions for old-row fallback (`contract_family_id === contract_id`, `renewal_sequence === 1`), a second renewal sequence of 2, a third sequence of 3, and `renewed_from_contract_id`/`renewed_to_contract_id` direction.

- [ ] **Step 2: Add RED assertions for the server-side notice decision.**

  Assert the exact result shape for the same active contract ending `2026-09-30`:

  ```js
  assert.deepEqual(
    api.contractRenewalHistoryEvaluateNotice_(contract, '2026-08-31'),
    {
      applicable: true,
      decision: 'waived',
      notice_date: '2026-08-31',
      contract_end_date: '2026-09-30',
      notice_days: 30,
      days_before_expiry: 30,
      reason: 'NOTICE_PERIOD_MET'
    }
  );

  assert.equal(
    api.contractRenewalHistoryEvaluateNotice_(contract, '2026-09-01').decision,
    'landlord_review'
  );
  assert.equal(
    api.contractRenewalHistoryEvaluateNotice_(contract, '2026-08-31', { event: 'early_termination' }).applicable,
    false
  );
  ```

  The test must prove the browser cannot supply `decision`, `days_before_expiry`, or `penalty_amount` as authoritative values.

- [ ] **Step 3: Run only the new test and capture the expected RED failure.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  ```

  Expected result: FAIL with a missing `contractRenewalHistoryBuildDefaults_` or equivalent domain helper, not a test-loader or syntax error. Correct only harness/import mistakes before proceeding.

- [ ] **Step 4: Implement the smallest pure helper set and canonical field validation.**

  In `apps-script/V2_CONTRACT_RENEWAL_HISTORY.js`, define the exact functions listed under Interfaces. `contractRenewalHistoryNormalizeContract_` must read the current aliases (`monthly_rent`/`rent_amount`, `monthly_management_fee`/`management_fee`, `payment_day`/`monthly_payment_day`, `contract_start_date`/`start_date`, `contract_end_date`/`end_date`) once and return one normalized object. `contractRenewalHistoryBuildDefaults_` must compute the next calendar day and one-year term without consulting Workspace defaults. `contractRenewalHistoryBuildVersionFields_` must assign a new version ID supplied by its caller, preserve the normalized financial/terms snapshot, and set the family/sequence links. `contractRenewalHistoryEvaluateNotice_` must use the contract snapshot and server date only, returning `landlord_review` for less than 30 days and `not_applicable` for early termination. `contractRenewalHistoryList_` must sort only by numeric `renewal_sequence` then ISO dates and mark exactly one server-resolved current version.

  Add validation-only helpers that compare required headers without adding them during a request. Add explicit test-only/local migration helpers with names `contractRenewalHistoryAdditiveMigrationForTest_` and `contractRenewalHistoryValidateSchema_`; migration may append missing headers but may not alter existing rows.

- [ ] **Step 5: Run the focused test and commit the domain contract.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  git diff --check
  git add apps-script/V2_CONTRACT_RENEWAL_HISTORY.js tests/phase174-contract-renewal-history.runtime.test.mjs docs/superpowers/specs/2026-08-27-renewal-contract-history-design.md
  git commit -m "feat: define append-only renewal history domain"
  ```

  Expected: focused tests PASS; no deployment or Sheet mutation occurs.

---

### Task 2: Make landlord-initiated renewal create a new immutable version with full defaults

**Files:**
- Modify: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`
- Modify: `tests/phase174-contract-renewal-history.runtime.test.mjs`
- Modify: `tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs` only when an existing assertion must reflect additive fields

**Interfaces:**
- `landlordInitiatedContractCreateRenewal_(access, input)` remains the existing entry point and delegates default/snapshot construction to `contractRenewalHistoryBuildDefaults_` and `contractRenewalHistoryBuildVersionFields_`.
- `landlordInitiatedContractFinalizeApproval_(ss, access, contract, now)` consumes the new link fields and changes only predecessor lifecycle/link columns plus the new version’s activation/pointers.
- The route continues to be `landlord_contract_initiate_renewal`; no new route is introduced in this task.

- [ ] **Step 1: Add a failing runtime case for complete renewal prefill and append-only predecessor.**

  In the existing fake-sheet fixture, seed an active room-603 contract with rent `24000`, management `500`, deposit `48000`, other fixed fee `300`, payment day `5`, terms snapshot, existing identity document IDs, and no prior version fields. Call `landlordInitiatedContractCreateRenewal_` with only the previous contract ID and a test request ID. Assert:

  ```js
  assert.equal(result.success, true);
  assert.notEqual(result.data.contract.contract_id, 'C603-2026');
  assert.equal(result.data.contract.renewed_from_contract_id, 'C603-2026');
  assert.equal(result.data.contract.contract_family_id, 'C603-2026');
  assert.equal(Number(result.data.contract.renewal_sequence), 2);
  assert.equal(result.data.contract.start_date, '2026-10-01');
  assert.equal(result.data.contract.end_date, '2027-09-30');
  assert.equal(Number(result.data.contract.rent_amount), 24000);
  assert.equal(Number(result.data.contract.management_fee), 500);
  assert.equal(Number(result.data.contract.deposit_amount), 48000);
  assert.equal(Number(result.data.contract.other_fixed_fee_amount), 300);
  assert.equal(Number(result.data.contract.monthly_payment_day), 5);
  assert.equal(result.data.contract.identity_document_mode, 'optional');
  assert.equal(result.data.contract.special_offer_notice_days, 30);
  assert.equal(contractRows[0].end_date, '2026-09-30');
  assert.equal(contractRows[0].rent_amount, '24000');
  assert.equal(contractRows[0].renewed_to_contract_id || '', '');
  ```

  Add a second and third renewal from the newly active predecessor after approval, proving IDs and sequences `2`, `3`, and `4` are distinct and the first row’s financial snapshot remains unchanged.

- [ ] **Step 2: Run the focused case and confirm RED.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  ```

  Expected: fail because the current implementation does not populate the full defaults/version fields and may still use incomplete schema values.

- [ ] **Step 3: Update the canonical landlord renewal builder.**

  In `landlordInitiatedContractCreateRenewalUnlocked_`, re-read the predecessor inside the existing lock, verify its `workspace_id`, `tenant_id`, `room_id`, active/current status and absence of an open sibling, then call the shared helper. Permit explicit landlord overrides only for fields in the exact renewal edit set: `start_date`, `end_date`, `term_months`, `rent_amount`, `management_fee`, `deposit_amount`, `other_fixed_fee_amount`, `other_fixed_fee_note`, `monthly_payment_day`, `terms_snapshot_json`, `special_offer_enabled`, `special_offer_notice_days`, `special_offer_clause`, and `landlord_note`. Recalculate derived end date only when the landlord changes the start/term pair; reject an end date inconsistent with the term instead of silently changing it.

  Write a new row with `contract_status = pending_tenant_signature`, `signing_mode = renewal`, `contract_origin = landlord_initiated`, `renewal_request_id`, `identity_document_mode = optional`, the immutable snapshot fields, the family/sequence links, and a blank new signing artifact state. Do not mutate predecessor dates, money, terms, documents, signature, room pointers, tenant views, or bills.

- [ ] **Step 4: Harden approval and cancellation invariants.**

  Update `landlordInitiatedContractFinalizeApproval_` so renewal approval requires the new contract’s own submitted signature artifact and a still-active predecessor with matching family, room, tenant, and Workspace. Under the existing lock, set predecessor `contract_status/status/account_status` to the established renewed lifecycle values and write only `renewed_to_contract_id`, `updated_at`; activate the new row and update current room/tenant/view pointers. Repeated approval must return the existing idempotent result and never create a second active row. Rejection, cancellation, invite expiry, and incomplete signing must leave the old row active and leave `renewed_to_contract_id` blank.

- [ ] **Step 5: Run relevant landlord initiation and approval regressions, then commit.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  node --test tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  node --test tests/phase158-landlord-initiated-contract-activation.runtime.test.mjs
  git diff --check
  git add apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js tests/phase174-contract-renewal-history.runtime.test.mjs tests/phase157-landlord-initiated-contract-flow.runtime.test.mjs
  git commit -m "feat: create immutable landlord renewal versions"
  ```

---

### Task 3: Convert legacy renewal completion from in-place update to version append

**Files:**
- Modify: `apps-script/V2_CONTRACT_REQUESTS.js`
- Modify: `tests/phase174-contract-renewal-history.runtime.test.mjs`
- Modify: `tests/phase154-contract-complete.runtime.test.mjs` only for the exact legacy compatibility assertion that currently expects in-place mutation

**Interfaces:**
- `contractRequestValidateRequestData_` accepts renewal snapshots for deposit, payment day, other fixed fees, terms, special-offer fields, and `identity_document_mode`.
- `contractRequestApplyCompletedRequestToContract_` produces a new version and writes `applied_contract_id`; it no longer updates the original contract’s date or financial snapshot.
- Existing request IDs and status/idempotency behavior remain compatible with `landlord_contract_request_update`.

- [ ] **Step 1: Write failing tests for legacy renewal append and idempotency.**

  Seed an active `C603-2026` and a completed renewal request with approved full snapshot values. Assert after `contractRequestApplyCompletedRequestToContract_`:

  ```js
  assert.equal(result.success, true);
  assert.equal(result.data.applied_contract_id !== 'C603-2026', true);
  assert.equal(contractRows[0].end_date, '2026-09-30');
  assert.equal(contractRows[0].rent_amount, '24000');
  assert.equal(contractRows[0].contract_status, 'renewed');
  assert.equal(requestRow.applied_contract_id, result.data.applied_contract_id);
  assert.equal(newContract.renewed_from_contract_id, 'C603-2026');
  assert.equal(newContract.identity_document_mode, 'optional');
  assert.equal(newContract.special_offer_clause, '租約期滿如不再續約，提前30個日曆日通知，免收違約金。');
  ```

  Call completion a second time with the same request and assert the same `applied_contract_id`, one new contract row, one activation transition, and no duplicate bills. A request pointing to another Workspace or a non-current predecessor must return a specific rejection code and leave every row unchanged.

- [ ] **Step 2: Run the focused case and confirm RED.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  ```

  Expected: fail because the current function mutates the original contract’s `end_date`, rent, and management fee.

- [ ] **Step 3: Extend request schema and validation additively.**

  Add to `V2_CONTRACT_REQUEST_HEADERS` the exact fields `current_deposit_amount`, `current_other_fixed_fee_amount`, `current_other_fixed_fee_note`, `current_payment_day`, `current_terms_snapshot_json`, `requested_deposit_amount`, `requested_other_fixed_fee_amount`, `requested_other_fixed_fee_note`, `requested_payment_day`, `requested_terms_snapshot_json`, `approved_deposit_amount`, `approved_other_fixed_fee_amount`, `approved_other_fixed_fee_note`, `approved_payment_day`, `approved_terms_snapshot_json`, `requested_special_offer_enabled`, `requested_special_offer_notice_days`, `requested_special_offer_clause`, `approved_special_offer_enabled`, `approved_special_offer_notice_days`, `approved_special_offer_clause`, `special_offer_decision`, `special_offer_notice_date`, `special_offer_days_before_expiry`, `special_offer_decision_reason`, and `identity_document_mode`.

  Preserve existing `contract_id` as the source/current contract ID and `applied_contract_id` as the new version ID. Validation must fill missing renewal values from the current contract snapshot, require the first-signing identity mode to remain `required`, and reject a browser-supplied special-offer decision that disagrees with `contractRenewalHistoryEvaluateNotice_`.

- [ ] **Step 4: Implement append-only completion and request audit.**

  Replace the in-place field update inside `contractRequestApplyCompletedRequestToContract_` with a lock-protected re-read of the current predecessor, call `contractRenewalHistoryBuildVersionFields_`, append the new contract row, copy the approved request snapshot into the new row, and then mark the predecessor renewed only after the new row is complete. Set request `applied_contract_id`, `completed_at`, and audit fields. Existing idempotency checks must return the stored applied version. Keep billing creation/current-pointer updates behind the same finalization boundary used by landlord-initiated approval.

- [ ] **Step 5: Run legacy and full contract-completion tests, then commit.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  node --test tests/phase154-contract-complete.runtime.test.mjs
  node --test tests/phase155-contract-complete-ui.test.mjs
  git diff --check
  git add apps-script/V2_CONTRACT_REQUESTS.js tests/phase174-contract-renewal-history.runtime.test.mjs tests/phase154-contract-complete.runtime.test.mjs
  git commit -m "fix: append legacy renewal contract versions"
  ```

---

### Task 4: Add optional renewal identity documents with append-only carry-forward references

**Files:**
- Modify: `apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js`
- Modify: `apps-script/V2_CONTRACT_ARTIFACT_STORAGE.js`
- Modify: `apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js`
- Modify: `apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js`
- Modify: `tests/phase174-contract-renewal-history.runtime.test.mjs`
- Modify: `tests/phase154-contract-complete.runtime.test.mjs` only for mode-specific artifact regressions

**Interfaces:**
- `LD_CONTRACT_DOCUMENT_HEADERS_` gains `document_origin` and `source_document_id`; the existing upload path still creates a new `document_id`.
- `contractRenewalHistoryBuildCarriedDocumentReference_` creates a reference object for the new contract without copying a Drive blob or treating the old document as newly uploaded.
- `tenantContractSigningRequiredArtifacts_` and `contractArtifactStorageRequiredTypes_` continue to require `identity_front`, `identity_back`, `selfie`, `signature` for `new_tenant`, and only `signature` for `renewal`.

- [ ] **Step 1: Add failing artifact/document tests.**

  Assert a renewal session with no new identity uploads is signable once its new signature exists; a new-tenant session with any missing identity document is rejected. Assert that carry-forward creates one new reference row per existing identity document with `contract_id = newContractId`, `document_origin = carried_forward`, `source_document_id = oldDocumentId`, the same hash/mime/name metadata, and no new Drive file ID. Assert re-upload creates `document_origin = uploaded`, a new document ID, and leaves old rows unchanged.

- [ ] **Step 2: Run focused test and confirm RED if the reference fields or mode boundary are absent.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  ```

- [ ] **Step 3: Implement reference rows and server-derived mode behavior.**

  Extend the document schema constants and the explicit test/local migration list. Add a locked reference append helper that verifies same Workspace, tenant, predecessor contract family, source document status and document type before appending. Do not call Drive upload for carry-forward. In signing session/submission, derive `identity_document_mode` from the canonical renewal contract and ignore client-supplied mode; display existing documents as available references but never use the predecessor’s signature artifact to satisfy the new signature requirement.

- [ ] **Step 4: Run signing regressions and commit.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  node --test tests/phase132-tenant-contract-signing-submission.runtime.test.mjs
  node --test tests/phase133-tenant-contract-signing-ui.test.mjs
  node --test tests/phase154-contract-complete.runtime.test.mjs
  git diff --check
  git add apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js apps-script/V2_CONTRACT_ARTIFACT_STORAGE.js apps-script/V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js tests/phase174-contract-renewal-history.runtime.test.mjs tests/phase154-contract-complete.runtime.test.mjs
  git commit -m "feat: carry renewal identity documents by reference"
  ```

---

### Task 5: Implement 30-day non-renewal offer evaluation and landlord-review fallback

**Files:**
- Modify: `apps-script/V2_CONTRACT_REQUESTS.js`
- Modify: `apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js`
- Modify: `apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js`
- Modify: `tests/phase174-contract-renewal-history.runtime.test.mjs`

**Interfaces:**
- Existing termination/non-renewal request creation and update functions consume `contractRenewalHistoryEvaluateNotice_` and persist the returned decision fields.
- The tenant/landlord payload exposes `special_offer_clause`, `special_offer_notice_days`, `special_offer_decision`, `special_offer_days_before_expiry`, and `special_offer_decision_reason` as read-only server results.
- Existing mid-term early-termination penalty flow remains the authority for `early_termination` and is not changed to the renewal offer.

- [ ] **Step 1: Add failing request tests for all three cases.**

  Cover: notice received exactly 30 days before expiry -> `waived` and `penalty_status = waived`; 29 days -> `landlord_review` with no automatic `penalty_amount` and no automatic waiver; an early-termination request before expiry -> `not_applicable` and existing penalty review fields unchanged. Assert persisted request fields include the received date, contract end date, computed day count, decision, reason, and clause snapshot.

- [ ] **Step 2: Run the focused test and confirm RED.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  ```

- [ ] **Step 3: Implement server calculation and immutable audit snapshot.**

  At request creation and again at landlord decision, re-read the current contract version, verify the event is `expiry_non_renewal`, calculate from a server-normalized date, and persist the result. For under-30-day requests set status to the existing landlord review state without creating a charge or waiver. If the landlord later approves a non-waiver decision, store that explicit decision in the request audit; do not modify the contract’s historical special-offer snapshot. Expose the clause and computed result in signing/read payloads without allowing UI values to write the decision.

- [ ] **Step 4: Run request and signing regressions, then commit.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  node --test tests/phase154-contract-complete.runtime.test.mjs
  node --test tests/phase158-landlord-initiated-contract-activation.runtime.test.mjs
  git diff --check
  git add apps-script/V2_CONTRACT_REQUESTS.js apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js tests/phase174-contract-renewal-history.runtime.test.mjs
  git commit -m "feat: enforce renewal notice offer decisions"
  ```

---

### Task 6: Expose a server-built contract history read model through existing APIs

**Files:**
- Modify: `apps-script/V2_CONTRACT_REQUESTS.js`
- Modify: `apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js`
- Modify: `apps-script/V2_API.js` only if the existing landlord tenant detail response is assembled there
- Modify: `apps-script/程式碼.js` only if an existing dispatcher response needs a field pass-through
- Modify: `tests/phase171-landlord-tenant-detail-fetch.test.mjs`
- Modify: `tests/phase172-landlord-tenant-contract-view-entry.test.mjs`
- Modify: `tests/phase174-contract-renewal-history.runtime.test.mjs`

**Interfaces:**
- Existing `tenant_contract_init` response gains `data.contract_history` and `data.current_contract_id`; `data.contract` remains the server-resolved current active version.
- Existing landlord tenant detail response gains `contract_history`; each item contains `contract_id`, `contract_family_id`, `renewal_sequence`, status, date/money/payment snapshot, `special_offer`, `identity_documents`, `signature_artifact`, `is_current`, and `read_only`.
- No new URL or route is added unless an existing route cannot carry the response; if a route is added, it must be added to `程式碼.js`, `docs/04-API-ROUTES.md`, route inventory tests, and the affected UI in the same task.

- [ ] **Step 1: Add failing read-model tests.**

  Seed three versions for room 603, with one pending renewal and one active current version, then assert tenant and landlord reads return all three sorted by sequence, exactly one `is_current`, old signatures/documents attached to their own version, and no pending version presented as current. Add a cross-Workspace request that must return an empty/denied result without leaking history.

- [ ] **Step 2: Run existing detail/view tests and confirm RED.**

  ```bash
  node --test tests/phase171-landlord-tenant-detail-fetch.test.mjs
  node --test tests/phase172-landlord-tenant-contract-view-entry.test.mjs
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  ```

- [ ] **Step 3: Build history from canonical rows and preserve current resolver semantics.**

  Call `contractRenewalHistoryList_` after Workspace/tenant authorization. Keep `contractRequestResolveCurrentContract_` and existing active/current selection for `data.contract`; do not replace it with “latest row.” For each historical version, resolve only its own immutable terms document and signing artifact, attach carried document source metadata, and mark every historical item read-only. Return explicit `CONTRACT_HISTORY_SCHEMA_NOT_READY` when required additive headers are absent.

- [ ] **Step 4: Run history and prior room-603 regressions, then commit.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  node --test tests/phase169-landlord-signed-contract-view.test.mjs
  node --test tests/phase171-landlord-tenant-detail-fetch.test.mjs
  node --test tests/phase172-landlord-tenant-contract-view-entry.test.mjs
  git diff --check
  git add apps-script/V2_CONTRACT_REQUESTS.js apps-script/V2_TENANT_LIFF_SIGNING_SESSION.js apps-script/V2_API.js apps-script/程式碼.js tests/phase171-landlord-tenant-detail-fetch.test.mjs tests/phase172-landlord-tenant-contract-view-entry.test.mjs tests/phase174-contract-renewal-history.runtime.test.mjs
  git commit -m "feat: expose immutable contract history read model"
  ```

---

### Task 7: Add landlord renewal/history UI without hiding the 603 contract entry

**Files:**
- Modify: `landlord-tenant-detail.html`
- Modify: `landlord-contract-requests.html`
- Create: `tests/phase175-contract-renewal-history.ui.test.mjs`
- Modify: `tests/phase159-landlord-initiated-contract-flow.ui.test.mjs` only for existing selector/route assertions that become more specific

**Interfaces:**
- Consumes the existing landlord tenant-detail payload and `contract_history`, preserving the existing room-603 `房客合約 → 查看完整合約與簽名` link for every version.
- Existing `landlord_contract_initiate_renewal` receives only editable snapshot fields and the server-authenticated session; UI cannot send offer eligibility as authority.
- Existing signing-review route displays the new contract’s own document/signature evidence and source version.

- [ ] **Step 1: Write failing static assertions for the requested location and controls.**

  Assert `landlord-tenant-detail.html` contains the visible labels `房客合約`, `查看完整合約與簽名`, `合約版本`, `沿用上一版發起續約`, and a rendered loop/source for `contract_history`. Assert every history item carries a contract-specific link or callback, the current item is visibly distinguished, pending items do not replace the current label, and empty/error states are present.

  Assert `landlord-contract-requests.html` contains fields/labels for `押金`, `其他固定費用`, `付款日`, `沿用上一版`, `30`, `不續約`, `房東審核`, `優惠條款`, source version, target version, and an explicit old/new difference block.

- [ ] **Step 2: Run the new UI test and confirm RED.**

  ```bash
  node --test tests/phase175-contract-renewal-history.ui.test.mjs
  ```

- [ ] **Step 3: Implement current/history contract rendering in the detail page.**

  Use the existing page loader and safe text helpers. Render the current active version first, then a chronological version timeline. Each item must show version sequence, period, rent, management fee, deposit, payment day, status, and `查看完整合約與簽名`; use the existing contract detail route/entry mechanism rather than a copied deep LIFF URL. Show `沿用上一版發起續約` only when the server response says the landlord can write and there is no open sibling. Show a clear schema/API error instead of a blank contract card.

- [ ] **Step 4: Implement the landlord renewal form and review presentation.**

  Prepopulate all snapshot fields from the server response, show “沿用上一版” when unchanged, highlight changed fields, allow editing/cancelling the offer, and render the server-calculated under-30-day result as `未符合優惠、交由房東審核`. Include source/target IDs and version sequence in the review card. Preserve existing QR/invite/reissue/cancel, signature preview, and room-603 signed-contract entry behavior.

- [ ] **Step 5: Run UI and room-603 regressions, then commit.**

  ```bash
  node --test tests/phase175-contract-renewal-history.ui.test.mjs
  node --test tests/phase159-landlord-initiated-contract-flow.ui.test.mjs
  node --test tests/phase169-landlord-signed-contract-view.test.mjs
  node --test tests/phase171-landlord-tenant-detail-fetch.test.mjs
  git diff --check
  git add landlord-tenant-detail.html landlord-contract-requests.html tests/phase175-contract-renewal-history.ui.test.mjs tests/phase159-landlord-initiated-contract-flow.ui.test.mjs
  git commit -m "feat: show landlord contract versions and renewal defaults"
  ```

---

### Task 8: Add tenant renewal UI, optional document messaging, and complete-contract history viewing

**Files:**
- Modify: `tenant-contract.html`
- Modify: `tests/phase175-contract-renewal-history.ui.test.mjs`
- Modify: `tests/phase133-tenant-contract-signing-ui.test.mjs`
- Modify: `tests/phase172-landlord-tenant-contract-view-entry.test.mjs` only if the shared entry assertion needs an exact history selector

**Interfaces:**
- Consumes `tenant_contract_init`/signing payload fields `contract_history`, `renewal_comparison`, `identity_document_mode`, `special_offer_clause`, `special_offer_notice_days`, and `special_offer_decision`.
- Sends only new-contract signature and optional re-uploaded document artifacts; it never sends a trusted eligibility result or a client-selected signing mode.

- [ ] **Step 1: Add failing UI assertions for renewal effort reduction and history.**

  Assert the renewal page displays `第 N 版續約`, complete terms, `沿用上一版`, `身分證正面（選填）`, `身分證反面（選填）`, `自拍照（選填）`, the 30-day clause/decision, a new-vs-old comparison, and a read-only history list with version-specific complete-contract/signature actions. Assert the first-signing rendering still contains required identity upload validation and that the submit payload does not contain a browser-authoritative `special_offer_decision` field.

- [ ] **Step 2: Run the focused UI tests and confirm RED.**

  ```bash
  node --test tests/phase175-contract-renewal-history.ui.test.mjs
  node --test tests/phase133-tenant-contract-signing-ui.test.mjs
  ```

- [ ] **Step 3: Implement the tenant history and renewal comparison panels.**

  Extend the existing `renderContractHero`, signing summary, artifact state and readiness checks without replacing the fixed mobile shell. For renewal mode, render optional identity upload labels and do not block submit when those inputs are empty; keep signature/terms document readiness mandatory. Render the server snapshot values for rent, management fee, deposit, other fixed fees, payment day, terms, and offer. History actions must be read-only and must use the registered LIFF entry/post-login route.

- [ ] **Step 4: Run all tenant signing regressions and commit.**

  ```bash
  node --test tests/phase175-contract-renewal-history.ui.test.mjs
  node --test tests/phase133-tenant-contract-signing-ui.test.mjs
  node --test tests/phase130-verified-liff-signing-session.test.mjs
  node --test tests/phase154-contract-complete.runtime.test.mjs
  git diff --check
  git add tenant-contract.html tests/phase175-contract-renewal-history.ui.test.mjs tests/phase133-tenant-contract-signing-ui.test.mjs tests/phase130-verified-liff-signing-session.test.mjs
  git commit -m "feat: simplify tenant renewal signing and history view"
  ```

---

### Task 9: Reconcile schema/API/test documentation and validate the isolated candidate

**Files:**
- Modify: `docs/05-DATA-MODEL.md`
- Modify: `docs/04-API-ROUTES.md`
- Modify: `docs/09-TEST-MATRIX.md`
- Modify: `docs/CMWEBS_CHANGELOG.md`
- Modify: `tests/phase174-contract-renewal-history.runtime.test.mjs`
- Modify: `tests/phase175-contract-renewal-history.ui.test.mjs`

**Interfaces:**
- Documentation must describe the exact additive fields from Task 1, existing route payload additions, authorization rules, idempotency boundary, fallback behavior, and local-only evidence status.
- Test matrix records the focused tests, full suite command, `npm run validate`, and separate `HUMAN_REQUIRED` evidence for Apps Script/Sheet/Pages/LINE/mobile.

- [ ] **Step 1: Add schema and API documentation assertions.**

  Extend runtime/static tests to verify every field in the plan is present in the documented schema/API sections and that no new route is claimed unless it exists in `apps-script/程式碼.js`. Assert docs include the distinction between source `contract_id` and new `applied_contract_id`.

- [ ] **Step 2: Update documents without claiming deployment.**

  Document old-row read fallback, new-row links, carried-forward references, optional renewal documents, server-only 30-day calculation, and the rule that the old active contract remains current until approval. Add a changelog entry labeled local candidate/isolated validation. Do not state that migration ran against Google Sheets or that Apps Script/Pages/LINE/mobile acceptance passed.

- [ ] **Step 3: Run focused docs/static checks.**

  ```bash
  node --test tests/phase174-contract-renewal-history.runtime.test.mjs
  node --test tests/phase175-contract-renewal-history.ui.test.mjs
  node --test tests/phase159-landlord-initiated-contract-flow.ui.test.mjs
  git diff --check
  ```

- [ ] **Step 4: Commit the documentation and test-matrix slice.**

  ```bash
  git add docs/05-DATA-MODEL.md docs/04-API-ROUTES.md docs/09-TEST-MATRIX.md docs/CMWEBS_CHANGELOG.md tests/phase174-contract-renewal-history.runtime.test.mjs tests/phase175-contract-renewal-history.ui.test.mjs
  git commit -m "docs: record renewal history schema and verification boundary"
  ```

---

### Task 10: Run the release-quality local verification and prepare the non-deployment handoff

**Files:**
- Verify: all changed source, tests, and docs in this plan
- Modify: none unless a verification failure identifies a real implementation defect; fixes must use the task-specific test-first loop and a new commit

**Interfaces:**
- Final candidate must preserve route count/handler coverage, duplicate declaration checks, credential scan, fixed mobile shell, and all existing contract/signing regressions.
- Handoff reports exact branch/HEAD/diff/test output and separates local artifact evidence from unperformed deployment/real-device evidence.

- [ ] **Step 1: Confirm the worktree and changed-file scope.**

  ```bash
  git status --short --branch
  git log --oneline --decorate -12
  git diff --stat origin/main...HEAD
  rg -n "TBD|TODO|待確認|未決|placeholder" docs/superpowers/specs/2026-08-27-renewal-contract-history-design.md
  ```

  Expected: only the isolated branch contains the planned changes; the final `rg` command returns no output. If unrelated files appear, stop and preserve them for review rather than removing them.

- [ ] **Step 2: Run the complete local verification suite.**

  ```bash
  npm run validate
  node --test tests/*.test.mjs
  git diff --check
  ```

  Expected: validator PASS with no duplicate top-level declarations, no credential findings, complete route/handler coverage and no missing HTML links; all Node tests PASS; `git diff --check` has no output. The existing ignored local `apps-script/.clasp.json` warning may remain and must not be staged.

- [ ] **Step 3: Run affected Apps Script test functions only through the local test harness.**

  Execute the repository’s documented Apps Script test command or focused Node VM equivalents for contract requests, landlord initiation, signing submission/review, artifact storage, tenant contract init and room-603 contract viewing. Capture stdout and test counts in the handoff; do not call clasp push, Apps Script deployment, Google Sheet migration, LINE push, or Pages publish.

- [ ] **Step 4: Review the final diff against the approved spec.**

  Verify: three-version append-only chain; full renewal money/payment/terms copy with landlord overrides; optional renewal identity docs with reference rows; new signature per version; 30-day waive versus under-30 landlord review; mid-term termination unchanged; history at the landlord detail page and tenant contract page; `房客合約 → 查看完整合約與簽名` remains available for room 603; old active version remains current until approval; cross-Workspace and conflicting approval are fail-closed.

- [ ] **Step 5: Confirm the clean handoff state after all checks pass.**

  ```bash
  git status --short --branch
  git log --oneline --decorate -12
  ```

  Expected: the worktree is clean and the implementation commits from Tasks 1–9 are present. The handoff must state that formal schema migration, Apps Script deployment, GitHub Pages publication, LINE/LIFF authenticated flow, Google Sheet data, and mobile acceptance remain `HUMAN_REQUIRED` until separately authorized and evidenced.

## Rollback boundary

- Revert the branch’s source/UI commits or deploy a previously approved artifact; never delete or rewrite contract, request, document, signature, or audit rows.
- A pending renewal can be cancelled/expired while the predecessor remains active. An approved renewal can only be rolled back by an explicitly authorized data/release procedure that preserves both versions and their audit links.
- If additive schema validation or a new response fails, leave any newly added headers and unactivated rows intact; do not clear Sheets or reuse a previous `contract_id`.
