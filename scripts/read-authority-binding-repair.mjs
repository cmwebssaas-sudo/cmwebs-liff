// One owner-approved incident only. This module performs local verification;
// only the canonical ledger may debit or complete the exception.
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {userInfo} from 'node:os';
import {verifyAuthorityTrialRollback} from './read-authority-trial-rollback.mjs';
export const BINDING_REPAIR_INCIDENT_HASH='2f231f4b4de097d932281735fac8337f0c59c36cd7bfcc5c892eda4827a8c2f1';
const CALLER_DESCRIPTOR_HASH='480b16c01748694e5794b46e5ccb84bc75cc459c2e31b9f7c0a8911c35e76abd';
export const BINDING_REPAIR_OWNER_HASH='47a88ce3847f43ba9838c32fe5fc182d92e28f5d38dc0a817b3b68cfe46cc73c';
const stop=()=>{throw Error('TRIAL_STOPPED');},hash=v=>createHash('sha256').update(v).digest('hex');
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
function bytes(path,max=128000){
 const p=resolve(path),d=lstatSync(dirname(p)),s=lstatSync(p);
 if(!d.isDirectory()||d.isSymbolicLink()||d.uid!==userInfo().uid||(d.mode&0o7777)!==0o700||!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.uid!==userInfo().uid||(s.mode&0o7777)!==0o600||s.size>max)stop();return readFileSync(p);
}
function pinned(p,expected){if(!exact(p,['path','sha256'])||p.sha256!==expected||typeof p.path!=='string')stop();const b=bytes(p.path);if(hash(b)!==expected)stop();return JSON.parse(b);}
export function pinAuthorityBindingRepair(input,options,binding){
 try{
  input=JSON.parse(JSON.stringify(input));
  if(!exact(input,['manifest','ownerApprovalHash','newCopy','drainReceipt','callerDescriptor','originalOptions'])||input.ownerApprovalHash!==BINDING_REPAIR_OWNER_HASH)stop();
  const m=pinned(input.manifest,BINDING_REPAIR_INCIDENT_HASH),caller=pinned(input.callerDescriptor,CALLER_DESCRIPTOR_HASH),original=pinned(input.originalOptions,m.original_options_sha256);
  const originalKeys=['path','epoch','approvalHash','proposalHash','legacySha256','importedReads','expiresAt','decisionHash','nativeTargets'];
  if(!exact(original,originalKeys)||originalKeys.some(k=>!same(original[k],options[k])))stop();
  if(m.counter!==options.path||m.binding!==binding||m.epoch!==options.epoch||m.original_expiresAt!==options.expiresAt||m.spent!==26||m.RPCs!==0||m.remote_mutations!==0||m.repair_attempts!==0||m.P_caller!=='UNKNOWN')stop();
  if(caller.actor!=='caller'||!/^[a-f0-9]{64}$/.test(caller.callerHash)||caller.reference!==options.nativeTargets['caller-executions']||caller.credential!==false||caller.fresh_tool_verification_still_required!==true||caller.incident_manifest_sha256!==BINDING_REPAIR_INCIDENT_HASH||caller.owner_decision_sha256!==BINDING_REPAIR_OWNER_HASH)stop();
  pinned(input.drainReceipt,m.drain_receipt_sha256);const drain=JSON.parse(bytes(input.drainReceipt.path));
  if(drain.source!=='canonical-preparation-holder'||drain.stopRequested!==true||drain.stopAcknowledged!==true||!['NONE_CAPTURED','SETTLED'].includes(drain.ownedScope?.state)||drain.remoteExecutionSettled!==false||drain.trialAccepted!==false||drain.rollbackComplete!==false)stop();
  const receipt=verifyAuthorityTrialRollback(input.newCopy),root=resolve(fileURLToPath(new URL('../',import.meta.url)));
  if(realpathSync(receipt.path)!==realpathSync(root))stop();
  // The old manifest has the pre-repair inventory. Verify its complete frozen
  // inventory against the incident pins, without imposing the new inventory.
  const old=m.original_copy_receipt,oldBytes=bytes(join(old.path,'manifest.json'));
  if(hash(oldBytes)!==old.sha256)stop();const oldManifest=JSON.parse(oldBytes);
  if(oldManifest.source!=='fixed-authority-trial-rollback-runtime'||!same(oldManifest.files,m.original_controller_pins))stop();
  const checkOriginalSources=()=>{if(hash(bytes(join(old.path,'manifest.json')))!==old.sha256)stop();for(const [name,pin] of Object.entries(oldManifest.files)){
   if(name.startsWith('/')||name.split('/').some(x=>!x||x==='.'||x==='..'))stop();for(let d=dirname(name);d!=='.';d=dirname(d)){const s=lstatSync(join(old.path,d));if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o7777)!==0o700)stop();}const b=bytes(join(old.path,name),1000000);if(b.length!==pin.size||hash(b)!==pin.sha256)stop();
  }};checkOriginalSources();
  const stopPath=m.original_stop_marker_path,stopBytes=bytes(stopPath),stat=lstatSync(stopPath,{bigint:true}),stopIdentity=[stat.dev,stat.ino,stat.mtimeNs,stat.ctimeNs].join(':');
  const manifestStat=lstatSync(input.manifest.path,{bigint:true});if(stat.mtimeNs>manifestStat.mtimeNs||stat.ctimeNs>manifestStat.ctimeNs||hash(stopBytes)!==m.original_stop_marker_sha256)stop();
  const originalStopMatches=()=>{try{const s=lstatSync(stopPath,{bigint:true});return [s.dev,s.ino,s.mtimeNs,s.ctimeNs].join(':')===stopIdentity&&hash(bytes(stopPath))===hash(stopBytes);}catch(_){return false;}};
  return Object.freeze({originalStopMatches,checkSources:()=>{pinned(input.manifest,BINDING_REPAIR_INCIDENT_HASH);pinned(input.callerDescriptor,CALLER_DESCRIPTOR_HASH);pinned(input.originalOptions,m.original_options_sha256);pinned(input.drainReceipt,m.drain_receipt_sha256);checkOriginalSources();return verifyAuthorityTrialRollback(input.newCopy);},originalOptions:Object.freeze({...input.originalOptions}),manifest:Object.freeze({...input.manifest}),ownerApprovalHash:input.ownerApprovalHash,newCopy:Object.freeze({...input.newCopy}),drainReceipt:Object.freeze({...input.drainReceipt}),callerDescriptor:Object.freeze({...input.callerDescriptor}),expected:Object.freeze({actor:'caller',actorHash:caller.callerHash,reference:caller.reference,method:'getTab'})});
 }catch(_){stop();}
}
