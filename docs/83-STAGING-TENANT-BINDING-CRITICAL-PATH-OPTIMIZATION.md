# Phase 83 — Staging Tenant Binding Critical-Path Optimization

## Scope and baseline

This phase is limited to the isolated staging release tree and the staging
Spreadsheet `CMWebs V2 STAGING Data 2026-07-21`. Production source,
Spreadsheet, Apps Script project, deployment, LIFF and hosting were not
changed.

Phase 82C measured the first real staging binding at 25.362 seconds while the
frontend JSONP timeout was 25.000 seconds. The backend completed about 0.362
seconds after the browser had already reported a timeout. The existing real
staging identity remains bound to `TSTG082`; it was not rebound, cleared or
replaced in this phase.

## Changes

### Backend critical path

`release/staging/apps-script/V2_TENANT_BINDING_PHONE.js` now:

- creates a pre-lock identity snapshot, then reacquires a fresh canonical
  snapshot after taking ScriptLock to close the ownership TOCTOU window;
- full-reads each populated binding source Sheet at most once per snapshot;
- reuses the same rows and header maps for status, phone, uniqueness,
  contract and mutation planning;
- validates required staging schema before the first mutation and returns
  `TENANT_BINDING_SCHEMA_INVALID` when structure is unavailable;
- performs UID uniqueness checks before mutation;
- replaces cell-level `setValue()` calls with grouped `setValues()` writes;
- uses exactly one `SpreadsheetApp.flush()` on a successful new binding;
- returns canonical `BOUND` for an exact already-bound identity, with no
  mutation, duplicate log or flush;
- emits staging-only timing/read/write metrics without logging full UID or
  phone values.

The existing API response shape and route names are unchanged. Unsafe
`ALREADY_BOUND` compatibility was intentionally removed: exact identity
matches return `BOUND`, while UID/tenant ownership conflicts fail closed.
`tenant_binding_status` remains the canonical source of the `BOUND` state used
by timeout reconciliation.

### Audit boundary

Audit is **non-blocking after successfully persisted binding data**.

The transaction boundary is:

1. validate schema and ownership before taking the lock;
2. acquire ScriptLock and repeat ownership validation from a fresh snapshot;
3. build and validate all before/after mutation ranges;
4. apply identity/view patches and verify committed values;
5. on failure, restore applied ranges in reverse order, flush and verify exact
   before-values;
6. after a confirmed core commit, write binding and LIFF access audits.

An audit failure cannot roll back a completed multi-Sheet binding. The response
remains successful `BOUND` and includes `audit_warning=true` plus the sanitized
`BINDING_AUDIT_INCOMPLETE` warning code. Both audit writers require precreated,
canonical headers and no longer create/repair their log Sheet during a normal
runtime request.

### Staging schema bootstrap

`release/staging/apps-script/STAGING_TENANT_BINDING_SETUP.js` contains the
manual staging-only bootstrap function `prepareStagingTenantBindingSchema_()`.
It is not referenced by any Web App route and must never be included in a
production release.

The live staging Spreadsheet header-only preparation completed as follows:

- `V2_tenant_bill_view`: added `tenant_line_user_id`;
- `V2_bills`: added `tenant_line_user_id`;
- `V2_payment_reports`: added `tenant_line_user_id`;
- `V2_tenant_messages`: added `tenant_line_user_id`;
- `V2_tenant_binding_logs`: canonical 10-column order verified;
- `V2_liff_access_logs`: corrected to the canonical 12-column logger order.

Only header cells were changed. Existing TSTG082 identity rows and audit data
were not modified.

### Frontend timeout reconciliation

`release/staging/frontend/tenant-bind.html` now:

- marks timeout and script-load failures as ambiguous transport failures;
- stops the mutation wait state and performs one
  `tenant_binding_status` reconciliation request;
- treats `BOUND` plus `account_active=true` as success and navigates to the
  tenant home page;
- treats `UNBOUND` as explicitly retryable;
- never automatically resends `tenant_bind_submit`;
- protects submit/reconciliation with one promise and a generation guard;
- records `binding_status_reconciliation_ms` without identity data.

The UI design and the 25-second timeout value were preserved.

## Observability

The staging binding Logger record contains:

- `total_binding_duration_ms`
- `lock_wait_ms`
- `schema_prepare_ms` (schema validation only; no runtime preparation)
- `lookup_snapshot_ms`
- `uniqueness_check_ms`
- `mutation_write_ms`
- `spreadsheet_flush_ms`
- `audit_log_write_ms`
- `full_sheet_reads_before`
- `full_sheet_reads_after`
- `full_sheet_reads_saved`
- `batch_write_count`
- `cell_level_write_count`
- `binding_status_reconciliation_ms`

## Verification results

### Local controlled fixture

| Check | Result |
|---|---:|
| New unbound binding | PASS |
| Already-bound matching UID / idempotency | PASS |
| UID owned by another tenant | PASS |
| Target tenant bound to another UID | PASS |
| Partial/inconsistent UID ownership | PASS |
| Concurrent ownership change revalidation | PASS |
| Failure before first mutation | PASS |
| Failure after every mutation boundary | PASS (5/5) |
| Rollback verification | PASS |
| Rollback failure fail-closed behavior | PASS |
| Audit failure after committed binding | PASS |
| Duplicate `BOUND` audit logs | 0 |
| Phone not found | PASS |
| Inactive account | PASS |
| Missing schema fail-closed | PASS |
| Timeout reconciliation: eventual BOUND | PASS |
| Timeout reconciliation: remains UNBOUND | PASS |
| Repeated-click single-flight | PASS |
| Mutation retry during reconciliation | 0 |

The corrected Phase 83A.1 success fixture measured:

- logical full-sheet read demand before reuse: **40**;
- physical full-sheet reads across the pre-lock and locked snapshots: **10**;
- reads saved by per-snapshot reuse: **30**;
- original equivalent mutation model: **19 cell-level writes plus 2 audit
  appends**;
- optimized path: **5 mutation batch ranges plus 2 audit batch ranges**;
- cell-level `setValue()` calls: **0**;
- flush count: **1**.

Phase 82C's live baseline was approximately 11 full-sheet reads. The extra
locked snapshot is an intentional correctness cost; it replaces an unsafe
single stale snapshot during the ownership TOCTOU window. The fixture counter
is exact for the controlled fixture and is not presented as a new live staging
latency measurement.

### Existing staging identity

- `TSTG082`, its user, active contract, home projection and landlord link are
  still mutually consistent;
- the masked LINE identity remains unchanged and unique;
- `V2_tenant_binding_logs` still contains exactly one `BOUND` row for
  TSTG082;
- no second binding request was sent;
- prior Phase 82C read results remain: home PASS, bills `[]` PASS, contract
  active PASS, message BLOCKED by the known landlord-recipient fixture gap.

### Static validation

- staging Apps Script syntax: PASS;
- staging frontend inline JavaScript syntax: PASS;
- Phase 83 fixture tests: PASS;
- `npm run validate`: PASS (68 unique routes, handler coverage 68/68,
  blocking credentials 0);
- `git diff --check`: PASS.

## Final status

| Item | Result |
|---|---|
| Dynamic schema work removed from normal binding path | YES |
| Exact fixture read reuse | 40 logical → 10 physical across two snapshots |
| Exact fixture write reduction | 19 cell writes + 2 appends → 7 batch ranges |
| Flush count | 1 |
| Idempotency tests | PASS |
| Timeout reconciliation | PASS |
| Existing TSTG082 unchanged | YES |
| Production untouched | YES |
| Real staging latency after optimization | NOT TESTED |
| Ready for disposable real staging binding test | NO — LIFF coupling is resolved in Phase 83A.2, but broader staging URL isolation remains under review |

## Remaining risks and next action

- Google Sheets and Apps Script cold-start latency still require a real
  disposable staging measurement.
- Google Sheets still does not provide a native cross-Sheet transaction. The
  staging path therefore uses deterministic compensating rollback and exact
  before-value verification; an unverified rollback fails closed with
  `BINDING_ROLLBACK_FAILED` and requires manual repair.
- Audit is deliberately non-blocking after persistence. Logger warnings must be
  monitored during the disposable test.
- The staging release has not been pushed or deployed in this phase. A reviewer
  must use the Phase 83A.2 review, confirm the staging Script ID, required
  Script Properties, release file list and production exclusion boundary.

Rollback before staging deployment is file-level restoration of the previous
staging artifact and header-only restoration from the staging Spreadsheet's
version history. Do not roll back by clearing or replacing the existing
TSTG082 LINE binding.
