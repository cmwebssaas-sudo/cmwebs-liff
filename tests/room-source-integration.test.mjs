import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

test('room source navigation remains available from landlord operational pages', () => {
  for (const file of ['landlord-home.html', 'landlord-more.html', 'landlord-tenants.html', 'landlord-properties.html', 'landlord-billing.html', 'landlord-contract-requests.html', 'landlord-arrears.html', 'landlord-tenant-detail.html', 'landlord-revenue-dashboard.html', 'landlord-rooms.html']) {
    const html = fs.readFileSync(file, 'utf8');
    const nav = html.match(/<nav class="bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
    assert.match(nav, /goPage\('landlord-rooms\.html'\)/, file);
    assert.match(nav, /<span>房源<\/span>/, file);
    assert.match(nav, /goPage\('landlord-tenants\.html'\)/, file);
  }
});

test('room listing projection joins exact listing identity without leaking another binding', () => {
  const context = vm.createContext({ propertyRoomText_: value => String(value ?? '').trim(), workspaceGetObjectsWithRow_: sheet => sheet.rows });
  vm.runInContext(fs.readFileSync('apps-script/V2_LANDLORD_ROOM_CENTER.js', 'utf8'), context);
  const rows = {
    V3_listing_integrations: [{workspace_id:'W1',room_id:'R1',binding_status:'bound',z3house_listing_id:'L1'}],
    V3_listing_integration_snapshots: [
      {workspace_id:'W1',room_id:'R1',z3house_listing_id:'L2',title:'Wrong listing',published:true,independent_site_url:'https://wrong.example/'},
      {workspace_id:'W2',room_id:'R1',z3house_listing_id:'L1',title:'Other workspace',published:true},
      {workspace_id:'W1',room_id:'R1',z3house_listing_id:'L1',title:'Correct listing',published:true,independent_site_url:'https://rooms.example/one'}
    ]
  };
  const ss = {getSheetByName: name => rows[name] ? {rows:rows[name]} : null};
  let result=context.landlordRoomCenterZ3houseByRoom_(ss,{workspace:{workspace_id:'W1'}});
  assert.equal(result.R1.title,'Correct listing');
  rows.V3_listing_integration_snapshots.pop();
  result=context.landlordRoomCenterZ3houseByRoom_(ss,{workspace:{workspace_id:'W1'}});
  assert.equal(result.R1.title,'');
  assert.equal(result.R1.independent_site_url,'');
});

test('missing bridge sheets leave room source explicitly unbound', () => {
  const context=vm.createContext({propertyRoomText_:value=>String(value??'').trim()});
  vm.runInContext(fs.readFileSync('apps-script/V2_LANDLORD_ROOM_CENTER.js','utf8'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.landlordRoomCenterZ3houseByRoom_({getSheetByName:()=>null},{workspace:{workspace_id:'W1'}}))),{});
});
test('room cards expose only safe URLs for confirmed bindings', () => {
  const html=fs.readFileSync('landlord-rooms.html','utf8');
  const functionSource=html.slice(html.indexOf('    function safeExternalUrl('),html.indexOf('    function render()'));
  const context=vm.createContext({text:v=>String(v??''),safeHtml:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),money:v=>String(v),statusClass:()=>'',statusLabel:()=>''});
  vm.runInContext(functionSource,context);
  const room={room_id:'R1',z3house:{binding_status:'bound',independent_site_url:'https://rooms.example/one'}};
  assert.match(context.roomCard(room),/href="https:\/\/rooms.example\/one"/);
  room.z3house.binding_status='unbound';
  assert.doesNotMatch(context.roomCard(room),/<a /);
  room.room_website_url='https://manual.example/';
  assert.match(context.roomCard(room),/href="https:\/\/manual.example\/"/);
  room.room_website_url='';
  room.z3house.binding_status='bound';
  room.z3house.independent_site_url='javascript:alert(1)';
  assert.doesNotMatch(context.roomCard(room),/<a /);
});
