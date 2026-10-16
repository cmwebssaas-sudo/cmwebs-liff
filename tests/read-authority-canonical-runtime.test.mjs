import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createAuthorityPreparationControl} from '../scripts/read-authority-preparation-control.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-14T00:00:00Z'),binding='c'.repeat(64),executionHash='d'.repeat(64);
function setup(spent=25){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-canonical-runtime-'));chmodSync(dir,0o700);const path=join(dir,'budget.json');let now=clock;
 const raw=JSON.stringify({limit:160,spent,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40});writeFileSync(path,raw,{mode:0o600});
 const pauses=[],options={path,epoch:'SYNTHETIC_CANONICAL_'+randomUUID(),approvalHash:'a'.repeat(64),proposalHash:'b'.repeat(64),legacySha256:hash(raw),importedReads:spent,expiresAt:clock+21600000,now:()=>now,pause:async ms=>{pauses.push(ms);now+=ms;}};
 const control=createAuthorityPreparationControl(options);
 return {control,options,pauses,get:()=>JSON.parse(readFileSync(path)),now:()=>now,setNow:v=>{now=v;},descriptor:(entry='wrapper',nativeMs=0)=>({entry,nativeMs,observedAt:now,credentialExpiresAt:clock+3600000})};
}
async function prepare(s,extra=0){await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});for(let i=0;i<extra;i++)await cap.externalRead(async()=>{});await cap.handoff({runtimeBinding:binding,expectedSpent:s.get().spent});});}
const runtime=(s,fn)=>s.control.withRuntime(binding,fn);
async function completed(s,cap,entry='wrapper',nativeMs=0,totalMs=100,execHash=executionHash){
 const result=await cap.dispatchCompatibility(s.descriptor(entry,nativeMs),async startedAt=>({private:'SYNTHETIC_RESPONSE_NEVER_PERSIST',startedAt}));
 await cap.accountNative({entry,totalMs,executionHash:execHash});await cap.finishCompatibility(entry);return result;
}
test('canonical runtime introspection has no new budget or RPC state before admission',async()=>{
 const s=setup();await prepare(s);await runtime(s,async cap=>{
  assert.equal(typeof cap.dispatchCompatibility,'function');const state=await cap.inspectRuntime();assert(Object.isFrozen(state));assert(Object.isFrozen(state.rpcEntries));
  assert.equal(state.source,'canonical-preparation-ledger');assert.equal(state.runtimeBinding,binding);assert.equal(state.spent,27);assert.equal(state.nativeMs,0);assert.equal(state.pending,null);assert.equal(state.lastExecutionHash,null);assert.deepEqual(state.rpcEntries,[]);
 });assert.equal(s.get().preparation.version,2);
});
test('RPC debit and UNKNOWN intent precede callback; native accounting and completion persist in the same counter',async()=>{
 const s=setup();await prepare(s);let calls=0;
 await runtime(s,async cap=>{
  const reply=await cap.dispatchCompatibility(s.descriptor(),async startedAt=>{
   calls++;const state=await cap.inspectRuntime();assert.equal(state.spent,28);assert.equal(state.pending.entry,'wrapper');assert.equal(state.pending.startedAt,startedAt);assert.deepEqual(state.rpcEntries,['wrapper']);assert.equal(s.get().preparation.events.at(-1).kind,'R');
   return {private:'SYNTHETIC_RESPONSE_NEVER_PERSIST'};
  });assert(Object.isFrozen(reply));assert.equal(reply.startedAt,s.now());
  await cap.accountNative({entry:'wrapper',totalMs:100,executionHash});assert((await cap.inspectRuntime()).pending);
  await cap.finishCompatibility('wrapper');const state=await cap.inspectRuntime();assert.equal(state.pending,null);assert.equal(state.nativeMs,100);assert.equal(state.lastExecutionHash,executionHash);
 });assert.equal(calls,1);assert.equal(s.get().spent,28);assert.equal(s.get().preparation.version,3);assert(!readFileSync(s.options.path,'utf8').includes('SYNTHETIC_RESPONSE'));
});
test('wrapper then qualified each run once; a third attempt cannot spend or replay',async()=>{
 const s=setup();await prepare(s);let calls=0;
 await runtime(s,async cap=>{await completed(s,cap);calls++;await completed(s,cap,'qualified',100,200,'e'.repeat(64));calls++;});
 await assert.rejects(runtime(s,cap=>cap.dispatchCompatibility(s.descriptor(),async()=>{calls++;})),/TRIAL_STOPPED/);
 assert.equal(calls,2);assert.equal(s.get().spent,29);await runtime(s,async cap=>{const state=await cap.inspectRuntime();assert.deepEqual(state.rpcEntries,['wrapper','qualified']);assert.equal(state.nativeMs,200);assert.equal(state.pending,null);});
});
test('qualified cannot precede the wrapper completion',async()=>{
 const s=setup();await prepare(s);let io=0;await assert.rejects(runtime(s,cap=>cap.dispatchCompatibility(s.descriptor('qualified'),async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,27);
});
for(const [name,patch] of [['authority',{entry:'authority'}],['private-entry',{entry:'private'}],['extra-fields',{units:2}],['negative-runtime',{nativeMs:-1}],['fraction-runtime',{nativeMs:0.5}],['over-six-minute-reserve',{nativeMs:540001}],['stale-proof',{observedAt:clock-1}],['future-proof',{observedAt:clock+61002}],['expired-token',{credentialExpiresAt:clock+420000}],['over-epoch-token',{credentialExpiresAt:clock+21600001}]])test('RPC descriptor rejects '+name+' before admission',async()=>{
 const s=setup();await prepare(s);let io=0;await assert.rejects(runtime(s,cap=>cap.dispatchCompatibility({...s.descriptor(),...patch},async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,27);assert.equal(s.get().preparation.version,2);
});
test('RPC rolling wait rechecks proof freshness before debit, preserving the once slot',async()=>{
 const s=setup();await prepare(s,8);s.setNow(s.now()+1);let io=0;
 await assert.rejects(runtime(s,cap=>cap.dispatchCompatibility({...s.descriptor(),observedAt:s.now()-2},async()=>{io++;})),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(s.get().spent,35);assert.equal(s.get().preparation.runtime,undefined);assert.deepEqual(s.pauses,[60000,59999]);
});
test('unknown transport retains pending and debit through restart and independent cleanup',async()=>{
 const s=setup();await prepare(s);let io=0;
 await assert.rejects(runtime(s,cap=>cap.dispatchCompatibility(s.descriptor(),async()=>{io++;throw Error('SYNTHETIC_PRIVATE_TRANSPORT');})),/TRIAL_STOPPED/);
 const pending=s.get().preparation.runtime.pending;s.setNow(clock+21600001);await runtime(s,cap=>cap.cleanup('close-deployment',async()=>{io++;}));
 await assert.rejects(runtime(s,cap=>cap.dispatchCompatibility(s.descriptor('qualified'),async()=>{io++;})),/TRIAL_STOPPED/);
 assert.equal(io,2);assert.equal(s.get().spent,29);assert.deepEqual(s.get().preparation.runtime.pending,pending);assert(!readFileSync(s.options.path,'utf8').includes('PRIVATE_TRANSPORT'));
});
test('a pending RPC denies ordinary work while paid settlement reads and native accounting remain available',async()=>{
 const s=setup();await prepare(s);let ordinary=0,settlement=0;
 await assert.rejects(runtime(s,async cap=>{
  await cap.dispatchCompatibility(s.descriptor(),async()=>({compatible:true}));
  await assert.rejects(cap.externalRead(async()=>{ordinary++;}),/TRIAL_STOPPED/);
  await cap.settlementRead(async()=>{settlement++;assert.equal(s.get().spent,29);});
  await cap.accountNative({entry:'wrapper',totalMs:100,executionHash});await assert.rejects(cap.finishCompatibility('wrapper'),/TRIAL_STOPPED/);
 }),/TRIAL_STOPPED/);
 assert.equal(ordinary,0);assert.equal(settlement,1);assert.equal(s.get().spent,29);assert(s.get().preparation.runtime.pending);assert.equal(s.get().preparation.runtime.nativeMs,100);
});
test('settlement cannot create a new execution or consume budget without pending RPC',async()=>{
 const s=setup();await prepare(s);let io=0;await assert.rejects(runtime(s,cap=>cap.settlementRead(async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,27);
});
test('native accounting and finish reject missing, wrong or unaccounted execution without clearing pending',async()=>{
 for(const operation of ['missing','wrong','unaccounted']){
  const s=setup();await prepare(s);await assert.rejects(runtime(s,async cap=>{
   if(operation!=='missing')await cap.dispatchCompatibility(s.descriptor(),async()=>({compatible:true}));
   if(operation==='unaccounted')await cap.finishCompatibility('wrapper');else await cap.accountNative({entry:operation==='wrong'?'qualified':'wrapper',totalMs:100,executionHash});
  }),/TRIAL_STOPPED/);assert.equal(s.get().spent,operation==='missing'?27:28);if(operation!=='missing')assert(s.get().preparation.runtime.pending);
 }
});
test('completion eligibility cannot survive scope return or an unknown callback',async()=>{
 const s=setup();await prepare(s);await runtime(s,async cap=>{await cap.dispatchCompatibility(s.descriptor(),async()=>({compatible:true}));await cap.accountNative({entry:'wrapper',totalMs:100,executionHash});});
 await assert.rejects(runtime(s,cap=>cap.finishCompatibility('wrapper')),/TRIAL_STOPPED/);assert(s.get().preparation.runtime.pending);assert.equal(s.get().spent,28);
});
test('duplicate native accounting cannot replay an execution hash',async()=>{
 const s=setup();await prepare(s);await runtime(s,cap=>completed(s,cap));await assert.rejects(runtime(s,async cap=>{
  await cap.dispatchCompatibility(s.descriptor('qualified',100),async()=>({compatible:true}));await cap.accountNative({entry:'qualified',totalMs:200,executionHash});
 }),/TRIAL_STOPPED/);assert.equal(s.get().spent,29);assert.equal(s.get().preparation.runtime.nativeMs,100);assert.equal(s.get().preparation.runtime.pending.entry,'qualified');
});
test('native total cannot regress or exceed the original daily bound',async()=>{
 for(const totalMs of [-1,900001]){
  const s=setup();await prepare(s);await assert.rejects(runtime(s,async cap=>{await cap.dispatchCompatibility(s.descriptor(),async()=>({compatible:true}));await cap.accountNative({entry:'wrapper',totalMs,executionHash});}),/TRIAL_STOPPED/);
  assert.equal(s.get().spent,28);assert.equal(s.get().preparation.runtime.nativeMs,0);assert(s.get().preparation.runtime.pending);
 }
});
test('RPC cannot spend any independent I reserve at the canonical ceiling',async()=>{
 const s=setup(141);await prepare(s);let io=0;await assert.rejects(runtime(s,cap=>cap.dispatchCompatibility(s.descriptor(),async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,143);
 await runtime(s,cap=>cap.cleanup('close-deployment',async()=>{io++;}));assert.equal(io,1);assert.equal(s.get().spent,144);
});
test('permanent stop requested outside busy flock vetoes new RPC, retaining entered IO and native settlement',async()=>{
 const s=setup();await prepare(s);const peer=createAuthorityPreparationControl(s.options);assert.equal(typeof peer.requestStop,'function');let enter,release,io=0;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 const running=runtime(s,async cap=>{
  await cap.dispatchCompatibility(s.descriptor(),async()=>{io++;enter();await gate;return {compatible:true};});
  await cap.settlementRead(async()=>{assert.equal(s.get().spent,29);});await cap.accountNative({entry:'wrapper',totalMs:100,executionHash});await cap.finishCompatibility('wrapper');
 });void running.catch(()=>{});await entered;
 try{assert.deepEqual(await peer.requestStop(),{stopRequested:true});await assert.rejects(peer.withRuntime(binding,cap=>cap.cleanup('close-deployment',async()=>{io++;})),/TRIAL_STOPPED/);}finally{release();await assert.rejects(running,/TRIAL_STOPPED/);}
 assert.equal(io,1);assert.equal(s.get().spent,29);assert.equal(s.get().preparation.runtime.nativeMs,100);assert(s.get().preparation.runtime.pending);
 await peer.withRuntime(binding,cap=>cap.cleanup('close-deployment',async()=>{io++;}));assert.equal(io,2);assert.equal(s.get().spent,30);
});
test('runtime APIs expire with the scope and never admit escaped work',async()=>{
 const s=setup();await prepare(s);let saved;await runtime(s,async cap=>{saved=cap;});let io=0;
 for(const method of [()=>saved.inspectRuntime(),()=>saved.dispatchCompatibility(s.descriptor(),async()=>{io++;}),()=>saved.settlementRead(async()=>{io++;}),()=>saved.accountNative({entry:'wrapper',totalMs:100,executionHash}),()=>saved.finishCompatibility('wrapper')])await assert.rejects(method(),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(s.get().spent,27);
});
test('pre-RPC snapshot rollback cannot erase an admitted entry or seed another epoch',async()=>{
 const s=setup();await prepare(s);const before=readFileSync(s.options.path);await runtime(s,cap=>completed(s,cap));writeFileSync(s.options.path,before,{mode:0o600});let io=0;
 await assert.rejects(runtime(s,async()=>{io++;}),/TRIAL_STOPPED/);assert.equal(io,0);
});

test('stop intent vetoes preparation handoff before phase mutation while preserving cleanup',async()=>{
 const s=setup();await assert.rejects(s.control.withPreparation(async cap=>{
  await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});
  await s.control.requestStop();await cap.handoff({runtimeBinding:binding,expectedSpent:27});
 }),/TRIAL_STOPPED/);
 assert.equal(s.get().spent,27);assert.equal(s.get().preparation.version,1);assert.equal(s.get().preparation.handoff,undefined);
 await s.control.withPreparation(cap=>cap.cleanup('read-original-project',async()=>{}));assert.equal(s.get().spent,28);
});

function interruptedStop(s,partial){
 const cfg=JSON.parse(readFileSync(s.options.path+'.preparation-claim.json')).value;
 const script=`from pathlib import Path
import sys,json
source=Path(sys.argv[1]).read_text().split('ledger=None\\ntry:')[0]
ns={};exec(source,ns)
original=ns['os'].fdopen
class Broken:
 def __init__(self,fd):self.f=original(fd,'wb')
 def __enter__(self):return self
 def __exit__(self,*args):self.f.close()
 def write(self,data):
  self.f.write(data[:7] if sys.argv[2]=='partial' else b'');self.f.flush();ns['os'].fsync(self.f.fileno());raise OSError('SYNTHETIC_INTERRUPTED_STOP')
ns['os'].fdopen=lambda fd,mode:Broken(fd)
try:ns['request_stop'](json.loads(sys.stdin.read()))
except OSError:sys.exit(17)
sys.exit(1)`;
 const result=spawnSync('python3',['-c',script,new URL('../scripts/read-authority-preparation-budget.py',import.meta.url).pathname,partial?'partial':'empty'],{input:JSON.stringify(cfg),encoding:'utf8',env:{PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'C',TZ:'Asia/Taipei'}});
 assert.equal(result.status,17);return readFileSync(s.options.path+'.preparation-stop.json');
}
for(const partial of [false,true])test('interrupted stop '+(partial?'partial':'empty')+' permanently vetoes ordinary work but preserves once-only C/I cleanup',async()=>{
 const s=setup();await s.control.withPreparation(async()=>{});const marker=interruptedStop(s,partial);let ordinary=0,cleanup=0;
 await assert.rejects(s.control.withPreparation(cap=>cap.externalRead(async()=>{ordinary++;})),/TRIAL_STOPPED/);
 await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{cleanup++;});await cap.restoreOriginalEditor('read-restored-editor',async()=>{cleanup++;});await cap.cleanup('close-deployment',async()=>{cleanup++;});});
 assert.equal(ordinary,0);assert.equal(cleanup,3);assert.equal(s.get().spent,28);assert.equal(s.get().preparation.state,'stopped');assert.deepEqual(readFileSync(s.options.path+'.preparation-stop.json'),marker);
 await assert.rejects(s.control.requestStop(),/TRIAL_STOPPED/);await assert.rejects(s.control.withPreparation(cap=>cap.cleanup('close-deployment',async()=>{cleanup++;})),/TRIAL_STOPPED/);
 assert.equal(cleanup,3);assert.equal(s.get().spent,28);assert.deepEqual(readFileSync(s.options.path+'.preparation-stop.json'),marker);
});
test('partial stop preserves pending execution, paid settlement and native accounting without allowing completion or replay',async()=>{
 const s=setup();await prepare(s);await runtime(s,cap=>cap.dispatchCompatibility(s.descriptor(),async()=>({compatible:true})));
 const marker=interruptedStop(s,true),pending=s.get().preparation.runtime.pending;let reads=0,rpcs=0;
 await runtime(s,async cap=>{await cap.settlementRead(async()=>{reads++;});await cap.accountNative({entry:'wrapper',totalMs:100,executionHash});await cap.cleanup('close-deployment',async()=>{reads++;});});
 await assert.rejects(runtime(s,cap=>cap.dispatchCompatibility(s.descriptor('qualified',100),async()=>{rpcs++;})),/TRIAL_STOPPED/);
 assert.equal(reads,2);assert.equal(rpcs,0);assert.equal(s.get().spent,30);assert.equal(s.get().preparation.runtime.nativeMs,100);assert.deepEqual(s.get().preparation.runtime.pending,pending);assert.deepEqual(readFileSync(s.options.path+'.preparation-stop.json'),marker);
});
test('malformed stop is only a negative veto and cannot authorize cleanup against a rolled-back canonical checkpoint',async()=>{
 const s=setup();await s.control.withPreparation(async()=>{});const before=readFileSync(s.options.path);
 await s.control.withPreparation(cap=>cap.externalRead(async()=>{}));interruptedStop(s,true);writeFileSync(s.options.path,before,{mode:0o600});let cleanup=0;
 await assert.rejects(s.control.withPreparation(cap=>cap.cleanup('close-deployment',async()=>{cleanup++;})),/TRIAL_STOPPED/);assert.equal(cleanup,0);
});
