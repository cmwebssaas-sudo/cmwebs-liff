import { createReadAccessVerifier, readAccessFailure } from './read-http.js';
import { createReadCalculator } from './read-calculator.js';
import { createReadServices } from './read-runtime.js';
import { DATA_INTENTS, dataIntentById, dataCatalog } from './assistant-data.js';

// Landlord assistant: the page sends a question and its function catalog; the
// AI-00 bridge (reached through the Workers VPC binding) picks one catalog id.
// The bridge only ever sees the question and the catalog. When it picks a data
// intent (ask_*), the Worker answers from the Workspace-scoped read calculator.
// Only allowlisted Workspaces may use it.
const origin='https://cmwebssaas-sudo.github.io';
const BRIDGE_URL='http://127.0.0.1:18760/v1/answer';
const MAX_BODY=16*1024,MAX_QUESTION=200,MAX_CATALOG=80,MAX_FUNCTION_REPLY=200,MAX_DATA_REPLY=1500;
const SYNC_MESSAGE='資料正在同步，請稍後再問一次。';

function reply(body,status,requestOrigin) {
  const headers={'cache-control':'no-store'};
  if(requestOrigin===origin){headers['access-control-allow-origin']=origin;headers.vary='Origin';}
  return Response.json(body,{status,headers});
}
const fail=(code,status,requestOrigin)=>reply({success:false,code},status,requestOrigin);

function text(value,limit){return String(value==null?'':value).trim().slice(0,limit);}

export function parseAssistantRequest(raw) {
  let payload;
  try{payload=JSON.parse(raw);}catch{return null;}
  if(!payload||typeof payload!=='object'||Array.isArray(payload)) return null;
  const question=String(payload.question==null?'':payload.question).trim();
  if(!question||question.length>MAX_QUESTION) return null;
  if(!Array.isArray(payload.catalog)||!payload.catalog.length||payload.catalog.length>MAX_CATALOG-DATA_INTENTS.length) return null;
  const catalog=[];
  for(const item of payload.catalog) {
    if(!item||typeof item!=='object') return null;
    const id=text(item.id,40),title=text(item.title,60);
    if(!/^[a-z0-9_]+$/.test(id)||id==='none'||id.startsWith('ask_')||!title) return null;
    const keywords=Array.isArray(item.keywords)?item.keywords.slice(0,20).map(value=>text(value,20)).filter(Boolean):[];
    catalog.push({id,title,keywords});
  }
  return {question,catalog};
}

const squash=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
// The model sometimes repeats the question as its reply. That says nothing.
export function functionReply(replyText,question) {
  const cleaned=text(replyText,MAX_FUNCTION_REPLY),a=squash(cleaned),q=squash(question);
  return !a||q.includes(a)?'':cleaned;
}

export function assistantEnabledFor(env,workspaceId) {
  return String(env.ASSISTANT_AI_WORKSPACES||'').split(',').map(value=>value.trim()).filter(Boolean).includes(String(workspaceId||''));
}

async function answerData(intent,question,loader,access,runtimeOptions) {
  try {
    await loader.checkReplica();
    await loader.checkHeartbeat();
  } catch {
    return {ok:true,synced:false,reply:SYNC_MESSAGE};
  }
  try {
    const dataset=await loader.loadDataset(access);
    const calculator=createReadCalculator(createReadServices(dataset,access,runtimeOptions,true));
    const now=runtimeOptions&&runtimeOptions.now!=null?runtimeOptions.now:Date.now();
    const today=new Date(Number(now)+8*3600000).toISOString().slice(0,10);
    return {ok:true,synced:true,reply:text(intent.answer(question,calculator,access.line_user_id,today),MAX_DATA_REPLY)};
  } catch {
    return {ok:false};
  }
}

export function createAssistantHandler(options={}) {
  // Tests may pass a verifier; production always uses the read access verifier.
  const verify=options.verify||createReadAccessVerifier(options);
  return async function handle(request,env) {
    const requestOrigin=request.headers.get('origin');
    if(requestOrigin!==null&&requestOrigin!==origin) return fail('ORIGIN_FORBIDDEN',403,null);
    if(request.method==='OPTIONS') {
      const requested=(request.headers.get('access-control-request-headers')||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
      if(requestOrigin!==origin||request.headers.get('access-control-request-method')!=='POST'||
        requested.some(value=>!['authorization','content-type'].includes(value))) return fail('INVALID_PREFLIGHT',403,requestOrigin);
      return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'POST',
        'access-control-allow-headers':'Authorization, Content-Type','access-control-max-age':'600','cache-control':'no-store','vary':'Origin'}});
    }
    if(request.method!=='POST') return fail('METHOD_NOT_ALLOWED',405,requestOrigin);
    if(!env.DB||!env.ASSISTANT_BRIDGE||!env.CMWEBS_ASSISTANT_TOKEN) return fail('ASSISTANT_NOT_READY',503,requestOrigin);
    let access,loader,runtimeOptions;
    try {
      ({access,loader,runtimeOptions}=await verify(request,env,{telemetryOnly:true}));
    } catch(error) {
      const denied=readAccessFailure(error);
      const body=await denied.json();
      return reply(body,denied.status,requestOrigin);
    }
    if(!assistantEnabledFor(env,access.workspace&&access.workspace.workspace_id)) return fail('ASSISTANT_NOT_ENABLED',403,requestOrigin);
    const raw=await request.text();
    if(raw.length>MAX_BODY) return fail('BODY_TOO_LARGE',413,requestOrigin);
    const parsed=parseAssistantRequest(raw);
    if(!parsed) return fail('INVALID_REQUEST',400,requestOrigin);
    const started=Date.now();
    const log=(status,kind)=>{try{console.log('ASSISTANT '+JSON.stringify({status,kind,ms:Date.now()-started}));}catch{}};
    try {
      const response=await env.ASSISTANT_BRIDGE.fetch(BRIDGE_URL,{method:'POST',
        headers:{authorization:'Bearer '+env.CMWEBS_ASSISTANT_TOKEN,'content-type':'application/json'},
        body:JSON.stringify({question:parsed.question,catalog:[...parsed.catalog,...dataCatalog()]}),signal:AbortSignal.timeout(options.timeoutMs||25000)});
      const result=await response.json().catch(()=>null);
      if(!response.ok||!result||result.success!==true||!result.data) {
        log(response.status,'bridge_error');
        return fail(result&&result.code==='ASSISTANT_BUSY'?'ASSISTANT_BUSY':'ASSISTANT_UNAVAILABLE',503,requestOrigin);
      }
      const intent=dataIntentById.get(result.data.id);
      if(intent) {
        const answered=await answerData(intent,parsed.question,loader,access,runtimeOptions);
        log(response.status,!answered.ok?'data_error':answered.synced?'data':'data_sync');
        if(!answered.ok) return fail('ASSISTANT_UNAVAILABLE',503,requestOrigin);
        return reply({success:true,data:{id:intent.go,reply:answered.reply,kind:'data'}},200,requestOrigin);
      }
      const ids=new Set(parsed.catalog.map(item=>item.id));
      const id=ids.has(result.data.id)?result.data.id:'none';
      log(response.status,id==='none'?'none':'function');
      return reply({success:true,data:{id,reply:functionReply(result.data.reply,parsed.question)}},200,requestOrigin);
    } catch {
      log('error','error');
      return fail('ASSISTANT_UNAVAILABLE',503,requestOrigin);
    }
  };
}
