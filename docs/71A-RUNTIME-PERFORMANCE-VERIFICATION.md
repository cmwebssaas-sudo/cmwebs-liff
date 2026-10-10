# Phase 71A — Runtime Performance Verification

日期：2026-07-21

狀態：**LOCAL VERIFICATION COMPLETE / PRODUCTION PHASE 70 METRICS NOT OBSERVABLE**

## 1. 驗證目的與邊界

本階段驗證 Phase 70 request-level runtime snapshot 是否覆蓋指定 routes、readers
與 canonical resolver，並檢查 counter 行為。

限制為不修改 production code、不 `clasp push`、不 deploy、不改設定。檢查時
確認：

- `apps-script/V2_RUNTIME_SNAPSHOT.js` 仍是本機未追蹤檔。
- Phase 70 修改仍在 local working tree。
- 既有 Web App version 74 與 `release/` tree 不包含 Phase 70 snapshot module。

因此目前 production Web App 無法輸出 `[V2_RUNTIME_SNAPSHOT]` counter。對 production
endpoint 發 request 只會測到舊 runtime，不能被標示為 Phase 70 實測結果。本輪沒有
發送四個 tenant identity requests；這些 handlers 仍會呼叫 access logger，可能寫入
`V2_liff_access_logs`，也不符合無副作用驗證原則。

## 2. Baseline evidence

### Phase 68 HTTP baseline

Phase 68 對 version 74 的安全空身份 route 量測：

| Run | Start | End | Total latency | 說明 |
|---:|---|---|---:|---|
| 1 | 未保存 wall-clock timestamp | 未保存 wall-clock timestamp | 2.014 s | 空身份、無 tenant resolver |
| 2 | 未保存 wall-clock timestamp | 未保存 wall-clock timestamp | 2.695 s | 空身份、無 tenant resolver |
| 3 | 未保存 wall-clock timestamp | 未保存 wall-clock timestamp | 2.374 s | 空身份、無 tenant resolver |
| Average | — | — | 2.361 s | Apps Script/HTTP 固定成本 baseline |

這些數字不是 Phase 70 route latency，不能用來聲稱 snapshot 改善。

### Phase 69 Sheet-read baseline

| Baseline | Full-sheet reads | 備註 |
|---|---:|---|
| Phase 68/69 原始 `tenant_home` canonical resolver | 約 8 | 含 `V2_bills` master |
| Phase 69 local Home profile | 7 | 省略 Home projection 不使用的 bill master |
| Phase 70 expected first Home resolution | 7 | 七張必要 Sheet 仍需第一次讀取 |
| Phase 70 same-request second Home resolution | 0 additional | canonical context reuse；cumulative 14 before / 7 after |

## 3. Route verification

使用者指定的 `tenant_contract` 在 dispatcher 中不是正式 route 名稱；canonical route
是 `tenant_contract_init`。本報告不假設或新增 `tenant_contract` alias。

| Requested page/API | Exact route | Handler | Reader chain | Snapshot enabled |
|---|---|---|---|---|
| Tenant Home | `tenant_home` | `getTenantHomeByLineUid()` | canonical resolver → `tenantRuntimeReadSheet_()` | YES |
| Tenant Bills | `tenant_bills` | `getTenantBillsByLineUid()` | bills payload → identity reader / `getSheetObjects_()` | YES |
| Tenant Contract | `tenant_contract_init` | `getTenantContractInitByLineUid_()` | contract identity/current contract/projection → `contractRequestGetObjects_()` | YES |
| Tenant Message | `tenant_message_init` | `getTenantMessageInitByLineUid()` | canonical resolver → `tenantRuntimeReadSheet_()` + `getSheetObjects_(V2_tenant_messages)` | YES |

`doGet()` 在 route dispatch 前呼叫 `runtimeSnapshotBegin_(v2Action)`。JSON、JSONP 與
HTML bridge response 分別在 `jsonOutput_()`／`htmlBridgeOutput_()` 呼叫
`runtimeSnapshotFinish_()`，所以 counter 位於同一次 Web App execution 邊界。

## 4. Expected first-request metrics

下表來自目前 local call graph，不是 production execution log：

| Route | Necessary unique full reads | Expected snapshot hits | Resolver reuse | Expected counter before/after |
|---|---:|---:|---:|---|
| `tenant_home` | 7 | 0 | 0 | 7 / 7 |
| `tenant_bills` | 4 | 0 | N/A；使用 bills identity resolver | 4 / 4 |
| `tenant_contract_init` | 約 9–11 | 通常 0 | N/A；使用 contract request resolver | 約 9–11 / 約 9–11 |
| `tenant_message_init` | 9 | 0 | 0 | 9 / 9 |

First load 維持必要 reads 是預期行為。Snapshot 不會消除第一次取得不同 Sheets 的
I/O，也不能在 `tenant_home` 與 frontend 平行發出的 `tenant_contract_init` 兩個
HTTP requests 之間共享記憶體。

## 5. Same-request reuse verification

### Raw Sheet snapshot

以 local mock Sheet 執行同一 request 兩次
`runtimeSnapshotGetValues_(sheet)`：

| Metric | Result |
|---|---:|
| Reader requests / before | 2 |
| Actual full reads / after | 1 |
| Snapshot hits | 1 |
| Reads saved | 1 |
| Status | PASS |

以 disabled write action 執行相同測試，兩次 reader requests 產生兩次實際 reads，
證明 write route 不會意外使用 stale snapshot。

### Canonical resolver context

Static call-path 確認 `resolveCanonicalTenantRuntimeByLineUid_()`：

1. 以 LINE identity、tenant/contract/workspace options 與 bill-master profile 建立 key。
2. 優先呼叫 `runtimeSnapshotGetContext_('tenant_runtime', key)`。
3. First resolution 完成後呼叫 `runtimeSnapshotSetContext_()`。
4. 相同 request、相同 key 的第二次呼叫回傳 canonical context，並記錄 7 或 8 個
   avoided reads。

Local context mock 結果：

| Metric | Result |
|---|---:|
| Resolver-equivalent reads before | 7 |
| Actual reads after context hit | 0 |
| Snapshot hits | 1 |
| Resolver reuse | 1（由 context hit 路徑確認） |
| Status | PASS |

## 6. Actual Web App request record

Phase 70 尚未 push/deploy，因此下列欄位不能由現有 Web App 取得：

| Route | Request start | Request end | Latency | Full reads | Snapshot hits | Resolver reuse | Status |
|---|---|---|---|---:|---:|---:|---|
| `tenant_home` | NOT EXECUTED | NOT EXECUTED | NOT OBSERVABLE | NOT OBSERVABLE | NOT OBSERVABLE | NOT OBSERVABLE | BLOCKED BY NO DEPLOY |
| `tenant_bills` | NOT EXECUTED | NOT EXECUTED | NOT OBSERVABLE | NOT OBSERVABLE | NOT OBSERVABLE | N/A | BLOCKED BY NO DEPLOY |
| `tenant_contract_init` | NOT EXECUTED | NOT EXECUTED | NOT OBSERVABLE | NOT OBSERVABLE | NOT OBSERVABLE | N/A | BLOCKED BY NO DEPLOY |
| `tenant_message_init` | NOT EXECUTED | NOT EXECUTED | NOT OBSERVABLE | NOT OBSERVABLE | NOT OBSERVABLE | NOT OBSERVABLE | BLOCKED BY NO DEPLOY |

這不是功能 FAIL；它表示在禁止 push/deploy 的條件下，現有 production execution
不可能載入 Phase 70 instrumentation。不得把 local mock 或舊 version 74 latency
標示成 production Phase 70 PASS。

## 7. Duplicate-read and resolver coverage findings

### Same-request duplicate Sheet reads

- `tenant_home` 正常 first resolution：沒有重複 Sheet；7 張皆唯一。
- `tenant_bills` 正常 path：tenants、contracts、tenant bill View、bills 各一次。
- `tenant_message_init`：resolver 的 8 張與 messages Sheet 不重複。
- `tenant_contract_init`：一般已綁定 path 依序讀 identity View、contracts、requests、
  rooms、landlords、properties、bills 與 legacy supplement；常見 path 主要是不同 Sheets。
- 若 nested helper 在同 request 再要求同一 Sheet，三個 generic readers 與 resolver
  reader 都會使用相同 raw-values snapshot。

結論：目前沒有證據顯示四個正常 first-load paths 仍重複 full-read 同一張 Sheet。
Phase 70 的主要價值是防止 nested/repeated resolver 產生額外 reads，而非降低所有
first load 的必要 reads。

### Resolver coverage

Snapshot 已覆蓋 canonical resolver：

- `tenantRuntimeReadSheet_()` 使用 `runtimeSnapshotGetValues_()`。
- `resolveCanonicalTenantRuntimeByLineUid_()` 使用 canonical context get/set。
- Home 的 `include_bill_master: false` 與 Message 的完整 profile 使用不同 context key，
  不會把缺 bill master 的 Home context 誤用為完整 context。

未發現「snapshot 未覆蓋 resolver」。

### Instrumentation limitation

Logger 目前有 `cache_hits`，但沒有獨立的 `resolver_reuse_count` 欄位。Resolver reuse
可以由 context-hit call path 與 avoided-read count 推導，但 production log 無法將
raw Sheet hit 與 resolver context hit 分開。依本輪限制只報告，不修改 counter schema。

## 8. Production verification procedure after approval

只有在未來經人工批准 push/deploy 後，才能完成 actual request verification：

1. 記錄部署 version 與 rollback version。
2. 對每個 route 各執行至少 5 次，記錄 request start/end wall-clock timestamp。
3. 以同一 Apps Script execution 的 `[V2_RUNTIME_SNAPSHOT]` log 對應 action。
4. 記錄 before、after、saved、cache hits、snapshot Sheet count。
5. 將 cold first sample 與 warm samples 分開，計算 median/p95。
6. 驗證 API payload 與部署前 fixture 完全一致。
7. 若 after 大於唯一必要 Sheet 數、或相同 Sheet 仍出現直接 full-read，標示 FAIL。

正式 route 仍會寫 access log；若測試政策禁止任何 Sheet write，需先設計獨立的
admin-only read validation path，不能直接把 tenant route 當成唯讀 probe。

## 9. Verification result

| Check | Result |
|---|---|
| Snapshot raw Sheet reuse | PASS（local mock） |
| Canonical resolver context coverage | PASS（static + local context mock） |
| API route names / handlers | PASS |
| API response schema unchanged | PASS（static diff） |
| Phase 70 production latency | NOT OBSERVABLE；not deployed |
| Phase 70 production counters | NOT OBSERVABLE；not deployed |
| `npm run validate` | PASS：34 Apps Script files、68 unique routes、68/68 handlers |

本 Phase 只新增本驗證文件，沒有修改 Apps Script、HTML、API、Sheet schema、設定或
deployment，也沒有執行 commit、push、`clasp push` 或 deploy。
