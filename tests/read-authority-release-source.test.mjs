import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const module=await import('../scripts/read-authority-release-source.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-release-source.mjs'))return {};throw e;});
const original='SYNTHETIC_ORIGINAL_SCRIPT_ID',thin='SYNTHETIC_THIN_SCRIPT_ID',publisherHash='a'.repeat(64),clock=Date.parse('2026-10-15T00:00:00Z');
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
const aliases=['original-project','original-editor','original-versions','original-deployments','library-content','thin-content','thin-deployments'];
const files=()=>[{name:'Synthetic',type:'SERVER_JS',source:'function synthetic() {}'},{name:'appsscript',type:'JSON',source:'{"timeZone":"Asia/Taipei"}'}];
function responseFor(url){
 const u=new URL(url),scriptId=u.pathname.includes(thin)?thin:original;
 if(u.pathname.endsWith('/content'))return {scriptId,files:files()};
 if(u.pathname.endsWith('/versions'))return {versions:[{scriptId,versionNumber:1,description:'Synthetic baseline',createTime:'2026-10-12T00:00:00Z'}]};
 if(u.pathname.endsWith('/deployments'))return {deployments:[{deploymentId:'SYNTHETIC_DEPLOYMENT_ID',deploymentConfig:{scriptId,versionNumber:1,manifestFileName:'appsscript'}}]};
 return {scriptId,parentId:'SYNTHETIC_ORIGINAL_CONTAINER'};
}
function setup(patch={}){
 let time=clock,spent=0,credentials=0;const requests=[],charges=[],order=[];
 const token={accessToken:'SYNTHETIC_PUBLISHER_TOKEN',accountHash:publisherHash,scopes:[...scopes],expiresAt:clock+3600000,refreshTokenPresent:true};
 const options={originalScriptId:original,thinScriptId:thin,libraryVersion:7,publisherHash,credential:()=>{credentials++;order.push('credential');return token;},now:()=>time,fetcher:async(url,init)=>{order.push('fetch');assert.equal(spent,requests.length+1);requests.push({url,init});return new Response(JSON.stringify(responseFor(url)));},...patch};
 assert.equal(typeof module.createAuthorityReleaseSource,'function');
 const adapter=module.createAuthorityReleaseSource(options);
 const control={phase:'wrapper-before',externalRead:async(io,alias)=>{charges.push(alias);spent++;order.push('debit');return await io();}};
 return {options,adapter,control,token,requests,charges,order,spent:()=>spent,credentials:()=>credentials,setNow:n=>{time=n;}};
}
test('source readback construction is pure and snapshots fixed project/version pins',async()=>{
 const s=setup();assert.equal(s.spent()+s.credentials()+s.requests.length,0);s.options.originalScriptId=thin;s.options.libraryVersion=1;
 await s.adapter.read('library-content',s.control);const u=new URL(s.requests[0].url);assert.equal(u.pathname,'/v1/projects/'+original+'/content');assert.equal(u.searchParams.get('versionNumber'),'7');
});
for(const alias of aliases)test('fixed '+alias+' uses one phase-bound release debit before one GET',async()=>{
 const s=setup(),r=await s.adapter.read(alias,s.control),{url,init}=s.requests[0],u=new URL(url);
 assert.equal(s.spent(),1);assert.deepEqual(s.charges,[alias]);assert.deepEqual(s.order,['credential','debit','fetch']);
 assert.equal(u.origin,'https://script.googleapis.com');assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.redirect,'manual');assert.equal(init.headers.authorization,'Bearer SYNTHETIC_PUBLISHER_TOKEN');assert.equal(init.headers['cache-control'],'no-cache, no-store');assert(init.signal);
 if(alias==='original-editor')assert.equal(u.searchParams.has('versionNumber'),false);
 if(alias==='thin-content')assert.equal(u.searchParams.get('versionNumber'),'1');
 if(alias.endsWith('deployments')||alias==='original-versions'){assert.equal(u.searchParams.get('pageSize'),'200');assert.equal(u.searchParams.has('pageToken'),false);}
 assert(Object.isFrozen(r));assert.equal(r.complete,undefined);assert.equal(r.trialAccepted,undefined);assert.equal(r.librarySourceHash,undefined);
});
test('the actual observed source is returned frozen, never replaced with expected source',async()=>{
 const value={scriptId:original,files:files()};value.files[0].source='function changedActualSource() {}';
 const s=setup({fetcher:async()=>new Response(JSON.stringify(value))}),r=await s.adapter.read('library-content',s.control);
 assert.equal(r.files[0].source,value.files[0].source);assert(Object.isFrozen(r.files[0]));assert.throws(()=>{r.files[0].source='other';});
});
test('one alias is independently readable before and after but cannot repeat within a phase',async()=>{
 const s=setup();await s.adapter.read('original-project',s.control);await s.adapter.read('original-project',{...s.control,phase:'wrapper-after'});
 await assert.rejects(s.adapter.read('original-project',s.control),/^Error: TRIAL_STOPPED$/);assert.equal(s.spent(),2);assert.equal(s.requests.length,2);
});
test('unknown operations, extra arguments and unapproved phases never transmit credentials',async()=>{
 for(const alias of ['__proto__','constructor','https://other.invalid','original-v1-content','original-settings']){const s=setup();await assert.rejects(s.adapter.read(alias,s.control),/TRIAL_STOPPED/);assert.equal(s.spent()+s.credentials()+s.requests.length,0);}
 for(const phase of [undefined,'qualified-before','before']){const s=setup();await assert.rejects(s.adapter.read('original-project',{...s.control,phase}),/TRIAL_STOPPED/);assert.equal(s.spent()+s.credentials()+s.requests.length,0);}
 const s=setup();await assert.rejects(s.adapter.read('original-project',s.control,{scriptId:thin}),/TRIAL_STOPPED/);assert.equal(s.spent()+s.credentials()+s.requests.length,0);
});
test('constructor refuses foreign IDs, version expansion and additional options',()=>{
 for(const patch of [{originalScriptId:thin},{thinScriptId:'../PRIVATE'},{libraryVersion:8},{publisherHash:'not-a-hash'},{endpoint:'https://other.invalid'}])assert.throws(()=>setup(patch),/TRIAL_STOPPED/);
});
test('wrong holder, scopes or expiry never reaches debit or network',async()=>{
 for(const patch of [{accountHash:'b'.repeat(64)},{scopes:[...scopes,'https://www.googleapis.com/auth/drive']},{scopes:scopes.slice(1)},{expiresAt:clock+10000},{accessToken:'PRIVATE\nTOKEN'}]){
  const s=setup();Object.assign(s.token,patch);await assert.rejects(s.adapter.read('original-project',s.control),/^Error: TRIAL_STOPPED$/);assert.equal(s.spent()+s.requests.length,0);
 }
});
test('cross realm async credential is consumed and cannot transmit',async()=>{
 let unhandled=false;const listener=()=>{unhandled=true;};process.on('unhandledRejection',listener);
 try{const s=setup({credential:()=>vm.runInNewContext('Promise.reject(new Error("PRIVATE"))')});await assert.rejects(s.adapter.read('original-project',s.control),/TRIAL_STOPPED/);await new Promise(r=>setImmediate(r));assert.equal(unhandled,false);assert.equal(s.spent()+s.requests.length,0);}finally{process.removeListener('unhandledRejection',listener);}
});
test('expiry after admission is still spent and prevents transmission',async()=>{
 const s=setup(),cap={...s.control,externalRead:async(io,alias)=>s.control.externalRead(async()=>{s.setNow(clock+3600000);return io();},alias)};
 await assert.rejects(s.adapter.read('original-project',cap),/TRIAL_STOPPED/);assert.equal(s.spent(),1);assert.equal(s.requests.length,0);
});
test('admission failure never calls network and cannot be retried through the adapter',async()=>{
 const s=setup();await assert.rejects(s.adapter.read('original-project',{...s.control,externalRead:async()=>{throw Error('PRIVATE');}}),/^Error: TRIAL_STOPPED$/);
 await assert.rejects(s.adapter.read('original-editor',s.control),/TRIAL_STOPPED/);assert.equal(s.spent()+s.requests.length,0);
});
for(const [name,make] of [['redirect',()=>new Response('',{status:302})],['provider failure',()=>new Response('PRIVATE',{status:503})],['bad JSON',()=>new Response('PRIVATE')],['bad UTF8',()=>new Response(new Uint8Array([255]))],['oversized',()=>new Response('x'.repeat(100001))]])test('response '+name+' remains charged and does not retry',async()=>{
 let io=0;const s=setup({fetcher:async()=>{io++;return make();}});await assert.rejects(s.adapter.read('original-project',s.control),/^Error: TRIAL_STOPPED$/);await assert.rejects(s.adapter.read('original-project',s.control),/TRIAL_STOPPED/);assert.equal(io,1);assert.equal(s.spent(),1);
});
for(const [name,alias,mutate] of [
 ['foreign script','original-project',v=>{v.scriptId=thin;}],['PII outside mask','original-project',v=>{v.creator={email:'PRIVATE'};}],
 ['duplicate file','library-content',v=>{v.files.push({...v.files[0]});}],['invalid manifest','library-content',v=>{v.files[1].source='invalid';}],['extra source field','library-content',v=>{v.files[0].lastModifyUser={email:'PRIVATE'};}],
 ['version pagination','original-versions',v=>{v.nextPageToken='PRIVATE';}],['duplicate version','original-versions',v=>{v.versions.push({...v.versions[0]});}],['foreign version','original-versions',v=>{v.versions[0].scriptId=thin;}],
 ['deployment pagination','thin-deployments',v=>{v.nextPageToken='PRIVATE';}],['foreign deployment','thin-deployments',v=>{v.deployments[0].deploymentConfig.scriptId=original;}],['duplicate deployment','thin-deployments',v=>{v.deployments.push({...v.deployments[0]});}]
])test('malformed '+name+' stops after one response',async()=>{
 const s=setup({fetcher:async url=>{const v=responseFor(url);mutate(v);return new Response(JSON.stringify(v));}});await assert.rejects(s.adapter.read(alias,s.control),/^Error: TRIAL_STOPPED$/);assert.equal(s.spent(),1);
});
test('mutable control and credential snapshots cannot change a charged read during await',async()=>{
 const s=setup(),cap={...s.control};const external=cap.externalRead;
 cap.externalRead=async(io,alias)=>external(async()=>{cap.phase='qualified-before';s.token.accessToken='PRIVATE_CHANGED';s.token.scopes.push('PRIVATE_CHANGED');return io();},alias);
 await s.adapter.read('original-project',cap);assert.equal(s.requests[0].init.headers.authorization,'Bearer SYNTHETIC_PUBLISHER_TOKEN');assert.deepEqual(s.charges,['original-project']);
});
test('single in-flight source read prevents a second admission while the original owns IO',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 const s=setup({fetcher:async url=>{enter();await gate;return new Response(JSON.stringify(responseFor(url)));}}),running=s.adapter.read('original-project',s.control);await entered;
 try{await assert.rejects(s.adapter.read('original-editor',s.control),/TRIAL_STOPPED/);assert.equal(s.spent(),1);}finally{release();}
 await assert.rejects(running,/TRIAL_STOPPED/);
});
