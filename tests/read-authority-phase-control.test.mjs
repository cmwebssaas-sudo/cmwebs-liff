import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createAuthorityPreparationControl} from '../scripts/read-authority-preparation-control.mjs';
import {createAuthorityTrialOAuth} from '../scripts/read-authority-trial-oauth.mjs';
import {AUTHORITY_TRIAL_SCOPES} from '../scripts/read-authority-trial-driver.mjs';
const phase=await import('../scripts/read-authority-phase-control.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-phase-control.mjs'))return {};throw e;});
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-14T00:00:00Z'),binding='d'.repeat(64),defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function setup(){
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-phase-control-'));chmodSync(dir,0o700);const path=join(dir,'budget.json'),epoch='SYNTHETIC_PHASE_CONTROL_'+randomUUID();let time=clock;
 const raw=JSON.stringify({limit:160,spent:25,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40});writeFileSync(path,raw,{mode:0o600});
 const options={path,epoch,approvalHash:'a'.repeat(64),proposalHash:'b'.repeat(64),legacySha256:hash(raw),importedReads:25,expiresAt:clock+21600000,now:()=>time,pause:async ms=>{time+=ms;}};
 const control=createAuthorityPreparationControl(options),bridge=phase.createAuthorityPhaseControl?.(control)??{...control,withCleanup:(b,fn)=>control.withRuntime(b,fn)};
 return {dir,path,epoch,options,control,bridge,get:()=>JSON.parse(readFileSync(path)),setNow:v=>{time=v;},now:()=>time};
}
async function handoff(s,cap,spent){await cap.restoreOriginalEditor('restore-editor',async()=>{});await cap.restoreOriginalEditor('read-restored-editor',async()=>{});await cap.handoff({runtimeBinding:binding,expectedSpent:spent+2});}
async function prepare(s){await s.bridge.withPreparation(cap=>handoff(s,cap,25));}
async function oauthPrepare(s){
 const clientId='1234567890-synthetic.apps.googleusercontent.com',callerHash=hash('caller@example.invalid'),oauthClientHash=hash(clientId);let flow,revoke=0,exchange=0;
 await s.bridge.withPreparation(async cap=>{
  flow=createAuthorityTrialOAuth({path:join(s.dir,'oauth.json'),epoch:s.epoch,clientId,oauthClientHash,cloudProjectHash:'c'.repeat(64),callerHash,publisherHash:hash('publisher@example.invalid'),expiresAt:s.options.expiresAt,control:s.bridge.capability??cap,clientSecret:()=> 'SYNTHETIC_CLIENT_SECRET',now:s.now,
   clientReadback:{source:'google-native-ui',oauthClientHash,cloudProjectHash:'c'.repeat(64),redirectUri:'http://127.0.0.1:34763/oauth/callback',isolatedTrialProject:true},
   fetcher:async url=>{if(url.endsWith('/revoke')){revoke++;return new Response('');}if(url.endsWith('/token')){exchange++;return new Response(JSON.stringify({access_token:'SYNTHETIC_ACCESS_TOKEN',token_type:'Bearer',expires_in:3600,scope:AUTHORITY_TRIAL_SCOPES.join(' ')}));}return new Response(JSON.stringify({email:'caller@example.invalid',verified_email:true}));}});
  await flow.receive({method:'GET',host:'127.0.0.1:34763',url:'/oauth/callback?'+new URLSearchParams({state:new URL(flow.authorizationUrl).searchParams.get('state'),code:'SYNTHETIC_CODE'})});await handoff(s,cap,28);
 });return {flow,revoke:()=>revoke,exchange:()=>exchange};
}
test('the same prepared in-memory OAuth token can be used and revoked after canonical handoff',async()=>{
 const s=setup(),o=await oauthPrepare(s);await s.bridge.withRuntime(binding,async()=>{assert.equal(o.flow.credential().accessToken,'SYNTHETIC_ACCESS_TOKEN');});
 await s.bridge.withCleanup(binding,()=>o.flow.cancel());assert.equal(o.exchange(),1);assert.equal(o.revoke(),1);assert.equal(s.get().spent,31);assert.deepEqual(s.get().preparation.iActions,['revoke-token']);
 const receipt=readFileSync(join(s.dir,'oauth.json'),'utf8');assert(receipt.includes('ACK_UNVERIFIED'));assert(!receipt.includes('SYNTHETIC_ACCESS_TOKEN'));
});
test('phase facade construction is pure and has no legacy split wait/debit methods',()=>{
 const s=setup(),before=readFileSync(s.path);assert.equal(typeof phase.createAuthorityPhaseControl,'function');assert(Object.isFrozen(s.bridge));assert(Object.isFrozen(s.bridge.capability));assert.equal(s.bridge.capability.reserveExternalReads,undefined);assert.equal(s.bridge.capability.waitForExternalReadSlot,undefined);assert.deepEqual(readFileSync(s.path),before);
});
test('expired captured preparation capability cannot enter IO; facade outside activation also cannot debit',async()=>{
 const s=setup();let old,io=0;await s.control.withPreparation(async cap=>{old=cap;});await assert.rejects(old.cleanup('revoke-token',async()=>{io++;}),/TRIAL_STOPPED/);await assert.rejects(s.bridge.capability.cleanup('revoke-token',async()=>{io++;}),/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().spent,25);
});
test('a continuation from the old generation cannot borrow a later runtime activation',async()=>{
 const s=setup(),gate=defer();let late,io=0;await s.bridge.withPreparation(async cap=>{late=gate.promise.then(()=>cap.externalRead(async()=>{io++;}));void late.catch(()=>{});await handoff(s,cap,25);});
 await s.bridge.withRuntime(binding,async cap=>{gate.resolve();await assert.rejects(late,/TRIAL_STOPPED/);await cap.externalRead(async()=>{io++;});});assert.equal(io,1);assert.equal(s.get().spent,28);
});
test('caught wrong-phase operation still fails the active generation and preserves independent cleanup',async()=>{
 const s=setup();await prepare(s);let io=0;await assert.rejects(s.bridge.withRuntime(binding,async cap=>{await assert.rejects(cap.handoff({runtimeBinding:binding,expectedSpent:27}),/TRIAL_STOPPED/);await cap.cleanup('revoke-token',async()=>{io++;});}),/TRIAL_STOPPED/);assert.equal(io,1);assert.equal(s.get().spent,28);assert.equal(s.get().preparation.state,'stopped');
});
test('nested activation is rejected even when the callback swallows its failure',async()=>{
 const s=setup();await assert.rejects(s.bridge.withPreparation(async()=>{await assert.rejects(s.bridge.withPreparation(async()=>{}),/TRIAL_STOPPED/);}),/TRIAL_STOPPED/);assert.equal(s.get().spent,25);assert.equal(s.get().preparation.state,'stopped');
});
test('unawaited ordinary IO cannot start after the phase callback returns',async()=>{
 const s=setup();let io=0,op;await assert.rejects(s.bridge.withPreparation(cap=>{op=cap.externalRead(async()=>{io++;});}),/TRIAL_STOPPED/);await assert.rejects(op,/TRIAL_STOPPED/);assert.equal(io,0);assert.equal(s.get().preparation.state,'stopped');
});
test('already owned independent cleanup is drained even when the callback throws before awaiting it',async()=>{
 const s=setup();await prepare(s);let io=0,op;await assert.rejects(s.bridge.withRuntime(binding,cap=>{op=cap.cleanup('revoke-token',async()=>{io++;});throw Error('SYNTHETIC_CALLBACK_FAILURE');}),/TRIAL_STOPPED/);await op;assert.equal(io,1);assert.equal(s.get().spent,28);
});
test('a credential expiry auto-cancel drains one revoke without refreshing or replaying OAuth',async()=>{
 const s=setup(),o=await oauthPrepare(s);s.setNow(o.flow.credential().expiresAt-360000+1);await assert.rejects(s.bridge.withRuntime(binding,()=>o.flow.credential()),/TRIAL_STOPPED/);assert.equal(o.revoke(),1);assert.equal(o.exchange(),1);assert.equal(s.get().spent,31);assert.deepEqual(s.get().preparation.iActions,['revoke-token']);assert.equal(JSON.parse(readFileSync(join(s.dir,'oauth.json'))).value.revocation,'ACK_UNVERIFIED');
});
test('entered IO retains the original flock through callback failure and stop until terminal settlement',async()=>{
 const s=setup(),entered=defer(),release=defer();let op,io=0,finished=false;
 const running=s.bridge.withPreparation(async cap=>{op=cap.externalRead(async()=>{io++;entered.resolve();await release.promise;finished=true;});await entered.promise;throw Error('SYNTHETIC_FAILURE');});void running.catch(()=>{});await entered.promise;
 await assert.rejects(s.control.withPreparation(async()=>{}),/TRIAL_STOPPED/);assert.equal(finished,false);await s.bridge.requestStop();release.resolve();await assert.rejects(running,/TRIAL_STOPPED/);await op;assert.equal(finished,true);assert.equal(io,1);assert.equal(s.get().spent,26);
});
test('cleanup after partial stop ACK permits only independent cleanup, without ordinary debit',async()=>{
 const s=setup();await prepare(s);writeFileSync(s.path+'.preparation-stop.json','',{mode:0o600});let io=0;await s.bridge.withCleanup(binding,cap=>cap.cleanup('revoke-token',async()=>{io++;}));assert.equal(io,1);assert.equal(s.get().spent,28);assert.equal(readFileSync(s.path+'.preparation-stop.json').length,0);
 await assert.rejects(s.bridge.withCleanup(binding,cap=>cap.externalRead(async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,1);assert.equal(s.get().spent,28);
});
test('reserved cleanup stays available after expiry but never repeats an independent action',async()=>{
 const s=setup();await prepare(s);await s.bridge.withCleanup(binding,cap=>cap.cleanup('revoke-token',async()=>{}));await assert.rejects(s.bridge.withCleanup(binding,cap=>cap.cleanup('revoke-token',async()=>{})),/TRIAL_STOPPED/);assert.equal(s.get().spent,28);s.setNow(s.options.expiresAt);await s.bridge.withCleanup(binding,cap=>cap.cleanup('remove-reader',async()=>{}));assert.equal(s.get().spent,29);await assert.rejects(s.bridge.withRuntime(binding,cap=>cap.externalRead(async()=>{})),/TRIAL_STOPPED/);assert.equal(s.get().spent,29);
});

test('cleanup before handoff can drain a failed preparation without fabricating runtime binding',async()=>{
 const s=setup();let captured,io=0;await assert.rejects(s.bridge.withPreparation(async cap=>{captured=cap;await cap.externalRead(async()=>{});throw Error('SYNTHETIC_PREPARATION_FAILURE');}),/TRIAL_STOPPED/);
 await s.bridge.withPreparationCleanup(async()=>{await captured.restoreOriginalEditor('restore-editor',async()=>{io++;});await captured.restoreOriginalEditor('read-restored-editor',async()=>{io++;});await captured.cleanup('remove-reader',async()=>{io++;});});assert.equal(io,3);assert.equal(s.get().spent,29);assert.equal(s.get().preparation.version,1);
 await assert.rejects(s.bridge.withPreparationCleanup(cap=>cap.externalRead(async()=>{io++;})),/TRIAL_STOPPED/);assert.equal(io,3);assert.equal(s.get().spent,29);
});
test('a stale continuation cannot open a new phase or stop a later active generation by its rejected method',async()=>{
 const s=setup(),gate=defer();let late;await s.bridge.withPreparation(async cap=>{late=gate.promise.then(()=>s.bridge.withRuntime(binding,async()=>cap.externalRead(async()=>{})));void late.catch(()=>{});await handoff(s,cap,25);});
 await s.bridge.withRuntime(binding,async cap=>{gate.resolve();await assert.rejects(late,/TRIAL_STOPPED/);await cap.externalRead(async()=>{});});assert.equal(s.get().preparation.state,'ready');assert.equal(s.get().spent,28);
});
test('concurrent scopes fail the owned activation without releasing an entered IO handle',async()=>{
 const s=setup(),entered=defer(),release=defer();let done=false;const running=s.bridge.withPreparation(cap=>cap.externalRead(async()=>{entered.resolve();await release.promise;done=true;}));void running.catch(()=>{});await entered.promise;await assert.rejects(s.bridge.withPreparation(async()=>{}),/TRIAL_STOPPED/);assert.equal(done,false);release.resolve();await assert.rejects(running,/TRIAL_STOPPED/);assert.equal(done,true);assert.equal(s.get().spent,26);
});
test('ignored rejected facade operations fail closed without leaking an unhandled rejection',async()=>{
 const s=setup();await assert.rejects(s.bridge.withPreparation(cap=>{void cap.inspectRuntime();}),/TRIAL_STOPPED/);assert.equal(s.get().spent,25);assert.equal(s.get().preparation.state,'stopped');
});
