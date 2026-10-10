# Phase 113 — Production Trigger & Worker Verification

Date: 2026-07-23  
Decision: **NO-GO — Production trigger/worker evidence remains pending**

## Scope and safety boundary

This document is a verification package, not permission to activate a worker.
It does not inspect by modifying the serving Production project: no deployment,
Sheet/Property/token change, trigger change, queue write, LINE send, commit,
or push occurs in this Phase.

Production evidence must be captured as dated, masked, read-only console
records. Queue/retry recovery is proven only with disposable staging data and
mock transport. No secret, token, full identifier, or full LINE UID may be
recorded.

## 1. Production trigger inventory

An event is not necessarily an installable trigger. `bill_created`,
`payment_confirmed`, `tenant_repair`, and `contract_expiring` are business
events; if approved, they enqueue a job and are processed by one queue worker.
They must not each create duplicate, overlapping worker triggers.

| Trigger / event | Handler | Queue | Environment | Status | Required evidence |
| --- | --- | --- | --- | --- | --- |
| `bill_created` | Approved billing event handler; worker only if queue feature approved | `V2_NOTIFICATION_QUEUE` candidate | Production only after explicit approval | BLOCKED | Event owner, idempotency policy, queue schema/flag, and one worker inventory. |
| `payment_confirmed` | Approved payment confirmation event handler | `V2_NOTIFICATION_QUEUE` candidate | Production only after explicit approval | BLOCKED | Event owner, idempotency policy, queue schema/flag, and one worker inventory. |
| `tenant_repair` | Approved repair event handler | `V2_NOTIFICATION_QUEUE` candidate | Out of current V2 scope unless explicitly approved | BLOCKED | Repair scope approval, recipient isolation, queue/worker proof. |
| `contract_expiring` | `processContractExpiryNotifications` may enqueue jobs if approved | `V2_NOTIFICATION_QUEUE` candidate | Production only after explicit approval | BLOCKED | Lifecycle scope approval, schedule/owner, queue/worker proof. |
| Notification queue worker | `processNotificationQueue` | Reads eligible queue jobs | Production only after all gates close | MUST NOT EXIST currently | Masked trigger function/schedule/owner/project/environment evidence. |
| Billing lifecycle worker | `processBillingLifecycleNotifications` | May enqueue billing lifecycle events | Production only after lifecycle approval | MUST NOT EXIST currently | Masked trigger function/schedule/owner/project/environment evidence. |
| Existing payment reminder | `runV2AutomaticPaymentReminders` | Existing reminder path; not queue worker by default | Production candidate | PENDING HUMAN CONFIRMATION | Actual trigger inventory and no staging/resource crossover. |

Verification checklist:

- [ ] Every installed trigger has one approved owner, expected schedule/time
      zone, environment marker, and emergency-stop procedure.
- [ ] At most one enabled queue worker exists in each environment.
- [ ] No event handler directly sends a LINE message after queue architecture
      approval; it only creates an idempotent queue job.
- [ ] No Production trigger targets `TESTS`, diagnostics, fixtures, migration,
      repair admin tooling, `STAGING_*`, or unapproved lifecycle modules.
- [ ] No staging trigger targets Production Apps Script/Sheet/Properties/LINE
      channel/token/frontend origin.

## 2. Notification worker flow

```text
approved business event
  ↓
create idempotent queue job
  ↓
single eligible worker claim
  ↓
verified LINE transport
  ↓
sanitized delivery log + terminal/retry state
```

| Stage | Required control | Production verification state |
| --- | --- | --- |
| Event | Server-authorized event/Workspace/recipient resolution; dedupe key. | BLOCKED — event scope and source review pending. |
| Queue | Additive schema, `pending` initial state, receiver reference, retry data, timestamps. | BLOCKED — schema/feature flag approval pending. |
| Worker | One trigger/owner, atomic claim, bounded execution/lease handling. | BLOCKED — trigger evidence pending. |
| LINE transport | Production Messaging channel/token presence and receiver isolation; no token logging. | BLOCKED — credential/scope evidence pending. |
| Delivery log | Queue linkage, state, retry count, sanitized provider result/error. | BLOCKED — remote mock/recovery evidence pending. |

Expected state model:

```text
pending → processing → sent
                    ↘ retrying → processing
                    ↘ failed
```

## 3. Recovery verification

Run each exercise in a disposable staging queue with mock transport only.
Never create a Production job, invoke a Production worker, or call real LINE
transport.

| Verification | Procedure | Required final state/evidence | Status |
| --- | --- | --- | --- |
| Retry | Mock a timeout/failure once. | `pending → processing → retrying`; retry count increments once; first wait 5m, second 30m. | PENDING |
| Failed | Exhaust the bounded retry limit. | Terminal `failed`, sanitized error, and no fourth provider attempt. | PENDING |
| Stale processing recovery | Simulate expired `processing` lease and invoke recovery once. | One recovery to `retrying`/`failed`; no duplicate claim/delivery. | PENDING |
| Final transition | Mock failure then mock success. | One `sent` state/delivery lineage only. | PENDING |
| Duplicate prevention | Submit same synthetic event/idempotency key twice. | One queue and one log/delivery lineage only. | PENDING |

All artifacts must prove mock transport was used, `UrlFetchApp` provider
transport was not called, and no sensitive value was written to logs.

## 4. Isolation verification

### Environment isolation

| Boundary | Required result | Status |
| --- | --- | --- |
| Production queue vs staging queue | Different project-bound storage/schema data; no shared queue job/log access. | PENDING HUMAN CONFIRMATION |
| Production LINE channel vs staging LINE channel | Different account/channel/token configuration; never cross-used. | PENDING HUMAN CONFIRMATION |
| Production Properties vs staging Properties | Separate Script projects/property stores; values never copied into Git. | PENDING HUMAN CONFIRMATION |
| Production triggers vs staging triggers | Separate owners/functions/project bindings; no cross-environment execution. | PENDING HUMAN CONFIRMATION |

### Tenant/landlord Workspace isolation

| Principal | Same-Workspace expectation | Cross-Workspace / role expectation | Result |
| --- | --- | --- | --- |
| Workspace A landlord | Authorized A projection only. | Workspace B and tenant-only routes DENY. | PENDING |
| Workspace A tenant | Own portal projection only. | Tenant B/Workspace B and landlord routes DENY. | PENDING |
| Workspace B landlord | Authorized B projection only. | Workspace A and tenant-only routes DENY. | PENDING |
| Workspace B tenant | Own portal projection only. | Tenant A/Workspace A and landlord routes DENY. | PENDING |
| Invalid/expired auth | No data access. | Deny before resolver/Sheet access. | PENDING |

## 5. Human action checklist

1. In serving Production Apps Script, collect a masked trigger inventory:
   handler, schedule/time zone, enabled state, owner, environment assertion,
   and emergency-stop mechanism.
2. Verify Apps Script project/deployment binding, LINE Login, LIFF, Messaging
   channel, token-property presence, OAuth scopes, Spreadsheet binding, and
   relevant feature flags by presence/scope only.
3. Confirm Production/staging queue, channel, Properties, triggers, and
   frontends are isolated.
4. Approve or exclude each business event and associated schema/module before
   enabling a queue worker.
5. Run mock retry/failed/stale/dedupe recovery tests and two-Workspace tests in
   staging; attach sanitized evidence.
6. Freeze a clean RC source/hash/schema manifest, backup point, and rollback
   owner; obtain explicit future release authorization.

## 6. Release gate update

### GO

Only after all event/trigger/queue/worker/transport/log controls are approved
and evidenced; environment and Workspace isolation pass; RC/backup/rollback
are frozen; and named owners sign off.

### CONDITIONAL GO

Read-only Production inventory and staging/mock recovery/isolation validation
only. It does not authorize a Production queue write, worker trigger,
deployment, Property change, or real LINE push.

### NO-GO — current decision

The Production notification worker must remain absent/disabled. Missing
evidence includes serving trigger inventory, Production credential/channel and
Property scope, queue schema/feature approval, mock recovery results,
Production/staging isolation, Workspace isolation, RC hash freeze, and named
release/rollback authorization.

## Validation record

Run `npm run validate`, staging validator, and `git diff --check` with this
Phase. Passing static checks is not proof that a serving Production trigger or
worker is safe to activate.
