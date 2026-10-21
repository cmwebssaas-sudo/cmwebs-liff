// Offline metadata selection grants no IO or account/browser identity credit.
import {types} from 'node:util';
import {simpleData,simpleExact} from './read-authority-simple-plan.mjs';
const fail=(reason='READ_BROWSER_UNVERIFIED')=>{throw Error(reason);};
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\s\x00-\x1f\x7f]/.test(v);
// Read only own data descriptors. Unknown values are never traversed, copied or
// returned; even an unrelated top-level accessor is rejected without invoking it.
function metadataRows(raw,maximum,fields){
 if(types.isProxy(raw)||!Array.isArray(raw))fail();
 const a=Object.getOwnPropertyDescriptors(raw),length=a.length?.value;
 if(!Number.isInteger(length)||length<0||length>maximum||Reflect.ownKeys(a).length!==length+1)fail();
 const rows=[];
 for(let i=0;i<length;i++){
  const entry=a[String(i)];if(!entry||!Object.hasOwn(entry,'value'))fail();
  const row=entry.value;if(!row||typeof row!=='object'||types.isProxy(row)||Array.isArray(row))fail();
  const descriptors=Object.getOwnPropertyDescriptors(row);
  if(Reflect.ownKeys(descriptors).some(k=>typeof k!=='string'||!Object.hasOwn(descriptors[k],'value')))fail();
  const projected={};for(const field of fields){const v=descriptors[field]?.value;if(v!==undefined&&typeof v!=='string')fail();projected[field]=v;}
  if(!id(projected.id))fail();rows.push(projected);
 }
 if(new Set(rows.map(r=>r.id)).size!==rows.length)fail();
 return rows;
}
export function selectReadAuthorityBrowser(raw,options){
 const rows=metadataRows(raw,100,['id','name','type']),o=simpleData(options);
 if(!simpleExact(o,['originalBrowserId','publisherChromeConfirmedByInstructionContext'])||!id(o.originalBrowserId)||typeof o.publisherChromeConfirmedByInstructionContext!=='boolean')fail();
 const original=rows.filter(r=>r.id===o.originalBrowserId);
 if(original.length>1)fail();
 if(original.length===1){if(original[0].name!=='Chrome'||original[0].type!=='extension')fail();return Object.freeze({browserId:original[0].id,selection:'ORIGINAL_CONNECTION',sameBrowserVerified:false,originalTabRequired:true});}
 if(!o.publisherChromeConfirmedByInstructionContext)fail();
 const chrome=rows.filter(r=>r.name==='Chrome'&&r.type==='extension');
 if(!chrome.length)fail('READ_BROWSER_OWNER_REQUIRED');
 if(chrome.length!==1)fail();
 return Object.freeze({browserId:chrome[0].id,selection:'CONFIRMED_UNIQUE_CHROME',sameBrowserVerified:false,originalTabRequired:true});
}
export function selectReadAuthorityOriginalTab(raw,options){
 const rows=metadataRows(raw,300,['id','providerTabId','url']),o=simpleData(options);
 if(!simpleExact(o,['providerTabId','expectedURL'])||!id(o.providerTabId)||typeof o.expectedURL!=='string'||!o.expectedURL||!Array.isArray(rows)||rows.length>300)fail();
 const found=rows.filter(r=>r&&r.providerTabId===o.providerTabId);
 if(found.length!==1||!id(found[0].id)||found[0].url!==o.expectedURL)fail();
 return Object.freeze({id:found[0].id,providerTabId:found[0].providerTabId,url:found[0].url});
}
