# Phase 57 — Production Rollback Baseline

Date: 2026-07-20  
Branch: `chore/v2-production-consolidation`  
Decision: **ROLLBACK VERSION VERIFIED — CLASP PRODUCTION BINDING MISMATCH**

## Scope

Phase 57 identifies the Web App currently referenced by the repository
frontend, records its immutable current and previous versions, exports
non-secret production metadata, and verifies the local clasp binding.

No runtime code, clasp configuration, deployment, Google Sheet, LINE state or
Web App URL was changed.

## Verified production deployment

The Apps Script project list contains multiple projects named `綠界結帳`.
Project title was therefore not used as an ownership key. The production owner
was selected only after its complete Web App URL privately matched the single
endpoint used by all repository frontend pages.

| Field | Verified value |
|---|---|
| Project name | `綠界結帳` |
| Masked production Script ID | `1NAPtZ…MD0k` |
| Script ID SHA-256 | `601b2190f15a93eb5bbcbb1ade48922b1352825d32bb01add37c28ca1f8fa985` |
| Deployment name | `CMWebs金流中繼站` |
| Deployment type | Web App |
| Masked Deployment ID/token | `AKfycb…X6Og` |
| Deployment ID SHA-256 | `ebd02787d83c57d00096d95c3280254e609d051b5d1367da556871192105a390` |
| Web App host | `script.google.com` |
| Web App path | `/macros/s/{deployment}/exec` |
| Web App URL SHA-256 | `f0ae27c85160bb136bafd6a65cd104b06ef7fa5eea41ab0d88685ab350b20200` |
| Repository frontend URL match | Exact private match |
| Execute as | Deploying user |
| Access shown by UI | `所有人` |
| Current immutable version | **73** |
| Current version timestamp | 2026-07-18 04:35 Asia/Taipei |
| Previous version reference | **72** |
| Previous version timestamp | 2026-07-18 04:07 Asia/Taipei |

No complete Script ID, Deployment ID or Web App URL is duplicated in this
document. The masked identifiers plus SHA-256 fingerprints provide an exact
comparison record without publishing the identifiers.

## Immutable rollback record

The exported machine-readable record is:

```text
release/phase57/production-rollback-metadata.json
```

Its detached checksum is stored in:

```text
release/phase57/production-rollback-metadata.sha256
```

The immutable production baseline for a future release is version **73** on the
existing `AKfycb…X6Og` deployment. If a later version fails smoke testing, the
primary rollback action is to repoint that same deployment to version 73. The
pre-existing version 72 is retained as a secondary historical reference, not
the default post-release rollback target.

## Clasp binding verification

| Comparison | Result |
|---|---|
| `apps-script/.clasp.json` versus `_deployed/apps-script/.clasp.json` | Byte match |
| Local canonical masked Script ID | `1JmW2N…ihRJ` |
| Local canonical Script ID SHA-256 | `8be891f7be33c46ac63ead80efafd167cfb54da3e4a1ba348abd63d231925fb1` |
| Production masked Script ID | `1NAPtZ…MD0k` |
| Local clasp binding versus production owner | **MISMATCH** |

The existing local clasp binding is internally consistent with the historical
`_deployed` snapshot, but it does **not** target the Script project that owns the
serving frontend Web App deployment.

Consequences:

- do not run `clasp push` from `apps-script/` or the isolated release tree using
  the current binding;
- a push using that binding would update a non-serving project and would not
  update production;
- do not overwrite `.clasp.json` in this phase;
- production binding correction requires a separate, explicitly approved phase
  and a read-only source comparison against the newly identified owner first.

## Production metadata export

The JSON export records:

- capture time and read-only evidence source;
- masked and hashed project/deployment identifiers;
- deployment type, host and path type;
- frontend URL match result;
- execute-as and access categories;
- current version 73 and previous version 72;
- primary and secondary rollback references;
- canonical clasp binding mismatch;
- isolated release manifest path and file count;
- no-change safety flags.

It contains no full identifier, credential, Script Property value, LINE UID,
Sheet data or account email.

## Rollback procedure

### Primary rollback after a future release

1. Stop testing immediately when a release produces a P0 or P1 regression.
2. Open the verified production Script project identified by Script ID
   fingerprint `601b2190…fa985`.
3. Open **Deploy → Manage deployments**.
4. Select `CMWebs金流中繼站` and privately verify the deployment ID fingerprint
   `ebd02787…5a390` and exact frontend URL.
5. Choose **Edit** without creating a new deployment.
6. Select existing immutable version **73**.
7. Confirm the deployment update only under separate rollback authorization.
8. Verify the Web App URL and deployment ID did not change.
9. Run read-only Tenant Home, Bills and Message smoke tests.
10. Record the failed release version and evidence; do not repair Sheets or
    send LINE.

### Secondary fallback

Use version **72** only if version 73 itself is determined to be defective or
the operator intentionally needs the immediately preceding state. This requires
the same explicit rollback authorization and must preserve the existing Web App
URL.

## Release gate after Phase 57

| Gate | Result |
|---|---|
| Production deployment identified | PASS |
| Frontend URL matched | PASS |
| Current immutable version recorded | PASS — 73 |
| Previous version reference recorded | PASS — 72 |
| Immutable rollback metadata exported | PASS |
| Existing clasp binding targets production | **FAIL** |
| Safe to `clasp push` with current binding | **NO** |

The next phase must reconcile production source ownership and prepare a secure,
untracked production clasp binding. It must not push until the production source
has been exported read-only and compared with the isolated 30-file payload.

## Security observation

The production editor visibly contains credential-like hardcoded payment
configuration. No value was copied into the rollback record. Rotation and safe
property migration must be handled as a separate security action and must not
be combined with an unreviewed deployment.

## No-change declaration

Phase 57 did not modify runtime code, `.clasp.json`, Apps Script source,
deployment/version state, Google Sheets, LINE, Web App URL, LIFF configuration,
Git history or remote repository state. It did not run `clasp push` or deploy.
