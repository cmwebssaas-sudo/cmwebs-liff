import fields from '../shadow-fields.json' with {type:'json'};
import clockFields from '../shadow-clock-fields.json' with {type:'json'};
import { createReadAccessVerifier,readAccessFailure } from './read-http.js';
import { readCredential } from './read-identity.js';
import { readFailure } from './read-routes.js';
import { shadowConfiguration,shadowIdentity } from './shadow-observation.js';
const allowedFields=new Set([...fields,'length']);
const routes=new Set(['home','revenue','tenants','rooms','arrears','properties']);
const origin='https://cmwebssaas-sudo.github.io';
function invalid(){throw Object.assign(Error('INVALID_SHADOW_REPORT'),{code:'INVALID_SHADOW_REPORT'});}
function validPath(path) {
  if(typeof path!=='string'||path.length>200) return false;
  if(path==='$') return true;
  const tokens=path.split('.');
  return tokens.length<=32&&tokens.every(token=>{
    const match=/^([a-z_]+|\[field\])((?:\[\])*)$/.exec(token);
    return match&&(match[1]==='[field]'||allowedFields.has(match[1]));
  });
}
export function validateShadowReport(body,release) {
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='clock_paths,elapsed_ms,headers_ms,outcome,paths,receipt,release,route,variant'||
    !routes.has(body.route)||body.release!==release||typeof release!=='string'||!release||
    !(body.route==='home'?['home','actions'].includes(body.variant):body.variant==='default')||
    !['compared','worker_error'].includes(body.outcome)||!Array.isArray(body.paths)||body.paths.length>100||
    new Set(body.paths).size!==body.paths.length||body.paths.some(path=>!validPath(path))) invalid();
  const clockPath=clockFields[body.route]?.[body.variant];
  if(!Array.isArray(body.clock_paths)||body.clock_paths.length>1||body.clock_paths.some(path=>path!==clockPath||body.paths.includes(path))) invalid();
  if(body.outcome==='compared') {
    if(typeof body.receipt!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.receipt)) invalid();
    if(!Number.isFinite(body.headers_ms)||!Number.isFinite(body.elapsed_ms)||body.headers_ms<0||body.elapsed_ms<body.headers_ms||body.elapsed_ms>3000) invalid();
  } else if(body.paths.length||body.clock_paths.length||body.headers_ms!==null||body.elapsed_ms!==null||body.receipt!==null) invalid();
  return body;
}
async function bodyJson(request) {
  if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json'||!request.body) invalid();
  const reader=request.body.getReader(),chunks=[];let size=0,timer;
  try {
    const bytes=await Promise.race([(async()=>{
      while(true){const {done,value}=await reader.read();if(done) break;size+=value.byteLength;if(size>24000) invalid();chunks.push(value);}
      const output=new Uint8Array(size);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength;}return output;
    })(),new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('INVALID_SHADOW_REPORT'),{code:'INVALID_SHADOW_REPORT'})),1000);})]);
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } catch(error) {try{await reader.cancel();}catch{} invalid();}
  finally {clearTimeout(timer);reader.releaseLock();}
}
export function createShadowHttpHandler(options={}) {
  const verify=createReadAccessVerifier(options),clock=options.now||Date.now;
  return async function shadow(request,env) {
    const requestOrigin=request.headers.get('origin');
    if(requestOrigin!==null&&requestOrigin!==origin) return readFailure('ORIGIN_FORBIDDEN',403);
    function cors(response){if(requestOrigin===origin){response.headers.set('access-control-allow-origin',origin);response.headers.set('vary','Origin');}return response;}
    if(request.method==='OPTIONS') {
      const headers=(request.headers.get('access-control-request-headers')||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
      if(requestOrigin!==origin||request.headers.get('access-control-request-method')!=='POST'||headers.some(value=>!['authorization','content-type'].includes(value))) return cors(readFailure('INVALID_PREFLIGHT',403));
      return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'POST','access-control-allow-headers':'Authorization, Content-Type','cache-control':'no-store','vary':'Origin'}});
    }
    if(request.method!=='POST') return cors(readFailure('METHOD_NOT_ALLOWED',405,{allow:'POST'}));
    if(new URL(request.url).search) return cors(readFailure('INVALID_SHADOW_REPORT',400));
    try {
      const {epoch,release}=shadowConfiguration(env,clock());
      readCredential(request);
      const body=validateShadowReport(await bodyJson(request),release);
      // Body selects only a fixed read route; identity/scope remain server-only.
      const proofUrl=new URL(request.url);proofUrl.pathname='/v1/'+body.route;
      const {access,loader,authority}=await verify(new Request(proofUrl,{headers:request.headers}),env,{telemetryOnly:true});
      if(body.outcome==='compared') {
        if(authority.replica_dirty) return cors(readFailure('READ_SYNC_PENDING'));
        await loader.checkReplica();
      }
      const {scope,actor}=await shadowIdentity(access,env.READ_REPLICA_SYNC_SECRET);
      const id=crypto.randomUUID(),at=new Date(clock()).toISOString(),cutoff=new Date(clock()-300000).toISOString();
      const db=env.DB.withSession('first-primary');
      const receipt=body.outcome==='compared';
      const receiptWhere=`attempt_id=? AND scope_hash=? AND actor_hash=? AND epoch=? AND release_id=? AND route=? AND variant=? AND outcome='completed' AND status=200 AND observed_at>=? AND report_id IS NULL`;
      const receiptParams=[body.receipt,scope,actor,epoch,release,body.route,body.variant,cutoff];
      if(receipt&&!await db.prepare(`SELECT attempt_id FROM shadow_attempts WHERE ${receiptWhere}`).bind(...receiptParams).first()) return cors(readFailure('INVALID_SHADOW_RECEIPT',409));
      const queries=[db.prepare(`INSERT INTO shadow_reports(report_id,scope_hash,actor_hash,epoch,release_id,route,variant,outcome,headers_ms,elapsed_ms,field_count,observed_at,attempt_id,clock_count)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM shadow_reports WHERE actor_hash=? AND observed_at>=?)<120
        ${receipt?'AND EXISTS(SELECT 1 FROM shadow_attempts WHERE '+receiptWhere+')':''} RETURNING report_id`)
        .bind(id,scope,actor,epoch,release,body.route,body.variant,body.outcome,body.headers_ms,body.elapsed_ms,body.paths.length,at,body.receipt,body.clock_paths.length,actor,cutoff,...(receipt?receiptParams:[]))];
      body.paths.forEach((path,index)=>queries.push(db.prepare(`INSERT INTO shadow_diffs(report_id,route,field_path,observed_at,observation_id)
        SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM shadow_reports WHERE report_id=?)`).bind(id+':'+index,body.route,path,at,id,id)));
      body.clock_paths.forEach((path,index)=>queries.push(db.prepare(`INSERT INTO shadow_clock_diffs(report_id,observation_id,route,variant,field_path,observed_at)
        SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM shadow_reports WHERE report_id=?)`).bind(id+':clock:'+index,id,body.route,body.variant,path,at,id)));
      if(receipt) queries.push(db.prepare(`UPDATE shadow_attempts SET report_id=? WHERE ${receiptWhere} AND EXISTS(SELECT 1 FROM shadow_reports WHERE report_id=?)`).bind(id,...receiptParams,id));
      const results=await db.batch(queries);
      if(results.some(result=>!result.success)) throw Error('Unavailable');
      if(!results[0].results?.length) {
        const count=await db.prepare('SELECT COUNT(*) AS n FROM shadow_reports WHERE actor_hash=? AND observed_at>=?').bind(actor,cutoff).first();
        return cors(readFailure(count.n>=120?'SHADOW_RATE_LIMIT':'INVALID_SHADOW_RECEIPT',count.n>=120?429:409));
      }
      return cors(Response.json({success:true,code:'OK',data:{report_id:id}},{headers:{'cache-control':'no-store'}}));
    } catch(error) {
      return cors(error?.code==='INVALID_SHADOW_REPORT'?readFailure('INVALID_SHADOW_REPORT',400):readAccessFailure(error));
    }
  };
}
