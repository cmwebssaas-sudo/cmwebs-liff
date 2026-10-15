import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {fixture,session,clock,hash,compact,wrapped} from './fixtures/read-authority/standalone-budget.mjs';
import {operation,research} from './fixtures/read-authority/continuation-budget.mjs';
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r)),denied=r=>assert.equal(r.ok,false,JSON.stringify(r));
const originalPolicy=JSON.parse(spawnSync('python3',['scripts/read-authority-continuation-budget.py','--policy'],{encoding:'utf8'}).stdout);
const standalonePolicy=Object.fromEntries(Object.entries(originalPolicy).filter(([k])=>!k.startsWith('C:')).map(([k,v])=>[k,k.endsWith('.library-content')?{...v,target:'thin-project'}:v]));
const map=()=>Object.entries(standalonePolicy).map(([k,r])=>{const i=k.indexOf(':');return{id:k.replaceAll(':','.'),bucket:k.slice(0,i),alias:k.slice(i+1),actor:r.actor,target:r.target,operation:r.methods[0],units:1};});
async function advance(h,operation,now){let r=await h.send({op:'wait',operation,now});ok(r);now+=r.waitMs;ok(await h.send({op:'debit',operation,now}));return now;}
test('standalone policy removes every editor/library mutation and retains fixed98',()=>{
 const r=spawnSync('python3',['scripts/read-authority-continuation-budget.py','--standalone-policy'],{encoding:'utf8'});assert.equal(r.status,0);assert.deepEqual(JSON.parse(r.stdout),standalonePolicy);assert.equal(Object.keys(standalonePolicy).length,98);
});
test('standalone W0 imports immutable27+stopped1+diagnosis3 without reopening old claim',async()=>{
 const s=fixture(),raw=readFileSync(s.path),prior=readFileSync(s.cfg.history.continuation.path),h=session(s);try{const r=await h.ready;ok(r);assert.equal(r.spent,31);assert.equal(r.newSpent,0);ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));assert.equal((await h.send({op:'inspect'})).spent,32);assert.deepEqual(readFileSync(s.path),raw);assert.deepEqual(readFileSync(s.cfg.history.continuation.path),prior);assert.equal(s.journal().events[0].outcome,'UNKNOWN');assert.deepEqual(s.journal().history,s.cfg.history);}finally{await h.close();}
});
for(const field of ['continuation','diagnosisApproval','diagnosisResult','diagnosisStop','ownerApproval'])test('changed pinned '+field+' denies startup before singleton creation',async()=>{
 const s=fixture();s.put(s.cfg.history[field].path,readFileSync(s.cfg.history[field].path,'utf8')+' ');const h=session(s);try{denied(await h.ready);assert.equal(existsSync(s.path+'.standalone-claim.json'),false);}finally{await h.close();}
});
for(const change of ['continuation-refund','continuation-rpc','continuation-success','continuation-registry','continuation-claim','diagnosis-refund','diagnosis-charge-success','diagnosis-charge-time','diagnosis-approval-sha','owner-answer','owner-import','owner-oldsha','wrong-path'])test('semantic '+change+' cannot bless a new pinned history',async()=>{
 const s=fixture();let key;
 if(change.startsWith('continuation-')&&!['continuation-registry','continuation-claim'].includes(change)){key='continuation';const v=JSON.parse(readFileSync(s.cfg.history[key].path));if(change==='continuation-refund')v.spent=0;if(change==='continuation-rpc')v.rpc.beganAt=clock-9000;if(change==='continuation-success')v.events[0].outcome='SUCCESS';s.put(s.cfg.history[key].path,compact(v));}
 if(change==='continuation-registry')unlinkSync(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.continuation.json'));
 if(change==='continuation-claim')unlinkSync(s.path+'.continuation-claim.json');
 if(change==='diagnosis-refund'){key='diagnosisResult';const v=JSON.parse(readFileSync(s.cfg.history[key].path));v.cumulativeSpent=30;s.put(s.cfg.history[key].path,compact(v));}
 if(change.startsWith('diagnosis-charge')){const p=s.cfg.history.diagnosisCharges[1],v=JSON.parse(readFileSync(p.path));if(change.endsWith('success'))v.outcome='SUCCESS';else v.time=clock-20000;s.put(p.path,compact(v));p.sha256=hash(readFileSync(p.path));}
 if(change==='diagnosis-approval-sha'){key='diagnosisApproval';const v=JSON.parse(readFileSync(s.cfg.history[key].path));v.originalSha256='f'.repeat(64);s.put(s.cfg.history[key].path,compact(v));}
 if(change.startsWith('owner-')){key='ownerApproval';const v=JSON.parse(readFileSync(s.cfg.history[key].path));if(change==='owner-answer')v.ownerAnswer='同意';if(change==='owner-import')v.importedSpent=28;if(change==='owner-oldsha')v.continuationSha256='f'.repeat(64);s.put(s.cfg.history[key].path,compact(v));}
 if(key==='continuation'){
  const j=JSON.parse(readFileSync(s.cfg.history.continuation.path));s.put(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.continuation.json'),wrapped({identity:JSON.parse(readFileSync(s.path+'.continuation-claim.json')).value,checkpoint:j}));s.repin('continuation');
  for(const name of ['diagnosisApproval','ownerApproval']){const pin=s.cfg.history[name],v=JSON.parse(readFileSync(pin.path));v[name==='diagnosisApproval'?'linkedSha256':'continuationSha256']=s.cfg.history.continuation.sha256;s.put(pin.path,compact(v));s.repin(name);}
 }
 if(key)s.repin(key);if(change==='wrong-path')s.cfg.history.diagnosisResult.path=s.cfg.history.diagnosisStop.path;
 const h=session(s);try{denied(await h.ready);assert.equal(existsSync(s.path+'.standalone-claim.json'),false);}finally{await h.close();}
});
test('each history is reverified live before ordinary or original cleanup debit',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));s.put(s.cfg.history.diagnosisCharges[0].path,readFileSync(s.cfg.history.diagnosisCharges[0].path,'utf8')+' ');denied(await h.send({op:'debit',operation:operation('P:publisher-bind'),now:clock}));denied(await h.send({op:'oldcleanup-debit',kind:'I',action:'close-deployment',now:clock}));assert.equal(s.get().spent,27);assert.equal(s.journal().spent,1);}finally{await h.close();}
});
test('standalone rate union retains continuation and all diagnosis charges',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));ok(await h.send({op:'debit',operation:operation('P:publisher-bind'),now:clock}));for(let n=1;n<=4;n++)ok(await h.send({op:'debit',operation:research(n),now:clock}));const r=await h.send({op:'wait',operation:research(5),now:clock});ok(r);assert.equal(r.waitMs,51000);const c=await h.send({op:'oldcleanup-wait',kind:'I',action:'close-deployment',now:clock});ok(c);assert.equal(c.waitMs,51000);}finally{await h.close();}
});
test('standalone owner stop and EOF consume the only new epoch claim',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);const r=spawnSync('python3',['scripts/read-authority-continuation-budget.py','--standalone-request-stop'],{input:JSON.stringify({path:s.path,epoch:s.cfg.epoch,binding:s.cfg.binding})+'\n',encoding:'utf8',env:{...process.env,HOME:s.home}});assert.equal(r.status,0);denied(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));}finally{await h.close();}const next=session(s);try{denied(await next.ready);assert.equal(s.journal().spent,0);}finally{await next.close();}
});
test('single standalone RPC requires all mapped prechecks but no original C mutation, reserves cleanup and never refunds',async()=>{
 const s=fixture(),h=session(s),operations=[...map(),...Array.from({length:24},(_,i)=>({...research(i+1),...(i>=8?{stage:'preparation'}:{})}))];let t=clock;
 try{ok(await h.ready);t=await advance(h,operation('P:caller-bind'),t);t=await advance(h,operation('P:publisher-bind'),t);ok(await h.send({op:'plan-ready',operations,now:t}));for(const alias of ['publisher-refresh','publisher-userinfo'])t=await advance(h,operations.find(v=>v.bucket==='P'&&v.alias===alias),t);
 for(const v of operations.filter(v=>['A','B','D','E','N'].includes(v.bucket)||(v.bucket==='F'&&v.alias.startsWith('wrapper-before.'))||(v.bucket==='G'&&v.alias.startsWith('wrapper-before.'))))t=await advance(h,v,t);
 const H=operations.find(v=>v.bucket==='H');let r=await h.send({op:'rpc-wait',operation:H,credentialExpiresAt:clock+3600000,now:t});ok(r);t+=r.waitMs;ok(await h.send({op:'rpc-begin',operation:H,credentialExpiresAt:clock+3600000,now:t}));assert.deepEqual(s.get().preparation.cActions,[]);assert.equal(s.journal().chargedUpperBoundMs,360000);
 for(const v of operations.filter(v=>(v.bucket==='F'&&v.alias.startsWith('wrapper-after.'))||(v.bucket==='G'&&v.alias.startsWith('wrapper-after.'))||v.bucket==='T'))t=await advance(h,v,t);ok(await h.send({op:'rpc-finish',now:t}));
 for(const [kind,actions] of [['C',['restore-editor','read-restored-editor']],['I',operations.filter(v=>v.bucket==='I').map(v=>v.alias)]])for(const action of actions){const q=await h.send({op:'oldcleanup-wait',kind,action,now:t});ok(q);t+=q.waitMs;ok(await h.send({op:'oldcleanup-debit',kind,action,now:t}));}
 const final=await h.send({op:'inspect'});ok(final);assert.equal(final.spent,155);assert.equal(final.cleanup.iActions.length,17);assert.equal(final.cleanup.cActions.length,2);denied(await h.send({op:'rpc-begin',operation:H,credentialExpiresAt:clock+3600000,now:t}));assert.equal(s.journal().chargedUpperBoundMs,360000);
 }finally{await h.close();}
});
for(const part of ['owner-rpc-boolean','diagnosis-action-boolean'])test('pinned integer history counters reject '+part,async()=>{
 const s=fixture(),pin=part.startsWith('owner')?s.cfg.history.ownerApproval:s.cfg.history.diagnosisCharges[0],v=JSON.parse(readFileSync(pin.path));if(part.startsWith('owner'))v.rpcLimit=true;else v.action=true;s.put(pin.path,compact(v));pin.sha256=hash(readFileSync(pin.path));const h=session(s);try{denied(await h.ready);assert.equal(existsSync(s.path+'.standalone-claim.json'),false);}finally{await h.close();}
});
for(const end of ['finish','eof','killed','deleted-journal','deleted-claim'])test('standalone unique original epoch survives '+end,async()=>{
 const s=fixture(),h=session(s);ok(await h.ready);ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));if(end==='finish')ok(await h.send({op:'finish',now:clock}));if(end==='killed'){h.child.kill('SIGKILL');await new Promise(r=>h.child.once('close',r));}await h.close();if(end==='deleted-journal')unlinkSync(s.path+'.standalone.json');if(end==='deleted-claim')unlinkSync(s.path+'.standalone-claim.json');const next=session(s);try{denied(await next.ready);const reg=JSON.parse(readFileSync(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.standalone.json'))).value;assert.equal(reg.checkpoint.spent,1);assert.equal(reg.checkpoint.events[0].outcome,'UNKNOWN');}finally{await next.close();}
});
for(const change of ['past-deadline','cross-day','missing-history','wrong-source','missing-charge','wrong-charge-pin'])test('standalone preclaim denies '+change,async()=>{
 const s=fixture();if(change==='past-deadline')s.cfg.expiresAt=s.cfg.now;if(change==='cross-day')s.cfg.expiresAt=Date.parse('2026-10-16T16:00:00Z');if(change==='missing-history')delete s.cfg.history;if(change==='wrong-source')s.cfg.policySource.sha256='f'.repeat(64);if(change==='missing-charge')s.cfg.history.diagnosisCharges.pop();if(change==='wrong-charge-pin')s.cfg.history.diagnosisCharges[0].sha256='f'.repeat(64);const h=session(s);try{denied(await h.ready);assert.equal(existsSync(s.path+'.standalone-claim.json'),false);}finally{await h.close();}
});
test('standalone cleanup retains original C/I uniqueness and imported31 after expiry',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);ok(await h.send({op:'stop',now:clock}));for(const [kind,action] of [['C','restore-editor'],['I','close-deployment']])ok(await h.send({op:'oldcleanup-debit',kind,action,now:clock+21600000}));assert.equal(s.get().spent,29);assert.equal((await h.send({op:'inspect'})).spent,33);denied(await h.send({op:'oldcleanup-debit',kind:'I',action:'close-deployment',now:clock+21600000}));assert.equal(s.get().spent,29);assert.equal(s.journal().spent,0);}finally{await h.close();}
});

for(const fault of ['old-C-mutation','old-library-target','missing-postcheck'])test('standalone map denies '+fault,async()=>{
 const s=fixture(),h=session(s),operations=map();if(fault==='old-C-mutation'){const r=originalPolicy['C:library-source-put'];operations.push({id:'forbidden-C',bucket:'C',alias:'library-source-put',actor:r.actor,target:r.target,operation:r.methods[0],units:1});}if(fault==='old-library-target')operations.find(v=>v.alias==='wrapper-before.library-content').target='original-project';if(fault==='missing-postcheck')operations.splice(operations.findIndex(v=>v.alias==='wrapper-after.original-project'),1);try{ok(await h.ready);denied(await h.send({op:'plan-ready',operations,now:clock}));assert.equal(s.journal().plan,null);assert.equal(s.journal().spent,0);}finally{await h.close();}
});
