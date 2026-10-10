# Phase 69B — Sheet Read Consolidation Audit

日期：2026-07-21

範圍：repository canonical backend `apps-script/*.js`

狀態：**ANALYSIS ONLY — NO CODE CHANGE / NO PUSH / NO DEPLOY**

## 1. 方法與計數

以實際程式內容搜尋：

- `getDataRange()`
- `getValues()`
- `SpreadsheetApp.openById()`
- `SpreadsheetApp.getActive()` 與 `SpreadsheetApp.getActiveSpreadsheet()`

結果：

| Primitive | Occurrences | 說明 |
|---|---:|---|
| `getDataRange()` | 31 | 全部屬於 full used-range 存取；其中部分再依條件呼叫 `getDisplayValues()` |
| `getValues()` | 87 | 31 個伴隨 full-range path，其餘 56 個為 header、單列或明確 range |
| `SpreadsheetApp.openById()` | 1 | 只取得 Spreadsheet handle，本身不讀 Sheet cell |
| `SpreadsheetApp.getActiveSpreadsheet()` | 147 | 只取得 Spreadsheet handle，本身不讀 Sheet cell；包含跨行 chain 寫法 |
| `SpreadsheetApp.getActive()` | 0 | 無呼叫 |

同一個 `sheet.getDataRange().getValues()` 被視為一個 full-sheet read operation，
不重複計為兩次 I/O。Line number 以本次 audit 時 repository 內容為準。

## 2. 分類規則

- **A — 必須獨立讀取**：診斷、migration、repair、跨來源對帳或寫入後驗證，
  需要當下資料狀態；若共用 snapshot，必須有明確 invalidation，否則不建議合併。
- **B — 可由 runtime context reuse**：tenant/workspace/contract/property/room 等
  runtime identity 資料，應由既有 canonical context 傳遞，避免 handler 再解析。
- **C — 可由 request-level snapshot 共用**：同一 request/transaction 中多個 helper
  讀取相同 Sheet，可由 request-local map 共用；不得跨 request 快取。

部分呼叫標記 `B/C`，表示 identity 應優先由 runtime context 提供，其餘相同 Sheet
讀取再由 request-local snapshot 合併。

## 3. Full-sheet read inventory

| # | File:line | Function | 讀取 Sheet | 使用目的 | 類別／可共用性 |
|---:|---|---|---|---|---|
| 1 | `TESTS.js:42` | `testInspectRoom603Bill()` / nested `getObjects()` | `V2_bills`, `V2_payments`, `V2_payment_reports` | 603 帳單測試資料盤點 | A；診斷每次需新鮮資料 |
| 2 | `TESTS.js:305` | `diagnoseTestTenantRuntimeData()` / nested `readSheet_()` | tenants、contracts、home/bill Views、bills、landlord-tenant View、rooms、properties | 測試房客跨表診斷 | A；可在函式內一次 snapshot，但不可與 runtime request 共用 |
| 3 | `TESTS.js:1274` | `diagnoseTenantDataConsistency()` / nested `readSheet_()` | `V2_users`, tenants, contracts, bills 與三張 tenant Views | tenant production consistency 診斷 | A |
| 4 | `TESTS.js:2032` | `verifyTenantDeploymentReadOnly()` / nested `readLandlordLinks_()` | `V2_landlord_tenant_list_view` | 部署後 landlord link 唯讀驗證 | A；contracts/properties 另經 `getSheetObjects_()` 讀取 |
| 5 | `V2_API.js:4446` | `getSheetObjects_(sheetName)` | caller-supplied；目前包含 tenant/landlord Views、bills、payment reports、reminder/log tables | 通用 row-object reader | B/C；同一 request 多次呼叫相同名稱時應共用 snapshot |
| 6 | `V2_API.js:4645` | `syncV1PaidBillsToV2()` | legacy bill history | V1 paid bills migration source | A；migration 對帳 |
| 7 | `V2_API.js:4648` | `syncV1PaidBillsToV2()` | `V2_bills` | V2 migration target 對帳 | A；與寫入順序相依 |
| 8 | `V2_AUTO_PAYMENT_REMINDER.js:3396` | `autoReminderGetObjects_(sheet)` | landlords、workspaces、workspace settings、bills、tenant/landlord Views、reminder logs | 建立一次催繳執行 context | C；目前主要入口已一次讀取後傳入 context，模式正確 |
| 9 | `V2_CONTRACT_REQUESTS.js:4461` | `contractRequestGetObjects_(sheet)` | identity Views、contracts、requests、rooms、landlords、properties、bills、legacy bill tables | 合約頁與合約申請流程 | B/C；`tenant_contract_init` 是高優先整併候選 |
| 10 | `V2_LANDLORD_MANAGEMENT.js:978` | `lmSheetObjects_(sheet)` | `V2_payment_reports` 或 `V2_tenant_messages` | 房東列表查詢 | C |
| 11 | `V2_LANDLORD_MANAGEMENT.js:1007` | `lmFindOwnedRow_(sheet, …)` | `V2_payment_reports` 或 `V2_tenant_messages` | 找出房東擁有的單筆資料 | C；同 request 已讀列表時不應再次 full-read |
| 12 | `V2_LANDLORD_ONBOARDING.js:2359` | `onboardingGetObjects_(sheet)` | users、landlords、workspaces、memberships、properties 等 onboarding tables | 房東 onboarding 身份與初始化 | C；寫入後需 invalidation |
| 13 | `V2_LEGACY_BILL_IMPORT.js:1563` | `legacyBillImportGetObjects_(sheet, useDisplayValues)` | legacy bill source 與 V2 target tables | legacy 帳單匯入／對帳 | A；可選 `getDisplayValues()`，屬 migration-only |
| 14 | `V2_MANUAL_SETTLEMENT.js:1626` | `manualSettlementFindRowByHeader_(sheet, …)` | caller-supplied settlement/payment/report Sheet | 依欄位尋找待銷帳 row | C；寫入前可與 transaction snapshot 共用 |
| 15 | `V2_MANUAL_SETTLEMENT.js:1868` | `manualSettlementSyncLegacyMonthly_(sheet, …)` | legacy monthly bill Sheet | paid status 回寫相容資料 | A；讀後寫入 |
| 16 | `V2_MANUAL_SETTLEMENT.js:2091` | `manualSettlementSyncLegacyHistory_(sheet, …)` | legacy bill history Sheet | paid history 相容同步 | A；讀後寫入 |
| 17 | `V2_MANUAL_SETTLEMENT.js:2783` | `manualSettlementGetObjects_(sheet)` | tenant/landlord Views、tenants、bills、payments、reports 等 | 銷帳身份與資料查找 | B/C；單一 settlement request 可共用，寫入後需 invalidation |
| 18 | `V2_PAID_BILL_MANAGEMENT.js:1159` | `paidBillManagementGetObjects_(sheet)` | bills、payments、payment reports 等 | 已繳帳單管理查詢 | C |
| 19 | `V2_PAYMENT_REVERSAL.js:1515` | `paymentReversalFindActivePayments_(paymentSheet, …)` | payments | 尋找可撤銷付款 | C |
| 20 | `V2_PAYMENT_REVERSAL.js:1625` | `paymentReversalVoidReports_(reportSheet, …)` | payment reports | 找出並作廢相關回報 | A/C；讀後寫入，snapshot 必須 invalidation |
| 21 | `V2_PAYMENT_REVERSAL.js:1858` | `paymentReversalSyncLegacyMonthly_(sheet, …)` | legacy monthly bill Sheet | reversal legacy 同步 | A |
| 22 | `V2_PAYMENT_REVERSAL.js:2059` | `paymentReversalSyncLegacyHistory_(sheet, …)` | legacy bill history Sheet | reversal legacy history 同步 | A |
| 23 | `V2_PAYMENT_REVERSAL.js:2730` | `paymentReversalFindRowByHeader_(sheet, …)` | caller-supplied bill/payment/report/reversal Sheet | 依欄位定位 row | C；同 transaction 可共用 |
| 24 | `V2_PAYMENT_REVERSAL.js:2896` | `paymentReversalGetObjects_(sheet)` | bills、payments、reports、reversals、tenant/landlord Views | reversal 身份與資料查找 | B/C；寫入後需 invalidation |
| 25 | `V2_PAYMENT_SETTLEMENT.js:999` | `findSettlementRowByHeader_(sheet, …)` | payment report / bill Sheet | 銷帳 row 定位 | C |
| 26 | `V2_PAYMENT_SETTLEMENT.js:1094` | `findExistingSettlementPayment_(paymentSheet, …)` | payments | 防止重複入帳 | A/C；必須反映 transaction 當下狀態 |
| 27 | `V2_SETTINGS_INTEGRATION.js:771` | `settingsIntegrationGetObjects_(sheet)` | workspace settings；fallback 可走 workspace generic reader | 解析 Workspace 設定 | C；同 request 只需讀一次 settings |
| 28 | `V2_TENANT_BINDING_PHONE.js:1405` | `tenantBindingGetObjectsWithRow_(sheet)` | users、tenants、contracts、binding tokens/logs、workspace tables | 綁定身份、手機與關聯查找 | B/C；綁定 write path 必須 invalidation |
| 29 | `V2_TENANT_RUNTIME_RESOLVER.js:107` | `tenantRuntimeReadSheet_(ss, sheetName)` | tenants、contracts、home/bill Views、bills、rooms、properties、landlord-tenant View | canonical tenant runtime snapshot | B；Home profile 7 張、預設 profile 8 張，已在 request 內共用 |
| 30 | `V2_WORKSPACES.js:1673` | `workspaceGetObjectsWithRow_(sheet)` | users、workspaces、memberships、invitations、landlords、properties、rooms、settings、Views、notifications 等 | Workspace identity、權限與多模組通用讀取 | B/C；目前最大共用候選，同 request 常重讀相同 Sheet |
| 31 | `V2_WORKSPACE_NOTIFICATIONS.js:2304` | `workspaceNotificationObjects_(sheet)` | notification center、preferences、logs 等 | 通知事件與偏好查詢 | C；fallback 已可使用 workspace generic reader |

## 4. Bounded `getValues()` inventory

以下 56 個呼叫不是 `getDataRange()` full-sheet read。大多數只讀 header row，
少數讀單一資料 row 或一個明確 column range。`Sheet` 欄的「caller Sheet」表示
helper 接收 Sheet 參數，實際表名由上層 module workflow 決定。

| File | Function and line(s) | 讀取 Sheet／目的 | 類別 |
|---|---|---|---|
| `V2_ANNOUNCEMENT_MANAGEMENT.js` | `announcementAppendLineLogs_@3809`; `announcementEnsureHeaders_@3944`; `announcementSetRowValues_@4004,@4017`; `announcementAppendObject_@4071` | announcement/log caller Sheets；header 或單列 merge | C；request-local header map 可共用 |
| `V2_API.js` | `cmwebsLogLineMessage_@4270`; `ensureLineMessageLogSheet_@4339` | `V2_line_message_logs` headers | C |
| `V2_BILLING_MANAGEMENT.js` | `billingEnsureSheet_@3377` | caller billing Sheet headers | C |
| `V2_BILL_NOTIFICATIONS.js` | `billNotificationAppendLogs_@1913`; `billNotificationEnsureHeaders_@2283`; `billNotificationSetRowValues_@2343,@2356` | notification/log Sheet headers 與單列 | C |
| `V2_CONTRACT_REQUESTS.js` | `contractRequestUpdateObjectRow_@4568` | caller contract/request Sheet 單列 | A；更新前 row snapshot |
| `V2_LANDLORD_MANAGEMENT.js` | `lmEnsureHeaders_@951`; `lmUpdateRow_@1063` | payment report / message headers | C |
| `V2_LANDLORD_ONBOARDING.js` | `onboardingEnsureHeaders_@2291`; `onboardingHeaderMap_@2433`; `onboardingAppend_@2519` | onboarding caller Sheet headers | C |
| `V2_LEGACY_BILL_IMPORT.js` | `legacyBillImportUpdateTargetRow_@1514` | target row before migration update | A |
| `V2_MANUAL_SETTLEMENT.js` | `manualSettlementEnsureHeaders_@1214`; `manualSettlementAppendObjectRow_@1711`; `manualSettlementUpdateRowByObject_@1752` | settlement caller Sheet headers | C；寫入後 invalidation |
| `V2_PAYMENT_REVERSAL.js` | `paymentReversalEnsureHeaders_@1168`; `paymentReversalUpdateRowByObject_@2815`; `paymentReversalAppendObjectRow_@2859` | reversal caller Sheet headers | C；寫入後 invalidation |
| `V2_PAYMENT_SETTLEMENT.js` | `ensureSettlementHeaders_@926`; `appendSettlementObjectRow_@1183`; `updateSettlementRowByObject_@1222` | settlement caller Sheet headers | C；寫入後 invalidation |
| `V2_PROPERTY_ROOM_MANAGEMENT.js` | `propertyRoomEnsureSheet_@3242` | property/room caller Sheet headers | C |
| `V2_SYSTEM_SETTINGS.js` | `systemSettingsSetRowValues_@2339,@2352`; `systemSettingsAppendObject_@2451`; `systemSettingsEnsureHeaders_@2667`; `systemSettingsRepairPhoneLeadingZeros_@2876,@2908` | settings headers、單列或指定電話欄 range | A/C；repair range 必須獨立，其餘 header map 可共用 |
| `V2_TEAM_MANAGEMENT.js` | `teamEnsurePhoneTextColumn_@1488` | team/users Sheet headers | C |
| `V2_TENANT_BINDING_PHONE.js` | `tenantBindingWriteLog_@1276`; `tenantBindingHeaderMap_@1432`; `testTenantBindingSchema@2535` | binding log/schema headers | A/C；test 為 A，runtime header map 為 C |
| `V2_TENANT_CHECKIN_MANAGEMENT.js` | `tenantCheckinEnsureHeaders_@3322`; `tenantCheckinSetRowValues_@3382,@3395`; `tenantCheckinAppendObject_@3449` | check-in caller Sheet headers/row | C |
| `V2_TENANT_LEASE_ONBOARDING.js` | `tenantLeaseEnsureSheet_@2472` | lease onboarding Sheet headers | C |
| `V2_TENANT_MESSAGES.js` | `appendTenantMessage_@942`; `ensureTenantMessageSheet_@1036` | `V2_tenant_messages` headers | C |
| `V2_TENANT_PAYMENT_REPORTS.js` | `tenantPaymentReportAppend_@958`; `tenantPaymentReportEnsureSheet_@1061` | `V2_payment_reports` headers | C |
| `V2_WORKSPACES.js` | `workspaceEnsureSheet_@1528`; `workspaceAppendObject_@1695`; `workspaceHeaderMap_@1711`; `testEnsureV2WorkspaceSchema@1976` | workspace module headers | A/C；schema test 為 A，其餘可共用 header map |
| `V2_WORKSPACE_NOTIFICATIONS.js` | `workspaceNotificationEnsureHeaders_@2243`; `workspaceNotificationAppend_@2381`; `workspaceNotificationUpdateRow_@2446,@2459` | notification caller Sheet headers/row | C |

## 5. Spreadsheet handle inventory

`getActiveSpreadsheet()` 與 `openById()` 本身不讀 cell，但重複取得 handle 通常
代表下游 helper 沒有共享 request context。以下列出全部位置。

| File | `getActiveSpreadsheet()` functions@line | 下游 Sheet／用途 | 分類 |
|---|---|---|---|
| `TESTS.js` | `testInspectRoom603Bill@6`; `diagnoseTestTenantRuntimeData@247`; `planTestTenantRuntimeDataRepair@950`; `diagnoseTenantDataConsistency@1201`; `verifyTenantDeploymentReadOnly@2017` | bills 與 tenant runtime 診斷 | A |
| `V2_ANNOUNCEMENT_MANAGEMENT.js` | `getLandlordAnnouncementsInitByLineUid_@115`; `sendLandlordAnnouncementByLineUid_@494`; `retryLandlordAnnouncementByLineUid_@1351`; `announcementEnsureSchema_@3684`; `testDiagnoseAnnouncementSpreadsheetCapacity@4679`; `testCompactAnnouncementSpreadsheetCapacity@4698`; `testEnsureAnnouncementSchema@4718` | announcement runtime、schema、capacity diagnostics | B/C；schema/test A |
| `V2_API.js` | `testGetTenantHomeByLineUid@280`; `testGetLandlordHomeByLineUid@1612`; `testGetLandlordTenantsByLineUid@2715`; `hasPendingPaymentReportForTenant_@3437`; `hasPaymentReminderSentToday_@3521`; `getLandlordLineLogsByLineUid@3897`; `isLineMessageAlreadyLogged_@4244`; `ensureLineMessageLogSheet_@4308`; `getSheetObjects_@4439`; `logLiffAccess_@4477`; `syncV1PaidBillsToV2@4596`; `appendV1V2SyncLog_@5197` | API Views、payment/reminder/log tables 與 migration | runtime B/C；test/migration A |
| `V2_AUTO_PAYMENT_REMINDER.js` | `autoReminderGetSpreadsheet_@3331`; `saveV2AutomaticPaymentReminderSpreadsheetId@3348` | trigger runtime spreadsheet binding | A；入口 handle |
| `V2_BILLING_MANAGEMENT.js` | `getLandlordBillingInitByLineUid_@86`; `generateLandlordBillsByLineUid_@726`; `billingEnsureSchema_@3243`; `billingRequireSchema_@3284`; `testEnsureBillingSchema@4139`; `diagnoseBillingPreviousMetersByLineUid_@4199`; `repairBillingPreviousMetersByLineUid_@4376` | billing read/write、schema 與 admin diagnostics | B/C；schema/repair A |
| `V2_BILL_NOTIFICATIONS.js` | `getLandlordBillNotificationsInitByLineUid_@92`; `sendLandlordBillNotificationsByLineUid_@518`; `billNotificationEnsureSchema_@2103`; `billNotificationRequireSchema_@2157`; `testEnsureBillNotificationSchema@2724` | bill notification runtime 與 schema | C；schema/test A |
| `V2_CONTRACT_REQUESTS.js` | `ensureV2ContractRequestsSheet_@114`; `getTenantContractInitByLineUid_@189`; `submitTenantContractRequestByLineUid_@368`; `getTenantContractRequestsByLineUid_@710`; `getLandlordContractRequestsInitByLineUid_@956`; `updateLandlordContractRequestByLineUid_@1136` | contract identity、requests、property/room/bill data | B/C；每個入口應只建立一個 request context |
| `V2_LANDLORD_MANAGEMENT.js` | `lmResolveLandlord_@827`; `lmEnsurePaymentReportSheet_@865`; `lmEnsureTenantMessageSheet_@910` | landlord identity、payment reports、tenant messages | B/C |
| `V2_LANDLORD_ONBOARDING.js` | `saveLandlordOnboardingStepByLineUid_@279`; `completeLandlordOnboardingByLineUid_@520`; `onboardingBuildData_@1538`; `onboardingEnsureSchema_@1857`; `testEnsureV2LandlordOnboardingSchema@2723` | onboarding runtime、projection 與 schema | B/C；schema/test A |
| `V2_LEGACY_BILL_IMPORT.js` | `importV1HistoricalBillsToV2ByMonth_@196` | legacy import source/target binding | A |
| `V2_MANUAL_SETTLEMENT.js` | `manualSettleLandlordBillByLineUid_@243,@897`; `testEnsureManualSettlementSheets@3373`; `repairV2PaidBillsToV1@3439`; `testRepairSinglePaidBillToV1@3693` | settlement transaction、schema/test/repair | B/C；admin operations A |
| `V2_PAID_BILL_MANAGEMENT.js` | `getLandlordPaidBillsInitByLineUid_@80` | paid bill runtime | B/C |
| `V2_PAYMENT_REVERSAL.js` | `reopenLandlordBillByLineUid_@152,@775`; `testEnsurePaymentReversalSheets@3331` | reversal transaction 與 schema test | C；test A |
| `V2_PAYMENT_SETTLEMENT.js` | `settleLandlordPaymentReportByLineUid_@83`; `testEnsureSettlementSheets@1414` | settlement transaction 與 schema test | C；test A |
| `V2_PROPERTY_ROOM_MANAGEMENT.js` | `getLandlordPropertiesInitByLineUid_@75`; `saveLandlordPropertyByLineUid_@652`; `saveLandlordRoomByLineUid_@1099`; `archiveLandlordRoomByLineUid_@1844`; `propertyRoomEnsureSchema_@3076`; `propertyRoomRequireReadSchema_@3283`; `repairWorkspacePropertyRoomLinksByLineUid_@4305`; `repairWorkspaceRoomFinancialDataByLineUid_@4548`; `diagnoseWorkspaceRoomPaymentDepositByLineUid_@4946`; `testEnsurePropertyRoomSchema@5199` | Workspace/property/room runtime、schema、diagnostics/repair | B/C；admin paths A |
| `V2_SETTINGS_INTEGRATION.js` | `settingsIntegrationGetWorkspaceSettings_@86`; `testWorkspaceSettingsIntegration@1033` | Workspace settings runtime/test | C；test A |
| `V2_SYSTEM_SETTINGS.js` | `getLandlordSettingsInitByLineUid_@145`; `saveLandlordSettingsProfileByLineUid_@536`; `saveLandlordSettingsWorkspaceByLineUid_@800`; `saveLandlordSettingsPaymentByLineUid_@1078`; `saveLandlordSettingsPreferencesByLineUid_@1402`; `systemSettingsEnsureSchema_@2486`; `systemSettingsRepairPhoneLeadingZeros_@2815`; `testEnsureSystemSettingsSchema@3485` | settings runtime/write/schema/repair | B/C；schema/repair/test A |
| `V2_TEAM_MANAGEMENT.js` | `createLandlordTeamInvitationByLineUid_@130`; `cancelLandlordTeamInvitationByLineUid_@347`; `updateLandlordTeamMemberByLineUid_@464`; `removeLandlordTeamMemberByLineUid_@575`; `getLandlordInvitationInit_@668`; `acceptLandlordInvitationByLineUid_@812`; `teamAccess_@1168`; `teamBuildData_@1218`; `teamEnsureSchema_@1444`; `repairTeamInvitationPhones_@1591`; `testEnsureV2TeamSchema@1715` | users/workspaces/memberships/invitations | B/C；repair/schema/test A |
| `V2_TENANT_BINDING_PHONE.js` | `getTenantBindingStatusByLineUid_@45`; `bindTenantByLineUid_@209`; `tenantBindingEnsureLogSheet_@1312`; `diagnoseAllTenantLineBindings_@1621`; `repairAllTenantLineBindings_@1777`; `testTenantBindingSchema@2512` | tenant binding identity/log/schema/diagnostics | B/C；diagnose/repair/test A |
| `V2_TENANT_CHECKIN_MANAGEMENT.js` | `getLandlordTenantCheckinsInitByLineUid_@85`; `saveLandlordTenantCheckinByLineUid_@714`; `sendLandlordTenantCheckinWelcomeByLineUid_@1234`; `tenantCheckinEnsureSchema_@3150`; `testEnsureTenantCheckinSchema@3840` | check-in runtime/write/notification/schema | B/C；schema/test A |
| `V2_TENANT_LEASE_ONBOARDING.js` | `getLandlordTenantCreateInitByLineUid_@92`; `createLandlordTenantLeaseByLineUid_@777`; `tenantLeaseEnsureSchema_@2213`; `tenantLeaseRequireReadSchema_@2513`; `testEnsureTenantLeaseSchema@2940` | lease onboarding runtime/write/schema | B/C；schema/test A |
| `V2_TENANT_MESSAGES.js` | `getTenantMessages_@807`; `ensureTenantMessageSheet_@968` | tenant messages read/schema | B/C |
| `V2_TENANT_PAYMENT_REPORTS.js` | `tenantPaymentReportGetReports_@763`; `tenantPaymentReportFindBlocking_@899`; `tenantPaymentReportEnsureSheet_@981` | tenant payment reports | B/C |
| `V2_TENANT_RUNTIME_DATA_REPAIR.js` | `diagnoseTestTenantRuntimeDataDetailed@140`; `previewRepairTestTenantRuntimeData@598`; `repairTestTenantRuntimeData@778`; `repairTestTenantRuntimeViews@1903`; `verifyTestTenantRuntimeViews@1996` | diagnostic/repair snapshots | A；admin-only，不能與 production runtime context 混用 |
| `V2_TENANT_RUNTIME_RESOLVER.js` | `resolveCanonicalTenantRuntimeByLineUid_@1253` | canonical tenant snapshot | B |
| `V2_WORKSPACES.js` | `getLandlordEntryStatusByLineUid_@88`; `registerLandlordWorkspaceByLineUid_@303`; `getLandlordWorkspaceContextByLineUid_@576`; `setLandlordActiveWorkspaceByLineUid_@655`; `migrateExistingLandlordsToWorkspaces_@777`; `workspaceEnsureSchema_@1375`; `workspaceWriteActivityLog_@1783`; `testEnsureV2WorkspaceSchema@1954` | Workspace identity/schema/logging | B/C；migration/schema/test A |
| `V2_WORKSPACE_CREATION.js` | `createAdditionalLandlordWorkspaceByLineUid_@110` | new Workspace transaction | C；write invalidation |
| `V2_WORKSPACE_DASHBOARD_NATIVE.js` | `workspaceDashboardExecute_@535` | native dashboard projection | B/C；高價值 request snapshot 候選 |
| `V2_WORKSPACE_LANDLORD_ACCESS.js` | `workspaceLandlordResolveAccess_@753`; `migrateV2OperationalDataToWorkspaceIds@1597` | landlord Workspace access / migration | B；migration A |
| `V2_WORKSPACE_NOTIFICATIONS.js` | `workspaceNotifyTeam_@102`; `getLandlordNotificationsInitByLineUid_@522`; `workspaceNotificationMarkRead_@850`; `workspaceNotificationDeliver_@1359,@1381,@1453`; `workspaceNotificationEnsureSchema_@2063`; `testEnsureWorkspaceNotificationSchema@2919`; `testWorkspaceNotificationRecipients@2964` | notification runtime/delivery/schema/tests | B/C；schema/test A |
| `V2_WORKSPACE_OPERATION_AUDIT.js` | `getLandlordWorkspaceActivityByLineUid_@108`; `workspaceRecordOperationActor_@289`; `workspaceStampOperationActorToTarget_@487`; `workspaceEnsureOperationAuditSchema_@766` | operation audit read/write/schema | B/C；schema A |

唯一 `openById()`：

| File:line | Function | 讀取 Sheet | 使用目的 | 分類 |
|---|---|---|---|---|
| `V2_AUTO_PAYMENT_REMINDER.js:3328` | `autoReminderGetSpreadsheet_()` | 無；只取得 `CMWEBS_SPREADSHEET_ID` 對應 handle | time trigger 無 active spreadsheet 時取得正式 spreadsheet | A；必要的環境 binding，不是 full-read |

## 6. Consolidation findings

### A. 必須獨立讀取

以下不應直接併入 production runtime snapshot：

- `TESTS.js` 的四個診斷 full reads。
- legacy import、V1/V2 sync、manual settlement legacy sync、payment reversal
  legacy sync。
- repair/migration/schema validation 與寫入後驗證。
- `findExistingSettlementPayment_()` 等防重檢查；若共用，必須在每次 write 後
  失效並重新驗證。

### B. 可由 runtime context reuse

優先對象：

1. `tenantRuntimeReadSheet_()` 已建立 canonical tenant → contract → workspace →
   property → room context；Tenant Home 不應再用 `getSheetObjects_()` 解析相同身份。
2. `getTenantContractInitByLineUid_()` 目前使用自己的 contract request readers，與
   tenant runtime resolver 重讀 tenants/contracts/rooms/properties/bills。可在未來
   讓單一 handler 接受 canonical identity context，但跨兩個 HTTP request 不能直接
   共用記憶體。
3. tenant binding、tenant messages 與 tenant payment reports 的 identity lookup
   應使用同一 canonical identity chain；寫入流程仍需自己的 fresh validation。
4. Workspace/team/property-room 初始化流程應傳遞已解析的 workspace access context，
   不要每個 nested helper 再讀 users/members/workspaces。

### C. 可由 request-level snapshot 共用

最明確候選：

1. `workspaceGetObjectsWithRow_()`：跨十多個 module 使用，同一 request 中多次讀
   users、memberships、workspaces、properties、rooms 或 Views。應由 request-local
   `sheetName -> rows` map 共用，任何 write 後 invalidation。
2. `getSheetObjects_()`：`V2_API.js`、tenant messages、payment reports 與 TESTS
   會重複取得 active spreadsheet 並 full-read。可接受 optional request snapshot。
3. `contractRequestGetObjects_()`：`tenant_contract_init` 一次流程讀取多個 Sheet，
   identity 相關部分可沿用 canonical context；requests/legacy data 可共用 local map。
4. manual settlement、payment settlement、payment reversal 的 generic readers：同一
   transaction 常先 find、再 get objects、再 sync。可共用 pre-write snapshot，但每次
   `setValue/setValues/appendRow` 後必須清除受影響 Sheet cache。
5. header-only `getValues()`：同一 request 反覆建立 header map 的 module，可傳遞
   header map；這不會減少 full-sheet read count，但能降低 RPC 次數。

## 7. Runtime hot spots and priority

| Priority | Hot spot | 理由 | 建議邊界 |
|---:|---|---|---|
| P0 | `workspaceGetObjectsWithRow_()` request duplication | 呼叫面最廣；同一 workspace request 常重讀 users/members/workspaces | request-local only；write invalidation；保留 role/workspace checks |
| P0 | `tenant_contract_init` identity reads | Home 頁與 contract secondary API 重複 tenant/contract/property/room/bill I/O | 先在各自 request 內共用；不可在無 CacheService 下宣稱跨 HTTP reuse |
| P1 | `getSheetObjects_()` | 多個 tenant/landlord handler 共用的 full-reader，沒有 context 參數 | optional snapshot parameter；預設行為不變 |
| P1 | payment settlement/reversal | 一次交易多次 full scan，資料量會成長 | transaction snapshot + strict invalidation + lock 保持 |
| P1 | header maps | 56 個 bounded calls 中多數為 header read | request-local header map；schema mutation 後 invalidation |
| P2 | admin diagnostics/migrations | 不在一般 request hot path | 保持獨立，正確性優先 |

## 8. 安全邊界

- 不建議把 snapshot 設成 global variable；Apps Script execution reuse 不保證單一
  使用者或單一 request，且可能造成 Workspace 資料交叉。
- 不可用 first-row-wins 取代 duplicate/conflict validation。
- request snapshot key 必須至少包含 spreadsheet identity 與 Sheet name；取出的 rows
  仍需依 workspace、role、tenant/landlord identity 過濾。
- 所有 write path 必須在寫入後 invalidate，或禁止讀取舊 snapshot。
- 本 audit 沒有建議 CacheService，也沒有改變 API response 或 Sheet schema。

## 9. 結論

主要 full-read consolidation 機會不是單一 `getDataRange()` helper 本身，而是同一
request 的 nested helpers 重複呼叫 generic readers：

1. `workspaceGetObjectsWithRow_()` 是最大共用面。
2. `getSheetObjects_()` 與 `contractRequestGetObjects_()` 是 tenant frontend runtime
   的下一批候選。
3. Canonical tenant resolver 已在單一 request 內共用 identity snapshot；Phase 69
   Home profile 將其 full reads 從 8 降至 7。
4. Admin repair/migration 與會寫資料的付款交易不能直接套用無 invalidation 的
   snapshot。

本 Phase 只新增本分析文件；沒有修改 Apps Script、HTML、API、route、manifest、
Sheet、deployment 或 frontend endpoint，也沒有執行 commit、push、`clasp push`
或 deploy。
