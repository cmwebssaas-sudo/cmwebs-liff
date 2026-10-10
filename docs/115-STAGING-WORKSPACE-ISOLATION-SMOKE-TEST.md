# Phase 115 — Staging Disposable Workspace Isolation Smoke Test

## Outcome

**BLOCKED — not passed.** The disposable-fixture setup and the two real staging tenant-binding operations completed, but the single, monolithic matrix runner exceeded the Apps Script six-minute execution limit before it could execute and report the authorization, substitution-attack, and notification-isolation assertions. No unexecuted assertion is recorded as PASS.

Production was not accessed, changed, deployed, or used as a fallback.

## Scope and isolation boundary

- Environment: confirmed staging Apps Script project and staging Spreadsheet only.
- Fixture marker: `PHASE115_DISPOSABLE`.
- No production Apps Script project, Spreadsheet, Script Property, LIFF configuration, deployment, or runtime source was used.
- The test helper does not expose an HTTP route, enqueue a notification, call a LINE transport, or send a LINE message.
- A staging-only source push was used to make the test helper available remotely. No Apps Script deployment was created or updated, and no Git commit or Git push occurred.

## Fixture design

The helper creates two independent disposable chains through the formal staging business flows:

| Workspace | Landlord | Tenant | Property | Room |
| --- | --- | --- | --- | --- |
| A | `PHASE115 Landlord A` | `PHASE115 Tenant A` | `PHASE115 Property A` | `PHASE115-A` |
| B | `PHASE115 Landlord B` | `PHASE115 Tenant B` | `PHASE115 Property B` | `PHASE115-B` |

Generated canonical IDs were intentionally not retained in this report: the matrix invocation exceeded its execution limit before it returned its fixture payload, and the disposable records were then removed. No real LINE UID is recorded in this document.

## Initial blocker and staging-only correction

The first setup attempt failed during tenant binding with `BINDING_DATA_CONFLICT`.

Cause: the onboarding flow stores the relevant contract key in `current_contract_id` for `V2_tenant_home_view` and `V2_landlord_tenant_list_view`, while the binding ownership checker considered only `contract_id`. It therefore saw a valid newly-created tenant relationship as missing/conflicting.

Staging-only compatibility correction:

- `release/staging/apps-script/V2_TENANT_BINDING_PHONE.js`
  - accepts `current_contract_id` as the canonical alternative for the two materialized views;
  - keeps `contract_id` compatibility;
  - does not change routes, schema, production source, or the authorization policy.

The failed first attempt cleaned 26 marked staging rows.

## Actual setup evidence

After the staging-only correction, both formal tenant bindings completed before the runner reached the matrix stage.

| Binding | Result | Total duration | Full-sheet reads before → after | Saved |
| --- | --- | ---: | ---: | ---: |
| Workspace A tenant | Completed | 12,981 ms | 46 → 16 | 30 |
| Workspace B tenant | Completed | 13,299 ms | 46 → 16 | 30 |

Observed write/guard metrics remained inside the existing formal binding flow: lock wait, schema preparation, uniqueness check, mutation writes, flush, and audit-log write all completed. This confirms the test fixtures were created through the normal staging workflow rather than by directly editing staging Sheets.

## Isolation test matrix

| Area | Expected result | Actual result | Status |
| --- | --- | --- | --- |
| Landlord A reads own workspace/property/tenant | Allow | Not reached | BLOCKED |
| Landlord A reads Workspace B/property B/tenant B | Deny, fail closed | Not reached | BLOCKED |
| Landlord B symmetric checks | Allow own; deny A | Not reached | BLOCKED |
| Tenant A own bill/contract/message reads | Allow | Not reached | BLOCKED |
| Tenant A reads Tenant B data | Deny, fail closed | Not reached | BLOCKED |
| Tenant A invokes landlord route | Deny, fail closed | Not reached | BLOCKED |
| `workspace_id` substitution | Deny, fail closed | Not reached | BLOCKED |
| `tenant_id` substitution | Deny, fail closed | Not reached | BLOCKED |
| `property_id` substitution | Deny, fail closed | Not reached | BLOCKED |
| `room_id` substitution | Deny, fail closed | Not reached | BLOCKED |
| Workspace A `bill_created` receiver resolution | A recipient only | Not reached | BLOCKED |
| Workspace A `tenant_repair` receiver resolution | A recipient only | Not reached | BLOCKED |
| Workspace A `contract_expiring` receiver resolution | A recipient only | Not reached | BLOCKED |

## Runtime blocker

The runner combined two landlord registrations, two landlord onboarding completions, two tenant lease/binding flows, the complete isolation matrix, notification-recipient resolution, and cleanup in one Apps Script execution. The remote execution terminated with `Exceeded maximum execution time` before a result payload was emitted.

This is a **test-tool orchestration limitation**, not evidence that the isolation controls passed or failed. The correct next step is a checkpointed staging-only runner:

1. setup and persist only opaque fixture run identifiers;
2. run landlord isolation assertions;
3. run tenant and substitution assertions;
4. run notification-recipient assertions without enqueueing jobs or using transport;
5. run teardown and verify zero marked rows.

Each entrypoint must complete well inside the Apps Script execution limit and report only masked/opaque fixture metadata.

## Cleanup verification

| Cleanup point | Result |
| --- | --- |
| Cleanup after first binding conflict | 26 marked rows removed |
| Explicit cleanup after timed-out matrix run | 16 marked rows removed |
| Final no-op cleanup verification | `total_deleted_rows: 0` |

The final cleanup response was `PHASE115_FIXTURES_CLEANED` with an empty per-sheet deletion map. This verifies that no rows carrying the Phase 115 marker remained after the test run.

## Files changed in Phase 115

- `release/staging/apps-script/STAGING_WORKSPACE_ISOLATION_FIXTURES.js` — staging-only disposable setup, assertion, and cleanup helper.
- `release/staging/apps-script/V2_TENANT_BINDING_PHONE.js` — staging-only view contract-key compatibility correction described above.
- `docs/115-STAGING-WORKSPACE-ISOLATION-SMOKE-TEST.md` — this factual test record.

## Validation

| Check | Result |
| --- | --- |
| Repository `npm run validate` | PASS — 68 unique routes; handler coverage 68/68 |
| Staging validator | PASS — 87 unique routes; handler coverage 87/87 |
| `git diff --check` | PASS |

## Decision

**Production readiness impact: NO-GO for Phase 115 isolation evidence.** Existing static RBAC and staging validation remain valid, but the requested disposable cross-workspace proof must be completed with checkpointed test entrypoints before it can be cited as runtime evidence.
