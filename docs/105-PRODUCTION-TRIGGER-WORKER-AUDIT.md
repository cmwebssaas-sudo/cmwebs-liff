# Phase 105 — Production Trigger & Worker Readiness Audit

Date: 2026-07-23  
Decision: **BLOCKED — Production trigger and notification-worker evidence is
not available in the current workspace**

## Scope and evidence policy

This audit is read-only and planning-only. It does not inspect or change the
serving Production Apps Script project, create/delete triggers, run workers,
write Sheets, send LINE messages, deploy, commit, or push.

Staging source and historical documentation can prove intended behavior, but
cannot prove a Production trigger exists, is owned by the right account, or is
bound to the right environment. Every missing serving-Production record below
is therefore **BLOCKED**, not assumed.

## 1. Production trigger inventory

### Required serving-project inventory

| Trigger name | Function handler | Schedule | Environment | Purpose | Owner | Evidence status |
| --- | --- | --- | --- | --- | --- | --- |
| Automatic payment reminder | `runV2AutomaticPaymentReminders` | Hourly when installed | Production candidate | Reminder workflow under existing settings rules. | MASKED / TBD | NEEDS HUMAN ACTION |
| V1 paid-bill sync | `syncV1PaidBillsToV2` | Every 5 minutes when installed | Legacy candidate | Legacy paid-bill synchronization. | MASKED / TBD | NEEDS HUMAN ACTION |
| Notification queue worker | `processNotificationQueue` | Every 5 minutes only when approved | Staging migration candidate | Claim/deliver/retry queued notifications. | N/A | MUST NOT EXIST in Production until approved |
| Contract-expiry worker | `processContractExpiryNotifications` | Daily only when approved | Staging lifecycle candidate | Queue contract-expiry events. | N/A | MUST NOT EXIST in Production until approved |
| Billing-lifecycle worker | `processBillingLifecycleNotifications` | Daily only when approved | Staging lifecycle candidate | Queue billing lifecycle events. | N/A | MUST NOT EXIST in Production until approved |

### Inventory completion procedure

The Production release owner must open the **serving** Apps Script project and
capture, for each installed trigger, a sanitized record of:

1. Trigger/function name.
2. Event type, frequency, time zone, enabled status, and owner account.
3. Environment binding by key name only (`CMWEBS_ENVIRONMENT`, spreadsheet,
   feature flags, and LINE configuration presence).
4. Whether the function can write data, enqueue work, or call a provider.

The record must not include full Script IDs, deployment IDs, Sheet IDs, tokens,
LIFF IDs, or LINE UIDs.

### Isolation, duplicates, and omissions

| Audit check | Required result | Current status |
| --- | --- | --- |
| Staging trigger isolation | No staging trigger uses a Production Script project, Sheet, Property, LINE channel, or token. | BLOCKED — remote evidence required. |
| Production trigger isolation | No Production trigger references staging host, LIFF, fixture, test UID, `STAGING_*`, repair, migration, or diagnostic code. | BLOCKED — remote evidence required. |
| Duplicate trigger check | At most one enabled trigger for each approved worker function/environment. | BLOCKED — remote evidence required. |
| Missing trigger check | Existing production functions have an intentional installation state; approved worker has exactly one trigger only after enablement. | BLOCKED — remote evidence required. |
| Owner check | Owner is approved for the corresponding Production environment and available for recovery. | BLOCKED — remote evidence required. |

## 2. Notification worker audit

### Queue contract

The staging queue design is an additive, feature-gated candidate. It is not a
Production commitment until its schema, release artifact, and owner are
approved.

| Queue control | Required behavior | Production readiness |
| --- | --- | --- |
| Schema | Queue stores event type, receiver identity reference, payload, state, retry count, next retry, timestamps, and sanitized provider outcome. | BLOCKED — approved schema/version absent. |
| State lifecycle | `pending → processing → sent`; provider failure uses `retrying`, terminal exhaustion uses `failed`. | Staging design; Production proof pending. |
| Idempotency | Same business event/idempotency key produces one queue lineage. | Staging proof required. |
| Sanitization | Logs never contain LINE token, ID token, complete UID, or other credential. | Staging design; Production evidence pending. |
| Feature gate | Queue is disabled until schema, worker trigger, and recovery proof all pass. | Required before Production use. |

### Worker execution flow

```text
business event
  → create deduplicated queue job
  → eligible worker claims one job (pending → processing)
  → provider call
  → sent | retrying | failed
  → sanitized log and durable state update
```

| Worker control | Required behavior | Current status |
| --- | --- | --- |
| Trigger | One approved, environment-bound trigger with a masked owner record. | BLOCKED |
| Claim | Atomic/single claim with no concurrent duplicate delivery. | Staging design; remote proof required. |
| Provider failure | Failure reason is sanitized; retry count and `next_retry_at` change once. | Staging design; remote proof required. |
| Stale `processing` recovery | Expired lease returns once to retry or terminal failure with no duplicate send. | Staging design; remote proof required. |
| Emergency stop | Feature flag/trigger can stop new sends while preserving queue evidence. | BLOCKED — production configuration confirmation required. |

## 3. Recovery test plan

Run these only with disposable staging queue data and an approved test-provider
boundary. Do not use a Production recipient, Production token, or normal user
event as a test fixture.

| Scenario | Setup | Expected result | Evidence |
| --- | --- | --- | --- |
| Failed-send recovery | Controlled provider failure on an eligible `pending` job. | `processing → retrying`; retry count increments once and next retry is scheduled. | Sanitized queue/log lineage, no secret or UID. |
| Stale-processing recovery | Simulate expired `processing` lease without completing provider call. | One recovery to `retrying` or `failed`; duplicate worker claim prevented. | Before/after state, worker owner/time, no duplicate provider call. |
| Retry exhaustion | Cause three controlled delivery failures. | First retry after 5 minutes; second after 30 minutes; third becomes terminal `failed`; no fourth call. | Retry counter/timestamps and sanitized final error. |
| Success after retry | Controlled failure followed by safe success. | Single `sent` state and single delivery lineage. | Sanitized provider/status record. |
| Duplicate event | Enqueue same event/idempotency key twice. | One queue job/delivery lineage only. | Deduplication evidence. |

## 4. Business-event coverage

The following map distinguishes the staging design from an approved Production
release. An event is **not** Production-enabled merely because a module exists
in staging.

| Event | Intended receiver | Queue/template requirement | Production status |
| --- | --- | --- | --- |
| `bill_created` | Tenant | Bill-created template, canonical tenant resolver, idempotency key. | BLOCKED — optional billing/queue scope unapproved. |
| `payment_due` | Tenant | Due-date template, time-zone/Workspace rule, dedupe. | BLOCKED — optional billing/queue scope unapproved. |
| `payment_confirmed` | Tenant | Confirmed-payment template and approved payment event boundary. | BLOCKED — optional billing/queue scope unapproved. |
| `tenant_repair` | Landlord | Repair ticket/workspace resolver and landlord recipient isolation. | BLOCKED — repair is outside current V2 scope unless approved. |
| `contract_expiring` | Tenant and/or authorized landlord | Contract lifecycle data, schedule, template, dedupe. | BLOCKED — lifecycle scope/trigger unapproved. |
| `move_out` | Tenant and/or authorized landlord | Move-out/settlement ledger, authorization, financial rollback controls. | BLOCKED — settlement is outside current V2 scope unless approved. |

## 5. Production safety checklist

### PASS

- [x] Canonical repository static validator currently passes: 68 unique routes,
      68/68 handlers, zero duplicate declarations, zero blocking credential
      findings, and zero missing HTML links.
- [x] Staging release-tree static validator currently passes: 87 unique routes,
      87/87 handlers, zero duplicate declarations, and zero blocking credential
      findings.
- [x] This Phase has not modified Production, deployed, committed, or pushed.

### BLOCKED

- [ ] Serving Production trigger list, enabled state, schedule, ownership, and
      environment binding have not been captured with sanitized evidence.
- [ ] Production queue schema/version and notification feature-flag approval
      have not been granted.
- [ ] Worker trigger uniqueness, remote claim behavior, retry behavior, stale
      recovery, and dedupe have not been proven on a safe boundary.
- [ ] Production LINE channel/token presence/scope and emergency-stop path are
      not verified.
- [ ] Optional billing, repair, lifecycle, and settlement event scopes are not
      all approved for the present V2 Production release.

### NEEDS HUMAN ACTION

1. Export the serving Production trigger inventory using masked identifiers and
   complete the table in Section 1.
2. Verify all Production/ staging resource separation and feature-flag states
   by key name only.
3. Approve the exact notification schema and event subset, or explicitly
   exclude it from this release.
4. Run the Section 3 recovery plan in staging and attach sanitized evidence.
5. Freeze the isolated Production artifact SHA, deployment version, rollback
   version, and named owners before enabling any worker.

## Final decision

**NO-GO for Production notification-worker enablement.**

Only the read-only inventory/review path is conditionally allowed. A trigger
or notification worker must not be created, enabled, or modified in Production
until every BLOCKED item has a dated, sanitized, human-reviewed resolution.

## Validation record

The canonical validator, staging validator, and `git diff --check` are run
with this Phase. Their results validate repository/artifact static integrity;
they are not evidence of a live Production trigger or worker.
