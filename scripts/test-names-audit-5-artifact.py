#!/usr/bin/env python3
"""Focused adversarial tests for NAMES-AUDIT-5 artifact generation."""
import copy
import importlib.util
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts/generate-names-audit-5-artifact.py"
spec = importlib.util.spec_from_file_location("names_audit_5", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class NamesAudit5GeneratorTests(unittest.TestCase):
    def minimal_raw(self):
        abi = [{"type": "function", "name": name} for name in [
            "makeCommitment", "commit", "register", "renew", "setResolution",
            "setReverseName", "reverseResolve", "nameClaimsProfile", "transferName",
            "acceptName", "isAvailable", "resolve", "protocolVersion", "systemName",
            "governanceTimelock",
        ]]
        abi += [{"type": "event", "name": name} for name in [
            "CommitmentMade", "NameRegistered", "NameRenewed", "ResolutionUpdated",
            "ReverseNameSet", "NameTransferStarted", "NameTransferred",
        ]]
        return {
            "abi": abi,
            "bytecode": {"object": "0x6000"},
            "deployedBytecode": {
                "object": "0x" + ("00" * 96),
                "immutableReferences": {"1": [{"start": 32, "length": 32}]},
            },
            "storageLayout": {
                "storage": [
                    {"label": "records"},
                    {"label": "commitments"},
                    {"label": "primaryNameByAddress"},
                ]
            },
            "metadata": {"compiler": {"version": "0.8.24+commit.e11b9ed9"}},
        }

    def test_required_abi_surface_is_enforced(self):
        raw = self.minimal_raw()
        raw["abi"] = [entry for entry in raw["abi"] if entry.get("name") != "resolve"]
        with self.assertRaisesRegex(ValueError, "missing required functions"):
            mod.validate_abi(raw["abi"])

    def test_required_event_surface_is_enforced(self):
        raw = self.minimal_raw()
        raw["abi"] = [entry for entry in raw["abi"] if entry.get("name") != "NameTransferred"]
        with self.assertRaisesRegex(ValueError, "missing required events"):
            mod.validate_abi(raw["abi"])

    def test_missing_immutable_references_fail_closed(self):
        raw = self.minimal_raw()
        raw["deployedBytecode"]["immutableReferences"] = {}
        with self.assertRaisesRegex(ValueError, "no immutableReferences"):
            mod.validate_immutables(raw)

    def test_multiple_immutable_ids_fail_closed(self):
        raw = self.minimal_raw()
        raw["deployedBytecode"]["immutableReferences"]["2"] = [{"start": 0, "length": 32}]
        with self.assertRaisesRegex(ValueError, "immutable identifier count"):
            mod.validate_immutables(raw)

    def test_out_of_bounds_immutable_reference_fails_closed(self):
        raw = self.minimal_raw()
        raw["deployedBytecode"]["immutableReferences"] = {"1": [{"start": 80, "length": 32}]}
        with self.assertRaisesRegex(ValueError, "outside deployed bytecode"):
            mod.validate_immutables(raw)

    def test_wrong_immutable_width_fails_closed(self):
        raw = self.minimal_raw()
        raw["deployedBytecode"]["immutableReferences"] = {"1": [{"start": 32, "length": 20}]}
        with self.assertRaisesRegex(ValueError, "immutable width"):
            mod.validate_immutables(raw)

    def test_storage_layout_requires_all_names_mappings(self):
        raw = self.minimal_raw()
        raw["storageLayout"]["storage"] = [{"label": "records"}, {"label": "commitments"}]
        with self.assertRaisesRegex(ValueError, "primaryNameByAddress"):
            mod.validate_storage_layout(raw)

    def test_governance_timelock_must_remain_immutable(self):
        raw = self.minimal_raw()
        raw["storageLayout"]["storage"].append({"label": "governanceTimelock"})
        with self.assertRaisesRegex(ValueError, "mutable storage"):
            mod.validate_storage_layout(raw)

    def test_metadata_rejects_wrong_compiler(self):
        raw = self.minimal_raw()
        raw["metadata"]["compiler"]["version"] = "0.8.25"
        with self.assertRaisesRegex(ValueError, "not Solidity 0.8.24"):
            mod.parse_metadata(raw)

    def test_hex_normalization_rejects_malformed_payload(self):
        with self.assertRaisesRegex(ValueError, "invalid hex"):
            mod.normalize_hex("0x0z")


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(NamesAudit5GeneratorTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
