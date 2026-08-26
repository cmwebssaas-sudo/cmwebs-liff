import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const landlordEntryPage = readFileSync(
  new URL('../landlord-entry.html', import.meta.url),
  'utf8'
);

assert.match(
  landlordEntryPage,
  /async function fetchStatusJson\(\s*action,\s*params\s*\)/,
  'landlord entry must use a JSON status fetch helper'
);
assert.match(
  landlordEntryPage,
  /credentials:\s*'omit'/,
  'landlord entry status fetch must not send browser credentials'
);
assert.match(
  landlordEntryPage,
  /cache:\s*'no-store'/,
  'landlord entry status fetch must bypass stale API responses'
);
assert.match(
  landlordEntryPage,
  /return response\.json\(\);/,
  'landlord entry status fetch must parse the JSON response'
);
assert.match(
  landlordEntryPage,
  /await fetchStatusJson\(\s*'landlord_entry_status'/,
  'landlord entry status must use the JSON fetch helper'
);
assert.doesNotMatch(
  landlordEntryPage,
  /await jsonpRequest\(\s*'landlord_entry_status'/,
  'landlord entry status must not depend on JSONP callback execution'
);

console.log('Phase 170 landlord entry status fetch tests passed.');
