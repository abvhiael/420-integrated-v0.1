#!/usr/bin/env python3
"""W15.3 scoped namespace and immutable address regressions."""
import copy
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("w153", ROOT / "scripts/prepare-wallet-w15-3.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class WalletW153Tests(unittest.TestCase):
    def setUp(self):
        self.docs = mod.documents()

    def denied(self, edit):
        data = copy.deepcopy(self.docs)
        edit(data)
        self.assertTrue(mod.checks(data), "must reject changed Genesis authority")

    def test_current_frozen_allocation_parity(self):
        self.assertEqual(mod.checks(self.docs), [])
        self.assertFalse(self.docs["inventory"]["readyForLiveTestnet"])
        self.assertEqual(len(self.docs["system"]["assignments"]), 29)

    def test_reject_predeploy_collision(self):
        self.denied(lambda d: d["plan"]["predeploys"][0].update(
            {"address": "0x0000000000000000000000000000000000000446"}))

    def test_reject_namespace_frozen_owner_drift(self):
        self.denied(lambda d: d["namespace"]["fixedAssignments"][0].update(
            {"name": "SmartAccountFactory420"}))

    def test_reject_retired_address_reuse(self):
        self.denied(lambda d: d["namespace"]["activeNonPredeployReservations"][-1].update(
            {"address": "0x0000000000000000000000000000000000000421"}))

    def test_reject_live_wallet_promotion(self):
        self.denied(lambda d: d["inventory"]["walletAuthority"]["smartAccountFactory420"].update(
            {"address": "0x0000000000000000000000000000000000000446",
             "deploymentVerified": True}))

    def test_reject_wallet_fixed_canonical_anchor(self):
        self.denied(lambda d: d["canonical"]["anchors"].append(
            {"id": "smart-account-factory", "contract": "SmartAccountFactory420.sol",
             "address": "0x0000000000000000000000000000000000000446"}))

    def test_reject_retired_duplicate_names(self):
        self.denied(lambda d: d["inventory"]["walletAuthority"]["names420"].update(
            {"address": "0x0000000000000000000000000000000000000445"}))

    def test_reject_loss_of_retired_claims(self):
        self.denied(lambda d: d["namespace"]["retiredClaims"].clear())

    def test_reject_manifest_mirror_drift(self):
        self.denied(lambda d: d["deployment"]["contracts"][0].update(
            {"name": "CapabilityRegistry420"}))

    def test_exact_pinned_compiler(self):
        self.assertEqual(mod.compiler_config(), {
            "solc_version": "0.8.24", "evm_version": "cancun",
            "optimizer": True, "optimizer_runs": 200, "via_ir": True})

    def test_keccak_not_sha256(self):
        self.assertEqual(mod.evm_keccak(b""),
            "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
        self.assertNotEqual(mod.evm_keccak(b"abc"), mod.sha256(b"abc"))

    def test_deployment_order_does_not_overwrite_predeploys(self):
        self.assertEqual([x for x in mod.ORDER if x in mod.CORE],
            ["EntryPoint420", "CapabilityRegistry420", "SmartAccountFactory420"])
        self.assertFalse(mod.CORE & {x["name"] for x in self.docs["plan"]["predeploys"]})

if __name__ == "__main__":
    unittest.main()
