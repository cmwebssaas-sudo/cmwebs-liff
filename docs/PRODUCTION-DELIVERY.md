# CMWebs 正式交付入口

核對日期：2026-09-30。產品範圍：V2 正式來源整併與已授權的 Production 正確性修復。

房東日常使用：[開啟正式桌面版](https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-entry.html?mode=email&return_to=landlord-home.html)。手機繼續從既有 LINE 官方帳號進入。「更多」已提供桌面網址分享及快速建立租約。

## 唯一正式來源

- 程式來源：GitHub `cmwebssaas-sudo/cmwebs-liff` 的 `main`。
- 本次核對來源：`b650ca3ba376fd0ed6a62cb8b48b577ef4b99667`（PR #181 merge commit）。
- 公開網站：GitHub Pages；合併後建置狀態 `built`，公開檔案已完成 HTTP 讀回及逐位元組比對。
- Apps Script：已驗證的同一個正式專案，既有 Web App deployment 已更新為版本 **195**，Version **194** 保留為 rollback，既有正式網址維持不變。專案及部署指紋見 `production-baseline.json`。
- 實際後端：版本 195 的 59 個檔案，與 `main/apps-script/` 逐位元組一致。
- 正式資料表：2026-09-23 的唯讀 snapshot 從該專案的容器連結確認，完成全部 76 個工作表的欄名及配置列／欄數盤點，其中 52 個 V2 工作表沒有重複的非空欄名。配置儲存格為 5,547,896；這是容量，不是實際資料筆數。見 `production-schema-snapshot.json`；本次發布未重讀業務資料列，也未重新宣稱當前 schema 狀態。
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

匯出使用既有 `clasp clone-script SCRIPT_ID VERSION`，它只下載既有版本到空白本地目錄，不建立雲端專案。`--export` 核對 `.clasp.json` 的專案指紋及後端內容；目前服務版本仍須以 `clasp list-deployments SCRIPT_ID` 另行核對。`--live` 檢查 12 個公開資產與目前 checkout 一致，適用部署前基線和部署後讀回。

`production-baseline.json` 是帶日期的證據；後續後端發布時，經匯出、版本及部署核對後更新它。不要為通過檢查任意替換指紋。

## 驗收邊界與下一步

本次 Gate 0 的現行來源、部署與 schema 盤點已完成：57 個後端檔案一致、76 個工作表欄名已記錄、11 個公開資產逐位元組相符。已確認正式入口呈現 Email 登入畫面，未要求或代填驗證碼。這是可重現的 V2 internal-beta 來源基線；正式帳號登入後的交易及真實 iPhone／LINE 操作尚未驗收，不能以此宣稱完整營運驗收通過。

報修工單歷史與房客個資隔離程式已隨本次版本發布；新工單會以房間保留歷史、以租約隔離房客存取，前房客姓名、聯絡方式、描述中的個資及附件不得因換租而對新房客公開。既有 `V2_tenant_messages` 的 legacy backfill 尚未執行；需先完成 preview、備份與操作員授權，再以 additive-only migration 回填，不能把尚未回填當作已完成歷史遷移。

## 2026-09-30 新約與續約補充約定正式發布

- PR #181 合併為 `b650ca3ba376fd0ed6a62cb8b48b577ef4b99667`；GitHub Pages workflow `36634573071` 的 build、report、deploy 均成功。15 個公開檔案與合併後來源逐位元組相符。
- 正式 Apps Script HEAD 在發布前與 serving Version 194 的 59 個檔案完全一致；推送隔離候選後建立 immutable Version 195。Version 195 唯讀匯出與本次 59 個檔案逐位元組相符，同一 Web App deployment 已由 194 更新至 195，URL 不變。
- 簡易新約及續約可輸入最多 500 字的「補充約定／現場備註」。新版本以 `contract_id` 綁定條件快照，不沿用舊約內部備註；房客預覽與簽署版須在簽名前顯示同一條件，位置不明則拒絕生成。
- 正式 `V2_contracts` 僅核對第一列：129 個唯一欄名，包含 `contract_id`、`note`、`terms_snapshot_json`、`contract_content`、`contract_origin`、`invite_id`；沒有讀取或改寫業務資料列，也沒有改範本、Properties、trigger 或送 LINE。
- `npm test` 282/282、`npm run validate`、`npm run verify:production` 與 `git diff --check` 通過。未登入瀏覽器會導向 LINE；房東登入後建立／編輯與房客實際簽署、真機／LIFF 驗收仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。
- 回滾：既有 Web App deployment 指回 immutable Version 194；Pages 依核准流程恢復前一個 `main` `f9199bf7938af3c1310fc7294b120272abf9ccc6`。資料列不回滾。

## 2026-09-29 房東登入回旋與房況誤判修復

- PR #178 已合併至 `main`（merge commit `533c718bfb9146c126c65e15db3c222ec9d98e1d`）；GitHub Pages workflow `36560361285` 建置完成，15 個公開資產與來源逐位元組相符。
- 同一正式 Apps Script 專案的 59 個來源檔推送後建立 immutable Version 193；Version 193 唯讀匯出與 `main/apps-script/` 逐檔一致，原 Web App deployment 已由 Version 192 更新到 193，URL 不變。
- 房客建立／報到保留 LINE OAuth 返回意圖；Email session 的物件／房間寫入走受控 POST bridge，後端再次綁定 session Workspace。502 類型的房客關聯未核對時標示「待核對」並阻止誤建、誤改房況及封存；不自動修正業務資料。
- 此次未讀取或寫入 502 的正式業務資料列，未進行 Sheet migration、Properties、Trigger、LINE 發送或驗證碼操作。正式帳號寫入、502 實際占用判定及真機／LIFF UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。
- 回滾目標：Apps Script 原 deployment 指回 Version 192；GitHub Pages 將正式來源回復至 `bccaab58b10d6258ec0d26431a046d948fdf0f27`。回滾不覆蓋 Sheets 資料。

## 2026-09-23 正式 Workspace 房間中心發布

- PR #173 merge commit `b8cfd9499e50dcbfda9aab504928cf90fffdc25f` 先發布了房間中心；PR #175 merge commit `d01d22536157232c8c7ef0d73ab7599b697d549c` 修正正式 API 路由，GitHub Pages workflow `35799969425` 成功，`landlord-rooms.html` 正式網址 HTTP 200。
- Apps Script 同一正式專案已由 Version 190 更新至 immutable Version 192；Version 191 保留為前一版 rollback，原 Web App deployment 與正式 URL 維持不變。
- 新增正式唯讀 route `landlord_room_center_init` 與正式頁面 `landlord-rooms.html`，由目前登入的 Workspace 解析全部房間，支援搜尋、狀態篩選與包含已封存房間；「更多」頁提供房間中心入口。
- API 僅回傳 `workspace_id`、房間／物件識別、房間狀態、租金與公開費用設定；不回傳房客、租約、帳務、押金、付款或報修內容，也沒有執行 Sheet migration 或 z3House 寫入。
- 初版房間頁因漏傳共用 API client 的正式 `apiUrl`，曾把 JSONP 請求送回 GitHub Pages 文件而顯示逾時；Version 192／PR #175 已補正並由正式登入回讀確認 22 間房間。此次只做正式 source push、immutable version、既有 deployment slot 更新與 GitHub Pages 發布；沒有寫入房間資料，也沒有呼叫 z3House。

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
