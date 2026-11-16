import unittest,struct,tempfile
from pathlib import Path
from consensus import *
from replay import blocks
class NativePortTests(unittest.TestCase):
 def test_genesis_serialization(self):
  fix=Path(__file__).resolve().parents[2]/'contracts/test/fixtures/potcoin';raw=(fix/'genesis-transaction.bin').read_bytes();tx,end=transaction(raw);self.assertEqual(end,len(raw));self.assertEqual(tx['id'][::-1].hex(),'51d897834ac4834bec5fa26ed648ccea33173f9f8c66911561554ee25441e0d0')
 def test_kernel_preimage_and_strict_hit(self):
  h=kernel(42,1000,81,1000,0,3000);self.assertEqual(h,H(struct.pack('<QIIIII',42,1000,81,1000,0,3000)))
  with self.assertRaises(ValueError):check_kernel(0x03000001,42,1000,81,1000,0,3000,COIN)
 def test_weighted_target_larger_than_uint256(self):
  self.assertGreater(target(0x1e00ffff)*weight(MAX_MONEY,1000,3000000),1<<256);check_kernel(0x1e00ffff,42,1000,81,1000,0,3000000,MAX_MONEY)
 def test_minimum_age_and_saturation(self):
  self.assertEqual(weight(COIN,1000,1900),0);self.assertEqual(weight(COIN,1000,1000+900+26*86400),25)
  with self.assertRaises(ValueError):weight(COIN,1000,1899)
 def test_retarget(self):
  self.assertEqual(next_bits(0x1e00ffff,1258,1000),0x1e00ffff);self.assertEqual(next_bits(0x1e00ffff,999,1000),0x1e00ffff)
  self.assertLess(target(next_bits(0x1e00ffff,1000,1000)),target(0x1e00ffff))
 def test_transition_and_trust_rule(self):
  self.assertFalse(eligible_kind(19,True));self.assertTrue(eligible_kind(20,True));self.assertTrue(eligible_kind(500,False));self.assertFalse(eligible_kind(501,False))
  self.assertGreater(2*trust(0x1d00ffff),10*trust(0x1e00ffff)) # shorter chain can have greater native trust
 def test_bad_compact_and_compactsize(self):
  for bits in (0,0x1e80ffff,0x2100ffff,0x1f00ffff):
   with self.assertRaises(ValueError):target(bits)
  with self.assertRaises(ValueError):varint(b'\xfd\x01\x00',0)
 def test_bootstrap_is_raw_not_rpc_assertion(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'bad.dat'
   for raw in (b'',b'{"finalized":true}',b'MOTA'+(100).to_bytes(4,'little')+bytes(10)):
    p.write_bytes(raw)
    with self.assertRaises(ValueError):blocks(p,lambda b:bytes(32))
if __name__=='__main__':unittest.main()
