// Internal request-bound authority confirmation. This never returns operational
// rows and never caches a positive access decision across requests.
const V2_READ_AUTHORIZATION_ROUTES_ = ['/v1/home','/v1/revenue','/v1/tenants','/v1/rooms','/v1/arrears','/v1/properties'];
const V2_READ_AUTHORIZATION_TABLES_ = ['V2_landlord_email_sessions','V2_users','V2_workspaces','V2_workspace_members','V2_landlords'];

// Decode only request-local authorization rows. No shared positive-access cache.
// Any unsupported response falls back to the original native reader before
// resolving access; an authorization denial itself never retries another path.
function readAuthorizationGridSnapshot_(document,spreadsheetId) {
  const unavailable=function(){throw new Error('AUTH_GRID_UNAVAILABLE');};
  if(!document||document.spreadsheetId!==spreadsheetId||!document.properties||
    typeof document.properties.timeZone!=='string'||!document.properties.timeZone||
    !Array.isArray(document.sheets))return unavailable();
  const zone=document.properties.timeZone;
  const defaultType=document.properties.defaultFormat&&document.properties.defaultFormat.numberFormat&&document.properties.defaultFormat.numberFormat.type;
  const values=Object.create(null),ids=Object.create(null),seenIds=Object.create(null);
  let cells=0,hydratedCells=0;
  document.sheets.forEach(function(sheet){
    const meta=sheet&&sheet.properties;
    if(!meta||typeof meta.title!=='string')return unavailable();
    if(V2_READ_AUTHORIZATION_TABLES_.indexOf(meta.title)<0) {
      // The API may return unrelated metadata when ranges select only grid data.
      if(sheet.data&&sheet.data.some(function(grid){return grid.rowData&&grid.rowData.length;}))return unavailable();
      return;
    }
    if(Object.prototype.hasOwnProperty.call(values,meta.title)||!Number.isSafeInteger(meta.sheetId)||meta.sheetId<0||seenIds[meta.sheetId])return unavailable();
    seenIds[meta.sheetId]=true;ids[meta.title]=meta.sheetId;
    if(sheet.data!==undefined&&(!Array.isArray(sheet.data)||sheet.data.length>1))return unavailable();
    const grid=sheet.data&&sheet.data[0]||{};
    if((grid.startRow||0)!==0||(grid.startColumn||0)!==0||
      (grid.rowData!==undefined&&!Array.isArray(grid.rowData)))return unavailable();
    const rows=grid.rowData||[];
    if(rows.length>20000)return unavailable();
    let height=0,width=0;
    rows.forEach(function(row,rowIndex){
      if(!row||(row.values!==undefined&&!Array.isArray(row.values)))return unavailable();
      const columns=row.values||[];
      if(columns.length>100)return unavailable();
      cells+=columns.length;if(cells>100000)return unavailable();
      columns.forEach(function(cell,columnIndex){
        if(!cell||typeof cell!=='object')return unavailable();
        if(cell.effectiveValue||cell.userEnteredValue){height=Math.max(height,rowIndex+1);width=Math.max(width,columnIndex+1);}
      });
    });
    height=Math.max(height,1);width=Math.max(width,1);
    hydratedCells+=height*width;if(hydratedCells>100000)return unavailable();
    values[meta.title]=Array.from({length:height},function(_,rowIndex){
      const columns=rows[rowIndex]&&rows[rowIndex].values||[];
      return Array.from({length:width},function(_,columnIndex){
        const cell=columns[columnIndex]||{},value=cell.effectiveValue;
        if(value===undefined)return '';
        if(!value||typeof value!=='object'||Object.keys(value).length!==1)return unavailable();
        if(Object.prototype.hasOwnProperty.call(value,'stringValue'))return typeof value.stringValue==='string'?value.stringValue:unavailable();
        if(Object.prototype.hasOwnProperty.call(value,'boolValue'))return typeof value.boolValue==='boolean'?value.boolValue:unavailable();
        if(!Object.prototype.hasOwnProperty.call(value,'numberValue')||typeof value.numberValue!=='number'||!Number.isFinite(value.numberValue))return unavailable();
        const type=cell.effectiveFormat&&cell.effectiveFormat.numberFormat&&cell.effectiveFormat.numberFormat.type||defaultType;
        if(['DATE','DATE_TIME','TIME'].indexOf(type)<0)return value.numberValue;
        const wallDate=new Date(Math.round((value.numberValue-25569)*86400000));
        if(!Number.isFinite(wallDate.getTime()))return unavailable();
        const wall=wallDate.toISOString().slice(0,-1).replace('T',' ');
        if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(wall))return unavailable();
        const parsed=Utilities.parseDate(wall,zone,'yyyy-MM-dd HH:mm:ss.SSS');
        if(Object.prototype.toString.call(parsed)!=='[object Date]'||!Number.isFinite(parsed.getTime())||
          Utilities.formatDate(parsed,zone,'yyyy-MM-dd HH:mm:ss.SSS')!==wall)return unavailable();
        return parsed;
      });
    });
  });
  if(V2_READ_AUTHORIZATION_TABLES_.some(function(name){return !Object.prototype.hasOwnProperty.call(values,name);}))return unavailable();
  return {values:values,sheet_ids:ids};
}

function readAuthorizationBulkSnapshot_(sourceSpreadsheet) {
  const state=V2_REQUEST_RUNTIME_SNAPSHOT_STATE_;
  if(!state||state.action!=='read_replica_authorize'||state.enabled!==true||state.shared_cache_enabled!==false||
    typeof ScriptApp==='undefined'||typeof ScriptApp.getOAuthToken!=='function')return null;
  try {
    const native=sourceSpreadsheet||runtimeSpreadsheet_(),id=String(native.getId()||'');
    if(!/^[-A-Za-z0-9_]{1,200}$/.test(id))return null;
    const fields='spreadsheetId,properties(timeZone,defaultFormat(numberFormat(type))),sheets(properties(title,sheetId),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,effectiveFormat(numberFormat(type))))))';
    const query='includeGridData=true&fields='+encodeURIComponent(fields)+'&'+V2_READ_AUTHORIZATION_TABLES_.map(function(name){return 'ranges='+encodeURIComponent("'"+name+"'");}).join('&');
    const response=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+id+'?'+query,{
      method:'get',followRedirects:false,muteHttpExceptions:true,
      headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken(),'Cache-Control':'no-cache, no-store',Pragma:'no-cache'}
    });
    if(response.getResponseCode()!==200)return null;
    const text=response.getContentText();if(typeof text!=='string'||text.length>1000000)return null;
    const snapshot=readAuthorizationGridSnapshot_(JSON.parse(text),id),handles=Object.create(null);
    const spreadsheet={getId:function(){return id;},getSheetByName:function(name){
      if(!Object.prototype.hasOwnProperty.call(snapshot.values,name))return native.getSheetByName(name);
      if(!handles[name])handles[name]={getParent:function(){return spreadsheet;},getSheetId:function(){return snapshot.sheet_ids[name];},
        getDataRange:function(){return {getValues:function(){return snapshot.values[name];}};}};
      return handles[name];
    }};
    return spreadsheet;
  }catch(_){return null;}
}

function readAuthorizationResolveFresh_(payload) {
  const state=V2_REQUEST_RUNTIME_SNAPSHOT_STATE_;
  if(!state||state.action!=='read_replica_authorize'||state.enabled!==true||state.shared_cache_enabled!==false)return readAuthorizationResolve_(payload);
  const handles=state.spreadsheet_handles,
    values=state.values_by_sheet,contexts=state.contexts;
  let native=null,loaded=false,bulk=null;
  const pendingHandles=Object.create(null);
  const nativeSpreadsheet=function(){
    if(!native) {
      const overlay=state.spreadsheet_handles;state.spreadsheet_handles=handles;
      try{native=runtimeSpreadsheet_();}finally{state.spreadsheet_handles=overlay;}
    }
    return native;
  };
  const load=function(){
    if(!loaded){loaded=true;bulk=readAuthorizationBulkSnapshot_(nativeSpreadsheet());}
    return bulk;
  };
  // Loading waits for the original resolver's first value read. LINE provider
  // verification and Email token hashing retain their canonical ordering.
  const spreadsheet={getId:function(){return nativeSpreadsheet().getId();},getSheetByName:function(name){
    if(loaded)return (bulk||nativeSpreadsheet()).getSheetByName(name);
    if(V2_READ_AUTHORIZATION_TABLES_.indexOf(name)<0)return nativeSpreadsheet().getSheetByName(name);
    if(!Object.prototype.hasOwnProperty.call(pendingHandles,name)) {
      const sheet=nativeSpreadsheet().getSheetByName(name);
      pendingHandles[name]=sheet?{getParent:function(){return spreadsheet;},
        getSheetId:function(){const ready=load();return ready?ready.getSheetByName(name).getSheetId():sheet.getSheetId();},
        getDataRange:function(){const ready=load();return ready?ready.getSheetByName(name).getDataRange():sheet.getDataRange();}}:null;
    }
    return pendingHandles[name];
  }};
  state.spreadsheet_handles=Object.assign({},handles,{ACTIVE:spreadsheet});
  state.values_by_sheet={};state.contexts={};
  try{return readAuthorizationResolve_(payload);}
  finally{state.spreadsheet_handles=handles;state.values_by_sheet=values;state.contexts=contexts;}
}

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
      const fingerprint=readAuthorizationResolveFresh_(payload);
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
