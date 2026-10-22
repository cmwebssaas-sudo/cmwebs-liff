import assert from 'node:assert/strict';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
const m=await import('../scripts/read-authority-ready-projection.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const projector=async function syntheticProjection(options){return JSON.stringify({urlMatched:document.URL===options.expectedURL,controls:document.querySelectorAll('synthetic-controls').length});};
const pin=createHash('sha256').update(Function.prototype.toString.call(projector)).digest('hex');
function build(){assert.equal(typeof m.compileReadyAuthorityProjection,'function');return m.compileReadyAuthorityProjection(projector,pin);}
for(const state of ['loading','interactive','unknown',null])test('incomplete readiness '+String(state)+' precedes all URL account and settings reads',async()=>{
 let reads=0;const fn=build(),document={readyState:state,get URL(){reads++;throw Error('MUST_NOT_READ');},querySelectorAll(){reads++;throw Error('MUST_NOT_READ');}};
 const callback=runInNewContext('('+fn.toString()+')',{document});
 const result=JSON.parse(await callback({expectedURL:'https://synthetic.invalid/'}));
 assert.equal(reads,0);assert.equal(result.accountVerified,false);assert.equal(result.fieldsRead,false);
 assert.equal(result.phase,'READY');assert.equal(result.reason,'NOT_COMPLETE');assert.deepEqual(result.controls,[]);
});
test('complete self-contained projection preserves the original pinned URL and control guard behavior',async()=>{
 const fn=build(),document={readyState:'complete',URL:'https://synthetic.invalid/',querySelectorAll:()=>[{},{}]};
 const callback=runInNewContext('('+fn.toString()+')',{document});
 assert.deepEqual(JSON.parse(await callback({expectedURL:document.URL})),{urlMatched:true,controls:2});
});
test('unverified source and proxy projector cannot compile or execute',()=>{
 assert.equal(typeof m.compileReadyAuthorityProjection,'function');let reads=0;
 const proxy=new Proxy(projector,{get(){reads++;throw Error();},apply(){reads++;throw Error();}});
 for(const value of [proxy,null,{}])assert.throws(()=>m.compileReadyAuthorityProjection(value,pin),/PROJECTION_SOURCE/);
 assert.throws(()=>m.compileReadyAuthorityProjection(projector,'0'.repeat(64)),/PROJECTION_SOURCE/);assert.equal(reads,0);
});
test('throwing readyState getter returns unknown without touching URL or controls',async()=>{
 let reads=0;const fn=build(),document={get readyState(){throw Error('synthetic');},get URL(){reads++;throw Error();},querySelectorAll(){reads++;throw Error();}};
 const callback=runInNewContext('('+fn.toString()+')',{document});
 const result=JSON.parse(await callback({}));assert.equal(result.ready,'UNKNOWN');assert.equal(result.accountVerified,false);assert.equal(reads,0);
});
