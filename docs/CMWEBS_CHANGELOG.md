# CMWebs Changelog

**Status: AUTHORITATIVE product-memory changelog**

## 2026-09-04 — 紙本補登手機驗證輪詢修正正式部署

- 修正手機 LIFF 開啟紙本補登頁時，因 Apps Script 302 轉址被誤判而顯示
  「房東身分驗證連線失敗」的問題；驗證狀態與續約狀態改用不帶 LINE UID 的
  JSONP 兼容通道。
- 前端 commit `884a066`、release marker
  `20260904-paper-contract-backfill-mobile-auth-v1` 已發布；GitHub Pages
  workflow `33801519730` 成功完成，公開頁 read-back HTTP 200。
- Apps Script Version 153 未變更，Version 152 保留 rollback；本次未改動
  Sheet、房客／合約資料、Drive、Properties、Trigger 或 LINE。手機／LIFF 真機
  驗證仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-03 — 紙本補登入口修正正式部署

- 修正房間仍顯示「已出租／租約中」、但有效合約已找不到對應房客資料時，
  物件／房間頁不顯示紙本補登入口的問題。
- 新增受控的孤兒合約資料修復路徑：只有同 Workspace、無對應房客且無 LINE
  綁定時才可進入；原合約保留並標記取消，新紙本租約以
  `previous_contract_id` 連結，不建立電子邀請或發送 LINE。
- PR #100 已合併至 `main`，merge commit 為 `c04ba24`。Apps Script Version 152
  已更新 Pages 所用的既有 Web App deployment，Version 151 保留 rollback，既有
  Web App URL 不變。
- GitHub Pages workflow `33694799930` 已成功完成，公開頁 read-back HTTP 200
  並確認孤兒補登入口、`orphan_recovery` 參數與紙本補登說明。
- Phase 209 runtime、Phase 214 runtime／UI、validator、Apps Script syntax
  check 與完整 Node `83/83` 均通過。未執行 Production Sheet、Drive、LINE 或
  房客資料交易；手機／LIFF 真機 UAT 仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-03 — 202 紙本轉換與房客登入入口正式部署

- PR #98 已合併至 `main`，merge commit 為 `4b9ed04`。房東可從物件／房間頁
  將同房間、同房客且尚未被認領的房東電子草稿轉為紙本補登；原電子合約與
  待認領邀請保留並標記取消，新紙本合約以 `previous_contract_id` 留下關聯。
- Apps Script Version 151 已更新 Pages 所用的既有 Web App deployment，Version
  150 保留 rollback，既有 Web App URL 不變。GitHub Pages workflow
  `33691996413` 已成功完成，公開頁 read-back 通過。
- 既有待認領房客／使用者會啟用為未綁定狀態，補登完成頁提供房客 LIFF 登入
  入口，房東可複製傳給房客；不自動發送 LINE 或建立電子邀請。未執行
  Production 資料交易；手機／LIFF 真機 UAT 仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-03 — 房東手動補登紙本合約正式部署

- PR #96 已合併至 `main`，merge commit 為 `b36ec4b`。新增房東專用
  `landlord_contract_paper_backfill` JSON POST：紙本合約檔案必填，身分證正反面
  可選填並可後補；直接建立有效／待開始租約，不建立合約申請、電子邀請、確認碼
  或 LINE 訊息。
- 物件／房間頁的空房與房客詳細資料均可進入補登頁；既有房客資料會帶入，
  新房客則建立未綁定的系統資料。伺服器以 Workspace/RBAC、房間占用、租期
  重疊、檔案驗證與冪等鍵保護寫入，紙本文件走私有 Drive 路徑。
- Apps Script Version 150 已更新既有 Web App deployment，Version 149 保留
  rollback，既有 Web App URL 不變。Additive migration 已完成，Production
  `V2_contracts` header read-back 確認兩個 `paper_backfill_*` 欄位存在，沒有變更
  合約資料列。
- Legacy Pages build `1190728482` 已完成，公開頁面 HTTP 200 並確認補登入口、
  `landlord_contract_paper_backfill` 與 cache key
  `20260903-paper-contract-backfill-v1`。
- Phase 209 runtime、Phase 210 UI、Phase 211 文件測試與 Phase 212 migration
  test 在隔離 worktree 通過。未執行 Drive 文件上傳、租客交易、Properties／Trigger
  變更或 LINE 訊息；正式手機／LIFF／Drive 驗證仍為 `HUMAN_REQUIRED` /
  `UNVERIFIED`。

## 2026-09-03 — 房東簡易新租約正式部署

- PR #94 已合併至 `main`，merge commit 為 `6302b25`；房客名單新增房東
  「建立簡易新租約」入口，簡易表單只需房號、租金、押金、起始日與租期月數。
- Apps Script Version 149 已更新既有 Web App deployment，Version 148 保留
  rollback，既有 Web App URL 不變。結束日由伺服器依租期計算，房間／Workspace
  預設費用與付款條件會補入；房客後續仍走證件上傳與簽署流程。
- GitHub Pages workflow `33656914943` 已成功發布，公開頁 read-back HTTP 200；
  cache key 為 `20260903-simple-new-lease-v1`。
- 本次沒有新增 Sheet schema、migration、既有資料寫入、Drive、Properties、
  Trigger 或 LINE 操作；本地 Node `77/77`、validator `83/83`、duplicate／
  credential scan 與 link check 全部通過。正式 LIFF／手機建立與簽署仍為
  `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-02 — 房東手動退房結算正式部署

- PR #92 已將房東手動退房結算與 Google Sheets Date 日期正規化合併到
  `main`，merge commit 為 `a2682b3`。
- Apps Script 已推送 52 個檔案，既有 Web App deployment 更新至 immutable
  Version 148；Version 147 保留為 rollback，既有 Web App URL 不變。
- 已在正式 Apps Script 編輯器完成增量 migration；試算表已建立
  `V2_checkout_settlements` 並寫入結算欄位，資料列維持空白，未改動既有
  合約、房客、帳單、Drive、Properties、Triggers 或 LINE 資料。
- GitHub Pages workflow `33648496168` 的 build、deploy、status 全部成功；
  公開頁面 read-back HTTP 200，已確認退房結算、電表起訖、兩張照片、押金
  扣除與應補繳／押金應退欄位，以及 cache key
  `20260902-landlord-checkout-settlement-v1`。
- 版本凍結驗證：Node `76/76` 通過、正式 validator `83/83` routes／handlers
  通過、duplicate declarations `0`、credential findings `0`、
  `git diff --check` 通過；`npm run validate` 因 isolated worktree 無
  `package.json` 不適用。
- 已登入 LIFF、Drive 私有上傳與 502／506 真實退房交易仍為
  `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-02 — 房東手動退房結算本地候選版（已正式部署）

- 房東手動退房新增伺服器結算：結算期間從當月 9/1 到實際退房日，含退房日；例如 9/1–9/7 為 7 天。
- 上月只帶入未繳電費與設備使用費，不重複計算上月房租；本期房租按當月日曆天數比例計算，本期電費／設備使用費按起始與退房日電表差額計算。
- 新增 append-only `V2_checkout_settlements` 快照、押金扣除說明、應補繳與押金應退；原合約與既有 `V2_bills` 不覆寫。
- 退房完成前必須透過房東驗證 session 上傳同一合約的 `checkout_start_meter` 與 `checkout_end_meter` 私有 JPG/PNG 電表照片；缺少結算或照片時 fail closed。
- 本地候選分支為 `codex/checkout-settlement-20260902`，候選程式切片 commits 為 `7285a82`、`c20c6b1`、`a472d2d`、`eec1689`、`f5d1e98`、`f7fa4ca`；另補強 Google Sheets Date 型態月份正規化、作廢帳單排除及 Workspace／月份費率回退；以上為候選階段紀錄，正式部署證據見上節。
- 另修正退房初始化與日期驗證對 Google Sheets Date 型態的處理，將原合約起始／結束日統一轉為 `YYYY-MM-DD`，避免畫面出現完整 Date 字串而被判定為無效日期。
- Phase 202／205／206／207 本地測試通過；已登入 LIFF、Drive 私有上傳、正式 Sheet schema 與真機流程仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-02 — 房東主導續約與退房正式部署

- Implemented the approved landlord-led state machine: landlord review
  automatically asks the tenant; tenant acceptance automatically creates one
  signing invite and sends its URL/code through LINE; tenant decline records a
  `tenant_declined` checkout-pending state.
- Added landlord-only checkout from the tenant detail journey. Completion is
  Workspace/session protected and idempotent, clears room/tenant/view current
  pointers, preserves original contract dates/content and operational records,
  and does not send a tenant LINE message.
- Added additive checkout fields and preserved legacy backend actions for old
  clients. Tenant renewal/termination pages no longer expose a new application
  submit flow; historical request data remains readable.
- PR #90 merged the release into GitHub `main` as `3d8647d`. Apps Script
  immutable Version 147 now serves the existing Web App deployment, with
  Version 139 retained as rollback; the Web App URL was preserved.
- The additive-only renewal/checkout schema migration completed in the
  authenticated Apps Script editor. No contract or tenant rows, Properties,
  triggers, or LINE data were changed.
- GitHub Pages workflow `33567151637` completed successfully. Public readback
  returned HTTP 200 for the six changed/release pages and confirmed cache key
  `20260902-landlord-led-renewal-checkout-v1`, checkout entry, automatic
  renewal copy, and passive tenant pages.
- Local validator and full Node suite passed (`83/83` routes and handlers;
  `73/73` tests). Authenticated LINE/mobile renewal, signing, and checkout UAT
  remain `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-02 — Expired tenant renewal recovery (formal corrective release)

- Fixed the Workspace-native landlord tenant list so an operational tenant is
  still visible when the latest contract expired before a renewal draft was
  created. The expired contract remains read-only and can be used as the
  predecessor for the manual renewal entry.
- Phase 201 covers the expired-tenant recovery boundary and confirms that a
  future active contract does not use the recovery fallback.
- PR #88 merged the repair into GitHub `main` as `272f675c`. Apps Script was
  pushed as 51 files and the existing production Web App deployment now
  serves immutable Version 146. Version 139 remains the rollback target. No
  Sheet row, contract status, Property, Trigger, LINE setting or LINE message
  was changed.
- GitHub Pages was not changed because the tenant-detail renewal entry was
  already present in the current public frontend; its authenticated readback
  remains separate from this backend release.
- Local verification passed: worktree validation with the authoritative 83
  route inventory, full Node suite `70/70`, Apps Script syntax checks and
  `git diff --check`. The outer `npm run validate` package still carries the
  stale expected-route value `71` and was not used as the release gate.
- Authenticated 502 landlord-list/detail readback and LINE/mobile renewal UAT
  remain `HUMAN_REQUIRED`. If the canonical tenant, room or contract rows are
  absent rather than merely hidden by the expired-contract filter, a separate
  data-recovery operation still requires exact target verification.

## 2026-09-02 — Preserve predecessor fees in renewal prefill (formal corrective release)

- Fixed the `從此合約發起續約` room-warning action so the renewal form keeps
  the predecessor rent, management fee, deposit months, deposit amount,
  payment day, electricity fee rate, equipment loss fee rate, optional 30-day
  clause, and note.
- The backend room summary now includes the predecessor contract's fee fields;
  the frontend also prefers the complete `renewal_source` before that summary.
  This fixes the case where the form switched to renewal mode but displayed
  blank or zero fee inputs.
- PR #86 merged the fix into GitHub `main` as `72542bc`. Apps Script immutable
  Version 145 now serves the existing Web App deployment, with Version 139
  retained as rollback. No Sheet, contract row, Property, Trigger, LINE
  setting, or manual migration was changed.
- GitHub Pages workflow `33555883954` completed successfully. Public readback
  returned HTTP 200 and confirmed cache key
  `20260902-renewal-date-prefill-v2` and the fee-prefill logic.
- Local verification passed: full Node suite `69/69`, project validation
  `71/71` routes and handlers, Apps Script syntax checks, and `git diff --check`.
- Authenticated LINE/mobile contract acceptance remains `HUMAN_REQUIRED`.

## 2026-09-02 — Renewal date prefill (formal release)

- Changed renewal defaults so the new lease starts on the predecessor contract
  end date itself, then runs for one year using the existing inclusive date
  rule (`start date + one year - one day`).
- Updated the renewal form to use the same date rule when it applies the old
  contract snapshot, removing the extra one-day offset. Other renewal fields
  and manual date editing remain unchanged.
- Phase 174 and new Phase 200 cover the backend default and renewal-form
  prefill. PR #83 merged the release into GitHub `main` as `52d4175`.
- Apps Script was pushed as 51 source files and the existing public Web App
  deployment was updated to immutable Version 144. The Web App URL was
  preserved and Version 139 remains the rollback target. No Script Properties,
  Trigger, LINE setting, contract row, or manual Sheet migration was changed.
- GitHub Pages workflow `33553714995` completed build, deploy and status jobs.
  Public readback returned HTTP 200 and confirmed cache key
  `20260902-renewal-date-prefill-v1`, the direct renewal entry, and the
  predecessor-end-date prefill logic.
- Local verification passed: full Node suite `69/69`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, Apps Script syntax checks, and `git diff --check`.
- Exact production Sheet header state and authenticated LINE/mobile contract
  acceptance remain `HUMAN_REQUIRED`.

## 2026-09-02 — Tenant-detail direct renewal signing (formal release)

- Moved the primary renewal entry to the tenant journey: tenant list → tenant
  detail → contract version → `發起續約`. Each eligible predecessor version
  passes its own `contract_id` into the one-page renewal form, while the
  contract request page remains focused on draft review, invitation and
  signing status handling.
- Added `landlord_contract_initiate_renewal_direct` for the short manual path:
  the landlord fills one renewal form, optionally selects the 30-calendar-day
  non-renewal clause, and receives a tenant signing invite immediately.
- Active, expired, approved and completed predecessors are eligible. The old
  contract remains append-only and is archived only after the tenant signs and
  the landlord approves the new version.
- Reused the fixed Google Docs contract version (`fixed-google-doc-template-1`)
  and added the renewal fields to the additive contract-schema guard so the
  selected clause is persisted and shown in the tenant document.
- The tenant invite flow now preserves `renewal` mode and requires signature
  only; the existing multi-step landlord-review/tenant-inquiry route remains
  available for already-created renewal drafts.
- PR #81 merged the release into GitHub `main` as `938b39d`.
- Apps Script was pushed as 51 source files and the existing public Web App
  deployment was updated to immutable Version 143. The Web App URL was
  preserved and Version 139 remains the rollback target. No Script Properties,
  Trigger, LINE setting, or contract row was changed; no manual Sheet
  migration was run. The deployed code keeps the additive header guard for the
  new renewal fields.
- GitHub Pages workflow `33547890200` completed build, deploy and status jobs
  for the merged commit. Public readback returned HTTP 200 for the tenant
  detail, renewal form, request review page and release asset; the new entry,
  direct route, special-offer clause and new release key were present.
- Local verification passed: full Node suite `68/68`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, Apps Script syntax checks, and `git diff --check`.
- Exact production Sheet header state and authenticated LINE/mobile signing
  acceptance remain `HUMAN_REQUIRED`; public readback and the anonymous
  POST-only API guard do not prove a logged-in contract transaction.

## 2026-09-01 — Landlord homepage timeout corrective release

- Reused the request-local runtime snapshot in landlord payment/message reads,
  removing duplicate Google Sheets reads during `landlord_home_bootstrap`.
- Added Phase 197 regression coverage for the read-cache boundary. No contract,
  billing, Sheet row, Property, Trigger, or LINE data was changed.
- PR #79 merged the repair as `d9c371c`; Apps Script immutable Version 142 now
  serves the existing fixed Web App deployment and Pages workflow
  `33483720012` completed successfully.
- Public page/API readback passed. Authenticated LINE/mobile dashboard UAT
  remains `HUMAN_REQUIRED`.

## 2026-09-01 — Landlord-led renewal consent flow (formal release)

- Changed expiry renewals to a landlord-led sequence: the system prepares a
  one-year draft from the prior contract, the landlord reviews dates, amounts,
  payment day and the optional 30-day non-renewal offer, then sends a tenant
  inquiry.
- Tenants can no longer submit a renewal through the legacy request route. They
  can only accept or decline a reviewed landlord inquiry; only an accepted
  response enables the landlord to create the signing invitation.
- Added additive lifecycle columns for inquiry and tenant intent. Existing
  contract versions remain append-only, and the unsigned draft remains editable
  until review confirmation.
- PR #76 merged the feature as `52b75b8`; PR #77 moved the 36 production HTML
  API references to the new fixed Apps Script Version 140 deployment and
  merged as `ceeede8`. Pages workflow `33456765735` completed successfully.
- Public HTML and read-only API smoke passed. No Sheet migration, LINE push,
  or contract-data write was run; authenticated LINE/mobile UAT remains
  `HUMAN_REQUIRED`.

## 2026-09-01 — Renewal draft date correction (formal release)

- Added `landlord_contract_renewal_draft_update`, a Workspace-scoped POST
  action that permits a landlord to change only the start and end dates of an
  unsigned `pending_landlord_review` renewal draft.
- The server validates strict ISO dates, regenerates the complete contract
  text, and keeps the predecessor unchanged. After an invite is created, the
  draft cannot be overwritten; a new correction renewal version is required.
- Added the landlord review-page `修改續約日期` action and guidance for
  manual-signing date errors: cancel an unclaimed invite and recreate it, or
  start a new correction renewal for an already signed contract.
- PR #74 merged the change into `main` as `3f6af936`. Apps Script Version 139
  was deployed on the existing Web App deployment, with Version 138 retained
  as rollback. GitHub Pages workflow `33449180375` completed successfully.
- Local suite `64/64` and project validation passed. Public routing/page
  readback passed. Real authenticated LINE/mobile date-edit acceptance remains
  `HUMAN_REQUIRED`; no contract data was changed by this release.

## 2026-08-28 — Native landlord contract-history route repair (formal corrective release)

- Fixed the Workspace-native `landlord_tenants` read model used by the serving
  dispatcher so it returns the same sanitized, read-only `contract_history` as
  the legacy landlord tenant-list handler.
- This restores the existing room-603 contract entry without recreating,
  deleting, or modifying `V2_contracts` rows. Phase 177 reproduces the serving
  route and preserves the append-only history projection.
- PR #59 merged the route repair into `main`; PRs #60–#62 completed the
  landlord tenant-detail history-card rendering helpers. Apps Script Version
  131 was deployed on the existing Web App deployment, preserving the existing
  Web App URL. No schema or tenant-data migration was run for this repair.
- GitHub Pages workflow `33099332347` completed successfully for merged
  `main` commit `7711dea`. Public room-603 smoke readback rendered the history
  card and `查看完整合約與簽名`, with no page error card or browser console
  errors. Real authenticated LINE/mobile signing acceptance remains
  `HUMAN_REQUIRED`.

## 2026-08-27 — Renewal contract history and 30-day offer (formal release)

- Added append-only renewal versions for existing tenants. Each renewal gets a
  new contract ID and links to its predecessor while retaining all prior
  contract snapshots and document/signature references.
- Renewal defaults carry rent, management fee, deposit, other fixed fees,
  payment day, terms, and a one-year period from the day after expiry. Renewal
  identity uploads are optional and reuse existing immutable document
  references when omitted; a new renewal signature remains required.
- Added the 30-calendar-day expiry non-renewal offer. Meeting the threshold
  waives the penalty; a shorter notice is routed to landlord review without an
  automatic charge or waiver. Early termination remains unchanged.
- Added landlord and tenant contract-history UI. The landlord's selected
  version can load a complete contract/signature view in read-only mode.
- Added the explicit additive-only `runV2ContractRenewalHistoryProductionMigration`
  runner. It appends only missing renewal/request/document headers and is
  idempotent; it does not delete or rewrite historical contracts.
- Apps Script was deployed as immutable Version 130 on the existing Web App
  deployment; the existing Web App URL was preserved. The additive schema
  migration was executed twice from the authenticated Apps Script editor and
  both executions completed successfully, proving the runner is idempotent.
- GitHub PR #56 merged the release into `main` as `7452416`. GitHub Pages
  workflow `33054940344` completed build, deploy, and status-report jobs, and
  public readback found the landlord contract-history entry and
  `查看完整合約與簽名`.
- Local Phase 174–176 tests and the full Node suite pass (`55 pass, 0 fail`);
  the candidate validator passes all `83/83` routes and handlers with zero
  duplicate declarations and zero credential findings.
- Authenticated real LINE/mobile room-603 UAT remains `HUMAN_REQUIRED` and is
  not implied by this release.

## 2026-08-25 — Deploy fixed-template tenant signature preview

- Deployed the fixed Google Docs template signing path to Apps Script Version
  125 on the existing Web App deployment. The signed copy remains private and
  the original fixed template is unchanged.
- The tenant mobile preview now renders the stored handwritten signature image
  after submission, while the backend continues to source it from the private
  stored artifact and signed document record.
- Bumped the tenant entry release asset and added versioned script URLs to bust
  stale LIFF/Pages caches. GitHub Pages workflow `32793428257` completed
  successfully for commit `9e18425`.
- Local tests and public static readback passed. Authenticated real LINE/mobile
  room-603 acceptance remains unverified and is not implied by this release.

## 2026-08-25 — Restore supplied Google Docs fixed contract template (local candidate)

- Replaced the generated standard-contract fallback in the tenant signing
  preview and landlord review view with the configured fixed Google Docs
  template and canonical placeholder substitution.
- Submission now copies the fixed document, supports the supplied text-based
  `乙方簽名（線上簽署）` slot as well as an image slot, promotes the supplied
  pending-signature evidence, and records the signed copy in the document
  signing schema.
- Phase 168 and the full local suite pass. This remains a local candidate; no
  Apps Script deployment, Script Properties update, Drive-folder migration,
  GitHub Pages publication, or real LINE/mobile acceptance occurred.

## 2026-08-16 — Landlord-initiated new lease and renewal signing (local candidate)

- Added the approved landlord-first contract flow in an isolated local branch:
  new vacant-room contracts may start with blank tenant prefill data, while
  renewals are started from the current active contract and link a new version
  to its predecessor.
- Added one-time invite claiming with LINE identity verification, tenant name
  and Taiwan mobile completion, private identity-artifact requirements for new
  tenants, signature-only renewal signing, and landlord-only approval as the
  activation boundary.
- Added landlord and tenant mobile UI entry points, short POST/JSONP exchanges,
  ScriptLock-protected writes, activation view synchronization, and focused
  Phase 157–159 regression tests.
- This is a local implementation candidate only. No Apps Script deployment,
  GitHub Pages publication, Production Spreadsheet/Properties/trigger change,
  LINE/LIFF configuration change, or real message send occurred.

## 2026-08-13 — Payment write timeout recovery (local candidate)

- Added client-side authoritative-state recovery for landlord payment-report
  confirmation and manual bill settlement when the write JSONP response times
  out after the backend may already have committed the Sheet changes.
- Recovery never resubmits the write; it confirms `confirmed` payment reports or
  settled/removed arrears records before showing success.
- Phase 147 covers the recovery paths. This candidate was not deployed or
  verified against Production.

## 2026-08-12 — Phase 147 tenant identity release and Production identity check

- PR #23 merged the Phase 147 tenant test-identity migration into GitHub
  `main` as `0bbbe06e`.
- GitHub Pages workflow `31601674513` completed successfully; the four tenant
  pages were fetched from the public Pages origin and retained formal LIFF
  initialization and the Phase 146 payment gateway.
- A read-only Apps Script check identified the authenticated project and active
  Web App Version 102. The file inventory matched GitHub `main` by normalized
  filename count only; no byte-level source export or rollback identification
  was performed.
- No Apps Script, Sheets, Properties, triggers, LINE, LIFF configuration, or
  payment data was changed by this release.

## 2026-07-30 — Version 87 source reconciliation closed

- PR #6 merged the retained legacy signed-contract sync bridge and its focused
  regression test into GitHub `main` as `ae2961d`.
- A minimal final comparison found current `main` source-equivalent to the
  immutable serving Version 87 export: the remaining reminder difference is
  comment/format only and `appsscript.json` is semantically equivalent JSON.
- `GATE_0=PASS` is restored for current serving-source reconciliation and
  `V2_INTERNAL_BETA_BASELINE=Version87` is recorded.
- No Apps Script deployment, GitHub Pages publication, Production data or
  configuration change, LINE/LIFF change, or manual message send occurred.

## 2026-07-30 — Serving Version 87 source-reconciliation hold

- Read-only deployment metadata and immutable source export verified that the
  serving Apps Script release is Version 87, with Version 85 retained as its
  rollback reference.
- Focused source reconciliation confirmed that four previously flagged files
  are byte-identical to `main`; the remaining reminder and manifest changes
  are non-executing comments, whitespace, and JSON key order.
- `GATE_0=PASS` for Production Consolidation. This records source-equivalence
  only; it does not authorize an Apps Script deployment, GitHub Pages
  publication, Production data or configuration change, LINE/LIFF change, or
  manual message send.

## 2026-07-29 — Unpublished V2.1 native signing foundation

- Added verified LIFF signing-session and private contract-artifact foundations
  to an isolated local branch only; no Apps Script deployment or Production
  data/configuration action occurred.
- Server-side principal resolution and backend-derived `signing_mode` control
  the permitted artifacts. Normal renewal is signature-only; missing mode or
  missing artifact schema fail closed.
- Added a server-verified signing-submission action. It requires consent and
  the mode-specific stored artifacts, records only explicit signing-audit
  fields, preserves `contract_status`, and fails closed without the required
  schema. It does not simulate approval, activation, or completed contract
  status.
- Added the corresponding isolated local `tenant-contract.html` signing UI:
  server-derived summary and terms, conditional new-tenant identity uploads,
  signature capture, consent, and submitted-for-review state. Renewal renders
  no identity upload flow. No frontend publication or Production action
  occurred.

## 2026-07-29 — Gate 0 canonical baseline formalization

- GitHub PR #3 merged the immutable Apps Script Version 85 source snapshot,
  manifest, and API route inventory into `main`.
- Version 85 is recorded as the V2 internal-beta canonical backend baseline;
  Version 75 is the verified immutable Apps Script rollback reference.
- Production evidence was collected read-only: serving deployment identity,
  Properties key presence, trigger inventory, and Google Sheets schema headers.
- No deployment, GitHub Pages publication, Production data change, trigger
  change, Property change, LINE/LIFF change, or manual message send occurred.

## 2026-07-29 — Product-memory consolidation

- Recorded authoritative V2/V3/V4 boundaries, BYO LINE OA ownership, standard
  branding, no functional customization, and the V2 performance priorities.
- Added a new-conversation handoff contract and release-safety rules.
