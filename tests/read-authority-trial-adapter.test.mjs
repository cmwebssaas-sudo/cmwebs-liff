import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {authorityRuntime,authoritySecret} from './fixtures/read-parity/authority-runtime.mjs';
import {trialEntryRuntime,trialSigned,trialDocument,trialBudgetKey} from './fixtures/read-parity/trial-entry-runtime.mjs';
const result=response=>response.body?JSON.parse(response.body).result:response;
function safe(h,response){assert.equal(h.calls.native,0);assert.equal(h.calls.lockDepth,0);assert.ok(h.calls.maxLockDepth<=1);
  assert.doesNotMatch(JSON.stringify(response)+h.logs.join('\n'),/PRIVATE_TRIAL_SENTINEL|synthetic-google-token|synthetic-email-token|example.invalid/);
  if(response.body)assert.equal(response.signature,createHmac('sha256',authoritySecret).update('cmwebs-read-auth-response-v1\n'+response.body).digest('hex'));
}
for(const role of ['owner','admin','manager','accountant','maintenance','viewer'])for(const protocol of ['session','liff'])test('readonly trial adapter canonical '+role+' '+protocol,()=>{
  const h=trialEntryRuntime(),oracle=authorityRuntime();for(const current of [h,oracle]){current.data.V2_workspace_members[0].role=role;current.data.V2_landlord_email_sessions[0].role=role;}
  const actual=h.call(protocol),expected=oracle.post(trialSigned(oracle,protocol));assert.equal(result(actual).success,true);assert.deepEqual(result(actual),result(expected));assert.equal(h.calls.google,1);assert.equal(h.calls.tokens,1);assert.equal(JSON.parse(h.cache.get(trialBudgetKey)).remaining,34);safe(h,actual);
});
for(const [name,change] of [
 ['session revoked',h=>h.data.V2_landlord_email_sessions[0].status='revoked'],['user disabled',h=>h.data.V2_users[0].account_status='disabled'],
 ['workspace disabled',h=>h.data.V2_workspaces[0].account_status='disabled'],['member suspended',h=>h.data.V2_workspace_members[0].member_status='suspended'],
 ['role changed',h=>h.data.V2_workspace_members[0].role='viewer'],['cross workspace',h=>h.data.V2_landlord_email_sessions[0].workspace_id='OTHER']
])test('next request sees source-only '+name,()=>{const h=trialEntryRuntime();assert.equal(result(h.call()).success,true);change(h);const response=h.call();assert.equal(result(response).success,false);assert.equal(h.calls.google,2);safe(h,response);});
test('Date expiry keeps exact one-millisecond boundary',()=>{const h=trialEntryRuntime();h.data.V2_landlord_email_sessions[0].expires_at=new Date(h.clock()+1);assert.equal(result(h.call()).success,true);h.advance(1);const response=h.call();assert.equal(result(response).success,false);safe(h,response);});
for(const [name,change] of [
 ['header rename',doc=>doc.sheets[1].data[0].rowData[0].values[0].effectiveValue.stringValue='private_name'],
 ['header reorder',doc=>doc.sheets[1].data[0].rowData[0].values.reverse()],
 ['private field insertion',doc=>{for(const row of doc.sheets[1].data[0].rowData)row.values.splice(1,0,{effectiveValue:{stringValue:'PRIVATE_TRIAL_SENTINEL'}});}],
 ['duplicate header',doc=>doc.sheets[1].data[0].rowData[0].values[1]=doc.sheets[1].data[0].rowData[0].values[0]],
 ['tab retarget',doc=>doc.sheets[1].properties.sheetId=99],['sheet retarget',doc=>doc.spreadsheetId='OTHER'],
 ['timezone retarget',doc=>doc.properties.timeZone='GMT'],['missing table',doc=>doc.sheets.pop()],
 ['cell error',doc=>doc.sheets[1].data[0].rowData[1].values[0]={effectiveValue:{errorValue:{message:'PRIVATE_TRIAL_SENTINEL'}}}],
 ['unknown populated table',doc=>doc.sheets.push({properties:{title:'V2_private',sheetId:99},data:[{rowData:[{values:[{effectiveValue:{stringValue:'PRIVATE_TRIAL_SENTINEL'}}]}]}]})]
])test('same response schema fails closed: '+name,()=>{const h=trialEntryRuntime();h.setBody(()=>{const doc=trialDocument(h);change(doc);return JSON.stringify(doc);});const response=h.call();assert.equal(result(response).success,false);assert.equal(h.calls.google,1);safe(h,response);});
for(const [name,setup] of [
 ['missing budget',h=>h.cache.delete(trialBudgetKey)],['malformed budget',h=>h.cache.set(trialBudgetKey,'not JSON')],
 ['insufficient budget',h=>h.cache.set(trialBudgetKey,JSON.stringify({remaining:5,expires_at:h.clock()+10000,requests:[]}))],
 ['expired budget',h=>h.cache.set(trialBudgetKey,JSON.stringify({remaining:40,expires_at:h.clock(),requests:[]}))],
 ['rate limited',h=>h.cache.set(trialBudgetKey,JSON.stringify({remaining:40,expires_at:h.clock()+10000,requests:Array(10).fill(h.clock())}))]
])test('budget denies Google token and read: '+name,()=>{const h=trialEntryRuntime();setup(h);const response=h.call();assert.equal(result(response).success,false);assert.equal(h.calls.google,0);assert.equal(h.calls.tokens,0);safe(h,response);});
test('six conservative reads charged per grid request; no reset or seventh request',()=>{const h=trialEntryRuntime();for(let i=0;i<6;i++)assert.equal(result(h.call()).success,true);const response=h.call();assert.equal(result(response).success,false);assert.equal(h.calls.google,6);assert.equal(JSON.parse(h.cache.get(trialBudgetKey)).remaining,4);safe(h,response);});
for(const mode of ['ignore','drop'])test('unconfirmed budget debit rejects before token/Google IO: '+mode,()=>{
  const h=trialEntryRuntime();h.setBudgetPut(mode);const response=h.call();assert.equal(result(response).success,false);assert.equal(h.calls.tokens,0);assert.equal(h.calls.google,0);safe(h,response);
});
for(const status of [403,429,503])test('Google HTTP'+status+' denies without native fallback, retry or budget refund',()=>{const h=trialEntryRuntime();h.setStatus(status);const response=h.call();assert.equal(result(response).success,false);assert.equal(h.calls.google,1);assert.equal(JSON.parse(h.cache.get(trialBudgetKey)).remaining,34);safe(h,response);});
test('malformed or oversized response denies without leaking error text',()=>{for(const body of ['PRIVATE_TRIAL_SENTINEL','x'.repeat(1000001)]){const h=trialEntryRuntime();h.setBody(()=>body);const response=h.call();assert.equal(result(response).success,false);assert.equal(h.calls.google,1);safe(h,response);}});
test('forged request, nonce replay and invalid LINE never preload Google rows',()=>{
  const h=trialEntryRuntime(),r=trialSigned(h);assert.equal(h.context.authorizeTrial({...r,signature:'0'.repeat(64)},'authority').success,false);assert.equal(h.calls.google,0);
  assert.equal(result(h.context.authorizeTrial(r,'authority')).success,true);assert.equal(h.context.authorizeTrial(r,'authority').success,false);assert.equal(h.calls.google,1);
  const invalid=h.call('liff','synthetic-invalid-line-token');assert.equal(result(invalid).success,false);assert.equal(h.calls.google,1);safe(h,invalid);
});
test('LINE waiting change is observed by the later Google frame',()=>{const h=trialEntryRuntime();h.onLine(()=>h.data.V2_users[0].account_status='disabled');const response=h.call('liff');assert.equal(result(response).success,false);assert.equal(h.calls.google,1);safe(h,response);});
test('original dirty and lease markers remain authoritative across requests',()=>{const h=trialEntryRuntime();for(const key of ['cmwebs:read-replica:dirty:V2_bills','cmwebs:read-replica:lease']){h.cache.set(key,'pending');const response=h.call();assert.equal(result(response).success,true);assert.equal(result(response).replica_dirty,true);h.cache.delete(key);safe(h,response);}});
test('invalid contract denied before original nonce/cache or Google IO',()=>{const h=trialEntryRuntime();h.config.C3_TRIAL_SHEET_CONTRACT='PRIVATE_TRIAL_SENTINEL';const before=[...h.cache];const response=h.call();assert.equal(result(response).success,false);assert.deepEqual([...h.cache],before);assert.equal(h.calls.google,0);safe(h,response);});
