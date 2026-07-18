# Codex 第一個任務

## Issue

**V2 Production Consolidation and Baseline**

## 禁止範圍

此任務不得：

- 新增圖形化報表
- 新增報修工單
- 新增退租功能
- 重寫 UI
- 遷移資料庫
- 更換 Apps Script Web App URL

## 任務

1. 閱讀 `AGENTS.md` 與全部交接文件。
2. Clone `cmwebssaas-sudo/cmwebs-liff`。
3. 將實際 Apps Script 專案匯出至 `apps-script/`。
4. 比較實際部署、GitHub main 與 `candidate-overlay/`。
5. 建立 canonical 檔案。
6. 解決重複函式、常數與 route。
7. 產生 Schema snapshot 工具。
8. 導入 `scripts/validate-project.js` 與 GitHub Action。
9. 更新 production manifest。
10. 執行回歸並建立 baseline tag。

## 交付物

- PR：`chore/v2-production-consolidation`
- `apps-script/` 唯一正式模組
- GitHub Pages 唯一正式 HTML
- `production-manifest.json`
- `schema-snapshot.json`
- `npm run validate`
- 測試報告
- 部署與 rollback 步驟
- `v2.0.0-internal-beta.1`

## 驗收條件

- 無 variant suffix 檔
- 無重複 top-level function／const
- 68 route 無重複且 handler 存在
- 手機前導 0 修正保留
- Workspace native dashboard 保留
- 帳務預設、季節費率與上期電表修正保留
- 自動催繳 Workspace 排程保留
- 通知中心所有事件保留
- 公告容量修正保留
- `test=1` 風險文件保留
- 核心流程人工回歸通過
