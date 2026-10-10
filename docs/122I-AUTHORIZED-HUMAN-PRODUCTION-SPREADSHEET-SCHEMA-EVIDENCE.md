# Phase 122I - Authorized Human Production Spreadsheet Schema Evidence

Date: 2026-07-23  
Status: **VERIFIED**  
Evidence type: **read-only production spreadsheet observation**

## Summary

This session verified the production Google Sheets workspace bound to the
`cmwebs.saas@gmail.com` account. The purpose of this phase is schema evidence
only. No spreadsheet values were edited, copied into a working file, or
persisted beyond schema notes.

## Read-only observations

### Spreadsheet identity

- Spreadsheet title: `CMWebs_租管系統大腦`
- Signed-in account shown by the Google Sheets UI: `cmwebs.saas@gmail.com`
- Observation method: interactive Google Sheets UI only
- Spreadsheet ID fingerprint: `1c1c92...3a22a6` (SHA-256; raw ID not retained)
- Identity verification: title/account match; not an immutable backup, rehearsal, or restore-test copy
- Verification timestamp: 2026-07-24 (Asia/Taipei)
- Source: authorized browser URL identity

### Visible sheet tabs

The following sheet tabs were visible during the read-only session:

- `0.系統身分綁定表`
- `0.建檔總表`
- `V2_landlord_home_view`
- `V2_landlord_arrears_view`
- `V2_landlord_tenant_list_view`

### Observed schema: `0.系統身分綁定表`

Visible header row fields:

- `LINE UID`
- `角色`
- `房東代碼`
- `房號`
- `真實姓名`
- `建案代碼`
- `合約狀態`
- `備註`
- `系統導航碼`
- `帳號狀態`

Observed result:

- The sheet contains operational identity-binding columns needed for role and
  account-state routing.
- The view was read-only. No cell value is reproduced in this report.

### Observed schema: `0.建檔總表`

Visible header row fields:

- `房東代號或品牌`
- `房東聯絡電話`
- `物件名稱`
- `房號`
- `租客姓名`
- `租客手機號碼`
- `每月租金`
- `初始電表度數`
- `每月管理費`
- `每度電費`
- `每度設備費`
- `合約到期日`

Observed result:

- The sheet contains master registration and billing-input columns for landlord,
  room, tenant, charge, and contract metadata.
- The view was read-only. No cell value is reproduced in this report.

## Result

- `PRODUCTION_SPREADSHEET_IDENTITY=VERIFIED`
- `PRODUCTION_SPREADSHEET_SCHEMA=VERIFIED`
- `PRODUCTION_SPREADSHEET_VALUES=NOT_CAPTURED`
- `PRODUCTION_SPREADSHEET_FINGERPRINT=VERIFIED` (masked SHA-256 only)

## Notes

- No spreadsheet data was edited.
- No export, import, or write-back action was performed.
- This report captures schema evidence only and does not change Production.
