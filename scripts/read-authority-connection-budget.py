"""One exact89 successor; bounded settled readonly tool failures, no remote IO.

Unassigned main5 moves to ordinary UI. HTTP58, independent recoveries21/16,
unused main2/UI1 and spareUI1 remain protected inside232. Old STOPs immutable.
"""
import copy,json,os
from pathlib import Path
DECISION='659f6874e4e7a53558ed3e3bb9c0e69c2783d42465eeb2eb05bbf921d6d8f6c8'
METHODS={'discovery':'inventory','binding':'claim','inventory':'inventory','claim':'claim','wait':'wait','snapshot':'snapshot'}
NEXT={'discovery':'binding','binding':'inventory','inventory':'claim','claim':'wait','wait':'snapshot','snapshot':'complete'}
def connection_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];rawfile=g['rawfile'];record=g['record'];sha=g['sha'];save=g['save_record'];integer=g['integer'];loading=base.__bases__[0]
 class ConnectionLedger(base):
  def validate_connection(self):
   prior,prior_claim=base.validate_incident(self);p=self.cfg['readonlyConnection'];names=['journal','claim','registry','stop','terminal','result']
   if not exact(p,['decisionHash','approval','origin']) or p['decisionHash']!=DECISION or not exact(p['origin'],names):fail()
   raw={k:pin(v)for k,v in p['origin'].items()};j=json.loads(raw['journal']);claim=record(Path(p['origin']['claim']['path']));reg=record(Path(p['origin']['registry']['path']));a=json.loads(pin(p['approval']))
   keys=['source','decisionSha256','ownerAnswer','predecessorSha256','importedSpent','mainLimit','uiOrdinaryLimit','uiRecoveryLimit','combinedLimit','maximumAdditionalPrimitives','qualifiedFailureLimit','recordedAt','executionStarted']
   if not exact(a,keys) or a['source']!='direct-human-approval' or a['decisionSha256']!=DECISION or a['ownerAnswer']!='同意232內調整與兩次唯讀修復' or a['predecessorSha256']!=sha(raw['journal']) or [a[k]for k in ['importedSpent','mainLimit','uiOrdinaryLimit','uiRecoveryLimit','combinedLimit','maximumAdditionalPrimitives','qualifiedFailureLimit']]!=[89,134,82,16,232,8,2] or a['executionStarted'] is not False or not integer(a['recordedAt']) or not j['lastAt']<=a['recordedAt']<=self.cfg['now']:fail()
   stable={k:v for k,v in self.identity.items()if k not in ['sources','ownerHash','readonlyConnection']}
   if not exact(claim,list(stable)+['sources','ownerHash']) or any(claim[k]!=v for k,v in stable.items()) or reg!={'identity':claim,'checkpoint':j}:fail()
   for source in claim['sources']:g['pin'](source)
   old=str(self.path)+'.simple-account-load'
   for k,end in [('journal','.json'),('claim','-claim.json'),('stop','-stop.json')]:
    if sha(rawfile(Path(old+end)))!=sha(raw[k]):fail()
   if json.loads(raw['stop'])!={'source':'live-owner-stop','binding':self.cfg['binding']} and record(Path(p['origin']['stop']['path']))!={'identity':claim}:fail()
   if not exact(j,list(prior)) or j['events'][:35]!=prior['events'] or len(j['events'])!=36 or j['state']!='stopped' or j['lifecycle']!='HARD_STOP' or j['phase']!='PREP' or j['pending'] is not None or j['mutated'] is not False or j['rpc']!={'beganAt':None,'complete':False} or j['w0'] is not None or j['expiresAt'] is not None or j['chargedUpperBoundMs']!=0 or j['failures']!=8 or j['technicalFailures']!=0 or len(j['holders'])!=5 or j['holders'][:4]!=prior['holders'] or j['holder']!=claim['ownerHash'] or j['holders'][-1]!=j['holder']:fail()
   op={'id':'loading-incident-h5-inventory','key':'N:preparation','actor':'publisher','target':'oauth-audience','operation':'inventory','units':1,'preparation':True};e=j['events'][-1]
   if not exact(e,['lane','key','operation','time','outcome','cleanup','settled','success','preparationStage']) or e['operation']!=op or e['preparationStage']!=op['id'] or e['lane']!='ui' or e['key']!='N:preparation' or e['cleanup'] is not False or e['settled'] is not True or e['success'] is not False or e['outcome']!='UNKNOWN':fail()
   l=copy.deepcopy(prior['loading']);l.update(used=6,acquisition='inventory');l['sourceChain'].append({'identitySha256':sha(json.dumps(prior_claim,separators=(',',':')).encode()),'sources':copy.deepcopy(prior_claim['sources'])})
   expected_prep=copy.deepcopy(prior['preparationStages']);expected_prep[op['id']]={'operations':[op],'remainingOrdinaryUi':36}
   if j['loading']!=l or j['preparationStages']!=expected_prep or j['futureOrdinaryUi']!=36 or any(j[k]!=prior[k]for k in ['stages','stageNames','stageBrowser','recoveryBrowser','plan','completed','finished']):fail()
   d=json.loads(raw['terminal']);truth=['latestRegistryMatches','oldStoppedArtifactsUnchanged','lockReleased','pendingNull','allEventsSettled','noMutation','noRpc','noTrialClock','actualAwaitedRunReturned','exactHolderChildAbsent','scopeClosed','stopAcknowledged']
   if d.get('source')!='post-return-account-load-terminal-evidence' or any(d.get(k) is not True for k in truth) or any(d.get(k)!=v for k,v in {'combinedSpent':89,'loadingUsed':6,'lifecycle':'HARD_STOP','phase':'PREP','events':36,'method':'inventory','currentTarget':'oauth-audience','grounded':['thin-settings'],'resumeAuthorized':False}.items()) or d.get('files')!={('actual-result'if k=='result'else k):p['origin'][k]for k in ['journal','claim','registry','stop','result']}:fail()
   r=json.loads(raw['result']);drain=r.get('drain',{})
   if r.get('status')!='HARD_STOP' or r.get('failurePhase')!='INVENTORY' or r.get('observations')!={} or r.get('trialAccepted') is not False or any(drain.get(k) is not True for k in ['stopAcknowledged','ordinaryScopeClosed']) or drain.get('ownedScope')!={'state':'SETTLED'}:fail()
   return j,claim
  def resume_preparation(self,p):
   origin,prior=self.validate_connection();owner=sha(self.cfg['ownerNonce'].encode())
   if p=={'connectionIncident':True}:
    if record(self.registry)!={'identity':prior,'checkpoint':origin} or any(os.path.lexists(path)for path in [self.journal,self.claim,self.stop_path]) or owner in origin['holders']:fail()
    j=copy.deepcopy(origin);j['loading']['maximum']=14;j['connection']={'maximum':8,'used':0,'failures':0,'stage':'discovery','metadataVerified':False,'waitSucceeded':False,'sourceChain':[]}
   else:
    if not exact(p,['receipt','minimumEvents']):fail()
    raw=rawfile(self.journal);regraw=rawfile(self.registry);j=json.loads(raw);prior=record(self.claim)
    if record(self.registry)!={'identity':prior,'checkpoint':j} or p['minimumEvents']!=len(j['events']) or p['receipt']['path']!=str(self.path)+self.suffix+'-handoff-'+str(len(j['holders']))+'.json':fail()
    self.verify_receipt(json.loads(g['pin'](p['receipt'])),j,raw,regraw)
    if {k:v for k,v in prior.items()if k not in ['sources','ownerHash']}!={k:v for k,v in self.identity.items()if k not in ['sources','ownerHash']} or j['events'][:36]!=origin['events'] or j['state']!='ready' or j['lifecycle']!='CLEAN_PAUSE' or j['phase']!='PREP' or j['pending'] is not None or j['mutated'] or j['w0'] is not None or j['rpc']!={'beganAt':None,'complete':False} or os.path.lexists(self.stop_path) or any(e['settled'] is not True for e in j['events']) or owner in j['holders'] or self.cfg['now']<j['lastAt']:fail()
    c=j['connection']
    if len(j['events'])-36!=c['used'] or not 0<=c['used']<=8 or c['failures']>2 or j['loading']['used']!=6+c['used']:fail()
    if c['stage']!='complete':c.update(stage='binding'if c['metadataVerified']else'discovery',waitSucceeded=False)
   for source in prior['sources']:g['pin'](source)
   j['connection']['sourceChain'].append({'identitySha256':sha(json.dumps(prior,separators=(',',':')).encode()),'sources':copy.deepcopy(prior['sources'])});j.update(state='ready',lifecycle='ACTIVE',holder=owner,lastAt=self.cfg['now']);j['holders'].append(owner)
   self.j=j;save(self.claim,self.identity,p=={'connectionIncident':True});self.persist()
  def current(self):self.validate_connection();return super().current()
  def view(self,wait=0):
   v=super().view(wait);c=self.j['connection'];v.update(connectionUsed=c['used'],connectionFaults=c['failures'],connectionStage=c['stage']);return v
  def future_limit(self):return 36
  def ordinary_ceiling(self):return 81
  def check_loading(self,op):
   c=self.j['connection'];stage=c['stage'];expected='loading-connection-n'+str(c['used']+1)+'-'+stage
   if stage not in METHODS or c['used']+{'discovery':6,'binding':5,'inventory':4,'claim':3,'wait':2,'snapshot':1}.get(stage,9)>8 or c['used']>=8 or op['id']!=expected or op['target']!='oauth-audience' or op['operation']!=METHODS[stage] or stage=='snapshot' and not c['waitSucceeded']:fail()
  def command(self,q):
   name=q.get('op')
   if name=='preparation-ready':
    if not exact(q,['op','stage','operations','remainingOrdinaryUi','now']):fail()
    self.current();self.active(q['now']);rows=q['operations']
    if type(rows) is not list or len(rows)!=1 or q['remainingOrdinaryUi']!=36 or q['stage']!=rows[0]['id'] or q['stage'] in self.j['preparationStages'] or self.j['pending'] is not None or not self.continuity_preparation('ui',rows[0]):fail()
    g['descriptor'](rows[0],'ui');self.check_loading(rows[0])
    if self.counts()[3]+self.unspent_preparation()+1+36>81:fail()
    self.j['preparationStages'][q['stage']]={'operations':copy.deepcopy(rows),'remainingOrdinaryUi':36};self.j['futureOrdinaryUi']=36;self.j['lastAt']=q['now'];self.persist();return self.view()
   if name=='settle' and self.j['events'] and self.j['events'][-1].get('preparationStage') and self.j['events'][-1]['lane']=='ui' and self.j['events'][-1]['key']=='N:preparation' and self.j['events'][-1]['operation']['id'].startswith('loading-connection-'):
    self.current();self.now(q.get('now'));c=self.j['connection'];e=self.j['events'][-1];stage=c['stage'];op=e['operation']
    if self.j['pending']!=q.get('id') or e['settled'] or q.get('id')!=op['id']:fail()
    if 'connectionFailure' in q:
     p=q['connectionFailure'];keys=['kind','phase','errorClass','code','pureRead','terminal','fieldsRead']
     if not exact(q,['op','id','success','now','connectionFailure']) or q['success'] is not False or stage=='snapshot' or not exact(p,keys) or p['kind']!='READONLY_TOOL' or p['phase']!=stage or p['errorClass'] not in ['ERROR','TYPE_ERROR','TIMEOUT','UNKNOWN'] or p['code'] not in ['API_REJECTED','BROWSER_UNAVAILABLE','OWNER_CONNECTION_REQUIRED'] or p['pureRead'] is not True or p['terminal'] is not True or p['fieldsRead'] is not False or self.j['mutated'] or self.j['rpc']['beganAt'] is not None:fail()
     e.update(settled=True,success=False,connectionFailure=copy.deepcopy(p));self.j.update(pending=None,lastAt=q['now']);self.j['failures']+=1;self.j['loading']['used']+=1;c['failures']+=1
     if c['failures']>2:self.j.update(state='stopped',lifecycle='HARD_STOP')
    else:
     # Use loading settlement/proof but not the old incident's fixed-four gate.
     result=loading.command(self,q)
    c=self.j['connection'];c['used']+=1
    if q['success'] is True:
     c['stage']=NEXT[stage]
     if stage=='discovery':c['metadataVerified']=True
     if stage=='wait':c['waitSucceeded']=True
    elif stage=='snapshot':self.persist();self.stop()
    elif stage=='claim':c.update(stage='inventory',waitSucceeded=False)
    self.persist();return self.view()
   return super().command(q)
 return ConnectionLedger
