# CMWebs Product Changelog

This is a concise product-memory changelog. It links to detailed release and
validation evidence instead of duplicating it.

## 2026-07-27 — Authoritative V2–V4 product memory established

- Added the authoritative product roadmap and architecture decisions for V2,
  V3, and V4.
- Defined V2 as internal Production operations and consolidation only.
- Defined V3 as standardized multi-tenant SaaS with landlord-owned BYO LINE OA,
  dynamic Workspace/OA configuration, a central LINE Channel Registry, and no
  functional customization.
- Preserved V4's AI listing, video, social, and growth vision after the V3
  standardized platform foundation; added standardized Booking, Appointment,
  and CRM as V4A.
- Added the required new-conversation handoff and Codex model/speed declaration
  rule.

## 2026-07-25 — V2 operational-filter serving state (last verified)

- Apps Script Version 82 was verified as serving through the existing Web App
  deployment; Version 81 was retained for rollback.
- The synthetic room-603 termination request was retired and room 603 was
  removed from operational views while its historical room record was retained.
- Manual landlord UI verification recorded 18 managed rooms, 18 active tenants,
  15 paid tenants, 3 arrears tenants, and 0 pending contract requests.
- No GitHub Pages publication, Git push, Production Properties/trigger change,
  or LINE send was part of that backend update.

Re-verify this historical record before relying on it for a current Production
decision.

## 2026-07-24 — Controlled V2 Production release

- The existing Web App deployment was updated to immutable Apps Script Version
  76 after the approved release sequence.
- GitHub Pages successfully built the fast-forward release commit
  `2b62a07b34ebd28f94910220aa6b76d3342214ef`.
- Release evidence: [Phase 124 controlled release](124-CMWEBS-V2-CONTROLLED-PRODUCTION-RELEASE.md)
  and [machine-readable result](../release-manifests/cmwebs-v2-production-release-result.json).

## Earlier history

For feature evolution before this authoritative product-memory set, see
[19-CHANGELOG-CURRENT.md](19-CHANGELOG-CURRENT.md). For historical product
planning, see [12-ROADMAP-V2-V4.md](12-ROADMAP-V2-V4.md); it is superseded where
it conflicts with the authoritative roadmap.
