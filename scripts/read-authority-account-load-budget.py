"""One exact stopped88 incident successor, sharing the canonical latest pointer.

Retain all stopped bytes; never reset the old entry. No browser/network access.
The live holder separately verifies the original account hash and safe result.
"""
import copy,json,os
from pathlib import Path
DECISION='8ddb213aa8a504c2cf2c2e5042d3ee7f212d90cffd555e140164f6ddcf25063f'
METHODS=['inventory','claim','wait','snapshot']
def account_load_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];rawfile=g['rawfile'];record=g['record'];sha=g['sha'];save=g['save_record'];integer=g['integer']
 class AccountLoadLedger(base):
  def validate_incident(self):
   p=self.cfg['readonlyAccountLoad'];names=['journal','claim','registry','stop','terminal','result']
   if not exact(p,['decisionHash','approval','origin']) or p['decisionHash']!=DECISION or not exact(p['origin'],names):fail()
   raw={k:pin(v) for k,v in p['origin'].items()};j=json.loads(raw['journal']);claim=record(Path(p['origin']['claim']['path']));reg=record(Path(p['origin']['registry']['path']));prior=self.validate_origin();a=json.loads(pin(p['approval']))
   keys=['source','decisionSha256','ownerAnswer','predecessorSha256','importedSpent','combinedLimit','maximumAdditionalPrimitives','recordedAt','executionStarted']
   if not exact(a,keys) or a['source']!='direct-human-approval' or a['decisionSha256']!=DECISION or a['ownerAnswer']!='同意本次4步接續，維持232' or a['predecessorSha256']!=sha(raw['journal']) or [a[k] for k in ['importedSpent','combinedLimit','maximumAdditionalPrimitives']]!=[88,232,4] or a['executionStarted'] is not False or not integer(a['recordedAt']) or not j['lastAt']<=a['recordedAt']<=self.cfg['now']:fail()
   stable={k:v for k,v in self.identity.items() if k not in ['sources','ownerHash','readonlyAccountLoad','readonlyConnection']}
   if not exact(claim,list(stable)+['sources','ownerHash']) or any(claim[k]!=v for k,v in stable.items()) or reg!={'identity':claim,'checkpoint':j}:fail()
   for source in claim['sources']:g['pin'](source)
   old=str(self.path)+'.simple-rebalanced'
   for k,path in {'journal':old+'.json','claim':old+'-claim.json','stop':old+'-stop.json'}.items():
    if sha(rawfile(Path(path)))!=sha(raw[k]):fail()
   marker=json.loads(raw['stop'])
   if marker!={'source':'live-owner-stop','binding':self.cfg['binding']} and record(Path(p['origin']['stop']['path']))!={'identity':claim}:fail()
   if not exact(j,list(prior)+['loading']) or j['events'][:30]!=prior['events'] or len(j['events'])!=35 or j['phase']!='PREP' or j['state']!='stopped' or j['lifecycle']!='HARD_STOP' or j['failures']!=7 or j['technicalFailures']!=0 or j['pending'] is not None or j['mutated'] is not False or j['rpc']!={'beganAt':None,'complete':False} or j['w0'] is not None or j['expiresAt'] is not None or j['chargedUpperBoundMs']!=0 or j['finished'] is not False or len(j['holders'])!=4 or j['holders'][:3]!=prior['holders'] or j['holder']!=claim['ownerHash'] or j['holders'][-1]!=j['holder']:fail()
   for i,(method,target) in enumerate([('inventory','thin-settings'),('claim','thin-settings'),('snapshot','thin-settings'),('navigate','oauth-audience'),('snapshot','oauth-audience')]):
    e=j['events'][30+i];op={'id':'loading-h4-n'+str(i+1)+'-'+target+'-'+method,'key':'N:preparation','actor':'publisher','target':target,'operation':method,'units':1,'preparation':True}
    keys=['lane','key','operation','time','outcome','cleanup','settled','success','preparationStage']+(['loadingResultVerified'] if i==2 else [])
    if not exact(e,keys) or e['operation']!=op or e['lane']!='ui' or e['key']!='N:preparation' or e['preparationStage']!=op['id'] or e['cleanup'] is not False or e['settled'] is not True or e['success'] is not (i<4) or e['outcome']!='UNKNOWN' or i==2 and e['loadingResultVerified'] is not True:fail()
   l=j['loading']
   if l['maximum']!=9 or l['used']!=5 or l['currentTarget']!='oauth-audience' or l['acquisition']!='ready' or l['projections']!={'thin-settings':1,'oauth-audience':1} or l['waits']!={'thin-settings':0,'oauth-audience':0} or l['grounded']!=['thin-settings'] or j['futureOrdinaryUi']!=40:fail()
   d=json.loads(raw['terminal']);truth=['actualAwaitedRunReturned','latestCheckpointMatches','allIoSettled','pendingNull','noMutation','noRpc','noTrialClock','lockReleased','exactHolderChildAbsent','scopeClosed','ordinaryScopeClosed','stopAcknowledged']
   if d.get('source')!='post-return-loading-terminal-evidence' or any(d.get(k) is not True for k in truth) or any(d.get(k)!=v for k,v in {'runStatus':'HARD_STOP','combinedSpent':88,'mainSpent':53,'uiSpent':35,'loadingUsed':5,'eventCount':35,'lifecycle':'HARD_STOP','phase':'PREP','grounded':['thin-settings'],'currentTarget':'oauth-audience','resumeAuthorized':False}.items()):fail()
   if d.get('files')!={('actual-result' if k=='result' else k):p['origin'][k] for k in ['journal','claim','registry','stop','result']}:fail()
   r=json.loads(raw['result']);v=r.get('observations',{}).get('loading-h4-n5-oauth-audience-snapshot')
   expected={'source':'rebalanced-readonly-grounding','urlMatched':True,'accountVerified':False,'fieldsRead':False,'ready':'UNREAD','section':'UNREAD','reason':'ACCOUNT_MISMATCH','phase':'ACCOUNT_SCAN','cryptoAvailable':False,'encoderAvailable':False,'controls':[]}
   if r.get('status')!='HARD_STOP' or r.get('failurePhase')!='RESULT_POLICY_REJECTED' or r.get('trialAccepted') is not False or v!=expected:fail()
   return j,claim
  def resume_preparation(self,p):
   origin,claim=self.validate_incident()
   if p!={'incident':True}:return super().resume_preparation(p)
   # One new namespace, same original lock and canonical registry. The old
   # stopped journal, claim and STOP remain immutable. Replay cannot import88.
   if record(self.registry)!={'identity':claim,'checkpoint':origin}:fail()
   if any(os.path.lexists(path) for path in [self.journal,self.claim,self.stop_path]):fail()
   owner=sha(self.cfg['ownerNonce'].encode())
   if owner in origin['holders']:fail()
   j=copy.deepcopy(origin);j.update(state='ready',lifecycle='ACTIVE',holder=owner,lastAt=self.cfg['now']);j['holders'].append(owner)
   j['loading']['acquisition']='inventory';j['loading']['sourceChain'].append({'identitySha256':sha(json.dumps(claim,separators=(',',':')).encode()),'sources':copy.deepcopy(claim['sources'])})
   self.j=j;save(self.claim,self.identity,True);self.persist()
  def current(self):
   self.validate_incident();return super().current()
  def check_loading(self,op):
   events=self.j['events'][35:]
   if len(events)>=4 or op['target']!='oauth-audience' or op['operation']!=METHODS[len(events)] or not op['id'].startswith('loading-incident-') or self.j['loading']['used']>=9:fail()
   if any(e['settled'] is not True or e['success'] is not True for e in events):fail()
  def command(self,q):
   if q.get('op')=='preparation-ready' and (q.get('remainingOrdinaryUi')!=36 or len(self.j['events'])>=39):fail()
   result=super().command(q)
   if q.get('op')=='settle' and q.get('success') is False and self.j['events'][-1]['operation']['id'].startswith('loading-incident-') and self.j['events'][-1]['operation']['operation']=='snapshot':
    # This is the last allowed projection. Even a classified NOT_READY or
    # TECHNICAL outcome is terminal here; no resumable handoff is permitted.
    self.stop();return self.view()
   return result
 return AccountLoadLedger
