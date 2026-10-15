import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as entry from '../scripts/build-read-authority-trial-entry.mjs';
const options={libraryId:'SYNTHETIC_LIBRARY_SCRIPT',version:7};
test('local artifacts have only approved scopes, fixed library version and logged-in API access',()=>{
  assert.equal(typeof entry.buildAuthorityTrialArtifacts,'function');const a=entry.buildAuthorityTrialArtifacts(options);
  const scopes=['https://www.googleapis.com/auth/spreadsheets.readonly','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/script.external_request'];
  for(const manifest of [a.libraryManifest,a.wrapperManifest]){
    assert.deepEqual(manifest.oauthScopes,scopes);assert.equal(manifest.runtimeVersion,'V8');assert.equal(manifest.exceptionLogging,'NONE');assert.equal(manifest.timeZone,'Asia/Taipei');
    assert.deepEqual(manifest.urlFetchWhitelist,['https://sheets.googleapis.com/v4/spreadsheets/','https://api.line.me/oauth2/v2.1/verify']);
    assert.equal(manifest.webapp,undefined);
  }
  assert.equal(a.libraryManifest.executionApi,undefined);
  assert.deepEqual(a.wrapperManifest.executionApi,{access:'ANYONE'});
  assert.deepEqual(a.wrapperManifest.dependencies.libraries,[{userSymbol:'AuthorityTrial',libraryId:options.libraryId,version:'7',developmentMode:false}]);
  assert.equal(a.status,'LOCAL_ARTIFACTS_UNDEPLOYED');new vm.Script(a.librarySource);new vm.Script(a.wrapperSource);
});
for(const [name,opts] of [['missing',undefined],['unknown config',{...options,scope:'drive'}],['missing version',{libraryId:options.libraryId}],['development HEAD',{...options,version:'HEAD'}],['zero version',{...options,version:0}],['invalid ID',{...options,libraryId:'https://other.invalid'}]])test('artifact generation rejects '+name,()=>{
  assert.equal(typeof entry.buildAuthorityTrialArtifacts,'function');assert.throws(()=>entry.buildAuthorityTrialArtifacts(opts));
});
