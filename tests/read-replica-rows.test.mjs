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

test('scalar decoding retains JSON escapes, whitespace, nested values and strict malformed-string rejection',()=>{
  const examples=[['"plain 台灣"','plain 台灣'],['""',''],['"line\\nnext"','line\nnext'],['"back\\\\slash"','back\\slash'],
    ['"quoted\\\"text"','quoted"text'],[' true ',true],[' false ',false],[' null ',null],[' -0 ',-0],['[1,"x",null]',[1,'x',null]]];
  for(const [stored,expected] of examples){
    assert.deepEqual(decodeReplicaRows([{cell:stored}])[0].cell,expected);
    assert.deepEqual(datasetTransport.decodePackedRows([{replica_values:JSON.stringify([stored])}],['cell'])[0].cell,expected);
  }
  for(const stored of ['"','"unterminated','"inside"quote"','"control\nline"','"control\u0000byte"','"bad\\xescape"','nullish','trueX']){
    assert.throws(()=>decodeReplicaRows([{cell:stored}]),SyntaxError);
    assert.throws(()=>datasetTransport.decodePackedRows([{replica_values:JSON.stringify([stored])}],['cell']),SyntaxError);
  }
});

test('typed packed cells retain null presence, negative zero, nested own keys and duplicate-field order',()=>{
  const fields=['absent','nullable','negativeZero','nested','__proto__'];
  const packed=[{replica_values:'["01111",null,null,-0,{"a":[-0,true]},{"polluted":true}]'}];
  const before=JSON.stringify(packed),[row]=datasetTransport.decodePackedRows(packed,fields);
  assert.deepEqual(Object.keys(row),['nullable','negativeZero','nested','__proto__']);
  assert.equal(Object.hasOwn(row,'absent'),false);
  assert.equal(row.nullable,null);
  assert.equal(Object.is(row.negativeZero,-0),true);
  assert.equal(Object.is(row.nested.a[0],-0),true);
  assert.equal(Object.hasOwn(row,'__proto__'),true);
  assert.equal(Object.getPrototypeOf(row),Object.prototype);
  assert.equal(row.polluted,undefined);
  assert.equal(JSON.stringify(packed),before);
  const duplicate=datasetTransport.decodePackedRows([{replica_values:'["1110",1,{"safe":true},2,null]'}],['x','__proto__','x','x'])[0];
  assert.deepEqual(Object.keys(duplicate),['x','__proto__']);
  assert.equal(duplicate.x,2,'an absent later field does not remove an earlier value');
  assert.deepEqual(datasetTransport.decodePackedRows([{replica_values:'[""]'}],[]),[{}]);
});

test('typed raw fallback retains deep JSON, legacy scalar coercion and strict invalid JSON rejection',()=>{
  const deep='['.repeat(1100)+'0'+']'.repeat(1100);
  const [row]=datasetTransport.decodePackedRows([{replica_values:JSON.stringify(['222',deep,'-0',17])}],['deep','negativeZero','numeric']);
  let value=row.deep;
  for(let depth=0;depth<1100;depth++){assert.equal(value.length,1);value=value[0];}
  assert.equal(value,0);
  assert.equal(Object.is(row.negativeZero,-0),true);
  assert.equal(row.numeric,17);
  assert.deepEqual(datasetTransport.decodePackedRows([{replica_values:'["2",null]'}],['absent']),[{}],
    'a raw fallback null keeps the legacy skip, including JSONB-null packing');
  for(const raw of ['1\u0000junk','null\u0000false','"ok"\u0000bad','{"x":1}\u0000[]','"raw\u0000string"','[1,]','{a:1}','NaN','invalid'])
    assert.throws(()=>datasetTransport.decodePackedRows([{replica_values:JSON.stringify(['2',raw])}],['value']),SyntaxError);
});

test('typed packed frames reject invalid mode headers, absent payloads and incomplete rows',()=>{
  for(const frame of ['[null,null]','[1,null]','["",null]','["11",null]','["3",null]','["0",1]','["0",false]','["1",null,0]'])
    assert.throws(()=>datasetTransport.decodePackedRows([{replica_values:frame}],['value']),/shape/);
  assert.throws(()=>datasetTransport.decodePackedRows([{replica_values:'["00",null]'}],['a','b']),SyntaxError,
    'length-N remains the legacy format, never inferred from a mode-looking first field');
});
