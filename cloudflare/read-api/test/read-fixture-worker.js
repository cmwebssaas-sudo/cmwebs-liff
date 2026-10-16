// Test-only entry point. Wrangler's production entry does not import this file.
import schema from '../schema.json' with {type:'json'};
import {decodePackedRows,packedSelection} from '../src/read-dataset.js';
import { createReadCalculator } from '../src/read-calculator.js';
import { createReadServices } from '../src/read-runtime.js';
import { serveReadRoute, isReadRoute } from '../src/read-routes.js';
export default {
  async fetch(request,env) {
    const started=performance.now();
    const dataset={};
    const tables=Object.entries(schema);
    const batches=await env.DB.batch(tables.map(([table,definition])=>env.DB.prepare(`SELECT ${packedSelection(definition.fields)} FROM "${table}" ORDER BY CAST(replica_source_row AS INTEGER),row_key`)));
    const loaded=performance.now();
    const durations=batches.map(v=>v.meta?.duration),rows=batches.map(v=>v.meta?.rows_read);
    if(batches.length!==tables.length||batches.some(v=>v.success!==true)||durations.some(v=>!Number.isFinite(v)||v<0)||rows.some(v=>!Number.isSafeInteger(v)||v<0)) throw Error('TEST_D1_METADATA_UNAVAILABLE');
    const internalMs=durations.reduce((a,b)=>a+b,0),rowsRead=rows.reduce((a,b)=>a+b,0);
    for(const [index,[table]] of tables.entries()) {
      dataset[table]=decodePackedRows(batches[index].results,schema[table].fields);
    }
    const decoded=performance.now();
    if(isReadRoute(new URL(request.url).pathname)) {
      const response=await serveReadRoute(request,{
      access:JSON.parse(env.FIXTURE_ACCESS),loadDataset:async()=>dataset,options:{now:Number(env.FIXTURE_NOW),
        fetch:async url=>{const resource=JSON.parse(env.FIXTURE_PUBLIC_RESOURCES||'{}')[url];return new Response(resource?.body||'',{status:resource?.status||503});}}
      });
      // Test entry only. Internal D1 metadata covers emulator query processing;
      // it is not the wall-time batch or proof of production SQL/network time.
      // Metadata collection stays in decode. Final header serialization remains
      // in total client timing, outside the three reported server stages.
      response.headers.set('server-timing',[
        ['d1',loaded-started],['decode',decoded-loaded],['route',performance.now()-decoded]
      ].map(([name,ms])=>name+';dur='+ms.toFixed(3)).join(', '));
      response.headers.set('x-cmwebs-test-d1',JSON.stringify({queries:tables.length,rows_read:rowsRead,internal_ms:Number(internalMs.toFixed(3))}));
      return response;
    }
    const body=await request.json();
    if(body.inspect) return Response.json(dataset);
    const calculator=createReadCalculator(createReadServices(dataset,JSON.parse(env.FIXTURE_ACCESS),{now:Number(env.FIXTURE_NOW)}));
    return Response.json(calculator[body.fn](...body.args));
  }
};
