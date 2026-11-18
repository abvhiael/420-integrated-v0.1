"""Local adversarial tests only; no test output is live acceptance evidence."""
import copy, importlib.util, json, pathlib, tempfile, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('live',pathlib.Path(__file__).with_name('stake-live-operations.py'));live=importlib.util.module_from_spec(spec);spec.loader.exec_module(live)
H='1'*64;G='0x'+'2'*64
class LiveEvidenceTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.base=pathlib.Path(self.tmp.name)
 def cfg(self):
  return {'schema':'420-stake-live-config-v1','environment':'public-testnet','deploymentId':'qualification-node','releaseSHA':'a'*40,'genesisHash':G,'trustSHA256':H,'independentWitness':True,'witnessBackupDomain':'independent-admin','rpcURL':'http://127.0.0.1:8545','engineURL':'http://127.0.0.1:8551','monitorURL':'http://127.0.0.1:9545','processes':{r:{'pid':i+10,'sha256':H} for i,r in enumerate(sorted(live.ROLES))},'reconciler':{'path':'/approved/stake-reconcile','sha256':H},'runtimeSHA256':{a:H for a in ['0x0000000000000000000000000000000000000423','0x000000000000000000000000000000000000043c']}}
 def test_approved_config_and_private_endpoint_policy(self):
  c=self.cfg();raw=json.dumps(c).encode();self.assertEqual(live.config(raw,live.digest(raw)),c)
  for endpoint in ['http://engine:8551','http://8.8.8.8:80','https://user:secret@example.com','https://host/?token=secret','https://host/#secret']:
   with self.subTest(endpoint=endpoint),self.assertRaises(live.Invalid):live.endpoint(endpoint)
 def test_template_wrong_pin_and_witness_rollback_domain_rejected(self):
  c=self.cfg()
  for change in [{'environment':'TEMPLATE-NOT-ACCEPTANCE'},{'independentWitness':False},{'witnessBackupDomain':c['deploymentId']},{'releaseSHA':'unqualified'}]:
   c=self.cfg();c.update(change);raw=json.dumps(c).encode()
   with self.subTest(change=change),self.assertRaises(live.Invalid):live.config(raw,live.digest(raw))
  with self.assertRaises(live.Invalid):live.config(json.dumps(self.cfg()).encode(),'0'*64)
 def test_duplicate_json_rejected(self):
  with self.assertRaises(live.Invalid):live.decode('{"ready":true,"ready":false}')
 def sequence(self):
  a={'ChainID':420,'ExecutionBlock':5,'BlockHash':[3]*32,'LastSequence':7}
  s={'schema':'420-stake-systemcall-sequence-v2','chainId':420,'executionBlock':5,'blockHash':live.root(a['BlockHash']),'lastSequence':7,'checksum':''};s['checksum']=live.digest(json.dumps(s,separators=(',',':')).encode());return a,s
 def test_v2_sequence_must_match_complete_canonical_anchor(self):
  a,s=self.sequence();self.assertEqual(live.sequence_anchor(json.dumps(s),a),s)
  for change in [{'schema':'420-stake-systemcall-sequence-v1'},{'checksum':'0'*64},{'lastSequence':6},{'blockHash':G},{'chainId':421},{'executionBlock':4},{'lastSequence':True}]:
   bad=dict(s,**change)
   # Even integrity-valid stale/wrong anchor state must fail.
   if 'checksum' not in change:
    bad['checksum']='';bad['checksum']=live.digest(json.dumps(bad,separators=(',',':')).encode())
   with self.subTest(change=change),self.assertRaises(live.Invalid):live.sequence_anchor(json.dumps(bad),a)
 def test_missing_and_unknown_sequence_fields_rejected(self):
  a,s=self.sequence()
  for field in s:
   bad=dict(s);del bad[field]
   with self.subTest(field=field),self.assertRaises(live.Invalid):live.sequence_anchor(json.dumps(bad),a)
  with self.assertRaises(live.Invalid):live.sequence_anchor(json.dumps(dict(s,unknown=True)),a)
 def artifact(self,name,data):
  raw=json.dumps(data).encode();(self.base/name).write_bytes(raw);return {'path':name,'sha256':live.digest(raw)}
 def bundle(self):
  processes={r:{'pid':i+20,'binarySHA256':H} for i,r in enumerate(sorted(live.ROLES))}
  before={'schema':'420-stake-live-snapshot-v1','kind':'COLLECTED','environment':'public-testnet','accounting':'RECONCILED','deploymentId':'qualification-node','releaseSHA':'a'*40,'genesisHash':G,'processes':processes,'block':5,'sequence':7,'blockHash':G,'configSHA256':H,'trustSHA256':H,'runtimeSHA256':{'gateway':H},'finalizedRoot':G,'finalizedSlot':4,'canonicalRoots':[G],'observedAt':'2026-11-17T00:00:00+00:00'}
  after=copy.deepcopy(before);after['processes']={r:{'pid':i+100,'binarySHA256':H} for i,r in enumerate(sorted(live.ROLES))};after['observedAt']='2026-11-17T00:01:00+00:00'
  # Mock evidence is used only to test structure validation. It remains explicitly
  # non-acceptance and never represents observed live processes or signed QCs.
  b=self.artifact('before.json',before);a=self.artifact('after.json',after);rules=['signing_protection_failure','engine_errors','sequence_state_mismatch','consensus_evidence_unavailable','accounting_discrepancy','delivery_failure']
  alarms=[{'id':live.digest((r+t).encode()),'rule':r,'transition':t,'episode':1,'status':'delivered'} for r in rules for t in ['FIRING','RECOVERED']]
  log=self.artifact('reviewed-event.json',{'fixture':'LOCAL UNIT ONLY','alarms':alarms})
  return {'schema':'420-stake-live-drill-bundle-v1','environment':'public-testnet','simulation':False,'deploymentId':'qualification-node','releaseSHA':'a'*40,'genesisHash':G,'approvedConfigSHA256':[H],'scenarios':[{'id':s,'before':b,'after':a,'evidenceFiles':[log],'operatorReviewSHA256':log['sha256'],'alarmEvidence':[log]} for s in sorted(live.SCENARIOS)]}
 def test_complete_structure_never_means_live_acceptance(self):
  result=live.check_bundle(self.base,self.bundle());self.assertTrue(result['structuralEvidenceComplete']);self.assertFalse(result['liveAcceptance'])
 def test_partial_duplicate_or_simulated_drills_rejected(self):
  b=self.bundle()
  for change in ['missing','duplicate','simulated']:
   bad=copy.deepcopy(b)
   if change=='missing':bad['scenarios'].pop()
   elif change=='duplicate':bad['scenarios'][0]['id']=bad['scenarios'][1]['id']
   else:bad['simulation']=True
   with self.subTest(change=change),self.assertRaises(live.Invalid):live.check_bundle(self.base,bad)
 def test_wrong_release_and_finalized_replacement_rejected(self):
  for change in [{'releaseSHA':'b'*40},{'canonicalRoots':['0x'+'4'*64]},{'finalizedSlot':3},{'observedAt':'2026-11-16T00:00:00+00:00'}]:
   b=self.bundle();a=live.decode((self.base/'after.json').read_bytes());a.update(change);ref=self.artifact('changed.json',a)
   for s in b['scenarios']:s['after']=ref
   with self.subTest(change=change),self.assertRaises(live.Invalid):live.check_bundle(self.base,b)
 def test_rejection_must_not_advance_sequence(self):
  b=self.bundle();a=live.decode((self.base/'after.json').read_bytes());a['sequence']+=1;ref=self.artifact('advanced.json',a)
  b['scenarios'][0]['after']=ref
  with self.assertRaises(live.Invalid):live.check_bundle(self.base,b)
 def test_process_restart_and_alarm_proof_required(self):
  for which in ['process','alarm']:
   b=self.bundle()
   for s in b['scenarios']:
    if which=='process' and s['id']=='consensus-restart':s['after']=s['before']
    if which=='alarm' and s['id']=='engine-unavailable':s['alarmEvidence']=[]
   with self.subTest(which=which),self.assertRaises(live.Invalid):live.check_bundle(self.base,b)
 def test_corruption_and_path_escape_rejected(self):
  b=self.bundle();(self.base/'reviewed-event.json').write_text('tampered')
  with self.assertRaises(live.Invalid):live.check_bundle(self.base,b)
  with self.assertRaises(live.Invalid):live.artifact(self.base,{'path':'../escape.json','sha256':H})
 def test_collector_pins_gateway_and_redacts_raw_report(self):
  c=self.cfg();directory=self.base/'consensus';directory.mkdir();a,seq=self.sequence()
  trust={'Genesis':{'Root':[1]*32}};trust_path=self.base/'trust.json';trust_path.write_text(json.dumps(trust))
  c.update(trustFile=str(trust_path),trustSHA256=live.digest(trust_path.read_bytes()),consensusDir=str(directory),indexerStore=str(self.base/'index.json'),engineJWTFile='/private/not-exported')
  cp={'Head':{'Root':[5]*32},'Finalized':{'Root':[4]*32,'Slot':4},'Settlement':a}
  history={'Entries':[{'Certificate':{'BlockRoot':[4]*32,'ParentRoot':[1]*32}},{'Certificate':{'BlockRoot':[5]*32,'ParentRoot':[4]*32}}]}
  for n,v in [('checkpoint.json',cp),('history.json',history),('sequence.json',seq)]: (directory/n).write_text(json.dumps(v))
  report={'schema':'420-stake-accounting-reconciliation-v1','chainId':420,'status':'RECONCILED','canonicalAuthority':False,'discrepancies':[],'block':5,'blockHash':live.root(a['BlockHash']),'consensusRoot':live.root([5]*32),'finalizedRoot':live.root([4]*32),'untrustedExtra':'DO-NOT-EXPORT-SECRET'}
  binary=self.base/'local-test-reconciler';binary.write_text('#!/usr/bin/env python3\nprint('+repr(json.dumps(report))+')\n');binary.chmod(0o700);c['reconciler']={'path':str(binary),'sha256':live.digest(binary.read_bytes())}
  c['runtimeSHA256']={k:live.digest(bytes.fromhex('1234')) for k in c['runtimeSHA256']}
  calls=[]
  def rpc(url,method,params):
   calls.append((method,params))
   if method=='eth_chainId':return '0x1a4'
   if method=='eth_getBlockByNumber':return {'hash':G if params[0]=='0x0' else report['blockHash']}
   if method=='eth_getCode':return '0x1234'
   if method=='eth_call':return '0x'+format(7,'064x')
   raise AssertionError(method)
  def request(url):return [] if url.endswith('/v1/alarms') else {'schema':'420-stake-monitor-v1','ready':True,'canonicalAuthority':False}
  with patch.object(live,'process_evidence',return_value={}),patch.object(live,'rpc',side_effect=rpc),patch.object(live,'request',side_effect=request):
   result=live.collect(c,H)
  self.assertFalse(result['liveAcceptance']);self.assertEqual(result['sequence'],7);self.assertNotIn('DO-NOT-EXPORT-SECRET',json.dumps(result))
  for method,params in calls:
   if method in ['eth_call','eth_getCode']:self.assertEqual(params[-1],{'blockHash':report['blockHash'],'requireCanonical':True})
 def test_review_and_corresponding_recovery_notifications_required(self):
  b=self.bundle();b['scenarios'][0]['operatorReviewSHA256']='0'*64
  with self.assertRaises(live.Invalid):live.check_bundle(self.base,b)
  b=self.bundle();d=live.decode((self.base/'reviewed-event.json').read_bytes());d['alarms']=[a for a in d['alarms'] if a['transition']=='FIRING'];ref=self.artifact('missing-recovery.json',d)
  for s in b['scenarios']:s['alarmEvidence']=[ref]
  with self.assertRaises(live.Invalid):live.check_bundle(self.base,b)
 def test_actual_local_process_inventory_and_wrong_binary_rejection(self):
  import subprocess,sys
  children=[subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)']) for _ in live.ROLES]
  try:
   sha=live.digest(pathlib.Path('/proc/self/exe').read_bytes());c=self.cfg();c['processes']={r:{'pid':p.pid,'sha256':sha} for r,p in zip(sorted(live.ROLES),children)}
   observed=live.process_evidence(c);self.assertEqual(set(observed),live.ROLES)
   bad=copy.deepcopy(c);bad['processes']['signer']['sha256']='0'*64
   with self.assertRaises(live.Invalid):live.process_evidence(bad)
   children[0].terminate();children[0].wait(timeout=5)
   with self.assertRaises(ProcessLookupError):live.process_evidence(c)
  finally:
   for child in children:
    if child.poll() is None:child.terminate()
    child.wait(timeout=5)
 def test_endpoint_redirects_never_follow(self):
  with self.assertRaises(live.Invalid):live.NoRedirect().redirect_request(None,None,None,None,None,None)
if __name__=='__main__':unittest.main(verbosity=2)
