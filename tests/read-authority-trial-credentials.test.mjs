import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,chmodSync,symlinkSync,statSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {SIMPLE_DECISION} from '../scripts/read-authority-simple-plan.mjs';
const api=await import('../scripts/read-authority-trial-credentials.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-trial-credentials.mjs'))return {};throw e;});
const hash=v=>createHash('sha256').update(v).digest('hex');
const decisionHash='5bd83ace54d7af801880798be3460ed9b6f8c8b053b447459e7956b127ff4c72',clock=Date.parse('2026-10-15T00:00:00Z');
const publisherHash=hash('publisher@example.invalid'),callerHash=hash('caller@example.invalid'),oauthClientHash='c'.repeat(64);
const managementScopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
const callerScopes=['spreadsheets.readonly','userinfo.email','script.external_request'].map(s=>'https://www.googleapis.com/auth/'+s);
const userUrl='https://www.googleapis.com/oauth2/v2/userinfo?fields=email%2Cverified_email',tokenUrl='https://oauth2.googleapis.com/token';
const token=()=>({access_token:'SYNTHETIC_RENEWED_TOKEN',token_type:'Bearer',expires_in:3920,scope:managementScopes.join(' ')});
const profile=()=>({tokens:{default:{access_token:'SYNTHETIC_EXPIRED_TOKEN',refresh_token:'SYNTHETIC_EXISTING_GRANT',client_id:'123-synthetic.apps.googleusercontent.com',client_secret:'SYNTHETIC_CLIENT_SECRET',token_type:'Bearer',expiry_date:clock-1000,id_token:'SYNTHETIC_UNTRUSTED_ID_TOKEN'}}});
function setup(patch={}){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-credential-'));chmodSync(dir,0o700);const path=join(dir,'profile.json'),raw=JSON.stringify(profile());writeFileSync(path,raw,{mode:0o600});
 let time=clock;const calls=[],charges=[],events=[];
 const control={decisionHash,externalRead:async(io,label)=>{charges.push(label);events.push('debit');return await io();}};
 const options={source:{path,sha256:hash(raw)},publisherHash,decisionHash,expiresAt:clock+7200000,now:()=>time,
  fetcher:async(url,init)=>{calls.push({url,init});events.push('fetch');return new Response(JSON.stringify(url===tokenUrl?token():{email:'publisher@example.invalid',verified_email:true}));},...patch};
 assert.equal(typeof api.createAuthorityPublisherCredentials,'function');const holder=api.createAuthorityPublisherCredentials(options);
 return {holder,options,control,calls,charges,events,raw,path,setNow:t=>{time=t;}};
}
test('publisher refresh and identity are explicit, paid once, and expose only a verified memory credential',async()=>{
 const s=setup(),before=statSync(s.path);assert.equal(s.calls.length,0);assert.throws(()=>s.holder.credential(),/TRIAL_STOPPED/);
 await s.holder.refresh(s.control);assert.throws(()=>s.holder.credential(),/TRIAL_STOPPED/);await s.holder.verify(s.control);
 assert.deepEqual(s.charges,['P:publisher-refresh','P:publisher-userinfo']);assert.deepEqual(s.events,['debit','fetch','debit','fetch']);
 const [exchange,user]=s.calls,form=new URLSearchParams(exchange.init.body);
 assert.equal(exchange.url,tokenUrl);assert.equal(exchange.init.method,'POST');assert.equal(exchange.init.redirect,'manual');
 assert.deepEqual(Object.fromEntries(form),{grant_type:'refresh_token',client_id:'123-synthetic.apps.googleusercontent.com',client_secret:'SYNTHETIC_CLIENT_SECRET',refresh_token:'SYNTHETIC_EXISTING_GRANT'});
 assert.equal(user.url,userUrl);assert.equal(user.init.method,'GET');assert.equal(user.init.headers.authorization,'Bearer SYNTHETIC_RENEWED_TOKEN');
 const c=s.holder.credential();assert.equal(c.accessToken,'SYNTHETIC_RENEWED_TOKEN');assert.equal(c.accountHash,publisherHash);assert.deepEqual([...c.scopes].sort(),[...managementScopes].sort());assert.equal(c.expiresAt,clock+3920000);assert.equal(c.refreshTokenPresent,true);assert(Object.isFrozen(c)&&Object.isFrozen(c.scopes));
 for(let i=0;i<3;i++)s.holder.credential();assert.equal(s.calls.length,2);assert.equal(readFileSync(s.path,'utf8'),s.raw);assert.equal(statSync(s.path).mtimeMs,before.mtimeMs);
 await assert.rejects(s.holder.refresh(s.control),/TRIAL_STOPPED/);await assert.rejects(s.holder.verify(s.control),/TRIAL_STOPPED/);assert.equal(s.calls.length,2);
 await s.holder.stopAndDrain();assert.throws(()=>s.holder.credential(),/TRIAL_STOPPED/);assert.equal(s.calls.length,2);
});
test('SIMPLE publisher holder pays and performs one actual refresh and same-token identity read',async()=>{
 const s=setup({decisionHash:SIMPLE_DECISION}),oldControl=s.control;
 const simpleControl={...oldControl,decisionHash:SIMPLE_DECISION};
 await assert.rejects(s.holder.refresh(oldControl),/TRIAL_STOPPED/);
 assert.deepEqual(s.events,[]);
 await s.holder.refresh(simpleControl);
 await assert.rejects(s.holder.verify(oldControl),/TRIAL_STOPPED/);
 assert.deepEqual(s.events,['debit','fetch']);
 await s.holder.verify(simpleControl);
 assert.deepEqual(s.charges,['P:publisher-refresh','P:publisher-userinfo']);
 assert.deepEqual(s.events,['debit','fetch','debit','fetch']);
 assert.deepEqual(s.calls.map(c=>[c.url,c.init.method]),[[tokenUrl,'POST'],[userUrl,'GET']]);
 assert.equal(s.calls[1].init.headers.authorization,'Bearer SYNTHETIC_RENEWED_TOKEN');
 assert.equal(s.holder.credential().accountHash,publisherHash);
});
for(const [name,change] of [
 ['missing scopes',v=>{delete v.scope;}],['broader scopes',v=>{v.scope+=' https://www.googleapis.com/auth/drive';}],['duplicate scopes',v=>{v.scope+=' '+managementScopes[0];}],
 ['short expiry',v=>{v.expires_in=360;}],['epoch overflow',v=>{v.expires_in=10000;}],['unknown field',v=>{v.refresh_token='SYNTHETIC_ROTATED_GRANT';}],['wrong type',v=>{v.token_type='MAC';}]
])test('publisher rejects '+name+' without identity or renewal retry',async()=>{
 const s=setup({fetcher:async()=>{const v=token();change(v);return new Response(JSON.stringify(v));}});await assert.rejects(s.holder.refresh(s.control),/^Error: TRIAL_STOPPED$/);await assert.rejects(s.holder.refresh(s.control),/TRIAL_STOPPED/);await assert.rejects(s.holder.verify(s.control),/TRIAL_STOPPED/);assert.deepEqual(s.charges,['P:publisher-refresh']);assert.throws(()=>s.holder.credential(),/TRIAL_STOPPED/);
});
for(const [name,response] of [['failed',()=>new Response('SYNTHETIC_PRIVATE_PROVIDER',{status:503})],['oversize',()=>new Response('x'.repeat(30001))],['bad UTF8',()=>new Response(new Uint8Array([255]))],['bad JSON',()=>new Response('SYNTHETIC_PRIVATE_PROVIDER')],['redirect',()=>({status:200,redirected:true,body:new ReadableStream({start(c){c.close();}})})]])test('publisher '+name+' response is consumed and sanitized',async()=>{
 const s=setup({fetcher:async()=>response()});await assert.rejects(s.holder.refresh(s.control),/^Error: TRIAL_STOPPED$/);assert.equal(s.charges.length,1);await assert.rejects(s.holder.refresh(s.control),/TRIAL_STOPPED/);assert.equal(s.charges.length,1);
});
for(const user of [{email:'caller@example.invalid',verified_email:true},{email:'publisher@example.invalid',verified_email:false},{email:'publisher@example.invalid',verified_email:true,id:'UNKNOWN'}])test('publisher does not expose a token after wrong/unverified/unknown identity',async()=>{
 const s=setup({fetcher:async url=>new Response(JSON.stringify(url===tokenUrl?token():user))});await s.holder.refresh(s.control);await assert.rejects(s.holder.verify(s.control),/TRIAL_STOPPED/);assert.equal(s.charges.length,2);assert.throws(()=>s.holder.credential(),/TRIAL_STOPPED/);await assert.rejects(s.holder.verify(s.control),/TRIAL_STOPPED/);assert.equal(s.charges.length,2);
});
test('source hash, permissions and symlink drift stop before network under paid refresh',async()=>{
 for(const mutate of [s=>writeFileSync(s.path,JSON.stringify(profile())+' '),s=>chmodSync(s.path,0o644),s=>{const other=s.path+'.original';renameSync(s.path,other);symlinkSync(other,s.path);}]){
  const s=setup();mutate(s);await assert.rejects(s.holder.refresh(s.control),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);
 }
});
test('source options are snapshotted and cannot redirect the holder to another grant',async()=>{
 const s=setup();s.options.source.path+='.missing';await s.holder.refresh(s.control);await s.holder.verify(s.control);assert.equal(s.holder.credential().accountHash,publisherHash);
});
test('stop drains an entered refresh, suppresses identity and never revokes the original publisher grant',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async()=>{enter();await new Promise(r=>{release=r;});return new Response(JSON.stringify(token()));}});
 const work=s.holder.refresh(s.control);await entered;let settled=false;const drain=s.holder.stopAndDrain().then(v=>{settled=true;return v;});await new Promise(r=>setImmediate(r));assert.equal(settled,false);release();await assert.rejects(work,/TRIAL_STOPPED/);const receipt=await drain;assert.equal(receipt.remoteExecutionSettled,false);assert.equal(receipt.rollbackComplete,false);await assert.rejects(s.holder.verify(s.control),/TRIAL_STOPPED/);assert.deepEqual(s.charges,['P:publisher-refresh']);
});
test('concurrent refresh cannot enter twice and post-admission expiry suppresses provider IO',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;}),s=setup();s.control.externalRead=async(io,label)=>{s.charges.push(label);enter();await new Promise(r=>{release=r;});return io();};
 const first=s.holder.refresh(s.control);await entered;await assert.rejects(s.holder.refresh(s.control),/TRIAL_STOPPED/);s.setNow(clock+7200000);release();await assert.rejects(first,/TRIAL_STOPPED/);assert.equal(s.calls.length,0);assert.equal(s.charges.length,1);
});
test('publisher refuses missing or historical capability selector before refresh or identity IO',async()=>{
 for(const selector of [undefined,'0'.repeat(64)]){
  const s=setup(),wrong={...s.control,decisionHash:selector};await assert.rejects(s.holder.refresh(wrong),/TRIAL_STOPPED/);assert.equal(s.charges.length,0);assert.equal(s.calls.length,0);
  await s.holder.refresh(s.control);await assert.rejects(s.holder.verify(wrong),/TRIAL_STOPPED/);assert.equal(s.charges.length,1);assert.equal(s.calls.length,1);
 }
});
function native(patch={}){
 let time=clock;const calls=[],charges=[];
 const credentials={caller:{accessToken:'SYNTHETIC_CALLER',scopes:callerScopes,expiresAt:clock+3600000,refreshTokenPresent:false,callerHash,oauthClientHash},publisher:{accessToken:'SYNTHETIC_PUBLISHER',scopes:managementScopes,expiresAt:clock+3920000,refreshTokenPresent:true,accountHash:publisherHash}};
 const options={callerHash,publisherHash,oauthClientHash,decisionHash,expiresAt:clock+7200000,callerCredential:()=>credentials.caller,publisherCredential:()=>credentials.publisher,now:()=>time,fetcher:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({email:(init.headers.authorization==='Bearer SYNTHETIC_CALLER'?'caller':'publisher')+'@example.invalid',verified_email:true}));},...patch};
 assert.equal(typeof api.createAuthorityNativeIdentity,'function');const identity=api.createAuthorityNativeIdentity(options);
 const cap=phase=>({phase,decisionHash,externalRead:async(io,charge)=>{charges.push(charge);return io();}});
 return {identity,options,credentials,calls,charges,cap,setNow:t=>{time=t;}};
}
test('SIMPLE native holder reads caller and publisher in distinct paid before and after windows',async()=>{
 const publisher=setup({decisionHash:SIMPLE_DECISION}),publisherControl={...publisher.control,decisionHash:SIMPLE_DECISION};
 await publisher.holder.refresh(publisherControl);await publisher.holder.verify(publisherControl);
 const s=native({decisionHash:SIMPLE_DECISION,publisherCredential:()=>publisher.holder.credential()});
 for(const phase of ['wrapper-before','wrapper-after'])for(const actor of ['caller','publisher']){
  const control={...s.cap(phase),decisionHash:SIMPLE_DECISION};
  const proof=await s.identity.read(actor,control);
  assert.equal(proof.actor,actor);assert.equal(proof.phase,phase);
  assert.equal(proof.accountHash,actor==='caller'?callerHash:publisherHash);
 }
 assert.deepEqual(s.charges,[{actor:'caller',category:'identityReads'},{actor:'publisher',category:'identityReads'},{actor:'caller',category:'identityReads'},{actor:'publisher',category:'identityReads'}]);
 assert.equal(s.calls.length,4);
 assert.deepEqual(s.calls.map(c=>c.init.headers.authorization),['Bearer SYNTHETIC_CALLER','Bearer SYNTHETIC_RENEWED_TOKEN','Bearer SYNTHETIC_CALLER','Bearer SYNTHETIC_RENEWED_TOKEN']);
});
test('SIMPLE native holder rejects mismatched control, actor, scopes and stale expiry before callback',async()=>{
 const s=native({decisionHash:SIMPLE_DECISION});
 await assert.rejects(s.identity.read('caller',s.cap('wrapper-before')),/TRIAL_STOPPED/);
 assert.equal(s.calls.length,0);assert.equal(s.charges.length,0);
 await assert.rejects(s.identity.read('other',{...s.cap('wrapper-before'),decisionHash:SIMPLE_DECISION}),/TRIAL_STOPPED/);
 assert.equal(s.calls.length,0);
 for(const patch of [v=>{v.scopes=managementScopes;},v=>{v.expiresAt=clock+360000;}]){
  const next=native({decisionHash:SIMPLE_DECISION});patch(next.credentials.caller);
  await assert.rejects(next.identity.read('caller',{...next.cap('wrapper-before'),decisionHash:SIMPLE_DECISION}),/TRIAL_STOPPED/);
  assert.equal(next.calls.length,0);assert.equal(next.charges.length,0);
 }
});
test('four G windows each obtain a fresh same-token identity under their own actor admission',async()=>{
 const s=native();for(const phase of ['wrapper-before','wrapper-after'])for(const actor of ['caller','publisher']){
  const proof=await s.identity.read(actor,s.cap(phase));assert.equal(proof.actor,actor);assert.equal(proof.phase,phase);assert.equal(proof.accountHash,actor==='caller'?callerHash:publisherHash);assert.equal(proof.complete,false);assert.equal(proof.trialAccepted,false);assert(Object.isFrozen(proof));
 }
 assert.equal(s.calls.length,4);assert.deepEqual(s.charges,[{actor:'caller',category:'identityReads'},{actor:'publisher',category:'identityReads'},{actor:'caller',category:'identityReads'},{actor:'publisher',category:'identityReads'}]);
 assert(s.calls.every(c=>c.url===userUrl&&c.init.method==='GET'&&c.init.redirect==='manual'));
 await assert.rejects(s.identity.read('caller',s.cap('wrapper-before')),/TRIAL_STOPPED/);assert.equal(s.calls.length,4);
});
test('G denies old policy, wrong actor phase and caller refresh before IO',async()=>{
 for(const mutate of [s=>{s.credentials.caller.refreshTokenPresent=true;},s=>{s.credentials.caller.callerHash=publisherHash;},s=>{s.credentials.caller.scopes=managementScopes;}]){const s=native();mutate(s);await assert.rejects(s.identity.read('caller',s.cap('wrapper-before')),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);}
 for(const cap of [{phase:'wrapper-before',decisionHash:'0'.repeat(64),externalRead:async io=>io()},{phase:'qualified-before',decisionHash,externalRead:async io=>io()}]){const s=native();await assert.rejects(s.identity.read('caller',cap),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);}
 assert.throws(()=>native({decisionHash:'0'.repeat(64)}),/TRIAL_STOPPED/);
});
test('G snapshots the exact token before admission and never substitutes later caller state',async()=>{
 const s=native(),cap=s.cap('wrapper-before');cap.externalRead=async(io,charge)=>{s.charges.push(charge);s.credentials.caller.accessToken='SYNTHETIC_CHANGED';return io();};await s.identity.read('caller',cap);assert.equal(s.calls[0].init.headers.authorization,'Bearer SYNTHETIC_CALLER');
});
test('failed G identity is charged once, cannot become full native proof or be retried',async()=>{
 const s=native({fetcher:async()=>new Response(JSON.stringify({email:'publisher@example.invalid',verified_email:true}))});await assert.rejects(s.identity.read('caller',s.cap('wrapper-before')),/^Error: TRIAL_STOPPED$/);assert.equal(s.charges.length,1);await assert.rejects(s.identity.read('caller',s.cap('wrapper-before')),/TRIAL_STOPPED/);assert.equal(s.charges.length,1);
});
test('G post-admission expiry and asynchronous credential never enter Google',async()=>{
 const s=native(),cap=s.cap('wrapper-before');cap.externalRead=async io=>{s.setNow(clock+3600000);return io();};await assert.rejects(s.identity.read('caller',cap),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);
 const a=native({callerCredential:async()=>{throw Error('SYNTHETIC_PRIVATE');}});await assert.rejects(a.identity.read('caller',a.cap('wrapper-before')),/^Error: TRIAL_STOPPED$/);assert.equal(a.calls.length,0);
});
test('G stop owns the entire response body until drain and emits no post-stop identity proof',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;}),s=native({fetcher:async()=>new Response(new ReadableStream({async start(c){enter();await new Promise(r=>{release=r;});c.enqueue(new TextEncoder().encode(JSON.stringify({email:'caller@example.invalid',verified_email:true})));c.close();}}))});
 const work=s.identity.read('caller',s.cap('wrapper-before'));await entered;let drained=false;const stop=s.identity.stopAndDrain().then(v=>{drained=true;return v;});await new Promise(r=>setImmediate(r));assert.equal(drained,false);release();await assert.rejects(work,/TRIAL_STOPPED/);assert.equal((await stop).ownedIOSettled,true);assert.equal(s.charges.length,1);await assert.rejects(s.identity.read('publisher',s.cap('wrapper-before')),/TRIAL_STOPPED/);assert.equal(s.charges.length,1);
});
test('publisher policy and epoch validation happens without reading or renewing the local grant',()=>{
 for(const patch of [{decisionHash:'0'.repeat(64)},{publisherHash:'NOT_A_HASH'},{expiresAt:clock+360000},{expiresAt:clock+21600001}])assert.throws(()=>setup(patch),/TRIAL_STOPPED/);
});
