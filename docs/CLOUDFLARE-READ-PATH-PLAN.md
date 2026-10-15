# C 計畫：房東讀取改由 Cloudflare Workers + D1 回答

> **2026-10-15 已批准加速修訂：** 房東要求大幅縮短上線等待時間；具體提案見
> [READ-ACCELERATED-ROLLOUT.md](READ-ACCELERATED-ROLLOUT.md)。原本文保留作歷史基線。
> 房東已明確批准 24 小時並行觀察、先房源頁，以及單次 wrapper 的 160 內試驗分配。
> 原三日／七日與兩次入口的相應條款以兩份修訂決策為準；所有技術前置與其餘門檻保留。

狀態：**計畫草案，待房東確認**（2026-10-11）
建議模型／速度：規劃、身分驗證、同步與計算對帳用 Opus 5.5（effort 高）；照規格搬移與前端切換用 Sonnet 5.5（medium）。
範圍：V2.1「效能整併」。只搬**讀取**；所有寫入（收款、合約、帳單、設定）維持 Google Apps Script。

## 1. 目標與量測基準

| 項目 | 2026-10-11 實測 | 目標 |
| --- | --- | --- |
| Apps Script 空請求（平台底線） | 1.8–3.5 秒 | 不再經過 |
| 首頁主資料 | 8.5–9.3 秒 | ≤ 0.8 秒 |
| 房間清單 | 5.8–8.5 秒 | ≤ 0.8 秒 |
| 首頁全部摘要 | 19.6–21.7 秒 | ≤ 1.5 秒 |

上線判定以同帳號、同流程、正式站前後比較為準；本機或合成資料不能當作提速證據。

## 2. 架構

```text
手機／電腦（GitHub Pages）
   │ 讀取：先問 Worker，失敗或逾時 3 秒 → 自動改問 Apps Script
   ▼
Cloudflare Worker（台北節點）── 驗證身分 → D1（SQLite，APAC）
   ▲
   │ 變更推送（HMAC 簽章，只送有改動的列）
Google Apps Script（唯一寫入來源） ── Google Sheets（唯一正式資料）
```

- **Google Sheets 仍是唯一正式資料來源**。D1 是唯讀副本，可隨時清空重建。
- 每個頁面有獨立開關（`off` → `shadow` → `on`），任何時候可以關回 Apps Script。

## 3. 搬移範圍

| 讀取功能 | 使用頁面 | 主要資料表 |
| --- | --- | --- |
| `landlord_home_bootstrap`（home／actions） | 首頁 | workspaces、members、properties、rooms、contracts、tenants、bills、contract requests、payment reports、messages |
| `landlord_revenue_dashboard_init` | 首頁、營收報表 | bills、properties、rooms、contracts |
| `landlord_tenants` | 房客 | tenants、contracts、rooms、users |
| `landlord_room_center_init` | 房源 | properties、rooms、contracts |
| `landlord_arrears` | 欠款 | bills、tenants、rooms、properties |
| `landlord_properties_init` | 物件 | properties、rooms |

**不同步**：銀行帳號、身分證件、合約檔案、Email 驗證碼、LINE token、任何 Script Property。D1 只放計算畫面所需欄位（遮罩規則與現行相同）。

## 4. 身分驗證（最重要的安全設計）

- **LINE 模式**：前端送 `liff.getIDToken()`；Worker 向 LINE 驗證端點驗證簽章、`aud`（LIFF channel）與到期，取得 `sub` 才查 membership。驗證結果快取 5 分鐘。身分只來自已驗證的 token，不接受前端自報的任何身分欄位。
- **Email 模式**：同步 `V2_landlord_email_sessions` 的 `session_token_hash`、`user_id`、`workspace_id`、`role`、`expires_at`、`revoked_at`、`status`。Worker 以同一把 HMAC 密鑰（Cloudflare 加密 Secret）計算雜湊比對。登出／撤銷時 Apps Script **立即**推送該列，不等排程。
  - 替代方案：由 Apps Script 簽發 30 分鐘讀取憑證，不共用密鑰；代價是每 30 分鐘多一次約 3 秒的請求。預設採共用密鑰方案，需房東確認。
- 每次讀取都重新檢查 Workspace 狀態、成員停權與角色權限，和現行 `workspaceLandlordProxy_` 相同。

## 5. 資料同步

- 寫入成功後，dispatcher 在 CacheService 標記「哪些表有變動」（不在寫入請求中同步推送，避免拖慢寫入）。
- 每分鐘觸發器先檢查標記；沒有變動就立即結束（約 0.1–0.3 秒），有變動才讀取該表並推送整表的列內容雜湊。Worker 比對雜湊，只 upsert／刪除真正改變的列。
- Email session 撤銷（登出、停權）例外：在撤銷流程內立即推送該列。
- Worker `/sync`：HMAC 簽章＋時間戳＋nonce 防重放，單批 ≤ 500 列。
- 每晚全量對帳一次，修正漏推。
- 資料延遲上限約 1–2 分鐘；剛寫入的頁面 2 分鐘內改問 Apps Script。
- Apps Script 每日觸發器執行時間有額度（一般帳號 90 分鐘／天，Workspace 帳號 6 小時／天，帳號類型待確認）；設計目標為同步全部耗用 < 15 分鐘／天。

## 6. 階段、時間與授權

| 階段 | 內容 | 時間 | 需要房東授權 |
| --- | --- | --- | --- |
| 0 | 本計畫；盤點欄位與遮罩；Cloudflare 帳號與 US$5 方案（房東本人操作） | 1–2 天 | 建立帳號、付款 |
| 1 | D1 schema、Worker `/sync`；Apps Script 推送模組（先在測試試算表） | 約 1 週 | 部署 Worker；Apps Script 新版本與觸發器；Script Properties 新增同步密鑰 |
| 2 | 6 個讀取 API，計算邏輯逐一移植，以相同合成資料對 Apps Script 輸出做逐欄位比對測試 | 1–1.5 週 | 部署 Worker |
| 3 | LINE ID token 驗證、Email session 驗證、Workspace／角色／停權檢查與越權測試 | 3–4 天 | 新增 Cloudflare Secret |
| 4 | 前端讀取路由（Worker 優先、3 秒逾時退回 Apps Script）與逐頁開關 | 2–3 天 | GitHub Pages 發布 |
| 5 | `shadow`：兩邊都讀、背景比對、只顯示 Apps Script 結果；連續 7 天零差異後逐頁切 `on` | 約 1 週 | 每頁切換 |

合計約 4–5 週。每階段都可獨立停止；在階段 5 切 `on` 之前，使用者看到的資料全部來自 Apps Script。

## 7. 回退

- 頁面層：開關改回 `off`（前端設定，重新發布即可，免搬資料）。
- 自動：Worker 失敗、逾時或回應格式不符時，前端當場改問 Apps Script。
- 同步層：停用觸發器即可；D1 可整個清空後由全量對帳重建。

## 8. 費用

Workers Paid US$5／月（含每月 1,000 萬次請求；D1 含 250 億列讀取、5,000 萬列寫入、5 GB）。以目前規模與成長到上百位房東，預估 US$5–10／月。免費版每次只有 10 ms 運算時間且額度用完會拒絕請求，不建議正式使用。

## 9. 風險

| 風險 | 對策 |
| --- | --- |
| 計算邏輯移植不一致，金額顯示錯誤 | 階段 2 逐欄位比對測試＋階段 5 七天 shadow 零差異才切換 |
| 越權讀取 | 不信任前端身分欄位；越權測試列為必過項目 |
| 同步漏推或延遲 | 寫入後即時推送＋每分鐘增量＋每晚全量對帳；寫入後 2 分鐘改問 Apps Script |
| 共用 Email HMAC 密鑰擴大暴露面 | 存 Cloudflare 加密 Secret、只給 Worker；可改用替代方案（第 4 節） |
| Cloudflare 故障 | 自動退回 Apps Script（變回現在的速度，不會無法使用） |

## 10. 前置安全工作

開始階段 1 之前，先完成一項房東讀取身分強化工作（工作單 S1）。細節以私下工作單交付，不寫入公開 repository；Worker 一律依第 4 節驗證身分。

## 11. 待房東決定

1. 確認本計畫範圍與 4–5 週時程。
2. Email 驗證採共用密鑰（快）或簽發讀取憑證（不共用密鑰、每 30 分鐘多一次請求）。
3. 工作單 S1 是否在 C 之前完成（建議是）。
4. 建立 Cloudflare 帳號與 US$5 方案（需本人操作付款）。
