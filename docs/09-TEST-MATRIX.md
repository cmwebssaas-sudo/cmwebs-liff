# V2 回歸測試矩陣

## 2026-09-23 正式 Workspace 房間中心（已發布，Version 192）

- [x] 新增 `landlord_room_center_init` 唯讀路由，依登入房東的 Workspace
  scope 回傳全部房間；房間中心預設要求包含已封存房間，前端可再篩選。
- [x] 後端使用明確 allowlist projection，不回傳房客、租約、帳單、押金、
  付款帳戶、物件所有人或報修資料；桌面 Email 走既有 POST bridge，手機 LINE
  走既有 JSONP read path。
- [x] 房間中心加入正式站入口、搜尋與所有／啟用／空房／已出租／已封存篩選，
  不使用 staging Workspace 或測試房間資料。
- [x] `tests/room-center-production.test.mjs`、新 Apps Script 全檔
  `node --check` 通過。
- [x] Apps Script Version 192 已部署至原正式 Web App deployment slot，Version
  191 保留 rollback；GitHub Pages workflow `35799969425` 以 PR #175 merge
  commit `d01d2253` 成功發布，`landlord-rooms.html` HTTP 200。
- [x] 正式登入回讀確認目前正式 Workspace 顯示 22 間房；包含 101、201、202、
  203、301、302、303、305、306、401、402、403、405、406、501、502、503、
  505、506、601、602、603。頁面只顯示房間營運資料，沒有房客個資、租約或帳務。
- [x] 初版逾時根因已回歸覆蓋：房間頁必須把 `apiUrl: API_URL` 與
  `lineUserId: LINE_USER_ID` 傳給共用 API client；否則 JSONP 會回到 Pages 文件並
  造成 `Unexpected token '<'`。`tests/room-center-production.test.mjs` 已鎖定此契約。
- [x] `npm run verify:production -- --live` 通過，12 個公開資產與 checkout
  逐位元組一致；正式頁不使用 staging Workspace 或測試房間資料。
- [ ] 正式 Workspace 登入後全房間數量回讀與手機／桌面 UAT：
  `HUMAN_REQUIRED`／`UNVERIFIED`。rollback target 為 Pages 上一個 verified
  commit `dce1f02` 與 Apps Script Version 190；本功能只讀，不涉及 Sheets
  migration 或資料列寫入。

## 2026-09-23 房間導覽與 z3House 公開房源卡片候選（未部署）

- [x] 所有房東頁面的手機底部導覽保留首頁、欠款、房客、房間、更多五個入口；
  房間中心本身標示為目前頁面。
- [x] 房間卡片可安全呈現後端提供的 z3House 綁定狀態、公開縮圖與獨立站連結；
  只接受 HTTPS URL，外部連結使用 `noopener noreferrer`。
- [x] 未綁定房間顯示「尚未連結 z3House」，不產生假 listing ID、假 URL 或瀏覽器端
  z3House API 呼叫；新房東可先使用 CMWebs 房間資料。
- [x] `tests/phase262-room-nav-z3house-card.test.mjs`、
  `node --check apps-script/V2_LANDLORD_ROOM_CENTER.js` 通過。
- [ ] z3House server-to-server provisioning/binding API、實際 bridge sheets、
  authenticated staging UAT、所有正式 Workspace 房間回讀與正式部署：
  `UNVERIFIED`／尚未授權部署。本候選沒有寫入正式 Sheets、沒有部署 Apps Script
  或 GitHub Pages，也沒有修改 z3House 專案。

## 2026-09-23 z3House 公開房源事件橋接候選（未部署）

- [x] `z3house_listing_event` 僅走 Apps Script POST dispatcher，使用
  `CMWEBS_Z3HOUSE_BRIDGE_HMAC_SECRET`、timestamp、nonce、event_id 與 raw-body
  HMAC；沒有瀏覽器直連 z3House API。
- [x] 只接受公開房源 allowlist，先驗證 `workspace_id + room_id` 屬於既有
  CMWebs Workspace；unknown 欄位與不允許的個人／營運欄位 fail closed。
- [x] `listing.snapshot`、`publication.hidden`、`binding.unbound` 都以
  `V3_listing_integration_events` 保存 payload hash；相同 event/body 冪等，
  event ID 衝突與 nonce replay 拒絕。
- [x] 下架／解除綁定只標記公開渠道或 binding 狀態，不刪除 CMWebs 房間；
  不保存 raw payload。
- [x] `tests/phase263-z3house-bridge-contract.test.mjs`、橋接檔與 dispatcher
  `node --check`、`npm run validate`、`git diff --check` 應在提交前通過。
- [ ] 尚未建立正式 Script Property、尚未修改正式 Google Sheets、尚未提供
  z3House server-to-server provisioning API、尚未部署或做 authenticated staging
  UAT；狀態為 `UNVERIFIED`／`HUMAN_REQUIRED`。

## 2026-09-18 作廢帳單成功提示（本地候選）

- [x] 作廢測試帳單成功後，欠款頁顯示獨立的「作廢成功」提示，包含帳單 ID。
- [x] 成功提示說明帳單已封存，重新整理後不會再列入欠款清單；提示不會被欠款清單重繪覆蓋，並可由房東關閉。
- [x] 成功提示使用 `role="status"` 與 `aria-live="polite"`，並由 `tests/test-bill-archive.test.mjs` 靜態回歸鎖定。
- [x] PR #171 merge commit `31515af` 已發布；Pages workflow `35344387333` 成功，公開欠款頁 HTTP 200 read-back 已確認提示節點與文字已服務。
- [ ] 仍需由已登入房東在手機／桌面實際作廢一次測試帳單並確認提示可見；狀態為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-18 一次性測試帳單作廢／封存正式發布

- [x] 已新增 `landlord_bill_test_archive_candidates` 唯讀候選查詢；主
  `landlord_arrears` 快速路徑維持只讀取物件與帳單，候選查詢才讀取房間狀態。
- [x] 已新增 `landlord_bill_test_archive`；後端重新驗證 Workspace、房間帳號
  已關閉、帳單未付款且無付款紀錄，沿用共用取消核心服務，不建立付款、不發送
  LINE、不刪除資料，並寫入 Workspace 操作稽核。
- [x] 已加入封存按鈕、冪等已封存回應、純函式／靜態回歸測試；本地 focused
  tests 通過，正式 Sheet、登入後欠款頁與一次性操作仍待 authenticated UAT。
- [x] PR #169 merge commit `257093b6b03838275342d67944ce6988edf57d3b` 已合併至
  `main`；Apps Script Version `190` 已更新既有正式 Web App，Version `189` 保留 rollback。
- [x] GitHub Pages workflow `35339276140` 的 build、deploy、status jobs 全部成功；公開
  `landlord-arrears.html` HTTP 200 read-back 已確認封存按鈕與兩個新 route 已發布。
- [x] Version 190 唯讀匯出 58 個檔案與候選 `apps-script/` 逐檔一致；本次未修改正式
  Google Sheets 業務資料列、Drive、Properties、Trigger 或 LINE。
- [ ] 登入後欠款頁的真實房東一次性操作、手機／LIFF UAT；狀態仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-15 房間報修工單 Task 6 本地 release-boundary record

- [x] Implementation source candidate is
  `3b12c617216040974700fa6b3238db2e9652f310` (`3b12c61`), the verified Task 5
  code/UI commit. The separate Task 6 documentation/release-verification
  record is `73ad047ffde25ee636e197b37360b70e8fc8129f` (`73ad047`), a
  documentation-only child commit. Neither value is the fix-round commit for
  this correction; the documentation record remains local and has not been
  deployed, pushed, merged, or reconciled against live Apps Script or Google
  Sheets.
- [x] Focused repair-ticket command passed `26/26`: contract, runtime/RBAC,
  migration idempotency/preview, and tenant/landlord privacy UI tests.
- [x] `npm run validate` passed: `57` backend files parsed, `37` endpoint
  references matched, and static release-cache validation passed.
- [x] Required Apps Script syntax checks passed for the six specified files:
  `V2_REPAIR_TICKETS.js`, `V2_TENANT_MESSAGES.js`,
  `V2_LANDLORD_MANAGEMENT.js`, `V2_WORKSPACE_LANDLORD_ACCESS.js`,
  `V2_RUNTIME_SNAPSHOT.js`, and `程式碼.js`.
- [ ] Full `npm test` is not green at this baseline: `242` tests ran, `240`
  passed and `2` failed. The failures are
  `tests/landlord-post-read-snapshot.test.mjs` (expected `true`, got
  `undefined`) and `tests/phase246-landlord-post-read-bridge.test.mjs`
  (`landlord_arrears` expected `htmlBridgeOutput_` / `bridge`, got `fallback`).
  They are pre-existing baseline failures in landlord POST/read bridge coverage;
  no evidence attributes either failure to repair-ticket changes.
- [x] Repair-ticket tests assert server-side Workspace/tenant filtering,
  allowlisted projections, POST-only bridge transport, append-only event
  history, source-message idempotency, and preview no-write behavior.
- [ ] Authenticated landlord Email session, authenticated tenant LIFF session,
  real Tenant A/B room-transfer privacy validation, actual bridge origin/live
  update feedback, and actual Apps Script preview plus backup/header/row-count
  reconciliation remain `HUMAN_REQUIRED` / `UNVERIFIED`.
- [x] No migration apply, deployment, Google Sheets change, LINE send, push,
  merge, or authenticated external-service action was performed. Local checks
  must not be reported as Production readiness.
- [x] Rollback boundary: revert or disable the repair API/UI caller (including
  the tenant route or optional room summary) and retain all append-only repair
  ticket/event rows plus legacy message rows. Do not delete or rewrite history.

## 2026-09-13 桌面房客詳細／合約 Email 唯讀 session 修正（已部署）

- [x] 房客詳細頁載入共用桌面 responsive shell，桌面寬度顯示側欄與桌面主內容，不再以手機底部導覽殼層呈現。
- [x] 原生簽署審核與房東發起合約的唯讀初始化改用共用 session resolver；有效 Email session 可讀取，合約寫入仍不接受 Email fallback。
- [x] 新增 Phase 259 靜態／runtime 回歸測試；完整 Node suite `131/131`、Apps Script 全檔語法、房客詳細頁 inline JS、static release-cache validator 與 `git diff --check` 通過。
- [x] merge commit `662e20ad1f350da1d8fd71a129c1faf7a16aa1e9` 已推送至 `main`；GitHub Pages workflow `34709094999` 成功，公開房客詳細與合約頁 read-back 已確認新程式已發布。
- [x] 正式 Apps Script 專案與候選來源唯讀比對僅有本次 3 個後端檔案差異；已更新前端實際使用的既有 Web App 至 Production Version `187`，原 Version `160` 保留為 rollback。
- [ ] `npm run validate` 未列為通過：乾淨 `main` 沒有 `package.json`；根目錄舊 validator 另以過期的 71 條 route 預期檢查 88 條 route，並誤判 `tenant_payment_account_cover` 首層 handler。此為既有檢查器基線限制，未以它冒充 release pass。
- [ ] 正式 Chrome／Email／LINE 真實點擊驗收；狀態仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-13 房東桌面 Email 詳細／合約讀取路由修正（已部署）

- [x] 房客詳細與帳款頁改由共用 `landlord-auth.js`／`landlord-api.js` 啟動；桌面 Email session
  會走已驗證的 hidden POST bridge，不再把受保護讀取誤送到 LINE LIFF。
- [x] 合約頁的原生簽署審核與房東發起合約兩個唯讀清單沿用既有 Email session token；桌面 Email
  仍對尚未支援的寫入操作保留 `DESKTOP_EMAIL_UNSUPPORTED` fail-closed 行為。
- [x] 新增 Phase 258 回歸測試；完整 Node suite `207/207`、`npm run validate`、static
  release-cache validator、`node --check` 與 `git diff --check` 通過。
- [x] 已合併至 `main`，merge commit `2b39136c016ee1592536c70f4ad69f41683fee6a`；GitHub Pages
  workflow `34706637008` 成功，公開房客詳細、帳款與合約頁 read-back 已確認新程式已發布。
- [ ] 已登入 Chrome 實際點擊房客詳細、帳款查看房客與合約清單；狀態仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-12 房東退房欄位 iOS 自動放大修正（已部署）

- [x] 退房頁 `input`／`textarea`／`select` 明確使用 `16px`，避免 iOS 聚焦時自動放大並讓欄位跳離視窗。
- [x] 檔案欄位不再使用小於 `16px` 的字級；原有 `visualViewport` 鍵盤避讓與焦點捲動邏輯保留。
- [x] Phase 257 通過；完整 Node suite `206/206`、`npm run validate` 與 `git diff --check` 通過。
- [x] PR #161 已合併至 `main`，merge commit `d3ed41b7efda071978943f55167cadaa0b72b04a`。
- [x] GitHub Pages workflow `34700989635` 成功；公開退房頁 HTTP 200 read-back 已確認 `16px` 規則已發布，
  前一個已驗證提交 `c2cbf9238ecd1e7d79fe0911ffc96b4d98857544` 為 rollback target。
- [ ] 真實 iPhone／LINE LIFF 欄位操作；狀態為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-12 房東退房鍵盤遮罩修正（已部署）

- [x] 鍵盤開啟時退房頁收起不必要的底部安全間距，並以 visualViewport 可視範圍重新校正目前焦點欄位。
- [x] 手動退房的押金扣除說明、點交備註與完整電表欄位沿用同一套焦點可視化處理。
- [x] Phase 255 更新／Phase 256 通過；完整 Node suite 205/205、Apps Script syntax、
  inline JavaScript syntax、npm run validate、static release-cache validator 與
  git diff --check 通過。
- [x] PR #159 已合併至 `main`，merge commit `5d8eeb97dc5f8d505e355b75f28913fd36aecba1`。
- [x] GitHub Pages workflow `34697177348` 成功，公開退房頁 HTTP 200 read-back 已確認
  鍵盤可視性修正已發布；前一個已驗證提交 `fb80e0de398f2a910d927be3713049b2aa311232`
  為 rollback target。
- [ ] 真實 iPhone／LINE LIFF 欄位操作；狀態為 HUMAN_REQUIRED／UNVERIFIED。

## 2026-09-11 房東退房快速結案（已部署）

- [x] 快速結案不要求電表讀數或照片，使用房東輸入的手動應收金額與實際退款金額完成最終結算。
- [x] 伺服器驗證押金上限、押金扣除說明與冪等鍵；完整電表結算流程保留。
- [x] Phase 252／253／254 通過；完整 Node suite `203/203`、Apps Script syntax、static
  release-cache validator 與 `git diff --check` 通過。
- [x] PR #155 merge commit `6fa0bba63f4b0a07bd72b2d2bf8dfb061869dc92` 已合併；Apps Script
  Production Version 186 已部署至既有 Web App，Version 185 保留 rollback；必要的
  `runV2CheckoutSettlementProductionMigration` 已在已登入 Apps Script 編輯器執行完畢。
- [x] GitHub Pages workflow `34598441945` 成功；公開房東頁與退房頁 read-back HTTP 200，
  新 marker、快速結案欄位與「處理中，請勿重複按」均已確認。
- [ ] 真實房東帳號手機／Chrome／LIFF 退房操作與實際資料結果；狀態為
  `HUMAN_REQUIRED`／`UNVERIFIED`，未執行真實退房交易。

## 2026-09-18 快速結案同步退房帳務（已部署）

- [x] 快速結案將同一 Workspace／房客／房間／合約範圍內的未繳 `V2_bills` 更新為
  `payment_status=paid`，已繳帳單與其他合約帳單不受影響。
- [x] 同步帳單不改原始金額、不建立虛假 `V2_payments`；重送相同 idempotency key
  不重複處理，並回傳已同步帳單數量／ID。
- [x] PR #167 merge commit `4069e6fd0523a3c5f3d5caf307a5a76c4155c6a6`、GitHub Pages
  workflow `35326158352` 與 Apps Script immutable Version 189 已完成；Version 188 為 rollback。
- [ ] 正式房東登入、手機／LINE 退房操作與實際帳單結果；狀態為
  `HUMAN_REQUIRED`／`UNVERIFIED`，未執行真實退款或業務資料寫入。

## 2026-09-11 房東桌面版手機分享網址（已部署）

- [x] 「更多功能 → 開啟桌面版」開啟分享面板，不再直接導覽。
- [x] 面板顯示不含 session 的固定 Email 登入網址，支援複製與手機系統分享。
- [x] Phase 232／250／251 focused tests 通過；Email mode 仍在 LINE 初始化前分流。
- [x] PR #153 已合併；GitHub Pages workflow `34584013793` 成功，公開分享面板與 Email
  mode 入口 read-back HTTP 200，舊直接跳轉 anchor 已移除。
- [ ] 真實手機分享網址後在電腦開啟、Email OTP 登入與回到房東首頁；狀態為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-11 房東桌面入口 Email mode 分流（本地候選）

- [x] 「更多功能 → 開啟桌面版」連結明確帶 `mode=email` 與安全 `return_to`。
- [x] `landlord-entry.html` 在 Email mode 先顯示 Email OTP，不初始化手機 LINE session。
- [x] 一般 LINE 入口與主動「使用 LINE 登入」分支維持原流程。
- [x] Phase 232 更新、Phase 250 新增回歸測試均通過。
- [ ] 推送、合併、GitHub Pages 發布與公開 read-back。
- [ ] 真實手機 LINE WebView 點擊桌面版、桌面 Email OTP 登入與返回首頁；狀態為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-10 房東共用腳本快取版本修正（已部署）

- [x] 房東頁面的 `frontend-release.js`、`landlord-auth.js` 與 `landlord-api.js` 使用
  同一個固定 cache-busted marker `20260910-landlord-read-bridge-v2`。
- [x] `tests/phase249-landlord-shared-script-cache-bust.test.mjs` 通過，確認所有房東頁
  不會再以未版本化網址載入共用登入／API 腳本。
- [x] `npm run validate` 通過；`git diff --check` 通過。
- [x] 完整 Node suite `198/198` 通過；Phase 209 測試使用固定測試時間，避免日期漂移。
- [x] PR #150 merge commit `2cc882a33654e8d027cbce3514170c450374a9e1` 已合併；GitHub
  Pages workflow `34423919614` 成功，公開新 marker HTML／共用腳本 read-back 通過。
- [ ] 已登入 Chrome／手機重新登入後驗證首頁、圖表、房客、物件、合約、帳款及側欄
  Workspace／角色狀態；仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-10 房東桌面多頁 POST bridge 逾時修正（已部署）

- [x] `doPost` 對帳款、合約唯讀初始化、通知、付款回報、營收圖表、Workspace context
  與手動銷帳狀態查詢回傳 hidden iframe bridge response，並沿用 server-side principal
  verification。
- [x] 桌面帳款／合約頁允許唯讀初始化；人工銷帳、合約申請異動與其他寫入仍被
  `DESKTOP_EMAIL_UNSUPPORTED` 保護。
- [x] `landlord_bill_manual_settlement_status` 納入 request-local read snapshot 與
  shared read retry/dedupe action allowlist。
- [x] `tests/phase246-landlord-post-read-bridge.test.mjs` 通過；完整 Node `195/195`、
  Apps Script 全檔 syntax、static release-cache validator、`git diff --check` 通過。
- [x] PR #147 merge commit `f72cfee37013fe3952445d32ed41ceac757cf72c`；Apps Script
  Version 183 已部署至既有 Web App deployment，Version 182 保留 rollback；Pages
  workflow `34410925756` 成功。
- [ ] 已登入 Chrome／Email session 實際驗證總覽圖表、全部側欄頁面、Workspace／角色
  狀態；仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-09 桌面版首頁 API 逾時後續修正（已部署）

- [x] Read-only Web App actions skip repeated schema mutation checks；寫入路徑仍保留 schema protection。
- [x] Workspace row helper、Email auth rows、Workspace access resolution 共用單次 request snapshot/cache，避免同一個 Email bridge request 重複掃描相同資料。
- [x] `tests/phase243-landlord-request-cache.test.mjs` 通過。
- [x] 完整 Node suite `191/191` 通過；Apps Script syntax、static release-cache validator、`git diff --check` 通過。
- [x] Apps Script immutable Version 181 已部署到既有 Web App deployment；Version 180 保留為 rollback，Web App URL 不變。
- [x] 公開 `landlord-home.html` read-back HTTP 200，仍指向目前正式 API；未登入 read-back 未寫入資料。
- [ ] 已登入桌面版／手機 LIFF 首頁與房客頁實機驗收；仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-09 桌面版 landlord API 讀取逾時修正（已部署）

- [x] `landlord_home_bootstrap` 與 `landlord_tenants` 共用同一個 request-local
  Sheet snapshot，避免同一個 API request 重複掃描相同工作表。
- [x] `landlord-read-snapshot-regression.test.mjs` 通過；完整 Node suite
  `190/190` 通過；`git diff --check` 通過。
- [x] Apps Script immutable Version 180 已更新目前公開頁使用的既有 Web App
  deployment；Version 179 保留為 rollback，Web App URL 不變。
- [x] 公開 endpoint read-back HTTP 200；未登入測試未帶 session、未寫入資料。
- [ ] 已登入桌面版首頁／房客名單驗收；目前仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-09 房東入口登入過期修正（已部署）

- [x] LIFF 初始化／getProfile 憑證過期顯示重新登入，不導向註冊。
- [x] 過期身份不繼續呼叫房東狀態 API；錯誤顯示不自動跳轉。
- [x] 外部瀏覽器按一次後 logout/login，LIFF 內按一次後重開 LIFF URL。
- [x] 重新登入立即禁用按鈕防連按；SDK 失敗可再操作。
- [x] OAuth code/state 不沿用；既有安全 return_to 保留。
- [x] 本機 `file://` 測試與未登入分支改用正式 GitHub Pages HTTPS 入口，不再把 file URL 傳給 LINE。
- [x] 一般網路失敗不登出，正常登入路徑不變。
- [x] 完整 Node `189/189`、Apps Script／前端 JavaScript syntax、靜態 release cache validator 與 `git diff --check` 通過。
- [x] PR #140 merge commit `17843ecae0094fbf15153bbca806a9aff347a0f7` 已合併至 `main`；Pages workflow `34338782441` 成功。
- [x] 公開 `landlord-entry.html`、`landlord-home.html`、`frontend-release.js`、`landlord-arrears.html`、房客入口頁均 HTTP 200；公開 marker 與 HTTPS 回跳函式 read-back 通過。
- [ ] iPhone LINE 與外部瀏覽器重新取得憑證、登入返回的實機驗收。

## 2026-09-09 手動銷帳逾時保護（version179 / PR138）

- [x] 狀態查核要求同 Workspace、正式已繳帳單、對應 confirmed 付款及相同金額。
- [x] 鎖忙碌、付款不符、越權或查詢失敗不得當成已銷帳。
- [x] 按鈕處理中連按只送一次；逾時後再按只查核，不再寫入付款。
- [x] 回復改成單次特定帳單查核，不再以欠款清單消失判定成功。
- [x] Node regression suite: 188/188（含 manual-settlement-status、phase147）。
- [x] 後端179版匯出56檔一致；Pages run34333318588成功，公開頁面與候選SHA相同。
- [x] 新狀態route未提供身份時回覆MISSING_ID，不暴露帳務資料。
- [ ] 正式手機 LIFF 銷帳成功／通知結果／实际耗時驗收。
- [ ] 正式 Apps Script 各階段耗時紀錄；不得用執行完成推論付款成功。

獨立 worktree 的 npm run validate 誤用上層 legacy package，不能視為候選
通過。顯式指定候選的 validator：88 unique routes、無重複宣告、語法及連結
通過；既有巢狀 tenant_payment_account_cover handler 未被舊檢查器辨識，
整體 exit 1。此限制不是新增狀態查核 route 的錯誤。

## Gate 0：靜態驗證

- [ ] 所有 `.gs` 通過 JavaScript syntax check
- [ ] 所有 HTML inline script 通過 syntax check
- [ ] 無重複 top-level function
- [ ] 無重複 top-level const
- [ ] `Code.gs` 無重複 route
- [ ] route count 與 manifest 一致
- [ ] canonical 目錄無 `_FIXED`／`_WITH_` 版本檔
- [ ] 無密鑰與 token

## 身份與入口

## 報修工單歷史與個資隔離（Phase 262 contract）

- [ ] 房客 A 建立報修後換租，房東仍可依 `workspace_id + room_id` 查到完整歷史，且原 `tenant_id_snapshot + lease_id_snapshot` 不被覆寫。
- [ ] 房客 B 的 response 在序列化前即完成 Workspace、房客與房間篩選；不得包含 A 的姓名、電話、Email、LINE ID、原始訊息、內部備註或附件 metadata。
- [ ] 房客 B 替換 `tenant_id`、`room_id` 或工單 ID 時，伺服器拒絕或回傳空集合，不洩漏其他房客資料。
- [ ] 工單狀態只使用 `open`、`in_progress`、`awaiting_confirmation`、`completed`、`closed`；每次更新均新增 append-only event 與 actor audit。
- [ ] 只接受 `tenant_repair_tickets_init`、`landlord_repair_tickets_init`、`landlord_repair_ticket_update` 三個 documented actions；未知 query-string action 必須拒絕。

## 報修工單 UI 與房客投影（Phase 265）

- [x] 房東訊息頁保留既有一般訊息清單與篩選，並以既有受驗證房東 POST bridge 讀取 `landlord_repair_tickets_init`；房間與工單狀態可篩選，按 `room_id` 分組顯示狀態、優先程度、原房客／租約快照、責任、費用與最新公開事件摘要。
- [x] 房東 repair 更新在按鈕 busy 時鎖定，僅以一次 `landlord_repair_ticket_update` POST bridge 提交 `ticket_id`、狀態與公開回覆；成功或失敗在頁面回饋，不會傳送 Workspace、房東、房客或租約識別作為 authority。
- [x] 房客頁只在 LIFF 已取得 `id_token` 後，以 controlled HTML POST bridge 呼叫 `tenant_repair_tickets_init`；repair renderer 只插入類型、標題、優先程度、狀態、建立／完成日期與公開摘要，絕不讀取或以 CSS 隱藏歷史原始訊息、房客／租約快照、內部備註、附件／儲存 ID、電話、Email 或 LINE identifier。
- [x] Tenant A／Tenant B 負向 fixture 驗證 Tenant B 的 repair payload 與 render output 不含 Tenant A 的姓名、電話、Email、LINE ID、原始訊息、私有附件檔名或租約 ID（`tests/phase265-repair-ticket-privacy.ui.test.mjs`）。
- [ ] `HUMAN_REQUIRED`：以真實已登入房東 Email session、房客 LIFF session 與換租 Tenant A/B fixture，在裝置／瀏覽器確認 bridge origin、讀寫回饋、房間篩選與跨房客畫面隔離；靜態測試不代表 authenticated Production acceptance。

- [ ] 未登入房東導向 LIFF 登入
- [ ] 登入後返回原頁
- [ ] 新房東註冊
- [ ] onboarding 暫存與完成
- [ ] 房客未綁定導向 bind
- [x] 房客直接開啟首頁時，LINE 登入回跳先經正式 `tenant-bind.html` Endpoint，再回到原頁，避免 deep URL 造成 LINE 400（Phase 167 靜態回歸測試；真機待驗證）
- [x] 房客綁定狀態查詢對 Apps Script 偶發慢回應採 30 秒逾時、一次重試，且不重試綁定寫入
  （`tests/tenant-binding-api-resilience.test.mjs`；尚未做真機或 Production 驗證）
- [x] 房東入口狀態查詢改用不依賴 JSONP callback 的 CORS JSON fetch，保留 25 秒逾時與錯誤提示
  （`tests/phase170-landlord-entry-status-fetch.test.mjs`；尚未做真機或 Production 驗證）
- [x] 房客詳細頁的房客清單與合約申請初始化改用不依賴 JSONP callback 的 CORS JSON fetch，保留 30 秒逾時與錯誤提示
  （`tests/phase171-landlord-tenant-detail-fetch.test.mjs`；尚未做真機或 Production 驗證）
- [x] 房東房客名單只為未綁定房客顯示「邀請綁定」；手機使用系統分享，桌機複製不含房客個資的 `tenant-bind.html` 連結（`tests/tenant-binding-invite-share.test.mjs`）
- [ ] `+886` 與 9 位手機正規化
- [ ] 不同 Workspace 不可互看

## Workspace 與團隊

- [ ] 建立 Workspace
- [ ] owner 成員建立
- [ ] 邀請與取消
- [ ] 接受邀請
- [ ] 角色與權限更新
- [ ] 移除成員
- [ ] Workspace 切換
- [ ] 操作稽核記錄操作者

## 物件、房間與房客

- [ ] 建立／修改／封存物件
- [ ] 建立／修改／封存房間
- [x] 房東可停用／重新啟用房間帳號，僅更新 `account_status` 且保留租約、帳單與付款紀錄（`tests/room-account-toggle.test.mjs`）
- [ ] Workspace 預設值正確帶入
- [ ] 輸入租金自動計算押金
- [ ] 夏月區間與跨年度判斷
- [ ] 建立房客
- [ ] 建立房客後首頁、房客清單與詳細頁一致

## 租約

- [x] 新租約建立：房東簡易流程以房號、租期、租金、押金建立待房客簽署的新租約，結束日由租期自動計算，費用預設由房間帶入（Phase 157／208；已完成本地邏輯與靜態回歸，LIFF 真機簽署仍 `HUMAN_REQUIRED`）
- [x] 新租約／紙本補登可由房東明確標記「簽約時已收首月租金＋管理費」；合約保存月份／金額快照，首月帳單以房客可見折抵明細抵銷租金與管理費，兩個月押金不併入月帳單折抵，文件查詢沿用 append-only 合約歷史鏈（Phase 224／225；本次修正待部署與手機／LIFF 真機 UAT）
- [ ] 房客端看到正確租約
- [ ] 續約申請
- [ ] 提前終止申請
- [ ] 房東核准／拒絕
- [ ] 取消申請
- [ ] 條款與違約金資料一致
- [ ] 團隊收到合約通知

## 帳單與付款

- [ ] `landlord_billing_init`
- [ ] 上期電表正確
- [ ] 批次建立帳單
- [ ] 新增與更新計數正確
- [ ] 房客帳單顯示正確
- [x] 房東帳單分開保存內部備註與房客可見折抵說明；房客帳單與手動重發通知只顯示折抵金額及房客可見說明，不公開內部備註（Phase 223 自動回歸；正式／真機待驗證）
- [x] 已驗證房客的帳單只顯示其有效租約 Workspace 的預設、未封存收款帳號；跨 Workspace 與封存帳號不得外洩，且帳單明細顯示銀行、分行、帳號、戶名與付款備註（Phase 237 自動回歸；正式／LIFF 真機待驗證）
- [x] 房客「我的帳單」與付款回報首頁直接顯示同一份轉帳收款資訊；Workspace 預設帳號優先，其次是該已驗證房客、同 Workspace 的有效租約帳號，最後才是同 Workspace 的單一有效 `V2_landlords` 收款資料；舊租約缺少 `landlord_id` 時，只能由同 Workspace、同 `room_id`／`property_id` 的唯一有效房間與物件推導房東，房間與物件不得直接提供銀行欄位，跨 Workspace、不同房東及舊帳單資料不得作為備援，且回傳不含 Workspace／租約／稽核資料（Phase 238 擴充自動回歸；正式／LIFF 真機待驗證）
- [x] 房客簽約流程在送交簽署前顯示押金／首月租金合計與完整房東收款帳號；合約缺少專屬帳號時只回退到已驗證 Workspace 收款帳號，帳號以文字保留前導 0，缺少帳號時顯示勿匯款警示；銀行封面仍由房客「我的帳單」透過受保護路由查看（Phase 240；本地候選，Apps Script／Pages 部署與 LIFF 真機 UAT 待驗證）
- [x] 房東可在系統設定保存多組未封存收款帳號、逐組上傳存摺封面並明確啟用唯一一組；房客帳單、付款回報與簽約流程使用啟用帳號，銀行帳號前導 0 以文字保留（Phase 241；本地候選，Apps Script／Pages 部署與手機 UAT 待驗證）
- [x] 每月 5 號起共用既有每小時 dispatcher 補發當月已建立、未繳且尚未發送的帳單；成功沿用 `sent_status` 防重，缺少本期電錶時不自動建立新帳單（Phase 231；本地候選，正式部署／觸發器／LINE／LIFF 待驗證）
- [x] 每月帳單成功發給房客後，房東／團隊通知中心記錄本月成功發送筆數；整組失敗／未送出會在摘要中揭露，LINE 批次結果不明不自動重發，失敗摘要只重試原失敗收件人，並沿用 `notify_bill_created` 偏好與 Workspace 隔離（Phase 231；本地候選，正式部署／房東 LINE UAT 待驗證）
- [x] 已建立未繳帳單可由房東明確按下「首月租金＋管理費已於簽約時收取，套用折抵」；只折抵首月固定費用、保留兩個月押金、水電、設備費與其他費用，並同步房東／房客明細（Phase 139／225／226；本次修正待部署與手機／LIFF 真機 UAT）
- [ ] 帳單通知只發測試帳號
- [x] 房客付款回報選單與送出的付款金額以 `V2_bills` 為準；同一 `bill_id` 的過期
  `V2_tenant_bill_view`（含尚未套用折抵的舊總額）不得覆蓋正式應繳總額，只有主表
  全域缺少該帳單且 view 精確匹配房客 LINE UID 時才相容回退；空白 LINE、跨
  Workspace 同 ID 與重複主表 ID 均 fail closed，不同 bill ID 的舊合約歷史帳單不
  阻擋目前帳單（Phase 140 自動回歸；PR #121／Apps Script Version 168 source exact
  match／公開 guard read-back 通過；Sheet-backed 與 LIFF 真機待驗證）
- [x] 201 已繳帳單的付款回報初始化不產生空白帳單（Phase 145 自動回歸測試；Production Version 102 唯讀 smoke test）
- [x] 已銷帳帳單的舊付款回報不再計入房東待審核統計（Phase 144 自動回歸測試；Production Version 102 唯讀 smoke test）
- [x] 房東首頁與付款回報審核頁的底部導覽樣式一致（Phase 144 自動回歸測試）
- [x] 房客付款回報入口經 `tenant-bind.html` 登入並保留帳單參數，避免 LINE 400（Phase 146 自動回歸測試；GitHub Pages merge `37e164e6`／workflow `31538875823`）
- [x] 四個房客功能頁移除公開 page-local UID，測試模式改由 `test=1` 交給後端解析，正式 LIFF profile 流程與 Phase 146 gateway 保留（Phase 147 靜態回歸測試；focused 與全套 Node 回歸均通過；GitHub Pages merge `0bbbe06e`／workflow `31601674513`／公開頁面讀取驗證 2026-08-12）
- [x] 付款回報確認與手動銷帳在寫入回應逾時後，以權威讀取結果確認是否已完成，且不重送寫入（Phase 147 自動回歸測試；尚未做真機或 Production 驗證）
- [ ] 團隊收到付款通知
- [ ] 房東核准後帳單結清
- [ ] 手動結清與重開
- [ ] 已繳帳單頁一致

## 自動催繳

- [ ] Workspace schedules 正確
- [ ] preview 不發 LINE
- [ ] ScheduledNow 只列目前時段
- [ ] 正式執行只發應發階段
- [ ] 同階段不重複
- [ ] 錯過提醒日補最高階段
- [ ] 最終階段下一天轉人工
- [ ] trigger 只有一個
- [x] 每月帳單通知與逾期催繳共用既有每小時 dispatcher，漏過 5 號可於後續小時補發，成功不重送（Phase 231；Apps Script Version 165 已部署，LINE／LIFF UAT 待驗證）
- [x] 月初帳單補發修正：停用全部逾期催繳 Workspace 時仍保留每小時 dispatcher；房東可按「手動發送本月帳單」補發當月既有未發送／失敗帳單，且不重發已成功帳單；中文 `已建立`／`已開立`／`開立` 狀態與 `issued` 一致（Phase 233；Apps Script Version 165 已部署，LINE／LIFF UAT 待驗證）
- [x] 月帳單手動發送遇到 JSONP 回應逾時不會自動重送寫入，而是重新讀取通知狀態並提示確認 `已發送`；快速續約 CTA 在 mobile action grid 保持綠底白字；手動銷帳 canonical V2 寫入完成後，V1／通知／稽核後續失敗以警示回傳、不誤導重複銷帳（Phase 234；local candidate，Production／LIFF UAT 待驗證）
- [x] 手動銷帳同步帳單檢視時，工作表中空白的 `__row_number` 儲存格不可覆寫系統的實際列號，避免 `Cannot convert "" to int` 而回滾銷帳（Phase 235；local candidate，Production／LIFF UAT 待驗證）
- [ ] LINE 失敗進入通知中心

## 訊息／報修

- [ ] 房客一般訊息
- [ ] 緊急訊息
- [ ] maintenance 成員收到通知
- [ ] 房東更新狀態
- [ ] 後續正式工單模組待開發

## 入住

- [ ] 報到資料載入
- [x] LIFF access token 過期時報到頁自動重新登入（Phase 149 自動回歸測試）
- [ ] 預定入住日
- [ ] 鑰匙交付
- [ ] 入住電表
- [ ] 完成／取消狀態
- [ ] 歡迎通知
- [ ] LINE 失敗通知

## 公告

- [ ] 全部房客
- [ ] 指定物件
- [ ] 指定房客
- [ ] 未綁定與衝突統計
- [ ] 單一測試房客發送
- [ ] 失敗重試
- [ ] 團隊看到公告結果

## 系統設定與通知中心

- [ ] 個人資料與手機前導 0
- [ ] Workspace 名稱、時區、幣別
- [ ] 收款帳號權限與遮罩
- [x] 收款帳號前導 0 保留、私有帳戶封面上傳與房客帳單預覽（Phase 239；PR #127／Apps Script Version 173／GitHub Pages workflow `34126765101`；Web App URL 不變；真實房東上傳、房客 LIFF 與手機 UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`）
- [x] Apps Script sandbox bridge、帳戶封面鎖定與手動銷帳逾時回歸（Phase 240；sandbox 回應僅以受限 Google origin 與 request nonce 接受；帳戶封面與手動銷帳分別在 8 秒回覆忙碌，手動銷帳完成帳務寫入後才釋放通知；Production／真機 UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`）
- [x] 手動銷帳與銀行帳戶封面上傳沿用頁面指定的 60 秒 bridge timeout，避免共享 auth client 將長操作截斷（Phase 236／239 follow-up；Production／真機 UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`）
- [ ] 帳務預設
- [ ] 通知偏好
- [ ] 單筆已讀
- [ ] 全部已讀
- [ ] 類型與失敗篩選

## 非功能測試

- [ ] 手機 Safari／LINE WebView
- [ ] Android LINE WebView
- [ ] 頁面不被 bottom nav 遮擋
- [x] 系統設定手機鍵盤開啟時隱藏固定 bottom nav，並將 Email／文字欄位捲動至可視區（Phase 233；真機 Safari／LINE WebView 待驗證）
- [ ] API 逾時提示
- [x] 房東桌面帳款、合約、物件、欠款與房客讀取 route 啟用 request-local snapshot，避免受保護 iframe bridge 重複掃描 Workspace schema（Phase 245 自動回歸測試；仍需真機／Production 驗證）
- [ ] Google Sheets 容量
- [ ] 100／500／1,000 房客資料量測試
- [ ] LINE API 配額與錯誤
- [ ] Apps Script 執行時間
- [ ] 備份與還原演練

## 2026-09-18 一次性測試帳單作廢／封存

- [x] 欠款頁只對已關閉房間帳號的未付款帳單顯示「作廢測試帳單」；啟用中房間不顯示。
- [x] 後端重新驗證 Workspace、房間狀態、未付款狀態與付款紀錄；不依賴 `test=1`。
- [x] 作廢只更新帳單狀態與內部備註，保留帳單／檢視歷史，不建立付款、不發送 LINE、不刪除資料。
- [x] Workspace 操作紀錄保存實際操作人、時間、帳單／房間目標與封存原因。
- [x] 已加入靜態與純函式回歸測試；正式 Sheet、登入後欠款頁與一次性測試帳單操作尚待 authenticated UAT。

## V2.1 本地候選：線上合約簽署與營收儀表板

- [x] 房東房客詳細頁可管理舊合約、身分證正反面與自拍照；已上傳項目鎖定避免重複上傳，電腦可拖放檔案並沿用格式／大小驗證，文件卡片以預覽為入口，預覽頁保留下載、列印與分享（`tests/tenant-detail-contract-documents.test.mjs`；正式站需另行發布驗證）
- [x] 房客簽署資料送出、房東 Workspace/RBAC 審核、核准啟用、拒絕後重送（Phase 129–133、138、140 focused tests；Production 尚未驗證）
- [x] 合約審核缺少必要附件時 fail closed、跨 Workspace 拒絕、重複決策 idempotent（Phase 138 runtime mock；Production Sheet schema 尚未驗證）
- [x] 營收儀表板聚合應收／實收／未收／收款率，並排除跨 Workspace 帳單（Phase 150 runtime test）
- [x] 營收儀表板提供 SVG 圖表、數值表格 fallback、空資料狀態與月份／物件 CSV（Phase 151 UI test）
- [x] 營收儀表板提供繳款狀態分布、遲繳比例與遲繳天數、入住率、合約到期分布（Phase 152 runtime + Phase 153 UI tests）
- [x] 房客與房東審核頁均讀取指定 Google Docs 固定版型；送出時複製固定版型、填入欄位、把文字簽名區替換為簽名圖片並回寫簽署紀錄（Phase 154–155、168 tests；Production template properties／真機尚待驗證）
- [x] 報表可解析 Google Sheets 的 Date 型態帳單月份；簽署 bootstrap 失敗時保留房客唯讀合約檢視（Phase 156 regression test）
- [x] 房東可發起新房出租／房客續約待簽合約，邀請欄位可在空白分頁安全初始化，且租金、管理費、押金與小數費率不失真（Phase 157–162 runtime／UI tests；Production schema header repair verified）
- [x] 到期 60 天內每日只準備一份 append-only 續約草稿，保留原合約；草稿待房東檢視、30 天僅提醒一次，房東確認後自動詢問房客，且房客清單顯示合約到期日／剩餘日數（Phase 178／202／203；Apps Script Version 147／Pages workflow `33567151637` 已部署，正式觸發器與 LINE 真機仍待驗證）
- [x] 房東合約申請頁顯示房客已送出的固定版型新租約、簽名預覽，且原生審核 API／房客文件 route 錯誤不再被靜默成空畫面（Phase 169；Production／LINE 真機待驗證）
- [x] 房東房客詳細頁提供明確的「查看完整合約與簽名」入口，並定位至合約申請頁的原生合約內容區（Phase 172；Production／LINE 真機待驗證）
- [x] 舊房客續約採 `V2_contracts` append-only 版本鏈，保留歷史合約、完整金額／付款快照、30 天到期不續約優惠、續約證件沿用與新簽名要求；房東／房客可讀取版本紀錄，指定房東版本可唯讀查看完整合約與簽名，並提供可重跑的 additive-only schema migration（Phase 174–176；Apps Script Version 130／GitHub Pages workflow `33098140787` 已發布；LINE 真機仍待驗證）
- [x] 正式 `landlord_tenants` Workspace 原生路由回傳同一份唯讀 `contract_history`，避免 603 原測試合約仍存在但房客詳細頁顯示「尚無可讀取的合約版本」；房東詳細頁可完成渲染並提供「查看完整合約與簽名」（Phase 177；Apps Script Version 131／GitHub Pages workflow `33099332347`／公開 603 smoke readback 已驗證；LINE 真機仍待驗證）
- [x] Production-facing landlord／tenant pages 全部指向目前正式 Apps Script deployment 114，避免沿用舊部署造成合約管理頁卡在載入中（Phase 165 endpoint regression test）
- [x] 房客首頁沒有有效租約時保留合約入口，讓待簽署房客可進入手機合約簽署頁（Phase 166 UI 回歸測試；Production 真機尚待驗證）
- [x] 房東首頁提供本月應收／已收／未收／收款率 KPI、近 12 個月三線圖、入住率環形圖與 30／60／90 天合約到期柱狀圖；KPI 採兩欄配置並取消金額省略，趨勢圖下方摘要使用顯示月份合計並保留數值與 aria-label（Phase 193；本地自動測試通過）
- [x] 房東首頁在取得身份後即與 bootstrap 並行啟動報表請求，bootstrap 完成後漸進渲染報表；唯讀 JSONP 逾時最多自動重試一次，script error 立即清理並拒絕，圖表失敗不覆蓋已載入首頁（Phase 193；本地自動測試通過）
- [x] 房東首頁 bootstrap 的付款／訊息唯讀資料共用 request-local snapshot，避免同一次首頁載入重複讀取 Google Sheet（Phase 197；本地回歸測試通過）
- [x] 房客清單由 `landlord_tenants` 回傳現行合約到期日；房卡明確顯示到期日與剩餘／逾期天數，並以有效、60 天內、30 天內、已到期分級顏色提示（Phase 194；本地 API／UI 回歸測試通過，公開頁與 LIFF 真機尚待驗證）
- [x] 合約 60 天內、30 天內或已到期的房客卡片提供「快速續約」，沿用現行合約／房客／房間／物件 context 進入 append-only 續約表單（Phase 194／226；本地回歸通過，正式頁與 LIFF 真機待驗證）
- [x] 房東可修改尚未發送的續約草稿日期，系統同步重建合約全文；已送出／已簽署版本拒絕覆寫，手動簽約日期錯誤改以取消未認領邀請後重建或新增更正續約版本（Phase 195；Apps Script Version 139／GitHub Pages workflow `33449180375` 已發布並完成公開 route/page readback，LINE 真機尚待驗證）
- [x] 到期續約改由房東先檢視草稿、可修改日期／金額／30 天優惠條款，再發送續約詢問；房客只能回覆同意或暫不續約，同意後房東才可發送正式簽署邀請，舊合約版本維持 append-only（Phase 196；正式 Apps Script Version 140 與 Pages workflow `33456765735` 已發布，LINE 真機仍待驗證）
- [x] 本地候選新增「直接續約簽署」單頁流程：現有／已到期／已完成合約可建立新版 append-only 合約、可勾選 30 天條款並立即產生邀請；房客續約邀請只要求簽名，房東核准後才封存舊版本（Phase 198 static；Phase 157／158 runtime；尚未部署或進行 LINE 真機 UAT）
- [x] 續約入口改由「房客名單 → 房客詳細資料 → 房客合約」進入；目前／已到期／可續約版本直接顯示「發起續約」，合約申請頁只保留既有草稿審查、邀請與簽署處理（Phase 199；正式部署於 PR #81／Pages workflow `33547890200`；尚未進行 LINE 真機 UAT）
- [x] 續約表單起始日自動帶入原合約結束日，結束日自動計算為起始日加一年減一天；從房間發起續約時保留原合約租金／押金／電費／設備耗損費等條件，新租約流程與其他續約欄位不受影響（Phase 174／200；正式 Apps Script Version 145／GitHub Pages workflow `33555883954` 已發布並完成公開 readback，LINE 真機尚待驗證）
- [x] 合約到期後若尚未建立續約草稿，仍保留啟用中的房客與房間於房東房客清單，並可從到期版本恢復手動續約入口；到期合約維持唯讀（Phase 201；正式 Apps Script Version 146，GitHub Pages 未變更，登入後 UAT 待驗證）
- [x] 房東確認續約後自動發送房客詢問；房客同意後自動建立新版簽署邀請並透過 LINE 發送，拒絕後建立 `tenant_declined` 待退房狀態；邀請與通知具冪等保護（Phase 202 runtime；Apps Script Version 147 已部署，LINE 真機／正式觸發器為 `UNVERIFIED`）
- [x] 房東可從房客詳細資料直接進入手動退房；退房完成後清除房間、房客與檢視指向，保留原合約日期／全文／帳務／簽名資料，且不發房客 LINE（Phase 202 runtime／203 UI；Apps Script Version 147／Pages workflow `33567151637` 已部署，登入後 UAT 為 `UNVERIFIED`）
- [x] 房東退房結算已正式部署：9/1 到退房日含當日計算、上月只帶入未繳電費／設備使用費、本期房租按日曆天數拆分、本期水電設備按電表差額計算、押金扣除／應補繳／押金應退與兩張私有電表照片（Phase 205／Phase 206／Phase 207；Apps Script Version 148、PR #92／Pages workflow `33648496168`；公開頁與正式 `V2_checkout_settlements` schema read-back 通過）
- [x] 房東退房「快速結案」與欄位遮罩修正已正式部署：不要求電表讀數／照片，以手動應收金額與實際退款金額作為最終結算；退房專用 shell 隱藏固定底部列並保留 focus 自動捲動（Phase 252 runtime／Phase 253 UI／Phase 254 docs／Phase 255 UI；快速結案 PR #155／Apps Script Version 186／Pages workflow `34598441945`，遮罩修正 PR #157／Pages workflow `34688134508`；真實手機／LIFF UAT 為 `HUMAN_REQUIRED`／`UNVERIFIED`）
- [x] 房東可從房客名單直接建立簡易新租約：填寫房號、租金、押金、起始日與租期月數，伺服器計算含首尾日結束日並補入房間／Workspace 預設費用，後續連接房客證件上傳與簽署（Phase 208；Apps Script Version 149、PR #94／Pages workflow `33656914943`；公開頁與 Production API guard read-back 通過）
- [x] 房東可補登已完成簽署的紙本合約：必填紙本合約檔案、身分證正反面可後補，直接建立 Workspace 內的有效／待開始租約；不建立合約申請、電子邀請、確認碼或 LINE 訊息，並以冪等鍵避免重複建檔（Phase 209；Apps Script Version 150／PR #96 已部署，Production migration read-back 通過）
- [x] 房東可從空房的物件／房間頁或房客詳細資料進入「手動補登紙本合約」，補登頁帶入既有房客／房間資料並提供紙本專用完成畫面，不誤顯示電子邀請內容（Phase 210；本地 UI static test 通過，手機／LIFF 尚待驗證）
- [x] 紙本合約補登的 API 路由、資料邊界、測試與部署狀態已記錄；PR #96、Apps Script Version 150 與 legacy Pages build `1190728482` 已部署，公開頁 read-back 通過；Drive 與 LINE 仍未執行（Phase 211；本地文件 test 通過）
- [x] 紙本合約補登的 Production migration 只在既有 `V2_contracts` 標題列尾端追加兩個冪等欄位，重跑不重複追加、缺少資料表會 fail closed，且不改任何資料列；Production header read-back 通過（Phase 212）
- [x] 紙本補登 migration 也會追加孤立合約復原所需的 `previous_contract_id`，重跑不重複追加且不改既有資料列；帳單抄表頁於 iOS 虛擬鍵盤開啟時會收起固定操作列／底部導覽並捲動焦點欄位；新建帳單依租約與帳單月的含首尾日重疊天數計算首月／末月租金，既有帳單維持原始快照（Phase 221／222；本地回歸通過，未部署／正式 LIFF UAT 待驗證）
- [x] 房客詳細資料會沿合約版本鏈補回房源建檔遺留的合約／身分證 HTTPS 文件連結；簡易新租約／紙本補登勾選「簽約時已收首月租金＋管理費」時，首月固定費用以可追溯折抵明細結清，兩個月押金維持合約資料，避免重複列帳（Phase 224／225；本次修正待部署與正式 LIFF UAT）
- [x] 已建立但未繳的本月帳單若對應合約已明確記錄簽約時收取首月租金＋管理費，房東正常送出帳務更新即可自動折抵首月固定費用；兩個月押金、已繳帳單、水電／設備／其他費用不受影響，房東與房客均可看到折抵明細（Phase 139／225／226；本次修正待部署與正式資料／LIFF UAT）
- [x] 既有帳單若只先折抵租金、管理費仍未繳，帳務頁仍顯示「首月租金＋管理費已於簽約時收取，套用折抵」補正入口；只有租金與管理費合計已折抵才隱藏入口（Phase 227；本地回歸通過，正式資料／LIFF UAT 待驗證）
- [x] 既有帳單若租金已先折抵而 `rent_amount` 已為 0，首月固定費用補正仍會補上管理費並結清剩餘金額；欠款頁以同 Workspace／房客／房號的房東名單身份覆寫過期帳單名稱（Phase 228；本地回歸與 Apps Script syntax check 通過，正式部署／資料／LIFF UAT 待驗證）
- [x] 202 折抵同步遇到同 Workspace 的 legacy duplicate `bill_id` 時，更新所有同 Workspace view rows；跨 Workspace collision 仍 fail closed；欠款身份在帳單 tenant_id 過期時改以房東名單的同房號／房號名稱解析（Phase 229；本地 131/131、Apps Script syntax、Version 161 source exact match、前端實際 deployment HTTP guard read-back 通過，手機／LIFF UAT 待驗證）
- [x] 202 清除金額操作具備每筆帳單的處理中／完成鎖定；寫入 API 不自動重送，成功後顯示明確完成提示，回應逾時只做一次唯讀讀取確認並告知是否已完成（Phase 230；本地 UI、validator、Apps Script syntax、完整 Node `132/132` 通過；PR #108／Pages workflow `33985625051` 已發布，公開帳務頁 HTTP 200 read-back，手機／LIFF UAT 待驗證）
- [x] 202 已先建立但尚未被房客認領的房東電子租約，可從物件／房間頁以 `supersede_contract_id` 轉成紙本補登；原電子合約與邀請保留並標記取消，新紙本合約以 `previous_contract_id` 連結，既有房客／使用者啟用且維持未綁定 LINE，完成頁提供房客登入入口（Phase 213；PR #98／Apps Script Version 151／Pages workflow `33691996413` 已部署，正式手機／LIFF 尚待驗證）
- [x] 房間若仍顯示「已出租／租約中」但有效合約找不到對應房客且沒有 LINE 綁定，物件／房間頁顯示「補登紙本並建立房客登入」資料修復入口；送出時保留並關閉孤兒合約、建立新的紙本租約與未綁定房客，並拒絕仍有房客或 LINE 綁定的合約（Phase 214；PR #100／Apps Script Version 152／Pages workflow `33694799930` 已部署，公開頁 read-back HTTP 200；手機／LIFF 尚待驗證）
- [x] 舊格式待啟用合約若已有未綁定的房客資料，物件／房間頁仍顯示「補登紙本並建立房客登入」入口；補登時沿用既有房客、不建立第二筆房客資料，關閉舊待簽合約並以 `previous_contract_id` 連結紙本租約。若既有房客列缺少對應 `V2_users` 列，只有同一個未綁定 legacy-pending 恢復分支會補建該房客帳號；已綁定或其他既有房客維持拒絕（Phase 215 runtime regression；Apps Script Version 156、Pages workflow `33886721735` 已部署；手機／LIFF 實際補登仍待驗證）
- [x] 紙本補登頁的房東驗證狀態改用不帶 LINE UID 的 JSONP 兼容通道，避免手機 LIFF 遇到 Apps Script 302 轉址時誤判為驗證連線失敗；續約狀態查詢共用同一通道（Phase 216；commit `884a066`、Pages workflow `33801519730` 已部署，手機／LIFF UAT 仍待驗證）
- [x] 房東桌面 Email OTP：六個 `landlord_email_*` action 只走 `doPost` JSON body + controlled bridge，`doGet` / JSONP 不承載 Email、OTP、challenge 或 session token；Email/session 使用 `CMWEBS_EMAIL_LOGIN_HASH_SECRET` HMAC 雜湊，`V2_users` 追加 `email_verified_at`／`email_login_enabled`，並新增 `V2_landlord_email_login_challenges`、`V2_landlord_email_sessions` additive/idempotent schema（Phase 217／218／219；Apps Script Version 157、Pages PR #102 已部署；實際 Email／session UAT 仍待驗證）
- [x] 房東第一期桌面響應式：`landlord-entry.html`、`landlord-home.html`、`landlord-tenants.html`、`landlord-properties.html`、`landlord-settings.html` 共用 `landlord-auth.js` 與 `landlord-responsive.css`；static tests 覆蓋 375／390／768／1024／1440 viewport contract、手機 bottom nav、1024+ desktop sidebar、focus ring 與 auth failure handling（Phase 219／220；Pages PR #102 已部署；實際 browser capture 尚為 `UNVERIFIED`）
- [x] 房東桌面完成候選：Email OTP 缺少 hash secret／MailApp 寄送失敗時 fail closed 且不寫入 challenge；`landlord-settings.html` 接入 shared responsive shell 與 authenticated `landlord_settings_init` POST bridge；Phase 217／219／220 全部回歸、全套 124 tests 與 Apps Script syntax 通過（`npm run validate` 解析到 dirty parent package，非本 worktree 證據；既有 static release-cache validator 因鎖定舊 20260822 marker 而 `UNVERIFIED`）
- [x] 房東後台「更多」頁提供醒目的「開啟桌面版」入口，連到 `landlord-entry.html` 的 Email 驗證碼登入，使用新分頁與 `noopener` 保護；Phase 232 static regression test 通過，PR #112／Pages workflow `34016014898` 已發布，`landlord-more.html` 與 `landlord-entry.html` 公開 read-back HTTP 200（瀏覽器真人點擊與 Email/session UAT 仍待驗證）
- [x] 房東後台「更多」頁新增「快速建立租約」入口，直接進入簡易新租約流程；選房間後帶入原房價，租金欄可修改並沿用既有簽署邀請（Phase 261；本地 UI 回歸通過，尚未部署／手機與正式資料 UAT 待驗證）
- [x] Email 登入／首次驗證的 hidden POST bridge 改用 60 秒逾時，避免 Apps Script MailApp 寄信或回應稍慢時被 25 秒前端逾時誤判；寄信設定失敗與橋接逾時顯示可區分的處理提示（Phase 242；本地回歸通過，正式 Email 寄送與手機／桌面 UAT 仍為 `HUMAN_REQUIRED` / `UNVERIFIED`）
- [ ] 正式 Email 寄送、已登入 LINE 房東首次 Email 驗證、已驗證房東桌面登入後的 authenticated operation、375／390／768／1024／1440 browser capture 與真機 UAT（候選未部署；全部仍為 `HUMAN_REQUIRED` / `UNVERIFIED`）
- [x] 房客續約與退租頁改為被動資訊／歷史檢視，不建立新的 `V2_contract_requests` 退租申請；既有歷史 route 保留相容讀取（Phase 203 UI；Pages workflow `33567151637` 已部署，LINE 真機為 `UNVERIFIED`）
- [ ] 已登入 LIFF／真機、Drive 私有照片上傳與 502／506 已登入正式退房交易 UAT（正式 Sheet schema 與欄位 read-back 已通過；其餘仍為 `HUMAN_REQUIRED` / `UNVERIFIED`）

## 2026-09-09 房東桌面版登入與操作頁本地候選

### 同日：現有系統首頁效能修復

- [x] `landlord-post-read-snapshot.test.mjs`: actual POST dispatcher with mocked
  services proves one physical read per sheet per request, fresh reads across
  requests, and uncached write actions.
- [x] `landlord-home-progressive.test.mjs`: core renders before secondary work;
  rapid refresh deduplication; secondary failure isolation; transient refresh
  retains current-page data with warning; auth failure clears it; section actions
  does not rescan dashboard; legacy response remains compatible.
- [x] Full Node suite 187/187. No billing, LINE push, email send or bank writes
  executed by these tests.
- [ ] Authenticated desktop/mobile latency and real-device acceptance remain
  UNVERIFIED. Browser click instrumentation timed out before dispatch.
- [ ] `npm run validate` is not a candidate check: npm resolved the parent's
  package. Explicit candidate-root legacy validator reports 87 vs expected 71
  routes and existing nested handler `tenant_payment_account_cover` not detected.


- [x] 桌面入口提供寬版登入 shell、Email／OTP 欄位標籤、錯誤／成功狀態與鍵盤 focus；寄送、重寄、驗證均有立即 busy／disabled／`aria-busy` 回饋、重複點擊保護與失敗復原（Phase 244；commits `11be3e4`–`964570a`）。
- [x] 房東欠款與合約申請頁接上共用桌面 shell、側欄、頁面內滾動與 modal stacking；手機 375／390／768 shell 與 bottom nav 保留（Phase 220；commits `d0dd3f0`–`0345db5`）。
- [x] Email bridge 保留業務 `request_id` 與 transport correlation id，bridge timeout 正規化為 `API_TIMEOUT`；原生簽署 session 不與房東 Email session 混用（Phase 219／220）。
- [x] 桌面 Email 對目前沒有既有 Apps Script dispatcher 支援的欠款／合約原生操作明確 fail closed，顯示可理解的未支援提示；不得假裝成功或逾時後重複寫入。手機 LINE／JSONP 路徑保持原狀（Phase 220）。
- [x] 本地自動驗證：`node --test tests/*.test.mjs` 185/185；Phase 192、219、220、244 focused 39/39；Apps Script／目標 HTML inline script syntax check 通過；`git diff --check` 通過。
- [ ] `npm run validate`：`UNVERIFIED`，本 worktree 沒有 tracked `package.json`／validate script，未借用 parent checkout 結果。
- [ ] `node scripts/validate-static-release-cache.js`：`UNVERIFIED`，基線 `frontend-release.js` marker 與 validator 期待值不一致；本候選未改 release marker。
- [ ] 真實桌面瀏覽器 Email 登入、欠款／合約頁 authenticated operation、手機 LIFF／LINE、375／390／768／1024／1440 viewport capture：`HUMAN_REQUIRED`／`UNVERIFIED`。
- [x] GitHub push 與 GitHub Pages publish 已完成：PR #134 merge commit `1b24ec2` 已合併至 `main`；Pages run `34313575139` 成功，公開 `landlord-entry.html`、`landlord-arrears.html`、`landlord-contract-requests.html`、`landlord-responsive.css` 與 `landlord-auth.js` 均 HTTP 200 並完成 marker read-back。Apps Script deployment 未執行，因本候選沒有 `apps-script/` 差異；rollback 為回復 `main` 至 merge 前 revision `341ca17`。
