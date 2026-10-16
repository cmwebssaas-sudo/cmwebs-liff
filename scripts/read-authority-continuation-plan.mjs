// Pure offline accounting only. No file, browser, credential or remote IO.
import {SINGLE_WRAPPER_TRIAL_OPERATIONS} from './read-authority-trial-budget-plan.mjs';
import {types} from 'node:util';
const stop=()=>{throw Error('CONTINUATION_PLAN_UNVERIFIED');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
// Read only own data descriptors into one bounded JSON-shaped snapshot. Neither
// accessors, proxy traps, inherited hooks nor caller toJSON can influence totals.
function snapshot(value){
 let remaining=2000;const active=new Set();
 const copy=(v,depth)=>{
  if(--remaining<0||depth>8)stop();
  if(v===null||typeof v==='boolean'||typeof v==='string')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))stop();return v;}
  if(typeof v!=='object'||types.isProxy(v)||active.has(v))stop();
  active.add(v);const descriptors=Object.getOwnPropertyDescriptors(v),names=Reflect.ownKeys(descriptors);
  if(names.some(k=>typeof k!=='string'))stop();
  const array=Array.isArray(v),result=array?[]:Object.create(null);
  if(array){
   const length=descriptors.length;
   if(!length||!Object.hasOwn(length,'value')||!Number.isSafeInteger(length.value)||length.value>131||names.length!==length.value+1)stop();
   for(let n=0;n<length.value;n++)if(!Object.hasOwn(descriptors,String(n)))stop();
  }
  for(const key of names){
   if(array&&key==='length')continue;
   const d=descriptors[key];if(!Object.hasOwn(d,'value')||!d.enumerable)stop();
   Object.defineProperty(result,key,{value:copy(d.value,depth+1),enumerable:true});
  }
  active.delete(v);return result;
 };
 return copy(value,0);
}
export const BOUNDED_CONTINUATION_DECISION_HASH='f227ebbf2ca791d521e0008a639c2fa4ecb31e5be793478c45ffee47b420c92d';
const limits={A:9,B:13,C:9,D:10,E:7,F:30,H:1,I:17,P:4,G:4,T:3,N:24};
const operations={};
const add=(key,actor,target,methods)=>{operations[key]={actor,target,methods};};
// Targets are fixed-purpose symbols. Actual private actor/resource pins are
// independently enforced by the controller and adapter; no URL can select IO.
const special={
 'B:fixture-import':['publisher','synthetic-sheet',['POST']],
 'B:reader-create':['publisher','synthetic-sheet',['POST']],
 'B:fixture-native':['caller','synthetic-sheet',['GET']],
 'C:library-source-put':['publisher','original-project',['PUT']],
 'C:library-version-create':['publisher','original-project',['POST']],
 'C:restore-editor':['publisher','original-project',['PUT']],
 'C:original-properties-write':['publisher','original-settings',['click','fill']],
 'D:thin-gcp-link':['publisher','thin-settings',['click','fill']],
 'D:thin-source-put':['publisher','thin-project',['PUT']],
 'D:thin-version-create':['publisher','thin-project',['POST']],
 'D:thin-deployment-create':['publisher','thin-project',['POST']],
 'D:thin-properties-write':['publisher','thin-settings',['click','fill']],
 'E:testing-user-write':['publisher','oauth-audience',['click','fill']],
 'E:testing-user-readback':['publisher','oauth-audience',['snapshot']],
 'E:client-create':['publisher','oauth-client',['click','fill']],
 'E:client-readback':['publisher','oauth-client',['snapshot']],
 'E:oauth-response':['caller','caller-oauth',['click']],
 'E:token-exchange':['caller','caller-oauth',['POST']],
 'E:caller-userinfo':['caller','caller-identity',['GET']],
 'H:wrapper-compatibility-rpc':['caller','thin-project',['POST']],
 'I:close-deployment':['publisher','thin-project',['DELETE']],
 'I:verify-closed-deployment':['publisher','thin-project',['GET']],
 'I:remove-reader':['publisher','synthetic-sheet',['DELETE']],
 'I:verify-reader-removed':['publisher','synthetic-sheet',['GET']],
 'I:restore-original-guard':['publisher','original-settings',['click','fill']],
 'I:verify-original-guard':['publisher','original-settings',['read-key-presence']],
 'I:restore-thin-guard':['publisher','thin-settings',['click','fill']],
 'I:verify-thin-guard':['publisher','thin-settings',['read-key-presence']],
 'I:remove-testing-user':['publisher','oauth-audience',['click']],
 'I:verify-testing-user-removed':['publisher','oauth-audience',['snapshot']],
 'I:revoke-token':['caller','caller-oauth',['POST']],
 'I:verify-token-revoked':['caller','caller-oauth',['GET']]
};
for(const [bucket,aliases] of Object.entries(SINGLE_WRAPPER_TRIAL_OPERATIONS))for(const alias of aliases){
 const key=bucket+':'+alias,base=bucket==='F'?alias.slice(alias.indexOf('.')+1):alias;
 let target='original-project',actor='publisher',methods=['GET'];
 if(bucket==='B'&&!base.startsWith('original-'))target='synthetic-sheet';
 if(base.startsWith('thin-'))target='thin-project';
 if(base==='synthetic-acl')target='synthetic-sheet';
 if(base==='caller-sheets-metadata'){target='synthetic-sheet';actor='caller';}
 if(base==='original-settings'||['original-properties-readback','original-properties-backup'].includes(base)){target='original-settings';methods=['read-key-presence'];}
 if(base==='original-triggers'||['read-original-triggers','original-triggers-backup'].includes(base)){target='original-triggers';methods=['snapshot'];}
 if(base==='thin-settings'||base==='thin-properties-readback'){target='thin-settings';methods=['read-key-presence'];}
 if(base==='oauth-audience'||base==='oauth-client'){target=base;methods=['snapshot'];}
 add(key,...(special[key]??[actor,target,methods]));
}
add('P:caller-bind','caller','caller-executions',['bind']);
add('P:publisher-bind','publisher','publisher-executions',['bind']);
add('P:publisher-refresh','publisher','publisher-oauth',['POST']);
add('P:publisher-userinfo','publisher','publisher-identity',['GET']);
for(const phase of ['wrapper-before','wrapper-after'])for(const actor of ['caller','publisher'])add('G:'+phase+'.'+actor,actor,actor+'-identity',['GET']);
for(let n=1;n<=3;n++)add('T:terminal-'+n,'caller','thin-project',['GET']);
const navigationTargets=['original-settings','original-triggers','thin-settings','oauth-audience','oauth-client'];
export const BOUNDED_CONTINUATION_POLICY=freeze({
 decisionHash:BOUNDED_CONTINUATION_DECISION_HASH,stage:'bounded-continuation-compatibility',
 importedUnits:27,limit:160,bucketLimits:limits,fixedFutureUnits:96,
 cleanupReserve:17,originalRestoreReserve:2,unusedReserve:2,
 researchLimit:8,navigationControlLimit:16,navigationTargets,
 operations,chargedUpperBoundMs:360000,maxWindowMs:21600000,sameTaipeiDayRequired:true,
 executionAuthorized:false,propertyValuesAllowed:false,
 externalPrerequisites:['linked-canonical-claim-and-original-history','local-accounting-stop-cleanup-tests','independent-review','pinned-independent-recovery','fixed-private-destinations','durable-W0-before-first-Google-IO'],
 credentialRpcPrerequisites:['complete-actual-low-level-map','actual-adapter-wiring-tests','fixed-source-closure-no-child-execution']
});
// Select the owner-approved replacement without changing the old policy or
// treating its stopped claim as live. Actual history is revalidated by ledger.
export const STANDALONE_TRIAL_DECISION_HASH='02c75938cc8ecff17c907431db861613bb7f4e2af967f185c6b9933758f7dfd8';
const standaloneOperations=Object.fromEntries(Object.entries(operations).filter(([key])=>!key.startsWith('C:')).map(([key,rule])=>[
 key,key.startsWith('F:')&&key.endsWith('.library-content')?{...rule,target:'thin-project'}:rule
]));
for(const [key,method] of [['D:standalone-acl-baseline','GET'],['D:standalone-reader-create','POST'],['F:wrapper-before.standalone-acl','GET'],['F:wrapper-after.standalone-acl','GET'],['J:script-remove','DELETE'],['J:script-verify','GET']])standaloneOperations[key]={actor:'publisher',target:'thin-project',methods:[method]};
export const STANDALONE_TRIAL_POLICY=freeze({...BOUNDED_CONTINUATION_POLICY,
 decisionHash:STANDALONE_TRIAL_DECISION_HASH,stage:'standalone-compatibility',
 importedUnits:31,fixedFutureUnits:93,bucketLimits:{...limits,C:0,D:12,F:32,J:2},operations:standaloneOperations,scriptCleanupReserve:2,
 originalRestoreUnitsOutsideMap:2,navigationTargets:[...navigationTargets,'thin-triggers']
});
// One owner-approved linked segment. Prior selections stay in imported42;
// their aliases are not future work and cannot be charged again.
export const STAGED_RESUME_DECISION_HASH='19c51070c90552bfe5af0c998a45cc5a2104efe17d6428dae046cdc492d3b16d';
const stagedOperations=Object.fromEntries(Object.entries(standaloneOperations).filter(([k])=>!['P:caller-bind','P:publisher-bind'].includes(k)&&!k.startsWith('B:auth-tab-')));
stagedOperations['B:auth-tabs-batch']={actor:'publisher',target:'synthetic-sheet',methods:['GET']};
export const STAGED_RESUME_POLICY=freeze({...STANDALONE_TRIAL_POLICY,
 decisionHash:STAGED_RESUME_DECISION_HASH,priorDecisionHash:STANDALONE_TRIAL_DECISION_HASH,stage:'staged-resume-compatibility',
 importedUnits:42,fixedFutureUnits:89,bucketLimits:{...STANDALONE_TRIAL_POLICY.bucketLimits,B:9,P:2,N:16},operations:stagedOperations,
 researchLimit:0,navigationControlLimit:16,navigationPartitions:{publisher:12,'caller-oauth':2,'thin-trigger':2}
});
// Fixed groups let a currently grounded stage proceed while future stages keep
// their full one-operation caps. They do not attest actual UI or callback proof.
export const STAGED_RESUME_STAGES=freeze({
 baseline:Object.keys(stagedOperations).filter(k=>k.startsWith('A:')||k.startsWith('P:')||['D:thin-project-backup','D:thin-source-backup'].includes(k)),
 resources:['D:standalone-acl-baseline','B:original-acl-fresh','B:fixture-import','B:fixture-file-readback','B:synthetic-acl-baseline','B:caller-permission-id','B:reader-create','B:reader-acl-readback','D:standalone-reader-create'],
 'cloud-link':['D:thin-gcp-link'],
 properties:['D:thin-properties-write','D:thin-properties-readback'],
 'oauth-audience':['E:testing-user-write','E:testing-user-readback'],
 'oauth-client':['E:client-create','E:client-readback'],
 publication:['D:thin-source-put','D:thin-version-create','D:thin-fixed-content','D:thin-deployment-create','D:thin-deployments-inventory'],
 'caller-oauth':['E:oauth-response','E:token-exchange','E:caller-userinfo'],
 readbacks:Object.keys(stagedOperations).filter(k=>k.startsWith('F:')||k.startsWith('G:')||k.startsWith('H:')||k.startsWith('T:')||['B:fixture-native','B:auth-tabs-batch'].includes(k)),
 recovery:Object.keys(stagedOperations).filter(k=>k.startsWith('I:')||k.startsWith('J:'))
});
export function compileAuthorityStagedResumePlan(input){return compilePlan(input,STAGED_RESUME_POLICY);}
// `*Eligible` denotes only the map's local arithmetic condition. It never
// verifies prerequisites, starts W0, or grants an external operation capability.
export function compileAuthorityContinuationPlan(input){
 return compilePlan(input,BOUNDED_CONTINUATION_POLICY);
}
export function compileAuthorityStandalonePlan(input){
 return compilePlan(input,STANDALONE_TRIAL_POLICY);
}
function compilePlan(input,policy){
 try{
  const limits=policy.bucketLimits,operations=policy.operations,navigationTargets=policy.navigationTargets;
  const outsideRestore=policy.originalRestoreUnitsOutsideMap??0;
  input=snapshot(input);
  const staged=policy===STAGED_RESUME_POLICY;
  const closed=policy===STANDALONE_TRIAL_POLICY&&Object.hasOwn(input.history??{},'closedPreflightCaller'),imported=closed?33:policy.importedUnits;
  if(!exact(input,['decisionHash','history','mapComplete','operations'])||input.decisionHash!==policy.decisionHash||
   !exact(input.history,['spent','limit',...(closed?['closedPreflightCaller']:[])])||input.history.spent!==imported||input.history.limit!==160||typeof input.mapComplete!=='boolean'||
   !Array.isArray(input.operations)||input.operations.length>131)stop();
  const ids=new Set(),seen=new Map(),unknownCosts=[],bucketUnits=Object.fromEntries(Object.keys(limits).map(k=>[k,0]));
  let research=0,preparation=0;
  for(const op of input.operations){
   if(!exact(op,['id','bucket','alias','actor','target','operation','units',...(op?.bucket==='N'?['stage']:[])])||
    typeof op.id!=='string'||!/^[-a-zA-Z0-9_.]{1,100}$/.test(op.id)||ids.has(op.id)||
    typeof op.bucket!=='string'||!Object.hasOwn(limits,op.bucket)||typeof op.alias!=='string'||
    op.units!==1&&op.units!==null)stop();
   ids.add(op.id);const key=op.bucket+':'+op.alias;if(seen.has(key))stop();
   if(op.bucket==='N'){
    if(staged){
     const pub=/^publisher-(?:[1-9]|1[0-2])$/.test(op.alias)&&op.actor==='publisher'&&navigationTargets.includes(op.target)&&op.target!=='thin-triggers'&&['navigate','snapshot'].includes(op.operation)&&op.stage==='publisher';
     const caller=['caller-oauth-enter','caller-oauth-observe'].includes(op.alias)&&op.actor==='caller'&&op.target==='caller-oauth'&&op.operation===(op.alias.endsWith('enter')?'navigate':'snapshot')&&op.stage==='caller-oauth';
     const thin=['thin-triggers-before','thin-triggers-after'].includes(op.alias)&&op.actor==='publisher'&&op.target==='thin-triggers'&&op.operation==='snapshot'&&op.stage==='thin-trigger';
     if(!pub&&!caller&&!thin)stop();preparation++;
    }else{
    const discovery=closed&&((op.id==='publisher-executions-discovery'&&op.alias==='navigation-1'&&op.operation==='snapshot')||(op.id==='publisher-executions-open'&&op.alias==='navigation-2'&&op.operation==='navigate'))&&op.actor==='publisher'&&op.target==='publisher-executions'&&op.stage==='research';
    if(!discovery&&(!/^navigation-(?:[1-9]|1[0-9]|2[0-4])$/.test(op.alias)||op.actor!=='publisher'||!navigationTargets.includes(op.target)||
     !['navigate','snapshot'].includes(op.operation)||!['research','preparation'].includes(op.stage)))stop();
    if(op.stage==='research')research++;else preparation++;
    }
   }else{
    const rule=operations[key];if(!rule||op.actor!==rule.actor||op.target!==rule.target||!rule.methods.includes(op.operation))stop();
   }
   seen.set(key,op.units);bucketUnits[op.bucket]++;
   if(op.units===null)unknownCosts.push(key);
  }
  if(closed&&input.operations.some(o=>o.id==='publisher-executions-open')&&!input.operations.some(o=>o.id==='publisher-executions-discovery'))stop();
  if(research>8||preparation>16||Object.entries(bucketUnits).some(([k,n])=>n>limits[k]))stop();
  const required=[...Object.keys(operations),...(staged?['N:caller-oauth-enter','N:caller-oauth-observe','N:thin-triggers-before','N:thin-triggers-after']:[])];
  const missingOperations=required.filter(k=>!seen.has(k)).sort();
  const fullyKnown=missingOperations.length===0&&unknownCosts.length===0&&input.mapComplete;
  if(closed){const caller=input.history.closedPreflightCaller;const mapped=input.operations.find(o=>o.bucket==='P'&&o.alias==='caller-bind');if(!mapped||!exact(caller,Object.keys(mapped))||Object.keys(mapped).some(k=>caller[k]!==mapped[k])||caller.units!==1)stop();}
  const minimumTotalUnits=imported+input.operations.length+missingOperations.length-(closed?1:0);
  const navigationReserve=policy.scriptCleanupReserve?bucketUnits.N:24;
  const reservedTotalUnits=imported+policy.fixedFutureUnits+(staged?2:closed?3:4)+4+navigationReserve+3+2+outsideRestore;
  const budgetFits=fullyKnown&&minimumTotalUnits+outsideRestore<=158&&reservedTotalUnits<=160;
  // Counts bound the rows above; unknown/missing costs must not be reported as
  // measured bucket totals. Their one-operation lower bounds remain in minimum.
  const unknownBuckets=new Set([...unknownCosts,...missingOperations].map(k=>k.split(':')[0]));
  const reportedBucketUnits=Object.fromEntries(Object.entries(bucketUnits).map(([k,n])=>[k,unknownBuckets.has(k)?null:n]));
  const preflightMapEligible=(staged||['P:caller-bind','P:publisher-bind'].every(k=>seen.get(k)===1))&&
   input.operations.filter(o=>o.bucket==='N'&&o.stage==='research').every(o=>o.units===1);
  return freeze({
   source:'authority-continuation-offline-plan',stage:policy.stage,
   decisionHash:policy.decisionHash,spent:imported,limit:160,
   fixedFutureUnits:policy.fixedFutureUnits,minimumTotalUnits,totalUnits:fullyKnown?minimumTotalUnits:null,
   reservedTotalUnits,unusedReserve:2,bucketUnits:reportedBucketUnits,
   researchUnits:input.operations.some(o=>o.bucket==='N'&&o.stage==='research'&&o.units===null)?null:research,
   navigationControlUnits:input.operations.some(o=>o.bucket==='N'&&o.stage==='preparation'&&o.units===null)?null:preparation,
   cleanupReserve:17,originalRestoreReserve:2,...(policy.scriptCleanupReserve?{scriptCleanupReserve:policy.scriptCleanupReserve}:{}),unknownCosts:unknownCosts.sort(),missingOperations,
   budgetFits,preflightMapEligible,credentialRpcEligible:budgetFits,
   eligibilityMeaning:'offline-map-condition-only',externalPrerequisitesVerified:false,
   requiredExternalPrerequisites:BOUNDED_CONTINUATION_POLICY.externalPrerequisites,
   requiredCredentialRpcPrerequisites:BOUNDED_CONTINUATION_POLICY.credentialRpcPrerequisites,
   chargedUpperBoundMs:360000,nativeRuntimeMs:null,quotaRemainingMs:null,
   actualDailyRuntimeAccepted:false,backgroundExecutionAccepted:false,
   executionAuthorized:false
  });
 }catch(_){stop();}
}
