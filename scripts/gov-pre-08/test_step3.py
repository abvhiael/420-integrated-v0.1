#!/usr/bin/env python3
"""Step 3 negative tests for bytecode integrity and real local receipt provenance."""
import copy
import importlib.util
import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location(
    "govpre08step3", HERE / "materialize-v4-source-and-audit-local.py")
stage = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = stage
SPEC.loader.exec_module(stage)

class ArtifactBoundaries(unittest.TestCase):
    def good(self):
        return {"abi": [], "storageLayout": {"storage": [], "types": {}},
                "bytecode": {"object": "0x60006000", "linkReferences": {}},
                "deployedBytecode": {"object": "0x60006000", "linkReferences": {}}}

    def test_valid_compiler_output(self):
        self.assertEqual(stage.check_artifact(self.good(), "X")["abi"], [])

    def test_unlinked_library_rejected(self):
        a = self.good()
        a["bytecode"]["linkReferences"] = {"src": {"Lib": [{"start": 3, "length": 20}]}}
        with self.assertRaises(ValueError):
            stage.check_artifact(a, "X")

    def test_missing_storage_layout_rejected(self):
        a = self.good()
        a.pop("storageLayout")
        with self.assertRaises(ValueError):
            stage.check_artifact(a, "X")

    def test_placeholder_runtime_rejected(self):
        a = self.good()
        a["deployedBytecode"]["object"] = "0x__0__"
        with self.assertRaises(ValueError):
            stage.check_artifact(a, "X")

    def test_canonical_source_digest_is_order_independent(self):
        self.assertEqual(stage.sha256(stage.canonical({"a": 1, "b": 2})),
                         stage.sha256(stage.canonical({"b": 2, "a": 1})))

class LiveReceiptBoundaries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rpc_url = os.environ.get("GOV_PRE_08_RPC")
        receipt_path = os.environ.get("GOV_PRE_08_STEP2_EVIDENCE")
        if not rpc_url or not receipt_path:
            raise unittest.SkipTest("live negative tests need loopback Anvil + evidence")
        cls.rpc = stage.funding.Rpc(rpc_url)
        cls.witness = stage.read(Path(receipt_path))
        cls.baseline = stage.receipt_view(cls.rpc, cls.witness)

    def mutated(self, mutate):
        data = copy.deepcopy(self.witness)
        mutate(data)
        with self.assertRaises(ValueError):
            stage.receipt_view(self.rpc, data)

    def test_unchanged_local_receipts_rebuild(self):
        self.assertEqual(self.baseline["receipts"], 18)
        self.assertEqual(self.baseline["fundingEvents"], 6)

    def test_reject_forged_approval(self):
        self.mutated(lambda x: x.__setitem__("signedGenesisV4Approved", True))

    def test_reject_wrong_chain_evidence(self):
        self.mutated(lambda x: x.__setitem__("chainId", 420))

    def test_reject_stale_source_sha(self):
        self.mutated(lambda x: x.__setitem__("sourceGitHead", "0" * 40))

    def test_reject_replayed_receipt(self):
        def change(x):
            x["txReceipts"][1]["tx"] = x["txReceipts"][0]["tx"]
        self.mutated(change)

    def test_reject_missing_receipt(self):
        self.mutated(lambda x: x["txReceipts"].pop())

    def test_reject_inflated_genesis_supply(self):
        self.mutated(lambda x: x.__setitem__("postFundingNativeSupplyWei", str(47_040_000 * stage.KIEF)))

if __name__ == "__main__":
    unittest.main(verbosity=2)
