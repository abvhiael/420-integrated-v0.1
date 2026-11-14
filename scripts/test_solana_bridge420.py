import pathlib,unittest
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
   with self.assertRaises((AssertionError,InvalidSignature)):s.verify_certificate(p,v,420,q.to_bytes(20,'big'),r,snapshot,100)
 def test_insufficient_stake_and_duplicate_voter_rejected(self):
  p,c,v,root,snapshot,_,_=self.fixture()
  for votes in [[x for x in v if x[2] in (40,20)],[v[0],v[0]]]:
   with self.assertRaises(AssertionError):s.verify_certificate(p,votes,420,(0x7000).to_bytes(20,'big'),root,snapshot,100)
 def test_rpc_only_and_weak_keys_cannot_be_certificates(self):
  p,c,v,root,snapshot,_,_=self.fixture()
  with self.assertRaises(AssertionError):s.verify_certificate(p,[],420,(0x7000).to_bytes(20,'big'),root,snapshot,100)
  self.assertFalse(s.prime_point(bytes(32)));self.assertFalse(s.prime_point(bytes([1])+bytes(31)))
if __name__=='__main__':unittest.main()
