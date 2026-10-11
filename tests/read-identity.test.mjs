import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { createIdentityAuthenticator, emailSessionHash } from '../cloudflare/read-api/src/read-identity.js';

const now=Date.parse('2026-10-12T06:00:00+08:00');
const env={LINE_LOGIN_CHANNEL_ID:'SYNTHETIC_CHANNEL',EMAIL_SESSION_HMAC_SECRET:'synthetic-email-key'};
const request=value=>new Request('https://local.test/v1/arrears',{headers:value?{authorization:value}:{}});
const claims={iss:'https://access.line.me',aud:env.LINE_LOGIN_CHANNEL_ID,sub:'SYNTHETIC_LINE1',exp:now/1000+600};
const session={session_id:'SYNTHETIC_SESSION',user_id:'SYNTHETIC_USER',workspace_id:'SYNTHETIC_W1',role:'owner',status:'active',
  issued_at:new Date(now-10000).toISOString(),expires_at:new Date(now+3600000).toISOString(),revoked_at:''};

test('identity accepts only the two explicit credential header protocols',async()=>{
  let io=0;const auth=createIdentityAuthenticator({now:()=>now,fetch:async()=>{io++;},findSession:async()=>{io++;}});
  for(const header of [null,'Bearer synthetic','LIFF','LIFF a b','Session a\tb','Basic synthetic']) await assert.rejects(()=>auth(request(header),env),/AUTH_REQUIRED/);
  assert.equal(io,0);
});

test('LINE provider verifies the exact token/channel; only provider claims choose identity',async()=>{
  let calls=0;
  const auth=createIdentityAuthenticator({now:()=>now,fetch:async(url,options)=>{
    calls++;assert.equal(url,'https://api.line.me/oauth2/v2.1/verify');assert.equal(options.method,'POST');
    const body=new URLSearchParams(options.body);assert.equal(body.get('id_token'),'synthetic-id-token');assert.equal(body.get('client_id'),env.LINE_LOGIN_CHANNEL_ID);
    return Response.json(claims);
  }});
  const identity=await auth(request('LIFF synthetic-id-token'),env);
  assert.equal(identity.line_user_id,claims.sub);assert.equal(identity.kind,'line');
  await auth(request('LIFF synthetic-id-token'),env);assert.equal(calls,1);
  assert.doesNotMatch(JSON.stringify(identity),/synthetic-id-token/);
});

test('LINE wrong audience/issuer, expired, malformed and failed verification never authenticate',async()=>{
  for(const result of [{...claims,aud:'SYNTHETIC_OTHER'},{...claims,iss:'https://private.invalid'},
    {...claims,exp:now/1000},{...claims,exp:'9999999999'},{...claims,sub:''},{...claims,sub:123}]) {
    const auth=createIdentityAuthenticator({now:()=>now,fetch:async()=>Response.json(result)});
    await assert.rejects(()=>auth(request('LIFF synthetic-token'),env),/AUTH_REQUIRED/);
  }
  for(const fetch of [async()=>new Response('',{status:401}),async()=>{throw new Error('private network details');}]) {
    const auth=createIdentityAuthenticator({now:()=>now,fetch});
    await assert.rejects(()=>auth(request('LIFF synthetic-token'),env),error=>/AUTH_(REQUIRED|UNAVAILABLE)/.test(error.message)&&!error.message.includes('private'));
  }
});

test('LINE cache never outlives expiry or five minutes and is bound to channel configuration',async()=>{
  let clock=now,calls=0;
  const auth=createIdentityAuthenticator({now:()=>clock,fetch:async()=>{calls++;return Response.json({...claims,exp:now/1000+301});}});
  await auth(request('LIFF synthetic-token'),env);clock+=299000;await auth(request('LIFF synthetic-token'),env);assert.equal(calls,1);
  clock+=1000;await auth(request('LIFF synthetic-token'),env);assert.equal(calls,2);
  clock+=1000;await assert.rejects(()=>auth(request('LIFF synthetic-token'),env),/AUTH_REQUIRED/);
  const other=createIdentityAuthenticator({now:()=>now,fetch:async()=>Response.json(claims)});
  await other(request('LIFF synthetic-token'),env);
  await assert.rejects(()=>other(request('LIFF synthetic-token'),{...env,LINE_LOGIN_CHANNEL_ID:'SYNTHETIC_OTHER'}),/AUTH_REQUIRED/);
});

test('Email hash matches the GAS session prefix and sessions are reread for immediate revocation',async()=>{
  const token='synthetic-email-token';
  assert.equal(await emailSessionHash(token,env.EMAIL_SESSION_HMAC_SECRET),createHmac('sha256',env.EMAIL_SESSION_HMAC_SECRET).update('session:'+token).digest('hex'));
  let current={...session},reads=0;
  const auth=createIdentityAuthenticator({now:()=>now,findSession:async hash=>{
    reads++;assert.equal(hash,await emailSessionHash(token,env.EMAIL_SESSION_HMAC_SECRET));return current;
  }});
  const identity=await auth(request('Session '+token),env);assert.equal(identity.kind,'email');assert.equal(identity.user_id,session.user_id);
  current={...session,status:'revoked',revoked_at:new Date(now).toISOString()};
  await assert.rejects(()=>auth(request('Session '+token),env),/SESSION_REVOKED/);assert.equal(reads,2);
  assert.doesNotMatch(JSON.stringify(identity),/synthetic-email-token|synthetic-email-key/);
});

test('Email unknown, expired, revoked, malformed or missing configuration fails closed',async()=>{
  for(const row of [null,{...session,expires_at:new Date(now).toISOString()},
    {...session,expires_at:'invalid'},{...session,revoked_at:'revoked'},
    {...session,status:'disabled'},{...session,user_id:''},{...session,workspace_id:''}]) {
    const auth=createIdentityAuthenticator({now:()=>now,findSession:async()=>row});
    await assert.rejects(()=>auth(request('Session synthetic-email-token'),env),/AUTH_REQUIRED|SESSION_(EXPIRED|REVOKED)/);
  }
  const auth=createIdentityAuthenticator({now:()=>now,findSession:async()=>session});
  await assert.rejects(()=>auth(request('Session synthetic-email-token'),{}),/AUTH_UNAVAILABLE/);
});

test('Email expiry is checked after the actual session lookup completes',async()=>{
  let clock=now;
  const auth=createIdentityAuthenticator({now:()=>clock,findSession:async()=>{
    clock+=1000;return {...session,expires_at:new Date(now+500).toISOString()};
  }});
  await assert.rejects(()=>auth(request('Session synthetic-email-token'),env),/SESSION_EXPIRED/);
});
