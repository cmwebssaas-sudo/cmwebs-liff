import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as mod from '../scripts/read-authority-release-source.mjs';
import {buildStandaloneAuthorityTrialArtifacts} from '../scripts/build-read-authority-trial-entry.mjs';
import {verifyAuthorityStandaloneReadback} from '../scripts/read-authority-trial-driver.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const checksum=v=>sha(JSON.stringify(canonical(v))),fileHash=v=>checksum([...v].sort((a,b)=>a.name.localeCompare(b.name)));
const original='SYNTHETIC_ORIGINAL_SCRIPT_ID',thin='SYNTHETIC_STANDALONE_SCRIPT_ID',parent='SYNTHETIC_ORIGINAL_SHEET_ID';
const bundle=buildStandaloneAuthorityTrialArtifacts();
const originalFiles=[{name:'appsscript',type:'JSON',source:'{"timeZone":"Asia/Taipei"}'},{name:'Original',type:'SERVER_JS',source:'// SYNTHETIC ORIGINAL'}];
const isolatedFiles=[{name:'Code',type:'SERVER_JS',source:bundle.source},{name:'appsscript',type:'JSON',source:JSON.stringify(bundle.manifest)}];
const baseline=Array.from({length:6},(_,i)=>({scriptId:original,versionNumber:i+1,description:'Synthetic baseline '+i}));
const originalDeployments=[{deploymentId:'SYNTHETIC_ORIGINAL_DEPLOYMENT',deploymentConfig:{scriptId:original,versionNumber:1,manifestFileName:'appsscript'}}];
const deployment={deploymentId:'SYNTHETIC_STANDALONE_DEPLOYMENT',deploymentConfig:{scriptId:thin,versionNumber:1,manifestFileName:'appsscript'},entryPoints:[{entryPointType:'EXECUTION_API',executionApi:{entryPointConfig:{access:'ANYONE'}}}]};
const aliases=['original-project','original-editor','original-versions','original-deployments','library-content','thin-content','thin-deployments'];
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(v=>'https://www.googleapis.com/auth/'+v);
function setup(mutate=()=>{}){
 const expected={deploymentId:deployment.deploymentId,thinScriptId:thin,originalScriptId:original,standaloneVersion:1,thinSourceHash:fileHash(isolatedFiles),thinManifestHash:sha(isolatedFiles[1].source),originalEditorHash:fileHash(originalFiles),originalDeploymentsHash:checksum(originalDeployments),originalCloudProject:'SYNTHETIC_ORIGINAL_CLOUD',trialEpoch:'SYNTHETIC_STANDALONE_EPOCH',syntheticSheetId:'SYNTHETIC_UNBOUND_SHEET',callerHash:'a'.repeat(64),publisherHash:'b'.repeat(64),oauthClientHash:'c'.repeat(64),newCloudProject:'SYNTHETIC_NEW_CLOUD',sheetContractHash:'d'.repeat(64)};
 const packets=structuredClone({'original-project':{scriptId:original,parentId:parent},'original-editor':{scriptId:original,files:originalFiles},'original-versions':{versions:baseline},'original-deployments':{deployments:originalDeployments},'library-content':{scriptId:thin,files:isolatedFiles},'thin-content':{scriptId:thin,files:isolatedFiles},'thin-deployments':{deployments:[deployment]}});
 mutate(packets,expected);const requests=[],charges=[];
 assert.equal(typeof mod.createAuthorityStandaloneReleaseSource,'function');
 const producerOptions={originalScriptId:original,thinScriptId:thin,standaloneVersion:1,publisherHash:expected.publisherHash,now:()=>0,credential:()=>({accessToken:'SYNTHETIC_PUBLISHER_TOKEN',accountHash:expected.publisherHash,scopes,expiresAt:3600000,refreshTokenPresent:true}),fetcher:async(url,init)=>{
  assert.equal(charges.length,requests.length+1);const u=new URL(url),isThin=u.pathname.includes(thin);
  const alias=u.pathname.endsWith('/versions')?'original-versions':u.pathname.endsWith('/deployments')?(isThin?'thin-deployments':'original-deployments'):u.pathname.endsWith('/content')?(isThin?(u.searchParams.has('versionNumber')?'library-content':'thin-content'):'original-editor'):'original-project';
  requests.push({alias,url,init});return new Response(JSON.stringify(packets[alias]));
 }};
 const sourceAdapter=mod.createAuthorityStandaloneReleaseSource(producerOptions);
 const options={expected,originalParentId:parent,baselineVersions:structuredClone(baseline),sourceAdapter};
 assert.equal(typeof mod.createAuthorityStandaloneReleaseSourceVerifier,'function');
 const verifier=mod.createAuthorityStandaloneReleaseSourceVerifier(options),control={phase:'wrapper-before',externalRead:async(io,alias)=>{charges.push(alias);return io();}};
 return {expected,packets,requests,charges,producerOptions,sourceAdapter,options,verifier,control};
}
test('standalone source proves immutable and editor equality without reading an original library version',async()=>{
 const s=setup();assert.equal(s.requests.length+s.charges.length,0);const r=await s.verifier.read(s.control);
 assert.deepEqual(s.requests.map(v=>v.alias),aliases);assert.deepEqual(s.charges,aliases);
 for(const {alias,url,init} of s.requests){const u=new URL(url);assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(u.origin,'https://script.googleapis.com');if(alias==='library-content'){assert.equal(u.pathname,'/v1/projects/'+thin+'/content');assert.equal(u.searchParams.get('versionNumber'),'1');}if(alias==='thin-content'||alias==='original-editor')assert.equal(u.searchParams.has('versionNumber'),false);}
 for(const key of ['originalScriptId','thinScriptId','standaloneVersion','thinSourceHash','thinManifestHash','originalEditorHash','originalDeploymentsHash','deploymentId'])assert.equal(r.facts[key],s.expected[key]);
 assert.deepEqual(r.facts.retainedVersions,[1,2,3,4,5,6]);assert.equal(r.facts.standaloneLibraryCount,0);assert.equal(r.facts.originalEditorUnchanged,true);assert.equal(r.facts.originalDeploymentsUnchanged,true);assert.equal(r.facts.executionAccess,'ANYONE');assert.equal(r.facts.developmentMode,false);assert.deepEqual(r.facts.scopes,bundle.manifest.oauthScopes);
 assert.equal(r.nativeProofAccepted,false);assert.equal(r.trialAccepted,false);for(const key of ['originalCloudProject','callerSheetRole','standaloneTriggers','callerPropertiesMatch'])assert.equal(r.facts[key],undefined);
 assert.throws(()=>verifyAuthorityStandaloneReadback(s.expected,r.facts),/TRIAL_STOPPED/);assert(!JSON.stringify(r).includes('SYNTHETIC ORIGINAL'));assert(Object.isFrozen(r.facts.scopes));
});
test('two source phases require new reads, then deny replay without another admission',async()=>{
 const s=setup();await s.verifier.read(s.control);await s.verifier.read({...s.control,phase:'wrapper-after'});assert.equal(s.requests.length,14);await assert.rejects(s.verifier.read(s.control),/TRIAL_STOPPED/);assert.equal(s.requests.length,14);
 const other=setup();await assert.rejects(other.verifier.read({...other.control,phase:'wrapper-after'}),/TRIAL_STOPPED/);assert.equal(other.requests.length,0);
});
for(const [name,mutate] of [
 ['original parent',p=>{p['original-project'].parentId=thin;}],
 ['original editor',p=>{p['original-editor'].files[1].source+='changed';}],
 ['retained original version',p=>{p['original-versions'].versions[0].description='changed';}],
 ['extra original version',p=>{p['original-versions'].versions.push({scriptId:original,versionNumber:7});}],
 ['original deployment',p=>{p['original-deployments'].deployments[0].deploymentConfig.versionNumber=2;}],
 ['immutable source',p=>{p['library-content'].files[0].source+='changed';}],
 ['editor source',p=>{p['thin-content'].files[0].source+='changed';}],
 ['deployment version',p=>{p['thin-deployments'].deployments[0].deploymentConfig.versionNumber=2;}],
 ['execution access',p=>{p['thin-deployments'].deployments[0].entryPoints[0].executionApi.entryPointConfig.access='MYSELF';}],
 ['foreign source project',p=>{p['library-content'].scriptId=original;}]
])test('actual '+name+' drift stops and cannot be retried',async()=>{const s=setup(mutate);await assert.rejects(s.verifier.read(s.control),/TRIAL_STOPPED/);const n=s.requests.length;await assert.rejects(s.verifier.read(s.control),/TRIAL_STOPPED/);assert.equal(s.requests.length,n);assert(n>0&&n<=7);});
for(const [name,change] of [
 ['library dependency',m=>{m.dependencies={libraries:[{libraryId:original,version:'7',developmentMode:false,userSymbol:'AuthorityTrial'}]};}],
 ['scope expansion',m=>{m.oauthScopes.push('https://www.googleapis.com/auth/drive');}],
 ['execution access',m=>{m.executionApi.access='MYSELF';}],
 ['logging',m=>{m.exceptionLogging='STACKDRIVER';}]
])test('unsafe '+name+' is rejected even when expected hashes match it',async()=>{
 const s=setup((p,e)=>{for(const alias of ['library-content','thin-content']){const f=p[alias].files.find(f=>f.type==='JSON'),m=JSON.parse(f.source);change(m);f.source=JSON.stringify(m);}e.thinSourceHash=fileHash(p['thin-content'].files);e.thinManifestHash=sha(p['thin-content'].files.find(f=>f.type==='JSON').source);});await assert.rejects(s.verifier.read(s.control),/TRIAL_STOPPED/);
});
test('mode mixing, library options and copied producer handles cannot claim standalone provenance',()=>{
 const s=setup();for(const patch of [{standaloneVersion:2},{libraryVersion:7}])assert.throws(()=>mod.createAuthorityStandaloneReleaseSource({...s.producerOptions,...patch}),/TRIAL_STOPPED/);
 const {standaloneVersion,...oldOptions}=s.producerOptions;const old=mod.createAuthorityReleaseSource({...oldOptions,libraryVersion:7});
 for(const sourceAdapter of [old,{...s.sourceAdapter},new Proxy(s.sourceAdapter,{})])assert.throws(()=>mod.createAuthorityStandaloneReleaseSourceVerifier({...s.options,sourceAdapter}),/TRIAL_STOPPED/);
 assert.throws(()=>mod.createAuthorityReleaseSourceVerifier(s.options),/TRIAL_STOPPED/);assert.equal(s.requests.length,0);
});
test('standalone constructors reject executable option hooks without evaluating or transmitting them',()=>{
 const s=setup();let hooks=0;
 for(const [create,options] of [[mod.createAuthorityStandaloneReleaseSource,s.producerOptions],[mod.createAuthorityStandaloneReleaseSourceVerifier,s.options]]){
  for(const bad of [new Proxy(options,{ownKeys(){hooks++;return Reflect.ownKeys(options);}}),Object.defineProperty({...options},Object.keys(options)[0],{enumerable:true,get(){hooks++;return options[Object.keys(options)[0]];}})])assert.throws(()=>create(bad),/TRIAL_STOPPED/);
 }
 const expectedGetter=Object.defineProperty({...s.options},'expected',{enumerable:true,get(){hooks++;return hooks===1?s.expected:{...s.expected,callerHash:s.expected.publisherHash};}});
 assert.throws(()=>mod.createAuthorityStandaloneReleaseSourceVerifier(expectedGetter),/TRIAL_STOPPED/);
 const versions=structuredClone(s.options.baselineVersions);Object.defineProperty(versions[0],'description',{enumerable:true,get(){hooks++;return 'changed';}});
 assert.throws(()=>mod.createAuthorityStandaloneReleaseSourceVerifier({...s.options,baselineVersions:versions}),/TRIAL_STOPPED/);
 assert.equal(hooks,0);assert.equal(s.requests.length,0);
});
