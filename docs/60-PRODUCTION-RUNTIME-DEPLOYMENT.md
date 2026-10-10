# Phase 60 — Production Runtime Deployment

Deployed at: 2026-07-21T01:12:31+08:00  
Branch: `chore/v2-production-consolidation`  
Status: **DEPLOYED AND ENDPOINT VERIFIED**

## Source gate

- source tree: `release/phase54/apps-script/`;
- source files: 30;
- Phase 59 SHA-256 verification: PASS, 30/30;
- production binding fingerprint: MATCH;
- excluded test, repair and legacy import modules: absent;
- pre-deployment serving version: 73.

## Version creation

Created immutable Apps Script version:

```text
74 — Phase 60 canonical production runtime 2026-07-21
```

Version 73 remains unchanged and available as the primary rollback target.

## Deployment update

Only the existing production Web App deployment was updated.

| Field | Result |
|---|---|
| Deployment name | `CMWebs金流中繼站` |
| Masked deployment token | `AKfycb…X6Og` |
| Previous deployment version | 73 |
| Current deployment version | **74** |
| Existing endpoint preserved | Yes |
| New deployment created | No |
| Web App URL changed | No |

Clasp response:

```text
Deployed AKfycb…X6Og @74
```

## Endpoint verification

A read-only request to `tenant_binding_status` without a LINE UID was used. The
handler returns before Sheet access or logging when the UID is absent.

- HTTP status: 200;
- final serving host: `script.googleusercontent.com`;
- endpoint status: AVAILABLE;
- deployment metadata: `AKfycb…X6Og @74`;
- immutable version 74: present;
- rollback version 73: present.

No complete Web App URL, Script ID or credential is recorded here.

## Rollback

If version 74 produces a P0 or P1 regression:

1. open the verified production Script project;
2. select **Deploy → Manage deployments**;
3. select the existing `CMWebs金流中繼站` deployment;
4. edit that deployment and select immutable version **73**;
5. preserve the same deployment ID and Web App URL;
6. verify the endpoint and run the narrow read-only Tenant smoke tests.

Do not create a new Web App deployment during rollback.

## No-unrelated-change declaration

Phase 60 did not modify runtime source, Google Sheets, LINE configuration,
Script Properties, LIFF configuration or unrelated Apps Script settings. It
created version 74 and updated only the existing Web App deployment. No Git
commit or push was performed.
