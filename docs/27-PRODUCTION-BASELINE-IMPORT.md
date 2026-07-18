# V2 Production Baseline Import

- 執行時間：2026-07-19 02:41:08 CST（Asia/Taipei）
- 執行 branch：`chore/v2-production-consolidation`
- 開始前 Git status：clean
- 工作目錄：`/Users/hans/CMWebs/cmwebs-liff`
- Phase：Canonical Consolidation Phase 0 — Production Baseline

## 目的與範圍

本輪將實際 deployed Apps Script snapshot 原封不動匯入 repository，建立可追蹤的 production backend baseline。這是 raw production baseline import，不是功能合併、candidate merge、檔名正規化、重構、格式化、業務邏輯修正或 deployment。

本輪明確保留 deployed 原始副檔名與檔名，包括 `程式碼.js`、`V2_API.js`、`TESTS.js`、所有 `V2_*.js` 與 `appsscript.json`。未把 `程式碼.js` 改名為 `Code.gs`，亦未把 `.js` 轉成 `.gs`；任何後續 canonical rename 必須另案審查，且不得在 rename 時夾帶內容變更。

## Import record

| Item | Result |
|---|---|
| 來源目錄 | `_deployed/apps-script` |
| 目的目錄 | `apps-script/` |
| Production 程式檔 | 30 個 `.js` |
| Manifest | 1 個 `appsscript.json` |
| 匯入總數 | 31 個檔案 |
| Candidate overlay 使用 | 0 個檔案；完全未使用 candidate 補缺 |
| 來源子目錄 | 0 |
| 目的目錄額外檔案 | 0 |
| SHA-256 完全一致 | 31/31 |
| `appsscript.json` 一致 | YES；SHA-256 相同且 JSON 可解析 |

## Excluded files

| Excluded item | Source state | Import result | Reason |
|---|---|---|---|
| `.clasp.json` | 存在於 deployed snapshot | 未複製 | 含本機／deployment binding metadata，不是 production source baseline。 |
| `.clasprc.json` | 來源目錄未發現獨立檔案 | 未複製 | 本機 clasp 登入資訊。 |
| OAuth／credential JSON | 來源目錄未發現獨立檔案 | 未複製 | 本機憑證不得進 repository。 |
| Token／本機登入資訊檔 | 來源目錄未發現獨立檔案 | 未複製 | Secret／local auth data 不屬於 baseline。 |
| Deployment ID 清單 | 來源目錄未發現獨立檔案 | 未複製 | Deployment metadata 必須存於核准的安全紀錄。 |
| Backup artifact | 來源目錄未發現獨立檔案 | 未複製 | Backup 不得混入 canonical source。 |

本輪的 copy allowlist 只有 `*.js` 與 `appsscript.json`；沒有從 `_handoff` 或 candidate overlay 複製任何檔案。

## SHA-256 comparison

比較方式：對 `_deployed/apps-script/<file>` 與 `apps-script/<file>` 分別以 SHA-256 計算實際 bytes，並逐檔要求 hash 完全相同；沒有以檔案大小或修改時間代替內容比較。

| File | SHA-256 | Match |
|---|---|---|
| `TESTS.js` | `fc166e80f761bdfa2337832cbb23619a77bc3eee2100176fd5180999c7f9820f` | YES |
| `V2_ANNOUNCEMENT_MANAGEMENT.js` | `df2a10c70bde54ab26f784fbe868ea607b935ebb112c7128a466bc71ba0c780d` | YES |
| `V2_API.js` | `1d5be3cfe940249a9d547a6c5ee848198b613f6ac25a4d4c1d7d5686ecdbe819` | YES |
| `V2_AUTO_PAYMENT_REMINDER.js` | `6f8acdd0d81d4d679381fd5968e2ddf612978a31f1487472fc99b5d1a2194398` | YES |
| `V2_BILLING_MANAGEMENT.js` | `02d62c007a5745a2744e36fec46e104c65e5e7117bf9bc1e04f78882fdac01be` | YES |
| `V2_BILL_NOTIFICATIONS.js` | `5416ef1fae1ec1866507fb3470fbe94c6a84050487c654f96c6afbbe1280f8b5` | YES |
| `V2_CONTRACT_REQUESTS.js` | `4f2179c8e9b993bc4be98ff34c4c5289642dfc0821cfd7ea0454c6698fc332f0` | YES |
| `V2_LANDLORD_MANAGEMENT.js` | `0ddc2bd06d495b0624d365c3689bc9f4d88c0c3bb8948b5bcd3d203fe0bbe580` | YES |
| `V2_LANDLORD_ONBOARDING.js` | `2d3133d71ea109afc42690dfa6be653b47c764d033ba1cad64f3cf91cea53a51` | YES |
| `V2_LEGACY_BILL_IMPORT.js` | `890498d1d1e8ad58f8450c3cbfcd5cb1bc4cce897d4803af421c1116e82ccf7b` | YES |
| `V2_MANUAL_SETTLEMENT.js` | `ea058d1b45d49da8a87bbc0da5af6e5ca6d51ac742870d786f51764e9ccf76f6` | YES |
| `V2_PAID_BILL_MANAGEMENT.js` | `7762563e8bfb299d2e7c17533da9dacde3bcd458766514b11d5b3f9db7c24b4d` | YES |
| `V2_PAYMENT_REVERSAL.js` | `5634c346091c19f48d8d5f77412caa91731f43eff7b72304698cbac0c32d1abf` | YES |
| `V2_PAYMENT_SETTLEMENT.js` | `6445c6bf45a763041e94e5316b82af43af8e4ed50232189894e929c3b7a8b2c2` | YES |
| `V2_PROPERTY_ROOM_MANAGEMENT.js` | `a326031729f675e155ba8816b5ba514257b63cb18abcf6afc576bd82e483e1f3` | YES |
| `V2_SETTINGS_INTEGRATION.js` | `96da56eb8a7fea3ca300b52b0e79fa34f1a5c1d32e8f6fe0746a31cf1d86d44e` | YES |
| `V2_SYSTEM_SETTINGS.js` | `e903486bbaf73248879be1d57e8ec32084684ab7376eb462ac5f15add6fc6a81` | YES |
| `V2_TEAM_MANAGEMENT.js` | `664c80098de32b42c534d2d1b695f648636352a4abfe62468b3b1945008cc63b` | YES |
| `V2_TENANT_BINDING_PHONE.js` | `525905411142f5f2ec4ab9d4995677d7ffeb71d631a00d076fb610fe8e4bd488` | YES |
| `V2_TENANT_CHECKIN_MANAGEMENT.js` | `e12fbdf123aa2878e5ff1d38b28c22701a3eca878f5613729fdd2d63eead2e76` | YES |
| `V2_TENANT_LEASE_ONBOARDING.js` | `9006ad0b64ef6dd19fee077b4cbcc513271fc196c1f7d0d2ef3a8479809c8c43` | YES |
| `V2_TENANT_MESSAGES.js` | `c6b30ac48602252e563e61d582dc86379164cf39baf183f525c90d6e8e04e84e` | YES |
| `V2_TENANT_PAYMENT_REPORTS.js` | `f69ce7fd283a19602e3518c8d282bd67297256e699c189444fec72985fd314a7` | YES |
| `V2_WORKSPACES.js` | `af2887f168ec86f2ffe0bf0b39676a5412b4964674286d7625733e252cd03199` | YES |
| `V2_WORKSPACE_CREATION.js` | `0724c89bf22842836e51aeab0aeb5312ebaec717874bde9ea6a0bc23e7abb165` | YES |
| `V2_WORKSPACE_DASHBOARD_NATIVE.js` | `9168ffe502f3b31e1ec6fdcd6e0f5269c7cda0551a6d0e75c62957de820cce47` | YES |
| `V2_WORKSPACE_LANDLORD_ACCESS.js` | `47584e8286b12324478525cb4f455fcfbaeb17d78f6fc130d3d1142157815351` | YES |
| `V2_WORKSPACE_NOTIFICATIONS.js` | `f6b614d4e82cfe4bcd2ab096454fa103460fda5d2b8e2383c39118287bd7ee4b` | YES |
| `V2_WORKSPACE_OPERATION_AUDIT.js` | `d0151e788a8ab4070de9e1f61fc5132a4676810e14df0cbf73656483727dbe6d` | YES |
| `appsscript.json` | `8b2ff50f549b018681657c2d98dfa3eb87f03f8e08373e936f36138d14145e46` | YES |
| `程式碼.js` | `0eef41cec7c7b3d1e216ac2f699cfbf8757275fec08aeb8f72db1be68254d0f8` | YES |

結論：31/31 匯入檔案的 SHA-256 全部與 deployed snapshot 一致；無 missing、mismatch 或 extra target file。

## Static validation

本輪驗證直接掃描 `apps-script/*.js`，不讀取 candidate overlay 作 handler 或 helper 補缺。

| Check | Result |
|---|---|
| JavaScript syntax | PASS — 30/30 `.js` 通過 Node `--check` |
| Top-level function | 958；duplicate = 0 |
| Top-level `const` | 105；duplicate = 0 |
| Top-level `let` | 0；duplicate = 0 |
| Top-level `var` | 1；duplicate = 0 |
| `v2_action` declarations | 68 |
| Unique routes | 68 |
| Duplicate routes | 0 |
| Route/handler reference set | 68 |
| First-level handler coverage | 68/68 |
| Missing expected routes | 0 |
| Undocumented imported routes | 0 |
| Required common helpers | 7/7 |
| `appsscript.json` JSON parse | PASS |

Handler coverage 以 `docs/22-BASELINE-DIFF-REPORT.md` 已盤點的 68 組 route → first-level handler mapping 為 expected set，再對匯入的 30 個 `.js` top-level function 實際定義做比對。Required common helpers 為：

```text
jsonOutput_
htmlBridgeOutput_
handleLineWebhook_
pushLineTextMessage_
cmwebsLogLineMessage_
getSheetObjects_
logLiffAccess_
```

### Existing validator compatibility

既有 `scripts/validate-project.js`／`npm run validate` 的目前實作只掃描 `apps-script/*.gs` 並要求 `apps-script/Code.gs`，也假設 frontend 位於 `public/`。本輪依明確要求保留 deployed 原始 `.js` 與 `程式碼.js`，因此直接執行 validator 會得到結構性失敗：它回報 Apps Script files = 0、缺 `Code.gs`，並找不到 `public/`；這不是上述 `.js` 語法、route 或 handler 驗證失敗。

本輪沒有修改 validator，因允許變更範圍只限 raw production baseline、本文與必要 `.gitignore`。後續要讓 `npm run validate` 支援 Phase 0 raw baseline，或在正式 `.gs`／`Code.gs` normalization phase 切換 validator，需人工決策並另案執行。

## `.gitignore` policy

本輪新增以下明確排除：

```gitignore
apps-script/.clasp.json
**/.clasprc.json
**/credentials.json
**/credentials.local.json
**/client_secret*.json
**/oauth*.json
```

已驗證 `apps-script/程式碼.js`、`apps-script/V2_API.js` 與 `apps-script/appsscript.json` **沒有**被忽略；`apps-script/.clasp.json` 與本機 auth/credential JSON patterns 會被忽略。

## Security observation

本輪目標要求 production bytes 與 deployed snapshot SHA-256 完全相同，因此沒有 redaction、改寫、移除 inline constant 或調整任何邏輯。`docs/22-BASELINE-DIFF-REPORT.md` 已標記 `程式碼.js` 含 credential-like payment constants；本文件不輸出、不重述其值，也沒有複製任何獨立 OAuth/token/credential file。

這是已知的 pre-commit security gate：在未有人工批准的 credential rotation／Apps Script Properties migration 方案前，不應 commit、push 或 deploy 這份 exact baseline。任何 secret remediation 都會改變 SHA-256，必須作為 baseline import 之後的獨立、可審查變更，不能偽稱仍與 deployed snapshot 逐位元相同。

## Rollback source

既有 rollback 來源：

```text
~/CMWebs/backup/apps-script-before-codex-2026-07-18
```

本輪已確認其對應絕對路徑可讀；沒有修改、覆蓋或複製該 rollback 目錄內容。

## No-production-change declaration

- 沒有修改 `_deployed/apps-script`。
- 沒有修改 `_handoff` 或使用 candidate 功能補缺。
- 沒有修改任何既有 repository HTML。
- 沒有改名、重構、格式化、刪除或修正任何 Production Apps Script 程式內容。
- 沒有修改 Google Sheets、Web App deployment、Apps Script project、trigger、Properties、LIFF ID、Web App URL 或測試 UID。
- 沒有執行 `clasp push`、`clasp deploy`、commit 或 push。
- `apps-script/` 的 31 個檔案只建立為本地、待人工審查的 exact deployed baseline。

## Open items requiring human confirmation

1. 確認是否接受 Phase 0 暫時保留 deployed 原始 `.js`／`程式碼.js`，並把 `.gs`／`Code.gs` normalization 排到下一個獨立 phase。
2. 決定 existing validator 應先支援 raw `.js` baseline，或等 normalization 後再要求 canonical `.gs`／`Code.gs`。
3. 在任何 commit 前，批准 credential rotation、Properties migration 與 Git exposure prevention；不得把已暴露 credential 當 rollback 值。

完成上述人工確認前，本 baseline 不得 promotion、commit、push 或 deploy。
