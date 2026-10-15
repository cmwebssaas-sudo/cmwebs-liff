// Read replica synchronization is disabled until both properties are configured.

const V2_READ_REPLICA_DIRTY_PREFIX_ = 'cmwebs:read-replica:dirty:';
const V2_READ_REPLICA_LEASE_KEY_ = 'cmwebs:read-replica:lease';

function readReplicaConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const url = String(properties.getProperty('READ_REPLICA_URL') || '').trim().replace(/\/$/, '');
  const secret = properties.getProperty('READ_REPLICA_SYNC_SECRET') || '';
  if (!url || !secret) return null;
  if (!/^https:\/\/[^\s?#@]+$/.test(url) || secret.length < 16) throw new Error('Invalid replica configuration');
  return {url:url,secret:secret};
}

function readReplicaHex_(bytes) {
  return bytes.map(function(value) { return ('0'+((value+256)%256).toString(16)).slice(-2); }).join('');
}

function readReplicaHash_(text) {
  return readReplicaHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8));
}

function readReplicaCanonicalFields_(fields) {
  const result = {};
  Object.keys(fields).sort().forEach(function(key) { result[key]=fields[key]; });
  return JSON.stringify(result);
}

function readReplicaProjectRow_(sheetName, source) {
  const table = V2_READ_REPLICA_TABLES_[sheetName];
  if (!table) throw new Error('Sheet outside whitelist');
  const fields = {};
  table.fields.forEach(function(key) {
    if (!Object.prototype.hasOwnProperty.call(source,key)) return;
    let value = source[key];
    if (Object.prototype.toString.call(value)==='[object Date]') value=value.toISOString();
    if (value === undefined) return;
    if (value !== null && ['string','number','boolean'].indexOf(typeof value)<0) throw new Error('Unsupported replica field');
    if (typeof value==='number' && !isFinite(value)) throw new Error('Unsupported replica field');
    fields[key]=value;
  });
  const key = String(fields[table.key] || '').trim();
  if (!key || key.length>256) throw new Error('Missing stable replica key');
  return {row_key:key,row_hash:readReplicaHash_(readReplicaCanonicalFields_(fields)),fields:fields};
}

function readReplicaWithMarkerLock_(operation) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(250)) throw new Error('Replica marker busy');
  try { return operation(CacheService.getScriptCache()); }
  finally { lock.releaseLock(); }
}

function readReplicaMarkDirty_(sheets) {
  // Disabled installations must not add lock/cache overhead to normal requests.
  if (!readReplicaConfig_()) return;
  readReplicaWithMarkerLock_(function(cache) {
    sheets.forEach(function(sheet) {
      if (Object.prototype.hasOwnProperty.call(V2_READ_REPLICA_TABLES_,sheet)) {
        cache.put(V2_READ_REPLICA_DIRTY_PREFIX_+sheet,Utilities.getUuid(),21600);
      }
    });
  });
}

// Explicit dispatcher policy. New/unclassified successful routes conservatively
// invalidate every table; a regression test requires classification of every
// route literal in the real dispatcher. Never infer mutations from verb spelling.
const V2_READ_REPLICA_ACTIONS_ = (function() {
  const policies=Object.create(null);
  function routes(names,tables) {
    names.trim().split(/\s+/).forEach(function(action) {
      if (Object.prototype.hasOwnProperty.call(policies,action)) throw new Error('Duplicate replica route policy');
      policies[action]=tables;
    });
  }
  routes(`commercial_billing commercial_billing_init
    landlord_announcements_init landlord_arrears landlord_bank_receipts_init
    landlord_bill_manual_settlement_status landlord_bill_notifications_init
    landlord_bill_test_archive_candidates landlord_billing_init
    landlord_contract_checkout_init landlord_contract_checkout_settlement_init landlord_contract_checkout_settlement_preview
    landlord_contract_document_download landlord_contract_documents_init
    landlord_contract_initiated_init landlord_contract_initiated_status landlord_contract_requests_init
    landlord_contract_signing_review_auth_status landlord_contract_signing_review_update_status
    landlord_contract_signing_reviews_fetch_status landlord_contract_signing_reviews_init
    landlord_email_session_status landlord_entry_status landlord_home landlord_home_bootstrap
    landlord_invitation_init landlord_line_logs landlord_messages_init landlord_notifications_init
    landlord_onboarding_init landlord_paid_bills_init landlord_payment_reports_init landlord_properties_init
    landlord_repair_tickets_init landlord_revenue_dashboard_init landlord_room_center_init
    landlord_settings_init landlord_subscription_init landlord_team_init landlord_tenant_checkins_init
    landlord_tenant_create_init landlord_tenant_initial_meter_init landlord_tenants
    landlord_workspace_activity_init landlord_workspace_context
    tenant_bills tenant_binding_status tenant_contract_artifact_upload_status tenant_contract_auth_status
    tenant_contract_init tenant_contract_invite_auth_status tenant_contract_requests tenant_contract_sign_status
    tenant_home tenant_message_init tenant_payment_account_cover tenant_payment_report_init tenant_repair_tickets_init`,[]);
  routes(`landlord_property_archive landlord_property_save landlord_room_account_toggle
    landlord_room_archive landlord_room_save landlord_room_website_save`,
    ['V2_rooms','V2_properties','V2_contracts','V2_bills']);
  routes(`landlord_bank_receipt_confirm landlord_bill_apply_initial_rent_credit landlord_bill_manual_settle
    landlord_bill_reopen landlord_bill_test_archive landlord_bills_generate
    landlord_payment_report_settle landlord_payment_report_update tenant_payment_report_submit`,
    ['V2_bills','V2_payments','V2_payment_reports','V2_rooms','V2_contracts']);
  routes(`landlord_contract_checkout_complete landlord_contract_checkout_evidence_upload
    landlord_contract_document_upload landlord_contract_initiate_new landlord_contract_initiate_renewal
    landlord_contract_initiate_renewal_direct landlord_contract_invite_cancel landlord_contract_invite_reissue
    landlord_contract_paper_backfill landlord_contract_renewal_draft_update landlord_contract_renewal_review_confirm
    landlord_contract_request_update landlord_contract_signing_review_update
    landlord_tenant_checkin_save landlord_tenant_checkin_send_welcome landlord_tenant_create landlord_tenant_initial_meter_save
    tenant_contract_renewal_intent tenant_contract_request_cancel tenant_contract_request_submit tenant_bind_submit`,
    ['V2_contracts','V2_contract_requests','V2_contract_invites','V2_tenants','V2_rooms','V2_bills','V2_users']);
  routes(`landlord_message_update landlord_send_tenant_message tenant_message_submit`,['V2_tenant_messages']);
  routes(`commercial_registration_email_request commercial_registration_email_verify commercial_registration_line
    commercial_billing_link_line commercial_billing_retry_provisioning commercial_billing_workspace_mode
    landlord_email_login_request landlord_email_login_verify landlord_email_session_revoke
    landlord_email_verify_code landlord_email_verify_request landlord_invitation_accept landlord_register_submit
    landlord_team_invite_cancel landlord_team_invite_create landlord_team_member_remove landlord_team_member_update
    landlord_workspace_create landlord_workspace_switch`,
    ['V2_users','V2_workspaces','V2_workspace_members','V2_member_scopes','V2_landlords','V2_landlord_email_sessions']);
  routes(`landlord_onboarding_complete landlord_onboarding_save landlord_settings_save_payment
    landlord_settings_save_preferences landlord_settings_save_profile landlord_settings_save_workspace
    landlord_settings_set_default_payment landlord_settings_upload_payment_account_cover
    landlord_announcement_retry landlord_announcement_send landlord_bill_notifications_send
    landlord_monthly_bill_notifications_send landlord_notification_mark_read landlord_notifications_mark_all_read
    landlord_repair_ticket_update LINE_WEBHOOK`,Object.keys(V2_READ_REPLICA_TABLES_));
  return policies;
})();

function readReplicaSheetsForAction_(action) {
  if (!action) return [];
  return Object.prototype.hasOwnProperty.call(V2_READ_REPLICA_ACTIONS_,action)
    ? V2_READ_REPLICA_ACTIONS_[action].slice() : Object.keys(V2_READ_REPLICA_TABLES_);
}

function readReplicaAfterResponse_(action, output) {
  try {
    const sheets=readReplicaSheetsForAction_(action);
    if (!sheets.length) return output;
    let result=output;
    if (output && typeof output.getContent==='function') {
      let text=output.getContent();
      const bridge=text.match(/window\.top\.postMessage\((\{[\s\S]*\}), '\*'\);/);
      if (bridge) result=JSON.parse(bridge[1]).payload;
      else {
        const jsonp=text.match(/^[A-Za-z_$][\w.$]*\((\{[\s\S]*\})\);$/);
        result=JSON.parse(jsonp ? jsonp[1] : text);
      }
    }
    if (result && ['EMPTY_BODY','NO_EVENTS'].indexOf(result.code)>=0) return output;
    // Unknown POST actions can fall through to the existing webhook handler.
    // Identify its actual response as well as the nominal wrapper action.
    const webhook=action==='LINE_WEBHOOK' || (result && result.message==='LINE webhook processed');
    if (result && result.success===true &&
        (!webhook || (result.data && Number(result.data.processed)>0))) readReplicaMarkDirty_(sheets);
  } catch (_) {
    // Never turn a committed business write into a transport failure. Daily
    // full reconciliation recovers CacheService loss or a busy marker lock.
    Logger.log('READ_REPLICA_DIRTY_MARK_PENDING');
  }
  return output;
}

function readReplicaRowsFromSheet_(sheetName) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sheet=ss && ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Replica source sheet missing');
  const values=sheet.getDataRange().getValues();
  const headers=(values.shift() || []).map(function(value){return String(value || '').trim();});
  const key=V2_READ_REPLICA_TABLES_[sheetName].key;
  if (headers.indexOf(key)<0 || headers.some(function(header,index){return header && headers.indexOf(header)!==index;})) throw new Error('Replica source headers invalid');
  const seen=Object.create(null);
  return values.filter(function(row){return row.some(function(value){return value!=='' && value!==null;});}).map(function(row){
    const source={}; headers.forEach(function(header,index){if(header) source[header]=row[index];});
    const projected=readReplicaProjectRow_(sheetName,source);
    if (Object.prototype.hasOwnProperty.call(seen,projected.row_key)) throw new Error('Duplicate stable replica key');
    seen[projected.row_key]=true;
    return projected;
  });
}

function readReplicaUtf8Length_(text) {
  // JSON.stringify escapes lone surrogates. Count the serialized JSON bytes
  // locally instead of creating a native Blob for every projected row.
  let bytes=0;
  for(let i=0;i<text.length;i++) {
    const code=text.charCodeAt(i);
    if(code<0x80) bytes++;
    else if(code<0x800) bytes+=2;
    else if(code>=0xd800 && code<=0xdbff) {
      const next=text.charCodeAt(i+1);
      if(!(next>=0xdc00 && next<=0xdfff)) throw new Error('Invalid serialized JSON surrogate');
      bytes+=4; i++;
    } else if(code>=0xdc00 && code<=0xdfff) throw new Error('Invalid serialized JSON surrogate');
    else bytes+=3;
  }
  return bytes;
}

function readReplicaSendRows_(config,sheet,rows,mode,sourceVersion,deadline) {
  const id=Utilities.getUuid();
  const manifest=rows.map(function(row){return [row.row_key,row.row_hash];}).sort(function(a,b){return a[0]<b[0]?-1:a[0]>b[0]?1:0;});
  const hash=readReplicaHash_(JSON.stringify(manifest));
  // Leave room for metadata and headers within the Worker's 1 MiB limit.
  const batches=[]; let current=[],bytes=0;
  rows.forEach(function(row){
    const size=readReplicaUtf8Length_(JSON.stringify(row))+1;
    if(size>900000) throw new Error('Replica row too large');
    if(current.length && (current.length>=500 || bytes+size>900000)) {batches.push(current);current=[];bytes=0;}
    current.push(row);bytes+=size;
  });
  if(current.length || !batches.length) batches.push(current);
  if(mode==='patch' && batches.length!==1) throw new Error('Replica patch too large');
  batches.forEach(function(batch,index){
    if(Date.now()>=deadline) throw new Error('Replica run deadline');
    const body=JSON.stringify({sheet:sheet,rows:batch,mode:mode,snapshot_id:id,source_version:sourceVersion,
      batch_index:index,batch_count:batches.length,row_count:rows.length,snapshot_hash:hash,complete:index===batches.length-1});
    const timestamp=String(Math.floor(Date.now()/1000));
    const nonce=Utilities.getUuid();
    const signature=readReplicaHex_(Utilities.computeHmacSha256Signature(timestamp+'\n'+nonce+'\n'+body,config.secret,Utilities.Charset.UTF_8));
    const response=UrlFetchApp.fetch(config.url+'/sync',{method:'post',contentType:'application/json',payload:body,
      headers:{'X-CMWebs-Timestamp':timestamp,'X-CMWebs-Nonce':nonce,'X-CMWebs-Signature':signature},
      muteHttpExceptions:true,followRedirects:false});
    if(response.getResponseCode()!==200) throw new Error('Replica request failed');
    const result=JSON.parse(response.getContentText());
    if(!result || result.success!==true || !result.data || result.data.completed!==(index===batches.length-1)) throw new Error('Replica acknowledgement invalid');
  });
  return {success:true,rows:rows.length,batches:batches.length};
}

function readReplicaRun_(full) {
  const start=Date.now(); let config;
  const cache=CacheService.getScriptCache();
  const tables=Object.keys(V2_READ_REPLICA_TABLES_);
  // Cache is a remote service. One bulk read keeps every idle minute bounded
  // without weakening the per-table generation check after a successful send.
  const markers=full ? {} : cache.getAll(tables.map(function(sheet){return V2_READ_REPLICA_DIRTY_PREFIX_+sheet;}));
  const pending=tables.filter(function(sheet){return full || markers[V2_READ_REPLICA_DIRTY_PREFIX_+sheet];});
  if(!pending.length) return {success:true,code:'IDLE',tables:0,duration_ms:Date.now()-start};
  // Idle has no reason to retrieve configuration or the signing credential.
  // Full/pending runs still check configuration before any Sheet or network IO.
  try {config=readReplicaConfig_();} catch (_) {return {success:false,code:'SYNC_NOT_CONFIGURED'};}
  if(!config) return {success:true,code:'DISABLED',tables:0,duration_ms:Date.now()-start};
  const lease=Utilities.getUuid(); let acquired=false;
  try {
    acquired=readReplicaWithMarkerLock_(function(marker){
      if(marker.get(V2_READ_REPLICA_LEASE_KEY_)) return false;
      marker.put(V2_READ_REPLICA_LEASE_KEY_,lease,360); return true;
    });
    if(!acquired) return {success:false,code:'SYNC_BUSY'};
    let count=0; const failed=[];
    pending.forEach(function(sheet){
      try {
        if(full && !cache.get(V2_READ_REPLICA_DIRTY_PREFIX_+sheet)) readReplicaMarkDirty_([sheet]);
        const generation=cache.get(V2_READ_REPLICA_DIRTY_PREFIX_+sheet);
        // Capture version before reading, so a later revocation patch cannot be
        // overwritten by an older full snapshot that finishes after it.
        const sourceVersion=Date.now();
        // Keep full-run dirty markers, but do not read/hash another Sheet when
        // earlier native IO has already consumed the send deadline.
        if(sourceVersion>=start+240000) throw new Error('Replica run deadline');
        const rows=readReplicaRowsFromSheet_(sheet);
        readReplicaSendRows_(config,sheet,rows,'snapshot',sourceVersion,start+240000);
        readReplicaWithMarkerLock_(function(marker){
          if(generation && marker.get(V2_READ_REPLICA_DIRTY_PREFIX_+sheet)===generation) marker.remove(V2_READ_REPLICA_DIRTY_PREFIX_+sheet);
        });
        count++;
      } catch (_) { failed.push(sheet); }
    });
    const result={success:failed.length===0,code:failed.length?'SYNC_PENDING':'OK',tables:count,failed_tables:failed,duration_ms:Date.now()-start};
    Logger.log(JSON.stringify(result)); return result;
  } catch (_) {
    const result={success:false,code:'SYNC_PENDING',duration_ms:Date.now()-start};
    Logger.log(JSON.stringify(result)); return result;
  } finally {
    if(acquired) {
      try {readReplicaWithMarkerLock_(function(marker){if(marker.get(V2_READ_REPLICA_LEASE_KEY_)===lease) marker.remove(V2_READ_REPLICA_LEASE_KEY_);});} catch (_) {}
    }
  }
}

function runV2ReadReplicaDirtySync() { return readReplicaRun_(false); }
function runV2ReadReplicaFullSync() { return readReplicaRun_(true); }

function readReplicaPushRevokedSession_(session) {
  let config;
  try {config=readReplicaConfig_(); if(!config) return {success:true,code:'DISABLED'};
    const version=Date.now();
    const row=readReplicaProjectRow_('V2_landlord_email_sessions',session);
    return readReplicaSendRows_(config,'V2_landlord_email_sessions',[row],'patch',version,version+30000);
  } catch (_) {
    try {readReplicaMarkDirty_(['V2_landlord_email_sessions']);} catch (_) {}
    Logger.log('READ_REPLICA_REVOCATION_PENDING');
    return {success:false,code:'READ_REPLICA_REVOCATION_PENDING'};
  }
}

function testReadReplicaProjection() {
  const row=readReplicaProjectRow_('V2_rooms',{room_id:'SYNTHETIC_ROOM',room_name:'synthetic',bank_account:'not-exported'});
  return {success:!Object.prototype.hasOwnProperty.call(row.fields,'bank_account') && row.row_hash.length===64};
}

function testReadReplicaUtf8BatchSizing() {
  const samples=['','ascii','房租','é','e\u0301','😀','𝄞','🇹🇼','👩‍💻','\u0000\n\t"\\','\ud800','\udc00','\ud800\ud800\udc00'];
  const matches=samples.map(function(value) {
    const serialized=JSON.stringify({value:value});
    return readReplicaUtf8Length_(serialized)===Utilities.newBlob(serialized).getBytes().length;
  });
  return {success:matches.every(function(match){return match;}),samples:samples.length};
}
