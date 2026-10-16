import json,unittest,copy,importlib.util
spec=importlib.util.spec_from_file_location('r072','scripts/highcountry/r07_2_rehearsal.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
SEED=json.load(open('deployments/highcountry/r07-2.dev-seed.json'))
class GenesisRehearsalTests(unittest.TestCase):
 def test_keccak_not_sha3(self):
  self.assertEqual(r.h(r.k(b'')),'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470')
 def test_repeatable_six_roots_and_merkle(self):
  a=r.make(SEED);self.assertEqual(a,r.make(SEED));self.assertEqual(len(a['roots']),6)
  self.assertTrue(all(a['prefinalization'][k] for k in ['sixRootsNonzero','threeRegions','sixteenFounders','allFounders28Loci','allLandProofsVerify']))
  self.assertFalse(a['prefinalization']['finalizationAuthorized'])
  for p in a['parcels']:self.assertTrue(r.verify_proof(r.raw32(p['leaf']),p['proof'],r.raw32(a['roots']['landRoot'])))
 def test_tampered_proof_fails(self):
  a=r.make(SEED);p=a['parcels'][0];self.assertFalse(r.verify_proof(r.k(b'tampered'),p['proof'],r.raw32(a['roots']['landRoot'])))
 def test_invalid_founder_locus_count(self):
  x=copy.deepcopy(SEED);x['founders'][0]['loci'].pop()
  with self.assertRaises(ValueError):r.make(x)
 def test_duplicate_parcel(self):
  x=copy.deepcopy(SEED);x['parcels'].append(x['parcels'][0])
  with self.assertRaises(ValueError):r.make(x)
 def test_release_denied(self):
  x=copy.deepcopy(SEED);x['releaseStatus']='APPROVED'
  with self.assertRaises(ValueError):r.make(x)
if __name__=='__main__':unittest.main()
