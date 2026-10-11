# 會員與轉帳訂閱

會員使用原房東 Email／LINE 登入。會員中心在 `landlord-subscription.html`，管理後台在 `platform-admin.html`；方案、價格、週期、房間上限、試用與收款銀行由平台管理者設定。沒有已上架方案時顯示空狀態；付費方案必須先有啟用的訂閱收款銀行才能上架。

新帳號必須通過 Email 驗證碼或 LINE 官方驗證。帳號與工作區仍寫入原租管工作表，Core 依 Product 外部 User／Workspace 綁定 Company。連線逾時保留原識別碼，可重試恢復。Email 新會員可明確連接本人 LINE，沿用相同帳號與工作區。

轉帳付款單保留當時方案與銀行指示。會員回報只產生審核資料；管理者核對實際銀行入帳後確認，才原子建立收款與使用期間。確認重試沿用同一操作鍵，不能重複開通。退回回報可補交，取消續訂保留已開通期限；更正收款不是銀行退款。

新會員預設 enforce；既有 W000001 保持 observe。原租金帳單、房客付款審核與銀行設定不使用這組訂閱資料。`commercial_billing_*` POST 路由要求原登入，CSRF 與 Core 簽章；瀏覽器沒有 Core 金鑰。正式平台管理權由 Core 核驗，原租管角色不能自授平台管理員。

綠界、藍新等後續管道使用付款 provider 模組，目前只開啟 bank-transfer。部署與驗收狀態以 Core operations 文件及 production-baseline 為準。

驗證命令：`npm run validate`；完整套件必須提供 `PLATFORM_CORE_TEST_WORKTREE` 與 disposable `DATABASE_URL` 後執行 `npm test`。公開租管 CI 執行 `test:unit`，Core 私有 CI 對固定租管 revision 執行完整跨 repo / PG 套件，避免將私有 Core 讀取 token 放入公開 repo。

隔離瀏覽器 fixture 僅接受私人 synthetic config、`prd_billing_db` 與 UUID 工作區；`node scripts/commercial-browser-fixture.mjs /private/staging-config.json` 綁定 127.0.0.1:18104。它使用合成租管登入與真實 Core staging HTTP，不能作為正式登入驗收證據。


## 2026-10-11 正式上線

會員與銀行轉帳功能已發布到 AI-00。Core5d24c57／十二個migrations／restricted writer14103；原SELECT-only reader14102保留。GAS232 immutable68檔與UTF-8修正1fe0e33一致，editor67 source檔相同、manifest語意相同，原URL及其他四deployments保留。Pages117c6c5／38098463477成功，61公開檔逐位元一致；UI來源Core0fc7575及兩個manifest SHA256已核對。

你的原Email登入／W000001 owner產生新鮮proof後，Core一次性bootstrap為平台管理者；後台六個頁面均能讀取，只有一位super admin及一筆正式會員provisioning。方案／銀行／付款／期間為空，原租管21間房間、未設定上限，保持observe。Chrome390×844手機版面已驗證；這不代表實體LINE裝置登入與連結驗收。完整測試816/816、0skip；公開CI單元套件與私有Node22／PG16跨repo套件均成功。

開始收款：先在「更多 → 訂閱會員管理後台 → 收款帳號」儲存啟用的銀行資料，再在「方案」設定名稱、金額、日／月／年週期、試用、房間上限與轉帳期限，儲存草稿後上架。會員在「會員中心與轉帳續訂」選方案並回報；你核對銀行實際入帳後，在轉帳審核確認開通。尚未設定銀行及付費方案前不能收實際订阅款。綠界／藍新與其他provider模組留待後續啟用。

正式bootstrap後DB與全部歷史key已在AI-00私有備份；隔離測試DB完成dump／restore比對及解密驗證。合成tunnel routes、測試服務／DB／roles、Google隔離專案九個測試Properties及operator已撤收；正式normal writer恢復，沒有測試付款写入W000001。金鑰不在瀏覽器或Git。

回退GAS229、Pages01b9f78；移除僅prd_cmwebs_rental匹配的14103 bridge route并停writer，保留支援十二migrations的14102 reader。不得把reader切回九migrations舊版本或刪訂閱財務資料／歷史AES keys。部署與更多維運證據見Core COMMERCIAL-SUBSCRIPTIONS-OPERATIONS.md；原效能等待問題與實體LINE驗收仍以各自文件追蹤。
