# Phase 98 — Production Readiness Execution

Date: 2026-07-23  
Decision: **NO-GO — execution evidence incomplete**

This is a read-only final verification package. No Production Apps Script,
Spreadsheet, Script Property, LIFF configuration, LINE channel, deployment, or
endpoint was changed.

## 1. Production Environment Matrix

Values are intentionally represented only as presence, ownership, and mapping
status. No token, UID, Script ID, deployment ID, or URL secret is recorded.

| Component | Staging evidence | Production evidence | Gate | Required action |
| --- | --- | --- | --- | --- |
| LIFF application | Tenant staging LIFF login and token flow passed; landlord post-onboarding matrix is incomplete. | Canonical Production LIFF mapping not re-confirmed in this phase. | **BLOCKER** | Human-verify masked LIFF ID, channel, endpoint, and frontend origin against Production configuration. Complete landlord smoke tests in staging first. |
| LINE Login | Staging channel configuration is present; valid-token flow has staging evidence. | Property presence and audience/channel mapping not evidenced. | **BLOCKER** | Confirm Production Login channel ID, expected audience, callback, and token-verifier configuration without exposing values. |
| Messaging API | Staging token property is present; end-to-end worker delivery and rotation evidence remain incomplete. | Token owner, scope, rotation date, and property presence not evidenced. | **BLOCKER** | Perform a controlled staging delivery and document Production token ownership/rotation procedure. Never copy a staging token. |
| Token verification | Staging server-side verification path and fail-closed behavior are covered by source tests. | Production property and provider configuration not verified. | **BLOCKER** | Run a Production configuration presence audit and retain only redacted results. |
| Feature flags | Staging schema, queue, repair, lease, billing, settlement, and security flags are explicitly configured in the staging boundary. | Production flag values and owner approvals not recorded. | **BLOCKER** | Establish a Production flag matrix with all new features disabled by default; enable one feature only after its gate passes. |
| Trigger inventory | Source defines notification, contract, billing, and stale-recovery handlers; remote trigger inventory is incomplete. | Existing Production triggers not re-inventoried for this phase. | **BLOCKER** | Manually export a masked trigger inventory and prove no test/repair/migration function is scheduled. |
| Environment marker | Staging marker is configured and runtime rejects missing/mismatched environment. | Production marker and property separation not evidenced. | **BLOCKER** | Verify Production marker and independent Spreadsheet binding. |

## 2. Schema Migration Dry Run

### Read-only diff result

- Canonical Production backend: 34 JavaScript modules.
- Staging backend: 48 JavaScript modules.
- Staging-only delta: 18 modules, including notification, security, lifecycle,
  repair, move-out, settlement, and staging bootstrap modules.
- Staging validator: **PASS** (87 routes, 87/87 handlers).
- Production validator: **PASS** (68 routes, 68/68 handlers).
- Direct staging-to-Production copy: **NOT ALLOWED**.

### Migration classification

| Group | Items | Dry-run result | Production action |
| --- | --- | --- | --- |
| Required prerequisite, conditional | Environment/identity security, RBAC, notification queue and failure queue schemas | **BLOCKER** until Production property, schema, and trigger ownership is approved | Prepare additive header/sheet migration only; keep feature flags disabled until post-checks pass. |
| Optional | Contract lifecycle, billing/payment lifecycle, repair workflow | **BLOCKER** for this release because they expand current V2 scope | Exclude unless separately approved by product and data owners. |
| Optional financial | Move-out, deposit settlement, settlement ledger | **BLOCKER** pending financial migration approval and rollback rehearsal | Exclude by default; if approved, migrate ledger before any dependent route. |
| Incompatible direct copy | `STAGING_*` bootstrap/registration modules, test fixtures, local configs, test UID allowlists | **BLOCKER** | Never include in Production artifact. |

### Production migration order

1. **Freeze and backup:** approved SHA, current deployment metadata, Sheet
   version/backup, and rollback owner.
2. **Schema:** read-only header/duplicate/workspace preflight, then only
   approved additive Sheets/headers; validate each immediately.
3. **Apps Script backend:** push only the isolated, SHA-verified artifact with
   tests, diagnostics, migrations, and staging bootstrap excluded.
4. **Deployment:** create one immutable version and update the existing Web App
   deployment without changing its URL.
5. **Trigger:** inventory first; activate only approved workers after backend
   smoke checks; confirm no forbidden handler is scheduled.
6. **Environment Properties:** verify presence and ownership, then enable
   features one at a time. Do not put values in Git or reports.
7. **Validation:** endpoint, LIFF identity, resolver, RBAC isolation, queue
   recovery, and read-only business-flow smoke tests.

The sequence is a dry-run plan only; no step above was executed against
Production.

### Backup plan

- Preserve the current Production Web App immutable version 74 and rollback
  target 73.
- Capture a versioned backup/checkpoint for every affected Sheet before an
  approved additive migration.
- Record before headers, row counts, duplicate-key counts, and workspace-key
  counts without exporting sensitive values.
- Keep the final artifact SHA manifest and clasp binding evidence together with
  the release approval.

### Rollback procedure

1. Stop feature activation and scheduled workers.
2. Repoint the existing Production Web App deployment to immutable version 73;
   preserve the existing URL.
3. Run read-only endpoint and identity smoke checks.
4. Disable dependent flags and leave new additive columns/Sheets in place if
   deleting them is not proven safe.
5. Restore migration-written rows only from the migration log and reviewed
   backup; re-run schema, duplicate, workspace, and isolation checks.
6. Record incident evidence and obtain human approval before resuming.

## 3. Notification Worker Readiness Test

| Check | Staging result | Gate | Required action |
| --- | --- | --- | --- |
| Trigger inventory | Handler/source inventory exists; remote trigger inventory not proven through the available executable path. | **BLOCKER** | Manually inspect staging installable triggers and record handler, schedule, owner, and active status. |
| Queue creation and dedupe | Phase 88–90 local tests pass. | PASS (source/fixture) | Prove one disposable remote staging event creates one deduplicated job. |
| Retry schedule | Source tests cover retry states and bounded attempts. | PASS (source/fixture) | Record remote `pending → processing → retrying/sent` evidence. |
| Stale processing recovery | Recovery logic and local tests pass. | **BLOCKER** | Create a disposable stale processing job, run the real worker, and verify retry or terminal `failed` without duplicate LINE delivery. |
| Failure logging | Sanitized failure queue design excludes tokens and UID values. | PASS (design) | Verify provider response/error redaction in remote logs. |
| Worker lock/overlap | Code has bounded worker/recovery behavior. | **BLOCKER** | Verify no duplicate worker trigger and no nested conflicting ScriptLock in the active deployment. |

## 4. Landlord / Tenant Workspace Isolation Test Plan

Use two disposable staging Workspaces, one landlord membership per Workspace,
and one tenant contract per Workspace. Do not use Production data or the
existing protected staging fixtures.

| Case | Requester | Target | Expected |
| --- | --- | --- | --- |
| T-01 | Tenant A | Own home/bills/contract/message | Allow; identity chain resolves only Workspace A. |
| T-02 | Tenant A | Tenant B records | Deny; no payload or row leakage. |
| T-03 | Landlord A | Own contracts/bills/tenant messages | Allow only for Workspace A. |
| T-04 | Landlord A | Workspace B with caller-supplied ID | Deny with workspace authorization error. |
| T-05 | Tenant A | Landlord routes | Deny closed; no landlord projection returned. |
| T-06 | Landlord A | Tenant-only mutation route | Deny closed. |
| T-07 | Viewer/maintenance/manager/finance | Unauthorized landlord operation | Deny according to RBAC matrix. |
| T-08 | Repeated request | Same route and idempotency key | No duplicate write, queue job, payment, or notification. |
| T-09 | Missing membership | Any Workspace route | Deny; never fall back to first row. |
| T-10 | Stale/invalid LINE token | Any authenticated route | Deny before resolving tenant or landlord data. |

Evidence must include only masked requester labels, Workspace labels, route,
status/code, timing, and redacted logs. No full UID, token, credential, or
production data may be captured.

## 5. GO / NO-GO Conditions

### Required for GO

- [ ] All Phase 98 environment matrix rows are verified for both staging and
      Production with masked evidence.
- [ ] Approved additive schema subset, backup, migration validation, and
      rollback owner are recorded.
- [ ] Final isolated release artifact has a complete SHA-256 manifest.
- [ ] Staging notification trigger and stale-recovery test pass remotely.
- [ ] Landlord and tenant two-Workspace isolation matrix passes remotely.
- [ ] Post-onboarding landlord LIFF home/contracts/billing smoke tests pass.
- [ ] Production rollback version 73 is confirmed available and rehearsal is
      accepted.
- [ ] Named human owner approves Production release.

### Current NO-GO blockers

1. Production environment, LIFF, LINE token, and trigger evidence is incomplete.
2. Remote notification worker/stale recovery is not proven.
3. Full two-Workspace landlord/tenant isolation is not proven remotely.
4. Schema migration scope and optional lifecycle modules are not approved for
   Production.
5. A clean final Production artifact and SHA manifest are still required.

## Final Status

**NO-GO.** Phase 98 is a completed execution package and checklist, not a
Production deployment authorization. Production remains untouched.
