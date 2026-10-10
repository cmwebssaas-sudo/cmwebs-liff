# Phase 107 — Production Notification Worker Human Verification Package

Date: 2026-07-23  
Decision: **NO-GO until every required human verification item is closed with
sanitized evidence**

## Purpose and safety boundary

This package is for the named Production release owner and reviewer. Its
purpose is to verify whether notification-worker activation could be approved
in a later release window.

It is not authorization to create/enable a trigger, write a Production queue
record, run a worker, call LINE Messaging API, deploy, modify Properties,
commit, or push. Record only existence, scope, ownership, status, and masked
evidence references. Never record a full secret, token, Script ID, deployment
ID, Sheet ID, LIFF ID, URL token, or LINE UID.

## 1. Production trigger checklist

Open the **serving Production Apps Script project** and complete one row per
installed trigger. Do not change trigger state while collecting evidence.

| Trigger name | Handler function | Schedule / timezone | Project evidence | Environment | Owner | Status | Reviewer result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Notification queue worker | `processNotificationQueue` | TBD | MASKED / TBD | Production | MASKED / TBD | MUST NOT EXIST until approved | [ ] verified [ ] absent [ ] blocker |
| Billing notification worker | `processBillingLifecycleNotifications` | TBD | MASKED / TBD | Production | MASKED / TBD | MUST NOT EXIST until approved | [ ] verified [ ] absent [ ] blocker |
| Payment notification pathway | Approved payment event/worker only | TBD | MASKED / TBD | Production | MASKED / TBD | PENDING event-scope approval | [ ] verified [ ] absent [ ] blocker |
| Contract expiry worker | `processContractExpiryNotifications` | TBD | MASKED / TBD | Production | MASKED / TBD | MUST NOT EXIST until approved | [ ] verified [ ] absent [ ] blocker |
| Repair notification pathway | Queue worker event `tenant_repair`, if approved | TBD | MASKED / TBD | Production | MASKED / TBD | MUST NOT EXIST; repair scope unapproved | [ ] verified [ ] absent [ ] blocker |
| Existing automatic payment reminder | `runV2AutomaticPaymentReminders` | TBD | MASKED / TBD | Production candidate | MASKED / TBD | PENDING HUMAN CONFIRMATION | [ ] verified [ ] absent [ ] blocker |
| Existing legacy paid-bill sync | `syncV1PaidBillsToV2` | TBD | MASKED / TBD | Legacy candidate | MASKED / TBD | PENDING HUMAN CONFIRMATION | [ ] verified [ ] absent [ ] blocker |

Required reviewer confirmations:

- [ ] No installed Production trigger points to staging configuration, test
      identity, fixture, `STAGING_*`, diagnostics, repair, migration, or
      unapproved legacy code.
- [ ] No staging trigger points to the Production Apps Script project, Sheet,
      Property, LINE channel, token, LIFF origin, or host.
- [ ] At most one enabled trigger exists for each approved handler and
      environment.
- [ ] Trigger owner is an approved Production account and is available for
      incident response/rollback.
- [ ] A missing notification trigger is intentional while its feature flag is
      disabled; absence is not treated as a defect before approval.

## 2. Production credential verification

Verify only **existence and matching**. Do not open/copy/export secret values.

| Item | Human verification | Expected result | Result |
| --- | --- | --- | --- |
| LINE Login channel | Channel is Production-owned; server verifier audience/callback scope matches approved Production frontend. | Separate from staging. | [ ] pass [ ] fail [ ] pending |
| Tenant LIFF ID | LIFF is in the Production channel and endpoint origin is the approved tenant host. | No staging origin/fallback. | [ ] pass [ ] fail [ ] pending |
| Landlord LIFF ID | LIFF is in the Production channel and endpoint origin is the approved landlord host. | No staging origin/fallback. | [ ] pass [ ] fail [ ] pending |
| Messaging API channel | Production channel/account and push scope are approved. | Separate from staging. | [ ] pass [ ] fail [ ] pending |
| Messaging access token | Property exists, is non-empty, has rotation owner/date, and is used only in the serving Production project. | Never reveal value. | [ ] pass [ ] fail [ ] pending |
| Apps Script binding | Production Web App deployment belongs to the approved serving script project. | Masked binding comparison matches. | [ ] pass [ ] fail [ ] pending |
| Spreadsheet binding | `CMWEBS_SPREADSHEET_ID` exists and resolves to the approved Production Sheet. | Presence/ownership only. | [ ] pass [ ] fail [ ] pending |
| Environment marker | `CMWEBS_ENVIRONMENT` identifies Production. | No staging environment leakage. | [ ] pass [ ] fail [ ] pending |
| Notification guard | `CMWEBS_FEATURE_NOTIFICATION_QUEUE` is disabled until the complete gate is approved. | Fail closed. | [ ] pass [ ] fail [ ] pending |

Document each result with a dated screenshot or console export that masks all
identifiers and values. A screenshot must show neither tokens nor full IDs.

## 3. Worker recovery verification plan

Run this plan only against a disposable **staging** queue and mock transport.
It must not create a Production queue/log record or send a real LINE message.

### Scenario A — queue stuck in `processing`

1. Create a disposable staging queue fixture with a unique idempotency key.
2. Simulate an expired `processing` lease without making a provider call.
3. Invoke the staging stale-recovery path once.
4. Verify `processing → retrying` or terminal `failed` according to bounded
   retry policy.
5. Verify a second worker cannot claim/deliver the same job concurrently.

Expected: **one recovered/failed lineage; no real delivery; sanitized log**.

### Scenario B — LINE API timeout

1. Use mock transport to return deterministic timeout.
2. Verify `pending → processing → retrying`.
3. Verify retry count increments once and `next_retry_at` follows the approved
   schedule (first retry after 5 minutes, second after 30 minutes).
4. Complete with mock success (`sent`) or controlled final failure (`failed`).

Expected: **retry mechanism works; no token/UID leakage; no provider call**.

### Scenario C — duplicate event

1. Submit the same synthetic event identity/idempotency key twice.
2. Verify one queue job and one log/delivery lineage only.
3. Verify terminal state is recorded once.

Expected: **idempotency protection prevents duplicate notification**.

## 4. Workspace isolation verification

Use two independently authenticated, disposable staging Workspaces. Do not use
Production people or business records.

| Principal | Attempt | Required result | Evidence |
| --- | --- | --- | --- |
| Workspace A landlord | Read authorized A Workspace data | Allow only permitted A-scoped data. | Route/status only; masked fixture labels. |
| Workspace A landlord | Read Workspace B data | Deny closed before projection; no B metadata. | Route/status only. |
| Workspace A tenant | Read own portal routes | Allow only own canonical tenant identity chain. | Route/status only. |
| Workspace A tenant | Call landlord API | Deny by RBAC before data access. | Route/status only. |
| Workspace A tenant | Read Tenant B or Workspace B data | Deny closed; no fallback lookup. | Route/status only. |
| Workspace B landlord | Read Workspace A data | Deny closed; no A metadata. | Route/status only. |
| Any authenticated role | Send caller-supplied alternate Workspace/tenant/landlord ID | Server-derived identity wins; request denied. | Route/status only. |
| Invalid/expired auth | Any role route | Deny before tenant/landlord resolver and Sheet access. | Route/status only. |

## 5. Final GO / NO-GO matrix

### READY

Mark READY only after all statements below have attached sanitized evidence:

- [ ] Serving Production trigger inventory is complete, correctly owned, and
      free of duplicate/unapproved targets.
- [ ] Production/staging resource separation is confirmed for Apps Script,
      Sheet, Properties, LINE Login, LIFF, and Messaging channel.
- [ ] Feature flag is disabled by default and has a documented emergency stop.
- [ ] Notification queue schema/version, isolated release SHA, and rollback
      version are approved.
- [ ] Staging mock recovery scenarios A–C pass with sanitized evidence.
- [ ] Two-Workspace / cross-role isolation matrix passes.
- [ ] Named release, trigger, backup, rollback, and incident-response owners
      approve the release window.

### BLOCKED

- [ ] Any trigger/owner/schedule/environment evidence is unavailable or
      inconsistent.
- [ ] Production credential/Property/LIFF/LINE matching has not been verified.
- [ ] A trigger would invoke unapproved staging, test, repair, migration, or
      lifecycle behavior.
- [ ] Worker recovery/deduplication is not proven with mock transport.
- [ ] Workspace isolation or RBAC has any cross-role/cross-Workspace failure.
- [ ] Artifact SHA, schema approval, backup checkpoint, or rollback target is
      missing.

### Human action required

1. Complete Sections 1 and 2 from the serving Production consoles without
   disclosing identifiers or secret values.
2. Run the Section 3 mock-only recovery exercises in staging and attach
   redacted state/log evidence.
3. Complete the Section 4 two-Workspace matrix with disposable fixtures.
4. Freeze approved backend/frontend/schema artifacts, verify their hashes with
   a second reviewer, and name the rollback owner.
5. Re-evaluate this matrix. Only then may a separate, explicitly authorized
   release phase consider Production activation.

## Final decision

**NO-GO.** Phase 107 delivers the human verification process only. Production
remains untouched: no trigger change, queue write, provider call, deployment,
commit, or push is authorized.

## Validation record

Run the canonical validator, staging validator, and `git diff --check` after
this document is created. Their pass state confirms static integrity only; it
does not replace human verification of the serving Production environment.
