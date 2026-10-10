# CMWebs Project Execution & Handoff Record

## 2026-09-15 最新正式來源指引（優先於以下歷史快照）

使用者授權直接完成整併交付。PR #164 已合併至 GitHub main，merge commit `6a203d9aba611ad52509c3cfff628804b95e99ed`。本根目錄仍為舊分支的混合 WIP；**不要依本根目錄 HTML 的舊 API URL 判定正式服務版本，也不要重新執行已完成的歷史 Gate 0 工作。**

- 正式來源為最新 `origin/main`；本次隔離工作目錄：`/Users/hans/CMWebs/cmwebs-liff/.worktrees/production-consolidation-delivery-20260915`。
- 正式公開網站引用 Apps Script Version **187**，唯讀匯出 56 檔與 `main` 完全一致；Version 160 是同一專案的舊部署，並非現行公開網站端點。
- 已核對正式容器 Google Sheet 的 76 個工作表 metadata 及第一列欄名；未讀取業務資料列。216 項既有測試、來源檢查及 11 個公開資產比對通過。
- 請先讀該 worktree 的 `docs/PRODUCTION-DELIVERY.md`、`docs/production-baseline.json`、`docs/production-schema-snapshot.json` 與最新 `docs/CMWEBS_CODEX_HANDOFF.md`；所有即時版本在下一次部署前仍須刷新。
- 本次沒有發布新 Apps Script 版本或建立雲端專案。報修工單功能尚未實作；現有訊息表缺少 `contract_id`，不得把前房客訊息按房間提供給新房客。
- 此段為唯一有意新增的根目錄交接註記，保留其他既有 WIP。根目錄不 stage／commit／push；正式交付變更已透過隔離分支合併。

> **Status:** active repository handoff record.
>
> **Last reconciled:** 2026-08-11 (Asia/Taipei), by a read-only repository
> inspection followed by this documentation-only update. No source code, Apps
> Script project, UI, configuration, Production data, deployment, Git remote,
> or LINE resource was changed.
>
> **Authority boundary:** this is an execution ledger, not Production-release
> evidence. It does not supersede the authoritative product documents:
> `CMWEBS_PRODUCT_ROADMAP.md`, `CMWEBS_CURRENT_STATE.md`,
> `CMWEBS_ARCHITECTURE_DECISIONS.md`, `CMWEBS_RELEASE_RULES.md`, and
> `CMWEBS_CHANGELOG.md`. When records disagree, this document records the
> discrepancy and required reconciliation; it does not choose a winner without
> current repository or authenticated Production evidence.

## 1. Immediate Status

| Item | Verified state |
| --- | --- |
| Product baseline | V2.0 internal Production baseline |
| Current engineering milestone | **Production Consolidation / Gate 0** |
| V2.1 status | Defined but **not authorized to implement** until Gate 0 is complete and a separate work package is approved |
| Current branch | `codex/cmwebs-project-autopilot` |
| HEAD | `b9ef39c9189c9dc38307d18929c75c06263f6f30` — `docs: define CMWebs V2.1 and update V3-V4 roadmap` |
| Staged changes | None observed |
| Root worktree | Dirty, mixed, and not suitable for a release, deployment, or unscoped continuation |
| Production identity reconciliation | Blocked / explicitly not in scope for this handoff-only task |

## 2. What This Handoff Completed

This handoff session completed only the following read-only and documentation
work:

1. Read `AGENTS.md`, this execution record, `docs/00-HANDOFF-INDEX.md`, and
   the five authoritative product-memory documents.
2. Re-ran repository inspection: `git status --short`, branch, HEAD,
   `git log -10 --oneline`, unstaged/staged diff checks, untracked-file count,
   and `git worktree list`.
3. Reconciled the previous record's dirty-tree counts against current Git
   output and recorded the discrepancy below.
4. Updated this Markdown record only. No validation, Apps Script test,
   external API, browser, `clasp`, Git fetch/push, deployment, or Production
   action was run in this handoff session.

### Close-of-day verification

At close, `npm run validate`, all four available `tests/*.test.mjs` files, and
`git diff --check` were re-run. They all passed. This validates the current
dirty checkout's static/evidence checks only; it is not a release conclusion
and does not prove current Production identity or runtime behavior.

## 3. Current Working Tree — Preserve, Do Not Classify as a Release

### Tracked changes

Current Git output shows **39 modified tracked paths**, with no staged paths.
`git diff --numstat` totals **+5,275 / -769**. The current-state addendum
added one tracked documentation path after the earlier 38-path snapshot.

The modified files include `.gitignore`, `AGENTS.md`, 30 Apps Script files,
two existing documentation files, and four tenant HTML pages. The modifications
cover runtime, billing, payment, tenant, workspace, and UI behavior. They have
no single reviewed manifest, commit, or authorized release scope.

`AGENTS.md` accounts for a known handoff-only addition (+8 lines). All other
tracked changes remain an **unclassified aggregate**. Do not infer that they
are complete, mutually compatible, tested together, or safe to deploy.

### Untracked changes

Current Git output shows **118 untracked files**. The observed top-level
distribution includes release artifacts, documents, local agent metadata,
candidate runtime files, tests, and tools; the exact list is the output of
`git ls-files --others --exclude-standard` at close.

| Location | Count | Interpretation |
| --- | ---: | --- |
| `release/`, `docs/`, `release-manifests/`, `.agents/`, `apps-script/`, `tests/`, `tools/` | present | Release, historical, runtime, test, and local tooling artifacts; ownership and applicability not established |

The earlier audit counted **116 untracked entries**. The two additional
untracked handoff files are `docs/EXECUTION_RECORD.md` and
`docs/project-memory/worklogs/2026-08-11.md`; the close count of 118 is
consistent with those additions. Their source, author, review status, and
deployment relevance remain separate from the unclassified aggregate.

### Reconciliation result

The earlier ledger reported 37 modified tracked paths and `+5,249/-769` before
its own `AGENTS.md` handoff-only edit. The current 39 paths and `+5,275/-769`
account for the +8-line `AGENTS.md` addition and the current-state addendum.
The untracked count is also reconciled by the two new handoff files. None of
this makes the root a coherent release work package.

### Worktree metadata

`git worktree list` shows the root checkout plus many `/private/tmp` entries
marked `prunable`. Do not prune, repair, delete, or reuse these worktrees as
cleanup during ordinary work; their provenance has not been confirmed.

## 4. Milestone and Work-State Assessment

### Completed / established

- The authoritative product boundary remains V2.0 baseline → gated V2.1 → V3
  → V4. No V3/V4 work may be introduced into V2.
- Production Consolidation / Gate 0 remains the sole current engineering
  milestone.
- The root repository has sufficient evidence to state that its dirty aggregate
  must be preserved and isolated from any future narrow work package.
- Historical documents record Apps Script Version 82 serving and Version 81 as
  rollback on 2026-07-25, but they explicitly require fresh authenticated
  verification before any current Production conclusion.

### Not complete / not confirmed

- GitHub `main` has not been freshly fetched or reconciled in this session.
- The actual Spreadsheet-linked Apps Script project, Web App deployment,
  serving version, rollback version, GitHub Pages revision, Script Properties,
  triggers, and Production Sheet schema were not inspected in this session.
- The mixed root source, candidate tests, runtime files, release artifacts, and
  operational documents have not been assigned a common provenance or review
  scope.
- Chat-reported later releases, PRs, LIFF fixes, payment corrections, pending
  badges, and production results are not confirmed merely by their presence in
  local artifacts.
- Gate 0 is not evidenced as complete; V2.1 implementation remains prohibited
  without separate authorization.

## 5. Blockers and Risks

1. **Dirty-root provenance blocker:** 38 modified tracked paths and 294
   untracked files are not a single accountable work package.
2. **Handoff-count discrepancy:** the previous untracked count is stale by at
   least 177 entries after accounting for this record.
3. **Production-identity blocker:** no current authenticated source/project/
   deployment fingerprint has been recorded for this checkout.
4. **Release-evidence risk:** historical Apps Script versions and Pages commits
   are not evidence of the currently serving deployment.
5. **Worktree risk:** prunable temporary worktrees must not be cleaned up or
   assumed to be authoritative.

## 6. Production and Deployment State

| Surface | Evidence-backed state | Confidence / constraint |
| --- | --- | --- |
| Apps Script serving / rollback | Historical docs: Version 82 / Version 81 as of 2026-07-25 | Historical only; current status unknown |
| Apps Script project/deployment identity | Not inspected in this session | BLOCKED / unknown |
| GitHub Pages current revision | Not inspected in this session | Unknown |
| Spreadsheet schema, Properties, triggers, LINE state | Not inspected in this session | Unknown |
| Root source tree | Dirty mixed aggregate | Never deploy from it |

No deployment, Apps Script push, GitHub Pages publish, Git push, rollback,
Production data write, Script Property change, trigger change, LINE action, or
payment action is authorized or was performed by this handoff task.

## 7. Do Not Touch

- Do **not** deploy, redeploy, publish, push, rollback, migrate, or modify the
  existing Apps Script / GitHub Pages release surfaces.
- Do **not** modify Production Sheets, Properties, triggers, credentials, LINE
  configuration, users, payments, or bank information.
- Do **not** stage, commit, amend, discard, rebase, reset, or otherwise
  normalize the mixed root aggregate.
- Do **not** delete untracked files or prune `/private/tmp` worktree metadata.
- Do **not** treat `test=1` as a dry-run or use any test identity to send LINE
  messages.
- Do **not** start V2.1 feature work, nor add V3/V4 work to V2.
- Do **not** use historic documentation or chat history as proof of current
  Production state.

## 8. Correct First Step for the Next Agent

Unless the user explicitly authorizes a different, bounded task, the next
Agent's first step is **not implementation**. It must:

1. State the recommended model and speed (`gpt-5.6-terra`, `medium` by
   default).
2. Read `AGENTS.md`, this record, `docs/00-HANDOFF-INDEX.md`, and the five
   authoritative product-memory documents named below.
3. Re-run `git status --short`, branch, HEAD, `git log --oneline -20`,
   `git diff --stat`, `git diff --staged --stat`, untracked-file inspection,
   and `git worktree list`.
4. Stop and report if the dirty-tree count or identity of the aggregate has
   changed, unless the user explicitly asks for a narrow reconciliation task.
5. Preserve the root tree. Any later approved code work starts only in a clean,
   isolated worktree from a known ref after scope and authorization are clear.

Production identity reconciliation is a future read-only candidate work
package only when explicitly authorized. It is not authorized by this handoff
record.

## 9. Required Reading for a New Conversation

Read in this order before classifying, implementing, testing for release, or
making any Production-related conclusion:

1. `AGENTS.md`
2. `docs/EXECUTION_RECORD.md`
3. `docs/00-HANDOFF-INDEX.md`
4. `docs/CMWEBS_PRODUCT_ROADMAP.md`
5. `docs/CMWEBS_CURRENT_STATE.md`
6. `docs/CMWEBS_ARCHITECTURE_DECISIONS.md`
7. `docs/CMWEBS_RELEASE_RULES.md`
8. `docs/CMWEBS_CHANGELOG.md`

These documents provide sufficient context to resume safely after this chat is
lost: they identify the product boundary, current milestone, repository state,
known discrepancies, authority limits, and safe first step. They do not make
the root worktree release-ready or replace a fresh Git and Production check.

## Close-of-day update — 2026-08-11

- Objective: pause implementation and preserve a durable, evidence-based
  handoff.
- Completed: read the governing instructions and authoritative product-memory
  set; reconciled branch, HEAD, dirty-tree counts, untracked inventory, and
  validation results; no source or Production action was taken.
- Current state: branch `codex/cmwebs-project-autopilot`, HEAD `b9ef39c`; 39
  modified tracked paths, no staged paths, and 118 untracked entries at close.
- Verification: `npm run validate` PASS; four available evidence tests PASS;
  `git diff --check` PASS. No deployment, push, commit, or external check was
  performed.
- Next start: follow the read-only Production identity reconciliation package
  in Section 8 after explicit authorization. Preserve the root aggregate.
