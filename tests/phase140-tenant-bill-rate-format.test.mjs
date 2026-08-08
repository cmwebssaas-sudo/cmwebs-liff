import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync('tenant-bills.html', 'utf8');

function formattersFromSource() {
  const match = source.match(
    /    function numberValue\(value\) \{[\s\S]*?(?=    function numberText)/
  );

  assert.ok(match, 'tenant bill formatters should be available for evaluation');

  const context = { Math, Number };
  vm.runInNewContext(
    `${match[0]}
      this.formatters = {
        money,
        unitRateMoney: typeof unitRateMoney === 'function'
          ? unitRateMoney
          : money
      };`,
    context
  );

  return context.formatters;
}

test('tenant bill totals stay rounded while unit rates preserve stored fractions', () => {
  const { money, unitRateMoney } = formattersFromSource();

  assert.equal(money(806.75), 'NT$ 807');
  assert.equal(unitRateMoney(3.5), 'NT$ 3.5');
  assert.equal(unitRateMoney(3), 'NT$ 3');
});

test('tenant bill rate labels and calculation sentences use the rate formatter only', () => {
  const detailStart = source.indexOf('    function openBillDetail(');
  const detailEnd = source.indexOf('    function closeBillDetail(', detailStart);

  assert.ok(detailStart >= 0 && detailEnd > detailStart);

  const detailSource = source.slice(detailStart, detailEnd);

  assert.match(
    detailSource,
    /detailRow\(\s*'每度電費',\s*unitRateMoney\(\s*electricityUnitPrice\s*\)\s*\)/
  );
  assert.match(
    detailSource,
    /電費計算：[\s\S]*?度 ×\s*\$\{unitRateMoney\(\s*electricityUnitPrice\s*\)\}[\s\S]*?money\(\s*electricityAmount\s*\)/
  );
  assert.match(
    detailSource,
    /detailRow\(\s*'每度設備費',\s*unitRateMoney\(\s*equipmentUnitPrice\s*\)\s*\)/
  );
  assert.match(
    detailSource,
    /設備耗損費計算：[\s\S]*?度 ×\s*\$\{unitRateMoney\(\s*equipmentUnitPrice\s*\)\}[\s\S]*?money\(\s*equipmentAmount\s*\)/
  );
});
