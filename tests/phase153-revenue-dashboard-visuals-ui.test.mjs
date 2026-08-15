import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../landlord-revenue-dashboard.html', import.meta.url), 'utf8');

for (const marker of [
  'paymentStatusChart',
  'overdueRatioChart',
  'overdueAgingChart',
  'occupancyChart',
  'contractExpiryChart',
  '繳款狀態分布',
  '遲繳比例',
  '遲繳天數分布',
  '入住率',
  '合約到期分布',
  'metrics.overdue_ratio',
  'status_distribution',
  'overdue_aging',
  'occupancy',
  'contract_expiry'
]) {
  assert.match(page, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing dashboard marker: ${marker}`);
}
assert.match(page, /<svg[^>]+id=["']paymentStatusChart/);
assert.match(page, /<svg[^>]+id=["']overdueRatioChart/);
assert.match(page, /<svg[^>]+id=["']occupancyChart/);
assert.match(page, /aria-label=["'][^"']*遲繳/);
assert.match(page, /數值表格|table/);

console.log('Phase 153 revenue dashboard visual UI tests passed.');
