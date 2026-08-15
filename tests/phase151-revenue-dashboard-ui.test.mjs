import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../landlord-revenue-dashboard.html', import.meta.url), 'utf8');
const menu = readFileSync(new URL('../landlord-more.html', import.meta.url), 'utf8');

assert.match(page, /landlord_revenue_dashboard_init/);
assert.match(page, /本期應收/);
assert.match(page, /本期實收/);
assert.match(page, /本期未收/);
assert.match(page, /收款率/);
assert.match(page, /<svg[^>]+id=["']revenueChart/);
assert.match(page, /月份明細/);
assert.match(page, /下載 CSV/);
assert.match(page, /property_name/);
assert.match(page, /cmwebs-revenue-dashboard\.csv/);
assert.match(page, /沒有可顯示的營收資料/);
assert.match(page, /html, body \{ height:100%; overflow:hidden; \}/);
assert.match(page, /\.app-shell \{[^}]*height:var\(--app-height\);[^}]*overflow:hidden;/s);
assert.match(menu, /landlord-revenue-dashboard\.html/);

console.log('Phase 151 revenue dashboard UI tests passed.');
