# Phase 69 — Runtime Performance Optimization

日期：2026-07-21

範圍：`tenant_home` 單一 Apps Script request 的 Sheet read 最小化

狀態：**IMPLEMENTED LOCALLY — NOT PUSHED / NOT DEPLOYED**

## 1. 目標與限制

本階段只改善 Phase 68 確認的 Google Sheets full-read latency。保留既有
`tenant_home` route、handler、JSON contract、Workspace isolation、衝突檢查與
access logging 行為；沒有修改 UI、Sheet schema、deployment strategy 或資料。

本階段沒有加入 `CacheService`。最佳化只存在於同一次 request 的記憶體內，
不會跨 request 共用身份或資料。

## 2. Tenant Home runtime path

目前正式呼叫鏈：

```text
tenant_home
↓
getTenantHomeByLineUid(lineUserId)
↓
resolveCanonicalTenantRuntimeByLineUid_(lineUserId, options)
↓
tenantRuntimeReadSnapshot_(spreadsheet, options)
↓
tenantRuntimeResolveCanonicalFromSnapshot_(snapshot, lineUserId, options)
↓
tenantRuntimeHomeData_(canonicalContext, tenantHomeRow)
```

canonical context 在一次 request 內只建立一次，並共同持有：

- tenant identity
- active contract
- workspace
- property
- room
- deterministic landlord link
- tenant home View rows
- tenant bill View rows

`tenantRuntimeHomeData_()` 只在上述 context 上執行 filter、sort、reduce 與
projection，不再次讀取 Sheet。

## 3. 優化前讀取盤點

優化前，canonical resolver 會無條件對下列 8 張表各執行一次
`getDataRange().getValues()`：

1. `V2_tenants`
2. `V2_contracts`
3. `V2_tenant_home_view`
4. `V2_tenant_bill_view`
5. `V2_bills`
6. `V2_rooms`
7. `V2_properties`
8. `V2_landlord_tenant_list_view`

單一成功的 `tenant_home` request 內沒有對同一張表重複 full-read；真正的浪費
是無條件讀取 `V2_bills`。Home projection 的帳單摘要只使用
`V2_tenant_bill_view`，而 `V2_bills` 在 canonical resolver 中只用來計算
`missing_bill_view_bill_ids` 診斷欄位，不參與 Home JSON。

失敗路徑仍可能呼叫既有 binding-state fallback。為避免改變錯誤分類與登入／
綁定行為，本階段沒有重寫該 fallback。

## 4. 實作

`resolveCanonicalTenantRuntimeByLineUid_()` 與
`tenantRuntimeReadSnapshot_()` 新增向後相容的 optional options 參數。預設值
仍讀取完整 8 張表，所有既有呼叫端行為不變。

`getTenantHomeByLineUid()` 明確傳入：

```javascript
{
  include_bill_master: false
}
```

因此只有 Tenant Home 成功路徑略過 `V2_bills`。Resolver 仍回傳既有
canonical object shape；在此 profile 下，僅內部診斷欄位 `bill_rows` 與
`missing_bill_view_bill_ids` 為空陣列。Home projection 未讀取這兩個欄位，
所以對外 JSON 格式與值維持不變。

## 5. Full-sheet reads 前後比較

| 範圍 | 優化前 | 優化後預期 | 差異 |
|---|---:|---:|---:|
| 單一成功 `tenant_home` request | 8 | 7 | -1（-12.5%） |
| Resolver 其他呼叫端（預設 profile） | 8 | 8 | 不變 |
| Home 頁的獨立 `tenant_contract_init` request | 約 9–11 | 約 9–11 | 本階段不處理 |
| Home 頁初載合計 | 約 17–19 | 約 16–18 | -1 |

Google Sheets latency 取決於每張表 row count、Apps Script 啟動狀態與服務負載，
本地靜態驗證不能聲稱實際毫秒改善。部署後應以相同 tenant、相同網路與多次
樣本比較 p50/p95；本階段只記錄可由 call graph 確認的 read-count 降幅。

## 6. 修改檔案

- `apps-script/V2_TENANT_RUNTIME_RESOLVER.js`
  - snapshot reader 支援 optional `include_bill_master`。
  - canonical resolver 將同一 options 傳給 snapshot 與 projection。
  - 預設完整讀取行為不變。
- `apps-script/V2_API.js`
  - `tenant_home` handler 使用省略 bill master 的 request-local profile。
- `docs/69-RUNTIME-PERFORMANCE-OPTIMIZATION.md`
  - 本文件。

沒有修改 `程式碼.js`、route 名稱、HTML、manifest、Sheet schema 或 deployment。

## 7. API contract 保護

`getTenantHomeByLineUid()` 的成功與失敗 response schema 均未修改：

- `success`
- `code`
- `message`
- `data`

`tenantRuntimeHomeData_()` 本身未修改，所有對外欄位、fallback 順序與型別維持
原狀。本階段也沒有改動 test identity、LIFF、JSONP 或 endpoint。

## 8. 風險評估

| 風險 | 等級 | 控制措施 |
|---|---|---|
| Home 未來開始依賴 `V2_bills` master-only 欄位 | P2 | profile 僅由 Home 明確啟用；新增依賴時須恢復該 read 或擴充 projection |
| options 影響其他 resolver 呼叫端 | P2 | options 為 optional，預設 `include_bill_master !== false`，既有呼叫維持完整 snapshot |
| Workspace / landlord link isolation 被弱化 | P0（已避免） | tenants、contracts、properties、rooms、landlord link 等 7 張必要資料仍完整讀取與驗證 |
| View 與 bill master 不一致未在 Home request 被偵測 | P1 | `missing_bill_view_bill_ids` 是內部診斷資訊，不影響既有 Home contract；診斷與其他預設呼叫仍讀 master |
| 實際 latency 降幅小於 read-count 降幅 | P2 | 部署前不宣稱毫秒改善；部署後以 timing 樣本驗證 |

## 9. 驗證與 rollback

本地驗證項目：

- `npm run validate`
- 修改 Apps Script 檔案 JavaScript 語法檢查
- `git diff --check`
- 靜態確認 `tenantRuntimeHomeData_()` 不使用 `canonical.bill_rows` 或
  `canonical.missing_bill_view_bill_ids`
- 靜態確認所有其他 resolver 呼叫端未傳入省略 profile

Rollback 僅需還原：

1. `V2_API.js` 的 `include_bill_master: false` 呼叫參數。
2. `V2_TENANT_RUNTIME_RESOLVER.js` 的 optional snapshot profile。

本 Phase 未執行 commit、Git push、`clasp push` 或 deploy，等待人工 review。
