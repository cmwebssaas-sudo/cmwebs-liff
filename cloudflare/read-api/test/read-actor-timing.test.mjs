import assert from 'node:assert/strict';
import {test} from 'node:test';
const metadata=await import('./read-actor-metadata.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const timing=await import('./read-actor-timing.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const header='{"v":2,"entry_to_before_txn_ms":2,"awaited_txn_ms":5,"entry_to_txn_ms":10,"json_tail_ms":13}';
const phased='{"v":3,"entry_to_before_txn_ms":2,"awaited_txn_ms":5,"entry_to_txn_ms":10,"json_tail_ms":13,"txn_admission_ms":1,"txn_queries_ms":1,"txn_bookmark_ms":1,"txn_completion_ms":2}';
const routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
test('fixture header accepts only last-result complete numeric metadata and leaves ordinary responses unchanged',()=>{
 assert.equal(typeof metadata.actorTimingHeader,'function');
 assert.equal(metadata.actorTimingHeader([{meta:{duration:2}}]),null);
 const last={meta:{cmwebs_test_actor_entry_to_before_txn_ms:2,cmwebs_test_actor_awaited_txn_ms:5,
  cmwebs_test_actor_entry_to_txn_ms:10,cmwebs_test_actor_json_tail_ms:13}};
 assert.equal(metadata.actorTimingHeader([{meta:{duration:2}},last]),header);
 const invalid='{"v":2,"entry_to_before_txn_ms":null,"awaited_txn_ms":null,"entry_to_txn_ms":null,"json_tail_ms":null}';
 for(const batch of [[last,{meta:{}}],[last,last],[{meta:{cmwebs_test_actor_entry_to_txn_ms:2}}],
  [{meta:{cmwebs_test_actor_entry_to_txn_ms:8,cmwebs_test_actor_json_tail_ms:7}}],
  [{meta:{cmwebs_test_actor_entry_to_txn_ms:NaN,cmwebs_test_actor_json_tail_ms:7}}],
  [{meta:{...last.meta,cmwebs_test_actor_awaited_txn_ms:9}}],
  [{meta:{...last.meta,cmwebs_test_actor_entry_to_before_txn_ms:-1}}]])
  assert.equal(metadata.actorTimingHeader(batch),invalid);
});
test('phase header requires four ordered callback windows from the last result',()=>{
 const base={cmwebs_test_actor_entry_to_before_txn_ms:2,cmwebs_test_actor_awaited_txn_ms:5,
  cmwebs_test_actor_entry_to_txn_ms:10,cmwebs_test_actor_json_tail_ms:13,
  cmwebs_test_actor_txn_admission_ms:1,cmwebs_test_actor_txn_queries_ms:1,
  cmwebs_test_actor_txn_bookmark_ms:1,cmwebs_test_actor_txn_completion_ms:2};
 assert.equal(metadata.actorTimingHeader([{meta:{duration:1}},{meta:base}]),phased);
 const bad=JSON.parse(metadata.actorTimingHeader([{meta:{...base,cmwebs_test_actor_txn_bookmark_ms:6}}]));
 assert.equal(bad.v,3);assert(Object.values(bad).slice(1).every(v=>v===null));
 assert.equal(JSON.parse(metadata.actorTimingHeader([{meta:{...base,cmwebs_test_actor_txn_bookmark_ms:undefined}}])).txn_bookmark_ms,null);
});
test('phase collector keeps four numeric windows paired with the original row and rejects absent or inconsistent phases',()=>{
 const lines=[],c=timing.createActorTiming('small',line=>lines.push(line));
 c.record('home',0,21,18,phased);
 c.record('home',1,21,18,phased.replace('"txn_completion_ms":2','"txn_completion_ms":9'));
 c.record('home',2,21,18,null);c.close('FAIL');
 const rows=lines.filter(line=>line.includes('_SAMPLES ')).flatMap(line=>JSON.parse(line.slice(line.indexOf('{'))).rows);
 assert.deepEqual(rows[0],[1,21,18,2,5,10,13,1,1,1,2,'OK']);
 assert.deepEqual(rows[1],[2,21,18,null,null,null,null,null,null,null,null,'INVALID']);
 assert.deepEqual(rows[2],[3,21,18,null,null,null,null,null,null,null,null,'MISSING']);
 assert.equal(JSON.parse(lines.at(-1).slice(lines.at(-1).indexOf('{'))).status,'PARTIAL');
});
test('collector retains700 paired rows, numeric enum privacy, chunk bounds and idempotent close',()=>{
 assert.equal(typeof timing.createActorTiming,'function');
 const lines=[],c=timing.createActorTiming('small',line=>lines.push(line));
 for(const route of routes)for(let i=0;i<100;i++)c.record(route,i,21+i,18,phased);
 c.close('FAIL');const length=lines.length;c.close('PASS');assert.equal(lines.length,length);
 assert(lines.every(line=>Buffer.byteLength(line)<=4096));
 const records=lines.map(line=>JSON.parse(line.slice(line.indexOf('{')))),samples=records.filter(r=>r.rows);
 assert.equal(samples.reduce((n,r)=>n+r.rows.length,0),700);
 assert.deepEqual(samples[0].rows[0],[1,21,18,2,5,10,13,1,1,1,2,'OK']);
 const meta=records.at(-1);assert.equal(meta.status,'COMPLETE');assert.equal(meta.outcome,'FAIL');
 assert.equal(meta.retained,700);assert.equal(meta.invalid,0);assert.equal(meta.output_dropped,0);
 assert.doesNotMatch(lines.join(''),/token|account|SYNTHETIC|https:|\/Users\//i);
});
test('missing and malformed spans are retained as unknown while subsequent samples remain recorded',()=>{
 assert.equal(typeof timing.createActorTiming,'function');
 const lines=[],c=timing.createActorTiming('small',line=>lines.push(line));
 const invalid=[null,'oops','{"v":1,"entry_to_txn_ms":10,"json_tail_ms":13}',
  '{"v":2,"entry_to_before_txn_ms":-1,"awaited_txn_ms":5,"entry_to_txn_ms":10,"json_tail_ms":13}',
  '{"v":2,"entry_to_before_txn_ms":2,"awaited_txn_ms":9,"entry_to_txn_ms":10,"json_tail_ms":13}',
  header.slice(0,-1)+',"secret":"forbidden"}',
  '{"v":2,"entry_to_before_txn_ms":1e999,"awaited_txn_ms":5,"entry_to_txn_ms":10,"json_tail_ms":13}'];
 invalid.forEach((h,i)=>c.record('home',i,21,18,h));c.record('home',7,21,18,phased);c.close('PASS');
 const records=lines.map(line=>JSON.parse(line.slice(line.indexOf('{'))));
 const rows=records.filter(r=>r.rows).flatMap(r=>r.rows);
 assert.equal(rows.length,8);assert.deepEqual(rows[0],[1,21,18,...Array(8).fill(null),'MISSING']);
 assert(rows.slice(1,7).every(r=>r.slice(3,11).every(v=>v===null)&&r[11]==='INVALID'));
 assert.deepEqual(rows[7],[8,21,18,2,5,10,13,1,1,1,2,'OK']);assert.equal(records.at(-1).status,'PARTIAL');
 assert.doesNotMatch(lines.join(''),/forbidden|secret/);
});
test('duplicate, unknown routes and out-of-range samples cannot masquerade as complete evidence',()=>{
 assert.equal(typeof timing.createActorTiming,'function');
 const lines=[],c=timing.createActorTiming('capacity500',line=>lines.push(line));
 c.record('home',0,21,18,phased);c.record('home',0,21,18,phased);c.record('private',1,21,18,phased);
 c.record('home',100,21,18,phased);c.record('home',2,21,18,phased);c.close('FAIL');
 const meta=JSON.parse(lines.at(-1).slice(lines.at(-1).indexOf('{')));
 assert.equal(meta.status,'PARTIAL');assert(meta.invalid>=3);assert.equal(meta.retained,2);
 assert.doesNotMatch(lines.join(''),/private/);
});
