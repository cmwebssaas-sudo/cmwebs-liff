# CMWebs V2 Test LINE UID Script Properties Migration

> Phase：Canonical Consolidation Phase 1.7
> 執行時間：2026-07-19 04:40:50 CST（Asia/Taipei）
> 範圍：repository canonical backend 的 `test*` 函式與 pre-commit validator
> 本文件不記錄任何完整 UID、遮罩片段、長度或 fingerprint。

## 1. Outcome

Phase 1.6 validator 只辨識變數宣告型態，因此原先回報 4 個 review-only UID。Phase 1.7 以完整 Apps Script literal scan 重新盤點後確認：

| Metric | Result |
|---|---:|
| Hardcoded test UID occurrences before migration | 40 |
| Distinct test identities | 2 |
| Test-bearing Apps Script files | 22 |
| Formal route／handler UID literals | 0 |
| Hardcoded LINE UID after migration | 0 |
| Property keys used | 2 |

40 個 occurrence 全部位於 `test*` 函式。35 個房東測試 occurrence 共用 `TEST_LANDLORD_LINE_UID`，5 個房客測試 occurrence 共用 `TEST_TENANT_LINE_UID`；沒有為同一身份建立重複 key，也不需要 `_2` key。

## 2. Property design

| Script Property key | Role | Occurrences | Runtime behavior |
|---|---|---:|---|
| `TEST_LANDLORD_LINE_UID` | 核准的單一房東測試身份 | 35 | 只在人工呼叫相關 `test*` 函式時讀取 |
| `TEST_TENANT_LINE_UID` | 核准的單一房客測試身份 | 5 | 只在人工呼叫相關 `test*` 函式時讀取 |

兩個 key 都使用既有 `getRequiredScriptProperty_`：Property 缺少或空白時明確失敗，不 fallback 到舊 UID，錯誤只含 key 名稱。沒有新增 `getOptionalScriptProperty_`，也沒有修改 `程式碼.js`。

## 3. Inventory and migration map

行號是遷移後 `getRequiredScriptProperty_` call 所在行。用途均為測試／診斷／repair，不是正式 route 設定。

| File | Line／test function | Purpose | Property key | Mode |
|---|---|---|---|---|
| `V2_ANNOUNCEMENT_MANAGEMENT.js` | 4753 `testLandlordAnnouncementsInit` | 公告 init 查詢 | `TEST_LANDLORD_LINE_UID` | required |
|  | 4772 `testAnnouncementMessagePreview` | 公告訊息預覽 | `TEST_LANDLORD_LINE_UID` | required |
| `V2_API.js` | 1286 `testLandlordArrearsIncludes603` | 房東欠款查詢診斷 | `TEST_LANDLORD_LINE_UID` | required |
| `V2_BILLING_MANAGEMENT.js` | 4616 `testDiagnoseBillingPreviousMeters` | 上期電表診斷 | `TEST_LANDLORD_LINE_UID` | required |
|  | 4628 `testRepairBillingPreviousMeters` | 上期電表 repair | `TEST_LANDLORD_LINE_UID` | required |
|  | 4636 `testLandlordBillingInit` | 房東帳務 init | `TEST_LANDLORD_LINE_UID` | required |
| `V2_BILL_NOTIFICATIONS.js` | 2762 `testLandlordBillNotificationsInit` | 帳單通知 init | `TEST_LANDLORD_LINE_UID` | required |
|  | 2790 `testBillNotificationMessagePreview` | 帳單通知預覽 | `TEST_LANDLORD_LINE_UID` | required |
| `V2_CONTRACT_REQUESTS.js` | 2882 `testTenantContractSupplementFields` | 房客合約補充欄位查詢 | `TEST_TENANT_LINE_UID` | required |
|  | 5311 `testTenantContractInit` | 房客合約 init | `TEST_TENANT_LINE_UID` | required |
|  | 5329 `testLandlordContractRequestsInit` | 房東合約申請 init | `TEST_LANDLORD_LINE_UID` | required |
| `V2_LANDLORD_MANAGEMENT.js` | 1299 `testLandlordManagementBackend` | 房東付款回報／訊息 init | `TEST_LANDLORD_LINE_UID` | required |
| `V2_LANDLORD_ONBOARDING.js` | 2772 `testLandlordOnboardingInit` | 房東 onboarding init | `TEST_LANDLORD_LINE_UID` | required |
| `V2_PAID_BILL_MANAGEMENT.js` | 1379 `testLandlordPaidBillsInit` | 已繳帳單 init | `TEST_LANDLORD_LINE_UID` | required |
| `V2_PROPERTY_ROOM_MANAGEMENT.js` | 4453 `testRepairWorkspacePropertyRoomLinks` | 房源／房間關聯 repair | `TEST_LANDLORD_LINE_UID` | required |
|  | 5081 `testDiagnoseWorkspaceRoomPaymentDeposit` | 房間付款／押金診斷 | `TEST_LANDLORD_LINE_UID` | required |
|  | 5089 `testRepairWorkspaceRoomFinancialData` | 房間財務資料 repair | `TEST_LANDLORD_LINE_UID` | required |
|  | 5110 `testLandlordPropertiesInitTimed` | 房源 init 效能診斷 | `TEST_LANDLORD_LINE_UID` | required |
|  | 5172 `testLandlordPropertiesInit` | 房源 init | `TEST_LANDLORD_LINE_UID` | required |
| `V2_SYSTEM_SETTINGS.js` | 3520 `testLandlordSettingsInit` | 房東設定 init | `TEST_LANDLORD_LINE_UID` | required |
| `V2_TEAM_MANAGEMENT.js` | 1732 `testLandlordTeamInit` | 房東團隊 init | `TEST_LANDLORD_LINE_UID` | required |
| `V2_TENANT_BINDING_PHONE.js` | 2453 `testTenantBindingStatus` | 房客綁定狀態查詢 | `TEST_TENANT_LINE_UID` | required |
| `V2_TENANT_CHECKIN_MANAGEMENT.js` | 3873 `testLandlordTenantCheckinsInit` | 房客報到 init | `TEST_LANDLORD_LINE_UID` | required |
|  | 3893 `testTenantCheckinWelcomePreview` | 報到歡迎訊息預覽 | `TEST_LANDLORD_LINE_UID` | required |
| `V2_TENANT_LEASE_ONBOARDING.js` | 2905 `testLandlordTenantCreateInitTimed` | 租約建立 init 效能診斷 | `TEST_LANDLORD_LINE_UID` | required |
|  | 2933 `testLandlordTenantCreateInit` | 租約建立 init | `TEST_LANDLORD_LINE_UID` | required |
| `V2_TENANT_MESSAGES.js` | 1126 `testTenantMessageInit` | 房客訊息 init | `TEST_TENANT_LINE_UID` | required |
| `V2_TENANT_PAYMENT_REPORTS.js` | 1255 `testTenantPaymentReportInit` | 房客付款回報 init | `TEST_TENANT_LINE_UID` | required |
| `V2_WORKSPACES.js` | 2001 `testLandlordEntryStatus` | 房東入口狀態查詢 | `TEST_LANDLORD_LINE_UID` | required |
|  | 2011 `testLandlordWorkspaceContext` | Workspace context 查詢 | `TEST_LANDLORD_LINE_UID` | required |
| `V2_WORKSPACE_CREATION.js` | 584 `testCreateAdditionalWorkspace` | 建立額外 Workspace 測試 | `TEST_LANDLORD_LINE_UID` | required |
| `V2_WORKSPACE_DASHBOARD_NATIVE.js` | 2481 `testWorkspaceLandlordHomeNative` | Native home 查詢 | `TEST_LANDLORD_LINE_UID` | required |
|  | 2499 `testWorkspaceLandlordArrearsNative` | Native arrears 查詢 | `TEST_LANDLORD_LINE_UID` | required |
|  | 2517 `testWorkspaceLandlordTenantsNative` | Native tenants 查詢 | `TEST_LANDLORD_LINE_UID` | required |
| `V2_WORKSPACE_LANDLORD_ACCESS.js` | 1815 `testWorkspaceLandlordAccessContext` | Workspace access context 診斷 | `TEST_LANDLORD_LINE_UID` | required |
|  | 1844 `testWorkspaceLandlordHomeProxy` | Workspace home proxy 查詢 | `TEST_LANDLORD_LINE_UID` | required |
|  | 1865 `testWorkspaceDashboardCompatibilityRoutes` | Dashboard compatibility 查詢 | `TEST_LANDLORD_LINE_UID` | required |
| `V2_WORKSPACE_NOTIFICATIONS.js` | 2956 `testWorkspaceNotificationRecipients` | 通知 schema／收件者診斷 | `TEST_LANDLORD_LINE_UID` | required |
|  | 3021 `testLandlordNotificationsInit` | 通知中心 init | `TEST_LANDLORD_LINE_UID` | required |
| `V2_WORKSPACE_OPERATION_AUDIT.js` | 1289 `testLandlordWorkspaceActivityInit` | Workspace activity init | `TEST_LANDLORD_LINE_UID` | required |

### Required versus optional decision

- Required：40/40。
- Optional：0/40。

部分函式會 repair、建立 Workspace 或確保 notification schema，必須 fail closed。其餘 read-only diagnose 也統一採 required，避免空 UID 被送入查詢鏈、產生誤導性結果或讓測試靜默跳過。這比 optional 更嚴格，且不影響任何正式 runtime flow。

## 4. Files changed in Phase 1.7

### Apps Script test-bearing files

```text
apps-script/V2_ANNOUNCEMENT_MANAGEMENT.js
apps-script/V2_API.js
apps-script/V2_BILLING_MANAGEMENT.js
apps-script/V2_BILL_NOTIFICATIONS.js
apps-script/V2_CONTRACT_REQUESTS.js
apps-script/V2_LANDLORD_MANAGEMENT.js
apps-script/V2_LANDLORD_ONBOARDING.js
apps-script/V2_PAID_BILL_MANAGEMENT.js
apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js
apps-script/V2_SYSTEM_SETTINGS.js
apps-script/V2_TEAM_MANAGEMENT.js
apps-script/V2_TENANT_BINDING_PHONE.js
apps-script/V2_TENANT_CHECKIN_MANAGEMENT.js
apps-script/V2_TENANT_LEASE_ONBOARDING.js
apps-script/V2_TENANT_MESSAGES.js
apps-script/V2_TENANT_PAYMENT_REPORTS.js
apps-script/V2_WORKSPACES.js
apps-script/V2_WORKSPACE_CREATION.js
apps-script/V2_WORKSPACE_DASHBOARD_NATIVE.js
apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js
apps-script/V2_WORKSPACE_NOTIFICATIONS.js
apps-script/V2_WORKSPACE_OPERATION_AUDIT.js
```

每個 Apps Script diff 只有完整 UID literal → required Property call 的 test-function substitution。

### Validator and documents

```text
scripts/validate-project.js
docs/33-PRECOMMIT-SECURITY-AUDIT.md
docs/34-TEST-UID-MIGRATION.md
```

`package.json`、`apps-script/程式碼.js`、`appsscript.json`、repository HTML、`_deployed/` 與 `_handoff/` 均未由 Phase 1.7 修改。

## 5. Manual Script Properties setup

1. 由測試 owner 確認正確的 Apps Script project 與核准的單一房東、房客測試身份。
2. 在 Apps Script **Project Settings → Script Properties** 建立 `TEST_LANDLORD_LINE_UID`。
3. 建立 `TEST_TENANT_LINE_UID`。
4. 值只能從核准的測試身份紀錄手動輸入；不要從 `_deployed`、`_handoff`、Git、文件、聊天或 log 複製。
5. 第二位 reviewer 只確認 key 存在、角色正確且非空，不記錄值或 fingerprint。
6. 先執行純 read-only init／diagnose 測試；repair、Workspace create 或任何可能寫入的測試需另行批准。
7. 不得使用 `test=1` 當 dry-run，不得使用這兩個 UID 大量發送 LINE。

這兩個 Properties 只供人工測試函式使用；缺少時正式 routes 不受影響，但相關測試會明確失敗。

## 6. Route and handler comparison

| Gate | Before Phase 1.7 | After Phase 1.7 | Delta |
|---|---:|---:|---:|
| Route declarations | 68 | 68 | 0 |
| Unique routes | 68 | 68 | 0 |
| Duplicate routes | 0 | 0 | 0 |
| First-level handler coverage | 68/68 | 68/68 | 0 |
| Common helper coverage | 7/7 | 7/7 | 0 |

沒有修改 route 名稱、dispatcher、handler function name、Sheet schema 或正式業務邏輯。

## 7. Validator result

```text
Apps Script files: 30
HTML files: 44
Routes: 68 (unique 68, duplicates 0)
Handler coverage: 68/68
Common helper coverage: 7/7
Duplicate top-level declarations: function=0, const=0, let=0, var=0
Credential scan: blocking=0, review-only=0
Hardcoded LINE UID: 0
Manifest: PASS
HTML links: checked=182, missing=0
Validation: PASS
```

validator 只把完整 `U` + 32 hexadecimal 字元視為 hardcoded LINE UID；Property key 不符合此格式，文件遮罩或含省略號範例也不會命中。任何命中只輸出檔名、行號與類型，不輸出 UID。

## 8. Rollback

本輪未部署，因此沒有 Production deployment rollback：

1. 若 review 發現 mapping 錯誤，停止 commit，依 Phase 1.7 前 hash inventory 回復本輪 test-only substitutions與 validator，再重新盤點。
2. 不得把 `_deployed` 中的硬編碼 UID 當成可提交 rollback；任何暫時回復都必須保持本地且不可 commit。
3. 首選修正 Property role mapping，而不是重新硬編碼 UID。
4. 未來 deployment 若只因測試 Property 缺失，正式 route 不需 rollback；建立正確 Property 後再執行人工測試。

## 9. Non-deployment statement

Phase 1.7 未修改 `_deployed/`、`_handoff/`、Google Sheets、Apps Script Properties、LIFF ID、Web App URL、正式 UID、route、handler、Sheet schema、Apps Script version 或 deployment。未執行 `clasp push`、`clasp deploy`、commit 或 push。
