# Phase 102 — Production Environment Inventory

Date: 2026-07-23  
Decision: **NO-GO — Production inventory has not been completed in the serving project**

## Scope

This inventory is a non-mutating release prerequisite. It does not read or
print secrets, alter Script Properties, write Sheets, deploy Apps Script,
change triggers, commit, or push.

Status values mean:

- **PRESENT** — existence/scope/environment has evidence, without exposing a value.
- **MISSING** — confirmed absent.
- **PENDING HUMAN CONFIRMATION** — no sufficient evidence is available.

## 1. Production Credential Inventory

| Item | Status | Allowed verification evidence | Required human confirmation |
| --- | --- | --- | --- |
| Production LIFF ID | PENDING HUMAN CONFIRMATION | Exists; numeric format; masked suffix; Production channel/endpoint mapping | Confirm it maps to the Production frontend origin and not staging. |
| LINE Login channel | PENDING HUMAN CONFIRMATION | Exists; Production ownership; expected audience/callback scope | Confirm server-side verifier accepts the expected Production audience only. |
| LINE Messaging API channel | PENDING HUMAN CONFIRMATION | Exists; Production account; approved push scope | Confirm it is distinct from staging channel/account. |
| Messaging access token reference | PENDING HUMAN CONFIRMATION | Script Property key exists; non-empty state; token scope/rotation owner/date | Do not reveal or copy token value. |
| Apps Script Properties | PENDING HUMAN CONFIRMATION | Required key names, environment marker, feature-flag booleans, property owner | Verify all values stay inside the serving Production project. |
| Spreadsheet binding | PENDING HUMAN CONFIRMATION | Property exists; ID format; resource ownership | Run a read-only schema/header preflight. |
| Production Web App deployment | PRESENT — historical evidence | Existing Web App was version 74; version 73 recorded as rollback target | Reconfirm current version/deployment identity immediately before release. |

Required Properties to confirm by **key name only**:

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

## 2. Trigger Inventory

The table below is a Production trigger matrix, not a claim that each trigger
is installed. The serving Production project must be opened in Apps Script to
complete the pending rows.

| Trigger name | Function | Schedule | Environment | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Automatic payment reminder | `runV2AutomaticPaymentReminders` | Hourly when installed | Production candidate | MASKED / TBD | PENDING HUMAN CONFIRMATION |
| V1 paid-bill sync | `syncV1PaidBillsToV2` | Every 5 minutes when installed | Legacy candidate | MASKED / TBD | PENDING HUMAN CONFIRMATION |
| Notification worker | `processNotificationQueue` | Every 5 minutes in staging migration | Staging-only | N/A | MUST NOT EXIST IN PRODUCTION |
| Contract expiry worker | `processContractExpiryNotifications` | Daily in staging migration | Staging-only | N/A | MUST NOT EXIST IN PRODUCTION |
| Billing lifecycle worker | `processBillingLifecycleNotifications` | Daily in staging migration | Staging-only | N/A | MUST NOT EXIST IN PRODUCTION |

Isolation confirmation:

- [ ] Production trigger owners are Production-approved accounts.
- [ ] Production trigger functions do not reference staging Sheets, LIFF IDs,
      frontend hosts, channels, Properties, or test identities.
- [ ] Staging triggers do not use Production Apps Script project, Sheet,
      channel, or token references.
- [ ] No trigger targets test, diagnostics, repair, migration, fixture,
      `STAGING_*`, or unapproved legacy functions.

## 3. Deployment Inventory

| Surface | Current inventory | Status | Required action |
| --- | --- | --- | --- |
| Frontend hosting revision | `TBD` | PENDING HUMAN CONFIRMATION | Record the approved Production hosting revision/release only. |
| Frontend artifact SHA-256 | `TBD` | PENDING HUMAN CONFIRMATION | Freeze isolated frontend artifact and record hash. |
| Backend Apps Script deployment version | Historical baseline v74 | PRESENT — historical evidence | Reconfirm serving Web App is v74 before release. |
| Backend rollback version | v73 | PRESENT — historical evidence | Reconfirm it remains selectable on the same Web App deployment. |
| Backend push payload SHA-256 | `TBD` | PENDING HUMAN CONFIRMATION | Create from clean isolated Production release tree. |
| Schema migration version | `TBD` | PENDING HUMAN CONFIRMATION | Record only approved additive migration IDs after dry run. |

## 4. Notification Worker Verification Plan

### Queue state model

```text
pending → processing → sent
                    ↘ retrying → processing
                    ↘ failed
```

### Manual verification checklist

- [ ] Confirm queue schema is approved and feature flag is disabled until worker
      readiness is proven.
- [ ] Verify one controlled `pending` job is claimed once as `processing`.
- [ ] Simulate/provider-test an initial failure: status becomes `retrying`,
      retry count increments, and `next_retry_at` is set.
- [ ] Verify an expired `processing` lease recovers once to retry or terminal
      failure without duplicate delivery.
- [ ] Verify retry exhaustion transitions to `failed` with no fourth provider
      call.
- [ ] Verify a repeated event/idempotency key creates no duplicate queue job.
- [ ] Confirm delivery/error logs are sanitized: no token, ID token, or
      unmasked LINE UID.
- [ ] Confirm a worker trigger is singular, owned by Production, and can be
      disabled during rollback.

This plan must be proven with a consented test boundary before notification
features are enabled for Production users.

## 5. Workspace Isolation Verification

Fixture matrix:

```text
Workspace A: landlord A, tenant A
Workspace B: landlord B, tenant B
```

| Request | Required result |
| --- | --- |
| Landlord A → Workspace A data | Allow only policy-approved A data. |
| Landlord A → Workspace B data | Deny closed; no B data or projection metadata. |
| Landlord A → tenant private data | Allow only minimal route-authorized A-scoped fields. |
| Tenant A → own home/bills/contract/messages | Allow only own canonical identity chain. |
| Tenant A → tenant B data | Deny before fallback/projection. |
| Tenant A → landlord route | Deny by RBAC. |
| Landlord A → tenant-only route | Deny by RBAC. |
| Caller-supplied Workspace B by A | Deny `WORKSPACE_ACCESS_DENIED` or equivalent. |
| Invalid/expired token | Deny before tenant/landlord resolver access. |

No Production tenant/landlord data is to be used for this proof; use
disposable staging Workspaces first.

## 6. Release Gate Update

### Resolved blockers

- Local canonical validation passes: 68 routes and 68/68 handlers.
- Staging static validation passes: 87 routes and 87/87 handlers.
- Staging Phase 83 binding critical-path tests pass after reconciliation
  classifier correction.
- Historical Production Web App baseline v74 and rollback v73 are documented.

### Pending blockers

1. Production credential, Property, LIFF, Login channel, and Messaging channel
   inventories are pending human confirmation.
2. Serving Production trigger inventory and ownership are pending human
   confirmation.
3. Production frontend revision/hash and final isolated backend payload hash
   are not frozen.
4. Notification worker real trigger/recovery proof is incomplete.
5. Two-Workspace landlord/tenant isolation proof is incomplete.
6. Approved additive schema scope, backup, migration version, and rollback
   owner are incomplete.

### Required human actions

1. Complete the presence-only credential and Properties matrix in the serving
   Production Apps Script project.
2. Export a masked trigger inventory from the serving Production project.
3. Verify Production and staging resource separation in LINE Developers and
   Apps Script.
4. Freeze the isolated frontend/backend artifacts and populate SHA fields.
5. Approve the schema subset and backup/rollback plan.
6. Complete staging notification recovery and two-Workspace isolation evidence.
7. Reconfirm v74 serving status and v73 rollback availability, then obtain
   named human release approval.

## Final Decision

**NO-GO.** Production remains untouched. The release gate can advance only
after every pending inventory, shadow proof, migration, SHA, and approval item
is closed with sanitized evidence.
