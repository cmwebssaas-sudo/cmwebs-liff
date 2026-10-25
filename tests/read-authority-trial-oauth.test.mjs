import fs from 'node:fs';
import {atomicFixtureControl} from './fixtures/read-authority/atomic-control.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,readFileSync,lstatSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import os,{tmpdir} from 'node:os';
import {syncBuiltinESMExports} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import http,{createServer} from 'node:http';
const canonicalOAuth=await import('../scripts/read-authority-trial-oauth.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-trial-oauth.mjs'))return {};throw e;});
// Constructor-only synthetic registry seam; actual HOME/CODEX_HOME stay unchanged.
const fixtureHome=mkdtempSync(join(tmpdir(),'cmwebs-oauth-home-'));chmodSync(fixtureHome,0o700);
const oauth={...canonicalOAuth,createAuthorityTrialOAuth:input=>{
 const original=os.homedir;try{os.homedir=()=>fixtureHome;syncBuiltinESMExports();return canonicalOAuth.createAuthorityTrialOAuth(input);}
 finally{os.homedir=original;syncBuiltinESMExports();}
}};
const digest=v=>createHash('sha256').update(v).digest('hex');
const clock=Date.parse('2026-10-14T00:00:00Z'),clientId='1234567890-synthetic.apps.googleusercontent.com',email='caller@example.invalid';
const scopes=['https://www.googleapis.com/auth/spreadsheets.readonly','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/script.external_request'];
const redirect='http://127.0.0.1:34763/oauth/callback',cloudProjectHash='c'.repeat(64),publisherHash=digest('publisher@example.invalid'),callerHash=digest(email);
const epochs=new Set();
test.after(()=>{for(const epoch of epochs){const p=join(fixtureHome,'.codex','private','cmwebs-authority-trials',digest(JSON.stringify(epoch))+'.oauth.json');try{const stat=lstatSync(p),v=JSON.parse(readFileSync(p)).value;if(stat.isFile()&&!stat.isSymbolicLink()&&v.path.startsWith(join(tmpdir(),'cmwebs-oauth-')))unlinkSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}}});
const token=()=>({access_token:'SYNTHETIC_ACCESS_TOKEN',expires_in:3600,token_type:'Bearer',scope:scopes.join(' ')});
function setup(patch={}){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-oauth-'));chmodSync(dir,0o700);let spent=0,now=clock,cleanups=0;const calls=[],order=[];
 const control={waitForExternalReadSlot:async n=>{assert.equal(n,1);order.push('wait');},reserveExternalReads:async n=>{assert.equal(n,1);spent++;order.push('debit');},cleanup:async(name,io)=>{assert.equal(name,'revoke-token');cleanups++;return await io();}};
 const options={path:join(dir,'receipt.json'),epoch:'SYNTHETIC_OAUTH_'+randomUUID(),clientId,oauthClientHash:digest(clientId),cloudProjectHash,callerHash,publisherHash,expiresAt:clock+7200000,
  clientReadback:{source:'google-native-ui',oauthClientHash:digest(clientId),cloudProjectHash,redirectUri:redirect,isolatedTrialProject:true},
  control,now:()=>now,clientSecret:()=>{order.push('secret');return 'SYNTHETIC_CLIENT_SECRET';},
  fetcher:async(url,init)=>{calls.push({url,init});order.push('fetch');if(url==='https://oauth2.googleapis.com/token')return new Response(JSON.stringify(token()));if(url.startsWith('https://www.googleapis.com/oauth2/v2/userinfo'))return new Response(JSON.stringify({email,verified_email:true}));if(url==='https://oauth2.googleapis.com/revoke')return new Response('');throw Error('UNEXPECTED_DESTINATION');},...patch};
 epochs.add(options.epoch);assert.equal(typeof oauth.createAuthorityTrialOAuth,'function');options.control=atomicFixtureControl(options.control);const flow=oauth.createAuthorityTrialOAuth(options);
 const request=(extra={})=>({method:'GET',host:'127.0.0.1:34763',url:'/oauth/callback?'+new URLSearchParams({state:new URL(flow.authorizationUrl).searchParams.get('state'),code:'SYNTHETIC_CODE',...extra}).toString()});
 return {options,flow,request,calls,order,submit:()=>flow.submitConsent(async()=>{order.push('submit');}),spent:()=>spent,cleanups:()=>cleanups,setNow:v=>{now=v;}};
}
test('authorization request pins online three scopes, exact loopback, high entropy state and S256',()=>{
 const s=setup(),u=new URL(s.flow.authorizationUrl),q=u.searchParams;
 assert.equal(u.origin+u.pathname,'https://accounts.google.com/o/oauth2/v2/auth');assert.equal(q.get('client_id'),clientId);assert.equal(q.get('redirect_uri'),redirect);assert.equal(q.get('access_type'),'online');assert.equal(q.get('include_granted_scopes'),'false');assert.equal(q.get('response_type'),'code');assert.equal(q.get('code_challenge_method'),'S256');assert.match(q.get('code_challenge'),/^[\w-]{43}$/);assert.match(q.get('state'),/^[\w-]{43}$/);assert.deepEqual(q.get('scope').split(' '),scopes);assert.equal(q.has('login_hint'),false);assert.equal(q.has('client_secret'),false);assert.equal(s.spent(),0);assert.equal(s.calls.length,0);
 const stored=readFileSync(s.options.path,'utf8');for(const v of [q.get('state'),'SYNTHETIC_CLIENT_SECRET',clientId])assert(!stored.includes(v));
});
test('one submit and callback debit submission/exchange/identity; keeps raw code and token off durable receipt',async()=>{
 const s=setup();await s.submit();await s.flow.receive(s.request());assert.equal(s.spent(),3);assert.equal(s.calls.length,2);
 const exchange=s.calls[0],form=new URLSearchParams(exchange.init.body),user=s.calls[1];
 assert.equal(exchange.url,'https://oauth2.googleapis.com/token');assert.equal(exchange.init.method,'POST');assert.equal(exchange.init.redirect,'manual');assert.equal(form.get('code'),'SYNTHETIC_CODE');assert.equal(form.get('client_id'),clientId);assert.equal(form.get('client_secret'),'SYNTHETIC_CLIENT_SECRET');assert.equal(form.get('redirect_uri'),redirect);assert.equal(form.get('grant_type'),'authorization_code');assert.match(form.get('code_verifier'),/^[\w-]{64}$/);
 assert.equal(digest(form.get('code_verifier')),Buffer.from(new URL(s.flow.authorizationUrl).searchParams.get('code_challenge'),'base64url').toString('hex'));
 assert.equal(user.url,'https://www.googleapis.com/oauth2/v2/userinfo?fields=email%2Cverified_email');assert.equal(user.init.headers.authorization,'Bearer SYNTHETIC_ACCESS_TOKEN');assert(!user.url.includes('SYNTHETIC_ACCESS_TOKEN'));
 const c=s.flow.credential();assert.equal(c.accessToken,'SYNTHETIC_ACCESS_TOKEN');assert.equal(c.callerHash,callerHash);assert.equal(c.oauthClientHash,digest(clientId));assert.deepEqual(c.scopes,scopes);assert.equal(c.refreshTokenPresent,false);assert.equal(c.expiresAt,clock+3600000);assert(Object.isFrozen(c));
 const receipt=readFileSync(s.options.path,'utf8');for(const v of ['SYNTHETIC_CODE','SYNTHETIC_ACCESS_TOKEN','SYNTHETIC_CLIENT_SECRET',email])assert(!receipt.includes(v));assert.equal(s.cleanups(),0);
 await assert.rejects(s.flow.receive(s.request()),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.length,2);assert.throws(()=>oauth.createAuthorityTrialOAuth(s.options),/TRIAL_STOPPED/);
});
for(const [name,patch] of [['other method',{method:'POST'}],['other host',{host:'localhost:34763'}],['different state',{}],['fragment',{}],['duplicate code',{}]])test('callback '+name+' cannot consume valid state or debit',async()=>{
 const s=setup(),r={...s.request(),...patch};await s.submit();if(name==='different state')r.url=r.url.replace(/state=[^&]+/,'state=wrong');if(name==='fragment')r.url+='#PRIVATE';if(name==='duplicate code')r.url+='&code=OTHER';
 await assert.rejects(s.flow.receive(r),/^Error: TRIAL_STOPPED$/);assert.equal(s.spent(),1);await s.flow.receive(s.request());assert.equal(s.spent(),3);
});
test('same valid state denial or malformed success consumes flow permanently without exchange',async()=>{
 for(const extra of [{error:'access_denied'},{scope:'https://www.googleapis.com/auth/drive'}]){
  const s=setup(),r=s.request(extra);await s.submit();await assert.rejects(s.flow.receive(r),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);
 }
});
test('expired callback denies before exchange and cannot reopen the epoch at another path',async()=>{
 const s=setup();await s.submit();s.setNow(clock+600001);await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-oauth-'));chmodSync(dir,0o700);assert.throws(()=>oauth.createAuthorityTrialOAuth({...s.options,path:join(dir,'other.json')}),/TRIAL_STOPPED/);
});
test('failed consent admission cannot submit or later exchange a callback',async()=>{
 const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{throw Error('PRIVATE_QUOTA');},cleanup:async()=>{throw Error('UNEXPECTED_CLEANUP');}}});await assert.rejects(s.submit(),/^Error: TRIAL_STOPPED$/);await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);await assert.rejects(s.submit(),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);assert(!readFileSync(s.options.path,'utf8').includes('PRIVATE_QUOTA'));
});
for(const [name,response] of [['bad scope',()=>({...token(),scope:scopes.join(' ')+' https://www.googleapis.com/auth/drive'})],['refresh',()=>({...token(),refresh_token:'PRIVATE_REFRESH_NEVER_STORED'})],['too short',()=>({...token(),expires_in:360})],['too long',()=>({...token(),expires_in:3601})],['wrong type',()=>({...token(),token_type:'basic'})]])test('received '+name+' stops locally, then revokes once under independent cleanup reserve',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(url.endsWith('/token'))return new Response(JSON.stringify(response()));if(url.endsWith('/revoke'))return new Response('');throw Error('UNEXPECTED_USERINFO');}});await s.submit();
 await assert.rejects(s.flow.receive(s.request()),/^Error: TRIAL_STOPPED$/);assert.equal(s.cleanups(),0);assert.equal(s.calls.length,1);await s.flow.cancel();assert.equal(s.cleanups(),1);assert.equal(s.calls.length,2);assert.equal(new URLSearchParams(s.calls[1].init.body).get('token'),'SYNTHETIC_ACCESS_TOKEN');assert(!s.calls[1].url.includes('SYNTHETIC_ACCESS_TOKEN'));assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);assert(!readFileSync(s.options.path,'utf8').includes('PRIVATE_REFRESH_NEVER_STORED'));await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.calls.length,2);
});
for(const [name,profile] of [['publisher',{email:'publisher@example.invalid',verified_email:true}],['unverified',{email,verified_email:false}],['wrong caller',{email:'other@example.invalid',verified_email:true}],['extra private field',{email,verified_email:true,id:'PRIVATE_ID'}]])test('identity '+name+' rejects locally and retains received token for explicit cleanup',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});return new Response(url.endsWith('/token')?JSON.stringify(token()):url.endsWith('/revoke')?'':JSON.stringify(profile));}});await s.submit();await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.cleanups(),0);assert.equal(s.calls.length,2);assert.equal(s.flow.status(),'failed');await s.flow.cancel();assert.equal(s.flow.status(),'failed');assert.equal(s.cleanups(),1);assert.equal(s.calls.length,3);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);
});
for(const [name,response] of [['redirect',()=>new Response('',{status:302})],['failure',()=>new Response('PRIVATE',{status:400})],['oversize',()=>new Response('x'.repeat(30001))],['malformed',()=>new Response('PRIVATE')],['non UTF8',()=>new Response(new Uint8Array([255]))]])test('token response '+name+' stops without retry/raw output',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});return response();}});await s.submit();await assert.rejects(s.flow.receive(s.request()),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.length,1);assert.equal(s.spent(),2);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);
});
test('unknown cleanup result preserves failed flow and cannot expose/retry token',async()=>{
 let requests=0;const s=setup({fetcher:async url=>{requests++;return url.endsWith('/token')?new Response(JSON.stringify({...token(),scope:'OTHER'})):new Response('',{status:503});}});await s.submit();await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(requests,1);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);assert.equal(requests,2);
});
test('callback concurrency claims state before awaiting readiness, second callback never exchanges',async()=>{
 let enter,release,waits=0;const entered=new Promise(r=>{enter=r;});const s=setup({control:{waitForExternalReadSlot:async()=>{if(++waits===2){enter();await new Promise(r=>{release=r;});}},reserveExternalReads:async()=>{},cleanup:async()=>{throw Error('UNEXPECTED_CLEANUP');}}});await s.submit();
 const running=s.flow.receive(s.request());await entered;try{await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);}finally{release();}await running;assert.equal(s.calls.length,2);
});
for(const [name,patch] of [['client hash',{oauthClientHash:'e'.repeat(64)}],['same identities',{publisherHash:callerHash}],['wrong project',{clientReadback:{source:'google-native-ui',oauthClientHash:digest(clientId),cloudProjectHash:'e'.repeat(64),redirectUri:redirect,isolatedTrialProject:true}}],['non-isolated',{clientReadback:{source:'google-native-ui',oauthClientHash:digest(clientId),cloudProjectHash,redirectUri:redirect,isolatedTrialProject:false}}]])test('configuration '+name+' refuses before intent/credentials',()=>{
 assert.throws(()=>setup(patch),/TRIAL_STOPPED/);
});
test('real listener binds only fixed loopback and replies without reflecting code/state',async()=>{
 const s=setup();await s.submit();assert.equal(typeof oauth.startAuthorityTrialOAuthListener,'function');const listener=await oauth.startAuthorityTrialOAuthListener(s.flow);
 try{const response=await fetch('http://127.0.0.1:34763'+s.request().url,{redirect:'manual'});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/oauth/result');assert.equal(response.headers.get('cache-control'),'no-store');const result=await fetch('http://127.0.0.1:34763/oauth/result');const html=await result.text();assert(!html.includes('SYNTHETIC_CODE'));assert(!html.includes(new URL(s.flow.authorizationUrl).searchParams.get('state')));assert.equal(s.flow.credential().accessToken,'SYNTHETIC_ACCESS_TOKEN');}finally{await listener.close();}
});
test('early result navigation cannot close a waiting callback listener',async()=>{
 const s=setup(),listener=await oauth.startAuthorityTrialOAuthListener(s.flow);await s.submit();
 try{const early=await fetch('http://127.0.0.1:34763/oauth/result');assert.equal(early.status,404);assert.equal(s.flow.status(),'waiting');const callback=await fetch('http://127.0.0.1:34763'+s.request().url,{redirect:'manual'});assert.equal(callback.status,303);assert.equal(s.flow.credential().callerHash,callerHash);}finally{await listener.close();}
});
test('unreadable exchange result keeps unknown grant status, not NOT_NEEDED revocation',async()=>{
 const s=setup({fetcher:async()=>new Response('PRIVATE_PARTIAL',{status:503})});await s.submit();await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(JSON.parse(readFileSync(s.options.path)).value.revocation,'TOKEN_UNAVAILABLE');
});
test('occupied fixed callback port refuses, closes flow and never tries another port',async()=>{
 const server=createServer((req,res)=>res.end('synthetic'));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(34763,'127.0.0.1',resolve);});
 try{const s=setup();assert.equal(typeof oauth.startAuthorityTrialOAuthListener,'function');await assert.rejects(oauth.startAuthorityTrialOAuthListener(s.flow),/^Error: TRIAL_STOPPED$/);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);}finally{await new Promise(r=>server.close(r));}
});
test('receipt failure after token receipt cannot block the independent revoke attempt',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(url.endsWith('/token')){chmodSync(join(s.options.path,'..'),0o755);return new Response(JSON.stringify(token()));}if(url.endsWith('/revoke'))return new Response('');throw Error('UNEXPECTED_USERINFO');}});await s.submit();
 try{await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.cleanups(),0);await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);assert.equal(s.cleanups(),1);assert.equal(s.calls.filter(c=>c.url.endsWith('/revoke')).length,1);await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);assert.equal(s.cleanups(),1);}finally{chmodSync(join(s.options.path,'..'),0o700);}
});
test('explicit cancellation with damaged receipt still revokes an already ready token once',async()=>{
 const s=setup();await s.submit();await s.flow.receive(s.request());chmodSync(join(s.options.path,'..'),0o755);
 try{await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);assert.equal(s.cleanups(),1);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);}finally{chmodSync(join(s.options.path,'..'),0o700);}
});
test('listener close during claimed wait cancels before exchange and completes after callback settles',async()=>{
 let enter,release,waits=0;const entered=new Promise(r=>{enter=r;});const s=setup({control:{waitForExternalReadSlot:async()=>{if(++waits===2){enter();await new Promise(r=>{release=r;});}},reserveExternalReads:async()=>{},cleanup:async()=>{throw Error('UNEXPECTED_CLEANUP');}}});await s.submit();
 const listener=await oauth.startAuthorityTrialOAuthListener(s.flow),callback=fetch('http://127.0.0.1:34763'+s.request().url,{redirect:'manual'});await entered;
 const closing=listener.close();try{assert.equal(s.flow.status(),'cancelled');}finally{release();}const response=await callback;await closing;assert.equal(response.status,303);assert.equal(s.calls.length,0);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);
});
test('consumed failed callback redirects to generic result without retaining code URL',async()=>{
 const s=setup(),listener=await oauth.startAuthorityTrialOAuthListener(s.flow);await s.submit();
 try{const response=await fetch('http://127.0.0.1:34763'+s.request({error:'access_denied'}).url,{redirect:'manual'});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/oauth/result');const result=await fetch('http://127.0.0.1:34763/oauth/result');assert.equal(result.status,200);assert(!(await result.text()).includes('SYNTHETIC_CODE'));}finally{await listener.close();}
});
test('expired credential cancels locally and leaves independent cleanup available',async()=>{
 const s=setup();await s.submit();await s.flow.receive(s.request());s.setNow(clock+3240000);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);assert.equal(s.flow.status(),'cancelled');assert.equal(s.cleanups(),0);await s.flow.cancel();assert.equal(s.calls.filter(c=>c.url.endsWith('/revoke')).length,1);
});
test('local cancellation during token response retains the late token for explicit cleanup',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(url.endsWith('/token')){enter();await new Promise(r=>{release=r;});return new Response(JSON.stringify(token()));}if(url.endsWith('/revoke'))return new Response('');throw Error('UNEXPECTED_IDENTITY');}});await s.submit();
 const running=s.flow.receive(s.request());await entered;s.flow.requestCancellation();release();await assert.rejects(running,/TRIAL_STOPPED/);assert.equal(s.cleanups(),0);assert.equal(s.calls.length,1);await s.flow.cancel();assert.equal(s.cleanups(),1);assert.equal(s.calls.length,2);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);
});

test('ordinary oauth IO enters the pinned atomic capability',async()=>{
 let entered=0;const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},externalRead:async io=>{entered++;return await io();},cleanup:async(name,io)=>io()}});await s.submit();
 await s.flow.receive(s.request());assert.equal(entered,3);
});

test('missing atomic capability denies oauth before IO',()=>{
 const s=setup();assert.throws(()=>oauth.createAuthorityTrialOAuth({...s.options,epoch:'SYNTHETIC_MISSING_'+randomUUID(),path:join(join(s.options.path,'..'),'missing-atomic-'+randomUUID()+'.json'),control:{...s.options.control,externalRead:undefined}}),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.length,0);assert.equal(s.spent(),0);
});

for(const kind of ['oversized','rejected-status']) test('oauth '+kind+' body cancellation remains owned until settled',async()=>{
 let owned=false,cancelStarted=false,cancelSettled=false,release;const gate=new Promise(r=>{release=r;});
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},cleanup:async()=>{},restoreOriginalEditor:async()=>{},externalRead:async io=>{owned=true;try{return await io();}finally{owned=false;}}};
 const fetcher=async()=>new Response(new ReadableStream({start(c){if(kind==='oversized')c.enqueue(new Uint8Array(30000+1));},cancel(){cancelStarted=true;return gate.then(()=>{cancelSettled=true;});}}),{status:kind==='rejected-status'?503:200});
 const s=setup({control,fetcher});await s.submit();
 const pending=s.flow.receive(s.request());void pending.catch(()=>{});await new Promise(r=>setImmediate(r));
 try{assert.equal(cancelStarted,true);assert.equal(cancelSettled,false);assert.equal(owned,true);}finally{release();await assert.rejects(pending,/TRIAL_STOPPED/);}
 assert.equal(owned,false);assert.equal(cancelSettled,true);
});

test('revocation response cancellation remains inside independent cleanup ownership',async()=>{
 let owned=false,cancelStarted=false,release;const gate=new Promise(r=>{release=r;});
 const control={waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},externalRead:async io=>io(),cleanup:async(name,io)=>{owned=true;try{return await io();}finally{owned=false;}}};
 const fetcher=async url=>url==='https://oauth2.googleapis.com/token'?new Response(JSON.stringify(token())):url.startsWith('https://www.googleapis.com/oauth2/v2/userinfo')?new Response(JSON.stringify({email,verified_email:true})):new Response(new ReadableStream({cancel(){cancelStarted=true;return gate;}}));
 const s=setup({control,fetcher});await s.submit();await s.flow.receive(s.request());const pending=s.flow.cancel();void pending.catch(()=>{});await new Promise(r=>setImmediate(r));
 try{assert.equal(cancelStarted,true);assert.equal(owned,true);}finally{release();await pending;}
 assert.equal(owned,false);assert.equal(JSON.parse(readFileSync(s.options.path)).value.revocation,'ACK_UNVERIFIED');
});

const rejection=()=>new Response('',{status:401});
function verificationSetup(response=rejection,cleanup,revocationStatus=200){
 let profiles=0,verifications=0;const aliases=[];
 const s=setup({control:{waitForExternalReadSlot:async()=>{},reserveExternalReads:async()=>{},cleanup:async(action,io)=>{aliases.push(action);return cleanup?await cleanup(action,io):await io();}},
  fetcher:async(url,init)=>{s.calls.push({url,init});if(url.endsWith('/token'))return new Response(JSON.stringify(token()));if(url.endsWith('/revoke'))return new Response('',{status:revocationStatus});
   if(url==='https://www.googleapis.com/oauth2/v2/userinfo?fields=email%2Cverified_email'){if(profiles++===0)return Response.json({email,verified_email:true});verifications++;return await response();}throw Error('UNEXPECTED_DESTINATION');}});
 return {s,aliases,verifications:()=>verifications};
}
test('original ready token rejection is checked once under independent I alias without token URLs or durable secrets',async()=>{
 const v=verificationSetup(),s=v.s;await s.submit();await s.flow.receive(s.request());await s.flow.cancel();assert.equal(typeof s.flow.verifyRevoked,'function');
 const before=s.calls.length,r=await s.flow.verifyRevoked();assert.equal(r.tokenRejectedAtReadback,true);assert.equal(r.revocationAccepted,false);assert.equal(r.rollbackComplete,false);
 assert.deepEqual(v.aliases,['revoke-token','verify-token-revoked']);assert.equal(v.verifications(),1);assert.equal(s.calls.length,before+1);
 const call=s.calls.at(-1);assert.equal(call.init.method,'GET');assert.equal(call.init.headers.authorization,'Bearer SYNTHETIC_ACCESS_TOKEN');assert(!call.url.includes('SYNTHETIC_ACCESS_TOKEN'));assert.equal(call.init.redirect,'manual');
 assert(!readFileSync(s.options.path,'utf8').includes('SYNTHETIC_ACCESS_TOKEN'));await assert.rejects(s.flow.verifyRevoked(),/^Error: TRIAL_STOPPED$/);assert.equal(v.verifications(),1);
});
for(const status of [200,400,403,429,503])test('verification status'+status+' remains unknown and cannot be replayed',async()=>{
 const v=verificationSetup(()=>new Response('PRIVATE_PROVIDER_BODY',{status})),s=v.s;await s.submit();await s.flow.receive(s.request());await s.flow.cancel();
 assert.equal(typeof s.flow.verifyRevoked,'function');await assert.rejects(s.flow.verifyRevoked(),/^Error: TRIAL_STOPPED$/);await assert.rejects(s.flow.verifyRevoked(),/^Error: TRIAL_STOPPED$/);assert.equal(v.verifications(),1);
 const value=JSON.parse(readFileSync(s.options.path)).value;assert.equal(value.revocation,'ACK_UNVERIFIED');assert.equal(value.tokenVerification,'UNKNOWN');assert(!JSON.stringify(value).includes('PRIVATE_PROVIDER_BODY'));
});
test('ordinary trial expiry does not authorize calling an expired token rejection a revoke verification',async()=>{
 const v=verificationSetup(),s=v.s;await s.submit();await s.flow.receive(s.request());await s.flow.cancel();s.setNow(clock+3600000);assert.equal(typeof s.flow.verifyRevoked,'function');
 await assert.rejects(s.flow.verifyRevoked(),/^Error: TRIAL_STOPPED$/);assert.equal(v.verifications(),0);assert.equal(s.calls.filter(x=>x.url.endsWith('/revoke')).length,1);
});

test('a rejected overlapping verification cannot clear the original token waiting for I admission',async()=>{
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 const v=verificationSetup(rejection,async(action,io)=>{if(action==='verify-token-revoked'){enter();await gate;}return await io();}),s=v.s;await s.submit();
 await s.flow.receive(s.request());await s.flow.cancel();const first=s.flow.verifyRevoked();await entered;await assert.rejects(s.flow.verifyRevoked(),/^Error: TRIAL_STOPPED$/);release();
 const r=await first;assert.equal(r.tokenRejectedAtReadback,true);assert.equal(v.verifications(),1);assert.equal(s.calls.at(-1).init.headers.authorization,'Bearer SYNTHETIC_ACCESS_TOKEN');
});
test('token expiry during I admission waits prevents a denial probe before outbound IO',async()=>{
 const v=verificationSetup(rejection,async(action,io)=>{if(action==='verify-token-revoked')v.s.setNow(clock+3599999);return await io();}),s=v.s;await s.submit();
 await s.flow.receive(s.request());await s.flow.cancel();await assert.rejects(s.flow.verifyRevoked(),/^Error: TRIAL_STOPPED$/);assert.equal(v.verifications(),0);assert.deepEqual(v.aliases,['revoke-token','verify-token-revoked']);
});
test('independent rejection readback preserves UNKNOWN revocation acknowledgement and never resends revoke',async()=>{
 const v=verificationSetup(rejection,undefined,503),s=v.s;await s.submit();await s.flow.receive(s.request());await assert.rejects(s.flow.cancel(),/^Error: TRIAL_STOPPED$/);
 const r=await s.flow.verifyRevoked();assert.equal(r.tokenRejectedAtReadback,true);const value=JSON.parse(readFileSync(s.options.path)).value;assert.equal(value.revocation,'UNKNOWN');assert.equal(value.tokenVerification,'REJECTED_AT_READBACK');
 assert.equal(s.calls.filter(x=>x.url.endsWith('/revoke')).length,1);assert.equal(v.verifications(),1);
});
test('verification owns denial body disposal through settlement before recording token rejection',async()=>{
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);const response=()=>new Response(new ReadableStream({cancel:async()=>{enter();await gate;}}),{status:401});
 const v=verificationSetup(response),s=v.s;await s.submit();await s.flow.receive(s.request());await s.flow.cancel();let settled=false;const pending=s.flow.verifyRevoked().then(r=>{settled=true;return r;});await entered;
 assert.equal(settled,false);assert.equal(JSON.parse(readFileSync(s.options.path)).value.tokenVerification,'UNKNOWN');release();assert.equal((await pending).tokenRejectedAtReadback,true);assert.equal(settled,true);
});

test('callback before consent admission cannot claim state, debit or reach Google',async()=>{
 const s=setup();await assert.rejects(s.flow.receive(s.request()),/^Error: TRIAL_STOPPED$/);assert.equal(s.spent(),0);assert.equal(s.calls.length,0);assert.equal(s.flow.status(),'waiting');assert.equal(JSON.parse(readFileSync(s.options.path)).value.attempted,false);
});
test('consent submission enters E admission before the one fixed UI callback and is not consent proof',async()=>{
 const aliases=[];let io=0;const s=setup({control:{externalRead:async(fn,alias)=>{aliases.push(alias);return fn();},cleanup:async()=>{throw Error('UNEXPECTED_CLEANUP');}}});
 assert.equal(typeof s.flow.submitConsent,'function');const result=await s.flow.submitConsent(async()=>{assert.deepEqual(aliases,['E:oauth-response']);io++;});assert.equal(io,1);assert.equal(result.consentVerified,false);assert.equal(result.trialAccepted,false);assert.equal(s.calls.length,0);
 await s.flow.receive(s.request());assert.deepEqual(aliases,['E:oauth-response','E:token-exchange','E:caller-userinfo']);await assert.rejects(s.flow.submitConsent(async()=>{io++;}),/TRIAL_STOPPED/);assert.equal(io,1);
});
test('real loopback ACK and pending page finish while submit owns cap, before token exchange',async()=>{
 let owned=false,inSubmit=false;const aliases=[],control={externalRead:async(io,alias)=>{assert.equal(owned,false,'no nested owner');aliases.push(alias);owned=true;try{return await io();}finally{owned=false;}},cleanup:async()=>{throw Error('UNEXPECTED_CLEANUP');}};
 const s=setup({control,fetcher:async(url,init)=>{assert.equal(inSubmit,false,'token IO must follow submit settlement');s.calls.push({url,init});return new Response(JSON.stringify(url.endsWith('/token')?token():{email,verified_email:true}));}}),listener=await oauth.startAuthorityTrialOAuthListener(s.flow);
 try{
  const result=await s.flow.submitConsent(async()=>{inSubmit=true;try{
   const callback=await fetch('http://127.0.0.1:34763'+s.request().url,{redirect:'manual',signal:AbortSignal.timeout(3000)});assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'/oauth/result');assert.equal(s.flow.status(),'claimed');assert.equal(s.calls.length,0);
   const pending=await fetch('http://127.0.0.1:34763/oauth/result',{signal:AbortSignal.timeout(3000)}),body=await pending.text();assert.equal(pending.status,200);assert.equal(s.flow.status(),'claimed');assert(!body.includes('SYNTHETIC_CODE'));assert(!body.includes(new URL(s.flow.authorizationUrl).searchParams.get('state')));assert(!body.includes('accepted'));assert.equal(s.calls.length,0);
  }finally{inSubmit=false;}});
  assert.equal(result.consentVerified,false);assert.equal(s.flow.credential().callerHash,callerHash);assert.deepEqual(aliases,['E:oauth-response','E:token-exchange','E:caller-userinfo']);assert.equal(s.calls.length,2);
 }finally{await listener.close();}
});
test('one buffered callback and one pending submit cannot be replayed or create extra exchange',async()=>{
 const s=setup();let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);assert.equal(typeof s.flow.submitConsent,'function');const pending=s.flow.submitConsent(async()=>{enter();await gate;});void pending.catch(()=>{});await entered;
 await s.flow.receive(s.request());assert.equal(s.calls.length,0);await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);await assert.rejects(s.flow.submitConsent(async()=>assert.fail('SECOND_SUBMIT')),/TRIAL_STOPPED/);release();await pending;assert.equal(s.calls.length,2);assert.equal(s.spent(),3);await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);
});
for(const mode of ['cancel','reject'])test(mode+' during pending submit discards buffered callback without minting a token',async()=>{
 const s=setup();let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);assert.equal(typeof s.flow.submitConsent,'function');const pending=s.flow.submitConsent(async()=>{enter();await gate;if(mode==='reject')throw Error('PRIVATE_UI_FAILURE');});void pending.catch(()=>{});await entered;await s.flow.receive(s.request());if(mode==='cancel')await s.flow.cancel();release();await assert.rejects(pending,/TRIAL_STOPPED/);assert.equal(s.calls.length,0);assert.equal(s.spent(),1);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);for(const raw of ['SYNTHETIC_CODE','PRIVATE_UI_FAILURE'])assert(!readFileSync(s.options.path,'utf8').includes(raw));
});
for(const mode of ['skip','clone','double','late'])test('consent admission '+mode+' cannot authorize a fabricated or repeated submission',async()=>{
 let saved,io=0;const s=setup({control:{externalRead:async(fn,alias)=>{assert.equal(alias,'E:oauth-response');saved=fn;if(mode==='skip'||mode==='late')return{};const value=await fn();if(mode==='double')assert.throws(fn,/TRIAL_STOPPED/);return mode==='clone'?structuredClone(value):value;},cleanup:async()=>{throw Error('UNEXPECTED_CLEANUP');}}});
 await assert.rejects(s.flow.submitConsent(async()=>{io++;}),/TRIAL_STOPPED/);if(mode==='late')assert.throws(saved,/TRIAL_STOPPED/);assert.equal(io,['clone','double'].includes(mode)?1:0);await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.calls.length,0);assert.equal(JSON.parse(readFileSync(s.options.path)).value.consentOutcome,mode==='skip'||mode==='late'?'NOT_SENT':'UNKNOWN');
});
test('a callback while consent awaits admission cannot preclaim the valid state',async()=>{
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);const s=setup({control:{externalRead:async fn=>{enter();await gate;return fn();},cleanup:async()=>{throw Error('UNEXPECTED_CLEANUP');}}});
 const pending=s.flow.submitConsent(async()=>{});void pending.catch(()=>{});await entered;await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.flow.status(),'waiting');assert.equal(s.calls.length,0);release();await pending;await s.flow.receive(s.request());assert.equal(s.flow.credential().callerHash,callerHash);
});

const receipt=s=>JSON.parse(readFileSync(s.options.path)).value;
const tick=()=>new Promise(r=>setImmediate(r));
test('requestCancellation is local, synchronous and blocks every ordinary admission',async()=>{
 const s=setup();assert.equal(typeof s.flow.requestCancellation,'function');assert.equal(s.flow.requestCancellation(),undefined);assert.equal(s.flow.status(),'cancelled');
 await assert.rejects(s.submit(),/TRIAL_STOPPED/);await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);
 assert.equal(s.calls.length,0);assert.equal(s.spent(),0);assert.equal(s.cleanups(),0);await s.flow.cancel();assert.equal(s.cleanups(),0);
});
test('pre-admission denial is local; concurrent callers share it and later explicit cleanup can first dispatch',async()=>{
 let open=false,admissions=0,release;const gate=new Promise(r=>release=r);
 const s=setup({control:{externalRead:io=>io(),cleanup:async(name,io)=>{admissions++;if(!open){await gate;throw Error('SYNTHETIC_NOT_ADMITTED');}return io();}}});await s.submit();await s.flow.receive(s.request());
 const first=s.flow.cancel(),second=s.flow.cancel();void first.catch(()=>{});void second.catch(()=>{});await tick();assert.equal(admissions,1);assert.equal(receipt(s).revocation,'NOT_NEEDED');
 await assert.rejects(s.flow.verifyRevoked(),/TRIAL_STOPPED/);release();await assert.rejects(first,/TRIAL_STOPPED/);await assert.rejects(second,/TRIAL_STOPPED/);assert.equal(s.calls.length,2);assert.equal(receipt(s).revocation,'NOT_NEEDED');
 open=true;await Promise.all([s.flow.cancel(),s.flow.cancel()]);assert.equal(admissions,2);assert.equal(s.calls.filter(c=>c.url.endsWith('/revoke')).length,1);assert.equal(receipt(s).revocation,'ACK_UNVERIFIED');
});
for(const mode of ['skip','clone','double','late','reject-before','reject-after','detach'])test('revoke admission '+mode+' cannot forge ACK or replay an entered provider callback',async()=>{
 let saved,admissions=0,allow=false,detached,finish;
 const s=setup({control:{externalRead:io=>io(),cleanup:async(name,io)=>{
  admissions++;saved=io;if(allow)return io();
  if(mode==='skip'||mode==='late')return {};
  if(mode==='reject-before')throw Error('SYNTHETIC_DENIED');
  if(mode==='detach'){detached=io();void detached.catch(()=>{});return {};}
  const value=await io();if(mode==='double')assert.throws(io,/TRIAL_STOPPED/);if(mode==='reject-after')throw Error('SYNTHETIC_DENIED');return mode==='clone'?structuredClone(value):value;
 }},fetcher:async(url,init)=>{
  s.calls.push({url,init});if(url.endsWith('/token'))return Response.json(token());if(url.endsWith('/revoke')){if(mode==='detach')await new Promise(r=>finish=r);return new Response('');}return Response.json({email,verified_email:true});
 }});await s.submit();await s.flow.receive(s.request());const pending=s.flow.cancel();void pending.catch(()=>{});await tick();
 if(mode==='detach'){let settled=false;void pending.finally(()=>settled=true).catch(()=>{});await tick();assert.equal(settled,false);finish();}
 await assert.rejects(pending,/TRIAL_STOPPED/);if(mode==='late'||mode==='reject-before')assert.throws(saved,/TRIAL_STOPPED/);
 const entered=['clone','double','reject-after','detach'].includes(mode);assert.equal(s.calls.filter(c=>c.url.endsWith('/revoke')).length,entered?1:0);assert.equal(receipt(s).revocation,entered?'UNKNOWN':'NOT_NEEDED');
 allow=true;if(entered)await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);else await s.flow.cancel();assert.equal(s.calls.filter(c=>c.url.endsWith('/revoke')).length,1);assert.equal(admissions,entered?1:2);
});
for(const mode of ['provider','disposal','receipt','integrity'])test('admitted '+mode+' failure keeps one revoke UNKNOWN and never replays it',async()=>{
 let revokes=0;const s=setup({fetcher:async(url,init)=>{
  s.calls.push({url,init});if(url.endsWith('/token'))return Response.json(token());if(!url.endsWith('/revoke'))return Response.json({email,verified_email:true});revokes++;
  if(mode==='provider')throw Error('PRIVATE_PROVIDER_FAILURE');if(mode==='receipt')chmodSync(join(s.options.path,'..'),0o755);
  if(mode==='disposal')return {status:200,body:{cancel:async()=>{throw Error('PRIVATE_DISPOSAL');}}};return new Response('');
 }});await s.submit();await s.flow.receive(s.request());if(mode==='integrity')chmodSync(join(s.options.path,'..'),0o755);
 try{await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);assert.equal(revokes,1);assert.notEqual(receipt(s).revocation,'ACK_UNVERIFIED');
  if(mode==='receipt'||mode==='integrity'){chmodSync(join(s.options.path,'..'),0o700);await assert.rejects(s.flow.verifyRevoked(),/TRIAL_STOPPED/);}
 }finally{chmodSync(join(s.options.path,'..'),0o700);}
});
test('issued but unverified identity can be revoked but cannot fabricate accepted-token verification',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});return url.endsWith('/token')?Response.json(token()):url.endsWith('/revoke')?new Response(''):Response.json({email:'wrong@example.invalid',verified_email:true});}});
 await s.submit();await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.cleanups(),0);await assert.rejects(s.flow.verifyRevoked(),/TRIAL_STOPPED/);await s.flow.cancel();await assert.rejects(s.flow.verifyRevoked(),/TRIAL_STOPPED/);assert.equal(s.calls.length,3);assert.equal(s.flow.status(),'failed');
});

for(const mode of ['timeout','failure'])test('listener '+mode+' stops locally and drains a pending late-token callback',async()=>{
 let enter,release,server;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(url.endsWith('/token')){enter();await gate;return Response.json(token());}if(url.endsWith('/revoke'))return new Response('');throw Error('UNEXPECTED_IDENTITY');}});await s.submit();
 if(mode==='timeout')s.setNow(clock+599700);
 const original=http.createServer;let listener;
 try{http.createServer=(...args)=>(server=original(...args));syncBuiltinESMExports();listener=await oauth.startAuthorityTrialOAuthListener(s.flow);}
 finally{http.createServer=original;syncBuiltinESMExports();}
 const callback=fetch('http://127.0.0.1:34763'+s.request().url,{redirect:'manual'});await entered;
 if(mode==='failure')server.emit('error',Error('PRIVATE_LISTENER_FAILURE'));
 else await new Promise(r=>setTimeout(r,350));
 try{assert.equal(s.flow.status(),'cancelled');assert.equal(s.cleanups(),0);assert.equal(s.calls.length,1);}
 finally{release();await callback;await listener.close();}
 assert.equal(s.cleanups(),0);await s.flow.cancel();assert.equal(s.cleanups(),1);assert.equal(s.calls.length,2);assert(!readFileSync(s.options.path,'utf8').includes('PRIVATE_LISTENER_FAILURE'));
});
for(const mode of ['skip','clone','double','late','detach','reject-after'])test('verifyRevoked '+mode+' cannot forge rejection proof or escape owned disposal',async()=>{
 let saved,release,enter;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 const v=verificationSetup(()=>new Response(new ReadableStream({cancel:async()=>{enter();if(mode==='detach')await gate;}}),{status:401}),async(action,io)=>{
  if(action==='revoke-token')return io();saved=io;if(mode==='skip'||mode==='late')return {tokenRejectedAtReadback:true};
  if(mode==='detach'){void io().catch(()=>{});return {};}
  const actual=await io();if(mode==='double')assert.throws(io,/TRIAL_STOPPED/);if(mode==='reject-after')throw Error('SYNTHETIC_DENIED');return mode==='clone'?structuredClone(actual):actual;
 });const s=v.s;await s.submit();await s.flow.receive(s.request());await s.flow.cancel();const pending=s.flow.verifyRevoked();void pending.catch(()=>{});
 if(mode==='detach'){await entered;let settled=false;void pending.finally(()=>settled=true).catch(()=>{});await tick();assert.equal(settled,false);release();}
 await assert.rejects(pending,/TRIAL_STOPPED/);if(mode==='late')assert.throws(saved,/TRIAL_STOPPED/);assert.notEqual(receipt(s).tokenVerification,'REJECTED_AT_READBACK');await assert.rejects(s.flow.verifyRevoked(),/TRIAL_STOPPED/);assert.equal(v.verifications(),['skip','late'].includes(mode)?0:1);
});

// Task100: absent token after attempted exchange must never mean no remote grant.
test('cleanup disposition cancellation retains accepted-token provenance and expiry without reopening credential access',async()=>{
 const v=verificationSetup(),s=v.s,initial=s.flow.cleanupDisposition(),before=readFileSync(s.options.path,'utf8');
 assert.equal(initial.resourceDisposition,'not-dispatched');assert.equal(initial.exchangeAttempted,false);assert.equal(initial.acceptedTokenExpiresAt,null);
 assert(Object.isFrozen(initial));assert(Object.isFrozen(initial.actions.revoke));assert.throws(()=>s.flow.cleanupDisposition({}),/TRIAL_STOPPED/);
 assert.equal(readFileSync(s.options.path,'utf8'),before);assert.equal(s.calls.length,0);assert.equal(s.spent(),0);
 await s.submit();await s.flow.receive(s.request());const accepted=s.flow.cleanupDisposition();s.flow.requestCancellation();assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);
 const cancelled=s.flow.cleanupDisposition();assert.equal(cancelled.tokenHeld,true);assert.equal(cancelled.tokenPreviouslyAccepted,true);assert.equal(cancelled.acceptedTokenExpiresAt,clock+3600000);
 for(const p of ['SYNTHETIC_ACCESS_TOKEN','SYNTHETIC_CLIENT_SECRET',email,callerHash,clientId,s.options.path])assert(!JSON.stringify(cancelled).includes(p));
 await s.flow.cancel();const revoked=s.flow.cleanupDisposition();assert.equal(revoked.tokenHeld,false);assert.equal(revoked.verificationTokenHeld,true);assert.equal(revoked.actions.revoke.consumed,true);assert.equal(revoked.actions.revoke.result,'returned');
 await s.flow.verifyRevoked();const verified=s.flow.cleanupDisposition();assert.equal(verified.actions.verify.consumed,true);assert.equal(verified.verificationTokenHeld,false);assert.equal(verified.actions.verify.outcome,'REJECTED_AT_READBACK');assert.equal(verified.tokenPreviouslyAccepted,true);
 s.setNow(clock+3600001);assert.equal(s.flow.cleanupDisposition().acceptedTokenExpiresAt,clock+3600000);assert.equal(initial.resourceDisposition,'not-dispatched');assert.equal(accepted.tokenHeld,true);assert.equal(accepted.actions.revoke.consumed,false);assert.equal(s.calls.length,4);
});
for(const kind of ['unknown','unaccepted'])test('cleanup disposition '+kind+' exchange preserves uncertainty and token verification limits',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(url.endsWith('/token')){if(kind==='unknown')throw Error('LOST_EXCHANGE');return Response.json({...token(),scope:'OTHER'});}if(url.endsWith('/revoke'))return new Response('');assert.fail('UNEXPECTED_READBACK');}});
 await s.submit();await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);const d=s.flow.cleanupDisposition();assert.equal(d.exchangeAttempted,true);assert.equal(d.resourceDisposition,kind==='unknown'?'attempted-unknown':'attempted-known');assert.equal(d.tokenHeld,kind==='unaccepted');assert.equal(d.tokenPreviouslyAccepted,false);assert.equal(d.acceptedTokenExpiresAt,null);
 await s.flow.cancel();await assert.rejects(s.flow.verifyRevoked(),/TRIAL_STOPPED/);assert.equal(s.flow.cleanupDisposition().actions.verify.consumed,false);assert.equal(s.calls.length,kind==='unknown'?1:2);
});
test('cleanup disposition revoke denial, entered pending failure and compromised journal remain distinct',async()=>{
 let deny=true,release,enter;const gate=new Promise(r=>release=r),entered=new Promise(r=>enter=r);
 const s=setup({control:{externalRead:async io=>io(),cleanup:async(name,io)=>{if(deny)throw Error('DENIED');return io();}},fetcher:async(url,init)=>{s.calls.push({url,init});if(url.endsWith('/token'))return Response.json(token());if(url.endsWith('/revoke')){enter();await gate;throw Error('LOST_REVOKE');}return Response.json({email,verified_email:true});}});
 await s.submit();await s.flow.receive(s.request());await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);const denied=s.flow.cleanupDisposition();assert.equal(denied.actions.revoke.requested,true);assert.equal(denied.actions.revoke.entered,false);assert.equal(denied.actions.revoke.consumed,false);assert.equal(denied.tokenHeld,true);
 deny=false;const p=s.flow.cancel();await entered;const pending=s.flow.cleanupDisposition();assert.equal(pending.inFlight,true);assert.equal(pending.actions.revoke.pending,true);assert.equal(pending.actions.revoke.entered,true);release();await assert.rejects(p,/TRIAL_STOPPED/);
 const failed=s.flow.cleanupDisposition();assert.equal(failed.actions.revoke.consumed,true);assert.equal(failed.actions.revoke.result,'rejected');assert.equal(failed.tokenHeld,false);assert.equal(failed.integrity,'locally-uncontested');
 chmodSync(join(s.options.path,'..'),0o755);try{assert.throws(()=>s.flow.requestCancellation(),/TRIAL_STOPPED/);assert.equal(s.flow.cleanupDisposition().integrity,'compromised');}finally{chmodSync(join(s.options.path,'..'),0o700);}
 assert.equal(denied.actions.revoke.entered,false);assert.equal(s.calls.filter(c=>c.url.endsWith('/revoke')).length,1);
});

test('cleanup disposition verify admission denial consumes only the accepted-token verification attempt',async()=>{
 const v=verificationSetup(rejection,async(name,io)=>{if(name==='verify-token-revoked')throw Error('DENIED');return io();}),s=v.s;await s.submit();await s.flow.receive(s.request());await s.flow.cancel();
 await assert.rejects(s.flow.verifyRevoked(),/TRIAL_STOPPED/);const d=s.flow.cleanupDisposition();assert.equal(d.actions.verify.requested,true);assert.equal(d.actions.verify.entered,false);assert.equal(d.actions.verify.consumed,true);assert.equal(d.verificationTokenHeld,false);assert.equal(d.actions.verify.callbackResult,'not-observed');assert.equal(v.verifications(),0);
});

test('cleanup disposition flow observation is filesystem clock credential and capability inert',()=>{
 let observing=false;const forbid=()=>{if(observing)assert.fail('OBSERVER_SIDE_EFFECT');};const s=setup({now:()=>{forbid();return clock;},clientSecret:()=>{forbid();throw Error('NOT_USED');},control:{externalRead:async()=>{forbid();},cleanup:async()=>{forbid();}}});
 const saved={};for(const name of ['lstatSync','readFileSync','openSync','writeSync','renameSync','fsyncSync']){saved[name]=fs[name];fs[name]=()=>assert.fail('OBSERVER_FILESYSTEM_IO');}syncBuiltinESMExports();observing=true;
 try{const a=s.flow.cleanupDisposition(),b=s.flow.cleanupDisposition();assert.deepEqual(a,b);assert.notEqual(a,b);assert.notEqual(a.actions,b.actions);for(const action of Object.keys(a.actions)){assert(Object.isFrozen(a.actions[action]));assert.notEqual(a.actions[action],b.actions[action]);}}finally{observing=false;Object.assign(fs,saved);syncBuiltinESMExports();}
});

for(const overlapping of [false,true])test('cleanup disposition first-late OAuth callback after pre-entry rejection'+(overlapping?' during next revoke request':''),async()=>{
 let first,release,enter,count=0;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 const s=setup({control:{externalRead:async io=>io(),cleanup:async(name,io)=>{assert.equal(name,'revoke-token');if(++count===1){first=io;throw Error('PRE_ENTRY_DENIED');}enter();await gate;throw Error('NEXT_PRE_ENTRY_DENIED');}}});
 await s.submit();await s.flow.receive(s.request());await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);const before=s.flow.cleanupDisposition();
 assert.equal(before.actions.revoke.consumed,false);assert.equal(before.actions.revoke.entered,false);assert.equal(before.tokenHeld,true);assert.equal(before.integrity,'locally-uncontested');
 let next;if(overlapping){next=s.flow.cancel();await entered;}
 try{assert.throws(first,/TRIAL_STOPPED/);const after=s.flow.cleanupDisposition();assert.equal(after.integrity,'compromised');assert.equal(after.actions.revoke.callbackResult,'rejected');assert.equal(after.actions.revoke.consumed,false);assert.equal(after.tokenHeld,true);assert.equal(s.calls.length,2);}finally{if(next){release();await assert.rejects(next,/TRIAL_STOPPED/);}}
 const done=s.flow.cleanupDisposition();assert.equal(done.inFlight,false);assert.equal(done.integrity,'compromised');assert.equal(done.actions.revoke.consumed,false);assert.equal(before.actions.revoke.entered,false);
});
