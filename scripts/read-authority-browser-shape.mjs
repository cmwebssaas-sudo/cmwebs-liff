import {types} from 'node:util';
// Pure local diagnostics. No identifiers, labels, arbitrary strings or unknown
// values are returned. No provider/credential/network operations occur here.
export function discoveryShape(raw,originalBrowserId){
 const out={source:'readonly-browser-shape-v1',rootProxy:types.isProxy(raw),rootArray:false,rootArrayInspected:false,rowCount:0,arrayShapeRejected:false,invalidRows:0,rowProxies:0,topAccessors:0,invalidIds:0,invalidNames:0,invalidTypes:0,duplicateIds:0,originalMatches:0,originalEligible:0,eligibleChrome:0,rawValuesRetained:false};
 if(out.rootProxy)return Object.freeze(out);
 out.rootArrayInspected=true;out.rootArray=Array.isArray(raw);if(!out.rootArray)return Object.freeze(out);
 const a=Object.getOwnPropertyDescriptors(raw),n=a.length?.value;
 if(!Number.isInteger(n)||n<0||n>100||Reflect.ownKeys(a).length!==n+1){out.arrayShapeRejected=true;return Object.freeze(out);}out.rowCount=n;
 const ids=new Set();for(let i=0;i<n;i++){
  const cell=a[String(i)];if(!cell||!Object.hasOwn(cell,'value')){out.invalidRows++;continue;}const row=cell.value;
  if(row&&typeof row==='object'&&types.isProxy(row)){out.rowProxies++;continue;}
  if(!row||typeof row!=='object'||Array.isArray(row)){out.invalidRows++;continue;}
  const d=Object.getOwnPropertyDescriptors(row);out.topAccessors+=Reflect.ownKeys(d).filter(k=>typeof k!=='string'||!Object.hasOwn(d[k],'value')).length;
  const get=k=>d[k]&&Object.hasOwn(d[k],'value')?d[k].value:undefined,id=get('id'),name=get('name'),type=get('type');
  const valid=typeof id==='string'&&id.length>0&&id.length<=200&&!/[\s\x00-\x1f\x7f]/.test(id);
  if(!valid)out.invalidIds++;else{if(ids.has(id))out.duplicateIds++;ids.add(id);}
  if(name!==undefined&&typeof name!=='string')out.invalidNames++;if(type!==undefined&&typeof type!=='string')out.invalidTypes++;
  const eligible=name==='Chrome'&&type==='extension';if(eligible)out.eligibleChrome++;if(id===originalBrowserId){out.originalMatches++;if(eligible)out.originalEligible++;}
 }
 return Object.freeze(out);
}
