import {metadataFixture,holder,captureShape} from './metadata-diagnostic.mjs';
import {discoveryShape} from '../../../scripts/read-authority-browser-shape.mjs';
import {readFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {hash,compact} from './rebalanced.mjs';
export {holder};
export const ownerConnectionDecision='710fc0a4ff12766c997377a73e8d40f3314722b99b674d0f0fd741a7a96a6b31';
export const candidates=[{id:'publisher-chrome',name:'Chrome',type:'extension',profileName:'Publisher'},{id:'caller-chrome',name:'Chrome',type:'extension',profileName:'Trial'}];
export const stages=['discovery','binding','inventory','claim','wait','snapshot'];
export const methods={discovery:'inventory',binding:'claim',inventory:'inventory',claim:'claim',wait:'wait',snapshot:'snapshot'};
export async function ownerFixture(browserId='publisher-chrome'){
 const fixtureCandidates=candidates.map((row,n)=>n===0?{...row,id:browserId}:row);
 const s=await metadataFixture(),a=holder(s);let shape,report;
 await a.withContinuation(async cap=>{shape=await captureShape(cap,()=>discoveryShape([...fixtureCandidates,{id:'iab',name:'IAB',type:'iab'},{id:'apps',name:'Apps',type:'mcpapps'}],'old'));report=await cap.inspect();});const drain=await a.stopAndDrain();
 const pin=path=>({path,sha256:hash(readFileSync(path))}),origin={},canonical={journal:s.path+'.simple-metadata-diagnostic.json',claim:s.path+'.simple-metadata-diagnostic-claim.json',stop:s.path+'.simple-metadata-diagnostic-stop.json',registry:join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-rebalanced.json')};
 for(const[k,p]of Object.entries(canonical)){const t=join(s.home,'owner94-origin-'+k+'.json');s.put(t,readFileSync(p));origin[k]=pin(t);}
 const result=join(s.home,'owner94-origin-result.json');s.put(result,compact({status:'SHAPE_CAPTURED',shape,report,drain,trialAccepted:false,browserIdentityVerified:false,followupAuthorized:false}));origin.result=pin(result);
 const terminal=join(s.home,'owner94-origin-terminal.json');s.put(terminal,compact({source:'post-return-metadata-shape-terminal-evidence',actualSpent:94,mainSpent:53,uiSpent:41,phase:'PREP',lifecycle:'HARD_STOP',connectionUsed:5,connectionMaximum:9,connectionFaults:2,loadingUsed:11,loadingMaximum:15,diagnosticUsed:1,diagnosticComplete:true,allIoSettled:true,pendingNull:true,scopeClosed:true,lockReleased:true,noMutation:true,noRpc:true,noTrialClock:true,old93ArtifactsUnchanged:true,allHistoricalPinsUnchanged:101,browserIdentityVerified:false,followupAuthorized:false,status:'SHAPE_CAPTURED',shape,files:{...origin}}));origin.terminal=pin(terminal);
 s.time+=1000;const approval=join(s.home,'owner94-approval.json');s.put(approval,compact({source:'direct-human-approval',decisionSha256:ownerConnectionDecision,ownerAnswer:'同意六步接續，維持232（建議）',predecessorSha256:origin.journal.sha256,importedSpent:94,importedMainSpent:53,importedUiSpent:41,mainLimit:132,uiOrdinaryLimit:84,uiRecoveryLimit:16,combinedLimit:232,maximumNewPrimitives:6,connectionMaximum:11,loadingMaximum:17,qualifiedFailureLimit:2,recordedAt:s.time,executionStarted:false}));
 s.cfg.sources.push(pin(resolve('scripts/read-authority-owner-connection-budget.py')));
 s.cfg.readonlyConnection.repair92.diagnostic93.owner94={decisionHash:ownerConnectionDecision,approval:pin(approval),origin};s.cfg.resume={ownerConnection94:true};s.cfg.now=s.time;s.cfg.ownerNonce='3'.repeat(64);
 s.owner=()=>JSON.parse(readFileSync(s.path+'.simple-owner-connection.json'));s.retained94=Object.fromEntries(Object.entries(canonical).filter(([k])=>k!=='registry').map(([,p])=>[p,readFileSync(p)]));
 s.candidates=fixtureCandidates;s.selection=(id=browserId,extra={})=>{const path=join(s.home,'owner-choice-'+id+'.json');s.put(path,compact({source:'direct-human-connection-selection',browserId:id,ownerAnswer:'使用連線 '+id,candidatesSha256:hash(compact(fixtureCandidates)),recordedAt:s.time,executionStarted:false,...extra}));return {browserId:id,approval:pin(path)};};return s;
}
export async function ownerStep(cap,s,stage,io=()=>({verified:true})){
 const op={id:'loading-owner94-n'+(s.owner().connection.used+1)+'-'+stage,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:methods[stage],units:1,preparation:true};
 await cap.prepareReadonly({stage:op.id,operations:[op],remainingOrdinaryUi:36});return cap.browserRead(io,op);
}
