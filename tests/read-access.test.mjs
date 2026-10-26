import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveReadAccess } from '../cloudflare/read-api/src/read-access.js';
import { richDataset, access, originalGas } from './fixtures/read-parity/runtime.mjs';

function input() {
  const data=richDataset();Object.assign(data.V2_users[0],{email:'synthetic@example.invalid',email_verified_at:'2026-10-01',email_login_enabled:true});return data;
}
const line={kind:'line',line_user_id:'SYNTHETIC_LINE1'};
const email={kind:'email',user_id:'SYNTHETIC_U1',session:{workspace_id:'SYNTHETIC_W1',role:'owner'}};
test('verified identity resolves canonical Workspace, membership, principal and permissions',()=>{
  const data=input(),resolved=resolveReadAccess(data,line);
  const gas=originalGas(data);
  const ss=gas.runtimeSpreadsheet_();
  const context=gas.workspaceResolveContextByLineUid_(ss,line.line_user_id,{require_onboarding:true});
  const principals=JSON.parse(JSON.stringify(gas.workspaceLandlordResolvePrincipals_(ss,context)));
  assert.equal(resolved.user.user_id,context.user.user_id);
  assert.equal(resolved.workspace.workspace_id,context.activeWorkspace.workspace_id);
  assert.deepEqual(resolved.principals,principals);
  assert.deepEqual(resolved.permissions,JSON.parse(JSON.stringify(gas.workspaceBuildPermissionView_(context.activeMembership))));
  assert.equal(resolveReadAccess(data,email).workspace.workspace_id,resolved.workspace.workspace_id);
});
test('account, membership, Workspace, onboarding and role changes are rechecked on every read',()=>{
  const cases=[
    data=>data.V2_users[0].account_status='disabled',
    data=>data.V2_workspaces[0].account_status='disabled',
    data=>data.V2_workspace_members[0].member_status='suspended',
    data=>data.V2_workspace_members[0].role='tenant',
    data=>data.V2_workspaces[0].onboarding_status='pending',
    data=>data.V2_workspace_members=[],
    data=>data.V2_users=[]
  ];
  for(const mutate of cases){const data=input();resolveReadAccess(data,line);mutate(data);assert.throws(()=>resolveReadAccess(data,line));}
  const foreign={kind:'line',line_user_id:'SYNTHETIC_OTHER_USER'};
  assert.throws(()=>resolveReadAccess(input(),foreign));
});
test('Email requires current login eligibility and matching session Workspace/role',()=>{
  for(const mutate of [data=>data.V2_users[0].email_login_enabled=false,data=>data.V2_users[0].email_verified_at='',
    data=>data.V2_users[0].role='tenant',data=>data.V2_workspace_members[0].role='admin']) {
    const data=input();mutate(data);assert.throws(()=>resolveReadAccess(data,email));
  }
  assert.throws(()=>resolveReadAccess(input(),{...email,session:{workspace_id:'SYNTHETIC_W2',role:'owner'}}));
});
test('unknown/unbound legacy identity stays on GAS rather than inventing a principal',()=>{
  const data=input();data.V2_users[0].line_user_id='';
  assert.throws(()=>resolveReadAccess(data,email),/READ_IDENTITY_UNSUPPORTED/);
  assert.throws(()=>resolveReadAccess(input(),{kind:'unverified',line_user_id:'SYNTHETIC_LINE1'}));
});

test('canonical principal inference respects an explicit Workspace before legacy owner relationships',()=>{
  const data=input();
  const owner=data.V2_landlords[0];
  data.V2_landlords.push({...owner,landlord_id:'SYNTHETIC_FOREIGN_OWNER',workspace_id:'SYNTHETIC_W2',user_id:data.V2_users[0].user_id});
  const gas=originalGas(data),ss=gas.runtimeSpreadsheet_();
  const context=gas.workspaceResolveContextByLineUid_(ss,line.line_user_id);
  const principals=JSON.parse(JSON.stringify(gas.workspaceLandlordResolvePrincipals_(ss,context)));
  assert.ok(!principals.some(row=>row.landlord_id==='SYNTHETIC_FOREIGN_OWNER'));
  assert.deepEqual(resolveReadAccess(data,line).principals,principals);
});

test('Email identity cannot acquire another stored user membership through an ambiguous LINE alias',()=>{
  const data=input(),actor=data.V2_users[0],membership=data.V2_workspace_members[0];
  actor.can_edit_bank_account=false;
  data.V2_users.unshift({...actor,user_id:'SYNTHETIC_ALIAS_USER'});
  data.V2_workspace_members.unshift({...membership,membership_id:'SYNTHETIC_ALIAS_MEMBER',user_id:'SYNTHETIC_ALIAS_USER',can_edit_bank_account:true});
  assert.throws(()=>resolveReadAccess(data,email),/AUTH_REQUIRED/);
  data.V2_users.reverse();
  assert.throws(()=>resolveReadAccess(data,email),/AUTH_REQUIRED/);
});
