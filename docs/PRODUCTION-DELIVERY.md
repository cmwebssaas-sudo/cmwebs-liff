# CMWebs 正式交付入口

核對日期：2026-09-18。產品範圍：V2 正式來源整併、退房退款帳務結清與一次性測試帳單封存。

房東日常使用：[開啟正式桌面版](https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-entry.html?mode=email&return_to=landlord-home.html)。手機繼續從既有 LINE 官方帳號進入。「更多」已提供桌面網址分享及快速建立租約。

## 唯一正式來源

- 程式來源：GitHub `cmwebssaas-sudo/cmwebs-liff` 的 `main`。
- 本次核對來源：`257093b6b03838275342d67944ce6988edf57d3b`（PR #169 merge commit）。
- 公開網站：GitHub Pages；合併後建置狀態 `built`，公開檔案已完成 HTTP 讀回及逐位元組比對。
- Apps Script：已驗證的同一個正式專案，既有 Web App deployment 已更新為版本 **190**，Version **189** 保留為 rollback，既有正式網址維持不變。專案及部署指紋見 `production-baseline.json`。
- 實際後端：版本 190 的 58 個檔案，與 `main/apps-script/` 逐位元組一致。
- 正式資料表：從該專案的容器連結確認，完成全部 76 個工作表的欄名及配置列／欄數盤點，其中 52 個 V2 工作表沒有重複的非空欄名。配置儲存格為 5,547,896；這是容量，不是實際資料筆數。見 `production-schema-snapshot.json`，未讀取第 2 列以後的業務資料。
- 舊部署版本 160 仍存在，但公開網站目前不使用它。不得因舊工作目錄引用它，便把它當作正式服務版本。

專案名稱及更新時間不能辨識正式來源。正式部署必須從公開網站的 Web App ID 對回 Apps Script 專案。Git worktree 是同一 repository 的工作副本；不需要為更新建立新的雲端 Apps Script 專案。

## 每次交付的固定檢查

從最新 `main` 建立乾淨 feature worktree，保留根目錄既有 WIP。執行：

```sh
npm run validate
npm test
npm run verify:production
node scripts/verify-production-source.mjs --export /absolute/path/to/read-only-export
git diff --check
```

匯出使用既有 `clasp clone-script SCRIPT_ID VERSION`，它只下載既有版本到空白本地目錄，不建立雲端專案。`--export` 核對 `.clasp.json` 的專案指紋及後端內容；目前服務版本仍須以 `clasp list-deployments SCRIPT_ID` 另行核對。`--live` 檢查 11 個公開資產與目前 checkout 一致，適用部署前基線和部署後讀回。

`production-baseline.json` 是帶日期的證據；後續後端發布時，經匯出、版本及部署核對後更新它。不要為通過檢查任意替換指紋。

## 驗收邊界與下一步

本次 Gate 0 的現行來源、部署與 schema 盤點已完成：57 個後端檔案一致、76 個工作表欄名已記錄、11 個公開資產逐位元組相符。已確認正式入口呈現 Email 登入畫面，未要求或代填驗證碼。這是可重現的 V2 internal-beta 來源基線；正式帳號登入後的交易及真實 iPhone／LINE 操作尚未驗收，不能以此宣稱完整營運驗收通過。

報修工單歷史與房客個資隔離程式已隨本次版本發布；新工單會以房間保留歷史、以租約隔離房客存取，前房客姓名、聯絡方式、描述中的個資及附件不得因換租而對新房客公開。既有 `V2_tenant_messages` 的 legacy backfill 尚未執行；需先完成 preview、備份與操作員授權，再以 additive-only migration 回填，不能把尚未回填當作已完成歷史遷移。

## 2026-09-18 一次性測試帳單作廢／封存正式發布

- PR #169 merge commit `257093b6b03838275342d67944ce6988edf57d3b` 已發布至 GitHub Pages；workflow `35339276140` 的 build、deploy、status jobs 全部成功。
- Apps Script 同一正式專案已由 Version 189 更新至 immutable Version 190；既有 Web App deployment 與正式 URL 維持不變，Version 189 保留 rollback。
- 欠款頁僅對已關閉房間帳號的未繳、無付款紀錄帳單顯示「作廢測試帳單」。後端重新驗證 Workspace、房間狀態、付款狀態與付款紀錄，沿用既有取消核心，保留帳單歷史並寫入操作稽核；不建立付款、不發送 LINE、不刪除資料，重送為冪等結果。
- Pages 公開讀回確認 `landlord-arrears.html` HTTP 200 且包含兩個新 route 與封存按鈕；Version 190 唯讀匯出 58 個檔案與候選 `apps-script/` 逐檔一致。
- 本次未執行 Google Sheets 業務資料列、Drive、Properties、Trigger、付款或 LINE 寫入。完整 Node suite 為 244 項中 242 項通過；2 項既有 landlord bridge baseline failures 未因本次變更新增。登入後房東操作與手機／LIFF UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-18 作廢帳單成功提示正式發布

- PR #171 merge commit `31515af0958cb8a3e7039da506b1676a4c441345` 已發布至 GitHub Pages；workflow `35344387333` 的部署結果為 `success`。
- 本次只有 `landlord-arrears.html` 的成功回饋與回歸測試變更，沒有 Apps Script 後端變更；正式 Apps Script Version 190 維持服務，Version 189 維持 rollback。
- 作廢成功後，欠款頁會顯示「作廢成功」彈窗與獨立的頁面提示；提示包含帳單 ID，並說明重新整理欠款清單後不再列入欠款。提示區塊不會被清單重繪覆蓋，並提供關閉控制。
- 公開 `landlord-arrears.html` HTTP 200 read-back 已確認 `archiveSuccessNotice`、`作廢成功` 與 `aria-live="polite"` 已由正式網站提供。
- 本次未執行 Google Sheets 業務資料列、Drive、Properties、Trigger、付款或 LINE 寫入；Pages rollback target 為前一個已驗證的 `main` commit `f9dc5fd7d657cad352fe741cbb7c28364facb3f2`。登入後房東操作與手機／LIFF UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

兼容性待辦：目前已部署的單一 dispatcher 檔案為 `apps-script/程式碼.js`（雲端 `.gs`），與規則中預期的 `Code.gs` 名稱不一致。本次保留已逐位元組驗證的正式來源，後續更名須同步修正工具／測試引用並單獨驗證，不以悄悄更名宣稱無差異。

本次未執行 Google Sheets 業務資料列回填、真實退房交易或 LINE 通知；Apps Script rollback target 為版本 188，Pages rollback target 為前一個已驗證 `main` 提交 `e77591e40c2fda875039ea6ec1c35d9354b8ed46`。將來後端變更前應匯出並保留當時服務版本作為該次 rollback 目標。

## 2026-09-18 退房退款同步結清帳單正式發布

- PR #167 merge commit `4069e6fd0523a3c5f3d5caf307a5a76c4155c6a6` 已發布至 GitHub Pages；workflow `35326158352` 成功。
- Apps Script 同一正式專案已由 Version 188 更新至 immutable Version 189，原 Web App deployment 與正式 URL 維持不變；Version 188 保留 rollback。
- `manual` 快速結案會將同一 Workspace／房東／房客／房間／合約範圍的未繳帳單標記為既有正式 `paid` 狀態，保留原金額並同步帳單 view／Workspace summary；完整電表結算不自動改帳。
- 部署未執行 Sheet 業務列、真實退房／退款交易、Drive、Properties、Trigger 或 LINE 寫入；手機／LINE／登入後實際操作仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。
