import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeSnapshot = fs.readFileSync(
  new URL('../apps-script/V2_RUNTIME_SNAPSHOT.js', import.meta.url),
  'utf8'
);

assert.match(
  runtimeSnapshot,
  /landlord_home_bootstrap:\s*true[\s\S]*landlord_tenants:\s*true/,
  'desktop landlord home and tenant reads must share request-local sheet snapshots'
);

console.log('Landlord read snapshot regression test passed.');
