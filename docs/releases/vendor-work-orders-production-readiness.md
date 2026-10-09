# 工單正式部署紀錄

日期：2026-10-10。建議模型／速度：gpt-5.6-terra / medium。
分支：codex/vendor-work-orders-production-20261010。
使用者確認正式入口 workorders.cmwebs.com、Hans 為第一位管理者；合作人員未來再加入。
本服務獨立於 V2 租管；root 混合 WIP、既有 Apps Script、Sheets、Pages、OA webhook 不變。

## 正式資源與來源

- 正式入口：https://workorders.cmwebs.com
- Worker：vendor-work-orders-production；版本 61e57000-0563-4706-8e19-77afb3af3fb6。
- Config：`_dev/vendor-work-orders-cloud/wrangler.production.jsonc`。
- D1：vendor-work-orders-production，a10a8db3-6e2f-45ac-9380-29d714af0d5d。
- Private R2：vendor-work-orders-attachments-production；無公開桶網址。
- 已套用 migrations 0001_vendor_work_orders.sql、0002_commit_revision.sql。
- LINE Login：2011937202／provider 1631758156；已 Published。
- Callback 同時保留正式與 staging 網址。既有 OA Messaging webhook 未修改。
- LINE_CHANNEL_SECRET、OWNER_ACTOR_ID 只在 Worker secrets；原始 LINE subject 不進 Git。
- OWNER_WORKSPACE_ID 為 cmwebs-workorders。僅指定已驗證 LINE 身分能初始化管理者；停用 membership 後再次登入不會自動復權。
- 測試環境仍使用獨立 staging D1/R2；此部署沒有搬入 staging 或合成合作資料。

## API、權限與資料行為

雲端已接通工單草稿、派工邀請、報價／核准、接單、開工、追加費用、完工、驗收、
合作目錄／成員／優先順位／固定價約定、LINE 綁定邀請／確認／核准／撤銷及私有附件。
資料投影沿用共用 domain；每次 request 重新驗證 session、workspace 和 active membership；寫入與 idempotency replay 在提交邊界再次驗證。

D1 使用單一 SQL 取得一致 snapshot 及 revision；提交 batch 先 CHECK revision，再原子更新 rows 和 revision。
兩個獨立 store 寫相同舊版本時，後者回 VERSION_CONFLICT，保留前者資料。
沒有使用記憶體 queue 作為跨 instance 的唯一防護。

目前仍以全域 snapshot 保存 bounded work-order state，寫入成本隨資料量增加。
此輪未宣稱大規模多租戶效能驗收；擴大資料規模前應改為逐列交易，維持相同版本／授權規則。

附件最多 10 MiB、限制類型與 signature；stream 有大小上限，metadata 有 idempotency replay，
R2 寫入而 D1 失敗時清理 orphan。每次下載重新授權及記錄唯一 audit event。
公開診斷 /api/cloud/state 已關閉；未知 API 不落入 HTML fallback。

## 已驗證證據與界限

- npm run validate 通過；完整回歸 810/810，雲端受影響測試 19/19。
- 真實瀏覽器：Hans LINE Login callback 成功；房東管理頁、空合作清單可讀。
- 正式 HTTP：health 200、login_ready true、未登入 session 401、公開診斷 404。
- 已用正式 UI 保存「上線驗收草稿（未派工）」並重新讀回；未派工／未發外部訊息。
- SQLite-backed cloud API 測試：完整固定價工單、附件重送／多次下載／跨 workspace 拒絕、邀請 token 一次顯示、owner 身分與撤權、獨立 store 衝突。
- 全流程測試使用合成資料的本機 SQLite/R2 adapter；不是實際合作人員手機驗收。
- 通知保存在工作台 inbox；LINE push 尚未配置，notification_ready=false。

## 備份、復原與 rollback

已匯出正式初始化資料到受保護的本機備份：
`/Users/hans/CMWebs/backups/workorders/2026-10-10-bootstrap.sql`，目錄 0700／檔案 0600。
此備份包含一筆 workspace membership，當時沒有合作人員與工單；已匯入記憶體 SQLite 驗證 schema=1、membership=1。
備份可能包含 session 資料，不可提交 Git 或公開分享。此輪是一次性備份，未設定週期備份。

程式 rollback：使用正式 config 執行 Wrangler rollback 至先前版本 f031562b-f7c0-477c-9a71-4eb70e265d20；
該版本保留相同正式綁定、API 及資料規則，只回退最後一輪 UI 提示調整。不要回退到空 Worker。
D1 revision migration 是加法變更，程式 rollback 不回退資料庫。

資料復原：先暫停工單寫入、匯出當前 DB，另建 recovery D1，載入備份並驗證 row counts；
清除恢復的 session／browser auth rows，重新登入；核對 R2 metadata 的物件是否存在。
只有確認 recovery 正確後才切換 DB binding；本次沒有覆寫正式資料。
LINE 頻道 Published 不能直接回 Developing；部署回退只回退 Worker，不刪除頻道。

## 後續操作

沒有合作人員時仍可保存工單草稿。未來到「合作設定」新增公司／個人與工種，
建立一次性 LINE 邀請；對方登入確認後，由房東核准，再開始派工。
LINE 主動推播另需正確的 Messaging API channel secret/token 及真實收訊驗收；不得用 Login channel secret 替代。
