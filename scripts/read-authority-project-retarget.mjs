// Exact approved four-step binding. No write, alternate tab, wait or RPC API.
import {selectAuthorityProjectTab,authorityProjectInventoryFailure} from './read-authority-project-selector.mjs';
import {simpleData,simpleExact} from './read-authority-simple-plan.mjs';
const stop=()=>{throw Error('PROJECT_RETARGET_STOPPED');};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const methods={binding:'claim',inventory:'inventory',claim:'claim',snapshot:'snapshot'};
const labels=['變更專案','變更專案編號','Change project','Change project number','新增指令碼屬性','編輯指令碼屬性','Add script property','Edit script properties','儲存指令碼屬性','Save script properties'];
function projection(raw){
 if(typeof raw!=='string'||raw.length>10000)stop();const v=simpleData(JSON.parse(raw));
 if(!simpleExact(v,['source','urlMatched','accountVerified','fieldsRead','ready','section','reason','phase','cryptoAvailable','encoderAvailable','controls'])||v.source!=='rebalanced-readonly-grounding'||!['urlMatched','accountVerified','fieldsRead','cryptoAvailable','encoderAvailable'].every(k=>typeof v[k]==='boolean')||v.fieldsRead!==false||!['UNREAD','COMPLETE','LOADING','INTERACTIVE','UNKNOWN'].includes(v.ready)||!['UNREAD','MATCHED','MISMATCHED'].includes(v.section)||!['DOM_REJECTED','URL_MISMATCH','ACCOUNT_BOUND','ACCOUNT_MISMATCH','GUARD_DRIFT','NOT_COMPLETE','HEADINGS_MISMATCH','HEADINGS_BOUND','VERIFIED'].includes(v.reason)||!['URL','ACCOUNT_SCAN','ACCOUNT_HASH','READY','HEADINGS','COMPLETE'].includes(v.phase)||!Array.isArray(v.controls)||v.controls.length>24)stop();
 for(const r of v.controls)if(!simpleExact(r,['label','tag','role','disabled'])||!labels.includes(r.label)||!['BUTTON','DIV','SPAN','A'].includes(r.tag)||![null,'button'].includes(r.role)||typeof r.disabled!=='boolean')stop();return v;
}
const verified=v=>v.urlMatched===true&&v.accountVerified===true&&v.ready==='COMPLETE'&&v.section==='MATCHED'&&v.reason==='VERIFIED'&&v.phase==='COMPLETE';
export function createAuthorityProjectRetargetFlow({contract,guard,createOwner,api,projectReady}){
 const c=simpleData(contract);
 if(!simpleExact(c,['source','decisionHash','startingSpent','maximumSpent','connectionMaximum','loadingMaximum','maximumPreparationPrimitives','completeActualMapProven','browserId','settingsURL','publisherHash'])||c.source!=='approved-project-retarget99'||c.decisionHash!=='2deec8acafeb444f258ba2ecdddb2cda65c81db5f1ecba032584348e9479b963'||c.startingSpent!==99||c.maximumSpent!==103||c.connectionMaximum!==14||c.loadingMaximum!==20||c.maximumPreparationPrimitives!==4||c.completeActualMapProven!==false||c.browserId!=='6'||typeof c.settingsURL!=='string'||!c.settingsURL||c.settingsURL.length>4096||typeof c.publisherHash!=='string'||!/^[a-f0-9]{64}$/.test(c.publisherHash)||typeof guard!=='function'||typeof createOwner!=='function'||typeof api?.get!=='function'||typeof projectReady!=='function')stop();
 const maps=new Map(),validated=new Map();let used=false,classification=null,snapshot=null;
 const assertStage=p=>{guard();
  if(['inventory-result','loading-result'].includes(p.stage)&&simpleExact(p,['stage','operation','result'])&&same(maps.get(p.operation?.id)?.operations[0],p.operation)&&validated.has(p.operation.id)&&same(p.result,validated.get(p.operation.id)))return;
  if(p.stage==='readonly-preparation'&&p.lane==='ui'&&simpleExact(p,['stage','lane','operation'])&&same(maps.get(p.operation?.id)?.operations[0],p.operation))return;
  if(simpleExact(p,['stage','operations','remainingOrdinaryUi'])&&same(maps.get(p.stage),p))return;stop();};
 return Object.freeze({run:async()=>{
  if(used)stop();used=true;let owner,report=null,phase='LOCAL_ADMISSION',browser,row,tab,capturedId;
  try{guard();owner=createOwner({assertStage});await owner.withContinuation(async cap=>{
   const initial=await cap.inspect();if(initial.combinedSpent!==99||initial.connectionUsed!==10||initial.connectionFaults!==2||initial.connectionStage!=='binding'||initial.ownerSelected!==true||initial.ownerAccountVerified!==false||initial.retargetUsed!==0||initial.inventoryUsed!==2||initial.inventoryAccountVerified!==false||initial.combinedLimit!==234||initial.uiOrdinaryLimit!==86)stop();
   const step=async(stage,io)=>{guard();const r=await cap.inspect();if(r.connectionStage!==stage)stop();const op={id:'loading-retarget99-n'+(r.connectionUsed+1)+'-'+stage,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:methods[stage],units:1,preparation:true},map={stage:op.id,operations:[op],remainingOrdinaryUi:36};maps.set(op.id,map);phase='MAP_'+stage;await cap.prepareReadonly(map);phase=stage.toUpperCase();return cap.browserRead(()=>io(op),op);};
   await step('binding',async()=>{browser=await api.get(c.browserId);guard();if(!browser||browser.browserId!==c.browserId||typeof browser.user?.openTabs!=='function'||typeof browser.user?.claimTab!=='function')stop();return {selectedBrowserBound:true};});
   await step('inventory',async op=>{let raw;try{raw=await browser.user.openTabs();}catch{classification=authorityProjectInventoryFailure().classification;validated.set(op.id,classification);throw classification;}guard();const result=selectAuthorityProjectTab(raw,{expectedURL:c.settingsURL});classification=result.classification;validated.set(op.id,classification);if(classification.status!=='VERIFIED')throw classification;row=result.selected;return classification;});
   await step('claim',async()=>{tab=await browser.user.claimTab(row);row=null;guard();if(!tab||typeof tab.id!=='string'||!tab.id||tab.id.length>200||typeof tab.playwright?.evaluate!=='function')stop();capturedId=tab.id;return {projectTabClaimed:true};});
   await step('snapshot',async op=>{const raw=await tab.playwright.evaluate(projectReady,{expectedURL:c.settingsURL,publisherHash:c.publisherHash,target:'thin-settings'});guard();if(tab.id!==capturedId)stop();snapshot=projection(raw);if(!verified(snapshot))stop();validated.set(op.id,snapshot);return snapshot;});
   phase='PAUSE';report=await cap.pausePreparation();if(report.combinedSpent!==103||report.connectionUsed!==14||report.connectionFaults!==2||report.retargetUsed!==4||report.inventoryUsed!==2||report.inventoryAccountVerified!==false||report.ownerAccountVerified!==true||report.retargetAccountVerified!==true||report.lifecycle!=='CLEAN_PAUSE')stop();
  });guard();return Object.freeze({status:'VERIFIED_BINDING_ONLY',classification,snapshot,report,handoff:owner.preparationHandoff(),trialAccepted:false,completeActualMapProven:false});
  }catch{row=null;tab=null;browser=null;let drain=null;try{if(owner)drain=await owner.stopAndDrain();}catch{}return Object.freeze({status:'HARD_STOP',failurePhase:phase,classification,snapshot,report,drain,trialAccepted:false,completeActualMapProven:false});}
  finally{row=null;tab=null;browser=null;maps.clear();validated.clear();}
 }});
}
