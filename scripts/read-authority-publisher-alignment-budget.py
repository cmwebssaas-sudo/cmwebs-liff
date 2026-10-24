"""Approved 105 import and bounded publisher preparation. No provider IO here."""
import copy,json,os,re
from pathlib import Path

DECISION='5f764b29438b582cdd404823a3a01408579fec7045ac5016971a7394d89337cb'
STEPS=[('binding','getBrowser','thin-settings'),('name','nameSession','thin-settings'),('settings-claim','claimTab','thin-settings'),('settings-project','evaluate','thin-settings'),('audience-claim','claimTab','oauth-audience'),('audience-project','evaluate','oauth-audience')]
FUTURE=[('baseline',6),('thin',18),('oauth',30),('freshness',14),('terminal',2),('diagnostic',20)]
NATIVE_BASELINE=[('N:preparation','original-settings','navigate',True),('N:preparation','original-settings','evaluate',True),('A:original-cloud-backup','original-settings','snapshot',False),('A:original-properties-backup','original-settings','read-key-presence',False),('N:navigation','original-triggers','navigate',False),('A:original-triggers-backup','original-triggers','snapshot',False)]
NATIVE_GROUNDING=[('N:preparation','original-triggers','navigate',True),('N:preparation','original-triggers','evaluate',True),('N:preparation','original-settings','navigate',True)]
BOOTSTRAP=[('future-bootstrap-browser','getBrowser','publisherBootstrapGetBrowser'),('future-bootstrap-claim','claimTab','publisherBootstrapClaimTab'),('future-bootstrap-identity','evaluate','publisherBootstrapEvaluate')]
BOOTSTRAP_FUTURE=[('baseline',9),('diagnostic',3),('thin',21),('oauth',17),('freshness',21),('terminal',2)]
BOOTSTRAP_BASELINE_ORDER=[0,1,6,7,8,2,3,4,5]
PUBLISHER_A_INITIAL=[('P:publisher-refresh','publisherReadPublisherRefresh'),('P:publisher-userinfo','publisherReadPublisherUserinfo')]
PUBLISHER_A_REMAINING=[('A:original-editor','publisherReadOriginalEditor'),('A:original-versions','publisherReadOriginalVersions'),('A:original-deployments','publisherReadOriginalDeployments'),('A:original-v1-content','publisherReadOriginalV1Content'),('A:original-container-acl','publisherReadOriginalContainerAcl')]
PUBLISHER_A_KEYS=[key for key,_ in PUBLISHER_A_INITIAL]+['A:original-project']+[key for key,_ in PUBLISHER_A_REMAINING]
PREDEBIT_ORIGIN={'journal':'91e30a199fbf6660dfd0b659ec4b265fee45bb8d360ea26a68ba1e9846f5491c','claim':'2dc247c18221e958e860a3ec57acfd72342935af936e87be38f14648b5727827','registry':'adf06b0cf233169233621a07b58955c5b7de3505b0791d563c4901df2786e7a6'}
PREDEBIT_PROOF='e28e43b7045f5f976f4624108c010cb7089cc7f5a75c0c4f046834508d8e46ae'

def predebit_evidence(paths,pins,proof_pin,expected,registry,prior_time,now,g):
 """Pure verification before a same-lineage, zero-event recovery transaction."""
 fail=g['fail'];exact=g['exact'];sha=g['sha'];rawfile=g['rawfile'];record=g['record'];integer=g['integer'];compact=g['compact']
 if not exact(pins,['journal','claim','stop','registry']) or not exact(paths,['journal','claim','stop','registry']) or not exact(expected,['journal','claim','registry','proof']) or not exact(proof_pin,['path','sha256']) or proof_pin['sha256']!=expected['proof']:fail()
 for key in paths:
  pin=pins[key]
  if not exact(pin,['path','sha256']) or pin['path']!=str(paths[key]) or not isinstance(pin['sha256'],str):fail()
 raw={key:rawfile(paths[key]) for key in paths}
 if any(sha(raw[key])!=pins[key]['sha256'] or key in expected and sha(raw[key])!=expected[key] for key in paths):fail()
 claim=record(paths['claim']);j=json.loads(raw['journal']);r=record(registry)
 if paths['registry']!=registry or r!={'identity':claim,'checkpoint':j} or record(paths['stop'])!={'identity':claim} or sha(raw['stop'])!=sha(compact({'value':{'identity':claim},'sha256':sha(compact({'identity':claim}).encode())}).encode()):fail()
 proof=json.loads(g['pin'](proof_pin))
 if proof.get('source')!='native128-predebit-local-timeout-proof-v2' or proof.get('journal')!=pins['journal'] or proof.get('claim')!=pins['claim'] or proof.get('registry')!=pins['registry'] or proof.get('state')!='stopped' or proof.get('lifecycle')!='HARD_STOP' or proof.get('phase')!='PREP' or proof.get('eventCount')!=55 or proof.get('newEventsAfterImported55')!=0 or proof.get('counts')!={'main':53,'ui':75,'combined':128,'limit':296} or proof.get('pending') is not None or proof.get('w0') is not None or proof.get('mutated') is not False or proof.get('rpc')!={'beganAt':None,'complete':False} or proof.get('nativeImports')!=17 or proof.get('lockOpenHolders')!=0 or proof.get('providerCallsThisAdmission')!=0 or proof.get('retainedCUAReferenceLost') is not True or proof.get('restartAttemptedAfterHardStop') is not False:fail()
 if not isinstance(j,dict) or j.get('state')!='stopped' or j.get('lifecycle')!='HARD_STOP' or j.get('phase')!='PREP' or j.get('pending') is not None or j.get('w0') is not None or j.get('expiresAt') is not None or j.get('mutated') is not False or j.get('rpc')!={'beganAt':None,'complete':False} or j.get('finished') is not False or not integer(j.get('lastAt')) or not prior_time<=j['lastAt']<=now or len(j.get('events',[]))!=55 or j.get('plan') is not None or len(j.get('publisherStages',[]))!=1 or j['publisherStages'][0].get('stage')!='baseline' or j['publisherStages'][0].get('stageCap')!=9 or j.get('futureOrdinaryUi')!=64 or j.get('nativeCurrentVisual') is not True or len(j.get('nativeImported',[]))!=17 or len(j.get('publisherImported',[]))!=3:fail()
 if any(e.get('settled') is not True for e in j['events']) or any(e.get('lane')!='ui' or e.get('success') is not True for e in j['events'][55:]) or not integer(j['nativeImported'][0].get('bookkeptAt')):fail()
 if not j.get('holders') or j.get('holder')!=claim.get('ownerHash') or j['holders'][-1]!=j['holder'] or len(set(j['holders']))!=len(j['holders']):fail()
 return j,claim,raw

def predebit_transition(path,registry,identity,j,raw,pins,proof_pin,now,g,interrupt=None):
 """The inherited fd3 exclusive lock is held throughout this ordered CAS."""
 fail=g['fail'];sha=g['sha'];compact=g['compact'];rawfile=g['rawfile'];record=g['record'];save=g['save'];synced=g['synced'];directory=g['directory']
 archives={key:Path(str(path)+'-origin-'+key+'.json') for key in ['journal','claim','stop','registry']};initial={key:Path(str(path)+'-initial-'+key+'.json') for key in ['claim','journal']};receipt=Path(str(path)+'-transition.json')
 claim_path=Path(str(path)+'-claim.json');journal_path=Path(str(path)+'.json');stop_path=Path(str(path)+'-stop.json')
 if any(os.path.lexists(p) for p in [*archives.values(),*initial.values(),receipt,claim_path,journal_path,stop_path]):fail()
 def write_bytes(p,data):
  directory(p.parent);fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  try:
   with os.fdopen(fd,'wb',closefd=False) as f:f.write(data);f.flush();os.fsync(fd)
  finally:os.close(fd)
  d=os.open(p.parent,os.O_RDONLY)
  try:os.fsync(d)
  finally:os.close(d)
  if rawfile(p)!=data:fail()
 def phase(name):
  if interrupt==name:raise RuntimeError('SYNTHETIC_INTERRUPTION')
 previous=record(Path(pins['claim']['path']));target=copy.deepcopy(j);target['connection']['sourceChain'].append({'identitySha256':sha(json.dumps(previous,separators=(',',':')).encode()),'sources':copy.deepcopy(previous['sources'])});target.update(state='ready',lifecycle='ACTIVE',holder=identity['ownerHash'],lastAt=now);target['holders'].append(identity['ownerHash'])
 if len(set(target['holders']))!=len(target['holders']) or target['events']!=j['events'] or target['failures']!=j['failures'] or target['nativeImported']!=j['nativeImported'] or target['publisherImported']!=j['publisherImported']:fail()
 for key,p in archives.items():write_bytes(p,raw[key]);phase('archive-'+key)
 target_bytes={'claim':compact({'value':identity,'sha256':sha(compact(identity).encode())}).encode(),'journal':compact(target).encode()}
 for key,p in initial.items():write_bytes(p,target_bytes[key]);phase('initial-'+key)
 manifest={'source':'native128-predebit-recovery-transition-v1','status':'PREPARED','origin':copy.deepcopy(pins),'proofSha256':proof_pin['sha256'],'archive':{key:{'path':str(p),'sha256':sha(raw[key])} for key,p in archives.items()},'initial':{key:{'path':str(p),'sha256':sha(target_bytes[key])} for key,p in initial.items()},'targetAt':now,'targetClaimSha256':sha(target_bytes['claim']),'targetJournalSha256':sha(target_bytes['journal']),'ownerHash':identity['ownerHash'],'events':55,'mainSpent':53,'uiSpent':75,'combinedSpent':128,'operationBudget':296}
 write_bytes(receipt,compact(manifest).encode());phase('receipt')
 save(claim_path,identity,True);phase('claim')
 synced(journal_path,target,True);phase('journal')
 if rawfile(claim_path)!=target_bytes['claim'] or rawfile(journal_path)!=target_bytes['journal'] or sha(rawfile(initial['claim']))!=manifest['targetClaimSha256'] or sha(rawfile(initial['journal']))!=manifest['targetJournalSha256'] or sha(rawfile(receipt))!=sha(compact(manifest).encode()):fail()
 if sha(rawfile(registry))!=pins['registry']['sha256'] or record(registry)!={'identity':record(Path(pins['claim']['path'])),'checkpoint':j}:fail()
 save(registry,{'identity':identity,'checkpoint':target});phase('registry')
 return target

def native_grounding_count(stage_cap,map_rows):
 if not 6<=stage_cap<=9:return -1
 rows=[m['descriptor']for m in map_rows if m.get('lane')=='ui']
 if len(rows)!=stage_cap:return -1
 expected=NATIVE_BASELINE+NATIVE_GROUNDING[:stage_cap-6]
 return stage_cap-6 if all((row.get('key'),row.get('target'),row.get('preparation'))==(shape[0],shape[1],shape[3]) and (row.get('operation')==shape[2] or i==7 and row.get('operation')=='snapshot') and row.get('actor')=='publisher' and row.get('units')==1 for i,(row,shape) in enumerate(zip(rows,expected))) else -1

def bootstrap_map_valid(rows,context):
 if type(rows)is not list or len(rows)!=3 or type(context)is not dict:return False
 for row,(identifier,method,callback) in zip(rows,BOOTSTRAP):
  if type(row)is not dict or row.get('lane')!='ui' or row.get('descriptor')!={'id':identifier,'key':'N:preparation','actor':'publisher','target':'oauth-audience','operation':method,'units':1,'preparation':True} or row.get('tabId')!=context.get('tabId') or row.get('url')!=context.get('url') or row.get('callback')!=callback or row.get('receipt')!='SANITIZED_READ' or row.get('privacy')!='NO_SECRET_VALUES' or row.get('cleanup')!=[] or row.get('repairIncident') is not None:return False
 return True

def bootstrap_proof_valid(proof,method,context):
 if type(proof)is not dict or proof.get('source')!='publisher-bootstrap-context-v1' or proof.get('fieldsRead') is not False:return False
 common={'source':'publisher-bootstrap-context-v1','browserId':context['browserId'],'fieldsRead':False}
 if method=='getBrowser':return proof=={**common,'kind':'BROWSER_BOUND'}
 if method=='claimTab':return proof=={**common,'kind':'TAB_CLAIMED','tabId':context['tabId']}
 if method=='evaluate':return proof.get('headingMatched') is True and proof.get('identityPending') is True and proof=={**common,'kind':'AUDIENCE_CONTEXT','tabId':context['tabId'],'url':context['url'],'projectHash':context['projectHash'],'readyState':'COMPLETE','headingMatched':True,'identityPending':True}
 return False

def baseline_identity_proof_valid(proof,method,meta,context,publisher_hash):
 if type(proof)is not dict:return False
 common={'browserId':context['browserId'],'tabId':context['tabId'],'url':meta['url'],'fieldsRead':False}
 if method=='navigate':return proof=={**common,'source':'publisher-baseline-navigation-v1','status':'AWAITING_NEXT_PROJECTION'}
 if method=='evaluate':return proof=={**common,'source':'publisher-baseline-identity-v1','status':'VERIFIED','projectHash':context['projectHash'],'principalHash':publisher_hash,'readyState':'COMPLETE'}
 return False

def repair_allowed(incidents,incident,used_for_incident,used_total):
 return all(type(v)is int for v in [incidents,incident,used_for_incident,used_total]) and 1<=incident<=incidents<=2 and 0<=used_for_incident<3 and 0<=used_total<6

def stage_clock_valid(phase,w0):
 return phase=='PREP' and w0 is None or phase=='TRIAL' and type(w0)is int and w0>0

def validate_stage_rows(q,plan,ids,main_keys,cleanup_ids,cleanup_keys,ui_cleanup,main_cleanup,g,fail):
 exact=g['exact'];seen=set()
 for m in q['map']:
  if not exact(m,['lane','descriptor','tabId','url','callback','receipt','privacy','cleanup','repairIncident']) or m['lane']not in ['ui','main'] or type(m['descriptor'])is not dict or type(m['tabId'])is not str or not m['tabId'] or type(m['url'])is not str or not m['url'].startswith('https://') or type(m['callback'])is not str or not g['valid_id'](m['callback']) or m['receipt']not in ['SANITIZED_READ','EXACT_WRITE_READBACK'] or m['privacy']!='NO_SECRET_VALUES' or type(m['cleanup'])is not list or m['repairIncident'] is not None and (type(m['repairIncident'])is not int or m['repairIncident']not in [1,2]):fail()
  op=m['descriptor'];g['descriptor'](op,m['lane'])
  if plan is not None and (m['lane']=='main' and op not in plan['operations'] or m['lane']=='ui' and not op['preparation'] and op not in plan['browserOperations']):fail()
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
   if plan is not None and clean['descriptor'] not in plan['operations'if clean['lane']=='main'else'browserOperations']:fail()
   if not key.startswith(('C:','I:','J:')) or clean['lane']=='main' and key in cleanup_keys or clean['receipt']!=expected or clean['descriptor']['id']in ids or clean['descriptor']['id']in seen or clean['descriptor']['id']in cleanup_ids:fail()
   cleanup_ids.add(clean['descriptor']['id'])
   if clean['lane']=='main':cleanup_keys.add(key)
   if clean['lane']=='ui':ui_cleanup+=1
   else:main_cleanup+=1
  seen.add(op['id'])
 if ui_cleanup>16 or main_cleanup>21:fail()
 return ui_cleanup,main_cleanup

def alignment_class(base):
 g=base.__init__.__globals__;fail=g['fail'];exact=g['exact'];pin=g['private_pin'];record=g['record'];rawfile=g['rawfile'];sha=g['sha'];save=g['save_record'];integer=g['integer']
 def pinned(v):
  if not exact(v,['path','sha256']):fail()
  return pin(v)
 def truth(d,values):
  if type(d)is not dict or any(type(d.get(k))is not type(v) or d.get(k)!=v for k,v in values.items()):fail()
 class PublisherAlignmentLedger(base):
  aligned105=True
  def __init__(self,cfg,cleanup=False):
   p=cfg.get('readonlyConnection',{}).get('repair92',{}).get('diagnostic93',{}).get('owner94',{}).get('inventory97',{}).get('retarget99',{}).get('launch100',{}).get('shared101',{}).get('aligned105',{})
   self.native_successor='nativeSuccessor' in p
   self.predebit_recovery=self.native_successor and 'predebitRecovery' in cfg.get('resume',{})
   self.predebit_spec=copy.deepcopy(cfg.get('resume',{}).get('predebitRecovery')) if self.predebit_recovery else None
   self.imported_delta=0
   super().__init__(cfg,cleanup)
  def ordinary_ceiling(self):return 148
  def prepared_checkpoint(self,j):
   d=j.get('publisherAlignment',{});return d.get('maximum')==6 and d.get('used')==6 and d.get('settingsVerified') is True and (d.get('audienceVerified') is True or self.native_successor and d.get('audienceVerified') is False and j.get('nativeCurrentVisual') is True) and 0<=d.get('readonlyIncidents',-1)<=2 and 0<=d.get('repairCalls',-1)<=6 and 0<=d.get('diagnosticCalls',-1)<=20-self.imported_delta and j['phase']=='PREP' and j['w0'] is None
  def validate_alignment(self):
   old101,claim101=self.validate_shared();p=self.cfg['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99']['launch100']['shared101']['aligned105']
   names=['journal','claim','registry','stop','result','audit'];charges=['diagnostic','inventory','binding']
   if not exact(p,['decisionHash','approval','origin','charges','closure']+(['nativeSuccessor']if self.native_successor else [])) or p['decisionHash']!=DECISION or not exact(p['origin'],names) or not exact(p['charges'],charges):fail()
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
  def validate_native_successor(self,old105,before_write=False):
   p=self.cfg['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99']['launch100']['shared101']['aligned105']['nativeSuccessor']
   if not exact(p,['closure']):fail()
   closure=json.loads(pinned(p['closure']))
   names=['journal','claim','stop','registry','receipt','audit'];visual_names=['beforeGuard','screenshot','afterGuard','attestation']
   if not exact(closure,['source','origin','contract','context','approval','validatorSource','sourceReview','ci','faultSource','faultHighwaters','charges','visual','finalSpent','mainSpent','uiSpent','operationBudget','pending','allSettled']) or closure['source']!='publisher-native-successor-closure-v1' or not exact(closure['origin'],names) or not exact(closure['visual'],visual_names):fail()
   originals={k:pinned(v) for k,v in closure['origin'].items()};j=json.loads(originals['journal']);claim=record(Path(closure['origin']['claim']['path']))
   live=str(self.path)+'.simple-publisher-alignment'
   for key,end in [('journal','.json'),('claim','-claim.json'),('stop','-stop.json')]:
    if sha(rawfile(Path(live+end)))!=sha(originals[key]):fail()
   if record(Path(closure['origin']['stop']['path']))!={'identity':claim} or record(Path(closure['origin']['registry']['path']))!={'identity':claim,'checkpoint':j}:fail()
   if before_write and record(self.registry)!={'identity':claim,'checkpoint':j}:fail()
   historical=copy.deepcopy(self.identity);historical.pop('ownerHash');historical.pop('sources');historical['readonlyConnection']['repair92']['diagnostic93']['owner94']['inventory97']['retarget99']['launch100']['shared101']['aligned105'].pop('nativeSuccessor')
   if not exact(claim,list(historical)+['sources','ownerHash']) or any(claim[k]!=v for k,v in historical.items()) or not isinstance(claim['sources'],list) or not claim['sources'] or claim['ownerHash']==self.identity['ownerHash']:fail()
   d=j.get('publisherAlignment',{});events=j.get('events',[])
   if len(events)!=55 or events[:49]!=old105['events'] or j.get('state')!='stopped' or j.get('lifecycle')!='HARD_STOP' or j.get('phase')!='PREP' or j.get('pending') is not None or j.get('w0') is not None or j.get('expiresAt') is not None or j.get('mutated') is not False or j.get('rpc')!={'beganAt':None,'complete':False} or j.get('plan') is not None or j.get('publisherStages')!=[] or j.get('futureOrdinaryUi')!=90 or d.get('maximum')!=6 or d.get('used')!=6 or d.get('settingsVerified') is not True or d.get('audienceVerified') is not False or j.get('failures')!=old105['failures']+1 or not integer(j.get('lastAt')) or j['lastAt']>self.cfg['now'] or len(j.get('publisherImported',[]))!=3:fail()
   for n,(stage,method,target) in enumerate(STEPS):
    e=events[49+n];op={'id':'publisher105-n'+str(n+1)+'-'+stage,'key':'N:preparation','actor':'publisher','target':target,'operation':method,'units':1,'preparation':True}
    if e.get('operation')!=op or e.get('lane')!='ui' or e.get('settled') is not True or e.get('success') is not (n<5) or not integer(e.get('time')) or e['time']<old105['lastAt'] or e['time']>j['lastAt']:fail()
   contract=json.loads(pinned(closure['contract']));context=json.loads(pinned(closure['context']));approval=json.loads(pinned(closure['approval']))
   for key in ['validatorSource','sourceReview','ci','faultSource','beforeGuard','screenshot','afterGuard']:pinned(closure['visual'][key] if key in visual_names else closure[key])
   if contract.get('source')!='approved-publisher-alignment105' or contract.get('decisionHash')!=DECISION or contract.get('operationBudget')!=296 or contract.get('publisherHash') is None or not re.fullmatch('[0-9a-f]{64}',contract['publisherHash']) or context.get('source')!='native-current-project-context-v1' or context.get('publisherHash')!=contract['publisherHash'] or context.get('url')!=contract.get('audienceURL') or any(type(context.get(k))is not str or not context[k] or len(context[k])>4096 for k in ['browserId','tabId','url']) or not re.fullmatch('[0-9a-f]{64}',context.get('projectHash','')) or approval.get('source')!='direct-human-connection118-continuation' or approval.get('scope')!='CONNECTION118_BOUNDED_NATIVE' or approval.get('approved') is not True or approval.get('directHuman') is not True or approval.get('operationBudget')!=296:fail()
   charges=closure['charges'];count=len(charges) if type(charges)is list else -1;expected=['diagnostic111']*3+['audience114']*3+['native117','discovery118']
   if count<17 or count>20 or closure['finalSpent']!=111+count or closure['finalSpent']>131 or closure['mainSpent']!=53 or closure['uiSpent']!=58+count or closure['operationBudget']!=296 or closure['pending'] is not None or closure['allSettled'] is not True or count>20 or 90-count<70 or [c.get('stage') for c in charges[:8]]!=expected or [c.get('stage') for c in charges[-3:]]!=['GUARD','CAPTURE','GUARD']:fail()
   h=closure['faultHighwaters'];failed=sum(c.get('outcome')!='VERIFIED' for c in charges);fault=json.loads(pinned(closure['faultSource']))
   if h!={'globalRepairCallsUsed':6,'globalRepairCallsRemaining':0,'readonlyIncidents':2,'importedFailedCalls':failed} or fault.get('source')!='audience114-actual-three-read-structure-closure' or fault.get('originalGlobalRepairCallsUsed')!=6 or fault.get('originalGlobalRepairCallsRemaining')!=0 or failed<3:fail()
   prior=closure['origin']['journal']['sha256'];nonces=set();reservation_times=[]
   for n,c in enumerate(charges,112):
    historical='VERIFICATION_REJECTED' if n in [114,117] else 'REJECTED' if n==118 else 'VERIFIED'
    if not exact(c,['spent','stage','nonce','commandSha256','priorOutcomeSha256','reservation','settlement','outcome','reservationAt','providerCallAt']) or c['spent']!=n or c['priorOutcomeSha256']!=prior or n<=119 and c['outcome']!=historical or n>=120 and c['outcome'] not in ['VERIFIED','QUALIFIED_TECHNICAL','VERIFICATION_REJECTED','UNKNOWN'] or c['providerCallAt'] is not None or n>=120 and c['stage'] not in ['BIND','OPEN_TABS','CLAIM','GUARD','CAPTURE']:fail()
    # The first six historical diagnostic receipts have no nonce or command hash.
    if n<=117:
     if c['nonce'] is not None or c['commandSha256'] is not None or c['reservationAt'] is not None:fail()
    elif c['nonce'] in nonces or not isinstance(c['nonce'],str) or not re.fullmatch('[0-9a-f]{32}',c['nonce']) or not isinstance(c['commandSha256'],str) or not re.fullmatch('[0-9a-f]{64}',c['commandSha256']):fail()
    if n<=119 and c['reservationAt'] is not None:fail()
    if n>=120:
     t=c['reservationAt']
     if type(t) not in [int,float] or t<0 or t==float('inf') or t!=t or reservation_times and t<reservation_times[-1]:fail()
     reservation_times.append(t)
    pinned(c['reservation']);pinned(c['settlement']);
    if c['nonce'] is not None:nonces.add(c['nonce'])
    prior=c['settlement']['sha256']
   a=json.loads(pinned(closure['visual']['attestation']))
   if not exact(a,['source','observedPrincipalHash','expectedPrincipalHash','browserId','tabId','url','projectHash','screenshotSha256','beforeGuardSha256','afterGuardSha256','sameHandle','samePage','menuOpen','manualObservation']) or a['source']!='parent-native-b-visual-attestation-v1' or a['observedPrincipalHash']!=contract['publisherHash'] or a['expectedPrincipalHash']!=contract['publisherHash'] or any(a[k]!=context[k] for k in ['browserId','tabId','url','projectHash']) or a['screenshotSha256']!=closure['visual']['screenshot']['sha256'] or a['beforeGuardSha256']!=closure['visual']['beforeGuard']['sha256'] or a['afterGuardSha256']!=closure['visual']['afterGuard']['sha256'] or any(a[k] is not True for k in ['sameHandle','samePage','menuOpen','manualObservation']):fail()
   self.imported_delta=count;self.approvedBrowserId=context['browserId'];self.native_context=context;self.native_publisher_hash=contract['publisherHash'];self.native_settings_url=contract['settingsURL']
   return j,claim,charges
  def resume_preparation(self,p):
   origin,prior,approval=self.validate_alignment();self.approvedBrowserId=approval['selectedBrowserId'];self.approvedProfile=approval['selectedProfile'];owner=sha(self.cfg['ownerNonce'].encode());fresh=p=={'aligned105':True}
   if self.native_successor:
    if self.predebit_recovery and exact(p,['nativeSuccessor','predebitRecovery']):
     if p['nativeSuccessor'] is not True or p['predebitRecovery']!=self.predebit_spec or not exact(self.predebit_spec,['proof','origin']):fail()
     imported,claim,charges=self.validate_native_successor(origin,False)
     prior_suffix='.simple-publisher-native-successor';base=str(self.path)+prior_suffix
     paths={'journal':Path(base+'.json'),'claim':Path(base+'-claim.json'),'stop':Path(base+'-stop.json'),'registry':self.registry}
     j,previous,raw=predebit_evidence(paths,self.predebit_spec['origin'],self.predebit_spec['proof'],{**PREDEBIT_ORIGIN,'proof':PREDEBIT_PROOF},self.registry,imported['lastAt'],self.cfg['now'],{**g,'pin':g['pin'],'compact':g['compact']})
     if j['events'][:55]!=imported['events'] or j['publisherStages'][0].get('stageCap')!=9 or native_grounding_count(9,j['publisherStages'][0].get('map',[]))!=3 or j['failures']!=imported['failures']+sum(c['outcome']!='VERIFIED'for c in charges) or j['publisherAlignment']['readonlyIncidents']!=2 or j['publisherAlignment']['repairCalls']!=6 or j['publisherAlignment']['diagnosticCalls']!=0 or j['chargedUpperBoundMs']!=imported['chargedUpperBoundMs']:fail()
     if len(j['nativeImported'])!=len(charges) or any(row['spent']!=charge['spent'] or row['reservationSha256']!=charge['reservation']['sha256'] or row['settlementSha256']!=charge['settlement']['sha256'] or row['providerCallAt'] is not None for row,charge in zip(j['nativeImported'],charges)):fail()
     if {k:v for k,v in previous.items()if k not in ['sources','ownerHash']}!={k:v for k,v in self.identity.items()if k not in ['sources','ownerHash']} or not previous['sources'] or not self.identity['sources'] or owner in j['holders']:fail()
     for source in previous['sources']:g['pin'](source)
     self.j=predebit_transition(Path(str(self.path)+self.suffix),self.registry,self.identity,j,raw,self.predebit_spec['origin'],self.predebit_spec['proof'],self.cfg['now'],{**g,'save':save,'synced':g['synced'],'directory':g['directory'],'compact':g['compact']})
     self.memory=copy.deepcopy(self.j);return
    if self.predebit_recovery:
     if not exact(p,['nativeSuccessor','predebitRecovery','receipt','minimumEvents']) or p['predebitRecovery']!=self.predebit_spec:fail()
     self.verify_predebit_anchor()
     p={k:v for k,v in p.items()if k!='predebitRecovery'}
    native_fresh=p=={'nativeSuccessor':True}
    if self.predebit_recovery and native_fresh:fail()
    if not native_fresh and (not exact(p,['nativeSuccessor','receipt','minimumEvents']) or p['nativeSuccessor'] is not True or not integer(p['minimumEvents'])):fail()
    imported,claim,charges=self.validate_native_successor(origin,native_fresh)
    if native_fresh:
     if any(os.path.lexists(x)for x in [self.journal,self.claim,self.stop_path]) or owner in imported['holders']:fail()
     j=copy.deepcopy(imported);j['connection']['sourceChain'].append({'identitySha256':sha(json.dumps(claim,separators=(',',':')).encode()),'sources':copy.deepcopy(claim['sources'])});j.update(state='ready',lifecycle='ACTIVE',holder=owner,lastAt=self.cfg['now'],nativeCurrentVisual=True,futureOrdinaryUi=90-self.imported_delta)
     j['failures']+=sum(c['outcome']!='VERIFIED' for c in charges);j['publisherAlignment']['readonlyIncidents']=2;j['publisherAlignment']['repairCalls']=6
     j['holders'].append(owner);j['nativeImported']=[{'spent':c['spent'],'reservationSha256':c['reservation']['sha256'],'settlementSha256':c['settlement']['sha256'],'bookkeptAt':self.cfg['now'],'reservationAt':c['reservationAt'],'providerCallAt':None}for c in charges]
     self.j=j;save(self.claim,self.identity,True);self.persist();return
    raw=rawfile(self.journal);rr=rawfile(self.registry);j=json.loads(raw);previous=record(self.claim)
    if record(self.registry)!={'identity':previous,'checkpoint':j} or p['minimumEvents']!=len(j['events']) or p['receipt']['path']!=str(self.path)+self.suffix+'-handoff-'+str(len(j['holders']))+'.json' or 'publisherAReadiness' in j:fail()
    self.verify_receipt(json.loads(g['pin'](p['receipt'])),j,raw,rr)
    stable=lambda x:{k:v for k,v in x.items()if k not in ['sources','ownerHash']}
    if stable(previous)!=stable(self.identity) or self.identity['sources'][:len(previous['sources'])]!=previous['sources'] or not previous['sources'] or j['events'][:55]!=imported['events'] or j['state']!='ready' or j['lifecycle']!='CLEAN_PAUSE' or j['phase']!='PREP' or j['pending'] is not None or j['mutated'] is not False or j['w0'] is not None or j['expiresAt'] is not None or j['rpc']!={'beganAt':None,'complete':False} or j['chargedUpperBoundMs']!=imported['chargedUpperBoundMs'] or j['finished'] is not False or j['plan'] is not None or os.path.lexists(self.stop_path) or owner in j['holders'] or j['holder']!=previous['ownerHash'] or j['holders'][-1]!=j['holder'] or self.cfg['now']<j['lastAt'] or j.get('nativeCurrentVisual') is not True or not self.prepared_checkpoint(j):fail()
    chain=j['connection']['sourceChain'];oldchain=imported['connection']['sourceChain']
    if chain[:len(oldchain)]!=oldchain or len(chain)!=len(oldchain)+len(j['holders'])-len(imported['holders']) or chain[len(oldchain)]!={'identitySha256':sha(json.dumps(claim,separators=(',',':')).encode()),'sources':claim['sources']}:fail()
    for entry in chain[len(oldchain):]:
     if not exact(entry,['identitySha256','sources']) or not re.fullmatch('[0-9a-f]{64}',entry['identitySha256']) or type(entry['sources']) is not list or not entry['sources']:fail()
     for source in entry['sources']:g['pin'](source)
    for source in previous['sources']:g['pin'](source)
    native=j.get('nativeImported',[])
    if len(native)!=self.imported_delta or any(not exact(row,['spent','reservationSha256','settlementSha256','bookkeptAt','reservationAt','providerCallAt']) or row['spent']!=charge['spent'] or row['reservationSha256']!=charge['reservation']['sha256'] or row['settlementSha256']!=charge['settlement']['sha256'] or row['reservationAt']!=charge['reservationAt'] or row['providerCallAt'] is not None or not integer(row['bookkeptAt']) or not imported['lastAt']<=row['bookkeptAt']<=j['lastAt'] for row,charge in zip(native,charges)) or len({row['bookkeptAt']for row in native})!=1 or j.get('publisherImported')!=imported['publisherImported']:fail()
    stages=j.get('publisherStages',[])
    if len(stages)>(2 if self.predebit_recovery else 1) or stages and (stages[0].get('stage')!='baseline' or not 6<=stages[0].get('stageCap',0)<=9 or sum(m.get('lane')=='ui'for m in stages[0].get('map',[]))!=stages[0]['stageCap'] or native_grounding_count(stages[0]['stageCap'],stages[0]['map'])!=stages[0]['stageCap']-6):fail()
    if self.predebit_recovery and (len(stages)<1 or stages[0]['stageCap']!=9 or any(m['tabId']!=self.native_context['tabId'] or m['url']!=self.native_settings_url for m in stages[0]['map'][:2]) or len(stages)==2 and (stages[1].get('stage')!='diagnostic' or stages[1].get('stageCap')!=3 or not bootstrap_map_valid(stages[1].get('map'),self.native_context))):fail()
    ids={e['operation']['id']for e in imported['events']};main_keys=set(imported['stages']);cleanup_ids=set();cleanup_keys=set();ui_cleanup=main_cleanup=0
    for stage in stages:
     ui_cleanup,main_cleanup=validate_stage_rows(stage,None,ids,main_keys,cleanup_ids,cleanup_keys,ui_cleanup,main_cleanup,g,fail)
     ids.update(m['descriptor']['id']for m in stage['map'])
    mapped={m['descriptor']['id']:m['descriptor'] for stage in stages for m in stage['map'] if m['lane']=='ui' and m['descriptor']['preparation'] is True}
    extra=j['events'][55:];seen=set();diagnostic_count=0;baseline_count=0
    last=imported['lastAt']
    for position,event in enumerate(extra):
     operation=event.get('operation',{})
     if event.get('lane')!='ui' or event.get('cleanup') is not False or event.get('settled') is not True or event.get('success') is not True or event.get('outcome')!='UNKNOWN' or operation.get('id') not in mapped or operation!=mapped[operation['id']] or event.get('preparationStage')!=operation['id'] or operation['id'] in seen or not integer(event.get('time')) or not last<=event['time']<=j['lastAt']:fail()
     if self.predebit_recovery:
      if operation['id'].startswith('future-bootstrap-'):
       if len(stages)!=2 or diagnostic_count>=3 or operation!=stages[1]['map'][diagnostic_count]['descriptor'] or not bootstrap_proof_valid(event.get('bootstrapProof'),operation['operation'],self.native_context) or (operation['operation']=='evaluate')!=(event.get('loadingResultVerified') is True):fail()
       diagnostic_count+=1
      else:
       baseline_index=position-diagnostic_count
       if len(stages)!=2 or diagnostic_count!=3 or baseline_index>=5 or operation!=stages[0]['map'][BOOTSTRAP_BASELINE_ORDER[baseline_index]]['descriptor'] or 'bootstrapProof' in event:fail()
       if baseline_index<2 and (not baseline_identity_proof_valid(event.get('baselineIdentityProof'),operation['operation'],stages[0]['map'][baseline_index],self.native_context,self.native_publisher_hash) or (operation['operation']=='evaluate')!=(event.get('loadingResultVerified') is True)):fail()
       if baseline_index>=2 and 'baselineIdentityProof' in event:fail()
       baseline_count+=1
     seen.add(operation['id']);last=event['time']
    if j['futureOrdinaryUi']!=90-self.imported_delta-sum(stage['stageCap']for stage in stages) or j['failures']!=imported['failures']+sum(c['outcome']!='VERIFIED'for c in charges) or j['publisherAlignment']['readonlyIncidents']!=2 or j['publisherAlignment']['repairCalls']!=6 or j['publisherAlignment']['diagnosticCalls']!=(diagnostic_count if self.predebit_recovery else 0):fail()
    if self.predebit_recovery and (len(stages)==2 and j.get('bootstrapIdentity')!=('VERIFIED' if baseline_count>=2 else 'PENDING') or len(stages)==1 and 'bootstrapIdentity' in j):fail()
    if j['holders'][:len(imported['holders'])]!=imported['holders'] or len(set(j['holders']))!=len(j['holders']):fail()
    # Rebuild the only legitimate PREP delta from the immutable 105 checkpoint.
    # A matching local receipt does not authorize altered inherited counters or
    # independently edited stage/recovery projections.
    expected=copy.deepcopy(imported)
    expected['connection']['sourceChain']=copy.deepcopy(chain)
    expected.update(state='ready',lifecycle='CLEAN_PAUSE',holder=j['holder'],holders=copy.deepcopy(j['holders']),lastAt=j['lastAt'],events=copy.deepcopy(j['events']),failures=imported['failures']+sum(c['outcome']!='VERIFIED'for c in charges),futureOrdinaryUi=90-self.imported_delta-sum(stage['stageCap']for stage in stages),nativeCurrentVisual=True,nativeImported=copy.deepcopy(native),publisherStages=copy.deepcopy(stages))
    expected['publisherAlignment']['readonlyIncidents']=2;expected['publisherAlignment']['repairCalls']=6
    if self.predebit_recovery:
     expected['publisherAlignment']['diagnosticCalls']=diagnostic_count
     if len(stages)==2:expected['bootstrapIdentity']='VERIFIED' if baseline_count>=2 else 'PENDING'
    prior_stage_units=0
    for stage in stages:
     for meta in stage['map']:
      if not exact(meta,['lane','descriptor','tabId','url','callback','receipt','privacy','cleanup','repairIncident']) or meta['lane'] not in ['ui','main'] or type(meta['descriptor']) is not dict or type(meta['cleanup']) is not list or meta['repairIncident'] is not None or meta['privacy']!='NO_SECRET_VALUES':fail()
      op=meta['descriptor'];key=g['descriptor'](op,meta['lane'])
      if meta['lane']=='ui':
       if op['preparation'] is True:expected['preparationStages'][op['id']]={'operations':[copy.deepcopy(op)],'remainingOrdinaryUi':self.future_limit()-prior_stage_units-stage['stageCap']}
       else:expected['stageBrowser'].append(copy.deepcopy(op))
      else:expected['stages'][key]=copy.deepcopy(op)
      for clean in meta['cleanup']:
       if not exact(clean,['lane','descriptor','target','tabId','url','callback','receipt']) or clean['lane'] not in ['ui','main'] or clean['target']!=clean['descriptor'].get('target') or not g['descriptor'](clean['descriptor'],clean['lane']).startswith(('C:','I:','J:')):fail()
       if clean['lane']=='ui':expected['recoveryBrowser'].append(copy.deepcopy(clean['descriptor']))
     prior_stage_units+=stage['stageCap']
    if j!=expected:fail()
    j['connection']['sourceChain'].append({'identitySha256':sha(json.dumps(previous,separators=(',',':')).encode()),'sources':copy.deepcopy(previous['sources'])});j.update(lifecycle='ACTIVE',holder=owner,lastAt=self.cfg['now']);j['holders'].append(owner)
    self.j=j;save(self.claim,self.identity);self.persist();return
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
  def current(self):
   old,_,_=self.validate_alignment()
   if self.native_successor:self.validate_native_successor(old)
   if self.predebit_recovery:self.verify_predebit_anchor()
   return super().current()
  def verify_predebit_anchor(self):
   pins=self.predebit_spec['origin'];base=str(self.path)+'.simple-publisher-native-successor'
   for key,end in [('journal','.json'),('claim','-claim.json'),('stop','-stop.json')]:
    if pins[key]['path']!=base+end or sha(rawfile(Path(base+end)))!=pins[key]['sha256']:fail()
   if self.predebit_spec['proof']['sha256']!=PREDEBIT_PROOF or sha(g['pin'](self.predebit_spec['proof']))!=PREDEBIT_PROOF:fail()
   archives={key:Path(str(self.path)+self.suffix+'-origin-'+key+'.json') for key in ['journal','claim','stop','registry']};initial={key:Path(str(self.path)+self.suffix+'-initial-'+key+'.json') for key in ['claim','journal']};receipt=Path(str(self.path)+self.suffix+'-transition.json')
   if pins['registry']['sha256']!=PREDEBIT_ORIGIN['registry'] or any(sha(rawfile(p))!=pins[key]['sha256'] for key,p in archives.items()):fail()
   r=json.loads(rawfile(receipt))
   if not exact(r,['source','status','origin','proofSha256','archive','initial','targetAt','targetClaimSha256','targetJournalSha256','ownerHash','events','mainSpent','uiSpent','combinedSpent','operationBudget']) or r['source']!='native128-predebit-recovery-transition-v1' or r['status']!='PREPARED' or r['origin']!=pins or r['proofSha256']!=PREDEBIT_PROOF or r['archive']!={key:{'path':str(p),'sha256':pins[key]['sha256']} for key,p in archives.items()} or r['events']!=55 or r['mainSpent']!=53 or r['uiSpent']!=75 or r['combinedSpent']!=128 or r['operationBudget']!=296:fail()
   old=json.loads(rawfile(archives['journal']));previous=record(archives['claim']);first=record(initial['claim']);at=r['targetAt']
   if not integer(at) or at<old['lastAt'] or not exact(first,list(previous)) or {k:v for k,v in first.items()if k not in ['sources','ownerHash']}!={k:v for k,v in previous.items()if k not in ['sources','ownerHash']} or first['ownerHash']==previous['ownerHash'] or not first['sources']:fail()
   target=copy.deepcopy(old);target['connection']['sourceChain'].append({'identitySha256':sha(json.dumps(previous,separators=(',',':')).encode()),'sources':copy.deepcopy(previous['sources'])});target.update(state='ready',lifecycle='ACTIVE',holder=first['ownerHash'],lastAt=at);target['holders'].append(first['ownerHash'])
   expected={'claim':g['compact']({'value':first,'sha256':sha(g['compact'](first).encode())}).encode(),'journal':g['compact'](target).encode()}
   if r['initial']!={key:{'path':str(p),'sha256':sha(expected[key])} for key,p in initial.items()} or any(rawfile(p)!=expected[key] for key,p in initial.items()) or r['targetClaimSha256']!=sha(expected['claim']) or r['targetJournalSha256']!=sha(expected['journal']) or r['ownerHash']!=first['ownerHash']:fail()
  def view(self,wait=0):
   v=super().view(wait);d=self.j['publisherAlignment'];delta=self.imported_delta if self.native_successor else 0;v.update(uiSpent=v['uiSpent']+3+delta,combinedSpent=v['combinedSpent']+3+delta,eventCount=len(self.j['events']),uiOrdinary=v['uiOrdinary']+3+delta,uiOrdinaryLimit=148,uiLimit=164,combinedLimit=296,publisherUsed=d['used'],settingsVerified=d['settingsVerified'],audienceVerified=d['audienceVerified'],readonlyIncidents=d['readonlyIncidents'],repairCalls=d['repairCalls'],diagnosticCalls=d['diagnosticCalls'],futureUiSpent=self.future_spent(),trialMapReady=self.trial_map_ready(),approvedBrowserId=self.approvedBrowserId,approvedProfile=self.approvedProfile)
   if self.native_successor:v.update(successorImported=delta,futureUiLimit=90-delta,currentVisualVerified=self.j.get('nativeCurrentVisual') is True)
   if self.predebit_recovery:v.update(bootstrapIdentity=self.j.get('bootstrapIdentity'),baselineIdentityDescriptors=[copy.deepcopy(m['descriptor'])for m in self.j['publisherStages'][0]['map'][:2]] if self.j.get('publisherStages') else [])
   return v
  def preparation_complete(self):return self.j.get('publisherAlignment',{}).get('used')==6 and self.j['publisherAlignment']['settingsVerified'] and (self.j['publisherAlignment']['audienceVerified'] or self.native_successor and self.j.get('nativeCurrentVisual') is True)
  def future_spent(self):return sum(e['lane']=='ui' and not e['cleanup'] for e in self.j['events'][55:])
  def future_limit(self):return 90-self.imported_delta
  def publisher_a_project_map(self):
   stages=self.j.get('publisherStages',[])
   if len(stages)<2 or stages[0].get('stage')!='baseline' or stages[0].get('stageCap')!=9 or stages[1].get('stage')!='diagnostic' or stages[1].get('stageCap')!=3:fail()
   rows=[m for stage in stages for m in stage['map'] if m.get('lane')=='main' and m.get('descriptor',{}).get('bucket')=='A' and m['descriptor'].get('alias')=='original-project']
   if len(rows)!=1 or rows[0]['descriptor'].get('id')!='future-baseline-original-project' or self.j['stages'].get('A:original-project')!=rows[0]['descriptor']:fail()
   return rows[0]
  def publisher_a_protocol_anchor(self):
   control=Path(__file__).with_name('read-authority-simple-control.mjs').resolve()
   pins=[p for p in self.cfg['sources'] if Path(p.get('path','')).resolve()==control]
   if len(pins)!=1 or not exact(pins[0],['path','sha256']) or not g['digest'](pins[0]['sha256']):fail()
   return pins[0]['sha256']
  def publisher_a_receipt(self,receipt,source_sha):
   keys=['source','status','sourceSha256','projectContextHash','publisherPrincipalSha256','originalScriptIdSha256','cloudProjectSlugSha256','containerParentIdSha256','projectReadbackSha256','fieldsRead']
   if not exact(receipt,keys):fail()
   distinct=[receipt[k]for k in ['publisherPrincipalSha256','originalScriptIdSha256','cloudProjectSlugSha256','containerParentIdSha256']]
   if receipt['source']!='publisher-a-project-receipt-v1' or receipt['status']!='VERIFIED' or receipt['fieldsRead'] is not False or receipt['sourceSha256']!=source_sha or source_sha!=self.publisher_a_protocol_anchor() or receipt['projectContextHash']!=self.native_context['projectHash'] or receipt['publisherPrincipalSha256']!=self.native_publisher_hash or any(not g['digest'](receipt[k]) for k in ['originalScriptIdSha256','cloudProjectSlugSha256','containerParentIdSha256','projectReadbackSha256']) or len(set(distinct))!=4:fail()
  def publisher_a_project_receipt_ready(self,op):
   readiness=self.j.get('publisherAReadiness',[])
   if len(readiness)!=2 or [r['phase']for r in readiness]!=['initial','remaining'] or len(self.j['events'])<=66:return False
   receipt=self.j['events'][66].get('projectReceipt')
   if receipt is None:return False
   self.publisher_a_receipt(receipt,readiness[0]['proof']['sourceSha256'])
   if readiness[1]['proof']['projectReceiptSha256']!=sha(g['compact'](receipt).encode()):return False
   rows=[(m,p)for m,p in zip(readiness[1]['map'],readiness[1]['proof']['targetProofs'])if m['descriptor']==op]
   if len(rows)!=1:return False
   m,p=rows[0]
   return p['urlSha256']==sha(m['url'].encode()) and p['sameOriginalProject'] is True and p['readbackVerified'] is True and (op['alias']!='original-container-acl' or p.get('aclParentIdSha256')==receipt['containerParentIdSha256'])
  def publisher_a_complete(self):
   readiness=self.j.get('publisherAReadiness',[])
   if len(readiness)!=2 or [r['phase']for r in readiness]!=['initial','remaining']:return False
   completed=set(self.j['completed']);events=self.j['events'];baseline=self.j['publisherStages'][0]['map'] if len(self.j.get('publisherStages',[]))>=2 else []
   return set(PUBLISHER_A_KEYS)<=completed and len(baseline)==10 and all(any(e['operation']==m['descriptor'] and e.get('settled') is True and e.get('success') is True for e in events) for m in baseline if m['lane']=='ui') and all(any(e['key']==key and e['lane']=='main' and e.get('settled') is True and e.get('success') is True for e in events) for key in PUBLISHER_A_KEYS)
  def register_publisher_a(self,q):
   self.current();self.active(q.get('now'))
   if not self.predebit_recovery or not exact(q,['op','phase','map','proof','now']) or q['phase'] not in ['initial','remaining'] or self.j['plan'] is not None or self.j['pending'] is not None or self.j['mutated'] is not False or self.j['rpc']!={'beganAt':None,'complete':False} or self.j.get('bootstrapIdentity')!='VERIFIED' or any(e.get('settled') is not True or e.get('success') is not True for e in self.j['events'][55:]):fail()
   project=self.publisher_a_project_map();phase=q['phase'];readiness=self.j.get('publisherAReadiness',[]);expected=PUBLISHER_A_INITIAL if phase=='initial' else PUBLISHER_A_REMAINING
   if phase=='initial':
    if readiness or self.j['phase']!='PREP' or self.j['w0'] is not None or len(self.j['events'])!=63 or self.counts()[1]!=0 or [e['operation']for e in self.j['events'][55:58]]!=[m['descriptor']for m in self.j['publisherStages'][1]['map']] or [e['operation']for e in self.j['events'][58:63]]!=[self.j['publisherStages'][0]['map'][i]['descriptor']for i in BOOTSTRAP_BASELINE_ORDER[:5]]:fail()
   else:
    if len(readiness)!=1 or readiness[0]['phase']!='initial' or self.j['phase']!='TRIAL' or self.j['w0'] is None or len(self.j['events'])!=67 or self.counts()[1]!=3 or [e['operation']for e in self.j['events'][63:67]]!=[self.j['publisherStages'][0]['map'][2]['descriptor']]+[r['descriptor']for r in readiness[0]['map']]+[project['descriptor']]:fail()
   if type(q['map'])is not list or len(q['map'])!=len(expected) or self.main_ordinary_limit!=58 or self.main_event_limit!=79 or self.ui_ordinary_limit!=148 or self.ui_event_limit!=164 or self.counts()[1]+(8 if phase=='initial' else 5)>58 or len(self.j['recoveryBrowser'])>16 or self.j['futureOrdinaryUi']!=61 or self.future_limit()!=73 or self.future_spent()!=(8 if phase=='initial' else 9):fail()
   proof=q['proof'];common=['source','phase','sourceSha256','mapSha256','epoch','binding','ownerHash','originalProjectDescriptorSha256','projectContextHash','publisherPrincipalSha256','targetProofs'];extra=['projectReceiptSha256','originalScriptIdSha256','cloudProjectSlugSha256','containerParentIdSha256']if phase=='remaining' else []
   if not exact(proof,common+extra) or proof['source']!='publisher-a-readonly-readiness-v1' or proof['phase']!=phase or proof['epoch']!=self.cfg['epoch'] or proof['binding']!=self.cfg['binding'] or proof['ownerHash']!=self.identity['ownerHash'] or proof['projectContextHash']!=self.native_context['projectHash'] or proof['publisherPrincipalSha256']!=self.native_publisher_hash or proof['originalProjectDescriptorSha256']!=sha(g['compact'](project['descriptor']).encode()) or proof['mapSha256']!=sha(g['compact'](q['map']).encode()) or proof['sourceSha256']!=self.publisher_a_protocol_anchor() or type(proof['targetProofs'])is not list or len(proof['targetProofs'])!=len(expected):fail()
   if phase=='remaining':
    source=readiness[0]['proof']['sourceSha256'];event=self.j['events'][66];receipt=event.get('projectReceipt')
    if proof['sourceSha256']!=source or event['key']!='A:original-project' or event.get('settled') is not True or event.get('success') is not True or not exact(receipt,['source','status','sourceSha256','projectContextHash','publisherPrincipalSha256','originalScriptIdSha256','cloudProjectSlugSha256','containerParentIdSha256','projectReadbackSha256','fieldsRead']):fail()
    self.publisher_a_receipt(receipt,source)
    if proof['projectReceiptSha256']!=sha(g['compact'](receipt).encode()) or any(proof[k]!=receipt[k]for k in ['originalScriptIdSha256','cloudProjectSlugSha256','containerParentIdSha256']):fail()
   seen_ids={e['operation']['id']for e in self.j['events']}|{m['descriptor']['id']for stage in self.j['publisherStages']for m in stage['map']}|{m['descriptor']['id']for r in readiness for m in r['map']}
   for (key,callback),m,target_proof in zip(expected,q['map'],proof['targetProofs']):
    if not exact(m,['lane','descriptor','tabId','url','callback','receipt','privacy','cleanup','repairIncident']) or m['lane']!='main' or type(m['descriptor'])is not dict or not exact(m['descriptor'],['id','bucket','alias','actor','target','operation','units']) or m['descriptor']['id']!='future-'+key[2:] or m['descriptor']['id'] in seen_ids or m['descriptor']['bucket']+':'+m['descriptor']['alias']!=key or m['descriptor']['actor']!='publisher' or m['descriptor']['target']!=g['RULES'][key]['target'] or m['descriptor']['operation']!=g['RULES'][key]['methods'][0] or m['descriptor']['units']!=1 or m['tabId']!=self.native_context['tabId'] or type(m['url'])is not str or not m['url'].startswith('https://') or m['callback']!=callback or m['receipt']!='SANITIZED_READ' or m['privacy']!='NO_SECRET_VALUES' or m['cleanup']!=[] or m['repairIncident'] is not None or key in self.j['stages']:fail()
    target_keys=['id','urlSha256','sameOriginalProject','readbackVerified']+(['aclParentIdSha256']if key=='A:original-container-acl' else [])
    if not exact(target_proof,target_keys) or target_proof['id']!=m['descriptor']['id'] or target_proof['urlSha256']!=sha(m['url'].encode()) or target_proof['sameOriginalProject'] is not True or target_proof['readbackVerified'] is not True or key=='A:original-container-acl' and target_proof['aclParentIdSha256']!=proof['containerParentIdSha256']:fail()
    seen_ids.add(m['descriptor']['id'])
   if phase=='initial' and any(m['descriptor']['bucket']=='A' for m in q['map']):fail()
   self.j.setdefault('publisherAReadiness',[]).append({'phase':phase,'map':copy.deepcopy(q['map']),'proof':copy.deepcopy(proof)})
   for m in q['map']:self.j['stages'][m['descriptor']['bucket']+':'+m['descriptor']['alias']]=copy.deepcopy(m['descriptor'])
   self.j['lastAt']=q['now'];self.persist();return self.view()
  def rate(self,t):
   # Call timestamps are absent from imported sidecars. Bookkeeping time is a
   # conservative rate-limit floor, never represented as provider call time.
   ordinary=super().rate(t);booked=self.j.get('publisherImported',[])
   imported=self.j.get('nativeImported',[])
   if booked and t-booked[0]['bookkeptAt']<60000 or imported and t-imported[0]['bookkeptAt']<60000:
    times=[self.prior_time]*53+[e['time']for e in self.j['events']]+[booked[0]['bookkeptAt']]*3+[e['bookkeptAt']for e in imported]
    recent=sorted(x for x in times if t-x<60000);return max(ordinary,0 if len(recent)<10 else recent[-10]+60000-t)
   return ordinary
  def check(self,lane,op,t,terminal=False):
   self.current();d=self.j['publisherAlignment'];first=op.get('id','').startswith('publisher105-')
   if first:
    if lane!='ui':fail()
    self.check_loading(op)
   elif not self.preparation_complete() and not op.get('key','').startswith(('C:','I:','J:')):fail()
   if lane=='main' and op.get('bucket') not in ['C','I','J']:
    entries=[m for stage in self.j['publisherStages'] for m in stage['map'] if m['lane']=='main' and m['descriptor']==op]
    if self.predebit_recovery and self.j.get('publisherAReadiness'):
     entries+= [m for registration in self.j['publisherAReadiness'] for m in registration['map'] if m['descriptor']==op]
    if len(entries)!=1:fail()
    if self.predebit_recovery and op.get('bucket')=='P' and (not self.j.get('publisherAReadiness') or self.j['w0'] is None or self.j['phase']!='TRIAL'):fail()
    if self.predebit_recovery and op.get('bucket')=='A' and op.get('alias')!='original-project' and not self.publisher_a_project_receipt_ready(op):fail()
   if lane=='ui' and not op.get('key','').startswith(('C:','I:','J:')) and self.counts()[3]+3+self.imported_delta>=148:fail()
   if lane=='ui' and not first and not op.get('key','').startswith(('C:','I:','J:')):
    entries=[(stage,m) for stage in self.j['publisherStages']for m in stage['map'] if m['lane']=='ui' and m['descriptor']==op]
    if len(entries)!=1 or self.future_spent()>=self.future_limit():fail()
    stage,meta=entries[0]
    if self.predebit_recovery and stage['stage']=='baseline' and op==stage['map'][2]['descriptor'] and not self.j.get('publisherAReadiness'):fail()
    if self.predebit_recovery and stage['stage'] not in ['baseline','diagnostic'] and not self.publisher_a_complete():fail()
    if self.predebit_recovery and stage['stage']=='diagnostic':
     if len(self.j['publisherStages'])!=2 or d['diagnosticCalls']>=3 or op!=self.j['publisherStages'][1]['map'][d['diagnosticCalls']]['descriptor'] or self.j['events'][55:] and any(e['operation']['id'].startswith('future-baseline-') for e in self.j['events'][55:]):fail()
    if stage['stage']=='diagnostic' and d['diagnosticCalls']>=20-self.imported_delta:fail()
    if stage['stage']=='diagnostic' and meta['repairIncident'] is None and d['readonlyIncidents']>=2 and op['preparation'] is True and not self.predebit_recovery:fail()
    if meta['repairIncident'] is not None:
     used_for=sum(e['operation']['id'] in [x['descriptor']['id']for st in self.j['publisherStages']for x in st['map']if x['repairIncident']==meta['repairIncident']]for e in self.j['events'][55:])
     if not repair_allowed(d['readonlyIncidents'],meta['repairIncident'],used_for,d['repairCalls']):fail()
   if self.predebit_recovery and not op.get('key','').startswith(('C:','I:','J:')) and not first and not op.get('id','').startswith('future-bootstrap-'):
    stages=self.j['publisherStages']
    if len(stages)<2 or any(e['operation']!=m['descriptor'] or e.get('settled') is not True or e.get('success') is not True for e,m in zip(self.j['events'][55:58],stages[1]['map'])) or len(self.j['events'])<58:fail()
    if self.j.get('bootstrapIdentity') not in ['PENDING','VERIFIED']:fail()
    if lane=='ui' and op.get('id','').startswith('future-baseline-'):
     consumed=[e['operation']for e in self.j['events'][58:] if e['lane']=='ui' and e['operation'].get('id','').startswith('future-baseline-')]
     if len(consumed)>=9 or op!=stages[0]['map'][BOOTSTRAP_BASELINE_ORDER[len(consumed)]]['descriptor']:fail()
     if self.j['bootstrapIdentity']=='PENDING' and len(consumed)>=2:fail()
    elif self.j['bootstrapIdentity']!='VERIFIED':fail()
   if not self.native_successor and (op.get('key')=='H:wrapper-compatibility-rpc' or op.get('alias')=='wrapper-compatibility-rpc'):fail()
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
   if name=='publisher-a-readonly-ready':return self.register_publisher_a(q)
   if self.predebit_recovery and name=='settle' and e.get('lane')=='main' and e.get('key')=='A:original-project':
    self.current();self.now(q.get('now'))
    if self.j['pending']!=e['operation']['id'] or e.get('settled') is not False or type(q.get('success'))is not bool or not exact(q,['op','id','success','now']+(['projectReceipt']if q['success'] else [])) or q['id']!=e['operation']['id']:fail()
    if q['success']:
     registrations=self.j.get('publisherAReadiness',[])
     if len(registrations)!=1 or registrations[0]['phase']!='initial':fail()
     self.publisher_a_receipt(q['projectReceipt'],registrations[0]['proof']['sourceSha256'])
    result=super().command({k:v for k,v in q.items()if k!='projectReceipt'})
    if q['success']:self.j['events'][-1]['projectReceipt']=copy.deepcopy(q['projectReceipt']);self.persist();return self.view()
    return result
   if name=='publisher-stage-ready':
    self.current();self.active(q.get('now'));index=len(self.j['publisherStages']);d=self.j['publisherAlignment'];sequence=BOOTSTRAP_FUTURE if self.predebit_recovery else FUTURE
    if not self.preparation_complete() or not stage_clock_valid(self.j['phase'],self.j['w0']) or self.j['pending']is not None or index>=len(sequence) or not exact(q,['op','stage','map','stageCap','now']) or q['stage']!=sequence[index][0] or type(q['map'])is not list or not q['map'] or not integer(q['stageCap']) or q['stageCap']<1 or sum(m.get('lane')=='ui'for m in q['map']if type(m)is dict)!=q['stageCap']:fail()
    if self.predebit_recovery and index>=2 and not self.publisher_a_complete():fail()
    used=sum(s['stageCap']for s in self.j['publisherStages']);extra=(q['stageCap']-6 if index==0 else self.j['publisherStages'][0]['stageCap']-6)if self.native_successor else 0
    if self.native_successor and index==0 and (not 6<=q['stageCap']<=9 or q['stageCap']>6 and native_grounding_count(q['stageCap'],q['map'])!=extra):fail()
    if self.predebit_recovery and (index==0 or index==1 and (q['stageCap']!=3 or len(self.j['events'])!=55 or d['diagnosticCalls']!=0 or d['readonlyIncidents']!=2 or d['repairCalls']!=6 or self.j['publisherStages'][0]['stageCap']!=9 or any(m['tabId']!=self.native_context['tabId'] or m['url']!=self.native_settings_url for m in self.j['publisherStages'][0]['map'][:2]) or not bootstrap_map_valid(q['map'],self.native_context))):fail()
    future_minimum=sum(v for _,v in sequence[index+1:]) if self.predebit_recovery else sum(max(0,20-self.imported_delta-extra)if name=='diagnostic' else v for name,v in FUTURE[index+1:]);rollover=sum(v for _,v in sequence[:index])+(extra if index and not self.predebit_recovery else 0)-used
    complete={e['operation']['id']for e in self.j['events'][55:]if e.get('settled')is True and e.get('success')is True}
    prior_mapped={m['descriptor']['id']for stage in self.j['publisherStages']for m in stage['map']if not (self.native_successor and m['lane']=='main' and m['descriptor']['bucket']=='T')}
    if self.native_successor and not self.predebit_recovery and index==5 and q['stageCap']>20-self.imported_delta:fail()
    cap=(sequence[index][1] if self.predebit_recovery else 9 if self.native_successor and index==0 else 20-self.imported_delta if q['stage']=='diagnostic' else FUTURE[index][1])+rollover
    bootstrap_insert=self.predebit_recovery and index==1 and self.future_spent()==0 and len(self.j['events'])==55
    if q['stageCap']>cap or used+q['stageCap']+future_minimum>self.future_limit() or (self.future_spent()!=used and not bootstrap_insert) or (not prior_mapped<=complete and not bootstrap_insert) or any(e.get('settled')is not True or e.get('success')is not True for e in self.j['events'][55:]):fail()
    plan=self.j['plan'];ids={e['operation']['id']for e in self.j['events']}|{m['descriptor']['id']for stage in self.j['publisherStages']for m in stage['map']};main_keys={m['descriptor']['bucket']+':'+m['descriptor']['alias']for stage in self.j['publisherStages']for m in stage['map']if m['lane']=='main'}if plan is not None else set(self.j['stages']);cleanup_ids={c['descriptor']['id']for st in self.j['publisherStages']for m in st['map']for c in m['cleanup']};cleanup_keys={g['descriptor'](c['descriptor'],c['lane'])for st in self.j['publisherStages']for m in st['map']for c in m['cleanup']if c['lane']=='main'};ui_cleanup=sum(len([c for c in m['cleanup']if c['lane']=='ui'])for st in self.j['publisherStages']for m in st['map']);main_cleanup=sum(len([c for c in m['cleanup']if c['lane']=='main'])for st in self.j['publisherStages']for m in st['map'])
    validate_stage_rows(q,plan,ids,main_keys,cleanup_ids,cleanup_keys,ui_cleanup,main_cleanup,g,fail)
    if plan is not None:
     used_ids={e['operation']['id']for e in self.j['events']};unspent=sum(not row['key'].startswith(('C:','I:','J:')) and row['id']not in used_ids for row in plan['browserOperations']);new_prep=sum(m['lane']=='ui' and m['descriptor']['preparation'] for m in q['map'])
     if self.future_spent()+unspent+new_prep>self.future_limit():fail()
    self.j['publisherStages'].append({'stage':q['stage'],'stageCap':q['stageCap'],'map':copy.deepcopy(q['map'])})
    if bootstrap_insert:self.j['bootstrapIdentity']='PENDING'
    for m in q['map']:
     if m['lane']=='ui' and m['descriptor']['preparation'] is True:self.j['preparationStages'][m['descriptor']['id']]={'operations':[copy.deepcopy(m['descriptor'])],'remainingOrdinaryUi':self.future_limit()-used-q['stageCap']}
     elif m['lane']=='ui':self.j['stageBrowser'].append(copy.deepcopy(m['descriptor']))
     else:self.j['stages'][m['descriptor']['bucket']+':'+m['descriptor']['alias']]=copy.deepcopy(m['descriptor'])
     if plan is None:self.j['recoveryBrowser']+=[copy.deepcopy(c['descriptor'])for c in m['cleanup']if c['lane']=='ui']
    self.j['futureOrdinaryUi']=self.future_limit()-used-q['stageCap'];self.j['lastAt']=q['now'];self.persist();return self.view()
   if name=='settle' and self.j.get('publisherAlignment',{}).get('used')==6 and e.get('lane')=='ui' and e['operation'].get('id','').startswith('future-'):
    self.current();self.now(q.get('now'));e=self.j['events'][-1];matches=[(stage,m)for stage in self.j['publisherStages']for m in stage['map']if m['lane']=='ui' and m['descriptor']==e['operation']]
    if len(matches)!=1 or self.j['pending']!=q.get('id') or e['settled'] is not False:fail()
    stage,meta=matches[0];d=self.j['publisherAlignment'];diagnostic=stage['stage']=='diagnostic';repair=meta['repairIncident'] is not None
    bootstrap=self.predebit_recovery and diagnostic
    identity_rows=self.j['publisherStages'][0]['map'][:2] if self.predebit_recovery else []
    baseline_gate=self.predebit_recovery and e['operation'] in [m['descriptor']for m in identity_rows]
    if bootstrap and (e['operation']!=self.j['publisherStages'][1]['map'][d['diagnosticCalls']]['descriptor'] or repair or q.get('success') is True and not bootstrap_proof_valid(q.get('bootstrapProof'),e['operation']['operation'],self.native_context)):fail()
    if baseline_gate and q.get('success') is True:
     index=0 if e['operation']==identity_rows[0]['descriptor'] else 1
     if e['operation']!=self.j['publisherStages'][0]['map'][index]['descriptor'] or self.j.get('bootstrapIdentity')!='PENDING' or not baseline_identity_proof_valid(q.get('baselineIdentityProof'),e['operation']['operation'],self.j['publisherStages'][0]['map'][index],self.native_context,self.native_publisher_hash):fail()
    if q.get('success') is False and diagnostic and not repair and e['operation']['preparation'] is True and not bootstrap:
     p=q.get('preparationOutcome');fields=['kind','phase','targetVerified','accountVerified','bindingVerified','pureRead','terminal','fieldsRead']
     if not exact(q,['op','id','success','now','preparationOutcome']) or not exact(p,fields) or p['kind'] not in ['TECHNICAL','NOT_READY'] or p['kind']=='NOT_READY' and p['phase']!='READY' or p['kind']=='TECHNICAL' and p['phase'] not in ['DECODE','PROJECTOR_COMBOS','PROJECTOR_SHAPE','PROJECTOR_ANCESTORS','PROJECTOR_RELATED','POSTCHECK_COMBO'] or any(p[k] is not True for k in ['targetVerified','accountVerified','bindingVerified','pureRead','terminal']) or p['fieldsRead'] is not False or self.j['phase']!='PREP' or self.j['mutated'] or self.j['rpc']['beganAt'] is not None or d['readonlyIncidents']>=2 or d['diagnosticCalls']>=20-self.imported_delta:fail()
     e.update(settled=True,success=False,preparationOutcome=copy.deepcopy(p));self.j.update(pending=None,lastAt=q['now']);d['readonlyIncidents']+=1;d['diagnosticCalls']+=1;self.j['failures']+=1;self.persist();return self.view()
    projection=e['operation']['preparation'] is True and e['operation']['operation'] in ['snapshot','evaluate']
    verified=projection and q.get('success') is True
    if bootstrap or baseline_gate:
     allowed=['op','id','success','now']+(['loadingResultVerified']if verified else[])+(['bootstrapProof']if bootstrap and q.get('success') is True else[])+(['baselineIdentityProof']if baseline_gate and q.get('success') is True else[])
     if type(q.get('success'))is not bool or q['id']!=e['operation']['id'] or not exact(q,allowed) or verified and q['loadingResultVerified'] is not True:fail()
    elif type(q.get('success'))is not bool or q['id']!=e['operation']['id'] or verified and (not exact(q,['op','id','success','now','loadingResultVerified']) or q['loadingResultVerified'] is not True) or not verified and 'loadingResultVerified'in q:fail()
    compatible={k:v for k,v in q.items()if k not in ['loadingResultVerified','bootstrapProof','baselineIdentityProof']}
    result=super().command(compatible)
    if verified:self.j['events'][-1]['loadingResultVerified']=True;self.persist();result=self.view()
    if bootstrap and q['success']:self.j['events'][-1]['bootstrapProof']=copy.deepcopy(q['bootstrapProof']);self.persist();result=self.view()
    if baseline_gate and q['success']:
     self.j['events'][-1]['baselineIdentityProof']=copy.deepcopy(q['baselineIdentityProof'])
     if e['operation']['operation']=='evaluate':self.j['bootstrapIdentity']='VERIFIED'
     self.persist();result=self.view()
    if diagnostic:
     d=self.j['publisherAlignment'];d['diagnosticCalls']+=1
     if repair:d['repairCalls']+=1
     if d['diagnosticCalls']>20-self.imported_delta or d['repairCalls']>6:fail()
     self.persist()
     if bootstrap and not q['success']:self.stop()
     return self.view()
    if baseline_gate and not q['success']:self.stop();return self.view()
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
    if not exact(q,['op','now']) or not self.prepared_checkpoint(self.j) or self.j['pending']is not None or any(e['settled']is not True for e in self.j['events']) or self.predebit_recovery and self.j.get('publisherAReadiness'):fail()
    self.j.update(lifecycle='CLEAN_PAUSE',lastAt=q['now']);self.persist();return self.view()
   if name=='plan-ready' and self.j.get('plan') is None:
    self.current();self.active(q.get('now'))
    if not self.preparation_complete() or not stage_clock_valid(self.j['phase'],self.j['w0']) or self.j['pending'] is not None or any(e.get('settled') is not True for e in self.j['events']) or self.j['rpc']['beganAt'] is not None or self.predebit_recovery and not self.publisher_a_complete():fail()
   if name in ['stage-ready','recovery-ready','rpc-begin'] and self.j.get('plan')is None:fail()
   return super().command(q)
 return PublisherAlignmentLedger
