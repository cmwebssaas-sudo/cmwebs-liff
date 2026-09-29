# Contract Conditions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 房東在新租約與續約填寫的補充條件會成為房客實際預覽、簽署的文件內容。

**Architecture:** 表單輸入先以 `note` 傳送，但只有新建立時寫入既有 `terms_snapshot_json.cmwebs_contract_conditions_v1`、並綁定本次 `contract_id` 的文字才進入合約。簡易新約補上表單輸入，續約不繼承舊備註；固定範本預覽及簽署版共用條件插入規則。無 Sheet schema 或外部範本變更。

**Tech Stack:** 靜態 HTML、Apps Script JavaScript、Node `node:test`。

**Spec:** [2026-09-30-contract-conditions.md](../specs/2026-09-30-contract-conditions.md)

## Global Constraints

- 只改隔離 feature branch；不改混雜根目錄或 Production。
- 補充條件選填、最多 500 字；空白不追加，已存在 `{{備註}}` 時不重複。
- 本機驗證須含受影響測試、`npm test`、`npm run validate`、`git diff --check`。

## Review Focus

- 無佔位符的正式範本：條件仍在簽名前出現。
- 已有 `{{備註}}` 的範本：條件只出現一次。
- 空白條件：不產生空的額外條款。
- 超過 500 字的直接 API 請求：後端拒絕。
- 新約／續約：都使用共用欄位，不覆蓋舊合約。
- 歷史 `note` 不進入合約；前版條件不繼承；無簽名前插入點時拒絕，不能附在簽名後。

---

### Task 1: 表單與後端資料入口

**Files:** `landlord-tenant-create.html`, `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`, `tests/contract-conditions.test.mjs`

**Interfaces:** 沿用 `submitCreate().note` 與 `landlordInitiatedContractNormalizeInput_().data.note`。

- [ ] 寫執行真實表單 render 與後端 normalize 的失敗測試：簡易新約可輸入；續約保留輸入；501 字拒絕。
- [ ] 執行 `node --test tests/contract-conditions.test.mjs`，確認只因功能缺少而失敗。
- [ ] 在簡易新約補選填欄位，續約文案說明會入約；後端限制 500 字。
- [ ] 重跑該測試，確認通過。

### Task 2: 固定範本的預覽與簽署版

**Files:** `apps-script/V2_CONTRACT_DOCUMENT_SIGNING.js`, `tests/contract-conditions.test.mjs`

**Interfaces:** 預覽 `tenantContractDocumentBuildPreviewText_`；簽署版 `tenantContractDocumentMaterialize_`。

- [ ] 寫失敗測試：有／無 `{{備註}}`、空白、同一條件在預覽與簽署版皆出現且不重複。
- [ ] 執行該測試確認 RED。
- [ ] 以同一條件格式器修正預覽與複製後的文件，保留原範本不變。
- [ ] 重跑測試確認 GREEN。

### Task 3: 文件與總驗證

**Files:** `docs/09-TEST-MATRIX.md`

- [ ] 記錄新／續約備註、預覽、簽署版回歸範圍與 Production 尚未驗收。
- [ ] 執行 `npm test`、`npm run validate`、`git diff --check`；檢視範圍 diff 並報告發布及 rollback 邊界。
