import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

const notificationSource = readFileSync(
  'apps-script/V2_TENANT_PAYMENT_REPORTS.js',
  'utf8'
);
const reviewSource = readFileSync(
  'landlord-payment-report-review.html',
  'utf8'
);
const tenantSource = readFileSync(
  'landlord-payment-reports.html',
  'utf8'
);

assert.match(
  notificationSource,
  /action_url:\s*\n\s*'https:\/\/cmwebssaas-sudo\.github\.io\/cmwebs-liff\/landlord-payment-report-review\.html'/,
  'payment-report notifications must open the landlord review page'
);
assert.match(
  reviewSource,
  /const LIFF_ID = '2010314940-EjX1qbb8';/,
  'the notification destination must use the landlord LIFF app'
);
assert.match(
  reviewSource,
  /location\.replace\(buildLandlordEntryUrl\(\)\)/,
  'the landlord review page must enter through the landlord login gateway'
);
assert.match(
  tenantSource,
  /const LIFF_ID\s*=\s*\n\s*'2010314940-iJB1D6sN';/,
  'the tenant payment-report page must retain the tenant LIFF app'
);

for (const page of [
  'landlord-more.html',
  'landlord-arrears.html',
  'landlord-paid-bills.html'
]) {
  const source = readFileSync(resolve(ROOT, page), 'utf8');
  assert.match(source, /landlord-payment-report-review\.html/);
  assert.doesNotMatch(source, /landlord-payment-reports\.html/);
}

console.log('Phase 142 landlord payment-report notification destination tests passed.');
