# V2 Production Baseline 三方差異報告

盤點日期：2026-07-18（Asia/Taipei）  
工作目錄：`/Users/hans/CMWebs/cmwebs-liff`  
本地 branch：`chore/v2-production-consolidation`  
比較範圍：本地 repository root、`_deployed/apps-script`、`_handoff/cmwebs-codex-handoff-2026-07-18/candidate-overlay`

## Executive summary

1. Repository root 有 44 個 GitHub Pages HTML，但沒有 canonical Apps Script 原始碼。現況無法只靠 repository 重建實際部署後端。
2. Deployed 匯出有 32 個檔案：30 個 `.js` 程式檔、`appsscript.json`、`.clasp.json`。Candidate overlay 有 21 個 `.gs` 與 26 個 HTML，共 47 個檔案。
3. 將 `.js`／`.gs` 視為同型，並把 `程式碼.js` 對應為 `Code.gs` 後，candidate 的 21 個 Apps Script 模組全部能在 deployed 找到：20 個逐位元相同，`V2_WORKSPACE_DASHBOARD_NATIVE` 只差檔尾空白，功能相同。沒有 candidate-only Apps Script 模組，也沒有可判定為 `DEPLOYED_NEWER` 或 `CANDIDATE_NEWER` 的共享模組。
4. Deployed 另有 9 個 candidate overlay 缺少的程式模組：`V2_API`、房客綁定、房客建檔、付款銷帳／重開／已繳管理、legacy bill import 與 `TESTS`。其中多個是目前 68 routes 的直接或間接依賴，不是可忽略的歷史備份。
5. Deployed `程式碼.js` 與 candidate `Code.gs` 逐位元相同，兩者都宣告 68 個唯一 `v2_action`，route 名稱完全一致、無重複。Deployed 的 68 個第一層 handler 全部存在；candidate 只有 62 個第一層 handler，直接缺 6 個。此外 candidate 缺少 `jsonOutput_`、`htmlBridgeOutput_`、`handleLineWebhook_` 與多個共用 helper，所以 candidate overlay 無法獨立部署執行。
6. Repository 44 個 HTML 中，candidate 收錄 26 個：24 個功能相同，`tenant-home.html` 與 `tenant-bills.html` 有實際行為差異，標記 `CONFLICT`；另有 18 個 repository HTML 未收錄於 candidate。Candidate 頁面仍連到其中 7 個未收錄頁面，若只部署 candidate public 會產生斷鏈。
7. 分別掃描 deployed 與 candidate，均未發現來源內部的重複 top-level `function`、`const`、`let` 或 `var`，route 也無重複。但 candidate 是 deployed 的宣告子集；若把兩個來源直接並存到同一 Apps Script 專案，會重複 692 個 function 與 60 個 top-level 變數，絕對不可直接疊加。
8. 已確認指定的 Workspace、帳務、催繳、通知、容量與團隊通知修正存在於 deployed；除房客手機同步修復外，也存在於 candidate 的共享模組。Candidate 缺少房客綁定與房客建檔模組，因此相關 route 仍不完整。
9. `程式碼.js`／`Code.gs` 內含硬編碼付款服務憑證。本文不記錄值；這同時存在於 deployed 與 candidate，違反 `AGENTS.md` 的 secrets 規則，必須由人工決定輪替與移入 Apps Script Properties 的處理時點。
10. 本輪沒有修改任何正式程式、HTML、manifest、測試、部署設定或 Google Sheets；只建立本報告，沒有執行 `clasp push`、`clasp deploy`、commit、push 或建立 branch。

## 比較方法與狀態定義

本報告沒有用檔案大小或修改時間推定版本。比較方法如下：

- 先以 SHA-256 與逐位元比較辨識完全相同檔案。
- 對非逐位元相同檔案執行逐行內容 diff，再核對函式、route、handler 與實際行為。
- Apps Script canonical key 以 basename 為主，忽略 `.js`／`.gs` 差異；`程式碼` 額外正規化為 `Code`。
- top-level 宣告以 brace depth 掃描，並分開檢查 function／const／let／var。
- `Code` route 以 `v2Action === '...'` 實際條件擷取，並核對第一層 handler 與 proxy 的第二層依賴。
- 沒有以來源檔名中的 `FIXED`、`WITH_SETTINGS`、`WITH_TEAM_NOTIFICATIONS` 或檔案時間選正式版。

狀態定義：

| 狀態 | 本報告定義 |
|---|---|
| `SAME` | 逐位元相同，或只差檔尾空白／換行且函式、route 與行為相同。 |
| `DEPLOYED_ONLY` | 只在實際 deployed 匯出存在。 |
| `CANDIDATE_ONLY` | 只在 candidate overlay 存在。 |
| `DEPLOYED_NEWER` | Deployed 是可證明的嚴格功能超集，且 candidate 無反向獨有行為。 |
| `CANDIDATE_NEWER` | Candidate 是可證明的嚴格功能超集，且 deployed 無反向獨有行為。 |
| `CONFLICT` | 有實際行為差異，或無法在不做產品決策下選定 canonical 行為。 |
| `MISSING` | 應比較的來源沒有該檔案。 |

本輪沒有任何共享 Apps Script 模組符合 `DEPLOYED_NEWER` 或 `CANDIDATE_NEWER`；不能因 deployed-only 檔案較多，就把所有 deployed 檔案一概標成「更新」。

## 三個來源的檔案數量

| 來源 | Apps Script 程式 | 設定檔 | HTML | 本輪相關總數 |
|---|---:|---:|---:|---:|
| Repository root | 0 | 0 | 44 | 44 |
| `_deployed/apps-script` | 30 `.js` | 2 | 0 | 32 |
| Candidate overlay | 21 `.gs` | 0 | 26 | 47 |

說明：repository 的 `scripts/validate-project.js` 是驗證工具，不算 canonical Apps Script 業務來源。Deployed 的兩個設定檔是 `.clasp.json` 與 `appsscript.json`。

## 完整檔案清單

### GitHub repository 全部 HTML（44）

```text
announce.html
batch-meter.html
checkout.html
hub.html
identity.html
index.html
landlord-activity.html
landlord-announcements.html
landlord-arrears.html
landlord-bill-notifications.html
landlord-billing.html
landlord-contract-requests.html
landlord-entry.html
landlord-home.html
landlord-join.html
landlord-line-logs.html
landlord-messages.html
landlord-more.html
landlord-notifications.html
landlord-onboarding.html
landlord-paid-bills.html
landlord-payment-reports.html
landlord-properties.html
landlord-register.html
landlord-registry.html
landlord-settings.html
landlord-team.html
landlord-tenant-checkin.html
landlord-tenant-create.html
landlord-tenant-detail.html
landlord-tenants.html
landlord-workspaces.html
landlord.html
meter.html
new-lease.html
tenant-bills.html
tenant-bind.html
tenant-checkin.html
tenant-contract.html
tenant-home.html
tenant-message.html
tenant-payment-report.html
tenant-renewal.html
tenant-termination.html
```

### Deployed Apps Script 全部檔案（32）

```text
.clasp.json
TESTS.js
V2_ANNOUNCEMENT_MANAGEMENT.js
V2_API.js
V2_AUTO_PAYMENT_REMINDER.js
V2_BILLING_MANAGEMENT.js
V2_BILL_NOTIFICATIONS.js
V2_CONTRACT_REQUESTS.js
V2_LANDLORD_MANAGEMENT.js
V2_LANDLORD_ONBOARDING.js
V2_LEGACY_BILL_IMPORT.js
V2_MANUAL_SETTLEMENT.js
V2_PAID_BILL_MANAGEMENT.js
V2_PAYMENT_REVERSAL.js
V2_PAYMENT_SETTLEMENT.js
V2_PROPERTY_ROOM_MANAGEMENT.js
V2_SETTINGS_INTEGRATION.js
V2_SYSTEM_SETTINGS.js
V2_TEAM_MANAGEMENT.js
V2_TENANT_BINDING_PHONE.js
V2_TENANT_CHECKIN_MANAGEMENT.js
V2_TENANT_LEASE_ONBOARDING.js
V2_TENANT_MESSAGES.js
V2_TENANT_PAYMENT_REPORTS.js
V2_WORKSPACES.js
V2_WORKSPACE_CREATION.js
V2_WORKSPACE_DASHBOARD_NATIVE.js
V2_WORKSPACE_LANDLORD_ACCESS.js
V2_WORKSPACE_NOTIFICATIONS.js
V2_WORKSPACE_OPERATION_AUDIT.js
appsscript.json
程式碼.js
```

### Candidate overlay 全部 Apps Script（21）

```text
Code.gs
V2_ANNOUNCEMENT_MANAGEMENT.gs
V2_AUTO_PAYMENT_REMINDER.gs
V2_BILLING_MANAGEMENT.gs
V2_BILL_NOTIFICATIONS.gs
V2_CONTRACT_REQUESTS.gs
V2_LANDLORD_MANAGEMENT.gs
V2_LANDLORD_ONBOARDING.gs
V2_PROPERTY_ROOM_MANAGEMENT.gs
V2_SETTINGS_INTEGRATION.gs
V2_SYSTEM_SETTINGS.gs
V2_TEAM_MANAGEMENT.gs
V2_TENANT_CHECKIN_MANAGEMENT.gs
V2_TENANT_MESSAGES.gs
V2_TENANT_PAYMENT_REPORTS.gs
V2_WORKSPACES.gs
V2_WORKSPACE_CREATION.gs
V2_WORKSPACE_DASHBOARD_NATIVE.gs
V2_WORKSPACE_LANDLORD_ACCESS.gs
V2_WORKSPACE_NOTIFICATIONS.gs
V2_WORKSPACE_OPERATION_AUDIT.gs
```

### Candidate overlay 全部 HTML（26）

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
tenant-bills.html
tenant-bind.html
tenant-contract.html
tenant-home.html
tenant-message.html
tenant-payment-report.html
tenant-renewal.html
tenant-termination.html
```

## Apps Script 模組對照表

Repository 沒有 canonical Apps Script，因此下表 repository 欄全部為 `MISSING`。Deployed 與 candidate 的副檔名差異不算模組差異。

| Canonical 模組 | Repository | Deployed | Candidate | 狀態 | 內容／功能差異 |
|---|---|---|---|---|---|
| `Code` | `MISSING` | `程式碼.js` | `Code.gs` | `SAME` | 逐位元相同；68 routes、dispatcher、legacy 非 V2 fallback 與 `doPost` 相同。 |
| `TESTS` | `MISSING` | `TESTS.js` | `MISSING` | `DEPLOYED_ONLY` | 603 帳單狀態診斷測試。 |
| `V2_ANNOUNCEMENT_MANAGEMENT` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；公告、重試、容量整理、團隊結果通知均相同。 |
| `V2_API` | `MISSING` | `.js` | `MISSING` | `DEPLOYED_ONLY` | Tenant home/bills、legacy dashboard、LINE webhook/log、JSONP/bridge helper、共用資料 helper、V1 已繳同步。 |
| `V2_AUTO_PAYMENT_REMINDER` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；Workspace 排程、動態提醒日、人工處理與團隊通知相同。 |
| `V2_BILLING_MANAGEMENT` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；上期電表修復、Workspace 預設、動態夏月、團隊帳單事件相同。 |
| `V2_BILL_NOTIFICATIONS` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同。 |
| `V2_CONTRACT_REQUESTS` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；合約申請與團隊通知相同。 |
| `V2_LANDLORD_MANAGEMENT` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同。 |
| `V2_LANDLORD_ONBOARDING` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；多 Workspace onboarding 相同。 |
| `V2_LEGACY_BILL_IMPORT` | `MISSING` | `.js` | `MISSING` | `DEPLOYED_ONLY` | V1 歷史帳單依月份匯入 `V2_bills`，含 `legacy_ref` 防重與 preview。 |
| `V2_MANUAL_SETTLEMENT` | `MISSING` | `.js` | `MISSING` | `DEPLOYED_ONLY` | 手動銷帳、V1 legacy 同步、audit 與 repair；目前 route proxy 的必要第二層依賴。 |
| `V2_PAID_BILL_MANAGEMENT` | `MISSING` | `.js` | `MISSING` | `DEPLOYED_ONLY` | 已繳帳單統一查詢；目前 `landlord_paid_bills_init` proxy 的必要第二層依賴。 |
| `V2_PAYMENT_REVERSAL` | `MISSING` | `.js` | `MISSING` | `DEPLOYED_ONLY` | 撤銷已繳、作廢付款、恢復欠款與 legacy 同步；`landlord_bill_reopen` 的必要第二層依賴。 |
| `V2_PAYMENT_SETTLEMENT` | `MISSING` | `.js` | `MISSING` | `DEPLOYED_ONLY` | 付款回報正式建立付款及銷帳；`landlord_payment_report_settle` 的必要第二層依賴。 |
| `V2_PROPERTY_ROOM_MANAGEMENT` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；Workspace 預設、押金與動態夏月邏輯相同。 |
| `V2_SETTINGS_INTEGRATION` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；Workspace 預設接入房間、帳單與催繳。 |
| `V2_SYSTEM_SETTINGS` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；手機前導 0、帳務預設、催繳設定與通知偏好相同。 |
| `V2_TEAM_MANAGEMENT` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；團隊角色、邀請與手機處理相同。 |
| `V2_TENANT_BINDING_PHONE` | `MISSING` | `.js` | `MISSING` | `DEPLOYED_ONLY` | 綁定 status/submit handler、手機正規化、同步與診斷／修復工具。 |
| `V2_TENANT_CHECKIN_MANAGEMENT` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；報到、歡迎訊息與團隊／LINE 失敗通知相同。 |
| `V2_TENANT_LEASE_ONBOARDING` | `MISSING` | `.js` | `MISSING` | `DEPLOYED_ONLY` | 房客建立 init/create、Workspace 權限、手機正規化、租約與 view 同步。 |
| `V2_TENANT_MESSAGES` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；房客訊息／報修基礎與團隊通知相同。 |
| `V2_TENANT_PAYMENT_REPORTS` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；付款回報與團隊通知相同。 |
| `V2_WORKSPACES` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同。 |
| `V2_WORKSPACE_CREATION` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同。 |
| `V2_WORKSPACE_DASHBOARD_NATIVE` | `MISSING` | `.js` | `.gs` | `SAME` | 只差 deployed 檔尾多一個空白行；函式、資料查詢與行為相同。 |
| `V2_WORKSPACE_LANDLORD_ACCESS` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；Workspace access、native/legacy proxy 與 migration helper 相同。 |
| `V2_WORKSPACE_NOTIFICATIONS` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同；完整事件、偏好、通知中心與 DocumentLock 相同。 |
| `V2_WORKSPACE_OPERATION_AUDIT` | `MISSING` | `.js` | `.gs` | `SAME` | 逐位元相同。 |

非程式設定檔：

| 檔案 | Repository | Deployed | Candidate | 狀態 | 備註 |
|---|---|---|---|---|---|
| `appsscript.json` | `MISSING` | 存在 | `MISSING` | `DEPLOYED_ONLY` | V8、Asia/Taipei、Stackdriver；Web App 為 anonymous access、execute as deployer。 |
| `.clasp.json` | `MISSING` | 存在 | `MISSING` | `DEPLOYED_ONLY` | 含 Apps Script 專案連結與 push order；本文不揭露 ID。 |

## HTML 頁面對照表

Deployed Apps Script 匯出沒有 HTML，因此 deployed 欄為 `MISSING`。`SAME` 包含純檔尾空白差異。

| HTML | Repository | Deployed | Candidate | 狀態 | 實際差異 |
|---|---|---|---|---|---|
| `announce.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only legacy／入口頁。 |
| `batch-meter.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only。 |
| `checkout.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only。 |
| `hub.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only。 |
| `identity.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only。 |
| `index.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only 入口。 |
| `landlord-activity.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Candidate `landlord-more.html` 仍連到此頁。 |
| `landlord-announcements.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-arrears.html` | 存在 | `MISSING` | 存在 | `SAME` | 只差 EOF newline。 |
| `landlord-bill-notifications.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-billing.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-contract-requests.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-entry.html` | 存在 | `MISSING` | 存在 | `SAME` | 只差檔尾空白；兩者都有登入後返回原頁。 |
| `landlord-home.html` | 存在 | `MISSING` | 存在 | `SAME` | 只差檔尾空白。 |
| `landlord-join.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-line-logs.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Candidate 多頁仍連到此頁。 |
| `landlord-messages.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Candidate home/more 仍連到此頁。 |
| `landlord-more.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同，但內含多個 candidate 缺頁連結。 |
| `landlord-notifications.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-onboarding.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-paid-bills.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Candidate home/more 仍連到此頁。 |
| `landlord-payment-reports.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Candidate home/more/arrears 仍連到此頁。 |
| `landlord-properties.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-register.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-registry.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only。 |
| `landlord-settings.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Candidate `landlord-more.html` 仍連到此頁。 |
| `landlord-team.html` | 存在 | `MISSING` | 存在 | `SAME` | 只差檔尾空白。 |
| `landlord-tenant-checkin.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-tenant-create.html` | 存在 | `MISSING` | 存在 | `SAME` | 只差檔尾空白。 |
| `landlord-tenant-detail.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-tenants.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `landlord-workspaces.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Candidate `landlord-more.html` 仍連到此頁。 |
| `landlord.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only legacy 頁。 |
| `meter.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only。 |
| `new-lease.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only，且檔名符合目前禁止的 `new-*` 模式，需人工決定去留／遷移。 |
| `tenant-bills.html` | 存在 | `MISSING` | 存在 | `CONFLICT` | Repository 改成 full-height detail modal、overscroll containment 並在開啟時重設 scroll；candidate 保留底部 sheet。不可只以較長檔案判定正式行為。 |
| `tenant-bind.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `tenant-checkin.html` | 存在 | `MISSING` | `MISSING` | `MISSING` | Repository-only。 |
| `tenant-contract.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `tenant-home.html` | 存在 | `MISSING` | 存在 | `CONFLICT` | Repository 增加未綁定時導向 `tenant-bind.html`，並格式化帳單月份；candidate 缺少導向且直接顯示原始月份。需人工選定 canonical 行為。 |
| `tenant-message.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `tenant-payment-report.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `tenant-renewal.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |
| `tenant-termination.html` | 存在 | `MISSING` | 存在 | `SAME` | 逐位元相同。 |

Candidate public 內存在但 repository 不存在的 HTML：無。

Candidate public 會連到、但 candidate 本身未收錄的 7 個頁面：

```text
landlord-activity.html
landlord-line-logs.html
landlord-messages.html
landlord-paid-bills.html
landlord-payment-reports.html
landlord-settings.html
landlord-workspaces.html
```

## API route 對照

### 統計

| 項目 | Deployed | Candidate |
|---|---:|---:|
| `v2_action` 宣告數 | 68 | 68 |
| 唯一 route 數 | 68 | 68 |
| 重複 route | 0 | 0 |
| 相對另一來源缺少的 route 名稱 | 0 | 0 |
| 第一層 business handler 存在 | 68/68 | 62/68 |

`程式碼.js` 與 `Code.gs` 完全相同，所以 route 集合沒有差異。Candidate 的問題不是「少寫 route」，而是 route 依賴的模組與 helper 未收錄。

### 68 routes 與 handler

`YES†` 表示第一層 proxy 存在，但 candidate 缺少 proxy 所呼叫的第二層正式函式。

| Route | 第一層 handler | Deployed | Candidate |
|---|---|---|---|
| `tenant_binding_status` | `getTenantBindingStatusByLineUid_` | YES | NO |
| `tenant_bind_submit` | `bindTenantByLineUid_` | YES | NO |
| `landlord_entry_status` | `getLandlordEntryStatusByLineUid_` | YES | YES |
| `landlord_register_submit` | `registerLandlordWorkspaceByLineUid_` | YES | YES |
| `landlord_onboarding_init` | `getLandlordOnboardingInitByLineUid_` | YES | YES |
| `landlord_onboarding_save` | `saveLandlordOnboardingStepByLineUid_` | YES | YES |
| `landlord_onboarding_complete` | `completeLandlordOnboardingByLineUid_` | YES | YES |
| `landlord_team_init` | `getLandlordTeamInitByLineUid_` | YES | YES |
| `landlord_team_invite_create` | `createLandlordTeamInvitationByLineUid_` | YES | YES |
| `landlord_team_invite_cancel` | `cancelLandlordTeamInvitationByLineUid_` | YES | YES |
| `landlord_team_member_update` | `updateLandlordTeamMemberByLineUid_` | YES | YES |
| `landlord_team_member_remove` | `removeLandlordTeamMemberByLineUid_` | YES | YES |
| `landlord_invitation_init` | `getLandlordInvitationInit_` | YES | YES |
| `landlord_invitation_accept` | `acceptLandlordInvitationByLineUid_` | YES | YES |
| `landlord_workspace_activity_init` | `getLandlordWorkspaceActivityByLineUid_` | YES | YES |
| `landlord_notifications_init` | `getLandlordNotificationsInitByLineUid_` | YES | YES |
| `landlord_notification_mark_read` | `markLandlordNotificationReadByLineUid_` | YES | YES |
| `landlord_notifications_mark_all_read` | `markAllLandlordNotificationsReadByLineUid_` | YES | YES |
| `landlord_settings_init` | `getLandlordSettingsInitByLineUid_` | YES | YES |
| `landlord_settings_save_profile` | `saveLandlordSettingsProfileByLineUid_` | YES | YES |
| `landlord_settings_save_workspace` | `saveLandlordSettingsWorkspaceByLineUid_` | YES | YES |
| `landlord_settings_save_payment` | `saveLandlordSettingsPaymentByLineUid_` | YES | YES |
| `landlord_settings_save_preferences` | `saveLandlordSettingsPreferencesByLineUid_` | YES | YES |
| `landlord_announcements_init` | `getLandlordAnnouncementsInitByLineUid_` | YES | YES |
| `landlord_announcement_send` | `sendLandlordAnnouncementByLineUid_` | YES | YES |
| `landlord_announcement_retry` | `retryLandlordAnnouncementByLineUid_` | YES | YES |
| `landlord_tenant_checkins_init` | `getLandlordTenantCheckinsInitByLineUid_` | YES | YES |
| `landlord_tenant_checkin_save` | `saveLandlordTenantCheckinByLineUid_` | YES | YES |
| `landlord_tenant_checkin_send_welcome` | `sendLandlordTenantCheckinWelcomeByLineUid_` | YES | YES |
| `landlord_bill_notifications_init` | `getLandlordBillNotificationsInitByLineUid_` | YES | YES |
| `landlord_bill_notifications_send` | `sendLandlordBillNotificationsByLineUid_` | YES | YES |
| `landlord_billing_init` | `getLandlordBillingInitByLineUid_` | YES | YES |
| `landlord_bills_generate` | `generateLandlordBillsByLineUid_` | YES | YES |
| `landlord_tenant_create_init` | `getLandlordTenantCreateInitByLineUid_` | YES | NO |
| `landlord_tenant_create` | `createLandlordTenantLeaseByLineUid_` | YES | NO |
| `landlord_properties_init` | `getLandlordPropertiesInitByLineUid_` | YES | YES |
| `landlord_property_save` | `saveLandlordPropertyByLineUid_` | YES | YES |
| `landlord_property_archive` | `archiveLandlordPropertyByLineUid_` | YES | YES |
| `landlord_room_save` | `saveLandlordRoomByLineUid_` | YES | YES |
| `landlord_room_archive` | `archiveLandlordRoomByLineUid_` | YES | YES |
| `landlord_workspace_create` | `createAdditionalLandlordWorkspaceByLineUid_` | YES | YES |
| `landlord_workspace_context` | `getLandlordWorkspaceContextByLineUid_` | YES | YES |
| `landlord_workspace_switch` | `setLandlordActiveWorkspaceByLineUid_` | YES | YES |
| `tenant_home` | `getTenantHomeByLineUid` | YES | NO |
| `tenant_payment_report_init` | `getTenantPaymentReportInitByLineUid` | YES | YES |
| `tenant_payment_report_submit` | `submitTenantPaymentReportByLineUid_` | YES | YES |
| `tenant_message_init` | `getTenantMessageInitByLineUid` | YES | YES |
| `tenant_message_submit` | `submitTenantMessageByLineUid_` | YES | YES |
| `tenant_bills` | `getTenantBillsByLineUid` | YES | NO |
| `landlord_home` | `getWorkspaceLandlordHomeNativeByLineUid_` | YES | YES |
| `landlord_arrears` | `getWorkspaceLandlordArrearsNativeByLineUid_` | YES | YES |
| `landlord_tenants` | `getWorkspaceLandlordTenantsNativeByLineUid_` | YES | YES |
| `landlord_line_logs` | `getWorkspaceLandlordLineLogsByLineUid_` | YES | YES† |
| `landlord_send_tenant_message` | `workspaceLandlordSendTenantMessageByLineUid_` | YES | YES† |
| `landlord_messages_init` | `getWorkspaceLandlordMessagesInitByLineUid_` | YES | YES |
| `landlord_message_update` | `updateWorkspaceLandlordTenantMessageByLineUid_` | YES | YES |
| `landlord_payment_reports_init` | `getWorkspaceLandlordPaymentReportsInitByLineUid_` | YES | YES |
| `landlord_payment_report_update` | `updateWorkspaceLandlordPaymentReportByLineUid_` | YES | YES |
| `landlord_payment_report_settle` | `settleWorkspaceLandlordPaymentReportByLineUid_` | YES | YES† |
| `landlord_bill_manual_settle` | `manualSettleWorkspaceLandlordBillByLineUid_` | YES | YES† |
| `landlord_bill_reopen` | `reopenWorkspaceLandlordBillByLineUid_` | YES | YES† |
| `landlord_paid_bills_init` | `getWorkspaceLandlordPaidBillsInitByLineUid_` | YES | YES† |
| `tenant_contract_init` | `getTenantContractInitByLineUid_` | YES | YES |
| `tenant_contract_request_submit` | `submitTenantContractRequestByLineUid_` | YES | YES |
| `tenant_contract_requests` | `getTenantContractRequestsByLineUid_` | YES | YES |
| `tenant_contract_request_cancel` | `cancelTenantContractRequestByLineUid_` | YES | YES |
| `landlord_contract_requests_init` | `getWorkspaceLandlordContractRequestsInitByLineUid_` | YES | YES |
| `landlord_contract_request_update` | `updateWorkspaceLandlordContractRequestByLineUid_` | YES | YES |

### Candidate 缺少的直接 handler（6）

```text
tenant_binding_status -> getTenantBindingStatusByLineUid_
tenant_bind_submit -> bindTenantByLineUid_
landlord_tenant_create_init -> getLandlordTenantCreateInitByLineUid_
landlord_tenant_create -> createLandlordTenantLeaseByLineUid_
tenant_home -> getTenantHomeByLineUid
tenant_bills -> getTenantBillsByLineUid
```

### Candidate proxy 缺少的第二層依賴（6 routes）

| Route | Candidate 內存在的 proxy | Candidate 缺少的正式函式 | 所屬 deployed-only 模組 |
|---|---|---|---|
| `landlord_line_logs` | `getWorkspaceLandlordLineLogsByLineUid_` | `getLandlordLineLogsByLineUid` | `V2_API` |
| `landlord_send_tenant_message` | `workspaceLandlordSendTenantMessageByLineUid_` | `landlordSendTenantMessageByLineUid_` | `V2_API` |
| `landlord_payment_report_settle` | `settleWorkspaceLandlordPaymentReportByLineUid_` | `settleLandlordPaymentReportByLineUid_` | `V2_PAYMENT_SETTLEMENT` |
| `landlord_bill_manual_settle` | `manualSettleWorkspaceLandlordBillByLineUid_` | `manualSettleLandlordBillByLineUid_` | `V2_MANUAL_SETTLEMENT` |
| `landlord_bill_reopen` | `reopenWorkspaceLandlordBillByLineUid_` | `reopenLandlordBillByLineUid_` | `V2_PAYMENT_REVERSAL` |
| `landlord_paid_bills_init` | `getWorkspaceLandlordPaidBillsInitByLineUid_` | `getLandlordPaidBillsInitByLineUid_` | `V2_PAID_BILL_MANAGEMENT` |

### Candidate 缺少的共用 runtime helper

Candidate 沒有 `V2_API`，因此還缺少：

```text
jsonOutput_
htmlBridgeOutput_
handleLineWebhook_
pushLineTextMessage_
cmwebsLogLineMessage_
getSheetObjects_
logLiffAccess_
```

`Code.gs` 對 `jsonOutput_` 與 `htmlBridgeOutput_` 有全域依賴，`doPost` 依賴 `handleLineWebhook_`。多個 candidate 模組也依賴 push、LINE log、sheet object 與 access log helper。因此即使某 route 的第一層 handler 顯示 YES，candidate overlay 仍不是可獨立執行的 Apps Script 組合。

## 重複宣告與同名模組檢查

### 各來源內部

| 來源 | Top-level function | 重複 function | Top-level const | 重複 const | Top-level let | 重複 let | Top-level var | 重複 var |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Deployed | 958 | 0 | 105 | 0 | 0 | 0 | 1 | 0 |
| Candidate | 692 | 0 | 59 | 0 | 0 | 0 | 1 | 0 |

唯一 top-level `var` 是 `LM_SHEETS_`，兩個來源的 `V2_LANDLORD_MANAGEMENT` 相同。兩個來源內部也都沒有重複 canonical module basename。

### 跨來源疊加風險

- Candidate 的 692 個 function 全部也存在於 deployed。
- Candidate 的 60 個 top-level 變數（59 const、1 var）全部也存在於 deployed。
- 21 個 candidate canonical module 全部與 deployed 同名對應。
- 因 Apps Script 將所有 `.js`／`.gs` 視為同一全域作用域，不能把 deployed 與 candidate 直接並存；必須逐模組建立唯一 canonical 檔案。

### Route 重複

- Deployed `程式碼.js`：68 routes，0 重複。
- Candidate `Code.gs`：68 routes，0 重複。
- 兩檔內容相同，不能在同一 Apps Script 專案同時保留，否則 `doGet`、`doPost` 與 top-level const 會重複。

## Legacy 與 Workspace native 邊界

沒有同名 top-level 宣告衝突，但存在功能重疊與 proxy 依賴，必須人工決策：

| 邊界 | 實際內容 | 風險 |
|---|---|---|
| Dashboard legacy vs native | `V2_API` 定義 `getLandlordHomeByLineUid`、`getLandlordArrearsByLineUid`、`getLandlordTenantsByLineUid`；`Code` 實際 route 改用 `V2_WORKSPACE_DASHBOARD_NATIVE` 的 Workspace-native handler。 | 兩套資料邏輯可分歧；需決定 legacy 函式是 migration fallback、測試工具，或應在回歸後退出。 |
| Workspace proxy vs legacy principal | `V2_WORKSPACE_LANDLORD_ACCESS` 先解析 Workspace access，再以 principal landlord LINE UID 呼叫 legacy handler。 | 權限入口是 Workspace native，但資料函式仍可能以 `landlord_id` 查詢；必須做跨 Workspace isolation 測試。 |
| Payment proxies | 結清、手動銷帳、重開、已繳查詢的 route 都先進 Workspace proxy，再呼叫 deployed-only payment 模組。 | Candidate 缺少第二層依賴；不能把 proxy 存在誤判為 route 可用。 |
| LINE logs／房東傳訊 | Workspace proxy 仍委派 `V2_API` 的 legacy handler。 | Candidate 缺 `V2_API` 時 route 回傳 `LEGACY_FUNCTION_NOT_FOUND`。 |
| Payment account schema | `V2_SYSTEM_SETTINGS`／`V2_LANDLORD_ONBOARDING` 使用 `V2_workspace_payment_accounts`；`V2_PROPERTY_ROOM_MANAGEMENT` 仍使用 `V2_payment_accounts`。 | 兩套收款帳號資料來源可能不一致，且涉及遮罩與權限，不可直接刪 legacy 欄位／sheet。 |
| V1/V2 billing sync | `V2_API`、`V2_LEGACY_BILL_IMPORT` 與 settlement/reversal 模組包含 V1/V2 同步或 migration。 | 需區分一次性 migration、回復工具與正式 runtime；誤移除可能破壞現有已繳／欠款一致性。 |

## 已確認存在的修正

`YES (UI)` 表示 repository 只有對應前端行為；`YES (backend)` 表示實際後端修正存在。Candidate 與 deployed 的共享模組逐位元相同，因此共享修正不是從註解或檔名推定。

| 修正 | Repository | Deployed | Candidate | 內容證據與判斷 |
|---|---|---|---|---|
| 手機前導 0 修正 | YES (UI) | YES | YES／PARTIAL | Repository/candidate 的 register、tenant-create、tenant-bind 會將 9 位 9 開頭補 0；共享 `V2_SYSTEM_SETTINGS` 也有相同修正。Deployed 另在 binding/lease 模組實作；candidate 缺這兩個正式模組。 |
| 房客手機同步修復 | 無 canonical backend | YES | NO | Deployed `V2_TENANT_BINDING_PHONE` 有 `tenantBindingUpdateUserRowIfPresent_`、`tenantBindingSyncLineUidAcrossData_`、全量 diagnose/repair；candidate overlay 未收錄。 |
| 登入後返回原頁 | YES | 不適用（無 HTML） | YES | Repository 與 candidate `landlord-entry.html` 功能相同，使用 `return_to`、sessionStorage 與 `location.replace`。 |
| Workspace native dashboard | YES (UI) | YES (backend) | YES | Repository/candidate 有 native home/arrears/tenants 頁；deployed/candidate backend `V2_WORKSPACE_DASHBOARD_NATIVE` 功能相同。 |
| Workspace 多團隊 | YES (UI) | YES | YES | Team、Workspace、creation、onboarding 與 access 模組存在；共享 backend 相同。 |
| 上期電表 null 修正 | UI 有欄位 | YES | YES | `billingResolvePreviousMeter_` 會在 existing previous 為 null/<=0 時優先採前期 current meter，且有 repair/diagnostic 邏輯。 |
| Workspace 帳務預設 | YES (UI) | YES | YES | `V2_SETTINGS_INTEGRATION`、system settings、property/room、billing 均實際讀取 Workspace settings。 |
| 押金預設月數 | YES (UI) | YES | YES | 新房間未提供金額/月數時讀 `default_deposit_months`，再以 rent × months 計算押金。 |
| 夏月動態月份 | YES (UI) | YES | YES | Settings integration 解析 start/end 與跨年月份；room/billing 使用 `equipment_summer_months`／Workspace summer months。仍有 legacy `6,7,8,9` fallback，需保留回歸測試。 |
| 自動催繳 Workspace 排程 | YES (設定 UI) | YES | YES | 每小時 dispatcher 讀 workspace/settings、active、timezone 與 reminder hour。 |
| 自動催繳動態提醒天數 | YES (設定 UI) | YES | YES | 讀 `overdue_reminder_days_json`／設定值，建立各 Workspace reminder stages 與 final+1 manual follow-up。 |
| 通知中心全部事件 | YES (UI) | YES | YES | `payment_report`、`contract`、`tenant_message`、`bill_created`、`overdue`、`checkin`、`announcement_result`、`line_failure` 均在 event config/options。 |
| DocumentLock 修正 | 無 canonical backend | YES | YES | `workspaceNotifyTeam_` 明確使用 `getDocumentLock()`（fallback UserLock），避免業務模組持有 ScriptLock 時再次取得同一 ScriptLock。Mark-read 自身仍使用 ScriptLock，屬不同呼叫路徑。 |
| 公告容量修正 | 無 canonical backend | YES | YES | 有 cell-capacity diagnose/compact、deleteRows/deleteColumns、新 sheet resize 與 1,000 萬 cells 門檻處理。 |
| 團隊付款通知 | UI 有通知中心 | YES | YES | `V2_TENANT_PAYMENT_REPORTS` 呼叫 `workspaceNotifyTeam_`，event=`payment_report`。 |
| 團隊合約通知 | UI 有通知中心 | YES | YES | `V2_CONTRACT_REQUESTS` 對新增／取消等事件呼叫 `workspaceNotifyTeam_`，event=`contract`。 |
| 團隊房客訊息通知 | UI 有通知中心 | YES | YES | `V2_TENANT_MESSAGES` 呼叫 `workspaceNotifyTeam_`，event=`tenant_message`。 |
| 房客報到團隊通知 | UI 有通知中心 | YES | YES | check-in save 產生 event=`checkin`；歡迎訊息失敗另產生 `line_failure`。 |
| 公告結果團隊通知 | UI 有通知中心 | YES | YES | 公告發送結果呼叫 `workspaceNotifyTeam_`，event=`announcement_result`，包含成功、失敗、未綁定與衝突數。 |

## Deployed-only 功能

| 模組 | 目的 | Candidate 是否缺少正式功能 | Route／runtime 影響 |
|---|---|---|---|
| `V2_API` | Tenant home/bills、legacy dashboard/arrears/tenants、房東傳訊、LINE logs/webhook、JSONP/bridge、共用 helper、V1 paid sync。 | 是，且是 critical。 | 直接缺 `tenant_home`、`tenant_bills`；兩個 Workspace proxy 缺第二層函式；所有 route 缺 JSONP/bridge helper，`doPost` 缺 webhook handler，多模組缺 push/log/data helpers。 |
| `V2_TENANT_BINDING_PHONE` | 房客綁定、電話正規化、LINE UID 跨表同步、diagnose/repair。 | 是。 | `tenant_binding_status`、`tenant_bind_submit` 直接缺 handler。 |
| `V2_TENANT_LEASE_ONBOARDING` | 房客建立 init/create、Workspace 權限、租約與 view 同步。 | 是。 | `landlord_tenant_create_init`、`landlord_tenant_create` 直接缺 handler。 |
| `V2_PAYMENT_SETTLEMENT` | 核准付款回報後建立付款並銷帳。 | 是。 | Workspace proxy 存在但第二層 handler 缺失。 |
| `V2_MANUAL_SETTLEMENT` | 手動銷帳、legacy 同步、audit/repair。 | 是。 | Workspace proxy 存在但第二層 handler 缺失。 |
| `V2_PAYMENT_REVERSAL` | 撤銷已繳、作廢付款、恢復欠款、legacy 同步。 | 是。 | Workspace proxy 存在但第二層 handler 缺失。 |
| `V2_PAID_BILL_MANAGEMENT` | 統一查詢已繳帳單。 | 是。 | Workspace proxy 存在但第二層 handler 缺失。 |
| `V2_LEGACY_BILL_IMPORT` | V1 歷史帳單按月份匯入 V2，防重與 preview。 | 是，但不是 68 routes 的直接 handler。 | 影響 migration／reconciliation 能力，不應在未確認資料現況前移除。 |
| `TESTS` | 特定帳單診斷。 | 缺測試／診斷，不缺 runtime route。 | 不影響 route，但影響回歸與 production incident 調查。 |

結論：candidate 確實缺少這些已在實際 deployed 出現的正式功能。付款相關 4 個模組雖由 Workspace proxy 包裝，仍是 route 執行必要依賴；不能因 proxy 名稱存在就判定 candidate 完整。

## Candidate-only 功能

Candidate-only Apps Script 模組：無。  
Candidate-only HTML：無。

Candidate 的 21 個 Apps Script 模組與 26 個 HTML 都能在 deployed 或 repository 找到對應。Candidate 並不是 deployed 的功能超集，而是 deployed backend 與 repository frontend 的不完整子集。

## 衝突與風險

### P0：Candidate 不是可部署的完整後端

- Route 宣告有 68 個，但直接缺 6 個 handler。
- 6 個 route 的 proxy 缺第二層正式函式。
- 缺 `jsonOutput_`、`htmlBridgeOutput_`、`handleLineWebhook_` 與多個跨模組 helper。
- 現有驗證只計 route 數與 route 重複，沒有完整驗證 handler／transitive dependency，可能對 candidate 產生假陽性。

### P0：Repository 無 Apps Script source of truth

Repository root 沒有 `apps-script/Code.gs` 或 `V2_*.gs`。Deployed 與 candidate 目前都在交接／匯出目錄，尚不能由正式 repository 唯一重建 Web App。

### P0：硬編碼付款憑證

Deployed `程式碼.js` 與 candidate `Code.gs` 的前三個 top-level const 包含付款服務識別／Hash credentials。本文已刻意不記錄值。必須：

1. 人工確認是否為仍有效的 production credential。
2. 依安全流程輪替。
3. 移至 Apps Script Properties。
4. 檢查 Git history 與既有部署版本的暴露範圍。

### P0：Candidate public 斷鏈

Candidate 已收錄頁面會連到 7 個 candidate 未收錄頁面。只發布 candidate public 會造成付款回報管理、已繳帳單、訊息、LINE logs、Workspace、活動與設定入口失效。

### P1：兩個 HTML 行為衝突

- `tenant-home.html`：repository 有未綁定導向與月份格式化；candidate 沒有。
- `tenant-bills.html`：repository 是 full-height modal 且重設 scroll；candidate 是 bottom sheet。

兩者都不得用檔名、大小或修改時間自動選版。

### P1：Legacy 與 Workspace native 混合

Current `Code` 對 dashboard 使用 native handler，對 LINE logs、房東傳訊及付款操作仍使用 Workspace proxy → legacy/formal handler。這是混合架構，不是單純「legacy 全部可刪」。必須逐 route 做 Workspace scope 與 role regression。

### P1：付款帳號雙模型

System settings/onboarding 使用 `V2_workspace_payment_accounts`，property/room 管理仍讀 `V2_payment_accounts`。未完成 schema/data reconciliation 前，不可選一張表直接覆蓋或刪除另一張。

### P1：既有禁止檔名

Repository 目前有 `new-lease.html`，符合 `AGENTS.md` 禁止新增／保留為正式 canonical 的版本式 `new-*` 命名風險。本輪未改名或刪除，需人工判定它是 legacy 頁、正式入口或應 migration 的頁面。

### P1：測試與正式副作用

Deployed 含多個 install/repair/import/test 函式，且 `test=1` 不是 dry-run。Consolidation 時必須將可寫入、發 LINE、建立 trigger、同步 legacy 的函式列入測試與部署 runbook，不能只做 syntax check。

## 所有需要人工決策的項目

1. 是否以 deployed 30 個程式檔作為「待整併輸入全集」，並逐一導入 canonical `apps-script/`；本文不替人工選定正式版。
2. `V2_API` 應完整保留、拆分，或在 native route 回歸後逐段退出哪些 legacy dashboard 函式；其 JSONP/bridge/webhook/common helpers 目前不可缺。
3. `V2_TENANT_BINDING_PHONE` 是否作為 canonical binding 基礎，以及其全量 diagnose/repair 在 production 執行的權限、備份與 rollback。
4. `V2_TENANT_LEASE_ONBOARDING` deployed 版本是否作為 canonical tenant-create 基礎，並驗證 Workspace 權限、手機同步與 view 寫入。
5. 四個付款模組（settlement/manual/reversal/paid bills）與 Workspace proxy 的正式組合；不能只保留 proxy。
6. `V2_LEGACY_BILL_IMPORT`、`V2_API` 的 V1 paid sync 與 settlement/reversal legacy sync，哪些是一次性 migration、哪些是 production runtime、哪些是 rollback 工具。
7. Legacy dashboard 函式與 Workspace-native dashboard 函式的退場邊界及跨 Workspace isolation 測試標準。
8. `V2_payment_accounts` 與 `V2_workspace_payment_accounts` 的 canonical schema、migration、遮罩與角色權限策略。
9. `tenant-home.html` 要採用哪個行為，或如何合併未綁定導向與月份格式化。
10. `tenant-bills.html` 要採 full-height modal 或 bottom sheet，並以固定 shell、bottom nav、safe-area 與可捲動性做實機驗收。
11. Candidate 缺少的 18 個 repository HTML 中，哪些是正式頁、legacy 頁或應退休頁；至少先處理 candidate 目前會連到的 7 個頁面。
12. `new-lease.html` 的正式用途與 canonical 命名／migration。
13. 硬編碼付款 credentials 的輪替、Properties migration、Git history 與既有 Apps Script version 處理方案。
14. `.clasp.json` 與 `appsscript.json` 的 canonical repository 位置、是否提交 scriptId，以及既有 Web App URL 不變的部署程序。
15. 驗證器需如何增加 route handler、proxy dependency、common helper 與 HTML link completeness 檢查。

## 建議的 consolidation 分組

以下只是分組與依賴順序，不代表已選定任何檔案為正式版。

### Group A：Dispatcher 與 runtime 基礎

- `Code`
- `V2_API`
- `appsscript.json`
- JSONP／bridge、webhook、LINE push/log、access log、sheet helper
- 付款 credentials Properties migration

先建立可執行的最小 runtime，再驗證 68 routes；不能先刪 `V2_API`。

### Group B：身份、房客建立與 Workspace access

- `V2_TENANT_BINDING_PHONE`
- `V2_TENANT_LEASE_ONBOARDING`
- `V2_WORKSPACES`
- `V2_WORKSPACE_CREATION`
- `V2_WORKSPACE_LANDLORD_ACCESS`
- `V2_TEAM_MANAGEMENT`
- `V2_LANDLORD_ONBOARDING`
- `V2_LANDLORD_MANAGEMENT`

重點回歸：手機前導 0、跨表同步、角色、Workspace scope、principal landlord compatibility。

### Group C：房源、設定與帳務建立

- `V2_SYSTEM_SETTINGS`
- `V2_SETTINGS_INTEGRATION`
- `V2_PROPERTY_ROOM_MANAGEMENT`
- `V2_BILLING_MANAGEMENT`
- `V2_BILL_NOTIFICATIONS`

重點回歸：房間 → 租約 → Workspace 預設、押金、動態夏月、上期電表 null、收款帳號雙模型。

### Group D：付款閉環與 legacy reconciliation

- `V2_TENANT_PAYMENT_REPORTS`
- `V2_PAYMENT_SETTLEMENT`
- `V2_MANUAL_SETTLEMENT`
- `V2_PAYMENT_REVERSAL`
- `V2_PAID_BILL_MANAGEMENT`
- `V2_LEGACY_BILL_IMPORT`

重點回歸：回報 → 核准 → payment/bill 同步 → 手動結清 → reopen，以及 V1/V2 資料一致性與 rollback。

### Group E：Workspace native dashboard 與通知事件

- `V2_WORKSPACE_DASHBOARD_NATIVE`
- `V2_WORKSPACE_NOTIFICATIONS`
- `V2_WORKSPACE_OPERATION_AUDIT`
- `V2_AUTO_PAYMENT_REMINDER`
- `V2_CONTRACT_REQUESTS`
- `V2_TENANT_MESSAGES`
- `V2_TENANT_CHECKIN_MANAGEMENT`
- `V2_ANNOUNCEMENT_MANAGEMENT`

重點回歸：DocumentLock、所有事件仍寫通知中心、偏好只關 LINE push、團隊角色、公告容量與 final+1 manual follow-up。

### Group F：Frontend canonicalization

1. 先納入 24 個 repository/candidate 功能相同頁面。
2. 人工解決 `tenant-home.html`、`tenant-bills.html` 兩個 `CONFLICT`。
3. 盤點 18 個 repository-only 頁面，優先處理 candidate 會連到的 7 個頁面。
4. 驗證固定 shell、bottom nav、safe-area、modal z-index、登入返回與集中環境設定。

### Group G：Validation 與回歸基準

- Handler 與 transitive dependency 靜態檢查
- HTML 斷鏈檢查
- top-level function／const／let／var 重複檢查
- Apps Script 寫入、LINE、trigger、migration 函式風險標記
- `docs/09-TEST-MATRIX.md` 核心流程與 rollback

## 本輪變更聲明

本輪只做本地唯讀盤點、內容 diff、函式／route／handler／宣告掃描，並只建立：

```text
docs/22-BASELINE-DIFF-REPORT.md
```

本輪未修改或覆蓋任何既有 Apps Script、HTML、manifest、測試、設定或文件；未修改 Google Sheets；未執行 clasp push/deploy；未建立 branch；未 commit；未 push；未選擇或發布任何正式版。
