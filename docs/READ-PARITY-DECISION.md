# C2 summary response decision — approved 2026-10-12

The plan requires identical Apps Script/Worker responses and excludes identity
documents, contract files and credentials from replication. Existing home action
initialization returns raw initiated-contract rows and contract-request terms;
the tenant-list response includes full contract history used by the tenant-detail
page. Rich source rows therefore cannot meet both requirements through the
approved replica fields. Empty synthetic fields would conceal this conflict.

Approved bounded amendment: add an explicit `read_view=summary` to only the home
bootstrap and tenant-list calls. Default calls retain their existing complete
response and stay on Apps Script, including tenant and contract detail pages.

| Explicit summary response | Fields retained | Frontend use |
| --- | --- | --- |
| Home action contract requests | Existing block/summary; request ID/status per item | Existing pending/approved summary counters |
| Home payment reports | Existing block/summary; report ID/status per item | Existing pending report count |
| Home messages | Existing block/summary; message ID/status per item | Existing message summary counters |
| Home initiated contracts | Existing block/summary; contract ID/status per item | Existing pending contract count |
| Tenant list | Existing tenant fields and all monetary totals; omit `contract_history` | List does not render history; detail still receives the full default GAS response |

Both GAS and Worker would apply the same reviewed summary projection. C4 would
pass the explicit view only from the six-page read path; requests without that
view remain on GAS. Snapshot identifiers and renderer code stay the same.
Zero-difference acceptance still applies to every field in the explicit summary
response, with rich prohibited fields present in the GAS oracle fixture and
absent from D1. Financial calculations, counts and ordering are unchanged.

The owner explicitly approved this amendment on2026-10-12. The rich synthetic
prototype compared actual GAS and whitelist-projected calculations: action and
tenant summaries matched exactly; the untouched default retained detail data.
Implementation remains local pending source/remote acceptance and review. This
decision does not authorize storing prohibited source fields in Cloudflare.

Rollback: remove the explicit view from the two frontend callers and return to
their existing GAS requests. The default detail APIs and authoritative Sheets
remain unchanged; do not delete source data or add a data migration.
