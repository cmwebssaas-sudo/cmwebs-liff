import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {readFileSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {fixture,clock,hash,compact,wrapped} from './standalone-budget.mjs';
import {normalizeAuthorityNativeTargets} from '../../../scripts/read-authority-trial-budget-plan.mjs';
import {createAuthorityStandaloneControl} from '../../../scripts/read-authority-continuation-control.mjs';
import {buildAuthorityTrialRollback} from '../../../scripts/read-authority-trial-rollback.mjs';
import {buildStandaloneAuthorityTrialArtifacts} from '../../../scripts/build-read-authority-trial-entry.mjs';
import * as recovery from '../../../scripts/read-authority-continuation-recovery.mjs';
export {clock,hash,compact,wrapped};
export async function setup(fn){
 const s=fixture(),beforeHome=process.env.HOME,spawn=cp.spawn;process.env.HOME=s.home;let oldBudget;
 cp.spawn=(cmd,args,opts)=>spawn(cmd,args,oldBudget&&cmd==='python3'&&args?.includes('--inherited-lock')&&realpathSync(args[0])===oldBudget?{...opts,env:{...opts.env,HOME:s.home}}:opts);syncBuiltinESMExports();
 try{
  const nativeTargets=normalizeAuthorityNativeTargets(Object.fromEntries(Object.entries(s.cfg.original.nativeTargets).map(([k])=>[k,k.startsWith('original-')?'https://script.google.com/home/projects/SYNTHETIC_ORIGINAL_SCRIPT_ID/'+k.slice(9):k==='thin-settings'?'https://script.google.com/home/projects/SYNTHETIC_THIN_SCRIPT_ID/settings':k==='oauth-audience'?'https://console.cloud.google.com/auth/audience?project=synthetic-c3-trial':k==='oauth-client'?'https://console.cloud.google.com/auth/clients/create?project=synthetic-c3-trial':'https://script.google.com/home/executions'])));
  const {binding:unused,now:oldNow,...rest}=s.cfg.original,originalOptions={...rest,nativeTargets},binding=hash(JSON.stringify(originalOptions));
  s.cfg.original={...originalOptions,binding,now:clock};const b=s.get();b.preparation.binding=binding;s.put(s.path,compact(b));s.put(s.registry,wrapped({path:s.path,binding,checkpoint:b}));
  for(const n of ['preparation-claim','preparation-stop','preparation-owner-stop'])s.put(s.path+'.'+n+'.json',wrapped({path:s.path,epoch:s.cfg.epoch,binding}));
  s.put(s.cfg.baseline.path,readFileSync(s.path));s.cfg.baseline.sha256=hash(readFileSync(s.path));
  const prior=JSON.parse(readFileSync(s.cfg.history.continuation.path));prior.originalBinding=binding;prior.baselineSha256=s.cfg.baseline.sha256;s.put(s.cfg.history.continuation.path,compact(prior));
  const {version,day,deadlineUtc,deadlineTaipei,state,spent,events,plan,chargedUpperBoundMs,rpc,finished,...identity}=prior;
  s.put(s.path+'.continuation-claim.json',wrapped(identity));s.put(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.continuation.json'),wrapped({identity,checkpoint:prior}));
  const originalSha256=hash(readFileSync(s.path)),linkedSha256=hash(readFileSync(s.cfg.history.continuation.path));
  for(const key of ['diagnosisApproval','ownerApproval']){const p=s.cfg.history[key].path,v=JSON.parse(readFileSync(p));v.originalSha256=originalSha256;if(key==='diagnosisApproval')v.linkedSha256=linkedSha256;else v.continuationSha256=linkedSha256;s.put(p,compact(v));}
  for(const [k,v] of Object.entries(s.cfg.history))if(Array.isArray(v))v.forEach(p=>{p.sha256=hash(readFileSync(p.path));});else v.sha256=hash(readFileSync(v.path));
  let time=clock;const pauses=[],{now,ownerNonce,...config}=s.cfg,owner=createAuthorityStandaloneControl({config,now:()=>time,pause:async ms=>{time+=ms;},guard:()=>{}});
  const oldCopy=buildAuthorityTrialRollback({path:join(s.home,'original-copy')}),oldBytes=readFileSync(join(oldCopy.path,'manifest.json'));oldBudget=realpathSync(join(oldCopy.path,'scripts/read-authority-preparation-budget.py'));
  const overlay=buildAuthorityTrialRollback({path:join(s.home,'standalone-overlay')}),bundle=buildStandaloneAuthorityTrialArtifacts();
  const originalFiles=[{name:'appsscript',type:'JSON',source:'{}'}],sourceHash=hash(compact(originalFiles)),resources={epoch:s.cfg.epoch,expiresAt:clock+21600000,thinScriptId:'SYNTHETIC_THIN_SCRIPT_ID',publisherHash:hash('publisher@example.invalid'),syntheticSheetId:'SYNTHETIC_READER_SHEET_ID',originalSheetId:'SYNTHETIC_ORIGINAL_SHEET_ID',callerHash:hash('caller@example.invalid'),fixtureHash:'a'.repeat(64),thinOriginalSourceHash:sourceHash,thinPath:join(s.home,'thin.json'),readerPath:join(s.home,'reader.json')};
  const receipt=recovery.buildAuthorityContinuationRecovery({path:join(s.home,'recovery'),originalCopy:{path:oldCopy.path,sha256:oldCopy.sha256},standalone:{copy:{path:overlay.path,sha256:overlay.sha256},resources}}),api=await recovery.loadAuthorityContinuationRecovery({path:receipt.path,sha256:receipt.sha256});
  const creation={source:'fixed-trial-import-readback',epoch:resources.epoch,syntheticSheetId:resources.syntheticSheetId,publisherHash:resources.publisherHash,fixtureHash:resources.fixtureHash},backup={source:'fixed-trial-thin-empty-backup',epoch:resources.epoch,scriptId:resources.thinScriptId,publisherHash:resources.publisherHash,sourceHash};
  const wrapper=[{name:'AuthorityTrial',type:'SERVER_JS',source:bundle.source},{name:'appsscript',type:'JSON',source:JSON.stringify(bundle.manifest)}],wrapperHash=hash(compact(wrapper.sort((a,b)=>a.name.localeCompare(b.name))));
  const thinBinding=hash(compact({epoch:resources.epoch,scriptId:resources.thinScriptId,entryKind:'standalone',publisherHash:resources.publisherHash,originalSourceHash:sourceHash,expiresAt:resources.expiresAt,backup,wrapperHash})),readerBinding=hash(JSON.stringify({epoch:resources.epoch,originalSheetId:resources.originalSheetId,syntheticSheetId:resources.syntheticSheetId,callerHash:resources.callerHash,publisherHash:resources.publisherHash,fixtureHash:resources.fixtureHash,expiresAt:resources.expiresAt,creation}));
  const thinRegistry=join(s.root,hash(JSON.stringify(resources.epoch))+'.thin.json'),readerRegistry=join(s.root,hash(JSON.stringify(resources.epoch))+'.reader.json');
  const thinRegistration={path:resources.thinPath,binding:thinBinding},thinRecord=v=>JSON.stringify({value:v,sha256:hash(compact(v))});
  s.put(thinRegistry,thinRecord(thinRegistration));s.put(resources.thinPath,thinRecord({version:1,binding:thinBinding,state:'stopped',started:true,stageAttempted:true,stageOutcome:'ACK_MATCHED',versionAttempted:true,versionOutcome:'ACK_MATCHED',createAttempted:true,createOutcome:'UNKNOWN',deploymentId:'SYNTHETIC_DEPLOYMENT_ID',closeAttempted:false,closeOutcome:'NOT_STARTED',verifyAttempted:false,verifyOutcome:'NOT_STARTED'}));s.put(thinRegistry+'.publish-intent',thinRecord(thinRegistration));
  const plain=(p,value)=>s.put(p,JSON.stringify({value,sha256:hash(JSON.stringify(value))}));plain(readerRegistry,{path:resources.readerPath,binding:readerBinding});plain(resources.readerPath,{version:1,binding:readerBinding,state:'failed',permissionId:'SYNTHETIC_CALLER_ID',ownerId:'SYNTHETIC_OWNER_ID',grantStarted:true,grantAttempted:true,grantOutcome:'UNKNOWN',removeAttempted:false,removeOutcome:'NOT_STARTED',verifyAttempted:false,verifyOutcome:'NOT_STARTED',stopRequested:true});
  const calls=[],scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(v=>'https://www.googleapis.com/auth/'+v),credential=()=>({accessToken:'SYNTHETIC_RECOVERY_TOKEN',accountHash:resources.publisherHash,scopes,expiresAt:time+3600000,refreshTokenPresent:true}),fetcher=async(url,init)=>{calls.push({url,method:init.method,time});if(init.method==='DELETE')return new Response(null,{status:204});return new Response(JSON.stringify(url.includes('script.googleapis.com')?{deployments:[]}:{permissions:[{id:'SYNTHETIC_OWNER_ID',type:'user',role:'owner',emailAddress:'publisher@example.invalid'}]}));};
  const common={epoch:resources.epoch,expiresAt:resources.expiresAt,publisherHash:resources.publisherHash,credential,fetcher,now:()=>time};
  const thinOptions={...common,path:resources.thinPath,scriptId:resources.thinScriptId,originalFiles,originalSourceHash:sourceHash,backupReceipt:backup},readerOptions={...common,path:resources.readerPath,originalSheetId:resources.originalSheetId,syntheticSheetId:resources.syntheticSheetId,callerEmail:'caller@example.invalid',callerHash:resources.callerHash,fixtureHash:resources.fixtureHash,creationReceipt:creation,metadata:{read:()=>{throw Error('ORDINARY_READ_FORBIDDEN');}}};
  const pause=async ms=>{pauses.push(ms);time+=ms;},cleanup=()=>api.createCleanup({owner,originalOptions,now:()=>time,pause});
  await fn({...s,owner,oldCopy,oldBytes,overlay,receipt,api,resources,originalOptions,thinOptions,readerOptions,thinRegistry,readerRegistry,calls,pauses,pause,cleanup,now:()=>time});
 }finally{if(beforeHome===undefined)delete process.env.HOME;else process.env.HOME=beforeHome;cp.spawn=spawn;syncBuiltinESMExports();}
}
