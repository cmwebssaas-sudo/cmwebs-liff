# Phase 106 — Production Notification Worker Dry Run

Date: 2026-07-23  
Decision: **NO-GO for Production worker activation — isolated dry-run plan
only**

## Scope and hard boundary

This dry-run validates the release process without affecting Production
business records or real users. It does not create Production queue jobs, call
Production LINE Messaging API, enable or alter triggers, change Properties,
write Sheets, deploy, commit, or push.

The only allowed execution boundary is a disposable **staging** queue using a
mock transport that records sanitized outcomes and performs no provider call.
Production serves only as a presence-and-scope inventory target for a human
release owner.

## 1. Production trigger verification

Complete this table from the serving Production Apps Script project using
masked evidence. No full project, deployment, Sheet, token, LIFF, or UID value
may be recorded.

| Trigger name | Handler | Schedule | Project | Environment | Status | Required condition |
| --- | --- | --- | --- | --- | --- | --- |
| Notification queue worker | `processNotificationQueue` | Every 5 minutes only when approved | MASKED / TBD | Production | MUST NOT EXIST currently | Must be one enabled trigger only after schema, feature flag, and recovery approval. |
| Billing event worker | `processBillingLifecycleNotifications` | Daily only when approved | MASKED / TBD | Production | MUST NOT EXIST currently | Must stay absent unless billing lifecycle scope is approved. |
| Contract expiry worker | `processContractExpiryNotifications` | Daily only when approved | MASKED / TBD | Production | MUST NOT EXIST currently | Must stay absent unless contract lifecycle scope is approved. |
| Repair notification worker | Queue worker handling `tenant_repair`, if approved | Same approved queue schedule only | MASKED / TBD | Production | MUST NOT EXIST currently | Repair workflow is out of current V2 scope without explicit approval. |
| Existing payment reminder | `runV2AutomaticPaymentReminders` | Hourly when installed | MASKED / TBD | Production candidate | PENDING HUMAN CONFIRMATION | Verify independently; it is not the queue worker. |
| Existing paid-bill sync | `syncV1PaidBillsToV2` | Every 5 minutes when installed | MASKED / TBD | Legacy candidate | PENDING HUMAN CONFIRMATION | Verify independently; it must not execute staging behavior. |

### Trigger acceptance checks

- [ ] Production project binding and owner are correct for each installed
      trigger.
- [ ] A production trigger cannot resolve staging Script Properties, Sheet,
      host, LIFF endpoint, channel, token, test identity, fixture, or
      `STAGING_*` module.
- [ ] A staging trigger cannot resolve the Production project, Sheet, Property,
      token, or channel.
- [ ] There is no duplicate enabled worker for the same handler/environment.
- [ ] Missing worker triggers are intentional while their feature flags remain
      disabled.

## 2. Isolated dry-run pipeline

### Execution model

```text
disposable staging event
  → feature-gated queue job
  → staging worker claim
  → mock LINE transport
  → sanitized delivery log
```

This is deliberately not:

```text
Production event → Production queue → real LINE recipient
```

### Dry-run controls

| Control | Required behavior | Evidence |
| --- | --- | --- |
| Event source | A disposable staging event uses a synthetic event/receiver reference. | Fixture label only; no Production data or real UID. |
| Queue creation | Creates one feature-gated queue job with event, state, retry metadata, and idempotency key. | Sanitized queue ID/state and dedupe result. |
| Worker pickup | Exactly one worker claims the eligible job. | `pending → processing` timeline and single claim evidence. |
| Mock transport | Returns controlled success, timeout, or failure without `UrlFetchApp` provider delivery. | Mock outcome and no provider-call record. |
| Delivery log | Stores queue linkage, state, retry count, and sanitized result. | Redaction check: no token, ID token, or complete UID. |
| Cleanup | Disposes of only the staging fixture/job under the approved fixture procedure. | Before/after fixture record. |

### Status transition acceptance

| Initial state | Controlled result | Required final transition |
| --- | --- | --- |
| `pending` | Mock success | `pending → processing → sent` |
| `pending` | Mock timeout/failure | `pending → processing → retrying` |
| `retrying` | Later mock success | `retrying → processing → sent` |
| `retrying` | Final allowed failure | `retrying → processing → failed` |
| `processing` | Interrupted/expired lease | `processing → retrying` or `failed`, without duplicate processing claim |

## 3. Recovery test

All tests below use only the isolated staging pipeline and mock transport.
They are preparation evidence, not permission to test Production notifications.

### Scenario A — LINE timeout

1. Create one disposable `pending` job with a unique idempotency key.
2. Let the mock transport return a deterministic timeout.
3. Verify the worker claims the job once and writes a sanitized timeout reason.
4. Verify transition `pending → processing → retrying`, retry count increment,
   and scheduled retry time.
5. On the next eligible attempt, use either a mock success (`sent`) or a final
   allowed mock failure (`failed`).

Expected: **no real LINE delivery, no token exposure, no duplicate queue job**.

### Scenario B — worker interruption

1. Create a disposable job and mark it as a worker-owned `processing` lease in
   the staging test boundary.
2. Simulate the lease exceeding the configured processing timeout without a
   provider response.
3. Run stale-processing recovery once.
4. Verify one deterministic recovery transition to `retrying` or terminal
   `failed`; verify another worker cannot produce a duplicate send.

Expected: **`processing → recovered`, with one queue lineage and no provider
call**.

### Scenario C — duplicate event

1. Submit the same synthetic business-event identity/idempotency key twice.
2. Verify that queue creation returns one queue lineage.
3. Run the mock worker once.
4. Verify one final delivery/log lineage only.

Expected: **idempotency protection; no duplicate job or mock delivery**.

## 4. Production readiness matrix

### PASS

- [x] Canonical repository static validation currently passes: 68 routes and
      68/68 handlers, with zero duplicate top-level declarations and zero
      blocking credential findings.
- [x] Staging release-tree static validation currently passes: 87 routes and
      87/87 handlers, with zero duplicate top-level declarations and zero
      blocking credential findings.
- [x] Phase 106 does not modify Production business data, trigger state,
      properties, deployment, or LINE delivery configuration.

### BLOCKED

- [ ] Serving Production trigger inventory, handler ownership, schedule, and
      environment binding have not been verified with sanitized evidence.
- [ ] The Production notification queue schema, migration version, and feature
      flag state are not approved/frozen.
- [ ] Production worker uniqueness, claim lock, retry, stale recovery,
      idempotency, and sanitized logging have not been proven.
- [ ] Production Messaging channel/token presence/scope and emergency stop
      path are not verified.
- [ ] Business-event scope for billing, repair, contract expiry, and move-out
      is not fully approved for the present V2 release.

### Human action required

1. Capture a masked inventory of the serving Production triggers and complete
   Section 1 without exposing credentials or identifiers.
2. Decide the exact approved event/schema subset; explicitly exclude all other
   staging-only workflows.
3. Run the three mock-transport scenarios in staging and attach sanitized
   state/log evidence.
4. Verify the Production feature flag defaults to disabled and the worker has
   a named owner, emergency-stop process, rollback version, and release owner.
5. Freeze the isolated Production backend/frontend/schema manifests before
   considering any deployment.

## Final decision

**NO-GO for Production notification-worker activation.**

The current allowed next action is only the isolated staging dry run and
read-only Production inventory. No Production queue row, notification log,
business record, trigger, or provider call may be created as part of this
Phase.

## Validation record

The canonical validator, staging validator, and `git diff --check` are run
with this Phase. Passing static validation does not replace the required
sanitized serving-Production trigger evidence or isolated worker recovery
evidence.
