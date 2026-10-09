// Postal email is evidence for HUMAN review. Intake never changes a bill/payment.
const BANK_RECEIPT_SCHEMAS_ = {
  V2_bank_email_receipts: ['receipt_id','workspace_id','payment_account_id','notification_number','gmail_message_id','received_at','payment_at','amount','payer_bank','payer_last5','source_kind','status','match_bill_id','match_reason','report_id','payment_id','confirmed_by','confirmed_at','notification_id','notification_status','created_at','updated_at'],
  V2_bank_payer_links: ['link_id','workspace_id','payment_account_id','payer_bank','payer_last5','tenant_id','contract_id','status','confirmed_by','confirmed_at']
};

function bankReceiptText_(value) { return value == null ? '' : String(value).trim(); }
function bankReceiptError_(code, message) { return {success:false,code:code,message:message || '入帳通知暫時無法處理'}; }
function bankReceiptHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value))
    .map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
}
function bankReceiptRows_(name) {
  const sheet = runtimeSpreadsheet_().getSheetByName(name);
  if (!sheet || sheet.getLastRow()<2) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift().map(bankReceiptText_);
  return rows.filter(function(row){return bankReceiptText_(row[0])!=='';}).map(function(row){
    const object={}; headers.forEach(function(key,i){object[key]=row[i];}); return object;
  });
}
function bankReceiptSheet_(name) {
  const sheet = runtimeSpreadsheet_().getSheetByName(name);
  if (!sheet || !sheet.getLastColumn()) throw new Error('Bank receipt schema migration required');
  const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(bankReceiptText_);
  const required=BANK_RECEIPT_SCHEMAS_[name] || [];
  if (required.some(function(key){return headers.indexOf(key)<0;})) throw new Error('Bank receipt schema migration required');
  return {sheet:sheet,headers:headers};
}
function bankReceiptAppend_(name, values) {
  const table=bankReceiptSheet_(name);
  // Text columns preserve leading zeros, and prevent Gmail-supplied formula cells.
  const row=table.headers.map(function(key){
    const value=values[key] == null ? '' : values[key];
    return typeof value==='string' && /^[=+@-]/.test(value) ? "'"+value : value;
  });
  const next=table.sheet.getLastRow()+1;
  table.headers.forEach(function(key,i){
    if (key==='payer_last5' || key==='reported_last5') table.sheet.getRange(next,i+1).setNumberFormat('@');
  });
  table.sheet.getRange(next,1,1,row.length).setValues([row]);
}
function bankReceiptUpdate_(name,key,id,updates) {
  const table=bankReceiptSheet_(name), index=table.headers.indexOf(key);
  const rows=table.sheet.getDataRange().getValues();
  const matches=[];
  rows.slice(1).forEach(function(row,i){if(bankReceiptText_(row[index])===bankReceiptText_(id))matches.push(i+2);});
  if(matches.length!==1)throw new Error('Bank receipt row missing or ambiguous');
  Object.keys(updates).forEach(function(field){
    const column=table.headers.indexOf(field);
    if(column>=0)table.sheet.getRange(matches[0],column+1).setValue(updates[field]);
  });
}
function runBankEmailReceiptMigration() {
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  try {
    const ss=runtimeSpreadsheet_();
    Object.keys(BANK_RECEIPT_SCHEMAS_).forEach(function(name){
      const sheet=ss.getSheetByName(name)||ss.insertSheet(name);
      const existing=sheet.getLastColumn()?sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(bankReceiptText_):[];
      const missing=BANK_RECEIPT_SCHEMAS_[name].filter(function(key){return existing.indexOf(key)<0;});
      if(missing.length)sheet.getRange(1,existing.length+1,1,missing.length).setValues([missing]);
    });
    return {success:true,code:'OK'};
  } finally {lock.releaseLock();}
}

function bankReceiptParsePostal_(subject,body) {
  const text=String(body||'').replace(/\r/g,'').replace(/\u00a0/g,' ');
  const uniqueField=function(label,expression){
    const found=Array.from(text.matchAll(new RegExp(label+'\\s*[:：]\\s*('+expression+')','g')));
    return found.length===1?found[0][1].trim():'';
  };
  const receiver=uniqueField('轉入帳號','[0-9*＊]+');
  const amount=uniqueField('轉入金額','[0-9,]+(?=\\s*元)');
  const date=uniqueField('轉入時間','[0-9]{2,4}\\/[0-9]{1,2}\\/[0-9]{1,2}\\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?');
  const payer=uniqueField('轉出帳號','[0-9*＊]+');
  const bank=uniqueField('轉出行庫','[^\\n]+');
  const numbers=Array.from(String(subject||'').matchAll(/No\.\s*(\d+)/gi));
  if(!receiver||!amount||!date||numbers.length!==1||!Number.isSafeInteger(Number(amount.replace(/,/g,'')))||Number(amount.replace(/,/g,''))<=0)return null;
  const parts=date.match(/^(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)(?::(\d+))?$/);
  const year=Number(parts[1])<1911?Number(parts[1])+1911:Number(parts[1]);
  const month=Number(parts[2]),day=Number(parts[3]),hour=Number(parts[4]),minute=Number(parts[5]),second=Number(parts[6]||0);
  const check=new Date(Date.UTC(year,month-1,day,hour,minute,second));
  if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day||hour>23||minute>59||second>59)return null;
  const pad=function(n){return ('0'+n).slice(-2);};
  return {notification_number:numbers[0][1],receiver_mask:receiver.replace(/＊/g,'*'),amount:Number(amount.replace(/,/g,'')),
    payment_at:year+'-'+pad(month)+'-'+pad(day)+'T'+pad(hour)+':'+pad(minute)+':'+pad(second)+'+08:00',payer_bank:bank,
    payer_last5:/\d{5}$/.test(payer)?payer.slice(-5):''};
}
function bankReceiptWorkspaceScope_(workspaceId) {
  const scope={workspace:{workspace_id:workspaceId},principals:[]};
  if(typeof workspaceLandlordResolvePrincipals_!=='function')return scope;
  const workspaces=bankReceiptRows_('V2_workspaces').filter(function(w){return w.workspace_id===workspaceId&&['active','trial'].indexOf(bankReceiptText_(w.workspace_status||'active').toLowerCase())>=0;});
  if(workspaces.length===1)scope.principals=workspaceLandlordResolvePrincipals_(runtimeSpreadsheet_(),{activeWorkspace:workspaces[0]});
  return scope;
}
function bankReceiptBillInWorkspace_(bill,workspaceId,scope) {
  // An explicit Workspace always takes precedence over legacy compatibility.
  if(bankReceiptText_(bill.workspace_id))return bankReceiptText_(bill.workspace_id)===workspaceId;
  return !!(scope&&typeof billingBillMatchesAccessScope_==='function'&&billingBillMatchesAccessScope_(bill,scope));
}
function bankReceiptBillEligible_(bill,workspaceId,scope) {
  return bankReceiptBillInWorkspace_(bill,workspaceId,scope) && bankReceiptText_(bill.bill_id) && bankReceiptText_(bill.tenant_id) && bankReceiptText_(bill.contract_id) &&
    ['unpaid','payment_reported','pending','overdue'].indexOf(bankReceiptText_(bill.payment_status).toLowerCase())>=0 &&
    ['cancelled','canceled','void','voided','archived'].indexOf(bankReceiptText_(bill.bill_status).toLowerCase())<0 &&
    Number.isSafeInteger(Number(bill.total_amount)) && Number(bill.total_amount)>0;
}
function bankReceiptMatch_(receipt,bills,links,scope) {
  const eligible=bills.filter(function(b){return bankReceiptBillEligible_(b,receipt.workspace_id,scope);});
  const known=links.filter(function(link){return link.status==='active'&&link.workspace_id===receipt.workspace_id&&link.payment_account_id===receipt.payment_account_id&&
    receipt.payer_bank&&receipt.payer_last5&&link.payer_bank===receipt.payer_bank&&link.payer_last5===receipt.payer_last5;});
  const identities={};known.forEach(function(link){identities[link.tenant_id+'|'+link.contract_id]=link;});
  if(Object.keys(identities).length>1)return {bill_id:'',reason:'payer_ambiguous'};
  let candidates=eligible.filter(function(b){return Number(b.total_amount)===Number(receipt.amount);});
  if(known.length)candidates=candidates.filter(function(b){return b.tenant_id===known[0].tenant_id&&b.contract_id===known[0].contract_id;});
  // Duplicate IDs also fail closed; never choose first/oldest bill silently.
  return candidates.length===1?{bill_id:candidates[0].bill_id,reason:known.length?'payer_and_amount':'amount'}:
    {bill_id:'',reason:candidates.length?'amount_ambiguous':known.length?'payer_amount_mismatch':'no_amount_match'};
}
function bankReceiptReadConfig_() {
  const raw=PropertiesService.getScriptProperties().getProperty('CMWEBS_BANK_EMAIL_INTAKE_CONFIG');
  if(!raw)return {enabled:false};
  let config;try{config=JSON.parse(raw);}catch(_){throw new Error('Invalid bank email intake configuration');}
  if(config.enabled!==true)return {enabled:false};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(config.start_after||'')||!Array.isArray(config.accounts)||!config.accounts.length||!/^\S+@\S+\.\S+$/.test(config.mailbox_email||''))throw new Error('Invalid bank email intake configuration');
  const cutoff=new Date(config.start_after+'T00:00:00+08:00');
  if(!Number.isFinite(cutoff.getTime())||new Date(cutoff.getTime()+28800000).toISOString().slice(0,10)!==config.start_after)throw new Error('Invalid bank email intake start date');
  config.mailbox_email=config.mailbox_email.toLowerCase();
  return config;
}
function bankReceiptAccept_(parsed,message,config) {
  bankReceiptSheet_('V2_bank_email_receipts');bankReceiptSheet_('V2_bank_payer_links');
  if(new Date(parsed.payment_at).getTime()<new Date(config.start_after+'T00:00:00+08:00').getTime())return {success:true,code:'BEFORE_START'};
  const accounts=config.accounts.filter(function(account){return account.receiver_mask===parsed.receiver_mask;});
  if(accounts.length!==1)return bankReceiptError_('RECEIVER_UNMAPPED','收款帳戶未設定或有歧義');
  const account=accounts[0];
  const actual=bankReceiptRows_('V2_workspace_payment_accounts').filter(function(row){return row.payment_account_id===account.payment_account_id&&row.workspace_id===account.workspace_id&&bankReceiptText_(row.account_status||'active')==='active';});
  const mask=parsed.receiver_mask.match(/^(\d+)\*+(\d+)$/);
  const full=actual.length===1?bankReceiptText_(actual[0].bank_account).replace(/[\s-]/g,''):'';
  if(!mask||!full||full.indexOf(mask[1])!==0||full.slice(-mask[2].length)!==mask[2])return bankReceiptError_('RECEIVER_UNVERIFIED','收款帳戶設定需要核對');
  const id='BRE-'+bankReceiptHash_(account.workspace_id+'|'+account.payment_account_id+'|'+parsed.notification_number).slice(0,32);
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  let row;
  try {
    row=bankReceiptRows_('V2_bank_email_receipts').find(function(item){return item.receipt_id===id;});
    if(row&&(Number(row.amount)!==parsed.amount||row.payment_at!==parsed.payment_at||row.payer_bank!==parsed.payer_bank||row.payer_last5!==parsed.payer_last5))return bankReceiptError_('NOTICE_CONFLICT','同一通知資料不一致，需人工檢查');
    if(!row){
      const now=new Date().toISOString();
      row={receipt_id:id,workspace_id:account.workspace_id,payment_account_id:account.payment_account_id,notification_number:parsed.notification_number,
        gmail_message_id:message.id,received_at:new Date(Number(message.internalDate)||Date.now()).toISOString(),payment_at:parsed.payment_at,amount:parsed.amount,
        payer_bank:parsed.payer_bank,payer_last5:parsed.payer_last5,source_kind:message.source_kind,status:'unmatched',created_at:now,updated_at:now};
      const match=bankReceiptMatch_(row,bankReceiptRows_('V2_bills'),bankReceiptRows_('V2_bank_payer_links'),bankReceiptWorkspaceScope_(account.workspace_id));
      row.match_bill_id=match.bill_id;row.match_reason=match.reason;row.status=match.bill_id?'pending':'unmatched';
      bankReceiptAppend_('V2_bank_email_receipts',row);
    }
  } finally {lock.releaseLock();}
  if(bankReceiptNeedsNotification_(row))bankReceiptNotify_(row);
  return {success:true,code:'OK',data:{receipt_id:id}};
}
function bankReceiptNotify_(row) {
  const scope=bankReceiptWorkspaceScope_(row.workspace_id);
  const bill=bankReceiptRows_('V2_bills').find(function(b){return b.bill_id===row.match_bill_id&&bankReceiptBillInWorkspace_(b,row.workspace_id,scope);});
  const message='收到入帳 '+Number(row.amount).toLocaleString('zh-TW')+' 元\n付款帳戶：'+(row.payer_bank||'未提供銀行')+'／末五碼 '+(row.payer_last5||'未提供')+
    '\n入帳時間：'+bankReceiptText_(row.payment_at).replace('T',' ').replace(':00+08:00','')+
    '\n'+(bill?'配對帳單：'+bankReceiptText_(bill.room_name)+'／'+bankReceiptText_(bill.bill_month)+'，待確認銷帳':'收到入帳，但無法配對，請選擇帳單或標記為其他款項')+
    (row.source_kind==='forwarded'?'\n來源：轉寄通知，請核對收款紀錄':'');
  const result=workspaceNotifyTeam_({notification_id:'BN-'+bankReceiptHash_(row.receipt_id).slice(0,32),workspace_id:row.workspace_id,event_type:'payment_report',
    title:bill?'收到入帳，請確認銷帳':'收到入帳，但無法配對',body:message,target_type:'bank_receipt',target_id:row.receipt_id,
    action_url:'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-payment-report-review.html?receipt_id='+encodeURIComponent(row.receipt_id),
    source:'bank_email_receipt',severity:'info',metadata:{receipt_id:row.receipt_id}});
  const nid=result&&result.data&&result.data.notification_id;
  if(result&&result.success&&nid){const lock=LockService.getScriptLock();lock.waitLock(25000);try{bankReceiptUpdate_('V2_bank_email_receipts','receipt_id',row.receipt_id,{notification_id:nid,notification_status:result.data.deliveries && result.data.deliveries.length && result.data.deliveries.every(function(d){return ['sent','skipped_disabled','skipped_unbound','failed_permanent'].indexOf(d.delivery_status)>=0;}) ? (['sent','stored_only'].indexOf(result.data.status)>=0?result.data.status:'exhausted') : result.data.status||'stored'});}finally{lock.releaseLock();}}
}
function bankReceiptNeedsNotification_(row) {
  return ['pending','unmatched'].indexOf(row.status)>=0 && ['sent','stored_only','exhausted'].indexOf(row.notification_status)<0;
}

function bankReceiptHeader_(headers,name) {
  const found=(headers||[]).find(function(h){return String(h.name).toLowerCase()===name.toLowerCase();});return found?String(found.value):'';
}
function bankReceiptMailSource_(headers,config) {
  const from=bankReceiptHeader_(headers,'From').toLowerCase();
  const email=from.match(/<([^<>\s]+@[^<>\s]+)>/)||from.match(/^([^\s<>]+@[^\s<>]+)$/);
  if(!email)return '';
  const sender=email[1],domain=sender.split('@')[1];
  const auth=bankReceiptHeader_(headers,'Authentication-Results');
  const verified=auth.match(/\bdmarc=pass\b[^;]*?\bheader\.from=([^\s;]+)/i);
  if(!/^\s*mx\.google\.com;/i.test(auth)||!verified||!(domain===verified[1]||domain.endsWith('.'+verified[1])))return '';
  if(['bsnsnotify@mail.post.gov.tw','bsnotify@mail.post.gov.tw'].indexOf(sender)>=0)return 'direct';
  return (config.trusted_forwarders||[]).indexOf(sender)>=0?'forwarded':'';
}
function bankReceiptGmailBody_(part) {
  if(!part)return '';
  if(part.mimeType==='text/plain'&&part.body&&part.body.data)return Utilities.newBlob(Utilities.base64DecodeWebSafe(part.body.data)).getDataAsString();
  const children=part.parts||[];
  for(let i=0;i<children.length;i++){const text=bankReceiptGmailBody_(children[i]);if(text)return text;}
  if(part.mimeType==='text/html'&&part.body&&part.body.data)return Utilities.newBlob(Utilities.base64DecodeWebSafe(part.body.data)).getDataAsString()
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<(?:br\b[^>]*|\/p|\/div|\/tr)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#(\d+);/g,function(_,n){return String.fromCharCode(Number(n));});
  return '';
}
function bankReceiptGmailGet_(path) {
  const response=UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(response.getResponseCode()!==200){const error=new Error('Bank email Gmail read failed: HTTP '+response.getResponseCode());error.http_status=response.getResponseCode();throw error;}
  return JSON.parse(response.getContentText());
}
function bankReceiptQuery_(config) {
  // Gmail date strings are PST dates. Epoch seconds keep the Taipei cutoff.
  return 'subject:入帳通知 after:'+(Math.floor(new Date(config.start_after+'T00:00:00+08:00').getTime()/1000)-1);
}
function bankReceiptVerifyMailbox_(config) {
  const profile=bankReceiptGmailGet_('profile');
  if(bankReceiptText_(profile.emailAddress).toLowerCase()!==config.mailbox_email)throw new Error('Bank email mailbox mismatch');
}
function runBankEmailReceiptIntake() {
  const config=bankReceiptReadConfig_();if(!config.enabled)return {success:true,code:'DISABLED'};
  bankReceiptSheet_('V2_bank_email_receipts');bankReceiptSheet_('V2_bank_payer_links');
  // Only one intake runner; do not hold ScriptLock while sending notifications.
  const props=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock(),claim=Utilities.getUuid();
  lock.waitLock(25000);
  try {const running=JSON.parse(props.getProperty('CMWEBS_BANK_EMAIL_INTAKE_LEASE')||'null');if(running&&Number(running.expires)>Date.now())return {success:true,code:'BUSY'};props.setProperty('CMWEBS_BANK_EMAIL_INTAKE_LEASE',JSON.stringify({claim:claim,expires:Date.now()+360000}));}finally{lock.releaseLock();}
  const query=bankReceiptQuery_(config);
  const cursorKey='CMWEBS_BANK_EMAIL_INTAKE_CURSOR_'+bankReceiptHash_(query).slice(0,12);
  const counts={accepted:0,ignored:0,unmapped:0,parse_failed:0};
  try {
    // Persistent delivery retry is independent of a successful Gmail fetch.
    bankReceiptRows_('V2_bank_email_receipts').filter(bankReceiptNeedsNotification_).slice(0,25).forEach(bankReceiptNotify_);
    bankReceiptVerifyMailbox_(config);
    const base='messages?maxResults=25&q='+encodeURIComponent(query);
    const latest=bankReceiptGmailGet_(base);
    const cursor=props.getProperty(cursorKey);
    const page=cursor?bankReceiptGmailGet_(base+'&pageToken='+encodeURIComponent(cursor)):latest;
    const seen={};
    (latest.messages||[]).concat(cursor?page.messages||[]:[]).filter(function(item){if(seen[item.id])return false;seen[item.id]=true;return true;}).forEach(function(item){
      const mail=bankReceiptGmailGet_('messages/'+encodeURIComponent(item.id)+'?format=full');
      const headers=mail.payload&&mail.payload.headers||[],source=bankReceiptMailSource_(headers,config);
      if(!source){counts.ignored++;return;}
      const parsed=bankReceiptParsePostal_(bankReceiptHeader_(headers,'Subject'),bankReceiptGmailBody_(mail.payload));
      if(!parsed){counts.parse_failed++;return;}
      const result=bankReceiptAccept_(parsed,{id:mail.id,internalDate:mail.internalDate,source_kind:source},config);
      if(!result.success){counts.unmapped++;return;}counts.accepted++;
    });
    if(page.nextPageToken)props.setProperty(cursorKey,page.nextPageToken);else props.deleteProperty(cursorKey);
    // Recover notifications even when an earlier scan inserted before a timeout.
    bankReceiptRows_('V2_bank_email_receipts').filter(bankReceiptNeedsNotification_).slice(0,25).forEach(bankReceiptNotify_);
    props.setProperty('CMWEBS_BANK_EMAIL_INTAKE_LAST_RUN',JSON.stringify({at:new Date().toISOString(),counts:counts}));
    return {success:true,code:'OK',data:counts};
  } catch(error) {
    if(error.http_status===400 && props.getProperty(cursorKey))props.deleteProperty(cursorKey);
    props.setProperty('CMWEBS_BANK_EMAIL_INTAKE_LAST_RUN',JSON.stringify({at:new Date().toISOString(),code:'INTAKE_FAILED',counts:counts}));
    throw error;
  } finally {
    lock.waitLock(25000);try{const active=JSON.parse(props.getProperty('CMWEBS_BANK_EMAIL_INTAKE_LEASE')||'null');if(active&&active.claim===claim)props.deleteProperty('CMWEBS_BANK_EMAIL_INTAKE_LEASE');}finally{lock.releaseLock();}
  }
}
function installBankEmailReceiptTrigger() {
  const config=bankReceiptReadConfig_();
  if(!config.enabled)return bankReceiptError_('DISABLED','請先設定收款信箱與帳戶對應');
  bankReceiptSheet_('V2_bank_email_receipts');bankReceiptSheet_('V2_bank_payer_links');
  bankReceiptVerifyMailbox_(config);
  const existing=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='runBankEmailReceiptIntake';});
  if(!existing.length)ScriptApp.newTrigger('runBankEmailReceiptIntake').timeBased().everyMinutes(5).create();
  return {success:true,code:existing.length?'ALREADY_INSTALLED':'OK'};
}

function bankReceiptAccess_(request,policy) {
  let access;
  if(bankReceiptText_(request.landlord_session_token))access=resolveLandlordQuickLeaseBridgeAccess_(request,policy);
  else if(bankReceiptText_(request.id_token)) {
    const auth=landlordContractSigningReviewAuthenticate_(request.id_token);if(!auth||!auth.success)return auth;
    const verified=verifyLandlordContractSigningReviewSessionToken_(auth.data.session_token);if(!verified||!verified.success)return verified;
    access=workspaceLandlordResolveAccess_(verified.data.line_sub,{require_onboarding:true,skip_schema_ensure:true,skip_legacy_context_creation:true});
    if(!access||!access.success)return access;
    if(bankReceiptText_(access.workspace.workspace_id)!==verified.data.workspace_id||bankReceiptText_(access.user.user_id)!==verified.data.user_id||bankReceiptText_(access.membership.membership_id)!==verified.data.membership_id)return bankReceiptError_('AUTH_REQUIRED','登入身份已變更');
  } else return bankReceiptError_('AUTH_REQUIRED','請重新登入房東帳號');
  if(!access||!access.success)return access;
  const permission=workspaceLandlordCheckPolicy_(access,policy);if(!permission||!permission.success)return bankReceiptError_('PERMISSION_DENIED','沒有付款確認權限');
  return access;
}
function bankReceiptDispatch_(action,request) {
  const access=bankReceiptAccess_(request,action==='landlord_bank_receipts_init'?'read':'payment_write');if(!access||!access.success)return access;
  let input=request.input||{};
  if(request.input_json){try{input=JSON.parse(request.input_json);}catch(_){return bankReceiptError_('INVALID_INPUT','資料格式錯誤');}}
  return action==='landlord_bank_receipts_init'?bankReceiptInit_(access):bankReceiptConfirm_(access,input);
}
function bankReceiptInit_(access) {
  const workspaceId=bankReceiptText_(access.workspace.workspace_id);
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  try {
    // Readback finishes only an already committed, fully verified payment.
    // It never initiates settlement from an email or a read request.
    const candidates=bankReceiptRows_('V2_bank_email_receipts').filter(function(r){return r.workspace_id===workspaceId&&r.report_id&&r.confirmed_by&&r.status==='pending';});
    if(candidates.length){
      const tables={reports:bankReceiptRows_('V2_payment_reports'),bills:bankReceiptRows_('V2_bills'),payments:bankReceiptRows_('V2_payments'),scope:access};
      candidates.map(function(row){return {row:row,payment:bankReceiptCommittedPayment_(row,tables)};}).filter(function(item){return !!item.payment;}).slice(0,25).forEach(function(item){bankReceiptFinish_(item.row,access,item.payment,tables.bills.find(function(b){return b.bill_id===item.row.match_bill_id&&bankReceiptBillInWorkspace_(b,workspaceId,access);}));});
    }
  } finally {lock.releaseLock();}
  const bills=bankReceiptRows_('V2_bills').filter(function(b){return bankReceiptBillEligible_(b,workspaceId,access);});
  const receipts=bankReceiptRows_('V2_bank_email_receipts').filter(function(r){return r.workspace_id===workspaceId;}).sort(function(a,b){return String(b.created_at).localeCompare(String(a.created_at));});
  return {success:true,code:'OK',data:{can_approve_payment:!!(access.permissions&&access.permissions.can_approve_payment),
    receipts:receipts.filter(function(r){return ['pending','unmatched'].indexOf(r.status)>=0;}).concat(receipts.filter(function(r){return ['pending','unmatched'].indexOf(r.status)<0;}).slice(0,25)).map(function(r){return {receipt_id:r.receipt_id,amount:r.amount,payment_at:r.payment_at,payer_bank:r.payer_bank,payer_last5:r.payer_last5,
      source_kind:r.source_kind,status:r.status,match_bill_id:r.match_bill_id,report_id:r.report_id,payment_id:r.payment_id};}),
    bills:bills.map(function(b){return {bill_id:b.bill_id,room_name:b.room_name,tenant_name:b.tenant_name,bill_month:b.bill_month,total_amount:b.total_amount};})}};
}
function bankReceiptCommittedPayment_(row,tables) {
  if(!row.report_id)return null;
  const report=(tables?tables.reports:bankReceiptRows_('V2_payment_reports')).find(function(r){return r.report_id===row.report_id;});
  const scope=tables?tables.scope:bankReceiptWorkspaceScope_(row.workspace_id);
  const bill=(tables?tables.bills:bankReceiptRows_('V2_bills')).find(function(b){return b.bill_id===row.match_bill_id&&bankReceiptBillInWorkspace_(b,row.workspace_id,scope);});
  const payments=(tables?tables.payments:bankReceiptRows_('V2_payments')).filter(function(p){return p.source_ref_id===row.report_id&&p.bill_id===row.match_bill_id&&p.status==='confirmed'&&Number(p.amount)===Number(row.amount);});
  if (!row.confirmed_by || !row.confirmed_at || !report || !bill || payments.length !== 1) return null;
  if (report.report_id !== 'BPR-'+bankReceiptHash_(row.receipt_id+'|'+row.match_bill_id).slice(0,32) || report.bill_id !== bill.bill_id || report.tenant_id !== bill.tenant_id || report.landlord_id !== bill.landlord_id || Number(report.reported_amount) !== Number(row.amount)) return null;
  if (bill.payment_status !== 'paid' || bill.payment_id !== payments[0].payment_id || Number(bill.total_amount) !== Number(row.amount)) return null;
  if (report.matched_payment_id && report.matched_payment_id !== payments[0].payment_id) return null;
  return ['pending','confirmed'].indexOf(report.status) >= 0 ? payments[0] : null;
}
function bankReceiptFinish_(row,access,payment,knownBill) {
  const bill=knownBill||bankReceiptRows_('V2_bills').find(function(b){return b.bill_id===row.match_bill_id&&bankReceiptBillInWorkspace_(b,row.workspace_id,access);});
  const now=new Date().toISOString();
  // Finish only the previously approved canonical payment, never create one here.
  if (row.status !== 'settled') {
    const ss = runtimeSpreadsheet_();
    if (typeof billingSyncBillViews_ === 'function') billingSyncBillViews_(ss, access, bill, now);
    if (typeof billingRefreshWorkspaceSummaries_ === 'function') billingRefreshWorkspaceSummaries_(ss, access);
    if (typeof manualSettlementSyncLegacy_ === 'function') manualSettlementSyncLegacy_(ss, bill, payment.payment_date || row.payment_at.slice(0,10), payment.payment_id);
    bankReceiptUpdate_('V2_payment_reports','report_id',row.report_id,{status:'confirmed',matched_payment_id:payment.payment_id,confirmed_by:row.confirmed_by,confirmed_at:row.confirmed_at,updated_at:now});
  }
  if(row.payer_bank&&/^\d{5}$/.test(row.payer_last5)&&bill){
    const id='BPL-'+bankReceiptHash_([row.workspace_id,row.payment_account_id,row.payer_bank,row.payer_last5,bill.tenant_id,bill.contract_id].join('|')).slice(0,32);
    if(!bankReceiptRows_('V2_bank_payer_links').some(function(l){return l.link_id===id;}))bankReceiptAppend_('V2_bank_payer_links',{
      link_id:id,workspace_id:row.workspace_id,payment_account_id:row.payment_account_id,payer_bank:row.payer_bank,payer_last5:row.payer_last5,
      tenant_id:bill.tenant_id,contract_id:bill.contract_id,status:'active',confirmed_by:row.confirmed_by,confirmed_at:row.confirmed_at});
  }
  if(row.status!=='settled')bankReceiptUpdate_('V2_bank_email_receipts','receipt_id',row.receipt_id,{status:'settled',payment_id:payment.payment_id,updated_at:now});
  return {success:true,code:'OK',message:'已確認銷帳',data:{receipt_id:row.receipt_id,payment_id:payment.payment_id,status:'settled'}};
}
function bankReceiptConfirm_(access,input) {
  const permission=workspaceLandlordCheckPolicy_(access,'payment_write');if(!permission||!permission.success)return bankReceiptError_('PERMISSION_DENIED','沒有付款確認權限');
  const workspaceId=bankReceiptText_(access.workspace.workspace_id),lock=LockService.getScriptLock();let row;
  lock.waitLock(25000);
  try {
    bankReceiptSheet_('V2_bank_email_receipts');bankReceiptSheet_('V2_bank_payer_links');
    const found=bankReceiptRows_('V2_bank_email_receipts').filter(function(r){return r.receipt_id===bankReceiptText_(input.receipt_id)&&r.workspace_id===workspaceId;});
    if(found.length!==1)return bankReceiptError_('RECEIPT_NOT_FOUND','找不到此入帳紀錄');row=found[0];
    const committed=bankReceiptCommittedPayment_(row);if(committed)return bankReceiptFinish_(row,access,committed);
    if(row.status==='settled'||row.status==='other')return bankReceiptError_('RECEIPT_CLOSED','此入帳紀錄已處理');
    if(input.decision==='other'){
      if(row.report_id)return bankReceiptError_('SETTLEMENT_PENDING','此筆銷帳處理中，請先核對結果');
      bankReceiptUpdate_('V2_bank_email_receipts','receipt_id',row.receipt_id,{status:'other',confirmed_by:access.user.user_id,confirmed_at:new Date().toISOString()});
      return {success:true,code:'OK',data:{status:'other'}};
    }
    const id=bankReceiptText_(input.bill_id);if(!id)return bankReceiptError_('BILL_REQUIRED','請選擇帳單');
    if(row.report_id&&row.match_bill_id!==id)return bankReceiptError_('RECEIPT_CLAIMED','此款項已指定另一張帳單，請先核對');
    const candidates=bankReceiptRows_('V2_bills').filter(function(b){return b.bill_id===id&&bankReceiptBillEligible_(b,workspaceId,access);});
    if(candidates.length!==1)return bankReceiptError_('BILL_UNAVAILABLE','帳單已繳清或不屬於目前工作區');
    const bill=candidates[0];if(Number(bill.total_amount)!==Number(row.amount))return bankReceiptError_('PAYMENT_AMOUNT_MISMATCH','入帳金額與目前帳單金額不一致，請人工處理');
    const reportId='BPR-'+bankReceiptHash_(row.receipt_id+'|'+id).slice(0,32);
    const report=bankReceiptRows_('V2_payment_reports').find(function(r){return r.report_id===reportId;});
    if(report&&(report.bill_id!==id||Number(report.reported_amount)!==Number(row.amount)))return bankReceiptError_('REPORT_CONFLICT','付款紀錄需要人工核對');
    if(!report || (report.status==='voided'&&!bankReceiptRows_('V2_payments').some(function(p){return p.source_ref_id===reportId&&p.status!=='void';}))){
      tenantPaymentReportEnsureSheet_();
      const values={report_id:reportId,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),landlord_id:bill.landlord_id,
        landlord_line_user_id:access.principal_line_user_id,tenant_id:bill.tenant_id,tenant_user_id:bill.user_id||'',tenant_line_user_id:'',tenant_name:bill.tenant_name||'',
        room_id:bill.room_id,room_name:bill.room_name,bill_id:bill.bill_id,bill_month:bill.bill_month,bill_total_amount:row.amount,reported_amount:row.amount,
        reported_last5:row.payer_last5,reported_paid_date:row.payment_at.slice(0,10),status:'pending',matched_payment_id:'',confirmed_at:'',confirmed_by:'',note:'入帳通知由房東確認／'+row.receipt_id};
      if(report)bankReceiptUpdate_('V2_payment_reports','report_id',reportId,values);else bankReceiptAppend_('V2_payment_reports',values);
    }
    row.report_id=reportId;row.match_bill_id=id;
    row.confirmed_by=row.confirmed_by||access.user.user_id;row.confirmed_at=row.confirmed_at||new Date().toISOString();
    bankReceiptUpdate_('V2_bank_email_receipts','receipt_id',row.receipt_id,{report_id:reportId,match_bill_id:id,status:'pending',confirmed_by:row.confirmed_by,confirmed_at:row.confirmed_at,updated_at:new Date().toISOString()});
  } finally {lock.releaseLock();}
  // Existing service rechecks Workspace, ownership, live amount and bill status.
  const result=settleWorkspaceLandlordPaymentReportByLineUid_(access.principal_line_user_id,row.report_id,'房東確認入帳通知／'+row.receipt_id);
  lock.waitLock(25000);
  try {
    row=bankReceiptRows_('V2_bank_email_receipts').find(function(r){return r.receipt_id===row.receipt_id&&r.workspace_id===workspaceId&&r.report_id===row.report_id;})||row;
    const committed=bankReceiptCommittedPayment_(row);if(committed)return bankReceiptFinish_(row,access,committed);
    const current=bankReceiptRows_('V2_bank_email_receipts').find(function(r){return r.receipt_id===row.receipt_id;});
    // Only a definite pre-write rejection can release a claim. Unknown outcomes
    // retain the claim and must be read back; never discard a possible payment.
    const definite=['PAYMENT_AMOUNT_MISMATCH','INVALID_PAYMENT_AMOUNT','BILL_ALREADY_PAID','BILL_NOT_FOUND','BILL_CANCELLED','BILL_WORKSPACE_MISMATCH','BILL_LANDLORD_MISMATCH','BILL_TENANT_MISMATCH'];
    if(current&&current.report_id===row.report_id&&current.match_bill_id===row.match_bill_id&&result&&result.success===false&&definite.indexOf(result.code)>=0 && !bankReceiptRows_('V2_payments').some(function(p){return p.source_ref_id===row.report_id&&p.status!=='void';})){
      bankReceiptUpdate_('V2_payment_reports','report_id',row.report_id,{status:'voided',note:'入帳確認未提交／'+result.code,updated_at:new Date().toISOString()});
      bankReceiptUpdate_('V2_bank_email_receipts','receipt_id',row.receipt_id,{report_id:'',match_bill_id:'',status:'unmatched',confirmed_by:'',confirmed_at:'',updated_at:new Date().toISOString()});
    }
  }finally{lock.releaseLock();}
  return result&&result.success?bankReceiptError_('SETTLEMENT_UNVERIFIED','請重新整理核對銷帳結果'):result;
}
function testBankEmailReceiptParser() {
  const parsed=bankReceiptParsePostal_('入帳通知(No.123456)','轉入帳號：1234*****56789\n轉入金額：6,432元\n轉入時間：115/10/09\n09:07\n轉出帳號：987654*****01234\n轉出行庫：合成銀行');
  if(!parsed||parsed.amount!==6432||parsed.payer_last5!=='01234')throw new Error('Postal receipt parser regression');
  return {success:true,code:'OK'};
}
