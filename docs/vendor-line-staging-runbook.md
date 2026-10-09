# 工單 LINE 獨立測試入口：Cloudflare staging 已部署

範圍：隔離 V3 原型，僅 @mmz7030n；不改 V2 Apps Script／Sheets／GitHub Pages 或其他官方帳號。

## 2026-10-10 LINE Developers 核對結果

- 已登入 LINE Developers，唯讀核對 Provider `dialogflow`（1631758156）。
- 同一 Provider 已建立 Login channel「CMWebs 工單測試」，Channel ID
  `2011937202`，目前狀態為 Developing。
- Web app Callback URL 已設定為
  `https://workorders-test.cmwebs.com/auth/line/callback`。
- Login channel 已關聯指定測試 OA `@mmz7030n/redbox 美拍美印`；這只提供
  測試登入流程的加好友選項，不改動該 OA 既有 webhook。
- 頻道密鑰已在管理台存在，但只允許注入 staging secret storage；不寫入
  repository、聊天、截圖或日誌。
- 指定 Messaging API 測試 OA `@mmz7030n`（channel 1592018523）仍指向既有
  Dialogflow webhook；本輪只讀取，不能用工單原型取代或改寫該 webhook。
- 以上只代表管理台設定已存在；網址尚無 DNS／公開服務，因此仍未完成真實
  LINE Login 或手機驗收。

## 2026-10-10 部署前置檢查（完成前紀錄）

- `cmwebs.com` 的權威 DNS 為 Cloudflare；`workorders-test.cmwebs.com` 目前查無
  A／CNAME 記錄。
- 本機沒有 `cloudflared`、Wrangler、Docker、Fly、Railway 或 Vercel 部署 CLI，
  repository 也沒有既定 staging launcher 或主機設定。
- Cloudflare 控制台目前要求人工登入；在沒有已驗證的帳戶 session／staging 主機
  前，不建立 DNS、不猜測 origin、不把 loopback server 暴露到網路。

## 2026-10-10 Cloudflare staging 部署結果

- 已在同一 Cloudflare 帳戶建立全新的 Worker `vendor-work-orders-staging`，沒有
  重用現有 CMWebs、No.88 或 Libenest Worker。
- 已建立全新的 D1 `vendor-work-orders-staging`（ID
  `23557e55-6e12-4a2a-9c08-ef9e445efbe7`）及 R2
  `vendor-work-orders-attachments-staging`；D1 migration
  `0001_vendor_work_orders.sql` 已套用。
- Worker version `15f8acdb-1ed1-4807-9703-0dff52220939` 已部署至
  `https://vendor-work-orders-staging.buyhotart.workers.dev`，並綁定
  `https://workorders-test.cmwebs.com`。
- 遠端讀回：`GET /health` HTTP 200；首頁 HTTP 200；`GET /api/line/status`
  HTTP 200，且只回報 `login_ready=false`、`notification_ready=false`，沒有
  回傳任何秘密。
- Cloudflare Workers Free／D1／標準 R2 guardrail 已寫入 Worker 設定；沒有啟用
  Workers Paid、R2 Infrequent Access、R2 SQL 或通知推送。
- `LINE_CHANNEL_SECRET` 尚未注入 Worker Secret，因此目前不能完成真實 LINE
  Login callback 或 webhook 驗簽；這是唯一待人工輸入的敏感設定。
- 現有測試 OA 的 Dialogflow webhook 沒有改動；本次沒有發送 LINE 訊息。

### 待完成的單一人工步驟

由管理者在本機終端機以互動方式輸入 LINE Developers 的 channel secret：

```sh
npx --yes wrangler@4.149.0 secret put LINE_CHANNEL_SECRET \
  --config _dev/vendor-work-orders-cloud/wrangler.jsonc
```

不要把 secret 貼到聊天、Git、截圖或 shell history。完成後再讀取
`/api/line/status`，確認 `login_ready=true`，才進行登入與手機驗收。

## 2026-10-08 設定核對與授權（歷史紀錄）

- 使用者已明確授權在同一 Provider 新增工單測試 LINE Login channel，並選定 `https://workorders-test.cmwebs.com`。
- 登入後唯讀核對 Provider `dialogflow`（1631758156）有兩個 Messaging API
  channels；指定測試 OA 對應 1592018523。當時沒有 LINE Login channel，不能
  借用其他 Provider 的登入通道。
- 當時已在該 Provider 填入「CMWebs 工單測試」建立表單，但尚未同意條款或
  提交；本段保留作為建立前的歷史狀態。
- DNS 查詢該測試網址未回傳記錄；這不是已部署入口。尚未建立 DNS、公開服務或儲存資源。前置 gate 仍須完成，不能直接公開 loopback 原型。
- 本次沒有改 webhook、發送訊息、更改其他 OA 或部署 V2。

## 目前已完成的本機能力（2026-10-10）

- 工單 domain、邀請／房東核准、LINE Login 交易與中文操作介面已在隔離
  `_dev/vendor-work-orders/` 完成。
- `POST /api/line/webhook` 已支援 raw-body HMAC 簽章驗證、事件 ID 去重、
  follow／unfollow 好友狀態及舊事件順序保護。
- 通知 adapter 已實作 enabled、Provider／subject 白名單、好友狀態、active
  membership、固定 retry key 與 timeout=`unknown`；預設仍關閉發送。
- 本機驗證：工單專項 144/144、repository `npm test` 791/791、`npm run validate`
  與 `git diff --check` 通過。這些只代表本機合成測試，不代表真實 LINE 收件。

## 後續：LINE secret 與真實驗收 gate

1. 由管理者互動輸入 `LINE_CHANNEL_SECRET` 到 Cloudflare Worker Secret；禁止聊天、
   Git、截圖與日誌出現秘密。
2. 讀取 `/api/line/status`，確認 `login_ready=true`；若仍為 false，不進行真實登入。
3. 完成 LINE Login callback、單一 membership、session 持久性、Webhook raw-body
   驗簽與 event ID 去重測試。
4. 由指定測試人員完成好友、登入、邀請確認、房東核准與重新登入；目前 Worker
   僅提供受控 staging，不允許合成身份遠端登入。
5. 發送保持關閉。只有在 Provider、HTTPS、secret storage、測試 subject 與手機收件
   都核對完成後，才可另行授權一則中性通知。

## 本機 API 候選

- GET /auth/line/start：一次性交易與 LINE redirect；缺設定 503。
- GET /auth/line/callback：驗證 state／nonce／token，拒絕既有登入身份混用。
- GET /api/line/pending：browser cookie 專屬、無原始 LINE identity。
- POST /api/line/confirm：JSON＋CSRF，明確確認；保存申請不啟用 membership。
- POST /api/line/bindings/:id/approve：房東 scoped 核准。
- GET /api/line/status：只回傳公開能力，尚未配置時 login_ready=false。

## 驗收與 rollback

本機 injected adapter／瀏覽器 regression 不等於手機登入或收件。需真機登入、確認、房東核准、重新登入看到本人工單，及報價／完工／驗收；未完成一項皆留 pending。
尚未部署，不需要 production rollback。未來先關通知 worker 再停測試 webhook；保留 V2 與其他服務不變。不能自行重啟舊 Dialogflow。
