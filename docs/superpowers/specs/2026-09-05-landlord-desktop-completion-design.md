# 房東桌面版完成設計

**日期：** 2026-09-05（Asia/Taipei）
**產品分類：** V2.0 內部營運正確性／穩定性完成
**Production 影響：** 需要新的 Apps Script immutable version 與既有 GitHub Pages 發佈；不修改既有房客、合約、帳務資料，不執行 Sheet migration。

## 目標

讓房東可以在電腦瀏覽器以 Email 一次性驗證碼登入，並在登入後使用現有的房東首頁、房客、物件與設定功能；同一組頁面在手機仍保留目前的 LIFF／LINE 登入、底部導覽與固定 viewport shell。

## 現況與缺口

- `landlord-auth.js` 已有 Email challenge、verification、session 與 POST iframe bridge 的客戶端邊界。
- `V2_LANDLORD_EMAIL_AUTH.js` 已有 Email 綁定、OTP challenge、登入 session、撤銷與 Workspace／角色檢查。
- `程式碼.js` 已將 Email action 與五個房東讀取 action 接到 `doPost` bridge。
- 五個房東頁面與 `landlord-responsive.css` 已有桌面 selectors，並保留手機 shell。
- 尚缺少可被正式驗收的寄件設定、首次 Email 綁定操作、登入後 authenticated operation 的瀏覽器證據，以及 375／390／768／1024／1440 的實際 capture 與人工 UAT。

## 設計

### 1. 身分與登入流程

1. 已用 LINE 登入的房東進入設定頁，輸入自己的 Email。
2. `landlord_email_verify_request` 以 POST 送出，後端只在目前 LINE 房東與 Email 相符或尚未綁定時建立 challenge。
3. 後端使用 Script Properties 提供的 `CMWEBS_EMAIL_LOGIN_HASH_SECRET` 產生 challenge hash，並透過 Apps Script 寄送六位數 OTP；challenge 只保存 hash、10 分鐘到期、最多 5 次嘗試，且重送受 15 分鐘速率限制。
4. 房東輸入 OTP 後，`landlord_email_verify_code` 將 `email_verified_at` 與 `email_login_enabled` 寫入目前使用者，完成首次綁定。
5. 桌面入口輸入已驗證 Email 後，`landlord_email_login_request` 寄送 OTP；`landlord_email_login_verify` 成功後只將 opaque session token 放在 `sessionStorage`，不放入 URL、GET、JSONP 或頁面 HTML。
6. 每個受保護頁面在第一次 bootstrap 前呼叫 `landlord_email_session_status`；session 過期、撤銷、Workspace 或角色不一致時清除 token 並回到入口頁。

### 2. 桌面頁面與既有操作

- `landlord-entry.html` 顯示 LINE fallback 與 Email OTP 登入入口，兩者共用 `landlord-auth.js` 的 auth envelope。
- `landlord-home.html`、`landlord-tenants.html`、`landlord-properties.html`、`landlord-settings.html` 只更換身份傳輸，不複製房東商業 API 或建立桌面專用資料模型。
- 桌面寬度由 `@media (min-width: 1024px)` 啟用側邊導覽、topbar、表格與面板；小於 1024px 保留 mobile card、bottom nav、`visualViewport` app-height 與 safe-area reserve。
- 所有頁面操作仍由伺服器驗證 Workspace、角色與 session；前端不得因桌面模式放寬權限。

### 3. 寄件設定與錯誤處理

- 寄件密鑰與寄件帳號只能存於 Apps Script Properties；不得進 Git、HTML、URL、Sheet 或瀏覽器 storage。
- 未設定寄件必要 Property 時，後端 fail closed，回傳一般化的寄送失敗訊息，不暴露帳號是否存在、Email 是否註冊或 Script Property 名稱。
- 登入請求對不存在、未驗證或未啟用 Email 的帳號使用同一種一般化失敗回應，避免帳號枚舉。
- OTP 不重複使用；challenge、session、Workspace mismatch、錯誤次數、逾時與撤銷都必須有 runtime regression coverage。
- bridge 只接受同一個 iframe、request id、來源 origin 與 `CMWEBS_APPS_SCRIPT` source；逾時清理 DOM 與 listener。

## 驗證策略

### 自動測試

- 先新增會失敗的 runtime 測試：寄件設定缺失時 fail closed、OTP 寄送與 challenge 保存順序、首次綁定後可登入、Email session 可授權既有房東 bootstrap、失效 session 被清除。
- 新增會失敗的 UI／transport 測試：入口的 Email OTP 狀態機、錯誤提示不洩漏帳號、token 不進 URL／GET、各五個頁面在 auth ready 後才 bootstrap。
- 執行 `node --test tests/*.test.mjs`、Apps Script syntax check、`node scripts/validate-project.js --root . --apps-dir apps-script --html-dir . --expected-routes 71`；若正式分支仍沒有 `package.json`，記錄 `npm run validate` 無法代表隔離 worktree，不能從根目錄髒工作區借用結果。

### 人工／正式驗收

- 由房東在目前正式 LINE 登入後完成首次 Email 綁定，確認收信、OTP 驗證與 `email_login_enabled` 狀態。
- 使用同一個 Email 在桌面入口登入，確認首頁、房客、物件、設定四頁能完成讀取與登出；確認錯誤 session 回入口。
- 在 Chrome／Safari 實際 capture 375、390、768、1024、1440 寬度，確認桌面／手機切換、底部導覽、表格、focus ring、safe-area 與無水平溢出。
- 真機 LIFF 驗證手機登入與原有功能未受影響。
- OTP、Email 與 session 的真實資料由人工操作確認，不把帳號、密碼、OTP、cookie 或 token 回傳給 Codex，也不寫入 release evidence。

## 不在本次範圍

- 不建立新的房東商業流程、客製化欄位或客戶專用分支。
- 不改變 LINE OA 歸屬與既有手機登入規則。
- 不執行 Production Sheet migration，不建立測試房客，不修改帳務、合約、房間或通知資料。
- 不以本地測試取代正式 Email 寄送、已登入 LINE 房東綁定或真機 UAT；這些證據完成前，release 狀態標記為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 交付與回滾

- 程式以 feature branch 合併到正式 `main`；Apps Script 每次建立新的 immutable version，沿用既有 Web App URL。
- GitHub Pages 與 Apps Script 的版本、workflow、schema scope 與 rollback target 分開記錄。
- 若正式驗收發現問題，Apps Script 指回上一個已驗證 immutable version；Pages 回到上一個已驗證 commit；不以回滾覆蓋 Production Sheet 資料。
