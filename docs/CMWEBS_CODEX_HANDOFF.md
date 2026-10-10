# CMWebs Codex Handoff

**Status: AUTHORITATIVE**

Before work, read `AGENTS.md` and:

- `docs/CMWEBS_PRODUCT_ROADMAP.md`
- `docs/CMWEBS_CURRENT_STATE.md`
- `docs/CMWEBS_V2_1_CODEX_EXECUTION_RECORD.md`
- `docs/CMWEBS_ARCHITECTURE_DECISIONS.md`
- `docs/CMWEBS_RELEASE_RULES.md`
- `docs/CMWEBS_CHANGELOG.md`

Start every handoff with a recommended model and speed. Default:
`gpt-5.6-terra`, `medium`.

## Current handoff state

- 2026-10-11 Core subscription integration: recommended model/speed gpt-5.6-terra / medium; current session retained. Backend226 published at the original URL; immutable63 files exactly match intentional source, prior225/main9388ab9 retained for rollback, other4 deployments/manifest unchanged. Real isolated Google Apps Script → AI-00 subscription, quota, expiry/scope and suspension tests PASS; fixture restored ACTIVE. Exposed test credential revoked/rotated, old401/new200; no secret values recorded. CM768/768 including cross-repo4, validate and Core PostgreSQL CI pass. Formal Sheet/Properties/triggers/LINE untouched, default legacy. User selected own first landlord; exact target W000001, 朱文漢的管理團隊. Production environment promotion, own-Workspace observe binding and authenticated UI remain pending; do not use the synthetic two-room quota for the owner. See PLATFORM-CORE-SUBSCRIPTIONS.md and production-baseline.json. Pages publication follows separately.

- 2026-10-10 native repair/dispatch integration candidate: user approved the in-system design and requested implementation. Branch `codex/repair-dispatch-integration-20261010`, base `e7fd413`, root WIP preserved. Extends original repair ID, Spreadsheet and landlord membership; restricted vendor reply branches from existing LIFF binding entry. Self handling, company members, quotes/fixed price, executor, private photos, extra approval/rework/acceptance implemented locally. See `REPAIR-DISPATCH-INTEGRATION.md` for tests, limits, deployment and rollback. No push/merge/cloud deployment, Production migration, Properties, triggers or LINE sends. Do not replace original-system integration with the retained independent Worker/D1 app.

- 2026-10-02 recommended model/speed: `gpt-5.6-terra` / `medium`. Frontend-only tenant evidence discovery repair **published**: PR #193 / merge `3e6affb`, Pages workflow `36913724284` success, all 17 public files byte-identical. Runtime tests reproduce slow-document blocking of meter controls and missing per-row historical private previews; both repaired, with top-profile in-page links. Five added tests, full 425/425, validate, 37 inline scripts, diff-check and independent review pass. Cache tag is `20261002-tenant-evidence-discovery-v1`; other HTML changes are mechanical shared-tag updates. Backend/API/schema unchanged; fresh deployment read-back remains v201, immutable export's 59 files still match. The fresh live browser is at Email login, so actual 506 metadata/files, authenticated viewing and mobile acceptance remain UNVERIFIED. No business rows, private-file contents/uploads, Properties, triggers or LINE changes. Preserve root WIP and do not reopen unrelated discussion. Frontend rollback: `ed412c2`.

- 2026-10-01 initial-meter repair **published**: PR #191 merged as `2c570ae`; Pages workflow `36881380576` succeeded, `npm run verify:production` matched all 17 public files byte-for-byte. Exact action-time authority deleted only historical v199; its 59-file export matched Git `ebce4b8`, v200 retained. Fresh editor HEAD matched immutable v200 before push; immutable v201 export matches all 59 files at runtime `99e4db5`, same formal deployment reads back v201, other deployments HEAD / 160 / 10 / 139 unchanged. Full tests 420/420, validate, combined/inline syntax, export and diff-check pass. Correct anonymous v2_action init GET returns POST_REQUIRED. No business rows, private files, Properties, triggers or LINE writes. Actual 506 reading unknown; human upload/device acceptance unverified. User path: tenants / 506 detail / initial meter; documents and identity section for contract/ID/selfie/meter files. Rollback v200 / pre-release main `fbc90d2`. Dirty root unchanged (408 entries, 49 tracked); do not reopen unrelated discussion. Older hold bullets below are history, not current serving state.

- 2026-10-01 release resume prepared on `codex/paper-initial-meter-release-20261001`, runtime commit `99e4db526ed5063dda8d364829f0a6f58dbb4f0e`, from current main `fbc90d2`. This reapplies reviewed `b225185`; all 59 backend files and the affected frontend runtime are identical to that candidate. Fresh suite 420/420, validate, combined Apps Script / inline syntax and diff-check pass. User authorized deleting only the previously specified unreferenced historical v199. Its 59-file local export exactly matches Git source `ebce4b8`; current five deployments still reference HEAD / 160 / 10 / 200 / 139, not 199. Browser is at the exact project's final permanent-deletion dialog for v199; requested action-time confirmation explains that original version number cannot be restored, though backed-up code can be recreated. No deletion, push, PR, immutable version creation or deployment performed in this resume. Preserve v200 and every deployment/data binding. Continue here only after final confirmation; do not expand deletion scope or reopen the unrelated discussion.

- 2026-10-01 initial-meter release is **BLOCKED by Apps Script's 200-version cap**, not a code/test failure. Reviewed candidate `b225185` / PR #188 passed 420/420 and remains on `codex/paper-initial-meter-20261001`; it is not delivered. Version creation failed after source push, so editor HEAD was restored to v200 (59-file export match) and Pages was safely reverted by PR #189 / `da77a4e`. The cancelled candidate workflow's deploy step reported success, requiring actual rollback/public read-back rather than assuming cancellation prevented publication. Serving deployment remains v200. Version 199 is unreferenced by current deployments and backed up in a 59-file read-only local export, but must not be deleted without explicit human approval. Resume only after that exact authority: recreate candidate on latest main, new immutable version, same deployment URL and Pages verification. No business rows, private uploads, Properties, trigger or LINE writes; actual 506 meter reading unknown. Preserve the dirty root and do not reopen the unrelated discussion.

- Latest verified source/deployment reconciliation: [PRODUCTION-DELIVERY.md](PRODUCTION-DELIVERY.md), 2026-10-01. Apps Script Version 200 exports 59 files byte-identical to reviewed `3e5ba45` (PR #187); existing deployment reads back v200, URL unchanged. Only paper backfill differs from v198. Scoped read-only 506 linkage/status checks confirmed its existing global user was incorrectly looked up as Workspace-owned; canonical global identity reuse and common invitation claim/room guards are repaired. Full tests 313/313, validate and source export pass. Frontend unchanged; 17 public assets match via sequential curl fallback after Node fetch network failure. Real-file upload, paper conversion, tenant binding and real-device acceptance remain unverified. No business rows, private files, Properties, triggers or LINE were mutated during publication. Rollback: Apps Script 198; unserved v199 is superseded and must not be released. The old v160 endpoint in the dirty root is not the current public target. Start from current remote `main`, not the historical dirty root; preserve its WIP and do not create another cloud project. Do not open the unrelated ChatGPT project discussion; the user explicitly removed it from this repair workflow.

- Gate 0 / Production Consolidation: PASS for canonical source reconciliation
  on 2026-08-03.
- Canonical V2 source baseline: immutable Apps Script Version 89 source is
  byte-identical to approved commit `9a17c4b`; PR #12 merged the same tree to
  GitHub `main` as `747b484`.
- This is source-reconciliation evidence only. It does not assert a current
  serving version, deployment state, or rollback version.
- Re-verify the Production account, target project, existing deployment,
  serving version, and rollback target for every Production action.
- Recorded V2.1 local work includes documentation-baseline synchronization and
  an unpushed `landlord_home_bootstrap` request-local snapshot candidate. Both
  remain review candidates, not canonical or deployed source.
- V2.1 integration, push, deployment, Production access, and any external
  operation still need separate explicit scopes.

## Non-negotiable product rules

One standardized core and upgrade stream serve all customers. Branding can be
configured; functionality cannot be customized. V3 uses each landlord's own
BYO LINE OA; CMWebs does not operate a shared OA for landlord messages.

For V2.1 native contract signing, trust only the backend-derived
`signing_mode`. Normal renewal is signature-only and must not re-run
new-tenant identity onboarding or binding. A final submission may record only
the verified, mode-specific signing evidence and must preserve
`contract_status`; it cannot fake approval, activation, or a completed signing
result. Missing session, artifact, content, predecessor-linkage, or explicit
signing-audit schema must fail closed.

## Safe execution contract

Use an isolated worktree, preserve unrelated dirty work, stage only in-scope
files, and test proportionately. Do not deploy, push, merge, change Production
data, Properties, triggers, LINE, LIFF, GitHub Pages, or external accounts
without specific authorization. Never store or reveal secret values.

- 2026-10-10 user-authorized native repair dispatch publication: fresh serving223/editor HEAD60 files matched main; immutable22461 files matched candidate; original Web App224, other4 unchanged. Owner initialized10-column event table/private folder;724 tests and validate pass. Tag20261010-repair-dispatch-v1. Rollback223/e7fd413. See REPAIR-DISPATCH-INTEGRATION.md. No business dispatch/LINE sends; real device unverified.

- Repair dispatch release COMPLETE at publication level: PR249/main7241f2e; Pages built,50 public files match; serving224 at same URL, other4 deployments unchanged. Anonymous GET/POST rejected. Real authenticated landlord/vendor transactions and physical device UNVERIFIED; no business test dispatch/financial write/LINE send.

- 2026-10-10 auto email settlement completion notice correctness fix: candidate a377903; immutable22561 files match; original deployment225, rollback224, other4 unchanged.729 tests/42 bank runtime tests and independent review pass. No frontend/schema/Properties/trigger/financial-rule changes; no manual intake/send or historical bulk resend. Real LINE receipt UNVERIFIED. See BANK-AUTO-SETTLEMENT-NOTIFICATION.md.
