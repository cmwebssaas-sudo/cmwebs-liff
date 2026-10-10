# Phase 101 — Production Shadow Deployment Preparation

Date: 2026-07-23  
Decision: **NO-GO — Release Candidate is a planning artifact only**

## Scope

This phase defines a Production Release Candidate (RC) and a shadow-validation
process without directing user traffic, creating a new version, pushing source,
changing a deployment, modifying Production Sheets, or writing Production
database records.

The RC must remain an isolated artifact. It is not the current repository
working tree, which contains unrelated and unbounded changes.

## 1. Release Candidate Definition

### Frontend

| Field | RC value | Gate |
| --- | --- | --- |
| Source artifact | `TBD` — isolated static frontend artifact | Must exclude staging-only runtime configuration and test identities. |
| SHA-256 | `TBD` | Hash all deployable frontend files after freeze. |
| Hosting deployment version/revision | `TBD` | Must be recorded before enabling traffic. |
| Production frontend origin | `TBD` | Must match Production LIFF endpoint mapping exactly. |

### Backend

| Field | RC value | Gate |
| --- | --- | --- |
| Source artifact | `TBD` — isolated Apps Script push tree | Exclude `STAGING_*`, tests, diagnostics, repair tools, migrations, fixtures, and local clasp credentials. |
| Push payload SHA-256 | `TBD` | Verify before any approved push. |
| Apps Script immutable version | `TBD` | Create only in a separately approved release phase. |
| Current Production deployment | Version 74 historical baseline | Re-verify before release. |
| Rollback deployment | Existing version 73 | Must remain selectable on the same Web App URL. |

### Schema

| Migration group | Dependency order | RC default |
| --- | --- | --- |
| Existing V2 runtime schema | Existing Sheets and headers | Included only after read-only schema preflight. |
| Notification queue/security | Queue/log schema → worker → feature flag | Excluded unless explicitly approved. |
| Contract/billing/payment lifecycle | Additive contract/bill/payment headers → workers → flags | Excluded unless explicitly approved. |
| Repair / move-out / settlement | Ledger → workflow schema → workers/routes → flags | Excluded from current V2 Production RC unless separately approved. |
| Staging bootstrap/fixtures | None | Never included. |

## 2. Production Shadow Checklist

### Configuration and environment separation

- [ ] Staging and Production use separate Apps Script projects, Spreadsheet
      bindings, LIFF IDs, LINE Login channels, Messaging channels, and test
      identities.
- [ ] RC references only Production environment configuration; it contains no
      hardcoded staging hostname, LIFF ID, endpoint, Spreadsheet binding, or
      test UID.
- [ ] Production Property inventory is verified by presence, scope, owner, and
      environment only; no values are copied into this document or Git.
- [ ] Production feature flags are recorded with default disabled state for all
      newly introduced lifecycle/queue features.
- [ ] Serving Web App remains on version 74 during shadow preparation; no new
      user traffic is directed to an RC.

### LIFF / LINE separation

- [ ] Production LIFF endpoint maps to the Production frontend explicit route.
- [ ] Staging LIFF endpoint maps only to the staging frontend explicit route.
- [ ] Production Login channel and Messaging API channel are not reused by
      staging.
- [ ] Staging test identities cannot pass Production allowlists or Properties.
- [ ] No Production channel receives a staging smoke-test notification.

## 3. Migration Dry Run Package

### Before migration

- [ ] Freeze RC frontend/backend artifact SHA-256 manifests.
- [ ] Confirm Production deployment version 74 and rollback version 73.
- [ ] Capture a Sheets backup/checkpoint for every approved affected Sheet.
- [ ] Capture read-only schema snapshot: sheet name, headers, row counts,
      duplicate key counts, and workspace-key counts.
- [ ] Obtain explicit approval for the exact additive migration list; optional
      lifecycle modules remain excluded by default.

### Ordered migration steps

1. Run read-only schema preflight and stop on unknown/missing headers,
   duplicate keys, or workspace inconsistency.
2. Enable the migration flag only for the approved operation.
3. Create new Sheets or append missing headers only; do not reorder/delete
   existing headers or rows.
4. Validate schema, duplicate-key, and workspace ownership results.
5. Disable the migration flag immediately after validation.
6. Do not enable a feature flag, worker, or public route until its dependency
   check passes.

### After migration

- [ ] Re-run read-only schema validation and compare with the snapshot.
- [ ] Run endpoint, identity, resolver, isolation, and payload smoke tests.
- [ ] Confirm no unexpected notifications, payments, or business writes occur.
- [ ] Trigger rollback on any schema mismatch, cross-workspace access,
      duplicate side effect, authentication regression, or worker loop.

### Rollback

1. Disable newly enabled feature flags and affected worker triggers.
2. Return the existing Web App deployment to immutable version 73 without
   changing its URL.
3. Run read-only endpoint and identity checks.
4. Restore only migration-owned changes from the approved backup after review.
5. Retain additive Sheets/columns when safe restoration cannot be proven;
   deletion is not the default rollback action.

## 4. Notification Worker Shadow Plan

The following events are evaluated as queue/log behavior only. Shadow testing
must not send messages to real recipients or invoke an unapproved Production
worker trigger.

| Event | Shadow input | Required checks |
| --- | --- | --- |
| `bill_created` | Controlled synthetic event metadata | Queue creation, dedupe key, worker pickup, retry status, sanitized log. |
| `payment_confirmed` | Controlled synthetic event metadata | Same as above; no actual payment record created. |
| `tenant_repair` | Controlled synthetic event metadata | Same as above; no repair ticket or LINE push created. |
| `contract_expiring` | Controlled synthetic event metadata | Same as above; no contract state change. |

| Worker behavior | Expected shadow evidence |
| --- | --- |
| Queue creation | Exactly one pending job per event/idempotency key. |
| Worker pickup | One transition to `processing`; worker ownership/time recorded without secrets. |
| Retry handling | Provider-style failure yields `retrying`, bounded retry count, and next retry timestamp. |
| Delivery logging | Sanitized result only; no token, ID token, or unmasked UID. |
| Stale recovery | Expired `processing` lease transitions to retry/terminal state once; no duplicate delivery. |

## 5. Security Verification

| Area | Required shadow verification |
| --- | --- |
| Tenant isolation | Tenant A can read only approved own projections; Tenant A cannot read tenant B. |
| Landlord isolation | Landlord A can read only Workspace A; caller-supplied Workspace B is denied. |
| Workspace boundary | Authenticated membership is canonical; no first-row or fallback Workspace selection. |
| RBAC | Tenant ↔ landlord cross-role requests fail closed; landlord roles deny unapproved operations. |
| Token boundary | Invalid, expired, wrong-audience, and unavailable-provider cases deny before resolver access. |
| Audit safety | Logs do not contain secrets or unmasked identity values. |

Use two disposable staging Workspaces for actual proof before considering any
Production shadow activity. Production data must not be used to prove these
controls.

## 6. Release Decision Matrix

| Decision | Conditions |
| --- | --- |
| **GO** | Clean isolated RC artifacts have verified SHA manifests; Production credential/property/LIFF/trigger evidence is complete; approved additive migration dry run and rollback owner exist; staging worker recovery and two-Workspace isolation pass; version 74 and rollback 73 are re-verified; named human approval recorded. |
| **CONDITIONAL GO** | Only when no schema/backend/frontend change is being enabled and the action is limited to an approved read-only Production verification that cannot direct user traffic or write data. This is not permission to push, create a version, or update deployment. |
| **NO-GO** | Any missing credential mapping, trigger inventory, rollback proof, migration approval, isolation proof, worker recovery proof, artifact SHA, or named human release approval. |

## Current Decision

**NO-GO.** The Production RC is not frozen and the required Production
configuration/trigger evidence, remote worker proof, two-Workspace proof, and
approval package remain incomplete. No shadow deployment or Production traffic
change is authorized.

## Validation Record

- Canonical validator: **PASS** — 68 routes, 68/68 handlers.
- Staging validator: **PASS** — 87 routes, 87/87 handlers.
- `git diff --check`: **PASS**.
- Production changes, deployment, commit, and push: **not performed**.
