# Phase 95 — V2 Production Readiness Audit

## Executive decision

**Deployment readiness: NOT READY / NO-GO**

Phase 90–94 的 staging modules 與 isolated tests 已形成完整的 Notification、Repair、Lease、Billing、Move-out / Deposit Settlement 功能鏈，但目前不可直接 promotion 到 Production。Production 本輪完全未修改。

本次 audit 只執行：

- repository 與 staging release tree 靜態分析；
- staging Spreadsheet bounded read-only inspection；
- local isolated fixtures/tests；
- validator、route/handler 與 diff 檢查。

沒有建立真實退租、帳單、付款、報修或結算資料；沒有發送 LINE；沒有執行 production push/deploy；沒有修改 Production Spreadsheet。

## Audit baseline

| Boundary | Result |
|---|---|
| Production canonical validator | PASS — 34 Apps Script files, 44 HTML files, 68 unique routes, 68/68 handlers |
| Staging validator | PASS — 42 Apps Script files, 6 HTML files, 87 unique routes, 87/87 handlers |
| Phase 88–94 isolated tests | PASS |
| Credential scan | PASS — blocking 0, hardcoded LINE UID 0 |
| `git diff --check` | PASS |
| Production deployment/source/data changes in Phase 95 | 0 |

The full staging test directory is not green: `phase83a3-url-isolation.test.js` expects a reproducible `release/staging/hosting/public/` artifact, but that directory is absent locally. Phase 88–94 tests were therefore also run separately and all passed.

## 1. Data integrity audit

### Read-only staging data inventory

| Sheet | Data rows inspected | Integrity result |
|---|---:|---|
| `V2_users` | 4 | PASS |
| `V2_workspaces` | 2 | PASS |
| `V2_workspace_members` | 2 | PASS |
| `V2_properties` | 2 | PASS |
| `V2_rooms` | 2 | PASS |
| `V2_tenants` | 2 | PASS |
| `V2_contracts` | 2 | PASS |
| `V2_bills` | 0 | Schema present; persisted lifecycle case not exercised |
| `V2_payments` | 0 | Schema present; persisted lifecycle case not exercised |
| `V2_REPAIR_TICKETS` | 1 | PASS |
| `V2_MOVE_OUT_REQUESTS` | 0 | Schema present; persisted lifecycle case not exercised |
| `V2_DEPOSIT_SETTLEMENTS` | 0 | Schema present; persisted lifecycle case not exercised |

Checks performed across populated rows:

- duplicate canonical keys;
- missing/orphan `workspace_id`, `tenant_id`, `contract_id`, `property_id`, `room_id`, `bill_id`, `request_id`, and `settlement_id` references where applicable;
- cross-row Workspace mismatch;
- contract-to-tenant mismatch;
- payment-to-bill mismatch;
- settlement-to-move-out-request mismatch.

Result: **0 detected integrity mismatches** in the bounded staging data set.

### Integrity limitations and blockers

1. No persisted staging bill, payment, move-out request, or deposit settlement currently exists. Their correctness is proven only by isolated fixtures, not by a real staging transaction followed by read-only reconciliation.
2. `generateContractMonthlyBillByLineUid_`, repair creation, and Phase 94 request/settlement creation use check-then-append flows without one shared transaction lock. Concurrent duplicate requests can pass the pre-check before either append is visible.
3. Phase 94 inspection completion updates settlement, repair-ticket deduction fields, request status, and notification references across multiple rows without a compensating transaction. A mid-operation failure can leave partial state.
4. Refund confirmation terminates the contract before all settlement/request/queue updates finish. A later failure can leave a terminated contract with an incompletely recorded refund workflow.

## 2. Workspace isolation audit

### Confirmed controls

- Tenant write/read flows resolve a canonical tenant identity and carry `workspace_id` through the tenant → contract → property → room chain.
- Landlord readers resolve the active Workspace using `workspaceLandlordResolveAccess_()`.
- Contract, bill, payment, repair, move-out and settlement lookups include Workspace filters.
- Cross-Workspace fixture tests in Phase 91–94 pass.
- The read-only staging relation audit found 0 Workspace mismatches.
- Notification tenant and landlord receiver resolution validates the requested Workspace and fails closed on zero or multiple matches.

### Remaining risks

- Workspace isolation depends on the supplied LINE UID being authentic. The Web App dispatcher accepts `line_user_id` from query parameters and does not verify a LIFF ID token/access token server-side.
- `workspaceLandlordResolveAccess_()` confirms active user/workspace/membership but the new lifecycle handlers do not invoke the available granular policy checker before writes.

## 3. Permission boundary audit

### Critical identity boundary

All read and write routes receive `line_user_id` from a JSONP/HTTP query. No server-side LINE token verification path was found. A caller who knows another user’s LINE UID could attempt to invoke that user’s routes directly.

This is a **P0 blocker** for Production write routes. Production promotion requires a server-verifiable identity proof or a signed, short-lived backend session; trusting a caller-supplied UID is insufficient.

### Landlord authorization boundary

`workspaceLandlordCheckPolicy_()` already defines `message_write`, `payment_write`, and `contract_write`, but the Phase 91–94 lifecycle handlers call `workspaceLandlordResolveAccess_()` directly. The following 11 landlord write routes do not enforce a corresponding fine-grained policy:

- `landlord_repair_update`
- `landlord_contract_create`
- `landlord_contract_update`
- `landlord_contract_activate`
- `landlord_contract_status_update`
- `landlord_contract_delete`
- `landlord_contract_bill_generate`
- `landlord_bill_payment_confirm`
- `landlord_move_out_inspection_schedule`
- `landlord_move_out_inspection_complete`
- `landlord_deposit_refund_confirm`

An active Workspace member may therefore reach financial/contract mutations without demonstrating `can_edit_contract` or `can_approve_payment`. This is a **P0 blocker**.

## 4. Notification pipeline audit

### Pipeline

```text
Business Event
→ notificationQueueEnqueue_()
→ V2_NOTIFICATION_QUEUE
→ processNotificationQueue()
→ notificationDeliverQueuedLine_()
→ LINE Messaging API
→ V2_notification_logs
```

### Confirmed behavior

- Phase 88–90 tests cover receiver isolation, templates, dedupe, success, retry and terminal failure.
- Business lifecycle modules enqueue jobs instead of calling LINE directly.
- Queue statuses implement `pending`, `processing`, `sent`, `retrying`, and `failed`.
- Retry schedule is 5 minutes, then 30 minutes, then terminal failure on the third failed attempt.
- Staging read-only evidence: 3 queue rows are `sent`; all 3 have matching sent logs; 6 logs are present; queue/log Workspace mismatch count is 0.
- No bearer token, channel token, JWT, or access-token-like value was detected in persisted log fields.

### Notification blockers / risks

1. Jobs left in `processing` after timeout or runtime termination are never reclaimed; the worker selects only `pending` and `retrying`. Add stale-processing recovery with a bounded lease/timeout before Production.
2. The queue lock uses `DocumentLock` with `UserLock` fallback. A standalone Web App has no container document, and `UserLock` is not an explicit project-wide concurrency guarantee. Production requires a reviewed global locking strategy that does not conflict with existing business locks.
3. The exact Production installable-trigger inventory, owner, timezone and duplicate count have not been verified. This requires a read-only pre-deploy trigger inventory.

## 5. Migration and rollback audit

### Forward migration result

Phase 90–94 migrations:

- have staging guards;
- contain no sheet/row/column deletion or `clearContent()` operation;
- are additive schema migrations;
- preserve existing data;
- create triggers only for Notification worker, Contract expiry and Billing lifecycle where required.

Forward migration safety: **PASS for staging**.

### Rollback test result

Complete rollback readiness: **FAIL / BLOCKED**.

The staging Web App can be pointed back from version 15 to immutable version 14, but this only rolls back the deployed Web App version. It does not by itself:

- restore Apps Script HEAD source after `clasp push`;
- remove or restore installable triggers;
- revert appended Sheet columns;
- compensate partially completed multi-Sheet transactions;
- restore a pre-migration Spreadsheet snapshot.

No destructive rollback was executed because this audit is staging read-only. Before Production, prepare and rehearse a rollback package containing source SHA manifest, Apps Script version/deployment reference, trigger inventory, Script Properties checklist, Spreadsheet backup reference, and explicit post-rollback verification.

## 6. Production vs staging diff

### File boundary

- Staging-only Apps Script modules: 12.
- Production-only Apps Script modules: 4.
- Common modules with content differences: 15.
- Common identical modules including manifest: 26.
- Production routes: 68.
- Staging routes: 87.
- Staging-only routes: 19.
- Production-only routes: 0.

Staging-only modules include the Phase 90–94 lifecycle modules plus `V2_RUNTIME_ENVIRONMENT.js` and two staging setup modules. Production-only files include `TESTS.js`, legacy import, runtime repair and runtime validation tooling. These sets cannot be promoted by copying the entire staging tree.

The 15 changed common modules include the dispatcher, API, runtime snapshot, tenant binding/messages, billing, contract request and notification modules. `V2_TENANT_BINDING_PHONE.js` and the dispatcher have especially large diffs, so a file-level copy is not an acceptable Production merge strategy.

### Environment blocker

Several Phase 91–94 write paths explicitly assert `runtimeEnvironment_() === 'staging'`, and migration functions are deliberately staging-only. The current source is therefore not a Production-ready artifact by design.

## Blocking issues

| ID | Severity | Blocker | Required closure evidence |
|---|---|---|---|
| PR-01 | P0 | Caller-supplied LINE UID is not server-authenticated | Signed/verified identity design and negative impersonation test |
| PR-02 | P0 | 11 landlord financial/contract writes bypass granular policy checks | Route-policy matrix plus owner/admin/manager/maintenance/read-only tests |
| PR-03 | P0 | Phase 91–94 source and migrations contain staging-only guards | Reviewed Production configuration/migration boundary; no broad string removal |
| PR-04 | P0 | No atomic/compensating boundary for settlement/refund multi-row writes | Concurrency, fault-injection and idempotent recovery tests |
| PR-05 | P0 | Production promotion cannot use the entire staging tree safely | Exact SHA-256 release manifest and per-file merge review |
| PR-06 | P1 | Web App version rollback does not restore HEAD source or triggers | Rehearsed source/trigger/data rollback runbook |
| PR-07 | P1 | Notification jobs can remain permanently `processing` | Stale lease recovery test |
| PR-08 | P1 | Production trigger inventory is unverified | Handler/owner/schedule/timezone/duplicate inventory |
| PR-09 | P1 | No persisted staging bill/payment/move-out/settlement reconciliation | Disposable staging E2E fixture followed by read-only audit and cleanup |
| PR-10 | P1 | Full staging test suite fails because hosting artifact is not reproducible locally | Restore/declare hosting build artifact; full suite PASS |

## Deployment readiness

**Production deployment is not approved.**

Recommended next phase: close PR-01 and PR-02 first, then define a minimal Production promotion tree with reviewed concurrency/rollback behavior. After fixes, repeat Phase 95 against a disposable staging lifecycle fixture and require:

- full staging test suite PASS;
- authenticated identity negative tests;
- role/permission matrix PASS;
- concurrent/idempotent write tests PASS;
- queue stale-job recovery PASS;
- trigger inventory PASS;
- migration plus rollback rehearsal PASS;
- exact Production release manifest with SHA-256 verification.

## Production untouched confirmation

**YES.** Phase 95 did not modify Production source, Spreadsheet, Script Properties, LIFF, Web App URL, Apps Script deployment, triggers, LINE configuration, or Production data.
