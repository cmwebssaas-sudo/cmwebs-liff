# AGENTS.md — CMWebs 智慧租管

本文件是本 repository 的工程規則入口。開始任何工作前，先閱讀
`docs/CMWEBS_CODEX_HANDOFF.md` 與所有標示為 authoritative 的 CMWebs
文件，並先說明建議模型與速度；預設為 `gpt-5.6-terra`、`medium`。

## 產品邊界

- **V2.0** 是內部自有房源的 Production 基線，只接受真正 blocker、
  正確性與穩定性修正。
- **V2.1** 是 Internal Operations Completion；僅限效能整併、五項固定
  營運報表、標準數位合約閉環，以及備份、復原、Runbook 與真實營運週期
  驗證。完成後記錄 `V2_FEATURE_FREEZE = FINAL`。
- **V3** 是標準化多租戶 SaaS。每位房東使用自己的 BYO LINE OA；可設定
  品牌，功能、流程、欄位、頁面、版面與程式分支不可客製。
- **V4** 在 V3 穩定後提供標準化 Booking、Appointment、CRM 與 AI 成長
  模組。

永久原則：一套核心程式、一套規則、一次更新所有客戶；新增客戶不得造成
維護工作等比例增加。

## Production 與資料安全

- Apps Script、GitHub Pages 與 Google Sheets 是不同 release surface，必須
  分別辨識與驗證。
- 未獲明確授權，不得 deploy、push、merge、變更 Production Sheet、
  Properties、triggers、LINE、LIFF、Webhook、Rich Menu 或外部帳號。
- Script Properties 只能記錄 key presence，絕不讀取、提交或輸出 secret 值。
- 每個寫入操作必須驗證 Workspace、角色與權限；`workspace_id` 是新架構
  主鍵，`landlord_id` 僅為相容欄位。
- 不得猜測 Production 狀態。無法驗證時標記 `HUMAN_REQUIRED`。

## Repository 與前端規則

- 正式 Apps Script source 位於 `apps-script/`；`Code.gs` 是 API dispatcher
  的唯一來源。
- 新增 route 時同步更新 `docs/04-API-ROUTES.md` 與測試。
- 靜態 HTML 由 GitHub Pages root 發布。不得在每個頁面新增不同 API URL、
  LIFF ID 或 test UID。
- 保留 LIFF mobile shell、safe-area 與 bottom navigation 的既有規則。
- 不新增 `_FIXED`、`_WITH_*`、`final-*`、`complete-*` 等版本式正式檔名。

## 每次變更

1. 在隔離 worktree 與 feature branch 工作，保留其他 dirty worktree。
2. 僅 stage 本次範圍檔案；不得混入無關變更。
3. 執行受影響模組的測試與 `git diff --check`；有可用的 `package.json` 時
   再執行一次 `npm run validate`。
4. 文件、測試、API 與 schema 記錄必須與程式變更同步。
5. 報告 diff、風險、部署與 rollback；未獲授權不得實際 release。
