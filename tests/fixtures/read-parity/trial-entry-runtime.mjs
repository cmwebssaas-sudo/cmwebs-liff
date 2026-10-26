import vm from 'node:vm';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {authorityRuntime,authoritySecret} from './authority-runtime.mjs';
import {buildAuthorityTrialEntry} from '../../../scripts/build-read-authority-trial-entry.mjs';
export const trialTables=['V2_landlord_email_sessions','V2_users','V2_workspaces','V2_workspace_members','V2_landlords'];
export const trialBudgetKey='cmwebs:c3-trial:budget:SYNTHETIC_TRIAL_EPOCH';
const cell=value=>Object.prototype.toString.call(value)==='[object Date]'?
  {effectiveValue:{numberValue:(value.valueOf()+28800000)/86400000+25569},effectiveFormat:{numberFormat:{type:'DATE_TIME'}}}:
  {effectiveValue:{[typeof value==='boolean'?'boolValue':typeof value==='number'?'numberValue':'stringValue']:value}};
export function trialDocument(h){return {spreadsheetId:'synthetic-sheet',properties:{timeZone:'Asia/Taipei',defaultFormat:{numberFormat:{type:'NUMBER'}}},
  sheets:trialTables.map((title,sheetId)=>{const rows=h.data[title],headers=[...new Set(rows.flatMap(row=>Object.keys(row)))];return {properties:{title,sheetId},data:[{rowData:[{values:headers.map(cell)},...rows.map(row=>({values:headers.map(key=>cell(row[key]??''))}))]}]};})};}
export function trialSigned(h,protocol='session',credential=protocol==='liff'?'synthetic-valid-line-token':'synthetic-email-token'){
  const payload=JSON.stringify({protocol,credential,credential_digest:createHash('sha256').update(protocol+':'+credential).digest('hex'),route:'/v1/arrears'});
  const r={action:'read_replica_authorize',timestamp:h.clock(),nonce:randomUUID(),payload};r.signature=createHmac('sha256',authoritySecret).update('cmwebs-read-auth-request-v1\n'+r.timestamp+'\n'+r.nonce+'\n'+payload).digest('hex');return r;
}
export function trialEntryRuntime(){
  const h=authorityRuntime(),bundle=buildAuthorityTrialEntry(),calls={native:0,google:0,line:0,tokens:0,maxLockDepth:0,lockDepth:0};
  const initial=trialDocument(h),config={C3_TRIAL_CALLER_EMAIL:'trial-reader@example.invalid',C3_TRIAL_CALLER_SCRIPT_ID:'SYNTHETIC_THIN_SCRIPT',
    C3_TRIAL_EPOCH:'SYNTHETIC_TRIAL_EPOCH',C3_TRIAL_SHEET_CONTRACT:JSON.stringify({spreadsheet_id:'synthetic-sheet',time_zone:'Asia/Taipei',
      tables:initial.sheets.map(sheet=>({name:sheet.properties.title,sheet_id:sheet.properties.sheetId,headers:sheet.data[0].rowData[0].values.map(c=>c.effectiveValue.stringValue)}))})};
  h.cache.set(trialBudgetKey,JSON.stringify({remaining:40,expires_at:h.clock()+3600000,requests:[]}));
  let body=()=>JSON.stringify(trialDocument(h)),status=200,googleHook=null,lineHook=null,budgetPut='normal';
  const utilities={...h.context.Utilities,parseDate:(text,zone,format)=>{if(zone!=='Asia/Taipei'||format!=='yyyy-MM-dd HH:mm:ss.SSS')throw Error('Unexpected timezone');return new Date(text.replace(' ','T')+'+08:00');},
    formatDate:(date,zone,format)=>{if(zone!=='Asia/Taipei'||format!=='yyyy-MM-dd HH:mm:ss.SSS')throw Error('Unexpected timezone');return new Date(date.valueOf()+28800000).toISOString().slice(0,-1).replace('T',' ');}};
  const context=vm.createContext({Date:h.context.Date,JSON,console,Utilities:utilities,Logger:h.context.Logger,
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>Object.hasOwn(config,key)?config[key]:h.context.PropertiesService.getScriptProperties().getProperty(key),setProperty(){throw Error('PROPERTY_WRITE_FORBIDDEN');}})},
    Session:{getActiveUser:()=>({getEmail:()=> 'trial-reader@example.invalid'}),getEffectiveUser:()=>({getEmail:()=> 'trial-reader@example.invalid'})},
    ScriptApp:{getScriptId:()=> 'SYNTHETIC_THIN_SCRIPT',getOAuthToken:()=>{calls.tokens++;return 'synthetic-google-token';}},
    SpreadsheetApp:new Proxy({}, {get(){calls.native++;throw Error('NATIVE_SHEET_FORBIDDEN');}}),
    CacheService:{getScriptCache:()=>{const cache=h.context.CacheService.getScriptCache();return {...cache,put(key,value,ttl){
      if(key===trialBudgetKey&&budgetPut==='ignore')return;
      if(key===trialBudgetKey&&budgetPut==='drop'){h.cache.delete(key);return;}
      return cache.put(key,value,ttl);
    }};}},
    LockService:{getScriptLock:()=>({tryLock:()=>{calls.lockDepth++;calls.maxLockDepth=Math.max(calls.maxLockDepth,calls.lockDepth);return true;},releaseLock:()=>{calls.lockDepth--;}})},
    UrlFetchApp:{fetch(url,options){
      if(url==='https://api.line.me/oauth2/v2.1/verify'){calls.line++;if(lineHook)lineHook();return h.context.UrlFetchApp.fetch(url,options);}
      calls.google++;const parsed=new URL(url);if(parsed.origin!=='https://sheets.googleapis.com'||parsed.pathname!=='/v4/spreadsheets/synthetic-sheet')throw Error('ARBITRARY_NETWORK_FORBIDDEN');
      if(options.method!=='get'||options.followRedirects!==false||options.headers.Authorization!=='Bearer synthetic-google-token'||options.headers['Cache-Control']!=='no-cache, no-store')throw Error('UNSAFE_FETCH');
      if(JSON.stringify(parsed.searchParams.getAll('ranges'))!==JSON.stringify(trialTables.map(name=>"'"+name+"'")))throw Error('UNKNOWN_RANGE');
      if(googleHook)googleHook();return {getResponseCode:()=>status,getContentText:()=>body()};
    }}
  });
  vm.runInContext(bundle.librarySource,context);
  const call=(protocol='session',credential)=>context.authorizeTrial(trialSigned(h,protocol,credential),'authority');
  return {...h,config,calls,context,call,bundle,setBody:value=>body=typeof value==='function'?value:()=>JSON.stringify(value),setStatus:value=>status=value,
    onGoogle:fn=>googleHook=fn,onLine:fn=>lineHook=fn,setBudgetPut:mode=>budgetPut=mode};
}
