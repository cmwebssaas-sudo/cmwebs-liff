# 資產收益估值 — 本機候選

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
