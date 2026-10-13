import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../cloudflare/read-api/package.json',import.meta.url));
const {parse}=require('acorn');
const fixtureUrl=new URL('../cloudflare/read-api/test/read-access-d1.test.mjs',import.meta.url);
const source=readFileSync(fixtureUrl,'utf8');
const node=parse(source,{ecmaVersion:'latest',sourceType:'module'}).body
  .find(node=>node.type==='FunctionDeclaration'&&node.id.name==='setup');
assert.ok(node,'Read access fixture setup exists');
// Exercise the actual initializer without registering its Worker tests. Only
// external build/D1/Miniflare IO is replaced to force otherwise intermittent
// setup failures; initializer ordering and cleanup are the source under test.
const setupSource=source.slice(node.start,node.end)
  .replaceAll('import.meta.url',JSON.stringify(fixtureUrl.href));

function runtime(failAt,cleanupFailure=false){
  const primary=new Error('Synthetic fixture initialization failure');
  const cleanup=new Error('Synthetic fixture cleanup failure');
  let disposed=0,batches=0;
  const schema={V2_rooms:{key:'room_id',fields:['room_id']}};
  const db={prepare:()=>({bind(){return this;}}),async batch(){
    batches++;if(batches===failAt)throw primary;
  }};
  class FixtureRuntime{
    async getD1Database(){if(failAt==='database')throw primary;return db;}
    async dispose(){disposed++;if(cleanupFailure)throw cleanup;}
  }
  const context=vm.createContext({URL,Date,JSON,AggregateError,Response,
    build:async()=>({outputFiles:[{text:'synthetic-fixture-worker'}]}),
    authorityRuntime:()=>({data:{}}),structuredClone,Miniflare:FixtureRuntime,
    convertV4MiniflareOptions:options=>options,randomUUID:()=> 'synthetic-fixture-id',
    authoritySecret:'synthetic-authority-secret',fixture:{now:'2026-10-12T00:00:00Z'},
    projectedDataset:()=>({V2_rooms:[{room_id:'SYNTHETIC_ROOM'}]}),
    readdir:async()=>['001.sql'],readFile:async url=>url.pathname.endsWith('schema.json')
      ?JSON.stringify(schema):'CREATE TABLE synthetic_room (room_id TEXT);'
  });
  vm.runInContext(setupSource,context,{filename:fixtureUrl.pathname});
  return {setup:()=>context.setup({}),primary,cleanup,disposed:()=>disposed,batches:()=>batches};
}

for(const [phase,at] of [['database handle','database'],['migration',1],['row seed',2],['sync marker seed',3]]){
  test('failed read fixture '+phase+' releases its runtime before rethrowing the original failure',async()=>{
    const h=runtime(at);
    await assert.rejects(h.setup,error=>error===h.primary);
    assert.equal(h.disposed(),1,'Failed setup must release its only runtime');
    if(typeof at==='number')assert.equal(h.batches(),at,'No later seed work or retry');
  });
}
test('successful read fixture leaves its runtime owned by the caller',async()=>{
  const h=runtime(),result=await h.setup();
  assert.ok(result.mf);assert.ok(result.db);assert.ok(result.authority);
  assert.equal(h.batches(),3);assert.equal(h.disposed(),0);
  await result.mf.dispose();assert.equal(h.disposed(),1);
});
test('failed read fixture preserves both initialization and cleanup failures',async()=>{
  const h=runtime(2,true);
  await assert.rejects(h.setup,error=>{
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors,[h.primary,h.cleanup]);
    assert.equal(error.cause,h.primary);return true;
  });
  assert.equal(h.disposed(),1,'Cleanup attempted once');assert.equal(h.batches(),2);
});
