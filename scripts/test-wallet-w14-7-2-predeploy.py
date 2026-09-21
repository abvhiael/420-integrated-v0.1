#!/usr/bin/env python3
"""W14.7.2 generator qualification regression tests (no real Genesis writes)."""
import copy
import importlib.util
import json
import pathlib
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name("generate-genesis-predeploys.py")
spec = importlib.util.spec_from_file_location("w1472_generator", SCRIPT)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)

ADDR = "0x" + "0" * 36 + "0446"
WORD0 = "0x" + "0" * 64
WORD1 = "0x" + "0" * 63 + "1"


class PredeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.artifacts = pathlib.Path(self.temp.name)
        (self.artifacts / "SmartAccountFactory420.json").write_text(
            json.dumps({"deployedBytecode": {"object": "0x60016000"}}), encoding="utf-8")
        self.plan = {"status": "FROZEN_ADDRESS_MAP_ARTIFACTS_READY",
                     "predeploys": [{"name": "SmartAccountFactory420", "address": ADDR}]}
        self.genesis = {"alloc": {}}
        self.storage = {"SmartAccountFactory420": {WORD0: WORD1}}

    def qualify(self, namespace_errors=()):
        return generator.qualify(self.plan, self.genesis, self.storage,
                                 self.artifacts, namespace_errors)

    def test_valid_fixture_uses_runtime_not_creation_code(self):
        result, records, errors = self.qualify()
        self.assertEqual(errors, [])
        self.assertEqual(result["alloc"][ADDR]["code"], "0x60016000")
        self.assertEqual(result["alloc"][ADDR]["storage"], self.storage["SmartAccountFactory420"])
        self.assertEqual(records[0]["runtime_code_bytes"], 4)
        self.assertEqual(self.genesis["alloc"], {})

    def test_namespace_conflict_blocks_without_mutation(self):
        result, _, errors = self.qualify(["address collision"])
        self.assertIsNone(result)
        self.assertIn("address collision", errors)
        self.assertEqual(self.genesis["alloc"], {})

    def test_unfrozen_plan_blocks(self):
        self.plan["status"] = "FROZEN_ADDRESS_MAP_ARTIFACTS_PENDING"
        self.assertIsNone(self.qualify()[0])

    def test_missing_runtime_artifact_blocks(self):
        (self.artifacts / "SmartAccountFactory420.json").unlink()
        self.assertTrue(any("missing compiled runtime" in error for error in self.qualify()[2]))

    def test_unlinked_runtime_code_blocks(self):
        (self.artifacts / "SmartAccountFactory420.json").write_text(
            json.dumps({"deployedBytecode": {"object": "0x6001__$library$__"}}), encoding="utf-8")
        self.assertTrue(any("invalid/unlinked" in error for error in self.qualify()[2]))

    def test_existing_genesis_account_blocks(self):
        self.genesis["alloc"][ADDR] = {"balance": "0x0"}
        self.assertTrue(any("already occupies" in error for error in self.qualify()[2]))

    def test_missing_constructor_storage_blocks(self):
        self.storage = {}
        self.assertIsNone(self.qualify()[0])
        self.assertTrue(any("missing explicit storage" in error for error in self.qualify()[2]))

    def test_malformed_storage_slot_blocks(self):
        self.storage["SmartAccountFactory420"] = {"0x1": WORD1}
        self.assertTrue(any("invalid storage" in error for error in self.qualify()[2]))

    def test_duplicate_predeploy_address_blocks(self):
        self.plan["predeploys"].append({"name": "OtherContract", "address": ADDR})
        self.assertTrue(any("duplicate predeploy" in error for error in self.qualify()[2]))

    def test_unexpected_storage_identity_blocks(self):
        self.storage["UnplannedContract"] = {}
        self.assertTrue(any("exactly the planned" in error for error in self.qualify()[2]))


if __name__ == "__main__":
    unittest.main()
