import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {D1_PLUGIN} from 'miniflare';
const helper=await import('./read-d1-actor.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const raw=readFileSync(new URL('../node_modules/miniflare/dist/src/workers/d1/database.worker.js',import.meta.url),'utf8');

test('actor instrumentation rejects changed source and preserves sourceURL and package bytes',()=>{
 assert.equal(typeof helper.instrumentD1ActorSource,'function','strict actor transformer missing');
 const suffix='//# sourceURL=file:///synthetic/database.worker.js';
 const transformed=helper.instrumentD1ActorSource(raw+suffix);
 assert(transformed.endsWith(suffix));
 for(const value of [raw+' ',transformed,null,'x'.repeat(262145),raw+suffix+'\n',...['\r','\u2028','\u2029'].map(end=>raw+suffix+end+'throw Error("UNPINNED");')])assert.throws(()=>helper.instrumentD1ActorSource(value));
 assert.equal(readFileSync(new URL('../node_modules/miniflare/dist/src/workers/d1/database.worker.js',import.meta.url),'utf8'),raw);
});

test('actor spans include awaited txn and last-meta serialization, without changing rows or earlier metadata',async()=>{
 assert.equal(typeof helper.instrumentD1ActorSource,'function');
 const out=helper.instrumentD1ActorSource(raw);
 const method=out.slice(out.indexOf('  queryExecute = async'),out.indexOf('  #isExportPragma(queries)'))
  .replaceAll('this.#','this.').replace('queryExecute = async (req) =>','queryExecute: async function(req)').trim().replace(/;$/,'');
 const times=[10,17,23];
 const execute=runInNewContext('({'+method+'}).queryExecute',{
  performance:{now:()=>times.shift()},URL,
  D1QueriesSchema:{parse:v=>v},D1ResultsFormatSchema:{parse:v=>v},
  D1_SESSION_COMMIT_TOKEN_HTTP_HEADER:'x-cf-d1-session-commit-token',Response
 });
 const first={results:[{n:1}],meta:{duration:2}},last={results:[{n:2}],meta:{duration:3}};
 const response=await execute.call({isExportPragma:()=>false,txn:async()=>({results:[first,last],commitToken:'synthetic'})},
  new Request('https://local.test/query',{method:'POST',body:'[{"sql":"SELECT 1"}]'}));
 const actual=await response.json();
 assert.deepEqual(actual,[{results:[{n:1}],meta:{duration:2}},
  {results:[{n:2}],meta:{duration:3,cmwebs_test_actor_entry_to_txn_ms:7,cmwebs_test_actor_json_tail_ms:13}}]);
 assert.equal(response.headers.get('x-cf-d1-session-commit-token'),'synthetic');assert.equal(times.length,0);
});

test('scoped actor hook restores original plugin on success, construction failure, dispose failure and overlap',async()=>{
 assert.equal(typeof helper.withD1ActorTiming,'function');
 const original=D1_PLUGIN.getServices;
 assert.equal(await helper.withD1ActorTiming(async()=>{
  assert.notEqual(D1_PLUGIN.getServices,original);
  await assert.rejects(helper.withD1ActorTiming(async()=>{throw Error('must not enter');}),/OVERLAP/);
  return 9;
 }),9);
 assert.equal(D1_PLUGIN.getServices,original);
 for(const reason of ['constructor','dispose']){
  await assert.rejects(helper.withD1ActorTiming(async()=>{throw Error(reason);}),new RegExp(reason));
  assert.equal(D1_PLUGIN.getServices,original);
 }
});

test('service transform preserves unrelated services and all D1 bindings while refusing ambiguous module shape',()=>{
 assert.equal(typeof helper.instrumentD1Services,'function');
 const unrelated={name:'other',worker:{modules:[]}};
 const module={name:'database.worker.js',esModule:raw};
 const db={name:'d1:db',worker:{modules:[module],bindings:[{name:'DB',type:'durable'}]},metadata:{persist:true}};
 const result=helper.instrumentD1Services([unrelated,db]);
 assert.equal(result[0],unrelated);assert.equal(result[1].metadata,db.metadata);
 assert.equal(result[1].worker.bindings,db.worker.bindings);assert.equal(db.worker.modules[0].esModule,raw);
 assert.notEqual(result[1].worker.modules[0].esModule,raw);
 for(const services of [[db,db],[],[{...db,worker:{modules:[]}}],[{...db,worker:{modules:[{...module,name:'other'}]}}]])
  assert.throws(()=>helper.instrumentD1Services(services));
});
