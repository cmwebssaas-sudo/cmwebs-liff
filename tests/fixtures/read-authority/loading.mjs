import {rebalancedFixture,holder,preparationOps,hash,compact} from './rebalanced.mjs';
import {readFileSync} from 'node:fs';import {join,resolve} from 'node:path';
export {holder,session,good,debit,settle,prepare} from './rebalanced.mjs';
export const loadingDecision='909dabbd2cfbd56dd06ac94f1221fe1fad0e566e8b247989419aa455066b73a6';
export const notReady=()=>({source:'settled-preparation',kind:'NOT_READY',phase:'READY',targetVerified:true,accountVerified:true,bindingVerified:true,pureRead:true,terminal:true,fieldsRead:false});
export const loadingOp=(id,operation,target='thin-settings')=>({id:'loading-'+id,key:'N:preparation',actor:'publisher',target,operation,units:1,preparation:true});
export async function loadingFixture(){
 const s=await rebalancedFixture(),a=holder(s);await a.withContinuation(async cap=>{await cap.prepareReadonly({stage:'rebalanced-resource-preparation',operations:preparationOps(),remainingOrdinaryUi:43});for(const op of preparationOps().slice(0,3))await cap.browserRead(()=>true,op);try{await cap.browserRead(()=>{throw notReady();},preparationOps()[3]);}catch(e){if(e.message!=='READ_FAILED')throw e;}await cap.pausePreparation();});
 const receipt=a.preparationHandoff(),pin=path=>({path,sha256:hash(readFileSync(path))}),suffix='.simple-rebalanced',origin={};
 for(const [name,path]of Object.entries({journal:s.path+suffix+'.json',claim:s.path+suffix+'-claim.json',registry:join(s.root,hash(JSON.stringify(s.cfg.epoch))+suffix+'.json')})){const copy=join(s.home,'loading-origin-'+name+'.json');s.put(copy,readFileSync(path));origin[name]=pin(copy);}
 origin.receipt=receipt.receipt;s.time+=1000;const approval=join(s.home,'loading-approval.json');s.put(approval,compact({source:'direct-human-approval',decisionSha256:loadingDecision,ownerAnswer:'同意載入與安全接續修訂，維持232',predecessorSha256:origin.journal.sha256,importedSpent:83,combinedLimit:232,maximumLoadingPrimitives:9,recordedAt:s.time,executionStarted:false}));
 s.cfg.readonlyLoading={decisionHash:loadingDecision,approval:pin(approval),origin};s.cfg.resume=receipt;s.cfg.ownerNonce='c'.repeat(64);s.cfg.now=s.time;
 try{s.cfg.sources.push(pin(resolve('scripts/read-authority-loading-budget.py')));}catch{}
 s.loading=()=>s.rebalanced();s.origin=Object.fromEntries(Object.values(origin).map(p=>[p.path,readFileSync(p.path)]));return s;
}
