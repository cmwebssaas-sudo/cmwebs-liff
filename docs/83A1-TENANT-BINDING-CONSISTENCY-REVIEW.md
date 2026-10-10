# Phase 83A.1 — Tenant Binding Consistency Review

## Boundary

This correction is limited to `release/staging/`. It does not push or deploy
Apps Script or frontend code, does not write any Spreadsheet, does not rebind
TSTG082, and does not change the existing real staging LINE identity.
Production source, configuration, LIFF, Spreadsheet and deployment are outside
the release boundary.

## UID ownership decision matrix

| Condition | Result | Writes | Audit writes |
|---|---|---:|---:|
| UID absent from canonical records | Continue validation | 0 before commit | 0 before commit |
| Exact UID + phone + tenant + canonical projections | `BOUND`, `bound=true`, `idempotent=true` | 0 | 0 |
| UID consistently belongs to another tenant | `UID_BOUND_TO_OTHER_TENANT` | 0 | 0 |
| UID is partial, duplicated or inconsistent | `BINDING_DATA_CONFLICT`, manual repair required | 0 | 0 |
| Target tenant has a different UID | `TARGET_TENANT_BOUND_TO_OTHER_UID` | 0 | 0 |
| Phone resolves to multiple tenant identities | `PHONE_BOUND_TO_OTHER_TENANT` | 0 | 0 |

The route dispatcher passes only LINE UID and phone to
`bindTenantByLineUid_()`. Fixture fault controls require the internal
`__phase83_fixture=true` marker and are never copied from HTTP parameters.

## Ownership and lock order

The normal new-binding path performs identity and ownership validation from a
pre-lock snapshot. Immediately before mutation it acquires ScriptLock, builds a
fresh canonical snapshot, verifies the phone target and normalized
tenant/user/contract/workspace/property/room chain, and repeats UID ownership
evaluation. A changed owner or chain fails closed before the mutation plan is
built.

Read-only exact-idempotent and conflict responses do not acquire the mutation
lock. Every path that acquires it releases it in `finally`, including success,
forward failure, successful rollback and rollback failure.

## Compensating transaction

The staging binder now constructs the entire deterministic mutation plan before
writing. Each item records Sheet, row/range, purpose, exact before-values and
after-values. Every range and dimension is resolved before the first mutation.

Only changed ranges are applied. Successfully applied ranges are tracked in
order. A failure stops forward writes and restores those ranges in reverse
order, flushes once, and reads each range back to verify exact before-values.

- Verified rollback returns `SYSTEM_ERROR`, `bound=false`,
  `rollback_attempted=true`, `rollback_succeeded=true`.
- Failed or unverifiable rollback returns `BINDING_ROLLBACK_FAILED`,
  `rollback_succeeded=false`, `manual_repair_required=true`, and a sanitized
  range label. It never returns success.
- Core success is verified before audit. Audit failure does not report an
  unbound tenant; it returns successful `BOUND` with
  `audit_warning=true` and `BINDING_AUDIT_INCOMPLETE`.
- The deterministic binding audit key prevents duplicate `BOUND` rows for a
  repeated successful request.

## Deterministic fixtures

The local fixture suite covers:

1. failure before the first mutation;
2. failure after each of the five controlled mutation boundaries;
3. injected rollback failure and inconsistent-range reporting;
4. UID owned by another tenant;
5. exact idempotent UID/phone/tenant;
6. target tenant owned by another UID;
7. partial UID state;
8. mismatched workspace identity in a canonical projection;
9. repeated successful request and audit idempotency;
10. ownership change between pre-lock and locked snapshots;
11. audit failure after verified commit;
12. frontend single-flight and status-only timeout reconciliation.

Fixture-only controls without the internal marker are ignored. No fixture
contains a real LINE UID, production phone, Script ID, Spreadsheet ID, token or
credential.

## Validation result

| Gate | Result |
|---|---|
| Staging Apps Script syntax | PASS |
| Staging tenant-bind inline JavaScript syntax | PASS |
| Phase 83A.1 fixtures | PASS |
| Mutation boundaries | 5/5 |
| Ownership/conflict fixtures | 7 |
| Duplicate `BOUND` logs | 0 |
| Normal-success `setValue()` | 0 |
| Normal-success flush | 1 |
| `npm run validate` | PASS |
| `git diff --check` | PASS |
| Production LIFF references in complete staging Apps Script tree | Resolved by Phase 83A.2 |

The controlled new-binding fixture uses two snapshots for TOCTOU safety: 40
logical read requests reuse 10 physical populated-Sheet reads. This is an
intentional correctness tradeoff versus the prior single-snapshot count of 5.
Real optimized staging latency remains untested.

## Release review decision

The three Phase 83A blockers are addressed in staging source and fixtures:

- unsafe cross-Sheet partial success is replaced with verified compensating
  rollback;
- UID ownership conflicts fail closed and exact idempotency uses canonical
  `BOUND`;
- deterministic fault injection covers every mutation boundary.

The three Phase 83A.1 consistency blockers are resolved. Phase 83A.2 removed
the four pre-existing production LIFF references from these staging modules:

- `V2_ANNOUNCEMENT_MANAGEMENT.js`
- `V2_BILL_NOTIFICATIONS.js`
- `V2_TENANT_CHECKIN_MANAGEMENT.js`
- `V2_TENANT_LEASE_ONBOARDING.js`

They now use the shared, fail-closed staging environment resolver. See
`83A2-STAGING-LIFF-ENVIRONMENT-ISOLATION.md` for the updated release decision.

## Remaining risk and rollback

The remaining operational risk is Apps Script/Sheets latency from the
mandatory locked re-read. It must be measured with a disposable staging
identity after a separately approved staging deployment. Rollback is file-level
restoration of the previous staging artifact; do not clear or replace TSTG082
or its LINE UID.
