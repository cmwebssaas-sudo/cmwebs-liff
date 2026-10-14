import { createReplicaRuntime } from './read-runtime.js';
import { createReadCalculator } from './read-calculator.js';
const text=value=>String(value??'').trim();
function deny(code='AUTH_REQUIRED'){throw Object.assign(new Error(code),{code});}

export function resolveReadAccess(dataset,identity,options={}) {
  if(!identity||!['line','email'].includes(identity.kind)) deny();
  const user=(dataset.V2_users||[]).find(row=>identity.kind==='line'
    ?text(row.line_user_id)===identity.line_user_id:text(row.user_id)===identity.user_id);
  if(!user) deny();
  const runtime=createReplicaRuntime(dataset,options),helpers=createReadCalculator(runtime);
  if(!helpers.workspaceIsActiveStatus_(user.account_status||'active')) deny('USER_ACCOUNT_INACTIVE');
  if(identity.kind==='email'&&!helpers.landlordEmailAuthUserCanLogin_(user)) deny();
  const uid=text(user.line_user_id);
  if(!uid) deny('READ_IDENTITY_UNSUPPORTED');
  if((dataset.V2_users||[]).filter(row=>text(row.line_user_id)===uid).length!==1) deny();
  const context=helpers.workspaceResolveContextByLineUid_(runtime.runtimeSpreadsheet_(),uid,{require_onboarding:true});
  const workspace=context.activeWorkspace,membership=context.activeMembership;
  if(!workspace||!membership) deny('WORKSPACE_REQUIRED');
  if(text(context.user?.user_id)!==text(user.user_id)||text(membership.user_id)!==text(user.user_id)) deny();
  if(!helpers.workspaceIsActiveStatus_(workspace.account_status||'active')) deny('WORKSPACE_INACTIVE');
  if(!helpers.workspaceIsActiveStatus_(membership.member_status||'active')) deny('MEMBERSHIP_INACTIVE');
  if(!helpers.workspaceOnboardingComplete_(workspace.onboarding_status)) deny('ONBOARDING_REQUIRED');
  if(!helpers.V2_WORKSPACE_ROLES_.includes(text(membership.role).toLowerCase())) deny('PERMISSION_DENIED');
  if(identity.kind==='email'&&(!identity.session||text(identity.session.workspace_id)!==text(workspace.workspace_id)||text(identity.session.role)!==text(membership.role))) deny('WORKSPACE_FORBIDDEN');
  const principals=helpers.workspaceLandlordResolvePrincipals_(runtime.runtimeSpreadsheet_(),context);
  const principal=principals[0];
  if(!principal||!principal.line_user_id) deny('READ_IDENTITY_UNSUPPORTED');
  return {success:true,line_user_id:uid,user,workspace,membership,
    permissions:helpers.workspaceBuildPermissionView_(membership),principals,principal,
    principal_line_user_id:principal.line_user_id,principal_landlord_id:principal.landlord_id,
    delegated:principal.line_user_id!==uid};
}
