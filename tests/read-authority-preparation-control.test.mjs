import test from 'node:test';
import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,writeFileSync,readFileSync,lstatSync,unlinkSync,existsSync,openSync,closeSync,constants} from 'node:fs';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {SINGLE_WRAPPER_TRIAL_DECISION_HASH as decisionHash,SINGLE_WRAPPER_TRIAL_OPERATIONS as fixedOperations} from '../scripts/read-authority-trial-budget-plan.mjs';
import {createAuthorityTrialPublication} from '../scripts/read-authority-trial-publication.mjs';
import {buildAuthorityTrialArtifacts} from '../scripts/build-read-authority-trial-entry.mjs';
const mod=await import('../scripts/read-authority-preparation-control.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-preparation-control.mjs'))return {};throw e;});
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-14T00:00:00Z'),epochs=new Set();
const credentialDecision='5bd83ace54d7af801880798be3460ed9b6f8c8b053b447459e7956b127ff4c72',credentialPurposes=['caller-bind','publisher-bind','publisher-refresh','publisher-userinfo'];
test.after(()=>{for(const epoch of epochs)for(const suffix of ['preparation','publication']){const p=join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(epoch))+'.'+suffix+'.json');try{const s=lstatSync(p),v=JSON.parse(readFileSync(p)).value;if(s.isFile()&&!s.isSymbolicLink()&&v.path.startsWith(join(tmpdir(),'cmwebs-preparation-')))unlinkSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}}});
function setup(patch={},spent=25){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-preparation-'));chmodSync(dir,0o700);const path=join(dir,'budget.json'),epoch='SYNTHETIC_PREPARATION_'+randomUUID(),approvalHash='a'.repeat(64),proposalHash='b'.repeat(64);let now=clock;
 const legacy={limit:160,spent,kind:'preparation-management-reads',proposal_sha256:proposalHash,approval_sha256:approvalHash,prior_limit:40};const raw=JSON.stringify(legacy);writeFileSync(path,raw,{mode:0o600});writeFileSync(path+'.lock','',{mode:0o600});
 const pauses=[],options={path,epoch,approvalHash,proposalHash,legacySha256:hash(raw),importedReads:spent,expiresAt:clock+21600000,now:()=>now,pause:async ms=>{pauses.push(ms);now+=ms;},...patch};epochs.add(epoch);assert.equal(typeof mod.createAuthorityPreparationControl,'function');const control=mod.createAuthorityPreparationControl(options);
 return {control,options,pauses,setNow:v=>{now=v;},get:()=>JSON.parse(readFileSync(path))};
}
function probePreparationLock(path){
 const code="import os,fcntl,sys\nf=os.open(sys.argv[1],os.O_RDWR|os.O_NOFOLLOW)\ntry:\n fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);print('ACQUIRED')\nexcept BlockingIOError:print('HELD')\nfinally:os.close(f)\n";
 const result=cp.spawnSync('python3',['-c',code,path+'.lock'],{encoding:'utf8',timeout:3000,env:{PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'C',TZ:'Asia/Taipei'}});
 assert.equal(result.status,0);return result.stdout.trim();
}
test('credential decision binds four unique P purposes and preserves original counter history',async()=>{
 const s=setup({decisionHash:credentialDecision});await s.control.withPreparation(async cap=>{for(const name of credentialPurposes)await cap.externalRead(async()=>{},'P:'+name);await cap.externalRead(async()=>{},'A:original-project');});
 assert.equal(s.get().spent,30);assert.equal(s.get().preparation.decisionHash,credentialDecision);assert.equal(s.get().preparation.importedReads,25);assert.equal(s.get().approval_sha256,s.options.approvalHash);assert.equal(s.get().proposal_sha256,s.options.proposalHash);
});
for(const name of credentialPurposes)test('credential purpose '+name+' cannot be replayed or borrowed',async()=>{
 const s=setup({decisionHash:credentialDecision});let io=0;await assert.rejects(s.control.withPreparation(async cap=>{for(const n of credentialPurposes)await cap.externalRead(async()=>{io++;},'P:'+n);await cap.externalRead(async()=>{io++;},'P:'+name);}),/TRIAL_STOPPED/);assert.equal(io,4);assert.equal(s.get().spent,29);
});
for(const label of ['P:caller','P:publisher','A:original-project','B:fixture-import','P:publisher-refresh','P:publisher-userinfo'])test('new policy denies unbound/early '+label+' before IO',async()=>{
 const s=setup({decisionHash:credentialDecision});let io=0;await assert.rejects(s.control.withPreparation(cap=>cap.externalRead(async()=>{io++;},label)),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,25);
});
test('failed publisher identity stays charged, prevents A and preserves independent cleanup',async()=>{
 const s=setup({decisionHash:credentialDecision});let io=0;
 await assert.rejects(s.control.withPreparation(async cap=>{for(const name of credentialPurposes.slice(0,3))await cap.externalRead(async()=>{},'P:'+name);await assert.rejects(cap.externalRead(async()=>{throw Error('PRIVATE_IDENTITY');},'P:publisher-userinfo'),/^Error: TRIAL_STOPPED$/);await assert.rejects(cap.externalRead(async()=>{io++;},'A:original-project'),/TRIAL_STOPPED/);await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.cleanup('read-original-project',async()=>{});}),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(s.get().spent,32);assert.deepEqual(s.get().preparation.cActions,['restore-editor','read-restored-editor']);assert.deepEqual(s.get().preparation.iActions,['read-original-project']);
});
test('original claim cannot downgrade or switch credential purpose policy',async()=>{
 const s=setup({decisionHash:credentialDecision});await s.control.withPreparation(cap=>cap.externalRead(async()=>{},'P:caller-bind'));const before=readFileSync(s.options.path);
 await assert.rejects(mod.createAuthorityPreparationControl({...s.options,decisionHash}).withPreparation(async()=>{}),/TRIAL_STOPPED/);assert.deepEqual(readFileSync(s.options.path),before);
});
test('credential policy cannot hand off without its four preparation purposes',async()=>{
 const s=setup({decisionHash:credentialDecision});await assert.rejects(s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.handoff({runtimeBinding:'d'.repeat(64),expectedSpent:27});}),/TRIAL_STOPPED/);assert.equal(s.get().spent,27);assert.equal(s.get().preparation.version,1);
});
for(const failure of ['EOF','SIGKILL'])test('original scope holds flock after budget child '+failure+' until entered IO drains',async()=>{
 const s=setup(),spawn=cp.spawn;let child,enter,release,settled=false,scope,otherIO=0;
 const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 try{
  cp.spawn=(...args)=>{const value=spawn(...args);if(!child)child=value;return value;};syncBuiltinESMExports();
  scope=s.control.withPreparation(async cap=>{void cap.restoreOriginalEditor('restore-editor',async()=>{enter();await gate;});await entered;});
  void scope.then(()=>{settled=true;},()=>{settled=true;});await entered;
  for(let n=0;n<100&&s.get().preparation.state!=='stopped';n++)await delay(10);
  assert.equal(s.get().preparation.state,'stopped');assert.equal(probePreparationLock(s.options.path),'HELD');
  const closed=new Promise(r=>child.once('close',r));
  if(failure==='EOF')child.stdin.end();else assert.equal(child.kill('SIGKILL'),true);
  await closed;assert.equal(settled,false);
  assert.equal(probePreparationLock(s.options.path),'HELD','Child termination cannot release ownership of pending IO');
  const other=mod.createAuthorityPreparationControl(s.options);
  await assert.rejects(other.withPreparation(cap=>cap.restoreOriginalEditor('read-restored-editor',async()=>{otherIO++;})),/TRIAL_STOPPED/);
  assert.equal(otherIO,0);assert.equal(s.get().spent,26);
 }finally{release();if(scope)await assert.rejects(scope,/TRIAL_STOPPED/);cp.spawn=spawn;syncBuiltinESMExports();}
 assert.equal(probePreparationLock(s.options.path),'ACQUIRED','All descriptor copies close after the original scope settles');
 await s.control.withPreparation(cap=>cap.restoreOriginalEditor('read-restored-editor',async()=>{otherIO++;}));
 assert.equal(otherIO,1);assert.equal(s.get().spent,27);
});
test('budget child death during an awaited callback rejects success and fences later ordinary IO',async()=>{
 const s=setup(),spawn=cp.spawn;let child,enter,release,scope,ordinary=0;
 const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 try{
  cp.spawn=(...args)=>{const value=spawn(...args);if(!child)child=value;return value;};syncBuiltinESMExports();
  scope=s.control.withPreparation(cap=>cap.externalRead(async()=>{enter();await gate;return 'SYNTHETIC_COMPLETE';}));void scope.catch(()=>{});
  await entered;const closed=new Promise(r=>child.once('close',r));assert.equal(child.kill('SIGKILL'),true);await closed;
  release();await assert.rejects(scope,/TRIAL_STOPPED/);
 }finally{release();if(scope)await scope.catch(()=>{});cp.spawn=spawn;syncBuiltinESMExports();}
 assert.equal(s.get().spent,26);assert.equal(probePreparationLock(s.options.path),'ACQUIRED');
 const other=mod.createAuthorityPreparationControl(s.options);
 await assert.rejects(other.withPreparation(cap=>cap.externalRead(async()=>{ordinary++;})),/TRIAL_STOPPED/);
 assert.equal(ordinary,0);assert.equal(s.get().spent,26);
 await other.withPreparation(cap=>cap.cleanup('read-original-project',async()=>{}));assert.equal(s.get().spent,27);
});
test('child death during the stop exchange still writes a durable ordinary-admission veto',async()=>{
 const s=setup(),spawn=cp.spawn;let injected=false,ordinary=0;
 try{
  cp.spawn=(...args)=>{
   const child=spawn(...args),write=child.stdin.write.bind(child.stdin);
   child.stdin.write=(message,...rest)=>{
    if(!injected&&JSON.parse(String(message)).op==='stop'){injected=true;child.kill('SIGKILL');}
    return write(message,...rest);
   };return child;
  };syncBuiltinESMExports();
  await assert.rejects(s.control.withPreparation(async cap=>{await cap.externalRead(async()=>{});throw Error('SYNTHETIC_CALLBACK_FAILED');}),/TRIAL_STOPPED/);
 }finally{cp.spawn=spawn;syncBuiltinESMExports();}
 assert.equal(injected,true);assert.equal(s.get().spent,26);assert.equal(probePreparationLock(s.options.path),'ACQUIRED');
 const other=mod.createAuthorityPreparationControl(s.options);
 await assert.rejects(other.withPreparation(cap=>cap.externalRead(async()=>{ordinary++;})),/TRIAL_STOPPED/);
 assert.equal(ordinary,0);assert.equal(s.get().spent,26);
});
for(const failure of ['EOF','SIGKILL'])test('finish exchange '+failure+' rejects success and fences independent ordinary admission',async()=>{
 const s=setup(),spawn=cp.spawn;let injected=false,ordinary=0;
 try{
  cp.spawn=(...args)=>{
   const child=spawn(...args),write=child.stdin.write.bind(child.stdin);
   child.stdin.write=(message,...rest)=>{
    if(!injected&&JSON.parse(String(message)).op==='finish'){
     injected=true;if(failure==='EOF')child.stdin.end();else child.kill('SIGKILL');
    }
    return write(message,...rest);
   };return child;
  };syncBuiltinESMExports();
  await assert.rejects(s.control.withPreparation(async cap=>{await cap.externalRead(async()=>{});return 'FALSE_SUCCESS';}),/TRIAL_STOPPED/);
 }finally{cp.spawn=spawn;syncBuiltinESMExports();}
 assert.equal(injected,true);assert.equal(s.get().spent,26);assert.equal(probePreparationLock(s.options.path),'ACQUIRED');
 const other=mod.createAuthorityPreparationControl(s.options);
 await assert.rejects(other.withPreparation(cap=>cap.externalRead(async()=>{ordinary++;})),/TRIAL_STOPPED/);
 assert.equal(ordinary,0);assert.equal(s.get().spent,26);
});
test('failed durable stop helper retains ownership until its original controller obtains a strict stop acknowledgement',async()=>{
 const s=setup(),spawn=cp.spawn;let ordinary=0,helperFailed=false,injected=false;
 try{
  cp.spawn=(cmd,args,options)=>{
   if(args.includes('--request-stop')){helperFailed=true;return spawn('cmwebs-missing-stop-helper-for-test',args,options);}
   const child=spawn(cmd,args,options),write=child.stdin.write.bind(child.stdin);
   child.stdin.write=(message,...rest)=>{
    if(!injected&&JSON.parse(String(message)).op==='finish'){injected=true;child.kill('SIGKILL');}
    return write(message,...rest);
   };return child;
  };syncBuiltinESMExports();
  await assert.rejects(s.control.withPreparation(async cap=>{await cap.externalRead(async()=>{});return 'FALSE_SUCCESS';}),/TRIAL_STOPPED/);
  assert.equal(helperFailed,true);assert.equal(probePreparationLock(s.options.path),'HELD');
  const other=mod.createAuthorityPreparationControl(s.options);
  await assert.rejects(other.withPreparation(cap=>cap.externalRead(async()=>{ordinary++;})),/TRIAL_STOPPED/);
  assert.equal(ordinary,0);assert.equal(s.get().spent,26);
 }finally{
  cp.spawn=spawn;syncBuiltinESMExports();await s.control.requestStop();
 }
 assert.equal(probePreparationLock(s.options.path),'ACQUIRED');
 const other=mod.createAuthorityPreparationControl(s.options);
 await assert.rejects(other.withPreparation(cap=>cap.externalRead(async()=>{ordinary++;})),/TRIAL_STOPPED/);
 assert.equal(ordinary,0);assert.equal(s.get().spent,26);
 await other.withPreparation(cap=>cap.cleanup('read-original-project',async()=>{}));assert.equal(s.get().spent,27);
});
test('inherited descriptor must name the canonical lock and mismatch leaves no claim or held descriptor',async()=>{
 const s=setup(),spawn=cp.spawn,wrong=openSync(s.options.path+'.wrong-lock',constants.O_RDWR|constants.O_CREAT|constants.O_EXCL,0o600);
 let injected=false,io=0;
 try{
  cp.spawn=(command,args,options)=>{
   if(!injected){injected=true;return spawn(command,args,{...options,stdio:[...options.stdio.slice(0,3),wrong]});}
   return spawn(command,args,options);
  };syncBuiltinESMExports();
  await assert.rejects(s.control.withPreparation(async()=>{io++;}),/TRIAL_STOPPED/);
 }finally{cp.spawn=spawn;syncBuiltinESMExports();closeSync(wrong);}
 assert.equal(injected,true);assert.equal(io,0);assert.equal(s.get().spent,25);
 assert.equal(existsSync(s.options.path+'.preparation-claim.json'),false);
 assert.equal(probePreparationLock(s.options.path),'ACQUIRED');
 await s.control.withPreparation(async()=>{});assert.equal(s.get().spent,25);
});
async function failChildInputOnce(work){
 const original=cp.spawn;let injected=false;
 try{
  cp.spawn=(...args)=>{
   const child=original(...args);
   if(!injected){injected=true;queueMicrotask(()=>child.stdin.destroy(Object.assign(Error('SYNTHETIC_PRIVATE_PIPE_FAILURE'),{code:'EPIPE'})));}
   return child;
  };syncBuiltinESMExports();await work();
 }finally{cp.spawn=original;syncBuiltinESMExports();}
 assert.equal(injected,true);
}
test('child input EPIPE rejects the preparation scope without IO or an uncaught stream error',async()=>{
 const s=setup();let io=0;
 await failChildInputOnce(()=>assert.rejects(s.control.withPreparation(cap=>cap.externalRead(async()=>{io++;})),/^Error: TRIAL_STOPPED$/));
 assert.equal(io,0);assert.equal(s.get().spent,25);
 // Reuse is possible only after the original child has actually settled.
 await s.control.withPreparation(async()=>{});assert.equal(s.get().spent,25);
});
test('stop-request input EPIPE cannot acknowledge a durable stop or reopen ordinary IO',async()=>{
 const s=setup();let io=0;
 await failChildInputOnce(()=>assert.rejects(s.control.requestStop(),/^Error: TRIAL_STOPPED$/));
 await assert.rejects(s.control.withPreparation(cap=>cap.externalRead(async()=>{io++;})),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(s.get().spent,25);
});
test('denial after preparation debit but before queued IO vetoes callback and retains independent cleanup',async()=>{
 const s=setup(),original=cp.spawn;let capSaved,second,firstIO=0,secondIO=0,cleanupIO=0,armed=true;
 try{
  cp.spawn=(...args)=>{
   const child=original(...args);
   child.stdout.on('data',raw=>{
    if(armed&&String(raw).includes('"spent":26')){
     armed=false;
     // The real Python debit has completed. Interleave the denied admission
     // after request validation and before the queued ordinary callback.
     queueMicrotask(()=>queueMicrotask(()=>{
      second=capSaved.externalRead(async()=>{secondIO++;});void second.catch(()=>{});
     }));
    }
   });return child;
  };syncBuiltinESMExports();
  await assert.rejects(s.control.withPreparation(async cap=>{
   capSaved=cap;const first=cap.externalRead(async()=>{firstIO++;});void first.catch(()=>{});
   await first.catch(()=>{});if(second)await second.catch(()=>{});
   await cap.cleanup('read-original-project',async()=>{cleanupIO++;});
  }),/TRIAL_STOPPED/);
 }finally{cp.spawn=original;syncBuiltinESMExports();}
 assert.equal(armed,false);assert.equal(firstIO,0);assert.equal(secondIO,0);assert.equal(cleanupIO,1);
 assert.equal(s.get().spent,27);assert.equal(s.get().preparation.state,'stopped');
 assert.deepEqual(s.get().preparation.iActions,['read-original-project']);
});
test('construction has no mutation; scoped wait conservatively retains imported25 then durably charges before IO',async()=>{
 const s=setup(),raw=readFileSync(s.options.path,'utf8');assert.equal(readFileSync(s.options.path,'utf8'),raw);assert(!s.get().preparation);
 await s.control.withPreparation(async cap=>{await cap.waitForExternalReadSlot(1);await cap.reserveExternalReads(1);assert.equal(s.get().spent,26);assert.equal(s.get().preparation.importedReads,25);});assert.deepEqual(s.pauses,[60000]);assert.equal(s.get().spent,26);assert.equal(s.get().approval_sha256,'a'.repeat(64));assert.equal(s.get().proposal_sha256,'b'.repeat(64));assert.equal(s.get().prior_limit,40);assert(existsSync(s.options.path+'.lock'));
});
test('atomic external read durably debits before callback and preserves all independent reserves',async()=>{const s=setup();await s.control.withPreparation(async cap=>{assert.equal(typeof cap.externalRead,'function');assert.equal(await cap.externalRead(async()=>{assert.equal(s.get().spent,26);return 'SYNTHETIC_NATIVE_RESULT';}),'SYNTHETIC_NATIVE_RESULT');});assert.equal(s.get().spent,26);assert.deepEqual(s.get().preparation.cActions,[]);assert.deepEqual(s.get().preparation.iActions,[]);});
test('failed atomic external read immediately denies ordinary work while cleanup remains usable',async()=>{const s=setup();let io=0;await assert.rejects(s.control.withPreparation(async cap=>{assert.equal(typeof cap.externalRead,'function');await assert.rejects(cap.externalRead(async()=>{io++;throw Error('UNKNOWN_NATIVE_RESULT');}),/TRIAL_STOPPED/);await assert.rejects(cap.externalRead(async()=>{io++;}),/TRIAL_STOPPED/);await cap.cleanup('read-original-project',async()=>{io++;});}),/TRIAL_STOPPED/);assert.equal(io,2);assert.equal(s.get().spent,27);assert.equal(s.get().preparation.state,'stopped');});
test('unawaited entered atomic read retains the existing flock until the callback settles',async()=>{const s=setup();await s.control.withPreparation(async cap=>assert.equal(typeof cap.externalRead,'function'));let enter,release;const entered=new Promise(r=>{enter=r;});const scope=s.control.withPreparation(async cap=>{void cap.externalRead(async()=>{enter();await new Promise(r=>{release=r;});});await entered;});void scope.catch(()=>{});await entered;const next=mod.createAuthorityPreparationControl(s.options);await assert.rejects(next.withPreparation(async()=>{}),/TRIAL_STOPPED/);assert.equal(s.get().spent,26);release();await assert.rejects(scope,/TRIAL_STOPPED/);await next.withPreparation(async()=>{});assert.equal(s.get().spent,26);});
test('escaped atomic read cannot enter its callback after scope closure',async()=>{const s=setup();let saved;await s.control.withPreparation(async cap=>{assert.equal(typeof cap.externalRead,'function');saved=cap;});let io=0;await assert.rejects(saved.externalRead(async()=>{io++;}),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,25);});
test('ordinary cap141 protects I17 and C2; both C callbacks independently debit after stop/expiry',async()=>{
 const s=setup({},141),seen=[];await assert.rejects(s.control.withPreparation(async cap=>{await cap.waitForExternalReadSlot(1);}),/TRIAL_STOPPED/);assert.equal(s.get().spent,141);s.setNow(clock+21600001);
 await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{seen.push(s.get().spent);});await cap.restoreOriginalEditor('read-restored-editor',async()=>{seen.push(s.get().spent);});});assert.deepEqual(seen,[142,143]);assert.equal(s.get().spent,143);assert.equal(s.get().preparation.state,'stopped');
});
test('successful C restoration does not stop normal preparation and only releases its own reserve',async()=>{
 const s=setup();await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.waitForExternalReadSlot(1);await cap.reserveExternalReads(1);});assert.equal(s.get().spent,28);assert.equal(s.get().preparation.state,'ready');assert.deepEqual(s.get().preparation.cActions,['restore-editor','read-restored-editor']);
});
test('readback before restore admission is denied without spending its reserved unit',async()=>{
 const s=setup();let io=0;await assert.rejects(s.control.withPreparation(cap=>cap.restoreOriginalEditor('read-restored-editor',async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,25);assert.deepEqual(s.get().preparation.cActions,[]);
});
test('unknown C callback stays spent and cannot retry across restart; independent GET still available',async()=>{
 const s=setup();let io=0;await assert.rejects(s.control.withPreparation(cap=>cap.restoreOriginalEditor('restore-editor',async()=>{io++;throw Error('SYNTHETIC_UNKNOWN');})),/TRIAL_STOPPED/);assert.equal(s.get().spent,26);const next=mod.createAuthorityPreparationControl(s.options);await assert.rejects(next.withPreparation(cap=>cap.restoreOriginalEditor('restore-editor',async()=>{io++;})),/TRIAL_STOPPED/);await next.withPreparation(cap=>cap.restoreOriginalEditor('read-restored-editor',async()=>{io++;}));assert.equal(io,2);assert.equal(s.get().spent,27);
});
test('I cleanup permanently stops ordinary work but does not block C restore or remaining I',async()=>{
 const s=setup();await s.control.withPreparation(async cap=>{await cap.cleanup('remove-reader',async()=>{});await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.cleanup('verify-reader-removed',async()=>{});});assert.equal(s.get().spent,29);assert.equal(s.get().preparation.state,'stopped');await assert.rejects(s.control.withPreparation(cap=>cap.reserveExternalReads(1)),/TRIAL_STOPPED/);assert.equal(s.get().spent,29);
});
test('the existing flock file serializes cross-instance scopes; a busy scope cannot spend or replace it',async()=>{
 const s=setup();let enter,release;const entered=new Promise(r=>{enter=r;});const holding=s.control.withPreparation(async()=>{enter();await new Promise(r=>{release=r;});});await entered;const inode=lstatSync(s.options.path+'.lock').ino,next=mod.createAuthorityPreparationControl(s.options);await assert.rejects(next.withPreparation(async()=>{}),/TRIAL_STOPPED/);assert.equal(s.get().spent,25);assert.equal(lstatSync(s.options.path+'.lock').ino,inode);release();await holding;await next.withPreparation(async()=>{});
});
test('escaped scoped capabilities cannot debit or execute after return',async()=>{
 const s=setup();let saved;await s.control.withPreparation(async cap=>{saved=cap;});await assert.rejects(saved.reserveExternalReads(1),/TRIAL_STOPPED/);await assert.rejects(saved.restoreOriginalEditor('restore-editor',async()=>assert.fail('ESCAPED_IO')),/TRIAL_STOPPED/);assert.equal(s.get().spent,25);
});
test('alternate counter path cannot reset the same epoch',async()=>{
 const s=setup();await s.control.withPreparation(async()=>{});const other=setup({epoch:s.options.epoch});await assert.rejects(other.control.withPreparation(async()=>{}),/TRIAL_STOPPED/);assert.equal(other.get().spent,25);
});
test('legacy fingerprint or approval mismatch rejects before counter upgrade',async()=>{
 for(const patch of [{legacySha256:'f'.repeat(64)},{approvalHash:'f'.repeat(64)},{proposalHash:'f'.repeat(64)}]){const s=setup(patch);await assert.rejects(s.control.withPreparation(async()=>assert.fail('BAD_RECEIPT_IO')),/TRIAL_STOPPED/);assert(!s.get().preparation);assert.equal(s.get().spent,25);}
});
test('legacy out-of-band debit cannot be silently folded into imported history',async()=>{
 const s=setup();await s.control.withPreparation(async()=>{});const v=s.get();v.spent++;writeFileSync(s.options.path,JSON.stringify(v),{mode:0o600});await assert.rejects(s.control.withPreparation(async()=>assert.fail('DRIFT_IO')),/TRIAL_STOPPED/);assert.equal(s.get().spent,26);
});
test('day or expiry boundary stops ordinary debit while independent restoration remains possible',async()=>{
 const s=setup();await s.control.withPreparation(async()=>{});s.setNow(clock+86400000);await assert.rejects(s.control.withPreparation(cap=>cap.waitForExternalReadSlot(1)),/TRIAL_STOPPED/);assert.equal(s.get().spent,25);await s.control.withPreparation(cap=>cap.restoreOriginalEditor('restore-editor',async()=>{}));assert.equal(s.get().spent,26);
});
test('unknown action and invalid units never run IO or consume I17/C2',async()=>{
 const s=setup();await assert.rejects(s.control.withPreparation(cap=>cap.cleanup('arbitrary-delete',async()=>assert.fail('UNSAFE_IO'))),/TRIAL_STOPPED/);assert.equal(s.get().spent,25);await assert.rejects(s.control.withPreparation(cap=>cap.restoreOriginalEditor('other',async()=>assert.fail('UNSAFE_IO'))),/TRIAL_STOPPED/);assert.equal(s.get().spent,25);
});
test('all ordinary141 plus C2 and I17 remain within160 with each cleanup action once',async()=>{
 const s=setup({},141),actions=['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','restore-original-guard','verify-original-guard','restore-thin-guard','verify-thin-guard','remove-testing-user','verify-testing-user-removed','revoke-token','verify-token-revoked','read-original-editor','read-original-versions','read-original-deployments','read-original-project','read-original-triggers'];
 await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});for(const action of actions)await cap.cleanup(action,async()=>{});});assert.equal(s.get().spent,160);assert.equal(s.get().preparation.iActions.length,17);await assert.rejects(s.control.withPreparation(cap=>cap.cleanup('remove-reader',async()=>assert.fail('REPLAY'))),/TRIAL_STOPPED/);assert.equal(s.get().spent,160);
});
test('frozen pause cannot admit ordinary or restoration IO',async()=>{
 const s=setup({pause:async()=>{}});await assert.rejects(s.control.withPreparation(async cap=>{await cap.waitForExternalReadSlot(1);await cap.reserveExternalReads(1);}),/TRIAL_STOPPED/);assert.equal(s.get().spent,25);
});
test('unawaited capability invalidates scope and cannot continue after return',async()=>{
 let release,p;const s=setup({pause:()=>new Promise(r=>{release=r;})});await assert.rejects(s.control.withPreparation(cap=>{p=cap.waitForExternalReadSlot(1);}),/TRIAL_STOPPED/);release();await assert.rejects(p,/TRIAL_STOPPED/);assert.equal(s.get().spent,25);assert.equal(s.get().preparation.state,'stopped');
});
test('swallowed failed preparation capability cannot yield successful scope',async()=>{
 const s=setup();await assert.rejects(s.control.withPreparation(async cap=>{try{await cap.reserveExternalReads(0);}catch(_){}return 'FALSE_SUCCESS';}),/TRIAL_STOPPED/);assert.equal(s.get().spent,25);
});
test('unsafe counter permissions refuse callback without upgrade',async()=>{const s=setup();chmodSync(s.options.path,0o644);try{await assert.rejects(s.control.withPreparation(async()=>assert.fail('UNSAFE_IO')),/TRIAL_STOPPED/);assert(!s.get().preparation);}finally{chmodSync(s.options.path,0o600);}});
test('changed lifetime or imported history cannot revive same registered phase',async()=>{
 const s=setup();await s.control.withPreparation(async()=>{});for(const patch of [{expiresAt:clock+21600001},{importedReads:0}]){const other=mod.createAuthorityPreparationControl({...s.options,...patch});await assert.rejects(other.withPreparation(async()=>assert.fail('RESEED')),/TRIAL_STOPPED/);}assert.equal(s.get().spent,25);
});
for(const unknown of [false,true])test('real preparation ledger with fake publication '+(unknown?'unknown stage preserves restoration':'completes seven charged IO'),async()=>{
 const s=setup(),scriptId='SYNTHETIC_CONTROL_SCRIPT_ID',publisherHash=hash('publisher@example.invalid'),canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v,checksum=v=>hash(JSON.stringify(canon(v)));
 const original=Array.from({length:10},(_,n)=>({name:n===0?'appsscript':'Original'+n,type:n===0?'JSON':'SERVER_JS',source:n===0?'{"timeZone":"Asia/Taipei","runtimeVersion":"V8"}':'// SYNTHETIC ORIGINAL '+n+'\n'})),sourceHash=checksum([...original].sort((a,b)=>a.name.localeCompare(b.name))),versions=Array.from({length:6},(_,i)=>({scriptId,versionNumber:i+1})),deployments=[{deploymentId:'SYNTHETIC_CONTROL_DEPLOYMENT',deploymentConfig:{scriptId,versionNumber:1,manifestFileName:'appsscript'}}];
 const b=buildAuthorityTrialArtifacts({libraryId:scriptId,version:1}),library=[{name:'AuthorityTrial',type:'SERVER_JS',source:b.librarySource},{name:'appsscript',type:'JSON',source:JSON.stringify(b.libraryManifest)}],calls=[];let current=original,created;
 const execute=()=>s.control.withPreparation(async control=>{const pub=createAuthorityTrialPublication({path:join(s.options.path,'..','publisher.json'),epoch:s.options.epoch,scriptId,publisherHash,originalFiles:original,originalSourceHash:sourceHash,baselineVersions:versions,baselineDeployments:deployments,expiresAt:s.options.expiresAt,now:s.options.now,control,
  backupReceipt:{source:'fixed-trial-original-editor-backup',epoch:s.options.epoch,scriptId,publisherHash,sourceHash,versionsHash:checksum(versions),deploymentsHash:checksum(deployments)},
  credential:()=>({accessToken:'SYNTHETIC_MANAGEMENT_TOKEN',accountHash:publisherHash,scopes:['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(x=>'https://www.googleapis.com/auth/'+x),expiresAt:s.options.now()+3600000,refreshTokenPresent:true}),
  fetcher:async(url,init)=>{calls.push(init.method);const u=new URL(url);if(init.method==='PUT'){current=JSON.parse(init.body).files;if(unknown&&calls.length===1)throw Error('SYNTHETIC_LOST_STAGE');return new Response(JSON.stringify({scriptId,files:current}));}if(init.method==='POST'){created={scriptId,versionNumber:7,description:JSON.parse(init.body).description};return new Response(JSON.stringify(created));}if(u.pathname.endsWith('/content'))return new Response(JSON.stringify({scriptId,files:u.searchParams.has('versionNumber')?library:current}));if(u.pathname.endsWith('/versions'))return new Response(JSON.stringify({versions:[...versions,created]}));return new Response(JSON.stringify({deployments}));}});return pub.publishAndRestore();});
 if(unknown){await assert.rejects(execute(),/TRIAL_STOPPED/);assert.deepEqual(calls,['PUT','PUT','GET']);assert.equal(s.get().spent,28);assert.equal(s.get().preparation.state,'stopped');}else{const r=await execute();assert.equal(r.editorRestoredAtReadback,true);assert.equal(r.publicationAccepted,false);assert.equal(s.get().spent,32);assert.equal(s.get().preparation.state,'ready');assert.deepEqual(calls,['PUT','POST','GET','PUT','GET','GET','GET']);}assert.deepEqual(s.get().preparation.cActions,['restore-editor','read-restored-editor']);assert.equal(s.get().preparation.iActions.length,0);
});
test('registered phase rejects exact legacy rollback without restoring spent or once-only actions',async()=>{
 const s=setup(),legacy=readFileSync(s.options.path);await s.control.withPreparation(cap=>cap.cleanup('remove-reader',async()=>{}));assert.equal(s.get().spent,26);writeFileSync(s.options.path,legacy,{mode:0o600});await assert.rejects(s.control.withPreparation(async()=>{}),/TRIAL_STOPPED/);
});
test('registered phase rejects an older valid upgraded checkpoint',async()=>{
 const s=setup();await s.control.withPreparation(async()=>{});const earlier=readFileSync(s.options.path);await s.control.withPreparation(cap=>cap.cleanup('remove-reader',async()=>{}));writeFileSync(s.options.path,earlier,{mode:0o600});await assert.rejects(s.control.withPreparation(async()=>{}),/TRIAL_STOPPED/);
});
test('counter path cannot be re-claimed by a fresh phase after legacy rollback',async()=>{
 const s=setup(),legacy=readFileSync(s.options.path);await s.control.withPreparation(cap=>cap.cleanup('remove-reader',async()=>{}));writeFileSync(s.options.path,legacy,{mode:0o600});const epoch='SYNTHETIC_NEW_PHASE_'+randomUUID();epochs.add(epoch);const next=mod.createAuthorityPreparationControl({...s.options,epoch});await assert.rejects(next.withPreparation(async()=>{}),/TRIAL_STOPPED/);
});
test('spawn failure is terminal and does not hang cleanup or permanently keep the controller busy',async()=>{
 const s=setup(),spawn=cp.spawn;let child,p;
 try{cp.spawn=(cmd,args,options)=>{child=spawn(cmd==='python3'?'cmwebs-missing-python-for-test':cmd,args,options);child.once('error',()=>{child.exitCode=null;});return child;};syncBuiltinESMExports();p=s.control.withPreparation(async()=>assert.fail('MISSING_SPAWN_CALLBACK'));const outcome=await Promise.race([p.then(()=> 'WRONG_SUCCESS',()=> 'REJECTED'),delay(5000).then(()=> 'HUNG')]);assert.equal(outcome,'REJECTED');}finally{cp.spawn=spawn;syncBuiltinESMExports();if(child?.pid===undefined&&child?.exitCode===null)child.emit('exit',-1);if(p)await p.catch(()=>{});}
 await s.control.withPreparation(async()=>{});
});
test('flock remains owned until already entered unawaited restore IO settles',async()=>{
 const s=setup();let enter,release,settled=false;const entered=new Promise(r=>{enter=r;}),holding=new Promise(r=>{release=r;});const scope=s.control.withPreparation(async cap=>{void cap.restoreOriginalEditor('restore-editor',async()=>{enter();await holding;});await entered;});void scope.then(()=>{settled=true;},()=>{settled=true;});await entered;
 try{for(let n=0;n<100&&s.get().preparation.state!=='stopped';n++)await delay(10);await delay(50);const other=mod.createAuthorityPreparationControl(s.options);await assert.rejects(other.withPreparation(cap=>cap.restoreOriginalEditor('read-restored-editor',async()=>{})),/TRIAL_STOPPED/);assert.equal(settled,false);}finally{release();await assert.rejects(scope,/TRIAL_STOPPED/);}
});
test('caught C failure immediately stops ordinary admission while independent readback remains available',async()=>{
 const s=setup();await assert.rejects(s.control.withPreparation(async cap=>{try{await cap.restoreOriginalEditor('restore-editor',async()=>{throw Error('SYNTHETIC_UNKNOWN');});}catch(_){}let admitted=false;try{await cap.waitForExternalReadSlot(1);await cap.reserveExternalReads(1);admitted=true;}catch(_){}await cap.restoreOriginalEditor('read-restored-editor',async()=>{});assert.equal(admitted,false);}),/TRIAL_STOPPED/);assert.equal(s.get().spent,27);
});

for(const kind of ['ordinary','C','I']) test('same preparation scope rejects overlapping '+kind+' admission before debit and IO',async()=>{
 const s=setup();let enter,release,rejected=false,secondIO=0,after=0,active=0,maximum=0;
 const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 const scope=s.control.withPreparation(async cap=>{
  const first=cap.externalRead(async()=>{active++;maximum=Math.max(maximum,active);enter();await gate;active--;});void first.catch(()=>{});await entered;
  const second=()=>{secondIO++;active++;maximum=Math.max(maximum,active);active--;};
  try{
   try{await (kind==='ordinary'?cap.externalRead(second):kind==='C'?cap.restoreOriginalEditor('restore-editor',second):cap.cleanup('read-original-project',second));}catch{rejected=true;}
  }finally{release();await first;}
  if(rejected&&kind!=='ordinary')await (kind==='C'?cap.restoreOriginalEditor('restore-editor',async()=>{after++;}):cap.cleanup('read-original-project',async()=>{after++;}));
 });
 await assert.rejects(scope,/TRIAL_STOPPED/);assert.equal(rejected,true);assert.equal(secondIO,0);assert.equal(maximum,1);assert.equal(after,kind==='ordinary'?0:1);assert.equal(s.get().spent,kind==='ordinary'?26:27);
});

// Approved supplemental policy binds the original counter and permanent epoch.
// These fixtures use new synthetic paths only; no actual preparation is claimed.
test('supplemental decision is pure at construction and preserves legacy history on first debit',async()=>{
 const s=setup({decisionHash}),before=readFileSync(s.options.path);assert.deepEqual(readFileSync(s.options.path),before);assert.equal(s.get().preparation,undefined);
 await s.control.withPreparation(cap=>cap.externalRead(async()=>{assert.equal(s.get().spent,26);assert.equal(s.get().preparation.events.at(-1).action,'A:original-project');},'A:original-project'));
 assert.equal(s.get().preparation.decisionHash,decisionHash);assert.equal(s.get().preparation.importedReads,25);assert.equal(s.get().approval_sha256,s.options.approvalHash);assert.equal(s.get().proposal_sha256,s.options.proposalHash);
});
for(const patch of [{decisionHash:'f'.repeat(64)},{decisionHash:null},{decisionHash,importedReads:26}])test('supplemental policy rejects an unapproved binding '+JSON.stringify(patch),()=>{
 assert.throws(()=>setup(patch),/TRIAL_STOPPED/);
});
for(const charge of [undefined,null,'A:unknown','B:original-project','F:qualified-before.original-project','G:qualified-before:caller:pages','G:wrapper-before:other:pages','G:wrapper-before:caller:unknown','T:unknown-settlement'])test('supplemental preparation refuses missing or misplaced charge '+String(charge),async()=>{
 const s=setup({decisionHash});let io=0;await assert.rejects(s.control.withPreparation(cap=>cap.externalRead(async()=>{io++;},charge)),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,25);
});
test('fixed alias cannot be repeated or relabeled to borrow another fixed bucket',async()=>{
 const s=setup({decisionHash});let io=0;await assert.rejects(s.control.withPreparation(async cap=>{await cap.externalRead(async()=>{io++;},'A:original-project');await cap.externalRead(async()=>{io++;},'A:original-project');}),/TRIAL_STOPPED/);assert.equal(io,1);assert.equal(s.get().spent,26);
 await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.cleanup('read-original-project',async()=>{});});assert.equal(s.get().spent,29);
});
test('failed charged IO remains UNKNOWN and consumes its original alias without refund',async()=>{
 const s=setup({decisionHash});await assert.rejects(s.control.withPreparation(cap=>cap.externalRead(async()=>{throw Error('PRIVATE_IO');},'B:fixture-import')),/TRIAL_STOPPED/);
 assert.equal(s.get().spent,26);assert.equal(s.get().preparation.events.at(-1).outcome,'UNKNOWN');assert.equal(s.get().preparation.events.at(-1).action,'B:fixture-import');
 await s.control.withPreparation(cap=>cap.cleanup('remove-reader',async()=>{}));assert.equal(s.get().spent,27);
});
for(const [charge,max] of [['P:caller',2],['P:publisher',2]])test(charge+' hard cap cannot borrow unused peer or native quota',async()=>{
 const s=setup({decisionHash});let io=0;await assert.rejects(s.control.withPreparation(async cap=>{for(let i=0;i<=max;i++)await cap.externalRead(async()=>{io++;},charge);}),/TRIAL_STOPPED/);assert.equal(io,max);assert.equal(s.get().spent,25+max);
});
for(const [category,max] of [['pages',4],['setupReads',2],['identityReads',1],['quotaReads',1]])test('native '+category+' has an independent per-window cap',async()=>{
 const s=setup({decisionHash});await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.handoff({runtimeBinding:'d'.repeat(64),expectedSpent:27});});
 let io=0;await assert.rejects(s.control.withRuntime('d'.repeat(64),async cap=>{for(let i=0;i<=max;i++)await cap.externalRead(async()=>{io++;},'G:wrapper-before:caller:'+category);}),/TRIAL_STOPPED/);assert.equal(io,max);assert.equal(s.get().spent,27+max);
});
test('supplemental binding cannot be dropped or changed when reopening the existing original counter',async()=>{
 const s=setup({decisionHash});await s.control.withPreparation(cap=>cap.externalRead(async()=>{},'A:original-project'));const before=readFileSync(s.options.path),options={...s.options};delete options.decisionHash;
 let io=0;await assert.rejects(mod.createAuthorityPreparationControl(options).withPreparation(cap=>cap.externalRead(async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,0);assert.deepEqual(readFileSync(s.options.path),before);
});
test('strict policy denies unassigned bulk reservations without spending or IO',async()=>{
 const s=setup({decisionHash});await assert.rejects(s.control.withPreparation(cap=>cap.reserveExternalReads(1)),/TRIAL_STOPPED/);assert.equal(s.get().spent,25);
});
test('strict policy never admits direct qualified RPC even after the wrapper is fully complete',async()=>{
 const s=setup({decisionHash});const binding='d'.repeat(64);await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.handoff({runtimeBinding:binding,expectedSpent:27});});
 let io=0;await s.control.withRuntime(binding,async cap=>{await cap.dispatchCompatibility({entry:'wrapper',nativeMs:0,observedAt:clock,credentialExpiresAt:clock+3600000},async()=>{io++;});await cap.accountNative({entry:'wrapper',totalMs:100,executionHash:'e'.repeat(64)});await cap.finishCompatibility('wrapper');});
 await assert.rejects(s.control.withRuntime(binding,cap=>cap.dispatchCompatibility({entry:'qualified',nativeMs:100,observedAt:clock,credentialExpiresAt:clock+3600000},async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,1);assert.equal(s.get().spent,28);assert.deepEqual(s.get().preparation.runtime.entries.map(e=>e.entry),['wrapper']);
});
test('G after and F after use reserved observation buckets; T remains independent and limited to three',async()=>{
 const s=setup({decisionHash}),binding='d'.repeat(64);await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.handoff({runtimeBinding:binding,expectedSpent:27});});
 let io=0;await assert.rejects(s.control.withRuntime(binding,async cap=>{
  await cap.dispatchCompatibility({entry:'wrapper',nativeMs:0,observedAt:clock,credentialExpiresAt:clock+3600000},async()=>{});
  await cap.settlementRead(async()=>{io++;},'G:wrapper-after:caller:pages');await cap.settlementRead(async()=>{io++;},'F:wrapper-after.original-project');
  for(let i=0;i<4;i++)await cap.settlementRead(async()=>{io++;},'T:unknown-settlement');
 }),/TRIAL_STOPPED/);assert.equal(io,5);assert.equal(s.get().spent,33);assert.equal(s.get().preparation.runtime.pending.entry,'wrapper');
 for(const action of ['close-deployment','remove-reader','revoke-token'])await s.control.withRuntime(binding,cap=>cap.cleanup(action,async()=>{}));assert.equal(s.get().spent,36);
});

test('complete approved allocation reaches exactly160 while keeping C2 and I17 independent',async()=>{
 const s=setup({decisionHash}),binding='d'.repeat(64);let io=0;
 await s.control.withPreparation(async cap=>{
  for(const bucket of ['A','B','C','D','E'])for(const operation of fixedOperations[bucket]){
   if(['restore-editor','read-restored-editor'].includes(operation))await cap.restoreOriginalEditor(operation,async()=>{io++;});
   else await cap.externalRead(async()=>{io++;},bucket+':'+operation);
  }
  for(const actor of ['caller','publisher'])for(let n=0;n<2;n++)await cap.externalRead(async()=>{io++;},'P:'+actor);
  assert.equal(s.get().spent,77);await cap.handoff({runtimeBinding:binding,expectedSpent:77});
 });
 await s.control.withRuntime(binding,async cap=>{
  for(const operation of fixedOperations.F.filter(v=>v.startsWith('wrapper-before.')))await cap.externalRead(async()=>{io++;},'F:'+operation);
  for(const actor of ['caller','publisher'])for(const [category,max] of [['pages',4],['setupReads',2],['identityReads',1],['quotaReads',1]])for(let n=0;n<max;n++)await cap.externalRead(async()=>{io++;},'G:wrapper-before:'+actor+':'+category);
  assert.equal(s.get().spent,108);await cap.dispatchCompatibility({entry:'wrapper',nativeMs:0,observedAt:s.options.now(),credentialExpiresAt:s.options.now()+3600000},async()=>{io++;});
  for(const actor of ['caller','publisher'])for(const [category,max] of [['pages',4],['setupReads',2],['identityReads',1],['quotaReads',1]])for(let n=0;n<max;n++)await cap.settlementRead(async()=>{io++;},'G:wrapper-after:'+actor+':'+category);
  for(const operation of fixedOperations.F.filter(v=>v.startsWith('wrapper-after.')))await cap.settlementRead(async()=>{io++;},'F:'+operation);
  for(let n=0;n<3;n++)await cap.settlementRead(async()=>{io++;},'T:unknown-settlement');
  await cap.accountNative({entry:'wrapper',totalMs:100,executionHash:'e'.repeat(64)});await cap.finishCompatibility('wrapper');assert.equal(s.get().spent,143);
 });
 await s.control.withRuntime(binding,async cap=>{for(const operation of fixedOperations.I)await cap.cleanup(operation,async()=>{io++;});});
 assert.equal(s.get().spent,160);assert.equal(io,135);assert.equal(s.get().preparation.cActions.length,2);assert.equal(s.get().preparation.iActions.length,17);assert.equal(s.get().preparation.events.length,135);
});
