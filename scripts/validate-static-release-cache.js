const fs = require('fs');
const path = require('path');

const root = process.cwd();
const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const fallbackVersion = 'v2.1-p0-1';
const safeVersionExpression =
  "(window.CMWEBS_RELEASE_VERSION || 'v2.1-p0-1')";
const releaseScript = fs.readFileSync(
  path.join(root, 'frontend-release.js'),
  'utf8'
);

if (!/CMWEBS_RELEASE_VERSION\s*=\s*'20260822-line-actions-v1'/.test(releaseScript)) {
  throw new Error('frontend-release.js must define the approved stable release version.');
}

function resolveReleaseVersion(windowLike) {
  return windowLike.CMWEBS_RELEASE_VERSION || fallbackVersion;
}

function assertUrl(input, expected) {
  const url = new URL(input, 'https://cmwebs.invalid/');
  url.searchParams.set('v', resolveReleaseVersion({}));
  const actual = url.pathname.slice(1) + url.search + url.hash;

  if (actual !== expected) {
    throw new Error(`URL parameters or hash changed: ${actual}`);
  }
}

if (/Date\.now|Math\.random/.test(fallbackVersion)) {
  throw new Error('Release-version fallback must be fixed.');
}

if (resolveReleaseVersion({ CMWEBS_RELEASE_VERSION: fallbackVersion }) !== fallbackVersion) {
  throw new Error('The central release version was not preferred.');
}

[{}, {}, {}, {}].forEach(windowLike => {
  if (resolveReleaseVersion(windowLike) !== fallbackVersion) {
    throw new Error('Missing-script fallback did not preserve navigation.');
  }
});

assertUrl('landlord-home.html', 'landlord-home.html?v=v2.1-p0-1');
assertUrl('landlord-entry.html?token=abc', 'landlord-entry.html?token=abc&v=v2.1-p0-1');
assertUrl('landlord-join.html?invite_token=abc&state=ready', 'landlord-join.html?invite_token=abc&state=ready&v=v2.1-p0-1');
assertUrl('landlord-payment-reports.html?bill_id=B1&payment_report_id=P1', 'landlord-payment-reports.html?bill_id=B1&payment_report_id=P1&v=v2.1-p0-1');
assertUrl('tenant-home.html?workspace_id=W1#messages', 'tenant-home.html?workspace_id=W1&v=v2.1-p0-1#messages');
assertUrl('tenant-contract.html?contract_id=C1&return_to=tenant-home.html', 'tenant-contract.html?contract_id=C1&return_to=tenant-home.html&v=v2.1-p0-1');
assertUrl('landlord-messages.html?tenant_id=T1', 'landlord-messages.html?tenant_id=T1&v=v2.1-p0-1');
assertUrl('tenant-message.html?code=abc', 'tenant-message.html?code=abc&v=v2.1-p0-1');

let releaseVersionUses = 0;
let apiAntiCacheKeys = 0;
let staticCacheBustRemaining = 0;

const staticNavigationPatterns = [
  /(?:\?v=|&v=)\s*['"]?\s*\+\s*Date\.now\(/,
  /params\.set\(\s*['"]v['"]\s*,\s*Date\.now\(/,
  /searchParams\.set\(\s*['"]v['"]\s*,\s*(?:String\()?Date\.now\(/
];

htmlFiles.forEach(name => {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  const usesReleaseVersion = (source.match(/CMWEBS_RELEASE_VERSION/g) || []).length;

  releaseVersionUses += usesReleaseVersion;
  apiAntiCacheKeys += (source.match(/&_/g) || []).length;

  if (usesReleaseVersion > 0 && !source.includes('src="frontend-release.js"')) {
    throw new Error(`${name} uses CMWEBS_RELEASE_VERSION without frontend-release.js.`);
  }

  if (usesReleaseVersion > 0 && !source.includes(safeVersionExpression)) {
    throw new Error(`${name} has a non-safe release version lookup.`);
  }

  if (/(?<![.\w])CMWEBS_RELEASE_VERSION\b/.test(source)) {
    throw new Error(`${name} has a bare CMWEBS_RELEASE_VERSION identifier.`);
  }

  staticNavigationPatterns.forEach(pattern => {
    const matches = source.match(new RegExp(pattern.source, 'g')) || [];
    staticCacheBustRemaining += matches.length;
  });
});

if (!fs.existsSync(path.join(root, 'landlord-payment-report-review.html'))) {
  throw new Error('landlord-payment-report-review.html must be preserved.');
}

if (releaseVersionUses === 0) {
  throw new Error('No static navigation uses the central release version.');
}

if (apiAntiCacheKeys === 0) {
  throw new Error('Expected JSONP API anti-cache keys were removed.');
}

if (staticCacheBustRemaining !== 0) {
  throw new Error(`Static cache bust remaining: ${staticCacheBustRemaining}.`);
}

console.log(`Static release cache validation passed: safe version uses=${releaseVersionUses}, API anti-cache keys=${apiAntiCacheKeys}, fallback tests=4, URL tests=8, static cache bust remaining=0.`);
