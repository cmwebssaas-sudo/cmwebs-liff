// Pure exact-URL retarget selector; unknown metadata values stay unvisited.
import {types} from 'node:util';
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\s\x00-\x1f\x7f]/.test(v);
const initial=()=>({source:'readonly-project-inventory-v1',status:'RESULT_UNVERIFIED',rowCount:0,invalidRows:0,accessors:0,proxies:0,duplicateIds:0,providerIdMissing:0,opaqueIdMissing:0,exactUrlMatches:0,rawValuesRetained:false});
const finish=(d,status,selected=null)=>Object.freeze({classification:Object.freeze({...d,status}),selected:selected===null?null:Object.freeze(selected)});
export const authorityProjectInventoryFailure=()=>finish(initial(),'API_REJECTED');
export function selectAuthorityProjectTab(raw,options){
 const d=initial();
 if(!options||typeof options!=='object'||types.isProxy(options)||Array.isArray(options))return finish(d,'OPTIONS_INVALID');
 const od=Object.getOwnPropertyDescriptors(options),keys=Reflect.ownKeys(od);
 if(keys.length!==1||keys[0]!=='expectedURL'||!Object.hasOwn(od.expectedURL,'value')||typeof od.expectedURL.value!=='string'||!od.expectedURL.value||od.expectedURL.value.length>4096)return finish(d,'OPTIONS_INVALID');
 const expectedURL=od.expectedURL.value;
 if(types.isProxy(raw)){d.proxies++;return finish(d,'ROOT_PROXY');}
 if(!Array.isArray(raw))return finish(d,'ROOT_NOT_ARRAY');
 const ds=Object.getOwnPropertyDescriptors(raw),length=ds.length?.value;
 if(!Number.isInteger(length)||length<0||length>300||Reflect.ownKeys(ds).length!==length+1)return finish(d,'ARRAY_SHAPE');
 d.rowCount=length;const providers=new Set(),opaque=new Set();let selected=null;
 for(let i=0;i<length;i++){
  const cell=ds[String(i)];if(!cell||!Object.hasOwn(cell,'value')){d.invalidRows++;if(cell)d.accessors++;continue;}
  const row=cell.value;if(row&&typeof row==='object'&&types.isProxy(row)){d.proxies++;continue;}
  if(!row||typeof row!=='object'||Array.isArray(row)){d.invalidRows++;continue;}
  const names=Reflect.ownKeys(row);if(names.length>32){d.invalidRows++;continue;}
  const rd=Object.getOwnPropertyDescriptors(row),accessors=names.filter(k=>!Object.hasOwn(rd[k],'value')).length;
  if(accessors||names.some(k=>typeof k!=='string')){d.accessors+=accessors;d.invalidRows++;continue;}
  const field=k=>Object.hasOwn(rd,k)?rd[k].value:undefined;
  const id=field('id'),providerTabId=field('providerTabId'),url=field('url');
  if(!validId(id)){d.opaqueIdMissing++;d.invalidRows++;}
  if(!validId(providerTabId)){d.providerIdMissing++;d.invalidRows++;}
  if(!validId(id)||!validId(providerTabId))continue;
  if(typeof url!=='string'||url.length>4096){d.invalidRows++;continue;}
  if(providers.has(providerTabId))d.duplicateIds++;if(opaque.has(id))d.duplicateIds++;providers.add(providerTabId);opaque.add(id);
  if(url===expectedURL){d.exactUrlMatches++;if(selected===null||providerTabId<selected.providerTabId||providerTabId===selected.providerTabId&&id<selected.id)selected={id,providerTabId,url};}
 }
 if(d.proxies||d.accessors||d.invalidRows)return finish(d,'METADATA_INVALID');
 if(d.duplicateIds)return finish(d,'DUPLICATE_ID');
 if(!d.exactUrlMatches)return finish(d,'URL_MISMATCH');
 return finish(d,'VERIFIED',selected);
}
