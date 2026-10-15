import test from 'node:test';
import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,writeFileSync,readFileSync,lstatSync,unlinkSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {createAuthorityTrialPublication} from '../scripts/read-authority-trial-publication.mjs';
import {buildAuthorityTrialArtifacts} from '../scripts/build-read-authority-trial-entry.mjs';
const mod=await import('../scripts/read-authority-preparation-control.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-preparation-control.mjs'))return {};throw e;});
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-14T00:00:00Z'),epochs=new Set();
test.after(()=>{for(const epoch of epochs)for(const suffix of ['preparation','publication']){const p=join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(epoch))+'.'+suffix+'.json');try{const s=lstatSync(p),v=JSON.parse(readFileSync(p)).value;if(s.isFile()&&!s.isSymbolicLink()&&v.path.startsWith(join(tmpdir(),'cmwebs-preparation-')))unlinkSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}}});
function setup(patch={},spent=25){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-preparation-'));chmodSync(dir,0o700);const path=join(dir,'budget.json'),epoch='SYNTHETIC_PREPARATION_'+randomUUID(),approvalHash='a'.repeat(64),proposalHash='b'.repeat(64);let now=clock;
 const legacy={limit:160,spent,kind:'preparation-management-reads',proposal_sha256:proposalHash,approval_sha256:approvalHash,prior_limit:40};const raw=JSON.stringify(legacy);writeFileSync(path,raw,{mode:0o600});writeFileSync(path+'.lock','',{mode:0o600});
 const pauses=[],options={path,epoch,approvalHash,proposalHash,legacySha256:hash(raw),importedReads:spent,expiresAt:clock+21600000,now:()=>now,pause:async ms=>{pauses.push(ms);now+=ms;},...patch};epochs.add(epoch);assert.equal(typeof mod.createAuthorityPreparationControl,'function');const control=mod.createAuthorityPreparationControl(options);
 return {control,options,pauses,setNow:v=>{now=v;},get:()=>JSON.parse(readFileSync(path))};
}
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
