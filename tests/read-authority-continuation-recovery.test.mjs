import test from 'node:test';
import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,unlinkSync,chmodSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,clock,operation,hash,compact,wrapped} from './fixtures/read-authority/continuation-budget.mjs';
import {normalizeAuthorityNativeTargets} from '../scripts/read-authority-trial-budget-plan.mjs';
import {createAuthorityContinuationControl} from '../scripts/read-authority-continuation-control.mjs';
import {buildAuthorityTrialRollback} from '../scripts/read-authority-trial-rollback.mjs';
const mod=await import('../scripts/read-authority-continuation-recovery.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const nativeTargets=()=>normalizeAuthorityNativeTargets({'original-settings':'https://script.google.com/home/projects/SYNTHETIC_ORIGINAL_SCRIPT_ID/settings','original-triggers':'https://script.google.com/home/projects/SYNTHETIC_ORIGINAL_SCRIPT_ID/triggers','thin-settings':'https://script.google.com/home/projects/SYNTHETIC_THIN_SCRIPT_ID/settings','oauth-audience':'https://console.cloud.google.com/auth/audience?project=synthetic-c3-trial','oauth-client':'https://console.cloud.google.com/auth/clients/create?project=synthetic-c3-trial','caller-executions':'https://script.google.com/home/executions','publisher-executions':'https://script.google.com/home/executions'});
async function setup(fn){
 const s=fixture(),beforeHome=process.env.HOME,originalSpawn=cp.spawn;let oldBudgetPath=null;process.env.HOME=s.home;
 // The unchanged old launcher omits HOME from its explicit env. Keep its real
 // Python child on this disposable home; no file/lock/result is mocked.
 cp.spawn=(cmd,args,opts)=>originalSpawn(cmd,args,oldBudgetPath&&cmd==='python3'&&args?.includes('--inherited-lock')&&realpathSync(args[0])===oldBudgetPath?{...opts,env:{...opts.env,HOME:s.home}}:opts);syncBuiltinESMExports();
 try{
  let time=clock;const pauses=[],options={...s.cfg.original,nativeTargets:nativeTargets()};delete options.binding;delete options.now;
  const binding=hash(JSON.stringify(options));s.cfg.original={...options,binding,now:time};const b=s.get();b.preparation.binding=binding;
  s.put(s.path,compact(b));s.put(s.registry,wrapped({path:s.path,binding,checkpoint:b}));for(const name of ['preparation-claim','preparation-stop','preparation-owner-stop'])s.put(s.path+'.'+name+'.json',wrapped({path:s.path,epoch:options.epoch,binding}));
  s.put(s.cfg.baseline.path,readFileSync(s.path));s.cfg.baseline.sha256=hash(readFileSync(s.path));
  const {now,ownerNonce,...config}=s.cfg,owner=createAuthorityContinuationControl({config,now:()=>time,pause:async ms=>{time+=ms;},guard:()=>{}});
  const oldCopy=buildAuthorityTrialRollback({path:join(s.home,'original-copy')}),oldBytes=readFileSync(join(oldCopy.path,'manifest.json'));oldBudgetPath=realpathSync(join(oldCopy.path,'scripts/read-authority-preparation-budget.py'));
  assert.equal(typeof mod.buildAuthorityContinuationRecovery,'function');const receipt=mod.buildAuthorityContinuationRecovery({path:join(s.home,'continuation-recovery'),originalCopy:{path:oldCopy.path,sha256:oldCopy.sha256}});
  const api=await mod.loadAuthorityContinuationRecovery({path:receipt.path,sha256:receipt.sha256});
  const nowFn=()=>time,pause=async ms=>{pauses.push(ms);time+=ms;};
  await fn({...s,owner,oldCopy,oldBytes,receipt,api,options,pauses,now:nowFn,pause,setTime:v=>{time=v;}});
 }finally{if(beforeHome===undefined)delete process.env.HOME;else process.env.HOME=beforeHome;cp.spawn=originalSpawn;syncBuiltinESMExports();}
}
const cleanup=s=>s.api.createCleanup({owner:s.owner,originalOptions:s.options,now:s.now,pause:s.pause});
const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('independent copied graph preserves old copy, uses actual retained owner and waits full60s before globally-once C/I',()=>setup(async s=>{
 await s.owner.withContinuation(cap=>cap.externalRead(()=>{},operation('P:caller-bind')));
 const control=cleanup(s);assert.equal(control.withContinuation,undefined);assert.equal(control.withRuntimeCleanup,undefined);
 let io=0;await control.withCleanup(async cap=>{assert.equal(cap.externalRead,undefined);assert.equal(cap.settlementRead,undefined);assert.equal(cap.accountNative,undefined);assert.equal(cap.dispatchCompatibility,undefined);
  assert.equal(s.now(),clock+60000);for(const action of ['restore-editor','read-restored-editor'])await cap.restoreOriginalEditor(action,()=>{io++;});await cap.cleanup('close-deployment',()=>{io++;});
 });
 assert.equal(io,3);assert.deepEqual(s.pauses,[60000]);assert.equal(s.get().spent,30);assert.equal(s.journal().spent,1);assert.equal(s.journal().events[0].outcome,'UNKNOWN');assert.deepEqual(readFileSync(join(s.oldCopy.path,'manifest.json')),s.oldBytes);
 await assert.rejects(control.withCleanup(cap=>cap.cleanup('close-deployment',()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,3);assert.deepEqual(s.pauses,[60000,60000]);
}));
test('new journal corruption cannot remove original independent cleanup authority',()=>setup(async s=>{
 await s.owner.withContinuation(cap=>cap.externalRead(()=>{},operation('P:caller-bind')));s.put(s.path+'.continuation.json','CORRUPT_NEW_JOURNAL');
 await cleanup(s).withCleanup(cap=>cap.cleanup('revoke-token',()=>{}));assert.equal(s.get().spent,28);assert.equal(readFileSync(s.path+'.continuation.json','utf8'),'CORRUPT_NEW_JOURNAL');
}));
test('partial new STOP retains its bytes and permits copied recovery after actual drain plus60s',()=>setup(async s=>{
 const marker=s.path+'.continuation-stop.json';
 await assert.rejects(s.owner.withContinuation(async cap=>{await cap.externalRead(()=>{},operation('P:caller-bind'));s.put(marker,'');}),/TRIAL_STOPPED/);
 const work=cleanup(s).withCleanup(cap=>cap.cleanup('revoke-token',()=>{})),watchdog=new AbortController();void work.catch(()=>{});let result;
 try{result=await Promise.race([work.then(()=>true),delay(5000,false,{signal:watchdog.signal})]);}
 finally{watchdog.abort();if(!result){unlinkSync(marker);await s.owner.requestStop();await work;}}
 assert.equal(result,true);assert.deepEqual(s.pauses,[60000]);assert.equal(readFileSync(marker).length,0);assert.equal(s.get().spent,28);assert.equal(s.journal().spent,1);
}));
test('capture must drain actually entered IO before the cooldown starts',()=>setup(async s=>{
 const entered=defer(),release=defer(),scope=s.owner.withContinuation(cap=>cap.externalRead(async()=>{entered.resolve();await release.promise;},operation('P:caller-bind')));void scope.catch(()=>{});await entered.promise;
 const recovery=cleanup(s).withCleanup(cap=>cap.cleanup('close-deployment',()=>{}));void recovery.catch(()=>{});
 await delay(30);assert.deepEqual(s.pauses,[]);assert.equal(s.get().spent,27);release.resolve();await assert.rejects(scope,/TRIAL_STOPPED/);await recovery;assert.deepEqual(s.pauses,[60000]);assert.equal(s.get().spent,28);
}));
test('an unstarted owner NONE_CAPTURED is rejected without waiting or creating old claims',()=>setup(async s=>{
 await assert.rejects(cleanup(s).withCleanup(()=>assert.fail('CALLBACK_ENTERED')),/TRIAL_STOPPED/);assert.deepEqual(s.pauses,[]);assert.equal(s.get().spent,27);assert.equal(existsSync(s.path+'.continuation-claim.json'),false);
}));
test('a pause that does not advance elapsed time cannot admit a cleanup callback',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});const control=s.api.createCleanup({owner:s.owner,originalOptions:s.options,now:s.now,pause:async()=>{}});let io=0;
 await assert.rejects(control.withCleanup(cap=>cap.cleanup('close-deployment',()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,27);
}));
for(const kind of ['counter','claim','checkpoint','binding'])test('old canonical '+kind+' mismatch denies independent cleanup without reconstruction',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});const control=cleanup(s);if(kind==='counter'){const b=s.get();b.spent=26;s.put(s.path,compact(b));}if(kind==='claim')unlinkSync(s.path+'.preparation-claim.json');if(kind==='checkpoint')s.put(s.registry,wrapped({path:s.path,binding:s.cfg.original.binding,checkpoint:{}}));if(kind==='binding'){const b=s.get();b.preparation.binding='f'.repeat(64);s.put(s.path,compact(b));s.put(s.registry,wrapped({path:s.path,binding:'f'.repeat(64),checkpoint:b}));}
 let io=0;await assert.rejects(control.withCleanup(cap=>cap.cleanup('close-deployment',()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,0);if(kind==='claim')assert.equal(existsSync(s.path+'.preparation-claim.json'),false);
}));
for(const kind of ['new-source','old-source','extra-file','source-mode'])test('fixed recovery graph rejects '+kind+' drift',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});const control=cleanup(s);if(kind==='new-source')s.put(join(s.receipt.path,'scripts/read-authority-continuation-recovery.mjs'),'SOURCE_DRIFT');if(kind==='old-source')s.put(join(s.oldCopy.path,'scripts/read-authority-preparation-budget.py'),'SOURCE_DRIFT');if(kind==='extra-file')s.put(join(s.receipt.path,'extra.json'),'{}');if(kind==='source-mode')chmodSync(join(s.receipt.path,'scripts/read-authority-trial-budget-plan.mjs'),0o644);
 await assert.rejects(control.withCleanup(()=>assert.fail('CALLBACK_ENTERED')),/TRIAL_STOPPED/);assert.equal(s.get().spent,27);
}));
test('copied recovery bootstrap works without importing mutable live repository modules',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});const copied=await import(pathToFileURL(join(s.receipt.path,'scripts/read-authority-continuation-recovery.mjs')).href),api=await copied.loadAuthorityContinuationRecovery({path:s.receipt.path,sha256:s.receipt.sha256});
 const control=api.createCleanup({owner:s.owner,originalOptions:s.options,now:s.now,pause:s.pause});assert.equal(api.createCleanupControl,undefined);assert.equal(api.loadAuthorityTrialRollback,undefined);await control.withCleanup(cap=>cap.cleanup('remove-testing-user',()=>{}));assert.equal(s.get().spent,28);
}));
test('caught new graph guard failure still fails the cleanup scope',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});await assert.rejects(cleanup(s).withCleanup(async cap=>{s.put(join(s.receipt.path,'scripts/read-authority-continuation-recovery.mjs'),'SOURCE_DRIFT');await assert.rejects(cap.cleanup('close-deployment',()=>{}),/TRIAL_STOPPED/);}),/TRIAL_STOPPED/);assert.equal(s.get().spent,27);
}));
test('source drift during entered cleanup cannot return false success from the scope',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});await assert.rejects(cleanup(s).withCleanup(async cap=>{await cap.cleanup('close-deployment',()=>{s.put(join(s.receipt.path,'scripts/read-authority-continuation-recovery.mjs'),'SOURCE_DRIFT');});return 'FALSE_SUCCESS';}),/TRIAL_STOPPED/);assert.equal(s.get().spent,28);assert.equal(s.get().preparation.events.at(-1).outcome,'UNKNOWN');
}));
test('only cooled-down scoped capability can reconstruct existing reader cleanup; factory never exposes grant',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});const callerEmail='caller@example.invalid',publisherEmail='publisher@example.invalid',callerHash=hash(callerEmail),publisherHash=hash(publisherEmail),fixtureHash='a'.repeat(64),originalSheetId='SYNTHETIC_ORIGINAL_SHEET_ID',syntheticSheetId='SYNTHETIC_READER_SHEET_ID',path=join(s.home,'reader.json'),epoch=s.options.epoch,expiresAt=s.options.expiresAt;
 const creation={source:'fixed-trial-import-readback',epoch,syntheticSheetId,publisherHash,fixtureHash},binding=hash(JSON.stringify({epoch,originalSheetId,syntheticSheetId,callerHash,publisherHash,fixtureHash,expiresAt,creation}));
 const putPlain=(p,value)=>s.put(p,JSON.stringify({value,sha256:hash(JSON.stringify(value))}));
 putPlain(join(s.root,hash(JSON.stringify(epoch))+'.reader.json'),{path,binding});putPlain(path,{version:1,binding,state:'failed',permissionId:'SYNTHETIC_CALLER_ID',ownerId:'SYNTHETIC_OWNER_ID',grantStarted:true,grantAttempted:true,grantOutcome:'UNKNOWN',removeAttempted:false,removeOutcome:'NOT_STARTED',verifyAttempted:false,verifyOutcome:'NOT_STARTED',stopRequested:true});
 const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(v=>'https://www.googleapis.com/auth/'+v);let deletes=0,gets=0,leaked;
 const options={path,epoch,originalSheetId,syntheticSheetId,callerEmail,callerHash,publisherHash,fixtureHash,expiresAt,creationReceipt:creation,metadata:{read:()=>assert.fail('ORDINARY_READ')},credential:()=>({accessToken:'SYNTHETIC_RECOVERY',accountHash:publisherHash,scopes,expiresAt:s.now()+3600000,refreshTokenPresent:true}),fetcher:async(url,init)=>{if(init.method==='DELETE'){deletes++;return {status:204,body:null,url,redirected:false};}gets++;return new Response(JSON.stringify({permissions:[{id:'SYNTHETIC_OWNER_ID',type:'user',role:'owner',emailAddress:publisherEmail}]}));},now:s.now};
 assert.throws(()=>s.api.createReader({...options,control:{}}),/TRIAL_STOPPED/);
 await cleanup(s).withCleanup(async cap=>{const reader=s.api.createReader({...options,control:cap});assert.equal(reader.grant,undefined);leaked=reader;await reader.remove();await reader.verifyRemoved();assert.throws(()=>s.api.createReader({...options,path:join(s.home,'fresh-reader.json'),control:cap}),/TRIAL_STOPPED/);});
 assert.equal(deletes,1);assert.equal(gets,1);assert.equal(s.get().spent,29);assert.deepEqual(s.get().preparation.iActions,['remove-reader','verify-reader-removed']);assert.equal(existsSync(join(s.home,'fresh-reader.json')),false);assert.throws(()=>leaked.status(),/TRIAL_STOPPED/);
}));
test('callback failures expose only TRIAL_STOPPED and never log private error content',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});const originalWrite=process.stderr.write;let output='';try{process.stderr.write=function(chunk,...args){output+=String(chunk);return originalWrite.call(this,chunk,...args);};await assert.rejects(cleanup(s).withCleanup(async()=>{throw Error('PRIVATE_SENTINEL_CREDENTIAL');}),/^Error: TRIAL_STOPPED$/);}finally{process.stderr.write=originalWrite;}assert.equal(output.includes('PRIVATE_SENTINEL_CREDENTIAL'),false);
}));
test('separate recovery facades share the original flock and cannot overlap cleanup callbacks',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});const entered=defer(),release=defer(),first=cleanup(s).withCleanup(cap=>cap.cleanup('close-deployment',async()=>{entered.resolve();await release.promise;}));void first.catch(()=>{});await entered.promise;
 let second=0;try{await assert.rejects(cleanup(s).withCleanup(cap=>cap.cleanup('remove-reader',()=>{second++;})),/TRIAL_STOPPED/);assert.equal(second,0);assert.equal(s.get().spent,28);}finally{release.resolve();await first;}
 assert.deepEqual(s.get().preparation.iActions,['close-deployment']);
}));
