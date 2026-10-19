import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { authorityRuntime, authoritySecret } from './fixtures/read-parity/authority-runtime.mjs';

const tables=['V2_landlord_email_sessions','V2_users','V2_workspaces','V2_workspace_members','V2_landlords'];
const id='synthetic-sheet';
const cell=value=>Object.prototype.toString.call(value)==='[object Date]'
  ? {effectiveValue:{numberValue:(value.valueOf()+28800000)/86400000+25569},effectiveFormat:{numberFormat:{type:'DATE_TIME'}}}
  : {effectiveValue:{[typeof value==='boolean'?'boolValue':typeof value==='number'?'numberValue':'stringValue']:value}};
function document(h) {
  return {spreadsheetId:id,properties:{timeZone:'Asia/Taipei',defaultFormat:{numberFormat:{type:'NUMBER'}}},sheets:tables.map((title,index)=>{
    const rows=h.data[title],headers=[...new Set(rows.flatMap(row=>Object.keys(row)))];
    return {properties:{title,sheetId:index},data:[{rowData:[{values:headers.map(cell)},...rows.map(row=>({values:headers.map(field=>cell(row[field]??''))}))]}]};
  })};
}
function runtime() {
  const h=authorityRuntime(),calls={fetches:0,tokens:0,parses:0,nativeReads:0},nativeFetch=h.context.UrlFetchApp.fetch;
  const nativeSpreadsheet=h.context.SpreadsheetApp.getActiveSpreadsheet(),nativeSheet=nativeSpreadsheet.getSheetByName;
  nativeSpreadsheet.getSheetByName=name=>{
    const sheet=nativeSheet(name);if(!sheet)return sheet;
    const range=sheet.getDataRange;sheet.getDataRange=()=>{calls.nativeReads++;return range();};return sheet;
  };
  h.context.Utilities.parseDate=(text,zone,format)=>{
    calls.parses++;assert.equal(format,'yyyy-MM-dd HH:mm:ss.SSS');
    assert(['Asia/Taipei','GMT'].includes(zone));
    return new Date(text.replace(' ','T')+(zone==='GMT'?'Z':'+08:00'));
  };
  h.context.Utilities.formatDate=(date,zone,format)=>{
    assert.equal(format,'yyyy-MM-dd HH:mm:ss.SSS');assert(['Asia/Taipei','GMT'].includes(zone));
    return new Date(date.valueOf()+(zone==='GMT'?0:28800000)).toISOString().slice(0,-1).replace('T',' ');
  };
  h.context.ScriptApp={getOAuthToken:()=>{calls.tokens++;return 'synthetic-google-token';}};
  let responseStatus=200,body=()=>JSON.stringify(document(h));
  h.context.UrlFetchApp.fetch=(url,options)=>{
    if(url.startsWith('https://api.line.me/'))return nativeFetch(url,options);
    calls.fetches++;assert(url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/'+id+'?'));
    const parsed=new URL(url);assert.deepEqual(parsed.searchParams.getAll('ranges'),tables.map(title=>"'"+title+"'"));
    assert.equal(parsed.searchParams.get('includeGridData'),'true');
    assert.equal(options.method,'get');assert.equal(options.followRedirects,false);assert.equal(options.muteHttpExceptions,true);
    assert.equal(options.headers.Authorization,'Bearer synthetic-google-token');
    assert.match(options.headers['Cache-Control'],/no-store/);
    assert.doesNotMatch(url,/synthetic-google-token|synthetic-email-token/);
    return {getResponseCode:()=>responseStatus,getContentText:body};
  };
  return {h,calls,setBody:value=>body=typeof value==='function'?value:()=>JSON.stringify(value),setStatus:value=>responseStatus=value};
}
function signed(h,protocol='session',credential='synthetic-email-token') {
  const payload=JSON.stringify({protocol,credential,credential_digest:createHash('sha256').update(protocol+':'+credential).digest('hex'),route:'/v1/arrears'});
  const request={action:'read_replica_authorize',timestamp:h.clock(),nonce:randomUUID(),payload};
  request.signature=createHmac('sha256',authoritySecret).update('cmwebs-read-auth-request-v1\n'+request.timestamp+'\n'+request.nonce+'\n'+payload).digest('hex');return request;
}
function result(h,protocol) {return JSON.parse(h.post(signed(h,protocol,protocol==='liff'?'synthetic-valid-line-token':'synthetic-email-token')).body).result;}
function assertSafeLogs(h) {assert.doesNotMatch(h.logs.join('\n'),/synthetic-google-token|synthetic-email-token|SYNTHETIC_U1|private not JSON|private detail/);}
test('grid parser retains typed scalars, holes, source ordinals and a calculated empty formula',()=>{
  const {h}=runtime(),doc=document(h),table=doc.sheets[0];
  table.data[0].rowData=[{values:[cell('a'),cell('b'),cell('c')]},{values:[cell(false),{},cell(0)]},{values:[]},{values:[{userEnteredValue:{formulaValue:'=""'},effectiveValue:{stringValue:''}}]}];
  const snapshot=h.context.readAuthorizationGridSnapshot_(doc,id);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot.values[tables[0]])),[['a','b','c'],[false,'',0],['','',''],['','','']]);
  assert.equal(snapshot.sheet_ids[tables[0]],0);
});
test('serial dates use source timezone and exact millisecond type instead of strings/numbers',()=>{
  const {h}=runtime(),doc=document(h);
  for(const instant of ['2026-10-12T00:00:00.000Z','2026-10-12T15:59:59.999Z','2026-10-12T16:00:00.001Z']) {
    const serial=(Date.parse(instant)+28800000)/86400000+25569;
    doc.sheets[0].data[0].rowData=[{values:[cell('expires_at')]},{values:[{effectiveValue:{numberValue:serial},effectiveFormat:{numberFormat:{type:'DATE_TIME'}}}]}];
    const value=h.context.readAuthorizationGridSnapshot_(doc,id).values[tables[0]][1][0];
    assert.equal(Object.prototype.toString.call(value),'[object Date]');assert.equal(value.toISOString(),instant);
  }
});
test('default date format is taken from spreadsheet properties; explicit number overrides it',()=>{
  const {h}=runtime(),doc=document(h);doc.properties.timeZone='GMT';doc.properties.defaultFormat.numberFormat.type='DATE';
  doc.sheets[0].data[0].rowData=[{values:[cell('date'),cell('number'),cell('text')]},{values:[cell(25569),{...cell(25569),effectiveFormat:{numberFormat:{type:'NUMBER'}}},cell('25569')]}];
  const values=h.context.readAuthorizationGridSnapshot_(doc,id).values[tables[0]][1];
  assert.equal(values[0].toISOString(),'1970-01-01T00:00:00.000Z');assert.equal(values[1],25569);assert.equal(values[2],'25569');
});
test('sparse grid cannot expand beyond the total hydrated-cell cap',()=>{
  const {h}=runtime(),doc=document(h),rows=Array.from({length:1001},()=>({}));
  rows[0]={values:[cell('first')]};rows[1000]={values:Array.from({length:100},()=>({}))};
  rows[1000].values[99]=cell('last');doc.sheets[0].data[0].rowData=rows;
  assert.throws(()=>h.context.readAuthorizationGridSnapshot_(doc,id),/AUTH_GRID_UNAVAILABLE/);
});
for(const [name,mutate] of [
  ['foreign spreadsheet',doc=>doc.spreadsheetId='foreign'],
  ['missing timezone',doc=>delete doc.properties.timeZone],
  ['missing table',doc=>doc.sheets.pop()],
  ['duplicate table',doc=>doc.sheets[4]=doc.sheets[0]],
  ['duplicate sheet ID',doc=>doc.sheets[4].properties.sheetId=doc.sheets[0].properties.sheetId],
  ['offset partial range',doc=>doc.sheets[0].data[0].startRow=1],
  ['multiple grid chunks',doc=>doc.sheets[0].data.push({})],
  ['non-finite number',doc=>doc.sheets[0].data[0].rowData[0].values[0]=cell(Infinity)],
  ['ambiguous cell types',doc=>doc.sheets[0].data[0].rowData[0].values[0].effectiveValue.boolValue=true],
  ['unsupported formula error',doc=>doc.sheets[0].data[0].rowData[0].values[0]={effectiveValue:{errorValue:{type:'ERROR',message:'private detail'}}}],
  ['oversized rows',doc=>doc.sheets[0].data[0].rowData=Array.from({length:20001},()=>({}))],
])test('grid rejects '+name,()=>{const {h}=runtime(),doc=document(h);mutate(doc);assert.throws(()=>h.context.readAuthorizationGridSnapshot_(doc,id),/AUTH_GRID_UNAVAILABLE/);});
test('fresh batch fetch reuses canonical LINE/Email access and exposes no credential/operational rows',()=>{
  const {h,calls}=runtime();
  for(const protocol of ['session','liff']) {
    const response=result(h,protocol);assert.equal(response.success,true);assert.equal(response.fingerprint.role,'owner');
    assert.doesNotMatch(JSON.stringify(response),/synthetic-email-token|synthetic-google-token|tenant_name|example.invalid/);
  }
  assert.equal(calls.fetches,2);assert.equal(calls.tokens,2);assert.equal(calls.nativeReads,0);assertSafeLogs(h);
});
test('forgery and replay do not perform Google credential or Sheet IO',()=>{
  const {h,calls}=runtime(),request=signed(h);
  assert.equal(h.post({...request,signature:'0'.repeat(64)}).success,false);assert.equal(calls.fetches,0);assert.equal(calls.tokens,0);
  assert.equal(JSON.parse(h.post(request).body).result.success,true);assert.equal(calls.fetches,1);
  assert.equal(h.post(request).success,false);assert.equal(calls.fetches,1);assert.equal(calls.tokens,1);
});
for(const [name,mutate] of [
  ['revoked session',h=>h.data.V2_landlord_email_sessions[0].status='revoked'],
  ['expired session',h=>h.data.V2_landlord_email_sessions[0].expires_at='2026-10-01T00:00:00Z'],
  ['disabled user',h=>h.data.V2_users[0].account_status='disabled'],
  ['suspended membership',h=>h.data.V2_workspace_members[0].member_status='suspended'],
  ['disabled workspace',h=>h.data.V2_workspaces[0].account_status='disabled'],
  ['changed role',h=>h.data.V2_workspace_members[0].role='viewer'],
  ['ambiguous identity',h=>h.data.V2_users.push({...h.data.V2_users[0],user_id:'foreign'})],
])test('each bulk request sees source-only '+name,()=>{const {h,calls}=runtime();assert.equal(result(h).success,true);mutate(h);assert.equal(result(h).success,false);assert.equal(calls.fetches,2);});
for(const status of [302,403,503])test('HTTP '+status+' safely falls back to fresh native authorization',()=>{
  const {h,calls,setStatus}=runtime();setStatus(status);assert.equal(result(h).success,true);assert.equal(calls.fetches,1);
  assert(calls.nativeReads>0);h.data.V2_landlord_email_sessions[0].status='revoked';assert.equal(result(h).success,false);assert.equal(calls.fetches,2);assertSafeLogs(h);
});
test('malformed and oversized bodies fall back without logging or stale values',()=>{
  for(const body of ['private not JSON',' '.repeat(1000001)]) {
    const {h,calls,setBody}=runtime();setBody(()=>body);assert.equal(result(h).success,true);assert(calls.nativeReads>0);h.data.V2_users[0].account_status='disabled';assert.equal(result(h).success,false);assertSafeLogs(h);
  }
});
test('unrelated metadata is allowed but never hydrates operational rows',()=>{
  const {h}=runtime(),doc=document(h);doc.sheets.push({properties:{title:'V2_bills',sheetId:88}});
  const snapshot=h.context.readAuthorizationGridSnapshot_(doc,id);assert.equal(Object.keys(snapshot.values).length,5);assert.equal(snapshot.values.V2_bills,undefined);
  doc.sheets.at(-1).data=[{rowData:[{values:[cell('private operational data')]}]}];assert.throws(()=>h.context.readAuthorizationGridSnapshot_(doc,id),/AUTH_GRID_UNAVAILABLE/);
});
test('successful bulk access restores native handles and request-local caches after resolution',()=>{
  const {h,calls}=runtime();h.context.runtimeSnapshotBegin_('read_replica_authorize');
  const before=h.context.runtimeSpreadsheet_();
  const response=h.context.readAuthorizationResolveFresh_({protocol:'session',credential:'synthetic-email-token'});
  assert.equal(response.role,'owner');assert.equal(h.context.runtimeSpreadsheet_(),before);assert.equal(calls.nativeReads,0);
  assert.equal(h.context.runtimeSnapshotGetContext_('workspace_access','SYNTHETIC_LINE1||onboarding'),null);
});
for(const role of ['owner','admin','manager','accountant','maintenance','viewer'])test('bulk fingerprint equals native permissions for '+role,()=>{
  const {h,calls}=runtime();h.data.V2_workspace_members[0].role=role;h.data.V2_landlord_email_sessions[0].role=role;
  const native=authorityRuntime();native.data.V2_workspace_members[0].role=role;native.data.V2_landlord_email_sessions[0].role=role;
  assert.deepEqual(result(h),result(native));assert.equal(calls.nativeReads,0);
});
test('delegated manager and foreign principal retain canonical native authorization exactly',()=>{
  const {h,calls}=runtime(),native=authorityRuntime();
  for(const current of [h,native]) {
    const owner=current.data.V2_users[0],member=current.data.V2_workspace_members[0],landlord=current.data.V2_landlords[0];
    current.data.V2_users.push({...owner,user_id:'SYNTHETIC_MANAGER',line_user_id:'SYNTHETIC_MANAGER_LINE'});
    current.data.V2_workspace_members.push({...member,user_id:'SYNTHETIC_MANAGER',membership_id:'SYNTHETIC_MANAGER_MEMBER',role:'manager'});
    current.data.V2_landlord_email_sessions[0].user_id='SYNTHETIC_MANAGER';current.data.V2_landlord_email_sessions[0].role='manager';
    current.data.V2_landlords.push({...landlord,landlord_id:'SYNTHETIC_FOREIGN_OWNER',workspace_id:'SYNTHETIC_W2',user_id:owner.user_id});
  }
  const bulk=result(h);assert.equal(bulk.success,true);assert.equal(bulk.fingerprint.role,'manager');assert.deepEqual(bulk,result(native));
  assert(!bulk.fingerprint.principals.some(row=>row.landlord_id==='SYNTHETIC_FOREIGN_OWNER'));assert.equal(calls.nativeReads,0);
});
test('native Date expiry retains the one-millisecond authorization boundary through bulk decoding',()=>{
  const {h,calls}=runtime();h.data.V2_landlord_email_sessions[0].expires_at=new Date(h.clock()+1);
  assert.equal(result(h).success,true);h.advance(1);assert.equal(result(h).success,false);assert.equal(calls.nativeReads,0);assert.equal(calls.parses,2);
});
for(const [name,mutate] of [
  ['Email disabled',h=>h.data.V2_users[0].email_login_enabled=false],
  ['unverified Email',h=>h.data.V2_users[0].email_verified_at=''],
  ['unsupported role',h=>h.data.V2_workspace_members[0].role='tenant'],
  ['incomplete onboarding',h=>h.data.V2_workspaces[0].onboarding_status='pending'],
  ['foreign session workspace',h=>h.data.V2_landlord_email_sessions[0].workspace_id='SYNTHETIC_W2'],
])test('bulk retains native rejection for '+name,()=>{
  const {h,calls}=runtime(),native=authorityRuntime();mutate(h);mutate(native);assert.deepEqual(result(h),result(native));assert.equal(result(h).success,false);assert.equal(calls.nativeReads,0);
});
for(const [name,mutate] of [
  ['user disabled',h=>h.data.V2_users[0].account_status='disabled'],
  ['member suspended',h=>h.data.V2_workspace_members[0].member_status='suspended'],
  ['workspace disabled',h=>h.data.V2_workspaces[0].account_status='disabled'],
  ['role changed',h=>h.data.V2_workspace_members[0].role='viewer'],
])test('bulk reads current permissions after LINE provider waiting: '+name,()=>{
  const {h,calls}=runtime(),native=authorityRuntime();
  for(const current of [h,native]) {
    const fetch=current.context.UrlFetchApp.fetch;
    current.context.UrlFetchApp.fetch=(url,options)=>{if(url.startsWith('https://api.line.me/'))mutate(current);return fetch(url,options);};
  }
  const bulk=result(h,'liff');assert.deepEqual(bulk,result(native,'liff'));assert.equal(calls.nativeReads,0);
});
test('bulk session data is captured after the canonical Email hash-secret read',()=>{
  const {h,calls}=runtime(),native=authorityRuntime();
  for(const current of [h,native]) {
    const properties=current.context.PropertiesService.getScriptProperties;
    current.context.PropertiesService.getScriptProperties=()=>{const store=properties();return {...store,getProperty:name=>{
      if(name==='CMWEBS_EMAIL_LOGIN_HASH_SECRET')current.data.V2_users[0].account_status='disabled';return store.getProperty(name);
    }};};
  }
  const bulk=result(h);assert.deepEqual(bulk,result(native));assert.equal(bulk.success,false);assert.equal(calls.nativeReads,0);
});
test('invalid LINE credentials never obtain a Google token or preload policy values',()=>{
  const {h,calls}=runtime();const reply=h.post(signed(h,'liff','synthetic-invalid-line-token'));
  assert.equal(JSON.parse(reply.body).result.success,false);assert.equal(calls.tokens,0);assert.equal(calls.fetches,0);assert.equal(calls.nativeReads,0);
});
