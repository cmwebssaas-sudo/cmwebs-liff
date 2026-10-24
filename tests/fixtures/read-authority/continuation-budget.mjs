import {mkdtempSync,chmodSync,mkdirSync,writeFileSync,readFileSync,openSync,closeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash,randomUUID,randomBytes} from 'node:crypto';
export const hash=v=>createHash('sha256').update(v).digest('hex');
export const compact=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(compact(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(compact(v[k]))])):v);
export const wrapped=v=>compact({value:v,sha256:hash(compact(v))});
export const clock=Date.parse('2026-10-16T00:00:00Z');
export function fixture(){
 const home=mkdtempSync(join(tmpdir(),'cmwebs-continuation-'));chmodSync(home,0o700);
 const root=join(home,'.codex/private/cmwebs-authority-trials');mkdirSync(root,{recursive:true,mode:0o700});
 const path=join(home,'budget.json'),epoch='SYNTHETIC_CONTINUATION_'+randomUUID(),binding='c'.repeat(64),expired=clock-1000;
 const original={path,epoch,binding,approvalHash:'a'.repeat(64),proposalHash:'b'.repeat(64),legacySha256:'d'.repeat(64),importedReads:25,expiresAt:expired,now:clock,decisionHash:'3701527108376e07470bc920336fbbd0f78015cb1e55dbfe35090ee059130cb9',nativeTargets:Object.fromEntries(['original-settings','original-triggers','thin-settings','oauth-audience','oauth-client','caller-executions','publisher-executions'].map(v=>[v,'SYNTHETIC_'+v]))};
 const first=clock-100000,last=clock-90000;
 const p={version:1,binding,legacySha256:original.legacySha256,importedReads:25,expiresAt:expired,day:'2026-10-16',state:'stopped',calls:[...Array(25).fill(clock-200000),first,last],events:[{kind:'ordinary',action:'P:caller-bind',units:1,time:first,outcome:'UNKNOWN'},{kind:'ordinary',action:'N:research:caller:caller-executions:getTab:1',units:1,time:last,outcome:'UNKNOWN'}],cActions:[],iActions:[],decisionHash:original.decisionHash,nativePlan:null,bindingRepair:{incidentHash:'2f231f4b4de097d932281735fac8337f0c59c36cd7bfcc5c892eda4827a8c2f1',ownerApprovalHash:'47a88ce3847f43ba9838c32fe5fc182d92e28f5d38dc0a817b3b68cfe46cc73c',nonce:'1'.repeat(64),newCopy:{path:home,sha256:'2'.repeat(64)},originalStop:{},status:'in-flight',beganAt:first,debitAt:last,settledAt:null,completedAt:null,evidenceHash:null}};
 const base={limit:160,spent:27,kind:'preparation-management-reads',proposal_sha256:original.proposalHash,approval_sha256:original.approvalHash,prior_limit:40,preparation:p};
 const put=(name,value)=>writeFileSync(name,value,{mode:0o600});put(path,compact(base));put(path+'.lock','');
 const registry=join(root,hash(JSON.stringify(epoch))+'.preparation.json');put(registry,wrapped({path,binding,checkpoint:base}));
 put(path+'.preparation-claim.json',wrapped({path,epoch,binding}));put(path+'.preparation-stop.json',wrapped({path,epoch,binding}));put(path+'.preparation-owner-stop.json',wrapped({path,epoch,binding}));
 const baseline=join(home,'baseline.json');put(baseline,readFileSync(path));
 const pin=name=>({path:resolve('scripts/'+name),sha256:hash(readFileSync(resolve('scripts/'+name)))});
 const cfg={path,epoch,binding:'e'.repeat(64),decisionHash:'f227ebbf2ca791d521e0008a639c2fa4ecb31e5be793478c45ffee47b420c92d',expiresAt:clock+21600000,now:clock,ownerNonce:randomBytes(32).toString('hex'),original,baseline:{path:baseline,sha256:hash(readFileSync(baseline))},legacyBudget:pin('read-authority-preparation-budget.py'),policySource:pin('read-authority-continuation-plan.mjs')};
 return {home,root,path,registry,cfg,put,get:()=>JSON.parse(readFileSync(path)),journal:()=>JSON.parse(readFileSync(path+'.continuation.json'))};
}
export function session(s,cfg=s.cfg,bootstrap=null){
 const fd=openSync(s.path+'.lock','r+'),child=spawn('python3',[...(bootstrap?['-c',bootstrap]:[]),resolve('scripts/read-authority-continuation-budget.py'),'--inherited-lock'],{stdio:['pipe','pipe','pipe',fd],env:{PATH:process.env.PATH,HOME:s.home,TZ:'Asia/Taipei',LANG:'C'}});
 let buffer='',ended=false;const queued=[],pending=[];
 const push=v=>pending.length?pending.shift()(v):queued.push(v);
 child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;while(buffer.includes('\n')){const i=buffer.indexOf('\n'),line=buffer.slice(0,i);buffer=buffer.slice(i+1);push(JSON.parse(line));}});
 child.stderr.resume();child.on('close',()=>{ended=true;while(pending.length)pending.shift()({ok:false,code:'CHILD_CLOSED'});});
 const read=()=>queued.length?Promise.resolve(queued.shift()):ended?Promise.resolve({ok:false,code:'CHILD_CLOSED'}):new Promise(r=>pending.push(r));
 child.stdin.on('error',()=>{});child.stdin.write(JSON.stringify(cfg)+'\n');
 return {child,ready:read(),send:q=>{child.stdin.write(JSON.stringify(q)+'\n');return read();},close:async()=>{if(!ended){child.stdin.end();await new Promise(r=>child.once('close',r));}closeSync(fd);},fd};
}
export const operation=(action)=>{
 const [bucket,...rest]=action.split(':'),alias=rest.join(':');
 return {id:action.replaceAll(':','.'),bucket,alias,actor:alias==='caller-bind'?'caller':'publisher',target:alias==='caller-bind'?'caller-executions':'publisher-executions',operation:'bind',units:1};
};
export const research=n=>({id:'research-'+n,bucket:'N',alias:'navigation-'+n,actor:'publisher',target:'original-settings',operation:'snapshot',units:1,stage:'research'});
