# 交接文件索引

| 文件 | 用途 |
|---|---|
| `01-PROJECT-STATE.md` | 現況、完成度與已完成模組 |
| `02-ARCHITECTURE.md` | 系統架構與資料流 |
| `03-CONFIGURATION.md` | URL、LIFF、測試 UID 與環境規則 |
| `04-API-ROUTES.md` | 68 個 V2 API 路由 |
| `05-DATA-MODEL.md` | Google Sheets、主鍵與資料關聯 |
| `06-BUSINESS-RULES.md` | 不可破壞的租管規則 |
| `07-FRONTEND-MAP.md` | 房東端與房客端頁面地圖 |
| `08-DEPLOYMENT-RUNBOOK.md` | GitHub Pages 與 Apps Script 部署 |
| `09-TEST-MATRIX.md` | V2 回歸測試與驗收 |
| `10-KNOWN-ISSUES.md` | 風險、版本分裂與技術債 |
| `11-ARCHITECTURE-DECISIONS.md` | 已確定的產品與技術決策 |
| `12-ROADMAP-V2-V4.md` | V2、V3、V4 邊界與優先序 |
| `13-REPORTING-SPEC.md` | V2 圖形化報表需求 |
| `14-MAINTENANCE-WORK-ORDER-SPEC.md` | V2 報修工單需求 |
| `15-PRODUCTION-RECONCILIATION.md` | 正式版本整併程序 |
| `16-CODEX-FIRST-TASK.md` | Codex 第一個任務與驗收標準 |
| `17-MOVE-OUT-DEPOSIT-SPEC.md` | V2 退租與押金結算需求 |
| `18-SECURITY-AND-SECRETS.md` | 安全、敏感資料與金鑰規則 |
| `19-CHANGELOG-CURRENT.md` | 已完成階段摘要 |
| `20-TEST-FUNCTIONS-GENERATED.md` | 候選模組內的 Apps Script 測試函式 |
| `21-CODEX-PROMPT.md` | 可直接貼給 Codex 的首輪指令 |

## 權威產品記憶與新對話 Resume Block

在任何 CMWebs 任務前，必須先讀取下列權威文件：

| 文件 | 用途 |
|---|---|
| `CMWEBS_PRODUCT_ROADMAP.md` | V2.0、V2.1、V3、V4 的產品邊界與順序 |
| `CMWEBS_CURRENT_STATE.md` | 最後驗證的 Production 基線、下一階段與工作邊界 |
| `CMWEBS_ARCHITECTURE_DECISIONS.md` | BYO LINE OA、標準化與 V2 feature freeze 決策 |
| `CMWEBS_RELEASE_RULES.md` | Production 安全與 release/rollback 規則 |
| `CMWEBS_CHANGELOG.md` | 精簡產品決策與 release 記憶 |

可貼到新 ChatGPT/Codex 對話的最小交接：

```text
PROJECT: CMWebs 智能租管
REPOSITORY: cmwebs-liff
Read AGENTS.md and the authoritative CMWEBS_PRODUCT_ROADMAP,
CMWEBS_CURRENT_STATE, CMWEBS_ARCHITECTURE_DECISIONS, and
CMWEBS_RELEASE_RULES before any task.

Current product state: V2.0 is the internal Production baseline. V2.1 is the
next bounded internal-operations phase, gated by Production Consolidation/Gate
0 and separate authorization. After V2.1, V2_FEATURE_FREEZE = FINAL.
Classify the request V2.0/V2.1/V3/V4; state Production impact and recommend a
Codex model and speed before execution.
```
