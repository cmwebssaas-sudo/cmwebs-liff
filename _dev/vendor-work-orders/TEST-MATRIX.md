# 工單原型驗收矩陣

日期：2026-10-08。範圍：隔離分支中的 `_dev/vendor-work-orders/` 本機合成資料原型。測試不連正式 API、LINE、Google Sheets 或外部廠商。

## 自動化驗收

| 領域 | 覆蓋內容 | 證據 | 結果 |
| --- | --- | --- | --- |
| 身分、角色與 session | 合成登入、缺少／過期／撤銷 session、有效 Workspace 成員資格和權限重查 | `tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| Workspace 隔離與隱私 | 跨 Workspace 廠商清單、工單、報價、附件拒絕；廠商資料採 allowlist projection；房東私有欄位不洩漏 | `tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-attachments.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 多廠商／多工種／排序 | 公司與個人廠商、命名的其他工種、多家供應者、各工種優先順位唯一、手動改派、已建立合約價格快照不被後續編輯覆寫 | `tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 派工與報價 | 依優先順序邀請、拒絕／逾時遞補、固定價與手動選擇、平行詢價、報價版本及房東明確核准後指派 | `tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 競態與冪等 | 單一併發驗收勝出；相同冪等鍵不重複新增事件／通知；相同鍵不同內容拒絕；逾時報價與邀請在邊界時間正確遞補 | `tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-domain.test.mjs` | PASS |
| 完工、驗收、返工 | 廠商完工進入待房東驗收；房東接受才結案；返工需原因並回到施工中；超預算需先核准追加；不會自動結案 | `tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 附件安全與草稿 | 僅允許受限 MIME／大小及相符檔案簽章；拒絕路徑穿越、跨 Workspace 或未指派下載；附件不放在靜態目錄；上傳讀回期間保留仍可編輯的完工草稿 | `tests/vendor-work-orders-attachments.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 本機 HTTP 與介面 | 僅 loopback、靜態資源 allowlist、未授權請求拒絕、固定 app shell／viewport、使用者文字安全呈現 | `tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| Repository 回歸 | 正式來源驗證、靜態快取驗證、完整 repository 測試、差異空白檢查 | `npm run validate`、`npm test`、`git diff --check` | PASS |

## 人工／外部環境驗收

| 項目 | 結果 | 說明 |
| --- | --- | --- |
| 獨立 staging 身分、資料隔離與部署 | NOT RUN | 本次沒有 staging 環境或部署授權。 |
| 真實 LINE OA 登入、訊息及通知 | NOT RUN | 只使用合成 fixture session，未連接 LINE。 |
| iOS／Android LINE 內建瀏覽器實機操作 | NOT RUN | 本機自動化測試不代表實機鍵盤、相機或附件體驗。 |
| 真實公司／個人廠商報價、施工與驗收 | NOT RUN | 沒有建立外部聯絡、派單或真實作業。 |
| Production API、資料庫、Sheets／Apps Script 與發布 | NOT RUN | V2 Production 程式及資料未由本原型修改。 |

## 結果更新規則

2026-10-08 實際結果：`node --test tests/vendor-work-orders-*.test.mjs` 為 120/120 通過；`npm test` 為 767/767 通過；`npm run validate` 通過（59 個後端檔案解析、38 個 endpoint references 與部署紀錄一致；靜態快取檢查通過：67 safe version uses、41 API anti-cache keys、4 fallback tests、8 URL tests、0 remaining static cache bust）；`git diff --check` 通過。不可將本機測試推論為 staging、LINE、實機或 Production 驗收。
