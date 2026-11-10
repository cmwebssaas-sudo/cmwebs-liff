import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

function extract(text, name) {
  const start = text.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  let depth = 0;
  const open = text.indexOf('{', start);
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') depth--;
    if (!depth) return text.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
}

// Like Google Sheets: a digit string with a leading zero becomes a number
// unless that cell is formatted as plain text.
function sheetsLikeSheet(headers) {
  const rows = [headers.slice()];
  const formats = new Map();
  const store = (r, c, value) => {
    rows[r - 1] ||= [];
    rows[r - 1][c - 1] = typeof value === 'string' && /^\d+$/.test(value) && formats.get(r + ':' + c) !== '@'
      ? Number(value)
      : value;
  };
  return {
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => headers.length,
    getRange: (r, c, h = 1, w = 1) => ({
      getValues: () => Array.from({ length: h }, (_, i) =>
        Array.from({ length: w }, (_, j) => (rows[r - 1 + i] || [])[c - 1 + j] ?? '')),
      setValues(values) { values.forEach((a, i) => a.forEach((v, j) => store(r + i, c + j, v))); },
      setNumberFormat(format) {
        for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) formats.set((r + i) + ':' + (c + j), format);
        return this;
      }
    })
  };
}

const headers = ['payment_id', 'bill_id', 'amount', 'bank_last5', 'status'];
const payment = { payment_id: 'PAY-1', bill_id: 'B1', amount: 7614, bank_last5: '06688', status: 'confirmed' };

for (const [file, prefix] of [
  ['apps-script/V2_PAYMENT_SETTLEMENT.js', 'settlement'],
  ['apps-script/V2_MANUAL_SETTLEMENT.js', 'manualSettlement']
]) {
  const source = read(file);
  const names = prefix === 'settlement'
    ? ['appendSettlementObjectRowVerified_', 'updateSettlementRowByObjectVerified_', 'settlementKeepLeadingZeroText_', 'settlementRowValueMatches_']
    : ['manualSettlementAppendObjectRowVerified_', 'manualSettlementUpdateRowByObjectVerified_', 'manualSettlementKeepLeadingZeroText_', 'manualSettlementRowValueMatches_'];
  const context = vm.createContext({ manualSettlementText_: v => String(v == null ? '' : v).trim() });
  vm.runInContext(names.map(name => extract(source, name)).join('\n'), context);
  const [append, update] = names.map(name => context[name]);

  test(`${file}: a payer suffix starting with 0 is kept and the verified append succeeds`, () => {
    const sheet = sheetsLikeSheet(headers);
    const result = append(sheet, payment);
    assert.equal(result.rowIndex, 2);
    assert.equal(sheet.rows[1][3], '06688');
    assert.equal(sheet.rows[1][2], 7614, 'other numbers are still stored as numbers');
  });

  test(`${file}: a verified update with a leading-zero suffix succeeds`, () => {
    const sheet = sheetsLikeSheet(headers);
    append(sheet, { ...payment, bank_last5: '' });
    update(sheet, 2, { bank_last5: '01234', status: 'void' });
    assert.deepEqual(sheet.rows[1].slice(3), ['01234', 'void']);
  });
}

test('bank receipt bill months stay in Taipei time', () => {
  const source = read('apps-script/V2_BANK_EMAIL_RECEIPTS.js');
  const context = vm.createContext({
    Utilities: {
      formatDate: (date, timezone, format) => {
        assert.equal(timezone, 'Asia/Taipei');
        assert.equal(format, 'yyyy-MM');
        const taipei = new Date(new Date(date).getTime() + 8 * 3600000);
        return taipei.toISOString().slice(0, 7);
      }
    }
  });
  vm.runInContext(extract(source, 'bankReceiptText_') + '\n' + extract(source, 'bankReceiptBillMonth_'), context);
  // 2026-11-01 00:00 in Taipei is 2026-10-31 in UTC.
  assert.equal(context.bankReceiptBillMonth_(new Date('2026-10-31T16:00:00.000Z')), '2026-11');
  assert.equal(context.bankReceiptBillMonth_('2026-11'), '2026-11');
  assert.equal(context.bankReceiptBillMonth_(''), '');
  assert.match(source, /bill_month:bankReceiptBillMonth_\(b\.bill_month\)/);
});
