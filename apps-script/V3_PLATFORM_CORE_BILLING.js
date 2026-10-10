const PLATFORM_CORE_MODE_HEADERS_=['mode_intent_id','mode_applied_at','mode_audit_status'];
function platformCoreBillingInit_(request) {
  try {
    const access=platformCoreResolveBillingPrincipal_(request),provision=retryCommercialWorkspaceProvisioning_(access);
    const basic={workspace_id:access.workspace.workspace_id,workspace_name:access.workspace.workspace_name,line_linked:!!access.user.line_user_id,can_purchase:['owner','admin'].indexOf(access.membership.role)>=0,csrf_token:platformCoreIssueBillingCsrf_(access),provisioning_status:provision.success?'READY':'PROVISIONING_PENDING'};
    if(!provision.success)return workspaceResult_(true,'PROVISIONING_PENDING','訂閱帳號等待連線，請重試',basic);
    const me=platformCoreSendVerifiedHuman_(access,'admin/me',{},undefined),link=platformCoreReadWorkspaceLink_(access.workspace.workspace_id);
    return workspaceResult_(true,'OK','',{...basic,company_id:me.company_id,product_id:me.product_id,mode:link.mode,me:me.me});
  }catch(error){return platformCoreBillingFailure_(error);}
}
function platformCoreBillingCall_(request,operation,payload,key) {
  try {
    const access=platformCoreResolveBillingPrincipal_(request);platformCoreVerifyBillingCsrf_(access,request.csrf_token);
    if(!CMWebsCoreBillingContracts.isBillingOperation(operation) || operation.indexOf('admin/workspace-mode/')===0)throw platformCoreBillingError_('INVALID_REQUEST');
    const mutation=!operation.endsWith('/query') && operation!=='admin/me';
    if(operation.indexOf('member/')===0 && mutation && ['owner','admin'].indexOf(access.membership.role)<0)throw platformCoreBillingError_('AUTHORIZATION_DENIED');
    return workspaceResult_(true,'OK','',platformCoreSendVerifiedHuman_(access,operation,payload,key));
  }catch(error){return platformCoreBillingFailure_(error);}
}
function platformCoreRetryBillingProvisioning_(request) {
  try {const access=platformCoreResolveBillingPrincipal_(request);platformCoreVerifyBillingCsrf_(access,request.csrf_token);return retryCommercialWorkspaceProvisioning_(access);}catch(error){return platformCoreBillingFailure_(error);}
}
function platformCoreApplyBillingMode_(request,workspaceId,mode,reason,key) {
  try {
    const access=platformCoreResolveBillingPrincipal_(request);platformCoreVerifyBillingCsrf_(access,request.csrf_token);
    const intent=platformCoreSendVerifiedHuman_(access,'admin/workspace-mode/authorize',{external_workspace_id:workspaceId,mode:mode,reason:reason},key),lock=LockService.getScriptLock();let appliedAt;
    try {
      lock.waitLock(5000);
      const sheet=commercialRegistrationSheet_(PLATFORM_CORE_LINK_SHEET_,PLATFORM_CORE_LINK_HEADERS_.concat(PLATFORM_CORE_MODE_HEADERS_)),matches=workspaceGetObjectsWithRow_(sheet).filter(function(row){return row.workspace_id===workspaceId;}),link=matches[0],at=new Date(workspaceNowIso_());
      if(matches.length!==1 || intent.external_workspace_id!==workspaceId || intent.target_mode!==mode || intent.target_company_id!==link.platform_company_id || intent.product_id!==link.product_id || link.status!=='LINKED')throw platformCoreBillingError_('AUTHORIZATION_DENIED');
      if(link.mode_intent_id===intent.intent_id && link.mode===mode && link.mode_applied_at){appliedAt=link.mode_applied_at;}
      else {
        if(Date.parse(intent.expires_at)<=at.getTime() || (link.mode_applied_at && Date.parse(link.mode_applied_at)>Date.parse(intent.expires_at)-60000))throw platformCoreBillingError_('ORDER_CONFLICT');
        appliedAt=at.toISOString();landlordEmailAuthUpdateRow_(sheet,link,{mode:mode,mode_intent_id:intent.intent_id,mode_applied_at:appliedAt,mode_audit_status:'PENDING',updated_at:appliedAt});SpreadsheetApp.flush();
      }
    }finally{try{lock.releaseLock();}catch(_){}}
    try{platformCoreSendVerifiedHuman_(access,'admin/workspace-mode/applied',{intent_id:intent.intent_id,applied_at:appliedAt},'mode_applied_'+platformCoreBillingHash_(key));}catch(_){throw platformCoreBillingError_('MODE_AUDIT_PENDING');}
    const complete=LockService.getScriptLock();try{complete.waitLock(5000);const sheet=runtimeSpreadsheet_().getSheetByName(PLATFORM_CORE_LINK_SHEET_),link=workspaceGetObjectsWithRow_(sheet).find(function(row){return row.workspace_id===workspaceId;});if(!link || link.mode_intent_id!==intent.intent_id)throw platformCoreBillingError_('ORDER_CONFLICT');landlordEmailAuthUpdateRow_(sheet,link,{mode_audit_status:'SYNCED',updated_at:workspaceNowIso_()});SpreadsheetApp.flush();}finally{try{complete.releaseLock();}catch(_){}}
    return workspaceResult_(true,'OK','設定已儲存',{workspace_id:workspaceId,mode:mode,audit_status:'SYNCED'});
  }catch(error){return platformCoreBillingFailure_(error);}
}
function platformCoreDispatchBilling_(action,request) {
  if(action==='commercial_billing_link_line')return platformCoreLinkBillingLine_(request);
  if(action==='commercial_billing_init')return platformCoreBillingInit_(request);
  if(action==='commercial_billing_retry_provisioning')return platformCoreRetryBillingProvisioning_(request);
  if(action==='commercial_billing_workspace_mode')return platformCoreApplyBillingMode_(request,request.target_workspace_id,request.mode,request.reason,request.idempotency_key);
  if(action==='commercial_billing'){let payload;try{payload=JSON.parse(request.payload_json);}catch(_){return platformCoreBillingFailure_(platformCoreBillingError_('INVALID_REQUEST'));}return platformCoreBillingCall_(request,request.operation,payload,request.idempotency_key || undefined);}
  return platformCoreBillingFailure_(platformCoreBillingError_('INVALID_REQUEST'));
}
/** Explicit self-link: both Email login and a provider-verified LINE token required. */
function platformCoreLinkBillingLine_(request) {
  try {
    if(!request.landlord_session_token || (request.link_confirmed!==true && request.link_confirmed!=='true'))throw platformCoreBillingError_('AUTHENTICATION_REQUIRED');
    const access=platformCoreResolveBillingPrincipal_(request);platformCoreVerifyBillingCsrf_(access,request.csrf_token);
    const verified=commercialRegistrationVerifyLineToken_(request.link_id_token || '');if(!verified || !verified.success)throw platformCoreBillingError_('AUTHENTICATION_REQUIRED');
    const lineId=verified.data.line_user_id,lock=LockService.getScriptLock();
    try {
      lock.waitLock(5000);const ss=runtimeSpreadsheet_(),users=ss.getSheetByName('V2_users'),rows=workspaceGetObjectsWithRow_(users),user=rows.find(function(row){return row.user_id===access.user.user_id;}),workspace=workspaceGetObjectsWithRow_(ss.getSheetByName('V2_workspaces')).find(function(row){return row.workspace_id===access.workspace.workspace_id;}),members=workspaceGetObjectsWithRow_(ss.getSheetByName('V2_workspace_members')),member=members.find(function(row){return row.user_id===access.user.user_id && row.workspace_id===access.workspace.workspace_id;});
      if(!user || user.account_status!=='active' || user.active_workspace_id!==access.workspace.workspace_id || !workspace || workspace.account_status!=='active' || !member || member.member_status!=='active' || (user.line_user_id && user.line_user_id!==lineId) || rows.some(function(row){return row.line_user_id===lineId && row.user_id!==user.user_id;}))throw platformCoreBillingError_('AUTHORIZATION_DENIED');
      const now=workspaceNowIso_();landlordEmailAuthUpdateRow_(users,user,{line_user_id:lineId,updated_at:now});members.filter(function(row){return row.user_id===user.user_id;}).forEach(function(row){landlordEmailAuthUpdateRow_(ss.getSheetByName('V2_workspace_members'),row,{line_user_id:lineId,updated_at:now});});
      const landlords=ss.getSheetByName('V2_landlords');workspaceGetObjectsWithRow_(landlords).filter(function(row){return (row.user_id || row.landlord_user_id)===user.user_id;}).forEach(function(row){landlordEmailAuthUpdateRow_(landlords,row,{line_user_id:lineId,landlord_line_user_id:lineId,updated_at:now});});
      workspaceWriteActivityLog_({workspace_id:access.workspace.workspace_id,user_id:user.user_id,membership_id:member.membership_id,line_user_id:lineId,action:'commercial_self_line_linked',target_type:'user',target_id:user.user_id,result:'success',detail:'Verified Email session and verified LINE with explicit consent'});SpreadsheetApp.flush();
      return workspaceResult_(true,'OK','LINE 已連接，沿用原帳號與工作區',{line_linked:true,workspace_id:access.workspace.workspace_id});
    }finally{try{lock.releaseLock();}catch(_){}}
  }catch(error){return platformCoreBillingFailure_(error);}
}
