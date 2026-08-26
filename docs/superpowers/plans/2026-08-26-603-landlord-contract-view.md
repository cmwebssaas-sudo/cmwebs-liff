# 603 房東端新租約查看修復計畫

## Scope

V2.0 Production blocker / correctness repair candidate only. Do not deploy,
push, merge, or modify Production data/configuration in this work unit.

## Design

1. Preserve the existing native landlord review queue and make the signed
   contract preview complete by forwarding the server-produced signature image
   into the authenticated review read model and rendering it beside the fixed
   template content.
2. Preserve the legacy request page when the optional native review API fails,
   but surface the failure inline so a missing backend route cannot be mistaken
   for an empty queue.
3. Align the tenant-detail contract-document frontend with the Apps Script
   document-management handlers already present in the user-owned aggregate,
   importing only the reviewed route/module implementation into this isolated
   candidate and recording the route in the API inventory.

## Verification

- Add focused regression tests before production edits and confirm they fail on
  the pre-fix source.
- Run the focused Node tests, all available affected Apps Script tests, JavaScript
  syntax checks, route/handler validation if available, and `git diff --check`.
- Record that real authenticated LINE/mobile room-603 UAT and any release remain
  `HUMAN_REQUIRED` until separately authorized and observed.
