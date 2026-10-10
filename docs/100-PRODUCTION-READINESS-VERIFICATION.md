# Phase 100 — Production Readiness Verification

Date: 2026-07-23  
Status: **NO-GO**

This document is the final pre-release verification package. It performs no
Production deployment, mutation, credential export, Sheet write, Git commit,
or Git push. Evidence must be recorded only as existence, scope, environment,
masked identifier, status, and approval owner.

## 1. Production Credential Verification

| Control | Verify only | Result | Manual closure action |
| --- | --- | --- | --- |
| LIFF channel ID | Exists, numeric format, Production channel ownership, correct Production frontend origin/path | BLOCKER | Confirm in LINE Developers with a masked screenshot. |
| LINE Login channel | Exists, expected audience/channel, callback mapping, Production environment | BLOCKER | Confirm valid and invalid ID-token verification results without exposing token values. |
| Messaging API channel | Channel exists, designated Production account, push scope approved | BLOCKER | Confirm account ownership and scope; staging channel must be distinct. |
| Access token | Script Property exists, non-empty, token type/scope suitable, rotation owner/date recorded | BLOCKER | Presence-only review. Do not read, print, copy, or commit the token. |
| Apps Script Properties | Required key names present, environment marker is Production, feature flags have owner/default state | BLOCKER | Complete redacted property inventory. |
| Spreadsheet binding | Property exists, ID format valid, bound resource is Production-owned | BLOCKER | Run read-only sheet/header preflight. |
| Web App deployment | Existing deployment is Web App, execute-as/access approved, version 74 current, version 73 rollback available | PASS — historical baseline | Reconfirm in Manage deployments immediately before release. |

Required Properties are defined in the Phase 99 checklist. New lifecycle
feature flags must remain disabled until their schema, worker, and rollback
gates have passed.

## 2. Production Trigger Inventory

The serving Production project must be inspected manually. The earlier
canonical-project observation of zero triggers is historical evidence only and
does not satisfy this inventory.

| Trigger name | Function | Frequency | Environment | Enabled | Owner |
| --- | --- | --- | --- | --- | --- |
| Automatic payment reminder | `runV2AutomaticPaymentReminders` | Hourly when installed | Production candidate | NOT VERIFIED | MASKED / TBD |
| V1 paid-bill sync | `syncV1PaidBillsToV2` | Every 5 minutes when installed | Legacy candidate | NOT VERIFIED | MASKED / TBD |
| Notification worker | `processNotificationQueue` | Every 5 minutes in staging | Staging-only until separately approved | MUST BE ABSENT | N/A |
| Contract expiry worker | `processContractExpiryNotifications` | Daily in staging | Staging-only until separately approved | MUST BE ABSENT | N/A |
| Billing lifecycle worker | `processBillingLifecycleNotifications` | Daily in staging | Staging-only until separately approved | MUST BE ABSENT | N/A |

Verification requirements:

- [ ] Production triggers use Production-owned accounts and Production resource bindings only.
- [ ] Staging trigger functions, Spreadsheet IDs, LIFF origins, and LINE
      channels do not appear in the Production project.
- [ ] Production trigger functions do not execute in the staging project.
- [ ] No trigger references tests, diagnostics, repair tooling, migrations,
      fixtures, `STAGING_*`, or legacy import functions unless separately
      approved.

## 3. Notification Worker Recovery Test Plan

This is a controlled test plan. It must use a consented non-production-data
recipient and must not be run until the queue feature is explicitly approved.

| Scenario | Flow | Expected result | Evidence |
| --- | --- | --- | --- |
| A — normal delivery | `pending → processing → sent` | One claim, one provider attempt, one completion/log entry | Masked queue ID, timestamps, final status, redacted provider outcome |
| B — stale processing | `processing timeout → retrying → processing` | Expired lease recovered once; retry count increments; no duplicate delivery | Lease age, retry count, next retry, redacted log |
| C — retry exhausted | `retrying → failed` | Third failure terminal; no fourth provider call | Attempt count, terminal status, sanitized error code |
| D — duplicate prevention | Same event / idempotency key repeated | One queue row and one intended delivery only | Dedupe key fingerprint and row count |

Production-use gate:

- [ ] Active worker trigger is singular, owned by the approved Production owner,
      and has a documented rollback/disable procedure.
- [ ] Queue, notification log, and security-failure records do not store tokens
      or unmasked LINE UIDs.
- [ ] Controlled worker proof is captured before any general recipient delivery.

## 4. Multi-Workspace Isolation Verification

Fixture roles:

```text
Workspace A: landlord A, tenant A
Workspace B: landlord B, tenant B
```

| Test | Expected result | Gate |
| --- | --- | --- |
| Landlord A → Workspace A data | Allow only authorized A contracts, bills, rooms, and messages | Required |
| Landlord A → Workspace B data | Deny closed; no B payload or row metadata | Required |
| Landlord A → tenant private data | Allow only the minimum A-scoped projection permitted by route policy | Required |
| Tenant A → own data | Allow only tenant A home, bills, contract, and messages | Required |
| Tenant A → tenant B data | Deny before resolver fallback or projection | Required |
| Tenant A → landlord route | Deny by RBAC | Required |
| Landlord A → tenant-only route | Deny by RBAC | Required |
| Caller-supplied Workspace ID mismatch | Deny `WORKSPACE_ACCESS_DENIED` or equivalent fail-closed response | Required |
| Invalid/expired token | Deny before tenant/landlord resolver reads | Required |

Evidence must contain only masked role/Workspace labels, route, result code,
timestamp, and redacted logs.

## 5. Production Migration Approval Package

### Migration order

1. Freeze approved isolated artifact and SHA manifest.
2. Confirm Production version 74 and rollback version 73.
3. Create Sheet backup/checkpoints and read-only schema baseline.
4. Run approved additive schema migration only; staging bootstrap and optional
   lifecycle modules remain excluded unless explicitly approved.
5. Validate schema/duplicate/workspace results; disable migration flag.
6. Push and deploy only through a separately approved Production release.
7. Enable one approved feature flag at a time.
8. Run read-only smoke, isolation, and worker recovery checks.

### Backup and validation checklist

- [ ] Backup/checkpoint for each affected Sheet.
- [ ] Header, row-count, duplicate-key, and workspace-key preflight captured.
- [ ] Migration ID, source SHA, feature-flag state, and owner recorded.
- [ ] Post-migration schema and no-leakage validation passes.
- [ ] Existing Web App URL is preserved.

### Rollback conditions

- Cross-workspace/cross-role access, token-verification regression, duplicate
  notification/payment/settlement effect, worker loop, or schema mismatch.

### Rollback procedure

1. Disable newly enabled feature flags and affected worker triggers.
2. Repoint the existing Web App deployment to immutable version 73; preserve
   the same URL and deployment identity.
3. Run endpoint and read-only tenant/landlord identity checks.
4. Restore only migration-owned rows from approved backup after review.
5. Do not delete additive Sheets or columns by default.
6. Record incident evidence and obtain fresh approval before retry.

## 6. Production SHA Manifest Template

| Area | Field | Value | Verification |
| --- | --- | --- | --- |
| Frontend | Artifact SHA-256 | TBD | Approved static hosting artifact |
| Frontend | Deployment version/revision | TBD | Hosting release record |
| Backend | Apps Script immutable version | TBD | Apps Script Manage deployments |
| Backend | Push payload SHA-256 | TBD | Isolated release tree |
| Schema | Migration version/IDs | TBD | Read-only post-migration validation |
| Release | Deployment timestamp | TBD | Release log |
| Rollback | Target version | `73` | Existing Production Web App deployment |

No complete endpoint URL, deployment token, Script ID, token, secret, or UID
belongs in the manifest.

## Validation Evidence

- Canonical validator: **PASS** — 68 routes, 68/68 handlers.
- Staging validator: **PASS** — 87 routes, 87/87 handlers.
- Diff integrity check: **PASS**.
- Production deployment, source, Sheets, Properties, triggers, LIFF, and LINE:
  **not modified**.

## Decision and Required Human Operations

**NO-GO.** The following must be completed by an authorized human before any
Production deployment is considered:

1. Complete the redacted credential/Properties/LIFF/channel matrix.
2. Export the serving Production trigger inventory and confirm isolation from
   staging.
3. Approve exact additive schema scope, backups, and rollback owner.
4. Run the two-Workspace isolation matrix and controlled notification-recovery
   proof in staging before Production use.
5. Freeze the isolated Production artifact and populate the SHA manifest.
6. Reconfirm the version 74 → 73 rollback baseline and obtain named GO
   approval.
