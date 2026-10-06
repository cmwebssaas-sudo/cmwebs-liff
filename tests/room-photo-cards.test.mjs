import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function render(room){
  const html=fs.readFileSync('landlord-rooms.html','utf8');
  const context=vm.createContext({text:v=>String(v??''),safeHtml:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),money:v=>'NT$ '+v,statusClass:()=> 'occupied',statusLabel:()=> '已出租'});
  vm.runInContext(html.slice(html.indexOf('    function safeExternalUrl('),html.indexOf('    function render()')),context);
  return context.roomCard(room);
}
test('room card presents its photo before a compact title and rent, with website editing collapsed',()=>{
  const html=render({room_id:'R1',room_name:'506',property_name:'no88',rent_amount:8500,room_website_url:'https://manual.example/',z3house:{binding_status:'bound',title:'明亮套房',thumbnail_url:'https://photos.example/506.jpg'}});
  assert.ok(html.indexOf('<img')<html.indexOf('room-card-body'));
  assert.match(html,/明亮套房/);assert.match(html,/506/);assert.match(html,/NT\$ 8500/);
  assert.match(html,/<details class="room-management"><summary>管理<\/summary>/);
  assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
  assert.doesNotMatch(html,/電費單價|帳號狀態|房間 ID：|後端橋接|僅顯示房間營運/);
  assert.match(html,/href="https:\/\/manual.example\/"/);
});
test('unbound or unsafe photos never masquerade as real room photos',()=>{
  for(const listing of [{binding_status:'unbound',thumbnail_url:'https://photos.example/other.jpg'},{binding_status:'bound',thumbnail_url:'javascript:alert(1)'}]){
    const html=render({room_id:'R2',room_name:'502',z3house:listing});
    assert.doesNotMatch(html,/<img/);assert.match(html,/尚未提供照片/);
  }
});
test('room card escapes listing titles and uses a room name when no public title exists',()=>{
  assert.match(render({room_id:'R1',room_name:'506',z3house:{binding_status:'bound',title:'<script>bad</script>'}}),/&lt;script>/);
  assert.match(render({room_id:'R2',room_name:'502',z3house:{}}),/502/);
});
