"""Exact99 four-step successor. No IO; historical STOPs and sources retained."""
import copy,json,os
from pathlib import Path
DECISION='2deec8acafeb444f258ba2ecdddb2cda65c81db5f1ecba032584348e9479b963'
STAGES=['binding','inventory','claim','snapshot']
METHODS={'binding':'claim','inventory':'inventory','claim':'claim','snapshot':'snapshot'}
CLASS_KEYS=['source','status','rowCount','invalidRows','accessors','proxies','duplicateIds','providerIdMissing','opaqueIdMissing','exactUrlMatches','rawValuesRetained']
STATUSES=['API_REJECTED','OPTIONS_INVALID','ROOT_PROXY','ROOT_NOT_ARRAY','ARRAY_SHAPE','METADATA_INVALID','DUPLICATE_ID','URL_MISMATCH','VERIFIED','RESULT_UNVERIFIED']
def retarget_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];record=g['record'];rawfile=g['rawfile'];sha=g['sha'];save=g['save_record'];integer=g['integer']
 class ProjectRetargetLedger(base):
  retarget99=True
  def connection_maximum(self):return 14
  def ordinary_ceiling(self):return 86
  def preparation_complete(self):return self.prepared_checkpoint(self.j)
  def prepared_checkpoint(self,j):return j.get('projectRetarget')=={'maximum':4,'used':4,'accountVerified':True} and j['connection']['stage']=='complete' and j['ownerConnection']['accountVerified']is True
  def validate_retarget(self):
   old97,claim97=self.validate_inventory();p=self.cfg['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99'];names=['journal','claim','registry','stop','terminal','result']
   if not exact(p,['decisionHash','approval','origin']+(['launch100']if getattr(self,'launch100',False)else[])) or p['decisionHash']!=DECISION or not exact(p['origin'],names):fail()
   raw={k:pin(v)for k,v in p['origin'].items()};j=json.loads(raw['journal']);claim=record(Path(p['origin']['claim']['path']));reg=record(Path(p['origin']['registry']['path']));a=json.loads(pin(p['approval']))
   keys=['source','questionCall','answer','decisionSha256','recordedAt','operationBudget','retainedSpent','selectedBrowserId','scope','executionStarted']
   if not exact(a,keys) or a['source']!='direct-human-question-reply' or a['answer']!='同意同專案分頁接續及234上限（建議）' or a['decisionSha256']!=DECISION or a['operationBudget']!=234 or a['retainedSpent']!=99 or a['selectedBrowserId']!=j['ownerConnection']['selected']['browserId'] or a['scope']!='FOUR_READONLY_STEPS_EXACT_PROJECT_URL_NEW_ENTRY_ONLY' or a['executionStarted']is not False or type(a['questionCall'])is not str or not 0<len(a['questionCall'])<=200 or not integer(a['recordedAt']) or not j['lastAt']<=a['recordedAt']<=self.cfg['now']:fail()
   stable=copy.deepcopy(self.identity);stable.pop('sources');stable.pop('ownerHash');stable['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97'].pop('retarget99')
   if not exact(claim,list(stable)+['sources','ownerHash']) or any(claim[k]!=v for k,v in stable.items()) or reg!={'identity':claim,'checkpoint':j}:fail()
   for s in claim['sources']:g['pin'](s)
   old=str(self.path)+'.simple-inventory-diagnostic'
   for k,end in [('journal','.json'),('claim','-claim.json'),('stop','-stop.json')]:
    if sha(rawfile(Path(old+end)))!=sha(raw[k]):fail()
   if record(Path(p['origin']['stop']['path']))!={'identity':claim}:fail()
   if not exact(j,list(old97)+['inventoryDiagnostic']) or j['events'][:44]!=old97['events'] or len(j['events'])!=46 or j['state']!='stopped' or j['lifecycle']!='HARD_STOP' or j['phase']!='PREP' or j['pending']is not None or j['mutated']is not False or j['w0']is not None or j['expiresAt']is not None or j['rpc']!={'beganAt':None,'complete':False} or j['chargedUpperBoundMs']!=0 or j['failures']!=14 or j['technicalFailures']!=0 or len(j['holders'])!=13 or j['holders'][:12]!=old97['holders'] or len(set(j['holders']))!=13 or j['holder']!=claim['ownerHash'] or j['holders'][-1]!=j['holder']:fail()
   ps=copy.deepcopy(old97['preparationStages']);at=old97['lastAt']
   classification={'source':'readonly-tab-inventory-v1','status':'ORIGINAL_MATCH_COUNT','rowCount':5,'invalidRows':0,'accessors':0,'proxies':0,'duplicateIds':0,'providerIdMissing':0,'originalMatches':0,'exactUrlMatches':0,'rawValuesRetained':False}
   for n,stage in enumerate(STAGES[:2],9):
    op={'id':'loading-inventory97-n'+str(n)+'-'+stage,'key':'N:preparation','actor':'publisher','target':'thin-settings','operation':METHODS[stage],'units':1,'preparation':True};e=j['events'][n+35];ps[op['id']]={'operations':[op],'remainingOrdinaryUi':36}
    if not exact(e,['lane','key','operation','time','outcome','cleanup','settled','success','preparationStage']+(['inventoryClassification']if stage=='inventory'else[])) or e['operation']!=op or e['lane']!='ui' or e['key']!='N:preparation' or e['preparationStage']!=op['id'] or e['cleanup']is not False or e['settled']is not True or e['success']is not(stage=='binding') or e['outcome']!='UNKNOWN' or not integer(e['time']) or not at<=e['time']<=j['lastAt']:fail()
    if stage=='inventory' and e['inventoryClassification']!=classification:fail()
    at=e['time']
   c=copy.deepcopy(old97['connection']);c.update(maximum=12,used=10,stage='inventory');c['sourceChain'].append({'identitySha256':sha(json.dumps(claim97,separators=(',',':')).encode()),'sources':copy.deepcopy(claim97['sources'])});l=copy.deepcopy(old97['loading']);l.update(maximum=18,used=16);l['superseded'].append('continuity-settings-navigate')
   if j['connection']!=c or j['loading']!=l or j['preparationStages']!=ps or j['inventoryDiagnostic']!={'maximum':4,'used':2,'accountVerified':False,'releasedUnusedId':'continuity-settings-navigate'} or j['ownerConnection']!=old97['ownerConnection'] or any(j[k]!=old97[k]for k in ['stages','stageNames','stageBrowser','recoveryBrowser','plan','completed','finished','futureOrdinaryUi']):fail()
   d=json.loads(raw['terminal']);r=json.loads(raw['result']);truth=['allIoSettled','pendingNull','scopeClosed','lockReleased','registryClaimStopExact','prior97CanonicalUnchanged','connection6Bound','inventoryApiSucceeded','tabClosedOrReidentifiedUnknown','noMutation','noRpc','noTrialClock'];expected={'source':'post-return-inventory99-terminal','actualSpent':99,'mainSpent':53,'uiSpent':46,'combinedLimit':232,'lifecycle':'HARD_STOP','events':46,'validInventoryRows':5,'originalAMatches':0,'failureCauseEstablished':'ORIGINAL_A_NOT_IN_FRESH_INVENTORY','claimAttempted':False,'snapshotAttempted':False,'trialAccepted':False,'retryAuthorized':False}
   if any(d.get(k)!=v for k,v in expected.items()) or any(d.get(k)is not True for k in truth):fail()
   canonical={'journal':old+'.json','claim':old+'-claim.json','stop':old+'-stop.json','registry':str(self.registry)}
   if type(d.get('artifacts'))is not list or len(d['artifacts'])!=4 or {v.get('path'):v.get('sha256')for v in d['artifacts']if type(v)is dict}!={canonical[k]:sha(raw[k])for k in canonical}:fail()
   if r.get('status')!='HARD_STOP' or r.get('failurePhase')!='INVENTORY' or r.get('classification')!=classification or r.get('snapshot')is not None or r.get('report')is not None or r.get('trialAccepted')is not False or r.get('completeActualMapProven')is not False or any(r.get('drain',{}).get(k)is not True for k in ['stopAcknowledged','ordinaryScopeClosed']) or r.get('drain',{}).get('ownedScope')!={'state':'SETTLED'}:fail()
   return j,claim
  def resume_preparation(self,p):
   origin,prior=self.validate_retarget();owner=sha(self.cfg['ownerNonce'].encode());fresh=p=={'retarget99':True}
   if fresh:
    if record(self.registry)!={'identity':prior,'checkpoint':origin} or any(os.path.lexists(x)for x in [self.journal,self.claim,self.stop_path]) or owner in origin['holders']:fail()
    j=copy.deepcopy(origin);j['connection'].update(maximum=14,stage='binding');j['loading']['maximum']=20;j['projectRetarget']={'maximum':4,'used':0,'accountVerified':False}
   else:
    if not exact(p,['receipt','minimumEvents']):fail()
    raw=rawfile(self.journal);rr=rawfile(self.registry);j=json.loads(raw);prior=record(self.claim)
    if record(self.registry)!={'identity':prior,'checkpoint':j} or p['minimumEvents']!=len(j['events']) or p['receipt']['path']!=str(self.path)+self.suffix+'-handoff-'+str(len(j['holders']))+'.json':fail()
    self.verify_receipt(json.loads(g['pin'](p['receipt'])),j,raw,rr)
    if {k:v for k,v in prior.items()if k not in ['sources','ownerHash']}!={k:v for k,v in self.identity.items()if k not in ['sources','ownerHash']} or j['events'][:46]!=origin['events'] or len(j['events'])!=50 or j['state']!='ready' or j['lifecycle']!='CLEAN_PAUSE' or not self.prepared_checkpoint(j) or j['connection']['used']!=14 or j['loading']['used']!=20 or j['inventoryDiagnostic']!=origin['inventoryDiagnostic'] or j['phase']!='PREP' or j['pending']is not None or j['mutated'] or j['w0']is not None or j['rpc']!={'beganAt':None,'complete':False} or os.path.lexists(self.stop_path) or any(e['settled']is not True or e['success']is not True for e in j['events'][46:]) or owner in j['holders'] or self.cfg['now']<j['lastAt']:fail()
   for s in prior['sources']:g['pin'](s)
   j['connection']['sourceChain'].append({'identitySha256':sha(json.dumps(prior,separators=(',',':')).encode()),'sources':copy.deepcopy(prior['sources'])});j.update(state='ready',lifecycle='ACTIVE',holder=owner,lastAt=self.cfg['now']);j['holders'].append(owner);self.j=j;save(self.claim,self.identity,fresh);self.persist()
  def current(self):self.validate_retarget();return super().current()
  def view(self,wait=0):
   v=super().view(wait);d=self.j['projectRetarget'];v.update(uiOrdinaryLimit=86,uiLimit=102,combinedLimit=234,retargetUsed=d['used'],retargetAccountVerified=d['accountVerified']);return v
  def check_loading(self,op):
   c=self.j['connection'];d=self.j['projectRetarget'];n=d['used'];stage=c['stage']
   if n>=4 or stage!=STAGES[n] or c['used']!=10+n or self.j['loading']['used']!=16+n or c['used']>=14 or op!={'id':'loading-retarget99-n'+str(c['used']+1)+'-'+stage,'key':'N:preparation','actor':'publisher','target':'thin-settings','operation':METHODS[stage],'units':1,'preparation':True}:fail()
  # Fixed retarget99/launch100 dispatch supplies a literal, separate proof key.
  def _settle_project_read(self,q,proof_key):
   self.current();self.now(q.get('now'));e=self.j['events'][-1];self.check_loading(e['operation']);success=q.get('success');stage=self.j['connection']['stage'];extra=['inventoryClassification']if stage=='inventory'else ['loadingResultVerified']if success and stage=='snapshot'else[]
   if type(success)is not bool or not exact(q,['op','id','success','now']+extra) or q['id']!=e['operation']['id'] or self.j['pending']!=q['id'] or e['settled']is not False:fail()
   if stage=='inventory':
    d=q['inventoryClassification']
    if not exact(d,CLASS_KEYS) or d['source']!='readonly-project-inventory-v1' or d['status']not in STATUSES or d['rawValuesRetained']is not False or any(not integer(d[k])or not 0<=d[k]<=9600 for k in CLASS_KEYS if k not in ['source','status','rawValuesRetained']) or success!=(d['status']=='VERIFIED'):fail()
    if success and (not 1<=d['rowCount']<=300 or not 1<=d['exactUrlMatches']<=d['rowCount'] or any(d[k]!=0 for k in ['invalidRows','accessors','proxies','duplicateIds','providerIdMissing','opaqueIdMissing'])):fail()
    e['inventoryClassification']=copy.deepcopy(d)
   if success and stage=='snapshot':
    if q['loadingResultVerified']is not True:fail()
    self.j[proof_key]['accountVerified']=True;self.j['ownerConnection']['accountVerified']=True;e['loadingResultVerified']=True
   e.update(settled=True,success=success);self.j.update(pending=None,lastAt=q['now']);self.j['connection']['used']+=1;self.j['loading']['used']+=1;self.j[proof_key]['used']+=1
   if success:self.j['connection']['stage']=STAGES[self.j[proof_key]['used']]if self.j[proof_key]['used']<4 else'complete'
   else:self.j['failures']+=1
   self.persist()
   if not success:self.stop()
   return self.view()
  def command(self,q):
   name=q.get('op');e=self.j['events'][-1]if self.j['events']else{}
   if name=='settle' and e.get('preparationStage') and e.get('lane')=='ui' and e.get('key')=='N:preparation' and e['operation'].get('preparation')is True and e['operation']['id'].startswith('loading-retarget99-'):
    return self._settle_project_read(q,'projectRetarget')
   return super().command(q)
 return ProjectRetargetLedger
