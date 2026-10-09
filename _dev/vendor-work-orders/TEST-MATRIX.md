# 工單原型驗收矩陣

日期：2026-10-08。範圍：隔離分支中的 `_dev/vendor-work-orders/` 本機合成資料原型。測試不連正式 API、LINE、Google Sheets 或外部廠商。

## 自動化驗收

| 領域 | 覆蓋內容 | 證據 | 結果 |
| --- | --- | --- | --- |
| 身分、角色與 session | 合成登入、缺少／過期／撤銷 session、有效 Workspace 成員資格和權限重查 | `tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| Workspace 隔離與隱私 | 跨 Workspace 廠商清單、工單、報價、附件拒絕；廠商資料採 allowlist projection；房東私有欄位不洩漏 | `tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-attachments.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 多廠商／多工種／排序 | 公司與個人廠商、可命名的其他工種精確配對、每工種順位唯一、手動改派、固定價約定快照、不同其他工種不共用順位或約定 | `tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 廠商職責與執行人指派 | 公司管理者報價／拒接／固定價接單並指定啟用管理者或施工者；只有受派成員能施工、上傳、回報；公司窗口唯讀；個人廠商本人執行 | `tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-attachments.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 派工與報價 | 依優先順序邀請、拒絕／逾時遞補、固定價與手動選擇、平行詢價、報價版本及房東明確核准後指派 | `tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 競態與冪等 | 單一併發驗收勝出；相同冪等鍵不重複新增事件／通知；相同鍵不同內容拒絕；逾時報價與邀請在邊界時間正確遞補 | `tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-domain.test.mjs` | PASS |
| 完工、驗收、返工 | 廠商完工進入待房東驗收；房東接受才結案；返工需原因並回到施工中；超預算需先核准追加；不會自動結案 | `tests/vendor-work-orders-domain.test.mjs`、`tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 附件安全與草稿 | 僅允許受限 MIME／大小及相符檔案簽章；拒絕路徑穿越、跨 Workspace 或未指派下載；附件不放在靜態目錄；上傳讀回期間保留仍可編輯的完工草稿 | `tests/vendor-work-orders-attachments.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| 本機 HTTP 與介面 | 僅 loopback、靜態資源 allowlist、未授權請求拒絕、固定 app shell／viewport、使用者文字安全呈現 | `tests/vendor-work-orders-api.test.mjs`、`tests/vendor-work-orders-ui.test.mjs` | PASS |
| LINE webhook／受限通知 | 原始 body HMAC 簽章、事件 ID 去重、舊事件不覆寫、新好友不授權、unfollow 停送、membership／白名單／發送開關、超時 unknown 與穩定 retry key | `tests/vendor-work-orders-line-notifications.test.mjs` | PASS |
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

2026-10-08 欄位簡化更新：建立工單預設三個基本欄位；其他工種、多家詢價與進階設定按需展開。新增瀏覽器操作測試確認基本資料即可保存、條件式欄位顯示正確，以及合作設定收合後仍可保存。介面測試 28/28 通過；更新後 `npm test` 774/774 通過，`npm run validate` 與 `git diff --check` 通過。先前專項 126/126 為上一輪紀錄。

2026-10-08 中文介面更新：示範名稱、成員職責、登入身分、金額單位、版本及錯誤提示改為中文，保留內部識別代號。合作設定測試檢查可見文字沒有原本英文示範名稱及角色；更新後全套 `npm test` 774/774 通過，`npm run validate` 通過。只更新本機原型。

2026-10-10 本次專項重跑結果：`node --test tests/vendor-work-orders*.test.mjs` 為 144/144 通過；新增 webhook route 只接受 loopback、原始 body 簽章與注入的測試 secret。session cookie 改以 `Max-Age` 配合伺服器端固定時鐘驗證，避免本機瀏覽器時鐘偏差丟失有效測試 session。隨後完整 `npm test` 為 791/791、`npm run validate` 與 `git diff --check` 通過；不可將本機測試推論為 staging、LINE、實機或 Production 驗收。
# LINE 綁定操作介面（2026-10-08）

- API：房東邀請保存、跨工作區隔離、廠商拒絕、列表隱藏 token／identity、真實登入能力標記未接通。
- 手機介面：合作設定建立邀請、重新載入仍可讀回、撤銷邀請；不提供假的真實登入連結。
- 完整 repository 測試：778/778 通過；validate 通過。
- 未驗收：LINE Login callback、真實手機綁定、LINE 通知收件。尚未發布。
