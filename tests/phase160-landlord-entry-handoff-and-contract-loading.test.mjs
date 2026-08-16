import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requestsPage = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');
const createPage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');

assert.match(requestsPage, /function buildLandlordLoginRedirectUri\(\)/);
assert.match(requestsPage, /redirectUri:\s*buildLandlordLoginRedirectUri\(\)/);
assert.match(createPage, /function buildLandlordLoginRedirectUri\(\)/);
assert.match(requestsPage, /Promise\.all\(\[/);

console.log('Phase 160 landlord entry handoff and contract loading tests passed.');
