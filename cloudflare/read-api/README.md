# CMWebs read API environment (C0)

This scaffold implements only `GET /health`. It checks the D1 binding with
`SELECT 1`, returns no operational data and never writes rows. Read APIs,
authentication and synchronization belong to C1–C3. No Worker, remote D1,
Secret, trigger or production page flag is created by C0.

## Local verification

Use Node.js 22 or later. From the repository root:

```sh
npm ci --prefix cloudflare/read-api
npm run test:worker
npm run dry-run:worker
npm run dev --prefix cloudflare/read-api
```

Miniflare runs the actual Worker with disposable local D1. Tests check healthy
reads, rejected methods, unknown paths, unchanged fixture rows and sanitized
database failures. Wrangler and its matching Miniflare runtime are pinned in
the lockfile. Compatibility date matches the bundled runtime's supported date.
CI runs these checks without a Cloudflare credential. Dry-run only writes local
bundle artifacts under ignored `.wrangler/`.

## Account and later deployment prerequisites

Account access and Workers Paid status must be verified before provisioning.
Any new subscription cost, owner login or payment needs the owner's action.
Use an account-scoped API token with Workers Scripts Edit and D1 Edit; never
put token values in configuration, Git, logs or PRs.

In C1, create the replica D1 with `--location=apac`, verify its returned account
and database identity, then replace the all-zero local `database_id`. APAC is
a placement hint rather than a guaranteed specific city. `workers_dev` and
preview URLs remain disabled until the reviewed endpoint is ready. No remote
binding is enabled in local development.

The committed config contains a local placeholder and is not a production
deployment configuration. Only dry-run is a C0 acceptance step. Before later
deployment, retain the existing Worker version/configuration (if any), export
the replica state, verify the target account and apply that work order's
reviewed migrations and configuration.

## Rollback

C0 rollback is a reviewed revert of its source and CI changes. It has no remote
runtime or business data to restore. Later work must record Worker version,
bindings and page flags separately. Google Sheets remains the authoritative
operational store.
