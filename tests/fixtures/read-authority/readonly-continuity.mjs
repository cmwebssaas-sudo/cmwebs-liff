import {debugFixture,session,ui,good,debit,settle,hash,compact} from './simple-readonly-debug.mjs';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
export {session,ui,good,debit,settle,hash,compact};
export const continuityDecision='5d9a800f4e7f7982ae01c5326e83187d7f0533f9e0a63cfb123b0d283e006e52';
export async function continuityFixture(){
 const s=await debugFixture(),h=session(s);let at=s.time;
 try{good(await h.ready);for(let n=69;n<=72;n++){const op=ui(n,{target:n<71?'original-triggers':'original-settings',...(n===71?{key:'N:navigation',preparation:false,operation:'navigate'}:{})});if(n===71){/* Legacy navigation is only admissible after mapping; use the prior approved PREP alias in the synthetic history. */op.key='N:preparation';op.preparation=true;}at=(await debit(h,op,at)).lastAt;good(await settle(h,op.id,n!==72,at));}}finally{await h.close();}
 const pin=path=>({path,sha256:hash(readFileSync(path))}),approval=join(s.home,'continuity-approval.json'),drain=join(s.home,'drain72.json');at+=1000;
 s.put(drain,compact({source:'simple-authority-holder',stopRequested:true,stopAcknowledged:true,ordinaryScopeClosed:true,ownedScope:{state:'SETTLED'},trialAccepted:false,remoteExecutionSettled:false,rollbackComplete:false}));
 const prior=s.path+'.simple-readonly-debug.json';
 s.put(approval,compact({source:'direct-human-approval',decisionSha256:continuityDecision,ownerAnswer:'同意統一修訂，維持232',predecessorSha256:pin(prior).sha256,importedSpent:72,importedMainSpent:53,importedUiSpent:19,mainLimit:160,uiOrdinaryLimit:56,uiRecoveryLimit:16,combinedLimit:232,qualifiedFailureLimit:2,recordedAt:at,executionStarted:false}));
 s.cfg.readonlyContinuity={decisionHash:continuityDecision,approval:pin(approval),journal:pin(prior),claim:pin(s.path+'.simple-readonly-debug-claim.json'),stop:pin(s.path+'.simple-readonly-debug-stop.json'),registry:pin(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-readonly-debug.json')),drain:pin(drain)};
 // New source does not exist during the RED run. Pin it only once implemented.
 try{s.cfg.sources.push(pin(resolve('scripts/read-authority-readonly-continuity.py')));}catch{}
 s.cfg.now=at;s.time=at;s.continuity=()=>JSON.parse(readFileSync(s.path+'.simple-readonly-continuity.json'));
 s.retained=Object.fromEntries(['journal','claim','stop','registry','drain'].map(k=>[s.cfg.readonlyContinuity[k].path,readFileSync(s.cfg.readonlyContinuity[k].path)]));return s;
}
export async function prepare(h,operations,now,reserve=1,stage='settings-diagnostic') {return h.send({op:'preparation-ready',stage,operations,remainingOrdinaryUi:reserve,now});}
export const safeProof=(kind='TECHNICAL',phase='DECODE')=>({kind,phase,targetVerified:true,accountVerified:true,bindingVerified:true,pureRead:true,terminal:true,fieldsRead:false});
