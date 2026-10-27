import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateShadowReport } from '../cloudflare/read-api/src/read-shadow.js';
import { evaluateShadowWindows } from '../cloudflare/read-api/src/shadow-windows.js';
import { richDataset,originalGas,access,fixture,plain } from './fixtures/read-parity/runtime.mjs';
import { createReadCalculator } from '../cloudflare/read-api/src/read-calculator.js';
import { createReadServices } from '../cloudflare/read-api/src/read-runtime.js';

const report={route:'tenants',variant:'default',release:'20261027-glass-shell-v1',outcome:'compared',
  clock_paths:[],
  receipt:'00000000-0000-4000-8000-000000000001',
  paths:['data.summary.total_amount'],elapsed_ms:100,headers_ms:90};
test('shadow accepts only bounded redacted paths and timings, never values or client identity',()=>{
  assert.deepEqual(validateShadowReport(report,report.release),report);
  for(const patch of [{workspace_id:'foreign'},{values:[1234]},{paths:['data.private_person']},
    {paths:['data.tenants[USER_ID].name']},{paths:['data.tenants[].tenant_name@example.invalid']},
    {paths:['data.summary.total_amount','data.summary.total_amount']},{elapsed_ms:Infinity},
    {headers_ms:101},{release:'old'},{variant:'actions'},{outcome:'worker_error'},
    {paths:Array(101).fill('data.summary.total_amount')}])
    assert.throws(()=>validateShadowReport({...report,...patch},report.release));
  assert.doesNotThrow(()=>validateShadowReport({...report,paths:['data.[field]']},report.release));
  assert.doesNotThrow(()=>validateShadowReport({...report,clock_paths:['data.landlord.updated_at']},report.release));
  assert.throws(()=>validateShadowReport({...report,clock_paths:['data.tenants[].updated_at']},report.release));
  assert.doesNotThrow(()=>validateShadowReport({...report,outcome:'worker_error',receipt:null,paths:[],headers_ms:null,elapsed_ms:null},report.release));
});

test('independent request clocks differ only in the revenue response timestamp on identical synthetic input',()=>{
  const data=richDataset(),params={from_month:'2026-09',to_month:'2026-10',as_of:'2026-10-12'};
  const gas=plain(originalGas(data).getLandlordRevenueDashboardByLineUid_('SYNTHETIC_LINE1',params));
  const worker=plain(createReadCalculator(createReadServices(data,access,{now:Date.parse(fixture.now)+1000}))
    .getLandlordRevenueDashboardByLineUid_('SYNTHETIC_LINE1',params));
  assert.notEqual(gas.data.updated_at,worker.data.updated_at);
  assert.equal(Date.parse(worker.data.updated_at)-Date.parse(gas.data.updated_at),1000);
  // Evidence for a decision, not a production comparator exclusion.
  delete gas.data.updated_at;delete worker.data.updated_at;
  assert.deepEqual(worker,gas);
});

test('seven complete real windows require every route/home section, zero differences/errors and matching release',()=>{
  const start=Date.parse('2026-10-15T00:00:00Z'),epoch='synthetic-epoch',release=report.release;
  const routes=[['home','home'],['home','actions'],...['revenue','tenants','rooms','arrears','properties'].map(route=>[route,'default'])];
  const rows=Array.from({length:7},(_,window)=>routes.map(([route,variant])=>({window,route,variant,compared:1,errors:0,diffs:0}))).flat();
  const attempt_rows=rows.map(row=>({window:row.window,route:row.route,variant:row.variant,attempts:1,matched:1,errors:0,missing:0}));
  const input={started_at:new Date(start).toISOString(),epoch,release,rows,attempt_rows};
  assert.equal(evaluateShadowWindows(input,{now:start+7*86400000,epoch,release}).eligible,true);
  for(const changed of [ {...input,rows:[]}, {...input,rows:rows.slice(1)},
    {...input,rows:rows.map((row,i)=>i?row:{...row,diffs:1})},
    {...input,rows:rows.map((row,i)=>i?row:{...row,errors:1})},
    {...input,rows:rows.map((row,i)=>i?row:{...row,compared:0})}, {...input,release:'old'},
    {...input,rows:[...rows,rows[0]]}])
    assert.equal(evaluateShadowWindows(changed,{now:start+7*86400000,epoch,release}).eligible,false);
  assert.equal(evaluateShadowWindows(input,{now:start+7*86400000-1,epoch,release}).eligible,false);
  assert.equal(evaluateShadowWindows({...input,rows:[...rows,{window:7,route:'rooms',variant:'default',compared:1,diffs:1,errors:0}]},
    {now:start+7*86400000+1,epoch,release}).eligible,false);
  assert.equal(evaluateShadowWindows({...input,attempt_rows:attempt_rows.map((row,i)=>i?row:{...row,attempts:2})},
    {now:start+7*86400000,epoch,release}).eligible,false);
  assert.equal(evaluateShadowWindows({...input,attempt_rows:[...attempt_rows,{window:7,route:'rooms',variant:'default',attempts:1,matched:0,errors:0,missing:0}]},
    {now:start+7*86400000+1,epoch,release}).eligible,false);
});

test('sequential page coverage does not require already accepted on pages to keep shadowing',()=>{
  const start=Date.parse('2026-10-15T00:00:00Z'),epoch='synthetic-epoch',release=report.release;
  const pairs=[['home','home'],['home','actions'],...['revenue','tenants','rooms','arrears','properties'].map(route=>[route,'default'])];
  const rows=Array.from({length:8},(_,window)=>pairs.filter(([route])=>!(window===7&&route==='rooms'))
    .map(([route,variant])=>({window,route,variant,compared:1,errors:0,diffs:0}))).flat();
  const attempt_rows=rows.map(row=>({...row,attempts:1,matched:1,errors:0,missing:0}));
  const input={started_at:new Date(start).toISOString(),epoch,release,rows,attempt_rows};
  const options={now:start+8*86400000,epoch,release};
  assert.equal(evaluateShadowWindows(input,options).eligible,false);
  assert.equal(evaluateShadowWindows(input,{...options,page:'tenants'}).eligible,true);
  assert.equal(evaluateShadowWindows(input,{...options,page:'rooms'}).eligible,false);
  assert.equal(evaluateShadowWindows(input,{...options,page:'home'}).eligible,true);
  assert.equal(evaluateShadowWindows(input,{...options,page:'unknown'}).eligible,false);
  const bad={...input,rows:[...rows,{window:8,route:'revenue',variant:'default',compared:1,errors:1,diffs:0}]};
  assert.equal(evaluateShadowWindows(bad,{...options,now:options.now+1,page:'tenants'}).eligible,false);
});
