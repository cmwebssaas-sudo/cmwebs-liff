// Fixed, synthetic-only batch header transport. The retained canonical owner
// supplies externalRead; this module creates no scope, credential or resource.
import {createHash} from 'node:crypto';
import {types} from 'node:util';
const stop=()=>{throw Error('SYNTHETIC_HEADERS_UNVERIFIED');};
const genuineReadbacks=new WeakSet();
export function assertSyntheticHeaderReadback(receipt){if(!genuineReadbacks.has(receipt))stop();return receipt;}
const names=['V2_users','V2_workspaces','V2_workspace_members','V2_landlord_email_sessions','V2_landlords'];
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(x=>'https://www.googleapis.com/auth/'+x).sort();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&!types.isProxy(v)&&same(Object.keys(v).sort(),[...k].sort());
const id=v=>typeof v==='string'&&/^[-A-Za-z0-9_]{20,200}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
async function body(response,url){
 if(response.status!==200||response.redirected===true||response.url&&response.url!==url||!response.body){await response.body?.cancel().catch(()=>{});stop();}
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const r=await reader.read();if(r.done)break;if(!types.isUint8Array(r.value)||(size+=r.value.length)>65536){await reader.cancel().catch(()=>{});stop();}chunks.push(r.value);}}finally{reader.releaseLock();}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
}
export function createSyntheticHeaderReader(input){
 try{
  if(!exact(input,['syntheticSheetId','publisherHash','expiresAt','tabs','credential','fetcher','now','externalRead']))stop();
  const {syntheticSheetId,publisherHash,expiresAt,credential,fetcher,now,externalRead}=input;
  if(!id(syntheticSheetId)||!digest(publisherHash)||!Number.isSafeInteger(expiresAt)||[credential,fetcher,now,externalRead].some(f=>typeof f!=='function')||!Array.isArray(input.tabs)||input.tabs.length!==5)stop();
  const tabs=structuredClone(input.tabs),ids=new Set();
  tabs.forEach((t,i)=>{if(!exact(t,['name','sheetId','headers'])||t.name!==names[i]||!Number.isSafeInteger(t.sheetId)||t.sheetId<0||ids.has(t.sheetId)||!Array.isArray(t.headers)||!t.headers.length||t.headers.length>100||t.headers.some(h=>typeof h!=='string'||!h||h.length>256||h==='__row_number')||new Set(t.headers).size!==t.headers.length)stop();ids.add(t.sheetId);});freeze(tabs);
  let used=false;
  return Object.freeze({read:async()=>{
   if(used)stop();used=true;
   try{
     const raw=credential();if(types.isPromise(raw)){void raw.catch(()=>{});stop();}
     if(!exact(raw,['accessToken','accountHash','scopes','expiresAt','refreshTokenPresent']))stop();
     const token={...raw,scopes:[...raw.scopes]};
     const live=()=>{const t=now();if(!Number.isSafeInteger(t)||t>=expiresAt||!Number.isSafeInteger(token.expiresAt)||token.expiresAt-t<=10000||token.expiresAt>expiresAt)stop();return t;};
     if(typeof token.accessToken!=='string'||!token.accessToken||token.accessToken.length>8192||/[\s\x00-\x1f\x7f]/.test(token.accessToken)||token.accountHash!==publisherHash||token.refreshTokenPresent!==true||!same([...token.scopes].sort(),scopes))stop();live();
     const query=new URLSearchParams({majorDimension:'ROWS',valueRenderOption:'UNFORMATTED_VALUE',fields:'spreadsheetId,valueRanges(range,majorDimension,values)'});
     for(const tab of tabs)query.append('ranges',"'"+tab.name+"'!1:1");
     const url='https://sheets.googleapis.com/v4/spreadsheets/'+syntheticSheetId+'/values:batchGet?'+query;
     let attempts=0,active=true,completed=false,actual,observed;
     try{observed=await externalRead(async()=>{
      if(!active||++attempts!==1)stop();
      const start=live(),r=await body(await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+token.accessToken,'cache-control':'no-cache, no-store',pragma:'no-cache'}}),url);
      if(!active||live()<start||!exact(r,['spreadsheetId','valueRanges'])||r.spreadsheetId!==syntheticSheetId||!Array.isArray(r.valueRanges)||r.valueRanges.length!==5)stop();
      r.valueRanges.forEach((row,i)=>{const tab=tabs[i];if(!exact(row,['range','majorDimension','values'])||typeof row.range!=='string'||!new RegExp("^(?:'"+tab.name+"'|"+tab.name+")!A1:[A-Z]{1,3}1$").test(row.range)||row.majorDimension!=='ROWS'||!Array.isArray(row.values)||row.values.length!==1||!same(row.values[0],tab.headers))stop();});
      actual=freeze(r);completed=true;return actual;
     },'B:auth-tabs-batch');}finally{active=false;}
     // The only accepted result is this single bounded callback's five rows.
     if(attempts!==1||!completed||observed!==actual)stop();
     const tables=tabs.map((tab,i)=>({name:tab.name,sheet_id:tab.sheetId,headers:[...observed.valueRanges[i].values[0]]}));
    const contract={spreadsheet_id:syntheticSheetId,tables,time_zone:'Asia/Taipei'};
    const result=freeze({source:'fixed-synthetic-header-readback',contract,sheetContractHash:createHash('sha256').update(JSON.stringify(contract)).digest('hex'),headersVerified:true});
    genuineReadbacks.add(result);return result;
   }catch(_){stop();}
  }});
 }catch(_){stop();}
}
