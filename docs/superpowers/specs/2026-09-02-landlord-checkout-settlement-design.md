# 房東退房結算與電表證據設計

狀態：待使用者審閱
日期：2026-09-02
建議模型：`gpt-5.6-terra / medium`

## 目標

在既有房東手動退房前增加可追溯的退房結算，讓房東能在一次流程中確認：

1. 上月尚未結清的電費與設備使用費。
2. 退房月份 1 日至實際退房日（含當日）的房租。
3. 同一期間依起始、結束電表度數計算的電費與設備使用費。
4. 押金扣除、房客應補繳與押金應退金額。
5. 9/1 與實際退房日的電表度數及現場照片證據。

506 於 2026-09-07 退房時，結算期間固定為 2026-09-01 至
2026-09-07，共 7 天。

## 已確認的商業規則

### 結算項目

- 上月帳單只帶入電費與設備使用費，不帶入上月房租；前提是上月房租已繳。
- 若上月沒有未結的電費／設備費，該兩項為 0，不建立虛構帳款。
- 本期房租為月租 × 居住天數 ÷ 該月日曆天數，金額四捨五入至整元。
- 居住天數為退房月份 1 日至退房日的含首尾天數；9/7 為 7 天。
- 本期電費與設備使用費依電表差額計算，不依天數比例推估：
  - 用電度數 = 退房日電表 − 9/1 電表。
  - 電費 = 用電度數 × 合約電費單價。
  - 設備使用費 = 用電度數 × 該月份適用的設備費單價。
- 本次退房結算不自動加入管理費、上月房租或其他固定費用。
- 所有費用金額在後端重新計算，前端只提供輸入與預覽，不可信任前端傳入的總額。

### 押金

- `deposit_amount` 從退房所依據的原合約快照帶入。
- 房東輸入 `deposit_deduction_amount`，不得小於 0 或大於押金金額；扣除金額大於 0 時必須填寫扣除備註。
- 結算小計 = 上月電費 + 上月設備使用費 + 本期房租 + 本期電費 + 本期設備使用費。
- 房客應補繳 = `max(0, 結算小計 - 押金扣除)`。
- 押金應退 = `max(0, 押金金額 - 押金扣除)`。
- 押金扣除視為抵扣本次結算應收；原押金資料不覆寫，結算只保存當時快照。

### 電表照片

- 必須提供 9/1 起始電表度數與 9/1 現場照片。
- 必須提供退房日結束電表度數與退房日現場照片。
- 照片只接受 JPG／PNG，經既有前端壓縮後上傳至私有 Drive；不可產生公開 URL。
- 照片以既有 `V2_contract_documents` 私有附件儲存能力保存，新增
  `checkout_start_meter` 與 `checkout_end_meter` 類型，並在結算紀錄保存附件 ID。

## 使用者流程

1. 房東從房客詳細頁按「手動辦理退房」或「待辦理退房」。
2. 系統載入合約、押金、月租、費率、退房月份上一筆帳單的電費／設備費及結算預設日期。
3. 房東填寫實際退房日；結算期間自動更新為當月 1 日至退房日，並顯示含首尾天數。
4. 房東輸入 9/1 電表度數、退房日電表度數，上傳兩張對應現場照片。
5. 系統即時計算並顯示上月未結項目、本期各項目、結算小計、押金扣除、應補繳與應退押金。
6. 房東輸入押金扣除備註（如有扣除）並確認結算。
7. 後端在同一個受保護操作中重新驗證並寫入結算紀錄，再完成既有退房狀態轉換。
8. 成功後顯示結算摘要；原合約、原帳單、付款、簽名與照片附件保持可追溯。

## 資料設計

### `V2_checkout_settlements`

新增 append-only 結算表，使用 additive-only migration 建立標題，不重寫既有資料列。

欄位：

`settlement_id`, `workspace_id`, `landlord_id`, `contract_id`, `tenant_id`,
`room_id`, `previous_bill_id`, `previous_bill_month`,
`previous_electricity_amount`, `previous_equipment_amount`,
`settlement_start_date`, `move_out_date`, `rent_days`, `days_in_month`,
`rent_amount`, `start_meter_reading`, `end_meter_reading`, `electricity_usage`,
`electricity_fee_rate`, `equipment_fee_rate`, `electricity_amount`,
`equipment_amount`, `deposit_amount`, `deposit_deduction_amount`,
`deposit_refund_amount`, `subtotal_amount`, `tenant_balance_due`,
`start_meter_document_id`, `end_meter_document_id`, `settlement_note`,
`settlement_status`, `idempotency_key`, `created_at`, `created_by_user_id`,
`completed_at`。

結算表保存計算快照與來源 ID；既有 `V2_bills` 不被改寫，也不把上月整張帳單複製成另一筆月帳單。原始帳單仍由既有帳務流程管理，退房結算只讀取指定的上月電費／設備費來源。

### 既有附件表

沿用 `V2_contract_documents` 的私有 Drive 儲存與 SHA-256／idempotency 保護，僅新增兩個附件類型，不改變既有合約文件類型的處理。

## API 與頁面

新增或調整以下受短期房東 session 保護的 POST exchange actions：

- `landlord_contract_checkout_settlement_init`：載入退房對象、上月來源項目、押金快照、費率與結算預設值。
- `landlord_contract_checkout_settlement_preview`：驗證日期、電表與押金輸入並回傳後端計算結果，不寫入帳務或退房狀態。
- `landlord_contract_checkout_evidence_upload`：驗證 session、Workspace、合約與附件類型，將 9/1／退房日照片私有保存並回傳附件 ID。
- `landlord_contract_checkout_complete`：要求有效結算輸入及兩個附件 ID；後端重算、append 結算紀錄，再執行原退房生命週期更新；相同 idempotency key 回傳相同結果。

`landlord-tenant-checkout.html` 保留現有手機 shell，新增：

- 結算期間與居住天數。
- 上月電費／設備費明細。
- 本期房租、電費、設備使用費明細。
- 9/1 與退房日電表度數欄位。
- 兩個必要照片選擇器與上傳狀態。
- 押金金額、押金扣除、扣除備註、應補繳與應退押金。
- 未完成度數、照片或押金驗證時，禁止完成退房。

既有不帶結算資料的完成請求不得繞過新結算流程；回傳明確的結算必要欄位錯誤。既有合約、帳單與文件讀取能力維持相容。

## 安全、併發與錯誤處理

- 每個 init、preview、upload、complete 都驗證房東 session、Workspace、membership、contract、room 與 tenant scope。
- 退房日不得早於原合約起始日；起始日固定為退房月份 1 日且不得晚於退房日。
- 結束電表不得小於起始電表；兩次度數必須是合法非負數。
- 押金扣除不得超過押金快照；扣除大於 0 時缺少備註即拒絕。
- 已有新合約、簽署中合約或已完成結算時 fail closed；相同 idempotency key 只回傳既有結算結果。
- 結算 append 與合約／房間／房客退房狀態更新使用同一個既有 ScriptLock 範圍，不取得巢狀 ScriptLock。
- 不發送房客 LINE；照片與結算只供授權房東讀取。
- 任一驗證、附件或結算寫入失敗時，不得完成退房；原始合約與既有帳單不受影響。

## 測試與驗收

新增 runtime tests 覆蓋：

1. 506 於 9/7 退房時，期間為 9/1～9/7、居住天數為 7、本期房租按 7 天計算。
2. 上月只取未結電費／設備費，不帶入上月房租或管理費。
3. 9/1 與 9/7 電表差額正確計算電費與設備使用費，費率依既有月份設定。
4. 押金扣除、應補繳、應退押金與扣除備註驗證。
5. 缺少任一照片、度數倒退、跨 Workspace、日期錯誤、押金超額、已有結算及重複請求邊界。
6. 結算紀錄 append、原始帳單／合約不可覆寫、退房更新仍保持 idempotent。

新增 UI／文件 tests 覆蓋結算欄位、照片必要性、預覽摘要、禁止繞過及 API route inventory。

正式部署前執行 repository validator、Apps Script syntax check、受影響 runtime／UI tests、全套 Node tests 與 `git diff --check`；部署後只做公開頁 readback，真實房東／LINE／手機交易仍標示 `HUMAN_REQUIRED`，不得以匿名 API 200 代替。

## 非本次範圍

- 不修改既有月租帳單的原始金額或付款狀態。
- 不自動加入上月租金、管理費、其他固定費或損壞賠償；押金扣除只保存房東本次輸入的抵扣金額與備註。
- 不自動發送房客 LINE、不引入房客確認、不新增第三方簽章。
- 不處理資料列已被刪除的 502 或其他房客資料復原；資料復原需另行核對精確目標。
