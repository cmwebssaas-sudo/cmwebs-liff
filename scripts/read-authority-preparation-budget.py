"""Private local preparation ledger. No network, credentials, source or RPC IO."""
import fcntl, hashlib, json, os, re, stat, sys, uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta

def fail(): raise RuntimeError('TRIAL_STOPPED')
def compact(v): return json.dumps(v,ensure_ascii=False,separators=(',',':'),sort_keys=True)
def sha(v): return hashlib.sha256(v).hexdigest()
def integer(v): return type(v) is int
def digest(v): return type(v) is str and re.fullmatch('[a-f0-9]{64}',v) is not None
def day(t): return datetime.fromtimestamp(t/1000,timezone(timedelta(hours=8))).strftime('%Y-%m-%d')
def directory(p):
 s=os.lstat(p)
 if not stat.S_ISDIR(s.st_mode) or s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)!=0o700: fail()
def rawfile(p):
 s=os.lstat(p)
 if not stat.S_ISREG(s.st_mode) or s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)!=0o600 or s.st_size>128000: fail()
 return p.read_bytes()
def record(p):
 e=json.loads(rawfile(p))
 if type(e)!=dict or set(e)!={'value','sha256'} or e['sha256']!=sha(compact(e['value']).encode()):fail()
 return e['value']
def create_record(p,value):
 directory(p.parent);fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'wb') as f:f.write(compact({'value':value,'sha256':sha(compact(value).encode())}).encode());f.flush();os.fsync(f.fileno())
 d=os.open(p.parent,os.O_RDONLY)
 try:os.fsync(d)
 finally:os.close(d)
 if record(p)!=value:fail()
def request_stop(cfg):
 if type(cfg)!=dict or set(cfg)!={'path','epoch','binding'} or not digest(cfg['binding']) or not re.fullmatch('[-A-Za-z0-9_]{20,200}',cfg['epoch']):fail()
 path=Path(cfg['path'])
 if not path.is_absolute():fail()
 directory(path.parent);expected={'path':str(path),'epoch':cfg['epoch'],'binding':cfg['binding']}
 if record(path.with_name(path.name+'.preparation-claim.json'))!=expected:fail()
 marker=path.with_name(path.name+'.preparation-stop.json')
 try:create_record(marker,expected)
 except FileExistsError:
  if record(marker)!=expected:fail()
def save(p,v):
 directory(p.parent);tmp=p.with_name(p.name+'.'+uuid.uuid4().hex+'.next')
 fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'wb') as f: f.write(compact(v).encode());f.flush();os.fsync(f.fileno())
 os.replace(tmp,p);fd=os.open(p.parent,os.O_RDONLY)
 try: os.fsync(fd)
 finally: os.close(fd)
 if json.loads(rawfile(p))!=v: fail()
I=['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','restore-original-guard','verify-original-guard','restore-thin-guard','verify-thin-guard','remove-testing-user','verify-testing-user-removed','revoke-token','verify-token-revoked','read-original-editor','read-original-versions','read-original-deployments','read-original-project','read-original-triggers']
C=['restore-editor','read-restored-editor']
R=['wrapper','qualified']
class Ledger:
 def __init__(self,cfg,inherited=False):
  keys={'path','epoch','binding','approvalHash','proposalHash','legacySha256','importedReads','expiresAt','now'}
  if type(cfg)!=dict or not keys<=set(cfg) or set(cfg)-keys-{'mode','runtimeBinding'} or any(not digest(cfg[k]) for k in ['binding','approvalHash','proposalHash','legacySha256']) or not integer(cfg['importedReads']) or not 0<=cfg['importedReads']<=141 or not integer(cfg['expiresAt']) or not integer(cfg['now']) or not re.fullmatch('[-A-Za-z0-9_]{20,200}',cfg['epoch']): fail()
  self.mode=cfg.get('mode','preparation')
  if self.mode not in ['preparation','runtime'] or (self.mode=='runtime' and not digest(cfg.get('runtimeBinding'))) or (self.mode=='preparation' and 'runtimeBinding' in cfg):fail()
  self.cfg=cfg;self.path=Path(cfg['path']);self.original=None
  if not self.path.is_absolute(): fail()
  directory(self.path.parent)
  lock=self.path.with_name(self.path.name+'.lock');self.inherited=inherited
  self.fd=3 if inherited else os.open(lock,os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600);s=os.fstat(self.fd)
  if not stat.S_ISREG(s.st_mode) or s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)!=0o600 or s.st_size!=0: fail()
  if inherited:
   named=os.lstat(lock)
   if (s.st_dev,s.st_ino)!=(named.st_dev,named.st_ino) or not stat.S_ISREG(named.st_mode) or (fcntl.fcntl(self.fd,fcntl.F_GETFL)&os.O_ACCMODE)!=os.O_RDWR:fail()
  fcntl.flock(self.fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  raw=rawfile(self.path);v=json.loads(raw);self.base(v)
  # Runtime can only reopen the existing canonical counter. Never initialize a
  # phase, claim an epoch or import history from a caller-supplied receipt.
  if self.mode=='runtime' and (type(v.get('preparation'))!=dict or v['preparation'].get('version') not in [2,3] or type(v['preparation'].get('handoff'))!=dict or v['preparation']['handoff'].get('runtimeBinding')!=cfg['runtimeBinding']):fail()
  root=Path.home()/'.codex/private/cmwebs-authority-trials';root.mkdir(parents=True,exist_ok=True,mode=0o700);directory(root)
  # A replaceable counter cannot be the only anti-rollback authority.
  self.reg=root/(sha(json.dumps(cfg['epoch'],separators=(',',':')).encode())+'.preparation.json')
  value={'path':str(self.path),'binding':cfg['binding']}
  claim=self.path.with_name(self.path.name+'.preparation-claim.json')
  claim_value={**value,'epoch':cfg['epoch']}
  if claim.exists() or claim.is_symlink():
   if self.record(claim)!=claim_value:fail()
  else:self.create_record(claim,claim_value)
  if self.reg.exists() or self.reg.is_symlink():
   registration=self.record(self.reg)
   if type(registration)!=dict or set(registration)!={'path','binding','checkpoint'} or registration['path']!=value['path'] or registration['binding']!=value['binding']:fail()
   if registration['checkpoint'] is not None and registration['checkpoint']!=v:fail()
   if registration['checkpoint'] is None and 'preparation' in v:fail()
  else:
   if 'preparation' in v or sha(raw)!=cfg['legacySha256'] or v['spent']!=cfg['importedReads'] or not 0<cfg['expiresAt']-cfg['now']<=21600000:fail()
   self.create_record(self.reg,{**value,'checkpoint':None})
  if 'preparation' not in v:
   if sha(raw)!=cfg['legacySha256'] or v['spent']!=cfg['importedReads'] or not 0<cfg['expiresAt']-cfg['now']<=21600000:fail()
   v['preparation']={'version':1,'binding':cfg['binding'],'legacySha256':cfg['legacySha256'],'importedReads':cfg['importedReads'],'expiresAt':cfg['expiresAt'],'day':day(cfg['now']),'state':'ready','calls':[cfg['now']]*v['spent'],'events':[],'cActions':[],'iActions':[]}
   self.persist(v)
  self.original=v;self.validate(v)
 def record(self,p):
  return record(p)
 def create_record(self,p,value):
  create_record(p,value)
 def stop_requested(self):
  p=self.path.with_name(self.path.name+'.preparation-stop.json')
  # Presence is only an irreversible negative veto, never authorization. An
  # interrupted exclusive create must stop ordinary/R without poisoning C/I
  # or native settlement on the independently validated counter/checkpoint.
  # Preserve ambiguous artifacts; request_stop still requires a bound record
  # before returning its successful acknowledgement.
  try:os.lstat(p);return True
  except FileNotFoundError:return False
  except OSError:return True
 def runtime(self,p):
  return p['runtime'] if p['version']==3 else {'nativeMs':0,'entries':[],'pending':None,'lastExecutionHash':None}
 def persist(self,v):
  # Checkpoint first: a torn pair stops rather than reviving an older counter.
  value={'path':str(self.path),'binding':self.cfg['binding'],'checkpoint':v}
  save(self.reg,{'value':value,'sha256':sha(compact(value).encode())})
  save(self.path,v);self.original=v
 def base(self,v):
  c=self.cfg;keys={'limit','spent','kind','proposal_sha256','approval_sha256','prior_limit'}
  if type(v)!=dict or set(v)-{'preparation'}!=keys or v['limit']!=160 or v['prior_limit']!=40 or v['kind']!='preparation-management-reads' or v['approval_sha256']!=c['approvalHash'] or v['proposal_sha256']!=c['proposalHash'] or not integer(v['spent']) or not 0<=v['spent']<=160:fail()
 def validate(self,v):
  self.base(v);p=v['preparation'];c=self.cfg
  keys={'version','binding','legacySha256','importedReads','expiresAt','day','state','calls','events','cActions','iActions'}
  if type(p)!=dict or p.get('version') not in [1,2,3] or set(p)!=(keys|({'handoff'} if p['version']>=2 else set())|({'runtime'} if p['version']==3 else set())) or p['binding']!=c['binding'] or p['legacySha256']!=c['legacySha256'] or p['importedReads']!=c['importedReads'] or p['expiresAt']!=c['expiresAt'] or p['state'] not in ['ready','stopped'] or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',p['day']) or any(type(p[k])!=list for k in ['calls','events','cActions','iActions']):fail()
  if len(p['events'])>160 or len(p['calls'])!=v['spent'] or any(not integer(t) for t in p['calls']) or len(set(p['cActions']))!=len(p['cActions']) or len(set(p['iActions']))!=len(p['iActions']) or any(a not in C for a in p['cActions']) or any(a not in I for a in p['iActions']):fail()
  total=p['importedReads'];cs=[];ins=[];rs=[];times=p['calls'][:p['importedReads']]
  for e in p['events']:
   if type(e)!=dict or set(e)!={'kind','action','units','time','outcome'} or e['kind'] not in ['ordinary','C','I','R','S'] or not integer(e['units']) or not 1<=e['units']<=10 or not integer(e['time']) or e['outcome']!='UNKNOWN':fail()
   if e['kind'] in ['ordinary','S']:
    if e['action'] is not None:fail()
    if e['kind']=='S' and (p['version']!=3 or not rs):fail()
   elif e['kind']=='R':
    if p['version']!=3 or e['units']!=1 or len(rs)>=2 or e['action']!=R[len(rs)] or day(e['time'])!=p['day'] or e['time']>=p['expiresAt']:fail()
    rs.append(e)
   else:
    if e['units']!=1 or e['action'] not in (C if e['kind']=='C' else I):fail()
    (cs if e['kind']=='C' else ins).append(e['action'])
   total+=e['units'];times.extend([e['time']]*e['units'])
  if total!=v['spent'] or times!=p['calls'] or cs!=p['cActions'] or ins!=p['iActions'] or ('read-restored-editor' in cs and ('restore-editor' not in cs or cs.index('read-restored-editor')<cs.index('restore-editor'))):fail()
  if p['version']>=2:
   h=p['handoff']
   if type(h)!=dict or set(h)!={'runtimeBinding','time','spent','eventHash'} or not digest(h['runtimeBinding']) or not digest(h['eventHash']) or not integer(h['time']) or not integer(h['spent']) or not p['importedReads']<=h['spent']<=min(v['spent'],143) or day(h['time'])!=p['day'] or h['time']>=p['expiresAt']:fail()
   prefix=[];n=p['importedReads']
   for e in p['events']:
    if n<h['spent']:prefix.append(e);n+=e['units']
    elif e['time']<h['time']:fail()
   if n!=h['spent'] or sha(compact(prefix).encode())!=h['eventHash'] or any(t>h['time'] for t in p['calls'][:h['spent']]) or [e['action'] for e in prefix if e['kind']=='C']!=C or any(e['kind'] in ['I','R','S'] for e in prefix):fail()
  if p['version']==3:
   rt=p['runtime']
   if type(rt)!=dict or set(rt)!={'nativeMs','entries','pending','lastExecutionHash'} or type(rt['entries'])!=list or not 1<=len(rt['entries'])==len(rs)<=2:fail()
   native=0;last_hash=None;pending=None;hashes=set()
   for i,e in enumerate(rt['entries']):
    if type(e)!=dict or set(e)!={'entry','startedAt','beforeNativeMs','afterNativeMs','executionHash','complete'} or e['entry']!=rs[i]['action'] or e['startedAt']!=rs[i]['time'] or not integer(e['beforeNativeMs']) or not native<=e['beforeNativeMs']<=540000 or type(e['complete'])!=bool or (i and not rt['entries'][i-1]['complete']):fail()
    native=e['beforeNativeMs']
    if e['afterNativeMs'] is None:
     if e['executionHash'] is not None or e['complete']:fail()
    else:
     if not integer(e['afterNativeMs']) or not native<=e['afterNativeMs']<=900000 or not digest(e['executionHash']) or e['executionHash'] in hashes:fail()
     native=e['afterNativeMs'];last_hash=e['executionHash'];hashes.add(last_hash)
    if not e['complete']:
     if i!=len(rt['entries'])-1:fail()
     pending={'entry':e['entry'],'startedAt':e['startedAt']}
   if rt['nativeMs']!=native or rt['lastExecutionHash']!=last_hash or rt['pending']!=pending:fail()
 def current(self):
  v=json.loads(rawfile(self.path));self.validate(v)
  if v!=self.original or self.record(self.reg)!={'path':str(self.path),'binding':self.cfg['binding'],'checkpoint':v}:fail()
  self.stop_requested()
  return v
 def stopped(self):
  v=self.current();v['preparation']['state']='stopped';self.persist(v)
 def check(self,kind,action,units,t):
  v=self.current();p=v['preparation']
  if not integer(t) or not integer(units) or not 1<=units<=10 or any(x>t for x in p['calls']) or (p['version']>=2 and t<p['handoff']['time']):fail()
  if kind in ['ordinary','R','S']:
   phase='runtime' if p['version']>=2 else 'preparation';rt=self.runtime(p)
   if self.mode!=phase or (phase=='runtime' and p['handoff']['runtimeBinding']!=self.cfg['runtimeBinding']) or t>=p['expiresAt'] or day(t)!=p['day'] or v['spent']+units>160-(17-len(p['iActions']))-(2-len(p['cActions'])):fail()
   if kind=='S':
    if self.mode!='runtime' or p['version']!=3 or rt['pending'] is None or action is not None:fail()
   else:
    if p['state']!='ready' or self.stop_requested() or rt['pending'] is not None:fail()
    if kind=='ordinary' and action is not None:fail()
    if kind=='R' and (self.mode!='runtime' or len(rt['entries'])>=2 or action!=R[len(rt['entries'])] or units!=1):fail()
  elif kind=='C':
   if units!=1 or action not in C or action in p['cActions'] or (action=='read-restored-editor' and 'restore-editor' not in p['cActions']) or v['spent']+1>160-(17-len(p['iActions'])):fail()
  elif kind=='I':
   if units!=1 or action not in I or action in p['iActions'] or v['spent']+1>160-(2-len(p['cActions'])):fail()
   if p['state']!='stopped':p['state']='stopped';self.persist(v)
  else:fail()
  recent=sorted(x for x in p['calls'] if t-x<60000);ms=0 if len(recent)+units<=10 else recent[len(recent)+units-11]+60000-t
  if not 0<=ms<=60000 or (kind in ['ordinary','R','S'] and (t+ms>=p['expiresAt'] or day(t+ms)!=p['day'])):fail()
  return v,ms
 def rpc(self,q):
  if set(q)!={'op','entry','nativeMs','observedAt','credentialExpiresAt','now'} or q['op'] not in ['rpc-wait','rpc-begin']:fail()
  v,ms=self.check('R',q['entry'],1,q['now']);p=v['preparation'];rt=self.runtime(p);t=q['now']
  if not integer(q['nativeMs']) or not rt['nativeMs']<=q['nativeMs']<=540000 or not integer(q['observedAt']) or q['observedAt']>t+1000 or t-q['observedAt']>60000 or not integer(q['credentialExpiresAt']) or not t+360000<q['credentialExpiresAt']<=p['expiresAt']:fail()
  if q['op']=='rpc-wait':return self.view(ms)
  if ms:fail()
  v['spent']+=1;p['calls'].append(t);p['events'].append({'kind':'R','action':q['entry'],'units':1,'time':t,'outcome':'UNKNOWN'})
  p['version']=3;p['runtime']=rt;rt['nativeMs']=q['nativeMs'];rt['pending']={'entry':q['entry'],'startedAt':t};rt['entries'].append({'entry':q['entry'],'startedAt':t,'beforeNativeMs':q['nativeMs'],'afterNativeMs':None,'executionHash':None,'complete':False})
  self.persist(v);return {**self.view(0),'startedAt':t}
 def command(self,q):
  if type(q)==dict and q.get('op')=='cleanup-inspect':
   if set(q)!={'op'}:fail()
   p=self.current()['preparation']
   return {**self.view(0),'cleanup':{'version':p['version'],'cActions':p['cActions'],'iActions':p['iActions']}}
  if type(q)==dict and q.get('op') in ['rpc-wait','rpc-begin']:return self.rpc(q)
  if type(q)==dict and q.get('op')=='runtime-inspect':
   if set(q)!={'op'} or self.mode!='runtime':fail()
   v=self.current();p=v['preparation'];rt=self.runtime(p)
   return {**self.view(0),'runtimeBinding':p['handoff']['runtimeBinding'],'runtime':{'nativeMs':rt['nativeMs'],'rpcEntries':[e['entry'] for e in rt['entries']],'pending':rt['pending'],'lastExecutionHash':rt['lastExecutionHash']}}
  if type(q)==dict and q.get('op') in ['native-account','rpc-finish']:
   expected={'op','entry','now'}|({'totalMs','executionHash'} if q['op']=='native-account' else set())
   v=self.current();p=v['preparation'];t=q.get('now');rt=self.runtime(p)
   if set(q)!=expected or self.mode!='runtime' or p['version']!=3 or rt['pending'] is None or rt['pending']['entry']!=q['entry'] or not integer(t) or any(x>t for x in p['calls']) or t<p['handoff']['time'] or t>=p['expiresAt'] or day(t)!=p['day']:fail()
   e=rt['entries'][-1]
   if q['op']=='native-account':
    if e['afterNativeMs'] is not None or not integer(q['totalMs']) or not rt['nativeMs']<=q['totalMs']<=900000 or not digest(q['executionHash']) or any(x['executionHash']==q['executionHash'] for x in rt['entries']):fail()
    e['afterNativeMs']=q['totalMs'];e['executionHash']=q['executionHash'];rt['nativeMs']=q['totalMs'];rt['lastExecutionHash']=q['executionHash']
   else:
    if p['state']!='ready' or self.stop_requested() or e['afterNativeMs'] is None:fail()
    e['complete']=True;rt['pending']=None
   self.persist(v);return self.view(0)
  if type(q)==dict and q.get('op')=='handoff':
   v=self.current();p=v['preparation']
   if set(q)!={'op','runtimeBinding','expectedSpent','now'} or self.mode!='preparation' or p['version']!=1 or p['state']!='ready' or self.stop_requested() or p['cActions']!=C or p['iActions'] or not digest(q['runtimeBinding']) or not integer(q['expectedSpent']) or q['expectedSpent']!=v['spent'] or v['spent']>143 or not integer(q['now']) or any(t>q['now'] for t in p['calls']) or q['now']>=p['expiresAt'] or day(q['now'])!=p['day']:fail()
   p['version']=2;p['handoff']={'runtimeBinding':q['runtimeBinding'],'time':q['now'],'spent':v['spent'],'eventHash':sha(compact(p['events']).encode())}
   self.persist(v);return {**self.view(0),'handoff':p['handoff']}
  if type(q)!=dict or set(q)!={'op','kind','action','units','now'}:fail()
  if q['op']=='stop':self.stopped();return self.view(0)
  if q['op']=='inspect':return self.view(0)
  v,ms=self.check(q['kind'],q['action'],q['units'],q['now'])
  if q['op']=='wait':return self.view(ms)
  if q['op']!='debit' or ms!=0 or q['kind']=='R':fail()
  p=v['preparation'];v['spent']+=q['units'];p['calls'].extend([q['now']]*q['units']);p['events'].append({'kind':q['kind'],'action':q['action'],'units':q['units'],'time':q['now'],'outcome':'UNKNOWN'})
  if q['kind']=='C':p['cActions'].append(q['action'])
  if q['kind']=='I':p['iActions'].append(q['action'])
  self.persist(v);return self.view(0)
 def view(self,ms):
  v=self.current();return {'ok':True,'spent':v['spent'],'state':'stopped' if self.stop_requested() else v['preparation']['state'],'waitMs':ms}
 def close(self):
  # Inherited descriptors share the parent's open-file description. Unlocking
  # here would release its ownership while an entered callback may still run.
  if not self.inherited:fcntl.flock(self.fd,fcntl.LOCK_UN)
  os.close(self.fd)
def emit(v):print(compact(v),flush=True)
ledger=None
try:
 os.umask(0o077);line=sys.stdin.buffer.readline(20001)
 if len(line)>20000:fail()
 if sys.argv[1:]==['--request-stop']:
  request_stop(json.loads(line));emit({'ok':True,'stopRequested':True});sys.exit(0)
 if sys.argv[1:] not in [[],['--inherited-lock']]:fail()
 ledger=Ledger(json.loads(line),inherited=sys.argv[1:]==['--inherited-lock']);emit(ledger.view(0))
 for line in sys.stdin.buffer:
  try:
   if len(line)>20000:fail()
   q=json.loads(line)
   if q=={'op':'finish'}:emit({'ok':True,'finished':True});break
   emit(ledger.command(q))
  except Exception:
   try:ledger.stopped()
   except Exception:pass
   emit({'ok':False,'code':'TRIAL_STOPPED'})
except Exception:emit({'ok':False,'code':'TRIAL_STOPPED'});sys.exit(1)
finally:
 if ledger is not None:ledger.close()
