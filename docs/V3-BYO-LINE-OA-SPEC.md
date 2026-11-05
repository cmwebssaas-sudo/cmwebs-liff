# V3 房東自有 LINE 官方帳號規格

**狀態：** 設計決定已確認，尚未實作
**Issue：** [#296](https://github.com/cmwebssaas-sudo/cmwebs-liff/issues/296)
**日期：** 2026-11-02（Asia/Taipei）

本文件只定義設計，不授權修改正式程式、部署、Production Sheet、Properties、
LINE、LIFF、Webhook 或 Rich Menu。每個實作階段都要另外授權。

## 1. 目標

房東繼續使用自己的 LINE 官方帳號（OA）。CMWebs 接上該 OA，提供標準圖文
選單與租管頁面。房客留在房東的 OA，不用改加 CMWebs 的帳號。

成功標準：

- 房東不用更換 OA，好友與聊天關係不變。
- 房客點房東 OA 的選單，綁定一次後即可看帳單、回報付款與報修。
- 訊息以房東 OA 發送，費用算在房東的 LINE 方案。
- 新增房東由設定精靈完成，不需要工程人員介入，也不產生客製程式。

## 2. 範圍

### 包含

- 每個 Workspace 一筆 LINE 頻道設定（Channel Registry）
- 機密資料加密保存
- 統一 LINE 發送入口
- 多個 LINE Login 頻道的登入驗證
- 依頻道驗簽與分流的 Webhook
- 房東設定精靈
- 圖文選單自動發布，房東與房客選單分開
- 既有 Workspace 轉入 Registry

### 不包含

- 共用 CMWebs OA 代發
- 個人 LINE 自動化
- 依客戶客製功能、欄位、頁面或程式分支
- 門鎖、攝影機與自動抄表
- 線上金流與第三方電子簽章
- 把 Google Sheets 搬遷到新資料庫

## 3. LINE 平台限制

以下內容已於 2026-11-02 對照 LINE 官方文件：

| 限制 | 對設計的影響 |
| --- | --- |
| 使用者 ID 依 Provider 不同；同 Provider 下，不同頻道的 ID 相同 | OA 與登入頻道必須在同一個 Provider，否則無法用登入身分推播 |
| LIFF 只能加在 LINE Login 或 LINE MINI App 頻道，不能加在 Messaging API 頻道 | 每位房東都要有自己的 LINE Login 頻道與 LIFF |
| OA 指定 Provider 後不能變更或取消 | 精靈必須在房東開通前明確警告 |
| 取得好友 ID 清單僅限認證或進階帳號，且清單不含租約關係 | 既有房客要自己綁定一次，不做自動匹配 |
| 圖文選單可用 API 建立，並設定全體預設或個別使用者選單 | 可由 CMWebs 發布，並分開房東與房客選單 |
| Webhook 簽章以頻道 secret 計算，須用原始 body 驗證 | 每個請求要先辨識頻道，再用該頻道 secret 驗證 |
| 推播會計入訊息額度，回覆訊息不計入 | 額度用盡時要明確提示房東 |

待查證：

- LINE 的 module channel 是否能減少房東設定步驟，以及申請資格
- CMWebs 能否用 API 自動建立 LIFF
- 台灣目前的 OA 方案費用與免費額度
- 官方後台與 API 同時設定圖文選單時的優先順序

## 4. 架構

### 4.1 Channel Registry

機密資料不放 Google Sheets、Git、瀏覽器或 Apps Script Properties。

欄位依用途分為兩類：

| 類別 | 欄位 | 保存方式 |
| --- | --- | --- |
| 公開設定 | `workspace_id`、`line_login_channel_id`、`liff_id`、`status`、`verified_at` | 可同步到前端與 Worker |
| 機密資料 | `messaging_channel_secret`、`messaging_access_token`、`line_login_channel_secret` | 加密保存，只有 Worker 能解密 |

規則：

- 一個 Workspace 同時只有一筆 `active` 設定。
- 同一組頻道不得綁定第二個 Workspace。
- 寫入與更換都要驗證 Workspace、角色與權限，並留下稽核紀錄。
- 任何介面、API 回應與日誌都不回傳機密值，只回傳「已設定」與更新時間。
- 加密金鑰只放 Cloudflare secret。Registry 備份不含明文，也不含加密金鑰。

`status` 狀態：`draft`、`verifying`、`active`、`suspended`、`revoked`。

現有 LINE 機密由 Apps Script Properties 保存。實作階段 2 前要先更新工程規則，
納入 Worker 保存方式。

### 4.2 發送

- Apps Script 所有 LINE 推播改走同一個發送入口，參數帶 `workspace_id`。
- 發送入口呼叫 Worker，由 Worker 解密 token 後送 LINE。Apps Script 不持有
  房東 token。
- Worker 只接受已簽章的內部請求，並核對 Workspace 與收件人的綁定關係。
- 頻道不是 `active` 時拒絕發送，不退回其他頻道。
- 額度用盡或 token 失效時，事件仍留在通知中心，並提示房東。
- 既有重複發送防護與通知偏好規則不變。

### 4.3 登入

- 前端依網址中的 Workspace 代碼取得公開設定，再初始化對應 LIFF。
- 頁面不再寫死 LIFF ID，全部改讀集中設定。
- Apps Script 與 Worker 依 Workspace 取得 `line_login_channel_id`，並以它
  驗證 ID Token 的 `aud`。
- ID Token 頻道與請求的 Workspace 不一致時，一律拒絕。
- 同一人向兩位房東租屋時，視為兩個獨立身分，不合併資料。

### 4.4 Webhook

- 每個頻道使用獨立路徑，路徑代碼不含機密。
- Worker 依路徑找到頻道，用原始 body 驗簽，失敗即拒絕。
- 驗證後才轉交 Apps Script，並附上已驗證的 `workspace_id`。
- 同一事件以 `webhookEventId` 防止重複處理。
- 房東原有的自動回覆與聊天設定不由 CMWebs 改動，精靈只提示可能的影響。

### 4.5 圖文選單

- 全系統一套標準版型。品牌只能設定名稱、Logo、標準配色與聯絡資訊。
- 房客與未綁定使用者看到預設選單。
- 房東與團隊成員綁定後，改用個別使用者選單。
- 選單連結都指向該房東自己的 LIFF。
- 更新版型時由系統批次發布，不逐戶人工處理；單戶失敗可重試。
- 發布前保存房東原本的預設選單 ID，停用時可恢復。

## 5. 流程

### 5.1 房東開通

1. 登入 CMWebs，開啟設定精靈。
2. 精靈說明 Provider 不可變更。房東在 LINE 後台開通 Messaging API。
3. 在同一個 Provider 建立 LINE Login 頻道與 LIFF。
4. 把頻道資料貼到 CMWebs。
5. CMWebs 驗證 token、Provider 關係、Webhook 與 LIFF。
6. 房東檢視選單預覽，確認後才發布。
7. 房東用自己的 LINE 完成身分綁定。

步驟 3 能否自動化取決於第 3 節的待查證項目。

### 5.2 既有房客

1. 房東發公告，請房客點選單。
2. 房客用 LINE 登入。
3. 依現有手機綁定流程完成確認。
4. 綁定成功後即可收到該 OA 的通知。

未綁定的房客仍是 OA 好友，但不會收到個別帳單通知。房東後台要顯示綁定
進度。

### 5.3 停用與退訂

1. Registry 改為 `suspended`，停止發送。
2. 移除 CMWebs 的 Webhook 與圖文選單，恢復原選單。
3. 機密資料在保留期限後刪除。
4. 租管資料依退訂規則處理。OA 與好友關係仍屬房東。

## 6. 既有 Workspace

既有 Workspace 是 Registry 的第一筆資料。

- 轉入前後，使用者、LIFF、登入與通知行為都不變。
- 未設定 Registry 的 Workspace 沿用舊流程，直到全部轉入。
- 不改寫既有的 `line_user_id`，也不批次改動 Production Sheet。

## 7. 實作階段

每個階段都要獨立 PR、測試、回退方式與部署授權。

| 階段 | 內容 | 上線影響 |
| --- | --- | --- |
| 0 | 規格、路線圖、決策紀錄 | 無 |
| 1 | 備份復原演練與操作手冊 | 不改使用者行為 |
| 2 | Channel Registry，既有 Workspace 轉入（資料表、加密與內部路由已實作，尚未部署） | 不改使用者行為 |
| 3 | 統一 LINE 發送入口 | 影響正式通知 |
| 4 | 多頻道登入與集中 LIFF 設定 | 影響正式登入 |
| 5 | Worker Webhook | 影響正式訊息接收 |
| 6 | 設定精靈與圖文選單發布 | 只開放測試 OA |
| 7 | 測試 OA 全流程 | 不影響既有 Workspace |
| 8 | 負責人用自己原有的 OA，以獨立 Workspace 試跑一個完整帳務週期 | 受控試營運 |
| 9 | 第一位外部房東開通與試跑 | 另行授權 |

2026-11-03 負責人決定階段 1 的隔離演練不作為階段 2 到 5 的前置條件。階段 3 到 5 上線前仍要逐次取得部署同意，並確認最新備份與回退方式。

## 8. 驗收

### 自動測試

- 每個發送模組都只走統一入口
- 機密值不出現在回應、日誌或前端
- 跨 Workspace 的頻道、token 與 ID Token 都被拒絕
- Webhook 簽章錯誤、重放與未知頻道都被拒絕
- 頻道暫停或 token 失效時不誤發
- 未設定 Registry 時，既有流程不變

### 真實環境

使用兩個測試 OA 與兩個 Provider，驗證：

- 綁定、帳單通知、付款回報、報修、公告
- 房東與房客看到不同選單
- 兩位測試房東的資料與訊息完全隔離
- 開通、更換 token、暫停、停用、恢復原選單

測試 OA 與 Provider 由負責人建立；LINE 帳號、授權與條款同意由負責人操作。

## 9. 風險

| 風險 | 對策 |
| --- | --- |
| 房東選錯 Provider，事後無法修正 | 精靈先警告，並要求確認 |
| 開通步驟太多，影響轉換率 | 附圖教學，並查證 module channel 與 LIFF API |
| 改動正式通知或登入 | 分階段上線，保留既有流程與回退路徑 |
| 機密外洩 | 加密保存、最小權限、不回傳明文、可更換 |
| 額度用盡，房客收不到通知 | 通知中心保留事件，主動提示房東 |
| 新增房東增加人工維護 | 精靈與批次發布都要能自動重試，並有集中監控 |
| 資料量增加，Google Sheets 撐不住 | 試營運期間監控，資料庫搬遷另開 Issue |

## 10. 負責人決定

2026-11-02 已確認：

1. 備份與操作手冊初稿先完成。2026-11-03 負責人改為不等待隔離演練，直接開始階段 2。
2. 房東同時保留自己 OA 的 LINE 身分與 Email 登入。
3. 機密資料保存在 Cloudflare，因為 Webhook 與發送都由 Worker 處理。

4. 階段 8 由負責人擔任試跑房東，使用自己原有的 OA。

自己試跑能驗證流程、隔離與通知，但不能代表外部房東的開通難度。正式對外
收費前，仍要完成階段 9。

尚待確認：

- 該 OA 目前的 Provider、Messaging API 狀態與好友組成。開通或指定 Provider
  前必須先確認，因為 Provider 綁定後不能變更。
- 該 OA 若有真實好友，測試期間不得對全體發送測試訊息。
