import assert from 'node:assert/strict';
import test from 'node:test';
import {createCommercialRentalRuntime} from './fixtures/commercial-rental-runtime.mjs';
const input={landlord_name:'Synthetic owner',phone:'0912345678',email:'synthetic@example.invalid',workspace_name:'Synthetic team',terms_accepted:true};
function setup(){let calls=0,timeout=false;const r=createCommercialRentalRuntime({transport:(access,_op,_body,_key)=>{calls++;if(timeout)throw new Error('Private timeout');return {status:'READY',company_id:'com_test_'+access.workspace.workspace_id,product_id:'prd_commercial_test',platform_user_id:'usr_fixture',external_workspace_id:access.workspace.workspace_id};}});return {...r,calls:()=>calls,timeout:value=>{timeout=value;}};}
function otp(r){return r.state.mail.at(-1).body.match(/\b\d{6}\b/)[0];}
test('unverified LINE display Email cannot reserve the verified Email login identity',()=>{
 const r=setup();assert.equal(r.api.registerCommercialLandlordByVerifiedLine_('verified-line-token',input,{}).success,true);
 const challenge=r.api.requestCommercialEmailRegistration_(input.email,{});assert.equal(challenge.success,true);assert.ok(challenge.data.challenge_id);
 const verified=r.api.verifyCommercialEmailRegistration_(challenge.data.challenge_id,otp(r),{...input,phone:'0923456789'},{});assert.equal(verified.success,true);
 const users=r.sheets.V2_users.objects();assert.equal(users.length,2);assert.notEqual(users[0].user_id,users[1].user_id);assert.equal(users[0].email_login_enabled,false);assert.equal(users[1].email_login_enabled,true);
 r.state.now='2026-10-11T00:01:01Z';assert.equal(r.api.requestLandlordEmailLogin_(input.email,{}).success,true);
 r.api.landlordEmailAuthUpdateRow_(r.sheets.V2_users,users[1],{account_status:'disabled'});
 assert.equal(r.api.requestCommercialEmailRegistration_(input.email,{}).code,'ALREADY_REGISTERED');
});
test('commercial registration runs with the original production clock without a VM-only helper',()=>{
 const r=setup();delete r.api.workspaceNowIso_;
 const challenge=r.api.requestCommercialEmailRegistration_(input.email,{});
 assert.equal(challenge.success,true,challenge.code);
 assert.equal(r.api.verifyCommercialEmailRegistration_(challenge.data.challenge_id,otp(r),input,{}).success,true);
});
test('new Email registration requires a bounded one-use challenge and a stable Core retry',()=>{
  const r=setup(),api=r.api;assert.equal(api.verifyCommercialEmailRegistration_('fake','123456',input,{}).success,false);assert.equal(r.sheets.V2_users.objects().length,0);
  const issued=api.requestCommercialEmailRegistration_(input.email,{});assert.equal(issued.success,true);const code=otp(r);r.timeout(true);
  const registered=api.verifyCommercialEmailRegistration_(issued.data.challenge_id,code,input,{});assert.equal(registered.success,true);assert.equal(registered.data.provisioning_status,'PROVISIONING_PENDING');assert.ok(registered.data.session_token);
  assert.equal(r.sheets.V2_users.objects().length,1);assert.equal(r.sheets.V2_workspaces.objects().length,1);assert.equal(r.sheets.V3_platform_core_workspace_links.objects()[0].mode,'enforce');
  assert.equal(api.verifyCommercialEmailRegistration_(issued.data.challenge_id,code,input,{}).success,false);assert.equal(r.sheets.V2_workspaces.objects().length,1);
  r.timeout(false);const session=api.resolveLandlordEmailSession_(registered.data.session_token,'fixture-retry',{});assert.equal(session.success,true);
  const access=api.commercialRegistrationTrustAccess_(session.data);assert.equal(api.retryCommercialWorkspaceProvisioning_(access).success,true);assert.equal(api.retryCommercialWorkspaceProvisioning_(access).success,true);assert.equal(r.sheets.V2_workspaces.objects().length,1);assert.equal(r.sheets.V3_platform_core_member_provisioning.objects()[0].status,'READY');
  assert.equal(api.requestCommercialEmailRegistration_(input.email,{}).code,'ALREADY_REGISTERED');
});
test('LINE registration verifies provider tokens, never trusts UID, and does not merge displayed Email',()=>{
  const r=setup();assert.equal(r.api.registerCommercialLandlordByVerifiedLine_('forged-token',{...input,line_user_id:'line-verified'},{}).success,false);assert.equal(r.sheets.V2_users.objects().length,0);
  const email=r.api.requestCommercialEmailRegistration_(input.email,{});assert.equal(r.api.verifyCommercialEmailRegistration_(email.data.challenge_id,otp(r),input,{}).success,true);
  const line=r.api.registerCommercialLandlordByVerifiedLine_('verified-line-token',{...input,phone:'0923456789'},{});assert.equal(line.success,true);assert.equal(r.sheets.V2_users.objects().length,2);assert.equal(r.sheets.V2_users.objects()[1].email_login_enabled,false);assert.equal(r.api.registerLandlordWorkspaceByLineUid_('forged','Owner','0934567890','','Team','','').success,false);
  assert.equal(r.api.registerCommercialLandlordByVerifiedLine_('verified-line-token',{...input,phone:'0923456789'},{}).code,'ALREADY_REGISTERED');assert.equal(r.sheets.V2_workspaces.objects().length,2);
});
test('registration bounds wrong codes, rate limits, consent, Email mismatch and unverified provisioning',()=>{
  const r=setup(),issued=r.api.requestCommercialEmailRegistration_(input.email,{});let result;
  for(let i=0;i<5;i++)result=r.api.verifyCommercialEmailRegistration_(issued.data.challenge_id,'not-a-code',input,{});
  assert.equal(result.code,'CHALLENGE_LOCKED');assert.equal(r.api.requestCommercialEmailRegistration_(input.email,{}).success,false);assert.equal(r.sheets.V2_workspaces.objects().length,0);
  const second=setup(),challenge=second.api.requestCommercialEmailRegistration_(input.email,{});assert.equal(second.api.verifyCommercialEmailRegistration_(challenge.data.challenge_id,otp(second),{...input,email:'other@example.invalid'},{}).success,false);assert.equal(second.api.verifyCommercialEmailRegistration_(challenge.data.challenge_id,otp(second),{...input,terms_accepted:false},{}).success,false);
  assert.equal(second.api.provisionCommercialWorkspaceMember_({user:{user_id:'fake'},workspace:{workspace_id:'fake'},membership:{role:'owner'}},'fake').success,false);assert.equal(second.calls(),0);
});
test('a fresh verified challenge recovers partial Sheet writes using the original reserved IDs',()=>{
  const r=setup(),issued=r.api.requestCommercialEmailRegistration_(input.email,{}),append=r.sheets.V2_users.appendRow.bind(r.sheets.V2_users);let fail=true;
  r.sheets.V2_users.appendRow=row=>{if(fail){fail=false;throw new Error('Synthetic interrupted write');}append(row);};
  assert.equal(r.api.verifyCommercialEmailRegistration_(issued.data.challenge_id,otp(r),input,{}).success,false);
  const original=r.sheets.V2_workspaces.objects()[0].workspace_id;r.state.now='2026-10-11T00:01:01Z';
  const retry=r.api.requestCommercialEmailRegistration_(input.email,{});const complete=r.api.verifyCommercialEmailRegistration_(retry.data.challenge_id,otp(r),input,{});assert.equal(complete.success,true);assert.equal(complete.data.workspace_id,original);assert.equal(r.sheets.V2_workspaces.objects().length,1);assert.equal(r.sheets.V2_workspace_members.objects().length,1);assert.equal(r.sheets.V2_users.objects().length,1);
});
test('pending provisioning retries the original workspace name after a rental rename',()=>{
 const names=[];let lost=true;const r=createCommercialRentalRuntime({transport:(access,operation,payload)=>{names.push(payload.workspace_display_name);if(lost)throw new Error('Lost reply');return {status:'READY',company_id:'com_fixture',product_id:'prd_commercial_test',platform_user_id:'usr_fixture',external_workspace_id:access.workspace.workspace_id};}}),challenge=r.api.requestCommercialEmailRegistration_(input.email,{}),registered=r.api.verifyCommercialEmailRegistration_(challenge.data.challenge_id,otp(r),input,{});assert.equal(registered.data.provisioning_status,'PROVISIONING_PENDING');r.api.landlordEmailAuthUpdateRow_(r.sheets.V2_workspaces,r.sheets.V2_workspaces.objects()[0],{workspace_name:'Renamed team'});lost=false;const access=r.api.commercialRegistrationTrustAccess_(r.api.resolveLandlordEmailSession_(registered.data.session_token,'retry',{}).data);access.workspace=r.sheets.V2_workspaces.objects()[0];assert.equal(r.api.retryCommercialWorkspaceProvisioning_(access).success,true);assert.deepEqual(names,['Synthetic team','Synthetic team']);
});
