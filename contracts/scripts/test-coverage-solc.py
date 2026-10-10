#!/usr/bin/env python3
"""Verify the coverage bridge cannot silently alter canonical qualification."""
import copy
import importlib.util
import os
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("coverage_solc", Path(__file__).with_name("coverage-solc.py"))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class CoverageBoundary(unittest.TestCase):
    def setUp(self):
        self.previous = os.environ.get("FOUNDRY_PROFILE")
        self.previous_linking = os.environ.get("FOUNDRY_DYNAMIC_TEST_LINKING")
        os.environ["FOUNDRY_PROFILE"] = "coverage"
        os.environ["FOUNDRY_DYNAMIC_TEST_LINKING"] = "false"
        self.payload = {"sources": {"src/example.sol": {"content": "unchanged"}},
            "settings": {"viaIR": True, "evmVersion": "cancun",
                "optimizer": {"enabled": True, "runs": 200,
                    "details": {"yulDetails": {"optimizerSteps": "u"}}},
                "outputSelection": {"*": {"*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.sourceMap"]}}}}

    def tearDown(self):
        if self.previous_linking is None:
            os.environ.pop("FOUNDRY_DYNAMIC_TEST_LINKING", None)
        else:
            os.environ["FOUNDRY_DYNAMIC_TEST_LINKING"] = self.previous_linking
        if self.previous is None:
            os.environ.pop("FOUNDRY_PROFILE", None)
        else:
            os.environ["FOUNDRY_PROFILE"] = self.previous

    def test_preserves_sources_and_other_settings_while_retaining_dependency_maps(self):
        expected = copy.deepcopy(self.payload)
        expected["settings"]["optimizer"] = bridge.CANONICAL_OPTIMIZER
        expected["settings"]["outputSelection"]["src/example.sol"] = {
            "*": sorted(expected["settings"]["outputSelection"]["*"]["*"])}
        bridge.restore_optimizer(self.payload)
        self.assertEqual(expected, self.payload)

    def test_rejects_canonical_build_profile_without_mutation(self):
        os.environ["FOUNDRY_PROFILE"] = "ci"
        original = copy.deepcopy(self.payload)
        with self.assertRaises(ValueError):
            bridge.restore_optimizer(self.payload)
        self.assertEqual(original, self.payload)

    def test_imported_dependency_keeps_runtime_maps_and_source_content(self):
        self.payload["sources"]["src/dependency.sol"] = {"content": "dependency unchanged"}
        self.payload["settings"]["outputSelection"] = {
            "src/example.sol": {"*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.sourceMap"]}}
        sources = copy.deepcopy(self.payload["sources"])
        bridge.restore_optimizer(self.payload)
        self.assertEqual(sources, self.payload["sources"])
        self.assertEqual(self.payload["settings"]["outputSelection"]["src/example.sol"],
                         self.payload["settings"]["outputSelection"]["src/dependency.sol"])

    def test_linked_deployment_mode_is_rejected_without_mutation(self):
        os.environ["FOUNDRY_DYNAMIC_TEST_LINKING"] = "true"
        original = copy.deepcopy(self.payload)
        with self.assertRaises(ValueError):
            bridge.restore_optimizer(self.payload)
        self.assertEqual(original, self.payload)

    def test_rejects_changed_compiler_inputs_without_mutation(self):
        for key, value in (("viaIR", False), ("evmVersion", "shanghai"),
                           ("optimizer", {"enabled": True, "runs": 200})):
            with self.subTest(key=key):
                payload = copy.deepcopy(self.payload)
                payload["settings"][key] = value
                original = copy.deepcopy(payload)
                with self.assertRaises(ValueError):
                    bridge.restore_optimizer(payload)
                self.assertEqual(original, payload)


if __name__ == "__main__":
    unittest.main()
