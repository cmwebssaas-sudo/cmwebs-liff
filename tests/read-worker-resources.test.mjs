import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseProcStat, cpuDelta, sampleOwned, readCpuEvidence, mapSelfCgroup, observe} from '../scripts/observe-read-worker-resources.mjs';

function stat(pid, comm, ppid, user, system, start, rss) {
  const fields = Array(52).fill('0');
  fields[0] = String(ppid); // field 4, after pid / comm / state
  fields[10] = String(user); // field 14
  fields[11] = String(system); // field 15
  fields[18] = String(start); // field 22
  fields[20] = String(rss); // field 24
  return `${pid} (${comm}) S ${fields.join(' ')}`;
}

async function fixture(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'c6-resource-test-'));
  try { return await fn(dir); } finally { await rm(dir, {recursive:true, force:true}); }
}

async function proc(dir, pid, content, children='') {
  const path = join(dir, String(pid), 'task', String(pid));
  await mkdir(path, {recursive:true});
  await writeFile(join(dir, String(pid), 'stat'), content);
  await writeFile(join(path, 'children'), children);
}

test('Linux stat parser handles parentheses and retains numeric CPU/RSS without exposing comm', () => {
  assert.deepEqual(parseProcStat(stat(42, 'node (runner)', 7, 123, 45, 900, 31)),
    {pid:42, ppid:7, comm_type:'node', start_ticks:900, user_ticks:123, system_ticks:45, rss_pages:31});
  assert.equal(parseProcStat('42 (node) S 1 2'), null);
  assert.equal(parseProcStat(stat(42, 'node', 7, -1, 0, 900, 31)), null);
});

test('CPU delta distinguishes new, reused and regressed counters from zero activity', () => {
  const before={pid:10,start_ticks:50,user_ticks:20,system_ticks:10};
  assert.deepEqual(cpuDelta(before,{...before,user_ticks:25,system_ticks:10}), {status:'OK',ticks:5});
  assert.deepEqual(cpuDelta(before,{...before}), {status:'OK',ticks:0});
  assert.deepEqual(cpuDelta(before,{...before,start_ticks:51}), {status:'PID_REUSED',ticks:null});
  assert.deepEqual(cpuDelta(before,{...before,user_ticks:19}), {status:'INVALID',ticks:null});
  assert.deepEqual(cpuDelta(null,before), {status:'NEW',ticks:null});
});

test('owned traversal excludes observer, rejects unrelated PPID, and marks disappeared processes', async () => fixture(async dir => {
  await proc(dir, 42, stat(42,'bash',1,0,0,100,10), '43 44 99');
  await proc(dir, 43, stat(43,'node',42,3,2,110,20), '45');
  await proc(dir, 44, stat(44,'node',42,50,1,120,30)); // observer
  await proc(dir, 45, stat(45,'workerd',43,7,4,130,40));
  await proc(dir, 99, stat(99,'other',77,100,100,140,50));
  const first=await sampleOwned(dir,42,44,new Map(),8);
  assert.equal(first.status,'OK');
  assert.deepEqual(first.processes.map(p=>[p.pid,p.comm_type,p.cpu_delta.status]), [[42,'other','NEW'],[43,'node','NEW'],[45,'workerd','NEW']]);
  assert.equal(first.invalid,1);
  await writeFile(join(dir,'43','stat'),stat(43,'node',42,9,2,111,21));
  await rm(join(dir,'45'),{recursive:true});
  const second=await sampleOwned(dir,42,44,first.next,8);
  assert.equal(second.processes.find(p=>p.pid===43).cpu_delta.status,'PID_REUSED');
  assert.ok(second.missing>=1);
}));

test('owned traversal caps records and reports dropped children', async () => fixture(async dir => {
  await proc(dir, 42, stat(42,'bash',1,0,0,100,10), '43 44');
  await proc(dir, 43, stat(43,'node',42,1,1,110,10));
  await proc(dir, 44, stat(44,'workerd',42,1,1,111,10));
  const result=await sampleOwned(dir,42,999,new Map(),2);
  assert.equal(result.processes.length,2);
  assert.equal(result.dropped,1);
}));

test('cgroup evidence distinguishes numeric zero from missing and invalid counters', async () => fixture(async dir => {
  assert.equal((await readCpuEvidence(dir)).status,'UNAVAILABLE');
  await writeFile(join(dir,'cpu.max'),'200000 100000\n');
  await writeFile(join(dir,'cpu.stat'),'usage_usec 123\nnr_periods 2\nnr_throttled 0\nthrottled_usec 0\n');
  await writeFile(join(dir,'cpuset.cpus.effective'),'0-1,4\n');
  assert.deepEqual(await readCpuEvidence(dir), {status:'OK',version:2,quota_status:'LIMITED',quota_us:200000,period_us:100000,usage_usec:123,nr_periods:2,nr_throttled:0,throttled_usec:0,cpuset_status:'OK',cpuset_count:3});
  await rm(join(dir,'cpuset.cpus.effective'));
  assert.equal((await readCpuEvidence(dir)).cpuset_status,'UNAVAILABLE');
  await writeFile(join(dir,'cpu.stat'),'usage_usec nope\n');
  assert.equal((await readCpuEvidence(dir)).status,'INVALID');
  await writeFile(join(dir,'cpu.stat'),'usage_usec 1\nnr_periods 1\nnr_throttled 0\nthrottled_usec 0\n');
  await writeFile(join(dir,'cpu.max'),'999999999999999999 100000\n');
  assert.equal((await readCpuEvidence(dir)).status,'INVALID');
}));

test('cgroup path mapping selects own nested group and rejects an unrelated mount root', () => {
  const own='0::/user.slice/job-7\n';
  const mounts='35 23 0:29 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n';
  assert.deepEqual(mapSelfCgroup(own,mounts),{version:2,path:'/sys/fs/cgroup/user.slice/job-7'});
  assert.equal(mapSelfCgroup(own,'35 23 0:29 /other.slice /sys/fs/cgroup rw - cgroup2 cgroup rw\n'),null);
});

test('observer abort writes a terminal summary, closes its file, and does not sample after stop', async () => fixture(async dir => {
  await proc(dir,42,stat(42,'bash',1,0,0,100,10));
  const output=join(dir,'resources.jsonl'), controller=new AbortController();
  setTimeout(()=>controller.abort(),30);
  await observe(42,output,{procRoot:dir,cgroupRoot:dir,signal:controller.signal});
  const lines=(await readFile(output,'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(lines[0].type,'sample');
  assert.equal(lines.at(-1).status,'STOPPED');
  assert.equal(lines.at(-1).samples,1);
  assert.equal(lines.length,2);
}));

test('terminal summary retains bounded owned CPU totals and cgroup status for CI readback', async () => fixture(async dir => {
  await proc(dir,42,stat(42,'node',1,0,0,100,10));
  const output=join(dir,'resources.jsonl'), controller=new AbortController();
  setTimeout(()=>writeFile(join(dir,'42','stat'),stat(42,'node',1,3,2,100,12)),40);
  setTimeout(()=>controller.abort(),540);
  await observe(42,output,{procRoot:dir,cgroupRoot:dir,signal:controller.signal});
  const lines=(await readFile(output,'utf8')).trim().split('\n').map(JSON.parse);
  const summary=lines.at(-1);
  assert.equal(summary.samples,2);
  assert.deepEqual(summary.process_totals,[{pid:42,ppid:1,start_ticks:100,comm_type:'node',cpu_ticks:5,max_rss_pages:12}]);
  assert.equal(summary.cgroup_first.status,'UNAVAILABLE');
  assert.equal(summary.cgroup_last.status,'UNAVAILABLE');
}));
