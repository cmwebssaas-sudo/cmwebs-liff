# LINE 工單實作進度

2026-10-08：計畫 `superpowers/plans/2026-10-08-vendor-line-test.md` 已獲核准，由主代理直接實作。

任務 1 進行中：新增 `line-binding.mjs` 純轉移核心與兩項測試，先確認缺少模組而失敗，再確認測試通過。邀請 token 僅保存雜湊，24 小時到期；申請不直接授權，需房東核准；撤銷、重放、跨工作區及非房東操作拒絕。

2026-10-08 下一步：核心已接入本機 store 與交易 API；舊 snapshot 加入空邀請與申請表，不改既有工單。合作設定新增邀請建立、讀回、撤銷與申請核准介面。列表不返回原始 token、token hash 或 LINE identity；重放結果不保存或再次返回 token。

2026-10-10：完成隔離 webhook／通知核心。新增 `line-webhook.mjs` 的 raw-body
HMAC timing-safe 驗證、event ID 去重、follow／unfollow 狀態與舊事件順序保護；
新增 `line-notifications.mjs`，只接受明確白名單、仍在好友狀態且 active membership
的單一測試 subject，發送關閉回報 disabled，傳輸超時回報 unknown 並固定
`line:<entry.id>` retry key。`POST /api/line/webhook` 只在注入 channel secret／Provider
時啟用，事件先驗證再寫入本機 snapshot。完整工單專項 144/144 通過；未啟用真實
LINE API、未新增 secrets、未部署。

2026-10-10：按已核准的 Cloudflare Worker + D1 + R2 設計完成第一個雲端垂直切片。
新增 `_dev/vendor-work-orders-cloud/`，包括 Worker router、D1 state/auth store、
Web Crypto LINE Login PKCE、Webhook 驗簽／去重、R2 私有附件、Session、工作單讀取與
指派動作 idempotency。新建獨立 D1／R2，套用 migration，Worker version
`973dffe3-29be-44ca-9add-81dfe0e97a6a` 已綁定 `workorders-test.cmwebs.com`。
遠端 health、首頁及 LINE status 均 HTTP 200；目前 login_ready=false 是因為 secret
尚未注入，notification_ready 保持 false。沒有改既有 Worker、OA webhook 或發送訊息。

本機介面回歸驗證建立、重載保留及撤銷。尚無公開申請 endpoint，不接受使用者提交假 LINE identity。

待完成：由管理者互動注入 `LINE_CHANNEL_SECRET` 後，完成真正 LINE Login callback、webhook
簽章驗證、合作綁定與手機驗收。`notification_ready` 仍需維持 false，直到另外的通知
啟用 gate 通過。秘密不寫入聊天、Git 或日誌。

驗證：新核心測試 2/2；`npm run validate` 通過；`git diff --check` 通過。這些不是 LINE 收件或完整工單綁定證據。

本輪完整回歸：`npm test` 778/778；`npm run validate` 通過。本機預覽與合成身份不等於真實 LINE 登入。

## 登入交易串接（2026-10-08 下一輪）

新增 line-auth.mjs：authorization code、PKCE S256、nonce/state、10 分鐘 browser-bound 交易、單次 callback／code、官方 token exchange 與 ID-token verify。驗證 issuer、audience、expiry、nonce；只回傳 verified Provider/subject，不回傳 LINE token／secret。

server 候選新增 start/callback、確認綁定／待審核讀回；callback 不直接寫 membership。明確確認後交易保存一筆待核准申請；房東核准後重新登入才取得 vendor session。既有登入身分與 callback 混用會拒絕。多工作區 membership 暫拒絕，不任選第一筆。Cookie 使用 Secure／HttpOnly／SameSite=Lax。

中文介面顯示確認公司及職責、等待房東核准；部署模式不顯示本機合成身份。CLI 本機仍未配置真實 LINE，notification_ready=false。server/public 改動保留在既有隔離 WIP，未發布或合併。

外部阻擋：本輪實際 Chrome 的指定 OA Developers 分頁為 LINE Business ID 登入頁，不能核對 channel 配對或安全設定秘密。已請使用者重新登入與選定獨立 HTTPS 網址。尚未建立雲端資源、改 DNS／webhook、發送通知或讀取任何密鑰。

官方依據：https://developers.line.biz/en/reference/line-login/ 及 https://developers.line.biz/en/docs/line-login/integrate-pkce/ 。同 Provider 是管理台配置核對，不能從 ID token 猜測。

最終本輪：完整786/786、validate、diff-check通過；核心及測試commit b7bbe74。API／UI候選仍與既有原型WIP一起保留，尚未合併。重啟8787讀回能力仍為login_ready=false及notification_ready=false。剩餘部署gate見vendor-line-staging-runbook.md。

## 2026-10-10 LINE Developers 設定核對

使用者已完成 LINE Developers 登入。已在 `dialogflow` Provider（1631758156）
核對同一個 Login channel「CMWebs 工單測試」（Channel ID 2011937202），狀態為
Developing；Web app Callback URL 已設定為
`https://workorders-test.cmwebs.com/auth/line/callback`。只記錄非秘密的管理台
證據，未讀取或保存 channel secret。Login channel 也已關聯指定測試 OA
`@mmz7030n/redbox 美拍美印`；既有 OA webhook 沒有改動。

這仍不是公開服務或真實登入證據：`workorders-test.cmwebs.com` 尚無 DNS／固定
HTTPS reverse proxy，login secret 也尚未注入 staging；通知保持關閉。下一步是
完成獨立 staging 的 host、持久儲存與 secret storage，再做 callback、webhook
簽章及受控手機驗收。
