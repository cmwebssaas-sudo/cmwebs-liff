# V2 Canonical Merge Execution Checklist

建立日期：2026-07-19（Asia/Taipei）  
依據文件：[`22-BASELINE-DIFF-REPORT.md`](22-BASELINE-DIFF-REPORT.md)、[`23-CANONICAL-MERGE-PLAN.md`](23-CANONICAL-MERGE-PLAN.md)  
適用範圍：V2 Production Consolidation / Gate 0  
文件狀態：待執行 checklist；本文件不代表任何項目已完成

## 使用規則

- 每個 checkbox 必須有可重現證據，不得只以口頭確認勾選。
- 所有時間使用 Asia/Taipei，所有 ID／version／commit 必須記錄於受控交接紀錄。
- Secret 值不得寫入本文件、Git、終端輸出、issue 或測試紀錄。
- `test=1` 不是 dry-run；任何會寫資料或發 LINE 的測試都要先取得人工批准並限制測試 UID。
- P0 未全部通過前，不得執行 `clasp push` 或 `clasp deploy`。
- 本 checklist 不授權修改 Google Sheets、Script Properties、trigger 或 production deployment；執行時仍需逐項取得相應權限。
- 不新增圖表、正式報修工單、退租或其他 Gate 0 以外功能。

## 執行紀錄表

| 欄位 | 紀錄 |
|---|---|
| 執行 branch | `chore/v2-production-consolidation` 或經批准的 `codex/` feature branch |
| 執行人 |  |
| Reviewer |  |
| 開始時間 |  |
| P0 完成時間 |  |
| P1 完成時間 |  |
| 部署批准人 |  |
| 部署時間 |  |
| Smoke test 結果 |  |
| Rollback owner |  |
| 最終 commit |  |
| Baseline tag |  |

## 1. Merge 前 backup checklist

### 1.1 Repository rollback point

- [ ] 確認工作目錄是 `/Users/hans/CMWebs/cmwebs-liff`。
- [ ] 記錄目前 branch、HEAD commit 與 upstream。
- [ ] 執行並保存 `git status --short`；確認所有既有 untracked/modified 檔案的 owner。
- [ ] 不覆蓋或納入與 consolidation 無關的使用者變更。
- [ ] 記錄 GitHub Pages 目前對應的 commit／deployment artifact。
- [ ] 記錄 repository root 44 個 HTML 的 SHA-256。
- [ ] 記錄 `_deployed/apps-script` 32 個檔案的 SHA-256。
- [ ] 記錄 candidate overlay 21 個 Apps Script 與 26 個 HTML 的 SHA-256。
- [ ] 將 `docs/22-BASELINE-DIFF-REPORT.md` 與 `docs/23-CANONICAL-MERGE-PLAN.md` 納入 reviewer sign-off。
- [ ] 建立可回復的 pre-merge Git commit／tag 或其他經批准的 immutable rollback reference。
- [ ] Rollback reference 已由第二人確認可 checkout／revert，不使用 destructive reset 作正常 rollback。

Evidence：

```text
Branch:
HEAD commit:
Upstream:
GitHub Pages commit:
Pre-merge rollback reference:
HTML hash inventory:
Apps Script hash inventory:
Reviewer:
```

### 1.2 Deployed Apps Script snapshot

- [ ] 確認 `_deployed/apps-script` 是目前實際部署專案的最新匯出，不只依交接日期推定。
- [ ] 使用經批准的唯讀／pull 流程取得 fresh deployed snapshot；不得覆蓋既有 snapshot。
- [ ] Fresh snapshot 存放於 canonical source 之外的受控 backup artifact。
- [ ] Snapshot 包含所有 `.js`、`appsscript.json` 與 deployment binding metadata。
- [ ] Snapshot 檔案數與內容 hash 已保存。
- [ ] 比較 fresh snapshot 與 `_deployed/apps-script`，差異已人工審核。
- [ ] 若 fresh snapshot 與 baseline report 不同，停止 merge，先更新差異報告與計畫。
- [ ] Snapshot 不包含明文 Script Properties 值。
- [ ] Snapshot artifact 有 owner、建立時間、來源專案與 retention 期限。

Evidence：

```text
Snapshot artifact:
Captured at:
Source Apps Script project:
File count:
SHA-256 inventory:
Difference from _deployed/apps-script:
Approved by:
```

### 1.3 Apps Script version 與 deployment

- [ ] 記錄目前 live Apps Script project ID；只存放於受控紀錄，不在公開文件顯示。
- [ ] 以 `clasp versions` 或 Apps Script console 記錄目前所有相關 version。
- [ ] 確認目前 live Web App 正指向哪一個 Apps Script version。
- [ ] 以 `clasp deployments` 或 Apps Script console 記錄既有 Web App deployment ID。
- [ ] 記錄既有 Web App URL，確認 rollback 與新部署都必須維持此 URL。
- [ ] 記錄上一個已知可用 version，作為 backend rollback target。
- [ ] 確認 deployment execute-as 與 access 設定與 `appsscript.json` 一致。
- [ ] 沒有建立新 deployment ID 取代既有 Web App；更新時使用既有 deployment ID。

Evidence：

```text
Apps Script project ID: [secure record only]
Current live version:
Previous known-good version:
Deployment ID: [secure record only]
Web App URL: [secure deployment record]
executeAs:
access:
Captured by:
Captured at:
```

### 1.4 Trigger、Properties 與資料狀態

- [ ] 匯出目前 trigger 清單：function、type、schedule、unique id、owner。
- [ ] 確認自動催繳目前的正式 trigger 數量與實際 schedule。
- [ ] 匯出 Script Properties key 名稱清單，不匯出值。
- [ ] 確認 LINE token、Spreadsheet ID、付款 credentials 的 key 已有安全 owner。
- [ ] 取得 Google Sheets 唯讀 Schema snapshot：sheet、headers、row count、column count、max rows、max columns。
- [ ] 記錄 `V2_payment_accounts` 與 `V2_workspace_payment_accounts` 是否存在及 row/header 摘要。
- [ ] 記錄 V1/V2 帳務相關表的 row count，供 settlement/reversal 驗證。
- [ ] 對會寫資料、發 LINE、建立 trigger、repair、sync 或 import 的 test/function 建立副作用清單。

### 1.5 Backup Gate

- [ ] Repository rollback point 可用。
- [ ] Fresh deployed snapshot 可用。
- [ ] Current/previous Apps Script versions 已記錄。
- [ ] Existing deployment ID 與 Web App URL 已記錄。
- [ ] Trigger inventory 已記錄。
- [ ] Properties key inventory 已記錄且無值外洩。
- [ ] Schema snapshot 已記錄。
- [ ] Rollback owner 已確認。
- [ ] Backup Gate 經人工簽核後才可開始 P0。

## 2. Repository canonical structure

### 2.1 最終資料夾結構

Gate 0 完成時預期結構：

```text
cmwebs-liff/
├── apps-script/
│   ├── Code.gs
│   ├── TESTS.gs
│   ├── V2_API.gs
│   ├── V2_*.gs
│   └── appsscript.json
├── docs/
│   ├── 22-BASELINE-DIFF-REPORT.md
│   ├── 23-CANONICAL-MERGE-PLAN.md
│   ├── 24-CANONICAL-MERGE-EXECUTION-CHECKLIST.md
│   └── ...
├── scripts/
│   └── validate-project.js
├── *.html                 # GitHub Pages canonical root，Gate 0 不搬路徑
├── package.json
└── production-manifest.json
```

結構檢查：

- [ ] `apps-script/` 是唯一 canonical backend 目錄。
- [ ] `_deployed/` 只作 snapshot/provenance，不作部署 source。
- [ ] `_handoff/.../candidate-overlay` 只作 comparison/provenance，不作部署 source。
- [ ] Repository root HTML 仍是 GitHub Pages canonical frontend。
- [ ] 沒有同時存在 `Code.gs` 與 `程式碼.js` 於 canonical deployment root。
- [ ] 沒有同 basename `.js`／`.gs` 雙份模組。
- [ ] 沒有 `_FIXED`、`_WITH_*`、`final-*`、`complete-*` 等 variant 檔。
- [ ] `new-lease.html` 已標記 P2 usage/rename decision，不把它視為新 canonical 命名範例。

### 2.2 Apps Script canonical module mapping

| Canonical path | Merge source | Priority | 核對重點 |
|---|---|---|---|
| `apps-script/Code.gs` | `_deployed/apps-script/程式碼.js` | P0 | 唯一 dispatcher、68 routes；硬編碼 credentials 必須移出 canonical source。 |
| `apps-script/V2_API.gs` | `_deployed/apps-script/V2_API.js` | P0 | JSONP/bridge、webhook、LINE、sheet/access log helpers、tenant home/bills。 |
| `apps-script/V2_WORKSPACES.gs` | deployed；與 candidate 相同 | P0 | Workspace context。 |
| `apps-script/V2_WORKSPACE_CREATION.gs` | deployed；與 candidate 相同 | P0 | Workspace create。 |
| `apps-script/V2_WORKSPACE_LANDLORD_ACCESS.gs` | deployed；與 candidate 相同 | P0 | Workspace proxy、roles、principal landlord compatibility。 |
| `apps-script/V2_WORKSPACE_DASHBOARD_NATIVE.gs` | deployed/candidate 功能相同 | P0 | Native home/arrears/tenants；只保留一份。 |
| `apps-script/V2_WORKSPACE_OPERATION_AUDIT.gs` | deployed；與 candidate 相同 | P0 | 寫入 audit。 |
| `apps-script/V2_TEAM_MANAGEMENT.gs` | deployed；與 candidate 相同 | P0 | Team roles、invite、phone。 |
| `apps-script/V2_LANDLORD_MANAGEMENT.gs` | deployed；與 candidate 相同 | P0 | Landlord identity。 |
| `apps-script/V2_LANDLORD_ONBOARDING.gs` | deployed；與 candidate 相同 | P0 | Multi-workspace onboarding。 |
| `apps-script/V2_TENANT_BINDING_PHONE.gs` | `_deployed/apps-script/V2_TENANT_BINDING_PHONE.js` | P0 | Binding routes、phone normalization、cross-sheet sync/repair。 |
| `apps-script/V2_TENANT_LEASE_ONBOARDING.gs` | `_deployed/apps-script/V2_TENANT_LEASE_ONBOARDING.js` | P0 | Tenant create routes、lease/view sync。 |
| `apps-script/V2_SYSTEM_SETTINGS.gs` | deployed；與 candidate 相同 | P0 | Properties/settings、leading zero、preferences。 |
| `apps-script/V2_SETTINGS_INTEGRATION.gs` | deployed；與 candidate 相同 | P0 | Workspace billing defaults。 |
| `apps-script/V2_PROPERTY_ROOM_MANAGEMENT.gs` | deployed；與 candidate 相同 | P0 | Room/property、deposit、summer months。 |
| `apps-script/V2_BILLING_MANAGEMENT.gs` | deployed；與 candidate 相同 | P0 | Bills、previous meter、Workspace defaults。 |
| `apps-script/V2_BILL_NOTIFICATIONS.gs` | deployed；與 candidate 相同 | P0 | Bill notifications。 |
| `apps-script/V2_AUTO_PAYMENT_REMINDER.gs` | deployed；與 candidate 相同 | P0 | Workspace schedule、dynamic reminder days。 |
| `apps-script/V2_WORKSPACE_NOTIFICATIONS.gs` | deployed；與 candidate 相同 | P0 | All events、DocumentLock。 |
| `apps-script/V2_TENANT_PAYMENT_REPORTS.gs` | deployed；與 candidate 相同 | P1 | Payment report submit/update/team notification。 |
| `apps-script/V2_PAYMENT_SETTLEMENT.gs` | `_deployed/apps-script/V2_PAYMENT_SETTLEMENT.js` | P1 | Formal settlement dependency。 |
| `apps-script/V2_MANUAL_SETTLEMENT.gs` | `_deployed/apps-script/V2_MANUAL_SETTLEMENT.js` | P1 | Manual settle、legacy sync/audit。 |
| `apps-script/V2_PAYMENT_REVERSAL.gs` | `_deployed/apps-script/V2_PAYMENT_REVERSAL.js` | P1 | Reopen/reversal。 |
| `apps-script/V2_PAID_BILL_MANAGEMENT.gs` | `_deployed/apps-script/V2_PAID_BILL_MANAGEMENT.js` | P1 | Paid bills init。 |
| `apps-script/V2_CONTRACT_REQUESTS.gs` | deployed；與 candidate 相同 | P1 | Contract requests/team notification。 |
| `apps-script/V2_TENANT_MESSAGES.gs` | deployed；與 candidate 相同 | P1 | Tenant messages/team notification。 |
| `apps-script/V2_TENANT_CHECKIN_MANAGEMENT.gs` | deployed；與 candidate 相同 | P1 | Check-in/team/LINE failure notifications。 |
| `apps-script/V2_ANNOUNCEMENT_MANAGEMENT.gs` | deployed；與 candidate 相同 | P1 | Announcement/capacity/team result。 |
| `apps-script/V2_LEGACY_BILL_IMPORT.gs` | `_deployed/apps-script/V2_LEGACY_BILL_IMPORT.js` | P2/controlled | Migration/preview only until approved。 |
| `apps-script/TESTS.gs` | `_deployed/apps-script/TESTS.js` | P2/controlled | Diagnosis；先標記副作用。 |
| `apps-script/appsscript.json` | `_deployed/apps-script/appsscript.json` | P0 | V8、timezone、webapp config。 |

Mapping 驗證：

- [ ] 30 個 deployed 程式檔全部有唯一 canonical mapping。
- [ ] 21 個 shared modules 的 canonical hash 與已確認來源一致，或差異有人工說明。
- [ ] 9 個 deployed-only modules 未遺漏。
- [ ] `appsscript.json` 已映射。
- [ ] `.clasp.json` policy 已決定；實際 script ID 未寫入公開文件。

### 2.3 HTML canonical mapping

#### A. Repository/candidate 功能相同：保留 repository canonical（24）

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

- [ ] 上列 24 頁不以 candidate 重複覆蓋 repository。
- [ ] 純 EOF/空白差異不製造無意義 merge noise。

#### B. HTML conflict：採 repository 行為並保留 rollback artifact（2）

| Canonical HTML | Canonical source/行為 | Rollback artifact |
|---|---|---|
| `tenant-home.html` | Repository：未綁定導向 `tenant-bind.html`、帳單月份格式化。 | Candidate 版本與 SHA-256。 |
| `tenant-bills.html` | Repository：full-height modal、overscroll containment、scroll reset。 | Candidate bottom-sheet 版本與 SHA-256。 |

#### C. Repository-only：先保留（18）

```text
announce.html
batch-meter.html
checkout.html
hub.html
identity.html
index.html
landlord-activity.html
landlord-line-logs.html
landlord-messages.html
landlord-paid-bills.html
landlord-payment-reports.html
landlord-registry.html
landlord-settings.html
landlord-workspaces.html
landlord.html
meter.html
new-lease.html
tenant-checkin.html
```

- [ ] 其中 7 個被現行 candidate/repository 導覽引用的頁面完成 loading/link test。
- [ ] 其餘 11 個頁面完成 usage/legacy 標記後才可提出移除 PR。
- [ ] Gate 0 不刪除 repository-only HTML。

## 3. P0 implementation checklist

### 3.1 Canonical runtime foundation

- [ ] Backup Gate 已通過。
- [ ] 建立 `apps-script/`，未改動 `_deployed/` 或 candidate overlay。
- [ ] 將 deployed 程式正規化為 30 個 canonical `.gs`，不建立 suffix 版本。
- [ ] 將 `程式碼.js` 映射為唯一 `Code.gs`。
- [ ] `Code.gs` 仍有 68 個唯一 routes。
- [ ] `Code.gs` 只負責唯一 route dispatcher；沒有第二份 `doGet`／`doPost`。
- [ ] 付款 credentials 已從 canonical source 移除並改用 Apps Script Properties。
- [ ] 已暴露 credentials 的 rotation 有安全 owner 與獨立批准。
- [ ] `appsscript.json` 已對帳 deployed runtime/timezone/webapp 設定。

### 3.2 V2_API restore

- [ ] 從實際 deployed `V2_API.js` 建立 canonical `V2_API.gs`，不以 candidate 缺檔推定可刪。
- [ ] `getTenantHomeByLineUid` 存在。
- [ ] `getTenantBillsByLineUid` 存在。
- [ ] `getLandlordLineLogsByLineUid` 存在。
- [ ] `landlordSendTenantMessageByLineUid_` 存在。
- [ ] `jsonOutput_` 存在且 JSONP callback 行為與 deployed 一致。
- [ ] `htmlBridgeOutput_` 存在且 bridge response 行為與 deployed 一致。
- [ ] `handleLineWebhook_` 與 `processLineWebhookEvent_` 存在。
- [ ] `pushLineTextMessage_` 只從 Script Properties 讀 LINE token。
- [ ] `cmwebsLogLineMessage_` 存在。
- [ ] `getSheetObjects_` 存在。
- [ ] `logLiffAccess_` 存在。
- [ ] V1 paid sync/install/remove trigger functions 已標記副作用，未在 P0 執行。
- [ ] Legacy home/arrears/tenants functions 暫保留，但 routes 仍指向 Workspace-native handlers。
- [ ] `V2_API` restore 後沒有和其他模組產生重複 top-level 宣告。

### 3.3 Tenant binding restore

- [ ] 從實際 deployed `V2_TENANT_BINDING_PHONE.js` 建立 `V2_TENANT_BINDING_PHONE.gs`。
- [ ] `tenant_binding_status` 指向 `getTenantBindingStatusByLineUid_`。
- [ ] `tenant_bind_submit` 指向 `bindTenantByLineUid_`。
- [ ] `+8869xxxxxxxx`、`8869xxxxxxxx`、`9xxxxxxxx` 正規化為 `09xxxxxxxx`。
- [ ] 手機比對不授予跨 Workspace 權限。
- [ ] 綁定後更新正確 tenant/user/contract 欄位。
- [ ] `V2_tenant_home_view` 同步 `line_user_id`／`tenant_line_user_id`。
- [ ] `V2_tenant_bill_view` 同步 tenant LINE identity。
- [ ] `V2_landlord_tenant_list_view` 只更新 `tenant_line_user_id`，不覆蓋房東 `line_user_id`。
- [ ] Binding log、failure throttling 與 conflict handling 保留。
- [ ] Diagnose/repair functions 已標記為人工受控，不在 production 自動執行。
- [ ] 使用隔離測試資料驗證跨表同步；未直接對正式全部房客執行 repair。

### 3.4 Tenant onboarding restore

- [ ] 從實際 deployed `V2_TENANT_LEASE_ONBOARDING.js` 建立 `V2_TENANT_LEASE_ONBOARDING.gs`。
- [ ] 不以歷史檔名 `FAST_FIXED`／`PERFORMANCE_FIXED` 推定版本；以 deployed 實際內容為基準。
- [ ] `landlord_tenant_create_init` 指向 `getLandlordTenantCreateInitByLineUid_`。
- [ ] `landlord_tenant_create` 指向 `createLandlordTenantLeaseByLineUid_`。
- [ ] 寫入前驗證 Workspace access、角色與 create permission。
- [ ] 只列出目前 Workspace 可用 property/room。
- [ ] Tenant phone 以文字保存並正規化前導 0。
- [ ] 建立／更新 `V2_users`、`V2_tenants`、`V2_contracts` 的資料關聯正確。
- [ ] Landlord tenant list／tenant home view 同步正確。
- [ ] 租約日期重疊檢查正確。
- [ ] 房間、租約、Workspace 預設值順序正確。
- [ ] 邀請訊息與 LIFF URL 不改變既有正式入口。
- [ ] Audit 記錄 actor、workspace、target 與結果。

### 3.5 P0 acceptance

- [ ] 7 個 candidate 缺少的 runtime modules 全部納入 canonical source，付款 4 模組可於 P1 完成功能驗收。
- [ ] 68/68 第一層 handlers 可解析。
- [ ] 6/6 proxy 第二層 handlers 可解析。
- [ ] 共用 runtime helpers 全部可解析。
- [ ] Top-level function／const／let／var 重複為 0。
- [ ] Source secret scan 為 0。
- [ ] `npm run validate` 通過。
- [ ] P0 尚未執行 `clasp push`／`clasp deploy`。

## 4. P1 implementation checklist

### 4.1 Payment module restoration

- [ ] `V2_TENANT_PAYMENT_REPORTS.gs` 使用 deployed/candidate 已確認相同內容。
- [ ] `V2_PAYMENT_SETTLEMENT.gs` 從 deployed restore。
- [ ] `V2_MANUAL_SETTLEMENT.gs` 從 deployed restore。
- [ ] `V2_PAYMENT_REVERSAL.gs` 從 deployed restore。
- [ ] `V2_PAID_BILL_MANAGEMENT.gs` 從 deployed restore。
- [ ] `V2_WORKSPACE_LANDLORD_ACCESS.gs` 的 payment proxies 保留 Workspace access 驗證。
- [ ] Accountant／`can_approve_payment` 權限符合規則。
- [ ] 無權限角色不能讀取未遮罩銀行帳號或執行 settlement/reversal。
- [ ] `workspace_id` 是 scope 主鍵，`landlord_id` 只作相容查詢。

### 4.2 Payment report flow

- [ ] `tenant_payment_report_init` 載入正確房客、帳單與付款資訊。
- [ ] `tenant_payment_report_submit` 建立唯一 payment report。
- [ ] 重複提交／pending report handling 符合現行規則。
- [ ] 團隊收到 `payment_report` 通知事件。
- [ ] 通知偏好關閉時仍建立通知中心事件，只停止 LINE push。
- [ ] `landlord_payment_reports_init` 只回傳目前 Workspace 資料。
- [ ] `landlord_payment_report_update` 的 accept/reject 狀態與 note 正確。

### 4.3 Settlement

- [ ] `landlord_payment_report_settle` 進入 `settleWorkspaceLandlordPaymentReportByLineUid_`。
- [ ] Proxy 成功委派 `settleLandlordPaymentReportByLineUid_`。
- [ ] Settlement 前再次驗證 Workspace、角色與 payment permission。
- [ ] 成功時建立唯一 `V2_payments` 紀錄。
- [ ] `V2_bills` payment/bill status、paid amount/date 更新一致。
- [ ] Payment report 狀態同步為 settled/approved 的 canonical 值。
- [ ] 同一 report/bill 重複 settlement 不產生第二筆有效付款。
- [ ] Legacy V1/V2 sync 結果可追蹤且失敗時不偽裝成功。
- [ ] Audit/log 包含 workspace、bill、report、payment、actor 與結果。

### 4.4 Manual settlement

- [ ] `landlord_bill_manual_settle` 進入 `manualSettleWorkspaceLandlordBillByLineUid_`。
- [ ] Proxy 成功委派 `manualSettleLandlordBillByLineUid_`。
- [ ] Payment date/method/amount/bank last5/source/note 驗證正確。
- [ ] 現行不支援的部分付款、溢繳、退款不被誤判為完整結清。
- [ ] Manual settlement 建立 payment、更新 bill 並寫 audit。
- [ ] Tenant notification 只在明確選擇且受控測試下發送。
- [ ] Legacy monthly/history sync 差異有明確結果與 rollback evidence。

### 4.5 Reversal

- [ ] `landlord_bill_reopen` 進入 `reopenWorkspaceLandlordBillByLineUid_`。
- [ ] Proxy 成功委派 `reopenLandlordBillByLineUid_`。
- [ ] Reversal reason 必填且記錄 actor/workspace。
- [ ] Active payment 正確 void，不直接刪除歷史付款紀錄。
- [ ] Related payment reports 依現行規則更新／void。
- [ ] Bill 恢復 unpaid/overdue 的 canonical 狀態與金額正確。
- [ ] Legacy monthly/history sync 可追蹤。
- [ ] Reversal 後催繳防重／最高 stage 狀態不被錯誤重置。
- [ ] Tenant notification 只在明確選擇且受控測試下發送。

### 4.6 Paid bills

- [ ] `landlord_paid_bills_init` 進入 `getWorkspaceLandlordPaidBillsInitByLineUid_`。
- [ ] Proxy 成功委派 `getLandlordPaidBillsInitByLineUid_`。
- [ ] 只列目前 Workspace 的已繳帳單。
- [ ] Payment-report settlement 與 manual settlement 都會出現在已繳清單。
- [ ] Source type/label、payment date、amount 與 tenant/room 正確。
- [ ] Reopened/voided payment 不再被當作有效已繳。
- [ ] `landlord-paid-bills.html` loading、filter、detail 與 reopen entry 正常。

### 4.7 P1 payment acceptance

- [ ] 房客回報 → 房東核准 → settlement 全流程通過。
- [ ] Manual settle 全流程通過。
- [ ] Reopen/reversal 全流程通過。
- [ ] Paid bills 查詢與前述流程一致。
- [ ] 未授權角色與跨 Workspace actor 全部被拒絕。
- [ ] LINE 與通知中心事件符合偏好規則。
- [ ] 正式資料未使用 `test=1` 當 dry-run。

## 5. HTML migration checklist

### 5.1 General HTML migration

- [ ] Repository root 保持 GitHub Pages canonical 路徑，Gate 0 不搬到 `public/`。
- [ ] 24 個 repository/candidate SAME 頁維持 repository 內容，不產生無意義覆蓋 diff。
- [ ] 18 個 repository-only 頁先保留。
- [ ] Candidate 會連到的 7 個 repository-only 頁 loading 成功。
- [ ] 所有內部 `.html` 連結存在。
- [ ] API URL、LIFF ID 與測試 UID 未在 migration 中意外改變。
- [ ] 所有 HTML inline script 通過 syntax validation。
- [ ] 所有頁面保留正確 role/Workspace route 參數。

### 5.2 `tenant-home.html`

- [ ] Canonical 採 repository 版本並記錄 SHA-256。
- [ ] Candidate 版本與 SHA-256 保存為 rollback artifact。
- [ ] `TENANT_NOT_FOUND` 會導向 `tenant-bind.html`。
- [ ] `TENANT_BINDING_REQUIRED` 會導向 `tenant-bind.html`。
- [ ] `test=1` 導向時參數行為符合現行測試規則，且 UI 不宣稱 dry-run。
- [ ] 已綁定房客不會發生 redirect loop。
- [ ] `latest_bill_month` 格式化顯示正確。
- [ ] Tenant home、contract 與其他並行 request 一個失敗時錯誤處理正確。
- [ ] Back/refresh/LIFF reopen 行為正常。

### 5.3 `tenant-bills.html`

- [ ] Canonical 暫採 repository full-height modal 版本並記錄 SHA-256。
- [ ] Candidate bottom-sheet 版本與 SHA-256 保存為 rollback artifact。
- [ ] Detail modal 開啟時 scrollTop 重設為 0。
- [ ] 長內容可垂直捲動，不發生 body/page 雙重卡死。
- [ ] Modal z-index 高於 bottom nav。
- [ ] Modal 關閉後 page scroll position 與 focus 合理恢復。
- [ ] 點擊 overlay／close button／返回鍵的行為符合既有 UX。
- [ ] Safe-area 底部內容不被遮住。
- [ ] 若任何實機驗收失敗，停止 promotion，回復 candidate bottom-sheet 後重新決策。

### 5.4 Mobile UI validation

每個關鍵頁至少驗證：

- [ ] iPhone Safari。
- [ ] iPhone LINE WebView。
- [ ] Android Chrome。
- [ ] Android LINE WebView。
- [ ] 小螢幕與大字級。
- [ ] Portrait；必要頁面確認 orientation change。
- [ ] 鍵盤彈出／收合。
- [ ] `visualViewport.height` 可用時 `--app-height` 正確。
- [ ] fallback `window.innerHeight` 正確。
- [ ] `html, body { height:100%; overflow:hidden; }` 保留。
- [ ] `.app-shell { position:relative; height:var(--app-height); overflow:hidden; }` 保留。
- [ ] `.page { height:100%; overflow-y:auto; }` 保留。
- [ ] `.bottom-nav { position:absolute; bottom:0; }` 保留。
- [ ] 頁底預留 nav 與 `safe-area-inset-bottom`。
- [ ] Modal、toast、loading overlay 不被 bottom nav 遮擋。
- [ ] LIFF 登入後可返回原頁。
- [ ] API timeout/error/empty state 可讀且可恢復。

Mobile evidence：

```text
Device / OS / Browser-WebView:
Page:
Scenario:
Result:
Screenshot/video artifact:
Reviewer:
```

## 6. Validation checklist

### 6.1 Static validation

- [ ] 執行 `npm run validate`，結果通過。
- [ ] 30 個 canonical `.gs` 均通過 syntax check。
- [ ] 44 個 HTML inline scripts 均通過 syntax check。
- [ ] Top-level function duplicate = 0。
- [ ] Top-level const duplicate = 0。
- [ ] Top-level let duplicate = 0。
- [ ] Top-level var duplicate = 0。
- [ ] 除已登錄的 legacy exception `new-lease.html` 外，新增 forbidden variant filename = 0；P2 完成其 usage／rename／retirement 決策。
- [ ] Possible committed secrets = 0。
- [ ] Canonical module count 與 manifest 一致。
- [ ] HTML internal missing link = 0，或每個 legacy exception 有文件。

### 6.2 Route 與 handler coverage

- [ ] `Code.gs` route count = 68。
- [ ] Unique route count = 68。
- [ ] Duplicate route count = 0。
- [ ] `docs/04-API-ROUTES.md` 與 68 routes 完全一致。
- [ ] 68/68 第一層 handler 定義存在。
- [ ] Candidate 原缺少的 6 個直接 handlers 全部存在：
  - [ ] `getTenantBindingStatusByLineUid_`
  - [ ] `bindTenantByLineUid_`
  - [ ] `getLandlordTenantCreateInitByLineUid_`
  - [ ] `createLandlordTenantLeaseByLineUid_`
  - [ ] `getTenantHomeByLineUid`
  - [ ] `getTenantBillsByLineUid`
- [ ] 6 個 proxy 的第二層 handler 全部存在：
  - [ ] `getLandlordLineLogsByLineUid`
  - [ ] `landlordSendTenantMessageByLineUid_`
  - [ ] `settleLandlordPaymentReportByLineUid_`
  - [ ] `manualSettleLandlordBillByLineUid_`
  - [ ] `reopenLandlordBillByLineUid_`
  - [ ] `getLandlordPaidBillsInitByLineUid_`
- [ ] JSONP/bridge/webhook/common helpers 全部存在。
- [ ] 每個寫入 route 均有 Workspace、角色與權限驗證。

### 6.3 HTML loading

- [ ] 44/44 repository HTML 可由本地靜態伺服器載入。
- [ ] 所有 canonical LIFF entry pages 無 JavaScript startup error。
- [ ] Landlord entry/register/onboarding/home 可依狀態導向。
- [ ] Tenant bind/home/bills/contract/payment/message 可載入。
- [ ] 7 個 candidate 依賴的 repository-only landlord 頁可載入。
- [ ] Loading、empty、error、timeout state 均可恢復。
- [ ] JSONP callback 清理正確，不殘留重複 global callback。
- [ ] Bridge mode response 可解析。

### 6.4 Workspace isolation

- [ ] Owner 只能操作有 membership 的 Workspace。
- [ ] Admin/manager/accountant/maintenance/viewer 權限符合規則。
- [ ] Workspace switch 後 home/arrears/tenants/messages/payments 全部切換 scope。
- [ ] 不同 Workspace 相同手機號碼不會授予錯誤權限。
- [ ] Tenant binding 不會把 LINE UID 同步到其他 Workspace tenant。
- [ ] Property/room/tenant/contract/bill/payment queries 都限制目前 Workspace。
- [ ] Settlement/manual/reversal 寫入驗證 target bill/report 屬於目前 Workspace。
- [ ] Bank account 對無權限角色只回傳遮罩值。
- [ ] Audit 記錄 actor user/membership/workspace/target/result。
- [ ] Legacy principal-landlord proxy 不會繞過 Workspace scope。

### 6.5 LINE flow

- [ ] Tenant LIFF login 正常。
- [ ] Landlord LIFF login 正常，登入後返回原頁。
- [ ] Tenant binding status/submit 正常。
- [ ] LINE webhook signature／event handling 使用正式安全設定。
- [ ] Tenant message、payment report、contract、bill、check-in、announcement 事件可進通知中心。
- [ ] Team recipient roles/permissions 正確。
- [ ] 通知偏好開啟時，只向受控測試 UID 執行 smoke push。
- [ ] 通知偏好關閉時事件仍保存，只停止 LINE push。
- [ ] LINE failure 產生 `line_failure` 事件與 log。
- [ ] Message log direction/status/error 可追蹤。
- [ ] 不使用 production 大量 UID 做測試。
- [ ] `test=1` 的真實副作用已由 tester 確認。

### 6.6 Payment flow

- [ ] Tenant payment report init/submit。
- [ ] Landlord payment report init/update。
- [ ] Payment report settlement。
- [ ] Manual settlement。
- [ ] Payment reversal/reopen。
- [ ] Paid bills init/detail。
- [ ] Duplicate settlement prevention。
- [ ] Bill/payment/report status consistency。
- [ ] V1/V2 sync consistency 或明確受控 failure。
- [ ] Audit/log completeness。
- [ ] Cross-Workspace rejection。
- [ ] Unauthorized-role rejection。
- [ ] Tenant/team notification behavior。
- [ ] 不支援的 partial/overpayment/refund 不被誤處理。

### 6.7 Final validation Gate

- [ ] P0 implementation checklist 全部通過。
- [ ] P1 payment checklist 全部通過。
- [ ] HTML/mobile checklist 全部通過。
- [ ] 68 routes 與 handler coverage 全部通過。
- [ ] Workspace isolation 全部通過。
- [ ] LINE flow 使用受控測試帳號通過。
- [ ] Payment flow 使用受控測試資料通過。
- [ ] Schema、trigger、Properties inventories 已更新且無 secret 值。
- [ ] Reviewer 已確認 diff、風險、部署與 rollback evidence。
- [ ] 已取得 `clasp push`／`clasp deploy` 的明確人工批准。

## 7. Deployment checklist

### 7.1 Pre-deployment approval

- [ ] Final validation Gate 已通過。
- [ ] Git diff 只包含已批准的 canonical merge、validator/docs 與必要設定變更。
- [ ] 沒有 unrelated user changes 被納入。
- [ ] Canonical commit 已建立並由 reviewer 核准。
- [ ] Current live version、previous known-good version、deployment ID 與 Web App URL 再次確認。
- [ ] Apps Script Properties 已由授權人員設定，值未出現在 terminal/log。
- [ ] Trigger 切換計畫已確認，沒有預計建立重複 hourly reminder trigger。
- [ ] Smoke test 測試帳號、Workspace、tenant、bill/report IDs 已限制並記錄於安全測試紀錄。
- [ ] Rollback owner 在線並可操作既有 deployment。
- [ ] 部署時段與影響通知已確認。

### 7.2 `clasp push`

下列為未來待執行步驟，本文件建立時不執行：

- [ ] 在 canonical `apps-script/` deployment root 執行 `clasp status`，確認 push set。
- [ ] 確認 push set 不含 `_deployed/`、candidate overlay、docs、backup artifact 或 secret 檔。
- [ ] 確認 `.clasp.json` 指向正確 project，ID 不輸出到公開 log。
- [ ] 再執行一次 syntax、duplicate、route、handler 與 secret validation。
- [ ] 取得 push 的即時人工批准。
- [ ] 執行 `clasp push`。
- [ ] 保存 push 輸出、時間、operator 與 canonical commit。
- [ ] Push 後重新 `clasp pull` 到獨立驗證 snapshot，比對 Apps Script project 與 canonical source。
- [ ] 若 pull-back diff 非預期，停止 deploy 並 restore previous source/version。

### 7.3 Apps Script version 與 `clasp deploy`

- [ ] 使用 `clasp version` 建立新的 immutable Apps Script version。
- [ ] 記錄新 version number 與 canonical commit。
- [ ] 確認不建立新的 Web App URL。
- [ ] 使用既有 deployment ID 更新至新 version。
- [ ] 取得 deploy 的即時人工批准。
- [ ] 依當前 clasp 版本的 help/schema 執行 `clasp deploy`，明確指定既有 deployment ID 與新 version。
- [ ] 記錄 deploy output、version、deployment ID（安全紀錄）、時間與 operator。
- [ ] 確認 Web App URL 與部署前完全相同。
- [ ] 確認 execute-as/access 未改變。
- [ ] 部署後暫不執行 migration、repair、import 或新 trigger 安裝。

### 7.4 Backend smoke test

先讀後寫，任何一項失敗即停止：

- [ ] Web App health/fallback response 可達。
- [ ] JSONP callback response 正確。
- [ ] Bridge response 正確。
- [ ] `tenant_binding_status` 使用受控 UID 正常。
- [ ] `tenant_home` 使用已綁定受控 UID 正常。
- [ ] `tenant_bills` 使用受控 UID 正常。
- [ ] `landlord_entry_status` 正常。
- [ ] `landlord_home` 使用受控 Workspace 正常。
- [ ] `landlord_arrears` 正常。
- [ ] `landlord_tenants` 正常。
- [ ] Workspace switch 後 scope 正確。
- [ ] 受控 payment report query 正常。
- [ ] 受控 notification center query 正常。
- [ ] LINE webhook endpoint 可解析受控測試事件。
- [ ] 無新 top-level/runtime error。

受控寫入 smoke test（需另行批准）：

- [ ] 一筆受控 tenant binding 或已存在 binding 的無害驗證。
- [ ] 一筆受控 payment report submit/update/settle，並完成資料核對或 rollback。
- [ ] 一筆受控 manual settle/reopen round trip，並確認 audit。
- [ ] 一筆受控通知事件；LINE push 只發測試 UID。
- [ ] Smoke test 後 bills/payments/reports/logs/notifications row 與狀態一致。

### 7.5 Frontend/GitHub Pages deployment

- [ ] Frontend commit 與 backend version compatibility 已確認。
- [ ] GitHub Pages 仍從既有 canonical branch/path 發布。
- [ ] 發布後 44 個 HTML 可達或符合已記錄 legacy policy。
- [ ] `landlord-entry.html` LIFF 登入返回正常。
- [ ] `tenant-home.html` binding redirect 正常。
- [ ] `tenant-bills.html` mobile modal 實機正常。
- [ ] 7 個 repository-only 導覽依賴頁無 404。
- [ ] API URL、LIFF URL、Web App URL 未意外變更。
- [ ] GitHub Pages deployment 可對應到明確 commit。

### 7.6 Trigger enablement

- [ ] 部署前 trigger inventory 再次確認。
- [ ] 新 code smoke test 通過後才處理 trigger。
- [ ] 自動催繳正式 hourly dispatcher 最終只保留一個。
- [ ] Workspace timezone/hour/days 設定 preview 正確。
- [ ] 不使用 `test=1` 模擬無副作用 trigger。
- [ ] Trigger enablement 時間與 owner 已記錄。
- [ ] 啟用後第一個時段監看 reminder logs、LINE logs 與 notification center。
- [ ] 發現重複發送立即停用新 trigger 並進 rollback。

### 7.7 Rollback procedure

任一 smoke test、權限、資料一致性、LINE、mobile UI 或 secret 檢查失敗時：

- [ ] 宣告 deployment failed，停止後續 smoke write、migration、repair、import 與 trigger change。
- [ ] 記錄失敗時間、route/page、request id、Apps Script version、commit 與錯誤，不記錄 secret。
- [ ] 將既有 Web App deployment 重新指向 previous known-good Apps Script version。
- [ ] 確認 Web App URL 保持不變。
- [ ] 對 backend 執行最小 rollback smoke：`tenant_home`、`landlord_home`、付款 query、LINE callback。
- [ ] 若 frontend regression，revert 對應 GitHub Pages commit 並重新發布 previous known-good commit。
- [ ] 若 `tenant-bills.html` mobile 驗收失敗，回復保存的 candidate bottom-sheet artifact。
- [ ] 若 `tenant-home.html` 導向 regression，回復保存版本並重新驗證 binding flow。
- [ ] 若 payment smoke 寫入資料，依 audit 逐筆回復 bill/payment/report；不整張表覆蓋。
- [ ] 若 trigger 重複，先停用新 trigger，再恢復 pre-deploy trigger inventory。
- [ ] 若 Properties/config regression，回復上一組有效設定；已暴露 credentials 不得回用，只能輪替新值。
- [ ] Rollback 後重新核對 route、Workspace isolation、LINE logs 與 payment state。
- [ ] 保存 failed version 與 evidence，不覆蓋或刪除事故資料。
- [ ] 建立 incident/decision record，人工批准後才能再次部署。

### 7.8 Deployment completion

- [ ] Backend smoke test 全部通過。
- [ ] Frontend smoke/mobile test 全部通過。
- [ ] Workspace isolation 無 regression。
- [ ] LINE flow 無大量／非預期發送。
- [ ] Payment flow 與資料一致。
- [ ] Trigger 只有預期數量。
- [ ] Logs、quota、errors 監看完成。
- [ ] Deployment/version/commit/evidence 已寫入 runbook。
- [ ] Rollback point 保留至觀察期結束。
- [ ] 經人工確認後才標記 V2 internal-beta baseline。

## 本文件建立聲明

本輪只建立：

```text
docs/24-CANONICAL-MERGE-EXECUTION-CHECKLIST.md
```

本輪沒有修改任何 Apps Script、HTML、manifest、測試、既有文件、Google Sheets、Script Properties、trigger 或 deployment；沒有執行 clasp push/deploy；沒有建立 branch、commit 或 push。
