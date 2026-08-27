import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../landlord-tenant-detail.html', import.meta.url), 'utf8');

assert.match(page, /function renderContractHistory\(contracts\)/, 'landlord detail must render a contract version history section');
assert.match(page, /function numberValue\(value, fallback\)/, 'landlord detail history must define its numeric display helper');
assert.match(page, /function statusText\(value\)/, 'landlord detail history must define its status display helper');
assert.match(page, /function escapeHtml\(value\)/, 'landlord detail history buttons must define their HTML escaping helper');
assert.match(page, /contract_history/, 'landlord detail must consume the server-built contract history payload');
assert.match(page, /合約版本紀錄/, 'landlord detail must label the immutable contract version history');
assert.match(page, /查看完整合約與簽名/, 'landlord detail must keep the complete contract and signature entry');
assert.match(page, /function goContractVersion\(contractId\)/, 'landlord detail must provide a version-specific contract review entry');
assert.match(page, /read_only/, 'history rendering must preserve read-only version semantics');
assert.match(page, /params\.set\('contract_id', normalizedContractId\)/, 'version entry must preserve the selected contract id');

const reviewPage = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');
assert.match(reviewPage, /CONTRACT_FILTER_ID/, 'contract review page must accept a selected contract version');
assert.match(reviewPage, /contract_id: CONTRACT_FILTER_ID \|\| undefined/, 'contract review page must request the selected contract version');
assert.match(reviewPage, /合約完整內容與簽名/, 'selected contract version must show the complete contract and signature heading');
assert.match(reviewPage, /此版本已完成簽署，僅供歷史查閱/, 'completed history must be explicitly read-only');

const tenantPage = readFileSync(new URL('../tenant-contract.html', import.meta.url), 'utf8');
assert.match(tenantPage, /function renderTenantContractHistory_\(contracts, currentContractId\)/, 'tenant signing page must render contract versions');
assert.match(tenantPage, /renderTenantContractHistory_\(data\.contract_history, contract\.contract_id\)/, 'tenant signing page must consume contract history');
assert.match(tenantPage, /每次續約都建立新版本，舊合約保留完整內容與簽名/, 'tenant history must explain immutable version retention');
assert.match(tenantPage, /此版本的合約內容目前未載入/, 'tenant history must fail closed when an old document is unavailable');

console.log('Phase 175 contract renewal history UI tests passed.');
