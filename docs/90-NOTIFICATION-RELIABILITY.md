# Phase 90 — Notification Reliability

## Scope

Phase 90 upgrades the staging Notification Service to a durable queue and
worker model. It preserves the Phase 87, 88, and 89 public function boundary and
existing LINE, workspace notification, delivery, and audit flows.

Production source, deployment, Script Properties, Sheets, frontend, and LINE
configuration were not modified.

## Runtime architecture

```text
Business event
  -> notificationSendLineText_() compatibility boundary
  -> create idempotent notification job
  -> V2_NOTIFICATION_QUEUE (pending)
  -> notification worker (processing)
  -> LINE Messaging API
  -> sent OR retrying OR failed
  -> V2_notification_logs attempt record
```

The compatibility boundary immediately invokes the worker once, preserving the
successful synchronous behavior expected by Phase 87–89 callers. Failed jobs
remain durable for the five-minute worker trigger.

## Queue schema

Sheet: `V2_NOTIFICATION_QUEUE`

| Column | Purpose |
| --- | --- |
| `id` | Queue job ID |
| `dedupe_key` | Stable business-event idempotency key |
| `event_type` | Business event type |
| `receiver_type` | `tenant`, `landlord`, or legacy `direct` |
| `receiver_id` | Canonical tenant/landlord receiver ID |
| `workspace_id` | Workspace isolation key |
| `reference_id` | Bill, message, or notification reference |
| `template_key` | Optional registered template |
| `payload` | Rendered content, variables, safe metadata, and required delivery context |
| `status` | `pending`, `processing`, `sent`, `failed`, or `retrying` |
| `retry_count` | Number of failed attempts |
| `next_retry_at` | Next eligible retry time |
| `created_at` | Creation time |
| `updated_at` | Last state update |
| `processing_at` | Worker claim time |
| `sent_at` | Successful delivery time |
| `last_error` | Latest failure reason |
| `last_code` | Latest service/provider result code |
| `last_http_status` | Latest LINE HTTP status |

## Retry policy

| Failed attempt | Queue state | Retry count | Next action |
| --- | --- | --- | --- |
| First | `retrying` | 1 | retry after 5 minutes |
| Second | `retrying` | 2 | retry after 30 minutes |
| Third | `failed` | 3 | terminal; no automatic retry |

The worker claims a job as `processing` under a DocumentLock, releases the lock
before the network request, and writes the final state under the lock. This
avoids nested ScriptLock behavior in billing and notification callers.

## Idempotency

Stable jobs use:

```text
event_type
+ receiver_type
+ receiver_id
+ workspace_id
+ reference_id
+ membership/user key when applicable
```

Re-executing the same event returns the existing job. A sent event is not sent
again. A pending/retrying event is not duplicated and is not falsely reported as
already delivered.

## Templates

Module: `V2_NOTIFICATION_TEMPLATES.js`

| Template key | Current integration/readiness |
| --- | --- |
| `bill_created` | Used by the Phase 89 new-bill tenant notification |
| `tenant_repair` | Available for repair notification rendering |
| `payment_confirmed` | Registered for future business-event integration |
| `contract_expiring` | Registered for future business-event integration |

Templates declare `template_key`, `title`, `body`, and required `variables`.
Missing variables fail closed before a queue job is created.

## Notification log migration

Existing Sheet: `V2_notification_logs`

Added columns:

- `queue_id`
- `retry_count`

Existing `error_message` and `provider_response` columns remain. Failed attempts
retain a bounded provider response for diagnosis; successful attempts do not
store provider response bodies. Retry counts are synchronized after each failed
attempt.

LINE channel tokens, authorization values, passwords, secrets, credentials, and
private keys are redacted from metadata. LINE UID values are masked in the
unified log. The queue stores only delivery data needed by the worker and never
stores the LINE channel token.

## Staging migration

Function: `migrateStagingNotificationReliability()`

Migration behavior:

1. verifies `CMWEBS_ENVIRONMENT` resolves to `staging`;
2. creates or extends `V2_NOTIFICATION_QUEUE`;
3. extends `V2_notification_logs` without deleting old rows;
4. installs exactly one time-driven `processNotificationQueue` trigger;
5. is safe to execute again without creating duplicate triggers.

Staging migration result:

- Queue Sheet created/verified: PASS
- Log columns extended: PASS
- Five-minute worker trigger: PASS, exactly one trigger
- Production migration: NOT RUN

## Tests

### Scenario A — LINE succeeds

- Queue transition: `pending -> processing -> sent`
- Retry count: 0
- `sent_at`: recorded
- LINE transport calls: 1
- Result: PASS

### Scenario B — LINE API fails once

- Failure reason: recorded
- Retry count: 1
- Queue state: `retrying`
- `next_retry_at`: approximately 5 minutes
- Result: PASS

### Scenario C — third failure

- First retry delay: 5 minutes
- Second retry delay: 30 minutes
- Third failed attempt: terminal `failed`
- Retry counts in queue/log: 1, 2, 3
- Result: PASS

### Scenario D — duplicate business event

- Queue rows created: 1
- LINE calls: 1
- Second result: existing/duplicate job
- Result: PASS

### Regression and static validation

- Phase 88 notification tests: PASS
- Phase 89 business-event tests: PASS
- Phase 90 reliability tests: PASS
- Staging Apps Script files: 36
- Routes: 68 unique
- Handler coverage: 68/68
- Duplicate top-level declarations: 0
- Blocking credentials: 0
- Hardcoded LINE UID: 0
- Staging validator: PASS

## Real staging verification

- Immutable staging version: 9
- Existing staging Web App deployment updated: PASS
- Real event: STG086 tenant repair notification
- Workspace event: `tenant_repair`
- Queue row: `sent`, retry count 0, `sent_at` present
- LINE delivery: HTTP 200
- Landlord notification: sent 1 / failed 0
- Unified log: queue ID present, UID masked, token absent
- Worker trigger: visible and enabled in the staging Apps Script project

Failure and third-attempt scenarios were executed against isolated LINE mocks;
the staging access token was not intentionally broken and no retrying poison job
was left in the live staging queue.

## Modified files

- `release/staging/apps-script/V2_NOTIFICATION_QUEUE.js`
- `release/staging/apps-script/V2_NOTIFICATION_TEMPLATES.js`
- `release/staging/apps-script/V2_NOTIFICATION_SERVICE.js`
- `release/staging/tests/phase88-notification-service.test.js`
- `release/staging/tests/phase89-business-notifications.test.js`
- `release/staging/tests/phase90-notification-reliability.test.js`
- `docs/90-NOTIFICATION-RELIABILITY.md`

## Rollback

1. Repoint only the staging Web App from version 9 to version 8.
2. Disable the staging `processNotificationQueue` trigger before rollback.
3. Preserve queue and log Sheets as audit evidence.
4. Do not delete immutable versions or change production resources.

## Production decision

Phase 90 is staging-only. Production promotion requires a separate review of
queue retention, monitoring/alerts, dead-letter handling, quota behavior,
trigger ownership, and operational recovery. Production remains untouched.
