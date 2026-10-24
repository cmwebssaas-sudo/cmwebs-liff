import assert from 'node:assert/strict';
import test from 'node:test';
import {PUBLISHER_ALIGNMENT_DECISION,createAuthorityPublisherAlignmentFlow} from '../scripts/read-authority-publisher-alignment.mjs';
import {alignmentFixture,holder,alignment,changePin} from './fixtures/read-authority/publisher-alignment.mjs';
import {readFileSync,existsSync,unlinkSync,mkdirSync,readdirSync,symlinkSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {hash,compact} from './fixtures/read-authority/rebalanced.mjs';
import {sharedFixture} from './fixtures/read-authority/project-shared.mjs';
import {projection} from '../scripts/read-authority-project-retarget.mjs';
import {SIMPLE_RULES,SIMPLE_NATIVE,simpleBrowser,simpleFixed} from '../scripts/read-authority-simple-plan.mjs';
import os from 'node:os';
import {syncBuiltinESMExports} from 'node:module';

function withTestHomedir(home,callback){
 const before=Object.fromEntries(['HOME','home','CODEX_HOME'].map(key=>[key,{present:Object.hasOwn(process.env,key),value:process.env[key]}]));
 const original=os.homedir;os.homedir=()=>home;syncBuiltinESMExports();
 try{return callback();}finally{
  os.homedir=original;syncBuiltinESMExports();
  for(const [key,entry] of Object.entries(before)){assert.equal(Object.hasOwn(process.env,key),entry.present);assert.equal(process.env[key],entry.value);}
 }
}

async function nativePredebitFixture(actualBaselineIds=false){
 const standardEnv=Object.fromEntries(['HOME','home','CODEX_HOME'].map(key=>[key,{present:Object.hasOwn(process.env,key),value:process.env[key]}]));
 const {s,closure}=await nativeSuccessorFixture();
 const rows=[
  ['settings-goto','N:preparation','original-settings','navigate',true],
  ['settings-project','N:preparation','original-settings','evaluate',true],
  ['cloud','A:original-cloud-backup','original-settings','snapshot',false],
  ['properties','A:original-properties-backup','original-settings','read-key-presence',false],
  ['triggers-goto','N:navigation','original-triggers','navigate',false],
  ['triggers-read','A:original-triggers-backup','original-triggers','snapshot',false],
  ['ground-triggers-goto','N:preparation','original-triggers','navigate',true],
  ['ground-triggers-project','N:preparation','original-triggers','evaluate',true],
  ['ground-settings-return','N:preparation','original-settings','navigate',true]
 ].map(([id,key,target,operation,preparation],index)=>({id:'future-baseline-'+(actualBaselineIds?index+1:id),key,actor:'publisher',target,operation,units:1,preparation}));
 const first=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 const project={id:'future-baseline-original-project',bucket:'A',alias:'original-project',actor:'publisher',target:'original-project',operation:'GET',units:1};
 const projectCleanup={id:'cleanup-original-project-prelude',key:'I:read-original-project',actor:'publisher',target:'original-project',operation:'snapshot',units:1,preparation:false};
 const projectMap={lane:'main',descriptor:project,tabId:'current-tab',url:'https://synthetic.invalid/original-project',callback:'publisherOriginalProjectRead',receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[{lane:'ui',descriptor:projectCleanup,target:'original-project',tabId:'current-tab',url:'https://synthetic.invalid/original-project',callback:'publisherOriginalProjectPrelude',receipt:'SANITIZED_READ'}],repairIncident:null};
 await assert.rejects(first.withContinuation(async cap=>{await cap.stagePublisher({stage:'baseline',stageCap:9,map:[...rows.map(row=>({...futureMeta(row),tabId:'current-tab'})),projectMap]});throw Error('synthetic-before-debit');}),/TRIAL_STOPPED/);
 const old=s.path+'.simple-publisher-native-successor',registry=join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-rebalanced.json');
 assert(registry.startsWith(s.home+'/'));assert(s.path.startsWith(s.home+'/'));
 const origin=Object.fromEntries(Object.entries({journal:old+'.json',claim:old+'-claim.json',stop:old+'-stop.json',registry}).map(([key,path])=>[key,{path,sha256:hash(readFileSync(path))}]));
 const stopped=JSON.parse(readFileSync(origin.journal.path));assert.equal(stopped.events.length,55);assert.equal(stopped.lifecycle,'HARD_STOP');
 const proofPath=join(s.home,'task72-predebit-proof.json'),proof={source:'native128-predebit-local-timeout-proof-v2',journal:origin.journal,claim:origin.claim,registry:origin.registry,state:'stopped',lifecycle:'HARD_STOP',phase:'PREP',eventCount:55,newEventsAfterImported55:0,counts:{main:53,ui:75,combined:128,limit:296},pending:null,w0:null,mutated:false,rpc:{beganAt:null,complete:false},nativeImports:17,lockOpenHolders:0,providerCallsThisAdmission:0,retainedCUAReferenceLost:true,restartAttemptedAfterHardStop:false};
 s.put(proofPath,compact(proof));const proofPin={path:proofPath,sha256:hash(readFileSync(proofPath))};
 const recoverySpec={proof:proofPin,origin};let rejectedCallbacks=0;
 await assert.rejects(holder(s,{resume:{nativeSuccessor:true,predebitRecovery:recoverySpec}},()=>{},()=>closure.sha256).withContinuation(()=>{rejectedCallbacks++;}),/TRIAL_STOPPED/);
 assert.equal(rejectedCallbacks,0);assert.equal(hash(readFileSync(origin.journal.path)),origin.journal.sha256);
 // A test-only copy replaces exactly four fixed pins. The production module
 // and every function body stay byte-for-byte unchanged outside those literals.
 const src=resolve('scripts/read-authority-publisher-alignment-budget.py'),body=readFileSync(src,'utf8'),testDir=join(s.home,'task72-module');mkdirSync(testDir,{mode:0o700});
 for(const name of readdirSync(resolve('scripts')).filter(name=>name.startsWith('read-authority-'))){
  if(name==='read-authority-publisher-alignment-budget.py'||name==='read-authority-simple-control.mjs')continue;
  symlinkSync(resolve('scripts',name),join(testDir,name));
 }
 const pinned={journal:'91e30a199fbf6660dfd0b659ec4b265fee45bb8d360ea26a68ba1e9846f5491c',claim:'2dc247c18221e958e860a3ec57acfd72342935af936e87be38f14648b5727827',registry:'adf06b0cf233169233621a07b58955c5b7de3505b0791d563c4901df2786e7a6',proof:'e28e43b7045f5f976f4624108c010cb7089cc7f5a75c0c4f046834508d8e46ae'};
 let adapted=body;for(const [key,oldHash] of Object.entries(pinned)){assert.equal(adapted.split(oldHash).length-1,1);adapted=adapted.replaceAll(oldHash,key==='proof'?proofPin.sha256:origin[key].sha256);}
 const patched=join(testDir,'read-authority-publisher-alignment-budget.py');writeFileSync(patched,adapted,{mode:0o600});
 const controlPath=join(testDir,'read-authority-simple-control.mjs');writeFileSync(controlPath,readFileSync(resolve('scripts/read-authority-simple-control.mjs')),{mode:0o600});
 const config=structuredClone(s.cfg);config.sources=config.sources.map(pin=>pin.path===src?{path:patched,sha256:hash(readFileSync(patched))}:pin.path===resolve('scripts/read-authority-simple-control.mjs')?{path:controlPath,sha256:hash(readFileSync(controlPath))}:pin);
 const publicSource=config.sources.find(pin=>pin.path===controlPath);assert(publicSource);
 config.resume={nativeSuccessor:true,predebitRecovery:recoverySpec};
 const {createAuthoritySimpleControl}=await import('file://'+controlPath);
 const create=cfg=>withTestHomedir(s.home,()=>createAuthoritySimpleControl({config:((({now,ownerNonce,...rest})=>rest))(cfg),guard:()=>{},assertStage:()=>{},now:()=>s.time,pause:async ms=>{s.time+=ms;},verifyNativeSuccessor:()=>closure.sha256}));
 const owner=create(config);
 return {standardEnv,s,closure,origin,stopped,config,create,owner,registry,publicSource,projectMap};
}

const bootstrapRows=()=>[
 ['browser','getBrowser','publisherBootstrapGetBrowser'],
 ['claim','claimTab','publisherBootstrapClaimTab'],
 ['identity','evaluate','publisherBootstrapEvaluate']
].map(([name,operation,callback])=>({lane:'ui',descriptor:{id:'future-bootstrap-'+name,key:'N:preparation',actor:'publisher',target:'oauth-audience',operation,units:1,preparation:true},tabId:'current-tab',url:contract.audienceURL,callback,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null}));
const bootstrapResult=index=>({source:'publisher-bootstrap-context-v1',kind:['BROWSER_BOUND','TAB_CLAIMED','AUDIENCE_CONTEXT'][index],browserId:'current-browser',...(index>0?{tabId:'current-tab'}:{}),...(index===2?{url:contract.audienceURL,projectHash:'b'.repeat(64),readyState:'COMPLETE',headingMatched:true,identityPending:true}:{}),fieldsRead:false});

const nativeAKeys=['original-editor','original-versions','original-deployments','original-v1-content','original-container-acl'];
const nativeAMap=(aliases,projectMap)=>aliases.map(alias=>{
 const key=alias.startsWith('publisher-')?'P:':'A:';
 const rule=SIMPLE_RULES[key+alias],descriptor={id:'future-'+alias,bucket:key[0],alias,actor:rule.actor,target:rule.target,operation:rule.methods[0],units:1};
 return {lane:'main',descriptor,tabId:projectMap.tabId,url:'https://synthetic.invalid/'+alias,callback:'publisherRead'+alias.replaceAll(/(^|-)([a-z])/g,(_,sep,ch)=>ch.toUpperCase()),receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null};
});
const nativeAProof=(phase,map,publicSource,projectMap,config,ownerHash,receipt=null)=>({source:'publisher-a-readonly-readiness-v1',phase,sourceSha256:publicSource.sha256,mapSha256:hash(compact(map)),epoch:config.epoch,binding:config.binding,ownerHash,originalProjectDescriptorSha256:hash(compact(projectMap.descriptor)),projectContextHash:'b'.repeat(64),publisherPrincipalSha256:contract.publisherHash,...(receipt?{projectReceiptSha256:hash(compact(receipt)),originalScriptIdSha256:receipt.originalScriptIdSha256,cloudProjectSlugSha256:receipt.cloudProjectSlugSha256,containerParentIdSha256:receipt.containerParentIdSha256}:{}),targetProofs:map.map(row=>({id:row.descriptor.id,urlSha256:hash(row.url),sameOriginalProject:true,readbackVerified:true,...(row.descriptor.alias==='original-container-acl'?{aclParentIdSha256:receipt.containerParentIdSha256}:{})}))});
async function prepareNativeARegistration(cap,s){
 const diagnostic=bootstrapRows();await cap.stagePublisher({stage:'diagnostic',stageCap:3,map:diagnostic});
 for(const [index,row] of diagnostic.entries())await cap.browserRead(()=>bootstrapResult(index),row.descriptor);
 const baseline=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json')).publisherStages[0].map;
 for(const index of [0,1,6,7,8]){
  const row=baseline[index];await cap.browserRead(()=>index===0?{source:'publisher-baseline-navigation-v1',status:'AWAITING_NEXT_PROJECTION',browserId:'current-browser',tabId:'current-tab',url:contract.settingsURL,fieldsRead:false}:index===1?{source:'publisher-baseline-identity-v1',status:'VERIFIED',browserId:'current-browser',tabId:'current-tab',url:contract.settingsURL,projectHash:'b'.repeat(64),principalHash:contract.publisherHash,readyState:'COMPLETE',fieldsRead:false}:JSON.parse(snapshot),row.descriptor);
 }
 return baseline;
}
const nativeAInitialRequest=(s,config,publicSource,projectMap)=>{
 const ownerHash=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json')).holder;
 const map=nativeAMap(['publisher-refresh','publisher-userinfo'],projectMap);
 return {phase:'initial',map,proof:nativeAProof('initial',map,publicSource,projectMap,config,ownerHash)};
};
const nativeAProjectReceipt=publicSource=>({source:'publisher-a-project-receipt-v1',status:'VERIFIED',sourceSha256:publicSource.sha256,projectContextHash:'b'.repeat(64),publisherPrincipalSha256:contract.publisherHash,originalScriptIdSha256:'1'.repeat(64),cloudProjectSlugSha256:'2'.repeat(64),containerParentIdSha256:'3'.repeat(64),projectReadbackSha256:'4'.repeat(64),fieldsRead:false});
const nativeRegisteredAPlan=(s,baseline,projectMap)=>{
 const journal=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 const plan=completeNativePlan(),native=plan.browserOperations.slice(0,21),navigation=plan.browserOperations.slice(21,65),recovery=plan.browserOperations.slice(71);
 plan.operations=plan.operations.map(row=>journal.stages[row.bucket+':'+row.alias]??row);
 for(let index=0;index<native.length;index++){const mapped=baseline.find(meta=>meta.lane==='ui'&&meta.descriptor.key===native[index].key);if(mapped)native[index]=mapped.descriptor;}
 navigation[0]=baseline[4].descriptor;
 plan.browserOperations=[...native,...navigation,...recovery.map(row=>row.key==='I:read-original-project'?projectMap.cleanup[0].descriptor:row)];
 return plan;
};
async function completeNativeAReadiness(cap,s,config,publicSource,projectMap,onRead,omitAlias=null){
 const baseline=await prepareNativeARegistration(cap,s),request=nativeAInitialRequest(s,config,publicSource,projectMap);
 await cap.registerPublisherAReads(request);
 await cap.browserRead(()=>{onRead();return JSON.parse(snapshot);},baseline[2].descriptor);
 for(const row of request.map)await cap.externalRead(()=>{onRead();return {source:'synthetic-credential'};},row.descriptor);
 const receipt=nativeAProjectReceipt(publicSource);
 await cap.externalRead(()=>{onRead();return receipt;},projectMap.descriptor);
 const rest=nativeAMap(nativeAKeys,projectMap),ownerHash=request.proof.ownerHash;
 await cap.registerPublisherAReads({phase:'remaining',map:rest,proof:nativeAProof('remaining',rest,publicSource,projectMap,config,ownerHash,receipt)});
 for(const row of rest)if(row.descriptor.alias!==omitAlias)await cap.externalRead(()=>{onRead();return {source:'synthetic-read'};},row.descriptor);
 for(const index of [3,4,5])await cap.browserRead(()=>{onRead();return JSON.parse(snapshot);},baseline[index].descriptor);
 return baseline;
}

test('native preplan registers P2 and A6 in phases, with real charged receipts and no UI credit',async()=>{
 const {s,config,owner,publicSource,projectMap}=await nativePredebitFixture(true);let callbacks=0,step='start';
 await owner.withContinuation(async cap=>{
  step='diagnostic and baseline PREP';const baseline=await prepareNativeARegistration(cap,s);
  const before=await cap.inspect();assert.equal(before.combinedSpent,136);assert.equal(before.phase,'PREP');assert.equal(before.w0,null);assert.equal(before.planReady,false);
  const ownerHash=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json')).holder;
  const pmap=nativeAMap(['publisher-refresh','publisher-userinfo'],projectMap);
  step='first registration';const first=await cap.registerPublisherAReads({phase:'initial',map:pmap,proof:nativeAProof('initial',pmap,publicSource,projectMap,config,ownerHash)});
  assert.equal(first.combinedSpent,136);assert.equal(first.mainSpent,53);assert.equal(first.uiSpent,83);assert.equal(first.planReady,false);
  step='first A UI';await cap.browserRead(()=>{callbacks++;return JSON.parse(snapshot);},baseline[2].descriptor);
  step='P refresh';const p=await cap.externalRead(()=>{callbacks++;return {source:'synthetic-refresh'};},pmap[0].descriptor);assert.equal(p.source,'synthetic-refresh');
  step='P userinfo';await cap.externalRead(()=>{callbacks++;return {source:'synthetic-userinfo'};},pmap[1].descriptor);
  const projectReceipt=nativeAProjectReceipt(publicSource);
  step='A project';await cap.externalRead(()=>{callbacks++;return projectReceipt;},projectMap.descriptor);
  const rest=nativeAMap(nativeAKeys,projectMap),proof=nativeAProof('remaining',rest,publicSource,projectMap,config,ownerHash,projectReceipt);
  step='second registration';const second=await cap.registerPublisherAReads({phase:'remaining',map:rest,proof});assert.equal(second.planReady,false);
  step='remaining A reads';for(const row of rest)await cap.externalRead(()=>{callbacks++;return {source:'synthetic-read'};},row.descriptor);
  step='remaining baseline UI';for(const index of [3,4,5])await cap.browserRead(()=>{callbacks++;return JSON.parse(snapshot);},baseline[index].descriptor);
  const done=await cap.inspect();assert.equal(done.mainSpent,61);assert.equal(done.uiSpent,87);assert.equal(done.combinedSpent,148);assert.equal(done.planReady,false);assert.equal(done.futureUiLimit,73);assert.equal(done.futureUiSpent,12);assert.equal(done.pending,null);
  const plan=nativeRegisteredAPlan(s,baseline,projectMap);
  step='complete plan';const planned=await cap.completePlan(plan);assert.equal(planned.planReady,true);assert.equal(planned.combinedSpent,148);
 }).catch(error=>{const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));error.message+=' @'+step+' '+JSON.stringify({eventCount:j.events.length,pending:j.pending,phase:j.phase,w0:j.w0,last:j.events.at(-1)?.operation?.id,readiness:j.publisherAReadiness?.length,completed:j.completed?.slice(-3)});throw error;});
 const journal=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 assert.equal(callbacks,12);assert.equal(journal.plan!==null,true);assert.deepEqual(journal.publisherStages[0].map.at(-1),projectMap);assert.equal(journal.publisherStages[0].stageCap,9);assert.equal(journal.mutated,false);
});

for(const [kind,alter] of [
 ['wrong phase',request=>({...request,phase:'remaining'})],
 ['unpinned source',request=>({...request,proof:{...request.proof,sourceSha256:'f'.repeat(64)}})],
 ['wrong existing pin',request=>({...request,proof:{...request.proof,sourceSha256:request.otherPinnedSource.sha256}})],
 ['wrong owner',request=>({...request,proof:{...request.proof,ownerHash:'0'.repeat(64)}})],
 ['wrong epoch',request=>({...request,proof:{...request.proof,epoch:{...request.proof.epoch,foreignCheckpoint:true}}})],
 ['wrong binding',request=>({...request,proof:{...request.proof,binding:'0'.repeat(64)}})],
 ['detached target URL',request=>{const map=structuredClone(request.map);map[0].url='https://synthetic.invalid/detached';return {...request,map,proof:{...request.proof,mapSha256:hash(compact(map))}};}],
 ['false target mapping',request=>{const proof=structuredClone(request.proof);proof.targetProofs[0].sameOriginalProject=false;return {...request,proof};}],
 ['caller actor',request=>{const map=structuredClone(request.map);map[0].descriptor.actor='caller';return {...request,map,proof:{...request.proof,mapSha256:hash(compact(map))}};}],
 ['wrong method',request=>{const map=structuredClone(request.map);map[0].descriptor.operation='DELETE';return {...request,map,proof:{...request.proof,mapSha256:hash(compact(map))}};}],
 ['duplicate original project',request=>{const map=[...request.map,structuredClone(request.originalProject)];return {...request,map,proof:{...request.proof,mapSha256:hash(compact(map))}};}]
])test(`native main-only readiness rejects ${kind} before any new callback`,async()=>{
 const {s,config,owner,publicSource,projectMap}=await nativePredebitFixture(true);let callbacks=0;
 await assert.rejects(owner.withContinuation(async cap=>{
  await prepareNativeARegistration(cap,s);
  const ownerHash=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json')).holder;
  const map=nativeAMap(['publisher-refresh','publisher-userinfo'],projectMap);
  const request={phase:'initial',map,proof:nativeAProof('initial',map,publicSource,projectMap,config,ownerHash),originalProject:projectMap,otherPinnedSource:config.sources.find(pin=>pin.path===resolve('scripts/read-authority-simple-plan.mjs'))};
  assert(request.otherPinnedSource);const bad=alter(request);delete bad.originalProject;delete bad.otherPinnedSource;
  await cap.registerPublisherAReads(bad);callbacks++;
 }),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 assert.equal(callbacks,0);assert.equal(j.events.length,63);assert.equal(j.publisherStages.length,2);assert.equal(j.publisherAReadiness,undefined);assert.equal(j.plan,null);assert.equal(j.pending,null);
});

test('native readiness replay is refused with the initial map still intact',async()=>{
 const {s,config,owner,publicSource,projectMap}=await nativePredebitFixture(true);let callbacks=0;
 await assert.rejects(owner.withContinuation(async cap=>{
  await prepareNativeARegistration(cap,s);
  const ownerHash=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json')).holder;
  const map=nativeAMap(['publisher-refresh','publisher-userinfo'],projectMap),request={phase:'initial',map,proof:nativeAProof('initial',map,publicSource,projectMap,config,ownerHash)};
  await cap.registerPublisherAReads(request);
  await cap.registerPublisherAReads(request);callbacks++;
 }),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 assert.equal(callbacks,0);assert.equal(j.events.length,63);assert.equal(j.publisherAReadiness.length,1);assert.equal(j.plan,null);assert.equal(j.w0,null);
});

test('phase two refuses an ACL URL proof detached from the charged project parent receipt',async()=>{
 const {s,config,owner,publicSource,projectMap}=await nativePredebitFixture(true);let callbacks=0;
 await assert.rejects(owner.withContinuation(async cap=>{
  const baseline=await prepareNativeARegistration(cap,s),ownerHash=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json')).holder;
  const pmap=nativeAMap(['publisher-refresh','publisher-userinfo'],projectMap);
  await cap.registerPublisherAReads({phase:'initial',map:pmap,proof:nativeAProof('initial',pmap,publicSource,projectMap,config,ownerHash)});
  await cap.browserRead(()=>{callbacks++;return JSON.parse(snapshot);},baseline[2].descriptor);
  await cap.externalRead(()=>{callbacks++;return {source:'synthetic-refresh'};},pmap[0].descriptor);
  await cap.externalRead(()=>{callbacks++;return {source:'synthetic-userinfo'};},pmap[1].descriptor);
  const receipt={source:'publisher-a-project-receipt-v1',status:'VERIFIED',sourceSha256:publicSource.sha256,projectContextHash:'b'.repeat(64),publisherPrincipalSha256:contract.publisherHash,originalScriptIdSha256:'1'.repeat(64),cloudProjectSlugSha256:'2'.repeat(64),containerParentIdSha256:'3'.repeat(64),projectReadbackSha256:'4'.repeat(64),fieldsRead:false};
  await cap.externalRead(()=>{callbacks++;return receipt;},projectMap.descriptor);
  const map=nativeAMap(nativeAKeys,projectMap),proof=nativeAProof('remaining',map,publicSource,projectMap,config,ownerHash,receipt);
  proof.targetProofs.at(-1).aclParentIdSha256='0'.repeat(64);
  await cap.registerPublisherAReads({phase:'remaining',map,proof});callbacks++;
 }),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 assert.equal(callbacks,4);assert.equal(j.events.length,67);assert.equal(j.events.at(-1).key,'A:original-project');assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,true);assert.equal(j.publisherAReadiness.length,1);assert.equal(j.stages['A:original-container-acl'],undefined);assert.equal(j.pending,null);
});

for(const [kind,step,expectedEvents] of [
 ['first A UI before readiness','unregistered',63],
 ['P refresh before first A UI','registered',63],
 ['userinfo before refresh','trial',64],
 ['A project before P2','trial',64],
 ['PREP pause after readiness','registered',63],
 ['thin before final A receipt','thin-partial',74],
 ['H before full plan','registered',63]
])test(`native phased readiness refuses ${kind} without a new callback`,async()=>{
 const {s,config,owner,publicSource,projectMap}=await nativePredebitFixture(true);let callbacks=0;
 await assert.rejects(owner.withContinuation(async cap=>{
  const baseline=step==='thin-partial'
   ?await completeNativeAReadiness(cap,s,config,publicSource,projectMap,()=>{callbacks++;},'original-container-acl')
   :await prepareNativeARegistration(cap,s);
  const request=step==='thin-partial'?null:nativeAInitialRequest(s,config,publicSource,projectMap);
  if(step!=='unregistered'&&step!=='thin-partial')await cap.registerPublisherAReads(request);
  if(step==='trial')await cap.browserRead(()=>{callbacks++;return JSON.parse(snapshot);},baseline[2].descriptor);
  if(kind==='first A UI before readiness')await cap.browserRead(()=>{callbacks++;return JSON.parse(snapshot);},baseline[2].descriptor);
  if(kind==='P refresh before first A UI')await cap.externalRead(()=>{callbacks++;},request.map[0].descriptor);
  if(kind==='userinfo before refresh')await cap.externalRead(()=>{callbacks++;},request.map[1].descriptor);
  if(kind==='A project before P2')await cap.externalRead(()=>{callbacks++;return nativeAProjectReceipt(publicSource);},projectMap.descriptor);
  if(kind==='PREP pause after readiness')await cap.pausePreparation();
  if(kind==='thin before final A receipt'){
   const checkpoint=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
   const mapped=checkpoint.publisherStages.flatMap(stage=>stage.map.map(row=>row.descriptor.id));
   const settled=new Set(checkpoint.events.filter(event=>event.settled===true&&event.success===true).map(event=>event.operation.id));
   assert.equal(checkpoint.publisherAReadiness.length,2);assert.equal(checkpoint.events.length,74);
   assert(mapped.every(id=>settled.has(id)));assert.equal(checkpoint.events.slice(55).filter(event=>event.lane==='ui'&&!event.cleanup).length,12);
   assert.equal(checkpoint.completed.includes('A:original-container-acl'),false);
   const map=Array.from({length:21},(_,index)=>({...futureMeta({id:`future-thin-premature-${index}`,key:'N:navigation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:false}),tabId:'current-tab'}));
   await cap.stagePublisher({stage:'thin',stageCap:21,map});
  }
  if(kind==='H before full plan'){
   const rule=SIMPLE_RULES['H:wrapper-compatibility-rpc'];
   const h={id:'future-h-before-plan',bucket:'H',alias:'wrapper-compatibility-rpc',actor:rule.actor,target:rule.target,operation:rule.methods[0],units:1};
   assert.deepEqual(simpleFixed(h),h);
   await cap.dispatchCompatibility({operation:h,credentialExpiresAt:s.time+600000},()=>{callbacks++;});
  }
 }),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 assert.equal(j.events.length,expectedEvents);assert.equal(callbacks,step==='thin-partial'?11:step==='trial'?1:0);assert.equal(j.plan,null);assert.equal(j.pending,null);assert.equal(j.publisherStages.length,2);
 assert.equal(j.publisherAReadiness?.length,step==='unregistered'?undefined:step==='thin-partial'?2:1);
});

test('malformed charged A project receipt cannot open remaining A registration',async()=>{
 const {s,config,owner,publicSource,projectMap}=await nativePredebitFixture(true);let callbacks=0;
 await assert.rejects(owner.withContinuation(async cap=>{
  const baseline=await prepareNativeARegistration(cap,s),request=nativeAInitialRequest(s,config,publicSource,projectMap);
  await cap.registerPublisherAReads(request);
  await cap.browserRead(()=>{callbacks++;return JSON.parse(snapshot);},baseline[2].descriptor);
  for(const row of request.map)await cap.externalRead(()=>{callbacks++;return {source:'synthetic-credential'};},row.descriptor);
  await cap.externalRead(()=>{callbacks++;return {...nativeAProjectReceipt(publicSource),containerParentIdSha256:'not-a-digest'};},projectMap.descriptor);
 }),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 assert.equal(callbacks,4);assert.equal(j.events.length,67);assert.equal(j.events.at(-1).key,'A:original-project');assert.equal(j.events.at(-1).projectReceipt,undefined);assert.equal(j.publisherAReadiness.length,1);assert.equal(j.stages['A:original-container-acl'],undefined);
});

test('a new failed A UI debit stops before any P or remaining A registration',async()=>{
 const {s,config,owner,publicSource,projectMap}=await nativePredebitFixture(true);let callbacks=0;
 await assert.rejects(owner.withContinuation(async cap=>{
  const baseline=await prepareNativeARegistration(cap,s),request=nativeAInitialRequest(s,config,publicSource,projectMap);
  await cap.registerPublisherAReads(request);
  await cap.browserRead(()=>{callbacks++;throw Error('synthetic-first-a-failure');},baseline[2].descriptor);
  await cap.registerPublisherAReads({phase:'remaining',map:nativeAMap(nativeAKeys,projectMap),proof:{}});
 }),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 assert.equal(callbacks,1);assert.equal(j.events.length,64);assert.equal(j.events.at(-1).success,false);assert.equal(j.publisherAReadiness.length,1);assert.equal(j.completed.includes('P:publisher-refresh'),false);assert.equal(j.plan,null);
});

for(const [kind,change] of [
 ['omitted registered A',plan=>{plan.operations=plan.operations.filter(row=>!(row.bucket==='A'&&row.alias==='original-container-acl'));}],
 ['relabeled registered P',plan=>{const row=plan.operations.find(row=>row.bucket==='P'&&row.alias==='publisher-refresh');row.id='future-renamed-publisher-refresh';}]
])test(`full native plan rejects ${kind} without an H callback`,async()=>{
 const {s,config,owner,publicSource,projectMap}=await nativePredebitFixture(true);let callbacks=0;
 await assert.rejects(owner.withContinuation(async cap=>{
  const baseline=await completeNativeAReadiness(cap,s,config,publicSource,projectMap,()=>{callbacks++;});
  const plan=nativeRegisteredAPlan(s,baseline,projectMap);change(plan);
  await cap.completePlan(plan);
 }),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 assert.equal(callbacks,12);assert.equal(j.events.length,75);assert.equal(j.plan,null);assert.equal(j.pending,null);assert.equal(j.publisherAReadiness.length,2);assert.equal(j.stages['A:original-container-acl'].id,'future-original-container-acl');
});

for(const [kind,change] of [
 ['pending',j=>{j.pending=j.events.at(-1).operation.id;}],
 ['new failed event',j=>{j.events.at(-1).success=false;}]
])test(`forged ${kind} checkpoint cannot register native P2`,async()=>{
 const {s,config,owner,publicSource,projectMap,registry}=await nativePredebitFixture(true);let callbacks=0;
 await assert.rejects(owner.withContinuation(async cap=>{
  await prepareNativeARegistration(cap,s);
  const path=s.path+'.simple-publisher-native-predebit-recovery.json',journal=JSON.parse(readFileSync(path));change(journal);s.put(path,compact(journal));
  const record=JSON.parse(readFileSync(registry)),value={...record.value,checkpoint:journal};s.put(registry,compact({value,sha256:hash(compact(value))}));
  await cap.registerPublisherAReads(nativeAInitialRequest(s,config,publicSource,projectMap));callbacks++;
 }),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 assert.equal(callbacks,0);assert.equal(j.events.length,63);assert.equal(j.publisherAReadiness,undefined);assert.equal(j.plan,null);
});

test('synthetic predebit HARD_STOP55 admits one same-checkpoint owner through the real controller',async()=>{
 const {standardEnv,s,origin,stopped,config,create,owner,registry}=await nativePredebitFixture();
 s.time+=1000;let callbacks=0;
 await owner.withContinuation(async cap=>{const view=await cap.inspect();assert.equal(view.combinedSpent,128);assert.equal(view.mainSpent,53);assert.equal(view.uiSpent,75);assert.equal(view.eventCount,55);assert.equal(view.pending,null);assert.equal(view.w0,null);assert.equal(view.failures,stopped.failures);await cap.pausePreparation();});
 assert.equal(callbacks,0);const active=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
 assert.deepEqual(active.events,stopped.events);assert.deepEqual(active.nativeImported,stopped.nativeImported);assert.deepEqual(active.publisherImported,stopped.publisherImported);assert.equal(active.failures,stopped.failures);assert.equal(active.publisherStages[0].stageCap,9);
 assert.equal(active.lifecycle,'CLEAN_PAUSE');assert.equal(JSON.parse(readFileSync(origin.journal.path)).lifecycle,'HARD_STOP');
 assert.equal(hash(readFileSync(origin.journal.path)),origin.journal.sha256);assert.equal(hash(readFileSync(origin.claim.path)),origin.claim.sha256);assert.equal(hash(readFileSync(origin.stop.path)),origin.stop.sha256);
 const receipt=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery-transition.json'));assert.equal(receipt.status,'PREPARED');assert.deepEqual(receipt.origin,origin);
 const handoff=owner.preparationHandoff();s.time+=1000;const nextConfig={...config,resume:{...config.resume,...handoff}};
 const recoveryBase=s.path+'.simple-publisher-native-predebit-recovery',claimPath=recoveryBase+'-claim.json',transitionPath=recoveryBase+'-transition.json';
 for(const [label,path,damage] of [
  ['missing archive',receipt.archive.journal.path,()=>unlinkSync(receipt.archive.journal.path)],
  ['corrupt archive',receipt.archive.stop.path,()=>writeFileSync(receipt.archive.stop.path,'{}')],
  ['target claim hash',transitionPath,()=>writeFileSync(transitionPath,compact({...receipt,targetClaimSha256:'0'.repeat(64)}))],
  ['target journal hash',transitionPath,()=>writeFileSync(transitionPath,compact({...receipt,targetJournalSha256:'0'.repeat(64)}))],
  ['target owner',transitionPath,()=>writeFileSync(transitionPath,compact({...receipt,ownerHash:'0'.repeat(64)}))]
 ]){
  const before=readFileSync(path),oldClaim=readFileSync(claimPath),oldRegistry=readFileSync(registry);let entered=0;
  try{
   damage();
   await assert.rejects(create(nextConfig).withContinuation(()=>{entered++;}),/TRIAL_STOPPED/,label);
   assert.equal(entered,0,label);assert.deepEqual(readFileSync(claimPath),oldClaim,label);assert.deepEqual(readFileSync(registry),oldRegistry,label);
  }finally{writeFileSync(path,before,{mode:0o600});}
 }
 const next=create(nextConfig);
 const diagnostic=bootstrapRows();
 await next.withContinuation(async cap=>{
  const view=await cap.inspect();assert.equal(view.combinedSpent,128);assert.equal(view.eventCount,55);assert.equal(view.pending,null);
  const registered=await cap.stagePublisher({stage:'diagnostic',stageCap:3,map:diagnostic});assert.equal(registered.futureUiSpent,0);
  for(const [index,row] of diagnostic.entries())await cap.browserRead(()=>bootstrapResult(index),row.descriptor);
  const after=await cap.inspect();assert.equal(after.combinedSpent,131);assert.equal(after.uiSpent,78);assert.equal(after.eventCount,58);assert.equal(after.futureUiLimit,73);assert.equal(after.futureUiSpent,3);assert.equal(after.readonlyIncidents,2);assert.equal(after.repairCalls,6);assert.equal(after.diagnosticCalls,3);assert.equal(after.bootstrapIdentity,'PENDING');
  await cap.pausePreparation();
 });
 const bootstrap=JSON.parse(readFileSync(recoveryBase+'.json'));assert.equal(bootstrap.publisherStages[0].stageCap,9);assert.equal(bootstrap.publisherStages[1].stageCap,3);assert.equal(bootstrap.futureOrdinaryUi,61);assert.equal(bootstrap.bootstrapIdentity,'PENDING');assert.deepEqual(bootstrap.events.slice(55).map(e=>e.operation.id),diagnostic.map(row=>row.descriptor.id));
 const bootstrapHandoff=next.preparationHandoff();s.time+=1000;
 const afterBootstrap=create({...config,resume:{...config.resume,...bootstrapHandoff}});
 await afterBootstrap.withContinuation(async cap=>{
  const view=await cap.inspect();assert.equal(view.combinedSpent,131);assert.equal(view.eventCount,58);assert.equal(view.futureUiSpent,3);assert.equal(view.bootstrapIdentity,'PENDING');
  const baseline=bootstrap.publisherStages[0].map;
  await cap.browserRead(()=>({source:'publisher-baseline-navigation-v1',status:'AWAITING_NEXT_PROJECTION',browserId:'current-browser',tabId:'current-tab',url:contract.settingsURL,fieldsRead:false}),baseline[0].descriptor);
  const beforeIdentity=await cap.inspect();assert.equal(beforeIdentity.bootstrapIdentity,'PENDING');assert.equal(beforeIdentity.combinedSpent,132);
  await cap.browserRead(()=>({source:'publisher-baseline-identity-v1',status:'VERIFIED',browserId:'current-browser',tabId:'current-tab',url:contract.settingsURL,projectHash:'b'.repeat(64),principalHash:contract.publisherHash,readyState:'COMPLETE',fieldsRead:false}),baseline[1].descriptor);
  const grounded=await cap.inspect();assert.equal(grounded.bootstrapIdentity,'VERIFIED');assert.equal(grounded.combinedSpent,133);assert.equal(grounded.uiSpent,80);assert.equal(grounded.futureUiSpent,5);await cap.pausePreparation();
 });
 const grounded=JSON.parse(readFileSync(recoveryBase+'.json'));assert.equal(grounded.bootstrapIdentity,'VERIFIED');assert.equal(grounded.futureOrdinaryUi,61);assert.deepEqual(grounded.events.slice(58).map(e=>e.operation.id),bootstrap.publisherStages[0].map.slice(0,2).map(row=>row.descriptor.id));
 const groundedHandoff=afterBootstrap.preparationHandoff();s.time+=1000;
 const resumed=create({...config,resume:{...config.resume,...groundedHandoff}});
 await resumed.withContinuation(async cap=>{const view=await cap.inspect();assert.equal(view.combinedSpent,133);assert.equal(view.bootstrapIdentity,'VERIFIED');await cap.pausePreparation();});
 const incompleteHandoff=resumed.preparationHandoff();s.time+=1000;let prematureCalls=0;
 await assert.rejects(create({...config,resume:{...config.resume,...incompleteHandoff}}).withContinuation(async cap=>{
  await cap.stagePublisher({stage:'thin',stageCap:1,map:[futureMeta({id:'future-premature-thin',key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true})]});prematureCalls++;
 }),/TRIAL_STOPPED/);assert.equal(prematureCalls,0);
 assert.equal(JSON.parse(readFileSync(origin.journal.path)).lifecycle,'HARD_STOP');
 const replay=create(config);
 await assert.rejects(replay.withContinuation(()=>{callbacks++;}),/TRIAL_STOPPED/);assert.equal(callbacks,0);
 for(const [key,entry] of Object.entries(standardEnv)){assert.equal(Object.hasOwn(process.env,key),entry.present);assert.equal(process.env[key],entry.value);}
});

test('predebit bootstrap refuses baseline spending and reordered diagnostics before callbacks',async()=>{
 for(const kind of ['baseline-first','diagnostic-reordered','diagnostic-duplicate-map']){
  const {s,owner,origin}=await nativePredebitFixture(),diagnostic=bootstrapRows();let callbacks=0;
  s.time+=1000;
  await assert.rejects(owner.withContinuation(async cap=>{
   const before=await cap.inspect();assert.equal(before.combinedSpent,128);assert.equal(before.eventCount,55);
   if(kind==='baseline-first')await cap.browserRead(()=>{callbacks++;return {synthetic:true};},{id:'future-baseline-settings-goto',key:'N:preparation',actor:'publisher',target:'original-settings',operation:'navigate',units:1,preparation:true});
   else if(kind==='diagnostic-reordered'){
    await cap.stagePublisher({stage:'diagnostic',stageCap:3,map:diagnostic});
    await cap.browserRead(()=>{callbacks++;return {synthetic:true};},diagnostic[1].descriptor);
   }else await cap.stagePublisher({stage:'diagnostic',stageCap:3,map:[diagnostic[0],diagnostic[0],diagnostic[2]]});
  }),/TRIAL_STOPPED/,kind);
  assert.equal(callbacks,0,kind);
  const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
  assert.equal(j.events.length,55,kind);assert.equal(j.publisherStages[0].stageCap,9,kind);assert.equal(j.publisherStages.length,kind==='diagnostic-reordered'?2:1,kind);
  assert.equal(hash(readFileSync(origin.journal.path)),origin.journal.sha256,kind);
 }
});

test('context is not identity; ambiguous context and Settings principal stop with their debits',async()=>{
 for(const kind of ['context-only','wrong-context','wrong-principal']){
  const {s,owner,origin}=await nativePredebitFixture(),diagnostic=bootstrapRows();let forbiddenCalls=0;s.time+=1000;
  await assert.rejects(owner.withContinuation(async cap=>{
   await cap.stagePublisher({stage:'diagnostic',stageCap:3,map:diagnostic});
   for(const [index,row] of diagnostic.entries())await cap.browserRead(()=>index===2&&kind==='wrong-context'?{...bootstrapResult(index),projectHash:'0'.repeat(64)}:bootstrapResult(index),row.descriptor);
   const baseline=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json')).publisherStages[0].map;
   if(kind==='context-only')await cap.externalRead(()=>{forbiddenCalls++;return {synthetic:true};},baseline[2].descriptor);
   else {
    await cap.browserRead(()=>({source:'publisher-baseline-navigation-v1',status:'AWAITING_NEXT_PROJECTION',browserId:'current-browser',tabId:'current-tab',url:contract.settingsURL,fieldsRead:false}),baseline[0].descriptor);
    await cap.browserRead(()=>({source:'publisher-baseline-identity-v1',status:'VERIFIED',browserId:'current-browser',tabId:'current-tab',url:contract.settingsURL,projectHash:'b'.repeat(64),principalHash:'0'.repeat(64),readyState:'COMPLETE',fieldsRead:false}),baseline[1].descriptor);
   }
  }),/TRIAL_STOPPED/,kind);
  const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-predebit-recovery.json'));
  assert.equal(forbiddenCalls,0,kind);assert.equal(j.state,'stopped',kind);assert.equal(j.bootstrapIdentity,'PENDING',kind);assert.equal(j.events.length,kind==='wrong-principal'?60:58,kind);
  assert.equal(j.publisherAlignment.readonlyIncidents,2,kind);assert.equal(j.publisherAlignment.repairCalls,6,kind);
  assert.equal(hash(readFileSync(origin.journal.path)),origin.journal.sha256,kind);
  if(kind==='context-only')assert.equal(j.pending,null,kind);
  else {assert.equal(j.events.at(-1).settled,false,kind);assert.equal(j.pending,j.events.at(-1).operation.id,kind);}
 }
});

async function nativeSuccessorFixture(finalSpent=128){
 const s=await alignmentFixture(),{flow}=flowFixture(s,null,{snapshots:{'thin-settings':snapshot,'oauth-audience':JSON.stringify({...JSON.parse(snapshot),accountVerified:false})}});
 const stopped=await flow.run();assert.equal(stopped.status,'HARD_STOP');assert.equal(s.aligned().events.length,55);
 const make=(name,value)=>{const path=join(s.home,'native15-'+name+'.json');s.put(path,typeof value==='string'||Buffer.isBuffer(value)?value:compact(value));return {path,sha256:hash(readFileSync(path))};};
 const old=s.path+'.simple-publisher-alignment',live={journal:old+'.json',claim:old+'-claim.json',stop:old+'-stop.json',registry:join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-rebalanced.json')};
 const origin=Object.fromEntries(Object.entries(live).map(([k,path])=>[k,make('origin-'+k,readFileSync(path))]));
 origin.receipt=make('origin-receipt',{source:'synthetic-111-receipt',spent:111,settled:true});origin.audit=make('origin-audit',{source:'synthetic-111-audit',mainSpent:53,uiSpent:58,allSettled:true});
 const currentBrowserId='current-browser',currentTabId='current-tab',contractPin=make('contract',contract),context=make('context',{source:'native-current-project-context-v1',publisherHash:contract.publisherHash,browserId:currentBrowserId,tabId:currentTabId,url:contract.audienceURL,projectHash:'b'.repeat(64)}),approval=make('approval',{source:'direct-human-connection118-continuation',directHuman:true,approved:true,scope:'CONNECTION118_BOUNDED_NATIVE',startingSpent:118,maximumAdditionalPrimitives:13,operationBudget:296}),validatorSource=make('validator-source','synthetic-reviewed-verifier'),sourceReview=make('source-review',{source:'synthetic-reviewed-source',approved:true}),ci=make('ci',{source:'synthetic-ci',passed:true});
 const charges=[];let priorOutcomeSha256=origin.journal.sha256;
 const stages=['diagnostic111','diagnostic111','diagnostic111','audience114','audience114','audience114','native117','discovery118','BIND','OPEN_TABS','CLAIM','GUARD','CAPTURE','GUARD','GUARD','CAPTURE','GUARD','GUARD','CAPTURE','GUARD'];
 for(let spent=112;spent<=finalSpent;spent++){
  const n=spent-111,stage=stages[n-1],nonce=n<=6?null:hash('nonce-'+n).slice(0,32),commandSha256=n<=6?null:hash('command-'+n),reservationAt=n>=9?s.time/1000+n:null,outcome=[114,117].includes(spent)?'VERIFICATION_REJECTED':spent===118?'REJECTED':'VERIFIED',reservation=make('reservation-'+n,{source:'synthetic-reservation',spent,stage,...(nonce?{nonce,commandSha256}:{}),priorOutcomeSha256,...(reservationAt?{reserveTime:reservationAt}:{})}),settlement=make('settlement-'+n,{source:'synthetic-settlement',spent,stage,...(nonce?{nonce,commandSha256}:{}),reservationSha256:reservation.sha256,settled:true,pending:null,outcome});
  charges.push({spent,stage,nonce,commandSha256,priorOutcomeSha256,reservation,settlement,outcome,reservationAt,providerCallAt:null});priorOutcomeSha256=settlement.sha256;
 }
 const beforeGuard=make('before-guard',{source:'synthetic-guard',urlMatched:true,ready:true,projectMatched:true}),screenshot=make('screenshot','synthetic-image-bytes'),afterGuard=make('after-guard',{source:'synthetic-guard',urlMatched:true,ready:true,projectMatched:true});
 const attestation=make('attestation',{source:'parent-native-b-visual-attestation-v1',observedPrincipalHash:contract.publisherHash,expectedPrincipalHash:contract.publisherHash,browserId:currentBrowserId,tabId:currentTabId,url:contract.audienceURL,projectHash:'b'.repeat(64),screenshotSha256:screenshot.sha256,beforeGuardSha256:beforeGuard.sha256,afterGuardSha256:afterGuard.sha256,sameHandle:true,samePage:true,menuOpen:true,manualObservation:true});
 const faultSource=make('fault-source',{source:'audience114-actual-three-read-structure-closure',originalGlobalRepairCallsUsed:6,originalGlobalRepairCallsRemaining:0}),faultHighwaters={globalRepairCallsUsed:6,globalRepairCallsRemaining:0,readonlyIncidents:2,importedFailedCalls:3};
 const closure=make('closure',{source:'publisher-native-successor-closure-v1',origin,contract:contractPin,context,approval,validatorSource,sourceReview,ci,faultSource,faultHighwaters,charges,visual:{beforeGuard,screenshot,afterGuard,attestation},finalSpent,mainSpent:53,uiSpent:finalSpent-53,operationBudget:296,pending:null,allSettled:true});
 alignment(s).nativeSuccessor={closure};s.cfg.resume={nativeSuccessor:true};s.time+=1000;
 return {s,closure,origin,charges,attestation,live};
}

const fullFixedPlan=()=>Object.entries(SIMPLE_RULES).map(([key,rule])=>({id:'native-plan-'+key.replace(':','.'),bucket:key[0],alias:key.slice(2),actor:rule.actor,target:rule.target,operation:rule.methods[0],units:1}));
const nativePlanRows=()=>SIMPLE_NATIVE.map((key,index)=>{const rule=SIMPLE_RULES[key],writing=rule.methods.some(method=>['click','fill'].includes(method));return {id:`future-native-${index}`,key,actor:rule.actor,target:rule.target,operation:writing?rule.methods[0]:'snapshot',units:1,preparation:false};});
const recoveryPlanRows=()=>Object.entries(SIMPLE_RULES).filter(([key,rule])=>(key.startsWith('I:')||key.startsWith('J:'))&&!rule.methods.some(method=>['POST','PUT','PATCH','DELETE'].includes(method))).map(([key,rule],index)=>({id:`native-recovery-${index}`,key,actor:rule.actor,target:rule.target,operation:rule.methods.some(method=>['click','fill'].includes(method))?rule.methods[0]:'snapshot',units:1,preparation:false}));
const completeNativePlan=()=>({operations:fullFixedPlan().map(row=>['P:publisher-refresh','P:publisher-userinfo','B:fixture-import'].includes(row.bucket+':'+row.alias)?{...row,id:'future-'+row.alias}:row),browserOperations:[...nativePlanRows(),...Array.from({length:50},(_,index)=>({id:`future-navigation-${index}`,key:'N:navigation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:false})),...recoveryPlanRows()]});
const futureMeta=(descriptor,cleanup=[])=>({lane:'ui',descriptor,tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:descriptor.id,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup,repairIncident:null});

async function nativePrepPauseFixture(extra=0,prePauseExtra=0){
 const {s,closure,origin,live}=await nativeSuccessorFixture();
 const descriptors=[
  {id:'future-baseline-settings-goto',key:'N:preparation',actor:'publisher',target:'original-settings',operation:'navigate',units:1,preparation:true},
  {id:'future-baseline-settings-project',key:'N:preparation',actor:'publisher',target:'original-settings',operation:'evaluate',units:1,preparation:true},
  {id:'future-baseline-cloud',key:'A:original-cloud-backup',actor:'publisher',target:'original-settings',operation:'snapshot',units:1,preparation:false},
  {id:'future-baseline-properties',key:'A:original-properties-backup',actor:'publisher',target:'original-settings',operation:'read-key-presence',units:1,preparation:false},
  {id:'future-baseline-triggers-goto',key:'N:navigation',actor:'publisher',target:'original-triggers',operation:'navigate',units:1,preparation:false},
  {id:'future-baseline-triggers-read',key:'A:original-triggers-backup',actor:'publisher',target:'original-triggers',operation:'snapshot',units:1,preparation:false}
 ];
 const write={...fullFixedPlan().find(row=>row.bucket==='D'&&row.alias==='thin-properties-write'),id:'future-baseline-thin-properties-write'};
 const recovery={id:'cleanup-baseline-thin-guard',key:'I:restore-thin-guard',actor:'publisher',target:'thin-settings',operation:'click',units:1,preparation:false};
 const cleanup={lane:'ui',descriptor:recovery,target:'thin-settings',tabId:'synthetic-tab',url:'https://synthetic.invalid/thin-settings',callback:recovery.id,receipt:'EXACT_WRITE_READBACK'};
 const recoveryRead={id:'cleanup-baseline-read-original-triggers',key:'I:read-original-triggers',actor:'publisher',target:'original-triggers',operation:'snapshot',units:1,preparation:false};
 const cleanupRead={lane:'ui',descriptor:recoveryRead,target:'original-triggers',tabId:'synthetic-tab',url:'https://synthetic.invalid/original-triggers',callback:recoveryRead.id,receipt:'SANITIZED_READ'};
 const more=[
  {id:'future-baseline-original-triggers-goto',key:'N:preparation',actor:'publisher',target:'original-triggers',operation:'navigate',units:1,preparation:true},
  {id:'future-baseline-original-triggers-project',key:'N:preparation',actor:'publisher',target:'original-triggers',operation:'evaluate',units:1,preparation:true},
  {id:'future-baseline-original-settings-return',key:'N:preparation',actor:'publisher',target:'original-settings',operation:'navigate',units:1,preparation:true}
 ].slice(0,extra);
 const map=[...descriptors.concat(more).map(row=>futureMeta(row)),{...futureMeta(write,[cleanup,cleanupRead]),lane:'main',receipt:'EXACT_WRITE_READBACK'}];
 const owner=holder(s,{resume:{nativeSuccessor:true}},p=>{if(p.stage==='loading-result'){assert([descriptors[1].id,more[1]?.id].includes(p.operation.id));assert.equal(p.result.accountVerified,true);}},()=>closure.sha256);
 let callbacks=0,phase='start';
 try{await owner.withContinuation(async cap=>{
  phase='stage';await cap.stagePublisher({stage:'baseline',stageCap:6+extra,map});
  phase='goto';await cap.browserRead(()=>{callbacks++;return {kind:'synthetic-goto'};},descriptors[0]);
  phase='projection';await cap.browserRead(()=>{callbacks++;return {accountVerified:true,fieldsRead:false};},descriptors[1]);
  for(const row of more.slice(0,prePauseExtra)){phase=row.id;await cap.browserRead(()=>{callbacks++;return row.operation==='evaluate'?{accountVerified:true,fieldsRead:false}:{kind:'synthetic-goto'};},row);}
  phase='pause';const paused=await cap.pausePreparation();assert.equal(paused.lifecycle,'CLEAN_PAUSE');
 });}catch(error){const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));throw Error(`prep ${phase}: ${error.message}; events=${j.events.length}; pending=${j.pending}; last=${JSON.stringify(j.events.at(-1))}`);}
 assert.equal(callbacks,2+prePauseExtra);
 return {s,closure,origin,live,descriptors,more,map,owner,handoff:owner.preparationHandoff(),recoveryRead};
}

function forwardJourneyPlan(){
 const operations=fullFixedPlan().map(row=>({...row,id:'future-main-'+row.bucket+'-'+row.alias}));
 const native=nativePlanRows();
 const trigger=phase=>({id:`future-trigger-${phase}`,key:`N:thin-triggers-${phase}`,actor:'publisher',target:'thin-triggers',operation:'snapshot',units:1,preparation:false});
 const navigation=Array.from({length:4},(_,index)=>({id:`future-fresh-navigation-${index}`,key:'N:navigation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:false}));
 const terminal={id:'future-terminal-observation',key:'N:navigation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:false};
 const recovery=recoveryPlanRows();
 return {operations,browserOperations:[...native,trigger('before'),trigger('after'),...navigation,terminal,...recovery],native,trigger,navigation,terminal,recovery};
}

async function runNativeForwardJourney(unknownH=false){
 const {s,closure,origin}=await nativeSuccessorFixture(),original=readFileSync(origin.journal.path),plan=forwardJourneyPlan(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 const main=key=>plan.operations.find(row=>row.bucket+':'+row.alias===key),calls=[];let phase='start';
 const mainRecovery=plan.operations.filter(row=>['I','J'].includes(row.bucket)),uiRecovery=plan.recovery;let mainRecoveryIndex=0,uiRecoveryIndex=0;
 const clean=row=>({lane:row.key?'ui':'main',descriptor:row,target:row.target,tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:row.id,receipt:['GET','snapshot','read-key-presence'].includes(row.operation)?'SANITIZED_READ':'EXACT_WRITE_READBACK'});
 const mappedMain=row=>{const write=!['GET','snapshot','read-key-presence'].includes(row.operation),cleanup=write?[clean(mainRecovery[mainRecoveryIndex++])]:[];return {...futureMeta(row,cleanup),lane:'main',receipt:write?'EXACT_WRITE_READBACK':'SANITIZED_READ'};};
 const mappedUi=row=>{const write=!['GET','snapshot','read-key-presence'].includes(row.operation),cleanup=write?[clean(uiRecovery[uiRecoveryIndex++])]:[];return {...futureMeta(row,cleanup),receipt:write?'EXACT_WRITE_READBACK':'SANITIZED_READ'};};
 const nativeKeys=new Set(SIMPLE_NATIVE),prefix=key=>key.split(':')[0],bucket=(...letters)=>plan.operations.filter(row=>letters.includes(row.bucket)&&!nativeKeys.has(row.bucket+':'+row.alias));
 const f=phase=>plan.operations.filter(row=>row.bucket==='F'&&row.alias.startsWith(`wrapper-${phase}.`)&&!nativeKeys.has(row.bucket+':'+row.alias));
 const g=phase=>plan.operations.filter(row=>row.bucket==='G'&&row.alias.startsWith(`wrapper-${phase}.`));
 const native=(...letters)=>plan.native.filter(row=>letters.includes(prefix(row.key)));
 const nativeF=phase=>plan.native.filter(row=>row.key.startsWith(`F:wrapper-${phase}.`));
 const baseline=Array.from({length:6},(_,index)=>({id:`future-forward-baseline-${index}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true}));
 const stage=async(cap,name,rows,mainRows)=>{phase='map '+name;const map=[...rows.map(mappedUi),...mainRows.map(mappedMain)];phase='stage '+name;return cap.stagePublisher({stage:name,stageCap:rows.length,map});};
 const spendUi=async(cap,rows)=>{for(const row of rows){phase='ui '+row.id;await cap.browserRead(()=>{calls.push(row.id);return {synthetic:true};},row);if(!row.key.startsWith('N:')){phase='ui complete '+row.id;await cap.completeBrowserOperation(row.key);}}};
 const spendMain=async(cap,rows)=>{for(const row of rows){phase='main '+row.id;await cap.externalRead(()=>{calls.push(row.id);return {synthetic:true};},row);}};
 try{await owner.withContinuation(async cap=>{
  const start=await cap.inspect();assert.equal(start.combinedSpent,128);assert.equal(start.w0,null);
  phase='complete plan';await cap.completePlan({operations:plan.operations,browserOperations:plan.browserOperations});
  await stage(cap,'baseline',baseline,bucket('P'));await spendUi(cap,baseline);await spendMain(cap,bucket('P'));
  const thinRows=[...native('A','D'),plan.trigger('before')],thinMain=bucket('A','B','D');
  await stage(cap,'thin',thinRows,thinMain);await spendUi(cap,thinRows);await spendMain(cap,thinMain);
  const w0=(await cap.inspect()).w0;assert(Number.isSafeInteger(w0));
  const oauthRows=native('E'),oauthMain=bucket('E');await stage(cap,'oauth',oauthRows,oauthMain);await spendUi(cap,oauthRows);await spendMain(cap,oauthMain);
  const before=[...f('before'),...g('before')],after=[...f('after'),...g('after')],beforeUi=nativeF('before'),afterUi=nativeF('after'),h=main('H:wrapper-compatibility-rpc'),terminal=bucket('T');
  await stage(cap,'freshness',[...beforeUi,...afterUi,plan.trigger('after'),...plan.navigation],[...before,h,...after,...terminal]);assert.equal(plan.navigation.length+beforeUi.length+afterUi.length+1,15);
  await spendUi(cap,[...plan.navigation,...beforeUi]);await spendMain(cap,before);
  const beforeH=await cap.inspect();assert.equal(beforeH.pending,null);assert.equal(beforeH.w0,w0);
  const assertPrepaid=()=>{const paid=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));assert.equal(paid.pending,h.id);assert.equal(paid.rpc.beganAt,paid.events.at(-1).time);assert.equal(paid.chargedUpperBoundMs,360000);assert.equal(paid.events.at(-1).outcome,'UNKNOWN');};
  phase='H dispatch';if(unknownH){
   await assert.rejects(cap.dispatchCompatibility({operation:h,credentialExpiresAt:s.time+600000},()=>{assertPrepaid();calls.push(h.id);throw Error('SYNTHETIC_UNKNOWN');}),/TRIAL_STOPPED/);
   for(const row of terminal){phase='terminal '+row.id;await cap.terminalRead(()=>{calls.push(row.id);return {synthetic:'terminal-read'};},row);}
   phase='duplicate H';await assert.rejects(cap.dispatchCompatibility({operation:h,credentialExpiresAt:s.time+600000},()=>{calls.push('duplicate-H');}),/TRIAL_STOPPED/);
   return;
  }
  const response=await cap.dispatchCompatibility({operation:h,credentialExpiresAt:s.time+600000},()=>{assertPrepaid();calls.push(h.id);return {synthetic:'one-rpc'};});assert.deepEqual(response,{synthetic:'one-rpc'});
  await spendUi(cap,[...afterUi,plan.trigger('after')]);await spendMain(cap,after);
  await stage(cap,'terminal',[plan.terminal],[]);await spendUi(cap,[plan.terminal]);
  phase='finish';const done=await cap.finishCompatibility();assert.equal(done.rpc.complete,true);assert.equal(done.pending,null);assert.equal(done.w0,w0);assert.equal(done.chargedUpperBoundMs,360000);
 });if(unknownH)assert.fail('unknown H must stop its ordinary holder');}catch(error){if(!unknownH){const failed=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));assert.fail(`${phase}: ${error.message}; events=${failed.events.length}; pending=${failed.pending}; last=${JSON.stringify(failed.events.at(-1))}`);}assert.match(error.message,/TRIAL_STOPPED/);}
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 if(unknownH){
  assert.equal(calls.filter(id=>id==='future-main-H-wrapper-compatibility-rpc').length,1);assert.equal(calls.includes('duplicate-H'),false);assert.equal(calls.filter(id=>id.startsWith('future-main-T-')).length,3);
  assert.equal(j.rpc.complete,false);assert(Number.isSafeInteger(j.rpc.beganAt));assert.equal(j.chargedUpperBoundMs,360000);assert.equal(j.pending,null);assert.equal(j.state,'stopped');
  const spent=j.events.length;await owner.withCleanup(async cap=>{const before=await cap.inspect();assert.equal(before.eventCount,spent);const read=main('I:read-original-editor');await cap.externalRead(()=>{calls.push(read.id);return {synthetic:'cleanup-read'};},read);const after=await cap.inspect();assert.equal(after.eventCount,spent+1);assert.equal(after.rpc.complete,false);assert.equal(after.w0,j.w0);});
  assert.equal(calls.filter(id=>id==='future-main-I-read-original-editor').length,1);assert(readFileSync(origin.journal.path).equals(original));return;
 }
 assert.equal(calls.filter(id=>id==='future-main-H-wrapper-compatibility-rpc').length,1);assert.deepEqual(j.publisherStages.map(stage=>stage.stageCap),[6,7,5,15,1]);assert.equal(j.rpc.complete,true);assert.equal(j.pending,null);assert.equal(j.chargedUpperBoundMs,360000);
 const hIndex=j.events.findIndex(event=>event.key==='H:wrapper-compatibility-rpc');assert(hIndex>55);assert.equal(j.events.filter(event=>event.key.startsWith('F:wrapper-after.')).length,16);assert.equal(j.events.filter(event=>event.key.startsWith('G:wrapper-after.')).length,2);assert.equal(j.events.slice(hIndex+1).filter(event=>event.key.startsWith('F:wrapper-after.')).length,16);assert.equal(j.events.slice(hIndex+1).filter(event=>event.key.startsWith('G:wrapper-after.')).length,2);assert(readFileSync(origin.journal.path).equals(original));
}
test('native 128 full forward journey debits one H and finishes after independent readbacks',()=>runNativeForwardJourney());
test('unknown native H never replays, allows exact terminal reads and independent cleanup',()=>runNativeForwardJourney(true));

test('native 128 PREP pause resumes from its latest genuine holder receipt without replay',async()=>{
 const {s,closure,origin,map,owner,handoff}=await nativePrepPauseFixture(),originBytes=readFileSync(origin.journal.path);
 const paused=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.equal(handoff.minimumEvents,57);assert.equal(paused.events.length,57);assert.equal(paused.lifecycle,'CLEAN_PAUSE');assert.equal(paused.phase,'PREP');assert.equal(paused.w0,null);assert.equal(paused.expiresAt,null);assert.equal(paused.pending,null);
 assert.equal(paused.events.slice(-2).every(e=>e.settled===true&&e.success===true),true);
 assert.equal(paused.events.filter(e=>e.lane==='main').length,0);assert.equal(paused.publisherStages[0].stageCap,6);assert.equal(paused.publisherStages[0].map.length,map.length);
 s.time+=1000;const resumed=holder(s,{resume:{nativeSuccessor:true,...handoff}},()=>{},()=>closure.sha256);
 let resumePhase='start';try{await resumed.withContinuation(async cap=>{
  resumePhase='inspect';
  const v=await cap.inspect();assert.equal(v.combinedSpent,130);assert.equal(v.mainSpent,53);assert.equal(v.uiSpent,77);assert.equal(v.w0,null);assert.equal(v.pending,null);assert.equal(v.rpc.beganAt,null);assert.equal(v.planReady,false);
  resumePhase='pause';await cap.pausePreparation();
 });}catch(error){const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));throw Error(`resume ${resumePhase}: ${error.message}; holders=${j.holders.length}; lifecycle=${j.lifecycle}; events=${j.events.length}`);}
 assert.equal(owner.preparationHandoff().receipt.sha256,handoff.receipt.sha256);
 const after=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.deepEqual(after.events,paused.events);assert.equal(after.publisherStages[0].stageCap,6);assert.equal(after.holders.length,paused.holders.length+1);
 assert.equal(after.connection.sourceChain.length,paused.connection.sourceChain.length+1);
 assert(readFileSync(origin.journal.path).equals(originBytes));
 let staleCalls=0;await assert.rejects(holder(s,{resume:{nativeSuccessor:true,...handoff}},()=>{},()=>closure.sha256).withContinuation(()=>{staleCalls++;}),/TRIAL_STOPPED/);assert.equal(staleCalls,0);
 const latest=resumed.preparationHandoff();s.time+=1000;const third=holder(s,{resume:{nativeSuccessor:true,...latest}},()=>{},()=>closure.sha256);
 await third.withContinuation(async cap=>{const v=await cap.inspect();assert.equal(v.combinedSpent,130);assert.equal(v.pending,null);await cap.pausePreparation();});
 const again=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));assert.deepEqual(again.events,paused.events);assert.equal(again.holders.length,paused.holders.length+2);
});

test('native PREP resume rejects forged or unsafe checkpoints before any callback',async()=>{
 const {s,closure,origin,live,handoff}=await nativePrepPauseFixture();s.time+=1000;
 const journal=s.path+'.simple-publisher-native-successor.json',claim=s.path+'.simple-publisher-native-successor-claim.json',receipt=handoff.receipt.path;
 const originals=Object.fromEntries([journal,claim,live.registry,receipt].map(path=>[path,readFileSync(path)]));let callbacks=0;
 const attempt=async resume=>{await assert.rejects(holder(s,{resume},()=>{},()=>closure.sha256).withContinuation(()=>{callbacks++;}),/TRIAL_STOPPED/);assert.equal(callbacks,0);};
 const intact=()=>{for(const [path,bytes] of Object.entries(originals))assert(readFileSync(path).equals(bytes),path);};
 await attempt({nativeSuccessor:true,receipt:{...handoff.receipt,sha256:'0'.repeat(64)},minimumEvents:handoff.minimumEvents});intact();
 await attempt({nativeSuccessor:true,...handoff,minimumEvents:handoff.minimumEvents-1});intact();
 await attempt({nativeSuccessor:true});intact();
 await assert.rejects(holder(s,{epoch:{...s.cfg.epoch,foreignCheckpoint:true},resume:{nativeSuccessor:true,...handoff}},()=>{},()=>closure.sha256).withContinuation(()=>{callbacks++;}),/TRIAL_STOPPED/);assert.equal(callbacks,0);intact();
 assert.throws(()=>holder(s,{resume:{nativeSuccessor:true,...handoff,minimumEvents:'57'}},()=>{},()=>closure.sha256),/TRIAL_STOPPED/);intact();
 s.put(live.registry,Buffer.concat([originals[live.registry],Buffer.from(' ')]));try{await attempt({nativeSuccessor:true,...handoff});}finally{s.put(live.registry,originals[live.registry]);}intact();
 const forge=change=>{
  const j=JSON.parse(originals[journal]);change(j);s.put(journal,compact(j));
  const reg=JSON.parse(originals[live.registry]),value={...reg.value,checkpoint:j};s.put(live.registry,compact({value,sha256:hash(compact(value))}));
  const r=JSON.parse(originals[receipt]);r.journalSha256=hash(readFileSync(journal));r.registrySha256=hash(readFileSync(live.registry));s.put(receipt,compact(r));
  return {nativeSuccessor:true,receipt:{path:receipt,sha256:hash(readFileSync(receipt))},minimumEvents:j.events.length};
 };
 for(const [name,change] of [
  ['pending',j=>{j.pending='future-baseline-settings-project';}],
  ['failed',j=>{j.events.at(-1).success=false;}],
  ['unsettled',j=>{j.events.at(-1).settled=false;}],
  ['trial',j=>{j.phase='TRIAL';}],
  ['w0',j=>{j.w0=s.time;}],
  ['rpc',j=>{j.rpc.beganAt=s.time;}],
  ['stopped',j=>{j.lifecycle='HARD_STOP';j.state='stopped';}],
  ['owner-hash',j=>{j.holder='0'.repeat(64);}],
  ['source-chain',j=>{j.connection.sourceChain.push({identitySha256:'0'.repeat(64),sources:[]});}],
  ['imported-connection-used',j=>{j.connection.used++;}],
  ['imported-loading-used',j=>{j.loading.used++;}],
  ['imported-holders-prefix',j=>{j.holders[0]='0'.repeat(64);}],
  ['derived-preparation-stage',j=>{j.preparationStages['future-baseline-settings-goto'].remainingOrdinaryUi++;}],
  ['derived-stage-browser',j=>{j.stageBrowser.pop();}],
  ['derived-main-stage',j=>{j.stages['D:thin-properties-write'].id='forged-stage';}],
  ['derived-recovery-map',j=>{j.recoveryBrowser.pop();}],
  ['paired-stage-recovery-cleanup',j=>{const main=j.publisherStages[0].map.find(row=>row.lane==='main'&&row.descriptor.bucket==='D'&&row.descriptor.alias==='thin-properties-write');const removed=new Set(main.cleanup.map(row=>row.descriptor.id));main.cleanup=[];j.recoveryBrowser=j.recoveryBrowser.filter(row=>!removed.has(row.id));}]
 ]){
  const resume=forge(change),forged=Object.fromEntries([journal,claim,live.registry,receipt].map(path=>[path,readFileSync(path)]));
  await attempt(resume).catch(error=>{throw Error(`${name}: ${error.message}`);});
  for(const [path,bytes] of Object.entries(forged))assert(readFileSync(path).equals(bytes),`${name}: ${path} changed before rejection`);
  for(const [path,bytes] of Object.entries(originals))s.put(path,bytes);intact();
 }
 s.put(live.stop,compact({source:'synthetic-stop'}));try{await attempt({nativeSuccessor:true,...handoff});}finally{unlinkSync(live.stop);}intact();
 const originBytes=readFileSync(origin.journal.path);s.put(origin.journal.path,Buffer.concat([originBytes,Buffer.from(' ')]));try{await attempt({nativeSuccessor:true,...handoff});}finally{s.put(origin.journal.path,originBytes);}intact();
});

test('native baseline cap nine maps and charges exactly three original-target PREP grounding rows',async()=>{
 const {s,closure,more,map,handoff}=await nativePrepPauseFixture(3,2);let callbacks=0;
 assert.equal(map.filter(row=>row.lane==='ui').length,9);
 assert.equal(handoff.minimumEvents,59);
 s.time+=1000;const resumed=holder(s,{resume:{nativeSuccessor:true,...handoff}},p=>{if(p.stage==='loading-result')assert.equal(p.result.accountVerified,true);},()=>closure.sha256);
 await resumed.withContinuation(async cap=>{
  const before=await cap.inspect();assert.equal(before.combinedSpent,132);assert.equal(before.futureUiLimit,73);assert.equal(before.futureUiSpent,4);assert.equal(before.w0,null);
  for(const row of more.slice(2))await cap.browserRead(()=>{callbacks++;return {kind:'synthetic-goto'};},row);
  const after=await cap.inspect();assert.equal(after.combinedSpent,133);assert.equal(after.uiSpent,80);assert.equal(after.mainSpent,53);assert.equal(after.w0,null);assert.equal(after.pending,null);
  await cap.pausePreparation();
 });
 assert.equal(callbacks,1);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));assert.equal(j.publisherStages[0].stageCap,9);assert.deepEqual(j.events.slice(-3).map(e=>e.operation.id),more.map(row=>row.id));assert(j.events.slice(-3).every(e=>e.settled&&e.success));
});

test('native baseline grounding validator keeps exact six through nine shapes and rejects drift',()=>{
 const code=`import runpy,json,copy\nm=runpy.run_path('scripts/read-authority-publisher-alignment-budget.py');f=m['native_grounding_count'];shapes=m['NATIVE_BASELINE']+m['NATIVE_GROUNDING'];rows=[{'lane':'ui','descriptor':{'key':key,'target':target,'operation':method,'preparation':prep,'actor':'publisher','units':1}} for key,target,method,prep in shapes]\nout=[f(n,rows[:n]) for n in range(6,10)]\nsnap=copy.deepcopy(rows);snap[7]['descriptor']['operation']='snapshot';out.append(f(9,snap))\nfor index,key,value in [(6,'actor','caller'),(7,'target','oauth-audience'),(8,'key','N:navigation'),(8,'operation','click'),(8,'preparation',False),(2,'target','thin-settings')]:\n x=copy.deepcopy(rows);x[index]['descriptor'][key]=value;out.append(f(9,x))\nout.extend([f(9,rows[:8]),f(10,rows+[rows[0]]),f(5,rows[:5])]);print(json.dumps(out))`;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),[0,1,2,3,3,...Array(9).fill(-1)]);
});

test('resumed native owner denies unmapped A then independently charges one readonly cleanup alias',async()=>{
 const {s,closure,live,handoff,recoveryRead}=await nativePrepPauseFixture();s.time+=1000;
 const resumed=holder(s,{resume:{nativeSuccessor:true,...handoff}},()=>{},()=>closure.sha256);let calls=0,ordinaryCalls=0;
 await assert.rejects(resumed.withContinuation(async cap=>{const before=await cap.inspect();assert.equal(before.combinedSpent,130);await cap.externalRead(()=>{ordinaryCalls++;},{...fullFixedPlan().find(row=>row.bucket==='A'&&row.alias==='original-cloud-backup'),id:'future-unmapped-A'});}),/TRIAL_STOPPED/);assert.equal(ordinaryCalls,0);
 await resumed.withCleanup(async cap=>{const before=await cap.inspect();assert.equal(before.combinedSpent,130);await cap.browserRead(()=>{calls++;return {kind:'synthetic-read'};},recoveryRead);const after=await cap.inspect();assert.equal(after.combinedSpent,131);assert.equal(after.uiCleanup,1);assert.equal(after.pending,null);});
 assert.equal(calls,1);
 const j=JSON.parse(readFileSync(live.registry)).value.checkpoint;assert.equal(j.events.at(-1).operation.id,recoveryRead.id);assert.equal(j.events.at(-1).cleanup,true);assert.equal(j.events.at(-1).success,true);
});

test('native rollover refuses overflow and an unfinished prior mapped row',async()=>{
 const row=index=>futureMeta({id:`future-rollover-${index}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true});
 for(const mode of ['overflow','unfinished']){
  const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);let calls=0;
  await assert.rejects(owner.withContinuation(async cap=>{
   if(mode==='overflow')await cap.stagePublisher({stage:'baseline',stageCap:10,map:Array.from({length:10},(_,index)=>row(index))});
   else {await cap.stagePublisher({stage:'baseline',stageCap:6,map:Array.from({length:6},(_,index)=>row(index))});await cap.stagePublisher({stage:'thin',stageCap:1,map:[row(6)]});}
   calls++;
  }),/TRIAL_STOPPED/,mode);
  const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));assert.equal(calls,0);assert.equal(j.events.length,55);assert.equal(j.pending,null);assert.equal(j.w0,null);assert.equal(j.publisherStages.length,mode==='overflow'?0:1);
 }
});

test('native write UI methods obey their declared rules in both parsers',()=>{
 const keys=['D:thin-gcp-link','D:thin-properties-write','E:client-create','E:oauth-response'];
 const rows=keys.map((key,index)=>({id:`future-method-${index}`,key,actor:SIMPLE_RULES[key].actor,target:SIMPLE_RULES[key].target,operation:'submit',units:1,preparation:false}));
 for(const row of rows){assert.throws(()=>simpleBrowser(row,false,true),/SIMPLE_PLAN_UNVERIFIED/);for(const method of SIMPLE_RULES[row.key].methods)assert.deepEqual(simpleBrowser({...row,operation:method},false,true).operation,method);}
 const readonly={id:'future-read-projection',key:'D:thin-properties-readback',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:false};
 assert.equal(simpleBrowser(readonly,false,true).operation,'snapshot');
 const code=`import runpy,json\nf=runpy.run_path('scripts/read-authority-simple-budget.py')['descriptor']\nrows=json.loads(${JSON.stringify(JSON.stringify([...rows,...rows.flatMap(row=>SIMPLE_RULES[row.key].methods.map(method=>({...row,operation:method})),readonly)]))})\nout=[]\nfor row in rows:\n try:f(row,'ui');out.append(True)\n except Exception as error:out.append(False if str(error)=='TRIAL_STOPPED' else str(error))\nprint(json.dumps(out))`;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const parsed=JSON.parse(result.stdout);assert.deepEqual(parsed.slice(0,rows.length),rows.map(()=>false));assert.deepEqual(parsed.slice(rows.length),parsed.slice(rows.length).map(()=>true));
});

test('mapped I recovery navigation accepts only the four existing publisher UI targets in both parsers',()=>{
 const keys=['I:restore-original-guard','I:read-original-triggers','I:restore-thin-guard','I:remove-testing-user'];
 const valid=keys.map((key,index)=>({id:`cleanup-goto-${index}`,key,actor:SIMPLE_RULES[key].actor,target:SIMPLE_RULES[key].target,operation:'navigate',units:1,preparation:false}));
 const base=valid[1];
 const invalid=[
  {...base,actor:'caller'}, {...base,target:'oauth-client'}, {...base,preparation:true},
  {...base,units:2}, {...base,key:'I:read-original-editor'},
  {...base,key:'N:navigation',target:'new-target'},
  {...base,key:'I:revoke-token',actor:'caller',target:'caller-oauth'},
  {...base,operation:'submit'}
 ];
 for(const row of valid)assert.equal(simpleBrowser(row,false,true).operation,'navigate');
 for(const row of invalid)assert.throws(()=>simpleBrowser(row,false,true),/SIMPLE_PLAN_UNVERIFIED/);
 assert.throws(()=>simpleFixed({id:'future-main-goto',bucket:'I',alias:'read-original-triggers',actor:'publisher',target:'original-triggers',operation:'navigate',units:1}),/SIMPLE_PLAN_UNVERIFIED/);
 assert.throws(()=>simpleBrowser({id:'future-write-submit',key:'D:thin-gcp-link',actor:'publisher',target:'thin-settings',operation:'submit',units:1,preparation:false},false,true),/SIMPLE_PLAN_UNVERIFIED/);
 const code=`import runpy,json\nf=runpy.run_path('scripts/read-authority-simple-budget.py')['descriptor']\nrows=json.loads(${JSON.stringify(JSON.stringify(valid.map(row=>['ui',row]).concat(invalid.map(row=>['ui',row]),[['main',{id:'future-main-goto',bucket:'I',alias:'read-original-triggers',actor:'publisher',target:'original-triggers',operation:'navigate',units:1}],['ui',{id:'future-write-submit',key:'D:thin-gcp-link',actor:'publisher',target:'thin-settings',operation:'submit',units:1,preparation:false}]])))})\nout=[]\nfor lane,row in rows:\n try:f(row,lane);out.append(True)\n except Exception as error:out.append(False if str(error)=='TRIAL_STOPPED' else str(error))\nprint(json.dumps(out))`;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 assert.deepEqual(JSON.parse(result.stdout),[...valid.map(()=>true),...invalid.map(()=>false),false,false]);
});

test('native 128 same-owner cleanup charges mapped I goto before independent final read',async()=>{
 const {s,closure,origin,live}=await nativeSuccessorFixture(),unchanged=readFileSync(origin.journal.path);
 const plan=completeNativePlan(),key='I:read-original-triggers',final=plan.operations.find(row=>row.bucket+':'+row.alias===key);
 const goto={id:'cleanup-goto-original-triggers',key,actor:'publisher',target:'original-triggers',operation:'navigate',units:1,preparation:false};
 plan.browserOperations.splice(plan.browserOperations.findIndex(row=>row.key===key),0,goto);
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);let calls=0;
 await owner.withContinuation(async cap=>{await cap.completePlan(plan);const v=await cap.inspect();assert.equal(v.combinedSpent,128);assert.equal(v.pending,null);});
 const prior=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 let phase='enter',afterGoto,completedAfterGoto;try{await owner.withCleanup(async cap=>{
  phase='inspect';
  const before=await cap.inspect();assert.equal(before.combinedSpent,128);assert.equal(before.uiCleanup,0);
  phase='goto';
  await cap.browserRead(()=>{calls++;return {kind:'synthetic-navigation'};},goto);
  phase='after goto';
  afterGoto=await cap.inspect();completedAfterGoto=JSON.parse(readFileSync(live.registry)).value.checkpoint.completed.includes(key);
  phase='main';await cap.externalRead(()=>{calls++;return {kind:'synthetic-bounded-trigger-read'};},final);
  phase='after main';
  const after=await cap.inspect();assert.equal(after.uiCleanup,1);assert.equal(after.mainSpent,54);assert.equal(after.combinedSpent,130);assert.equal(after.pending,null);
 });}catch(e){throw Error(`cleanup ${phase}: ${e.message}`);}
 assert.equal(afterGoto.uiCleanup,1);assert.equal(afterGoto.mainSpent,53);assert.equal(afterGoto.combinedSpent,129);assert.equal(afterGoto.pending,null);
 assert.equal(afterGoto.state,'stopped');assert.equal(afterGoto.rpc.complete,false);assert.equal(completedAfterGoto,false);
 const current=JSON.parse(readFileSync(live.registry)).value.checkpoint;
 assert.equal(calls,2);assert.equal(current.events.length,prior.events.length+2);
 assert.deepEqual(current.events.slice(-2).map(e=>[e.lane,e.operation.operation,e.cleanup,e.success]),[['ui','navigate',true,true],['main','snapshot',true,true]]);
 assert.equal(current.completed.includes(key),true);assert.equal(prior.completed.includes(key),false);
 assert(readFileSync(origin.journal.path).equals(unchanged));
});

test('native 128 refuses ordinary cleanup debit and unmapped recovery before provider',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),plan=completeNativePlan(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 const row={id:'cleanup-unmapped-goto',key:'I:read-original-triggers',actor:'publisher',target:'original-triggers',operation:'navigate',units:1,preparation:false};let calls=0;
 await assert.rejects(owner.withContinuation(async cap=>{await cap.completePlan(plan);await cap.browserRead(()=>{calls++;},row);}),/TRIAL_STOPPED/);
 assert.equal(calls,0);
 await assert.rejects(owner.withCleanup(cap=>cap.browserRead(()=>{calls++;},row)),/TRIAL_STOPPED/);
 assert.equal(calls,0);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.equal(j.events.length,55);assert.equal(j.pending,null);
});

test('native 128 refuses a mapped cleanup UI write before its main action',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),plan=completeNativePlan(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 const row=plan.browserOperations.find(v=>v.key==='I:restore-original-guard');assert.equal(row.operation,'click');let calls=0;
 await owner.withContinuation(cap=>cap.completePlan(plan));
 await assert.rejects(owner.withCleanup(cap=>cap.browserRead(()=>{calls++;},row)),/TRIAL_STOPPED/);
 assert.equal(calls,0);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.equal(j.events.length,55);assert.equal(j.pending,null);
});

test('failed mapped cleanup navigation cannot be followed by an uncharged main callback',async()=>{
 const {s,closure,live}=await nativeSuccessorFixture(),plan=completeNativePlan(),key='I:read-original-triggers';
 const goto={id:'cleanup-failed-goto',key,actor:'publisher',target:'original-triggers',operation:'navigate',units:1,preparation:false};
 const final=plan.operations.find(row=>row.bucket+':'+row.alias===key);plan.browserOperations.splice(plan.browserOperations.findIndex(row=>row.key===key),0,goto);
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);let navigationCalls=0,mainCalls=0;
 await owner.withContinuation(cap=>cap.completePlan(plan));
 await assert.rejects(owner.withCleanup(async cap=>{
  await assert.rejects(cap.browserRead(()=>{navigationCalls++;throw Error('synthetic navigation failure');},goto),/TRIAL_STOPPED/);
  await cap.externalRead(()=>{mainCalls++;},final);
 }),/TRIAL_STOPPED/);
 const current=JSON.parse(readFileSync(live.registry)).value.checkpoint;
 assert.equal(navigationCalls,1);assert.equal(mainCalls,0);assert.equal(current.events.length,56);
 assert.deepEqual(current.events.at(-1).operation,goto);assert.equal(current.events.at(-1).success,false);assert.equal(current.events.at(-1).cleanup,true);
 assert.equal(current.completed.includes(key),false);
});

test('full native plan requires an admitted exact publisher main stage before each debit',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),plan=completeNativePlan(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 const main=key=>plan.operations.find(row=>row.bucket+':'+row.alias===key),refresh=main('P:publisher-refresh'),userinfo=main('P:publisher-userinfo'),write=main('B:fixture-import');let calls=0;
 await assert.rejects(owner.withContinuation(async cap=>{await cap.completePlan(plan);await cap.externalRead(()=>{calls++;},refresh);}),/TRIAL_STOPPED/);
 let j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));assert.equal(calls,0);assert.equal(j.events.length,55);assert.equal(j.pending,null);assert.equal(j.w0,null);
 const next=await nativeSuccessorFixture(),second=holder(next.s,{resume:{nativeSuccessor:true}},()=>{},()=>next.closure.sha256);let stagedW0,stagedMain;
 await assert.rejects(second.withContinuation(async cap=>{
  await cap.completePlan(plan);
  const cleanup=main('I:remove-reader');
  const map=[...plan.browserOperations.slice(21,27).map(row=>futureMeta(row)),{...futureMeta(refresh,[{lane:'main',descriptor:cleanup,target:cleanup.target,tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:cleanup.id,receipt:'EXACT_WRITE_READBACK'}]),lane:'main',receipt:'EXACT_WRITE_READBACK'}, {...futureMeta(userinfo),lane:'main'}];
  await cap.stagePublisher({stage:'baseline',stageCap:6,map});
  assert.equal(await cap.externalRead(()=>{calls++;return 'SYNTHETIC';},refresh),'SYNTHETIC');
  assert.equal(await cap.externalRead(()=>{calls++;return 'SYNTHETIC';},userinfo),'SYNTHETIC');
  const before=await cap.inspect();stagedW0=before.w0;stagedMain=before.mainSpent;
  await cap.externalRead(()=>{calls++;},write);
 }),/TRIAL_STOPPED/);
 j=JSON.parse(readFileSync(next.s.path+'.simple-publisher-native-successor.json'));assert.equal(calls,2);assert.equal(j.events.length,57);assert.equal(j.pending,null);assert(j.w0>0);assert.equal(j.w0,stagedW0);assert.equal(j.events.filter(event=>event.lane==='main').length,2);assert.equal(stagedMain,55);
});

test('first complete native publisher plan registers from the settled 128 bootstrap',async()=>{
 const {s,closure,origin}=await nativeSuccessorFixture(),old=readFileSync(origin.journal.path);
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 await owner.withContinuation(async cap=>{
  const before=await cap.inspect();assert.equal(before.planReady,false);assert.equal(before.pending,null);assert.equal(before.futureUiSpent,0);
  const plan=completeNativePlan(),registered=await cap.completePlan(plan);
  assert.equal(registered.planReady,true);assert.equal(registered.futureUiSpent,0);assert.equal(registered.rpc.beganAt,null);assert.equal(registered.w0,null);
  const main=plan.operations.find(row=>row.id==='future-publisher-userinfo');
  const staged=await cap.stagePublisher({stage:'baseline',stageCap:6,map:[...plan.browserOperations.slice(21,27).map(row=>futureMeta(row)),{lane:'main',descriptor:main,tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:main.id,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null}]});
  assert.equal(staged.planReady,true);assert.equal(staged.publisherUsed,6);assert.equal(staged.w0,null);
 });
 assert.equal(s.aligned().plan,null);assert(readFileSync(origin.journal.path).equals(old));
});

test('native publisher view exposes real staged trial readiness before full plan',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 await owner.withContinuation(async cap=>{
  const first=await cap.inspect();assert.equal(first.planReady,false);assert.equal(first.trialMapReady,false);
  const map=Array.from({length:6},(_,index)=>futureMeta({id:`future-baseline-${index}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true}));
  const rule=SIMPLE_RULES['I:verify-token-revoked'];map[0].cleanup=[{lane:'ui',descriptor:{id:'native-recovery-gate',key:'I:verify-token-revoked',actor:rule.actor,target:rule.target,operation:'snapshot',units:1,preparation:false},target:rule.target,tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:'native-recovery-gate',receipt:'SANITIZED_READ'}];
  const p=SIMPLE_RULES['P:publisher-userinfo'];map.push({lane:'main',descriptor:{id:'future-publisher-userinfo',bucket:'P',alias:'publisher-userinfo',actor:p.actor,target:p.target,operation:p.methods[0],units:1},tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:'future-publisher-userinfo',receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null});
  const staged=await cap.stagePublisher({stage:'baseline',stageCap:6,map});assert.equal(staged.trialMapReady,true);assert.equal(staged.planReady,false);assert.equal(staged.pending,null);assert.equal(staged.w0,null);assert.equal(staged.eventCount,55);
 });
});

test('native first plan refuses a missing native alias before any trial debit',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256),plan=completeNativePlan();
 plan.browserOperations=plan.browserOperations.filter(row=>row.key!==SIMPLE_NATIVE[0]);
 await assert.rejects(owner.withContinuation(cap=>cap.completePlan(plan)),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.equal(j.plan,null);assert.equal(j.events.length,55);assert.equal(j.pending,null);assert.equal(j.w0,null);
});

test('native first plan cannot be registered twice',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256),plan=completeNativePlan();
 await assert.rejects(owner.withContinuation(async cap=>{await cap.completePlan(plan);await cap.completePlan(plan);}),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.deepEqual(j.plan,plan);assert.equal(j.events.length,55);assert.equal(j.pending,null);assert.equal(j.w0,null);
});

test('native plan rejects a later publisher stage with an unmapped UI row',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256),plan=completeNativePlan();
 const map=plan.browserOperations.slice(21,27).map(row=>futureMeta(row));map[5].descriptor={...map[5].descriptor,id:'future-unmapped-row'};map[5].callback='future-unmapped-row';
 await assert.rejects(owner.withContinuation(async cap=>{await cap.completePlan(plan);await cap.stagePublisher({stage:'baseline',stageCap:6,map});}),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.deepEqual(j.plan,plan);assert.deepEqual(j.publisherStages,[]);assert.equal(j.events.length,55);assert.equal(j.pending,null);assert.equal(j.w0,null);
});

test('native successor blocks RPC before complete plan without invoking IO',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256),operation=fullFixedPlan().find(row=>row.bucket==='H');let calls=0;
 await assert.rejects(owner.withContinuation(cap=>cap.dispatchCompatibility({operation,credentialExpiresAt:s.time+600000},()=>{calls++;})),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.equal(calls,0);assert.equal(j.plan,null);assert.equal(j.rpc.beganAt,null);assert.equal(j.events.length,55);assert.equal(j.w0,null);
});

test('settled B visual chain imports once into a new PREP successor while original 111 stays false',async()=>{
 const {s,closure,live,origin}=await nativeSuccessorFixture(),before=Object.fromEntries(Object.entries(live).filter(([k])=>k!=='registry').map(([,path])=>[path,readFileSync(path)])),frozenRegistry=readFileSync(origin.registry.path);let calls=0;
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>{calls++;return closure.sha256;});
 const view=await owner.withContinuation(cap=>cap.inspect());
 assert.equal(view.combinedSpent,128);assert.equal(view.mainSpent,53);assert.equal(view.uiSpent,75);assert.equal(view.eventCount,55);assert.equal(view.successorImported,17);assert.equal(view.futureUiLimit,73);assert.equal(view.audienceVerified,false);assert.equal(view.currentVisualVerified,true);assert.equal(view.w0,null);assert.equal(view.pending,null);assert(calls>0);
 assert.equal(s.aligned().publisherAlignment.audienceVerified,false);assert.equal(view.repairCalls,6);assert.equal(view.readonlyIncidents,2);assert.equal(s.aligned().failures+3,JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json')).failures);assert(readFileSync(origin.registry.path).equals(frozenRegistry));
 for(const [path,bytes]of Object.entries(before))assert(readFileSync(path).equals(bytes),path);
});

test('native successor admission rejects A-only, gaps, duplicate nonces, pending settlement and exhausted fault reset before any write',async()=>{
 const {s,closure,live}=await nativeSuccessorFixture(),original=readFileSync(closure.path),registry=readFileSync(live.registry),base=JSON.parse(original),originalAttestation=readFileSync(base.visual.attestation.path),originalContext=readFileSync(base.context.path),cases=[
  ['closed menu',v=>{changePin(s,v.visual.attestation,a=>{a.menuOpen=false;});}],
  ['charge gap',v=>{v.charges[8].spent=121;}],
  ['duplicate nonce',v=>{v.charges[9].nonce=v.charges[8].nonce;}],
  ['pending',v=>{v.pending={spent:128};}],
  ['repair refund',v=>{v.faultHighwaters.globalRepairCallsUsed=0;}],
  ['wrong current URL',v=>{changePin(s,v.context,c=>{c.url='https://synthetic.invalid/wrong';});changePin(s,v.visual.attestation,a=>{a.url='https://synthetic.invalid/wrong';});}],
 ];
 for(const [label,mutate] of cases){
  changePin(s,closure,mutate);
  const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
  await assert.rejects(owner.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/,label);
  assert.equal(existsSync(s.path+'.simple-publisher-native-successor.json'),false,label);
  assert(readFileSync(live.registry).equals(registry),label);
  s.put(base.visual.attestation.path,originalAttestation);s.put(base.context.path,originalContext);
  s.put(closure.path,original);closure.sha256=hash(original);
 }
 const raw=readFileSync(closure.path);s.put(closure.path,Buffer.concat([raw,Buffer.from(' ')]));
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 await assert.rejects(owner.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/);
 assert(readFileSync(live.registry).equals(registry));
 s.put(closure.path,original);s.put(live.journal,compact({source:'rewritten-historical-111'}));
 const rewritten=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 await assert.rejects(rewritten.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/);
 assert.equal(existsSync(s.path+'.simple-publisher-native-successor.json'),false);
 assert(readFileSync(live.registry).equals(registry));
});

test('native successor requires the parent proof callback and rejects a false pin before spawn',async()=>{
 const {s,closure,live}=await nativeSuccessorFixture(),registry=readFileSync(live.registry);
 assert.throws(()=>holder(s,{resume:{nativeSuccessor:true}}),/TRIAL_STOPPED|READ_FAILED/);
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>('0'.repeat(64)));
 await assert.rejects(owner.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/);
 assert.equal(existsSync(s.path+'.simple-publisher-native-successor.json'),false);
 assert(readFileSync(live.registry).equals(registry));
 assert.equal(closure.sha256.length,64);
});

test('native proof drift closes ordinary continuation before another debit',async()=>{
 const {s,closure}=await nativeSuccessorFixture();let calls=0;
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>++calls===1?closure.sha256:'0'.repeat(64));
 await assert.rejects(owner.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/);
 assert(calls>=2);assert.equal(JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json')).events.length,55);
});

test('native endpoint 131 preserves seventy future calls and refuses a second owner',async()=>{
 const {s,closure,origin}=await nativeSuccessorFixture(131),map=Array.from({length:6},(_,i)=>({lane:'ui',descriptor:{id:`future-native-baseline-${i}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true},tabId:'current-tab',url:'https://synthetic.invalid/settings',callback:`callback-${i}`,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null}));
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 const view=await owner.withContinuation(async cap=>{const admitted=await cap.stagePublisher({stage:'baseline',stageCap:6,map});assert.equal(admitted.futureUiSpent,0);return cap.inspect();});
 assert.equal(view.combinedSpent,131);assert.equal(view.successorImported,20);assert.equal(view.futureUiLimit,70);assert.equal(view.futureUiSpent,0);assert.equal(view.w0,null);assert.equal(view.pending,null);
 assert.equal(JSON.parse(readFileSync(origin.journal.path)).publisherAlignment.audienceVerified,false);
 const second=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 await assert.rejects(second.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/);
});

test('approved publisher alignment has its own decision and inert flow constructor',()=>{
 assert.equal(PUBLISHER_ALIGNMENT_DECISION,'5f764b29438b582cdd404823a3a01408579fec7045ac5016971a7394d89337cb');
 assert.equal(typeof createAuthorityPublisherAlignmentFlow,'function');
});

test('two readonly incidents allow at most three prepaid repair calls each',()=>{const code="import runpy,json; p=runpy.run_path('scripts/read-authority-publisher-alignment-budget.py')['repair_allowed']; print(json.dumps([p(0,1,0,0),p(1,1,0,0),p(1,1,2,2),p(1,1,3,3),p(1,2,0,3),p(2,2,0,3),p(2,2,2,5),p(2,2,3,6),p(3,3,0,0)]))";const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),[false,true,true,false,false,true,true,false,false]);});

test('stage admission preserves a single inherited trial clock',()=>{const code="import runpy,json; p=runpy.run_path('scripts/read-authority-publisher-alignment-budget.py')['stage_clock_valid']; print(json.dumps([p('PREP',None),p('PREP',1),p('TRIAL',1700000000000),p('TRIAL',None),p('TRIAL',0),p('HARD_STOP',1700000000000)]))";const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),[true,false,true,false,false,false]);});

test('exact102 and three settled sidecars import as 105 before any callback',async()=>{
 const s=await alignmentFixture(),a=holder(s),before=Object.fromEntries(Object.entries(s.old102).map(([p,v])=>[p,v]));
 const r=await a.withContinuation(cap=>cap.inspect());assert.equal(r.combinedSpent,105);assert.equal(r.mainSpent,53);assert.equal(r.uiSpent,52);assert.equal(r.combinedLimit,296);assert.equal(r.uiOrdinaryLimit,148);assert.equal(r.publisherUsed,0);assert.equal(s.aligned().events.length,49);assert.deepEqual(s.aligned().publisherImported.map(x=>x.providerCallAt),[null,null,null]);
 for(const[p,bytes]of Object.entries(before).filter(([p])=>!p.endsWith('.simple-rebalanced.json')))assert.equal(readFileSync(p).equals(bytes),true,p);
});

test('tampered sidecar is rejected before callback or new ledger write',async()=>{
 const s=await alignmentFixture(),p=alignment(s);changePin(s,p.charges.inventory.outcome,v=>{v.nonce='dishonest';});let calls=0;
 await assert.rejects(holder(s).withContinuation(()=>{calls++;}),/TRIAL_STOPPED/);assert.equal(calls,0);
});

for(const [label,mutate] of [
 ['gap in consecutive charges',(s,p)=>changePin(s,p.charges.inventory.reservation,v=>{v.effectiveSpent=105;})],
 ['duplicate nonce',(s,p)=>{const first=JSON.parse(readFileSync(p.charges.diagnostic.reservation.path));changePin(s,p.charges.inventory.reservation,v=>{v.nonce=first.nonce;});changePin(s,p.charges.inventory.outcome,v=>{v.nonce=first.nonce;});}],
 ['command mismatch',(s,p)=>changePin(s,p.charges.binding.reservation,v=>{v.command="const otherBrowser=await cua.getBrowser({id:'wrong'});";v.commandSha256='0'.repeat(64);})],
 ['false settlement',(s,p)=>changePin(s,p.charges.binding.outcome,v=>{v.settled=false;})]
])test(`${label} cannot import or enter callback`,async()=>{const s=await alignmentFixture(),p=alignment(s);mutate(s,p);let called=0;await assert.rejects(holder(s).withContinuation(()=>{called++;}),/TRIAL_STOPPED/);assert.equal(called,0);});

const repinOutcome=(s,p,kind,mutate)=>{changePin(s,p.charges[kind].outcome,mutate);if(kind==='inventory')changePin(s,p.charges.binding.reservation,v=>{v.firstOutcomeSha256=p.charges.inventory.outcome.sha256;});changePin(s,p.closure,v=>{v.outcome1Sha256=p.charges.inventory.outcome.sha256;v.outcome2Sha256=p.charges.binding.outcome.sha256;v.reservation2Sha256=p.charges.binding.reservation.sha256;});};
for(const [label,mutate] of [
 ['contradictory stopped snapshot',(s,p)=>changePin(s,p.origin.result,v=>{v.result.snapshot={source:'synthetic-contradiction',fieldsRead:false};})],
 ['missing inventory no-read marker',(s,p)=>repinOutcome(s,p,'inventory',v=>{delete v.googlePageReads;})],
 ['missing binding no-read marker',(s,p)=>repinOutcome(s,p,'binding',v=>{delete v.googlePageReads;})],
 ['contradictory binding page read',(s,p)=>repinOutcome(s,p,'binding',v=>{v.googlePageReads=1;})]
])test(`${label} is rejected before new holder write`,async()=>{const s=await alignmentFixture(),p=alignment(s);mutate(s,p);let called=0;await assert.rejects(holder(s).withContinuation(()=>{called++;}),/TRIAL_STOPPED/);assert.equal(called,0);assert.equal(existsSync(s.path+'.simple-publisher-alignment.json'),false);});

const contract={source:'approved-publisher-alignment105',decisionHash:PUBLISHER_ALIGNMENT_DECISION,startingSpent:105,maximumFirstStageSpent:111,operationBudget:296,ordinaryUiLimit:148,maximumPreparationPrimitives:6,completeActualMapProven:false,browserProfile:'profile-b',browserId:'chosen',settingsTabId:'settings-tab',audienceTabId:'audience-tab',settingsURL:'https://synthetic.invalid/settings',audienceURL:'https://synthetic.invalid/audience',publisherHash:'a'.repeat(64)};
const snapshot=JSON.stringify({source:'rebalanced-readonly-grounding',urlMatched:true,accountVerified:true,fieldsRead:false,ready:'COMPLETE',section:'MATCHED',reason:'VERIFIED',phase:'COMPLETE',cryptoAvailable:true,encoderAvailable:true,controls:[]});
function flowFixture(s,failAt,overrides={}){const calls=[],retained={},owners=[],projectReady=()=>{},approved={...contract,...overrides.contract};
 const api={getBrowser:async({id})=>{calls.push('binding');assert.equal(id,approved.browserId);if(failAt==='binding')throw Error('PRIVATE');return {browserId:overrides.returnedBrowserId??id,nameSession:async name=>{calls.push('name');assert.equal(name,'🔎 CMWebs C3');if(failAt==='name')throw Error('PRIVATE');},user:{claimTab:async tabId=>{const step=tabId===approved.settingsTabId?'settings-claim':'audience-claim';calls.push(step);if(failAt===step)throw Error('PRIVATE');return {id:tabId,playwright:{evaluate:async(fn,args)=>{const projectionStep=tabId===approved.settingsTabId?'settings-project':'audience-project';calls.push(projectionStep);assert.equal(fn,projectReady);assert.equal(args.expectedURL,tabId===approved.settingsTabId?approved.settingsURL:approved.audienceURL);assert.equal(args.publisherHash,approved.publisherHash);if(failAt===projectionStep)throw Error('PRIVATE');return overrides.snapshots?.[args.target]??overrides.snapshot??snapshot;}}};}}};}};
 return {calls,retained,owners,flow:createAuthorityPublisherAlignmentFlow({contract:approved,guard:()=>{},createOwner:({assertStage})=>{const owner=holder(s,{},assertStage);owners.push(owner);return owner;},api,projectReady,retained})};}

test('publisher six-step flow prepays and pauses at111 with stable handles',async()=>{
 const s=await alignmentFixture(),{flow,calls,retained}=flowFixture(s);assert.deepEqual(calls,[]);const r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111',JSON.stringify({phase:r.failurePhase,calls}));assert.deepEqual(calls,['binding','name','settings-claim','settings-project','audience-claim','audience-project']);assert.equal(r.report.combinedSpent,111);assert.equal(r.report.uiSpent,58);assert.equal(r.report.publisherUsed,6);assert.equal(r.report.settingsVerified,true);assert.equal(r.report.audienceVerified,true);assert.equal(r.handoff.minimumEvents,55);assert.equal(s.aligned().w0,null);assert.equal(s.aligned().pending,null);assert.equal(retained.settings.id,contract.settingsTabId);assert.equal(retained.audience.id,contract.audienceTabId);assert.equal(r.completeActualMapProven,false);await assert.rejects(flow.run());
});

const control=(label)=>({label,tag:'BUTTON',role:'button',disabled:false});
test('target-aware decoder accepts nonempty settings and Audience controls while legacy default stays settings-only',()=>{
 const settings=JSON.stringify({...JSON.parse(snapshot),controls:[control('Change project')]});
 const audience=JSON.stringify({...JSON.parse(snapshot),controls:['新增使用者','Add users','發布應用程式','Publish app','儲存','Save','取消','Cancel','確定','Confirm'].map(control)});
 assert.equal(projection(settings).controls.length,1);
 assert.equal(projection(settings,'thin-settings').controls.length,1);
 assert.equal(projection(audience,'oauth-audience').controls.length,10);
 assert.throws(()=>projection(audience),/PROJECT_RETARGET_STOPPED/);
 assert.throws(()=>projection(audience,'thin-settings'),/PROJECT_RETARGET_STOPPED/);
 assert.throws(()=>projection(settings,'oauth-audience'),/PROJECT_RETARGET_STOPPED/);
 assert.throws(()=>projection(audience,'other-target'),/PROJECT_RETARGET_STOPPED/);
});

test('publisher flow accepts genuine nonempty controls on each known target',async()=>{
 const s=await alignmentFixture(),{flow,calls}=flowFixture(s,null,{snapshots:{'thin-settings':JSON.stringify({...JSON.parse(snapshot),controls:[control('變更專案')]}),'oauth-audience':JSON.stringify({...JSON.parse(snapshot),controls:[control('新增使用者'),control('發布應用程式')]})}});
 const r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');assert.equal(r.report.audienceVerified,true);assert.equal(r.report.settingsVerified,true);assert.equal(r.failureEvidence,undefined);assert.equal(calls.length,6);
});

test('decoder rejects malformed control members and fieldsRead on both targets',()=>{
 for(const target of ['thin-settings','oauth-audience'])for(const controls of [[{...control(target==='thin-settings'?'Change project':'Add users'),tag:'SCRIPT'}],[{...control(target==='thin-settings'?'Change project':'Add users'),role:'link'}],[{...control(target==='thin-settings'?'Change project':'Add users'),disabled:'false'}],[{...control(target==='thin-settings'?'Change project':'Add users'),extra:'PRIVATE'}]])assert.throws(()=>projection(JSON.stringify({...JSON.parse(snapshot),controls}),target),/PROJECT_RETARGET_STOPPED/);
 for(const target of ['thin-settings','oauth-audience'])assert.throws(()=>projection(JSON.stringify({...JSON.parse(snapshot),fieldsRead:true}),target),/PROJECT_RETARGET_STOPPED/);
});

test('publisher failure evidence separates no safe callback return, shape rejection and verification rejection',async()=>{
 const cases=[
  {failAt:'audience-project',overrides:{},kind:'CALLBACK_NOT_RETURNED',callbackReturned:false,decoded:false,count:null},
  {failAt:null,overrides:{snapshots:{'oauth-audience':JSON.stringify({...JSON.parse(snapshot),controls:[control('Change project')]})}},kind:'DECODE_SHAPE_REJECTED',callbackReturned:true,decoded:false,count:null},
  {failAt:null,overrides:{snapshots:{'oauth-audience':JSON.stringify({...JSON.parse(snapshot),urlMatched:false,controls:[control('Add users')]})}},kind:'VERIFICATION_REJECTED',callbackReturned:true,decoded:true,count:1}
 ];
 for(const x of cases){const s=await alignmentFixture(),{flow,calls}=flowFixture(s,x.failAt,x.overrides),r=await flow.run();assert.equal(r.status,'HARD_STOP');assert.equal(r.failurePhase,'AUDIENCE-PROJECT');assert.deepEqual(r.failureEvidence,{target:'oauth-audience',stage:'AUDIENCE-PROJECT',kind:x.kind,callbackReturned:x.callbackReturned,decoded:x.decoded,controlsCount:x.count});assert.equal(calls.length,6);assert.equal(s.aligned().events.at(-1).success,false);assert.equal(s.aligned().pending,null);assert.equal(s.aligned().w0,null);assert(!JSON.stringify(r).includes('PRIVATE'));assert(!JSON.stringify(r).includes(contract.audienceURL));assert(!JSON.stringify(r).includes('Change project'));await assert.rejects(flow.run());}
});

test('verified ASCII digest fallback remains eligible for both page projections',async()=>{
 const s=await alignmentFixture(),fallback=JSON.stringify({...JSON.parse(snapshot),cryptoAvailable:false,encoderAvailable:false}),{flow,calls}=flowFixture(s,null,{snapshot:fallback});
 const r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');assert.deepEqual(calls,['binding','name','settings-claim','settings-project','audience-claim','audience-project']);assert.equal(s.aligned().publisherAlignment.settingsVerified,true);assert.equal(s.aligned().publisherAlignment.audienceVerified,true);
});

test('a failed publisher method settles its prepaid debit and closes the holder',async()=>{
 const s=await alignmentFixture(),{flow,calls}=flowFixture(s,'name');const r=await flow.run();assert.equal(r.status,'HARD_STOP');assert.deepEqual(calls,['binding','name']);assert.equal(s.aligned().pending,null);assert.equal(s.aligned().events.length,51);assert.equal(s.aligned().events.at(-1).success,false);assert.equal(s.aligned().events.at(-1).settled,true);assert.equal(r.drain.ownedScope.state,'SETTLED');assert(!JSON.stringify(r).includes('PRIVATE'));await assert.rejects(flow.run());
});

test('rejecting drain is reported unresolved and cannot replay',async()=>{let runs=0,drains=0;const retained={},flow=createAuthorityPublisherAlignmentFlow({contract,guard:()=>{},createOwner:()=>({withContinuation:async()=>{runs++;throw Error('PRIVATE_TRANSPORT');},stopAndDrain:async()=>{drains++;throw Error('PRIVATE_DRAIN');}}),api:{getBrowser:async()=>{throw Error('UNREACHABLE');}},projectReady:()=>{},retained});const r=await flow.run();assert.equal(r.status,'DRAIN_UNRESOLVED');assert.equal(r.settled,false);assert.equal(r.drain,null);assert.equal(r.trialAccepted,false);assert.equal(runs,1);assert.equal(drains,1);assert(!JSON.stringify(r).includes('PRIVATE'));await assert.rejects(flow.run());assert.equal(runs,1);assert.equal(drains,1);});

for(const [step,count] of [['binding',1],['name',2],['settings-claim',3],['settings-project',4],['audience-claim',5],['audience-project',6]])test(`${step} rejection settles and stops without replay`,async()=>{const s=await alignmentFixture(),{flow,calls}=flowFixture(s,step);const r=await flow.run();assert.equal(r.status,'HARD_STOP');assert.equal(calls.length,count);assert.equal(s.aligned().events.length,49+count);assert.equal(s.aligned().events.at(-1).settled,true);assert.equal(s.aligned().events.at(-1).success,false);assert.equal(s.aligned().pending,null);assert.equal(s.aligned().w0,null);assert.equal(r.drain.ownedScope.state,'SETTLED');await assert.rejects(flow.run());});

test('publisher stage reserves future UI and rejects a stage over its cap',async()=>{
 const s=await alignmentFixture(),{flow}=flowFixture(s),r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');
 const map=i=>({lane:'ui',descriptor:{id:`future-baseline-${i}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true},tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:`callback-${i}`,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null});
 s.time+=1000;const accepted=holder(s,{resume:r.handoff});await accepted.withContinuation(async cap=>{const stage=await cap.stagePublisher({stage:'baseline',stageCap:6,map:Array.from({length:6},(_,i)=>map(i))});assert.equal(stage.futureUiSpent,0);assert.equal(stage.uiOrdinaryLimit,148);});assert.equal(s.aligned().publisherStages[0].stageCap,6);assert.equal(s.aligned().futureOrdinaryUi,84);
});

for(const method of ['snapshot','evaluate'])test(`admitted future ${method} prepays and settles its verified projection`,async()=>{
 const s=await alignmentFixture(),{flow}=flowFixture(s),first=await flow.run();assert.equal(first.status,'CLEAN_PAUSE111');s.time+=1000;
 const map=Array.from({length:6},(_,i)=>({lane:'ui',descriptor:{id:`future-baseline-${method}-${i}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:method,units:1,preparation:true},tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:`callback-${i}`,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null}));
 let callbacks=0;await holder(s,{resume:first.handoff},p=>{if(p.stage==='loading-result'){assert.equal(p.result.accountVerified,true);assert.equal(p.result.fieldsRead,false);}}).withContinuation(async cap=>{
  await cap.stagePublisher({stage:'baseline',stageCap:6,map});const value=await cap.browserRead(()=>{callbacks++;return JSON.parse(snapshot);},map[0].descriptor);assert.equal(value.accountVerified,true);const view=await cap.inspect();assert.equal(view.combinedSpent,112);assert.equal(view.pending,null);await cap.pausePreparation();
 });
 const j=s.aligned();assert.equal(callbacks,1);assert.equal(j.events.length,56);assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,true);assert.equal(j.events.at(-1).loadingResultVerified,true);
});

test('future projection settlement rejects absent or false verification before pending clears',()=>{
 const code=`import runpy,json
base=runpy.run_path('scripts/read-authority-simple-budget.py')['Ledger']
aligned=runpy.run_path('scripts/read-authority-publisher-alignment-budget.py')['alignment_class'](base)
out=[]
for method in ['snapshot','evaluate']:
 for flag in ['missing','false']:
  op={'id':'future-projection','operation':method,'preparation':True}
  event={'lane':'ui','operation':op,'settled':False}
  obj=object.__new__(aligned);obj.predebit_recovery=False;obj.j={'publisherAlignment':{'used':6},'events':[event],'publisherStages':[{'stage':'baseline','map':[{'lane':'ui','descriptor':op,'repairIncident':None}]}],'pending':op['id']}
  obj.current=lambda:None;obj.now=lambda _:None
  q={'op':'settle','id':op['id'],'success':True,'now':1}
  if flag=='false':q['loadingResultVerified']=False
  try:obj.command(q);denied=False
  except Exception as error:denied=str(error)=='TRIAL_STOPPED'
  out.append([method,flag,denied,obj.j['pending']==op['id'],event['settled'] is False])
print(json.dumps(out))`;
 const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const rows=JSON.parse(r.stdout);assert.equal(rows.length,4);for(const row of rows)assert.deepEqual(row.slice(2),[true,true,true],JSON.stringify(row));
});

test('aligned cleanup opens after a closed 111 scope using durable event count',async()=>{
 const s=await alignmentFixture(),{flow,owners}=flowFixture(s),r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');assert.equal(r.report.combinedSpent,111);assert.equal(s.aligned().events.length,55);let entered=0;
 await owners[0].withCleanup(async cap=>{entered++;const view=await cap.inspect();assert.equal(view.combinedSpent,111);assert.equal(view.pending,null);});assert.equal(entered,1);
});

test('aligned cleanup rejects a coherent registry with the wrong event count',async()=>{
 const s=await alignmentFixture(),{flow,owners}=flowFixture(s),r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');const path=join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-rebalanced.json');const wrapper=JSON.parse(readFileSync(path));wrapper.value.checkpoint.events.push({...wrapper.value.checkpoint.events.at(-1),operation:{...wrapper.value.checkpoint.events.at(-1).operation,id:'synthetic-extra'}});wrapper.sha256=hash(compact(wrapper.value));s.put(path,compact(wrapper));let entered=0;
 await assert.rejects(owners[0].withCleanup(()=>{entered++;}),/TRIAL_STOPPED/);assert.equal(entered,0);
});

test('old236 cleanup still uses its unchanged event count',async()=>{
 const s=await sharedFixture(),owner=holder(s);await owner.withContinuation(cap=>cap.inspect());let entered=0;await owner.withCleanup(async cap=>{entered++;const view=await cap.inspect();assert.equal(view.combinedSpent,101);assert.equal(Object.hasOwn(view,'eventCount'),false);});assert.equal(entered,1);
});

test('unknown future map does not admit a call or RPC',async()=>{const s=await alignmentFixture(),{flow}=flowFixture(s),r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');s.time+=1000;let calls=0;const a=holder(s,{resume:r.handoff});await assert.rejects(a.withContinuation(async cap=>{await cap.dispatchCompatibility({operation:{id:'synthetic-rpc'},credentialExpiresAt:s.time+600000},()=>{calls++;});}),/TRIAL_STOPPED/);assert.equal(calls,0);});

test('a seven-call baseline map is refused before its first callback',async()=>{const s=await alignmentFixture(),{flow}=flowFixture(s),r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');s.time+=1000;let calls=0;const map=Array.from({length:7},(_,i)=>({lane:'ui',descriptor:{id:`future-over-${i}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true},tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:`callback-${i}`,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null}));await assert.rejects(holder(s,{resume:r.handoff}).withContinuation(async cap=>{await cap.stagePublisher({stage:'baseline',stageCap:7,map});calls++;}),/TRIAL_STOPPED/);assert.equal(calls,0);assert.equal(s.aligned().events.length,55);});

for(const [label,overrides,count] of [
 ['wrong profile',{contract:{browserProfile:'wrong'}},0],
 ['wrong browser handle',{returnedBrowserId:'wrong'},1],
 ['wrong URL',{snapshot:JSON.stringify({...JSON.parse(snapshot),urlMatched:false})},4],
 ['wrong principal',{snapshot:JSON.stringify({...JSON.parse(snapshot),accountVerified:false})},4],
 ['unexpected controls',{snapshot:JSON.stringify({...JSON.parse(snapshot),controls:['unsafe']})},4],
 ['fields read',{snapshot:JSON.stringify({...JSON.parse(snapshot),fieldsRead:true})},4]
])test(`${label} fails closed with no uncharged replay`,async()=>{const s=await alignmentFixture(),{flow,calls,retained}=flowFixture(s,null,overrides);const r=await flow.run();assert.equal(r.status,'HARD_STOP');assert.equal(calls.length,count);assert.equal(s.aligned().pending,null);assert.equal(s.aligned().w0,null);assert.equal(retained.browser,null);await assert.rejects(flow.run());});
