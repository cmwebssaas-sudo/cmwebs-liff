import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('landlord-entry.html','utf8');
function extract(name) {
  const marker='function '+name+'(';
  const start=source.indexOf(marker);
  if(start<0)return '';
  let depth=0;
  for(let i=source.indexOf('{',start);i<source.length;i++) {
    if(source[i]==='{')depth++;
    if(source[i]==='}' && --depth===0)return (source.slice(start-6,start)==='async '?'async ':'')+source.slice(start,i+1);
  }
}
function fixture(inClient=false, locationOverrides={}) {
  const app={innerHTML:''},button={disabled:false,textContent:''};
  const calls=[];
  const location={origin:'https://example.test',pathname:'/cmwebs/landlord-entry.html',protocol:'https:',
    href:'https://example.test/cmwebs/landlord-entry.html?code=private&state=private',replace:url=>calls.push(['replace',url]),
    ...locationOverrides};
  const context=vm.createContext({
    TEST_MODE:false,LIFF_ID:'fixture-liff',STAY_MODE:false,RETURN_TO:'landlord-home.html',LINE_USER_ID:'',
    safeHtml:String,URL,initAuthClient:()=>null,hasLineFallbackIntent:()=>false,
    fetchStatusJson:async()=>{calls.push(['status']);throw new Error('must not request status with expired identity');},
    resolveReturnTo:()=> 'landlord-home.html',
    document:{getElementById:id=>id==='app'?app:button},
    location,
    liff:{init:async()=>{},isLoggedIn:()=>true,isInClient:()=>inClient,
      getProfile:async()=>{throw new Error('The access token expired');},
      logout:()=>calls.push(['logout']),login:options=>calls.push(['login',options.redirectUri])}
  });
  vm.runInContext('let entryReloginInFlight_=false;\n'+[
    'isEntryLineSessionError','entryWebRedirectUri','entryReloginUrl','renderEntryLoginExpired','restartEntryLineLogin','renderError','initLine','loadPage'
  ].map(extract).join('\n'),context);
  return {context,app,button,calls};
}
const external=fixture();
external.context.renderError('The access token expired');
assert.doesNotMatch(external.app.innerHTML,/landlord-register/,'expired sessions must not offer new-account registration');
assert.match(external.app.innerHTML,/重新登入/);
assert.equal(external.calls.length,0,'rendering errors must not start redirect loops');
assert.equal(await external.context.initLine(),false);
await external.context.restartEntryLineLogin();
await external.context.restartEntryLineLogin();
assert.deepEqual(external.calls,[['logout'],['login','https://example.test/cmwebs/landlord-entry.html?return_to=landlord-home.html']]);
assert.equal(external.button.disabled,true);
const native=fixture(true);
assert.equal(await native.context.initLine(),false);
await native.context.restartEntryLineLogin();
assert.deepEqual(native.calls,[['replace','https://liff.line.me/fixture-liff?return_to=landlord-home.html']]);
const network=fixture();
network.context.liff.getProfile=async()=>{throw new Error('network unavailable');};
await assert.rejects(network.context.initLine(),/network unavailable/);
assert.equal(network.calls.length,0);
const valid=fixture();valid.context.liff.getProfile=async()=>({userId:'U-fixture'});
assert.equal(await valid.context.initLine(),true);assert.equal(valid.context.LINE_USER_ID,'U-fixture');
const broken=fixture();broken.context.liff.logout=()=>{throw new Error('SDK failure');};
await broken.context.restartEntryLineLogin();assert.equal(broken.button.disabled,false);
assert.match(broken.app.innerHTML,/重新登入/);
const entry=fixture();await entry.context.loadPage();
assert.match(entry.app.innerHTML,/重新登入/);assert.deepEqual(entry.calls,[]);
const initExpired=fixture();initExpired.context.liff.init=async()=>{throw new Error('The access token expired');};
await initExpired.context.loadPage();assert.match(initExpired.app.innerHTML,/重新登入/);
assert.doesNotMatch(initExpired.app.innerHTML,/landlord-register/);
const nativeLoggedOut=fixture(true);nativeLoggedOut.context.liff.isLoggedIn=()=>false;
assert.equal(await nativeLoggedOut.context.initLine(),false);assert.deepEqual(nativeLoggedOut.calls,[]);
const localFile=fixture(false,{origin:'null',protocol:'file:',pathname:'/Users/hans/CMWebs/cmwebs-liff/landlord-entry.html',href:'file:///Users/hans/CMWebs/cmwebs-liff/landlord-entry.html'});
localFile.context.liff.isLoggedIn=()=>false;
assert.equal(await localFile.context.initLine(),false);
assert.deepEqual(localFile.calls,[['login','https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-entry.html?return_to=landlord-home.html']],
  'file:// fixtures must never be sent to LINE as a redirect URI');
console.log('Entry expiry recovery, platform routing and duplicate-click tests passed');
