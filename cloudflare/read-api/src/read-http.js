import { createIdentityAuthenticator,readCredential } from './read-identity.js';
import { createReadDatasetLoader } from './read-dataset.js';
import { serveReadRoute, validateReadRequest, readFailure } from './read-routes.js';
import { beginShadowAttempt,finishShadowAttempt } from './shadow-observation.js';

const origin='https://cmwebssaas-sudo.github.io';
const deniedCodes=new Set(['AUTH_REQUIRED','SESSION_REVOKED','SESSION_EXPIRED']);
const unavailableCodes=new Set(['AUTH_UNAVAILABLE','READ_IDENTITY_UNSUPPORTED','READ_SYNC_UNVERIFIED','READ_SYNC_INCOMPLETE','READ_SYNC_STALE','READ_SYNC_PENDING','READ_AUTHORITY_UNAVAILABLE','READ_AUTH_STATE_CHANGED','SHADOW_NOT_READY']);
const accessCodes=new Set(['USER_ACCOUNT_INACTIVE','WORKSPACE_REQUIRED','WORKSPACE_INACTIVE','MEMBERSHIP_INACTIVE','ONBOARDING_REQUIRED','PERMISSION_DENIED','WORKSPACE_FORBIDDEN']);

// Tests may supply explicit fetch/clock/sync adapters. No env value
// can inject an access object, dataset or provider verification result.
export function createReadHttpHandler(options={}) {
  const verify=createReadAccessVerifier(options);
  return async function handle(request,env,ctx) {
    const requestOrigin=request.headers.get('origin');
    if(requestOrigin!==null&&requestOrigin!==origin) return readFailure('ORIGIN_FORBIDDEN',403);
    function cors(response) {
      if(requestOrigin===origin) {
        response.headers.set('access-control-allow-origin',origin);
        response.headers.set('vary','Origin');
      }
      return response;
    }
    if(request.method==='OPTIONS') {
      const requestedHeaders=(request.headers.get('access-control-request-headers')||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
      if(requestOrigin!==origin||request.headers.get('access-control-request-method')!=='GET'||requestedHeaders.some(value=>!['authorization','content-type','x-cmwebs-read-mode'].includes(value))) return cors(readFailure('INVALID_PREFLIGHT',403));
      return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET','access-control-allow-headers':'Authorization, Content-Type, X-CMWebs-Read-Mode','cache-control':'no-store','vary':'Origin'}});
    }
    const invalid=validateReadRequest(request);
    if(invalid) return cors(invalid);
    if(!env.DB) return cors(readFailure('READ_AUTH_NOT_READY'));
    let attempt=null;
    // Stage timings (milliseconds, no identity values) for read latency work.
    const timing={last:Date.now()},started=timing.last,mark=name=>{const at=Date.now();timing[name]=at-timing.last;timing.last=at;};
    const logTiming=status=>{try{const {last,serve_start,...stages}=timing;console.log('READ_TIMING '+JSON.stringify({route:new URL(request.url).pathname,status,total_ms:Date.now()-started,...stages}));}catch{}};
    try {
      // Resolve current authority before recording an eligible attempt. Dirty
      // state is then enforced before any operational dataset/calculation.
      const {loader,access,runtimeOptions}=await verify(request,env,{telemetryOnly:true,onIdentity:()=>mark('identity_ms'),
        onResolvedAccess:async (access,authKind)=>{mark('access_ms');attempt=await beginShadowAttempt(request,env,access,typeof options.now==='function'?options.now():Date.now(),authKind);}});
      mark('authority_ms');
      await (options.checkReplica?options.checkReplica(env.DB,request):loader.checkReplica());
      await loader.checkHeartbeat();
      mark('freshness_ms');
      const served=await serveReadRoute(request,{access,loadDataset:loader.loadDataset,options:runtimeOptions,
        db:env.DB,waitUntil:ctx&&typeof ctx.waitUntil==='function'?promise=>ctx.waitUntil(promise):undefined,timing});
      mark('calculate_ms');
      logTiming(served.status);
      return cors(await finishShadowAttempt(env,attempt,served));
    } catch(error) {
      const response=readAccessFailure(error);
      logTiming(response.status);
      try {return cors(await finishShadowAttempt(env,attempt,response));}catch{return cors(readFailure('READ_REPLICA_UNAVAILABLE'));}
    }
  };
}

export function readAccessFailure(error) {
  const code=error?.code;
  try{console.log('READ_DENIED '+JSON.stringify({stage:'access',code:code||'UNKNOWN'}));}catch{}
  if(deniedCodes.has(code)) return readFailure(code,401);
  if(unavailableCodes.has(code)) return readFailure(code);
  if(accessCodes.has(code)) return readFailure(code,403);
  return readFailure('READ_REPLICA_UNAVAILABLE');
}
export function createReadAccessVerifier(options={}) {
  const authenticate=createIdentityAuthenticator(options);
  return async function verify(request,env,{telemetryOnly=false,onIdentity,onResolvedAccess}={}) {
    readCredential(request);
    const runtimeOptions={...options,now:typeof options.now==='function'?options.now():options.now};
    const loader=createReadDatasetLoader(env.DB,runtimeOptions);
    if(!telemetryOnly) await (options.checkReplica?options.checkReplica(env.DB,request):loader.checkReplica());
    const identity=await authenticate(request,env,{findSession:loader.findSession});
    if(onIdentity) onIdentity();
    // Authority comes from the synced D1 rows (users, memberships, workspaces,
    // Email sessions). Apps Script changes reach D1 within one sync interval.
    const access=await loader.resolveAccess(identity);
    if(onResolvedAccess) await onResolvedAccess(access,identity.kind);
    return {loader,access,runtimeOptions};
  };
}
