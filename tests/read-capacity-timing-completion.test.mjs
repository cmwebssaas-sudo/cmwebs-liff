import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createActorTiming} from '../cloudflare/read-api/test/read-actor-timing.mjs';
import {createFetchTiming} from '../cloudflare/read-api/test/read-fetch-timing.mjs';

// Execute the actual fixture's measurement tail with deterministic transport
// and clocks. No D1/GAS parity claim is made by these control-flow regressions.
const source=readFileSync(new URL('../cloudflare/read-api/test/read-capacity.test.mjs',import.meta.url),'utf8');
const start=source.indexOf('  const timings='),end=source.indexOf("  timingOutcome='PASS';",start);
assert(start>=0&&end>start,'actual capacity measurement boundary must exist');
const body=source.slice(start,end);
const routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
function measure(durations){
  const counts=Object.fromEntries(routes.map(route=>[route,0])),logs=[];let current,tick=0;
  const actorTiming=createActorTiming('capacity500',line=>logs.push(line));
  const fetchTiming=createFetchTiming('capacity500',line=>logs.push(line));
  const result=runInNewContext('(async()=>{'+body+'})()',{
    assert,actorTiming,fetchTiming,fetchCapture:{begin:()=>({}),run:(_,fn)=>fn(),sample:()=>null},
    cases:routes.map(route=>({route})),paths:Object.fromEntries(routes.map(route=>[route,'/'+route])),
    performance:{now:()=>{const phase=tick++%3;return phase===0?0:phase===1?10:durations[current]??20;}},
    clientTiming:{begin:route=>{current=route;counts[route]++;},end:()=>{}},
    mf:{dispatchFetch:async()=>({status:200,arrayBuffer:async()=>new ArrayBuffer(1),
      headers:{get:name=>name==='server-timing'?'d1;dur=1.000, decode;dur=2.000, route;dur=3.000':null}})},
    console:{log:line=>logs.push(line)}
  });
  return {result:result.then(value=>{actorTiming.close('PASS');fetchTiming.close('PASS');return value;},error=>{actorTiming.close('FAIL');fetchTiming.close('FAIL');throw error;}),counts,logs};
}
test('an early latency failure still measures all700 samples and fails the original gate',async()=>{
  const run=measure({home:60,arrears:51});
  await assert.rejects(run.result,error=>error.name==='AssertionError'&&/home500-room/.test(error.message)&&/arrears500-room/.test(error.message));
  assert.deepEqual(Object.values(run.counts),Array(7).fill(100));
  assert.equal(run.logs.filter(line=>line.startsWith('C6_LOCAL_500_ROOM_STAGES ')).length,7);
});
test('a non-finite p95 cannot become a passing route while collecting later samples',async()=>{
  const run=measure({home:NaN});
  await assert.rejects(run.result,error=>error.name==='AssertionError'&&/home500-room/.test(error.message));
  assert.deepEqual(Object.values(run.counts),Array(7).fill(100));
});
test('all routes below50ms retain their complete original sample counts',async()=>{
  const run=measure({});await run.result;
  assert.deepEqual(Object.values(run.counts),Array(7).fill(100));
  assert.equal(run.logs.filter(line=>line.startsWith('C6_LOCAL_500_ROOM_SAMPLE ')).length,7);
});
