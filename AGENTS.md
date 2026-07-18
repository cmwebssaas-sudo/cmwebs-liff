# AGENTS.md — CMWebs 智慧租管

本文件是 Codex 在此 repository 的最高優先級工程規則。

## 1. 產品版本邊界

- V2：內部自有房源可正式上線使用。
- V3：可對外正式上線並收費的 SaaS。
- V4：AI 房源內容、影片、社群與自媒體自動推廣。

未經明確 Issue，不得把 V3 或 V4 功能塞入 V2。

## 2. 目前工程任務

目前唯一優先任務是 **Production Consolidation**：

1. 對帳 GitHub main。
2. 匯出並對帳實際部署的 Apps Script。
3. 對帳 Google Sheets Schema。
4. 建立唯一正式檔案。
5. 建立自動驗證與回歸基準。
6. 標記 V2 internal-beta baseline。

在 Gate 0 完成前，不新增圖表、報修、退租或其他功能。

## 3. 檔名規則

正式 repository 禁止新增下列版本式檔名：

```text
*_FIXED.*
*_WITH_SETTINGS.*
*_WITH_TEAM_NOTIFICATIONS.*
*-fixed.*
complete-*.*
final-*.*
new-*.*
```

正式檔名永遠維持：

```text
V2_BILLING_MANAGEMENT.gs
V2_SYSTEM_SETTINGS.gs
landlord-billing.html
```

版本只由 Git branch、commit、tag 與 release 管理。

## 4. Apps Script 規則

- 同一個 top-level function 或 const 不得在兩個 `.gs` 檔重複宣告。
- `Code.gs` 是 V2 API route dispatcher 的唯一來源。
- 新增 route 必須同步更新 `docs/04-API-ROUTES.md` 與測試。
- 不得在主流程持有 `ScriptLock` 時，再從通知模組取得同一把 `ScriptLock`。
- LINE token、Spreadsheet ID、密鑰只能存在 Apps Script Properties。
- Web App 重新部署需建立新版本，但既有 Web App URL 應維持不變。
- 所有寫入操作必須驗證 Workspace、角色與權限。
- `workspace_id` 是新架構主鍵；`landlord_id` 僅作相容欄位。
- 不得以 `test=1` 判定為 dry-run；測試模式仍可能寫正式資料及發送 LINE。

## 5. 前端規則

- 靜態 HTML 部署於 GitHub Pages。
- LIFF 登入後以 JSONP 呼叫 Apps Script。
- 固定 shell 必須保留：

```css
html, body { height:100%; overflow:hidden; }
.app-shell { position:relative; height:var(--app-height); overflow:hidden; }
.page { height:100%; overflow-y:auto; }
.bottom-nav { position:absolute; bottom:0; }
```

- `--app-height` 由 `visualViewport.height` 或 `window.innerHeight` 設定。
- 頁面底部必須預留 nav 與 safe-area。
- Modal 必須高於底部導覽列。
- 不得在每個頁面新增不同的 API URL、LIFF ID 或測試 UID；後續需集中環境設定。

## 6. 資料與商業規則

- 台灣手機號碼以文字保存，`9xxxxxxxx` 讀取時補為 `09xxxxxxxx`。
- 帳務預設順序：房間 → 租約 → Workspace 設定。
- 新增房間的押金預設以月租 × `default_deposit_months` 計算。
- 夏月月份由 Workspace／房間設定決定，不可固定寫死 6–9 月。
- 付款流程目前為轉帳 → 房客回報 → 房東人工核准。
- 自動催繳依 Workspace 的啟用狀態、時區、發送小時與提醒天數。
- 最終催繳完成後的下一天轉人工處理。
- 通知偏好關閉時，事件仍保存通知中心，只停止 LINE push。
- 銀行帳號無權限者只能看到遮罩值。

## 7. 每次變更的必做項目

1. 建立 feature branch。
2. 修改正式檔名，不建立 suffix 版本。
3. 執行 `npm run validate`。
4. 執行受影響模組的 Apps Script 測試函式。
5. 更新測試矩陣、API、Schema 或決策文件。
6. 提供 diff 摘要、風險、部署步驟與 rollback。
7. 合併後建立清楚 commit，不直接在 main 疊加人工修正。

## 8. 禁止事項

- 未讀文件就開始重寫架構。
- 猜測哪個 `_FIXED` 檔是正式版。
- 刪除 legacy 欄位而沒有 migration。
- 直接大規模改寫正式 Google Sheets。
- 把 Apps Script token 或銀行資料提交到 Git。
- 使用測試 UID 發送大量 LINE。
- 只驗證語法，不驗證完整流程。
