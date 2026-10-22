import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {packedSelection} from '../src/read-dataset.js';
import {capacityDataset} from '../../../tests/fixtures/read-parity/capacity.mjs';
import {fixture,projectedDataset} from '../../../tests/fixtures/read-parity/runtime.mjs';

// Exercise the real scoped SQL/parameters and shared unscoped ordering. No
// duration or percentile from this functional test is an acceptance sample.
const entry=`import worker from './read-access-fixture-worker.js';
export default {async fetch(request,env){
 const queries=[],original=new WeakMap();
 function record(query,result){if(!Number.isSafeInteger(result.meta?.rows_read))throw Error('ROWS_READ_MISSING');queries.push({...query,rows_read:result.meta.rows_read});return result;}
 function wrap(raw,sql,params=[]){const value={bind:(...args)=>wrap(raw.bind(...args),sql,args),all:async()=>record({sql,params},await raw.all())};original.set(value,{raw,sql,params});return value;}
 const DB={withSession:constraint=>{if(constraint!=='first-primary')throw Error('NOT_PRIMARY');const session=env.DB.withSession(constraint);return {prepare:sql=>wrap(session.prepare(sql),sql),batch:async values=>{const entries=values.map(v=>original.get(v));if(entries.some(v=>!v))throw Error('WRAP_MISSING');const results=await session.batch(entries.map(v=>v.raw));return results.map((r,i)=>record({sql:entries[i].sql,params:entries[i].params},r));}};}};
 const response=await worker.fetch(request,{...env,DB});return Response.json({status:response.status,body:await response.text(),queries,counts:JSON.parse(response.headers.get('x-cmwebs-test-scoped-d1'))});}};`;
const hot=['V2_rooms','V2_contracts','V2_bills'];
async function apply(db,sql){const statements=sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);if(statements.length)await db.batch(statements.map(s=>db.prepare(s)));}
const stableCounts=({summed_call_ms,...counts})=>counts;
const queryInputs=queries=>queries.map(({sql,params})=>({sql,params}));

test('source-order indexes eliminate actual scoped and unscoped sorts without changing rows scopes or calls',async()=>{
 const bundle=await build({stdin:{contents:entry,resolveDir:new URL('.',import.meta.url).pathname,sourcefile:'source-order-observer.js'},bundle:true,write:false,format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-06',d1Databases:{DB:randomUUID()},bindings:{FIXTURE_NOW:String(Date.parse(fixture.now)),FIXTURE_IDENTITY:JSON.stringify({kind:'line',line_user_id:'SYNTHETIC_LINE1'})}}));
 try{
  const db=await mf.getD1Database('DB'),schema=JSON.parse(await readFile(new URL('../schema.json',import.meta.url),'utf8'));
  for(const name of ['0001_read_replica.sql','0002_read_projection.sql','0003_read_projection.sql','0004_shadow_observation.sql','0005_read_scope_indexes.sql','0006_shadow_auth_kind.sql'])await apply(db,await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const data=projectedDataset(capacityDataset()),inserts=[];
  for(const [table,def] of Object.entries(schema))for(const row of data[table])inserts.push(db.prepare(`INSERT INTO "${table}" (row_key,row_hash,synced_at,${def.fields.map(k=>'"'+k+'"').join(',')}) VALUES (${Array(def.fields.length+3).fill('?').join(',')})`).bind(row[def.key],'synthetic-order',fixture.now,...def.fields.map(k=>Object.hasOwn(row,k)?JSON.stringify(row[k]):null)));
  for(let offset=0;offset<inserts.length;offset+=100)await db.batch(inserts.slice(offset,offset+100));
  // Foreign-only edge rows preserve the owned500-room fixture. Literal order
  // checks exercise numeric casts, SQL/JSON null, nonnumeric input and ties.
  const edges=[['negative','-1'],['nullsql',null],['nulljson','null'],['nonnumeric','"bad"'],['zero','0'],['two_a','2'],['two_b','2'],['ten','10']];
  for(const table of hot)await db.batch(edges.map(([key,value])=>db.prepare(`INSERT INTO "${table}" (row_key,row_hash,synced_at,workspace_id,replica_source_row) VALUES (?,?,?,?,?)`).bind('SYNTHETIC_ORDER_EDGE_'+key,'synthetic-order',fixture.now,'"SYNTHETIC_W2"',value)));
  async function inspect(path){const value=await(await mf.dispatchFetch('https://local.test'+path)).json();assert.equal(value.status,200);return value;}
  const before=await inspect('/inspect'),httpBefore=await inspect('/v1/properties?include_archived=1');
  const dataset=JSON.parse(before.body).dataset;assert.equal(dataset.V2_rooms.length,500);
  for(const rows of Object.values(dataset))assert(!rows.some(row=>row.workspace_id==='SYNTHETIC_W2'));
  const plans=[];
  for(const table of hot){
   const prefix=`SELECT ${packedSelection(schema[table].fields)} FROM "${table}" WHERE `;
   const actual=before.queries.filter(q=>q.sql.startsWith(prefix));assert(actual.length>=2,table+' direct and blank/legacy paths');
   assert(actual.some(q=>q.params.length===1&&q.params[0]==='SYNTHETIC_W1'));
   assert(actual.some(q=>q.sql.includes(" = '' AND ")),table+' captured blank/legacy parent exclusion query');
   for(const q of actual)plans.push({table,kind:'actual-scoped',sql:q.sql,params:q.params});
   plans.push({table,kind:'shared-unscoped',sql:`SELECT ${packedSelection(schema[table].fields)} FROM "${table}" ORDER BY CAST(replica_source_row AS INTEGER),row_key`,params:[]});
  }
  async function observe(){const out=[];for(const q of plans){const result=await db.prepare(q.sql).bind(...q.params).all();const plan=(await db.prepare('EXPLAIN QUERY PLAN '+q.sql).bind(...q.params).all()).results;out.push({...q,serialized:JSON.stringify(result.results),rows_read:result.meta.rows_read,plan});}return out;}
  async function edgeOrder(){const out={};for(const table of hot){out[table]=(await db.prepare(`SELECT row_key FROM "${table}" WHERE row_key LIKE 'SYNTHETIC_ORDER_EDGE_%' ORDER BY CAST(replica_source_row AS INTEGER),row_key`).all()).results.map(row=>row.row_key.replace('SYNTHETIC_ORDER_EDGE_',''));assert.deepEqual(out[table],['nullsql','negative','nonnumeric','nulljson','zero','two_a','two_b','ten']);}return out;}
  const baseline=await observe(),beforeEdges=await edgeOrder();
  assert(baseline.every(q=>q.plan.some(row=>/TEMP B-TREE.*ORDER BY/.test(row.detail))),'the baseline must really sort');
  // Missing migration acts as no change in RED: fail on real retained sorts.
  const migration=await readFile(new URL('../migrations/0007_read_source_order_indexes.sql',import.meta.url),'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
  const definitions=migration.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
  const sourceOnly=definitions.filter(s=>s.startsWith('CREATE INDEX "idx_read_order_'));
  await apply(db,sourceOnly.join(';'));
  const orderOnly=await observe();
  for(const [i,q] of baseline.entries()){
   assert.equal(orderOnly[i].serialized,q.serialized);
   if(q.kind==='shared-unscoped')assert(!orderOnly[i].plan.some(row=>/TEMP B-TREE.*ORDER BY/.test(row.detail)),q.table+' source-order index removes unscoped sort');
  }
  await apply(db,definitions.filter(s=>!sourceOnly.includes(s)).join(';'));
  const indexed=await observe(),after=await inspect('/inspect'),httpAfter=await inspect('/v1/properties?include_archived=1');
  assert.equal(after.body,before.body,'complete actual scoped access/dataset bytes');
  assert.equal(httpAfter.body,httpBefore.body,'complete actual property HTTP bytes');
  assert.deepEqual(await edgeOrder(),beforeEdges);
  for(const [a,z] of [[before,after],[httpBefore,httpAfter]]){
   assert.deepEqual(queryInputs(z.queries),queryInputs(a.queries),'every original SQL, parameter, LIMIT and query order');
   assert.deepEqual(stableCounts(z.counts),stableCounts(a.counts),'primary session, statement and batch counts');
   assert(z.queries.reduce((s,q)=>s+q.rows_read,0)<=a.queries.reduce((s,q)=>s+q.rows_read,0),'actual scoped rows_read must not increase');
  }
  for(const [i,q] of baseline.entries()){
   const next=indexed[i];assert.equal(next.serialized,q.serialized,'complete query rows and order');
   assert(next.rows_read<=q.rows_read,'individual rows_read must not increase');
   assert(!next.plan.some(row=>/TEMP B-TREE.*ORDER BY/.test(row.detail)),q.table+' '+q.kind+' must avoid temporary ordering');
   if(q.kind==='actual-scoped')assert(next.plan.some(row=>/SEARCH/.test(row.detail)&&row.detail.includes('idx_read_workspace_order_')),q.table+' keeps Workspace index search');
  }
  const indexes=(await db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND (name LIKE 'idx_read_order_%' OR name LIKE 'idx_read_workspace_order_%')").all()).results;assert.equal(indexes.length,6);
  for(const table of hot){const list=(await db.prepare(`PRAGMA index_list("${table}")`).all()).results;for(const prefix of ['idx_read_order_','idx_read_workspace_order_'])assert.equal(list.find(row=>row.name===prefix+table)?.unique,0,'ordering must not add uniqueness rules');}
  console.log('C6_SOURCE_ORDER_INDEX_EFFECT '+JSON.stringify({indexes:6,query_plans:plans.length,order_only_scoped_sorts:orderOnly.filter(q=>q.kind==='actual-scoped'&&q.plan.some(row=>/TEMP B-TREE.*ORDER BY/.test(row.detail))).length,owned_rooms:500,dataset_byte_exact:true,http_byte_exact:true,queries_unchanged:true,sorts_removed:plans.length,scope:'FUNCTIONAL_NOT_LATENCY_ACCEPTANCE'}));
 }finally{await mf.dispose();}
});
