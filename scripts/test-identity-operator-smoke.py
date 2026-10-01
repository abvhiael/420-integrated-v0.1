#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest
from unittest import mock

SCRIPT = Path(__file__).with_name("identity-operator-smoke.py")
spec = importlib.util.spec_from_file_location("identity_operator_smoke", SCRIPT)
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class IdentityOperatorSmokeTests(unittest.TestCase):
    def test_offline_release_tree_verifies(self):
        runtime_hash = "0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86"
        with mock.patch.object(smoke, "cast", return_value=runtime_hash):
            result = smoke.offline_verify()
        self.assertEqual(result["address"], smoke.IDENTITY)
        self.assertEqual(result["governanceTimelock"], smoke.TIMELOCK)
        self.assertEqual(result["runtimeCodeHash"], runtime_hash)
        self.assertEqual(result["status"], "OFFLINE_RELEASE_TREE_VERIFIED")

    def test_offline_runtime_hash_drift_fails_closed(self):
        with mock.patch.object(smoke, "cast", return_value="0x" + "11" * 32):
            with self.assertRaisesRegex(smoke.SmokeError, "runtime hash mismatch"):
                smoke.offline_verify()

    def test_live_smoke_checks_chain_code_identity_version_timelock_and_unknown_credential(self):
        runtime_hash = "0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86"
        calls = []

        def fake_cast(*args):
            calls.append(args)
            if args[0] == "keccak":
                return runtime_hash
            if args[0] == "chain-id":
                return "420"
            if args[0] == "code":
                return "0x60016000"
            if args[0] == "call":
                signature = args[2]
                if signature == "systemName()(string)":
                    return "Identity420"
                if signature == "protocolVersion()(uint32)":
                    return "3"
                if signature == "governanceTimelock()(address)":
                    return smoke.TIMELOCK
                if signature == "credentialValid(bytes32)(bool)":
                    return "false"
            raise AssertionError(args)

        with mock.patch.object(smoke, "cast", side_effect=fake_cast):
            result = smoke.live_verify("https://rpc.invalid.example", 420)

        self.assertEqual(result["chainId"], 420)
        self.assertEqual(result["systemName"], "Identity420")
        self.assertEqual(result["protocolVersion"], 3)
        self.assertTrue(result["unknownCredentialFailsClosed"])
        self.assertEqual(result["status"], "LIVE_READ_ONLY_SMOKE_PASS")
        self.assertTrue(any(c[0] == "code" for c in calls))
        self.assertTrue(any(c[0] == "call" and c[2] == "governanceTimelock()(address)" for c in calls))

    def test_live_wrong_chain_fails_closed_before_contract_calls(self):
        runtime_hash = "0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86"
        def fake_cast(*args):
            if args[0] == "keccak":
                return runtime_hash
            if args[0] == "chain-id":
                return "421"
            raise AssertionError("contract call should not run after chain mismatch")
        with mock.patch.object(smoke, "cast", side_effect=fake_cast):
            with self.assertRaisesRegex(smoke.SmokeError, "chain ID mismatch"):
                smoke.live_verify("https://rpc.invalid.example", 420)

    def test_live_missing_code_fails_closed(self):
        runtime_hash = "0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86"
        def fake_cast(*args):
            if args[0] == "keccak":
                return runtime_hash
            if args[0] == "chain-id":
                return "420"
            if args[0] == "code":
                return "0x"
            raise AssertionError(args)
        with mock.patch.object(smoke, "cast", side_effect=fake_cast):
            with self.assertRaisesRegex(smoke.SmokeError, "no deployed code"):
                smoke.live_verify("https://rpc.invalid.example", 420)

    def test_live_wrong_runtime_hash_fails_closed(self):
        expected = "0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86"
        seen_code = False
        def fake_cast(*args):
            nonlocal seen_code
            if args[0] == "keccak":
                if seen_code:
                    return "0x" + "99" * 32
                return expected
            if args[0] == "chain-id":
                return "420"
            if args[0] == "code":
                seen_code = True
                return "0x60016000"
            raise AssertionError(args)
        with mock.patch.object(smoke, "cast", side_effect=fake_cast):
            with self.assertRaisesRegex(smoke.SmokeError, "runtime hash mismatch"):
                smoke.live_verify("https://rpc.invalid.example", 420)

    def test_live_wrong_governance_timelock_fails_closed(self):
        expected = "0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86"
        code_keccak = False
        def fake_cast(*args):
            nonlocal code_keccak
            if args[0] == "keccak":
                if code_keccak:
                    return expected
                return expected
            if args[0] == "chain-id":
                return "420"
            if args[0] == "code":
                code_keccak = True
                return "0x60016000"
            if args[0] == "call":
                signature = args[2]
                if signature == "systemName()(string)":
                    return "Identity420"
                if signature == "protocolVersion()(uint32)":
                    return "3"
                if signature == "governanceTimelock()(address)":
                    return "0x0000000000000000000000000000000000000999"
            raise AssertionError(args)
        with mock.patch.object(smoke, "cast", side_effect=fake_cast):
            with self.assertRaisesRegex(smoke.SmokeError, "GovernanceTimelock mismatch"):
                smoke.live_verify("https://rpc.invalid.example", 420)

    def test_live_unknown_credential_must_fail_closed(self):
        expected = "0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86"
        def fake_cast(*args):
            if args[0] == "keccak":
                return expected
            if args[0] == "chain-id":
                return "420"
            if args[0] == "code":
                return "0x60016000"
            if args[0] == "call":
                signature = args[2]
                if signature == "systemName()(string)":
                    return "Identity420"
                if signature == "protocolVersion()(uint32)":
                    return "3"
                if signature == "governanceTimelock()(address)":
                    return smoke.TIMELOCK
                if signature == "credentialValid(bytes32)(bool)":
                    return "true"
            raise AssertionError(args)
        with mock.patch.object(smoke, "cast", side_effect=fake_cast):
            with self.assertRaisesRegex(smoke.SmokeError, "did not fail closed"):
                smoke.live_verify("https://rpc.invalid.example", 420)


if __name__ == "__main__":
    unittest.main()
