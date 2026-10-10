# Phase 93 — Billing Lifecycle

## Scope

Phase 93 僅存在 staging，建立 Contract → monthly bill → landlord payment confirmation 的租金帳務閉環，並將 `bill_created`、`payment_due`、`payment_confirmed`、`payment_overdue` 全部送入 Phase 90 Notification Queue。

Production source、Spreadsheet、LIFF、frontend 與 deployment 不修改。

## Canonical naming decision

- 新增 Apps Script modules：`V2_BILLS.js`、`V2_PAYMENTS.js`。
- 實體 Sheets 維持既有 `V2_bills`、`V2_payments`。
- 原因：tenant portal、billing、settlement、payment report、arrears 與既有 view 都已依賴小寫實體表名。建立只差大小寫的新 Sheet 會造成雙主資料。
- `migrateStagingBillingLifecycle()` 只 append 缺少欄位，不覆蓋既有 header 或資料列。

## V2_BILLS schema

| 欄位群組 | 欄位 |
|---|---|
| Key / audit | `bill_id`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| Workspace relation | `workspace_id`, `landlord_id`, `tenant_id`, `tenant_user_id`, `user_id`, `tenant_line_user_id`, `contract_id`, `property_id`, `room_id` |
| Display | `tenant_name`, `room_name`, `bill_month`, `due_date`, `notes` |
| Amount | `rent_amount`, `management_fee`, `electricity_amount`, `equipment_amount`, `other_amount`, `discount_amount`, `total_amount` |
| Lifecycle | `bill_status`, `payment_status`, `issued_at`, `paid_at`, `payment_id` |
| Notification | `bill_created_queue_id`, `payment_due_queue_id`, `payment_overdue_queue_id` |

帳單狀態：

```text
issued → overdue → paid
   └────────────→ paid
```

## V2_PAYMENTS schema

| 欄位群組 | 欄位 |
|---|---|
| Key / audit | `payment_id`, `created_at`, `updated_at` |
| Workspace relation | `workspace_id`, `landlord_id`, `tenant_id`, `tenant_user_id`, `user_id`, `contract_id`, `property_id`, `room_id`, `bill_id` |
| Payment | `bill_month`, `payment_date`, `amount`, `payment_method`, `bank_last5`, `status` |
| Source | `source`, `source_ref_id`, `confirmation_source`, `note` |
| Confirmation | `confirmed_at`, `confirmed_by`, `rejected_at`, `rejection_reason` |
| Notification | `payment_confirmed_queue_id` |

Phase 93 confirmation creates a `confirmed` payment record and performs a full settlement only. The submitted amount must equal `V2_bills.total_amount`; partial payment is rejected rather than silently producing inconsistent balances.

## Contract to monthly bill generation

`generateContractMonthlyBillByLineUid_()`:

1. Resolves active landlord Workspace access.
2. Requires exactly one `active` or `expiring` contract in the same Workspace.
3. Requires the billing month to fall within the contract start/end months.
4. Validates tenant and room/property relation in the same Workspace.
5. Creates deterministic `BILL-yyyyMM-contract_id`; reruns return the existing bill.
6. Uses contract monthly rent unless an explicit non-negative amount is supplied.
7. Caps the due day to the last calendar day of the month.
8. Appends the bill as `issued/unpaid` and enqueues `bill_created`.

The generated physical row contains the identity keys used by the existing `tenant_bills` handler, so tenant reads continue to use the established API response schema.

## Payment confirmation

`confirmLandlordBillPaymentByLineUid_()`:

- requires the bill to belong to the active Workspace;
- accepts only `issued` or `overdue` bills;
- prevents a second confirmed ledger row for the same bill;
- creates one `confirmed` payment record;
- updates the bill to `paid/paid` with `payment_id` and `paid_at`;
- releases the payment write lock before calling Notification Queue;
- enqueues `payment_confirmed` and never calls LINE directly.

## Due and overdue worker

`processBillingLifecycleNotifications()` runs once daily at 08:00 staging time:

- due today: enqueue `payment_due` once;
- past due and unpaid: mark `overdue` and enqueue `payment_overdue` once;
- paid or non-payable bills: skip;
- queue IDs on the bill provide event-level idempotency;
- Phase 90 Queue provides delivery retry and dedupe.

## Routes

| Route | Purpose |
|---|---|
| `landlord_billing_lifecycle_init` | Workspace-scoped bill/payment ledger read |
| `landlord_contract_bill_generate` | Generate one monthly bill from one contract |
| `landlord_bill_payment_confirm` | Confirm full payment and close the bill |
| `tenant_bills` | Existing tenant read route; response contract unchanged |

Staging routes：81；Production canonical routes：68。

## Tests

`release/staging/tests/phase93-billing-lifecycle.test.js` covers:

- create bill;
- tenant view through the existing `getTenantBillsRuntimePayloadByLineUid_()` path;
- landlord confirm payment;
- payment confirmation idempotency;
- `bill_created`, `payment_due`, `payment_overdue`, `payment_confirmed` Queue events;
- Workspace list and confirmation isolation;
- no direct `UrlFetchApp` or LINE transport in lifecycle modules.

## Staging deployment and validation

- Production validator：PASS，34 Apps Script files、44 HTML files、68/68 routes、68/68 handler coverage。
- Staging validator：PASS，40 Apps Script files、6 HTML files、81/81 routes、81/81 handler coverage、0 duplicate declarations。
- Regression：Phase 90、91、92 tests 全部 PASS。
- Phase 93 tests：PASS。
- Staging Apps Script：已建立 immutable version 14，並更新既有 staging Web App deployment；version 13 保留為 rollback target。
- Remote source：已確認 staging 專案包含 `V2_BILLS.gs`、`V2_PAYMENTS.gs`。
- Migration：`migrateStagingBillingLifecycle()` 執行完成，無 runtime error。
- `V2_bills`：35 欄；34 個 Phase 93 必要欄位均存在，另保留既有相容欄位 `billing_month`。
- `V2_payments`：27 個必要欄位完整。
- Migration 後兩張表均只有 header row；未建立遠端帳單或付款資料，也未覆蓋既有值。
- Trigger：staging Apps Script 共 3 個時間觸發器；`processBillingLifecycleNotifications`、`processContractExpiryNotifications`、`processNotificationQueue` 各 1 筆。
- 本階段未手動執行 billing worker，未建立遠端通知 job，未發送 LINE。

Create bill、tenant view、landlord confirm payment、四種 notification event 與 Workspace isolation 使用隔離的 deterministic fixture 驗證，避免以既有 staging 房客或房東身份建立真實帳務資料。

## Rollback

- Point the staging Web App deployment back to the pre-Phase 93 version.
- Disable the staging `processBillingLifecycleNotifications` trigger.
- Keep append-only headers and audit values; do not delete existing bills or payments.
- Production needs no rollback because Phase 93 does not modify Production.
