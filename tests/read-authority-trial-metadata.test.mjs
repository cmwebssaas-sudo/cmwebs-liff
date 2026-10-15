import {atomicFixtureControl} from './fixtures/read-authority/atomic-control.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const path='../scripts/read-authority-trial-metadata.mjs';
const metadata=await import(path).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-trial-metadata.mjs'))return {};throw e;});
const clock=Date.parse('2026-10-14T00:00:00Z'),publisherHash='a'.repeat(64),callerHash='b'.repeat(64);
const originalId='SYNTHETIC_ORIGINAL_SHEET_ID',syntheticId='SYNTHETIC_UNBOUND_SHEET_ID';
const names=Array.from({length:20},(_,i)=>'Synthetic_tab_'+i);
const managementScopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
const callerScopes=['spreadsheets.readonly','userinfo.email','script.external_request'].map(s=>'https://www.googleapis.com/auth/'+s);
const file=id=>({id,mimeType:'application/vnd.google-apps.spreadsheet',trashed:false,ownedByMe:true});
const acl=()=>({permissions:[{id:'SYNTHETIC_PERMISSION',type:'user',role:'owner',emailAddress:'publisher@example.invalid',deleted:false}]});
const sheet=()=>({spreadsheetId:syntheticId,properties:{timeZone:'Asia/Taipei'},sheets:names.map((title,sheetId)=>({properties:{title,sheetId}}))});
function setup(patch={}){
 let spent=0,requests=0,credentials=0,now=clock;const order=[],received=[];
 const control=atomicFixtureControl({waitForExternalReadSlot:async n=>{assert.equal(n,1);order.push('wait');},reserveExternalReads:async n=>{assert.equal(n,1);spent++;order.push('debit');}});
 const options={originalSheetId:originalId,syntheticSheetId:syntheticId,expectedTabNames:names,publisherHash,callerHash,now:()=>now,
  credential:actor=>{credentials++;order.push('credential:'+actor);return {accessToken:'SYNTHETIC_'+actor+'_TOKEN',accountHash:actor==='publisher'?publisherHash:callerHash,scopes:actor==='publisher'?managementScopes:callerScopes,expiresAt:now+3600000,refreshTokenPresent:actor==='publisher'};},
  fetcher:async(url,init)=>{requests++;order.push('fetch');received.push({url,init});assert.equal(spent,requests);return new Response(JSON.stringify(url.includes('/permissions?')?acl():url.startsWith('https://sheets.googleapis.com/')?sheet():file(url.includes(originalId)?originalId:syntheticId)));},...patch};
 assert.equal(typeof metadata.createAuthorityTrialMetadataAdapters,'function');const adapter=metadata.createAuthorityTrialMetadataAdapters(options);
 return {options,adapter,control,order,received,spent:()=>spent,requests:()=>requests,credentials:()=>credentials,setNow:value=>{now=value;}};
}
for(const [operation,actor,base] of [['original-acl','publisher','https://www.googleapis.com/drive/v3/files/'+originalId+'/permissions'],['synthetic-acl','publisher','https://www.googleapis.com/drive/v3/files/'+syntheticId+'/permissions'],['synthetic-file','publisher','https://www.googleapis.com/drive/v3/files/'+syntheticId],['synthetic-tabs','caller','https://sheets.googleapis.com/v4/spreadsheets/'+syntheticId]])test('fixed '+operation+' waits/debits before one actor-specific GET',async()=>{
 const s=setup();await s.adapter.read(operation,s.control);assert.equal(s.spent(),1);assert.equal(s.requests(),1);assert.deepEqual(s.order,['credential:'+actor,'wait','debit','fetch']);
 const {url,init}=s.received[0],u=new URL(url);assert.equal(u.origin+u.pathname,base);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.body,undefined);assert.equal(init.headers.authorization,'Bearer SYNTHETIC_'+actor+'_TOKEN');assert(init.signal);assert.equal(init.headers['cache-control'],'no-cache, no-store');
 assert(!u.searchParams.has('alt'));assert(!u.searchParams.has('ranges'));assert(!u.searchParams.has('includeGridData'));
 if(operation.endsWith('acl')){assert.equal(u.searchParams.get('pageSize'),'100');assert(!u.searchParams.has('pageToken'));assert(!u.searchParams.has('useDomainAdminAccess'));}
});
test('unknown operation or extra parameters cannot turn metadata into source/value/write access',async()=>{
 const s=setup();for(const op of ['https://other.invalid','original-tabs','copy','upload','grant-reader','synthetic-values','__proto__'])await assert.rejects(s.adapter.read(op,s.control),/^Error: TRIAL_STOPPED$/);
 await assert.rejects(s.adapter.read('synthetic-tabs',s.control,{fields:'sheets/data'}),/TRIAL_STOPPED/);assert.equal(s.spent(),0);assert.equal(s.requests(),0);assert.equal(s.credentials(),0);
});
test('failed wait or debit cannot reach credential transmission/fetch',async()=>{
 for(const phase of ['waitForExternalReadSlot','reserveExternalReads']){
  const s=setup(),control={...s.control,[phase]:async()=>{throw Error('PRIVATE_FAILURE');}};
  await assert.rejects(s.adapter.read('synthetic-file',atomicFixtureControl(control)),/^Error: TRIAL_STOPPED$/);assert.equal(s.requests(),0);assert.equal(s.credentials(),1); // Cached local preflight; never transmitted.
 }
});
for(const [name,patch] of [['wrong actor',{accountHash:callerHash}],['new scope',{scopes:[...managementScopes,'https://www.googleapis.com/auth/drive']}],['missing scope',{scopes:managementScopes.slice(1)}],['duplicate scope',{scopes:[...managementScopes,managementScopes[0]]}],['expired',{expiresAt:clock}],['invalid token',{accessToken:'PRIVATE token\n'}]])test('publisher credential rejects '+name+' before any fetch',async()=>{
 const s=setup({credential:()=>({accessToken:'SYNTHETIC_TOKEN',accountHash:publisherHash,scopes:managementScopes,expiresAt:clock+3600000,refreshTokenPresent:true,...patch})});await assert.rejects(s.adapter.read('synthetic-file',s.control),/^Error: TRIAL_STOPPED$/);assert.equal(s.requests(),0);
});
test('Drive.file publisher credential cannot be used for caller Sheets despite provider scope support',async()=>{
 const s=setup({credential:()=>({accessToken:'SYNTHETIC_TOKEN',accountHash:publisherHash,scopes:managementScopes,expiresAt:clock+3600000,refreshTokenPresent:true})});await assert.rejects(s.adapter.read('synthetic-tabs',s.control),/TRIAL_STOPPED/);assert.equal(s.requests(),0);
});
test('caller must retain exact three scopes, no refresh and six minutes of life',async()=>{
 for(const patch of [{refreshTokenPresent:true},{scopes:[...callerScopes,'https://www.googleapis.com/auth/drive.file']},{expiresAt:clock+360000}]){
  const s=setup({credential:()=>({accessToken:'SYNTHETIC_TOKEN',accountHash:callerHash,scopes:callerScopes,expiresAt:clock+3600000,refreshTokenPresent:false,...patch})});await assert.rejects(s.adapter.read('synthetic-tabs',s.control),/TRIAL_STOPPED/);assert.equal(s.requests(),0);
 }
});
test('cross-realm async credential rejects and consumes raw private Promise failure',async()=>{
 let rawError=false;const listener=()=>{rawError=true;};process.on('unhandledRejection',listener);
 try{const s=setup({credential:()=>vm.runInNewContext('Promise.reject(new Error("PRIVATE_CREDENTIAL"))')});await assert.rejects(s.adapter.read('synthetic-file',s.control),/^Error: TRIAL_STOPPED$/);await new Promise(r=>setImmediate(r));assert.equal(s.requests(),0);assert.equal(rawError,false);}finally{process.removeListener('unhandledRejection',listener);}
});
test('credential primitive snapshot is used once and post-debit expiry veto leaves spent',async()=>{
 let reads=0;const s=setup({credential:()=>({get accessToken(){reads++;return reads===1?'SYNTHETIC_PINNED_TOKEN':'PRIVATE_CHANGED';},accountHash:publisherHash,scopes:managementScopes,expiresAt:clock+3600000,refreshTokenPresent:true})});await s.adapter.read('synthetic-file',s.control);assert.equal(reads,1);assert.equal(s.received[0].init.headers.authorization,'Bearer SYNTHETIC_PINNED_TOKEN');
 const expired=setup(),control={...expired.control,reserveExternalReads:async n=>{await expired.control.reserveExternalReads(n);expired.setNow(clock+3600001);}};await assert.rejects(expired.adapter.read('synthetic-file',atomicFixtureControl(control)),/TRIAL_STOPPED/);assert.equal(expired.spent(),1);assert.equal(expired.requests(),0);
});
for(const [name,response] of [['redirect',()=>new Response('',{status:302})],['forbidden',()=>new Response('PRIVATE',{status:403})],['rate limit',()=>new Response('PRIVATE',{status:429})],['provider failure',()=>new Response('PRIVATE',{status:503})],['bad JSON',()=>new Response('PRIVATE')],['oversized',()=>new Response('x'.repeat(100001))],['non-UTF8',()=>new Response(new Uint8Array([255]))]])test('response '+name+' remains spent without retry or raw error',async()=>{
 let io=0;const s=setup({fetcher:async()=>{io++;return response();}});await assert.rejects(s.adapter.read('synthetic-acl',s.control),/^Error: TRIAL_STOPPED$/);assert.equal(io,1);assert.equal(s.spent(),1);
});
for(const [name,value] of [['pagination',{...acl(),nextPageToken:'PRIVATE_NEXT'}],['unknown private field',{...acl(),values:['PRIVATE']}],['invalid role',{permissions:[{id:'SYNTHETIC_PERMISSION',type:'user',role:'none'}]}],['invalid details',{permissions:[{id:'SYNTHETIC_PERMISSION',type:'user',role:'reader',permissionDetails:[{inherited:'true'}]}]}]])test('ACL '+name+' cannot become a complete observation',async()=>{
 const s=setup({fetcher:async()=>new Response(JSON.stringify(value))});await assert.rejects(s.adapter.read('original-acl',s.control),/TRIAL_STOPPED/);assert.equal(s.spent(),1);
});
test('complete ACL preserves group/inherited access for later denial, without asserting no-Viewer',async()=>{
 const value={permissions:[{id:'SYNTHETIC_GROUP',type:'group',role:'reader',emailAddress:'group@example.invalid',permissionDetails:[{inherited:true,inheritedFrom:'SYNTHETIC_PARENT',permissionType:'file',role:'reader'}]}]};
 const s=setup({fetcher:async()=>new Response(JSON.stringify(value))});const result=await s.adapter.read('original-acl',s.control);assert.deepEqual(result,value);assert.equal(result.callerLibraryRole,undefined);assert(Object.isFrozen(result.permissions[0].permissionDetails[0]));
});
for(const [name,value] of [['other ID',{...file(syntheticId),id:originalId}],['trashed',{...file(syntheticId),trashed:true}],['non-sheet',{...file(syntheticId),mimeType:'application/vnd.google-apps.script'}],['shared drive',{...file(syntheticId),driveId:'SYNTHETIC_DRIVE'}],['private content',{...file(syntheticId),content:'PRIVATE'}]])test('file '+name+' rejects after one debit',async()=>{
 const s=setup({fetcher:async()=>new Response(JSON.stringify(value))});await assert.rejects(s.adapter.read('synthetic-file',s.control),/TRIAL_STOPPED/);assert.equal(s.spent(),1);
});
for(const [name,mutate] of [['wrong ID',s=>{s.spreadsheetId=originalId;}],['wrong zone',s=>{s.properties.timeZone='UTC';}],['missing tab',s=>{s.sheets.pop();}],['duplicate ID',s=>{s.sheets[1].properties.sheetId=0;}],['unexpected title',s=>{s.sheets[0].properties.title='OTHER';}],['private grid',s=>{s.sheets[0].data=[{rowData:[{values:[{effectiveValue:{stringValue:'PRIVATE'}}]}]}];}]])test('Sheets metadata '+name+' cannot return a contract',async()=>{
 const value=sheet();mutate(value);const s=setup({fetcher:async()=>new Response(JSON.stringify(value))});await assert.rejects(s.adapter.read('synthetic-tabs',s.control),/TRIAL_STOPPED/);assert.equal(s.spent(),1);
});
test('options are pinned and a second in-flight read is denied without debit',async()=>{
 let release,enter;const entered=new Promise(r=>{enter=r;});const mutableNames=[...names];
 const s=setup({expectedTabNames:mutableNames,fetcher:async()=>{enter();await new Promise(r=>{release=r;});return new Response(JSON.stringify(sheet()));}});mutableNames[0]='OTHER';s.options.syntheticSheetId=originalId;
 const running=s.adapter.read('synthetic-tabs',s.control);await entered;try{await assert.rejects(s.adapter.read('synthetic-acl',s.control),/TRIAL_STOPPED/);assert.equal(s.spent(),1);}finally{release();}await running;
});
const lookupEmail='caller+trial@example.invalid',lookupHash=createHash('sha256').update(lookupEmail).digest('hex');
function lookupSetup(value={kind:'drive#permissionId',id:'00001234567890123456789'},patch={}){
 let requests=0;const s=setup({callerEmail:lookupEmail,callerHash:lookupHash,
  credential:()=>({accessToken:'SYNTHETIC_PUBLISHER_TOKEN',accountHash:publisherHash,scopes:managementScopes,expiresAt:clock+3600000,refreshTokenPresent:true}),
  fetcher:async(url,init)=>{requests++;s.received.push({url,init});s.order.push('fetch');return new Response(JSON.stringify(value));},...patch});return {...s,lookupRequests:()=>requests};
}
test('fixed caller permission lookup pins normalized identity and publisher GET before any future grant',async()=>{
 const s=lookupSetup(),v=await s.adapter.read('caller-permission-id',s.control);assert.deepEqual(v,{kind:'drive#permissionId',id:'00001234567890123456789'});assert(Object.isFrozen(v));assert.equal(v.role,undefined);assert.equal(v.callerLibraryRole,undefined);assert.equal(s.lookupRequests(),1);assert.equal(s.spent(),1);
 const {url,init}=s.received[0];assert.equal(url,'https://www.googleapis.com/drive/v2/permissionIds/caller%2Btrial%40example.invalid?fields=kind%2Cid');assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.body,undefined);assert.equal(init.headers.authorization,'Bearer SYNTHETIC_PUBLISHER_TOKEN');assert(!JSON.stringify(v).includes(lookupEmail));
});
test('unconfigured permission lookup preserves original four-operation policy without credential/debit',async()=>{
 const s=setup();await assert.rejects(s.adapter.read('caller-permission-id',s.control),/TRIAL_STOPPED/);assert.equal(s.spent(),0);assert.equal(s.requests(),0);assert.equal(s.credentials(),0);
});
test('lookup identity hash mismatch or malformed address refuses before credential or IO',()=>{
 for(const patch of [{callerHash},{callerEmail:'other@example.invalid'},{callerEmail:'../caller@example.invalid'},{callerEmail:'caller@example.invalid\nPRIVATE'}])assert.throws(()=>lookupSetup(undefined,patch),/^Error: TRIAL_STOPPED$/);
});
for(const [name,value] of [['kind',{kind:'drive#permission',id:'SYNTHETIC'}],['missing ID',{kind:'drive#permissionId'}],['extra private field',{kind:'drive#permissionId',id:'SYNTHETIC',emailAddress:'PRIVATE'}],['unsafe ID',{kind:'drive#permissionId',id:'../PRIVATE'}]])test('lookup '+name+' stops after one debit without retry',async()=>{
 const s=lookupSetup(value);await assert.rejects(s.adapter.read('caller-permission-id',s.control),/^Error: TRIAL_STOPPED$/);assert.equal(s.spent(),1);assert.equal(s.lookupRequests(),1);
});
test('lookup cannot use caller credential or override the destination/email',async()=>{
 const s=lookupSetup(undefined,{credential:()=>({accessToken:'SYNTHETIC_CALLER_TOKEN',accountHash:lookupHash,scopes:callerScopes,expiresAt:clock+3600000,refreshTokenPresent:false})});await assert.rejects(s.adapter.read('caller-permission-id',s.control),/TRIAL_STOPPED/);assert.equal(s.lookupRequests(),0);
 const other=lookupSetup();await assert.rejects(other.adapter.read('caller-permission-id',other.control,{email:'other@example.invalid'}),/TRIAL_STOPPED/);assert.equal(other.spent(),0);assert.equal(other.lookupRequests(),0);
});

test('metadata IO enters the atomic capability rather than releasing after debit',async()=>{
 let entered=0;const s=setup();await s.adapter.read('synthetic-file',{...s.control,externalRead:async io=>{entered++;return await s.control.externalRead(io);}});assert.equal(entered,1);
});

test('missing atomic capability denies metadata before IO',async()=>{
 const s=setup();await assert.rejects(s.adapter.read('synthetic-file',{...s.control,externalRead:undefined}),/^Error: TRIAL_STOPPED$/);assert.equal(s.requests(),0);assert.equal(s.spent(),0);assert.equal(s.credentials(),0);
});

for(const kind of ['oversized','rejected-status']) test('metadata '+kind+' body cancellation remains owned until settled',async()=>{
 let owned=false,cancelStarted=false,cancelSettled=false,release;const gate=new Promise(r=>{release=r;});
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},cleanup:async()=>{},restoreOriginalEditor:async()=>{},externalRead:async io=>{owned=true;try{return await io();}finally{owned=false;}}};
 const fetcher=async()=>new Response(new ReadableStream({start(c){if(kind==='oversized')c.enqueue(new Uint8Array(4096+1));},cancel(){cancelStarted=true;return gate.then(()=>{cancelSettled=true;});}}),{status:kind==='rejected-status'?503:200});
 const s=setup({fetcher});
 const pending=s.adapter.read('synthetic-file',control);void pending.catch(()=>{});await new Promise(r=>setImmediate(r));
 try{assert.equal(cancelStarted,true);assert.equal(cancelSettled,false);assert.equal(owned,true);}finally{release();await assert.rejects(pending,/TRIAL_STOPPED/);}
 assert.equal(owned,false);assert.equal(cancelSettled,true);
});
