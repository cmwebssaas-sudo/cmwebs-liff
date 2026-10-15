import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,readFileSync,lstatSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import * as mod from '../scripts/read-authority-trial-reader.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-16T00:00:00Z');
const callerEmail='caller@example.invalid',publisherEmail='publisher@example.invalid',callerHash=hash(callerEmail),publisherHash=hash(publisherEmail),sourceHash='f'.repeat(64);
const scriptId='SYNTHETIC_STANDALONE_SCRIPT_ID',originalScriptId='SYNTHETIC_FORMAL_SCRIPT_ID',callerPermissionId='00001234567890123456789',ownerId='SYNTHETIC_OWNER_ID';
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
const owner=()=>({id:ownerId,type:'user',role:'owner',emailAddress:publisherEmail}),reader=()=>({kind:'drive#permission',id:callerPermissionId,type:'user',role:'reader',emailAddress:callerEmail});
const epochs=new Set();
const registry=epoch=>join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(epoch))+'.script-reader.json');
test.after(()=>{for(const epoch of epochs)for(const p of [registry(epoch),registry(epoch)+'.stop'])try{const s=lstatSync(p),v=JSON.parse(readFileSync(p)).value;if(s.isFile()&&!s.isSymbolicLink()&&v.path.startsWith(join(tmpdir(),'cmwebs-script-reader-')))unlinkSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}});
function setup(patch={}){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-script-reader-'));chmodSync(dir,0o700);const epoch='SYNTHETIC_SCRIPT_READER_'+randomUUID(),calls=[],charges=[],cleanup=[];let now=clock,hasReader=false;
 const options={path:join(dir,'receipt.json'),epoch,scriptId,originalScriptId,callerEmail,callerHash,publisherHash,callerPermissionId,expiresAt:clock+21600000,
  backupReceipt:{source:'fixed-trial-thin-empty-backup',epoch,scriptId,publisherHash,sourceHash},
  control:{externalRead:async(io,charge)=>{charges.push(charge);return await io();},cleanup:async(action,io)=>{cleanup.push(action);return await io();}},now:()=>now,
  credential:()=>({accessToken:'SYNTHETIC_MANAGEMENT_TOKEN',accountHash:publisherHash,scopes,expiresAt:now+3600000,refreshTokenPresent:true}),
  fetcher:async(url,init)=>{calls.push({url,init});if(init.method==='POST'){hasReader=true;return new Response(JSON.stringify(reader()));}if(init.method==='DELETE'){hasReader=false;return new Response(null,{status:204});}return new Response(JSON.stringify({permissions:hasReader?[owner(),reader()]:[owner()]}));},...patch};
 epochs.add(epoch);assert.equal(typeof mod.createAuthorityStandaloneScriptReader,'function');const adapter=mod.createAuthorityStandaloneScriptReader(options);
 return {options,adapter,calls,charges,cleanup,setNow:v=>{now=v;},setReader:v=>{hasReader=v;},journal:()=>JSON.parse(readFileSync(options.path)).value};
}
test('constructor is network inert and grant is exactly baseline GET then ACK-only POST',async()=>{
 const s=setup();assert.equal(s.calls.length,0);assert.deepEqual(s.charges,[]);assert.equal(s.adapter.status(),'ready');
 assert.deepEqual(await s.adapter.grant(),{grantAcknowledged:true,readerVerified:false,permissionHash:hash(callerPermissionId)});
 assert.deepEqual(s.charges,['D:standalone-acl-baseline','D:standalone-reader-create']);assert.deepEqual(s.calls.map(c=>c.init.method),['GET','POST']);
 for(const c of s.calls){const u=new URL(c.url);assert.equal(u.origin+u.pathname,'https://www.googleapis.com/drive/v3/files/'+scriptId+'/permissions');assert.equal(c.init.redirect,'manual');assert.equal(c.init.headers.authorization,'Bearer SYNTHETIC_MANAGEMENT_TOKEN');assert.equal(c.init.headers['cache-control'],'no-cache, no-store');assert(c.init.signal instanceof AbortSignal);}
 const u=new URL(s.calls[1].url);assert.equal(u.searchParams.get('sendNotificationEmail'),'false');assert(!u.searchParams.has('transferOwnership'));assert(!u.searchParams.has('useDomainAdminAccess'));assert.deepEqual(JSON.parse(s.calls[1].init.body),{type:'user',role:'reader',emailAddress:callerEmail});
 assert.equal(s.journal().mode,'standalone-script');assert.equal(s.journal().scriptId,scriptId);assert.equal(s.journal().originalScriptId,originalScriptId);assert.equal(s.journal().state,'grant-acknowledged');assert.equal(s.journal().grantOutcome,'ACK_MATCHED');
 const durable=readFileSync(s.options.path,'utf8');assert(!durable.includes(callerEmail));assert(!durable.includes('SYNTHETIC_MANAGEMENT_TOKEN'));await assert.rejects(s.adapter.grant(),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.length,2);
});
test('grant records durable UNKNOWN and fixed target before dispatch',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST'){assert.equal(s.journal().grantOutcome,'UNKNOWN');assert.equal(s.journal().grantAttempted,true);assert.equal(s.journal().permissionId,callerPermissionId);assert.equal(s.journal().ownerId,ownerId);return new Response(JSON.stringify(reader()));}return new Response(JSON.stringify({permissions:[owner()]}));}});await s.adapter.grant();
});
test('independent cleanup after expiry uses fixed DELETE and separate absence GET',async()=>{
 const s=setup();await s.adapter.grant();s.setNow(clock+21600001);assert.deepEqual(await s.adapter.remove(),{removeAcknowledged:true,rollbackComplete:false});assert.deepEqual(await s.adapter.verifyRemoved(),{readerAbsentAtReadback:true,grantOutcomeKnown:true,rollbackComplete:false});
 assert.deepEqual(s.cleanup,['script-remove','script-verify']);assert.deepEqual(s.calls.map(c=>c.init.method),['GET','POST','DELETE','GET']);assert.equal(new URL(s.calls[2].url).pathname,'/drive/v3/files/'+scriptId+'/permissions/'+callerPermissionId);await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);await assert.rejects(s.adapter.verifyRemoved(),/TRIAL_STOPPED/);assert.equal(s.calls.length,4);
});
for(const [name,permissions] of [['reader',[owner(),reader()]],['foreign-owner',[{...owner(),emailAddress:'foreign@example.invalid'}]],['owner-is-caller',[{...owner(),id:callerPermissionId}]],['group',[{...owner(),type:'group'}]],['inherited',[{...owner(),permissionDetails:[{inherited:true,permissionType:'file',role:'owner'}]}]],['empty',[]]])test('baseline '+name+' denies before POST and no-grant cleanup never deletes',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});return new Response(JSON.stringify({permissions}));}});await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);assert.equal(s.calls.length,1);assert.deepEqual(await s.adapter.remove(),{grantNeverDispatched:true});assert.deepEqual(s.cleanup,[]);assert.equal(s.calls.length,1);
});
for(const [name,response] of [['wrong-ID',{...reader(),id:'OTHER'}],['writer',{...reader(),role:'writer'}],['foreign-email',{...reader(),emailAddress:'other@example.invalid'}],['extra',{...reader(),displayName:'PRIVATE'}]])test('grant '+name+' reply preserves UNKNOWN and cleanup target',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST')return new Response(JSON.stringify(response));if(init.method==='DELETE')return new Response(null,{status:204});return new Response(JSON.stringify({permissions:[owner()]}));}});await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);assert.equal(s.journal().grantOutcome,'UNKNOWN');assert.equal(s.journal().permissionId,callerPermissionId);await s.adapter.remove();assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});
test('lost grant reply is never repeated, and absence does not settle UNKNOWN grant',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST')throw Error('PRIVATE_NETWORK');if(init.method==='DELETE')return new Response(null,{status:204});return new Response(JSON.stringify({permissions:[owner()]}));}});await assert.rejects(s.adapter.grant(),/^Error: TRIAL_STOPPED$/);await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);await s.adapter.remove();assert.equal((await s.adapter.verifyRemoved()).grantOutcomeKnown,false);assert.equal(s.journal().grantOutcome,'UNKNOWN');assert.equal(s.calls.filter(c=>c.init.method==='POST').length,1);
});
test('lost delete reply is never retried and absence remains independent',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST')return new Response(JSON.stringify(reader()));if(init.method==='DELETE')throw Error('PRIVATE_DELETE');return new Response(JSON.stringify({permissions:[owner()]}));}});await s.adapter.grant();await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);assert.equal((await s.adapter.verifyRemoved()).readerAbsentAtReadback,true);assert.equal(s.journal().removeOutcome,'UNKNOWN');assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});
for(const [name,patch] of [['same script',{scriptId:originalScriptId}],['wrong caller',{callerHash:'a'.repeat(64)}],['extra metadata',{metadata:{read(){throw Error('FORBIDDEN');}}}],['bad permission ID',{callerPermissionId:'a/b'}],['wrong backup',{backupReceipt:{source:'fixed-trial-import-readback',epoch:'OTHER',scriptId,publisherHash,sourceHash}}]])test('configuration '+name+' fails before IO',()=>{assert.throws(()=>setup(patch),/^Error: TRIAL_STOPPED$/);});
test('strict own data rejects getters without executing them, inherited fields and proxies',()=>{
 const s=setup();let touched=false;const options={...s.options};Object.defineProperty(options,'scriptId',{get(){touched=true;return scriptId;},enumerable:true});assert.throws(()=>mod.createAuthorityStandaloneScriptReader(options),/TRIAL_STOPPED/);assert.equal(touched,false);
 assert.throws(()=>mod.createAuthorityStandaloneScriptReader(Object.create(s.options)),/TRIAL_STOPPED/);assert.throws(()=>mod.createAuthorityStandaloneScriptReader(new Proxy(s.options,{})),/TRIAL_STOPPED/);
 const backup={...s.options.backupReceipt};Object.defineProperty(backup,'sourceHash',{get(){touched=true;return sourceHash;},enumerable:true});assert.throws(()=>mod.createAuthorityStandaloneScriptReader({...s.options,backupReceipt:backup}),/TRIAL_STOPPED/);assert.equal(touched,false);
});
test('restart preserves binding and cannot reset same epoch through other path/resource/source/mode',async()=>{
 const s=setup();await s.adapter.grant();const resumed=mod.createAuthorityStandaloneScriptReader(s.options);await assert.rejects(resumed.grant(),/TRIAL_STOPPED/);
 for(const patch of [{path:join(tmpdir(),'another-script-reader.json')},{scriptId:'SYNTHETIC_OTHER_SCRIPT_ID'},{callerPermissionId:'OTHER_PERMISSION'},{backupReceipt:{...s.options.backupReceipt,sourceHash:'e'.repeat(64)}}])assert.throws(()=>mod.createAuthorityStandaloneScriptReader({...s.options,...patch}),/TRIAL_STOPPED/);
 assert.equal(lstatSync(registry(s.options.epoch)).mode&0o777,0o600);assert.throws(()=>lstatSync(registry(s.options.epoch).replace('.script-reader.json','.reader.json')),e=>e.code==='ENOENT');await resumed.remove();
});
test('missing or wrong-mode journal fails closed after registration and never reinitializes',()=>{
 const s=setup();unlinkSync(s.options.path);assert.throws(()=>mod.createAuthorityStandaloneScriptReader(s.options),/TRIAL_STOPPED/);assert.throws(()=>lstatSync(s.options.path),e=>e.code==='ENOENT');
 const other=setup(),journal=other.journal();journal.mode='sheet';writeFileSync(other.options.path,JSON.stringify({value:journal,sha256:hash(JSON.stringify(journal))}),{mode:0o600});assert.throws(()=>mod.createAuthorityStandaloneScriptReader(other.options),/TRIAL_STOPPED/);
});
test('remove during baseline cancels before POST without deleting an unrelated permission',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});enter();await new Promise(r=>{release=r;});return new Response(JSON.stringify({permissions:[owner()]}));}});
 const g=s.adapter.grant();await entered;const r=s.adapter.remove();release();await assert.rejects(g,/TRIAL_STOPPED/);assert.equal((await r).grantNeverDispatched,true);assert.deepEqual(s.calls.map(c=>c.init.method),['GET']);
});
test('remove during POST drains grant settlement before fixed DELETE',async()=>{
 let enter,release,active=false;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST'){active=true;enter();await new Promise(r=>{release=r;});active=false;return new Response(JSON.stringify(reader()));}if(init.method==='DELETE'){assert.equal(active,false);return new Response(null,{status:204});}return new Response(JSON.stringify({permissions:[owner()]}));}});
 const g=s.adapter.grant();await entered;const r=s.adapter.remove();assert.equal(s.calls.length,2);release();await assert.rejects(g,/TRIAL_STOPPED/);await r;assert.deepEqual(s.calls.map(c=>c.init.method),['GET','POST','DELETE']);
});
test('stale instance cannot overwrite grant or concurrently delete, then reloads cleanup state',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(init.method==='POST'){enter();await new Promise(r=>{release=r;});return new Response(JSON.stringify(reader()));}if(init.method==='DELETE')return new Response(null,{status:204});return new Response(JSON.stringify({permissions:[owner()]}));}}),other=mod.createAuthorityStandaloneScriptReader(s.options);
 const g=s.adapter.grant();await entered;await assert.rejects(other.remove(),/TRIAL_STOPPED/);release();await assert.rejects(g,/TRIAL_STOPPED/);await other.remove();assert.equal((await s.adapter.verifyRemoved()).readerAbsentAtReadback,true);assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});
test('cleanup admission before callback does not consume a removal attempt',async()=>{
 let first=true;const s=setup({control:{externalRead:async io=>io(),cleanup:async(action,io)=>{if(first){first=false;throw Error('PRIVATE_BUSY');}return io();}}});await s.adapter.grant();await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);assert.equal(s.journal().removeAttempted,false);await s.adapter.remove();assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,1);
});
for(const [name,patch] of [['wrong publisher',{accountHash:callerHash}],['expanded scope',{scopes:[...scopes,'https://www.googleapis.com/auth/drive']}],['expired',{expiresAt:clock}],['promise',null]])test('credential '+name+' denies grant before baseline request',async()=>{
 const s=setup({credential:()=>patch===null?Promise.resolve({}):{accessToken:'SYNTHETIC_TOKEN',accountHash:publisherHash,scopes,expiresAt:clock+3600000,refreshTokenPresent:true,...patch}});await assert.rejects(s.adapter.grant(),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);assert.equal((await s.adapter.remove()).grantNeverDispatched,true);
});
test('pins original control methods against mutable input replacement',async()=>{
 const s=setup(),original=s.options.control;s.options.control.externalRead=()=>{throw Error('REPLACED');};s.options.control.cleanup=()=>{throw Error('REPLACED');};await s.adapter.grant();await s.adapter.remove();assert.equal(s.calls.length,3);assert.equal(original,s.options.control);
});
test('receipt key order is canonical and remains restart-equivalent',()=>{
 const s=setup(),r=s.options.backupReceipt;assert.equal(mod.createAuthorityStandaloneScriptReader({...s.options,backupReceipt:{sourceHash:r.sourceHash,publisherHash:r.publisherHash,scriptId:r.scriptId,epoch:r.epoch,source:r.source}}).status(),'ready');
});
test('rejects proxied control without invoking proxy traps',()=>{
 const s=setup();let touched=false;const control=new Proxy(s.options.control,{ownKeys(){touched=true;return [];}});assert.throws(()=>mod.createAuthorityStandaloneScriptReader({...s.options,control}),/TRIAL_STOPPED/);assert.equal(touched,false);
});
test('invalid clock cannot admit cleanup with a supposedly live credential',async()=>{
 const s=setup({credential:()=>({accessToken:'SYNTHETIC_FIXED_TOKEN',accountHash:publisherHash,scopes,expiresAt:clock+3600000,refreshTokenPresent:true})});await s.adapter.grant();s.setNow(NaN);await assert.rejects(s.adapter.remove(),/TRIAL_STOPPED/);assert.equal(s.calls.filter(c=>c.init.method==='DELETE').length,0);assert.equal(s.journal().removeOutcome,'UNKNOWN');
});
test('credential object scope elements never execute coercion or JSON hooks',async()=>{
 let hooks=0;const objectScopes=scopes.map(scope=>({toString(){hooks++;return scope;},toJSON(){hooks++;return scope;}}));
 const s=setup({credential:()=>({accessToken:'SYNTHETIC_TOKEN',accountHash:publisherHash,scopes:objectScopes,expiresAt:clock+3600000,refreshTokenPresent:true})});
 let denied=false;try{await s.adapter.grant();}catch(error){assert.match(error.message,/^TRIAL_STOPPED$/);denied=true;}
 assert.deepEqual({denied,hooks,requests:s.calls.length},{denied:true,hooks:0,requests:0});
});
