import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,chmodSync,unlinkSync,lstatSync} from 'node:fs';
import {tmpdir,homedir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import * as trial from '../scripts/read-authority-trial-driver.mjs';
import {createAuthorityTrialMetadataAdapters} from '../scripts/read-authority-trial-metadata.mjs';
import {trialEntryRuntime,trialSigned} from './fixtures/read-parity/trial-entry-runtime.mjs';
const hash='a'.repeat(64),id='SYNTHETIC_DEPLOYMENT_ID';
const scopes=['https://www.googleapis.com/auth/spreadsheets.readonly','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/script.external_request'];
const expected={deploymentId:id,thinScriptId:'SYNTHETIC_THIN_SCRIPT',libraryId:'SYNTHETIC_LIBRARY_SCRIPT',libraryVersion:7,librarySourceHash:hash,thinSourceHash:hash,libraryManifestHash:hash,thinManifestHash:hash,originalEditorHash:hash,originalDeploymentsHash:hash,originalCloudProject:'SYNTHETIC_DEFAULT',trialEpoch:'SYNTHETIC_EPOCH_1234567890',syntheticSheetId:'SYNTHETIC_AUTHORITY_SHEET',callerHash:'b'.repeat(64),publisherHash:'c'.repeat(64),oauthClientHash:'d'.repeat(64),newCloudProject:'SYNTHETIC_STANDARD_PROJECT',sheetContractHash:'e'.repeat(64)};
const observed=()=>({...expected,scopes:[...scopes],developmentMode:false,executionAccess:'ANYONE',oauthStatus:'TESTING',testingUsers:1,callerSheetRole:'reader',callerLibraryRole:'none',callerPropertiesMatch:true,libraryPropertiesMatch:true,originalTriggers:0,retainedVersions:[1,2,3,4,5,6],originalEditorRestored:true});
const clock=Date.parse('2026-10-13T00:00:00Z');
const native=(total=0,execution=null)=>({source:'google-native-ui',coverage:'caller-and-publisher-all-projects',accountHashes:[expected.callerHash,expected.publisherHash],trialScriptIds:[expected.libraryId,expected.thinScriptId],accountUsage:[expected.callerHash,expected.publisherHash].map(accountHash=>({accountHash,accountType:'consumer',windowStartMs:clock-86400000,windowEndMs:clock,allProjectRuntimeMs:total,triggerRuntimeMs:0,complete:true})),observedAt:clock,day:'2026-10-13',complete:true,active:0,totalMs:total,execution});
const epochs=new Set();
test.after(()=>{for(const epoch of epochs){const name=createHash('sha256').update(JSON.stringify(epoch)).digest('hex')+'.json';const path=join(homedir(),'.codex','private','cmwebs-authority-trials',name);try{const p=lstatSync(path),r=JSON.parse(readFileSync(path)).value;if(p.isFile()&&!p.isSymbolicLink()&&r.journalPath.startsWith(join(tmpdir(),'cmwebs-trial-driver-'))){unlinkSync(path);try{const marker=path+'.stop.json',s=lstatSync(marker),m=JSON.parse(readFileSync(marker)).value;if(s.isFile()&&!s.isSymbolicLink()&&m.binding===r.binding)unlinkSync(marker);}catch(e){if(e.code!=='ENOENT')throw e;}}}catch(e){if(e.code!=='ENOENT')throw e;}}});
const ledgerAt=path=>JSON.parse(readFileSync(path,'utf8')).value;
function setup(overrides={}){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-trial-driver-'));chmodSync(dir,0o700);
 let calls=0,now=clock,total=0;const path=join(dir,'ledger.json');
 const ownExpected={...expected,trialEpoch:'SYNTHETIC_EPOCH_'+randomUUID()};
 const options={path,expected:ownExpected,preparation:{reads:0,sha256:hash},expiresAt:clock+3600000,now:()=>now,
  readRelease:async()=>({...observed(),...ownExpected}),readNative:async phase=>{
   if(phase==='before'){const p=native(total);return {...p,observedAt:now,accountUsage:p.accountUsage.map(a=>({...a,windowStartMs:now-86400000,windowEndMs:now}))};}
   const startMs=now;now+=100;const p=native(total+=100,{status:'COMPLETED',function:'authorizeTrial',deploymentId:id,startMs,endMs:now,durationMs:100});return {...p,observedAt:now,accountUsage:p.accountUsage.map(a=>({...a,windowStartMs:now-86400000,windowEndMs:now}))};
  },
  credential:async()=>({accessToken:'SYNTHETIC_TOKEN_NEVER_LOG',scopes:[...scopes],expiresAt:clock+3600000,refreshTokenPresent:false,callerHash:expected.callerHash,oauthClientHash:expected.oauthClientHash}),
  transport:async call=>{calls++;assert.equal(call.url,'https://script.googleapis.com/v1/scripts/'+id+':run');assert.equal(call.body.devMode,false);return {done:true,response:{result:{compatible:true}}};},...overrides};
 epochs.add(options.expected.trialEpoch);return {options,path,calls:()=>calls,setNow:v=>{now=v;},setTotal:v=>{total=v;}};
}
async function start(s){assert.equal(typeof trial.createAuthorityTrialDriver,'function');return trial.createAuthorityTrialDriver(s.options);}
const approvedBudget=reads=>({sha256:'f'.repeat(64),priorProposalHash:hash,preparationReads:reads,limit:160,cleanupReserve:17,stage:'compatibility-only'});
const cleanupActions=['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','restore-original-guard','verify-original-guard','restore-thin-guard','verify-thin-guard','remove-testing-user','verify-testing-user-removed','revoke-token','verify-token-revoked','read-original-editor','read-original-versions','read-original-deployments','read-original-project','read-original-triggers'];
test('approved cumulative budget imports spent25 and leaves seventeen units exclusively for cleanup',async()=>{
 const s=setup({preparation:{reads:25,sha256:hash},budgetApproval:approvedBudget(25)}),d=await start(s);
 for(let i=0;i<11;i++){s.setNow(clock+(i+1)*61000);await d.reserveExternalReads(10);}
 s.setNow(clock+12*61000);await d.reserveExternalReads(8);assert.equal(ledgerAt(s.path).readsUsed,143);
 await assert.rejects(d.reserveExternalReads(1),/TRIAL_STOPPED/);assert.equal(ledgerAt(s.path).readsUsed,143);
 assert.equal(typeof d.cleanup,'function');let completed=0;
 for(let i=0;i<17;i++){s.setNow(clock+(13+i)*61000);await d.cleanup(cleanupActions[i],async()=>{completed++;assert.equal(ledgerAt(s.path).readsUsed,144+i);});}
 assert.equal(completed,17);assert.equal(ledgerAt(s.path).readsUsed,160);assert.equal(s.calls(),0);
 await assert.rejects(d.cleanup('close-deployment',async()=>{completed++;}),/TRIAL_STOPPED/);assert.equal(completed,17);
});
test('approval upgrades a ready forty ledger at the same path without reseeding calls or runtime',async()=>{
 const s=setup({preparation:{reads:7,sha256:hash}}),old=await start(s);await old.reserveExternalReads(3);
 const before=ledgerAt(s.path);s.options.budgetApproval=approvedBudget(10);const d=await start(s),after=ledgerAt(s.path);
 assert.equal(after.readsUsed,10);assert.equal(after.binding,before.binding);assert.deepEqual(after.calls,before.calls);assert.equal(after.nativeMs,before.nativeMs);
 s.setNow(clock+61000);await d.reserveExternalReads(1);assert.equal(ledgerAt(s.path).readsUsed,11);
 await assert.rejects(old.reserveExternalReads(1),/TRIAL_STOPPED/);assert.equal(ledgerAt(s.path).readsUsed,11);
});
test('approved initial receipt retains more than forty preparation reads without an invalid legacy intermediate',async()=>{
 const s=setup({preparation:{reads:41,sha256:hash},budgetApproval:approvedBudget(41)}),d=await start(s);
 assert.equal(ledgerAt(s.path).readsUsed,41);s.setNow(clock+61000);await d.reserveExternalReads(1);assert.equal(ledgerAt(s.path).readsUsed,42);
});
test('fixed metadata adapter debits the actual same-epoch journal inside release observers',async()=>{
 const s=setup({budgetApproval:approvedBudget(0)});let io=0,phase=0;
 const adapter=createAuthorityTrialMetadataAdapters({originalSheetId:'SYNTHETIC_ORIGINAL_CONTAINER',syntheticSheetId:s.options.expected.syntheticSheetId,expectedTabNames:Array.from({length:20},(_,i)=>'Synthetic_tab_'+i),publisherHash:expected.publisherHash,callerHash:expected.callerHash,now:s.options.now,
  credential:()=>({accessToken:'SYNTHETIC_METADATA_TOKEN',accountHash:expected.publisherHash,scopes:['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(v=>'https://www.googleapis.com/auth/'+v),expiresAt:clock+3600000,refreshTokenPresent:true}),
  fetcher:async()=>{io++;assert.equal(ledgerAt(s.path).readsUsed,io+(phase===2?1:0));return new Response(JSON.stringify({permissions:[]}));}});
 s.options.readRelease=async control=>{phase++;await adapter.read('original-acl',control);await adapter.read('synthetic-acl',control);return {...observed(),...s.options.expected};};
 const d=await start(s);await d.run({},'compatibility');assert.equal(io,4);assert.equal(ledgerAt(s.path).readsUsed,5);assert.equal(s.calls(),1);
});
test('approved first stage permits wrapper and qualified once each and rejects a third dispatch',async()=>{
 const s=setup({budgetApproval:approvedBudget(0)});let lastFunction;
 const originalNative=s.options.readNative;s.options.readNative=async phase=>{const p=await originalNative(phase);if(p.execution)p.execution.function=lastFunction;return p;};
 s.options.transport=async call=>{lastFunction=call.body.function;return {done:true,response:{result:{compatible:true}}};};
 const d=await start(s);await d.run({},'compatibility');await d.run({},'compatibility','qualified');
 assert.equal(ledgerAt(s.path).readsUsed,2);assert.deepEqual(ledgerAt(s.path).budget.rpcEntries,['wrapper','qualified']);
 await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(ledgerAt(s.path).readsUsed,2);
});
test('approved first stage rejects authority before release observation or RPC',async()=>{
 let observations=0;const s=setup({budgetApproval:approvedBudget(0),readRelease:async()=>{observations++;return {...observed(),...s.options.expected};}}),d=await start(s);
 await assert.rejects(d.run({},'authority'),/TRIAL_STOPPED/);assert.equal(observations,0);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,0);
});
test('cleanup survives unresolved native terminal, restart and expiry without clearing pending',async()=>{
 const s=setup({budgetApproval:approvedBudget(0),transport:async()=>{throw Error('PRIVATE_UNRESOLVED');}}),d=await start(s);
 await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);const before=ledgerAt(s.path);assert(before.pending);
 s.setNow(clock+3600001);const reopened=await start(s);let io=0;
 await reopened.cleanup('close-deployment',async()=>{io++;});const after=ledgerAt(s.path);
 assert.equal(io,1);assert.equal(after.readsUsed,2);assert.equal(after.nativeMs,before.nativeMs);assert.deepEqual(after.pending,before.pending);
 await assert.rejects(reopened.run({},'compatibility','qualified'),/TRIAL_STOPPED/);assert.equal(ledgerAt(s.path).readsUsed,2);
});
test('cleanup error remains spent and cannot replay the same removal',async()=>{
 const s=setup({budgetApproval:approvedBudget(0)}),d=await start(s);let io=0;
 await assert.rejects(d.cleanup('remove-reader',async()=>{io++;throw Error('PRIVATE_CLEANUP');}),/^Error: TRIAL_STOPPED$/);
 const reopened=await start(s);await assert.rejects(reopened.cleanup('remove-reader',async()=>{io++;}),/TRIAL_STOPPED/);
 assert.equal(io,1);assert.equal(ledgerAt(s.path).readsUsed,1);assert(!readFileSync(s.path).includes('PRIVATE_CLEANUP'));
});
test('cleanup waits for minute headroom while retaining lock then debits before its single IO',async()=>{
 const s=setup({budgetApproval:approvedBudget(0)});let enter,release;const entered=new Promise(r=>{enter=r;});
 s.options.pause=async ms=>{assert.equal(ms,60000);enter();await new Promise(r=>{release=r;});s.setNow(clock+ms);};
 const d=await start(s),other=await start(s);await d.reserveExternalReads(10);let io=0;
 const running=d.cleanup('revoke-token',async()=>{io++;assert.equal(ledgerAt(s.path).readsUsed,11);});
 try{await Promise.race([entered,running]);await assert.rejects(other.reserveExternalReads(1),/TRIAL_STOPPED/);}finally{release?.();}
 await running;assert.equal(io,1);assert.equal(ledgerAt(s.path).state,'stopped');
});
test('cleanup pause failure permanently vetoes later RPC and survives restart without debit',async()=>{
 const s=setup({budgetApproval:approvedBudget(0),pause:async()=>{throw Error('PRIVATE_PAUSE');}}),d=await start(s);
 await d.reserveExternalReads(10);let io=0;
 await assert.rejects(d.cleanup('close-deployment',async()=>{io++;}),/TRIAL_STOPPED/);
 s.setNow(clock+61000);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);
 const reopened=await start(s);await assert.rejects(reopened.run({},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,10);assert.equal(ledgerAt(s.path).nativeMs,0);
 await reopened.cleanup('close-deployment',async()=>{io++;});assert.equal(io,1);assert.equal(ledgerAt(s.path).readsUsed,11);
});
test('cleanup requested while RPC lock is busy permanently stops new RPC while retaining pending and native accounting',async()=>{
 let enter,release,lastFunction;const entered=new Promise(r=>{enter=r;});const s=setup({budgetApproval:approvedBudget(0)});let dispatched=0;
 const originalNative=s.options.readNative;s.options.readNative=async phase=>{const p=await originalNative(phase);if(p.execution)p.execution.function=lastFunction;return p;};
 s.options.transport=async call=>{lastFunction=call.body.function;if(++dispatched===1){enter();await new Promise(r=>{release=r;});}return JSON.parse(JSON.stringify({done:true,response:{result:{compatible:true}}}));};
 const d=await start(s),other=await start(s);const running=d.run({},'compatibility');void running.catch(()=>{});
 await entered;const pending=ledgerAt(s.path).pending;let io=0;
 try{await assert.rejects(other.cleanup('close-deployment',async()=>{io++;}),/TRIAL_STOPPED/);}finally{release();}
 await running.catch(()=>{});await assert.rejects(d.run({},'compatibility','qualified'),/TRIAL_STOPPED/);
 assert.equal(io,0);assert.equal(dispatched,1);assert.equal(ledgerAt(s.path).readsUsed,1);assert.equal(ledgerAt(s.path).nativeMs,100);assert.deepEqual(ledgerAt(s.path).pending,pending);
 const reopened=await start(s);await reopened.cleanup('close-deployment',async()=>{io++;});assert.equal(io,1);assert.equal(ledgerAt(s.path).readsUsed,2);assert.deepEqual(ledgerAt(s.path).pending,pending);
});
for(const [name,patch] of [['enlarged cap',{limit:161}],['reduced cleanup',{cleanupReserve:16}],['wrong original proposal',{priorProposalHash:'e'.repeat(64)}],['missing retained reads',{preparationReads:0}],['broader stage',{stage:'authority'}]])test('approval refuses '+name+' without initializing a budget',async()=>{
 const s=setup({preparation:{reads:25,sha256:hash},budgetApproval:{...approvedBudget(25),...patch}});await assert.rejects(start(s),/TRIAL_STOPPED/);
 assert.throws(()=>readFileSync(s.path),/ENOENT/);assert.equal(s.calls(),0);
});
test('changed approval cannot reset spent or cleanup history at the same epoch',async()=>{
 const s=setup({budgetApproval:approvedBudget(0)}),d=await start(s);await d.cleanup('remove-testing-user',async()=>{});
 await assert.rejects(trial.createAuthorityTrialDriver({...s.options,budgetApproval:{...s.options.budgetApproval,sha256:'9'.repeat(64)}}),/TRIAL_STOPPED/);
 assert.equal(ledgerAt(s.path).readsUsed,1);assert.deepEqual(ledgerAt(s.path).budget.cleanupActions,['remove-testing-user']);
});
test('approved migration cannot revive a stopped legacy ledger or an earlier completed RPC',async()=>{
 for(const completed of [false,true]){
  const s=setup(),d=await start(s);if(completed)await d.run({},'compatibility');else await assert.rejects(d.reserveExternalReads(11),/TRIAL_STOPPED/);
  const before=readFileSync(s.path,'utf8');s.options.budgetApproval=approvedBudget(completed?1:0);await assert.rejects(start(s),/TRIAL_STOPPED/);assert.equal(readFileSync(s.path,'utf8'),before);
 }
});
test('fixed release verifier accepts exact synthetic readback only',()=>{
 assert.equal(typeof trial.verifyAuthorityTrialReadback,'function');assert.equal(trial.verifyAuthorityTrialReadback(expected,observed()),true);
});
for(const [key,value] of [['libraryVersion',8],['deploymentId','OTHER'],['librarySourceHash','b'.repeat(64)],['originalCloudProject','OTHER'],['originalTriggers',1],['callerLibraryRole','reader'],['callerSheetRole','writer'],['originalEditorRestored',false],['developmentMode',true],['testingUsers',2],['oauthStatus','PRODUCTION'],['executionAccess','ANYONE_ANONYMOUS'],['scopes',[...scopes,'drive']],['retainedVersions',[1,2,3,4,5]]])test('release rejects changed '+key,()=>{
 assert.equal(typeof trial.verifyAuthorityTrialReadback,'function');assert.throws(()=>trial.verifyAuthorityTrialReadback(expected,{...observed(),[key]:value}),/TRIAL_STOPPED/);
});
test('successful compatibility requires native terminal and persists no token/request/result',async()=>{
 const s=setup(),d=await start(s);const result=await d.run({secret:'SYNTHETIC_REQUEST_PRIVATE'},'compatibility');assert.deepEqual(result,{compatible:true});
 const text=readFileSync(s.path,'utf8');assert(!text.includes('SYNTHETIC_TOKEN'));assert(!text.includes('SYNTHETIC_REQUEST'));const ledger=ledgerAt(s.path);assert.equal(ledger.readsUsed,1);assert.equal(ledger.nativeMs,100);assert.equal(ledger.state,'ready');assert.equal(s.calls(),1);
});
test('reopened journal retains spent budget and completed execution',async()=>{
 const s=setup(),d=await start(s);await d.run({},'compatibility');const second=await start(s);await second.run({},'compatibility');assert.equal(ledgerAt(s.path).readsUsed,2);
});
test('one unresolved native RPC blocks same instance and a restarted driver',async()=>{
 const s=setup({transport:async()=>{throw Error('SYNTHETIC_TOKEN_NEVER_LOG');}}),d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(ledgerAt(s.path).state,'stopped');await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);await assert.rejects(start(s),/TRIAL_STOPPED/);
});
for(const [name,response] of [['not done',{done:false}],['both response/error',{done:true,response:{result:{}},error:{}}],['unbounded payload',{done:true,response:{result:{rows:['PRIVATE']}}}],['wrong compatibility',{done:true,response:{result:{compatible:false}}}]])test('stop on '+name,async()=>{
 const s=setup({transport:async()=>response}),d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);
});
for(const [name,proof] of [['active',{...native(),active:1}],['incomplete',{...native(),complete:false}],['stale',{...native(),observedAt:clock-60001}],['wrong day',{...native(),day:'2026-10-12'}],['quota unknown',{...native(),totalMs:null}],['too little worst-case runtime',{...native(),totalMs:540001}]])test('no RPC for '+name+' native usage',async()=>{
 const s=setup({readNative:async()=>proof}),d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);
});
for(const [name,exec] of [['missing',null],['running',{status:'RUNNING'}],['different deployment',{status:'COMPLETED',function:'authorizeTrial',deploymentId:'OTHER',startMs:clock,endMs:clock+100,durationMs:100}],['duration mismatch',{status:'COMPLETED',function:'authorizeTrial',deploymentId:id,startMs:clock,endMs:clock+100,durationMs:101}]])test('native '+name+' terminal never permits next RPC',async()=>{
 const s=setup({readNative:async phase=>phase==='before'?native():native(100,exec)}),d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),1);
});
test('native total must include full completed duration, not client timing',async()=>{
 const s=setup({readNative:async phase=>phase==='before'?native():native(50,{status:'COMPLETED',function:'authorizeTrial',deploymentId:id,startMs:clock,endMs:clock+100,durationMs:100})}),d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);
});
test('runtime API failure remains spent and stops after terminal accounting',async()=>{
 const s=setup({transport:async()=>({done:true,error:{code:10,message:'PRIVATE'}})}),d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);const l=ledgerAt(s.path);assert.equal(l.readsUsed,1);assert.equal(l.nativeMs,100);assert(!readFileSync(s.path,'utf8').includes('PRIVATE'));
});
test('minute limit stops eleventh RPC without refund',async()=>{
 const s=setup(),d=await start(s);for(let i=0;i<10;i++)await d.run({},'compatibility');await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),10);
});
test('authority reserves six inner reads plus one RPC before transport',async()=>{
 const s=setup({transport:async()=>({done:true,response:{result:{success:false,code:'TRIAL_UNAVAILABLE'}}})}),d=await start(s);const result=await d.run({},'authority');assert.equal(result.success,false);assert.equal(ledgerAt(s.path).readsUsed,7);
});
test('full forty-unit budget cannot reset on a new date or restart',async()=>{
 const s=setup(),d=await start(s);for(let i=0;i<40;i++){s.setNow(clock+i*61000);await d.run({},'compatibility');}await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),40);
});
test('invalid mode, expired or enlarged token scopes deny before transport',async()=>{
 for(const override of [{}, {credential:async()=>({accessToken:'SYNTHETIC',scopes:[...scopes,'drive'],expiresAt:clock+3600000,refreshTokenPresent:false})},{credential:async()=>({accessToken:'SYNTHETIC',scopes,expiresAt:clock,refreshTokenPresent:false})},{credential:async()=>({accessToken:'SYNTHETIC',scopes,expiresAt:clock+3600000,refreshTokenPresent:true})}]){
  const s=setup(override),d=await start(s);await assert.rejects(d.run({},Object.keys(override).length?'compatibility':'OTHER'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);
 }
});
test('concurrent driver instances cannot issue parallel RPC',async()=>{
 let resolve;const s=setup({transport:()=>new Promise(r=>{resolve=r;})}),d=await start(s),other=await start(s);
 const running=d.run({},'compatibility');while(!resolve)await new Promise(r=>setImmediate(r));await assert.rejects(other.run({},'compatibility'),/TRIAL_STOPPED/);resolve({done:true,response:{result:{compatible:true}}});await running;
});
test('tampered or pending ledger never silently resets',async()=>{
 const s=setup();await start(s);const l=JSON.parse(readFileSync(s.path));writeFileSync(s.path,JSON.stringify({...l,state:'pending'}));await assert.rejects(start(s),/TRIAL_STOPPED/);
});
test('reused native execution cannot account a second RPC',async()=>{
 const e={status:'COMPLETED',function:'authorizeTrial',deploymentId:id,startMs:clock,endMs:clock+100,durationMs:100};let total=0;
 const s=setup({readNative:async phase=>native(phase==='before'?total:total+=100,phase==='before'?null:e)}),d=await start(s);await d.run({},'compatibility');await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);
});
test('native usage must cover caller and publisher across all projects',async()=>{
 const s=setup({readNative:async()=>({...native(),coverage:'one-script-only'})}),d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);
});
test('release readback must prove guard Properties match at both layers',()=>{
 assert.throws(()=>trial.verifyAuthorityTrialReadback(expected,{...observed(),callerPropertiesMatch:false}),/TRIAL_STOPPED/);
});
test('transport only posts pinned endpoint with bounded no-redirect response',async()=>{
 assert.equal(typeof trial.createGoogleExecutionTransport,'function');let options;
 const t=trial.createGoogleExecutionTransport(id,async(url,opts)=>{options=opts;assert.equal(url,'https://script.googleapis.com/v1/scripts/'+id+':run');return new Response(JSON.stringify({done:true,response:{result:{compatible:true}}}));});
 const result=await t({url:'https://script.googleapis.com/v1/scripts/'+id+':run',accessToken:'SYNTHETIC',body:{function:'authorizeTrial',parameters:[{},'compatibility'],devMode:false}});assert.equal(result.done,true);assert.equal(options.redirect,'manual');assert.equal(options.method,'POST');assert.equal(options.headers.authorization,'Bearer SYNTHETIC');assert(options.signal);
});
for(const [name,body,status] of [['redirect','',302],['error','',403],['oversize','a'.repeat(30001),200],['malformed','PRIVATE',200]])test('transport rejects '+name+' without retry or raw error',async()=>{
 // A real fetch owns a single body. An unconsumed Response.clone tee branch
 // prevents cancellation settlement; it is not the transport's body contract.
 assert.equal(typeof trial.createGoogleExecutionTransport,'function');let calls=0;const t=trial.createGoogleExecutionTransport(id,async()=>{calls++;return new Response(body,{status});});await assert.rejects(t({url:'https://script.googleapis.com/v1/scripts/'+id+':run',accessToken:'SYNTHETIC',body:{function:'authorizeTrial',parameters:[{},'compatibility'],devMode:false}}),/TRIAL_STOPPED/);assert.equal(calls,1);
});
test('transport forbids other destination/function/devMode before any network',async()=>{
 assert.equal(typeof trial.createGoogleExecutionTransport,'function');let calls=0;const t=trial.createGoogleExecutionTransport(id,async()=>{calls++;});for(const patch of [{url:'https://other.invalid'},{body:{function:'AuthorityTrial.private_',parameters:[],devMode:false}},{body:{function:'authorizeTrial',parameters:[{},'compatibility'],devMode:true}}])await assert.rejects(t({url:'https://script.googleapis.com/v1/scripts/'+id+':run',accessToken:'SYNTHETIC',body:{function:'authorizeTrial',parameters:[{},'compatibility'],devMode:false},...patch}),/TRIAL_STOPPED/);assert.equal(calls,0);
});
test('metadata/header probes spend the same durable budget before external IO',async()=>{
 const s=setup({transport:async()=>({done:true,response:{result:{success:false,code:'TRIAL_UNAVAILABLE'}}})}),d=await start(s);assert.equal(typeof d.reserveExternalReads,'function');await d.reserveExternalReads(6);assert.equal(ledgerAt(s.path).readsUsed,6);s.setNow(clock+61000);await d.run({},'authority');assert.equal(ledgerAt(s.path).readsUsed,13);
});
test('external reservation is subject to minute ceiling and cannot be refunded',async()=>{
 const s=setup(),d=await start(s);assert.equal(typeof d.reserveExternalReads,'function');await d.reserveExternalReads(10);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,10);
});
test('qualified public library compatibility uses the same guards/budget/native terminal',async()=>{
 const name='AuthorityTrial.authorizeTrial';const s=setup({transport:async call=>{assert.equal(call.body.function,name);return {done:true,response:{result:{compatible:true}}};},readNative:async phase=>phase==='before'?native():native(100,{status:'COMPLETED',function:name,deploymentId:id,startMs:clock,endMs:clock+100,durationMs:100})}),d=await start(s);await d.run({},'compatibility','qualified');assert.equal(ledgerAt(s.path).readsUsed,1);
});
test('qualified transport allows only the fixed guarded public entry',async()=>{
 assert.equal(typeof trial.createGoogleExecutionTransport,'function');const t=trial.createGoogleExecutionTransport(id,async()=>new Response(JSON.stringify({done:true,response:{result:{compatible:true}}})));const result=await t({url:'https://script.googleapis.com/v1/scripts/'+id+':run',accessToken:'SYNTHETIC',body:{function:'AuthorityTrial.authorizeTrial',parameters:[{},'compatibility'],devMode:false}});assert.equal(result.done,true);
});
test('unknown entry selector never becomes an arbitrary function dispatch',async()=>{
 const s=setup(),d=await start(s);await assert.rejects(d.run({},'compatibility','private-function'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);
});
test('mutating caller config cannot replace the journal-bound release',async()=>{
 const own={...expected,trialEpoch:'SYNTHETIC_EPOCH_'+randomUUID()};let calls=0;const s=setup({expected:own,readRelease:async()=>({...observed(),...own}),transport:async()=>{calls++;return {done:true,response:{result:{compatible:true}}};}}),d=await start(s);own.deploymentId='OTHER_SYNTHETIC_DEPLOYMENT';await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(calls,0);
});
test('slow credential cannot dispatch using stale native proof',async()=>{
 const s=setup();s.options.credential=async()=>{s.setNow(clock+61001);return {accessToken:'SYNTHETIC',scopes,expiresAt:clock+3600000,refreshTokenPresent:false,callerHash:expected.callerHash,oauthClientHash:expected.oauthClientHash};};const d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);
});
test('nine external reads leave no minute budget for authority inner reads',async()=>{
 const s=setup({transport:async()=>({done:true,response:{result:{success:false,code:'TRIAL_UNAVAILABLE'}}})}),d=await start(s);await d.reserveExternalReads(9);await assert.rejects(d.run({},'authority'),/TRIAL_STOPPED/);assert.equal(ledgerAt(s.path).readsUsed,9);
});
test('same epoch cannot restart budget at another path',async()=>{
 const s=setup(),d=await start(s);await d.run({},'compatibility');const other=mkdtempSync(join(tmpdir(),'cmwebs-trial-other-'));chmodSync(other,0o700);await assert.rejects(trial.createAuthorityTrialDriver({...s.options,path:join(other,'ledger.json')}),/TRIAL_STOPPED/);assert.equal(ledgerAt(s.path).readsUsed,1);
});
for(const key of ['syntheticSheetId','callerHash','publisherHash','oauthClientHash','newCloudProject','sheetContractHash'])test('release rejects wrong bound '+key,()=>{
 assert.throws(()=>trial.verifyAuthorityTrialReadback(expected,{...observed(),[key]:'OTHER_SYNTHETIC_IDENTITY'}),/TRIAL_STOPPED/);
});
test('credential must be verified for the same caller and OAuth client',async()=>{
 const s=setup({credential:async()=>({accessToken:'SYNTHETIC',scopes,expiresAt:clock+3600000,refreshTokenPresent:false,callerHash:'OTHER_CALLER',oauthClientHash:'OTHER_CLIENT'})}),d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);
});
test('native account coverage must name the same fixed caller and publisher',async()=>{
 const s=setup({readNative:async()=>({...native(),accountHashes:['OTHER_CALLER','OTHER_PUBLISHER']})}),d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);
});
test('trial900 budget remains separate from complete pre-existing account usage',async()=>{
 const usage=()=>[expected.callerHash,expected.publisherHash].map(accountHash=>({accountHash,accountType:'consumer',windowStartMs:clock-86400000,windowEndMs:clock,allProjectRuntimeMs:1200000,triggerRuntimeMs:1000000,complete:true}));
 const s=setup({readNative:async phase=>({...native(phase==='before'?0:100,phase==='before'?null:{status:'COMPLETED',function:'authorizeTrial',deploymentId:id,startMs:clock,endMs:clock+100,durationMs:100}),accountUsage:usage()})}),d=await start(s);await d.run({},'compatibility');assert.equal(ledgerAt(s.path).nativeMs,100);
});
for(const [name,change] of [['unknown account type',{accountType:'UNKNOWN'}],['partial account history',{complete:false}],['unknown all-project runtime',{allProjectRuntimeMs:null}],['trigger quota without full native tail',{triggerRuntimeMs:5100000}],['shorter quota window',{windowStartMs:clock-3600000}],['different account',{accountHash:'OTHER'}]])test('no RPC with '+name,async()=>{
 const usage=[expected.callerHash,expected.publisherHash].map(accountHash=>({accountHash,accountType:'consumer',windowStartMs:clock-86400000,windowEndMs:clock,allProjectRuntimeMs:5200000,triggerRuntimeMs:0,complete:true}));usage[0]={...usage[0],...change};const s=setup({readNative:async()=>({...native(),accountUsage:usage})}),d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);
});
test('preparation management reads are inherited without opening a second40 budget',async()=>{
 const s=setup({preparation:{reads:7,sha256:hash}}),d=await start(s);assert.equal(ledgerAt(s.path).readsUsed,7);await d.run({},'compatibility');assert.equal(ledgerAt(s.path).readsUsed,8);
});
test('missing preparation receipt refuses silent zero initialization',async()=>{
 const s=setup();delete s.options.preparation;await assert.rejects(start(s),/TRIAL_STOPPED/);
});
test('changed preparation receipt cannot reinitialize the epoch',async()=>{
 const s=setup({preparation:{reads:7,sha256:hash}});await start(s);await assert.rejects(trial.createAuthorityTrialDriver({...s.options,preparation:{reads:0,sha256:hash}}),/TRIAL_STOPPED/);
});
test('release metadata reserves durably inside the existing RPC lock before IO',async()=>{
 const s=setup();let phase=0,io=0;
 s.options.readRelease=async control=>{const units=++phase===1?2:1;await control.reserveExternalReads(units);assert.equal(ledgerAt(s.path).readsUsed,phase===1?2:4);io++;return {...observed(),...s.options.expected};};
 const d=await start(s);await d.run({},'compatibility');assert.equal(io,2);assert.equal(s.calls(),1);assert.equal(ledgerAt(s.path).readsUsed,4);
});
test('pre-release metadata exhausts minute budget before RPC dispatch',async()=>{
 const s=setup({preparation:{reads:9,sha256:hash}});
 s.options.readRelease=async control=>{await control.reserveExternalReads(1);return {...observed(),...s.options.expected};};
 const d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,10);
});
test('pre-release metadata exhausts total40 before RPC dispatch',async()=>{
 const s=setup({preparation:{reads:39,sha256:hash}});
 s.options.readRelease=async control=>{await control.reserveExternalReads(1);return {...observed(),...s.options.expected};};
 const d=await start(s);s.setNow(clock+61000);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,40);
});
test('post-release metadata cannot exceed total40 or resume a spent RPC',async()=>{
 const s=setup({preparation:{reads:38,sha256:hash}});let phase=0;
 s.options.readRelease=async control=>{phase++;await control.reserveExternalReads(1);return {...observed(),...s.options.expected};};
 const d=await start(s);s.setNow(clock+61000);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(phase,2);assert.equal(s.calls(),1);assert.equal(ledgerAt(s.path).readsUsed,40);assert.equal(ledgerAt(s.path).nativeMs,100);await assert.rejects(start(s),/TRIAL_STOPPED/);
});
test('failed release metadata remains spent without raw observer error',async()=>{
 const s=setup({preparation:{reads:7,sha256:hash}});
 s.options.readRelease=async control=>{await control.reserveExternalReads(1);throw Error('PRIVATE_METADATA_FAILURE');};
 const d=await start(s);await assert.rejects(d.run({},'compatibility'),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,8);assert.equal(ledgerAt(s.path).state,'stopped');assert(!readFileSync(s.path,'utf8').includes('PRIVATE_METADATA_FAILURE'));
});
test('release observer cannot swallow a rejected metadata budget and dispatch',async()=>{
 const s=setup({preparation:{reads:9,sha256:hash}});
 s.options.readRelease=async control=>{try{await control.reserveExternalReads(2);}catch{}return {...observed(),...s.options.expected};};
 const d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).state,'stopped');
});
test('release debit capability expires when its observer returns',async()=>{
 const s=setup();let saved;
 s.options.readRelease=async control=>{saved=control.reserveExternalReads;return {...observed(),...s.options.expected};};
 const d=await start(s);await d.run({},'compatibility');await assert.rejects(saved(1),/TRIAL_STOPPED/);assert.equal(ledgerAt(s.path).readsUsed,1);
});
test('metadata observation keeps the epoch locked against another controller',async()=>{
 const s=setup();let release,enter,phase=0;const entered=new Promise(resolve=>{enter=resolve;});
 s.options.readRelease=async control=>{assert.equal(typeof control?.reserveExternalReads,'function');await control.reserveExternalReads(1);if(++phase===1){enter();await new Promise(resolve=>{release=resolve;});}return {...observed(),...s.options.expected};};
 const d=await start(s),other=await start(s);const running=d.run({},'compatibility');
 try{await Promise.race([entered,running]);await assert.rejects(other.reserveExternalReads(1),/TRIAL_STOPPED/);}finally{release?.();}
 await running;assert.equal(ledgerAt(s.path).readsUsed,3);
});

test('canonical compatibility rejects a request signed before a slow release observation',async()=>{
 const h=trialEntryRuntime();h.advance(clock-h.clock());const old=trialSigned(h);let sent=0,phase=0;
 const s=setup();s.options.readRelease=async control=>{
  await control.reserveExternalReads(1);if(++phase===1){h.advance(20000);s.setNow(h.clock());}
  return {...observed(),...s.options.expected};
 };
 s.options.transport=async call=>{sent++;return JSON.parse(JSON.stringify({done:true,response:{result:h.context.authorizeTrial(call.body.parameters[0],'compatibility')}}));};
 const d=await start(s);await assert.rejects(d.run(old,'compatibility'),/TRIAL_STOPPED/);
 assert.equal(sent,1);assert.equal(ledgerAt(s.path).readsUsed,2);assert.equal(ledgerAt(s.path).state,'stopped');
 assert.deepEqual([h.calls.google,h.calls.native,h.calls.line,h.calls.tokens],[0,0,0,0]);
});
test('request signing follows release, native and credential checks and passes the unchanged canonical prefix',async()=>{
 const h=trialEntryRuntime();h.advance(clock-h.clock());const cache=JSON.stringify([...h.cache]);
 let phase=0,signed=0,sent=0;const order=[],s=setup();
 s.options.readRelease=async control=>{
  await control.reserveExternalReads(1);if(++phase===1){order.push('release');h.advance(20000);s.setNow(h.clock());}
  return {...observed(),...s.options.expected};
 };
 const nativeRead=s.options.readNative;s.options.readNative=async phase=>{if(phase==='before')order.push('native');return nativeRead(phase);};
 const credential=s.options.credential;s.options.credential=async()=>{order.push('credential');assert.equal(signed,0);h.advance(20000);s.setNow(h.clock());return credential();};
 s.options.transport=async call=>{
  order.push('transport');sent++;assert.equal(call.body.parameters[0].timestamp,h.clock());
  return JSON.parse(JSON.stringify({done:true,response:{result:h.context.authorizeTrial(call.body.parameters[0],'compatibility')}}));
 };
 const d=await start(s);const result=await d.run(()=>{order.push('sign');signed++;return trialSigned(h);},'compatibility');
 assert.deepEqual(result,{compatible:true});assert.deepEqual(order,['release','native','credential','sign','transport']);
 assert.equal(signed,1);assert.equal(sent,1);assert.equal(ledgerAt(s.path).readsUsed,3);assert.equal(ledgerAt(s.path).state,'ready');
 assert.deepEqual([h.calls.google,h.calls.native,h.calls.line,h.calls.tokens],[0,0,0,0]);assert.equal(JSON.stringify([...h.cache]),cache);
 const text=readFileSync(s.path,'utf8');assert(!text.includes('synthetic-email-token'));assert(!text.includes('signature'));assert(!text.includes('SYNTHETIC_TOKEN'));
});
test('request factory is not invoked after credential veto',async()=>{
 let signed=0;const s=setup({credential:async()=>({accessToken:'PRIVATE',refreshTokenPresent:true})}),d=await start(s);
 await assert.rejects(d.run(()=>{signed++;throw Error('SIGNER_MUST_NOT_RUN');},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(signed,0);assert.equal(s.calls(),0);
});
test('request factory error leaves metadata spent and never prints its private error',async()=>{
 const s=setup();s.options.readRelease=async control=>{await control.reserveExternalReads(1);return {...observed(),...s.options.expected};};
 const d=await start(s);await assert.rejects(d.run(()=>{throw Error('PRIVATE_SIGNING_SECRET');},'compatibility'),/^Error: TRIAL_STOPPED$/);
 assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,1);assert.equal(ledgerAt(s.path).state,'stopped');
 assert(!readFileSync(s.path,'utf8').includes('PRIVATE_SIGNING_SECRET'));
});
test('async signing is rejected before its callback executes',async()=>{
 let signed=0;const s=setup(),d=await start(s);
 await assert.rejects(d.run(async()=>{signed++;throw Error('PRIVATE_ASYNC_ERROR');},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(signed,0);assert.equal(s.calls(),0);
});
test('promise-returning signing cannot dispatch',async()=>{
 const s=setup(),d=await start(s);
 await assert.rejects(d.run(()=>Promise.resolve({}),'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);
});
test('fresh signing cannot bypass a native observation expired during the callback',async()=>{
 const h=trialEntryRuntime();h.advance(clock-h.clock());const s=setup(),d=await start(s);
 await assert.rejects(d.run(()=>{h.advance(61001);s.setNow(h.clock());return trialSigned(h);},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,0);assert.equal(ledgerAt(s.path).state,'stopped');
});
for(const [name,mutate] of [
 ['old signature timestamp',r=>r.timestamp-=15001],
 ['extra field',r=>r.private='SYNTHETIC_PRIVATE_SIGNER'],
 ['invalid nonce',r=>r.nonce='short'],
 ['malformed payload',r=>r.payload='{'],
 ['unapproved route',r=>{const p=JSON.parse(r.payload);p.route='/v1/private';r.payload=JSON.stringify(p);}],
 ['wrong credential digest',r=>{const p=JSON.parse(r.payload);p.credential_digest='0'.repeat(64);r.payload=JSON.stringify(p);}]
])test('factory output rejected before Google transport: '+name,async()=>{
 const h=trialEntryRuntime();h.advance(clock-h.clock());const s=setup(),d=await start(s);
 await assert.rejects(d.run(()=>{const r=trialSigned(h);mutate(r);return r;},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,0);assert.equal(ledgerAt(s.path).state,'stopped');
});

test('factory primitive fields are snapshotted once before validation and dispatch',async()=>{
 const h=trialEntryRuntime();h.advance(clock-h.clock());const s=setup(),reads={},request=trialSigned(h),value={};let sent=0;
 s.options.transport=async call=>{sent++;const outgoing=JSON.parse(JSON.stringify(call.body.parameters[0]));assert.deepEqual(outgoing,request);return JSON.parse(JSON.stringify({done:true,response:{result:h.context.authorizeTrial(outgoing,'compatibility')}}));};
 const d=await start(s);
 // A getter must not be consulted again even though it changes after one read.
 for(const key of Object.keys(request))Object.defineProperty(value,key,{enumerable:true,get(){reads[key]=(reads[key]||0)+1;return reads[key]===1?request[key]:42;}});
 assert.deepEqual(await d.run(()=>value,'compatibility'),{compatible:true});
 assert.equal(sent,1);assert.deepEqual(Object.values(reads),[1,1,1,1,1]);
});

test('cross-realm rejected promise is consumed without raw unhandled rejection',()=>{
 const s=setup();const child=spawnSync(process.execPath,['--input-type=module','-e',`
  import vm from 'node:vm';
  import {createAuthorityTrialDriver} from ${JSON.stringify(new URL('../scripts/read-authority-trial-driver.mjs',import.meta.url).href)};
  let unhandled=false,calls=0;
  process.on('unhandledRejection',()=>{unhandled=true;});
  const d=await createAuthorityTrialDriver({...${JSON.stringify({path:s.path,expected:s.options.expected,preparation:s.options.preparation,expiresAt:s.options.expiresAt})},
   now:()=>${clock},readRelease:async()=>(${JSON.stringify({...observed(),...s.options.expected})}),
   readNative:async()=>(${JSON.stringify(native())}),
   credential:async()=>(${JSON.stringify({accessToken:'SYNTHETIC',scopes,expiresAt:clock+3600000,refreshTokenPresent:false,callerHash:expected.callerHash,oauthClientHash:expected.oauthClientHash})}),
   transport:async()=>{calls++;return {};}});
  let stopped=false;
  try{await d.run(()=>vm.runInNewContext('Promise.reject(new Error("SYNTHETIC_REJECTION_MUST_STAY_PRIVATE"))'),'compatibility');}
  catch(e){stopped=e.message==='TRIAL_STOPPED';}
  await new Promise(resolve=>setImmediate(resolve));
  process.stdout.write(JSON.stringify({stopped,calls,unhandled}));
 `],{encoding:'utf8',timeout:10000});
 assert.equal(child.status,0);assert.equal(child.stderr,'');
 assert.deepEqual(JSON.parse(child.stdout),{stopped:true,calls:0,unhandled:false});
});

for(const remaining of [5000,360000])test('token remaining '+remaining+'ms cannot mint a request or dispatch',async()=>{
 const s=setup();let signed=0;const original=s.options.credential;
 s.options.credential=async()=>({...await original(),expiresAt:clock+remaining});
 const d=await start(s);await assert.rejects(d.run(()=>{signed++;return {};},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(signed,0);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,0);
});
test('token with more than six minutes remaining can dispatch once',async()=>{
 const s=setup(),original=s.options.credential;s.options.credential=async()=>({...await original(),expiresAt:clock+360001});
 const d=await start(s);await d.run({},'compatibility');assert.equal(s.calls(),1);
});
test('signing delay rechecks full six-minute token headroom before dispatch',async()=>{
 const h=trialEntryRuntime();h.advance(clock-h.clock());const s=setup(),original=s.options.credential;
 s.options.credential=async()=>({...await original(),expiresAt:clock+360001});const d=await start(s);
 await assert.rejects(d.run(()=>{h.advance(1);s.setNow(h.clock());return trialSigned(h);},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,0);assert.equal(ledgerAt(s.path).state,'stopped');
});
test('factory accessor delay cannot dispatch a request past its canonical 15-second lifetime',async()=>{
 const h=trialEntryRuntime();h.advance(clock-h.clock());const s=setup();let sent=0;
 s.options.transport=async call=>{sent++;return JSON.parse(JSON.stringify({done:true,response:{result:h.context.authorizeTrial(call.body.parameters[0],'compatibility')}}));};
 const d=await start(s);
 await assert.rejects(d.run(()=>{
  const request=trialSigned(h),payload=request.payload;
  Object.defineProperty(request,'payload',{enumerable:true,get(){h.advance(20000);s.setNow(h.clock());return payload;}});
  return request;
 },'compatibility'),/TRIAL_STOPPED/);
 assert.equal(sent,0);assert.equal(ledgerAt(s.path).readsUsed,0);assert.equal(ledgerAt(s.path).state,'stopped');
});

test('slot wait retains spent preparation and only admits IO after a separate durable debit',async()=>{
 const s=setup({preparation:{reads:9,sha256:hash}});const waits=[];
 s.options.pause=async ms=>{waits.push(ms);assert.equal(ledgerAt(s.path).readsUsed,9);s.setNow(clock+ms);};
 const d=await start(s);assert.equal(typeof d.waitForExternalReadSlot,'function');
 await d.waitForExternalReadSlot(2);assert.deepEqual(waits,[60000]);assert.equal(ledgerAt(s.path).readsUsed,9);
 await d.reserveExternalReads(2);assert.equal(ledgerAt(s.path).readsUsed,11);assert.equal(s.calls(),0);
});
test('fifteen-item release waits before debit under the same epoch lock',async()=>{
 const s=setup(),waits=[];let observer=0,io=0,other;
 s.options.pause=async ms=>{waits.push(ms);assert.equal(ledgerAt(s.path).readsUsed,10);await assert.rejects(other.reserveExternalReads(1),/TRIAL_STOPPED/);s.setNow(clock+ms);};
 s.options.readRelease=async control=>{
  if(++observer===1)for(let i=0;i<15;i++){
   await control.waitForExternalReadSlot(1);await control.reserveExternalReads(1);
   assert.equal(ledgerAt(s.path).readsUsed,i+1);io++;
  }
  return {...observed(),...s.options.expected};
 };
 const d=await start(s);other=await start(s);await d.run({},'compatibility');
 assert.deepEqual(waits,[60000]);assert.equal(io,15);assert.equal(s.calls(),1);assert.equal(ledgerAt(s.path).readsUsed,16);assert.equal(ledgerAt(s.path).state,'ready');
});
test('slot wait uses the first sufficient expiring batch rather than an early partial slot',async()=>{
 const s=setup(),waits=[];s.options.pause=async ms=>{waits.push(ms);s.setNow(clock+10000+ms);};
 const d=await start(s);await d.reserveExternalReads(2);s.setNow(clock+10000);await d.reserveExternalReads(8);
 await d.waitForExternalReadSlot(3);assert.deepEqual(waits,[60000]);assert.equal(ledgerAt(s.path).readsUsed,10);
 await d.reserveExternalReads(3);assert.equal(ledgerAt(s.path).readsUsed,13);
});
for(const [name,change] of [
 ['frozen clock',()=>{}],
 ['crossed trial expiry',s=>s.setNow(clock+3600000)],
 ['changed Taipei day',s=>s.setNow(clock+86400000)],
 ['deleted journal',s=>unlinkSync(s.path)],
 ['private pause failure',()=>{throw Error('SYNTHETIC_PRIVATE_WAIT_FAILURE');}]
])test('slot wait stops on '+name+' without debit or RPC',async()=>{
 const s=setup({preparation:{reads:10,sha256:hash}});s.options.pause=async()=>change(s);
 const d=await start(s);assert.equal(typeof d.waitForExternalReadSlot,'function');
 await assert.rejects(d.waitForExternalReadSlot(1),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls(),0);
 await assert.rejects(start(s),/TRIAL_STOPPED/);
});
test('slot wait does not sleep or forgive an exhausted total40',async()=>{
 let waited=0;const s=setup({preparation:{reads:40,sha256:hash},pause:async()=>{waited++;}}),d=await start(s);
 assert.equal(typeof d.waitForExternalReadSlot,'function');await assert.rejects(d.waitForExternalReadSlot(1),/TRIAL_STOPPED/);
 assert.equal(waited,0);assert.equal(ledgerAt(s.path).readsUsed,40);assert.equal(s.calls(),0);
});
test('expired scoped wait capability never waits or modifies the ready journal',async()=>{
 let saved,waited=0;const s=setup({pause:async()=>{waited++;}});
 s.options.readRelease=async control=>{saved=control.waitForExternalReadSlot;return {...observed(),...s.options.expected};};
 const d=await start(s);await d.run({},'compatibility');assert.equal(typeof saved,'function');
 await assert.rejects(saved(1),/TRIAL_STOPPED/);assert.equal(waited,0);assert.equal(ledgerAt(s.path).readsUsed,1);
});
test('release observer cannot swallow a failed slot wait and dispatch',async()=>{
 const s=setup();s.options.readRelease=async control=>{try{await control.waitForExternalReadSlot(11);}catch{}return {...observed(),...s.options.expected};};
 const d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).state,'stopped');
});
test('slot wait refuses a predicted expiry boundary before sleeping',async()=>{
 let waited=0;const s=setup({preparation:{reads:10,sha256:hash},expiresAt:clock+60000,pause:async()=>{waited++;}}),d=await start(s);
 assert.equal(typeof d.waitForExternalReadSlot,'function');await assert.rejects(d.waitForExternalReadSlot(1),/TRIAL_STOPPED/);
 assert.equal(waited,0);assert.equal(ledgerAt(s.path).readsUsed,10);
});
test('readiness without debit cannot refill a rolling window or change total40',async()=>{
 let waited=0;const s=setup({pause:async()=>{waited++;}}),d=await start(s);
 assert.equal(typeof d.waitForExternalReadSlot,'function');await d.waitForExternalReadSlot(10);
 assert.equal(waited,0);assert.equal(ledgerAt(s.path).readsUsed,0);assert.deepEqual(ledgerAt(s.path).calls,[]);
});
test('unawaited release slot wait vetoes dispatch and consumes its late rejection',async()=>{
 const s=setup();let finish,phase=0;const failures=[];
 s.options.pause=()=>new Promise(resolve=>{finish=resolve;});
 s.options.readRelease=async control=>{
  if(++phase===1){await control.reserveExternalReads(10);void control.waitForExternalReadSlot(1).catch(()=>{failures.push('stopped');});s.setNow(clock+60000);}
  return {...observed(),...s.options.expected};
 };
 const d=await start(s);
 try{await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);}
 finally{s.setNow(clock+60000);finish?.();await new Promise(resolve=>setImmediate(resolve));}
 assert.deepEqual(failures,['stopped']);assert.equal(ledgerAt(s.path).readsUsed,10);assert.equal(ledgerAt(s.path).state,'stopped');
});

test('native before/after observations debit the same locked journal before IO',async()=>{
 const s=setup(),original=s.options.readNative,io=[];
 s.options.readNative=async(phase,control)=>{
  assert.equal(typeof control?.waitForExternalReadSlot,'function');assert.equal(typeof control?.reserveExternalReads,'function');
  await control.waitForExternalReadSlot(2);await control.reserveExternalReads(2);
  io.push([phase,ledgerAt(s.path).readsUsed]);return original(phase);
 };
 const d=await start(s);await d.run({},'compatibility');
 assert.deepEqual(io,[['before',2],['after',5]]);assert.equal(ledgerAt(s.path).readsUsed,5);assert.equal(s.calls(),1);
});
test('native before observation cannot consume remaining minute headroom then dispatch',async()=>{
 const s=setup(),original=s.options.readNative;
 s.options.readNative=async(phase,control)=>{await control.reserveExternalReads(10);return original(phase);};
 const d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,10);assert.equal(ledgerAt(s.path).state,'stopped');
});
test('native observation IO failure remains spent without its private error',async()=>{
 const s=setup();s.options.readNative=async(_phase,control)=>{await control.reserveExternalReads(2);throw Error('SYNTHETIC_NATIVE_PRIVATE_NAME');};
 const d=await start(s);await assert.rejects(d.run({},'compatibility'),/^Error: TRIAL_STOPPED$/);
 assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,2);assert.equal(ledgerAt(s.path).state,'stopped');
 assert(!readFileSync(s.path,'utf8').includes('SYNTHETIC_NATIVE_PRIVATE_NAME'));
});
test('native observer cannot swallow debit rejection and return a positive proof',async()=>{
 const s=setup(),original=s.options.readNative;
 s.options.readNative=async(phase,control)=>{if(phase==='before')try{await control.reserveExternalReads(11);}catch{}return original(phase);};
 const d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,0);assert.equal(ledgerAt(s.path).state,'stopped');
});
test('native after debit failure preserves spent RPC and pending unknown terminal',async()=>{
 const s=setup({preparation:{reads:38,sha256:hash}}),original=s.options.readNative;let afterIO=0;
 s.options.readNative=async(phase,control)=>{
  if(phase==='after'){
   // Characterize the old collector path: without a scoped debit interface it
   // could return a positive screen proof even after spending the last budget.
   if(control)await control.reserveExternalReads(2);afterIO++;
  }
  return original(phase);
 };
 const d=await start(s);s.setNow(clock+61000);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);
 const l=ledgerAt(s.path);assert.equal(s.calls(),1);assert.equal(afterIO,0);assert.equal(l.readsUsed,39);assert.equal(l.state,'stopped');
 assert.deepEqual(l.pending,{started:clock+61000,operation:'compatibility'});assert.equal(l.nativeMs,0);assert.equal(l.lastExecutionHash,null);
 await assert.rejects(start(s),/TRIAL_STOPPED/);
});
test('native control expires on observer return and cannot debit the next phase',async()=>{
 const s=setup(),original=s.options.readNative;let saved;
 s.options.readNative=async(phase,control)=>{if(phase==='before')saved=control;return original(phase);};
 const d=await start(s);await d.run({},'compatibility');assert.equal(typeof saved?.reserveExternalReads,'function');
 await assert.rejects(saved.reserveExternalReads(1),/TRIAL_STOPPED/);await assert.rejects(saved.waitForExternalReadSlot(1),/TRIAL_STOPPED/);
 assert.equal(ledgerAt(s.path).readsUsed,1);assert.equal(ledgerAt(s.path).state,'ready');
});
test('native wait keeps the epoch locked and yields a fresh proof only after debit',async()=>{
 const s=setup({preparation:{reads:9,sha256:hash}}),original=s.options.readNative,waits=[];let other;
 s.options.pause=async ms=>{waits.push(ms);await assert.rejects(other.reserveExternalReads(1),/TRIAL_STOPPED/);s.setNow(clock+ms);};
 s.options.readNative=async(phase,control)=>{
  if(phase==='before'){await control.waitForExternalReadSlot(2);await control.reserveExternalReads(2);assert.equal(ledgerAt(s.path).readsUsed,11);}
  return original(phase);
 };
 const d=await start(s);other=await start(s);await d.run({},'compatibility');
 assert.deepEqual(waits,[60000]);assert.equal(ledgerAt(s.path).readsUsed,12);assert.equal(s.calls(),1);
});
test('unawaited native readiness vetoes dispatch while preserving its spent reads',async()=>{
 const s=setup(),original=s.options.readNative;let finish;const failures=[];
 s.options.pause=()=>new Promise(resolve=>{finish=resolve;});
 s.options.readNative=async(phase,control)=>{
  if(phase==='before'){await control.reserveExternalReads(10);void control.waitForExternalReadSlot(1).catch(()=>{failures.push('stopped');});s.setNow(clock+60000);}
  return original(phase);
 };
 const d=await start(s);
 try{await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);}
 finally{s.setNow(clock+60000);finish?.();await new Promise(resolve=>setImmediate(resolve));}
 assert.deepEqual(failures,['stopped']);assert.equal(ledgerAt(s.path).readsUsed,10);assert.equal(ledgerAt(s.path).state,'stopped');
});

test('atomic observer capability waits and debits before IO, then expires',async()=>{
 const s=setup();let saved,io=0;
 s.options.readRelease=async control=>{assert.equal(typeof control.externalRead,'function');saved=control.externalRead;await control.externalRead(async()=>{io++;assert.equal(ledgerAt(s.path).readsUsed,io+(io===2?1:0));});return {...observed(),...s.options.expected};};
 const d=await start(s);await d.run({},'compatibility');assert.equal(io,2);await assert.rejects(saved(async()=>{io++;}),/TRIAL_STOPPED/);assert.equal(io,2);
});
test('caught atomic observer IO failure cannot dispatch',async()=>{
 const s=setup();s.options.readRelease=async control=>{assert.equal(typeof control.externalRead,'function');try{await control.externalRead(async()=>{throw Error('SYNTHETIC_IO_FAILURE');});}catch{}return {...observed(),...s.options.expected};};
 const d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,1);
});
test('unawaited entered atomic observer IO retains epoch lock until settlement',async()=>{
 const s=setup();let enter,release,settled=false;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 s.options.readRelease=async control=>{assert.equal(typeof control.externalRead,'function');void control.externalRead(async()=>{enter();await gate;}).catch(()=>{});await entered;return {...observed(),...s.options.expected};};
 const d=await start(s),other=await start(s),running=d.run({},'compatibility');void running.catch(()=>{});
 await Promise.race([entered,running]);running.then(()=>{settled=true;},()=>{settled=true;});await new Promise(r=>setImmediate(r));
 try{assert.equal(settled,false);await assert.rejects(other.reserveExternalReads(1),/TRIAL_STOPPED/);assert.equal(ledgerAt(s.path).readsUsed,1);}finally{release();await assert.rejects(running,/TRIAL_STOPPED/);}
 assert.equal(s.calls(),0);
});

test('same runtime observer rejects a second atomic read while first IO is pending',async()=>{
 const s=setup();let phase=0,enter,release,rejected=false,secondIO=0,maximum=0,active=0;
 const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 s.options.readRelease=async control=>{
  if(++phase===1){
   const first=control.externalRead(async()=>{active++;maximum=Math.max(maximum,active);enter();await gate;active--;});void first.catch(()=>{});await entered;
   try{try{await control.externalRead(async()=>{secondIO++;active++;maximum=Math.max(maximum,active);active--;});}catch{rejected=true;}}finally{release();await first;}
  }
  return {...observed(),...s.options.expected};
 };
 const driver=await start(s);await assert.rejects(driver.run({},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(rejected,true);assert.equal(secondIO,0);assert.equal(maximum,1);assert.equal(s.calls(),0);assert.equal(ledgerAt(s.path).readsUsed,1);
});

test('denial after debit but before queued runtime IO vetoes callback without refund',async()=>{
 const s=setup();let firstIO=0,secondIO=0,second,polls=0,denied=false;
 s.options.readRelease=async cap=>{
  const first=cap.externalRead(async()=>{firstIO++;});void first.catch(()=>{});
  const tick=()=>{
   if(++polls>100)return;
   if(ledgerAt(s.path).readsUsed===1)queueMicrotask(()=>{
    denied=true;second=cap.externalRead(async()=>{secondIO++;});void second.catch(()=>{});
   });
   else queueMicrotask(tick);
  };
  queueMicrotask(tick);await first.catch(()=>{});if(second)await second.catch(()=>{});
  return {...observed(),...s.options.expected};
 };
 const d=await start(s);await assert.rejects(d.run({},'compatibility'),/TRIAL_STOPPED/);
 assert.equal(denied,true);assert.equal(firstIO,0);assert.equal(secondIO,0);assert.equal(s.calls(),0);
 assert.equal(ledgerAt(s.path).readsUsed,1);assert.equal(ledgerAt(s.path).state,'stopped');
});
