# CMWebs V2.1 Codex Execution Record

**Status: AUTHORITATIVE V2.1 execution record**
**Last updated: 2026-09-02 (Asia/Taipei)**

## Purpose

This record separates V2.1 authorization and execution from Gate 0 source
reconciliation and from live Production claims. It is a work-control record,
not a deployment record or authorization for external actions.

## Canonical source baseline

Gate 0 source reconciliation is complete:

- The approved source commit `9a17c4bd2719d4cdb24058d4d797bd9281e4b06e` is
  byte-identical to the read-only immutable Apps Script Version 89 export
  across all 43 source files.
- GitHub PR #12 merged that exact source tree to canonical `main` as
  `747b484f871c18985cf414e6640ae04afe8303a1`.
- Static verification covered 42 JavaScript syntax checks, eight focused
  checks, `git diff --check`, and a sensitive-credential scan.

This baseline does not establish a current serving version, deployment state,
rollback target, runtime result, or external account state. Each of those must
be verified for the particular action that needs it.

## Recorded V2.1 authorization

| Date | Authorized unit | Boundary |
| --- | --- | --- |
| 2026-08-03 | Documentation authority-baseline synchronization | Only this record, `CMWEBS_CURRENT_STATE.md`, and `CMWEBS_CODEX_HANDOFF.md`; isolated local branch and local commit only. No push, deployment, Production access, runtime test, or source implementation. |
| 2026-08-04 | Landlord-home request-local snapshot candidate | Isolated local source/test candidate only. It enables the existing snapshot for `landlord_home_bootstrap` and adds a focused mock; no cross-request cache, push, deployment, Production access, or external action. |
| 2026-08-13 | Native landlord contract-signing review security repair | Explicitly authorized isolated V2.1 candidate only. Uses server-verified review sessions, Workspace/RBAC revalidation, serialized final decisions, and approval-time artifact checks; no deployment, schema migration, Production access, push, PR, merge, or external action. |
| 2026-08-27 | Renewal contract-history and 30-day offer formal release | Explicitly authorized implementation, additive Production schema migration, Apps Script deployment, GitHub Pages publication, push, PR, and merge. Uses append-only `V2_contracts` versions, renewal document carry-forward references, signature-only renewal, landlord-review routing under 30 days, and read-only history views. LINE/mobile UAT remains separately `HUMAN_REQUIRED`. |
| 2026-08-27 | Workspace-native landlord contract-history route repair | Explicitly authorized local repair after room-603 Production verification found the serving `landlord_tenants` payload omitted `contract_history`. Scope is isolated source, regression test, and documentation only; no deployment, Production data write, push, PR, merge, or external action is authorized by this record. |
| 2026-08-28 | Room-603 contract-history corrective release | User explicitly authorized push, merge, Apps Script deployment, GitHub Pages publication, and re-verification. PR #59 restored the native `contract_history` route; PRs #60–#62 fixed the history-card rendering helpers. Apps Script Version 131 serves the existing Web App deployment and Pages workflow `33099332347` published merged `main` `7711dea`; public 603 smoke readback passed. No schema or tenant-data migration was run. LINE/mobile signing acceptance remains `HUMAN_REQUIRED`. |
| 2026-09-01 | Renewal-draft date-correction formal release | User explicitly authorized formal deployment. PR #74 merged `codex/renewal-draft-date-20260901` as `3f6af936`; Apps Script Version 139 serves the existing Web App deployment and Version 138 is the rollback target; Pages workflow `33449180375` published the merged source. No Sheet, Properties, Trigger, LINE, or contract-data write was run. Public route/page readback passed; LINE/mobile date-edit acceptance remains `HUMAN_REQUIRED`. |
| 2026-09-01 | Landlord-led renewal consent formal release | User authorized formal deployment. PR #76 merged the feature as `52b75b8`; PR #77 moved the production HTML API references to immutable Apps Script Version 140 and merged as `ceeede8`; Pages workflow `33456765735` completed successfully. The prior read-only HEAD endpoint remains retained and Version 139 is available as the previous immutable release. No Sheet migration, LINE push, or contract-data write was run; authenticated LINE/mobile UAT remains `HUMAN_REQUIRED`. |
| 2026-09-01 | Landlord homepage timeout corrective release | User authorized the corrective formal release. PR #79 merged the request-local Sheet-read cache repair as `d9c371c`; the existing fixed Web App deployment now serves immutable Version 142 and Pages workflow `33483720012` completed successfully. No Sheet row, Property, Trigger, LINE, contract, or billing data was changed. Authenticated LINE/mobile dashboard UAT remains `HUMAN_REQUIRED`. |
| 2026-09-02 | Landlord-led renewal and checkout formal release | User requested deployment after implementation confirmation. PR #90 merged the release as `3d8647d`; Apps Script Version 147 serves the existing Web App deployment and Version 139 remains the rollback reference. The additive-only renewal/checkout schema migration completed in the authenticated Apps Script editor. Pages workflow `33567151637` completed successfully. No contract or tenant rows, Properties, triggers, or LINE data were changed; authenticated LINE/mobile UAT remains `HUMAN_REQUIRED` / `UNVERIFIED`. |

## 2026-08-27 formal release evidence

- Candidate branch `codex/renewal-contract-history-20260827` passed the full
  Node suite (`55 pass, 0 fail`), candidate validator (`83/83` routes and
  handlers), duplicate declaration scan (`0`), credential scan (`0`), and
  `git diff --check`.
- Apps Script was pushed from the isolated candidate using a safe release
  configuration and deployed as immutable Version 130 on the existing Web App
  deployment. The Web App URL was preserved.
- The additive-only migration runner was executed twice from the authenticated
  Apps Script editor; both execution records show `已完成`. The migration
  appends missing renewal/request/document headers only and is idempotent.
- GitHub PR #56 merged the candidate into `main` as commit `7452416`. Pages
  workflow `33054940344` completed build, deploy, and status-report jobs.
  Public readback found `房客合約`, `合約版本紀錄`, and
  `查看完整合約與簽名`.
- `HUMAN_REQUIRED`: real authenticated LINE/mobile room-603 renewal/signing
  and post-release contract/signature rendering were not performed in this
  release evidence.

## 2026-08-25 explicitly authorized tenant signature-preview release

The user explicitly authorized the fixed Google Docs template tenant-signing
repair and deployment. The scope was limited to the standard digital-contract
path: write the stored tenant signature into the private signed document,
return the private signature image in the mobile text preview, and bust stale
tenant entry-page caches. The supplied fixed template, signing schema, and
existing mobile flow were preserved.

- Apps Script target verification preceded the push. The existing Web App URL
  was retained and its immutable serving version was updated to Version 125.
- GitHub Pages was published through the repository workflow; the final source
  commit was `9e18425` and the final workflow was `32793428257`.
- No Google Sheets rows, Script Properties, triggers, LINE/LIFF settings, or
  tenant data were changed by this release.
- Local and public static verification passed, but real authenticated
  LINE/mobile room-603 UAT remains `HUMAN_REQUIRED`. Deployment success is not
  treated as signing acceptance.

The source candidate is not canonical Git `main`, deployed Apps Script, or
Production-performance evidence. It requires separate review and authorization
for every later integration, publication, deployment, or runtime verification.

## Local validation record

- Existing Phase 130–132 tenant-signing mocks passed locally. These prove only
  their mocked session, artifact, and submission paths; they do not establish
  LINE, Drive, LIFF, or Production UAT results.
- The Phase 137 landlord-bootstrap snapshot mock passed locally. It proves one
  request reuses one sheet snapshot and that a second request starts fresh.
- `git diff --check` and JavaScript syntax verification passed for the local
  snapshot candidate. The isolated checkouts used for this work had no
  `package.json`, so `npm run validate` was not applicable there.

## 2026-08-13 native signing-review candidate validation matrix

The candidate branch is
`codex/v2_1-signing-review-security-20260813`. This is local evidence only;
it does not establish LINE, Drive, LIFF, Apps Script serving, or Production
state.

| Boundary | Focused evidence | Result |
| --- | --- | --- |
| Server-verified landlord identity | Phase 140 session exchange and forged-token denial | PASS |
| Workspace and membership binding | Phase 138 cross-Workspace claim mismatch denial | PASS |
| Final decision serialization/idempotency | Phase 138 lock, approval, rejection, and opposite-finalization checks | PASS |
| Approval artifact fail-closed behavior | Phase 138 missing/removed required artifact check | PASS |
| Tenant signing compatibility | Phase 129–132 runtime mocks | PASS |

The focused runtime mocks, Apps Script JavaScript syntax checks, test-module
syntax checks, and `git diff --check` passed on 2026-08-13. `npm run validate`
was attempted but this isolated candidate has no `package.json`, so the npm
validation command is unavailable there. No Apps Script runtime or Production
verification was performed.

## V2.1 scope boundary

Allowed V2.1 work remains limited to the approved Internal Operations
Completion scope: performance consolidation, fixed operational reporting,
standard digital-contract completion, backup/restore/runbook work, and real
operational-cycle verification. It must not introduce V3/V4 functionality,
architecture redesign, speculative refactoring, or customer-specific branches.

Existing native-signing code remains subject to the documented contract:
server-derived `signing_mode`, verified session and artifact, private
fail-closed access, normal-renewal signature-only flow, and an idempotent
submission that cannot activate a contract or fabricate approval. This records
the existing boundary; it does not authorize a new feature, UAT, or deployment.

## Next-work gates

| Candidate work | Required authorization and preflight |
| --- | --- |
| Local source or test change | Separate explicit scope, isolated branch, affected tests and documentation. |
| Backup/restore rehearsal | Separate explicit scope, target and data-handling preflight, and a stated rollback plan. |
| Production read-only verification | Separate explicit scope with account and exact target identity verification. |
| Production write or deployment | Separate explicit authorization after target, serving version, deployment, rollback, and impact checks. |
| LINE, LIFF, Pages, Properties, triggers, or payment surface | Separate authorization for that exact external surface. |

V2.1 is complete only after separately authorized scope work and operational
evidence satisfy the product and release rules, at which point
`V2_FEATURE_FREEZE=FINAL` may be recorded. This document does not make that
declaration.
