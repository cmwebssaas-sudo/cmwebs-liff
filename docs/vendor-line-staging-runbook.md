# 工單 LINE 獨立測試入口：尚未部署

範圍：隔離 V3 原型，僅 @mmz7030n；不改 V2 Apps Script／Sheets／GitHub Pages 或其他官方帳號。

## 2026-10-10 LINE Developers 核對結果

- 已登入 LINE Developers，唯讀核對 Provider `dialogflow`（1631758156）。
- 同一 Provider 已建立 Login channel「CMWebs 工單測試」，Channel ID
  `2011937202`，目前狀態為 Developing。
- Web app Callback URL 已設定為
  `https://workorders-test.cmwebs.com/auth/line/callback`。
- 頻道密鑰已在管理台存在，但只允許注入 staging secret storage；不寫入
  repository、聊天、截圖或日誌。
- 以上只代表管理台設定已存在；網址尚無 DNS／公開服務，因此仍未完成真實
  LINE Login 或手機驗收。

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

## 下一步：獨立 staging 前置 gate

1. 已完成 LINE Developers 登入與同 Provider 核對；下一步只可在部署環境以
   secret storage 注入 Login channel secret，禁止聊天／Git／日誌。
2. 使用者選定獨立 HTTPS 網址，核實 host／持久資料及附件儲存。現有 server 綁定 loopback、拒絕外部 Host／Origin，尚不可直接對外暴露；必須先完成固定可信 reverse proxy origin 與測試，不得移除檢查來湊通。
3. 目前無 CLI 環境設定與部署 launcher；不得把注入測試 adapter 或例子 URL 當作正式配置。
4. 真實房東測試 session 尚需受控 identity bootstrap（不可允許合成房東遠端登入），合作對象只能邀請／確認／房東核准後建立 membership。
5. 發送保持關閉。先以獨立 staging 驗證 webhook；不要替換現有 webhook，也不要
   啟用真實推播，直到 Provider、HTTPS、secret storage、測試 subject 都核對完成。
6. 由使用者在 LINE Developers 完成同一 Provider 的 Login channel 建立並取得
   channel ID／secret；secret 只注入 staging 環境，不回傳聊天或提交 Git。
7. 部署 loopback server 後面的固定 HTTPS reverse proxy，先只做健康檢查、登入關閉、
   webhook 簽章驗證與持久 snapshot；確認錯誤 Host／Origin、偽造簽章與未登入工單
   都拒絕。
8. 再由指定測試人員完成好友、登入、邀請確認、房東核准與重新登入；最後才允許
   一個白名單 subject 發送一則中性通知，人工確認手機收件。

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
