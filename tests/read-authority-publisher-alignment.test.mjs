import assert from 'node:assert/strict';
import test from 'node:test';
import {PUBLISHER_ALIGNMENT_DECISION,createAuthorityPublisherAlignmentFlow} from '../scripts/read-authority-publisher-alignment.mjs';
import {alignmentFixture,holder,alignment,changePin} from './fixtures/read-authority/publisher-alignment.mjs';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

test('approved publisher alignment has its own decision and inert flow constructor',()=>{
 assert.equal(PUBLISHER_ALIGNMENT_DECISION,'5f764b29438b582cdd404823a3a01408579fec7045ac5016971a7394d89337cb');
 assert.equal(typeof createAuthorityPublisherAlignmentFlow,'function');
});

test('two readonly incidents allow at most three prepaid repair calls each',()=>{const code="import runpy,json; p=runpy.run_path('scripts/read-authority-publisher-alignment-budget.py')['repair_allowed']; print(json.dumps([p(0,1,0,0),p(1,1,0,0),p(1,1,2,2),p(1,1,3,3),p(1,2,0,3),p(2,2,0,3),p(2,2,2,5),p(2,2,3,6),p(3,3,0,0)]))";const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),[false,true,true,false,false,true,true,false,false]);});

test('stage admission preserves a single inherited trial clock',()=>{const code="import runpy,json; p=runpy.run_path('scripts/read-authority-publisher-alignment-budget.py')['stage_clock_valid']; print(json.dumps([p('PREP',None),p('PREP',1),p('TRIAL',1700000000000),p('TRIAL',None),p('TRIAL',0),p('HARD_STOP',1700000000000)]))";const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),[true,false,true,false,false,false]);});

test('exact102 and three settled sidecars import as 105 before any callback',async()=>{
 const s=await alignmentFixture(),a=holder(s),before=Object.fromEntries(Object.entries(s.old102).map(([p,v])=>[p,v]));
 const r=await a.withContinuation(cap=>cap.inspect());assert.equal(r.combinedSpent,105);assert.equal(r.mainSpent,53);assert.equal(r.uiSpent,52);assert.equal(r.combinedLimit,296);assert.equal(r.uiOrdinaryLimit,148);assert.equal(r.publisherUsed,0);assert.equal(s.aligned().events.length,49);assert.deepEqual(s.aligned().publisherImported.map(x=>x.providerCallAt),[null,null,null]);
 for(const[p,bytes]of Object.entries(before).filter(([p])=>!p.endsWith('.simple-rebalanced.json')))assert.equal(readFileSync(p).equals(bytes),true,p);
});

test('tampered sidecar is rejected before callback or new ledger write',async()=>{
 const s=await alignmentFixture(),p=alignment(s);changePin(s,p.charges.inventory.outcome,v=>{v.nonce='dishonest';});let calls=0;
 await assert.rejects(holder(s).withContinuation(()=>{calls++;}),/TRIAL_STOPPED/);assert.equal(calls,0);
});

for(const [label,mutate] of [
 ['gap in consecutive charges',(s,p)=>changePin(s,p.charges.inventory.reservation,v=>{v.effectiveSpent=105;})],
 ['duplicate nonce',(s,p)=>{const first=JSON.parse(readFileSync(p.charges.diagnostic.reservation.path));changePin(s,p.charges.inventory.reservation,v=>{v.nonce=first.nonce;});changePin(s,p.charges.inventory.outcome,v=>{v.nonce=first.nonce;});}],
 ['command mismatch',(s,p)=>changePin(s,p.charges.binding.reservation,v=>{v.command="const otherBrowser=await cua.getBrowser({id:'wrong'});";v.commandSha256='0'.repeat(64);})],
 ['false settlement',(s,p)=>changePin(s,p.charges.binding.outcome,v=>{v.settled=false;})]
])test(`${label} cannot import or enter callback`,async()=>{const s=await alignmentFixture(),p=alignment(s);mutate(s,p);let called=0;await assert.rejects(holder(s).withContinuation(()=>{called++;}),/TRIAL_STOPPED/);assert.equal(called,0);});

const repinOutcome=(s,p,kind,mutate)=>{changePin(s,p.charges[kind].outcome,mutate);if(kind==='inventory')changePin(s,p.charges.binding.reservation,v=>{v.firstOutcomeSha256=p.charges.inventory.outcome.sha256;});changePin(s,p.closure,v=>{v.outcome1Sha256=p.charges.inventory.outcome.sha256;v.outcome2Sha256=p.charges.binding.outcome.sha256;v.reservation2Sha256=p.charges.binding.reservation.sha256;});};
for(const [label,mutate] of [
 ['contradictory stopped snapshot',(s,p)=>changePin(s,p.origin.result,v=>{v.result.snapshot={source:'synthetic-contradiction',fieldsRead:false};})],
 ['missing inventory no-read marker',(s,p)=>repinOutcome(s,p,'inventory',v=>{delete v.googlePageReads;})],
 ['missing binding no-read marker',(s,p)=>repinOutcome(s,p,'binding',v=>{delete v.googlePageReads;})],
 ['contradictory binding page read',(s,p)=>repinOutcome(s,p,'binding',v=>{v.googlePageReads=1;})]
])test(`${label} is rejected before new holder write`,async()=>{const s=await alignmentFixture(),p=alignment(s);mutate(s,p);let called=0;await assert.rejects(holder(s).withContinuation(()=>{called++;}),/TRIAL_STOPPED/);assert.equal(called,0);assert.equal(existsSync(s.path+'.simple-publisher-alignment.json'),false);});

const contract={source:'approved-publisher-alignment105',decisionHash:PUBLISHER_ALIGNMENT_DECISION,startingSpent:105,maximumFirstStageSpent:111,operationBudget:296,ordinaryUiLimit:148,maximumPreparationPrimitives:6,completeActualMapProven:false,browserProfile:'profile-b',browserId:'chosen',settingsTabId:'settings-tab',audienceTabId:'audience-tab',settingsURL:'https://synthetic.invalid/settings',audienceURL:'https://synthetic.invalid/audience',publisherHash:'a'.repeat(64)};
const snapshot=JSON.stringify({source:'rebalanced-readonly-grounding',urlMatched:true,accountVerified:true,fieldsRead:false,ready:'COMPLETE',section:'MATCHED',reason:'VERIFIED',phase:'COMPLETE',cryptoAvailable:true,encoderAvailable:true,controls:[]});
function flowFixture(s,failAt,overrides={}){const calls=[],retained={},projectReady=()=>{},approved={...contract,...overrides.contract};
 const api={getBrowser:async({id})=>{calls.push('binding');assert.equal(id,approved.browserId);if(failAt==='binding')throw Error('PRIVATE');return {browserId:overrides.returnedBrowserId??id,nameSession:async name=>{calls.push('name');assert.equal(name,'🔎 CMWebs C3');if(failAt==='name')throw Error('PRIVATE');},user:{claimTab:async tabId=>{const step=tabId===approved.settingsTabId?'settings-claim':'audience-claim';calls.push(step);if(failAt===step)throw Error('PRIVATE');return {id:tabId,playwright:{evaluate:async(fn,args)=>{const projectionStep=tabId===approved.settingsTabId?'settings-project':'audience-project';calls.push(projectionStep);assert.equal(fn,projectReady);assert.equal(args.expectedURL,tabId===approved.settingsTabId?approved.settingsURL:approved.audienceURL);assert.equal(args.publisherHash,approved.publisherHash);if(failAt===projectionStep)throw Error('PRIVATE');return overrides.snapshot??snapshot;}}};}}};}};
 return {calls,retained,flow:createAuthorityPublisherAlignmentFlow({contract:approved,guard:()=>{},createOwner:({assertStage})=>holder(s,{},assertStage),api,projectReady,retained})};}

test('publisher six-step flow prepays and pauses at111 with stable handles',async()=>{
 const s=await alignmentFixture(),{flow,calls,retained}=flowFixture(s);assert.deepEqual(calls,[]);const r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111',JSON.stringify({phase:r.failurePhase,calls}));assert.deepEqual(calls,['binding','name','settings-claim','settings-project','audience-claim','audience-project']);assert.equal(r.report.combinedSpent,111);assert.equal(r.report.uiSpent,58);assert.equal(r.report.publisherUsed,6);assert.equal(r.report.settingsVerified,true);assert.equal(r.report.audienceVerified,true);assert.equal(r.handoff.minimumEvents,55);assert.equal(s.aligned().w0,null);assert.equal(s.aligned().pending,null);assert.equal(retained.settings.id,contract.settingsTabId);assert.equal(retained.audience.id,contract.audienceTabId);assert.equal(r.completeActualMapProven,false);await assert.rejects(flow.run());
});

test('verified ASCII digest fallback remains eligible for both page projections',async()=>{
 const s=await alignmentFixture(),fallback=JSON.stringify({...JSON.parse(snapshot),cryptoAvailable:false,encoderAvailable:false}),{flow,calls}=flowFixture(s,null,{snapshot:fallback});
 const r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');assert.deepEqual(calls,['binding','name','settings-claim','settings-project','audience-claim','audience-project']);assert.equal(s.aligned().publisherAlignment.settingsVerified,true);assert.equal(s.aligned().publisherAlignment.audienceVerified,true);
});

test('a failed publisher method settles its prepaid debit and closes the holder',async()=>{
 const s=await alignmentFixture(),{flow,calls}=flowFixture(s,'name');const r=await flow.run();assert.equal(r.status,'HARD_STOP');assert.deepEqual(calls,['binding','name']);assert.equal(s.aligned().pending,null);assert.equal(s.aligned().events.length,51);assert.equal(s.aligned().events.at(-1).success,false);assert.equal(s.aligned().events.at(-1).settled,true);assert.equal(r.drain.ownedScope.state,'SETTLED');assert(!JSON.stringify(r).includes('PRIVATE'));await assert.rejects(flow.run());
});

test('rejecting drain is reported unresolved and cannot replay',async()=>{let runs=0,drains=0;const retained={},flow=createAuthorityPublisherAlignmentFlow({contract,guard:()=>{},createOwner:()=>({withContinuation:async()=>{runs++;throw Error('PRIVATE_TRANSPORT');},stopAndDrain:async()=>{drains++;throw Error('PRIVATE_DRAIN');}}),api:{getBrowser:async()=>{throw Error('UNREACHABLE');}},projectReady:()=>{},retained});const r=await flow.run();assert.equal(r.status,'DRAIN_UNRESOLVED');assert.equal(r.settled,false);assert.equal(r.drain,null);assert.equal(r.trialAccepted,false);assert.equal(runs,1);assert.equal(drains,1);assert(!JSON.stringify(r).includes('PRIVATE'));await assert.rejects(flow.run());assert.equal(runs,1);assert.equal(drains,1);});

for(const [step,count] of [['binding',1],['name',2],['settings-claim',3],['settings-project',4],['audience-claim',5],['audience-project',6]])test(`${step} rejection settles and stops without replay`,async()=>{const s=await alignmentFixture(),{flow,calls}=flowFixture(s,step);const r=await flow.run();assert.equal(r.status,'HARD_STOP');assert.equal(calls.length,count);assert.equal(s.aligned().events.length,49+count);assert.equal(s.aligned().events.at(-1).settled,true);assert.equal(s.aligned().events.at(-1).success,false);assert.equal(s.aligned().pending,null);assert.equal(s.aligned().w0,null);assert.equal(r.drain.ownedScope.state,'SETTLED');await assert.rejects(flow.run());});

test('publisher stage reserves future UI and rejects a stage over its cap',async()=>{
 const s=await alignmentFixture(),{flow}=flowFixture(s),r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');
 const map=i=>({lane:'ui',descriptor:{id:`future-baseline-${i}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true},tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:`callback-${i}`,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null});
 s.time+=1000;const accepted=holder(s,{resume:r.handoff});await accepted.withContinuation(async cap=>{const stage=await cap.stagePublisher({stage:'baseline',stageCap:6,map:Array.from({length:6},(_,i)=>map(i))});assert.equal(stage.futureUiSpent,0);assert.equal(stage.uiOrdinaryLimit,148);});assert.equal(s.aligned().publisherStages[0].stageCap,6);assert.equal(s.aligned().futureOrdinaryUi,84);
});

test('unknown future map does not admit a call or RPC',async()=>{const s=await alignmentFixture(),{flow}=flowFixture(s),r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');s.time+=1000;let calls=0;const a=holder(s,{resume:r.handoff});await assert.rejects(a.withContinuation(async cap=>{await cap.dispatchCompatibility({operation:{id:'synthetic-rpc'},credentialExpiresAt:s.time+600000},()=>{calls++;});}),/TRIAL_STOPPED/);assert.equal(calls,0);});

test('a seven-call baseline map is refused before its first callback',async()=>{const s=await alignmentFixture(),{flow}=flowFixture(s),r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');s.time+=1000;let calls=0;const map=Array.from({length:7},(_,i)=>({lane:'ui',descriptor:{id:`future-over-${i}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true},tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:`callback-${i}`,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null}));await assert.rejects(holder(s,{resume:r.handoff}).withContinuation(async cap=>{await cap.stagePublisher({stage:'baseline',stageCap:7,map});calls++;}),/TRIAL_STOPPED/);assert.equal(calls,0);assert.equal(s.aligned().events.length,55);});

for(const [label,overrides,count] of [
 ['wrong profile',{contract:{browserProfile:'wrong'}},0],
 ['wrong browser handle',{returnedBrowserId:'wrong'},1],
 ['wrong URL',{snapshot:JSON.stringify({...JSON.parse(snapshot),urlMatched:false})},4],
 ['wrong principal',{snapshot:JSON.stringify({...JSON.parse(snapshot),accountVerified:false})},4],
 ['unexpected controls',{snapshot:JSON.stringify({...JSON.parse(snapshot),controls:['unsafe']})},4],
 ['fields read',{snapshot:JSON.stringify({...JSON.parse(snapshot),fieldsRead:true})},4]
])test(`${label} fails closed with no uncharged replay`,async()=>{const s=await alignmentFixture(),{flow,calls,retained}=flowFixture(s,null,overrides);const r=await flow.run();assert.equal(r.status,'HARD_STOP');assert.equal(calls.length,count);assert.equal(s.aligned().pending,null);assert.equal(s.aligned().w0,null);assert.equal(retained.browser,null);await assert.rejects(flow.run());});
