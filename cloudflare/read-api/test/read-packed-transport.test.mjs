import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

// Bounded correctness probes only. Reference and runtime packing execute in
// actual workerd/D1; there is no HTTP capacity or timing loop in this file.
const entry=`
import {packedSelection,decodePackedRows} from './read-dataset.js';
function same(left,right) {
  const pending=[[left,right]];
  while(pending.length) {
    const [a,b]=pending.pop();
    if(Object.is(a,b))continue;
    if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const ak=Object.keys(a),bk=Object.keys(b);
    if(ak.length!==bk.length||ak.some((key,index)=>key!==bk[index]))return false;
    if(!Array.isArray(a)&&(Object.getPrototypeOf(a)!==Object.prototype||Object.getPrototypeOf(b)!==Object.prototype))return false;
    for(const key of ak)pending.push([a[key],b[key]]);
  }
  return true;
}
async function read(db,source,params,fields,selection) {
  let rows;
  try {rows=(await db.prepare(source+' SELECT '+selection+' FROM source').bind(...params).all()).results;}
  catch(error){return {stage:'sql-error',kind:error.name};}
  try {return {stage:'success',rows,value:decodePackedRows(rows,fields)};}
  catch(error){return {stage:'decode-error',rows,kind:error.name};}
}
export default {async fetch(request,env) {
  const records=[];
  for(const item of await request.json()) {
    const fields=item.fields||['value'],quoted=fields.map(field=>'"'+field.replaceAll('"','""')+'"');
    const expressions=item.expressions||fields.map(()=>'?');
    const source='WITH source AS (SELECT '+(fields.length?quoted.map((name,index)=>expressions[index]+' AS '+name).join(','):'1 AS unused')+')';
    // The encoded-row reference stays independent of the runtime projection.
    const before=await read(env.DB,source,item.params,fields,'json_array('+quoted.join(',')+') AS replica_values');
    const after=await read(env.DB,source,item.params,fields,packedSelection(fields));
    records.push({name:item.name,before:before.stage,after:after.stage,kind:after.kind,
      parity:before.stage===after.stage&&(before.stage==='success'?same(before.value,after.value):before.kind===after.kind),
      before_frame:before.rows?.[0].replica_values,after_frame:after.rows?.[0].replica_values,
      before_bytes:before.rows?new TextEncoder().encode(before.rows[0].replica_values).length:null,
      after_bytes:after.rows?new TextEncoder().encode(after.rows[0].replica_values).length:null});
  }
  return Response.json({records,polluted:({}).polluted??null});
}};`;

test('encoded SQL packing preserves strict stored-cell semantics, deep parsing and BLOB errors in actual D1',async()=>{
  const valid=['null','true','false','0','-0','-0.0','-0e3','-1e-9999','1e400','-1e400','9007199254740993',
    '1.234567890123456789','""','"台灣 🥧"','"quote\\\"\\\\\\n"','"\\uD800"','"\\uDC00"','"\\uD800\\uDC00"',
    '{"a":1,"a":2}','{"x":1,"\\u0078":2}','{"\\u0000a":1,"\\u0000b":2}',
    '{"z":-0,"a":[-0,true,null]}','{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}',
    ' \t\r\n { "x" : [1,null] } '];
  const invalid=['','invalid','true x','{"a":','"\\q"','"raw\u0000string"','1\u0000junk','null\u0000false',
    '"ok"\u0000bad','{"x":1}\u0000[]','\u00001','[1\u0000]','[1,]','/*x*/1',"'x'",'{a:1}','0x10','NaN','Infinity','+1','.5','\v1'];
  const cases=[
    ...valid.map((value,index)=>({name:'valid'+index,params:[value],stage:'success'})),
    ...invalid.map((value,index)=>({name:'invalid'+index,params:[value],stage:'decode-error'})),
    {name:'SQL_NULL',params:[null],stage:'success',wire:'[null]'},
    {name:'SQLInteger',expressions:['17'],params:[],stage:'success',wire:'[17]'},
    {name:'SQLReal',expressions:['-0.25'],params:[],stage:'success'},
    {name:'SQLNegativeZero',expressions:['-0.0'],params:[],stage:'success'},
    {name:'SQLInfinity',expressions:['1e400'],params:[],stage:'decode-error'},
    ...[999,1000,1001,1100].map(depth=>({name:'deep'+depth,params:['['.repeat(depth)+'0'+']'.repeat(depth)],stage:'success'})),
    {name:'blobText',expressions:['CAST(? AS BLOB)'],params:['"safe"'],stage:'sql-error'},
    {name:'blobAmbiguous',expressions:["x'33343536'"],params:[],stage:'success'},
    {name:'blobInvalid',expressions:["x'ffff'"],params:[],stage:'sql-error'},
    {name:'blobJSONB',expressions:['jsonb(?)'],params:['{"x":1}'],stage:'decode-error'},
    {name:'blobJSONBNull',expressions:['jsonb(?)'],params:['null'],stage:'success'},
    {name:'emptyFields',fields:[],params:[],stage:'success',wire:'[]'},
    {name:'ownProto',fields:['__proto__'],params:['{"polluted":true}'],stage:'success'},
    {name:'quotedIdentifier',fields:['quoted"key'],params:['"safe"'],stage:'success'},
    {name:'mixed',fields:['absent','nullable','nested','__proto__'],params:[null,'null','{"x":[-0,true]}','{"polluted":true}'],stage:'success'},
    {name:'wide69',fields:Array.from({length:69},(_,index)=>'c'+index),params:Array.from({length:69},(_,index)=>index%5===0?null:index%5===1?'null':index%5===2?'"a\\n b"':index%5===3?'[1,{"x":-0}]':'9007199254740993'),stage:'success'}
  ];
  const bundle=await build({stdin:{contents:entry,resolveDir:new URL('../src/',import.meta.url).pathname,sourcefile:'packed-transport-worker.js'},
    bundle:true,write:false,format:'esm',target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,
    compatibilityDate:'2026-10-06',d1Databases:{DB:randomUUID()}}));
  try {
    const response=await mf.dispatchFetch('https://local.test/correctness',{method:'POST',body:JSON.stringify(cases)});
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.records.length,cases.length);
    for(const [index,row] of result.records.entries()) {
      const expected=cases[index];
      assert.equal(row.name,expected.name);
      assert.equal(row.before,expected.stage,row.name+' original result');
      assert.equal(row.after,expected.stage,row.name+' encoded result');
      assert.equal(row.parity,true,row.name+' exact values/negative-zero/own-key/error parity');
      if(row.after!=='sql-error') {
        assert.equal(row.after_frame,row.before_frame,row.name+' exact encoded frame');
        assert.equal(row.after_bytes,row.before_bytes,row.name+' encoded byte preservation');
        if(expected.wire!==undefined)assert.equal(row.after_frame,expected.wire,row.name+' literal encoded frame');
      }
    }
    assert.equal(result.polluted,null);
  } finally {await mf.dispose();}
});
