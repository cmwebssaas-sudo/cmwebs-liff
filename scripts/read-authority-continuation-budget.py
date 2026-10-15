"""Linked continuation accounting only. No network or credential IO.

The JS owner retains fd3 across every callback. There is one persistent process;
finish, EOF, failed admission or lost ownership never authorize a new process.
Old C2/I17 are written solely by the byte-pinned original ledger child. Recovery
without this journal is a separate pinned facade, after live-owner drain +60s.

Frozen JSONL protocol (one persistent --inherited-lock process, parent holds fd3):
Config: path, epoch, binding, decisionHash, expiresAt, now, ownerNonce,
original (exact old native options including binding/now), baseline {path,sha256},
legacyBudget {path,sha256}, policySource {path,sha256}. Epoch equals original.
Requests: inspect; wait/debit(operation,now); plan-ready(operations,now);
rpc-wait/rpc-begin(operation,credentialExpiresAt,now); rpc-finish(now);
oldcleanup-wait/oldcleanup-debit(kind,action,now); stop(now); finish(now).
All operation descriptors use the offline compiler's exact one-unit schema.
View: ok, spent, state, waitMs, newSpent, w0, expiresAt, deadlineUtc,
deadlineTaipei, chargedUpperBoundMs, planReady, rpc {beganAt,complete},
cleanup {cActions,iActions}. finish returns {ok:true,finished:true} and exits.
--request-stop accepts only {path,epoch,binding}; --policy prints the fixed table.
Map readiness and local finish do not prove remote compatibility, native runtime,
quota or deployment acceptance. The driver must verify external prerequisites,
Google done:true/no error/unique compatible:true and every actual postcheck.
"""
import copy, fcntl, hashlib, json, os, re, stat, subprocess, sys, uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta

DECISION='f227ebbf2ca791d521e0008a639c2fa4ecb31e5be793478c45ffee47b420c92d'
LEGACY_SOURCE='7f04fc0f0e1f1968029fc666297bf0ca83d871e31c310117ec94ebec3c050e18'
POLICY_SOURCE='06112c8340a04b763d70580883e4bc2b4ddb5fb6d18a22eb577e78ef10fd119f'
LEGACY_DECISION='3701527108376e07470bc920336fbbd0f78015cb1e55dbfe35090ee059130cb9'
C=['restore-editor','read-restored-editor']
I=['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','restore-original-guard','verify-original-guard','restore-thin-guard','verify-thin-guard','remove-testing-user','verify-testing-user-removed','revoke-token','verify-token-revoked','read-original-editor','read-original-versions','read-original-deployments','read-original-project','read-original-triggers']
LIMITS={'A':9,'B':13,'C':9,'D':10,'E':7,'F':30,'H':1,'I':17,'P':4,'G':4,'T':3,'N':24}
TARGETS=['original-settings','original-triggers','thin-settings','oauth-audience','oauth-client']
OPERATIONS=json.loads(r'''{
 "A:original-project": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "A:original-editor": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "A:original-versions": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "A:original-deployments": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "A:original-v1-content": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "A:original-cloud-backup": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "A:original-triggers-backup": {
  "actor": "publisher",
  "target": "original-triggers",
  "methods": [
   "snapshot"
  ]
 },
 "A:original-properties-backup": {
  "actor": "publisher",
  "target": "original-settings",
  "methods": [
   "read-key-presence"
  ]
 },
 "A:original-container-acl": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "B:fixture-import": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "POST"
  ]
 },
 "B:fixture-file-readback": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "B:original-acl-fresh": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "B:synthetic-acl-baseline": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "B:caller-permission-id": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "B:reader-create": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "POST"
  ]
 },
 "B:reader-acl-readback": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "B:fixture-native": {
  "actor": "caller",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "B:auth-tab-users": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "B:auth-tab-workspaces": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "B:auth-tab-members": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "B:auth-tab-email": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "B:auth-tab-settings": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "C:library-source-put": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "PUT"
  ]
 },
 "C:library-version-create": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "POST"
  ]
 },
 "C:library-fixed-content": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "C:restore-editor": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "PUT"
  ]
 },
 "C:read-restored-editor": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "C:library-versions-inventory": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "C:library-deployments-inventory": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "C:original-properties-write": {
  "actor": "publisher",
  "target": "original-settings",
  "methods": [
   "click",
   "fill"
  ]
 },
 "C:original-properties-readback": {
  "actor": "publisher",
  "target": "original-settings",
  "methods": [
   "read-key-presence"
  ]
 },
 "D:thin-project-backup": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "D:thin-source-backup": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "D:thin-gcp-link": {
  "actor": "publisher",
  "target": "thin-settings",
  "methods": [
   "click",
   "fill"
  ]
 },
 "D:thin-source-put": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "PUT"
  ]
 },
 "D:thin-version-create": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "POST"
  ]
 },
 "D:thin-fixed-content": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "D:thin-deployment-create": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "POST"
  ]
 },
 "D:thin-deployments-inventory": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "D:thin-properties-write": {
  "actor": "publisher",
  "target": "thin-settings",
  "methods": [
   "click",
   "fill"
  ]
 },
 "D:thin-properties-readback": {
  "actor": "publisher",
  "target": "thin-settings",
  "methods": [
   "read-key-presence"
  ]
 },
 "E:testing-user-write": {
  "actor": "publisher",
  "target": "oauth-audience",
  "methods": [
   "click",
   "fill"
  ]
 },
 "E:testing-user-readback": {
  "actor": "publisher",
  "target": "oauth-audience",
  "methods": [
   "snapshot"
  ]
 },
 "E:client-create": {
  "actor": "publisher",
  "target": "oauth-client",
  "methods": [
   "click",
   "fill"
  ]
 },
 "E:client-readback": {
  "actor": "publisher",
  "target": "oauth-client",
  "methods": [
   "snapshot"
  ]
 },
 "E:oauth-response": {
  "actor": "caller",
  "target": "caller-oauth",
  "methods": [
   "click"
  ]
 },
 "E:token-exchange": {
  "actor": "caller",
  "target": "caller-oauth",
  "methods": [
   "POST"
  ]
 },
 "E:caller-userinfo": {
  "actor": "caller",
  "target": "caller-identity",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-before.original-project": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-before.original-editor": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-before.original-versions": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-before.original-deployments": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-before.library-content": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-before.thin-content": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-before.thin-deployments": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-before.synthetic-acl": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-before.original-acl": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-before.original-settings": {
  "actor": "publisher",
  "target": "original-settings",
  "methods": [
   "read-key-presence"
  ]
 },
 "F:wrapper-before.original-triggers": {
  "actor": "publisher",
  "target": "original-triggers",
  "methods": [
   "snapshot"
  ]
 },
 "F:wrapper-before.thin-settings": {
  "actor": "publisher",
  "target": "thin-settings",
  "methods": [
   "read-key-presence"
  ]
 },
 "F:wrapper-before.oauth-audience": {
  "actor": "publisher",
  "target": "oauth-audience",
  "methods": [
   "snapshot"
  ]
 },
 "F:wrapper-before.oauth-client": {
  "actor": "publisher",
  "target": "oauth-client",
  "methods": [
   "snapshot"
  ]
 },
 "F:wrapper-before.caller-sheets-metadata": {
  "actor": "caller",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-after.original-project": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-after.original-editor": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-after.original-versions": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-after.original-deployments": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-after.library-content": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-after.thin-content": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-after.thin-deployments": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-after.synthetic-acl": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-after.original-acl": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "F:wrapper-after.original-settings": {
  "actor": "publisher",
  "target": "original-settings",
  "methods": [
   "read-key-presence"
  ]
 },
 "F:wrapper-after.original-triggers": {
  "actor": "publisher",
  "target": "original-triggers",
  "methods": [
   "snapshot"
  ]
 },
 "F:wrapper-after.thin-settings": {
  "actor": "publisher",
  "target": "thin-settings",
  "methods": [
   "read-key-presence"
  ]
 },
 "F:wrapper-after.oauth-audience": {
  "actor": "publisher",
  "target": "oauth-audience",
  "methods": [
   "snapshot"
  ]
 },
 "F:wrapper-after.oauth-client": {
  "actor": "publisher",
  "target": "oauth-client",
  "methods": [
   "snapshot"
  ]
 },
 "F:wrapper-after.caller-sheets-metadata": {
  "actor": "caller",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "H:wrapper-compatibility-rpc": {
  "actor": "caller",
  "target": "thin-project",
  "methods": [
   "POST"
  ]
 },
 "I:close-deployment": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "DELETE"
  ]
 },
 "I:verify-closed-deployment": {
  "actor": "publisher",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "I:remove-reader": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "DELETE"
  ]
 },
 "I:verify-reader-removed": {
  "actor": "publisher",
  "target": "synthetic-sheet",
  "methods": [
   "GET"
  ]
 },
 "I:restore-original-guard": {
  "actor": "publisher",
  "target": "original-settings",
  "methods": [
   "click",
   "fill"
  ]
 },
 "I:verify-original-guard": {
  "actor": "publisher",
  "target": "original-settings",
  "methods": [
   "read-key-presence"
  ]
 },
 "I:restore-thin-guard": {
  "actor": "publisher",
  "target": "thin-settings",
  "methods": [
   "click",
   "fill"
  ]
 },
 "I:verify-thin-guard": {
  "actor": "publisher",
  "target": "thin-settings",
  "methods": [
   "read-key-presence"
  ]
 },
 "I:remove-testing-user": {
  "actor": "publisher",
  "target": "oauth-audience",
  "methods": [
   "click"
  ]
 },
 "I:verify-testing-user-removed": {
  "actor": "publisher",
  "target": "oauth-audience",
  "methods": [
   "snapshot"
  ]
 },
 "I:revoke-token": {
  "actor": "caller",
  "target": "caller-oauth",
  "methods": [
   "POST"
  ]
 },
 "I:verify-token-revoked": {
  "actor": "caller",
  "target": "caller-oauth",
  "methods": [
   "GET"
  ]
 },
 "I:read-original-editor": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "I:read-original-versions": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "I:read-original-deployments": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "I:read-original-project": {
  "actor": "publisher",
  "target": "original-project",
  "methods": [
   "GET"
  ]
 },
 "I:read-original-triggers": {
  "actor": "publisher",
  "target": "original-triggers",
  "methods": [
   "snapshot"
  ]
 },
 "P:caller-bind": {
  "actor": "caller",
  "target": "caller-executions",
  "methods": [
   "bind"
  ]
 },
 "P:publisher-bind": {
  "actor": "publisher",
  "target": "publisher-executions",
  "methods": [
   "bind"
  ]
 },
 "P:publisher-refresh": {
  "actor": "publisher",
  "target": "publisher-oauth",
  "methods": [
   "POST"
  ]
 },
 "P:publisher-userinfo": {
  "actor": "publisher",
  "target": "publisher-identity",
  "methods": [
   "GET"
  ]
 },
 "G:wrapper-before.caller": {
  "actor": "caller",
  "target": "caller-identity",
  "methods": [
   "GET"
  ]
 },
 "G:wrapper-before.publisher": {
  "actor": "publisher",
  "target": "publisher-identity",
  "methods": [
   "GET"
  ]
 },
 "G:wrapper-after.caller": {
  "actor": "caller",
  "target": "caller-identity",
  "methods": [
   "GET"
  ]
 },
 "G:wrapper-after.publisher": {
  "actor": "publisher",
  "target": "publisher-identity",
  "methods": [
   "GET"
  ]
 },
 "T:terminal-1": {
  "actor": "caller",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "T:terminal-2": {
  "actor": "caller",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 },
 "T:terminal-3": {
  "actor": "caller",
  "target": "thin-project",
  "methods": [
   "GET"
  ]
 }
}''')

def fail():raise RuntimeError('TRIAL_STOPPED')
def integer(v):return type(v) is int
def digest(v):return type(v) is str and re.fullmatch('[a-f0-9]{64}',v) is not None
def compact(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'),sort_keys=True)
def sha(v):return hashlib.sha256(v).hexdigest()
def day(t):return datetime.fromtimestamp(t/1000,timezone(timedelta(hours=8))).strftime('%Y-%m-%d')
def timestamp(t,tz):return datetime.fromtimestamp(t/1000,tz).isoformat(timespec='milliseconds')
def exact(v,keys):return type(v) is dict and set(v)==set(keys)
def directory(p):
 s=os.lstat(p)
 if not stat.S_ISDIR(s.st_mode) or s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)!=0o700:fail()
def rawfile(p,source=False):
 s=os.lstat(p)
 if not stat.S_ISREG(s.st_mode) or s.st_uid!=os.getuid() or s.st_nlink!=1 or s.st_size>1000000 or stat.S_IMODE(s.st_mode) not in ([0o600,0o644] if source else [0o600]):fail()
 # Compare the opened inode, rejecting symlink/path replacement during read.
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  opened=os.fstat(fd)
  if (s.st_dev,s.st_ino,s.st_size)!=(opened.st_dev,opened.st_ino,opened.st_size):fail()
  with os.fdopen(fd,'rb',closefd=False) as f:b=f.read(1000001)
  if len(b)!=s.st_size:fail()
  return b
 finally:os.close(fd)
def record(p):
 r=json.loads(rawfile(p))
 if not exact(r,['value','sha256']) or r['sha256']!=sha(compact(r['value']).encode()):fail()
 return r['value']
def synced(p,value,exclusive=False):
 directory(p.parent);target=p if exclusive else p.with_name(p.name+'.'+uuid.uuid4().hex+'.next')
 fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb') as f:f.write(compact(value).encode());f.flush();os.fsync(f.fileno())
 if not exclusive:os.replace(target,p)
 d=os.open(p.parent,os.O_RDONLY)
 try:os.fsync(d)
 finally:os.close(d)
 if json.loads(rawfile(p))!=value:fail()
def save_record(p,value,exclusive=False):synced(p,{'value':value,'sha256':sha(compact(value).encode())},exclusive)
def pinned(v,expected,private=False):
 if not exact(v,['path','sha256']) or v['sha256']!=expected or type(v['path']) is not str:fail()
 p=Path(v['path'])
 if not p.is_absolute():fail()
 if private:directory(p.parent)
 b=rawfile(p,not private)
 if sha(b)!=expected:fail()
 return b

def normalize(op):
 keys=['id','bucket','alias','actor','target','operation','units']
 if type(op) is not dict or not exact(op,keys+(['stage'] if op.get('bucket')=='N' else [])) or type(op['id']) is not str or re.fullmatch('[-a-zA-Z0-9_.]{1,100}',op['id']) is None or type(op['bucket']) is not str or op['bucket'] not in LIMITS or type(op['alias']) is not str or type(op['units']) is not int or op['units']!=1:fail()
 key=op['bucket']+':'+op['alias']
 if op['bucket']=='N':
  if re.fullmatch('navigation-(?:[1-9]|1[0-9]|2[0-4])',op['alias']) is None or op['actor']!='publisher' or op['target'] not in TARGETS or op['operation'] not in ['navigate','snapshot'] or op['stage'] not in ['research','preparation']:fail()
 else:
  rule=OPERATIONS.get(key)
  if rule is None or (op['actor'],op['target'])!=(rule['actor'],rule['target']) or op['operation'] not in rule['methods']:fail()
 return key

def complete_map(operations):
 if type(operations) is not list or len(operations)>131:fail()
 ids=set();used={};buckets={k:0 for k in LIMITS};research=0;preparation=0
 for op in operations:
  key=normalize(op)
  if key in used or op['id'] in ids:fail()
  used[key]=op;ids.add(op['id']);buckets[op['bucket']]+=1
  if op['bucket']=='N':
   if op['stage']=='research':research+=1
   else:preparation+=1
 if any(k not in used for k in OPERATIONS) or any(buckets[k]>LIMITS[k] for k in LIMITS) or research>8 or preparation>16 or 27+len(operations)>158:fail()
 return used

def request_stop(cfg):
 if not exact(cfg,['path','epoch','binding']) or not digest(cfg['binding']) or type(cfg['epoch']) is not str or re.fullmatch('[-A-Za-z0-9_]{20,200}',cfg['epoch']) is None:fail()
 p=Path(cfg['path'])
 if not p.is_absolute():fail()
 directory(p.parent);claim=record(Path(str(p)+'.continuation-claim.json'))
 if any(claim.get(k)!=cfg[k] for k in ['path','epoch','binding']):fail()
 marker=Path(str(p)+'.continuation-stop.json')
 try:save_record(marker,cfg,True)
 except FileExistsError:
  if record(marker)!=cfg:fail()

class Ledger:
 def __init__(self,cfg):
  if not exact(cfg,['path','epoch','binding','decisionHash','expiresAt','now','ownerNonce','original','baseline','legacyBudget','policySource']) or cfg['decisionHash']!=DECISION or any(not digest(cfg[k]) for k in ['binding','ownerNonce']) or any(not integer(cfg[k]) for k in ['expiresAt','now']) or type(cfg['path']) is not str or type(cfg['epoch']) is not str or re.fullmatch('[-A-Za-z0-9_]{20,200}',cfg['epoch']) is None:fail()
  self.cfg=cfg;self.path=Path(cfg['path']);self.original=cfg['original'];self.child=None;self.current_journal=None
  if not self.path.is_absolute():fail()
  directory(self.path.parent)
  self.sources();self.baseline_raw=pinned(cfg['baseline'],cfg['baseline'].get('sha256'),True);self.baseline=json.loads(self.baseline_raw)
  self.legacy_cfg();self.validate_baseline()
  lock=Path(str(self.path)+'.lock');fd=os.fstat(3);named=os.lstat(lock)
  if not stat.S_ISREG(fd.st_mode) or fd.st_uid!=os.getuid() or stat.S_IMODE(fd.st_mode)!=0o600 or fd.st_size!=0 or (fd.st_dev,fd.st_ino)!=(named.st_dev,named.st_ino) or not stat.S_ISREG(named.st_mode) or (fcntl.fcntl(3,fcntl.F_GETFL)&os.O_ACCMODE)!=os.O_RDWR:fail()
  fcntl.flock(3,fcntl.LOCK_EX|fcntl.LOCK_NB)
  root=Path.home()/'.codex/private/cmwebs-authority-trials';directory(root)
  self.old_reg=root/(sha(json.dumps(cfg['epoch'],separators=(',',':')).encode())+'.preparation.json')
  self.reg=root/(sha(json.dumps(cfg['epoch'],separators=(',',':')).encode())+'.continuation.json')
  self.journal=Path(str(self.path)+'.continuation.json');self.claim=Path(str(self.path)+'.continuation-claim.json');self.marker=Path(str(self.path)+'.continuation-stop.json')
  # Validate existing claims/checkpoint and frozen history BEFORE construction of
  # the legacy child, whose old constructor otherwise can create missing claims.
  self.old_current()
  for p in [self.reg,self.claim,self.journal,self.marker]:
   try:os.lstat(p);fail()
   except FileNotFoundError:pass
  t=cfg['now'];end=cfg['expiresAt']
  if not 0<end-t<=21600000 or day(t)!=day(end) or any(x>t for x in self.baseline['preparation']['calls']):fail()
  self.start_child();self.old_read({'op':'cleanup-inspect'});self.old_current()
  identity={'path':str(self.path),'epoch':cfg['epoch'],'binding':cfg['binding'],'originalBinding':self.original['binding'],'baselineSha256':cfg['baseline']['sha256'],'ownerHash':sha(cfg['ownerNonce'].encode()),'decisionHash':DECISION,'legacyBudgetSha256':LEGACY_SOURCE,'policySourceSha256':POLICY_SOURCE,'w0':t,'expiresAt':end}
  self.identity=identity
  j={**identity,'version':1,'day':day(t),'deadlineUtc':timestamp(end,timezone.utc),'deadlineTaipei':timestamp(end,timezone(timedelta(hours=8))),'state':'ready','spent':0,'events':[],'plan':None,'chargedUpperBoundMs':0,'rpc':{'beganAt':None,'complete':False},'finished':False}
  # Any interrupted creation consumes the sole segment; retry cannot recreate it.
  save_record(self.reg,{'identity':identity,'checkpoint':None},True)
  save_record(self.claim,identity,True)
  self.persist(j)
 def sources(self):
  pinned(self.cfg['legacyBudget'],LEGACY_SOURCE);pinned(self.cfg['policySource'],POLICY_SOURCE)
 def legacy_cfg(self):
  o=self.original
  if not exact(o,['path','epoch','binding','approvalHash','proposalHash','legacySha256','importedReads','expiresAt','now','decisionHash','nativeTargets']) or o['path']!=str(self.path) or o['epoch']!=self.cfg['epoch'] or o['decisionHash']!=LEGACY_DECISION or o['importedReads']!=25 or any(not digest(o[k]) for k in ['binding','approvalHash','proposalHash','legacySha256']) or not integer(o['expiresAt']) or not integer(o['now']):fail()
  targets=['original-settings','original-triggers','thin-settings','oauth-audience','oauth-client','caller-executions','publisher-executions']
  if not exact(o['nativeTargets'],targets) or any(type(v) is not str or len(v)>2000 for v in o['nativeTargets'].values()):fail()
 def validate_baseline(self):
  b=self.baseline;p=b.get('preparation',{})
  if not exact(b,['limit','spent','kind','proposal_sha256','approval_sha256','prior_limit','preparation']) or b['limit']!=160 or b['spent']!=27 or b['prior_limit']!=40 or b['kind']!='preparation-management-reads' or b['proposal_sha256']!=self.original['proposalHash'] or b['approval_sha256']!=self.original['approvalHash'] or p.get('version')!=1 or p.get('binding')!=self.original['binding'] or p.get('legacySha256')!=self.original['legacySha256'] or p.get('expiresAt')!=self.original['expiresAt'] or p.get('importedReads')!=25 or p.get('decisionHash')!=LEGACY_DECISION or p.get('state')!='stopped' or p.get('nativePlan') is not None or p.get('cActions')!=[] or p.get('iActions')!=[] or p.get('bindingRepair',{}).get('status')!='in-flight' or len(p.get('events',[]))!=2:fail()
  for e,(kind,action) in zip(p['events'],[('ordinary','P:caller-bind'),('ordinary','N:research:caller:caller-executions:getTab:1')]):
   if not exact(e,['kind','action','units','time','outcome']) or (e['kind'],e['action'],e['units'],e['outcome'])!=(kind,action,1,'UNKNOWN'):fail()
 def old_current(self):
  o=self.original;b=self.baseline;raw=rawfile(self.path);v=json.loads(raw);p=v.get('preparation',{});bp=b['preparation']
  if record(Path(str(self.path)+'.preparation-claim.json'))!={'path':str(self.path),'epoch':self.cfg['epoch'],'binding':o['binding']} or record(self.old_reg)!={'path':str(self.path),'binding':o['binding'],'checkpoint':v}:fail()
  if type(p.get('events')) is not list or type(p.get('calls')) is not list or p['events'][:2]!=bp['events'] or p['calls'][:27]!=bp['calls']:fail()
  cs=[];ins=[];tail=p['events'][2:];calls=list(bp['calls'])
  if raw!=(self.baseline_raw if not tail else compact(v).encode()):fail()
  for e in tail:
   if not exact(e,['kind','action','units','time','outcome']) or e['kind'] not in ['C','I'] or type(e['units']) is not int or e['units']!=1 or e['outcome']!='UNKNOWN' or not integer(e['time']) or any(t>e['time'] for t in calls):fail()
   arr=cs if e['kind']=='C' else ins;allowed=C if e['kind']=='C' else I
   if e['action'] not in allowed or e['action'] in arr or (e['action']=='read-restored-editor' and 'restore-editor' not in cs):fail()
   arr.append(e['action']);calls.append(e['time'])
  if v.get('spent')!=27+len(tail) or p['calls']!=calls or p.get('cActions')!=cs or p.get('iActions')!=ins:fail()
  restored=copy.deepcopy(v);restored['spent']=27
  for k in ['calls','events','cActions','iActions']:restored['preparation'][k]=copy.deepcopy(bp[k])
  if restored!=b:fail()
  return v
 def start_child(self):
  self.child=subprocess.Popen([sys.executable,self.cfg['legacyBudget']['path'],'--inherited-lock'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,pass_fds=(3,),text=True)
  self.child.stdin.write(compact(self.original)+'\n');self.child.stdin.flush()
  r=json.loads(self.child.stdout.readline(20001))
  if r.get('ok') is not True:fail()
 def old_read(self,q):
  self.child.stdin.write(compact(q)+'\n');self.child.stdin.flush();line=self.child.stdout.readline(20001)
  if len(line)>20000:fail()
  r=json.loads(line)
  if type(r) is not dict or r.get('ok') is not True:fail()
  return r
 def persist(self,j):
  save_record(self.reg,{'identity':self.identity,'checkpoint':j})
  synced(self.journal,j);self.current_journal=copy.deepcopy(j)
 def current(self):
  self.sources();old=self.old_current();j=json.loads(rawfile(self.journal))
  if j!=self.current_journal or record(self.claim)!=self.identity or record(self.reg)!={'identity':self.identity,'checkpoint':j}:fail()
  return j,old
 def veto(self):
  try:os.lstat(self.marker);return True
  except FileNotFoundError:return False
  except OSError:return True
 def stopped(self):
  request_stop({k:self.cfg[k] for k in ['path','epoch','binding']})
  j,_=self.current();j['state']='stopped';self.persist(j)
 def times(self,j,old,t):
  if not integer(t):fail()
  times=old['preparation']['calls']+[e['time'] for e in j['events']]
  if t<j['w0'] or any(x>t for x in times):fail()
  return times
 def rate(self,times,t):
  recent=sorted(x for x in times if t-x<60000)
  return 0 if len(recent)<10 else recent[-10]+60000-t
 def ordinary_check(self,j,old,op,t,rpc=False):
  key=normalize(op);times=self.times(j,old,t)
  if j['state']!='ready' or j['finished'] or self.veto() or t>=j['expiresAt'] or day(t)!=j['day']:fail()
  if key.startswith('I:') or key in ['C:'+v for v in C] or (key=='H:wrapper-compatibility-rpc')!=rpc:fail()
  used={normalize(e['operation']):e['operation'] for e in j['events']}
  if key in used or any(v['id']==op['id'] for v in used.values()):fail()
  # P/N preflight is the sole initial admission. A complete map adds no remote
  # authorization; the JS driver separately verifies external prerequisites.
  if j['plan'] is None:
   if key not in ['P:caller-bind','P:publisher-bind'] and not (op['bucket']=='N' and op['stage']=='research'):fail()
  else:
   mapped=complete_map(j['plan'])
   if mapped.get(key)!=op:fail()
  if op['bucket']=='N':
   if any('P:'+p not in used for p in ['caller-bind','publisher-bind']):fail()
   count=sum(1 for e in j['events'] if e['operation']['bucket']=='N' and e['operation']['stage']==op['stage'])
   if count>=(8 if op['stage']=='research' else 16):fail()
  began=j['rpc']['beganAt'] is not None
  post=key.startswith(('F:wrapper-after.','G:wrapper-after.','T:'))
  if post!=began or (began and j['rpc']['complete']):fail()
  if key.startswith(('A:','B:','C:','D:','E:','F:','G:','H:')) and any('P:'+v not in used for v in ['caller-bind','publisher-bind','publisher-refresh','publisher-userinfo']):fail()
  if rpc:
   required=[k for k in OPERATIONS if k.startswith(('A:','B:','C:','D:','E:','F:wrapper-before.','G:wrapper-before.')) and k not in ['C:'+v for v in C]]
   if any(k not in used for k in required) or old['preparation']['cActions']!=C or j['chargedUpperBoundMs']!=0:fail()
  if key=='P:publisher-refresh' and 'P:publisher-bind' not in used:fail()
  if key=='P:publisher-userinfo' and 'P:publisher-refresh' not in used:fail()
  reserve=(2-len(old['preparation']['cActions']))+(17-len(old['preparation']['iActions']))+2
  if old['spent']+j['spent']+1>160-reserve:fail()
  ms=self.rate(times,t)
  if t+ms>=j['expiresAt'] or day(t+ms)!=j['day']:fail()
  return ms
 def cleanup(self,q):
  if not exact(q,['op','kind','action','now']) or q['op'] not in ['oldcleanup-wait','oldcleanup-debit'] or q['kind'] not in ['C','I'] or q['action'] not in (C if q['kind']=='C' else I):fail()
  j,old=self.current();times=self.times(j,old,q['now']);p=old['preparation'];kind=q['kind'];action=q['action']
  actions=p['cActions'] if kind=='C' else p['iActions']
  if action in actions or (kind=='C' and action=='read-restored-editor' and 'restore-editor' not in actions):fail()
  reserve=2+(17-len(p['iActions']) if kind=='C' else 2-len(p['cActions']))
  if old['spent']+j['spent']+1>160-reserve:fail()
  original={'op':'wait','kind':kind,'action':action,'units':1,'now':q['now']}
  legacy=self.old_read(original);ms=max(legacy['waitMs'],self.rate(times,q['now']))
  if q['op']=='oldcleanup-wait':return self.view(ms)
  if ms:fail()
  if kind=='I':
   # Presence is a negative veto, including a partial marker. Never repair or
   # erase ambiguous STOP to obtain cleanup authorization; original C/I claims
   # and source/checkpoint validation above are the cleanup authority.
   if not self.veto():request_stop({k:self.cfg[k] for k in ['path','epoch','binding']})
   j['state']='stopped';self.persist(j)
  self.old_read({**original,'op':'debit'});self.old_current()
  return self.view(0)
 def command(self,q):
  if type(q) is not dict:fail()
  op=q.get('op')
  if op=='inspect' and exact(q,['op']):return self.view(0)
  if op in ['oldcleanup-wait','oldcleanup-debit']:return self.cleanup(q)
  if op=='stop' and exact(q,['op','now']):self.stopped();return self.view(0)
  j,old=self.current()
  if op=='finish' and exact(q,['op','now']):
   self.times(j,old,q['now']);j['finished']=True;j['state']='stopped';self.persist(j);return {'ok':True,'finished':True}
  if op=='plan-ready' and exact(q,['op','now','operations']):
   self.times(j,old,q['now']);mapped=complete_map(q['operations'])
   if j['plan'] is not None or self.veto() or j['state']!='ready' or q['now']>=j['expiresAt'] or day(q['now'])!=j['day'] or any(mapped.get(normalize(e['operation']))!=e['operation'] for e in j['events']):fail()
   j['plan']=q['operations'];self.persist(j);return self.view(0)
  if op=='rpc-finish' and exact(q,['op','now']):
   self.times(j,old,q['now']);used={normalize(e['operation']) for e in j['events']}
   required=[k for k in OPERATIONS if k.startswith(('F:wrapper-after.','G:wrapper-after.'))]
   if j['rpc']['beganAt'] is None or j['rpc']['complete'] or any(k not in used for k in required) or self.veto() or j['state']!='ready' or q['now']>=j['expiresAt'] or day(q['now'])!=j['day']:fail()
   j['rpc']['complete']=True;self.persist(j);return self.view(0)
  if op not in ['wait','debit','rpc-wait','rpc-begin'] or not exact(q,['op','operation','now']+(['credentialExpiresAt'] if op.startswith('rpc-') else [])):fail()
  ms=self.ordinary_check(j,old,q['operation'],q['now'],op.startswith('rpc-'))
  if op.startswith('rpc-') and (not integer(q['credentialExpiresAt']) or not q['now']+ms+360000<q['credentialExpiresAt']<=j['expiresAt']):fail()
  if op in ['wait','rpc-wait']:return self.view(ms)
  if ms:fail()
  j['spent']+=1;j['events'].append({'operation':q['operation'],'time':q['now'],'outcome':'UNKNOWN'})
  if op=='rpc-begin':
   if j['chargedUpperBoundMs']!=0:fail()
   j['chargedUpperBoundMs']=360000;j['rpc']['beganAt']=q['now']
  self.persist(j);return self.view(0)
 def view(self,ms=0):
  j,old=self.current();p=old['preparation']
  return {'ok':True,'spent':old['spent']+j['spent'],'state':'stopped' if self.veto() else j['state'],'waitMs':ms,'newSpent':j['spent'],'w0':j['w0'],'expiresAt':j['expiresAt'],'deadlineUtc':j['deadlineUtc'],'deadlineTaipei':j['deadlineTaipei'],'chargedUpperBoundMs':j['chargedUpperBoundMs'],'planReady':j['plan'] is not None,'rpc':j['rpc'],'cleanup':{'cActions':p['cActions'],'iActions':p['iActions']}}
 def close(self):
  if getattr(self,'child',None) is not None:
   try:
    self.child.stdin.write('{"op":"finish"}\n');self.child.stdin.flush();self.child.communicate(timeout=2)
   except Exception:
    self.child.kill();self.child.wait()
  # Never flock(LOCK_UN): fd3 shares the JS owner's open-file description.
  try:os.close(3)
  except OSError:pass

def emit(v):print(compact(v),flush=True)
ledger=None
try:
 os.umask(0o077)
 if sys.argv[1:]==['--policy']:emit(OPERATIONS);sys.exit(0)
 line=sys.stdin.buffer.readline(100001)
 if len(line)>100000:fail()
 if sys.argv[1:]==['--request-stop']:
  request_stop(json.loads(line));emit({'ok':True,'stopRequested':True});sys.exit(0)
 if sys.argv[1:]!=['--inherited-lock']:fail()
 ledger=Ledger.__new__(Ledger);ledger.__init__(json.loads(line));emit(ledger.view())
 for line in sys.stdin.buffer:
  try:
   if len(line)>100000:fail()
   q=json.loads(line);r=ledger.command(q);emit(r)
   if q.get('op')=='finish':break
  except Exception:
   try:ledger.stopped()
   except Exception:pass
   emit({'ok':False,'code':'TRIAL_STOPPED'})
except Exception:emit({'ok':False,'code':'TRIAL_STOPPED'});sys.exit(1)
finally:
 if ledger is not None:ledger.close()
