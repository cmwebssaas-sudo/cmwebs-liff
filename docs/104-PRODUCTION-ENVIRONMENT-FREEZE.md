# Phase 104 — Production Environment Inventory & Credential Freeze

Date: 2026-07-23  
Decision: **NO-GO — the evidence freeze is defined, but the serving Production
environment has not yet been verified**

## Scope and non-disclosure rule

This document is the single presence-and-scope inventory required before a
Production release. It records only status, purpose, ownership, and masked
evidence references. It must never contain a secret, token, complete ID, UID,
or endpoint token.

Phase 104 made no Production write, deployment, configuration, Sheet,
trigger, commit, or push. A `PENDING HUMAN CONFIRMATION` item is deliberately
not inferred from staging or repository files.

Status legend:

- **VERIFIED** — a current, sanitized serving-Production evidence record exists.
- **HISTORICAL** — prior documentation exists but must be re-confirmed.
- **PENDING HUMAN CONFIRMATION** — evidence is unavailable in this workspace.
- **MUST NOT EXIST** — an item is staging-only and is forbidden in Production.

## 1. Production credential inventory

| Area | Required non-sensitive evidence | Status | Freeze requirement |
| --- | --- | --- | --- |
| LINE Login channel | Production-owned channel confirmed; expected audience and callback scope confirmed. | PENDING HUMAN CONFIRMATION | Record channel label/owner and masked identifier only. |
| Tenant LIFF ID | Production channel, frontend origin, and endpoint mapping match. | PENDING HUMAN CONFIRMATION | Record masked suffix and origin; do not record full LIFF ID. |
| Landlord LIFF ID | Production channel, frontend origin, and endpoint mapping match. | PENDING HUMAN CONFIRMATION | Record masked suffix and origin; do not record full LIFF ID. |
| Messaging API channel | Production account/channel is distinct from staging and has approved push scope. | PENDING HUMAN CONFIRMATION | Record account/channel label and rotation owner only. |
| Messaging access token | Script Property exists, is non-empty, is owned/rotatable, and has expected scope. | PENDING HUMAN CONFIRMATION | Do not read, output, export, or copy the token. |
| Apps Script project binding | Approved serving Script project and Web App deployment match the release candidate. | PENDING HUMAN CONFIRMATION | Compare only masked project/deployment evidence. |
| Spreadsheet binding | Production property resolves to an approved Production-owned spreadsheet. | PENDING HUMAN CONFIRMATION | Confirm format, ownership, and read-only schema access; do not print ID. |

### Properties and environment keys

The serving Production project must verify presence, purpose, and ownership of
the following key names. Values are not permitted in this document.

| Property key | Purpose | Required Production state |
| --- | --- | --- |
| `CMWEBS_ENVIRONMENT` | Runtime environment marker | Present and identifies Production. |
| `CMWEBS_SPREADSHEET_ID` | Standalone runtime spreadsheet binding | Present; Production-owned and accessible to the serving project. |
| `CMWEBS_LINE_LOGIN_CHANNEL_ID` | Server-side LINE Login audience verification | Present; Production channel only. |
| `CMWEB_TENANT_LIFF_URL` | Tenant LIFF mapping | Present; Production tenant LIFF/origin only. |
| `CMWEB_TENANT_FRONTEND_BASE_URL` | Tenant frontend origin | Present; Production hosting origin only. |
| `CMWEB_LANDLORD_FRONTEND_BASE_URL` | Landlord frontend origin | Present; Production hosting origin only. |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API credential | Present only if approved push functionality is enabled. |
| `CMWEBS_LINE_VERIFY_TIMEOUT_MS` | Token verification timeout | Present with reviewed bounded value. |
| `CMWEBS_LINE_VERIFY_MAX_ATTEMPTS` | Token verification retry bound | Present with reviewed bounded value. |
| `CMWEBS_NOTIFICATION_PROCESSING_TIMEOUT_MINUTES` | Worker lease/recovery bound | Present before queue worker is enabled. |
| `CMWEBS_FEATURE_ALLOW_TEST_IDENTITY` | Test-identity guard | Disabled in Production. |
| `CMWEBS_FEATURE_SCHEMA_MIGRATIONS` | Migration guard | Disabled except during approved, observed migration window. |
| `CMWEBS_FEATURE_NOTIFICATION_QUEUE` | Notification queue guard | Disabled until worker/recovery evidence is complete. |
| `CMWEBS_FEATURE_REPAIR_WORKFLOW` | Repair workflow guard | Disabled unless separately approved for V2. |
| `CMWEBS_FEATURE_LEASE_LIFECYCLE` | Lease lifecycle guard | Disabled until approved schema/runtime proof. |
| `CMWEBS_FEATURE_BILLING_LIFECYCLE` | Billing lifecycle guard | Disabled until approved schema/runtime proof. |
| `CMWEBS_FEATURE_MOVE_OUT_SETTLEMENT` | Financial settlement guard | Disabled unless separately approved. |
| `CMWEBS_FEATURE_SECURITY_FAILURE_QUEUE` | Security failure queue guard | Disabled until reviewed recovery and retention policy exists. |

## 2. Production trigger inventory

This is an inventory target, not proof that the listed triggers are currently
installed. Complete it inside the serving Production Apps Script project using
sanitized evidence.

| Trigger name | Function | Schedule | Environment | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Automatic payment reminder | `runV2AutomaticPaymentReminders` | Hourly when installed | Production candidate | MASKED / TBD | PENDING HUMAN CONFIRMATION |
| V1 paid-bill sync | `syncV1PaidBillsToV2` | Every 5 minutes when installed | Legacy candidate | MASKED / TBD | PENDING HUMAN CONFIRMATION |
| Notification worker | `processNotificationQueue` | Every 5 minutes only if approved | Staging migration candidate | N/A | MUST NOT EXIST until Production feature approval |
| Contract-expiry worker | `processContractExpiryNotifications` | Daily only if approved | Staging lifecycle candidate | N/A | MUST NOT EXIST until Production feature approval |
| Billing-lifecycle worker | `processBillingLifecycleNotifications` | Daily only if approved | Staging lifecycle candidate | N/A | MUST NOT EXIST until Production feature approval |

Trigger separation freeze:

- [ ] Every Production trigger is owned by an approved Production account.
- [ ] No Production trigger resolves a staging Script Property, Sheet, LINE
      channel, LIFF origin, test identity, fixture, repair, migration, or
      diagnostic function.
- [ ] No staging trigger references the serving Production Script project,
      spreadsheet, channel, token, or hosting origin.
- [ ] Trigger function, schedule, owner, and enabled state have a dated,
      sanitized screenshot/export reference.

## 3. Release artifact freeze

No artifact is frozen until a second reviewer independently recomputes its
hash from a clean, isolated release tree.

| Artifact | Freeze field | Current value | Required confirmation |
| --- | --- | --- | --- |
| Frontend | SHA-256 | TBD | Production-only artifact contains no staging host, LIFF, endpoint, test UID, or fallback. |
| Frontend | Hosting revision | TBD | Revision is approved and rollback revision is known. |
| Backend | SHA-256 manifest | TBD | File list matches the reviewed Production runtime tree only. |
| Backend | Apps Script deployment version | Historical current v74 | Reconfirm the serving deployment immediately before release. |
| Backend | Rollback version | Historical v73 | Reconfirm it remains selectable on the same Web App deployment. |
| Schema | Migration version(s) | TBD | Only approved additive migration IDs are included. |
| Configuration | Environment freeze timestamp | TBD | Properties presence/scope matrix completed without values. |

Artifact freeze acceptance:

- [ ] `npm run validate` passes from the canonical repository.
- [ ] The staging release-tree validator passes from the staging artifact.
- [ ] Route, handler, duplicate-declaration, HTML-link, and credential scans
      are clean.
- [ ] A release manifest excludes `TESTS`, repair, diagnostics, migrations,
      fixtures, local credentials, and `STAGING_*` code unless a separately
      reviewed Production-safe equivalent is named.
- [ ] Any change after hashing invalidates this freeze and requires new hashes.

## 4. Migration readiness

### Required sequence

```text
backup checkpoint
  → read-only schema preflight
  → approved additive schema migration
  → isolated backend deployment
  → isolated frontend deployment
  → trigger verification
  → read-only smoke test
```

### Dependencies and rollback point

| Item | Dependency | Must be true before proceeding | Rollback point |
| --- | --- | --- | --- |
| Backup | Named release/backup/restore owners | Sheet/export checkpoint, deployment metadata, trigger and Properties presence snapshots exist. | Verified restore procedure. |
| Schema | Approved additive subset | Headers, row counts, duplicate keys, and `workspace_id` coverage pass preflight. | Migration-owned rows/log only; no destructive column rollback. |
| Backend | Schema dependencies pass | Payload SHA and project binding match freeze. | Existing Web App version 73. |
| Frontend | Backend contract compatibility | Artifact SHA and Production LIFF/origins match freeze. | Previous approved hosting revision. |
| Trigger | Feature flag and worker proof | Exactly one approved owner/function/schedule; no staging reference. | Disable new trigger/flag before restoring runtime. |
| Smoke test | Authentication and resolver proof | Tenant/landlord role and Workspace boundary tests pass read-only. | Stop rollout; restore backend/frontend as appropriate. |

## 5. Notification worker readiness

The notification worker is **not Production-ready** until its queue schema,
trigger, retry policy, and stale lease recovery are all demonstrated in a safe
test boundary and separately approved.

| Control | Required state | Current status |
| --- | --- | --- |
| Worker trigger | Single approved Production trigger with masked owner evidence | PENDING HUMAN CONFIRMATION |
| Queue schema | Additive schema is versioned, preflighted, and feature-gated | PENDING APPROVED SCHEMA SCOPE |
| Retry policy | First retry after 5 minutes; second after 30 minutes; third failure terminal | Staging design only; Production approval pending |
| State model | `pending → processing → sent`; failure uses `retrying` then `failed` | Staging design only; Production proof pending |
| Stale recovery | Expired `processing` lease is reclaimed once without duplicate delivery | Staging proof required; Production trigger must remain disabled |
| Idempotency | Repeated business event creates one queue lineage | Staging proof required |
| Logging | Sanitized provider/status record; no token or unmasked UID | Staging design only; Production proof pending |

## 6. Workspace isolation checklist

All proofs use two independent disposable staging Workspaces before any
Production feature is enabled. The final Production artifact must preserve the
same authorization boundaries.

| Workspace | Principal | Allowed access | Required denial |
| --- | --- | --- | --- |
| A | Landlord A | Authorized A-scoped Workspace, property, contract, bill, and permitted tenant projections. | All Workspace B data; tenant-only routes; unapproved private fields. |
| A | Tenant A | Tenant A home, bills, contract, and authorized messages only. | Tenant B records; all landlord routes; caller-supplied alternate IDs. |
| B | Landlord B | Authorized B-scoped Workspace data only. | All Workspace A data; tenant-only routes; unapproved private fields. |
| B | Tenant B | Tenant B home, bills, contract, and authorized messages only. | Tenant A records; all landlord routes; caller-supplied alternate IDs. |

Final assertions:

- [ ] Server-side identity, not a client-provided identifier, selects the
      tenant/landlord and Workspace chain.
- [ ] Invalid or expired LINE authentication fails before resolver/Sheet access.
- [ ] Cross-role and cross-Workspace requests fail closed without returning
      projections or metadata.
- [ ] All included write routes verify role and `workspace_id` server-side.

## 7. Release gate

### GO

Only possible after every credential/Property/LIFF/trigger row above is
verified with sanitized Production evidence; artifacts and migration scope are
frozen; backup/restore rehearsal and isolation/notification proofs pass; and
named owners approve the release window.

### CONDITIONAL GO

Allows only non-mutating inventory, review, or read-only preflight activity.
It never authorizes schema migration, `clasp push`, deployment, trigger change,
Property mutation, or frontend rollout.

### NO-GO — current status

Production release remains blocked because the serving Production environment
has not supplied the required sanitized credential/Property/LIFF/trigger
evidence; artifacts and schema scope are not frozen; and notification recovery
plus two-Workspace isolation have not been closed as release evidence.

### Required human actions

1. Complete the property, credential, LIFF, Messaging channel, and deployment
   presence/scope inventory in the serving Production consoles.
2. Export a masked Production trigger inventory and prove staging/Production
   separation.
3. Freeze reviewed frontend/backend release artifacts and second-review their
   SHA-256 manifests.
4. Approve or exclude each optional migration category and complete the
   backup/restore rehearsal.
5. Attach sanitized notification recovery and two-Workspace isolation results.
6. Obtain named release, backup, rollback, and release-window approvals.

## Phase 104 validation record

This file is an inventory and freeze template, not Production evidence. The
local and staging validators, plus whitespace checks, are run as part of this
Phase; their successful outcome does not close a pending Production row.
