# CMWebs Current State

**Status: AUTHORITATIVE current-state record**
**Last verified: 2026-10-03 (Asia/Taipei; homepage Pages release and public static files; authenticated/device acceptance pending)**

## 2026-10-03 首頁前端已正式發布；登入／真機驗收待完成


使用者在查看手機本機預覽後明確要求「發布到正式網站」。本次範圍為V2.1既有首頁視覺／動畫與載入整併，候選286ebe3（含3886cf8），不增加報表、API、資料欄位或後端功能。fresh origin/main與Pages最新built皆為133549eed5d3a5ae57f2d3c112953780ef1369f6，Pages來源main根目錄；isolated分支乾淨，root408筆WIP不碰。

新固定cache tag為20261003-landlord-home-motion-loading-v1；其他頁僅同步靜態asset標記與測試預期。不改Apps Script／Schema／Properties／trigger／LINE／房客或帳務資料；後端最後記錄v205保留，本次不建立新版。發布前端回退基線為133549e（保留本次local分支），循PR→merge main→Pages→逐檔公開讀回；Production登入／真機驗收與實際端到端秒數分開記錄，不能以本機503項測試或示範數據代替。

發布候選500f0f8經PR **#203** 合併為 **074c225d27d271291f68f8347c0e8c6c9e8fe11e**；Pages workflow **37068482843** success，latest build讀回相同commit且built。40個本次變更公開靜態檔加既有驗證清單，共 **43/43** HTTP逐位元組與合併來源相同，無mismatch。發布前validate／503/503／diff-check通過；合併main與候選首頁三檔及release標記一致。原root仍408筆WIP、原branch／HEAD未變。

正式browser直接開首頁顯示「缺少 LINE User ID」，未取得可驗證的登入session；已開啟 `landlord-entry.html?mode=email&return_to=landlord-home.html&v=20261003-landlord-home-motion-loading-v1` 供使用者登入，未寄OTP、未代登入或以fixture替代。本輪未完成登入後圖表、LINE真機或端到端速度驗收；501先前三欄仍待登入保存，不因本次首頁發布宣稱已完成。正式手機仍是同一responsive首頁，`/mobile`僅local preview。

## 2026-10-02 首頁載入／手機展示：本機候選延伸，未發布

使用者要求加快載入並直接展示手機介面。沿用 `codex/landlord-home-motion-preview-20261002` 的已完成視覺候選3886cf8；root408筆WIP保留。不開專案討論，不碰先前待登入501資料。

找到兩項前端等待／重繪：head LINE SDK阻塞解析，Email亦下載；次要待辦回來時重建整個app。現SDK只在LINE路徑async載入，失敗／30秒逾時清理並可手動重試；Email直接沿用原保護bootstrap。待辦更新局部badge／描述，保留chart node、focus及scroll。原API／權限／金額算法／progressive順序／錯誤隔離不變；不新增持久帳務緩存。8項載入回歸（6 RED→GREEN）加1項手機preview路由RED→GREEN、全套503/503／validate通過，本機browser確認0次app子節點替換、焦點及300px捲動保留。預覽程式輸出的loopback網址加`/mobile`直接展示可捲動手機框，不需瀏覽器viewport override；373px內容無水平溢出。合成數據、不是正式登入或真機驗收，端到端正式載入秒數未量測。

2026-10-03 斷線續作fresh Git仍為候選3886cf8、root408筆WIP；獨立審查APPROVE WITH NITS（僅本機候選，無Critical／Important）。兩項Minor測試缺口已補強：實際renderer節點來源／pending class清除，以及手機父頁frame-src同源放行；9項定向回歸通過。此日期不代表重新核對正式版本。

續作最終validate／503項完整回歸／diff-check全數通過。斷線後重啟本機loopback preview，重新開啟可操作手機框；373px clientWidth=scrollWidth，實際捲動至576px可查看趨勢及營運圖表。新分頁console記錄一條MutationObserver observe TypeError（source URL未提供；本次允許的preview來源無此API），不將其當作正式網站缺陷或宣稱console-clean。正式登入／SDK／真機及端到端速度仍未驗收。

沒有發布授權，故未push／PR／merge／Pages／Apps Script或業務資料操作；共享release tag保留原值。後續使用者批准後，僅首頁frontend slice沿既有Pages流程、新cache tag／公開讀回／登入核對；新效能slice可回退至3886cf8，整體視覺候選可回退至133549e。Apps Script v205與先前501待登入狀態不因此改變。

## 2026-10-02 房東首頁動態視覺：本機預覽候選，未發布

使用者同意「旋轉入住圓環／固定中央數字、長條與趨勢線進場、暫停及 reduced-motion、綠色精緻 UI」方向，只核准可操作本機預覽。`codex/landlord-home-motion-preview-20261002` 由 fresh `origin/main` / `133549e` 建立，沿用既有隔離 worktree；主目錄408筆混合WIP保持不動。不開無關專案討論。

只更動 `landlord-home.html` 視覺標記及新增 home-scoped CSS／motion controller，既有金額、12月合計、KPI、API、登入、業務連結和固定shell不變。九項新motion RED/GREEN／全套494項／validate／inline syntax／diff-check通過；桌面、375／390px及橫向合成瀏覽器預覽無水平溢出，暫停／系統reduced-motion實際控制已核對。審查發現的恢復播放重播進場與整頁錯誤未卸載listener已補修並回歸，browser確認恢復時line/bar仍靜止完整。此證據不是Production登入或真機驗收。

預覽：`node scripts/preview-landlord-home.mjs`，隨機loopback port，合成資料且CSP阻擋外部請求／正式操作。沒有push、PR、merge、Pages／Apps Script發布、業務列、Properties／trigger或LINE操作；共享release tag保留正式既有值。待使用者檢視後另行批准發布，屆時更新靜態cache tag並沿既有Pages流程；回退只涉及homepage runtime三檔，無後端變更。先前v205已發布／501三欄待登入的狀態未被本次視覺候選取代。

## 2026-10-02 房客租約摘要 v205／Pages 已發布；登入驗收待完成

已審查候選 `c583d36` 建立 immutable **205**，完整59檔匯出與候選一致，tree SHA-256 `28e2c9680297d1ad60b898e1abf6de32990904903c950fa6d571d5b65c8beca1`。原正式 Web App CLI讀回205，URL不變，其他四個 deployment與rollback204保留；106版本／94可用位置，未刪版本。PR **#201** 合併為 **657ec08**，Pages workflow **36985692299** 成功；41個公開檔案逐位元組與合併來源相同，合併後validate／485/485／diff-check通過。

房客→查看資料→「目前租約資料」直接顯示租金／管理費／合約押金／租期／繳款日；「其他合約費用與細節」展開既有費率與費用說明。只依明確current租約，缺值不冒充0，押金不是實收證明。文件／電表／歷史版本保留。獨立審查原Important讀值問題與Minor無current選版問題已修，scoped複驗48/48及8個數值邊界通過，無剩餘確認finding。

**正式登入畫面及手機真機未驗收，501先前授權三欄仍未保存。** 瀏覽器仍是房東Email登入頁，已請使用者登入；不直接改Sheets繞過房東權限。没有改業務列、原租約／日期／歷史帳單、私人檔案、Schema、Properties、trigger或LINE。原root408筆混合WIP保留。Rollback同Web App **v204**／Pages **cc01e81**；owner-only HEAD/v204/v205匯出留在本機，不提交私有資料。

## 2026-10-02 房客租約金額摘要修復候選（發布前歷史）

使用者回報房客詳細資料未連動租金、押金與細節。隔離分支 `codex/tenant-lease-details-20261002` 從 fresh main `cc01e81` 開始，建議模型／速度 `gpt-5.6-terra / medium`。程式追查確認既有 `landlord_tenants.contract_history` 已有金額，但只在帳款下方版本紀錄顯示；文件補回歷史後沒有重繪合約區。候選在個人資料下方顯示 exact current lease 的租金／管理費／押金／租期／繳款日及既有費率，保留歷史版與文件／電表入口。0 與缺值分開，不以房間舊預設、帳單或任意歷史金額替代。

5 項前端及3項實際native／document讀模型 RED/GREEN、全套485/485、validate、diff-check通過；桌面與390px合成隔離預覽可讀且費用展開可用。審查追查到後端讀模型先把缺值轉0、truthy alias覆蓋明確0，新增唯讀 nullable financial projection 並保留原寫入／續約預設 normalizer；文件fallback也回傳同版本押金／費率／繳款日。前端必須有明確 current ID，不能只依歷史 is_current 選版。

共享 cache tag `20261002-tenant-lease-summary-v1`，其餘頁僅機械同步。CLI正式仍v204；fresh serving與editor HEAD匯出59檔皆與v204基線相同。後端3個檔案僅改既有讀回資料，沒有新增route／Schema／業務資料／私有檔案／Properties／trigger／LINE寫入或版本刪除。待原Web App建立新版及Pages發布／公开讀回；rollback前端 `cc01e81`、後端v204。

正式登入仍未完成；先前501三個金額保存仍待既有房東登入，不使用直接Sheets寫入繞過權限，不宣稱authenticated／手機真機已驗收。原混合WIP不變；不開無關專案討論。

## 2026-10-02 紙本補登金額／待起租房客 v204 與 Pages 已發布；501 三欄同步待登入

使用者確認發布修正版，並只將 501 房間設定同步為月租 NT$19,570、管理費 NT$0、押金 NT$39,140；不改租約、租期或歷史帳單。Fresh Git main 為 `f59e205`，正式 Web App 與 editor HEAD 的 59 檔皆符合 v203；正式專案／帳戶及原 deployment 已核對。原目錄仍保留 408 筆混合 WIP，不開無關專案討論。

已審查候選 `018a70b` 建立 immutable **204**，完整 59 檔匯出逐位元組一致，tree SHA-256 `4f18ba0690d56ad0ca35586f14b95a5cce4295d444d68566b527870eec7190cd`。既有正式 Web App 在 CLI 與 Google 管理部署畫面讀回 204，URL 不變；另四個 deployment 及 v203 rollback 保留，未刪版本。PR **#199** 合併為 **2143a27**，Pages workflow **36975283281** 的 build／report／deploy 成功；41 個公開檔案（所有本次修改的頂層公開檔加原驗證清單）逐位元組與合併來源相同，合併後 validate／477/477／diff-check 通過。

發布前 501 定點唯讀核對仍符合原診斷：房間 canonical 金額是舊值，新租約金額與日期及房客／room／contract 指標一致、租約待起租。**尚未修改 501 三欄，登入後畫面驗收仍未完成**：交付瀏覽器仍停在 Email 登入入口，已請使用者登入。不得使用 Sheets 直接寫入來略過既有房東編輯權限，也不得以本地／HTTP／部署證據替代 authenticated 或真機驗收。

只在使用者完成登入後，從既有 501 房間編輯入口保存已授權三欄，讀回房間新值並唯讀核對租約／租期不變與房客待起租入口。未重送補登、未建新房客／租約／邀請，未開私人原檔、代填電表、改歷史帳單／Schema／Properties／trigger 或發 LINE。本次沒有更動任何業務列；506 文件與電表路線及 502 到期未確認的待核對保護保留。Rollback：同一 Web App **v203**，Pages **f59e205**。Owner-only 發布前 HEAD／v203 與新 v204 匯出及 Google 部署畫面留存在本機私有備份目錄，不提交原始識別碼或私有資料。

## 2026-10-02 紙本補登金額／待起租房客候選（發布前歷史）

建議模型／速度 `gpt-5.6-terra / medium`。隔離分支 `codex/paper-lease-room-tenant-20261002`，基線 `f59e205`；主目錄 408 筆混合 WIP 保留，不開無關專案討論。

使用者要求修正新紙本補登房客漏顯示及房間仍使用舊金額。501 定點唯讀核對確認：新紙本租約與房客已保存、Workspace／room／tenant／contract 指標一致，但租約尚未起租，native 清單只選今日有效或到期續約，因此漏掉；房況則因 active tenant 指標被標為待核對。補登交易只寫租約金額／房間指標，沒有同步三個 canonical 房間金額；不是房客或私人文件已確認遺失。未讀證件原檔、密鑰或其他房客資料。

候選在既有補登回滾交易同步 room rent／management／deposit，明確保存 0；future 紙本租約只在同 Workspace、canonical 房客及 current 指標完全符合時顯示「待起租」，並提供既有房客查看入口。起租日依台北日期開始才視為已出租；不改實際租約或入住狀態、不重複補登、不回寫已出帳，也不把 unsigned future 電子草稿納入。房間→租約→Workspace 預設規則保留。

審查邊界已補入回歸：用 scoped canonical contract／tenant maps 核對雙方 Workspace／property／room／current 指標，重複 ID 拒絕，不讓較晚日期的取消舊合約遮蔽目前紙本；起租日後的 active map 不能略過完整關聯核對。scheduled-paper 房客在起租與到期後繼續可查；歷史增加唯讀 effective 狀態，實際詳細頁按鈕／點擊、續約建立／核准啟用及退房 guard 按台北日期推導。讀取不改原狀態，既有角色／範圍驗證不變，只有明確續約核准才封存前版。未起租不可續約或退房；到期未確認仍待核對而非空房。

最後本地全套 477/477、validate、58 個後端合併語法／49 個 inline scripts、diff-check 通過；實際桌面／手機 renderer 的合成隔離畫面已查看，外部請求禁止。Cache tag `20261002-paper-backfill-room-tenant-v1` 為未發布候選。正式 Apps Script 測試寫入、authenticated browser／實體手機驗收未以本地 fixture 代替。

獨立 reviewer 的 8 個 Important 發現已 RED 重現並補修，最後 scoped 複驗 48/48、無已確認 Critical／Important／Minor。該審查不判定正式／登入／私有文件或部署完成。本地分支與隔離 worktree 保留，未 push／PR／merge／deploy。

已定點補登但房間仍是舊值的 501，仍需透過已驗證房東的既有房間編輯入口同步三個金額；本候選不在 read init 隱式寫入或掃描／改寫其他房間。正式 Apps Script／Pages 尚未變更，亦未改 501 正式資料；本地測試與隔離 renderer 不代表正式登入或真機驗收。發布需先核對 serving／HEAD 基線、同 Web App URL 建立新版、經 PR 發布 Pages，逐檔讀回並登入唯讀驗收；rollback 是 v203 與 Pages `f59e205`。版本刪除、Properties／trigger／LINE 都不在範圍內。

## 2026-10-02 97 個歷史版本清理／v203 與 Pages 已發布；電表登入唯讀驗收通過

使用者在永久刪除最後畫面確認「刪除這 97 個版本並發布」後，只刪 1–100 排除 10、76、85 的 97 版。Google 成功畫面及 CLI 精確差集一致：刪除後 103 版、全部 protected versions 保留、五個 deployment 不變。完整 owner-only 備份及 checksum 清單保留，成功證據在備份目錄 `delete-completed.png`。原版本編號不能恢復，但原始碼可重建新版；没有刪除任何租約、房客、帳務或私有文件。

Fresh editor HEAD 與 serving v202 的 59 檔相同後，推送已審查 `71b68df`，建立 immutable **203**。完整 59 檔匯出與候選逐位元組相同，tree SHA-256 `ee0b56f1f6af1d8677d111eff07133dc49bf13f8e56e53ced4a4665820a071f4`，既有正式 Web App 讀回 203，URL 不變。保留 v202 回退及 v200／201；新版占用一個位置後剩餘 96 個位置，Google 200-version 上限仍存在。PR **#197** 合併為 **cc984fe**，Pages workflow **36936708163** build／report／deploy 成功；17 個公開檔案及 v203 匯出逐位元組相同，合併後再次 validate／441/441／diff-check 通過。

正式登入後唯讀驗收通過：過期憑證顯示明確手動恢復，使用既有房東 LINE 帳號重新登入後返回同一 canonical 房客／選定租約／電表錨點；不再驗證失敗，初始讀數、選填照片及儲存控制項可見。506 租期顯示 2026-09-11～2027-09-10，既有紙本／身分證三份文件紀錄與私有預覽入口保留。初始讀數／照片實際仍缺少，未填寫或提交，原檔未開啟；真實存檔／上傳與實體手機驗收仍 UNVERIFIED。成功畫面在私有備份目錄 `production-meter-form-restored.png`，使用者頁面停留在可補填區。

本次只修過期 LINE 憑證的手動恢復及台北日期；不代填未知電表讀數、不重算已出帳、不改 Properties／trigger／LINE。Rollback：同一 Web App v202、Pages `add86f5`。根目錄 408 筆混合 WIP 保留；不開無關專案討論。

## 2026-10-02 發布授權及97版備份（刪除前歷史紀錄）

使用者已授權發布電表憑證／台北日期修正版，以及清理較舊、沒有用途的程式版本；不涵蓋房客、租約、文件、帳務資料或部署刪除。Fresh `origin/main` 仍 `add86f5`，隔離候選 `71b68df`，validate／441 項測試通過。原目錄仍 408 筆混合 WIP／49 個 tracked 修改／無 staged，沒有清理或覆寫。

已核對五個 deployment：HEAD／160／10／202／139，版本總數仍 200。只選取 **1–100 排除 10、76、85，共 97 個版本**；76 保留 RC1 封存、85 保留歷史對帳來源，101 以上近期版本和現行／回退 200、201、202 全部保留。不透過更改舊部署來使引用中的版本可刪。

完整來源及清單備份在 `/Users/hans/CMWebs/apps-script-history-20261002.2iQztI`，owner-only 0700 目錄／0600 檔案。97 個版本、1859 份來源檔、72,263,091 bytes；獨立重讀逐檔 SHA-256 全部相符，備份前後 deployment／version 清單相同。`cleanup-manifest.json` SHA-256 `fc7d272a1e25b43cdf3cb0ccbc0c053054e1f5b06d0e3329d69a121ac53f0c8e`。Google UI 跨頁勾選已核對，但 **尚未點擊刪除、尚未發布**；待當下確認畫面為備份目錄的 `pending-delete-selection.png`。

下一步只需這一批永久刪除的操作當下確認。來源可重建成新版本，但原版本編號不可恢復；刪 97 個將增加 97 個可用位置，**不取消 Google 的 200-version 上限**。确认后再核對保留版本／部署、匯出 HEAD／serving v202，按已授權範圍發布修正版、同一 URL 與 Pages 逐檔驗證；真實讀數／私有檔案寫入不在本次清理範圍。不開無關專案討論。

## 2026-10-02 電表過期 LINE 憑證／台北租期日期修復（本地候選，未發布）

建議模型／速度：`gpt-5.6-terra / medium`。隔離分支 `codex/tenant-meter-auth-dates-20261002`，基線 `add86f5`。使用者授權開始修復；本輪沒有推送、PR、合併、部署或版本刪除，不開無關專案討論。

失敗請求的最小化唯讀證據確認 LINE ID token 在請求當下已過期；只檢查 expiry／issuer／公開 LIFF channel audience 的布林結果，不保存或揭露原 token／subject。前端不再送已過期憑證，提供手動重新登入、返回同一 canonical 房客／選定租約／電表區；不自動跳轉或重送寫入。已過期 review session 清除；存檔授權失敗保留讀數和選取照片，離頁重新登入後需重選照片。後端仍嚴格驗證 ID token；只有 LINE provider 的明確 `IdToken expired.` 回應映射 `LINE_ID_TOKEN_EXPIRED`，其他拒絕保持 generic fail-closed，沒有 raw UID fallback。新登入是否能通過正式 Channel 配置仍待驗證。

租期差一天已重現為 UTC 日期截取：後端 history helper 與前端 timestamp／文件選單統一以 `Asia/Taipei` 顯示；原租約日期與金額不改。新增 10 項具名回歸，定向 36/36、全套 441/441、validate、58 個 Apps Script 合併全域語法／49 個 inline scripts、diff-check 通過。共享 cache tag 為 `20261002-tenant-meter-session-dates-v1`，其他頁只做機械式 tag 更新。獨立審查補齊 session 剩餘 20／31 秒及 malformed/null/provider status 邊界後，follow-up 39/39、無 Critical／Important／Minor。隔離 browser fixture 禁止外部請求，確認手動登入按鈕、同房客／租約／電表區返回與讀數／照片欄位；這不是正式登入驗收。

正式基線仍 v202／Pages `add86f5` 的 runtime；200、201、202 保留。200-version cap 未解除，先前只刪 198 的批准不得擴大。本候選發布及額外特定版本永久刪除須另取得授權。回退為同一 Web App v202、Pages `add86f5`；原目錄 408 筆混合 WIP 保留，無業務／私有檔案／Properties／trigger／LINE 寫入，不代填未知初始讀數、不重算已出帳。正式登入／真機／實際補填仍 UNVERIFIED。

唯讀部署／版本清單確認現有 200 個 immutable versions，五個部署不引用 v197。該版本完整 59 檔匯出至 `/private/tmp/cmwebs-unused-v197.SFe6dI`（0700），與 Git `fd806f1` 完全相符，來源 tree SHA-256 `83a025a49c448db52e81f4126b83e0c2f3b036098a08d90fc0b2aeeab0f3c4ed`。尚未刪除；刪除原版本編號不可恢復，備份可重建另一新版。

## 2026-10-02 canonical ID v202／Pages 已發布；506 文件已恢復，電表仍受阻

依使用者在最後對話框的確認，只永久刪除未部署引用且已備份的 v198；200、201 保留。Fresh HEAD／serving v201 與來源一致後，已審查 `78d4d60` 建立 immutable v202，59 檔匯出逐位元組一致，同一正式 Web App 讀回 202、URL 不變，其他四個部署不變。431/431、validate、diff-check 通過。PR #195／`b79ab46`、Pages workflow `36926064476` 成功，17 個公開檔案逐位元組一致。

登入後 506 唯讀頁面已恢復原租約歷史與紙本／身分證正反面 3 份文件紀錄，既有已上傳標示及私有預覽入口可見，未開啟證件原檔。但初始電表仍 `BLOCKED`：LINE review exchange 在重新載入後回傳 `LINE_TOKEN_VERIFY_FAILED`，尚未判定憑證過期或 Channel 配置不一致；不跳過驗證，也不宣稱電表可用。無業務／私有文件／Properties／trigger／LINE 寫入，未知初始讀數不代填。回退 v201／Pages `d4bb0ac`，根目錄混合 WIP 保留；版本再次達 200 上限，任何其他刪除須另行特定授權。不開無關專案討論。

## 2026-10-02 506 關聯漏查已重現，canonical ID 候選（歷史）

登入後唯讀頁面顯示 0 份文件／沒有租約，雖然房客清單有當前租約。已重現原因：native 清單對外回傳 uppercase lookup key，原始 lowercase tenant ID 因精確關聯而漏查文件／歷史／電表。隔離分支 `codex/tenant-canonical-id-20261002` 保留原始 ID，並讓舊大寫網址在已驗證 Workspace 回應中唯一解析；不改身份資料、租約、文件、房間、帳單、Schema 或權限。

定向 29/29、全套 431/431、validate、49 個 inline scripts／58 個 Apps Script 合併全域語法、diff-check 通過。正式後端仍 v201，v200 保留；沒有 source push、PR、Pages 或 deployment 變更。後端已滿 200 個版本，之前只刪 v199 的批准不涵蓋其他版本；新清理需要特定版本的授權。原目錄 408 筆混合 WIP 原樣保留；506 未知初始讀數不代填，私有文件不要求重傳，正式恢復仍待發布後登入唯讀驗證。

## 2026-10-02 房客文件／電表查看修復已發布

從最新正式 `main` `ed412c2` 的隔離分支修復文件查詢阻塞電表、歷史私有文件缺少逐筆查看入口，以及詳細頁缺少直達區段入口。新增 5 項實際 renderer／loadPage 回歸，全套 425/425、validate 及 diff-check 通過；既有租約缺失基準才可補填，0 有效，已保存值不可覆寫。其他頁只同步固定 cache tag，後端／API／Schema 不變。

PR #193 合併為 `3e6affb`，Pages workflow `36913724284` 成功，17 個公開檔案逐位元組相同。後端仍讀回 v201，其 59 檔匯出與本地相同；不建立新版或修改正式資料。新入口瀏覽器停在 Email 登入頁，506 既有文件是否正確歸檔及登入後／手機畫面仍未確認。不要要求使用者先重傳，也不代填未知初始度數。前端 rollback 為 `ed412c2`，根目錄 408 筆混合 WIP 原樣保留；不開無關討論。

## 2026-10-01 初始電表與補登文件查看已發布

使用者操作當下確認後，只永久刪除已完整備份且無目前部署引用的 Version 199。Version 200 和全部既有部署保留。重新套用已審查候選的 runtime `99e4db5` 通過 420/420、validate、全域／inline 語法及 diff-check；immutable Version 201 匯出 59 檔完全一致，同一正式 Web App 讀回 201，URL 不變。PR #191 合併為 `2c570ae`，Pages workflow `36881380576` 成功，17 個公開資產逐位元組一致；匿名正確路由 GET 拒絕未驗證 POST，無業務資料存取。

使用入口為「房客 → 506 詳細資料 → 入住初始電表」及「文件與身份驗證」。本次沒有代填 506 未知初始度數、改業務列、私有文件、Properties、trigger 或送 LINE，也不重算已出帳；根目錄 408 筆混合 WIP／49 tracked 原樣保留。Rollback 為 Apps Script v200／前端發布前 main `fbc90d2`。真實上傳與手機驗收未完成；詳見 [PRODUCTION-DELIVERY.md](PRODUCTION-DELIVERY.md)。

## 2026-10-01 初始電表修復發布暫停（歷史）

候選 `b225185` / PR #188 已完成初始電表、照片／自拍及文件查看修復，420/420 測試與審查通過。但 Apps Script 建立新版被 200-version cap 拒絕，正式 deployment 維持 Version 200。Editor HEAD 已恢復 v200 的相同 59 檔；PR #189 / `da77a4e` 回退前端，Pages workflow `36869725199` 成功。未刪歷史版本或修改業務資料；候選尚不可稱為已發布／可用。

唯一待授權操作：只刪除目前沒有部署引用、已完整唯讀匯出的歷史 Version 199，保留 Version 200 作回退，再恢復候選發布。不得自行擴大到其他版本／部署／資料。詳見 [PRODUCTION-DELIVERY.md](PRODUCTION-DELIVERY.md)。

## 2026-09-30 合約補充約定正式發布

PR #181 已合併至 `main` (`b650ca3`)，既有 Apps Script Web App deployment 服務 immutable Version 195（Version 194 為 rollback），GitHub Pages workflow `36634573071` 成功，15 個公開檔案與合併來源逐位元組一致。新約與續約的選填補充條件只綁定本次合約版本；不沿用歷史內部備註。Node 測試 282/282、`npm run validate`、公開檔案核對通過。正式表僅確認欄名；未登入瀏覽器導向 LINE，登入後建約、房客簽署及真機驗收為 `HUMAN_REQUIRED`／`UNVERIFIED`。詳見 [PRODUCTION-DELIVERY.md](PRODUCTION-DELIVERY.md)。

## 2026-09-18 作廢帳單成功提示正式發布

PR #171 merge commit `31515af0958cb8a3e7039da506b1676a4c441345` 已發布至 GitHub Pages，workflow `35344387333` 成功；Apps Script 沒有變更，正式 Version 190 與 Version 189 rollback 維持不變。

- 欠款頁作廢測試帳單成功後，同時顯示成功彈窗與頁面內的「作廢成功」提示；提示包含帳單 ID，並可在清單自動重新整理後繼續看到。
- 公開 `landlord-arrears.html` HTTP 200 read-back 已確認 `archiveSuccessNotice`、`作廢成功` 與 `aria-live="polite"` 已提供。
- 本次沒有 Sheet 業務資料列、Drive、Properties、Trigger、付款或 LINE 寫入；Pages rollback target 為 `f9dc5fd7d657cad352fe741cbb7c28364facb3f2`，登入後與手機／LIFF UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-18 一次性測試帳單作廢／封存正式發布

PR #169 merge commit `257093b6b03838275342d67944ce6988edf57d3b` 已發布至 GitHub Pages，workflow `35339276140` 的 build、deploy、status jobs 全部成功；同一個正式 Apps Script Web App deployment 已由 Version 189 更新至 immutable Version 190，Version 189 保留 rollback，正式 URL 不變。

- 欠款頁只會對已關閉房間帳號的未繳、無付款紀錄帳單顯示「作廢測試帳單」；啟用中房間不顯示。
- 後端重新驗證 Workspace、房間狀態、帳單付款狀態與付款紀錄，沿用既有取消核心，保留帳單列／檢視歷史並新增 Workspace 操作稽核；不建立虛假付款、不發 LINE、不刪資料，重送具冪等性。
- Pages 欠款頁公開讀回 HTTP 200，Version 190 唯讀匯出 58 個檔案與候選來源逐檔一致；本次未執行 Sheet 業務列、Drive、Properties、Trigger、付款或 LINE 寫入。
- 完整 Node suite 為 244 項中 242 項通過，2 項既有 landlord bridge baseline failures 未因本次變更新增；登入後房東操作與手機／LIFF UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-18 退房退款同步結清帳單正式發布

PR #167 merge commit `4069e6fd0523a3c5f3d5caf307a5a76c4155c6a6` 已發布至 GitHub Pages，workflow `35326158352` 成功；同一個正式 Apps Script Web App deployment 已由 Version 188 更新至 immutable Version 189，Version 188 保留為 rollback，正式 URL 不變。公開 11 個資產逐位元組讀回通過；完整測試 243 項中 241 項通過，2 項為既有 landlord bridge baseline failures，未因本次變更新增。

- `manual` 快速結案／退款完成後，同一 Workspace、房東、房客、房間與合約範圍內的未繳 `V2_bills` 會更新為正式 `payment_status=paid`。
- 原帳單金額與原始列保留，不建立虛假的 `V2_payments`；帳單 view 與 Workspace summary 會同步，冪等重試會補回部分同步失敗。
- 已繳帳單、其他合約與完整電表結算流程不受影響；本次未寫入 Google Sheets 業務資料列、Drive、Properties、Trigger 或 LINE。
- 真實房東登入、手機／LINE 退房與實際帳單結果仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-15 正式來源與交付入口重新對帳

最新證據見 [PRODUCTION-DELIVERY.md](PRODUCTION-DELIVERY.md)。PR #165 merge commit `2d49354d28fb100811ed0886d31f30b1d3611fff` 已發布至 GitHub Pages；既有 Apps Script Web App deployment 已更新至 Version 188，57 個後端檔案與 `main` 一致，11 個公開資產逐位元組相符，Apps Script endpoint smoke check HTTP 200。正式容器 Sheet 的 76 個工作表 metadata／第一列欄名已盤點，業務資料列未讀取；本次未執行報修 legacy backfill。舊工作目錄的 Version 160／187 部署引用不能當成現行正式來源。這不代表真實登入交易或手機／LINE 操作已驗收。

## 2026-09-15 正式版本 188 發布

- PR #165 已合併至 `main`；Pages 建置狀態 `built`，公開檔案讀回通過。
- Apps Script 同一正式專案已由 Version 187 更新至 Version 188，既有 Web App URL 維持不變；Version 187 保留為 rollback target。
- 發布內容包含已確認的房間報修歷史／房客個資隔離與快速建立租約管理費欄位。
- `npm run validate`、`npm run verify:production`、受影響測試、Apps Script／前端語法與 `git diff --check` 已通過；完整 suite 的 2 個既有 landlord bridge baseline failures 未因本次變更新增。
- Google Sheets 業務資料列、報修 legacy backfill、LINE 通知與真實帳號交易未在本次發布執行；後續回填必須先 preview、備份及操作員授權。

This record distinguishes verified source reconciliation from live Production
state. It is not deployment authority. Re-verify the relevant target, account,
version, rollback, and runtime state before every Production action.

## 2026-09-18 快速結案同步帳單（已部署）

- 使用者確認退房退款時已一併結清帳務；既有快速結案只追加
  `V2_checkout_settlements`，沒有更新同一合約的 `V2_bills`，因此帳務頁仍會顯示未繳。
- 本地候選修正：`settlement_mode=manual` 完成快速結案時，將同一 Workspace、房東、房客、房間與
  合約範圍內的未繳帳單更新為既有正式銷帳使用的 `payment_status=paid`，保留原帳單金額與原始列，
  並同步帳單檢視／Workspace 摘要；已繳帳單與其他合約不受影響。
- 不建立虛假的 `V2_payments` 付款紀錄；退房結算表仍是退款結清的操作稽核來源，重送同一
  idempotency key 只補齊尚未同步的帳單。
- PR #167 已合併，Apps Script Version 189 與 GitHub Pages workflow `35326158352` 已完成；正式帳務資料未由本次部署直接修改。

## 2026-09-12 房東退房欄位 iOS 自動放大修正（正式部署）

- 使用者回報前一版鍵盤避讓後，點擊退房欄位仍會在手機上急速放大並讓畫面跳離欄位。
- 根因是退房表單欄位位於 `12px` 的 `label` 內，輸入控制項未明確設定字級；iOS 對小於
  `16px` 的聚焦欄位會自動縮放 WebView，原有 `visualViewport` 捲動修正因此無法單獨解決。
- 候選修正為退房 shell 的 `input`／`textarea`／`select` 一律使用 `16px`，檔案欄位也不再使用
  `12px`；沒有 Apps Script／Sheet／Drive／帳務／登入或退房結算規則變更。
- 新增 Phase 257 輸入放大回歸測試；完整 Node suite `206/206`、`npm run validate`、static
  release-cache validator 與 `git diff --check` 已通過。PR #161 已合併至 `main`，merge commit
  `d3ed41b7efda071978943f55167cadaa0b72b04a`。
- GitHub Pages workflow `34700989635` 成功；公開退房頁 HTTP 200 read-back（37,104 bytes）已確認
  `input`／`textarea`／`select` 與檔案欄位的 `16px` 規則已發布。前一個已驗證提交
  `c2cbf9238ecd1e7d79fe0911ffc96b4d98857544` 為 rollback target。
- 真實 iPhone／LINE LIFF 操作仍為 `HUMAN_REQUIRED`／`UNVERIFIED`，需在正式裝置確認所有欄位
  不再自動放大、畫面不跳離且快速結案／完整電表流程仍可送出。

## 2026-09-12 房東退房鍵盤遮罩修正（正式部署）

- IMG_4797.MP4 顯示 iOS 鍵盤開啟後，退房表單的押金扣除說明及其下方欄位
  留在不可視區；這不是退房確認視窗，也不是帳務／資料寫入錯誤。
- landlord-tenant-checkout.html 新增鍵盤狀態 class、可視 viewport 邊界計算、
  visualViewport resize／scroll 後重算，以及 0／120／280／480ms 的目前焦點欄位
  即時校正；同時移除會將鍵盤可視高度硬夾至 320px 的限制，並改用立即滾動。
- Phase 255 更新、Phase 256、新增鍵盤回歸測試、完整 Node suite 205/205、
  inline JavaScript syntax、npm run validate、static release-cache validator
  與 git diff --check 通過。
- PR #159 已合併至 `main`，merge commit `5d8eeb97dc5f8d505e355b75f28913fd36aecba1`；
  GitHub Pages workflow `34697177348` 成功，公開退房頁 HTTP 200 read-back 已確認
  `visualViewport`、多階段焦點欄位校正與 `scrollIntoView({ behavior: 'auto', block: 'nearest' })`
  已發布。GitHub Pages rollback target 為前一個已驗證提交 `fb80e0de398f2a910d927be3713049b2aa311232`。
- 本次只修改退房 HTML、前端回歸測試與文件；沒有 Apps Script／Sheet／Drive／帳務／登入變更。
- 真實 iPhone／LINE LIFF 操作仍為 HUMAN_REQUIRED／UNVERIFIED，需由房東
  實機確認每個退房欄位均可輸入、鍵盤不遮住欄位且完整流程仍可送出。

## 2026-09-12 房東退房欄位遮罩修正（正式部署）

- 根因是退房頁的固定底部營運列在鍵盤開啟或表單捲動時覆蓋下方欄位，導致押金扣除說明、
  點交備註與結案按鈕無法正常點擊；既有欄位資料與快速結案結算規則不變。
- `landlord-tenant-checkout.html` 改用退房專用 shell：隱藏不提供操作的固定底部列、使用較小
  的表單底部安全間距，並將聚焦欄位以 `inline: nearest` 捲至可視區中央。
- Phase 255 UI 回歸、Phase 253、完整 Node suite `204/204`、Apps Script syntax、static
  release-cache validator 與 `git diff --check` 通過。只涉及靜態前端，沒有 Apps Script／Sheet／
  Drive／帳務或登入變更。
- PR #157 已合併至 `main`，merge commit `d938520e80af738f82dcba301f78cee9200df8c8`；GitHub
  Pages workflow `34688134508` 成功，公開退房頁 HTTP 200 read-back 已確認新 shell、固定
  底部列隱藏與欄位捲動修正。這是純前端發布，Apps Script／Sheet／Drive／帳務／登入不變。
- 真實手機／LIFF 欄位操作仍是 `HUMAN_REQUIRED`／`UNVERIFIED`，需在正式裝置實際點擊確認。

## 2026-09-11 房東退房快速結案（正式部署）

- 新增 `settlement_mode=manual` 快速結案。房東不需填寫電表讀數或上傳照片，輸入
  `manual_receivable_amount` 與 `manual_refund_amount` 後，後端重新驗證並以兩者寫入
  `V2_checkout_settlements` 的最終應收／退款欄位；押金扣除說明仍保留稽核用途。
- 退房表單增加快速結案／完整電表結算切換、輸入欄位自動捲動與底部導覽安全間距。
- PR #155 merge commit `6fa0bba63f4b0a07bd72b2d2bf8dfb061869dc92` 已合併；Apps Script
  Production Version 186 已部署至既有 Web App，Version 185 保留 rollback，Web App URL
  不變。必要的 `runV2CheckoutSettlementProductionMigration` 已在已登入 Apps Script
  編輯器執行完畢，僅補缺少欄位，不改既有資料列。
- GitHub Pages workflow `34598441945` 成功；公開房東頁與退房頁 read-back HTTP 200，
  新 cache marker、快速結案欄位與防重複提交回饋均已確認。完整 Node suite `203/203`、
  Apps Script syntax、static release-cache validator 與 `git diff --check` 通過。
- 真實房東帳號手機／Chrome／LIFF 退房操作與實際資料結果仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`；本次未執行真實退房交易。

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
