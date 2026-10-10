# Phase 92 — Lease Lifecycle

## Scope

Phase 92 僅存在 staging，建立租約 CRUD、狀態機、到期事件與 Phase 90 Notification Queue 整合。Production source、Spreadsheet、LIFF、frontend 與 deployment 不修改。

## Canonical naming decision

- 新增 Apps Script 模組：`V2_CONTRACTS.js`。
- 實體 Sheet 維持既有 `V2_contracts`。
- 原因：tenant resolver、billing、check-in、contract request 與 onboarding 均已依賴 `V2_contracts`。建立只差大小寫的新 Sheet 會造成雙主資料或無法建立，因此 migration 僅補齊 lifecycle 欄位，不搬移或複製既有租約。

## Schema

`migrateStagingContractLifecycle()` 以 append-only 方式補齊以下 27 個必要欄位：

| 欄位群組 | 欄位 |
|---|---|
| Key / audit | `contract_id`, `created_at`, `updated_at`, `created_by`, `updated_by` |
| Workspace relation | `workspace_id`, `landlord_id`, `tenant_id`, `tenant_user_id`, `property_id`, `room_id` |
| Contract terms | `start_date`, `end_date`, `monthly_rent`, `deposit_amount`, `payment_due_day`, `terms`, `note` |
| Lifecycle | `contract_status`, `activated_at`, `ended_at`, `terminated_at`, `cancelled_at`, `deleted_at`, `renewed_from_contract_id` |
| Expiry event | `expiry_notification_queue_id`, `expiry_notified_at` |

Migration 不覆蓋既有欄位或資料列，並安裝一個每日 09:00 的 `processContractExpiryNotifications` trigger；重跑不會建立重複 trigger。

## CRUD and status workflow

```text
draft
├─ active → expiring → renewed
│          ├─ ended
│          └─ terminated
├─ active → ended / terminated
└─ cancelled → deleted

draft → deleted
```

- Create：建立 `draft`，先確認 tenant/property/room 均屬同一 Workspace。
- Read：只回傳目前 landlord Workspace 的未刪除租約。
- Update：只有 `draft` 可修改主要條件。
- Activate：拒絕同 tenant 或 room 且日期重疊的 active/expiring 租約。
- Delete：只做軟刪除，不刪除 Sheet row；限 draft 或 cancelled。
- 所有寫入都需要 active user、active workspace、active membership，並以 `workspace_id` fail closed。

## Routes

| Route | Purpose |
|---|---|
| `landlord_contracts_init` | Workspace-scoped list/read |
| `landlord_contract_create` | 建立 draft |
| `landlord_contract_update` | 修改 draft |
| `landlord_contract_activate` | draft → active |
| `landlord_contract_status_update` | lifecycle transition |
| `landlord_contract_delete` | draft/cancelled soft delete |

Staging routes：78；Production canonical routes：68。

## Contract expiry notification

`processContractExpiryNotifications()`：

1. 掃描 `active` / `expiring` 且在提醒視窗內的租約。
2. 提醒天數讀取 staging Script Property `CONTRACT_EXPIRY_REMINDER_DAYS`；未設定時為 30 天，允許範圍 1–180 天。
3. 建立 `contract_expiring` Queue job，receiver 為 tenant，並包含 Workspace isolation key。
4. 成功排入 Queue 後才寫入 `expiry_notification_queue_id`、`expiry_notified_at` 並標記 `expiring`。
5. 同一 `contract_id:end_date` 不重複建立通知。

Lease module 不呼叫 `UrlFetchApp`、`pushLineTextMessage_` 或 LINE API；實際傳送與 retry 由 Phase 90 worker 負責。

## Tests

`release/staging/tests/phase92-contract-lifecycle.test.js`：

- create contract：PASS
- activate contract：PASS
- contract expiring queue notification：PASS
- expiry idempotency：PASS
- workspace list/update isolation：PASS
- direct LINE transport absence：PASS

## Deployment and staging validation

本階段僅更新 staging：

- Phase 92 tests：PASS。
- Staging validator：PASS，38 Apps Script files、6 HTML files、78/78 routes、78/78 handler coverage、0 duplicate declarations。
- Production validator：PASS，34 Apps Script files、44 HTML files、68/68 routes、68/68 handler coverage；production source 與 deployment 未修改。
- Staging Apps Script：已建立 immutable version 13，並將既有 staging Web App deployment 更新至 version 13；version 12 保留為 rollback target。
- Remote source：已確認 staging 專案包含 `V2_CONTRACTS.gs`。
- Migration：`migrateStagingContractLifecycle()` 執行完成，無 runtime error。
- 實體 Sheet：既有 `V2_contracts` 保留；migration 後為 32 欄，27 個 lifecycle 必要欄位均存在。
- 既有資料：`CSTG082`、`CSTG086` 兩筆 staging 租約仍存在；migration 未新增租約 row，也未覆蓋既有值。
- Trigger：Apps Script trigger 頁面共 2 筆時間觸發器；其中 `processContractExpiryNotifications` 恰好 1 筆，另 1 筆為既有 `processNotificationQueue`。
- Queue boundary：本階段未手動執行 expiry worker，未建立遠端通知 job，亦未發送 LINE。

Create、activate、expiry notification 與 Workspace isolation 使用隔離的 deterministic fixture 驗證；為避免改動既有 staging tenant flow，本階段沒有在遠端 Sheet 建立 disposable contract。

## Rollback

- 將 staging Web App deployment 指回 Phase 91 version 12。
- 停用 `processContractExpiryNotifications` staging trigger。
- 保留新增 headers 與 lifecycle audit 值；不刪除既有租約資料。
- Production 不需 rollback，因本階段未修改 Production。
