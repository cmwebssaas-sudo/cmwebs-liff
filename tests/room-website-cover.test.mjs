import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const site='https://rooms.z3house.com/spaces/101/';
const photo='https://rooms.z3house.com/api/public/media/11111111-1111-4111-8111-111111111111';
const gallery=`<meta property="og:image" content="https://rooms.z3house.com/logo"><img src="https://rooms.z3house.com/logo"><section class="space-detail__media" aria-label="照片"><img src="${photo}"><img src="https://rooms.z3house.com/second"></section>`;
function setup({html=gallery,code=200,fail=false}={}) {
  const cache=new Map();let batches=0;let locked=false;
  const room={room_id:'R1',__row_number:2,rent_amount:8500};
  const c=vm.createContext({
    propertyRoomText_:v=>String(v??'').trim(),workspaceResult_:(success,code,message,data)=>({success,code,message,data}),
    workspaceLandlordResolveAccess_:()=>({success:true,workspace:{workspace_id:'W1'},membership:{role:'owner'}}),
    propertyRoomRequireWrite_:()=>({success:true}),runtimeSpreadsheet_:()=>({getSheetByName:()=>({})}),
    propertyRoomFindWorkspaceTarget_:()=>room,propertyRoomEnsureSheet_:()=>{},propertyRoomSetValues_:(_,row,values)=>Object.assign(room,values),
    LockService:{getScriptLock:()=>({waitLock(){locked=true;},releaseLock(){locked=false;}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>[...crypto.createHash('sha256').update(v).digest()],base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url')},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},
    UrlFetchApp:{fetchAll:requests=>{batches++;assert.equal(locked,false,'external fetch must not hold ScriptLock');
      for(const req of requests){assert.match(req.url,/^https:\/\/[a-z0-9-]+\.z3house\.com\/spaces\//);assert.equal(req.followRedirects,false);assert.equal(req.muteHttpExceptions,true);assert.equal(req.headers,undefined);}
      if(fail)throw Error('network');return requests.map(()=>({getResponseCode:()=>code,getContentText:()=>html}));}}
  });
  vm.runInContext(fs.readFileSync('apps-script/V2_LANDLORD_ROOM_CENTER.js','utf8'),c);
  return {c,room,cache,batches:()=>batches};
}
test('saving a room URL returns its first gallery image after the write lock is released',()=>{
  const {c,room}=setup();const result=c.saveLandlordRoomWebsiteByLineUid_('U','R1',site,'W1');
  assert.equal(result.success,true);assert.equal(room.room_website_url,site);assert.equal(room.rent_amount,8500);
  assert.equal(result.data.room_website_cover.url,photo);assert.equal(result.data.room_website_cover.status,'available');
});
test('public gallery returns ordered unique safe images, survives cache and protected save',()=>{
  const second=photo.replace('11111111-1111','22222222-2222');
  const s=setup({html:gallery.replace('</section>',`<img src="${second}"><img src="${photo}"><img src="https://evil.test/private"></section><img src="${second}">`)});
  const saved=s.c.saveLandlordRoomWebsiteByLineUid_('U','R1',site,'W1');
  assert.deepEqual(Array.from(saved.data.room_website_cover.photos),[photo,second]);
  assert.deepEqual(Array.from(s.c.landlordRoomWebsiteCovers_([site])[site].photos),[photo,second]);
  assert.equal(s.batches(),1);
  assert.equal(s.room.rent_amount,8500);
});
test('cover lookup batches distinct pages and reuses public cover cache on reload',()=>{
  const s=setup();const second='https://rooms.z3house.com/spaces/102/';
  const result=s.c.landlordRoomWebsiteCovers_([site,site,second]);assert.equal(result[site].url,photo);assert.equal(s.batches(),1);
  assert.equal(s.c.landlordRoomWebsiteCovers_([site])[site].url,photo);assert.equal(s.batches(),1);
});
test('unsafe or unrelated website URLs never trigger a server fetch',()=>{
  const s=setup();for(const url of ['https://localhost/spaces/101/','https://admin.z3house.com/spaces/101/','https://rooms.z3house.com.evil.test/spaces/101/','https://rooms.z3house.com:443/spaces/101/','https://u:p@rooms.z3house.com/spaces/101/','https://rooms.z3house.com/api/private','http://rooms.z3house.com/spaces/101/']) {
    assert.equal(s.c.landlordRoomWebsiteCovers_([url])[url].url,'');
  }assert.equal(s.batches(),0);
});
test('redirects, errors, missing galleries and foreign image URLs do not fail URL saving',()=>{
  for(const options of [{code:302},{code:500},{fail:true},{html:'<img src="'+photo+'">'},{html:gallery.replace(photo,'https://evil.test/image')},{html:'x'.repeat(1000001)}]) {
    const s=setup(options);const result=s.c.saveLandlordRoomWebsiteByLineUid_('U','R1',site,'W1');
    assert.equal(result.success,true);assert.equal(s.room.room_website_url,site);assert.equal(result.data.room_website_cover.url,'');assert.notEqual(result.data.room_website_cover.status,'available');
  }
});
test('clearing a website clears its derived cover; forced refresh sees a changed image',()=>{
  const s=setup();s.c.saveLandlordRoomWebsiteByLineUid_('U','R1',site,'W1');
  s.c.saveLandlordRoomWebsiteByLineUid_('U','R1',site,'W1');assert.equal(s.batches(),2);
  const cleared=s.c.saveLandlordRoomWebsiteByLineUid_('U','R1','','W1');assert.equal(cleared.data.room_website_cover.url,'');assert.equal(cleared.data.room_website_cover.status,'none');
});
test('card shows website cover without a bridge binding and explains unavailable covers',()=>{
  const html=fs.readFileSync('landlord-rooms.html','utf8');const c=vm.createContext({text:v=>String(v??''),safeHtml:v=>String(v??''),money:v=>String(v),statusClass:()=>'',statusLabel:()=>''});
  vm.runInContext(html.slice(html.indexOf('    function safeExternalUrl('),html.indexOf('    async function saveRoomWebsite(')),c);
  const room={room_id:'R1',room_name:'101',room_website_url:site,room_website_cover:{url:photo,status:'available'}};
  assert.match(c.roomCard(room),new RegExp('src="'+photo+'"'));
  room.room_website_cover={url:'',status:'unavailable'};assert.match(c.roomCard(room),/封面照片.*無法/);
});
test('gallery parser reads src, not data-src, and rejects malformed media identifiers',()=>{
  const s=setup({html:gallery.replace('<img src="'+photo+'">','<img data-src="https://wrong.test/image" src="'+photo+'">')});
  assert.equal(s.c.landlordRoomWebsiteCovers_([site])[site].url,photo);
  const invalid=setup({html:gallery.replace(photo,'https://rooms.z3house.com/api/public/media/'+'-'.repeat(36))});
  assert.equal(invalid.c.landlordRoomWebsiteCovers_([site])[site].url,'');
});
test('room reload derives cover from only authorized rooms and remains read-only',()=>{
  const s=setup();Object.assign(s.c,{
    propertyRoomRequireReadSchema_:()=>{},propertyRoomBoolean_:()=>false,
    propertyRoomGetWorkspaceProperties_:()=>[],propertyRoomGetWorkspaceRooms_:()=>[{...s.room,room_website_url:site}],
    workspaceGetObjectsWithRow_:()=>[],propertyRoomCompareText_:(a,b)=>a.localeCompare(b),propertyRoomNumber_:v=>Number(v)||0
  });
  const result=s.c.getLandlordRoomCenterInitByLineUid_('U',false);
  assert.equal(result.success,true);assert.equal(result.data.rooms[0].room_website_cover.url,photo);assert.equal(s.room.room_website_url,undefined);
  assert.deepEqual(Array.from(result.data.rooms[0].room_website_cover.photos),[photo]);
  s.c.workspaceLandlordResolveAccess_=()=>({success:false,code:'DENIED'});
  assert.equal(s.c.getLandlordRoomCenterInitByLineUid_('U',false).success,false);assert.equal(s.batches(),1);
});
test('bound public listing gallery works without a manual URL, unbound URLs never fetch',()=>{
  const s=setup();Object.assign(s.c,{
    propertyRoomRequireReadSchema_:()=>{},propertyRoomBoolean_:()=>false,
    propertyRoomGetWorkspaceProperties_:()=>[],propertyRoomGetWorkspaceRooms_:()=>[{...s.room}],
    propertyRoomCompareText_:(a,b)=>a.localeCompare(b),propertyRoomNumber_:v=>Number(v)||0,
    landlordRoomCenterZ3houseByRoom_:()=>({R1:{binding_status:'bound',independent_site_url:site}})
  });
  assert.deepEqual(Array.from(s.c.getLandlordRoomCenterInitByLineUid_('U',false).data.rooms[0].room_website_cover.photos),[photo]);
  s.c.landlordRoomCenterZ3houseByRoom_=()=>({R1:{binding_status:'unbound',independent_site_url:'https://rooms.z3house.com/spaces/102/'}});
  s.c.getLandlordRoomCenterInitByLineUid_('U',false);assert.equal(s.batches(),1);
});
test('protected save response immediately replaces only the saved card with its cover',async()=>{
  const html=fs.readFileSync('landlord-rooms.html','utf8');const card={outerHTML:''};const input={value:site};const status={};
  const room={room_id:'R1',room_name:'101'};const other={room_id:'R2',room_website_url:'https://draft.test/'};
  const editor={querySelector:s=>s==='input'?input:status};const button={dataset:{roomId:'R1'},closest:s=>s==='.room-card'?card:editor};
  const backend=setup();const saved=backend.c.saveLandlordRoomWebsiteByLineUid_('U','R1',site,'W1');
  const c=vm.createContext({URL,text:v=>String(v??''),safeHtml:v=>String(v??''),money:v=>String(v),statusClass:()=>'',statusLabel:()=>'',
    PAGE_DATA:{rooms:[room,other]},LANDLORD_AUTH:{getMode:()=> 'line',requestProtected:async()=>saved},liff:{getIDToken:()=> 'verified'},showToast:()=>{}});
  vm.runInContext(html.slice(html.indexOf('    function safeExternalUrl('),html.indexOf('    function render()')),c);
  await c.saveRoomWebsite(button);assert.match(card.outerHTML,new RegExp('src="'+photo+'"'));assert.equal(other.room_website_url,'https://draft.test/');
});
