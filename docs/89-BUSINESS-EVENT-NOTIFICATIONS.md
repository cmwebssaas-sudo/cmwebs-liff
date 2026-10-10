# Phase 89 — Business Event Notification Integration

## Scope

Phase 89 connects the staging-only Phase 88 Notification Service to two real
business event boundaries:

1. newly created bill → tenant LINE notification;
2. tenant repair submission → landlord team LINE notification.

Production Apps Script, production deployment, production frontend, production
LIFF, production Script Properties, and production Sheets were not modified.

## Event mapping

| Business event | Receiver | Canonical identity | Event type | Existing flow retained |
| --- | --- | --- | --- | --- |
| New bill created | tenant | `workspace_id + tenant_id` | `bill_created` | landlord batch notification remains |
| Tenant repair submitted | landlord team | `workspace_id + landlord_id + membership` | `tenant_repair` | tenant message record, workspace notification, delivery log, and Phase 87 LINE log remain |

## Bill-created tenant notification

`generateLandlordBillsByLineUid_()` continues its existing bill generation and
landlord team notification. After successful generation it passes the generated
bill records to `notificationNotifyTenantBillsCreated_()`.

Safety rules:

- only records with `updated_existing !== true` send a creation notification;
- an updated or retried existing bill is recorded as skipped;
- receiver resolution requires the same `workspace_id` and `tenant_id`;
- missing or ambiguous tenant binding fails closed and does not fail bill
  creation;
- notification results are returned in the additive
  `tenant_notifications` summary without changing existing fields;
- the notification contains month, amount, due date, and a prompt to open the
  bill page, but no payment credential or sensitive data.

## Tenant repair landlord notification

The existing `tenant_message_submit` route and handler are unchanged. When the
existing `message_category` is `repair`, the notification event becomes
`tenant_repair` and the source becomes `tenant_repair_form`.

The event reuses:

- the canonical tenant runtime resolver;
- deterministic landlord recipient resolution;
- active workspace membership validation;
- the existing `notify_tenant_message` preference;
- workspace notification and delivery logs;
- the Phase 88 unified LINE transport and `V2_notification_logs`.

General tenant messages remain `tenant_message` and retain their current
behavior.

## Modified staging files

- `release/staging/apps-script/V2_NOTIFICATION_SERVICE.js`
- `release/staging/apps-script/V2_BILLING_MANAGEMENT.js`
- `release/staging/apps-script/V2_TENANT_MESSAGES.js`
- `release/staging/apps-script/V2_WORKSPACE_NOTIFICATIONS.js`
- `release/staging/tests/phase89-business-notifications.test.js`

No canonical production source file was changed in Phase 89.

## Validation

### Isolated tests

- New bill resolves a tenant receiver: PASS
- Bill event metadata and reference ID: PASS
- Existing bill update is skipped: PASS
- Tenant notification batch counters: PASS
- Repair category maps to `tenant_repair`: PASS
- Repair retains `notify_tenant_message`: PASS
- Phase 88 tenant/landlord receiver tests: PASS
- Staging validator: PASS
- Routes: 68 unique
- Handler coverage: 68/68
- Duplicate top-level declarations: 0
- Blocking credentials: 0
- Hardcoded LINE UID: 0

### Real staging repair event

- Staging version: 8
- Existing staging fixture: tenant `TSTG086`, landlord `L000001`, workspace
  `W000001`
- `tenant_message_submit` category: `repair`
- API result: PASS / `OK`
- Workspace event type: `tenant_repair`
- Preference: `notify_tenant_message`
- Recipient count: 1
- Sent count: 1
- Failed count: 0
- Unified receiver: landlord `L000001` in `W000001`
- Unified delivery: sent / HTTP 200 / `OK`
- Workspace notification log: PASS
- Unified notification log: PASS

The staging repair submission created one expected pending tenant-message test
record and sent one staging landlord LINE notification.

### Bill test boundary

The bill-created integration was executed with an isolated request/service
fixture. No real staging bill was generated solely for this verification because
that would alter current staging meter and billing state. A controlled disposable
billing fixture should be used before production promotion to verify the actual
LINE delivery and cleanup together.

## Risks

- Bill generation currently performs its existing notification work before the
  request lock is released. Multiple tenant recipients can increase request
  latency. Phase 89 preserves this behavior rather than redesigning the billing
  transaction boundary.
- Notification failure is non-blocking for bill creation. The returned summary
  and `V2_notification_logs` must be monitored for failed recipients.
- Repair notifications share the existing tenant-message preference so Phase 89
  does not introduce a new settings/schema migration.

## Rollback

1. Repoint only the staging Web App deployment from version 8 to staging version
   7.
2. Do not delete either immutable staging version.
3. Preserve the notification and workspace delivery logs as audit evidence.
4. Do not change production deployment or production properties.

## Production decision

Phase 89 remains staging-only. Production promotion requires a controlled bill
fixture smoke test, release-boundary review, and explicit approval. No production
deployment occurred.
