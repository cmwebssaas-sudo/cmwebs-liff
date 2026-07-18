# 可直接貼給 Codex 的首輪指令

```text
你正在接手 CMWebs 智慧租管 V2。

先閱讀 repository 根目錄的 AGENTS.md、README.md、
docs/00-HANDOFF-INDEX.md、docs/15-PRODUCTION-RECONCILIATION.md、
docs/16-CODEX-FIRST-TASK.md 與 production-manifest.json。

本輪不要新增功能。請執行 V2 Production Consolidation：

1. 盤點 GitHub main 的全部 HTML。
2. 要求我提供或匯出目前實際部署的 Apps Script 專案。
3. 比較 deployed Apps Script、GitHub main 與 candidate-overlay。
4. 建立唯一 canonical 檔案，移除所有 _FIXED、_WITH_* 版本檔。
5. 保留所有已記錄的重要修正與商業規則。
6. 導入 scripts/validate-project.js 與 GitHub Action。
7. 產生 Google Sheets schema snapshot 工具。
8. 執行靜態驗證與回歸測試。
9. 提交 PR、測試報告、部署步驟與 rollback。
10. 在驗收前不要開始圖形化報表、報修或退租。

每一步都要顯示 diff、風險與未確定事項；不得猜測哪個歷史變體是正式版。
```
