import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { parse } from '../cloudflare/read-api/node_modules/acorn/dist/acorn.mjs';

function pageFunction(file,name) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const source=match[1];
    const node=parse(source,{ecmaVersion:'latest'}).body.find(node=>node.type==='FunctionDeclaration'&&node.id.name===name);
    if(node) return source.slice(node.start,node.end);
  }
  throw Error('Missing actual page function: '+file+'/'+name);
}
const pages=[
  ['landlord-home.html','jsonpRequest','landlord_home_bootstrap',{section:'home'}],
  ['landlord-revenue-dashboard.html','jsonpRequest','landlord_revenue_dashboard_init',{}],
  ['landlord-tenants.html','jsonpRequest','landlord_tenants',{read_view:'summary'}],
  ['landlord-arrears.html','callApi','landlord_arrears',{}],
  ['landlord-properties.html','jsonpRequest','landlord_properties_init',{include_archived:'1'}],
  ['landlord-rooms.html','loadPage','landlord_room_center_init',{include_archived:'1'}]
];
test('actual six page wrappers reach the shared router for LINE and Email',async()=>{
  for(const mode of ['line','email']) for(const [file,name,action,params] of pages) {
    const calls=[];
    const context={Promise,API_URL:'https://synthetic-gas.invalid/exec',LINE_USER_ID:'synthetic-line',TEST_MODE:false,
      JSONP_REQUEST_TIMEOUT_MS:30000,JSONP_REQUEST_RETRY_DELAY_MS:350,
      assertDesktopEmailActionSupported:()=>{},handleAuthFailure:()=>false,
      ensureAuth:async()=>true,applyRoomResult:()=>{},renderError:error=>{throw error;},
      CMWebsLandlordAuth:{getRequestAuthParams:()=>mode==='email'?{response_mode:'bridge',landlord_session_token:'synthetic-session'}:{line_user_id:'synthetic-line'},
        request:()=>{throw Error('Page bypassed shared router');}},
      CMWebsLandlordApi:{request:async config=>{calls.push(config);return {success:true};},snapshot:()=>{}}};
    context.window=context;vm.createContext(context);vm.runInContext(pageFunction(file,name),context);
    if(name==='loadPage') await context[name](false);else await context[name](action,params);
    assert.equal(calls.length,1,file+'/'+mode);assert.equal(calls[0].action,action);
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0].params)),params);
  }
});

test('arrears keeps the desktop Email action restriction before shared dispatch',async()=>{
  const context={assertDesktopEmailActionSupported:()=>{throw Error('restricted');},
    CMWebsLandlordApi:{request:()=>{throw Error('Forbidden action reached router');}}};
  context.window=context;vm.createContext(context);vm.runInContext(pageFunction('landlord-arrears.html','callApi'),context);
  assert.throws(()=>context.callApi('landlord_bills_generate',{}),/restricted/);
});
