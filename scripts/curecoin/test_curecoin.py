import unittest,hashlib,json,struct
from pathlib import Path
from eth_abi import decode,encode
from consensus import *
from generate_controlled import PROOF
from bundle import destination_comment,candidate
FIX=Path(__file__).resolve().parents[2]/'contracts/test/fixtures/curecoin'
class CurecoinTests(unittest.TestCase):
 def test_genuine_genesis_and_six_decimal_units(self):
  header=(FIX/'genesis-header.bin').read_bytes();self.assertEqual(H(header)[::-1].hex(),GENESIS);tx,end=transaction((FIX/'genesis-transaction.bin').read_bytes());self.assertEqual(tx['id'],header[36:68]);self.assertEqual(COIN,1000000)
 def test_kernel_cap_subtracts_minimum_age_after_cap(self):
  self.assertEqual(weight(COIN,1000,1000+100*86400),86);self.assertEqual(weight(COIN,1000,1000+100*86400,100000),60)
 def test_historical_target_limits(self):
  self.assertEqual(limit(14060),WORK_LIMIT);self.assertEqual(limit(14061),(1<<226)-1);self.assertEqual(limit(15001),STAKE_LIMIT)
 def test_native_retarget_no_potcoin_negative_spacing_fallback(self):
  self.assertLess(next_bits(0x1e00ffff,900,1000),0x1e00ffff)
  with self.assertRaises(ValueError):next_bits(0x1e00ffff,0,100000)
 def test_chain_trust_and_pow_cutoff(self):
  self.assertEqual(trust(0x1e0fffff,False),1);self.assertFalse(eligible_kind(HF+1,False));self.assertTrue(eligible_kind(HF,False));self.assertGreater(trust(0x1d00ffff),10*trust(0x1e00ffff))
 def test_signed_comment_destination_domain(self):
  route=bytes.fromhex('42'*32);memo=destination_comment(420,'0x'+'11'*20,route,'0x'+'22'*20);self.assertEqual(len(memo),61)
  self.assertNotEqual(memo,destination_comment(421,'0x'+'11'*20,route,'0x'+'22'*20))
  with self.assertRaises(ValueError):destination_comment(420,'0x'+'11'*20,bytes(32),'0x'+'22'*20)
 def test_genuine_historical_proof_wire_and_native_amounts(self):
  p=decode([PROOF],(FIX/'stake-257368.bin').read_bytes())[0];tx,end=transaction(p[9]);self.assertEqual(end,len(p[9]));self.assertEqual(merkle([H(t['raw']) for t in self.block_transactions((FIX/'block-257368.bin').read_bytes())]),p[3][36:68]);self.assertGreater(tx['outputs'][p[12]][0],0);self.assertNotEqual(tx['comment'][:9],b'420CUREV1');self.assertEqual(encode([PROOF],[p]),(FIX/'stake-257368.bin').read_bytes())
 def test_qualified_candidate_and_metadata_substitution(self):
  replay=json.loads((FIX.parents[3]/'docs/audit/curecoin-qualification/native-replay.json').read_text());history=json.loads((FIX/'historical.json').read_text());raw=(FIX/'stake-257324.bin').read_bytes();out=candidate(raw,replay,history);self.assertEqual(out['state_root'],history['samples']['257324']['state_leaf'])
  p=list(decode([PROOF],raw)[0]);state=list(p[0]);state[5]+=1;p[0]=state
  with self.assertRaisesRegex(ValueError,'state differs'):candidate(encode([PROOF],[p]),replay,history)
 def test_native_chain_trust_disagreement_rejected(self):
  replay=json.loads((FIX.parents[3]/'docs/audit/curecoin-qualification/native-replay.json').read_text());replay['chain_trust']=str(int(replay['chain_trust'])-1);history=json.loads((FIX/'historical.json').read_text())
  with self.assertRaisesRegex(ValueError,'canonical-chain disagreement'):candidate((FIX/'stake-257324.bin').read_bytes(),replay,history)
 def test_optimized_cli_requires_pinned_report_hash(self):
  import subprocess,sys,tempfile
  with tempfile.TemporaryDirectory() as d:
   out=Path(d)/'candidate.json';root=FIX.parents[3];r=subprocess.run([sys.executable,'-O',str(root/'scripts/curecoin/bundle.py'),'--proof',str(FIX/'stake-257324.bin'),'--native-report',str(root/'docs/audit/curecoin-qualification/native-replay.json'),'--native-report-sha256','00'*32,'--history',str(FIX/'historical.json'),'--history-sha256',hashlib.sha256((FIX/'historical.json').read_bytes()).hexdigest(),'--out',str(out)],capture_output=True,text=True)
   self.assertNotEqual(r.returncode,0);self.assertIn('native report hash',r.stderr);self.assertFalse(out.exists())
 def test_native_observer_supported_rpc_and_retained_trust(self):
  import tempfile,types
  from native_replay import export_report
  root=FIX.parents[3];actual=json.loads((root/'docs/audit/curecoin-qualification/native-replay.json').read_text());byhash={b['hash']:b for b in actual['selected'].values()}
  def rpc(method,*params):
   if method=='getinfo':return {'blocks':actual['height'],'testnet':False,'connections':0}
   if method=='getblockhash':return actual['selected'][str(params[0])]['hash']
   if method=='getblock':return byhash[params[0]]
   raise AssertionError('unsupported native RPC: '+method)
  with tempfile.TemporaryDirectory() as d:
   out=Path(d);bootstrap=out/'raw.dat';bootstrap.write_bytes(b'formatter-unit-input');log=out/'daemon.log';log.write_text('SetBestChain: new best='+actual['tip'][:20]+'  height=500000  trust='+actual['chain_trust']+'  date=historical,block hash= '+actual['tip']+'\n');a=types.SimpleNamespace(height=500000,tip=actual['tip'],sample=[],sha256=actual['daemon_sha256'],bootstrap=bootstrap,output=out)
   self.assertEqual(export_report(rpc,a,None)['chain_trust'],actual['chain_trust']);retained=out/'retained.log';log.rename(retained);lineage={'retained_native_trace_sha256':{'retained.log':hashlib.sha256(retained.read_bytes()).hexdigest()}}
   self.assertEqual(export_report(rpc,a,lineage)['tip'],actual['tip']);lineage['retained_native_trace_sha256']['retained.log']='00'*32
   with self.assertRaisesRegex(ValueError,'retained native trace checksum'):export_report(rpc,a,lineage)
 def block_transactions(self,raw):
  count,pos=varint(raw,80);out=[]
  for _ in range(count):tx,pos=transaction(raw,pos);out.append(tx)
  return out
 def test_rpc_only_or_optimized_validation_claim_rejected(self):
  raw=(FIX/'stake-257324.bin').read_bytes();history=json.loads((FIX/'historical.json').read_text());replay={'source':SOURCE,'assumevalid':'1','mainnet':True,'connections':0}
  with self.assertRaises(ValueError):candidate(raw,replay,history)
if __name__=='__main__':unittest.main()
