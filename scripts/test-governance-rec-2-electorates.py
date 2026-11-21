#!/usr/bin/env python3
"""GOV-REC-2 offline vector, input provenance and Merkle proof qualification."""
import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "contracts/test/fixtures"
spec = importlib.util.spec_from_file_location("gov_rec2_electorates", ROOT / "scripts/build-governance-rec-2-electorates.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class GovernanceRec2VectorsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((FIX / "governance-rec-2-members.json").read_text(encoding="utf-8"))

    def test_ethereum_keccak_vectors(self):
        self.assertEqual(module.keccak(b"").hex(), "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
        self.assertEqual(module.keccak(b"abc").hex(), "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45")
        self.assertEqual(
            module.leaf("0x00000000000000000000000000000000000a11ce"),
            module.keccak((0xA11CE).to_bytes(32, "big"))
        )

    def test_deterministic_houses_and_valid_proofs(self):
        vectors = module.make_vectors(self.source)
        self.assertEqual(vectors, module.make_vectors(copy.deepcopy(self.source)))
        golden = json.loads((FIX / "governance-rec-2-vectors.json").read_text(encoding="utf-8"))
        self.assertEqual(vectors, golden)
        self.assertTrue(vectors["fixtureOnly"])
        for house in vectors["houses"].values():
            self.assertEqual(house["totalWeight"], len(house["members"]))
            for member in house["members"]:
                root = bytes.fromhex(house["root"][2:])
                self.assertTrue(module.verify(root, member["address"], member["proof"]))
                self.assertFalse(module.verify(root, "0x" + "0" * 36 + "1111", member["proof"]))

    def test_wrong_root_is_rejected(self):
        source = copy.deepcopy(self.source)
        source["houses"]["COMMUNITY"]["expectedRoot"] = "0x" + "01" * 32
        with self.assertRaisesRegex(ValueError, "Merkle root mismatch"):
            module.make_vectors(source)

    def test_case_insensitive_duplicate_rejected(self):
        source = copy.deepcopy(self.source)
        section = source["houses"]["VALIDATOR"]
        section["members"][1]["address"] = section["members"][0]["address"].lower()
        with self.assertRaisesRegex(ValueError, "duplicate"):
            module.make_vectors(source)

    def test_empty_zero_and_missing_evidence_rejected(self):
        for case in ("empty", "zero", "missing_evidence"):
            source = copy.deepcopy(self.source)
            section = source["houses"]["VALIDATOR"]
            if case == "empty":
                section["members"] = []
                section["totalWeight"] = 0
            elif case == "zero":
                section["members"][0]["address"] = "0x" + "0" * 40
            else:
                section["members"][0]["evidence"] = {}
            with self.subTest(case=case), self.assertRaises(ValueError):
                module.make_vectors(source)

    def test_mismatched_weights_rejected(self):
        for total in (0, 1, 3):
            source = copy.deepcopy(self.source)
            source["houses"]["COMMUNITY"]["totalWeight"] = total
            with self.subTest(total=total), self.assertRaisesRegex(ValueError, "totalWeight"):
                module.make_vectors(source)

    def test_unverified_release_evidence_rejected(self):
        source = copy.deepcopy(self.source)
        source["fixtureOnly"] = False
        with self.assertRaisesRegex(ValueError, "eligibility-source"):
            module.make_vectors(source)
        source["eligibilitySource"] = {
            "reference": "https://example.invalid/verified-external-source",
            "snapshotHash": "0x" + "01" * 32
        }
        with self.assertRaisesRegex(ValueError, "unverified eligibility"):
            module.make_vectors(source)
        # Successful structural validation is not independent attestation of external eligibility.
        for section in source["houses"].values():
            for member in section["members"]:
                member["evidence"].update({"eligible": True, "recordHash": "0x" + "11" * 32})
        candidate = module.make_vectors(source)
        self.assertFalse(candidate["fixtureOnly"])

    def test_explicit_weighting_and_wrong_chain_rejected(self):
        source = copy.deepcopy(self.source)
        source["houses"]["VALIDATOR"]["members"][0]["weight"] = 10
        with self.assertRaisesRegex(ValueError, "weighting"):
            module.make_vectors(source)
        source = copy.deepcopy(self.source)
        source["fixtureOnly"] = False
        source["eligibilitySource"] = {
            "reference": "verified-reference", "snapshotHash": "0x" + "11" * 32, "chainId": 1
        }
        with self.assertRaisesRegex(ValueError, "chain identity mismatch"):
            module.make_vectors(source)

    def test_odd_nodes_and_numerical_address_order(self):
        source = copy.deepcopy(self.source)
        section = source["houses"]["COMMUNITY"]
        section["members"].append({
            "address": "0x" + "0" * 39 + "1",
            "evidence": {"reference": "TEST_ONLY:third"}
        })
        section["totalWeight"] = 3
        result = module.make_vectors(source)["houses"]["COMMUNITY"]
        self.assertEqual(result["members"][0]["address"], "0x" + "0" * 39 + "1")
        for member in result["members"]:
            self.assertTrue(module.verify(bytes.fromhex(result["root"][2:]), member["address"], member["proof"]))


if __name__ == "__main__":
    unittest.main()
