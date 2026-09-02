import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const createPage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const detailPage = readFileSync(new URL('../landlord-tenant-detail.html', import.meta.url), 'utf8');
const propertiesPage = readFileSync(new URL('../landlord-properties.html', import.meta.url), 'utf8');

assert.match(detailPage, /手動補登紙本合約/);
assert.match(propertiesPage, /手動補登紙本合約/);
assert.match(createPage, /paper_backfill/);
assert.match(createPage, /landlord_contract_paper_backfill/);
assert.match(createPage, /paperContractFile/);
assert.match(createPage, /身分證正面.*選填|身分證正面.*可後補/);
assert.match(createPage, /身分證反面.*選填|身分證反面.*可後補/);
assert.match(createPage, /確認補登紙本合約/);
assert.match(createPage, /紙本合約.*必填/);
const paperRender = createPage.match(/function renderPaperBackfillPage\(\)[\s\S]*?\n    function handlePaperBackfillRoomChange/);
assert.ok(paperRender, 'paper backfill render function should exist');
assert.doesNotMatch(paperRender[0], /邀請連結|確認碼|QR/);
assert.match(createPage, /landlord_contract_initiate_new/);
assert.match(createPage, /PAPER_BACKFILL_IDEMPOTENCY_KEY/);
assert.match(createPage, /tenant_id:\s*PRESELECTED_TENANT_ID/);
assert.match(detailPage, /mode', 'paper_backfill|mode", "paper_backfill/);
assert.match(propertiesPage, /goTenantPaperBackfill/);
assert.match(propertiesPage, /String\(page \|\| ''\)\.indexOf\('\?'\)/);

console.log('Phase 210 paper contract backfill UI tests passed.');
