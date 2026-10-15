import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {fixture,session,operation,research,clock,hash,compact,wrapped} from './fixtures/read-authority/continuation-budget.mjs';
import {BOUNDED_CONTINUATION_POLICY as policy} from '../scripts/read-authority-continuation-plan.mjs';
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r)),denied=r=>assert.equal(r.ok,false,JSON.stringify(r));
const bind=async h=>{ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));ok(await h.send({op:'debit',operation:operation('P:publisher-bind'),now:clock}));};
test('linked W0 preserves original27 bytes, predebits UNKNOWN and retains original lock',async()=>{
 const s=fixture(),raw=readFileSync(s.path),h=session(s);try{
  const ready=await h.ready;ok(ready);assert.equal(ready.spent,27);assert.equal(ready.w0,clock);assert.equal(ready.expiresAt,clock+21600000);
  ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));
  assert.deepEqual(readFileSync(s.path),raw);assert.equal(s.journal().events[0].outcome,'UNKNOWN');assert.equal(s.journal().spent,1);
  const probe=spawnSync('python3',['-c',"import fcntl,sys\nf=open(sys.argv[1],'r+')\ntry:fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);print('FREE')\nexcept BlockingIOError:print('HELD')",s.path+'.lock'],{encoding:'utf8'});assert.equal(probe.stdout.trim(),'HELD');
 }finally{await h.close();}
});
test('only two binding purposes and eight typed readonly research operations before complete map',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);await bind(h);for(let n=1;n<=8;n++)ok(await h.send({op:'debit',operation:research(n),now:clock}));
  denied(await h.send({op:'debit',operation:research(9),now:clock+60000}));assert.equal(s.journal().spent,10);
 }finally{await h.close();}
});
for(const change of ['missing-claim','missing-registry','wrong-source','historical-drift','wrong-baseline'])test('startup denies '+change+' before constructing legacy child or claiming continuation',async()=>{
 const s=fixture();if(change==='missing-claim')unlinkSync(s.path+'.preparation-claim.json');if(change==='missing-registry')unlinkSync(s.registry);
 if(change==='wrong-source')s.cfg.legacyBudget.sha256='f'.repeat(64);if(change==='wrong-baseline')s.cfg.baseline.sha256='f'.repeat(64);
 if(change==='historical-drift'){const v=s.get();v.preparation.events[0].action='P:publisher-bind';s.put(s.path,compact(v));s.put(s.registry,wrapped({path:s.path,binding:s.cfg.original.binding,checkpoint:v}));}
 const h=session(s);try{denied(await h.ready);assert.equal(existsSync(s.path+'.continuation-claim.json'),false);if(change==='missing-claim')assert.equal(existsSync(s.path+'.preparation-claim.json'),false);}finally{await h.close();}
});
for(const change of ['new-owner','rollback-journal','rollback-checkpoint','change-deadline','new-path'])test('unique original-epoch journal denies '+change,async()=>{
 const s=fixture(),h=session(s);const r=await h.ready;ok(r);const raw=readFileSync(s.path+'.continuation.json');ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));await h.close();
 if(change==='new-owner')s.cfg.ownerNonce='f'.repeat(64);
 if(change==='rollback-journal')s.put(s.path+'.continuation.json',raw);
 if(change==='rollback-checkpoint'){const p=join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.continuation.json'),v=JSON.parse(readFileSync(p)).value;v.checkpoint=JSON.parse(raw);s.put(p,wrapped(v));}
 if(change==='change-deadline')s.cfg.expiresAt--;
 if(change==='new-path'){s.cfg.path=join(s.home,'different.json');}
 const next=session(s);try{denied(await next.ready);}finally{await next.close();}
});
test('even retained nonce cannot reopen a finished or lost owner scope',async()=>{
 const s=fixture(),h=session(s);ok(await h.ready);ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));ok(await h.send({op:'finish',now:clock}));await h.close();s.cfg.now=clock+1000;
 const next=session(s);try{denied(await next.ready);assert.equal(s.journal().w0,clock);assert.equal(s.journal().spent,1);}finally{await next.close();}
});
for(const now of [clock+21600000,Date.parse('2026-10-16T16:00:00Z')])test('deadline or Taipei day rejects new operation '+now,async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);denied(await h.send({op:'debit',operation:operation('P:caller-bind'),now}));assert.equal(s.journal().spent,0);}finally{await h.close();}
});
test('new owner-stop vetoes new debits independently of original existing stop',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));
 const child=spawnSync('python3',['scripts/read-authority-continuation-budget.py','--request-stop'],{input:JSON.stringify({path:s.path,epoch:s.cfg.epoch,binding:s.cfg.binding})+'\n',encoding:'utf8',env:{...process.env,HOME:s.home}});assert.equal(child.status,0);ok(JSON.parse(child.stdout));
 denied(await h.send({op:'debit',operation:operation('P:publisher-bind'),now:clock}));assert.equal(existsSync(s.path+'.preparation-stop.json'),true);assert.equal(existsSync(s.path+'.preparation-owner-stop.json'),true);
 }finally{await h.close();}
});
test('original C/I cleanup spends once globally, after new STOP and expiry, preserving cumulative count',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);await bind(h);ok(await h.send({op:'stop',now:clock}));
 for(const [kind,action] of [['C','restore-editor'],['C','read-restored-editor'],['I','close-deployment']])ok(await h.send({op:'oldcleanup-debit',kind,action,now:clock+21600000}));
 assert.equal(s.get().spent,30);assert.equal(s.journal().spent,2);const r=await h.send({op:'inspect'});ok(r);assert.equal(r.spent,32);
 denied(await h.send({op:'oldcleanup-debit',kind:'I',action:'close-deployment',now:clock+21600000}));assert.equal(s.get().spent,30);
 }finally{await h.close();}
});
test('legacy cleanup rate admission includes the new journal timestamps',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);await bind(h);for(let n=1;n<=8;n++)ok(await h.send({op:'debit',operation:research(n),now:clock}));
 const r=await h.send({op:'oldcleanup-wait',kind:'I',action:'close-deployment',now:clock});ok(r);assert.equal(r.waitMs,60000);
 denied(await h.send({op:'oldcleanup-debit',kind:'I',action:'close-deployment',now:clock}));assert.equal(s.get().spent,27);
 }finally{await h.close();}
});
test('Python policy table is exactly the frozen offline operation table',()=>{
 const r=spawnSync('python3',['scripts/read-authority-continuation-budget.py','--policy'],{encoding:'utf8'});assert.equal(r.status,0);assert.deepEqual(JSON.parse(r.stdout),policy.operations);
});
function fullMap(){return Object.entries(policy.operations).map(([key,r])=>{const i=key.indexOf(':');return {id:key.replaceAll(':','.'),bucket:key.slice(0,i),alias:key.slice(i+1),actor:r.actor,target:r.target,operation:r.methods[0],units:1};});}
async function advance(h,op,t=clock){const r=await h.send({op:'wait',operation:op,now:t});ok(r);t+=r.waitMs;ok(await h.send({op:'debit',operation:op,now:t}));return t;}
test('map-ready is exact arithmetic only; sole RPC precharges360000 and requires fixed pre/post closure',async()=>{
 const s=fixture(),h=session(s),map=fullMap();let t=clock;try{ok(await h.ready);await bind(h);ok(await h.send({op:'plan-ready',operations:map,now:t}));
 const H=map.find(v=>v.bucket==='H');denied(await h.send({op:'rpc-begin',operation:H,credentialExpiresAt:clock+3600000,now:t}));assert.equal(s.journal().chargedUpperBoundMs,0);
 }finally{await h.close();}
});
test('all mapped fixed prechecks and same-token identity slots gate one durable RPC and post15 completion',async()=>{
 const s=fixture(),h=session(s),map=fullMap();let t=clock;try{ok(await h.ready);await bind(h);ok(await h.send({op:'plan-ready',operations:map,now:t}));
 for(const name of ['publisher-refresh','publisher-userinfo'])t=await advance(h,map.find(v=>v.bucket==='P'&&v.alias===name),t);
 for(const v of map.filter(v=>['A','B','C','D','E'].includes(v.bucket)&&!['restore-editor','read-restored-editor'].includes(v.alias)))t=await advance(h,v,t);
 for(const action of ['restore-editor','read-restored-editor']){let r=await h.send({op:'oldcleanup-wait',kind:'C',action,now:t});ok(r);t+=r.waitMs;ok(await h.send({op:'oldcleanup-debit',kind:'C',action,now:t}));}
 for(const v of map.filter(v=>(v.bucket==='F'&&v.alias.startsWith('wrapper-before.'))||(v.bucket==='G'&&v.alias.startsWith('wrapper-before.'))))t=await advance(h,v,t);
 const H=map.find(v=>v.bucket==='H');let r=await h.send({op:'rpc-wait',operation:H,credentialExpiresAt:clock+3600000,now:t});ok(r);t+=r.waitMs;
 ok(await h.send({op:'rpc-begin',operation:H,credentialExpiresAt:clock+3600000,now:t}));assert.equal(s.journal().chargedUpperBoundMs,360000);assert.equal(s.journal().events.at(-1).outcome,'UNKNOWN');
 for(const v of map.filter(v=>(v.bucket==='F'&&v.alias.startsWith('wrapper-after.'))||(v.bucket==='G'&&v.alias.startsWith('wrapper-after.'))))t=await advance(h,v,t);
 ok(await h.send({op:'rpc-finish',now:t}));assert.equal(s.journal().rpc.complete,true);assert.equal((await h.send({op:'inspect'})).spent,27+map.filter(v=>!['I','T'].includes(v.bucket)).length);
 denied(await h.send({op:'rpc-begin',operation:H,credentialExpiresAt:clock+3600000,now:t}));assert.equal(s.journal().chargedUpperBoundMs,360000);
 }finally{await h.close();}
});
for(const mutation of ['wrong-actor','aggregated-cost','unmapped-read','credential-before-map','generic-H','research-mutation','duplicate-bind'])test('admission refuses '+mutation+' and does not refund prior debits',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);const op=operation('P:caller-bind');if(mutation==='wrong-actor')op.actor='publisher';if(mutation==='aggregated-cost')op.units=2;if(mutation==='unmapped-read'){op.bucket='A';op.alias='original-project';op.actor='publisher';op.target='original-project';op.operation='GET';}
 if(mutation==='credential-before-map'){Object.assign(op,{alias:'publisher-refresh',actor:'publisher',target:'publisher-oauth',operation:'POST'});}
 if(mutation==='generic-H'){Object.assign(op,{bucket:'H',alias:'wrapper-compatibility-rpc',actor:'caller',target:'thin-project',operation:'POST'});}
 if(mutation==='research-mutation')Object.assign(op,{...research(1),operation:'click'});
 if(mutation==='duplicate-bind')ok(await h.send({op:'debit',operation:op,now:clock}));
 denied(await h.send({op:'debit',operation:op,now:clock}));assert.equal(s.journal().spent,mutation==='duplicate-bind'?1:0);
 }finally{await h.close();}
});
test('new rate union retains old recent calls and returns exact first available slot',async()=>{
 const s=fixture();const b=s.get();b.preparation.calls.splice(-2,2,clock-10000,clock-9000);b.preparation.events[0].time=clock-10000;b.preparation.events[1].time=clock-9000;b.preparation.bindingRepair.beganAt=clock-10000;b.preparation.bindingRepair.debitAt=clock-9000;
 s.put(s.path,compact(b));s.put(s.registry,wrapped({path:s.path,binding:s.cfg.original.binding,checkpoint:b}));s.put(s.cfg.baseline.path,readFileSync(s.path));s.cfg.baseline.sha256=hash(readFileSync(s.path));
 const h=session(s);try{ok(await h.ready);await bind(h);for(let n=1;n<=6;n++)ok(await h.send({op:'debit',operation:research(n),now:clock}));const r=await h.send({op:'wait',operation:research(7),now:clock});ok(r);assert.equal(r.waitMs,50000);}finally{await h.close();}
});
test('I cleanup is an irreversible stop for the new segment as well as original',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);ok(await h.send({op:'oldcleanup-debit',kind:'I',action:'close-deployment',now:clock}));
 assert.equal(existsSync(s.path+'.continuation-stop.json'),true);denied(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));assert.equal(s.journal().spent,0);assert.equal(s.get().spent,28);
 }finally{await h.close();}
});
for(const part of ['journal','checkpoint','claim','old-prefix','old-checkpoint'])test('live '+part+' drift denies a debit before any new charge',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));
 if(part==='journal'){const v=s.journal();v.spent=0;v.events=[];s.put(s.path+'.continuation.json',compact(v));}
 if(part==='checkpoint'){const p=join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.continuation.json'),v=JSON.parse(readFileSync(p)).value;v.checkpoint.spent=0;v.checkpoint.events=[];s.put(p,wrapped(v));}
 if(part==='claim'){const p=s.path+'.continuation-claim.json',v=JSON.parse(readFileSync(p)).value;v.w0--;s.put(p,wrapped(v));}
 if(part==='old-prefix'){const v=s.get();v.preparation.events[0].outcome='SUCCESS';s.put(s.path,compact(v));s.put(s.registry,wrapped({path:s.path,binding:s.cfg.original.binding,checkpoint:v}));}
 if(part==='old-checkpoint'){const v=JSON.parse(readFileSync(s.registry)).value;v.checkpoint.spent=26;s.put(s.registry,wrapped(v));}
 denied(await h.send({op:'debit',operation:operation('P:publisher-bind'),now:clock}));assert.equal(existsSync(s.path+'.continuation-stop.json'),true);
 }finally{await h.close();}
});
for(const offset of [0,-1])test('W0 deadline must be before midnight, offset '+offset,async()=>{
 const s=fixture(),midnight=Date.parse('2026-10-16T16:00:00Z');s.cfg.now=midnight-1000;s.cfg.expiresAt=midnight+offset;
 const h=session(s);try{const r=await h.ready;if(offset===0)denied(r);else{ok(r);assert.equal(r.deadlineUtc,'2026-10-16T15:59:59.999+00:00');assert.equal(r.deadlineTaipei,'2026-10-16T23:59:59.999+08:00');assert.equal(r.w0,midnight-1000);}}finally{await h.close();}
});
test('full reserve of original C2/I17 and two unused units survives all ordinary purposes',async()=>{
 const s=fixture(),h=session(s),map=[...fullMap(),...Array.from({length:24},(_,i)=>({...research(i+1),...(i>=8?{stage:'preparation'}:{})}))];let t=clock;
 try{ok(await h.ready);await bind(h);for(let i=1;i<=8;i++)t=await advance(h,research(i),t);ok(await h.send({op:'plan-ready',operations:map,now:t}));
 for(const name of ['publisher-refresh','publisher-userinfo'])t=await advance(h,map.find(v=>v.bucket==='P'&&v.alias===name),t);
 for(const v of map.filter(v=>(['A','B','C','D','E'].includes(v.bucket)&&!CLEANUP.includes(v.alias))||(v.bucket==='N'&&v.stage==='preparation')))t=await advance(h,v,t);
 for(const action of CLEANUP){let r=await h.send({op:'oldcleanup-wait',kind:'C',action,now:t});ok(r);t+=r.waitMs;ok(await h.send({op:'oldcleanup-debit',kind:'C',action,now:t}));}
 for(const v of map.filter(v=>(v.bucket==='F'&&v.alias.startsWith('wrapper-before.'))||(v.bucket==='G'&&v.alias.startsWith('wrapper-before.'))))t=await advance(h,v,t);
 const H=map.find(v=>v.bucket==='H');let r=await h.send({op:'rpc-wait',operation:H,credentialExpiresAt:clock+3600000,now:t});ok(r);t+=r.waitMs;ok(await h.send({op:'rpc-begin',operation:H,credentialExpiresAt:clock+3600000,now:t}));
 for(const v of map.filter(v=>(v.bucket==='F'&&v.alias.startsWith('wrapper-after.'))||(v.bucket==='G'&&v.alias.startsWith('wrapper-after.'))||v.bucket==='T'))t=await advance(h,v,t);
 const before=(await h.send({op:'inspect'})).spent;assert.equal(before,141);
 for(const v of map.filter(v=>v.bucket==='I')){let r=await h.send({op:'oldcleanup-wait',kind:'I',action:v.alias,now:t});ok(r);t+=r.waitMs;ok(await h.send({op:'oldcleanup-debit',kind:'I',action:v.alias,now:t}));}
 const final=await h.send({op:'inspect'});ok(final);assert.equal(final.spent,158);assert.equal(final.cleanup.iActions.length,17);assert.equal(final.cleanup.cActions.length,2);
 }finally{await h.close();}
});
const CLEANUP=['restore-editor','read-restored-editor'];
test('checkpoint-first torn initial journal write consumes the segment and cannot be reseeded',async()=>{
 const s=fixture(),bootstrap="import os,sys,runpy\nsys.argv=sys.argv[1:]\nreal=os.replace\ndef torn(a,b):\n if str(b).endswith('budget.json.continuation.json'):raise OSError('SYNTHETIC_TORN_JOURNAL')\n return real(a,b)\nos.replace=torn\nrunpy.run_path(sys.argv[0],run_name='__main__')";
 const h=session(s,s.cfg,bootstrap);try{denied(await h.ready);}finally{await h.close();}
 assert.equal(existsSync(s.path+'.continuation-claim.json'),true);assert.equal(existsSync(s.path+'.continuation.json'),false);
 const checkpoint=JSON.parse(readFileSync(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.continuation.json'))).value.checkpoint;assert.equal(checkpoint.w0,clock);assert.equal(checkpoint.spent,0);
 const next=session(s);try{denied(await next.ready);}finally{await next.close();}
});
test('live typed source drift denies new ordinary and old cleanup admissions',async()=>{
 const s=fixture(),copied=join(s.home,'legacy-budget.py');s.put(copied,readFileSync(s.cfg.legacyBudget.path));s.cfg.legacyBudget.path=copied;
 const h=session(s);try{ok(await h.ready);s.put(copied,readFileSync(copied,'utf8')+'\n# SYNTHETIC_DRIFT\n');
 denied(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));denied(await h.send({op:'oldcleanup-debit',kind:'I',action:'close-deployment',now:clock}));assert.equal(s.journal().spent,0);assert.equal(s.get().spent,27);
 }finally{await h.close();}
});
test('SIGKILL loses ordinary admission forever while the original parent descriptor retains ownership',async()=>{
 const s=fixture(),h=session(s);ok(await h.ready);ok(await h.send({op:'debit',operation:operation('P:caller-bind'),now:clock}));
 h.child.kill('SIGKILL');await new Promise(r=>h.child.once('close',r));
 const peer=session(s);try{denied(await peer.ready);assert.equal(s.journal().events[0].outcome,'UNKNOWN');assert.equal(s.journal().spent,1);}finally{await peer.close();await h.close();}
 const after=session(s);try{denied(await after.ready);}finally{await after.close();}
});
test('constructor torn-write failure terminates and reaps the original ledger child before process exit',async()=>{
 const s=fixture(),result=join(s.home,'constructor-child-exit.json'),bootstrap=`import atexit,json,os,sys,runpy,subprocess
sys.argv=sys.argv[1:]
spawn=subprocess.Popen
children=[]
def observed(*a,**k):
 p=spawn(*a,**k);children.append(p);return p
subprocess.Popen=observed
replace=os.replace
def torn(a,b):
 if str(b).endswith('budget.json.continuation.json'):raise OSError('SYNTHETIC_TORN_JOURNAL')
 return replace(a,b)
os.replace=torn
@atexit.register
def report():
 with open(${JSON.stringify(result)},'w') as f:json.dump([p.poll() for p in children],f)
runpy.run_path(sys.argv[0],run_name='__main__')`;
 const h=session(s,s.cfg,bootstrap);try{denied(await h.ready);}finally{await h.close();}
 const exits=JSON.parse(readFileSync(result));assert.equal(exits.length,1);assert.notEqual(exits[0],null);
 const probe=spawnSync('python3',['-c',"import fcntl,sys\nf=open(sys.argv[1],'r+')\nfcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)\nprint('FREE')",s.path+'.lock'],{encoding:'utf8'});assert.equal(probe.status,0);assert.equal(probe.stdout.trim(),'FREE');
});
test('ambiguous new stop marker remains a veto while original C/I cleanup stays available',async()=>{
 const s=fixture(),h=session(s);try{ok(await h.ready);s.put(s.path+'.continuation-stop.json','');
 for(const [kind,action] of [['C','restore-editor'],['I','close-deployment']])ok(await h.send({op:'oldcleanup-debit',kind,action,now:clock}));
 assert.equal(readFileSync(s.path+'.continuation-stop.json','utf8'),'');assert.equal(s.get().spent,29);assert.equal((await h.send({op:'inspect'})).state,'stopped');
 }finally{await h.close();}
});
test('original baseline raw bytes cannot be reencoded under an unchanged semantic checkpoint',async()=>{
 const s=fixture();s.put(s.path,JSON.stringify(s.get(),null,2));const h=session(s);try{denied(await h.ready);assert.equal(existsSync(s.path+'.continuation-claim.json'),false);}finally{await h.close();}
});
