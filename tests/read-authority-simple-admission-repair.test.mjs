import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {fixture,session,ui,good,debit,settle,hash,compact,wrapped,clock} from './fixtures/read-authority/simple-budget.mjs';
import {createAuthoritySimpleControl} from '../scripts/read-authority-simple-control.mjs';
const decision='fc822ca3296a4f66195c02e9db1088ca6b95eb197bd440a27f417069e9b7cdd7';
const repairDecision='03310835216ab80ff344fe51264466bb7c7cc333d3e7df499b28ce9eb85e290f';
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

async function repair(){
 const s=await successor(),h=session(s);try{good(await h.ready);await debit(h,ui(13,{id:'simple-continuation-native-trigger-a',target:'original-triggers'}),s.time);good(await settle(h,'simple-continuation-native-trigger-a',true,s.time));}finally{await h.close();}
 const pin=p=>({path:p,sha256:hash(readFileSync(p))}),a=join(s.home,'repair-approval.json'),parent=s.path+'.simple-continuation.json',j=JSON.parse(readFileSync(parent));
 s.time+=1000;s.put(a,compact({source:'direct-human-approval',decisionSha256:repairDecision,ownerAnswer:'同意單次本地准入修復，保留66／232及原期限',predecessorSha256:pin(parent).sha256,importedSpent:66,importedMainSpent:53,importedUiSpent:13,mainLimit:160,uiOrdinaryLimit:56,uiRecoveryLimit:16,combinedLimit:232,w0:j.w0,expiresAt:j.expiresAt,recordedAt:s.time,executionStarted:false}));
 s.cfg={...s.cfg,now:s.time,admissionRepair:{decisionHash:repairDecision,approval:pin(a),journal:pin(parent),claim:pin(s.path+'.simple-continuation-claim.json'),stop:pin(s.path+'.simple-continuation-stop.json'),registry:pin(join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-continuation.json'))}};
 s.parent=j;s.repaired=()=>JSON.parse(readFileSync(s.path+'.simple-admission-repair.json'));s.parentBytes=Object.fromEntries(['journal','claim','stop','registry'].map(k=>[s.cfg.admissionRepair[k].path,readFileSync(s.cfg.admissionRepair[k].path)]));return s;
}
test('explicit repair retains66, thirteen events, zero retries and original clock without IO',async()=>{const s=await repair(),h=session(s);try{const r=await h.ready;good(r);assert.equal(r.combinedSpent,66);assert.equal(r.preparation,13);assert.equal(r.failures,2);assert.equal(r.w0,s.parent.w0);assert.equal(r.expiresAt,s.parent.expiresAt);assert.deepEqual(s.repaired().events,s.parent.events);const d=await debit(h,ui(14),s.time);assert.equal(d.combinedSpent,67);assert.equal(d.w0,s.parent.w0);good(await settle(h,'ui-14',true,s.time));}finally{await h.close();}for(const[p,b]of Object.entries(s.parentBytes))assert.deepEqual(readFileSync(p),b);});
test('only three preparation debits remain and one failed read still stops permanently',async()=>{for(const fail of [false,true]){const s=await repair(),h=session(s);try{good(await h.ready);for(let n=14;n<=(fail?14:16);n++){await debit(h,ui(n),s.time);const r=await settle(h,'ui-'+n,!fail,s.time);if(fail){assert.equal(r.state,'stopped');assert.equal(r.failures,3);}}assert.equal((await h.send({op:'debit',lane:'ui',operation:ui(17),now:s.time})).ok,false);}finally{await h.close();}}});
test('repair singleton cannot restart even if no new operation occurred',async()=>{const s=await repair(),h=session(s);try{good(await h.ready);}finally{await h.close();}const again=session(s);try{assert.equal((await again.ready).ok,false);}finally{await again.close();}});
for(const k of ['approval','journal','claim','stop','registry'])test('repair rejects '+k+' drift before its claim',async()=>{const s=await repair();s.put(s.cfg.admissionRepair[k].path,'{}');const h=session(s);try{assert.equal((await h.ready).ok,false);assert.equal(existsSync(s.path+'.simple-admission-repair-claim.json'),false);}finally{await h.close();}});
test('repair cannot extend/reset window, refund counts, change binding or start with less than RPC reserve',async()=>{for(const defect of ['w0','expiresAt','ui','answer','binding','deadline']){const s=await repair(),p=s.cfg.admissionRepair.approval,a=JSON.parse(readFileSync(p.path));if(defect==='w0')a.w0+=1000;if(defect==='expiresAt')a.expiresAt+=1000;if(defect==='ui')a.importedUiSpent=0;if(defect==='answer')a.ownerAnswer='continue';if(defect==='binding')s.cfg.binding='1'.repeat(64);if(defect==='deadline')s.cfg.now=s.parent.expiresAt-360000;s.put(p.path,compact(a));p.sha256=hash(readFileSync(p.path));const h=session(s);try{assert.equal((await h.ready).ok,false);assert.equal(existsSync(s.path+'.simple-admission-repair-claim.json'),false);}finally{await h.close();}}});
test('repair rejects repinned pending, failed, refunded or mutated parent',async()=>{for(const defect of ['pending','failed','refund','mutated']){const s=await repair(),p=s.cfg.admissionRepair,j=structuredClone(s.parent);if(defect==='pending')j.pending='UNKNOWN';if(defect==='failed')j.events[12].success=false;if(defect==='refund')j.events.pop();if(defect==='mutated')j.mutated=true;s.put(p.journal.path,compact(j));p.journal.sha256=hash(readFileSync(p.journal.path));const a=JSON.parse(readFileSync(p.approval.path));a.predecessorSha256=p.journal.sha256;s.put(p.approval.path,compact(a));p.approval.sha256=hash(readFileSync(p.approval.path));const reg=JSON.parse(readFileSync(p.registry.path)).value;reg.checkpoint=j;s.put(p.registry.path,wrapped(reg));p.registry.sha256=hash(readFileSync(p.registry.path));const h=session(s);try{assert.equal((await h.ready).ok,false);}finally{await h.close();}}});
test('original C2 independent cleanup survives expiry and damaged repair mirror',async()=>{const s=await repair(),h=session(s);try{good(await h.ready);s.put(s.path+'.simple-admission-repair.json','{');good(await h.send({op:'cleanup-start',now:s.parent.expiresAt+60000}));const o={id:'repair-original-restore',bucket:'C',alias:'restore-editor',actor:'publisher',target:'original-project',operation:'PUT',units:1};good(await debit(h,o,s.parent.expiresAt+60000,'main'));good(await settle(h,o.id,true,s.parent.expiresAt+60000));assert.equal(s.get().spent,28);}finally{await h.close();}});
test('JS holder charges repair once before callback, stops and drains only its own new singleton',async()=>{const s=await repair();let at=s.time;const{now,ownerNonce,...config}=s.cfg,home=process.env.HOME;process.env.HOME=s.home;let c;try{c=createAuthoritySimpleControl({config,guard:()=>{},assertStage:()=>{},now:()=>at,pause:async ms=>{at+=ms;}});}finally{process.env.HOME=home;}let calls=0;await assert.rejects(c.withContinuation(async cap=>{assert.equal((await cap.inspect()).combinedSpent,66);await cap.browserRead(()=>{calls++;assert.equal(s.repaired().pending,'ui-14');throw Error('READ_FAIL');},ui(14));}),/TRIAL_STOPPED/);assert.equal(calls,1);assert.equal((await c.stopAndDrain()).ownedScope.state,'SETTLED');assert.equal(s.repaired().events.length,14);assert.equal(JSON.parse(readFileSync(s.cfg.admissionRepair.journal.path)).events.length,13);});

const windowDecision='abb1747f4eae5ba0cd98c200649f700a4cd6de97b215b14b671f63eee0eb25a3';
const renewedAt=Date.parse('2026-10-25T01:00:00Z'); // Taipei09:00, after the original expired clock.
async function windowRepair(at=renewedAt){
 const s=await repair(),file=join(s.home,'window-approval.json'),p=s.cfg.admissionRepair;
 s.put(file,compact({source:'direct-human-approval',decisionSha256:windowDecision,ownerAnswer:'同意更新未啟動修復時窗，其餘限制不變',repairDecisionSha256:repairDecision,repairApprovalSha256:p.approval.sha256,predecessorSha256:p.journal.sha256,importedSpent:66,importedMainSpent:53,importedUiSpent:13,mainLimit:160,uiOrdinaryLimit:56,uiRecoveryLimit:16,combinedLimit:232,w0:s.parent.w0,expiresAt:s.parent.expiresAt,recordedAt:at,executionStarted:false}));
 s.cfg.admissionWindow={decisionHash:windowDecision,approval:{path:file,sha256:hash(readFileSync(file))}};s.time=at;s.cfg.now=at;return s;
}
test('approved unused repair clock starts at durable debit, not admission, inspection or wait',async()=>{
 const s=await windowRepair(),h=session(s);try{const r=await h.ready;good(r);assert.equal(r.combinedSpent,66);assert.equal(r.w0,null);assert.equal(r.expiresAt,null);good(await h.send({op:'inspect'}));good(await h.send({op:'wait',lane:'ui',operation:ui(14),now:s.time+600000}));assert.equal(s.repaired().w0,null);
 const t=Date.parse('2026-10-25T02:00:00Z'),d=await debit(h,ui(14),t);assert.equal(d.w0,t);assert.equal(d.expiresAt,Date.parse('2026-10-25T08:00:00Z'));assert.equal(d.combinedSpent,67);good(await settle(h,'ui-14',true,t));assert.deepEqual(s.repaired().events.slice(0,13),s.parent.events);
 }finally{await h.close();}for(const[p,b]of Object.entries(s.parentBytes))assert.deepEqual(readFileSync(p),b);
});
test('new repair clock caps at Taipei midnight and cannot debit again after expiry',async()=>{
 const at=Date.parse('2026-10-25T15:45:00Z'),s=await windowRepair(at),h=session(s);try{good(await h.ready);const d=await debit(h,ui(14),at);assert.equal(d.expiresAt,Date.parse('2026-10-25T15:59:59.999Z'));good(await settle(h,'ui-14',true,at));assert.equal((await h.send({op:'debit',lane:'ui',operation:ui(15),now:d.expiresAt+1})).ok,false);}finally{await h.close();}
});
test('six-minute-or-less admission creates no singleton; the unused entry can wait until next day',async()=>{
 for(const at of [Date.parse('2026-10-25T15:53:59.999Z'),Date.parse('2026-10-25T15:55:00Z')]){const s=await windowRepair(at),h=session(s);try{assert.equal((await h.ready).ok,false);assert.equal(existsSync(s.path+'.simple-admission-repair-claim.json'),false);}finally{await h.close();}s.cfg.now=Date.parse('2026-10-26T00:00:00Z');const next=session(s);try{good(await next.ready);assert.equal(s.repaired().w0,null);}finally{await next.close();}}
});
test('one millisecond beyond the reserve admits the unused repair without starting its clock',async()=>{
 const s=await windowRepair(Date.parse('2026-10-25T15:53:59.998Z')),h=session(s);try{good(await h.ready);assert.equal(s.repaired().w0,null);}finally{await h.close();}
});
test('new clock cannot reopen the same repair singleton even before its first debit',async()=>{
 const s=await windowRepair(),h=session(s);try{good(await h.ready);}finally{await h.close();}const next=session(s);try{assert.equal((await next.ready).ok,false);}finally{await next.close();}
});
test('new clock cannot replace a consumed original-clock repair singleton',async()=>{
 const s=await windowRepair(),window=s.cfg.admissionWindow;delete s.cfg.admissionWindow;s.cfg.now=JSON.parse(readFileSync(s.cfg.admissionRepair.approval.path)).recordedAt;
 const h=session(s);try{good(await h.ready);}finally{await h.close();}
 s.cfg.admissionWindow=window;s.cfg.now=renewedAt;const next=session(s);try{assert.equal((await next.ready).ok,false);}finally{await next.close();}
});
test('new clock rejects repinned approval changes without creating an owner',async()=>{
 for(const k of ['ownerAnswer','repairApprovalSha256','predecessorSha256','importedSpent','w0','expiresAt','recordedAt','executionStarted','extra']){const s=await windowRepair(),p=s.cfg.admissionWindow.approval,a=JSON.parse(readFileSync(p.path));if(k==='executionStarted')a[k]=true;else if(k==='recordedAt')a[k]=s.time+1;else a[k]=typeof a[k]==='number'?a[k]+1:'invalid';s.put(p.path,compact(a));p.sha256=hash(readFileSync(p.path));const h=session(s);try{assert.equal((await h.ready).ok,false);assert.equal(existsSync(s.path+'.simple-admission-repair-claim.json'),false);}finally{await h.close();}}
});
test('clock approval alone cannot bypass the original repair approval or predecessor',async()=>{
 for(const defect of ['repair','continuation','approval','decision']){const s=await windowRepair();if(defect==='repair')delete s.cfg.admissionRepair;if(defect==='continuation')delete s.cfg.continuation;if(defect==='approval')s.put(s.cfg.admissionRepair.approval.path,'{}');if(defect==='decision')s.cfg.admissionWindow.decisionHash='0'.repeat(64);const h=session(s);try{assert.equal((await h.ready).ok,false);assert.equal(existsSync(s.path+'.simple-admission-repair-claim.json'),false);}finally{await h.close();}}
});
test('clock approval remains pinned on every command and drift stops before another debit',async()=>{
 const s=await windowRepair(),h=session(s);try{good(await h.ready);s.put(s.cfg.admissionWindow.approval.path,'{}');assert.equal((await h.send({op:'debit',lane:'ui',operation:ui(14),now:s.time})).ok,false);assert.equal(s.repaired().events.length,13);}finally{await h.close();}
});
test('renewed repair keeps independent original recovery after expiry and damaged ordinary mirror',async()=>{
 const s=await windowRepair(),h=session(s);try{good(await h.ready);const d=await debit(h,ui(14),s.time);good(await settle(h,'ui-14',true,s.time));s.put(s.path+'.simple-admission-repair.json','{');good(await h.send({op:'cleanup-start',now:d.expiresAt+60000}));const op={id:'window-original-restore',bucket:'C',alias:'restore-editor',actor:'publisher',target:'original-project',operation:'PUT',units:1};good(await debit(h,op,d.expiresAt+60000,'main'));good(await settle(h,op.id,true,d.expiresAt+60000));assert.equal(s.get().spent,28);}finally{await h.close();}
});
test('JS renewed repair persists one charge before failed callback and never restores a retry',async()=>{
 const s=await windowRepair();let at=s.time;const{now,ownerNonce,...config}=s.cfg,home=process.env.HOME;process.env.HOME=s.home;let c;try{c=createAuthoritySimpleControl({config,guard:()=>{},assertStage:()=>{},now:()=>at,pause:async ms=>{at+=ms;}});}finally{process.env.HOME=home;}let calls=0;await assert.rejects(c.withContinuation(async cap=>{assert.equal((await cap.inspect()).w0,null);await cap.browserRead(()=>{calls++;assert.equal(s.repaired().pending,'ui-14');assert.equal(s.repaired().w0,at);throw Error('FAIL');},ui(14));}),/TRIAL_STOPPED/);assert.equal(calls,1);assert.equal(s.repaired().failures,3);assert.equal(s.repaired().state,'stopped');assert.equal((await c.stopAndDrain()).ownedScope.state,'SETTLED');await assert.rejects(c.withContinuation(()=>{}),/TRIAL_STOPPED/);assert.equal(calls,1);
});
