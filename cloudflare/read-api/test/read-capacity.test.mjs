import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {originalGas,access,cases,fixture,plain,projectedDataset} from '../../../tests/fixtures/read-parity/runtime.mjs';
import {capacityDataset} from '../../../tests/fixtures/read-parity/capacity.mjs';
import {createClientTiming} from './read-client-timing.mjs';

const paths={home:'/v1/home?section=home',actions:'/v1/home?section=actions&read_view=summary',
 revenue:'/v1/revenue?from_month=2026-09&to_month=2026-10&as_of=2026-10-12',
 tenants:'/v1/tenants?read_view=summary',rooms:'/v1/rooms?include_archived=1',
 arrears:'/v1/arrears',properties:'/v1/properties?include_archived=1'};
function differences(a,b,path='$') {
 if(JSON.stringify(a)===JSON.stringify(b))return [];
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return [path];
 return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>differences(a[k],b[k],path+'.'+k));
}
test('500 owned rooms survive real D1 projection and all seven canonical read entries without scope or amount loss',async t=>{
 const input=capacityDataset();
 assert.equal(input.V2_rooms.filter(r=>r.workspace_id==='SYNTHETIC_W1').length,500,'capacity fixture must actually contain500 owned rooms');
 const projected=projectedDataset(input);
 const projectedAccess={...access,workspace:projected.V2_workspaces.find(r=>r.workspace_id===access.workspace.workspace_id),
  user:projected.V2_users.find(r=>r.user_id===access.user.user_id),
  membership:projected.V2_workspace_members.find(r=>r.membership_id===access.membership.membership_id),
  principal:projected.V2_landlords.find(r=>r.landlord_id===access.principal.landlord_id)};
 projectedAccess.principals=[projectedAccess.principal];
 const bundle=await build({entryPoints:[new URL('./read-fixture-worker.js',import.meta.url).pathname],bundle:true,write:false,format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,
  compatibilityDate:'2026-10-06',d1Databases:{DB:randomUUID()},bindings:{FIXTURE_ACCESS:JSON.stringify(projectedAccess),FIXTURE_NOW:String(Date.parse(fixture.now))}}));
 const clientTiming=createClientTiming('capacity500',line=>t.diagnostic(line));let timingOutcome='FAIL';
 try {
  const db=await mf.getD1Database('DB'),schema=JSON.parse(await readFile(new URL('../schema.json',import.meta.url),'utf8'));
  for(const name of ['0001_read_replica.sql','0002_read_projection.sql','0003_read_projection.sql']){
   const sql=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');
   await db.batch(sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
  }
  const inserts=[];
  for(const [table,def] of Object.entries(schema))for(const row of projected[table]){
   inserts.push(db.prepare(`INSERT INTO "${table}" (row_key,row_hash,synced_at,${def.fields.map(k=>'"'+k+'"').join(',')}) VALUES (${Array(def.fields.length+3).fill('?').join(',')})`)
    .bind(row[def.key],createHash('sha256').update(JSON.stringify(row)).digest('hex'),fixture.now,...def.fields.map(k=>Object.hasOwn(row,k)?JSON.stringify(row[k]):null)));
  }
  // Bound fixture insertion RPCs; the subsequent reads still use all source rows.
  for(let i=0;i<inserts.length;i+=100)await db.batch(inserts.slice(i,i+100));
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM V2_rooms').first()).n,501,'500 owned rooms and one foreign decoy are actually stored');
  const gas=originalGas(input,access),observed={};
  for(const c of cases){
   const response=await mf.dispatchFetch('https://local.test'+paths[c.route]);
   assert.equal(response.status,200,c.route+' response status');
   const raw=await response.text(),actual=JSON.parse(raw),expected=plain(gas[c.fn](...c.args));
   const delta=differences(expected,actual);
   assert.deepEqual(delta.slice(0,20),[],c.route+' canonical field differences; count='+delta.length);
   for(const forbidden of ['SYNTHETIC_PX','SYNTHETIC_RX','SYNTHETIC_PRIVATE_'])assert.equal(raw.includes(forbidden),false,c.route+' excludes foreign/private data');
   observed[c.route]=actual.data;
  }
  // Independent literals: 20 properties ×25 rooms; first250 occupied, next250 vacant.
  assert.equal(observed.home.home.room_count,500);
  assert.equal(observed.home.home.tenant_count,250);
  assert.equal(observed.rooms.rooms.length,500);
  assert.equal(observed.rooms.summary.room_count,500);
  assert.equal(observed.tenants.tenants.length,250);
  assert.equal(observed.properties.properties.length,20);
  assert.equal(observed.properties.summary.room_count,500);
  assert.equal(observed.properties.summary.occupied_room_count,250);
  assert.equal(observed.properties.summary.vacant_room_count,250);
  // Across BOTH months:126 unpaid +126 partial +124 paid;124 cancelled excluded.
  assert.equal(observed.revenue.kpis.receivable,3948000);
  assert.equal(observed.revenue.kpis.collected,1932000);
  assert.equal(observed.revenue.kpis.outstanding,2016000);
  assert.equal(observed.arrears.arrears.length,252);
  const timings={},violations=[];
  for(const c of cases){
   const samples=[],observations=[],stages={d1:[],decode:[],route:[]};
   for(let i=0;i<100;i++){
    const observation=clientTiming.begin(c.route,i);
    const start=performance.now(),response=await mf.dispatchFetch('https://local.test'+paths[c.route]);
    const dispatchAt=performance.now();
    assert.equal(response.status,200);const body=await response.arrayBuffer();const end=performance.now();samples.push(end-start);
    clientTiming.end(observation,start,dispatchAt,end);
    // Parse existing test-only headers after the unchanged full wall timer.
    // These are paired stages, not a subtraction or replacement for the gate.
    const parts=response.headers.get('server-timing')?.split(', ');assert.equal(parts?.length,3);
    const detail={};
    for(const part of parts){
     const match=/^(d1|decode|route);dur=(\d+\.\d{3})$/.exec(part);assert.ok(match);
     assert(!Object.hasOwn(detail,match[1]));const value=Number(match[2]);assert(Number.isFinite(value)&&value>=0);
     detail[match[1]]=value;stages[match[1]].push(value);
    }
    observations.push({index:i,wall_ms:Number((end-start).toFixed(3)),dispatch_ms:Number((dispatchAt-start).toFixed(3)),
     consume_ms:Number((end-dispatchAt).toFixed(3)),...detail,body_bytes:body.byteLength});
   }
   // Numeric timing diagnostics only, after the original100 measured requests.
   // Preserve request order before sorting; no Worker/body/identity data enters logs.
   const orderedSamples=samples.slice();
   samples.sort((a,b)=>a-b);const p95=samples[94];
   timings[c.route]={samples:100,p95_ms:Number(p95.toFixed(3))};
   console.log('C6_LOCAL_500_ROOM_SAMPLE '+JSON.stringify({route:c.route,...timings[c.route]}));
   console.log('C6_LOCAL_500_ROOM_DISTRIBUTION '+JSON.stringify({route:c.route,
    p95_full_ms:p95,max_ms:samples[99],over_50:samples.filter(ms=>ms>=50).length,ordered_ms:orderedSamples}));
   console.log('C6_LOCAL_500_ROOM_STAGES '+JSON.stringify({route:c.route,...timings[c.route],
    stage_p95_ms:Object.fromEntries(Object.entries(stages).map(([key,values])=>{
     assert.equal(values.length,100);values.sort((a,b)=>a-b);return [key,values[94]];
    })),slowest:observations.sort((a,b)=>b.wall_ms-a.wall_ms||a.index-b.index).slice(0,2)}));
   if(!(p95<50))violations.push(c.route+'500-room local HTTP/D1 p95='+p95.toFixed(3)+'ms');
  }
  console.log('C6_LOCAL_500_ROOM_LATENCY '+JSON.stringify(timings));
  // Retain every route's original100 full-wall samples even if an earlier
  // route fails. Every violation still fails the suite; no sample is replaced.
  assert.deepEqual(violations,[],violations.join('; '));
  timingOutcome='PASS';
 }finally{try{await mf.dispose();}catch(error){timingOutcome='FAIL';throw error;}finally{clientTiming.close(timingOutcome);}}
});

test('packed SQL projection preserves original D1 values, column order and safe own keys in workerd',async()=>{
 const fields=['absent','nullable','zero','negativeZero','decimal','enabled','disabled','empty','quotes','unicode','nested','__proto__','replica_source_row','replica_date_fields','date','quoted"key'];
 const values=[null,'null','0','-0','12.5','true','false','""',JSON.stringify('quote\'"\\\n'),'"台灣 🥧"','["x",0,false,null]','{"polluted":true}','37','"[\\"date\\"]"','"2026-10-12T00:00:00.000Z"','"quoted column"'];
 const modulePath=new URL('../src/read-dataset.js',import.meta.url).pathname;
 const bundle=await build({stdin:{contents:`import {decodeReplicaRows,decodePackedRows,packedSelection} from ${JSON.stringify(modulePath)};
  const fields=${JSON.stringify(fields)};
  export default {async fetch(request,env){const values=await request.json();
   const quoted=fields.map(field=>'"'+field.replaceAll('"','""')+'"');
   const source='WITH source AS (SELECT '+quoted.map(field=>'? AS '+field).join(',')+') ';
   const pair=await env.DB.batch([env.DB.prepare(source+'SELECT '+quoted.join(',')+' FROM source').bind(...values),
    env.DB.prepare(source+'SELECT '+packedSelection(fields)+' FROM source').bind(...values)]);
   const original=decodeReplicaRows(pair[0].results),packed=decodePackedRows(pair[1].results,fields);
   return Response.json({original,packed,originalKeys:Object.keys(original[0]),packedKeys:Object.keys(packed[0]),
    normalPrototype:Object.getPrototypeOf(packed[0])===Object.prototype,ownProto:Object.hasOwn(packed[0],'__proto__'),polluted:({}).polluted??null});}};`,
  resolveDir:new URL('.',import.meta.url).pathname},bundle:true,write:false,format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,
  compatibilityDate:'2026-10-06',d1Databases:{DB:randomUUID()}}));
 try{
  const response=await mf.dispatchFetch('https://local.test/packed-values',{method:'POST',body:JSON.stringify(values)});
  assert.equal(response.status,200);const actual=await response.json();
  assert.deepEqual(actual.packed,actual.original);
  assert.deepEqual(actual.packedKeys,actual.originalKeys);
  assert.deepEqual(actual.packedKeys,fields.filter(field=>field!=='absent'));
  assert.equal(Object.hasOwn(actual.packed[0],'absent'),false);
  assert.equal(Object.hasOwn(actual.packed[0],'nullable'),true);
  assert.equal(actual.packed[0].nullable,null);
  assert.equal(actual.packed[0].zero,0);
  assert.equal(actual.packed[0].disabled,false);
  assert.equal(actual.packed[0].empty,'');
  assert.equal(actual.packed[0].replica_date_fields,'["date"]');
  assert.equal(actual.packed[0]['quoted"key'],'quoted column');
  assert.equal(actual.normalPrototype,true);assert.equal(actual.ownProto,true);assert.equal(actual.polluted,null);
 }finally{await mf.dispose();}
});
