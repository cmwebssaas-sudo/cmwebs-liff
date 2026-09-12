import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const checkoutPage = readFileSync(new URL('../landlord-tenant-checkout.html', import.meta.url), 'utf8');

assert.match(
  checkoutPage,
  /\.checkout-shell\s+input,\s*\.checkout-shell\s+textarea,\s*\.checkout-shell\s+select\s*\{[^}]*font-size:\s*16px/s,
  'all checkout form controls must stay at 16px to prevent iOS focus zoom'
);
assert.doesNotMatch(
  checkoutPage,
  /\.file-input\s*\{[^}]*font-size:\s*12px/s,
  'file inputs must not retain a sub-16px font size'
);

console.log('Phase 257 landlord checkout input zoom regression tests passed.');
