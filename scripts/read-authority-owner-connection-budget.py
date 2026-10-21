"""Exact94 successor: owner-selected Chrome, six reads,132+84+16=232.

No provider IO is performed here. Discovery pauses for a direct human choice;
account credit requires the final proved snapshot after a successful wait.
"""
import copy,json,os,re
from pathlib import Path
DECISION='710fc0a4ff12766c997377a73e8d40f3314722b99b674d0f0fd741a7a96a6b31'
METHODS={'discovery':'inventory','binding':'claim','inventory':'inventory','claim':'claim','wait':'wait','snapshot':'snapshot'}
NEXT={'discovery':'binding','binding':'inventory','inventory':'claim','claim':'wait','wait':'snapshot','snapshot':'complete'}
def owner_connection_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];rawfile=g['rawfile'];record=g['record'];sha=g['sha'];save=g['save_record'];integer=g['integer'];connection=base.__bases__[0].__bases__[0]
 def candidates(value):
  if type(value)is not list or len(value)>100:fail()
  seen=set()
  for row in value:
   if type(row)is not dict or not exact(row,['id','name','type']+(['profileName']if 'profileName'in row else [])) or row['name']!='Chrome' or row['type']!='extension':fail()
   ident=row['id']
   if type(ident)is not str or not 0<len(ident)<=200 or re.search(r'[\s\x00-\x1f\x7f]',ident) or ident in seen:fail()
   if 'profileName'in row and (type(row['profileName'])is not str or len(row['profileName'])>200 or re.search(r'[\x00-\x1f\x7f]',row['profileName'])):fail()
   seen.add(ident)
  return value
 class OwnerConnectionLedger(base):
  owner_connection=True
  def connection_maximum(self):return 11
  def ordinary_ceiling(self):return 84
  def preparation_complete(self):return self.j.get('ownerConnection',{}).get('accountVerified')is True and self.j['connection']['stage']=='complete'
  def validate_owner(self):
   old93,claim93=self.validate_diagnostic();p=self.cfg['readonlyConnection']['repair92']['diagnostic93']['owner94'];names=['journal','claim','registry','stop','terminal','result']
   if not exact(p,['decisionHash','approval','origin']) or p['decisionHash']!=DECISION or not exact(p['origin'],names):fail()
   raw={k:pin(v)for k,v in p['origin'].items()};j=json.loads(raw['journal']);claim=record(Path(p['origin']['claim']['path']));reg=record(Path(p['origin']['registry']['path']));a=json.loads(pin(p['approval']))
   keys=['source','decisionSha256','ownerAnswer','predecessorSha256','importedSpent','importedMainSpent','importedUiSpent','mainLimit','uiOrdinaryLimit','uiRecoveryLimit','combinedLimit','maximumNewPrimitives','connectionMaximum','loadingMaximum','qualifiedFailureLimit','recordedAt','executionStarted']
   if not exact(a,keys) or a['source']!='direct-human-approval' or a['decisionSha256']!=DECISION or a['ownerAnswer']!='同意六步接續，維持232（建議）' or a['predecessorSha256']!=sha(raw['journal']) or [a[k]for k in ['importedSpent','importedMainSpent','importedUiSpent','mainLimit','uiOrdinaryLimit','uiRecoveryLimit','combinedLimit','maximumNewPrimitives','connectionMaximum','loadingMaximum','qualifiedFailureLimit']]!=[94,53,41,132,84,16,232,6,11,17,2] or a['executionStarted']is not False or not integer(a['recordedAt']) or not j['lastAt']<=a['recordedAt']<=self.cfg['now']:fail()
   stable=copy.deepcopy(self.identity);stable.pop('sources');stable.pop('ownerHash');stable['readonlyConnection']['repair92']['diagnostic93'].pop('owner94')
   if not exact(claim,list(stable)+['sources','ownerHash']) or any(claim[k]!=v for k,v in stable.items()) or reg!={'identity':claim,'checkpoint':j}:fail()
   for source in claim['sources']:g['pin'](source)
   old=str(self.path)+'.simple-metadata-diagnostic'
   for k,end in [('journal','.json'),('claim','-claim.json'),('stop','-stop.json')]:
    if sha(rawfile(Path(old+end)))!=sha(raw[k]):fail()
   if json.loads(raw['stop'])!={'source':'live-owner-stop','binding':self.cfg['binding']} and record(Path(p['origin']['stop']['path']))!={'identity':claim}:fail()
   if not exact(j,list(old93)+['metadataDiagnostic']) or j['events'][:40]!=old93['events'] or len(j['events'])!=41 or j['state']!='stopped' or j['lifecycle']!='HARD_STOP' or j['phase']!='PREP' or j['pending']is not None or j['mutated']is not False or j['rpc']!={'beganAt':None,'complete':False} or j['w0']is not None or j['expiresAt']is not None or j['chargedUpperBoundMs']!=0 or j['failures']!=12 or j['technicalFailures']!=0 or len(j['holders'])!=10 or j['holders'][:9]!=old93['holders'] or len(set(j['holders']))!=10 or j['holder']!=claim['ownerHash'] or j['holders'][-1]!=j['holder']:fail()
   op={'id':'loading-diagnostic93-discovery','key':'N:preparation','actor':'publisher','target':'oauth-audience','operation':'inventory','units':1,'preparation':True};e=j['events'][-1]
   if not exact(e,['lane','key','operation','time','outcome','cleanup','settled','success','preparationStage','metadataShapeVerified']) or e['operation']!=op or e['preparationStage']!=op['id'] or e['lane']!='ui' or e['key']!='N:preparation' or e['cleanup']is not False or e['settled']is not True or e['success']is not True or e['metadataShapeVerified']is not True or e['outcome']!='UNKNOWN':fail()
   c=copy.deepcopy(old93['connection']);c['used']=5;c['sourceChain'].append({'identitySha256':sha(json.dumps(claim93,separators=(',',':')).encode()),'sources':copy.deepcopy(claim93['sources'])});l=copy.deepcopy(old93['loading']);l['used']=11;ps=copy.deepcopy(old93['preparationStages']);ps[op['id']]={'operations':[op],'remainingOrdinaryUi':36}
   if j['connection']!=c or j['loading']!=l or j['preparationStages']!=ps or j['metadataDiagnostic']!={'maximum':1,'used':1,'complete':True} or j['futureOrdinaryUi']!=36 or any(j[k]!=old93[k]for k in ['stages','stageNames','stageBrowser','recoveryBrowser','plan','completed','finished']):fail()
   d=json.loads(raw['terminal']);r=json.loads(raw['result']);drain=r.get('drain',{});truth=['allIoSettled','pendingNull','scopeClosed','lockReleased','noMutation','noRpc','noTrialClock','old93ArtifactsUnchanged','diagnosticComplete']
   if d.get('source')!='post-return-metadata-shape-terminal-evidence' or any(d.get(k)is not True for k in truth) or any(d.get(k)!=v for k,v in {'actualSpent':94,'mainSpent':53,'uiSpent':41,'phase':'PREP','lifecycle':'HARD_STOP','connectionUsed':5,'connectionMaximum':9,'connectionFaults':2,'loadingUsed':11,'loadingMaximum':15,'diagnosticUsed':1,'allHistoricalPinsUnchanged':101,'browserIdentityVerified':False,'followupAuthorized':False,'status':'SHAPE_CAPTURED'}.items()) or d.get('files')!={k:p['origin'][k]for k in ['journal','claim','registry','stop','result']}:fail()
   if r.get('status')!='SHAPE_CAPTURED' or r.get('shape')!=d.get('shape') or any(r.get(k)is not False for k in ['trialAccepted','browserIdentityVerified','followupAuthorized']) or any(drain.get(k)is not True for k in ['stopAcknowledged','ordinaryScopeClosed']) or drain.get('ownedScope')!={'state':'SETTLED'}:fail()
   return j,claim
  def resume_preparation(self,p):
   origin,prior=self.validate_owner();owner=sha(self.cfg['ownerNonce'].encode());fresh=p=={'ownerConnection94':True}
   if fresh:
    if record(self.registry)!={'identity':prior,'checkpoint':origin} or any(os.path.lexists(path)for path in [self.journal,self.claim,self.stop_path]) or owner in origin['holders']:fail()
    j=copy.deepcopy(origin);j['connection']['maximum']=11;j['loading']['maximum']=17;j['loading'].update(currentTarget='thin-settings',acquisition='inventory');j['ownerConnection']={'candidates':None,'selected':None,'accountVerified':False}
   else:
    if not exact(p,['receipt','minimumEvents']):fail()
    raw=rawfile(self.journal);rr=rawfile(self.registry);j=json.loads(raw);prior=record(self.claim)
    if record(self.registry)!={'identity':prior,'checkpoint':j} or p['minimumEvents']!=len(j['events']) or p['receipt']['path']!=str(self.path)+self.suffix+'-handoff-'+str(len(j['holders']))+'.json':fail()
    self.verify_receipt(json.loads(g['pin'](p['receipt'])),j,raw,rr)
    if {k:v for k,v in prior.items()if k not in ['sources','ownerHash']}!={k:v for k,v in self.identity.items()if k not in ['sources','ownerHash']} or j['events'][:41]!=origin['events'] or j['state']!='ready' or j['lifecycle']!='CLEAN_PAUSE' or j['phase']!='PREP' or j['pending']is not None or j['mutated'] or j['w0']is not None or j['rpc']!={'beganAt':None,'complete':False} or os.path.lexists(self.stop_path) or any(e['settled']is not True for e in j['events']) or owner in j['holders'] or self.cfg['now']<j['lastAt']:fail()
    if not (j['connection']['stage']=='binding' and j['ownerConnection']['selected']is None or self.prepared_checkpoint(j)):fail()
    if len(j['events'])-41!=j['connection']['used']-5 or not 5<=j['connection']['used']<=11 or j['connection']['failures']!=2 or j['loading']['used']!=11+j['connection']['used']-5:fail()
   for source in prior['sources']:g['pin'](source)
   self.owner_selection_not_before=j['lastAt'];j['connection']['sourceChain'].append({'identitySha256':sha(json.dumps(prior,separators=(',',':')).encode()),'sources':copy.deepcopy(prior['sources'])});j.update(state='ready',lifecycle='ACTIVE',holder=owner,lastAt=self.cfg['now']);j['holders'].append(owner);self.j=j;save(self.claim,self.identity,fresh);self.persist()
  def prepared_checkpoint(self,j):return j['connection']['stage']=='complete' and j['ownerConnection']['accountVerified']is True
  def current(self):self.validate_owner();return super().current()
  def view(self,wait=0):
   v=super().view(wait);v.update(mainLimit=132,uiOrdinaryLimit=84,uiRecoveryLimit=16,ownerSelected=self.j['ownerConnection']['selected']is not None,ownerAccountVerified=self.j['ownerConnection']['accountVerified']);return v
  def check_loading(self,op):
   c=self.j['connection'];stage=c['stage'];expected={'id':'loading-owner94-n'+str(c['used']+1)+'-'+stage,'key':'N:preparation','actor':'publisher','target':'thin-settings','operation':METHODS.get(stage),'units':1,'preparation':True}
   if stage not in METHODS or c['used']>=11 or op!=expected or c['used']+{'discovery':6,'binding':5,'inventory':4,'claim':3,'wait':2,'snapshot':1}[stage]>11 or stage!='discovery' and self.j['ownerConnection']['selected']is None or stage=='snapshot' and not c['waitSucceeded']:fail()
  def command(self,q):
   name=q.get('op')
   if name=='owner-selected':
    self.current();self.active(q.get('now'));s=q.get('selection');o=self.j['ownerConnection']
    if not exact(q,['op','selection','now']) or not exact(s,['browserId','approval']) or self.j['pending']is not None or self.j['connection']['stage']!='binding' or o['selected']is not None or not any(r['id']==s['browserId']for r in (o['candidates']or [])):fail()
    a=json.loads(pin(s['approval']));keys=['source','browserId','ownerAnswer','candidatesSha256','recordedAt','executionStarted']
    if not exact(a,keys) or a['source']!='direct-human-connection-selection' or a['browserId']!=s['browserId'] or a['ownerAnswer']!='使用連線 '+s['browserId'] or a['candidatesSha256']!=sha(g['compact'](o['candidates']).encode()) or not integer(a['recordedAt']) or not self.owner_selection_not_before<=a['recordedAt']<=q['now'] or a['executionStarted']is not False:fail()
    o['selected']=copy.deepcopy(s);self.j['lastAt']=q['now'];self.persist();return self.view()
   if name=='pause-preparation':
    self.current();self.active(q.get('now'))
    if not exact(q,['op','now']) or self.j['pending']is not None or not(self.j['connection']['stage']=='binding' and self.j['ownerConnection']['selected']is None or self.preparation_complete()):fail()
    self.j.update(lifecycle='CLEAN_PAUSE',lastAt=q['now']);self.persist();return self.view()
   if name in ['plan-ready','stage-ready','recovery-ready']:
    origin,_=self.validate_owner();used={e['operation']['id']for e in origin['events']};reserved={r['id']for p in origin['preparationStages'].values()for r in p['operations']if r['id']not in used and r['id']not in origin['loading']['superseded']};payload=q.get('plan',{})if name=='plan-ready'else q
    if any(r.get('id')in reserved for r in payload.get('operations',[])+payload.get('browserOperations',[])):fail()
   if name=='settle' and self.j['events'] and self.j['events'][-1].get('preparationStage') and self.j['events'][-1]['lane']=='ui' and self.j['events'][-1]['operation']['id'].startswith('loading-owner94-'):
    self.current();self.now(q.get('now'));e=self.j['events'][-1];self.check_loading(e['operation']);success=q.get('success');stage=self.j['connection']['stage'];extra=['ownerCandidates']if success and stage=='discovery'else ['loadingResultVerified']if success and stage=='snapshot'else []
    if type(success)is not bool or not exact(q,['op','id','success','now']+extra) or q['id']!=e['operation']['id'] or self.j['pending']!=q['id'] or e['settled']is not False:fail()
    if success and stage=='discovery':self.j['ownerConnection']['candidates']=copy.deepcopy(candidates(q['ownerCandidates']));self.owner_selection_not_before=q['now']
    if success and stage=='snapshot':
     if q['loadingResultVerified']is not True:fail()
     self.j['ownerConnection']['accountVerified']=True;e['loadingResultVerified']=True
    e.update(settled=True,success=success);self.j.update(pending=None,lastAt=q['now']);self.j['connection']['used']+=1;self.j['loading']['used']+=1
    if success:
     self.j['connection']['stage']=NEXT[stage]
     if stage=='discovery':self.j['connection']['metadataVerified']=True
     if stage=='wait':self.j['connection']['waitSucceeded']=True
    else:self.j['failures']+=1
    self.persist()
    if not success:self.stop()
    return self.view()
   return connection.command(self,q)
 return OwnerConnectionLedger
