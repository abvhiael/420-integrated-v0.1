import json
from pathlib import Path
import unittest
from evidence import equihash, equihash_solution, transaction_inclusion

FIX = Path(__file__).resolve().parents[2]/'contracts/test/fixtures/pirate'
class PublicEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.header=bytes.fromhex((FIX/'historical-header.hex').read_text())
        cls.tx=bytes.fromhex((FIX/'historical-sapling.hex').read_text())
        cls.meta=json.loads((FIX/'historical-inclusion.json').read_text())
    def test_header_binding(self):
        self.assertEqual(equihash(self.header),self.meta['block_hash'])
    def test_mutated_header(self):
        h=bytearray(self.header);h[100]^=1
        with self.assertRaises(ValueError):equihash_solution(bytes(h))
    def test_duplicate_indices(self):
        with self.assertRaises(ValueError):equihash_solution(self.header[:143]+bytes(1344))
    def test_noncanonical_solution(self):
        with self.assertRaises(ValueError):equihash_solution(self.header[:140]+b'\xfe'+self.header[141:])
    def test_inclusion(self):
        self.assertEqual(transaction_inclusion(self.tx,1,[bytes.fromhex(x) for x in self.meta['merkle_branch']],self.header),self.meta['transaction_id'])
    def test_wrong_index(self):
        with self.assertRaises(ValueError):transaction_inclusion(self.tx,0,[bytes.fromhex(x) for x in self.meta['merkle_branch']],self.header)
    def test_noncanonical_index(self):
        with self.assertRaises(ValueError):transaction_inclusion(self.tx,2**31+1,[bytes.fromhex(x) for x in self.meta['merkle_branch']],self.header)
    def test_mutated_transaction(self):
        tx=bytearray(self.tx);tx[-1]^=1
        with self.assertRaises(ValueError):transaction_inclusion(bytes(tx),1,[bytes.fromhex(x) for x in self.meta['merkle_branch']],self.header)
    def test_v6_is_not_sha256d(self):
        tx=bytearray(self.tx);tx[0]=6
        with self.assertRaises(ValueError):transaction_inclusion(bytes(tx),1,[bytes.fromhex(x) for x in self.meta['merkle_branch']],self.header)
if __name__=='__main__':unittest.main()
