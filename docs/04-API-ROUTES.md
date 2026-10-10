# V2 API 路由

    候選 `Code.gs` 目前辨識到 **71** 個唯一 `v2_action`。

    | Route | 模組 | 用途 |
    |---|---|---|
    | `tenant_binding_status` | 身份與綁定 | 查詢房客 LINE 綁定狀態 |
| `tenant_bind_submit` | 身份與綁定 | 房客提交手機與身份綁定 |
| `landlord_entry_status` | 房東入口 | 判斷房東註冊、onboarding 與 Workspace 狀態 |
| `landlord_register_submit` | 房東入口 | 建立房東註冊資料 |
| `landlord_onboarding_init` | 房東入口 | 載入房東 onboarding |
| `landlord_onboarding_save` | 房東入口 | 暫存 onboarding 資料 |
| `landlord_onboarding_complete` | 房東入口 | 完成 onboarding |
| `landlord_team_init` | 團隊 | 載入 Workspace 團隊成員與權限 |
| `landlord_team_invite_create` | 團隊 | 建立成員邀請 |
| `landlord_team_invite_cancel` | 團隊 | 取消成員邀請 |
| `landlord_team_member_update` | 團隊 | 修改成員角色與權限 |
| `landlord_team_member_remove` | 團隊 | 移除成員 |
| `landlord_invitation_init` | 團隊 | 載入邀請內容 |
| `landlord_invitation_accept` | 團隊 | 接受 Workspace 邀請 |
| `landlord_workspace_activity_init` | 稽核 | 載入 Workspace 操作紀錄 |
| `landlord_notifications_init` | 通知中心 | 載入團隊通知與送達結果 |
| `landlord_notification_mark_read` | 通知中心 | 單筆通知已讀 |
| `landlord_notifications_mark_all_read` | 通知中心 | 全部通知已讀 |
| `landlord_settings_init` | 系統設定 | 載入個人、Workspace、收款與通知設定 |
| `landlord_settings_save_profile` | 系統設定 | 儲存個人資料 |
| `landlord_settings_save_workspace` | 系統設定 | 儲存 Workspace 設定 |
| `landlord_settings_save_payment` | 系統設定 | 儲存預設收款帳號 |
| `landlord_settings_save_preferences` | 系統設定 | 儲存帳務與通知偏好 |
| `landlord_announcements_init` | 公告 | 載入公告受眾與歷史 |
| `landlord_announcement_send` | 公告 | 發送公告 |
| `landlord_announcement_retry` | 公告 | 重試未送達公告 |
| `landlord_tenant_checkins_init` | 入住 | 載入房客報到清單 |
| `landlord_tenant_checkin_save` | 入住 | 儲存報到、鑰匙與入住電表 |
| `landlord_tenant_checkin_send_welcome` | 入住 | 發送入住歡迎通知 |
| `landlord_bill_notifications_init` | 帳單通知 | 載入帳單通知名單 |
| `landlord_bill_notifications_send` | 帳單通知 | 發送帳單通知 |
| `landlord_billing_init` | 帳務 | 載入抄表與帳單建立資料 |
| `landlord_bills_generate` | 帳務 | 批次建立或更新帳單 |
| `landlord_tenant_create_init` | 房客 | 載入新增房客所需資料 |
| `landlord_tenant_create` | 房客 | 建立房客、租約與邀請資料 |
| `landlord_properties_init` | 物件 | 載入物件與房間 |
| `landlord_property_save` | 物件 | 新增或修改物件 |
| `landlord_property_archive` | 物件 | 封存物件 |
| `landlord_room_save` | 物件 | 新增或修改房間 |
| `landlord_room_account_toggle` | 物件 | 啟用或停用房間帳號，不修改租約與帳單 |
| `landlord_room_archive` | 物件 | 封存房間 |
| `landlord_workspace_create` | Workspace | 建立新 Workspace |
| `landlord_workspace_context` | Workspace | 取得可使用的 Workspace 清單與目前 Context |
| `landlord_workspace_switch` | Workspace | 切換目前 Workspace |
| `tenant_home` | 房客端 | 載入房客首頁 |
| `tenant_payment_report_init` | 房客端 | 載入付款回報資料 |
| `tenant_payment_report_submit` | 房客端 | 提交付款回報 |
| `tenant_message_init` | 房客端 | 載入訊息與報修表單 |
| `tenant_message_submit` | 房客端 | 提交一般訊息或報修 |
| `tenant_bills` | 房客端 | 載入房客帳單 |
| `landlord_home` | 房東儀表板 | 載入 Workspace 原生首頁資料 |
| `landlord_arrears` | 房東儀表板 | 載入欠款資料 |
| `landlord_tenants` | 房東儀表板 | 載入房客清單 |
| `landlord_line_logs` | LINE | 載入 LINE 發送與錯誤紀錄 |
| `landlord_send_tenant_message` | 訊息 | 房東主動傳訊息給房客 |
| `landlord_messages_init` | 訊息 | 載入房客訊息與報修 |
| `landlord_message_update` | 訊息 | 更新房客訊息處理狀態 |
| `landlord_payment_reports_init` | 付款 | 載入付款回報 |
| `landlord_payment_report_update` | 付款 | 更新付款回報狀態 |
| `landlord_payment_report_settle` | 付款 | 核准付款回報並結清 |
| `landlord_bill_manual_settle` | 付款 | 手動結清帳單 |
| `landlord_bill_reopen` | 付款 | 重新開啟已結清帳單 |
| `landlord_paid_bills_init` | 付款 | 載入已繳帳單 |
| `tenant_contract_init` | 租約 | 載入房客租約與申請狀態 |
| `tenant_contract_request_submit` | 租約 | 提交續約或提前終止申請 |
| `tenant_contract_requests` | 租約 | 載入房客申請紀錄 |
| `tenant_contract_request_cancel` | 租約 | 取消申請 |
| `landlord_contract_requests_init` | 租約 | 載入房東合約申請管理 |
| `landlord_contract_request_update` | 租約 | 房東審核或更新申請 |
| `landlord_contract_documents_init` | 租約 | 載入房東合約文件清單 |
| `landlord_contract_document_download` | 租約 | 下載合約文件 |

付款回報入口規則：房客通知的 `action_url` 必須指向
`landlord-payment-report-review.html`，由房東 LIFF gateway
`landlord-entry.html` 完成登入後再回到審核頁；房客端的
`landlord-payment-reports.html` 不得作為房東付款回報入口。

    ## 變更規則

    - `Code.gs` 是唯一 route dispatcher。
    - 新增 route 必須同步更新本文件。
    - route 名稱不得重複。
    - handler 不存在時驗證應失敗。
- Production baseline 必須確認所有 71 個 route 在實際 Apps Script 專案可解析。

## Phase 91 staging-only repair routes

下列 4 個 route 只存在 `release/staging/`，尚未納入 Production canonical 68 routes：

| Route | Handler | 用途 |
|---|---|---|
| `tenant_repairs_init` | `getTenantRepairTicketsByLineUid_` | 房客查詢自己的報修單 |
| `tenant_repair_create` | `createTenantRepairTicketByLineUid_` | 房客建立報修單並將房東通知排入 Queue |
| `landlord_repairs_init` | `getLandlordRepairTicketsByLineUid_` | 房東依目前 Workspace 查詢報修單 |
| `landlord_repair_update` | `updateLandlordRepairTicketByLineUid_` | 房東更新狀態；完成時將房客通知排入 Queue |

Staging dispatcher 預期為 72 個唯一 route；Production canonical 仍維持 68 個。

## Phase 92 staging-only lease lifecycle routes

下列 6 個 route 只存在 `release/staging/`：

| Route | Handler | 用途 |
|---|---|---|
| `landlord_contracts_init` | `getLandlordContractsByLineUid_` | 依目前 Workspace 查詢租約 |
| `landlord_contract_create` | `createLandlordContractByLineUid_` | 建立租約草稿 |
| `landlord_contract_update` | `updateLandlordContractByLineUid_` | 修改租約草稿主要條件 |
| `landlord_contract_activate` | `activateLandlordContractByLineUid_` | 驗證日期與衝突後啟用租約 |
| `landlord_contract_status_update` | `updateLandlordContractStatusByLineUid_` | 更新租約 lifecycle 狀態 |
| `landlord_contract_delete` | `deleteLandlordContractByLineUid_` | 軟刪除草稿或已取消租約 |

Phase 92 staging dispatcher 預期為 78 個唯一 route；Production canonical 仍維持 68 個。

## Phase 93 staging-only billing lifecycle routes

下列 3 個 route 只存在 `release/staging/`：

| Route | Handler | 用途 |
|---|---|---|
| `landlord_billing_lifecycle_init` | `getLandlordBillingLifecycleByLineUid_` | 依目前 Workspace 查詢帳單及付款 ledger |
| `landlord_contract_bill_generate` | `generateContractMonthlyBillByLineUid_` | 依有效租約建立指定月份帳單並排入 `bill_created` 通知 |
| `landlord_bill_payment_confirm` | `confirmLandlordBillPaymentByLineUid_` | 房東確認全額付款、建立付款紀錄並排入 `payment_confirmed` 通知 |

Phase 93 staging dispatcher 預期為 81 個唯一 route；Production canonical 仍維持 68 個。房客帳單讀取沿用既有 `tenant_bills` route，不建立第二個 tenant API contract。

## Phase 94 staging-only move-out and deposit settlement routes

下列 6 個 route 只存在 `release/staging/`：

| Route | Handler | 用途 |
|---|---|---|
| `tenant_move_out_requests_init` | `getTenantMoveOutRequestsByLineUid_` | 房客查詢自己的退租申請及押金結算 |
| `tenant_move_out_request_create` | `createTenantMoveOutRequestByLineUid_` | 房客依目前有效租約建立退租申請 |
| `landlord_move_out_requests_init` | `getLandlordMoveOutRequestsByLineUid_` | 房東依目前 Workspace 查詢退租流程 |
| `landlord_move_out_inspection_schedule` | `scheduleLandlordMoveOutInspectionByLineUid_` | 安排驗屋並通知房客 |
| `landlord_move_out_inspection_complete` | `completeLandlordMoveOutInspectionByLineUid_` | 完成驗屋、讀取未繳帳單及報修扣款並建立押金結算 |
| `landlord_deposit_refund_confirm` | `confirmLandlordDepositRefundByLineUid_` | 確認退款、終止租約並排入完成通知 |

Phase 94 staging dispatcher 預期為 87 個唯一 route；Production canonical 仍維持 68 個。
