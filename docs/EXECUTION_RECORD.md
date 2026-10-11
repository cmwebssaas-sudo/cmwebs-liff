# CMWebs Execution Record

This ledger records bounded execution evidence; it does not authorize a release.
Read `AGENTS.md`, `CMWEBS_CODEX_HANDOFF.md`, and its authoritative document set
before the next task. Historical root-checkout records are user WIP and were
not copied into this worktree.

## 2026-10-12 — R0 production records reconciliation

Recommended model/speed: `gpt-5.6-terra` / `medium`.
Classification: V2 documentation and source reconciliation. Runtime unchanged.
Branch: `codex/r0-production-records-20261012`; clean worktree created from
fresh `origin/main` `2a5779f47505ba1c665b2cd172c9ca0b503fc839`.

The root checkout remains `codex/checkpoint-rental-wip-20261010`, HEAD
`be2cefe9e0cfbf575bc8e72e256b4c64f33e7b63`. Its three modified handoff
files and existing untracked files were preserved, with no staging or commit.
The root's execution record and handoff index are absent from current main;
this new ledger records R0 only, without importing stale root history.

### Current evidence

- Authenticated `clasp list-deployments` readback matched the recorded project
  and formal deployment SHA-256 fingerprints. The original Web App serves
  immutable **232**. All five deployment entries were identical before and
  after export; no deployment was changed.
- A fresh immutable v232 export contains **68 files**, all byte-identical to
  `apps-script/` at the main revision above. Its tree SHA-256 is
  `ebf03d14512a3b5767b80b3f4c2d0c31f8ff28d1de74efae9037a791d35e3326`.
  `verify-production-source.mjs --export` passed project, source-count and
  fingerprint checks. Historical backend source commit `1fe0e33` remains
  valid for this unchanged source; the prior UNKNOWN serving note is resolved
  by this fresh readback.
- Immutable versions **229** and **232** are present. The previous release's
  backend rollback is **229**; the baseline for the next backend release is
  current serving **232**. The top-level stale rollback value **228** was
  corrected to **229**, consistent with the existing release rollback record.
- PR [#261](https://github.com/cmwebssaas-sudo/cmwebs-liff/pull/261) merged as
  `4885a0e`; Pages run
  [38121570901](https://github.com/cmwebssaas-sudo/cmwebs-liff/actions/runs/38121570901)
  completed successfully. PR
  [#262](https://github.com/cmwebssaas-sudo/cmwebs-liff/pull/262) merged as
  `2a5779f`; Pages run
  [38151775414](https://github.com/cmwebssaas-sudo/cmwebs-liff/actions/runs/38151775414)
  completed successfully.
- `npm run verify:production` matched **61/61 existing manifest assets** to
  current main, byte-for-byte. The manifest was not expanded to legacy assets,
  and this check does not cover all publicly hosted documents or URLs.
  Current frontend release is **20261011-fast-navigation-v1**; the recorded
  old tag/revision/workflow were updated. Next frontend rollback reference is
  main **2a5779f**.

### Validation and remaining boundaries

- `npm test`: **822 pass / 1 fail / 4 skip**. The sole failure is
  `commercial-subscription.roundtrip.test.mjs`, requiring
  `PLATFORM_CORE_TEST_WORKTREE`. Cross-repository Core/PostgreSQL integration
  was not configured or run; no external database was connected.
- `npm run test:unit`: **822 pass / 0 fail / 0 skip**.
- `npm run validate`, immutable export verification, public readback and
  `git diff --check`: PASS.
- Cloud Apps Script test functions: NOT_RUN; this is documentation-only and
  does not authorize executing a formal function or writing test data.
- Physical LINE, current-build authenticated acceptance, latency/render
  measurement and capacity acceptance: **HUMAN_REQUIRED**. Historical
  measurements remain historical; this task provides no new speed result.
- No merge, deployment, version creation/deletion, Script Properties, trigger,
  Sheets, Cloudflare or LINE change was performed.

### Next work and release control

The plan was read from local branch
`codex/cloudflare-read-path-plan-20261011`, commit
`aeebf7bf2a4893173f1af175ed8a0ade855acbe6`, paths
`docs/CODEX-WORKPLAN-2026-10-12.md` and
`docs/CLOUDFLARE-READ-PATH-PLAN.md`; those files are not yet in main.
Follow **R0 → S1 → C0 → C1…**, with one isolated worktree and PR per work order.
S1 uses privately supplied instructions; no private content belongs in this
ledger, Git, PR descriptions or commit messages.

This R0 PR changes records only. Before merging, obtain the user's action-time
approval: a main merge may run the normal Pages workflow and publish these
records. No Apps Script or Cloudflare release is needed. To undo the record
change, revert this PR through a separately approved main update; do not roll
back runtime or business data for a documentation correction. Recheck the
serving/export/Pages baseline before any later release.

## 2026-10-12 — S1 request compatibility candidate

Recommended model/speed: `GPT-6.1 Sol` / high, as specified by the work plan
for identity and authorization changes. One clean worktree from R0 merge
`37b362c`, branch `codex/s1-verified-identity-20261012`. Root WIP is preserved.

The owner's current batch authorization supersedes the earlier action-time
approval rule for plan-scoped commit/push/PR/merge, deployment and configuration.
New costs, deleting production data, scope expansion and owner-only login,
payment or physical acceptance still require owner action. Private instructions
and owner account checks are kept outside Git.

Candidate: shared LIFF credential transport, corresponding dispatcher
compatibility and stable frontend tag `20261012-line-identity-v1`. Email bridge
and native exchange protocols remain covered by regression tests. No Schema or
route addition. The public asset manifest includes `liff-request-auth.js`; its
serving readback is pending. Existing serving backend remains v232 until a
verified deployment is recorded.

Release order: review and CI, merge this work order's PR, then confirm Pages
bytes. Wait at least 15 minutes after publication and obtain physical LINE
acceptance of the compatible frontend. Export the still-serving backend and
confirm the immutable rollback version before publishing the backend to the
original deployment. Read back editor and immutable version, then verify LINE
and Email reads plus the plan's harmless operation. Until those checks finish,
S1 remains incomplete. Independent C0 preparation may proceed while the
physical gate is pending; it does not satisfy that gate.

Rollback: restore the verified prior Apps Script serving version (currently
v232) on the same deployment; the compatible frontend can remain. If the
frontend itself needs reversal, revert this PR through a reviewed PR and
confirm Pages readback. Do not delete or rewrite business data for rollback.

Independent review required additional credential coverage for existing LINE
POST consumers. The shared principal resolver and direct POST consumers now
use verified identity; their frontend POST data and Email-session compatibility
are covered by real-function synthetic tests. No route or Schema addition.

Local release checks: `npm run validate` passes (69 backend files parsed,
40 endpoint references, stable navigation cache checks). `npm run test:unit`
passes 835/835, no skip. `npm test`: 840 total, 835 pass, 1 known environment
failure and 4 skips; the sole failure is the pre-existing cross-repository
commercial roundtrip requiring `PLATFORM_CORE_TEST_WORKTREE` and a disposable
Core/PostgreSQL environment. No production database was used to replace that
integration fixture. Focused identity tests execute 13 policies, including all
31 standalone JSONP transports and existing LINE POST consumers.

The tenant mutation inventory includes contract-request cancellation and
renewal-intent compatibility alongside submission routes; native exchanges
retain their independent verified protocol. Review remediation and deployment
acceptance remain separate from these synthetic test results.

Independent review completed after remediation: original findings resolved,
no remaining actionable major finding. Reviewer reran 40 relevant tests
(including 13 identity policies), validate and diff-check successfully.
This is source/synthetic acceptance only; staged production checks remain.

## 2026-10-12 — C0 local read API environment

Recommended model/speed: `gpt-5.6-terra` / medium. Independent worktree and
branch `codex/c0-read-api-environment-20261012` start at S1 merge `b8f62f0`.
Root WIP remains untouched. C0 adds a pinned Wrangler/Miniflare package,
local D1 binding, read-only health endpoint and independent CI job. Remote
account readiness is UNVERIFIED; no paid plan, Worker, D1 or Secret is created.

S1 publication readback: PR264 merged `b8f62f0`, Pages run38169983258 succeeded,
62 public assets matched the candidate on 2026-10-12. The serving backend is
still v232. Its staged wait and physical LINE gate remain pending; C0 local
acceptance cannot replace them. Current frontend metadata records that split.

C0 tests execute real workerd and local D1, preserving synthetic fixture rows
while checking health, unsupported methods and unavailable bindings. Local
dry-run bundles successfully without uploading. No operational read route,
schema, synchronization or frontend flag is introduced. C1 requires verified
account access and APAC D1 placement; new costs and owner login/payment remain
owner-only actions under the batch authorization.

Rollback: reviewed source/CI revert; C0 has no remote runtime or data changes.
Later deployment requires its own version/configuration readback and rollback.

Local checks: Worker tests 2/2, `npm run validate`, `npm run test:unit`
835/835 and `git diff --check` pass; Worker dry-run exits without upload.
`npm test` retains the same single missing `PLATFORM_CORE_TEST_WORKTREE`
integration-environment failure (835 pass, 4 skips). Independent read-only
review found no blocking issue. Node22/Linux acceptance is supplied by the
PR's two actual CI jobs before merge; local checks used Node26/macOS.
CLI read-only `whoami` confirms an existing OAuth login, without publishing
account identifiers or credentials; Paid plan and provisioning target still
require read-only verification.

## 2026-10-12 — S1 staged backend publication and C1 candidate

S1's frontend physical gate was owner-confirmed after the required wait.
Fresh authenticated exports confirmed serving v232 and editor HEAD matched the
recorded 68-file rollback baseline. The reviewed S1 candidate was pushed and
exported byte-for-byte, then immutable v233 was exported and matched all69 files.
The original formal Web App deployment now reads back v233 at the same URL;
the other4 deployments are unchanged. A synthetic anonymous protected read
returns `AUTH_REQUIRED`. Rollback retains v232 and its fresh editor export.
Post-backend owner confirmed LINE reads, harmless notification acknowledgement
and desktop Email reads normal; staged S1 acceptance passed. No Properties, trigger or formal business data changed.

C0 PR265 merged `32a5820`; PRCI38170596031 and mainCI38170676231 passed,
including Node22/Linux Worker tests. Pages38170676045 succeeded and all62
published assets matched. The owner selected the existing Cloudflare account
and undertook its plan upgrade; the latest authenticated readback still showed
Free. Paid readiness must be read back after payment before provisioning.

C1 uses independent branch `codex/c1-read-replica-sync-20261012`, based on
`32a5820`. Recommended model/speed: GPT-6.1 Sol / high. It adds generated
16-table projections, bounded signed snapshot ingestion, dirty generation
sync, explicit dispatcher dependencies and immediate session revocation patch.
Review found incomplete mutation detection; the keyword heuristic was replaced
by explicit route policy plus full dispatcher inventory regression. Empty
webhook acknowledgements are excluded from dirty marking. Source review and
tests are distinct from remote acceptance; the three-day test remains
NOT_STARTED. Keep this work order's PR draft until that gate passes.

Local unit suite847/847 passed including the empty-webhook regression;
the full suite retained only the existing missing `PLATFORM_CORE_TEST_WORKTREE`
integration-environment failure (846 pass,4 skips). Final test counts and review
will be recorded with the candidate. No test uses formal Sheets or sends LINE.
See `READ-REPLICA-SYNC.md` for release, quota acceptance and rollback.

Final C1 source review passed after mutation-inventory and empty-webhook fixes.
Reviewer executed the real webhook/dispatcher fallback: empty or skipped events
mark zero tables, a processed event marks all16. Unit847/847, affected sync12/12,
Worker10/10, validate and diff-check pass. The full suite's existing external
Core fixture remains unavailable. Draft PR/CI are source evidence only; remote
three-day acceptance and formal synchronization publication are NOT_STARTED.

## 2026-10-12 — C1 isolated remote acceptance started

Authenticated Cloudflare readback confirms the selected account's Workers Paid
subscription. A separate synthetic-only D1 reports APAC placement. Test Worker
version `aa544a72-5113-469a-80ba-dde6fabc1c2e` binds only that test database and
an encrypted sync Secret. Remote health passed; bad HMAC returns401 and nonce
replay409. Owner entered the test Apps Script Secret; only presence was read
back. The bound test project has four exported byte-identical files, limited
current-Sheet/external-request/own-trigger scopes and no production credential.

Initial real GAS-to-Worker full sync passed16 tables/531 rows, including501
rooms split into500+1 batches, in43,436 ms. D1 readback matched every table count
and removed only the prior disposable probe rows. Immediate synthetic session
revocation passed in1,433 ms; D1 readback confirms revoked state. Two own test
timers (one-minute and daily hour03 Asia/Taipei) were installed at05:19 Taipei.
The authenticated execution table records44.304 seconds for the manual full
run and3.152 seconds for the manual revocation test.

Early idle timer executions took2.547/2.446 seconds due to an unnecessary
synthetic-wrapper Sheet identity read. Removing it preserves a local project
guard; the next actual idle execution took0.591 seconds. The source now also
uses one bulk cache read to discover dirty markers. Generation checks after
sends remain unchanged. Final test source was pushed and exported identical
at05:23; restart the72-hour observation window from that source revision.
The account is consumer Gmail, with90-minute daily timer allowance. Full
daily trigger totals must include idle/failure/overhead records and remain
below15 minutes; wrapper timing is insufficient. No formal Sheet, Properties,
trigger, operational read route or serving backend changed. C1 remains draft;
three actual days and formal publication are not yet accepted.

Affected GAS tests13/13 and unit848/848 pass; validate passes. Keep rollback
limited to the two test timers/test endpoint while formal backend remainsv233.

Further C1 idle correction at05:39: retrieve signing configuration only after
bulk discovery finds pending work. Idle has zero Properties/Sheet/network/lock
calls; pending/full still validate configuration before IO. Independent review
verified missing/invalid configuration preserves markers and prevents IO,
disabled business dirty marking remains cheap, and concurrency protection is
unchanged. Tests13/13, unit848/848 and validate pass. Four test files were
exported byte-identical. Restart the72-hour gate from this final test revision;
earliest time eligibility is2026-10-15 at05:39 Taipei, subject to all actual
daily correctness and complete runtime evidence. Earlier observed executions
remain part of daily totals. No production publication occurred.
