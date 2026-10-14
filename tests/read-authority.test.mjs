import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash,createHmac,randomUUID } from 'node:crypto';
import { authorityRuntime,authoritySecret } from './fixtures/read-parity/authority-runtime.mjs';
import { confirmReadAuthority,readAccessFingerprint } from '../cloudflare/read-api/src/read-authority.js';
import { access,plain } from './fixtures/read-parity/runtime.mjs';

const env={READ_AUTHORITY_URL:'https://script.google.com/macros/s/SYNTHETIC_DEPLOYMENT/exec',READ_REPLICA_SYNC_SECRET:authoritySecret};
function signed(h,protocol='liff',credential='synthetic-valid-line-token',overrides={}) {
  const payload=JSON.stringify({protocol,credential,credential_digest:createHash('sha256').update(protocol+':'+credential).digest('hex'),route:'/v1/arrears'});
  const request={action:'read_replica_authorize',timestamp:h.clock(),nonce:randomUUID(),payload,...overrides};
  request.signature=createHmac('sha256',authoritySecret).update('cmwebs-read-auth-request-v1\n'+request.timestamp+'\n'+request.nonce+'\n'+request.payload).digest('hex');
  return request;
}
function currentAccess(h) {return {...access,user:h.data.V2_users[0],membership:h.data.V2_workspace_members[0]};}
function request(protocol='LIFF',token='synthetic-valid-line-token') {return new Request('https://local.test/v1/arrears',{headers:{authorization:protocol+' '+token}});}
test('actual GAS dispatcher independently confirms LINE/Email and signs only an immutable authorization fingerprint',()=>{
  const h=authorityRuntime();
  for(const [protocol,token] of [['liff','synthetic-valid-line-token'],['session','synthetic-email-token']]) {
    const result=h.post(signed(h,protocol,token)),body=JSON.parse(result.body);
    assert.equal(body.result.success,true,JSON.stringify(result));
    assert.deepEqual(body.result.fingerprint,readAccessFingerprint(currentAccess(h)));
    assert.equal(result.signature,createHmac('sha256',authoritySecret).update('cmwebs-read-auth-response-v1\n'+result.body).digest('hex'));
    assert.doesNotMatch(result.body,/synthetic-email-token|synthetic-valid-line-token|example.invalid|tenant_name|"bank_account"/);
  }
  assert.doesNotMatch(h.logs.join('\n'),/synthetic-email-token|synthetic-valid-line-token|SYNTHETIC_U1|SYNTHETIC_LINE1/);
});
test('GAS rejects forged, replayed, stale, identity-widening and wrong-domain confirmations',()=>{
  const h=authorityRuntime(),valid=signed(h);assert.ok(h.post(valid).body);
  assert.equal(h.post(valid).success,false);
  for(const request of [signed(h,'liff','synthetic-valid-line-token',{timestamp:h.clock()-15001}),
    {...signed(h),workspace_id:'SYNTHETIC_W2'}, {...signed(h),signature:'0'.repeat(64)},
    signed(h,'liff','synthetic-valid-line-token',{payload:JSON.stringify({protocol:'liff',credential:'synthetic-valid-line-token',credential_digest:'wrong',route:'/v1/arrears'})})]) assert.equal(h.post(request).success,false);
  const wrong=signed(h);wrong.signature=createHmac('sha256',authoritySecret).update('cmwebs-read-auth-response-v1\n'+wrong.payload).digest('hex');assert.equal(h.post(wrong).success,false);
});
test('Worker accepts only its own fresh signed nonce/credential/route and matching primary D1 fingerprint',async()=>{
  const h=authorityRuntime(),options={now:h.clock,fetch:async(_url,config)=>Response.json(h.post(JSON.parse(config.body)))};
  await confirmReadAuthority(request(),env,currentAccess(h),options);
  await confirmReadAuthority(request('Session','synthetic-email-token'),env,currentAccess(h),options);
  const changed={...currentAccess(h),membership:{...currentAccess(h).membership,role:'viewer'}};
  await assert.rejects(()=>confirmReadAuthority(request(),env,changed,options),/READ_AUTH_STATE_CHANGED/);
  let old;
  await confirmReadAuthority(request(),env,currentAccess(h),{...options,fetch:async(_url,config)=>{old=h.post(JSON.parse(config.body));return Response.json(old);}});
  await assert.rejects(()=>confirmReadAuthority(request(),env,currentAccess(h),{...options,fetch:async()=>Response.json(old)}),/READ_AUTHORITY_UNAVAILABLE/);
});
test('an undelivered revocation/access change is denied even while replica state is unchanged',async()=>{
  for(const mutate of [h=>h.data.V2_landlord_email_sessions[0].status='revoked',
    h=>h.data.V2_users[0].account_status='disabled',h=>h.data.V2_workspace_members[0].member_status='suspended',
    h=>h.data.V2_workspaces[0].account_status='disabled',h=>h.data.V2_workspace_members[0].role='viewer']) {
    const h=authorityRuntime(),replica=plain(currentAccess(h));
    const options={now:h.clock,fetch:async(_url,config)=>Response.json(h.post(JSON.parse(config.body)))};
    await confirmReadAuthority(request('Session','synthetic-email-token'),env,replica,options);
    mutate(h);
    await assert.rejects(()=>confirmReadAuthority(request('Session','synthetic-email-token'),env,replica,options),/AUTH_REQUIRED|READ_AUTH_STATE_CHANGED/);
  }
});
test('authority outage, malicious redirects, damaged MAC and expired responses fail closed',async()=>{
  const h=authorityRuntime();
  for(const fetch of [async()=>{throw new Error('private network details');},async()=>new Response('',{status:503}),
    async()=>new Response('',{status:302,headers:{location:'https://private.invalid/credential-destination'}}),
    async(_url,config)=>{const reply=h.post(JSON.parse(config.body));reply.signature='0'.repeat(64);return Response.json(reply);},
    async(_url,config)=>{const reply=h.post(JSON.parse(config.body));h.advance(5001);return Response.json(reply);}]) {
    await assert.rejects(()=>confirmReadAuthority(request(),env,currentAccess(h),{now:h.clock,fetch}),/READ_AUTHORITY_UNAVAILABLE/);
  }
});

test('authority response byte bound cancels an oversized multi-chunk UTF-8 stream before reading it all',async()=>{
  const h=authorityRuntime();let chunks=0,cancelled=false;
  const fetch=async()=>new Response(new ReadableStream({pull(controller){chunks++;controller.enqueue(new TextEncoder().encode('漢'.repeat(2500)));},cancel(){cancelled=true;}}));
  await assert.rejects(()=>confirmReadAuthority(request(),env,currentAccess(h),{now:h.clock,fetch}),/READ_AUTHORITY_UNAVAILABLE/);
  assert.equal(cancelled,true);assert.ok(chunks<=4,'stream was stopped at the byte cap');
});
