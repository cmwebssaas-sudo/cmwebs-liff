import {fixture,session,ui,good,debit,settle,hash,compact,wrapped,clock} from './simple-budget.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export {session,ui,good,debit,settle,hash,compact,wrapped};
export const debugDecision='e0342182ffe003392fe00a0f3a516d3b1605dd9c52cecd35ad3a690bc4db1390';
const continuationDecision='fc822ca3296a4f66195c02e9db1088ca6b95eb197bd440a27f417069e9b7cdd7',repairDecision='03310835216ab80ff344fe51264466bb7c7cc333d3e7df499b28ce9eb85e290f',windowDecision='abb1747f4eae5ba0cd98c200649f700a4cd6de97b215b14b671f63eee0eb25a3';
export async function debugFixture(){
 const s=fixture(),pin=path=>({path,sha256:hash(readFileSync(path))});let h=session(s),at=clock;
 try{good(await h.ready);for(let n=1;n<=12;n++){at=(await debit(h,ui(n),at)).lastAt;good(await settle(h,'ui-'+n,n!==3&&n!==5,at));}await h.send({op:'debit',lane:'ui',operation:ui(13),now:s.journal().expiresAt+1});}finally{await h.close();}
 at=s.journal().expiresAt+60000;
 const approval=join(s.home,'continuation-approval.json'),drain=join(s.home,'drain65.json');
 s.put(drain,compact({source:'deadline-expired-retained-owner-closed',closedAt:new Date(s.journal().expiresAt+1).toISOString(),remoteMutationsInThisScope:0,compatibilityRpcAttempted:false,ordinaryResumeAllowed:false,drain:{source:'simple-authority-holder',stopRequested:true,stopAcknowledged:true,ordinaryScopeClosed:true,ownedScope:{state:'SETTLED'},trialAccepted:false,remoteExecutionSettled:false,rollbackComplete:false}}));
 s.put(approval,compact({source:'direct-human-approval',decisionSha256:continuationDecision,ownerAnswer:'同意單次接續，保留65／232及全部限制',predecessorSha256:pin(s.path+'.simple.json').sha256,importedSpent:65,importedMainSpent:53,importedUiSpent:12,mainLimit:160,uiOrdinaryLimit:56,uiRecoveryLimit:16,combinedLimit:232,recordedAt:at,executionStarted:false}));
 s.cfg={...s.cfg,now:at,continuation:{decisionHash:continuationDecision,approval:pin(approval),journal:pin(s.path+'.simple.json'),claim:pin(s.path+'.simple-claim.json'),stop:pin(s.path+'.simple-stop.json'),registry:pin(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple.json')),drain:pin(drain)}};
 h=session(s);try{good(await h.ready);await debit(h,ui(13,{id:'simple-continuation-native-trigger-a',target:'original-triggers'}),at);good(await settle(h,'simple-continuation-native-trigger-a',true,at));}finally{await h.close();}
 const repair=join(s.home,'repair-approval.json'),j=JSON.parse(readFileSync(s.path+'.simple-continuation.json'));at+=1000;
 s.put(repair,compact({source:'direct-human-approval',decisionSha256:repairDecision,ownerAnswer:'同意單次本地准入修復，保留66／232及原期限',predecessorSha256:pin(s.path+'.simple-continuation.json').sha256,importedSpent:66,importedMainSpent:53,importedUiSpent:13,mainLimit:160,uiOrdinaryLimit:56,uiRecoveryLimit:16,combinedLimit:232,w0:j.w0,expiresAt:j.expiresAt,recordedAt:at,executionStarted:false}));
 s.cfg={...s.cfg,now:at,admissionRepair:{decisionHash:repairDecision,approval:pin(repair),journal:pin(s.path+'.simple-continuation.json'),claim:pin(s.path+'.simple-continuation-claim.json'),stop:pin(s.path+'.simple-continuation-stop.json'),registry:pin(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-continuation.json'))}};
 const win=join(s.home,'window-approval.json');at+=1000;
 s.put(win,compact({...JSON.parse(readFileSync(repair)),decisionSha256:windowDecision,ownerAnswer:'同意更新未啟動修復時窗，其餘限制不變',repairDecisionSha256:repairDecision,repairApprovalSha256:pin(repair).sha256,recordedAt:at}));s.cfg.admissionWindow={decisionHash:windowDecision,approval:pin(win)};s.cfg.now=at;
 h=session(s);try{good(await h.ready);for(const [id,success]of[['simple-continuation-native-trigger-labels',true],['simple-admission-filter-context',false]]){await debit(h,ui(14,{id,target:'original-triggers'}),at);good(await settle(h,id,success,at));at+=1000;}}finally{await h.close();}
 const stopped=s.path+'.simple-admission-repair.json',debugApproval=join(s.home,'readonly-approval.json'),debugDrain=join(s.home,'drain68.json');
 s.put(debugDrain,compact({source:'simple-authority-holder',stopRequested:true,stopAcknowledged:true,ordinaryScopeClosed:true,ownedScope:{state:'SETTLED'},trialAccepted:false,remoteExecutionSettled:false,rollbackComplete:false}));
 s.put(debugApproval,compact({source:'direct-human-approval',decisionSha256:debugDecision,ownerAnswer:'同意有界唯讀除錯，維持232',predecessorSha256:pin(stopped).sha256,importedSpent:68,importedMainSpent:53,importedUiSpent:15,mainLimit:160,uiOrdinaryLimit:56,uiRecoveryLimit:16,combinedLimit:232,additionalReadonlyLimit:8,preparationLimit:23,qualifiedFailureLimit:2,recordedAt:at,executionStarted:false}));
 s.cfg.readonlyDebug={decisionHash:debugDecision,approval:pin(debugApproval),journal:pin(stopped),claim:pin(s.path+'.simple-admission-repair-claim.json'),stop:pin(s.path+'.simple-admission-repair-stop.json'),registry:pin(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-admission-repair.json')),drain:pin(debugDrain)};
 s.cfg.now=at;s.time=at;s.parent=JSON.parse(readFileSync(stopped));s.debug=()=>JSON.parse(readFileSync(s.path+'.simple-readonly-debug.json'));
 s.before=Object.fromEntries(['journal','claim','stop','registry','drain'].map(k=>[s.cfg.readonlyDebug[k].path,readFileSync(s.cfg.readonlyDebug[k].path)]));return s;
}
export const proof=phase=>({phase,category:'SETTLED_READONLY_PROJECTION_REJECTED',targetVerified:true});
