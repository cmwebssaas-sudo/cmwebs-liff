// Test-only local emulator instrumentation. Never imported by product Worker.
import {createHash} from 'node:crypto';
import {D1_PLUGIN} from 'miniflare';
const expected='0b618134d70e985306907b5b0b67c67bddc5322d8c624ac04667ede75415b7dc';
const fail=()=>{throw Error('D1_DIAGNOSTIC_SOURCE_UNVERIFIED');};
export function instrumentD1ActorSource(source){
 if(typeof source!=='string'||source.length>262144)fail();
 const cut=source.lastIndexOf('//# sourceURL='),body=cut<0?source:source.slice(0,cut),suffix=cut<0?'':source.slice(cut);
 if(/[\n\r\u2028\u2029]/.test(suffix)||createHash('sha256').update(body).digest('hex')!==expected)fail();
 const enter='  queryExecute = async (req) => {\n',response='    return Response.json(results, {\n';
 if(body.split(enter).length!==2||body.split(response).length!==2)fail();
 return body.replace(enter,enter+'    const __cmwebsActorStarted = performance.now();\n').replace(response,
  '    const __cmwebsActorMeta = results.at(-1)?.meta;\n'+
  '    if (!__cmwebsActorMeta) throw Error("D1_DIAGNOSTIC_META_UNAVAILABLE");\n'+
  '    Object.defineProperty(__cmwebsActorMeta, "cmwebs_test_actor_entry_to_txn_ms", { enumerable: true, value: performance.now() - __cmwebsActorStarted });\n'+
  '    Object.defineProperty(__cmwebsActorMeta, "cmwebs_test_actor_json_tail_ms", { enumerable: true, get: () => performance.now() - __cmwebsActorStarted });\n'+response)+suffix;
}
export function instrumentD1Services(services){
 if(!Array.isArray(services)||services.filter(service=>service?.name==='d1:db').length!==1)fail();
 return services.map(service=>{
  if(service.name!=='d1:db')return service;
  const modules=service.worker?.modules;
  if(!Array.isArray(modules)||modules.length!==1||modules[0]?.name!=='database.worker.js')fail();
  return {...service,worker:{...service.worker,modules:[{...modules[0],esModule:instrumentD1ActorSource(modules[0].esModule)}]}};
 });
}
let active=false;
// Caller owns constructor AND disposal inside this scope. Outer finally restores
// the hook even when either throws; overlapping lifetimes cannot share a hook.
export async function withD1ActorTiming(run){
 if(active)throw Error('D1_DIAGNOSTIC_OVERLAP');
 if(typeof run!=='function')throw TypeError('D1_DIAGNOSTIC_CALLBACK_REQUIRED');
 const original=D1_PLUGIN.getServices;
 active=true;
 D1_PLUGIN.getServices=async function(options){return instrumentD1Services(await original.call(this,options));};
 try{return await run();}finally{D1_PLUGIN.getServices=original;active=false;}
}
