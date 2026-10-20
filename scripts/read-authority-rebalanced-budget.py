"""One approved79-source migration; native work is charged only to actual UI.

Historical sources stay pinned. This ledger grants no network or browser IO;
the separately reviewed live holder verifies each mapped callback and result.
"""
import copy,json,os
from pathlib import Path
DECISION='bdab855eb6e95f7ba838e4514bd9bbc8b59db0ee64755d12950706b5ac0e051a'
def rebalanced_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];sha=g['sha'];record=g['record'];integer=g['integer'];rules=g['RULES'];stages=g['STAGES']
 native=set(['A:original-cloud-backup', 'A:original-triggers-backup', 'A:original-properties-backup', 'D:thin-gcp-link', 'D:thin-properties-write', 'D:thin-properties-readback', 'E:testing-user-write', 'E:testing-user-readback', 'E:client-create', 'E:client-readback', 'E:oauth-response', 'F:wrapper-before.original-settings', 'F:wrapper-before.original-triggers', 'F:wrapper-before.thin-settings', 'F:wrapper-before.oauth-audience', 'F:wrapper-before.oauth-client', 'F:wrapper-after.original-settings', 'F:wrapper-after.original-triggers', 'F:wrapper-after.thin-settings', 'F:wrapper-after.oauth-audience', 'F:wrapper-after.oauth-client'])
 if native!={k for k,r in rules.items() if not k.startswith(('C:','I:','J:')) and not any(m in ['GET','POST','PUT','PATCH','DELETE'] for m in r['methods'])}:fail()
 class RebalancedLedger(base):
  def validate_rebalance(self):
   prior,_=self.validate_successor();c=self.cfg;p=c['readonlyRebalance']
   if not exact(p,['decisionHash','approval','journal','claim','registry','receipt']) or p['decisionHash']!=DECISION:fail()
   raw={k:pin(p[k]) for k in ['approval','journal','claim','registry','receipt']};j=json.loads(raw['journal']);claim=record(Path(p['claim']['path']));suffix='.simple-readonly-diagnostic'
   expected={'journal':str(self.path)+suffix+'.json','claim':str(self.path)+suffix+'-claim.json','registry':str(Path.home()/'.codex/private/cmwebs-authority-trials'/(sha(json.dumps(c['epoch'],separators=(',',':')).encode())+suffix+'.json')),'receipt':str(self.path)+suffix+'-handoff-2.json'}
   if any(p[k]['path']!=v for k,v in expected.items()) or os.path.lexists(str(self.path)+suffix+'-stop.json'):fail()
   stable=[k for k in c if k not in ['sources','now','ownerNonce','readonlyRebalance']]
   if not exact(claim,stable+['sources','ownerHash']) or any(claim[k]!=c[k] for k in stable) or not g['digest'](claim['ownerHash']):fail()
   for source in claim['sources']:g['pin'](source)
   if record(Path(p['registry']['path']))!={'identity':claim,'checkpoint':j}:fail()
   approval=json.loads(raw['approval']);keys=['source','decisionSha256','ownerAnswer','predecessorSha256','importedSpent','importedMainSpent','importedUiSpent','mainLimit','uiOrdinaryLimit','uiRecoveryLimit','combinedLimit','recordedAt','executionStarted']
   if not exact(approval,keys) or approval['source']!='direct-human-approval' or approval['decisionSha256']!=DECISION or approval['ownerAnswer']!='同意232內重分配與分階段接續' or approval['predecessorSha256']!=sha(raw['journal']) or [approval[k] for k in ['importedSpent','importedMainSpent','importedUiSpent','mainLimit','uiOrdinaryLimit','uiRecoveryLimit','combinedLimit']]!=[79,53,26,139,77,16,232] or approval['executionStarted'] is not False or not integer(approval['recordedAt']) or not j['lastAt']<=approval['recordedAt']<=c['now']:fail()
   if not exact(j,list(prior)) or j['events'][:23]!=prior['events'] or len(j['events'])!=26 or j['state']!='ready' or j['lifecycle']!='CLEAN_PAUSE' or j['phase']!='PREP' or j['pending'] is not None or j['w0'] is not None or j['expiresAt'] is not None or j['failures']!=5 or j['technicalFailures']!=0 or j['mutated'] is not False or j['rpc']!={'beganAt':None,'complete':False} or len(j['holders'])!=2 or j['holders'][:1]!=prior['holders'] or j['holders'][-1]!=j['holder'] or j['holder']!=claim['ownerHash'] or sha(c['ownerNonce'].encode()) in j['holders']:fail()
   if any(j[k]!=prior[k] for k in ['stages','stageNames','stageBrowser','recoveryBrowser','plan','completed','chargedUpperBoundMs','finished']):fail()
   expected_prep=copy.deepcopy(prior['preparationStages']);expected_prep['original-settings-guard-76']={'operations':self.diagnostic_ops(),'remainingOrdinaryUi':29}
   if j['preparationStages']!=expected_prep:fail()
   at=prior['lastAt']
   for e,op in zip(j['events'][23:],self.diagnostic_ops()):
    if not exact(e,['lane','key','operation','time','outcome','cleanup','settled','success','preparationStage']) or e['operation']!=op or e['lane']!='ui' or e['key']!='N:preparation' or e['preparationStage']!='original-settings-guard-76' or e['cleanup'] is not False or e['settled'] is not True or e['success'] is not True or e['outcome']!='UNKNOWN' or not integer(e['time']) or not at<=e['time']<=j['lastAt']:fail()
    at=e['time']
   receipt=json.loads(raw['receipt']);expected_receipt={'source':'readonly-continuity-terminal-holder','lifecycle':'HANDOFF_CLOSED','ownerHash':j['holder'],'journalSha256':sha(raw['journal']),'registrySha256':sha(raw['registry']),'eventCount':26,'holderCount':2,'allIoSettled':True,'scopeClosed':True,'childClosed':True,'lockReleased':True}
   if receipt!=expected_receipt or self.memory is not None and self.memory['events'][:26]!=j['events']:fail()
   return j,approval['recordedAt']
  def initial_preparation(self):
   rows=[('inventory','original-settings','inventory'),('claim','original-settings','claim'),('thin-navigate','thin-settings','navigate'),('thin-snapshot','thin-settings','snapshot'),('audience-navigate','oauth-audience','navigate'),('audience-snapshot','oauth-audience','snapshot')]
   return [{'id':'rebalance79-'+id,'key':'N:preparation','actor':'publisher','target':target,'operation':method,'units':1,'preparation':True} for id,target,method in rows]
  def preparation_complete(self):
   ops=self.initial_preparation();events=[e for e in self.j['events'][26:] if e['operation'] in ops]
   return len(events)==6 and [e['operation'] for e in events]==ops and all(e['settled'] is True and e['success'] is True for e in events)
  def unspent_preparation(self):
   used={e['operation']['id'] for e in self.j['events']}
   return sum(r['id'] not in used for p in self.j['preparationStages'].values() for r in p['operations'])
  def future_spent(self):
   ids={r['id'] for r in self.initial_preparation()}
   return sum(e['lane']=='ui' and not e['cleanup'] and e['operation']['id'] not in ids for e in self.j['events'][26:])
  def continuity_preparation(self,lane,op):
   return op.get('preparation') is True and op.get('key')=='N:preparation' and super().continuity_preparation(lane,op)
  def trial_map_ready(self):
   return self.j['plan'] is not None or self.preparation_complete() and bool(self.j['stages']) and bool(self.j['recoveryBrowser']) and self.counts()[3]+self.remaining_mapped_ui()+self.unspent_preparation()+self.j['futureOrdinaryUi']<=77
  def check(self,lane,op,t,terminal=False):
   key=g['descriptor'](op,lane)
   cleanup=key.startswith(('C:','I:','J:'))
   if lane=='main' and key in native or not cleanup and not terminal and not self.continuity_preparation(lane,op) and not self.preparation_complete():fail()
   if lane=='ui' and not cleanup and not self.continuity_preparation(lane,op) and self.future_spent()>=43:fail()
   if self.continuity_preparation(lane,op):
    ops=self.initial_preparation();used=[e for e in self.j['events'][26:] if e['operation'] in ops]
    if len(used)>=6 or op!=ops[len(used)]:fail()
   return super().check(lane,op,t,terminal)
  def command(self,q):
   if type(q) is not dict:fail()
   name=q.get('op')
   if name=='preparation-ready':
    if q.get('stage')!='rebalanced-resource-preparation' or q.get('operations')!=self.initial_preparation() or q.get('remainingOrdinaryUi')!=43:fail()
   if name=='stage-ready':
    if not exact(q,['op','stage','operations','browserOperations','futureCaps','remainingOrdinaryUi','now']):fail()
    self.current();self.active(q['now']);reserve=q['remainingOrdinaryUi'];rows=q['browserOperations'];group=q['stage']
    if not self.preparation_complete() or not self.j['recoveryBrowser'] or group not in stages or type(rows) is not list or not integer(reserve) or not 0<=reserve<=self.j['futureOrdinaryUi']:fail()
    keys=set(stages[group]);mapped={r.get('key') for r in rows if type(r) is dict}
    if not native.intersection(keys)<=mapped:fail()
    future_native=native-set(self.j['stages'])-keys
    if reserve<len(future_native)+2 or self.future_spent()+self.remaining_mapped_ui()+len(rows)+reserve>43 or self.counts()[3]+self.remaining_mapped_ui()+self.unspent_preparation()+len(rows)+reserve>77:fail()
    result=super().command({k:v for k,v in q.items() if k!='remainingOrdinaryUi'});self.j['futureOrdinaryUi']=reserve;self.persist();return result
   if name=='plan-ready':
    p=q.get('plan',{});rows=p.get('browserOperations',[])
    if type(rows) is not list or not native<={r.get('key') for r in rows if type(r) is dict}:fail()
    used={e['operation']['id'] for e in self.j['events']};future=sum(not r.get('key','').startswith(('C:','I:','J:')) and r.get('id') not in used for r in rows)
    if not self.preparation_complete() or self.future_spent()+future>43 or any(r.get('preparation') is not False for r in rows) or self.counts()[3]+self.unspent_preparation()+future>77:fail()
    result=super().command(q);self.j['futureOrdinaryUi']=0;self.persist();return result
   if name=='settle' and q.get('nativeResultVerified') is True:
    self.current()
    if not exact(q,['op','id','success','now','nativeResultVerified']) or q['success'] is not True or self.j['pending']!=q['id'] or self.j['events'][-1]['lane']!='ui' or self.j['events'][-1]['key'] not in native:fail()
    super().command({k:v for k,v in q.items() if k!='nativeResultVerified'});self.j['events'][-1]['nativeResultVerified']=True;self.persist();return self.view()
   if name=='ui-complete':
    self.current();key=q.get('key');rows=[r for r in (self.j['plan']['browserOperations'] if self.j['plan'] else self.j['stageBrowser']) if r['key']==key];events={e['operation']['id']:e for e in self.j['events']}
    if key not in native or not rows or any(events.get(r['id'],{}).get('nativeResultVerified') is not True for r in rows):fail()
   return super().command(q)
 return RebalancedLedger
