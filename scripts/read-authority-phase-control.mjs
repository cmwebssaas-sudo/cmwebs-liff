// Trusted orchestration adapter, not an adversarial callback sandbox. Reuses one
// canonical controller, counter, epoch and flock. No IO at construction.
import {AsyncLocalStorage} from 'node:async_hooks';
const stop=()=>{throw Error('TRIAL_STOPPED');};
const denied=()=>{const p=Promise.reject(Error('TRIAL_STOPPED'));void p.catch(()=>{});return p;};
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const phases={'preparation-cleanup':new Set(['restoreOriginalEditor','cleanup','inspectCleanup']),preparation:new Set(['externalRead','nativeRead','completeNativePreparation','restoreOriginalEditor','cleanup','inspectCleanup','handoff']),runtime:new Set(['externalRead','nativeRead','restoreOriginalEditor','cleanup','inspectCleanup','inspectRuntime','dispatchCompatibility','settlementRead','accountNative','finishCompatibility']),cleanup:new Set(['restoreOriginalEditor','cleanup','inspectCleanup','inspectRuntime','settlementRead','accountNative'])};
const independent=new Set(['restoreOriginalEditor','cleanup','inspectCleanup','inspectRuntime','settlementRead','accountNative']);
const ioIndex={externalRead:0,nativeRead:1,restoreOriginalEditor:1,cleanup:1,dispatchCompatibility:1,settlementRead:0};
export function createAuthorityPhaseControl(control){
 try{
  const prep=control?.withPreparation,runtime=control?.withRuntime,requestStop=control?.requestStop;
  if([prep,runtime,requestStop].some(f=>typeof f!=='function'))stop();
  const origin=new AsyncLocalStorage();let current=null;
  const invoke=(name,args)=>{
   const g=origin.getStore();
   // Old async work is never rebound to a newer activation, even if the same
   // adapter object is intentionally reused by the trusted orchestrator.
   if(!g||g!==current||!g.active||!g.accepting)return denied();
   const fail=()=>{g.failed=true;return denied();};
   // Only the original runtime's post-RPC native plan may settle an UNKNOWN.
   // Canonical S admission still requires its pending entry, day and deadline.
   const settlement=independent.has(name)||(g.phase==='runtime'&&name==='nativeRead'&&args[0]?.stage==='wrapper-after');
   if(!phases[g.phase].has(name)||typeof g.cap[name]!=='function'||(g.failed&&!settlement))return fail();
   const index=ioIndex[name],copy=[...args];
   if(index!==undefined){
    const io=copy[index];if(typeof io!=='function')return fail();
    copy[index]=(...values)=>{
     if(origin.getStore()!==g||g!==current||!g.active||(!settlement&&(!g.accepting||g.failed)))stop();
     // C/I and settlement operations already owned before callback exit must
     // drain under this scope. New operations are denied by accepting=false.
     return io(...values);
    };
   }
   let raw;try{raw=g.cap[name](...copy);}catch(_){return fail();}
   const p=Promise.resolve(raw).catch(()=>{g.failed=true;stop();});g.operations.add(p);
   void p.then(()=>g.operations.delete(p),()=>g.operations.delete(p));void p.catch(()=>{});return p;
  };
  const capability=Object.freeze({get decisionHash(){
   const g=origin.getStore();if(!g||g!==current||!g.active||!g.accepting)stop();return g.cap.decisionHash??null;
  },...Object.fromEntries([...new Set(Object.values(phases).flatMap(s=>[...s]))].map(name=>[name,(...args)=>invoke(name,args)]))});
  const activate=async(phase,binding,callback)=>{
   const previous=origin.getStore();
   if(previous&&previous!==current)stop();
   if(current){current.failed=true;stop();}
   if(typeof callback!=='function'||(!phase.startsWith('preparation')&&!digest(binding)))stop();
   const g={phase,cap:null,active:true,accepting:false,failed:false,operations:new Set()};current=g;
   try{
    // Stop ACK is best effort; an ambiguous marker stays a negative veto.
    // Canonical checkpoint validation and exclusive flock remain mandatory.
    if(phase.endsWith('cleanup'))try{await requestStop();}catch(_){}
    const scoped=async cap=>origin.run(g,async()=>{
     g.cap=cap;g.accepting=true;let value;
     try{value=await callback(capability);}catch(_){g.failed=true;}
     finally{
      g.accepting=false;if(g.operations.size)g.failed=true;
      await Promise.allSettled([...g.operations]);g.active=false;
     }
     if(g.failed)stop();return value;
    });
    return phase.startsWith('preparation')?await prep(scoped):await runtime(binding,scoped);
   }catch(_){stop();}
   finally{g.accepting=false;g.active=false;if(current===g)current=null;}
  };
  return Object.freeze({capability,withPreparation:callback=>activate('preparation',null,callback),withRuntime:(binding,callback)=>activate('runtime',binding,callback),withCleanup:(binding,callback)=>activate('cleanup',binding,callback),withPreparationCleanup:callback=>activate('preparation-cleanup',null,callback),requestStop});
 }catch(_){stop();}
}
