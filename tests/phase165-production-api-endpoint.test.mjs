import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PRODUCTION_DEPLOYMENT_ID =
  'AKfycbwnnuIFZ22eO6MxMnWOYHovgMT2xuTbcIgzbq4qmxXE3gjGoTJFcBGXlsNDS-lqr3EILQ';
const LEGACY_DEPLOYMENT_ID =
  'AKfycby5n2iXv0z5Y99dpBATTkKHaF56bnHNZRdMmVh5aZKU8ciGa_Nc0vJzXaO120LT81X6Og';

const PAGES = [
  'landlord-contract-requests.html',
  'landlord-home.html',
  'landlord-more.html',
  'landlord-payment-report-review.html',
  'landlord-revenue-dashboard.html',
  'landlord-tenant-create.html',
  'tenant-contract.html'
];

test('production-facing pages use the active Apps Script deployment', () => {
  for (const page of PAGES) {
    const source = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.match(
      source,
      new RegExp(PRODUCTION_DEPLOYMENT_ID),
      `${page} must point to the active production deployment`
    );
    assert.doesNotMatch(
      source,
      new RegExp(LEGACY_DEPLOYMENT_ID),
      `${page} must not point to the retired deployment`
    );
  }
});
