#!/usr/bin/env python3
import copy
import importlib.util
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
VERIFIER_PATH = ROOT / "scripts/verify-step6-contracts.py"
spec = importlib.util.spec_from_file_location("verify_step6_contracts", VERIFIER_PATH)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class FrozenManifestProjectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.system_addresses = json.loads(
            (ROOT / "config/system-addresses.json").read_text()
        )
        cls.manifest = json.loads(
            (ROOT / "contracts/config/deployment-manifest.json").read_text()
        )

    def projection_diff(self, manifest):
        _, _, diff = verifier.frozen_manifest_projection(
            self.system_addresses["assignments"],
            manifest,
            self.system_addresses["frozen_through"],
        )
        return diff

    def test_current_frozen_projection_matches(self):
        self.assertIsNone(self.projection_diff(self.manifest))

    def test_reports_exact_path_when_deployment_classification_drifts(self):
        mutated = copy.deepcopy(self.manifest)
        index = next(
            i
            for i, contract in enumerate(mutated["contracts"])
            if contract["name"] == "ProtocolRegistry"
        )
        mutated["contracts"][index]["deployment"] = "CREATE2"

        diff = self.projection_diff(mutated)
        self.assertIsNotNone(diff)
        message = verifier.format_difference(
            "deployment manifest frozen projection mismatch", diff
        )
        self.assertIn(f"$.contracts[{index}].deployment", message)
        self.assertIn('expected="GENESIS_SYSTEM_ADDRESS"', message)
        self.assertIn('actual="CREATE2"', message)

    def test_reports_missing_frozen_contract_at_exact_index(self):
        mutated = copy.deepcopy(self.manifest)
        index = next(
            i
            for i, contract in enumerate(mutated["contracts"])
            if contract["name"] == "Names420"
        )
        del mutated["contracts"][index]

        diff = self.projection_diff(mutated)
        self.assertIsNotNone(diff)
        message = verifier.format_difference(
            "deployment manifest frozen projection mismatch", diff
        )
        self.assertIn(f"$.contracts[{index}].name", message)
        self.assertIn('expected="Names420"', message)


if __name__ == "__main__":
    unittest.main()
