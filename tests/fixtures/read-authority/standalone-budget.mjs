import {readFileSync,mkdirSync,openSync,closeSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fixture as originalFixture,hash,compact,wrapped,clock} from './continuation-budget.mjs';
export {hash,compact,wrapped,clock};
export const decision='02c75938cc8ecff17c907431db861613bb7f4e2af967f185c6b9933758f7dfd8';
export const ownerAnswer='同意改用單一獨立合成腳本，取代舊試驗入口與停止規則；維持累積160上限及安全、效能、回退驗收，通過後依既有批次授權持續完成上線。';
export function fixture(){
 const s=originalFixture(),old=s.cfg,stem=s.path+'.readonly-diagnosis-20261016';mkdirSync(stem,{mode:0o700});
 const identity={path:s.path,epoch:old.epoch,binding:'f'.repeat(64),originalBinding:old.original.binding,baselineSha256:old.baseline.sha256,ownerHash:'1'.repeat(64),decisionHash:old.decisionHash,legacyBudgetSha256:old.legacyBudget.sha256,policySourceSha256:'06112c8340a04b763d70580883e4bc2b4ddb5fb6d18a22eb577e78ef10fd119f',w0:clock-10000,expiresAt:clock+21600000-10000};
 const continuation={...identity,version:1,day:'2026-10-16',deadlineUtc:new Date(identity.expiresAt).toISOString().replace('Z','+00:00'),deadlineTaipei:'2026-10-16T13:59:50.000+08:00',state:'stopped',spent:1,events:[{operation:{id:'preflight-caller-bind',bucket:'P',alias:'caller-bind',actor:'caller',target:'caller-executions',operation:'bind',units:1},time:clock-9000,outcome:'UNKNOWN'}],plan:null,chargedUpperBoundMs:0,rpc:{beganAt:null,complete:false},finished:true};
 s.put(s.path+'.continuation.json',compact(continuation));s.put(s.path+'.continuation-claim.json',wrapped(identity));
 s.put(join(s.root,hash(JSON.stringify(old.epoch))+'.continuation.json'),wrapped({identity,checkpoint:continuation}));
 s.put(s.path+'.continuation-stop.json',wrapped({path:s.path,epoch:old.epoch,binding:identity.binding}));
 const originalSha256=hash(readFileSync(s.path)),linkedSha256=hash(readFileSync(s.path+'.continuation.json')),proposalSha256='4'.repeat(64),startedAt=clock-8000,expiresAt=clock+60000;
 const approval={ownerAnswer:'同意',source:'human reply immediately after the four-read-only diagnosis proposal',proposalSha256,originalSha256,linkedSha256,baselineSpent:28,limit:160,maxDiagnosticActions:4,startedAt,expiresAt,originalClaimsReopened:false,rpcAuthorized:false,newRemoteWritesAuthorized:false,actions:['chrome-browser-metadata','matching-executions-tab-metadata','single-exact-tab-binding','same-tab-accessibility-if-necessary']};
 const result={source:'owner-approved-read-only-diagnosis',state:'STOPPED_TARGET_NOT_LOCATED',approvalAnswer:'同意',proposalSha256,actualReadActions:3,unusedReadActions:1,baselineSpent:28,cumulativeSpent:31,limit:160,windowExpiresAt:expiresAt,oldOriginalAndContinuationBytesUnchanged:true,rpcExecuted:false,remoteResourceWrites:0,credentialsReadOrRefreshed:false,secondDiagnosticSegmentAuthorized:false,time:clock-5000};
 s.put(join(stem,'approval.json'),compact(approval));s.put(join(stem,'result.json'),compact(result));s.put(join(stem,'stop.json'),compact({state:result.state,time:result.time,noFurtherDiagnosticReads:true}));
 ['chrome-browser-metadata','matching-executions-tab-metadata','matching-executions-user-tab-metadata'].forEach((purpose,i)=>s.put(join(stem,`charge-${i+1}.json`),compact({action:i+1,purpose,units:1,baselineSpent:28,cumulativeSpent:29+i,outcome:'UNKNOWN',time:startedAt+i*1000})));
 const owner=join(s.home,'owner-approval.json');s.put(owner,compact({ownerAnswer,limit:160,importedSpent:31,remaining:129,cleanupReserve:17,rpcLimit:1,noNewScopeOrFees:true,ownerOnlyCredentialsAndNewGrants:true,originalClaimsReopened:false,newClaimStarted:false,remoteExecutionAuthorizedNow:false,originalSha256,continuationSha256:linkedSha256}));
 const pin=path=>({path,sha256:hash(readFileSync(path))});
 s.cfg={...old,decisionHash:decision,history:{continuation:pin(s.path+'.continuation.json'),diagnosisApproval:pin(join(stem,'approval.json')),diagnosisResult:pin(join(stem,'result.json')),diagnosisStop:pin(join(stem,'stop.json')),diagnosisCharges:[1,2,3].map(n=>pin(join(stem,`charge-${n}.json`))),ownerApproval:pin(owner)}};
 s.journal=()=>JSON.parse(readFileSync(s.path+'.standalone.json'));
 s.repin=key=>{const pin=s.cfg.history[key];pin.sha256=hash(readFileSync(pin.path));};
 return s;
}
export function session(s,cfg=s.cfg,bootstrap=null,cleanup=false){
 const fd=openSync(s.path+'.lock','r+'),child=spawn('python3',[...(bootstrap?['-c',bootstrap]:[]),resolve('scripts/read-authority-continuation-budget.py'),cleanup?'--standalone-cleanup-inherited-lock':'--standalone-inherited-lock'],{stdio:['pipe','pipe','pipe',fd],env:{PATH:process.env.PATH,HOME:s.home,TZ:'Asia/Taipei',LANG:'C'}});
 let buffer='',ended=false;const queued=[],pending=[];
 const push=v=>pending.length?pending.shift()(v):queued.push(v);
 child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;while(buffer.includes('\n')){const i=buffer.indexOf('\n');push(JSON.parse(buffer.slice(0,i)));buffer=buffer.slice(i+1);}});
 child.stderr.resume();child.on('close',()=>{ended=true;while(pending.length)pending.shift()({ok:false,code:'CHILD_CLOSED'});});
 const read=()=>queued.length?Promise.resolve(queued.shift()):ended?Promise.resolve({ok:false,code:'CHILD_CLOSED'}):new Promise(r=>pending.push(r));
 child.stdin.on('error',()=>{});child.stdin.write(JSON.stringify(cfg)+'\n');
 return {child,ready:read(),send:q=>{child.stdin.write(JSON.stringify(q)+'\n');return read();},close:async()=>{if(!ended){child.stdin.end();await new Promise(r=>child.once('close',r));}closeSync(fd);},fd};
}
export function cleanupSession(s,patch={}){return session(s,{...s.cfg,minimumNewSpent:0,...patch},null,true);}
export {fixture as standaloneFixture};
// Closed preflight fixture uses the real persistent ledger, then pins its
// finished checkpoint. It never deletes or rewrites a predecessor artifact.
export async function closedPreflightFixture(){
 const s=fixture(),h=session(s);assertReady(await h.ready);
 for(const alias of ['caller-bind','publisher-bind'])assertReady(await h.send({op:'debit',operation:{id:'preflight-'+alias,bucket:'P',alias,actor:alias==='caller-bind'?'caller':'publisher',target:alias==='caller-bind'?'caller-executions':'publisher-executions',operation:'bind',units:1},now:clock}));
 assertReady(await h.send({op:'stop',now:clock}));assertReady(await h.send({op:'finish',now:clock}));await h.close();
 return successorFixture(s);
}
function assertReady(v){if(v.ok!==true)throw Error(JSON.stringify(v));}
export function successorFixture(s){
 const pin=path=>({path,sha256:hash(readFileSync(path))}),proof=join(s.home,'caller-proof.json');
 s.put(proof,compact({source:'observed-native-initial-AX',expectedActorMatches:true,surface:'apps-script-executions',observedUrl:'https://script.google.com/home/executions',profileLabel:'ART',actorConfirmed:true}));
 const predecessor=s.journal();
 s.cfg={...s.cfg,binding:'9'.repeat(64),now:clock+1,closedPreflight:{journal:pin(s.path+'.standalone.json'),claim:pin(s.path+'.standalone-claim.json'),stop:pin(s.path+'.standalone-stop.json'),registry:pin(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.standalone.json')),callerProof:pin(proof)}};
 s.predecessor=predecessor;s.successorJournal=()=>JSON.parse(readFileSync(s.path+'.standalone-successor.json'));
 return s;
}

export async function stagedFixture(){
 const s=await closedPreflightFixture(),h=session(s);assertReady(await h.ready);let time=clock+1;
 const ops=[{id:'publisher-executions-discovery',bucket:'N',alias:'navigation-1',actor:'publisher',target:'publisher-executions',operation:'snapshot',units:1,stage:'research'},{id:'publisher-executions-open',bucket:'N',alias:'navigation-2',actor:'publisher',target:'publisher-executions',operation:'navigate',units:1,stage:'research'},{id:'current-publisher-bind',bucket:'P',alias:'publisher-bind',actor:'publisher',target:'publisher-executions',operation:'bind',units:1},...Array.from({length:6},(_,i)=>({id:'current-research-'+(i+3),bucket:'N',alias:'navigation-'+(i+3),actor:'publisher',target:'original-settings',operation:'snapshot',units:1,stage:'research'}))];
 for(const operation of ops){let r=await h.send({op:'wait',operation,now:time});assertReady(r);time+=r.waitMs;assertReady(await h.send({op:'debit',operation,now:time}));}
 assertReady(await h.send({op:'stop',now:time}));assertReady(await h.send({op:'finish',now:time}));await h.close();
 const pin=path=>({path,sha256:hash(readFileSync(path))}),journal=s.path+'.standalone-successor.json',approval=join(s.home,'staged-approval.json');
 s.put(approval,compact({decisionHash:'19c51070c90552bfe5af0c998a45cc5a2104efe17d6428dae046cdc492d3b16d',ownerAnswer:'同意此單次接續方案，維持160',importedSpent:42,limit:160,predecessorSha256:pin(journal).sha256}));
 s.cfg={...s.cfg,binding:'8'.repeat(64),decisionHash:'19c51070c90552bfe5af0c998a45cc5a2104efe17d6428dae046cdc492d3b16d',expiresAt:null,now:clock+21600001,stagedResume:{approval:pin(approval),journal:pin(journal),claim:pin(s.path+'.standalone-successor-claim.json'),stop:pin(s.path+'.standalone-successor-stop.json'),registry:pin(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.standalone-successor.json'))}};
 s.stagedJournal=()=>JSON.parse(readFileSync(s.path+'.staged-resume.json'));return s;
}
