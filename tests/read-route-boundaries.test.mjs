import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReadCalculator } from '../cloudflare/read-api/src/read-calculator.js';
import { createReadServices } from '../cloudflare/read-api/src/read-runtime.js';
import { loadPublicRoomResources } from '../cloudflare/read-api/src/public-room-resources.js';
import { serveReadRoute } from '../cloudflare/read-api/src/read-routes.js';
import worker from '../cloudflare/read-api/src/index.js';
import { dataset,access,fixture,plain,richDataset,projectedDataset,originalGas } from './fixtures/read-parity/runtime.mjs';

test('production read routes stay closed even with fabricated fixture or query identity',async()=>{
  for(const path of ['home','revenue','tenants','rooms','arrears','properties']) {
    const response=await worker.fetch(new Request('https://local.test/v1/'+path+'?workspace_id=SYNTHETIC_W1'),{FIXTURE_ACCESS:JSON.stringify(access),DB:{prepare(){throw new Error('must not read');}}});
    assert.equal(response.status,503);
    assert.equal((await response.json()).code,'READ_AUTH_NOT_READY');
  }
});

test('HTTP reader rejects identity, ambiguous queries, detail views and writes before storage IO',async()=>{
  let reads=0;const context={access,loadDataset:async()=>{reads++;return dataset;}};
  for(const [path,method] of [
    ['/v1/tenants','GET'],['/v1/home?section=actions','GET'],['/v1/rooms?line_user_id=SYNTHETIC_OTHER','GET'],
    ['/v1/revenue?workspace_id=SYNTHETIC_OTHER','GET'],['/v1/rooms?include_archived=1&include_archived=0','GET'],
    ['/v1/rooms?include_archived=true','GET'],['/v1/home?section=detail','GET'],
    ['/v1/tenants?read_view=full','GET'],['/v1/arrears','POST']]) {
    assert.ok((await serveReadRoute(new Request('https://local.test'+path,{method}),context)).status>=400,path);
  }
  assert.equal(reads,0);
  assert.equal((await serveReadRoute(new Request('https://local.test/v1/arrears'),{})).status,503);
  const broken=await serveReadRoute(new Request('https://local.test/v1/arrears'),{access,loadDataset:async()=>{throw new Error('private diagnostic');}});
  assert.equal(broken.status,503);assert.doesNotMatch(await broken.text(),/private diagnostic|stack/);
});

test('public gallery loader preserves the actual parser, refuses private targets and caches only approved photos',async()=>{
  const helpers=createReadCalculator(createReadServices(dataset,access));
  const url='https://synthetic-gallery.z3house.com/spaces/test/',origin='https://synthetic-gallery.z3house.com';
  const photo=origin+'/api/public/media/11111111-2222-3333-4444-555555555555';
  let calls=0;
  const fetch=async(target,options)=>{
    calls++;assert.equal(target,url);assert.equal(options.redirect,'manual');
    return new Response('<section class="space-detail__media"><img src="'+photo+'"><img src="https://private.invalid/sensitive"><p>private text must not be cached</p></section>');
  };
  const values=[url,url+'?tracking=synthetic','https://admin.z3house.com/spaces/test/',
    'https://private.invalid/spaces/test/','http://synthetic-gallery.z3house.com/spaces/test/',
    'https://synthetic-gallery.z3house.com@private.invalid/spaces/test/'];
  const first=await loadPublicRoomResources(values,helpers,{fetch,now:1000});
  assert.deepEqual(Object.keys(first),[url]);assert.equal(calls,1);
  assert.deepEqual(helpers.landlordRoomWebsitePhotosFromHtml_(first[url].body,{origin}),[photo]);
  assert.doesNotMatch(first[url].body,/private text|private.invalid/);
  assert.deepEqual(await loadPublicRoomResources(values,helpers,{fetch,now:2000}),first);
  assert.equal(calls,1);
  await loadPublicRoomResources(values,helpers,{fetch,now:21601001});assert.equal(calls,2);
});

test('rooms materialize each replica row once while retaining request-local public gallery results',async()=>{
  const previousPhoto='https://synthetic-room-runtime-a.z3house.com/api/public/media/11111111-2222-3333-4444-555555555555';
  for(const site of ['', 'synthetic-room-runtime-a', 'synthetic-room-runtime-b']) {
    const input=richDataset(), url=site?'https://'+site+'.z3house.com/spaces/test/':'';
    const photo=site?'https://'+site+'.z3house.com/api/public/media/11111111-2222-3333-4444-555555555555':'';
    const body='<section class="space-detail__media"><img src="'+photo+'"></section>';
    if(url)input.V2_rooms[0].room_website_url=url;
    const enumerations=[];
    const projected=Object.fromEntries(Object.entries(projectedDataset(input)).map(([name,rows])=>[name,rows.map(row=>{
      const count={value:0};enumerations.push(count);
      return new Proxy(row,{ownKeys(target){count.value++;return Reflect.ownKeys(target);}});
    })]));
    let fetches=0;
    const options=Object.freeze({now:Date.parse(fixture.now),fetch:async(target,request)=>{
      fetches++;assert.equal(target,url);assert.equal(request.method,'GET');assert.equal(request.redirect,'manual');
      return new Response(body);
    }});
    const response=await serveReadRoute(new Request('https://local.test/v1/rooms?include_archived=1'),{access,loadDataset:async()=>projected,options});
    assert.equal(response.status,200);
    const result=await response.json();
    const publicResources=url?{[url]:{status:200,body}}:{};
    assert.deepEqual(result,plain(originalGas(input,access,{publicResources}).getLandlordRoomCenterInitByLineUid_('SYNTHETIC_LINE1',true)));
    if(photo)assert.ok(JSON.stringify(result).includes(photo),'actual room response keeps its public cover');
    if(site.endsWith('-b'))assert.ok(!JSON.stringify(result).includes(previousPhoto),'another request cannot inherit the previous gallery');
    assert.equal(fetches,url?1:0);
    assert.ok(enumerations.length>0);
    assert.ok(enumerations.every(count=>count.value===1),'each input row should enter only one Sheet matrix');
  }
});

test('unsupported existing bridge dependencies fail closed rather than publish a false unbound room',async()=>{
  const input=richDataset();
  input.V3_listing_integrations=[{workspace_id:'SYNTHETIC_W1',room_id:'SYNTHETIC_R1',binding_status:'bound',z3house_listing_id:'SYNTHETIC_LISTING'}];
  input.V3_listing_integration_snapshots=[{workspace_id:'SYNTHETIC_W1',room_id:'SYNTHETIC_R1',z3house_listing_id:'SYNTHETIC_LISTING',
    published:true,title:'SYNTHETIC_PUBLIC_TITLE',independent_site_url:'https://synthetic-bridge.z3house.com/spaces/synthetic-room/'}];
  const expected=originalGas(input).getLandlordRoomCenterInitByLineUid_('SYNTHETIC_LINE1',true);
  assert.match(JSON.stringify(expected),/SYNTHETIC_PUBLIC_TITLE/,'original GAS has a real dependency');
  const projected=projectedDataset(input);
  assert.ok(projected.V2_rooms.every(row=>row.replica_room_bridge_supported===false));
  assert.ok(!Object.hasOwn(projected,'V3_listing_integrations'));
  let fetched=0;
  const response=await serveReadRoute(new Request('https://local.test/v1/rooms'),{access,loadDataset:async()=>projected,options:{fetch:async()=>{fetched++;throw new Error('should not fetch');}}});
  assert.equal(response.status,503);assert.equal((await response.json()).code,'READ_DEPENDENCY_UNSUPPORTED');assert.equal(fetched,0);
  for(const table of ['V3_listing_integrations','V3_listing_integration_snapshots']) {
    const emptyBridge={...richDataset(),[table]:[]};
    assert.ok(projectedDataset(emptyBridge).V2_rooms.every(row=>row.replica_room_bridge_supported===false),'even an empty provisioned bridge must stay on GAS');
  }
});
