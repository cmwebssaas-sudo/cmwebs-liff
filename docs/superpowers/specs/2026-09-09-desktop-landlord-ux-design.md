# CMWebs 房東桌面版登入與營運介面設計

**狀態：** 待使用者審閱後進入實作規劃

**日期：** 2026-09-09（Asia/Taipei）

## 1. 目標

修復房東在桌面瀏覽器無法正常登入、版面仍以手機窄卡呈現的問題，並建立真正適合
滑鼠、鍵盤與寬螢幕工作的桌面版房東介面。手機版仍維持既有 LIFF 流程與視覺，不
拆分 API、Workspace、RBAC 或帳務資料模型。

本次也要消除 Email 驗證碼按鈕的「按了沒有反應」體驗：寄送與確認期間立即顯示
忙碌狀態、阻擋重複請求、成功與錯誤都要有明確訊息，避免連續按壓造成多封驗證碼
與舊驗證碼過期。

## 2. 已確認的產品決策

- 1024px 以上使用桌面專用 shell；375px 至 767px 維持手機版，768px 至 1023px
  採現有單欄／平板布局。
- 桌面入口使用 Email OTP 為主，保留既有 LINE／LIFF 路徑作為次要入口；手機登入
  邏輯不改變。
- 桌面主介面採左側導覽、頂部 Workspace／帳號狀態列、寬版內容區，不把手機卡片
  單純放大。
- 沿用既有的 Apps Script bridge、Email session、Workspace 與權限驗證；本次不新增
  登入協定、不改資料表、不改帳務商業規則。
- 本次只處理 CMWebs 本身的桌面登入與桌面 UI；Unified Platform Core 整合暫停。

## 3. 根因與現況證據

### 3.1 桌面入口未接入桌面 shell

`landlord-entry.html` 目前只有手機窄卡樣式，未載入 `landlord-responsive.css`，
也沒有 `desktop-ready`／`desktop-main` 標記。因此桌面瀏覽器即使選擇 Email 登入，
仍會被限制在手機寬度，造成版面與登入操作不適合桌面。

既有的 `landlord-home.html`、`landlord-tenants.html`、`landlord-properties.html`
與 `landlord-settings.html` 已使用共用桌面 shell；本次會沿用該邊界，不另建第二套
桌面 SPA。`landlord-arrears.html` 與 `landlord-contract-requests.html` 的桌面呈現
只在現有結構需要時補上共用 shell，不改其資料流程。

### 3.2 OTP 操作沒有穩定的 in-flight 鎖

`requestEmailLoginCode()` 與 `verifyEmailLoginCode()` 在 bridge 尚未回應時沒有請求
鎖。它們會重新 render 表單，但不能可靠地阻擋使用者在非同步期間再次觸發同一操作，
因而可能重複寄送、覆寫 challenge，或在畫面上看不到按鈕已被接受。

修正應在前端建立明確的寄送與確認 in-flight state，並由按鈕 disabled、`aria-busy`
與狀態文案共同呈現；API 不需要改動。

## 4. 桌面版資訊架構與視覺方向

### 4.1 Shell

- 左側導覽固定約 256px，顯示 CMWebs 品牌、目前 Workspace、主要功能與登出。
- 主區使用冷灰工作背景，內容最大寬度約 1440px，區塊間距 24px。
- 頂部列提供頁面標題、Workspace 狀態、目前登入身分與必要的全域操作。
- 桌面隱藏手機 bottom nav；手機仍保留原 bottom nav 與 safe-area。
- Modal、toast、錯誤訊息的層級使用既有共用規則，不遮住主要操作或固定導覽。

### 4.2 入口頁

桌面入口改為雙欄登入工作區：左側是 CMWebs 房東工作區與安全登入說明，右側是
Email 登入表單。未登入時不顯示假造的 Workspace 資料；表單保留清楚的 Email、驗證碼、
寄送／確認操作與回到 LINE 登入入口。

使用既有品牌綠作為主要成功與確認色，藍色作為焦點／次要互動色，紅／琥珀色只表達
錯誤與需要處理的狀態。視覺遵循 UI/UX Pro Max 的 Exaggerated Minimalism：高對比、
留白、清楚層級，不使用 emoji 作為結構性圖示，也不引入額外外部字型依賴。

### 4.3 房東營運頁

桌面版沿用既有資料來源，統一呈現：

- 首頁：KPI 與近期營運狀態。
- 房客／物件：搜尋、狀態與寬版清單／表格。
- 欠款、合約與設定：保留既有操作與權限，改用桌面內容區、標題列與可讀的操作群組。

桌面化只改布局、階層與互動回饋，不在前端重算租金、帳單、催繳或付款狀態。

## 5. Email OTP 互動規格

### 5.1 寄送驗證碼

1. 按鈕按下後在同一個事件循環立即進入 busy 狀態，顯示 spinner／「寄送中…」與
   `aria-busy="true"`。
2. 任何寄送中的再次點擊、Enter 或程式重入都直接忽略，不增加 bridge 呼叫次數。
3. 成功後顯示明確的「驗證碼已寄出」訊息、切換到輸入驗證碼步驟並開始 60 秒倒數。
4. 失敗後恢復可操作狀態，錯誤訊息靠近表單且說明下一步；不留下半完成的 challenge。
5. 倒數期間不可重寄，按鈕文案顯示剩餘秒數；倒數結束後才可重寄。

### 5.2 確認驗證碼

1. 按下確認後立即鎖定確認按鈕，顯示「驗證中…」與忙碌語意。
2. 驗證期間禁止重複提交；錯誤後恢復可操作狀態並保留可修正的輸入。
3. 成功後只執行一次導向房東工作區；session 仍由既有 Apps Script auth bridge 建立。
4. 錯誤使用 `role="alert"` 或 `aria-live="polite"`，不只用顏色或 toast 表達。

### 5.3 無障礙與操作

- 每個輸入都有可見 label 或等價的 accessible name，鍵盤順序與視覺順序一致。
- 主要控制項至少 44px 高，焦點狀態清楚可見，所有可點擊元素有 cursor 與 pressed／
  disabled 視覺。
- 動畫限制在 150–300ms，並尊重 `prefers-reduced-motion`。
- 不將 Email、驗證碼或 session token 放入 URL、HTML 內容或 Git。

## 6. 實作邊界

### 6.1 預計修改

- `landlord-entry.html`：接入桌面 shell、桌面登入內容、OTP busy／錯誤／成功狀態。
- `landlord-responsive.css`：補足入口頁與尚未接入頁面的桌面樣式，並保持手機規則隔離。
- 受影響的房東桌面頁：只在缺少既有 shell 標記或桌面可用性不足時修改。
- `tests/`：增加入口桌面標記、OTP duplicate-click、狀態與手機回歸測試。
- `docs/04-API-ROUTES.md` 或其他文件：只有當實作真的變更 API／路由時才同步更新。

### 6.2 不修改

- Apps Script Email OTP、LINE／LIFF、session、Workspace／RBAC 協定與資料 schema。
- 房客、房東、合約、帳單、付款、通知的既有資料與商業計算。
- Unified Platform Core 的整合預留與任何訂閱／帳號整合。
- 手機版的資訊架構與底部導覽。
- Production deployment、GitHub push 與正式資料寫入；完成實作與驗證後另行取得發布授權。

## 7. 驗收條件

### 7.1 布局

- 在 1440px 與 1024px 寬度，入口不再是 560px 手機窄卡；桌面 shell、登入表單與
  狀態區可讀且無水平捲軸。
- 在 390px 寬度，仍使用現有手機 shell、LINE／LIFF 登入與 bottom nav，不受桌面樣式
  影響。
- 已接入桌面 shell 的首頁、房客、物件、欠款、合約、設定頁導覽一致，內容不被固定
  導覽遮住。

### 7.2 互動與測試

- 快速連點寄送按鈕只產生一次 bridge request，按鈕立即顯示 busy／disabled。
- 快速連點確認按鈕只產生一次 verify request，錯誤後可再次操作。
- 成功、倒數、失敗都有可讀狀態與 screen-reader live region。
- `npm run validate`、完整 Node 測試、受影響 Apps Script 測試與 `git diff --check`
  通過。
- 真實 Email 發送、正式 session、桌面瀏覽器登入與手機回歸仍標記為
  `HUMAN_REQUIRED`，不以靜態測試冒充 Production 驗收。

## 8. 風險與回滾

- 主要風險是入口重 render 與既有手機 CSS 的耦合；先以桌面 media query 與局部 state
  guard 修正，避免重寫登入架構。
- 若桌面樣式造成手機回歸，移除入口桌面標記／desktop-only 規則即可回到既有手機 shell。
- 若 OTP 前端 state 修正造成登入異常，回退入口頁變更即可；Apps Script 與既有 session
  資料不需回滾。
- 本次不執行 GitHub push、Pages publish 或 Apps Script deployment；部署需在驗證完成
  且使用者明確授權後，依既有 release runbook 執行。

## 9. 自我檢查

- 範圍限於 CMWebs 房東桌面登入、桌面版布局與 OTP 操作回饋。
- 沒有新增登入協定、資料欄位、帳務規則或 Unified Platform Core 整合。
- 所有根因、互動狀態、響應式邊界、測試與回滾條件均已定義，沒有待補的流程分支。
