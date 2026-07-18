# 前端頁面地圖

## 房東入口與 Workspace

| 正式檔名 | 用途 | 候選狀態 |
|---|---|---|
| `landlord-entry.html` | 登入與返回頁 | 已有候選 |
| `landlord-register.html` | 房東註冊 | 已有候選 |
| `landlord-onboarding.html` | 初始設定 | 已有候選 |
| `landlord-workspaces.html` | Workspace 列表／切換 | 需從 repo 對帳 |
| `landlord-workspaces-create.html` | 新建 Workspace | 需從 repo 對帳 |
| `landlord-team.html` | 成員與權限 | 已有候選 |
| `landlord-join.html` | 接受邀請 | 已有候選 |

## 房東核心管理

| 正式檔名 | 用途 | 候選狀態 |
|---|---|---|
| `landlord-home.html` | 營運首頁 | 已有 Workspace native 候選 |
| `landlord-arrears.html` | 欠款 | 已有 Workspace native 候選 |
| `landlord-tenants.html` | 房客清單 | 已有 Workspace native 候選 |
| `landlord-tenant-detail.html` | 房客詳細資料 | 已有候選 |
| `landlord-tenant-create.html` | 建立房客與租約 | 已有候選，需對帳 |
| `landlord-properties.html` | 物件與房間 | 已有候選 |
| `landlord-billing.html` | 抄表與帳單建立 | 已有候選 |
| `landlord-bill-notifications.html` | 帳單通知 | 已有候選 |
| `landlord-payment-reports.html` | 付款回報審核 | 需從 repo／部署版取得 |
| `landlord-paid-bills.html` | 已繳帳單 | 需從 repo／部署版取得 |
| `landlord-contract-requests.html` | 合約申請 | 已有候選，需確認導覽修正 |
| `landlord-messages.html` | 房客訊息／報修 | 需從 repo／部署版取得 |
| `landlord-line-logs.html` | LINE 記錄 | 需從 repo／部署版取得 |
| `landlord-tenant-checkin.html` | 報到 | 已有候選 |
| `landlord-announcements.html` | 公告 | 已有候選 |
| `landlord-notifications.html` | 團隊通知中心 | 已有候選 |
| `landlord-settings.html` | 系統設定 | 已有候選 |
| `landlord-more.html` | 功能入口 | 已有候選 |

## 房客端

| 正式檔名 | 用途 | 候選狀態 |
|---|---|---|
| `tenant-bind.html` | 手機與 LINE 綁定 | 已有候選 |
| `tenant-home.html` | 房客首頁 | 已有候選，需對帳 |
| `tenant-bills.html` | 帳單 | 已有候選，需對帳 |
| `tenant-payment-report.html` | 付款回報 | 已有候選，需對帳 |
| `tenant-message.html` | 一般訊息與報修 | 已有候選，需對帳 |
| `tenant-contract.html` | 租約與申請狀態 | 已有候選，需對帳 |
| `tenant-renewal.html` | 續約 | 已有候選 |
| `tenant-termination.html` | 提前終止 | 已有候選 |

## 固定 UI 規範

```css
html, body { height:100%; overflow:hidden; }
.app-shell { position:relative; height:var(--app-height); overflow:hidden; }
.page { height:100%; overflow-y:auto; }
.bottom-nav { position:absolute; bottom:0; }
```

- 最大寬度通常 650px
- `visualViewport.height` 優先
- 底部 padding 必須包含 nav 高度與 safe area
- Bottom nav 預設：首頁、欠款、房客、更多
