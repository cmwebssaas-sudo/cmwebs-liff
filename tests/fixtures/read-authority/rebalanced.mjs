import {successorFixture,diagnosticOps,hash,compact} from './readonly-successor.mjs';
import {createAuthoritySimpleControl} from '../../../scripts/read-authority-simple-control.mjs';
import {readFileSync} from 'node:fs';import {join,resolve} from 'node:path';
export {session,good,debit,settle,prepare,hash,compact,ui} from './readonly-successor.mjs';
export const rebalanceDecision='bdab855eb6e95f7ba838e4514bd9bbc8b59db0ee64755d12950706b5ac0e051a';
export function holder(s,extra={},assertStage=()=>{}){const{now,ownerNonce,...config}=s.cfg,home=process.env.HOME;process.env.HOME=s.home;try{return createAuthoritySimpleControl({config:{...config,...extra},guard:()=>{},assertStage,now:()=>s.time,pause:async ms=>{s.time+=ms;}});}finally{process.env.HOME=home;}}
export const preparationOps=()=>[['inventory','original-settings','inventory'],['claim','original-settings','claim'],['thin-navigate','thin-settings','navigate'],['thin-snapshot','thin-settings','snapshot'],['audience-navigate','oauth-audience','navigate'],['audience-snapshot','oauth-audience','snapshot']].map(([id,target,operation])=>({id:'rebalance79-'+id,key:'N:preparation',actor:'publisher',target,operation,units:1,preparation:true}));
export async function rebalancedFixture(){
 const s=await successorFixture(),a=holder(s);await a.withContinuation(async cap=>{await cap.prepareReadonly({stage:'original-settings-guard-76',operations:diagnosticOps(),remainingOrdinaryUi:29});for(const op of diagnosticOps())await cap.browserRead(()=>true,op);await cap.pausePreparation();});
 const receipt=a.preparationHandoff(),pin=path=>({path,sha256:hash(readFileSync(path))}),suffix='.simple-readonly-diagnostic',approval=join(s.home,'rebalance-approval.json');s.time+=1000;
 s.put(approval,compact({source:'direct-human-approval',decisionSha256:rebalanceDecision,ownerAnswer:'同意232內重分配與分階段接續',predecessorSha256:pin(s.path+suffix+'.json').sha256,importedSpent:79,importedMainSpent:53,importedUiSpent:26,mainLimit:139,uiOrdinaryLimit:77,uiRecoveryLimit:16,combinedLimit:232,recordedAt:s.time,executionStarted:false}));
 s.cfg.readonlyRebalance={decisionHash:rebalanceDecision,approval:pin(approval),journal:pin(s.path+suffix+'.json'),claim:pin(s.path+suffix+'-claim.json'),registry:pin(join(s.root,hash(JSON.stringify(s.cfg.epoch))+suffix+'.json')),receipt:{...receipt.receipt}};
 try{s.cfg.sources.push(pin(resolve('scripts/read-authority-rebalanced-budget.py')));}catch{}
 s.cfg.now=s.time;s.cfg.ownerNonce='d'.repeat(64);s.rebalanced=()=>JSON.parse(readFileSync(s.path+'.simple-rebalanced.json'));
 s.retained79=Object.fromEntries(Object.values(s.cfg.readonlyRebalance).filter(v=>v?.path).map(p=>[p.path,readFileSync(p.path)]));return s;
}
