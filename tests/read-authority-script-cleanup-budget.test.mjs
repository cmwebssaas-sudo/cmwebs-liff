import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {fixture,session,cleanupSession,clock,hash,compact,wrapped} from './fixtures/read-authority/standalone-budget.mjs';
import {operation,research} from './fixtures/read-authority/continuation-budget.mjs';
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r)),deny=r=>assert.equal(r.ok,false,JSON.stringify(r));
const registry=s=>join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.standalone.json');
async function stopped(s,count=1){const h=session(s);try{ok(await h.ready);for(let i=0;i<count;i++){const op=i<2?operation('P:'+['caller-bind','publisher-bind'][i]):research(i-1);ok(await h.send({op:'debit',operation:op,now:clock}));}ok(await h.send({op:'finish',now:clock}));}finally{await h.close();}}
test('independent script cleanup keeps ordinary corrupt bytes and imports all actual history',async()=>{
 const s=fixture(),original=readFileSync(s.path);await stopped(s);s.put(s.path+'.standalone.json','CORRUPTED-ORDINARY');s.put(s.path+'.standalone-stop.json','PARTIAL-STOP');
 const h=cleanupSession(s,{now:clock+21600000,minimumNewSpent:1});try{const r=await h.ready;ok(r);assert.equal(r.spent,32);assert.equal(r.state,'stopped');
 for(const [action,spent] of [['script-remove',33],['script-verify',34]]){const q={action,now:clock+21600000};ok(await h.send({op:'scriptcleanup-wait',...q}));const v=await h.send({op:'scriptcleanup-debit',...q});ok(v);assert.equal(v.spent,spent);}
 deny(await h.send({op:'scriptcleanup-debit',action:'script-remove',now:clock+21600000}));assert.equal(readFileSync(s.path+'.standalone.json','utf8'),'CORRUPTED-ORDINARY');assert.deepEqual(readFileSync(s.path),original);
 const cp=JSON.parse(readFileSync(registry(s))).value.checkpoint;assert.equal(cp.spent,3);assert.deepEqual(cp.events.slice(-2).map(v=>[v.operation.bucket,v.operation.alias,v.outcome]),[['J','script-remove','UNKNOWN'],['J','script-verify','UNKNOWN']]);
 }finally{await h.close();}
 const again=cleanupSession(s,{now:clock+21600000,minimumNewSpent:3});try{ok(await again.ready);deny(await again.send({op:'scriptcleanup-debit',action:'script-verify',now:clock+21600000}));}finally{await again.close();}
});
test('cleanup-only scope cannot send grant, RPC, ordinary debit or old I/C actions',async()=>{
 for(const q of [{op:'debit',operation:operation('P:publisher-bind'),now:clock},{op:'rpc-begin',operation:operation('H:wrapper-compatibility-rpc'),credentialExpiresAt:clock+600000,now:clock},{op:'oldcleanup-debit',kind:'I',action:'remove-reader',now:clock},{op:'scriptcleanup-debit',action:'script-grant',now:clock}]){
  const s=fixture();await stopped(s);const h=cleanupSession(s);try{ok(await h.ready);deny(await h.send(q));assert.equal(JSON.parse(readFileSync(registry(s))).value.checkpoint.spent,1);}finally{await h.close();}
 }
});
test('script verification requires the distinct removal attempt and each purpose remains once-only',async()=>{
 const s=fixture();await stopped(s);let h=cleanupSession(s);try{ok(await h.ready);deny(await h.send({op:'scriptcleanup-debit',action:'script-verify',now:clock}));}finally{await h.close();}
 h=cleanupSession(s);try{ok(await h.ready);ok(await h.send({op:'scriptcleanup-debit',action:'script-remove',now:clock}));ok(await h.send({op:'finish-cleanup'}));}finally{await h.close();}
 h=cleanupSession(s,{minimumNewSpent:2});try{ok(await h.ready);ok(await h.send({op:'scriptcleanup-debit',action:'script-verify',now:clock}));deny(await h.send({op:'scriptcleanup-debit',action:'script-remove',now:clock}));}finally{await h.close();}
});
test('same rolling-minute union remains charged after ordinary journal loss',async()=>{
 const s=fixture();await stopped(s,6);unlinkSync(s.path+'.standalone.json');const h=cleanupSession(s,{minimumNewSpent:6});try{ok(await h.ready);const r=await h.send({op:'scriptcleanup-wait',action:'script-remove',now:clock});ok(r);assert.equal(r.waitMs,51000);deny(await h.send({op:'scriptcleanup-debit',action:'script-remove',now:clock}));}finally{await h.close();}
});
for(const damage of ['corrupt','missing'])test('denied cleanup never repairs '+damage+' ordinary evidence',async()=>{
 const s=fixture();await stopped(s);const path=s.path+'.standalone.json';if(damage==='corrupt')s.put(path,'KEEP_CORRUPT');else unlinkSync(path);
 const h=cleanupSession(s);try{ok(await h.ready);deny(await h.send({op:'scriptcleanup-debit',action:'script-verify',now:clock}));if(damage==='corrupt')assert.equal(readFileSync(path,'utf8'),'KEEP_CORRUPT');else assert.equal(existsSync(path),false);}finally{await h.close();}
});
for(const part of ['registry','claim','owner','high-water','checkpoint-spent'])test('missing or mismatched '+part+' never initializes recovery authority',async()=>{
 const s=fixture();await stopped(s);const patch={};
 if(part==='registry')unlinkSync(registry(s));if(part==='claim')unlinkSync(s.path+'.standalone-claim.json');if(part==='owner')patch.ownerNonce='0'.repeat(64);if(part==='high-water')patch.minimumNewSpent=2;
 if(part==='checkpoint-spent'){const v=JSON.parse(readFileSync(registry(s))).value;v.checkpoint.spent=0;s.put(registry(s),wrapped(v));}
 const h=cleanupSession(s,patch);try{deny(await h.ready);if(part==='registry')assert.equal(existsSync(registry(s)),false);if(part==='claim')assert.equal(existsSync(s.path+'.standalone-claim.json'),false);}finally{await h.close();}
});
test('no ordinary standalone claim means no recovery claim can be created',async()=>{const s=fixture(),h=cleanupSession(s);try{deny(await h.ready);assert.equal(existsSync(s.path+'.standalone-claim.json'),false);}finally{await h.close();}});
for(const collision of ['J.script-remove','J.script-verify'])test('ordinary '+collision+' id cannot poison independent cleanup',async()=>{
 const s=fixture(),ordinary=session(s);try{ok(await ordinary.ready);ok(await ordinary.send({op:'debit',operation:{...operation('P:caller-bind'),id:collision},now:clock}));ok(await ordinary.send({op:'finish',now:clock}));}finally{await ordinary.close();}
 const h=cleanupSession(s,{minimumNewSpent:1,now:clock+60000});try{ok(await h.ready);for(const action of ['script-remove','script-verify'])ok(await h.send({op:'scriptcleanup-debit',action,now:clock+60000}));
  const j=JSON.parse(readFileSync(registry(s))).value.checkpoint;assert.equal(j.spent,3);assert.equal(new Set(j.events.map(e=>e.operation.id)).size,3);
 }finally{await h.close();}
 const next=cleanupSession(s,{minimumNewSpent:3,now:clock+60000});try{ok(await next.ready);}finally{await next.close();}
});
