import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const billing = readFileSync('landlord-billing.html', 'utf8');
const tenantDetail = readFileSync('landlord-tenant-detail.html', 'utf8');
const tenants = readFileSync('landlord-tenants.html', 'utf8');
const contracts = readFileSync('landlord-contract-requests.html', 'utf8');

function extractFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name}() must exist`);

  const bodyStart = source.indexOf('{', match.index);
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }

    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, index + 1);
    }
  }

  throw new Error(`unterminated ${name}()`);
}

for (const [source, name] of [
  [billing, 'billing'],
  [tenantDetail, 'tenant detail']
]) {
  assert.match(
    source,
    /landlord-auth\.js\?v=/,
    `${name} page must load the shared landlord auth client`
  );
  assert.match(
    source,
    /landlord-api\.js\?v=/,
    `${name} page must load the shared landlord API client`
  );
  assert.match(
    source,
    /async function ensureLandlordAuthReady\(/,
    `${name} page must have the desktop-aware auth gate`
  );

  const loadPage = extractFunction(source, 'loadPage');
  assert.match(
    loadPage,
    /await ensureLandlordAuthReady\(\)/,
    `${name} loadPage() must use the desktop-aware auth gate before API reads`
  );
}

assert.match(
  tenantDetail,
  /CMWebsLandlordApi\.request\(/,
  'tenant detail reads must use the shared API client so Email sessions use the bridge'
);

assert.match(
  billing,
  /CMWebsLandlordApi\.request\(/,
  'billing reads must use the shared API client so Email sessions use the bridge'
);

const nativeReview = extractFunction(contracts, 'callNativeSigningReviewApi');
const initiated = extractFunction(contracts, 'callLandlordInitiatedApi');
assert.match(
  nativeReview,
  /landlord_session_token/,
  'native signing review must reuse the authenticated desktop Email session'
);
assert.match(
  initiated,
  /landlord_session_token/,
  'landlord-initiated contract reads must reuse the authenticated desktop Email session'
);

const contractLoad = extractFunction(contracts, 'loadPage');
assert.doesNotMatch(
  contractLoad,
  /if \(emailSessionActive\) \{\s*throw desktopNativeUnsupportedError\(\);\s*\}/,
  'desktop Email contract loading must not deliberately reject the two read-only lists'
);

assert.match(
  tenants,
  /landlord-tenant-detail\.html[\s\S]*tenant_id[\s\S]*CMWEBS_RELEASE_VERSION/,
  'tenant list must retain the tenant detail navigation target'
);

console.log('Phase 258 landlord desktop detail and contract Email tests passed.');
