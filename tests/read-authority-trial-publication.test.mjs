import {atomicFixtureControl} from './fixtures/read-authority/atomic-control.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mkdtempSync,chmodSync,readFileSync,lstatSync,unlinkSync} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {buildAuthorityTrialArtifacts} from '../scripts/build-read-authority-trial-entry.mjs';
const mod=await import('../scripts/read-authority-trial-publication.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-trial-publication.mjs'))return {};throw e;});
const hash=v=>createHash('sha256').update(v).digest('hex'),checksum=v=>hash(JSON.stringify(canonical(v))),clock=Date.parse('2026-10-14T00:00:00Z'),scriptId='SYNTHETIC_ORIGINAL_SCRIPT_ID',publisherHash=hash('publisher@example.invalid');
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s),epochs=new Set();
function canonical(v){return Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;}
const original=()=>Array.from({length:10},(_,n)=>({name:n===0?'appsscript':'Original'+n,type:n===0?'JSON':'SERVER_JS',source:n===0?'{"timeZone":"Asia/Taipei","runtimeVersion":"V8"}':'// SYNTHETIC ORIGINAL '+n+'\n'}));
const pin=files=>checksum([...files].sort((a,b)=>a.name.localeCompare(b.name)));
const bundle=buildAuthorityTrialArtifacts({libraryId:scriptId,version:1}),library=[{name:'AuthorityTrial',type:'SERVER_JS',source:bundle.librarySource},{name:'appsscript',type:'JSON',source:JSON.stringify(bundle.libraryManifest)}];
const baselineVersions=()=>Array.from({length:6},(_,i)=>({scriptId,versionNumber:i+1})),baselineDeployments=()=>[{deploymentId:'SYNTHETIC_SERVING_DEPLOYMENT',deploymentConfig:{scriptId,versionNumber:1,manifestFileName:'appsscript'}}];
test.after(()=>{for(const epoch of epochs){const p=join(homedir(),'.codex','private','cmwebs-authority-trials',checksum(epoch)+'.publication.json');for(const x of [p,p+'.stop'])try{const s=lstatSync(x),v=JSON.parse(readFileSync(x)).value;if(s.isFile()&&!s.isSymbolicLink()&&v.path.startsWith(join(tmpdir(),'cmwebs-publication-')))unlinkSync(x);}catch(e){if(e.code!=='ENOENT')throw e;}}});
function setup(patch={}){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-publication-'));chmodSync(dir,0o700);const epoch='SYNTHETIC_PUBLICATION_'+randomUUID(),calls=[],restores=[],files=original(),sourceHash=pin(files),versions=baselineVersions(),deployments=baselineDeployments();let now=clock,spent=0,current=files,version=null;
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{spent++;},restoreOriginalEditor:async(action,io)=>{restores.push(action);spent++;return io();}};
 const options={path:join(dir,'receipt.json'),epoch,scriptId,publisherHash,originalFiles:files,originalSourceHash:sourceHash,baselineVersions:versions,baselineDeployments:deployments,expiresAt:clock+21600000,
  backupReceipt:{source:'fixed-trial-original-editor-backup',epoch,scriptId,publisherHash,sourceHash,versionsHash:checksum(versions),deploymentsHash:checksum(deployments)},control,now:()=>now,
  credential:()=>({accessToken:'SYNTHETIC_MANAGEMENT_TOKEN',accountHash:publisherHash,scopes,expiresAt:now+3600000,refreshTokenPresent:true}),
  fetcher:async(url,init)=>{calls.push({url,init});const u=new URL(url);if(init.method==='PUT'){current=JSON.parse(init.body).files;return new Response(JSON.stringify({scriptId,files:current}));}if(init.method==='POST'){version={scriptId,versionNumber:7,description:JSON.parse(init.body).description};return new Response(JSON.stringify(version));}if(u.pathname.endsWith('/content'))return new Response(JSON.stringify({scriptId,files:u.searchParams.has('versionNumber')?library:current}));if(u.pathname.endsWith('/versions'))return new Response(JSON.stringify({versions:[...versions,version]}));return new Response(JSON.stringify({deployments}));},...patch};
 epochs.add(epoch);assert.equal(typeof mod.createAuthorityTrialPublication,'function');options.control=atomicFixtureControl(options.control);const adapter=mod.createAuthorityTrialPublication(options);
 return {options,adapter,calls,restores,spent:()=>spent,setNow:v=>{now=v;},setCurrent:v=>{current=v;}};
}
test('fixed immutable library version then exact ten-file restore and inventory readback uses seven IO',async()=>{
 const s=setup(),r=await s.adapter.publishAndRestore();assert.equal(r.libraryVersion,7);assert.equal(r.librarySha256,bundle.librarySha256);assert.equal(r.editorRestoredAtReadback,true);assert.equal(r.publicationAccepted,false);assert.equal(r.rollbackComplete,false);assert.equal(s.spent(),7);assert.deepEqual(s.restores,['restore-editor','read-restored-editor']);assert.deepEqual(s.calls.map(c=>c.init.method),['PUT','POST','GET','PUT','GET','GET','GET']);
 assert.deepEqual(JSON.parse(s.calls[0].init.body),{files:library});assert.deepEqual(JSON.parse(s.calls[3].init.body),{files:original()});assert.equal(new URL(s.calls[2].url).searchParams.get('versionNumber'),'7');for(const c of s.calls){assert.equal(new URL(c.url).origin,'https://script.googleapis.com');assert.equal(c.init.redirect,'manual');assert(new URL(c.url).pathname.startsWith('/v1/projects/'+scriptId+'/'));}assert(!readFileSync(s.options.path,'utf8').includes('SYNTHETIC_MANAGEMENT_TOKEN'));assert(!readFileSync(s.options.path,'utf8').includes('SYNTHETIC ORIGINAL'));await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);assert.equal(s.calls.length,7);
});
test('lost staging reply invokes independent restore, preserves unknown and never creates version or repeats stage',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(s.calls.length===1)throw Error('SYNTHETIC_LOST_REPLY');return new Response(JSON.stringify({scriptId,files:original()}));}});await assert.rejects(s.adapter.publishAndRestore(),/^Error: TRIAL_STOPPED$/);assert.deepEqual(s.calls.map(c=>c.init.method),['PUT','PUT','GET']);assert.deepEqual(s.restores,['restore-editor','read-restored-editor']);const j=JSON.parse(readFileSync(s.options.path)).value;assert.equal(j.stageOutcome,'UNKNOWN');assert.equal(j.editorRestoredAtReadback,true);const resumed=mod.createAuthorityTrialPublication(s.options);await assert.rejects(resumed.publishAndRestore(),/TRIAL_STOPPED/);assert.equal(s.calls.length,3);
});
test('unknown version result restores without guessing version or reading extra inventories',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST')throw Error('SYNTHETIC_UNKNOWN_VERSION');return new Response(JSON.stringify({scriptId,files:s.calls.length===1?library:original()}));}});await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);assert.equal(s.calls.filter(c=>c.init.method==='POST').length,1);const j=JSON.parse(readFileSync(s.options.path)).value;assert.equal(j.versionOutcome,'UNKNOWN');assert.equal(j.editorRestoredAtReadback,true);
});
test('stop during staging admission prevents source writes',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({control:{waitForExternalReadSlot:async()=>{enter();await new Promise(r=>{release=r;});},reserveExternalReads:async()=>{},restoreOriginalEditor:async()=>assert.fail('NO_RESTORE_BEFORE_STAGE')}});const p=s.adapter.publishAndRestore();await entered;s.adapter.stop();release();await assert.rejects(p,/TRIAL_STOPPED/);assert.equal(s.calls.length,0);
});
test('expiry after known staging cannot suppress independently reserved exact restore',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(s.calls.length===1){s.setNow(clock+21600001);return new Response(JSON.stringify({scriptId,files:library}));}return new Response(JSON.stringify({scriptId,files:original()}));}});await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);assert.deepEqual(s.restores,['restore-editor','read-restored-editor']);assert.deepEqual(s.calls.map(c=>c.init.method),['PUT','PUT','GET']);assert.equal(JSON.parse(readFileSync(s.options.path)).value.editorRestoredAtReadback,true);
});
test('receipt fault after dispatched stage cannot suppress known backup restore',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(s.calls.length===1){chmodSync(join(s.options.path,'..'),0o755);return new Response(JSON.stringify({scriptId,files:library}));}return new Response(JSON.stringify({scriptId,files:original()}));}});try{await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);assert.deepEqual(s.calls.map(c=>c.init.method),['PUT','PUT','GET']);}finally{chmodSync(join(s.options.path,'..'),0o700);}
});
test('stale instance does not overwrite another completed source lifecycle',async()=>{const s=setup(),other=mod.createAuthorityTrialPublication(s.options);await s.adapter.publishAndRestore();await assert.rejects(other.publishAndRestore(),/TRIAL_STOPPED/);assert.equal(JSON.parse(readFileSync(s.options.path)).value.editorRestoredAtReadback,true);assert.equal(s.calls.length,7);});
for(const [name,patch] of [['wrong backup hash',{originalSourceHash:'a'.repeat(64)}],['unknown URL',{url:'https://other.invalid'}],['missing restore capability',{control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{}}}],['wrong inventory',{baselineVersions:[]}],['unsafe original file count',{originalFiles:original().slice(1)}]])test('configuration '+name+' rejects before IO',()=>{assert.throws(()=>setup(patch),/TRIAL_STOPPED/);});
test('restore readback byte mismatch does not claim restored editor or acceptance',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST')return new Response(JSON.stringify({scriptId,versionNumber:7,description:JSON.parse(init.body).description}));return new Response(JSON.stringify({scriptId,files:s.calls.length<4?library:original().map((f,i)=>i===1?{...f,source:f.source+'changed'}:f)}));}});await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);assert.equal(JSON.parse(readFileSync(s.options.path)).value.editorRestoredAtReadback,false);
});
test('changed serving deployment refuses final publication receipt even after restored editor',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});const u=new URL(url);if(init.method==='POST')return new Response(JSON.stringify({scriptId,versionNumber:7,description:JSON.parse(init.body).description}));if(u.pathname.endsWith('/versions'))return new Response(JSON.stringify({versions:[...baselineVersions(),{scriptId,versionNumber:7,description:'CMWebs C3 trial '+hash(s.options.epoch).slice(0,16)}]}));if(u.pathname.endsWith('/deployments'))return new Response(JSON.stringify({deployments:[{...baselineDeployments()[0],deploymentConfig:{scriptId,versionNumber:7,manifestFileName:'appsscript'}}]}));return new Response(JSON.stringify({scriptId,files:s.calls.length<4?library:original()}));}});await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);assert.equal(JSON.parse(readFileSync(s.options.path)).value.editorRestoredAtReadback,true);
});
test('restart after cleanup admission failure can independently restore without replaying stage',async()=>{
 let denied=true;const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},restoreOriginalEditor:async(action,io)=>{if(denied)throw Error('SYNTHETIC_PRE_DEBIT_FAILURE');s.restores.push(action);return io();}},fetcher:async(url,init)=>{s.calls.push({url,init});if(s.calls.length===1)throw Error('SYNTHETIC_UNKNOWN_STAGE');return new Response(JSON.stringify({scriptId,files:original()}));}});
 await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);denied=false;const resumed=mod.createAuthorityTrialPublication(s.options);const r=await resumed.restore();assert.equal(r.editorRestoredAtReadback,true);assert.equal(r.rollbackComplete,false);assert.deepEqual(s.calls.map(c=>c.init.method),['PUT','PUT','GET']);await assert.rejects(resumed.publishAndRestore(),/TRIAL_STOPPED/);
});
test('failed stop persistence cannot suppress known-target restore after restart',async()=>{
 let denied=true;const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},restoreOriginalEditor:async(action,io)=>{if(denied)throw Error('SYNTHETIC_ADMISSION');s.restores.push(action);return io();}},fetcher:async(url,init)=>{s.calls.push({url,init});if(s.calls.length===1)throw Error('SYNTHETIC_UNKNOWN_STAGE');return new Response(JSON.stringify({scriptId,files:original()}));}});await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);denied=false;
 const resumed=mod.createAuthorityTrialPublication(s.options),target=join(homedir(),'.codex','private','cmwebs-authority-trials',checksum(s.options.epoch)+'.publication.json.stop'),open=fs.openSync;
 try{fs.openSync=function(p,...args){if(p===target){const e=Error('SYNTHETIC_STOP_IO');e.code='EIO';throw e;}return open(p,...args);};syncBuiltinESMExports();await assert.rejects(resumed.restore(),/TRIAL_STOPPED/);assert.deepEqual(s.calls.map(c=>c.init.method),['PUT','PUT','GET']);}finally{fs.openSync=open;syncBuiltinESMExports();}
});
test('unknown restore reply still consumes independent readback without settling the write',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(s.calls.length===1)throw Error('SYNTHETIC_UNKNOWN_STAGE');if(init.method==='PUT')throw Error('SYNTHETIC_UNKNOWN_RESTORE');return new Response(JSON.stringify({scriptId,files:original()}));}});await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);assert.deepEqual(s.calls.map(c=>c.init.method),['PUT','PUT','GET']);const j=JSON.parse(readFileSync(s.options.path)).value;assert.equal(j.restoreOutcome,'UNKNOWN');assert.equal(j.editorRestoredAtReadback,true);
});
for(const [name,credential] of [['wrong actor',()=>({accessToken:'SYNTHETIC',accountHash:'a'.repeat(64),scopes,expiresAt:clock+3600000,refreshTokenPresent:true})],['scope expansion',()=>({accessToken:'SYNTHETIC',accountHash:publisherHash,scopes:[...scopes,'https://www.googleapis.com/auth/drive'],expiresAt:clock+3600000,refreshTokenPresent:true})],['async getter',()=>Promise.resolve({accessToken:'SYNTHETIC',accountHash:publisherHash,scopes,expiresAt:clock+3600000,refreshTokenPresent:true})]])test('publication publisher '+name+' rejects before stage or independent restore',async()=>{const s=setup({credential});await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);assert.equal(s.spent(),0);assert.deepEqual(s.restores,[]);});
test('alternate journal path cannot reset a completed epoch',async()=>{const s=setup();await s.adapter.publishAndRestore();assert.throws(()=>mod.createAuthorityTrialPublication({...s.options,path:join(tmpdir(),'alternate-publication.json')}),/TRIAL_STOPPED/);assert.equal(s.calls.length,7);});
test('readback unit is retained when restore PUT admission fails and restart can verify restoration',async()=>{
 let denied=true,current=library;const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},restoreOriginalEditor:async(action,io)=>{if(action==='restore-editor'&&denied)throw Error('SYNTHETIC_PRE_ADMISSION');s.restores.push(action);return io();}},fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST')throw Error('SYNTHETIC_LOST_VERSION');if(init.method==='PUT')current=JSON.parse(init.body).files;return new Response(JSON.stringify({scriptId,files:current}));}});await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);assert.equal(s.calls.length,2);assert.deepEqual(s.restores,[]);assert.equal(JSON.parse(readFileSync(s.options.path)).value.restoreReadAttempted,false);
 denied=false;const resumed=mod.createAuthorityTrialPublication(s.options);assert.equal((await resumed.restore()).editorRestoredAtReadback,true);assert.deepEqual(s.calls.map(c=>c.init.method),['PUT','POST','PUT','GET']);assert.deepEqual(s.restores,['restore-editor','read-restored-editor']);
});
test('API object field ordering cannot change exact source, versions or deployment comparison',async()=>{
 const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reorder(x)])):v;let current=original(),created;
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});const u=new URL(url);let v;if(init.method==='PUT'){current=JSON.parse(init.body).files;v={scriptId,files:current};}else if(init.method==='POST'){created={scriptId,versionNumber:7,description:JSON.parse(init.body).description};v=created;}else if(u.pathname.endsWith('/content'))v={scriptId,files:u.searchParams.has('versionNumber')?library:current};else if(u.pathname.endsWith('/versions'))v={versions:[...baselineVersions(),created]};else v={deployments:baselineDeployments()};return new Response(JSON.stringify(reorder(v)));}});
 const r=await s.adapter.publishAndRestore();assert.equal(r.libraryVersion,7);assert.equal(r.editorRestoredAtReadback,true);assert.equal(r.publicationAccepted,false);assert.equal(s.calls.length,7);
});

test('ordinary publication IO enters the pinned atomic capability',async()=>{
 let entered=0;const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},externalRead:async io=>{entered++;return await io();},restoreOriginalEditor:async(name,io)=>io()}});
 await s.adapter.publishAndRestore();assert.equal(entered,5);
});

test('missing atomic capability denies publication before IO',()=>{
 const s=setup();assert.throws(()=>mod.createAuthorityTrialPublication({...s.options,control:{...s.options.control,externalRead:undefined}}),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.length,0);assert.equal(s.spent(),0);
});

for(const kind of ['oversized','rejected-status']) test('publication '+kind+' body cancellation remains owned until settled',async()=>{
 let owned=false,cancelStarted=false,cancelSettled=false,release;const gate=new Promise(r=>{release=r;});
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},cleanup:async()=>{},restoreOriginalEditor:async()=>{},externalRead:async io=>{owned=true;try{return await io();}finally{owned=false;}}};
 const fetcher=async()=>new Response(new ReadableStream({start(c){if(kind==='oversized')c.enqueue(new Uint8Array(4000000+1));},cancel(){cancelStarted=true;return gate.then(()=>{cancelSettled=true;});}}),{status:kind==='rejected-status'?503:200});
 const s=setup({control,fetcher});
 const pending=s.adapter.publishAndRestore();void pending.catch(()=>{});await new Promise(r=>setImmediate(r));
 try{assert.equal(cancelStarted,true);assert.equal(cancelSettled,false);assert.equal(owned,true);}finally{release();await assert.rejects(pending,/TRIAL_STOPPED/);}
 assert.equal(owned,false);assert.equal(cancelSettled,true);
});


test('original source, versions and deployments cleanup use three fixed admitted GETs after stop',async()=>{
 const s=setup();await s.adapter.publishAndRestore();s.adapter.stop();s.setNow(clock+21600001);const actions=[],cap={cleanup:async(action,io)=>{actions.push(action);return io();}};
 assert.equal(typeof s.adapter.readOriginal,'function');
 for(const action of ['read-original-editor','read-original-versions','read-original-deployments']){
  const result=await s.adapter.readOriginal(action,cap);assert.equal(result.action,action);assert.equal(result.matchedAtReadback,true);assert.equal(result.rollbackComplete,false);assert(Object.isFrozen(result));
 }
 assert.deepEqual(actions,['read-original-editor','read-original-versions','read-original-deployments']);assert.deepEqual(s.calls.slice(7).map(c=>c.init.method),['GET','GET','GET']);assert.equal(s.calls.length,10);assert.equal(new URL(s.calls[7].url).searchParams.has('pageSize'),false);
});


test('readback rejects unknown aliases and missing cleanup without invoking credentials or IO',async()=>{
 const s=setup();let admitted=0;const cap={cleanup:async()=>{admitted++;}};
 for(const action of ['read-original-project','read-original-editor\n','restore-editor'])await assert.rejects(s.adapter.readOriginal(action,cap),/^Error: TRIAL_STOPPED$/);
 await assert.rejects(s.adapter.readOriginal('read-original-editor',{}),/^Error: TRIAL_STOPPED$/);assert.equal(admitted,0);assert.equal(s.calls.length,0);
});

for(const action of ['read-original-editor','read-original-versions','read-original-deployments'])test(action+' refuses mismatches and a second admitted read without extra IO',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});const key=action==='read-original-editor'?'files':action==='read-original-versions'?'versions':'deployments';return new Response(JSON.stringify(action==='read-original-editor'?{scriptId,files:original().map((f,i)=>i===1?{...f,source:f.source+' altered'}:f)}:{[key]:[]}));}});let charged=0;const cap={cleanup:async(_action,io)=>{charged++;return io();}};
 await assert.rejects(s.adapter.readOriginal(action,cap),/^Error: TRIAL_STOPPED$/);assert.equal(charged,1);assert.equal(s.calls.length,1);await assert.rejects(s.adapter.readOriginal(action,cap),/^Error: TRIAL_STOPPED$/);assert.equal(charged,1);assert.equal(s.calls.length,1);
});

test('version pagination refuses incomplete inventory and preserves an unknown publication receipt',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='PUT')return new Response(JSON.stringify({scriptId,files:s.calls.length===1?library:original()}));if(init.method==='POST')throw Error('SYNTHETIC_UNKNOWN_VERSION');return new Response(JSON.stringify({versions:baselineVersions(),nextPageToken:'SYNTHETIC_MORE'}));}});
 await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);const before=readFileSync(s.options.path);let count=0;await assert.rejects(s.adapter.readOriginal('read-original-versions',{cleanup:async(_a,io)=>{count++;return io();}}),/^Error: TRIAL_STOPPED$/);assert.equal(count,1);assert.deepEqual(readFileSync(s.options.path),before);
});

test('cleanup credentials are checked inside admitted callback after a wait, with no ordinary-expiry renewal',async()=>{
 const s=setup({credential:()=>({accessToken:'SYNTHETIC_MANAGEMENT_TOKEN',accountHash:publisherHash,scopes,expiresAt:clock+3600000,refreshTokenPresent:true})});let charged=0;
 await assert.rejects(s.adapter.readOriginal('read-original-editor',{cleanup:async(_a,io)=>{charged++;s.setNow(clock+3599991);return io();}}),/^Error: TRIAL_STOPPED$/);assert.equal(charged,1);assert.equal(s.calls.length,0);
});

test('unknown version creation can be observed without converting its journal into an acknowledgement',async()=>{
 let current=original(),created;
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='PUT'){current=JSON.parse(init.body).files;return new Response(JSON.stringify({scriptId,files:current}));}if(init.method==='POST'){created={scriptId,versionNumber:7,description:JSON.parse(init.body).description};throw Error('SYNTHETIC_LOST_ACK');}if(new URL(url).pathname.endsWith('/versions'))return new Response(JSON.stringify({versions:[...baselineVersions(),created]}));return new Response(JSON.stringify({scriptId,files:current}));}});
 await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);const before=readFileSync(s.options.path),r=await s.adapter.readOriginal('read-original-versions',{cleanup:async(_a,io)=>io()});assert.equal(r.matchedAtReadback,true);assert.equal(r.rollbackComplete,false);assert.deepEqual(readFileSync(s.options.path),before);assert.equal(JSON.parse(before).value.versionOutcome,'UNKNOWN');
});


test('an owned cleanup GET excludes overlapping publication or restore until its terminal response',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});enter();await gate;return new Response(JSON.stringify({scriptId,files:original()}));}});
 const pending=s.adapter.readOriginal('read-original-editor',{cleanup:async(_a,io)=>io()});void pending.catch(()=>{});await entered;
 try{await assert.rejects(s.adapter.publishAndRestore(),/TRIAL_STOPPED/);await assert.rejects(s.adapter.restore(),/TRIAL_STOPPED/);assert.equal(s.calls.length,1);}finally{release();}
 assert.equal((await pending).matchedAtReadback,true);assert.equal(s.calls.length,1);
});


test('an admitted original GET locks its journal across holders on the same canonical ledger',async()=>{
 const {createAuthorityPreparationControl}=await import('../scripts/read-authority-preparation-control.mjs'),dir=mkdtempSync(join(tmpdir(),'cmwebs-publication-ledger-'));chmodSync(dir,0o700);const path=join(dir,'budget.json'),epoch='SYNTHETIC_PUBLICATION_'+randomUUID(),raw=JSON.stringify({limit:160,spent:25,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40});fs.writeFileSync(path,raw,{mode:0o600});epochs.add(epoch);
 let ledgerTime=clock;const control=createAuthorityPreparationControl({path,epoch,approvalHash:'a'.repeat(64),proposalHash:'b'.repeat(64),legacySha256:hash(raw),importedReads:25,expiresAt:clock+21600000,now:()=>ledgerTime,pause:async ms=>{ledgerTime+=ms;}});let enter,release;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 await control.withPreparation(async cap=>{
  const s=setup({epoch,control:cap,backupReceipt:{source:'fixed-trial-original-editor-backup',epoch,scriptId,publisherHash,sourceHash:pin(original()),versionsHash:checksum(baselineVersions()),deploymentsHash:checksum(baselineDeployments())},fetcher:async(url,init)=>{s.calls.push({url,init});enter();await gate;return new Response(JSON.stringify({scriptId,files:original()}));}}),other=mod.createAuthorityTrialPublication(s.options),before=readFileSync(s.options.path),pending=s.adapter.readOriginal('read-original-editor',cap);void pending.catch(()=>{});await Promise.race([entered,pending.then(()=>{throw Error('READ_SETTLED_BEFORE_GATE');})]);
  try{await assert.rejects(other.publishAndRestore(),/TRIAL_STOPPED/);assert.deepEqual(readFileSync(s.options.path),before);assert.equal(s.calls.length,1);}finally{release();}
  assert.equal((await pending).matchedAtReadback,true);assert.deepEqual(readFileSync(s.options.path),before);
 });const state=JSON.parse(readFileSync(path));assert.equal(state.spent,26);assert.deepEqual(state.preparation.iActions,['read-original-editor']);
});
