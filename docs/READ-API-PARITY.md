# C2 read API parity candidate

Recommended model/speed: `GPT-6.1 Sol` / high. The plan defaults to terra/medium;
rich-contract privacy, missing dependencies and source-order/calendar parity
justify escalation. Branch `codex/c2-read-api-parity-20261012`, base C1 `8f1191a`.

Status: **local candidate; no production publication or operational Worker
read access**. C1's actual three-day acceptance is running. C3 must supply
verified identity, current Workspace/membership policy and a scoped D1 loader.
The production dispatcher returns503 `READ_AUTH_NOT_READY` on all six routes;
neither fixture bindings nor caller-supplied identity can enable them.

## Shared source and approved summary

`npm run generate:read-calculator` selects the six existing GAS readers'
dependency closure with Acorn:219 functions from13 canonical source files.
Plain generated JavaScript uses no eval/runtime VM. The manifest records source
SHA-256; duplicate symbols and mutable dependencies fail generation. Adapters
replace Sheet IO, schema mutation, logging and identity resolution while retaining
the existing rental calculations. Fresh Sheet matrices preserve readers that
shift headers. Scalar JSON preserves types, null and missing fields.

`replica_source_row` captures actual Sheet order including blank gaps, enters
row integrity, orders D1 results before the stable key and stays out of business
responses. `replica_date_fields` preserves the Date-vs-text distinction through
scalar JSON storage; genuine Date cells are rehydrated before GAS calculations.
The rich fixture includes Taipei midnight on October1, whose UTC instant is
September30. A red regression reproduced10300→20600 in the home total before
the type-preserving fix. The modern Asia/Taipei Date adapter preserves GAS calendar behavior;
the oracle uses independent native Node Date in Asia/Taipei.

The owner approved [READ-PARITY-DECISION.md](READ-PARITY-DECISION.md).
Only home action initialization and tenant list request `read_view=summary`.
Home retains existing summaries and item IDs/statuses; tenant list omits contract
history. Monetary values, counts, sorting and renderer functions remain equal.
Default/detail APIs keep full GAS results. LINE GET and Email POST forward the
view; snapshot keys remain unchanged. Frontend candidate `20261012-read-summary-v1`.

| Worker GET route | Existing calculator/options |
| --- | --- |
| `/v1/home` | Home bootstrap: `section=home`; actions requires `section=actions&read_view=summary` |
| `/v1/revenue` | Revenue: `range`, `property_id`, `from_month`, `to_month`, `as_of` |
| `/v1/tenants` | Native tenants: requires `read_view=summary` |
| `/v1/rooms` | Room center: `include_archived=0\|1` |
| `/v1/arrears` | Native arrears: no query scope/identity fields |
| `/v1/properties` | Properties: `include_archived=0\|1` |

Responses are non-cacheable. Duplicate/unknown fields, claimed identity/Workspace,
full/detail views and unsupported methods fail before IO. Infrastructure errors
return sanitized JSON. Public room photos reuse the existing z3House target
allowlist/parser, refuse redirects, limit response size/time and cache only
approved public image URLs (maximum256 entries; six hours for photos, one minute
for missing/unavailable pages).

## Projection and formal read-only verification

Additive0002 preserves C1's sixteen tables and adds source-order/context fields
plus existing `V2_workspace_settings`, `V2_property_owners`, `V2_payment_accounts`
and `V2_landlord_tenant_list_view`. Migration0001 remains byte-identical.
Full bank values become only a masked suffix of at most five digits; Worker
rejects unmasked values even in signed payloads. Only that suffix can be
rehydrated for the existing formatter. Documents, files, terms, signatures and
credentials stay outside the allowlist. Source writes invalidate tenant view.

Formal metadata/header verification on2026-10-12 found all four dependencies.
Tenant view has36 headers/100 allocated rows. Bounded key/Workspace columns had
five nonempty tenant keys, zero duplicates, zero missing Workspaces and zero
error keys; only aggregates are recorded. Both optional V3 room-listing bridge
tables are absent. Each room snapshot derives `replica_room_bridge_supported`
from actual source schema presence, ignoring row claims. If either optional
bridge exists, even empty, or the capability is missing, Worker rooms returns503
`READ_DEPENDENCY_UNSUPPORTED` so C4 falls back to GAS, preserving binding and
independent-site gallery behavior. The bridge itself is not replicated. Review
its projection dependencies before enabling a future Worker bridge path.
New property writes also invalidate their existing owner rows. No formal data,
Schema, Property or trigger changed.

## Acceptance evidence

Rich synthetic data covers multiple properties/Workspaces, vacancy, partial and
completed payments, overdue/cancelled bills, cross-month data, inactive/archived
rooms, renewal history, bank masking and prohibited contract fields. Source key
order is deliberately reversed. Original GAS and generated Worker use the same
data; the latter passes the actual whitelist projector, migrations and local D1
JSON storage. HTTP results match every field on six routes/both home sections.
Frontend counter tests execute actual home consumer functions. Defaults keep
detail, while D1 and summaries omit prohibited synthetic values.

Latest complete local Worker run:100 HTTP/D1 samples per entry, all p95<50ms:
home6.371ms, actions5.578ms, revenue4.833ms, tenants6.305ms, rooms5.302ms,
arrears5.360ms, properties5.293ms. Response consumption is included. These are
synthetic local measurements, not remote/phone acceptance.

Affected GAS/calendar/route28/28, unit863/863, Worker13/13, validate and diff-check
pass. Full suite:863 pass, one existing missing `PLATFORM_CORE_TEST_WORKTREE`
integration failure, four conditional skips; external Core/PG acceptance is not
claimed. Independent re-review passed after all three reported fixes; its
affected28/28 and Worker13/13 checks passed, p95 4.760–6.557ms.
Draft PR267 source `fa3300e`; CI38178464204 rental/read-worker both passed.
Remote publication/readback is
NOT_STARTED; C1's real-time gate remains a prerequisite.

## Publication sequence and rollback

1. Complete C1's actual three-day correctness and full daily-runtime gate.
   Verify live serving/editor/Pages/Cloudflare identities; export fresh rollback
   source/version/database, rather than infer deployment from a candidate.
2. Apply additive0002 to the intended replica, publish reviewed schema/projector
   with the existing formal Web App URL, and read back immutable version/editor
   source byte-for-byte. Check other deployments retain their versions.
3. Full reconcile all twenty tables; verify counts, order, hashes, masking and
   sync health. Keep reads closed until C3 acceptance. Do not modify the ongoing
   C1 test midway through its observation window.
4. Publish summary frontend callers after compatible GAS. Read back Pages and
   authenticated LINE/Email results. Phone acceptance needs the owner. C4 flags
   remain off until their gate.

Rollback frontend to the fresh prior export/default GAS calls. Retarget the
existing Web App to the captured prior immutable version and restore editor
source. Stop only intended sync timers if needed. Retain additive replica tables,
database export, migrations and Worker version; do not delete formal/source data.


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


## October15 request-local fixed collation

The optional Worker-only `runtimePropertyRoomCompareText_` service lazily reuses
one `Intl.Collator('zh-Hant',{numeric:true,sensitivity:'base'}).compare` per
runtime/request. Canonical `propertyRoomCompareText_` still normalizes operands
with its existing helper, left to right. Without that adapter, native Apps Script
retains the entire prior localeCompare path. The generated235-function/15-source
closure injects only this stateless built-in service; no rental ordering rules
are duplicated. [ECMA-402 localeCompare](https://tc39.es/ecma402/#sup-string.prototype.localecompare)
and [Collator compare](https://tc39.es/ecma402/#sec-get-intl.collator.prototype.compare)
use the same comparison algorithm; actual engine/version parity remains a gate.
Only the fixed sorter is retained until the request ends; no operands, comparison
results, authorization or cross-request cache. Reconstructing the runtime
invalidates it; no shared TTL, keys or source-data invalidation are needed.
The native GAS VM oracle explicitly removes this Worker-only adapter before
loading canonical source. Regression covers the entire500-room properties
response, lazy/per-request construction,784 normalization/Unicode/numeric/tie
pairs plus literal ordering, live coercions/order and exceptions. RED499 native
localeCompare calls vs0 then GREEN2/2; related12/12. Native Google execution and
real authenticated latency/72h/seven-day/device acceptance are not inferred.
