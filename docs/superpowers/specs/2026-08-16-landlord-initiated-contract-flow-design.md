# V2.1 房東發起新租／續約線上簽署設計

**Status:** Approved — local implementation candidate
**Date:** 2026-08-16 (Asia/Taipei)
**Scope:** 房東端發起合約、房客以 LINE/QR 簽署、房東核准後才建立有效租約

## Goal

將房東合約流程改成「房東發起 → 房客簽署 → 房東核准 → 才生效」：

1. 新空房可以在沒有既有房客資料的情況下，由房東現場建立完整合約，
   顯示一次性 QR/連結給房客，以 LINE 開啟、補資料、上傳身分文件並簽名。
2. 既有房客續約由房東主動發起；房客只需查看新舊條款差異並簽名，
   不重做身分資料與新房客綁定。
3. 房客完成簽名不等於租約生效。只有房東核准後，才建立或更新有效房客
   綁定、房間占用狀態、目前合約指標及後續帳務可見性。
4. 歷史合約保持不可覆寫，續約產生新的合約版本並與前一份建立關聯。

## Scope

- V2.1 內部營運完成範圍：標準數位合約閉環與房東發起流程。
- 沿用現有 `V2_contracts` 作為合約 canonical row、
  `V2_contract_artifacts` 作為簽署附件／簽名資料、現有 landlord review
  權限與固定 mobile shell。
- 新增邀請狀態資料，以支援尚未有房客資料的現場簽約。
- 既有房東頁面入口改為「發起新租約／發起續約」，不再把正常操作直接
  做成已生效的房客與租約。

## Explicit non-goals

- 不改成 V3 多租戶 SaaS、BYO LINE OA、訂閱或第三方電子簽章服務。
- 不在房客簽名後自動生效、不自動核准、不自動發送催繳或建立付款紀錄。
- 不覆寫既有 active 合約、不刪除歷史合約、不把續約改成房客主動申請。
- 不在本設計階段部署 Apps Script、修改 Production Spreadsheet、LINE
  Properties、LIFF 設定或發送真實 LINE 訊息。

## Business flows

### A. 新空房出租：房東發起

1. 房東在自己的 Workspace 選擇可出租房間，輸入租期、租金、管理費、
   押金、付款日、費率、完整合約必要條款及可選的房客預填資料。
   房客姓名、電話、Email 可以留白；房東不需要先建立正式房客帳號。
2. 後端以房東 session、Workspace、`contract_write` 權限和房間 scope
   驗證請求，在同一個 ScriptLock 內重新讀取房間與有效合約，防止重複
   發起或跨 Workspace 寫入。
3. 後端建立一筆 `contract_status = pending_tenant_signature`、
   `signing_mode = new_tenant` 的待簽合約及一筆待認領邀請。此時：
   - 不建立 active 房客綁定；
   - 不把房間標成 occupied；
   - 不把此合約列入有效帳務與房客首頁；
   - 只在房東待處理列表顯示「待房客開啟／待簽署」。
4. 房東畫面顯示 QR 與可複製連結。QR 只包含不可單獨完成認領的邀請識別
   碼，不放 LINE ID、個資、ID token、簽名資料或 Drive ID。畫面另顯示
   一次性短確認碼，房東在現場提供給房客。
5. 房客用 LINE 開啟邀請頁，完成 LINE 身分驗證，輸入房東提供的確認碼。
   後端檢查邀請尚未過期、尚未被認領、屬於該合約與 Workspace，並原子化
   綁定邀請與 LINE identity。邀請認領只能成功一次。
6. 房客補上姓名、電話等必要資料，查看固定版本的完整合約，依新租規則
   上傳身分證正反面及簽名。提交時後端再次檢查邀請、合約、Workspace、
   `signing_mode` 及必要附件；只寫入待審核狀態，不啟用租約。
7. 房東在既有簽署審核頁核准或駁回：
   - 核准：同一個鎖內驗證完整附件、房客資料與邀請認領狀態，將暫存房客
     綁定轉為 active、合約轉為 active、房間轉為 occupied，更新目前合約
     指標與租客／房東 view。
   - 駁回：保留合約與審核紀錄，維持可重新提交的簽署狀態，不占用房間，
     房客可依房東要求修正後重新提交。
8. 房東可取消或重新發起。取消／過期只關閉邀請與待簽合約，不留下 active
   租約；重新發起建立新邀請，不重用舊確認碼。

### B. 既有房客續約：房東發起

1. 房東從目前 active 合約按「發起續約」，系統複製該合約的 Workspace、
   房屋、房間、已驗證房客 identity 與必要關聯，讓房東修改新租期及條款。
2. 後端建立新 `V2_contracts` row：
   - `contract_status = pending_tenant_signature`；
   - `signing_mode = renewal`；
   - `previous_contract_id` 指向原 active 合約；
   - 合約內容以新版本 snapshot 保存，不依賴日後動態欄位重算。
3. 房客從既有 LINE 綁定的租客頁開啟續約合約，查看完整新合約及新舊條款
   差異，只需提交簽名；不顯示新租的身分證上傳要求，也不建立第二個房客
   identity。
4. 房東在同一個審核頁核准後，後端在同一個鎖內：
   - 新合約轉為 active；
   - 原合約標記為 `renewed`，寫入 `renewed_to_contract_id` 與審核時間；
   - 房間的 `current_contract_id` 指向新合約；
   - 房客的既有 active binding 保持不變。
5. 駁回、取消、過期不改動原 active 合約。任何同一結果重送均須 idempotent，
   相反的最終決定必須被拒絕。

## State model

合約與簽署提交分開保存，不能以房客簽名直接推導生效：

```text
draft
  -> pending_tenant_signature
  -> tenant_submitted
  -> active                 (landlord approve only)

pending_tenant_signature -> cancelled | expired
tenant_submitted         -> rejected -> pending_tenant_signature
```

- `new_tenant` 必須有 `identity_front`、`identity_back`、`signature`。
- `renewal` 只需要 `signature`。
- `tenant_signing_submission_status` 記錄 `pending/submitted/approved/rejected`；
  `contract_status` 記錄租約生命週期，兩者不可混用。
- 房間 `occupied`、房客首頁、房東正式房客列表及有效帳務只接受
  `contract_status = active` 且通過核准的資料。
- 續約原合約的 `renewed` 狀態只代表歷史版本，不得再被當成目前 active
  合約。

## Data model

### `V2_contracts` extensions

保留既有欄位與相容欄位，補齊並正式化以下欄位：

- `signing_mode`: `new_tenant` 或 `renewal`，由後端產生，瀏覽器不可指定
  另一模式。
- `contract_origin`: `landlord_initiated`。
- `previous_contract_id`、`renewed_to_contract_id`。
- `contract_content`、`contract_version`：完整合約 snapshot 與版本。
- `invite_id`：關聯 `V2_contract_invites` 的非敏感識別碼。
- `tenant_signing_submission_status` 及既有簽署／審核 audit 欄位。

新租建立時可以先有暫存 `tenant_id`／`tenant_user_id`，但其狀態必須是
`pending_claim`，不可被既有 active tenant resolver 當成正式房客。認領後
補入 LINE identity 與房客資料；只有房東核准才轉 active。若現有 schema
無法表達此狀態，實作必須先 fail closed，而不是把暫存列偽裝成 active。

### `V2_contract_invites` new sheet

新增單一邀請資料表，欄位至少為：

`invite_id`, `workspace_id`, `contract_id`, `room_id`, `landlord_user_id`,
`landlord_membership_id`, `claim_code_hash`, `status`, `expires_at`,
`claimed_at`, `claimed_line_user_id`, `cancelled_at`, `created_at`,
`updated_at`。

只保存確認碼雜湊與必要 audit；不保存原始確認碼、LINE ID token、身分文件
內容或簽名圖片。邀請資料與合約必須做 Workspace、房間、合約三方一致性
檢查。Production migration 需獨立列入核准的 schema/deployment 步驟。

### Contract document snapshot

合約頁必須能顯示完整合約，不只顯示租金摘要。後端在房東發起及房客完成
必要資料後，產生含出租人、承租人、房屋／房間、租期、租金、費用、押金、
付款日、設備／費率、通知及簽署紀錄的標準合約 snapshot。房客與房東審核
看到的必須是同一份 snapshot；提交簽名後不得因房間或設定變更而改變文件。

## API surface

新增 route 並同步更新 `docs/04-API-ROUTES.md` 與測試：

- `landlord_contract_initiate_new`: 房東從可出租房間建立新租待簽合約。
- `landlord_contract_initiate_renewal`: 房東從 active 合約建立續約版本。
- `tenant_contract_invite_auth_init`: 以 LINE ID token、`invite_id` 與一次性
  確認碼建立邀請簽署 session；回應只經短期 exchange 取回。
- `tenant_contract_invite_auth_status`: 輪詢一次性 exchange 結果。
- `tenant_contract_invite_submit`: 新租房客補資料並提交必要附件／簽名；
  可共用既有 artifact 寫入與簽署提交核心，但必須由後端 session 決定
  `tenant_id`、`workspace_id`、`contract_id`、`signing_mode`。

既有 `landlord_contract_signing_reviews_init` 與
`landlord_contract_signing_review_update` 延伸為共同審核入口；核准流程
必須依 `signing_mode` 呼叫不同的 finalization：新租建立 active binding，
續約切換合約指標並封存前一版本。既有 `landlord_tenant_create` 正常 UI
路徑改成上述新租發起的相容 adapter，不再直接建立 active 租約。

## UI behavior

### Landlord

- 房客／合約頁提供「發起新租約」與每筆 active 合約的「發起續約」。
- 新租成功後顯示 QR、複製連結、一次性確認碼、邀請狀態及失效／取消操作。
- 待處理卡片清楚區分「待房客開啟、待房客簽署、待房東核准、已生效、已
  駁回、已取消、已過期」。
- 核准前不得在正式房客列表、房間 occupied 或帳務 dashboard 當成有效資料。

### Tenant

- QR/LINE 邀請頁顯示「新租簽署」或「續約簽署」模式。
- 新租：補個資、完整合約、身分證正反面、簽名。
- 續約：完整新合約、舊約／新約差異、簽名；不要求重新上傳身分證。
- 手機底部導覽與 safe-area 保持既有固定 shell；錯誤需顯示明確狀態，
  不以空白或全零資料假裝成功。

## Security and consistency

- 所有房東讀寫都以 server session、Workspace membership、角色及權限為準；
  body 中的 `line_user_id`、`tenant_id`、`workspace_id`、`landlord_id` 不得
  作為授權來源。
- QR URL 不放 secret；邀請必須再經 LINE identity 與一次性確認碼認領。
  任何 token、ID token、簽名、身分文件與 Drive ID 不進 URL、localStorage
  或 console。
- 建立、認領、提交、核准、取消、續約切換都要有 idempotency 檢查，並在
  ScriptLock 內 re-read canonical rows 後再寫入。
- 新租核准前，若房間已被其他 active 或未過期待簽合約占用，核准必須拒絕；
  不允許最後一個寫入者覆蓋前一筆。
- 所有新增資料以 Workspace scope 過濾；跨 Workspace、跨房間、跨合約的
  邀請、附件、租客 identity 一律 fail closed。
- 確認碼／邀請有明確過期與取消狀態；過期後不能提交或核准，只能重新發起。

## Verification plan

### Backend tests

- 新空房可在房客資料全空時建立待簽合約；不可提前產生 active binding、
  occupied room、正式房客 view 或有效帳務。
- 新租 QR 邀請需正確驗證 Workspace、房間、合約、LINE identity、確認碼、
  一次性認領與過期／取消；重複認領必須拒絕。
- 新租缺任一身分附件或簽名時，提交與核准均不能把合約改成 active。
- 續約只接受既有房客，必須保留 `previous_contract_id`；不能建立第二個
  tenant binding，且不接受新租身分附件條件被錯套。
- 核准新租後才建立 active tenant/user mapping 與 room current pointers；
  核准續約後才切換 current contract，原合約保持歷史可讀。
- 同結果重送 idempotent、相反決定拒絕、鎖內重讀可攔截競態與跨 Workspace。
- 完整合約 snapshot 在房客與房東畫面一致，且後續設定改動不影響已簽文件。

### Frontend/static tests

- 房東新租／續約入口與狀態卡存在，QR／確認碼只作顯示用途，不把 token 寫
  入 browser storage。
- 新租顯示個資與身分附件欄位，續約隱藏身分附件並顯示條款差異。
- mobile viewport、底部導覽、modal 層級、safe-area 及錯誤／空狀態均通過。
- 既有房客讀取、既有簽署審核、房東與房客 Workspace isolation 回歸通過。

## Rollback and release boundary

- 先在隔離 branch 完成測試與 schema compatibility；再依既有 release gate
  由使用者明確授權部署。
- 若新 route 或 schema migration 失敗，回退前端入口與 Apps Script 版本，
  不刪除既有合約／附件，不把待簽資料轉成 active。
- Production 完成前只能宣稱 local／staging evidence；不得把設計文件、
  commit 或瀏覽器成功頁面當成正式環境已部署。
