# Phase 91 — Repair Workflow 完整閉環

## Scope

本階段只修改 `release/staging/`，建立正式報修單、狀態流程、房東管理入口與 Notification Queue 整合。Production Apps Script、Spreadsheet、LIFF、frontend 與 deployment 均不在本階段範圍。

既有 `tenant_message_submit` 的 `repair` 類別仍保留 `V2_tenant_messages` 相容紀錄；同時建立正式 repair ticket，後續狀態以 `ticket_id` 為 canonical key。

## Schema

新增 staging Sheet：`V2_REPAIR_TICKETS`。

| 欄位群組 | 欄位 |
|---|---|
| Canonical key | `ticket_id` |
| 時間 | `created_at`, `updated_at`, `acknowledged_at`, `started_at`, `completed_at`, `closed_at` |
| 隔離與關聯 | `workspace_id`, `landlord_id`, `tenant_id`, `tenant_user_id`, `tenant_name`, `contract_id`, `property_id`, `room_id`, `room_no` |
| 報修內容 | `source_message_id`, `category`, `priority`, `title`, `description`, `preferred_contact_time` |
| Workflow | `status`, `assigned_user_id`, `landlord_note`, `created_by`, `updated_by` |
| Notification | `landlord_notification_queue_id`, `tenant_notification_queue_id` |

Sheet 不保存 LINE token，也不以完整 LINE UID 作 repair ticket 關聯鍵。

## Status workflow

```text
open
├─ acknowledged → in_progress → completed → closed
├─ in_progress → completed → closed
└─ closed
```

- `closed` 是 terminal state。
- 同狀態更新回傳 `NO_CHANGE`，不重複通知。
- 不允許跳過定義外的狀態轉換。
- 完成時通知房客；已完成後再關閉不重複通知。
- 若直接關閉未完成 ticket，仍送一則關閉通知。

## Routes

| Route | Identity / isolation | Result |
|---|---|---|
| `tenant_repairs_init` | canonical tenant resolver；限制 tenant + workspace | 房客自己的 tickets |
| `tenant_repair_create` | canonical tenant resolver；解析 contract/property/room/landlord | 新 ticket + landlord queue job |
| `landlord_repairs_init` | `workspaceLandlordResolveAccess_` | 目前 Workspace 的 tickets |
| `landlord_repair_update` | `workspaceLandlordResolveAccess_` + ticket workspace match | 狀態更新 + completion queue job |

Staging route count 從 68 增為 72；Production canonical 維持 68。

## Notification Queue integration

```text
Tenant repair event
→ V2_REPAIR_TICKETS
→ notificationQueueEnqueue_(tenant_repair)
→ Phase 90 worker
→ landlord LINE

Landlord completes ticket
→ status = completed
→ notificationQueueEnqueue_(repair_completed)
→ Phase 90 worker
→ tenant LINE
```

Repair workflow module 不呼叫 `UrlFetchApp`、`pushLineTextMessage_` 或 LINE API。Business event 只建立 Queue job，實際傳送由 Phase 90 worker 負責。

## Migration

在確認為 staging Apps Script project 後，人工執行：

1. `migrateStagingRepairTickets()`
2. 若 staging 尚未設定測試房客 Property，執行 `migrateStagingRepairTestIdentity()`；它只從既有且唯一的 `TSTG086` fixture 取得真實 UID，且只回傳遮罩值。
3. 確認回傳 `environment: staging`。
4. 確認 `V2_REPAIR_TICKETS` 存在且 header 完整。
5. 不在 Production project 執行；environment guard 會停止所有 staging migration。

## Tests

本機測試 `release/staging/tests/phase91-repair-workflow.test.js` 涵蓋：

- tenant 建立 repair ticket。
- landlord notification 只進入 Queue。
- landlord 依合法狀態機更新。
- tenant completion notification 只進入 Queue。
- 完成後關閉不重複通知。
- 不合法狀態跳轉拒絕。
- 跨 Workspace ticket 不可查找或更新。
- repair module 無直接 LINE transport。

Regression 同時執行 Phase 89、Phase 90 tests 與 canonical/staging validator。

## Staging validation record

部署前：

- Phase 91 test：PASS
- Phase 90 regression：PASS
- Phase 89 regression：PASS
- Production canonical validator：PASS（68/68）
- Staging validator：PASS（72/72）

部署與實際 staging 驗證：

- Staging Web App：版本 12（既有 staging deployment 更新；URL 未變）
- `V2_REPAIR_TICKETS` migration：PASS，29 個 headers，migration 後初始為 0 data rows
- 測試身份：由既有唯一 `TSTG086` fixture 設定 `TEST_TENANT_LINE_UID`，UID 僅以遮罩形式處理
- Tenant create repair：PASS
- Landlord recipient resolution：PASS
- Landlord status update：PASS，`open → in_progress → completed → closed`
- Landlord notification Queue：`sent`，retry 0，provider HTTP 200
- Tenant completion notification Queue：`sent`，retry 0，provider HTTP 200
- Notification log：兩筆均為 `delivery_status=sent`、`code=OK`
- Ticket uniqueness：1 張 smoke ticket；首次被 onboarding gate 擋下後續用原 ticket 完成，未建立重複 ticket

第一次 smoke test 找到 staging workspace 為 active、owner membership 為 active，但 onboarding status 為 pending。報修管理權限不再要求完成 onboarding；仍要求 active user、active workspace、active membership，並以 ticket `workspace_id` fail closed。這項變更只存在 staging。

## Risks and rollback

- 風險：`tenant_message_submit` 的 repair 類別會同時保留 legacy message 與建立 ticket；非 repair 訊息行為不變。
- 風險：Queue worker 為非同步，API 成功代表 job 已建立，不等於 LINE 已送達；送達狀態應以 Queue/notification log 為準。
- Rollback：將 staging Web App deployment 指回 Phase 90 版本 9；保留 `V2_REPAIR_TICKETS` 供稽核，不需刪除資料。

## Production boundary

本階段沒有修改或部署 Production。若未來要導入 Production，必須另行審查 schema migration、route release、frontend management UI、權限、部署與 rollback。
