import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../landlord-tenants.html', import.meta.url), 'utf8');
const create = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const requests = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');

test('a pending renewal hides quick renewal and shows its progress on both layouts', () => {
  assert.equal((page.match(/const pendingRenewal = Boolean\(rawText\(tenant\.pending_renewal_contract_id\)\.trim\(\)\);\n\s+const canQuickRenew = Boolean\(\n\s+!pendingRenewal &&/g) || []).length, 2);
  assert.match(page, /已發出續約・等房客簽名/);
  assert.match(page, /查看續約進度/);
  assert.match(page, /badge warning">續約待簽署/);
});

test('the renewal success screen and reissue alert report the LINE delivery', () => {
  assert.match(create, /\$\{initiated \? lineNotificationHtml\(CREATED_DATA\.line_notification\) : ''\}/);
  assert.match(create, /已用 LINE 把簽約邀請（連結、確認碼與說明）發給房客/);
  assert.match(requests, /lineNotice && lineNotice\.sent === true/);
});
