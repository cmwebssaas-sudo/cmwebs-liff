import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const more = readFileSync(
  new URL('../landlord-more.html', import.meta.url),
  'utf8'
);
const tenantCreate = readFileSync(
  new URL('../landlord-tenant-create.html', import.meta.url),
  'utf8'
);

test('更多頁提供快速建立租約入口', () => {
  assert.match(more, /id="quickLeaseEntry"/);
  assert.match(
    more,
    /onclick="goPage\('landlord-tenant-create\.html\?mode=new'\)"/
  );
  assert.match(more, /快速建立租約/);
  assert.match(more, /帶入原房價，可修改租金並送出簽署邀請/);
});

test('快速建立租約沿用房間租金預填與可編輯簽署流程', () => {
  assert.match(
    tenantCreate,
    /setInputValue\('rentAmount', defaults\.rent_amount\)/
  );
  assert.match(
    tenantCreate,
    /<input id="rentAmount" class="input" type="number"/
  );
  assert.match(tenantCreate, /'landlord_contract_initiate_new'/);
});
