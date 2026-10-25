// Local candidate. Native client/project isolation and all trial gates must be
// proved by the trusted orchestrator before owner consent. No automatic login.
import {openSync,closeSync,writeSync,fsyncSync,lstatSync,readFileSync,renameSync,mkdirSync,unlinkSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {homedir,userInfo} from 'node:os';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {types} from 'node:util';
import {createServer} from 'node:http';
import {AUTHORITY_TRIAL_SCOPES} from './read-authority-trial-driver.mjs';
export const AUTHORITY_TRIAL_REDIRECT_URI='http://127.0.0.1:34763/oauth/callback';
const stop=()=>{throw Error('TRIAL_STOPPED');};
const hash=v=>createHash('sha256').update(v).digest('hex');
const checksum=v=>hash(JSON.stringify(v));
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const only=(v,allowed,required=allowed)=>record(v)&&Object.keys(v).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const secret=v=>typeof v==='string'&&v.length>0&&v.length<=8192&&!/[\s\x00-\x1f\x7f]/.test(v);
const scopes=v=>typeof v==='string'&&JSON.stringify(v.trim().split(/\s+/).sort())===JSON.stringify([...AUTHORITY_TRIAL_SCOPES].sort());
function directory(path){const s=lstatSync(dirname(path));if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o777)!==0o700)stop();}
function read(path){const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o777)!==0o600||s.size>10000)stop();const e=JSON.parse(readFileSync(path,'utf8'));if(!only(e,['value','sha256'])||checksum(e.value)!==e.sha256)stop();return e.value;}
function save(path,value,initial=false){
 directory(path);const p=initial?path:path+'.'+randomUUID()+'.tmp',fd=openSync(p,'wx',0o600);
 try{writeSync(fd,JSON.stringify({value,sha256:checksum(value)}));fsyncSync(fd);}finally{closeSync(fd);}if(!initial)renameSync(p,path);
 const dir=openSync(dirname(path),'r');try{fsyncSync(dir);}finally{closeSync(dir);}if(JSON.stringify(read(path))!==JSON.stringify(value))stop();
}
async function jsonResponse(r,url){
 if(r.status!==200||r.redirected===true||(r.url&&r.url!==url)||!r.body){if(r.body)await r.body.cancel().catch(()=>{});stop();}const reader=r.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if(!types.isUint8Array(value)||(size+=value.byteLength)>30000){await reader.cancel().catch(()=>{});stop();}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export function createAuthorityTrialOAuth(input){
 try{
  if(!only(input,['path','epoch','clientId','oauthClientHash','cloudProjectHash','callerHash','publisherHash','expiresAt','clientReadback','control','clientSecret','fetcher','now'],['path','epoch','clientId','oauthClientHash','cloudProjectHash','callerHash','publisherHash','expiresAt','clientReadback','control','clientSecret']))stop();
  const {epoch,clientId,oauthClientHash,cloudProjectHash,callerHash,publisherHash,expiresAt,control,clientSecret,fetcher=fetch,now=Date.now}=input;
  const path=resolve(input.path),proof={...input.clientReadback};directory(path);
  if(typeof epoch!=='string'||!/^[-A-Za-z0-9_]{20,200}$/.test(epoch)||typeof clientId!=='string'||!/^[A-Za-z0-9_-]{1,200}\.apps\.googleusercontent\.com$/.test(clientId)||
   ![oauthClientHash,cloudProjectHash,callerHash,publisherHash].every(digest)||hash(clientId)!==oauthClientHash||callerHash===publisherHash||
   !only(proof,['source','oauthClientHash','cloudProjectHash','redirectUri','isolatedTrialProject'])||proof.source!=='google-native-ui'||proof.oauthClientHash!==oauthClientHash||proof.cloudProjectHash!==cloudProjectHash||proof.redirectUri!==AUTHORITY_TRIAL_REDIRECT_URI||proof.isolatedTrialProject!==true||
   [clientSecret,fetcher,now].some(f=>typeof f!=='function')||!control||['externalRead','cleanup'].some(k=>typeof control[k]!=='function'))stop();
  const start=now();if(!Number.isSafeInteger(start)||!Number.isSafeInteger(expiresAt)||expiresAt-start<=3600000||expiresAt-start>21600000)stop();
  const capability=Object.freeze({external:control.externalRead,cleanup:control.cleanup});
  const state=randomBytes(32).toString('base64url');let verifier=randomBytes(48).toString('base64url');
  const challenge=createHash('sha256').update(verifier).digest('base64url'),deadline=Math.min(start+600000,expiresAt-3600000);
  const registryDir=join(homedir(),'.codex','private','cmwebs-authority-trials');mkdirSync(registryDir,{recursive:true,mode:0o700});
  const registry=join(registryDir,checksum(epoch)+'.oauth.json');directory(registry);
  const binding=checksum({epoch,oauthClientHash,cloudProjectHash,callerHash,publisherHash,expiresAt,redirect:AUTHORITY_TRIAL_REDIRECT_URI});
  let lock;try{
   lock=openSync(registry+'.lock','wx',0o600);let exists=true;try{lstatSync(registry);}catch(e){if(e.code==='ENOENT')exists=false;else throw e;}if(exists)stop();
   save(registry,{state:'initializing',path,binding},true);
   save(path,{version:1,binding,stage:'waiting',deadline,stateHash:hash(state),pkceChallenge:challenge,attempted:false,consentAttempted:false,consentOutcome:'NOT_SENT',revocation:'NOT_NEEDED'},true);
   save(registry,{state:'ready',path,binding});
  }finally{if(lock!==undefined){closeSync(lock);unlinkSync(registry+'.lock');}}
  let journal=read(path),accessToken=null,verified=null,revokeAttempt,verifiedExpiry=null;
  let cancellationRequested=false,journalCompromised=false;
  let verificationToken=null,revokeSettled=false,verificationAttempted=false;
  let submitStarted=false,submitAdmitted=false,submitSettled=false,buffered=null;
  const write=patch=>{journal={...journal,...patch};try{save(path,journal);}catch(e){journalCompromised=true;throw e;}};
  const integrity=()=>{try{if(journalCompromised)stop();directory(path);if(JSON.stringify(read(registry))!==JSON.stringify({state:'ready',path,binding})||JSON.stringify(read(path))!==JSON.stringify(journal))stop();}catch(e){journalCompromised=true;throw e;}};
  const live=()=>{integrity();const time=now();if(cancellationRequested||journal.stage!=='claimed'||!Number.isSafeInteger(time)||time<start||time>=deadline)stop();return time;};
  const ordinary=async(charge,io)=>capability.external(async()=>{live();return await io();},charge);
  const options=(method,body,headers={})=>({method,redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'cache-control':'no-cache, no-store',...headers},...(body===undefined?{}:{body})});
  // Local stop is independent of cleanup admission. It never schedules IO.
  const cancelLocally=stage=>{
   cancellationRequested=true;buffered=null;verifier=null;verified=null;
   let failed=false;try{integrity();}catch(_){failed=true;}
   try{write({stage:journal.stage==='failed'?'failed':journal.stage==='cancelled'?'cancelled':stage});}catch(_){failed=true;}
   if(failed)stop();
  };
  const revoke=()=>{
   if(revokeAttempt)return revokeAttempt.promise;if(!accessToken)return Promise.resolve();
   const tokenToRevoke=accessToken,attempt={active:true,entered:false,violated:false,work:null,promise:null};
   revokeAttempt=attempt;
   attempt.promise=Promise.resolve().then(async()=>{
    let completed=false,actual,receiptFailed=false;
    try{
     const observed=await capability.cleanup('revoke-token',()=>{
      if(!attempt.active||attempt.entered){attempt.violated=true;stop();}
      attempt.entered=true;
      if(verifiedExpiry!==null)verificationToken=tokenToRevoke;
      attempt.work=(async()=>{
       // A compromised receipt must not prevent the one independently owned
       // revoke, but can never support a verified success claim.
       try{integrity();write({revocation:'UNKNOWN'});}catch(_){receiptFailed=true;}
       const url='https://oauth2.googleapis.com/revoke';
       const r=await fetcher(url,options('POST',new URLSearchParams({token:tokenToRevoke}).toString(),{'content-type':'application/x-www-form-urlencoded'}));
       // Disposal stays owned even when admission resolves/rejects dishonestly.
       if(r.body)await r.body.cancel();
       if(r.status!==200||r.redirected===true||(r.url&&r.url!==url))stop();
       actual=Object.freeze({ownedRevokeSettled:true});completed=true;return actual;
      })();void attempt.work.catch(()=>{});return attempt.work;
     });
     attempt.active=false;
     if(!attempt.entered||!completed||attempt.violated||observed!==actual||receiptFailed)stop();
     integrity();write({revocation:'ACK_UNVERIFIED'});
    }finally{
     attempt.active=false;if(attempt.work)await attempt.work.catch(()=>{});
     if(attempt.entered){accessToken=null;revokeSettled=true;}
     // No callback entry means no factory dispatch. The capability/ledger
     // alone decides whether a later explicit cleanup can be admitted.
     else if(revokeAttempt===attempt)revokeAttempt=undefined;
    }
   });return attempt.promise;
  };
  const verifyRevoked=async function(){
   let claimed=false,active=true,entered=false,violated=false,work,completed=false,actual;
   try{
    if(arguments.length||verificationAttempted||!revokeSettled||!verificationToken||verifiedExpiry===null)stop();
    verificationAttempted=true;claimed=true;
    const observed=await capability.cleanup('verify-token-revoked',()=>{
     if(!active||entered){violated=true;stop();}entered=true;
     work=(async()=>{
      // Only this holder's previously accepted token can support a readback.
      // Independent admission precedes every check and provider operation.
      integrity();const begin=now();
      if(!Number.isSafeInteger(begin)||begin<start||verifiedExpiry-begin<=10000)stop();
      write({tokenVerification:'UNKNOWN'});
      const url='https://www.googleapis.com/oauth2/v2/userinfo?fields=email%2Cverified_email';
      const response=await fetcher(url,options('GET',undefined,{authorization:'Bearer '+verificationToken}));
      // Private bodies are never read; disposal stays owned through settle.
      if(response.body)await response.body.cancel();
      const end=now();integrity();
      if(response.status!==401||response.redirected===true||(response.url&&response.url!==url)||
       !Number.isSafeInteger(end)||end<begin||end>=verifiedExpiry)stop();
      actual=Object.freeze({tokenRejectedAtReadback:true,observedAt:end,revocationAccepted:false,rollbackComplete:false});completed=true;return actual;
     })();void work.catch(()=>{});return work;
    });
    active=false;if(!entered||!completed||violated||observed!==actual)stop();integrity();
    write({tokenVerification:'REJECTED_AT_READBACK',tokenVerificationAt:actual.observedAt});
    // Preserve revoke ACK/UNKNOWN: rejection is neither causal nor grant-wide.
    return actual;
   }catch(_){stop();}finally{active=false;if(work)await work.catch(()=>{});if(claimed)verificationToken=null;}
  };
  const abandon=()=>{try{cancelLocally('failed');}catch(_){/* local stop remains sticky even with a damaged journal */}};
  const submissionLive=()=>{integrity();const t=now();if(cancellationRequested||!['waiting','claimed'].includes(journal.stage)||!Number.isSafeInteger(t)||t<start||t>=deadline)stop();};
  const processResponse=async p=>{
   try{live();
     const rawSecret=clientSecret();if(types.isPromise(rawSecret)){void Promise.prototype.then.call(rawSecret,()=>{},()=>{});stop();}if(!secret(rawSecret))stop();
     let sentAt;const t=await ordinary('E:token-exchange',async()=>{
      const tokenUrl='https://oauth2.googleapis.com/token';sentAt=now();write({revocation:'TOKEN_UNAVAILABLE'});
      const response=await fetcher(tokenUrl,options('POST',new URLSearchParams({client_id:clientId,client_secret:rawSecret,code:p.get('code'),code_verifier:verifier,grant_type:'authorization_code',redirect_uri:AUTHORITY_TRIAL_REDIRECT_URI}).toString(),{'content-type':'application/x-www-form-urlencoded'}));
      return await jsonResponse(response,tokenUrl);
     });verifier=null;
     if(record(t)&&secret(t.access_token)){accessToken=t.access_token;write({revocation:'NOT_NEEDED'});}
     live();if(!only(t,['access_token','token_type','expires_in','scope'],['access_token','token_type','expires_in','scope'])||!secret(t.access_token)||t.token_type!=='Bearer'||!Number.isSafeInteger(t.expires_in)||t.expires_in<=360||t.expires_in>3600||!scopes(t.scope))stop();
     const tokenExpiry=sentAt+t.expires_in*1000;if(tokenExpiry>expiresAt||tokenExpiry-now()<=360000)stop();
     const user=await ordinary('E:caller-userinfo',async()=>{const userUrl='https://www.googleapis.com/oauth2/v2/userinfo?fields=email%2Cverified_email';return await jsonResponse(await fetcher(userUrl,options('GET',undefined,{authorization:'Bearer '+accessToken})),userUrl);});live();
     if(!only(user,['email','verified_email'])||typeof user.email!=='string'||user.email.length>320||!/^\S+@\S+\.\S+$/.test(user.email)||user.verified_email!==true||hash(user.email.trim().toLowerCase())!==callerHash||tokenExpiry-now()<=360000)stop();
     verified=Object.freeze({accessToken,scopes:AUTHORITY_TRIAL_SCOPES,expiresAt:tokenExpiry,refreshTokenPresent:false,callerHash,oauthClientHash});verifiedExpiry=tokenExpiry;write({stage:'ready'});
   }catch(_){abandon();stop();}
  };
  const q=new URLSearchParams({client_id:clientId,redirect_uri:AUTHORITY_TRIAL_REDIRECT_URI,response_type:'code',scope:AUTHORITY_TRIAL_SCOPES.join(' '),state,code_challenge:challenge,code_challenge_method:'S256',access_type:'online',include_granted_scopes:'false',prompt:'select_account consent'});
  const flow=Object.freeze({verifyRevoked,authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?'+q.toString(),remainingMs:()=>Math.max(0,deadline-now()),status:()=>journal.stage,
   submitConsent:async function(io){
    if(arguments.length!==1||typeof io!=='function'||types.isProxy(io)||submitStarted||journal.stage!=='waiting')stop();submitStarted=true;
    let active=true,attempts=0,completed=false,actual,work,violated=false;
    try{
     submissionLive();
     const observed=await capability.external(()=>{
      if(!active||attempts++){violated=true;stop();}
      work=(async()=>{submissionLive();write({consentAttempted:true,consentOutcome:'UNKNOWN'});submitAdmitted=true;
       await io();submissionLive();if(!active||violated)stop();actual=Object.freeze({ownedIOSettled:true});completed=true;return actual;
      })();void work.catch(()=>{});return work;
     },'E:oauth-response');
     active=false;if(attempts!==1||!completed||violated||observed!==actual)stop();submissionLive();write({consentOutcome:'ACK_UNVERIFIED'});submitSettled=true;
     const response=buffered;buffered=null;if(response)await processResponse(response);
     return Object.freeze({source:'fixed-oauth-consent-submission',ownedIOSettled:true,consentVerified:false,trialAccepted:false,rollbackComplete:false});
    }catch(_){abandon();stop();}finally{active=false;if(work)await work.catch(()=>{});}
   },
   receive:async request=>{
    let claimed=false;
    try{
     integrity();if(cancellationRequested||!submitAdmitted||journal.stage!=='waiting'||!only(request,['method','host','url'])||request.method!=='GET'||request.host!=='127.0.0.1:34763'||typeof request.url!=='string'||request.url.length>16000||!request.url.startsWith('/oauth/callback?')||request.url.includes('#'))stop();
     const u=new URL(request.url,AUTHORITY_TRIAL_REDIRECT_URI),p=u.searchParams;
     if(u.origin!=='http://127.0.0.1:34763'||u.pathname!=='/oauth/callback'||[...p.keys()].some(k=>p.getAll(k).length!==1))stop();
     const incoming=p.get('state');if(typeof incoming!=='string'||incoming.length!==state.length||!timingSafeEqual(Buffer.from(incoming),Buffer.from(state)))stop();
     write({stage:'claimed',attempted:true});claimed=true;live();
     const allowed=['state','code','error','error_description','error_subtype','scope','authuser','prompt','hd'];
     if([...p.keys()].some(k=>!allowed.includes(k))||p.has('error')||!secret(p.get('code'))||p.get('code').length>4096||(p.has('scope')&&!scopes(p.get('scope'))))stop();
     if(!submitSettled){buffered=p;return;}
     await processResponse(p);
    }catch(_){if(claimed)abandon();stop();}
   },credential:()=>{try{integrity();if(cancellationRequested||journal.stage!=='ready'||!verified||verified.expiresAt-now()<=360000||now()>=expiresAt)stop();return verified;}catch(_){try{cancelLocally('cancelled');}catch(_){}stop();}},
   requestCancellation:()=>cancelLocally('cancelled'),
   cancel:async()=>{let failed=false;try{cancelLocally('cancelled');}catch(_){failed=true;}try{await revoke();}catch(_){failed=true;}if(failed)stop();}
  });return flow;
 }catch(_){stop();}
}
export async function startAuthorityTrialOAuthListener(flow){
 let server,timer;
 try{
  if(!flow||flow.status()!=='waiting'||flow.remainingMs()<=0)stop();
  const headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'",'x-content-type-options':'nosniff',connection:'close'};
  let closing;
  const close=()=>{
   if(closing)return closing;
   closing=new Promise(resolve=>{if(timer)clearTimeout(timer);if(!server?.listening)return resolve();server.close(resolve);server.closeIdleConnections();});return closing;
  };
  server=createServer(async(req,res)=>{
   if(req.headers.host!=='127.0.0.1:34763'||req.method!=='GET'){res.writeHead(400,headers);res.end('Request unavailable.');return;}
   if(req.url==='/oauth/result'){
    if(!['claimed','ready','failed','cancelled'].includes(flow.status())){res.writeHead(404,headers);res.end('Request unavailable.');return;}
    res.writeHead(200,headers);if(flow.status()==='claimed')res.end('OAuth response pending. Return to Codex.');else{res.end('OAuth response processed. Return to Codex.');void close();}return;
   }
   try{await flow.receive({method:req.method,host:req.headers.host,url:req.url});res.writeHead(303,{...headers,location:'/oauth/result'});res.end();}
   catch(_){if(['failed','cancelled'].includes(flow.status())){res.writeHead(303,{...headers,location:'/oauth/result'});res.end();}else{res.writeHead(400,headers);res.end('OAuth response unavailable. Return to Codex.');}}
  });
  server.on('error',()=>{try{flow.requestCancellation();}catch(_){}void close();});
  server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=20;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(34763,'127.0.0.1',resolve);});
  timer=setTimeout(()=>{try{flow.requestCancellation();}catch(_){}void close();},flow.remainingMs());timer.unref();
  return Object.freeze({close:async()=>{try{if(['waiting','claimed'].includes(flow.status()))flow.requestCancellation();}finally{await close();}}});
 }catch(_){if(timer)clearTimeout(timer);try{flow.requestCancellation();}catch(_){}if(server?.listening)await new Promise(r=>server.close(r));stop();}
}
