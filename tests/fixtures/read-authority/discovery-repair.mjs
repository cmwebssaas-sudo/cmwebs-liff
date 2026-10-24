import {connectionFixture,holder,fault} from './connection.mjs';
import {readFileSync} from 'node:fs';import {join} from 'node:path';import {hash,compact} from './rebalanced.mjs';
export {holder,fault};
export const repairDecision='6ab8677b514db6410a24c3f64e2c5213c7bda8874dd6b0b6925361d7fb205085';
export const methods={discovery:'inventory',binding:'claim',inventory:'inventory',claim:'claim',wait:'wait',snapshot:'snapshot'};
export async function repairStep(cap,s,stage,io=()=>({verified:true})){
 const id='loading-connection-n'+(s.discovery().connection.used+1)+'-'+stage,op={id,key:'N:preparation',actor:'publisher',target:'oauth-audience',operation:methods[stage],units:1,preparation:true};
 await cap.prepareReadonly({stage:id,operations:[op],remainingOrdinaryUi:36});return cap.browserRead(io,op);
}
export async function discoveryFixture(){
 const s=await connectionFixture();let receipt,drain;
 for(let n=1;n<=3;n++){
  const a=holder(s,receipt?{resume:receipt}:{});await a.withContinuation(async cap=>{
   const id='loading-connection-n'+n+'-discovery',op={id,key:'N:preparation',actor:'publisher',target:'oauth-audience',operation:'inventory',units:1,preparation:true};await cap.prepareReadonly({stage:id,operations:[op],remainingOrdinaryUi:36});
   await cap.browserRead(()=>{if(n<3)throw {...fault('discovery','OWNER_CONNECTION_REQUIRED'),errorClass:'UNKNOWN'};throw Error('SYNTHETIC_METADATA_FAILURE');},op).catch(e=>{if(n===3)throw e;});
  }).catch(e=>{if(n!==3||e.message!=='TRIAL_STOPPED')throw e;});
  if(n<3)receipt=a.preparationHandoff();else drain=await a.stopAndDrain();s.time+=1000;
 }
 const pin=path=>({path,sha256:hash(readFileSync(path))}),origin={},canonical={journal:s.path+'.simple-connection.json',claim:s.path+'.simple-connection-claim.json',stop:s.path+'.simple-connection-stop.json',registry:join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-rebalanced.json')};
 for(const[k,p]of Object.entries(canonical)){const t=join(s.home,'repair-origin-'+k+'.json');s.put(t,readFileSync(p));origin[k]=pin(t);}
 const result=join(s.home,'repair-origin-result.json');s.put(result,compact({status:'HARD_STOP',failurePhase:'DISCOVERY',observations:{},drain,trialAccepted:false}));origin.result=pin(result);
 const terminal=join(s.home,'repair-origin-terminal.json');s.put(terminal,compact({source:'post-return-readonly-connection-terminal-evidence',actualSpent:92,mainSpent:53,uiSpent:39,phase:'PREP',lifecycle:'HARD_STOP',connectionUsed:3,connectionMaximum:8,connectionFaults:2,faultMaximum:2,loadingUsed:9,loadingMaximum:14,reason:'discovery selector/metadata path stopped without safe classification',physicalDisconnectionEstablished:false,ownerConfirmationApplied:true,accountOrTabRead:false,pendingNull:true,allIoSettled:true,scopeClosed:true,lockReleased:true,noMutation:true,noRpc:true,noTrialClock:true,future36Preserved:true,allHistoricalPinsUnchanged:91,files:{...origin}}));origin.terminal=pin(terminal);
 const approval=join(s.home,'discovery92-approval.json');s.put(approval,compact({source:'direct-human-approval',decisionSha256:repairDecision,ownerAnswer:'同意單次修復，維持232',predecessorSha256:origin.journal.sha256,importedSpent:92,mainLimit:134,uiOrdinaryLimit:82,uiRecoveryLimit:16,combinedLimit:232,maximumPreparationPrimitives:9,maximumLoadingPrimitives:15,maximumNewPrimitives:6,qualifiedFailureLimit:2,recordedAt:s.time,executionStarted:false}));
 s.cfg.readonlyConnection.repair92={decisionHash:repairDecision,approval:pin(approval),origin};s.cfg.resume={discoveryRepair92:true};s.cfg.now=s.time;s.cfg.ownerNonce='1'.repeat(64);
 s.discovery=()=>JSON.parse(readFileSync(s.path+'.simple-discovery-repair.json'));s.retained92=Object.fromEntries(Object.entries(canonical).filter(([k])=>k!=='registry').map(([,p])=>[p,readFileSync(p)]));return s;
}
