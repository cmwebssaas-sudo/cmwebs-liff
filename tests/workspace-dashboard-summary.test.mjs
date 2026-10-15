import assert from 'node:assert/strict';
import {test} from 'node:test';
import {originalGas,plain} from './fixtures/read-parity/runtime.mjs';
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
