# CMWebs 房東後台 B+ 桌面 UI 設計規格

**狀態：** 已獲使用者確認，進入第一階段實作

**日期：** 2026-09-13（Asia/Taipei）

## 1. 目標

將既有房東桌面版由「深色側欄＋手機卡片放大」提升為明亮、留白、易掃讀的營運後台。視覺參考 Airbnb 對住宿產品所採用的清楚分類、分段操作與簡潔內容層級，但不複製其品牌識別、商標、文案或行銷元件。

第一階段只處理共用桌面 shell 與 `landlord-home.html` 總覽頁；手機版、API、登入、帳務、訂閱、資料格式與路由保持不變。

## 2. 視覺方向

- 畫布：`#f7f7f5` 暖白灰，降低目前冷灰與高飽和綠造成的壓迫感。
- 導覽：淺色側欄、細分隔線、選中項目以淡綠色塊呈現；不再使用全深色側欄。
- 主色：CMWebs 墨綠／青綠作為品牌與主要操作色；紅、琥珀、藍、紫只表達語意狀態。
- 元件：白色內容卡、細邊框、低強度陰影、12–16px 圓角；按鈕採實心色塊或清楚的次要邊框樣式。
- 字體：中文使用系統優先的 Noto Sans TC／PingFang TC fallback；不新增外部字型依賴。
- 動效：150–220ms 的 hover／pressed／focus feedback；尊重 `prefers-reduced-motion`。

## 3. 桌面共用 shell

在 `min-width: 1024px` 下：

- 固定側欄寬度為 232px，背景為暖白，品牌區、主要導覽與 Workspace 身分區分層。
- 主內容維持可捲動 `.page`，最大寬度 1440px，內距 32px，區塊間距 24px。
- 頂部列顯示頁面 kicker、頁面標題、Workspace 狀態與 Workspace 名稱。
- 隱藏手機 `.bottom-nav`；1024px 以下仍保留原本的手機／平板 shell。
- 所有互動元件最小高度 44px，focus-visible 必須清楚，卡片不可遮住主要操作。

## 4. 總覽頁

- `landlord-home.html` 增加 desktop-only overview scope class，讓總覽視覺調整不污染其他頁面。
- 現有本月營運 KPI 維持四欄，使用白底分隔卡與清楚的數字階層。
- 現有圖表、待處理事項、快速功能與系統資訊維持原資料及事件，只調整排列、留白、邊框、按鈕與錯誤狀態。
- 桌面版待處理事項與圖表使用兩欄工作區；較窄桌面寬度仍可收斂為單欄，不產生水平捲軸。
- 圖表錯誤維持局部 retry，不替換整個首頁資料；首頁 API 失敗維持既有 recovery path。

## 5. 不在本階段

- 不改 API URL、LIFF ID、Email／LINE 登入、Workspace／RBAC、帳務或訂閱。
- 不新增圖表資料、營運功能、後端欄位或資料表。
- 不改手機版資訊架構、底部導覽與欄位流程。
- 不執行正式網站部署；本階段完成後只交付分支與驗證結果，部署另依明確授權執行。

## 6. 驗收

- 1024px、1280px、1440px：顯示 B+ 淺色 desktop shell，無水平捲軸。
- 390px：維持既有手機 shell、bottom nav 與 `.page` safe-area reserve。
- desktop sidebar、topbar、active nav、KPI、dashboard panels、primary button 均有可驗證 CSS 規則。
- `prefers-reduced-motion`、focus-visible、44px 操作高度與 error recovery 規則保留。
- 所有既有桌面／手機 shell 測試與新 B+ UI 測試通過。
