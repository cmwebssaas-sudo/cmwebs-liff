# Postal Payment Review Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline.

**Goal:** 收到郵局入帳通知後自動配對並通知房東，確認後才銷帳。
**Architecture:** Gmail readonly intake persists Workspace-scoped receipts; the
existing payment-review page resolves them through authenticated POST routes.
Human confirmation creates a deterministic payment report and reuses settlement.
**Tech Stack:** Apps Script V8, Gmail REST, Google Sheets, plain HTML, Node VM tests.
**Spec:** ../specs/2026-10-09-postal-payment-review-design.md

## Global Constraints

- Isolation from mixed root; baseline origin/main 6af4b28; feature branch codex/.
- No automatic bill-paid writes; no live settings/migration/deploy/LINE actions.
- Secrets and real bank/customer samples never enter Git; synthetic fixtures only.
- Recheck Workspace, membership, payment permission and amounts on confirmation.

## Review Focus

- Forwarded or malformed messages never become an authoritative payment by themselves.
- Identical amount/time but distinct notification IDs remain distinct receipts.
- A learned payer must never fall back to another tenant's amount-only match.
- Settlement committed before receipt update must recover without duplicate payment.
- A failed notification or fetch must not make pending receipts disappear.

## Task 1: Intake and matching

**Files:** apps-script/V2_BANK_EMAIL_RECEIPTS.js, apps-script/appsscript.json,
tests/bank-email-receipts.runtime.test.mjs.
**Interfaces:** bankReceiptParsePostal_(subject, body); bankReceiptMatch_(receipt,
bills, links); runBankEmailReceiptIntake(); runBankEmailReceiptMigration().
- [x] Add synthetic parsing/matching, scope, duplicate and retry runtime tests.
- [x] Run tests RED, implement bounded Gmail readonly intake and persistent records.
- [x] Run tests GREEN, ensure no bill/payment mutations during intake.

## Task 2: Review and settlement

**Files:** same backend module, apps-script/程式碼.js,
landlord-payment-report-review.html, tests/bank-email-review.ui.test.mjs.
**Interfaces:** bankReceiptDispatch_(action, request); POST-only actions
landlord_bank_receipts_init and landlord_bank_receipt_confirm.
- [x] Add RED tests for authenticated scope, confirmation, changed amount, duplicate,
  interrupted settlement recovery, other款項 and rendered action behavior.
- [x] Implement deterministic report creation, existing settlement call outside lock,
  success-time payer linking and current readback; add compact review UI.
- [x] Run focused tests GREEN and verify mobile layout with synthetic browser preview.

## Task 3: Validation and delivery

**Files:** docs/04-API-ROUTES.md, docs/05-DATA-MODEL.md, docs/09-TEST-MATRIX.md,
docs/BANK-EMAIL-RECEIPTS.md, docs/CMWEBS_CURRENT_STATE.md.
- [x] Record source/config/OAuth/migration/trigger activation and rollback steps.
- [x] Run npm test, npm run validate, affected Apps Script test function locally,
  combined Apps Script and inline-script syntax checks and git diff --check.
- [x] Fresh whole-branch review, fix material findings and repeat affected checks.
- [x] Commit only in-scope files; report actual evidence and live activation gaps.

Execution note: the user explicitly approved this flow and requested implementation;
continue inline without repeating design/implementation permission requests.
Baseline: npm test 647/647 PASS, 2026-10-09; no staged or dirty files in worktree.


## Final local evidence (2026-10-09)

- Focused 30/30; full npm test 677/677 PASS (baseline 647/647).
- npm run validate PASS: 60 backend files; 38 recorded endpoint references;
  static release cache checks PASS. This is source validation, not serving proof.
- Combined 59 Apps Script JavaScript sources and inline HTML scripts parse;
  testBankEmailReceiptParser() executed in local VM: success/OK.
- Independent read-only review: all material findings addressed.
- Chrome synthetic390×844 preview: no horizontal overflow, bank buttons >=44px;
  matched confirmation and unmatched manual selection transition to settled.
- No Gmail/Google authorization, live email read, migration, trigger, LINE push,
  real payment, Git push or deployment executed.
- Bank module config includes a required mailbox_email verified against Gmail profile.
- Existing POST isolation fixtures include the new pre-dispatch helper definitions;
  no test permission expectation was weakened.
