"""Approved PREP loading/source continuity; no browser or network access.

All nine primitives, target attempts and failures belong to the same latest
registry checkpoint. Source changes require the latest closed-holder receipt.
"""
import copy,json,os
from pathlib import Path
DECISION='909dabbd2cfbd56dd06ac94f1221fe1fad0e566e8b247989419aa455066b73a6'
TARGETS=['thin-settings','oauth-audience']
def loading_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];record=g['record'];rawfile=g['rawfile'];sha=g['sha'];save=g['save_record'];integer=g['integer']
 class LoadingLedger(base):
  def validate_origin(self):
   p=self.cfg['readonlyLoading']
   if not exact(p,['decisionHash','approval','origin']) or p['decisionHash']!=DECISION or not exact(p['origin'],['journal','claim','registry','receipt']):fail()
   origin=p['origin'];raw={k:pin(v) for k,v in origin.items()};j=json.loads(raw['journal']);claim=record(Path(origin['claim']['path']));reg=record(Path(origin['registry']['path']));receipt=json.loads(raw['receipt']);a=json.loads(pin(p['approval']))
   keys=['source','decisionSha256','ownerAnswer','predecessorSha256','importedSpent','combinedLimit','maximumLoadingPrimitives','recordedAt','executionStarted']
   if not exact(a,keys) or a['source']!='direct-human-approval' or a['decisionSha256']!=DECISION or a['ownerAnswer']!='同意載入與安全接續修訂，維持232' or a['predecessorSha256']!=sha(raw['journal']) or a['importedSpent']!=83 or a['combinedLimit']!=232 or a['maximumLoadingPrimitives']!=9 or a['executionStarted'] is not False or not integer(a['recordedAt']) or not j['lastAt']<=a['recordedAt']<=self.cfg['now']:fail()
   stable={k:v for k,v in self.identity.items() if k not in ['sources','ownerHash','readonlyLoading']}
   if not exact(claim,list(stable)+['sources','ownerHash']) or any(claim[k]!=v for k,v in stable.items()) or reg!={'identity':claim,'checkpoint':j}:fail()
   for source in claim['sources']:g['pin'](source)
   if len(j['events'])!=30 or len(j['holders'])!=3 or j['failures']!=6 or j['technicalFailures']!=0 or j['phase']!='PREP' or j['lifecycle']!='CLEAN_PAUSE' or j['state']!='ready' or j['pending'] is not None or j['mutated'] is not False or j['w0'] is not None or j['expiresAt'] is not None or j['rpc']!={'beganAt':None,'complete':False}:fail()
   ops=self.initial_preparation()[:4]
   for i,(e,op) in enumerate(zip(j['events'][26:],ops)):
    if e['operation']!=op or e['settled'] is not True or e['success'] is not (i<3):fail()
   p=j['events'][-1].get('preparationOutcome',{})
   if p!={'kind':'NOT_READY','phase':'READY','targetVerified':True,'accountVerified':True,'bindingVerified':True,'pureRead':True,'terminal':True,'fieldsRead':False}:fail()
   self.verify_receipt(receipt,j,raw['journal'],raw['registry'])
   return j
  def verify_receipt(self,r,j,jraw,rraw):
   expected={'source':'readonly-continuity-terminal-holder','lifecycle':'HANDOFF_CLOSED','ownerHash':j['holder'],'journalSha256':sha(jraw),'registrySha256':sha(rraw),'eventCount':len(j['events']),'holderCount':len(j['holders']),'allIoSettled':True,'scopeClosed':True,'childClosed':True,'lockReleased':True}
   if r!=expected:fail()
  def resume_preparation(self,p):
   if not exact(p,['receipt','minimumEvents']) or not integer(p['minimumEvents']):fail()
   jraw=rawfile(self.journal);rraw=rawfile(self.registry);j=json.loads(jraw);claim=record(self.claim)
   if record(self.registry)!={'identity':claim,'checkpoint':j} or p['minimumEvents']!=len(j['events']) or p['receipt']['path']!=str(self.path)+self.suffix+'-handoff-'+str(len(j['holders']))+'.json':fail()
   self.verify_receipt(json.loads(g['pin'](p['receipt'])),j,jraw,rraw)
   if j['state']!='ready' or j['phase']!='PREP' or j['lifecycle']!='CLEAN_PAUSE' or j['pending'] is not None or j['mutated'] is not False or j['rpc']!={'beganAt':None,'complete':False} or j['w0'] is not None or j['expiresAt'] is not None or any(e['settled'] is not True for e in j['events']) or os.path.lexists(self.stop_path):fail()
   owner=sha(self.cfg['ownerNonce'].encode())
   if owner in j['holders'] or self.cfg['now']<j['lastAt']:fail()
   stable={k:v for k,v in self.identity.items() if k not in ['sources','ownerHash']};old={k:v for k,v in claim.items() if k not in ['sources','ownerHash']}
   origin=self.validate_origin()
   if 'readonlyLoading' not in old:
    if {k:v for k,v in stable.items() if k!='readonlyLoading'}!=old or j!=origin:fail()
    j['loading']={'maximum':9,'used':0,'currentTarget':'thin-settings','acquisition':'inventory','projections':dict.fromkeys(TARGETS,0),'waits':dict.fromkeys(TARGETS,0),'grounded':[],'superseded':[o['id'] for o in self.initial_preparation()[4:]],'sourceChain':[]}
    j['futureOrdinaryUi']=45
   elif stable!=old:fail()
   for source in claim['sources']:g['pin'](source)
   if j['events'][:30]!=origin['events'] or len(j['events'])-30!=j['loading']['used'] or not 0<=j['loading']['used']<=9:fail()
   # Same canonical registry is the independent latest pointer. A stale receipt
   # or changed source bytes cannot import an older checkpoint into this path.
   j['loading']['sourceChain'].append({'identitySha256':sha(json.dumps(claim,separators=(',',':')).encode()),'sources':copy.deepcopy(claim['sources'])})
   j['loading']['acquisition']='inventory'
   j.update(holder=owner,lifecycle='ACTIVE',lastAt=self.cfg['now']);j['holders'].append(owner)
   self.j=j;save(self.claim,self.identity);self.persist()
  def preparation_complete(self):return self.j.get('loading',{}).get('grounded')==TARGETS
  def future_limit(self):return 45-self.j['loading']['used']
  def ordinary_ceiling(self):return 76 # one historical unused declaration + one spare remain protected
  def preparation_reserve(self):return max(self.remaining_mapped_ui(),self.j['futureOrdinaryUi'])
  def future_spent(self):return sum(e['lane']=='ui' and not e['cleanup'] and not e.get('preparationStage') for e in self.j['events'][30:])
  def unspent_preparation(self):
   used={e['operation']['id'] for e in self.j['events']}|set(self.j['loading']['superseded'])
   return sum(r['id'] not in used for p in self.j['preparationStages'].values() for r in p['operations'])
  def check_loading(self,op):
   l=self.j['loading'];target=op['target'];method=op['operation'];events=self.j['events'][30:]
   if l['used']>=9 or target!=l['currentTarget'] or not op['id'].startswith('loading-'):fail()
   acquisition=l['acquisition']
   if acquisition!='ready':
    if method!=acquisition:fail()
    return
   if method=='navigate':
    if target!='oauth-audience' or 'thin-settings' not in l['grounded'] or any(e['operation']['operation']=='navigate' for e in events):fail()
   elif method=='snapshot':
    attempts=l['projections'][target]
    if attempts>=2 or target in l['grounded'] or attempts==1 and l['waits'][target]!=1:fail()
   elif method=='wait':
    snapshots=[e for e in events if e['operation']['target']==target and e['operation']['operation']=='snapshot']
    if l['waits'][target] or len(snapshots)!=1 or snapshots[0]['success'] is not False or snapshots[0].get('preparationOutcome',{}).get('kind')!='NOT_READY':fail()
   else:fail()
  def check(self,lane,op,t,terminal=False):
   if self.continuity_preparation(lane,op):
    # Navigation is the one allowed thin -> audience transition; its descriptor
    # names the destination, while inventory/claim must name the latest URL.
    self.current()
    if op['operation']=='navigate' and self.j['loading']['currentTarget']=='thin-settings':
     if op['target']!='oauth-audience':fail()
     if self.j['loading']['acquisition']!='ready' or 'thin-settings' not in self.j['loading']['grounded']:fail()
     if any(e['operation']['operation']=='navigate' for e in self.j['events'][30:]):fail()
    else:self.check_loading(op)
   return super().check(lane,op,t,terminal)
  def command(self,q):
   name=q.get('op') if type(q) is dict else None
   if name=='preparation-ready':
    if not exact(q,['op','stage','operations','remainingOrdinaryUi','now']):fail()
    self.current();self.active(q['now']);rows=q['operations'];reserve=q['remainingOrdinaryUi'];name=q['stage']
    if self.j['phase']!='PREP' or self.j['pending'] is not None or not g['valid_id'](name) or not name.startswith('loading-') or name in self.j['preparationStages'] or type(rows) is not list or len(rows)!=1 or not integer(reserve) or reserve<36:fail()
    row=rows[0];g['descriptor'](row,'ui')
    ids={e['operation']['id'] for e in self.j['events']}|{r['id'] for p in self.j['preparationStages'].values() for r in p['operations']}
    if not self.continuity_preparation('ui',row) or row['id'] in ids or not row['id'].startswith('loading-') or self.j['loading']['used']+self.unspent_preparation()-1+len(rows)>9 or self.counts()[3]+self.unspent_preparation()+len(rows)+reserve>76:fail()
    self.j['preparationStages'][name]={'operations':copy.deepcopy(rows),'remainingOrdinaryUi':reserve};self.j['futureOrdinaryUi']=reserve;self.j['lastAt']=q['now'];self.persist();return self.view()
   if name=='settle' and self.j['events'] and self.j['events'][-1]['operation']['id'].startswith('loading-') and 'preparationStage' in self.j['events'][-1]:
    self.current();e=self.j['events'][-1];op=e['operation'];method=op['operation'];target=op['target']
    if 'loadingResultVerified' in q:
     if not exact(q,['op','id','success','now','loadingResultVerified']) or q['success'] is not True or q['loadingResultVerified'] is not True or method!='snapshot':fail()
     q={k:v for k,v in q.items() if k!='loadingResultVerified'}
    elif q.get('success') is True and method=='snapshot':fail()
    if 'preparationOutcome' in q and method!='snapshot':fail()
    result=super().command(q);l=self.j['loading'];l['used']+=1
    if method=='snapshot':
     l['projections'][target]+=1
     if q['success'] is True:self.j['events'][-1]['loadingResultVerified']=True;l['grounded'].append(target)
    elif method=='wait':l['waits'][target]+=1
    elif method=='inventory' and q['success'] is True:l['acquisition']='claim'
    elif method=='claim' and q['success'] is True:l['acquisition']='ready'
    elif method=='navigate' and q['success'] is True:l['currentTarget']=target
    self.persist();return self.view()
   return super().command(q)
 return LoadingLedger
