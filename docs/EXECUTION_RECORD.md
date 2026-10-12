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

## 2026-10-12 — C6 independent acceptance preparation

Recommended GPT-6.1 Sol/high per approved work plan. Independent branch/worktree
starts from reviewed C5 source9c72fd4 plus evidence8f9b2c3; clean detached HEAD
was checked then feature branch created. Root WIP preserved. Existing authoritative
documents reviewed/unchanged across C4/C5; handoff/current state/ADR/performance
now distinguish recorded S1/C0 releases, C1 running days and C2–C6 candidates.
Initial preparation changed only documentation. Review then found a sequential
release defect: advancing asset cache tags invalidated C5 report identity and
requiring already-on pages to keep shadowing prevented later page qualification.
The necessary source repair is included below; no deployment/flag/Property/trigger
or operational-data change has occurred.

`READ-CUTOVER.md` specifies the exact page order, real-day/authenticated authority
latency prerequisites, published-build readback, physical LINE/desktop steps,
fallback/write guard and rollback with all formal data retained. Batch authorization
supersedes repeated per-page permission questions; owner login/payment/physical
acceptance and fee/deletion/scope exceptions remain. All C6 actual gates are
NOT_STARTED; no timing/performance result is claimed from this preparation.

C6 source repair: separate generated comparison identity from asset cache version,
check178 browser/GAS/Worker/contract/dependency source files in validation and
bind the receiver to its bundled identity. Pure central flag/cache publications
retain identity; included source/config changes invalidate it and restart real
observation. Per-page evaluator covers latest seven complete windows (home both
sections), retaining all epoch errors/missing/pending checks. Initial all-page
qualification and private accepted ledger remain required; no time gate relaxed.
Regression reproduced asset-tag coupling and already-on coverage failures RED,
then GREEN after repair. Candidate asset tag20261012-read-cutover-v1; all flags off.

C6 local source checks: unit905/905, Worker25/25 including dry-run, actual
D1/browser telemetry6/6, validate72 backend files/40 endpoint references and
178-file comparison verification pass. Full905 pass/1 known missing external
Core/PG fixture failure/4 skips. Included source changes require a new identity;
local synthetic windows do not start or satisfy real observation. Independent
source review and C6 PR/CI are pending; all formal flags remain off.

Independent C6 source re-review passed: the rollout identity/coverage defect and
Wrangler/nested-asset hash omissions are fixed. Focused19/19, latest comparison
regression1/1, actual HTTP6/6,178-file hash check and diff check independently
passed with no remaining P1/P2 source finding. Runtime binding/device/time gates
remain separate and pending. Public source closure includes entry/runtime config
and nested valuation/bundle manifests; no credential or operational data is hashed.

C6 draft [PR271](https://github.com/cmwebssaas-sudo/cmwebs-liff/pull/271) is
stacked on C5 and attached; source `f8c7b8c`. CI38186669747 rental/read-worker
both passed. No merge/publication/configuration/flag change; actual C6 remains
NOT_STARTED while preceding real gates run. Independent root status still
matches checkpoint `be2cefe` and the original three modified/untracked WIP groups.

## 2026-10-12 — C3 isolated real-Google feasibility preparation

Recommended GPT-6.1 Sol/high. A separate synthetic-only20-table/33-row Google
Sheet and bound Apps Script project were created under the existing batch
authorization. They do not share C1's running project, timers, database or
Secret. All20 headers and native Sheet views were verified, timezone is
Asia/Taipei, and the synthetic session-hash column is hidden. Google XLSX
conversion dropped four native date cells; only those cells in the new test
Sheet were restored and serial/date-format readback verified, including expiry.

The test project contains eight byte-identical canonical C3 authority/access/
identity/runtime/replica modules, a test-only lazy Sheet binding adapter, and
the manifest:10 files total, full-Sheets/external-request scopes, zero timers.
Local tests and independent review passed fixed project/title isolation, invalid
signature with zero Sheet IO, signed responses, replay/current source-only
revocation and role denial, and no HTTP Sheet/Property writes or auth-policy
override. All10 uploaded files were exported and compared byte-for-byte; the
manifest matched semantically. Only non-secret test binding/configuration was
saved and read back. Google initial execution now requests owner authorization;
that gate and owner entry of new test Secrets remain pending. No Web App
deployment or network performance result exists yet.

A private client is prepared to call the unchanged canonical Worker authority
function over actual Google HTTPS/redirects. Strict1500ms samples and separate
15000ms diagnostic samples retain failures and are never conflated. The lazy
openById/getName/Property adapter and33-row fixture are reported boundaries;
this cannot prove formal binding,500-room capacity, LINE provider/device
acceptance, seven-day shadow or final C6 latency. No formal source, deployment,
Properties, trigger, Cloudflare binding or flag changed.

## 2026-10-12 — C3 owner initial grant verified at14:33 Taipei

The owner confirmed the independent C3 project's Google initial authorization.
Authenticated editor execution at14:33:32–14:33:34 returned synthetic-only,20
tables and Asia/Taipei. A fresh API export at14:39 verified all10 uploaded
files against the reviewed local source (eight canonical modules, semantic
manifest equality). New test Secret entry/save remains an actual owner gate;
the two blank value fields and private local files are prepared. No test Web
App or formal deployment has occurred, and no actual authority-network or
performance acceptance is claimed.

C1 read-only follow-up: a transient Cloudflare management query returned7403
while CLI identity still included the selected account and D1 permission.
After identity verification, the same read-only query succeeded and confirms
the14:30 room snapshot completed501 rows/two batches at14:30:19.075 Taipei.
Node health returned200. No credential, account, source, timer or binding was
changed. Python urllib health received1010 and is retained separately as a
client-specific request rejection; it does not prove background sync failure.


## 2026-10-12 — Real Google feasibility and workerd redirect correction

Recommended GPT-6.1 Sol/high. The owner confirmed both new synthetic Secrets
saved. The independent bound test project was published as immutablev1, with
fresh editor/serving-version comparison of all10 files, fixed Sheet/project
identity, original test Web App readback and zero timers. Matching request and
response HMACs were verified by actual Email authority replies; Secret values
were never read back or logged. This changes no formal project or C1 environment.

Direct Node feasibility: all three canonical1500ms requests timed out; separate
15000ms diagnostics verified signatures/access successfully at3346.695,
4523.920 and5469.426ms full roundtrip. A separate protected Cloudflare test
Worker uses canonical identity/access/authority and a static33-row synthetic
fixture, no D1. Initial strict requests likewise all timed out; diagnostics
exposed an immediate failure constructing the second Google GET. Only changing
that diagnostic GET to manual yielded verified replies in2311–3294ms authority
time, while retaining every earlier failure and the unchanged acceptance limit.

Actual [workerd source](https://github.com/cloudflare/workerd/blob/main/src/workerd/api/http.c%2B%2B)
rejects redirect mode error. The canonical Google final GET and LINE provider
POST now use manual, followed by their existing exact200 check. No extra
redirect is followed, no token is forwarded, and the same1500ms deadline,
Google host/path allowlist, MAC/freshness/fingerprint and LINE claims remain.
Five actual-workerd transport regressions reproduced both former defects, then
passed: allowed Google reply, foreign first redirect, forbidden third hop,
LINE claims and LINE redirect rejection. Node identity/authority13, complete
Worker24, validate72 and independent review passed. This is a transport
correctness fix, not a timeout relaxation or provider/device acceptance.

The corrected canonical C3 modules were published only in the private test
Worker and its sole100% version/bindings/GAS URL read back. Strict1500ms still
failed3/3. Ordinary diagnostic replies passed3/3 at3073/3304/3386ms authority
and3241.605/3472.335/3553.702ms client time. Worker entry requests were served
from SJC; samples are not p95, full page latency,500-room capacity or formal
binding. The test-only GAS openById/getName/Property adapter and33-row fixture
remain explicit boundaries. Performance NOT_ACCEPTED; formal flags remain off.

Source-only tests used just the new synthetic Sheet, retained a narrow restore
plan and kept the deployed Worker fixture unchanged. Revoked Email session,
changed membership role and disabled user each produced three fresh signed
AUTH_REQUIRED denials over real Google HTTPS. These are15000ms diagnostics;
the normal1500ms path remains unavailable. They demonstrate current source
confirmation against stale static fixture access, not an actual remote D1
revocation, real LINE provider/device or shadow/cutover gate. All three edited
cells were restored and native bounded readback confirmed active/owner/active;
post-restore positive verification is recorded separately. No formal data,
configuration, source, deployment, triggers or C1 observation clock changed.

Restored synthetic source then passed three additional signed diagnostic
confirmations at2773/3480/3618ms authority time. The deployed static fixture
hash remains unchanged; all three negative groups and positive restore were
checked against expected signed outcomes. Strict performance remains failed.

Read-only follow-up on2026-10-12 at06:53 Taipei: disposable D1 returned the
synthetic room mutation from the06:30 timer, synchronized at06:30:19.826.
Earlier06:14 readback showed the06:00 mutation at06:00:19.544. The test source
remains `8f1191a` and four exported source files remain the recorded final
revision; these observations do not restart its72-hour clock. Actual observation
is RUNNING, earliest time eligibility October15 at05:39 Taipei. These partial
checks are not daily runtime totals or three-day acceptance. No production
source, Properties, trigger, flag or data mutation was performed by the probes.

C1 read-only partial-day check at2026-10-12 07:46 Taipei: remote synthetic D1
room mutation07:30 read back at07:45, `synced_at`23:31:34.247Z (07:31 Taipei).
Authenticated history154 total entries,147 timers all completed,308.771s total
platform duration/max82.534s; final-source subset128 timers278.816s. Six manual
runs52.631s and earlier unavailable API attempt0s/failed remain separate. This
is incomplete-day evidence, not daily quota acceptance. No source/config/timer
change; actual72-hour gate still RUNNING with earliest completion Oct15 05:39,
subject to all required complete-day correctness/runtime evidence.

## 2026-10-12 partial-day follow-up at08:26 Taipei

Authenticated execution history was refreshed and all193 entries loaded on one
page, through the08:25:14 timer:186 timers completed, zero timer failures or
running timers,379.907 platform seconds total and82.534s maximum. Six manual
editor runs and the earlier unavailable Execution API attempt remain separate.
This is complete history at the capture time, but an incomplete day; it does
not pass the15-minute daily target or the72-hour gate.

A separate read-only D1 check at08:40 found the08:30 synthetic room mutation,
server `synced_at`2026-10-12T00:30:20.251Z. No source, timer or configuration
change occurred. Final source remains `8f1191a`; earliest time eligibility is
October15 at05:39 Taipei, subject to complete daily reconciliation/runtime.

## 2026-10-12 — C1 actual result-code investigation

Authenticated history through08:47 was reconciled across two pages:215 total
entries,208 timers, all platform-completed,414.021 platform seconds/max82.534s.
This remains partial-day evidence. At08:54, the existing read-only
`readC1TestRuntimeTotals` function reported nine non-idle wrapper records, one
failure,227443 observed milliseconds. Wrapper totals include a manual full run
and exclude idle/platform overhead; they cannot replace daily trigger totals.

Actual Cloud logs identify the failure after the final05:39 source revision:
07:31's overlapping minute returned `success:false,code:SYNC_BUSY` (306ms
wrapper), while07:30's lease-owning sync completed at07:31:36 with `OK`, one
table, empty failed-table list,77684ms core/80882ms wrapper. The busy record is
retained; platform-completed does not imply function success. D1 readback
confirms the owning snapshot completed501 room rows/two batches.

Remote room sync metadata shows the07:30 source-version timestamp preceded
the first recorded Worker post-validation timestamp by72540ms, with1632ms
between the two recorded post-validation timestamps.
The08:00 sample was26060ms/1547ms;08:30 was1687ms/1603ms. These are boundary
timestamps, not exclusive CPU, fetch or database duration. They locate the
large delay before that first recorded timestamp. Worker records it only after
body/HMAC/per-row hash validation; GAS preparation, network and Worker
validation remain combined, so no exact layer/root cause is established.
Keep the complete-day15-minute target and actual72-hour gate unaccepted; do
not extrapolate partial data into a passed day or discard the busy outcome.

A fresh API source export at08:54 confirmed all four files still match the
recorded final test source. No source, timer, Properties, formal backend or flag
changed; the existing observation clock was not restarted.

Reviewed direct stale-version diagnostic on the isolated C1 Worker: current
sole version/D1 binding and a newer completed `V2_rooms` snapshot were checked
live before signing-key access and diagnostic POSTs. Six actual signed1/500-row
requests all returned409
`STALE_SNAPSHOT` before writes. Full500-row roundtrips were1250.205/619.488/
1332.480ms; one-row roundtrips801.522/419.163/409.409ms. This excludes GAS, is
not CPU-only or p95/capacity acceptance, and does not identify the earlier
transient delay's root cause. D1 post-readback found zero probe runs/nonces/
staging and501 rooms. No source/timer/Properties change or72h gate restart.


## 2026-10-12 — C1 actual runtime target failed before end of day

Recommended GPT-6.1 Sol/high. Authenticated execution history was frozen during
four-page capture and realtime display restored afterward. Through16:51 Taipei,
702 unique execution records include694 minute timers,1938.259 total platform
seconds (32.304 minutes), max342.094 seconds and one platform failure. The day
is incomplete, but measured usage already exceeds the unchanged900-second daily
target; C1 is not accepted. No extrapolation or successful-day claim is made.
Minute timestamps contain four duplicates and two missing slots (06:34,12:23),
so the capture is not described as one successful execution per exact minute.

12:30's72.003-second failed execution reports a Drive service timeout inside the
test-only spreadsheet identity/title guard, before synthetic mutation/sync.
The failure is retained separately from the earlier overlapping SYNC_BUSY.
13:00 completed successfully:195407ms canonical sync,200994ms wrapper and
215.410s platform.09:44 completed IDLE with zero tables:335171ms canonical,
335182ms wrapper and342.094s platform. The idle canonical path only obtains the
script cache and performs its bulk marker read before returning; it has no
Sheet, signing-Property, lock or UrlFetch IO. This locates that long idle delay
in the CacheService path, without claiming to distinguish its two API calls.
Long active sync still combines service/preparation/network/validation time.

All failures and overhead remain in the runtime gate. Do not replace platform
usage with non-idle wrapper counters or discard slow services as outliers.
No canonical/test source, Properties, binding, timer or formal flag changed.
The original observation clock remains recorded, but elapsed72 hours alone
cannot pass the failed correctness/runtime acceptance. Investigate in an
independent environment before revising source or starting a new accepted run.

C3 isolated Worker source readback at17:36 Taipei: the fresh active deployment
and latest uploaded version both match the recorded synthetic version before
and after content/v2 retrieval. Its sole worker.js module exactly matches
the reviewed local dry-run bundle byte-for-byte. Only SHA/module/version
metadata is retained in evidence; no credential values or raw source are
printed. Formal acceptance remains false; all formal flags stay off.


## 2026-10-12 — C6 draft stack refreshed for verified transport correction

Recommended GPT-6.1 Sol/high. The reviewed C3 manual-redirect correction and
five actual-workerd regressions are inherited through C4/C5 into this C6
candidate. The C5 telemetry-only pending-state behavior remains intact. Full
Worker30/30, focused comparison/shadow/identity/authority18/18, validate72
backend files/40 endpoint references and regenerated178-source comparison
identity all pass. The updated comparison closure includes both changed
authorization transport modules; no positive access cache or deadline is relaxed.
All flags remain off and no actual shadow epoch has begun, so no existing
accepted window is reused or reclassified. C1 actual runtime NOT_ACCEPTED and
C3 strict authenticated latency NOT_ACCEPTED are retained in the current matrix.
No GitHub PR merge, formal publication/configuration/timer/data change occurs.

## 2026-10-12 — C3 private service profiling and editor rollback

Recommended GPT-6.1 Sol/high. Reviewed synthetic-only v2 adds test-harness
method timing; eight canonical modules, manifest/scopes and Properties remain
unchanged. Editor and immutable10-file exports were verified. An initial404
deployment readback was recovered by read-only checks of the recorded deployment
and source, without duplicate creation. Three signed diagnostic replies passed
canonical request binding/access verification. Client8131.150/3463.392/5108.085ms;
canonical authorization3306/2164/3073ms; range metadata1215/914/1045ms;
values564/455/544ms. Five full reads and four local cache hits per request,
zero shared hits. Nested binding timings are not double-counted; unmeasured
authorization797/449/987ms cannot be attributed to one service. Native history
separately showed42 completed v1 executions at1.898–34.129s, median3.0495s;
platform completion is not request-level authentication success.

Original synthetic editor10-file source restored and verified; both immutable
test deployments retained. No formal/C1 source, data, timer, Properties, clock
or flag changed. Diagnostics use15000ms and33 rows, not strict1500ms, p95,
remote D1/real LINE/device or formal acceptance. Details are in
`docs/READ-AUTHORIZATION.md`; private telemetry/key material is not committed.

## 2026-10-12 — C1 failed observation rollback

Recommended GPT-6.1 Sol/high. Fresh fixed project/Sheet/title and4-file source
readback passed before running the existing synthetic stop helper. Native UI
showed only the owner's two test CLOCK handlers;20:30:29–31 execution reported
`triggers:[]` and the unfiltered trigger page confirmed zero. The rollback
prevents further quota consumption by an already failed run and changes no
formal project. Test source/Properties/data and all existing failure records
are retained; the helper only removes those two named test triggers.

Complete stopped-history capture: five pages200/200/200/200/123,923 unique
records,914 minute timers,2892.886 platform seconds (48.215 minutes), maximum
479.840s. All timers terminal; failures12:30/17:00/17:20 remain, including the
0s duration reported for17:20. Last timer started20:30:14. This is an ended
failed partial-day observation, not a complete day or successful72-hour gate.
The900s/day limit is unchanged. Realtime display restored on first page.

Future corrected source requires independent review and a fresh actual72-hour
run; preserve the original05:39 start and failure history without reusing them
as qualification. Test rollback/reinstall steps are in
`docs/READ-REPLICA-SYNC.md`. No formal deployment/Sheet/trigger/flag change.

## 2026-10-12 — C3 bulk transport and native Utilities diagnostics

Recommended GPT-6.1 Sol/high. Retained two403 manual bulk-read failures; the
second safely classified API_DISABLED. Test-editor Sheets/v4 dependency used
the existing two scopes, with no new grant/deployment/timer. Actual21:13:54–59
Taipei execution produced three bulk/native pairs358/1331,239/863,218/823ms,
each166 cells/one Date/51 empties/zero typed-scalar or local-clock mismatches.
These are warm pairs in one invocation, not Date-loader/auth/1500ms/p95/500-room
or device acceptance. Original10-file editor andv1/v2 verified at21:18:12;
editor dependency removed, external default-project API disable not requested.

Reviewed editor-only100-string Utilities benchmark passed eight fake safety
tests. Actual21:51:31–33 execution measured107ms native SHA-256 and254ms UTF-8
Blob counting,14580 bytes. This sample does not support attributing the prior
tens-of-seconds delay to these operations; no crypto replacement was made.
Original10-file editor restored andv1/v2 retained at21:52:43. No formal/C1
source, data, Properties, timers or flags changed by either diagnostic.
`docs/READ-AUTHORIZATION.md` records evidence boundaries and remaining gates;
private source/logs/credential material remain outside Git.

## 2026-10-12 — C3 request-local bulk reader and exact Date feasibility

Recommended GPT-6.1 Sol/high. Added a request-local read-only transport adapter
that waits for the canonical resolver's first value read, preserving LINE
verification and Email token hashing before policy data. Independent review
reproduced and then verified corrections for sparse hydration bounds and
identity-before-snapshot ordering.49 grid cases plus19 existing policy cases
passed independently; full local unit933/933, validate72 and diff-check passed.
Calculator regeneration changed only the authorization source hash manifest.

Owned editor-only candidate changed one canonical module and manual harness,
preserving seven modules/manifest/scopes/original dispatcher prefix. Full-source
pins and fixed project/Sheet/title checks guarded publication; v1/v2 verified
before and after. Actual22:40:41–46 Taipei manual check: bulk576/native2918ms,
166 cells/one exact native Date/51 empties/three synthetic millisecond boundaries,
zero mismatches and no native fallback. This is33-row native type feasibility,
not signed/lazy authority,1500ms/p95/500-room or device acceptance.

Original10-file editor restored and exported exact at22:41:56; v1/v2 retained,
no new deployment. No formal/C1 source, source data, Properties, scopes, timers
or flags changed. Actual signed candidate roundtrip and prior release gates
remain incomplete. `docs/READ-AUTHORIZATION.md` records the current boundaries.

## 2026-10-12 — C3 signed candidate feasibility, still not accepted

Recommended GPT-6.1 Sol/high. Private lifecycle controls passed independent
review,9 publisher/6 actual-probe/18 pure-gate fake tests; initial validated source
is retained through OAuth, and only fixed error classifications enter evidence.
Canonical68 authorization regressions passed with source unchanged. Owned
synthetic immutablev3/source10 were verified; first readback404 recovered through
the recorded deployment with read-only management checks and no duplicate.

Actual23:13 Taipei strict1500ms samples all failed at1505.069/1503.023/1504.684ms,
without response headers. Separately labeled diagnostics passed canonical signed
authority at3302.118/3187.969/2620.684ms, first headers2902.806/2900.429/2321.985ms.
The synthetic33-row probe exercises canonical Email identity/access and request
binding, not remote D1, real LINE/device, p95,500-room or formal acceptance.
Reader-choice telemetry is absent, so native fallback cannot be excluded.

Original10-file editor restored/exported exact at23:14:32; original eight
canonical modules and immutablev1/v2/v3 retained. No formal/C1 source, source
data, Properties, scopes, timers, Worker or flags changed. Strict latency remains
NOT_ACCEPTED; original failures and all preceding gates remain required.

## 2026-10-12 — C3 signed bulk path proved, strict latency still fails

Recommended GPT-6.1 Sol/high. Independent review/63 fake lifecycle and telemetry
cases passed. Owned syntheticv4/source10 verified; canonical authorization
unchanged, harness hook restored in finally, signed telemetry saved to evidence only
after canonical verification under the original20000-byte limit. First404
recovered by recorded-ID read-only checks, no duplicate creation.

Actual23:31–23:32 Taipei strict3 failed at1505.136/1503.891/1503.527ms/no headers.
Separately labeled diagnostics each confirmed one successful bulk attempt,
no native range.getValues observation and zero shared cache. Complete
2967.576/2917.804/3002.265ms; headers2547.023/2660.057/2726.958ms;
authorization.total1183/1394/1052ms includes bulk288/632/223ms. Binding/method
timings are nested and not summed; theoretical/adapter runtime read counters
do not mean native Sheet IO. Evidence proves this three-request synthetic bulk
path, not strict1500ms, p95,500-room, D1, real LINE/device or formal acceptance.

Original10-file editor restored/exported exact23:33:42; original eight canonical
modules and immutablev1/v2/v3/v4 retained. No formal/C1 source, data, Properties,
scope, timer, Cloudflare or flag change. Keep strict latency NOT_ACCEPTED and
all C1/C5/performance/device gates; do not infer acceptance from bulk success.

## 2026-10-12 — C6 draft inherits bulk reader and new comparison identity

Recommended GPT-6.1 Sol/high. Reviewed C3 authorization and current C1/C3
evidence were propagated through the separate C4/C5/C6 worktrees/PRs. The C6
append-only execution-record conflict preserves both histories. One existing
untracked C5 editor temporary file is preserved/excluded; root WIP untouched.
Only authorization source and its generated manifest hash changed inside the
178-source normalized comparison closure. Asset tag advanced together with all
references to20261012-read-cutover-v2; comparison identity is
read-1321de54a6858357c574e3f5c2d74fc2f5d236ece9a6eb04b77d2ae2a0f7ab30.

Local unit954/954, Worker30/30, dry-run335.06KiB, validate72 backend files/40
endpoint references/static cache/178-source identity and diff checks passed.
Full npm test959 total:954 passed, one known missing external
PLATFORM_CORE_TEST_WORKTREE fixture failure, four external-fixture skips;
these missing integrations are not recorded as passing.

All six flags off, endpoint blank and shadow/cutover NOT_STARTED. No existing
window/clock is reused to qualify this new source. C1's failed stopped run still
requires corrected source and a fresh actual72-hour gate; C3 strict1500ms still
fails, followed by required actual seven-day shadow/performance/device gates.
No formal deployment, Property, timer, source-data or flag change is made by
this draft update. Prior serving versions/data and rollback evidence are retained.

## 2026-10-13 — C3 HTML response transport, still not accepted

Recommended GPT-6.1 Sol/high. Private diagnostic changed only the owned harness
final response packaging; bulk auth unchanged. Independent review corrected
non-settling cancellation, unique markers and local-IO timing contamination;
93 fake controls and68 canonical regressions PASS, validate72 PASS. Full938:
933 pass/one missing Core worktree failure/four external fixture skips.

Owned immutablev5/source10 readback passed after two management404 failures,
no duplicate version/deployment. Actual01:39–01:40 Taipei six signed requests:
strict3 failures1503.976/1502.382/1503.711ms without headers; diagnostics HTTP200
headers2342.746/2619.944/2667.567ms, complete2350.376/2622.626/2671.189ms, all
BODY_REJECTED/no verified envelope/telemetry. Native six terminal/completed
2.968/2.736/2.620/2.018/2.343/2.392s does not override client failures.

Original10 editor restored/exported exact01:41:32, original eight canonical
modules and immutablev1–v5 retained. No formal/C1 source/data/Properties/scopes/
timers/Cloudflare/flag change. Strict latency NOT_ACCEPTED; no D1/500-room/p95/
real LINE/device/formal acceptance. Preserve actual72h and seven-day gates.

Independent single unsigned wrapper classifier16 fake controls PASS, including
abort/read race RED→GREEN. Actual01:46 one unsigned `{}` request, noOAuth/seed/
fixture IO/additional signed requests: HTTP200/8130 UTF-8 bytes/one ordered
marker pair/82 encoded chars/hex-escaped padding; rawHTML/envelope not retained
or executed. This narrows unsigned wrapper encoding work, not the original
signed failures, signature/access, latency or formal acceptance.


## 2026-10-13 — C3 unpadded envelope works, strict latency still fails

Recommended GPT-6.1 Sol/high. Only private harness producer removes base64
padding; nine other candidate files/bulk auth and strict codec remain unchanged.
Padded producer regression RED→GREEN, independent99 fake controls PASS.
Owned immutablev6/source10 readback recovered one404 through recordedID, no
new duplicate. Originalv5 experiments/intents and failures retained.

Actual02:00 Taipei six signed requests: strict3 failures1505.783/1503.620/
1502.290ms without headers; diagnostics passed original canonical signature,
nonce, freshness and fixture-access checks after lab extraction. Headers
2937.959/2264.110/2893.820ms; complete2951.322/2266.999/2898.482ms. Each one
HTTP200 POST hop/one successful bulk/no native getValues/zero shared cache;
auth1696/1024/1701 contains bulk275/293/286ms. Both byte caps retained.

Native six completed, chronological212.683/4.589/2.663/2.594/1.910/2.590s;
first strict server tail retained with internal location unverified. Original10
editor restored02:03:04; final idempotent all10 source/type-byte/config checks
02:07:18 after native terminal confirmation, original eight modules/v1–v6 retained.
No formal/C1 source/data/Properties/scopes/timers/Cloudflare/flags changed.
Lab adaptation is not canonical HTTP acceptance; strict latency NOT_ACCEPTED.
Actual corrected72h,seven-day shadow,500-room,D1,real LINE/device/user-flow
gates remain. Prior full suite933pass/knownCorefailure/4skip not upgraded toPASS.

## 2026-10-13 — C1 owned Cache/Properties read-service diagnostic

Recommended `gpt-5.6-terra`/medium; the current session continues the reviewed
diagnostic. Root WIP remained unchanged at`be2cefe`; work stayed in the C1
worktree. Fresh fixed synthetic project/parent/title/source4 and native zero
triggers preceded an editor-only harness addition. Both canonical modules,
manifest/scopes and retained deployment configuration stayed unchanged.

One native manual run00:23:53–55 Taipei completed successfully: five paired
samples,438ms measured region after the fixed Script guard,1.670s separately reported platform
duration. Cache handle1–8ms/getAll21–48ms; Property handle1–19ms/get45–56ms.
Only fixed labels, integer timings and booleans were logged; returned values
were discarded. No Sheet, network/sync, trigger or Cache/Property write.
The60s between-sample guard cannot interrupt a blocking native service call.
The438ms timer excludes the Script guard and final log call; no attribution
of the remaining platform duration to startup or one service is established.

The actual helper11 fake lifecycle cases and actual function4 VM cases passed;
independent review also rejected4 invalid timestamp/proof cases before OAuth
or PUT. Original4 editor files and deployment inventory/configuration verified
restored00:24:38 Taipei; native unfiltered trigger page again showed0.
This warm manual observation did not reproduce or resolve the earlier335s
Cache-path stall and provides no evidence that Properties would be faster.
It is not cold timer, complete-day runtime,500-room or actual72-hour acceptance.
All original failures,900s/day gate and stopped observation records remain.
Corrected-source72-hour run NOT_STARTED; no formal release/data/flag change.

Repository verification on the C1 worktree: `npm run validate` PASS (71 backend
files plus release-cache validation), affected actual module VM13/13 and
`npm run test:unit`848/848 PASS. Full`npm test`853 total:848 passed,1 failed
because`PLATFORM_CORE_TEST_WORKTREE` is required,4 external fixture skips.
That missing Core integration environment is not counted as a pass. Source
modules and frontend release version were unchanged; `git diff --check` PASS.

## 2026-10-13 — C1 bounded single-pair entry-region follow-up

Recommended `gpt-5.6-terra`/medium. Independent review approved a new editor-only
manual diagnostic with one fixed Script guard, one original-wrapper Property
handle and one Cache handle/getAll pair per invocation. It discards Cache
values and performs no Property value read, Sheet/network/sync, write or timer
installation. Actual-function6 VM and actual-helper11 fake lifecycle cases
passed. Fresh fixed binding/source4 and native unfiltered0 triggers preceded
the addition; both canonical modules/scopes/deployment configuration retained.

Exactly3 manual native executions started00:37:38/00:37:58/00:38:15 Taipei,
all completed with`success:true,code:OK`. Script guard3/6/2ms, Property handle
3/10/1ms, Cache handle3/8/1ms, Cache getAll116/44/109ms, timed region125/68/114ms.
Native execution history separately reports871/921/550ms. The timed region
includes the Script guard and excludes the final log; its platform difference
does not isolate startup or any service. Guard/Property handle did not dominate
these samples; the earlier335s Cache stall remains unresolved.

The already stopped20:29:14 timer's native log says IDLE/core86ms/wrapper99ms,
platform984ms;20:28:14 says IDLE/core109ms/wrapper180ms/platform1099ms. These
two selected diagnostics do not classify the rest of914 timers or replace
their complete failed history, including every failure/outlier.

Exact original4 editor files and retained deployment configuration restored
00:38:58 Taipei; native unfiltered trigger count again0. No formal source,
rows, Properties, Cache, trigger, credential/scope or flag changed. No
corrected-source72-hour run started;900s/day remains unmet. Manual timings
are not cold timer, complete-day or500-room acceptance.


## 2026-10-13 — Full local Core/PG regression environment restored

Recommended GPT-6.1 Sol/high. Clean pinned Core checkout and private local
PG16.14 supplied the existing missing mandatory integration dependency. No
application source, test assertion, repository dependency or remote service
changed. Independent runner review reproduced cleanup timeout failure; four
fake lifecycle cases and eight target/environment guards PASS after correction.

Actual existing full suites: C1 853/853, C2 868/868, C3 938/938, C4 951/951,
C5 956/956, C6 959/959; zero fail/cancel/skip. Original GAS commercial flow
used actual restricted HTTP and real PostgreSQL; four product-access fixtures
use synthetic Core route-handler injection, not real sockets/database. All
six tested full HEADs and Node26/macOS scope are retained in
`READ-REGRESSION-DEPENDENCIES.md`. Previous failures/skips remain historical.

SQL before/after verified fixed owned cluster and no leftover fixture DB/roles;
final pg_ctl stop/status, absent PID and closed listener passed with no cleanup
error. Core and all CMWebs tracked sources unchanged; root WIP and C5 editor
temporary file preserved. Logs/generated synthetic secrets remain private.
No formal database, source, deployment, Properties, trigger, Worker or flag
change. Corrected C1 actual72h NOT_STARTED; stopped failed runtime remains
NOT_ACCEPTED. C3 strict latency, C5 seven-day and C6 real-flow/device/cutover
remain unaccepted; this full-suite success does not change those gates.

## 2026-10-13 — C6 500-room local calculation repair

Recommended model/speed GPT-6.1 Sol/high under approved plan; separate C6
worktree/PR271. Capacity fixture:20 active properties,500 owned rooms,250 active
tenants/leases and250 vacant rooms,500 bills across September/October plus
foreign/private canaries. Real local workerd/D1 and all20 projection tables
match unchanged GAS at seven entries; independent counts/financial literals
pass. First fixture lacked canonical payment_status; corrected synthetic source
field, preserving the arrears252 assertion and product behavior. Original
tenants100-sample p95=99.173ms FAIL retained.

Three private actual workerd profile calls returned identical result hashes;
2252 date-format calls consumed87/61/61ms, full148.522/103.823/98.936ms.
Minimal repair reuses string-timezone Intl formatters only within a request,
never date values, rows or positive access. Mutable Date, non-string timezone
coercion/errors and spring DST are checked; independent focused review also
verified request isolation/autumn DST. Original GAS calculator stays unchanged.

Unit955/955 and complete Worker31/31 including dry-run pass, zero skips. Each
entry's100-sample local p95<50ms: home25.690/actions20.732/revenue21.754/
tenants41.669/rooms31.105/arrears29.892/properties28.305ms. This fixed-access,
all-table test is not uncached C3 authority, real provider/scoped loader,
remote/Taipei500-room, seven-day or device acceptance. Exact-head Linux CI is
pending; prior959 full-suite and original CI outlier/one rerun remain historical.

Cache tag20261013-read-capacity-v3, all references/validators/tests advanced;
178-source comparison regenerated as
read-bed1f4eb91b247567955000d406eccb5fc25520481f6af4ec8e0780102da8399.
Old failed C1 completion estimate removed from current runbook; corrected run
NOT_STARTED with no current earliest finish time. A new actual epoch is required;
none started. Six flags off/URL blank; no formal release/Property/trigger/data
change. Rollback retains prior candidate e28d39b/cache/comparison. Root WIP preserved.

## 2026-10-13 — Owner approves synthetic direct-Google feasibility

Recommended model/speed GPT-6.1 Sol/high for security/authority review. Owner
explicitly approved the reviewed synthetic-only feasibility decision, recorded
in `READ-DIRECT-GOOGLE-FEASIBILITY.md`; approval is received, not pending.
Dedicated Reader/readonly scope, Google-side whitelist before Worker bytes,
freshness and all original gates are retained. Formal table access/adoption,
additional fees remain outside this approval; owner supplies any new grant/key.

Independent review opened primary Google reference/Discovery documents. No
atomic header-name selector was proven: DataFilter provides locations/metadata,
ByDataFilter methods do not list readonly scopes, metadata/named ranges are
not header-bound privacy controls. Tables structured references in REST remain
UNKNOWN and formula views cannot stand in for latest revocation. Official links
and bounded kill-canary conditions are retained in the decision document.

Status NOT_PROVEN. No account API call, resources, new credentials, prototype,
deployment, Properties, timers, formal data or flags changed. Retain GAS and
stopped C1/failed C3 actual evidence; do not claim gate PASS or ask for secrets
while no safe candidate exists. This documentation-only decision is on C3's
separate worktree/PR268; root checkpoint WIP and private S1 contents preserved.

## 2026-10-13 — C6 v4 allocation candidate, failures retained

The v3 exact-head2d1c1a8 GitHub run38299581057/job114978941038 failed29/31:
500-room tenants55.647ms and small-fixture arrears68.719ms, original p95<50ms.
Its capacity home/actions/revenue were30.755/23.653/27.175ms; later capacity
loops did not run. Separate subsequent local date-only candidate arrears50.560ms
and intermediate decoder candidate tenants94.726ms failures remain. All JSON/
literal comparisons passed first; no unchanged-head rerun or inferred CI cause.

Private post-formatter diagnostics returned identical canonical result hashes;
warm query16/15ms, decode4/5ms, format12/6ms and full52.291/49.782ms show
remaining allocations to examine, not acceptance. V4 keeps date-only/full
request-local Intl formatters, creates fresh date parts without pair arrays,
and shares a low-allocation JSON row decoder between production and test loader.
SQL, scope, source ordering and all20 table reads remain; stored JSON types,
SQL-null omission/JSON-null presence, own __proto__ and malformed JSON rejection
are separately checked. No date/row/positive-access caching; original GAS stays
unchanged. Independent focused semantics/cache/source review passes.

Actual Worker31/31 and dry-run335.95KiB/gzip70.46 pass, unit957/957 and
full962/962 at exact1cab31076ac82e35bb5c264d80ce0c7cc2c46240 pass0skip.
New private PG16.14 uses clean pinned Core643c1b3; before/after SQL identities,
no fixture DB/role residues and final stopped PID/TCP all pass, no cleanup error.
Actual original GAS restricted HTTP/PG and four synthetic Core handler cases
are distinct from the local workerd tests. No other five suites were repeated.
Each500-room entry has100 samples/p95<50ms: home27.683/actions25.049/
revenue19.718/tenants39.150/rooms30.783/arrears27.972/properties29.059ms.
Fixed access/all-table test loader cannot qualify C3/provider/scoped-loader/
remote/Taipei/device. New exact-head Linux CI is pending.

Cache20261013-read-capacity-v4/178-source comparison
read-cdf69ac211f844e21222e231fd546bd5845999989e9dc4ed47e79d9644226993
match actual runtime/dataset bytes and synchronized refs. No real epoch began;
all flags off/URL blank. C1 fresh72h, C3 strict latency, C5 seven real days and
C6 real/device/cutover remain pending. No formal resource/deployment/Property/
trigger/data changes; root WIP and C5 editor temporary file preserved.
