// Pure local metadata classification. No IO, getters, raw inventory, account
// labels, arbitrary metadata or provider errors enter the diagnostic result.
import {types} from 'node:util';
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\s\x00-\x1f\x7f]/.test(v);
const initial=()=>({source:'readonly-tab-inventory-v1',status:'UNCLASSIFIED',rowCount:0,invalidRows:0,accessors:0,proxies:0,duplicateIds:0,providerIdMissing:0,originalMatches:0,exactUrlMatches:0,rawValuesRetained:false});
const finish=(classification,status,selected=null)=>Object.freeze({classification:Object.freeze({...classification,status}),selected:selected===null?null:Object.freeze(selected)});
export const authorityInventoryApiFailure=()=>finish(initial(),'API_REJECTED');
export function classifyAuthorityInventory(raw,options){
 const out=initial();
 if(!options||typeof options!=='object'||types.isProxy(options)||Array.isArray(options))return finish(out,'OPTIONS_INVALID');
 const od=Object.getOwnPropertyDescriptors(options),keys=Reflect.ownKeys(od);
 if(keys.length!==2||!['providerTabId','expectedURL'].every(k=>Object.hasOwn(od[k]??{},'value'))||
  !validId(od.providerTabId.value)||typeof od.expectedURL.value!=='string'||!od.expectedURL.value||od.expectedURL.value.length>4096)return finish(out,'OPTIONS_INVALID');
 const providerTabId=od.providerTabId.value,expectedURL=od.expectedURL.value;
 if(types.isProxy(raw)){out.proxies++;return finish(out,'ROOT_PROXY');}
 if(!Array.isArray(raw))return finish(out,'ROOT_NOT_ARRAY');
 const array=Object.getOwnPropertyDescriptors(raw),length=array.length?.value;
 if(!Number.isInteger(length)||length<0||length>300||Reflect.ownKeys(array).length!==length+1)return finish(out,'ARRAY_SHAPE');
 out.rowCount=length;const ids=new Set(),found=[];
 for(let index=0;index<length;index++){
  const cell=array[String(index)];
  if(!cell||!Object.hasOwn(cell,'value')){out.invalidRows++;if(cell)out.accessors++;continue;}
  const row=cell.value;
  if(row&&typeof row==='object'&&types.isProxy(row)){out.proxies++;continue;}
  if(!row||typeof row!=='object'||Array.isArray(row)){out.invalidRows++;continue;}
  const names=Reflect.ownKeys(row);
  if(names.length>32){out.invalidRows++;continue;}
  const descriptors=Object.getOwnPropertyDescriptors(row);
  const accessors=names.filter(k=>!Object.hasOwn(descriptors[k],'value')).length;
  const symbols=names.some(k=>typeof k!=='string');
  if(accessors||symbols){out.accessors+=accessors;if(symbols)out.invalidRows++;continue;}
  const id=descriptors.id?.value,provider=descriptors.providerTabId?.value,url=descriptors.url?.value;
  if(!validId(id)||provider!==undefined&&!validId(provider)||url!==undefined&&(typeof url!=='string'||url.length>4096)){out.invalidRows++;continue;}
  if(ids.has(id))out.duplicateIds++;ids.add(id);
  if(provider===undefined)out.providerIdMissing++;
  if(provider===providerTabId){out.originalMatches++;if(url===expectedURL)out.exactUrlMatches++;found.push({id,providerTabId:provider,url});}
 }
 if(out.proxies||out.accessors||out.invalidRows)return finish(out,'METADATA_INVALID');
 if(out.duplicateIds)return finish(out,'DUPLICATE_ID');
 if(out.originalMatches!==1)return finish(out,'ORIGINAL_MATCH_COUNT');
 if(out.exactUrlMatches!==1)return finish(out,'URL_MISMATCH');
 return finish(out,'VERIFIED',found[0]);
}
