import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {createClientSummary} from './read-worker-client-summary.mjs';
import {createActorSummary} from './read-worker-actor-summary.mjs';
import {createFetchSummary} from './read-worker-fetch-summary.mjs';
import schema from '../cloudflare/read-api/schema.json' with {type:'json'};

// Reprint bounded failure evidence after verbose numeric diagnostics. This does
// not run/retry tests or decide their exit status. Raw output remains in the job.
const names=[],details=[],footer=[],diagnostics=[],stages=[];
const d1InternalRoutes=['home','actions','revenue','tenants','rooms','arrears','properties'],d1InternalVectors=new Map();
let d1InternalInvalid=0;
const statementWidth=Object.keys(schema).length,statementFrames=new Map();let statementInvalid=0;
const clientSummary=createClientSummary(),actorSummary=createActorSummary(),fetchSummary=createFetchSummary();
let failed=0,namesDropped=0,detailDropped=0,diagnosticDropped=0;
let nameBytes=0,detailBytes=0,diagnosticBytes=0,block=false,incomplete=0;
let stageBytes=0,stageDropped=0;
let blockDetails=false;
let plan=false,tests=false,fail=false,footerDropped=0,footerBytes=0;
function retain(list,line,budget,used,maxLine){
  const bytes=Buffer.byteLength(line+'\n');
  if(bytes>maxLine||used+bytes>budget)return null;
  list.push(line);return used+bytes;
}
try{
  if(!process.argv[2])throw new Error('CI log path is required');
  const lines=createInterface({input:createReadStream(process.argv[2]),crlfDelay:Infinity});
  for await(const line of lines){
    if(line.startsWith('# C6_LOCAL_500_ROOM_D1_STATEMENTS ')){
      try{
        if(Buffer.byteLength(line.slice(2))>4096)throw Error();
        const v=JSON.parse(line.slice('# C6_LOCAL_500_ROOM_D1_STATEMENTS '.length));
        if(!v||Array.isArray(v)||Object.keys(v).sort().join(',')!=='offset,route,rows'||
          !d1InternalRoutes.includes(v.route)||!Number.isInteger(v.offset)||v.offset<0||v.offset>90||v.offset%10||
          !Array.isArray(v.rows)||v.rows.length!==10||v.rows.some(row=>!Array.isArray(row)||row.length!==statementWidth+1||
            !row.every(ms=>Number.isFinite(ms)&&ms>=0)||Number(row.slice(1).reduce((s,ms)=>s+ms,0).toFixed(3))!==row[0]))throw Error();
        const key=v.route+':'+v.offset;if(statementFrames.has(key))throw Error();statementFrames.set(key,v);
      }catch{statementInvalid++;}
    }
    if(line.startsWith('# C6_LOCAL_500_ROOM_D1_INTERNAL ')){
      try{
        if(Buffer.byteLength(line.slice(2))>4096)throw Error();
        const value=JSON.parse(line.slice('# C6_LOCAL_500_ROOM_D1_INTERNAL '.length));
        if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!=='ordered_internal_ms,route'||
          !d1InternalRoutes.includes(value.route)||d1InternalVectors.has(value.route)||
          !Array.isArray(value.ordered_internal_ms)||value.ordered_internal_ms.length!==100||
          !value.ordered_internal_ms.every(v=>Number.isFinite(v)&&v>=0))throw Error();
        d1InternalVectors.set(value.route,value.ordered_internal_ms);
      }catch{d1InternalInvalid++;}
    }
    const clientMeta=clientSummary.ingest(line);actorSummary.ingest(line);fetchSummary.ingest(line);
    if(/^not ok \d+ - /.test(line)){
      if(block)incomplete++;
      failed++;block=true;
      const next=retain(names,line,16384,nameBytes,1024);
      if(next===null)namesDropped++;else nameBytes=next;
      const detail=retain(details,line,24576,detailBytes,1024);
      blockDetails=detail!==null;
      if(detail===null)detailDropped++;else detailBytes=detail;
    }else if(block){
      if(/^  \.\.\.$/.test(line))block=false;
      else if(/^\S/.test(line)){block=false;incomplete++;}
      if(/^  /.test(line)){
        const next=blockDetails?retain(details,line,24576,detailBytes,4096):null;
        if(next===null)detailDropped++;else detailBytes=next;
      }
    }
    if(/^1\.\.\d+$/.test(line)){
      plan=true;
      const next=footer.length<32?retain(footer,line,2048,footerBytes,128):null;
      if(next===null)footerDropped++;else footerBytes=next;
    }
    if(/^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) [\d.]+$/.test(line)){
      tests ||= /^# tests /.test(line);fail ||= /^# fail /.test(line);
      const next=footer.length<32?retain(footer,line,2048,footerBytes,128):null;
      if(next===null)footerDropped++;else footerBytes=next;
    }
    if(clientMeta||/^# (C6_D1_FIXTURE_FAILURE|C6_LOCAL_500_ROOM_SAMPLE|C6_LOCAL_500_ROOM_DISTRIBUTION|C2_LOCAL_READ_LATENCY) /.test(line)){
      const next=retain(diagnostics,clientMeta||line,16384,diagnosticBytes,4096);
      if(next===null)diagnosticDropped++;else diagnosticBytes=next;
    }
    // Keep paired Worker stages separate from long distributions so the
    // failing last route cannot disappear behind earlier numeric diagnostics.
    if(/^# C6_LOCAL_500_ROOM_STAGES /.test(line)){
      const next=retain(stages,line,4096,stageBytes,1024);
      if(next===null)stageDropped++;else stageBytes=next;
    }
  }
  if(block)incomplete++;
  console.log('C6_CI_FAILURE_NAMES');
  for(const line of names)console.log(line);
  console.log('C6_CI_FAILURE_DETAILS');
  for(const line of details)console.log(line);
  for(const line of diagnostics)console.log(line);
  for(const line of stages)console.log(line);
  const aggregates=[];let aggregateBytes=0,aggregateDropped=0;
  for(const value of clientSummary.finish()){
    const next=retain(aggregates,'# C6_NODE_CLIENT_AGGREGATE '+JSON.stringify(value),6144,aggregateBytes,3072);
    if(next===null)aggregateDropped++;else aggregateBytes=next;
  }
  for(const line of aggregates)console.log(line);
  let actorBytes=0,actorDropped=0;const actor=[];
  for(const value of actorSummary.finish()){
    const next=retain(actor,'# C6_D1_ACTOR_AGGREGATE '+JSON.stringify(value),8192,actorBytes,1024);
    if(next===null)actorDropped++;else actorBytes=next;
  }
  for(const line of actor)console.log(line);
  let fetchBytes=0,fetchDropped=0;const fetch=[];
  for(const value of fetchSummary.finish()){
    const next=retain(fetch,'# C6_NODE_FETCH_AGGREGATE '+JSON.stringify(value),12288,fetchBytes,1536);
    if(next===null)fetchDropped++;else fetchBytes=next;
  }
  for(const line of fetch)console.log(line);
  let d1InternalBytes=0,d1InternalDropped=0;const d1Internal=[];
  for(const route of d1InternalRoutes)if(d1InternalVectors.has(route)){
    const next=retain(d1Internal,'# C6_LOCAL_500_ROOM_D1_INTERNAL '+JSON.stringify({route,
      ordered_internal_ms:d1InternalVectors.get(route)}),24576,d1InternalBytes,4096);
    if(next===null)d1InternalDropped++;else d1InternalBytes=next;
  }
  for(const line of d1Internal)console.log(line);
  let statementBytes=0,statementDropped=0;const statements=[];
  for(const route of d1InternalRoutes)for(let offset=0;offset<100;offset+=10){
    const value=statementFrames.get(route+':'+offset);if(!value)continue;
    const totals=d1InternalVectors.get(route);
    if(!totals||value.rows.some((row,i)=>row[0]!==totals[offset+i])){statementInvalid++;continue;}
    const next=retain(statements,'# C6_LOCAL_500_ROOM_D1_STATEMENTS '+JSON.stringify({route,offset,rows:value.rows}),327680,statementBytes,4096);
    if(next===null)statementDropped++;else statementBytes=next;
  }
  for(const line of statements)console.log(line);
  for(const line of footer)console.log(line);
  console.log('C6_CI_SUMMARY_META '+JSON.stringify({failed_cases:failed,
    d1_statement_frames_retained:statements.length,d1_statement_samples_retained:statements.length*10,d1_statement_width:statementWidth,
    d1_statement_frames_invalid:statementInvalid,d1_statement_frames_dropped:statementDropped,
    d1_statement_status:statements.length===70&&!statementInvalid&&!statementDropped&&d1InternalVectors.size===7&&!d1InternalInvalid&&!d1InternalDropped?'COMPLETE':statementFrames.size||statementInvalid||statementDropped?'PARTIAL':'NOT_COLLECTED',
    d1_internal_vectors_retained:d1Internal.length,d1_internal_vectors_invalid:d1InternalInvalid,
    d1_internal_vectors_dropped:d1InternalDropped,
    d1_internal_vectors_status:d1Internal.length===7&&!d1InternalInvalid&&!d1InternalDropped?'COMPLETE':d1Internal.length||d1InternalInvalid||d1InternalDropped?'PARTIAL':'NOT_COLLECTED',
    failure_names_dropped:namesDropped,detail_lines_dropped:detailDropped,
    diagnostic_lines_dropped:diagnosticDropped,stage_lines_dropped:stageDropped,incomplete_failure_blocks:incomplete,
    client_aggregates_dropped:aggregateDropped,
    actor_aggregates_dropped:actorDropped,actor_records_invalid:actorSummary.invalidRecords(),
    fetch_aggregates_dropped:fetchDropped,fetch_records_invalid:fetchSummary.invalidRecords(),
    client_records_invalid:clientSummary.invalidRecords(),
    client_suites_missing:clientSummary.missingSuites(),
    footer_lines_dropped:footerDropped,
    footer_seen:plan&&tests&&fail,scope:'LOG_EVIDENCE_ONLY_NOT_TEST_OUTCOME'}));
}catch(error){
  console.error('Read-worker CI summary unavailable: '+error.code);
  process.exitCode=1;
}
