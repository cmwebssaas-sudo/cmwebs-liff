"""Approved 105 import and bounded publisher preparation. No provider IO here."""
import copy,json,os,re
from pathlib import Path

DECISION='5f764b29438b582cdd404823a3a01408579fec7045ac5016971a7394d89337cb'
STEPS=[('binding','getBrowser','thin-settings'),('name','nameSession','thin-settings'),('settings-claim','claimTab','thin-settings'),('settings-project','evaluate','thin-settings'),('audience-claim','claimTab','oauth-audience'),('audience-project','evaluate','oauth-audience')]
FUTURE=[('baseline',6),('thin',18),('oauth',30),('freshness',14),('terminal',2),('diagnostic',20)]

def repair_allowed(incidents,incident,used_for_incident,used_total):
 return all(type(v)is int for v in [incidents,incident,used_for_incident,used_total]) and 1<=incident<=incidents<=2 and 0<=used_for_incident<3 and 0<=used_total<6

def stage_clock_valid(phase,w0):
 return phase=='PREP' and w0 is None or phase=='TRIAL' and type(w0)is int and w0>0

def alignment_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];record=g['record'];rawfile=g['rawfile'];sha=g['sha'];save=g['save_record'];integer=g['integer']
 def pinned(v):
  if not exact(v,['path','sha256']):fail()
  return pin(v)
 def truth(d,values):
  if type(d)is not dict or any(type(d.get(k))is not type(v) or d.get(k)!=v for k,v in values.items()):fail()
 class PublisherAlignmentLedger(base):
  aligned105=True
  def ordinary_ceiling(self):return 148
  def prepared_checkpoint(self,j):
   d=j.get('publisherAlignment',{});return d.get('maximum')==6 and d.get('used')==6 and d.get('settingsVerified') is True and d.get('audienceVerified') is True and 0<=d.get('readonlyIncidents',-1)<=2 and 0<=d.get('repairCalls',-1)<=6 and 0<=d.get('diagnosticCalls',-1)<=20 and j['phase']=='PREP' and j['w0'] is None
  def validate_alignment(self):
   old101,claim101=self.validate_shared();p=self.cfg['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99']['launch100']['shared101']['aligned105']
   names=['journal','claim','registry','stop','result','audit'];charges=['diagnostic','inventory','binding']
   if not exact(p,['decisionHash','approval','origin','charges','closure']) or p['decisionHash']!=DECISION or not exact(p['origin'],names) or not exact(p['charges'],charges):fail()
   if any(not exact(p['charges'][k],['reservation','outcome'])for k in charges):fail()
   raw={k:pinned(v)for k,v in p['origin'].items()};j=json.loads(raw['journal']);claim=record(Path(p['origin']['claim']['path']));approval=json.loads(pinned(p['approval']));closure=json.loads(pinned(p['closure']))
   expected=['source','questionCall','answer','decisionSha256','recordedAt','operationBudget','retainedSpent','importedMainSpent','importedUiSpent','selectedProfile','selectedBrowserId','scope','executionStarted']
   if not exact(approval,expected) or approval['source']!='direct-human-question-reply' or approval['answer']!='同意整體接續及296次上限' or approval['decisionSha256']!=DECISION or [approval[k]for k in ['operationBudget','retainedSpent','importedMainSpent','importedUiSpent']]!=[296,105,53,52] or approval['scope']!='HOLISTIC_PUBLISHER_ALIGNMENT105_STAGED_TRIAL' or approval['executionStarted']is not False or not integer(approval['recordedAt']) or not old101['lastAt']<=approval['recordedAt']<=self.cfg['now'] or type(approval['selectedProfile'])is not str or not approval['selectedProfile'] or type(approval['selectedBrowserId'])is not str or not approval['selectedBrowserId'] or type(approval['questionCall'])is not str or not approval['questionCall']:fail()
   self.approvedBrowserId=approval['selectedBrowserId'];self.approvedProfile=approval['selectedProfile']
   stable=copy.deepcopy(self.identity);stable.pop('sources');stable.pop('ownerHash');stable['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99']['launch100']['shared101'].pop('aligned105')
   if not exact(claim,list(stable)+['sources','ownerHash']) or any(claim[k]!=v for k,v in stable.items()) or record(Path(p['origin']['registry']['path']))!={'identity':claim,'checkpoint':j} or record(Path(p['origin']['stop']['path']))!={'identity':claim}:fail()
   for source in claim['sources']:g['pin'](source)
   old=str(self.path)+'.simple-project-shared'
   for k,end in [('journal','.json'),('claim','-claim.json'),('stop','-stop.json')]:
    if sha(rawfile(Path(old+end)))!=sha(raw[k]):fail()
   op={'id':'loading-shared101-n13-binding','key':'N:preparation','actor':'publisher','target':'thin-settings','operation':'claim','units':1,'preparation':True};e=j['events'][-1]
   changed=['events','connection','loading','preparationStages','projectShared','holder','holders','lastAt','failures']
   c=copy.deepcopy(old101['connection']);c.update(maximum=16,used=13,stage='binding');c['sourceChain'].append({'identitySha256':sha(json.dumps(claim101,separators=(',',':')).encode()),'sources':copy.deepcopy(claim101['sources'])})
   l=copy.deepcopy(old101['loading']);l.update(maximum=22,used=19)
   ps=copy.deepcopy(old101['preparationStages']);ps[op['id']]={'operations':[op],'remainingOrdinaryUi':36}
   if not exact(j,list(old101)+['projectShared']) or any(j[k]!=old101[k]for k in old101 if k not in changed) or len(j['events'])!=49 or j['events'][:48]!=old101['events'] or not exact(e,['lane','key','operation','time','outcome','cleanup','settled','success','preparationStage']) or e['operation']!=op or e['preparationStage']!=op['id'] or e['lane']!='ui' or e['key']!='N:preparation' or e['outcome']!='UNKNOWN' or e['cleanup']is not False or e['settled']is not True or e['success']is not False or not integer(e['time']) or not old101['lastAt']<=e['time']<=j['lastAt'] or j['connection']!=c or j['loading']!=l or j['preparationStages']!=ps or j['projectShared']!={'maximum':4,'used':1,'accountVerified':False} or j['failures']!=old101['failures']+1 or len(j['holders'])!=len(old101['holders'])+1 or j['holders'][:-1]!=old101['holders'] or len(set(j['holders']))!=len(j['holders']) or j['holder']!=claim['ownerHash'] or j['holders'][-1]!=j['holder'] or j['state']!='stopped' or j['lifecycle']!='HARD_STOP' or j['phase']!='PREP' or j['pending']is not None or j['w0']is not None or j['expiresAt']is not None or j['mutated']is not False or j['rpc']!={'beganAt':None,'complete':False} or j['plan']is not None:fail()
   result=json.loads(raw['result']);truth(result,{'source':'actual-cua-shared101-retained-once-only-result','error':None});stopped=result.get('result')
   if not exact(stopped,['status','failurePhase','classification','snapshot','report','drain','trialAccepted','completeActualMapProven']):fail()
   truth(stopped,{'status':'HARD_STOP','failurePhase':'BINDING','classification':None,'snapshot':None,'report':None,'trialAccepted':False,'completeActualMapProven':False})
   truth(stopped.get('drain'),{'stopRequested':True,'stopAcknowledged':True,'ordinaryScopeClosed':True,'ownedScope':{'state':'SETTLED'},'trialAccepted':False,'remoteExecutionSettled':False,'rollbackComplete':False});truth(result.get('launcher'),{'started':True,'allowed':False,'promiseRetained':True})
   audit=json.loads(raw['audit']);truth(audit,{'source':'independent-readonly-poststop102-audit','actualSpent':102,'mainSpent':53,'uiSpent':49,'events':49,'allEventsSettled':True,'pending':None,'lifecycle':'HARD_STOP','returnedReceiptCaptured':True,'prior101CanonicalUnchanged':True,'trialClockAbsent':True,'rpcUnstarted':True,'mutated':False,'noPageRead':True})
   # These are three independent, already settled metadata charges. Their source
   # records contain no provider timestamp; admission time is bookkeeping only.
   pairs=[]
   for index,key in enumerate(charges,1):
    pins=p['charges'][key];r=json.loads(pinned(pins['reservation']));o=json.loads(pinned(pins['outcome']));pairs.append((r,o))
    if not exact(pins,['reservation','outcome']) or not isinstance(r.get('command'),str) or sha(r['command'].encode())!=r.get('commandSha256') or not re.fullmatch('[0-9a-f]{16,128}',r.get('nonce','')) or o.get('nonce')!=r['nonce'] or o.get('settled')is not True or r.get('canonicalSpent')!=102 or r.get('effectiveSpent')!=102+index or o.get('effectiveSpent')!=102+index or r.get('operationBudget')!=236 or o.get('operationBudget')!=236:fail()
    if index>1 and (r.get('commandSha256')!=o.get('commandSha256') or r.get('priorIndependentCharged')!=index-1 or r.get('chargedOperations')!=1 or r.get('ordinaryUiSpent')!=49+index):fail()
   d,i,b=pairs
   if len({r['nonce']for r,_ in pairs})!=3 or len({r['commandSha256']for r,_ in pairs})!=3:fail()
   unavailable=[k for k in d[1]if re.fullmatch(r'browserId[A-Za-z0-9]+',k)]
   diagnostic_keys=['canonicalSpent','classification','effectiveSpent','independentCharged','integrationRequiredBeforeAnyFurtherMainEntry','nonce','operationBudget','originalHardStopPreserved','settled']
   inventory_keys=['candidates','classification','commandSha256','documentedGetBrowserIdParameter','effectiveSpent','googlePageReads','nonce','operation','operationBudget','otherProfileHasExpectedSyntheticProjectTab','rawTitlesOrUrlsCopied','secondCallEligible','selectedBrowserId','selectedFromActualInventory','selectedProfileHasExpectedSyntheticProjectTab','settled','source','uniqueChromeHans']
   binding_keys=['canonicalSpent','classification','commandSha256','effectiveSpent','furtherCallsAuthorizedByThisDecision','futureUiProtected','googlePageReads','googleWrites','identityEvidence','independentChargedTotal','matchesPrechargedBrowserId','nonce','oldEntryReopened','operation','operationBudget','ordinaryUiSpent','profileEvidence','recoveryUiProtected','retainedHandle','retries','rpcCalls','selectedBrowserId','settled','source','stopAfterResult']
   if len(unavailable)!=1 or not exact(d[1],diagnostic_keys+unavailable) or not exact(i[1],inventory_keys) or not exact(b[1],binding_keys):fail()
   truth(i[1],{'googlePageReads':0,'rawTitlesOrUrlsCopied':False,'uniqueChromeHans':True})
   truth(b[1],{'googlePageReads':0,'googleWrites':0,'rpcCalls':0,'retries':0,'oldEntryReopened':False,'stopAfterResult':True})
   if d[0].get('independentCharged')!=1 or d[1].get('independentCharged')!=1 or d[1].get('classification')!='PROVIDER_REJECTED' or d[1][unavailable[0]] is not False or d[1].get('originalHardStopPreserved')is not True or not re.fullmatch(r"const [A-Za-z][A-Za-z0-9]*=await cua\.getBrowser\(\{id:'[^']+'\}\);",d[0]['command']):fail()
   if i[0].get('operation')!=1 or i[1].get('operation')!=1 or i[0].get('kind')!='STANDARD_SURFACE_INVENTORY_ONLY' or i[0]['command']!='await cua.getState();' or i[1].get('classification')!='INVENTORY_RETURNED_UNIQUE_CHROME_HANS' or i[1].get('selectedFromActualInventory')is not True or i[1].get('secondCallEligible')is not True:fail()
   if b[0].get('operation')!=2 or b[1].get('operation')!=2 or b[0].get('kind')!='BIND_UNIQUE_CHROME_HANS_ONLY' or b[0].get('firstOutcomeSha256')!=p['charges']['inventory']['outcome']['sha256'] or b[0].get('browserId')!=i[1].get('selectedBrowserId') or b[0].get('profileName')!=i[1].get('candidates',[{}])[0].get('profileName') or b[1].get('selectedBrowserId')!=b[0]['browserId'] or b[1].get('matchesPrechargedBrowserId')is not True or b[1].get('independentChargedTotal')!=3 or b[1].get('ordinaryUiSpent')!=52 or b[1].get('oldEntryReopened')is not False or b[1].get('furtherCallsAuthorizedByThisDecision')is not False or not re.fullmatch(r"const [A-Za-z][A-Za-z0-9]*=await cua\.getBrowser\(\{id:'[^']+'\}\);",b[0]['command']) or "{id:'"+b[0]['browserId']+"'}" not in b[0]['command']:fail()
   if not any(row.get('id')==b[0]['browserId'] and row.get('profileName')==b[0]['profileName'] and row.get('type')=='extension' for row in i[1]['candidates']) or not any(row.get('id')==approval['selectedBrowserId'] and row.get('profileName')==approval['selectedProfile'] and row.get('type')=='extension' for row in i[1]['candidates']) or approval['selectedBrowserId']==b[0]['browserId'] or d[0]['command']==b[0]['command']:fail()
   truth(closure,{'source':'independent-connection-location-closure','canonicalSpent':102,'priorIndependent':1,'currentIndependent':2,'effectiveSpent':105,'ordinaryUiSpent':52,'futureUiProtected':36,'recoveryUiProtected':16,'browserCalls':2,'boundBrowserId':b[0]['browserId'],'boundProfile':b[0]['profileName'],'googlePageReads':0,'googleWrites':0,'rpcCalls':0,'oldHardStopPreserved':True,'stopped':True,'publisherGoogleIdentityNotVerified':True})
   if closure.get('reservation1Sha256')!=p['charges']['inventory']['reservation']['sha256'] or closure.get('outcome1Sha256')!=p['charges']['inventory']['outcome']['sha256'] or closure.get('reservation2Sha256')!=p['charges']['binding']['reservation']['sha256'] or closure.get('outcome2Sha256')!=p['charges']['binding']['outcome']['sha256'] or closure.get('otherBrowserId')!=approval['selectedBrowserId'] or closure.get('otherProfile')!=approval['selectedProfile'] or closure.get('canonicalFivePinsUnchanged')!={k:True for k in ['journal','claim','stop','registry','receipt']}:fail()
   return j,claim,approval
  def resume_preparation(self,p):
   origin,prior,approval=self.validate_alignment();self.approvedBrowserId=approval['selectedBrowserId'];self.approvedProfile=approval['selectedProfile'];owner=sha(self.cfg['ownerNonce'].encode());fresh=p=={'aligned105':True}
   if fresh:
    if record(self.registry)!={'identity':prior,'checkpoint':origin} or any(os.path.lexists(x)for x in [self.journal,self.claim,self.stop_path]) or owner in origin['holders']:fail()
    j=copy.deepcopy(origin);j['connection']['maximum']=19;j['loading']['maximum']=25;j['publisherAlignment']={'maximum':6,'used':0,'settingsVerified':False,'audienceVerified':False,'readonlyIncidents':0,'repairCalls':0,'diagnosticCalls':0};j['publisherStages']=[];j['futureOrdinaryUi']=90
   else:
    if not exact(p,['receipt','minimumEvents']):fail()
    raw=rawfile(self.journal);rr=rawfile(self.registry);j=json.loads(raw);prior=record(self.claim)
    if record(self.registry)!={'identity':prior,'checkpoint':j} or p['minimumEvents']!=len(j['events']) or p['receipt']['path']!=str(self.path)+self.suffix+'-handoff-'+str(len(j['holders']))+'.json':fail()
    self.verify_receipt(json.loads(g['pin'](p['receipt'])),j,raw,rr)
    if {k:v for k,v in prior.items()if k not in ['sources','ownerHash']}!={k:v for k,v in self.identity.items()if k not in ['sources','ownerHash']} or j['events'][:49]!=origin['events'] or j['state']!='ready' or j['lifecycle']!='CLEAN_PAUSE' or j['phase']!='PREP' or j['pending']is not None or j['mutated'] or j['w0']is not None or j['rpc']!={'beganAt':None,'complete':False} or os.path.lexists(self.stop_path) or owner in j['holders'] or self.cfg['now']<j['lastAt']:fail()
    if not self.prepared_checkpoint(j):fail()
   for source in prior['sources']:g['pin'](source)
   j['connection']['sourceChain'].append({'identitySha256':sha(json.dumps(prior,separators=(',',':')).encode()),'sources':copy.deepcopy(prior['sources'])});j.update(state='ready',lifecycle='ACTIVE',holder=owner,lastAt=self.cfg['now']);j['holders'].append(owner)
   # Three past charges are imported as separately settled bookkeeping events.
   # No fabricated provider timestamp or historical call time is assigned.
   if fresh:j['publisherImported']=[{'source':key,'reservationSha256':self.cfg['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99']['launch100']['shared101']['aligned105']['charges'][key]['reservation']['sha256'],'outcomeSha256':self.cfg['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99']['launch100']['shared101']['aligned105']['charges'][key]['outcome']['sha256'],'settled':True,'bookkeptAt':self.cfg['now'],'providerCallAt':None}for key in ['diagnostic','inventory','binding']]
   self.j=j;save(self.claim,self.identity,fresh);self.persist()
  def current(self):self.validate_alignment();return super().current()
  def view(self,wait=0):
   v=super().view(wait);d=self.j['publisherAlignment'];v.update(uiSpent=v['uiSpent']+3,combinedSpent=v['combinedSpent']+3,uiOrdinary=v['uiOrdinary']+3,uiOrdinaryLimit=148,uiLimit=164,combinedLimit=296,publisherUsed=d['used'],settingsVerified=d['settingsVerified'],audienceVerified=d['audienceVerified'],readonlyIncidents=d['readonlyIncidents'],repairCalls=d['repairCalls'],diagnosticCalls=d['diagnosticCalls'],futureUiSpent=self.future_spent(),approvedBrowserId=self.approvedBrowserId,approvedProfile=self.approvedProfile);return v
  def preparation_complete(self):return self.j.get('publisherAlignment',{}).get('used')==6 and self.j['publisherAlignment']['settingsVerified'] and self.j['publisherAlignment']['audienceVerified']
  def future_spent(self):return sum(e['lane']=='ui' and not e['cleanup'] for e in self.j['events'][55:])
  def future_limit(self):return 90
  def rate(self,t):
   # Call timestamps are absent from imported sidecars. Bookkeeping time is a
   # conservative rate-limit floor, never represented as provider call time.
   ordinary=super().rate(t);booked=self.j.get('publisherImported',[])
   if booked and t-booked[0]['bookkeptAt']<60000:
    times=[self.prior_time]*53+[e['time']for e in self.j['events']]+[booked[0]['bookkeptAt']]*3
    recent=sorted(x for x in times if t-x<60000);return max(ordinary,0 if len(recent)<10 else recent[-10]+60000-t)
   return ordinary
  def check(self,lane,op,t,terminal=False):
   self.current();d=self.j['publisherAlignment'];first=op.get('id','').startswith('publisher105-')
   if first:
    if lane!='ui':fail()
    self.check_loading(op)
   elif not self.preparation_complete() and not op.get('key','').startswith(('C:','I:','J:')):fail()
   if lane=='ui' and not op.get('key','').startswith(('C:','I:','J:')) and self.counts()[3]+3>=148:fail()
   if lane=='ui' and not first and not op.get('key','').startswith(('C:','I:','J:')):
    entries=[(stage,m) for stage in self.j['publisherStages']for m in stage['map'] if m['lane']=='ui' and m['descriptor']==op]
    if len(entries)!=1 or self.future_spent()>=90:fail()
    stage,meta=entries[0]
    if stage['stage']=='diagnostic' and d['diagnosticCalls']>=20:fail()
    if stage['stage']=='diagnostic' and meta['repairIncident'] is None and d['readonlyIncidents']>=2 and op['preparation'] is True:fail()
    if meta['repairIncident'] is not None:
     used_for=sum(e['operation']['id'] in [x['descriptor']['id']for st in self.j['publisherStages']for x in st['map']if x['repairIncident']==meta['repairIncident']]for e in self.j['events'][55:])
     if not repair_allowed(d['readonlyIncidents'],meta['repairIncident'],used_for,d['repairCalls']):fail()
   if op.get('key')=='H:wrapper-compatibility-rpc' or op.get('alias')=='wrapper-compatibility-rpc':fail()
   return super().check(lane,op,t,terminal)
  def check_loading(self,op):
   d=self.j['publisherAlignment'];n=d['used']
   if n>=6:
    if not any(m['lane']=='ui' and m['descriptor']==op for stage in self.j['publisherStages']for m in stage['map']):fail()
    return
   stage,method,target=STEPS[n]
   if op!={'id':'publisher105-n'+str(n+1)+'-'+stage,'key':'N:preparation','actor':'publisher','target':target,'operation':method,'units':1,'preparation':True}:fail()
  def command(self,q):
   name=q.get('op');e=self.j['events'][-1]if self.j['events']else{}
   if name=='publisher-stage-ready':
    self.current();self.active(q.get('now'));index=len(self.j['publisherStages']);d=self.j['publisherAlignment']
    if not self.preparation_complete() or not stage_clock_valid(self.j['phase'],self.j['w0']) or self.j['pending']is not None or index>=len(FUTURE) or not exact(q,['op','stage','map','stageCap','now']) or q['stage']!=FUTURE[index][0] or type(q['map'])is not list or not q['map'] or not integer(q['stageCap']) or q['stageCap']<1 or sum(m.get('lane')=='ui'for m in q['map']if type(m)is dict)!=q['stageCap']:fail()
    used=sum(s['stageCap']for s in self.j['publisherStages']);future_minimum=sum(v for _,v in FUTURE[index+1:]);rollover=sum(v for _,v in FUTURE[:index])-used
    complete={e['operation']['id']for e in self.j['events'][55:]if e.get('settled')is True and e.get('success')is True}
    prior_mapped={m['descriptor']['id']for stage in self.j['publisherStages']for m in stage['map']}
    if q['stageCap']>FUTURE[index][1]+rollover or used+q['stageCap']+future_minimum>90 or self.future_spent()!=used or not prior_mapped<=complete or any(e.get('settled')is not True or e.get('success')is not True for e in self.j['events'][55:]):fail()
    ids={e['operation']['id']for e in self.j['events']}|{m['descriptor']['id']for stage in self.j['publisherStages']for m in stage['map']};seen=set();main_keys=set(self.j['stages']);cleanup_ids={c['descriptor']['id']for st in self.j['publisherStages']for m in st['map']for c in m['cleanup']};cleanup_keys={g['descriptor'](c['descriptor'],c['lane'])for st in self.j['publisherStages']for m in st['map']for c in m['cleanup']if c['lane']=='main'};ui_cleanup=sum(len([c for c in m['cleanup']if c['lane']=='ui'])for st in self.j['publisherStages']for m in st['map']);main_cleanup=sum(len([c for c in m['cleanup']if c['lane']=='main'])for st in self.j['publisherStages']for m in st['map'])
    for m in q['map']:
     if not exact(m,['lane','descriptor','tabId','url','callback','receipt','privacy','cleanup','repairIncident']) or m['lane']not in ['ui','main'] or type(m['descriptor'])is not dict or type(m['tabId'])is not str or not m['tabId'] or type(m['url'])is not str or not m['url'].startswith('https://') or type(m['callback'])is not str or not g['valid_id'](m['callback']) or m['receipt']not in ['SANITIZED_READ','EXACT_WRITE_READBACK'] or m['privacy']!='NO_SECRET_VALUES' or type(m['cleanup'])is not list or m['repairIncident'] is not None and (type(m['repairIncident'])is not int or m['repairIncident']not in [1,2]):fail()
     op=m['descriptor'];g['descriptor'](op,m['lane'])
     if not op['id'].startswith('future-') or op['id']in ids or op['id']in seen or op['id']in cleanup_ids or op['units']!=1 or g['descriptor'](op,m['lane']).startswith(('C:','I:','J:')):fail()
     if m['lane']=='main':
      key=op['bucket']+':'+op['alias']
      if key in main_keys:fail()
      main_keys.add(key)
     if m['lane']=='ui' and op['actor']!=('caller'if op['target'].startswith('caller-')else'publisher') or m['repairIncident']is not None and (q['stage']!='diagnostic' or m['lane']!='ui' or op['preparation']is not True or op['operation']not in g['READ_METHODS']):fail()
     writing=op.get('operation')not in g['READ_METHODS']+['GET','snapshot']
     if writing and (not m['cleanup'] or m['receipt']!='EXACT_WRITE_READBACK') or not writing and m['receipt']!='SANITIZED_READ':fail()
     for clean in m['cleanup']:
      if not exact(clean,['lane','descriptor','target','tabId','url','callback','receipt']) or clean['lane']not in ['ui','main'] or type(clean['descriptor'])is not dict or clean['target']!=clean['descriptor'].get('target') or type(clean['tabId'])is not str or not clean['tabId'] or type(clean['url'])is not str or not clean['url'].startswith('https://') or not g['valid_id'](clean['callback']):fail()
      key=g['descriptor'](clean['descriptor'],clean['lane']);method=clean['descriptor']['operation'];expected='SANITIZED_READ'if method in g['READ_METHODS']+['GET']else'EXACT_WRITE_READBACK'
      if not key.startswith(('C:','I:','J:')) or clean['lane']=='main' and key in cleanup_keys or clean['receipt']!=expected or clean['descriptor']['id']in ids or clean['descriptor']['id']in seen or clean['descriptor']['id']in cleanup_ids:fail()
      cleanup_ids.add(clean['descriptor']['id'])
      if clean['lane']=='main':cleanup_keys.add(key)
      if clean['lane']=='ui':ui_cleanup+=1
      else:main_cleanup+=1
     seen.add(op['id'])
    if ui_cleanup>16 or main_cleanup>21:fail()
    self.j['publisherStages'].append({'stage':q['stage'],'stageCap':q['stageCap'],'map':copy.deepcopy(q['map'])})
    for m in q['map']:
     if m['lane']=='ui' and m['descriptor']['preparation'] is True:self.j['preparationStages'][m['descriptor']['id']]={'operations':[copy.deepcopy(m['descriptor'])],'remainingOrdinaryUi':90-used-q['stageCap']}
     elif m['lane']=='ui':self.j['stageBrowser'].append(copy.deepcopy(m['descriptor']))
     else:self.j['stages'][m['descriptor']['bucket']+':'+m['descriptor']['alias']]=copy.deepcopy(m['descriptor'])
     self.j['recoveryBrowser']+=[copy.deepcopy(c['descriptor'])for c in m['cleanup']if c['lane']=='ui']
    self.j['futureOrdinaryUi']=90-used-q['stageCap'];self.j['lastAt']=q['now'];self.persist();return self.view()
   if name=='settle' and self.j.get('publisherAlignment',{}).get('used')==6 and e.get('lane')=='ui' and e['operation'].get('id','').startswith('future-'):
    self.current();self.now(q.get('now'));e=self.j['events'][-1];matches=[(stage,m)for stage in self.j['publisherStages']for m in stage['map']if m['lane']=='ui' and m['descriptor']==e['operation']]
    if len(matches)!=1 or self.j['pending']!=q.get('id') or e['settled'] is not False:fail()
    stage,meta=matches[0];d=self.j['publisherAlignment'];diagnostic=stage['stage']=='diagnostic';repair=meta['repairIncident'] is not None
    if q.get('success') is False and diagnostic and not repair and e['operation']['preparation'] is True:
     p=q.get('preparationOutcome');fields=['kind','phase','targetVerified','accountVerified','bindingVerified','pureRead','terminal','fieldsRead']
     if not exact(q,['op','id','success','now','preparationOutcome']) or not exact(p,fields) or p['kind'] not in ['TECHNICAL','NOT_READY'] or p['kind']=='NOT_READY' and p['phase']!='READY' or p['kind']=='TECHNICAL' and p['phase'] not in ['DECODE','PROJECTOR_COMBOS','PROJECTOR_SHAPE','PROJECTOR_ANCESTORS','PROJECTOR_RELATED','POSTCHECK_COMBO'] or any(p[k] is not True for k in ['targetVerified','accountVerified','bindingVerified','pureRead','terminal']) or p['fieldsRead'] is not False or self.j['phase']!='PREP' or self.j['mutated'] or self.j['rpc']['beganAt'] is not None or d['readonlyIncidents']>=2 or d['diagnosticCalls']>=20:fail()
     e.update(settled=True,success=False,preparationOutcome=copy.deepcopy(p));self.j.update(pending=None,lastAt=q['now']);d['readonlyIncidents']+=1;d['diagnosticCalls']+=1;self.j['failures']+=1;self.persist();return self.view()
    result=super().command(q)
    if diagnostic:
     d=self.j['publisherAlignment'];d['diagnosticCalls']+=1
     if repair:d['repairCalls']+=1
     if d['diagnosticCalls']>20 or d['repairCalls']>6:fail()
     self.persist();return self.view()
    return result
   if name=='settle' and e.get('preparationStage') and e.get('lane')=='ui' and e.get('key')=='N:preparation' and e['operation'].get('id','').startswith('publisher105-'):
    self.current();self.now(q.get('now'));e=self.j['events'][-1];op=e['operation'];self.check_loading(op);d=self.j['publisherAlignment'];n=d['used'];success=q.get('success');extra=['loadingResultVerified']if success and n in [3,5]else[]
    if type(success)is not bool or not exact(q,['op','id','success','now']+extra) or q['id']!=op['id'] or self.j['pending']!=q['id'] or e['settled']is not False:fail()
    if success and n in [3,5]:
     if q['loadingResultVerified']is not True:fail()
     d['settingsVerified'if n==3 else'audienceVerified']=True;e['loadingResultVerified']=True
    e.update(settled=True,success=success);self.j.update(pending=None,lastAt=q['now']);d['used']+=1;self.j['connection']['used']+=1;self.j['loading']['used']+=1
    if not success:self.j['failures']+=1
    self.persist()
    if not success:self.stop()
    return self.view()
   if name=='preparation-ready' and q.get('stage','').startswith('publisher105-'):
    self.current();self.active(q.get('now'));rows=q.get('operations');d=self.j['publisherAlignment']
    if not exact(q,['op','stage','operations','remainingOrdinaryUi','now']) or type(rows)is not list or len(rows)!=1 or q['stage']!=rows[0].get('id') or q['remainingOrdinaryUi']!=90 or q['stage']in self.j['preparationStages'] or self.j['pending']is not None or self.j['phase']!='PREP':fail()
    g['descriptor'](rows[0],'ui');self.check_loading(rows[0]);self.j['preparationStages'][q['stage']]={'operations':copy.deepcopy(rows),'remainingOrdinaryUi':q['remainingOrdinaryUi']};self.j['futureOrdinaryUi']=q['remainingOrdinaryUi'];self.j['lastAt']=q['now'];self.persist();return self.view()
   if name=='pause-preparation':
    self.current();self.active(q.get('now'))
    if not exact(q,['op','now']) or not self.prepared_checkpoint(self.j) or self.j['pending']is not None or any(e['settled']is not True for e in self.j['events']):fail()
    self.j.update(lifecycle='CLEAN_PAUSE',lastAt=q['now']);self.persist();return self.view()
   if name in ['stage-ready','plan-ready','recovery-ready','rpc-begin'] and self.j.get('plan')is None:fail()
   return super().command(q)
 return PublisherAlignmentLedger
