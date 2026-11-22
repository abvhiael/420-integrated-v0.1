#!/usr/bin/env python3
"""Focused GOV-PRE-08 local Genesis funding tests; never authentic founder proof."""
import importlib.util
import json
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location("gov_pre_08_local_funding",Path(__file__).with_name("materialize-local-funding.py"))
local=importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)

class LocalFundingQualification(unittest.TestCase):
    def test_exact_native_conservation_and_founder_split(self):
        genesis, evidence=local.make_local(ROOT)
        self.assertEqual(genesis["config"]["chainId"],31337)
        self.assertEqual(int(genesis["timestamp"],16),1700000000)
        self.assertEqual(sum(int(a["balance"]) for a in genesis["alloc"].values()),42000000*local.plan.KIEF)
        self.assertEqual(int(genesis["alloc"]["0x0000000000000000000000000000000000000427"]["balance"]),500000*local.plan.KIEF)
        for idx,entry in enumerate(evidence["localWallets"]):
            self.assertEqual(int(genesis["alloc"][entry["address"].lower()]["balance"]),
                             local.plan.ROLE_AMOUNTS[idx]*local.plan.KIEF)
        self.assertEqual(evidence["protocolReserve420"],8600000)
        self.assertEqual(evidence["nonAdditiveOperationsEarmark420"]+evidence["nonAdditiveContingencyEarmark420"]+evidence["unearmarkedProtocolReserve420"],8600000)
        self.assertFalse(evidence["genesisFundingBalancesVerifiedOnChain"])
        self.assertFalse(evidence["vestingRuntimeAndConstructorStoragePresent"])
        self.assertFalse(evidence["postGenesisOperationsVaultFunded"])
        self.assertFalse(evidence["postGenesisContingencyVaultFunded"])
        self.assertFalse(evidence["communityRetirementSweepExecuted"])
        self.assertEqual(evidence["status"],"SYNTHETIC_UNOWNED_ADDRESSES_NOT_A_RELEASE")
        self.assertEqual(len(genesis["alloc"]),11)

    def test_deterministic_funding_materialization(self):
        self.assertEqual(local.dump(local.make_local(ROOT)[0]),local.dump(local.make_local(ROOT)[0]))
        self.assertEqual(local.dump(local.make_local(ROOT)[1]),local.dump(local.make_local(ROOT)[1]))

    def altered_rejected(self,path,mutate):
        original=local.plan.read
        def changed(root, requested):
            result=original(root,requested)
            if requested==path:
                mutate(result)
            return result
        local.plan.read=changed
        try:
            with self.assertRaises(ValueError):
                local.make_local(ROOT)
        finally:
            local.plan.read=original

    def test_reserved_contract_address_as_founder_rejected(self):
        self.altered_rejected("contracts/test/fixtures/gov-pre-08-local-wallets.json",
                              lambda f:f["wallets"][0].__setitem__(
                                  "address","0x0000000000000000000000000000000000000427"))

    def test_duplicate_synthetic_wallet_rejected(self):
        self.altered_rejected("contracts/test/fixtures/gov-pre-08-local-wallets.json",
                              lambda f:f["wallets"][1].__setitem__("address",f["wallets"][0]["address"]))

    def test_fixture_cannot_pretend_to_be_live_network(self):
        self.altered_rejected("contracts/test/fixtures/gov-pre-08-local-wallets.json",
                              lambda f:f.__setitem__("network","mainnet"))

    def test_fixture_cannot_pretend_to_be_chain_420(self):
        self.altered_rejected("contracts/test/fixtures/gov-pre-08-local-wallets.json",
                              lambda f:f.__setitem__("chainId",420))

    def test_legacy_genesis_drift_is_rejected(self):
        self.altered_rejected("execution/genesis/execution-genesis.json",
                              lambda g:g["alloc"]["0x0000000000000000000000000000000000000427"].__setitem__(
                                  "balance",str(500000*local.plan.KIEF)))

    def test_wrong_historical_genesis_configuration_rejected(self):
        self.altered_rejected("execution/genesis/execution-genesis.json",
                              lambda g:g["alloc"]["0x0000000000000000000000000000000000000421"].__setitem__(
                                  "balance",str(4000000*local.plan.KIEF)))

if __name__=="__main__":
    unittest.main(verbosity=2)
