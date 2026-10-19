# Read replica synchronization (C1)

Recommended model/speed: `GPT-6.1 Sol` / high. Sheets remains authoritative.
No operational read API or frontend switch is enabled by this source change.

## Schema and privacy authority

`cloudflare/read-api/schema.json` is the sole table/field allowlist. Run
`node scripts/generate-read-replica-schema.mjs` after reviewed schema changes;
it generates the D1 migration and Apps Script constant. Sixteen tables cover
approved read dependencies and authorization rows. Every table has a stable
source key, `row_key`, SHA-256 `row_hash` and `synced_at`. Columns store scalar
JSON text to preserve numbers, booleans, strings, null and missing fields.

Projection drops unlisted fields. Bank values, identity documents, contract
files, challenge codes, invitation credentials, raw session/LINE tokens and
Properties are excluded. Email session hashes are the approved authentication
exception; bank-edit permission is only a boolean. Nested objects are rejected.
Missing sheets/keys or duplicate keys never produce a deleting snapshot.

## Signed protocol and complete snapshots

`POST /sync` signs exact UTF-8 bytes with HMAC-SHA256 over
`timestamp + "\n" + nonce + "\n" + body`. Headers:
`X-CMWebs-Timestamp` (Unix seconds), `X-CMWebs-Nonce` and
`X-CMWebs-Signature` (lowercase hex). Timestamp age/future skew must be at most
300 seconds. Nonces are atomically reserved in D1 for ten minutes. Missing
configuration fails closed. Bodies are capped at1 MiB and batches at500 rows;
row hashes are recomputed after strict whitelist validation.

The approved `{sheet, rows, complete}` payload additionally requires a complete
manifest: `mode`, `snapshot_id`, `source_version` (Unix milliseconds captured
before the source read), `batch_index`, `batch_count`, `row_count` and
`snapshot_hash`. The digest covers sorted `[row_key,row_hash]` pairs for the
whole snapshot. Only the last batch sets `complete=true`. This metadata prevents
a last batch from deleting rows belonging to an earlier batch.

Receiving batches only stage rows. Finalization checks all batches, unique rows,
count and digest. Changed rows upsert and missing rows delete in one D1 batch
transaction; unchanged rows retain their prior `synced_at`. SQL rechecks the
latest committed source version to reject older concurrent runs. Manifest or
batch changes are rejected. One-batch `mode=patch` is restricted to Email
sessions and cannot delete unrelated sessions.

## Apps Script scheduling

Both `READ_REPLICA_URL` (Worker base HTTPS URL) and
`READ_REPLICA_SYNC_SECRET` must be configured. Report only presence, never
values. With either absent, synchronization is disabled. The dispatcher observes
successful JSON, JSONP and iframe responses after business functions finish,
then queues affected tables with generation markers. Failure responses and
reads do not queue writes. Dirty marking performs no network request.

`runV2ReadReplicaDirtySync`: one-minute timer; idle performs no Sheet reads.
`runV2ReadReplicaFullSync`: daily timer at hour03, timezone Asia/Taipei.
No trigger is installed by committing this code. Set the daily timer timezone
explicitly; Apps Script timers run within the hour, not exactly03:00.
Runs lease execution for six minutes with a four-minute send deadline. Each
table exports once per run; failed tables remain pending while others proceed.
A newer dirty generation is never cleared by an older run. Cache loss or marker
contention is recovered by daily reconciliation. Logs contain only result codes,
whitelisted table names, counts and duration.

Email logout writes local revoked state before a synchronous one-row patch.
On failure, the session table remains dirty and the response explicitly reports
`READ_REPLICA_REVOCATION_PENDING`. Later read authentication must account for
synchronization health; no operational Worker route is exposed in C1.

## Release and three-day acceptance

1. Finish S1 staged physical and authenticated acceptance first.
2. Verify intended Cloudflare account, Workers Paid readiness and account-scoped
   credential. New costs/payment require the owner.
3. Create replica D1 with APAC placement hint; read back account/database identity
   and location. Replace the placeholder, apply reviewed migration, configure
   encrypted sync Secret and deploy. Record version/binding readback; probe
   health and signed synthetic sync.
4. Use a separate test Sheet/Apps Script project with synthetic whitelist rows.
   Export its baseline; verify no formal Sheet or messaging credential. Configure
   its replica properties and two timers; read back presence, handlers/timezone.
5. Run three consecutive actual days, recording trigger runtime, projection,
   changed rows/daily repair and immediate revocation. Verify actual Apps Script
   account quota; unknown means HUMAN_REQUIRED. Target below15 minutes/day.
6. Only after three-day acceptance may production properties/timers be configured.
   Retain serving version/editor export, create immutable version, preserve the
   original Web App URL and read back source/version/bindings/timers/results.

Current remote/day gate: **RUNNING / NOT_ACCEPTED**. The isolated synthetic
test timers started on 2026-10-12 at05:19 Asia/Taipei. Workers Paid was verified in
the authenticated account UI. The separate test D1 reports APAC placement;
its Worker has only the test database binding and an encrypted sync Secret.
Health, invalid signature rejection and nonce replay rejection passed remotely.

The separate bound test Apps Script contains four byte-verified files and only
current-spreadsheet, external-request and own-trigger scopes. Owner-entered
Properties were verified by presence only. Initial full synchronization passed
for16 tables/531 rows, including a501-row table split across two batches;
all table counts matched D1 readback. It took43,436 ms. Immediate synthetic
session revocation passed and D1 readback confirmed revoked state. Only the
test project's one-minute and daily-hour03 timers were installed.

The account is consumer Gmail (90-minute daily trigger allowance). The test
changes one synthetic room every30 minutes and otherwise exercises idle runs.
Wrapper timings exclude platform overhead and are not daily trigger-quota
evidence. Reconcile the complete authenticated execution history each day,
including idle runs and failures, before accepting the below15-minute target.
The first two idle executions took2.547/2.446 seconds because the synthetic
wrapper unnecessarily opened Sheets. The wrapper now checks local project
identity on idle and opens the bound test Sheet only for a synthetic mutation.
The source also discovers dirty markers with one bulk CacheService read;
per-table generation validation after sends is unchanged. Final test source
was exported byte-identical at05:39 after a further idle optimization: signing
configuration is retrieved only when a full or pending run needs it. Idle
returns before Properties, Sheet, network or lock calls; pending/full still
validate configuration before IO. An unconfigured timer with no pending work
therefore reports IDLE, while unconfigured pending/full reports DISABLED.
Count the72-hour gate from that revision;
retain earlier overhead records rather than dropping them from daily totals.
No production Sheet, Properties, trigger or serving Apps Script version was
changed by this test. Local/CI tests and the initial manual run do not satisfy
three actual days. Require at least72 hours plus consecutive daily execution
and reconciliation evidence before production enablement.

| Actual day | Runtime total | Correctness/revocation | Status |
| --- | --- | --- | --- |
| 1 (from final source 2026-10-12 05:39 Taipei) | Full trigger total pending | Initial16-table count and immediate revocation passed | RUNNING |
| 2 | Not measured | Not run | NOT_STARTED |
| 3 | Not measured | Not run | NOT_STARTED |

## Rollback

Stop only the two replica timers, disable only replica URL configuration, and
restore the verified prior Apps Script serving/editor source if necessary.
Restore prior Worker version/configuration if one exists, otherwise disable
the new endpoint. Keep frontend flags off. Retain Sheets and operational rows;
replica rebuild never deletes or rewrites formal data. Retain migration, D1
export and sanitized version/configuration evidence before changes. Account for
retained Worker versions before removing any shared Secret they depend on.

## 2026-10-12 partial-day readback at07:46 Taipei

Read-only remote D1 verification at07:45 found the synthetic room mutation from
07:30, with server `synced_at`2026-10-11T23:31:34.247Z. No source/timer change.
The refreshed authenticated Apps Script history loaded all154 current entries
on one page:147 minute timers05:20–07:46, all completed,308.771 platform seconds
(max82.534s); six manual editor runs52.631s; one earlier unavailable Execution API
attempt0s/failed. Retain that API failure separately from timer correctness.
For the final source from05:39,128 timers totaled278.816s. These are partial-day
observations only, not a full daily runtime total or a passed day. Some dirty
runs were slow; continue complete daily history/reconciliation before accepting
the below15-minute target. Do not extrapolate this sample into acceptance.

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

## 2026-10-12 — Failed synthetic observation stopped

Recommended GPT-6.1 Sol/high. At20:27 Taipei a fresh read-only API check verified
the fixed synthetic project/Sheet/title and all four source files against the
recorded test source. Its native trigger page showed only the owner's minute
and03:00 daily test handlers. The existing `stopC1TestTriggers` ran20:30:29–31;
its log reported no triggers and the native unfiltered trigger page read back
zero. This stops additional test quota use after the already failed daily gate.
The helper only removes those two named synthetic triggers; it does not edit
source, Properties or Sheet data and never selects a formal project.

Afterward the native execution history was frozen across five pages and all923
unique records retained. The914 minute timers from05:20:14 through20:30:14
consume2892.886 platform seconds (48.215 minutes), maximum479.840 seconds.
All timer records are terminal. Three failures remain:12:30 (72.003s),17:00
(479.840s) and17:20 (platform reports0s). Zero reported duration does not make a
failed trigger successful. The daily900-second target is still failed; this
ended observation is neither a complete day nor three successful actual days.
Realtime history display was restored after returning to the first page.

Keep every original failure, execution and replica/deployment record. The
original05:39 observation-start record is retained, but its elapsed time cannot
qualify a future version. Resume the reviewed minute/daily test schedule only
with an appropriate fix and a separately recorded fresh actual72-hour gate.
Reinstallation uses the existing fixed synthetic `installC1TestTriggers`,
followed by native trigger/readback checks; it is not a route to bypass runtime,
correctness, daily full-sync or downstream shadow acceptance. No formal source,
data, deployment, trigger or frontend flag was changed by this rollback.

## 2026-10-13 — Owned read-service diagnostic, original editor restored

Recommended `gpt-5.6-terra`/medium; the existing session continues the reviewed
diagnostic. Fresh fixed project/parent/title/source readback and the native
unfiltered zero-trigger page preceded an editor-only harness addition. Both
canonical modules and the manifest/scopes stayed unchanged; the existing
deployment inventory/configuration was retained. The actual helper passed11
fake lifecycle cases, the actual function passed4 VM cases, and independent
review also checked4 invalid timestamp/proof cases. No new credential or scope
was needed.

The one manual `benchmarkC1ReadServices` invocation started00:23:53 Taipei.
Its log completed00:23:55 with `success:true,code:OK`, five paired samples,
438ms measured region after the fixed Script guard, and no between-sample
loop-guard hit. Native
execution history separately reports1.670s platform duration; it is not the
same metric as the service/region timers. The438ms timer excludes the Script
guard and final log call, so subtraction does not isolate platform startup.

| Sample | Cache handle (ms) | Cache getAll (ms) | Property handle (ms) | Property get (ms) |
| --- | ---: | ---: | ---: | ---: |
| 1 | 4 | 48 | 19 | 46 |
| 2 | 2 | 21 | 5 | 45 |
| 3 | 1 | 29 | 1 | 56 |
| 4 | 8 | 30 | 2 | 45 |
| 5 | 1 | 28 | 1 | 46 |

The function read the original dirty-key set and queried a fixed non-secret
test marker key, discarding all returned values. This does not prove that the
queried Property exists or that its value matches the timer harness's marker;
the benchmark uses`C1_TEST_LAST_MUTATION_MINUTE`, while the harness uses
`C1_TEST_LAST_MUTATION`. It performed no Sheet, UrlFetch,
sync, trigger, Cache/Property write or deployment operation. Its fixed Script
guard precedes service IO. A60s guard is checked between samples; it cannot
interrupt a blocking native call and is not a hard execution timeout.

These are warm paired service calls in one manual invocation. They did not
reproduce the earlier335s idle Cache-path delay, do not identify which earlier
Cache call stalled, and do not prove cold timer overhead, a complete daily
runtime,500-room throughput or an actual72-hour pass. The observed Property
reads provide no evidence that replacing Cache would improve the idle path.
Keep all original failures and the unchanged900s/day gate.

At00:24:38 Taipei the API export verified exact original4 editor files and
unchanged retained deployment configuration. The native unfiltered trigger
page again showed zero. No formal source/data/Properties/trigger/flag changed.
The stopped failed observation remains NOT_ACCEPTED; no corrected-source
72-hour run has started. Diagnostic evidence alone does not approve a new
Cache/Properties design or a relaxed schedule/acceptance gate.

## 2026-10-13 — Three independent single-pair entry-region diagnostics

Recommended `gpt-5.6-terra`/medium. A separately reviewed editor-only function,
`profileC1IdleServices`, measured the previously excluded fixed Script guard
and the timer harness's unconditional Property handle, followed by one Cache
handle/getAll pair. It never read a Property value or called the sync function;
pending dirty markers therefore could not cause Sheet/D1 writes. Three manual
invocations were the entire bounded diagnostic, with no timer installation.
Six actual-function VM cases and11 actual-helper fake lifecycle cases passed.
Fresh fixed binding/source4 and native zero-trigger readbacks preceded the push.

| Native start (Taipei) | Script guard (ms) | Property handle (ms) | Cache handle (ms) | Cache getAll (ms) | Timed region (ms) | Native platform (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 00:37:38 | 3 | 3 | 3 | 116 | 125 | 871 |
| 00:37:58 | 6 | 10 | 8 | 44 | 68 | 921 |
| 00:38:15 | 2 | 1 | 1 | 109 | 114 | 550 |

All three returned`success:true,code:OK`; the timer starts before the Script
guard and ends before the final log call. Native platform duration is a
separate execution-history measurement. The region/platform difference is
not exclusively startup, logging, CPU or any particular service. These manual
invocations do not establish cold-clock-trigger behavior or a daily total.
The Script guard/Property handle did not dominate these three measurements;
no fix for the earlier335s Cache-path stall is established. A lazy Property
handle is a possible removal of redundant harness IO, with unproven benefit,
and cannot alone qualify a new runtime/correctness observation.

Two already stopped timers were also read with their actual native logs:
October12 20:29:14 had IDLE/core86ms/wrapper99ms/platform984ms;20:28:14 had
IDLE/core109ms/wrapper180ms/platform1099ms. These are selected diagnostic
pairs, not a reclassification of all914 timers; the complete failed history
and every slow/failing result remain in the gate. Their wrapper/platform
differences are likewise not attributed to startup.

At00:38:58 Taipei the source API confirmed exact original4 editor files and
retained deployment configuration. The native unfiltered page again showed
zero triggers. Both canonical modules, manifest/scopes, Properties, Cache,
source rows and formal flags remained unchanged. No new credential/scope,
deployment or corrected-source72-hour run was created. The900s/day and actual
72-hour gates remain NOT_ACCEPTED/NOT_STARTED respectively.


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

## 2026-10-16 — Stop new Sheet reads after the send deadline

Recommended GPT-6.1 Sol/high for synchronization correctness. A slow earlier
send could exhaust the existing four-minute deadline, yet the table loop still
loaded and hashed each later Sheet before the send helper rejected it. Two
actual-module VM regressions reproduced this: dirty sync read2 rather than1
Sheet, and full reconciliation read16 rather than1.

The loop now checks its already captured source timestamp before loading the
next Sheet. Full reconciliation still queues every unattempted table; failed
tables remain pending, acknowledged tables clear only their matching marker,
and the lease is released. This cannot interrupt a blocking native call, and
remaining marker/lease cleanup can still require native IO after the deadline.
It does not resolve or measure the previous335s idle Cache stall or prove the
unchanged900s/day target.

Both regressions RED-to-GREEN; affected19/19 and independent review19/19 PASS,
no actionable findings. One full local859/859 PASS,2.566s,zero fail/cancel/skip,
Node22.23.3 with actual pinned Core and owned disposable PostgreSQL16.14.
Database/role cleanup, stopped cluster and closed listener verified. Tested
477-file snapshot `3a69f2c26519e21b25b2df3437e670f1326cc9a59606e61a5edf867b5a8bb14b`;
only documentation changed after the run. Validate71backend/40endpoints/static
cache and diff checks PASS. Worker source unchanged; no repeated capacity run.

No Google/account/credential/Properties/trigger/Sheet/deployment operation took
place. Original25/160 budget remains unchanged and unclaimed; the separate
native-IO purpose amendment is still awaiting the owner. The approved accelerated
schedule supersedes the earlier three-day calendar requirement only: after
technical gates, sync/shadow run in parallel24h, rooms first, another stable24h
before later accepted pages, seven-day observation after enabling. That clock
has not started; daily runtime, privacy, freshness, performance and device gates
remain unaccepted and read switches remain off.

Rollback this undeployed deadline guard to `6b90a4ca3efc8a83b706268d5039f5d9bb988a7c`
before any corrected synthetic release if necessary. Retain existing serving
versions, source data, dirty generations and the original failed observation.
