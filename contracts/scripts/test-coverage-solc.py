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
        os.environ["FOUNDRY_PROFILE"] = "coverage"
        self.payload = {"sources": {"src/example.sol": {"content": "unchanged"}},
            "settings": {"viaIR": True, "evmVersion": "cancun",
                "optimizer": {"enabled": True, "runs": 200,
                    "details": {"yulDetails": {"optimizerSteps": "u"}}},
                "outputSelection": {"*": {"*": ["abi", "evm.bytecode.sourceMap"]}}}}

    def tearDown(self):
        if self.previous is None:
            os.environ.pop("FOUNDRY_PROFILE", None)
        else:
            os.environ["FOUNDRY_PROFILE"] = self.previous

    def test_preserves_sources_and_all_non_optimizer_settings(self):
        expected = copy.deepcopy(self.payload)
        expected["settings"]["optimizer"] = bridge.CANONICAL_OPTIMIZER
        bridge.restore_optimizer(self.payload)
        self.assertEqual(expected, self.payload)

    def test_rejects_canonical_build_profile_without_mutation(self):
        os.environ["FOUNDRY_PROFILE"] = "ci"
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
