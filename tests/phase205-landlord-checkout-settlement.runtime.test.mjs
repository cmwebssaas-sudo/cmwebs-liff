import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const checkoutSource = readFileSync(
  new URL('../apps-script/V2_CONTRACT_CHECKOUT.js', import.meta.url),
  'utf8'
);

const context = {
  Date, Math, Number, String, Object, Array, JSON, RegExp, console
};
vm.createContext(context);
vm.runInContext(checkoutSource, context, { filename: 'V2_CONTRACT_CHECKOUT.js' });

const contract = {
  start_date: '2025-09-01',
  rent_amount: 7500,
  deposit_amount: 15000,
  electricity_fee_rate: 3,
  equipment_fee_rate: 3.5
};

const result = context.landlordContractCheckoutSettlementCalculate_({
  contract,
  previousBill: {
    bill_id: 'bill-2026-08-506',
    bill_month: '2026-08',
    payment_status: 'unpaid',
    electricity_amount: 120,
    equipment_amount: 80
  },
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 110,
  depositDeductionAmount: 500,
  depositDeductionNote: '浴室門片損壞'
});

assert.equal(result.success, true, result.code);
assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
  settlement_start_date: '2026-09-01',
  move_out_date: '2026-09-07',
  rent_days: 7,
  days_in_month: 30,
  rent_amount: 1750,
  start_meter_reading: 100,
  end_meter_reading: 110,
  electricity_usage: 10,
  electricity_amount: 30,
  equipment_amount: 35,
  previous_electricity_amount: 120,
  previous_equipment_amount: 80,
  subtotal_amount: 2015,
  deposit_amount: 15000,
  deposit_deduction_amount: 500,
  deposit_refund_amount: 14500,
  tenant_balance_due: 1515
});

const invalidMeter = context.landlordContractCheckoutSettlementValidateInput_({
  contract,
  moveOutDate: '2026-09-07',
  startMeterReading: 110,
  endMeterReading: 100,
  depositDeductionAmount: 0
});
assert.equal(invalidMeter.success, false);
assert.equal(invalidMeter.code, 'CHECKOUT_METER_READING_INVALID');

const invalidDate = context.landlordContractCheckoutSettlementValidateInput_({
  contract,
  moveOutDate: '2025-08-31',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 0
});
assert.equal(invalidDate.success, false);
assert.equal(invalidDate.code, 'CHECKOUT_MOVE_OUT_DATE_INVALID');

const excessiveDeduction = context.landlordContractCheckoutSettlementValidateInput_({
  contract,
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 15001
});
assert.equal(excessiveDeduction.success, false);
assert.equal(excessiveDeduction.code, 'CHECKOUT_DEPOSIT_DEDUCTION_INVALID');

const missingDeductionNote = context.landlordContractCheckoutSettlementValidateInput_({
  contract,
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 1
});
assert.equal(missingDeductionNote.success, false);
assert.equal(missingDeductionNote.code, 'CHECKOUT_DEPOSIT_DEDUCTION_NOTE_REQUIRED');

const paidPreviousBill = context.landlordContractCheckoutSettlementCalculate_({
  contract,
  previousBill: {
    bill_id: 'bill-2026-08-506',
    bill_month: '2026-08',
    payment_status: 'paid',
    electricity_amount: 120,
    equipment_amount: 80
  },
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 0
});
assert.equal(paidPreviousBill.success, true, paidPreviousBill.code);
assert.equal(paidPreviousBill.data.previous_electricity_amount, 0);
assert.equal(paidPreviousBill.data.previous_equipment_amount, 0);

const absentPreviousBill = context.landlordContractCheckoutSettlementCalculate_({
  contract,
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 100,
  depositDeductionAmount: 0
});
assert.equal(absentPreviousBill.success, true, absentPreviousBill.code);
assert.equal(absentPreviousBill.data.previous_electricity_amount, 0);
assert.equal(absentPreviousBill.data.previous_equipment_amount, 0);

const settlementSheet = {
  headers: ['legacy_column'],
  getLastColumn() { return this.headers.length; },
  getRange(_row, column, _height, width) {
    return {
      getValues: () => [this.headers.slice(column - 1, column - 1 + width)],
      setValues: values => { this.headers.splice(column - 1, 0, ...values[0]); }
    };
  }
};
const spreadsheet = {
  getSheetByName: name => name === 'V2_checkout_settlements' ? settlementSheet : null
};
const schema = context.landlordContractCheckoutSettlementEnsureSheet_(spreadsheet);
assert.equal(schema.success, true, schema.code);
assert.equal(settlementSheet.headers[0], 'legacy_column');
assert.equal(settlementSheet.headers.includes('settlement_id'), true);
assert.equal(settlementSheet.headers.includes('completed_at'), true);
const schemaAgain = context.landlordContractCheckoutSettlementEnsureSheet_(spreadsheet);
assert.equal(schemaAgain.success, true, schemaAgain.code);
assert.deepEqual(JSON.parse(JSON.stringify(schemaAgain.data.added_headers)), []);

console.log('Phase 205 landlord checkout settlement runtime RED/GREEN tests passed.');
