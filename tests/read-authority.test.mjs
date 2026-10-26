import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReadCalculator } from '../cloudflare/read-api/src/read-calculator.js';
import { createReplicaRuntime } from '../cloudflare/read-api/src/read-runtime.js';
import { createHash,createHmac,randomUUID } from 'node:crypto';
import { authorityRuntime,authoritySecret } from './fixtures/read-parity/authority-runtime.mjs';
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
const readAccessFingerprint=access=>createReadCalculator(createReplicaRuntime({})).readAuthorizationFingerprint_(access);
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
