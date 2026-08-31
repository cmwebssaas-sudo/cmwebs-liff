# CMWebs V2.1 房東首頁圖表與載入韌性設計規格

**狀態：** 視覺方向已由使用者核准，待書面規格確認後進入實作計畫

**版本邊界：** V2.1 Internal Operations Completion

**核准視覺：** `docs/superpowers/specs/assets/2026-08-31-landlord-home-dashboard-selected.png`

## 1. 目標

房東開啟首頁後，應在同一個手機畫面快速掌握本月應收、已收、未收、收款率、近 12 個月收租趨勢、入住率，以及 30／60／90 天內到期合約數量。首頁必須改善目前「整頁等待單一 API、逾時後只能人工重新整理」的體驗，同時不擴張至 V3、客製報表或新的 Production schema。

## 2. 已核准的視覺規則

- 主版沿用核准效果圖的第 2 種資訊層級：KPI 列置頂、12 個月趨勢圖為主視覺、營運摘要置底。
- 趨勢圖顏色固定為：
  - 應收：藍色 `#2F6FED`
  - 已收：CMWebs 綠色 `#06C755`
  - 欠款／未收：珊瑚紅 `#FF6259`
- 合約到期使用三柱圖，固定顯示「30 天、60 天、90 天」及每柱數值。
- 入住率使用環形圖，中央保留百分比文字；所有圖表不得只以顏色傳達意義。
- 保留現有固定 shell、底部導覽、safe-area 與 44px 以上觸控目標。
- 頁面使用白色與淡灰背景、低陰影、適量圓角及清楚分隔；不使用紫色、3D 圖表或多層卡片套卡片。
- 核准效果圖中的「本月」下拉外觀不作為必要功能；首頁固定顯示近 12 個月，完整篩選與 CSV 維持在既有營收儀表板頁，避免首頁增加非必要互動與載入成本。

## 3. 資訊架構

### 3.1 首屏

1. 問候語與最後更新時間。
2. 本月營運總覽：應收、已收、未收、收款率。
3. KPI 必須來自 `landlord_home_bootstrap` 的既有房東首頁資料，讓主資料成功後即可顯示，不等待圖表資料。

### 3.2 主要圖表

- 標題為「近 12 個月收租趨勢」。
- 使用既有 `landlord_revenue_dashboard_init` 回傳的 `months` 聚合資料。
- 三條資料序列為 `receivable`、`collected`、`outstanding`。
- 預設三條線均顯示；點擊「應收／已收／欠款」只切換強調序列，不重新呼叫 API，也不隱藏數值表格。
- 點選或觸碰資料點時顯示月份與三項金額；鍵盤操作須能取得同等資訊。
- 圖表下方保留可讀數值摘要，作為無障礙與圖表失效時的 fallback。

### 3.3 營運摘要

- 入住率使用 `occupancy.occupancy_rate`。
- 合約到期三柱圖使用 `contract_expiry`，依既有 30／60／90 天 bucket 顯示數量。
- 「查看收入明細」連往既有 `landlord-revenue-dashboard.html`，不建立新的報表頁。

### 3.4 既有首頁功能

- 待處理事項與快捷入口保留在圖表區之後，不能因改版消失。
- 房間數、房客數、角色、帳號狀態等詳細資訊可下移，不與首屏財務 KPI 爭奪視覺焦點。

## 4. 載入與 API 韌性

採用「漸進式兩階段載入」，而不是擴大首頁 bootstrap 或新增第三條報表 API。

1. HTML 立即顯示與核准版面相同輪廓的 skeleton；底部導覽可立即操作。
2. LIFF 身分完成後，呼叫既有唯讀 `landlord_home_bootstrap`。
3. 首頁 bootstrap 成功後立即渲染 KPI、待處理事項與快捷入口。
4. 首次渲染完成後再非阻塞呼叫既有唯讀 `landlord_revenue_dashboard_init`，固定參數 `range=12m`。
5. 報表成功後只更新圖表區，不重建整個首頁。
6. 任一唯讀請求只有在錯誤訊息精確為 `API 載入逾時` 時自動重試一次；最多兩次嘗試，間隔 350ms。寫入 API 不使用此重試策略。
7. `script.onerror` 必須立即結束該次請求並顯示可理解錯誤，不再忽略並等待 30 秒。
8. bootstrap 第二次仍失敗時顯示首頁錯誤卡與手動重試；報表第二次仍失敗時只在圖表區顯示「圖表暫時無法載入」與重試按鈕，已載入 KPI 與操作入口必須保留。
9. 每次 `loadPage()` 使用遞增 request token；過期回應不得覆蓋較新的重新整理結果。
10. 本階段不使用 `localStorage`、`sessionStorage` 或跨請求 Apps Script cache 保存房東財務快照，避免跨帳號／跨工作區短暫顯示舊資料。效能改善以漸進渲染、既有聚合 API 重用及唯讀重試為界。

## 5. 架構選擇與取捨

### 採用：漸進式兩階段載入

- 優點：首屏 KPI 不等待完整 12 個月聚合；報表失敗不拖垮整頁；重用已存在且已有測試的 API 與聚合器；不需 schema migration。
- 代價：首頁完成載入會有兩次唯讀 API 呼叫，但第二次發生在首屏完成後，不阻塞核心操作。

### 不採用：擴大 `landlord_home_bootstrap`

- 會把五張報表資料表的讀取加入首頁關鍵路徑，使使用者目前反映的慢開啟與逾時風險更高。

### 暫不採用：建立首頁專用精簡報表 route

- 長期可降低第二次呼叫的 payload，但會新增 Apps Script route、文件與部署面；目前既有報表 route 已能提供所需資料，先以最小變更完成 V2.1 固定圖形報表。

## 6. 資料與安全邊界

- 所有資料仍由既有 Workspace-scoped `landlord_home_bootstrap` 與 `landlord_revenue_dashboard_init` 提供。
- 前端不接收原始房客、LINE、銀行或付款明細列；只使用既有聚合結果。
- 不新增 route、不修改 schema、不新增 Production trigger、不發送 LINE、不寫入資料。
- `workspace_id` 與既有 RBAC 驗證維持後端唯一權威；前端不自行推導權限。
- TEST_MODE 與正式模式必須沿用現有入口規則，不新增硬編碼正式帳號或房東 UID。

## 7. 錯誤與空資料狀態

- 首頁載入：skeleton → 自動重試提示 → 成功內容或整頁錯誤卡。
- 圖表載入：圖表 skeleton → 成功圖表、空資料說明，或局部錯誤卡。
- 空資料仍顯示 KPI 數字 `0`、入住率 `0%`、三個到期 bucket `0`，並顯示「目前沒有可顯示的營運資料」。
- 數值非法、缺欄或陣列缺失時採安全預設值，不得顯示 `NaN`、`undefined` 或破版 SVG。
- 手動重新整理時保留目前內容並顯示 refresh loading，不先清空頁面。

## 8. 測試與驗收

### 自動化

- 先新增失敗測試，再修改正式程式。
- 新測試覆蓋：
  - 首頁含四個 KPI、三色 12 月趨勢圖、入住率環形圖與 30／60／90 天到期柱狀圖。
  - 應收 `#2F6FED`、已收 `#06C755`、欠款 `#FF6259`。
  - 首頁初始只呼叫一次 bootstrap，報表在核心渲染後才呼叫。
  - 唯讀 timeout 最多重試一次，非 timeout 不重試，`script.onerror` 立即 reject。
  - 報表錯誤只替換圖表區；核心首頁保留。
  - 固定 shell、safe-area、底部導覽與完整報表連結保留。
- 必跑：`npm run validate`、Phase 150–153 營收儀表板測試、現有房東首頁受影響測試，以及新增 Phase 測試。

### 視覺驗收

- 以核准視覺資產為 source truth，在 390 × 844 手機 viewport 擷取實作畫面。
- 比較字體、間距、顏色、圖表比例、KPI 層級、底部導覽與文案。
- 驗證至少：正常、載入中、圖表空資料、圖表逾時後成功、圖表最終失敗、首頁最終失敗。
- `design-qa.md` 必須記錄 source、實作截圖、viewport、比較結果及 `final result: passed|blocked`。

## 9. 發布與 rollback 邊界

- 本規格只授權本地分支實作、測試與預覽；不包含 push、PR、merge、GitHub Pages 發布或 Apps Script 部署。
- 預期前端只修改正式檔名 `landlord-home.html`，測試與文件使用正式命名；不建立 `*-fixed` 或 `*-final` 檔。
- 若實作未通過驗證，rollback 為撤銷此 feature branch 的 bounded commit；Production 不受影響。

## 10. 完成定義

- 核准視覺與互動已在 `landlord-home.html` 實作。
- 首頁核心與報表採漸進載入；唯讀逾時可自動重試一次；局部錯誤不破壞已載入內容。
- 自動化測試、`npm run validate` 與視覺 QA 均有新鮮 PASS 證據。
- diff、風險、部署與 rollback 已文件化。
- 未進行任何未授權 Production 變更。
