import pathlib,unittest,subprocess,sys,tempfile
from eth_abi import encode
from eth_abi import decode
from cryptography.exceptions import InvalidSignature
import solana_bridge420 as s
ROOT=pathlib.Path(__file__).resolve().parents[1]
class SolanaSdkTests(unittest.TestCase):
 def fixture(self):return decode([s.P,s.C,s.V+'[]','bytes32','bytes32','bytes32','bytes32'],(ROOT/'contracts/test/fixtures/solana/controlled-native.bin').read_bytes())
 def test_actual_signatures_match_claim_and_merkle_wire(self):
  p,c,votes,root,snapshot,_,_=self.fixture();self.assertEqual(tuple(c),s.claim(p));records,total,r,branches=s.merkle_manifest(c[0],[(v[0],v[1],v[2]) for v in votes]);self.assertEqual(r,root);self.assertEqual(total,100)
  selected=[v for v in votes if v[2] in (40,30)];self.assertEqual(s.verify_certificate(p,selected,420,(0x7000).to_bytes(20,'big'),root,snapshot,100),s.digest(c,420,(0x7000).to_bytes(20,'big'),root,snapshot,100));calls=s.calldata(p,selected);self.assertEqual(len(calls['submit_votes']),2);self.assertTrue(calls['verify_finalized_transfer'].startswith('0x'))
 def test_wrong_trust_root_and_quorum_domain_rejected(self):
  p,c,v,root,snapshot,_,_=self.fixture()
  for q,r in [(0x7000,bytes([42])*32),(0x7001,root)]:
   with self.assertRaises((ValueError,InvalidSignature)):s.verify_certificate(p,v,420,q.to_bytes(20,'big'),r,snapshot,100)
 def test_insufficient_stake_and_duplicate_voter_rejected(self):
  p,c,v,root,snapshot,_,_=self.fixture()
  for votes in [[x for x in v if x[2] in (40,20)],[v[0],v[0]]]:
   with self.assertRaises(ValueError):s.verify_certificate(p,votes,420,(0x7000).to_bytes(20,'big'),root,snapshot,100)
 def test_zero_stake_and_invalid_membership_rejected(self):
  p,c,v,root,snapshot,_,_=self.fixture()
  for total in (0, -1):
   with self.assertRaises(ValueError):s.verify_certificate(p,v,420,(0x7000).to_bytes(20,'big'),root,snapshot,total)
  bad=list(v[0]);bad[3]=2**32
  with self.assertRaises(ValueError):s.verify_certificate(p,[bad],420,(0x7000).to_bytes(20,'big'),root,snapshot,100)
 def test_rpc_only_and_weak_keys_cannot_be_certificates(self):
  p,c,v,root,snapshot,_,_=self.fixture()
  with self.assertRaises(ValueError):s.verify_certificate(p,[],420,(0x7000).to_bytes(20,'big'),root,snapshot,100)
  self.assertFalse(s.prime_point(bytes(32)));self.assertFalse(s.prime_point(bytes([1])+bytes(31)))
 def test_optimized_cli_requires_approved_bundle_and_quorum(self):
  p,c,v,root,snapshot,_,_=self.fixture()
  with tempfile.TemporaryDirectory() as folder:
   bundle=pathlib.Path(folder)/'bundle.bin';out=pathlib.Path(folder)/'out.json'
   def run(votes,expected=None,trusted=None):
    raw=encode([s.P,s.C,s.V+'[]','bytes32','bytes32','uint64'],[p,c,votes,root,snapshot,100]);bundle.write_bytes(raw)
    return subprocess.run([sys.executable,'-O',str(ROOT/'scripts/solana_bridge420.py'),'--bundle',str(bundle),'--expected-bundle-sha256',expected or s.sha(raw).hex(),'--quorum','0x'+(0x7000).to_bytes(20,'big').hex(),'--chain-id','420','--trusted-root',trusted or root.hex(),'--snapshot-hash',snapshot.hex(),'--total-stake','100','--out',str(out)],capture_output=True,text=True)
   self.assertEqual(run(v).returncode,0);self.assertTrue(out.exists());out.unlink()
   for votes,expected,trusted in [(v,'00'*32,None),(v,None,'00'*32),([],None,None),([x for x in v if x[2] in (40,20)],None,None)]:
    result=run(votes,expected,trusted);self.assertNotEqual(result.returncode,0,result.stdout);self.assertFalse(out.exists())
if __name__=='__main__':unittest.main()
