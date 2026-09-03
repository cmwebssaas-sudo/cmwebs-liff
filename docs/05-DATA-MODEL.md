# Google Sheets 資料模型

## 身份、Workspace 與權限

| Sheet | 用途 |
|---|---|
| `V2_users` | LINE 使用者、個人資料與帳號狀態 |
| `V2_landlords` | 房東相容資料、principal landlord 與 Workspace 關聯 |
| `V2_workspaces` | 多租戶管理團隊 |
| `V2_workspace_members` | 成員、角色與權限 |
| `V2_workspace_invitations` | 團隊邀請 |
| `V2_member_scopes` | 成員的物件／房間可見範圍，尚未完整產品化 |
| `V2_property_owners` | 物件法律或收益所有權關係 |
| `V2_workspace_settings` | 帳務、通知、時區與幣別預設 |
| `V2_workspace_payment_accounts` | Workspace 收款帳號 |
| `V2_payment_accounts` | 舊版／相容付款帳號，需在整併時確認去留 |

## 房源、房客與租約

| Sheet | 用途 |
|---|---|
| `V2_properties` | 物件 |
| `V2_rooms` | 房間、租金、管理費、電費、押金與繳款日 |
| `V2_tenants` | 房客 |
| `V2_contracts` | 租約 |
| `V2_contract_requests` | 續約、提前終止與其他合約申請 |
| `V2_contract_documents` | 房東上傳與管理合約、身分證件與自拍照 |
| `V2_tenant_checkins` | 入住報到、鑰匙與入住電表 |
| `V2_tenant_messages` | 房客訊息與報修基礎資料 |

## 帳務與付款

| Sheet | 用途 |
|---|---|
| `V2_bills` | 帳單與抄表 |
| `V2_payments` | 付款／結清資料 |
| `V2_payment_reports` | 房客付款回報 |
| `V2_payment_reminder_logs` | 催繳階段、成功、失敗與人工處理 |
| `V2_bill...` | 其他帳單通知欄位可能直接擴充在既有表，需由 Schema 匯出確認 |

## 公告與通知

| Sheet | 用途 |
|---|---|
| `V2_announcements` | 公告主資料 |
| `V2_announcement_recipients` | 每位房客送達狀態 |
| `V2_workspace_notifications` | 團隊通知事件 |
| `V2_workspace_notification_deliveries` | 每位成員 LINE 送達與已讀 |
| `V2_line_message_logs` | LINE 發送紀錄 |
| `V2_liff_access_logs` | LIFF 存取紀錄 |

## 稽核與同步

| Sheet | 用途 |
|---|---|
| `V2_workspace_activity_logs` | Workspace 活動 |
| `V2_workspace_operation_audit` | 寫入操作與結果稽核 |
| `V2_sync_logs` | 資料同步 |
| `V2_tenant_binding_logs` | 房客綁定紀錄 |

## 查詢 View

| Sheet | 用途 |
|---|---|
| `V2_tenant_home_view` | 房客首頁聚合 |
| `V2_tenant_bill_view` | 房客帳單聚合 |
| `V2_landlord_home_view` | 舊／相容房東首頁 |
| `V2_landlord_arrears_view` | 欠款聚合 |
| `V2_landlord_tenant_list_view` | 房客清單聚合 |

## V2.1 landlord Email OTP contract headers

Task 1 only locks the schema contract for a later runtime slice. The migration
remains append-only: it may add missing headers or sheets, but it must not
reorder headers, delete existing columns, or overwrite existing data rows.

### `V2_users` appended headers

Append these exact headers after the current `V2_users` schema without changing
existing order:

```text
email_verified_at
email_login_enabled
```

### `V2_landlord_email_login_challenges`

Create this sheet only when it does not exist, with these exact headers:

```text
challenge_id
user_id
email_hash
code_hash
issued_at
expires_at
attempt_count
last_attempt_at
consumed_at
status
request_id
```

- Stores only hashed Email and hashed OTP code.
- Does not persist the raw Email verification code.
- Supports expiry, consumed-at replay protection, the sixth failed attempt
  lockout, and the 60-second resend throttle.

### `V2_landlord_email_sessions`

Create this sheet only when it does not exist, with these exact headers:

```text
session_id
session_token_hash
user_id
workspace_id
role
issued_at
expires_at
last_seen_at
revoked_at
status
request_id
```

- Stores only the hashed opaque session token.
- Does not persist a raw session token.
- Binds each session to the server-resolved `user_id`, `workspace_id`, and
  `role`, then re-validates those records on status, protected use, expiry, and
  revoke.

## 主鍵原則

- `workspace_id`：多租戶邊界
- `user_id`：系統使用者
- `landlord_id`：舊版房東及相容關聯
- `property_id`、`room_id`、`tenant_id`
- `contract_id`、`bill_id`、`report_id`
- `notification_id`、`delivery_id`
- `announcement_id`、`recipient_id`
- `challenge_id`、`session_id`：Email OTP contract identifiers

## Schema 風險

1. 多數模組會自動補欄位，正式 Schema 可能與候選檔案不同。
2. Google Sheets 曾接近 1,000 萬儲存格上限。
3. 新建工作表前已有容量壓縮函式，但不是長期資料庫方案。
4. Production consolidation 必須輸出每張表的 header、row count、column count、max rows 與 max columns。
