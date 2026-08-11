# 房客前端測試身份遷移設計

## 狀態

- 設計已由使用者確認。
- 本文件只定義設計與驗收；本階段不修改房客頁面、不修改 Apps Script、
  不寫入試算表、不部署。

## 背景與問題

GitHub `main` 的房客正式頁面已使用 LIFF 取得真實登入身份，但付款回報、
合約、續約、退租四頁仍保留 page-local `TEST_LINE_USER_ID`。這些常數只在
`test=1` 分支使用，正式房客不會走到該分支；不過它們仍將測試身份放在公開
HTML，與 Production Consolidation 的來源安全規則不一致。

後端對明確的 `test=1` 房客路由已由 Script Property
`TEST_TENANT_LINE_UID` 解析測試身份。因此前端不應再提供 UID，仍應保留
`test=1` 旗標，讓後端成為測試身份的唯一來源。

## 目標

1. 移除下列四頁的完整 page-local LINE UID：
   - `tenant-payment-report.html`
   - `tenant-contract.html`
   - `tenant-renewal.html`
   - `tenant-termination.html`
2. 保留正式房客的 LIFF 登入、profile 取得、Workspace／tenant 權限流程。
3. 保留 `test=1` 的測試路徑與既有頁面導覽；測試請求仍傳送 `test=1`，由後端
   Script Property 解析身份。
4. 保留付款回報頁已部署的 `tenant-bind.html` LIFF gateway 與 `bill_id` 導向。

## 非目標

- 不修改 Apps Script route、`V2_API.js`、`V2_TENANT_PAYMENT_REPORTS.js` 或
  Script Properties。
- 不修改 Google Sheets schema、帳單、付款回報、合約或租客資料。
- 不修改房東頁面或其他未列入本工作單元的房客頁面。
- 不新增 LIFF channel、API URL、測試 UID、runtime secret 或新的測試身份。
- 不在本工作單元內部署；部署需在實作與驗證完成後另行確認。

## 方案與取捨

### 採用：前端不持有 UID，測試模式送空身份加 `test=1`

移除常數與測試分支中的 UID 指派；四頁的 JSONP helper 在測試模式明確附加
`test=1`，並以空的瀏覽器身份完成請求。後端在 dispatcher 層以
`TEST_TENANT_LINE_UID` 取代該身份，再執行既有 tenant route。

優點是公開 HTML 不含身份、正式 LIFF 流程不變、後端仍是測試身份唯一來源，
且不需要新增設定。風險是測試模式必須驗證所有四頁的 JSONP contract 都能接受
空的 browser `line_user_id`，並且沒有前端程式依賴測試 UID 顯示或導航。

### 不採用：改用前端 runtime config 提供測試 UID

這仍會把身份送到公開頁面，無法滿足來源安全邊界，也會新增環境設定耦合。

### 不採用：測試模式一律強制 LIFF 登入

這會移除既有 `test=1` 直接測試入口，增加 LINE WebView 依賴，超出本次
身份遷移必要範圍。

## 資料流

```text
正式模式
房客頁面 → LIFF profile.userId → JSONP line_user_id → 正式 tenant route

測試模式
房客頁面?test=1 → JSONP line_user_id="" + test=1
  → Apps Script dispatcher
  → Script Property TEST_TENANT_LINE_UID
  → 既有 tenant route
```

付款回報頁的登入入口仍為：

```text
tenant-payment-report.html
  → tenant-bind.html?next=tenant-payment-report.html&bill_id=...
  → 登入／綁定完成
  → 回到原付款回報頁
```

## 實作邊界

每一頁只做相同的三項機械變更：

1. 移除 `TEST_LINE_USER_ID` 常數。
2. 將 `TEST_MODE` 分支改為不注入 UID，讓既有的空字串
   `LINE_USER_ID` 保持不變。
3. 在該頁的 JSONP helper 組裝 URL 時加入：

   ```js
   if (TEST_MODE) {
     url += '&test=1';
   }
   ```

   只在測試模式附加，不改正式請求的 query contract。

不重構頁面、不改 API payload 名稱、不改正式登入分支。若任一頁的 JSONP
結構與其他頁不同，先新增該差異的測試，再停止並回報，不在本工作單元內擴大
修改。

## 驗收與測試

### 靜態驗收

- 四頁不再匹配完整 LINE UID regex。
- 四頁仍保留 `TEST_MODE`，且四個 JSONP helper 都只在測試模式傳送 `test=1`。
- 四頁正式模式仍呼叫 LIFF 初始化與 profile／userId 取得。
- 付款回報頁仍含 `TENANT_LIFF_ENTRY_PAGE`、`next` 與 `bill_id` 保留邏輯。

### 自動化驗收

- 新增一個 Phase 147 靜態回歸測試，逐頁檢查上述條件。
- 執行 `npm run validate`。
- 執行 `node --test tests/*.test.mjs`。
- 執行 `git diff --check`。

### Production 邊界

本工作單元不執行 Apps Script、Sheets 或付款寫入；不使用真實房客送出付款、
合約、續約或退租操作。GitHub Pages 部署前需再次檢查四頁公開來源與 workflow。

## 風險與回復

- 主要風險是 `test=1` 空身份與某一頁特殊 JSONP 呼叫不相容；Phase 147 必須
  在程式碼層確認所有四頁的 JSONP helper 都傳送同一個後端 resolver flag。
- 若實作後測試模式無法通過，停止部署並回到前一個 GitHub Pages commit；不以
  新增 UID 常數作為 workaround。
- 正式房客若遇到問題，回復整個 GitHub Pages commit，不修改 Production
  Apps Script Version 102 或任何資料。
