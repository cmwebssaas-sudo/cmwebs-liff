# 房東登入復驗與讀取效能修復

## 2026-10-13 500 房本地計算準備（正式驗收未開始）

20 物件、500 自有房間、250 在住租約／房客、兩月合計 500 bills 經實際本地
workerd／D1 對帳，七個入口 JSON 與原 GAS 完全一致。獨立 literals：應收 3,948,000、
已收 1,932,000、未收 2,016,000、欠款列 252；外 Workspace 及私密 canary 不進回應。
原版房客 p95 99.173ms 未達既有 50ms，保留失敗。三個診斷樣本各有 2,252 次日期
格式化，其中 61–87ms 用在格式化；只重用 request-local Intl formatter 後，整套
Worker 31/31 通過，同一合成案例每入口 100 樣本的 p95 如下：

| 入口 | 本地 HTTP／D1 p95 ms |
| --- | --- |
| home | 25.690 |
| actions | 20.732 |
| revenue | 21.754 |
| tenants | 41.669 |
| rooms | 31.105 |
| arrears | 29.892 |
| properties | 28.305 |

固定 access 與全表 test loader 不代表 C3 權威／真實 provider／scoped loader、台北網路、
遠端 500 房或真機。格式化不快取日期值或正向授權；Date mutation、時區／錯誤及 DST
語意另測。比較指紋已重生，沒有重用舊觀察窗口；六開關 off，實際 shadow／cutover
NOT_STARTED。C1 已停止的失敗不能用舊完成日期冒充新 72 小時門檻。

## 2026-10-12 C6 驗收準備（未切換）

建議模型／速度：GPT-6.1 Sol／高，依核准工作計畫。C6 獨立分支
`codex/c6-read-acceptance-20261012`，逐頁步驟見 `READ-CUTOVER.md`。
目前六個旗標皆 off；C5 真實七天觀察尚未開始，C6 實測與真機验收尚未開始。
C1 舊真實同步已停止且未通過；修正來源的新72小時觀察尚未開始。本機／CI通過
不能替代每日耗時、遠端讀回與實體操作。

切換順序為房源、房客、物件、欠款、營收、首頁。每頁通過之前的實際門檻後，
依批次授權發布讀回，再請本人於手機LINE與桌面操作。記錄請求到標頭、完整解碼
及可互動時間的各自口徑，包含每次不快取的GAS權威授權。首頁全部摘要從主請求
起點到最後摘要完成累計，不用單一請求／中位數代替。目標主資料及房間≤800ms、
全部摘要≤1500ms；未量測、逾時、fallback、缺少事件與未達標都須如實保留。
以下2026-10-11數值是歷史v229觀察，不能當作本次Cloudflare改善結果。

## 正式發布狀態（2026-10-11）

使用者確認「發布，接著重測登入、首頁與房間清單」。重新讀回正式部署 v228、
其他四部署 HEAD／160／10／139；serving v228 與 editor HEAD 匯出皆為 63 檔，
與當時 origin/main 完全相同。只推送下述三檔差異，建立 immutable v229，
匯出 63 檔與 `7ea6b5b` 逐位元一致後切換原 deployment。正式讀回為 v229，
URL 與其他四部署不變。保留 rollback v228；129 個既有版本皆未刪除。

發布前 fresh suite 786 pass／0 fail／4 外部 Core skip，validate 通過。
PR #256 已合併為 `e3e51c2`，Pages workflow `38096070415` 成功；
51 個公開前端檔與來源逐位元一致。使用者在新驗收頁自行完成 Email 登入後，
已完成下列唯讀實測。OTP 流程未擷取，沒有讀取或保存驗證碼。
以下「本機候選」與「發布與回退」保留為發布前歷史紀錄；以本節為現況。

## 發布後登入與畫面驗收（2026-10-11）

同一帳號、Chrome 桌面、新登入分頁；原分頁由其他瀏覽器工作階段使用，未操作。
測量口徑與修補前一致：請求送出至回應標頭，包含網路、Google 與後端；
不是完整畫面可互動時間、單獨 Sheets 耗時、p95 或多人壓測。

| 流程 | 修補前 | v229 實測 | 判定 |
| --- | --- | --- | --- |
| Email session 復驗 | 24.999 秒中止、未收到標頭 | 4.357、3.819 秒，均進入首頁 | 本輪觀察改善 |
| 物件／房間清單 | 12.059、11.697 秒 | 5.998、8.451 秒；刷新 5.782 秒 | 本輪觀察改善，仍需數秒 |
| 首頁主資料，成功樣本 | 9.745 秒 | 9.347、8.508 秒 | 仍慢 |
| 首頁最後一個次要摘要，從首頁主請求起算 | 累計 22.014 秒 | 累計 21.737、19.595 秒 | 整體速度未達標 |

第一次復驗成功後，首頁主 API 雖在 10.223 秒收到 HTTP 200 標頭，畫面仍顯示
「首頁資料讀取失敗／API 載入逾時」。手動重新整理成功，後兩次回首頁亦正常。
這筆失敗保留，不以 HTTP 200 當功能成功；尚無證據判定是哪個平台或 bridge
環節造成，也不能判定為本次修補新增。一次房間刷新與第二次登入復驗的 UI
成功但網路事件缺失，排除於秒數比較，不記為零秒。

首頁程式仍先等 `section:home` 完成，才並行要求營收與 `section:actions`；
實測亦顯示後續請求較晚啟動。這能解釋累積等待，但不能據此分配 Google
平台、Sheets 與後端的各自耗時。下一輪修復應處理首頁讀取與摘要啟動路徑，
並追查橋接回應逾時；不能宣稱搬到 AI-00 就能解決。

結論：v229 發布驗證通過；登入復驗與房間清單在本輪改善，**整體效能驗收
未通過**。仍有首頁長等待及一次逾時，不能宣稱已達一般 APP 反應速度或具備
對外訂閱併發容量。未量測新 OTP 寄送／驗證耗時、手機 LINE 或負載壓力。
最終頁面為已登入且摘要顯示完成的首頁；已停止網路擷取。
去識別化原始秒數與排除樣本見 `landlord-read-performance-measurements.json`。

建議模型／速度：`gpt-5.6-terra`／`medium`。範圍：V2.0 現有登入與讀取穩定性。
2026-10-11 本機候選，基底 `3cb7d45cb00435c5cb30a719bbf81a3d9ac1e9a6`；
分支 `codex/cmwebs-read-performance-20261011`。未 push、merge 或部署。

## 正式站修補前觀察

2026-10-11 台北時間約 07:00–07:07，以原有 Chrome Email session 點擊正常
唯讀流程。以下是請求開始到回應標頭的時間，包含網路、Google 平台與後端，
不能當成單獨的資料庫時間，也不是多人壓測或 p95。

| 正常流程 | 單次觀察 |
| --- | --- |
| More 摘要 | 各並行 API 約 5.013–12.392 秒 |
| 首頁初始摘要 | 9.745 秒 |
| 首頁後續動作摘要 | 初始摘要後才開始，累計約 22.014 秒 |
| 物件／房間首次、刷新 | 12.059、11.697 秒 |
| 房客與合約清單 | 5.992、6.836 秒，並行 |
| 既有 Email session 復驗 | 24.999 秒中止，未收到回應標頭，回到 Email 登入表單 |

公開五個相關前端檔案與此基底相同；靜態 JS/CSS 約 0.326–0.364 秒。
本輪未新寄 OTP、未讀取驗證碼、未做帳務或通知操作；手機 LINE 與全新登入
未驗證。另一次導向 LINE Login 的測試不具可比性，排除於上述數據。
測試後原有 More 頁正常載入。此輪尚未重新匯出正式後端，不能以來源推論
現在部署版本或精確後端耗時。

## 根因與修補

- `landlord_email_session_status` 原本先解析 principal，再呼叫會執行同樣
  完整驗證的 session handler。改成必填欄位檢查後，直接執行一次完整驗證。
- Session status 與 `landlord_subscription_init` 原本不在讀取名單，反覆
  進行 Schema ensure、讀表與 last-seen 寫入，結束時還會清除其他讀取的
  共用快取世代。兩者改為**僅請求內重用**，每次請求仍重新從 Sheets 讀取
  session、使用者、Workspace 與 membership；不讀取／寫入跨請求表格快取。
- Status 不更新 `last_seen_at`／`request_id`；讀取時發現過期直接拒絕，
  不為標記 `expired` 再寫 Sheet。撤銷登入與既有寫入流程仍持久化 metadata
  並使共用快取失效。`expires_at` 的驗證不依賴持久化 status 是否已改成 expired。
- 既有共用讀取路徑每個請求只取得一次快取世代，避免每張表重複查詢
  CacheService。下一個請求會重新取得世代，寫入後的失效機制保留。
- 訂閱 Core 仍每次即時查詢並驗證 grant；未新增訂閱快取、未改額度或收費規則。
- 缺少 auth Sheet 或 Sheets 讀取失敗時，status 回 `AUTH_UNAVAILABLE`；
  subscription summary 回 `SUBSCRIPTION_UNAVAILABLE`，均維持受控 bridge
  格式並清除請求狀態，不讓前端等到 iframe timeout，也不自動建表。

前端、25 秒 timeout、API URL、Schema、Properties、triggers、LINE 均未修改。
沒有把其他路由擴入讀取名單，也沒有改變它們原有的短期快取策略。

## 可重現的本機差異

新測試載入真實 dispatcher、Email auth、Workspace、snapshot、Core summary
與 room capacity 模組；只模擬 Google service 邊界及無關路由前置分派。
使用完整合成 Schema 和假資料，沒有連接正式試算表。

| 操作 | 基底來源 | 修補後 |
| --- | ---: | ---: |
| Session status 整表讀取 | 16 | 5 |
| Session status 表頭讀取 | 82 | 0 |
| Session status 單格寫入 | 4 | 0 |
| Session status token 驗證 | 2 | 1 |
| Legacy 訂閱摘要整表讀取，含房間數 | 9 | 6 |
| Legacy 訂閱摘要表頭讀取 | 31 | 0 |
| Legacy 訂閱摘要單格寫入 | 2 | 0 |
| 兩條唯讀 API 造成共用快取世代失效 | 各 1 | 0 |
| 一次讀取兩張業務表的快取世代查詢 | 2 | 1 |

這是服務操作次數差異，不能宣稱正式站已從 25 秒降到幾秒。
最初 16 項新測試在未改動基底的暫存來源副本上為 11 pass／5 fail；修補後
16／16 pass。獨立審查再發現缺少 auth Sheet 時會回純 JSON 而使 bridge 逾時；
新增兩項測試先重現失敗，再修為受控錯誤。最終新增 18／18 pass。最初先寫測試再修改來源，確認失敗原因是重複驗證、Schema
讀取、唯讀寫入與重複快取世代查詢。

驗證：完整 `npm test` 為 786 pass／0 fail／4 skip；4 項 skip 是需要另設
`PLATFORM_CORE_TEST_WORKTREE` 的跨 repository HTTP 測試。新測試已另外覆蓋
即時 Core 成功／503、Workspace 房間隔離、logout、撤銷、過期、停權、變更
角色／Workspace、偽造請求欄位、快取不可用／損壞與寫入後讀取。
`npm run validate` 通過（63 backend files／38 endpoint references）；
62 份 JS 合併語法檢查與 `git diff --check` 通過。
此為本機 Apps Script runtime 測試，未在 Google 執行會寫 Schema、寄信或
發 LINE 的 editor test function。
獨立審查的缺表 bridge 問題已修正；複查定向 52／52 通過，未發現新增阻擋
問題。審查另測非 bridge 訂閱錯誤仍維持 JSON、零寫入與一次狀態清理。

## 發布與回退

依 AGENTS 與 release rules，正式 push／merge／deploy 需具體授權。本候選只
變更三個後端來源檔；既有 schema 與公開前端不需要遷移。

1. 發布前重新驗證正式帳號、project hash、原 Web App deployment、目前
   serving immutable source 及 editor HEAD；對帳至最新 main，保留其他部署。
   Repository 記錄 v228／63 檔，但本輪未即時確認，不可直接當 rollback 證據。
2. 保存剛讀回的 serving version 為 rollback，再推送審查後的三檔差異，建立
   新 immutable version；匯出比對全部 63 檔後，更新原 deployment，URL 不變。
   遇到版本上限時停止，不刪除任何歷史版本。
3. 讀回 deployment 與來源，使用原帳號重跑上述六個唯讀流程，至少記錄首次
   與重複請求。檢查 `[V2_RUNTIME_SNAPSHOT]` 的 action、elapsed_ms、
   full_sheet_reads_after、shared_cache_enabled／hits；不記錄 token 或業務資料。
4. 只有正式站同流程前後比較才能判定改善幅度。若仍慢，依後端實際讀取與
   執行時間，區分平台等待、Core 呼叫及頁面串行，才能決定下一個修補或主機比較。
5. 登入失敗或權限回歸時，把原 deployment 指回步驟 1 保存的 immutable
   version，重新讀回並驗證。前端沒有差異；程式回退不需要回寫業務資料。

限制／風險：登入稽核中 `last_seen_at` 不再代表每一次復驗；需沿用 session
到期與撤銷欄位判斷有效性。Apps Script 平台啟動／排隊和網路耗時仍存在。
本候選不代表所有畫面已達到 APP 即時反應，也不代表訂閱併發容量已驗證。

審查另確認既有 `landlordEmailAuthResolveUserAccess_` 的 legacy fallback
在基底與候選都可能接受停用／缺失的 Workspace 或未完成 onboarding。
此候選保留該相容策略，測試只證明列出的撤銷、expiry、使用者／成員停權及
角色／Workspace 綁定案例，不能宣稱全面授權安全驗證通過。該既有問題需另行
修正並補齊相容案例；不是本次減少讀取所新增。
