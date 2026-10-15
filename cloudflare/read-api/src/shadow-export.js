// Operator-only query builders; no public export route. All selections are
// bound parameters. The calling CLI must verify the selected scope/release.
export function shadowExportQueries(db,{scope,epoch,release,startedAt,now=Date.now()}) {
  const start=Date.parse(startedAt);
  if(!/^[a-f0-9]{64}$/.test(scope)||!/^[a-zA-Z0-9_-]{8,64}$/.test(epoch)||!/^[a-zA-Z0-9_-]{8,80}$/.test(release)||
    !Number.isFinite(start)||new Date(start).toISOString()!==startedAt||!Number.isSafeInteger(now)||now<start) throw Error('Invalid export selection');
  const end=new Date(now).toISOString();
  const filter='scope_hash=? AND epoch=? AND release_id=? AND observed_at>=? AND observed_at<?';
  const bind=[scope,epoch,release,startedAt,end];
  const selection='r.scope_hash=? AND r.epoch=? AND r.release_id=?';
  const normalized=`WITH observations AS (
    SELECT r.route,r.variant,r.outcome,r.headers_ms,r.elapsed_ms,r.field_count,r.clock_count,
      COALESCE(a.observed_at,r.observed_at) AS observed_at,
      (a.outcome='completed' AND a.status=200 AND a.report_id=r.report_id) AS matched
    FROM shadow_reports AS r LEFT JOIN shadow_attempts AS a ON a.attempt_id=r.attempt_id
    WHERE ${selection})`;
  // ISO server timestamps have exactly three millisecond digits. Integer math
  // keeps observations just before a rolling boundary in the correct window.
  const window="CAST((CAST(strftime('%s',observed_at) AS INTEGER)*1000+CAST(substr(observed_at,21,3) AS INTEGER)-?)/86400000 AS INTEGER)";
  return [
    db.prepare(`${normalized} SELECT ${window} AS window,route,variant,
      SUM(outcome='compared' AND matched) AS compared,SUM(outcome='worker_error') AS errors,SUM(field_count) AS diffs,SUM(clock_count) AS clock_diffs
      FROM observations WHERE observed_at>=? AND observed_at<? GROUP BY window,route,variant ORDER BY window,route,variant`).bind(scope,epoch,release,start,startedAt,end),
    db.prepare(`${normalized} SELECT ${window} AS window,route,variant,headers_ms,elapsed_ms
      FROM observations WHERE observed_at>=? AND observed_at<? AND outcome='compared' AND matched ORDER BY window,route,variant,elapsed_ms`).bind(scope,epoch,release,start,startedAt,end),
    db.prepare(`SELECT r.route,r.variant,d.field_path,COUNT(*) AS count FROM shadow_diffs AS d
      JOIN shadow_reports AS r ON d.observation_id=r.report_id
      LEFT JOIN shadow_attempts AS a ON a.attempt_id=r.attempt_id WHERE ${selection} AND COALESCE(a.observed_at,r.observed_at)>=? AND COALESCE(a.observed_at,r.observed_at)<?
      GROUP BY r.route,r.variant,d.field_path ORDER BY r.route,r.variant,d.field_path`).bind(...bind),
    db.prepare(`SELECT ${window} AS window,route,variant,COUNT(*) AS attempts,
      SUM(outcome='completed' AND status=200 AND report_id IS NOT NULL) AS matched,
      SUM(outcome='completed' AND status!=200) AS errors,
      SUM(report_id IS NULL) AS missing
      FROM shadow_attempts WHERE ${filter} GROUP BY window,route,variant ORDER BY window,route,variant`)
      .bind(start,...bind),
    db.prepare(`SELECT r.route,r.variant,d.field_path,COUNT(*) AS count FROM shadow_clock_diffs AS d
      JOIN shadow_reports AS r ON d.observation_id=r.report_id
      JOIN shadow_attempts AS a ON a.attempt_id=r.attempt_id WHERE ${selection} AND a.observed_at>=? AND a.observed_at<?
      GROUP BY r.route,r.variant,d.field_path ORDER BY r.route,r.variant,d.field_path`).bind(...bind)
  ];
}
