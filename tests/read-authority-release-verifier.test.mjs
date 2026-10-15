import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as release from '../scripts/read-authority-release-source.mjs';
import {buildAuthorityTrialArtifacts} from '../scripts/build-read-authority-trial-entry.mjs';
import {verifyAuthorityTrialReadback} from '../scripts/read-authority-trial-driver.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const checksum=v=>sha(JSON.stringify(canonical(v))),fileHash=v=>checksum([...v].sort((a,b)=>a.name.localeCompare(b.name)));
const libraryId='SYNTHETIC_LIBRARY_SCRIPT_ID',thinId='SYNTHETIC_THIN_SCRIPT_ID',parentId='SYNTHETIC_ORIGINAL_SHEET_ID',epoch='SYNTHETIC_RELEASE_VERIFY_EPOCH';
const bundle=buildAuthorityTrialArtifacts({libraryId,version:7});
const originalFiles=Array.from({length:10},(_,i)=>({name:i?'Original'+i:'appsscript',type:i?'SERVER_JS':'JSON',source:i?'// SYNTHETIC ORIGINAL '+i:'{"timeZone":"Asia/Taipei"}'}));
const libraryFiles=[{name:'AuthorityTrial',type:'SERVER_JS',source:bundle.librarySource},{name:'appsscript',type:'JSON',source:JSON.stringify(bundle.libraryManifest)}];
const thinFiles=[{name:'Code',type:'SERVER_JS',source:bundle.wrapperSource},{name:'appsscript',type:'JSON',source:JSON.stringify(bundle.wrapperManifest)}];
const baselineVersions=Array.from({length:6},(_,i)=>({scriptId:libraryId,versionNumber:i+1,description:'Synthetic original '+i}));
const originalDeployments=[{deploymentId:'SYNTHETIC_ORIGINAL_DEPLOYMENT',deploymentConfig:{scriptId:libraryId,versionNumber:1,manifestFileName:'appsscript'}}];
const thinDeployment={deploymentId:'SYNTHETIC_THIN_DEPLOYMENT',deploymentConfig:{scriptId:thinId,versionNumber:1,manifestFileName:'appsscript'},entryPoints:[{entryPointType:'EXECUTION_API',executionApi:{entryPointConfig:{access:'ANYONE'}}}]};
function setup({mutate=()=>{},optionsPatch={},fetchPatch}={}){
 const expected={deploymentId:thinDeployment.deploymentId,thinScriptId:thinId,libraryId,libraryVersion:7,librarySourceHash:fileHash(libraryFiles),thinSourceHash:fileHash(thinFiles),libraryManifestHash:sha(libraryFiles[1].source),thinManifestHash:sha(thinFiles[1].source),originalEditorHash:fileHash(originalFiles),originalDeploymentsHash:checksum(originalDeployments),originalCloudProject:'SYNTHETIC_ORIGINAL_CLOUD',trialEpoch:epoch,syntheticSheetId:'SYNTHETIC_UNBOUND_SHEET',callerHash:'a'.repeat(64),publisherHash:'b'.repeat(64),oauthClientHash:'c'.repeat(64),newCloudProject:'SYNTHETIC_NEW_CLOUD',sheetContractHash:'d'.repeat(64)};
 const packets=structuredClone({'original-project':{scriptId:libraryId,parentId},'original-editor':{scriptId:libraryId,files:originalFiles},'original-versions':{versions:[...baselineVersions,{scriptId:libraryId,versionNumber:7,description:'CMWebs C3 trial '+sha(epoch).slice(0,16)}]},'original-deployments':{deployments:originalDeployments},'library-content':{scriptId:libraryId,files:libraryFiles},'thin-content':{scriptId:thinId,files:thinFiles},'thin-deployments':{deployments:[thinDeployment]}});
 mutate(packets,expected);const reads=[],charges=[];
 const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
 const adapter=release.createAuthorityReleaseSource({originalScriptId:libraryId,thinScriptId:thinId,libraryVersion:7,publisherHash:expected.publisherHash,now:()=>0,credential:()=>({accessToken:'SYNTHETIC_SOURCE_TOKEN',accountHash:expected.publisherHash,scopes,expiresAt:3600000,refreshTokenPresent:true}),fetcher:async url=>{
  const u=new URL(url),thin=u.pathname.includes(thinId),alias=u.pathname.endsWith('/versions')?'original-versions':u.pathname.endsWith('/deployments')?(thin?'thin-deployments':'original-deployments'):u.pathname.endsWith('/content')?(thin?'thin-content':u.searchParams.has('versionNumber')?'library-content':'original-editor'):'original-project';
  reads.push(alias);if(fetchPatch)await fetchPatch(alias,packets);return new Response(JSON.stringify(packets[alias]));
 }});
 const control={phase:'wrapper-before',externalRead:async(io,alias)=>{charges.push(alias);return await io();}};
 const options={expected,originalParentId:parentId,baselineVersions:structuredClone(baselineVersions),sourceAdapter:adapter,...optionsPatch};
 assert.equal(typeof release.createAuthorityReleaseSourceVerifier,'function');const verifier=release.createAuthorityReleaseSourceVerifier(options);
 return {expected,packets,reads,charges,control,options,adapter,verifier};
}
test('source equality verifier is pure and derives partial facts from all seven actual packets',async()=>{
 const s=setup();assert.equal(s.reads.length+s.charges.length,0);const r=await s.verifier.read(s.control);
 assert.equal(s.reads.length,7);assert.deepEqual(s.reads,s.charges);assert.equal(r.phase,'wrapper-before');assert.equal(r.source,'fixed-source-release-readback');assert.equal(r.trialAccepted,false);assert.equal(r.nativeProofAccepted,false);
 for(const k of ['libraryId','thinScriptId','libraryVersion','deploymentId','librarySourceHash','thinSourceHash','libraryManifestHash','thinManifestHash','originalEditorHash','originalDeploymentsHash'])assert.equal(r.facts[k],s.expected[k]);
 assert.equal(r.facts.originalEditorRestored,true);assert.deepEqual(r.facts.retainedVersions,[1,2,3,4,5,6,7]);assert.deepEqual(r.facts.scopes,bundle.wrapperManifest.oauthScopes);assert.equal(r.facts.developmentMode,false);assert.equal(r.facts.executionAccess,'ANYONE');assert(Object.isFrozen(r.facts.retainedVersions));
 assert.equal(r.facts.originalCloudProject,undefined);assert.equal(r.facts.callerSheetRole,undefined);assert.throws(()=>verifyAuthorityTrialReadback(s.expected,r.facts),/TRIAL_STOPPED/);
 assert(!JSON.stringify(r).includes('SYNTHETIC ORIGINAL'));assert(!JSON.stringify(r).includes('readTrialCallerAllowed_'));
});
test('both source phases are independent and cannot be replayed or skipped',async()=>{
 const s=setup();await s.verifier.read(s.control);await s.verifier.read({...s.control,phase:'wrapper-after'});assert.equal(s.reads.length,14);await assert.rejects(s.verifier.read(s.control),/TRIAL_STOPPED/);assert.equal(s.reads.length,14);
 const other=setup();await assert.rejects(other.verifier.read({...other.control,phase:'wrapper-after'}),/TRIAL_STOPPED/);assert.equal(other.reads.length,0);
});
test('constructor pins expected hashes, baseline metadata and the source method before any await',async()=>{
 const s=setup();s.options.expected.librarySourceHash='f'.repeat(64);s.options.baselineVersions[0].description='PRIVATE_CHANGED';assert.throws(()=>{s.adapter.read=async()=>{throw Error('PRIVATE_CHANGED');};});const r=await s.verifier.read(s.control);assert.equal(r.facts.librarySourceHash,fileHash(libraryFiles));
});
test('canonical source object field order and file order preserve the existing publication hash',async()=>{
 const s=setup({mutate:p=>{for(const alias of ['original-editor','library-content','thin-content'])p[alias].files.reverse();p['original-versions'].versions.reverse();}});const r=await s.verifier.read(s.control);assert.equal(r.facts.librarySourceHash,fileHash(libraryFiles));assert.deepEqual(r.facts.retainedVersions,[1,2,3,4,5,6,7]);
});
for(const [name,mutate] of [
 ['parent binding',p=>{p['original-project'].parentId='SYNTHETIC_DIFFERENT_PARENT';}],
 ['editor bytes',p=>{p['original-editor'].files[0].source+='\n// changed';}],
 ['retained baseline',p=>{p['original-versions'].versions[0].description='changed';}],
 ['extra version',p=>{p['original-versions'].versions.push({scriptId:libraryId,versionNumber:8});}],
 ['trial epoch',p=>{p['original-versions'].versions[6].description='CMWebs C3 trial wrong';}],
 ['serving deployment',p=>{p['original-deployments'].deployments[0].deploymentConfig.versionNumber=2;}],
 ['fixed library bytes',p=>{p['library-content'].files[0].source+='\n// changed';}],
 ['fixed wrapper bytes',p=>{p['thin-content'].files[0].source+='\n// changed';}],
 ['unexpected thin deployment',p=>{p['thin-deployments'].deployments[0].deploymentId='SYNTHETIC_DIFFERENT_DEPLOYMENT';}],
 ['actual execution access',p=>{p['thin-deployments'].deployments[0].entryPoints[0].executionApi.entryPointConfig.access='MYSELF';}],
 ['missing execution entrypoint',p=>{delete p['thin-deployments'].deployments[0].entryPoints;}],
 ['extra thin deployment',p=>{p['thin-deployments'].deployments.push({deploymentId:'SYNTHETIC_EXTRA_DEPLOYMENT',deploymentConfig:{scriptId:thinId,versionNumber:1,manifestFileName:'appsscript'}});}]
])test('observed '+name+' mismatch stops rather than copying expected pins',async()=>{
 const s=setup({mutate});await assert.rejects(s.verifier.read(s.control),/^Error: TRIAL_STOPPED$/);const n=s.reads.length;await assert.rejects(s.verifier.read(s.control),/TRIAL_STOPPED/);assert.equal(s.reads.length,n);assert(n>=1&&n<=7);
});
for(const [name,change] of [
 ['library dependency',m=>{m.dependencies.libraries=[{libraryId:'SYNTHETIC_OTHER_LIBRARY_ID'}];}],
 ['broader scopes',m=>{m.oauthScopes.push('https://www.googleapis.com/auth/drive');}],
 ['wrong library version',m=>{m.dependencies.libraries[0].version='1';}],
 ['development mode',m=>{m.dependencies.libraries[0].developmentMode=true;}],
 ['different library',m=>{m.dependencies.libraries[0].libraryId='SYNTHETIC_OTHER_LIBRARY_ID';}],
 ['private execution',m=>{m.executionApi.access='MYSELF';}],
 ['fetch expansion',m=>{m.urlFetchWhitelist.push('https://other.invalid/');}],
 ['logging',m=>{m.exceptionLogging='STACKDRIVER';}]
])test('manifest '+name+' is unsafe even if the supplied file hashes match it',async()=>{
 const s=setup({mutate:(p,e)=>{const alias=name==='library dependency'?'library-content':'thin-content',f=p[alias].files.find(f=>f.type==='JSON'),m=JSON.parse(f.source);change(m);f.source=JSON.stringify(m);e[alias==='library-content'?'librarySourceHash':'thinSourceHash']=fileHash(p[alias].files);e[alias==='library-content'?'libraryManifestHash':'thinManifestHash']=sha(f.source);}});await assert.rejects(s.verifier.read(s.control),/TRIAL_STOPPED/);
});
test('manifest-only hash cannot differ from actual uploaded JSON bytes',async()=>{
 const s=setup({mutate:(p,e)=>{e.thinManifestHash='f'.repeat(64);}});await assert.rejects(s.verifier.read(s.control),/TRIAL_STOPPED/);
});
test('native or other source aliases cannot be supplied as an extra verifier override',async()=>{
 const s=setup();await assert.rejects(s.verifier.read(s.control,{originalCloudProject:s.expected.originalCloudProject}),/TRIAL_STOPPED/);assert.equal(s.reads.length,0);
});
test('copied, prototype and proxy source handles cannot manufacture source provenance',()=>{
 const s=setup();for(const sourceAdapter of [{...s.adapter},Object.create(s.adapter),new Proxy(s.adapter,{})])assert.throws(()=>release.createAuthorityReleaseSourceVerifier({...s.options,sourceAdapter}),/^Error: TRIAL_STOPPED$/);assert.equal(s.reads.length,0);
});
test('mutable earlier response is snapshotted before later source IO',async()=>{
 const s=setup({fetchPatch:async(alias,p)=>{if(alias!=='original-project')p['original-project'].parentId='SYNTHETIC_DIFFERENT_PARENT';}});const r=await s.verifier.read(s.control);assert.equal(r.facts.libraryId,libraryId);assert.equal(s.packets['original-project'].parentId,'SYNTHETIC_DIFFERENT_PARENT');
});
test('a concurrent verifier read poisons the original incomplete observation without more admissions',async()=>{
 let enter,releaseGate;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{releaseGate=r;});const s=setup({fetchPatch:async()=>{enter();await gate;}});
 const running=s.verifier.read(s.control);void running.catch(()=>{});await entered;try{await assert.rejects(s.verifier.read(s.control),/TRIAL_STOPPED/);}finally{releaseGate();}await assert.rejects(running,/TRIAL_STOPPED/);assert.equal(s.charges.length,1);
});
