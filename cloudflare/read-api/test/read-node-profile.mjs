// Finite test-only diagnostic. No listener, other-process attachment or retry.
import assert from 'node:assert/strict';
import {Session} from 'node:inspector/promises';
import {PerformanceObserver,performance} from 'node:perf_hooks';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,open,lstat,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,relative,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';

export const limits=Object.freeze({windowMs:60000,childMs:180000,commandMs:5000,
 rawBytes:20*1024*1024,framedBytes:24*1024*1024,lineBytes:8192,normalBytes:4*1024*1024});
const originalSha='7b44ef3ff1ddb0d8531e05beb6930a584d762b3f18017a3753f3c02e22e31652';
const base='52b92cb6d41bc4a492f800aee562ace12d5045ae';
const testDirectory=dirname(fileURLToPath(import.meta.url));
const repository=join(testDirectory,'../../..');
const prefix='C6_NODE_PROFILE ';
const sha=value=>createHash('sha256').update(value).digest('hex');
const turn=()=>new Promise(resolve=>setImmediate(resolve));

export function insertProfileHooks(original){
 const hooks=[
  ["import {withNodeFetchTiming} from './read-fetch-boundary.mjs';", "import {createNodeProfile} from './read-node-profile.mjs';\n",true],
  ["test('500 owned rooms survive real D1 projection and all seven canonical read entries without scope or amount loss',async t=>withD1ActorTiming(async()=>withNodeFetchTiming(async fetchCapture=>{\n", " const nodeProfile=createNodeProfile();t.after(()=>nodeProfile.close());\n",false],
  ['   for(let i=0;i<100;i++){\n', "   if(c.route==='properties')await nodeProfile.start();\n",true],
  ['   // Numeric timing diagnostics only, after the original100 measured requests.\n', "   if(c.route==='properties')await nodeProfile.stop(samples);\n",true]
 ];
 const insertions=[];
 for(const [anchor,text,before] of hooks){
  const at=original.indexOf(anchor);
  assert(at>=0&&original.indexOf(anchor,at+1)===-1,'unique diagnostic anchor');
  insertions.push({offset:at+(before?0:anchor.length),text});
 }
 insertions.sort((a,b)=>a.offset-b.offset);let source='',cursor=0,added=0,addedLines=0;
 let diff='--- a/cloudflare/read-api/test/read-capacity.test.mjs\n+++ b/cloudflare/read-api/test/owned-profile-copy.mjs\n';
 for(const insertion of insertions){
  source+=original.slice(cursor,insertion.offset)+insertion.text;
  insertion.derivedOffset=insertion.offset+added;cursor=insertion.offset;
  const line=original.slice(0,insertion.offset).split('\n').length;
  const count=insertion.text.split('\n').length-1;
  diff+=`@@ -${line-1},0 +${line+addedLines},${count} @@\n`+insertion.text.trimEnd().split('\n').map(s=>'+'+s).join('\n')+'\n';
  added+=insertion.text.length;addedLines+=count;
 }
 source+=original.slice(cursor);
 return {source,insertions,diff,diffSha256:sha(diff),sha256:sha(source),originalSha256:sha(original),base};
}
export function deriveCapacitySource(original){
 assert.equal(sha(original),originalSha,'exact capacity source pin');
 return insertProfileHooks(original);
}

export async function withOwnedCopy(directory,source,run){
 const path=join(directory,'.c6-node-profile-'+randomUUID()+'.mjs');
 const handle=await open(path,'wx',0o600);const identity=await handle.stat();let result,primary;
 try{await handle.writeFile(source);}catch(error){primary=error;}finally{try{await handle.close();}catch(error){primary??=error;}}
 if(!primary)try{result=await run(path);}catch(error){primary=error;}
 try{
  const current=await lstat(path);
  assert(current.isFile()&&current.dev===identity.dev&&current.ino===identity.ino,'owned identity');
  assert.equal(sha(await readFile(path)),sha(source),'owned bytes');
  await unlink(path);
 }catch{
  const cleanup=new Error('owned copy cleanup unavailable');
  if(primary)throw new AggregateError([primary,cleanup],'child failed; owned copy cleanup unavailable');
  throw cleanup;
 }
 if(primary)throw primary;return result;
}

// Only known public source roots and installed dependency identities survive.
// Unrecognized URLs/names are hashed in full, without exposing path suffixes.
export function publicIdentity(url){
 if(typeof url!=='string')return 'unavailable';
 if(!url)return '';
 if(/^node:[a-zA-Z0-9_./-]+$/.test(url))return url;
 let path;try{path=url.startsWith('file:')?fileURLToPath(url):url;}catch{return 'sha256:'+sha(url);}
 const rel=relative(repository,path).split(sep).join('/');
 if(!rel.startsWith('../')&&!rel.startsWith('/')&&!/[?#\u0000-\u001f]/.test(rel)){
  const dependency=/^cloudflare\/read-api\/node_modules\/((?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+)(\/.*)?$/.exec(rel);
  if(dependency&&/^[a-zA-Z0-9_@./-]+$/.test(dependency[0]))return 'dependency:'+dependency[1]+(dependency[2]||'');
  if(/^(cloudflare\/read-api\/(?:test|src)\/|tests\/fixtures\/read-parity\/)[a-zA-Z0-9_./-]+$/.test(rel))return 'repo:'+rel.replace(/\.c6-node-profile-[a-f0-9-]+\.mjs$/, 'owned-profile-copy.mjs');
 }
 return 'sha256:'+sha(url);
}
function safeName(value){return typeof value==='string'&&value.length<=160&&/^[a-zA-Z0-9_$ .<>:[\]()-]*$/.test(value)?value:'sha256:'+sha(String(value));}
function frame(value){
 assert(value&&typeof value==='object','call frame');knownKeys(value,['functionName','scriptId','url','lineNumber','columnNumber']);
 return {functionName:safeName(value.functionName),scriptId:/^\d+$/.test(value.scriptId)?value.scriptId:'unavailable',
  url:publicIdentity(value.url),lineNumber:integer(value.lineNumber,-1),columnNumber:integer(value.columnNumber,-1)};
}
function knownKeys(value,allowed){assert(Object.keys(value).every(key=>allowed.includes(key)),'unknown protocol field');}
function integer(value,min=0){assert(Number.isSafeInteger(value)&&value>=min,'profile integer');return value;}
function number(value){assert(Number.isFinite(value)&&value>=0,'profile number');return value;}
function numbers(value){assert(Array.isArray(value),'profile vector');return value.map(v=>number(v));}

// Counting before stringify bounds serialization work, including deeply nested
// allocation trees. No values or heap snapshots are requested or serialized.
function boundedJSON(value,max=limits.rawBytes){
 const stack=[value];let budget=0;
 while(stack.length){
  const current=stack.pop();
  if(typeof current==='string')budget+=Buffer.byteLength(current)*6+2;
  else if(current===null||typeof current!=='object')budget+=32;
  else if(Array.isArray(current)){budget+=2+current.length;for(const v of current)stack.push(v);}
  else{budget+=2;for(const [key,v] of Object.entries(current)){budget+=Buffer.byteLength(key)*6+4;stack.push(v);}}
  assert(budget<=max,'serialization bound');
 }
 let text;try{text=JSON.stringify(value);}catch{throw Error('serialization unavailable');}
 assert(Buffer.byteLength(text)<=max,'raw profile bound');return text;
}
export function sanitizeProfiles(cpu,allocation){
 // A conservative precheck can refuse a near-limit profile; it never silently
 // drops a node/sample or weakens the20MiB ceiling to obtain COMPLETE.
 boundedJSON({cpu,allocation});
 assert(cpu&&allocation&&Array.isArray(cpu.nodes)&&Array.isArray(allocation.samples),'profile shape');
 knownKeys(cpu,['nodes','startTime','endTime','samples','timeDeltas']);knownKeys(allocation,['head','samples']);
 const nodes=cpu.nodes.map(node=>{knownKeys(node,['id','callFrame','hitCount','children','positionTicks','deoptReason']);return ({id:integer(node.id),callFrame:frame(node.callFrame),
  ...(node.hitCount===undefined?{}:{hitCount:integer(node.hitCount)}),
  ...(node.children===undefined?{}:{children:node.children.map(v=>integer(v))}),
  ...(node.positionTicks===undefined?{}:{positionTicks:node.positionTicks.map(v=>{knownKeys(v,['line','ticks']);return {line:integer(v.line),ticks:integer(v.ticks)};})}),
  ...(node.deoptReason===undefined?{}:{deoptReason:safeName(node.deoptReason)})});});
 const samples=numbers(cpu.samples),timeDeltas=numbers(cpu.timeDeltas);
 assert.equal(samples.length,timeDeltas.length,'CPU sample completeness');
 const ids=new Set(nodes.map(n=>n.id));assert.equal(ids.size,nodes.length,'unique CPU nodes');
 assert(samples.every(id=>ids.has(id))&&nodes.every(n=>(n.children||[]).every(id=>ids.has(id))),'CPU references');
 const head={},pending=[[allocation.head,head]],allocationIds=new Set();
 while(pending.length){
  const [node,target]=pending.pop();assert(node&&Array.isArray(node.children),'allocation tree');knownKeys(node,['id','callFrame','selfSize','children']);
  assert(!allocationIds.has(node.id),'unique allocation node');allocationIds.add(node.id);
  Object.assign(target,{id:integer(node.id),callFrame:frame(node.callFrame),selfSize:number(node.selfSize),children:node.children.map(()=>({}))});
  node.children.forEach((child,i)=>pending.push([child,target.children[i]]));
 }
 const allocationSamples=allocation.samples.map(s=>{knownKeys(s,['size','nodeId','ordinal']);return {size:number(s.size),nodeId:integer(s.nodeId),ordinal:integer(s.ordinal)};});
 assert(allocationSamples.every(s=>allocationIds.has(s.nodeId)),'allocation references');
 assert(new Set(allocationSamples.map(s=>s.ordinal)).size===allocationSamples.length,'unique allocation ordinal');
 return {cpu:{nodes,startTime:number(cpu.startTime),endTime:number(cpu.endTime),samples,timeDeltas},allocation:{head,samples:allocationSamples}};
}

export function frameProfile(data){
 const raw=Buffer.from(boundedJSON(data)),digest=sha(raw),chunkBytes=4096;
 const chunks=Math.ceil(raw.length/chunkBytes),lines=[];
 for(let i=0;i<chunks;i++)lines.push(prefix+JSON.stringify({type:'CHUNK',seq:i,total:chunks,data:raw.subarray(i*chunkBytes,(i+1)*chunkBytes).toString('base64')}));
 lines.push(prefix+JSON.stringify({type:'END',chunks,bytes:raw.length,sha256:digest,status:data.status??'DERIVATION'}));
 assert(lines.every(line=>Buffer.byteLength(line)<=limits.lineBytes),'line bound');
 assert(lines.reduce((n,line)=>n+Buffer.byteLength(line)+1,0)<=limits.framedBytes,'framed output bound');return lines;
}
export function decodeProfileFrames(lines){
 assert(Array.isArray(lines)&&lines.length>=2,'complete frames');
 assert(lines.every(line=>line.startsWith(prefix)&&Buffer.byteLength(line)<=limits.lineBytes),'frame prefix/bound');
 const records=lines.map(line=>JSON.parse(line.slice(prefix.length))),end=records.pop();
 assert.equal(end.type,'END');assert.equal(end.chunks,records.length);assert(end.bytes<=limits.rawBytes);
 const buffers=records.map((record,i)=>{
  assert(record.type==='CHUNK'&&record.seq===i&&record.total===records.length,'sequence/cardinality');
  assert(typeof record.data==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(record.data),'base64');return Buffer.from(record.data,'base64');
 });
 const raw=Buffer.concat(buffers);assert.equal(raw.length,end.bytes);assert.equal(sha(raw),end.sha256,'checksum');
 const data=JSON.parse(raw.toString('utf8'));assert.equal(end.status,data.status??'DERIVATION');return data;
}

export function createNodeProfile({sessionFactory=()=>new Session(),observerFactory=fn=>new PerformanceObserver(fn),
 emit=line=>console.log(line),drain=turn,windowMs=limits.windowMs,commandMs=limits.commandMs}={}){
 assert(windowMs>0&&windowMs<=limits.windowMs&&commandMs>0&&commandMs<=limits.commandMs,'finite deadlines');
 let state='NEW',session,observer,timer,startPromise,finishPromise,result,requestStart=null,requestEnd=null,expired=false,started=false,allocationStarted=false,cpuStarted=false;
 const gc=[],clocks=[],reasons=[],pending=new Set();let gcBytes=0;
 const reason=value=>{if(!reasons.includes(value))reasons.push(value);};
 const collect=entries=>{for(const entry of entries){
  const row=[number(entry.startTime),number(entry.duration),integer(entry.detail?.kind??0),
   Number.isSafeInteger(entry.detail?.flags)&&entry.detail.flags>=0&&entry.detail.flags<=126&&(entry.detail.flags&~126)===0?entry.detail.flags:null];
  if(row[3]===null)reason('GC_FLAGS_UNKNOWN');
  gcBytes+=64;if(gcBytes>limits.rawBytes){reason('GC_BOUND');continue;}gc.push(row);
 }};
 async function command(method,params){
  const before=performance.now(),beforeTick=process.hrtime.bigint().toString();let timeout;
  const work=Promise.resolve().then(()=>session.post(method,params));pending.add(work);
  work.then(()=>pending.delete(work),()=>pending.delete(work));
  try{return await Promise.race([work,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('command deadline')),commandMs);})]);}
  finally{clearTimeout(timeout);const after=performance.now();clocks.push({command:method,before_ms:before,after_ms:after,
   uncertainty_ms:after-before,before_hrtime_ns:beforeTick,after_hrtime_ns:process.hrtime.bigint().toString()});}
 }
 async function finish(walls,why){
  if(finishPromise)return finishPromise;
  finishPromise=(async()=>{
   if(why)reason(why);if(startPromise)await startPromise;
   state='DRAINING';clearTimeout(timer);let cpu,allocation;
   if(cpuStarted)try{cpu=(await command('Profiler.stop')).profile;}catch{reason('CPU_STOP_UNAVAILABLE');}
   if(allocationStarted){try{allocation=(await command('HeapProfiler.getSamplingProfile')).profile;}catch{reason('ALLOCATION_UNAVAILABLE');}
    try{await command('HeapProfiler.stopSampling');}catch{reason('ALLOCATION_STOP_UNAVAILABLE');}}
   try{await drain();if(observer)collect(observer.takeRecords());}catch{reason('GC_DRAIN_UNAVAILABLE');}
   try{observer?.disconnect();}catch{reason('OBSERVER_CLEANUP_UNAVAILABLE');}
   // An unresolved callback remains explicitly incomplete. Disconnect still
   // happens once; we never wait indefinitely or reuse the failed session.
   if(pending.size)reason('CALLBACK_NOT_DRAINED');
   try{session?.disconnect();}catch{reason('SESSION_CLEANUP_UNAVAILABLE');}
   let profiles={};if(cpu&&allocation)try{profiles=sanitizeProfiles(cpu,allocation);}catch{reason('PROFILE_BOUND_OR_INVALID');}
   else reason('PROFILE_PAYLOAD_MISSING');
   if(!Array.isArray(walls)||walls.length!==100||!walls.every(v=>Number.isFinite(v)&&v>=0))reason('REQUEST_VECTOR_INCOMPLETE');
   result={version:1,status:started?(reasons.length?'PARTIAL':'COMPLETE'):'UNAVAILABLE',reasons,
    scope:'NODE_CLIENT_DIAGNOSTIC_NOT_ACCEPTANCE_OR_WORKER_CPU',node:process.versions.node,
    cpu_interval_us:1000,allocation_interval_bytes:32768,collected_major_gc:true,collected_minor_gc:true,
    source_sha256:originalSha,base,clocks,clock_alignment:'BRACKETED_UNCERTAIN_NO_GC_SUBTRACTION',
    request_window:{start_ms:requestStart,end_ms:requestEnd,scope:'HOOK_ENVELOPE_SEE_ORIGINAL_CLIENT_SAMPLE_CLOCKS'},
    walls:Array.isArray(walls)&&walls.length<=100?walls:[],wall_columns:['zero_based_sample','wall_ms'],
    wall_samples:Array.isArray(walls)&&walls.length<=100?walls.map((ms,i)=>[i,ms]):[],gc,gc_columns:['start_ms','duration_ms','kind','flags'],
    dropped:gcBytes>limits.rawBytes?gcBytes/64-gc.length:0,truncated:false,unknown:reasons.some(r=>/INVALID|UNAVAILABLE|MISSING/.test(r))?null:gc.filter(row=>row[3]===null).length,...profiles};
   let lines;try{lines=frameProfile(result);}catch{result={version:1,status:started?'PARTIAL':'UNAVAILABLE',reasons:[...reasons,'OUTPUT_BOUND'],
    source_sha256:originalSha,dropped:null,truncated:true,unknown:null};lines=frameProfile(result);}
   state='CLOSED';try{for(const line of lines)emit(line);}catch{reason('EMIT_UNAVAILABLE');result.status=started?'PARTIAL':'UNAVAILABLE';}
   return result;
  })();return finishPromise;
 }
 return {
  state:()=>state,
  async start(){
   if(state!=='NEW'){reason('START_REUSED');return result;}
   state='STARTING';timer=setTimeout(()=>{expired=true;void finish(undefined,'WINDOW_TIMEOUT');},windowMs);
   const active=()=>assert(!expired,'startup deadline');
   startPromise=(async()=>{try{
    observer=observerFactory(list=>{try{collect(list.getEntries());}catch{reason('GC_INVALID');}});observer.observe({entryTypes:['gc']});
    session=sessionFactory();session.connect();
    await command('Profiler.enable');active();await command('Profiler.setSamplingInterval',{interval:1000});active();
    // Set ownership before posting: even a missing start callback needs stop.
    allocationStarted=true;
    await command('HeapProfiler.startSampling',{samplingInterval:32768,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});active();
    cpuStarted=true;await command('Profiler.start');active();started=true;state='RECORDING';requestStart=performance.now();
   }catch{reason('CAPABILITY_UNAVAILABLE');}})();
   await startPromise;if(reasons.length||expired)await finish(undefined);
  },
  stop:walls=>{requestEnd??=performance.now();return finish(walls,started?undefined:'START_HOOK_MISSING');},
  close:()=>finish(undefined,state==='NEW'?'PROPERTIES_HOOK_MISSING':undefined)
 };
}

export async function capability(){
 assert.equal(process.versions.node,'22.23.3','exact diagnostic Node');
 const lines=[],profile=createNodeProfile({emit:line=>lines.push(line)});
 await profile.start();
 // Tiny owned in-process capability exercise only; no fixture/HTTP/Miniflare.
 const values=Array.from({length:1000},(_,i)=>({index:i,value:'sample'+i}));
 assert.equal(values[999].index,999);await profile.stop(Array(100).fill(0));await profile.close();
 const result=decodeProfileFrames(lines);console.log('C6_NODE_PROFILE_CAPABILITY '+JSON.stringify({node:process.versions.node,
  status:result.status,reasons:result.reasons,cpu_samples:result.cpu?.samples.length??0,allocation_samples:result.allocation?.samples.length??0,
  session:'OWNED_IN_PROCESS_NO_LISTENER',fixture:false,http:false}));
 return result.status==='COMPLETE'?0:2;
}

// Raw child output is streamed with bounded line buffering. Absolute or unknown
// path/URL identities are hashed; synthetic local.test and public repo frames
// remain identifiable. Original test exit and assertion text otherwise survive.
export function safeChildLine(line){
 return line.replace(/file:\/\/\/[^\s'"()<>:]+|(?<![a-zA-Z0-9_:.\/-])\/(?:[^\s'"()<>:]+\/)*[^\s'"()<>:]*/g,value=>publicIdentity(value))
  .replace(/https?:\/\/[^\s'"()<>]+/g,value=>value.startsWith('https://local.test')?'https://local.test':'sha256:'+sha(value));
}
export async function launch(){
 assert.equal(process.versions.node,'22.23.3','exact diagnostic Node');
 const derived=deriveCapacitySource(await readFile(join(testDirectory,'read-capacity.test.mjs'),'utf8'));
 const derivationFrames=frameProfile({kind:'DERIVATION',base,original_sha256:derived.originalSha256,derived_sha256:derived.sha256,
  diff_sha256:derived.diffSha256,diff:derived.diff,selected:'capacity500',packed_values:'NOT_SELECTED'});
 for(const line of derivationFrames)console.log(line);
 const maxFramedBytes=limits.framedBytes-derivationFrames.reduce((n,line)=>n+Buffer.byteLength(line)+1,0);
 let childResult,cleanup=true;
 try{await withOwnedCopy(testDirectory,derived.source,async path=>{childResult=await runOwnedChild(path,{maxFramedBytes});return childResult;});}
 catch{cleanup=false;console.log('C6_NODE_PROFILE_LAUNCH '+JSON.stringify({status:'PARTIAL',reason:'OWNED_COPY_OR_CLEANUP_UNAVAILABLE'}));}
 if(childResult)console.log('C6_NODE_PROFILE_LAUNCH '+JSON.stringify({...childResult,owned_copy_cleanup:cleanup,status:childResult.diagnosticComplete&&cleanup?'COLLECTED_NOT_ACCEPTANCE':'PARTIAL'}));
 return childResult?.code??2;
}
export function runOwnedChild(path,{childMs=limits.childMs,maxFramedBytes=limits.framedBytes,spawnChild=spawn,emit=line=>console.log(line)}={}){
 return new Promise(resolve=>{
  const child=spawnChild(process.execPath,['--test','--test-concurrency=1','--test-name-pattern=^500 owned rooms survive real D1 projection and all seven canonical read entries without scope or amount loss$',path],{stdio:['ignore','pipe','pipe'],detached:true});
  let timedOut=false,normalBytes=0,profileBytes=0,overflow=false,complete=false,profileFrames=[];
  const kill=(signal='SIGTERM')=>{try{if(Number.isSafeInteger(child.pid))process.kill(-child.pid,signal);else child.kill(signal);}catch{};};
  const timer=setTimeout(()=>{timedOut=true;kill();},childMs);
  const force=setTimeout(()=>{if(timedOut||overflow)kill('SIGKILL');},childMs+2000);
  const output=line=>{
   const index=line.indexOf(prefix);
   if(index>=0){const frameLine=line.slice(index);profileBytes+=Buffer.byteLength(line)+1;
    if(profileBytes>maxFramedBytes){overflow=true;kill();return;}
    profileFrames.push(frameLine);
    try{if(JSON.parse(frameLine.slice(prefix.length)).type==='END'){const data=decodeProfileFrames(profileFrames);complete=data.status==='COMPLETE';profileFrames=[];}}catch{complete=false;}
   }else normalBytes+=Buffer.byteLength(line)+1;
   if(normalBytes>limits.normalBytes||Buffer.byteLength(line)>limits.lineBytes){overflow=true;kill();return;}
   emit(index>=0?line:safeChildLine(line));
  };
  for(const stream of [child.stdout,child.stderr]){
   const decoder=new StringDecoder('utf8');let buffer='';
   stream.on('data',chunk=>{
    buffer+=decoder.write(chunk);
    if(Buffer.byteLength(buffer)>limits.normalBytes){overflow=true;buffer='';kill();return;}
    let at;while((at=buffer.indexOf('\n'))>=0){output(buffer.slice(0,at));buffer=buffer.slice(at+1);}
    if(Buffer.byteLength(buffer)>limits.lineBytes){overflow=true;buffer='';kill();}
   });
   stream.on('end',()=>{buffer+=decoder.end();if(buffer)output(buffer);});
  }
  let spawnError=false;child.on('error',()=>{spawnError=true;});
  child.on('close',async(code,signal)=>{clearTimeout(timer);clearTimeout(force);
   if(timedOut||overflow){await new Promise(done=>setTimeout(done,20));kill('SIGKILL');}
   resolve({code:typeof code==='number'?code:2,signal:signal||null,
   timed_out:timedOut,output_overflow:overflow,spawn_error:spawnError,diagnosticComplete:complete&&!profileFrames.length&&!overflow&&!timedOut&&!spawnError,
   normal_bytes:normalBytes,framed_bytes:profileBytes});});
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const mode=process.argv[2];
 try{process.exitCode=mode==='--capability'?await capability():mode==='--launch'?await launch():2;}
 catch{console.log('C6_NODE_PROFILE_LAUNCH '+JSON.stringify({status:'UNAVAILABLE',reason:'PIN_OR_START_UNAVAILABLE'}));process.exitCode=2;}
}
