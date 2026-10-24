// Passive, bounded Linux /proc evidence for the existing CI Worker test job.
// CPU values are scheduler ticks for each process, not route latency or CPU %.
import {readFile, open, stat as fileStat} from 'node:fs/promises';
import {availableParallelism} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const INTERVAL_MS=500, MAX_MS=600_000, MAX_PROCESSES=32, MAX_BYTES=8*1024*1024;
// A projected sample has at most 32 fixed-field processes. With safe-integer
// decimal fields at their 16-digit maximum, its JSON is below 9 KiB; 10 KiB
// leaves room for the sample index and all fixed cgroup fields. There are at
// most 1201 producer samples. This bounds the complete log, without selection.
const MAX_TRACE_SAMPLES=MAX_MS/INTERVAL_MS+1, MAX_TRACE_FRAME_BYTES=10_240;
const TRACE_PREFIX='C6_WORKER_RESOURCE_TRACE ';
const MAX_TRACE_OUTPUT_BYTES=MAX_TRACE_SAMPLES*(MAX_TRACE_FRAME_BYTES+Buffer.byteLength(TRACE_PREFIX+'\n'))+2048;
const number=s=>{const n=Number(s);return /^\d+$/.test(String(s))&&Number.isSafeInteger(n)?n:null;};

export function parseProcStat(line){
  const match=/^(\d+) \((.*)\) ([A-Z]) (.*)$/.exec(line.trim());
  if(!match)return null;
  const f=match[4].split(' '), values=[match[1],f[0],f[10],f[11],f[18],f[20]].map(number);
  if(values.some(v=>v===null)||f.length<21)return null;
  const [pid,ppid,user_ticks,system_ticks,start_ticks,rss_pages]=values;
  const comm_type=match[2].startsWith('node')?'node':match[2]==='workerd'?'workerd':'other';
  return {pid,ppid,comm_type,start_ticks,user_ticks,system_ticks,rss_pages};
}

export function cpuDelta(before,after){
  if(!before)return {status:'NEW',ticks:null};
  if(before.start_ticks!==after.start_ticks)return {status:'PID_REUSED',ticks:null};
  const u=after.user_ticks-before.user_ticks,s=after.system_ticks-before.system_ticks;
  if(u<0||s<0||!Number.isSafeInteger(u+s))return {status:'INVALID',ticks:null};
  return {status:'OK',ticks:u+s};
}

async function readMaybe(path){try{return await readFile(path,'utf8');}catch(e){if(e.code==='ENOENT'||e.code==='ESRCH')return null;throw e;}}
async function readProcField(path){
  let handle;
  try{
    handle=await open(path,'r');
    const buffer=Buffer.alloc(8193),{bytesRead}=await handle.read(buffer,0,buffer.length,0);
    return bytesRead>8192?{status:'OVERSIZE'}:{status:'OK',text:buffer.toString('utf8',0,bytesRead)};
  }catch(e){if(e.code==='ENOENT'||e.code==='ESRCH')return {status:'MISSING'};throw e;}
  finally{await handle?.close();}
}

export async function sampleOwned(procRoot,rootPid,selfPid,previous=new Map(),limit=MAX_PROCESSES,rootStart=null){
  const processes=[],next=new Map(),seen=new Set(),queue=[{pid:rootPid,parent:null}];
  let dropped=0,invalid=0,missing=0,status='OK';
  while(queue.length){
    const {pid,parent}=queue.shift();
    if(seen.has(pid)||pid===selfPid)continue;
    seen.add(pid);
    if(processes.length>=limit){dropped++;continue;}
    const raw=await readProcField(resolve(procRoot,String(pid),'stat'));
    if(raw.status==='MISSING'){missing++;continue;}
    if(raw.status!=='OK'){invalid++;continue;}
    const p=parseProcStat(raw.text);
    if(!p||p.pid!==pid||(parent!==null&&p.ppid!==parent)){
      invalid++;continue;
    }
    if(parent===null&&rootStart!==null&&p.start_ticks!==rootStart){status='ROOT_REUSED';break;}
    const current={...p,cpu_delta:cpuDelta(previous.get(pid),p)};
    processes.push(current);next.set(pid,p);
    const children=await readProcField(resolve(procRoot,String(pid),'task',String(pid),'children'));
    if(children.status==='MISSING'){missing++;continue;}
    if(children.status!=='OK'){invalid++;continue;}
    const childTokens=children.text.trim().split(/\s+/);
    if(childTokens.length>128)dropped+=childTokens.length-128;
    for(const child of childTokens.slice(0,128)){
      if(!child)continue;
      const childPid=number(child);
      if(childPid===null||childPid<1){invalid++;continue;}
      if(childPid!==selfPid)queue.push({pid:childPid,parent:pid});
    }
  }
  for(const pid of previous.keys())if(!next.has(pid))missing++;
  if(!processes.some(p=>p.pid===rootPid)&&status==='OK')status='ROOT_UNAVAILABLE';
  return {status,processes,next,dropped,invalid,missing};
}

function cpusetCount(raw){
  if(!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*\s*$/.test(raw))return null;
  let total=0;
  for(const part of raw.trim().split(',')){
    const [a,b=a]=part.split('-').map(Number);
    if(b<a)return null;
    total+=b-a+1;
  }
  return Number.isSafeInteger(total)?total:null;
}

export function mapSelfCgroup(cgroup,mountinfo){
  const entries=cgroup.trim().split('\n').map(line=>line.split(':'));
  const mounts=mountinfo.trim().split('\n').map(line=>{
    const [left,right]=line.split(' - ');
    if(!right)return null;
    const fields=left.split(' '),tail=right.split(' ');
    return {root:fields[3],mount:fields[4],type:tail[0],options:tail[2]||''};
  }).filter(Boolean);
  for(const version of [2,1]){
    const entry=entries.find(e=>version===2?e[0]==='0'&&e[1]==='':e[1]?.split(',').includes('cpu'));
    if(!entry||!/^(?:\/[A-Za-z0-9_.-]+)*\/?$/.test(entry[2]))continue;
    const mount=mounts.find(m=>version===2?m.type==='cgroup2':m.type==='cgroup'&&m.options.split(',').includes('cpu'));
    if(!mount||!mount.root?.startsWith('/')||!mount.mount?.startsWith('/'))continue;
    const group=entry[2].replace(/\/$/,'')||'/',root=mount.root.replace(/\/$/,'')||'/';
    if(root!=='/'&&group!==root&&!group.startsWith(root+'/'))continue;
    const relative=root==='/'?group.slice(1):group.slice(root.length).replace(/^\//,'');
    return {version,path:resolve(mount.mount,relative)};
  }
  return null;
}

async function readSelfCpuEvidence(){
  try{
    const [cgroup,mountinfo]=await Promise.all([readMaybe('/proc/self/cgroup'),readMaybe('/proc/self/mountinfo')]);
    if(cgroup===null||mountinfo===null)return {status:'UNAVAILABLE'};
    const mapped=mapSelfCgroup(cgroup,mountinfo);
    return mapped?readCpuEvidence(mapped.path,mapped.version):{status:'UNAVAILABLE'};
  }catch{return {status:'UNAVAILABLE'};}
}

export async function readCpuEvidence(root='/sys/fs/cgroup',versionHint=null){
  const [max,stats,cpuset]=versionHint===1?[null,null,null]:await Promise.all(['cpu.max','cpu.stat','cpuset.cpus.effective'].map(n=>readMaybe(resolve(root,n))));
  if(versionHint!==1&&(max!==null||stats!==null)){
    if(max===null||stats===null)return {status:'UNAVAILABLE',version:2};
    const m=/^(max|\d+) (\d+)\s*$/.exec(max);
    const fields=Object.fromEntries(stats.trim().split('\n').map(line=>line.trim().split(/\s+/)));
    const keys=['usage_usec','nr_periods','nr_throttled','throttled_usec'];
    if(!m||m[1]!=='max'&&number(m[1])===null||number(m[2])===null||
      keys.some(k=>number(fields[k])===null)||cpuset!==null&&cpusetCount(cpuset)===null)return {status:'INVALID',version:2};
    return {status:'OK',version:2,quota_status:m[1]==='max'?'UNLIMITED':'LIMITED',
      quota_us:m[1]==='max'?null:number(m[1]),period_us:number(m[2]),
      ...Object.fromEntries(keys.map(k=>[k,number(fields[k])])),
      cpuset_status:cpuset===null?'UNAVAILABLE':'OK',cpuset_count:cpuset===null?null:cpusetCount(cpuset)};
  }
  const cpu=versionHint===1?root:resolve(root,'cpu');
  const [quota,period,v1stat]=await Promise.all(['cpu.cfs_quota_us','cpu.cfs_period_us','cpu.stat'].map(n=>readMaybe(resolve(cpu,n))));
  if(quota===null&&period===null&&v1stat===null)return {status:'UNAVAILABLE'};
  if(quota===null||period===null||v1stat===null)return {status:'UNAVAILABLE',version:1};
  const fields=Object.fromEntries(v1stat.trim().split('\n').map(line=>line.trim().split(/\s+/)));
  const q=quota.trim()==='-1'?null:number(quota.trim()),p=number(period.trim());
  if((q===null&&quota.trim()!=='-1')||p===null||number(fields.nr_periods)===null||number(fields.nr_throttled)===null||number(fields.throttled_time)===null)return {status:'INVALID',version:1};
  return {status:'OK',version:1,quota_status:q===null?'UNLIMITED':'LIMITED',quota_us:q,period_us:p,
    nr_periods:number(fields.nr_periods),nr_throttled:number(fields.nr_throttled),
    throttled_ns:number(fields.throttled_time),usage_status:'UNAVAILABLE',usage_usec:null,
    cpuset_status:'UNAVAILABLE',cpuset_count:null};
}

export async function observe(rootPid,output,{procRoot='/proc',cgroupRoot='/sys/fs/cgroup',signal}={}){
  const handle=await open(output,'wx',0o600);
  let bytes=0,records=0,dropped=0,invalid=0,missing=0,observerError=null,terminal='STOPPED';
  const totals=new Map();let totalsDropped=0,cgroupFirst=null,cgroupLast=null,parallelism=null;
  const write=async value=>{
    const line=JSON.stringify(value)+'\n',size=Buffer.byteLength(line);
    if(bytes+size>MAX_BYTES-2048){dropped++;return;}
    await handle.write(line);bytes+=size;records++;
  };
  const started=Date.now();let previous=new Map(),rootStart=null;
  try{
    for(let sample=0;sample<=MAX_MS/INTERVAL_MS&&!signal?.aborted;sample++){
      const wall_ms=Date.now(),elapsed_ms=wall_ms-started;
      const owned=await sampleOwned(procRoot,rootPid,process.pid,previous,MAX_PROCESSES,rootStart);
      if(rootStart===null&&owned.processes[0]?.pid===rootPid)rootStart=owned.processes[0].start_ticks;
      previous=owned.next;dropped+=owned.dropped;invalid+=owned.invalid;missing+=owned.missing;
      let cgroup;
      try{cgroup=cgroupRoot==='/sys/fs/cgroup'?await readSelfCpuEvidence():await readCpuEvidence(cgroupRoot);}catch{cgroup={status:'UNAVAILABLE'};}
      cgroupFirst??=cgroup;cgroupLast=cgroup;parallelism=availableParallelism();
      for(const p of owned.processes){
        const key=p.pid+':'+p.start_ticks;
        let total=totals.get(key);
        if(!total){
          if(totals.size>=8){totalsDropped++;continue;}
          total={pid:p.pid,ppid:p.ppid,start_ticks:p.start_ticks,comm_type:p.comm_type,
            cpu_ticks:0,max_rss_pages:p.rss_pages};
          totals.set(key,total);
        }
        if(p.cpu_delta.status==='OK')total.cpu_ticks+=p.cpu_delta.ticks;
        total.max_rss_pages=Math.max(total.max_rss_pages,p.rss_pages);
      }
      await write({type:'sample',wall_ms,elapsed_ms,owned_status:owned.status,
        processes:owned.processes,cgroup,available_parallelism:parallelism,
        dropped:owned.dropped,invalid:owned.invalid,missing:owned.missing});
      if(owned.status!=='OK'){terminal=owned.status;break;}
      if(elapsed_ms>=MAX_MS){terminal='TIME_LIMIT';break;}
      await new Promise(r=>{
        const timer=setTimeout(done,INTERVAL_MS);
        function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);r();}
        signal?.addEventListener('abort',done,{once:true});
        if(signal?.aborted)done();
      });
    }
  }catch{observerError='SAMPLE_FAILURE';}
  finally{
    const summary={type:'summary',status:observerError||terminal,wall_ms:Date.now(),
      samples:records,dropped,invalid,missing,bytes,available_parallelism:parallelism,
      process_totals:[...totals.values()],process_totals_dropped:totalsDropped,
      cgroup_first:cgroupFirst||{status:'NOT_COLLECTED'},cgroup_last:cgroupLast||{status:'NOT_COLLECTED'},
      scope:'OWNED_PROCESS_TICKS_AND_SHARED_CGROUP_COUNTERS_NOT_ROUTE_CAUSE'};
    try{await handle.write(JSON.stringify(summary)+'\n');}finally{await handle.close();}
  }
}

async function printSummary(path){
  try{
    const info=await fileStat(path);
    if(info.size>MAX_BYTES+2048)throw Error('too-large');
    const lines=(await readFile(path,'utf8')).trim().split('\n');
    const value=JSON.parse(lines.at(-1));
    if(value.type!=='summary'||!['STOPPED','SAMPLE_FAILURE','ROOT_REUSED','ROOT_UNAVAILABLE','TIME_LIMIT'].includes(value.status)||
      !['samples','dropped','invalid','missing','bytes','process_totals_dropped'].every(k=>safeCount(value[k])))throw Error('missing-summary');
    let invalidRecords=0,inputSamples=0,retainedProcesses=0,outputDropped=0,outputBytes=0;
    const output=[];
    for(let seq=0;seq<lines.length-1;seq++){
      let sample;
      try{sample=JSON.parse(lines[seq]);}catch{invalidRecords++;outputDropped++;continue;}
      if(sample?.type!=='sample'||!safeCount(sample.wall_ms)||!safeCount(sample.elapsed_ms)||
        !['OK','ROOT_REUSED','ROOT_UNAVAILABLE'].includes(sample.owned_status)||
        !Array.isArray(sample.processes)||sample.processes.length>MAX_PROCESSES||
        !safeCount(sample.available_parallelism)||sample.available_parallelism<1||
        !['dropped','invalid','missing'].every(k=>safeCount(sample[k]))||
        inputSamples>=MAX_TRACE_SAMPLES){invalidRecords++;outputDropped++;continue;}
      inputSamples++;
      const cgroup=projectCgroup(sample.cgroup);
      if(!cgroup){invalidRecords++;outputDropped++;continue;}
      const processes=[];
      for(const p of sample.processes){
        const delta=p?.cpu_delta;
        if(!['node','workerd','other'].includes(p?.comm_type)||
          !['pid','ppid','start_ticks','user_ticks','system_ticks','rss_pages'].every(k=>safeCount(p[k]))||
          !['OK','NEW','PID_REUSED','INVALID'].includes(delta?.status)||
          (delta.status==='OK'?!safeCount(delta.ticks):delta.ticks!==null)){invalidRecords++;continue;}
        if(p.comm_type==='other')continue;
        processes.push({pid:p.pid,ppid:p.ppid,start_ticks:p.start_ticks,comm_type:p.comm_type,
          user_ticks:p.user_ticks,system_ticks:p.system_ticks,rss_pages:p.rss_pages,
          cpu_delta:{status:delta.status,ticks:delta.ticks}});
      }
      const frame={type:'sample',sample_index:seq,wall_ms:sample.wall_ms,elapsed_ms:sample.elapsed_ms,
        owned_status:sample.owned_status,processes,cgroup,
        available_parallelism:sample.available_parallelism,dropped:sample.dropped,
        invalid:sample.invalid,missing:sample.missing};
      const line=TRACE_PREFIX+JSON.stringify(frame),size=Buffer.byteLength(line+'\n');
      if(size>MAX_TRACE_FRAME_BYTES+Buffer.byteLength(TRACE_PREFIX+'\n')||
        outputBytes+size>MAX_TRACE_OUTPUT_BYTES-2048){invalidRecords++;outputDropped++;continue;}
      output.push(line);outputBytes+=size;retainedProcesses+=processes.length;
    }
    for(const line of output)console.log(line);
    const partial=invalidRecords>0||outputDropped>0||value.dropped>0||value.invalid>0||
      value.missing>0||inputSamples!==value.samples;
    console.log('C6_WORKER_RESOURCE_TRACE_META '+JSON.stringify({status:partial?'PARTIAL':output.length?'COMPLETE':'NOT_COLLECTED',
      input_samples:inputSamples,source_samples:value.samples,invalid_records:invalidRecords,
      source_dropped:value.dropped,source_invalid:value.invalid,source_missing:value.missing,
      identities_evicted:0,output_dropped:outputDropped,retained_frames:output.length,
      retained_samples:output.length,retained_process_records:retainedProcesses,
      output_bytes:outputBytes,output_bound_bytes:MAX_TRACE_OUTPUT_BYTES,
      scope:'ALL_VALID_COLLECTED_NODE_WORKER_SAMPLES_IN_SOURCE_ORDER'}));
    console.log('C6_WORKER_RESOURCE_META '+JSON.stringify({status:value.status,samples:value.samples,
      dropped:value.dropped,invalid:value.invalid,missing:value.missing,bytes:value.bytes,
      process_totals_dropped:value.process_totals_dropped,
      cgroup_first:projectCgroup(value.cgroup_first)||{status:'UNAVAILABLE'},
      cgroup_last:projectCgroup(value.cgroup_last)||{status:'UNAVAILABLE'}}));
  }catch{
    console.log('C6_WORKER_RESOURCE_TRACE_META '+JSON.stringify({status:'UNAVAILABLE'}));
    console.log('C6_WORKER_RESOURCE_META '+JSON.stringify({status:'UNAVAILABLE'}));
  }
}

function safeCount(value){return Number.isSafeInteger(value)&&value>=0;}
function projectCgroup(value){
  if(!value||!['OK','UNAVAILABLE','INVALID','NOT_COLLECTED'].includes(value.status))return null;
  if(value.status!=='OK')return {status:value.status};
  if(![1,2].includes(value.version)||!['LIMITED','UNLIMITED'].includes(value.quota_status)||
    value.quota_status==='LIMITED'&&!safeCount(value.quota_us)||
    value.quota_status==='UNLIMITED'&&value.quota_us!==null||!safeCount(value.period_us)||
    !safeCount(value.nr_periods)||!safeCount(value.nr_throttled)||
    !['OK','UNAVAILABLE'].includes(value.cpuset_status)||
    value.cpuset_status==='OK'&&!safeCount(value.cpuset_count))return null;
  const base={status:'OK',version:value.version,quota_status:value.quota_status,
    quota_us:value.quota_us,period_us:value.period_us,nr_periods:value.nr_periods,
    nr_throttled:value.nr_throttled,cpuset_status:value.cpuset_status,
    cpuset_count:value.cpuset_status==='OK'?value.cpuset_count:null};
  if(value.version===2){
    if(!safeCount(value.usage_usec)||!safeCount(value.throttled_usec))return null;
    return {...base,usage_usec:value.usage_usec,throttled_usec:value.throttled_usec};
  }
  if(!safeCount(value.throttled_ns))return null;
  return {...base,usage_status:'UNAVAILABLE',usage_usec:null,throttled_ns:value.throttled_ns};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--summary')await printSummary(process.argv[3]);
  else{
    const rootPid=number(process.argv[2]);
    if(rootPid===null||rootPid<1||!process.argv[3])process.exitCode=2;
    else {
      const controller=new AbortController();
      process.on('SIGTERM',()=>controller.abort());
      try{await observe(rootPid,process.argv[3],{signal:controller.signal});}catch{process.exitCode=1;}
    }
  }
}
