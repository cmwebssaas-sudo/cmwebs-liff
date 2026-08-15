# CMWebs 營收圖形化儀表板設計

## 目標

在房東端提供 Workspace-scoped 的營收儀表板，讓房東不用直接讀取
Google Sheets，即可查看指定期間的應收、實收、未收與收款率，並能以
月份與物件維度核對數字。

## 範圍

- 第一版支援本月、近 3 個月、近 12 個月與自訂月份區間。
- KPI：期間應收、期間實收、期間未收、收款率。
- 圖形化資料：月份應收／實收／未收上升／下降折線、繳款狀態分布、遲繳比例、遲繳天數、入住率與合約到期分布，並保留物件收入／收款率資料。
- 圖表下方提供相同聚合結果的數值表格。
- 前端提供 CSV 匯出，內容只使用已授權 Workspace 的聚合結果。
- 無資料時顯示空狀態，不以全為零的圖表誤導使用者。

## 不在本次範圍

- 不新增 AI 分析、客製報表設計器、資料庫或新的 Google Sheet。
- 不改變帳單、付款核准、銷帳或合約的商業規則。
- 不讀取或回傳跨 Workspace 的明細資料。
- 不在本次變更中部署 Apps Script 或修改 Production Sheet。

## 後端設計

新增 `apps-script/V2_REPORTING_DASHBOARD.js`，公開函式為
`getLandlordRevenueDashboardByLineUid_`，由既有 Workspace landlord access
resolver 驗證身份與 onboarding，再以 `runtimeSpreadsheet_()` 讀取
`V2_properties`、`V2_rooms`、`V2_contracts`、`V2_bills` 與可選的
`V2_payments`。

所有資料先以 Workspace、landlord 與 property scope 過濾，再進入純聚合
函式。應收以有效帳單的 `total_amount` 計算；實收優先使用已確認付款，若
沒有付款列才使用 canonical bill 的 paid 狀態作相容 fallback；未收為
`max(receivable - collected, 0)`。月份以 `bill_month` 為首選，收款率在
應收為零時回傳 `null`。

新增 JSONP route `landlord_revenue_dashboard_init`，只回傳聚合後的 KPI、
月份序列、物件序列、繳款狀態、遲繳比例／年齡、房間入住率、合約到期區間、
更新時間與 scope metadata，不回傳帳單、房客姓名、LINE UID 或銀行資料。

## 前端設計

新增 `landlord-revenue-dashboard.html`，沿用既有 LIFF 初始化、固定 shell、
bottom navigation 與 JSONP transport。頁面提供期間選擇、更新按鈕、KPI 卡、SVG
折線／柱狀／圓環圖、月份表格、物件表格與 CSV 下載。SVG 只呈現 API 回傳的
聚合數字，不在瀏覽器掃描明細。

`landlord-more.html` 新增「營收儀表板」入口；既有頁面與帳務流程不改變。

## 錯誤與驗證

- 未登入或無 Workspace 權限：沿用既有 access error envelope。
- 找不到必要資料表：回傳明確的 `REPORTING_SCHEMA_NOT_READY`，不以空資料
  假裝成功。
- 不合法月份或物件篩選：回傳 `INVALID_REPORTING_RANGE` 或忽略不在 scope
  的 property，不能擴大讀取範圍。
- 測試涵蓋有效帳單聚合、付款去重／fallback、未收與收款率、跨 Workspace
  過濾、空資料、UI 入口、圖表 fallback 與 CSV markers。
