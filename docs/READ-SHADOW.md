# C5 shadow observation candidate

Recommended model/speed: GPT-6.1 Sol/high, per approved work plan. Independent
branch `codex/c5-read-shadow-20261012`, based on C4 `0af14ca`. Source remains a Draft candidate; actual observation T0 is NOT_STARTED.
The owner-approved accelerated schedule supersedes the original prelaunch
calendar; C1 daily900s and C3 actual safety/performance are still unaccepted.
No new observation or rollout follows from source tests.

## Authenticated observations

Shadow reads carry `X-CMWebs-Read-Mode: shadow`. After verifying LINE/Email and
resolving current primary-D1 access, the Worker records a server-timed attempt
before its uncached GAS authority check. It records the actual final status and
exposes an opaque UUID receipt through `X-CMWebs-Shadow-Receipt`. Normal/on reads
create no shadow metadata. Operational reads still require matching current
GAS authority, no pending source marker and complete/fresh replica snapshots.

`POST /v1/shadow-report` reuses provider verification, current D1 access and
uncached GAS confirmation. Its exact JSON keys are `route`, `variant`, `release`,
`outcome`, `paths`, `clock_paths`, `receipt`, `headers_ms`, `elapsed_ms`. No source
values, raw dynamic keys, actor/Workspace IDs or credentials belong in the body.
CORS permits only the existing Pages origin. Bodies are bounded to24KiB and a
one-second read deadline; timing must be finite and at most3000ms. Paths use a
generated fixed vocabulary, at most100 unique entries, depth32 and length200.

A `compared` report needs a completed200 receipt for the same verified actor,
Workspace hash, epoch, release, route and home section, issued within five
minutes and not consumed. One D1 transaction rechecks this match and the120
reports per actor/five-minute limit, inserts report/path metadata and consumes
the receipt. Replay is409, rate exhaustion429, failure503 with no partial rows.
A `worker_error` report has no receipt, timings or paths; it may record pending
replica failure after current authority verification without serving any data.

Migration0004 adds observation/attempt/clock metadata and the diff relationship;
0001–0003 remain unchanged. Scope/actor identifiers are server-derived keyed
hashes. No operational financial rows or formal Sheet data are mutated here.

## Approved clock rule

On2026-10-12 the owner explicitly approved `READ-CLOCK-DECISION.md`: only the
listed route/section/path generation clocks, both canonical ISO and at most60
seconds apart, are classified separately. All business fields, source-row
`updated_at`, structure and order remain exact. Those clock paths are stored in
`shadow_clock_diffs`, counted separately and remain visible in daily exports.
Both generated contracts are derived from actual browser constants by AST.
API responses and rendering are unchanged. A busy-browser delayed timer cannot
extend the three-second read deadline: elapsed time is rechecked after decoding.

## Real observation and export gate

After preceding actual C1/C2/C3/C4 gates pass, publish/read back GAS, Worker and
Pages candidates, then configure a fresh `READ_SHADOW_EPOCH`, exact
`READ_SHADOW_RELEASE` and canonical `READ_SHADOW_STARTED_AT`. These are metadata,
not credentials; absent/invalid configuration keeps the receiver closed. Record
the real start and immutable source/deployment versions before enabling shadow.
Release cache references are `20261012-read-shadow-v1` across40 root HTML pages.

`src/shadow-export.js` supplies five operator-only parameter-bound queries for
window coverage, timings, ordinary paths, attempts and clock paths. There is no
public export endpoint. Select the verified scope/epoch/release privately;
exports contain only route/count/path/time aggregates, with no raw identities.
Use actual server attempt time for receipt-backed comparisons, even if a report
arrives across a daily boundary. Export the entire epoch through current time.

`node scripts/evaluate-read-shadow.mjs private-export.json expected-epoch expected-release`
uses the actual current clock. It checks the latest seven complete24-hour
windows, all six routes and both home sections, at least one matched comparison
per group, zero ordinary differences, and no unresolved errors/missing/pending
attempts anywhere in the epoch, including the current partial eighth day.
Missing reports never count as zero differences. A defect or relevant release
change requires a correction and new observation epoch. Synthetic clocks test
this logic only. An eligible aggregate is explicitly only a candidate requiring
verified remote export, deployment readback, latency and device acceptance.
A receipt proves a read happened; the comparison remains tied to the verified
published browser build and does not replace physical-device acceptance.

## Local verification and rollback

Actual local workerd/D1 HTTP tests exercise current LINE/Email authority,
source-only revocation/role changes, CORS, privacy validation, receipt replay,
concurrent limit enforcement, transactional rollback, rolling export boundaries,
and the actual browser router/report/storage chain including clock separation.
Unit902/902 and Worker24/24 including bundle dry-run pass; validate checks72
backend files and40 endpoint references. Full suite902 pass, one documented
missing external Core/PG fixture failure and four skips; external integration
acceptance is not claimed. Independent focused clock review also exercises
canonical ISO/60-second boundaries and actual D1 clock transaction rollback.

No formal deployment, binding, property, trigger, migration or flag change has
occurred for this candidate. Rollback is flags off, publish/read back Pages,
then restore prior immutable Worker/GAS versions if needed. Retain replica and
observation metadata and version evidence; no formal data deletion is required.

## C6 sequential-release identity repair

C6 adds a generated comparison source manifest and browser
`CMWEBS_READ_COMPARISON_VERSION`. Receiver `READ_SHADOW_RELEASE` uses this
comparison identity, verified against the bundled Worker manifest, rather than
the asset cache tag. Flags-only Pages publications advance asset references
without invalidating unchanged comparison/source/authority evidence. Included
source/endpoint/contract changes regenerate identity and restart real observation.
The default C5 evaluator still requires all routes; subsequent C6 per-page checks
require that page's latest seven complete windows (both home sections), retain
all epoch errors/missing evidence, and require the initial qualification ledger.
See `READ-CUTOVER.md`; this repair has not started any real observation.

## 2026-10-20 — Server-verified sampling metadata for approved acceleration

The approved accelerated schedule requires at least20 real paired samples per
candidate page, LINE and Email at least10 each, over at least3 periods. Existing
seven-day coverage and count-only exports could not establish those conditions.
Migration0006 adds auth_kind to shadow_attempts with a fixed line/email/unknown
constraint. Only authenticated identity.kind supplies it; header/body assertions
are ignored or rejected. Existing attempts remain unknown, retaining their
previous status/time/receipt; they cannot establish a known login channel.

The existing second operator query additionally exports server attempt time,
verified auth_kind and the same opaque receipt. Keep this result as sample_rows
alongside rows and attempt_rows, plus the verified export cutoff exported_at.
There are still five queries and no public export route; no raw identity,
credential, source value or additional DB roundtrip is introduced. Samples are
actual matched successful receipts; timestamps are not delayed report times.
These fields enable the C6 accelerated candidate checker, and do not themselves
accept a24h observation, safety, timing, device or cutover gate. The legacy seven
window checker remains available for its original evidence scope.

Deployment preparation: back up the actual Worker/database schema and serving
identity, apply the additive0006 migration before publishing this Worker or
running the new export, then read back schema and source/bindings. A changed
comparison source requires a fresh matching observation epoch. This source
increment performs no remote migration, deployment, credential or flag action.
Rollback to the preceding immutable Worker; leave the additive column and all
history intact. The old Worker can insert without the column (default unknown).
Never drop observation data to perform rollback. Retain all real acceptance gates.

## C6 accelerated evaluator wiring — 2026-10-20

The new operator CLI and pure candidate evaluator are documented in
READ-ACCELERATED-OBSERVATION.md. The legacy seven-window evaluator above is
unchanged; it does not implement the approved24h sample distribution gate.
The new result is shadowEligible only, always cutoverAuthorized:false; verified
remote export, common-failure review and all actual C1/C3/rollout/device/rollback
requirements remain external. New capture requires source/comparison readback.
