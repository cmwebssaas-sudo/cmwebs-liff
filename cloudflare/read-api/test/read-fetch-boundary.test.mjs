import assert from 'node:assert/strict';
import {test} from 'node:test';
const module=await import('./read-fetch-boundary.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
test('selected fetch preserves receiver arguments and response while recording same-clock await window',async()=>{
 assert.equal(typeof module.withFetchBoundary,'function');
 const result={},receiver={},input={},init={};let calls=0;const clocks=[10,25];
 const original=async function(a,b){assert.equal(this,receiver);assert.equal(a,input);assert.equal(b,init);calls++;return result;};
 const owner={fetch:original},descriptor=Object.getOwnPropertyDescriptor(owner,'fetch');
 await module.withFetchBoundary(owner,async cap=>{
  const token=cap.begin();assert.deepEqual(cap.sample(token),{status:'INCOMPLETE',calls:0,settled:0,errors:0,before_ms:null,after_ms:null});
  assert.equal(await cap.run(token,()=>owner.fetch.call(receiver,input,init)),result);
  assert.deepEqual(cap.sample(token),{status:'COMPLETE',calls:1,settled:1,errors:0,before_ms:10,after_ms:25});
  assert.throws(()=>cap.run(token,()=>{}),/TOKEN/);
 },{now:()=>clocks.shift()});
 assert.equal(calls,1);assert.deepEqual(Object.getOwnPropertyDescriptor(owner,'fetch'),descriptor);
});
test('unselected calls passthrough with original promise identity and concurrent tokens stay isolated',async()=>{
 assert.equal(typeof module.withFetchBoundary,'function');
 const plain=Promise.resolve({plain:true}),pending=[];let tick=0,first=true;
 const original=()=>{if(first){first=false;return plain;}return new Promise(resolve=>pending.push(resolve));},owner={fetch:original};
 await module.withFetchBoundary(owner,async cap=>{
  assert.equal(owner.fetch(),plain);
  const a=cap.begin(),b=cap.begin(),ar=cap.run(a,()=>owner.fetch()),br=cap.run(b,()=>owner.fetch());
  assert.equal(cap.sample(a).status,'INCOMPLETE');assert.equal(cap.sample(b).status,'INCOMPLETE');
  pending[1]('b');await br;pending[0]('a');await ar;
  assert.deepEqual(cap.sample(a),{status:'COMPLETE',calls:1,settled:1,errors:0,before_ms:1,after_ms:4});
  assert.deepEqual(cap.sample(b),{status:'COMPLETE',calls:1,settled:1,errors:0,before_ms:2,after_ms:3});
 },{now:()=>++tick});assert.equal(owner.fetch,original);
});
test('fetch error identity and original settlement survive diagnostic clock faults and scope failure',async()=>{
 assert.equal(typeof module.withFetchBoundary,'function');const error=Error('synthetic-original');
 const original=()=>Promise.reject(error),owner={fetch:original};
 await assert.rejects(module.withFetchBoundary(owner,async cap=>{
  const token=cap.begin();await assert.rejects(cap.run(token,()=>owner.fetch()),e=>e===error);
  assert.deepEqual(cap.sample(token),{status:'INCOMPLETE',calls:1,settled:1,errors:1,before_ms:null,after_ms:null});throw error;
 },{now:()=>{throw Error('clock-only');}}),e=>e===error);
 assert.equal(owner.fetch,original);
});
test('overlap invalid owners and multiple or missing calls never gain complete evidence',async()=>{
 assert.equal(typeof module.withFetchBoundary,'function');const owner={fetch:async()=>1};
 for(const bad of [Object.freeze({fetch:async()=>1}),{get fetch(){throw Error('GETTER_MUST_NOT_RUN');}},{}])
  await assert.rejects(module.withFetchBoundary(bad,()=>{}),/FETCH_OWNER/);
 await module.withFetchBoundary(owner,async cap=>{
  await assert.rejects(module.withFetchBoundary(owner,()=>{}),/OVERLAP/);
  const empty=cap.begin();await cap.run(empty,async()=>1);assert.equal(cap.sample(empty).status,'INCOMPLETE');
  const multiple=cap.begin();await cap.run(multiple,()=>Promise.all([owner.fetch(),owner.fetch()]));
  assert.equal(cap.sample(multiple).status,'INCOMPLETE');assert.equal(cap.sample(multiple).calls,2);
 });
});
test('async descendants after dispatch settlement passthrough without changing the completed sample',async()=>{
 const plain=Promise.resolve('response');let calls=0,release,late;const owner={fetch:()=>{calls++;return plain;}};
 await module.withFetchBoundary(owner,async cap=>{
  const token=cap.begin();
  await cap.run(token,()=>{
   const gate=new Promise(resolve=>{release=resolve;});
   late=gate.then(()=>{assert.equal(owner.fetch(),plain);});
   return owner.fetch();
  });
  const sample=cap.sample(token);assert.equal(sample.status,'COMPLETE');
  release();await late;
  assert.deepEqual(cap.sample(token),sample);assert.equal(calls,2);
 });
});
test('completion cannot precede dispatch settlement or recover detached unfinished fetches',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});const owner={fetch:()=>pending};
 await module.withFetchBoundary(owner,async cap=>{
  const token=cap.begin();let detached;
  await cap.run(token,()=>{detached=owner.fetch();return 'ended-before-fetch';});
  assert.equal(cap.sample(token).status,'INCOMPLETE');release();await detached;
  assert.equal(cap.sample(token).status,'INCOMPLETE');
  const awaited=cap.begin();await cap.run(awaited,async()=>{
   await owner.fetch();assert.equal(cap.sample(awaited).status,'INCOMPLETE');
  });assert.equal(cap.sample(awaited).status,'COMPLETE');
 });
});
