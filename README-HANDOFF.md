# CMWebs 智慧租管：Codex 交接包

交接日期：2026-07-18  
專案：CMWebs 智能租管  
目前階段：V2 Internal Beta / Production Candidate  
估計 V2 完成度：68–72%

## 這個交接包的目的

本包將過去以對話、零散修正版檔案及人工部署累積的資訊，轉為可由 Codex 長期接手的 repository 文件與候選程式碼。

**本包不是已驗證的正式部署備份。**  
`candidate-overlay/` 是目前已知最新候選組合，必須先與 GitHub、實際 Apps Script 部署及 Google Sheets Schema 對帳。

## Codex 開始前必讀

1. `AGENTS.md`
2. `docs/00-HANDOFF-INDEX.md`
3. `docs/01-PROJECT-STATE.md`
4. `docs/15-PRODUCTION-RECONCILIATION.md`
5. `docs/16-CODEX-FIRST-TASK.md`
6. `production-manifest.json`

## 目錄

- `candidate-overlay/`：目前已知最新候選檔案，使用正式檔名。
- `unresolved-candidates/`：存在版本歧義、不可直接選用的檔案。
- `docs/`：架構、資料表、API、商業規則、測試、部署及路線圖。
- `scripts/validate-project.js`：語法、重複函式、重複常數、路由及檔名驗證。
- `.github/workflows/validate.yml`：可直接導入 GitHub Actions 的驗證流程。
- `production-manifest.json`：候選檔案來源、雜湊、路由與未決問題。
- `inventories/`：本交接環境內所有歷史變體檔案清單。

## 第一原則

在完成 Production Baseline 對帳前，不開發新功能。  
第一個 Codex 任務是整併，不是新增報表、報修或退租。

## 建議指令

```bash
npm run validate
```

驗證腳本預設掃描：

```text
candidate-overlay/apps-script
candidate-overlay/public
```

合併到正式 repository 後可執行：

```bash
node scripts/validate-project.js --root .
```
