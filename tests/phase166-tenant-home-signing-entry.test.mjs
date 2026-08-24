import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tenant-home.html', 'utf8');

assert.match(
  source,
  /function isContractEntryFallbackError_\s*\(\s*result\s*\)/,
  'tenant home must identify contract-entry fallback errors'
);

const helperSource = source.match(
  /function isContractEntryFallbackError_\s*\(\s*result\s*\)\s*\{[\s\S]*?\n\s*\}/
);
assert.ok(helperSource, 'contract-entry fallback helper must be extractable');

const getHelper = new Function(
  `${helperSource[0]}; return isContractEntryFallbackError_;`
);
const isContractEntryFallbackError = getHelper();

assert.equal(
  isContractEntryFallbackError({
    success: false,
    code: 'ACTIVE_CONTRACT_NOT_FOUND'
  }),
  true,
  'no-active-contract response must offer the contract entry'
);
assert.equal(
  isContractEntryFallbackError({
    success: false,
    code: 'TENANT_BINDING_REQUIRED'
  }),
  false,
  'binding errors must continue to use the binding flow'
);
assert.equal(
  isContractEntryFallbackError({
    success: true,
    code: 'ACTIVE_CONTRACT_NOT_FOUND'
  }),
  false,
  'successful home responses must not enter signing-only mode'
);

assert.match(
  source,
  /isContractEntryFallbackError_\s*\(\s*homeResult\s*\)[\s\S]*?renderContractEntryFallback\s*\(\)/,
  'active-contract error must render the contract entry instead of a dead refresh loop'
);

const signingEntry = source.match(
  /function renderContractEntryFallback\s*\(\s*\)\s*\{[\s\S]*?\n\s*\}/
);
assert.ok(signingEntry, 'contract-entry fallback renderer must exist');
assert.match(signingEntry[0], /進入合約簽署/);
assert.match(signingEntry[0], /goPage\s*\(\s*['"]tenant-contract\.html['"]\s*\)/);

console.log('Phase 166 tenant home signing entry tests passed.');
