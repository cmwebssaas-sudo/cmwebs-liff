import {loadingFixture,holder,loadingOp} from './loading.mjs';
import {readFileSync} from 'node:fs';import {join,resolve} from 'node:path';
import {hash,compact} from './rebalanced.mjs';
export {holder,loadingOp} from './loading.mjs';
export const accountDecision='8ddb213aa8a504c2cf2c2e5042d3ee7f212d90cffd555e140164f6ddcf25063f';
export async function accountFixture(){
 const s=await loadingFixture(),a=holder(s);await a.withContinuation(async cap=>{
  const rows=[['inventory','thin-settings'],['claim','thin-settings'],['snapshot','thin-settings'],['navigate','oauth-audience'],['snapshot','oauth-audience']];
  for(let i=0;i<rows.length;i++){const [method,target]=rows[i],op=loadingOp('h4-n'+(i+1)+'-'+target+'-'+method,method,target);await cap.prepareReadonly({stage:op.id,operations:[op],remainingOrdinaryUi:44-i});await cap.browserRead(()=>{if(i===4)throw Error('ACCOUNT_LABEL_MISSING');return {verified:true};},op);}
 }).catch(e=>{if(e.message!=='TRIAL_STOPPED')throw e;});await a.stopAndDrain();
 const suffix='.simple-rebalanced',pin=path=>({path,sha256:hash(readFileSync(path))}),origin={},canonical={journal:s.path+suffix+'.json',claim:s.path+suffix+'-claim.json',registry:join(s.root,hash(JSON.stringify(s.cfg.epoch))+suffix+'.json'),stop:s.path+suffix+'-stop.json'};
 for(const[k,p]of Object.entries(canonical)){const target=join(s.home,'account-origin-'+k+'.json');s.put(target,readFileSync(p));origin[k]=pin(target);}
 const safe={source:'rebalanced-readonly-grounding',urlMatched:true,accountVerified:false,fieldsRead:false,ready:'UNREAD',section:'UNREAD',reason:'ACCOUNT_MISMATCH',phase:'ACCOUNT_SCAN',cryptoAvailable:false,encoderAvailable:false,controls:[]};
 const result=join(s.home,'account-origin-result.json');s.put(result,compact({status:'HARD_STOP',failurePhase:'RESULT_POLICY_REJECTED',observations:{'loading-h4-n5-oauth-audience-snapshot':safe},trialAccepted:false}));origin.result=pin(result);
 const terminal=join(s.home,'account-origin-terminal.json');s.put(terminal,compact({source:'post-return-loading-terminal-evidence',actualAwaitedRunReturned:true,runStatus:'HARD_STOP',combinedSpent:88,mainSpent:53,uiSpent:35,loadingUsed:5,eventCount:35,lifecycle:'HARD_STOP',phase:'PREP',latestCheckpointMatches:true,allIoSettled:true,pendingNull:true,noMutation:true,noRpc:true,noTrialClock:true,lockReleased:true,exactHolderChildAbsent:true,scopeClosed:true,ordinaryScopeClosed:true,stopAcknowledged:true,files:{...Object.fromEntries(Object.entries(origin).map(([k,v])=>[k==='result'?'actual-result':k,v]))},sourceHead:'f'.repeat(40),grounded:['thin-settings'],currentTarget:'oauth-audience',resumeAuthorized:false}));origin.terminal=pin(terminal);
 s.time+=1000;const approval=join(s.home,'account-approval.json');s.put(approval,compact({source:'direct-human-approval',decisionSha256:accountDecision,ownerAnswer:'同意本次4步接續，維持232',predecessorSha256:origin.journal.sha256,importedSpent:88,combinedLimit:232,maximumAdditionalPrimitives:4,recordedAt:s.time,executionStarted:false}));
 s.cfg.readonlyAccountLoad={decisionHash:accountDecision,approval:pin(approval),origin};s.cfg.resume={incident:true};s.cfg.now=s.time;s.cfg.ownerNonce='e'.repeat(64);
 try{s.cfg.sources.push(pin(resolve('scripts/read-authority-account-load-budget.py')));}catch{}
 s.account=()=>JSON.parse(readFileSync(s.path+'.simple-account-load.json'));s.retained88=Object.fromEntries(Object.entries(canonical).filter(([k])=>k!=='registry').map(([,p])=>[p,readFileSync(p)]));return s;
}
