# 工單 LINE 獨立測試入口：尚未部署

範圍：隔離 V3 原型，僅 @mmz7030n；不改 V2 Apps Script／Sheets／GitHub Pages 或其他官方帳號。

## 前置 gate

1. 人工登入 LINE Developers 後核對 Login 與指定 Messaging channel 同一 Provider；秘密透過伺服器 secret storage 注入，禁止聊天／Git／日誌。
2. 使用者選定獨立 HTTPS 網址，核實 host／持久資料及附件儲存。現有 server 綁定 loopback、拒絕外部 Host／Origin，尚不可直接對外暴露；必須先完成固定可信 reverse proxy origin 與測試，不得移除檢查來湊通。
3. 目前無 CLI 環境設定與部署 launcher；不得把注入測試 adapter 或例子 URL 當作正式配置。
4. 真實房東測試 session 尚需受控 identity bootstrap（不可允許合成房東遠端登入），合作對象只能邀請／確認／房東核准後建立 membership。
5. 發送保持關閉。webhook／好友狀態／白名單通知 worker 尚未實作，不應先替換現有 webhook。

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
