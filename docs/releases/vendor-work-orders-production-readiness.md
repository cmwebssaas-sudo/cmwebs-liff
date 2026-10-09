# 工單正式部署準備

日期：2026-10-10。範圍：獨立工單服務，房東先使用，合作人員未來再加入。
使用者已要求準備並部署正式版；這不表示現有雲端切片已具備完整功能。
建議模型／速度：gpt-5.6-terra / medium。
分支：codex/vendor-work-orders-production-20261010。

## 已核對的基線

- 隔離 worktree 來源 ae8120d，root 混合 WIP 未修改。
- 測試 Worker 42383aca-5964-45cf-aa66-8b0466dbcb1c；rollback 0e37cb56-3688-42ee-8085-ee6b80184fcb。
- 測試入口 workorders-test.cmwebs.com。獨立 D1/R2，未匯入正式資料或合成身份。
- LINE 身分交換及 claims 驗證已通過，沒有合作 membership 時回傳 LINE_MEMBERSHIP_REQUIRED。
- 雲端資料目前全部為空；沒有合作人員不是正式部署的阻礙。
- 本輪關閉 /api/cloud/state 公開診斷；未知 /api/* 及 /auth/* 不再交給 HTML fallback。
- LINE 通知尚未啟用。現有 OA webhook 不變。

## 正式版必要行為

房東登入後可見空白工單及合作清單；沒有合作對象時仍可建立並保存草稿。
派工前要求選擇已建立且啟用的合作對象。未綁定的人看到明確待邀請訊息，沒有工單存取權。
未來透過新增合作對象、建立一次性邀請、LINE 登入確認、房東核准的流程加入，不靠人工填 LINE ID。

## 尚未完成的發布阻礙

1. 房東登入：Worker 現在只建立 vendor session，沒有正式房東 workspace membership 的登入及初始化流程。
2. API 完整性：UI 會呼叫 partners、service-agreements、priority-rules、line bindings/invites、建立工單、報價與房東核准／驗收等路由，Worker 尚未移植完整本機 API。
3. D1 併發：d1-state-store 讀全表再 DELETE/INSERT 重寫，queue 僅限單一 createWorker instance。不同請求讀到同一版本時會丟失更新。必須使用資料庫層級條件版本／原子提交並驗證跨 instance 競爭；不能靠記憶體 queue 或單一請求測試宣稱通過。
4. 正式資源：需獨立 production Worker、D1、private R2、origin 及 callback 設定，不直接把 staging 資料庫改名為正式環境。
5. 真實验收：房東登入 session、零合作人員建立／重載草稿、權限隔離、重複提交、資料衝突、附件、備份及回復必須通過。

## 待確認的環境身份

- 建議正式網址 workorders.cmwebs.com；等待使用者確認。
- 建議第一位房東管理者使用已登入的 Hans LINE 帳號；等待使用者確認。
- 未確認前不給任意 LINE 使用者 landlord 權限，不建立公開自助管理員入口。

## 執行順序與驗收

1. 補齊 D1 跨請求版本衝突防護，兩個独立 Worker instance 競爭測試不能丟資料；同一 idempotency key 不能重複新增。
2. 移植 landlord/vendor 共用的權限投影、合作設定與工單操作 API，完整沿用 domain 規則；每個寫入驗證 workspace membership。
3. 補齊 LINE 邀請／pending／confirm／房東 approve；未授權身份不能建立 session。
4. 初始化明確指定的正式房東 workspace，保留 partners 空表，驗證空白畫面及保存草稿。
5. 建立隔離正式資源與固定 origin，注入 secrets，設定 callback；記錄不可變版本／migration／rollback。
6. npm run validate、受影響測試、完整回歸及實際瀏覽器保存重載通過後發布，記錄正式證據。
7. 通知保留未啟用，待未來合作人員綁定及通知管道驗收後啟用。

目前結果：完成發布範圍核對與第一項安全修正；尚未正式部署。
