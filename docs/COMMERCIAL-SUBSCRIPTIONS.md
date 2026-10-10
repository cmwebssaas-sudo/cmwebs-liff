# 會員與轉帳訂閱

會員使用原房東 Email／LINE 登入。會員中心在 `landlord-subscription.html`，管理後台在 `platform-admin.html`；方案、價格、週期、房間上限、試用與收款銀行由平台管理者設定。沒有已上架方案時顯示空狀態；付費方案必須先有啟用的訂閱收款銀行才能上架。

新帳號必須通過 Email 驗證碼或 LINE 官方驗證。帳號與工作區仍寫入原租管工作表，Core 依 Product 外部 User／Workspace 綁定 Company。連線逾時保留原識別碼，可重試恢復。Email 新會員可明確連接本人 LINE，沿用相同帳號與工作區。

轉帳付款單保留當時方案與銀行指示。會員回報只產生審核資料；管理者核對實際銀行入帳後確認，才原子建立收款與使用期間。確認重試沿用同一操作鍵，不能重複開通。退回回報可補交，取消續訂保留已開通期限；更正收款不是銀行退款。

新會員預設 enforce；既有 W000001 保持 observe。原租金帳單、房客付款審核與銀行設定不使用這組訂閱資料。`commercial_billing_*` POST 路由要求原登入，CSRF 與 Core 簽章；瀏覽器沒有 Core 金鑰。正式平台管理權由 Core 核驗，原租管角色不能自授平台管理員。

綠界、藍新等後續管道使用付款 provider 模組，目前只開啟 bank-transfer。部署與驗收狀態以 Core operations 文件及 production-baseline 為準。

驗證命令：`npm run validate`；完整套件必須提供 `PLATFORM_CORE_TEST_WORKTREE` 與 disposable `DATABASE_URL` 後執行 `npm test`。公開租管 CI 執行 `test:unit`，Core 私有 CI 對固定租管 revision 執行完整跨 repo / PG 套件，避免將私有 Core 讀取 token 放入公開 repo。

隔離瀏覽器 fixture 僅接受私人 synthetic config、`prd_billing_db` 與 UUID 工作區；`node scripts/commercial-browser-fixture.mjs /private/staging-config.json` 綁定 127.0.0.1:18104。它使用合成租管登入與真實 Core staging HTTP，不能作為正式登入驗收證據。
