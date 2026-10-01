#!/usr/bin/env python3
"""Focused adversarial tests for NAMES-AUDIT-6 Genesis materialization."""
import copy
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts/generate-names-audit-6-genesis-state.py"
spec = importlib.util.spec_from_file_location("names_audit_6", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class NamesAudit6GenesisStateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.artifact = json.loads((ROOT / "contracts/artifacts/Names420.json").read_text())

    def compiler_artifact(self):
        artifact = copy.deepcopy(self.artifact)
        artifact.pop("genesisMaterialization", None)
        artifact["status"] = "NAMES_AUDIT_5_FROZEN_COMPILER_ARTIFACT"
        return artifact

    def test_materializes_governance_timelock_only_at_reported_reference(self):
        artifact = self.compiler_artifact()
        runtime = bytes.fromhex(artifact["compilerDeployedBytecode"][2:])
        materialized, ref = mod.patch_runtime(artifact)
        patched = bytes.fromhex(materialized[2:])
        self.assertEqual(ref["length"], 32)
        self.assertEqual(ref["start"], 1126)
        self.assertEqual(
            patched[1126:1158],
            bytes.fromhex("00" * 12 + mod.GOVERNANCE_TIMELOCK[2:]),
        )
        self.assertEqual(runtime[:1126], patched[:1126])
        self.assertEqual(runtime[1158:], patched[1158:])

    def test_wrong_immutable_location_count_fails_closed(self):
        artifact = self.compiler_artifact()
        key = next(iter(artifact["immutableReferences"]))
        artifact["immutableReferences"][key].append({"start": 0, "length": 32})
        with self.assertRaisesRegex(ValueError, "exactly one immutable materialization"):
            mod.patch_runtime(artifact)

    def test_wrong_immutable_width_fails_closed(self):
        artifact = self.compiler_artifact()
        key = next(iter(artifact["immutableReferences"]))
        artifact["immutableReferences"][key][0]["length"] = 20
        with self.assertRaisesRegex(ValueError, "malformed governanceTimelock"):
            mod.patch_runtime(artifact)

    def test_out_of_bounds_immutable_reference_fails_closed(self):
        artifact = self.compiler_artifact()
        key = next(iter(artifact["immutableReferences"]))
        artifact["immutableReferences"][key][0]["start"] = len(bytes.fromhex(artifact["compilerDeployedBytecode"][2:]))
        with self.assertRaisesRegex(ValueError, "outside runtime"):
            mod.patch_runtime(artifact)

    def test_storage_root_layout_is_exact(self):
        artifact = self.compiler_artifact()
        self.assertEqual(
            mod.validate_storage(artifact),
            {"records": "0", "commitments": "1", "primaryNameByAddress": "2"},
        )

    def test_storage_layout_reordering_fails_closed(self):
        artifact = self.compiler_artifact()
        artifact["storageLayout"]["storage"][1]["slot"] = "9"
        with self.assertRaisesRegex(ValueError, "root storage layout drift"):
            mod.validate_storage(artifact)

    def test_frozen_source_identity_drift_fails_closed(self):
        artifact = self.compiler_artifact()
        artifact["sourceBlobSha1"] = "0" * 40
        with self.assertRaisesRegex(ValueError, "frozen artifact drift"):
            mod.frozen_compiler_view(artifact)

    def test_final_runtime_is_not_compiler_template(self):
        artifact = self.compiler_artifact()
        materialized, _ = mod.patch_runtime(artifact)
        self.assertNotEqual(materialized, artifact["compilerDeployedBytecode"])


if __name__ == "__main__":
    result = unittest.TextTestRunner(verbosity=2).run(
        unittest.defaultTestLoader.loadTestsFromTestCase(NamesAudit6GenesisStateTests)
    )
    sys.exit(0 if result.wasSuccessful() else 1)
