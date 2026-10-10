# Phase 88 — Unified Notification Service

## Scope and safety boundary

Phase 88 introduces a unified LINE notification transport in the isolated
staging release tree only. Canonical production Apps Script, the production Web
App deployment, production frontend, production LIFF configuration, and
production Sheets were not modified.

The staging implementation preserves the existing Phase 87 tenant-message
workflow and its legacy workspace notification and LINE delivery logs.

## Architecture

```text
Business event
  -> workspace notification orchestration
  -> notificationSendLineText_()
  -> deterministic tenant / landlord receiver resolution
  -> LINE Messaging API
  -> V2_notification_logs

Legacy compatibility remains:
  -> V2_workspace_notifications
  -> V2_workspace_notification_deliveries
  -> V2_line_message_logs
```

`notificationSendLineText_()` is the staging transport boundary. The existing
`pushLineTextMessage_()` function remains available to current callers and now
delegates to the notification service, so route names and API payloads do not
change.

## Receiver support and isolation

| Receiver type | Canonical identity | Required isolation |
| --- | --- | --- |
| Tenant | `tenant_id` | active tenant row and matching `workspace_id` |
| Landlord | `landlord_id` | active landlord row, active workspace membership, and matching `workspace_id` |

Pre-resolved internal callers may supply a LINE recipient after their existing
workspace authorization check. The notification log still records the canonical
tenant or landlord identity. Ambiguous or cross-workspace resolution fails
closed; the service does not use first-row-wins behavior.

## Notification log

The staging service creates `V2_notification_logs` when first used. Its fields
are:

- notification log ID and timestamp
- channel
- receiver type and canonical receiver ID
- workspace ID
- masked-at-reporting LINE recipient reference
- source, event type, and reference ID
- message type
- delivery status, success, code, and HTTP status
- error and provider response for failed delivery diagnosis
- non-secret metadata JSON

Successful LINE provider response bodies are intentionally not stored. Channel
access tokens are read from staging Script Properties and never enter source,
the return payload, or the notification log.

## Changed staging files

- `release/staging/apps-script/V2_NOTIFICATION_SERVICE.js` — unified receiver,
  transport, and logging service.
- `release/staging/apps-script/V2_API.js` — legacy LINE push boundary delegates
  to the service.
- `release/staging/apps-script/V2_WORKSPACE_NOTIFICATIONS.js` — workspace team
  deliveries call the service and pass the canonical landlord identity.
- `release/staging/apps-script/V2_TENANT_MESSAGES.js` — tenant-message fallback
  uses the unified landlord transport.
- `release/staging/tests/phase88-notification-service.test.js` — read-isolated
  tenant and landlord receiver tests.

No production source file was changed by this phase.

## Validation results

### Static and isolated tests

- Apps Script syntax: PASS
- Phase 88 notification service tests: PASS
- Tenant receiver resolution: PASS
- Landlord receiver resolution: PASS
- Cross-workspace landlord resolution fails closed: PASS
- Missing channel token fails closed and logs failure: PASS
- Route count: 68 unique
- Handler coverage: 68/68
- Duplicate top-level declarations: 0
- Blocking credentials: 0
- Hardcoded LINE UID: 0
- Staging validation: PASS

### Real staging verification

- Staging Apps Script immutable version: 7
- Existing staging Web App deployment updated: PASS
- Fixture: existing tenant `TSTG086` and landlord `L000001`
- Existing tenant-message route: PASS
- Workspace notification: sent, `sent_count=1`, `failed_count=0`
- Unified receiver: `landlord / L000001 / W000001`
- LINE API result: HTTP 200, `delivery_status=sent`, `code=OK`
- Unified log inserted: PASS
- Successful provider response body retained: NO
- Legacy Phase 87 logs retained: PASS

The landlord path received one real staging notification. The tenant delivery
path was verified by the isolated transport fixture and was not used to send an
extra unsolicited LINE message.

## Known staging-only observation

The `test=1` request path currently reports that the test tenant Script Property
is not configured for this staging project. The real STG086 identity path still
completed the Phase 88 verification. This is an environment fixture issue, not
a notification transport failure, and no production setting was used as a
fallback.

## Risk and rollback

Primary risks are receiver ambiguity and duplicate notification delivery. The
service addresses them with workspace-scoped deterministic resolution and keeps
the existing workspace delivery deduplication boundary.

Rollback is limited to staging:

1. Repoint the existing staging Web App deployment from version 7 to the prior
   staging version.
2. Do not delete the prior immutable staging version.
3. Leave `V2_notification_logs` in place as audit evidence, or archive it only
   after staging review.
4. Do not change production deployment or production properties.

## Production decision

Phase 88 is staging-tested only. Promotion to canonical production requires a
separate release review covering all notification callers, Script Properties,
retry/idempotency behavior, log retention, and rollback. No production
promotion occurred in this phase.
