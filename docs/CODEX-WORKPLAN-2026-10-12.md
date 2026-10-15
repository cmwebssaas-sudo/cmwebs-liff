# Codex 工作計畫：房東端速度與介面（2026-10-12 起）

> **2026-10-15 已批准加速修訂：** 房東要求大幅縮短上線等待時間；具體提案見
> [READ-ACCELERATED-ROLLOUT.md](READ-ACCELERATED-ROLLOUT.md)。原本文保留作歷史基線。
> 房東已明確批准 24 小時並行觀察、先房源頁，以及單次 wrapper 的 160 內試驗分配。
> 原三日／七日與兩次入口的相應條款以兩份修訂決策為準；所有技術前置與其餘門檻保留。

本文件是交給 Codex 的**執行計畫**。設計細節見
[`CLOUDFLARE-READ-PATH-PLAN.md`](CLOUDFLARE-READ-PATH-PLAN.md)；決策紀錄見
[`CMWEBS_ARCHITECTURE_DECISIONS.md`](CMWEBS_ARCHITECTURE_DECISIONS.md) 2026-10-11 各節。

**建議模型／速度**（AGENTS.md 要求每個任務開頭註明）：

| 工作 | 模型／速度 | 理由 |
| --- | --- | --- |
| R0、U 系列、C4 | `gpt-5.6-terra`／`medium`（repo 預設） | 規格明確、可由測試驗證 |
| S1、C1、C3、C5、C6 | `GPT-6.1 Sol`／高 | 身分驗證、同步一致性、金額計算對帳，錯了會洩漏資料或顯示錯誤金額 |
| C2 | `gpt-5.6-terra`／`medium`；若比對測試反覆失敗改用 `GPT-6.1 Sol`／高 | 照既有邏輯移植 |

---

## 0. 開工前必讀與共通規則

1. 依 `AGENTS.md`：先讀 `docs/CMWEBS_CODEX_HANDOFF.md`、`docs/EXECUTION_RECORD.md`、`docs/00-HANDOFF-INDEX.md`，並以 `git status`、branch、HEAD 重新驗證。
2. **每個工作單一個 worktree＋feature branch＋PR**；根目錄 checkout 有大量既有 WIP，不得碰觸。
3. 原逐次授權規則已由本對話的批次授權取代：各單驗收通過後，可依計畫 commit、push、PR、merge、部署、設定與逐頁切換。新增費用、刪除正式資料、計畫範圍修訂、本人登入／付款／真機驗收仍需房東。加速修訂已確認，依 READ-ACCELERATED-ROLLOUT.md 與 READ-TRIAL-MINIMUM-DECISION.md 執行。
4. 無法驗證的正式狀態一律標 `HUMAN_REQUIRED`，不得推測。
5. 每個 PR 必附：diff 摘要、`npm test` 結果（已知唯一失敗為需要 `PLATFORM_CORE_TEST_WORKTREE` 的跨 repo round trip）、`npm run validate`、`git diff --check`、風險、部署步驟、rollback。
6. **本 repository 是公開的，`docs/` 會由 GitHub Pages 公開**。不得寫入任何安全漏洞細節、token、密鑰、真實個資或真實 LINE UID。
7. 共用前端檔（`landlord-api.js`、`landlord-auth.js`、`landlord-responsive.css` 等）有改動時，必須同步推進 `frontend-release.js` 的 `CMWEBS_RELEASE_VERSION`、所有頁面 `?v=` 參數、`scripts/validate-static-release-cache.js` 與相關測試（參考 PR #262 的做法）。
8. 量測口徑：同帳號、Chrome 桌面與手機 LINE，記錄「請求送出 → 回應標頭」與「畫面可用」兩種時間，寫入 `docs/landlord-read-performance-measurements.json`；本機或合成資料不得當作提速證據。

---

## 1. 目前狀態（2026-10-12）

| 項目 | 狀態 |
| --- | --- |
| 首頁改版（深藍主視覺、滾動金額、逆時針收款率環、12 個月收入曲線、標題=管理團隊名稱） | PR #261 已合併 `4885a0e`；Pages run `38121570901` 成功，公開檔逐位元一致 |
| 首頁三個讀取並行、首頁瀏覽器快照 | 同上 |
| 內頁快照（房客、房源、欠款、物件、營收）、首頁預先載入、LINE SDK 按需載入、點擊進度條 | PR #262 已合併 `2a5779f`；Pages run `38151775414` 成功；release `20261011-fast-navigation-v1` |
| Apps Script 後端 | 本輪未變更；正式 serving 版本 `UNKNOWN`（見 handoff，需重新匯出對帳） |
| `docs/production-baseline.json` 的 `frontend_release_tag` | 仍為舊值，待 R0 更新 |
| C 計畫 | `docs/CLOUDFLARE-READ-PATH-PLAN.md`（本文件同 PR） |
| 真機 LINE 驗收、正式站提速量測 | `HUMAN_REQUIRED` |

---

## 2. 執行順序

```text
R0 ──► S1 ──► C0 ──► C1 ──► C2 ──► C3 ──► C4 ──► C5 ──► C6
          └──► U1 ──► U2 ──► U3   （U 系列可與 C1 之後並行，各自獨立 PR）
```

---

## R0　紀錄與正式狀態對帳（0.5 天）

**目標**：讓 repository 紀錄與正式狀態一致，作為後續所有部署的 rollback 基準。

工作：
1. 依既有流程（`npm run verify:production` 與 handoff 文件所述方法）重新讀回正式 Apps Script deployment 與 serving immutable version，匯出並與最新 `origin/main` 的 `apps-script/` 逐檔比對；結果寫入 `docs/production-baseline.json` 與 `docs/EXECUTION_RECORD.md`。無權限或無法讀回 → `HUMAN_REQUIRED`，停止並回報。
2. 確認公開 Pages 與 `origin/main` 一致後，將 `frontend_release_tag` 更新為 `20261011-fast-navigation-v1`。
3. 在 handoff 文件記錄 PR #261、#262 與本計畫。

驗收：baseline 與實際讀回一致；PR 只含紀錄檔。

---

## S1　房東請求身分強化（2–3 天，**最高優先**，安全前置）

**細節以私下工作單交付，不寫入本 repository。** 房東會另外提供 `CODEX-S1-PRIVATE` 工作單。R0 完成後立即開始，優先於 U 與 C 所有工作。
完成 S1 之前不得開始 C1。S1 的 PR 描述與 commit 訊息只能使用中性描述（例如「房東請求改用已驗證身分」），不得描述可被利用的方式。

---

## U 系列　介面改版推廣（可與 C 並行）

設計稿：Claude Design 畫布「CMWebs 房東首頁改版」（深藍 `#0F1E36`、琥珀 `#F2A33A`、成長綠 `#06C755`；手機首頁、開啟瞬間、房源列表、電腦版首頁四張）。首頁已依此上線，可作為實作參考（`landlord-home.css` 的 2026-10-11 區段）。

### U1　共用外框改版（2–3 天）
- 範圍：`landlord-responsive.css` 的桌面側欄、頂欄、手機底部導覽、卡片、按鈕、徽章基礎樣式改為新配色；側欄改為深藍、目前頁琥珀底。
- 保留 AGENTS 規定的固定 shell（`html, body` 高度、`.app-shell`、`.page`、`.bottom-nav`、safe-area、modal 高於導覽列）。
- 必須推進 release version（規則 7）。
- 驗收：既有 `phase220`、`phase244`、`phase250`、`phase260` 等 UI 測試更新且通過；以 `scripts/preview-landlord-home.mjs` 同類的本機合成預覽截圖 375px 與 1366px，首頁、房客、房源、欠款、更多五頁。

### U2　房源列表改版（1–2 天）
- 依設計稿「手機・房源列表」：搜尋框、狀態篩選膠囊（全部／未繳／將到期／空房／已繳）、房號色塊卡片。
- 只改 `landlord-rooms.html` 呈現層；資料來源與權限不變；保留 C 之後可切換的讀取函式。

### U3　其餘內頁套用（逐頁，每頁 0.5–1 天）
- 優先序：欠款 → 房客 → 帳單／付款回報審核 → 營收報表 → 更多 → 其他。
- 首頁待辦區改為 2×2 行動卡（保留 `homeActionSection` 等 id 與 `landlord-home-loading.test.mjs` 的就地更新行為）。
- 合約頁（`landlord-contract-requests.html`）只改樣式，**不加快照**（多來源合併，見 ADR）。

---

## C 系列　讀取改由 Cloudflare Workers + D1

### C0　Cloudflare 環境（房東操作＋0.5 天）
- **房東本人**：建立 Cloudflare 帳號、開通 Workers Paid（US$5／月）、建立 API token（權限限 Workers Scripts／D1 編輯、限該帳號）。Codex 不得代為輸入付款或帳密。
- Codex：在 repo 新增 `cloudflare/read-api/`（`wrangler.toml`、`src/`、`migrations/`、`test/`、`package.json`）。D1 建立時 `location hint = apac`。`wrangler.toml` 不含任何密鑰。
- 新增 npm script 與 CI job 執行 Worker 單元測試（本機 Miniflare／`wrangler dev`）。
- 驗收：`wrangler deploy --dry-run` 通過；CI 綠燈；未部署。

### C1　資料同步（約 1 週）
Worker 端：
- D1 schema（`migrations/0001_*.sql`）：每張同步表一個 table，欄位為讀取所需欄位＋`row_key`、`row_hash`、`synced_at`；另建 `sync_runs`、`shadow_diffs`。
- `POST /sync`：驗證 HMAC-SHA256（`X-CMWebs-Timestamp`、`X-CMWebs-Nonce`、`X-CMWebs-Signature`；時間差 ≤ 300 秒；nonce 10 分鐘內不可重複）。內容為 `{ sheet, rows:[{row_key, row_hash, fields}], complete: bool }`；比對 `row_hash` 只寫入改變的列；`complete=true` 時刪除未出現的列。單批 ≤ 500 列。
- 同步表與欄位白名單集中在一個檔案；**禁止**同步銀行帳號、證件、合約檔、Email 驗證碼、LINE token。

Apps Script 端（新增正式檔名 `apps-script/V2_READ_REPLICA_SYNC.js`，不得用版本式檔名）：
- dispatcher 在寫入成功後於 `CacheService` 標記變動的表（集中於 `Code.gs`／`程式碼.js` 的 dispatcher，不逐 route 修改）。
- 每分鐘觸發器：無標記立即結束；有標記才讀該表並分批推送。
- Email session 撤銷流程內立即推送該 session 列。
- 每日 03:00（Asia/Taipei）全量對帳。
- Script Properties 新增 `READ_REPLICA_URL`、`READ_REPLICA_SYNC_SECRET`（只記錄存在與否，不得讀出或提交值）。
- 測試：於 Node VM 載入真實模組，用合成 Sheet 驗證標記、分批、簽章、無變動快速結束、撤銷即時推送、白名單外欄位不外送。
- **先接測試用試算表**跑 3 天；記錄每日觸發器耗時（目標 < 15 分鐘／天；先確認帳號是一般 Gmail 90 分鐘／天或 Workspace 6 小時／天的額度，無法確認 → `HUMAN_REQUIRED`）。

授權點：部署 Worker；Apps Script 新版本；建立觸發器；新增 Script Properties；連正式試算表。

### C2　讀取 API 移植（1–1.5 週）
- 路由：`GET /v1/home?section=home|actions`、`/v1/revenue?range=&property_id=`、`/v1/tenants`、`/v1/rooms?include_archived=1`、`/v1/arrears`、`/v1/properties?include_archived=1`。
- **回應格式與現行 Apps Script 完全相同**（`{ success, code, message, data }`），前端只換來源不改渲染。
- 計算邏輯逐一移植自：`V2_WORKSPACE_DASHBOARD_NATIVE.js`（home、arrears、tenants）、`V2_WORKSPACE_LANDLORD_ACCESS.js`（`getWorkspaceLandlordHomeBootstrapByLineUid_`）、`V2_LANDLORD_ROOM_CENTER.js`、`V2_PROPERTY_ROOM_MANAGEMENT.js`、`V2_REPORTING_DASHBOARD.js`。
- **對帳測試（必過）**：建立 `tests/fixtures/read-parity/` 合成資料集（至少：多物件、空房、部分繳款、逾期、已撤銷帳單、跨月、停用房間、多 Workspace）。同一份資料：(a) 用 Node VM 執行真實 Apps Script 函式；(b) 匯入本機 D1 執行 Worker；兩者 JSON 逐欄位比較（金額、筆數、排序、遮罩），零差異才算通過。
- 驗收：6 條路由對帳全過；每條路由本機 p95 < 50 ms（合成資料）。

### C3　Worker 身分與權限（3–4 天）
- LINE：`Authorization: LIFF <id_token>`；呼叫 `https://api.line.me/oauth2/v2.1/verify`（`id_token`、`client_id` = LIFF channel ID），檢查 `aud`、`exp`、`iss`；以 `sub` 為身分，結果快取 5 分鐘（以 token 雜湊為 key）。
- Email：`Authorization: Session <token>`；以 Cloudflare Secret `EMAIL_SESSION_HMAC_SECRET` 依 Apps Script `landlordEmailAuthSessionTokenHash_` 相同方式計算雜湊，比對同步的 session 列（`status`、`expires_at`、`revoked_at`）。**若房東選擇不共用密鑰**，改為 Apps Script 簽發 30 分鐘讀取憑證（另案設計後再做）。
- 每次讀取重新檢查：Workspace 存在且啟用、membership 有效未停權、角色具讀取權限、資料範圍限於該 Workspace（等同 `workspaceLandlordProxy_` 的 read policy）。
- **不接受任何前端自報的身分欄位**。
- CORS 只允許 `https://cmwebssaas-sudo.github.io`；所有錯誤回 JSON，不洩漏堆疊。
- 越權測試（必過）：他人 token、過期、撤銷、停權成員、停用 Workspace、角色無權限、竄改 Workspace 參數、缺 token、偽造 token、重放舊 token。

### C4　前端讀取路由與開關（2–3 天）
- 在 `landlord-api.js` 新增讀取路由：依 `frontend-release.js` 中集中設定 `window.CMWEBS_READ_PATH = { home: 'off', revenue: 'off', tenants: 'off', rooms: 'off', arrears: 'off', properties: 'off' }` 與 `CMWEBS_READ_API_URL` 決定來源（AGENTS：不得在各頁散落 URL）。
  - `off`：只問 Apps Script（現狀）。
  - `shadow`：兩邊都問；畫面只用 Apps Script 結果；背景把差異欄位路徑（不含金額與個資）回報 `POST /v1/shadow-report`。
  - `on`：先問 Worker，3 秒逾時、非 2xx、格式不符 → 當場改問 Apps Script。
- 寫入成功後 2 分鐘內，同一 Workspace 的讀取強制走 Apps Script（同步延遲保護）。
- 與既有 `snapshot()` 相容：快照 key 不變。
- 推進 release version（規則 7）。
- 驗收：三種模式、逾時退回、寫後強制 Apps Script、開關缺失時等同 `off` 的測試全過。

### C5　Shadow 比對（約 1 週）
- 授權後將 6 頁全部切 `shadow`；每日彙整 `shadow_diffs`（筆數、路由、欄位路徑）寫入 `docs/EXECUTION_RECORD.md`。
- 任何差異 → 修正並重新累計；**連續 7 天零差異**的頁面才可提請切 `on`。
- 同時量測 Worker 實際回應時間（請求送出 → 回應標頭）。

### C6　逐頁切換與驗收（2–3 天）
- 每頁切 `on` 前取得房東授權；切換順序：房源 → 房客 → 物件 → 欠款 → 營收 → 首頁。
- 每頁切換後由房東在手機 LINE 與電腦各操作一次，記錄量測。
- 目標：首頁主資料 ≤ 0.8 秒、全部摘要 ≤ 1.5 秒、房間清單 ≤ 0.8 秒。未達標記錄實測值，不得宣稱達成。
- 完成後更新 `docs/LANDLORD-READ-PERFORMANCE.md`、handoff、ADR。

---

## 3. 回退總表

| 層 | 方法 | 影響 |
| --- | --- | --- |
| 單頁 | `CMWEBS_READ_PATH.<page>='off'` 並發布 Pages | 回到 Apps Script 速度 |
| 全部讀取 | 全部 `off` | 同上 |
| 同步 | 停用觸發器；D1 可清空重建 | 無資料損失（Sheets 為正式資料） |
| 前端改版 | revert 對應 PR | 回到前一版畫面 |

---

## 4. 交付檢查清單（每個 PR）

- [ ] 開頭註明建議模型／速度
- [ ] 獨立 worktree、只 stage 本次範圍
- [ ] 新增／更新測試；`npm test`、`npm run validate`、`git diff --check`
- [ ] 文件同步：`04-API-ROUTES.md`（新增 route 時）、`09-TEST-MATRIX.md`、ADR、handoff
- [ ] 共用前端檔變動時已推進 release version
- [ ] 公開文件無漏洞細節、密鑰、真實個資
- [ ] 風險、部署步驟、rollback
- [ ] 所有需要授權的動作皆已取得房東當次明確同意
