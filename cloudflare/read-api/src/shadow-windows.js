const routes=[['home','home'],['home','actions'],...['revenue','tenants','rooms','arrears','properties'].map(route=>[route,'default'])];
export function evaluateShadowWindows(input,{now,epoch,release,page}) {
  const reasons=[],start=Date.parse(input?.started_at);
  if(page!==undefined&&!routes.some(([route])=>route===page)) reasons.push('INVALID_PAGE');
  const required=page===undefined?routes:routes.filter(([route])=>route===page);
  if(!Number.isFinite(start)||!Number.isSafeInteger(now)||now-start<7*86400000) reasons.push('INCOMPLETE_REAL_TIME');
  if(input?.epoch!==epoch||input?.release!==release||!epoch||!release) reasons.push('RELEASE_MISMATCH');
  const completed=Number.isFinite(start)&&Number.isSafeInteger(now)?Math.floor((now-start)/86400000):0;
  const first=Math.max(0,completed-7);
  const seen=new Map();
  if(!Array.isArray(input?.rows)) reasons.push('INVALID_AGGREGATE');
  for(const row of Array.isArray(input?.rows)?input.rows:[]) {
    if(!row||typeof row!=='object') {reasons.push('INVALID_AGGREGATE');continue;}
    const key=row.window+':'+row.route+':'+row.variant;
    if(!Number.isInteger(row.window)||row.window<0||row.window>completed||!routes.some(([r,v])=>r===row.route&&v===row.variant)||seen.has(key)||
      ['compared','errors','diffs'].some(field=>!Number.isSafeInteger(row[field])||row[field]<0)) {reasons.push('INVALID_AGGREGATE');continue;}
    seen.set(key,row);
    // Any unresolved failure in this epoch requires a fix and new epoch,
    // including failures after the first successful week.
    if(row.errors) reasons.push('WORKER_ERRORS');
    if(row.diffs) reasons.push('FIELD_DIFFERENCES');
  }
  const attempts=new Map();
  if(!Array.isArray(input?.attempt_rows)) reasons.push('MISSING_ATTEMPT_EVIDENCE');
  for(const row of Array.isArray(input?.attempt_rows)?input.attempt_rows:[]) {
    if(!row||typeof row!=='object') {reasons.push('INVALID_AGGREGATE');continue;}
    const key=row.window+':'+row.route+':'+row.variant;
    if(!Number.isInteger(row.window)||row.window<0||row.window>completed||!routes.some(([r,v])=>r===row.route&&v===row.variant)||attempts.has(key)||
      ['attempts','matched','errors','missing'].some(field=>!Number.isSafeInteger(row[field])||row[field]<0)||row.matched>row.attempts) {reasons.push('INVALID_AGGREGATE');continue;}
    attempts.set(key,row);
    if(row.errors) reasons.push('WORKER_ERRORS');
    if(row.missing) reasons.push('MISSING_REPORTS');
    if(row.attempts!==row.matched) reasons.push('OBSERVATION_PENDING');
    if((seen.get(key)?.compared||0)!==row.matched) reasons.push('UNMATCHED_COMPARISONS');
  }
  for(let window=first;window<first+7;window++) for(const [route,variant] of required) {
    const row=seen.get(window+':'+route+':'+variant);
    if(!row||row.compared<1) reasons.push('MISSING_COVERAGE');
    const attempt=attempts.get(window+':'+route+':'+variant);
    if(!attempt||attempt.matched!==row?.compared) reasons.push('UNMATCHED_COMPARISONS');
    if(row?.errors) reasons.push('WORKER_ERRORS');
    if(row?.diffs) reasons.push('FIELD_DIFFERENCES');
  }
  return {eligible:reasons.length===0,coverage:page||'all',reasons:[...new Set(reasons)],evidence:'AGGREGATE_ONLY_REQUIRES_VERIFIED_REMOTE_EXPORT'};
}
