import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import * as trial from '../scripts/read-authority-trial-driver.mjs';
import {createAuthorityPreparationControl} from '../scripts/read-authority-preparation-control.mjs';
import {trialEntryRuntime,trialSigned} from './fixtures/read-parity/trial-entry-runtime.mjs';
import {createAuthorityTrialMetadataAdapters} from '../scripts/read-authority-trial-metadata.mjs';
import vm from 'node:vm';
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-14T00:00:00Z');
function setup(){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-canonical-driver-'));chmodSync(dir,0o700);const path=join(dir,'budget.json');let time=clock,total=0,last;
 const epoch='SYNTHETIC_CANONICAL_DRIVER_'+randomUUID(),expected={deploymentId:'SYNTHETIC_DEPLOYMENT_ID',thinScriptId:'SYNTHETIC_THIN_SCRIPT',libraryId:'SYNTHETIC_LIBRARY_SCRIPT',libraryVersion:7,librarySourceHash:'a'.repeat(64),thinSourceHash:'a'.repeat(64),libraryManifestHash:'a'.repeat(64),thinManifestHash:'a'.repeat(64),originalEditorHash:'a'.repeat(64),originalDeploymentsHash:'a'.repeat(64),originalCloudProject:'SYNTHETIC_DEFAULT',trialEpoch:epoch,syntheticSheetId:'SYNTHETIC_UNBOUND_SHEET',callerHash:'b'.repeat(64),publisherHash:'c'.repeat(64),oauthClientHash:'d'.repeat(64),newCloudProject:'SYNTHETIC_NEW_PROJECT',sheetContractHash:'e'.repeat(64)};
 const raw=JSON.stringify({limit:160,spent:25,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40});writeFileSync(path,raw,{mode:0o600});
 const controlOptions={path,epoch,approvalHash:'a'.repeat(64),proposalHash:'b'.repeat(64),legacySha256:hash(raw),importedReads:25,expiresAt:clock+21600000,now:()=>time,pause:async ms=>{time+=ms;}};
 const control=createAuthorityPreparationControl(controlOptions),calls={release:0,native:0,rpc:0,credential:0,signer:0};
 const release=()=>({...expected,scopes:[...trial.AUTHORITY_TRIAL_SCOPES],developmentMode:false,executionAccess:'ANYONE',oauthStatus:'TESTING',testingUsers:1,callerSheetRole:'reader',callerLibraryRole:'none',callerPropertiesMatch:true,libraryPropertiesMatch:true,originalTriggers:0,retainedVersions:[1,2,3,4,5,6],originalEditorRestored:true});
 const native=()=>({source:'google-native-ui',coverage:'caller-and-publisher-all-projects',accountHashes:[expected.callerHash,expected.publisherHash],trialScriptIds:[expected.libraryId,expected.thinScriptId],accountUsage:[expected.callerHash,expected.publisherHash].map(accountHash=>({accountHash,accountType:'consumer',windowStartMs:time-86400000,windowEndMs:time,allProjectRuntimeMs:total,triggerRuntimeMs:0,complete:true})),observedAt:time,day:'2026-10-14',complete:true,active:0,totalMs:total,execution:last});
 const options={expected,expiresAt:controlOptions.expiresAt,now:()=>time,control,readRelease:async cap=>{await cap.externalRead(async()=>{calls.release++;});return release();},readNative:async(phase,cap)=>{await cap.externalRead(async()=>{calls.native++;});if(phase==='after'){time=Math.max(time,last.endMs);total+=last.durationMs;}return native();},credential:()=>{calls.credential++;return {accessToken:'SYNTHETIC_SECRET_NEVER_PERSIST',scopes:[...trial.AUTHORITY_TRIAL_SCOPES],expiresAt:clock+3600000,refreshTokenPresent:false,callerHash:expected.callerHash,oauthClientHash:expected.oauthClientHash};},transport:async call=>{calls.rpc++;last={status:'COMPLETED',function:call.body.function,deploymentId:expected.deploymentId,startMs:time,endMs:time+100,durationMs:100};return {done:true,response:{result:{compatible:true}}};}};
 options.signRequest=()=>{calls.signer++;return {action:'read_replica_authorize',nonce:randomUUID(),payload:JSON.stringify({protocol:'session',credential:'SYNTHETIC_SESSION_NEVER_PERSIST',credential_digest:hash('session:SYNTHETIC_SESSION_NEVER_PERSIST'),route:'/v1/arrears'}),signature:'f'.repeat(64),timestamp:time};};
 return {path,options,control,controlOptions,calls,release,native,get:()=>JSON.parse(readFileSync(path)),now:()=>time,setNow:v=>{time=v;},setTotal:v=>{total=v;}};
}
async function prepare(s,binding=trial.canonicalAuthorityTrialBinding(s.options.expected)){
 await s.control.withPreparation(async cap=>{await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.handoff({runtimeBinding:binding,expectedSpent:27});});
}
function driver(s){assert.equal(typeof trial.createCanonicalAuthorityTrialDriver,'function');return trial.createCanonicalAuthorityTrialDriver(s.options);}
test('canonical driver construction is pure and expected binding ignores field insertion order',()=>{
 const s=setup(),before=readFileSync(s.path);assert.equal(typeof trial.canonicalAuthorityTrialBinding,'function');const binding=trial.canonicalAuthorityTrialBinding(s.options.expected);
 assert.equal(binding,trial.canonicalAuthorityTrialBinding(Object.fromEntries(Object.entries(s.options.expected).reverse())));assert(Object.isFrozen(driver(s)));assert.deepEqual(readFileSync(s.path),before);assert.deepEqual(s.calls,{release:0,native:0,rpc:0,credential:0,signer:0});
});
test('fixed wrapper and qualified integrate release/native/credential/RPC in the existing canonical ledger',async()=>{
 const s=setup();await prepare(s);const original=s.options.transport;s.options.transport=async call=>{
  const ledger=s.get(),entry=ledger.preparation.runtime.entries.at(-1);assert.equal(ledger.preparation.events.at(-1).kind,'R');assert.equal(entry.complete,false);assert.equal(entry.entry,call.body.function==='authorizeTrial'?'wrapper':'qualified');assert.equal(call.url,'https://script.googleapis.com/v1/scripts/SYNTHETIC_DEPLOYMENT_ID:run');assert.equal(call.body.parameters[1],'compatibility');assert.equal(call.body.parameters[0].action,'read_replica_authorize');assert.equal(call.body.parameters[0].timestamp,s.now());assert.equal(call.body.devMode,false);assert(Object.isFrozen(call));return original(call);
 };
 const d=driver(s);assert.deepEqual(await d.run('wrapper'),{compatible:true});assert.deepEqual(await d.run('qualified'),{compatible:true});assert.equal(s.get().spent,37);assert.deepEqual(s.get().preparation.runtime.entries.map(e=>e.entry),['wrapper','qualified']);assert.equal(s.get().preparation.runtime.nativeMs,200);assert.equal(s.get().preparation.runtime.pending,null);assert.deepEqual(s.calls,{release:4,native:4,rpc:2,credential:2,signer:2});
 assert(!readFileSync(s.path,'utf8').includes('SYNTHETIC_SECRET'));assert(!readFileSync(s.path,'utf8').includes('compatible'));
 const before=readFileSync(s.path);await assert.rejects(d.run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.get().spent,37);assert.equal(s.calls.rpc,2);assert.equal(s.get().preparation.state,'stopped');assert.notDeepEqual(readFileSync(s.path),before);
});
for(const entry of ['authority','private','qualified'])test('unapproved or out-of-order '+entry+' cannot observe or execute',async()=>{
 const s=setup();await prepare(s);await assert.rejects(driver(s).run(entry),/TRIAL_STOPPED/);assert.equal(s.get().spent,27);assert.equal(s.calls.release+s.calls.native+s.calls.rpc+s.calls.credential,0);
});
test('run cannot accept a caller payload or operation override',async()=>{
 const s=setup();await prepare(s);await assert.rejects(driver(s).run('wrapper',{credential:'SYNTHETIC_PRIVATE'}),/TRIAL_STOPPED/);assert.equal(s.get().spent,27);assert.equal(s.calls.rpc,0);
});
for(const field of ['callerHash','librarySourceHash','deploymentId','trialEpoch'])test('expected pin '+field+' mismatch refuses before observers',async()=>{
 const s=setup();await prepare(s);s.options.expected={...s.options.expected,[field]:field.endsWith('Hash')?'f'.repeat(64):'SYNTHETIC_OTHER_PIN_1234567890'};await assert.rejects(driver(s).run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.calls.release+s.calls.native+s.calls.rpc,0);assert.equal(s.get().spent,27);
});
test('canonical epoch and expiry must match even if a foreign binding was handed off',async()=>{
 const s=setup();s.options.expected={...s.options.expected,trialEpoch:'SYNTHETIC_OTHER_EPOCH_1234567890'};await prepare(s);await assert.rejects(driver(s).run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.get().spent,27);assert.equal(s.calls.release,0);
 const other=setup();await prepare(other);other.options.expiresAt-=1;await assert.rejects(driver(other).run('wrapper'),/TRIAL_STOPPED/);assert.equal(other.get().spent,27);assert.equal(other.calls.release,0);
});
for(const [name,patch] of [['refresh',{refreshTokenPresent:true}],['caller',{callerHash:'f'.repeat(64)}],['scope',{scopes:[]}],['short-lived',{expiresAt:clock+420000}],['over-epoch',{expiresAt:clock+21600001}]])test('credential '+name+' refuses before R without storing token',async()=>{
 const s=setup();await prepare(s);const original=s.options.credential;s.options.credential=()=>({...original(),...patch});await assert.rejects(driver(s).run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.get().spent,29);assert.equal(s.calls.rpc,0);assert.equal(s.get().preparation.version,2);assert(!readFileSync(s.path,'utf8').includes('SYNTHETIC_SECRET'));
});
test('credential must be synchronous; promise cannot dispatch',async()=>{
 const s=setup();await prepare(s);const original=s.options.credential;s.options.credential=async()=>original();await assert.rejects(driver(s).run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.calls.rpc,0);assert.equal(s.get().spent,29);
});
for(const [name,patch] of [['active',{active:1}],['incomplete',{complete:false}],['over-reserve',{totalMs:540001}],['quota',{accountUsage:[]}],['stale',{observedAt:clock-1}]])test('native before '+name+' refuses without R',async()=>{
 const s=setup();await prepare(s);const original=s.options.readNative;s.options.readNative=async(...args)=>({...await original(...args),...patch});await assert.rejects(driver(s).run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.calls.rpc,0);assert.equal(s.get().spent,29);
});
test('transport unknown still settles native runtime, retaining pending/UNKNOWN and no retry',async()=>{
 const s=setup();await prepare(s);const original=s.options.transport;s.options.transport=async call=>{await original(call);throw Error('SYNTHETIC_PRIVATE_TRANSPORT_FAILURE');};const d=driver(s);
 await assert.rejects(d.run('wrapper'),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.rpc,1);assert.equal(s.get().spent,31);assert.equal(s.get().preparation.runtime.nativeMs,100);assert.equal(s.get().preparation.runtime.pending.entry,'wrapper');
 s.setNow(clock+21600001);let cleanup=0;await d.cleanup('close-deployment',async()=>{cleanup++;});assert.equal(cleanup,1);assert.equal(s.get().spent,32);assert(s.get().preparation.runtime.pending);assert(!readFileSync(s.path,'utf8').includes('PRIVATE_TRANSPORT'));
});
test('API result failure accounts native before refusing completion and preserves the entry',async()=>{
 const s=setup();await prepare(s);const original=s.options.transport;s.options.transport=async call=>{await original(call);return {done:true,error:{message:'SYNTHETIC_PRIVATE_API_FAILURE'}};};await assert.rejects(driver(s).run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.get().spent,31);assert.equal(s.get().preparation.runtime.nativeMs,100);assert(s.get().preparation.runtime.pending);assert.equal(s.calls.release,1);
});
test('post-release drift refuses finish after native accounting',async()=>{
 const s=setup();await prepare(s);const original=s.options.readRelease;s.options.readRelease=async cap=>{const r=await original(cap);return s.calls.release===2?{...r,callerLibraryRole:'viewer'}:r;};await assert.rejects(driver(s).run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.get().spent,32);assert.equal(s.get().preparation.runtime.nativeMs,100);assert(s.get().preparation.runtime.pending);
});
test('caught observer IO failure cannot dispatch or clear stopped state',async()=>{
 const s=setup();await prepare(s);s.options.readRelease=async cap=>{await cap.externalRead(async()=>{throw Error('SYNTHETIC_PRIVATE_OBSERVER');}).catch(()=>{});return s.release();};await assert.rejects(driver(s).run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.calls.rpc,0);assert.equal(s.get().spent,28);assert.equal(s.get().preparation.state,'stopped');
});
test('unawaited entered observer IO retains canonical flock until settlement and escaped caps deny',async()=>{
 const s=setup();await prepare(s);let enter,release,saved;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});s.options.readRelease=async cap=>{saved=cap;void cap.externalRead(async()=>{enter();await gate;});await entered;return s.release();};
 const running=driver(s).run('wrapper');void running.catch(()=>{});await entered;let peer=0;
 try{await assert.rejects(createAuthorityPreparationControl(s.controlOptions).withRuntime(trial.canonicalAuthorityTrialBinding(s.options.expected),async()=>{peer++;}),/TRIAL_STOPPED/);}finally{release();await assert.rejects(running,/TRIAL_STOPPED/);}
 await assert.rejects(saved.externalRead(async()=>{peer++;}),/TRIAL_STOPPED/);assert.equal(peer,0);assert.equal(s.calls.rpc,0);assert.equal(s.get().spent,28);
});
test('stopped entered transport completes settlement before cleanup, never finishing pending',async()=>{
 const s=setup();await prepare(s);let enter,release;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});const original=s.options.transport;s.options.transport=async call=>{const value=await original(call);enter();await gate;return value;};const d=driver(s),running=d.run('wrapper');void running.catch(()=>{});await entered;let cleanup=0;
 try{await d.requestStop();await assert.rejects(d.cleanup('close-deployment',async()=>{cleanup++;}),/TRIAL_STOPPED/);}finally{release();await assert.rejects(running,/TRIAL_STOPPED/);}
 assert.equal(cleanup,0);assert.equal(s.get().preparation.runtime.nativeMs,100);assert(s.get().preparation.runtime.pending);await d.cleanup('close-deployment',async()=>{cleanup++;});assert.equal(cleanup,1);assert.equal(s.calls.rpc,1);
});
test('partial stop ACK failure does not block independently verified once-only cleanup',async()=>{
 const s=setup();await prepare(s);writeFileSync(s.path+'.preparation-stop.json','{"value',{mode:0o600});const d=driver(s);let cleanup=0;await d.cleanup('close-deployment',async()=>{cleanup++;});await assert.rejects(d.cleanup('close-deployment',async()=>{cleanup++;}),/TRIAL_STOPPED/);assert.equal(cleanup,1);assert.equal(s.get().spent,28);assert.equal(readFileSync(s.path+'.preparation-stop.json','utf8'),'{"value');
});
test('canonical driver preserves the actual GAS signed compatibility prefix without authority/cache/Sheets IO',async()=>{
 const s=setup();await prepare(s);const h=trialEntryRuntime(),cache=JSON.stringify([...h.cache]);let actual;
 s.options.signRequest=()=>{s.calls.signer++;h.advance(s.now()-h.clock());return trialSigned(h);};
 const original=s.options.transport;s.options.transport=async call=>{await original(call);h.advance(s.now()-h.clock());actual=JSON.parse(JSON.stringify(h.context.authorizeTrial(call.body.parameters[0],call.body.parameters[1])));return {done:true,response:{result:actual}};};
 const d=driver(s);await d.run('wrapper');await d.run('qualified');assert.deepEqual(actual,{compatible:true});assert.equal(s.calls.signer,2);assert.equal(JSON.stringify([...h.cache]),cache);assert.deepEqual([h.calls.native,h.calls.google,h.calls.line,h.calls.tokens],[0,0,0,0]);
});
for(const [name,make] of [['async',s=>async()=>s.options.signRequest()],['stale',s=>()=>({...s.options.signRequest(),timestamp:s.now()-15001})],['bad-fields',()=>()=>({credential:'SYNTHETIC_PRIVATE'})]])test('synchronous signer refuses '+name+' after intent without transport or extra settlement IO',async()=>{
 const s=setup();await prepare(s);const original=s.options.signRequest;s.options.signRequest=make({...s,options:{...s.options,signRequest:original}});await assert.rejects(driver(s).run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.calls.rpc,0);assert.equal(s.get().spent,30);assert.equal(s.calls.native,1);assert(s.get().preparation.runtime.pending);assert(!readFileSync(s.path,'utf8').includes('SYNTHETIC_SESSION'));
});
for(const [name,patch] of [['wrong-function',{function:'private'}],['wrong-deployment',{deploymentId:'OTHER'}],['nonterminal',{status:'RUNNING'}],['over-six-minutes',{durationMs:360001}],['impossible-time',{endMs:clock-1}],['runtime-undercount',{durationMs:101}]])test('native after '+name+' cannot account or clear pending',async()=>{
 const s=setup();await prepare(s);const original=s.options.readNative;s.options.readNative=async(phase,cap)=>{const p=await original(phase,cap);return phase==='after'?{...p,execution:{...p.execution,...patch}}:p;};await assert.rejects(driver(s).run('wrapper'),/TRIAL_STOPPED/);assert.equal(s.get().spent,31);assert.equal(s.get().preparation.runtime.nativeMs,0);assert(s.get().preparation.runtime.pending);
});
test('fixed HTTP rejection retains canonical flock through awaited body cancellation then native settlement',async()=>{
 const s=setup();await prepare(s);let entered,release;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});const original=s.options.transport;
 s.options.transport=trial.createGoogleExecutionTransport(s.options.expected.deploymentId,async()=>{await original({body:{function:'authorizeTrial'}});return {status:500,body:{cancel:async()=>{entered();await gate;}}};});
 const d=driver(s),running=d.run('wrapper');void running.catch(()=>{});await started;let peer=0;
 try{await assert.rejects(createAuthorityPreparationControl(s.controlOptions).withRuntime(trial.canonicalAuthorityTrialBinding(s.options.expected),async()=>{peer++;}),/TRIAL_STOPPED/);}finally{release();await assert.rejects(running,/TRIAL_STOPPED/);}
 assert.equal(peer,0);assert.equal(s.calls.rpc,1);assert.equal(s.get().spent,31);assert.equal(s.get().preparation.runtime.nativeMs,100);assert(s.get().preparation.runtime.pending);await d.cleanup('close-deployment',async()=>{peer++;});assert.equal(peer,1);
});
test('fixed metadata adapter uses ordinary before and paid S after in the same canonical counter',async()=>{
 const s=setup();await prepare(s);let io=0;
 const adapter=createAuthorityTrialMetadataAdapters({originalSheetId:'SYNTHETIC_ORIGINAL_CONTAINER',syntheticSheetId:s.options.expected.syntheticSheetId,expectedTabNames:Array.from({length:20},(_,i)=>'Synthetic_tab_'+i),publisherHash:s.options.expected.publisherHash,callerHash:s.options.expected.callerHash,now:s.options.now,
  credential:()=>({accessToken:'SYNTHETIC_METADATA_TOKEN',accountHash:s.options.expected.publisherHash,scopes:['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(v=>'https://www.googleapis.com/auth/'+v),expiresAt:clock+3600000,refreshTokenPresent:true}),
  fetcher:async()=>{io++;assert.equal(s.get().preparation.events.at(-1).kind,io===1?'ordinary':'S');return new Response(JSON.stringify({permissions:[]}));}});
 s.options.readRelease=async cap=>{await adapter.read('original-acl',cap);return s.release();};await driver(s).run('wrapper');assert.equal(io,2);assert.equal(s.get().spent,32);assert.equal(s.get().preparation.runtime.pending,null);
});
for(const status of [302,500])test('execution transport rejected status '+status+' awaits body cancellation before releasing',async()=>{
 let cancel,done=false;const gate=new Promise(r=>{cancel=r;}),transport=trial.createGoogleExecutionTransport('SYNTHETIC_DEPLOYMENT_ID',async()=>({status,body:{cancel:async()=>{await gate;done=true;}}}));
 const running=transport({url:'https://script.googleapis.com/v1/scripts/SYNTHETIC_DEPLOYMENT_ID:run',accessToken:'SYNTHETIC_TOKEN',body:{function:'authorizeTrial',parameters:[{},'compatibility'],devMode:false}});let settled=false;void running.then(()=>{settled=true;},()=>{settled=true;});await new Promise(r=>setImmediate(r));assert.equal(settled,false);cancel();await assert.rejects(running,/TRIAL_STOPPED/);assert.equal(done,true);
});
test('execution transport oversize cancellation remains owned until settlement',async()=>{
 let cancel,entered,released=false;const gate=new Promise(r=>{cancel=r;}),started=new Promise(r=>{entered=r;});const transport=trial.createGoogleExecutionTransport('SYNTHETIC_DEPLOYMENT_ID',async()=>({status:200,body:{getReader:()=>({read:async()=>({done:false,value:new Uint8Array(30001)}),cancel:async()=>{entered();await gate;},releaseLock:()=>{released=true;}})}}));
 const running=transport({url:'https://script.googleapis.com/v1/scripts/SYNTHETIC_DEPLOYMENT_ID:run',accessToken:'SYNTHETIC_TOKEN',body:{function:'authorizeTrial',parameters:[{},'compatibility'],devMode:false}});void running.catch(()=>{});await started;assert.equal(released,false);cancel();await assert.rejects(running,/TRIAL_STOPPED/);assert.equal(released,true);
});
test('execution transport accepts genuine Uint8Array from the CUA module realm without weakening byte validation',async()=>{
 const bytes=vm.runInNewContext('new Uint8Array(bytes)',{bytes:[...Buffer.from(JSON.stringify({done:true,response:{result:{compatible:true}}}))]});assert.equal(bytes instanceof Uint8Array,false);let read=false;
 const t=trial.createGoogleExecutionTransport('SYNTHETIC_DEPLOYMENT_ID',async()=>({status:200,body:{getReader:()=>({read:async()=>read?{done:true}:(read=true,{done:false,value:bytes}),cancel:async()=>{},releaseLock:()=>{}})}}));
 const value=await t({url:'https://script.googleapis.com/v1/scripts/SYNTHETIC_DEPLOYMENT_ID:run',accessToken:'SYNTHETIC_TOKEN',body:{function:'authorizeTrial',parameters:[{},'compatibility'],devMode:false}});assert.equal(value.response.result.compatible,true);
});
