# Phase 41 — Test Tenant Runtime Data Repair Plan

## 1. Scope and Safety Boundary

本文件只定義測試房客 runtime 資料的唯讀診斷與修復預覽，不執行修復。

本輪明確未執行：

- Google Sheets 寫入；
- 房客新增或重新綁定；
- 帳單建立；
- LINE push；
- `clasp push`、`clasp deploy`；
- Git commit 或 push。

測試 LINE UID 只從 `TEST_TENANT_LINE_UID` Script Property 讀取，不記錄於本文件。

## 2. Evidence Boundary

目前提供的診斷摘要只有：

- `property_id = P000001`
- `contract_status = active`
- `room_id`、`room_no`、`account_status`、`binding_status` 為空
- bill 相關欄位為空

這些欄位不足以直接證明八張 Sheet 各自的實際狀態，因為 `diagnoseTestTenantRuntimeData()` 對每張 Sheet 的每一列都套用同一個 `summaryRow_()` 格式。某張 Sheet 不具備某欄位時，該欄位自然會是空白。

例如：

- `V2_properties` 列的 `tenant_id`、`contract_status`、`bill_id` 為空是正常的；
- `V2_tenants` 列沒有 `bill_id` 也是正常的；
- 只有 `sheets.V2_contracts.rows` 中的空白 `room_id` 才能證明 active contract 本身缺少 `room_id`；
- 只有 `counts.bill_count` 與 `sheets.V2_bills.rows` 才能判斷是否真的沒有帳單。

因此，本文件把已知問題列為 repair hypothesis。正式 row number、canonical IDs 與修改清單必須以完整診斷輸出及 `planTestTenantRuntimeDataRepair()` 的結果為準。

## 3. `diagnoseTestTenantRuntimeData()` Output Structure

### Top-level

| Field | Meaning | Review rule |
|---|---|---|
| `diagnostic` | 固定函式名稱 | 應為 `diagnoseTestTenantRuntimeData` |
| `read_only` | 唯讀聲明 | 必須為 `true` |
| `generated_at` | 執行時間 | 用於保存 evidence |
| `test_line_uid` | Script Property 的測試 UID | 不得複製到 Git 或文件 |
| `identifiers` | 固定點擴張後找到的 ID 集合 | 每個 canonical ID 原則上只能一個 |
| `contract_statuses` | matched `V2_contracts` 的狀態 | 應只有一個有效租約候選 |
| `counts` | bill/home-view/bill-view matched row 數 | 判斷 view 缺失與零帳單 |
| `consistency` | 全域 tenant/workspace 一致性 | 必須為 consistent |
| `missing_required_rows` | 缺 Sheet 或找不到關聯列 | 必須逐項人工確認原因 |
| `duplicate_or_conflict_rows` | 多 tenant/workspace 或 duplicate key | 非空時禁止修復 |
| `sheets` | 八張 Sheet 的詳細結果 | canonical review 的主要證據 |

### Per-Sheet object

每張 Sheet 包含：

- `sheet_exists`
- `total_row_count`
- `found`
- `matched_row_count`
- `workspace_ids`
- `workspace_id_consistent`
- `tenant_ids`
- `tenant_id_consistent`
- `duplicate_keys`
- `rows`

每個 `rows[]` 摘要包含：

- `sheet_row`
- `test_uid_match`
- tenant/user/contract/workspace/landlord/property/room IDs
- room label
- contract/account/binding 狀態
- bill ID/month/status/payment status

### Diagnostic limitations

1. 原函式先移除空白列再用陣列 index 計算 `sheet_row`。若資料區中間有完全空白列，輸出的 row number 可能比實際 Sheet row 小；不得直接以此 row number 寫入。
2. `directIdentityMatch_()` 對所有 Sheet 都檢查 generic `line_user_id`。但 `V2_landlord_tenant_list_view.line_user_id` 是房東 UID，不是房客 UID；該欄不能當成 tenant identity。
3. `user_id` 在 landlord tenant list 也是房東 user ID，不能吸收到 tenant user identity。
4. `V2_rooms` 只有在先找到 `room_id` 後才會被納入。當 contract/tenant 的 `room_id` 都空白時，原診斷不會反查 `current_contract_id` 或 `current_tenant_id`。
5. `V2_tenant_bill_view.bill_id` 為空的 placeholder row 不代表正式帳單。

新 planner 使用未壓縮的實際資料列位置，且分開處理 landlord 與 tenant UID 欄位。

## 4. Sheet-by-Sheet Gap Analysis

| Sheet | Canonical role | Current conclusion from supplied excerpt | Required confirmation |
|---|---|---|---|
| `V2_tenants` | tenant identity 與目前租約關聯 | 可能已有測試 UID，但 room/account/binding 是否真的空白尚未由逐 Sheet row 證明 | 唯一 `tenant_id`、`workspace_id`、`current_contract_id`、room fields、兩組 account/binding aliases |
| `V2_contracts` | 租約、物件、房間正式關聯 | active 已知；若本列確實缺 room，屬於資料缺口 | 唯一 active contract、tenant/workspace/property、room ID/name、日期 |
| `V2_rooms` | room source of truth | 原診斷在 room ID 空白時無法找到候選，不能判定 room 不存在 | 同 workspace/property 下，或由 `current_contract_id` / `current_tenant_id` 反查的唯一 room |
| `V2_properties` | property 與 Workspace 關聯 | P000001 已知 | P000001 必須唯一，且 workspace/landlord 與 tenant/contract 一致 |
| `V2_tenant_home_view` | Home read model | 可能缺列或關聯欄位／status 空白 | tenant UID、tenant/workspace/property/room/current contract、account/binding status |
| `V2_tenant_bill_view` | Tenant Bills read model | bill fields 空白不等於錯誤；零帳單時本來可以沒有 row | 有正式 bill 時才要求對應 bill-view row；不得建立空白假帳單列 |
| `V2_bills` | 正式帳單 source of truth | 摘要不足以確認零筆 | 以 `counts.bill_count`、tenant/contract/workspace IDs 確認；零筆為合法狀態 |
| `V2_landlord_tenant_list_view` | landlord/tenant/message 關聯 read model | 可能缺 tenant UID、room、status 或整列 | tenant ID、workspace、landlord ID/UID、property/room/current contract 必須一致 |

## 5. Why an Active Contract Can Lack `room_id`

目前 canonical `createLandlordTenantLeaseByLineUid_()`：

1. 強制要求 `propertyId` 與 `roomId`；
2. 驗證 room 屬於 property 與目前 Workspace；
3. 同時寫入 `V2_tenants.room_id/room_name/room_list`；
4. 寫入 `V2_contracts.room_id/room_name`；
5. 建立 Home 與 landlord tenant list view；
6. 將 `V2_rooms.current_contract_id/current_tenant_id` 同步。

因此，若完整輸出確認 active `V2_contracts` row 的 `room_id` 與 `room_name` 都空白，該 row 不可能由目前 canonical onboarding 完整建立。可能來源依序為：

1. 舊版／legacy 建檔；
2. migration 或人工匯入只建立 tenant/contract/property；
3. 過去 schema 尚未有 room 欄位；
4. view 有 room label，但 contract source 沒有回填；
5. 提供的空白欄位其實來自其他 Sheet 的 summary row，而不是 contract row。

要判定真正來源，必須查看 `sheets.V2_contracts.rows` 的 row、日期、note、tenant/property/workspace，以及 `V2_rooms.current_contract_id/current_tenant_id`。不得只因 P000001 只有一個房間就直接選取。

## 6. Why `binding_status` and `account_status` Can Stay Blank

目前 binding read path 有相容 fallback：

- `account_status || tenant_account_status || status || 'active'`
- 只要任一 candidate Sheet 已有測試 UID，`tenantBindingResolveByLineUid_()` 就可判斷為已綁定。

因此「頁面顯示已綁定」不等於 status 欄位已寫入。

另外：

1. `bindTenantByLineUid_()` 發現 UID 已存在時會直接回傳 `ALREADY_BOUND`，不再執行後續同步。
2. `tenantBindingUpdateTenantRow_()` 只更新 `tenant_binding_status` / `binding_status` 中第一個存在的欄位，不保證兩個 alias 都同步。
3. binding 同步不負責回填 tenant/home/list 的 account status。
4. canonical onboarding 會寫 `unbound` 與 `active`；legacy row 或 migration row 則可能保留空白。

最可能的資料鏈是：legacy row 已有測試 UID → Binding read fallback 判定 active/bound → bind 流程 short-circuit → status 與 views 未被 backfill。

此結論需由完整 row 證據確認；planner 只會在欄位為空且唯一 active contract 已確認時提出 `bound` / `active`，不覆蓋任何非空值。

## 7. Home / Contract / Bills / Message Data-Chain Difference

### Contract-capable path

```text
tenant LINE UID
  ↓ tenant identity candidates
V2_tenants / tenant views
  ↓ tenant_id
V2_contracts
  ↓ active contract
contract response
```

Contract 能顯示只證明 tenant → active contract 這段可解析，不代表 room、bill view 或 landlord link 完整。

### Home path

舊 runtime 主要依賴：

```text
LINE UID → V2_tenant_home_view → literal account_status=active
```

因此 Home view 缺列或 status 空白會失敗。Repository 中尚未部署的 Phase 41 resolver 已規劃改由 tenant → contract → property → room 安全補足，但線上舊 deployment 不會自動取得此修正。

### Bills path

```text
V2_rooms.room_id
  ↓ contractRoomMap requires V2_contracts.room_id
V2_contracts
  ↓ bill generation
V2_bills
  ↓ billingSyncBillViews_
V2_tenant_bill_view
  ↓ LINE UID / tenant ID
tenant_bills
```

active contract 缺 `room_id` 時，Billing 初始化會跳過該 contract，無法建立 billable room，也不會產生 bill/view。零帳單本身合法，應回傳成功空陣列；不得為了修復讀取流程建立假帳單。

### Message path

線上舊流程：

```text
tenant_message_init
  ↓ getTenantHomeByLineUid()
V2_tenant_home_view
  ↓ tenant_id
V2_landlord_tenant_list_view
  ↓ landlord contact
message init
```

Home 失敗時，Message 在查詢 landlord link 前就停止；即使 contract 可讀，Message 仍會失敗。

## 8. Read-Only Planner

新增 Apps Script 函式：

```text
planTestTenantRuntimeDataRepair()
```

### Output contract

成功時只輸出陣列，每個項目只有：

| Field | Meaning |
|---|---|
| `Sheet` | 預計修改的 Sheet |
| `row` | 實際 Sheet row number |
| `field` | 欄位名稱 |
| `old_value` | 現值 |
| `new_value` | 預計值 |

無 metadata、UID summary、執行按鈕或 write result。

### Resolution rules

Planner 必須先確認：

1. 測試 UID 在 `V2_tenants` 只對應一列；
2. `tenant_id` 全表唯一；
3. 只有一筆 active contract；
4. `contract_id` 與 P000001 唯一；
5. tenant、contract、property 的 Workspace 不衝突；
6. room 的解析方式只能是：
   - tenant/contract 既有唯一 `room_id`；或
   - tenant/contract 唯一 room label；或
   - `V2_rooms.current_contract_id/current_tenant_id` 唯一反向連結；
7. room 必須同 Workspace、同 property；
8. landlord tenant link 不可重複；
9. 任一既有非空值與 canonical 值衝突時停止。

若 room 只能靠「P000001 下剛好有一間房」推測，Planner 必須停止，不得提出修改。

### Planned fields

| Sheet | Only when blank | Notes |
|---|---|---|
| `V2_tenants` | canonical IDs、room relation、current contract、binding/account aliases | 不重新綁定，只同步已存在的 Script Property UID |
| `V2_contracts` | tenant/workspace/property/room/landlord relation | 不修改租金、日期或 contract status |
| `V2_rooms` | workspace/property reverse links、current contract/tenant、occupied/active | 僅列入 plan；不由既有 repair function 自動寫入 |
| `V2_tenant_home_view` | canonical relation、status、zero-bill summary | 可規劃缺失 physical view row |
| `V2_landlord_tenant_list_view` | tenant/landlord/property/room/current contract relation | `line_user_id` 必須維持房東 UID 語意 |
| `V2_tenant_bill_view` | 只同步具有真實 `bill_id` 的既有 row | 零帳單不建立 placeholder |
| `V2_bills` | none | 正式帳單只讀，不得修改或建立 |
| `V2_properties` | none | property source 只讀，用於驗證 Workspace |

## 9. Stop Conditions

任一情況發生時不得產生可執行修復：

- 多個 tenant IDs；
- 多個 active contracts；
- duplicate contract/property/room ID；
- 多個 reverse-linked rooms；
- room label 衝突；
- tenant、contract、property、room 或 view 的 Workspace 不一致；
- tenant UID 衝突；
- landlord ID/UID 衝突；
- 正式 bill 存在但 bill view 完全缺失；
- 預計覆蓋非空值；
- 預計修改 bill/payment status；
- 預計觸及其他租客。

## 10. Manual Review Sequence

1. 在 Apps Script 執行 `diagnoseTestTenantRuntimeData()`，保存完整 JSON，但不要貼入 Git。
2. 逐張確認 `sheets.<sheet>.rows`，不要使用外層扁平摘要代替。
3. 特別確認 `sheets.V2_contracts.rows` 的 active row 是否真的缺 room。
4. 在 Sheet 中只讀確認 P000001、active contract 與唯一 room 的 Workspace 一致。
5. 執行 `planTestTenantRuntimeDataRepair()`。
6. 確認輸出只包含 `Sheet`、`row`、`field`、`old_value`、`new_value`。
7. 確認沒有 `V2_bills`、payment/bill status、其他 tenant 或非空覆寫。
8. 將 planner 結果交由人工核准；本輪不執行 repair。

## 11. Expected Result for Zero Bills

若 `counts.bill_count = 0`：

- `V2_bills` 不需新增資料；
- `V2_tenant_bill_view` 不需新增資料；
- Tenant Bills API 應回傳成功與空陣列；
- 前端顯示「目前沒有帳單」。

若 `counts.bill_count > 0`，才需核對每個正式 `bill_id` 的 bill view relation。

## 12. Rollback and Deployment

本輪只有程式碼中的唯讀 planner 與本文件，沒有 Sheet 變更，因此不需要資料 rollback。

若 planner 本身需要撤回，只需回復：

- `planTestTenantRuntimeDataRepair()`；
- 本文件；
- bill-view planner 排除空 `bill_id` 的防護調整。

本輪未執行 commit、push、`clasp push` 或 deploy，Production runtime 與 Google Sheets 未改變。
