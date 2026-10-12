import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeReplicaRows} from '../cloudflare/read-api/src/read-dataset.js';
import * as datasetTransport from '../cloudflare/read-api/src/read-dataset.js';

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

test('packed replica cells preserve presence, scalar types, own keys and order exactly as column rows',()=>{
  const decode=datasetTransport.decodePackedRows;
  assert.equal(typeof decode,'function');
  const rows=[Object.fromEntries([
    ['room_id','"R1"'],['absent',null],['nullable','null'],['zero','0'],['negativeZero','-0'],
    ['enabled','true'],['disabled','false'],['empty','""'],['unicode','"台灣 🥧"'],
    ['quoted',JSON.stringify('quote\'"\\\n')],['metadata','"[\\"date\\"]"'],
    ['date','"2026-10-01T00:00:00+08:00"'],['__proto__','{"polluted":true}']
  ])];
  const fields=Object.keys(rows[0]),packed=rows.map(row=>({replica_values:JSON.stringify(fields.map(f=>row[f]))}));
  const before=JSON.stringify(packed),actual=decode(packed,fields);
  assert.deepEqual(actual,decodeReplicaRows(rows));
  assert.equal(JSON.stringify(packed),before);
  assert.deepEqual(Object.keys(actual[0]),fields.filter(f=>f!=='absent'));
  assert.equal(Object.hasOwn(actual[0],'absent'),false);
  assert.equal(Object.hasOwn(actual[0],'nullable'),true);
  assert.equal(actual[0].nullable,null);
  assert.equal(Object.is(actual[0].negativeZero,-0),true);
  assert.equal(Object.getPrototypeOf(actual[0]),Object.prototype);
  assert.equal(Object.hasOwn(actual[0],'__proto__'),true);
  assert.equal(actual[0].polluted,undefined);
  assert.deepEqual(decode([],fields),[]);
});

test('packed replica decoding rejects corrupt cells and incomplete or non-array row frames',()=>{
  const decode=datasetTransport.decodePackedRows;
  assert.equal(typeof decode,'function');
  assert.throws(()=>decode([{replica_values:'["invalid"]'}],['amount']),SyntaxError);
  assert.throws(()=>decode([{replica_values:'[]'}],['amount']),/shape/);
  assert.throws(()=>decode([{replica_values:'{}'}],[]),/shape/);
  assert.throws(()=>decode([{replica_values:'[null,null]'}],['amount']),/shape/);
});
