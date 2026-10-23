// Six individually prepaid publisher reads. The caller retains one mutable
// object; no handle or provider text enters the durable journal or receipt.
import {types} from 'node:util';
import {simpleData,simpleExact,PUBLISHER_ALIGNMENT_DECISION} from './read-authority-simple-plan.mjs';
import {projection,verified} from './read-authority-project-retarget.mjs';

export {PUBLISHER_ALIGNMENT_DECISION};
const stop=()=>{throw Error('PUBLISHER_ALIGNMENT_STOPPED');};
const steps=[['binding','getBrowser','thin-settings'],['name','nameSession','thin-settings'],['settings-claim','claimTab','thin-settings'],['settings-project','evaluate','thin-settings'],['audience-claim','claimTab','oauth-audience'],['audience-project','evaluate','oauth-audience']];
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200;
const url=v=>typeof v==='string'&&v.length>0&&v.length<=4096&&/^https:\/\//.test(v);
export function createAuthorityPublisherAlignmentFlow({contract,guard,createOwner,api,projectReady,retained}){
 const c=simpleData(contract);
 if(!simpleExact(c,['source','decisionHash','startingSpent','maximumFirstStageSpent','operationBudget','ordinaryUiLimit','maximumPreparationPrimitives','completeActualMapProven','browserProfile','browserId','settingsTabId','audienceTabId','settingsURL','audienceURL','publisherHash'])||c.source!=='approved-publisher-alignment105'||c.decisionHash!==PUBLISHER_ALIGNMENT_DECISION||c.startingSpent!==105||c.maximumFirstStageSpent!==111||c.operationBudget!==296||c.ordinaryUiLimit!==148||c.maximumPreparationPrimitives!==6||c.completeActualMapProven!==false||![c.browserProfile,c.browserId,c.settingsTabId,c.audienceTabId].every(id)||c.settingsTabId===c.audienceTabId||![c.settingsURL,c.audienceURL].every(url)||c.settingsURL===c.audienceURL||!(/^[a-f0-9]{64}$/).test(c.publisherHash)||typeof guard!=='function'||typeof createOwner!=='function'||typeof api?.getBrowser!=='function'||typeof projectReady!=='function'||!retained||typeof retained!=='object'||Array.isArray(retained)||types.isProxy(retained))stop();
 if(Object.keys(retained).length||!Object.isExtensible(retained))stop();
 let used=false;const maps=new Map(),validated=new Map(),claimedIds=new Map();
 const safe=v=>simpleData(v);
 const assertStage=p=>{guard();if(p.stage==='readonly-preparation'&&p.lane==='ui'&&simpleExact(p,['stage','lane','operation'])){const map=maps.get(p.operation?.id);if(map&&JSON.stringify(map.operations[0])===JSON.stringify(p.operation))return;}
  if(simpleExact(p,['stage','operations','remainingOrdinaryUi'])&&maps.get(p.stage)?.remainingOrdinaryUi===p.remainingOrdinaryUi)return;
  if(p.stage==='loading-result'&&simpleExact(p,['stage','operation','result'])&&validated.has(p.operation?.id)&&JSON.stringify(validated.get(p.operation.id))===JSON.stringify(p.result))return;stop();};
 return Object.freeze({run:async()=>{
  if(used)stop();used=true;let owner,phase='LOCAL_ADMISSION',report=null;
  try{guard();owner=createOwner({assertStage});await owner.withContinuation(async cap=>{
   const initial=await cap.inspect();if(initial.combinedSpent!==105||initial.mainSpent!==53||initial.uiSpent!==52||initial.uiOrdinaryLimit!==148||initial.combinedLimit!==296||initial.pending!==null||initial.phase!=='PREP'||initial.w0!==null||initial.publisherUsed!==0||initial.approvedBrowserId!==c.browserId||initial.approvedProfile!==c.browserProfile)stop();
   const step=async(index,io)=>{guard();const [stage,method,target]=steps[index],operation={id:`publisher105-n${index+1}-${stage}`,key:'N:preparation',actor:'publisher',target,operation:method,units:1,preparation:true},map={stage:operation.id,operations:[operation],remainingOrdinaryUi:90};maps.set(operation.id,map);phase='MAP_'+stage.toUpperCase();await cap.prepareReadonly(map);phase=stage.toUpperCase();return cap.browserRead(()=>io(operation),operation);};
   await step(0,async()=>{const browser=await api.getBrowser({id:c.browserId});guard();if(!browser||browser.browserId!==c.browserId||typeof browser.nameSession!=='function'||typeof browser.user?.claimTab!=='function')stop();retained.browser=browser;return {browserBound:true};});
   await step(1,async()=>{await retained.browser.nameSession('🔎 CMWebs C3');guard();return {sessionNamed:true};});
   const claim=async(target,tabId)=>{const tab=await retained.browser.user.claimTab(tabId);guard();if(!tab||!id(tab.id)||typeof tab.playwright?.evaluate!=='function')stop();retained[target]=tab;claimedIds.set(target,tab.id);return {tabClaimed:true};};
   await step(2,()=>claim('settings',c.settingsTabId));
   const project=async(target,destination,key,operation)=>{const tab=retained[key],raw=await tab.playwright.evaluate(projectReady,{expectedURL:destination,publisherHash:c.publisherHash,target});guard();if(tab!==retained[key]||tab.id!==claimedIds.get(key))stop();const value=projection(raw);if(!verified(value)||value.fieldsRead!==false)stop();validated.set(operation.id,safe(value));return value;};
   await step(3,op=>project('thin-settings',c.settingsURL,'settings',op));
   await step(4,()=>claim('audience',c.audienceTabId));
   await step(5,op=>project('oauth-audience',c.audienceURL,'audience',op));
   phase='PAUSE';report=await cap.pausePreparation();if(report.combinedSpent!==111||report.uiSpent!==58||report.publisherUsed!==6||report.settingsVerified!==true||report.audienceVerified!==true||report.lifecycle!=='CLEAN_PAUSE'||report.w0!==null||report.pending!==null)stop();
  });guard();return Object.freeze({status:'CLEAN_PAUSE111',report,handoff:owner.preparationHandoff(),futureOrdinaryUi:90,trialAccepted:false,completeActualMapProven:false});
  }catch{retained.browser=null;retained.settings=null;retained.audience=null;let drain=null;try{if(owner)drain=await owner.stopAndDrain();}catch{}return Object.freeze({status:'HARD_STOP',failurePhase:phase,report,drain,trialAccepted:false,completeActualMapProven:false});}
  finally{maps.clear();validated.clear();claimedIds.clear();}
 }});
}
