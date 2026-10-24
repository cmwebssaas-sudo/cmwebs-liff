import assert from 'node:assert/strict';
import test from 'node:test';
import {PUBLISHER_ALIGNMENT_DECISION,createAuthorityPublisherAlignmentFlow} from '../scripts/read-authority-publisher-alignment.mjs';
import {alignmentFixture,holder,alignment,changePin} from './fixtures/read-authority/publisher-alignment.mjs';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {hash,compact} from './fixtures/read-authority/rebalanced.mjs';
import {sharedFixture} from './fixtures/read-authority/project-shared.mjs';
import {projection} from '../scripts/read-authority-project-retarget.mjs';
import {SIMPLE_RULES,SIMPLE_NATIVE,simpleBrowser} from '../scripts/read-authority-simple-plan.mjs';

async function nativeSuccessorFixture(finalSpent=128){
 const s=await alignmentFixture(),{flow}=flowFixture(s,null,{snapshots:{'thin-settings':snapshot,'oauth-audience':JSON.stringify({...JSON.parse(snapshot),accountVerified:false})}});
 const stopped=await flow.run();assert.equal(stopped.status,'HARD_STOP');assert.equal(s.aligned().events.length,55);
 const make=(name,value)=>{const path=join(s.home,'native15-'+name+'.json');s.put(path,typeof value==='string'||Buffer.isBuffer(value)?value:compact(value));return {path,sha256:hash(readFileSync(path))};};
 const old=s.path+'.simple-publisher-alignment',live={journal:old+'.json',claim:old+'-claim.json',stop:old+'-stop.json',registry:join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-rebalanced.json')};
 const origin=Object.fromEntries(Object.entries(live).map(([k,path])=>[k,make('origin-'+k,readFileSync(path))]));
 origin.receipt=make('origin-receipt',{source:'synthetic-111-receipt',spent:111,settled:true});origin.audit=make('origin-audit',{source:'synthetic-111-audit',mainSpent:53,uiSpent:58,allSettled:true});
 const currentBrowserId='current-browser',currentTabId='current-tab',contractPin=make('contract',contract),context=make('context',{source:'native-current-project-context-v1',publisherHash:contract.publisherHash,browserId:currentBrowserId,tabId:currentTabId,url:contract.audienceURL,projectHash:'b'.repeat(64)}),approval=make('approval',{source:'direct-human-connection118-continuation',directHuman:true,approved:true,scope:'CONNECTION118_BOUNDED_NATIVE',startingSpent:118,maximumAdditionalPrimitives:13,operationBudget:296}),validatorSource=make('validator-source','synthetic-reviewed-verifier'),sourceReview=make('source-review',{source:'synthetic-reviewed-source',approved:true}),ci=make('ci',{source:'synthetic-ci',passed:true});
 const charges=[];let priorOutcomeSha256=origin.journal.sha256;
 const stages=['diagnostic111','diagnostic111','diagnostic111','audience114','audience114','audience114','native117','discovery118','BIND','OPEN_TABS','CLAIM','GUARD','CAPTURE','GUARD','GUARD','CAPTURE','GUARD','GUARD','CAPTURE','GUARD'];
 for(let spent=112;spent<=finalSpent;spent++){
  const n=spent-111,stage=stages[n-1],nonce=n<=6?null:hash('nonce-'+n).slice(0,32),commandSha256=n<=6?null:hash('command-'+n),reservationAt=n>=9?s.time/1000+n:null,outcome=[114,117].includes(spent)?'VERIFICATION_REJECTED':spent===118?'REJECTED':'VERIFIED',reservation=make('reservation-'+n,{source:'synthetic-reservation',spent,stage,...(nonce?{nonce,commandSha256}:{}),priorOutcomeSha256,...(reservationAt?{reserveTime:reservationAt}:{})}),settlement=make('settlement-'+n,{source:'synthetic-settlement',spent,stage,...(nonce?{nonce,commandSha256}:{}),reservationSha256:reservation.sha256,settled:true,pending:null,outcome});
  charges.push({spent,stage,nonce,commandSha256,priorOutcomeSha256,reservation,settlement,outcome,reservationAt,providerCallAt:null});priorOutcomeSha256=settlement.sha256;
 }
 const beforeGuard=make('before-guard',{source:'synthetic-guard',urlMatched:true,ready:true,projectMatched:true}),screenshot=make('screenshot','synthetic-image-bytes'),afterGuard=make('after-guard',{source:'synthetic-guard',urlMatched:true,ready:true,projectMatched:true});
 const attestation=make('attestation',{source:'parent-native-b-visual-attestation-v1',observedPrincipalHash:contract.publisherHash,expectedPrincipalHash:contract.publisherHash,browserId:currentBrowserId,tabId:currentTabId,url:contract.audienceURL,projectHash:'b'.repeat(64),screenshotSha256:screenshot.sha256,beforeGuardSha256:beforeGuard.sha256,afterGuardSha256:afterGuard.sha256,sameHandle:true,samePage:true,menuOpen:true,manualObservation:true});
 const faultSource=make('fault-source',{source:'audience114-actual-three-read-structure-closure',originalGlobalRepairCallsUsed:6,originalGlobalRepairCallsRemaining:0}),faultHighwaters={globalRepairCallsUsed:6,globalRepairCallsRemaining:0,readonlyIncidents:2,importedFailedCalls:3};
 const closure=make('closure',{source:'publisher-native-successor-closure-v1',origin,contract:contractPin,context,approval,validatorSource,sourceReview,ci,faultSource,faultHighwaters,charges,visual:{beforeGuard,screenshot,afterGuard,attestation},finalSpent,mainSpent:53,uiSpent:finalSpent-53,operationBudget:296,pending:null,allSettled:true});
 alignment(s).nativeSuccessor={closure};s.cfg.resume={nativeSuccessor:true};s.time+=1000;
 return {s,closure,origin,charges,attestation,live};
}

const fullFixedPlan=()=>Object.entries(SIMPLE_RULES).map(([key,rule])=>({id:'native-plan-'+key.replace(':','.'),bucket:key[0],alias:key.slice(2),actor:rule.actor,target:rule.target,operation:rule.methods[0],units:1}));
const nativePlanRows=()=>SIMPLE_NATIVE.map((key,index)=>{const rule=SIMPLE_RULES[key],writing=rule.methods.some(method=>['click','fill'].includes(method));return {id:`future-native-${index}`,key,actor:rule.actor,target:rule.target,operation:writing?rule.methods[0]:'snapshot',units:1,preparation:false};});
const recoveryPlanRows=()=>Object.entries(SIMPLE_RULES).filter(([key,rule])=>(key.startsWith('I:')||key.startsWith('J:'))&&!rule.methods.some(method=>['POST','PUT','PATCH','DELETE'].includes(method))).map(([key,rule],index)=>({id:`native-recovery-${index}`,key,actor:rule.actor,target:rule.target,operation:rule.methods.some(method=>['click','fill'].includes(method))?rule.methods[0]:'snapshot',units:1,preparation:false}));
const completeNativePlan=()=>({operations:fullFixedPlan().map(row=>['P:publisher-refresh','P:publisher-userinfo','B:fixture-import'].includes(row.bucket+':'+row.alias)?{...row,id:'future-'+row.alias}:row),browserOperations:[...nativePlanRows(),...Array.from({length:50},(_,index)=>({id:`future-navigation-${index}`,key:'N:navigation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:false})),...recoveryPlanRows()]});
const futureMeta=(descriptor,cleanup=[])=>({lane:'ui',descriptor,tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:descriptor.id,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup,repairIncident:null});

test('native write UI methods obey their declared rules in both parsers',()=>{
 const keys=['D:thin-gcp-link','D:thin-properties-write','E:client-create','E:oauth-response'];
 const rows=keys.map((key,index)=>({id:`future-method-${index}`,key,actor:SIMPLE_RULES[key].actor,target:SIMPLE_RULES[key].target,operation:'submit',units:1,preparation:false}));
 for(const row of rows){assert.throws(()=>simpleBrowser(row,false,true),/SIMPLE_PLAN_UNVERIFIED/);for(const method of SIMPLE_RULES[row.key].methods)assert.deepEqual(simpleBrowser({...row,operation:method},false,true).operation,method);}
 const readonly={id:'future-read-projection',key:'D:thin-properties-readback',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:false};
 assert.equal(simpleBrowser(readonly,false,true).operation,'snapshot');
 const code=`import runpy,json\nf=runpy.run_path('scripts/read-authority-simple-budget.py')['descriptor']\nrows=json.loads(${JSON.stringify(JSON.stringify([...rows,...rows.flatMap(row=>SIMPLE_RULES[row.key].methods.map(method=>({...row,operation:method})),readonly)]))})\nout=[]\nfor row in rows:\n try:f(row,'ui');out.append(True)\n except Exception as error:out.append(False if str(error)=='TRIAL_STOPPED' else str(error))\nprint(json.dumps(out))`;
 const result=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const parsed=JSON.parse(result.stdout);assert.deepEqual(parsed.slice(0,rows.length),rows.map(()=>false));assert.deepEqual(parsed.slice(rows.length),parsed.slice(rows.length).map(()=>true));
});

test('full native plan requires an admitted exact publisher main stage before each debit',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),plan=completeNativePlan(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 const main=key=>plan.operations.find(row=>row.bucket+':'+row.alias===key),refresh=main('P:publisher-refresh'),userinfo=main('P:publisher-userinfo'),write=main('B:fixture-import');let calls=0;
 await assert.rejects(owner.withContinuation(async cap=>{await cap.completePlan(plan);await cap.externalRead(()=>{calls++;},refresh);}),/TRIAL_STOPPED/);
 let j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));assert.equal(calls,0);assert.equal(j.events.length,55);assert.equal(j.pending,null);assert.equal(j.w0,null);
 const next=await nativeSuccessorFixture(),second=holder(next.s,{resume:{nativeSuccessor:true}},()=>{},()=>next.closure.sha256);let stagedW0,stagedMain;
 await assert.rejects(second.withContinuation(async cap=>{
  await cap.completePlan(plan);
  const cleanup=main('I:remove-reader');
  const map=[...plan.browserOperations.slice(21,27).map(row=>futureMeta(row)),{...futureMeta(refresh,[{lane:'main',descriptor:cleanup,target:cleanup.target,tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:cleanup.id,receipt:'EXACT_WRITE_READBACK'}]),lane:'main',receipt:'EXACT_WRITE_READBACK'}, {...futureMeta(userinfo),lane:'main'}];
  await cap.stagePublisher({stage:'baseline',stageCap:6,map});
  assert.equal(await cap.externalRead(()=>{calls++;return 'SYNTHETIC';},refresh),'SYNTHETIC');
  assert.equal(await cap.externalRead(()=>{calls++;return 'SYNTHETIC';},userinfo),'SYNTHETIC');
  const before=await cap.inspect();stagedW0=before.w0;stagedMain=before.mainSpent;
  await cap.externalRead(()=>{calls++;},write);
 }),/TRIAL_STOPPED/);
 j=JSON.parse(readFileSync(next.s.path+'.simple-publisher-native-successor.json'));assert.equal(calls,2);assert.equal(j.events.length,57);assert.equal(j.pending,null);assert(j.w0>0);assert.equal(j.w0,stagedW0);assert.equal(j.events.filter(event=>event.lane==='main').length,2);assert.equal(stagedMain,55);
});

test('first complete native publisher plan registers from the settled 128 bootstrap',async()=>{
 const {s,closure,origin}=await nativeSuccessorFixture(),old=readFileSync(origin.journal.path);
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 await owner.withContinuation(async cap=>{
  const before=await cap.inspect();assert.equal(before.planReady,false);assert.equal(before.pending,null);assert.equal(before.futureUiSpent,0);
  const plan=completeNativePlan(),registered=await cap.completePlan(plan);
  assert.equal(registered.planReady,true);assert.equal(registered.futureUiSpent,0);assert.equal(registered.rpc.beganAt,null);assert.equal(registered.w0,null);
  const main=plan.operations.find(row=>row.id==='future-publisher-userinfo');
  const staged=await cap.stagePublisher({stage:'baseline',stageCap:6,map:[...plan.browserOperations.slice(21,27).map(row=>futureMeta(row)),{lane:'main',descriptor:main,tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:main.id,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null}]});
  assert.equal(staged.planReady,true);assert.equal(staged.publisherUsed,6);assert.equal(staged.w0,null);
 });
 assert.equal(s.aligned().plan,null);assert(readFileSync(origin.journal.path).equals(old));
});

test('native publisher view exposes real staged trial readiness before full plan',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 await owner.withContinuation(async cap=>{
  const first=await cap.inspect();assert.equal(first.planReady,false);assert.equal(first.trialMapReady,false);
  const map=Array.from({length:6},(_,index)=>futureMeta({id:`future-baseline-${index}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true}));
  const rule=SIMPLE_RULES['I:verify-token-revoked'];map[0].cleanup=[{lane:'ui',descriptor:{id:'native-recovery-gate',key:'I:verify-token-revoked',actor:rule.actor,target:rule.target,operation:'snapshot',units:1,preparation:false},target:rule.target,tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:'native-recovery-gate',receipt:'SANITIZED_READ'}];
  const p=SIMPLE_RULES['P:publisher-userinfo'];map.push({lane:'main',descriptor:{id:'future-publisher-userinfo',bucket:'P',alias:'publisher-userinfo',actor:p.actor,target:p.target,operation:p.methods[0],units:1},tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:'future-publisher-userinfo',receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null});
  const staged=await cap.stagePublisher({stage:'baseline',stageCap:6,map});assert.equal(staged.trialMapReady,true);assert.equal(staged.planReady,false);assert.equal(staged.pending,null);assert.equal(staged.w0,null);assert.equal(staged.eventCount,55);
 });
});

test('native first plan refuses a missing native alias before any trial debit',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256),plan=completeNativePlan();
 plan.browserOperations=plan.browserOperations.filter(row=>row.key!==SIMPLE_NATIVE[0]);
 await assert.rejects(owner.withContinuation(cap=>cap.completePlan(plan)),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.equal(j.plan,null);assert.equal(j.events.length,55);assert.equal(j.pending,null);assert.equal(j.w0,null);
});

test('native first plan cannot be registered twice',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256),plan=completeNativePlan();
 await assert.rejects(owner.withContinuation(async cap=>{await cap.completePlan(plan);await cap.completePlan(plan);}),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.deepEqual(j.plan,plan);assert.equal(j.events.length,55);assert.equal(j.pending,null);assert.equal(j.w0,null);
});

test('native plan rejects a later publisher stage with an unmapped UI row',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256),plan=completeNativePlan();
 const map=plan.browserOperations.slice(21,27).map(row=>futureMeta(row));map[5].descriptor={...map[5].descriptor,id:'future-unmapped-row'};map[5].callback='future-unmapped-row';
 await assert.rejects(owner.withContinuation(async cap=>{await cap.completePlan(plan);await cap.stagePublisher({stage:'baseline',stageCap:6,map});}),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.deepEqual(j.plan,plan);assert.deepEqual(j.publisherStages,[]);assert.equal(j.events.length,55);assert.equal(j.pending,null);assert.equal(j.w0,null);
});

test('native successor blocks RPC before complete plan without invoking IO',async()=>{
 const {s,closure}=await nativeSuccessorFixture(),owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256),operation=fullFixedPlan().find(row=>row.bucket==='H');let calls=0;
 await assert.rejects(owner.withContinuation(cap=>cap.dispatchCompatibility({operation,credentialExpiresAt:s.time+600000},()=>{calls++;})),/TRIAL_STOPPED/);
 const j=JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json'));
 assert.equal(calls,0);assert.equal(j.plan,null);assert.equal(j.rpc.beganAt,null);assert.equal(j.events.length,55);assert.equal(j.w0,null);
});

test('settled B visual chain imports once into a new PREP successor while original 111 stays false',async()=>{
 const {s,closure,live,origin}=await nativeSuccessorFixture(),before=Object.fromEntries(Object.entries(live).filter(([k])=>k!=='registry').map(([,path])=>[path,readFileSync(path)])),frozenRegistry=readFileSync(origin.registry.path);let calls=0;
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>{calls++;return closure.sha256;});
 const view=await owner.withContinuation(cap=>cap.inspect());
 assert.equal(view.combinedSpent,128);assert.equal(view.mainSpent,53);assert.equal(view.uiSpent,75);assert.equal(view.eventCount,55);assert.equal(view.successorImported,17);assert.equal(view.futureUiLimit,73);assert.equal(view.audienceVerified,false);assert.equal(view.currentVisualVerified,true);assert.equal(view.w0,null);assert.equal(view.pending,null);assert(calls>0);
 assert.equal(s.aligned().publisherAlignment.audienceVerified,false);assert.equal(view.repairCalls,6);assert.equal(view.readonlyIncidents,2);assert.equal(s.aligned().failures+3,JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json')).failures);assert(readFileSync(origin.registry.path).equals(frozenRegistry));
 for(const [path,bytes]of Object.entries(before))assert(readFileSync(path).equals(bytes),path);
});

test('native successor admission rejects A-only, gaps, duplicate nonces, pending settlement and exhausted fault reset before any write',async()=>{
 const {s,closure,live}=await nativeSuccessorFixture(),original=readFileSync(closure.path),registry=readFileSync(live.registry),base=JSON.parse(original),originalAttestation=readFileSync(base.visual.attestation.path),originalContext=readFileSync(base.context.path),cases=[
  ['closed menu',v=>{changePin(s,v.visual.attestation,a=>{a.menuOpen=false;});}],
  ['charge gap',v=>{v.charges[8].spent=121;}],
  ['duplicate nonce',v=>{v.charges[9].nonce=v.charges[8].nonce;}],
  ['pending',v=>{v.pending={spent:128};}],
  ['repair refund',v=>{v.faultHighwaters.globalRepairCallsUsed=0;}],
  ['wrong current URL',v=>{changePin(s,v.context,c=>{c.url='https://synthetic.invalid/wrong';});changePin(s,v.visual.attestation,a=>{a.url='https://synthetic.invalid/wrong';});}],
 ];
 for(const [label,mutate] of cases){
  changePin(s,closure,mutate);
  const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
  await assert.rejects(owner.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/,label);
  assert.equal(existsSync(s.path+'.simple-publisher-native-successor.json'),false,label);
  assert(readFileSync(live.registry).equals(registry),label);
  s.put(base.visual.attestation.path,originalAttestation);s.put(base.context.path,originalContext);
  s.put(closure.path,original);closure.sha256=hash(original);
 }
 const raw=readFileSync(closure.path);s.put(closure.path,Buffer.concat([raw,Buffer.from(' ')]));
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 await assert.rejects(owner.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/);
 assert(readFileSync(live.registry).equals(registry));
 s.put(closure.path,original);s.put(live.journal,compact({source:'rewritten-historical-111'}));
 const rewritten=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 await assert.rejects(rewritten.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/);
 assert.equal(existsSync(s.path+'.simple-publisher-native-successor.json'),false);
 assert(readFileSync(live.registry).equals(registry));
});

test('native successor requires the parent proof callback and rejects a false pin before spawn',async()=>{
 const {s,closure,live}=await nativeSuccessorFixture(),registry=readFileSync(live.registry);
 assert.throws(()=>holder(s,{resume:{nativeSuccessor:true}}),/TRIAL_STOPPED|READ_FAILED/);
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>('0'.repeat(64)));
 await assert.rejects(owner.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/);
 assert.equal(existsSync(s.path+'.simple-publisher-native-successor.json'),false);
 assert(readFileSync(live.registry).equals(registry));
 assert.equal(closure.sha256.length,64);
});

test('native proof drift closes ordinary continuation before another debit',async()=>{
 const {s,closure}=await nativeSuccessorFixture();let calls=0;
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>++calls===1?closure.sha256:'0'.repeat(64));
 await assert.rejects(owner.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/);
 assert(calls>=2);assert.equal(JSON.parse(readFileSync(s.path+'.simple-publisher-native-successor.json')).events.length,55);
});

test('native endpoint 131 preserves seventy future calls and refuses a second owner',async()=>{
 const {s,closure,origin}=await nativeSuccessorFixture(131),map=Array.from({length:6},(_,i)=>({lane:'ui',descriptor:{id:`future-native-baseline-${i}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,preparation:true},tabId:'current-tab',url:'https://synthetic.invalid/settings',callback:`callback-${i}`,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null}));
 const owner=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 const view=await owner.withContinuation(async cap=>{const admitted=await cap.stagePublisher({stage:'baseline',stageCap:6,map});assert.equal(admitted.futureUiSpent,0);return cap.inspect();});
 assert.equal(view.combinedSpent,131);assert.equal(view.successorImported,20);assert.equal(view.futureUiLimit,70);assert.equal(view.futureUiSpent,0);assert.equal(view.w0,null);assert.equal(view.pending,null);
 assert.equal(JSON.parse(readFileSync(origin.journal.path)).publisherAlignment.audienceVerified,false);
 const second=holder(s,{resume:{nativeSuccessor:true}},()=>{},()=>closure.sha256);
 await assert.rejects(second.withContinuation(cap=>cap.inspect()),/TRIAL_STOPPED|READ_FAILED/);
});

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
function flowFixture(s,failAt,overrides={}){const calls=[],retained={},owners=[],projectReady=()=>{},approved={...contract,...overrides.contract};
 const api={getBrowser:async({id})=>{calls.push('binding');assert.equal(id,approved.browserId);if(failAt==='binding')throw Error('PRIVATE');return {browserId:overrides.returnedBrowserId??id,nameSession:async name=>{calls.push('name');assert.equal(name,'🔎 CMWebs C3');if(failAt==='name')throw Error('PRIVATE');},user:{claimTab:async tabId=>{const step=tabId===approved.settingsTabId?'settings-claim':'audience-claim';calls.push(step);if(failAt===step)throw Error('PRIVATE');return {id:tabId,playwright:{evaluate:async(fn,args)=>{const projectionStep=tabId===approved.settingsTabId?'settings-project':'audience-project';calls.push(projectionStep);assert.equal(fn,projectReady);assert.equal(args.expectedURL,tabId===approved.settingsTabId?approved.settingsURL:approved.audienceURL);assert.equal(args.publisherHash,approved.publisherHash);if(failAt===projectionStep)throw Error('PRIVATE');return overrides.snapshots?.[args.target]??overrides.snapshot??snapshot;}}};}}};}};
 return {calls,retained,owners,flow:createAuthorityPublisherAlignmentFlow({contract:approved,guard:()=>{},createOwner:({assertStage})=>{const owner=holder(s,{},assertStage);owners.push(owner);return owner;},api,projectReady,retained})};}

test('publisher six-step flow prepays and pauses at111 with stable handles',async()=>{
 const s=await alignmentFixture(),{flow,calls,retained}=flowFixture(s);assert.deepEqual(calls,[]);const r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111',JSON.stringify({phase:r.failurePhase,calls}));assert.deepEqual(calls,['binding','name','settings-claim','settings-project','audience-claim','audience-project']);assert.equal(r.report.combinedSpent,111);assert.equal(r.report.uiSpent,58);assert.equal(r.report.publisherUsed,6);assert.equal(r.report.settingsVerified,true);assert.equal(r.report.audienceVerified,true);assert.equal(r.handoff.minimumEvents,55);assert.equal(s.aligned().w0,null);assert.equal(s.aligned().pending,null);assert.equal(retained.settings.id,contract.settingsTabId);assert.equal(retained.audience.id,contract.audienceTabId);assert.equal(r.completeActualMapProven,false);await assert.rejects(flow.run());
});

const control=(label)=>({label,tag:'BUTTON',role:'button',disabled:false});
test('target-aware decoder accepts nonempty settings and Audience controls while legacy default stays settings-only',()=>{
 const settings=JSON.stringify({...JSON.parse(snapshot),controls:[control('Change project')]});
 const audience=JSON.stringify({...JSON.parse(snapshot),controls:['新增使用者','Add users','發布應用程式','Publish app','儲存','Save','取消','Cancel','確定','Confirm'].map(control)});
 assert.equal(projection(settings).controls.length,1);
 assert.equal(projection(settings,'thin-settings').controls.length,1);
 assert.equal(projection(audience,'oauth-audience').controls.length,10);
 assert.throws(()=>projection(audience),/PROJECT_RETARGET_STOPPED/);
 assert.throws(()=>projection(audience,'thin-settings'),/PROJECT_RETARGET_STOPPED/);
 assert.throws(()=>projection(settings,'oauth-audience'),/PROJECT_RETARGET_STOPPED/);
 assert.throws(()=>projection(audience,'other-target'),/PROJECT_RETARGET_STOPPED/);
});

test('publisher flow accepts genuine nonempty controls on each known target',async()=>{
 const s=await alignmentFixture(),{flow,calls}=flowFixture(s,null,{snapshots:{'thin-settings':JSON.stringify({...JSON.parse(snapshot),controls:[control('變更專案')]}),'oauth-audience':JSON.stringify({...JSON.parse(snapshot),controls:[control('新增使用者'),control('發布應用程式')]})}});
 const r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');assert.equal(r.report.audienceVerified,true);assert.equal(r.report.settingsVerified,true);assert.equal(r.failureEvidence,undefined);assert.equal(calls.length,6);
});

test('decoder rejects malformed control members and fieldsRead on both targets',()=>{
 for(const target of ['thin-settings','oauth-audience'])for(const controls of [[{...control(target==='thin-settings'?'Change project':'Add users'),tag:'SCRIPT'}],[{...control(target==='thin-settings'?'Change project':'Add users'),role:'link'}],[{...control(target==='thin-settings'?'Change project':'Add users'),disabled:'false'}],[{...control(target==='thin-settings'?'Change project':'Add users'),extra:'PRIVATE'}]])assert.throws(()=>projection(JSON.stringify({...JSON.parse(snapshot),controls}),target),/PROJECT_RETARGET_STOPPED/);
 for(const target of ['thin-settings','oauth-audience'])assert.throws(()=>projection(JSON.stringify({...JSON.parse(snapshot),fieldsRead:true}),target),/PROJECT_RETARGET_STOPPED/);
});

test('publisher failure evidence separates no safe callback return, shape rejection and verification rejection',async()=>{
 const cases=[
  {failAt:'audience-project',overrides:{},kind:'CALLBACK_NOT_RETURNED',callbackReturned:false,decoded:false,count:null},
  {failAt:null,overrides:{snapshots:{'oauth-audience':JSON.stringify({...JSON.parse(snapshot),controls:[control('Change project')]})}},kind:'DECODE_SHAPE_REJECTED',callbackReturned:true,decoded:false,count:null},
  {failAt:null,overrides:{snapshots:{'oauth-audience':JSON.stringify({...JSON.parse(snapshot),urlMatched:false,controls:[control('Add users')]})}},kind:'VERIFICATION_REJECTED',callbackReturned:true,decoded:true,count:1}
 ];
 for(const x of cases){const s=await alignmentFixture(),{flow,calls}=flowFixture(s,x.failAt,x.overrides),r=await flow.run();assert.equal(r.status,'HARD_STOP');assert.equal(r.failurePhase,'AUDIENCE-PROJECT');assert.deepEqual(r.failureEvidence,{target:'oauth-audience',stage:'AUDIENCE-PROJECT',kind:x.kind,callbackReturned:x.callbackReturned,decoded:x.decoded,controlsCount:x.count});assert.equal(calls.length,6);assert.equal(s.aligned().events.at(-1).success,false);assert.equal(s.aligned().pending,null);assert.equal(s.aligned().w0,null);assert(!JSON.stringify(r).includes('PRIVATE'));assert(!JSON.stringify(r).includes(contract.audienceURL));assert(!JSON.stringify(r).includes('Change project'));await assert.rejects(flow.run());}
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

for(const method of ['snapshot','evaluate'])test(`admitted future ${method} prepays and settles its verified projection`,async()=>{
 const s=await alignmentFixture(),{flow}=flowFixture(s),first=await flow.run();assert.equal(first.status,'CLEAN_PAUSE111');s.time+=1000;
 const map=Array.from({length:6},(_,i)=>({lane:'ui',descriptor:{id:`future-baseline-${method}-${i}`,key:'N:preparation',actor:'publisher',target:'thin-settings',operation:method,units:1,preparation:true},tabId:'synthetic-tab',url:'https://synthetic.invalid/settings',callback:`callback-${i}`,receipt:'SANITIZED_READ',privacy:'NO_SECRET_VALUES',cleanup:[],repairIncident:null}));
 let callbacks=0;await holder(s,{resume:first.handoff},p=>{if(p.stage==='loading-result'){assert.equal(p.result.accountVerified,true);assert.equal(p.result.fieldsRead,false);}}).withContinuation(async cap=>{
  await cap.stagePublisher({stage:'baseline',stageCap:6,map});const value=await cap.browserRead(()=>{callbacks++;return JSON.parse(snapshot);},map[0].descriptor);assert.equal(value.accountVerified,true);const view=await cap.inspect();assert.equal(view.combinedSpent,112);assert.equal(view.pending,null);await cap.pausePreparation();
 });
 const j=s.aligned();assert.equal(callbacks,1);assert.equal(j.events.length,56);assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,true);assert.equal(j.events.at(-1).loadingResultVerified,true);
});

test('future projection settlement rejects absent or false verification before pending clears',()=>{
 const code=`import runpy,json
base=runpy.run_path('scripts/read-authority-simple-budget.py')['Ledger']
aligned=runpy.run_path('scripts/read-authority-publisher-alignment-budget.py')['alignment_class'](base)
out=[]
for method in ['snapshot','evaluate']:
 for flag in ['missing','false']:
  op={'id':'future-projection','operation':method,'preparation':True}
  event={'lane':'ui','operation':op,'settled':False}
  obj=object.__new__(aligned);obj.j={'publisherAlignment':{'used':6},'events':[event],'publisherStages':[{'stage':'baseline','map':[{'lane':'ui','descriptor':op,'repairIncident':None}]}],'pending':op['id']}
  obj.current=lambda:None;obj.now=lambda _:None
  q={'op':'settle','id':op['id'],'success':True,'now':1}
  if flag=='false':q['loadingResultVerified']=False
  try:obj.command(q);denied=False
  except Exception as error:denied=str(error)=='TRIAL_STOPPED'
  out.append([method,flag,denied,obj.j['pending']==op['id'],event['settled'] is False])
print(json.dumps(out))`;
 const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const rows=JSON.parse(r.stdout);assert.equal(rows.length,4);for(const row of rows)assert.deepEqual(row.slice(2),[true,true,true],JSON.stringify(row));
});

test('aligned cleanup opens after a closed 111 scope using durable event count',async()=>{
 const s=await alignmentFixture(),{flow,owners}=flowFixture(s),r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');assert.equal(r.report.combinedSpent,111);assert.equal(s.aligned().events.length,55);let entered=0;
 await owners[0].withCleanup(async cap=>{entered++;const view=await cap.inspect();assert.equal(view.combinedSpent,111);assert.equal(view.pending,null);});assert.equal(entered,1);
});

test('aligned cleanup rejects a coherent registry with the wrong event count',async()=>{
 const s=await alignmentFixture(),{flow,owners}=flowFixture(s),r=await flow.run();assert.equal(r.status,'CLEAN_PAUSE111');const path=join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-rebalanced.json');const wrapper=JSON.parse(readFileSync(path));wrapper.value.checkpoint.events.push({...wrapper.value.checkpoint.events.at(-1),operation:{...wrapper.value.checkpoint.events.at(-1).operation,id:'synthetic-extra'}});wrapper.sha256=hash(compact(wrapper.value));s.put(path,compact(wrapper));let entered=0;
 await assert.rejects(owners[0].withCleanup(()=>{entered++;}),/TRIAL_STOPPED/);assert.equal(entered,0);
});

test('old236 cleanup still uses its unchanged event count',async()=>{
 const s=await sharedFixture(),owner=holder(s);await owner.withContinuation(cap=>cap.inspect());let entered=0;await owner.withCleanup(async cap=>{entered++;const view=await cap.inspect();assert.equal(view.combinedSpent,101);assert.equal(Object.hasOwn(view,'eventCount'),false);});assert.equal(entered,1);
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
