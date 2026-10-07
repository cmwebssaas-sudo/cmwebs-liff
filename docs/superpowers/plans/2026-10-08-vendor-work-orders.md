# 合作廠商工單 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可在本機完整操作的多合作廠商工單切片，涵蓋合作對象、工種優先順位、固定價派工、報價核准、施工回報與房東驗收。

**Architecture:** 在獨立 `_dev/vendor-work-orders/` 建立只綁定 `127.0.0.1` 的 Node.js 開發 API，使用本機原子持久化儲存與合成測試身份；不接正式 Apps Script。新增獨立房東／廠商介面，所有狀態轉換、Workspace 範圍、競態與冪等檢查由 API 執行；通知先寫入本機收件匣，未來再由 adapter 接入獨立 staging LINE OA。

**Tech Stack:** Node.js ES modules 與內建 `node:http`、`node:crypto`、`node:fs`；原生 HTML/CSS/JavaScript；`node:test`。不新增第三方套件。

**Spec:** `docs/superpowers/specs/2026-10-07-vendor-work-orders-design.md`

**建議模型／速度：** gpt-5.6-terra、medium；領域切片介面相依，採多子代理逐任務實作與獨立審查。

## Global Constraints

- 此實作只在獨立本機開發環境執行；伺服器只能綁定 `127.0.0.1`，只使用合成資料，不接正式 Apps Script、正式 Sheets、正式 webhook 或真實 LINE。
- V2.0/V2.1 正式流程不變；不修改 V2 dispatcher、既有 API 路由、正式資料、Properties、排程或帳務。
- 所有租賃範圍資料以 `workspace_id` 隔離；每次讀寫都由伺服器端 session/membership 驗證，不信任前端傳入的角色或 Workspace。
- 頁面遵守既有固定 shell：`html, body` 高度 100% 並隱藏外層溢位；`.app-shell` 使用 `--app-height`；內容區獨立捲動並留出導覽列與 safe-area 空間。
- 合作對象可為公司或個人；公司可有多位成員；房東可為每個 Workspace／物件／工種設定順位及手動指定。
- 報價、核准、接單、施工、完工及驗收分開保存；每次狀態改變追加事件，金額以整數 TWD 保存。
- 供應商只讀取自己被邀請或承接的工單；不得取得其他廠商報價、房客身份／租約／帳務、銀行、押金或私有附件資料。
- 完工不等於驗收；超過已核准金額前必須取得追加核准；工單費用不觸發付款、押金扣款或帳單變更。
- 附件採本機非公開目錄及受權限檢查的下載 API；通知先保存到本機收件匣，不能含門鎖資料或房客個資。
- 不加入 V2 `Code.gs` route；日後任何 staging/API/LINE 上線都須先盤點隔離目標與取得明確範圍授權。
- 每項實作以測試先行；各階段完成 `npm run validate`、相關 `node --test`、完整 `npm test` 及 `git diff --check`。不得因本機測試通過而宣稱完成 staging 或 Production 驗收。

## Review Focus

- 竄改角色、Workspace 或工單 ID 的請求必須由 API 拒絕；由 Task 2、Task 3 API authorization tests 覆蓋。
- 兩家公司或兩名成員同時接受同一工作時，只能建立一個有效 assignment；由 Task 4 concurrency test 覆蓋。
- 報價待核准、邀請逾期、重複提交或網路結果不明時不可錯誤派工／重複收件；由 Task 4 transition/idempotency tests 覆蓋。
- 合成照片上傳和附件下載不得繞過 workspace、工單授權、格式或大小限制；由 Task 5 attachment tests 覆蓋。
- 完工照片／說明、超額費用、退回補修與驗收狀態必須一致且可讀回；由 Task 5 workflow tests 覆蓋。

---

## File Map

- Create: `_dev/vendor-work-orders/server.mjs` — loopback-only HTTP server、靜態頁提供、session middleware 與 API dispatcher。
- Create: `_dev/vendor-work-orders/domain.mjs` — partner/work order 狀態、授權規則、轉換、順位輪次與金額驗證。
- Create: `_dev/vendor-work-orders/store.mjs` — 本機 JSON 持久化、串行寫入、原子替換、初始化及隔離測試注入。
- Create: `_dev/vendor-work-orders/fixtures.mjs` — 明確標記的合成 Workspace、房間、公司、個人及測試成員。
- Create: `_dev/vendor-work-orders/README.md` — 啟動、測試身份、資料位置、清除本機測試資料及本機範圍限制。
- Create: `_dev/vendor-work-orders/public/index.html` — 本機房東合作對象／工單介面與廠商工作台容器。
- Create: `_dev/vendor-work-orders/public/app.js` — session、API client、表單、頁面狀態及安全 DOM rendering。
- Create: `_dev/vendor-work-orders/public/app.css` — 本功能獨立的手機優先樣式。
- Create: `_dev/vendor-work-orders/TEST-MATRIX.md` — 本機候選測試與尚待 staging／LINE 真機驗收項目。
- Create: `tests/vendor-work-orders-domain.test.mjs` — 狀態、順位、金額與事件測試。
- Create: `tests/vendor-work-orders-api.test.mjs` — loopback server、session、workspace isolation、API persistence/idempotency tests。
- Create: `tests/vendor-work-orders-ui.test.mjs` — UI rendering、操作與安全輸出 tests。
- Create: `tests/vendor-work-orders-attachments.test.mjs` — 本機附件 MIME/大小/權限/非公開路徑 tests。
- Modify: `.gitignore` — 只忽略 `.codex-local/vendor-work-orders/` 的本機狀態與私有附件。
- Modify: `.gitignore` — 只忽略 `.codex-local/vendor-work-orders/` 的本機狀態與私有附件。

## API and Domain Interfaces

- `createWorkOrderStore({ filePath })` exposes `readSnapshot()` and `transact(mutator)`; `transact` serializes writers and replaces the saved JSON atomically only after validation succeeds.
- Persisted state has `schema_version: 1`; default paths are `.codex-local/vendor-work-orders/state.json` and `.codex-local/vendor-work-orders/attachments/`. Tests always inject a fresh temporary directory.
- `transitionWorkOrder(state, actor, action, input, now)` returns `{ state, events, notifications }` or throws a stable domain error; it performs no I/O.
- `projectWorkOrderForActor(state, actor, workOrderId)` returns a landlord or vendor allowlisted projection; it never returns all raw rows to the browser.
- `createVendorWorkOrderServer({ host, port, dataFile, attachmentDir, clock })` binds only to `127.0.0.1` and exposes `start()`/`close()` for development and tests.
- `POST /api/dev/session` is available only in loopback development mode and accepts a fixture principal key; it returns an HttpOnly SameSite session cookie expiring in 8 hours. This route is absent from any future staging/production build.
- Successful API response is `{ success: true, data, request_id }`; rejected response is `{ success: false, code, message, request_id }`. Mutating work-order requests require `Idempotency-Key`.
- Work-order API actions: `GET/POST /api/work-orders`, `GET /api/work-orders/:id`, `POST /api/work-orders/:id/invitations`, `POST /api/invitations/:id/quote`, `POST /api/work-orders/:id/quote-approval`, `POST /api/assignments/:id/accept`, `POST /api/assignments/:id/completion`, `POST /api/work-orders/:id/acceptance`.
- Partner API actions: `GET/POST /api/partners`, `PATCH /api/partners/:id`, `PUT /api/priority-rules`, `GET/POST /api/service-agreements`.
- Notification readback: `GET /api/inbox`; work-order mutations append a deduplicated local inbox item in the same store transaction.
- Attachment API: `POST /api/work-orders/:id/attachments` and `GET /api/attachments/:id`; accept JPEG, PNG, WebP, or PDF up to 10 MiB per file; validate file signature; raw attachment bytes are never served from a static directory.

### Task 1: Define domain contract and synthetic development fixtures

**Files:**
- Create: `_dev/vendor-work-orders/domain.mjs`
- Create: `_dev/vendor-work-orders/fixtures.mjs`
- Create: `tests/vendor-work-orders-domain.test.mjs`

**Interfaces:**
- Produces: `createInitialState()`, `normalizeActor()`, `transitionWorkOrder()`, `projectWorkOrderForActor()`, `validatePartnerInput()`, `validateQuoteInput()`.
- Fixture principals include two landlords in different Workspaces, two companies, one individual worker, and multiple members under one company.

- [ ] **Step 1: Add failing domain tests** named `accepts_company_and_individual_partners`, `allows_multiple_members_without_cross_workspace_access`, `requires_quote_before_nonfixed_assignment`, `snapshots_fixed_price_agreement`, `completion_waits_for_landlord_acceptance`, `appends_actor_scoped_events`, and `rejects_negative_fractional_or_unsafe_twd_amounts`.
- [ ] **Step 2: Run `node --test tests/vendor-work-orders-domain.test.mjs`** and confirm tests fail because the domain module is absent.
- [ ] **Step 3: Implement the pure domain interfaces** with the exact function signatures above and stable statuses/errors from the spec. Keep IO, clock lookup, HTTP, and LINE concerns outside this module.
- [ ] **Step 4: Run the focused domain tests** and confirm the required transitions/projections pass.
- [ ] **Step 5: Commit** `feat: define isolated vendor work order domain`.

### Task 2: Add durable local store and loopback-only API foundation

**Files:**
- Create: `_dev/vendor-work-orders/store.mjs`
- Create: `_dev/vendor-work-orders/server.mjs`
- Create: `_dev/vendor-work-orders/README.md`
- Modify: `.gitignore`
- Create: `tests/vendor-work-orders-api.test.mjs`

**Interfaces:**
- Consumes: Task 1 state and projections.
- Produces: `createWorkOrderStore({ filePath })`, `createVendorWorkOrderServer(options)`, `requireSession(request)`, and fixture-only session creation.

- [ ] **Step 1: Add failing server tests** named `server_binds_to_loopback_only`, `dev_session_rejects_unknown_fixture`, `api_rejects_missing_session`, `store_reopens_persisted_snapshot`, and `failed_transaction_preserves_previous_snapshot`.
- [ ] **Step 2: Run the focused API tests** and verify the expected missing-module failures.
- [ ] **Step 3: Implement serialized atomic local persistence** with a unique temporary file beside the data file and rename only after a complete valid snapshot is written. Use a temporary directory in tests.
- [ ] **Step 4: Implement the server shell and fixture session** with an 8-hour HttpOnly, SameSite=Strict cookie; reject non-loopback Host/Origin and keep development session creation disabled unless started in explicit development mode.
- [ ] **Step 5: Serve only the named UI assets and API paths**; return JSON errors without stack traces or filesystem paths.
- [ ] **Step 6: Add only `.codex-local/vendor-work-orders/` to `.gitignore`** so the persistent data and private attachments cannot enter a commit.
- [ ] **Step 7: Run the focused API tests** and verify loopback, session, reopen/readback, and failed-write recovery.
- [ ] **Step 8: Commit** `feat: add isolated local work order api`.

### Task 3: Implement partner directory, service agreements, and priority rules

**Files:**
- Modify: `_dev/vendor-work-orders/domain.mjs`
- Modify: `_dev/vendor-work-orders/server.mjs`
- Modify: `_dev/vendor-work-orders/store.mjs`
- Extend: `tests/vendor-work-orders-domain.test.mjs`
- Extend: `tests/vendor-work-orders-api.test.mjs`

**Interfaces:**
- Consumes: Task 2 session/store functions.
- Produces: partner list/create/update, Workspace association, service area/skill, fixed-price agreement version, and priority-rule reads/writes.

- [ ] **Step 1: Add failing partner API tests** named `creates_company_and_individual_partner`, `scopes_member_permissions_to_active_membership`, `disabled_member_loses_access_but_events_remain`, `partner_list_is_workspace_scoped`, `priority_rank_is_unique_per_trade_scope`, and `agreement_edit_does_not_change_existing_price_snapshot`.
- [ ] **Step 2: Implement allowlisted partner projections and server-side membership checks**; never accept caller-supplied Workspace/role as authority.
- [ ] **Step 3: Implement partner and priority mutations as validated store transactions**; preserve event history and do not silently reorder existing sourcing rounds.
- [ ] **Step 4: Add failing tests** that update an agreement but prove an already-created work order's agreed amount/version remains unchanged.
- [ ] **Step 5: Run focused domain/API tests** and commit `feat: manage isolated work order partners and priorities`.

### Task 4: Implement invitations, quote approval, and one-winner assignment

**Files:**
- Modify: `_dev/vendor-work-orders/domain.mjs`
- Modify: `_dev/vendor-work-orders/server.mjs`
- Modify: `_dev/vendor-work-orders/store.mjs`
- Extend: `tests/vendor-work-orders-domain.test.mjs`
- Extend: `tests/vendor-work-orders-api.test.mjs`

**Interfaces:**
- Consumes: Task 3 partners, ranked rules, agreement snapshots.
- Produces: the work-order actions listed under “API and Domain Interfaces”, sequential invitation rounds, quote revisions, approvals, assignments and notification inbox entries.

- [ ] **Step 1: Add failing transition tests** named `fixed_price_dispatch_requires_explicit_landlord_action` and `quote_requires_landlord_approval_before_assignment`.
- [ ] **Step 2: Add failing tests** named `invites_first_rank_before_second`, `decline_or_24_hour_timeout_advances_rank`, `valid_quote_pauses_rank_escalation`, `manual_override_records_actor`, `parallel_quote_round_requires_explicit_choice`, and `expired_invitation_cannot_be_accepted`.
- [ ] **Step 3: Add race/idempotency tests** named `only_one_concurrent_acceptance_creates_assignment`, `same_idempotency_key_creates_one_event_and_inbox_item`, and `ambiguous_action_is_resolved_by_readback`.
- [ ] **Step 4: Implement deadline processing** using an injected clock, a due-invitation sweep at server start and a 60-second timer while running; `start()` starts it and `close()` clears it. Each expiry advances one ranked round transactionally and stops if a valid quote is awaiting the landlord.
- [ ] **Step 5: Implement invitation/quote/assignment APIs** using a store transaction that rechecks Workspace, membership, current status, version, deadline, and idempotency key before commit.
- [ ] **Step 6: Implement the local notification inbox** in the same transaction as the state event; use neutral text and never include tenant identity, private location instructions, or attachments.
- [ ] **Step 7: Run focused domain/API tests** and commit `feat: add work order sourcing and quote approval`.

### Task 5: Implement work execution, acceptance, and private local attachments

**Files:**
- Modify: `_dev/vendor-work-orders/domain.mjs`
- Modify: `_dev/vendor-work-orders/server.mjs`
- Create: `tests/vendor-work-orders-attachments.test.mjs`
- Extend: `tests/vendor-work-orders-domain.test.mjs`
- Extend: `tests/vendor-work-orders-api.test.mjs`

**Interfaces:**
- Consumes: Task 4 assignment and quote state.
- Produces: completion submission, accept/rework decision, approved supplement, and attachment metadata/read authorization.

- [ ] **Step 1: Add failing workflow tests** named `completion_enters_awaiting_acceptance`, `landlord_acceptance_completes_order`, `landlord_rework_returns_order_to_progress`, and `completion_never_auto_closes_order`.
- [ ] **Step 2: Add failing cost tests** named `over_budget_completion_requires_approved_supplement` and `costs_are_safe_integer_twd`.
- [ ] **Step 3: Add failing attachment tests** named `accepts_only_jpeg_png_webp_or_pdf_within_10_mib`, `rejects_content_type_signature_mismatch`, `rejects_path_traversal`, `rejects_cross_workspace_attachment_access`, and `rejects_vendor_without_assignment`.
- [ ] **Step 4: Implement private attachment storage** outside the static root using random IDs and authorized streaming endpoints; keep only safe metadata in the main JSON store and audit each access.
- [ ] **Step 5: Implement completion and acceptance transitions** with version checks, append-only actor/time events, and local inbox readback.
- [ ] **Step 6: Run focused tests** and commit `feat: add work order completion and acceptance`.

### Task 6: Build landlord and partner mobile-first workspaces

**Files:**
- Create: `_dev/vendor-work-orders/public/index.html`
- Create: `_dev/vendor-work-orders/public/app.js`
- Create: `_dev/vendor-work-orders/public/app.css`
- Create: `tests/vendor-work-orders-ui.test.mjs`

**Interfaces:**
- Consumes: Tasks 2–5 API response projections.
- Produces: role-aware local workflow for landlord and partner test principals; client code only renders the server-authorized projection.

- [ ] **Step 1: Add failing UI tests** named `renders_partner_setup_and_ranked_services`, `landlord_can_create_quote_and_fixed_price_jobs`, `landlord_can_compare_approve_and_accept_work`, `vendor_can_quote_accept_and_report_completion`, and `rework_reason_is_visible_to_assigned_vendor`.
- [ ] **Step 2: Add failing UI tests** named `escapes_user_supplied_text`, `vendor_view_uses_allowlisted_projection_only`, `api_response_does_not_include_other_vendor_quotes`, and `page_uses_fixed_app_shell_and_visual_viewport_height`.
- [ ] **Step 3: Implement session bootstrap and API client in `_dev/vendor-work-orders/public/app.js`**; all actions show the server-returned persisted status and recover by reading the current record after an uncertain response.
- [ ] **Step 4: Implement landlord and partner views** with mobile-first cards and clear pending/quoted/approved/assigned/in-progress/awaiting-acceptance/completed labels.
- [ ] **Step 5: Implement accessible input, keyboard-safe forms, attachment progress, and visible success/error feedback** without embedding API secrets or tokens.
- [ ] **Step 6: Run UI tests and local manual smoke test** with the synthetic landlord/company/member fixtures; commit `feat: add isolated vendor work order workspace`.

### Task 7: Record validation limits and run regression checks

**Files:**
- Create: `_dev/vendor-work-orders/TEST-MATRIX.md`
- Modify: `_dev/vendor-work-orders/README.md`

- [ ] **Step 1: Record test matrix cases** for roles, cross-Workspace privacy, quote/rank workflow, race/idempotency, attachments, completion/rework, and explicitly label staging LINE/device checks `NOT RUN`.
- [ ] **Step 2: Document local start/stop and demo data recovery**; do not provide a production URL or describe local fixture identity as real LINE login.
- [ ] **Step 3: Run** `npm run validate`, `node --test tests/vendor-work-orders-*.test.mjs`, `npm test`, and `git diff --check`; report exact counts and any skipped real-device/staging checks.
- [ ] **Step 4: Review the full branch diff** for V2 dispatcher/Production API/production data changes, secrets, static exposure of attachments, missing authorization checks, and unused version-suffix files.
- [ ] **Step 5: Commit** `test: record vendor work order isolation and acceptance matrix`.

## Delivery Gate

This plan produces a local, persistent functional slice for review. All feature files live under `_dev/`, which GitHub Pages excludes by its default Jekyll rules; it does not create a real LINE binding, separate staging project, remote partner login, Production API, or published entry. After local review, a separate implementation plan and explicit target confirmation are required to bind an isolated staging backend and test OA; Production release is a separate authorization gate.
