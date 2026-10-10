# CMWebs Current State

Last updated: 2026-07-27 (Asia/Taipei)

Status convention: values below are the **last verified serving state**, not a
claim that a new live inspection occurred during this documentation-only change.

## Serving Production baseline

| Surface | Last verified state | Evidence |
| --- | --- | --- |
| Apps Script Web App | Immutable **Version 82** serving through the existing Web App deployment. | Verified operational-filter deployment evidence, 2026-07-25; current documentation does not duplicate its sensitive deployment identifiers. |
| Apps Script rollback | Immutable **Version 81** retained as the rollback version. | Same 2026-07-25 verified deployment evidence. |
| GitHub Pages | GitHub Pages remains the verified `main` root build; the last repository-contained verified successful revision is `3b48e9b2421a...9a3e`. | [124-CMWEBS-V2-CONTROLLED-PRODUCTION-RELEASE.md](124-CMWEBS-V2-CONTROLLED-PRODUCTION-RELEASE.md) and [release result manifest](../release-manifests/cmwebs-v2-production-release-result.json). |
| GitHub Pages rollback | Previous verified successful revision: `28767ded0f5c...1fee`. | Same Phase 124 release evidence. |
| Version 82 frontend relation | No GitHub Pages publication accompanied the Version 82 backend update. | Verified operational-filter deployment evidence, 2026-07-25. |

Before any release, rollback, support conclusion, or Production change, repeat
the appropriate authenticated, read-only verification. Historical values in
this file must never be treated as authority to deploy.

## Current product baseline and next approved phase

- **Current baseline:** V2.0 internal Production operations, with completed
  rental-management, billing, arrears, reminders, repair, contract, team,
  RBAC, Workspace isolation, and LINE flows.
- **Next approved phase:** V2.1 Internal Operations Completion. Its scope is
  performance consolidation, fixed graphical operational reporting, a standard
  digital contract workflow, and defined operational-stability completion.
- **Entry condition:** V2.1 is planned, not an authorization to begin feature
  implementation. The current Production Consolidation/Gate 0 requirements in
  `AGENTS.md` remain the engineering entry gate.
- **Exit condition:** after approved V2.1 scope is complete,
  `V2_FEATURE_FREEZE = FINAL`; later V2 work is only genuine Production
  blockers, correctness fixes, and stability repairs.

## Latest verified operational result

The last manual landlord UI verification after Version 82 recorded:

- 18 managed rooms and 18 active tenants;
- 15 paid tenants and 3 arrears tenants;
- 0 pending contract requests; and
- inactive room 603 removed from operational views while its historical record
  was retained.

The underlying correction retired the synthetic room-603 termination request;
it did not send a LINE notification. This is an operational release result, not
a replacement for current UI or data verification.

## Outstanding operational issues and work boundaries

1. **Production Consolidation/Gate 0 remains the entry gate.** No V2.1 feature
   implementation begins until its requirements are met and work is separately
   authorized.
2. **V2.1 performance consolidation is planned.** Follow the authoritative
   roadmap: instrumentation, safe LIFF-initialization reduction, intentional
   page bootstrap requests, short Workspace caching, stable release-version
   cache keys, and fewer full-Sheet scans. See
   [68-RUNTIME-PERFORMANCE-AUDIT.md](68-RUNTIME-PERFORMANCE-AUDIT.md).
3. **Tenant real-device evidence is historical and incomplete.** The older
   report contains unretested P0 failures/blockers; it must be reconciled with
   the Version 82 serving identity before it is used as a present release
   blocker. See [39-TENANT-REAL-DEVICE-RESULTS.md](39-TENANT-REAL-DEVICE-RESULTS.md).
4. **Production facts are time-sensitive.** Apps Script version, Page revision,
   Sheet state, deployment binding, triggers, Properties, and LINE state must
   be independently rechecked before action.

## Repository state at this documentation update

This repository has pre-existing, unrelated dirty runtime and documentation
changes. This documentation task neither classifies nor incorporates them. The
local documentation commit for these five files is deliberately path-scoped.

## Codex product-memory status

The authoritative V2.0/V2.1/V3/V4 boundary is recorded in the roadmap,
architecture decisions, release rules, changelog, and `AGENTS.md`. A
documentation-only handoff or memory update may preserve that boundary without
waiting for Gate 0, but it does not authorize V2.1 implementation, a
Production change, or a release conclusion.

## New-conversation handoff

```text
Project: CMWebs 智能租管 / cmwebs-liff
Read AGENTS.md plus docs/CMWEBS_{PRODUCT_ROADMAP,CURRENT_STATE,
ARCHITECTURE_DECISIONS,RELEASE_RULES,CHANGELOG}.md first.

Known last-verified serving state: Apps Script v82, rollback v81; Pages last
repository-contained verified revision 3b48e9b... (no Pages publish with v82).
Treat these as historical evidence and re-verify before any Production action.
Classify the request V2.0/V2.1/V3/V4. V2.1 needs Gate 0 completion and separate
authorization; V2.0 accepts only blockers, correctness, and stability repairs.
Recommend a Codex model and speed before beginning work.
```

## 2026-08-11 execution handoff addendum

This is a repository-execution snapshot, not a replacement for the historical
Production baseline above. The root branch is
`codex/cmwebs-project-autopilot` at HEAD `b9ef39c`; it has 38 modified tracked
paths, no staged paths, and 294 untracked entries. The aggregate is not a
release candidate and must be preserved rather than classified or deployed.

At close, `npm run validate`, the four available evidence tests, and
`git diff --check` passed. No current Apps Script serving version, Web App
deployment identity, GitHub Pages revision, Spreadsheet state, Properties, or
triggers were inspected in this handoff. The later versions and releases
reported in chat remain unconfirmed against current authenticated evidence.

The only next work package is a separately authorized, read-only Production
identity reconciliation. This addendum does not change the V2/V2.1/V3/V4
roadmap, architecture decisions, release rules, or historical serving values.

## 2026-08-13 close-of-day addendum

This is a durable local handoff for the isolated V2.1 native landlord
contract-signing review candidate. It does not classify the dirty root tree as a
release and does not authorize publication or Production action.

- Root branch remains `codex/cmwebs-project-autopilot` at HEAD `b9ef39c`.
- Root status at close: 47 modified tracked paths, 300 untracked paths, no
  staged paths, 166 porcelain entries total. Preserve the aggregate; do not
  stage, clean, reset, commit, or deploy it.
- Isolated candidate remains `/private/tmp/cmwebs-v2_1-signing-review-security-20260813`,
  branch `codex/v2_1-signing-review-security-20260813`, HEAD `55ad72b`, with a
  clean worktree.
- Candidate is rebased onto local `origin/main` `b15d266`, exactly 8 commits
  ahead with 14 intended changed paths. Backup ref
  `codex/v2_1-signing-review-security-pre-rebase-20260813` still points to
  `4afe1c0`.
- Final local RC checks passed: ancestry/path/backup verification, API conflict
  marker scan, `git diff --check`, Apps Script and affected-test syntax checks,
  and Phase 129–132/138/140 runtime mocks.
- `npm run validate` was not successful in the isolated candidate because it has
  no `package.json`; this remains an explicit validation limitation.
- No push, PR, merge, schema migration, Production access or verification,
  Apps Script deployment, Pages publication, LINE/Make action, or other
  external write occurred in this close-of-day review.
- Next starting point: obtain separate explicit authorization for a publication
  review (push/PR or merge) or keep the candidate local. Production verification
  remains a separate gated action.

## 2026-08-21 close-of-day addendum

This is a durable handoff for the authorized Production frontend endpoint
alignment and the subsequent correct-account verification. It does not classify
the dirty root tree as a release tree.

- Actual root repository state: branch
  `codex/reopen-room-603-live-20260816`, HEAD `6a691bb`; 174 porcelain entries
  (48 modified tracked paths, 126 untracked paths, 0 staged paths). Preserve
  this aggregate; do not stage, clean, reset, or deploy it as a whole.
- The isolated frontend fix was completed in
  `/private/tmp/cmwebs-landlord-initiated-contract-flow-20260816`, branch
  `codex/fix-frontend-production-api-20260820`, commit `e6f67ba`. It aligned
  the production landlord/tenant HTML entrypoints with the active Apps Script
  deployment 114 and added stale-endpoint regression coverage.
- PR #44 was merged as `696f2b1`. GitHub Pages deployment run `32353771722`
  completed successfully. The public HTML was read back and contained the
  active deployment reference in all five checked pages.
- Apps Script production deployment 114 was verified with the isolated
  production clasp configuration. This follow-up did not change the Apps
  Script deployment or write business data.
- Correct Chrome profile verification used `saas / cmwebs.saas@gmail.com`. The
  production contract-management page loaded and displayed the management UI
  instead of remaining on the loading state.
- Observed current account data on that page: 2 total applications and 0
  pending landlord-initiated contracts. The page-load blocker is fixed, but
  the expected room-202 invitation is not confirmed in the contract-request
  list; QR/link re-generation for that record remains an unresolved UAT item.

### 2026-08-21 validation evidence

- Root `npm run validate`: PASS; 69 unique routes, 69/69 handlers, no duplicate
  top-level declarations, no blocking credential findings, no missing HTML
  links. The validator emitted the existing warning that local
  `apps-script/.clasp.json` must remain ignored.
- Root `node --test tests/*.test.mjs`: PASS, 9/9.
- Root `git diff --check`: PASS.
- Isolated frontend candidate tests: PASS, 41/41; isolated project validator:
  PASS, 81 unique routes and 81/81 handlers.

### Next starting point

First reconcile the dirty root against the isolated merged Pages commit, then
use the correct `saas` account to trace why room 202 is absent from
「房東發起合約」 and verify the persisted invitation record before changing
any production data or adding a re-generation action.

## 2026-08-23 close-of-day addendum

This is a durable handoff for the bounded landlord tenant-binding invitation
release. It does not classify the dirty root tree as a release tree.

- Root repository remains on branch
  `codex/landlord-contract-documents-selfie-20260821`, HEAD `6a691bb`.
- Root status was freshly inspected at close: 178 porcelain entries, 49
  modified tracked paths, 129 untracked paths, and 0 staged paths. Preserve
  this mixed aggregate; do not stage, clean, reset, rebase, or deploy it as a
  whole.
- The approved frontend change was isolated in
  `/Users/hans/CMWebs/cmwebs-liff/.worktrees/tenant-binding-share`, branch
  `codex/tenant-binding-share-20260822`, commit `36ddb07`.
- PR #52 was merged to `main` as `e6b0cfb`. GitHub Pages deployment run
  `32579725681` completed successfully. Public
  `landlord-tenants.html` returned HTTP 200 and contained the released
  `tenantBindingInviteUrl` function and the `邀請綁定` label.
- The release adds an unbound-only landlord tenant-list invitation action;
  mobile/LINE uses native sharing, desktop uses clipboard/legacy copy, and the
  invite URL does not include tenant personal data. The tenant bind return route
  now reuses the fixed release version instead of a timestamp.
- Apps Script, Google Sheets, Properties, triggers, LINE settings, and business
  data were not changed by this release.

### 2026-08-23 validation evidence

- Isolated candidate `node --test tests/*.test.mjs`: PASS, 44/44.
- Isolated project validator: PASS, 81 unique routes and 81/81 handlers.
- Static release-cache validator: PASS; 59 safe version uses, 44 API
  anti-cache keys, 0 remaining static cache-bust violations.
- Isolated `git diff --check`: PASS.
- Public source readback: PASS, HTTP 200; last-modified `2026-08-22
  14:47:36 GMT`; one `邀請綁定` match and one `tenantBindingInviteUrl` match.

### Remaining UAT / next starting point

- Actual phone UAT remains user-side: use the official landlord LINE entry,
  open an unbound tenant card, tap `邀請綁定`, and confirm the phone share sheet
  opens and the tenant can complete binding with their own LINE and stored
  phone number.
- The root dirty aggregate remains unrelated and unclassified. Next `開工`
  should first re-read this state, inspect root Git status, and continue only
  from an explicitly scoped isolated worktree.

## 2026-09-05 close-of-day addendum

This is a durable handoff for the bounded room-202 initial management-fee
credit visibility correctness fix. It does not classify the dirty root tree as
a release tree, and it does not record a Production Sheet write.

- Root repository at close: branch
  `codex/landlord-contract-documents-selfie-20260821`, HEAD `6a691bb`;
  `180` porcelain entries, `107` modified entries, `131` untracked entries,
  and `0` staged entries. Preserve this mixed user WIP; do not deploy it as a
  whole.
- The isolated release worktree is
  `/Users/hans/CMWebs/cmwebs-liff/.worktrees/fix-202-management-credit-visibility-20260905`,
  branch `codex/fix-202-management-credit-visibility-20260905`, commit
  `525d9fc`, with a clean worktree.
- PR #107 was merged to `main` as `a5687ed`. The release changes only the
  GitHub Pages landlord billing UI and regression coverage: when the initial
  bill credits rent but leaves management fee unpaid, the landlord can still
  see and apply the explicit `首月租金＋管理費已於簽約時收取，套用折抵` action.
- GitHub Pages deployment run `33934726070` completed successfully for merge
  commit `a5687ed`; public `landlord-billing.html` readback contains the
  management-fee-aware credit condition. Apps Script, Google Sheets,
  Properties, triggers, LINE settings, and business data were not changed by
  this release.

### 2026-09-05 validation evidence

- Full candidate regression from the preceding implementation run: `128/128`
  tests passed.
- Close-of-day targeted tests: Phase 227, Phase 225, and Phase 226 all passed.
- Candidate project validator: PASS; `84` unique routes, `84/84` handlers,
  duplicate top-level declarations `0`, blocking credential findings `0`, and
  missing HTML links `0`.
- Candidate `git diff --check`: PASS.
- GitHub Pages CI: run `33934726070`, status `completed`, conclusion `success`.

### Unresolved / next starting point

- The live 202 bill was intentionally not mutated. The landlord must use the
  authenticated 「更多」→「帳單與抄表」→`2026-09`→房間 `202` page and apply
  the explicit initial rent plus management-fee credit action. This is a
  financial data write and remains separate from the frontend release.
- Real authenticated iPhone/LINE LIFF acceptance remains `HUMAN_REQUIRED` /
  `UNVERIFIED`: the available Chrome session redirected to LINE Login and the
  mirrored iPhone was not in an authenticated LIFF session.
- Next `開工`: preserve the dirty root, start from `origin/main` at
  `a5687ed` or the isolated worktree, then perform authenticated landlord and
  tenant readback after an explicitly authorized 202 bill correction.
