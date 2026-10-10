# Phase 68 — Runtime Performance Audit

日期：2026-07-21

範圍：CMWebs V2 Tenant frontend 與 Apps Script read runtime

狀態：**DIAGNOSIS ONLY — NO PRODUCTION CODE CHANGE**

## 1. 測試方法與限制

本輪只做效能診斷，沒有修改 HTML、Apps Script、API route、Sheet
schema、manifest、deployment 或 frontend endpoint。

為避免產生正式資料，本輪沒有直接呼叫帶房客身份的 HTTP routes。這些
routes 會呼叫 `logLiffAccess_()` 或模組自己的 access logger，成功或失敗
都可能 append access-log row。採用以下唯讀證據：

1. 以無 cookie 的 HTTP 請求量測四個 GitHub Pages HTML 的 DNS、TLS、
   TTFB、下載時間與大小。
2. 對既有 v74 Web App 的 `tenant_binding_status` 空身份路徑執行三次
   timing。此路徑在缺少 UID 時會於 Sheet access 之前回傳
   `MISSING_LINE_UID`，不讀寫 Sheet。
3. 靜態追蹤四個 frontend 的 LIFF、JSONP、timeout、render 與初始化流程。
4. 靜態追蹤 tenant resolver、Home、Bills、Contract、Message 的 Sheet
   read 與 projection call chain。
5. 使用 Phase 63B 已完成的
   `validateProductionTenantResolverReadOnly()` 執行紀錄作為 resolver +
   bills projection 的 coarse runtime baseline。該函式唯讀，當次約 4 秒，
   且 `bill_count=1`。

因此，本文件的「各頁載入時間」分成可實測的 shell/network 時間與由
call chain 推導的 runtime waiting。沒有把未執行的正式身份請求標示為
實測結果。

## 2. Frontend loading analysis

### 2.1 靜態頁面交付時間

| Page | HTTP | TTFB | Total | Download |
|---|---:|---:|---:|---:|
| `tenant-home.html` | 200 | 0.500 s | 0.591 s | 49,713 B |
| `tenant-bills.html` | 200 | 0.555 s | 0.674 s | 66,654 B |
| `tenant-contract.html` | 200 | 0.533 s | 0.650 s | 66,882 B |
| `tenant-message.html` | 200 | 0.512 s | 0.549 s | 40,684 B |

四頁的靜態 shell 都在 0.7 秒內完成下載。HTML 大小為 40–67 KB，沒有
證據顯示 GitHub Pages 或 HTML 檔案大小是主要瓶頸。

### 2.2 API request topology

| Page | Initial API requests | Mode | Timeout | Primary render dependency |
|---|---|---|---:|---|
| Tenant Home | `tenant_home`, `tenant_contract_init` | parallel | 30 s each | waits for both via `Promise.allSettled` |
| Tenant Bills | `tenant_bills`, `tenant_payment_report_init` | parallel | 30 s each | waits for both via `Promise.allSettled` |
| Tenant Contract | `tenant_contract_init` | single | 30 s | waits for the one request |
| Tenant Message | `tenant_message_init` | single | 20 s | waits for the one request |

Home 與 Bills 沒有把兩支 API 串成 sequential calls，這是正確的；但
`Promise.allSettled` 仍會等到 optional secondary request 完成或 timeout，
才執行 primary render：

- Home 即使 `tenant_home` 已完成，也會等 `tenant_contract_init`。
- Bills 即使 `tenant_bills` 已完成，也會等
  `tenant_payment_report_init`。

因此 optional request 最壞可額外阻塞 primary content 30 秒。

### 2.3 重複 request 與不必要等待

- 四頁各自只在 script 結尾自動呼叫一次 `loadPage()`，沒有發現兩個
  automatic bootstrap handler 重複啟動同一頁。
- Home/Bills 的兩支 request action 不同，不是同 route duplicate；但後端
  會重複解析相同 tenant/contract/property/room 身份並重讀重疊 Sheets。
- refresh/error UI 可再次呼叫 `loadPage()`，但只有 loading 樣式，沒有明確
  shared in-flight promise 或 request cancellation。快速重複操作可能形成
  concurrent reload。
- Home 與 Contract 的 JSONP `script.onerror` 只寫 warning，不立即 reject，
  會等完整 30 秒 timer。Bills 與 Message 會立即 reject，失敗回饋較快。
- LIFF initialization 必須在正式模式先完成，屬必要等待；`test=1` 會直接
  使用測試身份，不等待 LIFF。

### 2.4 Rendering time

四頁的 `renderPage()` 都是在 API 回應後同步建立 DOM；目前測試房客只有
1 筆 bill，靜態分析沒有發現 request 後的固定動畫等待或大型 client-side
計算。因本輪禁止觸發會寫 access log 的正式身份 route，沒有直接取得
authenticated render milestone。

結論：render latency 尚未有實測毫秒值，但現有證據不支持它是主要瓶頸。
使用者看到的 loading 時間主要在 render 前的 LIFF/API/Sheet waiting。

## 3. API latency

v74 Web App 空身份安全路徑三次結果：

| Run | HTTP | TTFB | Total | Payload |
|---:|---:|---:|---:|---:|
| 1 | 200 | 1.971 s | 2.014 s | 135 B |
| 2 | 200 | 2.694 s | 2.695 s | 135 B |
| 3 | 200 | 2.356 s | 2.374 s | 135 B |
| Average | 200 | 2.340 s | **2.361 s** | 135 B |

這條路徑沒有 tenant resolver 或 Sheet read，仍需要約 2.0–2.7 秒，代表
Apps Script Web App 啟動、Google redirect/serving 與 response delivery
本身已有明顯固定成本。

三次中第一筆不是最慢，沒有單次明顯 cold-start spike；但樣本數只用於
窄範圍診斷，不能排除長時間閒置後的 cold start。

## 4. Backend runtime analysis

### 4.1 Canonical resolver

`resolveCanonicalTenantRuntimeByLineUid_()` 每次執行會建立完整 snapshot，
依序對以下 8 張 Sheets 呼叫 `getDataRange().getValues()`：

1. `V2_tenants`
2. `V2_contracts`
3. `V2_tenant_home_view`
4. `V2_tenant_bill_view`
5. `V2_bills`
6. `V2_rooms`
7. `V2_properties`
8. `V2_landlord_tenant_list_view`

這些都是整表讀取，再於 Apps Script memory 中 filter、sort 與驗證。即使
只查一位房客，read volume 仍隨每張 Sheet 的總 row count 成長。

### 4.2 Projection runtime

`tenantRuntimeHomeData_()` 在既有 snapshot 上做 filter、sort、reduce 與
object projection，不再讀 Sheet。Bills public payload 也主要在資料讀取後
做 map、sort 與 JSON-safe conversion。

Phase 63B 的 read-only validation 約 4 秒完成。該驗證包含一次 8-Sheet
canonical snapshot，以及 Bills path 的 tenants、contracts、bill view、
bills 4 次整表讀取，共約 12 次 full-range reads，再加 projection。相對於
空身份 Web App 平均 2.36 秒，Sheet reads 是合理的主要增量來源；本輪沒有
加入 instrumentation，因此不能把 4 秒精確拆成 resolver 與 projection
毫秒值。

### 4.3 各 runtime path 的 Sheet reads

| Runtime path | Confirmed full-sheet reads | Notes |
|---|---:|---|
| `tenant_home` | 8 | canonical snapshot；完成後另有 access-log write |
| `tenant_bills` | 4 | tenants、contracts、tenant bill view、bills；另有 access-log write |
| `tenant_contract_init` | 約 9–11 | identity view、contracts、requests、rooms、landlords、properties、bills、最多兩張 legacy bill sheets |
| `tenant_message_init` | 9 | canonical 8 sheets + tenant messages；另有 access-log write |

Home 頁同時呼叫 Home 與 Contract，因此一次初始頁面可能造成約
17–19 次 full-sheet reads。兩條 path 重複讀取 tenants/contracts、rooms、
properties、bills 或其 views。

Bills 頁的 secondary payment-report request 也會再解析身份與讀取相關
資料，因此前端的 parallel request 雖降低 sequential latency，沒有消除
Google Sheets I/O duplication。

### 4.4 Payload size / over-fetching

- 安全空身份 response 實測為 135 B。
- 正式 tenant payload 未透過 HTTP 量測，避免 access-log write。
- Tenant Bills 目前 `bill_count=1`，單次帳單資料量不是主要風險。
- Bills payload 每筆包含完整金額、電表、狀態及 identity 欄位；Contract
  回傳全部 requests 與 supplement；Message 回傳該 tenant 的全部 messages。
- 上述 collections 沒有 pagination 或 response field projection。資料成長後
  會形成 over-fetching，但目前沒有證據顯示 payload 是現階段主瓶頸。

## 5. Root cause classification

| Classification | Result | Evidence |
|---|---|---|
| A. Apps Script cold start | Secondary / possible | 無 Sheet 的 API baseline 已是 2.0–2.7 s；三次未見明顯單次 cold spike |
| B. Google Sheets read latency | **Primary** | 每個 identity request 讀 4–11 張整表；Home 初載約 17–19 次 |
| C. API response latency | **Primary user-visible cost** | 空身份平均 2.361 s，identity path 尚會疊加 Sheet I/O |
| D. Frontend rendering latency | Low confidence / not primary | HTML 0.55–0.67 s；render 前 waiting 明顯較大，未發現重型 client computation |
| E. Payload size / over-fetching | Secondary / growth risk | 現有 1 bill 很小，但 Contract、Bills、Messages 無 pagination |

主要瓶頸為 **B + C**：Apps Script 固定 response cost，加上多次 Google
Sheets full-range reads。前端 optional request barrier 與 20–30 秒 failure
timeout 會放大使用者感受到的 loading，但不是正常回應本身的主要計算成本。

## 6. Phase 69 優化建議

本輪不執行下列建議。建議 Phase 69 先建立可回歸、可 rollback 的窄範圍
優化，不同時改 route schema 與 UI。

### Priority 1 — Sheet I/O 與 identity reuse

1. 量測並記錄 resolver、Sheet read、projection 的分段時間。
2. 同一 request/page session 共用 canonical identity snapshot，避免 Home 與
   Contract、Bills 與 Payment Report 重複讀相同 Sheets。
3. 評估用已維護的 indexed view／限定 range 取代 8–11 張整表讀取。
4. 保持 Workspace isolation 與 deterministic conflict detection，不以
   first-row-wins 換取速度。

### Priority 2 — Primary content 不等待 optional API

1. Home 先 render `tenant_home`，Contract banner 後補。
2. Bills 先 render `tenant_bills`，Payment Report 後補。
3. JSONP `script.onerror` 應結束 request，不等待 30 秒；timeout 仍保留作
   最後防線。
4. refresh 增加 in-flight guard 或取消舊 callback，避免快速點擊形成重複
   API calls。

### Priority 3 — Payload growth control

1. Message、Contract requests 與 Bills 加入明確 page/limit policy。
2. 回傳頁面實際使用欄位，避免 identity 與 supplement 重複包裝。
3. 在不記錄 UID/secret 的前提下量測 serialized payload bytes。

### Priority 4 — Rendering micro-optimization

只有在完成真機 Performance timeline 並證實 DOM/render 超過可接受門檻後，
才處理 DOM batching、virtualization 或 animation。現階段不應優先改 UI。

## 7. 結論

- 已找到 bottleneck：**Google Sheets full-range reads 與 Apps Script API
  response latency**。
- 建議進入 Phase 69，但先做 timing instrumentation 與 identity/read reuse，
  不做大規模重構。
- 優先順序：**Sheet I/O → optional API waiting → payload growth → frontend
  rendering**。

本 Phase 只新增本診斷文件；未修改或部署任何 production code、HTML、route、
manifest、Sheet schema 或資料。
