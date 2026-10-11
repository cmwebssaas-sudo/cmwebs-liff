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

## 2026-10-12 — C2 local parity candidate

Independent C2 branch based on C1 `8f1191a`; recommended GPT-6.1 Sol/high due to
privacy and calculation parity. Owner explicitly approved the bounded summary
decision in `READ-PARITY-DECISION.md`. Home actions and tenant list opt in;
default/detail APIs retain full GAS data. Root checkpoint WIP was rechecked and
preserved. C1's actual three-day test continues unchanged, earliest time gate
October15 at05:39 Taipei; this candidate does not publish or merge ahead of it.

Generated219 read-only functions from13 canonical GAS source files, with source
SHA manifest and no eval/runtime VM. Twenty-table additive projection preserves
JSON scalar types, real source order, masked bank suffix and genuine Date cells.
Independent review found a Taipei month-boundary type-loss bug (home total
10300→20600), reproduced red and fixed by date-type metadata/rehydration; new
property owner rows now receive dirty marking. Existing optional room bridge
dependencies fail closed for GAS fallback instead of returning a false unbound
state. No V3 source rows or protected contract fields are added to replication.

Formal read-only metadata/header/key-column checks confirm the four existing
projection dependencies and unique tenant-view keys; optional bridge tables
absent. Only aggregate evidence is public. Actual GAS vs whitelist/local D1/HTTP
matches every field on six routes/both home sections with rich synthetic data.
Each entry100 samples: local p95 below50ms (4.833–6.371ms in the full run), not
remote/device proof. Affected28/28, unit863/863, Worker13/13, validate and
diff-check pass. Full suite retains the known missing external Core fixture
failure and four skips. Independent re-review passed all three corrections,
affected28/28 and Worker13/13 (p95 4.760–6.557ms); PR/CI pending. Production routes
all return503 until C3; C2 remote deployment/readback NOT_STARTED. Detailed
publication order and rollback are in `READ-API-PARITY.md`.

C2 draft [PR267](https://github.com/cmwebssaas-sudo/cmwebs-liff/pull/267) source
`fa3300e` is stacked on C1 and attached to this task. CI38178464204 rental and
read-worker both passed. It remains unmerged/unpublished while real C1
acceptance runs; independent C3 local work proceeds on its own worktree.

## 2026-10-12 — C3 local authorization candidate

Recommended GPT-6.1 Sol/high per work plan. Independent C3 worktree/branch based
on C2 `91da898`; root checkpoint WIP reverified and preserved. Owner approved
the authority amendment in `READ-AUTHORITY-DECISION.md`: each Worker read uses
an uncached, signed request-bound GAS confirmation and compares current primary
D1 authorization before loading scoped operational data. Performance must pass
before flags are enabled. No production source, secret, trigger or flag changed.

LINE provider claims alone may cache for at most five minutes; access never
caches. Email uses canonical session HMAC, current eligibility, revocation and
expiry. Missing/forged credentials and client identity/scope overrides fail
before data IO. Bound primary D1 queries, actor/membership identity checks,
canonical role/permission helpers and foreign-parent legacy guards preserve
six-route scope/parity. Additive migration0003 supplies existing Email metadata;
the generator appends migrations without rewriting provisioned files.

Independent review found and verified corrections for ambiguous Email aliases,
expiry during a slow lookup, foreign legacy parents, unbounded authority bodies,
and repeated Sheet scans in write-mode filters. Ten legacy rows now read one
three-table parent map per filter; the next filter rereads after mutations.
Real local workerd/D1 HTTP plus the original GAS authority functions reject
source-only undelivered LINE/Email revocation/disable/role changes, forged or
replayed authority responses, dirty/receiving/stale snapshots and foreign scope.

Generated234 canonical functions from15 files. Affected68/68, unit884/884,
Worker19/19 including dry-run, validate72 backend files and diff-check pass.
Full suite retains the documented missing external Core/PG fixture failure and
four skips; external integration acceptance is not claimed. Independent review
found no remaining P1/P2 source issue; added LINE-only authority coverage was
independently verified1/1 PASS. C3 PR/CI pending. Real C1 observation, live
Google redirect/authority latency, binding/secret readback and device acceptance
remain required. Release order and rollback are in `READ-AUTHORIZATION.md`.

C3 draft [PR268](https://github.com/cmwebssaas-sudo/cmwebs-liff/pull/268) is
stacked on C2 and attached. Source `c665325`, test isolation `15e331f`.
Initial CI38181553601 rental passed; Worker failed its unchanged50ms local p95
gate (arrears94.676ms) while independent test files competed for workerd/CPU.
Worker files now run serially to isolate the same100-sample benchmark, without
relaxing thresholds. Local19/19 passed with p95 1.928–2.411ms; CI38181810348
rental/read-worker both passed. This is local single-request calculation
evidence, not authenticated network latency or concurrent throughput.

## 2026-10-12 — C4 local routing candidate

Recommended default gpt-5.6-terra/medium; GPT-6.1 Sol/high retained for
authorization/fallback races. Independent C4 branch/worktree stacked on C3
`3bb03e9`. Root checkpoint WIP preserved. Six centralized flags remain off and
endpoint blank; no formal publication/configuration/trigger change occurred.

Shared browser routing supports off, shadow and on. Worker bearer stays in
headers; invalid configuration/query/detail modes use GAS. On mode has a real
three-second deadline covering body validation and immediately falls back.
Shadow renders GAS only and sends bounded redacted field paths plus separate
header/full-response timing; failed Worker reads are distinct from zero diffs.
No comparison values, actor/scope IDs, dynamic object keys or credentials enter
reports. C5's authenticated receiver and real seven-day coverage remain pending.

Successful writes persist a two-minute numeric guard across page navigation,
including protected bridge and legacy LINE JSONP. Concurrent Worker completion
is rechecked. Independent review reproduced quota recovery, two-page bypass
and incomplete timing defects; all were corrected with actual module/page VM
regressions. Six actual HTML wrappers × LINE/Email now reach the shared API;
arrears still restricts unsupported desktop actions before dispatch. Existing
snapshot keys are unchanged. The guard conservatively covers other browser
Workspaces during the same short interval without storing identifying data.

Release references advanced to `20261012-read-routing-v1` across40 root HTML
pages and affected shared assets/tests/validator. Affected54/54, unit897/897,
validate72 backend files and diff-check pass; independent review53/53 plus9/9
release checks found no remaining source blocker. Full suite897 pass, one known
external Core/PG fixture failure and four skips. An artificial zero-ms callback
timer raced the five-ms Phase193 test deadline under full-suite CPU load;
synthetic callback now uses a microtask, preserving timeout/retry assertions,
and isolated/full reruns passed that test. C4 PR/CI pending. Publication/readback,
authenticated performance and device acceptance follow preceding gates and
`READ-ROUTING.md` rollback. C1 actual72-hour gate remains running unchanged.

C4 draft [PR269](https://github.com/cmwebssaas-sudo/cmwebs-liff/pull/269) is
stacked on C3 and attached; source/record `ea193f3`. CI38182426724 rental and
read-worker passed. It remains unmerged and unpublished while preceding actual
gates run. Independent C5 worktree starts from this candidate with flags off.

## 2026-10-12 — C5 local shadow candidate and approved clock boundary

Recommended model/speed GPT-6.1 Sol/high per approved plan. Independent C5
worktree/branch starts from C4 `0af14ca`; root checkpoint WIP preserved. All
flags off/endpoint blank. No formal deployment/configuration/property/trigger
or data change. C1 actual72-hour gate continues unchanged; actual C5 seven-day
observation is NOT_STARTED.

Implemented current-authority POST telemetry with strict metadata bounds,
server-timed read attempts and single-use route/section/release-bound receipts,
atomic report/diff/clock writes and concurrent rate enforcement. Independent
review reproduced missing actual-read proof, hidden eighth-day errors, pending
attempt acceptance and report-boundary misattribution; each was fixed with
actual local D1/browser or export regressions. Busy-browser timer delays also
cannot extend the unchanged3000ms read deadline.

The owner explicitly approved separately recording the exact generation-clock
paths in `READ-CLOCK-DECISION.md`, canonical ISO and at most60s apart. Financial
fields, counts, order and source-row timestamps remain exact; API/rendering is
unchanged. Clock metadata is separately persisted/exported, never silently
ignored. A shared-clock synthetic oracle now uses one Date constructor for
native source-cell rehydration and calculation, avoiding a false instanceof
mismatch in the end-to-end browser test.

Unit902/902, Worker24/24 including dry-run and validate72 backend files/40
endpoint references pass. Full902 pass/1 documented missing external Core/PG
fixture failure/4 skips. Independent review found no remaining source blocker;
focused clock boundary/D1 rollback checks pass. Actual HTTP/browser clock
storage is verified locally, not a real observation day. Release references
advance to `20261012-read-shadow-v1` across40 root HTML pages. C5 PR/CI pending.

Real exports cover the whole epoch and latest seven complete24-hour windows;
errors/missing/pending reports anywhere in the epoch remain blocking. Candidate
aggregate eligibility never replaces verified remote export, authenticated
performance or device acceptance. Publication sequence and rollback are in
`READ-SHADOW.md`; retain all metadata/replica data and prior deployment versions.

C5 draft [PR270](https://github.com/cmwebssaas-sudo/cmwebs-liff/pull/270) is
stacked on C4 and attached; source `9c72fd4`. CI38185484575 rental and read-worker
both passed. Focused independent actual browser clock case1/1 passed after the
oracle fixture repair; all required local source checks are complete. This is
still an unpublished candidate, with preceding actual/time/device gates pending.
