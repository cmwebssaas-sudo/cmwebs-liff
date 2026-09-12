# CMWebs Changelog

**Status: AUTHORITATIVE product-memory changelog**

## 2026-09-13 — 房東桌面 Email 詳細／合約讀取路由修正（本地候選）

- 修正桌面版房客詳細與帳款讀取仍沿用 LINE-only 初始化，導致 Chrome 被送往 LINE OAuth
  `400 invalid_url` 或頁面顯示 API 逾時；兩頁現在共用 Email auth session 與 POST bridge。
- 修正合約頁對「原生合約簽署審核」及「房東發起合約」唯讀初始化的桌面 Email 擋板，
  改為沿用已驗證的 session token；未支援的合約寫入操作仍維持 fail-closed。
- 只修改靜態前端與回歸測試，未修改 Apps Script、Sheet、Drive、帳務、登入資料或訂閱資料。
  Phase 258 與完整 Node suite `207/207`、`npm run validate`、static release-cache validator、
  `node --check`、`git diff --check` 通過；尚未推送、合併或部署。
- 正式網站仍需已登入桌面 Chrome 實機驗收房客詳細、帳款查看房客、合約清單，狀態為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-12 — 房東退房欄位 iOS 自動放大修正（正式部署）

- 修正退房表單欄位在 iPhone／LINE WebView 聚焦時可能因字級小於 `16px` 而自動放大，導致
  畫面跳離正在填寫的欄位；輸入控制項現在明確使用 `16px`，包含檔案欄位。
- 新增 Phase 257 回歸測試；完整 Node suite `206/206`、`npm run validate`、static release-cache
  validator 與 `git diff --check` 通過。只修改退房靜態前端與測試，不修改 Apps Script、Sheet、Drive、
  帳務、登入或退房結算規則。
- PR #161 已合併至 `main`，merge commit `d3ed41b7efda071978943f55167cadaa0b72b04a`；GitHub Pages
  workflow `34700989635` 成功，公開退房頁 HTTP 200 read-back 已確認 `16px` 規則已發布。真實手機／LIFF
  驗收仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-12 — 房東退房鍵盤遮罩修正（正式部署）

- 修正手機鍵盤開啟時退房表單下方欄位被遮住、無法填寫的問題，包含押金扣除說明、點交備註與結案欄位。
- PR #159 已合併至 `main`，merge commit `5d8eeb97dc5f8d505e355b75f28913fd36aecba1`；
  GitHub Pages workflow `34697177348` 成功，公開退房頁 read-back 已確認鍵盤可視性修正已發布。
- 本次為純前端發布，不修改 Apps Script、Sheet、Drive、帳務、登入或 LINE；真實手機／LIFF 驗收仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-12 — 房東退房欄位遮罩修正（正式部署）

- 根因為退房頁沿用固定底部營運列；在手機鍵盤開啟或捲動到表單下方時，固定列會蓋住
  「押金扣除說明」、「點交備註」與結案按鈕，並攔截欄位觸控。
- 退房專用 shell 現在隱藏不提供導覽功能的底部列，縮減表單底部多餘安全間距；欄位
  focus 仍會自動捲到可視區中央，並保留 `inline: nearest` 的橫向定位。
- 只修改 `landlord-tenant-checkout.html` 與新增 Phase 255 UI 回歸測試；不改 Apps Script、
  Sheet、Drive、帳務資料、登入或退房結算規則。Phase 253／255、完整 Node suite `204/204`、
  Apps Script syntax、static release-cache validator 與 `git diff --check` 通過。
- PR #157 已合併至 `main`，merge commit `d938520e80af738f82dcba301f78cee9200df8c8`；
  GitHub Pages workflow `34688134508` 成功，公開退房頁 HTTP 200 read-back 已確認新 shell
  與遮罩修正。只更新 GitHub Pages 前端，Apps Script 不需重新部署。
- 真實手機／LIFF 欄位操作仍需使用者在正式環境驗收，狀態為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-11 — 房東退房快速結案（正式部署）

- 退房頁新增「快速結案」模式：不要求電表讀數或照片，直接使用房東輸入的「手動應收金額」
  與「實際退款金額」作為最終結算，伺服器仍會驗證押金上限、押金扣除說明與冪等鍵。
- 完整電表結算保留；新增結算模式切換、表單 focus 自動捲動與底部導覽安全間距，避免
  押金扣除說明等欄位被遮住。
- Phase 252／253／254、完整 Node suite `203/203`、Apps Script syntax、static release-cache
  validator 與 `git diff --check` 通過。PR #155 merge commit `6fa0bba` 已合併；Apps Script
  Production Version 186 已部署至既有 Web App，Version 185 保留 rollback；必要的
  `runV2CheckoutSettlementProductionMigration` 已在已登入 Apps Script 編輯器執行完畢。
- GitHub Pages workflow `34598441945` 成功，公開房東頁與退房頁 read-back HTTP 200，已確認
  快速結案欄位、新 cache marker 與「處理中，請勿重複按」。真實手機／LIFF UAT 仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`，未執行真實退房交易。

## 2026-09-11 — 房東桌面版網址改為手機分享流程（正式部署）

- 「更多功能 → 開啟桌面版」改為先顯示分享面板，不再讓手機直接導覽；面板提供固定
  桌面 Email 登入網址、複製與手機系統分享，沒有系結 Email、OTP、LINE UID 或登入
  狀態。
- 延續既有 `mode=email` 與安全 `return_to` 分流；手機一般 LINE 入口與 Email OTP
  登入流程不變。
- 只改 `landlord-more.html` 與 Phase 232／250／251 回歸測試；PR #153 merge commit
  `a497b5a1ce9ab5741599c1a8435a1d3b01f2ef0b` 已合併，GitHub Pages workflow
  `34584013793` 成功。公開頁與 Email mode 入口 read-back HTTP 200，真實手機／桌面
  驗收仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-11 — 房東開啟桌面版誤走過期 LINE 登入（本地候選）

- 修正「更多功能 → 開啟桌面版」在手機 LINE WebView 仍依裝置模式初始化 LINE，
  因 access token 過期而顯示「LINE 登入已過期」的流程；連結現在明確帶入
  `mode=email`，入口頁會在 LINE 初始化前顯示 Email OTP 登入。
- 手機一般 LINE 入口、LINE 重新登入與既有 Email/session 驗證不變；未把任何 Email、
  OTP、challenge、session 或 LINE UID 放入網址。
- 只改 `landlord-more.html`、`landlord-entry.html` 與 Phase 232／250 回歸測試；未改
  Apps Script、Sheet、Drive、Properties、Trigger、帳務資料或 LINE 設定。
- 本地 focused tests 通過；尚未推送／合併／GitHub Pages 發布，真實手機點擊與桌面
  Email/session 驗收仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-10 — 房東共用腳本快取版本修正（正式部署）

- 前一版後端已修正唯讀讀取路徑，但公開頁的 `landlord-auth.js`／`landlord-api.js`
  仍是未版本化資產，舊瀏覽器工作階段可能繼續執行舊的逾時橋接。所有房東頁與共用
  腳本現在統一使用 `20260910-landlord-read-bridge-v2` cache-busted marker。
- 只改 GitHub Pages 靜態資產、validator 與 Phase 249 回歸測試；不改 Apps Script、
  Sheet、Drive、Properties、帳務或 LINE。Apps Script Version 185 不需重部署。
- `npm run validate`、Phase 249 與完整 Node suite `198/198` 通過；Phase 209 測試改用
  固定測試時間，避免狀態判定隨真實日期漂移。
- PR #150 merge commit `2cc882a33654e8d027cbce3514170c450374a9e1` 已合併；Pages workflow
  `34423919614` 成功，公開房東主要頁面與三個共用腳本 read-back HTTP 200 且 SHA-256
  一致。新未登入分頁會進入正常 LINE 登入流程；真實已登入桌面／手機流程仍需
  `HUMAN_REQUIRED` 驗收。

## 2026-09-10 — 房東桌面多頁 POST bridge 逾時修正（正式部署）

- 桌面 Email hidden iframe POST bridge 補齊帳款、合約唯讀初始化、通知、付款回報、
  營收圖表、Workspace context 與手動銷帳狀態查詢的伺服器回應；帳款／合約頁只放行
  唯讀 action，寫入與合約異動仍 fail closed。
- PR #147 merge commit `f72cfee37013fe3952445d32ed41ceac757cf72c`；既有 Production
  Apps Script deployment 由 Version 182 更新至 immutable Version 183，Version 182
  保留 rollback，Web App URL 不變。
- GitHub Pages workflow `34410925756` 成功；公開六個房東頁與共用 API/auth 資產 HTTP
  200，未登入 bridge smoke check HTTP 200。完整 Node `195/195`、Apps Script syntax、
  static release-cache validator、`git diff --check` 通過。
- 真實已登入 Chrome／Email session 多頁載入、圖表、側欄角色狀態仍需
  `HUMAN_REQUIRED`；未以公開 HTTP 或 smoke check 宣稱完成桌面 UAT。

## 2026-09-10 — 房東桌面多頁 API 讀取逾時修正（正式部署）

- `landlord_arrears`、`landlord_billing_init`、`landlord_contract_requests_init`、
  `landlord_properties_init`、`landlord_tenants` 等唯讀房東 route 啟用 request-local
  Sheet snapshot，避免每次切頁重新重複 schema／Workspace／工作表掃描；不改登入、帳務、
  Sheet schema、Drive 或 LINE 發送流程。
- PR #145 merge commit `ba44d10d2ee4c752f3c6cd646807af77b40a2647`、候選 commit
  `0c8e885`；既有 Production Apps Script deployment 由 Version 181 更新至
  immutable Version 182，Version 181 保留 rollback，Web App URL 不變。
- GitHub Pages workflow `34380231863` 成功；`npm run validate`、完整 Node `192/192`、
  Apps Script syntax、static release-cache validator 與 `git diff --check` 均通過。
- 未登入 HTTP read-back 為 200；已登入 Chrome／LINE 四頁真實逾時率與速度仍需
  `HUMAN_REQUIRED` 驗收，不能只由 source／HTTP 檢查推論已達 App 般流暢。

## 2026-09-09 — 桌面版 landlord API 讀取逾時修正（正式部署）

- `landlord_home_bootstrap` 與 `landlord_tenants` 共用 request-local Sheet snapshot，
  減少同一個 API request 的重複工作表掃描；不改帳務、Sheet schema、登入、通知或
  其他 Production 資料。
- Candidate commit `44c1abf`；Apps Script immutable Version 180 已更新目前公開頁使用
  的既有 Web App deployment，Version 179 保留 rollback，Web App URL 不變。
- 兩個 landlord read route 的未登入唯讀 smoke check HTTP 200；GitHub Pages 無前端
  變更。已登入桌面版真實首屏／房客名單驗收仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-09 — 房東 LINE 入口過期登入與 file:// 回跳（正式部署）

- `landlord-entry.html` 在 LINE access token 過期／無效時顯示重新登入，不再誤導
  房東重新註冊；登入按鈕立即鎖定，避免重複跳轉。
- 外部瀏覽器與本機 `file://` 測試不再把無效檔案網址送給 LINE，也不重播 OAuth
  `code`／`state`；所有舊 cache query 已更新至 marker
  `20260909-entry-expired-login-v1`。
- PR #140 merge commit `17843ecae0094fbf15153bbca806a9aff347a0f7`、Pages workflow
  `34338782441` 成功；公開入口資產 read-back HTTP 200。Apps Script、Sheet、Email、
  LINE 發送與財務資料均未變更；真實手機／外部瀏覽器登入驗收仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-09 — Email 驗證碼 bridge timeout 與失敗提示（本地候選）

- Email 登入與已登入房東首次 Email 驗證的 hidden POST bridge 改用 60 秒逾時，避免
  Apps Script MailApp 寄信或回應稍慢時被原本 25 秒前端逾時誤判。
- 設定頁區分 `EMAIL_DELIVERY_FAILED` 與 `API 載入逾時`，分別提示管理員檢查寄信設定／授權
  或稍後重試；不暴露密鑰、不自動重送 OTP。
- Phase 242 本地回歸通過；正式 Email 寄送、MailApp 設定與首次驗證仍需部署後
  `HUMAN_REQUIRED`／`UNVERIFIED` 驗證。

## 2026-09-09 — 付款帳號封面與手動銷帳 bridge timeout（本地候選）

- 修正房東手動銷帳與銀行帳戶封面上傳在 Email／bridge 路徑忽略頁面指定逾時值的問題；
  兩者現在可使用 60 秒上限，仍不啟用自動重試，避免重複寫入。
- 新增 Phase 236／239 回歸測試，確認長操作逾時值由 API client 傳遞至 auth bridge。
- 本地完整 Node 測試與 Apps Script syntax 已通過；尚未宣稱 Production 部署，真實
  房東封面上傳、房客帳單顯示與手動銷帳仍需部署後 `HUMAN_REQUIRED`／`UNVERIFIED` 驗證。

## 2026-09-07 — 匯款帳號前導 0 與銀行帳戶封面（正式部署）

- Workspace 收款帳號改以純文字欄位寫入，Google Sheets 先設定 `@`，不再因數字轉換
  清除前導 `0`；舊資料已遺失的前導 `0` 需由房東重新輸入。
- 新增房東私有銀行帳戶封面上傳，以及房客帳單／付款回報頁的延遲預覽；Drive ID
  僅留在伺服器端，租客只取得封面檔名與受限圖片資料。
- PR #127 以 merge commit `f7c3361f257d032210ab5740022fddcde8168646` 合併；既有
  Production Apps Script deployment 由 Version 172 更新至 Version 173，Version 172
  保留 rollback，Web App URL 不變。Pages workflow `34126765101` 成功完成。
- 本地完整 Node `155/155`、`npm run validate`、Apps Script syntax 與
  `git diff --check` 均通過；Production API／公開房客帳單頁／房東設定頁 read-back
  均 HTTP 200。未執行 Sheet 帳務資料寫入或 LINE 發送；真實手機／LIFF UAT 仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。上傳功能正式使用前需設定
  `CMWEBS_PAYMENT_ACCOUNT_COVER_DRIVE_ROOT_FOLDER_ID`。

## 2026-09-07 — 房客付款回報金額與正式帳單一致（正式部署）

- 根因確認：房客付款回報初始化與送出只讀取衍生的
  `V2_tenant_bill_view`；當正式 `V2_bills` 已套用折抵、衍生 view 尚未同步時，付款
  回報會顯示並記錄折抵前金額，後續銷帳則依正式帳單金額拒絕，造成兩邊不一致。
- 付款回報現在以同一 `bill_id` 的 `V2_bills` 為權威來源；只有主表缺少該帳單時才
  相容回退 view，且 legacy view 必須精確匹配房客 LINE UID；主表列則必須完整匹配
  房客、合約、房間與 Workspace。
- runtime 在既有單次帳單快照中建立全域 bill ID 計數；跨 Workspace 同 ID、相關的
  重複主表 ID 或主表身份衝突會分別以 `BILL_ID_SCOPE_CONFLICT`／
  `DUPLICATE_BILL_ID` 明確停止，不會回退衍生 view，也沒有增加 Sheet 讀取次數；
  同房客不同 bill ID 的舊合約歷史帳單則忽略，不阻擋目前付款回報。
- Phase 140 新增折抵前 view `NT$8,790`、正式應繳 `NT$7,145` 的回歸案例，確認選單
  顯示與新付款回報均記錄 `NT$7,145`，並覆蓋合法 legacy 回退、空白 LINE、跨
  Workspace 同 ID、重複主表 ID 與續約歷史帳單；合併結果完整 Node `138/138` 通過。
- PR #121 已合併至 `main`，merge commit 為
  `74ae25bc9df4e09895235b266e416f7d1b481ddf`。既有 Production Apps Script
  deployment 已由 Version 167 更新至 immutable Version 168，Version 167 保留為
  rollback，Web App URL 不變；Version 168 匯出與 `main` source exact match，公開
  payment-report guard HTTP 200／`MISSING_LINE_UID`。
- 既有付款回報、正式帳單與 Sheet 資料均未修改，Apps Script Sheet-backed 測試與
  LIFF／銷帳真實流程仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。隔離 worktree 沒有
  `package.json`，因此 `npm run validate` 不可用；既有 static release-cache validator
  仍鎖定舊 release marker，屬與本次 Apps Script-only 修正無關的基線限制。

## 2026-09-06 — 房東頁 API 韌性與切頁載入改善（正式發布）

- 新增共用 `landlord-api.js`：相同唯讀請求合併、唯讀逾時或網路失敗最多補試一次；
  寫入操作維持單次送出，避免帳務、通知與其他變更因自動重試而重複執行。
- 房客名單先呈現主要資料，再非阻塞補入合約請求狀態，減少切頁等待；五個主要房東
  頁面已改用共享 client，並保留 Email bridge／LINE JSONP 相容路徑。
- PR #119 已合併至 `main`，merge commit
  `4e2ae896ad8fba6adbce729afc80cf535d4912f4`；GitHub Pages workflow
  `34039861775` 成功完成。
- 公開 release asset、共享 client 與房客名單頁 read-back 均為 HTTP 200，發布 marker
  為 `20260906-landlord-api-resilience-v1`。本地 `npm run validate`、完整 Node
  `138/138`、JavaScript syntax 與 diff whitespace 檢查通過。
- 本次未變更 Apps Script、Sheet、Properties、Trigger、帳單或 LINE；真實手機／LIFF
  流暢度與各 API runtime 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-06 — 帳單發送逾時、快速續約顯示與手動銷帳回應修正（local candidate）

- 房東手動發送本月帳單的 JSONP 寫入逾時不再自動補送第二次；改為唯讀重新載入通知
  狀態，並明確提示系統未重送，避免已發送帳單被誤判為失敗。
- 手機版房客名單的快速續約 CTA 補上高優先權選擇器，避免 action-grid 白底規則覆蓋
  綠底白字按鈕；不改變既有的合約到期資格、續約 URL 或簽約流程。
- 手動銷帳在 V2 canonical 帳單與付款資料已讀回驗證後，V1 同步、通知、稽核或存取
  紀錄的後續例外改列 `post_commit_warnings`，仍明確回覆已入帳及不可重複銷帳。
- Workspace 工作表讀取器保留內部 `__row_number` 列號；同名的空白資料欄位不再覆寫
  帳單檢視同步所需的數字列號，避免手動銷帳回覆 `Cannot convert "" to int`。
- Phase 141／234／235 focused tests 通過；本地候選尚未部署 Apps Script／Pages，未執行正式
  帳單發送、手動銷帳、LINE 通知或任何 Sheet 寫入，真機／LIFF UAT 為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-06 — 月帳單中文狀態篩選修正（正式部署）

- 既有帳單的 `已建立`／`已開立`／`開立` 狀態現在與英文 `issued` 一致，會被自動
  月帳單 dispatcher 與房東「手動發送本月帳單」正確挑選，修正畫面有待發送帳單卻顯示
  「本月沒有可發送的帳單」的問題；已成功發送的帳單仍受 `sent_status` 防重保護。
- 補上中文狀態的 Phase 231／233 回歸測試；完整 Node suite `135/135`、Apps Script
  syntax、`npm run validate` 與 `git diff --check` 通過。
- PR #115 已合併至 `main`，merge commit `d860d041`；既有 Apps Script deployment
  更新至 Version 165，Version 164 保留作 rollback。此次未修改 GitHub Pages，未執行帳單或
  LINE 發送；唯讀 Production endpoint HTTP 200，手機／LIFF／LINE 實際收件仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-06 — Email 欄位鍵盤遮擋與 9 月帳單手動補發（local candidate）

- 系統設定頁追蹤 iOS 可視區高度；Email／文字欄位取得焦點時隱藏固定底部導覽，並
  將欄位捲到可視區中央，鍵盤收起後恢復導覽。
- 每月帳單補發不再依賴「是否有啟用逾期催繳 Workspace」來保留 dispatcher；即使
  逾期催繳全部停用，仍保留每小時觸發器供每月 5 號帳單補發使用。
- 帳單通知頁新增「手動發送本月帳單」；後端只挑選目前 Workspace、指定月份、已建立、
  未繳且 `not_sent`／`failed` 的帳單，沿用既有權限、LINE 綁定、ScriptLock、狀態寫回
  與稽核流程，已成功發送的帳單不會被此按鈕重送。
- Phase 233 focused test、Apps Script syntax、candidate route validator 與完整 Node
  suite 待本次驗證；本地候選尚未部署 Pages／Apps Script，未修改正式帳單、Trigger、
  Properties 或發送 LINE，手機／LIFF UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-06 — 房東後台新增桌面版 Email 登入入口（正式發布）

- 在 `landlord-more.html` 的「更多」頁新增醒目的「開啟桌面版」入口，開啟既有
  `landlord-entry.html` Email OTP 登入頁，不新增資料欄位或改變房東／管理團隊的
  Email 驗證流程。
- 入口使用新分頁與 `rel="noopener"`，並保留 `return_to=landlord-home.html`，讓
  Email 登入完成後回到房東首頁。
- Phase 232 static regression test 通過；PR #112 已合併至 `main`，merge commit
  `39c2b8469dd0ab76af0ccf280654d2ee12e2ffdb`，GitHub Pages workflow
  `34016014898` 成功發布。公開 `landlord-more.html` 與 `landlord-entry.html`
  read-back 均 HTTP 200 並確認新入口存在；瀏覽器點擊與 Email/session 真機 UAT
  仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。
- 此次為純 GitHub Pages 前端發布，未變更 Apps Script、Sheet、Properties、Trigger、
  LINE 或帳務資料。

## 2026-09-06 — 202 快速續約 CTA 與每月帳單通知 dispatcher（local candidate）

- 快速續約按鈕改為帶 SVG 循環圖示、到期情境副標、清楚 focus／press 狀態與
  reduced-motion 支援；不改變原本的到期條件、續約 URL 或 append-only 流程。
- 確認目前正式 Apps Script 專案的三組觸發器只有逾期催繳、合約到期與 V1
  付款同步，沒有每月帳單通知排程；畫面中的 2026-09 帳單則是已建立但未發送。
- 新增每月帳單通知 dispatcher：沿用既有每小時催繳觸發器，台北時間每月 5 號起
  補發當月 `issued`／`unpaid`／`not_sent` 帳單，成功後沿用 `sent_status`、LINE
  綁定、權限、稽核與發送紀錄，避免重複發送。此變更不自動建立帳單，避免在缺少
  本期電錶時改變既有計費規則。
- Phase 231 focused test 通過；本地候選尚未部署 Apps Script／Pages，尚未改動
  Production trigger、Properties、Sheet、LINE 或進行手機／LIFF UAT。

## 2026-09-06 — 房東收到本月帳單發送筆數摘要（local candidate）

- 每月帳單成功發給房客後，沿用既有 Workspace 團隊通知中心，通知房東／團隊本月
  實際成功發出的帳單筆數。
- 部分帳單發送失敗時，摘要會同時列出失敗筆數；通知遵守既有
  `notify_bill_created` 偏好、Workspace 隔離、通知中心與 LINE delivery log。
- 背景發送在 ScriptLock 內重新檢查 `sent_status`，並以帳單的
  `workspace_id` 解析指定 Workspace，避免重疊執行重發或誤用房東目前 active Workspace。
- LINE 批次傳送若回傳不明，帳單會標記為失敗以阻止排程自動重發；整組失敗與摘要
  失敗會計入結果，房東摘要會揭露 0 筆成功／失敗／未送出，且失敗摘要只重試原失敗收件人。
- Phase 231 回歸測試通過；Apps Script 部署與房東 LINE 實際收件仍待獨立發布授權。

## 2026-09-06 — 202 清除金額完成提示與防重送 UI 已發布

- 房東帳務頁的清除金額操作改為每個 `bill_id` 具備處理中／已完成鎖定，避免快速
  連按；寫入 API 不再自動重送，避免第一次已寫入但回應逾時時重複提交。
- 成功後顯示明確的「清除金額已完成」提示；若回應逾時，改做一次唯讀帳單讀取，
  確認已完成就提示完成，無法確認則明確告知「未再次送出」並恢復可重試狀態。
- Phase 230、validator、Apps Script syntax、完整 Node `132/132` 與
  `git diff --check` 通過；沒有寫入正式 202 或其他帳單資料。
- PR #108 merge commit `7009fcd` 已合併至 `main`；GitHub Pages workflow
  `33985625051` build／deploy／status 均成功，公開帳務頁 HTTP 200 read-back 並確認
  新完成提示、防重送與逾時唯讀確認邏輯已發布。Apps Script Version 161 不變，
  手機／LIFF UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-06 — 202 帳務折抵失敗與欠繳姓名錯誤修正重新部署

- 根因是公開頁實際引用的既有 Apps Script deployment 仍在 Version 158；前次修正
  部署到另一個未被公開頁引用的 deployment，故手機仍重現舊問題。
- 修正同 Workspace legacy duplicate `bill_id` 的帳單 view 同步：同一帳單的重複
  view rows 全部更新，跨 Workspace canonical collision 維持 fail closed。
- 欠繳頁在帳單 tenant_id 過期時，改以房東名單的同房號／房號名稱優先解析姓名，
  不再直接顯示舊的 `V2_bills.tenant_name` 快照。
- commit `b601e65`、Apps Script 54 檔案與 immutable Version 161 已部署到公開頁實際
  使用的既有 deployment；Version 158 保留 rollback，Web App URL 不變。
- 本地 Node `131/131`、syntax、source exact match 與公開 HTTP guard read-back 通過；
  未寫入 202／其他帳單資料，手機／LIFF 真機 UAT 仍待驗證。

## 2026-09-05 — 202 本月租金自動折抵與房客卡片快速續約正式部署

- 修正已建立但未繳的本月帳單：若對應合約明確記錄簽約時已收本月租金，房東
  正常送出帳務更新即可自動折抵租金；折抵不影響電費、設備耗損費、管理費與
  其他費用，既有已繳帳單仍維持鎖定。折抵說明同步保留於房東／房客可見明細。
- 合約 60 天內、30 天內或已到期的房客卡片新增「快速續約」，沿用現行合約、
  房客、房間與物件 context 進入既有 append-only 續約表單。
- PR #104 已合併至 `main`，merge commit 為 `d5c9c4e`。Apps Script 推送 54 個
  檔案並建立 immutable Version 158；公開頁使用的既有 deployment 已更新至
  Version 158，Version 157 保留 rollback，既有 Web App URL 不變。
- GitHub Pages workflow `33924128412` 已成功完成 build、status、deploy；公開
  `frontend-release.js`、房客名單、帳務頁與房客入口 read-back 均 HTTP 200，
  已發布 release marker 為 `20260905-prepaid-rent-quick-renewal-v1`。房東 API
  resilience 本地候選將 marker 推進至
  `20260906-landlord-api-resilience-v1`；此候選目前尚未部署。
- 本地完整 Node suite `92/92`、`npm run validate`（71/71 routes／handlers）、
  Apps Script syntax check、static release-cache validator 與 `git diff --check`
  均通過。未執行 Sheet migration、202 或其他房客帳單／合約資料寫入、Drive、
  Properties、Trigger 或 LINE 訊息；正式 202 帳務結果與手機／LIFF UAT 仍為
  `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-04 — 202 legacy-pending 紙本補登帳號復原正式部署

- 修正舊格式待啟用的紙本補登中，既有未綁定房客有 `V2_tenants` 資料、卻遺失
  `V2_users` 資料時無法送出的問題。只在該 `legacy_pending` 恢復分支補建同一個
  tenant 使用者，不建立第二筆房客，已綁定或其他情境仍拒絕。
- commit `378c517` 已推送 `main`；正式來源逐檔核對後，既有 Web App deployment
  更新至 Apps Script Version 156，Version 155 保留 rollback，既有 Web App URL 不變。
- GitHub Pages workflow `33886721735` 成功完成。完整 Node `120/120`、validator、
  Apps Script syntax check 與 `git diff --check` 通過；未執行 Sheet、Drive、房客／
  合約資料、Properties、Trigger 或 LINE 寫入。手機／LIFF 真機補登仍為
  `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-04 — 紙本補登手機驗證輪詢修正正式部署

- 修正手機 LIFF 開啟紙本補登頁時，因 Apps Script 302 轉址被誤判而顯示
  「房東身分驗證連線失敗」的問題；驗證狀態與續約狀態改用不帶 LINE UID 的
  JSONP 兼容通道。
- 前端 commit `884a066`、release marker
  `20260904-paper-contract-backfill-mobile-auth-v1` 已發布；GitHub Pages
  workflow `33801519730` 成功完成，公開頁 read-back HTTP 200。
- Apps Script Version 153 未變更，Version 152 保留 rollback；本次未改動
  Sheet、房客／合約資料、Drive、Properties、Trigger 或 LINE。手機／LIFF 真機
  驗證仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-03 — 紙本補登入口修正正式部署

- 修正房間仍顯示「已出租／租約中」、但有效合約已找不到對應房客資料時，
  物件／房間頁不顯示紙本補登入口的問題。
- 新增受控的孤兒合約資料修復路徑：只有同 Workspace、無對應房客且無 LINE
  綁定時才可進入；原合約保留並標記取消，新紙本租約以
  `previous_contract_id` 連結，不建立電子邀請或發送 LINE。
- PR #100 已合併至 `main`，merge commit 為 `c04ba24`。Apps Script Version 152
  已更新 Pages 所用的既有 Web App deployment，Version 151 保留 rollback，既有
  Web App URL 不變。
- GitHub Pages workflow `33694799930` 已成功完成，公開頁 read-back HTTP 200
  並確認孤兒補登入口、`orphan_recovery` 參數與紙本補登說明。
- Phase 209 runtime、Phase 214 runtime／UI、validator、Apps Script syntax
  check 與完整 Node `83/83` 均通過。未執行 Production Sheet、Drive、LINE 或
  房客資料交易；手機／LIFF 真機 UAT 仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-03 — 202 紙本轉換與房客登入入口正式部署

- PR #98 已合併至 `main`，merge commit 為 `4b9ed04`。房東可從物件／房間頁
  將同房間、同房客且尚未被認領的房東電子草稿轉為紙本補登；原電子合約與
  待認領邀請保留並標記取消，新紙本合約以 `previous_contract_id` 留下關聯。
- Apps Script Version 151 已更新 Pages 所用的既有 Web App deployment，Version
  150 保留 rollback，既有 Web App URL 不變。GitHub Pages workflow
  `33691996413` 已成功完成，公開頁 read-back 通過。
- 既有待認領房客／使用者會啟用為未綁定狀態，補登完成頁提供房客 LIFF 登入
  入口，房東可複製傳給房客；不自動發送 LINE 或建立電子邀請。未執行
  Production 資料交易；手機／LIFF 真機 UAT 仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-03 — 房東手動補登紙本合約正式部署

- PR #96 已合併至 `main`，merge commit 為 `b36ec4b`。新增房東專用
  `landlord_contract_paper_backfill` JSON POST：紙本合約檔案必填，身分證正反面
  可選填並可後補；直接建立有效／待開始租約，不建立合約申請、電子邀請、確認碼
  或 LINE 訊息。
- 物件／房間頁的空房與房客詳細資料均可進入補登頁；既有房客資料會帶入，
  新房客則建立未綁定的系統資料。伺服器以 Workspace/RBAC、房間占用、租期
  重疊、檔案驗證與冪等鍵保護寫入，紙本文件走私有 Drive 路徑。
- Apps Script Version 150 已更新既有 Web App deployment，Version 149 保留
  rollback，既有 Web App URL 不變。Additive migration 已完成，Production
  `V2_contracts` header read-back 確認兩個 `paper_backfill_*` 欄位存在，沒有變更
  合約資料列。
- Legacy Pages build `1190728482` 已完成，公開頁面 HTTP 200 並確認補登入口、
  `landlord_contract_paper_backfill` 與 cache key
  `20260903-paper-contract-backfill-v1`。
- Phase 209 runtime、Phase 210 UI、Phase 211 文件測試與 Phase 212 migration
  test 在隔離 worktree 通過。未執行 Drive 文件上傳、租客交易、Properties／Trigger
  變更或 LINE 訊息；正式手機／LIFF／Drive 驗證仍為 `HUMAN_REQUIRED` /
  `UNVERIFIED`。

## 2026-09-03 — 房東簡易新租約正式部署

- PR #94 已合併至 `main`，merge commit 為 `6302b25`；房客名單新增房東
  「建立簡易新租約」入口，簡易表單只需房號、租金、押金、起始日與租期月數。
- Apps Script Version 149 已更新既有 Web App deployment，Version 148 保留
  rollback，既有 Web App URL 不變。結束日由伺服器依租期計算，房間／Workspace
  預設費用與付款條件會補入；房客後續仍走證件上傳與簽署流程。
- GitHub Pages workflow `33656914943` 已成功發布，公開頁 read-back HTTP 200；
  cache key 為 `20260903-simple-new-lease-v1`。
- 本次沒有新增 Sheet schema、migration、既有資料寫入、Drive、Properties、
  Trigger 或 LINE 操作；本地 Node `77/77`、validator `83/83`、duplicate／
  credential scan 與 link check 全部通過。正式 LIFF／手機建立與簽署仍為
  `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-02 — 房東手動退房結算正式部署

- PR #92 已將房東手動退房結算與 Google Sheets Date 日期正規化合併到
  `main`，merge commit 為 `a2682b3`。
- Apps Script 已推送 52 個檔案，既有 Web App deployment 更新至 immutable
  Version 148；Version 147 保留為 rollback，既有 Web App URL 不變。
- 已在正式 Apps Script 編輯器完成增量 migration；試算表已建立
  `V2_checkout_settlements` 並寫入結算欄位，資料列維持空白，未改動既有
  合約、房客、帳單、Drive、Properties、Triggers 或 LINE 資料。
- GitHub Pages workflow `33648496168` 的 build、deploy、status 全部成功；
  公開頁面 read-back HTTP 200，已確認退房結算、電表起訖、兩張照片、押金
  扣除與應補繳／押金應退欄位，以及 cache key
  `20260902-landlord-checkout-settlement-v1`。
- 版本凍結驗證：Node `76/76` 通過、正式 validator `83/83` routes／handlers
  通過、duplicate declarations `0`、credential findings `0`、
  `git diff --check` 通過；`npm run validate` 因 isolated worktree 無
  `package.json` 不適用。
- 已登入 LIFF、Drive 私有上傳與 502／506 真實退房交易仍為
  `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-02 — 房東手動退房結算本地候選版（已正式部署）

- 房東手動退房新增伺服器結算：結算期間從當月 9/1 到實際退房日，含退房日；例如 9/1–9/7 為 7 天。
- 上月只帶入未繳電費與設備使用費，不重複計算上月房租；本期房租按當月日曆天數比例計算，本期電費／設備使用費按起始與退房日電表差額計算。
- 新增 append-only `V2_checkout_settlements` 快照、押金扣除說明、應補繳與押金應退；原合約與既有 `V2_bills` 不覆寫。
- 退房完成前必須透過房東驗證 session 上傳同一合約的 `checkout_start_meter` 與 `checkout_end_meter` 私有 JPG/PNG 電表照片；缺少結算或照片時 fail closed。
- 本地候選分支為 `codex/checkout-settlement-20260902`，候選程式切片 commits 為 `7285a82`、`c20c6b1`、`a472d2d`、`eec1689`、`f5d1e98`、`f7fa4ca`；另補強 Google Sheets Date 型態月份正規化、作廢帳單排除及 Workspace／月份費率回退；以上為候選階段紀錄，正式部署證據見上節。
- 另修正退房初始化與日期驗證對 Google Sheets Date 型態的處理，將原合約起始／結束日統一轉為 `YYYY-MM-DD`，避免畫面出現完整 Date 字串而被判定為無效日期。
- Phase 202／205／206／207 本地測試通過；已登入 LIFF、Drive 私有上傳、正式 Sheet schema 與真機流程仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-02 — 房東主導續約與退房正式部署

- Implemented the approved landlord-led state machine: landlord review
  automatically asks the tenant; tenant acceptance automatically creates one
  signing invite and sends its URL/code through LINE; tenant decline records a
  `tenant_declined` checkout-pending state.
- Added landlord-only checkout from the tenant detail journey. Completion is
  Workspace/session protected and idempotent, clears room/tenant/view current
  pointers, preserves original contract dates/content and operational records,
  and does not send a tenant LINE message.
- Added additive checkout fields and preserved legacy backend actions for old
  clients. Tenant renewal/termination pages no longer expose a new application
  submit flow; historical request data remains readable.
- PR #90 merged the release into GitHub `main` as `3d8647d`. Apps Script
  immutable Version 147 now serves the existing Web App deployment, with
  Version 139 retained as rollback; the Web App URL was preserved.
- The additive-only renewal/checkout schema migration completed in the
  authenticated Apps Script editor. No contract or tenant rows, Properties,
  triggers, or LINE data were changed.
- GitHub Pages workflow `33567151637` completed successfully. Public readback
  returned HTTP 200 for the six changed/release pages and confirmed cache key
  `20260902-landlord-led-renewal-checkout-v1`, checkout entry, automatic
  renewal copy, and passive tenant pages.
- Local validator and full Node suite passed (`83/83` routes and handlers;
  `73/73` tests). Authenticated LINE/mobile renewal, signing, and checkout UAT
  remain `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-02 — Expired tenant renewal recovery (formal corrective release)

- Fixed the Workspace-native landlord tenant list so an operational tenant is
  still visible when the latest contract expired before a renewal draft was
  created. The expired contract remains read-only and can be used as the
  predecessor for the manual renewal entry.
- Phase 201 covers the expired-tenant recovery boundary and confirms that a
  future active contract does not use the recovery fallback.
- PR #88 merged the repair into GitHub `main` as `272f675c`. Apps Script was
  pushed as 51 files and the existing production Web App deployment now
  serves immutable Version 146. Version 139 remains the rollback target. No
  Sheet row, contract status, Property, Trigger, LINE setting or LINE message
  was changed.
- GitHub Pages was not changed because the tenant-detail renewal entry was
  already present in the current public frontend; its authenticated readback
  remains separate from this backend release.
- Local verification passed: worktree validation with the authoritative 83
  route inventory, full Node suite `70/70`, Apps Script syntax checks and
  `git diff --check`. The outer `npm run validate` package still carries the
  stale expected-route value `71` and was not used as the release gate.
- Authenticated 502 landlord-list/detail readback and LINE/mobile renewal UAT
  remain `HUMAN_REQUIRED`. If the canonical tenant, room or contract rows are
  absent rather than merely hidden by the expired-contract filter, a separate
  data-recovery operation still requires exact target verification.

## 2026-09-02 — Preserve predecessor fees in renewal prefill (formal corrective release)

- Fixed the `從此合約發起續約` room-warning action so the renewal form keeps
  the predecessor rent, management fee, deposit months, deposit amount,
  payment day, electricity fee rate, equipment loss fee rate, optional 30-day
  clause, and note.
- The backend room summary now includes the predecessor contract's fee fields;
  the frontend also prefers the complete `renewal_source` before that summary.
  This fixes the case where the form switched to renewal mode but displayed
  blank or zero fee inputs.
- PR #86 merged the fix into GitHub `main` as `72542bc`. Apps Script immutable
  Version 145 now serves the existing Web App deployment, with Version 139
  retained as rollback. No Sheet, contract row, Property, Trigger, LINE
  setting, or manual migration was changed.
- GitHub Pages workflow `33555883954` completed successfully. Public readback
  returned HTTP 200 and confirmed cache key
  `20260902-renewal-date-prefill-v2` and the fee-prefill logic.
- Local verification passed: full Node suite `69/69`, project validation
  `71/71` routes and handlers, Apps Script syntax checks, and `git diff --check`.
- Authenticated LINE/mobile contract acceptance remains `HUMAN_REQUIRED`.

## 2026-09-02 — Renewal date prefill (formal release)

- Changed renewal defaults so the new lease starts on the predecessor contract
  end date itself, then runs for one year using the existing inclusive date
  rule (`start date + one year - one day`).
- Updated the renewal form to use the same date rule when it applies the old
  contract snapshot, removing the extra one-day offset. Other renewal fields
  and manual date editing remain unchanged.
- Phase 174 and new Phase 200 cover the backend default and renewal-form
  prefill. PR #83 merged the release into GitHub `main` as `52d4175`.
- Apps Script was pushed as 51 source files and the existing public Web App
  deployment was updated to immutable Version 144. The Web App URL was
  preserved and Version 139 remains the rollback target. No Script Properties,
  Trigger, LINE setting, contract row, or manual Sheet migration was changed.
- GitHub Pages workflow `33553714995` completed build, deploy and status jobs.
  Public readback returned HTTP 200 and confirmed cache key
  `20260902-renewal-date-prefill-v1`, the direct renewal entry, and the
  predecessor-end-date prefill logic.
- Local verification passed: full Node suite `69/69`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, Apps Script syntax checks, and `git diff --check`.
- Exact production Sheet header state and authenticated LINE/mobile contract
  acceptance remain `HUMAN_REQUIRED`.

## 2026-09-02 — Tenant-detail direct renewal signing (formal release)

- Moved the primary renewal entry to the tenant journey: tenant list → tenant
  detail → contract version → `發起續約`. Each eligible predecessor version
  passes its own `contract_id` into the one-page renewal form, while the
  contract request page remains focused on draft review, invitation and
  signing status handling.
- Added `landlord_contract_initiate_renewal_direct` for the short manual path:
  the landlord fills one renewal form, optionally selects the 30-calendar-day
  non-renewal clause, and receives a tenant signing invite immediately.
- Active, expired, approved and completed predecessors are eligible. The old
  contract remains append-only and is archived only after the tenant signs and
  the landlord approves the new version.
- Reused the fixed Google Docs contract version (`fixed-google-doc-template-1`)
  and added the renewal fields to the additive contract-schema guard so the
  selected clause is persisted and shown in the tenant document.
- The tenant invite flow now preserves `renewal` mode and requires signature
  only; the existing multi-step landlord-review/tenant-inquiry route remains
  available for already-created renewal drafts.
- PR #81 merged the release into GitHub `main` as `938b39d`.
- Apps Script was pushed as 51 source files and the existing public Web App
  deployment was updated to immutable Version 143. The Web App URL was
  preserved and Version 139 remains the rollback target. No Script Properties,
  Trigger, LINE setting, or contract row was changed; no manual Sheet
  migration was run. The deployed code keeps the additive header guard for the
  new renewal fields.
- GitHub Pages workflow `33547890200` completed build, deploy and status jobs
  for the merged commit. Public readback returned HTTP 200 for the tenant
  detail, renewal form, request review page and release asset; the new entry,
  direct route, special-offer clause and new release key were present.
- Local verification passed: full Node suite `68/68`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, Apps Script syntax checks, and `git diff --check`.
- Exact production Sheet header state and authenticated LINE/mobile signing
  acceptance remain `HUMAN_REQUIRED`; public readback and the anonymous
  POST-only API guard do not prove a logged-in contract transaction.

## 2026-09-01 — Landlord homepage timeout corrective release

- Reused the request-local runtime snapshot in landlord payment/message reads,
  removing duplicate Google Sheets reads during `landlord_home_bootstrap`.
- Added Phase 197 regression coverage for the read-cache boundary. No contract,
  billing, Sheet row, Property, Trigger, or LINE data was changed.
- PR #79 merged the repair as `d9c371c`; Apps Script immutable Version 142 now
  serves the existing fixed Web App deployment and Pages workflow
  `33483720012` completed successfully.
- Public page/API readback passed. Authenticated LINE/mobile dashboard UAT
  remains `HUMAN_REQUIRED`.

## 2026-09-01 — Landlord-led renewal consent flow (formal release)

- Changed expiry renewals to a landlord-led sequence: the system prepares a
  one-year draft from the prior contract, the landlord reviews dates, amounts,
  payment day and the optional 30-day non-renewal offer, then sends a tenant
  inquiry.
- Tenants can no longer submit a renewal through the legacy request route. They
  can only accept or decline a reviewed landlord inquiry; only an accepted
  response enables the landlord to create the signing invitation.
- Added additive lifecycle columns for inquiry and tenant intent. Existing
  contract versions remain append-only, and the unsigned draft remains editable
  until review confirmation.
- PR #76 merged the feature as `52b75b8`; PR #77 moved the 36 production HTML
  API references to the new fixed Apps Script Version 140 deployment and
  merged as `ceeede8`. Pages workflow `33456765735` completed successfully.
- Public HTML and read-only API smoke passed. No Sheet migration, LINE push,
  or contract-data write was run; authenticated LINE/mobile UAT remains
  `HUMAN_REQUIRED`.

## 2026-09-01 — Renewal draft date correction (formal release)

- Added `landlord_contract_renewal_draft_update`, a Workspace-scoped POST
  action that permits a landlord to change only the start and end dates of an
  unsigned `pending_landlord_review` renewal draft.
- The server validates strict ISO dates, regenerates the complete contract
  text, and keeps the predecessor unchanged. After an invite is created, the
  draft cannot be overwritten; a new correction renewal version is required.
- Added the landlord review-page `修改續約日期` action and guidance for
  manual-signing date errors: cancel an unclaimed invite and recreate it, or
  start a new correction renewal for an already signed contract.
- PR #74 merged the change into `main` as `3f6af936`. Apps Script Version 139
  was deployed on the existing Web App deployment, with Version 138 retained
  as rollback. GitHub Pages workflow `33449180375` completed successfully.
- Local suite `64/64` and project validation passed. Public routing/page
  readback passed. Real authenticated LINE/mobile date-edit acceptance remains
  `HUMAN_REQUIRED`; no contract data was changed by this release.

## 2026-08-28 — Native landlord contract-history route repair (formal corrective release)

- Fixed the Workspace-native `landlord_tenants` read model used by the serving
  dispatcher so it returns the same sanitized, read-only `contract_history` as
  the legacy landlord tenant-list handler.
- This restores the existing room-603 contract entry without recreating,
  deleting, or modifying `V2_contracts` rows. Phase 177 reproduces the serving
  route and preserves the append-only history projection.
- PR #59 merged the route repair into `main`; PRs #60–#62 completed the
  landlord tenant-detail history-card rendering helpers. Apps Script Version
  131 was deployed on the existing Web App deployment, preserving the existing
  Web App URL. No schema or tenant-data migration was run for this repair.
- GitHub Pages workflow `33099332347` completed successfully for merged
  `main` commit `7711dea`. Public room-603 smoke readback rendered the history
  card and `查看完整合約與簽名`, with no page error card or browser console
  errors. Real authenticated LINE/mobile signing acceptance remains
  `HUMAN_REQUIRED`.

## 2026-08-27 — Renewal contract history and 30-day offer (formal release)

- Added append-only renewal versions for existing tenants. Each renewal gets a
  new contract ID and links to its predecessor while retaining all prior
  contract snapshots and document/signature references.
- Renewal defaults carry rent, management fee, deposit, other fixed fees,
  payment day, terms, and a one-year period from the day after expiry. Renewal
  identity uploads are optional and reuse existing immutable document
  references when omitted; a new renewal signature remains required.
- Added the 30-calendar-day expiry non-renewal offer. Meeting the threshold
  waives the penalty; a shorter notice is routed to landlord review without an
  automatic charge or waiver. Early termination remains unchanged.
- Added landlord and tenant contract-history UI. The landlord's selected
  version can load a complete contract/signature view in read-only mode.
- Added the explicit additive-only `runV2ContractRenewalHistoryProductionMigration`
  runner. It appends only missing renewal/request/document headers and is
  idempotent; it does not delete or rewrite historical contracts.
- Apps Script was deployed as immutable Version 130 on the existing Web App
  deployment; the existing Web App URL was preserved. The additive schema
  migration was executed twice from the authenticated Apps Script editor and
  both executions completed successfully, proving the runner is idempotent.
- GitHub PR #56 merged the release into `main` as `7452416`. GitHub Pages
  workflow `33054940344` completed build, deploy, and status-report jobs, and
  public readback found the landlord contract-history entry and
  `查看完整合約與簽名`.
- Local Phase 174–176 tests and the full Node suite pass (`55 pass, 0 fail`);
  the candidate validator passes all `83/83` routes and handlers with zero
  duplicate declarations and zero credential findings.
- Authenticated real LINE/mobile room-603 UAT remains `HUMAN_REQUIRED` and is
  not implied by this release.

## 2026-08-25 — Deploy fixed-template tenant signature preview

- Deployed the fixed Google Docs template signing path to Apps Script Version
  125 on the existing Web App deployment. The signed copy remains private and
  the original fixed template is unchanged.
- The tenant mobile preview now renders the stored handwritten signature image
  after submission, while the backend continues to source it from the private
  stored artifact and signed document record.
- Bumped the tenant entry release asset and added versioned script URLs to bust
  stale LIFF/Pages caches. GitHub Pages workflow `32793428257` completed
  successfully for commit `9e18425`.
- Local tests and public static readback passed. Authenticated real LINE/mobile
  room-603 acceptance remains unverified and is not implied by this release.

## 2026-08-25 — Restore supplied Google Docs fixed contract template (local candidate)

- Replaced the generated standard-contract fallback in the tenant signing
  preview and landlord review view with the configured fixed Google Docs
  template and canonical placeholder substitution.
- Submission now copies the fixed document, supports the supplied text-based
  `乙方簽名（線上簽署）` slot as well as an image slot, promotes the supplied
  pending-signature evidence, and records the signed copy in the document
  signing schema.
- Phase 168 and the full local suite pass. This remains a local candidate; no
  Apps Script deployment, Script Properties update, Drive-folder migration,
  GitHub Pages publication, or real LINE/mobile acceptance occurred.

## 2026-08-16 — Landlord-initiated new lease and renewal signing (local candidate)

- Added the approved landlord-first contract flow in an isolated local branch:
  new vacant-room contracts may start with blank tenant prefill data, while
  renewals are started from the current active contract and link a new version
  to its predecessor.
- Added one-time invite claiming with LINE identity verification, tenant name
  and Taiwan mobile completion, private identity-artifact requirements for new
  tenants, signature-only renewal signing, and landlord-only approval as the
  activation boundary.
- Added landlord and tenant mobile UI entry points, short POST/JSONP exchanges,
  ScriptLock-protected writes, activation view synchronization, and focused
  Phase 157–159 regression tests.
- This is a local implementation candidate only. No Apps Script deployment,
  GitHub Pages publication, Production Spreadsheet/Properties/trigger change,
  LINE/LIFF configuration change, or real message send occurred.

## 2026-08-13 — Payment write timeout recovery (local candidate)

- Added client-side authoritative-state recovery for landlord payment-report
  confirmation and manual bill settlement when the write JSONP response times
  out after the backend may already have committed the Sheet changes.
- Recovery never resubmits the write; it confirms `confirmed` payment reports or
  settled/removed arrears records before showing success.
- Phase 147 covers the recovery paths. This candidate was not deployed or
  verified against Production.

## 2026-08-12 — Phase 147 tenant identity release and Production identity check

- PR #23 merged the Phase 147 tenant test-identity migration into GitHub
  `main` as `0bbbe06e`.
- GitHub Pages workflow `31601674513` completed successfully; the four tenant
  pages were fetched from the public Pages origin and retained formal LIFF
  initialization and the Phase 146 payment gateway.
- A read-only Apps Script check identified the authenticated project and active
  Web App Version 102. The file inventory matched GitHub `main` by normalized
  filename count only; no byte-level source export or rollback identification
  was performed.
- No Apps Script, Sheets, Properties, triggers, LINE, LIFF configuration, or
  payment data was changed by this release.

## 2026-07-30 — Version 87 source reconciliation closed

- PR #6 merged the retained legacy signed-contract sync bridge and its focused
  regression test into GitHub `main` as `ae2961d`.
- A minimal final comparison found current `main` source-equivalent to the
  immutable serving Version 87 export: the remaining reminder difference is
  comment/format only and `appsscript.json` is semantically equivalent JSON.
- `GATE_0=PASS` is restored for current serving-source reconciliation and
  `V2_INTERNAL_BETA_BASELINE=Version87` is recorded.
- No Apps Script deployment, GitHub Pages publication, Production data or
  configuration change, LINE/LIFF change, or manual message send occurred.

## 2026-07-30 — Serving Version 87 source-reconciliation hold

- Read-only deployment metadata and immutable source export verified that the
  serving Apps Script release is Version 87, with Version 85 retained as its
  rollback reference.
- Focused source reconciliation confirmed that four previously flagged files
  are byte-identical to `main`; the remaining reminder and manifest changes
  are non-executing comments, whitespace, and JSON key order.
- `GATE_0=PASS` for Production Consolidation. This records source-equivalence
  only; it does not authorize an Apps Script deployment, GitHub Pages
  publication, Production data or configuration change, LINE/LIFF change, or
  manual message send.

## 2026-07-29 — Unpublished V2.1 native signing foundation

- Added verified LIFF signing-session and private contract-artifact foundations
  to an isolated local branch only; no Apps Script deployment or Production
  data/configuration action occurred.
- Server-side principal resolution and backend-derived `signing_mode` control
  the permitted artifacts. Normal renewal is signature-only; missing mode or
  missing artifact schema fail closed.
- Added a server-verified signing-submission action. It requires consent and
  the mode-specific stored artifacts, records only explicit signing-audit
  fields, preserves `contract_status`, and fails closed without the required
  schema. It does not simulate approval, activation, or completed contract
  status.
- Added the corresponding isolated local `tenant-contract.html` signing UI:
  server-derived summary and terms, conditional new-tenant identity uploads,
  signature capture, consent, and submitted-for-review state. Renewal renders
  no identity upload flow. No frontend publication or Production action
  occurred.

## 2026-07-29 — Gate 0 canonical baseline formalization

- GitHub PR #3 merged the immutable Apps Script Version 85 source snapshot,
  manifest, and API route inventory into `main`.
- Version 85 is recorded as the V2 internal-beta canonical backend baseline;
  Version 75 is the verified immutable Apps Script rollback reference.
- Production evidence was collected read-only: serving deployment identity,
  Properties key presence, trigger inventory, and Google Sheets schema headers.
- No deployment, GitHub Pages publication, Production data change, trigger
  change, Property change, LINE/LIFF change, or manual message send occurred.

## 2026-07-29 — Product-memory consolidation

- Recorded authoritative V2/V3/V4 boundaries, BYO LINE OA ownership, standard
  branding, no functional customization, and the V2 performance priorities.
- Added a new-conversation handoff contract and release-safety rules.
