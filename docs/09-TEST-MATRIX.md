# V2 回歸測試矩陣

## 2026-10-05 月帳單排程日期型別（本機修復，待發布）

- `monthly-bill-noon-schedule.test.mjs` 新增 RED→GREEN：Sheets Date 月份可選中待送帳單，台北午夜跨月正確；文字月份相容，已送／已繳／取消／其他月份／無效日期不送。
- 正式月底日期儲存為 Sheets 日期序號，`workspaceGetObjectsWithRow_` 使用 `getValues()` 保留 Date；旧 monthly normalizer 字串化 Date，候選為零。手動入口已有 Date 正規化。
- 使用者授權後，僅一次手動本月發送；正式 LINE 紀錄20筆 HTTP200，帳單20筆 `sent`／send_count=1，已繳1筆未送；正式頁待送0／成功20／失敗0。這是 provider 接受及保存證據，不等於房客已閱讀。
- 完整600/600、validate與diff-check通過。只修改 monthly normalizer，API／Schema／金額／trigger 不變。未在雲端執行可能發訊息的測試函式。

## 2026-10-05 月中到期但續住的未繳租金更正

- RED→GREEN：403／505型10月3日到期仍在住，init標記個別待確認、預覽7500但不寫入；未確認拒絕，確認後同一未繳bill ID租金726→7500。保存度數、付款／發送狀態，不改租約日期、不新增帳單。
- 到期確認只移除租期結束限制，仍保留入住月按日比例；已繳快照及過期金額拒絕，完成退租不能被確認旗標延長。
- 既有502／602、關閉603、跨Workspace／舊房客身份、夏月及折扣保護持續回歸。無API或Schema變更；正式更正限定授權403／505兩筆，其他帳單不批次重算。

## 2026-10-05 用電月份／到期在住確認／關閉房間／逾時核對（本機候選）

- RED→GREEN：六月收五月一般費率、七月收六月夏月、十月收九月夏月、十一月收十月一般；一月跨年、Workspace 自訂夏月與真實 settings integration 房間覆寫。
- init 不寫帳；明確未繳更正保留原 ID／折扣。已繳卡片顯示保存快照，不因新費率重新試算。
- 502／602 可單獨勾選；全選排除到期待核對，送出須房東确认仍在住。真實後端入口核對標準及無範圍舊房客，相同租約日期／狀態不變；未確認／完成退租仍拒絕。
- 603 型 inactive／closed／disabled／archived 房間讀取及寫入皆排除，不刪除歷史帳單或房間資料。
- 寫入等待時間 120 秒且不重送；失敗後唯讀核對原 bill ID、度數、期限、折扣、其他費用及備註；一致才回報已保存，不一致仍提示未確認。
- 本機完整測試 589/589、validate、diff-check 通過；正式 Apps Script／Pages 尚未發布，未代送真實帳單，未做手機真機驗收。

## 2026-10-05 帳單更正回復（本機，未發布）

- `billing-correction-recovery.test.mjs` RED→GREEN：輸入事件不解除 pending 提交鎖、過期金額顯示具體原因且只刷新、已保存但刷新失敗保持鎖定、Email 業務子錯誤、legacy JSONP 寫入逾時不重送。
- `phase219-landlord-auth-client.test.mjs` RED→GREEN：來源與 request correlation 驗證後保留業務拒絕 payload；原拒絕／權限語意不變。
- 完整 npm test 569/569、npm run validate、git diff --check 通過；既有後端原帳單 optimistic lock 回歸保留。沒有修改 Apps Script，未執行雲端寫入測試。
- 正式唯讀：202 B0000042 及 tenant bill/home projection 同為 9,350，discount=600；先成功、後四次失敗。具體失敗子錯誤未取得，不代送重現；候選正式發布／提交驗收尚未完成。

## 2026-10-05 舊租約工作區相容補修

- RED: 已通過 landlord_id 權限篩選但 workspace_id 空白的到期租約仍被 review resolver 排除。
- GREEN: 延用既有授權範圍，在唯讀副本帶入房間 Workspace 供電表查找；不修改租約資料、不開放自動出帳。跨 Workspace／退租／停用帳號測試仍通過。
- 正式唯讀來源核對：兩間舊房客 account_status=active，但 workspace_id／landlord_id 空白，因此不在原 billing tenantMap。唯讀延續只允許已授權房間及租約共同指向的唯一無範圍舊房客；duplicate／inactive／顯式外部 workspace 或 landlord 仍拒絕。
- 全套 563/563；502／602 正式登入清單驗收另記，不能以測試取代。
- 正式209登入唯讀：22張卡片，502／602到期待核對、同租約9月上期電表可見。桌面側欄雙欄與202／506未繳原帳單更正入口可見；沒有提交真實金額。真機及金融寫入驗收未做。

## 2026-10-05 抄表延續／桌面工作區／未繳原帳單更正（本機候選，未發布）

- [x] 502 expired／602 active 但結束日已過：仍連結同 Workspace 活躍房客時保留抄表 item，標記待核對；上期讀數保留，不自動續約、退租或新增帳單。
- [x] completed checkout、已結束合約、封存房間、inactive／跨 Workspace 房客、不同 current tenant／contract、未來或缺失日期均不復活。
- [x] 未繳原帳單只有明確 edit flag、bill ID、同租約房客及舊 total 相符才更正；保留 ID，折扣取代原總額，重複保存不重複扣款。已繳／錯誤 ID／金額已改拒絕寫入。
- [x] 卡片 renderer 保留讀數欄位，review 不可勾選；未繳已建帳單不預先勾選，明確保存確認。
- [x] 本機合成 browser 1440px 寬版側欄／雙欄、390px 單欄；兩尺寸無水平溢出。不是正式帳單或真機驗收。
- [x] `npm run validate`、Node 全套 560/560、focused 89/89、`git diff --check`。真實 Apps Script service 執行與正式部署未執行；runtime 測試使用正式計算入口及合成持久層。
- [ ] 202／506 實際折抵金額、正式原帳單更正與 502／602 正式顯示待核對：尚未修改 Production 資料。到期項目目前只供查看／試算，不保存新讀數，不等同房東已确认續住。
- [ ] 部署：先唯讀匯出對帳既有 Apps Script，再發布此後端版本（保留 Web App URL），最後更新 frontend cache／Pages。須新授權；rollback 前端至 `c8335c4`、後端至部署前核對版本，回退程式不會撤銷已保存帳單更正，故發布驗收不代送帳單。

## 2026-10-05 導覽／退房選擇與合約驗證狀態（Pages 已發布，登入待驗收）

- 使用者明確批准「將這次前端修正發布」；候選 35adf9c，正式 cache tag `20261005-landlord-navigation-review-v1`。僅發布已記錄前端修正，回退 b183c22，不部署 Apps Script 或更動業務資料。

- 九個既有桌面側欄核對八個既有入口，退房先開房客名單；營收頁補退房入口。沒有 contract_id 的退房網址顯示選擇指引，不建立 session、不寫資料；單筆退房仍從房客詳細資料帶入既有合約。
- 合約 auth／review／initiated status 沿用共用 JSONP，dispatcher 原本已支援 callback；不經 callApi 的 data unwrap。驗證失敗保留原始碼與訊息，缺失／確認過期 LINE 憑證才顯示手動重登入，不繞過伺服器 Workspace 與角色驗證。
- 本機重現側欄缺項／錯誤退房網址、cross-origin fetch 失敗與原始驗證錯誤遭遮蔽；根因不同於上一版資料讀取缺少 LINE ID。真實合約驗證最初失敗的 provider／網路原因尚未被正式登入證據確定，不能因本機測試宣稱所有合約已恢復。
- 後端／API route／Schema／正式資料無變更，Apps Script 測試函式不適用；rollback b183c22。登入後、退房頁讀取（不結案）與手機真機尚待驗收。
- `npm run validate`、`npm test` 545/545、diff-check 通過。新增 14 項包含九頁導覽可點擊路由、JSONP status 參數、驗證原始錯誤保留、無合約 ID 不發請求、缺失憑證碼、手動 OAuth 回跳參數清理。
- 發布證據：PR #212 合併 `867035609515ab0bd1dac8bfe934aa9963e148e9`；Pages run `37230018142` success，latest build built 且 commit 相同。39/39 修改 runtime 公開檔案逐位元組相同；候選 runtime 與 origin/main 相同，Apps Script diff 為空。root 408 筆 WIP、branch 與 HEAD 未變。此證據不代表登入後合約驗證或手機真機已通過。

## 2026-10-05 電腦版登入後缺少 LINE 身分修正

- 五頁實際 ensureLandlordAuthReady 與真實 shared auth 重現：無 Email token 的桌面被誤判 Email，LINE 初始化次數為 0；新增六項回歸 RED→GREEN。
- getMode 只依 Email session 判斷，沒有 token 則進 LINE 初始化；桌面 Email 表單偏好只在入口決定，不代表已登入。五頁同時測 Email session 不啟動 LINE、LINE redirect pending 不讀資料。
- 發布範圍沿用使用者登入修正授權；只有前端、cache 標記及測試文件，無 Apps Script／Schema／正式業務資料修改。回退 main c7b2530。
- 真實桌面 LINE OAuth 與登入後跨頁資料验收仍待確認，單元測試不等於此驗收。
- 發布完成：validate／531/531／diff-check 通過；PR #211 合併 b183c22，Pages run 37227859933 success，latest build built 且 commit 一致；39/39 修改 runtime 公開檔案逐位元組相同。root 408 筆 WIP、branch 與 HEAD 未變。

## 2026-10-05 電腦版 Email 入口手動 LINE 選擇（未發布）

- [x] phase244 實際 entry script 重現 mode=email + 已登入 LINE：按下 LINE 後不再回 Email，完成既有 home 導覽；RED→GREEN。
- [x] phase250 保留 mode=email 首次載入忽略舊 fallback intent，避免自動 LINE 循環。validate、525/525、diff-check 通過。
- [ ] 真實 LINE OAuth／正式登入後 browser 驗收及發布尚未進行；Apps Script 無修改。
- [x] 發布狀態更新：使用者批准後 PR #210／c7b2530 與 Pages run 37224933796 success；38/38 修改 runtime 公開檔案讀回一致。真實 LINE OAuth／登入後驗收仍未完成。

## 2026-10-05 摘要優先與營收入口（本機候選，未發布）

- [x] RED/GREEN：頂部估值／累計實收位於圖表與成本前；最高年度 100,000 在 2%／4% 下為 5,000,000／2,500,000；累計 180,000 不受空成本／badInput 影響。
- [x] 合成 390px browser DOM 核對摘要先估值後實收，圖表在成本與出售試算前。原有固定底導覽保留。
- [x] `npm run validate`、`npm test` 524/524、`git diff --check` 通過；browser 2%→4% 估值 10,400,000→5,200,000，合成累計 694,000 保持。手機摘要截圖已保存，不代表正式金額。
- [ ] 正式發布、登入後與手機真機驗收尚未進行；沒有 Apps Script 改動，無正式 Apps Script 測試函式呼叫。
- [x] 2026-10-05 已批准並完成正式發布：PR #209／5fb4b48，Pages run 37223696358 success，40/40 runtime 公開讀回一致。上述未發布勾選狀態已由此證據更新；登入後及手機真機驗收仍未完成。

## 2026-10-04 投入成本與互動報表（本機候選，未發布）

- [x] 預覽物件清單／範圍重新渲染與桌面側欄回歸 17/17；browser A／B／全部實收各 416,400／277,600／694,000，手機375px無外層溢出。桌面側欄／手機底導覽依1024px切換，不發起登入。

- [x] 投入成本公式 RED（缺少實作）→ GREEN；購入／裝修明確填寫、選填其他、零本金、空成本／零成本、負數／非有限數／overflow，不推造累計淨 ROI。
- [x] 實際 mount 事件：成本输入不重繪圖表；年／月明細與占比、圓餅旋轉、Enter、badInput、暫停控制；缺年曲線及無估值點既有回歸保留。
- [x] 審查發現暫停後重繪凍結起點；新增 RED/GREEN 回歸，改為 final static geometry。合成 browser 驗證 animation=none、opacity=1、transform=none、curve dashoffset=0；reduced-motion 不可由繼續按鈕覆寫，rotation transition=0s。
- [x] 桌面及 390px 同一頁試算；手機外層無水平溢出（375／375）。合成值與財務公式、點擊／鍵盤年度明細、月份旋轉核對，無 console error。
- [x] `npm test` 518/518、定向 15/15、`npm run validate`、`git diff --check` 通過；Apps Script 沒有修改，不呼叫正式測試函式。
- [ ] 本次前端擴充尚未正式發布／登入驗收／LINE 真機驗收。無業務寫入、API／Schema／Apps Script 變更。

## 2026-10-04 年度收益估值（本機候選，未發布）

- [x] `asset-income-valuation.test.mjs`：跨 Workspace／物件、付款確認、歷年與 as-of cutoff、本期 KPI 不變；四率公式、最高／平均、空／零／負／badInput 成本、缺年／無估值點、空資料與舊 backend fallback。
- [x] 桌面 Email 不初始化 LINE；沒有 Email token 的已登入 LINE 可使用原路徑；共用 auth/API 處理權限。
- [x] 合成 browser 核對 2% 預設、最高／平均／不完整年 opt-in、四率切換、成本錯誤與年份圓餅圖；桌面 1280px／手機預覽保留固定 shell。
- [ ] 正式發布、authenticated API／瀏覽器／LINE 真機尚未執行。沒有正式帳務寫入或 schema 變更。


## 2026-10-03 首頁前端正式發布（Pages完成，登入／真機待驗收）

- [x] fresh Pages來源main根目錄、built commit133549e與origin/main一致；回退目標記錄，root408筆WIP保留。
- [x] 新cache tag20261003-landlord-home-motion-loading-v1；503/503完整回歸、validate及diff-check通過。42個既有靜態標記／驗證／測試檔的未提交變更只有固定tag替換，Apps Script diff為空。
- [x] PR203合併074c225，Pages workflow37068482843 success，latest build built且commit一致；40個變更靜態檔加既有清單共43/43逐位元組相同。合併main與候選首頁三檔及release標記一致；root仍408筆WIP、原branch／HEAD未變。
- [x] 正式browser缺少已驗證session，直接首頁顯示「缺少 LINE User ID」；已交付明確Email登入入口，return_to新版首頁，未發送OTP或以示範登入替代。
- [ ] 正式登入後首頁／LINE實體手機驗收；本機手機預覽不等同此項。後端／API／Schema不變，沒有測試業務寫入或LINE發送。

## 2026-10-02 首頁載入／手機展示（本機候選，未發布）

- [x] `landlord-home-loading.test.mjs` 8項：原版6項RED（parser-blocking SDK、LINE lazy load、error／timeout／缺失SDK重試、待辦重建整頁）修正後全綠；另保留Email bridge與已載入SDK／登出LINE重導流程回歸。執行實際首頁inline與shared auth，不以mock登入函式代替。
- [x] 不再在HTML parser critical path下載第三方SDK；Email session不用LINE SDK。LINE仍依既有LIFF ID初始化、讀profile、登入重導；30秒載入失敗有提示，移除失敗script並允許手動重試，舊callback不影響新請求。
- [x] 待辦數量原本每次回應重寫整個app，現只更新3個badge與文字。合成browser驗證app direct-child mutations=0、chart node及focus相同、scrollTop 300→300；單次局部更新約0.6ms僅為本機觀察，不是正式API效能數字。
- [x] 手機預覽 `/mobile` RED404→GREEN：same-origin iframe採真實手機寬度，保留原responsive renderer；僅loopback可用，CSP仍禁止外部請求及form提交，私有檔案404／POST405。373px內容寬度=scrollWidth，金額不截斷，可捲動；手機預览不是另做一套Production頁面。
- [x] 全套503/503、validate與diff-check通過；既有progressive home→actions/report、request dedupe、錯誤隔離及失效權限清除舊資料回歸保留。
- [x] 2026-10-03 續作補齊獨立審查的兩項測試缺口：DOM替身由實際renderer輸出建立節點，斷言原節點保留且pending class清除；手機父頁CSP明確允許同源iframe。9項定向回歸通過。
- [ ] 正式API／LINE真機首屏時間及登入後驗收未測，不宣稱端到端快幾秒。沒有Apps Script變更或正式測試呼叫；沒有帳務緩存／業務列／Properties／LINE寫入。

## 2026-10-02 房東首頁動態設計（本機預覽，未發布）

- [x] `landlord-home-motion.test.mjs` 九項 RED/GREEN：播放／暫停不改金額、OS reduced-motion 不可被按鈕覆寫、偏好切換保留手動暫停、hidden/offscreen 停播、重繪清理舊控制項／observer、錯誤卸載清理；恢復播放／退出 reduced-motion 不重播已靜止的進場圖，實際整頁錯誤 renderer 卸載舊圖表。
- [x] 既有首頁 renderer／12 月合計／30-60-90 buckets／語意色及 progressive bootstrap 回歸保留；全套 494/494、`npm run validate`、inline syntax、`git diff --check` 通過。
- [x] 本機合成資料瀏覽器：桌面、390px、375px、844×390 橫向無水平溢出；金額完整，底部導覽固定。新動畫／明細控制項至少44px高。
- [x] 實際點擊暫停後圓環 animation-play-state=paused，線／柱顯示最終完整幾何；中央文字 transform=none。模擬系統 reduced-motion 後三圖 animation=none。
- [x] 審查後再次 browser 點擊恢復播放：circle orbit=running，line／bar animation-name 仍為 none，沒有回零重播；重新載入才開始新一輪進場。
- [x] Preview server 只監聽 loopback，allowlist 僅首頁與3個靜態素材；CSP 禁止外部請求，移除正式 SDK／auth／API scripts，直接使用合成 fixture 呼叫實際 renderer，沒有登入／業務 API 呼叫。預覽的業務連結不執行正式操作。
- [ ] 正式發布、登入驗收及手機真機驗收：未執行；這次使用者只核准本機設計預覽。

沒有新增圖表種類、API／Schema／業務寫入；只是既有首頁的視覺和動態。Apps Script 模組沒有修改，未呼叫正式測試函式。後續需單獨授權 frontend release；不可把本機 preview 當成 Production acceptance。

## 2026-10-02 房客租約摘要（v205／Pages已發布）

- [x] 5 項 RED/GREEN 實際 loadPage／renderer 回歸：目前租約的租金、零管理費、押金、台北租期與繳款日放在聯絡資料前；不使用帳單／房間預設或任意歷史版本。
- [x] 待起租與已到期仍顯示該版本條件；缺少／重複 current 指標不猜測。缺值顯示未提供、0 正常，費用說明 escape。
- [x] 文件回應補回租約時同步更新摘要／歷史區，不重繪或清除初始電表、選檔與文件表單；既有各版合約保留。
- [x] 3項實際native history與document projection RED/GREEN：canonical0優先舊alias、缺失／非法金額為null、只在canonical空白才用legacy值；整個fixture原始資料不變。Workspace／房東filter回歸仍通過，文件測試載入實際shared read helper而非stub。
- [x] 沒有current ID時即使歷史標記is_current也不冒充目前租約；原續約寫入／預設normalizer保留。
- [x] 全套 485/485、validate、diff-check 通過；桌面與 390px 手機實際 renderer 的合成資料預覽可讀、展開可用，CSP 禁止所有外部請求。不是正式登入／真機驗收。
- [x] Fresh serving v204及editor HEAD完整匯出，59檔與基線相同。
- [x] 原Web App immutable205完整59檔與c583d36相同，CLI deployment讀回205、URL與其他四個部署不變；保留v204 rollback，未刪版本。
- [x] PR201／657ec08、Pages workflow36985692299成功，41公開檔逐位元組相同；合併後485/485、validate、diff-check通過。
- [ ] 正式登入驗收與先前授權的 501 三欄保存：目前瀏覽器仍在 Email 登入入口。

Apps Script只改既有read response；無新增route／Schema／業務資料／Properties／trigger／LINE或版本刪除。前端 rollback 為 `cc01e81`，後端為v204。

## 2026-10-02 紙本補登房間金額／待起租房客（v204／Pages 已發布）

- [x] RED/GREEN：active／upcoming 補登的 canonical room rent、management（含 0）、deposit 同步；下游 view 失敗回復原金額與指標，冪等重送不建立第二份租約或發 LINE。
- [x] future 紙本租約保留 canonical 房客、起租日及歷史；房間為待起租，不是空房／已入住／待核對。臺北起租日當天起才按有效出租顯示，原狀態列不變。
- [x] 跨 Workspace、inactive tenant／archived room、錯誤 room／tenant current 指標、unsigned electronic／cancelled／未核對的 future active 不使用新 fallback；既有到期續約保留。
- [x] 實際 desktop／mobile renderer 顯示待起租日期和查看房客；無重複建客或封存入口。獨立房間金額編輯沿用舊 API，狀態由租約控制。
- [x] 審查後 RED/GREEN：較晚日期的取消舊租約不遮蔽 canonical 紙本；tenant-side Workspace／property／room／current 指標錯誤保留待核對，缺少／不一致 property 不進房客 fallback。
- [x] scheduled paper 起租日與到期後房客仍可查；history 原狀態不變、effective 狀態正確。實際詳細頁 renderer／點擊導航、續約建立與核准啟用、退房 target validation 在未起租拒絕，起租日／到期後保留既有入口及權限 guard。合成 Sheets 核准 fixture 確認僅明確核准才封存前版並更新房客／房間／views；未執行正式續約／退房。
- [x] 實際 properties init 在起租前、起租日及租期末日，tenant／contract／property 指標不符或重複 tenant／contract ID 仍為待核對；不得透過日期 active map 繞過完整關聯 guard。
- [x] 最後全套 477/477、`npm run validate`、58 個後端合併語法／49 個 inline scripts 及 `git diff --check` 通過。隔離桌面／手機畫面使用實際 renderer 與合成資料，禁止外部請求；不是正式登入／真機驗收。Cache tag `20261002-paper-backfill-room-tenant-v1` 已發布。
- [x] 獨立審查的 8 個 Important 發現均已 RED 重現並補修；最後 scoped follow-up 48/48、無已確認 Critical／Important／Minor。review 不涵蓋正式資料、登入／私有文件及部署驗收。
- [x] 使用者確認發布與 501 三欄範圍；Fresh serving／HEAD v203 與 main 的 59 檔相同，新 immutable204 與候選完全一致，既有 deployment CLI／Google UI 讀回204、URL及其他部署不變，rollback203保留。
- [x] PR #199／2143a27、Pages workflow36975283281成功，41個公開檔案逐位元組相同；合併後再次validate／477/477／diff-check通過。
- [ ] 501 既有 room 三欄定點同步及正式登入唯讀驗收尚未完成；瀏覽器停在 Email 登入入口。只在已驗證房東編輯入口存三欄並讀回；不在 read path 寫正式資料、不直接改 Sheets 繞過權限或重送補登。
- [ ] 實體手機／真實補登或初始電表寫入未驗收；不代填缺失讀數，不開原始證件或重算歷史帳單。

## 2026-10-02 電表驗證恢復／台北日期（v203／Pages 已發布；登入唯讀通過）

- [x] 最小化唯讀 metadata 確認失敗请求的 ID token 已過期；不保存 token／subject／秘密值，沒有讀私有原檔或寫业务資料。
- [x] RED/GREEN：過期 SDK token 不送 exchange、不自動跳轉；provider 拒絕保留明確手動恢復且不查電表／raw UID fallback。cached review session 到期重取；存檔失敗不自動重送，保留讀數／照片並清除已過期 session。
- [x] 外部瀏覽器重新登入保留 canonical tenant、所選 contract、電表錨點且剔除 OAuth code／state／liff.state；重複點擊一次登入。在 LIFF client 使用既有 LIFF 入口，不呼叫不支援的 logout／login。
- [x] 後端 allowlist 只有明確 `IdToken expired.` 映射 expired code，audience／malformed／不安全描述仍拒絕且不回顯，不建立身份或 session。
- [x] Taipei 午夜 Date／ISO offset／Google Date／date-only 正確；真正 history read model 和 frontend renderer 的文件／歷史／電表日期一致。租約原始列與金額不變，日期加減規則不變。
- [x] 新增 10 項具名回歸，定向 36/36、全套 441/441、validate、diff-check 通過。共享 cache tag `20261002-tenant-meter-session-dates-v1`；其餘頁只有 tag 更新。
- [x] 獨立審查兩項 Minor 測試盲點已補入：剩餘 20 秒 renew／31 秒沿用、malformed/null 400、非 400 expiry、200 錯誤 audience 都 fail-closed。follow-up 定向含 cache 39/39、validate／diff-check，無 Critical／Important／Minor。
- [x] 合併全域 58 個 Apps Script／49 個 inline scripts 語法通過；隔離 browser fixture 禁止任何外部請求，實際按鈕返回同房客／所選租約／電表錨點，日期正確、讀數／照片控制項可見。畫面證據 `/private/tmp/cmwebs-meter-session-proof.hpI9lm`；不代表正式／真機通過。
- [x] 使用者於最後永久刪除畫面確認精確97版批次；完整來源／checksum 備份、Google成功畫面及 CLI 刪除差集相符，保留引用／76／85／200／201／202，五個 deployment 不變，沒有業務資料刪除。
- [x] Fresh HEAD／serving v202 匯出一致，candidate `71b68df` 建立 immutable203，59 檔完全一致；既有 Web App deployment 讀回203、URL不變。新版後104版／96可用位置，rollback202。
- [x] PR #197／cc984fe、Pages workflow36936708163成功；17個公開檔案逐位元組相同，合併後再跑441/441／validate／diff-check通過。
- [x] 正式登入後唯讀：過期提示→既有房東LINE重新登入→同一canonical房客／選定租約／電表錨點；初始讀數、選填照片及儲存控制項載入。台北租期和原三份文件metadata／私有預覽入口可見，未開原檔。
- [ ] 真機／真實初始電表補填及照片交易未驗收；實際讀數／照片仍缺，不代填、不重算已出帳。

## 2026-10-02 房客 canonical ID 關聯修復（本地候選，未發布）

- [x] 登入後唯讀重現 506 詳細頁「0 份文件／無租約／無法補填初始電表」；沒有開啟原始身分證、重傳文件或改業務資料。測試以虛構 ID，不提交真人個資。
- [x] RED/GREEN：新增 6 項 regression；最初 4 項在舊程式失敗，審查另揭露申請 case-fold 錯連並以新增測試重現，再修為 canonical 解析後精確過濾。定向 29/29 通過。Native projection → 真正合約歷史及文件 metadata helper：小寫生成 ID、沒有 tenant master 時的合約 fallback、既有大寫 ID；跨 Workspace／房東／其他房客文件保持排除，資料快照不變。
- [x] 實際 `loadPage`：舊大寫網址先唯一解析伺服器原始 ID，文件及電表查詢均用 canonical ID，既有申請保留，三筆文件可預覽且電表欄位呈現；大小寫碰撞在任何私有文件／電表查詢前拒絕。
- [x] 全套 431/431、`npm run validate`、49 個 inline scripts、58 個 Apps Script 合併全域語法、`git diff --check` 通過。固定 cache tag 為 `20261002-tenant-canonical-id-v1`；其他頁只有機械式 tag 更新。
- [x] 獨立審查先揭露申請 case-fold 錯連，新增 RED/GREEN 後精確關聯；follow-up 29/29 與 diff-check 通過，無 Critical／Important／Minor，候選可進行下一階段發布 preflight。
- [ ] Apps Script 已滿 200 個版本，尚未 source push／建立新版／更新 deployment／Pages／PR。正式後端讀回 v201，v200 保留；此前只刪 v199 的授權不涵蓋其他版本。
- [ ] 正式候選發布後，需登入唯讀確認 506 原有租約、文件及電表欄位；本地測試不等於原檔已恢復或真機驗收。

## 2026-10-02 房客文件與初始電表查看修復

- [x] 真正執行 `loadPage` 的 RED/GREEN 重現：文件請求未完成時，電表原先沒有讀數／照片控制項；修正為獨立載入，文件失敗也不移除房客頁及電表表單。
- [x] 舊房客 `contract_history` 空白時，文件回應中的同房客租約仍能補載電表；多租約仍要求選擇，既有基準不可覆寫。
- [x] 歷史文件清單每筆私有文件都有 `document_id` 預覽入口，不只各類最新一筆；沿用既有已驗證下載權限，不公開 Drive ID 或檔案內容。
- [x] 房客頁上方有「查看／補傳合約與身分證」及「查看／補填入住電表」錨點；固定 shell／頁內捲動保留。
- [x] 定向 frontend runtime 23/23，全套 425/425，`npm run validate`、`git diff --check` 通過；共用靜態 cache tag 同步為 `20261002-tenant-evidence-discovery-v1`，其他頁僅更新 cache tag。
- [x] PR #193 合併為 `3e6affb`，Pages workflow `36913724284` 成功；17 個公開資產與合併来源逐位元組一致。v201 匯出 59 檔仍相同，正式 deployment 仍讀回 v201；Apps Script／API／Schema 無變更。
- [ ] 正式新版入口瀏覽器仍呈現 Email 登入頁；未核對真人 506 的文件 metadata／內容、實際讀數或登入後／手機畫面。不能把測試夾具當成既有文件已找回，不要求先重傳，也未代填／上傳或更動業務資料。

## 2026-10-01 初始電表發布恢復

- [x] 只對已核對的 v199 取得操作當下永久刪除確認並執行；59 檔備份逐位元組相同，CLI 核對 v199 不存在、v200 保留，沒有刪其他版本／部署。
- [x] 新 immutable v201 匯出 59 檔與 `99e4db5` 相同；既有正式 deployment 讀回 v201，URL 不變，另四個部署 HEAD／160／10／139 不變。
- [x] 再次執行全套 420/420、validate、全域 Apps Script／三頁 inline 語法及 diff-check 通過。
- [x] PR #191／`2c570ae` 合併，Pages workflow `36881380576` 成功；`npm run verify:production` 確認 17 個公開資產逐位元組一致，`--export` 核對 v201 通過，正確匿名 v2_action init GET 回傳 POST_REQUIRED。
- [ ] 真實 506 初始度數、私有照片／登入後操作及手機真機驗收未完成；無業務列、私有檔案、Properties／trigger／LINE 交易。

## 2026-10-01 初始電表候選發布阻擋與回退（歷史）

- [x] 候選 `b225185` 全套 420/420、validate、全域／前端語法、diff-check 與獨立審查通過；功能不因部署失敗而丟失。
- [x] 建立 Apps Script 新版本回傳 200-version cap；正式 deployment 仍為 v200，沒有宣稱新版已生效。
- [x] Editor HEAD 恢復 v200 並以 59 檔匯出比對；PR #189 回退前端，Pages workflow `36869725199` 成功。回退來源全套 313/313、validate／diff-check 通過。
- [x] `npm run verify:production` 已確認 17 個公開資產逐位元組回復原正式版本；沒有以被取消的 workflow 當作未發布證據。
- [ ] 只刪未部署引用的歷史 v199 需明確批准；未執行版本刪除、業務資料／私有文件／Properties／trigger／LINE 寫入。
- [ ] 新版完整發布與真人 506 初始讀數／照片／手機驗收尚未完成；不可將候選測試或使用者前次紙本成功回報當成本次驗收。

## 2026-10-01 紙本補登初始電表與資料查看修復

- [x] Phase 209 runtime 重現缺失讀數被接受、照片／自拍未保存、舊報到更新可覆寫基準後修復。缺失／負數／非有限／布林拒絕；真實零保存；租約 scoped 基準和文件一起回滾／冪等。
- [x] 既有租約只補初始電表，不改房客／租约／房間／使用者列；既有值不可覆寫，跨 Workspace、錯誤 tenant 與重複 checkin 拒絕。報到資料更新不得抹掉已補的基準。
- [x] 新 POST bridge 的實際 dispatcher 測試：read／contract_write、零度序列化、過期／缺失 session、query 憑證與 malformed input 拒絕；viewer 可讀不可寫。
- [x] 舊入住列 Workspace 空白且初始讀數為 0 時，讀取／補填先拒絕關聯衝突；不當作缺失追加第二個基準，不做欄位 migration。
- [x] Frontend runtime／DOM 18/18、Billing 實際 handler runtime 81/81、全套 420/420、validate、後端合併全域語法、三頁 inline scripts 與 diff-check 通過；獨立審查無 Critical／Important。共用固定 release cache tag 同步為 `20261001-paper-initial-meter-v1`。
- [x] 正式 backend v201 immutable export／deployment 核對；Pages 公開讀回另見上方發布恢復清單。
- [ ] 真人 506 實際讀數／私有照片補傳、登入後操作與手機真機為 HUMAN_REQUIRED／UNVERIFIED。發布本身不代填資料、不重算已出帳、不發 LINE。

## 2026-10-01 紙本轉換房客使用者查找修復（Version 200）

- [x] 正式唯讀核對僅讀 506 的合約／房客／邀請關聯 ID、狀態及對應使用者的角色／綁定狀態：帳號已存在且未綁定，ID 關聯一致；`V2_users` 無 `workspace_id`／`landlord_id` 欄，舊查找因此誤報不存在。未讀姓名、電話、Email、身分證、檔案內容或邀請 hash。
- [x] 正式全域 user schema 夾具先重現失敗，再驗證依已核對的 tenant user ID 沿用唯一既有帳號；不追加欄位或重建身份。拒絕錯誤角色、其他 active Workspace、LINE／binding 證據、重複 user ID 或其他房客參照，並測試原帳號回復與冪等重送。
- [x] Phase 209 真正執行補登 handler，先重現「找不到既有房客使用者資料」：具 pending 邀請的電子草稿缺少 `V2_users` 時，舊 guard 只接受 `legacy_pending`，錯誤阻擋電子轉紙本。
- [x] 空白／標準 `contract_origin`、保留／缺少 user ID 四種情境均能在原房客上補齊帳號，保留原合約與邀請稽核，不建立第二筆房客；重送為冪等結果，不發 LINE。
- [x] 跨 Workspace user ID、合約／房客 user ID 不一致、邀請已認領／有認領時間、邀請房間不一致、房客已綁定均在任何 Sheet／Drive 寫入前拒絕；邀請檢查不受帳號存在與否影響，正式全域既有帳號三種負向情境先重現繞過後修復。下游失敗會回復原房客／合約／邀請並移除本次新帳號／文件紀錄。
- [x] 21 項新增具名回歸及既有 Phase 209／215 通過；完整 `npm test` 313/313、`npm run validate`、`git diff --check` 通過。
- [x] 正式帳號、專案與既有 deployment 再次核對；本輪首次推送前 serving Version 198 及 editor HEAD 59 檔與前一正式來源相符。本次僅紙本補登模組改變。Version 200 唯讀匯出 59 檔與修正版 `3e5ba45` 逐位元組一致；同一正式 deployment 讀回為 Version 200，URL 不變，Version 198 保留回退。審查揭露的 Version 199 未服務且已被取代。
- [ ] 真實 506 紙本／身分證上傳、補登後綁定仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。沒有代送交易、改寫業務列、讀寫私有文件、變更 Properties／trigger 或送 LINE。

## 2026-09-30 506 Email session／舊格式邀請重發與取消

- [x] 房東桌面 Email session 可在有效且完成 onboarding、重新核對目前
  Workspace 與 `contract_write` 權限後，使用既有邀請重發／取消入口；房客簽署
  審核 session 驗證不放寬，身分或權限不符仍拒絕。
- [x] Phase 163 先重現 `LANDLORD_REVIEW_SESSION_INVALID`，再驗證 Email session
  可重發及取消，且無寫入權限時邀請與合約狀態維持原值。
- [x] 舊合約缺少 `contract_origin`／`invite_id` 時，只在邀請、合約、房間與
  Workspace 關聯相符且唯一有效邀請可確認時允許重發／取消；來源衝突、邀請不明確
  或跨 Workspace 合約均拒絕或只取消指定舊邀請，不誤改合約狀態。
- [x] Phase 163 定向測試、完整 `npm test`（282/282）、`npm run validate` 與
  `git diff --check` 通過。
- [x] 發布前唯讀核對正式 Web App deployment 指紋符合公開網站，當時服務 Version 196；
  59 個來源檔與當時 GitHub `main` 只在 Email session 權限修正有差異，
  與本次候選只在舊格式邀請關聯／取消範圍修正有差異。
- [x] PR #183 合併後，Version 197 唯讀匯出與 `main/apps-script/` 的 59 個檔案
  逐位元組一致；既有正式 Web App deployment 讀回服務 Version 197，Version 196
  保留回退。未修改 Sheets 業務資料列、Properties、Triggers 或發送 LINE；
  GitHub Pages 15 個公開檔案與合併來源逐位元組一致。
- [x] 2026-10-01 跨月重新執行時，Phase 162 夏月費率與 Phase 177 當前租約
  兩項測試的隱含「今日」假設被揭露；測試夾具固定於 2026-09-30，未改產品程式。
- [ ] 真人登入後對 506 邀請實際執行重發／取消的驗收尚未完成；本次部署驗證
  不代表已執行任何邀請交易。

## 2026-09-29 506 快速租約回找與桌面 Email 建立流程（本地候選，未發布）

- [x] 只讀核對正式資料：`V2_contracts` 的 506（`R000016`）有一筆
  `pending_tenant_signature` 合約；`V2_contract_invites` 有對應的 `pending`
  邀請且仍在有效期限內。未讀取房客姓名、電話、Email、確認碼雜湊或其他密鑰值。
- [x] 後端列表在正式表缺少 `contract_origin`／`invite_id` 表頭時，改以同 Workspace
  的邀請表 `contract_id` 關聯回找 pending 邀請，並回傳邀請連結；不做 Sheet
  表頭補建、資料列回填或其他正式資料寫入。
- [x] 桌面 Email session 的快速租約初始化與房東發起新租約改走已驗證的 POST
  bridge；伺服器先解析 Email session、Workspace 與角色權限，再呼叫既有 handler。
  無效 session 直接拒絕，不落回 LINE webhook；手機 LINE JSONP 路徑保留。
- [x] `landlord-desktop-quick-lease-bridge.test.mjs` 與 Phase 163 邀請回找測試
  已先失敗再通過；尚未宣稱真人登入、瀏覽器、LINE 或正式站驗收。
- [ ] 本候選尚未推送、合併或部署；正式 506 顯示與邀請連結仍需取得明確的
  Production 發布授權後，再做登入後瀏覽器驗收。

## 2026-09-29 簡易新租約的過期已出租房間提示（本地候選，未發布）

- [x] 後端初始化資料已有 `room_status` 與 `has_current_or_upcoming_contract`；
  租約已過期、房間仍標示 `occupied` 時，簡易新租約房號選單顯示
  「房況待核對，勿作空房」，不再以沒有當前租約推論為空房。
- [x] 仍標示 `occupied` 的房間在送出前由前端驗證攔下，提示先確認續約
  或完成退房；若另有當前／未來租約，選單會明示「已出租，已有租約」，
  不再暗示可以直接建立新房客租約。真正 `vacant` 的房間仍可通過驗證。
  `landlord-simple-lease-expired-occupancy.test.mjs` 已先失敗再通過。
- [x] `npm test` 267/267、`npm run validate` 與 `git diff --check` 通過；
  本次未修改 Apps Script，既有房況與建約回歸包含在完整測試內。
- [ ] 此為本地前端修正，不改 502 的正式房況、房客、租約或帳務資料；
  尚未推送、合併或部署，也未完成真人登入後的網站驗收。

## 2026-09-29 房東寫入登入循環／房況誤判（Version 193／PR #178 已發布）

- [x] `landlord-tenant-create.html` 與 `landlord-tenant-checkin.html` 的 LINE
  OAuth 返回路徑保留一次性 LINE 意圖；桌面已有 Email session 也不能把原生合約
  寫入流程攔回 Email 驗證碼頁。`landlord-tenant-create-line-return.test.mjs`
  已先重現失敗，再驗證局部修正。
- [x] 租約過期但房間仍關聯啟用房客時，物件頁標示「待核對」而非「空房」；不提供
  重複建立房客／編輯／封存入口。即使租約顯示已結束，只要仍關聯啟用房客也先待核對；
  無房客關聯的已結束租約才顯示空房。不改正式租約或房況資料。
  `landlord-room-expired-occupancy-review.test.mjs` 已先失敗再通過。
- [x] `landlord-room-write-guards.test.mjs` 先重現編輯 502 可能誤寫空房、封存
  未核對房客及物件封存 handler 未取得 Spreadsheet 的缺陷；現禁止待核對房間編輯／
  寫入／封存，後端重查啟用房客或缺失的房客關聯。另驗證唯讀角色及跨 Workspace
  房間不能寫入；正常有效租約的房間仍可更新租金／備註而維持已出租。
- [x] 桌面 Email session 的物件／房間儲存、封存與房間帳號切換五個既有 action
  改走受控 POST bridge；伺服器先驗證 Email session，再交給既有 Workspace／
  寫入權限 handler。`landlord-property-email-write-bridge.test.mjs` 覆蓋
  正確路由、參數及無效／缺少 session 時零寫入，並使用實際 session resolver 驗證撤銷、
  過期、停用、Workspace／角色變更；驗證每個寫入 handler 均綁定 session 的
  Workspace、缺少 Workspace 時拒絕、`enabled=false` 不遺失；已先重現失敗再修正。
  另以失敗用例驗證表單 bridge 不可從 URL query 繼承 session token；dispatcher
  現只解讀原始 POST body，既有 read-bridge 定向回歸仍通過。
- [ ] 正式 502 房間的實際占用仍需人工核對，不能宣稱資料已修復；Email 驗證碼路徑
  未變更，使用者回報其寄送失敗僅發生於重複回旋之後，不能把它當獨立根因。
- [x] `npm run validate`、265/265 Node 測試與獨立複審通過；PR #178 已合併，
  Apps Script 同一正式 deployment 更新至 Version 193，GitHub Pages merge commit
  `533c718` 建置完成，公開 15 個資產逐位元組讀回一致。Version 192 與前一個
  Pages commit `bccaab5` 保留為回滾目標；未改 Sheet 業務資料。
- [ ] 真人在 Chrome 與 LINE 完成登入、建立／報到及房況回歸驗收，仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-27 房東 POST/read bridge 測試夾具修正（測試／文件限定）

- [x] 根因確認：舊測試只抽取 `doPost(e)`，漏載正式 dispatcher 在入口呼叫的
  `repairRouteRequestFromPostBody_` 及相依 helper，所以測試 VM 發生
  `ReferenceError` 後落入 fallback；正式 Apps Script dispatcher 並沒有此缺漏。
- [x] Bridge 測試改載正式 repair pre-dispatch helpers，並確認房東唯讀 action
  會放行至主 dispatcher、真正 repair action 仍由 repair handler 接手；snapshot
  測試則明確 stub 無關的 repair pre-dispatch，以專注驗證 request-local snapshot。
- [x] Focused regression `5/5`、完整 `npm test` `246/246`、`npm run validate`
  通過（59 backend files、38 endpoint references、static release-cache validator），
  `git diff --check` 通過。
- [x] 僅變更測試與文件；Apps Script、前端、API 行為及正式資料均未修改，故本次
  不需也不應觸發正式網站部署。這是測試品質修正，不宣稱修復了任何 Production
  runtime 故障；實際登入後 Email／LINE bridge 驗收仍為 `HUMAN_REQUIRED`。

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
- [x] Historical baseline note (corrected 2026-09-27): the two failures recorded
  above were test-VM harness omissions, not dispatcher regressions. The isolated
  fixture correction and production-helper pass-through regression now pass;
  see the 2026-09-27 test-only entry above. No repair-ticket runtime change was
  needed or made.
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

- [x] 月帳單5分鐘／每小時入口重疊：Script Properties 原子認領 dispatcher，短 ScriptLock 在通知前釋放，不持鎖呼叫通知模組；重疊入口跳過、錯誤 finally 釋放、10分鐘過期恢復（超過單次6分鐘限制）。真handler重入回歸 RED→GREEN；593/593通過。正式LINE收件仍未驗證。

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
- [x] 台北時間每月 5 日 12:00 起補發當月已建立、未繳且尚未發送的帳單；專屬每 5 分鐘檢查、原每小時 dispatcher 保留備援。成功沿用 `sent_status` 防重，不自動建立帳單。`monthly-bill-noon-schedule.test.mjs` 驗證 11:59 無 Sheets／LINE 存取、12:00／12:05 可進入處理、6 日漏發補送；592/592 通過。正式觸發器／實際 LINE 收件需分開核對。
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

## 2026-09-30 新約／續約補充條件本機候選

- [x] 簡易新租約提供選填的 500 字「補充約定／現場備註」；一般新約及續約由房東在本次版本輸入，直接 API 超長輸入由後端拒絕；舊 `note` 不預填，也不因續約複製而公開（`contract-conditions.test.mjs`）。
- [x] 條件標記於 `terms_snapshot_json` 並綁定本次 `contract_id`；歷史內部 `note`／`landlord_note` 與前版條件不進入房客合約（`contract-conditions.test.mjs`）。
- [x] 自動備妥的未送出續約草稿可在房東合約頁編輯選填補充約定；只預填同一草稿版本的約定，後端重新產生合約全文並拒絕超過 500 字或已送出的版本（`contract-conditions.test.mjs`、`phase158-landlord-initiated-contract-activation.runtime.test.mjs`）。
- [x] 固定 Google Docs 範本有 `{{備註}}` 時取代該位置；沒有時，房客預覽與簽署版皆插入簽名區之前；無法定位時拒絕含條件的新建／簽署版，不把條件附在簽名後；空白不追加（`contract-conditions.test.mjs`）。
- [ ] 正式範本排版、真實 Drive 複本、已登入房東／房客瀏覽器及 LINE 真機簽署驗收：`HUMAN_REQUIRED`／`UNVERIFIED`。此本機候選尚未發布；未改正式 Sheet、Properties、範本或業務資料。

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

## 2026-10-01 506 紙本補登與桌面「更多」正式修復

- [x] 506 類型的待簽電子合約即使 `contract_origin` 空白，只要有邀請 ID，房間頁會顯示「補登紙本並建立房客登入」；提交仍須精確匹配同 Workspace 的待處理邀請，拒絕錯誤邀請、已認領房客及跨範圍資料（Phase 209／215 回歸）。原電子合約及邀請保留稽核並在紙本補登成功後關閉；不是直接刪列或提前清空房間。
- [x] 電腦版「更多」使用共用房東 Email session 與桌面 shell；有 session 的讀取走既有 POST bridge，無 session 回 Email 入口，不跳 LINE；手機 LINE 路徑保留（`landlord-more-desktop-auth.test.mjs`）。
- [x] 紙本補登表單在電腦版可用既有 Email session POST bridge 上傳已簽紙本與選填身分證；房客詳細資料的文件清單、預覽、後補身分證上傳也可用此 bridge。後端以 server-resolved 房東及 Workspace `read`／`contract_write` 權限處理，拒絕失效 session 與無效 payload（`landlord-desktop-quick-lease-bridge.test.mjs`）。
- [x] 「更多 → 文件總覽」沿用 Email session 讀取及預覽；桌面缺少 session 回 Email 入口，手機 LINE 驗證保留（`landlord-document-overview-auth.test.mjs`）。
- [x] Email bridge 使用實際 Workspace 權限建構及 policy，合法房東可寫入、唯讀成員拒絕；文件清單、下載、上傳及冪等查找都綁定已驗證 Workspace，拒絕同房東的另一 Workspace 或房客／租約不一致（`landlord-desktop-quick-lease-bridge.test.mjs`、`landlord-document-workspace-scope.test.mjs`）。
- [x] 本地 `npm test` 293/293、`npm run validate` 與 `git diff --check` 通過；此證據不等於正式網站發布或實際上傳驗收。
- [x] Apps Script immutable Version 198 唯讀匯出 59 檔與修正版逐位元組一致；既有正式 deployment 讀回為 198，網址不變。PR #185 合併為 `5a7d57a`，Pages workflow `36792021356` 成功；17 個公開檔案與來源逐位元組一致。
- [ ] 已登入房東瀏覽器／手機的 506 入口、紙本文件上傳與房客綁定驗收：`HUMAN_REQUIRED`／`UNVERIFIED`。此次發布未改正式房客、房間、合約、邀請、私有文件、Properties、trigger 或 LINE；沒有簽妥紙本檔案時不得代送補登。
## 2026-10-05 摘要數字翻滾（本機，未發布）

- [x] `asset-number-roll.test.mjs` 七項：逐位最終落點、下降與四捨五入、不變／暫停／缺值、物件 remount 接續、成本不重播、減少動態、暫停跨 remount。
- [x] `npm run validate`、完整 Node 552/552、`git diff --check`；未修改後端，Apps Script 模組測試不適用，未執行正式資料寫入。
- [x] 合成 browser 390px／1280px 無水平溢出；4% 後最終數字 5,200,000，示範物件 A 6,240,000／416,400；無障礙標籤只有最終金額。不是正式帳務核對。
- [ ] 正式發布與已登入／真機驗收尚未執行；保留既有固定 shell。發布時更新靜態 cache、核對 Pages 並保留 `8670356` rollback。

# 2026-10-04 出租／出售双算法候選

- `tests/asset-income-valuation.test.mjs`：售價自訂／估值 fallback、出售費完整性、貸款現金／獲利分離、累計營運支出缺失、零投入、虧損、非有限輸入及 overflow；實際 mount 輸入事件即時更新出售結果與成本水平線、保留其他收入圖、badInput 清除過期結果。
- Browser：本機合成桌面試算 840,000／42%、虧損 -1,160,000／-58%；390px 手機框可見出售欄位與缺值提示。非正式或真機驗收。
## 2026-10-07 房源入口與手動網址候選版（尚未發布）

- 手機核心十頁導覽保留房客入口，新增「房源」連結與五欄排列。
- `room-source-integration.test.mjs` 驗證 Workspace 隔離、exact listing ID、
  缺表時未綁定狀態，以及卡片僅接受已綁定的 HTTPS 連結。
- `room-website-save.test.mjs` 驗證 HTTPS／清除／非法網址／權限拒絕，租金不變。
- 房東自行填手動網址，不需先建立自動同步綁定；自動同步仍需後續核對。
- 網站端未提交修改保留原狀，不併入本次候選版。
- 部署前核對實際 Apps Script 部署；目前沒有發布證據。實際保存與重載驗收
  不由本機合成持久層測試替代，未代填真實房源網址。
# 房源導覽圖示一致性（2026-10-07）

- `tests/room-nav-icons.test.mjs`：十個整合頁的房源入口使用 SVG，不再依賴字型符號；房源頁五個 SVG 與首頁一致，房源建築圖示不同於首頁。
- 房源頁使用相同 23px 圖示、1.9 線寬與 5px 圖文間距。純前端修改，不變更 API、Schema 或房間資料。
- 正式发布及真實手機視覺驗收仍待執行；rollback 可還原本次 HTML 圖示變更，無資料回復操作。
# 房源照片圖卡（2026-10-07，已授權發布候選）

- `tests/room-photo-cards.test.mjs`：照片置頂、簡短標題／房號／月租、網址管理預設收合，未綁定或不安全照片不顯示，標題跳脫 HTML。
- 手機單欄、電腦多欄；沿用底部 SVG 導覽和單卡受保護網址儲存。不新增 API 或 Schema，不修改房間資料。
- 已綁定房源縮圖仍是唯一照片來源；網址不會自動抓圖。無照片及圖片載入失敗各有明確狀態。
- 使用者已授權前端發布；rollback 回復發布前 `a135399` 的 `landlord-rooms.html`，後端 216 不變，無資料回復操作。合併及 Pages／公開檔案核對仍為獨立發布驗收。
- 每張圖卡直接顯示「管理刊登房源」，不收進「管理」：開啟固定 `https://admin.z3house.com/` 統一登入入口；新分頁加 `noopener noreferrer`，不帶房間／Workspace／登入憑證。不是特定刊登編輯深連結，不改外部後台權限。
# 房源網址封面連動（2026-10-07，正式後端217）

`tests/room-website-cover.test.mjs` 執行真實後端及圖卡／儲存函式：網址保存
後鎖外取主圖、平行與重載快取、外站／admin／帳密／port 拒絕取圖、轉址／
網路失敗／缺圖不影響網址保存、清除與重新取圖、無 binding 圖卡顯示、
合法 src／UUID、授權房間唯讀投影，以及儲存後只換該卡保留其他草稿。
只有外部 UrlFetchApp／CacheService／Sheet 持久層採合成 fixture；不以此
宣稱正式保存、登入或手機真機驗收。

唯讀公開實測：使用者提供 z3House 房源照片集第一張可 GET 200 image/png；
HEAD 回404不能作圖片不存在的判定。沒有保存正式資料或更動 z3House。
回退前端為 0a65960、後端216。fresh serving216及editor HEAD與main各59檔
一致；推送後HEAD及immutable217與候選各59檔逐位元組一致，原API更新217。
本次候選完整 `npm test` 623/623、`npm run validate`、`git diff --check`
通過；使用者授權前後端發布。PR225合併379a82d，Pages37542783526成功，
46公開檔逐位元組一致。已登入正式房源頁唯讀重載101：既有網址的第一張
照片complete=true、natural1672x941。未重送保存，不改 Schema／trigger／
Properties／LINE／帳務。新保存交易及手機LINE真機待驗收。
