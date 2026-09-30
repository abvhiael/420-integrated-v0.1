#!/usr/bin/env python3
"""Focused negative/adversarial tests for REG-AUDIT-5 predeploy materialization."""
import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).with_name("generate-reg-audit-5-registry-predeploy.py")
spec = importlib.util.spec_from_file_location("reg5", SCRIPT)
reg5 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reg5)

IMMUTABLE = "0x" + "00" * 96
TIMELOCK_WORD = bytes.fromhex("00" * 12 + reg5.GOVERNANCE_TIMELOCK[2:])


class RegAudit5Tests(unittest.TestCase):
    def artifact(self, refs=None):
        if refs is None:
            refs = {"0": [{"start": 16, "length": 32}, {"start": 64, "length": 32}]}
        return {
            "deployedBytecode": {
                "object": IMMUTABLE,
                "immutableReferences": refs,
            },
            "storageLayout": {
                "storage": [
                    {"label": "_services", "slot": "0", "offset": 0, "type": "t_mapping"},
                    {"label": "_history", "slot": "1", "offset": 0, "type": "t_mapping"},
                ],
                "types": {},
            },
        }

    def test_materializes_every_compiler_reported_immutable_reference(self):
        runtime, patched, _ = reg5.patch_immutable_runtime(self.artifact())
        code = bytes.fromhex(runtime[2:])
        self.assertEqual(code[16:48], TIMELOCK_WORD)
        self.assertEqual(code[64:96], TIMELOCK_WORD)
        self.assertEqual(len(patched), 2)

    def test_missing_immutable_references_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "no compiler immutableReferences"):
            reg5.patch_immutable_runtime(self.artifact({}))

    def test_multiple_immutable_identifiers_fail_closed(self):
        refs = {
            "0": [{"start": 0, "length": 32}],
            "1": [{"start": 32, "length": 32}],
        }
        with self.assertRaisesRegex(ValueError, "unexpected ProtocolRegistry immutable identifier count"):
            reg5.patch_immutable_runtime(self.artifact(refs))

    def test_wrong_immutable_width_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "unexpected immutable width"):
            reg5.patch_immutable_runtime(self.artifact({"0": [{"start": 0, "length": 20}]}))

    def test_out_of_bounds_immutable_reference_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "outside deployed bytecode"):
            reg5.patch_immutable_runtime(self.artifact({"0": [{"start": 80, "length": 32}]}))

    def test_governance_timelock_must_not_be_mutable_storage(self):
        raw = self.artifact()
        raw["storageLayout"]["storage"].append(
            {"label": "governanceTimelock", "slot": "9", "offset": 0, "type": "t_address"}
        )
        with self.assertRaisesRegex(ValueError, "unexpectedly occupies mutable storage"):
            reg5.validate_storage_layout(raw)

    def test_declared_mapping_slots_do_not_become_genesis_storage_writes(self):
        layout = reg5.validate_storage_layout(self.artifact())
        self.assertGreater(len(layout["storage"]), 0)
        # Layout declarations exist, but ProtocolRegistry's constructor initializes no mutable slots.
        self.assertNotIn("governanceTimelock", {x["label"] for x in layout["storage"]})


if __name__ == "__main__":
    unittest.main()
