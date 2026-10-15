import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const program=String.raw`
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {userInfo} from 'node:os';
const [dir,root,mode,kind]=process.argv.slice(2),context=vm.createContext({URL,URLSearchParams,Buffer,TextEncoder,TextDecoder,AbortSignal,structuredClone,setTimeout,clearTimeout,...(kind==='bytes'?{process:{getuid:()=>userInfo().uid}}:{})});
const allowed=new Set(['node:child_process','node:path','node:url','node:crypto','node:timers/promises','node:fs','node:os','node:util','node:http','node:module','node:async_hooks']),cache=new Map();
async function load(identifier){
 if(cache.has(identifier))return cache.get(identifier);
 if(identifier.startsWith('node:')){
  if(!allowed.has(identifier))throw Error('UNAPPROVED_BUILTIN');const api=await import(identifier),keys=Object.keys(api);
  const m=new vm.SyntheticModule(keys,function(){for(const k of keys)this.setExport(k,api[k]);},{context,identifier});cache.set(identifier,m);return m;
 }
 const m=new vm.SourceTextModule(readFileSync(fileURLToPath(identifier),'utf8'),{context,identifier,initializeImportMeta(meta){meta.url=identifier;},importModuleDynamically:async(s,p)=>{const child=await load(s.startsWith('node:')?s:new URL(s,p.identifier).href);if(child.status==='linked')await child.evaluate();return child;}});cache.set(identifier,m);await m.link((s,p)=>load(s.startsWith('node:')?s:new URL(s,p.identifier).href));return m;
}
async function module(path){const m=await load(pathToFileURL(resolve(root,path)).href);await m.evaluate();return m.namespace;}
const api={};
for(const name of ['preparation-control','trial-import','trial-reader','trial-publication','trial-thin','trial-metadata','trial-oauth',...(mode==='lifecycle'?['phase-control','trial-driver','trial-orchestrator']:[])])Object.assign(api,await module('scripts/read-authority-'+name+'.mjs'));
const helper=await import(pathToFileURL(resolve(root,'tests/fixtures/read-authority/preparation-realm.mjs')).href);
const options={dir,mode:mode==='lifecycle'?'all':mode,lifecycle:mode==='lifecycle',strict:kind==='strict',rpcFailure:kind==='transport-failure'?'transport':false,constructOnly:kind==='ownership',badBytes:kind==='bad-bytes',...(kind==='ownership'?{fixtureBytes:vm.runInContext('new Uint8Array('+JSON.stringify([...helper.preparationFixtureBytes])+')',context)}:kind==='bad-fixture'?{fixtureBytes:vm.runInContext('new Uint16Array('+JSON.stringify([...helper.preparationFixtureBytes])+')',context)}:{})};
const result=await helper.exercisePreparationRealm(api,options);console.log(JSON.stringify({...result,ambientProcess:vm.runInContext('typeof process',context)}));
`;
function run(mode,kind){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-preparation-realm-'));chmodSync(dir,0o700);const root=fileURLToPath(new URL('..',import.meta.url));
 return JSON.parse(execFileSync(process.execPath,['--experimental-vm-modules','--input-type=module','-',dir,root,mode,kind],{input:program,env:{PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'C',TZ:'Asia/Taipei'},encoding:'utf8',timeout:20000,stdio:['pipe','pipe','pipe']}));
}
for(const mode of ['import','reader','publication','thin','oauth'])test(mode+' private journal can initialize with no ambient process and keeps ownership/mode checks',()=>{
 const r=run(mode,'ownership');assert.equal(r.ambientProcess,'undefined');assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.constructed,1);assert.equal(r.spent,25);assert.equal(r.httpCalls,0);assert.deepEqual(r.privateModes,[0o600]);
});
for(const mode of ['import','reader','publication','thin','metadata','oauth'])test(mode+' accepts foreign genuine typed response bytes under canonical IO ownership',()=>{
 const r=run(mode,'bytes');assert.equal(r.ok,true,JSON.stringify(r));assert(r.httpCalls>0);assert.equal(r.peerDenials,r.httpCalls);assert.equal(r.trialAccepted,false);assert.equal(r.rollbackComplete,false);assert.equal(r.realGoogleUiCalls,0);assert(r.privateModes.every(v=>v===0o600));
});
test('all preparation adapters run and clean up under one real synthetic canonical flock without ambient process',()=>{
 const r=run('all','combined');assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.ambientProcess,'undefined');assert.equal(r.constructed,6);assert.equal(r.spent,53);assert.equal(r.peerDenials,r.httpCalls);assert.deepEqual(r.cActions,['restore-editor','read-restored-editor']);assert.deepEqual(r.iActions,['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','revoke-token']);assert.equal(r.trialAccepted,false);assert.equal(r.rollbackComplete,false);assert.equal(r.realGoogleUiCalls,0);assert(r.privateModes.every(v=>v===0o600));
});
test('foreign Uint16Array cannot replace the pinned XLSX fixture or reach upload',()=>{
 const r=run('import','bad-fixture');assert.equal(r.ok,false);assert.equal(r.error,'TRIAL_STOPPED');assert.equal(r.constructed,0);assert.equal(r.httpCalls,0);assert.equal(r.spent,25);
});
test('an array-like response cannot become JSON or acceptance after cross-realm support',()=>{
 const r=run('metadata','bad-bytes');assert.equal(r.ok,false);assert.equal(r.error,'TRIAL_STOPPED');assert.equal(r.httpCalls,1);assert.equal(r.spent,26);assert.equal(r.trialAccepted,false);
});

test('all six adapters survive preparation, one strict wrapper entry and cleanup without a new credential or counter',()=>{
 const r=run('lifecycle','combined');assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.ambientProcess,'undefined');assert.equal(r.constructed,6);assert.equal(r.spent,108);assert.equal(r.rpcCalls,1);assert.equal(r.nativeMs,100);assert.deepEqual(r.runtimeEntries,[{entry:'wrapper',complete:true,accounted:true}]);assert.equal(r.peerDenials,r.httpCalls+r.rpcCalls+r.syntheticNativeCleanupCalls);assert.equal(r.iActions.length,17);assert.equal(r.syntheticNativeCleanupCalls,12);assert.equal(r.orchestrationReport.state,'finished');assert.equal(r.trialAccepted,false);assert.equal(r.rollbackComplete,false);assert.equal(r.actualCounterTouched,false);assert.equal(r.realGoogleUiCalls,0);assert(r.privateModes.every(v=>v===0o600));
});

test('transport UNKNOWN across the phase facade settles native once and still runs all independent cleanup',()=>{
 const r=run('lifecycle','transport-failure');assert.equal(r.ok,false);assert.equal(r.error,'TRIAL_STOPPED');assert.equal(r.rpcCalls,1);assert.equal(r.nativeMs,100);assert.deepEqual(r.runtimeEntries,[{entry:'wrapper',complete:false,accounted:true}]);assert.equal(r.pending.entry,'wrapper');assert.equal(r.iActions.length,17);assert(r.iActions.includes('revoke-token'));assert.equal(r.actualCounterTouched,false);assert.equal(r.trialAccepted,false);assert.equal(r.rollbackComplete,false);
});

test('all fixed preparation adapters debit unique approved aliases and reuse the original fresh import readback',()=>{
 const r=run('all','strict');assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.spent,53);assert.equal(r.constructed,6);assert.equal(r.actualCounterTouched,false);assert.equal(r.realGoogleUiCalls,0);
 const ordinary=r.charges.filter(v=>v.kind==='ordinary').map(v=>v.action);assert.equal(new Set(ordinary).size,ordinary.length);assert(ordinary.includes('B:fixture-import'));assert(ordinary.includes('B:fixture-file-readback'));assert(ordinary.includes('B:original-acl-fresh'));assert(ordinary.includes('B:reader-create'));assert(ordinary.includes('E:oauth-response'));assert(ordinary.includes('E:token-exchange'));assert(ordinary.includes('E:caller-userinfo'));assert.equal(r.cActions.length,2);assert.equal(r.iActions.length,5);
});
