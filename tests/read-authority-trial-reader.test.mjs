import {syncBuiltinESMExports} from 'node:module';
import fs from 'node:fs';
import {createAuthorityTrialMetadataAdapters} from '../scripts/read-authority-trial-metadata.mjs';
import {atomicFixtureControl} from './fixtures/read-authority/atomic-control.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,readFileSync,lstatSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
const mod=await import('../scripts/read-authority-trial-reader.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-trial-reader.mjs'))return {};throw e;});
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-14T00:00:00Z');
const callerEmail='caller@example.invalid',publisherEmail='publisher@example.invalid',callerHash=hash(callerEmail),publisherHash=hash(publisherEmail),fixtureHash='f'.repeat(64);
const originalSheetId='SYNTHETIC_ORIGINAL_SHEET_ID',syntheticSheetId='SYNTHETIC_NEW_UNBOUND_SHEET_ID',permissionId='00001234567890123456789',ownerId='SYNTHETIC_OWNER_ID';
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
const owner=()=>({id:ownerId,type:'user',role:'owner',emailAddress:publisherEmail}),reader=()=>({id:permissionId,type:'user',role:'reader',emailAddress:callerEmail}),epochs=new Set();
test.after(()=>{for(const epoch of epochs){const p=join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(epoch))+'.reader.json');for(const file of [p,p+'.stop'])try{const s=lstatSync(file),v=JSON.parse(readFileSync(file)).value;if(s.isFile()&&!s.isSymbolicLink()&&v.path.startsWith(join(tmpdir(),'cmwebs-reader-')))unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}}});
function setup(patch={}){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-reader-'));chmodSync(dir,0o700);const epoch='SYNTHETIC_READER_'+randomUUID(),calls=[],metadataCalls=[],cleanup=[];let spent=0,now=clock,hasReader=false;
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{spent++;},cleanup:async(action,io)=>{cleanup.push(action);spent++;return io();}};
 const options={path:join(dir,'receipt.json'),epoch,originalSheetId,syntheticSheetId,callerEmail,callerHash,publisherHash,fixtureHash,expiresAt:clock+21600000,control,
  creationReceipt:{source:'fixed-trial-import-readback',epoch,syntheticSheetId,publisherHash,fixtureHash},now:()=>now,
  metadata:{read:async(alias,ctrl)=>ctrl.externalRead(async()=>{metadataCalls.push(alias);if(alias==='caller-permission-id')return {kind:'drive#permissionId',id:permissionId};if(alias==='synthetic-file')return {id:syntheticSheetId,mimeType:'application/vnd.google-apps.spreadsheet',ownedByMe:true,trashed:false};return {permissions:alias==='synthetic-acl'&&hasReader?[owner(),reader()]:[owner()]};})},
  credential:()=>({accessToken:'SYNTHETIC_MANAGEMENT_TOKEN',accountHash:publisherHash,scopes,expiresAt:now+3600000,refreshTokenPresent:true}),
  fetcher:async(url,init)=>{calls.push({url,init});if(init.method==='POST'){hasReader=true;return new Response(JSON.stringify({kind:'drive#permission',...reader()}));}if(init.method==='DELETE'){hasReader=false;return new Response(null,{status:204});}return new Response(JSON.stringify({permissions:hasReader?[owner(),reader()]:[owner()]}));},...patch};
 epochs.add(epoch);assert.equal(typeof mod.createAuthorityTrialReader,'function');options.control=atomicFixtureControl(options.control);const adapter=mod.createAuthorityTrialReader(options);
 return {options,adapter,calls,metadataCalls,cleanup,spent:()=>spent,setNow:v=>{now=v;},setReader:v=>{hasReader=v;}};
}
test('grant pins known grantee before fixed notification-free POST and verifies exact Reader',async()=>{
 const s=setup(),result=await s.adapter.grant();assert.equal(result.readerVerified,true);assert.equal(result.permissionHash,hash(permissionId));assert.equal(s.spent(),6);assert.deepEqual(s.metadataCalls,['caller-permission-id','original-acl','synthetic-file','synthetic-acl','synthetic-acl']);
 const c=s.calls[0],u=new URL(c.url);assert.equal(u.origin+u.pathname,'https://www.googleapis.com/drive/v3/files/'+syntheticSheetId+'/permissions');assert.equal(u.searchParams.get('sendNotificationEmail'),'false');assert(!u.searchParams.has('transferOwnership'));assert(!u.searchParams.has('useDomainAdminAccess'));assert.equal(c.init.method,'POST');assert.equal(c.init.redirect,'manual');assert.deepEqual(JSON.parse(c.init.body),{type:'user',role:'reader',emailAddress:callerEmail});
 const durable=readFileSync(s.options.path,'utf8');assert(durable.includes(permissionId));assert(!durable.includes(callerEmail));assert(!durable.includes('SYNTHETIC_MANAGEMENT_TOKEN'));await assert.rejects(s.adapter.grant(),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.length,1);
});
test('remove and absence verification use two distinct independent cleanup actions and keep whole rollback unaccepted',async()=>{
 const s=setup();await s.adapter.grant();s.setNow(clock+21600001);await s.adapter.remove();const result=await s.adapter.verifyRemoved();assert.deepEqual(s.cleanup,['remove-reader','verify-reader-removed']);assert.equal(s.calls[1].init.method,'DELETE');assert.equal(new URL(s.calls[1].url).pathname,'/drive/v3/files/'+syntheticSheetId+'/permissions/'+permissionId);assert.equal(s.calls[2].init.method,'GET');assert.equal(result.readerAbsentAtReadback,true);assert.equal(result.grantOutcomeKnown,true);assert.equal(result.rollbackComplete,false);await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);await assert.rejects(s.adapter.verifyRemoved(),/TRIAL_STOPPED/);assert.equal(s.calls.length,3);
});
test('lost grant reply preserves lookup target, never repeats POST, and absence cannot settle unknown grant',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST')throw Error('PRIVATE_NETWORK');if(init.method==='DELETE')return new Response(null,{status:204});return new Response(JSON.stringify({permissions:[owner()]}));}});await assert.rejects(s.adapter.grant(),/^Error: TRIAL_STOPPED$/);assert(readFileSync(s.options.path,'utf8').includes(permissionId));await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);await s.adapter.remove();const v=await s.adapter.verifyRemoved();assert.equal(v.readerAbsentAtReadback,true);assert.equal(v.grantOutcomeKnown,false);assert.equal(v.rollbackComplete,false);assert.equal(s.calls.filter(c=>c.init.method==='POST').length,1);
});
for(const [name,patch] of [['same file',{syntheticSheetId:originalSheetId}],['wrong caller',{callerHash:'a'.repeat(64)}],['wrong creation',{creationReceipt:{source:'fixed-trial-import-readback',epoch:'OTHER',syntheticSheetId,publisherHash,fixtureHash}}]])test('configuration '+name+' denies before permission IO',()=>{assert.throws(()=>setup(patch),/TRIAL_STOPPED/);});
for(const [name,permissions] of [['source Reader',[owner(),reader()]],['group',[owner(),{id:'G',type:'group',role:'reader',emailAddress:'group@example.invalid'}]],['inherited',[{...owner(),permissionDetails:[{inherited:true,permissionType:'file',role:'owner'}]}]],['lookup equals owner',[{...owner(),id:permissionId}]]])test('original baseline '+name+' stops before POST',async()=>{
 const s=setup({metadata:{read:async alias=>alias==='caller-permission-id'?{kind:'drive#permissionId',id:permissionId}:{permissions}}});await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);
});
test('preexisting Reader on new fixture is never overwritten or removed as this adapter grant',async()=>{
 const s=setup({metadata:{read:async alias=>alias==='caller-permission-id'?{kind:'drive#permissionId',id:permissionId}:alias==='synthetic-file'?{id:syntheticSheetId,mimeType:'application/vnd.google-apps.spreadsheet',ownedByMe:true,trashed:false}:{permissions:alias==='synthetic-acl'?[owner(),reader()]:[owner()]}}});await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);const v=await s.adapter.remove();assert.equal(v.grantNeverDispatched,true);assert.equal(s.calls.length,0);
});
for(const [name,response] of [['wrong ID',{kind:'drive#permission',...reader(),id:'OTHER'}],['writer',{kind:'drive#permission',...reader(),role:'writer'}],['foreign email',{kind:'drive#permission',...reader(),emailAddress:'other@example.invalid'}],['private extra',{kind:'drive#permission',...reader(),displayName:'PRIVATE'}]])test('grant reply '+name+' rejects without changing cleanup target',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});return new Response(JSON.stringify(response));}});await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);assert(readFileSync(s.options.path,'utf8').includes(permissionId));assert.equal(s.calls.length,1);
});
test('restart keeps same-path intent and forbids a second grant or alternate epoch path reset',async()=>{
 const s=setup();await s.adapter.grant();const resumed=mod.createAuthorityTrialReader(s.options);await assert.rejects(resumed.grant(),/TRIAL_STOPPED/);assert.throws(()=>mod.createAuthorityTrialReader({...s.options,path:join(tmpdir(),'another-reader.json')}),/TRIAL_STOPPED/);await resumed.remove();assert.equal(s.calls.filter(c=>c.init.method==='POST').length,1);
});
test('receipt failure after verified grant does not suppress the known-target independent removal',async()=>{
 const s=setup();await s.adapter.grant();chmodSync(join(s.options.path,'..'),0o755);try{await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);}finally{chmodSync(join(s.options.path,'..'),0o700);}
});
test('remove during baseline wait cancels grant before POST and does not remove unrelated permission',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({metadata:{read:async()=>{enter();await new Promise(r=>{release=r;});return {kind:'drive#permissionId',id:permissionId};}}});
 const g=s.adapter.grant();await entered;const r=s.adapter.remove();release();await assert.rejects(g,/TRIAL_STOPPED/);assert.equal((await r).grantNeverDispatched,true);assert.equal(s.calls.length,0);
});
test('remove during grant waits for local POST settlement then deletes without parallel writes',async()=>{
 let enter,release,active=false;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST'){active=true;enter();await new Promise(r=>{release=r;});active=false;return new Response(JSON.stringify({kind:'drive#permission',...reader()}));}assert.equal(active,false);return new Response(null,{status:204});}});
 const g=s.adapter.grant();await entered;const r=s.adapter.remove();assert.equal(s.calls.length,1);release();await assert.rejects(g,/TRIAL_STOPPED/);await r;assert.deepEqual(s.calls.map(c=>c.init.method),['POST','DELETE']);
});
test('publisher credential expiry prevents POST after baseline and does not remove anything',async()=>{
 const s=setup({credential:()=>({accessToken:'SYNTHETIC_TOKEN',accountHash:publisherHash,scopes,expiresAt:clock,refreshTokenPresent:true})});await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);assert.equal((await s.adapter.remove()).grantNeverDispatched,true);
});
test('new file mismatch or shared-drive fields stop before grant',async()=>{
 for(const file of [{id:originalSheetId,mimeType:'application/vnd.google-apps.spreadsheet',ownedByMe:true,trashed:false},{id:syntheticSheetId,mimeType:'application/vnd.google-apps.spreadsheet',ownedByMe:true,trashed:false,driveId:'SHARED'}]){
  const s=setup({metadata:{read:async alias=>alias==='caller-permission-id'?{kind:'drive#permissionId',id:permissionId}:alias==='synthetic-file'?file:{permissions:[owner()]}}});await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);
 }
});
test('unexpected grant ACL never marks Reader verified, and retained target remains removable',async()=>{
 let aclReads=0;const s=setup({metadata:{read:async alias=>alias==='caller-permission-id'?{kind:'drive#permissionId',id:permissionId}:alias==='synthetic-file'?{id:syntheticSheetId,mimeType:'application/vnd.google-apps.spreadsheet',ownedByMe:true,trashed:false}:{permissions:alias==='synthetic-acl'&&++aclReads>1?[owner(),{...reader(),role:'writer'}]:[owner()]}}});await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);assert.notEqual(s.adapter.status(),'reader-verified');await s.adapter.remove();assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});
test('unknown delete never retries; separate readback can only state absence now',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST')return new Response(JSON.stringify({kind:'drive#permission',...reader()}));if(init.method==='DELETE')throw Error('PRIVATE_DELETE');return new Response(JSON.stringify({permissions:[owner()]}));},metadata:{read:async alias=>alias==='caller-permission-id'?{kind:'drive#permissionId',id:permissionId}:alias==='synthetic-file'?{id:syntheticSheetId,mimeType:'application/vnd.google-apps.spreadsheet',ownedByMe:true,trashed:false}:{permissions:[owner(),...(alias==='synthetic-acl'&&s.calls.length?[reader()]:[])]}}});await s.adapter.grant();await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);assert.equal((await s.adapter.verifyRemoved()).rollbackComplete,false);assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});
test('stale second instance cannot overwrite in-flight grant intent or revive grant after stop',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST'){enter();await new Promise(r=>{release=r;});return new Response(JSON.stringify({kind:'drive#permission',...reader()}));}return new Response(null,{status:204});}});
 const other=mod.createAuthorityTrialReader(s.options),g=s.adapter.grant();await entered;let removeRejected=false;try{await other.remove();}catch(_){removeRejected=true;}finally{release();}let grantRejected=false;try{await g;}catch(_){grantRejected=true;}assert.equal(removeRejected,true);assert.equal(grantRejected,true);assert.equal(s.calls.length,1);await other.remove();assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});
test('second instance constructed during POST cannot issue concurrent DELETE',async()=>{
 let enter,release,active=false;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST'){active=true;enter();await new Promise(r=>{release=r;});active=false;return new Response(JSON.stringify({kind:'drive#permission',...reader()}));}assert.equal(active,false);return new Response(null,{status:204});}});
 const g=s.adapter.grant();await entered;const other=mod.createAuthorityTrialReader(s.options);let rejected=false;try{await other.remove();}catch(_){rejected=true;}finally{release();}await g.catch(()=>{});assert.equal(rejected,true);assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,0);await other.remove();assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});
test('cleanup admission failure before its IO callback leaves removal attempt available',async()=>{
 let first=true;const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},cleanup:async(action,io)=>{if(first){first=false;throw Error('PRIVATE_BUSY_BEFORE_DEBIT');}return io();}}});await s.adapter.grant();await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,0);await s.adapter.remove();assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});
test('stale grant after another completed grant cannot erase the durable cleanup target',async()=>{
 const s=setup(),other=mod.createAuthorityTrialReader(s.options);await s.adapter.grant();await assert.rejects(other.grant(),/TRIAL_STOPPED/);const j=JSON.parse(readFileSync(s.options.path)).value;assert.equal(j.grantAttempted,true);assert.equal(j.permissionId,permissionId);assert.equal(j.ownerId,ownerId);await s.adapter.remove();assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});
test('stale cleanup instance reloads the completed removal before independent absence verification',async()=>{
 const s=setup();await s.adapter.grant();const other=mod.createAuthorityTrialReader(s.options);await s.adapter.remove();const result=await other.verifyRemoved();assert.equal(result.readerAbsentAtReadback,true);assert.deepEqual(s.cleanup,['remove-reader','verify-reader-removed']);assert.equal(s.calls.filter(c=>c.init.method==='GET').length,1);
});

test('ordinary reader IO enters the pinned atomic capability',async()=>{
 let entered=0;const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},externalRead:async io=>{entered++;return await io();},cleanup:async(name,io)=>io()}});
 await s.adapter.grant();assert.equal(entered,6);
});

test('missing atomic capability denies reader before IO',()=>{
 const s=setup();assert.throws(()=>mod.createAuthorityTrialReader({...s.options,control:{...s.options.control,externalRead:undefined}}),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.length,0);assert.equal(s.spent(),0);
});

for(const kind of ['oversized','rejected-status']) test('reader '+kind+' body cancellation remains owned until settled',async()=>{
 let owned=false,cancelStarted=false,cancelSettled=false,release;const gate=new Promise(r=>{release=r;});
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},cleanup:async()=>{},restoreOriginalEditor:async()=>{},externalRead:async io=>{owned=true;try{return await io();}finally{owned=false;}}};
 const fetcher=async()=>new Response(new ReadableStream({start(c){if(kind==='oversized')c.enqueue(new Uint8Array(16000+1));},cancel(){cancelStarted=true;return gate.then(()=>{cancelSettled=true;});}}),{status:kind==='rejected-status'?503:200});
 const s=setup({control,fetcher});
 const pending=s.adapter.grant();void pending.catch(()=>{});await new Promise(r=>setImmediate(r));
 try{assert.equal(cancelStarted,true);assert.equal(cancelSettled,false);assert.equal(owned,true);}finally{release();await assert.rejects(pending,/TRIAL_STOPPED/);}
 assert.equal(owned,false);assert.equal(cancelSettled,true);
});

test('Reader pins atomic metadata admission against mutable input method replacement',async()=>{
 let originalAdmissions=0,replacements=0,requests=0,hasReader=false;
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},cleanup:async()=>{},externalRead:async io=>{originalAdmissions++;return await io();}};
 const credential=()=>({accessToken:'SYNTHETIC_PINNED_TOKEN',accountHash:publisherHash,scopes,expiresAt:clock+3600000,refreshTokenPresent:true});
 const fetcher=async(url,init)=>{requests++;let value;
  if(url.includes('/drive/v2/permissionIds/')) value={kind:'drive#permissionId',id:permissionId};
  else if(init.method==='POST'){hasReader=true;value={kind:'drive#permission',...reader()};}
  else if(url.includes('/permissions?')) value={permissions:[owner(),...(url.includes(syntheticSheetId)&&hasReader?[reader()]:[])]};
  else value={id:syntheticSheetId,mimeType:'application/vnd.google-apps.spreadsheet',ownedByMe:true,trashed:false};
  return new Response(JSON.stringify(value));
 };
 const metadata=createAuthorityTrialMetadataAdapters({originalSheetId,syntheticSheetId,publisherHash,callerHash,callerEmail,expectedTabNames:Array.from({length:20},(_,i)=>'Synthetic_'+i),credential,fetcher,now:()=>clock});
 const s=setup({control,metadata,credential,fetcher});control.externalRead=async io=>{replacements++;return await io();};
 const result=await s.adapter.grant();assert.equal(result.readerVerified,true);assert.equal(requests,6);assert.equal(originalAdmissions,6);assert.equal(replacements,0);
});

// Task100: NO_GRANT and UNKNOWN grant must select different existing cleanup paths.
test('cleanup disposition sheet-reader observes NO_GRANT without debit and freezes old snapshots',async()=>{
 const s=setup(),initial=s.adapter.cleanupDisposition(),before=readFileSync(s.options.path,'utf8');
 assert.equal(initial.resource,'sheet-reader');assert.equal(initial.resourceDisposition,'not-dispatched');assert(Object.isFrozen(initial.actions.remove));
 assert.throws(()=>s.adapter.cleanupDisposition({}),/TRIAL_STOPPED/);assert.equal(readFileSync(s.options.path,'utf8'),before);assert.equal(s.calls.length,0);
 assert.deepEqual(await s.adapter.remove(),{grantNeverDispatched:true});await assert.rejects(s.adapter.verifyRemoved(),/TRIAL_STOPPED/);
 const d=s.adapter.cleanupDisposition();assert.equal(d.actions.remove.outcome,'NO_GRANT');assert.equal(d.actions.remove.consumed,true);assert.equal(d.actions.remove.entered,false);assert.equal(d.actions.verify.entered,false);
 assert.equal(initial.actions.remove.consumed,false);assert.equal(s.calls.length,0);assert.deepEqual(s.cleanup,[]);
});
test('cleanup disposition sheet-reader distinguishes pending grant and owned cleanup while retaining integrity failures',async()=>{
 let release,enter;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);const s=setup(),base=s.options.fetcher;
 s.options.fetcher=async(url,init)=>{if(init.method==='POST'){enter();await gate;}return base(url,init);};
 const a=mod.createAuthorityTrialReader(s.options),pending=a.grant();await entered;
 const running=a.cleanupDisposition();assert.equal(running.inFlight,true);assert.equal(running.resourceDisposition,'attempted-known');assert.equal(running.grantOutcome,'UNKNOWN');release();assert.equal((await pending).readerVerified,true);
 const owned=a.cleanupDisposition();assert.equal(owned.inFlight,false);assert.equal(owned.integrity,'locally-uncontested');
 for(const v of [callerEmail,publisherHash,s.options.path,'SYNTHETIC_MANAGEMENT_TOKEN',permissionId])assert(!JSON.stringify(owned).includes(v));
 chmodSync(join(s.options.path,'..'),0o755);try{await assert.rejects(a.remove(),/TRIAL_STOPPED/);const d=a.cleanupDisposition();assert.equal(d.integrity,'compromised');assert.equal(d.actions.remove.entered,true);assert.equal(d.actions.remove.consumed,true);assert.equal(d.actions.remove.result,'rejected');}finally{chmodSync(join(s.options.path,'..'),0o700);}
 assert.equal(running.actions.remove.consumed,false);assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});

test('cleanup disposition UNKNOWN grant remains owned and denied remove is not callback entry',async()=>{
 let deny=true;const s=setup({control:{externalRead:async io=>io(),cleanup:async(name,io)=>{if(deny)throw Error('DENIED');return io();}}}),base=s.options.fetcher;
 s.options.fetcher=async(url,init)=>{if(init.method==='POST'){s.calls.push({url,init});throw Error('LOST_GRANT');}return base(url,init);};
 const a=mod.createAuthorityTrialReader(s.options);await assert.rejects(a.grant(),/TRIAL_STOPPED/);const unknown=a.cleanupDisposition();assert.equal(unknown.resourceDisposition,'attempted-known');assert.equal(unknown.grantOutcome,'UNKNOWN');
 await assert.rejects(a.remove(),/TRIAL_STOPPED/);const denied=a.cleanupDisposition();assert.equal(denied.actions.remove.entered,false);assert.equal(denied.actions.remove.consumed,false);assert.equal(denied.actions.remove.result,'rejected');
 deny=false;await a.remove();await a.verifyRemoved();const d=a.cleanupDisposition();assert.equal(d.actions.remove.consumed,true);assert.equal(d.actions.verify.callbackResult,'returned');assert.equal(d.grantOutcome,'UNKNOWN');
});
test('cleanup disposition retains detached Reader callback activity after outer method settles',async()=>{
 let enter,release,callback;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);const s=setup({control:{externalRead:async io=>io(),cleanup:async(name,io)=>{callback=io();void callback.catch(()=>{});}}}),base=s.options.fetcher;
 s.options.fetcher=async(url,init)=>{if(init.method==='DELETE'){enter();await gate;}return base(url,init);};const a=mod.createAuthorityTrialReader(s.options);await a.grant();
 const p=a.remove();await entered;await p;try{const d=a.cleanupDisposition();assert.equal(d.inFlight,true);assert.equal(d.actions.remove.callbackPending,true);assert.equal(d.integrity,'compromised');}finally{release();await callback;}
 assert.equal(a.cleanupDisposition().actions.remove.callbackResult,'returned');assert.equal(a.cleanupDisposition().integrity,'compromised');
});

test('cleanup disposition marks checksum-valid owned identity drift instead of reporting intact cleanup',async()=>{
 const s=setup();await s.adapter.grant();const envelope=JSON.parse(readFileSync(s.options.path));envelope.value.ownerId='SYNTHETIC_DIFFERENT_OWNER';envelope.sha256=hash(JSON.stringify(envelope.value));writeFileSync(s.options.path,JSON.stringify(envelope));
 await s.adapter.remove();assert.equal(s.adapter.cleanupDisposition().integrity,'compromised');assert.equal(s.adapter.cleanupDisposition().resourceDisposition,'attempted-known');assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});

test('cleanup disposition adapter observation is filesystem clock credential and capability inert',()=>{
 let observing=false;const forbid=()=>{if(observing)assert.fail('OBSERVER_SIDE_EFFECT');};const s=setup({now:()=>{forbid();return clock;},credential:()=>{forbid();throw Error('NOT_USED');},control:{externalRead:async()=>{forbid();},cleanup:async()=>{forbid();}}});
 const saved={};for(const name of ['lstatSync','readFileSync','openSync','writeSync','renameSync','fsyncSync']){saved[name]=fs[name];fs[name]=()=>assert.fail('OBSERVER_FILESYSTEM_IO');}syncBuiltinESMExports();observing=true;
 try{const a=s.adapter.cleanupDisposition(),b=s.adapter.cleanupDisposition();assert.deepEqual(a,b);assert.notEqual(a,b);assert.notEqual(a.actions,b.actions);for(const action of Object.keys(a.actions)){assert(Object.isFrozen(a.actions[action]));assert.notEqual(a.actions[action],b.actions[action]);}}finally{observing=false;Object.assign(fs,saved);syncBuiltinESMExports();}
});
