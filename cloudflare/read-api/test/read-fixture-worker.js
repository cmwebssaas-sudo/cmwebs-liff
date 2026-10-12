// Test-only entry point. Wrangler's production entry does not import this file.
import schema from '../schema.json' with {type:'json'};
import { createReadCalculator } from '../src/read-calculator.js';
import { createReadServices } from '../src/read-runtime.js';
import { decodeReplicaRows } from '../src/read-dataset.js';
import { serveReadRoute, isReadRoute } from '../src/read-routes.js';
export default {
  async fetch(request,env) {
    const dataset={};
    const tables=Object.entries(schema);
    const batches=await env.DB.batch(tables.map(([table,definition])=>env.DB.prepare(`SELECT ${definition.fields.map(f=>'"'+f+'"').join(',')} FROM "${table}" ORDER BY CAST(replica_source_row AS INTEGER),row_key`)));
    for(const [index,[table]] of tables.entries()) {
      dataset[table]=decodeReplicaRows(batches[index].results);
    }
    if(isReadRoute(new URL(request.url).pathname)) return serveReadRoute(request,{
      access:JSON.parse(env.FIXTURE_ACCESS),loadDataset:async()=>dataset,options:{now:Number(env.FIXTURE_NOW),
        fetch:async url=>{const resource=JSON.parse(env.FIXTURE_PUBLIC_RESOURCES||'{}')[url];return new Response(resource?.body||'',{status:resource?.status||503});}}
    });
    const body=await request.json();
    if(body.inspect) return Response.json(dataset);
    const calculator=createReadCalculator(createReadServices(dataset,JSON.parse(env.FIXTURE_ACCESS),{now:Number(env.FIXTURE_NOW)}));
    return Response.json(calculator[body.fn](...body.args));
  }
};
