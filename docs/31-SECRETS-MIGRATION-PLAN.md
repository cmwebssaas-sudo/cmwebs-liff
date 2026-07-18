# CMWebs V2 Secrets Migration Plan

> 建立時間：2026-07-19 03:19:12 CST（Asia/Taipei）  
> 適用範圍：repository canonical backend `apps-script/`  
> Production snapshot `_deployed/apps-script`、Candidate `_handoff/` 與實際部署均不在本輪修改範圍。  
> 本文件只記錄位置、名稱、類型與 Property key；不包含任何 credential 實值。

## 1. Security decision

Phase 0 的 byte-identical baseline 保留了 Production dispatcher 中三個綠界付款 credential-like 常數。Phase 1.5 將 repository baseline 改為只從 Apps Script Script Properties 取得值：

- 保留既有常數名稱 `MERCHANT_ID`、`HASH_KEY`、`HASH_IV`，因此呼叫端介面不變。
- 新增集中式 `getRequiredScriptProperty_(key)`。
- key 為空、Property 不存在或值為空字串時明確拋出錯誤。
- 錯誤只包含 Property key，不包含 credential 值。
- 不提供硬編碼 fallback。
- `_deployed/apps-script` 仍是未改動的 Production rollback snapshot；不得把其中值複製到 Git、文件、Issue 或 log。

## 2. Secret inventory

### 2.1 Confirmed migration items

| 檔名 | 遷移前行號 | 遷移後宣告行號 | 變數名稱 | 類型 | 是否可能已進入 Git history | 建議／採用的 Script Property key |
|---|---:|---:|---|---|---|---|
| `apps-script/程式碼.js` | 3 | 19 | `MERCHANT_ID` | Payment merchant credential identifier | 本機 `git log --all -S` 以變數名檢查無命中；來源是正式部署快照，仍應按可能外洩處理 | `ECPAY_MERCHANT_ID` |
| `apps-script/程式碼.js` | 4 | 23 | `HASH_KEY` | Payment hash key | 本機 `git log --all -S` 以變數名檢查無命中；來源是正式部署快照，仍應按可能外洩處理 | `ECPAY_HASH_KEY` |
| `apps-script/程式碼.js` | 5 | 27 | `HASH_IV` | Payment hash IV | 本機 `git log --all -S` 以變數名檢查無命中；來源是正式部署快照，仍應按可能外洩處理 | `ECPAY_HASH_IV` |

「本機 history 無命中」不等於從未外洩：目前 `apps-script/` 尚未追蹤，且無法由本機 repository 證明 remote、舊 clone、Apps Script version、備份或其他匯出從未保存過實值。因此三項均進入 rotation 清單。

### 2.2 Review-only identifiers retained unchanged

以下是測試函式內的 LINE user identifier。依 `docs/18-SECURITY-AND-SECRETS.md`，測試 UID 可放在非秘密設定；依本輪限制，不修改測試 UID。表內不含實值。

| 檔名 | 行號 | 變數名稱 | 類型 | 是否可能已進入 Git history | 建議設定 key（後續人工決策） |
|---|---:|---|---|---|---|
| `apps-script/V2_API.js` | 1285 | `landlordLineUserId` | Test/external LINE user identifier | 本機 history 未能證明；canonical 與候選來源皆有同類測試碼 | `TEST_LANDLORD_LINE_UID` |
| `apps-script/V2_LANDLORD_MANAGEMENT.js` | 1299 | `landlordLineUserId` | Test/external LINE user identifier | 本機 history 未能證明；canonical 與候選來源皆有同類測試碼 | `TEST_LANDLORD_LINE_UID` |
| `apps-script/V2_PAID_BILL_MANAGEMENT.js` | 1378 | `landlordLineUserId` | Test/external LINE user identifier | 本機 history 未能證明；Production-only 測試模組含此設定 | `TEST_LANDLORD_LINE_UID` |
| `apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js` | 1864 | `lineUserId` | Test/external LINE user identifier | 本機 history 未能證明；canonical 與候選來源皆有同類測試碼 | `TEST_LANDLORD_LINE_UID` |

後續若要集中測試 UID，必須另開明確工作項目，先確認四個測試情境是否應共用同一 UID；本輪不得自行合併或改值。

### 2.3 Patterns not found in canonical baseline

canonical scan 未發現硬編碼的下列型態：Google API key、Bearer token、JWT、GitHub token、Slack token、AWS access key、private key、service account、LINE channel access token、LINE channel secret、webhook secret或 password。這只代表目前掃描規則未命中，不替代 provider-side inventory 與 history scanner。

## 3. Required Script Properties

| Property key | 模組 | 用途 | Runtime required | 值來源 |
|---|---|---|---|---|
| `ECPAY_MERCHANT_ID` | `apps-script/程式碼.js` | 綠界付款請求的 merchant identifier | 是；dispatcher 載入時讀取 | 由授權管理者從付款服務商／安全秘密庫手動設定 |
| `ECPAY_HASH_KEY` | `apps-script/程式碼.js` | 綠界 CheckMacValue 計算 | 是；dispatcher 載入時讀取 | 由授權管理者從付款服務商／安全秘密庫手動設定 |
| `ECPAY_HASH_IV` | `apps-script/程式碼.js` | 綠界 CheckMacValue 計算 | 是；dispatcher 載入時讀取 | 由授權管理者從付款服務商／安全秘密庫手動設定 |

不得在 repository、`.clasp.json`、shell history、測試輸出、文件或聊天中建立實值。Script Properties 的實際設定是人工部署前工作，本輪未執行。

## 4. Manual migration steps

1. 由付款服務與 Apps Script 專案的雙重授權管理者確認目標 Apps Script Project ID；不要依資料夾名稱猜測。
2. 從正式秘密庫或付款服務商後台取得目前 credential；不要從 Git、`_deployed`、`_handoff` 或報告複製。
3. 在 Apps Script **Project Settings → Script Properties** 建立本文件列出的三個 key，逐字確認 key 名稱。
4. 由第二位管理者在不顯示值的前提下確認三個 key 均存在且非空。
5. 在部署前的隔離驗證環境載入 `程式碼.js`，確認缺值會 fail closed、齊值時能完成既有付款參數產生流程。
6. 不得以 `test=1` 當 dry-run；任何付款或 LINE 測試必須使用核准的隔離資料與最小範圍。
7. 完成 credential rotation 後更新 Script Properties，才安排新的 Apps Script version 與既有 Web App URL 下的部署；部署不屬於本輪。
8. 部署後只記錄 version、時間、執行者與 key 是否存在，不記錄值。

## 5. Credential rotation recommendation

- `ECPAY_HASH_KEY` 與 `ECPAY_HASH_IV`：視為已暴露，向付款服務商確認可輪替方式、切換窗口與舊交易驗證影響；先完成新值的安全保存與回復方案，再切換。
- `ECPAY_MERCHANT_ID`：通常是識別碼而非單獨的秘密，但它是簽章 credential 組的一部分；由付款服務商確認是否可／需更換，不應因「不可旋轉」而重新硬編碼。
- 輪替必須與 deployment version、付款 smoke test 與 rollback owner 同一變更窗口；不可先讓 runtime 指向不存在的 Property。
- 檢查與撤銷任何曾包含這些值的共享檔、ticket、聊天、CI log、artifact 或備份存取權。

## 6. Git history inspection

只以變數名進行的低風險本機檢查：

```bash
git log --all -S'MERCHANT_ID' -- apps-script/ _deployed/ _handoff/
git log --all -S'HASH_KEY' -- apps-script/ _deployed/ _handoff/
git log --all -S'HASH_IV' -- apps-script/ _deployed/ _handoff/
git ls-files | rg '(^|/)(\.clasp\.json|\.clasprc\.json)$'
```

正式 history audit 應在隔離環境使用支援 redaction 的 `gitleaks`、`trufflehog` 或組織核准工具掃描所有 refs、tags、remote branches、CI artifacts 與 forks。報告只保存 rule、path、line、commit 與狀態；不得把命中的值貼入終端摘要、文件或 Issue。若命中任何真實 credential，無論 commit 是否仍可達，均應 rotation；不要只靠 rewrite history 當作補救。

## 7. Rollback procedure

### Repository-only rollback（本輪尚未部署）

1. 停止合併，不設定或移除任何 Production Property。
2. 以 Phase 0 hash/report 與 `_deployed/apps-script` 驗證原始 Production snapshot；不要把其硬編碼 credential 重新提交。
3. 若問題只是 Property 缺失，首選修正 Script Properties，而不是恢復硬編碼值。

### Future deployment rollback

1. 保留部署前 Apps Script version、deployment ID、Web App URL 與 smoke-test evidence。
2. 新版本失敗時，將 deployment 指回已核准的前一版本；不改 Web App URL。
3. 依付款服務商狀態決定保留或回復 credential；任何回復都由安全 owner 執行，不把值寫入程式。
4. 重新執行付款、LINE、Workspace isolation 與 route smoke tests。
5. rollback code source 仍可對照 `_deployed/apps-script` 及 `~/CMWebs/backup/apps-script-before-codex-2026-07-18`，但兩者都不是可重新提交秘密值的來源。

## 8. Pre-deployment validation checklist

- [ ] 三個 Script Properties 已在正確 Apps Script project 建立且非空。
- [ ] Properties 的讀取者、付款服務 owner 與 deployment owner 已確認。
- [ ] credential rotation 計畫、切換時間與 provider rollback 已核准。
- [ ] `npm run validate` 顯示 68 個 unique routes、68/68 handler coverage、0 duplicate declarations、0 blocking credential finding。
- [ ] `.clasp.json`／`.clasprc.json` 未被 Git 追蹤。
- [ ] 缺少任一 required Property 時，錯誤不含 credential 且流程 fail closed。
- [ ] 付款參數與簽章在隔離環境通過，但未使用 `test=1` 冒充 dry-run。
- [ ] LINE flow、Workspace isolation、HTML link 與既有 API contract 回歸完成。
- [ ] 前一 Apps Script version、deployment ID 與 rollback owner 已記錄。
- [ ] Git history／artifact 掃描已完成，所有確認外洩的 credential 已 rotation。

## 9. Phase boundary

本輪只安全化 repository canonical baseline 與 validator；未修改 `_deployed/apps-script`、`_handoff`、Google Sheets、Apps Script Properties、LIFF ID、Web App URL、測試 UID、deployment 或任何 Production runtime。
