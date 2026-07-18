# Production 版本整併

## 為什麼必須先做

目前程式歷史以大量完整修正版檔案累積，GitHub、Apps Script 與交接候選可能不同步。直接新增功能會再次把舊修正覆蓋。

## Gate 0 輸入

1. GitHub main 完整 clone
2. 實際 Apps Script 專案匯出
3. 本包 `candidate-overlay/`
4. 本包 `unresolved-candidates/`
5. Google Sheets Schema 匯出
6. Script Properties 名稱清單（不含 secret 值）

## 步驟

### A. 建立 baseline branch

```bash
git checkout -b chore/v2-production-consolidation
```

### B. 建立標準結構

第一階段可保留 GitHub Pages 根目錄 HTML，但 Apps Script 應納入 repository：

```text
apps-script/
  Code.gs
  V2_*.gs
public/ 或 repository root/
  *.html
docs/
scripts/
```

### C. 對帳每個 canonical 檔

以三方 diff：

```text
GitHub／repo
vs 實際部署 Apps Script
vs candidate-overlay
```

禁止依檔名猜版本。

### D. 解決未決模組

特別是：

- `V2_TENANT_LEASE_ONBOARDING`
    - `V2_TENANT_BINDING` 與電話同步修正版
- `V2_API`
- 缺少本地候選的前端頁
- `V2_payment_accounts` 與 `V2_workspace_payment_accounts`
- Workspace native 與 legacy view 的邊界

### E. 建立 Schema snapshot

對每張表輸出：

- sheet name
- headers
- row count
- max rows
- max columns
- estimated cells
- last modified approximation
- migration owner

### F. 執行驗證

```bash
npm run validate
```

再執行 `docs/09-TEST-MATRIX.md`。

### G. 標記 baseline

建議：

```text
v2.0.0-internal-beta.1
```

## Gate 0 完成標準

- 每個正式模組只有一個檔案
- 無 `_FIXED`／`_WITH_` 檔
- GitHub 與 Apps Script 可由同一 repository 重建
- 68 個 route 均有 handler
- Schema snapshot 已提交
- 核心流程回歸通過
- 有 rollback
