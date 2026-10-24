import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,writeFileSync,readFileSync,unlinkSync,existsSync} from 'node:fs';
import {tmpdir,homedir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import * as budget from '../scripts/read-authority-trial-budget-plan.mjs';
import {createAuthorityPreparationControl} from '../scripts/read-authority-preparation-control.mjs';
import {createAuthorityPhaseControl} from '../scripts/read-authority-phase-control.mjs';
import {buildAuthorityTrialRollback,loadAuthorityTrialRollback} from '../scripts/read-authority-trial-rollback.mjs';
import {createAuthorityPublisherCredentials} from '../scripts/read-authority-trial-credentials.mjs';
import {createAuthorityTrialOrchestrator,AUTHORITY_TRIAL_CLEANUP_ACTIONS} from '../scripts/read-authority-trial-orchestrator.mjs';
const decisionHash='3701527108376e07470bc920336fbbd0f78015cb1e55dbfe35090ee059130cb9';
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-16T00:00:00Z'),owned=[];
const targets={
 'original-settings':'https://script.google.com/home/projects/SYNTHETIC_ORIGINAL_SCRIPT_ID/settings',
 'original-triggers':'https://script.google.com/home/projects/SYNTHETIC_ORIGINAL_SCRIPT_ID/triggers',
 'thin-settings':'https://script.google.com/home/projects/SYNTHETIC_THIN_SCRIPT_ID/settings',
 'oauth-audience':'https://console.cloud.google.com/auth/audience?project=synthetic-c3-trial',
 'oauth-client':'https://console.cloud.google.com/auth/clients/create?project=synthetic-c3-trial',
 'caller-executions':'https://script.google.com/home/executions',
 'publisher-executions':'https://script.google.com/home/executions'
};
const windows=()=>['wrapper-before','wrapper-after'].flatMap(phase=>['caller','publisher'].map(actor=>({phase,actor,pages:1,setupReads:0,identityReads:1,quotaReads:1,settlementReads:0})));
const operation=(ordinal,stage='research',target='original-settings',operation='snapshot')=>({stage,ordinal,actor:target==='caller-executions'?'caller':'publisher',target,operation});
function planInput(){return {stage:'single-wrapper-compatibility',decisionHash,counter:{limit:160,spent:25,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40},nativeWindows:windows(),additionalOperations:[{name:'native-prepare-caller',units:1},{name:'native-prepare-publisher',units:3},{name:'unknown-settlement',units:3}],nativeResearch:{usedReads:0,remainingOperations:[]}};}
function setup(patch={}){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-native-io-'));chmodSync(dir,0o700);const path=join(dir,'budget.json'),epoch='SYNTHETIC_NATIVE_IO_'+randomUUID();let now=clock;
 const legacy={limit:160,spent:25,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40},raw=JSON.stringify(legacy);writeFileSync(path,raw,{mode:0o600});writeFileSync(path+'.lock','',{mode:0o600});owned.push({epoch,path});
 const options={path,epoch,approvalHash:legacy.approval_sha256,proposalHash:legacy.proposal_sha256,legacySha256:hash(raw),importedReads:25,expiresAt:clock+21600000,now:()=>now,pause:async ms=>{now+=ms;},decisionHash,nativeTargets:targets,...patch};
 return {control:createAuthorityPreparationControl(options),options,get:()=>JSON.parse(readFileSync(path)),setNow:v=>{now=v;}};
}
test.after(()=>{for(const {epoch,path} of owned){const p=join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(epoch))+'.preparation.json');if(existsSync(p)){const v=JSON.parse(readFileSync(p)).value;if(v.path===path)unlinkSync(p);}}});
const bind=async cap=>{for(const name of ['caller-bind','publisher-bind'])await cap.externalRead(async()=>{},'P:'+name);};
test('approved native selector shares original32 and exposes research without granting execution',()=>{
 const v=planInput();v.nativeWindows.forEach(w=>{w.pages=null;w.setupReads=null;});const r=budget.planAuthorityTrialBudget(v);
 assert.equal(r.decisionHash,decisionHash);assert.equal(r.researchAdmitted,true);assert.equal(r.budgetFits,false);assert.equal(r.executionAuthorized,false);assert.equal(r.reservedTotalReads,160);assert.equal(r.bucketLimits.N.research,8);assert.equal(r.bucketLimits.G.total,32);assert.equal(r.bucketLimits.G.perWindowTotal,undefined);
});
test('full plan counts research and future navigation inside the original32',()=>{
 const v=planInput();v.nativeResearch.usedReads=8;v.nativeResearch.remainingOperations=Array.from({length:12},(_,i)=>operation(i+9,'preparation'));
 const r=budget.planAuthorityTrialBudget(v);assert.equal(r.totalReads,160);assert.equal(r.budgetFits,true);assert.equal(r.nativePreparationReady,true);
 v.nativeResearch.remainingOperations.push(operation(21,'preparation'));assert.equal(budget.planAuthorityTrialBudget(v).budgetFits,false);
});
test('research8 pre-debits UNKNOWN under original claim and denies a ninth while retaining cleanup',async()=>{
 const s=setup();let entered=0;
 await s.control.withPreparation(async cap=>{await bind(cap);for(let n=1;n<=8;n++)await cap.nativeRead(operation(n),async d=>{entered++;assert(Object.isFrozen(d));assert.equal(d.reference,targets['original-settings']);assert.equal(s.get().preparation.events.at(-1).outcome,'UNKNOWN');assert.equal(s.get().spent,27+n);});});
 assert.equal(entered,8);assert.equal(s.get().spent,35);assert.equal(s.get().preparation.importedReads,25);
 await assert.rejects(s.control.withPreparation(cap=>cap.nativeRead(operation(9),async()=>{entered++;})),/TRIAL_STOPPED/);assert.equal(entered,8);assert.equal(s.get().spent,35);
 await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.cleanup('read-original-project',async()=>{});});assert.equal(s.get().spent,38);
});
for(const charge of ['P:publisher-refresh','A:original-project'])test(charge+' remains denied before a complete remaining IO plan',async()=>{
 const s=setup();let io=0;await assert.rejects(s.control.withPreparation(async cap=>{await bind(cap);await cap.externalRead(async()=>{io++;},charge);}),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,27);
});
test('full known plan unlocks original four P purposes and preserves the fixed handoff',async()=>{
 const s=setup();await s.control.withPreparation(async cap=>{await bind(cap);await cap.nativeRead(operation(1),async()=>{});await cap.completeNativePreparation({windows:windows(),operations:[]});for(const name of ['publisher-refresh','publisher-userinfo'])await cap.externalRead(async()=>{},'P:'+name);await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.handoff({runtimeBinding:'c'.repeat(64),expectedSpent:32});});
 assert.equal(s.get().spent,32);assert.equal(s.get().preparation.decisionHash,decisionHash);
});
test('research failure keeps its UNKNOWN debit and cannot be retried after resume',async()=>{
 const s=setup();await assert.rejects(s.control.withPreparation(async cap=>{await bind(cap);await cap.nativeRead(operation(1),async()=>{throw Error('SYNTHETIC_UI_FAILURE');});}),/TRIAL_STOPPED/);assert.equal(s.get().spent,28);
 let io=0;await assert.rejects(s.control.withPreparation(cap=>cap.nativeRead(operation(1),async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,28);
});
test('phase facade forwards only current-origin research operations and readiness',async()=>{
 const s=setup(),phase=createAuthorityPhaseControl(s.control);let old;
 await phase.withPreparation(async cap=>{old=cap;await bind(cap);await cap.nativeRead(operation(1),async()=>{});await cap.completeNativePreparation({windows:windows(),operations:[]});});
 await assert.rejects(old.nativeRead(operation(2),async()=>{}),/TRIAL_STOPPED/);assert.equal(s.get().spent,28);
});
test('approved native selector retains the exact existing-grant P refresh and identity purposes',async()=>{
 const s=setup(),path=join(s.options.path,'..','profile.json'),raw=JSON.stringify({tokens:{default:{access_token:'SYNTHETIC_OLD',refresh_token:'SYNTHETIC_GRANT',client_id:'123-synthetic.apps.googleusercontent.com',expiry_date:clock-1,token_type:'Bearer'}}});writeFileSync(path,raw,{mode:0o600});
 const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(v=>'https://www.googleapis.com/auth/'+v),seen=[];
 const holder=createAuthorityPublisherCredentials({source:{path,sha256:hash(raw)},publisherHash:hash('publisher@example.invalid'),decisionHash,expiresAt:s.options.expiresAt,now:s.options.now,fetcher:async(url)=>{seen.push(s.get().preparation.events.at(-1).action);return new Response(JSON.stringify(url.endsWith('/token')?{access_token:'SYNTHETIC_NEW',token_type:'Bearer',expires_in:3920,scope:scopes.join(' ')}:{email:'publisher@example.invalid',verified_email:true}));}});
 try{await s.control.withPreparation(async cap=>{await bind(cap);await cap.completeNativePreparation({windows:windows(),operations:[]});await holder.refresh(cap);await holder.verify(cap);});assert.deepEqual(seen,['P:publisher-refresh','P:publisher-userinfo']);assert.equal(s.get().spent,29);assert.equal(readFileSync(path,'utf8'),raw);}finally{await holder.stopAndDrain();}
});
test('copied recovery keeps the native target binding and exposes independent cleanup only',async()=>{
 const s=setup();await assert.rejects(s.control.withPreparation(async cap=>{await bind(cap);await cap.nativeRead(operation(1),async()=>{throw Error('SYNTHETIC_FAILED_UI');});}),/TRIAL_STOPPED/);
 const receipt=buildAuthorityTrialRollback({path:join(s.options.path,'..','rollback-runtime')}),api=await loadAuthorityTrialRollback({path:receipt.path,sha256:receipt.sha256}),copy=api.createCleanupControl(s.options);
 await copy.withPreparationCleanup(async cap=>{assert.equal(cap.nativeRead,undefined);assert.equal(cap.completeNativePreparation,undefined);await cap.cleanup('read-original-project',async()=>{});});assert.equal(s.get().spent,29);
 assert.throws(()=>api.createCleanupControl({...s.options,expiresAt:s.options.expiresAt+1}),/TRIAL_STOPPED/);
 assert.throws(()=>api.createCleanupControl({...s.options,nativeTargets:{...targets,'thin-settings':targets['original-settings']}}),/TRIAL_STOPPED/);
});
test('full orchestrator preparation forwards native purposes without making research a trial pass',async()=>{
 const s=setup(),receipt=buildAuthorityTrialRollback({path:join(s.options.path,'..','rollback-runtime')});let seen=false;
 const orchestrator=createAuthorityTrialOrchestrator({control:s.control,prepare:async cap=>{await bind(cap);await cap.nativeRead(operation(1),async()=>{seen=true;});await cap.completeNativePreparation({windows:windows(),operations:[]});throw Error('SYNTHETIC_STOP_BEFORE_MUTATION');},restoreEditor:async cap=>{for(const name of ['restore-editor','read-restored-editor'])await cap.restoreOriginalEditor(name,async()=>{});},cleanup:Object.fromEntries(AUTHORITY_TRIAL_CLEANUP_ACTIONS.map(name=>[name,async cap=>cap.cleanup(name,async()=>{})])),rollback:{path:receipt.path,sha256:receipt.sha256,controlOptions:s.options}});
 await orchestrator.run().catch(()=>{});assert.equal(seen,true);assert.equal(s.get().spent,47);assert.equal(s.get().preparation.runtime,undefined);
});
for(const query of ['&supportedpurview=organization','&authuser=0&authuser=1','&authuser=caller@example.invalid','&hl=../../unexpected'])test('pinned console reference rejects unexpected query '+query,()=>{
 assert.throws(()=>budget.normalizeAuthorityNativeTargets({...targets,'oauth-client':targets['oauth-client']+query}),/TRIAL_BUDGET_UNVERIFIED/);
});
test('planned native navigation cannot request a fifth execution page',async()=>{
 const s=setup();await assert.rejects(s.control.withPreparation(async cap=>{await bind(cap);const w=windows();w[0].pages=4;await cap.completeNativePreparation({windows:w,operations:Array.from({length:4},(_,i)=>operation(i+1,'wrapper-before','caller-executions','next-page'))});}),/TRIAL_STOPPED/);assert.equal(s.get().spent,27);
});
test('expired original research claim keeps history and permits only independent cleanup',async()=>{
 const s=setup();await s.control.withPreparation(async cap=>{await bind(cap);await cap.nativeRead(operation(1),async()=>{});});s.setNow(s.options.expiresAt);
 let io=0;await assert.rejects(s.control.withPreparation(cap=>cap.nativeRead(operation(2),async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,28);
 await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.cleanup('read-original-project',async()=>{});});assert.equal(s.get().spent,30);
});
test('shared native pool admits more than eight per window while preserving all four mandatory windows',async()=>{
 const s=setup(),binding='c'.repeat(64);
 await s.control.withPreparation(async cap=>{await bind(cap);for(let n=1;n<=8;n++)await cap.nativeRead(operation(n),async()=>{});const w=windows();w[0].setupReads=12;await cap.completeNativePreparation({windows:w,operations:[]});for(const name of ['publisher-refresh','publisher-userinfo'])await cap.externalRead(async()=>{},'P:'+name);for(const name of ['restore-editor','read-restored-editor'])await cap.restoreOriginalEditor(name,async()=>{});await cap.handoff({runtimeBinding:binding,expectedSpent:39});});
 await s.control.withRuntime(binding,async cap=>{
  for(let n=0;n<12;n++)await cap.externalRead(async()=>{},'G:wrapper-before:caller:setupReads');
  for(const actor of ['caller','publisher'])for(const category of ['pages','identityReads','quotaReads'])await cap.externalRead(async()=>{},'G:wrapper-before:'+actor+':'+category);
  await cap.dispatchCompatibility({entry:'wrapper',nativeMs:0,observedAt:s.options.now(),credentialExpiresAt:s.options.expiresAt},async()=>{});
  for(const actor of ['caller','publisher'])for(const category of ['pages','identityReads','quotaReads'])await cap.settlementRead(async()=>{},'G:wrapper-after:'+actor+':'+category);
  await cap.accountNative({entry:'wrapper',totalMs:0,executionHash:'d'.repeat(64)});await cap.finishCompatibility('wrapper');
 });assert.equal(s.get().spent,64);assert.equal(s.get().preparation.events.filter(e=>e.action.startsWith('N:')||e.action.startsWith('G:')).length,32);
});
test('entered research owns the original flock until stop and drain settle its UNKNOWN callback',async()=>{
 const s=setup();let entered,release;const inIO=new Promise(r=>{entered=r;}),blocked=new Promise(r=>{release=r;});
 const run=s.control.withPreparation(async cap=>{await bind(cap);await cap.nativeRead(operation(1),async()=>{entered();await blocked;});});void run.catch(()=>{});await inIO;
 const peer=createAuthorityPreparationControl(s.options);await assert.rejects(peer.withPreparation(async()=>{}),/TRIAL_STOPPED/);let drained=false;const stopping=s.control.stopAndDrain().then(v=>{drained=true;return v;});await new Promise(r=>setTimeout(r,30));assert.equal(drained,false);assert.equal(s.get().spent,28);release();await run.catch(()=>{});const result=await stopping;assert.equal(result.stopRequested,true);assert.equal(result.stopAcknowledged,true);assert(existsSync(s.options.path+'.preparation-stop.json'));await assert.rejects(peer.withPreparation(cap=>cap.nativeRead(operation(2),async()=>{assert.fail('STOPPED_IO_ENTERED');})),/TRIAL_STOPPED/);assert.equal(s.get().spent,28);assert.equal(result.remoteExecutionSettled,false);assert.equal(result.trialAccepted,false);assert.equal(s.get().preparation.events.at(-1).outcome,'UNKNOWN');
});
test('raw external charge cannot bypass the pinned native descriptor',async()=>{
 const s=setup();let entered=false;await assert.rejects(s.control.withPreparation(async cap=>{await bind(cap);await cap.externalRead(async()=>{entered=true;},'N:research:publisher:original-settings:snapshot:1');}),/TRIAL_STOPPED/);assert.equal(entered,false);assert.equal(s.get().spent,27);
});
