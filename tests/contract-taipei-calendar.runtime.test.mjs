import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../apps-script/V2_CONTRACT_RENEWAL_HISTORY.js',import.meta.url),'utf8');
function runtime() {
  const context = vm.createContext({Date,Math,Number,String,Object,Array,JSON,RegExp,
    Utilities:{formatDate(date,zone,pattern) {
      assert.equal(zone,'Asia/Taipei');
      assert.equal(pattern,'yyyy-MM-dd');
      return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
    }}
  });
  vm.runInContext(source,context);
  return context;
}

test('Sheets Date objects and timestamps normalize to the Taipei lease day, not the prior UTC day', () => {
  const c=runtime();
  for(const value of [new Date('2026-09-10T16:00:00.000Z'),'2026-09-10T16:00:00.000Z','2026-09-11T00:00:00+08:00','Fri Sep 11 2026 00:00:00 GMT+0800 (Taipei Standard Time)']) {
    assert.equal(c.contractRenewalHistoryDateOnly_(value),'2026-09-11');
  }
  assert.equal(c.contractRenewalHistoryDateOnly_('2026-09-11'),'2026-09-11');
  assert.equal(c.contractRenewalHistoryDateOnly_(''),'');
  assert.equal(c.contractRenewalHistoryDateOnly_('not a date'),'');
});

test('contract history keeps the correct Taiwan dates without mutating the original rows or finance', () => {
  const c=runtime();
  const row={contract_id:'C-fixture',tenant_id:'T-fixture',workspace_id:'W-fixture',room_id:'R-fixture',
    start_date:new Date('2026-09-10T16:00:00Z'),end_date:new Date('2027-09-09T16:00:00Z'),
    contract_status:'active',rent_amount:8500,management_fee:500,deposit_amount:18000};
  const before=JSON.stringify(row);
  const result=c.contractRenewalHistoryBuildReadModel_([row],row);
  assert.equal(result[0].start_date,'2026-09-11');
  assert.equal(result[0].end_date,'2027-09-10');
  assert.equal(result[0].rent_amount,8500);
  assert.equal(JSON.stringify(row),before);
  assert.equal(c.contractRenewalHistoryAddDays_('2026-09-11',1),'2026-09-12');
  assert.equal(c.contractRenewalHistoryAddYearsMinusDay_('2026-09-11',1),'2027-09-10');
});
