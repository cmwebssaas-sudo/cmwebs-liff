# CMWebs Current State

**Status: AUTHORITATIVE current-state record**
**Last verified: 2026-09-11 (Asia/Taipei)**

This record distinguishes verified source reconciliation from live Production
state. It is not deployment authority. Re-verify the relevant target, account,
version, rollback, and runtime state before every Production action.

## 2026-09-11 房東桌面版網址改為手機分享流程（正式部署）

- 「更多功能 → 開啟桌面版」不再由手機直接跳轉；現在開啟可關閉的分享面板，顯示
  穩定的 `landlord-entry.html?mode=email&return_to=landlord-home.html` 入口，提供複製
  與手機系統分享。桌面仍以 Email 驗證碼登入，網址不含 Email、OTP、LINE UID 或
  session。
- 只改 GitHub Pages 靜態前端 `landlord-more.html` 與 Phase 232／250／251 回歸測試；
  不改 Apps Script、登入資料、Sheet、Drive、Properties、Trigger、帳務資料或 LINE
  設定。候選分支為 `codex/desktop-share-url-20260911`。
- Commit `2f991b7` 已由 PR #153 合併至 `main`，merge commit 為
  `a497b5a1ce9ab5741599c1a8435a1d3b01f2ef0b`；GitHub Pages workflow `34584013793`
  成功完成。公開 `landlord-more.html` HTTP 200 read-back 已確認分享面板、複製／系統
  分享按鈕與新按鈕入口存在，舊的直接跳轉 anchor 已移除；固定入口的 Email mode
  read-back 亦為 HTTP 200。
- 真實手機按鈕、系統分享後在電腦開啟及 Email OTP/session 驗收仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-11 房東「開啟桌面版」避免誤走過期 LINE 登入（本地候選）

- 根因是「更多功能 → 開啟桌面版」只帶 `return_to`；手機 LINE WebView 開啟後仍
  依裝置模式先初始化 LINE，遇到過期 access token 就停在「LINE 登入已過期」，尚未
  進入 Email OTP 桌面登入。修正後連結明確帶 `mode=email`，入口頁在 LINE 初始化前
  直接顯示房東 Email 登入表單；一般手機入口與使用者主動按「使用 LINE 登入」的流程
  維持不變。
- 只改 GitHub Pages 靜態前端與回歸測試，不改 Apps Script、登入資料、Sheet、Drive、
  Properties、Trigger、帳務或 LINE 設定。候選分支為
  `codex/fix-desktop-entry-expired-line-20260911`。
- Phase 232 舊網址測試已同步改為新 Email mode contract；新增 Phase 250 覆蓋連結、
  URL mode 分流與「不得初始化過期 LINE」行為。相關 focused tests 全部通過；尚未
  推送、合併、發布或完成真實手機／桌面 Email/session 驗收，狀態為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-10 房東共用腳本快取版本修正（正式部署）

- 前一版 Apps Script Version 185 的後端唯讀診斷可回傳，但桌面／手機頁面仍以
  未版本化的 `landlord-auth.js`／`landlord-api.js` 載入共用橋接；既有瀏覽器工作階段
  因而可能持續使用舊的 25 秒逾時腳本。本候選將 `frontend-release.js` marker 更新為
  `20260910-landlord-read-bridge-v2`，並讓所有房東頁及共用登入／API 腳本使用同一個
  cache-busted URL。
- 本候選只改 GitHub Pages 靜態資產與回歸測試，不改 Apps Script、登入資料、Sheet、
  Drive、Properties、Trigger、帳務或 LINE；Apps Script Version 185 與既有 Web App
  URL 保持不變。
- `npm run validate` 通過；Phase 249 快取版本回歸通過；完整 Node suite `198/198`
  通過。另將 Phase 209 的日期判定改為使用測試固定時間，避免測試隨真實日期漂移。
- PR #150 merge commit `2cc882a33654e8d027cbce3514170c450374a9e1` 已合併至 `main`；
  GitHub Pages workflow `34423919614` 成功完成。公開房東入口、首頁、房客、物件、
  欠款、合約與設定頁均 HTTP 200，三個共用腳本 read-back 與候選 SHA-256 一致。
- 新開未登入瀏覽器分頁會進入正常 LINE 登入流程；既有已登入 Chrome／手機仍需
  重新開啟新 marker URL 並完成真實流程驗收，狀態仍為 `HUMAN_REQUIRED`，不能由
  靜態 read-back 宣稱圖表與所有資料頁已完成。

## 2026-09-10 房東桌面多頁 POST bridge 逾時修正正式部署

- 根因是桌面 Email session 使用隱藏 iframe POST bridge，但帳款、合約唯讀初始化、
  通知、付款回報、營收圖表、Workspace context 與手動銷帳狀態等 route 沒有回傳
  `postMessage` bridge 結果，請求因此等到前端逾時；本次補上伺服器驗證後的 bridge
  dispatch，並讓桌面帳款／合約唯讀頁走相同路徑，寫入與合約異動仍維持保護。
- PR #147 merge commit `f72cfee37013fe3952445d32ed41ceac757cf72c`；既有 Production
  Apps Script deployment 已由 immutable Version 182 更新至 Version 183，Version 182
  保留 rollback，Web App URL 不變。推送候選為 56 個 Apps Script 檔案。
- GitHub Pages workflow `34410925756` 成功完成；公開房東首頁、房客、物件、合約、
  欠款、帳款頁與共用 `landlord-api.js`／`landlord-auth.js` read-back 均 HTTP 200。
  未登入 bridge smoke check HTTP 200 並正確回傳 bridge marker；未執行 Sheet、Drive、
  帳務或 LINE 寫入。
- 本次驗證：完整 Node `195/195`、Apps Script 全檔 syntax、static release-cache
  validator 與 `git diff --check` 通過。候選 validator 仍只報既有巢狀
  `tenant_payment_account_cover` handler 偵測限制，沒有新增 route 缺漏。
- 仍需 `HUMAN_REQUIRED`：房東以真實 Chrome／Email session 登入後，重新整理並逐一
  驗證總覽圖表、房客、物件與房間、合約、帳款／欠款，以及側欄 Workspace／角色狀態。
  HTTP 200、bridge smoke 與 deployment 版本本身不等於已登入桌面流程完成驗收。

## 2026-09-10 房東桌面多頁 API 讀取逾時修正正式部署

- `landlord_arrears`、`landlord_billing_init`、`landlord_contract_requests_init`、
  `landlord_properties_init`、`landlord_tenants` 與其他唯讀房東頁 route 現在都
  啟用同一個 request-local Sheet snapshot；同一次 API request 不再重複進行
  schema／Workspace／相同工作表讀取。未改登入、Sheet schema、帳務資料、Properties、
  Trigger、Drive 或 LINE 發送流程。
- PR #145 merge commit `ba44d10d2ee4c752f3c6cd646807af77b40a2647`；候選 commit
  `0c8e885` 已推送並建立 Apps Script immutable Version 182，更新目前公開頁使用的
  既有 Production deployment；Version 181 保留為 rollback，Web App URL 不變。
- GitHub Pages workflow `34380231863` 成功完成；前端公開頁沿用同一個 Production
  API endpoint。未登入 API／公開頁 read-back 為 HTTP 200，未執行 Sheet、Drive、LINE
  或財務資料寫入。
- 仍需 `HUMAN_REQUIRED`：房東以真實 Chrome／LINE 登入後，重新整理並逐一驗證總覽、
  房客、物件與房間、合約、帳款／欠款頁；HTTP 200 與 deployment 版本本身不等於
  已登入桌面流程完成驗收。

## 2026-09-09 桌面版房東 API 讀取逾時修正正式部署

- `landlord_home_bootstrap` 與 `landlord_tenants` 現在都啟用同一個
  request-local Sheet snapshot，避免單次 API request 重複掃描相同工作表；不改
  Sheet schema、帳務資料、登入、Properties、Trigger 或通知流程。
- 候選 commit `44c1abf`；Apps Script immutable Version 180 已更新目前公開頁使用的
  既有 Web App deployment，Version 179 保留 rollback，Web App URL 不變。
- 部署後兩個 landlord read route 的未登入唯讀 smoke check 均 HTTP 200；未帶入
  session、房客資料或任何寫入。GitHub Pages 本輪沒有前端程式變更，仍沿用既有
  已發布前端；已登入桌面版實際首屏／房客名單速度仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-09 房東入口過期登入與 file:// 回跳修復正式部署

- `landlord-entry.html` 對 LINE expired／invalid access token 顯示重新登入狀態，
  不再把房東導向註冊；按鈕立即鎖定，避免重複登入請求。
- 外部瀏覽器與本機 `file://` 測試的回跳不重播 OAuth `code`／`state`；無效的
  `file://` 回跳改用正式 GitHub Pages HTTPS 入口。未修改 Apps Script、Sheet、
  Email、LINE 發送或財務資料。
- PR #140 merge commit `17843ecae0094fbf15153bbca806a9aff347a0f7` 已合併；GitHub
  Pages workflow `34338782441` 成功，release marker 為
  `20260909-entry-expired-login-v1`。
- 公開 landlord／tenant entry assets read-back 均 HTTP 200，公開 source 已確認
  過期登入 renderer、HTTPS fallback 與 `entryReloginUrl(false)`；rollback 為
  回復前端至 `b5c086f`。真實 iPhone／外部瀏覽器登入回跳仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-07 匯款帳號前導 0 與銀行帳戶封面正式部署

- Workspace 收款帳號寫入現在先設定 Google Sheets 純文字格式 `@`，保留完整的
  前導 `0`；既有已被截掉的數字無法從舊值還原，房東需重新輸入一次完整帳號。
- 房東設定頁新增私有 JPG／PNG 銀行帳戶封面上傳；房客「我的帳單」與付款回報頁
  只顯示安全的封面可用狀態與檔名，圖片內容經已驗證的租客路由延遲載入，Drive ID
  不進入租客 payload。上傳前需設定 Script Property
  `CMWEBS_PAYMENT_ACCOUNT_COVER_DRIVE_ROOT_FOLDER_ID`。
- PR #127 已合併至 `main`，merge commit `f7c3361f257d032210ab5740022fddcde8168646`；
  既有 Production deployment `AKfycbwnnuIFZ22eO6MxMnWOYHovgMT2xuTbcIgzbq4qmxXE3gjGoTJFcBGXlsNDS-lqr3EILQ`
  已由 Version 172 更新至 immutable Version 173，Version 172 保留 rollback，Web App
  URL 不變。
- GitHub Pages workflow `34126765101` 成功完成；公開房客帳單頁與房東設定頁均 HTTP
  200，已 read-back 新路由、封面按鈕與上傳按鈕；未修改帳單、付款、Sheet 資料或
  LINE 發送。真實封面上傳、房客 LIFF／手機流程仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-07 房客付款回報金額一致性修正正式部署

- 房號 302 的回報顯示 `NT$8,790`、LINE 正式帳單顯示 `NT$7,145`；差額
  `NT$1,645` 與帳單折抵完全一致。根因是付款回報只讀取尚未同步折抵的
  `V2_tenant_bill_view`，而 LINE 帳單與銷帳均以 `V2_bills` 為準。
- 本地候選已把付款回報初始化與送出改為 `V2_bills` 主表優先；同一 bill ID 的過期
  view 不得覆蓋主表；全域主表缺少該帳單且 view 精確匹配房客 LINE UID 時才保留
  legacy 回退。主表列另要求 tenant／contract／room／Workspace 完整匹配。
- 跨 Workspace 同 ID、相關重複主表 ID 或主表身份衝突現在明確 fail closed，不再因
  runtime 先篩選房客列而誤判為可回退。Phase 140 已覆蓋上述負向案例及正式應繳
  `NT$7,145` 的 init／submit 一致性；同房客不同 bill ID 的舊合約帳單不阻擋目前帳單。
- PR #121 已以 merge commit `74ae25bc9df4e09895235b266e416f7d1b481ddf`
  合併至 `main`；合併結果完整 Node `138/138` 通過。正式 Apps Script 54 個程式檔案
  加 manifest 已推送，前端實際使用的既有 deployment 已由 Version 167 更新至
  immutable Version 168；Version 167 保留 rollback，Web App URL 不變。
- Version 168 匯出後與 `main` 的 `apps-script/` 逐檔 exact match；既有 Production
  URL HTTP 200，`tenant_payment_report_init` 無身份 guard 回傳 `MISSING_LINE_UID`。
  未修改既有帳單、付款回報或 Sheet 資料；Apps Script Sheet-backed 測試與手機／
  LIFF 真實房客流程仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-06 房東頁 API 韌性與切頁載入改善已發布

- 房東端共用 `landlord-api.js` 已正式發布：相同唯讀請求會合併，唯讀逾時或網路
  失敗最多補試一次；所有寫入操作仍只送出一次，避免帳務或通知重複寫入。
- 房客名單改為先完成主要名單讀取與畫面呈現，再補入合約請求資料，降低切頁時被
  次要 API 阻塞的等待感；既有 Email bridge 與 LINE JSONP 路徑均保留。
- PR #119 已以 merge commit `4e2ae896ad8fba6adbce729afc80cf535d4912f4`
  合併至 `main`；GitHub Pages workflow `34039861775` 的 build、deploy 與狀態回報
  均成功。
- 公開 `frontend-release.js`、`landlord-api.js` 與 `landlord-tenants.html` read-back
  均為 HTTP 200；已確認 release marker `20260906-landlord-api-resilience-v1`、共享
  client 與頁面引用存在。
- `npm run validate`、完整 Node `138/138`、`node --check landlord-api.js` 與
  `git diff --check` 均通過。本次為 GitHub Pages 前端-only 發布，Apps Script、
  Sheet、Properties、Trigger、帳單與 LINE 發送均未變更；真實手機／LIFF 操作速度
  與各 API 回應仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-06 202 清除金額完成提示與防重送 UI 已發布

- 根因確認：房東帳務頁的 `landlord_bill_apply_initial_rent_credit` 是寫入操作，
  但前端未鎖定按鈕，且沿用 JSONP 的自動重試；第一次寫入若已完成但回應逾時，
  再次點擊或自動重試可能造成「已完成後又顯示失敗」的誤導。
- 前端候選修正：寫入操作停用自動重送；每個 `bill_id` 增加處理中／已完成狀態，
  按鈕會顯示「處理中，請勿重複按」或「清除金額已完成」；成功後以明確完成提示
  告知，逾時只做一次唯讀帳單重新讀取確認，不再次送出寫入。
- Phase 230 UI 回歸、`npm run validate`、Apps Script syntax、完整 Node `132/132`
  與 `git diff --check` 通過；本次未修改正式帳單／Sheet 資料。
- PR #108 已以 merge commit `7009fcd` 合併至 `main`；GitHub Pages workflow
  `33985625051` build／deploy／status 均成功。公開 `landlord-billing.html` read-back
  HTTP 200，已確認完成提示、防重送與逾時唯讀確認程式均已發布。
- Apps Script 實際 deployment Version 161 不變；本次未修改正式帳單／Sheet 資料。
  真實房東操作與手機／LIFF UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-06 202 帳務折抵與欠繳身份修正重新部署至實際前端 deployment

- 根因確認：GitHub Pages 所有房東／房客頁實際引用的既有 Apps Script deployment
  仍 serving Version 158；前次 Version 160 更新的是另一個未被頁面引用的 deployment，
  因此手機仍看見舊行為。
- 修正折抵寫入：`V2_tenant_bill_view` 若有同 Workspace 的 legacy duplicate
  `bill_id`，折抵同步會更新同一帳單的所有同 Workspace view rows；若跨 Workspace
  collision 仍 fail closed，不把資料寫到其他 Workspace。
- 修正欠繳身份：若 `V2_bills.tenant_id` 是過期快照，優先用同 Workspace 房東名單的
  `room_id`／`room_name` 解析目前房客姓名，再回退 tenant／user identity。
- commit `b601e65` 已推送至隔離候選；正式 Apps Script 54 檔案已推送並建立
  immutable Version 161，前端實際使用的既有 deployment 已更新至 Version 161，
  Version 158 保留 rollback，既有 Web App URL 不變。
- 本地完整 Node `131/131`、Apps Script syntax、`git diff --check` 通過；Version 161
  逐檔 clone exact match，前端實際 URL read-back HTTP 200／`MISSING_LINE_UID`。
  未修改 202 或其他帳單／Sheet 資料；實際折抵按鈕操作與手機／LIFF UAT 仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-05 202 本月租金折抵與快速續約正式部署

- 已建立但未繳的本月帳單，若合約有明確的簽約收款月份／金額，正式 Version
  158 會在房東正常送出帳務更新時自動折抵租金；電費、設備耗損費、管理費與
  其他費用照原規則保留，已繳帳單不重算。房客可見折抵說明與房東明細同步。
- 房客名單對合約 60 天內、30 天內或已到期且有現行合約的房客顯示「快速續約」，
  以現行合約 ID、房客、房間與物件 context 進入 append-only 續約建立頁。
- PR #104 merge commit 為 `d5c9c4e`；Apps Script 54 個檔案已推送，公開頁所用
  的既有 deployment serving immutable Version 158，Version 157 為 rollback，
  Web App URL 保持不變。公開 endpoint read-only guard HTTP 200／`MISSING_LINE_UID`。
- Pages workflow `33924128412` 已成功完成；公開房客名單、帳務頁、房客入口與
  `frontend-release.js` read-back HTTP 200，已發布 marker 為
  `20260905-prepaid-rent-quick-renewal-v1`。本地隔離候選新增房東端共用 API
  resilience client，候選 marker 為 `20260906-landlord-api-resilience-v1`；
  此為當時候選狀態，已由本文件上方 PR #119 的正式發布紀錄取代。
- 本地完整 Node `92/92`、validator `71/71`、Apps Script syntax、static
  release-cache validator 與 `git diff --check` 通過。未修改正式 202 或其他
  房客／帳單資料，未執行 Sheet migration、Drive、Properties、Trigger 或 LINE。
  真實房東操作、202 帳務結果與手機／LIFF UAT 仍為 `HUMAN_REQUIRED` /
  `UNVERIFIED`。

## 2026-09-04 202 legacy-pending 紙本補登帳號復原正式部署

- 修正舊格式待啟用的 202 紙本補登在既有 `V2_tenants` 房客列已存在、但其
  `V2_users` 使用者列遺失時，提交會回傳「找不到既有房客使用者資料」的阻塞。
  僅在同一筆未綁定、`legacy_pending` 復原分支補建同一個房客的 tenant 使用者列；
  已綁定 LINE、跨 Workspace 或其他既有房客情境仍 fail closed。
- 正式 Apps Script 可編輯來源與候選逐檔核對，54 個原始檔中只有
  `V2_LANDLORD_PAPER_CONTRACT_BACKFILL.js` 為預期差異。本次 Git commit
  `378c517` 已推送 `main`；GitHub Pages workflow `33886721735` 已成功完成。
- 既有 Web App deployment 已由 immutable Version 155 更新至 Version 156，既有
  Web App URL 不變，Version 155 可立即 rollback。未執行 Sheet migration、
  Drive 上傳、房客／合約交易、Properties、Trigger 或 LINE 訊息。
- 本地 `npm run validate`、Apps Script syntax check、`git diff --check` 與完整
  Node suite `120/120` 均通過。真實手機／LIFF 的 202 補登與私有文件寫入仍為
  `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-04 紙本補登手機驗證輪詢修正正式部署

- 修正手機 LIFF 開啟 202 紙本補登頁後顯示「建立資料載入失敗／房東身分驗證
  連線失敗」的前端阻塞。原因是 Apps Script GET 302 轉址在手機 WebView 被誤判
  為非成功回應；房東驗證狀態與續約狀態查詢改用不帶 LINE UID 的 JSONP 兼容通道，
  保留一次性 `poll_secret`。
- 前端正式 commit 為 `884a066`，release marker 為
  `20260904-paper-contract-backfill-mobile-auth-v1`；GitHub Pages workflow
  `33801519730` 已成功完成 build、deploy、status。
- 公開頁 read-back：`frontend-release.js`、紙本補登頁、物件頁與三個房客入口均
  HTTP 200；確認手機 JSONP helper、`landlord_contract_signing_review_auth_status`、
  `legacy_pending_recovery` 與新 cache marker 均已發布。
- 本次為前端-only 修正；Apps Script 既有 immutable Version 153 未變更，Version
  152 仍為上一個可回滾版本。未執行 Sheet、Properties、Trigger、Drive、LINE 或
  202／其他房客交易資料寫入。
- 本地完整 Node suite `85/85`、候選 validator `83/83` routes／handlers、HTML
  links `214/214`、Apps Script syntax check 與 `git diff --check` 通過。真實手機／
  LIFF 登入與紙本補登交易仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-03 紙本補登入口修正正式部署

- 截圖所示的 202 房間卡片回傳「已出租／租約中」，因此原 Version 151 前端
  只在空房或未認領電子草稿時顯示紙本入口；這不是按鈕文字或 Pages 靜態檔
  缺失，而是有效合約判定與紙本補登情境的條件缺口。
- 候選版新增伺服器判定：若有效合約沒有同 Workspace 的 `V2_tenants` 對應列、
  且沒有 LINE 綁定，才顯示「補登紙本並建立房客登入」；送出時保留並關閉
  孤兒合約，新增紙本租約與未綁定房客，並以 `previous_contract_id` 留下關聯。
- 仍有房客資料、LINE 綁定、跨 Workspace 或合約狀態不符時維持拒絕。PR #100
  已合併至 `main`，merge commit 為 `c04ba24`；Apps Script source 已推送，既有
  Pages-targeted Web App deployment 已由 Version 151 更新至 immutable Version
  152，Version 151 保留為 rollback，Web App URL 不變。
- GitHub Pages workflow `33694799930` 已成功完成；公開
  `landlord-properties.html` 與 `landlord-tenant-create.html` read-back 均為
  HTTP 200，確認孤兒補登 marker、入口文字與 `orphan_recovery` 模式存在。
- 本地 `npm run validate`、完整 Node `83/83`、Apps Script syntax check 與
  `git diff --check` 均通過。未執行 Production Sheet、Drive、LINE 或房客資料
  交易；正式手機／LIFF 驗證仍為 `HUMAN_REQUIRED` / `UNVERIFIED`。

## 2026-09-03 202 紙本轉換與房客登入入口正式部署

- PR #98 merged the guarded `supersede_contract_id` path into GitHub `main` as
  merge commit `4b9ed04`. It accepts only a matching, unclaimed
  `landlord_initiated` electronic contract for the same Workspace, room and
  tenant.
- Apps Script source was pushed as 53 files, immutable Version 151 was created,
  and the existing Pages-targeted Web App deployment was updated from Version
  150 to Version 151. The Web App URL was preserved and Version 150 remains
  the rollback version.
- The property／room page now exposes the conversion entry for this exact
  `supersede_contract_id` path for a matching, unclaimed landlord-initiated
  pending-electronic case and carries the tenant／contract context into the
  paper form. The original contract and invite remain in the audit trail and
  are marked cancelled; the new paper contract links back through
  `previous_contract_id` and activates the pending tenant account as
  `unbound`.
- The completed page exposes the existing tenant LIFF URL so the landlord can
  send a login-binding entry without sending a LINE message. The Pages
  workflow `33691996413` completed successfully; public read-back returned
  HTTP 200 for the room page and paper-backfill page and found the new entry
  and login markers.
- Local Phase 209, Phase 210, Phase 211, Phase 212 and Phase 213 tests pass;
  Apps Script syntax checks pass. No Production Sheet, Drive, Property,
  Trigger, LINE or business-data transaction was performed. Authenticated
  mobile／LIFF and Production 202 data verification remain
  `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-03 landlord paper-contract backfill formal release

- PR #96 merged the landlord-only paper contract backfill flow into GitHub
  `main` as merge commit `b36ec4b`. The required signed paper contract file is
  stored privately; identity front/back files are optional and can be added
  later.
- The flow directly creates an active or upcoming append-only contract after
  server-side Workspace/RBAC, room vacancy, tenant scope, date, amount, file,
  and idempotency checks. It does not create `V2_contract_requests`, an
  electronic invite, a confirmation code, a signing session, or a LINE message.
- Empty-room entry is available from the property/room page; existing-tenant
  entry is available from tenant detail. The create page returns a paper-specific
  success state and never falls through to the electronic-invite success UI.
- Apps Script source was pushed as 53 files, immutable Version 150 was created,
  and the existing Web App deployment was updated from Version 149 to Version
  150; the Web App URL was preserved and Version 149 remains the rollback point.
- The additive migration completed in the authenticated Apps Script editor.
  Read-only Production Spreadsheet verification found the two
  `paper_backfill_*` headers appended to the existing `V2_contracts` header row;
  no contract rows were changed and no sheet was created.
- Legacy GitHub Pages build `1190728482` completed for `b36ec4b`. Public
  readback returned HTTP 200 for the release asset, landlord properties, tenant
  detail, paper-backfill create page, and tenant pages, and confirmed the
  `landlord_contract_paper_backfill` action, `手動補登紙本合約` entry, and cache
  key `20260903-paper-contract-backfill-v1`.
- Local Phase 209 runtime, Phase 210 UI, Phase 211 documentation, and Phase 212
  additive-migration tests passed, together with all Apps Script syntax checks.
  No Drive document upload, Properties/Trigger change, tenant transaction, or
  LINE message was performed. Authenticated mobile/LIFF and private Drive UAT
  remain `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-03 房東簡易新租約正式部署

- PR #94 已將房東簡易新租約入口合併到 GitHub `main`，merge commit 為
  `6302b25`。
- Apps Script 已從候選 worktree 推送 52 個檔案，既有 Web App deployment
  更新至 immutable Version 149；Version 148 保留為立即回滾版本，既有 Web
  App URL 不變。
- 簡易流程由房東填寫房號、租金、押金、租約起始日與租期月數；伺服器計算
  含首尾日的結束日，並沿用房間／Workspace 預設的管理費、付款日、電費與
  設備耗損費。未新增 Sheet 欄位，未執行 migration，未改動既有合約、房客、
  帳單、Drive、Properties、Triggers 或 LINE 資料。
- GitHub Pages workflow `33656914943` 已完成 build、deploy、status；公開
  read-back 的房客名單、簡易新租約頁與 release asset 均 HTTP 200，並確認
  `simple_new` 入口、`建立簡易新租約` 標題與 immutable cache key
  `20260903-simple-new-lease-v1`。
- Production API 唯讀 probe 回應 HTTP 200／`MISSING_LINE_UID`，證明正式
  deployment 可達且未送出身份或寫入資料。版本凍結驗證為 Node `77/77`、
  validator `83/83` routes／handlers、duplicate declarations `0`、credential
  findings `0`、HTML links `214/214` 與 `git diff --check` 通過。
- 已登入 LIFF／手機、房客證件上傳／簽名、正式房東建立新租約與房客簽署仍為
  `HUMAN_REQUIRED` / `UNVERIFIED`；本次部署沒有建立測試租約或發送 LINE。

## 2026-09-02 landlord checkout settlement formal release

- PR #92 merged the landlord checkout settlement and Sheet Date normalization
  candidate into GitHub `main` as merge commit `a2682b3`.
- Apps Script source was pushed as 52 files. The existing Web App deployment now
  serves immutable Version 148; Version 147 remains the immediately previous
  rollback version and the Web App URL was preserved.
- The additive migration function
  `runV2CheckoutSettlementProductionMigration` completed in the authenticated
  Apps Script editor. Read-only Spreadsheet verification found the new
  `V2_checkout_settlements` sheet with its settlement headers and no settlement
  data rows; existing contract, tenant, bill, Property, Trigger, Property
  setting, and LINE data were not changed.
- GitHub Pages workflow `33648496168` completed build, deploy, and status jobs
  for `a2682b3`. Public readback returned HTTP 200 and found the checkout
  settlement form, server preview action, start/end meter fields, two private
  photo upload actions, deposit deduction, and the immutable cache key
  `20260902-landlord-checkout-settlement-v1`.
- Local verification at release freeze: full Node suite `76/76`, authoritative
  validator `83/83` routes and handlers, duplicate declarations `0`, credential
  findings `0`, and `git diff --check` passed. `npm run validate` was not
  applicable because this isolated worktree has no `package.json`.
- Authenticated LIFF/mobile checkout, real private Drive upload, and a real
  502/506 checkout transaction remain `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-02 landlord checkout settlement local candidate (released)

- Candidate branch: `codex/checkout-settlement-20260902`. The approved manual
  landlord checkout settlement is implemented locally with the cache key
  `20260902-landlord-checkout-settlement-v1`.
- The candidate adds server-side inclusive settlement calculation, prior unpaid
  utility carryover, meter-based current utilities, deposit offset/refund,
  append-only `V2_checkout_settlements`, and private start/end meter evidence.
  Existing contracts and `V2_bills` remain immutable.
- Bill-month sources now normalize Google Sheets Date values and exclude paid or
  voided bill statuses; fee resolution preserves explicit contract rates and
  falls back to the existing room／Workspace month settings when absent.
- Checkout initialization and target validation also normalize contract start／end
  Date values to `YYYY-MM-DD`, so a Sheet Date cannot become a browser-invalid
  full Date string.
- Local Phase 202／205／206／207 tests and checkout-page JavaScript parsing pass.
  The additive migration entry point is
  `runV2CheckoutSettlementProductionMigration`; it has not been run against the
  Production Spreadsheet.
- At candidate freeze this had not yet been pushed, merged, deployed to Apps
  Script, or published to GitHub Pages. The formal release above supersedes that
  temporary state; no contract, tenant, bill, Drive, Trigger, Property, LINE
  setting, or LINE message was changed by the release.
- Authenticated LIFF/mobile checkout, real private Drive uploads, exact
  Production Sheet schema, and 502/506 operational data remain
  `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-02 landlord-led renewal and checkout formal release

- PR #90 merged the landlord-led renewal and landlord-only checkout flow into
  GitHub `main` as merge commit `3d8647d`.
- Apps Script was pushed as 52 files and the existing Web App deployment now
  serves immutable Version 147. The Web App URL is unchanged and Version 139
  remains the rollback reference.
- The additive-only renewal/checkout schema migration was run from the
  authenticated Apps Script editor and completed. No contract or tenant rows,
  Properties, triggers, or LINE data were changed by the migration or release;
  only missing schema headers were eligible for addition.
- GitHub Pages workflow `33567151637` completed build, deploy, and status jobs.
  Public readback returned HTTP 200 for the release asset, tenant detail,
  landlord checkout, contract requests, tenant contract, and tenant
  termination pages, with the new cache key and flow markers present.
- Local verification passed with the authoritative 83-route inventory and full
  Node suite `73/73`. Authenticated LINE/mobile renewal, signing, and checkout
  acceptance remain `HUMAN_REQUIRED` / `UNVERIFIED`.

## 2026-09-02 expired tenant renewal recovery formal release

- The Workspace-native landlord tenant list now falls back to the latest
  renewal-eligible predecessor when no contract is currently effective but an
  operational tenant's contract has expired. This restores the tenant card and
  manual renewal entry without making the expired contract current or changing
  its immutable history.
- Phase 201 adds runtime coverage for the reported boundary and rejects future
  active contracts from this fallback.
- PR #88 merged as `272f675c`. Apps Script was pushed as 51 files and the
  existing production Web App deployment now serves Version 146. Version 139
  remains the rollback reference; the Web App URL is unchanged.
- No Production Sheet row, contract status, Property, Trigger, LINE setting or
  LINE message was changed. GitHub Pages was not changed because no frontend
  source was required for this backend read-model repair.
- Local verification passed with the worktree's current 83-route inventory,
  full Node suite `70/70`, Apps Script syntax checks and `git diff --check`.
- The exact 502 Production data state and authenticated LINE/mobile acceptance
  remain `HUMAN_REQUIRED`; a logged-in landlord must confirm that 502 is visible
  again and that its old contract opens the renewal form.

## 2026-09-02 renewal fee prefill corrective release

- Fixed the `從此合約發起續約` path so the predecessor rent, management fee,
  deposit months, deposit amount, payment day, electricity fee rate, equipment
  loss fee rate, optional 30-day clause, and note remain available when the
  form switches into renewal mode.
- The room summary now carries those predecessor contract fields, and the
  frontend prefers the complete `renewal_source` before falling back to the
  room summary. This prevents the room summary from masking the complete
  contract data returned for a selected predecessor.
- PR #86 merged the fix into GitHub `main` as `72542bc`.
- Apps Script was pushed as 51 source files and the existing public Web App
  deployment now serves immutable Version 145. The Web App URL was preserved;
  Version 139 remains the rollback reference. No Script Properties, Trigger,
  LINE setting, contract row, or manual Sheet migration was changed.
- GitHub Pages workflow `33555883954` completed successfully. Public readback
  returned HTTP 200 and confirmed cache key
  `20260902-renewal-date-prefill-v2`, complete-source preference, and fee-field
  prefill markers on the renewal page.
- Local verification passed: full Node suite `69/69`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, Apps Script syntax checks, and `git diff --check`.
- Exact production Sheet header state and authenticated LINE/mobile contract
  acceptance remain `HUMAN_REQUIRED`; public readback does not prove a
  logged-in contract transaction.

## 2026-09-02 renewal date prefill formal release

- Renewal forms now use the predecessor contract end date itself as the new
  lease start date. The end date is then calculated with the existing inclusive
  one-year rule (`start date + one year - one day`), so `2026-09-30` becomes
  `2027-09-29`. The change applies to direct renewal defaults and expiry-draft
  defaults; the new-lease flow and other renewal fields are unchanged.
- The onboarding response now normalizes Sheet date/timestamp values before
  they reach the HTML date inputs, including timestamps such as
  `2026-10-02T16:00:00.000Z`.
- PR #83 merged the candidate into GitHub `main` as `52d4175`.
- Apps Script was pushed as 51 source files and the existing public Web App
  deployment now serves immutable Version 144. The Web App URL was preserved;
  Version 139 remains the rollback reference. No Script Properties, Trigger,
  LINE setting, contract row, or manual Sheet migration was changed.
- GitHub Pages workflow `33553714995` completed successfully. Public readback
  returned HTTP 200 for the renewal form, release asset, and tenant-detail
  entry, and confirmed cache key `20260902-renewal-date-prefill-v1` plus the
  predecessor-end-date prefill logic.
- Local verification passed: full Node suite `69/69`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, Apps Script syntax checks, and `git diff --check`.
- Exact production Sheet header state and authenticated LINE/mobile contract
  acceptance remain `HUMAN_REQUIRED`; public readback does not prove a
  logged-in contract transaction.

## 2026-09-02 tenant-detail direct renewal signing formal release

- The primary renewal entry is now the tenant journey: tenant list → tenant
  detail → contract version → `發起續約`. Eligible active, expired, approved
  and completed versions hand off their exact predecessor `contract_id` to the
  one-page renewal form. The contract request page remains the review,
  invitation and signing-status surface.
- The direct route creates an append-only renewal version, carries the fixed
  contract template and optional 30-day non-renewal clause, and immediately
  creates the tenant signing invite. The predecessor is not archived until the
  new contract is signed and landlord approval is completed.
- PR #81 merged the candidate into GitHub `main` as `938b39d`.
- Apps Script was pushed as 51 source files and the existing public Web App
  deployment now serves immutable Version 143. The Web App URL was preserved;
  Version 139 remains the rollback reference. No Script Properties, Trigger,
  LINE setting, or contract row was changed, and no manual Sheet migration was
  run. The code retains an additive header guard for the new fields.
- GitHub Pages workflow `33547890200` completed successfully for `938b39d`.
  Public readback returned HTTP 200 and found the tenant-detail renewal entry,
  direct renewal route, special-offer clause, request review page, and release
  cache key.
- Local verification passed: full Node suite `68/68`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, Apps Script syntax checks, and `git diff --check`.
- Exact production Sheet header state and authenticated LINE/mobile contract
  acceptance remain `HUMAN_REQUIRED`; the public/API checks do not prove a
  logged-in contract transaction.

## 2026-09-01 landlord homepage timeout corrective release

- Fixed the landlord homepage bootstrap read path so the payment and message
  read helpers reuse the existing request-local runtime snapshot instead of
  reading the same Google Sheets again within one request. This is a read-only
  performance repair; no contract, billing, Sheet row, Property, Trigger, or
  LINE data was changed.
- PR #79 merged the repair into GitHub `main` as commit `d9c371c`.
- Apps Script was pushed to the verified production project and the existing
  fixed Web App deployment was updated to immutable Version 142. Version 139
  remains the recorded previous release target; the Web App URL was preserved.
- GitHub Pages workflow `33483720012` completed successfully for `d9c371c`.
  Public `landlord-home.html` readback returned HTTP 200 and retained the
  timeout-retry and dashboard request markers. A safe anonymous API readback
  returned HTTP 200 with the expected JSONP callback and access-denied result.
- Local verification passed: full Node suite `66/66`, project validation
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, and `git diff --check`.
- Authenticated LINE/mobile 603 UAT remains `HUMAN_REQUIRED`; the anonymous
  readback does not prove the logged-in landlord's full dashboard data load.

## 2026-09-01 landlord-led renewal consent formal release

- The isolated candidate changes expiry renewal handling to a landlord-led
  consent flow. The landlord reviews the append-only one-year draft, can edit
  dates／amounts／payment day and choose the optional 30-day offer, then sends a
  tenant inquiry. The tenant's accepted response is required before a signing
  invite can be created.
- PR #76 merged the feature into GitHub `main` as commit `52b75b8`; PR #77
  updated all 36 production HTML API references and merged as `ceeede8`.
- Apps Script was pushed to the verified production project and published as
  immutable Version 140 in a new fixed deployment because the old HEAD
  deployment is read-only. The old endpoint was retained; Version 139 remains
  available as the previous immutable release. No Sheet migration, Script
  Properties, Trigger, LINE push, or contract-data write was performed.
- GitHub Pages workflow `33456765735` completed successfully for `ceeede8`.
  Public readback returned HTTP 200, found the landlord inquiry/signing UI,
  and confirmed the public HTML points to the Version 140 deployment.
- Read-only API smoke returned `RENEWAL_INTENT_INPUT_REQUIRED` for an empty
  renewal-intent POST, confirming the new dispatcher is serving without
  mutating production data. Local Phase 196 and the updated Phase 157 runtime
  regression passed; full Node suite `65/65`, project validation `83/83`, and
  `git diff --check` passed.
- Authenticated LINE/mobile room-603 UAT and production Sheet schema
  migration remain `HUMAN_REQUIRED`.

## 2026-09-01 renewal-draft date-correction release

- The renewal-draft date correction candidate was merged to GitHub `main` by
  PR #74 as commit `3f6af93635742685da3272a81485b91a62d750f1`.
- Apps Script was pushed as 51 source files and the existing Web App deployment
  was updated to immutable Version 139. The existing Web App URL was
  preserved; Version 138 remains the verified rollback target. No Sheet,
  Script Properties, Trigger, LINE configuration, or contract data migration
  was performed.
- GitHub Pages workflow `33449180375` completed successfully for the merged
  `main` commit. Public readback returned HTTP 200 and found `修改續約日期`
  plus the manual-signing correction guidance.
- The public Apps Script route readback recognized
  `landlord_contract_renewal_draft_update` and returned the expected
  POST-session guard for a GET request. This verifies routing only; no
  production contract was edited.
- Local verification passed: full Node suite `64/64`, candidate validator
  `71/71` routes and handlers, duplicate declarations `0`, credential scan
  `0`, JavaScript syntax checks, and `git diff --check`.
- Real authenticated LINE/mobile date-edit acceptance remains
  `HUMAN_REQUIRED`. Exact correction of any existing 603 or other contract
  still requires the user to provide the target contract and correct dates.

## 2026-08-28 room-603 contract-history corrective release

- The Workspace-native `landlord_tenants` route repair was merged by PR #59 as
  commit `c79030f`. The landlord tenant-detail rendering follow-ups were merged
  by PRs #60, #61, and #62; the final merged `main` commit is `7711dea`.
- Apps Script Version 131 is serving on the existing Web App deployment. The
  existing Web App URL was preserved; no new URL was created. No schema or
  tenant-data migration was run for this read-model/UI-only repair.
- GitHub Pages workflow `33099332347` completed build, deploy, and status-report
  jobs for the final merged commit. Public room-603 smoke readback now renders
  `房客合約` → `合約版本紀錄`, one existing contract-version card, and one
  `查看完整合約與簽名` action; the page error card and browser console errors
  were both absent.
- Local verification passed: full Node suite `56/56`, candidate validator
  `83/83` routes and handlers, duplicate declarations `0`, and credential scan
  `0`.
- This is public/test-mode and authenticated browser-extension evidence only.
  Real authenticated LINE/mobile signing acceptance remains `HUMAN_REQUIRED`.

## 2026-08-27 formal renewal-history release

- The renewal contract-history candidate was merged to GitHub `main` by PR #56
  as commit `74524166aead730a2eaa07e85950102ca2201c39`.
- Apps Script Version 130 is serving on the existing Web App deployment. The
  existing Web App URL was preserved; no new URL was created.
- The additive-only production schema migration was run twice from the
  authenticated Apps Script editor and both executions completed successfully.
  The runner appends only missing headers and does not delete or rewrite old
  contract versions.
- GitHub Pages workflow `33054940344` completed successfully for the merged
  `main` commit. Public readback found `房客合約`, `合約版本紀錄`, and
  `查看完整合約與簽名` in the landlord tenant-detail page.
- Local verification passed: full Node suite `55/55`, candidate validator
  `83/83` routes and handlers, duplicate declarations `0`, credential scan `0`,
  and `git diff --check`.
- `HUMAN_REQUIRED`: authenticated real LINE/mobile room-603 UAT and actual
  landlord/tenant contract interaction remain unverified.

## Gate 0 / Production Consolidation

`GATE_0=PASS` for canonical source reconciliation.

The approved source commit
`9a17c4bd2719d4cdb24058d4d797bd9281e4b06e` was reconciled with a read-only
immutable Apps Script Version 89 export. All 43 source files are
byte-identical. GitHub PR #12 then merged that exact source tree into canonical
`main` as merge commit
`747b484f871c18985cf414e6640ae04afe8303a1`.

| Gate item | Verified state | Evidence reference |
| --- | --- | --- |
| Immutable serving-source export | PASS | Read-only Version 89 export, 43 source files. |
| Export-to-approved-source comparison | PASS | Approved commit `9a17c4b` is byte-identical to the Version 89 export. |
| Canonical Git reconciliation | PASS | PR #12 merge `747b484` has the same source tree as `9a17c4b`. |
| Static source validation | PASS | 42 JavaScript syntax checks, eight focused checks, diff check, and sensitive-credential scan. |
| Unique canonical source | PASS | GitHub `main` is the canonical source record for the reconciled Version 89 tree. |

This evidence proves source reconciliation only. It does **not** prove a fresh
Production deployment, runtime/UAT result, current Apps Script serving version,
current rollback version, Google Sheets state, Properties, triggers, LINE/LIFF,
or GitHub Pages state.

## 2026-08-12 read-only Production identity reconciliation

The current authenticated Apps Script editor was checked read-only under
`cmwebs.saas@gmail.com`. The project shown was `綠界結帳`; its active Web App
deployment was Version 102, with the description `Production V102: ignore
incomplete tenant payment bill rows`. The deployment executes as the owner and
is accessible to everyone. The deployment identifier is intentionally not
duplicated here.

The editor listed 42 `.gs` files. GitHub `main` at merge `0bbbe06e` listed 42
corresponding `.js` files after suffix normalization. This is an inventory
comparison, not a byte-level source export. The complete evidence is recorded
in [125-PRODUCTION-IDENTITY-RECONCILIATION-2026-08-12.md](125-PRODUCTION-IDENTITY-RECONCILIATION-2026-08-12.md).

The Phase 147 GitHub Pages deployment completed successfully in workflow
`31601674513`, and the four public tenant pages were fetched successfully. This
read-only package did not identify a rollback version and did not inspect or
change Sheets, Properties, triggers, LINE, LIFF runtime state, or payment data.

## Serving and rollback references

- **Canonical source baseline:** the Version 89 source tree described above,
  reconciled to GitHub `main` by PR #12.
- **Current Apps Script serving version:** Version 145, read back from the
  existing Web App deployment on 2026-09-02 after the renewal fee-prefill
  corrective release. This is deployment identity evidence, not a real-device
  UAT result.
- **Current Apps Script rollback version:** Version 139, the prior serving
  version retained on the same Web App deployment.
- **GitHub Pages:** the renewal fee-prefill corrective release at merged `main`
  commit `72542bc` completed successfully in workflow `33555883954`; public
  readback found the tenant-detail renewal entry, direct renewal form, fee
  prefill logic, and cache key `20260902-renewal-date-prefill-v2`.
- **Production editor source:** an open Apps Script editor does not prove what
  immutable version is serving. Deployment metadata and a scoped source export
  are authoritative.

## 2026-08-25 tenant fixed-template signature preview release

This authorized work unit completes the fixed Google Docs template path for the
tenant contract signing surface. The configured fixed template remains the
content source; the original template is not modified. Submission materializes
a private signed copy, writes the stored signature artifact into the signed
document, and the mobile read model returns the private signature image for the
tenant preview after successful submission.

### Verified release evidence

- Apps Script was pushed to the verified target project and the existing Web
  App deployment was updated to immutable Version 125. No new Web App URL was
  created. No Sheets, Script Properties, trigger, LINE configuration, or
  tenant data migration was performed in this work unit.
- GitHub Pages commits `b4d164d`, `d719eb9`, and `9e18425` completed the
  signature-preview and cache-busting changes. Workflow `32793428257` passed
  build, deploy, and status-report jobs.
- Public readback returned HTTP 200 for `tenant-contract.html`; the three
  tenant entry pages load the versioned `frontend-release.js` asset, whose
  release value is `20260825-tenant-signature-preview-v1`.
- Local verification passed: focused tenant signing UI test, full Node suite
  (`48 pass, 0 fail`), project validator (`81/81` routes and handlers,
  duplicate declarations `0`, credential scan `0`), and `git diff --check`.

### Remaining gate

`HUMAN_REQUIRED`: an authenticated real LINE/mobile room-603 submission and
post-submit preview has not been verified. Directly opening a nested tenant
page outside the LIFF entry reproduced LINE 400 because the current URL is not
under the configured LIFF endpoint; the tenant must reopen from the official
LIFF entry, not a copied nested page URL. The separate direct deep-link
redirect hardening remains a follow-up risk and was not included in this
release.

## Historical reconciliation context

The following is retained as historical evidence, not as current serving or
rollback status:

- On 2026-07-30, read-only Version 87 and Version 85 source comparisons
  reconciled the reminder repair, legacy signed-contract sync bridge, and
  related schema/dispatcher compatibility work to then-current `main`.
- That historical record included a 69-tab schema metadata capture,
  presence-only Script Properties inventory, existing trigger inventory, and a
  69-route/handler baseline.
- The previously recorded Version 85 rollback reference applied to the
  Version 87 reminder repair only. It must not be treated as a current
  rollback target.

## V2.1 authorization boundary

V2.0 remains the internal Production baseline. Gate 0 completion does not
authorize implementation or external operations.

On 2026-08-03, local documentation-baseline synchronization was authorized.
On 2026-08-04, a separate local-only candidate enabled the existing
request-local snapshot for `landlord_home_bootstrap`, with a focused mock. Both
are isolated, unpushed source records; neither permits Production read/write,
deployment, GitHub Pages publication, account action, or runtime/UAT claims.
V2.1 work remains bounded by
`CMWEBS_PRODUCT_ROADMAP.md`, `CMWEBS_ARCHITECTURE_DECISIONS.md`, and
`CMWEBS_RELEASE_RULES.md`; every later work unit needs its own explicit scope
authorization.

## New-conversation handoff

```text
Project: CMWebs 智慧租管 / cmwebs-liff
Read AGENTS.md and all docs/CMWEBS_*.md files first.
Recommended model: gpt-5.6-terra; speed: medium.

The latest isolated worktree is
`codex/fix-fixed-contract-template-20260825` at `9e18425`, clean after the
handoff documentation commit if present. The root aggregate worktree remains
user-owned and dirty; do not clean or reset it.

The authorized fixed Google Docs template tenant-signature-preview release is
deployed: Apps Script Version 125 on the existing Web App deployment and
GitHub Pages workflow `32793428257` for commit `9e18425`. Public asset
readback and local tests pass. This does not prove authenticated LINE/mobile
room-603 UAT. The next action is to use the official LIFF entry on a real LINE
device, submit the signed fixture, and verify both the success state and the
signature image in the mobile preview and private signed Google Doc.

If that UAT still fails, first capture the authenticated browser/network
evidence; do not redeploy Apps Script or change Sheets/Properties blindly. The
direct nested-page LIFF 400 and deep-link redirect hardening remain separate
follow-up work.
```
