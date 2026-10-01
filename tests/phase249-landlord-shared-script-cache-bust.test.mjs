import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const releaseVersion = '20260911-landlord-checkout-quick-closeout-v1';
const releaseSource = readFileSync(new URL('frontend-release.js', root), 'utf8');

assert.match(
  releaseSource,
  new RegExp(`CMWEBS_RELEASE_VERSION\\s*=\\s*'${releaseVersion}'`),
  'the shared frontend release marker must advance with the bridge repair'
);

const landlordPages = [
  'landlord-activity.html',
  'landlord-announcements.html',
  'landlord-arrears.html',
  'landlord-bill-notifications.html',
  'landlord-billing.html',
  'landlord-contract-requests.html',
  'landlord-entry.html',
  'landlord-home.html',
  'landlord-join.html',
  'landlord-line-logs.html',
  'landlord-messages.html',
  'landlord-more.html',
  'landlord-notifications.html',
  'landlord-onboarding.html',
  'landlord-paid-bills.html',
  'landlord-payment-report-review.html',
  'landlord-payment-reports.html',
  'landlord-properties.html',
  'landlord-register.html',
  'landlord-revenue-dashboard.html',
  'landlord-settings.html',
  'landlord-team.html',
  'landlord-tenant-checkin.html',
  'landlord-tenant-checkout.html',
  'landlord-tenant-create.html',
  'landlord-tenant-detail.html',
  'landlord-tenants.html',
  'landlord-workspaces.html'
];

for (const filename of landlordPages) {
  const source = readFileSync(new URL(filename, root), 'utf8');
  assert.match(
    source,
    new RegExp(`<script src="frontend-release\\.js\\?v=${releaseVersion}"><\\/script>`),
    `${filename} must load the current versioned frontend release`
  );

  if (source.includes('landlord-auth.js')) {
    assert.match(
      source,
      new RegExp(`<script src="landlord-auth\\.js\\?v=${releaseVersion}"><\\/script>`),
      `${filename} must not reuse a cached landlord auth bridge`
    );
  }

  if (source.includes('landlord-api.js')) {
    assert.match(
      source,
      new RegExp(`<script src="landlord-api\\.js\\?v=${releaseVersion}"><\\/script>`),
      `${filename} must not reuse a cached landlord API client`
    );
  }
}

console.log('Phase 249 landlord shared-script cache-bust tests passed.');
