# CMWebs V2 Pre-Commit Security and Baseline Audit

> 最後更新：2026-07-19 04:40:50 CST（Asia/Taipei）
> Branch：`chore/v2-production-consolidation`
> 狀態：Phase 1.7 completed
> 本文件不包含任何 credential 實值、完整 LINE UID、secret fingerprint 或可還原資料。

## 1. Final audit decision

**結果：PASS — canonical baseline 可進入人工 commit。**

Phase 1.7 已把完整 Apps Script scan 找到的 40 個 test UID occurrences 遷移至兩個 Script Properties。現在 hardcoded LINE UID = 0、blocking credential = 0、`npm run validate` = PASS；Phase 1.6 的 `CONDITIONAL PASS` 與 UID 人工例外已解除。

此 PASS 只允許人工 reviewer 依 allowlist stage／commit，不授權 Codex 自行 commit，也不授權 push、clasp 或 deploy。

## 2. Audit evolution

| Phase | Finding | Resolution |
|---|---|---|
| 1.5 | 原 validator 只從 declaration-like pattern 回報 4 個 review-only UID | Phase 1.7 改為完整 LINE UID literal pattern |
| 1.6 | Credential gate通過，但 4 個已知 UID 造成 conditional commit gate | 重新完整盤點，確認實際為 40 occurrences／2 identities／22 test-bearing files |
| 1.7 | 所有 occurrence 均位於 `test*`；正式 route／handler occurrence = 0 | 全部改讀 `TEST_LANDLORD_LINE_UID` 或 `TEST_TENANT_LINE_UID` |

文件與終端報告未記錄任何完整 UID。

## 3. `npm run validate`

實際 canonical validation：

```text
Apps Script files: 30
HTML files: 44
Routes: 68 (unique 68, duplicates 0)
Handler coverage: 68/68
Common helper coverage: 7/7
Duplicate top-level declarations: function=0, const=0, let=0, var=0
Credential scan: blocking=0, review-only=0
Hardcoded LINE UID: 0
Manifest: PASS
HTML links: checked=182, missing=0
Validation: PASS
```

## 4. Secret and identifier scan

| Check | Result |
|---|---:|
| ECPay actual Merchant ID match in intended scope | 0 |
| ECPay actual HashKey match in intended scope | 0 |
| ECPay actual HashIV match in intended scope | 0 |
| LINE channel access token／secret | 0 |
| Bearer token／private key／password | 0 |
| OAuth credential literal／file | 0 |
| Hardcoded full LINE UID | 0 |
| Credential-like pending filename | 0 |
| Git-tracked `.clasp.json`／`.clasprc.json` | 0 |
| Git-tracked `_deployed`／`_handoff`／backup path | 0 |

Script Property key 名稱可提交，但值不可提交。validator 的完整 UID pattern 不匹配 Property key、遮罩範例或含省略號的文件文字；finding 只輸出檔名、行號與類型。

## 5. Script Properties contract

| Key | Scope | Source commit readiness | Runtime／test readiness |
|---|---|---|---|
| `ECPAY_MERCHANT_ID` | Payment runtime | PASS；無實值 | 部署前仍須人工設定 |
| `ECPAY_HASH_KEY` | Payment runtime | PASS；無實值 | 部署前須人工設定並完成 rotation |
| `ECPAY_HASH_IV` | Payment runtime | PASS；無實值 | 部署前須人工設定並完成 rotation |
| `TEST_LANDLORD_LINE_UID` | 35 個房東 `test*` calls | PASS；無實值 | 執行相關測試前人工設定 |
| `TEST_TENANT_LINE_UID` | 5 個房客 `test*` calls | PASS；無實值 | 執行相關測試前人工設定 |

所有 40 個 test calls 使用 `getRequiredScriptProperty_`，缺值時 fail closed；沒有 optional fallback、硬編碼 fallback 或錯誤訊息中的 UID。

## 6. Route, handler and production protection

| Gate | Result |
|---|---|
| Route declarations／unique | PASS — 68/68 |
| Duplicate routes | PASS — 0 |
| First-level handler coverage | PASS — 68/68 |
| Common helpers | PASS — 7/7 |
| Formal handler names changed | NO |
| `apps-script/程式碼.js` changed by Phase 1.7 | NO |
| `appsscript.json` changed by Phase 1.7 | NO |
| Repository HTML changed by Phase 1.7 | NO |
| `_deployed/`／`_handoff/` changed | NO |

Apps Script 的 Phase 1.7 diff 僅限 `test*` 函式中的 UID literal → required Property call。完整 module／function inventory 見 `docs/34-TEST-UID-MIGRATION.md`。

## 7. Intended commit allowlist

允許人工 stage／commit：

```text
apps-script/
docs/22-* through docs/34-*
scripts/validate-project.js
package.json
.gitignore
```

明確禁止 stage／commit／force-add：

```text
_deployed/
_handoff/
_backup/
backup/
apps-script/.clasp.json
**/.clasprc.json
credential／OAuth／token／password files
```

`package.json` 與 `.gitignore` 是前期既有變更；Phase 1.7 沒有修改它們。

## 8. Manual confirmation fields

以下只填 owner、日期、狀態或變更單，不得填入值、部分值或 fingerprint。

- [ ] `ECPAY_MERCHANT_ID` 已在正確 Production project 建立且非空。Reviewer：________
- [ ] `ECPAY_HASH_KEY`／`ECPAY_HASH_IV` 已建立，rotation plan 已核准。Reviewer：________
- [ ] `TEST_LANDLORD_LINE_UID` 已指向核准的單一房東測試身份。Reviewer：________
- [ ] `TEST_TENANT_LINE_UID` 已指向核准的單一房客測試身份。Reviewer：________
- [ ] repair／Workspace create／可能寫入的測試有獨立執行核准。變更單：________
- [ ] staged paths 已逐項符合 allowlist。Reviewer：________
- [ ] deployment version／ID／rollback point 已在安全系統記錄。變更單：________

前四項不阻擋 source commit，但會分別阻擋 Production deploy 或相關人工測試。

## 9. Human commit gate

| Gate | Result |
|---|---|
| Branch | PASS — `chore/v2-production-consolidation` |
| `npm run validate` | PASS |
| Blocking credentials | PASS — 0 |
| Hardcoded LINE UID | PASS — 0 |
| Route／handler | PASS — 68 unique、68/68 |
| Commit path allowlist | PASS |
| `git diff --check` | PASS — 無 whitespace error |

**最終狀態：PASS，可進入人工 commit。**Codex 未 stage、commit 或 push。

## 10. No-deployment statement

Phase 1.7 未修改 Google Sheets、Script Properties、LIFF ID、Web App URL、正式 UID、route、handler、業務邏輯、Apps Script version 或 deployment。未執行 `clasp push`、`clasp deploy`、commit 或 push。
