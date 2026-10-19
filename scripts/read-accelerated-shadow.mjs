// Operator-only shadow coverage candidate. Never authorizes a flag/deployment.
const DAY=86400000,MAX_ROWS=100000;
const pairs=[['home','home'],['home','actions'],...['revenue','tenants','rooms','arrears','properties'].map(route=>[route,'default'])];
const requiredGates=['VERIFIED_REMOTE_EXPORT','SHARED_FAILURE_REVIEW','C1_C3_RUNTIME_SAFETY_FRESHNESS','ROOMS_FIRST_THEN_24H_STABILITY','PERFORMANCE_DEVICE_ROLLBACK','SEVEN_DAY_POSTLAUNCH'];
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const iso=v=>{if(typeof v!=='string')return NaN;const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString()===v?n:NaN;};
const exact=(v,required,optional=[])=>v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
export function evaluateAcceleratedShadow(input,{now,epoch,release,page}={}){
 const reasons=[],start=iso(input?.started_at),cutoff=iso(input?.exported_at),validPage=pairs.some(([r])=>r===page);
 if(!validPage)reasons.push('INVALID_PAGE');
 if(!Number.isSafeInteger(now)||now<0||!Number.isFinite(start)||start<0||!Number.isFinite(cutoff)||cutoff<start||cutoff>now)reasons.push('INVALID_EXPORT_CLOCK');
 if(Number.isSafeInteger(now)&&Number.isFinite(cutoff)&&now-cutoff>300000)reasons.push('STALE_EXPORT');
 if(!epoch||!release||input?.epoch!==epoch||input?.release!==release)reasons.push('RELEASE_MISMATCH');
 const completed=Number.isFinite(start)&&Number.isFinite(cutoff)&&cutoff>=start?Math.floor((cutoff-start)/DAY):0,window=completed-1;
 if(completed<1)reasons.push('INCOMPLETE_REAL_TIME');
 const map=new Map(),attempts=new Map(),samples=new Map(),receipts=new Set();
 const key=v=>v.window+':'+v.route+':'+v.variant;
 const group=v=>integer(v.window)&&v.window<=completed&&pairs.some(([r,s])=>r===v.route&&s===v.variant);
 const list=(value,reason)=>{if(!Array.isArray(value)||value.length>MAX_ROWS){reasons.push(reason);return [];}return value;};
 for(const row of list(input?.rows,'INVALID_AGGREGATE')){
  if(!exact(row,['window','route','variant','compared','errors','diffs'],['clock_diffs'])||!group(row)||['compared','errors','diffs'].some(k=>!integer(row[k]))||Object.hasOwn(row,'clock_diffs')&&!integer(row.clock_diffs)||map.has(key(row))){reasons.push('INVALID_AGGREGATE');continue;}map.set(key(row),row);
 }
 for(const row of list(input?.attempt_rows,'MISSING_ATTEMPT_EVIDENCE')){
  if(!exact(row,['window','route','variant','attempts','matched','errors','missing'])||!group(row)||['attempts','matched','errors','missing'].some(k=>!integer(row[k])||row[k]>row.attempts)||attempts.has(key(row))){reasons.push('INVALID_AGGREGATE');continue;}attempts.set(key(row),row);
 }
 for(const row of list(input?.sample_rows,'MISSING_SAMPLE_EVIDENCE')){
  const at=iso(row?.observed_at);
  if(!exact(row,['window','route','variant','headers_ms','elapsed_ms','auth_kind','observed_at','receipt'])||!group(row)||!Number.isFinite(at)||at<start||at>=cutoff||Math.floor((at-start)/DAY)!==row.window||!['line','email','unknown'].includes(row.auth_kind)||typeof row.receipt!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(row.receipt)||receipts.has(row.receipt)||!Number.isFinite(row.headers_ms)||!Number.isFinite(row.elapsed_ms)||row.headers_ms<0||row.elapsed_ms<row.headers_ms||row.elapsed_ms>3000){reasons.push('INVALID_SAMPLE');continue;}
  receipts.add(row.receipt);const k=key(row);if(!samples.has(k))samples.set(k,[]);samples.get(k).push(row);
 }
 const excludedIssueGroups=[];
 for(const k of new Set([...map.keys(),...attempts.keys(),...samples.keys()])){
  const row=map.get(k),attempt=attempts.get(k),sample=samples.get(k)||[],g=row||attempt||sample[0],issues=[];
  if(sample.length!==(row?.compared||0))reasons.push('SAMPLE_COUNT_MISMATCH');
  if((row?.compared||0)!==(attempt?.matched||0))issues.push('UNMATCHED_COMPARISONS');
  if(row?.diffs)issues.push('FIELD_DIFFERENCES');if(row?.errors||attempt?.errors)issues.push('WORKER_ERRORS');
  if(attempt?.missing)issues.push('MISSING_REPORTS');if(attempt&&attempt.attempts!==attempt.matched)issues.push('OBSERVATION_PENDING');
  if(sample.some(s=>s.auth_kind==='unknown'))issues.push('UNKNOWN_LOGIN_KIND');
  if(g.route===page&&g.window>=window)reasons.push(...issues);
  else if(issues.length)excludedIssueGroups.push({window:g.window,route:g.route,variant:g.variant,reasons:issues});
 }
 const selected=[],variants=pairs.filter(([r])=>r===page).map(([,v])=>v);
 for(const variant of variants){
  const k=window+':'+page+':'+variant,row=map.get(k),attempt=attempts.get(k),sample=samples.get(k)||[];
  if(!row||row.compared<1)reasons.push('MISSING_COVERAGE');
  if(!attempt||attempt.matched!==row?.compared)reasons.push('UNMATCHED_COMPARISONS');
  if(!sample.some(s=>s.auth_kind==='line')||!sample.some(s=>s.auth_kind==='email'))reasons.push('MISSING_SECTION_CHANNEL_COVERAGE');
  selected.push(...sample);
 }
 const line=selected.filter(s=>s.auth_kind==='line').length,email=selected.filter(s=>s.auth_kind==='email').length;
 const periods=new Set(selected.map(s=>Math.floor((iso(s.observed_at)-(start+window*DAY))/(8*3600000)))).size;
 if(selected.length<20||line<10||email<10)reasons.push('INSUFFICIENT_AUTH_COVERAGE');
 if(periods<3)reasons.push('INSUFFICIENT_PERIOD_COVERAGE');
 return {shadowEligible:reasons.length===0,cutoverAuthorized:false,page:validPage?page:null,
  window:completed>=1?{index:window,started_at:new Date(start+window*DAY).toISOString(),ended_at:new Date(start+(window+1)*DAY).toISOString()}:null,
  samples:{total:selected.length,line,email,periods},excludedIssueGroups,reasons:[...new Set(reasons)],
  requiredGates:[...requiredGates],evidence:'SHADOW_CANDIDATE_REQUIRES_VERIFIED_REMOTE_EXPORT_AND_RELEASE_GATES'};
}
