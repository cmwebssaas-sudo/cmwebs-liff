# Phase 111 — Production Release Approval Checklist

Date: 2026-07-23  
Final status: **NO-GO — approval evidence is incomplete**

## Scope and approval boundary

This is the final human sign-off checklist for a future Production release. It
does not authorize any Production action by itself. No Production Sheet,
Property, Apps Script source/deployment, trigger, queue, LINE delivery,
commit, or push was changed while creating it.

Do not record credentials, complete IDs, tokens, UIDs, or URLs with deployment
tokens. Evidence must be presence/scope/ownership only and use masked values.

## 1. Production credential verification

| Check | Required verification | Status | Approver / evidence reference |
| --- | --- | --- | --- |
| LINE Login Channel | Production-owned channel; expected server-verification audience and callback scope. | [ ] pass [ ] fail [ ] pending | TBD |
| Tenant LIFF ID | Production channel and approved tenant frontend endpoint/origin. | [ ] pass [ ] fail [ ] pending | TBD |
| Landlord LIFF ID | Production channel and approved landlord frontend endpoint/origin. | [ ] pass [ ] fail [ ] pending | TBD |
| Messaging API Channel | Production account/channel, push scope, and rotation owner; separate from staging. | [ ] pass [ ] fail [ ] pending | TBD |
| Messaging access token | Script Property exists/non-empty and is scoped to serving Production project. | [ ] pass [ ] fail [ ] pending | TBD |
| Apps Script Properties | Required key names, environment purpose, ownership, and approved flag states match Production policy. | [ ] pass [ ] fail [ ] pending | TBD |
| OAuth permission | Serving project principal has only required scopes and access to Production-bound resources. | [ ] pass [ ] fail [ ] pending | TBD |
| Web App/project binding | Serving deployment belongs to approved Production script project and preserves existing URL/access model. | [ ] pass [ ] fail [ ] pending | TBD |

Required key-name checks include `CMWEBS_ENVIRONMENT`,
`CMWEBS_SPREADSHEET_ID`, LINE Login/LIFF/frontend mapping keys, LINE Messaging
token reference, verification bounds, notification-processing timeout, and
feature flags. New queue/migration/lifecycle flags remain disabled unless this
checklist contains separate approved evidence.

## 2. Production trigger inventory

Complete from the serving Apps Script project without changing trigger state.

| Trigger name | Handler | Environment | Status | Verification |
| --- | --- | --- | --- | --- |
| Notification worker | `processNotificationQueue` | Production only after explicit approval | MUST NOT EXIST currently | [ ] function [ ] schedule [ ] owner [ ] isolation |
| Billing worker | `processBillingLifecycleNotifications` | Production only after explicit approval | MUST NOT EXIST currently | [ ] function [ ] schedule [ ] owner [ ] isolation |
| Payment notification pathway | Approved payment event/worker only | Production only after scope approval | PENDING | [ ] function [ ] schedule [ ] owner [ ] isolation |
| Contract expiry | `processContractExpiryNotifications` | Production only after explicit approval | MUST NOT EXIST currently | [ ] function [ ] schedule [ ] owner [ ] isolation |
| Repair notification | Queue event `tenant_repair`, if separately approved | Production only after scope approval | MUST NOT EXIST currently | [ ] function [ ] schedule [ ] owner [ ] isolation |
| Existing reminder | `runV2AutomaticPaymentReminders` | Production candidate | PENDING HUMAN CONFIRMATION | [ ] function [ ] schedule [ ] owner [ ] isolation |
| Existing paid-bill sync | `syncV1PaidBillsToV2` | Legacy candidate | PENDING HUMAN CONFIRMATION | [ ] function [ ] schedule [ ] owner [ ] isolation |

Trigger acceptance:

- [ ] Every Production trigger has an approved owner, expected schedule/time
      zone, and a documented emergency-stop action.
- [ ] Production triggers contain no staging Property/Sheet/channel/host/LIFF/
      fixture/test/migration/diagnostic reference.
- [ ] Staging triggers contain no Production project/Sheet/Property/channel/
      token/host reference.
- [ ] At most one enabled trigger exists per approved handler/environment.

## 3. Workspace isolation final verification

Perform only with independent, disposable staging Workspaces before approving
the matching Production artifact. Capture route/status/evidence without
personal data or complete identifiers.

| Workspace / principal | Same-Workspace access | Cross-Workspace / cross-role attempt | Expected result | Result |
| --- | --- | --- | --- | --- |
| Workspace A landlord | Authorized A property/contract/bill/limited tenant projection | Read Workspace B or tenant-only route | A access PASS; B/tenant route DENY | [ ] |
| Workspace A tenant | Own home/bills/contract/authorized messages | Read Tenant B/Workspace B or landlord route | Own access PASS; B/landlord route DENY | [ ] |
| Workspace B landlord | Authorized B property/contract/bill/limited tenant projection | Read Workspace A or tenant-only route | B access PASS; A/tenant route DENY | [ ] |
| Workspace B tenant | Own home/bills/contract/authorized messages | Read Tenant A/Workspace A or landlord route | Own access PASS; A/landlord route DENY | [ ] |
| Invalid/expired session | None | Any protected route | DENY before resolver/Sheet access | [ ] |
| Caller-provided alternate IDs | None | Alternate Workspace/tenant/landlord IDs | DENY; server-derived identity wins | [ ] |

Any data projection or metadata returned across Workspace/role boundaries is a
release-blocking failure.

## 4. Migration approval

| Check | Required evidence | Status | Approver |
| --- | --- | --- | --- |
| Backup created | Sheet/export checkpoint, deployment snapshot, trigger/Properties presence snapshot, named restore owner. | [ ] | TBD |
| Schema migration order | Approved additive migration IDs with preflight checks and dependency order. | [ ] | TBD |
| Backward compatibility | Existing routes/payloads and legacy rows continue to work with additive headers. | [ ] | TBD |
| Rollback point | Backend version, frontend revision, schema/migration log, feature-flag stop path. | [ ] | TBD |
| Rollback test evidence | Staging-clone restore/reversal rehearsal completed with redacted results. | [ ] | TBD |
| Notification recovery | Mock queue timeout/stale-processing/dedupe tests pass without real provider call. | [ ] | TBD |

Migration rules: no rename, reorder, delete, or overwrite of existing
Production columns; restore only migration-owned rows after review; disable
feature/trigger before any recovery action.

## 5. Release artifact freeze

| Field | Frozen value | Verification |
| --- | --- | --- |
| Release ID | `RC-TBD` | Assigned only after approval of exact scope. |
| Frontend SHA-256 / revision | `TBD` | Generated from clean isolated Production artifact; second reviewer matches. |
| Backend source SHA-256 / Apps Script version | `TBD` | Exact file manifest reviewed; version assigned only in authorized deploy. |
| Schema migration version | `TBD` | Approved additive migration IDs only. |
| Timestamp | `TBD` | Recorded at immutable artifact freeze. |
| Serving baseline | Historical v74 | Re-confirm immediately before any release action. |
| Backend rollback baseline | Historical v73 | Re-confirm selectable on same Web App deployment. |
| Frontend rollback revision | `TBD` | Prior approved revision/hash is available. |

Freeze acceptance:

- [ ] Candidate comes from a clean isolated tree, not the aggregate dirty
      worktree.
- [ ] Frontend/backend/schema manifests are independently recomputed by two
      reviewers.
- [ ] Artifact excludes `TESTS`, repair/diagnostic/migration/fixture tooling,
      `STAGING_*`, local credentials, test UIDs, mock transports, and
      unapproved lifecycle/financial modules.
- [ ] Candidate passes exact artifact static validation and environment scan.

## 6. Final release gate

### GO

Production release can be approved only when every credential, trigger,
Workspace isolation, migration/rollback, artifact-freeze, and owner row above
is completed with dated sanitized evidence; optional workflows are explicitly
approved or excluded; and named release/backup/rollback owners authorize the
window.

### CONDITIONAL GO

Permits only read-only Production inventory and staging/mock rehearsal. It does
not permit a Production migration, deployment, trigger/Property mutation, queue
write, real LINE message, commit, or push.

### NO-GO — current decision

Production is not approved because the following evidence has not been closed:

#### Resolved blockers

- Current canonical static validation passes: 68 unique routes and 68/68
  handlers, with no duplicate declarations, blocking credentials, or missing
  HTML links.
- Current staging static validation passes: 87 unique routes and 87/87
  handlers, with no duplicate declarations, blocking credentials, or missing
  links.
- Human verification, manifest, and dry-run/rollback procedures are documented.

#### Remaining blockers

1. Serving Production credential/Property/OAuth/LIFF/LINE/Spreadsheet and
   deployment binding evidence is pending.
2. Production trigger inventory, owner, schedule, and environment isolation
   evidence is pending.
3. Clean RC SHA/revision/schema version freeze is pending.
4. Approved schema subset, backup, restore rehearsal, and named recovery owner
   are pending.
5. Notification worker mock-recovery/deduplication and two-Workspace isolation
   evidence is pending.

#### Human approval required

1. Complete all pending checks with masked evidence and record approvers.
2. Approve or exclude each optional notification/lifecycle/repair/financial
   component.
3. Freeze and second-review the exact RC manifests.
4. Confirm rollback availability and authorize a separate release window.

## Validation record

Run `npm run validate`, the staging validator, and `git diff --check` when this
checklist is created. Passing these static checks does not change the current
NO-GO decision or authorize Production modification.
