#!/usr/bin/env python3
"""Verify the coverage bridge cannot silently alter canonical qualification."""
import copy
import importlib.util
import json
import os
from pathlib import Path
from types import SimpleNamespace
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


    @staticmethod
    def compiler_response(errors=(), returncode=0):
        return SimpleNamespace(returncode=returncode,
            stdout=json.dumps({"errors": list(errors)}).encode(), stderr=b"")

    def test_compiler_bridge_is_executable(self):
        self.assertTrue(os.access(Path(__file__).with_name("coverage-solc.py"), os.X_OK))

    def test_successful_default_compile_never_retries(self):
        bridge.restore_optimizer(self.payload)
        calls = []
        result, attempts, selected = bridge.compile_with_fallback(self.payload,
            lambda encoded: calls.append(json.loads(encoded)) or self.compiler_response())
        self.assertEqual(1, len(calls))
        self.assertEqual(["PASS"], [attempt["result"] for attempt in attempts])
        self.assertEqual(self.payload, selected)
        self.assertEqual(0, result.returncode)

    def test_only_yul_stack_failure_can_retry(self):
        bridge.restore_optimizer(self.payload)
        stack = {"severity": "error", "type": "YulException",
                 "message": "Variable _3 is 1 too deep in the stack"}
        parser = {"severity": "error", "type": "ParserError", "message": "invalid source"}
        for errors, returncode in (([parser], 0), ([stack, parser], 0),
                                  ([stack], 1), ([], 1),
                                  ([{**stack, "message": "another Yul failure"}], 0)):
            with self.subTest(errors=errors, returncode=returncode):
                calls = []
                result, attempts, _ = bridge.compile_with_fallback(self.payload,
                    lambda encoded: calls.append(encoded)
                        or self.compiler_response(errors, returncode))
                self.assertEqual(1, len(calls))
                self.assertEqual("FAIL", attempts[0]["result"])
                self.assertEqual(returncode, result.returncode)

    def test_yul_retry_preserves_sources_all_other_settings_and_failed_evidence(self):
        bridge.restore_optimizer(self.payload)
        original = copy.deepcopy(self.payload)
        stack = {"severity": "error", "type": "YulException",
                 "message": "Variable _3 is 1 too deep in the stack"}
        calls = []
        def compiler_run(encoded):
            calls.append(json.loads(encoded))
            return self.compiler_response([stack] if len(calls) == 1 else [])
        _, attempts, selected = bridge.compile_with_fallback(self.payload, compiler_run)
        expected = copy.deepcopy(original)
        expected["settings"]["optimizer"] = {**bridge.CANONICAL_OPTIMIZER,
            "details": {"yulDetails": {"optimizerSteps": bridge.STACK_SAFE_SEQUENCE}}}
        self.assertEqual([original, expected], calls)
        self.assertEqual(original, self.payload)
        self.assertEqual(expected, selected)
        self.assertEqual(["FAIL", "PASS"], [attempt["result"] for attempt in attempts])
        self.assertEqual([stack], attempts[0]["errors"])
        self.assertEqual(attempts[0]["sources_sha256"], attempts[1]["sources_sha256"])
        self.assertNotEqual(attempts[0]["input_sha256"], attempts[1]["input_sha256"])
        self.assertNotIn("i", bridge.STACK_SAFE_SEQUENCE)

    def test_failed_bounded_retry_remains_an_error(self):
        bridge.restore_optimizer(self.payload)
        stack = {"severity": "error", "type": "YulException",
                 "message": "Variable _3 is 1 too deep in the stack"}
        calls = []
        result, attempts, _ = bridge.compile_with_fallback(self.payload,
            lambda encoded: calls.append(encoded) or self.compiler_response([stack]))
        self.assertEqual(2, len(calls))
        self.assertEqual(["FAIL", "FAIL"], [attempt["result"] for attempt in attempts])
        self.assertEqual([stack], json.loads(result.stdout)["errors"])


if __name__ == "__main__":
    unittest.main()
