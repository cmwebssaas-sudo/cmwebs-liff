import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import schema from '../schema.json' with {type:'json'};

const tables=Object.keys(schema),now=Date.parse('2026-10-12T08:00:00Z'),fresh=new Date(now).toISOString();
// Preserve the pre-change SQL as an independent actual-D1 oracle, including
// its intentionally unchanged source_version-only tie selection.
const originalQuery=`SELECT source_version,completed_at,
        EXISTS (SELECT 1 FROM sync_runs AS pending WHERE pending.sheet=? AND pending.status='receiving'
          AND pending.source_version > completed.source_version) AS pending
        FROM sync_runs AS completed WHERE completed.sheet=? AND completed.mode='snapshot'
          AND completed.status='completed' ORDER BY completed.source_version DESC LIMIT 1`;

async function setup() {
  const modulePath=new URL('../src/read-dataset.js',import.meta.url).pathname;
  const source=`import {createReadDatasetLoader} from ${JSON.stringify(modulePath)};
    const tables=${JSON.stringify(tables)},query=${JSON.stringify(originalQuery)},now=${now};
    export default {async fetch(request,env){
      const input=await request.json(),session=env.DB.withSession('first-primary');
      const oracle=await session.batch(tables.map(table=>session.prepare(query).bind(table,table)));
      const oracleRows=oracle.map(result=>result.results[0]||null);
      let oracleCode=null;for(const row of oracleRows){
        if(!row||row.pending){oracleCode='READ_SYNC_INCOMPLETE';break;}
        const time=Date.parse(row.completed_at);
        if(!Number.isFinite(time)||time>now+300000||now-time>26*3600000){oracleCode='READ_SYNC_STALE';break;}
      }
      let observed=[],statements=0,singleCalls=0,batchCalls=0,sqlBytes=0,boundParameters=0;
      function mutate(result){
        if(input.fault==='failed')return {...result,success:false};
        if(input.fault==='no-results')return {...result,results:null};
        if(input.fault==='missing')return {...result,results:result.results.slice(1)};
        if(input.fault==='extra')return {...result,results:[...result.results,result.results[0]]};
        if(input.fault==='duplicate-ordinal')return {...result,results:result.results.map((row,index)=>index===1?{...row,replica_table_ordinal:0}:row)};
        if(input.fault==='wrong-ordinal')return {...result,results:result.results.map((row,index)=>index===0?{...row,replica_table_ordinal:tables.length}:row)};
        if(input.fault==='string-ordinal')return {...result,results:result.results.map(row=>({...row,replica_table_ordinal:String(row.replica_table_ordinal)}))};
        return result;
      }
      const originals=new WeakMap();
      function wrap(raw,sql,parameters=0){const value={bind:(...args)=>wrap(raw.bind(...args),sql,args.length),all:async()=>{
        statements++;singleCalls++;if(input.fault==='throw')throw Error('Synthetic D1 failure');
        sqlBytes=new TextEncoder().encode(sql).length;boundParameters=parameters;
        const result=await raw.all();observed=result.results;return mutate(result);
      }};originals.set(value,raw);return value;}
      const database={withSession:constraint=>{
        if(constraint!=='first-primary')throw Error('Not primary');
        return {prepare:sql=>wrap(session.prepare(sql),sql),batch:async queries=>{
          statements+=queries.length;batchCalls++;const results=await session.batch(queries.map(q=>originals.get(q)));
          observed=results.flatMap((result,index)=>result.results.map(row=>({...row,replica_table_ordinal:index})));
          return results;
        }};
      }};
      let code=null,dataset,errorMessage;
      try{const loader=createReadDatasetLoader(database,{now:input.clock??now});
        if(input.operation==='dataset')dataset=await loader.loadDataset({success:true,workspace:{workspace_id:'SYNTHETIC_W1'},principals:[],user:{user_id:'SYNTHETIC_OWNER'}});
        else await loader.checkReplica();
      }catch(error){code=error.code||'THREW';errorMessage=error.message;}
      return Response.json({code,oracleCode,oracleRows,observed,statements,singleCalls,batchCalls,sqlBytes,boundParameters,members:dataset?.V2_workspace_members.length,errorMessage});
    }};`;
  const output=await build({stdin:{contents:source,resolveDir:new URL('.',import.meta.url).pathname},bundle:true,write:false,format:'esm',target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:0,modules:true,script:output.outputFiles[0].text,compatibilityDate:'2026-10-06',d1Databases:{DB:randomUUID()}}));
  try {
    const db=await mf.getD1Database('DB');
    for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(file=>file.endsWith('.sql')).sort()){
      const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
      await db.batch(sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
    }
    let sequence=0;
    const marker=(table,version=100,status='completed',completed=fresh,mode='snapshot')=>({snapshot_id:'SYNTHETIC_MARKER_'+(++sequence),sheet:table,source_version:version,status,completed_at:completed,mode});
    async function seed(rows=tables.map(table=>marker(table))){
      await db.batch([db.prepare('DELETE FROM sync_runs'),...rows.map(row=>db.prepare(`INSERT INTO sync_runs(snapshot_id,sheet,mode,source_version,batch_count,row_count,snapshot_hash,status,started_at,completed_at)
        VALUES(?,?,?,?,1,0,'synthetic',?,?,?)`).bind(row.snapshot_id,row.sheet,row.mode,row.source_version,row.status,fresh,row.completed_at))]);
    }
    const invoke=async(input={})=>{
      const response=await mf.dispatchFetch('https://local.test/check',{method:'POST',body:JSON.stringify(input)});
      assert.equal(response.status,200);return await response.json();
    };
    return {mf,db,marker,seed,invoke};
  }catch(error){await mf.dispose();throw error;}
}

test('all twenty freshness markers use one actual D1 statement without changing original marker rows',async()=>{
  const s=await setup();try{
    await s.seed();const actual=await s.invoke();assert.equal(actual.code,null,actual.errorMessage);
    assert.equal(actual.statements,1,'freshness reads must pay one statement rather than20');
    assert.equal(actual.singleCalls,1);assert.equal(actual.batchCalls,0);
    assert.equal(actual.boundParameters,40);assert(actual.sqlBytes>0&&actual.sqlBytes<20000);
    assert.deepEqual(actual.observed.map(({replica_table_ordinal,...row})=>row),actual.oracleRows);
    assert.deepEqual(actual.observed.map(row=>row.replica_table_ordinal),tables.map((_,index)=>index));
  }finally{await s.mf.dispose();}
});

test('every table retains original latest/tie/pending and freshness decisions in actual D1',async()=>{
  const s=await setup();try{
    for(const table of tables){
      const base=()=>tables.filter(name=>name!==table).map(name=>s.marker(name));
      const cases=[
        ['missing',[], 'READ_SYNC_INCOMPLETE'],
        ['older receiving',[s.marker(table),s.marker(table,99,'receiving')],null],
        ['equal receiving',[s.marker(table),s.marker(table,100,'receiving')],null],
        ['newer receiving',[s.marker(table),s.marker(table,101,'receiving')],'READ_SYNC_INCOMPLETE'],
        ['latest fresh',[s.marker(table,99,'completed','invalid'),s.marker(table,100)],null],
        ['latest stale',[s.marker(table,99),s.marker(table,100,'completed',new Date(now-26*3600000-1).toISOString())],'READ_SYNC_STALE'],
        ['freshness exact lower bound',[s.marker(table,100,'completed',new Date(now-26*3600000).toISOString())],null],
        ['future exact bound',[s.marker(table,100,'completed',new Date(now+300000).toISOString())],null],
        ['future beyond bound',[s.marker(table,100,'completed',new Date(now+300001).toISOString())],'READ_SYNC_STALE'],
        ['invalid completed time',[s.marker(table,100,'completed','invalid')],'READ_SYNC_STALE'],
        ['null completed time',[s.marker(table,100,'completed',null)],'READ_SYNC_STALE'],
        ['patch is not a snapshot',[s.marker(table,100,'completed',fresh,'patch')],'READ_SYNC_INCOMPLETE'],
        ['newer completed patch does not replace snapshot',[s.marker(table),s.marker(table,101,'completed',fresh,'patch')],null],
        ['receiving patch still blocks',[s.marker(table),s.marker(table,101,'receiving',fresh,'patch')],'READ_SYNC_INCOMPLETE'],
        ['tie insertion fresh then invalid',[s.marker(table,100),s.marker(table,100,'completed','invalid')],undefined],
        ['tie insertion invalid then fresh',[s.marker(table,100,'completed','invalid'),s.marker(table,100)],undefined]
      ];
      for(const [name,rows,want] of cases){
        await s.seed([...base(),...rows]);const actual=await s.invoke();
        if(want!==undefined)assert.equal(actual.oracleCode,want,table+' '+name+' independent expectation');
        assert.equal(actual.code,actual.oracleCode,table+' '+name+' decision parity');
        assert.deepEqual(actual.observed.map(({replica_table_ordinal,...row})=>row),actual.oracleRows.filter(Boolean),table+' '+name+' exact selected marker parity');
      }
    }
    await s.seed([s.marker('UNEXPECTED_TABLE',200)]);assert.equal((await s.invoke()).code,'READ_SYNC_INCOMPLETE');
    await s.seed();assert.equal((await s.invoke({clock:now+26*3600000+1})).code,'READ_SYNC_STALE');
    assert.equal((await s.invoke({clock:now-300001})).code,'READ_SYNC_STALE');
  }finally{await s.mf.dispose();}
});

test('table-order freshness error precedence survives a later missing marker',async()=>{
  const s=await setup();try{
    const stale=new Date(now-26*3600000-1).toISOString();
    for(const [missing,invalid,want] of [[19,0,'READ_SYNC_STALE'],[0,19,'READ_SYNC_INCOMPLETE']]){
      await s.seed(tables.flatMap((table,index)=>index===missing?[]:[s.marker(table,100,'completed',index===invalid?stale:fresh)]));
      const actual=await s.invoke();assert.equal(actual.oracleCode,want);assert.equal(actual.code,want);
    }
  }finally{await s.mf.dispose();}
});

test('missing markers and malformed single-query ordinals/results fail closed before accepting freshness',async()=>{
  const s=await setup();try{
    await s.seed();for(const fault of ['failed','no-results','missing','extra','duplicate-ordinal','wrong-ordinal','string-ordinal']){
      assert.equal((await s.invoke({fault})).code,'READ_SYNC_INCOMPLETE',fault);
    }
    assert.equal((await s.invoke({fault:'throw'})).code,'THREW','database failure is never fresh');
  }finally{await s.mf.dispose();}
});

test('freshness consolidation leaves per-selection ten-thousand operational row sentinel unchanged',async()=>{
  const s=await setup();try{
    await s.seed();
    await s.db.prepare(`WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM numbers WHERE n<10000)
      INSERT INTO V2_workspace_members(row_key,row_hash,synced_at,membership_id,workspace_id,replica_source_row)
      SELECT 'SYNTHETIC_M'||n,'synthetic',?,json_quote('SYNTHETIC_M'||n),json_quote('SYNTHETIC_W1'),CAST(n AS TEXT) FROM numbers`).bind(fresh).run();
    const accepted=await s.invoke({operation:'dataset'});assert.equal(accepted.code,null);assert.equal(accepted.members,10000);
    await s.db.prepare(`INSERT INTO V2_workspace_members(row_key,row_hash,synced_at,membership_id,workspace_id,replica_source_row)
      VALUES('SYNTHETIC_OVERFLOW','synthetic',?,json_quote('SYNTHETIC_OVERFLOW'),json_quote('SYNTHETIC_W1'),'10001')`).bind(fresh).run();
    assert.equal((await s.invoke({operation:'dataset'})).code,'READ_REPLICA_UNAVAILABLE');
  }finally{await s.mf.dispose();}
});
