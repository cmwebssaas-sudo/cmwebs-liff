import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const paymentReport = readFileSync(
  'tenant-payment-report.html',
  'utf8'
);
const tenantBind = readFileSync(
  'tenant-bind.html',
  'utf8'
);

assert.doesNotMatch(
  paymentReport,
  /redirectUri\s*:\s*location\.href/,
  'payment report must not send an invalid non-endpoint redirect URI to LINE'
);
assert.match(
  paymentReport,
  /tenant-bind\.html/,
  'payment report must use the tenant LIFF entry page for login'
);
assert.match(
  paymentReport,
  /next/,
  'payment report login must preserve the requested destination'
);
assert.match(
  tenantBind,
  /tenant-payment-report\.html/,
  'tenant bind entry must allow returning to the payment report page'
);

console.log('Phase 146 tenant LIFF entry tests passed.');
