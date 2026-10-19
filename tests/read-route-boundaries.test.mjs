import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReadCalculator } from '../cloudflare/read-api/src/read-calculator.js';
import { createReadServices } from '../cloudflare/read-api/src/read-runtime.js';
import { loadPublicRoomResources } from '../cloudflare/read-api/src/public-room-resources.js';
import { serveReadRoute } from '../cloudflare/read-api/src/read-routes.js';
import worker from '../cloudflare/read-api/src/index.js';
import { dataset,access,fixture,plain,richDataset,projectedDataset,originalGas } from './fixtures/read-parity/runtime.mjs';
import {capacityDataset} from './fixtures/read-parity/capacity.mjs';

test('owned read services materialize requested Sheet frames once and leave unused rows untouched',()=>{
  let used=0,unused=0;
  const row=counter=>new Proxy({value:'first'},{ownKeys(target){counter();return Reflect.ownKeys(target);}});
  const services=createReadServices({Used:[row(()=>{used++;})],Unused:[row(()=>{unused++;})]},access,{now:Date.parse(fixture.now)},true);
  assert.equal(used,0);assert.equal(unused,0);
  const ss=services.SpreadsheetApp.getActiveSpreadsheet(),sheet=ss.getSheetByName('Used');
  assert.deepEqual(sheet.getDataRange().getValues(),[['value'],['first']]);assert.equal(ss.getSheetByName('Used'),sheet);assert.equal(used,1);assert.equal(unused,0);assert.equal(ss.getSheetByName('missing'),null);
  const values=sheet.getDataRange().getValues();values[1][0]='changed';assert.equal(sheet.getRange(2,1).getValues()[0][0],'first');
});
test('default services retain eager source snapshots and invalid owned row frames fail closed',()=>{
  const input={Used:[{value:'first'}]},services=createReadServices(input,access,{now:Date.parse(fixture.now)});input.Used[0].value='later';
  assert.equal(services.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Used').getRange(2,1).getValues()[0][0],'first');
  for(const rows of [null,{},[null],[undefined],Array(1)])assert.throws(()=>createReadServices({Unused:rows},access,{now:Date.parse(fixture.now)},true));
});
test('actual500-room properties route retains full data and GAS parity without framing unrelated payments',async()=>{
  const input=capacityDataset(),projected=projectedDataset(input),frames={};let loads=0;
  const watched=Object.fromEntries(Object.entries(projected).map(([name,rows])=>[name,rows.map(row=>new Proxy(row,{ownKeys(target){frames[name]=(frames[name]||0)+1;return Reflect.ownKeys(target);}}))]));
  const response=await serveReadRoute(new Request('https://local.test/v1/properties?include_archived=1'),{access,loadDataset:async()=>{loads++;return watched;},options:{now:Date.parse(fixture.now)}});
  assert.equal(response.status,200);const result=await response.json();assert.deepEqual(result,plain(originalGas(input,access).getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true)));assert.equal(result.data.summary.room_count,500);
  assert.equal(loads,1);assert.equal(watched.V2_payments.length,projected.V2_payments.length);assert.equal(frames.V2_payments||0,0);assert.equal(frames.V2_rooms,projected.V2_rooms.length);assert.equal(frames.V2_properties,projected.V2_properties.length);
});

test('property totals reuse completed per-property summaries without rescanning room views',()=>{
  for(const input of [dataset,richDataset(),capacityDataset()])for(const archived of [false,true]) {
    const gas=originalGas(input),expected=plain(gas.getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',archived));
    const build=gas.propertyRoomBuildPropertyView_;let rereads=0;
    gas.propertyRoomBuildPropertyView_=(...args)=>{
      const view=build(...args);
      for(const room of view.rooms){const status=room.account_status;Object.defineProperty(room,'account_status',{
        enumerable:true,configurable:true,get(){rereads++;return status;}
      });}
      return view;
    };
    const actual=gas.getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',archived);
    assert.equal(actual.success,true);
    assert.equal(rereads,0,'Global counters already exist in the completed property summaries');
    assert.deepEqual(plain(actual),expected,'Complete response, values, ordering and archived filtering remain exact');
  }
});

test('room-builder seasonal rates preserve precedence, rounding and bill-month fallbacks in both seasons',()=>{
  const scenarios=[
    {room:{equipment_fee_rate_summer:'4.1236',summer_equipment_fee_rate:8,equipment_fee_rate_regular:'2.5554'},contract:{equipment_fee_rate_summer:9,equipment_fee_rate_regular:9},rates:[4.124,2.555]},
    {room:{equipment_fee_rate_summer:0,summer_equipment_fee_rate:'5.4326',equipment_fee_rate_regular:'NaN',regular_equipment_fee_rate:-1,non_summer_equipment_fee_rate:'1,234.5678'},rates:[5.433,1234.568]},
    {room:{equipment_fee_rate:9},contract:{equipment_fee_rate_summer:0,summer_equipment_fee_rate:'6.7896',equipment_fee_rate_regular:-1,non_summer_equipment_fee_rate:'2.2222'},rates:[6.79,2.222]},
    {room:{equipment_fee_rate:'1.1114'},bill:{bill_month:new Date('2026-07-01T00:00:00+08:00'),equipment_fee_rate:'4.4446'},rates:[4.445,1.111]},
    {contract:{equipment_rate:'1.5556'},bill:{bill_month:'2026-01',equipment_rate:'3.3336'},rates:[1.556,3.334]},
    {room:{equipment_rate:1.001},bill:{bill_month:'',due_date:'2026-07-10',equipment_fee_rate:'4.9996'},rates:[5,1.001]},
    {room:{equipment_rate:'2,100.9999'},bill:{bill_month:'invalid',due_date:'2026-07-10',equipment_fee_rate:8},rates:[2101,2101]},
    {contract:{equipment_fee_rate:'2.3336'},bill:{bill_month:'2026-07',equipment_fee_rate:0,equipment_rate:-2},rates:[2.334,2.334]},
    {room:{equipment_fee_rate_summer:-1,equipment_fee_rate_regular:'Infinity',equipment_fee_rate:0},contract:{equipment_rate:'NaN'},rates:[3.5,2.5]},
    {room:{equipment_fee_rate_summer:0.0004,summer_equipment_fee_rate:0.0006,equipment_fee_rate_regular:0.0004,equipment_fee_rate:1.4},rates:[0.001,1.4]},
    {room:{equipment_fee_rate_summer:5,equipment_fee_rate_regular:1,equipment_summer_months:'1'},bill:{bill_month:'2026-07',equipment_fee_rate:8},rates:[5,1]}
  ];
  for(const item of scenarios)for(const month of [1,7]) {
    const gas=originalGas(dataset,access,{now:Date.parse(`2026-${String(month).padStart(2,'0')}-15T12:00:00+08:00`)});
    const room={room_id:'SYNTHETIC_RATE_ROOM',account_status:'active',room_status:'vacant',...item.room};
    const contract={...item.contract},bill=item.bill||null,before=JSON.stringify([room,contract,bill]);
    const view=gas.propertyRoomBuildRoomView_(room,{}, {[room.room_id]:contract}, {[room.room_id]:bill},{},{});
    const summer=room.equipment_summer_months==='1'?month===1:month===7;
    assert.deepEqual([view.equipment_fee_rate_summer,view.equipment_fee_rate_regular],item.rates);
    assert.equal(view.equipment_fee_rate,item.rates[summer?0:1]);
    assert.equal(view.equipment_fee_season,summer?'summer':'regular');
    assert.equal(JSON.stringify([room,contract,bill]),before,'Actual rate projection must not mutate source rows');
  }
});

test('500-room seasonal rates resolve each season once per room instead of repeating1000 calls',()=>{
  const input=capacityDataset(),gas=originalGas(input),before=JSON.stringify(input);
  const expected=plain(gas.getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true));
  const resolve=gas.propertyRoomResolveEquipmentSeasonRate_,calls=new Map();
  gas.propertyRoomResolveEquipmentSeasonRate_=(room,contract,bill,summer)=>{
    const counts=calls.get(room)||[0,0];counts[summer?0:1]++;calls.set(room,counts);
    return resolve(room,contract,bill,summer);
  };
  const actual=gas.getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true);
  assert.deepEqual(plain(actual),expected,'Complete response and ordering remain canonical');
  assert.equal(calls.size,500);
  assert.equal([...calls.values()].reduce((sum,counts)=>sum+counts[0]+counts[1],0),1000);
  for(const counts of calls.values())assert.deepEqual(counts,[1,1]);
  assert.equal(JSON.stringify(input),before,'Actual rate projection must not mutate source rows');
});

test('property number conversion preserves finite extremes, positive zero and other type coercions',()=>{
  const number=originalGas().propertyRoomNumber_;
  for(const value of [0,1,-1,0.1,-0.1,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE,
    Number.EPSILON,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1,1e-7,-1e-7,1e21,-1e21])assert.equal(number(value),value);
  for(const value of [-0,NaN,Infinity,-Infinity])assert.equal(number(value),0);
  for(const [value,expected] of [[null,0],[undefined,0],['',0],[' 1,234.567 ',1234.567],['-0',-0],['1e-7',1e-7],
    ['Infinity',0],['invalid',0],[true,0],[false,0],[12n,12],[9007199254740993n,9007199254740992],
    [Symbol('rate'),0],[new Number(3.5),3.5],[new String('1,234'),1234],[[1,2],12],[{},0]])assert.equal(number(value),expected);
  const calls=[];let text='1,234';
  const changing={toString(){calls.push('toString');return text;},valueOf(){throw Error('Unused valueOf');}};
  assert.equal(number(changing),1234);text='2,345';assert.equal(number(changing),2345);
  const primitive={[Symbol.toPrimitive](hint){calls.push(hint);return '3,456';}};
  assert.equal(number(primitive),3456);assert.deepEqual(calls,['toString','toString','string']);
  const error=Error('synthetic coercion');assert.throws(()=>number({toString(){throw error;}}),value=>value===error);
});

test('500-room property numeric helper avoids primitive-number string conversion',()=>{
  const input=capacityDataset(),gas=originalGas(input),expected=plain(gas.getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true));
  const number=gas.propertyRoomNumber_;let active=0,numericCalls=0,numericStrings=0;
  gas.String=new Proxy(String,{apply(target,thisArg,args){
    if(active&&typeof args[0]==='number')numericStrings++;
    return Reflect.apply(target,thisArg,args);
  }});
  gas.propertyRoomNumber_=value=>{
    if(typeof value==='number')numericCalls++;
    active++;try{return number(value);}finally{active--;}
  };
  const actual=gas.getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true);
  assert.deepEqual(plain(actual),expected,'Complete500-room response remains canonical');
  assert.ok(numericCalls>0,'Exercise primitive numeric input in the real helper');
  assert.equal(numericStrings,0,'Already numeric values need no String/replace/Number roundtrip');
});

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
      const count={name,value:0};enumerations.push(count);
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
    assert.ok(enumerations.every(count=>count.value<=1),'unused sheets need no matrix; no row enters two matrices');
    assert.ok(enumerations.filter(count=>count.name==='V2_rooms').every(count=>count.value===1),'every room still enters exactly one matrix');
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
