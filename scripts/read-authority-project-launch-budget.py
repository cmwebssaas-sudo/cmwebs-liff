"""Exact100 successor; unknown predecessor return stays unknown. No provider IO."""
import copy,json,os
from pathlib import Path
DECISION='de8bdd4064ca4bedf4ed5c6917d3ea9d3d8f949814710a1cca446f95ef5de670'
STAGES=['binding','inventory','claim','snapshot']
METHODS={'binding':'claim','inventory':'inventory','claim':'claim','snapshot':'snapshot'}
def launch_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];record=g['record'];rawfile=g['rawfile'];sha=g['sha'];save=g['save_record'];integer=g['integer']
 class ProjectLaunchLedger(base):
  launch100=True
  def connection_maximum(self):return 15
  def ordinary_ceiling(self):return 87
  def prepared_checkpoint(self,j):return j.get('projectLaunch')=={'maximum':4,'used':4,'accountVerified':True} and j['connection']['stage']=='complete' and j['ownerConnection']['accountVerified']is True
  def validate_launch(self):
   old99,claim99=self.validate_retarget();p=self.cfg['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99']['launch100'];names=['journal','claim','registry','stop','observation','parentObserver']
   if not exact(p,['decisionHash','approval','origin']) or p['decisionHash']!=DECISION or not exact(p['origin'],names):fail()
   for value in [p['approval']]+list(p['origin'].values()):
    if not exact(value,['path','sha256']):fail()
   raw={k:pin(v)for k,v in p['origin'].items()};j=json.loads(raw['journal']);claim=record(Path(p['origin']['claim']['path']));a=json.loads(pin(p['approval']))
   keys=['source','questionCall','answer','decisionSha256','recordedAt','operationBudget','retainedSpent','selectedBrowserId','scope','executionStarted']
   if not exact(a,keys) or a['source']!='direct-human-question-reply' or a['answer']!='同意本地啟動修復及235上限' or a['decisionSha256']!=DECISION or a['operationBudget']!=235 or a['retainedSpent']!=100 or a['selectedBrowserId']!='6' or a['scope']!='FOUR_READONLY_STEPS_EXACT100_NEW_ENTRY_ONLY' or a['executionStarted']is not False or type(a['questionCall'])is not str or not 0<len(a['questionCall'])<=200 or not integer(a['recordedAt']) or not j['lastAt']<=a['recordedAt']<=self.cfg['now']:fail()
   stable=copy.deepcopy(self.identity);stable.pop('sources');stable.pop('ownerHash');stable['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99'].pop('launch100')
   if not exact(claim,list(stable)+['sources','ownerHash']) or any(claim[k]!=v for k,v in stable.items()) or record(Path(p['origin']['registry']['path']))!={'identity':claim,'checkpoint':j} or record(Path(p['origin']['stop']['path']))!={'identity':claim}:fail()
   for s in claim['sources']:g['pin'](s)
   old=str(self.path)+'.simple-project-retarget'
   for k,end in [('journal','.json'),('claim','-claim.json'),('stop','-stop.json')]:
    if sha(rawfile(Path(old+end)))!=sha(raw[k]):fail()
   op={'id':'loading-retarget99-n11-binding','key':'N:preparation','actor':'publisher','target':'thin-settings','operation':'claim','units':1,'preparation':True};e=j['events'][-1]
   if not exact(e,['lane','key','operation','time','outcome','cleanup','settled','success','preparationStage']) or e['operation']!=op or e['lane']!='ui' or e['key']!='N:preparation' or e['preparationStage']!=op['id'] or e['cleanup']is not False or e['settled']is not True or e['success']is not False or e['outcome']!='UNKNOWN' or not integer(e['time']) or not old99['lastAt']<=e['time']<=j['lastAt']:fail()
   c=copy.deepcopy(old99['connection']);c.update(maximum=14,used=11,stage='binding');c['sourceChain'].append({'identitySha256':sha(json.dumps(claim99,separators=(',',':')).encode()),'sources':copy.deepcopy(claim99['sources'])});l=copy.deepcopy(old99['loading']);l.update(maximum=20,used=17);ps=copy.deepcopy(old99['preparationStages']);ps[op['id']]={'operations':[op],'remainingOrdinaryUi':36}
   changed=['events','connection','loading','preparationStages','projectRetarget','holder','holders','lastAt','failures']
   if not exact(j,list(old99)+['projectRetarget']) or any(j[k]!=old99[k]for k in old99 if k not in changed) or j['events'][:46]!=old99['events'] or len(j['events'])!=47 or j['connection']!=c or j['loading']!=l or j['preparationStages']!=ps or j['projectRetarget']!={'maximum':4,'used':1,'accountVerified':False} or j['failures']!=15 or len(j['holders'])!=14 or j['holders'][:13]!=old99['holders'] or len(set(j['holders']))!=14 or j['holder']!=claim['ownerHash'] or j['holders'][-1]!=j['holder'] or j['ownerConnection']['selected']['browserId']!='6' or j['lastAt']<old99['lastAt']:fail()
   d=json.loads(raw['observation']);expected={'source':'post-return-launch100-state-observation-not-run-receipt','actualSpent':100,'mainSpent':53,'uiSpent':47,'combinedLimit':234,'events':47,'allEventsSettled':True,'pendingNull':True,'lifecycle':'HARD_STOP','retargetUsed':1,'retargetAccountVerified':False,'connectionUsed':11,'connectionFaults':2,'loadingUsed':17,'runReturnReceiptCaptured':False,'canonicalOutcome':'UNKNOWN','parentBridgeCallsObserved':0,'trialAccepted':False,'completeActualMapProven':False,'noMutation':True,'noRpc':True,'noTrialClock':True}
   if not exact(d,list(expected)+['artifacts']) or any(type(d[k])is not type(v) or d[k]!=v for k,v in expected.items()):fail()
   artifact_names=['journal','claim','stop','registry','launch-local-observer.json','launch-repair-local-proof.json','incident-independent-review.md','preclaim-admission.json'];art=d['artifacts']
   if not exact(art,artifact_names):fail()
   canonical={'journal':old+'.json','claim':old+'-claim.json','stop':old+'-stop.json','registry':str(self.registry)}
   for k,v in art.items():
    if not exact(v,['path','sha256']+(['livePath']if k in canonical else[])):fail()
    value=pin(v)
    if k in canonical and (v['livePath']!=canonical[k] or v['path']!=p['origin'][k]['path'] or sha(value)!=sha(raw[k])):fail()
   observer=json.loads(raw['parentObserver']);observer_expected={'source':'parent-cua-local-launch-observer','browserBindingAttempts':0,'ioAllowed':False,'promiseBindingPresent':False,'resultBindingPresent':False,'providerInvocationReached':False,'canonicalEventOutcome':'UNKNOWN','returnedRunReceiptCaptured':False,'errors':['LOCAL_FS_CALLBACK_INTERFACE','UNDECLARED_PROMISE_ASSIGNMENT'],'newExecutionOrRetry':False}
   if art['launch-local-observer.json']!=p['origin']['parentObserver'] or not exact(observer,list(observer_expected)+['observedAt']) or any(type(observer[k])is not type(v) or observer[k]!=v for k,v in observer_expected.items()) or type(observer['observedAt'])is not str or not 0<len(observer['observedAt'])<=100:fail()
   proof=json.loads(pin(art['launch-repair-local-proof.json']));proof_expected={'source':'actual-cua-local-only-launch-proof','separatePreludeBindingsVerified':True,'singleMockInvocation':True,'promiseRetained':True,'resultStored':True,'gateClosed':True,'replayBlocked':True,'providerIo':0,'debits':0,'actualEntryInvoked':False}
   if not exact(proof,list(proof_expected)+['observedAt']) or any(type(proof[k])is not type(v) or proof[k]!=v for k,v in proof_expected.items()) or type(proof['observedAt'])is not str or not 0<len(proof['observedAt'])<=100:fail()
   return j,claim
  def resume_preparation(self,p):
   origin,prior=self.validate_launch();owner=sha(self.cfg['ownerNonce'].encode());fresh=p=={'launch100':True}
   if fresh:
    if record(self.registry)!={'identity':prior,'checkpoint':origin} or any(os.path.lexists(x)for x in [self.journal,self.claim,self.stop_path]) or owner in origin['holders']:fail()
    j=copy.deepcopy(origin);j['connection'].update(maximum=15,stage='binding');j['loading']['maximum']=21;j['projectLaunch']={'maximum':4,'used':0,'accountVerified':False}
   else:
    if not exact(p,['receipt','minimumEvents']):fail()
    raw=rawfile(self.journal);rr=rawfile(self.registry);j=json.loads(raw);prior=record(self.claim)
    if record(self.registry)!={'identity':prior,'checkpoint':j} or p['minimumEvents']!=len(j['events']) or p['receipt']['path']!=str(self.path)+self.suffix+'-handoff-'+str(len(j['holders']))+'.json':fail()
    self.verify_receipt(json.loads(g['pin'](p['receipt'])),j,raw,rr)
    if {k:v for k,v in prior.items()if k not in ['sources','ownerHash']}!={k:v for k,v in self.identity.items()if k not in ['sources','ownerHash']} or j['events'][:47]!=origin['events'] or len(j['events'])!=51 or j['state']!='ready' or j['lifecycle']!='CLEAN_PAUSE' or not self.prepared_checkpoint(j) or j['connection']['used']!=15 or j['loading']['used']!=21 or j['projectRetarget']!=origin['projectRetarget'] or j['inventoryDiagnostic']!=origin['inventoryDiagnostic'] or j['phase']!='PREP' or j['pending']is not None or j['mutated'] or j['w0']is not None or j['rpc']!={'beganAt':None,'complete':False} or os.path.lexists(self.stop_path) or any(e['settled']is not True or e['success']is not True for e in j['events'][47:]) or owner in j['holders'] or self.cfg['now']<j['lastAt']:fail()
   for s in prior['sources']:g['pin'](s)
   j['connection']['sourceChain'].append({'identitySha256':sha(json.dumps(prior,separators=(',',':')).encode()),'sources':copy.deepcopy(prior['sources'])});j.update(state='ready',lifecycle='ACTIVE',holder=owner,lastAt=self.cfg['now']);j['holders'].append(owner);self.j=j;save(self.claim,self.identity,fresh);self.persist()
  def current(self):self.validate_launch();return super().current()
  def view(self,wait=0):
   v=super().view(wait);d=self.j['projectLaunch'];v.update(uiOrdinaryLimit=87,uiLimit=103,combinedLimit=235,launchUsed=d['used'],launchAccountVerified=d['accountVerified']);return v
  def check_loading(self,op):
   c=self.j['connection'];d=self.j['projectLaunch'];n=d['used'];stage=c['stage']
   if n>=4 or stage!=STAGES[n] or c['used']!=11+n or self.j['loading']['used']!=17+n or c['used']>=15 or op!={'id':'loading-launch100-n'+str(c['used']+1)+'-'+stage,'key':'N:preparation','actor':'publisher','target':'thin-settings','operation':METHODS[stage],'units':1,'preparation':True}:fail()
  def command(self,q):
   name=q.get('op');e=self.j['events'][-1]if self.j['events']else{}
   if name=='settle' and e.get('preparationStage') and e.get('lane')=='ui' and e.get('key')=='N:preparation' and e['operation'].get('preparation')is True and e['operation']['id'].startswith('loading-launch100-'):
    self.current();self.now(q.get('now'));e=self.j['events'][-1];self.check_loading(e['operation']);success=q.get('success');stage=self.j['connection']['stage'];extra=['inventoryClassification']if stage=='inventory'else ['loadingResultVerified']if success and stage=='snapshot'else[]
    if type(success)is not bool or not exact(q,['op','id','success','now']+extra) or q['id']!=e['operation']['id'] or self.j['pending']!=q['id'] or e['settled']is not False:fail()
    if stage=='inventory':
     d=q['inventoryClassification'];keys=['source','status','rowCount','invalidRows','accessors','proxies','duplicateIds','providerIdMissing','opaqueIdMissing','exactUrlMatches','rawValuesRetained']
     if not exact(d,keys) or d['source']!='readonly-project-inventory-v1' or d['status']not in ['API_REJECTED','OPTIONS_INVALID','ROOT_PROXY','ROOT_NOT_ARRAY','ARRAY_SHAPE','METADATA_INVALID','DUPLICATE_ID','URL_MISMATCH','VERIFIED','RESULT_UNVERIFIED'] or d['rawValuesRetained']is not False or any(not integer(d[k])or not 0<=d[k]<=9600 for k in keys if k not in ['source','status','rawValuesRetained']) or success!=(d['status']=='VERIFIED'):fail()
     if success and (not 1<=d['rowCount']<=300 or not 1<=d['exactUrlMatches']<=d['rowCount'] or any(d[k]!=0 for k in ['invalidRows','accessors','proxies','duplicateIds','providerIdMissing','opaqueIdMissing'])):fail()
     e['inventoryClassification']=copy.deepcopy(d)
    if success and stage=='snapshot':
     if q['loadingResultVerified']is not True:fail()
     self.j['projectLaunch']['accountVerified']=True;self.j['ownerConnection']['accountVerified']=True;e['loadingResultVerified']=True
    e.update(settled=True,success=success);self.j.update(pending=None,lastAt=q['now']);self.j['connection']['used']+=1;self.j['loading']['used']+=1;self.j['projectLaunch']['used']+=1
    if success:self.j['connection']['stage']=STAGES[self.j['projectLaunch']['used']]if self.j['projectLaunch']['used']<4 else'complete'
    else:self.j['failures']+=1
    self.persist()
    if not success:self.stop()
    return self.view()
   return super().command(q)
 return ProjectLaunchLedger
