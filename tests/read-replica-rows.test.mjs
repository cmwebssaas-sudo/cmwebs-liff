import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeReplicaRows} from '../cloudflare/read-api/src/read-dataset.js';

test('replica rows preserve stored JSON types, absent SQL fields and safe own keys without mutating input',()=>{
  const row=Object.fromEntries([
    ['room_id','"R1"'],['zero','0'],['enabled','true'],['disabled','false'],
    ['empty','""'],['nullable','null'],['absent',null],['unicode','"合成"'],
    ['date','"2026-10-01T00:00:00+08:00"'],['metadata','"[\\"date\\"]"'],
    ['__proto__','{"polluted":true}']
  ]);
  const before=JSON.stringify(row),actual=decodeReplicaRows([row]);
  assert.equal(JSON.stringify(row),before);
  assert.deepEqual(actual,[{room_id:'R1',zero:0,enabled:true,disabled:false,empty:'',
    nullable:null,unicode:'合成',date:'2026-10-01T00:00:00+08:00',metadata:'["date"]',
    ['__proto__']:{polluted:true}}]);
  assert.equal(actual[0].enabled,true);
  assert.equal(actual[0].disabled,false);
  assert.equal(actual[0].zero,0);
  assert.equal(actual[0].nullable,null);
  assert.equal(Object.hasOwn(actual[0],'absent'),false);
  assert.equal(Object.getPrototypeOf(actual[0]),Object.prototype);
  assert.equal(Object.hasOwn(actual[0],'__proto__'),true);
  assert.equal(actual[0].polluted,undefined);
  assert.deepEqual(decodeReplicaRows([]),[]);
});

test('replica row decoding rejects malformed stored JSON instead of accepting a partial row',()=>{
  assert.throws(()=>decodeReplicaRows([{room_id:'"R1"',amount:'invalid'}]),SyntaxError);
});
