import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {createClientSummary} from './read-worker-client-summary.mjs';
import {createActorSummary} from './read-worker-actor-summary.mjs';

// Reprint bounded failure evidence after verbose numeric diagnostics. This does
// not run/retry tests or decide their exit status. Raw output remains in the job.
const names=[],details=[],footer=[],diagnostics=[],stages=[];
const clientSummary=createClientSummary(),actorSummary=createActorSummary();
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
    const clientMeta=clientSummary.ingest(line);actorSummary.ingest(line);
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
  for(const line of footer)console.log(line);
  console.log('C6_CI_SUMMARY_META '+JSON.stringify({failed_cases:failed,
    failure_names_dropped:namesDropped,detail_lines_dropped:detailDropped,
    diagnostic_lines_dropped:diagnosticDropped,stage_lines_dropped:stageDropped,incomplete_failure_blocks:incomplete,
    client_aggregates_dropped:aggregateDropped,
    actor_aggregates_dropped:actorDropped,actor_records_invalid:actorSummary.invalidRecords(),
    client_records_invalid:clientSummary.invalidRecords(),
    client_suites_missing:clientSummary.missingSuites(),
    footer_lines_dropped:footerDropped,
    footer_seen:plan&&tests&&fail,scope:'LOG_EVIDENCE_ONLY_NOT_TEST_OUTCOME'}));
}catch(error){
  console.error('Read-worker CI summary unavailable: '+error.code);
  process.exitCode=1;
}
