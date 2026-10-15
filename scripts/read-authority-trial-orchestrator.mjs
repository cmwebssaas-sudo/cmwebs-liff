// Fixed compatibility/cleanup lifecycle for trusted preparation and IO adapters.
// Does not attest native gates, authorize credentials, or make a trial accepted.
import {AsyncLocalStorage} from 'node:async_hooks';
import {lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {createAuthorityPhaseControl} from './read-authority-phase-control.mjs';
import {canonicalAuthorityTrialBinding,createCanonicalAuthorityTrialDriver} from './read-authority-trial-driver.mjs';
import {verifyAuthorityTrialRollback,loadAuthorityTrialRollback} from './read-authority-trial-rollback.mjs';
export const AUTHORITY_TRIAL_CLEANUP_ACTIONS=Object.freeze(['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','restore-original-guard','verify-original-guard','restore-thin-guard','verify-thin-guard','remove-testing-user','verify-testing-user-removed','revoke-token','verify-token-revoked','read-original-editor','read-original-versions','read-original-deployments','read-original-project','read-original-triggers']);
const stop=()=>{throw Error('TRIAL_STOPPED');};
const denied=()=>{const p=Promise.reject(Error('TRIAL_STOPPED'));void p.catch(()=>{});return p;};
const only=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const driverKeys=['expected','expiresAt','now','readRelease','readNative','credential','signRequest','transport'];
export function createAuthorityTrialOrchestrator(input){
 try{
  if(!only(input,['control','prepare','restoreEditor','cleanup','rollback'])||typeof input.prepare!=='function'||typeof input.restoreEditor!=='function'||!only(input.cleanup,AUTHORITY_TRIAL_CLEANUP_ACTIONS)||!only(input.rollback,['path','sha256','controlOptions']))stop();
  const rollbackPin=Object.freeze({path:input.rollback.path,sha256:input.rollback.sha256}),recoveryOptions=Object.freeze({...input.rollback.controlOptions});
  if(typeof rollbackPin.path!=='string'||typeof rollbackPin.sha256!=='string'||!/^[a-f0-9]{64}$/.test(rollbackPin.sha256)||!recoveryOptions.epoch)stop();
  const prepare=input.prepare,restoreEditor=input.restoreEditor,cleanup=Object.fromEntries(AUTHORITY_TRIAL_CLEANUP_ACTIONS.map(action=>[action,input.cleanup[action]]));
  if(Object.values(cleanup).some(fn=>typeof fn!=='function'))stop();
  const phase=createAuthorityPhaseControl(input.control),origin=new AsyncLocalStorage();let currentOrigin=null,promise,binding=null,handoff='not-attempted',stopped=false,stage='ready',slot=null,restoreFailed=false,restoreAccepting=false;const restoreOperations=new Set();
  const entries=[],outcomes=[];let restoreOutcome='NOT_ATTEMPTED',recovery,artifactChecks=0,counterChecks=0,recoveryFailed=false;
  const checkArtifact=()=>{try{verifyAuthorityTrialRollback(rollbackPin);artifactChecks++;}catch(_){recoveryFailed=true;stop();}};
  const checkRecovery=async cap=>{
   try{checkArtifact();const view=await cap.inspectCleanup();if(view.epoch!==recoveryOptions.epoch)stop();
    // The permanent epoch registry permits only the original counter/binding.
    // Constructing the copied cleanup control validates that existing claim and
    // checkpoint without acquiring a second scope or attesting holder liveness.
    recovery.createCleanupControl(recoveryOptions);counterChecks++;
   }catch(_){recoveryFailed=true;stop();}
  };
  const assertDispatch=()=>{
   if(stopped)stop();
   // Presence/error is only a negative stop veto, never holder-liveness proof.
   try{lstatSync(resolve(recoveryOptions.path)+'.preparation-stop.json');stop();}catch(e){if(e.code!=='ENOENT')stop();}
   checkArtifact();try{recovery.createCleanupControl(recoveryOptions);counterChecks++;}catch(_){recoveryFailed=true;stop();}
  };
  // Adapters capture this one facade in preparation and intentionally reuse it
  // in cleanup. Async origin isolation is still supplied by the phase control.
  const admission=(kind,args)=>{
   // Each callback owns its own origin, including slots inside one canonical
   // cleanup scope. A prior callback cannot borrow the next slot's authority.
   if(!currentOrigin||origin.getStore()!==currentOrigin||!currentOrigin.accepting)return denied();
   const activeSlot=slot;
   if(stage==='preparation')return phase.capability[kind](...args);
   if(stage==='runtime'&&kind==='cleanup'&&args[0]==='revoke-token')return phase.capability.cleanup(...args);
   if(stage==='restore'&&kind==='restoreOriginalEditor'&&restoreAccepting){const p=phase.capability[kind](...args);restoreOperations.add(p);void p.catch(()=>{restoreFailed=true;});void p.then(()=>restoreOperations.delete(p),()=>restoreOperations.delete(p));return p;}
   if(stage!=='cleanup'||kind!=='cleanup'||!activeSlot||!activeSlot.accepting||args[0]!==activeSlot.action||activeSlot.operations.size||activeSlot.called){
    if(activeSlot)activeSlot.failed=true;else if(stage==='restore')restoreFailed=true;
    return denied();
   }
   activeSlot.called=true;const p=phase.capability.cleanup(...args);activeSlot.operations.add(p);void p.catch(()=>{activeSlot.failed=true;});void p.then(()=>activeSlot.operations.delete(p),()=>activeSlot.operations.delete(p));return p;
  };
  const adapterControl=Object.freeze({externalRead:(...args)=>admission('externalRead',args),restoreOriginalEditor:(...args)=>admission('restoreOriginalEditor',args),cleanup:(...args)=>admission('cleanup',args)});
  const report=()=>freeze({source:'fixed-authority-trial-orchestrator',state:stage,stopRequested:stopped,handoff,entries:[...entries],restore:restoreOutcome,cleanup:outcomes.map(v=>({...v})),rollbackRuntime:{manifestSha256:rollbackPin.sha256,artifactChecks,counterChecks,failed:recoveryFailed},trialAccepted:false,rollbackComplete:false});
  const requestStop=async()=>{stopped=true;try{return await phase.requestStop();}catch(_){stop();}};
  const clean=async()=>{
   const work=async()=>{
    stage='restore';restoreAccepting=true;const restoreOrigin={accepting:true};currentOrigin=restoreOrigin;try{await origin.run(restoreOrigin,()=>restoreEditor(Object.freeze({restoreOriginalEditor:adapterControl.restoreOriginalEditor})));}catch(_){restoreFailed=true;}finally{restoreOrigin.accepting=false;restoreAccepting=false;if(restoreOperations.size)restoreFailed=true;await Promise.allSettled([...restoreOperations]);}
    try{if(restoreFailed||(await phase.capability.inspectCleanup()).cActions.length!==2)stop();restoreOutcome='CALLBACK_RETURNED';}catch(_){restoreOutcome='FAILED';}
    stage='cleanup';
    for(const action of AUTHORITY_TRIAL_CLEANUP_ACTIONS){
     slot={action,called:false,accepting:true,failed:false,operations:new Set()};
     currentOrigin=slot;try{await origin.run(slot,()=>cleanup[action](Object.freeze({cleanup:adapterControl.cleanup})));}catch(_){slot.failed=true;}
     // Unawaited admitted C/I owns its original scope and must drain. It is
     // still an error, and never becomes a cleanup or rollback acceptance.
     slot.accepting=false;if(slot.operations.size)slot.failed=true;await Promise.allSettled([...slot.operations]);
     try{if(!(await phase.capability.inspectCleanup()).iActions.includes(action))slot.failed=true;}catch(_){slot.failed=true;}
     outcomes.push({action,outcome:slot.failed?'FAILED':'CALLBACK_RETURNED'});slot=null;currentOrigin=null;
    }
    if(restoreOutcome==='FAILED'||outcomes.some(v=>v.outcome==='FAILED'))stop();
   };
   if(handoff==='not-attempted')return phase.withPreparationCleanup(work);
   let entered=false;
   try{return await phase.withCleanup(binding,async()=>{entered=true;return work();});}
   catch(_){
    // An ACK can be lost after handoff persisted. Only canonical admission may
    // choose its existing phase; never inspect/repair/reseed a counter or replay
    // cleanup once the runtime callback was entered.
    if(handoff!=='unknown'||entered)stop();return await phase.withPreparationCleanup(work);
   }
  };
  const run=()=>{
   if(promise||stage!=='ready'||stopped)return denied();
   promise=(async()=>{
    let failed=false,driver;
    try{
     await phase.withPreparation(async cap=>{
      checkArtifact();try{recovery=await loadAuthorityTrialRollback(rollbackPin);}catch(_){recoveryFailed=true;stop();}await checkRecovery(cap);
      if(stopped)stop();stage='preparation';const preparationOrigin={accepting:true};currentOrigin=preparationOrigin;let prepared;try{prepared=await origin.run(preparationOrigin,()=>prepare(adapterControl));}finally{preparationOrigin.accepting=false;}
      if(stopped||!only(prepared,['driverOptions','expectedSpent'])||!only(prepared.driverOptions,driverKeys)||!Number.isSafeInteger(prepared.expectedSpent))stop();
      // Driver snapshots pins and callable references before committing the
      // exact canonical handoff. Preparation cannot dispatch or hand off itself.
      binding=canonicalAuthorityTrialBinding(prepared.driverOptions.expected);
      if(prepared.driverOptions.expected.trialEpoch!==recoveryOptions.epoch)stop();await checkRecovery(cap);
      driver=createCanonicalAuthorityTrialDriver({...prepared.driverOptions,control:phase,prepareDispatch:cap=>checkRecovery(cap),assertDispatch});
      handoff='unknown';await cap.handoff({runtimeBinding:binding,expectedSpent:prepared.expectedSpent});handoff='acknowledged';
     });
     stage='runtime';
     for(const entry of ['wrapper','qualified']){if(stopped)stop();checkArtifact();const runtimeOrigin={accepting:true};currentOrigin=runtimeOrigin;try{await origin.run(runtimeOrigin,()=>driver.run(entry));entries.push(entry);}finally{runtimeOrigin.accepting=false;currentOrigin=null;}}
    }catch(_){failed=true;}
    finally{
     stopped=true;try{await phase.requestStop();}catch(_){}
     try{await clean();}catch(_){failed=true;}
     currentOrigin=null;stage=failed?'stopped':'finished';
    }
    if(failed)stop();return report();
   })();void promise.catch(()=>{});return promise;
  };
  return Object.freeze({run,requestStop,report,stopAndDrain:async()=>{try{await requestStop();}catch(_){}if(promise)await promise.catch(()=>{});return Object.freeze({source:'fixed-authority-trial-holder',ownedRun:promise?'SETTLED':'NOT_STARTED',remoteExecutionSettled:false,trialAccepted:false,rollbackComplete:false});}});
 }catch(_){stop();}
}
