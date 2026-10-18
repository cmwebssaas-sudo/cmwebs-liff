"""Linked continuation accounting only. No network or credential IO.

The JS owner retains fd3 across every callback. There is one persistent process;
finish, EOF, failed admission or lost ownership never authorize a new process.
Standalone mode selects the same accounting mechanism with a separate singleton,
imports the stopped continuation1 and diagnosis3, and retains original27. Its
config adds byte-pinned history; old histories and claims are never reopened.
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
--standalone-inherited-lock / --standalone-request-stop / --standalone-policy
select the separately approved standalone decision; the original CLI is retained.
Map readiness and local finish do not prove remote compatibility, native runtime,
quota or deployment acceptance. The driver must verify external prerequisites,
Google done:true/no error/unique compatible:true and every actual postcheck.
"""
import copy, fcntl, hashlib, json, os, re, stat, subprocess, sys, uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta

DECISION='f227ebbf2ca791d521e0008a639c2fa4ecb31e5be793478c45ffee47b420c92d'
LEGACY_SOURCE='7f04fc0f0e1f1968029fc666297bf0ca83d871e31c310117ec94ebec3c050e18'
HISTORICAL_POLICY_SOURCE='06112c8340a04b763d70580883e4bc2b4ddb5fb6d18a22eb577e78ef10fd119f'
PREDECESSOR_POLICY_SOURCE='49014902c98921ca18b4a09895713be0decd631bebefca661157c3a542a7e01f'
POLICY_SOURCE='17313472ea90e2e323c0deb53312a52345a23436813ce80be6354bd6c5662132'
CLOSED_POLICY_SOURCE='3a30a2ad1a93ef2cba5db552152cc909df9bddb597eb0cc7afddc571abc9aec8'
READONLY_DECISION='ccb1f0d40fe93df36d18f687da256287b1e3980b9397b58c31d6c75c6c6b8b60'
DEADLINE_DECISION='91b6c8f359fcbe0a8e72804ace101ce39cd063b80609a9c2caca4f8f36cfa7c4'
READONLY_W0=1792142820041
READONLY_EXPIRY=1792164420041
STAGED_POLICY_SOURCE='e711e68679b2010a1079198c0bc028f4b3a385cda2d091d37c4d2f3bbc9e9434'
STAGED_DECISION='19c51070c90552bfe5af0c998a45cc5a2104efe17d6428dae046cdc492d3b16d'
STANDALONE_DECISION='02c75938cc8ecff17c907431db861613bb7f4e2af967f185c6b9933758f7dfd8'
OWNER_ANSWER='同意改用單一獨立合成腳本，取代舊試驗入口與停止規則；維持累積160上限及安全、效能、回退驗收，通過後依既有批次授權持續完成上線。'
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

STANDALONE_OPERATIONS={k:{**v,**({'target':'thin-project'} if k.endswith('.library-content') else {})} for k,v in OPERATIONS.items() if not k.startswith('C:')}
for key,method in [('D:standalone-acl-baseline','GET'),('D:standalone-reader-create','POST'),('F:wrapper-before.standalone-acl','GET'),('F:wrapper-after.standalone-acl','GET'),('J:script-remove','DELETE'),('J:script-verify','GET')]:
 STANDALONE_OPERATIONS[key]={'actor':'publisher','target':'thin-project','methods':[method]}
STANDALONE_LIMITS={**LIMITS,'C':0,'D':12,'F':32,'J':2}

STAGED_OPERATIONS={k:v for k,v in STANDALONE_OPERATIONS.items() if k not in ['P:caller-bind','P:publisher-bind'] and not k.startswith('B:auth-tab-')}
STAGED_OPERATIONS['B:auth-tabs-batch']={'actor':'publisher','target':'synthetic-sheet','methods':['GET']}
STAGED_LIMITS={**STANDALONE_LIMITS,'B':9,'P':2,'N':16}
STAGES={
 'baseline':[k for k in STAGED_OPERATIONS if k.startswith(('A:','P:')) or k in ['D:thin-project-backup','D:thin-source-backup']],
 'resources':['D:standalone-acl-baseline','B:original-acl-fresh','B:fixture-import','B:fixture-file-readback','B:synthetic-acl-baseline','B:caller-permission-id','B:reader-create','B:reader-acl-readback','D:standalone-reader-create'],
 'cloud-link':['D:thin-gcp-link'],
 'properties':['D:thin-properties-write','D:thin-properties-readback'],
 'oauth-audience':['E:testing-user-write','E:testing-user-readback'],
 'oauth-client':['E:client-create','E:client-readback'],
 'publication':['D:thin-source-put','D:thin-version-create','D:thin-fixed-content','D:thin-deployment-create','D:thin-deployments-inventory'],
 'caller-oauth':['E:oauth-response','E:token-exchange','E:caller-userinfo'],
 'readbacks':[k for k in STAGED_OPERATIONS if k.startswith(('F:','G:','H:','T:')) or k in ['B:fixture-native','B:auth-tabs-batch']],
 'recovery':[k for k in STAGED_OPERATIONS if k.startswith(('I:','J:'))]
}
def staged_n(op,readonly=False):
 pub=re.fullmatch('publisher-(?:[1-9]|1[0-2])',op['alias']) is not None and op['actor']=='publisher' and op['target'] in TARGETS and op['operation'] in ['navigate','snapshot'] and op['stage']=='publisher'
 caller=op['alias'] in ['caller-oauth-enter','caller-oauth-observe'] and op['actor']=='caller' and op['target']=='caller-oauth' and op['operation']==('navigate' if op['alias']=='caller-oauth-enter' else 'snapshot') and op['stage']=='caller-oauth'
 thin=op['alias'] in ['thin-triggers-before','thin-triggers-after'] and op['actor']=='publisher' and op['target']=='thin-triggers' and op['operation']=='snapshot' and op['stage']=='thin-trigger'
 if not (pub or caller or thin) or readonly and (op['alias']=='publisher-1' or op['alias']=='publisher-2' and (op['target']!='original-settings' or op['operation']!='snapshot')):fail()

def normalize(op,standalone=False,closed=False,staged=False,readonly=False):
 keys=['id','bucket','alias','actor','target','operation','units']
 if type(op) is not dict or not exact(op,keys+(['stage'] if op.get('bucket')=='N' else [])) or type(op['id']) is not str or re.fullmatch('[-a-zA-Z0-9_.]{1,100}',op['id']) is None or type(op['bucket']) is not str or op['bucket'] not in (STAGED_LIMITS if staged else STANDALONE_LIMITS if standalone else LIMITS) or type(op['alias']) is not str or type(op['units']) is not int or op['units']!=1:fail()
 key=op['bucket']+':'+op['alias']
 if op['bucket']=='N':
  if staged:staged_n(op,readonly)
  else:
   discovery=closed and any(op=={'id':event_id,'bucket':'N','alias':alias,'actor':'publisher','target':'publisher-executions','operation':method,'units':1,'stage':'research'} for event_id,alias,method in [('publisher-executions-discovery','navigation-1','snapshot'),('publisher-executions-open','navigation-2','navigate')])
   if not discovery and (re.fullmatch('navigation-(?:[1-9]|1[0-9]|2[0-4])',op['alias']) is None or op['actor']!='publisher' or op['target'] not in TARGETS+(['thin-triggers'] if standalone else []) or op['operation'] not in ['navigate','snapshot'] or op['stage'] not in ['research','preparation']):fail()
 else:
  rule=(STAGED_OPERATIONS if staged else STANDALONE_OPERATIONS if standalone else OPERATIONS).get(key)
  if rule is None or (op['actor'],op['target'])!=(rule['actor'],rule['target']) or op['operation'] not in rule['methods']:fail()
 return key

def complete_map(operations,standalone=False,closed=False,staged=False,readonly=False):
 rules=STAGED_OPERATIONS if staged else STANDALONE_OPERATIONS if standalone else OPERATIONS
 if type(operations) is not list or len(operations)>131:fail()
 limits=STAGED_LIMITS if staged else STANDALONE_LIMITS if standalone else LIMITS
 ids=set();used={};buckets={k:0 for k in limits};research=0;preparation=0
 for op in operations:
  key=normalize(op,standalone,closed,staged,readonly)
  if key in used or op['id'] in ids:fail()
  used[key]=op;ids.add(op['id']);buckets[op['bucket']]+=1
  if op['bucket']=='N':
   if op['stage']=='research':research+=1
   else:preparation+=1
 if closed and not staged and used.get('N:navigation-2',{}).get('id')=='publisher-executions-open' and used.get('N:navigation-1',{}).get('id')!='publisher-executions-discovery':fail()
 if readonly and 'N:publisher-2' not in used:fail()
 if readonly and buckets['N']>15:fail()
 if staged and any(k not in used for k in ['N:caller-oauth-enter','N:caller-oauth-observe','N:thin-triggers-before','N:thin-triggers-after']):fail()
 if any(k not in used for k in rules) or any(buckets[k]>limits[k] for k in limits) or research>8 or preparation>16 or (43 if readonly else 42 if staged else 33 if closed else 31 if standalone else 27)+len(operations)-(1 if closed and not staged else 0)+(2 if standalone else 0)>158:fail()
 return used

def request_stop(cfg,standalone=False,closed=False,staged=False,readonly=False):
 stem='readonly-recovery' if readonly else 'staged-resume' if staged else 'standalone-successor' if closed else 'standalone' if standalone else 'continuation'
 if not exact(cfg,['path','epoch','binding']) or not digest(cfg['binding']) or type(cfg['epoch']) is not str or re.fullmatch('[-A-Za-z0-9_]{20,200}',cfg['epoch']) is None:fail()
 p=Path(cfg['path'])
 if not p.is_absolute():fail()
 directory(p.parent);claim=record(Path(str(p)+'.'+stem+'-claim.json'))
 if any(claim.get(k)!=cfg[k] for k in ['path','epoch','binding']):fail()
 marker=Path(str(p)+'.'+stem+'-stop.json')
 try:save_record(marker,cfg,True)
 except FileExistsError:
  if record(marker)!=cfg:fail()

class Ledger:
 def __init__(self,cfg,standalone=False,script_cleanup=False):
  self.script_cleanup=script_cleanup;self.minimum_new_spent=0
  if script_cleanup:
   if not standalone or type(cfg) is not dict or not integer(cfg.get('minimumNewSpent')) or not 0<=cfg['minimumNewSpent']<=127:fail()
   cfg=copy.deepcopy(cfg);self.minimum_new_spent=cfg.pop('minimumNewSpent')
  self.readonly=standalone and type(cfg) is dict and 'readonlyRecovery' in cfg
  self.renewed=self.readonly and 'deadlineRenewal' in cfg
  self.staged=standalone and type(cfg) is dict and 'stagedResume' in cfg
  self.closed=standalone and type(cfg) is dict and 'closedPreflight' in cfg
  self.standalone=standalone;self.rules=STAGED_OPERATIONS if self.staged else STANDALONE_OPERATIONS if standalone else OPERATIONS;self.imported=16 if self.readonly else 15 if self.staged else 6 if self.closed else 4 if standalone else 0
  decision=READONLY_DECISION if self.readonly else STAGED_DECISION if self.staged else STANDALONE_DECISION if standalone else DECISION;stem='readonly-recovery' if self.readonly else 'staged-resume' if self.staged else 'standalone-successor' if self.closed else 'standalone' if standalone else 'continuation'
  if not exact(cfg,['path','epoch','binding','decisionHash','expiresAt','now','ownerNonce','original','baseline','legacyBudget','policySource']+(['history'] if standalone else [])+(['closedPreflight'] if self.closed else [])+(['stagedResume'] if self.staged else [])+(['readonlyRecovery'] if self.readonly else [])+(['deadlineRenewal'] if self.renewed else [])) or cfg['decisionHash']!=decision or any(not digest(cfg[k]) for k in ['binding','ownerNonce']) or (not integer(cfg['now']) or (cfg['expiresAt'] is not None if self.staged else not integer(cfg['expiresAt']))) or type(cfg['path']) is not str or type(cfg['epoch']) is not str or re.fullmatch('[-A-Za-z0-9_]{20,200}',cfg['epoch']) is None:fail()
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
  self.reg=root/(sha(json.dumps(cfg['epoch'],separators=(',',':')).encode())+'.'+stem+'.json')
  self.journal=Path(str(self.path)+'.'+stem+'.json');self.claim=Path(str(self.path)+'.'+stem+'-claim.json');self.marker=Path(str(self.path)+'.'+stem+'-stop.json')
  # Validate existing claims/checkpoint and frozen history BEFORE construction of
  # the legacy child, whose old constructor otherwise can create missing claims.
  self.old_current()
  if standalone:self.validate_history()
  if self.closed:self.validate_closed_preflight()
  if self.staged:self.validate_staged_predecessor()
  if self.readonly:self.validate_readonly_predecessor()
  if self.renewed:self.validate_deadline_renewal()
  if script_cleanup:
   reg=record(self.reg);identity=record(self.claim)
   fixed={'path':str(self.path),'epoch':cfg['epoch'],'binding':cfg['binding'],'originalBinding':self.original['binding'],'baselineSha256':cfg['baseline']['sha256'],'ownerHash':sha(cfg['ownerNonce'].encode()),'decisionHash':decision,'legacyBudgetSha256':LEGACY_SOURCE,'policySourceSha256':POLICY_SOURCE,'expiresAt':cfg['expiresAt'],'history':cfg['history']}
   if self.closed:fixed['closedPreflight']=cfg['closedPreflight']
   if self.staged:fixed['stagedResume']=cfg['stagedResume']
   if self.readonly:fixed['readonlyRecovery']=cfg['readonlyRecovery']
   if self.renewed:fixed['deadlineRenewal']=cfg['deadlineRenewal']
   if not exact(identity,list(fixed)+['w0']) or any(identity[k]!=v for k,v in fixed.items()) or (identity['w0'] is not None if self.staged else not integer(identity['w0']) or not 0<identity['expiresAt']-identity['w0']<=21600000 or day(identity['w0'])!=day(identity['expiresAt']) or cfg['now']<identity['w0']) or not exact(reg,['identity','checkpoint']) or reg['identity']!=identity:fail()
   self.identity=identity;self.current_journal=copy.deepcopy(reg['checkpoint']);self.recovery_current();return
  for p in [self.reg,self.claim,self.journal,self.marker]:
   try:os.lstat(p);fail()
   except FileNotFoundError:pass
  t=cfg['now'];end=READONLY_EXPIRY if self.readonly and not self.renewed else cfg['expiresAt'];w0=READONLY_W0 if self.readonly and not self.renewed else None if self.staged else self.predecessor['w0'] if self.closed else t
  if self.closed and not self.staged and (end!=self.predecessor['expiresAt'] or t>=end or self.old_current()['spent']!=27):fail()
  if (not self.staged and (not 0<end-t<=21600000 or day(t)!=day(end))) or any(x>t for x in self.baseline['preparation']['calls']+(self.history_times if standalone else [])):fail()
  if self.readonly and not self.renewed and (t<READONLY_W0 or end-t<=360000 or day(t)!=day(READONLY_W0)):fail()
  if self.renewed and self.window(t)-t<=360000:fail()
  self.start_child();self.old_read({'op':'cleanup-inspect'});self.old_current()
  identity={'path':str(self.path),'epoch':cfg['epoch'],'binding':cfg['binding'],'originalBinding':self.original['binding'],'baselineSha256':cfg['baseline']['sha256'],'ownerHash':sha(cfg['ownerNonce'].encode()),'decisionHash':decision,'legacyBudgetSha256':LEGACY_SOURCE,'policySourceSha256':POLICY_SOURCE,'w0':w0,'expiresAt':end}
  if standalone:identity['history']=copy.deepcopy(cfg['history'])
  if self.closed:identity['closedPreflight']=copy.deepcopy(cfg['closedPreflight'])
  if self.staged:identity['stagedResume']=copy.deepcopy(cfg['stagedResume'])
  if self.readonly:identity.update({'readonlyRecovery':copy.deepcopy(cfg['readonlyRecovery']),'w0':None,'expiresAt':None})
  if self.renewed:identity['deadlineRenewal']=copy.deepcopy(cfg['deadlineRenewal'])
  self.identity=identity
  j={**identity,'w0':w0,'expiresAt':end,'version':1,'day':None if self.staged and (not self.readonly or self.renewed) else day(w0),'deadlineUtc':None if self.staged and (not self.readonly or self.renewed) else timestamp(end,timezone.utc),'deadlineTaipei':None if self.staged and (not self.readonly or self.renewed) else timestamp(end,timezone(timedelta(hours=8))),'state':'ready','spent':0,'events':[],'plan':None,'chargedUpperBoundMs':0,'rpc':{'beganAt':None,'complete':False},'finished':False}
  if self.staged:j['stages']={}
  # Any interrupted creation consumes the sole segment; retry cannot recreate it.
  save_record(self.reg,{'identity':identity,'checkpoint':None},True)
  save_record(self.claim,identity,True)
  self.persist(j)
 def sources(self):
  pinned(self.cfg['legacyBudget'],LEGACY_SOURCE);pinned(self.cfg['policySource'],POLICY_SOURCE)
 def validate_history(self):
  # The approved launcher supplies byte pins. Their contents must also describe
  # the one stopped continuation and the one stopped readonly diagnosis; a
  # caller cannot turn a refunded/changed history into authority by repinning it.
  h=self.cfg['history']
  if not exact(h,['continuation','diagnosisApproval','diagnosisResult','diagnosisStop','diagnosisCharges','ownerApproval']) or type(h['diagnosisCharges']) is not list or len(h['diagnosisCharges'])!=3:fail()
  stem=str(self.path)+'.readonly-diagnosis-20261016'
  paths={'continuation':str(self.path)+'.continuation.json','diagnosisApproval':stem+'/approval.json','diagnosisResult':stem+'/result.json','diagnosisStop':stem+'/stop.json'}
  values={}
  for key in ['continuation','diagnosisApproval','diagnosisResult','diagnosisStop','ownerApproval']:
   pin=h[key]
   if not exact(pin,['path','sha256']) or not digest(pin['sha256']) or (key in paths and pin['path']!=paths[key]):fail()
   values[key]=json.loads(pinned(pin,pin['sha256'],True))
  charges=[]
  for n,pin in enumerate(h['diagnosisCharges'],1):
   if not exact(pin,['path','sha256']) or not digest(pin['sha256']) or pin['path']!=stem+'/charge-'+str(n)+'.json':fail()
   charges.append(json.loads(pinned(pin,pin['sha256'],True)))
  j=values['continuation'];identity_keys=['path','epoch','binding','originalBinding','baselineSha256','ownerHash','decisionHash','legacyBudgetSha256','policySourceSha256','w0','expiresAt']
  journal_keys=identity_keys+['version','day','deadlineUtc','deadlineTaipei','state','spent','events','plan','chargedUpperBoundMs','rpc','finished']
  if not exact(j,journal_keys):fail()
  identity={k:j[k] for k in identity_keys}
  fixed={'path':str(self.path),'epoch':self.cfg['epoch'],'originalBinding':self.original['binding'],'baselineSha256':self.cfg['baseline']['sha256'],'decisionHash':DECISION,'legacyBudgetSha256':LEGACY_SOURCE,'policySourceSha256':HISTORICAL_POLICY_SOURCE}
  if any(identity[k]!=v for k,v in fixed.items()) or any(not digest(identity[k]) for k in ['binding','ownerHash']) or any(not integer(j[k]) for k in ['w0','expiresAt']) or not 0<j['expiresAt']-j['w0']<=21600000 or day(j['w0'])!=day(j['expiresAt']):fail()
  if j['version']!=1 or j['day']!=day(j['w0']) or j['deadlineUtc']!=timestamp(j['expiresAt'],timezone.utc) or j['deadlineTaipei']!=timestamp(j['expiresAt'],timezone(timedelta(hours=8))) or j['state']!='stopped' or type(j['spent']) is not int or j['spent']!=1 or j['finished'] is not True or j['plan'] is not None or type(j['chargedUpperBoundMs']) is not int or j['chargedUpperBoundMs']!=0 or j['rpc']!={'beganAt':None,'complete':False} or type(j['events']) is not list or len(j['events'])!=1:fail()
  e=j['events'][0]
  if not exact(e,['operation','time','outcome']) or e['outcome']!='UNKNOWN' or normalize(e['operation'])!='P:caller-bind' or not integer(e['time']) or not j['w0']<=e['time']<j['expiresAt'] or any(t>j['w0'] for t in self.baseline['preparation']['calls']):fail()
  root=self.old_reg.parent;prior_reg=root/(sha(json.dumps(self.cfg['epoch'],separators=(',',':')).encode())+'.continuation.json')
  auxiliaries={Path(str(self.path)+'.continuation-claim.json'):identity,prior_reg:{'identity':identity,'checkpoint':j},Path(str(self.path)+'.continuation-stop.json'):{'path':str(self.path),'epoch':self.cfg['epoch'],'binding':identity['binding']}}
  aux_raw={}
  for path,value in auxiliaries.items():
   aux_raw[str(path)]=rawfile(path)
   if record(path)!=value:fail()
  if hasattr(self,'history_aux_raw') and aux_raw!=self.history_aux_raw:fail()
  self.history_aux_raw=aux_raw
  a=values['diagnosisApproval'];r=values['diagnosisResult'];stop=values['diagnosisStop'];owner=values['ownerApproval']
  if type(a) is not dict or type(r) is not dict or type(stop) is not dict or type(owner) is not dict:fail()
  oldsha=self.cfg['baseline']['sha256'];linkedsha=h['continuation']['sha256']
  if a.get('ownerAnswer')!='同意' or a.get('originalSha256')!=oldsha or a.get('linkedSha256')!=linkedsha or not digest(a.get('proposalSha256')) or a.get('baselineSpent')!=28 or a.get('limit')!=160 or a.get('maxDiagnosticActions')!=4 or any(a.get(k) is not False for k in ['originalClaimsReopened','rpcAuthorized','newRemoteWritesAuthorized']) or not integer(a.get('startedAt')) or not integer(a.get('expiresAt')) or not e['time']<=a['startedAt']<a['expiresAt'] or a['expiresAt']-a['startedAt']>1800000:fail()
  expected={'source':'owner-approved-read-only-diagnosis','state':'STOPPED_TARGET_NOT_LOCATED','approvalAnswer':'同意','proposalSha256':a['proposalSha256'],'actualReadActions':3,'unusedReadActions':1,'baselineSpent':28,'cumulativeSpent':31,'limit':160,'windowExpiresAt':a['expiresAt']}
  if any(r.get(k)!=v for k,v in expected.items()) or r.get('oldOriginalAndContinuationBytesUnchanged') is not True or any(r.get(k) is not False for k in ['rpcExecuted','credentialsReadOrRefreshed','secondDiagnosticSegmentAuthorized']) or type(r.get('remoteResourceWrites')) is not int or r['remoteResourceWrites']!=0 or not integer(r.get('time')) or not a['startedAt']<=r['time']<a['expiresAt'] or stop!={'state':r['state'],'time':r['time'],'noFurtherDiagnosticReads':True}:fail()
  times=[e['time']]
  purposes=['chrome-browser-metadata','matching-executions-tab-metadata','matching-executions-user-tab-metadata']
  for n,c in enumerate(charges,1):
   if type(c) is not dict or any(c.get(k)!=v for k,v in {'action':n,'purpose':purposes[n-1],'units':1,'baselineSpent':28,'cumulativeSpent':28+n,'outcome':'UNKNOWN'}.items()) or any(not integer(c.get(k)) for k in ['action','units','baselineSpent','cumulativeSpent']) or not integer(c.get('time')) or not a['startedAt']<=c['time']<=r['time'] or c['time']<times[-1]:fail()
   times.append(c['time'])
  expected={'ownerAnswer':OWNER_ANSWER,'importedSpent':31,'limit':160,'remaining':129,'cleanupReserve':17,'rpcLimit':1,'originalSha256':oldsha,'continuationSha256':linkedsha}
  if any(owner.get(k)!=v for k,v in expected.items()) or any(not integer(owner.get(k)) for k in ['importedSpent','limit','remaining','cleanupReserve','rpcLimit']) or any(owner.get(k) is not True for k in ['noNewScopeOrFees','ownerOnlyCredentialsAndNewGrants']) or any(owner.get(k) is not False for k in ['originalClaimsReopened','newClaimStarted','remoteExecutionAuthorizedNow']):fail()
  self.history_times=times
 def validate_closed_preflight(self):
  # This is the only successor. It accepts the fixed original standalone path,
  # never another successor or any partial claim; all original bytes stay frozen.
  spec=self.cfg['closedPreflight']
  if not exact(spec,['journal','claim','stop','registry','callerProof']):fail()
  paths={'journal':str(self.path)+'.standalone.json','claim':str(self.path)+'.standalone-claim.json','stop':str(self.path)+'.standalone-stop.json','registry':str(self.old_reg.parent/(sha(json.dumps(self.cfg['epoch'],separators=(',',':')).encode())+'.standalone.json'))}
  values={}
  for k,pin in spec.items():
   if not exact(pin,['path','sha256']) or not digest(pin['sha256']) or k in paths and pin['path']!=paths[k]:fail()
   values[k]=json.loads(pinned(pin,pin['sha256'],True))
  j=values['journal'];identity=record(Path(paths['claim']))
  fixed={'path':str(self.path),'epoch':self.cfg['epoch'],'originalBinding':self.original['binding'],'baselineSha256':self.cfg['baseline']['sha256'],'decisionHash':STANDALONE_DECISION,'legacyBudgetSha256':LEGACY_SOURCE,'history':self.cfg['history'],'expiresAt':json.loads(pinned(spec['journal'],spec['journal']['sha256'],True))['expiresAt'] if self.staged else self.cfg['expiresAt']}
  if not exact(identity,list(fixed)+['binding','ownerHash','policySourceSha256','w0']) or any(identity[k]!=v for k,v in fixed.items()) or not all(digest(identity[k]) for k in ['binding','ownerHash','policySourceSha256']) or identity['policySourceSha256'] not in [PREDECESSOR_POLICY_SOURCE,CLOSED_POLICY_SOURCE,STAGED_POLICY_SOURCE,POLICY_SOURCE] or identity['binding']==self.cfg['binding'] or not integer(identity['w0']) or not 0<identity['expiresAt']-identity['w0']<=21600000 or day(identity['w0'])!=day(identity['expiresAt']):fail()
  if values['registry']!={'value':{'identity':identity,'checkpoint':j},'sha256':sha(compact({'identity':identity,'checkpoint':j}).encode())} or values['claim']!={'value':identity,'sha256':sha(compact(identity).encode())} or record(Path(paths['stop']))!={'path':str(self.path),'epoch':self.cfg['epoch'],'binding':identity['binding']}:fail()
  fields=list(identity)+['version','day','deadlineUtc','deadlineTaipei','state','spent','events','plan','chargedUpperBoundMs','rpc','finished']
  if not exact(j,fields) or any(j[k]!=v for k,v in identity.items()) or type(j['version']) is not int or j['version']!=1 or j['day']!=day(j['w0']) or j['deadlineUtc']!=timestamp(j['expiresAt'],timezone.utc) or j['deadlineTaipei']!=timestamp(j['expiresAt'],timezone(timedelta(hours=8))) or j['state']!='stopped' or type(j['spent']) is not int or j['spent']!=2 or j['finished'] is not True or j['plan'] is not None or type(j['chargedUpperBoundMs']) is not int or j['chargedUpperBoundMs']!=0 or j['rpc']!={'beganAt':None,'complete':False} or type(j['events']) is not list or len(j['events'])!=2:fail()
  last=j['w0']
  for e,key in zip(j['events'],['P:caller-bind','P:publisher-bind']):
   if not exact(e,['operation','time','outcome']) or e['outcome']!='UNKNOWN' or normalize(e['operation'],True)!=key or not integer(e['time']) or not last<=e['time']<j['expiresAt'] or e['time']>self.cfg['now']:fail()
   last=e['time']
  if j['events'][0]['operation']['id']==j['events'][1]['operation']['id'] or any(t>j['w0'] for t in self.history_times):fail()
  proof=values['callerProof']
  if proof!={'source':'observed-native-initial-AX','expectedActorMatches':True,'surface':'apps-script-executions','observedUrl':'https://script.google.com/home/executions','profileLabel':'ART','actorConfirmed':True}:fail()
  self.predecessor=j;self.history_times += [e['time'] for e in j['events']]
 def validate_staged_predecessor(self):
  spec=self.cfg['stagedResume']
  if not exact(spec,['approval','journal','claim','stop','registry']):fail()
  base=str(self.path)+'.standalone-successor';paths={'journal':base+'.json','claim':base+'-claim.json','stop':base+'-stop.json','registry':str(self.old_reg.parent/(sha(json.dumps(self.cfg['epoch'],separators=(',',':')).encode())+'.standalone-successor.json'))}
  v={}
  for k,pin in spec.items():
   if not exact(pin,['path','sha256']) or not digest(pin['sha256']) or k in paths and pin['path']!=paths[k]:fail()
   v[k]=json.loads(pinned(pin,pin['sha256'],True))
  expected={'decisionHash':STAGED_DECISION,'ownerAnswer':'同意此單次接續方案，維持160','importedSpent':42,'limit':160,'predecessorSha256':spec['journal']['sha256']}
  if v['approval']!=expected:fail()
  identity=record(Path(paths['claim']));j=v['journal']
  fixed={'path':str(self.path),'epoch':self.cfg['epoch'],'originalBinding':self.original['binding'],'baselineSha256':self.cfg['baseline']['sha256'],'decisionHash':STANDALONE_DECISION,'legacyBudgetSha256':LEGACY_SOURCE,'history':self.cfg['history'],'closedPreflight':self.cfg['closedPreflight'],'expiresAt':self.predecessor['expiresAt'],'w0':self.predecessor['w0']}
  if not exact(identity,list(fixed)+['binding','ownerHash','policySourceSha256']) or any(identity[k]!=val for k,val in fixed.items()) or any(not digest(identity[k]) for k in ['binding','ownerHash','policySourceSha256']) or identity['policySourceSha256'] not in [CLOSED_POLICY_SOURCE,STAGED_POLICY_SOURCE,POLICY_SOURCE] or identity['binding'] in [self.cfg['binding'],self.predecessor['binding']]:fail()
  fields=list(identity)+['version','day','deadlineUtc','deadlineTaipei','state','spent','events','plan','chargedUpperBoundMs','rpc','finished']
  if not exact(j,fields) or any(j[k]!=val for k,val in identity.items()) or j['version']!=1 or j['day']!=day(j['w0']) or j['deadlineUtc']!=timestamp(j['expiresAt'],timezone.utc) or j['deadlineTaipei']!=timestamp(j['expiresAt'],timezone(timedelta(hours=8))) or j['state']!='stopped' or type(j['spent']) is not int or j['spent']!=9 or j['finished'] is not True or j['plan'] is not None or type(j['chargedUpperBoundMs']) is not int or j['chargedUpperBoundMs']!=0 or j['rpc']!={'beganAt':None,'complete':False} or type(j['events']) is not list or len(j['events'])!=9:fail()
  if v['claim']!={'value':identity,'sha256':sha(compact(identity).encode())} or v['registry']!={'value':{'identity':identity,'checkpoint':j},'sha256':sha(compact({'identity':identity,'checkpoint':j}).encode())} or record(Path(paths['stop']))!={'path':str(self.path),'epoch':self.cfg['epoch'],'binding':identity['binding']}:fail()
  last=max(self.history_times);seen=set();ids=set()
  expected_keys=['N:navigation-1','N:navigation-2','P:publisher-bind']+['N:navigation-'+str(n) for n in range(3,9)]
  for e,key in zip(j['events'],expected_keys):
   if not exact(e,['operation','time','outcome']) or e['outcome']!='UNKNOWN' or normalize(e['operation'],True,True)!=key or not integer(e['time']) or not max(last,j['w0'])<=e['time']<j['expiresAt'] or e['time']>self.cfg['now'] or e['operation']['id'] in ids:fail()
   op=e['operation'];ids.add(op['id']);seen.add(key);last=e['time']
   if op['bucket']=='N' and (op['stage']!='research' or (key=='N:navigation-1' and op['id']!='publisher-executions-discovery') or (key=='N:navigation-2' and op['id']!='publisher-executions-open') or (key not in ['N:navigation-1','N:navigation-2'] and op['target']!='original-settings')):fail()
  self.history_times += [e['time'] for e in j['events']];self.staged_predecessor=j
 def validate_readonly_predecessor(self):
  spec=self.cfg['readonlyRecovery']
  if not self.staged or not exact(spec,['approval','journal','claim','stop','registry','drain']):fail()
  base=str(self.path)+'.staged-resume';paths={'journal':base+'.json','claim':base+'-claim.json','stop':base+'-stop.json','registry':str(self.old_reg.parent/(sha(json.dumps(self.cfg['epoch'],separators=(',',':')).encode())+'.staged-resume.json'))}
  v={}
  for key,pin in spec.items():
   if not exact(pin,['path','sha256']) or not digest(pin['sha256']) or key in paths and pin['path']!=paths[key]:fail()
   v[key]=json.loads(pinned(pin,pin['sha256'],True))
  expected={'decisionHash':READONLY_DECISION,'ownerAnswer':'同意，然后继续解除我们的卡点。','importedSpent':43,'limit':160,'predecessorSha256':spec['journal']['sha256'],'w0':READONLY_W0,'expiresAt':READONLY_EXPIRY}
  if v['approval']!=expected:fail()
  # This exact saved receipt is PRIOR terminal negative evidence only. It
  # never brands an old/current owner: the new process must own the real flock.
  expected_drain={'source':'actual-staged-first-read-stopped','at':'2026-10-16T09:27:49.522Z','errorCategory':'TRIAL_STOPPED','result':'UNAVAILABLE','report':{'phase':'stopped','bindings':2,'preparationReads':0,'partitionReads':{'publisher':0,'caller-oauth':0,'thin-trigger':0},'w0':READONLY_W0,'expiresAt':READONLY_EXPIRY,'spent':43,'trialAccepted':False,'rollbackComplete':False,'remoteExecutionSettled':False},'drain':{'source':'canonical-continuation-holder','stopRequested':True,'stopAcknowledged':True,'ordinaryScopeClosed':True,'ownedScope':{'serial':1,'state':'SETTLED'},'remoteExecutionSettled':False,'trialAccepted':False,'rollbackComplete':False},'retryPerformed':False,'googleMutationPerformed':False}
  if spec['drain']['sha256']!='f2fbe799e7f77febe21ecebf0d2b4dfe0e585f196d3f30837963e0971bd0beff' or v['drain']!=expected_drain:fail()
  identity=record(Path(paths['claim']));j=v['journal']
  fixed={'path':str(self.path),'epoch':self.cfg['epoch'],'originalBinding':self.original['binding'],'baselineSha256':self.cfg['baseline']['sha256'],'decisionHash':STAGED_DECISION,'legacyBudgetSha256':LEGACY_SOURCE,'history':self.cfg['history'],'closedPreflight':self.cfg['closedPreflight'],'stagedResume':self.cfg['stagedResume'],'w0':None,'expiresAt':None}
  if not exact(identity,list(fixed)+['binding','ownerHash','policySourceSha256']) or any(identity[k]!=value for k,value in fixed.items()) or any(not digest(identity[k]) for k in ['binding','ownerHash','policySourceSha256']) or identity['policySourceSha256'] not in [STAGED_POLICY_SOURCE,POLICY_SOURCE] or identity['binding'] in [self.cfg['binding'],self.predecessor['binding'],self.staged_predecessor['binding']]:fail()
  fields=list(identity)+['version','day','deadlineUtc','deadlineTaipei','state','spent','events','plan','chargedUpperBoundMs','rpc','finished','stages']
  if not exact(j,fields) or any(j[k]!=value for k,value in identity.items() if k not in ['w0','expiresAt']) or j['version']!=1 or j['w0']!=READONLY_W0 or j['expiresAt']!=READONLY_EXPIRY or j['day']!=day(READONLY_W0) or j['deadlineUtc']!=timestamp(READONLY_EXPIRY,timezone.utc) or j['deadlineTaipei']!=timestamp(READONLY_EXPIRY,timezone(timedelta(hours=8))) or j['state']!='stopped' or type(j['spent']) is not int or j['spent']!=1 or j['finished'] is not True or j['plan'] is not None or type(j['chargedUpperBoundMs']) is not int or j['chargedUpperBoundMs']!=0 or j['rpc']!={'beganAt':None,'complete':False} or j['stages']!={} or type(j['events']) is not list or len(j['events'])!=1:fail()
  if v['claim']!={'value':identity,'sha256':sha(compact(identity).encode())} or v['registry']!={'value':{'identity':identity,'checkpoint':j},'sha256':sha(compact({'identity':identity,'checkpoint':j}).encode())} or record(Path(paths['stop']))!={'path':str(self.path),'epoch':self.cfg['epoch'],'binding':identity['binding']}:fail()
  event=j['events'][0]
  if not exact(event,['operation','time','outcome']) or event['outcome']!='UNKNOWN' or event['time']!=READONLY_W0 or not integer(event['time']) or normalize(event['operation'],True,True,True)!='N:publisher-1' or event['operation']['target']!='original-settings' or event['operation']['operation']!='snapshot' or any(t>event['time'] for t in self.history_times) or event['time']>self.cfg['now']:fail()
  self.history_times += [event['time']];self.readonly_predecessor=j
 def validate_deadline_renewal(self):
  spec=self.cfg['deadlineRenewal'];approval=json.loads(pinned(spec,spec.get('sha256'),True))
  expected={'decisionHash':DEADLINE_DECISION,'ownerAnswer':'同意只更新期限，其餘不變','importedSpent':43,'limit':160,'predecessorSha256':self.cfg['readonlyRecovery']['journal']['sha256'],'priorApprovalSha256':self.cfg['readonlyRecovery']['approval']['sha256'],'priorW0':READONLY_W0,'priorExpiresAt':READONLY_EXPIRY,'maxWindowMs':21600000,'sameTaipeiDay':True,'singleClaim':True}
  if not exact(approval,list(expected)) or any(type(approval[k]) is not type(v) or approval[k]!=v for k,v in expected.items()):fail()
 def window(self,t):
  # Last millisecond of the same Taipei calendar day.
  end=min(t+21600000,((t+28800000)//86400000+1)*86400000-28800000-1)
  return end
 def live_window(self,j,t):
  end=self.window(t) if j['w0'] is None and self.staged else j['expiresAt']
  return end
 def validate_stages(self,j):
  if type(j['stages']) is not dict:fail()
  prior=set();ids=set()
  for name,value in j['stages'].items():
   if name not in STAGES or name=='recovery' or not exact(value,['operations','futureCaps']) or type(value['operations']) is not list or len(value['operations'])!=len(STAGES[name]):fail()
   seen=set()
   for op in value['operations']:
    key=normalize(op,True,True,True)
    if key not in STAGES[name] or key in seen or op['id'] in ids:fail()
    ids.add(op['id']);seen.add(key)
   # JSON serialization sorts keys, so validate each historical reservation as
   # an exact subset with every absent or later stage still at its full cap.
   caps=value['futureCaps']
   if type(caps) is not dict or any(k not in STAGES or k==name or type(n) is not int or n!=len(STAGES[k]) for k,n in caps.items()) or any(k not in j['stages'] and k not in caps for k in STAGES):fail()
   prior.add(name)
  order={}
  for name,value in j['stages'].items():
   before=set(STAGES)-set(value['futureCaps'])-{name}
   if not before.issubset(set(j['stages'])) or len(before) in order:fail()
   order[len(before)]=(name,before)
  if set(order)!=set(range(len(j['stages']))):fail()
  prior=set()
  for rank in sorted(order):
   name,before=order[rank]
   if before!=prior:fail()
   prior.add(name)
 def used_operations(self,j):
  events=([] if self.staged else [self.predecessor['events'][0]] if self.closed else [])+j['events']
  return {normalize(e['operation'],self.standalone,self.closed,self.staged,self.readonly):e['operation'] for e in events}
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
  if self.script_cleanup:return self.recovery_current()
  self.sources();old=self.old_current()
  if self.standalone:self.validate_history()
  if self.closed:self.validate_closed_preflight()
  if self.staged:self.validate_staged_predecessor()
  if self.readonly:self.validate_readonly_predecessor()
  if self.renewed:self.validate_deadline_renewal()
  j=json.loads(rawfile(self.journal))
  if j!=self.current_journal or record(self.claim)!=self.identity or record(self.reg)!={'identity':self.identity,'checkpoint':j}:fail()
  return j,old
 def recovery_current(self):
  # The registry checkpoint is written before each ordinary IO admission. Read
  # it independently after actual owner drain; never repair the ordinary file
  # or use STOP bytes as authority. Missing/broken trusted evidence denies IO.
  self.sources();old=self.old_current();self.validate_history()
  if self.closed:self.validate_closed_preflight()
  if self.staged:self.validate_staged_predecessor()
  if self.readonly:self.validate_readonly_predecessor()
  if self.renewed:self.validate_deadline_renewal()
  reg=record(self.reg);identity=record(self.claim)
  if identity!=self.identity or not exact(reg,['identity','checkpoint']) or reg['identity']!=identity or reg['checkpoint']!=self.current_journal:fail()
  j=reg['checkpoint'];fields=list(identity)+['version','day','deadlineUtc','deadlineTaipei','state','spent','events','plan','chargedUpperBoundMs','rpc','finished']+(['stages'] if self.staged else [])
  if not exact(j,fields) or any(j[k]!=v for k,v in identity.items() if not self.staged or k not in ['w0','expiresAt']) or type(j['version']) is not int or j['version']!=1 or (not self.staged and (j['day']!=day(j['w0']) or j['deadlineUtc']!=timestamp(j['expiresAt'],timezone.utc) or j['deadlineTaipei']!=timestamp(j['expiresAt'],timezone(timedelta(hours=8))))) or j['state'] not in ['ready','stopped'] or type(j['finished']) is not bool or type(j['events']) is not list or not integer(j['spent']) or j['spent']!=len(j['events']) or not self.minimum_new_spent<=j['spent']<=127:fail()
  if self.staged:
   if self.readonly and not self.renewed:
    if j['w0']!=READONLY_W0 or j['expiresAt']!=READONLY_EXPIRY or j['day']!=day(READONLY_W0) or j['deadlineUtc']!=timestamp(READONLY_EXPIRY,timezone.utc) or j['deadlineTaipei']!=timestamp(READONLY_EXPIRY,timezone(timedelta(hours=8))):fail()
   elif j['w0'] is None:
    if j['spent']!=0 or any(j[k] is not None for k in ['expiresAt','day','deadlineUtc','deadlineTaipei']):fail()
   elif not integer(j['w0']) or j['expiresAt']!=self.window(j['w0']) or j['day']!=day(j['w0']) or j['deadlineUtc']!=timestamp(j['expiresAt'],timezone.utc) or j['deadlineTaipei']!=timestamp(j['expiresAt'],timezone(timedelta(hours=8))):fail()
   self.validate_stages(j)
  if not exact(j['rpc'],['beganAt','complete']) or type(j['rpc']['complete']) is not bool or (j['rpc']['beganAt'] is not None and not integer(j['rpc']['beganAt'])) or not integer(j['chargedUpperBoundMs']) or j['chargedUpperBoundMs'] not in [0,360000]:fail()
  mapped=None if j['plan'] is None else complete_map(j['plan'],True,self.closed,self.staged,self.readonly)
  seen=set();ids=set();counts={k:0 for k in (STAGED_LIMITS if self.staged else STANDALONE_LIMITS)};last=j['w0'];rpc=None;cleanup_started=False;js=[]
  for e in j['events']:
   if not exact(e,['operation','time','outcome']) or e['outcome']!='UNKNOWN' or not integer(e['time']) or (last is not None and e['time']<last):fail()
   op=e['operation'];key=normalize(op,True,self.closed,self.staged,self.readonly)
   if key in seen or op['id'] in ids or op['bucket'] in ['C','I']:fail()
   counts[op['bucket']]+=1;seen.add(key);ids.add(op['id']);last=e['time']
   if counts[op['bucket']]>(STAGED_LIMITS if self.staged else STANDALONE_LIMITS)[op['bucket']]:fail()
   if op['bucket']=='J':
    cleanup_started=True
    if op['alias']=='script-verify' and 'script-remove' not in js:fail()
    js.append(op['alias'])
   else:
    if cleanup_started or e['time']>=j['expiresAt'] or day(e['time'])!=j['day']:fail()
    if mapped is None:
     if self.staged:
      if op['bucket']!='N' and not any(op==v for stage in j['stages'].values() for v in stage['operations']):fail()
     elif key not in ['P:caller-bind','P:publisher-bind'] and not (op['bucket']=='N' and op['stage']=='research'):fail()
    elif mapped.get(key)!=op:fail()
    if (key.startswith(('F:wrapper-after.','G:wrapper-after.','T:')) or self.staged and key=='N:thin-triggers-after') and rpc is None:fail()
    if op['bucket']=='H':rpc=e['time']
  if (rpc is None)!=(j['chargedUpperBoundMs']==0) or j['rpc']['beganAt']!=rpc or j['rpc']['complete'] and rpc is None:fail()
  if j['rpc']['complete'] and (any(k not in seen for k in self.rules if k.startswith(('F:wrapper-after.','G:wrapper-after.'))) or self.staged and 'N:thin-triggers-after' not in seen):fail()
  p=old['preparation'];reserve=2-len(p['cActions'])+17-len(p['iActions'])+2+2-len(js)
  if old['spent']+self.imported+j['spent']>160-reserve:fail()
  return copy.deepcopy(j),old
 def veto(self):
  try:os.lstat(self.marker);return True
  except FileNotFoundError:return False
  except OSError:return True
 def stopped(self):
  if self.script_cleanup:return
  request_stop({k:self.cfg[k] for k in ['path','epoch','binding']},self.standalone,self.closed,self.staged,self.readonly)
  j,_=self.current();j['state']='stopped';self.persist(j)
 def times(self,j,old,t):
  if not integer(t):fail()
  times=old['preparation']['calls']+(self.history_times if self.standalone else [])+[e['time'] for e in j['events']]
  if j['w0'] is not None and t<j['w0'] or any(x>t for x in times):fail()
  return times
 def rate(self,times,t):
  recent=sorted(x for x in times if t-x<60000)
  return 0 if len(recent)<10 else recent[-10]+60000-t
 def ordinary_check(self,j,old,op,t,rpc=False):
  key=normalize(op,self.standalone,self.closed,self.staged,self.readonly);times=self.times(j,old,t)
  if j['state']!='ready' or j['finished'] or self.veto() or t>=self.live_window(j,t) or (j['day'] is not None and day(t)!=j['day']):fail()
  if key.startswith(('I:','J:')) or key in ['C:'+v for v in C] or (key=='H:wrapper-compatibility-rpc')!=rpc:fail()
  used=self.used_operations(j)
  if self.readonly and j['spent']==0 and (key!='N:publisher-2' or op['target']!='original-settings' or op['operation']!='snapshot'):fail()
  if self.readonly and op['bucket']=='N' and sum(e['operation']['bucket']=='N' for e in j['events'])>=15:fail()
  if key in used or any(v['id']==op['id'] for v in used.values()):fail()
  # P/N preflight is the sole initial admission. A complete map adds no remote
  # authorization; the JS driver separately verifies external prerequisites.
  if j['plan'] is None:
   if self.staged:
    if op['bucket']!='N' and not any(op==v for stage in j['stages'].values() for v in stage['operations']):fail()
   elif key not in ['P:caller-bind','P:publisher-bind'] and not (op['bucket']=='N' and op['stage']=='research'):fail()
  else:
   mapped=complete_map(j['plan'],self.standalone,self.closed,self.staged,self.readonly)
   if mapped.get(key)!=op:fail()
  if op['bucket']=='N' and not self.staged:
   if any('P:'+p not in used for p in (['caller-bind'] if self.closed and op['target']=='publisher-executions' else ['caller-bind','publisher-bind'])):fail()
   if self.closed and op['target']=='publisher-executions':
    if 'P:publisher-bind' in used or op['id']=='publisher-executions-open' and used.get('N:navigation-1',{}).get('id')!='publisher-executions-discovery':fail()
   count=sum(1 for e in j['events'] if e['operation']['bucket']=='N' and e['operation']['stage']==op['stage'])
   if count>=(8 if op['stage']=='research' else 16):fail()
  began=j['rpc']['beganAt'] is not None
  post=key.startswith(('F:wrapper-after.','G:wrapper-after.','T:')) or self.staged and key=='N:thin-triggers-after'
  if (post!=began and not (self.staged and op['bucket']=='N' and op['stage']=='publisher')) or (began and j['rpc']['complete']):fail()
  if key.startswith(('A:','B:','C:','D:','E:','F:','G:','H:')) and any('P:'+v not in used for v in (['publisher-refresh','publisher-userinfo'] if self.staged else ['caller-bind','publisher-bind','publisher-refresh','publisher-userinfo'])):fail()
  if rpc:
   if self.staged and j['plan'] is None:fail()
   if self.staged and any(k not in used for k in ['N:caller-oauth-enter','N:caller-oauth-observe','N:thin-triggers-before']):fail()
   required=[k for k in self.rules if k.startswith(('A:','B:','C:','D:','E:','F:wrapper-before.','G:wrapper-before.')) and k not in ['C:'+v for v in C]]
   if any(k not in used for k in required) or (not self.standalone and old['preparation']['cActions']!=C) or j['chargedUpperBoundMs']!=0:fail()
  if key=='P:publisher-refresh' and not self.staged and 'P:publisher-bind' not in used:fail()
  if key=='P:publisher-userinfo' and 'P:publisher-refresh' not in used:fail()
  reserve=(2-len(old['preparation']['cActions']))+(17-len(old['preparation']['iActions']))+2+(2 if self.standalone else 0)
  if old['spent']+self.imported+j['spent']+1>160-reserve:fail()
  ms=self.rate(times,t)
  if t+ms>=self.live_window(j,t) or (j['day'] is not None and day(t+ms)!=j['day']) or self.staged and not began and self.live_window(j,t)-t-ms<=360000:fail()
  return ms
 def cleanup(self,q):
  if not exact(q,['op','kind','action','now']) or q['op'] not in ['oldcleanup-wait','oldcleanup-debit'] or q['kind'] not in ['C','I'] or q['action'] not in (C if q['kind']=='C' else I):fail()
  j,old=self.current();times=self.times(j,old,q['now']);p=old['preparation'];kind=q['kind'];action=q['action']
  actions=p['cActions'] if kind=='C' else p['iActions']
  if action in actions or (kind=='C' and action=='read-restored-editor' and 'restore-editor' not in actions):fail()
  reserve=2+(17-len(p['iActions']) if kind=='C' else 2-len(p['cActions']))+(2 if self.standalone else 0)
  if old['spent']+self.imported+j['spent']+1>160-reserve:fail()
  original={'op':'wait','kind':kind,'action':action,'units':1,'now':q['now']}
  legacy=self.old_read(original);ms=max(legacy['waitMs'],self.rate(times,q['now']))
  if q['op']=='oldcleanup-wait':return self.view(ms)
  if ms:fail()
  if kind=='I':
   # Presence is a negative veto, including a partial marker. Never repair or
   # erase ambiguous STOP to obtain cleanup authorization; original C/I claims
   # and source/checkpoint validation above are the cleanup authority.
   if not self.veto():request_stop({k:self.cfg[k] for k in ['path','epoch','binding']},self.standalone,self.closed,self.staged,self.readonly)
   j['state']='stopped';self.persist(j)
  self.old_read({**original,'op':'debit'});self.old_current()
  return self.view(0)
 def command(self,q):
  if type(q) is not dict:fail()
  op=q.get('op')
  if self.script_cleanup:
   if op=='finish-cleanup' and exact(q,['op']):return {'ok':True,'finished':True}
   if op not in ['scriptcleanup-wait','scriptcleanup-debit'] or not exact(q,['op','action','now']) or q['action'] not in ['script-remove','script-verify']:fail()
   j,old=self.recovery_current();times=self.times(j,old,q['now']);used=[e['operation']['alias'] for e in j['events'] if e['operation']['bucket']=='J'];action=q['action']
   if action in used or action=='script-verify' and 'script-remove' not in used:fail()
   ms=self.rate(times,q['now'])
   if op=='scriptcleanup-wait':return self.view(ms)
   if ms:fail()
   key='J:'+action;rule=self.rules[key];used_ids={e['operation']['id'] for e in j['events']};base=key.replace(':','.')
   # Ordinary IDs are opaque, not a reserved cleanup namespace. Select a
   # unique bounded ID before the checkpoint write, never poison recovery.
   event_id=next((candidate for candidate in [base]+[base+'.cleanup-'+str(n) for n in range(1,129)] if candidate not in used_ids),None)
   if event_id is None:fail()
   descriptor={'id':event_id,'bucket':'J','alias':action,'actor':rule['actor'],'target':rule['target'],'operation':rule['methods'][0],'units':1}
   j['spent']+=1;j['events'].append({'operation':descriptor,'time':q['now'],'outcome':'UNKNOWN'});j['state']='stopped'
   p=old['preparation'];reserve=2-len(p['cActions'])+17-len(p['iActions'])+2+(1-len(used))
   if old['spent']+self.imported+j['spent']>160-reserve:fail()
   # Canonical checkpoint is the durable UNKNOWN before IO. Keep ordinary
   # journal/STOP and original C/I bytes untouched, including corruption.
   save_record(self.reg,{'identity':self.identity,'checkpoint':j});self.current_journal=copy.deepcopy(j)
   return self.view(0)
  if op=='inspect' and exact(q,['op']):return self.view(0)
  if op in ['oldcleanup-wait','oldcleanup-debit']:return self.cleanup(q)
  if op=='stop' and exact(q,['op','now']):self.stopped();return self.view(0)
  j,old=self.current()
  if op=='finish' and exact(q,['op','now']):
   self.times(j,old,q['now']);j['finished']=True;j['state']='stopped';self.persist(j);return {'ok':True,'finished':True}
  if self.staged and op=='stage-ready' and exact(q,['op','now','stage','operations','futureCaps']):
   self.times(j,old,q['now']);name=q['stage']
   if name not in STAGES or name=='recovery' or name in j['stages'] or j['plan'] is not None or self.veto() or j['state']!='ready' or self.live_window(j,q['now'])-q['now']<=360000:fail()
   if type(q['operations']) is not list or len(q['operations'])!=len(STAGES[name]):fail()
   mapped={};ids=set()
   for operation in q['operations']:
    key=normalize(operation,True,True,True)
    if key not in STAGES[name] or key in mapped or operation['id'] in ids:fail()
    mapped[key]=operation;ids.add(operation['id'])
   known={k:v for value in j['stages'].values() for k,v in ((normalize(o,True,True,True),o) for o in value['operations'])}
   if any(o['id'] in {v['id'] for v in known.values()} for o in q['operations']):fail()
   future={k:len(v) for k,v in STAGES.items() if k not in j['stages'] and k!=name}
   if type(q['futureCaps']) is not dict or q['futureCaps']!=future or any(type(v) is not int for v in q['futureCaps'].values()):fail()
   # Full fixed98 + all16 N + original C2 + unused2 stays reserved. I/J
   # are inside98, never deducted a second time or loaned to stage work.
   if len(self.rules)+(15 if self.readonly else 16)+(43 if self.readonly else 42)+2+2!=160:fail()
   j['stages'][name]={'operations':q['operations'],'futureCaps':q['futureCaps']};self.persist(j);return self.view(0)
  if op=='plan-ready' and exact(q,['op','now','operations']):
   self.times(j,old,q['now']);mapped=complete_map(q['operations'],self.standalone,self.closed,self.staged,self.readonly)
   if j['plan'] is not None or self.veto() or j['state']!='ready' or q['now']>=self.live_window(j,q['now']) or (j['day'] is not None and day(q['now'])!=j['day']) or any(mapped.get(k)!=v for k,v in self.used_operations(j).items()) or self.staged and any(mapped.get(normalize(o,True,True,True))!=o for v in j['stages'].values() for o in v['operations']):fail()
   j['plan']=q['operations'];self.persist(j);return self.view(0)
  if op=='rpc-finish' and exact(q,['op','now']):
   self.times(j,old,q['now']);used={normalize(e['operation'],self.standalone,self.closed,self.staged,self.readonly) for e in j['events']}
   required=[k for k in self.rules if k.startswith(('F:wrapper-after.','G:wrapper-after.'))]+(['N:thin-triggers-after'] if self.staged else [])
   if j['rpc']['beganAt'] is None or j['rpc']['complete'] or any(k not in used for k in required) or self.veto() or j['state']!='ready' or q['now']>=j['expiresAt'] or day(q['now'])!=j['day']:fail()
   j['rpc']['complete']=True;self.persist(j);return self.view(0)
  if op not in ['wait','debit','rpc-wait','rpc-begin'] or not exact(q,['op','operation','now']+(['credentialExpiresAt'] if op.startswith('rpc-') else [])):fail()
  ms=self.ordinary_check(j,old,q['operation'],q['now'],op.startswith('rpc-'))
  if op.startswith('rpc-') and (not integer(q['credentialExpiresAt']) or not q['now']+ms+360000<q['credentialExpiresAt']<=j['expiresAt']):fail()
  if op in ['wait','rpc-wait']:return self.view(ms)
  if ms:fail()
  if self.staged and (not self.readonly or self.renewed) and j['w0'] is None:
   j['w0']=q['now'];j['expiresAt']=self.window(q['now']);j['day']=day(q['now']);j['deadlineUtc']=timestamp(j['expiresAt'],timezone.utc);j['deadlineTaipei']=timestamp(j['expiresAt'],timezone(timedelta(hours=8)))
  j['spent']+=1;j['events'].append({'operation':q['operation'],'time':q['now'],'outcome':'UNKNOWN'})
  if op=='rpc-begin':
   if j['chargedUpperBoundMs']!=0:fail()
   j['chargedUpperBoundMs']=360000;j['rpc']['beganAt']=q['now']
  self.persist(j);return self.view(0)
 def view(self,ms=0):
  j,old=self.current();p=old['preparation']
  return {'ok':True,'spent':old['spent']+self.imported+j['spent'],'state':'stopped' if self.script_cleanup or self.veto() else j['state'],'waitMs':ms,'newSpent':j['spent'],'w0':j['w0'],'expiresAt':j['expiresAt'],'deadlineUtc':j['deadlineUtc'],'deadlineTaipei':j['deadlineTaipei'],'chargedUpperBoundMs':j['chargedUpperBoundMs'],'planReady':j['plan'] is not None,'rpc':j['rpc'],'cleanup':{'cActions':p['cActions'],'iActions':p['iActions']}}
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
 if sys.argv[1:]==['--standalone-policy']:emit(STANDALONE_OPERATIONS);sys.exit(0)
 line=sys.stdin.buffer.readline(100001)
 if len(line)>100000:fail()
 if sys.argv[1:] in [['--request-stop'],['--standalone-request-stop'],['--standalone-successor-request-stop'],['--staged-resume-request-stop'],['--readonly-recovery-request-stop']]:
  request_stop(json.loads(line),sys.argv[1]!='--request-stop',sys.argv[1] in ['--standalone-successor-request-stop','--staged-resume-request-stop','--readonly-recovery-request-stop'],sys.argv[1] in ['--staged-resume-request-stop','--readonly-recovery-request-stop'],sys.argv[1]=='--readonly-recovery-request-stop');emit({'ok':True,'stopRequested':True});sys.exit(0)
 if sys.argv[1:] not in [['--inherited-lock'],['--standalone-inherited-lock'],['--standalone-cleanup-inherited-lock']]:fail()
 ledger=Ledger.__new__(Ledger);ledger.__init__(json.loads(line),sys.argv[1]!='--inherited-lock',sys.argv[1]=='--standalone-cleanup-inherited-lock');emit(ledger.view())
 for line in sys.stdin.buffer:
  try:
   if len(line)>100000:fail()
   q=json.loads(line);r=ledger.command(q);emit(r)
   if q.get('op') in ['finish','finish-cleanup']:break
  except Exception:
   try:ledger.stopped()
   except Exception:pass
   emit({'ok':False,'code':'TRIAL_STOPPED'})
except Exception:emit({'ok':False,'code':'TRIAL_STOPPED'});sys.exit(1)
finally:
 if ledger is not None:ledger.close()
