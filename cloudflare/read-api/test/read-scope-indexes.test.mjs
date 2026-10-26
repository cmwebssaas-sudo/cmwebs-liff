import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {capacityDataset} from '../../../tests/fixtures/read-parity/capacity.mjs';
import {fixture,projectedDataset} from '../../../tests/fixtures/read-parity/runtime.mjs';

// Catches a missing/nonmatching index that leaves the actual scoped loader
// scanning legacy selections, or an index changing complete row content/order.
// This local entry wraps the existing fixture only to retain D1's rows_read;
// neither the production API nor the fixture's existing observer is changed.
const entry=`
import fixtureWorker from './read-access-fixture-worker.js';
export default {async fetch(request,env) {
  const stats={primary_sessions:0,single_calls:0,batch_calls:0,queries:[]},original=new WeakMap();
  function record(query,result) {
    if(!Number.isSafeInteger(result?.meta?.rows_read)||result.meta.rows_read<0)throw Error('TEST_ROWS_READ_UNAVAILABLE');
    stats.queries.push({...query,rows_read:result.meta.rows_read});
    return result;
  }
  function statement(raw,sql,params=[]) {
    const query={sql,params},wrapped={bind:(...values)=>statement(raw.bind(...values),sql,values),
      all:async()=>{stats.single_calls++;return record(query,await raw.all());}};
    original.set(wrapped,{raw,query});return wrapped;
  }
  const database={withSession:constraint=>{
    if(constraint!=='first-primary')throw Error('TEST_SESSION_NOT_PRIMARY');
    stats.primary_sessions++;const session=env.DB.withSession(constraint);
    return {prepare:sql=>statement(session.prepare(sql),sql),batch:async statements=>{
      stats.batch_calls++;const entries=statements.map(value=>original.get(value));
      if(entries.some(value=>!value))throw Error('TEST_STATEMENT_UNAVAILABLE');
      const results=await session.batch(entries.map(value=>value.raw));
      return results.map((result,index)=>record(entries[index].query,result));
    }};
  }};
  const response=await fixtureWorker.fetch(request,{...env,DB:database});
  return Response.json({status:response.status,body:await response.text(),
    fixture_stats:JSON.parse(response.headers.get('x-cmwebs-test-scoped-d1')),stats});
}};`;
const workspaceExpression=`upper(trim(COALESCE(json_extract("workspace_id",'$'),'')))`;
const migration=new URL('../migrations/0005_read_scope_indexes.sql',import.meta.url);
async function apply(db,sql) {
  const statements=sql.replace(/^--.*$/gm,'').split(';').map(sql=>sql.trim()).filter(Boolean);
  if(statements.length)await db.batch(statements.map(sql=>db.prepare(sql)));
}
async function inspect(mf) {
  const result=await (await mf.dispatchFetch('https://local.test/inspect')).json();
  assert.equal(result.status,200);
  const value=JSON.parse(result.body);
  assert.equal(value.dataset.V2_rooms.length,500);
  assert.equal(value.dataset.V2_properties.length,20);
  assert.equal(value.dataset.V2_bills.length,500);
  for(const [table,rows] of Object.entries(value.dataset))
    assert.ok(!rows.some(row=>row.workspace_id==='SYNTHETIC_W2'),table+' excludes foreign Workspace');
  assert.equal(result.stats.primary_sessions,1);
  assert.equal(result.fixture_stats.primary_sessions,1);
  assert.equal(result.stats.queries.length,result.fixture_stats.statements);
  assert.equal(result.stats.single_calls,result.fixture_stats.single_calls);
  assert.equal(result.stats.batch_calls,result.fixture_stats.batch_calls);
  return result;
}
async function edgeSelections(db) {
  const result={};
  for(const [name,value] of [['owned','SYNTHETIC_W1'],['blank',''],['foreign','SYNTHETIC_W2']]) {
    result[name]=(await db.prepare(`SELECT row_key FROM V2_payment_accounts WHERE row_key LIKE 'SYNTHETIC_INDEX_EDGE_%' AND ${workspaceExpression} = ? ORDER BY CAST(replica_source_row AS INTEGER),row_key`).bind(value).all()).results.map(row=>row.row_key);
  }
  assert.deepEqual(result,{owned:['SYNTHETIC_INDEX_EDGE_owned','SYNTHETIC_INDEX_EDGE_mixed'],
    blank:['SYNTHETIC_INDEX_EDGE_absent','SYNTHETIC_INDEX_EDGE_null','SYNTHETIC_INDEX_EDGE_empty','SYNTHETIC_INDEX_EDGE_spaces'],
    foreign:['SYNTHETIC_INDEX_EDGE_foreign']});
  return result;
}

test('Workspace expression indexes reduce actual primary-D1 scoped reads with byte-exact datasets',async()=>{
  const output=await build({stdin:{contents:entry,resolveDir:new URL('./',import.meta.url).pathname,sourcefile:'scope-index-observer.js'},
    bundle:true,write:false,format:'esm',target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:output.outputFiles[0].text,
    compatibilityDate:'2026-10-06',d1Databases:{DB:randomUUID()},bindings:{
      FIXTURE_NOW:String(Date.parse(fixture.now)),FIXTURE_IDENTITY:JSON.stringify({kind:'line',line_user_id:'SYNTHETIC_LINE1'})}}));
  try {
    const db=await mf.getD1Database('DB');
    // The same database is seeded once. Apply only the original schema first;
    // do not reseed/restart between the baseline and the new migration.
    for(const name of ['0001_read_replica.sql','0002_read_projection.sql','0003_read_projection.sql','0004_shadow_observation.sql'])
      await apply(db,await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
    const schema=JSON.parse(await readFile(new URL('../schema.json',import.meta.url),'utf8'));
    const input=projectedDataset(capacityDataset()),inserts=[];
    for(const [table,definition] of Object.entries(schema))for(const row of input[table])
      inserts.push(db.prepare(`INSERT INTO "${table}" (row_key,row_hash,synced_at,${definition.fields.map(key=>'"'+key+'"').join(',')}) VALUES (${Array(definition.fields.length+3).fill('?').join(',')})`)
        .bind(row[definition.key],'synthetic-index-hash',fixture.now,...definition.fields.map(key=>Object.hasOwn(row,key)?JSON.stringify(row[key]):null)));
    await new Promise(setImmediate);
    await db.batch(inserts);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM V2_rooms').first()).n,501,'owned rooms plus the existing foreign decoy');
    const edgeValues=[['owned','"SYNTHETIC_W1"'],['mixed','" synthetic_w1 "'],['absent',null],['null','null'],['empty','""'],['spaces','"  "'],['foreign','"SYNTHETIC_W2"']];
    await db.batch(edgeValues.map(([name,value],index)=>db.prepare('INSERT INTO V2_payment_accounts (row_key,row_hash,synced_at,workspace_id,payment_account_id,replica_source_row) VALUES (?,?,?,?,?,?)')
      .bind('SYNTHETIC_INDEX_EDGE_'+name,'synthetic-index-hash',fixture.now,value,JSON.stringify('SYNTHETIC_INDEX_EDGE_'+name),JSON.stringify(index+1000))));
    const before=await inspect(mf),beforeEdges=await edgeSelections(db);
    // Missing implementation intentionally acts as an empty migration in RED:
    // failure must come from unchanged scanning, rather than ENOENT.
    const sql=await readFile(migration,'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
    await apply(db,sql);
    const after=await inspect(mf),afterEdges=await edgeSelections(db);
    assert.equal(after.body,before.body,'complete access/dataset JSON and every row order');
    assert.deepEqual(afterEdges,beforeEdges);
    assert.deepEqual(after.stats.queries.map(({sql,params})=>({sql,params})),before.stats.queries.map(({sql,params})=>({sql,params})),
      'actual SQL, parameters, statement count and order');
    const stableStats=({summed_call_ms,...stats})=>stats;
    assert.deepEqual(stableStats(after.fixture_stats),stableStats(before.fixture_stats),'SDK calls/batches and primary session');
    const sum=result=>result.stats.queries.reduce((total,query)=>total+query.rows_read,0);
    const effect={before_rows_read:sum(before),after_rows_read:sum(after),statements:after.stats.queries.length,
      single_calls:after.stats.single_calls,batch_calls:after.stats.batch_calls,primary_sessions:after.stats.primary_sessions,
      batch_sizes:after.fixture_stats.batch_sizes,dataset_bytes:Buffer.byteLength(after.body),dataset_byte_exact:true};
    console.log('C6_SCOPE_INDEX_EFFECT '+JSON.stringify(effect));
    if(process.env.C6_SCOPE_INDEX_EVIDENCE)await writeFile(process.env.C6_SCOPE_INDEX_EVIDENCE,JSON.stringify({effect,before,after},null,2)+'\n');
    assert.ok(effect.after_rows_read<effect.before_rows_read,'Workspace indexes must reduce actual D1 rows_read: '+JSON.stringify(effect));
    const tables=Object.entries(schema).filter(([,definition])=>definition.fields.includes('workspace_id')).map(([table])=>table);
    assert.equal(tables.length,19);
    const indexes=(await db.prepare("SELECT name,tbl_name,sql FROM sqlite_master WHERE type='index' AND name LIKE 'idx_read_scope_%' ORDER BY tbl_name").all()).results;
    assert.equal(indexes.length,19);
    assert.deepEqual(indexes.map(row=>row.tbl_name),[...tables].sort());
    const plans=[];
    for(const table of tables) {
      const details=await db.prepare(`PRAGMA index_list("${table}")`).all();
      assert.equal(details.results.find(row=>row.name==='idx_read_scope_'+table)?.unique,0,table+' nonunique scope index');
      for(const workspace of ['SYNTHETIC_W1','']) {
        const plan=(await db.prepare(`EXPLAIN QUERY PLAN SELECT row_key FROM "${table}" WHERE ${workspaceExpression} = ? ORDER BY CAST(replica_source_row AS INTEGER),row_key LIMIT 10001`).bind(workspace).all()).results;
        assert.ok(plan.some(row=>/SEARCH/.test(row.detail)&&row.detail.includes('idx_read_scope_'+table)),table+' direct/blank search: '+JSON.stringify(plan));
        assert.ok(!plan.some(row=>/SCAN/.test(row.detail)),table+' does not scan');
        plans.push({table,workspace,plan});
      }
    }
    console.log('C6_SCOPE_INDEX_PLANS '+JSON.stringify({indexes:indexes.length,search_plans:plans.length}));
    if(process.env.C6_SCOPE_INDEX_EVIDENCE)await writeFile(process.env.C6_SCOPE_INDEX_EVIDENCE,JSON.stringify({effect,before,after,indexes,plans},null,2)+'\n');
  }finally{await mf.dispose();}
});
