import vm from 'node:vm';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
export class CommercialSheet {
  constructor(name){this.name=name;this.values=[];}
  getLastRow(){return this.values.length;}
  getLastColumn(){return Math.max(0,...this.values.map(r=>r.length));}
  getDataRange(){return {getValues:()=>this.values.map(r=>r.slice())};}
  getRange(row,column,height=1,width=1){return {getValues:()=>Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>this.values[row+r-1]?.[column+c-1]??'')),setValue:value=>this.getRange(row,column).setValues([[value]]),setValues:matrix=>{matrix.forEach((data,r)=>{this.values[row+r-1]??=[];data.forEach((value,c)=>{this.values[row+r-1][column+c-1]=value;});});}};}
  appendRow(row){this.values.push(Array.from(row));}
  objects(){return this.values.slice(1).map((r,i)=>Object.fromEntries([['__row_number',i+2],...this.values[0].map((h,c)=>[h,r[c]??''])]));}
}
export function createCommercialRentalRuntime({modules=['V2_WORKSPACES.js','V2_LANDLORD_EMAIL_AUTH.js','V3_PLATFORM_CORE_SUBSCRIPTIONS.js','V3_LANDLORD_REGISTRATION.js','V3_PLATFORM_CORE_MEMBER_PROVISIONING.js'],transport,initialize=true}={}){
  const sheets={},ss={getSheetByName:name=>sheets[name]??null,insertSheet:name=>{if(sheets[name])throw new Error('Duplicate sheet');return sheets[name]=new CommercialSheet(name);}};
  const state={locked:false,mail:[],fetches:[],audit:[],now:'2026-10-11T00:00:00Z'};
  const properties={CMWEBS_EMAIL_LOGIN_HASH_SECRET:'synthetic-hash-secret',CMWEBS_LINE_LOGIN_CHANNEL_ID:'synthetic-channel',CMWEBS_PLATFORM_CORE_PRODUCT_ID:'prd_commercial_test',CMWEBS_PLATFORM_CORE_ENVIRONMENT:'staging'};
  const bytes=buffer=>Array.from(buffer,byte=>byte>127?byte-256:byte),buffer=value=>Array.isArray(value)?Buffer.from(value):Buffer.from(String(value));
  const context={console,Date,JSON,Object,Array,String,Number,Math,RegExp,Error,WeakSet,Uint8Array,Set,Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'SHA_256'},computeDigest:(_algorithm,value)=>bytes(crypto.createHash('sha256').update(buffer(value)).digest()),computeHmacSha256Signature:(value,key)=>bytes(crypto.createHmac('sha256',buffer(key)).update(buffer(value)).digest()),base64EncodeWebSafe:value=>buffer(value).toString('base64url'),base64DecodeWebSafe:value=>bytes(Buffer.from(value,'base64url')),newBlob:value=>({getDataAsString:()=>buffer(value).toString(),getBytes:()=>bytes(buffer(value))})},
    runtimeSpreadsheet_:()=>ss,SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush(){}},PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties[key]??null})},Session:{getEffectiveUser:()=>({getEmail:()=> 'synthetic-operator@example.invalid'})},LockService:{getScriptLock:()=>({waitLock(){if(state.locked)throw new Error('Nested lock');state.locked=true;},releaseLock(){state.locked=false;}})},MailApp:{sendEmail:mail=>{if(state.locked)throw new Error('Mail inside lock');state.mail.push(mail);}},UrlFetchApp:{fetch:(url,options)=>{if(state.locked)throw new Error('Fetch inside lock');state.fetches.push({url,options});if(url==='https://api.line.me/oauth2/v2.1/verify' && options.payload.id_token==='verified-line-token')return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({iss:'https://access.line.me',aud:properties.CMWEBS_LINE_LOGIN_CHANNEL_ID,sub:'line-verified',exp:Math.floor(Date.now()/1000)+300,iat:Math.floor(Date.now()/1000)})};return {getResponseCode:()=>400,getContentText:()=> '{}'};}},workspaceWriteActivityLog_:record=>state.audit.push(record),workspaceLogAccess_:()=>{},workspaceActivityAudit_:record=>state.audit.push(record)};
  vm.createContext(context);for(const module of modules)vm.runInContext(readFileSync(new URL('../../apps-script/'+module,import.meta.url),'utf8'),context,{filename:module});
  context.workspaceNowIso_=()=>state.now;context.workspaceWriteActivityLog_=record=>state.audit.push(record);context.workspaceLogAccess_=()=>{};
  if(transport)context.platformCoreProvisionTransport_=transport;
  if(initialize){context.workspaceEnsureSchema_();context.initializeCommercialRentalSchema_();}
  return {api:context,sheets,state,properties,ss};
}
