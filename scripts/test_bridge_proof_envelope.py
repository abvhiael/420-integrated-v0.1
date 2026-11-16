import copy,unittest
from bridge_proof_envelope import encode,FIELDS,BYTES,ADDRESSES
class EnvelopeTests(unittest.TestCase):
 def claims(self):
  c={f:('0x'+('01'*32) if f in BYTES else '0x'+('02'*20) if f in ADDRESSES else 1) for f in FIELDS};c.update(destinationChainId=420,destinationChainIdEvm=420,observedAt=1000,expiresAt=4600);return c
 def test_canonical_dynamic_offsets(self):
  b=encode(self.claims(),b'\x01\x02\x03');self.assertEqual(len(b),736);self.assertEqual(int.from_bytes(b[:32],'big'),32);self.assertEqual(int.from_bytes(b[640:672],'big'),640);self.assertEqual(int.from_bytes(b[672:704],'big'),3);self.assertEqual(b[704:707],b'\x01\x02\x03')
 def test_unknown_fields_including_credentials_rejected(self):
  c=self.claims();c['viewing_key']='never accepted';self.assertRaises(ValueError,encode,c,b'a')
 def test_missing_field(self):
  c=self.claims();del c['sourceGateway'];self.assertRaises(ValueError,encode,c,b'a')
 def test_wrong_bytes_width(self):
  c=self.claims();c['sourceGateway']='0x01';self.assertRaises(ValueError,encode,c,b'a')
 def test_dirty_address_width(self):
  c=self.claims();c['recipient']='0x'+'00'*32;self.assertRaises(ValueError,encode,c,b'a')
 def test_uint64_overflow(self):
  c=self.claims();c['sourceChainId']=2**64;self.assertRaises(ValueError,encode,c,b'a')
 def test_uint256_overflow(self):
  c=self.claims();c['amount']=2**256;self.assertRaises(ValueError,encode,c,b'a')
 def test_bool_is_not_integer(self):
  c=self.claims();c['amount']=True;self.assertRaises(ValueError,encode,c,b'a')
 def test_expiry_window(self):
  c=self.claims();c['expiresAt']=c['observedAt'];self.assertRaises(ValueError,encode,c,b'a')
 def test_empty_proof(self):self.assertRaises(ValueError,encode,self.claims(),b'')
 def test_no_second_version(self):
  c=self.claims();c['version']=2;self.assertRaises(ValueError,encode,c,b'a')
 def test_no_same_chain(self):
  c=self.claims();c['destinationChainId']=c['sourceChainId'];self.assertRaises(ValueError,encode,c,b'a')
if __name__=='__main__':unittest.main()
