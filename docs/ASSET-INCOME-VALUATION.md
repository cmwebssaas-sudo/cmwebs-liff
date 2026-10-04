# 資產收益估值 — 正式發布

## 2026-10-04 投入成本／互動圖表擴充（本機候選，未發布）

使用者批准此設計實作。隔離 branch `codex/asset-return-chart-interactions-20261004`；只改既有報表前端，不新增 route、Schema、正式資料寫入或 Apps Script 版本。

- 購入總價、裝修成本須明確填金額（無成本填 0）；其他投入選填、空白按 0。總投入為三者相加。欄位只在本次頁面記憶體保存，刷新／報表重載清除，非房東資料持久化。
- 累計已確認實收為當前物件範圍所有年度實收合計；含管理費、電費等，不冒充純租金、利息或淨利。年度毛回報率＝選定基準實收／總投入；累計毛回報率＝歷年實收／總投入（非年化／IRR）。總投入 0 或尚未填完整時不產生回報率。
- 年度淨回報率須明確填該基準年度營運成本。平均基準須填相同年份的平均年度成本。不以單年成本推造歷年累計淨回報率。負數、非有限數、瀏覽器 badInput 與總額 overflow 拒絕。
- 柱狀圖生長、曲線描繪、資料點淡入；點年份顯示年度實收、情境估值、有紀錄月份及月明細。圓餅採真實環形扇區，點扇區／月份按鈕旋轉到該月並顯示金額與占比。零收入不畫扇區；100% 單月可畫完整環。
- 可用 Enter／Space 開年份明細，月份使用原生按鈕。手動暫停直接顯示完整靜態圖；暫停後切換利率／年度不可停在透明起點。系統 reduced-motion 優先於播放按鈕。動畫有限、不持續佔用迴圈；輸入成本不重建圖表。
- 本機合成 browser：總實收 694,000、投入 11,000,000、最高年度 208,000 → 年度毛 1.89%、累計毛 6.31%；年度成本 80,000 → 淨 1.16%。年份點擊、Enter、月份 20.83% 與旋轉、暫停重繪、reduced-motion 已核對。390px 預覽 page clientWidth／scrollWidth 同為 375。不是正式財務或真機驗收。
- 發布需後續明確授權，沿既有 Pages／cache tag 流程；無後端發布需求。Rollback 為 revert 此前端 slice，不還原收入資料。正式基線仍為本文件下方記錄的 v206。

2026-10-04：後端 immutable 206，原 Web App URL 不變、回退 205。PR #205／Pages 37192744518 success，runtime 46/46 公開讀回一致，515/515 回歸通過。六月 17 筆補入已讀回核對；登入後及真機驗收尚待完成，不以合成預覽替代。詳細證據見 CMWEBS_CURRENT_STATE.md。

建議模型／速度：gpt-5.6-terra / medium。產品分類：使用者單獨批准的 V2.1 固定報表擴充。
2026-10-04 使用者明確批准補入六月缺少的 17 筆收入並發布本功能；不批准其他資料／schema／Properties／trigger／LINE 變更。登入後與真機驗收仍須另外記錄證據。

## 已批准設計

- 最高年度營收、平均年度營收、指定年度三種基準；收益率預設 2%，可選 3%、4%、4.5%。
- 平均預設只納入 12 個月有紀錄年份；可自行勾選包含不完整年份。這是有資料月份，不是全部房間／帳單完整對帳證明。
- 毛收益情境 = 基準年度已確認實收 ÷ 所選率；輸入非負年度營運成本可得淨收益情境。平均模式需填平均年度成本。
- 成本只在本次頁面記憶體中保存，按基準／年度隔離；刷新、期間或物件重新載入後清除，不寫正式資料。
- 實收含租金、管理費、電費等總帳單金額，不稱純租金或正式鑑價。按帳單月份歸屬，不宣稱銀行入帳日期或現金流時點。不得自動年化／補零。
- 柱狀、年度收入曲線、年度毛估值曲線、所選年度月份圓餅圖，皆附明細；估值基準與圓餅年度分開標示。

## 實作與資料界線

`V2_REPORTING_DASHBOARD.js` 在原有 authorized snapshot、既有 property filter、payment confirmation、bill inclusion 下同一遍 bills scan 產生 `annual_income`；不增加 Sheet reads、route 或欄位。既有範圍 KPI 不变。
人工分配提示以 notes/note/remark 的人工／平均／分配/manual/allocat 關鍵字計數；只是來源註記偵測，沒有註記不代表不存在人工分配，原始備註不回傳。
保留 legacy status inclusion（包括既有 reversed + paid 行為），不在這項估值功能獨自改變帳務有效性規則。

前端沿用共用 landlord auth/API：Email token 不初始化 LINE；無 Email token 時可保留已登入 LINE session；失效權限由既有 shared transport 處理。
固定 shell／nav／safe-area 保留。SVG 以真實年份間距排列，不跨缺年連線，不把無估值點畫成零。新增資產只由該報表引用。

## 本機預覽與驗證

執行 `node scripts/preview-asset-valuation.mjs`；輸出的 loopback URL 是桌面預覽，`/mobile` 是同源 390px 框，`/empty` 為空資料。
數據全為合成，CSP 阻擋外部 API 與 form 提交，私有檔案 404／POST 405；不使用 test=1。
`node --test tests/asset-income-valuation.test.mjs` 驗證公式、空成本／零成本、無效成本、最高／平均範圍、缺年／無估值點、工作區／物件／付款／cutoff、本期 KPI、Email／LINE、預覽隔離。

## 發布與 rollback（已授權，完成證據另記）

批准後先核對當時 main、實際 serving Apps Script version、既有 Web App deployment／rollback。
整合此 feature branch，更新正式 static release tag；先發布 backend 新 immutable version 保持原 Web App URL，再沿既有 Pages 流程發布 HTML、shared assets。
必須讀回 `annual_income` 並登入後核對最高／平均／指定年度、四率切換、成本、物件範圍與手機。
後端舊版未提供年度資料時 UI 明確提示，不回退用近12月充當歷年收入。
rollback：後端 repoint 當時記錄的 serving 前版；Pages revert 此 slice。無業務資料還原需求。基底 commit `d094a99f0c5f6c7dec5648bc68a7157f1bdd9863` 是本機來源，不是重新核對的正式 rollback 證據。
