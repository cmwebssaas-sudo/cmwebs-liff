"""Synthetic, owned-temp tests for the inert predebit transaction helpers."""
import copy
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def module(name, path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
base=module('task72_base',ROOT/'scripts/read-authority-simple-budget.py')
recovery=module('task72_recovery',ROOT/'scripts/read-authority-publisher-alignment-budget.py')
g={'fail':base.fail,'exact':base.exact,'sha':base.sha,'rawfile':base.rawfile,'record':base.record,'integer':base.integer,'compact':base.compact,'pin':base.pin,'save':base.save_record,'synced':base.synced,'directory':base.directory}

class PredebitRecovery(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='cmwebs-task72-transition-');self.addCleanup(self.temp.cleanup)
  self.root=Path(self.temp.name);os.chmod(self.root,0o700)
  self.paths={k:self.root/(k+'.json') for k in ['journal','claim','stop','registry']}
  self.old_claim={'path':str(self.root/'canonical'),'epoch':'synthetic-same-epoch','binding':'synthetic-same-binding','ownerHash':'a'*64,'sources':[{'path':'synthetic-old','sha256':'1'*64}]}
  self.j={'state':'stopped','lifecycle':'HARD_STOP','phase':'PREP','pending':None,'w0':None,'expiresAt':None,'mutated':False,'rpc':{'beganAt':None,'complete':False},'finished':False,'lastAt':100,'events':[{'lane':'ui','settled':True,'success':True} for _ in range(55)],'plan':None,'publisherStages':[{'stage':'baseline','stageCap':9}],'futureOrdinaryUi':64,'nativeCurrentVisual':True,'nativeImported':[{'bookkeptAt':100} for _ in range(17)],'publisherImported':[{} for _ in range(3)],'holders':['a'*64],'holder':'a'*64,'connection':{'sourceChain':[]},'failures':8}
  self.reset_evidence()
  self.identity={**self.old_claim,'ownerHash':'b'*64,'sources':[{'path':'synthetic-reviewed-current','sha256':'2'*64}]}
  self.target=self.root/'canonical.simple-publisher-native-predebit-recovery'

 def reset_evidence(self):
  base.synced(self.paths['journal'],self.j) if self.paths['journal'].exists() else base.synced(self.paths['journal'],self.j,True)
  if self.paths['claim'].exists():self.paths['claim'].unlink()
  base.save_record(self.paths['claim'],self.old_claim,True)
  if self.paths['stop'].exists():self.paths['stop'].unlink()
  base.save_record(self.paths['stop'],{'identity':self.old_claim},True)
  base.save_record(self.paths['registry'],{'identity':self.old_claim,'checkpoint':self.j}) if self.paths['registry'].exists() else base.save_record(self.paths['registry'],{'identity':self.old_claim,'checkpoint':self.j},True)
  self.pins={k:{'path':str(p),'sha256':base.sha(base.rawfile(p))} for k,p in self.paths.items()}
  self.proof_path=self.root/'proof.json'
  proof={'source':'native128-predebit-local-timeout-proof-v2','journal':self.pins['journal'],'claim':self.pins['claim'],'registry':self.pins['registry'],'state':'stopped','lifecycle':'HARD_STOP','phase':'PREP','eventCount':55,'newEventsAfterImported55':0,'counts':{'main':53,'ui':75,'combined':128,'limit':296},'pending':None,'w0':None,'mutated':False,'rpc':{'beganAt':None,'complete':False},'nativeImports':17,'lockOpenHolders':0,'providerCallsThisAdmission':0,'retainedCUAReferenceLost':True,'restartAttemptedAfterHardStop':False}
  if self.proof_path.exists():self.proof_path.unlink()
  self.proof_path.write_text(base.compact(proof));os.chmod(self.proof_path,0o600)
  self.proof_pin={'path':str(self.proof_path),'sha256':base.sha(base.rawfile(self.proof_path))}
  self.expected={**{k:self.pins[k]['sha256'] for k in ['journal','claim','registry']},'proof':self.proof_pin['sha256']}

 def checked(self):
  return recovery.predebit_evidence(self.paths,self.pins,self.proof_pin,self.expected,self.paths['registry'],90,200,g)

 def test_exact_transition_preserves_stopped_evidence_and_spend(self):
  j,claim,raw=self.checked();before={k:base.rawfile(self.paths[k]) for k in ['journal','claim','stop']}
  target=recovery.predebit_transition(self.target,self.paths['registry'],self.identity,j,raw,self.pins,self.proof_pin,200,g)
  self.assertEqual(len(target['events']),55);self.assertEqual(target['failures'],8)
  self.assertEqual(len(target['nativeImported']),17);self.assertEqual(target['nativeImported'][0]['bookkeptAt'],100)
  self.assertEqual(target['state'],'ready');self.assertEqual(target['lifecycle'],'ACTIVE')
  self.assertEqual(base.record(self.paths['registry']),{'identity':self.identity,'checkpoint':target})
  self.assertEqual(base.rawfile(Path(str(self.target)+'-origin-registry.json')),raw['registry'])
  receipt=json.loads(base.rawfile(Path(str(self.target)+'-transition.json')))
  self.assertEqual(receipt['status'],'PREPARED')
  for key in ['claim','journal']:
   initial=base.rawfile(Path(str(self.target)+'-initial-'+key+'.json'))
   self.assertEqual(base.sha(initial),receipt['initial'][key]['sha256'])
   self.assertEqual(base.sha(initial),receipt['target'+key.title()+'Sha256'])
  self.assertEqual(receipt['ownerHash'],self.identity['ownerHash'])
  for key,data in before.items():self.assertEqual(base.rawfile(self.paths[key]),data)
  with self.assertRaises(Exception):recovery.predebit_transition(self.target,self.paths['registry'],self.identity,j,raw,self.pins,self.proof_pin,200,g)

 def test_every_interrupted_phase_is_closed_to_second_scope(self):
  for phase in ['archive-journal','archive-claim','archive-stop','archive-registry','initial-claim','initial-journal','receipt','claim','journal','registry']:
   with self.subTest(phase=phase):
    self.setUp()
    j,claim,raw=self.checked()
    with self.assertRaisesRegex(RuntimeError,'SYNTHETIC_INTERRUPTION'):
     recovery.predebit_transition(self.target,self.paths['registry'],self.identity,j,raw,self.pins,self.proof_pin,200,g,interrupt=phase)
    if phase!='registry':self.assertEqual(base.rawfile(self.paths['registry']),raw['registry'])
    else:self.assertEqual(base.record(self.paths['registry'])['identity'],self.identity)
    with self.assertRaises(Exception):recovery.predebit_transition(self.target,self.paths['registry'],self.identity,j,raw,self.pins,self.proof_pin,200,g)
    self.assertEqual(base.rawfile(self.paths['journal']),raw['journal'])
    self.assertEqual(base.rawfile(self.paths['stop']),raw['stop'])

 def test_unknown_or_changed_predebit_evidence_rejects_before_transition(self):
  for name,change in [('event56',lambda j:j['events'].append({'lane':'ui','settled':True,'success':True})),('pending',lambda j:j.update(pending='unknown')),('trial',lambda j:j.update(w0=110,phase='TRIAL')),('rpc',lambda j:j['rpc'].update(beganAt=120)),('mutation',lambda j:j.update(mutated=True)),('stage',lambda j:j['publisherStages'][0].update(stageCap=8))]:
   with self.subTest(name=name):
    self.setUp();change(self.j);self.reset_evidence()
    with self.assertRaises(Exception):self.checked()
    self.assertFalse(Path(str(self.target)+'-transition.json').exists())
  self.setUp();self.paths['registry'].write_bytes(b'{}')
  with self.assertRaises(Exception):self.checked()

if __name__=='__main__':unittest.main()
