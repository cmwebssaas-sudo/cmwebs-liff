import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAuthorityTrialMetadataAdapters} from '../scripts/read-authority-trial-metadata.mjs';
import {verifyAuthorityTrialReadback} from '../scripts/read-authority-trial-driver.mjs';
const api=await import('../scripts/read-authority-trial-metadata.mjs');
const hash=v=>createHash('sha256').update(v).digest('hex'),clock=Date.parse('2026-10-15T00:00:00Z');
const original='SYNTHETIC_ORIGINAL_SHEET_ID',synthetic='SYNTHETIC_UNBOUND_SHEET_ID',publisherHash=hash('publisher@example.invalid'),callerHash=hash('caller@example.invalid');
const authNames=['V2_landlord_email_sessions','V2_users','V2_workspaces','V2_workspace_members','V2_landlords'];
const names=[...authNames,...Array.from({length:15},(_,i)=>'Synthetic_tab_'+i)],expectedSheets=authNames.map((name,i)=>({name,sheetId:100+i}));
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s),callerScopes=['spreadsheets.readonly','userinfo.email','script.external_request'].map(s=>'https://www.googleapis.com/auth/'+s);
const owner=()=>({id:'SYNTHETIC_OWNER_ID',type:'user',role:'owner',emailAddress:'publisher@example.invalid',deleted:false});
const reader=()=>({id:'SYNTHETIC_CALLER_ID',type:'user',role:'reader',emailAddress:'caller@example.invalid',deleted:false});
const acl=original=>({permissions:original?[owner()]:[owner(),reader()]}),sheet=()=>({spreadsheetId:synthetic,properties:{timeZone:'Asia/Taipei'},sheets:names.map((title,i)=>({properties:{sheetId:i<5?100+i:200+i,title}}))});
function setup(patch={},verifierPatch={}){
 const calls=[],charges=[];let credentials=0;
 const options={originalSheetId:original,syntheticSheetId:synthetic,expectedTabNames:names,publisherHash,callerHash,credential:actor=>{credentials++;return {accessToken:'SYNTHETIC_'+actor,accountHash:actor==='publisher'?publisherHash:callerHash,scopes:actor==='publisher'?scopes:callerScopes,expiresAt:clock+3600000,refreshTokenPresent:actor==='publisher'};},now:()=>clock,
  fetcher:async(url,init)=>{calls.push({url,init});const value=url.includes('sheets.googleapis.com')?sheet():acl(url.includes(original));return new Response(JSON.stringify(value));},...patch};
 const adapter=createAuthorityTrialMetadataAdapters(options);
 const config={metadataAdapter:adapter,originalSheetId:original,syntheticSheetId:synthetic,publisherHash,callerHash,callerPermissionHash:hash('SYNTHETIC_CALLER_ID'),expectedAuthorizationSheets:expectedSheets.map(v=>({...v})),...verifierPatch};
 assert.equal(typeof api.createAuthorityReleaseMetadataVerifier,'function');const verifier=api.createAuthorityReleaseMetadataVerifier(config);
 const control=phase=>({phase,externalRead:async(io,alias)=>{charges.push({phase,alias});return io();}});
 return {adapter,verifier,config,options,calls,charges,control,credentials:()=>credentials};
}
test('two phases derive actual reader/owner denial and tab IDs from six fixed metadata GETs',async()=>{
 const s=setup();assert.equal(s.calls.length,0);assert.equal(s.credentials(),0);
 for(const phase of ['wrapper-before','wrapper-after']){
  const proof=await s.verifier.read(s.control(phase));assert.equal(proof.phase,phase);assert.deepEqual(proof.facts,{syntheticSheetId:synthetic,callerSheetRole:'reader'});assert.deepEqual(proof.originalContainer,{spreadsheetId:original,callerRole:'none'});
  assert.deepEqual(proof.authorizationSheets,expectedSheets);assert.equal(proof.callerPermissionHash,hash('SYNTHETIC_CALLER_ID'));assert.equal(proof.publisherPermissionHash,hash('SYNTHETIC_OWNER_ID'));assert.equal(proof.headersVerified,false);assert.equal(proof.nativeProofAccepted,false);assert.equal(proof.trialAccepted,false);assert.equal(proof.facts.callerLibraryRole,undefined);assert.equal(proof.facts.sheetContractHash,undefined);assert(Object.isFrozen(proof.authorizationSheets[0]));
 }
 assert.deepEqual(s.charges.map(v=>v.alias),['synthetic-acl','original-acl','caller-sheets-metadata','synthetic-acl','original-acl','caller-sheets-metadata']);assert.equal(s.calls.length,6);
 assert.deepEqual(s.calls.map(v=>v.init.headers.authorization),['Bearer SYNTHETIC_publisher','Bearer SYNTHETIC_publisher','Bearer SYNTHETIC_caller','Bearer SYNTHETIC_publisher','Bearer SYNTHETIC_publisher','Bearer SYNTHETIC_caller']);
 for(const c of s.calls){const u=new URL(c.url);assert.equal(c.init.method,'GET');assert.equal(c.init.redirect,'manual');assert(!u.searchParams.has('includeGridData'));assert(!u.searchParams.has('pageToken'));assert(!u.searchParams.get('fields').includes('rowData'));}
});
for(const [name,mutate] of [
 ['caller writer',p=>{p.permissions[1].role='writer';}],['wrong caller',p=>{p.permissions[1].emailAddress='other@example.invalid';}],['different caller permission',p=>{p.permissions[1].id='SYNTHETIC_OTHER_ID';}],
 ['caller group',p=>{p.permissions[1].type='group';}],['public',p=>{p.permissions.push({id:'SYNTHETIC_PUBLIC',type:'anyone',role:'reader'});}],['domain',p=>{p.permissions.push({id:'SYNTHETIC_DOMAIN',type:'domain',role:'reader',domain:'example.invalid'});}],
 ['extra user',p=>{p.permissions.push({id:'SYNTHETIC_EXTRA',type:'user',role:'reader',emailAddress:'other@example.invalid'});}],['duplicate ID',p=>{p.permissions[1].id=p.permissions[0].id;}],['wrong owner',p=>{p.permissions[0].emailAddress='other@example.invalid';}],['deleted reader',p=>{p.permissions[1].deleted=true;}],
 ['inherited reader',p=>{p.permissions[1].permissionDetails=[{inherited:true,permissionType:'file',role:'reader'}];}],['unknown owner domain',p=>{p.permissions[0].domain='example.invalid';}]
])test('synthetic ACL '+name+' cannot assert a safe reader and is never retried',async()=>{
 const value=acl(false);mutate(value);const s=setup({fetcher:async()=>new Response(JSON.stringify(value))});await assert.rejects(s.verifier.read(s.control('wrapper-before')),/^Error: TRIAL_STOPPED$/);assert.equal(s.charges.length,1);await assert.rejects(s.verifier.read(s.control('wrapper-before')),/TRIAL_STOPPED/);assert.equal(s.charges.length,1);
});
for(const [name,mutate] of [
 ['caller source viewer',p=>{p.permissions.push(reader());}],['group',p=>{p.permissions.push({id:'SYNTHETIC_GROUP',type:'group',role:'reader',emailAddress:'group@example.invalid'});}],['other owner ID',p=>{p.permissions[0].id='SYNTHETIC_OTHER_OWNER';}],['inherited',p=>{p.permissions[0].permissionDetails=[{inherited:true,permissionType:'file',role:'owner'}];}],['pagination',p=>{p.nextPageToken='SYNTHETIC_NEXT';}]
])test('original ACL '+name+' stops before caller Sheets metadata',async()=>{
 const value=acl(true);mutate(value);const s=setup({fetcher:async url=>new Response(JSON.stringify(url.includes(original)?value:acl(false)))});await assert.rejects(s.verifier.read(s.control('wrapper-before')),/TRIAL_STOPPED/);assert.equal(s.charges.length,2);
});
test('caller metadata must match the pinned authorization tab IDs, not only titles',async()=>{
 const value=sheet();value.sheets[0].properties.sheetId=999;
 const s=setup({fetcher:async url=>new Response(JSON.stringify(url.includes('sheets.googleapis.com')?value:acl(url.includes(original))))});await assert.rejects(s.verifier.read(s.control('wrapper-before')),/TRIAL_STOPPED/);assert.equal(s.charges.length,3);
});
test('contract IDs and original adapter identity are snapshotted before any IO',async()=>{
 const s=setup();s.config.expectedAuthorizationSheets[0].sheetId=999;s.config.originalSheetId='SYNTHETIC_OTHER_SHEET';s.config.metadataAdapter={read:async()=>{throw Error('UNEXPECTED');}};
 assert.deepEqual((await s.verifier.read(s.control('wrapper-before'))).authorizationSheets,expectedSheets);
});
test('copied/proxied/unrelated metadata adapters cannot be substituted for the fixed branded transport',()=>{
 const adapter=createAuthorityTrialMetadataAdapters({originalSheetId:original,syntheticSheetId:synthetic,expectedTabNames:names,publisherHash,callerHash,credential:()=>{throw Error('UNEXPECTED_CREDENTIAL');}});
 for(const candidate of [{...adapter},new Proxy(adapter,{}),{read:async()=>({})}])assert.throws(()=>setup({}, {metadataAdapter:candidate}),/TRIAL_STOPPED/);
 for(const patch of [{originalSheetId:'SYNTHETIC_OTHER_ORIGINAL'},{syntheticSheetId:'SYNTHETIC_OTHER_TARGET'},{publisherHash:'a'.repeat(64)},{callerHash:'b'.repeat(64)}])assert.throws(()=>setup({},patch),/TRIAL_STOPPED/);
});
test('only exactly five unique recognized authorization names and IDs are accepted',()=>{
 for(const mutate of [v=>v.pop(),v=>{v[1].sheetId=v[0].sheetId;},v=>{v[0].name='OTHER';},v=>{v[0].sheetId=-1;},v=>{v[0].name=v[1].name;},v=>{v[0].headers=['UNVERIFIED'];}]){const v=expectedSheets.map(x=>({...x}));mutate(v);assert.throws(()=>setup({}, {expectedAuthorizationSheets:v}),/TRIAL_STOPPED/);}
});
test('after-before, repeated and concurrent phases cannot start extra observations',async()=>{
 const after=setup();await assert.rejects(after.verifier.read(after.control('wrapper-after')),/TRIAL_STOPPED/);assert.equal(after.charges.length,0);
 const repeated=setup();await repeated.verifier.read(repeated.control('wrapper-before'));await assert.rejects(repeated.verifier.read(repeated.control('wrapper-before')),/TRIAL_STOPPED/);assert.equal(repeated.charges.length,3);
 let enter,release;const entered=new Promise(r=>{enter=r;});let requests=0;
 const s=setup({fetcher:async url=>{if(++requests===1){enter();await new Promise(r=>{release=r;});}return new Response(JSON.stringify(url.includes('sheets.googleapis.com')?sheet():acl(url.includes(original))));}});
 const work=s.verifier.read(s.control('wrapper-before'));await entered;await assert.rejects(s.verifier.read(s.control('wrapper-before')),/TRIAL_STOPPED/);release();await assert.rejects(work,/TRIAL_STOPPED/);assert.equal(s.charges.length,1);
});
test('drains a denied response body under its paid callback and returns no raw provider error',async()=>{
 let release,cancelled=false;const s=setup({fetcher:async()=>({status:403,body:{cancel:()=>new Promise(r=>{release=()=>{cancelled=true;r();};})}})}),work=s.verifier.read(s.control('wrapper-before'));let done=false;void work.catch(()=>{done=true;});
 while(!release)await new Promise(r=>setImmediate(r));assert.equal(done,false);assert.equal(s.charges.length,1);release();await assert.rejects(work,/^Error: TRIAL_STOPPED$/);assert.equal(cancelled,true);
});
test('metadata-only evidence cannot satisfy the driver source/native/property contract',async()=>{
 const s=setup(),observed=await s.verifier.read(s.control('wrapper-before'));
 const expected={deploymentId:'SYNTHETIC_DEPLOYMENT_ID',thinScriptId:'SYNTHETIC_THIN_SCRIPT_ID',libraryId:'SYNTHETIC_LIBRARY_SCRIPT_ID',libraryVersion:7,librarySourceHash:'a'.repeat(64),thinSourceHash:'b'.repeat(64),libraryManifestHash:'c'.repeat(64),thinManifestHash:'d'.repeat(64),originalEditorHash:'e'.repeat(64),originalDeploymentsHash:'f'.repeat(64),originalCloudProject:'SYNTHETIC_OLD_PROJECT',trialEpoch:'SYNTHETIC_TEST_EPOCH',syntheticSheetId:synthetic,callerHash,publisherHash,oauthClientHash:'a'.repeat(64),newCloudProject:'SYNTHETIC_NEW_PROJECT',sheetContractHash:'b'.repeat(64)};
 assert.throws(()=>verifyAuthorityTrialReadback(expected,{...expected,...observed.facts}),/TRIAL_STOPPED/);
});
