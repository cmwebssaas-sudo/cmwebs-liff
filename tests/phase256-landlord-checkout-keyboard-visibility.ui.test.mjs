import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const checkoutPage = readFileSync(new URL('../landlord-tenant-checkout.html', import.meta.url), 'utf8');

assert.match(checkoutPage, /\.checkout-shell\.keyboard-open \.page\s*\{[^}]*padding-bottom:\s*max\(24px,\s*env\(safe-area-inset-bottom\)\)/s);
assert.match(checkoutPage, /let ACTIVE_CHECKOUT_FIELD = null;/);
assert.match(checkoutPage, /function syncCheckoutKeyboardState\(\)/);
assert.match(checkoutPage, /function revealCheckoutField\(field\)/);
assert.match(checkoutPage, /viewport\.offsetTop/);
assert.match(checkoutPage, /page\.scrollTop\s*\+=\s*delta/);
assert.match(checkoutPage, /behavior: 'auto'/);
assert.match(checkoutPage, /window\.visualViewport\.addEventListener\(\s*'scroll',\s*syncCheckoutKeyboardState\s*\)/s);

console.log('Phase 256 landlord checkout keyboard visibility regression tests passed.');
