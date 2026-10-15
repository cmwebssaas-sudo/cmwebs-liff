import {atomicFixtureControl} from './fixtures/read-authority/atomic-control.mjs';
import test from 'node:test';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,readFileSync,lstatSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
const mod=await import('../scripts/read-authority-trial-import.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-trial-import.mjs'))return {};throw e;});
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-14T00:00:00Z'),publisherHash=hash('publisher@example.invalid');
const originalSheetId='SYNTHETIC_ORIGINAL_SHEET_ID',newId='SYNTHETIC_IMPORTED_SHEET_ID',mime='application/vnd.google-apps.spreadsheet';
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s),epochs=new Set();
const file=()=>({id:newId,mimeType:mime,ownedByMe:true,trashed:false});
test.after(()=>{for(const epoch of epochs){const p=join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(epoch))+'.import.json');for(const x of [p,p+'.stop'])try{const s=lstatSync(x),v=JSON.parse(readFileSync(x)).value;if(s.isFile()&&!s.isSymbolicLink()&&v.path.startsWith(join(tmpdir(),'cmwebs-import-')))unlinkSync(x);}catch(e){if(e.code!=='ENOENT')throw e;}}});
function setup(patch={}){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-import-'));chmodSync(dir,0o700);const epoch='SYNTHETIC_IMPORT_'+randomUUID(),calls=[],order=[],bytes=Buffer.from('PK\x03\x04SYNTHETIC_OFFLINE_PREFLIGHT_FIXTURE'),fixtureHash=hash(bytes);let now=clock,spent=0;
 const control={waitForExternalReadSlot:async()=>{order.push('wait');},reserveExternalReads:async()=>{order.push('debit');spent++;}};
 const options={path:join(dir,'receipt.json'),epoch,originalSheetId,publisherHash,fixtureHash,fixtureBytes:bytes,expiresAt:clock+21600000,
  preflightReceipt:{source:'fixed-trial-xlsx-preflight',fixtureHash,size:bytes.length,tabs:20,unsafeFeatures:false},control,now:()=>now,
  credential:()=>{order.push('credential');return {accessToken:'SYNTHETIC_MANAGEMENT_TOKEN',accountHash:publisherHash,scopes,expiresAt:now+3600000,refreshTokenPresent:true};},
  fetcher:async(url,init)=>{calls.push({url,init});order.push(init.method);return new Response(JSON.stringify(init.method==='POST'?{id:newId,mimeType:mime}:file()));},...patch};
 epochs.add(epoch);assert.equal(typeof mod.createAuthorityTrialImport,'function');options.control=atomicFixtureControl(options.control);const adapter=mod.createAuthorityTrialImport(options);
 return {options,adapter,calls,order,spent:()=>spent,setNow:v=>{now=v;}};
}
test('fixed multipart import copies pinned bytes, charges once per IO and emits bound readback receipt',async()=>{
 const s=setup();assert.equal(s.calls.length,0);s.options.fixtureBytes.fill(0);const r=await s.adapter.create();assert.equal(r.syntheticSheetId,newId);assert.equal(r.fixtureHash,s.options.fixtureHash);assert.equal(r.source,'fixed-trial-import-readback');assert.equal(r.epoch,s.options.epoch);assert.equal(r.publisherHash,publisherHash);assert.equal(s.spent(),2);assert.deepEqual(s.order,['credential','wait','debit','POST','credential','wait','debit','GET']);
 const c=s.calls[0],u=new URL(c.url);assert.equal(u.origin+u.pathname,'https://www.googleapis.com/upload/drive/v3/files');assert.equal(u.searchParams.get('uploadType'),'multipart');assert.equal(u.searchParams.get('fields'),'id,mimeType');assert.equal(c.init.method,'POST');assert.equal(c.init.redirect,'manual');assert.match(c.init.headers['content-type'],/^multipart\/related; boundary=/);
 const boundary=c.init.headers['content-type'].split('boundary=')[1],body=Buffer.from(c.init.body);assert(body.includes(Buffer.from('PK\x03\x04SYNTHETIC_OFFLINE_PREFLIGHT_FIXTURE')));const prefix=body.toString('utf8').split('\r\n');const metadata=JSON.parse(prefix[3]);assert.deepEqual(Object.keys(metadata).sort(),['mimeType','name']);assert.equal(metadata.mimeType,mime);assert.equal(metadata.name,'CMWebs C3 synthetic '+hash(s.options.epoch).slice(0,16));assert(!body.includes(Buffer.from(originalSheetId)));assert(body.subarray(body.length-Buffer.byteLength('\r\n--'+boundary+'--\r\n')).equals(Buffer.from('\r\n--'+boundary+'--\r\n')));
 const saved=readFileSync(s.options.path,'utf8');assert(saved.includes(newId));assert(!saved.includes('SYNTHETIC_MANAGEMENT_TOKEN'));assert(!saved.includes('SYNTHETIC_OFFLINE_PREFLIGHT_FIXTURE'));await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);assert.equal(s.calls.length,2);
});
for(const [name,patch] of [['hash mismatch',{fixtureHash:'a'.repeat(64)}],['unsafe preflight',{preflightReceipt:{source:'fixed-trial-xlsx-preflight',fixtureHash:'f'.repeat(64),size:4,tabs:20,unsafeFeatures:true}}],['unknown input',{url:'https://other.invalid'}],['non ZIP',{fixtureBytes:Buffer.from('ordinary text')}],['oversized',{fixtureBytes:Buffer.alloc(5242881)}]])test('configuration '+name+' rejects without upload',()=>{assert.throws(()=>setup(patch),/TRIAL_STOPPED/);});
test('lost create reply stays unknown with one POST across restart and alternate path is denied',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});throw Error('PRIVATE_TRANSPORT');}});await assert.rejects(s.adapter.create(),/^Error: TRIAL_STOPPED$/);const saved=JSON.parse(readFileSync(s.options.path)).value;assert.equal(saved.creationOutcome,'UNKNOWN');assert.equal(saved.syntheticSheetId,null);const resumed=mod.createAuthorityTrialImport(s.options);await assert.rejects(resumed.create(),/TRIAL_STOPPED/);assert.throws(()=>mod.createAuthorityTrialImport({...s.options,path:join(tmpdir(),'alternate-import.json')}),/TRIAL_STOPPED/);assert.equal(s.calls.length,1);
});
for(const [name,reply] of [['original ID',{id:originalSheetId,mimeType:mime}],['wrong MIME',{id:newId,mimeType:'application/octet-stream'}],['extra fields',{id:newId,mimeType:mime,name:'PRIVATE'}]])test('create '+name+' does not verify or repeat POST',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});return new Response(JSON.stringify(reply));}});await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);assert.equal(s.calls.length,1);
});
for(const [name,metadata] of [['not owned',{...file(),ownedByMe:false}],['trashed',{...file(),trashed:true}],['shared drive',{...file(),driveId:'SHARED'}],['different ID',{...file(),id:originalSheetId}]])test('readback '+name+' retains known create target without accepting receipt',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});return new Response(JSON.stringify(init.method==='POST'?{id:newId,mimeType:mime}:metadata));}});await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);const j=JSON.parse(readFileSync(s.options.path)).value;assert.equal(j.syntheticSheetId,newId);assert.equal(j.creationOutcome,'ACK_MATCHED');assert.equal(s.calls.length,2);await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);
});
test('expired publisher token stops before debit or POST',async()=>{
 const s=setup({credential:()=>({accessToken:'SYNTHETIC',accountHash:publisherHash,scopes,expiresAt:clock,refreshTokenPresent:true})});await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);assert.equal(s.spent(),0);assert.equal(s.calls.length,0);
});
test('token expiry after durable debit keeps spent without upload',async()=>{
 const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{s.setNow(clock+3600000);}}});await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);
});
test('stop during admission prevents upload and is irreversible after restart',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({control:{waitForExternalReadSlot:async()=>{enter();await new Promise(r=>{release=r;});},reserveExternalReads:async()=>{}}});const creating=s.adapter.create();await entered;s.adapter.stop();release();await assert.rejects(creating,/TRIAL_STOPPED/);assert.equal(s.calls.length,0);const next=mod.createAuthorityTrialImport(s.options);await assert.rejects(next.create(),/TRIAL_STOPPED/);
});
test('stop while POST pending preserves known target and never claims readback',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});enter();await new Promise(r=>{release=r;});return new Response(JSON.stringify({id:newId,mimeType:mime}));}});const creating=s.adapter.create();await entered;s.adapter.stop();release();await assert.rejects(creating,/TRIAL_STOPPED/);const j=JSON.parse(readFileSync(s.options.path)).value;assert.equal(j.syntheticSheetId,newId);assert.equal(j.creationOutcome,'ACK_MATCHED');assert.equal(s.calls.length,1);
});
test('stale instance cannot overwrite another instance verified import receipt',async()=>{
 const s=setup(),other=mod.createAuthorityTrialImport(s.options);await s.adapter.create();await assert.rejects(other.create(),/TRIAL_STOPPED/);assert.equal(JSON.parse(readFileSync(s.options.path)).value.creationOutcome,'VERIFIED');assert.equal(s.calls.length,2);
});
test('cross-instance concurrent create cannot send a second POST or damage receipt',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST'){enter();await new Promise(r=>{release=r;});return new Response(JSON.stringify({id:newId,mimeType:mime}));}return new Response(JSON.stringify(file()));}});const other=mod.createAuthorityTrialImport(s.options),creating=s.adapter.create();await entered;await assert.rejects(other.create(),/TRIAL_STOPPED/);release();await creating;assert.equal(s.calls.filter(c=>c.init.method==='POST').length,1);
});
test('receipt IO failure before create prevents upload',async()=>{
 const s=setup();chmodSync(join(s.options.path,'..'),0o755);try{await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);}finally{chmodSync(join(s.options.path,'..'),0o700);}
});
for(const [name,extra] of [['wrong actor',{accountHash:'a'.repeat(64)}],['scope expansion',{scopes:[...scopes,'https://www.googleapis.com/auth/drive']}],['async getter',null]])test('publisher '+name+' denies before debit or IO',async()=>{
 const s=setup({credential:()=>extra===null?Promise.resolve({accessToken:'SYNTHETIC',accountHash:publisherHash,scopes,expiresAt:clock+3600000,refreshTokenPresent:true}):{accessToken:'SYNTHETIC',accountHash:publisherHash,scopes,expiresAt:clock+3600000,refreshTokenPresent:true,...extra}});await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);assert.equal(s.spent(),0);assert.equal(s.calls.length,0);
});
for(const [name,response] of [['redirect',()=>new Response(null,{status:302,headers:{location:'https://other.invalid'}})],['oversized body',()=>new Response(JSON.stringify({id:newId,mimeType:mime,padding:'x'.repeat(4096)}))],['invalid UTF8',()=>new Response(new Uint8Array([255,255]))]])test('create response '+name+' keeps charged unknown and never follows or retries',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});return response();}});await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);assert.equal(s.spent(),1);assert.equal(s.calls.length,1);assert.equal(JSON.parse(readFileSync(s.options.path)).value.creationOutcome,'UNKNOWN');await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);assert.equal(s.calls.length,1);
});
test('failed durable stop still irreversibly cancels current instance before upload',async()=>{
 let enter,release,waits=0;const entered=new Promise(r=>{enter=r;});const s=setup({control:{waitForExternalReadSlot:async()=>{if(++waits===1){enter();await new Promise(r=>{release=r;});}},reserveExternalReads:async()=>{}}});const creating=s.adapter.create();await entered;
 const target=join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(s.options.epoch))+'.import.json.stop'),open=fs.openSync;
 try{fs.openSync=function(p,...args){if(p===target){const e=Error('SYNTHETIC_STOP_IO');e.code='EIO';throw e;}return open(p,...args);};syncBuiltinESMExports();assert.throws(()=>s.adapter.stop(),/^Error: TRIAL_STOPPED$/);}finally{fs.openSync=open;syncBuiltinESMExports();}
 release();await assert.rejects(creating,/TRIAL_STOPPED/);assert.equal(s.calls.length,0);assert.equal(s.adapter.status(),'stopped');await assert.rejects(s.adapter.create(),/TRIAL_STOPPED/);
});

test('ordinary import IO enters the pinned atomic capability',async()=>{
 let entered=0;const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},externalRead:async io=>{entered++;return await io();},unused:undefined}});
 await s.adapter.create();assert.equal(entered,2);
});

test('missing atomic capability denies import before IO',()=>{
 const s=setup();assert.throws(()=>mod.createAuthorityTrialImport({...s.options,control:{...s.options.control,externalRead:undefined}}),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.length,0);assert.equal(s.spent(),0);
});

for(const kind of ['oversized','rejected-status']) test('import '+kind+' body cancellation remains owned until settled',async()=>{
 let owned=false,cancelStarted=false,cancelSettled=false,release;const gate=new Promise(r=>{release=r;});
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},cleanup:async()=>{},restoreOriginalEditor:async()=>{},externalRead:async io=>{owned=true;try{return await io();}finally{owned=false;}}};
 const fetcher=async()=>new Response(new ReadableStream({start(c){if(kind==='oversized')c.enqueue(new Uint8Array(4096+1));},cancel(){cancelStarted=true;return gate.then(()=>{cancelSettled=true;});}}),{status:kind==='rejected-status'?503:200});
 const s=setup({control,fetcher});
 const pending=s.adapter.create();void pending.catch(()=>{});await new Promise(r=>setImmediate(r));
 try{assert.equal(cancelStarted,true);assert.equal(cancelSettled,false);assert.equal(owned,true);}finally{release();await assert.rejects(pending,/TRIAL_STOPPED/);}
 assert.equal(owned,false);assert.equal(cancelSettled,true);
});
