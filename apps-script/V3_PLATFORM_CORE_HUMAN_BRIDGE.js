/** Commercial assertions are issued only after the original rental login proof. */
function platformCoreBillingError_(code) { const error = new Error(code); error.billingCode = code; return error; }
function platformCoreBillingFailure_(error) {
  const allowed = ['AUTHENTICATION_REQUIRED','AUTHORIZATION_DENIED','INVALID_REQUEST','ORDER_CONFLICT','PAYMENT_REVIEW_REQUIRED','CONFIGURATION_REQUIRED','PROVISIONING_PENDING','SERVICE_UNAVAILABLE','MODE_AUDIT_PENDING'];
  const code = error && allowed.indexOf(error.billingCode) >= 0 ? error.billingCode : 'SERVICE_UNAVAILABLE';
  const messages = {AUTHENTICATION_REQUIRED:'登入已失效，請重新登入',AUTHORIZATION_DENIED:'你沒有這項操作權限',INVALID_REQUEST:'請檢查輸入內容',ORDER_CONFLICT:'資料已變更，請重新載入後核對',PAYMENT_REVIEW_REQUIRED:'轉帳正在審核，請等待確認',CONFIGURATION_REQUIRED:'請先完成方案或收款帳號設定',PROVISIONING_PENDING:'訂閱帳號等待連線，請稍後重試',MODE_AUDIT_PENDING:'設定已儲存，操作紀錄等待同步，請重試',SERVICE_UNAVAILABLE:'暫時無法完成操作，請稍後重試'};
  return workspaceResult_(false,code,messages[code],null);
}
function platformCoreBillingConfig_() {
  const props = PropertiesService.getScriptProperties();
  const value = function(key) { return platformCoreText_(props.getProperty(key)); };
  const config = {base:value('CMWEBS_PLATFORM_CORE_BILLING_BASE_URL').replace(/\/$/,''),credential:value('CMWEBS_PLATFORM_CORE_BROKER_CREDENTIAL'),keyId:value('CMWEBS_PLATFORM_CORE_ASSERTION_KEY_ID'),secret:value('CMWEBS_PLATFORM_CORE_ASSERTION_SECRET'),environment:value('CMWEBS_PLATFORM_CORE_ENVIRONMENT'),productId:value('CMWEBS_PLATFORM_CORE_PRODUCT_ID')};
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::443)?$/.test(config.base) || !/^[A-Za-z0-9_.-]{1,512}$/.test(config.credential) || !/^[A-Za-z0-9_-]{1,128}$/.test(config.keyId) || !/^[A-Za-z0-9_-]{43}$/.test(config.secret) || ['staging','production'].indexOf(config.environment)<0) throw platformCoreBillingError_('CONFIGURATION_REQUIRED');
  platformCoreIdentifier_(config.productId);
  config.secretBytes = Utilities.base64DecodeWebSafe(config.secret);
  if (config.secretBytes.length !== 32) throw platformCoreBillingError_('CONFIGURATION_REQUIRED');
  return config;
}
function platformCoreBillingHash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,Array.isArray(value)?value:Utilities.newBlob(String(value)).getBytes()).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join(''); }
function platformCoreBillingBase64_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,''); }
function platformCoreBillingHmac_(text,config) { return platformCoreBillingBase64_(Utilities.computeHmacSha256Signature(Utilities.newBlob(text).getBytes(),config.secretBytes)); }
function platformCoreResolveBillingPrincipal_(request) {
  request = request || {};
  let user,proof;
  if (platformCoreText_(request.landlord_session_token)) {
    const session = resolveLandlordEmailSession_(request.landlord_session_token,request.request_id || '',{require_onboarding:false});
    if (!session || !session.success) throw platformCoreBillingError_('AUTHENTICATION_REQUIRED');
    user = session.data.user;
    proof = 'email:'+request.landlord_session_token;
  } else {
    let subject;try {const verified=commercialRegistrationVerifyLineToken_(request.id_token || '');if(!verified || !verified.success)throw new Error('Unverified');subject=verified.data.line_user_id;} catch (_) {throw platformCoreBillingError_('AUTHENTICATION_REQUIRED');}
    const matches=workspaceGetObjectsWithRow_(runtimeSpreadsheet_().getSheetByName('V2_users')).filter(function(row){return row.line_user_id===subject;});
    if (matches.length!==1) throw platformCoreBillingError_('AUTHENTICATION_REQUIRED');
    user=matches[0];proof='line:'+request.id_token;
  }
  const ss=runtimeSpreadsheet_(),users=workspaceGetObjectsWithRow_(ss.getSheetByName('V2_users')).filter(function(row){return row.user_id===user.user_id;});
  if(users.length!==1)throw platformCoreBillingError_('AUTHENTICATION_REQUIRED');user=users[0];
  const workspaceId=platformCoreText_(user.active_workspace_id),workspaces=workspaceGetObjectsWithRow_(ss.getSheetByName('V2_workspaces')).filter(function(row){return row.workspace_id===workspaceId;}),members=workspaceGetObjectsWithRow_(ss.getSheetByName('V2_workspace_members')).filter(function(row){return row.workspace_id===workspaceId && row.user_id===user.user_id;});
  if(user.account_status!=='active' || workspaces.length!==1 || workspaces[0].account_status!=='active' || members.length!==1 || members[0].member_status!=='active' || ['owner','admin','manager','accountant','maintenance','viewer'].indexOf(members[0].role)<0 || (request.workspace_id && request.workspace_id!==workspaceId)) throw platformCoreBillingError_('AUTHORIZATION_DENIED');
  return commercialRegistrationTrustAccess_({user:user,workspace:workspaces[0],membership:members[0],billing_auth_hash:platformCoreBillingHash_(proof)});
}
function platformCoreIssueBillingCsrf_(access) {
  const config=platformCoreBillingConfig_(),at=Date.parse(landlordEmailAuthNowIso_());
  const text=JSON.stringify({user:access.user.user_id,workspace:access.workspace.workspace_id,product:config.productId,proof:access.billing_auth_hash,issued:at,expires:at+900000,nonce:Utilities.getUuid().replace(/-/g,'')});
  return platformCoreBillingBase64_(Utilities.newBlob(text).getBytes())+'.'+platformCoreBillingHmac_(text,config);
}
function platformCoreVerifyBillingCsrf_(access,token) {
  try {
    if(typeof token!=='string' || token.length>2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Invalid CSRF');
    const parts=token.split('.'),text=Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString(),config=platformCoreBillingConfig_(),p=JSON.parse(text),now=Date.parse(landlordEmailAuthNowIso_());
    if(!landlordEmailAuthConstantEquals_(parts[1],platformCoreBillingHmac_(text,config)) || p.user!==access.user.user_id || p.workspace!==access.workspace.workspace_id || p.product!==config.productId || p.proof!==access.billing_auth_hash || !Number.isSafeInteger(p.issued) || !Number.isSafeInteger(p.expires) || p.issued>now || p.expires<=now || p.expires-p.issued!==900000)throw new Error('Invalid CSRF');
  }catch(_){throw platformCoreBillingError_('AUTHENTICATION_REQUIRED');}
}
function platformCoreSignHumanRequest_(access,method,path,payload,intent) {
  if(!access || !COMMERCIAL_VERIFIED_ACCESS_.has(access) || method!=='POST' || ['PROVISION','HUMAN_ACTION'].indexOf(intent)<0)throw platformCoreBillingError_('AUTHENTICATION_REQUIRED');
  const config=platformCoreBillingConfig_(),body=JSON.stringify(payload),bodyBytes=Utilities.newBlob(body).getBytes(),at=Math.floor(Date.parse(landlordEmailAuthNowIso_())/1000);
  if(bodyBytes.length>65536)throw platformCoreBillingError_('INVALID_REQUEST');
  const assertion=JSON.stringify({issuer:'https://cmwebs.com/rental',audience:'commercial-'+config.environment,product_id:config.productId,external_user_id:access.user.user_id,external_workspace_id:access.workspace.workspace_id,intent:intent,method:'POST',path:path,body_sha256:platformCoreBillingHash_(bodyBytes),issued_at:at,expires_at:at+60,nonce:Utilities.getUuid().replace(/-/g,'')});
  return {body:body,bodyBytes:bodyBytes,headers:{Authorization:'Bearer '+config.credential,'x-core-key-id':config.keyId,'x-core-assertion':platformCoreBillingBase64_(Utilities.newBlob(assertion).getBytes()),'x-core-signature':platformCoreBillingHmac_(assertion,config)}};
}
function platformCoreSendVerifiedHuman_(access,operation,payload,key,intent) {
  intent=intent || 'HUMAN_ACTION';
  if(!access || !COMMERCIAL_VERIFIED_ACCESS_.has(access) || (operation==='provision')!==(intent==='PROVISION') || (operation!=='provision' && !CMWebsCoreBillingContracts.isBillingOperation(operation)))throw platformCoreBillingError_('AUTHORIZATION_DENIED');
  try{const fields=CMWebsCoreBillingContracts.billingRequestFields(operation);CMWebsCoreBillingContracts.billingBody(payload,fields.required,fields.optional || []);if(key!==undefined)CMWebsCoreBillingContracts.billingIdentifier(key);}catch(_){throw platformCoreBillingError_('INVALID_REQUEST');}
  if((operation==='provision' || (!operation.endsWith('/query') && operation!=='admin/me')) && !key)throw platformCoreBillingError_('INVALID_REQUEST');
  const config=platformCoreBillingConfig_(),path='/v1/bridge/products/'+config.productId+'/'+operation,signed=platformCoreSignHumanRequest_(access,'POST',path,payload,intent);
  if(key)signed.headers['idempotency-key']=key;
  let response,body;
  try{response=UrlFetchApp.fetch(config.base+path,{method:'post',contentType:'application/json; charset=utf-8',payload:signed.bodyBytes,headers:signed.headers,muteHttpExceptions:true,followRedirects:false});const text=response.getContentText();if(text.length>1048576)throw new Error('Oversize result');body=JSON.parse(text);}catch(_){throw platformCoreBillingError_('SERVICE_UNAVAILABLE');}
  if(response.getResponseCode()!==200)throw platformCoreBillingError_(body && body.error && body.error.code || 'SERVICE_UNAVAILABLE');
  if(operation==='provision') {
    if(!body || body.status!=='READY' || body.product_id!==config.productId || body.external_workspace_id!==access.workspace.workspace_id)throw platformCoreBillingError_('SERVICE_UNAVAILABLE');
    return body;
  }
  const link=platformCoreReadWorkspaceLink_(access.workspace.workspace_id);
  if(!link || link.product_id!==config.productId)throw platformCoreBillingError_('PROVISIONING_PENDING');
  try{return CMWebsCoreBillingContracts.parseBillingOperationResponse(body,{companyId:link.platform_company_id,productId:config.productId},operation);}catch(_){throw platformCoreBillingError_('SERVICE_UNAVAILABLE');}
}
