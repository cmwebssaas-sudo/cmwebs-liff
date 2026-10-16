import assert from 'node:assert/strict';
import {test} from 'node:test';
import {originalGas,plain,dataset,richDataset} from './fixtures/read-parity/runtime.mjs';
import {capacityDataset} from './fixtures/read-parity/capacity.mjs';

test('tenant summary skips discarded history work while matching the complete API projection exactly',()=>{
  const gas=originalGas(capacityDataset());
  const full=plain(gas.getWorkspaceLandlordTenantsNativeByLineUid_('SYNTHETIC_LINE1'));
  assert.equal(full.success,true);assert.equal(full.data.tenants.length,250);
  assert.ok(full.data.tenants.every(row=>Array.isArray(row.contract_history)&&row.contract_history.length>0));
  const expected=plain(gas.workspaceLandlordReadSummary_(full,'tenants'));
  const history=gas.landlordContractHistoryView_;let calls=0;
  gas.landlordContractHistoryView_=(...args)=>{calls++;return history(...args);};
  const summary=plain(gas.getWorkspaceLandlordTenantsNativeByLineUid_('SYNTHETIC_LINE1','summary'));
  assert.deepEqual(summary,expected,'Amounts, counts, ordering, masking and all retained fields stay identical');
  assert.equal(calls,0,'Summary must not construct histories that are removed from every returned tenant');
  assert.equal(summary.data.tenants.some(row=>Object.hasOwn(row,'contract_history')),false);
  assert.deepEqual(plain(gas.getWorkspaceLandlordTenantsNativeByLineUid_('SYNTHETIC_LINE1')),full);
  assert.equal(calls,250,'The default API still builds and returns every history');
});

test('tenant landlord summary preserves the canonical home fields without discarded bill aggregation',()=>{
  for(const input of [dataset,richDataset(),capacityDataset()]) {
    const gas=originalGas(input);
    const home=plain(gas.getWorkspaceLandlordHomeNativeByLineUid_('SYNTHETIC_LINE1'));
    assert.equal(home.success,true);
    const landlord=plain(gas.workspaceDashboardLandlordSummary_(home.data));
    const sum=gas.workspaceDashboardSum_;let sums=0;
    gas.workspaceDashboardSum_=(...args)=>{sums++;return sum(...args);};
    const full=plain(gas.getWorkspaceLandlordTenantsNativeByLineUid_('SYNTHETIC_LINE1'));
    const summary=plain(gas.getWorkspaceLandlordTenantsNativeByLineUid_('SYNTHETIC_LINE1','summary'));
    assert.equal(full.success,true);assert.equal(summary.success,true);
    for(const result of [full,summary])assert.deepEqual(
      Object.fromEntries(Object.keys(landlord).map(key=>[key,result.data.landlord[key]])),landlord);
    assert.deepEqual(summary,plain(gas.workspaceLandlordReadSummary_(full,'tenants')));
    assert.equal(sums,full.data.tenants.length+summary.data.tenants.length,
      'Only each returned tenant needs its unpaid total; home billing totals are discarded');
  }
});
