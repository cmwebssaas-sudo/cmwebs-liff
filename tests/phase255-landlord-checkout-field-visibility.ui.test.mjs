import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const checkoutPage = readFileSync(new URL('../landlord-tenant-checkout.html', import.meta.url), 'utf8');

assert.match(checkoutPage, /class="app-shell checkout-shell"/);
assert.match(checkoutPage, /<main class="page checkout-page" id="app">/);
assert.match(checkoutPage, /\.checkout-shell \.page\s*\{[^}]*scroll-padding-bottom:\s*calc\(32px \+ env\(safe-area-inset-bottom\)\)/s);
assert.match(checkoutPage, /\.checkout-shell \.bottom-nav\s*\{[^}]*display:\s*none\s*!important/s);
assert.match(checkoutPage, /scrollIntoView\(\{ behavior: 'auto', block: 'nearest', inline: 'nearest' \}\)/);
assert.doesNotMatch(checkoutPage, /scrollIntoView\(\{ behavior: 'smooth'/);

console.log('Phase 255 landlord checkout field visibility regression tests passed.');
