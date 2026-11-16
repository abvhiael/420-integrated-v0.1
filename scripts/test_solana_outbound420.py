#!/usr/bin/env python3
import copy,json,struct,unittest
from pathlib import Path
from solana_outbound420 import encode,decode
ROOT=Path(__file__).resolve().parents[1]
class CodecTests(unittest.TestCase):
 def setUp(self):self.m=json.loads((ROOT/'contracts/test/fixtures/solana/outbound-request-v1/request.json').read_text())
 def test_golden_and_independent_fixed_offsets(self):
  wire=encode(self.m);self.assertEqual(wire,bytes.fromhex((ROOT/'contracts/test/fixtures/solana/outbound-request-v1/golden.hex').read_text().strip()[2:]));self.assertEqual(len(wire),340);self.assertEqual(wire[196:228],bytes.fromhex(self.m['recipient'][2:]));self.assertEqual(struct.unpack('<Q',wire[260:268])[0],42*10**6);self.assertEqual(int.from_bytes(wire[300:332],'big'),2**128+1);self.assertEqual(wire[332:336],b'\x04\0\0\0');self.assertEqual(decode(wire),self.m)
 def test_recipient_retains_all_bits_and_zero_key_is_format_valid(self):
  for key in ['0x'+'00'*32,'0x'+'ff'*32,'0x'+'80'+'00'*31]:
   self.m['recipient']=key;self.assertEqual(decode(encode(self.m))['recipient'],key)
 def test_amount_u64_boundaries(self):
  self.m['solanaAmount']=2**64-1;self.assertEqual(decode(encode(self.m)),self.m)
  for v in [0,-1,2**64,True]:
   self.m['solanaAmount']=v
   with self.assertRaises(ValueError):encode(self.m)
 def test_full_nonce_width(self):
  self.m['nonce']=2**256-1;self.assertEqual(decode(encode(self.m))['nonce'],2**256-1)
  self.m['nonce']=2**256
  with self.assertRaises(ValueError):encode(self.m)
 def test_unknown_fields_and_credentials_reject(self):
  for name in ['viewingKey','privateKey','clusterFinalized']:
   m=copy.deepcopy(self.m);m[name]='untrusted'
   with self.assertRaises(ValueError):encode(m)
 def test_wrong_recipient_width(self):
  for size in [0,20,31,33,64]:
   self.m['recipient']='0x'+'01'*size
   with self.assertRaises(ValueError):encode(self.m)
 def test_malformed_serialization(self):
  w=encode(self.m)
  for data in [b'',w[:335],b'420SOLV1'+w[8:],w+b'\0',w[:-1],w[:332]+struct.pack('<I',2**32-1)+w[336:]]:
   with self.assertRaises(ValueError):decode(data)
 def test_nonhex_and_whitespace_reject(self):
  for key,value in [('extra','0x12  '),('extra','0xzz'),('recipient','0x'+'00'*31+'  ')]:
   m=copy.deepcopy(self.m);m[key]=value
   with self.assertRaises(ValueError):encode(m)
 def test_zero_identities_and_bool_integer_reject(self):
  for key in ['sourceRouter','sourceAdapter','messageId','routeId','assetId','sender','solanaAsset']:
   m=copy.deepcopy(self.m);m[key]='0x'+'00'*((len(m[key])-2)//2)
   with self.assertRaises(ValueError):encode(m)
  self.m['sourceChainId']=True
  with self.assertRaises(ValueError):encode(self.m)
if __name__=='__main__':unittest.main()
