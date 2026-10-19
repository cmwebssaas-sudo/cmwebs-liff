# C6 sequential read cutover runbook — preparation only

## Current accelerated shadow candidate gate — 2026-10-20

The owner-approved24h schedule is operative. Use
`node scripts/evaluate-read-accelerated.mjs private-export.json expected-epoch expected-comparison-version page`
for the selected page's latest complete24h sample window; see
[READ-ACCELERATED-OBSERVATION.md](READ-ACCELERATED-OBSERVATION.md). It checks20
real paired samples per page, verified LINE/Email>=10 each and three relative8h
periods, both home sections, current partial failures, receipt uniqueness and
count consistency. Migration0006 and a new matching source/comparison identity
are required before new real capture. Old unknown-channel history is retained.

This operator result is only shadowEligible and always cutoverAuthorized:false.
It cannot authenticate export/scope/T0, waive common-failure review or replace
actual C1/C3, daily900s, Taipei03:00/cross-day, provider latency, device, rollback,
rooms-first and subsequent stable24h, or seven-day postlaunch acceptance.
Keep flags off until those actual gates pass. The seven-window descriptions and
original evaluator below retain their historical evidence scope; they are not
the24h candidate evaluator and do not prove postlaunch days already happened.
No real T0, migration, deployment, credential, Google or flag action occurred.


## October18 request-local month parsing — local pass, CI pending

Recommended model/speed: GPT-6.1 Sol/high per the C6 performance/parity plan.
Based on781c766, an optional request-local adapter reuses the original canonical
month parser for at most64 primitive string inputs of at most256 characters.
Every hit returns a fresh array; mutable/coercible inputs and errors retain the
original path. The GAS parser body is unchanged; generated closure, service
adapter manifest and comparison identity are regenerated together.

Focused RED4/4 missing-adapter failures then GREEN4/4; full unit2257/2257,
Worker/pretest43/43, validate72/40/static/comparison179 and diff checks PASS.
One initial test expectation incorrectly sorted a mutated array; the canonical
source retains input order, so the test now expects8,7 and the failure is kept.
Independent source review found no P1/P2. These are local checks only.

Original100-sample500-room full HTTP/D1/body p95ms:
home13.175/actions12.797/revenue12.024/tenants18.225/rooms13.448/
arrears15.899/properties17.355. These timings include the full response and D1;
they are not CPU measurements. Previous CI38843225901 properties53.119ms remains
a failed historical gate; this local result does not override it. Fresh exact-head
CI is required. Earlier isolated calculator and100+100 paired property samples
show a small gain, not a formal latency or reproducibility claim.

Comparison `read-6dbfab7d7606bfcfdef4d7c69d03adff4b9a44268bd8cd668cb7efc57f38d44a`; asset version unchanged. No main merge, deployment,
read flag, Property, trigger, formal data or observation T0 change. C1 runtime,
C3 actual authority, authenticated latency, approved24-hour observation, device,
rollback and seven-day postlaunch gates remain. Undeployed rollback restores the
runtime/generator/generated artifacts and new tests to781c766 while retaining
all measurements and failures.

## October16 encoded writer restoration — fresh CI required

Head9d745be CI38828519240 is terminal: rental2247/2247 PASS;
Worker42/43 FAIL. Original500-room p95ms home51.871/actions40.158/
revenue44.228/tenants64.449/rooms53.741/arrears58.476/properties69.328;
five groups fail the unchanged strict50ms gate. Provider logs are truncated;
returned terminal footers and all seven stage summaries are retained.

The new candidate restores only the original encoded SQL writer to avoid
duplicated JSON validation at every present cell. Canonical occupancy and
the legacy/typed decoder remain. All65 D1 semantic cases remain; encoded-frame
expectations replace assertions specific to the removed typed writer.
Focused9/9, validate72/40/static/comparison179 and diff checks pass.
Comparison read-a6bbc6244c79ed1087ce576ee1c2c46430b4325ac2762c60fb25a6561e3095e7;
asset20261013-read-capacity-v7 unchanged. This candidate uses the next normal
PR CI for full unit/Worker/capacity verification; no duplicate local full or
Core/PG run is claimed. The prior local43/43 does not override CI failure.

The preceding typed entry records a precommit comparison identity; the exact
committed9d745be identity is read-e980d02a0f487eaf7cac15b734df01fe85aad5bcabbd9c7e7423cbd9a1a27dd3.
All failures remain. Keep Draft/off/blank/T0 not started. Actual C1/C3,
authenticated latency, approved24-hour observation, rollback/device and
seven-day postlaunch gates remain. Undeployed rollback restores this writer,
wire-contract test and generated comparison to9d745be, retaining evidence.

## October16 strict typed transport — local gates pass, real cutover closed

Recommended model/speed GPT-6.1 Sol/high. Shared canonical room occupancy and
strict packed-cell transport preserve full responses, source fields and access
checks.633-path snapshot0ed8611fb681e31146b1fe2d5d76c4772d2180adf6476c24a8acf6ccdeefc084
at base ac7fc474: full npm2252/2252, original Worker/pretest43/43, validate
72/40/static/comparison179 PASS; clean independent reviews and owned PG/Worker
cleanup. Later three evidence docs excluded from tested snapshot.

Original100-sample500-room p95ms: home22.390/actions20.855/revenue21.713/
tenants27.732/rooms23.535/arrears28.446/properties37.468, all<50. All1400
capacity/small samples retained. Prior41/42 and earlier failed distributions
remain historical failures; one changed-source success is not repeatability,
remote Google/D1 or actual user/device speed acceptance.

Candidate comparison read-95099e4480a5c1335e10bb08f2b7b8b83e202cb773beb7301f00e181d519d7da;
asset20261013-read-capacity-v7 unchanged. Existing Draft PR271/new-head CI
required. No main merge/deployment/flag/Property/trigger or data change.
Endpoint blank and T0 NOT_STARTED. Real C1/C3, current authority/privacy/
freshness, authenticated0.8/1.5s, approved24-hour observation, rollback/device
and seven-day postlaunch gates remain open before formal completion.


## October16 room occupancy candidate — acceptance still open

Recommended model/speed: GPT-6.1 Sol/high. Local working candidate based on
ac7fc474; shared canonical occupancy avoids discarded full management views.
Complete API JSON/order remains exact across27 original-base oracle responses.
Full npm2249/2249 and validate72/40/comparison179 pass; independent review clean.
Original Worker41/42:500-room p95 FAIL at home54.548/revenue55.615/tenants78.945/
arrears57.852/properties69.828ms; actions43.875 and rooms49.100ms. All100 samples
per entry retained, strict<50ms unchanged. A local room sample passing is not
repeatability, remote performance, authenticated authority or cutover acceptance.

Candidate comparison read-384255326e4c60273c326a1628cde3a81ec6d0c7e914d427b34d173c3e74128e;
asset20261013-read-capacity-v7 unchanged. No commit/push/CI/merge/deploy from this
working increment; flags off, endpoint blank, no T0. Rollback only owned local
source/test changes to ac7fc474; retain evidence.

The approved READ-ACCELERATED-ROLLOUT.md governs observation timing:
technical gates first,24-hour concurrent sync/shadow, rooms first, another
stable24 hours before remaining pages, seven-day postlaunch observation.
Historical72-hour/prelaunch-seven-day descriptions below are retained history;
they do not override that later owner-approved schedule. Technical/safety/
performance/device gates are unchanged and have not passed.


Recommended model/speed: GPT-6.1 Sol/high per approved plan. Independent branch
`codex/c6-read-acceptance-20261012`, stacked on C5 candidate `95d69c9`.
This candidate repairs comparison identity for sequential flag releases and
prepares acceptance. All flags remain off; no deployment, Property, trigger or
operational data change occurred. Actual C6 NOT_STARTED.

## October13 v6 packed projection candidate

Current candidate cache20261013-read-capacity-v6;178-source comparison
read-1f3b9d5806d1129e4d0aa1006dfd69c21b30e201fc0c3774a5093bf233816541.
Production scoped select and capacity fixture share static packed SQL cells;
original fields/rows/order/types/NULL semantics/where/binds/limit/primary session
and authorization are preserved. Actual unit960/960, Worker33/33 and guarded
uncommitted-source full965/965 pass, zero skips; original100/<50ms gates pass.
Fresh private Core/PG identity, SQL fixture cleanup and stopped PID/TCP pass.
New-head CI is pending. Prior published adf39b4/4c9950e failures remain; no cause,
repeatability, provider/Taipei/device or preceding real observation gate is proved.
No actual epoch or flag transition started. Do not reuse any old observation.
Candidate rollback restores preceding4c9950e/v5 source/cache/comparison; accepted
formal serving versions and data are unchanged. Keep Draft until all gates pass.

## Historical October13 v5 local regression candidate

Historical candidate cache `20261013-read-capacity-v5`;178-source comparison
`read-e48be6b9ef38b1ef417d935980d9ec49bebe19fae81b1f2a2e51a35c9eb8fe2f`.
Request-local date-only/full/layout reuse and direct Sheet matrices retain
date coercion, undefined-clock, scalar/date/prototype semantics; no date-value or
positive-access caching. Actual Worker32/32/dry-run and `npm test`963/963 at the
pinned uncommitted working snapshot pass. New500-room correctness coverage uses
real identity/authority policy and primary-D1 scope, with synthetic LINE/Google
authority transports and GAS service adapters. Independent JSON/literals and
authority-only suspension checks pass; this is not remote/device latency.

Original100-sample capacity gates remain p95<50ms; tenants33.885ms/all entries
18.106–33.885ms in this run. Prior local149.703/51.388 and publishedv4 CI29/31
failures are retained; cause and repeatability are UNVERIFIED. New-head CI is
pending, and no actual epoch started. Do not reuse any old72h/shadow window.
Rollback of this candidate restores preceding published bcde36b/v4 source/cache/
comparison; formal accepted serving versions and data remain unchanged. All
gates below still apply before any merge, deployment or on flag.

## Required evidence before the first on flag

1. C1: at least72 actual hours on the final isolated test source, consecutive
   complete daily execution totals below15 minutes and table/dirty/revocation
   reconciliation. Keep manual/API failures and platform execution time visible.
   The old October15 05:39 Taipei estimate belongs to a stopped failed run.
   Corrected-source observation is NOT_STARTED; no current earliest completion
   time exists. Verify a new start and at least72 actual hours after source/timer
   fixes, retaining every failure and the complete platform daily totals.
2. C2/C3/C4: merge/release each independently only after its predecessors pass;
   fresh formal serving/editor export, immutable new GAS version at original URL,
   prior version retained, Worker/D1 binding/migrations/config presence verified,
   Pages public bytes/cache references matched. Current LINE and Email and
   source-only revocation/access-change tests must pass on the released build.
   Secret values never appear in logs, browser captures or public records.
3. C3's owner-approved uncached GAS authority confirmation must be included in
   actual authenticated latency. Measure real Google redirects, provider/D1 and
   full response; local calculation benchmarks do not establish this gate.
4. Before the first page, C5: verified private remote export, immutable
   epoch/comparison identity/start and latest
   seven complete real24-hour windows for all six routes plus both home sections.
   Matched actual read receipts, zero ordinary differences, no unresolved errors,
   missing reports or pending attempts anywhere in the epoch. Approved canonical
   ISO generation clocks within60s remain separately counted and visible.
   Any relevant calculation/auth/comparison-source change or defect needs a new
   epoch. A pure flag/asset-cache publication is handled below.
5. Record the rollback manifest before each step: main/source SHA, GAS original
   deployment/version/previous version and byte fingerprints, Worker version and
   database migration/binding identity, Pages workflow/release/assets and all
   six centralized flags. Keep private IDs/credentials outside public evidence.

The owner's2026-10-12 batch authorization supersedes the plan's per-page approval
requests. Within this scope, passing gates authorize commit/push/PR/merge,
publication and sequential flags. Only new fees, formal data deletion, scope
changes, owner login/payment and physical-device acceptance need owner action.

## One page at a time

| Order | Central flag | Physical acceptance required | Planned request latency target |
| --- | --- | --- | --- |
| 1 | rooms | Mobile LINE and desktop Email | Room list at most800ms |
| 2 | tenants | Mobile LINE and desktop Email | Record actual authenticated timing |
| 3 | properties | Mobile LINE and desktop Email | Record actual authenticated timing |
| 4 | arrears | Mobile LINE and desktop Email | Record actual authenticated timing |
| 5 | revenue | Mobile LINE and desktop Email | Record actual authenticated timing |
| 6 | home | Mobile LINE and desktop Email, home plus actions | Primary at most800ms; all summaries cumulatively at most1500ms |

Before the first on flag, save the verified all-page qualification export and
private acceptance ledger. It includes scope selection, epoch, comparison hash,
seven window boundaries/export cutoff, actual GAS/Worker/binding fingerprints,
Pages source/version and separate latency/device statuses. Public evidence is
sanitized; private scope hashes and raw exports remain outside Git. This ledger
is qualification evidence, not a claim that a page is already physically accepted.

For each page, independently verify current gate/export/build evidence before
changing its one central flag from shadow to on. Keep subsequent pages shadow
and preserve previously accepted on pages. Advance the shared release cache
version when frontend source changes, update all references and validate. Publish
Pages through the approved PR/workflow and read back actual public assets and
six flags. Do not edit flags in DevTools or browser storage as release evidence.

The cache version `CMWEBS_RELEASE_VERSION` advances on each frontend publication.
The generated `CMWEBS_READ_COMPARISON_VERSION` is separate: its SHA256 manifest
covers178 current source files, including all browser HTML/JS/CSS and nested static assets/manifests, all formal
GAS modules/manifest, Worker modules/migrations, schema/clock/path contracts,
source generators/manifests, pinned dependencies and public Wrangler entry/runtime
configuration. Only the central
flag literals, asset-version literal, its cache URL occurrences and generated
comparison literal are normalized. No whole authorization/calculation file is
excluded. Endpoint changes also change the comparison identity. `npm run validate`
recomputes and rejects stale manifests; hand-written IDs cannot replace this check.
Worker observation configuration must equal its bundled comparison manifest.

Run `npm run generate:read-comparison` after included source changes, then repeat
review/tests/readback and start a new real epoch. Before a flags-only publication,
prove that this comparison identity and verified runtime bindings/source stayed
identical. Keep `READ_SHADOW_RELEASE` equal to this stable comparison identity;
do not change it merely because the asset cache tag advanced. Remaining shadow
pages keep reporting to the same epoch while an accepted on page no longer needs
to produce shadow traffic. This fixes the asset/report coupling found in review.

For each subsequent page, a fresh verified export and
`node scripts/evaluate-read-shadow.mjs private-export.json epoch comparison-version page`
check that page's latest seven complete windows; home always includes home/actions.
The default evaluator still requires all routes for the initial C5 qualification.
Errors, differences, missing/pending attempts anywhere in the current epoch remain
blocking. A page-specific candidate cannot establish initial all-page acceptance
or replace the saved qualification ledger, runtime readback or physical gate.

Measure the same authenticated flow before/after, normal navigation and refresh,
with source, release, credential type, actual time and sample count recorded.
Capture request-to-header and request-to-decoded-response separately. Record
page-interactive/render timing separately when available. Home all-summary
latency is measured from primary request start to the last required summary
completion, including sequencing; do not add medians or use the longest isolated
request. Preserve failures/timeouts and excluded samples with reasons. Never
call a small sample p95, load capacity, or fresh-login/OTP acceptance. Record
cold/warm provider claims separately; current GAS authority remains uncached.

Confirm the visible data/amounts/counts/order match the accepted GAS summaries.
Ask the owner for one mobile LINE and desktop operation after this actual page
publication, specifying the released version/time and page. Previous S1 device
confirmation does not cover C6. No automatic comparison substitutes for it.
Check real fallback for unavailable/non2xx/malformed/over-three-second Worker,
and write guard for at least120 seconds using an already authorized harmless
operation. Do not generate new bills/payments/contracts or send LINE just to test.
Record guard evidence separately from ordinary performance samples (guard uses
GAS intentionally). Storage unavailable and concurrent writes must fail closed.

If target, correctness, authorization, fallback, published-build or physical
acceptance fails, set the affected flag off, publish/read back and record failure.
Keep the release incomplete and repair/reobserve as required before advancing.
Do not weaken GAS authority to meet latency or count fallback as Worker success.

## Evidence ledger

Historical October13 v4 source1cab310 retains the initial v3 CI29/31 failure
(500-room tenants55.647ms/small-fixture arrears68.719ms), later local date-only
arrears50.560ms and intermediate decoder tenants94.726ms failures. All use
the unchanged p95<50ms; failed latency loops did not reach later entries.
No unchanged-head rerun or attribution of CI failure is claimed.

Request-local date-only/full Intl parts and shared production/fixture row
decoding reduce allocations without changing SQL/scope, JSON types/null/own
keys, fresh dates or original GAS calculations. Actual unit957/957, Worker31/31
and full962/962 at1cab31076ac82e35bb5c264d80ce0c7cc2c46240 pass with zero
skips. New isolated PG/Core full-suite provenance and successful cleanup are
in `READ-REGRESSION-DEPENDENCIES.md`. Each500-room entry's100-sample local
p95: home27.683/actions25.049/revenue19.718/tenants39.150/rooms30.783/
arrears27.972/properties29.059ms. Fixed access/all-table loader still excludes
C3/provider/scoped-loader/remote/Taipei/device qualification. New-head CI pending.

Historical v4 cache `20261013-read-capacity-v4`;178-source identity
`read-cdf69ac211f844e21222e231fd546bd5845999989e9dc4ed47e79d9644226993`.
Both runtime/dataset source hashes change; no old actual epoch is reused.
Six flags off/URL blank; no formal publication/config/data change. All original
real gates remain. The v3 and earlier entries below are historical.

Historical local draft refresh (2026-10-12): reviewed C3 bulk reader and all C1
stop/C3 signed-diagnostic evidence are inherited through C4/C5. Asset cache
version is `20261012-read-cutover-v2`; the regenerated178-source comparison is
`read-1321de54a6858357c574e3f5c2d74fc2f5d236ece9a6eb04b77d2ae2a0f7ab30`.
Only authorization source and its generated source-manifest hash changed within
the normalized comparison closure. All six flags remain off and endpoint blank.
Actual shadow/cutover remain NOT_STARTED; no old window is reused under this
new identity. C1's failed observation is stopped and needs corrected source plus
a fresh72-hour gate; C3 strict latency is NOT_ACCEPTED despite signed bulk
diagnostic success. This cache/hash update is not a formal publication.

Update `LANDLORD-READ-PERFORMANCE.md`, `EXECUTION_RECORD.md`, current state,
handoff and ADR with sanitized measurements and exact acceptance boundaries.
Keep private raw network data in a restricted temporary directory; ordinary
public evidence contains only route/flow/timing/count/status and source versions.
Never capture Authorization headers, OTP, session/LINE tokens, Property values,
full responses, raw Workspace/actor identifiers or financial/person data.

| Page | Seven-day export | Pages/Worker/GAS readback | Authenticated timings | LINE / desktop | Fallback / write guard | Status |
| --- | --- | --- | --- | --- | --- | --- |
| rooms | Pending | Pending | Not measured | Pending / pending | Pending | NOT_STARTED |
| tenants | Pending | Pending | Not measured | Pending / pending | Pending | NOT_STARTED |
| properties | Pending | Pending | Not measured | Pending / pending | Pending | NOT_STARTED |
| arrears | Pending | Pending | Not measured | Pending / pending | Pending | NOT_STARTED |
| revenue | Pending | Pending | Not measured | Pending / pending | Pending | NOT_STARTED |
| home | Pending | Pending | Not measured | Pending / pending | Pending | NOT_STARTED |

## Rollback

First publish the affected/all flags off and read back Pages; confirm existing
GAS reads and original writes work. If needed restore the previous Pages source
through an independent reviewed PR, the retained Worker version and the original
GAS deployment's previous immutable version. Never change the original GAS URL.
Stop only the approved replica timers if synchronization itself is defective;
preserve other timers/Properties, original Sheets and all financial history.
Retain additive D1 schema, replica/observation metadata, exports and immutable
versions; rollback does not need formal data deletion. Confirm actual readback
and owner-visible operation before declaring rollback complete.

The old905/905,25/25 and missing-Core results are historical. The October13
414eb1f candidate completed959 full tests with zero skips using the isolated
Core/PG environment in `READ-REGRESSION-DEPENDENCIES.md`. The later e28d39b
refresh changed only five documentation files with identical runtime/test source;
the tested head remains414eb1f, not a full-suite claim for later runtime changes.

Historical v3 October13 capacity preparation uses20 properties/500 owned rooms/250 occupied
tenants and leases,250 vacant rooms,500 bills across two months and a foreign
Workspace decoy. Actual local workerd/D1 matches unchanged GAS JSON for all
seven entries, plus independent counts and monetary literals. Original tenants
p95=99.173ms FAIL is retained. Three separate instrumented local samples showed
2252 date-format calls consuming61–87ms. The repair reuses only request-local
Intl formatters, never date values or positive authorization. Mutable dates,
timezone coercion/errors and DST are separately checked.

After repair, the complete Worker suite31/31 and bundle dry-run pass. Each
entry's100-sample local HTTP/D1 p95 remains below the original50ms threshold:
home25.690/actions20.732/revenue21.754/tenants41.669/rooms31.105/
arrears29.892/properties28.305ms. Access is fixture-supplied and the loader reads
all test tables; this is not provider/authority/scoped-loader/remote/Taipei/device
or actual500-room qualification. Linux/Node22 CI still needs the new exact head.
Unit955/955 also passes with zero skips; the pinned prior-head Core/PG full suite
is separate evidence. The earlier e28d39b CI home123.926ms failure and its one
same-head diagnostic rerun PASS remain in PR271's record; the cause was
UNVERIFIED and the date-formatter change does not claim to repair that outlier.

The new candidate cache is `20261013-read-capacity-v3`; regenerated178-source
identity is `read-bed1f4eb91b247567955000d406eccb5fc25520481f6af4ec8e0780102da8399`.
The runtime change requires a fresh real epoch; none has started. All six flags
remain off, endpoint blank, and no formal release/Property/trigger/data change
has occurred. Rollback retains the prior candidate e28d39b and comparison/cache
above. All real deployment/day/device gates remain pending.


2026-10-15 current-stack composition: C5 8801187 merged into C6 96240d3;
packed fields retained alongside C3 staged80-statement batching. Calls-cap
RED1→GREEN3; full1791/1791 with Core/ownedPG cleanup, Worker36/36/bundle PASS;
static review0/validate72/40/cache/comparison178/diff PASS. Local500 fixture
seven100-sample p9511.781–23.237ms<50; not real identity/authority/remote/Taipei/
device acceptance. New comparison read-bce058f378ee92a21559b596ec408c183496a6ec2009def7b508daa333666870.
Exact-head CI pending; actual25/160/native STOP/off/blank and all real gates
remain unaccepted; fresh72h/seven-day NOT_STARTED. Only docs after tests/review.


2026-10-15 runtime date-output reuse: at most128 output strings, scoped to a
single newly created replica runtime/request. Key: JSON tuple of freshly
coerced finite numeric instant, primitive time zone and primitive pattern.
No Date/authorization/cross-request cache. Undefined/current time, dynamic
zone/pattern and invalid date bypass; exceptions/coercions preserved. Lifetime/
TTL is the request; reconstruction invalidates the map, overflow new keys remain
uncached. Mutation/key/scope/bound regressions guard stale formatting risk.
Comparison read-b642a87f97e936c7c5ed055bda2539ff1a072c22601590c1877d44160c3ea3c9.
Previous Linux tenants58.708ms failure remains; local full1792/Worker36 pass
is not Linux/real acceptance. Fresh exact-head CI required, all real gates/off
flags unchanged, no actual observation started. Rollback source to846da4a.


2026-10-15 explicit tenant summary now skips250 discarded history constructions
for the synthetic250-tenant case. Actual-source TDD250→0; entire summary equals
full-response projection, default still returns all histories. Static review0,
full1793/1793 with Core/ownedPG cleanup, Worker36/36/bundle and validate72/40/
static cache/comparison178/diff PASS. Snapshot71b383069f6557f1e0c1782b378b8b88c8cdf6affc529bb8ca79c19ae28aa8f3.
Prior daf25c4 Linux tenants50.894ms FAIL retained; new-head CI required, no
real acceptance/epoch. New comparison read-f78e12a3f964adf8bd38451988ac76840ae0718c1d0bf328bf9e27ae8b7a52d8.
Actual25/160/native STOP/off/blank and all original900s/72h/seven-day/Taipei/
device gates remain; only docs after tests/review. Rollback source to daf25c4.


2026-10-15 room reads now materialize the actual replica dataset once. The
pre-fetch calculator uses empty Sheet services for the unchanged pure gallery
helpers; access validation still precedes public fetch, and the final runtime
is constructed after fetch with the original options/clock ordering. No shared
Workspace data/resource cache is introduced. Actual-route32-row diagnostic:
64→32 matrix row enumerations, exact full GAS JSON preserved. TDD RED duplicate
materialization→GREEN14/14, including absent gallery and two isolated galleries.
Full1794/1794 (zero fail/cancel/skip), ownedPG/Core cleanup verified;
Worker36/36 plus bundle dry-run PASS. Original seven100-sample local500 fixture
p9512.626–20.092ms<50; static review0, validate72/40/cache/comparison178/diff PASS.
Snapshot0531c3ac4ea1c76a006fb2c61f83f66b378536e692f15c3ac1f5c926ad7148c7.
Comparison read-4ee65a7fe1f84baf61a3dbbfe3a5ae37afc02d8ebb217b9cbaa652dd60e8b3b2.
The prior a043240 Linux room52.967ms FAIL remains; fresh exact-head CI is required.
Local fixture timing is not native/authority/remote/Taipei/device acceptance.
Actual25/160/native STOP/off/blank and original900s/72h/seven-day gates remain;
no formal release/Property/trigger/data change or real observation start.
Risk: future gallery helpers must remain independent of Sheet rows. Existing
full-response/public-cover regressions guard that dependency. Rollback source
and matching comparison identity to a043240 before any new observation.
Only documentation changed after the verified source/tests/review.


2026-10-15 fixed collation setup is now lazy and request-local in the Worker.
Actual prior properties CPU/operation diagnostics identified499 native
localeCompare calls per500-room read. Canonical GAS keeps its original fallback;
Worker normalizes operands first and reuses one fixed zh-Hant/numeric/base
collator, with no result/input/auth cache. The GAS oracle omits this adapter.
TDD499→0 native localeCompare calls/one explicit collator per request;784 pairs,
mutable/throwing conversions and exact whole-response parity pass. Relevant12/12;
actual module testLandlordPropertiesInit in synthetic VM passes500 rooms/20
properties (not native Google). Full1796/1796,57.624s,zero fail/cancel/skip with
Core/ownedPG cleanup/listener verified; snapshotf4bbd4807b1927b9b28f4ebef04f2070bf062e5c1d64d03eb308c72dff38fb71.
Worker36/36/bundle PASS; original seven100-sample local500 p9511.061–18.560ms<50.
Static review0,validate72/40/cache/comparison178/diff PASS; only docs afterward.
Comparison read-1d71effca3633cc6f6f5c904d5973abe7df8b05a8aa9f098d21d614f9c936ab3.
Prior568344b Linux properties53.391ms FAIL is retained; exact new-head CI is
required. No native/provider/authority/remote/Taipei/device/actual-day acceptance.
All original900s/day/72h/seven-day gates remain, actual25/160/native STOP,
flags off/endpoint blank, no formal changes. Risk: engine ICU/collation must
continue to match real GAS; do not infer cross-engine equivalence from a Node
oracle alone. Roll back source/adapter/generated comparison together to568344b
before any new real observation.

## 2026-10-15 Strict scalar decode candidate

Prior exact519d416 CI properties51.233ms FAIL is retained. Common unescaped
JSON scalar decoding now avoids per-cell parsing while fallback preserves
strict JSON semantics. Row presence/null, negative zero, dates, own keys,
query/data scope and API responses remain unchanged. Semantic5/5 and one full
modified-source Worker36/36 PASS; original seven100-sample local p95ms:
13.199/10.991/12.642/19.176/16.663/20.794/18.054 (home/actions/revenue/tenants/
rooms/arrears/properties). These are local, not exact CI or real-user acceptance.

Stale comparison identity caused initial validate/full1804/1805 failure. Existing
generator repaired only comparison/source SHA; final1805/1805 PASS57.154s,
Core/ownedPG/listener cleanup verified. Validate72/40/cache/comparison178 PASS;
review no finding. New comparison read-1f03cf1f453135d6be7f647eb8f5dc43b3431ad73e82e1c40f8134fed4373936
requires matching new observations. No old observation was reset or reused.
Rollback undeployed decoder/identity together to519d416 before a later release.

The owner-approved merged PR272 schedule supersedes historical72h/pre-on-seven
days: technical gates then parallel sync/shadow24h, rooms first, stable24h before
later accepted pages, seven-day post-on observation. T0 NOT_STARTED; daily900s,
privacy, freshness, real authenticated latency and physical acceptance remain
unaccepted. Actual25/160 unchanged/unclaimed, flags off/endpoint blank.

## 2026-10-15 Request-owned matrix candidate

Priorf2e90eb CI remains FAIL properties51.147ms>50; rental1800/1800 PASS.
Final HTTP calculation now frames only requested Sheets from its complete
private scoped dataset, once per request; default services retain eager source
snapshots. SQL/rows/fields/response parity and the50ms gate are unchanged.
Related24/24, changed-source Worker36/36 and full1808/1808 PASS56.327s; owned
Core/PG cleanup verified. Full500-room properties response and loaded payments
remain intact even though unused payment rows never become a Sheet matrix.
Independent review no finding; validate72/40/cache/comparison178 PASS.
Local seven p95<50 cannot replace new exact-head CI or real acceptance.

Generated comparison is updated with runtime/routes; use its matching fresh
observation before any enablement. Approved parallel24h T0 NOT_STARTED, flags
off/endpoint blank, actual25/160 unchanged/unclaimed. Native/quota/daily900s/
remote/device remain unaccepted. Rollback this undeployed runtime/routes/identity
increment together tof2e90eb before a later observation.
