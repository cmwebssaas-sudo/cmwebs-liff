import assert from 'node:assert/strict';
import test from 'node:test';
const m=await import('../scripts/read-authority-inventory-diagnostic.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const options={providerTabId:'123',expectedURL:'https://synthetic.invalid/settings'};
const row={id:'opaque-a',providerTabId:'123',url:options.expectedURL};
function classify(raw){assert.equal(typeof m.classifyAuthorityInventory,'function');return m.classifyAuthorityInventory(raw,options);}
test('inventory diagnostic selects only unique original provider ID and exact URL without retaining unknown metadata',()=>{
 const unknown=new Proxy({},{ownKeys(){throw Error('MUST_NOT_TRAVERSE');}});
 const r=classify([{...row,title:'SYNTHETIC_SECRET',unknown}]);
 assert.equal(r.classification.status,'VERIFIED');assert.equal(r.classification.originalMatches,1);
 assert.deepEqual(r.selected,row);assert(!JSON.stringify(r.classification).includes('SYNTHETIC_SECRET'));
 assert(!JSON.stringify(r.classification).includes(row.id));assert(!JSON.stringify(r.classification).includes(options.expectedURL));
});
test('opaque ID never substitutes for missing providerTabId, and ambiguous or mismatched originals are rejected',()=>{
 for(const [raw,status]of [
  [[{id:'123',url:options.expectedURL}],'ORIGINAL_MATCH_COUNT'],
  [[row,{...row,id:'opaque-b'}],'ORIGINAL_MATCH_COUNT'],
  [[{...row,url:'https://synthetic.invalid/other'}],'URL_MISMATCH'],
  [[row,{...row,providerTabId:'999'}],'DUPLICATE_ID']]){
  const r=classify(raw);assert.equal(r.classification.status,status);assert.equal(r.selected,null);
 }
});
test('proxy and accessor diagnostics never invoke handlers or getters, including unknown top-level keys',()=>{
 let reads=0;
 for(const raw of [new Proxy([],{get(){reads++;throw Error();},ownKeys(){reads++;throw Error();}}),
  [new Proxy(row,{get(){reads++;throw Error();},ownKeys(){reads++;throw Error();}})],
  [{...row,get unknown(){reads++;throw Error();}}],
  Object.defineProperty([row],'0',{get(){reads++;throw Error();}})]){
  const r=classify(raw);assert.notEqual(r.classification.status,'VERIFIED');assert.equal(r.selected,null);
 }
 assert.equal(reads,0);
});
test('malformed arrays, rows and required metadata produce only fixed enums counts and booleans',()=>{
 for(const raw of [null,{},Array(1),Array(301).fill(row),[{...row,id:null}],[{...row,providerTabId:12}],[{...row,url:{secret:true}}]]){
  const r=classify(raw);assert.equal(r.selected,null);assert.notEqual(r.classification.status,'VERIFIED');
  for(const [key,value]of Object.entries(r.classification))assert(['source','status'].includes(key)?typeof value==='string':typeof value==='boolean'||Number.isSafeInteger(value));
 }
});
test('API rejection classification consumes no error text and grants no selection or identity credit',()=>{
 assert.equal(typeof m.authorityInventoryApiFailure,'function');
 const r=m.authorityInventoryApiFailure();assert.equal(r.classification.status,'API_REJECTED');assert.equal(r.selected,null);
 assert.equal(r.classification.rawValuesRetained,false);
});
test('oversized metadata records stop before inspecting arbitrary values',()=>{
 const large={...row};for(let i=0;i<40;i++)large['unknown'+i]='SYNTHETIC_SECRET';
 const r=classify([large]);assert.equal(r.classification.status,'METADATA_INVALID');assert.equal(r.selected,null);
});
test('symbol data keys are invalid metadata and never mislabeled as accessor execution',()=>{
 const r=classify([{...row,[Symbol('synthetic')]:1}]);
 assert.equal(r.classification.status,'METADATA_INVALID');assert.equal(r.classification.accessors,0);assert.equal(r.classification.invalidRows,1);
});
test('revoked root row and options proxies are rejected before reflection',()=>{
 const root=Proxy.revocable([],{}),item=Proxy.revocable(row,{}),opts=Proxy.revocable(options,{});root.revoke();item.revoke();opts.revoke();
 assert.equal(classify(root.proxy).classification.status,'ROOT_PROXY');
 assert.equal(classify([item.proxy]).classification.status,'METADATA_INVALID');
 assert.equal(m.classifyAuthorityInventory([row],opts.proxy).classification.status,'OPTIONS_INVALID');
});
