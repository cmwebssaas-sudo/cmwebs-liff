import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const statusFunction = source.match(
  /function callLandlordReviewAuthStatus\([\s\S]*?\n    }/
)?.[0] || '';

assert.match(
  source,
  /function jsonpRequestWithoutLineUserId\(/,
  'landlord review auth needs a JSONP status transport for mobile LIFF redirects'
);
assert.match(
  statusFunction,
  /jsonpRequestWithoutLineUserId\(/,
  'landlord review auth status must use the redirect-safe JSONP transport'
);
assert.doesNotMatch(
  statusFunction,
  /fetchStatusJson\(/,
  'landlord review auth status must not depend on fetch redirect handling'
);
assert.doesNotMatch(
  statusFunction,
  /line_user_id/,
  'auth status must not expose the raw landlord LINE UID in its query'
);

console.log('Phase 216 landlord review auth mobile transport tests passed.');
