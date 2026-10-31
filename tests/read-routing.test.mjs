import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { webcrypto } from 'node:crypto';

const source=readFileSync(new URL('../landlord-api.js',import.meta.url),'utf8');
const good=(amount=10)=>({success:true,code:'OK',message:'ok',data:{summary:{total_amount:amount},tenants:[],workspace:{workspace_id:'SYNTHETIC_W'}}});
function runtime({mode='on',fetcher,store=new Map(),clock={now:1000},flags=true,auth={response_mode:'bridge',landlord_session_token:'synthetic-session'},timeoutScale=1}={}) {
  const calls={gas:0,worker:[],reports:[]};
  const context={URL,TextEncoder,crypto:webcrypto,AbortController,Promise,console,Math,
    Date:class extends Date {static now(){return clock.now;}},
    setTimeout:(fn,ms)=>setTimeout(fn,ms===3000?ms*timeoutScale:ms),clearTimeout,
    localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},
    CMWEBS_RELEASE_VERSION:'20261101-landlord-logout-v1',
    CMWEBS_READ_COMPARISON_VERSION:'read-contract-synthetic-v1',
    CMWEBS_READ_API_URL:'https://synthetic-worker.invalid',
    CMWebsLandlordAuth:{getRequestAuthParams:()=>auth,handleAuthFailure:()=>false,
      request:async()=>{calls.gas++;return good(20);}},
    fetch:async(url,options)=>{if(options.method==='POST'){calls.reports.push(JSON.parse(options.body));return {ok:true};}
      calls.worker.push({url,options});return fetcher?fetcher(url,options):{ok:true,json:async()=>good()};}};
  if(flags) context.CMWEBS_READ_PATH={tenants:mode};
  context.window=context;vm.createContext(context);vm.runInContext(source,context);
  return {api:context.CMWebsLandlordApi,calls,context,store,clock};
}
const config={apiUrl:'https://synthetic-gas.invalid/exec',action:'landlord_tenants',params:{read_view:'summary'},maxAttempts:1};
test('missing/off/unknown flags and unsupported detail/query routes use GAS without Worker IO',async()=>{
  for(const input of [{mode:'off'},{mode:'unknown'},{flags:false}]) {
    const r=runtime(input);assert.deepEqual(await r.api.request(config),good(20));assert.equal(r.calls.worker.length,0);
  }
  for(const params of [{},{read_view:'full'},{read_view:'summary',workspace_id:'foreign'}]) {
    const r=runtime();await r.api.request({...config,params});assert.equal(r.calls.worker.length,0);
  }
});
test('on mode sends bearer only in header and returns valid Worker result',async()=>{
  const r=runtime();assert.deepEqual(await r.api.request(config),good());assert.equal(r.calls.gas,0);
  const call=r.calls.worker[0];assert.equal(call.url,'https://synthetic-worker.invalid/v1/tenants?read_view=summary');
  assert.equal(call.options.headers.Authorization,'Session synthetic-session');
  assert.equal(call.options.credentials,'omit');assert.equal(call.options.cache,'no-store');
  assert.ok(!call.url.includes('synthetic-session'));
});
test('non2xx, malformed envelope, network and body deadline fall back once to GAS',async()=>{
  for(const fetcher of [async()=>({ok:false}),async()=>({ok:true,json:async()=>({success:true,data:{}})}),
    async()=>{throw Error('network');},async()=>({ok:true,json:()=>new Promise(()=>{})})]) {
    const r=runtime({fetcher,timeoutScale:.001});assert.deepEqual(await r.api.request(config),good(20));assert.equal(r.calls.gas,1);
  }
});
test('shadow renders GAS and reports only bounded field paths without values',async()=>{
  const r=runtime({mode:'shadow'});assert.deepEqual(await r.api.request(config),good(20));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(r.calls.worker.length,1);assert.equal(r.calls.reports.length,1);
  const report=r.calls.reports[0];assert.equal(report.route,'tenants');
  assert.deepEqual(Array.from(report.paths),['data.summary.total_amount']);
  assert.doesNotMatch(JSON.stringify(report),/synthetic-session|SYNTHETIC_W|total_amount":/);
  assert.ok(!('data' in report));
  assert.equal(report.release,'read-contract-synthetic-v1');assert.equal(report.variant,'default');
});
test('successful write guard survives navigation for one sync interval (7 minutes), failed writes do not guard',async()=>{
  const r=runtime();await r.api.request({action:'landlord_room_save'});
  const next=runtime({store:r.store,clock:r.clock});await next.api.request(config);assert.equal(next.calls.worker.length,0);
  r.clock.now+=419000;await next.api.request(config);assert.equal(next.calls.worker.length,0);
  r.clock.now+=1001;await next.api.request(config);assert.equal(next.calls.worker.length,1);
  const failed=runtime();failed.context.CMWebsLandlordAuth.request=async()=>({success:false});
  await failed.api.request({action:'landlord_room_save'});
  failed.context.CMWebsLandlordAuth.request=async()=>good(20);
  await failed.api.request(config);assert.equal(failed.calls.worker.length,1);
});
test('write completing while Worker read is pending forces the response back to GAS',async()=>{
  let finish;const r=runtime({fetcher:()=>new Promise(resolve=>{finish=resolve;})});
  const reading=r.api.request(config);
  await new Promise(resolve=>setTimeout(resolve,0));
  await r.api.request({action:'landlord_room_save'});
  finish({ok:true,json:async()=>good()});assert.deepEqual(await reading,good(20));
});
test('LINE credential uses id token; missing proof or unavailable guard storage stays on GAS',async()=>{
  const r=runtime({auth:{line_user_id:'synthetic-line-uid',id_token:'synthetic-id-token'}});
  r.context.document={createElement:()=>({}),body:{appendChild:script=>{
    const callback=new URL(script.src).searchParams.get('callback');r.context[callback](good(20));}}};
  r.context.CMWebsLiffRequestAuth={withIdToken:url=>url};
  await r.api.request(config);assert.equal(r.calls.worker[0].options.headers.Authorization,'LIFF synthetic-id-token');
  delete r.context.CMWebsLandlordAuth.getRequestAuthParams().id_token;
  await r.api.request(config);assert.equal(r.calls.worker.length,1);
  const unavailable=runtime();Object.defineProperty(unavailable.context,'localStorage',{get(){throw Error('denied');}});
  await unavailable.api.request(config);assert.equal(unavailable.calls.worker.length,0);
  const unwritable=runtime();unwritable.context.localStorage.setItem=()=>{throw Error('quota');};
  await unwritable.api.request(config);assert.equal(unwritable.calls.worker.length,0);
});

test('all six routes preserve query defaults and valid envelopes; unsafe endpoint configuration stays on GAS',async()=>{
  const routes=[['home','landlord_home_bootstrap',{section:'home'},{home:{}}],
    ['home','landlord_home_bootstrap',{section:'actions',read_view:'summary'},{home:{}}],
    ['revenue','landlord_revenue_dashboard_init',{from_month:'2026-09',to_month:'2026-10'},{kpis:{},months:[]}],
    ['tenants','landlord_tenants',{read_view:'summary'},{summary:{},tenants:[]}],
    ['rooms','landlord_room_center_init',{include_archived:'1'},{summary:{},rooms:[]}],
    ['arrears','landlord_arrears',{}, {summary:{},arrears:[]}],
    ['properties','landlord_properties_init',{include_archived:'0'},{summary:{},properties:[]}]];
  for(const [route,action,params,data] of routes) {
    const response={success:true,code:'OK',message:'ok',data};
    const r=runtime({fetcher:async()=>({ok:true,json:async()=>response})});r.context.CMWEBS_READ_PATH={[route]:'on'};
    assert.deepEqual(await r.api.request({...config,action,params}),response);
    assert.equal(new URL(r.calls.worker[0].url).pathname,'/v1/'+route);
    assert.equal(r.calls.gas,0);
  }
  for(const url of ['', 'http://synthetic.invalid','https://user:secret@synthetic.invalid',
    'https://synthetic.invalid/?token=secret','https://synthetic.invalid/#fragment']) {
    const r=runtime();r.context.CMWEBS_READ_API_URL=url;await r.api.request(config);assert.equal(r.calls.worker.length,0);
  }
});

test('shadow redacts dynamic keys and reports errors distinctly from zero differences',async()=>{
  const gas=good(20);gas.data['private-person@example.invalid']={SYNTHETIC_UID:'PRIVATE_VALUE'};
  const r=runtime({mode:'shadow'});r.context.CMWebsLandlordAuth.request=async()=>gas;
  await r.api.request(config);await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(r.calls.reports[0].paths.includes('data.[field]'));
  assert.doesNotMatch(JSON.stringify(r.calls.reports),/private-person|SYNTHETIC_UID|PRIVATE_VALUE/);
  const failed=runtime({mode:'shadow',fetcher:async()=>{throw Error('network');}});
  await failed.api.request(config);await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(failed.calls.reports[0].outcome,'worker_error');assert.deepEqual(Array.from(failed.calls.reports[0].paths),[]);
});

test('protected bridge writes persist guard even without landlord-api loaded',async()=>{
  const listeners=new Set(),nodes=[],store=new Map(),sessionStore=new Map();let payload=good();
  const context={URL,Date,Math,Promise,setTimeout,clearTimeout,location:{href:'https://synthetic.invalid/landlord-rooms.html'},
    localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},
    sessionStorage:{getItem:key=>sessionStore.get(key)||'',setItem:(key,value)=>sessionStore.set(key,value),removeItem:key=>sessionStore.delete(key)},
    addEventListener:(name,fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn),
    liff:{getIDToken:()=> 'synthetic-line-proof'}};
  const body={appendChild(node){node.parentNode=body;nodes.push(node);},removeChild:()=>{}};
  context.document={body,createElement:type=>{
    const node={type,style:{},fields:[],contentWindow:{},appendChild(input){this.fields.push(input);}};
    if(type==='form') node.submit=()=>{
      const id=node.fields.find(field=>field.name==='request_id').value;
      const iframe=nodes.find(item=>item.name===node.target);
      for(const listener of Array.from(listeners)) listener({origin:'https://script.google.com',source:iframe.contentWindow,
        data:{source:'CMWEBS_APPS_SCRIPT',requestId:id,payload}});
    };
    return node;
  }};
  context.window=context;vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../landlord-auth.js',import.meta.url),'utf8'),context);
  const auth=context.CMWebsLandlordAuth.init({apiUrl:'https://script.google.com/macros/s/SYNTHETIC/exec',lineUserId:'synthetic-line'});
  await auth.requestProtected('landlord_room_save',{});
  const until=Number(store.get('cmwebs_landlord_read_write_guard_v1'));assert.ok(until>Date.now()+119000);
  assert.equal(store.size,1);assert.doesNotMatch([...store.values()].join(),/synthetic/);
  store.clear();await auth.requestProtected('landlord_room_center_init',{});assert.equal(store.size,0);
  payload={success:false,code:'INVALID',message:'failed'};
  await assert.rejects(auth.requestProtected('landlord_room_save',{}));assert.equal(store.size,0);
  // A quota failure cannot silently remove protection after an Auth-only write.
  payload=good();context.localStorage.setItem=()=>{throw Error('QuotaExceededError');};
  await auth.requestProtected('landlord_room_save',{});
  context.sessionStorage.getItem=key=>key==='cmwebs_landlord_session_token'?'synthetic-session':sessionStore.get(key)||'';
  context.CMWEBS_READ_PATH={tenants:'on'};context.CMWEBS_READ_API_URL='https://synthetic-worker.invalid';
  let workerReads=0;context.fetch=async()=>{workerReads++;return {ok:true,json:async()=>good()};};
  context.AbortController=AbortController;
  vm.runInContext(source,context);
  await context.CMWebsLandlordApi.request(config);assert.equal(workerReads,0);
  const navigated=runtime({clock:{now:Date.now()}});
  navigated.context.sessionStorage={getItem:key=>sessionStore.get(key)||null};
  await navigated.api.request(config);assert.equal(navigated.calls.worker.length,0);
  // Clearing a full snapshot can make storage writable immediately afterward.
  store.set('cmwebs_landlord_read_cache_v1','full-snapshot');
  context.localStorage.setItem=(key,value)=>{
    if(store.has('cmwebs_landlord_read_cache_v1')) throw Error('QuotaExceededError');
    store.set(key,value);
  };
  await auth.requestProtected('landlord_room_save',{});
  assert.ok(Number(store.get('cmwebs_landlord_read_write_guard_v1'))>Date.now()+119000);
  await context.CMWebsLandlordApi.request(config);assert.equal(workerReads,0);
  store.clear();sessionStore.clear();context.CMWEBS_READ_WRITE_GUARD_UNTIL=0;
  vm.runInContext(readFileSync(new URL('../liff-request-auth.js',import.meta.url),'utf8'),context);
  let callbackResult;
  context.syntheticJsonpCallback=result=>{callbackResult=result;};
  context.CMWebsLiffRequestAuth.withIdToken('https://synthetic-gas.invalid/exec?v2_action=landlord_team_member_update&callback=syntheticJsonpCallback');
  context.syntheticJsonpCallback(payload);
  assert.equal(callbackResult,payload);
  assert.ok(Number(store.get('cmwebs_landlord_read_write_guard_v1'))>Date.now()+119000);
});

test('shadow records header arrival and complete validated response separately',async()=>{
  const clock={now:1000};
  const r=runtime({mode:'shadow',clock,fetcher:async()=>{
    clock.now+=100;return {ok:true,json:async()=>{clock.now+=2000;return good();}};
  }});
  await r.api.request(config);await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(r.calls.reports[0].headers_ms,100);assert.equal(r.calls.reports[0].elapsed_ms,2100);
});

test('elapsed deadline is enforced even when browser timer delivery is delayed',async()=>{
  const clock={now:1000};
  const r=runtime({clock,fetcher:async()=>({ok:true,json:async()=>{clock.now+=3001;return good();}})});
  assert.deepEqual(await r.api.request(config),good(20));assert.equal(r.calls.gas,1);
});

test('approved request-clock classification is exact, bounded, and never hides source row timestamps',async()=>{
  const a='2026-10-12T00:00:00.000Z';
  for(const delta of [1000,60000,60001,'invalid']) {
    const b=delta==='invalid'?'invalid':new Date(Date.parse(a)+delta).toISOString();
    const gas=good(10),worker=good(10);
    gas.data.landlord={updated_at:a};worker.data.landlord={updated_at:b};
    gas.data.tenants=[{updated_at:a}];worker.data.tenants=[{updated_at:b}];
    const r=runtime({mode:'shadow',fetcher:async()=>({ok:true,json:async()=>worker})});
    r.context.CMWebsLandlordAuth.request=async()=>gas;
    await r.api.request(config);await new Promise(resolve=>setTimeout(resolve,10));
    const report=r.calls.reports[0];assert.ok(report.paths.includes('data.tenants[].updated_at'));
    if(typeof delta==='number'&&delta<=60000) {
      assert.deepEqual(Array.from(report.clock_paths),['data.landlord.updated_at']);
      assert.ok(!report.paths.includes('data.landlord.updated_at'));
    } else {assert.equal(report.clock_paths.length,0);assert.ok(report.paths.includes('data.landlord.updated_at'));}
  }
});

test('flag-only asset releases preserve the verified comparison identity, missing identity cannot start shadow',async()=>{
  const r=runtime({mode:'shadow'});
  r.context.CMWEBS_READ_COMPARISON_VERSION='read-contract-synthetic-v1';
  for(const version of ['assets-before','assets-after']) {
    r.context.CMWEBS_RELEASE_VERSION=version;
    await r.api.request(config);await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.deepEqual(r.calls.reports.map(row=>row.release),['read-contract-synthetic-v1','read-contract-synthetic-v1']);
  const missing=runtime({mode:'shadow'});delete missing.context.CMWEBS_READ_COMPARISON_VERSION;
  await missing.api.request(config);assert.equal(missing.calls.worker.length,0);
});
