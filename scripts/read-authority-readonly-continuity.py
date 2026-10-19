"""Approved durable PREP successor. No remote IO; the live holder owns IO/drain.

The old stopped namespace is never reopened. PREP has a finite, reviewed map;
only the first ordinary non-PREP debit starts the single trial clock.
"""
import copy,hashlib,json,os
from pathlib import Path
DECISION='5d9a800f4e7f7982ae01c5326e83187d7f0533f9e0a63cfb123b0d283e006e52'
TARGETS={'original-settings','original-triggers','thin-settings','thin-triggers','oauth-audience','oauth-client','caller-executions','publisher-executions'}
TECHNICAL={'DECODE','PROJECTOR_COMBOS','PROJECTOR_SHAPE','PROJECTOR_ANCESTORS','PROJECTOR_RELATED','POSTCHECK_COMBO'}
def continuity_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];record=g['record'];sha=g['sha'];integer=g['integer'];descriptor=g['descriptor'];save=g['save_record']
 class ContinuityLedger(base):
  def validate_continuity(self):
   c=self.cfg;p=c['readonlyContinuity'];prior,_=self.validate_readonly_debug()
   fields=['approval','journal','claim','stop','registry','drain']
   if not exact(p,['decisionHash']+fields) or p['decisionHash']!=DECISION:fail()
   raw={k:pin(p[k]) for k in fields};j=json.loads(raw['journal']);claim=record(Path(p['claim']['path']))
   root=Path.home()/'.codex/private/cmwebs-authority-trials';suffix='.simple-readonly-debug'
   expected={'journal':str(self.path)+suffix+'.json','claim':str(self.path)+suffix+'-claim.json','stop':str(self.path)+suffix+'-stop.json','registry':str(root/(sha(json.dumps(c['epoch'],separators=(',',':')).encode())+suffix+'.json'))}
   if any(p[k]['path']!=v for k,v in expected.items()):fail()
   stable=['path','epoch','binding','decisionHash','approval','history','baseline','original','legacyBudget','continuation','admissionRepair','admissionWindow','readonlyDebug']
   if not exact(claim,stable+['sources','ownerHash']) or any(claim[k]!=c[k] for k in stable) or not g['digest'](claim['ownerHash']):fail()
   for source in claim['sources']:g['pin'](source)
   if record(Path(p['registry']['path']))!={'identity':claim,'checkpoint':j}:fail()
   marker=json.loads(raw['stop'])
   if marker!={'source':'live-owner-stop','binding':c['binding']} and record(Path(p['stop']['path']))!={'identity':claim}:fail()
   a=json.loads(raw['approval']);keys=['source','decisionSha256','ownerAnswer','predecessorSha256','importedSpent','importedMainSpent','importedUiSpent','mainLimit','uiOrdinaryLimit','uiRecoveryLimit','combinedLimit','qualifiedFailureLimit','recordedAt','executionStarted']
   if not exact(a,keys) or a['source']!='direct-human-approval' or a['decisionSha256']!=DECISION or a['ownerAnswer']!='同意統一修訂，維持232' or a['predecessorSha256']!=sha(raw['journal']) or [a[k] for k in ['importedSpent','importedMainSpent','importedUiSpent','mainLimit','uiOrdinaryLimit','uiRecoveryLimit','combinedLimit','qualifiedFailureLimit']]!=[72,53,19,160,56,16,232,2] or a['executionStarted'] is not False or not integer(a['recordedAt']) or c['now']<a['recordedAt']:fail()
   if not exact(j,list(prior)) or j['state']!='stopped' or j['pending'] is not None or j['mutated'] is not False or j['rpc']!={'beganAt':None,'complete':False} or j['failures']!=4 or j['chargedUpperBoundMs']!=0 or j['finished'] is not False or j['events'][:15]!=prior['events'] or len(j['events'])!=19 or any(j[k]!=prior[k] for k in ['stages','stageNames','stageBrowser','recoveryBrowser','plan','completed']):fail()
   at=prior['lastAt']
   for i,e in enumerate(j['events'][15:]):
    if not exact(e,['lane','key','operation','time','outcome','cleanup','settled','success']) or e['lane']!='ui' or e['key'] not in ['N:preparation','N:navigation'] or descriptor(e['operation'],'ui')!=e['key'] or e['cleanup'] is not False or e['settled'] is not True or e['success'] is not (i<3) or e['outcome']!='UNKNOWN' or not integer(e['time']) or not at<=e['time']<=j['lastAt']:fail()
    at=e['time']
   if len({e['operation']['id'] for e in j['events']})!=19 or not integer(j['w0']) or j['expiresAt']!=self.window(j['w0']) or not integer(j['lastAt']) or not j['w0']<=j['lastAt']<=a['recordedAt']:fail()
   d=json.loads(raw['drain'])
   if not exact(d,['source','stopRequested','stopAcknowledged','ordinaryScopeClosed','ownedScope','trialAccepted','remoteExecutionSettled','rollbackComplete']) or d['source']!='simple-authority-holder' or any(d[k] is not True for k in ['stopRequested','stopAcknowledged','ordinaryScopeClosed']) or d['ownedScope']!={'state':'SETTLED'} or any(d[k] is not False for k in ['trialAccepted','remoteExecutionSettled','rollbackComplete']):fail()
   if self.memory is not None and self.memory['events'][:19]!=j['events']:fail()
   return j,a['recordedAt']
  def continuity_preparation(self,lane,op):
   return self.j['phase']=='PREP' and lane=='ui' and op['key'] in ['N:preparation','N:navigation'] and op['target'] in TARGETS and op['operation'] in g['READ_METHODS']
  def active(self,t):
   if self.j['phase']!='PREP':return super().active(t)
   self.now(t)
   if self.j['state']!='ready' or self.j['lifecycle']!='ACTIVE' or self.j['finished'] or os.path.lexists(self.stop_path) or self.j['w0'] is not None or self.j['expiresAt'] is not None:fail()
  def view(self,wait=0):
   v=super().view(wait);v['preparation']=19+sum('preparationStage' in e for e in self.j['events'][19:]);v.update({k:self.j[k] for k in ['phase','lifecycle','technicalFailures']});return v
  def remaining_mapped_ui(self):
   rows=self.j['plan']['browserOperations'] if self.j['plan'] is not None else self.j['stageBrowser']
   used={e['operation']['id'] for e in self.j['events']}
   return sum(not r['key'].startswith(('C:','I:','J:')) and r['id'] not in used for r in rows)
  def check(self,lane,op,t,terminal=False):
   result=super().check(lane,op,t,terminal);key,cleanup,wait=result
   if cleanup or terminal:return result
   if self.j['phase']=='TRIAL' and lane=='ui' and op['preparation']:fail()
   if self.continuity_preparation(lane,op):
    if self.j['phase']!='PREP' or self.j['mutated'] or self.j['rpc']['beganAt'] is not None:fail()
    stages=[p for p in self.j['preparationStages'].values() if op in p['operations']]
    if len(stages)!=1:fail()
    reserve=max(self.remaining_mapped_ui(),max(p['remainingOrdinaryUi'] for p in self.j['preparationStages'].values()));_,_,_,uo=self.counts()
    if uo+1+reserve>56:fail()
   else:
    if self.j['phase']=='PREP' and (self.j['plan'] is None or self.counts()[3]+self.remaining_mapped_ui()>56):fail()
    if t+wait+360000>=(self.j['expiresAt'] or self.window(t)):fail()
   return result
  def resume_preparation(self,p):
   # Caller must possess the latest terminal-holder receipt, not merely a PID,
   # released lock or old screenshot. Parent already holds canonical flock.
   if not exact(p,['receipt','minimumEvents']) or not integer(p['minimumEvents']):fail()
   receipt=json.loads(pin(p['receipt']));j=json.loads(g['rawfile'](self.journal));claim=record(self.claim);reg=record(self.registry)
   stable={k:v for k,v in self.identity.items() if k!='ownerHash'}
   if {k:v for k,v in claim.items() if k!='ownerHash'}!=stable or reg!={'identity':claim,'checkpoint':j}:fail()
   fields=['source','lifecycle','ownerHash','journalSha256','registrySha256','eventCount','holderCount','allIoSettled','scopeClosed','childClosed','lockReleased']
   if not exact(receipt,fields) or receipt['source']!='readonly-continuity-terminal-holder' or receipt['lifecycle']!='HANDOFF_CLOSED' or receipt['ownerHash']!=j.get('holder') or receipt['journalSha256']!=sha(g['rawfile'](self.journal)) or receipt['registrySha256']!=sha(g['rawfile'](self.registry)) or receipt['eventCount']!=len(j['events']) or p['minimumEvents']!=len(j['events']) or receipt['holderCount']!=len(j['holders']) or any(receipt[k] is not True for k in ['allIoSettled','scopeClosed','childClosed','lockReleased']):fail()
   expected=str(self.path)+'.simple-readonly-continuity-handoff-'+str(len(j['holders']))+'.json'
   if p['receipt']['path']!=expected or j.get('phase')!='PREP' or j.get('lifecycle')!='CLEAN_PAUSE' or j.get('state')!='ready' or j.get('pending') is not None or j.get('mutated') is not False or j.get('rpc')!={'beganAt':None,'complete':False} or any(e.get('settled') is not True for e in j['events']) or os.path.lexists(self.stop_path):fail()
   owner=sha(self.cfg['ownerNonce'].encode())
   if owner in j['holders']:fail()
   self.identity=claim;self.j=j;self.memory=copy.deepcopy(j);self.current();self.now(self.cfg['now'])
   self.j.update(holder=owner,lifecycle='ACTIVE',lastAt=self.cfg['now']);self.j['holders'].append(owner);self.persist()
  def command(self,q):
   if type(q) is not dict:fail()
   op=q.get('op')
   if op=='preparation-ready' and exact(q,['op','stage','operations','remainingOrdinaryUi','now']):
    self.current();self.active(q['now']);name=q['stage'];rows=q['operations'];reserve=q['remainingOrdinaryUi']
    if self.j['phase']!='PREP' or self.j['pending'] is not None or not g['valid_id'](name) or name in self.j['preparationStages'] or type(rows) is not list or not rows or not integer(reserve) or reserve<1:fail()
    ids={e['operation']['id'] for e in self.j['events']}|{r['id'] for p in self.j['preparationStages'].values() for r in p['operations']}
    for row in rows:
     descriptor(row,'ui')
     if not self.continuity_preparation('ui',row) or row['id'] in ids:fail()
     ids.add(row['id'])
    reserve=max([reserve,self.remaining_mapped_ui()]+[p['remainingOrdinaryUi'] for p in self.j['preparationStages'].values()]);used=self.counts()[3];unspent=sum(r['id'] not in {e['operation']['id'] for e in self.j['events']} for p in self.j['preparationStages'].values() for r in p['operations'])
    if used+unspent+len(rows)+reserve>56:fail()
    self.j['preparationStages'][name]={'operations':copy.deepcopy(rows),'remainingOrdinaryUi':reserve};self.j['lastAt']=q['now'];self.persist();return self.view()
   if op=='pause-preparation' and exact(q,['op','now']):
    self.current();self.active(q['now'])
    if self.j['phase']!='PREP' or self.j['pending'] is not None or self.j['mutated'] or self.j['rpc']['beganAt'] is not None or any(e['settled'] is not True for e in self.j['events']):fail()
    self.j.update(lifecycle='CLEAN_PAUSE',lastAt=q['now']);self.persist();return self.view()
   if op=='settle' and exact(q,['op','id','success','now','preparationOutcome']):
    self.current();self.now(q['now']);p=q['preparationOutcome']
    fields=['kind','phase','targetVerified','accountVerified','bindingVerified','pureRead','terminal','fieldsRead']
    if self.j['pending']!=q['id'] or q['success'] is not False or self.j['phase']!='PREP' or self.j['mutated'] or self.j['rpc']['beganAt'] is not None or not exact(p,fields) or any(p[k] is not True for k in ['targetVerified','accountVerified','bindingVerified','pureRead','terminal']) or type(p['fieldsRead']) is not bool or not (p['kind']=='NOT_READY' and p['phase']=='READY' and p['fieldsRead'] is False or p['kind']=='TECHNICAL' and p['phase'] in TECHNICAL):fail()
    e=self.j['events'][-1]
    if not self.continuity_preparation(e['lane'],e['operation']):fail()
    e.update(settled=True,success=False,preparationOutcome=copy.deepcopy(p));self.j.update(pending=None,lastAt=q['now']);self.j['failures']+=1
    if p['kind']=='TECHNICAL':self.j['technicalFailures']+=1
    if self.j['technicalFailures']>2:self.j.update(state='stopped',lifecycle='HARD_STOP')
    self.persist();return self.view()
   # Failures with no complete preparation proof fail closed, even legacy proof.
   if op=='settle' and q.get('success') is False:
    self.current();self.now(q.get('now'))
    if self.j['pending']!=q.get('id'):fail()
    e=self.j['events'][-1];e.update(settled=True,success=False);self.j.update(pending=None,lastAt=q['now'],state='stopped',lifecycle='HARD_STOP');self.j['failures']+=1;self.persist();return self.view()
   return super().command(q)
 return ContinuityLedger
