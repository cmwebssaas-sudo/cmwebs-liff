# V2 Canonical Merge Plan

建立日期：2026-07-19（Asia/Taipei）  
依據文件：[`22-BASELINE-DIFF-REPORT.md`](22-BASELINE-DIFF-REPORT.md)  
適用範圍：V2 Production Consolidation / Gate 0  
文件狀態：合併計畫；本文件本身不執行合併、部署或資料 migration

## 目標與邊界

本計畫的唯一目標是把目前分散在 repository、實際 deployed Apps Script 匯出與 candidate overlay 的內容，整併為可由 repository 唯一重建、驗證及 rollback 的 V2 internal-beta baseline。

本計畫不包含：

- 新增圖形化報表
- 新增報修工單
- 新增退租功能
- V3／V4 功能
- 更換既有 Apps Script Web App URL
- 未經備份直接修改 Google Sheets
- 將 `test=1` 當成 dry-run

## 1. Canonical baseline 決策

### 1.1 Apps Script baseline

Canonical Apps Script 的恢復基準採用 `_deployed/apps-script`，原因如下：

1. Deployed 是唯一包含目前 68 routes 完整第一層 handler 與必要第二層依賴的來源。
2. Candidate 的 21 個 Apps Script 模組全部是 deployed 的內容子集；20 個逐位元相同，1 個只差檔尾空白。
3. Candidate 缺少 6 個 route 的直接 handler、6 個 Workspace proxy 的第二層 handler，以及 JSONP、bridge、webhook、LINE、sheet/access log 等共用 runtime helper。
4. Repository 目前沒有 canonical Apps Script，無法單獨重建 Web App。

Canonical 目錄規劃為：

```text
apps-script/
  Code.gs
  V2_*.gs
  TESTS.gs
  appsscript.json
```

正規化規則：

- `程式碼.js` 正規化為唯一 `Code.gs`。
- Deployed `.js` 正規化為 `.gs`，副檔名變更不得伴隨未審核的功能改寫。
- 每個 canonical basename 只能有一個檔案。
- 不保留 `_FIXED`、`_WITH_SETTINGS`、`_WITH_TEAM_NOTIFICATIONS`、`final-*`、`complete-*` 或 `new-*` 版本式副本。
- Candidate 與 deployed 不得直接疊加；兩者並存會重複 692 個 function 與 60 個 top-level 變數。

### 1.2 Shared Apps Script modules

Deployed 與 candidate 內容相同的 21 個模組，不做「候選覆蓋 deployed」或「deployed 覆蓋候選」的版本推定。Canonical merge 使用已驗證相同的內容，並保存來源 hash 作為 provenance。

`V2_WORKSPACE_DASHBOARD_NATIVE` 只差檔尾空白，視為相同功能；canonical 檔只保留一份。

### 1.3 Deployed-only modules

Deployed-only 模組先完整保留到 canonical baseline，不在 Gate 0 期間提前刪除或拆分。這些模組包含現行 route/runtime 依賴、legacy reconciliation 與 production 診斷能力。

其中：

- `V2_API` 在 P0 必須完整保留；拆分 common helpers 或退出 legacy dashboard 是 P2 工作。
- Payment settlement/manual/reversal/paid-bill modules 是 Workspace proxy 的正式第二層依賴，不能只保留 proxy。
- `V2_LEGACY_BILL_IMPORT` 與 V1/V2 sync 先保留，待 Schema 與資料對帳後再分類為 migration、runtime 或 rollback utility。
- `TESTS` 先保留，但任何可能寫資料、發 LINE、建立 trigger 或執行 repair 的函式不得直接在 production 無控執行。

### 1.4 Frontend baseline

Canonical frontend 以 repository root 為現行 GitHub Pages 基準，理由如下：

1. Repository 有完整 44 個 HTML；candidate 只有 26 個。
2. Candidate 沒有 candidate-only HTML。
3. Candidate 已收錄的 24 個非衝突頁與 repository 功能相同，因此不需要以 candidate 檔案覆蓋 repository。
4. Candidate 已收錄頁面仍連到 7 個 candidate 未收錄頁面；只部署 candidate public 會產生斷鏈。

Canonical frontend 暫時維持 repository root 部署結構，不在 Gate 0 強制搬到 `public/`，避免同時改變 GitHub Pages 路徑。

### 1.5 HTML conflict 決策

| 檔案 | Canonical baseline 決策 | 驗收要求 | Rollback 候選 |
|---|---|---|---|
| `tenant-home.html` | 採 repository 行為：保留未綁定時導向 `tenant-bind.html` 與帳單月份格式化。 | 未綁定、`TENANT_NOT_FOUND`、`TENANT_BINDING_REQUIRED`、正常首頁與 `test=1` 風險均需人工回歸。 | Candidate 原始版本及其 hash。 |
| `tenant-bills.html` | 暫採 repository 行為：full-height detail modal、overscroll containment、開啟時 scroll reset。 | iOS/Android LINE WebView、bottom nav、safe-area、modal z-index、長帳單可捲動與關閉後頁面狀態。 | Candidate bottom-sheet 版本及其 hash。 |

`tenant-bills.html` 的決策只有在 P1 實機驗收通過後才能成為正式 baseline；未通過時依 rollback strategy 回復 candidate bottom-sheet，再重新決策。

### 1.6 Repository-only HTML

18 個 repository-only HTML 在 Gate 0 一律先保留，不因 candidate 未收錄而刪除。

優先保留且驗證 candidate 已存在連結的 7 個頁面：

```text
landlord-activity.html
landlord-line-logs.html
landlord-messages.html
landlord-paid-bills.html
landlord-payment-reports.html
landlord-settings.html
landlord-workspaces.html
```

其餘 repository-only 頁面先標記 legacy/usage-review，不在未完成路由與使用紀錄盤點前刪除：

```text
announce.html
batch-meter.html
checkout.html
hub.html
identity.html
index.html
landlord-registry.html
landlord.html
meter.html
new-lease.html
tenant-checkin.html
```

`new-lease.html` 符合禁止的 `new-*` 命名模式，不可成為最終 canonical 檔名；其正式用途、導流與替代頁需在 P2 決定，Gate 0 期間不得直接刪除。

### 1.7 Secrets 與 deployment config

- `Code` 的功能需要保留，但硬編碼付款憑證不得進入 canonical commit。
- 合併 P0 必須同步完成憑證輪替計畫、移入 Apps Script Properties，以及不輸出 secret 值的驗證。
- 已暴露的 credential 不得以「回復舊值」作 rollback；只能輪替到新的有效值。
- `appsscript.json` 納入 canonical repository。
- `.clasp.json` 視為 deployment binding；是否提交 `scriptId` 必須依安全與部署政策另行決定。預設不把實際 ID 複製到公開內容或報告。
- Web App 重新部署時建立新 version，但維持既有 Web App URL。

### 1.8 Legacy 與 Workspace native

Gate 0 baseline 採「保留相容層、以 Workspace route 為入口」：

- Dashboard routes 維持 `V2_WORKSPACE_DASHBOARD_NATIVE`。
- LINE logs、房東傳訊與付款 routes 維持 Workspace access proxy，再委派現有正式 handler。
- `landlord_id` 暫時保留為相容欄位；`workspace_id` 是新架構主鍵。
- `V2_payment_accounts` 與 `V2_workspace_payment_accounts` 在 Schema reconciliation 完成前都保留，不做刪除或批次覆寫。
- Legacy handler 的退出、`V2_API` 拆分與付款帳號 migration 排到 P2，且必須先通過跨 Workspace isolation 與資料一致性測試。

## 2. 保留 deployed 模組清單

下列 30 個 deployed 程式檔均納入 canonical merge 輸入；canonical 副檔名統一為 `.gs`。

### 2.1 Dispatcher 與共用 runtime

```text
Code.gs                       <- 程式碼.js
V2_API.gs                     <- V2_API.js
```

`V2_API` 必須保留的 runtime 能力包括：

- `jsonOutput_`
- `htmlBridgeOutput_`
- `handleLineWebhook_`
- `pushLineTextMessage_`
- `cmwebsLogLineMessage_`
- `getSheetObjects_`
- `logLiffAccess_`
- Tenant home/bills handlers
- LINE logs／房東傳訊 handlers
- 現有 V1/V2 paid sync utilities

### 2.2 Workspace、身份與存取

```text
V2_WORKSPACES.gs
V2_WORKSPACE_CREATION.gs
V2_WORKSPACE_LANDLORD_ACCESS.gs
V2_WORKSPACE_DASHBOARD_NATIVE.gs
V2_WORKSPACE_OPERATION_AUDIT.gs
V2_TEAM_MANAGEMENT.gs
V2_LANDLORD_MANAGEMENT.gs
V2_LANDLORD_ONBOARDING.gs
V2_TENANT_BINDING_PHONE.gs
V2_TENANT_LEASE_ONBOARDING.gs
```

### 2.3 房源、設定與帳務

```text
V2_SYSTEM_SETTINGS.gs
V2_SETTINGS_INTEGRATION.gs
V2_PROPERTY_ROOM_MANAGEMENT.gs
V2_BILLING_MANAGEMENT.gs
V2_BILL_NOTIFICATIONS.gs
V2_AUTO_PAYMENT_REMINDER.gs
```

### 2.4 付款閉環與 legacy reconciliation

```text
V2_TENANT_PAYMENT_REPORTS.gs
V2_PAYMENT_SETTLEMENT.gs
V2_MANUAL_SETTLEMENT.gs
V2_PAYMENT_REVERSAL.gs
V2_PAID_BILL_MANAGEMENT.gs
V2_LEGACY_BILL_IMPORT.gs
```

### 2.5 租約、訊息、入住、公告與通知

```text
V2_CONTRACT_REQUESTS.gs
V2_TENANT_MESSAGES.gs
V2_TENANT_CHECKIN_MANAGEMENT.gs
V2_ANNOUNCEMENT_MANAGEMENT.gs
V2_WORKSPACE_NOTIFICATIONS.gs
```

### 2.6 測試

```text
TESTS.gs                      <- TESTS.js
```

### 2.7 Apps Script manifest

```text
appsscript.json
```

`.clasp.json` 不算業務模組；其 canonical policy 需在部署階段確認。

## 3. 採用 candidate HTML 清單

以下 24 個 candidate HTML 已確認與 repository 功能相同，視為 candidate 驗證通過的 canonical 功能內容。實際 merge 不需要以 candidate 覆蓋 repository；保留 repository 檔即可。

```text
landlord-announcements.html
landlord-arrears.html
landlord-bill-notifications.html
landlord-billing.html
landlord-contract-requests.html
landlord-entry.html
landlord-home.html
landlord-join.html
landlord-more.html
landlord-notifications.html
landlord-onboarding.html
landlord-properties.html
landlord-register.html
landlord-team.html
landlord-tenant-checkin.html
landlord-tenant-create.html
landlord-tenant-detail.html
landlord-tenants.html
tenant-bind.html
tenant-contract.html
tenant-message.html
tenant-payment-report.html
tenant-renewal.html
tenant-termination.html
```

以下 2 個 candidate HTML 不直接採用，依 1.5 的 conflict 決策處理：

```text
tenant-home.html
tenant-bills.html
```

Candidate-only HTML：無。

## 4. 必須補回的 missing modules

### 4.1 P0：Candidate 缺少的 runtime modules

| Canonical 模組 | 必須補回原因 | 直接影響 |
|---|---|---|
| `V2_API.gs` | JSONP/bridge、webhook、LINE、sheet/access log helper 與多個正式 handler。 | Candidate 單獨部署時所有 routes 缺 response helper，另有 tenant home/bills 與 proxy 依賴失效。 |
| `V2_TENANT_BINDING_PHONE.gs` | 房客綁定、手機正規化、LINE UID 跨表同步與 repair。 | `tenant_binding_status`、`tenant_bind_submit` 缺直接 handler。 |
| `V2_TENANT_LEASE_ONBOARDING.gs` | 房客建立、租約、Workspace 權限與 view 同步。 | `landlord_tenant_create_init`、`landlord_tenant_create` 缺直接 handler。 |
| `V2_PAYMENT_SETTLEMENT.gs` | 付款回報正式銷帳。 | `landlord_payment_report_settle` proxy 缺第二層 handler。 |
| `V2_MANUAL_SETTLEMENT.gs` | 手動銷帳與 legacy/audit sync。 | `landlord_bill_manual_settle` proxy 缺第二層 handler。 |
| `V2_PAYMENT_REVERSAL.gs` | 撤銷已繳、作廢付款、恢復欠款。 | `landlord_bill_reopen` proxy 缺第二層 handler。 |
| `V2_PAID_BILL_MANAGEMENT.gs` | 已繳帳單統一查詢。 | `landlord_paid_bills_init` proxy 缺第二層 handler。 |

### 4.2 P1：Reconciliation 與測試 modules

| Canonical 模組 | 必須補回原因 | 執行限制 |
|---|---|---|
| `V2_LEGACY_BILL_IMPORT.gs` | 保留正式資料 migration/reconciliation 與 preview 能力。 | 未取得 Schema snapshot、備份、月份範圍與人工批准前不得正式匯入。 |
| `TESTS.gs` | 保留 production diagnosis 與回歸線索。 | 先標記副作用；不得將 production 特定 ID 測試視為通用自動測試。 |

### 4.3 Deployment manifest

| 檔案 | 必須補回原因 |
|---|---|
| `appsscript.json` | 讓 repository 可重建 Apps Script runtime、timezone 與 Web App 設定。 |

### 4.4 Candidate public 缺少但已有連結的頁面

下列 7 頁必須保留於 canonical frontend，否則現有 candidate/repository 導覽會斷鏈：

```text
landlord-activity.html
landlord-line-logs.html
landlord-messages.html
landlord-paid-bills.html
landlord-payment-reports.html
landlord-settings.html
landlord-workspaces.html
```

## 5. Merge 順序（P0／P1／P2）

### P0：建立可重建、可驗證、無 secrets 的 backend baseline

P0 是任何部署前的阻擋階段。

1. 凍結三個來源的檔案清單與 SHA-256，記錄當前 deployed Apps Script version、Web App deployment ID、trigger 清單與 Script Properties 名稱；不得記錄 secret 值。
2. 建立 canonical `apps-script/` 結構。
3. 正規化 `程式碼.js` 為唯一 `Code.gs`，並正規化其餘 29 個 deployed `.js` 為 `.gs`。
4. 保留 21 個 deployed/candidate shared modules 的已驗證相同內容。
5. 補回 7 個 candidate 缺少的 P0 runtime modules。
6. 納入 `appsscript.json`；`.clasp.json` 依 deployment policy 處理。
7. 移除 canonical source 中的硬編碼付款憑證，改由 Apps Script Properties 讀取；依安全流程輪替已暴露 credentials。
8. 確認 `Code.gs` 是唯一 route dispatcher，68 routes 無重複。
9. 確認 68 個第一層 handler、6 個 proxy 第二層 handler與共用 runtime helper 全部存在。
10. 確認 deployed 與 candidate 未以不同副檔名並存，top-level function／const／let／var 無重複。
11. 執行靜態 validation；P0 未通過前不得 clasp push/deploy。

P0 exit criteria：

- Repository 可由 `apps-script/` 重建完整 68-route backend。
- 無硬編碼 secrets。
- 無重複 top-level 宣告與 route。
- Handler 與 transitive dependencies 全部可解析。
- `npm run validate` 通過，且 validator 已能掃描 canonical 目錄。
- 沒有修改 Google Sheets 或 production trigger。

### P1：Frontend canonicalization、Schema 對帳與核心流程回歸

1. 保留 repository root 44 個 HTML 作為初始 frontend baseline。
2. 確認 24 個採用 candidate 驗證的 HTML 功能不變。
3. 依 1.5 合併並實機驗收 `tenant-home.html` 與 `tenant-bills.html`。
4. 確認 7 個 candidate 導覽依賴頁存在且無 404。
5. 為其餘 11 個 repository-only 頁建立 usage/legacy 分類；P1 不直接刪除。
6. 匯出 Google Sheets Schema snapshot，只讀取 sheet、headers、row/column/max size；不得直接大規模改寫。
7. 對帳 `V2_payment_accounts` 與 `V2_workspace_payment_accounts`，本階段先形成 migration 決策，不刪資料。
8. 執行身份、Workspace、房源、租約、帳務、付款、催繳、通知、入住與公告核心回歸。
9. 驗證指定修正全部保留：手機前導 0、房客手機同步、登入返回、native dashboard、多團隊、上期電表、Workspace 預設、押金、動態夏月、催繳、通知中心、DocumentLock、公告容量與團隊通知。
10. 僅在受控測試帳號、明確副作用清單與人工批准下執行會寫資料或發 LINE 的 Apps Script 測試。

P1 exit criteria：

- 44 個現行 HTML 無意外缺頁，所有內部連結可解析。
- 兩個 HTML conflict 有書面驗收結果與 rollback artifact。
- 固定 shell、bottom nav、safe-area、modal z-index 與頁底留白符合 `AGENTS.md`。
- Workspace、角色、權限與跨 Workspace isolation 核心測試通過。
- 帳務與付款閉環測試通過。
- Schema snapshot 完成，付款帳號雙模型已有明確 migration 決策。
- 通知偏好關閉時事件仍進通知中心，只停止 LINE push。

### P2：Legacy 收斂、驗證強化與 baseline 標記

1. 依回歸證據決定 `V2_API` legacy dashboard 函式保留、拆分或退出；common runtime helpers 不得因拆分遺失。
2. 將 V1 paid sync、legacy bill import、settlement/reversal legacy sync 分類為 runtime、migration 或 rollback utility。
3. 在備份、preview、idempotency 與 rollback 驗證完成後，才允許任何資料 migration。
4. 決定 `V2_payment_accounts` 到 `V2_workspace_payment_accounts` 的 migration；未遷移前保留 legacy 欄位。
5. 決定 `new-lease.html` 的正式用途、替代頁與 canonical 名稱，更新所有入口後才可移除舊檔。
6. 集中 HTML 的 API URL、LIFF ID 與測試 UID 環境設定，但不得改變既有對外 URL。
7. 強化 validator：route handler、proxy dependency、common helper、HTML link、forbidden filename、secrets 與 duplicate declarations。
8. 完成 `docs/09-TEST-MATRIX.md`、部署演練、rollback 演練與 production reconciliation 文件更新。
9. 合併後建立清楚 commit，經人工確認再建立 V2 internal-beta baseline tag。

P2 exit criteria：

- 每個正式模組只有一個 canonical 檔案。
- GitHub repository 可重建 Apps Script 與 GitHub Pages。
- 68 routes、handler、Schema 與核心流程回歸通過。
- Legacy/runtime/migration 邊界有文件與 owner。
- 部署與 rollback 演練成功。
- 經人工批准後才可標記 `v2.0.0-internal-beta.1`。

## 6. 每階段 validation checklist

### 6.1 P0 checklist：靜態與 runtime 完整性

- [ ] Canonical `apps-script/` 有 30 個 `.gs` 程式檔及 `appsscript.json`。
- [ ] 只有一個 `Code.gs`、一個 `doGet`、一個 `doPost`。
- [ ] 68 個 `v2_action`，68 個唯一 route，0 重複。
- [ ] 68/68 第一層 business handler 存在。
- [ ] 6/6 Workspace proxy 第二層正式 handler 存在。
- [ ] `jsonOutput_`、`htmlBridgeOutput_`、`handleLineWebhook_` 存在。
- [ ] `pushLineTextMessage_`、`cmwebsLogLineMessage_`、`getSheetObjects_`、`logLiffAccess_` 存在。
- [ ] Top-level function 重複數為 0。
- [ ] Top-level const／let／var 重複數為 0。
- [ ] 無 `.js`／`.gs` 同 basename 雙份模組。
- [ ] 無禁止的 variant filename。
- [ ] 所有 Apps Script 通過 JavaScript syntax check。
- [ ] `appsscript.json` timezone/runtime/webapp 設定與 deployed 對帳。
- [ ] Canonical source 無付款 credentials、LINE token、Spreadsheet ID 或其他 secret 值。
- [ ] 必要 Script Properties 名稱已列出，但驗證輸出不含值。
- [ ] `npm run validate` 通過。
- [ ] 本階段未 clasp push/deploy、未修改 Sheets、未新增 trigger。

### 6.2 P1 checklist：Frontend 與核心流程

- [ ] Repository root 44 個 HTML 均有明確 canonical/legacy 狀態。
- [ ] 24 個 candidate-validated HTML 與 canonical 行為一致。
- [ ] `tenant-home.html` 未綁定導向與月份格式化通過。
- [ ] `tenant-bills.html` 在 iOS/Android LINE WebView 實機通過。
- [ ] Candidate 依賴的 7 個 repository-only 頁無斷鏈。
- [ ] 所有 HTML inline script 通過 syntax check。
- [ ] 所有內部 HTML link 可解析，無意外 404。
- [ ] 固定 shell CSS 完整保留。
- [ ] `--app-height` 由 `visualViewport.height` 或 `window.innerHeight` 設定。
- [ ] 頁底有 nav 與 safe-area 空間，modal 高於 bottom nav。
- [ ] 登入後返回原頁正常。
- [ ] 手機 `+886`、`886`、9 位前導 0 正規化通過。
- [ ] 房客綁定後 tenants/users/contracts/views 同步通過。
- [ ] Workspace create/switch/team/roles/permissions 通過。
- [ ] 不同 Workspace 不可互看或互寫。
- [ ] 房間 → 租約 → Workspace 帳務預設順序通過。
- [ ] 押金預設為月租 × `default_deposit_months`。
- [ ] 夏月設定支援動態月份與跨年度區間。
- [ ] 上期電表 null/0 修復通過。
- [ ] 付款回報 → 核准 → 銷帳 → 手動結清 → reopen 通過。
- [ ] 自動催繳 Workspace active/timezone/hour/days/final+1 通過。
- [ ] 通知中心完整事件與 DocumentLock 路徑通過。
- [ ] 團隊付款、合約、訊息、入住與公告結果通知通過。
- [ ] 公告容量 diagnose/compact/resize 在受控測試通過。
- [ ] Schema snapshot 完成，未直接大規模修改正式 Sheets。
- [ ] `test=1` 測試均依真實副作用管理。

### 6.3 P2 checklist：收斂、部署與 rollback

- [ ] Legacy dashboard 與 Workspace native 邊界有書面決策。
- [ ] Legacy import/sync/repair 函式有 runtime/migration/rollback 分類。
- [ ] `V2_payment_accounts` migration 有備份、mapping、validation 與 rollback。
- [ ] `new-lease.html` 已有替代入口與 migration 決策。
- [ ] Validator 能檢查 handler 與 transitive dependency。
- [ ] Validator 能檢查 HTML links、secrets 與禁止檔名。
- [ ] `docs/04-API-ROUTES.md` 與實際 68 routes 一致。
- [ ] `docs/05-DATA-MODEL.md` 與 Schema snapshot 一致。
- [ ] `docs/09-TEST-MATRIX.md` 核心項目通過並有證據。
- [ ] Apps Script trigger 清單已對帳，自動催繳 trigger 只有一個。
- [ ] 部署建立新 Apps Script version，Web App URL 不變。
- [ ] GitHub Pages deployment 可對應到明確 commit。
- [ ] Backend、frontend、Properties、trigger 與 data migration rollback 均已演練。
- [ ] Production deploy 與 baseline tag 均有人工批准。

## 7. Rollback strategy

### 7.1 Rollback 原則

1. 每個 merge phase 使用獨立、可審查的 commit；不得把 P0 backend recovery、P1 frontend conflict 與 P2 migration 混在同一不可分割 commit。
2. 部署前保存來源 hash、Apps Script version、Git commit、HTML conflict 兩側版本、trigger 清單、Schema snapshot 與 Properties 名稱。
3. Secret 值只保存在授權的 secure store／Apps Script Properties，不寫入 Git、文件或 log。
4. 任何 Google Sheets migration 都必須先備份、先 preview、可重跑且有逐筆 audit；`test=1` 不算 preview。
5. Rollback 不得刪除未知資料或直接 reset 整個 repository。

### 7.2 Apps Script rollback

部署方式：

- 每次 backend deployment 建立新的 Apps Script version。
- 更新既有 Web App deployment 指向新 version，維持原 URL。
- 記錄 deployment 前一個已知可用 version。

Rollback：

1. 停止新 migration／repair／trigger 操作。
2. 將既有 Web App deployment 重新指向前一個已知可用 Apps Script version。
3. 驗證 `tenant_home`、`landlord_home`、付款、LINE callback 與至少一個寫入權限 route。
4. 對帳 trigger，移除 rollback 過程產生的重複 trigger，但不得刪除未確認來源的 trigger。
5. 保存失敗 version、log 與差異供後續修復，不覆蓋證據。

### 7.3 GitHub Pages rollback

1. Frontend 每個 conflict resolution 使用獨立 commit。
2. 保存 `tenant-home.html` 與 `tenant-bills.html` 的 repository/candidate hash。
3. 發生登入、導向、modal、safe-area 或 API regression 時，只 revert 對應 frontend commit。
4. 重新發布前一個已知可用 GitHub Pages commit，確認路徑與 LIFF entry URL 不變。

### 7.4 Google Sheets rollback

1. P0 不修改 Sheets。
2. P1 只建立唯讀 Schema snapshot；任何必要的補欄位或資料修復需另有人工批准。
3. P2 migration 前建立完整備份與 row/header/count snapshot。
4. Migration 寫入必須記錄原值、新值、row key、workspace_id、操作者與時間。
5. Rollback 依 audit 還原受影響 rows，不以整張表無條件覆蓋 production。
6. `landlord_id` 與 legacy payment account 欄位在 migration 完成並驗證前不得刪除。

### 7.5 Script Properties 與 credentials rollback

- 在安全管道保存 Properties key inventory 與變更紀錄，不記錄值於 repository。
- 新 credential 失效時，輪替到另一組有效 credential；不得回復已暴露的舊 credential。
- Properties 變更與程式部署分開記錄，確保可判斷是 code 還是 configuration regression。
- Webhook、LINE token、Spreadsheet ID 與 payment credential 分別驗證，避免一次變更多個 secrets 無法定位。

### 7.6 Trigger rollback

- 部署前後列出 trigger function、event type、schedule 與 unique id。
- 自動催繳只允許一個正式 hourly dispatcher trigger。
- 新 trigger 未驗證前不刪舊 trigger；切換時需有明確交接點，避免同時發送。
- 發生重複通知時先停用新 trigger，再恢復前一個已知 schedule，並查核 reminder logs 防止重送。

### 7.7 Rollback 觸發條件

任一情況發生時停止 promotion 並執行對應 rollback：

- Route 數不是 68、handler 缺失或出現重複 route／top-level 宣告。
- Tenant/landlord 核心入口無法載入。
- 發生跨 Workspace 資料暴露或未授權寫入。
- 付款核准、手動結清、reopen 或已繳查詢資料不一致。
- 手機綁定造成 tenants/users/contracts/views 不一致。
- 自動催繳重複發送、時區錯誤或 final stage 邏輯錯誤。
- 通知偏好關閉後事件沒有保存，或 DocumentLock/ScriptLock 發生 deadlock。
- GitHub Pages 出現 candidate 缺頁斷鏈、LIFF 登入無法返回或 modal 被 bottom nav 遮擋。
- 發現 secret 被提交、輸出到 log 或送入不受控位置。
- Schema migration row count、key mapping 或 audit 對不上預期。

## 本文件建立聲明

本輪只建立：

```text
docs/23-CANONICAL-MERGE-PLAN.md
```

本輪沒有修改任何 Apps Script、HTML、manifest、測試、既有文件、Google Sheets、Script Properties、trigger 或部署設定；沒有執行 clasp push/deploy；沒有建立 branch、commit 或 push。
