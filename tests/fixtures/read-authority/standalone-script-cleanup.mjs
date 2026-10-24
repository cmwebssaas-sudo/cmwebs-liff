import {join} from 'node:path';
import {setup as baseSetup,hash} from './standalone-recovery.mjs';
import {buildAuthorityContinuationRecovery,loadAuthorityContinuationRecovery} from '../../../scripts/read-authority-continuation-recovery.mjs';
export {clock} from './standalone-recovery.mjs';
export async function setup(fn){
 return baseSetup(async s=>{
  const resources={...s.resources,originalScriptId:'SYNTHETIC_ORIGINAL_SCRIPT_ID',scriptReaderPath:join(s.home,'script-reader.json')};
  const receipt=buildAuthorityContinuationRecovery({path:join(s.home,'script-recovery'),originalCopy:{path:s.oldCopy.path,sha256:s.oldCopy.sha256},standalone:{copy:{path:s.overlay.path,sha256:s.overlay.sha256},resources}});
  const api=await loadAuthorityContinuationRecovery({path:receipt.path,sha256:receipt.sha256});
  const options={path:resources.scriptReaderPath,epoch:resources.epoch,scriptId:resources.thinScriptId,originalScriptId:resources.originalScriptId,callerEmail:'caller@example.invalid',callerHash:resources.callerHash,publisherHash:resources.publisherHash,callerPermissionId:'SYNTHETIC_CALLER_ID',expiresAt:resources.expiresAt,backupReceipt:s.thinOptions.backupReceipt,credential:s.readerOptions.credential,fetcher:s.readerOptions.fetcher,now:s.now};
  const binding=hash(JSON.stringify({mode:'standalone-script',epoch:options.epoch,scriptId:options.scriptId,originalScriptId:options.originalScriptId,callerHash:options.callerHash,publisherHash:options.publisherHash,callerPermissionId:options.callerPermissionId,expiresAt:options.expiresAt,backupReceipt:options.backupReceipt}));
  const registry=join(s.root,hash(JSON.stringify(resources.epoch))+'.script-reader.json');
  const save=(path,value)=>s.put(path,JSON.stringify({value,sha256:hash(JSON.stringify(value))}));
  save(registry,{path:options.path,binding,mode:'standalone-script',scriptId:options.scriptId,originalScriptId:options.originalScriptId});
  save(options.path,{version:1,mode:'standalone-script',scriptId:options.scriptId,originalScriptId:options.originalScriptId,binding,state:'failed',permissionId:options.callerPermissionId,ownerId:'SYNTHETIC_OWNER_ID',grantStarted:true,grantAttempted:true,grantOutcome:'UNKNOWN',removeAttempted:false,removeOutcome:'NOT_STARTED',verifyAttempted:false,verifyOutcome:'NOT_STARTED',stopRequested:true});
  const cleanup=()=>api.createCleanup({owner:s.owner,originalOptions:s.originalOptions,now:s.now,pause:s.pause});
  await fn({...s,resources,receipt,api,options,scriptRegistry:registry,cleanup});
 });
}
