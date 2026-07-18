# Apps Script 測試函式清單

    此清單由 `candidate-overlay/apps-script` 自動掃描產生。

    | 模組 | 測試函式 |
    |---|---|
    | `V2_WORKSPACES.gs` | `testEnsureV2WorkspaceSchema()` |
| `V2_WORKSPACES.gs` | `testMigrateExistingLandlordsToWorkspaces()` |
| `V2_WORKSPACES.gs` | `testLandlordEntryStatus()` |
| `V2_WORKSPACES.gs` | `testLandlordWorkspaceContext()` |
| `V2_WORKSPACE_CREATION.gs` | `testCreateAdditionalWorkspace()` |
| `V2_WORKSPACE_LANDLORD_ACCESS.gs` | `testWorkspaceLandlordAccessContext()` |
| `V2_WORKSPACE_LANDLORD_ACCESS.gs` | `testWorkspaceLandlordHomeProxy()` |
| `V2_WORKSPACE_LANDLORD_ACCESS.gs` | `testWorkspaceDashboardCompatibilityRoutes()` |
| `V2_WORKSPACE_DASHBOARD_NATIVE.gs` | `testWorkspaceLandlordHomeNative()` |
| `V2_WORKSPACE_DASHBOARD_NATIVE.gs` | `testWorkspaceLandlordArrearsNative()` |
| `V2_WORKSPACE_DASHBOARD_NATIVE.gs` | `testWorkspaceLandlordTenantsNative()` |
| `V2_WORKSPACE_OPERATION_AUDIT.gs` | `testEnsureWorkspaceOperationAuditSchema()` |
| `V2_WORKSPACE_OPERATION_AUDIT.gs` | `testLandlordWorkspaceActivityInit()` |
| `V2_TEAM_MANAGEMENT.gs` | `testRepairTeamInvitationPhones()` |
| `V2_TEAM_MANAGEMENT.gs` | `testEnsureV2TeamSchema()` |
| `V2_TEAM_MANAGEMENT.gs` | `testLandlordTeamInit()` |
| `V2_LANDLORD_ONBOARDING.gs` | `testEnsureV2LandlordOnboardingSchema()` |
| `V2_LANDLORD_ONBOARDING.gs` | `testLandlordOnboardingInit()` |
| `V2_LANDLORD_MANAGEMENT.gs` | `testEnsureLandlordManagementSheets()` |
| `V2_LANDLORD_MANAGEMENT.gs` | `testLandlordManagementBackend()` |
| `V2_TENANT_BINDING.gs` | `testEnsureV2TenantBindingLogsSheet()` |
| `V2_TENANT_BINDING.gs` | `testTenantBindingStatus()` |
| `V2_TENANT_BINDING.gs` | `testTenantBindingSchema()` |
| `V2_TENANT_BINDING_PHONE.gs` | `testDiagnoseAllTenantLineBindings()` |
| `V2_TENANT_BINDING_PHONE.gs` | `testRepairAllTenantLineBindings()` |
| `V2_TENANT_BINDING_PHONE.gs` | `testEnsureV2TenantBindingLogsSheet()` |
| `V2_TENANT_BINDING_PHONE.gs` | `testTenantBindingStatus()` |
| `V2_TENANT_BINDING_PHONE.gs` | `testTenantBindingSchema()` |
| `V2_SYSTEM_SETTINGS.gs` | `testRepairSystemSettingsPhoneLeadingZeros()` |
| `V2_SYSTEM_SETTINGS.gs` | `testEnsureSystemSettingsSchema()` |
| `V2_SYSTEM_SETTINGS.gs` | `testLandlordSettingsInit()` |
| `V2_SETTINGS_INTEGRATION.gs` | `testWorkspaceSettingsIntegration()` |
| `V2_PROPERTY_ROOM_MANAGEMENT.gs` | `testRepairWorkspacePropertyRoomLinks()` |
| `V2_PROPERTY_ROOM_MANAGEMENT.gs` | `testDiagnoseWorkspaceRoomPaymentDeposit()` |
| `V2_PROPERTY_ROOM_MANAGEMENT.gs` | `testRepairWorkspaceRoomFinancialData()` |
| `V2_PROPERTY_ROOM_MANAGEMENT.gs` | `testLandlordPropertiesInitTimed()` |
| `V2_PROPERTY_ROOM_MANAGEMENT.gs` | `testEnsurePropertyRoomSchema()` |
| `V2_PROPERTY_ROOM_MANAGEMENT.gs` | `testLandlordPropertiesInit()` |
| `V2_BILLING_MANAGEMENT.gs` | `testEnsureBillingSchema()` |
| `V2_BILLING_MANAGEMENT.gs` | `testDiagnoseBillingPreviousMeters()` |
| `V2_BILLING_MANAGEMENT.gs` | `testRepairBillingPreviousMeters()` |
| `V2_BILLING_MANAGEMENT.gs` | `testLandlordBillingInit()` |
| `V2_BILL_NOTIFICATIONS.gs` | `testEnsureBillNotificationSchema()` |
| `V2_BILL_NOTIFICATIONS.gs` | `testLandlordBillNotificationsInit()` |
| `V2_BILL_NOTIFICATIONS.gs` | `testBillNotificationMessagePreview()` |
| `V2_AUTO_PAYMENT_REMINDER.gs` | `testV2AutomaticPaymentReminderWorkspaceSchedules()` |
| `V2_AUTO_PAYMENT_REMINDER.gs` | `testEnsureV2AutomaticPaymentReminderSheet()` |
| `V2_WORKSPACE_NOTIFICATIONS.gs` | `testEnsureWorkspaceNotificationSchema()` |
| `V2_WORKSPACE_NOTIFICATIONS.gs` | `testWorkspaceNotificationRecipients()` |
| `V2_WORKSPACE_NOTIFICATIONS.gs` | `testLandlordNotificationsInit()` |
| `V2_TENANT_PAYMENT_REPORTS.gs` | `testEnsureV2PaymentReportsSheet()` |
| `V2_TENANT_PAYMENT_REPORTS.gs` | `testTenantPaymentReportInit()` |
| `V2_CONTRACT_REQUESTS.gs` | `testEnsureV2ContractRequestsSheet()` |
| `V2_CONTRACT_REQUESTS.gs` | `testTenantContractSupplementFields()` |
| `V2_CONTRACT_REQUESTS.gs` | `testTenantContractInit()` |
| `V2_CONTRACT_REQUESTS.gs` | `testLandlordContractRequestsInit()` |
| `V2_CONTRACT_REQUESTS.gs` | `testContractRequestTermsAndPenaltyModel()` |
| `V2_TENANT_MESSAGES.gs` | `testEnsureV2TenantMessagesSheet()` |
| `V2_TENANT_MESSAGES.gs` | `testTenantMessageInit()` |
| `V2_TENANT_CHECKIN_MANAGEMENT.gs` | `testEnsureTenantCheckinSchema()` |
| `V2_TENANT_CHECKIN_MANAGEMENT.gs` | `testLandlordTenantCheckinsInit()` |
| `V2_TENANT_CHECKIN_MANAGEMENT.gs` | `testTenantCheckinWelcomePreview()` |
| `V2_ANNOUNCEMENT_MANAGEMENT.gs` | `testDiagnoseAnnouncementSpreadsheetCapacity()` |
| `V2_ANNOUNCEMENT_MANAGEMENT.gs` | `testCompactAnnouncementSpreadsheetCapacity()` |
| `V2_ANNOUNCEMENT_MANAGEMENT.gs` | `testEnsureAnnouncementSchema()` |
| `V2_ANNOUNCEMENT_MANAGEMENT.gs` | `testLandlordAnnouncementsInit()` |
| `V2_ANNOUNCEMENT_MANAGEMENT.gs` | `testAnnouncementMessagePreview()` |

    ## 注意

    - 測試函式存在不代表已在實際部署環境通過。
    - 可能包含會寫入 Schema 的測試。
    - preview 與正式 send 必須區分。
    - `test=1` 頁面不是 dry-run。
