import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

// Bounded correctness probes only. Both formats and their decoders execute in
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
    // Original encoded-row SQL is intentionally independent of the new codec.
    const before=await read(env.DB,source,item.params,fields,'json_array('+quoted.join(',')+') AS replica_values');
    const after=await read(env.DB,source,item.params,fields,packedSelection(fields));
    const frame=after.rows&&JSON.parse(after.rows[0].replica_values);
    const typed=Array.isArray(frame)&&frame.length===fields.length+1&&typeof frame[0]==='string'&&frame[0].length===fields.length;
    records.push({name:item.name,before:before.stage,after:after.stage,kind:after.kind,
      parity:before.stage===after.stage&&(before.stage==='success'?same(before.value,after.value):before.kind===after.kind),
      typed,modes:typed?frame[0]:null,
      before_bytes:before.rows?new TextEncoder().encode(before.rows[0].replica_values).length:null,
      after_bytes:after.rows?new TextEncoder().encode(after.rows[0].replica_values).length:null});
  }
  return Response.json({records,polluted:({}).polluted??null});
}};`;

test('typed SQL packing preserves strict stored-cell semantics, deep fallback and BLOB errors in actual D1',async()=>{
  const valid=['null','true','false','0','-0','-0.0','-0e3','-1e-9999','1e400','-1e400','9007199254740993',
    '1.234567890123456789','""','"台灣 🥧"','"quote\\\"\\\\\\n"','"\\uD800"','"\\uDC00"','"\\uD800\\uDC00"',
    '{"a":1,"a":2}','{"x":1,"\\u0078":2}','{"\\u0000a":1,"\\u0000b":2}',
    '{"z":-0,"a":[-0,true,null]}','{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}',
    ' \t\r\n { "x" : [1,null] } '];
  const invalid=['','invalid','true x','{"a":','"\\q"','"raw\u0000string"','1\u0000junk','null\u0000false',
    '"ok"\u0000bad','{"x":1}\u0000[]','\u00001','[1\u0000]','[1,]','/*x*/1',"'x'",'{a:1}','0x10','NaN','Infinity','+1','.5','\v1'];
  const cases=[
    ...valid.map((value,index)=>({name:'valid'+index,params:[value],stage:'success',mode:'1'})),
    ...invalid.map((value,index)=>({name:'invalid'+index,params:[value],stage:'decode-error',mode:'2'})),
    {name:'SQL_NULL',params:[null],stage:'success',mode:'0'},
    {name:'SQLInteger',expressions:['17'],params:[],stage:'success',mode:'1'},
    {name:'SQLReal',expressions:['-0.25'],params:[],stage:'success',mode:'1'},
    {name:'SQLNegativeZero',expressions:['-0.0'],params:[],stage:'success',mode:'1'},
    {name:'SQLInfinity',expressions:['1e400'],params:[],stage:'decode-error',mode:'2'},
    ...[999,1000,1001,1100].map(depth=>({name:'deep'+depth,params:['['.repeat(depth)+'0'+']'.repeat(depth)],stage:'success',mode:depth>1000?'2':'1'})),
    {name:'blobText',expressions:['CAST(? AS BLOB)'],params:['"safe"'],stage:'sql-error'},
    {name:'blobAmbiguous',expressions:["x'33343536'"],params:[],stage:'success',mode:'2'},
    {name:'blobInvalid',expressions:["x'ffff'"],params:[],stage:'sql-error'},
    {name:'blobJSONB',expressions:['jsonb(?)'],params:['{"x":1}'],stage:'decode-error',mode:'2'},
    {name:'blobJSONBNull',expressions:['jsonb(?)'],params:['null'],stage:'success',mode:'2'},
    {name:'emptyFields',fields:[],params:[],stage:'success',mode:''},
    {name:'ownProto',fields:['__proto__'],params:['{"polluted":true}'],stage:'success',mode:'1'},
    {name:'quotedIdentifier',fields:['quoted"key'],params:['"safe"'],stage:'success',mode:'1'},
    {name:'mixed',fields:['absent','nullable','nested','__proto__'],params:[null,'null','{"x":[-0,true]}','{"polluted":true}'],stage:'success',mode:'0111'},
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
      assert.equal(row.after,expected.stage,row.name+' typed result');
      assert.equal(row.parity,true,row.name+' exact values/negative-zero/own-key/error parity');
      if(row.after!=='sql-error') {
        assert.equal(row.typed,true,row.name+' new typed frame');
        if(expected.mode!==undefined)assert.equal(row.modes,expected.mode,row.name+' promotion/fallback');
      }
    }
    assert.equal(result.polluted,null);
    const wide=result.records.find(row=>row.name==='wide69');
    assert.equal(wide.modes.length,69);
    assert.ok(wide.after_bytes<wide.before_bytes,'same69-field row avoids double-encoded payload bytes');
  } finally {await mf.dispose();}
});
