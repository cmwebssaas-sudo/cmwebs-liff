# CMWebs Current State

**Status: AUTHORITATIVE current-state record**
**Last verified: 2026-09-03 (Asia/Taipei)**

This record distinguishes verified source reconciliation from live Production
state. It is not deployment authority. Re-verify the relevant target, account,
version, rollback, and runtime state before every Production action.

## 2026-09-03 202 紙本轉換本地候選修正（未部署）

- Candidate branch `codex/202-paper-contract-login-20260903` adds a guarded
  `supersede_contract_id` path for a matching, unclaimed landlord-initiated
  electronic contract. It keeps the original contract and invite rows for
  audit, marks them cancelled, appends the paper contract with
  `previous_contract_id`, and activates the pending tenant account as
  `unbound`.
- The property／room page now exposes the conversion entry for this exact
  pending-electronic case and carries the tenant／contract context into the
  paper form. The completed page exposes the existing tenant LIFF URL so the
  landlord can send a login-binding entry without sending a LINE message.
- Local Phase 209, Phase 210, Phase 211, Phase 212 and Phase 213 tests pass;
  Apps Script syntax checks pass. This candidate has not changed Production
  Sheets, Drive, Properties, Triggers, LINE, Apps Script deployment or Pages.
  Authenticated mobile／LIFF and Production 202 data verification remain
  `HUMAN_REQUIRED` / `UNVERIFIED` until separately authorized and performed.

## 2026-09-03 landlord paper-contract backfill formal release

- PR #96 merged the landlord-only paper contract backfill flow into GitHub
  `main` as merge commit `b36ec4b`. The required signed paper contract file is
  stored privately; identity front/back files are optional and can be added
  later.
- The flow directly creates an active or upcoming append-only contract after
  server-side Workspace/RBAC, room vacancy, tenant scope, date, amount, file,
  and idempotency checks. It does not create `V2_contract_requests`, an
  electronic invite, a confirmation code, a signing session, or a LINE message.
- Empty-room entry is available from the property/room page; existing-tenant
  entry is available from tenant detail. The create page returns a paper-specific
  success state and never falls through to the electronic-invite success UI.
- Apps Script source was pushed as 53 files, immutable Version 150 was created,
  and the existing Web App deployment was updated from Version 149 to Version
  150; the Web App URL was preserved and Version 149 remains the rollback point.
- The additive migration completed in the authenticated Apps Script editor.
  Read-only Production Spreadsheet verification found the two
  `paper_backfill_*` headers appended to the existing `V2_contracts` header row;
  no contract rows were changed and no sheet was created.
- Legacy GitHub Pages build `1190728482` completed for `b36ec4b`. Public
  readback returned HTTP 200 for the release asset, landlord properties, tenant
  detail, paper-backfill create page, and tenant pages, and confirmed the
  `landlord_contract_paper_backfill` action, `手動補登紙本合約` entry, and cache
  key `20260903-paper-contract-backfill-v1`.
- Local Phase 209 runtime, Phase 210 UI, Phase 211 documentation, and Phase 212
  additive-migration tests passed, together with all Apps Script syntax checks.
  No Drive document upload, Properties/Trigger change, tenant transaction, or
  LINE message was performed. Authenticated mobile/LIFF and private Drive UAT
  remain `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-03 房東簡易新租約正式部署

- PR #94 已將房東簡易新租約入口合併到 GitHub `main`，merge commit 為
  `6302b25`。
- Apps Script 已從候選 worktree 推送 52 個檔案，既有 Web App deployment
  更新至 immutable Version 149；Version 148 保留為立即回滾版本，既有 Web
  App URL 不變。
- 簡易流程由房東填寫房號、租金、押金、租約起始日與租期月數；伺服器計算
  含首尾日的結束日，並沿用房間／Workspace 預設的管理費、付款日、電費與
  設備耗損費。未新增 Sheet 欄位，未執行 migration，未改動既有合約、房客、
  帳單、Drive、Properties、Triggers 或 LINE 資料。
- GitHub Pages workflow `33656914943` 已完成 build、deploy、status；公開
  read-back 的房客名單、簡易新租約頁與 release asset 均 HTTP 200，並確認
  `simple_new` 入口、`建立簡易新租約` 標題與 immutable cache key
  `20260903-simple-new-lease-v1`。
- Production API 唯讀 probe 回應 HTTP 200／`MISSING_LINE_UID`，證明正式
  deployment 可達且未送出身份或寫入資料。版本凍結驗證為 Node `77/77`、
  validator `83/83` routes／handlers、duplicate declarations `0`、credential
  findings `0`、HTML links `214/214` 與 `git diff --check` 通過。
- 已登入 LIFF／手機、房客證件上傳／簽名、正式房東建立新租約與房客簽署仍為
  `HUMAN_REQUIRED` / `UNVERIFIED`；本次部署沒有建立測試租約或發送 LINE。

## 2026-09-02 landlord checkout settlement formal release

- PR #92 merged the landlord checkout settlement and Sheet Date normalization
  candidate into GitHub `main` as merge commit `a2682b3`.
- Apps Script source was pushed as 52 files. The existing Web App deployment now
  serves immutable Version 148; Version 147 remains the immediately previous
  rollback version and the Web App URL was preserved.
- The additive migration function
  `runV2CheckoutSettlementProductionMigration` completed in the authenticated
  Apps Script editor. Read-only Spreadsheet verification found the new
  `V2_checkout_settlements` sheet with its settlement headers and no settlement
  data rows; existing contract, tenant, bill, Property, Trigger, Property
  setting, and LINE data were not changed.
- GitHub Pages workflow `33648496168` completed build, deploy, and status jobs
  for `a2682b3`. Public readback returned HTTP 200 and found the checkout
  settlement form, server preview action, start/end meter fields, two private
  photo upload actions, deposit deduction, and the immutable cache key
  `20260902-landlord-checkout-settlement-v1`.
- Local verification at release freeze: full Node suite `76/76`, authoritative
  validator `83/83` routes and handlers, duplicate declarations `0`, credential
  findings `0`, and `git diff --check` passed. `npm run validate` was not
  applicable because this isolated worktree has no `package.json`.
- Authenticated LIFF/mobile checkout, real private Drive upload, and a real
  502/506 checkout transaction remain `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-02 landlord checkout settlement local candidate (released)

- Candidate branch: `codex/checkout-settlement-20260902`. The approved manual
  landlord checkout settlement is implemented locally with the cache key
  `20260902-landlord-checkout-settlement-v1`.
- The candidate adds server-side inclusive settlement calculation, prior unpaid
  utility carryover, meter-based current utilities, deposit offset/refund,
  append-only `V2_checkout_settlements`, and private start/end meter evidence.
  Existing contracts and `V2_bills` remain immutable.
- Bill-month sources now normalize Google Sheets Date values and exclude paid or
  voided bill statuses; fee resolution preserves explicit contract rates and
  falls back to the existing room／Workspace month settings when absent.
- Checkout initialization and target validation also normalize contract start／end
  Date values to `YYYY-MM-DD`, so a Sheet Date cannot become a browser-invalid
  full Date string.
- Local Phase 202／205／206／207 tests and checkout-page JavaScript parsing pass.
  The additive migration entry point is
  `runV2CheckoutSettlementProductionMigration`; it has not been run against the
  Production Spreadsheet.
- At candidate freeze this had not yet been pushed, merged, deployed to Apps
  Script, or published to GitHub Pages. The formal release above supersedes that
  temporary state; no contract, tenant, bill, Drive, Trigger, Property, LINE
  setting, or LINE message was changed by the release.
- Authenticated LIFF/mobile checkout, real private Drive uploads, exact
  Production Sheet schema, and 502/506 operational data remain
  `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-02 landlord-led renewal and checkout formal release

- PR #90 merged the landlord-led renewal and landlord-only checkout flow into
  GitHub `main` as merge commit `3d8647d`.
- Apps Script was pushed as 52 files and the existing Web App deployment now
  serves immutable Version 147. The Web App URL is unchanged and Version 139
  remains the rollback reference.
- The additive-only renewal/checkout schema migration was run from the
  authenticated Apps Script editor and completed. No contract or tenant rows,
  Properties, triggers, or LINE data were changed by the migration or release;
  only missing schema headers were eligible for addition.
- GitHub Pages workflow `33567151637` completed build, deploy, and status jobs.
  Public readback returned HTTP 200 for the release asset, tenant detail,
  landlord checkout, contract requests, tenant contract, and tenant
  termination pages, with the new cache key and flow markers present.
- Local verification passed with the authoritative 83-route inventory and full
  Node suite `73/73`. Authenticated LINE/mobile renewal, signing, and checkout
  acceptance remain `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-02 expired tenant renewal recovery formal release

- The Workspace-native landlord tenant list now falls back to the latest
  renewal-eligible predecessor when no contract is currently effective but an
  operational tenant's contract has expired. This restores the tenant card and
  manual renewal entry without making the expired contract current or changing
  its immutable history.
- Phase 201 adds runtime coverage for the reported boundary and rejects future
  active contracts from this fallback.
- PR #88 merged as `272f675c`. Apps Script was pushed as 51 files and the
  existing production Web App deployment now serves Version 146. Version 139
  remains the rollback reference; the Web App URL is unchanged.
- No Production Sheet row, contract status, Property, Trigger, LINE setting or
  LINE message was changed. GitHub Pages was not changed because no frontend
  source was required for this backend read-model repair.
- Local verification passed with the worktree's current 83-route inventory,
  full Node suite `70/70`, Apps Script syntax checks and `git diff --check`.
- The exact 502 Production data state and authenticated LINE/mobile acceptance
  remain `HUMAN_REQUIRED`; a logged-in landlord must confirm that 502 is visible
  again and that its old contract opens the renewal form.

## 2026-09-02 renewal fee prefill corrective release

- Fixed the `從此合約發起續約` path so the predecessor rent, management fee,
  deposit months, deposit amount, payment day, electricity fee rate, equipment
  loss fee rate, optional 30-day clause, and note remain available when the
  form switches into renewal mode.
- The room summary now carries those predecessor contract fields, and the
  frontend prefers the complete `renewal_source` before falling back to the
  room summary. This prevents the room summary from masking the complete
  contract data returned for a selected predecessor.
- PR #86 merged the fix into GitHub `main` as `72542bc`.
- Apps Script was pushed as 51 source files and the existing public Web App
  deployment now serves immutable Version 145. The Web App URL was preserved;
  Version 139 remains the rollback reference. No Script Properties, Trigger,
  LINE setting, contract row, or manual Sheet migration was changed.
- GitHub Pages workflow `33555883954` completed successfully. Public readback
  returned HTTP 200 and confirmed cache key
  `20260902-renewal-date-prefill-v2`, complete-source preference, and fee-field
  prefill markers on the renewal page.
- Local verification passed: full Node suite `69/69`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, Apps Script syntax checks, and `git diff --check`.
- Exact production Sheet header state and authenticated LINE/mobile contract
  acceptance remain `HUMAN_REQUIRED`; public readback does not prove a
  logged-in contract transaction.

## 2026-09-02 renewal date prefill formal release

- Renewal forms now use the predecessor contract end date itself as the new
  lease start date. The end date is then calculated with the existing inclusive
  one-year rule (`start date + one year - one day`), so `2026-09-30` becomes
  `2027-09-29`. The change applies to direct renewal defaults and expiry-draft
  defaults; the new-lease flow and other renewal fields are unchanged.
- The onboarding response now normalizes Sheet date/timestamp values before
  they reach the HTML date inputs, including timestamps such as
  `2026-10-02T16:00:00.000Z`.
- PR #83 merged the candidate into GitHub `main` as `52d4175`.
- Apps Script was pushed as 51 source files and the existing public Web App
  deployment now serves immutable Version 144. The Web App URL was preserved;
  Version 139 remains the rollback reference. No Script Properties, Trigger,
  LINE setting, contract row, or manual Sheet migration was changed.
- GitHub Pages workflow `33553714995` completed successfully. Public readback
  returned HTTP 200 for the renewal form, release asset, and tenant-detail
  entry, and confirmed cache key `20260902-renewal-date-prefill-v1` plus the
  predecessor-end-date prefill logic.
- Local verification passed: full Node suite `69/69`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, Apps Script syntax checks, and `git diff --check`.
- Exact production Sheet header state and authenticated LINE/mobile contract
  acceptance remain `HUMAN_REQUIRED`; public readback does not prove a
  logged-in contract transaction.

## 2026-09-02 tenant-detail direct renewal signing formal release

- The primary renewal entry is now the tenant journey: tenant list → tenant
  detail → contract version → `發起續約`. Eligible active, expired, approved
  and completed versions hand off their exact predecessor `contract_id` to the
  one-page renewal form. The contract request page remains the review,
  invitation and signing-status surface.
- The direct route creates an append-only renewal version, carries the fixed
  contract template and optional 30-day non-renewal clause, and immediately
  creates the tenant signing invite. The predecessor is not archived until the
  new contract is signed and landlord approval is completed.
- PR #81 merged the candidate into GitHub `main` as `938b39d`.
- Apps Script was pushed as 51 source files and the existing public Web App
  deployment now serves immutable Version 143. The Web App URL was preserved;
  Version 139 remains the rollback reference. No Script Properties, Trigger,
  LINE setting, or contract row was changed, and no manual Sheet migration was
  run. The code retains an additive header guard for the new fields.
- GitHub Pages workflow `33547890200` completed successfully for `938b39d`.
  Public readback returned HTTP 200 and found the tenant-detail renewal entry,
  direct renewal route, special-offer clause, request review page, and release
  cache key.
- Local verification passed: full Node suite `68/68`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, Apps Script syntax checks, and `git diff --check`.
- Exact production Sheet header state and authenticated LINE/mobile contract
  acceptance remain `HUMAN_REQUIRED`; the public/API checks do not prove a
  logged-in contract transaction.

## 2026-09-01 landlord homepage timeout corrective release

- Fixed the landlord homepage bootstrap read path so the payment and message
  read helpers reuse the existing request-local runtime snapshot instead of
  reading the same Google Sheets again within one request. This is a read-only
  performance repair; no contract, billing, Sheet row, Property, Trigger, or
  LINE data was changed.
- PR #79 merged the repair into GitHub `main` as commit `d9c371c`.
- Apps Script was pushed to the verified production project and the existing
  fixed Web App deployment was updated to immutable Version 142. Version 139
  remains the recorded previous release target; the Web App URL was preserved.
- GitHub Pages workflow `33483720012` completed successfully for `d9c371c`.
  Public `landlord-home.html` readback returned HTTP 200 and retained the
  timeout-retry and dashboard request markers. A safe anonymous API readback
  returned HTTP 200 with the expected JSONP callback and access-denied result.
- Local verification passed: full Node suite `66/66`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, and `git diff --check`.
- Authenticated LINE/mobile 603 UAT remains `HUMAN_REQUIRED`; the anonymous
  readback does not prove the logged-in landlord's full dashboard data load.

## 2026-09-01 landlord-led renewal consent formal release

- The isolated candidate changes expiry renewal handling to a landlord-led
  consent flow. The landlord reviews the append-only one-year draft, can edit
  dates／amounts／payment day and choose the optional 30-day offer, then sends a
  tenant inquiry. The tenant's accepted response is required before a signing
  invite can be created.
- PR #76 merged the feature into GitHub `main` as commit `52b75b8`; PR #77
  updated all 36 production HTML API references and merged as `ceeede8`.
- Apps Script was pushed to the verified production project and published as
  immutable Version 140 in a new fixed deployment because the old HEAD
  deployment is read-only. The old endpoint was retained; Version 139 remains
  available as the previous immutable release. No Sheet migration, Script
  Properties, Trigger, LINE push, or contract-data write was performed.
- GitHub Pages workflow `33456765735` completed successfully for `ceeede8`.
  Public readback returned HTTP 200, found the landlord inquiry/signing UI,
  and confirmed the public HTML points to the Version 140 deployment.
- Read-only API smoke returned `RENEWAL_INTENT_INPUT_REQUIRED` for an empty
  renewal-intent POST, confirming the new dispatcher is serving without
  mutating production data. Local Phase 196 and the updated Phase 157 runtime
  regression passed; full Node suite `65/65`, project validation `83/83`, and
  `git diff --check` passed.
- Authenticated LINE/mobile room-603 UAT and production Sheet schema
  migration remain `HUMAN_REQUIRED`.

## 2026-09-01 renewal-draft date-correction release

- The renewal-draft date correction candidate was merged to GitHub `main` by
  PR #74 as commit `3f6af93635742685da3272a81485b91a62d750f1`.
- Apps Script was pushed as 51 source files and the existing Web App deployment
  was updated to immutable Version 139. The existing Web App URL was
  preserved; Version 138 remains the verified rollback target. No Sheet,
  Script Properties, Trigger, LINE configuration, or contract data migration
  was performed.
- GitHub Pages workflow `33449180375` completed successfully for the merged
  `main` commit. Public readback returned HTTP 200 and found `修改續約日期`
  plus the manual-signing correction guidance.
- The public Apps Script route readback recognized
  `landlord_contract_renewal_draft_update` and returned the expected
  POST-session guard for a GET request. This verifies routing only; no
  production contract was edited.
- Local verification passed: full Node suite `64/64`, candidate validator
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, JavaScript syntax checks, and `git diff --check`.
- Real authenticated LINE/mobile date-edit acceptance remains
  `HUMAN_REQUIRED`. Exact correction of any existing 603 or other contract
  still requires the user to provide the target contract and correct dates.

## 2026-08-28 room-603 contract-history corrective release

- The Workspace-native `landlord_tenants` route repair was merged by PR #59 as
  commit `c79030f`. The landlord tenant-detail rendering follow-ups were merged
  by PRs #60, #61, and #62; the final merged `main` commit is `7711dea`.
- Apps Script Version 131 is serving on the existing Web App deployment. The
  existing Web App URL was preserved; no new URL was created. No schema or
  tenant-data migration was run for this read-model/UI-only repair.
- GitHub Pages workflow `33099332347` completed build, deploy, and status-report
  jobs for the final merged commit. Public room-603 smoke readback now renders
  `房客合約` → `合約版本紀錄`, one existing contract-version card, and one
  `查看完整合約與簽名` action; the page error card and browser console errors
  were both absent.
- Local verification passed: full Node suite `56/56`, candidate validator
  `83/83` routes and handlers, duplicate declarations `0`, and credential scan
  `0`.
- This is public/test-mode and authenticated browser-extension evidence only.
  Real authenticated LINE/mobile signing acceptance remains `HUMAN_REQUIRED`.

## 2026-08-27 formal renewal-history release

- The renewal contract-history candidate was merged to GitHub `main` by PR #56
  as commit `74524166aead730a2eaa07e85950102ca2201c39`.
- Apps Script Version 130 is serving on the existing Web App deployment. The
  existing Web App URL was preserved; no new URL was created.
- The additive-only production schema migration was run twice from the
  authenticated Apps Script editor and both executions completed successfully.
  The runner appends only missing headers and does not delete or rewrite old
  contract versions.
- GitHub Pages workflow `33054940344` completed successfully for the merged
  `main` commit. Public readback found `房客合約`, `合約版本紀錄`, and
  `查看完整合約與簽名` in the landlord tenant-detail page.
- Local verification passed: full Node suite `55/55`, candidate validator
  `83/83` routes and handlers, duplicate declarations `0`, credential scan `0`,
  and `git diff --check`.
- `HUMAN_REQUIRED`: authenticated real LINE/mobile room-603 UAT and actual
  landlord/tenant contract interaction remain unverified.

## Gate 0 / Production Consolidation

`GATE_0=PASS` for canonical source reconciliation.

The approved source commit
`9a17c4bd2719d4cdb24058d4d797bd9281e4b06e` was reconciled with a read-only
immutable Apps Script Version 89 export. All 43 source files are
byte-identical. GitHub PR #12 then merged that exact source tree into canonical
`main` as merge commit
`747b484f871c18985cf414e6640ae04afe8303a1`.

| Gate item | Verified state | Evidence reference |
| --- | --- | --- |
| Immutable serving-source export | PASS | Read-only Version 89 export, 43 source files. |
| Export-to-approved-source comparison | PASS | Approved commit `9a17c4b` is byte-identical to the Version 89 export. |
| Canonical Git reconciliation | PASS | PR #12 merge `747b484` has the same source tree as `9a17c4b`. |
| Static source validation | PASS | 42 JavaScript syntax checks, eight focused checks, diff check, and sensitive-credential scan. |
| Unique canonical source | PASS | GitHub `main` is the canonical source record for the reconciled Version 89 tree. |

This evidence proves source reconciliation only. It does **not** prove a fresh
Production deployment, runtime/UAT result, current Apps Script serving version,
current rollback version, Google Sheets state, Properties, triggers, LINE/LIFF,
or GitHub Pages state.

## 2026-08-12 read-only Production identity reconciliation

The current authenticated Apps Script editor was checked read-only under
`cmwebs.saas@gmail.com`. The project shown was `綠界結帳`; its active Web App
deployment was Version 102, with the description `Production V102: ignore
incomplete tenant payment bill rows`. The deployment executes as the owner and
is accessible to everyone. The deployment identifier is intentionally not
duplicated here.

The editor listed 42 `.gs` files. GitHub `main` at merge `0bbbe06e` listed 42
corresponding `.js` files after suffix normalization. This is an inventory
comparison, not a byte-level source export. The complete evidence is recorded
in [125-PRODUCTION-IDENTITY-RECONCILIATION-2026-08-12.md](125-PRODUCTION-IDENTITY-RECONCILIATION-2026-08-12.md).

The Phase 147 GitHub Pages deployment completed successfully in workflow
`31601674513`, and the four public tenant pages were fetched successfully. This
read-only package did not identify a rollback version and did not inspect or
change Sheets, Properties, triggers, LINE, LIFF runtime state, or payment data.

## Serving and rollback references

- **Canonical source baseline:** the Version 89 source tree described above,
  reconciled to GitHub `main` by PR #12.
- **Current Apps Script serving version:** Version 145, read back from the
  existing Web App deployment on 2026-09-02 after the renewal fee-prefill
  corrective release. This is deployment identity evidence, not a real-device
  UAT result.
- **Current Apps Script rollback version:** Version 139, the prior serving
  version retained on the same Web App deployment.
- **GitHub Pages:** the renewal fee-prefill corrective release at merged `main`
  commit `72542bc` completed successfully in workflow `33555883954`; public
  readback found the tenant-detail renewal entry, direct renewal form, fee
  prefill logic, and cache key `20260902-renewal-date-prefill-v2`.
- **Production editor source:** an open Apps Script editor does not prove what
  immutable version is serving. Deployment metadata and a scoped source export
  are authoritative.

## 2026-08-25 tenant fixed-template signature preview release

This authorized work unit completes the fixed Google Docs template path for the
tenant contract signing surface. The configured fixed template remains the
content source; the original template is not modified. Submission materializes
a private signed copy, writes the stored signature artifact into the signed
document, and the mobile read model returns the private signature image for the
tenant preview after successful submission.

### Verified release evidence

- Apps Script was pushed to the verified target project and the existing Web
  App deployment was updated to immutable Version 125. No new Web App URL was
  created. No Sheets, Script Properties, trigger, LINE configuration, or
  tenant data migration was performed in this work unit.
- GitHub Pages commits `b4d164d`, `d719eb9`, and `9e18425` completed the
  signature-preview and cache-busting changes. Workflow `32793428257` passed
  build, deploy, and status-report jobs.
- Public readback returned HTTP 200 for `tenant-contract.html`; the three
  tenant entry pages load the versioned `frontend-release.js` asset, whose
  release value is `20260825-tenant-signature-preview-v1`.
- Local verification passed: focused tenant signing UI test, full Node suite
  (`48 pass, 0 fail`), project validator (`81/81` routes and handlers,
  duplicate declarations `0`, credential scan `0`), and `git diff --check`.

### Remaining gate

`HUMAN_REQUIRED`: an authenticated real LINE/mobile room-603 submission and
post-submit preview has not been verified. Directly opening a nested tenant
page outside the LIFF entry reproduced LINE 400 because the current URL is not
under the configured LIFF endpoint; the tenant must reopen from the official
LIFF entry, not a copied nested page URL. The separate direct deep-link
redirect hardening remains a follow-up risk and was not included in this
release.

## Historical reconciliation context

The following is retained as historical evidence, not as current serving or
rollback status:

- On 2026-07-30, read-only Version 87 and Version 85 source comparisons
  reconciled the reminder repair, legacy signed-contract sync bridge, and
  related schema/dispatcher compatibility work to then-current `main`.
- That historical record included a 69-tab schema metadata capture,
  presence-only Script Properties inventory, existing trigger inventory, and a
  69-route/handler baseline.
- The previously recorded Version 85 rollback reference applied to the
  Version 87 reminder repair only. It must not be treated as a current
  rollback target.

## V2.1 authorization boundary

V2.0 remains the internal Production baseline. Gate 0 completion does not
authorize implementation or external operations.

On 2026-08-03, local documentation-baseline synchronization was authorized.
On 2026-08-04, a separate local-only candidate enabled the existing
request-local snapshot for `landlord_home_bootstrap`, with a focused mock. Both
are isolated, unpushed source records; neither permits Production read/write,
deployment, GitHub Pages publication, account action, or runtime/UAT claims.
V2.1 work remains bounded by
`CMWEBS_PRODUCT_ROADMAP.md`, `CMWEBS_ARCHITECTURE_DECISIONS.md`, and
`CMWEBS_RELEASE_RULES.md`; every later work unit needs its own explicit scope
authorization.

## New-conversation handoff

```text
Project: CMWebs 智慧租管 / cmwebs-liff
Read AGENTS.md and all docs/CMWEBS_*.md files first.
Recommended model: gpt-5.6-terra; speed: medium.

The latest isolated worktree is
`codex/fix-fixed-contract-template-20260825` at `9e18425`, clean after the
handoff documentation commit if present. The root aggregate worktree remains
user-owned and dirty; do not clean or reset it.

The authorized fixed Google Docs template tenant-signature-preview release is
deployed: Apps Script Version 125 on the existing Web App deployment and
GitHub Pages workflow `32793428257` for commit `9e18425`. Public asset
readback and local tests pass. This does not prove authenticated LINE/mobile
room-603 UAT. The next action is to use the official LIFF entry on a real LINE
device, submit the signed fixture, and verify both the success state and the
signature image in the mobile preview and private signed Google Doc.

If that UAT still fails, first capture the authenticated browser/network
evidence; do not redeploy Apps Script or change Sheets/Properties blindly. The
direct nested-page LIFF 400 and deep-link redirect hardening remain separate
follow-up work.
```
