import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homePage = readFileSync(new URL('../landlord-home.html', import.meta.url), 'utf8');

assert.match(homePage, /landlord_initiated_contracts/);
assert.match(homePage, /landlordInitiatedPending/);
assert.match(homePage, /房東發起/);
assert.match(homePage, /buildActionSummary\([^)]*initiatedContractData/);

console.log('Phase 164 landlord contract invite retrieval home RED/GREEN tests passed.');
