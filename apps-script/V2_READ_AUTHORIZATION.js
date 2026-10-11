// Internal request-bound authority confirmation. This never returns operational
// rows and never caches a positive access decision across requests.
const V2_READ_AUTHORIZATION_ROUTES_ = ['/v1/home','/v1/revenue','/v1/tenants','/v1/rooms','/v1/arrears','/v1/properties'];

function readAuthorizationFingerprint_(access) {
  const text = function(value) { return String(value === undefined || value === null ? '' : value).trim(); };
  const member=access.membership,workspace=access.workspace,user=access.user;
  const permissions=workspaceBuildPermissionView_(member);
  const normalized={};
  ['can_manage_team','can_edit_bank_account','can_approve_payment','can_edit_contract','can_terminate_contract','can_delete_data','can_export_data'].forEach(function(key) {normalized[key]=permissions[key]===true;});
  return {user_id:text(user.user_id),line_user_id:text(user.line_user_id),
    workspace_id:text(workspace.workspace_id).toUpperCase(),workspace_status:text(workspace.account_status||'active').toLowerCase(),
    onboarding_status:text(workspace.onboarding_status).toLowerCase(),
    membership_id:text(member.membership_id),membership_user_id:text(member.user_id),
    membership_status:text(member.member_status||'active').toLowerCase(),role:text(member.role).toLowerCase(),permissions:normalized,
    principals:(access.principals||[]).map(function(row) {return {landlord_id:text(row.landlord_id),line_user_id:text(row.line_user_id)};})};
}

function readAuthorizationMac_(domain,text,secret) {
  return readReplicaHex_(Utilities.computeHmacSha256Signature(domain+'\n'+text,secret,Utilities.Charset.UTF_8));
}

function readAuthorizationResolve_(payload) {
  let actor;
  if(payload.protocol==='liff') {
    const verified=verifyLandlordLineIdToken_(payload.credential);
    if(!verified||verified.success!==true) throw new Error('AUTH_REQUIRED');
    const rows=workspaceGetObjectsWithRow_(runtimeSpreadsheet_().getSheetByName('V2_users'))
      .filter(function(row){return workspaceText_(row.line_user_id)===verified.data.sub;});
    if(rows.length!==1) throw new Error('AUTH_REQUIRED');
    actor=rows[0];
  } else {
    const resolved=landlordEmailAuthResolveSession_(payload.credential,'',false,{require_onboarding:true});
    if(!resolved||resolved.success!==true) throw new Error('AUTH_REQUIRED');
    actor=resolved.data.user;
  }
  const uid=workspaceText_(actor.line_user_id);
  if(!uid) throw new Error('AUTH_REQUIRED');
  const aliases=workspaceGetObjectsWithRow_(runtimeSpreadsheet_().getSheetByName('V2_users'))
    .filter(function(row){return workspaceText_(row.line_user_id)===uid;});
  if(aliases.length!==1) throw new Error('AUTH_REQUIRED');
  const access=workspaceLandlordResolveAccess_(uid,{require_onboarding:true,skip_schema_ensure:true,skip_legacy_context_creation:true});
  if(!access||access.success!==true||workspaceText_(access.user.user_id)!==workspaceText_(actor.user_id)||
    workspaceText_(access.membership.user_id)!==workspaceText_(actor.user_id)||
    V2_WORKSPACE_ROLES_.indexOf(workspaceText_(access.membership.role).toLowerCase())<0) throw new Error('AUTH_REQUIRED');
  return readAuthorizationFingerprint_(access);
}

function readAuthorizationConfirm_(request) {
  const denied={success:false,code:'AUTH_UNAVAILABLE',data:null};
  try {
    if(!request||Object.keys(request).sort().join(',')!=='action,nonce,payload,signature,timestamp'||
      request.action!=='read_replica_authorize'||typeof request.timestamp!=='number'||!Number.isSafeInteger(request.timestamp)||
      Math.abs(Date.now()-request.timestamp)>15000||typeof request.nonce!=='string'||!/^[-a-zA-Z0-9]{20,64}$/.test(request.nonce)||
      typeof request.payload!=='string'||request.payload.length>10000||typeof request.signature!=='string'||!/^[a-f0-9]{64}$/.test(request.signature)) return denied;
    const config=readReplicaConfig_();if(!config) return denied;
    const signed=request.timestamp+'\n'+request.nonce+'\n'+request.payload;
    if(!landlordEmailAuthConstantEquals_(request.signature,readAuthorizationMac_('cmwebs-read-auth-request-v1',signed,config.secret))) return denied;
    const payload=JSON.parse(request.payload);
    if(!payload||Object.keys(payload).sort().join(',')!=='credential,credential_digest,protocol,route'||
      ['liff','session'].indexOf(payload.protocol)<0||typeof payload.credential!=='string'||!payload.credential||
      /\s/.test(payload.credential)||payload.credential.length>8192||V2_READ_AUTHORIZATION_ROUTES_.indexOf(payload.route)<0||
      payload.credential_digest!==readReplicaHash_(payload.protocol+':'+payload.credential)) return denied;
    const nonceKey='cmwebs:read-auth:nonce:'+readReplicaHash_(request.nonce);
    const lock=LockService.getScriptLock();if(!lock.tryLock(250)) return denied;
    try {const cache=CacheService.getScriptCache();if(cache.get(nonceKey)) return denied;cache.put(nonceKey,'used',60);}
    finally {lock.releaseLock();}
    let result;
    try {
      const fingerprint=readAuthorizationResolve_(payload);
      const keys=Object.keys(V2_READ_REPLICA_TABLES_).map(function(table){return V2_READ_REPLICA_DIRTY_PREFIX_+table;});
      const cache=CacheService.getScriptCache();
      const pending=Object.keys(cache.getAll(keys)).length>0 || Boolean(cache.get(V2_READ_REPLICA_LEASE_KEY_));
      result={success:true,fingerprint:fingerprint,replica_dirty:pending};
    }
    catch (_) {result={success:false,code:'AUTH_REQUIRED'};}
    const issued=Date.now();
    if(issued-request.timestamp>15000) return denied;
    const body=JSON.stringify({nonce:request.nonce,credential_digest:payload.credential_digest,route:payload.route,issued_at:issued,expires_at:issued+5000,result:result});
    return {body:body,signature:readAuthorizationMac_('cmwebs-read-auth-response-v1',body,config.secret)};
  } catch (_) {return denied;}
}
