# V2.1 舊房客續約合約版本與省工流程設計

**Status:** Approved for isolated local implementation only
**Date:** 2026-08-27 (Asia/Taipei)
**Scope:** 舊房客到期續約、不可覆寫的合約版本歷史、續約證件選填、續約優惠條款

## Goal

讓同一房客可以每年續約並保留完整歷年合約，不再因續約而覆寫上一版資料，
同時把續約操作縮減為「沿用上一版條件、房東確認調整、房客查看與簽名」。

本設計延伸既有 V2.1 標準數位合約流程：續約仍是新合約版本，房客簽名不等於
租約立即生效，必須完成既有房東審核／核准邊界後才切換目前有效合約。

## Product classification and boundary

- 分類：V2.1 Internal Operations Completion 的標準數位合約與營運穩定範圍。
- 不是房東客製功能，不建立客戶專屬欄位、流程或程式分支。
- 本規格與本地候選不代表 Gate 0 完成，也不授權 Apps Script、GitHub Pages、
  Google Sheets、Properties、LINE 或 Production 部署。
- 不建立 V3 第三方電子簽章服務；沿用既有固定合約文件、簽名附件與房東審核。

## Agreed business rules

### Contract history

1. 每個租期都是一筆獨立合約版本，使用新的 `contract_id`。
2. 續約不得刪除、覆寫或重建上一筆合約的日期、金額、條款、簽名或文件。
3. 舊版本完成續約後只更新生命週期狀態與版本鏈關聯，例如 `renewed`、
   `renewed_to_contract_id`、審核時間；歷史內容保持只讀。
4. 新版本以 `renewed_from_contract_id`、`contract_family_id`、
   `renewal_sequence` 串接。第一筆既有合約可在讀取時視為該合約自己的 family、
   sequence 1，不需要為了補歷史而大量改寫既有 Sheet。
5. 舊版本被取消、駁回或新版本尚未簽署時，舊版本仍是目前有效合約；只有新版本
   完成簽署並通過房東核准後，才切換目前合約指標與帳務來源。

### Renewal defaults

1. 舊合約到期續約預設一年，續約起日為舊合約到期日隔天。
2. 新版本預設完整沿用上一版的月租、管理費、押金、其他固定費用與付款日，
   以及合約條款／備註中屬於租約條件的內容。
3. 房東可在送出續約邀請或核准前逐項調整；未調整的欄位維持上一版快照值。
4. 房東與房客看到的內容都來自該新版本的 immutable contract snapshot，不能在
   簽名後因房間設定或 Workspace 預設值變更而重新計算。
5. 續約流程優先沿用既有「房東從目前有效合約發起續約」入口；既有房客申請相容
   路徑若仍存在，亦必須使用同一套預填與新版本 finalization，不得回到修改舊列。

### Identity documents

1. 首次簽約維持身分證正面、身分證反面與自拍照必填。
2. 舊房客續約時，身分證正反面與自拍照全部改為選填；續約必要附件仍包含新
   合約本身所需的簽名／簽署紀錄。
3. 房客未重新上傳時，新版本沿用既有證件資料，不要求重新填寫、不刪除舊檔，
   並以不可變的引用／關聯讓新版本可回看當時使用的文件。
4. 房客重新上傳時，新增文件紀錄與新版本關聯；舊文件仍保留，不能原地替換。
5. 新版本不可沿用上一版的簽名圖片作為新合約簽名；新合約仍須產生自己的簽名／
   簽署 artifact，避免兩期合約共用同一份簽名證據。

### Renewal special offer

每次續約新版本預設帶入以下優惠，房東可在送出前修改或取消，並將最後內容
寫入該版本快照：

- 優惠啟用：是
- 不續約通知天數：30 個日曆日
- 適用事件：該合約版本到期時不再續約
- 優惠結果：符合通知期限時免收違約金
- 條款文字：由系統提供預設文字，房東可編輯

判斷規則：

1. 以伺服器收到不續約申請的日期與目前合約到期日計算，不接受瀏覽器自行傳入
   的 eligibility 結果作為授權依據。
2. 到期前至少 30 天提出：自動標記優惠適用／免收違約金，並保存判斷依據。
3. 未滿 30 天提出：標記未符合優惠、交由房東審核；系統不自動收取，也不自動
   免除違約金。
4. 續約期間中途提前解約不適用此優惠，仍走原有提前解約與違約金審核流程。
5. 優惠判斷結果、通知日、到期日、天數與條款版本都必須進入申請／合約 audit，
   讓日後查看歷史合約時不依賴目前設定重新推算。

## User flows

### A. 房東發起續約

1. 房東從房客詳細頁的目前有效合約按「沿用上一版發起續約」。
2. 後端在 ScriptLock 內重新確認 Workspace、房東權限、房客、房間與目前有效
   合約，拒絕跨 Workspace、非目前版本或已有未結束續約的操作。
3. 後端建立新合約版本，預填一年、完整上一版金額／付款／條款與 30 天優惠，
   狀態為待房客簽署；原合約不變。
4. 房東可修改新版本條件與優惠文字後送出；系統產生該版本的固定合約內容。
5. 房客開啟續約頁時看到新版本完整內容與新舊差異，只需確認並簽名；證件欄位
   顯示為選填，不因未上傳而阻擋續約。
6. 房東依既有簽署審核流程核准或駁回。駁回／取消／過期不影響舊合約。
7. 核准後同一個鎖內將新版本啟用、舊版本標記為 `renewed` 並寫入反向鏈接，
   更新房客／房間／帳務目前合約指標。

### B. 到期不續約

1. 房客或房東從目前合約提出到期不續約申請。
2. 後端讀取目前合約版本保存的優惠條款，不讀取下一版或目前 Workspace 預設。
3. 滿 30 天時自動顯示免收違約金；未滿 30 天顯示待房東審核。
4. 不續約只結束該版本，不刪除任何歷史合約、簽名或文件。

## Data model

### `V2_contracts`

沿用既有欄位與相容欄位，採 additive schema。正式欄位名稱需以目前 canonical
Schema reconciliation 結果為準，避免同義欄位重複；至少需要表達：

- `contract_family_id`
- `renewal_sequence`
- `renewed_from_contract_id`（候選 schema 已有，優先沿用）
- `renewed_to_contract_id`
- `renewal_request_id`
- `contract_origin`／`signing_mode`
- `special_offer_enabled`
- `special_offer_notice_days`
- `special_offer_clause`
- `identity_document_mode`：首次簽約為 `required`，續約為 `optional` 或
  `carried_forward`
- 完整續約條件快照：月租、管理費、押金、其他固定費用、付款日與固定條款

`contract_id` 是租期版本主鍵，不以同一個 ID 儲存多年的內容。已有舊列不做
破壞性 migration；新欄位缺值時以讀取 fallback 顯示 sequence 1／自身 family，
新建續約版本必須完整寫入鏈接與快照。

### `V2_contract_requests`

在保留目前 request 欄位的前提下，補足續約 snapshot 與優惠判斷欄位：

- source／current contract ID 與 `applied_contract_id`
- requested／approved deposit、付款日與其他固定費用
- requested／approved terms 或固定條款快照
- requested／approved special-offer enabled、notice days、clause
- `identity_document_mode`
- 不續約優惠判斷的通知日、剩餘天數、適用結果與判斷原因

申請保存的是送出／核准當時的值；房東之後修改 Workspace 或房間預設值，不得
回頭改變已存在的申請或合約版本。

### `V2_contract_documents` and signing artifacts

- 文件表維持 append-only。
- 新增文件來源與關聯欄位，例如 `document_origin`、`source_document_id`，
  以便新版本引用舊證件而不複製 Drive blob、不覆寫舊列。
- 新版本查詢文件時必須以新 `contract_id` 的關聯結果為準，並保留來源文件的
  `document_id`、hash、建立時間與 Workspace scope。
- 新版本的簽名、簽署版文件與審核 artifact 使用新 `contract_id`；不能把舊版
  已簽署結果誤當成新版已簽署。

## API and authorization

1. 既有房東續約發起、房客簽署提交、房東審核與完成 route 延伸支援版本鏈，
   必要時新增明確的 `landlord_contract_initiate_renewal`，並同步更新
   `docs/04-API-ROUTES.md`。
2. 所有寫入以伺服器解析的 session、Workspace、membership、角色與權限為準；
   request body 的 `workspace_id`、`landlord_id`、`tenant_id`、`contract_id`
   不能單獨授權。
3. 建立、送出、核准、完成、取消與文件引用都要在適當的 ScriptLock／idempotency
   邊界內重新讀取 canonical rows。
4. 只允許目前 Workspace、房東可管理房間、指定房客與版本鏈一致的資料；不一致
   時 fail closed。
5. 不續約 30 天判斷由後端完成；房東 UI 只能顯示結果與補充審核，不可偽造
   `waived` 結果。

## UI behavior

### Landlord

- `landlord-tenant-detail.html` 的「房客合約」區塊顯示目前版本、版本序號、
  合約期間、金額與「查看完整合約與簽名」。
- 顯示「沿用上一版發起續約」入口，以及歷年版本時間軸／清單。
- 續約審核表預填所有上一版條件；變更欄位要有清楚的新舊對照。
- 顯示 30 天優惠開關、通知天數與條款文字；送出前可修改或取消。
- 申請卡顯示來源版本、目標版本、目前簽署狀態與文件／簽名是否完整。

### Tenant

- 續約頁顯示「第 N 版續約」與完整新合約，不只顯示摘要。
- 顯示上一版／本版差異，金額未改時明確顯示「沿用上一版」。
- 身分證正反面與自拍照標示「選填」；未上傳不可顯示錯誤或阻擋送出。
- 顯示 30 天不續約優惠條款與適用基準。
- 合約歷史可逐版查看完整內容與簽名／簽署文件；歷史版本為唯讀。

## Migration and compatibility

1. Migration 只能新增欄位、保留舊欄位與舊列；不刪除、不清空、不整表重建。
2. 既有合約在沒有版本欄位時，以 `contract_id` 作為自身 family、sequence 1
   的讀取 fallback；不為了補值而直接批量改寫正式 Sheet。
3. 既有首次簽約流程的必填證件規則保持不變；只有後端確認 `signing_mode=renewal`
   且版本鏈指向既有有效房客時，才能套用續約選填規則。
4. 舊的目前合約查詢只能回傳唯一 active/current 版本；歷史查詢另走版本列表，
   不得以排序結果默默覆蓋目前指標。
5. 帳務只使用核准後的新 active version；待簽或被駁回版本不可建立重複帳單。

## Explicit non-goals

- 不刪除任何舊合約、文件、簽名或帳務紀錄。
- 不把多版本資料塞成單列 JSON 歷史。
- 不在本工作包建立第三方電子簽章或法律證據服務。
- 不改變中途提前解約的既有違約金規則。
- 不以瀏覽器、`test=1` 或舊聊天紀錄判定 Production 成功。
- 不在 Gate 0 前直接做 V2.1 Production runtime implementation 或部署。

## Acceptance criteria

### Backend

- 續約建立新 `contract_id`，上一版日期／金額／條款／簽名／文件內容完全保留。
- 可連續建立至少三個續約版本，版本鏈與 sequence 正確，歷史可逐筆查詢。
- 預設完整複製月租、管理費、押金、固定費用、付款日與條款；房東只調整指定
  欄位時，其餘欄位仍沿用上一版。
- 舊房客續約缺少新證件時可簽署／送審；首次簽約缺少證件仍被拒絕。
- 未重傳證件時使用舊文件引用；重傳時新增文件列，舊文件仍可下載／回看。
- 新合約需有自己的簽名／簽署 artifact；舊版簽名不可直接滿足新版。
- 30 天以上到期不續約自動免收；未滿 30 天進入房東審核；中途提前解約不受影響。
- 重送相同結果具 idempotency；相反核准／駁回結果被拒絕；競態不會產生兩個
  active 合約。
- 跨 Workspace、房客、房間或合約版本引用一律 fail closed。

### Frontend

- 房東房客詳細頁顯示目前版本、歷史版本與每版「查看完整合約與簽名」。
- 房東續約表單完整預填上一版條件，並可修改優惠條款。
- 房客續約頁明確顯示證件為選填、金額沿用與 30 天優惠。
- 續約新舊差異、簽署狀態、空狀態與 API 錯誤均有明確畫面，不以空白或全零
  資料假裝成功。
- 固定 mobile shell、modal 層級、safe-area、LINE／LIFF 入口與既有簽署回歸不退化。

### Documentation and release

- 更新 `docs/05-DATA-MODEL.md`、`docs/04-API-ROUTES.md`、`docs/09-TEST-MATRIX.md`
  與相關決策／current state 文件。
- 實作前先新增失敗測試，再以最小 source change 使其通過。
- 實作候選必須通過 `npm run validate`、受影響 Apps Script 測試、完整 Node 測試
  與 `git diff --check`。
- 正式 migration、Apps Script deployment、Pages publish、LINE／手機驗收均須
  另外保留明確授權與獨立證據。

## Rollback boundary

- 版本功能若需回退，回退前端／Apps Script 版本，不刪除已建立的歷史合約或文件。
- 待簽續約版本可標記取消／過期；原 active 合約維持有效。
- 若 migration 或新 route 失敗，保留新增欄位與未啟用資料，禁止以清空 Sheet
  作為回復方式。
