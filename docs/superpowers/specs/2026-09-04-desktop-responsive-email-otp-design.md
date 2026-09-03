# CMWebs 房東響應式桌面版與 Email OTP 登入設計

**狀態：** 已取得使用者設計確認，待 spec 審閱後進入實作規劃

**日期：** 2026-09-04（Asia/Taipei）

## 1. 目標

在不拆分 CMWebs 核心資料與權限模型的前提下，將現有房東手機頁擴充為同一套
響應式介面：手機維持現有 LIFF 操作，桌面瀏覽器在寬螢幕切換成適合滑鼠、鍵盤
與表格工作的布局。桌面入口新增 Email 一次性驗證碼登入，但手機仍使用 LINE／
LIFF 登入。

第一期只優化房東入口、房東總覽、房客清單、物件與房間；合約、退房與帳務維持
原有功能，後續再逐頁補上桌面布局。

## 2. 已確認的產品決策

- 使用一套共享核心程式、API、Workspace 與 RBAC，不建立桌面專用資料分支。
- 現有手機頁直接加入響應式桌面布局，不另建 iframe 或重複的桌面 SPA。
- `375px` 至 `767px` 維持手機布局；`1024px` 以上啟用桌面布局；中間寬度保留
  可用的單欄／平板布局。
- 新房東第一次註冊仍使用 LINE／LIFF。
- 已存在且完成 Email 驗證的房東，才可使用 Email OTP 登入桌面版。
- Email OTP 使用 6 位數驗證碼，10 分鐘有效、單次使用；60 秒內不可重寄，單一
  challenge 最多錯誤 5 次。
- Email 登入只建立房東操作 session，不取代 LINE 通知，也不把 LINE UID 回傳
  給瀏覽器。
- Email、驗證碼與 session token 不放在 URL；敏感登入操作使用 POST／HTML bridge。

## 3. 範圍

### 3.1 本期包含

1. `landlord-entry.html` 的桌面登入入口與 Email OTP 登入流程。
2. 房東桌面版總覽、房客清單、物件／房間頁布局。
3. 共用桌面側邊欄、頂部 Workspace／帳號列、頁面標題與狀態訊息。
4. 房東 Email 驗證、OTP challenge、Email session、登出與過期處理。
5. 房東 API 的雙身分解析：現有 LINE／LIFF 與新的 Email session。
6. 手機寬度回歸測試、桌面寬度測試、鍵盤操作與錯誤回饋測試。

### 3.2 不包含

- 新房東僅靠 Email 建立帳號或 Workspace。
- 固定密碼登入、密碼重設或第三方 OAuth。
- 租客 Email 登入。
- LINE OA、通知內容、LINE webhook 或租務商業規則變更。
- 合約、退房、帳務頁在本期的完整桌面重排。
- 重新建立一套 React／Next.js 應用或 iframe 桌面殼層。
- 未經授權的 Production migration、房客／合約／帳款資料交易或 Email 發送。

## 4. 前端介面設計

### 4.1 響應式邊界

現有手機 shell 與底部導覽保持為小螢幕預設。桌面樣式以獨立的共用 stylesheet
與明確的 media query 套用，不改寫手機基礎規則：

```css
@media (min-width: 1024px) {
  /* only desktop layout overrides */
}
```

桌面布局的固定規則：

- 左側導覽寬度 240px 至 272px，主內容區可伸縮，最大內容寬度 1440px。
- 桌面隱藏手機 bottom nav，改用左側導覽；鍵盤 focus ring 必須可見。
- 主要操作位於內容標題列或資料表上方，不依賴 hover 才能發現。
- 表格在 `1024px` 以上使用欄位分組與固定表頭；小於 `1024px` 回到卡片／單欄。
- 所有點擊目標至少 44px 高，正文至少 16px，文字對比符合 WCAG AA。
- 非必要動畫限制在 150–300ms，並尊重 `prefers-reduced-motion`。

### 4.2 第一期頁面

- **房東入口：** 桌面優先顯示 Email 登入；保留「使用 LINE 登入」次要入口。
  手機維持 LINE 登入為主，Email 入口不改變手機既有流程。
- **房東總覽：** 顯示收款、欠款、入住／空房、近期到期等既有資料；桌面用 KPI
  列與寬版資訊區塊，資料來源與期間定義不變。
- **房客清單：** 提供搜尋、狀態篩選、房號／合約到期欄位與進入房客詳細資料的
  明確操作；不在前端自行重算帳務。
- **物件與房間：** 以房間表格／分組卡片呈現出租、空房、合約狀態與既有操作，
  保留紙本補登、建立租約、退房等已存在入口與權限條件。

### 4.3 共用前端邊界

新增一個房東共用 auth／transport 模組，負責：

- 讀取 LINE／Email session 的目前登入模式。
- 將 Email session 以 `sessionStorage` 保存，瀏覽器關閉後不延長 session。
- 統一送出 `workspace_id`、session token 或 LINE 身分的 API 認證參數。
- 收到 `SESSION_EXPIRED`、`AUTH_REQUIRED`、`WORKSPACE_FORBIDDEN` 時清除本地 session，
  回到登入入口並顯示可理解的錯誤。

現有房東頁面的資料 render、表單欄位與商業計算保留在各自頁面；共用模組只處理
認證、傳輸、session 生命週期，不把頁面專用邏輯集中成新的大型單檔案。

## 5. Email OTP 身分與資料流

### 5.1 首次 Email 驗證

1. 房東先用 LINE／LIFF 登入既有帳號。
2. 在房東設定輸入 Email，伺服器寄出驗證碼。
3. 驗證成功後，伺服器以目前已驗證的 LINE 身分更新同一筆 `V2_users` 的 Email
   驗證狀態與時間。
4. 只有 `account_status=active`、角色為房東且 `email_login_enabled=true` 的帳號，
   才能使用 Email OTP 登入。

### 5.2 桌面 Email 登入

1. 房東在 `landlord-entry.html` 輸入 Email，前端以 POST bridge 請求登入碼。
2. 伺服器正規化 Email、套用寄送／重試限制、建立 challenge，並寄出 6 位數驗證碼。
3. 不論 Email 是否存在，前端均顯示不洩漏帳號存在性的通用訊息。
4. 房東輸入驗證碼後，前端以 POST bridge 傳送 `challenge_id` 與 code；驗證碼不
   出現在 URL、瀏覽器歷史、referrer 或一般 GET log。
5. 伺服器驗證 challenge、雜湊驗證碼、有效期限、嘗試次數、使用狀態與帳號狀態，
   成功後建立與 Workspace／角色綁定的短效 session。
6. 後續房東 API 由伺服器解析 Email session；不將 LINE UID 暴露給前端，也不把
   Email session 轉成假的 LINE 登入。

### 5.3 Session

- session token 使用加密隨機值，瀏覽器只保存 token，不保存驗證碼。
- session 綁定 `user_id`、目前 `workspace_id`、角色、簽發時間與到期時間。
- 每次受保護 API 請求重新驗證 session、帳號狀態、Workspace membership 與權限。
- 登出將 session 標記撤銷；到期、撤銷或 Workspace 切換失效時要求重新登入。
- LINE／Email 兩種登入方式都必須經同一個 Workspace／RBAC principal resolver，
  不在各頁自行判斷權限。

## 6. Apps Script API 與 Schema

### 6.1 新增 API 邊界

以下 action 名稱為本設計的固定介面，實作時須同步更新
`docs/04-API-ROUTES.md` 與測試：

- `landlord_email_verify_request`：由已登入 LINE 的房東發起或重寄 Email 驗證。
- `landlord_email_verify_code`：驗證設定 Email，建立 `email_verified_at`。
- `landlord_email_login_request`：以 Email 建立 OTP challenge 並寄送驗證碼。
- `landlord_email_login_verify`：驗證 challenge，建立 Email session。
- `landlord_email_session_status`：讀取並重新驗證目前 Email session。
- `landlord_email_session_revoke`：登出並撤銷 Email session。

登入請求與驗證請求走 `doPost` 的 JSON body 與受控 bridge 回應；既有 JSONP／GET
路由維持相容，但不承載 Email OTP 或 session token。

### 6.2 增量資料欄位與表

在既有 `V2_users` 追加：

- `email_verified_at`
- `email_login_enabled`

新增 `V2_landlord_email_login_challenges`，欄位固定為：

```text
challenge_id
user_id
email_hash
code_hash
issued_at
expires_at
attempt_count
last_attempt_at
consumed_at
status
request_id
```

新增 `V2_landlord_email_sessions`，欄位固定為：

```text
session_id
session_token_hash
user_id
workspace_id
role
issued_at
expires_at
last_seen_at
revoked_at
status
request_id
```

Challenge 與 session 表不保存驗證碼或明文 session token。Email hash 使用只存在
Apps Script Properties 的雜湊密鑰；寄信所需的 Email 僅在受控伺服器流程中使用。
Migration 只能追加缺少的 header／sheet，不可重排、刪除或覆寫既有資料列。

## 7. 安全與錯誤處理

- Email 正規化後再查找，且所有未找到、停用、未驗證情況使用相同對外訊息。
- 驗證碼 request 以 Email hash、使用者與時間窗做節流；同一 challenge 60 秒內不
  可重寄，15 分鐘內超過上限必須等待或由 LINE 登入處理。
- code compare 使用固定時間比較；成功後立即標記 consumed，並拒絕重放。
- 所有 Email session API 先解析 session，再重新檢查使用者、Workspace、角色與
  權限；不得信任前端傳入的 `workspace_id` 或 `role`。
- 驗證碼寄送失敗、MailApp quota 不足、Sheet 寫入失敗與 token 無效都 fail closed，
  不建立半完成登入。
- 登入、驗證、撤銷事件寫入既有操作稽核路徑；稽核內容不得包含 code、token、銀行
  資料或完整個人敏感資料。
- Email 登入不會自動發送 LINE 訊息，不會觸發租約、帳單或通知資料異動。

## 8. 測試與驗收

### 8.1 單元／整合測試

- Email 正規化、雜湊、code 驗證、過期、重放、錯誤 5 次與重寄 60 秒限制。
- 未驗證 Email、停用帳號、停用 membership、錯誤 Workspace 與錯誤角色均拒絕。
- 登入 session 的簽發、狀態、到期、撤銷與 Workspace 切換。
- 未找到 Email 與已找到 Email 的對外回應不可洩漏帳號存在性。
- LINE session 與 Email session 使用同一套 Workspace／RBAC resolver。
- migration 重跑冪等，既有 `V2_users`、房客、合約、帳單資料不變。

### 8.2 前端回歸

- `375px`、`390px`：現有手機登入、底部導覽、房客／物件頁功能與錯誤狀態不變。
- `768px`：單欄／平板布局無水平捲動，功能入口完整。
- `1024px`、`1440px`：桌面側邊欄、表格、Workspace 切換、鍵盤 focus 與 OTP 流程可用。
- Email 登入後重新載入頁面、session 過期、登出、瀏覽器返回與重複提交。
- 以 `prefers-reduced-motion` 驗證動畫停用或降級。
- 既有手機 screenshot／static tests 與房東 API route tests 必須通過。

### 8.3 發布驗證

- `npm run validate`、所有受影響 Apps Script 測試、完整 Node suite 與
  `git diff --check`。
- Apps Script immutable version、新增 schema header、Pages revision 與 rollback
  ref 分開記錄。
- 公開頁 read-back 確認桌面入口、Email 登入 UI、手機版 marker 與既有房東入口。
- 正式 Email 發送、已登入房東首次驗證、桌面登入與 Workspace 操作需另做
  `HUMAN_REQUIRED` 的 Production／真機驗證，不以靜態測試代替。

## 9. 發布與回滾

### 9.1 發布順序

1. 在隔離 feature branch 完成 RED／GREEN 測試與 spec 對應的程式修改。
2. 先以測試與候選 validator 驗證，不寫正式房客／合約／帳務交易。
3. 取得正式發布授權後，執行 additive migration、Apps Script 新 immutable version
   與 GitHub Pages publish；既有 Web App URL 不變。
4. 以 read-only 方式確認 API、schema、Pages 與登入入口，再安排已登入房東的 Email
   驗證與桌面 UAT。

### 9.2 回滾

- Apps Script：將既有 Web App deployment 指回此次發布前的 immutable version。
- Sheets：不以回滾刪除欄位或資料列；若 migration 出現問題，停止新 route 並依
  scoped recovery plan 處理。
- GitHub Pages：還原此次發布前已驗證的 Pages source revision。
- Email session：撤銷尚未過期的受影響 session；不刪除稽核紀錄。
- LINE、通知、合約、帳單與租客資料不執行通用回滾覆寫。

## 10. 設計自我檢查

- 範圍已限制為房東第一期桌面介面與 Email OTP；未加入租客 Email、固定密碼、
  React 重構或未核准商業功能。
- 手機與桌面共用 API／資料／權限；桌面 CSS 以 media query 隔離，符合既有固定
  shell 與手機回歸要求。
- OTP、challenge、session、Workspace 與 RBAC 的資料流前後一致，且不把敏感值放入
  URL 或前端明文儲存。
- 所有新增 action、schema、測試、migration、發布與回滾責任均有對應章節；沒有
  未完成項目或未決定的流程分支。
