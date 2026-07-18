# 部署 Runbook

## 部署前 Gate

1. `npm run validate` 通過
2. 受影響 Apps Script 測試函式通過
3. 確認沒有重複 `.gs` 模組
4. 確認 `Code.gs` route 無重複
5. 確認 Git diff 只包含預期檔案
6. 確認沒有 token 或個資
7. 建立 rollback commit／tag

## GitHub Pages

現行 repository 為平面 HTML 結構。Production consolidation 可先保留平面結構，避免一次改動部署路徑。

建議流程：

```text
feature branch
→ validate
→ PR
→ merge main
→ GitHub Pages 發布
→ 加 v=timestamp 測試
```

測試網址示例：

```text
https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-home.html?v=<release>&test=1
```

## Apps Script

1. 將 canonical `.gs` 同步至 Apps Script 專案。
2. 不得同時保留候選來源檔名與 canonical 檔名。
3. 執行 Schema／初始化／preview 測試。
4. 部署 → 管理部署作業 → 編輯。
5. 選擇「新版本」。
6. 部署。
7. Web App URL 應維持原 URL。
8. 測試 route 與 LIFF 頁。

## 時間觸發器

自動催繳：

```text
saveV2AutomaticPaymentReminderSpreadsheetId()
syncV2AutomaticPaymentReminderTrigger()
inspectV2AutomaticPaymentReminderTriggers()
```

應只有一個每小時 Dispatcher trigger。

## Rollback

- GitHub：revert merge commit 或切回 release tag
- Apps Script：管理部署作業 → 改回前一個版本
- Sheets：不得以 rollback 程式直接覆蓋資料；需使用備份或 migration
- LINE：若錯誤大量發送，先停用 trigger 與通知偏好

## Release 建議

```text
v2.0.0-internal-beta.1
v2.0.0-internal-beta.2
v2.0.0-internal-rc.1
v2.0.0-internal
```
