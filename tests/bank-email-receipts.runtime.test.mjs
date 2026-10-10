import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const path = 'apps-script/V2_BANK_EMAIL_RECEIPTS.js';
const source = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const json = value => JSON.parse(JSON.stringify(value));
const sample = `轉入帳號：1234*****56789
轉入金額：6,432元
轉入時間：115/10/09
09:07
交易摘要：跨行轉入
轉出帳號：987654*****01234
轉出行庫：合成銀行`;
const bill = (id = 'bill-a', extra = {}) => ({bill_id:id, workspace_id:'ws-a', landlord_id:'owner-a', tenant_id:'tenant-a', contract_id:'lease-a', room_id:'room-a', room_name:'合成房間', tenant_name:'合成房客', bill_month:'2026-10', total_amount:6432, payment_status:'unpaid', payment_id:'', bill_status:'active', ...extra});

function sheet(objects = []) {
  let rows = objects.length ? [Object.keys(objects[0]), ...objects.map(o => Object.keys(objects[0]).map(k => o[k]))] : [];
  return {getLastRow:()=>rows.length, getLastColumn:()=>rows[0]?.length || 0,
    getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())}),
    appendRow:r=>rows.push(r.slice()),
    getRange:(r,c,h=1,w=1)=>({getValues:()=>rows.slice(r-1,r-1+h).map(a=>a.slice(c-1,c-1+w)), setNumberFormat(){return this;},
      setValues(values){values.forEach((a,i)=>{rows[r-1+i] ||= []; a.forEach((v,j)=>rows[r-1+i][c-1+j]=v);});},
      setValue(value){rows[r-1] ||= [];rows[r-1][c-1]=value;}})};
}
function runtime() {
  const sheets = {V2_bills:sheet([bill()]), V2_workspace_payment_accounts:sheet([{payment_account_id:'acct-a',workspace_id:'ws-a',bank_account:'12340000056789',account_status:'active'}]), V2_workspaces:sheet([{workspace_id:'ws-a',workspace_status:'active',created_by_user_id:'user-a'}]), V2_bank_payer_links:sheet([{link_id:'',workspace_id:'',payment_account_id:'',payer_bank:'',payer_last5:'',tenant_id:'',contract_id:'',status:'',confirmed_by:'',confirmed_at:''}]),V2_payment_reports:sheet(),V2_payments:sheet([{payment_id:'',bill_id:'',status:'',amount:'',source_ref_id:'',workspace_id:'',tenant_id:'',landlord_id:'',bank_last5:'',payment_date:''}])};
  const notices = []; let held = false; let calls = 0;
  const access = {success:true, workspace:{workspace_id:'ws-a'},membership:{membership_id:'member-a'},user:{user_id:'user-a'},principal_line_user_id:'U'+'a'.repeat(32),principal_landlord_id:'owner-a', permissions:{can_approve_payment:true}};
  const config = {enabled:true,mailbox_email:'reconcile@example.test',start_after:'2026-10-09',trusted_forwarders:['relay@example.test'],accounts:[{workspace_id:'ws-a',payment_account_id:'acct-a',receiver_mask:'1234*****56789'}]};
  const props = new Map([['CMWEBS_BANK_EMAIL_INTAKE_CONFIG',JSON.stringify(config)]]);
  const ctx = {console, Date, String, Number, Math, Object, Array, JSON, Error,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})},
    LockService:{getScriptLock:()=>({waitLock(){assert.equal(held,false,'no nested ScriptLock');held=true;},tryLock(){assert.equal(held,false);held=true;return true;},releaseLock(){held=false;}})},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest()),formatDate:d=>new Date(d).toISOString().slice(0,10),base64DecodeWebSafe:s=>Array.from(Buffer.from(s,'base64url')),newBlob:b=>({getDataAsString:()=>Buffer.from(b).toString()})},
    ScriptApp:{getOAuthToken:()=> 'synthetic-token'},
    runtimeSpreadsheet_:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=sheet())}),
    workspaceLandlordCheckPolicy_:(a,p)=>({success:p==='read'||a.permissions.can_approve_payment===true}),
    resolveLandlordQuickLeaseBridgeAccess_:()=>access,
    workspaceLandlordResolveAccess_:()=>access,
    workspaceLandlordResolvePrincipals_:()=>[{landlord_id:'owner-a',line_user_id:access.principal_line_user_id}],
    workspaceNotifyTeam_(p){assert.equal(held,false,'notify outside ScriptLock');notices.push(p);return {success:true,data:{notification_id:'notice-'+notices.length,status:'sent'}};},
    settleWorkspaceLandlordPaymentReportByLineUid_(_,id){assert.equal(held,false);calls++; const reports=ctx.bankReceiptRows_('V2_payment_reports');const r=reports.find(r=>r.report_id===id);const b=ctx.bankReceiptRows_('V2_bills').find(b=>b.bill_id===r.bill_id);if(Number(r.reported_amount)!==Number(b.total_amount))return {success:false,code:'PAYMENT_AMOUNT_MISMATCH'};if(b.payment_status==='paid')return {success:false,code:'BILL_ALREADY_PAID'};const pid='payment-'+calls;ctx.bankReceiptAppend_('V2_payments',{payment_id:pid,bill_id:b.bill_id,status:'confirmed',amount:r.reported_amount,source_ref_id:id});ctx.bankReceiptUpdate_('V2_bills','bill_id',b.bill_id,{payment_status:'paid',payment_id:pid});ctx.bankReceiptUpdate_('V2_payment_reports','report_id',id,{status:'confirmed',matched_payment_id:pid});return {success:true,data:{payment_id:pid}};},
    tenantPaymentReportEnsureSheet_(){const headers=['report_id','created_at','updated_at','landlord_id','landlord_line_user_id','tenant_id','tenant_user_id','tenant_line_user_id','tenant_name','room_id','room_name','bill_id','bill_month','bill_total_amount','reported_amount','reported_last5','reported_paid_date','status','matched_payment_id','confirmed_at','confirmed_by','note'];if(!sheets.V2_payment_reports.getLastRow())sheets.V2_payment_reports.getRange(1,1,1,headers.length).setValues([headers]);return sheets.V2_payment_reports;},
    SpreadsheetApp:{flush(){}}
  };
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {ctx,sheets,notices,access,config,props,get calls(){return calls;}};
}
const receipt = (extra={})=>({notification_number:'SYNTH-001',receiver_mask:'1234*****56789',amount:6432,payment_at:'2026-10-09T09:07:00+08:00',payer_bank:'合成銀行',payer_last5:'01234',...extra});
function intake(r,extra={}) {r.ctx.runBankEmailReceiptMigration();return r.ctx.bankReceiptAccept_(receipt(extra),{id:'mail-'+(extra.notification_number||'1'),internalDate:Date.parse('2026-10-09T09:08:00+08:00'),source_kind:'direct'},r.config);}

test('postal parser separates payer/receiver, preserves zero suffix and ROC timestamp',()=>{
  const c=runtime().ctx;const p=c.bankReceiptParsePostal_('合成 入帳通知(No.123456)',sample);
  assert.equal(p.amount,6432);assert.equal(p.payer_last5,'01234');assert.equal(p.receiver_mask,'1234*****56789');assert.equal(p.payment_at,'2026-10-09T09:07:00+08:00');
  assert.equal(c.bankReceiptParsePostal_('入帳通知(No.123456)',sample.replace('115/10/09','115/02/30')),null);
  assert.equal(c.bankReceiptParsePostal_('入帳通知(No.123456)',sample+'\n'+sample),null);
});
test('postal HTML comments do not create duplicate payment fields',()=>{
  const c=runtime().ctx;
  const visible=sample.split('\n').map(line=>`<tr><td><p>${line}</p></td></tr>`).join('\n');
  const html=`<html><body><!--<tr><td><p>轉入帳號：1234*****56789</p></td></tr>-->${visible}</body></html>`;
  const decode=text=>c.bankReceiptGmailBody_({mimeType:'text/html',body:{data:Buffer.from(text).toString('base64url')}});
  const parsed=c.bankReceiptParsePostal_('入帳通知(No.123456)',decode(html));
  assert.ok(parsed,'visible postal notification must parse despite commented legacy field');
  assert.equal(parsed.amount,6432);
  assert.equal(parsed.payment_at,'2026-10-09T09:07:00+08:00');
  assert.equal(c.bankReceiptParsePostal_('入帳通知(No.123456)',decode(visible+visible)),null,'visible duplicate notices remain rejected');
});
test('match only unpaid same-workspace bills; duplicate amounts remain unmatched',()=>{
  const c=runtime().ctx;const r=receipt({workspace_id:'ws-a',payment_account_id:'acct-a'});
  assert.equal(c.bankReceiptMatch_(r,[bill(),bill('foreign',{workspace_id:'ws-b'})],[]).bill_id,'bill-a');
  assert.equal(c.bankReceiptMatch_(r,[bill(),bill('same')],[]).bill_id,'');
  assert.equal(c.bankReceiptMatch_(r,[bill('paid',{payment_status:'paid'})],[]).bill_id,'');
});
test('learned payer never falls back to another tenant amount; shared suffix remains ambiguous',()=>{
  const c=runtime().ctx;const r=receipt({workspace_id:'ws-a',payment_account_id:'acct-a'});
  const link={workspace_id:'ws-a',payment_account_id:'acct-a',payer_bank:r.payer_bank,payer_last5:r.payer_last5,tenant_id:'tenant-a',contract_id:'lease-a',status:'active'};
  assert.equal(c.bankReceiptMatch_(r,[bill('other',{tenant_id:'tenant-b',contract_id:'lease-b'})],[link]).bill_id,'');
  assert.equal(c.bankReceiptMatch_(r,[bill()],[link,{...link,tenant_id:'tenant-b',contract_id:'lease-b'}]).bill_id,'');
});
test('intake persists and notifies once, never pays a bill; distinct notice IDs stay distinct',()=>{
  const r=runtime();intake(r);intake(r);intake(r,{notification_number:'SYNTH-002'});
  assert.equal(r.ctx.bankReceiptRows_('V2_bank_email_receipts').length,2);assert.equal(r.notices.length,2);
  assert.equal(r.ctx.bankReceiptRows_('V2_bills')[0].payment_status,'unpaid');assert.equal(r.calls,0);
  assert.match(r.notices[0].body,/待確認銷帳/);
});
test('unique amount intake automatically settles exactly one matching bill',()=>{
  const r=runtime();
  r.config.auto_settle_unique_amount=true;
  r.ctx.settleWorkspaceLandlordPaymentReportByLineUid_=function(uid,reportId){
    const report=r.ctx.bankReceiptRows_('V2_payment_reports').find(x=>x.report_id===reportId);
    const b=r.ctx.bankReceiptRows_('V2_bills').find(x=>x.bill_id===report.bill_id);
    const paymentId='auto-payment-1';
    r.ctx.bankReceiptAppend_('V2_payments',{payment_id:paymentId,bill_id:b.bill_id,status:'confirmed',amount:report.reported_amount,source_ref_id:reportId});
    r.ctx.bankReceiptUpdate_('V2_bills','bill_id',b.bill_id,{payment_status:'paid',payment_id:paymentId});
    r.ctx.bankReceiptUpdate_('V2_payment_reports','report_id',reportId,{status:'confirmed',matched_payment_id:paymentId,confirmed_by:uid,confirmed_at:new Date().toISOString()});
    return {success:true,data:{payment_id:paymentId}};
  };
  intake(r);
  const receipt=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
  assert.equal(receipt.status,'settled');
  assert.equal(receipt.payment_id,'auto-payment-1');
  assert.equal(r.ctx.bankReceiptRows_('V2_bills')[0].payment_status,'paid');
  assert.equal(r.calls,0,'automatic path must not use landlord confirmation counter');
});
test('unique amount auto-settles even when the postal notice has no payer suffix',()=>{
  const r=runtime();
  r.config.auto_settle_unique_amount=true;
  r.ctx.settleWorkspaceLandlordPaymentReportByLineUid_=function(uid,reportId){
    const report=r.ctx.bankReceiptRows_('V2_payment_reports').find(x=>x.report_id===reportId);
    const b=r.ctx.bankReceiptRows_('V2_bills').find(x=>x.bill_id===report.bill_id);
    r.ctx.bankReceiptAppend_('V2_payments',{payment_id:'auto-payment-no-suffix',bill_id:b.bill_id,status:'confirmed',amount:report.reported_amount,source_ref_id:reportId});
    r.ctx.bankReceiptUpdate_('V2_bills','bill_id',b.bill_id,{payment_status:'paid',payment_id:'auto-payment-no-suffix'});
    r.ctx.bankReceiptUpdate_('V2_payment_reports','report_id',reportId,{status:'confirmed',matched_payment_id:'auto-payment-no-suffix',confirmed_by:uid,confirmed_at:new Date().toISOString()});
    return {success:true};
  };
  intake(r,{payer_bank:'',payer_last5:''});
  assert.equal(r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0].status,'settled');
});
test('duplicate amount intake stays pending for landlord selection',()=>{
  const r=runtime();
  r.config.auto_settle_unique_amount=true;
  r.ctx.bankReceiptAppend_('V2_bills',bill('bill-b'));
  intake(r);
  const receipt=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
  assert.ok(['pending','unmatched'].includes(receipt.status));
  assert.equal(receipt.match_bill_id,'');
  assert.equal(r.ctx.bankReceiptRows_('V2_bills').filter(x=>x.payment_status==='paid').length,0);
  assert.match(r.notices[0].body,/待確認|無法配對/);
});
test('duplicate amount uses a matching historical payer suffix as a tie breaker',()=>{
  const r=runtime();
  r.ctx.bankReceiptAppend_('V2_bills',bill('bill-b',{tenant_id:'tenant-b',contract_id:'lease-b'}));
  r.ctx.bankReceiptAppend_('V2_bank_payer_links',{link_id:'known',workspace_id:'ws-a',payment_account_id:'acct-a',payer_bank:'合成銀行',payer_last5:'01234',tenant_id:'tenant-a',contract_id:'lease-a',status:'active'});
  const match=r.ctx.bankReceiptMatch_(receipt({workspace_id:'ws-a',payment_account_id:'acct-a'}),r.ctx.bankReceiptRows_('V2_bills'),r.ctx.bankReceiptRows_('V2_bank_payer_links'),{});
  assert.equal(match.bill_id,'bill-a');
  assert.equal(match.reason,'payer_and_amount');
});
test('unmatched intake still notifies landlord and preserves funds for manual selection',()=>{
  const r=runtime();intake(r,{amount:9999});assert.equal(r.notices.length,1);assert.match(r.notices[0].body,/無法配對/);assert.equal(r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0].status,'unmatched');
});
test('human confirmation settles once and learns only on confirmed payment',()=>{
  const r=runtime();intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
  const result=r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'});
  assert.equal(result.success,true);assert.equal(r.ctx.bankReceiptRows_('V2_bills')[0].payment_status,'paid');
  assert.equal(r.ctx.bankReceiptRows_('V2_bank_payer_links')[0].payer_last5,'01234');
  assert.equal(r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'}).success,true);assert.equal(r.calls,1);
});
test('changed amount, foreign receipt and permission denial cannot settle or learn',()=>{
  const r=runtime();intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
  r.ctx.bankReceiptUpdate_('V2_bills','bill_id','bill-a',{total_amount:7000});
  assert.equal(r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'}).success,false);
  assert.equal(r.ctx.bankReceiptConfirm_({...r.access,workspace:{workspace_id:'ws-b'}},{receipt_id:row.receipt_id,bill_id:'bill-a'}).success,false);
  assert.equal(r.ctx.bankReceiptConfirm_({...r.access,permissions:{}},{receipt_id:row.receipt_id,bill_id:'bill-a'}).success,false);
  assert.equal(r.calls,0);assert.equal(r.ctx.bankReceiptRows_('V2_bank_payer_links').length,0);
});
test('settlement committed before receipt update is recovered without another payment',()=>{
  const r=runtime();intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];let fail=true;
  const update=r.ctx.bankReceiptUpdate_;r.ctx.bankReceiptUpdate_=function(name,key,id,values){if(name==='V2_bank_email_receipts'&&values.status==='settled'&&fail){fail=false;throw Error('synthetic interruption');}return update(name,key,id,values);};
  assert.throws(()=>r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'}));
  assert.equal(r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'}).success,true);assert.equal(r.calls,1);
});
test('other funds do not settle and a claimed receipt cannot switch bills',()=>{
  const r=runtime();intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
  assert.equal(r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,decision:'other'}).success,true);assert.equal(r.calls,0);
  assert.equal(r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'}).success,false);
});
test('disabled intake never touches Gmail or Sheets',()=>{
  const r=runtime();r.props.clear();r.ctx.UrlFetchApp={fetch(){throw Error('must not fetch');}};
  assert.equal(r.ctx.runBankEmailReceiptIntake().code,'DISABLED');
});
test('mail source must be an allowlisted authenticated envelope, not forwarded body text',()=>{
  const c=runtime().ctx;const h=(from,auth)=>[{name:'From',value:from},{name:'Authentication-Results',value:auth}];
  assert.equal(c.bankReceiptMailSource_(h('bsnotify@mail.post.gov.tw','mx.google.com; dmarc=pass header.from=post.gov.tw'),{trusted_forwarders:[]}), 'direct');
  assert.equal(c.bankReceiptMailSource_(h('attacker@example.test','mx.google.com; dmarc=pass header.from=example.test'),{trusted_forwarders:[]}), '');
  assert.equal(c.bankReceiptMailSource_(h('relay@example.test','mx.google.com; dmarc=pass header.from=example.test'),{trusted_forwarders:['relay@example.test']}), 'forwarded');
});
test('missing schema is a closed gate; stale historical transaction is not ingested',()=>{
  const r=runtime();assert.throws(()=>r.ctx.bankReceiptAccept_(receipt(),{id:'m'},r.config),/schema/i);
  intake(r,{notification_number:'SYNTH-OLD',payment_at:'2026-10-08T09:07:00+08:00'});
  assert.equal(r.ctx.bankReceiptRows_('V2_bank_email_receipts').length,0);
});

// Exercise the existing formal settlement implementation, not just a fake writer.
test('real settlement service creates one payment, updates report/bill, and learns bank account',()=>{
  const r=runtime();intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
  Object.assign(r.ctx,{V2_TIMEZONE:'Asia/Taipei',workspaceLandlordResolveAccess_:()=>r.access,
    billingBillMatchesAccessScope_:(b,a)=>b.workspace_id===a.workspace.workspace_id,
    v2CanonicalBillIsVoided_:b=>b.bill_status==='voided',
    billingPreflightBillViews_(){},billingSyncBillViews_(){},billingRefreshWorkspaceSummaries_(){},
    manualSettlementSyncLegacy_:()=>({monthly:{},history:{}}),
    cmwebsLogLineMessage_(){},logLiffAccess_(){},logAudit_(){}});
  vm.runInContext(fs.readFileSync('apps-script/V2_PAYMENT_SETTLEMENT.js','utf8'),r.ctx);
  r.ctx.settleWorkspaceLandlordPaymentReportByLineUid_=function(uid,id,note){return r.ctx.settleLandlordPaymentReportByLineUid_(uid,id,note);};
  const result=r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'});
  assert.equal(result.success,true,JSON.stringify(result));
  assert.equal(r.ctx.bankReceiptRows_('V2_payments').filter(p=>p.status==='confirmed').length,1);
  assert.equal(r.ctx.bankReceiptRows_('V2_bills')[0].payment_status,'paid');
  assert.equal(r.ctx.bankReceiptRows_('V2_bank_payer_links').length,1);
  assert.equal(r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'}).success,true);
  assert.equal(r.ctx.bankReceiptRows_('V2_payments').filter(p=>p.status==='confirmed').length,1);
});

test('readback recovers committed settlement and does not hide old pending receipts',()=>{
 const r=runtime();intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
 const update=r.ctx.bankReceiptUpdate_;let fail=true;
 r.ctx.bankReceiptUpdate_=function(n,k,id,v){if(n==='V2_bank_email_receipts'&&v.status==='settled'&&fail){fail=false;throw Error('interrupted');}return update(n,k,id,v);};
 assert.throws(()=>r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'}));
 assert.equal(r.ctx.bankReceiptInit_(r.access).data.receipts[0].status,'settled');
 assert.equal(r.calls,1);
 intake(r,{notification_number:'SYNTH-PENDING',amount:9000});
 const pending=r.ctx.bankReceiptRows_('V2_bank_email_receipts').find(x=>x.status==='unmatched');
 for(let i=0;i<110;i++)r.ctx.bankReceiptAppend_('V2_bank_email_receipts',{...row,receipt_id:'synthetic-history-'+i,status:'other',created_at:'2099-01-01'});
 assert.ok(r.ctx.bankReceiptInit_(r.access).data.receipts.some(x=>x.receipt_id===pending.receipt_id));
});
test('failed delivery is retried from persisted receipt even when Gmail fetch fails',()=>{
 const r=runtime();r.ctx.workspaceNotifyTeam_=()=>({success:true,data:{notification_id:'n1',status:'failed',success:false}});
 intake(r);let retries=0;r.ctx.workspaceNotifyTeam_=()=>{retries++;return {success:true,data:{notification_id:'n1',status:'sent',success:true}};};
 r.ctx.UrlFetchApp={fetch(){throw Error('synthetic Gmail failure');}};
 assert.throws(()=>r.ctx.runBankEmailReceiptIntake());
 assert.equal(retries,1);
});
test('invalid Gmail cursor is cleared so the next schedule can restart',()=>{
 const r=runtime();r.ctx.runBankEmailReceiptMigration();
 const key='CMWEBS_BANK_EMAIL_INTAKE_CURSOR_'+r.ctx.bankReceiptHash_(r.ctx.bankReceiptQuery_(r.config)).slice(0,12);
 r.props.set(key,'expired-token');r.ctx.UrlFetchApp={fetch:()=>({getResponseCode:()=>400,getContentText:()=> '{}'})};
 assert.throws(()=>r.ctx.runBankEmailReceiptIntake());assert.equal(r.props.has(key),false);
});

test('notification retry persists before sending and reuses provider idempotency key',()=>{
 const r=runtime();vm.runInContext(fs.readFileSync('apps-script/V2_WORKSPACE_NOTIFICATIONS.js','utf8'),r.ctx);
 const deliveries=[];const keys=[];let fail=true;
 r.ctx.workspaceNotificationFind_=(_,key,id)=>deliveries.find(d=>d[key]===id)||null;
 r.ctx.workspaceNotificationAppend_=(_,d)=>deliveries.push({...d});
 r.ctx.workspaceNotificationUpdateByKey_=(_,key,id,v)=>Object.assign(deliveries.find(d=>d[key]===id),v);
 r.ctx.pushLineTextMessage_=(_,text,key)=>{assert.equal(deliveries.length,1);assert.equal(deliveries[0].send_count,keys.length+1);keys.push(key);if(fail){fail=false;throw Error('ambiguous HTTP timeout');}return {success:true};};
 const n={source:'bank_email_receipt',notification_id:'BN-synthetic',workspace_id:'ws-a',title:'入帳通知',body:'合成資料'};
 const member={user_id:'user-a',line_user_id:'line-a',display_name:'合成成員'};
 assert.equal(r.ctx.workspaceNotificationBankDeliver_(n,member,true,new Date('2026-10-09T01:00:00Z')).delivery_status,'failed');
 assert.equal(r.ctx.workspaceNotificationBankDeliver_(n,member,true,new Date('2026-10-09T01:01:00Z')).delivery_status,'failed');assert.equal(keys.length,1);
 assert.equal(r.ctx.workspaceNotificationBankDeliver_(n,member,true,new Date('2026-10-09T01:06:00Z')).delivery_status,'sent');
 assert.equal(keys[0],keys[1]);assert.match(keys[0],/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
 r.ctx.workspaceNotificationBankDeliver_(n,member,true,new Date('2026-10-09T01:12:00Z'));assert.equal(keys.length,2);
});
test('intake search starts at Taipei midnight using epoch seconds',()=>{
 const r=runtime();assert.equal(r.ctx.bankReceiptQuery_(r.config),'subject:入帳通知 after:'+((Date.parse('2026-10-09T00:00:00+08:00')/1000)-1));
});

test('real committed bill/payment recover even when report tail write was interrupted; approval stays with actor',()=>{
 const r=runtime();intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
 Object.assign(r.ctx,{V2_TIMEZONE:'Asia/Taipei',workspaceLandlordResolveAccess_:()=>r.access,billingBillMatchesAccessScope_:(b,a)=>b.workspace_id===a.workspace.workspace_id,v2CanonicalBillIsVoided_:()=>false,billingPreflightBillViews_(){},billingSyncBillViews_(){},billingRefreshWorkspaceSummaries_(){},manualSettlementSyncLegacy_:()=>({monthly:{},history:{}}),cmwebsLogLineMessage_(){},logLiffAccess_(){},logAudit_(){}});
 vm.runInContext(fs.readFileSync('apps-script/V2_PAYMENT_SETTLEMENT.js','utf8'),r.ctx);
 const writer=r.ctx.updateSettlementRowByObject_;
 r.ctx.updateSettlementRowByObject_=function(sh,index,v){if(sh===r.sheets.V2_payment_reports && v.status==='confirmed')throw Error('interruption after canonical commit');return writer(sh,index,v);};
 r.ctx.settleWorkspaceLandlordPaymentReportByLineUid_=(uid,id,note)=>r.ctx.settleLandlordPaymentReportByLineUid_(uid,id,note);
 // Interrupt bank finishing too; a later teammate read must repair the existing payment.
 const finish=r.ctx.bankReceiptFinish_;r.ctx.bankReceiptFinish_=()=>{throw Error('interrupted bank finish');};
 try{r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'});}catch(_){}
 assert.equal(r.ctx.bankReceiptRows_('V2_bills')[0].payment_status,'paid');
 r.ctx.bankReceiptFinish_=finish;
 const viewer={...r.access,user:{user_id:'viewer-a'},permissions:{}};
 assert.equal(r.ctx.bankReceiptInit_(viewer).data.receipts[0].status,'settled');
 const closed=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];assert.equal(closed.confirmed_by,'user-a');
 assert.equal(r.ctx.bankReceiptRows_('V2_payment_reports')[0].status,'confirmed');
 r.ctx.bankReceiptInit_(viewer);assert.equal(r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0].confirmed_at,closed.confirmed_at);
 assert.equal(r.ctx.bankReceiptRows_('V2_bank_payer_links')[0].confirmed_by,'user-a');
 assert.equal(r.ctx.bankReceiptRows_('V2_payments').filter(p=>p.status==='confirmed').length,1);
});

test('new routes reject GET, raw UID, query-only credentials, revoked session, and changed membership',()=>{
 const r=runtime();vm.runInContext(fs.readFileSync('apps-script/程式碼.js','utf8'),r.ctx);
 r.ctx.jsonOutput_=(data)=>data;r.ctx.runtimeSnapshotBegin_=()=>{};r.ctx.runtimeSnapshotEnd_=()=>{};
 assert.equal(r.ctx.doGet({parameter:{v2_action:'landlord_bank_receipts_init',line_user_id:'line-a'}}).code,'POST_REQUIRED');
 assert.equal(r.ctx.bankReceiptDispatch_('landlord_bank_receipts_init',{line_user_id:'line-a'}).code,'AUTH_REQUIRED');
 const queryOnly=r.ctx.bankReceiptPostRequest_({postData:{contents:'action=landlord_bank_receipts_init'},queryString:'landlord_session_token=fake'});
 assert.equal(r.ctx.bankReceiptDispatch_(queryOnly.action,queryOnly.request).code,'AUTH_REQUIRED');
 r.ctx.resolveLandlordQuickLeaseBridgeAccess_=()=>({success:false,code:'SESSION_EXPIRED'});
 assert.equal(r.ctx.bankReceiptDispatch_('landlord_bank_receipts_init',{landlord_session_token:'expired'}).code,'SESSION_EXPIRED');
 r.ctx.landlordContractSigningReviewAuthenticate_=()=>({success:true,data:{session_token:'synthetic'}});
 r.ctx.verifyLandlordContractSigningReviewSessionToken_=()=>({success:true,data:{line_sub:'line-a',workspace_id:'ws-a',user_id:'user-a',membership_id:'another-member'}});
 assert.equal(r.ctx.bankReceiptDispatch_('landlord_bank_receipts_init',{id_token:'synthetic'}).code,'AUTH_REQUIRED');
});
test('Gmail worker scans newest mail while paginating backlog and completes intake with no payment',()=>{
 const r=runtime();r.ctx.runBankEmailReceiptMigration();const key='CMWEBS_BANK_EMAIL_INTAKE_CURSOR_'+r.ctx.bankReceiptHash_(r.ctx.bankReceiptQuery_(r.config)).slice(0,12);
 r.props.set(key,'backlog');const urls=[];
 r.ctx.UrlFetchApp={fetch(url,options){urls.push(url);assert.equal(options.headers.Authorization,'Bearer synthetic-token');
 const data=url.endsWith('/profile')?{emailAddress:'reconcile@example.test'}:url.includes('/messages/new?')?{id:'new',internalDate:Date.parse('2026-10-09T09:08:00+08:00'),payload:{mimeType:'text/plain',body:{data:Buffer.from(sample).toString('base64url')},headers:[{name:'From',value:'bsnotify@mail.post.gov.tw'},{name:'Subject',value:'入帳通知(No.123456)'},{name:'Authentication-Results',value:'mx.google.com; dmarc=pass header.from=post.gov.tw'}]}}:url.includes('pageToken=backlog')?{messages:[],nextPageToken:'backlog-2'}:{messages:[{id:'new'}],nextPageToken:'first-page'};
 return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(data)};}};
 assert.equal(r.ctx.runBankEmailReceiptIntake().success,true);assert.equal(r.ctx.bankReceiptRows_('V2_bank_email_receipts').length,1);
 assert.equal(r.notices.length,1);assert.equal(r.calls,0);assert.equal(r.ctx.bankReceiptRows_('V2_bills')[0].payment_status,'unpaid');
 assert.ok(urls.some(u=>u.includes('pageToken=backlog')));assert.equal(r.props.get(key),'backlog-2');
});
test('postal settlement compares exact current amount inside the formal service lock',()=>{
 const r=runtime();intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
 Object.assign(r.ctx,{V2_TIMEZONE:'Asia/Taipei',workspaceLandlordResolveAccess_:()=>r.access,billingBillMatchesAccessScope_:(b,a)=>b.workspace_id===a.workspace.workspace_id,v2CanonicalBillIsVoided_:()=>false,billingPreflightBillViews_(){},billingSyncBillViews_(){},billingRefreshWorkspaceSummaries_(){},manualSettlementSyncLegacy_:()=>({monthly:{},history:{}}),cmwebsLogLineMessage_(){},logLiffAccess_(){},logAudit_(){}});
 vm.runInContext(fs.readFileSync('apps-script/V2_PAYMENT_SETTLEMENT.js','utf8'),r.ctx);
 r.ctx.settleWorkspaceLandlordPaymentReportByLineUid_=(uid,id,note)=>{r.ctx.bankReceiptUpdate_('V2_bills','bill_id','bill-a',{total_amount:6432.4});return r.ctx.settleLandlordPaymentReportByLineUid_(uid,id,note);};
 assert.equal(r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'}).code,'PAYMENT_AMOUNT_MISMATCH');
 assert.equal(r.ctx.bankReceiptRows_('V2_payments').filter(p=>p.status==='confirmed').length,0);
 assert.equal(r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,decision:'other'}).success,true);
});
test('LINE retry key uses 409 as accepted and 4xx as terminal without changing existing callers',()=>{
 const r=runtime();vm.runInContext(fs.readFileSync('apps-script/V2_API.js','utf8'),r.ctx);r.props.set('LINE_CHANNEL_ACCESS_TOKEN','synthetic-token');let status=409;let header;
 r.ctx.UrlFetchApp={fetch:(_,options)=>{header=options.headers['X-Line-Retry-Key'];return {getResponseCode:()=>status,getContentText:()=> 'synthetic-error'};}};
 assert.equal(r.ctx.pushLineTextMessage_('synthetic-line','合成通知','synthetic-key').success,true);assert.equal(header,'synthetic-key');
 status=400;assert.equal(r.ctx.pushLineTextMessage_('synthetic-line','合成通知','synthetic-key').code,'LINE_PUSH_PERMANENT');
 assert.equal(r.ctx.pushLineTextMessage_('synthetic-line','合成通知').code,'LINE_PUSH_FAILED');assert.equal(header,undefined);
});

test('terminal unbound notifications cannot starve later failed receipts when Gmail is down',()=>{
 const r=runtime();r.ctx.workspaceNotifyTeam_=()=>({success:true,data:{notification_id:'n',status:'stored',failed_count:0,deliveries:[{delivery_status:'skipped_unbound'}]}});
 for(let i=0;i<25;i++)intake(r,{notification_number:'UNBOUND-'+i});
 r.ctx.workspaceNotifyTeam_=()=>({success:true,data:{notification_id:'failed',status:'failed',failed_count:1,deliveries:[{delivery_status:'failed'}]}});
 intake(r,{notification_number:'FAILED'});let retries=0;r.ctx.workspaceNotifyTeam_=()=>{retries++;return {success:true,data:{notification_id:'failed',status:'sent',deliveries:[{delivery_status:'sent'}]}};};
 r.ctx.UrlFetchApp={fetch(){throw Error('synthetic Gmail failure');}};assert.throws(()=>r.ctx.runBankEmailReceiptIntake());assert.equal(retries,1);
});

test('legacy bill compatibility follows the real billing Workspace policy and never overrides foreign Workspace',()=>{
 const r=runtime();const billing=fs.readFileSync('apps-script/V2_BILLING_MANAGEMENT.js','utf8');
 r.ctx.billingText_=v=>String(v??'').trim();
 vm.runInContext(billing.slice(billing.indexOf('function billingBillMatchesAccessScope_('),billing.indexOf('function billingGetWorkspaceRows_(')),r.ctx);
 r.sheets.V2_workspaces=sheet([{workspace_id:'ws-a',workspace_status:'active'}]);
 r.ctx.workspaceLandlordResolvePrincipals_=(_,context)=>{assert.equal(context.activeWorkspace.workspace_id,'ws-a');return [{landlord_id:'owner-a'}];};
 const scope=r.ctx.bankReceiptWorkspaceScope_('ws-a');const evidence=receipt({workspace_id:'ws-a',payment_account_id:'acct-a'});
 assert.equal(r.ctx.bankReceiptMatch_(evidence,[bill('legacy',{workspace_id:''})],[],scope).bill_id,'legacy');
 assert.equal(r.ctx.bankReceiptMatch_(evidence,[bill('foreign',{workspace_id:'ws-b'})],[],scope).bill_id,'');
 assert.equal(r.ctx.bankReceiptMatch_(evidence,[bill('foreign-owner',{workspace_id:'',landlord_id:'owner-b'})],[],scope).bill_id,'');
});
test('uncommitted claims cannot consume the readback recovery limit',()=>{
 const r=runtime();intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
 const finish=r.ctx.bankReceiptFinish_;r.ctx.bankReceiptFinish_=()=>{throw Error('interrupted');};
 assert.throws(()=>r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-a'}));r.ctx.bankReceiptFinish_=finish;
 const committed=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];const sh=r.sheets.V2_bank_email_receipts;const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
 const old=[];for(let i=0;i<25;i++)old.push({...committed,receipt_id:'synthetic-uncommitted-'+i,report_id:'nonexistent-'+i});
 const all=[...old,committed];sh.getRange(2,1,all.length,headers.length).setValues(all.map(o=>headers.map(k=>o[k]??'')));
 assert.equal(r.ctx.bankReceiptInit_(r.access).data.receipts.find(x=>x.receipt_id===row.receipt_id).status,'settled');assert.equal(r.calls,1);
});

test('enabled intake refuses a different authenticated Gmail mailbox',()=>{
 const r=runtime();r.ctx.runBankEmailReceiptMigration();r.ctx.UrlFetchApp={fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({emailAddress:'wrong@example.test'})})};
 assert.throws(()=>r.ctx.runBankEmailReceiptIntake(),/mailbox mismatch/);assert.equal(r.ctx.bankReceiptRows_('V2_bank_email_receipts').length,0);
});

test('postal direct envelope supports the observed official sender spelling',()=>{
 const r=runtime();assert.equal(r.ctx.bankReceiptMailSource_([{name:'From',value:'bsnsnotify@mail.post.gov.tw'},{name:'Authentication-Results',value:'mx.google.com; dmarc=pass header.from=post.gov.tw'}],{trusted_forwarders:[]}),'direct');
});

function existingSettlement(r){
 intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];
 r.ctx.bankReceiptUpdate_('V2_bills','bill_id','bill-a',{payment_status:'paid',payment_id:'external-payment'});
 r.ctx.tenantPaymentReportEnsureSheet_();
 r.ctx.bankReceiptAppend_('V2_payment_reports',{report_id:'tenant-report',landlord_id:'owner-a',tenant_id:'tenant-a',bill_id:'bill-a',reported_amount:6432,reported_last5:'01234',reported_paid_date:'2026-10-09',status:'confirmed',matched_payment_id:'external-payment',confirmed_by:'human',confirmed_at:'2026-10-10'});
 r.ctx.bankReceiptAppend_('V2_payments',{payment_id:'external-payment',bill_id:'bill-a',status:'confirmed',amount:6432,source_ref_id:'tenant-report'});return row;
}
test('existing tenant settlement projects receipt as settled without creating or changing payments',()=>{
 const r=runtime();const row=existingSettlement(r);const before=JSON.stringify(r.ctx.bankReceiptRows_('V2_payments'));
 const data=r.ctx.bankReceiptInit_(r.access).data;assert.equal(data.receipts[0].status,'settled');assert.equal(data.receipts[0].payment_id,'external-payment');assert.equal(r.calls,0);assert.equal(JSON.stringify(r.ctx.bankReceiptRows_('V2_payments')),before);
 assert.equal(r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0].status,'pending','read projection does not mutate receipt');
});
test('paid original bill cannot be reassigned to another unpaid bill',()=>{
 const r=runtime();const row=existingSettlement(r);r.ctx.bankReceiptAppend_('V2_bills',bill('bill-b'));
 const result=r.ctx.bankReceiptConfirm_(r.access,{receipt_id:row.receipt_id,bill_id:'bill-b',decision:'confirm'});assert.equal(result.success,false);assert.equal(result.code,'RECEIPT_ALREADY_SETTLED');assert.equal(r.calls,0);
});
test('paid original bill with insufficient evidence is review-needed, never a new payment selector',()=>{
 const r=runtime();existingSettlement(r);r.ctx.bankReceiptUpdate_('V2_payment_reports','report_id','tenant-report',{reported_last5:'99999'});
 assert.equal(r.ctx.bankReceiptInit_(r.access).data.receipts[0].status,'paid_bill_review');assert.equal(r.calls,0);
});

test('existing settlement rejects ambiguous receipts and foreign or inconsistent payments',()=>{
 for(const changed of [{workspace_id:'foreign'},{bank_last5:'99999'},{tenant_id:'foreign'},{source_ref_id:'other-report'},{status:'void'}]){
  const r=runtime();existingSettlement(r);r.ctx.bankReceiptUpdate_('V2_payments','payment_id','external-payment',changed);
  assert.equal(r.ctx.bankReceiptInit_(r.access).data.receipts[0].status,'paid_bill_review');
 }
 const r=runtime();const row=existingSettlement(r);r.ctx.bankReceiptAppend_('V2_bank_email_receipts',{...row,receipt_id:'another-receipt'});assert.equal(r.ctx.bankReceiptInit_(r.access).data.receipts[0].status,'paid_bill_review');
});

test('automatic settlement sends completed notification once instead of pending action',()=>{const r=runtime();r.config.auto_settle_unique_amount=true;intake(r);assert.equal(r.notices.length,1);assert.match(r.notices[0].title,/已完成自動對帳/);assert.match(r.notices[0].body,/帳單已銷帳/);assert.doesNotMatch(r.notices[0].body,/待確認銷帳|請確認是否入帳/);intake(r);assert.equal(r.notices.length,1);});
test('failed automatic completion notice retries completed wording without another payment',()=>{const r=runtime();r.config.auto_settle_unique_amount=true;r.ctx.workspaceNotifyTeam_=p=>{r.notices.push(p);return {success:true,data:{notification_id:p.notification_id,status:'failed'}};};intake(r);const calls=r.calls;const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];assert.equal(r.ctx.bankReceiptNeedsNotification_(row),true);r.ctx.bankReceiptNotify_(row);assert.equal(r.notices[0].notification_id,r.notices[1].notification_id);assert.match(r.notices[1].title,/已完成自動對帳/);assert.equal(r.calls,calls);});

test('pending receipt with a proven automatic payment never retries stale approval wording',()=>{const r=runtime();r.config.auto_settle_unique_amount=true;intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];r.ctx.bankReceiptUpdate_('V2_bank_email_receipts','receipt_id',row.receipt_id,{status:'pending',notification_status:'failed'});r.ctx.bankReceiptNotify_(r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0]);assert.match(r.notices.at(-1).title,/已完成自動對帳/);assert.doesNotMatch(r.notices.at(-1).body,/待確認銷帳/);});
test('settled label without canonical payment evidence cannot announce completion',()=>{const r=runtime();intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];const before=r.notices.length;r.ctx.bankReceiptNotify_({...row,status:'settled',confirmed_by:'system:bank_email_auto'});assert.equal(r.notices.length,before);});

test('partially delivered automatic completion remains eligible for stable retry',()=>{const r=runtime();r.config.auto_settle_unique_amount=true;r.ctx.workspaceNotifyTeam_=p=>{r.notices.push(p);return {success:true,data:{notification_id:p.notification_id,status:'partial',deliveries:[{delivery_status:'sent'},{delivery_status:'failed'}]}};};intake(r);const row=r.ctx.bankReceiptRows_('V2_bank_email_receipts')[0];assert.equal(row.notification_status,'partial');assert.equal(r.ctx.bankReceiptNeedsNotification_(row),true);r.ctx.bankReceiptNotify_(row);assert.equal(r.notices[0].notification_id,r.notices[1].notification_id);});
