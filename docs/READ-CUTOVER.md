# C6 sequential read cutover runbook — preparation only

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
