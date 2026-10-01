import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps-script/V2_LANDLORD_LIFF_SIGNING_REVIEW_SESSION.js',import.meta.url),'utf8');

test('LINE expired-token rejection stays denied and exposes only an allowlisted recovery code',()=> {
  let principals=0;
  const c=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'fixture-channel'})},
    UrlFetchApp:{fetch:()=>({getResponseCode:()=>400,getContentText:()=>JSON.stringify({error:'invalid_request',error_description:'IdToken expired.'})})},
    workspaceLandlordResolveAccess_:()=>{principals++;throw new Error('must not authorize');}
  });
  vm.runInContext(source,c);
  const result=c.landlordContractSigningReviewAuthenticate_('fixture-token');
  assert.equal(result.success,false);
  assert.equal(result.code,'LINE_ID_TOKEN_EXPIRED');
  assert.match(result.message,/過期/);
  assert.equal(result.data,undefined);
  assert.equal(principals,0);
  assert.doesNotMatch(JSON.stringify(result),/fixture-token|fixture-channel/);
});

test('audience, malformed-body and provider errors cannot be relabeled as an authenticated session',()=> {
  const cases = ['Invalid IdToken Audience.','Invalid IdToken.','private unsafe error <script>'].map(description=>({status:400,body:JSON.stringify({error_description:description}),code:'LINE_TOKEN_VERIFY_FAILED'}));
  cases.push(
    {status:400,body:'not-json',code:'LINE_TOKEN_VERIFY_FAILED'},
    {status:400,body:'null',code:'LINE_TOKEN_VERIFY_FAILED'},
    {status:401,body:JSON.stringify({error_description:'IdToken expired.'}),code:'LINE_TOKEN_VERIFY_FAILED'},
    {status:500,body:JSON.stringify({error_description:'IdToken expired.'}),code:'LINE_TOKEN_VERIFY_FAILED'},
    {status:200,body:JSON.stringify({iss:'https://access.line.me',aud:'wrong-channel',sub:'fixture-sub',exp:Math.floor(Date.now()/1000)+600,iat:Math.floor(Date.now()/1000)}),code:'LINE_TOKEN_CLAIMS_INVALID'}
  );
  for(const fixture of cases) {
    let principals=0;
    const c=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'fixture-channel'})},
      UrlFetchApp:{fetch:()=>({getResponseCode:()=>fixture.status,getContentText:()=>fixture.body})},
      workspaceLandlordResolveAccess_:()=>{principals++;throw new Error('must not authorize');}
    });
    vm.runInContext(source,c);
    const result=c.landlordContractSigningReviewAuthenticate_('fixture-token');
    assert.equal(result.success,false);
    assert.equal(result.code,fixture.code);
    assert.equal(result.data,undefined);
    assert.equal(principals,0);
    assert.doesNotMatch(JSON.stringify(result),/unsafe|script|fixture-token/);
  }
});
