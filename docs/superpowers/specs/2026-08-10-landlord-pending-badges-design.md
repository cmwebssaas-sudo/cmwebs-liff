# 房東待處理提示與付款回報入口修正設計

## 目標

修正所有房東付款回報入口誤開房客 LIFF 頁面造成的 LINE 400，並在房東「更多功能」列表以紅色數字徽章顯示付款回報、合約申請與通知中心的待處理數量。

## 範圍

- 付款回報審核的房東入口一律導向 `landlord-payment-report-review.html`。
- 房東更多功能頁顯示三個獨立徽章：
  - 付款回報審核：`pending` 或 `payment_reported` 的付款回報數。
  - 合約申請管理：既有 API 回傳的 `summary.pending_count`；缺少摘要時只以 `pending` request 狀態計算。
  - 通知中心：目前登入房東自己的未讀通知數。
- 徽章只在數量大於 0 時顯示；1–99 顯示整數，100 以上顯示 `99+`。
- 每一項摘要讀取失敗時，該項不顯示徽章；不得把錯誤顯示為 0。

## 非範圍

- 不修改付款回報、合約申請或通知資料。
- 不改變任何核准、駁回、已讀或付款動作。
- 不建立新 Apps Script route、資料表、Property、trigger 或 LINE 訊息。
- 不改動房客付款回報頁的 tenant LIFF 身份。

## 資料與權限設計

`landlord-more.html` 在既有房東 LIFF 身份完成後，使用 `Promise.allSettled` 平行呼叫現有 API：

1. `landlord_payment_reports_init`，讀取 `data.summary.pending`。
2. `landlord_contract_requests_init`，讀取 `data.summary.pending_count`，或從同一回應的 requests 以 status `pending` 回退計數。
3. `landlord_notifications_init`，僅計算目前房東／membership 可見通知中的未讀項目。

每個 API 都已走既有房東 Runtime、RBAC 與 Workspace isolation。前端不傳 workspace、tenant、contract 或 LINE UID 作為計數條件，也不把不同 API 的資料互相混用。

## 入口修正

下列房東頁面的「付款回報」導覽目標統一改為 `landlord-payment-report-review.html`：

- `landlord-more.html`
- `landlord-arrears.html`
- `landlord-paid-bills.html`

`landlord-payment-report-review.html` 是已存在的房東 LIFF 審核頁，未登入時會透過 `landlord-entry.html` 進入登入流程；不直接指定 sibling page 作為 LIFF login redirect。

## 錯誤處理

- 如果付款回報、合約或通知其中一項摘要失敗，其他兩項仍正常顯示。
- 失敗項目的徽章保持隱藏，console 僅記錄可診斷錯誤；不顯示紅色 0。
- 付款回報審核頁本身維持既有可重試錯誤 UI，不讓入口摘要錯誤阻止整個更多功能頁。

## 驗收

- 房東從三個入口開啟付款回報審核時，目標皆為房東審核頁，而不是房客 LIFF 頁。
- 待處理付款回報、合約申請與未讀通知各自顯示紅色數字。
- 100 筆以上顯示 `99+`；0 筆及讀取失敗不顯示數字。
- 未授權、不同 workspace 或不同房東資料不得被前端計入。
- 現有付款回報、合約審核、通知已讀與房客付款回報流程維持不變。

## 驗證方式

- 新增 focused runtime/static regression，覆蓋三個入口、三種計數、`99+`、0、單一 API 失敗，以及房客 LIFF 不被修改。
- 執行受影響的既有付款回報／合約／通知測試、HTML inline script syntax check、`npm run validate`（若 repository 根有可用 package manifest）及 `git diff --check`。
- Production 部署後再由房東手機手動驗證 LIFF 登入與紅色徽章；自動測試不宣稱驗證 LINE Console 註冊或真實手機登入。
