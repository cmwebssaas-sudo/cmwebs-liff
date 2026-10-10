# Phase 122C - Production Identity Evidence Reconciliation

Date: 2026-07-23T21:46:20+08:00

## Decision

```text
PRODUCTION_IDENTITY_RECONCILIATION: PARTIAL
LOCAL_CANONICAL_CANDIDATE: PRESENT
REMOTE_VERIFICATION: HUMAN_REQUIRED
```

Repository and readable Git-history evidence identify one unique local
candidate chain for the historical serving Production Apps Script project and
Web App deployment. This is not evidence that the same project or deployment
is still serving now. No Production system was opened, queried, or changed.

## Read-only coverage

- Worktree identity-reference files scanned: 20.
- Git commits scanned for identity references: 3.
- Historical paths carrying the candidate deployment fingerprint: 43 across all
  three readable commits.
- Full IDs, Property values, tokens, LINE UIDs, and personal data are omitted.

## Identity candidates

| Candidate | Script project fingerprint | Deployment fingerprint | Classification | Evidence result |
| --- | --- | --- | --- | --- |
| Historical serving Production candidate | Script `1NAPtZ...MD0k`; SHA-256 `601b2190f15a93eb5bbcbb1ade48922b1352825d32bb01add37c28ca1f8fa985` | Deployment `AKfycb...X6Og`; SHA-256 `ebd02787d83c57d00096d95c3280254e609d051b5d1367da556871192105a390` | `LOCAL_CANONICAL_CANDIDATE` | Unique local chain; remote confirmation required |
| Current local clasp binding | Script `1JmW2N...ihRJ`; SHA-256 `8be891f7be33c46ac63ead80efafd167cfb54da3e4a1ba348abd63d231925fb1` | Deployment `AKfycb...MdBJ`; SHA-256 `97f28cf71041e582582ea59f1af24507129f7dbdc5630c6af57e9ba33a570b3a` | `CONFLICTING` | Does not match the historical serving Production candidate |
| Staging binding | Script `1ZfX86...k23T`; SHA-256 `2be1ad2a31dbee871544ee51bff67131f7791d270c95dd7dcf546a21b4e3f354` | Deployment `AKfycb...LQ8g`; SHA-256 `2b94d0a5b091d33e7937b18a1a37be5c52e0663d438c7d0e0588cdd87aaadcdb` | `STAGING` | Explicit staging resource record |

Candidate count for the serving Production identity: **1**.
Conflicting serving-Production candidates: **0**.
Non-Production or non-serving identity records: **2**.

## Evidence chain for the local canonical candidate

| Source | Evidence | Classification and limitation |
| --- | --- | --- |
| `release/phase54/apps-script/.clasp.json` | Script fingerprint matches the historical serving Production fingerprint. Worktree content SHA-256: `e0b4aaa072474ea58ef4517d345c7596f64b4324721b1d71d701640e11e343eb`. | `HISTORICAL_ROLLBACK`; artifact binding only |
| `release/phase57/production-rollback-metadata.json` | Explicitly labels the same script and deployment fingerprints as Production, with historical version 73 and previous version 72. Content SHA-256: `73810c73cda4ddab1be8f8ec14c99dbf9146bcdfe2bb1ca7378b287b25e40de1`. | `HISTORICAL_ROLLBACK`; captured 2026-07-20, not current remote proof |
| `production-manifest.json` | Carries the same deployment fingerprint and Web App URL reference. It is present in Git commit `3c0ddc1c60cd3bcbdd2f723ba47852f1de159b54`; worktree content SHA-256: `71d51fbaccc2dd8dd10d4f5b8b1b038c942c7070fe38b82f27ccfd6d4897c0c2`. | Deployment continuity evidence; document itself is candidate-only |
| `docs/03-CONFIGURATION.md` and historical frontend blobs | Same deployment fingerprint appears in 43 historical paths, across commits `3c0ddc1c60cd3bcbdd2f723ba47852f1de159b54`, `498057271a2fac46e0f3fe1747215aaaf26a3b88`, and `8da55494d9f6f9fb2a3b57f5a3eba069ade7bd81`. The configuration blob is `f6d99bede9699b6dc1ace6136e4641f66e7bae94`. | Historical endpoint reference, not a serving-state query |
| `docs/58-ISOLATED-PRODUCTION-CLASP-BINDING.md` | Records the Phase 54 binding as the isolated Production target and requires a current serving-version confirmation. Content SHA-256: `aa0abf974f621e322913dcde16147d7cd06e98927dddc1c7ec8ec26f65aad99a`. | `HISTORICAL_ROLLBACK`; confirms the need for human remote verification |

## Why the current local binding is excluded

The current `apps-script/.clasp.json` script fingerprint differs from the
Phase 54/57 Production candidate. Its one read-only deployment inventory in
Phase 122B also has a different deployment fingerprint and reports `@HEAD`,
not an immutable serving version. It is therefore a conflicting local project,
not a Production-evidence source.

## Human read-only verification path

An authorized reviewer should use the actual serving Apps Script project and
compare the following values without changing anything:

1. **Project Settings -> Script ID**: compute SHA-256 of the displayed ID in a
   secure local tool and compare with
   `601b2190f15a93eb5bbcbb1ade48922b1352825d32bb01add37c28ca1f8fa985`.
2. **Deploy -> Manage deployments**: verify the Web App deployment ID SHA-256
   equals `ebd02787d83c57d00096d95c3280254e609d051b5d1367da556871192105a390`.
3. In that same deployment detail panel, record the current immutable version,
   execute-as category, access category, and a rollback version. Do not save or
   update the deployment.
4. Only after steps 1-3 match may the reviewer continue the presence-only
   Properties, triggers, Spreadsheet metadata, and hosting checks from Phase
   122B.

## Remaining limitations

- The candidate is supported by local historical records but no remote source
  was queried in this phase.
- Historical version references cannot establish the current serving version.
- The frontend endpoint reference proves repeated configuration use, not the
  current hosting revision or artifact SHA.
- This result does not authorize a clasp binding change, deployment, push,
  trigger operation, Property access, or Production write.
