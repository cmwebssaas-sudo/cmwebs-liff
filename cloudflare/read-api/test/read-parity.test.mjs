import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { originalGas, access, cases, fixture, plain, projectedDataset, richDataset } from '../../../tests/fixtures/read-parity/runtime.mjs';

const httpPaths={home:'/v1/home?section=home',actions:'/v1/home?section=actions&read_view=summary',
  revenue:'/v1/revenue?from_month=2026-09&to_month=2026-10&as_of=2026-10-12',
  tenants:'/v1/tenants?read_view=summary',rooms:'/v1/rooms?include_archived=1',
  arrears:'/v1/arrears',properties:'/v1/properties?include_archived=1'};

function differingPaths(left,right,path='$') {
  if(JSON.stringify(left)===JSON.stringify(right)) return [];
  if(left===null||right===null||typeof left!=='object'||typeof right!=='object') return [path];
  return [...new Set([...Object.keys(left),...Object.keys(right)])].flatMap(key=>differingPaths(left[key],right[key],path+'.'+key));
}
test('all six routes match original GAS after whitelist projection and actual local D1 storage', async () => {
  const input=richDataset();
  const publicUrl='https://synthetic-c2.z3house.com/spaces/synthetic-room/';
  const photo='https://synthetic-c2.z3house.com/api/public/media/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  input.V2_rooms[0].room_website_url=publicUrl;
  const publicResources={[publicUrl]:{status:200,body:'<section class="space-detail__media"><img src="'+photo+'"><img src="https://private.invalid/forbidden"></section>'}};
  // Use deliberately non-key order. D1 row_key ordering must not substitute
  // for source Sheet order when the GAS reader has stable ties/fallbacks.
  for(const rows of Object.values(input)) rows.reverse();
  const projected=projectedDataset(input);
  const projectedAccess={...access,workspace:projected.V2_workspaces.find(row=>row.workspace_id===access.workspace.workspace_id),
    user:projected.V2_users.find(row=>row.user_id===access.user.user_id),
    membership:projected.V2_workspace_members.find(row=>row.membership_id===access.membership.membership_id),
    principal:projected.V2_landlords.find(row=>row.landlord_id===access.principal.landlord_id)};
  projectedAccess.principals=[projectedAccess.principal];
  const bundle=await build({entryPoints:[new URL('./read-fixture-worker.js',import.meta.url).pathname],bundle:true,write:false,format:'esm',target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,
    compatibilityDate:'2026-10-06',d1Databases:{DB:randomUUID()},
    bindings:{FIXTURE_ACCESS:JSON.stringify(projectedAccess),FIXTURE_NOW:String(Date.parse(fixture.now)),FIXTURE_PUBLIC_RESOURCES:JSON.stringify(publicResources)}}));
  try {
    const db=await mf.getD1Database('DB');
    const schema=JSON.parse(await readFile(new URL('../schema.json',import.meta.url),'utf8'));
    for(const file of ['0001_read_replica.sql','0002_read_projection.sql']) {
      const migration=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
      await db.batch(migration.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
    }
    const inserts=[];
    for(const [table,definition] of Object.entries(schema)) for(const fields of projected[table]) {
      inserts.push(db.prepare(`INSERT INTO "${table}" (row_key,row_hash,synced_at,${definition.fields.map(key=>'"'+key+'"').join(',')}) VALUES (${Array(definition.fields.length+3).fill('?').join(',')})`)
        .bind(fields[definition.key],createHash('sha256').update(JSON.stringify(fields)).digest('hex'),fixture.now,...definition.fields.map(key=>Object.hasOwn(fields,key)?JSON.stringify(fields[key]):null)));
    }
    await db.batch(inserts);
    const decoded=await (await mf.dispatchFetch('https://local.test/read',{method:'POST',body:JSON.stringify({inspect:true})})).json();
    for(const [table,definition] of Object.entries(schema)) {
      const expected=projected[table];
      assert.deepEqual(decoded[table],expected,table+' scalar round trip');
    }
    const gas=originalGas(input,access,{publicResources}), differences={};
    for(const item of cases) {
      const expected=plain(gas[item.fn](...item.args));
      const response=await mf.dispatchFetch('https://local.test'+httpPaths[item.route]);
      assert.equal(response.headers.get('cache-control'),'no-store');
      const actual=await response.json();
      assert.equal(response.status,200,item.route+': '+actual.code);
      assert.ok(response.headers.has('x-cmwebs-test-d1'),'test-only D1 operation metadata must be present');
      const paths=differingPaths(expected,actual);
      if(paths.length) differences[item.route]=paths;
    }
    assert.deepEqual(differences,{},'field parity after D1 projection');
    function metrics(response) {
      const header=response.headers.get('server-timing');assert.ok(header,'test-only stage timings');
      const parts=header.split(', ');assert.equal(parts.length,3);const result={};
      for(const part of parts){const match=/^(d1|decode|route);dur=(\d+\.\d{3})$/.exec(part);assert.ok(match);assert(!Object.hasOwn(result,match[1]));result[match[1]]=Number(match[2]);}
      const internal=JSON.parse(response.headers.get('x-cmwebs-test-d1'));
      assert.deepEqual(Object.keys(internal).sort(),['internal_ms','queries','rows_read']);
      assert.equal(internal.queries,Object.keys(schema).length);assert(Number.isSafeInteger(internal.rows_read)&&internal.rows_read>=Object.values(projected).reduce((n,rows)=>n+rows.length,0));assert(Number.isFinite(internal.internal_ms)&&internal.internal_ms>=0);
      return {...result,...internal};
    }
    const timings={},violations=[];
    for(const item of cases) {
      const samples=[],observations=[],stages={d1:[],decode:[],route:[],internal_ms:[]};
      for(let index=0;index<100;index++) {
        const start=performance.now();
        const response=await mf.dispatchFetch('https://local.test'+httpPaths[item.route]);
        assert.equal(response.status,200);
        await response.arrayBuffer();
        const elapsed=performance.now()-start; samples.push(elapsed);const detail=metrics(response);observations.push({index,wall_ms:Number(elapsed.toFixed(3)),...detail});for(const stage of Object.keys(stages))stages[stage].push(detail[stage]);
      }
      samples.sort((a,b)=>a-b);
      const p95=samples[94];
      timings[item.route]={samples:samples.length,p95_ms:Number(p95.toFixed(3)),server_p95_ms:Object.fromEntries(Object.entries(stages).map(([name,values])=>{assert.equal(values.length,100);values.sort((a,b)=>a-b);return [name,values[94]];})),over_50ms:samples.filter(ms=>ms>=50).length,slowest:observations.sort((a,b)=>b.wall_ms-a.wall_ms||a.index-b.index).slice(0,5)};
      if(p95>=50)violations.push(item.route+' local HTTP/D1 p95='+p95.toFixed(3)+' ms');
    }
    console.log('C2_LOCAL_READ_LATENCY '+JSON.stringify(timings));
    // All100 samples contribute to the original p95; paired slow samples are
    // diagnostic only. No retry, warmup, exclusion or threshold relaxation.
    assert.deepEqual(violations,[],violations.join('; '));
  } finally { await mf.dispose(); }
});
