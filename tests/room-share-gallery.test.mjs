import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('landlord-rooms.html','utf8');
function context(extra={}) {
  const c=vm.createContext({text:v=>String(v??''),safeHtml:v=>String(v??'').replaceAll('"','&quot;'),money:String,statusClass:()=>'',statusLabel:()=>'',...extra});
  vm.runInContext(html.slice(html.indexOf('    function safeExternalUrl('),html.indexOf('    async function saveRoomWebsite(')),c);return c;
}
const room={room_name:'101',room_id:'private-id',room_website_url:'https://rooms.z3house.com/spaces/101/',room_website_cover:{url:'https://rooms.z3house.com/a',photos:['https://rooms.z3house.com/a','https://rooms.z3house.com/b','javascript:bad'],status:'available'}};
function shareButton(status={hidden:true}) { return {dataset:{shareUrl:room.room_website_url,shareTitle:'101'},closest:()=>({querySelector:()=>status})}; }
test('gallery renders safe slides, counter and controls; share precedes original actions',()=>{
  const card=context().roomCard(room);
  assert.match(card,/class="room-photo-track"/);assert.match(card,/1 \/ 2/);assert.match(card,/下一張照片/);
  assert.ok(card.indexOf('分享房源')<card.indexOf('查看房源網站'));
  assert.doesNotMatch(card,/javascript:bad/);
  assert.doesNotMatch(context().roomCard({...room,room_website_cover:{url:'https://rooms.z3house.com/a'}}),/下一張照片/);
  assert.doesNotMatch(context().roomCard({room_name:'empty'}),/分享房源/);
  assert.match(context().roomCard({...room,room_website_url:'',z3house:{binding_status:'bound',independent_site_url:room.room_website_url}}),/1 \/ 2/);
});
test('share is an accessible photo overlay; mobile hides arrows without disabling native swipe',()=>{
  const card=context().roomCard(room);
  assert.ok(card.indexOf('class="room-share"')<card.indexOf('class="room-card-body"'));
  assert.match(card,/aria-label="分享房源"/);
  assert.match(html,/@media\s*\(max-width:\s*767px\)[\s\S]*?\.room-photo-arrow\s*\{\s*display:\s*none/);
  assert.match(html,/\.room-share\s*\{[^}]*position:\s*absolute/);
});
test('native share sends only public URL and title; cancellation does not copy',async()=>{
  const sent=[];let copied=0;const button=shareButton();
  const c=context({navigator:{share:async v=>sent.push(v),clipboard:{writeText:async()=>copied++}},showToast:()=>{}});
  await c.shareRoomWebsite(button);assert.deepEqual(JSON.parse(JSON.stringify(sent)),[{title:'查看房源',url:room.room_website_url}]);
  c.navigator.share=async()=>{throw Object.assign(Error(),{name:'AbortError'});};await c.shareRoomWebsite(button);assert.equal(copied,0);
});
test('share falls back to clipboard or visible manual link without automatic navigation',async()=>{
  let copied='';const status={hidden:true,textContent:''};const button=shareButton(status);
  const c=context({navigator:{clipboard:{writeText:async v=>copied=v}},showToast:()=>{}});
  await c.shareRoomWebsite(button);assert.equal(copied,room.room_website_url);
  c.navigator.clipboard.writeText=async()=>{throw Error('denied');};await c.shareRoomWebsite(button);assert.equal(status.hidden,false);assert.match(status.textContent,/https:/);
});
test('sharing rejects admin and unrelated targets, strips queries and uses a neutral public title',async()=>{
  const sent=[];const c=context({navigator:{share:async v=>sent.push(v)},showToast:()=>{}});
  for (const url of ['https://admin.z3house.com/','https://example.test/private','https://u:p@rooms.z3house.com/spaces/101/']) {
    await c.shareRoomWebsite({dataset:{shareUrl:url},nextElementSibling:{}});
  }
  assert.equal(sent.length,0);
  const card=c.roomCard({...room,room_name:'Internal customer reference',room_website_url:room.room_website_url+'?preview_token=synthetic#private'});
  assert.match(card,/data-share-title="查看房源"/);assert.doesNotMatch(card,/data-share-url="[^"]*preview_token/);
  const button=shareButton();button.dataset={shareUrl:room.room_website_url+'?preview_token=synthetic',shareTitle:'Internal customer'};
  await c.shareRoomWebsite(button);
  assert.deepEqual(JSON.parse(JSON.stringify(sent)),[{title:'查看房源',url:room.room_website_url}]);
});
test('native share rejection uses copy fallback; missing clipboard exposes manual copy',async()=>{
  let copied='';const fallback={hidden:true};const button=shareButton(fallback);
  const c=context({navigator:{share:async()=>{throw Error('unsupported');},clipboard:{writeText:async v=>copied=v}},showToast:()=>{}});
  await c.shareRoomWebsite(button);assert.equal(copied,room.room_website_url);assert.equal(button.disabled,false);
  delete c.navigator.clipboard;await c.shareRoomWebsite(button);assert.equal(fallback.hidden,false);assert.match(fallback.textContent,/https:/);
});
test('gallery scroll updates counter and arrows move one slide without wrapping',()=>{
  const prev={},next={},counter={};let move;
  const track={clientWidth:300,scrollLeft:300,children:[{}, {}, {}],scrollTo:v=>move=v};
  const gallery={querySelector:s=>s==='.room-photo-track'?track:s==='.room-photo-counter'?counter:s==='[data-photo-prev]'?prev:next};track.closest=()=>gallery;
  const c=context({window:{matchMedia:()=>({matches:false})}});c.updateRoomPhoto(track);assert.equal(counter.textContent,'2 / 3');assert.equal(prev.disabled,false);
  c.moveRoomPhoto({closest:()=>gallery},1);assert.equal(move.left,600);
  track.scrollLeft=600;c.updateRoomPhoto(track);assert.equal(next.disabled,true);
});
