"""Exact101 shared-object successor. Historical UNKNOWN and charges are immutable."""
import copy,json
from pathlib import Path
DECISION='c767d9a34c9b1df5940ee19205481f26027f7d5abadc0c9fbd3341e4fa24ff5c'
def shared_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];record=g['record'];rawfile=g['rawfile'];sha=g['sha'];integer=g['integer']
 def fields(value,expected):
  if type(value)is not dict or any(type(value.get(k))is not type(v) or value.get(k)!=v for k,v in expected.items()):fail()
 class ProjectSharedLedger(base):
  shared101=True
  def connection_maximum(self):return 16
  def ordinary_ceiling(self):return 88
  def prepared_checkpoint(self,j):return j.get('projectShared')=={'maximum':4,'used':4,'accountVerified':True} and j['connection']['stage']=='complete' and j['ownerConnection']['accountVerified']is True
  def validate_shared(self):
   old100,claim100=self.validate_launch();p=self.cfg['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99']['launch100']['shared101'];names=['journal','claim','registry','stop','result','audit','crossCellProof','sharedObjectProof','review']
   if not exact(p,['decisionHash','approval','origin']+(['aligned105']if getattr(self,'aligned105',False)else[])) or p['decisionHash']!=DECISION or not exact(p['origin'],names):fail()
   for value in [p['approval']]+list(p['origin'].values()):
    if not exact(value,['path','sha256']):fail()
   raw={k:pin(v)for k,v in p['origin'].items()};j=json.loads(raw['journal']);claim=record(Path(p['origin']['claim']['path']));a=json.loads(pin(p['approval']))
   keys=['source','questionCall','answer','decisionSha256','recordedAt','operationBudget','retainedSpent','selectedBrowserId','scope','executionStarted']
   if not exact(a,keys) or a['source']!='direct-human-question-reply' or a['answer']!='同意共用物件修復接續及236上限' or a['decisionSha256']!=DECISION or a['operationBudget']!=236 or a['retainedSpent']!=101 or a['selectedBrowserId']!='6' or a['scope']!='FOUR_READONLY_STEPS_EXACT101_NEW_SHARED_OBJECT_ENTRY_ONLY' or a['executionStarted']is not False or type(a['questionCall'])is not str or not 0<len(a['questionCall'])<=200 or not integer(a['recordedAt']) or not j['lastAt']<=a['recordedAt']<=self.cfg['now']:fail()
   stable=copy.deepcopy(self.identity);stable.pop('sources');stable.pop('ownerHash');stable['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99']['launch100'].pop('shared101')
   if not exact(claim,list(stable)+['sources','ownerHash']) or any(claim[k]!=v for k,v in stable.items()) or record(Path(p['origin']['registry']['path']))!={'identity':claim,'checkpoint':j} or record(Path(p['origin']['stop']['path']))!={'identity':claim}:fail()
   for s in claim['sources']:g['pin'](s)
   old=str(self.path)+'.simple-project-launch'
   for k,end in [('journal','.json'),('claim','-claim.json'),('stop','-stop.json')]:
    if sha(rawfile(Path(old+end)))!=sha(raw[k]):fail()
   op={'id':'loading-launch100-n12-binding','key':'N:preparation','actor':'publisher','target':'thin-settings','operation':'claim','units':1,'preparation':True};e=j['events'][-1]
   if not exact(e,['lane','key','operation','time','outcome','cleanup','settled','success','preparationStage']) or e['operation']!=op or e['lane']!='ui' or e['key']!='N:preparation' or e['preparationStage']!=op['id'] or e['cleanup']is not False or e['settled']is not True or e['success']is not False or e['outcome']!='UNKNOWN' or not integer(e['time']) or not old100['lastAt']<=e['time']<=j['lastAt']:fail()
   c=copy.deepcopy(old100['connection']);c.update(maximum=15,used=12,stage='binding');c['sourceChain'].append({'identitySha256':sha(json.dumps(claim100,separators=(',',':')).encode()),'sources':copy.deepcopy(claim100['sources'])});l=copy.deepcopy(old100['loading']);l.update(maximum=21,used=18);ps=copy.deepcopy(old100['preparationStages']);ps[op['id']]={'operations':[op],'remainingOrdinaryUi':36}
   changed=['events','connection','loading','preparationStages','holder','holders','lastAt','failures']
   if not exact(j,list(old100)+['projectLaunch']) or any(j[k]!=old100[k]for k in old100 if k not in changed) or j['events'][:47]!=old100['events'] or len(j['events'])!=48 or j['connection']!=c or j['loading']!=l or j['preparationStages']!=ps or j['projectLaunch']!={'maximum':4,'used':1,'accountVerified':False} or j['failures']!=16 or len(j['holders'])!=15 or j['holders'][:14]!=old100['holders'] or len(set(j['holders']))!=15 or j['holder']!=claim['ownerHash'] or j['holders'][-1]!=j['holder'] or j['ownerConnection']['selected']['browserId']!='6' or j['lastAt']<old100['lastAt']:fail()
   returned=json.loads(raw['result']);fields(returned,{'source':'actual-cua-retained-once-only-launch-result','error':None,'outerGateClosed':True})
   fields(returned.get('launcher'),{'started':True,'allowed':False,'promiseRetained':True,'resultRetained':True,'errorRetained':True});result=returned.get('result');fields(result,{'status':'HARD_STOP','failurePhase':'BINDING','classification':None,'snapshot':None,'report':None,'trialAccepted':False,'completeActualMapProven':False});fields(result.get('drain'),{'stopRequested':True,'stopAcknowledged':True,'ordinaryScopeClosed':True,'ownedScope':{'state':'SETTLED'},'trialAccepted':False,'remoteExecutionSettled':False,'rollbackComplete':False})
   audit=json.loads(raw['audit']);fields(audit,{'source':'independent-readonly-poststop101-audit','sealedEightPinsUnchanged':True,'pinFailures':[],'oldCanonicalExact':{k:True for k in ['old100_journal','old100_claim','old100_stop','old99_journal','old99_claim','old99_stop']},'currentRegistryClaimJournalExact':True,'currentStopExact':True,'claimConfigExact':True,'events':48,'old47PrefixExact':True,'mainSpent':53,'uiSpent':48,'allEventsSettled':True,'state':'stopped','lifecycle':'HARD_STOP','phase':'PREP','pending':None,'newEvent':e,'connectionUsed':12,'connectionFaults':2,'loadingUsed':18,'projectLaunch':j['projectLaunch'],'projectRetarget':j['projectRetarget'],'inventoryDiagnostic':j['inventoryDiagnostic'],'trialClockAbsent':True,'rpcUnstarted':True,'mutated':False,'returnedReceiptCaptured':True})
   fields(audit.get('artifacts'),{k:{'sha256':sha(raw[k]),'mode':'0o600'}for k in ['journal','claim','registry','stop']})
   # The scalar observer is retained as a demonstrated stale capture, never as
   # evidence that the historical provider callback was not invoked.
   cross=json.loads(raw['crossCellProof']);expected={'source':'actual-cua-pure-local-cross-cell-capture-proof','topLevelScalar':True,'scalarSeenByEarlierCallback':False,'topLevelObjectAllowed':True,'objectSeenByEarlierCallback':True,'objectCallsVisible':1,'actualBridgeObserver':0,'actualEntryReplayed':False,'providerOperations':0,'debits':0}
   if not exact(cross,list(expected)):fail()
   fields(cross,expected)
   proof=json.loads(raw['sharedObjectProof']);expected={'source':'actual-cua-shared-object-bridge-mock','crossCellOpenedGateObserved':True,'retainedPromiseObserved':True,'fulfilledMockCalls':1,'bridgeAttemptsAfterSuccess':1,'sourceOwnGateClosed':True,'outerObjectGateClosed':True,'actualEntryReplayed':False,'actualProviderOperations':0,'actualDebits':0,'closedGateDeniesMockProvider':True,'bridgeAttemptsAfterClosedProbe':2,'mockCallsAfterClosedProbe':1}
   if not exact(proof,list(expected)) or not 0<len(raw['review'])<=1000000:fail()
   fields(proof,expected)
   return j,claim
  def resume_preparation(self,p):
   origin,prior=self.validate_shared()
   return self._resume_project_read(p,origin,prior,marker='shared101',proof_key='projectShared',connection=16,loading=22,prefix_events=48,preserved=['projectLaunch','projectRetarget','inventoryDiagnostic'])
  def current(self):self.validate_shared();return super().current()
  def view(self,wait=0):
   v=super().view(wait);d=self.j['projectShared'];v.update(uiOrdinaryLimit=88,uiLimit=104,combinedLimit=236,sharedUsed=d['used'],sharedAccountVerified=d['accountVerified']);return v
  def check_loading(self,op):return self._check_project_loading(op,'projectShared','shared101',12,18)
  def command(self,q):
   e=self.j['events'][-1]if self.j['events']else{}
   if q.get('op')=='settle' and e.get('preparationStage') and e.get('lane')=='ui' and e.get('key')=='N:preparation' and e['operation'].get('preparation')is True and e['operation']['id'].startswith('loading-shared101-'):
    return self._settle_project_read(q,'projectShared')
   return super().command(q)
 return ProjectSharedLedger
