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
DECISION='0b382d87214d9d1fbe658b1615176de48917666698e79092218f1691c358a675'
CREDENTIAL_DECISION='5bd83ace54d7af801880798be3460ed9b6f8c8b053b447459e7956b127ff4c72'
NATIVE_DECISION='3701527108376e07470bc920336fbbd0f78015cb1e55dbfe35090ee059130cb9'
PREPARATION_PURPOSES=['caller-bind','publisher-bind','publisher-refresh','publisher-userinfo']
FIXED={
 'A':['original-project','original-editor','original-versions','original-deployments','original-v1-content','original-cloud-backup','original-triggers-backup','original-properties-backup','original-container-acl'],
 'B':['fixture-import','fixture-file-readback','original-acl-fresh','synthetic-acl-baseline','caller-permission-id','reader-create','reader-acl-readback','fixture-native','auth-tab-users','auth-tab-workspaces','auth-tab-members','auth-tab-email','auth-tab-settings'],
 'C':['library-source-put','library-version-create','library-fixed-content','library-versions-inventory','library-deployments-inventory','original-properties-write','original-properties-readback'],
 'D':['thin-project-backup','thin-source-backup','thin-gcp-link','thin-source-put','thin-version-create','thin-fixed-content','thin-deployment-create','thin-deployments-inventory','thin-properties-write','thin-properties-readback'],
 'E':['testing-user-write','testing-user-readback','client-create','client-readback','oauth-response','token-exchange','caller-userinfo']}
RELEASE=['original-project','original-editor','original-versions','original-deployments','library-content','thin-content','thin-deployments','synthetic-acl','original-acl','original-settings','original-triggers','thin-settings','oauth-audience','oauth-client','caller-sheets-metadata']
FIXED['F']=[phase+'.'+item for phase in ['wrapper-before','wrapper-after'] for item in RELEASE]
NATIVE={'pages':4,'setupReads':2,'identityReads':1,'quotaReads':1}
TARGETS={'original-settings':'publisher','original-triggers':'publisher','thin-settings':'publisher','oauth-audience':'publisher','oauth-client':'publisher','caller-executions':'caller','publisher-executions':'publisher'}
def native_operation(v):
 if type(v)!=dict or set(v)!={'stage','ordinal','actor','target','operation'} or v['stage'] not in ['research','preparation','wrapper-before','wrapper-after'] or not integer(v['ordinal']) or not 1<=v['ordinal']<=32 or v['target'] not in TARGETS or v['actor']!=TARGETS[v['target']] or v['operation'] not in ['navigate','snapshot','next-page','refresh','page-size','filter'] or (not v['target'].endswith('-executions') and v['operation'] not in ['navigate','snapshot']):fail()
 return 'N:'+':'.join(str(v[k]) for k in ['stage','actor','target','operation','ordinal'])
def native_plan(v,research,stored=False):
 if type(v)!=dict or set(v)!=({'windows','operations','time','spent'} if stored else {'windows','operations'}) or type(v['windows'])!=list or len(v['windows'])!=4 or type(v['operations'])!=list or len(v['operations'])>32 or not 0<=research<=8:fail()
 limits={};total=research;turns={}
 for w in v['windows']:
  if type(w)!=dict or set(w)!={'phase','actor','pages','setupReads','identityReads','quotaReads','settlementReads'} or w['phase'] not in ['wrapper-before','wrapper-after'] or w['actor'] not in ['caller','publisher']:fail()
  key=w['phase']+':'+w['actor']
  if key in limits or any(not integer(w[k]) for k in NATIVE) or not 1<=w['pages']<=4 or not 0<=w['setupReads']<=32 or w['identityReads']!=1 or w['quotaReads']!=1 or type(w['settlementReads'])!=int or w['settlementReads']!=0:fail()
  limits[key]={k:w[k] for k in NATIVE};total+=sum(limits[key].values())
 for i,op in enumerate(v['operations']):
  native_operation(op)
  if op['stage']=='research' or op['ordinal']!=research+i+1:fail()
  if op['operation']=='next-page':
   key=op['stage']+':'+op['actor'];turns[key]=turns.get(key,0)+1
   if turns[key]>3 or (key in limits and turns[key]>=limits[key]['pages']):fail()
 total+=len(v['operations'])
 if total>32:fail()
 return limits
def policy_key(kind,action,decision):
 if kind=='C' and action in C:return ('C:'+action,1)
 if kind=='I' and action in I:return ('I:'+action,1)
 if kind=='R' and action=='wrapper':return ('H:wrapper-compatibility-rpc',1)
 if kind not in ['ordinary','S'] or type(action)!=str:fail()
 bits=action.split(':')
 if len(bits)==2 and bits[0] in FIXED and bits[1] in FIXED[bits[0]]:
  after=bits[0]=='F' and bits[1].startswith('wrapper-after.')
  if (kind=='S')!=after:fail()
  return (action,1)
 if len(bits)==4 and bits[0]=='G' and bits[1] in ['wrapper-before','wrapper-after'] and bits[2] in ['caller','publisher'] and bits[3] in NATIVE:
  if (kind=='S')!=(bits[1]=='wrapper-after'):fail()
  return (action,32 if decision==NATIVE_DECISION and bits[3]=='setupReads' else NATIVE[bits[3]])
 if len(bits)==6 and bits[0]=='N' and decision==NATIVE_DECISION:
  if not bits[5].isdigit() or str(int(bits[5]))!=bits[5]:fail()
  op=dict(zip(['stage','actor','target','operation','ordinal'],bits[1:]));op['ordinal']=int(op['ordinal']);native_operation(op)
  if (kind=='S')!=(op['stage']=='wrapper-after'):fail()
  return (action,1)
 if len(bits)==2 and bits[0]=='P' and kind=='ordinary':
  if decision in [CREDENTIAL_DECISION,NATIVE_DECISION] and bits[1] in PREPARATION_PURPOSES:return (action,1)
  if decision==DECISION and bits[1] in ['caller','publisher']:return (action,2)
 if action=='T:unknown-settlement' and kind=='S':return (action,3)
 fail()
def policy_usage(events,decision,plan=None):
 if decision not in [DECISION,CREDENTIAL_DECISION,NATIVE_DECISION]:fail()
 used={};n=0;research=0;spent=25
 if plan is not None:
  research=sum(1 for e in events if type(e.get('action'))==str and e['action'].startswith('N:research:'))
  limits=native_plan(plan,research,True)
  if not integer(plan['spent']) or plan['spent']!=27+research or not integer(plan['time']):fail()
 for e in events:
  key,limit=policy_key(e['kind'],e['action'],decision)
  if e['units']!=1:fail()
  ready=plan is not None and spent>=plan['spent']
  if ready and e.get('time',plan['time'])<plan['time']:fail()
  if decision in [CREDENTIAL_DECISION,NATIVE_DECISION]:
   if key=='P:publisher-refresh' and used.get('P:publisher-bind')!=1:fail()
   if key=='P:publisher-userinfo' and used.get('P:publisher-refresh')!=1:fail()
   if e['kind']=='ordinary' and key.startswith(('A:','B:','C:','D:','E:')) and any(used.get('P:'+name)!=1 for name in PREPARATION_PURPOSES):fail()
  if decision==NATIVE_DECISION:
   if key in ['P:publisher-refresh','P:publisher-userinfo'] or key.startswith(('G:','H:')) or (e['kind']=='ordinary' and key.startswith(('A:','B:','C:','D:','E:'))):
    if not ready:fail()
   if key.startswith('N:'):
    bits=key.split(':');n+=1
    if int(bits[-1])!=n or any(used.get('P:'+p)!=1 for p in ['caller-bind','publisher-bind']):fail()
    if bits[4]=='next-page' and sum(c for k,c in used.items() if k.startswith('N:'+bits[1]+':'+bits[2]+':') and ':next-page:' in k)>=3:fail()
    if bits[1]=='research':
     if ready or n>8:fail()
    else:
     if not ready or n-research-1>=len(plan['operations']) or native_operation(plan['operations'][n-research-1])!=key:fail()
  used[key]=used.get(key,0)+1
  if used[key]>limit:fail()
  if decision==NATIVE_DECISION:
   g=sum(count for name,count in used.items() if name.startswith('G:'))
   required=sum(1 for phase in ['wrapper-before','wrapper-after'] for actor in ['caller','publisher'] for category in ['pages','identityReads','quotaReads'] if not used.get('G:'+phase+':'+actor+':'+category))
   if n+g+required>32:fail()
   if key.startswith('G:'):
    bits=key.split(':')
    if used[key]>limits[bits[1]+':'+bits[2]][bits[3]]:fail()
  spent+=e['units']
 return used
class Ledger:
 def __init__(self,cfg,inherited=False):
  keys={'path','epoch','binding','approvalHash','proposalHash','legacySha256','importedReads','expiresAt','now'}
  if type(cfg)!=dict or not keys<=set(cfg) or set(cfg)-keys-{'mode','runtimeBinding','decisionHash','nativeTargets'} or any(not digest(cfg[k]) for k in ['binding','approvalHash','proposalHash','legacySha256']) or not integer(cfg['importedReads']) or not 0<=cfg['importedReads']<=141 or not integer(cfg['expiresAt']) or not integer(cfg['now']) or not re.fullmatch('[-A-Za-z0-9_]{20,200}',cfg['epoch']): fail()
  self.strict='decisionHash' in cfg
  if self.strict and (cfg['decisionHash'] not in [DECISION,CREDENTIAL_DECISION,NATIVE_DECISION] or cfg['importedReads']!=25):fail()
  self.native=cfg.get('decisionHash')==NATIVE_DECISION
  if self.native:
   if type(cfg.get('nativeTargets'))!=dict or set(cfg['nativeTargets'])!=set(TARGETS) or any(type(v)!=str or len(v)>2000 for v in cfg['nativeTargets'].values()):fail()
  elif 'nativeTargets' in cfg:fail()
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
   v['preparation']={'version':1,'binding':cfg['binding'],'legacySha256':cfg['legacySha256'],'importedReads':cfg['importedReads'],'expiresAt':cfg['expiresAt'],'day':day(cfg['now']),'state':'ready','calls':[cfg['now']]*v['spent'],'events':[],'cActions':[],'iActions':[],**({'decisionHash':cfg['decisionHash']} if self.strict else {}),**({'nativePlan':None} if self.native else {})}
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
  keys={'version','binding','legacySha256','importedReads','expiresAt','day','state','calls','events','cActions','iActions'}|({'nativePlan'} if self.native else set())
  if type(p)!=dict or p.get('version') not in [1,2,3] or set(p)!=(keys|({'decisionHash'} if self.strict else set())|({'handoff'} if p['version']>=2 else set())|({'runtime'} if p['version']==3 else set())) or p['binding']!=c['binding'] or p['legacySha256']!=c['legacySha256'] or p['importedReads']!=c['importedReads'] or p['expiresAt']!=c['expiresAt'] or p['state'] not in ['ready','stopped'] or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',p['day']) or any(type(p[k])!=list for k in ['calls','events','cActions','iActions']):fail()
  if self.strict and p['decisionHash']!=c['decisionHash']:fail()
  if len(p['events'])>160 or len(p['calls'])!=v['spent'] or any(not integer(t) for t in p['calls']) or len(set(p['cActions']))!=len(p['cActions']) or len(set(p['iActions']))!=len(p['iActions']) or any(a not in C for a in p['cActions']) or any(a not in I for a in p['iActions']):fail()
  total=p['importedReads'];cs=[];ins=[];rs=[];times=p['calls'][:p['importedReads']]
  for e in p['events']:
   if type(e)!=dict or set(e)!={'kind','action','units','time','outcome'} or e['kind'] not in ['ordinary','C','I','R','S'] or not integer(e['units']) or not 1<=e['units']<=10 or not integer(e['time']) or e['outcome']!='UNKNOWN':fail()
   if e['kind'] in ['ordinary','S']:
    if not self.strict and e['action'] is not None:fail()
    if e['kind']=='S' and (p['version']!=3 or not rs):fail()
   elif e['kind']=='R':
    if p['version']!=3 or e['units']!=1 or len(rs)>=2 or e['action']!=R[len(rs)] or day(e['time'])!=p['day'] or e['time']>=p['expiresAt']:fail()
    rs.append(e)
   else:
    if e['units']!=1 or e['action'] not in (C if e['kind']=='C' else I):fail()
    (cs if e['kind']=='C' else ins).append(e['action'])
   total+=e['units'];times.extend([e['time']]*e['units'])
  if self.strict:policy_usage(p['events'],c['decisionHash'],p.get('nativePlan'))
  if self.native and p['nativePlan'] is not None:
   plan=p['nativePlan']
   if day(plan['time'])!=p['day'] or plan['time']>=p['expiresAt'] or plan['spent']>v['spent'] or any(t>plan['time'] for t in p['calls'][:plan['spent']]):fail()
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
    if self.mode!='runtime' or p['version']!=3 or rt['pending'] is None or (not self.strict and action is not None):fail()
   else:
    if p['state']!='ready' or self.stop_requested() or rt['pending'] is not None:fail()
    if kind=='ordinary' and not self.strict and action is not None:fail()
    if kind=='R' and (self.mode!='runtime' or len(rt['entries'])>=2 or action!=R[len(rt['entries'])] or units!=1):fail()
  elif kind=='C':
   if units!=1 or action not in C or action in p['cActions'] or (action=='read-restored-editor' and 'restore-editor' not in p['cActions']) or v['spent']+1>160-(17-len(p['iActions'])):fail()
  elif kind=='I':
   if units!=1 or action not in I or action in p['iActions'] or v['spent']+1>160-(2-len(p['cActions'])):fail()
   if p['state']!='stopped':p['state']='stopped';self.persist(v)
  else:fail()
  if self.strict:
   policy_usage(p['events']+[{'kind':kind,'action':action,'units':units,'time':t}],self.cfg['decisionHash'],p.get('nativePlan'))
   if kind=='ordinary':
    if action.startswith(('A:','B:','C:','D:','E:','P:')) and p['version']!=1:fail()
    if action.startswith(('F:','G:')) and (p['version']<2 or rt['entries']):fail()
    if self.native and action.startswith('N:'):
     stage=action.split(':')[1]
     if stage in ['research','preparation'] and p['version']!=1:fail()
     if stage=='wrapper-before' and (p['version']<2 or rt['entries']):fail()
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
  if type(q)==dict and q.get('op')=='native-ready':
   v=self.current();p=v['preparation'];t=q.get('now')
   if not self.native or set(q)!={'op','plan','now'} or self.mode!='preparation' or p['version']!=1 or p['state']!='ready' or self.stop_requested() or p['nativePlan'] is not None or p['cActions'] or p['iActions'] or not integer(t) or any(x>t for x in p['calls']) or t>=p['expiresAt'] or day(t)!=p['day']:fail()
   used=policy_usage(p['events'],NATIVE_DECISION)
   if any(used.get('P:'+name)!=1 for name in ['caller-bind','publisher-bind']):fail()
   research=sum(1 for e in p['events'] if e['action'].startswith('N:research:'))
   native_plan(q['plan'],research)
   if v['spent']!=27+research:fail()
   p['nativePlan']={**q['plan'],'spent':v['spent'],'time':t};self.persist(v);return self.view(0)
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
   if self.cfg.get('decisionHash') in [CREDENTIAL_DECISION,NATIVE_DECISION]:
    if self.native and p['nativePlan'] is None:fail()
    used=policy_usage(p['events'],self.cfg['decisionHash'],p.get('nativePlan'))
    if any(used.get('P:'+name)!=1 for name in PREPARATION_PURPOSES):fail()
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
