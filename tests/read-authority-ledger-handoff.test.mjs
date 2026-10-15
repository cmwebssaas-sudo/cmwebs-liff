import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,readFileSync,writeFileSync,existsSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {createAuthorityPreparationControl} from '../scripts/read-authority-preparation-control.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-14T00:00:00Z'),runtimeBinding='c'.repeat(64);
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
function setup(spent=25){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-handoff-'));chmodSync(dir,0o700);const path=join(dir,'budget.json');let now=clock;
 const raw=JSON.stringify({limit:160,spent,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40});writeFileSync(path,raw,{mode:0o600});
 const pauses=[],options={path,epoch:'SYNTHETIC_HANDOFF_'+randomUUID(),approvalHash:'a'.repeat(64),proposalHash:'b'.repeat(64),legacySha256:hash(raw),importedReads:spent,expiresAt:clock+21600000,now:()=>now,pause:async ms=>{pauses.push(ms);now+=ms;}};
 const control=createAuthorityPreparationControl(options);assert.equal(typeof control.withRuntime,'function');
 return {control,options,raw,pauses,get:()=>JSON.parse(readFileSync(path)),now:()=>now,setNow:v=>{now=v;}};
}
async function transfer(s,extra=0){
 let receipt;
 await s.control.withPreparation(async cap=>{
  await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});
  for(let i=0;i<extra;i++)await cap.externalRead(async()=>{});
  receipt=await cap.handoff({runtimeBinding,expectedSpent:s.get().spent});
 });return receipt;
}
test('runtime cannot initialize or claim a legacy counter before canonical handoff',async()=>{
 const s=setup();let io=0;await assert.rejects(s.control.withRuntime(runtimeBinding,async()=>{io++;}),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(readFileSync(s.options.path,'utf8'),s.raw);assert(!existsSync(s.options.path+'.preparation-claim.json'));
});
test('one-way handoff keeps the same counter, history, expiry and permanent flock inode across scopes',async()=>{
 const s=setup();await s.control.withPreparation(async()=>{});const inode=lstatSync(s.options.path+'.lock').ino,receipt=await transfer(s,1),before=s.get();
 assert(Object.isFrozen(receipt));assert.equal(receipt.source,'canonical-preparation-ledger');assert.equal(receipt.trialAccepted,false);assert.equal(receipt.runtimeBinding,runtimeBinding);assert.equal(receipt.spent,28);
 assert.equal(receipt.eventHash,hash(JSON.stringify(stable(before.preparation.events))));
 const peer=createAuthorityPreparationControl(s.options);let io=0;
 await peer.withRuntime(runtimeBinding,async cap=>{assert.equal(cap.handoff,undefined);await cap.externalRead(async()=>{io++;assert.equal(s.get().spent,29);});});
 const after=s.get();assert.equal(io,1);assert.equal(after.spent,29);assert.deepEqual(after.preparation.events.slice(0,before.preparation.events.length),before.preparation.events);assert.deepEqual(after.preparation.calls.slice(0,28),before.preparation.calls);
 assert.equal(after.preparation.expiresAt,before.preparation.expiresAt);assert.equal(after.preparation.importedReads,25);assert.deepEqual(after.preparation.cActions,['restore-editor','read-restored-editor']);assert.equal(lstatSync(s.options.path+'.lock').ino,inode);
 assert.deepEqual(after.preparation.handoff,before.preparation.handoff);assert.equal(after.approval_sha256,'a'.repeat(64));assert.equal(after.proposal_sha256,'b'.repeat(64));
});
test('wrong runtime binding fails before callback and does not replace the approved phase',async()=>{
 const s=setup();await transfer(s);const raw=readFileSync(s.options.path);let io=0;
 await assert.rejects(s.control.withRuntime('d'.repeat(64),async()=>{io++;}),/TRIAL_STOPPED/);assert.equal(io,0);assert.deepEqual(readFileSync(s.options.path),raw);
 await s.control.withRuntime(runtimeBinding,cap=>cap.externalRead(async()=>{io++;}));assert.equal(io,1);assert.equal(s.get().spent,28);
});
test('stale preparation ordinary IO is denied after handoff and stops further runtime dispatch',async()=>{
 const s=setup();await transfer(s);let io=0;
 await assert.rejects(s.control.withPreparation(cap=>cap.externalRead(async()=>{io++;})),/TRIAL_STOPPED/);
 await assert.rejects(s.control.withRuntime(runtimeBinding,cap=>cap.externalRead(async()=>{io++;})),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(s.get().spent,27);assert.equal(s.get().preparation.state,'stopped');assert(s.get().preparation.handoff);
});
test('runtime inherits the full rolling-minute history instead of granting fresh headroom',async()=>{
 const s=setup();await transfer(s,8);const before=s.get();assert.equal(before.spent,35);assert.deepEqual(s.pauses,[60000]);
 await s.control.withRuntime(runtimeBinding,cap=>cap.externalRead(async()=>{}));assert.deepEqual(s.pauses,[60000,60000]);assert.equal(s.get().spent,36);assert.deepEqual(s.get().preparation.calls.slice(0,35),before.preparation.calls);
});
test('runtime ceiling protects every remaining I reserve after completed C restoration',async()=>{
 const s=setup(141);await transfer(s);let io=0;
 await assert.rejects(s.control.withRuntime(runtimeBinding,cap=>cap.externalRead(async()=>{io++;})),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(s.get().spent,143);await s.control.withRuntime(runtimeBinding,cap=>cap.cleanup('read-original-project',async()=>{io++;}));assert.equal(io,1);assert.equal(s.get().spent,144);
});
test('cleanup admitted before or after handoff remains once-only in the canonical ledger',async()=>{
 const s=setup();await transfer(s);await s.control.withPreparation(cap=>cap.cleanup('remove-reader',async()=>{}));s.setNow(clock+86400001);
 await s.control.withRuntime(runtimeBinding,cap=>cap.cleanup('verify-reader-removed',async()=>{}));let io=0;
 await assert.rejects(s.control.withRuntime(runtimeBinding,cap=>cap.cleanup('remove-reader',async()=>{io++;})),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(s.get().spent,29);assert.deepEqual(s.get().preparation.iActions,['remove-reader','verify-reader-removed']);assert.equal(s.get().preparation.state,'stopped');
});
for(const reason of ['missing-restore','stale-spent','expired','day-change','cleanup'])test('handoff rejects '+reason+' without advancing the phase or charging local transfer',async()=>{
 const s=setup();let handed=false;
 await assert.rejects(s.control.withPreparation(async cap=>{
  if(reason!=='missing-restore'){await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});}
  if(reason==='expired')s.setNow(clock+21600000);
  if(reason==='day-change')s.setNow(clock+86400000);
  if(reason==='cleanup')await cap.cleanup('read-original-project',async()=>{});
  await cap.handoff({runtimeBinding,expectedSpent:s.get().spent+(reason==='stale-spent'?1:0)});handed=true;
 }),/TRIAL_STOPPED/);
 assert.equal(handed,false);assert.equal(s.get().preparation.version,1);assert.equal(s.get().preparation.handoff,undefined);assert.equal(s.get().spent,reason==='missing-restore'?25:reason==='cleanup'?28:27);
});
test('concurrent handoff cannot advance while an entered preparation IO still owns the flock',async()=>{
 const s=setup();let enter,release;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});let settled=false;
 const running=s.control.withPreparation(async cap=>{
  await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});
  const first=cap.externalRead(async()=>{enter();await gate;});void first.catch(()=>{});await entered;
  await assert.rejects(cap.handoff({runtimeBinding,expectedSpent:28}),/TRIAL_STOPPED/);await first;
 });void running.catch(()=>{});await entered;running.then(()=>{settled=true;},()=>{settled=true;});await new Promise(r=>setImmediate(r));
 try{assert.equal(settled,false);assert.equal(s.get().preparation.handoff,undefined);await assert.rejects(createAuthorityPreparationControl(s.options).withRuntime(runtimeBinding,async()=>{}),/TRIAL_STOPPED/);}finally{release();await assert.rejects(running,/TRIAL_STOPPED/);}
 assert.equal(s.get().spent,28);assert.equal(s.get().preparation.state,'stopped');
});
test('escaped handoff capability cannot advance the next phase',async()=>{
 const s=setup();let saved;await s.control.withPreparation(async cap=>{saved=cap;});const before=readFileSync(s.options.path);
 await assert.rejects(saved.handoff({runtimeBinding,expectedSpent:25}),/TRIAL_STOPPED/);assert.deepEqual(readFileSync(s.options.path),before);
});
test('duplicate handoff never resets the binding, history or stopped state',async()=>{
 const s=setup();await transfer(s);const handoff=s.get().preparation.handoff;
 await assert.rejects(s.control.withPreparation(cap=>cap.handoff({runtimeBinding:'d'.repeat(64),expectedSpent:27})),/TRIAL_STOPPED/);
 assert.deepEqual(s.get().preparation.handoff,handoff);assert.equal(s.get().spent,27);assert.equal(s.get().preparation.state,'stopped');
});
test('older preparation counter and new epoch cannot resurrect a completed handoff',async()=>{
 const s=setup();await s.control.withPreparation(async()=>{});const before=readFileSync(s.options.path);await transfer(s);writeFileSync(s.options.path,before,{mode:0o600});let io=0;
 await assert.rejects(s.control.withRuntime(runtimeBinding,async()=>{io++;}),/TRIAL_STOPPED/);
 await assert.rejects(createAuthorityPreparationControl({...s.options,epoch:'SYNTHETIC_NEW_EPOCH_'+randomUUID()}).withPreparation(async()=>{io++;}),/TRIAL_STOPPED/);assert.equal(io,0);
});
test('unknown runtime callback keeps debit and phase while independent cleanup remains eligible',async()=>{
 const s=setup();await transfer(s);let io=0;
 await assert.rejects(s.control.withRuntime(runtimeBinding,cap=>cap.externalRead(async()=>{io++;throw Error('SYNTHETIC_UNKNOWN');})),/TRIAL_STOPPED/);
 await assert.rejects(s.control.withRuntime(runtimeBinding,cap=>cap.externalRead(async()=>{io++;})),/TRIAL_STOPPED/);
 await s.control.withPreparation(cap=>cap.cleanup('read-original-project',async()=>{io++;}));assert.equal(io,2);assert.equal(s.get().spent,29);assert(s.get().preparation.handoff);assert.equal(s.get().preparation.state,'stopped');
});

for(const phase of ['runtime','preparation'])test(phase+' clock rollback before handoff timestamp rejects cleanup before debit and preserves later independent cleanup',async()=>{
 const s=setup();let io=0;
 await s.control.withPreparation(async cap=>{
  await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});
  s.setNow(s.now()+1000);await cap.handoff({runtimeBinding,expectedSpent:27});
 });
 const time=s.now();s.setNow(time-1);
 const cleanup=callback=>phase==='runtime'?s.control.withRuntime(runtimeBinding,callback):s.control.withPreparation(callback);
 await assert.rejects(cleanup(cap=>cap.cleanup('remove-reader',async()=>{io++;})),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(s.get().spent,27);assert.deepEqual(s.get().preparation.iActions,[]);
 s.setNow(time+1);await s.control.withRuntime(runtimeBinding,cap=>cap.cleanup('remove-reader',async()=>{io++;}));
 assert.equal(io,1);assert.equal(s.get().spent,28);assert.deepEqual(s.get().preparation.iActions,['remove-reader']);
});
