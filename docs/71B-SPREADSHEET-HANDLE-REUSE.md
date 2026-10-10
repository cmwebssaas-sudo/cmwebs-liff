# Phase 71B — Spreadsheet Handle Reuse

日期：2026-07-21

狀態：**IMPLEMENTED LOCALLY — NOT COMMITTED / NOT PUSHED / NOT DEPLOYED**

## 1. 目的與限制

本階段降低同一次 Apps Script execution / Web App request 中重複呼叫
`SpreadsheetApp.getActiveSpreadsheet()` 或 `SpreadsheetApp.openById()` 的次數。

沒有修改 API response schema、frontend HTML、Sheet schema、route、business
validation 或 deployment strategy，也沒有使用 `CacheService`。

## 2. Before — Spreadsheet instance acquisition flow

Phase 69B 的跨行語法掃描確認：

- `SpreadsheetApp.getActiveSpreadsheet()`：147 個呼叫位置。
- `SpreadsheetApp.openById()`：1 個呼叫位置。
- 合計 148 個 acquisition call sites，分布於 31 個 Apps Script modules。

修改前，每個 helper 自行取得 Spreadsheet handle：

```text
doGet
↓
route handler
├─ resolver → getActiveSpreadsheet()
├─ generic reader → getActiveSpreadsheet()
├─ nested reader → getActiveSpreadsheet()
└─ access logger → getActiveSpreadsheet()
```

即使這些 calls 位於同一 request、指向同一綁定 Spreadsheet，也沒有共用 handle。

### Before call-site inventory

完整 function@line 清單記錄於
`docs/69B-SHEET-READ-AUDIT.md` 的 Spreadsheet handle inventory。以下為所有
call sites 的 module-level 對帳；數量總和為 148：

| Module | Before calls | 用途摘要 |
|---|---:|---|
| `TESTS.js` | 5 | diagnostics / validation |
| `V2_ANNOUNCEMENT_MANAGEMENT.js` | 7 | announcement runtime/schema/tests |
| `V2_API.js` | 12 | API readers、logs、migration/tests |
| `V2_AUTO_PAYMENT_REMINDER.js` | 3 | 1 個 `openById` + 2 個 active handle |
| `V2_BILLING_MANAGEMENT.js` | 7 | billing runtime/schema/repair |
| `V2_BILL_NOTIFICATIONS.js` | 5 | notification runtime/schema |
| `V2_CONTRACT_REQUESTS.js` | 6 | tenant/landlord contract routes |
| `V2_LANDLORD_MANAGEMENT.js` | 3 | landlord identity/reports/messages |
| `V2_LANDLORD_ONBOARDING.js` | 5 | onboarding runtime/schema |
| `V2_LEGACY_BILL_IMPORT.js` | 1 | legacy import |
| `V2_MANUAL_SETTLEMENT.js` | 5 | settlement/repair/tests |
| `V2_PAID_BILL_MANAGEMENT.js` | 1 | paid-bill runtime |
| `V2_PAYMENT_REVERSAL.js` | 3 | reversal transaction/tests |
| `V2_PAYMENT_SETTLEMENT.js` | 2 | settlement transaction/tests |
| `V2_PROPERTY_ROOM_MANAGEMENT.js` | 10 | property/room runtime/schema/repair |
| `V2_SETTINGS_INTEGRATION.js` | 2 | Workspace settings runtime/test |
| `V2_SYSTEM_SETTINGS.js` | 8 | settings runtime/schema/repair |
| `V2_TEAM_MANAGEMENT.js` | 11 | team/member/invitation runtime |
| `V2_TENANT_BINDING_PHONE.js` | 6 | binding runtime/log/repair/test |
| `V2_TENANT_CHECKIN_MANAGEMENT.js` | 5 | check-in runtime/schema |
| `V2_TENANT_LEASE_ONBOARDING.js` | 5 | lease onboarding runtime/schema |
| `V2_TENANT_MESSAGES.js` | 2 | message read/schema |
| `V2_TENANT_PAYMENT_REPORTS.js` | 3 | tenant payment reports |
| `V2_TENANT_RUNTIME_DATA_REPAIR.js` | 5 | admin diagnostics/repair |
| `V2_TENANT_RUNTIME_RESOLVER.js` | 1 | canonical tenant resolver |
| `V2_WORKSPACES.js` | 8 | Workspace identity/schema/logging |
| `V2_WORKSPACE_CREATION.js` | 1 | Workspace creation |
| `V2_WORKSPACE_DASHBOARD_NATIVE.js` | 1 | native dashboard |
| `V2_WORKSPACE_LANDLORD_ACCESS.js` | 2 | access resolver/migration |
| `V2_WORKSPACE_NOTIFICATIONS.js` | 9 | notification runtime/schema/tests |
| `V2_WORKSPACE_OPERATION_AUDIT.js` | 4 | operation audit runtime/schema |
| **Total** | **148** | **147 active + 1 ID-based** |

## 3. After — Runtime handle reuse flow

所有 148 個 call sites 已改用保留參數語意的 helper：

```text
runtimeSpreadsheet_()
runtimeSpreadsheet_(spreadsheetId)
```

修改後：

```text
doGet
↓ runtimeSnapshotBegin_(action)
request-local handle map = {}
↓
route / resolver / reader
↓ runtimeSpreadsheet_(optionalId)
├─ first key request → Apps Script service call → store handle
└─ same key again    → reuse stored handle
↓
runtimeSnapshotFinish_()
→ debug counters
→ clear request state
```

Key 規則：

- 無 ID：`ACTIVE`
- 有 ID：`ID:<spreadsheetId>`

ID 不會出現在 Logger 或 API response。取得 handle 後也會以實際 Spreadsheet ID
建立內部 alias，因此同一 explicit ID 可在該 execution 重用。

在非 Web App 的 trigger、manual test 或 admin function execution 中，如果尚未建立
request state，`runtimeSpreadsheet_()` 會 lazy 建立 execution-local state。同一次
execution 後續呼叫仍可重用；下一次 Apps Script execution 會重新初始化 global。

## 4. Function signature and behavior compatibility

- 原有 route handler signatures 未修改。
- resolver、reader、repair、migration 與 test function signatures 未修改。
- 原本無參數的 `getActiveSpreadsheet()` 對應 `runtimeSpreadsheet_()`。
- 原本 `openById(spreadsheetId)` 對應
  `runtimeSpreadsheet_(spreadsheetId)`。
- Spreadsheet handle 仍是原生 Apps Script `Spreadsheet` object；Sheet 寫入後同一
  handle 會反映更新，不存在 Phase 70 row snapshot 的 stale-row 問題。
- 沒有變更 lock、permission、Workspace isolation、Sheet filter 或 write order。

## 5. Debug counters

`runtimeSnapshotFinish_()` 的 Execution Logger report 新增：

```json
{
  "spreadsheet_handle_created": 1,
  "spreadsheet_handle_reused": 4
}
```

- `spreadsheet_handle_created`：本 execution 實際呼叫
  `getActiveSpreadsheet()`／`openById()` 建立的 handle 數。
- `spreadsheet_handle_reused`：由 request/execution-local map 直接回傳既有 handle 的
  次數。

Counter 不包含 Spreadsheet ID、UID、Sheet data、token 或 credential，也不加入 API
payload。Debug logger 失敗不影響 API response。

## 6. Tenant read routes reduction estimate

依目前 call graph，排除 output helper（不取得 Spreadsheet）：

| Route | Before acquisitions | After created | Expected reused | Estimated reduction |
|---|---:|---:|---:|---:|
| `tenant_home` | 2：resolver + access log | 1 | 1 | -1（50%） |
| `tenant_bills` | 5：4 個 generic reads + access log | 1 | 4 | -4（80%） |
| `tenant_contract_init` | 2：handler + access log | 1 | 1 | -1（50%） |
| `tenant_message_init` | 4：resolver + message sheet check + generic reader + access log | 1 | 3 | -3（75%） |

這是 Spreadsheet instance acquisition 次數估計，不是 full-sheet read reduction，也不
等同 wall-clock latency。是否有可見延遲改善仍需部署後以 Execution Logger 和 HTTP
timing 驗證。

## 7. Project-wide reduction estimate

直接 service call sites 從 148 個分散位置收斂為 helper 內 2 個：

- 1 個 `SpreadsheetApp.getActiveSpreadsheet()`。
- 1 個 `SpreadsheetApp.openById()`。

單一 request 實際建立數取決於使用的 key：

- 一般 bound Web App request：預期 created=1。
- auto-reminder explicit-ID path：預期 created=1。
- 同一 execution 若刻意存取不同 Spreadsheet IDs，會為每個不同 key 建立一個
  handle；不會錯誤共用不同 Spreadsheet。

## 8. Modified files

- `apps-script/V2_RUNTIME_SNAPSHOT.js`
  - handle map、lazy acquisition 與 created/reused counters。
- 其餘 31 個含原始 acquisition call sites 的 Apps Script modules
  - 僅機械性將 direct acquisition 改為 `runtimeSpreadsheet_()`。
- `docs/71B-SPREADSHEET-HANDLE-REUSE.md`
  - 本文件。

沒有修改 frontend、API schema、Sheet schema、manifest 或 deployment。

## 9. Validation

Local handle mock：

| Scenario | Service calls | Created | Reused | Result |
|---|---:|---:|---:|---|
| active handle requested 3 times | 1 | 1 | 2 | PASS |
| same explicit ID requested 2 times | 1 | 1 | 1 | PASS |

Static checks：

- 原 148 個 call sites 均已改用 `runtimeSpreadsheet_()`。
- Direct Apps Script acquisition 只剩 helper 內 active 與 ID-based 各一處。
- `npm run validate` 與 `git diff --check` 結果記錄於完成回報。

## 10. Risk and rollback

| Risk | Level | Control |
|---|---|---|
| 跨 request 共用 handle | P0 | 每次 `doGet` 重設 state；response finish 清除 |
| 不同 Spreadsheet 錯誤共用 | P0 | handle map 以 ACTIVE 或 explicit ID 分 key |
| write route 取得 stale rows | Not applicable | 只共用 Spreadsheet object，不共用 row values；Phase 70 raw snapshot 邊界不變 |
| Debug 洩漏 ID | P1 | report 僅輸出數字，不輸出 key 或 ID |
| 新 helper 遺漏於未來 release payload | P0 | release manifest 必須包含 `V2_RUNTIME_SNAPSHOT.js`，部署前 validator/dependency audit 必查 |

Rollback：將 `runtimeSpreadsheet_()` call sites 機械性還原為原生 Apps Script calls，
並移除 handle map/counters。不需要 Sheet rollback 或資料 migration。

本 Phase 未執行 commit、Git push、`clasp push` 或 deploy，等待人工 review。
