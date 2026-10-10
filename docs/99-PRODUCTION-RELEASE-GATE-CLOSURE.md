# Phase 99 — Production Release Gate Closure

Date: 2026-07-23  
Decision: **NO-GO — evidence and approval gates remain open**

## Scope

This is a documentation and validation phase only. Production Apps Script,
Sheets, Script Properties, LIFF, LINE channels, triggers, Web App deployment,
frontend, Git history, and remote source were not changed.

No secret, token, complete identifier, or LINE UID is recorded below.

## A. Production Credential Verification Checklist

The release owner must complete this table in the serving Production Apps
Script project and record only the allowed evidence fields.

| Control | Allowed evidence to record | Current result | Required closure evidence |
| --- | --- | --- | --- |
| LINE LIFF channel ID | Exists; numeric format; masked suffix; mapped frontend origin/path; owner | **BLOCKER** | Screenshot or reviewer attestation showing Production LIFF is mapped to the Production frontend origin, not staging. |
| LINE Login verifier | Property exists; expected audience/channel format; timeout/retry policy enabled | **BLOCKER** | Redacted Script Properties presence check and valid/invalid token test result. |
| LINE Messaging API token | Property exists; token type/scope suitable for push; rotation owner/date; no value shown | **BLOCKER** | Redacted property check plus controlled staging delivery evidence and Production rotation runbook. |
| Apps Script Properties | Required key names exist; environment marker format; feature flags/owners | **BLOCKER** | Presence-only inventory of all required Production keys; values never exported. |
| Spreadsheet binding | Property exists; ID format only; belongs to Production service owner | **BLOCKER** | Redacted binding check and a read-only sheet/header preflight result. |
| Web App deployment | Web App type; masked deployment token; execute-as; access category; current version | **PASS — historical baseline** | Re-verify immediately before release that the existing deployment remains at version 74 with version 73 available for rollback. |
| Trigger ownership | Trigger owner account; handler; schedule; enabled state | **BLOCKER** | Current serving-project trigger inventory, with masked owner/account evidence. |

### Required Production Properties

Record only `PRESENT`, `ABSENT`, or `NOT VERIFIED`, plus a responsible owner:

```text
CMWEBS_ENVIRONMENT
CMWEBS_SPREADSHEET_ID
CMWEBS_LINE_LOGIN_CHANNEL_ID
CMWEB_TENANT_LIFF_URL
CMWEB_TENANT_FRONTEND_BASE_URL
CMWEB_LANDLORD_FRONTEND_BASE_URL
LINE_CHANNEL_ACCESS_TOKEN
CMWEBS_LINE_VERIFY_TIMEOUT_MS
CMWEBS_LINE_VERIFY_MAX_ATTEMPTS
CMWEBS_NOTIFICATION_PROCESSING_TIMEOUT_MINUTES
CMWEBS_FEATURE_ALLOW_TEST_IDENTITY
CMWEBS_FEATURE_SCHEMA_MIGRATIONS
CMWEBS_FEATURE_NOTIFICATION_QUEUE
CMWEBS_FEATURE_REPAIR_WORKFLOW
CMWEBS_FEATURE_LEASE_LIFECYCLE
CMWEBS_FEATURE_BILLING_LIFECYCLE
CMWEBS_FEATURE_MOVE_OUT_SETTLEMENT
CMWEBS_FEATURE_SECURITY_FAILURE_QUEUE
```

For a first Production promotion, all newly introduced lifecycle feature flags
must start disabled. A missing property must fail closed; it must never fall
back to a staging value or a hardcoded secret.

## B. Production Trigger Inventory

### Inventory procedure

1. Open the Apps Script project that owns the currently serving Production Web
   App deployment.
2. Open **Triggers** and transcribe only handler name, event type/frequency,
   masked owner, enabled state, and environment classification.
3. Compare every handler with the approved Production release manifest.
4. Stop the gate if any trigger references `TESTS`, `STAGING_*`, migration,
   repair, diagnostic, legacy-import, or fixture function.

### Current known state

An historical Phase 56 inspection found zero triggers in an earlier canonical
project, but that observation cannot prove the trigger state of the currently
serving Production project. Therefore the authoritative inventory is **not
verified**.

### Expected handler candidates (source only; not proof of installation)

| Trigger name | Function | Frequency | Environment | Enabled status |
| --- | --- | --- | --- | --- |
| Automatic payment reminder | `runV2AutomaticPaymentReminders` | Every hour when installed | Production candidate | NOT VERIFIED |
| V1 paid-bill sync | `syncV1PaidBillsToV2` | Every 5 minutes when installed | Legacy candidate | NOT VERIFIED |
| Notification worker | `processNotificationQueue` | Every 5 minutes in staging migration | Staging only until separately approved | MUST BE ABSENT |
| Contract expiry worker | `processContractExpiryNotifications` | Daily in staging migration | Staging only until separately approved | MUST BE ABSENT |
| Billing lifecycle worker | `processBillingLifecycleNotifications` | Daily in staging migration | Staging only until separately approved | MUST BE ABSENT |

### Staging contamination gate

- [ ] No Production trigger owner is a staging-only account.
- [ ] No trigger handler originates from `STAGING_*`, tests, fixture setup,
      migration, repair, or diagnostics.
- [ ] Production trigger list has no staging Spreadsheet, LIFF, frontend, or
      Messaging configuration reference.
- [ ] Trigger creation is performed only after a review of its handler's
      feature flag and rollback behavior.

## C. Notification Worker Recovery Verification Plan

### State transition contract

```text
pending → processing → sent
                    ↘ retrying → processing
                    ↘ failed
```

| Scenario | Expected result | Evidence required | Release gate |
| --- | --- | --- | --- |
| Pending job | One eligible job is claimed once. | Masked queue ID, worker timestamp, status transition. | Required if queue is included. |
| Successful provider attempt | `processing → sent`, one log row, no duplicate delivery. | Redacted provider result and dedupe check. | Required if queue is included. |
| Provider failure 1/2 | `processing → retrying`, retry count increments, next retry scheduled. | Redacted error code and calculated next retry. | Required if queue is included. |
| Processing timeout | Expired lease becomes retryable or terminal based on retry count. | Stale age, resulting status, no duplicate send. | Required if queue is included. |
| Third failed attempt | Terminal `failed`; no fourth provider call. | Attempt count and terminal status. | Required if queue is included. |
| Repeat business event | Existing dedupe key prevents duplicate queue row. | Queue row count and dedupe outcome. | Required if queue is included. |

### Production safety requirements

- No real recipient notification may be used for the first worker proof.
- A controlled, consented test recipient and an explicit idempotency key are
  required.
- The worker trigger must be singular, owned by the approved Production owner,
  and disabled before rollback if it contributes to an incident.
- Queue, log, and security-failure records must never contain access tokens,
  ID tokens, or unmasked LINE UIDs.

**Current result: BLOCKER.** Local/staging fixture coverage exists, but the
real trigger inventory and stale-processing recovery are not yet evidenced in
the serving Production environment.

## D. Workspace Isolation Production Checklist

| Check | Expected result | Current result |
| --- | --- | --- |
| Landlord cannot read another Workspace's tenant, bills, contracts, or messages | Deny closed with no payload leakage. | BLOCKER — remote two-Workspace proof pending. |
| Tenant cannot read another tenant's data | Deny before projection or Sheet fallback. | BLOCKER — remote two-Workspace proof pending. |
| Tenant cannot access landlord routes | Role denial; no landlord projection. | PASS in staging evidence; Production proof pending. |
| Landlord cannot access tenant-only routes | Role denial; no tenant operation side effect. | PASS in staging evidence; Production proof pending. |
| Caller-supplied `workspace_id` | Must match authenticated membership or fail `WORKSPACE_ACCESS_DENIED`. | PASS in source/staging evidence; Production proof pending. |
| RBAC policy coverage | Every included landlord route has explicit policy; unmapped route fails closed. | PASS in source/staging evidence; Production artifact review pending. |
| Invalid/expired LINE token | Deny before tenant/landlord resolver access. | BLOCKER — Production verifier evidence pending. |

### Required production execution matrix

Use two approved, disposable test Workspaces and two isolated landlord/tenant
sets. Test own-data allow, cross-Workspace deny, cross-role deny, missing
membership deny, stale token deny, and duplicate/idempotency behavior. Record
only masked roles, Workspace labels, route, result code, timestamp, and
sanitized logs.

## E. Production Migration Execution Plan

### 1. Backup

- [ ] Freeze a clean isolated release artifact and approved SHA-256 manifest.
- [ ] Capture current Production deployment version 74 and verify version 73
      is selectable as the rollback target.
- [ ] Create a versioned Sheet backup/checkpoint for every approved affected
      sheet.
- [ ] Record schema headers, row counts, duplicate-key counts, and workspace
      key counts without exporting sensitive data.

### 2. Schema migration

- [ ] Obtain approval for the exact additive schema subset. Staging-only and
      unapproved lifecycle modules are excluded.
- [ ] Run read-only preflight first; fail on missing base Sheets, unexpected
      header order, duplicate keys, or workspace inconsistencies.
- [ ] Apply only additive Sheets/headers under a temporary migration flag.
- [ ] Validate immediately; disable the migration flag after success.

### 3. Validation

- [ ] Verify schema headers, duplicate keys, rollback ledger readiness, and
      feature flags.
- [ ] Run the isolated release validator, credential scan, route/handler
      coverage, and release SHA comparison.
- [ ] Verify LIFF token flow, RBAC, tenant/landlord isolation, and notification
      worker behavior using controlled test identities only.

### 4. Smoke test

- [ ] Web App endpoint remains available.
- [ ] Tenant binding/status, home, bills, contract, and message read paths
      behave as expected.
- [ ] Landlord home, contracts, and billing paths behave as expected after
      onboarding.
- [ ] No write, payment, notification, or migration action occurs outside the
      explicitly approved test case.

### 5. Rollback procedure

1. Stop feature activation and worker triggers.
2. Repoint the existing Web App deployment to immutable version 73; preserve
   its URL and deployment identity.
3. Disable only the newly enabled feature flags.
4. Run endpoint and read-only identity smoke checks.
5. Restore only migration-owned rows from the approved backup after review;
   do not delete new additive sheets/columns by default.
6. Document the incident and require new approval before retrying release.

## F. Production SHA Manifest Template

Populate this template only after an isolated artifact is frozen. Do not put
credentials, complete IDs, URLs, or tokens in the manifest.

| Field | Value | Verification |
| --- | --- | --- |
| Release name | `TBD` | Human approved |
| Git commit / artifact ref | `TBD` | Clean isolated tree |
| Apps Script source SHA-256 | `TBD` | Hash of approved push payload |
| Frontend artifact SHA-256 | `TBD` | Hash of approved static hosting artifact |
| Apps Script immutable version | `TBD` | Apps Script deployment UI |
| Deployment token fingerprint | `TBD` | Masked/hash-only match |
| Schema version / migration IDs | `TBD` | Read-only post-migration validation |
| Feature flags enabled | `TBD` | Presence-only/boolean audit |
| Deployment timestamp | `TBD` | Release log |
| Rollback version | `73` | Existing Web App deployment |
| Rollback owner | `TBD` | Named human approver |

## Gate Summary

| Area | Result | Required action |
| --- | --- | --- |
| Local canonical validation | PASS | Retain 68-route / 68-handler baseline. |
| Staging static validation | PASS | Retain 87-route / 87-handler staging baseline. |
| Production credential and property verification | BLOCKER | Complete redacted presence-and-mapping audit. |
| Production trigger inventory | BLOCKER | Inspect serving project and record masked inventory. |
| Notification worker recovery | BLOCKER | Prove real trigger recovery with a controlled job. |
| Production workspace isolation | BLOCKER | Execute approved two-Workspace matrix. |
| Schema migration approval | BLOCKER | Approve additive subset, backup, dry run, and rollback. |
| SHA release manifest | BLOCKER | Freeze a clean isolated artifact and populate template. |
| Rollback baseline | PASS | Re-verify version 74 and target 73 immediately before release. |

## Final Decision

**NO-GO.** Phase 99 provides the final closure package but does not close the
remaining remote Production evidence, migration approval, or isolated artifact
gates. No Production change is authorized until every blocker is converted to
PASS and a named human approves the release.
