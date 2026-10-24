import { createIdentityAuthenticator,readCredential } from './read-identity.js';
import { createReadDatasetLoader } from './read-dataset.js';
import { serveReadRoute, validateReadRequest, readFailure } from './read-routes.js';
import { confirmReadAuthority } from './read-authority.js';

const origin='https://cmwebssaas-sudo.github.io';
const deniedCodes=new Set(['AUTH_REQUIRED','SESSION_REVOKED','SESSION_EXPIRED']);
const unavailableCodes=new Set(['AUTH_UNAVAILABLE','READ_IDENTITY_UNSUPPORTED','READ_SYNC_UNVERIFIED','READ_SYNC_INCOMPLETE','READ_SYNC_STALE','READ_SYNC_PENDING','READ_AUTHORITY_UNAVAILABLE','READ_AUTH_STATE_CHANGED']);
const accessCodes=new Set(['USER_ACCOUNT_INACTIVE','WORKSPACE_REQUIRED','WORKSPACE_INACTIVE','MEMBERSHIP_INACTIVE','ONBOARDING_REQUIRED','PERMISSION_DENIED','WORKSPACE_FORBIDDEN']);

// Tests may supply explicit fetch/clock/sync adapters. No env value
// can inject an access object, dataset or provider verification result.
export function createReadHttpHandler(options={}) {
  const authenticate=createIdentityAuthenticator(options);
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
      if(requestOrigin!==origin||request.headers.get('access-control-request-method')!=='GET'||requestedHeaders.some(value=>!['authorization','content-type'].includes(value))) return cors(readFailure('INVALID_PREFLIGHT',403));
      return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET','access-control-allow-headers':'Authorization, Content-Type','cache-control':'no-store','vary':'Origin'}});
    }
    const invalid=validateReadRequest(request);
    if(invalid) return cors(invalid);
    if(!env.DB) return cors(readFailure('READ_AUTH_NOT_READY'));
    try {
      readCredential(request);
      const runtimeOptions={...options,now:typeof options.now==='function'?options.now():options.now};
      const loader=createReadDatasetLoader(env.DB,runtimeOptions);
      await (options.checkReplica?options.checkReplica(env.DB,request):loader.checkReplica());
      const identity=await authenticate(request,env,{findSession:loader.findSession});
      const access=await loader.resolveAccess(identity);
      await confirmReadAuthority(request,env,access,{now:options.now,fetch:options.authorityFetch||options.fetch});
      return cors(await serveReadRoute(request,{access,loadDataset:loader.loadDataset,options:runtimeOptions}));
    } catch(error) {
      const code=error?.code;
      if(deniedCodes.has(code)) return cors(readFailure(code,401));
      if(unavailableCodes.has(code)) return cors(readFailure(code));
      if(accessCodes.has(code)) return cors(readFailure(code,403));
      return cors(readFailure('READ_REPLICA_UNAVAILABLE'));
    }
  };
}
