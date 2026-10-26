import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {setup,clock} from './fixtures/read-authority/standalone-script-cleanup.mjs';
import {operation} from './fixtures/read-authority/continuation-budget.mjs';
import {hash} from './fixtures/read-authority/standalone-budget.mjs';
const lock=path=>{const r=spawnSync('python3',['-c',"import fcntl,sys\nf=open(sys.argv[1],'r+')\ntry:fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);print('FREE')\nexcept BlockingIOError:print('HELD')",path+'.lock'],{encoding:'utf8',timeout:3000});assert.equal(r.status,0);return r.stdout.trim();};
const ownerClosed=s=>s.owner.withContinuation(cap=>cap.externalRead(()=>{},operation('P:caller-bind')));
test('script cleanup requires retained attempted drained owner and cannot manufacture authority from disk',()=>setup(async s=>{
 let entered=0;await assert.rejects(s.cleanup().withScriptCleanup(()=>{entered++;}),/TRIAL_STOPPED/);assert.equal(entered,0);assert.equal(s.calls.length,0);
 assert.equal(typeof s.owner.withScriptCleanup,'function');await s.owner.stopAndDrain();await assert.rejects(s.owner.withScriptCleanup(()=>{entered++;}),/TRIAL_STOPPED/);assert.equal(entered,0);
}));
test('standalone script cleanup has separate cumulative J2 UNKNOWN debit and preserves original I17',()=>setup(async s=>{
 await ownerClosed(s);const old=readFileSync(s.path),ordinary=readFileSync(s.path+'.standalone.json');
 await s.cleanup().withScriptCleanup(async cap=>{
  assert.deepEqual(Object.keys(cap),['cleanup']);const reader=s.api.createStandaloneScriptReader({...s.options,control:cap});assert.deepEqual(Object.keys(reader),['status','remove','verifyRemoved']);assert.equal(reader.grant,undefined);
  await reader.remove();const removed=await reader.verifyRemoved();assert.equal(removed.readerAbsentAtReadback,true);assert.equal(removed.grantOutcomeKnown,false);assert.equal(removed.rollbackComplete,false);
 });
 const registry=JSON.parse(readFileSync(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.standalone.json'))).value;assert.equal(registry.checkpoint.spent,3);assert.deepEqual(registry.checkpoint.events.slice(-2).map(e=>[e.operation.bucket,e.operation.alias,e.outcome]),[['J','script-remove','UNKNOWN'],['J','script-verify','UNKNOWN']]);
 assert.deepEqual(readFileSync(s.path),old);assert.deepEqual(readFileSync(s.path+'.standalone.json'),ordinary);assert.equal(s.calls.length,2);assert(s.calls.every(v=>v.time>=clock+60000));assert.deepEqual(s.pauses,[60000]);
}));
for(const kind of ['journal','partial-stop'])test('script cleanup survives corrupt '+kind+' after captured drain without rewriting it',()=>setup(async s=>{
 await ownerClosed(s);const path=s.path+(kind==='journal'?'.standalone.json':'.standalone-stop.json');s.put(path,kind==='journal'?'CORRUPT':'');
 await s.cleanup().withScriptCleanup(cap=>s.api.createStandaloneScriptReader({...s.options,control:cap}).remove());assert.equal(readFileSync(path,'utf8'),kind==='journal'?'CORRUPT':'');assert.equal(s.calls.length,1);
}));
for(const kind of ['scriptRegistry','path'])test('missing script '+kind+' never creates cleanup state',()=>setup(async s=>{
 await ownerClosed(s);const path=kind==='path'?s.options.path:s.scriptRegistry;unlinkSync(path);
 await s.cleanup().withScriptCleanup(async cap=>assert.throws(()=>s.api.createStandaloneScriptReader({...s.options,control:cap}),/TRIAL_STOPPED/));assert.equal(existsSync(path),false);assert.equal(s.calls.length,0);
}));
test('script constructor cannot borrow old cleanup cap and old reader cannot borrow J scope',()=>setup(async s=>{
 await ownerClosed(s);await s.cleanup().withCleanup(async cap=>assert.throws(()=>s.api.createStandaloneScriptReader({...s.options,control:cap}),/TRIAL_STOPPED/));
 await s.cleanup().withScriptCleanup(async cap=>assert.throws(()=>s.api.createStandaloneReader({...s.readerOptions,control:cap}),/TRIAL_STOPPED/));assert.equal(s.calls.length,0);
}));
test('script cleanup rechecks frozen overlay after durable admission at IO entry',()=>setup(async s=>{
 await ownerClosed(s);let entered=0;
 await assert.rejects(s.cleanup().withScriptCleanup(async cap=>{
  const work=cap.cleanup('script-remove',()=>{entered++;});void work.catch(()=>{});s.put(join(s.overlay.path,'scripts/read-authority-trial-reader.mjs'),'DRIFT_AFTER_SCHEDULING');await assert.rejects(work,/TRIAL_STOPPED/);
 }),/TRIAL_STOPPED/);assert.equal(entered,0);
}));
test('failed script remove stays globally consumed and separate later verification is allowed',()=>setup(async s=>{
 await ownerClosed(s);let deletes=0;const fetcher=async(url,init)=>{if(init.method==='DELETE'){deletes++;throw Error('UNKNOWN_DELETE');}return s.options.fetcher(url,init);};
 await assert.rejects(s.cleanup().withScriptCleanup(cap=>s.api.createStandaloneScriptReader({...s.options,fetcher,control:cap}).remove()),/TRIAL_STOPPED/);
 await s.cleanup().withScriptCleanup(async cap=>{const reader=s.api.createStandaloneScriptReader({...s.options,control:cap});await assert.rejects(reader.remove(),/TRIAL_STOPPED/);const result=await reader.verifyRemoved();assert.equal(result.readerAbsentAtReadback,true);assert.equal(result.rollbackComplete,false);});assert.equal(deletes,1);
}));

test('actual owner independently enforces full quiet interval and cleanup-only action whitelist',()=>setup(async s=>{
 await ownerClosed(s);let entered=0;await s.owner.withScriptCleanup(async cap=>{assert.deepEqual(Object.keys(cap),['cleanup']);await cap.cleanup('script-remove',()=>{entered++;assert.equal(s.now(),clock+60000);assert.equal(lock(s.path),'HELD');});});assert.equal(entered,1);assert.equal(s.now(),clock+60000);assert.equal(lock(s.path),'FREE');
 await assert.rejects(s.owner.withScriptCleanup(cap=>cap.cleanup('script-remove',()=>{entered++;})),/TRIAL_STOPPED/);assert.equal(entered,1);
 await s.owner.withScriptCleanup(cap=>cap.cleanup('script-verify',()=>{entered++;}));assert.equal(entered,2);
 await assert.rejects(s.owner.withScriptCleanup(cap=>cap.cleanup('remove-reader',()=>{entered++;})),/TRIAL_STOPPED/);assert.equal(entered,2);
}));
for(const [key,value] of [['scriptId','SYNTHETIC_OTHER_SCRIPT_ID'],['originalScriptId','SYNTHETIC_OTHER_ORIGINAL_ID'],['callerHash','f'.repeat(64)],['path','/tmp/forbidden-script-reader.json'],['expiresAt',clock+1]])test('script recovery fixed '+key+' rejects before IO',()=>setup(async s=>{
 await ownerClosed(s);await s.cleanup().withScriptCleanup(async cap=>assert.throws(()=>s.api.createStandaloneScriptReader({...s.options,[key]:value,control:cap}),/TRIAL_STOPPED/));assert.equal(s.calls.length,0);
}));
test('shared actual owner excludes J cleanup throughout old cleanup cooldown across recovery objects',()=>setup(async s=>{
 await ownerClosed(s);let release,ready;const gate=new Promise(r=>{release=r;}),paused=new Promise(r=>{ready=r;}),events=[];
 const old=s.api.createCleanup({owner:s.owner,originalOptions:s.originalOptions,now:s.now,pause:async ms=>{await s.pause(ms);ready();await gate;}});
 const actions=['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','restore-original-guard','verify-original-guard','restore-thin-guard','verify-thin-guard','remove-testing-user','verify-testing-user-removed'];
 const work=old.withCleanup(async cap=>{for(const action of actions)await cap.cleanup(action,()=>events.push({action,time:s.now()}));});void work.catch(()=>{});await paused;
 try{await assert.rejects(s.owner.withScriptCleanup(async cap=>{for(const action of ['script-remove','script-verify'])await cap.cleanup(action,()=>events.push({action,time:s.now()}));}),/TRIAL_STOPPED/);}finally{release();await work;}
 assert.equal(events.length,10);assert.equal(s.now(),clock+60000);
 await s.cleanup().withScriptCleanup(async cap=>{for(const action of ['script-remove','script-verify'])await cap.cleanup(action,()=>events.push({action,time:s.now()}));});
 assert.equal(events.length,12);assert(events.slice(10).every(e=>e.time>=clock+120000));
}));

import {successorOwner} from './fixtures/read-authority/standalone-recovery.mjs';
test('closed preflight successor J2 cleanup shares actual predecessor exclusion and keeps imported33',()=>setup(async s=>{
 const owner=await successorOwner(s);await owner.withContinuation(cap=>cap.externalRead(()=>{},operation('P:publisher-bind')));
 const old=readFileSync(s.path),predecessor=readFileSync(s.path+'.standalone.json'),cleanup=s.api.createCleanup({owner,originalOptions:s.originalOptions,now:s.now,pause:s.pause});
 await cleanup.withScriptCleanup(async cap=>{const reader=s.api.createStandaloneScriptReader({...s.options,control:cap});await reader.remove();await reader.verifyRemoved();});
 const reg=JSON.parse(readFileSync(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.standalone-successor.json'))).value;
 assert.equal(reg.checkpoint.spent,3);assert.deepEqual(reg.checkpoint.events.slice(-2).map(e=>e.operation.bucket),['J','J']);
 assert.deepEqual(readFileSync(s.path),old);assert.deepEqual(readFileSync(s.path+'.standalone.json'),predecessor);
 await assert.rejects(cleanup.withScriptCleanup(cap=>cap.cleanup('script-remove',()=>assert.fail('DUPLICATE'))),/TRIAL_STOPPED/);
}));

import {STANDALONE_TRIAL_POLICY} from '../scripts/read-authority-continuation-plan.mjs';
import {research} from './fixtures/read-authority/continuation-budget.mjs';
test('transferred predecessor cannot repeat J2 or spend unused2 after successor maximum158 path',()=>setup(async s=>{
 const owner=await successorOwner(s),staleJ=s.predecessorHandoff.legacy.withScriptCleanup;
 const map=Object.entries(STANDALONE_TRIAL_POLICY.operations).map(([key,rule])=>({id:key.replace(':','.'),bucket:key.split(':')[0],alias:key.slice(key.indexOf(':')+1),actor:rule.actor,target:rule.target,operation:rule.methods[0],units:1}));
 map.push(...Array.from({length:20},(_,i)=>({...research(i+1),stage:i<8?'research':'preparation'})));
 await assert.rejects(owner.withContinuation(async cap=>{
  await cap.completePlan(map);
  for(const op of map.filter(v=>v.bucket==='P'&&v.alias!=='caller-bind'))await cap.externalRead(()=>{},op);
  for(const op of map.filter(v=>['A','B','D','E','N'].includes(v.bucket)||v.bucket==='F'&&v.alias.startsWith('wrapper-before.')||v.bucket==='G'&&v.alias.startsWith('wrapper-before.')))await cap.externalRead(()=>{},op);
  await cap.dispatchCompatibility({operation:map.find(v=>v.bucket==='H'),credentialExpiresAt:s.cfg.expiresAt},()=>null);
  for(const op of map.filter(v=>v.bucket==='F'&&v.alias.startsWith('wrapper-after.')||v.bucket==='G'&&v.alias.startsWith('wrapper-after.')||v.bucket==='T'))await cap.externalRead(()=>{},op);
  throw Error('SYNTHETIC_UNKNOWN_RPC');
 }),/TRIAL_STOPPED/);
 const cleanup=s.api.createCleanup({owner,originalOptions:s.originalOptions,now:s.now,pause:s.pause});
 await cleanup.withCleanup(async cap=>{for(const action of ['restore-editor','read-restored-editor'])await cap.restoreOriginalEditor(action,()=>{});for(const op of map.filter(v=>v.bucket==='I'))await cap.cleanup(op.alias,()=>{});});
 await owner.withScriptCleanup(async cap=>{await cap.cleanup('script-remove',()=>{});await cap.cleanup('script-verify',()=>{});});
 const predecessor=s.cfg.closedPreflight.registry.path,oldBytes=readFileSync(predecessor),reg=JSON.parse(readFileSync(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.standalone-successor.json'))).value;
 assert.equal(s.get().spent+6+reg.checkpoint.spent,158);assert.equal(reg.checkpoint.chargedUpperBoundMs,360000);assert.equal(reg.checkpoint.rpc.complete,false);
 let forbidden=0;for(const action of ['script-remove','script-verify'])await assert.rejects(staleJ(cap=>cap.cleanup(action,()=>{forbidden++;})),/TRIAL_STOPPED/);
 assert.equal(forbidden,0);assert.deepEqual(readFileSync(predecessor),oldBytes);assert.equal(s.get().spent+6+reg.checkpoint.spent,158);
}));
