# 合作工單 LINE 測試串接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 合作對象可安全綁定 LINE、登入處理工單，並只向指定測試人員發送通知。
**Architecture:** 在隔離工單原型新增 LINE 身分、webhook 與通知 adapter，沿用 domain 的 membership 與工單權限。先以注入測試 adapter 驗證，再接獨立 HTTPS staging；不變更 V2。
**Tech Stack:** Node.js 22、ES modules、node:test、既有瀏覽器測試、LINE Login／Messaging API。
**Spec:** ../specs/2026-10-08-vendor-line-test-design.md

## Global Constraints

- 測試 OA 僅 `@mmz7030n`；禁止借用其他帳號服務或正式資料。
- 預設發送關閉；禁止 broadcast、multicast 與舊好友名單群發。
- 密鑰只存伺服器 secret storage，不能進入 Git、公開資產或日誌。
- 本機與測試通過不代表真實 LINE 收件或正式發布。
- 保留現有 WIP；每個提交只 stage 本任務明確檔案。

## Review Focus

- 轉寄邀請：未經房東核准不能取得工作權限（任務 1）。
- 登入中更換身份：拒絕 session／邀請不一致（任務 2）。
- 成員停用後佇列仍有訊息：發送前重查 membership（任務 3）。
- webhook 事件重送或順序顛倒：不得重建成員或誤恢復好友狀態（任務 3）。
- 儲存成功但畫面超時：讀回結果，不重送寫入（任務 4）。

### 任務 1：單次邀請與房東確認

**Files:** Create `_dev/vendor-work-orders/line-binding.mjs`; Modify `server.mjs`, `store.mjs`（同目錄）；Test `tests/vendor-work-orders-line-binding.test.mjs`。
**Interfaces:** `createBindingInvite(state, principal, {partner_id, member_role}, now)` 回傳 `{state, token, invite}`；`requestBinding(state, {token, verified_identity}, now)` 回傳待審核申請；`approveBinding(state, principal, request_id, now)` 回傳啟用 membership。身份是 `{provider_id, subject}`，不可從一般 request body 信任。

- [ ] 寫 failing tests：邀請只存雜湊、到期與撤銷拒絕、token 重放拒絕、轉寄後仍待審核、跨 workspace 核准拒絕；assert 未核准身份沒有 membership。
- [ ] 執行 `node --test tests/vendor-work-orders-line-binding.test.mjs`，確認新增模組缺失造成 FAIL。
- [ ] 實作上述純函式，crypto random token／SHA-256；讀改寫在既有 store 交易內執行。新增 `/api/line/invites`、`/api/line/bindings/:id/approve` POST，沿用冪等與 session 權限。
- [ ] 同命令 PASS，既有 API 測試 PASS；更新本機 README 的 routes 與資料欄位。
- [ ] 僅提交此任務檔案：`feat: add approval-gated vendor binding invitations`。

### 任務 2：伺服器 LINE 登入交易

**Files:** Create `_dev/vendor-work-orders/line-auth.mjs`; Modify `server.mjs`; Test `tests/vendor-work-orders-line-auth.test.mjs`。
**Interfaces:** `createLineAuth({config, identityAdapter, clock})` 提供 `begin({inviteToken, sessionId})` 與 `complete({code, state, sessionId})`；adapter `exchangeAndVerify({code, nonce, redirectUri})` 回傳 verified `{provider_id, subject}`。僅允許 configured callback URI；server secrets 從外部環境注入。

- [ ] Tests：錯誤 state／nonce／audience、逾期交易、重放 code、換 session、Provider 不符均拒絕；成功身份進入任務 1 的待審核，不能自行選角色。
- [ ] 執行 `node --test tests/vendor-work-orders-line-auth.test.mjs`，先確認 FAIL。
- [ ] 查閱 LINE 官方現行文件後實作 authorization code 交換及 token 驗證；新增 `/auth/line/start`、`/auth/line/callback`。staging cookie Secure／HttpOnly；既有 dev session 保持僅 development 可用。
- [ ] 同命令 PASS；秘密與 token 不出現在 API 回應或日誌。
- [ ] 路徑限定提交：`feat: add verified LINE login transactions`。

### 任務 3：簽章 webhook 與受限通知

**Files:** Create `_dev/vendor-work-orders/line-webhook.mjs`, `line-notifications.mjs`; Modify `domain.mjs`, `server.mjs`; Test `tests/vendor-work-orders-line-notifications.test.mjs`。
**Interfaces:** `verifyWebhook(rawBody, signature, secret): boolean`；`applyWebhookEvents(state, events, now): state`；`dispatchLineNotification({entry, state, config, transport})` 回傳送出狀態。transport `push({to, message, retryKey})`；config 含 enabled、allowlistedSubjects、providerId、publicOrigin。

- [ ] Tests：原始 body 簽章、偽造拒絕、event 去重、follow 不授權、unfollow 停送、亂序事件拒絕覆寫較新狀態、白名單外零呼叫、停用成員零呼叫；超時保持相同 retryKey 與 unknown，不另送。
- [ ] 執行 `node --test tests/vendor-work-orders-line-notifications.test.mjs`，確認 FAIL。
- [ ] 實作 `/api/line/webhook`，解析前 HMAC／timing-safe 比較；通知 worker 僅交易提交後執行。依 membership 與指派解析收件人，訊息只含中性工種／登入連結，發送前重查權限與好友狀態。
- [ ] 同命令 PASS；重跑 domain／API 測試；紀錄 queued、accepted、failed、unknown，通知關閉仍留本機收件匣。
- [ ] 路徑限定提交：`feat: add signed webhook and allowlisted LINE notifications`。

### 任務 4：中文綁定操作與整體回歸

**Files:** Modify `_dev/vendor-work-orders/public/app.js`, `app.css`, `index.html`, `README.md`, `TEST-MATRIX.md`; Test `tests/vendor-work-orders-ui.test.mjs`。
**Interfaces:** 使用任務 1／2 routes；畫面顯示未綁定、待確認、已綁定、已停用；核准後沿用既有工單 session 授權。

- [ ] Tests：產生邀請、登入確認、房東核准、廠商只見己方工單；回應超時讀回，不自動重送；原先報價／施工／驗收仍可用。
- [ ] 跑受影響 UI tests 確認 FAIL。
- [ ] 加「邀請 LINE 綁定」與核准操作、中文錯誤提示；保留固定 shell／收合表單及原工單欄位。
- [ ] `npm test`、`npm run validate`、`git diff --check` 全通過，更新測試矩陣；只記錄實際執行結果。
- [ ] 路徑限定提交：`feat: expose vendor LINE binding flow`。

### 任務 5：独立 staging 與真實測試

**Files:** Create `docs/vendor-line-staging-runbook.md`、`docs/vendor-line-test-evidence.md`。
**Interfaces:** 消費前四任務；不擴大正式部署。部署網址、資源與收件人皆先核對，再寫入環境設定。

- [ ] 核實可用隔離 host、資料與附件儲存、LINE Login channel／Provider 配對；缺少時列明所需資源，不回落正式服務。
- [ ] 部署發送關閉的 HTTPS 測試服務；公開健康檢查不包含私有資料，確認未驗證 webhook／未登入工單均拒絕。
- [ ] 秘密透過安全 secret storage 設定；保存舊 Dialogflow URL 與原本關閉狀態，再替換 webhook URL、Verify 成功後啟用。
- [ ] 請指定測試人員完成好友／登入／綁定；只白名單該身份，發送一次中性測試通知並人工確認收件。
- [ ] 完整報價→核准→指派→完工→驗收，記錄瀏覽器、真機與 HTTP 證據分界；回滾先停 worker 再關 webhook，不自動重啟 Dialogflow。
- [ ] 提交不含秘密的 runbook 與驗收紀錄；不得將此結論描述為 V2 正式發布。
