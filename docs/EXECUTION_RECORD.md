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

## 2026-10-13 — C1 bounded native timer controls, exact restoration

Recommended GPT-6.1 Sol/high for synthetic trigger mutation/rollback guards.
Existing C1 project/parent/title, original4 source and zero native triggers
were freshly checked. Editor-only diagnostic retained both canonical modules,
manifest/scopes and deployment configuration. No version was published.
Review found manifest-semantic equality insufficient for exact4 restoration;
helper now compares all source bytes. Actual restore formatting-drift negative
and exact restoration positive cases pass; VM16/fake lifecycle14 independent
cases and follow-up review PASS before any editor mutation/timer installation.

Native history starts the installer at07:31:44 Taipei, platform2640ms; the
editor's separate start notice is07:31:45. Both are retained. Its log confirms
three after timers with minimum60000/180000/300000ms, not exact scheduling.
Native unfiltered page showed only the three diagnostic clock handlers.
No unknown installation outcome was retried; no original sync timer restarted.
Each event matched its own UID/handler/clock and deleted only its own trigger.
No Cache/Property/Sheet/sync or replica HTTP/UrlFetch calls enter these controls.

| Native start (Taipei) | Platform ms | Guard ms | List ms | Delete ms | Entry region ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 07:33:38 | 852 | 2 | 86 | 309 | 397 |
| 07:35:37 | 1000 | 2 | 73 | 162 | 237 |
| 07:37:26 | 1254 | 41 | 103 | 334 | 478 |

All3 native executions COMPLETED with success/own_trigger_deleted true; all
entry sums match. Total installer+timer platform5746ms is separate diagnostic
usage, not a daily sync result. Entry regions include cleanup; logging and
post-return work are excluded. The residual is not attributed wholly to startup
or one service. These samples neither prove cold state, resolve335s Cache stall,
nor establish a1440-run floor,900s/day,500-room or actual72h acceptance.

Native unfiltered0 triggers preceded restore. Exact original4 editor source
bytes/manifest and retained deployment configuration read back07:40:23.
Fresh native unfiltered0 again07:42:32.993. No cleanup failure, remaining timer,
new credentials/Properties/cache or Sheet data write, formal deployment/flags.
Private logs/harness/zero-trigger image retained outside Git; root WIP and
private S1 preserved. All failed914/2892.886s records stay; corrected72h
NOT_STARTED and original gate NOT_ACCEPTED. Repository change is docs only.


## 2026-10-14 — C1 local UTF-8 batch sizing optimization

Recommended GPT-6.1 Sol/high for existing synchronization correctness; no new
architecture or acceptance scope. Snapshot batching previously constructed one
native Blob per projected row only to count serialized JSON bytes. The sender
now counts UTF-8 locally; a 501-row snapshot requires zero sizing Blob calls.
The 500-row/900000-byte budgets, signed payloads, whitelisted projections,
source ordering and dirty retry semantics remain unchanged. This removes
redundant service calls; native latency savings have not been measured and it
does not establish a fix for the earlier 335s idle Cache stall.

Affected module VM17/17 and independent review17/17 PASS, no P1/P2 findings.
Unicode/escaped malformed input, exact cumulative byte boundary, maximum row,
signing and pre-HTTP rejection covered. The optional additional asymmetric
900001-byte fixture is deferred; existing 900000/900002 cases remain. One
required full regression857/857 PASS, zero fail/cancel/skip, Node22.23.3 and
pinned Core with disposable local PG16.14; database/role cleanup, stopped PG
and closed listener verified. Source snapshot SHA256:
`8b0f4fc535a659f4ac0c135d3e72acdf31976dcc5e9b9c5557309420a40b60bf`.
`npm run validate` PASS71 backend/40 endpoint references and static release
checks. No additional unchanged target/review/full reruns were performed.

The temporary synthetic editor-only UTF-8 comparison was cancelled before
native execution following the request to reduce diagnostic rounds. Native
comparison is UNVERIFIED, not a pass. Exact original4 editor files, manifest
scopes and deployment inventory were restored14:31:51 Taipei; subsequent
native unfiltered trigger count0. No new version, credential, Property,
Cache or source data write; no formal deployment or flag changes. Existing
failed914/2892.886s observation stays NOT_ACCEPTED; fresh corrected-source72h
NOT_STARTED. All original actual-runtime, shadow and device gates remain.

Rollback: retain prior source commit; revert this local byte-sizing change if
native validation fails before deploying corrected synthetic source. Existing
serving deployment and authoritative data retained; read flags remain off.
Root WIP preserved. Temporary editor restoration is already complete.

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


## 2026-10-14 — C2 D1 latency diagnostics without changing acceptance

Recommended GPT-6.1 Sol/high for CI-versus-local measurement fidelity. C3 exact
head7226076 CI38526286078 failed Worker23/24: home191.197ms and arrears58.361ms,
with batch stages189/56ms. Other route p95 values7.751–16.016ms. The failure is
retained; its cause remains UNRESOLVED. C3 changes cannot be assumed to cause
or resolve a test-only full-table D1 batch latency. Its production loader uses
Workspace-scoped SQL and is a separate performance boundary.

One private exact-C3 probe preserved all parity assertions and7×100 samples,
added numeric internal metadata only, and passed locally at1.722–2.390ms.
Internal-duration sum p95~1ms,20 queries/68 rows. This ARM Node22 observation
did not reproduce the Linux CI failure and is not production acceptance.

C2's existing test entry now exposes batch/decode/route stages and a test-only
numeric header with query count, rows read and cumulative internal duration.
The pinned Miniflare5.20261006.1-alpha implementation includes row conversion
and bookkeeping in duration; it is not pure SQL time or network-time proof.
See https://developers.cloudflare.com/d1/worker-api/return-object/ for returned
metadata fields. Missing/nonfinite metadata fails rather than becoming0.
There are no extra SQL calls or application response changes. Production entry
never imports this test entry. Metadata collection remains in decode; final
header serialization remains in total client timing, outside server stages.

Each original group still uses all100 samples and p95 index94/<50ms. The report
adds stage p95, count>=50 and five paired slow examples, then fails after every
group is reported. These examples never substitute for the full sample set;
no warmup, retry, excluded sample or threshold change. Do not subtract stage
percentiles from total time to infer a network/host cause.

RED1/1 failed for absent metadata header. Affected actual Miniflare/GAS parity
GREEN1/1 covered all700 observations, p951.729–2.605ms. One static independent
review found no P1/P2/minor, diff check PASS, no benchmark rerun. One full root
regression868/868, zero fail/cancel/skip, Node22.23.3 with pinned Core/disposable
local PG16.14; final database/role/PG/listener cleanup verified. 494-source pin:
`8a2ef9f169143983932d087663fa4de05ce623cf331634d4b717a7b40dae7d80`.
One required full Worker suite13/13, zero fail/cancel/skip; pretest dry run PASS.
All seven100-sample groups p952.117–2.954ms, zero samples>=50. Validate71/40/static
and diff PASS. No unchanged suite was retried to obtain a passing result.

The actual Google trial counter remains25/160, byte-identical and unclaimed;
320 was declined. No Google/production source, secrets, Sheet data, trigger,
Cloudflare configuration or formal flags change. C1 daily-runtime/72h, C3
strict authority/latency and real trial, C5 seven-day and C6 device/cutover
remain required. Root WIP retained. Rollback reverts these test/diagnostic
changes to the prior C2 source; serving deployments and data are untouched.


## 2026-10-14 — C2 feature stack aligned to current C1

The prior pushed diagnostic head1ddad5b could not start PR CI because the C1
base had advanced to6b90a4c with conflicting documentation. A private complete
Git bundle retained the old head/history. Rebase replayed the C2 feature and
observation on current C1; conflicts were documentation only and both records
were preserved. Rebased92d2f67 changes runtime versus1ddad5b only by inheriting
C1's reviewed local UTF-8 sizing helper/test. No formal branch merge/rollout.

Full872/872, zero fail/cancel/skip, Node22.23.3/Core/disposable PG16.14; cleanup
verified,2.606s.494-source snapshot:
`ee5c2a7ae34109ff3326f33166b6f219f05db46fab614d5f7eeef4aec66a0cab`.
Validate71/40/static PASS. All cloudflare/read-api bytes unchanged, so prior
Worker13/13/p952.117–2.954ms is retained without a redundant Worker rerun.
Prior868 evidence remains at its pre-alignment source. Explicit remote-head
lease protects the feature push; PR stays Draft and original actual gates
remain unmet. Root WIP and actual25/160/no-claim preserved. Prior bundle/source
heads permit restoring the feature history without changing serving data.

## 2026-10-14 — C2 Node supervisor timing observation

Recommended model/speed: GPT-6.1 Sol / high for separate-process measurement
boundaries. The aligned C3 CI38533367980 failed Worker23/24: room p95188.364ms
against unchanged50ms,11/100>=50; paired batch235–286ms/internal0–1ms. Rental
1702/1702 passed. Original C3 package already serializes test files; concurrent
Node test files do not explain this failure. The parity fixture reads all20
tables in one batch; production instead performs replica, identity/access and
GAS authority checks before scoped dependent dataset reads. The fixture is
not production authenticated latency evidence. Cause remains UNRESOLVED.

Add only Node supervisor process CPU and event-loop active/idle/utilization
metrics alongside existing five slowest paired observations. CPU is total
Node process threads, may exceed wall time, and excludes the workerd child;
ELU active duration includes blocking and is not CPU time. Probe starts are
inside the original wall timer; diagnostic formatting remains after it, as
with existing header metadata. No added SQL, IO, sample, warmup, retry or
changed p95 index/50ms threshold. Never infer worker CPU/network from these
numbers alone. One static review: P1/P2/minor0; no repeated review/benchmark.

One complete affected Worker13/13,0 fail/cancel/skip; all seven100-sample
groups p952.473–3.570ms and numeric guards PASS; pretest dry run PASS.
Validate71/40/static and diff PASS. Ruling: retain previously complete872/872
root/Core/ownedPG evidence because every runtime/root-test byte matches that
verified snapshot; only this Worker test file differs. User requested fewer
redundant tests; no separate implementation-mirroring test or unchanged root
rerun. Cost: local root result retains its original platform/time provenance;
new exact-head CI still required. No actual Google/counter/formal mutation.
Rollback this test-only observer to priorC2a1d6406; original C3 failures and all
900s/day/fresh72h/seven-day/500/strict latency/device gates remain unaccepted.

## C1 pre-read deadline guard — 2026-10-16

Recommended GPT-6.1 Sol/high. Existing four-minute send deadline was enforced
only after Sheet loading/projection; slow earlier IO could therefore cause
later unnecessary Sheet reads. Actual-module dirty/full tests reproduced2/16
reads rather than1, then passed with a pre-read check against the existing
source timestamp. Full-run unattempted tables remain dirty; matching completed
generations clear and lease cleanup remains. Blocking native calls are not
interrupted; marker/lease IO may still continue. No claim that the335s Cache
stall or900s/day gate is resolved.

Affected19/19 and independent19/19 PASS/no actionable findings. One full local
859/859 PASS,2.566s,Node22.23.3/actual Core/owned PG16.14; database/role cleanup,
stopped cluster and closed listener verified. Tested477-file snapshot
3a69f2c26519e21b25b2df3437e670f1326cc9a59606e61a5edf867b5a8bb14b;
only docs afterwards. Validate71backend/40endpoints/cache/diff PASS. Worker
unchanged, no repeated unchanged capacity test. Exact-head CI follows push.

No account/Google/credential/Properties/trigger/Sheet/deployment operation.
Original25/160 unclaimed/history retained; native-IO purpose revision remains
awaiting owner. Approved parallel24h schedule supersedes original3/7 calendar
only; T0 NOT_STARTED/alloff, actual daily900s/privacy/freshness/performance/device
gates unaccepted. Rollback undeployed increment to6b90a4ca3efc8a83b706268d5039f5d9bb988a7c,
retain original serving/editor/data and dirty generations. Root WIP/privateS1/
C5swap preserved. No formal release or failed-observation reset.

## C2 inherited C1 deadline guard — 2026-10-16

Recommended GPT-6.1 Sol/high. Inherited the reviewed C1 guard from489d339: after
the existing four-minute send deadline, do not read/hash another Sheet. Full
reconciliation still queues every unattempted table; completed matching dirty
generations clear and lease cleanup remains. Blocking native calls cannot be
interrupted and marker/lease IO may continue. Existing C2 projection/auth
changes preserved; no claim of fixing335s idle Cache or daily900s acceptance.

Affected24/24 PASS and shared incremental independent review found no actionable
issue. One full local874/874 PASS,2.614s,zero fail/cancel/skip,
Node22.23.3/actual pinned Core/owned PG16.14; database/role cleanup, stopped
cluster and closed listener verified. Tested494-file snapshot
6ecc7f9b5b48f2221d941a537d420b9fda23fa8388338b852c0229816218cb0e;
only docs afterwards. Validate71backend/40endpoints/staticcache/diff PASS. Worker
unchanged; no repeated capacity run. Exact-head CI must be read after push.

No actual Google/account/credential/Properties/trigger/Sheet/deployment IO.
Original25/160 remains unclaimed; native-IO amendment remains awaiting owner.
Approved parallel24h T0 NOT_STARTED/alloff; actual authority/privacy/freshness/
900s/day/performance/device gates remain unaccepted. Rollback this undeployed
inheritance to1b3c18c25cddea0d38014ba948c7fb03c83da124;
retain all original claims/checkpoints/pinned cleanup and history, never reset
or replay. Root WIP/privateS1/C5swap and pending C3 proposal preserved.
