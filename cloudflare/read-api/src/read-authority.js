import { readCredential } from './read-identity.js';
import { createReadCalculator } from './read-calculator.js';
import { createReplicaRuntime } from './read-runtime.js';
const encoder=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
function failure(code='READ_AUTHORITY_UNAVAILABLE'){throw Object.assign(new Error(code),{code});}
async function mac(domain,text,secret) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(domain+'\n'+text)));
}
async function boundedBody(response) {
  if(!response.body) failure();
  const reader=response.body.getReader(),chunks=[];
  let length=0;
  try {
    while(true) {
      const {done,value}=await reader.read();if(done) break;
      length+=value.byteLength;
      if(length>20000) {await reader.cancel();failure();}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export function readAccessFingerprint(access) {
  return createReadCalculator(createReplicaRuntime({})).readAuthorizationFingerprint_(access);
}
export async function confirmReadAuthority(request,env,access,options={}) {
  const endpoint=env.READ_AUTHORITY_URL,secret=env.READ_REPLICA_SYNC_SECRET;
  if(typeof endpoint!=='string'||!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]{10,}\/exec$/.test(endpoint)||typeof secret!=='string'||secret.length<16) failure();
  const credential=readCredential(request),clock=options.now||Date.now,fetcher=options.fetch||fetch;
  const timestamp=clock(),nonce=crypto.randomUUID(),route=new URL(request.url).pathname;
  const digest=hex(await crypto.subtle.digest('SHA-256',encoder.encode(credential.kind+':'+credential.token)));
  const payload=JSON.stringify({credential:credential.token,credential_digest:digest,protocol:credential.kind,route});
  const signature=await mac('cmwebs-read-auth-request-v1',timestamp+'\n'+nonce+'\n'+payload,secret);
  try {
    const signal=AbortSignal.timeout(1500);
    let response=await fetcher(endpoint,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({action:'read_replica_authorize',timestamp,nonce,payload,signature}),redirect:'manual',signal});
    if(response.status===302||response.status===303) {
      const location=new URL(response.headers.get('location')||'',endpoint);
      if(location.protocol!=='https:'||location.hostname!=='script.googleusercontent.com'||location.username||location.password||location.port||location.pathname!=='/macros/echo') failure();
      response=await fetcher(location.href,{method:'GET',redirect:'error',signal});
    }
    if(response.status!==200) failure();
    const raw=await boundedBody(response);
    const envelope=JSON.parse(raw);
    if(!envelope||Object.keys(envelope).sort().join(',')!=='body,signature'||typeof envelope.body!=='string'||typeof envelope.signature!=='string'||!/^[a-f0-9]{64}$/.test(envelope.signature)) failure();
    // Compare a fixed-size MAC with WebCrypto rather than ordinary string equality.
    const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    const bytes=Uint8Array.from(envelope.signature.match(/../g),part=>parseInt(part,16));
    if(!await crypto.subtle.verify('HMAC',key,bytes,encoder.encode('cmwebs-read-auth-response-v1\n'+envelope.body))) failure();
    const body=JSON.parse(envelope.body),now=clock();
    if(!body||Object.keys(body).sort().join(',')!=='credential_digest,expires_at,issued_at,nonce,result,route'||
      body.nonce!==nonce||body.credential_digest!==digest||body.route!==route||
      !Number.isSafeInteger(body.issued_at)||!Number.isSafeInteger(body.expires_at)||body.expires_at-body.issued_at!==5000||
      body.issued_at>now+1000||body.expires_at<=now||now-timestamp>15000) failure();
    if(body.result?.success!==true) failure('AUTH_REQUIRED');
    if(typeof body.result.replica_dirty!=='boolean') failure();
    // Trusted handlers may inspect pending state for telemetry. The operational
    // HTTP handler must reject it before loading any data. No env/body/query
    // can supply this option.
    if(body.result.replica_dirty!==false && options.telemetryOnly!==true) failure('READ_SYNC_PENDING');
    if(JSON.stringify(body.result.fingerprint)!==JSON.stringify(readAccessFingerprint(access))) failure('READ_AUTH_STATE_CHANGED');
    return {replica_dirty:body.result.replica_dirty};
  } catch(error) {
    if(['AUTH_REQUIRED','READ_AUTH_STATE_CHANGED','READ_SYNC_PENDING'].includes(error?.code)) throw error;
    failure();
  }
}
