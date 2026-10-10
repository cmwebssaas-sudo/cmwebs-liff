# Phase 70 — Runtime Snapshot Consolidation

日期：2026-07-21

狀態：**IMPLEMENTED LOCALLY — NOT PUSHED / NOT DEPLOYED**

## 1. 修改原因

Phase 68 與 Phase 69B 確認，Apps Script runtime 主要成本來自 generic readers
反覆執行 `getDataRange().getValues()`。既有 reader 各自取得 Spreadsheet/Sheet，
沒有可跨 nested helper 共用的 request state。

本階段建立 request-local snapshot。它不使用 `CacheService`、Script Properties
或 global persistent storage；每次 `doGet()` 開始時建立全新 state，response output
完成時記錄 counter 並清除。

## 2. 修改前 data flow

```text
doGet(e)
↓
v2_action dispatcher
↓
route handler
↓
resolver / module helper
↓
workspaceGetObjectsWithRow_(sheet)
getSheetObjects_(sheetName)
contractRequestGetObjects_(sheet)
tenantRuntimeReadSheet_(ss, sheetName)
↓
每次呼叫各自 sheet.getDataRange().getValues()
```

若 nested helpers 在同一次 request 要求同一張 Sheet，每個 reader 都會重新
full-read。不同 frontend HTTP requests（例如 Home 同時發出的 `tenant_home` 與
`tenant_contract_init`）是兩個獨立 Apps Script executions，本階段不能跨 request
共用記憶體。

## 3. Tenant Home 分析

成功的 `tenant_home` route：

```text
doGet
→ getTenantHomeByLineUid
→ resolveCanonicalTenantRuntimeByLineUid_
→ tenantRuntimeReadSnapshot_
→ tenantRuntimeReadSheet_
→ tenantRuntimeHomeData_
```

Phase 69 後，成功路徑讀取 7 張不同 Sheets：

1. `V2_tenants`
2. `V2_contracts`
3. `V2_tenant_home_view`
4. `V2_tenant_bill_view`
5. `V2_rooms`
6. `V2_properties`
7. `V2_landlord_tenant_list_view`

該成功路徑目前沒有對同一張 Sheet 重讀，所以第一次 resolver 執行預期為
before=7、after=7。Snapshot 的直接效益出現在同一 request 第二次要求相同
Sheet 或相同 canonical context 時；第二次 resolver 可直接 reuse tenant identity、
workspace、contract、property、room 與 bill-view context。

錯誤 fallback 仍保留既有 binding resolver 與錯誤分類，避免改變登入／綁定 API
行為。本階段沒有整併該獨立資料鏈。

## 4. 修改後 data flow

```text
doGet(e)
↓ runtimeSnapshotBegin_(v2_action)
request-local state
├─ raw values by spreadsheet_id + sheet_id
├─ canonical tenant contexts
└─ debug counters
↓
route / resolver / generic reader
↓ runtimeSnapshotGetValues_(sheet)
├─ cache miss → getDataRange().getValues() → store
└─ cache hit  → reuse raw values
↓
jsonOutput_ / htmlBridgeOutput_
↓ runtimeSnapshotFinish_()
Execution Logger counter + state clear
```

Snapshot 保存的 canonical tenant context 包含：

- tenant identity
- workspace
- active contract
- property
- room
- landlord link resolution
- tenant home View rows
- tenant bill View rows
- 需要時的 bill master rows

## 5. 啟用邊界

目前只對已確認為 read-only projection 的 routes 啟用：

- `tenant_home`
- `tenant_bills`
- `tenant_message_init`
- `tenant_contract_init`

所有其他 `doGet` actions 仍建立新的 request state，但 `enabled=false`，reader 直接
執行原本 full-read。這是刻意的安全邊界：submit、repair、migration、payment、
notification 等流程可能在一次 request 中寫入 Sheet，若沒有完整 invalidation，
共用舊 snapshot 會改變正式行為。

## 6. Reader integration

既有 function signature 均未改變：

| Reader | 原 signature | 修改 |
|---|---|---|
| `workspaceGetObjectsWithRow_` | `(sheet)` | raw values 優先讀 request snapshot |
| `getSheetObjects_` | `(sheetName)` | raw values 優先讀 request snapshot |
| `contractRequestGetObjects_` | `(sheet)` | raw values 優先讀 request snapshot |
| `tenantRuntimeReadSheet_` | `(ss, sheetName)` | canonical resolver 也使用同一 snapshot layer |
| `resolveCanonicalTenantRuntimeByLineUid_` | `(lineUserId, options)` | signature 保留；相同 identity/profile 可 reuse canonical context |

各 reader 仍保留自己的 row-object mapping，因此：

- `workspaceGetObjectsWithRow_` 的 `__row_number` 不變。
- `contractRequestGetObjects_` 的 `_sheet_row` 不變。
- `getSheetObjects_` 的空列過濾行為不變。
- Date、number、boolean 與原始 Sheet value 型別不變。

## 7. Debug counter

每個已啟用的 request 結束時，Execution Logger 會輸出一筆不含 UID、token 或
資料內容的紀錄：

```text
[V2_RUNTIME_SNAPSHOT] {
  "action": "tenant_home",
  "enabled": true,
  "full_sheet_reads_before": 7,
  "full_sheet_reads_after": 7,
  "full_sheet_reads_saved": 0,
  "cache_hits": 0,
  "snapshot_sheet_count": 7
}
```

欄位定義：

- `full_sheet_reads_before`：若沒有 snapshot，參與本 layer 的 readers 預計會執行
  的 full-read 次數。
- `full_sheet_reads_after`：實際 cache miss 並執行 full-read 的次數。
- `full_sheet_reads_saved`：兩者差額。
- `cache_hits`：raw Sheet 或 canonical context reuse 次數。
- `snapshot_sheet_count`：本 request 保存的唯一 Sheet 數。

Counter 只寫 Apps Script Execution Logger，不加入 API payload，因此 API response
schema 完全不變。Logger 失敗也不會讓 API request 失敗。

## 8. Read reduction estimate

| Scenario | Before | After | Estimate |
|---|---:|---:|---:|
| `tenant_home` 第一次 canonical resolution | 7 | 7 | 0；七張皆為必要且唯一 |
| 同 request 第二次相同 Home resolver | 14 cumulative | 7 cumulative | 減少 7 |
| 同 request 兩個 generic readers 讀同一 Sheet | 2 | 1 | 減少 1 |
| `tenant_bills` 現行單次正常 path | 4 | 4 | 0；四張目前皆唯一 |
| `tenant_message_init` 現行正常 path | 9 | 9 | 0；resolver 8 張 + messages 1 張 |
| `tenant_contract_init` 一般已綁定 path | 約 9–11 | 約 9–11 | Sheet 都不同時為 0；重複 helper call 時才節省 |

因此本階段主要建立安全的 consolidation layer 與可量測 counter，不宣稱現行
Tenant Home 首次載入已再減少 read count。跨 Home/Contract 兩支 HTTP request 的
重複 I/O 不在 request-level snapshot 能力範圍內；在禁止 CacheService 與 API/UI
調整的限制下，不能合併。

## 9. 修改檔案

- `apps-script/V2_RUNTIME_SNAPSHOT.js`（新增）
- `apps-script/程式碼.js`
- `apps-script/V2_API.js`
- `apps-script/V2_TENANT_RUNTIME_RESOLVER.js`
- `apps-script/V2_WORKSPACES.js`
- `apps-script/V2_CONTRACT_REQUESTS.js`
- `docs/70-RUNTIME-SNAPSHOT-CONSOLIDATION.md`（新增）

沒有修改 frontend HTML、API route 名稱、response schema、Sheet schema、manifest
或 deployment configuration。

## 10. 驗證

執行項目：

- 所有修改 Apps Script 檔案 `node --check`
- request snapshot mock：同 Sheet 讀兩次，before=2、after=1
- disabled write action mock：同 Sheet 讀兩次，實際 reads=2
- `git diff --check`
- `npm run validate`

## 11. 風險與 rollback

| 風險 | 等級 | 控制 |
|---|---|---|
| Apps Script execution reuse 導致跨 request state | P0 | 每次 `doGet` 無條件覆寫 state；response output 清除 |
| Workspace 資料交叉 | P0 | snapshot key 包含 spreadsheet ID + sheet ID；既有 workspace filters 不變 |
| write 後讀到 stale rows | P0 | 只對四個 read-only init/read routes 啟用 |
| 不同 reader row metadata 不一致 | P1 | 只 cache raw values，各 reader 維持原 mapping |
| API payload 出現 debug 資訊 | P1 | counter 僅 Logger，output object 未修改 |
| Logger 影響 response | P2 | logger 包在 try/catch，先清除 state |

Rollback：還原四個 reader 的 `runtimeSnapshotGetValues_()` 呼叫、resolver context
reuse、`doGet` begin 與 output finish，並移除 `V2_RUNTIME_SNAPSHOT.js`。不需要資料
migration 或 Sheet rollback。

本 Phase 未執行 commit、Git push、`clasp push` 或 deploy，等待人工 review。
