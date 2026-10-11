import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash,createHmac,randomUUID } from 'node:crypto';
import { richDataset,fixture } from './runtime.mjs';
export const authoritySecret='synthetic-authority-secret';
export const emailSecret='synthetic-email-key';
export function authorityRuntime() {
  const data=richDataset(),cache=new Map(),logs=[];
  let clock=Date.parse(fixture.now);
  Object.assign(data.V2_users[0],{email:'synthetic@example.invalid',email_verified_at:'2026-10-01',email_login_enabled:true});
  data.V2_landlord_email_sessions=[{session_id:'SYNTHETIC_SESSION',session_token_hash:createHmac('sha256',emailSecret).update('session:synthetic-email-token').digest('hex'),user_id:'SYNTHETIC_U1',workspace_id:'SYNTHETIC_W1',role:'owner',status:'active',revoked_at:'',expires_at:'2026-10-13T00:00:00Z'}];
  class Clock extends Date {constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
  const ss={getId:()=> 'synthetic-sheet',getSheetByName:name=>{
    if(!data[name]) return null;
    const rows=data[name],headers=[...new Set(rows.flatMap(row=>Object.keys(row)))];
    return {getParent:()=>ss,getSheetId:()=>name,getDataRange:()=>({getValues:()=>[headers,...rows.map(row=>headers.map(field=>row[field]??''))]}),setValues(){throw new Error('Unexpected Sheet write');}};
  }};
  const properties={READ_REPLICA_URL:'https://synthetic-replica.invalid',READ_REPLICA_SYNC_SECRET:authoritySecret,CMWEBS_LINE_LOGIN_CHANNEL_ID:'SYNTHETIC_CHANNEL',CMWEBS_EMAIL_LOGIN_HASH_SECRET:emailSecret};
  const signed=bytes=>[...bytes].map(value=>value>127?value-256:value);
  const context=vm.createContext({Date:Clock,JSON,console,
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss},PropertiesService:{getScriptProperties:()=>({getProperty:name=>properties[name]||null,setProperty(){throw new Error('Unexpected Property write');}})},
    CacheService:{getScriptCache:()=>({get:key=>cache.get(key)||null,getAll:keys=>Object.fromEntries(keys.filter(key=>cache.has(key)).map(key=>[key,cache.get(key)])),put:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key)})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    Logger:{log:value=>logs.push(String(value))},Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
      computeDigest:(_,text)=>signed(createHash('sha256').update(text).digest()),computeHmacSha256Signature:(text,key)=>signed(createHmac('sha256',key).update(text).digest())},
    UrlFetchApp:{fetch:(_url,options)=>({getResponseCode:()=>options.payload.id_token==='synthetic-valid-line-token'?200:401,
      getContentText:()=>JSON.stringify({iss:'https://access.line.me',aud:'SYNTHETIC_CHANNEL',sub:'SYNTHETIC_LINE1',exp:clock/1000+600})})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({getContent:()=>body,setMimeType(){return this;}})},
    bankReceiptPostRequest_:()=>({handled:false}),repairRouteRequestFromPostBody_:()=>({handled:false})});
  for(const name of ['V2_RUNTIME_SNAPSHOT','V2_WORKSPACES','V2_WORKSPACE_LANDLORD_ACCESS','V2_LANDLORD_EMAIL_AUTH','V2_LINE_IDENTITY','V2_READ_REPLICA_SCHEMA','V2_READ_REPLICA_SYNC','V2_READ_AUTHORIZATION']) {
    vm.runInContext(readFileSync(new URL('../../../apps-script/'+name+'.js',import.meta.url),'utf8'),context,{filename:name});
  }
  const dispatcher=readFileSync(new URL('../../../apps-script/程式碼.js',import.meta.url),'utf8');
  vm.runInContext(dispatcher.slice(dispatcher.indexOf('function doPost(e)')),context);
  function post(body) {return JSON.parse(context.doPost({postData:{contents:JSON.stringify(body)}}).getContent());}
  return {data,cache,logs,post,context,clock:()=>clock,advance:ms=>clock+=ms};
}
