import comparisonManifest from '../read-comparison-manifest.json' with { type: 'json' };
const encoder=new TextEncoder();
async function hash(domain,text,secret) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(domain+'\n'+text)))].map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function shadowConfiguration(env,now) {
  const epoch=env.READ_SHADOW_EPOCH,release=env.READ_SHADOW_RELEASE,start=Date.parse(env.READ_SHADOW_STARTED_AT);
  if(release!==comparisonManifest.comparison_version||!env.DB||typeof epoch!=='string'||!/^[a-zA-Z0-9_-]{8,64}$/.test(epoch)||typeof release!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(release)||
    !Number.isFinite(start)||new Date(start).toISOString()!==env.READ_SHADOW_STARTED_AT||start>now)
    throw Object.assign(Error('SHADOW_NOT_READY'),{code:'SHADOW_NOT_READY'});
  return {epoch,release,start};
}
export async function shadowIdentity(access,secret) {
  const scope=await hash('cmwebs-shadow-scope-v1',String(access.workspace.workspace_id).toUpperCase(),secret);
  const actor=await hash('cmwebs-shadow-actor-v1',scope+':'+access.user.user_id,secret);
  return {scope,actor};
}
export async function beginShadowAttempt(request,env,access,now,authKind) {
  if(request.headers.get('x-cmwebs-read-mode')!=='shadow') return null;
  if(!['line','email'].includes(authKind)) throw Error('Shadow identity unavailable');
  const {epoch,release}=shadowConfiguration(env,now),{scope,actor}=await shadowIdentity(access,env.READ_REPLICA_SYNC_SECRET);
  const url=new URL(request.url),route=url.pathname.slice('/v1/'.length),variant=route==='home'?(url.searchParams.get('section')||'home'):'default';
  const id=crypto.randomUUID();
  const result=await env.DB.withSession('first-primary').prepare(`INSERT INTO shadow_attempts(attempt_id,scope_hash,actor_hash,epoch,release_id,route,variant,outcome,observed_at,auth_kind)
    VALUES(?,?,?,?,?,?,?,'started',?,?)`).bind(id,scope,actor,epoch,release,route,variant,new Date(now).toISOString(),authKind).run();
  if(!result.success||result.meta.changes!==1) throw Error('Shadow observation unavailable');
  return id;
}
export async function finishShadowAttempt(env,id,response) {
  if(!id) return response;
  const result=await env.DB.withSession('first-primary').prepare("UPDATE shadow_attempts SET outcome='completed',status=? WHERE attempt_id=? AND outcome='started'").bind(response.status,id).run();
  if(!result.success||result.meta.changes!==1) throw Error('Shadow observation unavailable');
  response.headers.set('x-cmwebs-shadow-receipt',id);
  response.headers.set('access-control-expose-headers','X-CMWebs-Shadow-Receipt');
  return response;
}
