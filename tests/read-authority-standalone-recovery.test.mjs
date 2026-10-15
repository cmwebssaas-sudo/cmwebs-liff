import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,realpathSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {setup,clock} from './fixtures/read-authority/standalone-recovery.mjs';
import {operation} from './fixtures/read-authority/continuation-budget.mjs';
import {buildAuthorityContinuationRecovery} from '../scripts/read-authority-continuation-recovery.mjs';
test('standalone frozen recovery binds new expiry and cleans actual journals through original once-only C/I',()=>setup(async s=>{
 await s.owner.withContinuation(cap=>cap.externalRead(()=>{},operation('P:caller-bind')));
 const copied=await import(pathToFileURL(join(s.receipt.path,'scripts/read-authority-continuation-recovery.mjs')).href),api=await copied.loadAuthorityContinuationRecovery({path:s.receipt.path,sha256:s.receipt.sha256}),cleanup=api.createCleanup({owner:s.owner,originalOptions:s.originalOptions,now:s.now,pause:s.pause});
 assert.equal(typeof api.createStandaloneThin,'function');assert.equal(cleanup.withContinuation,undefined);
 await cleanup.withCleanup(async cap=>{
  const inspected=await cap.inspectCleanup();assert.equal(inspected.source,'canonical-preparation-ledger');assert.equal(inspected.spent,27);assert.deepEqual(inspected.iActions,[]);
  const thin=api.createStandaloneThin({...s.thinOptions,control:cap}),reader=api.createStandaloneReader({...s.readerOptions,control:cap});
  assert.deepEqual(Object.keys(thin),['status','stop','close','verifyClosed']);assert.deepEqual(Object.keys(reader),['status','remove','verifyRemoved']);
  assert.equal(cap.externalRead,undefined);assert.equal(thin.publish,undefined);assert.equal(reader.grant,undefined);
  assert.equal((await thin.close()).rollbackComplete,false);const closed=await thin.verifyClosed();assert.equal(closed.deploymentAbsent,true);assert.equal(closed.unknownCreatePreserved,true);await reader.remove();const removed=await reader.verifyRemoved();assert.equal(removed.readerAbsentAtReadback,true);assert.equal(removed.grantOutcomeKnown,false);assert.equal(removed.rollbackComplete,false);
  for(const action of ['restore-editor','read-restored-editor'])await cap.restoreOriginalEditor(action,()=>{});
 });
 assert.deepEqual(s.pauses,[60000]);assert.equal(s.calls.length,4);assert(s.calls.every(c=>c.time===clock+60000));assert.equal(s.get().spent,33);assert.equal(s.journal().spent,1);assert.equal(s.journal().events[0].outcome,'UNKNOWN');
 assert.deepEqual(readFileSync(join(s.oldCopy.path,'manifest.json')),s.oldBytes);
 await assert.rejects(s.cleanup().withCleanup(cap=>cap.cleanup('close-deployment',()=>assert.fail('DUPLICATE'))),/TRIAL_STOPPED/);
}));
test('standalone overlay cannot select the original canonical copy as its adapter source',()=>setup(async s=>{
 const originalCopy={path:s.oldCopy.path,sha256:s.oldCopy.sha256},path=join(s.home,'forbidden-recovery');
 assert.throws(()=>buildAuthorityContinuationRecovery({path,originalCopy,standalone:{copy:originalCopy,resources:s.resources}}),/TRIAL_STOPPED/);assert.equal(existsSync(path),false);
}));
test('standalone overlay cannot alias the original canonical directory through a different absolute path',()=>setup(async s=>{
 const originalCopy={path:s.oldCopy.path,sha256:s.oldCopy.sha256},copy={...originalCopy,path:realpathSync(originalCopy.path)};
 if(copy.path===originalCopy.path)copy.path=join(originalCopy.path,'..','original-copy');
 assert.throws(()=>buildAuthorityContinuationRecovery({path:join(s.home,'alias-recovery'),originalCopy,standalone:{copy,resources:s.resources}}),/TRIAL_STOPPED/);
}));
for(const [key,value] of [['expiresAt',clock+1],['scriptId','SYNTHETIC_WRONG_SCRIPT_ID'],['publisherHash','f'.repeat(64)],['originalSourceHash','e'.repeat(64)],['path','/tmp/forbidden-retarget.json']])test('standalone thin fixed '+key+' rejects before constructor/IO',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});await s.cleanup().withCleanup(async cap=>{assert.throws(()=>s.api.createStandaloneThin({...s.thinOptions,[key]:value,control:cap}),/TRIAL_STOPPED/);});assert.equal(s.calls.length,0);assert.equal(s.get().spent,27);
}));
for(const [key,value] of [['expiresAt',clock+1],['syntheticSheetId','SYNTHETIC_WRONG_SHEET_ID'],['originalSheetId','SYNTHETIC_OTHER_ORIGINAL'],['callerHash','f'.repeat(64)],['fixtureHash','b'.repeat(64)]])test('standalone reader fixed '+key+' rejects before constructor/IO',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});await s.cleanup().withCleanup(async cap=>{assert.throws(()=>s.api.createStandaloneReader({...s.readerOptions,[key]:value,control:cap}),/TRIAL_STOPPED/);});assert.equal(s.calls.length,0);
}));
for(const kind of ['thinRegistry','readerRegistry','thinPath','readerPath'])test('missing '+kind+' is never initialized by recovery',()=>setup(async s=>{
 const path=s[kind]??s.resources[kind];unlinkSync(path);await s.owner.withContinuation(async()=>{});
 await s.cleanup().withCleanup(async cap=>assert.throws(()=>kind.startsWith('thin')?s.api.createStandaloneThin({...s.thinOptions,control:cap}):s.api.createStandaloneReader({...s.readerOptions,control:cap}),/TRIAL_STOPPED/));assert.equal(existsSync(path),false);assert.equal(s.calls.length,0);
}));
for(const name of ['scripts/read-authority-trial-thin.mjs','scripts/read-authority-trial-reader.mjs','scripts/build-read-authority-trial-entry.mjs','apps-script/V2_READ_AUTHORIZATION.js'])test('standalone overlay '+name+' drift vetoes cleanup admission',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});s.put(join(s.overlay.path,name),'SOURCE_DRIFT');await assert.rejects(s.cleanup().withCleanup(()=>assert.fail('CALLBACK_ENTERED')),/TRIAL_STOPPED/);assert.equal(s.get().spent,27);
}));
for(const kind of ['journal','partial-stop'])test('corrupt standalone '+kind+' retains independent recovery after actual owner drain',()=>setup(async s=>{
 const path=s.path+(kind==='journal'?'.standalone.json':'.standalone-stop.json');
 if(kind==='journal'){await s.owner.withContinuation(cap=>cap.externalRead(()=>{},operation('P:caller-bind')));s.put(path,'CORRUPT');}
 else await assert.rejects(s.owner.withContinuation(async cap=>{await cap.externalRead(()=>{},operation('P:caller-bind'));s.put(path,'');}),/TRIAL_STOPPED/);
 const work=s.cleanup().withCleanup(async cap=>{const thin=s.api.createStandaloneThin({...s.thinOptions,control:cap});await thin.close();});void work.catch(()=>{});const timer=new AbortController();let done;
 try{done=await Promise.race([work.then(()=>true),delay(5000,false,{signal:timer.signal})]);}finally{timer.abort();}assert.equal(done,true);assert.equal(readFileSync(path,'utf8'),kind==='journal'?'CORRUPT':'');assert.equal(s.get().spent,28);assert.equal(s.calls.length,1);assert.deepEqual(s.pauses,[60000]);
}));
test('standalone owner entered IO must settle before full cooldown and cleanup',()=>setup(async s=>{
 let enter,release;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;}),scope=s.owner.withContinuation(cap=>cap.externalRead(async()=>{enter();await gate;},operation('P:caller-bind')));void scope.catch(()=>{});await entered;
 const work=s.cleanup().withCleanup(cap=>s.api.createStandaloneThin({...s.thinOptions,control:cap}).close());void work.catch(()=>{});await delay(30);assert.deepEqual(s.pauses,[]);assert.equal(s.calls.length,0);release();await assert.rejects(scope,/TRIAL_STOPPED/);await work;assert.deepEqual(s.pauses,[60000]);assert.equal(s.calls.length,1);
}));
test('overlay drift during an admitted cleanup vetoes the next original debit and poisons completion',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});let next=0;
 await assert.rejects(s.cleanup().withCleanup(async cap=>{
  await cap.cleanup('close-deployment',()=>s.put(join(s.overlay.path,'scripts/read-authority-trial-thin.mjs'),'SOURCE_DRIFT'));
  await assert.rejects(cap.cleanup('remove-reader',()=>{next++;}),/TRIAL_STOPPED/);
 }),/TRIAL_STOPPED/);
 assert.equal(next,0);assert.equal(s.get().spent,28);assert.deepEqual(s.get().preparation.iActions,['close-deployment']);assert.equal(s.get().preparation.events.at(-1).outcome,'UNKNOWN');
}));
test('unknown standalone close is never retried and a later absence readback preserves UNKNOWN',()=>setup(async s=>{
 await s.owner.withContinuation(cap=>cap.externalRead(()=>{},operation('P:caller-bind')));let deletes=0;
 s.thinOptions.fetcher=async(url,init)=>{assert.equal(init.method,'DELETE');deletes++;throw Error('SYNTHETIC_UNKNOWN_DELETE');};
 await assert.rejects(s.cleanup().withCleanup(cap=>s.api.createStandaloneThin({...s.thinOptions,control:cap}).close()),/TRIAL_STOPPED/);
 await s.cleanup().withCleanup(async cap=>{
  const thin=s.api.createStandaloneThin({...s.thinOptions,fetcher:async()=>new Response(JSON.stringify({deployments:[]})),control:cap});
  await assert.rejects(thin.close(),/TRIAL_STOPPED/);const receipt=await thin.verifyClosed();assert.equal(receipt.unknownCreatePreserved,true);assert.equal(receipt.unknownClosePreserved,true);assert.equal(receipt.rollbackComplete,false);
 });
 assert.equal(deletes,1);assert.equal(s.get().spent,29);assert.equal(s.journal().spent,1);assert.deepEqual(s.get().preparation.iActions,['close-deployment','verify-closed-deployment']);
}));
for(const [method,action] of [['cleanup','close-deployment'],['restoreOriginalEditor','restore-editor']])test(method+' rechecks overlay at actual IO entry after asynchronous original admission',()=>setup(async s=>{
 await s.owner.withContinuation(async()=>{});let entered=0;
 await assert.rejects(s.cleanup().withCleanup(async cap=>{
  const admitted=cap[method](action,()=>{entered++;});void admitted.catch(()=>{});
  s.put(join(s.overlay.path,'scripts/read-authority-trial-thin.mjs'),'SOURCE_DRIFT_AFTER_SCHEDULING');
  await assert.rejects(admitted,/TRIAL_STOPPED/);
 }),/TRIAL_STOPPED/);
 assert.equal(entered,0);assert.equal(s.get().spent,28);assert.equal(s.get().preparation.events.at(-1).outcome,'UNKNOWN');
}));
