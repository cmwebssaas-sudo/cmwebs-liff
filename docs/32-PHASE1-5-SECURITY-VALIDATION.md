# CMWebs V2 Phase 1.5 Security Validation

> 驗證時間：2026-07-19（Asia/Taipei）  
> 範圍：Production Baseline Security Sanitization and Validator Upgrade  
> 所有結果均不包含 credential 實值。

## 1. Outcome

repository canonical baseline 已將三個確認的付款 credential-like literal 改為 Script Properties，且維持原有常數名稱、route 名稱、handler 介面及付款呼叫端。canonical validator 已改為直接驗證 `apps-script/*.js`、`apps-script/程式碼.js`、`apps-script/appsscript.json` 與 repository root HTML；同一 parser 亦可讀取 Candidate 的 `.gs` 與 `Code.gs`，但不會放寬 canonical gate。

本輪沒有設定任何實際 Script Property、沒有 rotation、沒有修改 Production snapshot，也沒有執行 push 或 deploy。

## 2. Files changed by Phase 1.5

| 檔案 | 動作 | 說明 |
|---|---|---|
| `apps-script/程式碼.js` | 修改 | 新增 required-property helper；三個既有付款常數改讀 Script Properties |
| `scripts/validate-project.js` | 修改 | 支援 canonical `.js`、Candidate `.gs`、routes、handlers、helpers、manifest、Git clasp gate、credential scan、HTML syntax/link checks |
| `package.json` | 修改 | `npm run validate` 明確指向 canonical `apps-script/` 與 repository root HTML，expected routes 固定為 68 |
| `docs/31-SECRETS-MIGRATION-PLAN.md` | 新增 | Properties、rotation、history、rollback 與 pre-deploy 計畫 |
| `docs/32-PHASE1-5-SECURITY-VALIDATION.md` | 新增 | 本輪證據與人工待辦 |

`.gitignore` 在 Phase 0 已有未提交修改；Phase 1.5 無需再修改。`docs/27`～`docs/30` 與 `apps-script/` 其他檔案均不得由本輪改寫。

## 3. Properties keys used

| Property key | Canonical consumer | 狀態 |
|---|---|---|
| `ECPAY_MERCHANT_ID` | `apps-script/程式碼.js` 的既有 `MERCHANT_ID` 常數 | 程式已引用；Production Property 尚待人工建立 |
| `ECPAY_HASH_KEY` | `apps-script/程式碼.js` 的既有 `HASH_KEY` 常數 | 程式已引用；Production Property 尚待人工建立與 rotation |
| `ECPAY_HASH_IV` | `apps-script/程式碼.js` 的既有 `HASH_IV` 常數 | 程式已引用；Production Property 尚待人工建立與 rotation |

`getRequiredScriptProperty_(key)` 對空 key、missing Property 或空值明確拋錯；沒有 secret fallback，錯誤不包含值。

## 4. Secret inventory result

| 分類 | 數量 | 結果 |
|---|---:|---|
| Confirmed hardcoded payment credentials | 3 | 已從 canonical literal 遷移為 Script Properties；原始 snapshot 不修改 |
| Blocking credential-like literals after migration | 0 | PASS |
| Review-only test/external LINE user identifiers | 4 | 保留未修改；位置詳見 `docs/31-SECRETS-MIGRATION-PLAN.md` |
| Private key／Bearer／Google API key／JWT／GitHub／Slack／AWS pattern | 0 | 未命中 |
| Git-tracked `.clasp.json`／`.clasprc.json` | 0 | PASS |

四個 review-only 項目不是本輪確認的秘密；依限制未修改測試 UID。若後續集中到非秘密設定，須先人工確認是否共用同一測試身份。

## 5. Route and handler comparison

| Gate | Phase 0 baseline | Phase 1.5 after migration | Delta |
|---|---:|---:|---:|
| `v2_action` occurrences | 68 | 68 | 0 |
| Unique `v2_action` routes | 68 | 68 | 0 |
| Duplicate routes | 0 | 0 | 0 |
| First-level handler coverage | 68/68 | 68/68 | 0 |
| Common helper coverage | 7/7 | 7/7 | 0 |
| Duplicate top-level function | 0 | 0 | 0 |
| Duplicate top-level const | 0 | 0 | 0 |
| Duplicate top-level let | 0 | 0 | 0 |
| Duplicate top-level var | 0 | 0 | 0 |

新增的 `getRequiredScriptProperty_` 是唯一新 top-level function；它未與既有 function 或 globals 衝突。68 個 route 名稱及其 first-level handlers 均未改動。

## 6. Validator coverage

canonical `npm run validate` 現在包含：

- flat canonical `apps-script/*.js` 語法與 `程式碼.js` dispatcher。
- `.gs` 與 `Code.gs` 輸入相容，可用於 Candidate read-only analysis。
- 68 個 route、unique/duplicate route 與 first-level handler coverage。
- common helper coverage。
- duplicate top-level `function`／`const`／`let`／`var`，包含同檔與跨檔。
- `apps-script/appsscript.json` 存在且 JSON 可解析。
- Git-tracked `.clasp.json`／`.clasprc.json` gate。
- credential-like literal 與已知 token pattern 掃描；輸出不回顯實值。
- 44 個 repository HTML 的 inline JavaScript syntax。
- repository HTML 的相對 `.html` link target completeness。

Candidate 相容測試能讀取 21 個 `.gs`、`Code.gs` 與 26 個 Candidate HTML，並如實 FAIL 其既知的 62/68 handler、0/7 common helper、missing manifest、credential-like literals及 missing HTML targets。這證明格式相容，不代表 Candidate 通過 canonical gate，也未對 Candidate 寫檔。

## 7. Canonical validation result

執行介面：

```bash
npm run validate
```

實際透過 npm lifecycle 執行後的 canonical 摘要（exit code `0`）：

```text
Apps Script files: 30
HTML files: 44
Routes: 68 (unique 68, duplicates 0)
Handler coverage: 68/68
Common helper coverage: 7/7
Duplicate top-level declarations: function=0, const=0, let=0, var=0
Credential scan: blocking=0, review-only=4
Manifest: PASS
HTML links: checked=182, missing=0
Validation: PASS
```

四個 review-only warning 只顯示檔名、行號、變數名稱與類型，不顯示值。

## 8. Manual actions still required

- [ ] 在正確的 Production Apps Script project 手動建立 `ECPAY_MERCHANT_ID`。
- [ ] 手動建立並安全設定 `ECPAY_HASH_KEY`。
- [ ] 手動建立並安全設定 `ECPAY_HASH_IV`。
- [ ] 由第二位管理者確認三個 key 存在且非空，不在任何記錄中顯示值。
- [ ] 與付款服務商安排 hash credential rotation，確認舊交易驗證與 rollback 行為。
- [ ] 以 redacted secret scanner 檢查 all refs、remote branches、tags、forks、CI artifacts 與備份。
- [ ] 決定四個測試 UID 是否應於後續工作移至 `TEST_LANDLORD_LINE_UID`；本輪不改。
- [ ] 部署前建立 Apps Script version、deployment ID 與 rollback point。
- [ ] 在隔離條件下完成付款、LINE、Workspace isolation、HTML、route smoke tests。

## 9. Credentials awaiting rotation

| 類型 | 建議 |
|---|---|
| Payment hash key | 視為已暴露；待 provider 與 security owner 核准 rotation |
| Payment hash IV | 視為已暴露；與 hash key 同窗口 rotation |
| Payment merchant identifier | 由 provider 確認可旋轉性與處置；不得重新硬編碼 |

本表刻意不記錄現值、新值、長度、前後綴或 fingerprint。

## 10. Non-deployment statement

Phase 1.5 未修改 `_deployed/apps-script`、`_handoff`、repository HTML、Google Sheets、Apps Script Properties、LIFF ID、Web App URL、測試 UID、Apps Script version 或 deployment。未執行 `clasp push`、`clasp deploy`、commit 或 push。
