import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {authorityRuntime,authoritySecret} from '../../../tests/fixtures/read-parity/authority-runtime.mjs';
import {access} from '../../../tests/fixtures/read-parity/runtime.mjs';
const initial='https://script.google.com/macros/s/SYNTHETIC_DEPLOYMENT/exec';
const allowed='https://script.googleusercontent.com/macros/echo?synthetic=1';
const contents=`import {confirmReadAuthority} from '../src/read-authority.js';
export default {async fetch(request,env){try{await confirmReadAuthority(request,env,JSON.parse(env.ACCESS),{now:()=>Number(env.NOW)});return Response.json({success:true});}catch(error){return Response.json({success:false,code:error.code},{status:503});}}};`;
async function setup(kind){
 const h=authorityRuntime(),calls=[];let reply;
 const output=await build({stdin:{contents,resolveDir:new URL('.',import.meta.url).pathname},bundle:true,write:false,format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:output.outputFiles[0].text,compatibilityDate:'2026-10-06',bindings:{READ_AUTHORITY_URL:initial,READ_REPLICA_SYNC_SECRET:authoritySecret,ACCESS:JSON.stringify({...access,user:h.data.V2_users[0],membership:h.data.V2_workspace_members[0]}),NOW:String(h.clock())},
 outboundService:async request=>{
  calls.push({method:request.method,origin:new URL(request.url).origin});
  if(request.method==='POST'){reply=h.post(await request.json());return new Response('',{status:302,headers:{location:kind==='foreign'?'https://foreign.invalid/macros/echo':allowed}});}
  if(kind==='second-redirect')return new Response('',{status:302,headers:{location:'https://foreign.invalid/third'}});
  return Response.json(reply);
 }}));
 return {mf,calls};
}
for(const kind of ['allowed','foreign','second-redirect'])test('actual workerd authority redirect transport: '+kind,async()=>{
 const {mf,calls}=await setup(kind);
 try{
  const response=await mf.dispatchFetch('https://local.test/v1/arrears',{headers:{authorization:'LIFF synthetic-valid-line-token'}});
  assert.equal(response.status,kind==='allowed'?200:503);
  assert.equal((await response.json()).success,kind==='allowed');
  assert.equal(calls.length,kind==='foreign'?1:2,'no unapproved/third request');
  if(calls.length===2)assert.deepEqual(calls.map(x=>x.method),['POST','GET']);
 }finally{await mf.dispose();}
});
for(const redirect of [false,true])test('actual workerd LINE provider transport: '+(redirect?'reject redirect':'verify claims'),async()=>{
 const h=authorityRuntime(),calls=[];
 const entry=`import {createIdentityAuthenticator} from '../src/read-identity.js';
 export default {async fetch(request,env){try{const identity=await createIdentityAuthenticator({now:()=>Number(env.NOW)})(request,env);return Response.json(identity);}catch(error){return Response.json({code:error.code},{status:401});}}};`;
 const output=await build({stdin:{contents:entry,resolveDir:new URL('.',import.meta.url).pathname},bundle:true,write:false,format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:output.outputFiles[0].text,compatibilityDate:'2026-10-06',bindings:{LINE_LOGIN_CHANNEL_ID:'SYNTHETIC_CHANNEL',NOW:String(h.clock())},outboundService:async request=>{
  calls.push({url:request.url,method:request.method});
  if(redirect)return new Response('',{status:302,headers:{location:'https://foreign.invalid/credential-destination'}});
  return Response.json({iss:'https://access.line.me',aud:'SYNTHETIC_CHANNEL',exp:Math.floor(h.clock()/1000)+3600,sub:'SYNTHETIC_LINE1'});
 }}));
 try{
  const response=await mf.dispatchFetch('https://local.test/identity',{headers:{authorization:'LIFF synthetic-valid-line-token'}});
  assert.equal(response.status,redirect?401:200);
  assert.deepEqual(calls,[{url:'https://api.line.me/oauth2/v2.1/verify',method:'POST'}]);
 }finally{await mf.dispose();}
});
