# V2 Canonical Consolidation Phase 1 Summary

- 日期：2026-07-19（Asia/Taipei）
- Production canonical：`apps-script/`
- Candidate overlay：`_handoff/cmwebs-codex-handoff-2026-07-18/candidate-overlay/`
- 產出：`docs/28-CANDIDATE-GAP-REPORT.md`、`docs/29-CANDIDATE-MERGE-MAP.md`、本文件
- 執行性質：read-only source comparison；未建立merge

## Summary metrics

| Metric | Result |
|---|---:|
| Production Apps Script modules | 30 |
| Candidate Apps Script modules | 21 |
| Candidate HTML files | 26 |
| Candidate-only Apps Script modules | 0 |
| Production-only modules missing from Candidate | 9 |
| Byte-identical shared Apps Script modules | 20 |
| EOF-only shared Apps Script modules | 1 |
| Modified Production modules — functional | 0 |
| Candidate-added routes | 0 |
| Candidate-modified routes | 0 |
| Candidate-removed routes | 0 |
| Candidate-added Sheets | 0 |
| Candidate-added triggers | 0 |
| Candidate-added LINE push paths | 0 |
| Production first-level handler coverage | 68/68 |
| Candidate first-level handler coverage | 62/68 |
| Candidate missing proxy targets | 6 |
| Candidate missing required common helpers | 7 |
| Candidate-only HTML | 0 |
| HTML behavior conflicts | 2 |
| Repository HTML missing from Candidate | 18 |
| Candidate internal links with missing Candidate target | 7 |

## Candidate Module 數

Candidate Apps Script module總數：**21**。

```text
Code.gs
V2_ANNOUNCEMENT_MANAGEMENT.gs
V2_AUTO_PAYMENT_REMINDER.gs
V2_BILLING_MANAGEMENT.gs
V2_BILL_NOTIFICATIONS.gs
V2_CONTRACT_REQUESTS.gs
V2_LANDLORD_MANAGEMENT.gs
V2_LANDLORD_ONBOARDING.gs
V2_PROPERTY_ROOM_MANAGEMENT.gs
V2_SETTINGS_INTEGRATION.gs
V2_SYSTEM_SETTINGS.gs
V2_TEAM_MANAGEMENT.gs
V2_TENANT_CHECKIN_MANAGEMENT.gs
V2_TENANT_MESSAGES.gs
V2_TENANT_PAYMENT_REPORTS.gs
V2_WORKSPACES.gs
V2_WORKSPACE_CREATION.gs
V2_WORKSPACE_DASHBOARD_NATIVE.gs
V2_WORKSPACE_LANDLORD_ACCESS.gs
V2_WORKSPACE_NOTIFICATIONS.gs
V2_WORKSPACE_OPERATION_AUDIT.gs
```

21個全部有Production對應；Candidate-only module為0。

## Modified Production Module 數

| Classification | Count | Detail |
|---|---:|---|
| Functional backend modification | 0 | 沒有Candidate module改變Production函式、route或行為。 |
| Byte-identical | 20 | 包含`Code.gs` ↔ `程式碼.js`。 |
| EOF-only | 1 | `V2_WORKSPACE_DASHBOARD_NATIVE`只差檔尾whitespace。 |
| Frontend behavior conflict | 2 | `tenant-home.html`、`tenant-bills.html`。 |

因此「Modified Production Module」的正式Phase 1計數為：**0 functional backend modules**。EOF-only與HTML conflict分開記錄，不混入backend功能修改數。

## New Route 數

**0**。

- Production與Candidate route declarations均為68。
- Unique routes均為68。
- Duplicate routes均為0。
- `Code` byte-identical。
- Candidate問題是missing handlers/dependencies，不是新增route。

## New Sheet 數

**0**。

- Candidate V2 Sheet-name references全部也存在Production。
- Candidate反而缺6個Production Sheet/storage references。
- 本輪只比較source literal，沒有讀取或修改live Google Sheets，亦不把literal推定成live schema。

## New Trigger 數

**0**。

- Candidate `V2_AUTO_PAYMENT_REMINDER` 與Production byte-identical，沒有新增trigger behavior。
- Candidate缺少Production `V2_API` 的V1 paid sync trigger utilities。
- 本輪未建立、刪除、列舉或修改任何Production trigger。

## Merge Blocks

Merge blocks總數：**7類**。

| # | Block | Evidence | Required resolution |
|---:|---|---|---|
| 1 | Candidate backend不完整 | 缺9個Production modules | Candidate不得作canonical backend或wholesale merge。 |
| 2 | First-level handler gap | Candidate 62/68；缺6 | 保留Production binding/onboarding/API owners。 |
| 3 | Proxy target gap | 6個Workspace proxies缺formal targets | 保留`V2_API`與4個Production payment modules。 |
| 4 | Common helper gap | JSONP/bridge/webhook/LINE/sheet/access-log共7個缺失 | `V2_API`不得提前刪除或拆漏。 |
| 5 | Global duplicate risk | Candidate 692 functions與60 top-level variables都已在Production | 同名`.js`／`.gs`不得並存。 |
| 6 | Candidate frontend不完整 | 缺18頁，7個internal link target不存在 | Repository root 44頁維持canonical。 |
| 7 | HTML behavior conflicts | `tenant-home`、`tenant-bills` | 人工決策、hash rollback與mobile regression。 |

另有跨Phase security gate：Candidate `Code` 與Production byte-identical，因此也包含既有credential-like constants風險。在credential rotation／Properties migration核准前，不得commit、push或deploy；本輪未輸出任何值。

## Merge recommendation

```text
Direct Candidate cherry-pick: none
Candidate module bundle to import: none
Candidate backend wholesale merge: blocked
Candidate public wholesale merge: blocked
Production module deletion based on Candidate absence: forbidden
```

Phase 1推薦動作：

1. Production 30-module baseline保持不變。
2. Candidate 20個byte-identical與1個EOF-only module只作provenance。
3. 不把Candidate缺module推定為deprecated Production功能。
4. 下一個實作決策只針對正式normalization/security/validator strategy，不從Candidate引入功能。
5. Frontend僅處理兩個conflict與完整navigation驗收，不整包搬Candidate public。

## Human Decision Required

| Decision | Current evidence | Required human outcome |
|---|---|---|
| Candidate backend disposition | 無新增module/route/Sheet/trigger，且runtime不完整 | 批准「不merge Candidate backend，只保留provenance」。 |
| `Code` filename normalization | `Code.gs`與`程式碼.js` byte-identical；Phase 0要求保留raw filename | 決定何時以獨立、content-preserving變更正規化，並確保唯一dispatcher。 |
| Credential remediation | Shared `Code`繼承既有credential-like constants | 批准rotation、Properties key contract、history exposure與pre-commit gate。 |
| `V2_API` ownership | Candidate缺失，但10個Candidate modules直接依賴或透過它取得helper | 批准Production完整保留；P2才逐函式拆分／退出legacy。 |
| Payment canonical owners | Candidate proxy存在但4個formal target modules缺失 | 批准Production settlement/manual/reversal/paid-bills作唯一owner與bundle test。 |
| `tenant-home.html` | Repository有binding redirect/month format；Candidate沒有 | 批准repository行為並完成binding/refresh/LIFF回歸。 |
| `tenant-bills.html` | Repository full-height；Candidate bottom-sheet | 實機結果決定promotion或rollback，不得自動選版。 |
| Trigger policy | Candidate沒有新增trigger；shared auto-reminder與Production相同 | 確認trigger inventory與「不得因merge執行installer」政策。 |
| Validator strategy | Phase 0 raw baseline為`.js`／`程式碼.js`，existing validator只認`.gs`／`Code.gs` | 決定先支援raw baseline或normalization後切換；另案修改。 |
| Candidate retention | Candidate只具provenance/rollback價值 | 決定read-only archive、hash與retention policy。 |

## Phase 1 acceptance result

| Gate | Result |
|---|---|
| Production source modified | NO |
| Candidate source modified | NO |
| Repository HTML modified | NO |
| Candidate functionality imported | NO |
| Merge created | NO |
| Route/Sheet/trigger/runtime changed | NO |
| Commit/push/deploy/clasp executed | NO |
| Phase 1 documents created | YES — 28, 29, 30 |

## 本輪變更邊界

本輪只新增：

```text
docs/28-CANDIDATE-GAP-REPORT.md
docs/29-CANDIDATE-MERGE-MAP.md
docs/30-PHASE1-SUMMARY.md
```

開始Phase 1前工作樹已存在Phase 0尚未提交的`.gitignore`、`apps-script/`與`docs/27-PRODUCTION-BASELINE-IMPORT.md`；本輪未修改這些既有Phase 0內容。沒有修改任何Production／Candidate程式、HTML、Sheet、trigger、LINE設定、deployment或route，也沒有commit、push、deploy或clasp操作。
