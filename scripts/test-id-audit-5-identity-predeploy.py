#!/usr/bin/env python3
"""Focused negative/adversarial tests for ID-AUDIT-5 Identity predeploy materialization."""
from __future__ import annotations

import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).with_name("generate-id-audit-5-identity-predeploy.py")
spec = importlib.util.spec_from_file_location("id5", SCRIPT)
id5 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(id5)

ZERO_RUNTIME = "0x" + "00" * 160
TIMELOCK_WORD = bytes.fromhex("00" * 12 + id5.GOVERNANCE_TIMELOCK[2:])


class IdentityAudit5Tests(unittest.TestCase):
    def artifact(self, refs=None):
        if refs is None:
            refs = {"0": [
                {"start": 0, "length": 32},
                {"start": 48, "length": 32},
                {"start": 96, "length": 32},
                {"start": 128, "length": 32},
            ]}
        return {
            "contractName": "Identity420",
            "canonicalAddress": id5.IDENTITY_ADDRESS,
            "source": "contracts/src/apps/Identity420.sol",
            "sourceBlobSha1": "fixture",
            "compiler": {
                "solidity": "0.8.24",
                "evmVersion": "cancun",
                "optimizer": True,
                "optimizerRuns": 200,
                "viaIR": True,
            },
            "abiSha256": "00" * 32,
            "deployedBytecodeTemplate": ZERO_RUNTIME,
            "deployedBytecodeTemplateKeccak256": "0x" + "11" * 32,
            "immutableReferences": refs,
            "immutableReferenceCount": sum(len(v) for v in refs.values()),
            "storageLayout": {
                "storage": [
                    {"label": "profiles", "slot": "0", "offset": 0, "type": "t_mapping"},
                    {"label": "issuers", "slot": "1", "offset": 0, "type": "t_mapping"},
                    {"label": "credentials", "slot": "2", "offset": 0, "type": "t_mapping"},
                    {"label": "_credentialCandidates", "slot": "3", "offset": 0, "type": "t_mapping"},
                ],
                "types": {},
            },
        }

    def test_materializes_every_compiler_immutable_reference(self):
        runtime, patched, _ = id5.patch_immutable_runtime(self.artifact())
        code = bytes.fromhex(runtime[2:])
        for start in (0, 48, 96, 128):
            self.assertEqual(code[start:start + 32], TIMELOCK_WORD)
        self.assertEqual(len(patched), 4)

    def test_missing_immutable_references_fail_closed(self):
        artifact = self.artifact({})
        artifact["immutableReferenceCount"] = 0
        with self.assertRaisesRegex(ValueError, "no compiler immutableReferences"):
            id5.patch_immutable_runtime(artifact)

    def test_multiple_immutable_identifiers_fail_closed(self):
        refs = {
            "0": [{"start": 0, "length": 32}],
            "1": [{"start": 32, "length": 32}],
        }
        with self.assertRaisesRegex(ValueError, "unexpected Identity420 immutable identifier count"):
            id5.patch_immutable_runtime(self.artifact(refs))

    def test_wrong_immutable_width_fails_closed(self):
        refs = {"0": [{"start": 0, "length": 20}]}
        with self.assertRaisesRegex(ValueError, "unexpected immutable width"):
            id5.patch_immutable_runtime(self.artifact(refs))

    def test_out_of_bounds_immutable_reference_fails_closed(self):
        refs = {"0": [{"start": 150, "length": 32}]}
        with self.assertRaisesRegex(ValueError, "outside deployed bytecode"):
            id5.patch_immutable_runtime(self.artifact(refs))

    def test_count_mismatch_fails_closed(self):
        artifact = self.artifact()
        artifact["immutableReferenceCount"] = 3
        with self.assertRaisesRegex(ValueError, "materialized immutable count disagrees"):
            id5.patch_immutable_runtime(artifact)

    def test_governance_timelock_must_not_be_mutable_storage(self):
        artifact = self.artifact()
        artifact["storageLayout"]["storage"].append(
            {"label": "governanceTimelock", "slot": "9", "offset": 0, "type": "t_address"}
        )
        with self.assertRaisesRegex(ValueError, "unexpectedly occupies mutable storage"):
            id5.validate_storage_layout(artifact)

    def test_all_canonical_identity_state_layouts_are_required(self):
        artifact = self.artifact()
        artifact["storageLayout"]["storage"] = [
            x for x in artifact["storageLayout"]["storage"] if x["label"] != "credentials"
        ]
        with self.assertRaisesRegex(ValueError, "missing canonical state labels"):
            id5.validate_storage_layout(artifact)

    def test_predeploy_plan_preserves_frozen_address_and_promotes_artifact_ready(self):
        state = {"runtimeCodeHash": "0x" + "12" * 32, "sourceBlobSha1": "abc"}
        plan = {"predeploys": [{
            "name": "Identity420",
            "address": id5.IDENTITY_ADDRESS,
            "source": "apps/Identity420.sol",
            "artifact": id5.ARTIFACT_PATH,
            "status": "SOURCE_READY",
        }]}
        out = id5.update_plan(plan, state)
        entry = out["predeploys"][0]
        self.assertEqual(entry["address"], id5.IDENTITY_ADDRESS)
        self.assertEqual(entry["status"], "ARTIFACT_READY")
        self.assertEqual(entry["predeploy_state"], id5.STATE_PATH)
        self.assertEqual(entry["runtime_code_hash"], state["runtimeCodeHash"])

    def test_predeploy_plan_rejects_address_drift(self):
        state = {"runtimeCodeHash": "0x" + "12" * 32, "sourceBlobSha1": "abc"}
        plan = {"predeploys": [{
            "name": "Identity420",
            "address": "0x0000000000000000000000000000000000000999",
            "source": "apps/Identity420.sol",
            "artifact": id5.ARTIFACT_PATH,
        }]}
        with self.assertRaisesRegex(ValueError, "address drift"):
            id5.update_plan(plan, state)

    def test_deployment_manifest_preserves_frozen_address(self):
        state = {"runtimeCodeHash": "0x" + "34" * 32, "sourceBlobSha1": "abc"}
        manifest = {"contracts": [{
            "name": "Identity420",
            "address": id5.IDENTITY_ADDRESS,
            "deployment": "GENESIS_SYSTEM_ADDRESS",
        }]}
        out = id5.update_deployment_manifest(manifest, state)
        entry = out["contracts"][0]
        self.assertEqual(entry["address"], id5.IDENTITY_ADDRESS)
        self.assertEqual(entry["artifact_status"], "ID_AUDIT_5_ARTIFACT_READY")
        self.assertEqual(entry["predeploy_state"], id5.STATE_PATH)


if __name__ == "__main__":
    unittest.main()
