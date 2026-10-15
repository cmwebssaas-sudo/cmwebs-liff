# C3 authorization implementation plan

Recommended model/speed: GPT-6.1 Sol/high, per the approved work plan. Independent
branch `codex/c3-read-api-auth-20261012`, base C2 `91da898`. C1 actual observation
continues; no production/auth credential publication is authorized by this
document alone. The user's current batch authorization controls release gates.

Implement and test before enabling an operational path:

1. Strict Authorization header parsing. Verify LIFF ID tokens with LINE's
   provider endpoint and the configured login channel, checking issuer, audience,
   expiry and subject. Cache only successful claims under credential SHA-256,
   at most five minutes and never beyond actual expiry. Do not cache access.
2. Email session hashing must exactly match GAS HMAC-SHA256 of `session:` plus
   trimmed token. Worker secret name `EMAIL_SESSION_HMAC_SECRET` corresponds to
   the existing `CMWEBS_EMAIL_LOGIN_HASH_SECRET`; values are never read/logged
   in this work order. Resolve one session, status, expiry, revocation, current
   user Email eligibility and matching active Workspace/role on every request.
3. Reuse canonical read-only Workspace/context/principal/permission helpers.
   Reject missing/inactive users, Workspace, membership, incomplete onboarding,
   and roles outside the existing six landlord membership roles. Use only
   server-verified identity and current stored active Workspace. No client
   query field can choose identity or widen scope.
4. D1 queries load authorization rows first, then only approved Workspace rows
   and explicit existing legacy ownership/property relationships. Users are
   global identities, selected only by referenced IDs. Retain source order and
   scalar/Date types. Tests include malicious cross-Workspace shared-ID fields.
5. Owner approved `READ-AUTHORITY-DECISION.md` on2026-10-12. Each user read now
   requires an uncached, request-bound GAS confirmation, identical to the
   primary D1 authorization fingerprint. A successful revocation patch is
   enforced by D1 immediately; a patch that never arrives is denied by the next
   authoritative confirmation. Incomplete snapshots, a newer receiving run,
   snapshots older than26 hours, or source dirty/sync markers produce fallback.
   No new idle trigger IO is introduced. This is not proof of synchronization
   of manual Sheet edits. Re-measure actual authenticated latency and usage.
6. CORS allowlist is only `https://cmwebssaas-sudo.github.io`; JSON failures
   contain no credential, row or stack. Test missing/forged/other-user/expired/
   revoked/replayed tokens, disabled accounts/Workspaces/memberships, role and
   scope tampering, provider/cache/network failure, and repeated access changes.

No live secret, OTP, formal row or production setting is read or modified during
local implementation. Use synthetic credentials and actual local workerd/D1
tests. Cloud publication needs completed preceding gates, independent review,
credential presence/binding readback and authenticated/device acceptance.
Rollback keeps C4 flags off/GAS and restores the prior Worker version; retain
replica/export/schema data. If source-derived room bridge capability is false or
missing, rooms remains a controlled503 for GAS fallback.

Implementation uses primary D1 sessions, bound query values and static schema
identifiers. Operational tables never enter JS before authorization. Explicit
foreign Workspace rows and legacy rows anchored to a known foreign property,
room or contract are excluded. Corresponding canonical GAS scope helpers share
the same parent rule so fallback and field parity retain the boundary. A
request-local parent map avoids repeated Sheet scans; it is never shared across
requests. Pure fingerprint extraction reuses the canonical GAS permission
helper rather than a separate permission table.

Write-mode property/room filters build a lazy three-table parent map once per
filter invocation. A later filter rereads the parents, including after a write;
write snapshot/shared cache stays disabled. Counted-read regression covers ten
legacy rows, a subsequent foreign-parent change, and all-explicit rows.

Schema extension0003 adds existing Email eligibility metadata. The generator
reads all existing migrations and appends only uncovered additions; it never
rewrites a previously provisioned migration. Production configuration and real
credentials remain untouched. Source completion, CI, remote readback and real
device/performance acceptance are separate gates.

Release sequence and readback:

1. Finish C1's actual72-hour correctness/runtime gate, then provision and verify
   the approved C2 projection. Apply additive migrations in order; retain the
   current replica and deployment records before changing any binding.
2. Publish the reviewed canonical GAS source as a new immutable version on the
   existing Web App URL. Read back editor and serving-version bytes, route
   presence, authorization failures and unchanged operational reads. Retain
   the previously serving immutable version and all other deployment URLs.
3. Use an independent synthetic C3 candidate to verify real Google redirects,
   request/response HMAC, immediate source-only LINE/Email revocation and current
   permissions. Do not change the ongoing C1 observation environment.
4. Configure the original verified GAS URL/channel and required secrets through
   approved credential handling. Verify presence and bindings without reading
   or logging values. Publish/read back Worker version, D1 schema and closed
   flags, then measure authenticated latency and usage before enabling any read.

Rollback: keep all frontend flags off or republish the recorded off release;
restore the prior Worker version and prior GAS immutable serving version on
the same URLs. Retain additive D1 schema/rows and exports for diagnosis. Do not
delete formal Sheets data. Configuration removal is unnecessary to fall back.


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

## 2026-10-12 — Synthetic service profiling

Recommended GPT-6.1 Sol/high. Authenticated Apps Script history contains42
completed synthetic v1 Web App executions: minimum1.898s, median3.0495s,
maximum34.129s, total166.116s. These platform durations are not paired with
individual request nonces; completed does not establish a valid authority reply.

A separate immutable synthetic v2 retains all eight canonical GAS modules and
the existing manifest/scopes/Properties. Only its test binding harness adds
request-local method timings and signed private telemetry. Independent review,
native-module VM tests and10-file editor/immutable exports passed. The initial
deployment GET returned404 after creation; a subsequent read-only check verified
the recorded deployment and immutable source without another deployment POST.
The original v1 endpoint remained unchanged. After measurement, the original
editor10 files were restored and read back, retaining both immutable versions.

Three diagnostic requests passed canonical MAC/nonce/digest/route/freshness/
fingerprint verification before telemetry was inspected:

| Sample | Client roundtrip ms | Canonical authorization ms | Range metadata ms | Values ms | Other unmeasured authorization ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 8131.150 | 3306 | 1215 | 564 | 797 |
| 2 | 3463.392 | 2164 | 914 | 455 | 449 |
| 3 | 5108.085 | 3073 | 1045 | 544 | 987 |

Each request performs five full Sheet reads, four request-local cache hits and
zero shared cache hits. Non-overlapping measured Sheet/binding services total
2509/1715/2086ms; binding timings are nested inside sheet lookup and counted only
once. Unmeasured authorization includes config/nonce/cache/lock/crypto/local
work. Client deltas also include runtime/redirect/test telemetry overhead, so
neither residual identifies an exclusive cause. The33-row fixture, test binding
and15000ms diagnostic deadline exclude p95,500-room,LINE/device or formal
acceptance. The normal1500ms deadline and closed flags remain unchanged.

## 2026-10-12 — Request-local bulk transport feasibility

Recommended GPT-6.1 Sol/high. An independently reviewed manual benchmark used
only the existing owned synthetic project and five authorization tables. Its
fixed Google HTTPS GET rejects redirects and never logs rows, tokens or error
messages. The first two native executions returned403; the second classified
only the safe classification `API_DISABLED` from Google's allowlisted
`SERVICE_DISABLED` reason. Both failures are retained.
Adding the Sheets/v4 advanced-service dependency to this test editor preserved
the original two OAuth scopes. No new grant, deployment or timer was created.

The21:13:54–59 Taipei execution compared three sequential bulk/native pairs:

| Sample | Bulk GET ms | Native Sheet reads ms | Typed scalar/local-clock mismatches |
| --- | ---: | ---: | ---: |
| 1 | 358 | 1331 | 0 |
| 2 | 239 | 863 | 0 |
| 3 | 218 | 823 | 0 |

Each sample checked166 cells, including one native Date and51 empty cells.
Date comparison used the native value's Taipei wall clock against the API
serial; this does not implement or verify a serial-to-Date authorization loader.
These pairs share one invocation and may benefit from warm services. They are
not separate authenticated requests, p95,500-room capacity, LINE/device proof
or the1500ms authority/800ms page acceptance. Permission logic and shared-cache
policy were unchanged. Before any loader can qualify, test Date reconstruction,
source row order, missing/malformed tables, every supported role/identity and
fresh source revocation against canonical authorization; never cache a positive
access decision across requests.

Original10-file editor restored and read back at21:18:12; the Sheets dependency
was removed from the editor and both immutablev1/v2 deployments retained.
No Cloud API disable was requested, so editor rollback is not a claim that
Google's default-project API activation was reversed. No formal/C1 source,
Properties, data, timers or flags changed. Actual API use succeeded only after
the dependency change; a manifest alone was not treated as activation proof.

## 2026-10-12 — Native Utilities hypothesis check

An independently reviewed editor-only manual function timed100 synthetic JSON
strings without reading real rows, identity or signing credentials. Fixed
project/Sheet/title checks,75s loop checks and safe failure output passed eight
fake-runtime tests; a blocking native call itself cannot be interrupted.
Actual21:51:31–33 execution measured107ms for100 SHA-256 digests and254ms for
100 UTF-8 Blob byte counts (14580 total bytes). This one sample does not support
replacing crypto to explain the earlier tens-of-seconds preparation delay.
No hash or signing implementation was changed, and these100 strings are not a
500-room, p95, daily-runtime or72-hour acceptance result.

After capture, original10-file editor source was restored and verified at
21:52:43, retaining immutablev1/v2. No dependency, scope, deployment, Property,
trigger or data change was introduced by this Utilities benchmark. Continue
the request-local bulk-reader feasibility work and investigate remaining
service/network boundaries; formal acceptance remains NOT_ACCEPTED.

## Request-local bulk reader candidate — not yet remotely accepted

The candidate retains the original signature, nonce, credential digest, route,
access helpers and deadlines. After these request checks it reads the five
authorization tables from the trusted runtime Spreadsheet ID through one fixed
Google HTTPS GET, with the existing OAuth grant, no redirects and no HTTP cache.
The request-local adapter loads only at the original resolver's first value
read, preserving LINE provider verification and Email token hashing before the
policy snapshot. No caller can supply verified identity or actor claims.
It reconstructs primitive types, blank/formula row positions and source-timezone
Date milliseconds in a request-local read-only adapter. Access denials never
retry another reader. API/format failure uses the original fresh native reader;
such fallback does not count as successful performance acceptance.

Input is bounded to100000 sparse cell entries and100000 total hydrated cells,
20000 rows/table,100 columns and1000000 response characters. The hydrated-cell
guard was added after independent review reproduced sparse expansion beyond
the original input cap. Original runtime handles, values and contexts are
restored after resolution; no positive decision is cached across requests.

Local49 grid cases and19 existing authority/access/identity cases pass, including
six roles, delegated manager/foreign principal, one-millisecond session expiry,
source-only changes, access changes during provider/hash waiting, replay/forgery
and native fallback. Native IO counters prove
the successful grid cases did not silently fall back. Full unit suite933/933
passes after regenerating the source-hash manifest; calculator code is unchanged.
These tests use synthetic Google/Utilities adapters. The bounded native Date
check below is separate evidence; authenticated strict latency, broader capacity,
LINE/device and all preceding release gates remain required before formal
publication or enabling a formal read path.

## 2026-10-12 — Exact native Date check and candidate editor rollback

Independent source review required both bounded hydrated matrices and original
identity/hash-before-values ordering. Regression cases reproduced those defects
before the fixes; the final49 grid cases plus19 existing policy cases passed
independently. Only the authorization module and manual harness changed in the
owned test editor. Its other seven modules, manifest/scopes and original doPost
prefix remained exact; complete changed-source hashes guarded publication and
rollback before any OAuth access. Both immutable test deployments were checked
before and after editor changes. No new deployment was created.

Actual22:40:41–46 Taipei manual execution used the bulk path without native
fallback. All166 cells matched original native matrix dimensions, scalar types
and values; one stored Date matched exact epoch milliseconds,51 cells were
empty, and three synthetic Taipei midnight/millisecond boundaries round-tripped
through actual Utilities with zero mismatches. Bulk preparation576ms; five
native matrix reads2918ms. This one33-row invocation is not a signed authority
request, lazy-resolution end-to-end test, p95,500-room, LINE/device or strict
1500ms acceptance. No external-service wait is excluded from the future gate.

Original10-file editor restored and exported exact at22:41:56, with the candidate
authorization removed and immutablev1/v2 retained. No source data, Properties,
scopes, timers, formal source/Worker or flags changed. Keep formal acceptance
NOT_ACCEPTED and test the candidate's actual signed authority roundtrip next.

## 2026-10-12 — Signed candidate roundtrip and editor rollback

The independently reviewed private publisher/probe retains the initially
validated source throughout OAuth and live readback, records version/deployment
identifiers before subsequent checks, and emits only fixed error classifications.
Nine publisher, six actual-probe control and18 pure-gate fake tests passed;
source-swap regressions reject publication or stop before credential-seed IO,
and synthetic exception sentinels cannot enter output/evidence. Canonical68
authorization regression tests were repeated successfully with source unchanged.

Only the owned synthetic project received a new immutablev3 and separate test
endpoint. Its10-file source export matches the reviewed candidate; seven other
canonical modules, original dispatcher/manifest/scopes and existingv1/v2 remain
unchanged. First deployment readback404 was recovered through the recorded
identifier using read-only management operations, without duplicate creation.

At23:13 Taipei the canonical Email identity/access and request-bound authority
probe retained all three strict failures: full1505.069/1503.023/1504.684ms,
READ_AUTHORITY_UNAVAILABLE, no response headers. Three separately labeled
15000ms diagnostics passed signed reply verification, with first headers
2902.806/2900.429/2321.985ms and complete3302.118/3187.969/2620.684ms.
Each successful diagnostic had one302 POST then one200 GET. These are three
synthetic33-row requests, not p95, remote D1,500-room, real LINE/device or formal
performance proof. They do not prove that the bulk path avoided native fallback:
the original signed harness has no per-request reader-choice telemetry.
No timeout was relaxed for acceptance and no failed sample was discarded.

At23:14:32 the original10-file editor was restored and exported exact; all eight
canonical modules are original, candidate authorization removed, immutablev1/v2/v3
retained. No source-data, Properties, scope, timer, formal deployment/Worker or
flag change. Strict latency remains NOT_ACCEPTED. Isolate reader choice and
canonical authorization service time before attributing latency to the bulk
adapter; all C1/C5/performance/device gates remain mandatory.

## 2026-10-12 — Signed reader-choice and service-time diagnostic

Independent review and63 fake control cases cover the owned v4 diagnostic:
7 harness,7 actual editor/retained-version,9 publisher,6 actual-probe,
19 source/deployment gates and15 telemetry cases. Telemetry uses only the
canonical reader's consumed bytes, with the existing20000-byte limit and
cancellation, no clone/tee or extra body IO. Only a successful canonical
signature/freshness/access check permits fixed-label, bounded numeric telemetry
to enter evidence; damaged signatures and private sentinel fields are tested.
The source-pinned harness restores its request-local bulk hook in finally and
includes diagnostics inside the original signed response body. The canonical
authorization source is unchanged from the reviewed bulk-reader candidate.

Owned synthetic immutablev4 and its10-file source were read back; initial404
was recovered read-only through the recorded deployment, without duplicates.
At23:31–23:32 Taipei all three strict1500ms samples failed at1505.136/1503.891/1503.527ms
without response headers. Three separately labeled15000ms diagnostics passed
canonical signed checks and each reported one successful bulk attempt, no
native range.getValues observation and zero shared cache hits. First headers
2547.023/2660.057/2726.958ms; complete2967.576/2917.804/3002.265ms;
authorization.total1183/1394/1052ms, containing bulk288/632/223ms.

Owned test binding openById297/274/256ms and title43/40/43ms are nested in
spreadsheet.getSheetByName397/342/353ms, itself part of authorization.total.
These observations must not be summed as independent elapsed times or CPU.
Runtime counters9 theoretical full reads/5 adapter reads/4 local cache hits
are not five native Sheet value reads: native range.getValues was absent in
this harness. The successful bulk path is demonstrated for these three
synthetic requests; strict latency remains NOT_ACCEPTED. Remaining time is not
assigned to a single Google/platform/transport operation without measurement.

Original10-file editor restored/exported exact at23:33:42, all eight original
canonical modules restored and immutablev1/v2/v3/v4 retained. No formal/C1
source, source-data, Properties, scopes, timers, Cloudflare or flags changed.
This33-row diagnostic is not remote D1,500-room, p95, real LINE/device or formal
performance acceptance; all original release gates remain required.


## 2026-10-13 — HTML response packaging diagnostic, not accepted

Recommended GPT-6.1 Sol/high. A private owned synthetic harness changed only
its final ContentService response packaging to HtmlService. The reviewed bulk
authorization and nine other source files stayed exact to the retained v4
candidate. The lab decoder preserves the signed inner bytes and original
canonical cryptographic/freshness/access checks; it is not the unmodified
canonical HTTP reader accepting HTML.

Independent review reproduced and corrected three diagnostic-control defects:
pending cancellation must not hold the deadline, every opening/closing marker
must be unique, and terminal request timing excludes local progress-file IO.
93 offline harness/lifecycle/parser/telemetry cases passed, along with68
canonical authorization regressions and validate72. Full npm test938 reports
933 pass, one missing PLATFORM_CORE_TEST_WORKTREE failure and four external
fixture skips; it is not a complete suite pass.

Owned immutablev5/source10 were read back. Two initial management readback404s
were retained; recorded-ID recovery and the native deployment view confirmed
the same version/endpoint without duplicate creation. The actual01:39–01:40
Taipei run reserved exactly six signed requests in persistent state:

| Series | First headers ms | Complete client ms | Result |
| --- | --- | --- | --- |
| strict1500ms, sample1 | none |1503.976| READ_AUTHORITY_UNAVAILABLE |
| strict1500ms, sample2 | none |1502.382| READ_AUTHORITY_UNAVAILABLE |
| strict1500ms, sample3 | none |1503.711| READ_AUTHORITY_UNAVAILABLE |
| diagnostic15000ms, sample1 |2342.746|2350.376| HTTP200, BODY_REJECTED |
| diagnostic15000ms, sample2 |2619.944|2622.626| HTTP200, BODY_REJECTED |
| diagnostic15000ms, sample3 |2667.567|2671.189| HTTP200, BODY_REJECTED |

The three diagnostic responses showed one POST hop, but no verified envelope
or telemetry. Those signed failures alone do not distinguish cap, marker or encoding failure
and cannot support latency acceptance or a causal comparison with prior v4.
Native history confirms six completedv5 executions, chronological durations
2.968/2.736/2.620/2.018/2.343/2.392s. Server completion does not reverse the
client timeouts or establish signature/access validation.

Original10-file editor restored/exported exact at01:41:32 Taipei, including
all eight original canonical modules; immutablev1–v5 retained. No formal/C1
source, data, Properties, scopes, timers, Worker or read-flag change. Keep
strict latency NOT_ACCEPTED; actual corrected C1 72-hour, seven-day shadow,
500-room, D1 and authenticated LINE/device/performance gates remain incomplete.

A separate independently reviewed single unsigned POST `{}` then classified
only wrapper structure, without OAuth/credential/fixture IO or any additional
signed request. Its15s deadline and20000-byte cap were retained;16 fake controls
passed after an abort/read race regression. Actual01:46 Taipei result: HTTP200,
8130 UTF-8 bytes, one ordered opening/closing marker,82 encoded characters;
the encoded segment was not plain URL-safe base64 and contained hex-escaped
padding. No raw HTML/envelope was saved or executed. This observed unsigned
wrapper cannot certify the earlier three signed response bodies, signature,
access or latency. Next lab parser work can address this specific escaping
while keeping all original caps/auth/deadlines and failure history unchanged.


## 2026-10-13 — Unpadded HTML envelopes verified, latency not accepted

Recommended GPT-6.1 Sol/high. The private owned v6 harness changes only the
final producer to remove base64 padding. Nine other candidate files remain
exact to v5, including the reviewed bulk authorization. The strict decoder is
unchanged; it neither decodes JavaScript escapes nor relaxes canonical UTF-8,
base64, unique-marker, signature, freshness, access or 20000-byte checks.
The actual harness regression first failed with a genuinely padded fake encoder,
then passed after the producer change. Independent review and 99 offline
harness/lifecycle/parser/telemetry cases passed, including retained v5 source
pins/configuration, unknown creation outcomes and reservation-before-send.

Owned immutable v6/source10 were read back after one management 404 recovered
through the recorded ID, without duplicate creation. Actual 02:00 Taipei run
reserved exactly six new signed requests; all earlier v5 failures/intents remain.

| Series | First headers ms | Complete client ms | Verification |
| --- | --- | --- | --- |
| strict1500ms, sample1 | none |1505.783| READ_AUTHORITY_UNAVAILABLE |
| strict1500ms, sample2 | none |1503.620| READ_AUTHORITY_UNAVAILABLE |
| strict1500ms, sample3 | none |1502.290| READ_AUTHORITY_UNAVAILABLE |
| diagnostic15000ms, sample1 |2937.959|2951.322| extracted envelope verified |
| diagnostic15000ms, sample2 |2264.110|2266.999| extracted envelope verified |
| diagnostic15000ms, sample3 |2893.820|2898.482| extracted envelope verified |

Each diagnostic has one HTTP200 POST hop, one successful bulk attempt, no
native range.getValues observation and zero shared cache. Signed verified
telemetry: authorization.total1696/1024/1701ms contains bulk275/293/286ms;
outer10270/10267/10270 bytes and decoded1666/1664/1666 bytes remain below caps.
Binding/method durations overlap and are not summed. The runtime counters
9 theoretical/5 adapter reads and4 local cache hits are not native Sheet IO.
Lab extraction validates original canonical cryptographic/access checks against
the synthetic fixture; canonical_http_transport_acceptance remains false.
This is not the unmodified canonical HTTP reader accepting HTML.

Native history confirms six completed v6 executions with chronological platform
durations212.683/4.589/2.663/2.594/1.910/2.590s. The long first strict execution
is retained; client cancellation did not establish server cancellation. Its
internal delay location is unverified because no verified telemetry reached
the client. Native completion does not turn any strict failure into acceptance.

Original10 editor first restored at02:03:04. After all native executions were
confirmed terminal, an idempotent final source/configuration check at02:07:18
verified all10 source/type bytes including manifest exact, original eight
canonical modules and immutablev1–v6 retained. No formal/C1 source, data,
Properties, scopes, timers, Worker or flag change. Repository source is
unchanged; prior full-suite result remains933 pass/one missing Core-worktree
failure/four fixture skips. Strict latency NOT_ACCEPTED, actual corrected72h,
seven-day shadow,500-room,D1,real LINE/device and authenticated user-flow
acceptance remain incomplete.

## Scoped read cost evidence

The seven existing synthetic canonical route requests now observe the actual
server-resolved access/data loader rather than substituting the C2 whole-table
batch. Baseline uses63 serial SDK single calls/statements per route, one
first-primary session, no batches. Numeric test-only headers expose attempted
call/statement counts and summed await wall time, never SQL/row values. Original
result parity, request count and strict100-sample fixture benchmark are retained.

These seven single requests omit full HTTP replica/session/provider and GAS
authority costs; read_validation_ms also includes existing test assertions.
They are neither p95 nor production speed proof. Batching may be investigated
next while keeping identical bound SQL, result ordering, scopes and fail-closed
checks. Original authorization/performance and all real gates remain unchanged.

## 2026-10-15 — Preserve scope while batching dataset reads

The scoped loader retains sequential authorization and first-primary sessions.
After access, each dependency stage is awaited: properties→rooms→contracts,
then independent operational tables and referenced users. Bound SELECT text,
80-key chunks, foreign-Workspace/foreign-parent exclusions, result types,
last-wins/source ordering and10001-row sentinel remain. Known-input statements
share bounded80-statement SDK batches; exact count/array/success and decode
validation fail closed. No client identity/scope, retry or shared cache is added.

Rich fixture63 statements now require12 SDK calls instead of63. The241-parent
case actually splits80+8 and preserves tail rows and GAS parity. Numeric batch
sizes are test-only. Capacity/memory, full authenticated HTTP latency and real
Google/900s/72h/seven-day/device gates remain separate and unaccepted. Rollback
to5ea8c96 restores the serial source; this change is not formally deployed.

## 2026-10-15 — Child stdin failure is a local protocol failure

Consume stdin error events in scoped preparation/runtime and stop requests.
Reject queued/future protocol operations with TRIAL_STOPPED; a stream error
cannot mark the child terminal, charge/retry an action or authorize cleanup.
Keep entered-IO drain and actual child finalization. Failed stop input cannot
acknowledge a durable stop. Two real-child fault regressions and full1720/1720
pass; no actual Google trial or formal setting changed.

This does not prove OS-flock continuity across Python EOF/death while external
IO survives, remote execution termination or overall rollback. Actual admission
remains stopped pending the broader phase/holder, native160 and original gates.
