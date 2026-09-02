import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const propertiesPage = readFileSync(new URL('../landlord-properties.html', import.meta.url), 'utf8');
const propertySource = readFileSync(new URL('../apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js', import.meta.url), 'utf8');
const backfillSource = readFileSync(new URL('../apps-script/V2_LANDLORD_PAPER_CONTRACT_BACKFILL.js', import.meta.url), 'utf8');
const createPage = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');

assert.match(propertySource, /paper_backfill_orphan_replacement_eligible/);
assert.match(propertiesPage, /paper_backfill_orphan_replacement_eligible/);
assert.match(propertiesPage, /orphan_recovery/);
assert.match(propertiesPage, /補登紙本並建立房客登入/);
assert.match(backfillSource, /PAPER_REPLACEMENT_ORPHAN/);
assert.match(createPage, /ORPHAN_RECOVERY_MODE/);

console.log('Phase 214 paper backfill orphan entry UI tests passed.');
