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
affected28/28 and Worker13/13 checks passed, p95 4.760–6.557ms. PR/CI pending.
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
