import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup({allowed=true,found=true}={}) {
  const room={room_id:'R1',__row_number:2,room_website_url:'https://old.example/',rent_amount:8500};
  const c=vm.createContext({propertyRoomText_:v=>String(v??'').trim(),workspaceResult_:(success,code,message,data)=>({success,code,message,data}),workspaceLandlordResolveAccess_:()=>({success:true,workspace:{workspace_id:'W1'},membership:{role:allowed?'owner':'viewer'}}),runtimeSpreadsheet_:()=>({getSheetByName:()=>({})}),propertyRoomFindWorkspaceTarget_:()=>found?room:null,propertyRoomEnsureSheet_:()=>{},propertyRoomSetValues_:(_,row,values)=>Object.assign(room,values),LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});
  const source=fs.readFileSync('apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js','utf8');
  vm.runInContext(source.slice(source.indexOf('function propertyRoomCanWrite_('),source.indexOf('function propertyRoomActor_(')),c);
  vm.runInContext(fs.readFileSync('apps-script/V2_LANDLORD_ROOM_CENTER.js','utf8'),c);
  return {c,room};
}
test('website save persists, clears and rejects unsafe URLs without touching rent',()=>{
  const {c,room}=setup();
  assert.equal(c.saveLandlordRoomWebsiteByLineUid_('U','R1','https://new.example/room?x=1','W1').success,true);
  assert.equal(room.room_website_url,'https://new.example/room?x=1');
  assert.equal(room.rent_amount,8500);
  for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','https://','https://example.com/\nfoo']) {
    assert.equal(c.saveLandlordRoomWebsiteByLineUid_('U','R1',url,'W1').success,false,url);
    assert.equal(room.room_website_url,'https://new.example/room?x=1');
  }
  assert.equal(c.saveLandlordRoomWebsiteByLineUid_('U','R1','','W1').success,true);
  assert.equal(room.room_website_url,'');
});
test('website save rejects unauthorized membership and foreign room',()=>{
  for(const options of [{allowed:false},{found:false}]) {
    const {c,room}=setup(options);
    assert.equal(c.saveLandlordRoomWebsiteByLineUid_('U','R1','https://new.example/','W1').success,false);
    assert.equal(room.room_website_url,'https://old.example/');
  }
});
test('website principal fails closed on raw UID and derives identity only from verified credentials',()=>{
  const {c}=setup();
  c.resolveLandlordPrincipal_=()=>({success:true,data:{principal_line_user_id:'EMAIL',workspace_id:'WE'}});
  c.landlordContractSigningReviewAuthenticate_=()=>({success:true,data:{session_token:'verified'}});
  c.verifyLandlordContractSigningReviewSessionToken_=()=>({success:true,data:{line_sub:'VERIFIED',workspace_id:'WV'}});
  assert.equal(c.resolveRoomWebsitePrincipal_({line_user_id:'IMPERSONATED'}).success,false);
  assert.equal(c.resolveRoomWebsitePrincipal_({id_token:'valid',line_user_id:'IMPERSONATED'}).data.principal_line_user_id,'VERIFIED');
  assert.equal(c.resolveRoomWebsitePrincipal_({landlord_session_token:'email',request_id:'R'}).data.principal_line_user_id,'EMAIL');
});
test('saving one card uses protected POST and preserves another card draft',async()=>{
  const html=fs.readFileSync('landlord-rooms.html','utf8');
  const fn=html.slice(html.indexOf('    async function saveRoomWebsite('),html.indexOf('    function render()'));
  const input={value:'https://new.example/',disabled:false};const status={}; const card={outerHTML:'old'};
  const other={value:'https://draft.example/'};const calls=[];
  const auth={getMode:()=> 'line',requestProtected:async(action,params)=>{calls.push({action,params});return {success:true,data:{room_website_url:'https://new.example/'}};}};
  const button={dataset:{roomId:'R1'},closest:selector=>selector==='.room-card'?card:{querySelector:s=>s==='input'?input:status}};
  const c=vm.createContext({URL,LANDLORD_AUTH:auth,liff:{getIDToken:()=> 'verified-token'},PAGE_DATA:{rooms:[{room_id:'R1'}]},roomCard:()=> 'saved-card',showToast:()=>{},render:()=>{other.value='lost';}});
  vm.runInContext(fn,c);await c.saveRoomWebsite(button);
  assert.equal(other.value,'https://draft.example/');assert.equal(card.outerHTML,'saved-card');
  assert.equal(calls[0].params.id_token,'verified-token');assert.equal(calls.length,1);
});
