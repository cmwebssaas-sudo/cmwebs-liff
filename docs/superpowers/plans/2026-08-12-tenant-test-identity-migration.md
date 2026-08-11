# 房客測試身份遷移 Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除四個房客公開 HTML 頁面中的 page-local LINE UID，保留正式 LIFF 身份流程，並讓 `test=1` 測試請求由 Apps Script 的 `TEST_TENANT_LINE_UID` Script Property 解析身份。

**Architecture:** 前端測試模式維持空的 `LINE_USER_ID`，所有相關 tenant JSONP 請求只附加 `test=1`；既有 Apps Script dispatcher 在 tenant route 上以 Script Property 補上測試身份。正式模式維持原本的 LIFF `profile.userId` 流程。付款回報頁保留 Phase 146 的 `tenant-bind.html` gateway 與 `bill_id`/`next` 導向。

**Tech Stack:** 靜態 HTML/JavaScript、LINE LIFF、Apps Script JSONP API、Node.js built-in test runner、npm validation scripts、GitHub Pages（本計畫不部署）。

## Global Constraints

- 先在實作 worktree 重新執行 `git status --short --branch`、確認目前 branch/HEAD/diff/未追蹤檔案，再建立新的 `codex/tenant-test-identity-147` feature branch；不得在混合 dirty root 直接疊加或部署。
- 本工作單元只修改下列四頁及回歸測試／既有驗證文件；不修改 Apps Script、Google Sheets、Script Properties、付款資料或正式租客資料。
- 不新增 UID、LIFF ID、API URL、runtime secret 或任何 suffix 版本檔名；不把 `TEST_TENANT_LINE_UID` 搬到公開 HTML。
- 不改正式模式的 LIFF 初始化、登入、profile 取得、Workspace／tenant 權限流程；不改 Phase 146 的付款回報登入 gateway。
- `test=1` 只能在測試模式加入 JSONP URL；正式請求的 query contract 不增加測試參數。
- 所有測試與文件修改完成後，才可另行評估 GitHub Pages 部署；本計畫不執行 `clasp`、Pages deploy 或 production write。

## File Map

- Modify `tenant-payment-report.html`: 移除 page-local UID、保留空測試身份、在 `jsonpRequest` 附加測試旗標、保留 `tenant-bind.html` gateway。
- Modify `tenant-contract.html`: 移除 page-local UID、放寬測試模式的空身份 guard、在主 `callApi` 與三個簽署／附件狀態 JSONP 呼叫附加測試旗標。
- Modify `tenant-renewal.html`: 移除 page-local UID、放寬測試模式的空身份 guard、在 `callApi` 附加測試旗標。
- Modify `tenant-termination.html`: 移除 page-local UID、放寬測試模式的空身份 guard、在 `callApi` 附加測試旗標。
- Create `tests/phase147-tenant-test-identity-migration.test.mjs`: 逐頁執行 source-level regression checks。
- Modify the current implementation worktree’s existing `docs/09-TEST-MATRIX.md`: 依既有格式加入 Phase 147 的測試與驗收證據；若該文件在實作 worktree 尚未存在，先以 repository 既有測試矩陣格式建立，不能只留下聊天紀錄。
- Modify `docs/project-memory/worklogs/2026-08-12.md`: 記錄 Phase 147 的實作／驗證結果與「未修改 backend、未寫入 production、未部署」邊界。

## Task 0 — Implementation preflight and branch isolation

- [ ] 在目標實作 worktree 執行 `git status --short --branch`、`git branch --show-current`、`git rev-parse HEAD`、`git diff --stat`、`git ls-files --others --exclude-standard`，保存輸出並確認沒有把既有使用者變更當成此次範圍。
- [ ] 閱讀該 worktree 的 `docs/EXECUTION_RECORD.md`、`docs/00-HANDOFF-INDEX.md` 及 index 指向的 authoritative docs；確認基線仍是 V2.0 Production Consolidation / Gate 0，且 Apps Script production baseline 維持 Version 102。
- [ ] 從已驗證的 Phase 146 source baseline 建立 `codex/tenant-test-identity-147`，只在此 branch 修改本計畫列出的檔案；不要在 root aggregate branch 上直接 commit 或 deploy。

## Task 1 — Add the Phase 147 regression test first (RED)

- [ ] Create `tests/phase147-tenant-test-identity-migration.test.mjs` using Node built-ins only. Read exactly the four target HTML files and assert the following concrete contracts:

  ```js
  import assert from 'node:assert/strict';
  import { readFileSync } from 'node:fs';

  const pageNames = [
    'tenant-payment-report.html',
    'tenant-contract.html',
    'tenant-renewal.html',
    'tenant-termination.html'
  ];
  const sources = Object.fromEntries(
    pageNames.map((name) => [name, readFileSync(name, 'utf8')])
  );

  for (const [name, source] of Object.entries(sources)) {
    assert.doesNotMatch(
      source,
      /\bU[0-9a-fA-F]{32}\b/,
      `${name} must not expose a complete LINE UID`
    );
    assert.doesNotMatch(
      source,
      /TEST_LINE_USER_ID/,
      `${name} must not define the legacy page-local test UID`
    );
    assert.match(source, /TEST_MODE/);
    assert.match(source, /if\s*\(TEST_MODE\)[\s\S]*return\s+true\s*;/);
    assert.match(source, /liff\.init/);
    assert.match(source, /liff\.getProfile/);
    assert.match(source, /profile\.userId/);
  }

  for (const name of [
    'tenant-contract.html',
    'tenant-renewal.html',
    'tenant-termination.html'
  ]) {
    assert.match(
      sources[name],
      /if\s*\(\s*!LINE_USER_ID\s*&&\s*!TEST_MODE\s*\)/,
      `${name} must allow an empty browser UID only in test mode`
    );
  }

  assert.match(sources['tenant-payment-report.html'], /TENANT_LIFF_ENTRY_PAGE/);
  assert.match(sources['tenant-payment-report.html'], /tenant-bind\.html/);
  assert.match(sources['tenant-payment-report.html'], /next/);
  assert.match(sources['tenant-payment-report.html'], /bill_id/);
  ```

- [ ] Extend the same test with exact guarded test-flag counts: payment report, renewal, and termination each have one `url += '&test=1'` site; contract has four (the main `callApi` plus `callTenantSigningStatus`, `callTenantSigningSubmissionStatus`, and `tenantContractArtifactStatus`). Each append must occur inside an `if (TEST_MODE)` block, and the test must fail if any `test=1` literal is outside such a guard.

  ```js
  const expectedTestFlagCounts = {
    'tenant-payment-report.html': 1,
    'tenant-contract.html': 4,
    'tenant-renewal.html': 1,
    'tenant-termination.html': 1
  };
  const testFlagPattern = /url\s*\+=\s*['"]&test=1['"]\s*;/g;
  const guardedTestFlagPattern =
    /if\s*\(\s*TEST_MODE\s*\)\s*\{[\s\S]*?url\s*\+=\s*['"]&test=1['"]\s*;[\s\S]*?\}/g;

  for (const [name, expectedCount] of Object.entries(expectedTestFlagCounts)) {
    const source = sources[name];
    const totalCount = (source.match(testFlagPattern) || []).length;
    const guardedCount = (source.match(guardedTestFlagPattern) || []).length;
    assert.equal(totalCount, expectedCount, `${name} must set test=1 at every tenant JSONP boundary`);
    assert.equal(guardedCount, expectedCount, `${name} must guard every test=1 append with TEST_MODE`);
  }
  ```

- [ ] Run the focused test before implementation: `node --test tests/phase147-tenant-test-identity-migration.test.mjs`. Record the expected RED failure caused by the current `TEST_LINE_USER_ID` constants, UID assignment branches, missing empty-UID guards, and missing test query flags. Do not weaken the assertions to make the current code pass.

## Task 2 — Implement the smallest GREEN change

- [ ] In each target page remove only the `TEST_LINE_USER_ID` constant. Keep `let LINE_USER_ID = '';` unchanged so test mode has an intentionally empty browser identity.
- [ ] In each `initLineUserId()` change the test branch to the following exact behavior and leave the formal LIFF branch unchanged:

  ```js
  if (TEST_MODE) {
    return true;
  }
  ```

- [ ] In `tenant-payment-report.html`, add the guarded flag after the existing `params` loop and before `script.src = url` in `jsonpRequest`:

  ```js
  if (TEST_MODE) {
    url += '&test=1';
  }
  ```

  Preserve `TENANT_LIFF_ENTRY_PAGE`, `buildTenantLiffLoginRedirect_()`, `next`, `bill_id`, and the Phase 146 same-origin return logic unchanged.
- [ ] In `tenant-contract.html`, `tenant-renewal.html`, and `tenant-termination.html`, change the early guard from `if (!LINE_USER_ID)` to `if (!LINE_USER_ID && !TEST_MODE)`. In each page’s `callApi`, append the same guarded `&test=1` immediately after the existing parameter loop and before assigning `script.src`.
- [ ] In `tenant-contract.html`, convert each of the three direct tenant JSONP calls (`callTenantSigningStatus`, `callTenantSigningSubmissionStatus`, `tenantContractArtifactStatus`) to build a local `let url`, append `&test=1` only under `if (TEST_MODE)`, then assign `script.src = url`. Do not alter action names, request IDs, poll secrets, callbacks, signing payloads, or formal LIFF behavior.
- [ ] Run the focused Phase 147 test again and require GREEN. If a helper uses a different URL assembly shape than the planned pattern, first add a precise regression assertion for that shape, then make the smallest equivalent change; do not introduce a broad helper refactor.

## Task 3 — Update the repository evidence

- [ ] Update `docs/09-TEST-MATRIX.md` using its existing table/order. Add a Phase 147 entry stating that all four public tenant pages no longer contain a complete UID, test mode sends `test=1` with an empty browser identity, formal LIFF profile flow remains, and the Phase 146 payment gateway remains covered by regression tests.
- [ ] Append a dated entry to `docs/project-memory/worklogs/2026-08-12.md` recording the exact four files changed, the contract page’s four tenant JSONP flag sites, focused/full test commands, and the production boundary: no Apps Script/Sheets/Property mutation, no payment/contract/tenant write, no clasp deployment, no GitHub Pages deployment.
- [ ] Keep evidence tied to the implementation branch and current source baseline; do not copy old Version 90/V2.1 historical claims into the new entry, and do not stage unrelated root worktree changes.

## Task 4 — Full verification and handoff checkpoint

- [ ] Run `node --test tests/phase147-tenant-test-identity-migration.test.mjs` and confirm PASS.
- [ ] Run `node --test tests/*.test.mjs` and confirm the existing Phase 146 regression remains PASS.
- [ ] Run `npm run validate` from the implementation worktree where the repository’s package manifest is present. If the selected clean source checkout lacks `package.json`, stop and report that repository-state mismatch rather than silently substituting another command.
- [ ] Run `git diff --check`.
- [ ] Run a final public-source-style scan limited to the four files:

  ```sh
  rg -n '\\bU[0-9a-fA-F]{32}\\b|TEST_LINE_USER_ID' \
    tenant-payment-report.html tenant-contract.html \
    tenant-renewal.html tenant-termination.html
  ```

  Require no matches. Also inspect the diff to confirm no API URL, LIFF ID, action name, payload name, or Phase 146 gateway was changed.
- [ ] Review `git status`, `git diff --stat`, and `git diff --check`; stage only the four HTML pages, the Phase 147 test, and the two explicitly updated evidence documents. Create the commit `fix: move tenant test identity resolution to backend` only after all verification passes.
- [ ] Do not deploy in this plan. The later deployment checkpoint must separately re-scan the four public `main` HTML files and verify the GitHub Pages workflow before any user-facing rollout.

## Rollback and risk controls

- **Rollback:** revert the candidate GitHub Pages commit if a later deployment check fails; keep Apps Script production Version 102, Script Properties, Sheets, and all payment data untouched.
- **Empty-ID guard risk:** the three pages with `callApi` must reject missing IDs in formal mode but proceed in `TEST_MODE`; the Phase 147 test explicitly protects this distinction.
- **Direct signing JSONP risk:** contract signing status and artifact status are separate tenant requests; all three must carry the same guarded `test=1` flag or test mode can fail partway through the signing flow.
- **Formal-flow risk:** the static test preserves `liff.init`, `liff.getProfile`, `profile.userId`, and the payment report’s Phase 146 gateway; the diff review must confirm these were not altered.
- **Production boundary:** no workaround may reintroduce a page-local UID. If backend test resolution or any test-mode flow is incompatible with an empty browser UID, stop before deployment and report the incompatibility.
