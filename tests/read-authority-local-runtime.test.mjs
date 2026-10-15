import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Match the observed CUA module realm: standard JS and approved Node builtins,
// but no ambient process or node:process import. No browser handles or account IO.
const program=String.raw`
import vm from 'node:vm';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const dir=process.argv[2],root=process.argv[3],mode=process.argv[4];
const context=vm.createContext({URL,TextEncoder,Buffer,setTimeout,clearTimeout});
const allowed=new Set(['node:child_process','node:path','node:url','node:crypto','node:timers/promises','node:fs','node:os']);
const cache=new Map();
async function load(identifier){
 if(cache.has(identifier))return cache.get(identifier);
 if(identifier.startsWith('node:')){
  if(!allowed.has(identifier))throw Error('UNAPPROVED_BUILTIN');
  const api=await import(identifier),keys=Object.keys(api);
  const m=new vm.SyntheticModule(keys,function(){for(const k of keys)this.setExport(k,api[k]);},{context,identifier});
  cache.set(identifier,m);return m;
 }
 const m=new vm.SourceTextModule(readFileSync(fileURLToPath(identifier),'utf8'),{context,identifier,initializeImportMeta(meta){meta.url=identifier;}});
 cache.set(identifier,m);
 await m.link((specifier,parent)=>load(specifier.startsWith('node:')?specifier:new URL(specifier,parent.identifier).href));
 return m;
}
async function module(name){const m=await load(pathToFileURL(resolve(root,'scripts',name)).href);await m.evaluate();return m.namespace;}
let now=Date.parse('2026-10-14T00:00:00Z'),calls=0;const hash=v=>createHash('sha256').update(v).digest('hex');
const epoch='SYNTHETIC_LOCAL_REALM_'+randomUUID(),path=joinPath('budget.json');
function joinPath(name){return resolve(dir,name);}
const raw=JSON.stringify({limit:160,spent:25,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40});
writeFileSync(path,raw,{mode:0o600,flag:'wx'});
let ok=false,error=null,rawMode=null;
try{
 if(mode==='preparation'){
  const api=await module('read-authority-preparation-control.mjs');
  const options={path,epoch,approvalHash:'a'.repeat(64),proposalHash:'b'.repeat(64),legacySha256:hash(raw),importedReads:25,expiresAt:now+21600000,now:()=>now,pause:async ms=>{now+=ms;}};
  const control=api.createAuthorityPreparationControl(options),peer=api.createAuthorityPreparationControl(options);
  await control.withPreparation(async cap=>{await cap.externalRead(async()=>{
   calls++;if(JSON.parse(readFileSync(path)).spent!==26)throw Error('NOT_DEBITED');
   let rejected=false;try{await peer.withPreparation(async()=>{});}catch{rejected=true;}
   if(!rejected)throw Error('FLOCK_NOT_HELD');
  });});
 }else if(mode==='native'){
  const api=await module('read-authority-native-capture.mjs');
  const snapshot='URL: "https://script.google.com/home/executions"\n1 button Description: Google 帳戶：caller (caller@example.invalid)\n2 row 專案 函式 類型 開始時間 持續時間 狀態\n3 switch Value: 0, Description: 即時顯示執行作業。\n4 text 第 1 頁\n5 (selected) 200\n6 button (disabled) 前往下一頁';
  const native=api.createAuthorityNativeCapture({path:joinPath('native.json'),epoch,callerHash:hash('caller@example.invalid'),publisherHash:hash('publisher@example.invalid'),maxReads:1,expiresAt:now+21600000,control:{externalRead:async io=>io()},nativeRead:async r=>{calls++;return Object.freeze({requestId:r.requestId,source:'cua.getAXState',capturedAt:now,snapshot});},now:()=>now});
  const result=await native.capture({actor:'caller',phase:'wrapper-before',page:1});
  if(result.analysis.complete||result.analysis.quotaAccepted||result.analysis.trialAccepted)throw Error('FALSE_ACCEPTANCE');
  rawMode=statSync(joinPath('native.json.page-001.ax.txt')).mode&0o777;
 }else throw Error('BAD_TEST_MODE');
 ok=true;
}catch(e){error=e.message;}
console.log(JSON.stringify({ok,error,calls,spent:JSON.parse(readFileSync(path)).spent,rawMode,ambientProcess:vm.runInContext('typeof process',context),browserReads:0}));
`;
function run(mode){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-local-realm-'));chmodSync(dir,0o700);
 const root=fileURLToPath(new URL('..',import.meta.url));
 return JSON.parse(execFileSync(process.execPath,['--experimental-vm-modules','--input-type=module','-',dir,root,mode],{input:program,env:{PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'C',TZ:'Asia/Taipei'},encoding:'utf8',timeout:15000,stdio:['pipe','pipe','pipe']}));
}
test('preparation works without ambient process, debits before IO and holds the actual synthetic flock',()=>{
 const result=run('preparation');assert.equal(result.ambientProcess,'undefined');assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.calls,1);assert.equal(result.spent,26);assert.equal(result.browserReads,0);
});
test('native capture enforces ownership and private raw mode without ambient process',()=>{
 const result=run('native');assert.equal(result.ambientProcess,'undefined');assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.calls,1);assert.equal(result.rawMode,0o600);assert.equal(result.browserReads,0);
});
