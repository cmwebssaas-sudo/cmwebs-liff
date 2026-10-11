// Synthetic D1 boundary test entry. Not imported by the production Worker.
import { createReadDatasetLoader } from '../src/read-dataset.js';
import { serveReadRoute } from '../src/read-routes.js';
import { createReadHttpHandler } from '../src/read-http.js';
import { createShadowHttpHandler } from '../src/read-shadow.js';
let httpHandler,shadowHandler;
export default {
  async fetch(request,env) {
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
      return (url.pathname==='/v1/shadow-report'?shadowHandler:httpHandler)(new Request(url,request),env);
    }
    const loader=createReadDatasetLoader(env.DB,{now:Number(env.FIXTURE_NOW)});
    try {
      const access=await loader.resolveAccess(JSON.parse(env.FIXTURE_IDENTITY));
      if(new URL(request.url).pathname==='/inspect') return Response.json({access,dataset:await loader.loadDataset(access)});
      return serveReadRoute(request,{access,loadDataset:loader.loadDataset,options:{now:Number(env.FIXTURE_NOW)}});
    } catch(error) {return Response.json({code:error.code||'READ_REPLICA_UNAVAILABLE'},{status:503});}
  }
};
