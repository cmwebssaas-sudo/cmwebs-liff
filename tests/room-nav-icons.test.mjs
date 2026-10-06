import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

const pages=['home','more','tenants','properties','billing','contract-requests','arrears','tenant-detail','revenue-dashboard','rooms'];
test('room navigation uses scalable icons instead of font-dependent glyphs on every integrated page',()=>{
  for(const page of pages){
    const html=fs.readFileSync(`landlord-${page}.html`,'utf8');
    const nav=html.match(/<nav class="bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)[1];
    const room=nav.match(/<button[^>]*onclick="goPage\('landlord-rooms\.html'\)"[^>]*>([\s\S]*?)<\/button>/)[1];
    assert.match(room,/<svg[^>]*viewBox="0 0 24 24"/,page);
    assert.doesNotMatch(room,/⌂|♙|▣/,page);
  }
});
test('room page has the same five navigation icons as the home page with a distinct room icon',()=>{
  const icons=page=>[...fs.readFileSync(page,'utf8').match(/<nav class="bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)[1].matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m=>m[0].replace(/\s+/g,' '));
  const home=icons('landlord-home.html'),rooms=icons('landlord-rooms.html');
  assert.equal(rooms.length,5);
  assert.deepEqual(rooms,home);
  assert.notEqual(rooms[0],rooms[3]);
});
