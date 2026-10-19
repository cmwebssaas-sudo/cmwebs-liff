import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fixture,session,ui,good,debit,settle,hash,compact,wrapped,clock} from './fixtures/read-authority/simple-budget.mjs';
import {createAuthoritySimpleControl} from '../scripts/read-authority-simple-control.mjs';
const decision='fc822ca3296a4f66195c02e9db1088ca6b95eb197bd440a27f417069e9b7cdd7';
async function successor(){
 const s=fixture(),old=session(s);let at=clock;
 try{
  good(await old.ready);
  for(let n=1;n<=12;n++){const r=await debit(old,ui(n),at);at=r.lastAt;good(await settle(old,'ui-'+n,n!==3&&n!==5,at));}
  const end=s.journal().expiresAt;assert.equal((await old.send({op:'debit',lane:'ui',operation:ui(13),now:end+1})).ok,false);
 }finally{await old.close();}
 const pin=path=>({path,sha256:hash(readFileSync(path))}),approval=join(s.home,'continuation-approval.json'),drain=join(s.home,'simple65-drain.json'),oldJournal=s.path+'.simple.json',prior=s.journal();
 const now=prior.expiresAt+60000;
 s.put(drain,compact({source:'deadline-expired-retained-owner-closed',closedAt:new Date(prior.expiresAt+1).toISOString(),drain:{source:'simple-authority-holder',stopRequested:true,stopAcknowledged:true,ordinaryScopeClosed:true,ownedScope:{state:'SETTLED'},trialAccepted:false,remoteExecutionSettled:false,rollbackComplete:false},remoteMutationsInThisScope:0,compatibilityRpcAttempted:false,ordinaryResumeAllowed:false}));
 s.put(approval,compact({source:'direct-human-approval',decisionSha256:decision,ownerAnswer:'同意單次接續，保留65／232及全部限制',predecessorSha256:pin(oldJournal).sha256,importedSpent:65,importedMainSpent:53,importedUiSpent:12,mainLimit:160,uiOrdinaryLimit:56,uiRecoveryLimit:16,combinedLimit:232,recordedAt:now,executionStarted:false}));
 s.cfg={...s.cfg,now,continuation:{decisionHash:decision,approval:pin(approval),journal:pin(oldJournal),claim:pin(s.path+'.simple-claim.json'),stop:pin(s.path+'.simple-stop.json'),registry:pin(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple.json')),drain:pin(drain)}};
 s.before=Object.fromEntries(Object.values(s.cfg.continuation).filter(v=>v?.path).map(p=>[p.path,readFileSync(p.path)]));
 s.next=()=>JSON.parse(readFileSync(s.path+'.simple-continuation.json'));s.prior=prior;s.time=now;return s;
}
test('approved successor imports all65 with failures2/preparation12; first new debit fixes its only window',async()=>{
 const s=await successor(),h=session(s);try{const r=await h.ready;good(r);assert.equal(r.mainSpent,53);assert.equal(r.uiSpent,12);assert.equal(r.combinedSpent,65);assert.equal(r.failures,2);assert.equal(r.preparation,12);assert.equal(r.w0,null);assert.deepEqual(s.next().events,s.prior.events);
 const d=await debit(h,ui(13),s.time);assert.equal(d.combinedSpent,66);assert.equal(d.uiSpent,13);assert.equal(d.w0,s.time);assert.equal(d.expiresAt,s.time+21600000);good(await settle(h,'ui-13',true,s.time));
 }finally{await h.close();}for(const [p,b] of Object.entries(s.before))assert.deepEqual(readFileSync(p),b);
});
test('successor preparation has only four remaining debits, never another sixteen',async()=>{const s=await successor(),h=session(s);try{good(await h.ready);for(let n=13;n<=16;n++){good(await debit(h,ui(n),s.time));good(await settle(h,'ui-'+n,true,s.time));}assert.equal((await h.send({op:'debit',lane:'ui',operation:ui(17),now:s.time})).ok,false);assert.equal(s.next().events.length,16);}finally{await h.close();}});
test('first failed successor observation stops without restoring either old retry',async()=>{const s=await successor(),h=session(s);try{good(await h.ready);await debit(h,ui(13),s.time);const r=await settle(h,'ui-13',false,s.time);good(r);assert.equal(r.state,'stopped');assert.equal(r.failures,3);assert.equal(r.combinedSpent,66);assert.equal((await h.send({op:'debit',lane:'ui',operation:ui(14),now:s.time})).ok,false);}finally{await h.close();}});
for(const key of ['approval','journal','claim','stop','registry','drain'])test('successor rejects '+key+' drift before claim/debit',async()=>{const s=await successor();s.put(s.cfg.continuation[key].path,'{}');const h=session(s);try{assert.equal((await h.ready).ok,false);assert.equal(existsSync(s.path+'.simple-continuation-claim.json'),false);}finally{await h.close();}});
test('successor pins forbid changed actor binding, epoch, path or policy',async()=>{for(const kind of ['binding','epoch','path','policy']){const s=await successor();if(kind==='binding')s.cfg.binding='1'.repeat(64);if(kind==='epoch')s.cfg.epoch+='OTHER';if(kind==='path')s.cfg.path+='.other';if(kind==='policy')s.cfg.continuation.decisionHash='2'.repeat(64);const h=session(s);try{assert.equal((await h.ready).ok,false);}finally{await h.close();}}});
test('only one successor exists even when it ends before new IO',async()=>{const s=await successor(),h=session(s);try{good(await h.ready);}finally{await h.close();}const again=session(s);try{assert.equal((await again.ready).ok,false);}finally{await again.close();}assert.equal(s.next().events.length,12);});
test('successor does not accept a forged refunded or unfinished predecessor even when all pins are republished',async()=>{for(const defect of ['events','failures','pending','mutated']){const s=await successor(),j=structuredClone(s.prior);if(defect==='events')j.events.pop();if(defect==='failures')j.failures=0;if(defect==='pending')j.pending='UNKNOWN';if(defect==='mutated')j.mutated=true;s.put(s.cfg.continuation.journal.path,compact(j));s.cfg.continuation.journal.sha256=hash(readFileSync(s.cfg.continuation.journal.path));const a=JSON.parse(readFileSync(s.cfg.continuation.approval.path));a.predecessorSha256=s.cfg.continuation.journal.sha256;s.put(s.cfg.continuation.approval.path,compact(a));s.cfg.continuation.approval.sha256=hash(readFileSync(s.cfg.continuation.approval.path));const reg=JSON.parse(readFileSync(s.cfg.continuation.registry.path)).value;reg.checkpoint=j;s.put(s.cfg.continuation.registry.path,wrapped(reg));s.cfg.continuation.registry.sha256=hash(readFileSync(s.cfg.continuation.registry.path));const h=session(s);try{assert.equal((await h.ready).ok,false);}finally{await h.close();}}});
test('live successor charges before callback, rejects subsequent ordinary IO and drains ownership',async()=>{const s=await successor();let at=s.time;const {now,ownerNonce,...config}=s.cfg,home=process.env.HOME;process.env.HOME=s.home;let c;try{c=createAuthoritySimpleControl({config,guard:()=>{},assertStage:()=>{},now:()=>at,pause:async ms=>{at+=ms;}});}finally{process.env.HOME=home;}let count=0;
 await assert.rejects(c.withContinuation(async cap=>{const first=await cap.inspect();assert.equal(first.combinedSpent,65);await cap.browserRead(()=>{count++;assert.equal(s.next().pending,'ui-13');throw Error('SYNTHETIC_READ_FAILURE');},ui(13));}),/TRIAL_STOPPED/);
 assert.equal(count,1);const drain=await c.stopAndDrain();assert.equal(drain.stopAcknowledged,true);assert.equal(drain.ordinaryScopeClosed,true);assert.equal(drain.ownedScope.state,'SETTLED');assert.equal(s.next().events.length,13);assert.equal(s.journal().events.length,12);
});


test('continuation approval cannot change counters, restore retries, bypass expiry or rewind its admission time',async()=>{
 for(const defect of ['ui','main','limit','time','answer','rpc']){
  const s=await successor(),p=s.cfg.continuation.approval,a=JSON.parse(readFileSync(p.path));
  if(defect==='ui')a.importedUiSpent=0;if(defect==='main')a.importedMainSpent=52;if(defect==='limit')a.uiOrdinaryLimit=60;
  if(defect==='time')s.cfg.now=a.recordedAt-1;if(defect==='answer')a.ownerAnswer='continue';if(defect==='rpc')a.executionStarted=true;
  s.put(p.path,compact(a));p.sha256=hash(readFileSync(p.path));const h=session(s);try{assert.equal((await h.ready).ok,false);assert.equal(existsSync(s.path+'.simple-continuation-claim.json'),false);}finally{await h.close();}
 }
});
test('new successor midnight cap and original C2 recovery remain available after damaged successor mirror',async()=>{
 const s=await successor(),late=Date.parse('2026-10-16T15:00:00Z');s.cfg.now=late;const h=session(s);try{
  good(await h.ready);const d=await debit(h,ui(13),late);assert.equal(d.expiresAt,Date.parse('2026-10-16T15:59:59.999Z'));good(await settle(h,'ui-13',true,late));
  assert.equal((await h.send({op:'debit',lane:'ui',operation:ui(14),now:d.expiresAt})).ok,false);
  s.put(s.path+'.simple-continuation.json','{');good(await h.send({op:'cleanup-start',now:d.expiresAt+60000}));
  const op={id:'successor-original-restore',bucket:'C',alias:'restore-editor',actor:'publisher',target:'original-project',operation:'PUT',units:1};
  const r=await debit(h,op,d.expiresAt+60000,'main');assert.equal(r.mainSpent,54);assert.equal(r.uiSpent,13);assert.equal(s.get().spent,28);good(await settle(h,op.id,true,d.expiresAt+60000));
 }finally{await h.close();}assert.equal(s.journal().events.length,12);
});
