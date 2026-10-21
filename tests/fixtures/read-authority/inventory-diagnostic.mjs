import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {ownerFixture,holder,ownerStep,candidates} from './owner-connection.mjs';
import {hash,compact} from './rebalanced.mjs';
import {classifyAuthorityInventory,authorityInventoryApiFailure} from '../../../scripts/read-authority-inventory-diagnostic.mjs';
export {holder};
export const inventoryDecision='8a40d0166dc5217eac232b8abdab8e1fb3c994b3c26a462ddf9730a40d4cd5c2';
export const inventoryStages=['binding','inventory','claim','snapshot'];
export const verifiedInventory=()=>classifyAuthorityInventory([{id:'synthetic-opaque',providerTabId:'123',url:'https://synthetic.invalid/settings'}],{providerTabId:'123',expectedURL:'https://synthetic.invalid/settings'}).classification;
export const failedInventory=()=>authorityInventoryApiFailure().classification;
export async function inventoryFixture(){
 assert(existsSync(resolve('scripts/read-authority-inventory-budget.py')),'inventory97 successor implementation is required');
 const s=await ownerFixture(),a=holder(s);
 await a.withContinuation(async cap=>{await ownerStep(cap,s,'discovery',()=>candidates);await cap.pausePreparation();});
 const b=holder(s,{resume:a.preparationHandoff()});
 await assert.rejects(b.withContinuation(async cap=>{await cap.selectOwnerBrowser(s.selection());await ownerStep(cap,s,'binding');await ownerStep(cap,s,'inventory',()=>{throw Error('synthetic inventory rejection');});}),/TRIAL_STOPPED/);
 const drain=await b.stopAndDrain();const j=s.owner();assert.equal(j.events.length,44);
 const pin=path=>({path,sha256:hash(readFileSync(path))}),origin={},canonical={journal:s.path+'.simple-owner-connection.json',claim:s.path+'.simple-owner-connection-claim.json',stop:s.path+'.simple-owner-connection-stop.json',registry:join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-rebalanced.json')};
 for(const[k,p]of Object.entries(canonical)){const target=join(s.home,'inventory97-origin-'+k+'.json');s.put(target,readFileSync(p));origin[k]=pin(target);}
 const result=join(s.home,'inventory97-origin-result.json');s.put(result,compact({status:'HARD_STOP',failurePhase:'INVENTORY',report:null,drain,trialAccepted:false,completeActualMapProven:false}));origin.result=pin(result);
 const terminal=join(s.home,'inventory97-origin-terminal.json');
 s.put(terminal,compact({source:'post-return-selected-owner97-terminal',actualSpent:97,mainSpent:53,uiSpent:44,combinedLimit:232,lifecycle:'HARD_STOP',phase:'PREP',bindingSucceeded:true,inventoryFailed:true,failureCauseEstablished:false,allIoSettled:true,pendingNull:true,scopeClosed:true,lockReleased:true,registryAndClaimExact:true,stopRecorded:true,immutablePinsChecked:116,noMutation:true,noRpc:true,noTrialClock:true,trialAccepted:false,retryAuthorized:false,artifacts:Object.values(canonical).map(pin)}));origin.terminal=pin(terminal);
 s.time+=1000;const approval=join(s.home,'inventory97-approval.json');
 s.put(approval,compact({source:'direct-human-question-reply',questionCall:'synthetic-direct-human-scope',answer:'同意四步方案，維持232',decisionSha256:inventoryDecision,recordedAt:s.time,operationBudget:232,retainedSpent:97,selectedBrowserId:j.ownerConnection.selected.browserId,scope:'FOUR_READONLY_STEPS_NEW_ENTRY_ONLY',executionStarted:false}));
 s.cfg.readonlyConnection.repair92.diagnostic93.owner94.inventory97={decisionHash:inventoryDecision,approval:pin(approval),origin};
 for(const file of ['read-authority-inventory-budget.py','read-authority-inventory-diagnostic.mjs','read-authority-ready-projection.mjs'])s.cfg.sources.push(pin(resolve('scripts/'+file)));
 s.cfg.resume={inventory97:true};s.cfg.now=s.time;
 s.inventory=()=>JSON.parse(readFileSync(s.path+'.simple-inventory-diagnostic.json'));
 s.retained97=Object.fromEntries(Object.entries(canonical).filter(([k])=>k!=='registry').map(([,p])=>[p,readFileSync(p)]));
 return s;
}
export async function inventoryStep(cap,s,stage,io=()=>stage==='inventory'?verifiedInventory():{verified:true}){
 const r=await cap.inspect(),op={id:'loading-inventory97-n'+(r.connectionUsed+1)+'-'+stage,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:stage==='binding'||stage==='claim'?'claim':stage,units:1,preparation:true};
 await cap.prepareReadonly({stage:op.id,operations:[op],remainingOrdinaryUi:36});return cap.browserRead(io,op);
}
