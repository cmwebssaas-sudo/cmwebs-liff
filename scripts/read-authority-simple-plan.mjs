// Owner-approved dual-account replacement. Offline validation grants no IO.
import {STAGED_RESUME_POLICY,STAGED_RESUME_STAGES} from './read-authority-continuation-plan.mjs';
import {types} from 'node:util';
export const SIMPLE_DECISION='eccdb919d865327e3b5922231b253266e9084afe33305e12a32e64501efa39b2';
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export const SIMPLE_RULES=freeze({...STAGED_RESUME_POLICY.operations,'A:original-cloud-backup':{actor:'publisher',target:'original-settings',methods:['snapshot']}});
export const REBALANCE_DECISION='bdab855eb6e95f7ba838e4514bd9bbc8b59db0ee64755d12950706b5ac0e051a';
export const OWNER_CONNECTION_DECISION='710fc0a4ff12766c997377a73e8d40f3314722b99b674d0f0fd741a7a96a6b31';
export const PROJECT_RETARGET_DECISION='2deec8acafeb444f258ba2ecdddb2cda65c81db5f1ecba032584348e9479b963';
export const SIMPLE_NATIVE=freeze(["A:original-cloud-backup","A:original-triggers-backup","A:original-properties-backup","D:thin-gcp-link","D:thin-properties-write","D:thin-properties-readback","E:testing-user-write","E:testing-user-readback","E:client-create","E:client-readback","E:oauth-response","F:wrapper-before.original-settings","F:wrapper-before.original-triggers","F:wrapper-before.thin-settings","F:wrapper-before.oauth-audience","F:wrapper-before.oauth-client","F:wrapper-after.original-settings","F:wrapper-after.original-triggers","F:wrapper-after.thin-settings","F:wrapper-after.oauth-audience","F:wrapper-after.oauth-client"]);
export const SIMPLE_STAGES=STAGED_RESUME_STAGES;
const fail=()=>{throw Error('SIMPLE_PLAN_UNVERIFIED');};
export function simpleData(value){
 let left=12000;const active=new Set();const copy=(v,depth)=>{
  if(--left<0||depth>12)fail();if(v===null||['string','boolean'].includes(typeof v))return v;
  if(typeof v==='number'){if(!Number.isSafeInteger(v))fail();return v;}
  if(!v||typeof v!=='object'||types.isProxy(v)||active.has(v))fail();active.add(v);
  const ds=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(ds),array=Array.isArray(v),out=array?[]:{};
  if(keys.some(k=>typeof k!=='string')||array&&(!Object.hasOwn(ds.length,'value')||ds.length.value>300||keys.length!==ds.length.value+1))fail();
  for(const k of keys){if(array&&k==='length')continue;const d=ds[k];if(!d.enumerable||!Object.hasOwn(d,'value'))fail();Object.defineProperty(out,k,{value:copy(d.value,depth+1),enumerable:true});}
  if(array&&Object.keys(out).some((k,i)=>k!==String(i)))fail();active.delete(v);return out;
 };return freeze(copy(value,0));
}
export const simpleExact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const id=v=>typeof v==='string'&&/^[-A-Za-z0-9_.]{1,100}$/.test(v);
const originalCleanup=freeze({'C:restore-editor':{actor:'publisher',target:'original-project',methods:['PUT']},'C:read-restored-editor':{actor:'publisher',target:'original-project',methods:['GET']}});
export function simpleFixed(raw,cleanup=false){
 const op=simpleData(raw),key=op.bucket+':'+op.alias,r=SIMPLE_RULES[key]??(cleanup?originalCleanup[key]:null);
 if(!simpleExact(op,['id','bucket','alias','actor','target','operation','units'])||!id(op.id)||!r||r.actor!==op.actor||r.target!==op.target||!r.methods.includes(op.operation)||![1,null].includes(op.units))fail();return op;
}
export function simpleBrowser(raw,allowWait=false){
 const op=simpleData(raw),r=SIMPLE_RULES[op.key],navigation=['original-settings','original-triggers','thin-settings','thin-triggers','oauth-audience','oauth-client','caller-executions','publisher-executions','caller-oauth'];
 if(!simpleExact(op,['id','key','actor','target','operation','units','preparation'])||!id(op.id)||![1,null].includes(op.units)||typeof op.preparation!=='boolean'||!['inventory','claim','navigate','snapshot','click','fill','submit','read-key-presence',...(allowWait?['wait']:[])].includes(op.operation))fail();
 if(op.operation==='wait'&&(!allowWait||op.key!=='N:preparation'||op.preparation!==true||!['thin-settings','oauth-audience'].includes(op.target)))fail();
 if(r){if(r.actor!==op.actor||r.target!==op.target||op.preparation||r.methods.every(m=>['GET','snapshot','read-key-presence'].includes(m))&&!['snapshot','read-key-presence'].includes(op.operation))fail();}
 else if(!['N:preparation','N:navigation','N:thin-triggers-before','N:thin-triggers-after'].includes(op.key)||!navigation.includes(op.target)||!['publisher','caller'].includes(op.actor)||op.actor!==(op.target.startsWith('caller-')?'caller':'publisher')||['click','fill','submit'].includes(op.operation)||op.preparation!==(op.key==='N:preparation')||op.key.startsWith('N:thin-')&&(op.target!=='thin-triggers'||op.operation!=='snapshot'))fail();
 return op;
}
export function compileAuthoritySimplePlan(raw){
 const p=simpleData(raw),retarget=p.accountingDecision===PROJECT_RETARGET_DECISION,ownerConnection=retarget||p.accountingDecision===OWNER_CONNECTION_DECISION,connection=ownerConnection||p.accountingDecision==='659f6874e4e7a53558ed3e3bb9c0e69c2783d42465eeb2eb05bbf921d6d8f6c8',rebalanced=connection||p.accountingDecision===REBALANCE_DECISION;
 if(!simpleExact(p,['decisionHash','history','mapComplete','operations','browserOperations',...(rebalanced?['accountingDecision']:[])])||p.decisionHash!==SIMPLE_DECISION||!simpleExact(p.history,['spent','limit'])||p.history.spent!==53||p.history.limit!==(ownerConnection?132:connection?134:rebalanced?139:160)||typeof p.mapComplete!=='boolean'||!Array.isArray(p.operations)||!Array.isArray(p.browserOperations))fail();
 const seen=new Set(),ids=new Set(),unknown=[];let ui=0,cleanup=0,preparation=0;
 for(const raw of p.operations){const o=simpleFixed(raw),k=o.bucket+':'+o.alias;if(seen.has(k)||ids.has(o.id))fail();seen.add(k);ids.add(o.id);if(o.units===null)unknown.push(k);}
 for(const raw of p.browserOperations){const o=simpleBrowser(raw);if(ids.has(o.id))fail();ids.add(o.id);if(o.units===null)unknown.push(o.id);if(/^[CIJ]:/.test(o.key))cleanup++;else ui++;if(o.preparation)preparation++;}
 if(ui>(retarget?86:ownerConnection?84:connection?82:rebalanced?77:56)||cleanup>16||preparation>16)fail();
 const missing=Object.keys(SIMPLE_RULES).filter(k=>!seen.has(k)||rebalanced&&SIMPLE_NATIVE.includes(k)&&!p.browserOperations.some(o=>o.key===k)),eligible=p.mapComplete&&unknown.length===0&&missing.length===0;
 return freeze({source:'simple-offline-plan',decisionHash:SIMPLE_DECISION,mainSpent:53,uiSpent:0,mainLimit:ownerConnection?132:connection?134:rebalanced?139:160,uiLimit:retarget?102:ownerConnection?100:connection?98:rebalanced?93:72,combinedLimit:retarget?234:232,mainReserved:ownerConnection?132:rebalanced?134:155,cleanupReserve:21,unusedReserve:ownerConnection?0:2,uiOrdinary:ui,uiCleanup:cleanup,preparation,missing,unknown,credentialRpcEligible:eligible,executionAuthorized:false});
}
