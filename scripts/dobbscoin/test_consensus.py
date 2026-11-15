import unittest,struct
from consensus import *

def header(t=1000,b=0x1e0fffff,version=3):return struct.pack('<I',version)+bytes(64)+struct.pack('<III',t,b,0)
class ConsensusTests(unittest.TestCase):
    def test_compact_boundaries(self):
        for x in [1,255,256,0x123456,1<<200,LIMIT]:self.assertLessEqual(target(compact(x)),x)
        for x in [0,0x1e8fffff,0x23000001,0x22000100,0x21010000,0x1f0fffff]:
            with self.assertRaises(ValueError):target(x)
    def test_activation(self):
        self.assertFalse(activation(header(),1999999));self.assertFalse(activation(header(version=(176<<16)|3),2000000));self.assertTrue(activation(header(version=(176<<16)|259),2000000))
        for h,n in [(header(version=259),1999999),(header(version=(176<<16)|3),1999999),(header(),2000000),(header(version=(177<<16)|259),2000000)]:
            with self.assertRaises(ValueError):activation(h,n)
    def test_emergency_boundaries(self):
        p=header(t=1000)
        self.assertFalse(emergency(1888887,header(22601),p));self.assertFalse(emergency(1888888,header(22600),p));self.assertTrue(emergency(1888888,header(22601),p));self.assertFalse(emergency(1888888,header(999),p));self.assertFalse(emergency(1888888,header(22601,0x1e0ffffe),p))
    def test_modes(self):self.assertEqual([mode(h) for h in [13578,13579,31596,31597,68424,68425,1888807,1888808]],[1,2,2,3,3,4,4,5])
    def test_truncation_toward_zero(self):self.assertEqual(trunc(-7,8),0);self.assertEqual(trunc(-9,8),-1)
    def test_v1_interval(self):
        hs=[header(t=i*600,b=0x1d123456) for i in range(2016)]
        self.assertEqual(expected(hs,2015),0x1d123456)
        self.assertEqual(expected(hs,2016),compact(target(0x1d123456)*1209000//1209600))
    def test_digishield_negative_filter(self):
        class H:
            def __getitem__(self,i):return header(t=1000 if i==68424 else 1001,b=0x1d123456)
        self.assertEqual(expected(H(),68425),compact(target(0x1d123456)*105//120))
    def test_lwma_bootstrap_and_floor(self):
        class H:
            def __getitem__(self,i):return header(t=i*120,b=0x1d123456)
        self.assertEqual(expected(H(),1888867),0x1d123456)
        self.assertEqual(expected(H(),1888868),compact((target(0x1d123456)//(60*219600))*60*219600))
    def test_genesis_is_explicit_exception(self):self.assertGreater(int(GENESIS_POW,16),target(0x1e0ffff0))
    def test_money_is_not_bitcoin_cap(self):
        raw=bytes.fromhex('0100000001')+bytes(32)+bytes(4)+b'\x00'+bytes(4)+b'\x01'+(30000000*10**8).to_bytes(8,'little')+b'\x00'+bytes(4)
        t,end=tx(raw);self.assertEqual(end,len(raw));self.assertEqual(t['outputs'][0][0],30000000*10**8)
    def test_nonminimal_compact(self):
        for raw in [b'\xfd\x01\x00',b'\xfe\xff\x00\x00\x00',b'\xff'+bytes(8)]:
            with self.assertRaises(ValueError):cs(raw,0)
    def test_merkle_mutation_and_position(self):
        a=dsha(b'a');b=dsha(b'b');self.assertEqual(merkle([a,b]),branch(b,1,[a]))
        with self.assertRaises(ValueError):merkle([a,a])
        with self.assertRaises(ValueError):branch(a,2,[b])
    def test_slot_uint32_wrap(self):
        for n in [0,1,0xffffffff,0x80000000]:
            for h in range(31):self.assertLess(expected_index(n,h),1<<h)
    def test_empty_and_truncated_transactions(self):
        for raw in [b'',bytes(10),b'\x01\x00\x00\x00\xfd']:
            with self.assertRaises(ValueError):tx(raw)
if __name__=='__main__':unittest.main()
