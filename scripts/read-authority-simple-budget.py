"""Single durable dual-account trial ledger. No browser, credential or network IO.

fd3 is the original canonical lock, retained by the JS holder during every IO.
All old claims/UNKNOWN/STOP bytes remain immutable. Registry is the independent
cleanup checkpoint; damage to the ordinary mirror never reopens ordinary IO.
"""
import copy,fcntl,hashlib,importlib.util,json,os,re,stat,subprocess,sys
from pathlib import Path
from datetime import datetime,timezone,timedelta
spec=importlib.util.spec_from_file_location('authority_history',Path(__file__).with_name('read-authority-continuation-budget.py'))
history=importlib.util.module_from_spec(spec);spec.loader.exec_module(history)
DECISION='eccdb919d865327e3b5922231b253266e9084afe33305e12a32e64501efa39b2'
RULES=copy.deepcopy(history.STAGED_OPERATIONS)
RULES['A:original-cloud-backup']={'actor':'publisher','target':'original-settings','methods':['snapshot']}
STAGES=history.STAGES
RULES['C:restore-editor']={'actor':'publisher','target':'original-project','methods':['PUT']}
RULES['C:read-restored-editor']={'actor':'publisher','target':'original-project','methods':['GET']}
fail=history.fail;integer=history.integer;digest=history.digest;exact=history.exact
rawfile=history.rawfile;directory=history.directory;record=history.record
save_record=history.save_record;synced=history.synced;compact=history.compact;sha=history.sha;day=history.day
C=history.C;I=history.I
READ_METHODS=['inventory','claim','navigate','snapshot','read-key-presence']
NAVIGATION=['original-settings','original-triggers','thin-settings','thin-triggers','oauth-audience','oauth-client','caller-executions','publisher-executions','caller-oauth']
def pin(p):
 if not exact(p,['path','sha256']) or type(p['path']) is not str or not Path(p['path']).is_absolute() or not digest(p['sha256']):fail()
 raw=rawfile(Path(p['path']),True)
 if sha(raw)!=p['sha256']:fail()
 return raw
def private_pin(p):
 directory(Path(p['path']).parent);raw=rawfile(Path(p['path']))
 if sha(raw)!=p['sha256']:fail()
 return raw
def valid_id(v):return type(v) is str and re.fullmatch('[-A-Za-z0-9_.]{1,100}',v) is not None
def descriptor(op,lane):
 if lane=='main':
  if not exact(op,['id','bucket','alias','actor','target','operation','units']):fail()
  key=op['bucket']+':'+op['alias'];r=RULES.get(key)
  if not r or op['actor']!=r['actor'] or op['target']!=r['target'] or op['operation'] not in r['methods'] or op['operation'] in READ_METHODS and not key.startswith(('C:','I:','J:')):fail()
 elif lane=='ui':
  if not exact(op,['id','key','actor','target','operation','units','preparation']) or type(op['preparation']) is not bool or op['operation'] not in READ_METHODS+['click','fill','submit']:fail()
  key=op['key'];r=RULES.get(key)
  if r:
   if op['actor']!=r['actor'] or op['target']!=r['target'] or op['preparation'] or all(m in ['GET','snapshot','read-key-presence'] for m in r['methods']) and op['operation'] not in ['snapshot','read-key-presence']:fail()
  elif key not in ['N:preparation','N:navigation','N:thin-triggers-before','N:thin-triggers-after'] or op['target'] not in NAVIGATION or op['actor']!=('caller' if op['target'].startswith('caller-') else 'publisher') or op['operation'] not in READ_METHODS or op['preparation']!=(key=='N:preparation') or key.startswith('N:thin-') and (op['target']!='thin-triggers' or op['operation']!='snapshot'):fail()
 else:fail()
 if not valid_id(op['id']) or type(op['units']) is not int or op['units']!=1:fail()
 return key
class Ledger:
 def __init__(self,cfg,cleanup=False):
  minimum=cfg.pop('minimumEvents',None) if cleanup else None
  if cleanup and (not integer(minimum) or minimum<0):fail()
  self.cfg=cfg;self.child=None;self.cleanup_mode=cleanup;self.memory=None
  if not exact(cfg,['path','epoch','binding','decisionHash','approval','history','baseline','original','legacyBudget','sources','now','ownerNonce']) or cfg['decisionHash']!=DECISION or not all(digest(cfg[k]) for k in ['binding','ownerNonce']) or type(cfg['epoch']) is not str or re.fullmatch('[-A-Za-z0-9_]{20,200}',cfg['epoch']) is None or not integer(cfg['now']):fail()
  self.path=Path(cfg['path']);directory(self.path.parent)
  if not self.path.is_absolute() or cfg['original']['path']!=str(self.path) or cfg['original']['epoch']!=cfg['epoch']:fail()
  fd=os.fstat(3);named=os.lstat(str(self.path)+'.lock')
  if not stat.S_ISREG(fd.st_mode) or fd.st_uid!=os.getuid() or stat.S_IMODE(fd.st_mode)!=0o600 or fd.st_size or fd.st_nlink!=1 or (fd.st_dev,fd.st_ino)!=(named.st_dev,named.st_ino) or fcntl.fcntl(3,fcntl.F_GETFL)&os.O_ACCMODE!=os.O_RDWR:fail()
  fcntl.flock(3,fcntl.LOCK_EX|fcntl.LOCK_NB)
  self.sources();self.base=json.loads(private_pin(cfg['baseline']));self.validate_history()
  if self.base.get('spent')!=27 or self.base.get('limit')!=160 or self.base.get('preparation',{}).get('cActions')!=[] or self.base['preparation'].get('iActions')!=[]:fail()
  if not cleanup and self.old()['spent']!=27:fail()
  self.old();self.past=json.loads(private_pin(cfg['history']['journal']));self.prior_time=max(e['time'] for e in self.past['events'])
  if cfg['now']<self.prior_time:fail()
  self.journal=Path(str(self.path)+'.simple.json');self.claim=Path(str(self.path)+'.simple-claim.json');self.stop_path=Path(str(self.path)+'.simple-stop.json')
  root=Path.home()/'.codex/private/cmwebs-authority-trials';directory(root)
  self.registry=root/(sha(json.dumps(cfg['epoch'],separators=(',',':')).encode())+'.simple.json')
  self.identity={k:copy.deepcopy(cfg[k]) for k in ['path','epoch','binding','decisionHash','approval','history','baseline','original','legacyBudget','sources']};self.identity['ownerHash']=sha(cfg['ownerNonce'].encode())
  if cleanup:
   r=record(self.registry)
   if record(self.claim)!=self.identity or r.get('identity')!=self.identity or type(r.get('checkpoint')) is not dict or type(r['checkpoint'].get('events')) is not list or len(r['checkpoint']['events'])!=minimum:fail()
   self.j=copy.deepcopy(r['checkpoint']);self.memory=copy.deepcopy(self.j);self.current();return
  for p in [self.registry,self.claim,self.journal,self.stop_path]:
   try:os.lstat(p);fail()
   except FileNotFoundError:pass
  self.j={'state':'ready','w0':None,'expiresAt':None,'lastAt':self.prior_time,'events':[],'pending':None,'stages':{},'stageNames':[],'stageBrowser':[],'recoveryBrowser':[],'plan':None,'completed':[],'failures':0,'mutated':False,'rpc':{'beganAt':None,'complete':False},'chargedUpperBoundMs':0,'finished':False}
  save_record(self.registry,{'identity':self.identity,'checkpoint':None},True);save_record(self.claim,self.identity,True);self.persist()
 def sources(self):
  cfg=self.cfg
  if type(cfg['sources']) is not list:fail()
  required={'read-authority-simple-budget.py','read-authority-simple-plan.mjs','read-authority-simple-control.mjs','read-authority-continuation-budget.py','read-authority-continuation-plan.mjs','read-authority-trial-budget-plan.mjs'}
  if not required.issubset({Path(p['path']).name for p in cfg['sources']}):fail()
  for p in cfg['sources']:pin(p)
  if not any(Path(p['path']).resolve()==Path(__file__).resolve() for p in cfg['sources']):fail()
  if sha(pin(cfg['legacyBudget']))!=history.LEGACY_SOURCE:fail()
 def validate_history(self):
  c=self.cfg;h=c['history']
  if not exact(h,['journal','drain','files']) or type(h['files']) is not list:fail()
  a=json.loads(private_pin(c['approval']))
  if not exact(a,['source','recordedAt','ownerAnswer','decisionSha256','importedSpent','mainLimit','uiLimit','combinedLimit','executionStarted']) or a['source']!='direct-human-approval' or a['ownerAnswer']!='同意232次方案，繼續執行（建議）' or a['decisionSha256']!=DECISION or [a[k] for k in ['importedSpent','mainLimit','uiLimit','combinedLimit']]!=[53,160,72,232] or a['executionStarted'] is not False:fail()
  for p in h['files']:private_pin(p)
  j=json.loads(private_pin(h['journal']));d=json.loads(private_pin(h['drain']))
  if j.get('state')!='stopped' or j.get('spent')!=3 or j.get('finished') is not True or j.get('chargedUpperBoundMs')!=0 or j.get('rpc')!={'beganAt':None,'complete':False} or type(j.get('events')) is not list or len(j['events'])!=3 or any(e.get('outcome')!='UNKNOWN' or not integer(e.get('time')) for e in j['events']) or d.get('stopAcknowledged') is not True or d.get('ordinaryScopeClosed') is not True or d.get('ownedScope',{}).get('state')!='SETTLED':fail()
 def old(self):
  v=json.loads(rawfile(self.path));b=self.base;p=v.get('preparation',{});bp=b['preparation'];tail=p.get('events',[])[2:];restored=copy.deepcopy(v)
  if type(tail) is not list or len(tail)>19 or v.get('spent')!=27+len(tail):fail()
  calls=list(bp['calls']);cs=[];ins=[]
  for e in tail:
   if not exact(e,['kind','action','units','time','outcome']) or e['kind'] not in ['C','I'] or e['units']!=1 or e['outcome']!='UNKNOWN' or not integer(e['time']) or any(t>e['time'] for t in calls):fail()
   arr=cs if e['kind']=='C' else ins;allowed=C if e['kind']=='C' else I
   if e['action'] not in allowed or e['action'] in arr or e['action']=='read-restored-editor' and 'restore-editor' not in cs:fail()
   arr.append(e['action']);calls.append(e['time'])
  if p.get('calls')!=calls or p.get('cActions')!=cs or p.get('iActions')!=ins:fail()
  restored['spent']=27
  for k in ['calls','events','cActions','iActions']:restored['preparation'][k]=copy.deepcopy(bp[k])
  if restored!=b:fail()
  root=Path.home()/'.codex/private/cmwebs-authority-trials';reg=root/(sha(json.dumps(self.cfg['epoch'],separators=(',',':')).encode())+'.preparation.json')
  if record(reg)!={'path':str(self.path),'binding':self.cfg['original']['binding'],'checkpoint':v} or record(Path(str(self.path)+'.preparation-claim.json'))!={'path':str(self.path),'epoch':self.cfg['epoch'],'binding':self.cfg['original']['binding']}:fail()
  if self.memory is not None:
   events=[e for e in self.memory['events'] if e['lane']=='main' and e['key'].startswith(('C:','I:'))]
   if len(tail)>len(events) or any((e['kind']+':'+e['action'])!=events[i]['key'] for i,e in enumerate(tail)):fail()
  return v
 def persist(self):
  save_record(self.registry,{'identity':self.identity,'checkpoint':self.j});self.memory=copy.deepcopy(self.j)
  if not self.cleanup_mode:synced(self.journal,self.j)
 def current(self):
  self.sources();self.validate_history();private_pin(self.cfg['baseline']);self.old()
  r=record(self.registry)
  if record(self.claim)!=self.identity or r!={'identity':self.identity,'checkpoint':self.memory}:fail()
  if not self.cleanup_mode and json.loads(rawfile(self.journal))!=self.memory:fail()
  self.j=copy.deepcopy(self.memory)
 def stop(self):
  if getattr(self,'memory',None) is None:return
  self.j=copy.deepcopy(self.memory);self.j['state']='stopped'
  if not os.path.lexists(self.stop_path):save_record(self.stop_path,{'identity':self.identity},True)
  self.persist()
 def counts(self):
  events=self.j['events'];main=sum(e['lane']=='main' for e in events);ordinary=sum(e['lane']=='main' and not e['cleanup'] for e in events);ui=sum(e['lane']=='ui' for e in events);uo=sum(e['lane']=='ui' and not e['cleanup'] for e in events)
  return main,ordinary,ui,uo
 def view(self,wait=0):
  m,mo,u,uo=self.counts();return {'ok':True,'state':self.j['state'],'mainSpent':53+m,'spent':53+m,'uiSpent':u,'combinedSpent':53+m+u,'uiOrdinary':uo,'uiCleanup':u-uo,'waitMs':wait,'w0':self.j['w0'],'expiresAt':self.j['expiresAt'],'lastAt':self.j['lastAt'],'pending':self.j['pending'],'chargedUpperBoundMs':self.j['chargedUpperBoundMs'],'rpc':self.j['rpc'],'planReady':self.j['plan'] is not None,'preparation':sum(e['lane']=='ui' and e['operation']['preparation'] for e in self.j['events']),'failures':self.j['failures']}
 def now(self,t):
  if not integer(t) or t<self.j['lastAt']:fail()
 def rate(self,t):
  times=[self.prior_time]*53+[e['time'] for e in self.j['events']];recent=sorted(x for x in times if t-x<60000)
  return 0 if len(recent)<10 else recent[-10]+60000-t
 def window(self,t):
  midnight=int((datetime.fromtimestamp(t/1000,timezone(timedelta(hours=8))).replace(hour=23,minute=59,second=59,microsecond=999000)).timestamp()*1000)
  return min(t+21600000,midnight)
 def active(self,t):
  self.now(t)
  if self.j['state']!='ready' or self.j['finished'] or os.path.lexists(self.stop_path) or t>=(self.j['expiresAt'] if self.j['expiresAt'] is not None else self.window(t)) or (self.j['expiresAt'] or self.window(t))-t<=360000:fail()
 def check(self,lane,op,t,terminal=False):
  self.current();self.now(t);key=descriptor(op,lane);cleanup=key.startswith(('C:','I:','J:'))
  if self.j['pending'] is not None:fail()
  if cleanup!=self.cleanup_mode:fail()
  if terminal:
   if lane!='main' or not key.startswith('T:') or self.j['state']!='stopped' or self.j['rpc']['beganAt'] is None or self.j['rpc']['complete']:fail()
  elif not cleanup:self.active(t)
  if any(e['operation']['id']==op['id'] for e in self.j['events']):fail()
  m,mo,u,uo=self.counts()
  if lane=='main':
   if m>=105 or not cleanup and mo>=79 or cleanup and sum(e['lane']=='main' and e['cleanup'] for e in self.j['events'])>=21 or key in self.j['completed'] or any(e['key']==key for e in self.j['events']):fail()
   if not cleanup and (key not in self.j['stages'] or self.j['stages'][key]!=op):fail()
  else:
   if u>=72 or (u-uo>=16 if cleanup else uo>=56):fail()
   if op['preparation']:
    if self.j['mutated'] or self.j['rpc']['beganAt'] is not None or self.j['plan'] is not None or self.j['stages'] or sum(e['lane']=='ui' and e['operation']['preparation'] for e in self.j['events'])>=16:fail()
   elif cleanup:
    rows=[v for v in self.j['recoveryBrowser'] if v['key']==key]
    prior={e['operation']['id']:e for e in self.j['events'] if e['lane']=='ui'}
    if op not in rows or any(e['key']==key and e.get('success') is False for e in prior.values()) or any(v['id'] not in prior or prior[v['id']].get('success') is not True for v in rows[:rows.index(op)]) or not any(e['lane']=='main' and e['key']==key and e.get('success') is True for e in self.j['events']):fail()
   elif op not in (self.j['plan']['browserOperations'] if self.j['plan'] is not None else self.j.get('stageBrowser',[])):fail()
  if not cleanup:
   if key=='P:publisher-userinfo' and 'P:publisher-refresh' not in self.j['completed']:fail()
   if (lane=='main' and not key.startswith('P:') or lane=='ui' and (op['operation'] not in READ_METHODS or key.startswith(('F:','G:')))) and any(k not in self.j['completed'] for k in ['P:publisher-refresh','P:publisher-userinfo']):fail()
  began=self.j['rpc']['beganAt'] is not None
  if not cleanup and (key.startswith(('F:wrapper-after.','G:wrapper-after.','T:')) or key=='N:thin-triggers-after')!=began and not key.startswith(('N:preparation','N:navigation')):fail()
  if not cleanup and key=='H:wrapper-compatibility-rpc':
   required=[k for k in RULES if k.startswith(('A:','B:','D:','E:','F:wrapper-before.','G:wrapper-before.','P:'))]
   if self.j['plan'] is None or began or any(k not in self.j['completed'] for k in required+['N:thin-triggers-before']):fail()
  wait=self.rate(t)
  if not cleanup and not terminal and t+wait+360000>=(self.j['expiresAt'] or self.window(t)):fail()
  return key,cleanup,wait
 def command(self,q):
  if type(q) is not dict:fail()
  op=q.get('op')
  if op=='inspect' and exact(q,['op']):self.current();return self.view()
  if op=='stop' and exact(q,['op']):self.stop();return self.view()
  if op=='cleanup-start' and exact(q,['op','now']):
   # The holder must first settle/drain actual IO; no JSON receipt substitutes.
   if self.memory['pending'] is not None:fail()
   self.cleanup_mode=True;self.current();self.now(q['now']);self.stop();return self.view()
  self.current()
  if op=='settle' and exact(q,['op','id','success','now']):
   self.now(q['now'])
   if type(q['success']) is not bool or self.j['pending']!=q['id']:fail()
   e=self.j['events'][-1];self.j['pending']=None;e['settled']=True;e['success']=q['success'];self.j['lastAt']=q['now']
   if q['success']:
    if e['lane']=='main' or e['key'].startswith('N:thin-'):self.j['completed'].append(e['key'])
   else:
    self.j['failures']+=1
    recoverable=e['lane']=='ui' and e['operation']['preparation'] and not self.j['mutated'] and self.j['rpc']['beganAt'] is None and self.j['failures']<=2 and self.view()['preparation']<16 and q['now']<self.j['expiresAt']
    if not recoverable:self.j['state']='stopped'
   self.persist();return self.view()
  if op=='stage-ready' and exact(q,['op','stage','operations','browserOperations','futureCaps','now']):
   self.active(q['now']);name=q['stage']
   if name not in STAGES or name=='recovery' or name in self.j['stageNames'] or self.j['plan'] is not None or type(q['operations']) is not list or type(q['browserOperations']) is not list:fail()
   found={};ids=set()
   for row in q['operations']:
    if not exact(row,['id','bucket','alias','actor','target','operation','units']):fail()
    key=row['bucket']+':'+row['alias'];r=RULES.get(key)
    if not r or key not in STAGES[name] or key in found or row['actor']!=r['actor'] or row['target']!=r['target'] or row['operation'] not in r['methods'] or row['units']!=1 or not valid_id(row['id']) or row['id'] in ids:fail()
    found[key]=row;ids.add(row['id'])
   if set(found)!=set(STAGES[name]) or any(row['id'] in {v['id'] for v in self.j['stages'].values()} for row in found.values()):fail()
   future={k:len(v) for k,v in STAGES.items() if k not in self.j['stageNames'] and k!=name}
   if q['futureCaps']!=future or any(type(v) is not int for v in q['futureCaps'].values()):fail()
   for row in q['browserOperations']:
    key=descriptor(row,'ui')
    if row['id'] in ids or key not in found and key!='N:navigation':fail()
    ids.add(row['id'])
   if len(self.j['stageBrowser'])+len(q['browserOperations'])+self.view()['preparation']>56:fail()
   self.j['stageNames'].append(name);self.j['stages'].update(found);self.j['stageBrowser']+=q['browserOperations'];self.persist();return self.view()
  if op=='recovery-ready' and exact(q,['op','browserOperations','now']):
   self.active(q['now'])
   if self.j['pending'] is not None or type(q['browserOperations']) is not list or not q['browserOperations'] or len(self.j['recoveryBrowser'])+len(q['browserOperations'])>16 or self.j['plan'] is not None:fail()
   ids={v['id'] for v in self.j['recoveryBrowser']}|{e['operation']['id'] for e in self.j['events']}
   for row in q['browserOperations']:
    key=descriptor(row,'ui')
    if not key.startswith(('C:','I:','J:')) or row['id'] in ids:fail()
    ids.add(row['id'])
   self.j['recoveryBrowser']+=q['browserOperations'];self.persist();return self.view()
  if op=='plan-ready' and exact(q,['op','plan','now']):
   self.active(q['now']);p=q['plan']
   if self.j['plan'] is not None or not exact(p,['operations','browserOperations']) or type(p['operations']) is not list or type(p['browserOperations']) is not list:fail()
   seen={};ids=set();uo=uc=0
   for row in p['operations']:
    if not exact(row,['id','bucket','alias','actor','target','operation','units']):fail()
    key=row['bucket']+':'+row['alias'];r=RULES.get(key)
    if not r or r['actor']!=row['actor'] or r['target']!=row['target'] or row['operation'] not in r['methods'] or row['units']!=1 or not valid_id(row['id']) or key in seen or row['id'] in ids:fail()
    seen[key]=row;ids.add(row['id'])
   if set(seen)!=set(RULES)-{'C:restore-editor','C:read-restored-editor'} or any(seen.get(k)!=v for k,v in self.j['stages'].items()):fail()
   for row in p['browserOperations']:
    key=descriptor(row,'ui')
    if row['id'] in ids:fail()
    ids.add(row['id'])
    if key.startswith(('C:','I:','J:')):uc+=1
    else:uo+=1
   if uo+self.view()['preparation']>56 or uc>16 or any(row not in p['browserOperations'] for row in self.j['stageBrowser']):fail()
   recovery=[v for v in p['browserOperations'] if v['key'].startswith(('C:','I:','J:'))]
   if any(row not in recovery for row in self.j['recoveryBrowser']):fail()
   self.j['recoveryBrowser']=recovery;self.j['stages']=seen;self.j['plan']=p;self.persist();return self.view()
  if op=='ui-complete' and exact(q,['op','key','now']):
   self.active(q['now']);key=q['key'];rows=[v for v in (self.j['plan']['browserOperations'] if self.j['plan'] is not None else self.j['stageBrowser']) if v['key']==key]
   events={e['operation']['id']:e for e in self.j['events']}
   if self.j['pending'] or key in self.j['completed'] or not rows or any(v['id'] not in events or not events[v['id']].get('success') for v in rows):fail()
   self.j['completed'].append(key);self.persist();return self.view()
  if op=='rpc-finish' and exact(q,['op','now']):
   self.active(q['now']);required=[k for k in RULES if k.startswith(('F:wrapper-after.','G:wrapper-after.'))]+['N:thin-triggers-after']
   if self.j['pending'] or self.j['rpc']['beganAt'] is None or self.j['rpc']['complete'] or any(k not in self.j['completed'] for k in required):fail()
   self.j['rpc']['complete']=True;self.persist();return self.view()
  rpc=op in ['rpc-wait','rpc-begin'];terminal=op in ['terminal-wait','terminal-debit']
  if op in ['wait','debit','rpc-wait','rpc-begin','terminal-wait','terminal-debit'] and exact(q,['op','lane','operation','now']+(['credentialExpiresAt'] if rpc else [])):
   key,cleanup,wait=self.check(q['lane'],q['operation'],q['now'],terminal)
   if (key=='H:wrapper-compatibility-rpc')!=rpc or rpc and (not integer(q['credentialExpiresAt']) or not q['now']+wait+360000<q['credentialExpiresAt']<=self.j['expiresAt']):fail()
   if op.endswith('wait') or op=='wait':return self.view(wait)
   if wait:fail()
   if self.j['w0'] is None:self.j['w0']=q['now'];self.j['expiresAt']=self.window(q['now'])
   e={'lane':q['lane'],'key':key,'operation':q['operation'],'time':q['now'],'outcome':'UNKNOWN','cleanup':cleanup,'settled':False,'success':None};self.j['events'].append(e);self.j['pending']=q['operation']['id'];self.j['lastAt']=q['now']
   if q['operation']['operation'] not in READ_METHODS+['GET'] and not cleanup:self.j['mutated']=True
   if key=='H:wrapper-compatibility-rpc':self.j['chargedUpperBoundMs']=360000;self.j['rpc']['beganAt']=q['now']
   self.persist()
   if q['lane']=='main' and key.startswith(('C:','I:')):self.original_debit(key,q['now'])
   return self.view()
  fail()
 def original_debit(self,key,t):
  if self.child is None:
   self.child=subprocess.Popen([sys.executable,self.cfg['legacyBudget']['path'],'--inherited-lock'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,pass_fds=(3,),text=True)
   self.child.stdin.write(compact(self.cfg['original'])+'\n');self.child.stdin.flush();ready=json.loads(self.child.stdout.readline(20001))
   if ready.get('ok') is not True:fail()
  q={'op':'debit','kind':key[0],'action':key[2:],'units':1,'now':t};self.child.stdin.write(compact(q)+'\n');self.child.stdin.flush();r=json.loads(self.child.stdout.readline(20001))
  if r.get('ok') is not True:fail()
  self.old()
 def close(self):
  if self.child is not None:
   self.child.stdin.close();self.child.wait(timeout=3)
  if self.memory is not None:
   try:self.stop()
   except Exception:pass

def main():
 ledger=None
 try:
  os.umask(0o077)
  if sys.argv[1:]==['--policy']:print(compact(RULES));return
  if sys.argv[1:] not in [[],['--cleanup']]:fail()
  line=sys.stdin.buffer.readline(1000001)
  if len(line)>1000000:fail()
  ledger=Ledger(json.loads(line),sys.argv[1:]==['--cleanup']);print(compact(ledger.view()),flush=True)
  for line in sys.stdin.buffer:
   try:
    if len(line)>1000000:fail()
    print(compact(ledger.command(json.loads(line))),flush=True)
   except Exception:
    try:ledger.stop()
    except Exception:pass
    print('{"ok":false,"code":"TRIAL_STOPPED"}',flush=True)
 except Exception:print('{"ok":false,"code":"TRIAL_STOPPED"}',flush=True)
 finally:
  if ledger is not None:ledger.close()
if __name__=='__main__':main()
