import {atomicFixtureControl} from './fixtures/read-authority/atomic-control.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {mkdtempSync,chmodSync,readFileSync,lstatSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {createAuthorityPreparationControl} from '../scripts/read-authority-preparation-control.mjs';
const mod=await import('../scripts/read-authority-trial-thin.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-trial-thin.mjs'))return {};throw e;});
const hash=v=>createHash('sha256').update(v).digest('hex'),canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v,checksum=v=>hash(JSON.stringify(canonical(v)));
const clock=Date.parse('2026-10-14T00:00:00Z'),scriptId='SYNTHETIC_THIN_SCRIPT_ID',libraryId='SYNTHETIC_LIBRARY_SCRIPT_ID',deploymentId='SYNTHETIC_THIN_DEPLOYMENT_ID',publisherHash=hash('publisher@example.invalid'),epochs=new Set();
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
test.after(()=>{for(const e of epochs){const base=join(homedir(),'.codex','private','cmwebs-authority-trials',checksum(e));for(const x of [base+'.thin.json',base+'.thin.json.stop',base+'.thin.json.publish-intent',base+'.preparation.json'])try{const s=lstatSync(x),v=JSON.parse(readFileSync(x)).value;if(s.isFile()&&!s.isSymbolicLink()&&v.path.startsWith(join(tmpdir(),'cmwebs-thin-')))unlinkSync(x);}catch(e){if(e.code!=='ENOENT')throw e;}}});
function setup(patch={},factory=mod.createAuthorityTrialThin){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-thin-'));chmodSync(dir,0o700);const epoch='SYNTHETIC_THIN_'+randomUUID(),calls=[],cleanups=[],originalFiles=[{name:'Code',type:'SERVER_JS',source:'\n'},{name:'appsscript',type:'JSON',source:'{"timeZone":"Asia/Taipei","runtimeVersion":"V8"}'}];let now=clock,spent=0,current,config,closed=false;
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{spent++;},cleanup:async(name,io)=>{cleanups.push(name);spent++;return io();}};
 const options={path:join(dir,'receipt.json'),epoch,scriptId,libraryId,libraryVersion:7,publisherHash,originalFiles,originalSourceHash:checksum([...originalFiles].sort((a,b)=>a.name.localeCompare(b.name))),expiresAt:clock+21600000,control,
  backupReceipt:{source:'fixed-trial-thin-empty-backup',epoch,scriptId,publisherHash,sourceHash:checksum([...originalFiles].sort((a,b)=>a.name.localeCompare(b.name)))},now:()=>now,
  credential:()=>({accessToken:'SYNTHETIC_TOKEN',accountHash:publisherHash,scopes,expiresAt:now+3600000,refreshTokenPresent:true}),
  fetcher:async(url,init)=>{calls.push({url,init});const u=new URL(url);if(init.method==='PUT'){current=JSON.parse(init.body).files;return new Response(JSON.stringify({scriptId,files:current}));}if(u.pathname.endsWith('/versions'))return new Response(JSON.stringify({scriptId,versionNumber:1,description:JSON.parse(init.body).description}));if(u.pathname.endsWith('/content'))return new Response(JSON.stringify({scriptId,files:current}));if(init.method==='DELETE'){closed=true;return new Response(null,{status:204});}if(init.method==='POST'){config={scriptId,...JSON.parse(init.body)};return new Response(JSON.stringify({deploymentId,deploymentConfig:config,entryPoints:[{entryPointType:'EXECUTION_API',executionApi:{entryPointConfig:{access:'ANYONE'}}}]}));}return new Response(JSON.stringify({deployments:closed?[]:[{deploymentId,deploymentConfig:config,entryPoints:[{entryPointType:'EXECUTION_API',executionApi:{entryPointConfig:{access:'ANYONE'}}}]}]}));},...patch};
 epochs.add(epoch);assert.equal(typeof factory,'function');options.control=atomicFixtureControl(options.control);const adapter=factory(options);return {options,adapter,calls,cleanups,spent:()=>spent,setNow:v=>{now=v;}};
}
const standaloneOptions=({libraryId,libraryVersion,...options})=>options;
function standaloneSetup(patch={}){
 assert.equal(typeof mod.createStandaloneAuthorityTrialPublication,'function');
 return setup(patch,options=>mod.createStandaloneAuthorityTrialPublication(standaloneOptions(options)));
}
test('standalone publication uses five charged operations and deploys no library dependency',async()=>{
 const s=standaloneSetup(),r=await s.adapter.publish();
 assert.equal(s.spent(),5);assert.equal(s.calls.length,5);
 const files=JSON.parse(s.calls[0].init.body).files,manifest=JSON.parse(files.find(f=>f.name==='appsscript').source);
 const source=files.find(f=>f.type==='SERVER_JS').source;
 assert.deepEqual(manifest.dependencies,{});assert.equal(r.sourceSha256,hash(source));
 assert.equal(r.deploymentVerified,true);assert.equal(r.trialAccepted,false);assert.equal(r.rollbackComplete,false);
 assert.deepEqual(s.calls.map(c=>c.init.method),['PUT','POST','GET','POST','GET']);
 await assert.rejects(s.adapter.publish(),/TRIAL_STOPPED/);assert.equal(s.calls.length,5);
});
test('standalone deployment keeps independent close and absence readback',async()=>{
 const s=standaloneSetup();await s.adapter.publish();await s.adapter.close();
 assert.equal((await s.adapter.verifyClosed()).deploymentAbsent,true);
 assert.deepEqual(s.cleanups,['close-deployment','verify-closed-deployment']);assert.equal(s.calls.length,7);
});
test('standalone refuses injected library binding before creating a publication journal',()=>{
 const s=setup();assert.throws(()=>mod.createStandaloneAuthorityTrialPublication(s.options),/TRIAL_STOPPED/);
 assert.equal(s.calls.length,0);assert.equal(s.spent(),0);
});
test('switching a prepared wrapper journal to standalone cannot reset its registration',()=>{
 const s=setup();assert.throws(()=>mod.createStandaloneAuthorityTrialPublication(standaloneOptions(s.options)),/TRIAL_STOPPED/);
 assert.equal(s.calls.length,0);assert.equal(s.spent(),0);
});
test('fixed wrapper publication spends five units and accepts only one immutable API entrypoint',async()=>{
 const s=setup(),r=await s.adapter.publish();assert.equal(s.spent(),5);assert.deepEqual(s.calls.map(c=>c.init.method),['PUT','POST','GET','POST','GET']);assert.equal(r.versionNumber,1);assert.equal(r.deploymentId,deploymentId);assert.equal(r.deploymentVerified,true);assert.equal(r.trialAccepted,false);assert.equal(r.rollbackComplete,false);
 const files=JSON.parse(s.calls[0].init.body).files,manifest=JSON.parse(files.find(f=>f.name==='appsscript').source);assert.deepEqual(manifest.dependencies.libraries,[{userSymbol:'AuthorityTrial',libraryId,version:'7',developmentMode:false}]);assert.deepEqual(manifest.executionApi,{access:'ANYONE'});assert.equal(files.filter(f=>f.type==='SERVER_JS').length,1);assert.equal(new URL(s.calls[2].url).searchParams.get('versionNumber'),'1');for(const c of s.calls){assert.equal(new URL(c.url).origin,'https://script.googleapis.com');assert.equal(c.init.redirect,'manual');assert(new URL(c.url).pathname.startsWith('/v1/projects/'+scriptId+'/'));}assert(!readFileSync(s.options.path,'utf8').includes('SYNTHETIC_TOKEN'));await assert.rejects(s.adapter.publish(),/TRIAL_STOPPED/);assert.equal(s.calls.length,5);
});
test('close and separate readback consume independent I actions and never claim full rollback',async()=>{const s=setup();await s.adapter.publish();const c=await s.adapter.close();assert.equal(c.closeAcknowledged,true);assert.equal(c.rollbackComplete,false);const v=await s.adapter.verifyClosed();assert.equal(v.deploymentAbsent,true);assert.equal(v.rollbackComplete,false);assert.equal(s.spent(),7);assert.deepEqual(s.cleanups,['close-deployment','verify-closed-deployment']);assert.equal(s.calls[5].init.method,'DELETE');assert.equal(new URL(s.calls[5].url).pathname,'/v1/projects/'+scriptId+'/deployments/'+deploymentId);await assert.rejects(s.adapter.close(),/TRIAL_STOPPED/);await assert.rejects(s.adapter.verifyClosed(),/TRIAL_STOPPED/);assert.equal(s.calls.length,7);});
test('lost create response is terminal and cannot be retried or guessed for deletion',async()=>{const s=setup();const base=s.options.fetcher;s.options.fetcher=async(url,init)=>{if(init.method==='POST'&&url.includes('/deployments')){s.calls.push({url,init});throw Error('LOST_CREATE');}return base(url,init);};const a=mod.createAuthorityTrialThin(s.options);await assert.rejects(a.publish(),/TRIAL_STOPPED/);assert.equal(s.calls.length,4);assert.equal(JSON.parse(readFileSync(s.options.path)).value.createOutcome,'UNKNOWN');await assert.rejects(a.close(),/TRIAL_STOPPED/);assert.equal(s.calls.length,4);const resumed=mod.createAuthorityTrialThin(s.options);await assert.rejects(resumed.publish(),/TRIAL_STOPPED/);assert.equal(s.calls.length,4);});
test('known new ID is retained for closing even when create reply has a web-app entrypoint',async()=>{const s=setup();const base=s.options.fetcher;s.options.fetcher=async(url,init)=>{const r=await base(url,init);if(init.method==='POST'&&url.includes('/deployments')){const v=await r.json();v.entryPoints=[{entryPointType:'WEB_APP',webApp:{url:'https://example.invalid',entryPointConfig:{access:'ANYONE'}}}];return new Response(JSON.stringify(v));}return r;};const a=mod.createAuthorityTrialThin(s.options);await assert.rejects(a.publish(),/TRIAL_STOPPED/);assert.equal(s.calls.length,4);const j=JSON.parse(readFileSync(s.options.path)).value;assert.equal(j.deploymentId,deploymentId);assert.equal(j.createOutcome,'UNKNOWN');await a.close();const v=await a.verifyClosed();assert.equal(v.deploymentAbsent,true);assert.equal(v.unknownCreatePreserved,true);assert.equal(v.rollbackComplete,false);});
test('extra or paginated deployment inventory rejects release without spending cleanup prematurely',async()=>{const s=setup();const base=s.options.fetcher;s.options.fetcher=async(url,init)=>{const r=await base(url,init);if(init.method==='GET'&&url.includes('/deployments'))return new Response(JSON.stringify({...(await r.json()),nextPageToken:'MORE'}));return r;};const a=mod.createAuthorityTrialThin(s.options);await assert.rejects(a.publish(),/TRIAL_STOPPED/);assert.equal(s.calls.length,5);assert.deepEqual(s.cleanups,[]);assert.equal(JSON.parse(readFileSync(s.options.path)).value.deploymentId,deploymentId);});
test('expiry at final create readback stops publication but valid cached credentials can close',async()=>{const s=setup();const base=s.options.fetcher;s.options.fetcher=async(url,init)=>{const r=await base(url,init);if(init.method==='POST'&&url.includes('/deployments'))s.setNow(clock+21600001);return r;};const a=mod.createAuthorityTrialThin(s.options);await assert.rejects(a.publish(),/TRIAL_STOPPED/);assert.equal(s.calls.length,4);await a.close();assert.equal((await a.verifyClosed()).deploymentAbsent,true);});
test('stopped source admission causes no Google write',async()=>{let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({control:{waitForExternalReadSlot:async()=>{enter();await new Promise(r=>{release=r;});},reserveExternalReads:async()=>assert.fail('DEBIT_AFTER_STOP'),cleanup:async()=>assert.fail('CLEANUP_BEFORE_CREATE')}});const p=s.adapter.publish();await entered;s.adapter.stop();release();await assert.rejects(p,/TRIAL_STOPPED/);assert.equal(s.calls.length,0);});
test('fixed version drift does not create a deployment',async()=>{const s=setup();const base=s.options.fetcher;s.options.fetcher=async(url,init)=>url.includes('/versions')?(s.calls.push({url,init}),new Response(JSON.stringify({scriptId,versionNumber:2,description:'WRONG'}))):base(url,init);await assert.rejects(mod.createAuthorityTrialThin(s.options).publish(),/TRIAL_STOPPED/);assert.equal(s.calls.length,2);});
test('alternate path or changed library binding cannot reseed the same epoch',async()=>{const s=setup();await s.adapter.publish();assert.throws(()=>mod.createAuthorityTrialThin({...s.options,path:join(tmpdir(),'alternate-thin.json')}),/TRIAL_STOPPED/);assert.throws(()=>mod.createAuthorityTrialThin({...s.options,libraryVersion:8}),/TRIAL_STOPPED/);assert.equal(s.calls.length,5);});
for(const [name,credential] of [['wrong actor',()=>({accessToken:'SYNTHETIC',accountHash:'a'.repeat(64),scopes,expiresAt:clock+3600000,refreshTokenPresent:true})],['expanded scopes',()=>({accessToken:'SYNTHETIC',accountHash:publisherHash,scopes:[...scopes,'https://www.googleapis.com/auth/drive'],expiresAt:clock+3600000,refreshTokenPresent:true})],['async getter',()=>Promise.resolve({accessToken:'SYNTHETIC',accountHash:publisherHash,scopes,expiresAt:clock+3600000,refreshTokenPresent:true})]])test('publisher '+name+' refuses before debit and source write',async()=>{const s=setup({credential});await assert.rejects(s.adapter.publish(),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);assert.equal(s.spent(),0);});
test('nonempty original project refuses before any source overwrite',()=>{assert.equal(typeof mod.createAuthorityTrialThin,'function');const s=setup();const files=[{name:'Code',type:'SERVER_JS',source:'function existing(){return true;}'},{name:'appsscript',type:'JSON',source:'{}'}];assert.throws(()=>mod.createAuthorityTrialThin({...s.options,originalFiles:files,originalSourceHash:checksum(files)}),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);});
test('original library and thin project cannot be the same target',()=>{const s=setup();assert.throws(()=>mod.createAuthorityTrialThin({...s.options,scriptId:libraryId}),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);});
test('unknown DELETE remains unknown even after independent absence readback',async()=>{const s=setup();await s.adapter.publish();s.options.fetcher=async(url,init)=>{s.calls.push({url,init});if(init.method==='DELETE')throw Error('UNKNOWN_DELETE');return new Response(JSON.stringify({}));};const a=mod.createAuthorityTrialThin(s.options);await assert.rejects(a.close(),/TRIAL_STOPPED/);const v=await a.verifyClosed();assert.equal(v.deploymentAbsent,true);assert.equal(v.unknownClosePreserved,true);assert.equal(v.rollbackComplete,false);assert.equal(JSON.parse(readFileSync(s.options.path)).value.closeOutcome,'UNKNOWN');});
test('private receipt write failure after known create ID cannot erase the independent close target',async()=>{
 const s=setup(),rename=fs.renameSync;let injected=false;
 fs.renameSync=(from,to)=>{if(to===s.options.path&&!injected&&JSON.parse(readFileSync(from)).value.deploymentId===deploymentId){injected=true;throw Error('PRIVATE_RECEIPT_FAILURE');}return rename(from,to);};syncBuiltinESMExports();
 try{await assert.rejects(s.adapter.publish(),/TRIAL_STOPPED/);assert.equal(injected,true);assert.equal(JSON.parse(readFileSync(s.options.path)).value.deploymentId,null);await s.adapter.close().catch(()=>{});assert.equal(s.calls.at(-1).init.method,'DELETE');assert.equal(new URL(s.calls.at(-1).url).pathname,'/v1/projects/'+scriptId+'/deployments/'+deploymentId);}finally{fs.renameSync=rename;syncBuiltinESMExports();}
});
test('denied close admission retains readback action until actual DELETE callback entry',async()=>{
 let denied=true;const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},cleanup:async(name,io)=>{if(name==='close-deployment'&&denied)throw Error('PRE_ADMISSION_DENIED');s.cleanups.push(name);return io();}}});await s.adapter.publish();await assert.rejects(s.adapter.close(),/TRIAL_STOPPED/);await assert.rejects(s.adapter.verifyClosed(),/TRIAL_STOPPED/);assert.deepEqual(s.cleanups,[]);assert.equal(s.calls.length,5);denied=false;await s.adapter.close();await s.adapter.verifyClosed();assert.deepEqual(s.cleanups,['close-deployment','verify-closed-deployment']);assert.equal(s.calls.length,7);
});
test('restoring the ready receipt cannot repeat publication in the same epoch',async()=>{const s=setup(),ready=readFileSync(s.options.path);await s.adapter.publish();writeFileSync(s.options.path,ready);let admitted=false;try{const a=mod.createAuthorityTrialThin(s.options);await a.publish();admitted=true;}catch(e){assert.match(e.message,/TRIAL_STOPPED/);}assert.equal(admitted,false);assert.equal(s.calls.length,5);});
test('a stale adapter refreshes the committed close target before independent cleanup',async()=>{const s=setup(),fresh=mod.createAuthorityTrialThin(s.options);await fresh.publish();await s.adapter.close();assert.equal((await s.adapter.verifyClosed()).deploymentAbsent,true);assert.equal(s.calls.length,7);});
test('another executable still present rejects absence proof after a lost delete',async()=>{const s=setup();await s.adapter.publish();const base=s.options.fetcher;s.options.fetcher=async(url,init)=>{if(init.method==='DELETE'){s.calls.push({url,init});throw Error('LOST_DELETE');}return base(url,init);};const a=mod.createAuthorityTrialThin(s.options);await assert.rejects(a.close(),/TRIAL_STOPPED/);await assert.rejects(a.verifyClosed(),/TRIAL_STOPPED/);assert.equal(JSON.parse(readFileSync(s.options.path)).value.verifyOutcome,'UNKNOWN');assert.equal(s.calls.length,7);});
function ledger(s){const path=join(s.options.path,'..','budget.json'),raw=JSON.stringify({limit:160,spent:25,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40});writeFileSync(path,raw,{mode:0o600});writeFileSync(path+'.lock','',{mode:0o600});return {path,control:createAuthorityPreparationControl({path,epoch:s.options.epoch,approvalHash:'a'.repeat(64),proposalHash:'b'.repeat(64),legacySha256:hash(raw),importedReads:25,expiresAt:s.options.expiresAt,now:s.options.now,pause:async ms=>s.setNow(s.options.now()+ms)})};}
test('real preparation flock ledger charges five publication plus two cleanup units and preserves C reserve',async()=>{const s=setup(),l=ledger(s);await l.control.withPreparation(async control=>{const a=mod.createAuthorityTrialThin({...s.options,control});assert.equal((await a.publish()).trialAccepted,false);await a.close();assert.equal((await a.verifyClosed()).rollbackComplete,false);});const b=JSON.parse(readFileSync(l.path));assert.equal(b.spent,32);assert.equal(b.preparation.importedReads,25);assert.deepEqual(b.preparation.cActions,[]);assert.deepEqual(b.preparation.iActions,['close-deployment','verify-closed-deployment']);assert.equal(b.preparation.state,'stopped');assert.equal(s.calls.length,7);});
test('real preparation ledger retains unknown malformed create while both cleanup units remain independently usable',async()=>{const s=setup(),l=ledger(s),base=s.options.fetcher;s.options.fetcher=async(url,init)=>{const r=await base(url,init);if(init.method==='POST'&&url.includes('/deployments')){const v=await r.json();v.entryPoints=[];return new Response(JSON.stringify(v));}return r;};await assert.rejects(l.control.withPreparation(async control=>{const a=mod.createAuthorityTrialThin({...s.options,control});await assert.rejects(a.publish(),/TRIAL_STOPPED/);await a.close();assert.equal((await a.verifyClosed()).unknownCreatePreserved,true);throw Error('TRIAL_STOPPED');}),/TRIAL_STOPPED/);const b=JSON.parse(readFileSync(l.path));assert.equal(b.spent,31);assert.deepEqual(b.preparation.cActions,[]);assert.deepEqual(b.preparation.iActions,['close-deployment','verify-closed-deployment']);assert.equal(b.preparation.state,'stopped');assert.equal(s.calls.length,6);assert.equal(JSON.parse(readFileSync(s.options.path)).value.createOutcome,'UNKNOWN');});
test('two close receipt failures cannot erase admitted DELETE or suppress independent readback',async()=>{
 const s=setup();await s.adapter.publish();const rename=fs.renameSync;let faults=0;
 fs.renameSync=(from,to)=>{if(to===s.options.path&&faults<2&&JSON.parse(readFileSync(from)).value.closeAttempted){faults++;throw Error('CLOSE_RECEIPT_FAILURE');}return rename(from,to);};syncBuiltinESMExports();
 try{await assert.rejects(s.adapter.close(),/TRIAL_STOPPED/);assert.equal(faults,2);assert.equal(s.calls.at(-1).init.method,'DELETE');assert.equal(JSON.parse(readFileSync(s.options.path)).value.closeAttempted,false);}finally{fs.renameSync=rename;syncBuiltinESMExports();}
 await s.adapter.verifyClosed().catch(e=>assert.match(e.message,/TRIAL_STOPPED/));assert.deepEqual(s.cleanups,['close-deployment','verify-closed-deployment']);assert.equal(s.calls.length,7);assert.equal(s.calls.at(-1).init.method,'GET');
});

test('ordinary thin IO enters the pinned atomic capability',async()=>{
 let entered=0;const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},externalRead:async io=>{entered++;return await io();},cleanup:async(name,io)=>io()}});
 await s.adapter.publish();assert.equal(entered,5);
});

test('missing atomic capability denies thin before IO',()=>{
 const s=setup();assert.throws(()=>mod.createAuthorityTrialThin({...s.options,control:{...s.options.control,externalRead:undefined}}),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.length,0);assert.equal(s.spent(),0);
});

for(const kind of ['oversized','rejected-status']) test('thin '+kind+' body cancellation remains owned until settled',async()=>{
 let owned=false,cancelStarted=false,cancelSettled=false,release;const gate=new Promise(r=>{release=r;});
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},cleanup:async()=>{},restoreOriginalEditor:async()=>{},externalRead:async io=>{owned=true;try{return await io();}finally{owned=false;}}};
 const fetcher=async()=>new Response(new ReadableStream({start(c){if(kind==='oversized')c.enqueue(new Uint8Array(400000+1));},cancel(){cancelStarted=true;return gate.then(()=>{cancelSettled=true;});}}),{status:kind==='rejected-status'?503:200});
 const s=setup({control,fetcher});
 const pending=s.adapter.publish();void pending.catch(()=>{});await new Promise(r=>setImmediate(r));
 try{assert.equal(cancelStarted,true);assert.equal(cancelSettled,false);assert.equal(owned,true);}finally{release();await assert.rejects(pending,/TRIAL_STOPPED/);}
 assert.equal(owned,false);assert.equal(cancelSettled,true);
});

// Task100: losing dispatch, ownership, or cleanup-entry truth would select a wrong I alias.
for(const [profile,make] of [['wrapper',setup],['standalone',standaloneSetup]])test('cleanup disposition '+profile+' keeps stopped ownership and detached no-IO snapshots',async()=>{
 const s=make(),initial=s.adapter.cleanupDisposition(),before=readFileSync(s.options.path,'utf8');
 assert.equal(initial.resourceDisposition,'not-dispatched');assert.equal(initial.createAttempted,false);assert.equal(initial.inFlight,false);
 assert(Object.isFrozen(initial));assert(Object.isFrozen(initial.actions));assert(Object.isFrozen(initial.actions.close));
 assert.throws(()=>{initial.actions.close.consumed=true;},TypeError);
 assert.throws(()=>s.adapter.cleanupDisposition({}),/TRIAL_STOPPED/);
 assert.equal(readFileSync(s.options.path,'utf8'),before);assert.equal(s.calls.length,0);assert.equal(s.spent(),0);
 await s.adapter.publish();s.adapter.stop();assert.equal(s.adapter.status(),'stopped');
 const owned=s.adapter.cleanupDisposition();assert.equal(owned.resourceDisposition,'attempted-known');assert.equal(owned.createOutcome,'ACK_MATCHED');
 for(const privateValue of [deploymentId,scriptId,publisherHash,s.options.path,'SYNTHETIC_TOKEN'])assert(!JSON.stringify(owned).includes(privateValue));
 await s.adapter.close();await s.adapter.verifyClosed();const done=s.adapter.cleanupDisposition();
 assert.deepEqual([done.actions.close.entered,done.actions.close.consumed,done.actions.close.result,done.actions.verify.outcome],[true,true,'returned','ABSENT_AT_READBACK']);
 assert.equal(initial.resourceDisposition,'not-dispatched');assert.equal(owned.actions.close.consumed,false);assert.equal(s.spent(),7);assert.equal(s.calls.length,7);
});
test('cleanup disposition distinguishes unknown create, never adopts inventory IDs and preserves settled close failure',async()=>{
 const s=setup(),base=s.options.fetcher;s.options.fetcher=async(url,init)=>{if(init.method==='POST'&&url.includes('/deployments')){s.calls.push({url,init});throw Error('LOST_CREATE');}return base(url,init);};
 const a=mod.createAuthorityTrialThin(s.options);await assert.rejects(a.publish(),/TRIAL_STOPPED/);assert.equal(a.cleanupDisposition().resourceDisposition,'attempted-unknown');
 await assert.rejects(a.close(),/TRIAL_STOPPED/);assert.equal(a.cleanupDisposition().actions.close.entered,false);
 await assert.rejects(a.verifyClosed(),/TRIAL_STOPPED/);const d=a.cleanupDisposition();assert.equal(d.resourceDisposition,'attempted-unknown');assert.equal(d.actions.verify.consumed,true);assert.equal(d.actions.verify.result,'rejected');assert.equal(d.integrity,'locally-uncontested');
});
test('cleanup disposition separates pending admission denial from entered DELETE failure and local journal damage',async()=>{
 let release,enter;const gate=new Promise(r=>release=r),entered=new Promise(r=>enter=r);let deny=true;
 const s=setup({control:{externalRead:async io=>io(),cleanup:async(name,io)=>{if(deny){enter();await gate;throw Error('DENIED');}return io();}}});await s.adapter.publish();
 const pending=s.adapter.close();await entered;const waiting=s.adapter.cleanupDisposition();assert.equal(waiting.inFlight,true);assert.equal(waiting.actions.close.pending,true);assert.equal(waiting.actions.close.entered,false);release();await assert.rejects(pending,/TRIAL_STOPPED/);
 const denied=s.adapter.cleanupDisposition();assert.equal(denied.actions.close.requested,true);assert.equal(denied.actions.close.consumed,false);assert.equal(denied.actions.close.result,'rejected');
 deny=false;chmodSync(join(s.options.path,'..'),0o755);try{await assert.rejects(s.adapter.close(),/TRIAL_STOPPED/);const d=s.adapter.cleanupDisposition();assert.equal(d.integrity,'compromised');assert.equal(d.actions.close.entered,true);assert.equal(d.actions.close.consumed,true);}finally{chmodSync(join(s.options.path,'..'),0o700);}
 assert.equal(waiting.actions.close.entered,false);assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});

test('cleanup disposition keeps detached cleanup callback pending after outer admission returns',async()=>{
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);let callback;
 const s=setup({control:{externalRead:async io=>io(),cleanup:async(name,io)=>{callback=io();void callback.catch(()=>{});return;}}}),base=s.options.fetcher;
 s.options.fetcher=async(url,init)=>{if(init.method==='DELETE'){enter();await gate;}return base(url,init);};const a=mod.createAuthorityTrialThin(s.options);await a.publish();
 const p=a.close();await entered;await p;const d=a.cleanupDisposition();try{assert.equal(d.inFlight,true);assert.equal(d.actions.close.callbackPending,true);assert.equal(d.integrity,'compromised');}finally{release();await callback;}
 assert.equal(a.cleanupDisposition().actions.close.callbackResult,'returned');assert.equal(a.cleanupDisposition().integrity,'compromised');
});
test('cleanup disposition invokes no filesystem clock credential or capability callbacks',()=>{
 let observing=false;const forbid=()=>{if(observing)assert.fail('OBSERVER_SIDE_EFFECT');};const s=setup({now:()=>{forbid();return clock;},credential:()=>{forbid();throw Error('NOT_USED');},control:{externalRead:async()=>{forbid();},cleanup:async()=>{forbid();}}});
 const saved={};for(const name of ['lstatSync','readFileSync','openSync','writeSync','renameSync','fsyncSync']){saved[name]=fs[name];fs[name]=()=>assert.fail('OBSERVER_FILESYSTEM_IO');}syncBuiltinESMExports();observing=true;
 try{const a=s.adapter.cleanupDisposition(),b=s.adapter.cleanupDisposition();assert.deepEqual(a,b);assert.notEqual(a,b);assert.notEqual(a.actions,b.actions);assert.notEqual(a.actions.close,b.actions.close);}finally{observing=false;Object.assign(fs,saved);syncBuiltinESMExports();}
});

test('cleanup disposition never rewinds an UNKNOWN create after a checksum-valid stale journal',async()=>{
 const s=setup(),base=s.options.fetcher;s.options.fetcher=async(url,init)=>{if(init.method==='POST'&&url.includes('/deployments'))throw Error('LOST_CREATE');return base(url,init);};const a=mod.createAuthorityTrialThin(s.options);await assert.rejects(a.publish(),/TRIAL_STOPPED/);
 const envelope=JSON.parse(readFileSync(s.options.path));envelope.value.createAttempted=false;envelope.value.createOutcome='NOT_SENT';envelope.sha256=checksum(envelope.value);writeFileSync(s.options.path,JSON.stringify(envelope));
 await assert.rejects(a.verifyClosed(),/TRIAL_STOPPED/);const d=a.cleanupDisposition();assert.equal(d.integrity,'compromised');assert.equal(d.createAttempted,true);assert.equal(d.resourceDisposition,'attempted-unknown');
});

test('cleanup disposition retains integrity failure discovered by ordinary stopped-status read',()=>{
 const s=setup(),other=mod.createAuthorityTrialThin(s.options);s.adapter.stop();const p=join(homedir(),'.codex','private','cmwebs-authority-trials',checksum(s.options.epoch)+'.thin.json.stop');chmodSync(p,0o644);
 try{assert.throws(()=>other.status(),/TRIAL_STOPPED/);assert.equal(other.cleanupDisposition().integrity,'compromised');}finally{chmodSync(p,0o600);}
});

for(const [profile,make] of [['wrapper',setup],['standalone',standaloneSetup]])test('cleanup disposition first-late '+profile+' callback stays compromised after successful outer close',async()=>{
 let saved;const s=make({control:{externalRead:async io=>io(),cleanup:async(name,io)=>{assert.equal(name,'close-deployment');saved=io;}}});await s.adapter.publish();
 assert.deepEqual(await s.adapter.close(),{closeAcknowledged:true,rollbackComplete:false});const before=s.adapter.cleanupDisposition();
 assert.equal(before.inFlight,false);assert.equal(before.actions.close.entered,false);assert.equal(before.actions.close.consumed,false);assert.equal(s.calls.length,5);
 await saved();const after=s.adapter.cleanupDisposition();assert.equal(s.calls.length,6);assert.equal(s.calls.at(-1).init.method,'DELETE');
 assert.equal(after.actions.close.callbackResult,'returned');assert.equal(after.actions.close.consumed,true);assert.equal(after.inFlight,false);assert.equal(after.integrity,'compromised');
 assert.equal(s.adapter.cleanupDisposition().integrity,'compromised');assert.equal(before.actions.close.entered,false);
});
