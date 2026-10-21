import assert from 'node:assert/strict';
import {test} from 'node:test';
const metadata=await import('./read-actor-metadata.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const timing=await import('./read-actor-timing.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const header='{"v":1,"entry_to_txn_ms":7,"json_tail_ms":13}';
const routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
test('fixture header accepts only last-result complete numeric metadata and leaves ordinary responses unchanged',()=>{
 assert.equal(typeof metadata.actorTimingHeader,'function');
 assert.equal(metadata.actorTimingHeader([{meta:{duration:2}}]),null);
 const last={meta:{cmwebs_test_actor_entry_to_txn_ms:7,cmwebs_test_actor_json_tail_ms:13}};
 assert.equal(metadata.actorTimingHeader([{meta:{duration:2}},last]),header);
 const invalid='{"v":1,"entry_to_txn_ms":null,"json_tail_ms":null}';
 for(const batch of [[last,{meta:{}}],[last,last],[{meta:{cmwebs_test_actor_entry_to_txn_ms:2}}],
  [{meta:{cmwebs_test_actor_entry_to_txn_ms:8,cmwebs_test_actor_json_tail_ms:7}}],
  [{meta:{cmwebs_test_actor_entry_to_txn_ms:NaN,cmwebs_test_actor_json_tail_ms:7}}]])
  assert.equal(metadata.actorTimingHeader(batch),invalid);
});
test('collector retains700 paired rows, numeric enum privacy, chunk bounds and idempotent close',()=>{
 assert.equal(typeof timing.createActorTiming,'function');
 const lines=[],c=timing.createActorTiming('small',line=>lines.push(line));
 for(const route of routes)for(let i=0;i<100;i++)c.record(route,i,21+i,18,header);
 c.close('FAIL');const length=lines.length;c.close('PASS');assert.equal(lines.length,length);
 assert(lines.every(line=>Buffer.byteLength(line)<=4096));
 const records=lines.map(line=>JSON.parse(line.slice(line.indexOf('{')))),samples=records.filter(r=>r.rows);
 assert.equal(samples.reduce((n,r)=>n+r.rows.length,0),700);
 assert.deepEqual(samples[0].rows[0],[1,21,18,7,13,'OK']);
 const meta=records.at(-1);assert.equal(meta.status,'COMPLETE');assert.equal(meta.outcome,'FAIL');
 assert.equal(meta.retained,700);assert.equal(meta.invalid,0);assert.equal(meta.output_dropped,0);
 assert.doesNotMatch(lines.join(''),/token|account|SYNTHETIC|https:|\/Users\//i);
});
test('missing and malformed spans are retained as unknown while subsequent samples remain recorded',()=>{
 assert.equal(typeof timing.createActorTiming,'function');
 const lines=[],c=timing.createActorTiming('small',line=>lines.push(line));
 const invalid=[null,'oops','{"v":2,"entry_to_txn_ms":7,"json_tail_ms":13}',
  '{"v":1,"entry_to_txn_ms":-1,"json_tail_ms":13}','{"v":1,"entry_to_txn_ms":14,"json_tail_ms":13}',
  '{"v":1,"entry_to_txn_ms":7,"json_tail_ms":13,"secret":"forbidden"}',
  '{"v":1,"entry_to_txn_ms":1e999,"json_tail_ms":1e999}'];
 invalid.forEach((h,i)=>c.record('home',i,21,18,h));c.record('home',7,21,18,header);c.close('PASS');
 const records=lines.map(line=>JSON.parse(line.slice(line.indexOf('{'))));
 const rows=records.filter(r=>r.rows).flatMap(r=>r.rows);
 assert.equal(rows.length,8);assert.deepEqual(rows[0],[1,21,18,null,null,'MISSING']);
 assert(rows.slice(1,7).every(r=>r[3]===null&&r[4]===null&&r[5]==='INVALID'));
 assert.deepEqual(rows[7],[8,21,18,7,13,'OK']);assert.equal(records.at(-1).status,'PARTIAL');
 assert.doesNotMatch(lines.join(''),/forbidden|secret/);
});
test('duplicate, unknown routes and out-of-range samples cannot masquerade as complete evidence',()=>{
 assert.equal(typeof timing.createActorTiming,'function');
 const lines=[],c=timing.createActorTiming('capacity500',line=>lines.push(line));
 c.record('home',0,21,18,header);c.record('home',0,21,18,header);c.record('private',1,21,18,header);
 c.record('home',100,21,18,header);c.record('home',2,21,18,header);c.close('FAIL');
 const meta=JSON.parse(lines.at(-1).slice(lines.at(-1).indexOf('{')));
 assert.equal(meta.status,'PARTIAL');assert(meta.invalid>=3);assert.equal(meta.retained,2);
 assert.doesNotMatch(lines.join(''),/private/);
});
