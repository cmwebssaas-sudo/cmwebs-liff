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

test('簡易快速租約讓房東編輯房間預設管理費並保留送出契約', () => {
  const simpleRenderer = tenantCreate.slice(
    tenantCreate.indexOf('function renderSimpleNewContractPage()'),
    tenantCreate.indexOf('function renderPaperBackfillPage()')
  );

  assert.match(
    simpleRenderer,
    /<input id="managementFee" class="input" type="number" min="0" step="1" value="\$\{safeHtml\(roomDefaults\.management_fee\)\}" \/>/
  );
  assert.doesNotMatch(
    simpleRenderer,
    /<input id="managementFee" type="hidden"/
  );
  assert.match(
    tenantCreate,
    /setInputValue\('managementFee', defaults\.management_fee\)/
  );
  assert.match(
    tenantCreate,
    /management_fee:\s*inputValue\(\s*'managementFee'\s*\)/
  );
  assert.match(
    tenantCreate,
    /const managementFee = Number\(inputValue\('managementFee'\)\);/
  );
  assert.match(
    tenantCreate,
    /!Number\.isFinite\(managementFee\) \|\| managementFee < 0/
  );
});
