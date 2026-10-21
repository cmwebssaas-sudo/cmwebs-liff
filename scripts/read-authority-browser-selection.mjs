// Offline metadata selection grants no IO or account/browser identity credit.
import {simpleData,simpleExact} from './read-authority-simple-plan.mjs';
const fail=(reason='READ_BROWSER_UNVERIFIED')=>{throw Error(reason);};
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\s\x00-\x1f\x7f]/.test(v);
export function selectReadAuthorityBrowser(raw,options){
 const rows=simpleData(raw),o=simpleData(options);
 if(!simpleExact(o,['originalBrowserId','publisherChromeConfirmedByInstructionContext'])||!id(o.originalBrowserId)||typeof o.publisherChromeConfirmedByInstructionContext!=='boolean'||!Array.isArray(rows)||rows.length>100||rows.some(r=>!r||Array.isArray(r)||!id(r.id)||typeof r.name!=='string'||typeof r.type!=='string'))fail();
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
 const rows=simpleData(raw),o=simpleData(options);
 if(!simpleExact(o,['providerTabId','expectedURL'])||!id(o.providerTabId)||typeof o.expectedURL!=='string'||!o.expectedURL||!Array.isArray(rows)||rows.length>300)fail();
 const found=rows.filter(r=>r&&r.providerTabId===o.providerTabId);
 if(found.length!==1||!id(found[0].id)||found[0].url!==o.expectedURL)fail();
 return Object.freeze({id:found[0].id,providerTabId:found[0].providerTabId,url:found[0].url});
}
