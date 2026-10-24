import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {parse} from '../cloudflare/read-api/node_modules/acorn/dist/acorn.mjs';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const v of Object.values(node))if(Array.isArray(v))v.forEach(n=>walk(n,visit));else if(v&&typeof v==='object')walk(v,visit);}
for(const fixture of ['capacity','parity'])test(fixture+' actor observation runs only after original response-body/full-wall end',async()=>{
 const source=readFileSync(new URL('../cloudflare/read-api/test/read-'+fixture+'.test.mjs',import.meta.url),'utf8');
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'}),loops=[];
 walk(ast,n=>{if(n.type==='ForStatement'&&n.test?.type==='BinaryExpression'&&n.test.right?.value===100)loops.push(n);});
 assert.equal(loops.length,1);let clocks=0,clientEnded=false,records=0,fetchRecords=0,fetchBegins=0,fetchRuns=0;
 const samples=[],observations=[],stages={d1:[],decode:[],route:[],internal_ms:[]},
  header='{"v":2,"entry_to_before_txn_ms":0.2,"awaited_txn_ms":0.5,"entry_to_txn_ms":1,"json_tail_ms":2}';
 const response={status:200,headers:{get:name=>{assert.equal(clocks,3,'headers are observed after the full-wall end');return name==='server-timing'?'d1;dur=3.000, decode;dur=1.000, route;dur=1.000':name==='x-cmwebs-test-d1-statements'?'[0.5,0.75]':name==='x-cmwebs-test-d1'?'{"internal_ms":1.25,"queries":2,"rows_read":12}':header;}},
  arrayBuffer:async()=>{assert.equal(clocks,2);return new ArrayBuffer(24);}};
 const variables={assert,schema:{first:{},second:{}},i:0,index:0,c:{route:'home'},item:{route:'home'},samples,observations,stages,
  paths:{home:'/local'},httpPaths:{home:'/local'},mf:{dispatchFetch:async()=>{assert.equal(clocks,1);return response;}},
  performance:{now:()=>++clocks,eventLoopUtilization:()=>({active:1,idle:1,utilization:0.5})},
  process:{cpuUsage:()=>({user:1,system:1})},
  clientTiming:{begin:()=>({}),end:()=>{assert.equal(clocks,3);clientEnded=true;}},
  fetchCapture:{begin:()=>{assert.equal(clocks,0);fetchBegins++;return {};},run:(_,fn)=>{assert.equal(clocks,1);fetchRuns++;return fn();},sample:()=>{assert(clientEnded);assert.equal(clocks,3);return null;}},
  fetchTiming:{record:(route,index,start,dispatch,end,window)=>{assert(clientEnded);assert.equal(clocks,3);assert.equal(route,'home');assert.equal(index,0);assert.deepEqual([start,dispatch,end,window],[1,2,3,null]);fetchRecords++;}},
  actorTiming:{record:(route,index,wall,d1,h)=>{assert(clientEnded);assert.equal(clocks,3);assert.equal(route,'home');assert.equal(index,0);assert.equal(wall,2);assert.equal(d1,3);assert.equal(h,header);records++;}},
  metrics:()=>({d1:3,decode:1,route:1,internal_ms:1.25,queries:2,rows_read:12})};
 await new AsyncFunction(...Object.keys(variables),source.slice(loops[0].body.start,loops[0].body.end))(...Object.values(variables));
 assert.equal(records,1,'each original measured response needs exactly one post-timer actor observation');
 assert.equal(fetchBegins,1);assert.equal(fetchRuns,1);assert.equal(fetchRecords,1,'fetch window formatting follows the unchanged body/full-wall end');
 assert.equal(clocks,3);assert.deepEqual(samples,[2]);
 if(fixture==='capacity'){assert.equal(observations[0].internal_ms,1.25);assert.equal(observations[0].queries,2);assert.equal(observations[0].rows_read,12);assert.deepEqual(stages.internal_ms,[1.25]);assert.deepEqual(observations[0].statement_ms,[0.5,0.75]);}
});
