import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tenant-home.html', 'utf8');

assert.match(
  source,
  /function buildTenantLiffLoginRedirectUri_\s*\(\s*\)/,
  'tenant home must build a canonical LIFF login redirect'
);
assert.match(
  source,
  /new URL\(\s*['"]tenant-bind\.html['"]\s*,\s*location\.href\s*\)/,
  'tenant home login must return through the configured LIFF endpoint'
);
assert.match(
  source,
  /searchParams\.set\(\s*['"]next['"]\s*,\s*['"]tenant-home\.html['"]\s*\)/,
  'tenant home login must preserve the requested page'
);

const initLineBlock = source.match(
  /async function initLineUserId\s*\(\s*\)\s*\{[\s\S]*?const profile/
);
assert.ok(initLineBlock, 'tenant home LIFF initialization must be present');
assert.match(
  initLineBlock[0],
  /redirectUri\s*:\s*buildTenantLiffLoginRedirectUri_\s*\(\s*\)/,
  'tenant home must not send its deep URL as the LINE redirect URI'
);
assert.doesNotMatch(
  initLineBlock[0],
  /redirectUri\s*:\s*location\.href/,
  'tenant home must not use a non-endpoint redirect URI'
);

console.log('Phase 167 tenant LIFF login redirect tests passed.');
