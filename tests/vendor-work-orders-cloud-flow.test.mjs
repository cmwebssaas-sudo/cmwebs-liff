import test from 'node:test';
import assert from 'node:assert/strict';
import { sqliteD1 } from './helpers/vendor-d1.mjs';
import { createD1StateStore } from '../_dev/vendor-work-orders-cloud/src/d1-state-store.mjs';
import { createAuthStore } from '../_dev/vendor-work-orders-cloud/src/auth-store.mjs';
import { createWorker } from '../_dev/vendor-work-orders-cloud/src/worker.mjs';
import { hashToken } from '../_dev/vendor-work-orders-cloud/src/line-auth-worker.mjs';
import { createSyntheticFixtures } from '../_dev/vendor-work-orders/fixtures.mjs';
const origin = 'https://workorders-test.cmwebs.com';
async function setup() {
  const db = sqliteD1(), store = createD1StateStore({db}), fixture = createSyntheticFixtures();
  fixture.state.partners.forEach(p => p.skills=[{trade:'cleaning',name:'cleaning'}]);
  await store.transact(() => fixture.state);
  const auth = createAuthStore({db}), objects = new Map();
  const bucket = {put: async (key, value) => objects.set(key, value), get: async key => objects.has(key) ? {body:objects.get(key)} : null, delete: async key => objects.delete(key)};
  for (const [name, actor] of Object.entries(fixture.principals)) await auth.put('vendor_session', await hashToken(name), {actor}, Date.parse('2099-01-01'));
  const worker = createWorker({env:{DB:db, ATTACHMENTS:bucket, PUBLIC_ORIGIN:origin}, clock:()=>Date.parse('2026-10-10T00:00:00Z')});
  async function api(actor,path,body,method='POST',key=crypto.randomUUID()) {
    const response=await worker.fetch(new Request(origin+path,{method,headers:{cookie:`vendor_session=${actor}`, 'content-type':'application/json','idempotency-key':key}, ...(body ? {body:JSON.stringify(body)} : {})}));
    const result=await response.json(); return {status:response.status,...result};
  }
  return {worker,store,api,objects};
}
test('cloud landlord directory and fixed-price work order completes with audit and private attachments', async()=>{
  const h=await setup(), a=(path,body,method)=>h.api('landlord_a',path,body,method);
  for(const path of ['/api/partners','/api/priority-rules','/api/service-agreements','/api/line/bindings']) { const r=await a(path,null,'GET'); assert.equal(r.status,200,JSON.stringify({path,...r})); }
  const createdPartner=await a('/api/partners',{name:'New synthetic partner',type:'individual',skills:[{trade:'cleaning',name:'cleaning'}]});
  assert.equal(createdPartner.status,200,JSON.stringify(createdPartner));
  assert.equal((await a('/api/partners/company-a',{skills:[{trade:'cleaning',name:'cleaning'}]},'PATCH')).status,200);
  let result=await a('/api/work-orders',{title:'Synthetic cleaning',trade:'cleaning',area:'Synthetic area',location:'Synthetic location',instructions:'Synthetic instructions',property_id:'property-a'});
  assert.equal(result.status,200,JSON.stringify(result)); let w=result.data;
  result=await a(`/api/work-orders/${w.id}/invitations`,{expected_version:w.version,mode:'manual',partner_id:'company-a',agreement_id:'agreement-a'});
  assert.equal(result.status,200,JSON.stringify(result)); w=result.data;
  result=await h.api('company_a_manager',`/api/assignments/${w.invitations[0].assignment_id}/accept`,{expected_version:w.version,assignee_actor_id:'worker-a'});
  assert.equal(result.status,200,JSON.stringify(result));w=result.data;
  result=await h.api('company_a_worker',`/api/assignments/${w.assignment.id}/start`,{expected_version:w.version});
  assert.equal(result.status,200,JSON.stringify(result)); w=result.data;
  const key='attachment-once', bytes=Uint8Array.from([137,80,78,71,13,10,26,10,1]);
  const upload=()=>h.worker.fetch(new Request(`${origin}/api/work-orders/${w.id}/attachments`,{method:'POST',headers:{cookie:'vendor_session=company_a_worker','content-type':'image/png','x-work-order-version':String(w.version),'idempotency-key':key},body:bytes}));
  let response=await upload(); assert.equal(response.status,200,await response.clone().text());const attachment=(await response.json()).data;
  response=await upload();assert.equal(response.status,200);assert.equal((await response.json()).data.id,attachment.id);assert.equal(h.objects.size,1);
  response=await h.worker.fetch(new Request(`${origin}/api/attachments/${attachment.id}`,{headers:{cookie:'vendor_session=company_a_worker'}}));assert.equal(response.status,200);
  response=await h.worker.fetch(new Request(`${origin}/api/attachments/${attachment.id}`,{headers:{cookie:'vendor_session=company_b_worker'}}));assert.equal(response.status,404);
  response=await h.worker.fetch(new Request(`${origin}/api/attachments/${attachment.id}`,{headers:{cookie:'vendor_session=company_a_worker'}}));assert.equal(response.status,200);
  w=(await a(`/api/work-orders/${w.id}`,null,'GET')).data;
  result=await h.api('company_a_worker',`/api/assignments/${w.assignment.id}/completion`,{expected_version:w.version,description:'Synthetic completion',actual_amount_twd:1500});
  assert.equal(result.status,200,JSON.stringify(result));w=result.data;
  result=await a(`/api/work-orders/${w.id}/acceptance`,{expected_version:w.version,decision:'accept'});
  assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.status,'completed');
  const state=await h.store.read();assert.ok(state.work_order_events.some(row=>row.action==='attachment-download'));
  assert.equal(state.private_attachments.length,1);
});
test('cloud binding invitation replay never stores or repeats raw invitation tokens',async()=>{
  const {api,store}=await setup();
  const request=()=>api('landlord_a','/api/line/invites',{partner_id:'company-a',member_role:'worker'},'POST','invite-once');
  const created=await request();assert.equal(created.status,200);assert.equal(created.data.token.length,43);
  const replay=await request();assert.equal(replay.status,200);assert.equal(replay.data.token,undefined);
  const state=await store.read();assert.equal(state.line_binding_invites.length,1);assert.ok(!JSON.stringify(state).includes(created.data.token));
  assert.equal((await api('landlord_b',`/api/line/invites/${created.data.invite.id}/revoke`,{})).status,403);
});
