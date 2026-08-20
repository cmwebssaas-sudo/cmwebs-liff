import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageNames = [
  'tenant-payment-report.html',
  'tenant-contract.html',
  'tenant-renewal.html',
  'tenant-termination.html'
];

const sources = Object.fromEntries(
  pageNames.map((name) => [name, readFileSync(name, 'utf8')])
);

const completeLineUidPattern = /\bU[0-9a-fA-F]{32}\b/;

for (const [name, source] of Object.entries(sources)) {
  assert.doesNotMatch(
    source,
    completeLineUidPattern,
    `${name} must not expose a complete LINE UID`
  );
  assert.doesNotMatch(
    source,
    /TEST_LINE_USER_ID/,
    `${name} must not define the legacy page-local test UID`
  );
  assert.match(source, /TEST_MODE/);
  assert.match(
    source,
    /if\s*\(\s*TEST_MODE\s*\)\s*\{\s*return\s+true\s*;\s*\}/,
    `${name} must keep a test-mode branch without assigning a UID`
  );
  assert.match(source, /liff\.init/);
  assert.match(source, /liff\.getProfile/);
  assert.match(source, /profile\.userId/);
}

for (const name of [
  'tenant-contract.html',
  'tenant-renewal.html',
  'tenant-termination.html'
]) {
  assert.match(
    sources[name],
    /if\s*\(\s*!LINE_USER_ID\s*&&\s*!TEST_MODE\s*\)/,
    `${name} must allow an empty browser UID only in test mode`
  );
}

const paymentReport = sources['tenant-payment-report.html'];
assert.match(paymentReport, /TENANT_LIFF_ENTRY_PAGE/);
assert.match(paymentReport, /tenant-bind\.html/);
assert.match(paymentReport, /next/);
assert.match(paymentReport, /bill_id/);

const expectedTestFlagCounts = {
  'tenant-payment-report.html': 1,
  'tenant-contract.html': 5,
  'tenant-renewal.html': 1,
  'tenant-termination.html': 1
};
const testFlagPattern = /url\s*\+=\s*['"]&test=1['"]\s*;/g;
const guardedTestFlagPattern =
  /if\s*\(\s*TEST_MODE\s*\)(?:\s*\{[\s\S]*?url\s*\+=\s*['"]&test=1['"]\s*;[\s\S]*?\}|\s*url\s*\+=\s*['"]&test=1['"]\s*;)/g;

for (const [name, expectedCount] of Object.entries(expectedTestFlagCounts)) {
  const source = sources[name];
  const totalCount = (source.match(testFlagPattern) || []).length;
  const guardedCount = (source.match(guardedTestFlagPattern) || []).length;

  assert.equal(
    totalCount,
    expectedCount,
    `${name} must set test=1 at every tenant JSONP boundary`
  );
  assert.equal(
    guardedCount,
    expectedCount,
    `${name} must guard every test=1 append with TEST_MODE`
  );
}

assert.match(paymentReport, /function\s+buildTenantLiffLoginRedirect_/);
assert.match(paymentReport, /function\s+jsonpRequest/);
assert.match(sources['tenant-contract.html'], /function\s+callTenantSigningStatus/);
assert.match(
  sources['tenant-contract.html'],
  /function\s+callTenantSigningSubmissionStatus/
);
assert.match(
  sources['tenant-contract.html'],
  /function\s+tenantContractArtifactStatus/
);

console.log('Phase 147 tenant test identity migration tests passed.');
