# 系統架構

## 現行架構

```text
LINE App / Browser
        │
        ▼
GitHub Pages 靜態 HTML
- LIFF SDK
- 原生 JavaScript
- JSONP callback
        │
        ▼
Google Apps Script Web App
- Code.gs route dispatcher
- 各 V2_*.gs 業務模組
- LINE Messaging API push
        │
        ▼
Google Sheets
- 主交易資料
- 查詢 View
- 操作與 LINE 紀錄
```

## 前端

- 部署方式：GitHub Pages
- 技術：單頁 HTML、CSS、原生 JavaScript
- 登入：LINE LIFF
- API：JSONP，以 `callback` 參數回傳
- 部分 API 支援 `bridge=1`
- 手機固定 shell 與 bottom nav
- 無 bundler、無 frontend framework

## 後端

- Google Apps Script Web App
- `Code.gs` 依 `v2_action` 分派
- 各模組以全域函式互相呼叫
- LINE push 由 Apps Script 發送
- 使用 Script Properties 保存 token 與時間觸發器所需設定
- 使用 LockService 避免競態；通知中心使用獨立 DocumentLock 避免巢狀 ScriptLock

## 資料庫

目前 Google Sheets 是主資料庫。這適合 V2 內部房源，但有：

- 1,000 萬儲存格上限
- 大型工作表全表掃描
- 缺少索引與交易
- Schema 演進較難
- Apps Script 執行時間與配額限制

V3 預計遷移核心交易資料至 PostgreSQL／Supabase 類型資料庫。V2 不因此延後內部上線，但必須先控制工作表容量、查詢與封存。

## 多租戶模型

新架構主鍵是：

```text
workspace_id
```

舊架構仍保留：

```text
landlord_id
```

過渡期規則：

1. 新功能先解析 Workspace Access。
2. 查詢及寫入必須帶 Workspace 範圍。
3. `landlord_id` 只作相容與 principal landlord 關聯。
4. V3 前完成真正的 tenant isolation 測試。

## 通知架構

```text
業務事件
→ workspaceNotifyTeam_
→ 解析 Workspace 設定
→ 依角色／權限選擇收件人
→ LINE Push
→ V2_workspace_notifications
→ V2_workspace_notification_deliveries
```

關閉通知偏好只停止 LINE Push，事件仍保存通知中心。

## 自動催繳架構

```text
每小時 Apps Script Trigger
→ 讀取全部 Workspace 設定
→ 依 timezone + overdue_reminder_hour 判斷
→ 依 overdue_reminder_days_json 決定階段
→ 防重
→ LINE Push
→ 成功／失敗／人工處理紀錄
```

## 未來建議

V2 先完成穩定基準，後續逐步：

- 集中環境設定
- 共用 JSONP client 與 UI shell
- Apps Script 模組化與測試
- 查詢索引表／CacheService
- V3 資料庫與 API 遷移
