import test from 'node:test';import assert from 'node:assert/strict';
import {selectReadAuthorityBrowser,selectReadAuthorityOriginalTab} from '../scripts/read-authority-browser-selection.mjs';
const opts={originalBrowserId:'old-connection',publisherChromeConfirmedByInstructionContext:true};
const chrome=id=>({id,name:'Chrome',type:'extension'});
test('original Chrome connection is preferred without claiming full identity proof',()=>{const s=selectReadAuthorityBrowser([chrome('old-connection'),chrome('other')],{...opts,publisherChromeConfirmedByInstructionContext:false});assert.deepEqual(s,{browserId:'old-connection',selection:'ORIGINAL_CONNECTION',sameBrowserVerified:false,originalTabRequired:true});});
test('confirmed unique restored Chrome gets only a provisional current provider ID',()=>{assert.deepEqual(selectReadAuthorityBrowser([chrome('refreshed'),{id:'iab',name:'ChatGPT in-app browser',type:'iab'}],opts),{browserId:'refreshed',selection:'CONFIRMED_UNIQUE_CHROME',sameBrowserVerified:false,originalTabRequired:true});});
test('documented optional metadata never rejects or escapes minimal browser selection',()=>{
 const ignored=new Proxy({private:'MUST_NOT_READ'},{ownKeys(){throw Error('IGNORED_METADATA_ACCESSED');}});
 const row={...chrome('restored'),profileName:undefined,metadata:ignored,unknown:1.5};
 const s=selectReadAuthorityBrowser([row,{id:'iab',name:undefined,type:'iab',metadata:undefined}],opts);
 assert.deepEqual(s,{browserId:'restored',selection:'CONFIRMED_UNIQUE_CHROME',sameBrowserVerified:false,originalTabRequired:true});
 assert.equal(JSON.stringify(s).includes('private'),false);
});
test('optional tab metadata is ignored while original provider identity and URL remain exact',()=>{
 const row={id:'opaque',providerTabId:'original-tab',url:'https://example.invalid/a',title:undefined,metadata:{unsupported:undefined}};
 assert.deepEqual(selectReadAuthorityOriginalTab([row],{providerTabId:'original-tab',expectedURL:row.url}),{id:'opaque',providerTabId:'original-tab',url:row.url});
});
test('minimal metadata projection never invokes accessors and rejects top-level proxies or duplicate IDs',()=>{
 let reads=0;const row={...chrome('restored')};Object.defineProperty(row,'profileName',{enumerable:true,get(){reads++;throw Error('MUST_NOT_READ');}});
 assert.throws(()=>selectReadAuthorityBrowser([row],opts));assert.equal(reads,0);
 assert.throws(()=>selectReadAuthorityBrowser(new Proxy([chrome('restored')],{}),opts));
 assert.throws(()=>selectReadAuthorityBrowser([new Proxy(chrome('restored'),{})],opts));
 assert.throws(()=>selectReadAuthorityBrowser([chrome('restored'),{id:'iab',type:'iab'},{id:'iab',type:'iab'}],opts));
});
for(const defect of ['unconfirmed','ambiguous','duplicate-original','other-type','other-name','invalid-id','accessor'])test('browser selection rejects '+defect,()=>{let rows=[chrome('refreshed')],o=opts;if(defect==='unconfirmed')o={...opts,publisherChromeConfirmedByInstructionContext:false};if(defect==='ambiguous')rows.push(chrome('second'));if(defect==='duplicate-original')rows=[chrome('old-connection'),chrome('old-connection')];if(defect==='other-type')rows=[{...chrome('refreshed'),type:'iab'}];if(defect==='other-name')rows=[{...chrome('refreshed'),name:'Chrome Other'}];if(defect==='invalid-id')rows=[chrome('')];if(defect==='accessor')rows=[Object.defineProperty({},'id',{enumerable:true,get(){throw Error('MUST_NOT_ACCESS');}})];assert.throws(()=>selectReadAuthorityBrowser(rows,o));});
test('only exact provider tab reference and URL produce a minimal claim descriptor',()=>{const row={id:'opaque-new-handle',providerTabId:'original-tab',url:'https://example.invalid/a',title:'DO_NOT_RETURN',lastOpened:'DO_NOT_RETURN'};assert.deepEqual(selectReadAuthorityOriginalTab([row],{providerTabId:'original-tab',expectedURL:row.url}),{id:row.id,providerTabId:row.providerTabId,url:row.url});});
for(const defect of ['opaque-only','wrong-url','duplicate','missing-opaque'])test('original tab rejects '+defect,()=>{let rows=[{id:'opaque-new-handle',providerTabId:'original-tab',url:'https://example.invalid/a'}];if(defect==='opaque-only')rows=[{id:'original-tab',providerTabId:'different-tab',url:rows[0].url}];if(defect==='wrong-url')rows[0].url='https://example.invalid/other';if(defect==='duplicate')rows.push({...rows[0],id:'second-opaque'});if(defect==='missing-opaque')rows[0].id='';assert.throws(()=>selectReadAuthorityOriginalTab(rows,{providerTabId:'original-tab',expectedURL:'https://example.invalid/a'}));});
