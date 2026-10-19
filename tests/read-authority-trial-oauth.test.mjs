import {atomicFixtureControl} from './fixtures/read-authority/atomic-control.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,readFileSync,lstatSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
const oauth=await import('../scripts/read-authority-trial-oauth.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-trial-oauth.mjs'))return {};throw e;});
const digest=v=>createHash('sha256').update(v).digest('hex');
const clock=Date.parse('2026-10-14T00:00:00Z'),clientId='1234567890-synthetic.apps.googleusercontent.com',email='caller@example.invalid';
const scopes=['https://www.googleapis.com/auth/spreadsheets.readonly','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/script.external_request'];
const redirect='http://127.0.0.1:34763/oauth/callback',cloudProjectHash='c'.repeat(64),publisherHash=digest('publisher@example.invalid'),callerHash=digest(email);
const epochs=new Set();
test.after(()=>{for(const epoch of epochs){const p=join(homedir(),'.codex','private','cmwebs-authority-trials',digest(JSON.stringify(epoch))+'.oauth.json');try{const stat=lstatSync(p),v=JSON.parse(readFileSync(p)).value;if(stat.isFile()&&!stat.isSymbolicLink()&&v.path.startsWith(join(tmpdir(),'cmwebs-oauth-')))unlinkSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}}});
const token=()=>({access_token:'SYNTHETIC_ACCESS_TOKEN',expires_in:3600,token_type:'Bearer',scope:scopes.join(' ')});
function setup(patch={}){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-oauth-'));chmodSync(dir,0o700);let spent=0,now=clock,cleanups=0;const calls=[],order=[];
 const control={waitForExternalReadSlot:async n=>{assert.equal(n,1);order.push('wait');},reserveExternalReads:async n=>{assert.equal(n,1);spent++;order.push('debit');},cleanup:async(name,io)=>{assert.equal(name,'revoke-token');cleanups++;await io();}};
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
for(const [name,response] of [['bad scope',()=>({...token(),scope:scopes.join(' ')+' https://www.googleapis.com/auth/drive'})],['refresh',()=>({...token(),refresh_token:'PRIVATE_REFRESH_NEVER_STORED'})],['too short',()=>({...token(),expires_in:360})],['too long',()=>({...token(),expires_in:3601})],['wrong type',()=>({...token(),token_type:'basic'})]])test('received '+name+' stops, revokes once under cleanup reserve and never exposes credential',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(url.endsWith('/token'))return new Response(JSON.stringify(response()));if(url.endsWith('/revoke'))return new Response('');throw Error('UNEXPECTED_USERINFO');}});await s.submit();
 await assert.rejects(s.flow.receive(s.request()),/^Error: TRIAL_STOPPED$/);assert.equal(s.cleanups(),1);assert.equal(s.calls.length,2);assert.equal(new URLSearchParams(s.calls[1].init.body).get('token'),'SYNTHETIC_ACCESS_TOKEN');assert(!s.calls[1].url.includes('SYNTHETIC_ACCESS_TOKEN'));assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);assert(!readFileSync(s.options.path,'utf8').includes('PRIVATE_REFRESH_NEVER_STORED'));await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.calls.length,2);
});
for(const [name,profile] of [['publisher',{email:'publisher@example.invalid',verified_email:true}],['unverified',{email,verified_email:false}],['wrong caller',{email:'other@example.invalid',verified_email:true}],['extra private field',{email,verified_email:true,id:'PRIVATE_ID'}]])test('identity '+name+' rejects and revokes received token without retry',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});return new Response(url.endsWith('/token')?JSON.stringify(token()):url.endsWith('/revoke')?'':JSON.stringify(profile));}});await s.submit();await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.cleanups(),1);assert.equal(s.calls.length,3);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);
});
for(const [name,response] of [['redirect',()=>new Response('',{status:302})],['failure',()=>new Response('PRIVATE',{status:400})],['oversize',()=>new Response('x'.repeat(30001))],['malformed',()=>new Response('PRIVATE')],['non UTF8',()=>new Response(new Uint8Array([255]))]])test('token response '+name+' stops without retry/raw output',async()=>{
 const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});return response();}});await s.submit();await assert.rejects(s.flow.receive(s.request()),/^Error: TRIAL_STOPPED$/);assert.equal(s.calls.length,1);assert.equal(s.spent(),2);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);
});
test('unknown cleanup result preserves failed flow and cannot expose/retry token',async()=>{
 let requests=0;const s=setup({fetcher:async url=>{requests++;return url.endsWith('/token')?new Response(JSON.stringify({...token(),scope:'OTHER'})):new Response('',{status:503});}});await s.submit();await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(requests,2);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);assert.equal(requests,2);
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
 try{await assert.rejects(s.flow.receive(s.request()),/TRIAL_STOPPED/);assert.equal(s.cleanups(),1);assert.equal(s.calls.filter(c=>c.url.endsWith('/revoke')).length,1);await assert.rejects(s.flow.cancel(),/TRIAL_STOPPED/);assert.equal(s.cleanups(),1);}finally{chmodSync(join(s.options.path,'..'),0o700);}
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
test('expired credential stops and begins single cleanup which cancel joins',async()=>{
 const s=setup();await s.submit();await s.flow.receive(s.request());s.setNow(clock+3240000);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);assert.equal(s.flow.status(),'cancelled');assert.equal(s.cleanups(),1);await s.flow.cancel();assert.equal(s.calls.filter(c=>c.url.endsWith('/revoke')).length,1);
});
test('cancellation during token response revokes the late token without identity request',async()=>{
 let enter,release;const entered=new Promise(r=>{enter=r;});const s=setup({fetcher:async(url,init)=>{s.calls.push({url,init});if(url.endsWith('/token')){enter();await new Promise(r=>{release=r;});return new Response(JSON.stringify(token()));}if(url.endsWith('/revoke'))return new Response('');throw Error('UNEXPECTED_IDENTITY');}});await s.submit();
 const running=s.flow.receive(s.request());await entered;await s.flow.cancel();release();await assert.rejects(running,/TRIAL_STOPPED/);assert.equal(s.cleanups(),1);assert.equal(s.calls.length,2);assert.throws(()=>s.flow.credential(),/TRIAL_STOPPED/);
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
