# Vendor Work Orders Cloud

This directory is the isolated Cloudflare Worker deployment for the vendor
work-order service. It is separate from the CMWebs production Worker and the
existing No.88/Libenest services.

## Staging resources

- Worker: `vendor-work-orders-staging`
- D1: `vendor-work-orders-staging`
- R2: `vendor-work-orders-attachments-staging`
- Custom domain: `https://workorders-test.cmwebs.com`
- LINE Login channel ID: `2011937202`
- LINE Provider ID: `1631758156`

The channel secret is a Cloudflare Worker Secret. It is intentionally absent
from this repository and from all logs.

## Local checks

From the repository root:

```sh
node --test tests/vendor-work-orders-cloud*.test.mjs
npm run validate
```

To verify the bundle without publishing:

```sh
npx --yes wrangler@4.149.0 deploy --config _dev/vendor-work-orders-cloud/wrangler.jsonc \
  --dry-run --outdir _dev/vendor-work-orders-cloud/.wrangler-dry-run
```

## Deploy

The deployment script refuses production-looking resource names and refuses
secret environment variables:

```sh
node _dev/vendor-work-orders-cloud/scripts/deploy-cloud.mjs
```

All migrations are additive and must be applied remotely before the Worker
version is uploaded. Runtime queries do not create the schema. The script does not set `LINE_CHANNEL_SECRET`.

## Configure the isolated Login secret

After confirming the Worker URL, enter the secret interactively from the LINE
Developers console. Never paste it into Git, chat, shell history, or a log:

```sh
npx --yes wrangler@4.149.0 secret put LINE_CHANNEL_SECRET \
  --config _dev/vendor-work-orders-cloud/wrangler.jsonc
```

The secret is required for `/auth/line/start` and `/auth/line/callback`.
Webhook verification requires a separate `LINE_MESSAGING_SECRET`; never substitute the Login secret. Until it is set, `/api/line/status` reports
`login_ready: false` and notifications remain disabled.

## Production

The independent production service is <https://workorders.cmwebs.com>.
See [deployment evidence and rollback](../../docs/releases/vendor-work-orders-production-readiness.md).
Use the explicit production config, never repoint the staging database:

```sh
npx --yes wrangler@4.149.0 d1 migrations apply vendor-work-orders-production --remote \
  --config _dev/vendor-work-orders-cloud/wrangler.production.jsonc
npx --yes wrangler@4.149.0 deploy --config _dev/vendor-work-orders-cloud/wrangler.production.jsonc
```

`OWNER_ACTOR_ID` is a Worker Secret holding the hash of the explicitly verified owner identity;
`OWNER_WORKSPACE_ID` is the fixed workspace. Other users require approved partner membership.
No partners are seeded, no public administrator self-registration is provided, and LINE push remains disabled.
