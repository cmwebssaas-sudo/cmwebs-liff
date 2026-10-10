# Phase 94 — Move-out & Deposit Settlement

## Scope

Phase 94 僅存在 staging，整合 Phase 91 Repair、Phase 92 Contract、Phase 93 Billing 與 Phase 90 Notification Queue，建立退租申請、驗屋、押金結算、退款確認與租約終止閉環。

Production source、Spreadsheet、frontend、LIFF 與 deployment 不修改。

## V2_MOVE_OUT_REQUESTS schema

| 欄位群組 | 欄位 |
|---|---|
| Key / audit | `request_id`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| Workspace relation | `workspace_id`, `landlord_id`, `tenant_id`, `tenant_user_id`, `tenant_name`, `contract_id`, `property_id`, `room_id`, `room_no` |
| Request | `requested_move_out_date`, `reason`, `forwarding_address` |
| Inspection | `status`, `inspection_scheduled_at`, `inspection_completed_at`, `inspection_note` |
| Settlement relation | `settlement_id` |
| Notification | `move_out_requested_queue_id`, `inspection_scheduled_queue_id`, `deposit_settlement_ready_queue_id`, `deposit_refunded_queue_id`, `contract_terminated_queue_id` |

Status workflow：

```text
requested
→ inspection_scheduled
→ inspected
→ settlement_ready
→ refunded
→ completed

requested / inspection_scheduled → cancelled
```

驗屋完成與 settlement 建立在同一次 operation 內執行，因此 persisted request 會由 `inspection_scheduled` 原子更新為 `settlement_ready`；`inspected` 是流程檢核點，不作可長期停留狀態。

## V2_DEPOSIT_SETTLEMENTS schema

| 欄位群組 | 欄位 |
|---|---|
| Key / audit | `settlement_id`, `request_id`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| Workspace relation | `workspace_id`, `landlord_id`, `tenant_id`, `tenant_user_id`, `tenant_name`, `contract_id`, `property_id`, `room_id` |
| Calculation | `deposit_amount`, `unpaid_bill_amount`, `repair_cost_amount`, `total_deductions`, `refund_amount`, `tenant_balance_due` |
| Evidence | `unpaid_bill_ids_json`, `repair_items_json`, `inspection_note` |
| Refund | `status`, `ready_at`, `refunded_at`, `refund_method`, `refund_reference`, `confirmed_by` |

Calculation：

```text
total_deductions = unpaid_bill_amount + repair_cost_amount
refund_amount = max(0, deposit_amount - total_deductions)
tenant_balance_due = max(0, total_deductions - deposit_amount)
```

## Phase 91 Repair integration

Migration 對既有 `V2_REPAIR_TICKETS` append 以下 4 欄：

- `settlement_chargeable`
- `settlement_cost`
- `settlement_note`
- `deposit_settlement_id`

驗屋扣款必須逐筆指定 `ticket_id` 與非負金額。Ticket 必須：

- 屬於同一 Workspace、tenant、contract；
- 恰好一筆；
- 狀態為 `completed` 或 `closed`；
- 不得重複列入同一結算。

沒有 repair ticket 證據的任意總額不會被接受。

## Phase 93 Billing integration

未繳帳單只從 `V2_bills` 讀取，條件為：

- 相同 `workspace_id`、`tenant_id`、`contract_id`；
- `bill_status` 不是 `cancelled`、`void` 或 `paid`；
- `payment_status` 不是 `paid`；
- `bill_id` 必須存在且唯一；
- `total_amount` 必須為合法非負金額。

結算只讀帳單，不改寫帳單或付款狀態。

## Refund and contract termination

`landlord_deposit_refund_confirm`：

1. Requires settlement `ready` and request `settlement_ready` in the active Workspace.
2. Requires refund method; a positive refund also requires a reference ID.
3. Uses Phase 92 contract lifecycle to transition `active/expiring → terminated`.
4. Marks settlement `refunded` and request `completed`.
5. Enqueues `deposit_refunded` and `contract_terminated` separately.
6. A repeated confirmation returns the existing result without creating another settlement or refund record.

## Notification events

| Event | Receiver | Trigger |
|---|---|---|
| `move_out_requested` | landlord | Tenant creates request |
| `inspection_scheduled` | tenant | Landlord schedules inspection |
| `deposit_settlement_ready` | tenant | Inspection and calculation complete |
| `deposit_refunded` | tenant | Landlord confirms refund |
| `contract_terminated` | tenant | Contract termination succeeds |

Lifecycle modules never call `UrlFetchApp`, LINE API, or `pushLineTextMessage_`; delivery and retry remain Phase 90 responsibilities.

## Routes

| Route | Purpose |
|---|---|
| `tenant_move_out_requests_init` | Tenant-scoped read |
| `tenant_move_out_request_create` | Create one open request per contract |
| `landlord_move_out_requests_init` | Workspace-scoped landlord read |
| `landlord_move_out_inspection_schedule` | Schedule inspection |
| `landlord_move_out_inspection_complete` | Create calculated settlement |
| `landlord_deposit_refund_confirm` | Confirm refund and terminate contract |

Staging routes：87；Production canonical routes：68。

## Tests

`release/staging/tests/phase94-move-out-settlement.test.js` covers：

- move-out request and inspection scheduling;
- deposit calculation;
- completed repair deduction;
- unpaid bill deduction and paid-bill exclusion;
- refund confirmation;
- contract termination;
- all five Notification Queue events;
- invalid repair source rejection;
- Workspace read/write isolation;
- no direct LINE transport.

## Staging deployment and validation

- Staging Apps Script source push：43 files，PASS。
- Immutable staging version：15；Web App deployment 已更新至 version 15。
- Rollback target：staging version 14。
- `migrateStagingMoveOutSettlement()`：PASS，無 runtime error。
- `V2_MOVE_OUT_REQUESTS`：27 columns，header 完整，migration 後 0 data rows。
- `V2_DEPOSIT_SETTLEMENTS`：29 columns，header 完整，migration 後 0 data rows。
- `V2_REPAIR_TICKETS`：33 columns；既有 schema 後方已 append 4 個 settlement 欄位，既有 staging repair row 保留。
- Production validator：68 unique routes、68/68 handler coverage，PASS。
- Staging validator：42 Apps Script files、6 HTML files、87 unique routes、87/87 handler coverage，PASS。
- Phase 90、91、92、93、94 isolated tests：全部 PASS。
- `git diff --check`：PASS。

本次 remote staging 僅執行 schema migration；未建立退租申請、押金結算、退款、租約終止或通知工作，亦未發送 LINE。Production Apps Script、Spreadsheet、deployment、frontend 與 LIFF 均未接觸。

## Rollback

- Point staging Web App back to the pre-Phase 94 immutable version.
- Preserve request and settlement rows for audit; do not delete them automatically.
- The migration is append-only; added repair settlement headers may remain unused after rollback.
- Production needs no rollback because Phase 94 does not modify Production.
