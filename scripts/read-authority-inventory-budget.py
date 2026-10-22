"""Exact97 successor; four prepaid readonly primitives, no wait or remote IO.

Old owner97 STOP and source history remain immutable. Only its one historical
unused declaration is released into ordinary UI;132+84+16 remains232.
"""
import copy,json,os
from pathlib import Path
DECISION='8a40d0166dc5217eac232b8abdab8e1fb3c994b3c26a462ddf9730a40d4cd5c2'
STAGES=['binding','inventory','claim','snapshot']
METHODS={'binding':'claim','inventory':'inventory','claim':'claim','snapshot':'snapshot'}
RELEASED='continuity-settings-navigate'
CLASS_KEYS=['source','status','rowCount','invalidRows','accessors','proxies','duplicateIds','providerIdMissing','originalMatches','exactUrlMatches','rawValuesRetained']
STATUSES=['API_REJECTED','OPTIONS_INVALID','ROOT_PROXY','ROOT_NOT_ARRAY','ARRAY_SHAPE','METADATA_INVALID','DUPLICATE_ID','ORIGINAL_MATCH_COUNT','URL_MISMATCH','VERIFIED','RESULT_UNVERIFIED']
def inventory_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];rawfile=g['rawfile'];record=g['record'];sha=g['sha'];save=g['save_record'];integer=g['integer']
 class InventoryLedger(base):
  inventory97=True
  def connection_maximum(self):return 12
  def ordinary_ceiling(self):return 84
  def preparation_complete(self):
   d=self.j.get('inventoryDiagnostic',{})
   return d.get('used')==4 and d.get('accountVerified')is True and self.j['connection']['stage']=='complete' and self.j['ownerConnection']['accountVerified']is True
  def prepared_checkpoint(self,j):return j.get('inventoryDiagnostic',{}).get('used')==4 and j['inventoryDiagnostic'].get('accountVerified')is True and j['connection']['stage']=='complete' and j['ownerConnection']['accountVerified']is True
  def validate_inventory(self):
   old94,_=self.validate_owner();p=self.cfg['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97'];names=['journal','claim','registry','stop','terminal','result']
   if not exact(p,['decisionHash','approval','origin']+(['retarget99']if getattr(self,'retarget99',False)else[])) or p['decisionHash']!=DECISION or not exact(p['origin'],names):fail()
   raw={k:pin(v)for k,v in p['origin'].items()};j=json.loads(raw['journal']);claim=record(Path(p['origin']['claim']['path']));reg=record(Path(p['origin']['registry']['path']));a=json.loads(pin(p['approval']))
   keys=['source','questionCall','answer','decisionSha256','recordedAt','operationBudget','retainedSpent','selectedBrowserId','scope','executionStarted']
   if not exact(a,keys) or a['source']!='direct-human-question-reply' or a['answer']!='同意四步方案，維持232' or a['decisionSha256']!=DECISION or a['operationBudget']!=232 or a['retainedSpent']!=97 or a['scope']!='FOUR_READONLY_STEPS_NEW_ENTRY_ONLY' or a['executionStarted']is not False or type(a['questionCall'])is not str or not 0<len(a['questionCall'])<=200 or not integer(a['recordedAt']) or not j['lastAt']<=a['recordedAt']<=self.cfg['now']:fail()
   stable=copy.deepcopy(self.identity);stable.pop('sources');stable.pop('ownerHash');stable['readonlyConnection']['repair92']['diagnostic93']['owner94'].pop('inventory97')
   if not exact(claim,list(stable)+['sources','ownerHash']) or any(claim[k]!=v for k,v in stable.items()) or reg!={'identity':claim,'checkpoint':j}:fail()
   for source in claim['sources']:g['pin'](source)
   old=str(self.path)+'.simple-owner-connection'
   for k,end in [('journal','.json'),('claim','-claim.json'),('stop','-stop.json')]:
    if sha(rawfile(Path(old+end)))!=sha(raw[k]):fail()
   if record(Path(p['origin']['stop']['path']))!={'identity':claim}:fail()
   if not exact(j,list(old94)+['ownerConnection']) or j['events'][:41]!=old94['events'] or len(j['events'])!=44 or j['state']!='stopped' or j['lifecycle']!='HARD_STOP' or j['phase']!='PREP' or j['pending']is not None or j['mutated']is not False or j['rpc']!={'beganAt':None,'complete':False} or j['w0']is not None or j['expiresAt']is not None or j['chargedUpperBoundMs']!=0 or j['failures']!=13 or j['technicalFailures']!=0 or len(j['holders'])!=12 or j['holders'][:10]!=old94['holders'] or len(set(j['holders']))!=12 or j['holder']!=claim['ownerHash'] or j['holders'][-1]!=j['holder']:fail()
   for n,stage in enumerate(['discovery','binding','inventory'],6):
    op={'id':'loading-owner94-n'+str(n)+'-'+stage,'key':'N:preparation','actor':'publisher','target':'thin-settings','operation':'inventory'if stage in ['discovery','inventory']else'claim','units':1,'preparation':True};e=j['events'][n+35]
    if not exact(e,['lane','key','operation','time','outcome','cleanup','settled','success','preparationStage']) or e['operation']!=op or e['preparationStage']!=op['id'] or e['lane']!='ui' or e['key']!='N:preparation' or e['cleanup']is not False or e['settled']is not True or e['success']is not(stage!='inventory') or e['outcome']!='UNKNOWN':fail()
   c=j['connection'];l=j['loading'];o=j['ownerConnection']
   if c['maximum']!=11 or c['used']!=8 or c['failures']!=2 or c['stage']!='inventory' or c['metadataVerified']is not True or c['waitSucceeded']is not False or l['maximum']!=17 or l['used']!=14 or j['futureOrdinaryUi']!=36 or not exact(o,['candidates','selected','accountVerified']) or o['accountVerified']is not False or not exact(o['selected'],['browserId','approval']) or a['selectedBrowserId']!=o['selected']['browserId']:fail()
   choice=json.loads(pin(o['selected']['approval']))
   if not exact(choice,['source','browserId','ownerAnswer','candidatesSha256','recordedAt','executionStarted']) or choice['source']!='direct-human-connection-selection' or choice['browserId']!=a['selectedBrowserId'] or choice['ownerAnswer']!='使用連線 '+a['selectedBrowserId'] or choice['candidatesSha256']!=sha(g['compact'](o['candidates']).encode()) or choice['executionStarted']is not False:fail()
   for k in ['stages','stageNames','stageBrowser','recoveryBrowser','plan','completed','finished']:
    if j[k]!=old94[k]:fail()
   d=json.loads(raw['terminal']);r=json.loads(raw['result']);truth=['bindingSucceeded','inventoryFailed','allIoSettled','pendingNull','scopeClosed','lockReleased','registryAndClaimExact','stopRecorded','noMutation','noRpc','noTrialClock']
   expected={'source':'post-return-selected-owner97-terminal','actualSpent':97,'mainSpent':53,'uiSpent':44,'combinedLimit':232,'lifecycle':'HARD_STOP','phase':'PREP','failureCauseEstablished':False,'trialAccepted':False,'retryAuthorized':False}
   if any(d.get(k)!=v for k,v in expected.items()) or any(d.get(k)is not True for k in truth) or not integer(d.get('immutablePinsChecked')) or d['immutablePinsChecked']<1:fail()
   canonical={'journal':old+'.json','claim':old+'-claim.json','stop':old+'-stop.json','registry':str(self.registry)}
   if type(d.get('artifacts'))is not list or len(d['artifacts'])!=4 or {v.get('path'):v.get('sha256')for v in d['artifacts']if type(v)is dict}!= {canonical[k]:sha(raw[k])for k in canonical}:fail()
   if r.get('status')!='HARD_STOP' or r.get('failurePhase')!='INVENTORY' or r.get('trialAccepted')is not False or r.get('completeActualMapProven')is not False or r.get('report')is not None or any(r.get('drain',{}).get(k)is not True for k in ['stopAcknowledged','ordinaryScopeClosed']) or r.get('drain',{}).get('ownedScope')!={'state':'SETTLED'}:fail()
   return j,claim
  def resume_preparation(self,p):
   origin,prior=self.validate_inventory();owner=sha(self.cfg['ownerNonce'].encode());fresh=p=={'inventory97':True}
   if fresh:
    if record(self.registry)!={'identity':prior,'checkpoint':origin} or any(os.path.lexists(path)for path in [self.journal,self.claim,self.stop_path]) or owner in origin['holders']:fail()
    used={e['operation']['id']for e in origin['events']}|set(origin['loading']['superseded']);unused=[r['id']for entry in origin['preparationStages'].values()for r in entry['operations']if r['id']not in used]
    if unused!=[RELEASED]:fail()
    j=copy.deepcopy(origin);j['connection'].update(maximum=12,stage='binding');j['loading']['maximum']=18;j['loading']['superseded'].append(RELEASED);j['inventoryDiagnostic']={'maximum':4,'used':0,'accountVerified':False,'releasedUnusedId':RELEASED}
   else:
    if not exact(p,['receipt','minimumEvents']):fail()
    raw=rawfile(self.journal);rr=rawfile(self.registry);j=json.loads(raw);prior=record(self.claim)
    if record(self.registry)!={'identity':prior,'checkpoint':j} or p['minimumEvents']!=len(j['events']) or p['receipt']['path']!=str(self.path)+self.suffix+'-handoff-'+str(len(j['holders']))+'.json':fail()
    self.verify_receipt(json.loads(g['pin'](p['receipt'])),j,raw,rr)
    if {k:v for k,v in prior.items()if k not in ['sources','ownerHash']}!={k:v for k,v in self.identity.items()if k not in ['sources','ownerHash']} or j['events'][:44]!=origin['events'] or len(j['events'])!=48 or j['state']!='ready' or j['lifecycle']!='CLEAN_PAUSE' or not self.prepared_checkpoint(j) or j['phase']!='PREP' or j['pending']is not None or j['mutated'] or j['w0']is not None or j['rpc']!={'beganAt':None,'complete':False} or os.path.lexists(self.stop_path) or any(e['settled']is not True or e['success']is not True for e in j['events'][44:]) or owner in j['holders'] or self.cfg['now']<j['lastAt']:fail()
   for source in prior['sources']:g['pin'](source)
   j['connection']['sourceChain'].append({'identitySha256':sha(json.dumps(prior,separators=(',',':')).encode()),'sources':copy.deepcopy(prior['sources'])});j.update(state='ready',lifecycle='ACTIVE',holder=owner,lastAt=self.cfg['now']);j['holders'].append(owner);self.j=j;save(self.claim,self.identity,fresh);self.persist()
  def current(self):self.validate_inventory();return super().current()
  def view(self,wait=0):
   v=super().view(wait);d=self.j['inventoryDiagnostic'];v.update(inventoryUsed=d['used'],inventoryAccountVerified=d['accountVerified']);return v
  def check_loading(self,op):
   c=self.j['connection'];d=self.j['inventoryDiagnostic'];index=d['used'];stage=c['stage']
   if index>=4 or stage!=STAGES[index] or c['used']!=8+index or self.j['loading']['used']!=14+index or c['used']>=12 or op!={'id':'loading-inventory97-n'+str(c['used']+1)+'-'+stage,'key':'N:preparation','actor':'publisher','target':'thin-settings','operation':METHODS[stage],'units':1,'preparation':True}:fail()
  def command(self,q):
   name=q.get('op')
   payload=q.get('plan',{})if name=='plan-ready'else q
   rows=payload.get('operations',[])+payload.get('browserOperations',[])if type(payload)is dict else []
   if any(type(r)is dict and r.get('id')==RELEASED for r in rows) or type(q.get('operation'))is dict and q['operation'].get('id')==RELEASED or name=='owner-selected':fail()
   if name=='settle' and self.j['events'] and self.j['events'][-1].get('preparationStage') and self.j['events'][-1]['lane']=='ui' and self.j['events'][-1]['key']=='N:preparation' and self.j['events'][-1]['operation']['id'].startswith('loading-inventory97-'):
    self.current();self.now(q.get('now'));e=self.j['events'][-1];self.check_loading(e['operation']);success=q.get('success');stage=self.j['connection']['stage'];extra=['inventoryClassification']if stage=='inventory'else ['loadingResultVerified']if success and stage=='snapshot'else []
    if type(success)is not bool or not exact(q,['op','id','success','now']+extra) or q['id']!=e['operation']['id'] or self.j['pending']!=q['id'] or e['settled']is not False:fail()
    if stage=='inventory':
     d=q['inventoryClassification']
     if not exact(d,CLASS_KEYS) or d['source']!='readonly-tab-inventory-v1' or d['status']not in STATUSES or d['rawValuesRetained']is not False or any(not integer(d[k])or not 0<=d[k]<=9600 for k in CLASS_KEYS if k not in ['source','status','rawValuesRetained']) or success!=(d['status']=='VERIFIED'):fail()
     if success and (d['rowCount']<1 or d['rowCount']>300 or any(d[k]!=0 for k in ['invalidRows','accessors','proxies','duplicateIds']) or d['originalMatches']!=1 or d['exactUrlMatches']!=1):fail()
     e['inventoryClassification']=copy.deepcopy(d)
    if success and stage=='snapshot':
     if q['loadingResultVerified']is not True:fail()
     self.j['inventoryDiagnostic']['accountVerified']=True;self.j['ownerConnection']['accountVerified']=True;e['loadingResultVerified']=True
    e.update(settled=True,success=success);self.j.update(pending=None,lastAt=q['now']);self.j['connection']['used']+=1;self.j['loading']['used']+=1;self.j['inventoryDiagnostic']['used']+=1
    if success:self.j['connection']['stage']=STAGES[self.j['inventoryDiagnostic']['used']]if self.j['inventoryDiagnostic']['used']<4 else'complete'
    else:self.j['failures']+=1
    self.persist()
    if not success:self.stop()
    return self.view()
   return super().command(q)
 return InventoryLedger
