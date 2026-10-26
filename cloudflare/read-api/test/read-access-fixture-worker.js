// Synthetic D1 boundary test entry. Not imported by the production Worker.
import { createReadDatasetLoader } from '../src/read-dataset.js';
import { serveReadRoute } from '../src/read-routes.js';
import { createReadHttpHandler } from '../src/read-http.js';
import { createShadowHttpHandler } from '../src/read-shadow.js';
let httpHandler,shadowHandler;
// Test-only counts of attempted SDK calls/statements. The summed awaited-call
// wall time is not SQL CPU, production/network latency, or a p95 measurement.
function observedDatabase(database,stats) {
  const original=new WeakMap();
  async function observe(count,batch,work) {
    stats.statements+=count;stats[batch?'batch_calls':'single_calls']++;
    const start=performance.now();try{return await work();}
    finally{stats.summed_call_ms+=performance.now()-start;}
  }
  function statement(raw) {
    const wrapped={bind:(...values)=>statement(raw.bind(...values)),
      all:(...args)=>observe(1,false,()=>raw.all(...args)),
      first:(...args)=>observe(1,false,()=>raw.first(...args)),
      run:(...args)=>observe(1,false,()=>raw.run(...args)),
      raw:(...args)=>observe(1,false,()=>raw.raw(...args))};
    original.set(wrapped,raw);return wrapped;
  }
  return {prepare:sql=>database.prepare(sql),batch:statements=>database.batch(statements),withSession:constraint=>{
    if(constraint!=='first-primary')throw Error('TEST_SESSION_NOT_PRIMARY');
    stats.primary_sessions++;const session=database.withSession(constraint);
    return {prepare:sql=>statement(session.prepare(sql)),batch:statements=>{
      const raw=statements.map(value=>original.get(value));
      if(raw.some(value=>!value))throw Error('TEST_STATEMENT_UNAVAILABLE');
      stats.batch_sizes.push(raw.length);
      return observe(raw.length,true,()=>session.batch(raw));
    }};
  }};
}
export default {
  async fetch(request,env) {
    const stats={primary_sessions:0,single_calls:0,batch_calls:0,statements:0,summed_call_ms:0,batch_sizes:[]};
    const database=observedDatabase(env.DB,stats);let response;
    if(new URL(request.url).pathname.startsWith('/http/')) {
      const options={now:()=>Number(env.FIXTURE_NOW),authorityFetch:fetch,
        fetch:async(_url,options)=>{
          const token=new URLSearchParams(options.body).get('id_token');
          if(token!=='synthetic-valid-line-token') return new Response('',{status:401});
          return Response.json({iss:'https://access.line.me',aud:env.LINE_LOGIN_CHANNEL_ID,sub:'SYNTHETIC_LINE1',exp:Number(env.FIXTURE_NOW)/1000+600});
        }};
      httpHandler ||= createReadHttpHandler(options);
      shadowHandler ||= createShadowHttpHandler(options);
      const url=new URL(request.url);url.pathname=url.pathname.slice(5);
      response=await (url.pathname==='/v1/shadow-report'?shadowHandler:httpHandler)(new Request(url,request),{...env,DB:database});
    }else{
    const loader=createReadDatasetLoader(database,{now:Number(env.FIXTURE_NOW)});
    try {
      const access=await loader.resolveAccess(JSON.parse(env.FIXTURE_IDENTITY));
      if(new URL(request.url).pathname==='/inspect')response=Response.json({access,dataset:await loader.loadDataset(access)});
      else response=await serveReadRoute(request,{access,loadDataset:loader.loadDataset,options:{now:Number(env.FIXTURE_NOW)}});
    } catch(error) {response=Response.json({code:error.code||'READ_REPLICA_UNAVAILABLE'},{status:503});}
    }
    response.headers.set('x-cmwebs-test-scoped-d1',JSON.stringify({...stats,summed_call_ms:Number(stats.summed_call_ms.toFixed(3))}));
    return response;
  }
};
