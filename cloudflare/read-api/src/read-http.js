import { createIdentityAuthenticator,readCredential } from './read-identity.js';
import { createReadDatasetLoader } from './read-dataset.js';
import { serveReadRoute, validateReadRequest, readFailure } from './read-routes.js';
import { confirmReadAuthority } from './read-authority.js';
import { beginShadowAttempt,finishShadowAttempt } from './shadow-observation.js';

const origin='https://cmwebssaas-sudo.github.io';
const deniedCodes=new Set(['AUTH_REQUIRED','SESSION_REVOKED','SESSION_EXPIRED']);
const unavailableCodes=new Set(['AUTH_UNAVAILABLE','READ_IDENTITY_UNSUPPORTED','READ_SYNC_UNVERIFIED','READ_SYNC_INCOMPLETE','READ_SYNC_STALE','READ_SYNC_PENDING','READ_AUTHORITY_UNAVAILABLE','READ_AUTH_STATE_CHANGED','SHADOW_NOT_READY']);
const accessCodes=new Set(['USER_ACCOUNT_INACTIVE','WORKSPACE_REQUIRED','WORKSPACE_INACTIVE','MEMBERSHIP_INACTIVE','ONBOARDING_REQUIRED','PERMISSION_DENIED','WORKSPACE_FORBIDDEN']);

// Tests may supply explicit fetch/clock/sync adapters. No env value
// can inject an access object, dataset or provider verification result.
export function createReadHttpHandler(options={}) {
  const verify=createReadAccessVerifier(options);
  return async function handle(request,env) {
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
    try {
      // Resolve current authority before recording an eligible attempt. Dirty
      // state is then enforced before any operational dataset/calculation.
      const {loader,access,runtimeOptions,authority}=await verify(request,env,{telemetryOnly:true,
        onResolvedAccess:async access=>{attempt=await beginShadowAttempt(request,env,access,typeof options.now==='function'?options.now():Date.now());}});
      if(authority.replica_dirty) throw Object.assign(Error('READ_SYNC_PENDING'),{code:'READ_SYNC_PENDING'});
      await (options.checkReplica?options.checkReplica(env.DB,request):loader.checkReplica());
      return cors(await finishShadowAttempt(env,attempt,await serveReadRoute(request,{access,loadDataset:loader.loadDataset,options:runtimeOptions})));
    } catch(error) {
      const response=readAccessFailure(error);
      try {return cors(await finishShadowAttempt(env,attempt,response));}catch{return cors(readFailure('READ_REPLICA_UNAVAILABLE'));}
    }
  };
}

export function readAccessFailure(error) {
  const code=error?.code;
  if(deniedCodes.has(code)) return readFailure(code,401);
  if(unavailableCodes.has(code)) return readFailure(code);
  if(accessCodes.has(code)) return readFailure(code,403);
  return readFailure('READ_REPLICA_UNAVAILABLE');
}
export function createReadAccessVerifier(options={}) {
  const authenticate=createIdentityAuthenticator(options);
  return async function verify(request,env,{telemetryOnly=false,onResolvedAccess}={}) {
    readCredential(request);
    const runtimeOptions={...options,now:typeof options.now==='function'?options.now():options.now};
    const loader=createReadDatasetLoader(env.DB,runtimeOptions);
    if(!telemetryOnly) await (options.checkReplica?options.checkReplica(env.DB,request):loader.checkReplica());
    const identity=await authenticate(request,env,{findSession:loader.findSession});
    const access=await loader.resolveAccess(identity);
    if(onResolvedAccess) await onResolvedAccess(access);
    const authority=await confirmReadAuthority(request,env,access,{now:options.now,fetch:options.authorityFetch||options.fetch,telemetryOnly});
    return {loader,access,runtimeOptions,authority};
  };
}
