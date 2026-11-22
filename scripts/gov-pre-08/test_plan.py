#!/usr/bin/env python3
"""GOV-PRE-08: independent negative conservation and approval-boundary regressions."""
import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("gov_pre_08_plan",
                                               Path(__file__).with_name("plan.py"))
plan = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(plan)

def source():
    return [plan.read(ROOT,p) for p in (
        "config/genesis-allocations.json",
        "contracts/config/founder-wallet-reservations.json",
        "contracts/config/system-addresses.json",
        "contracts/config/founding-genesis-integration-v1.json")]

class CandidateBoundaries(unittest.TestCase):
    def test_unmodified_genesis_amendment_is_conserved(self):
        ledger,wallets,system,integration=source()
        alloc=plan.check_ledger(ledger,wallets,system,integration)
        self.assertEqual(alloc["protocol-reserve"]["amount_420"],8600000)
        self.assertEqual(sum(x["amount_420"] for x in ledger["allocations"]),42000000)

    def mutate_rejected(self, mutation):
        values=source()
        mutation(*values)
        with self.assertRaises(ValueError):
            plan.check_ledger(*values)

    def test_supply_inflation_rejected(self):
        self.mutate_rejected(lambda l,*args: l["allocations"][0].__setitem__("amount_420",500001))

    def test_fake_native_base_units_rejected(self):
        self.mutate_rejected(lambda l,*args: l["allocations"][0].__setitem__("amount_kief","500000"))

    def test_duplicate_native_allocation_rejected(self):
        self.mutate_rejected(lambda l,*args: l["allocations"].append(copy.deepcopy(l["allocations"][0])))

    def test_protocol_budget_double_count_rejected(self):
        self.mutate_rejected(lambda l,*args: l["allocations"][-1]["earmarks_420"].__setitem__(
            "founding_operations", 4200001))

    def test_contingency_budget_diversion_rejected(self):
        self.mutate_rejected(lambda l,*args: l["allocations"][-1]["earmarks_420"].__setitem__(
            "founding_contingency", 0))

    def test_unverified_liquid_founder_destination_rejected(self):
        self.mutate_rejected(lambda l,*args: l["allocations"][1].__setitem__(
            "destination","0x0000000000000000000000000000000000000011"))

    def test_unknown_founder_promoted_to_claimed_rejected(self):
        self.mutate_rejected(lambda l,w,*args: w["founders"][0].__setitem__(
            "wallet_address","0x0000000000000000000000000000000000000001"))

    def test_system_address_masquerading_as_founder_rejected(self):
        def mutation(l,w,*args):
            w["founders"][0]["wallet_address"]="0x0000000000000000000000000000000000000424"
            l["allocations"][1]["destination"]="0x0000000000000000000000000000000000000424"
        self.mutate_rejected(mutation)

    def test_reward_share_change_rejected(self):
        self.mutate_rejected(lambda l,w,s,i: i["founderFunding"].__setitem__(
            "fullySponsoredRewardBasisPoints", 0))

    def test_retirement_threshold_reduction_rejected(self):
        self.mutate_rejected(lambda l,w,s,i: i["retirement"].__setitem__(
            "validatorEligibleOwnerMinimum", 59))

    def test_immutable_vesting_split_change_rejected(self):
        self.mutate_rejected(lambda l,w,s,i: w["founders"][0].__setitem__(
            "genesis_locked_420", 499999))


    def test_source_bound_seven_consumer_integrations(self):
        names=[x["name"] for x in plan.check_consumers(ROOT)]
        self.assertEqual(names,["420Wallet","420Registry","420Indexer","420Stake",
                                "420Treasury","420Explorer","420Governance"])

    def test_registry_cannot_disable_codehash_publication(self):
        original=plan.read
        def corrupted(root,path):
            record=original(root,path)
            if path=="contracts/config/420registry-genesis.json":
                record["registration"]["strictPublicationRequiresRuntimeCode"]=False
            return record
        plan.read=corrupted
        try:
            with self.assertRaises(ValueError):
                plan.check_consumers(ROOT)
        finally:
            plan.read=original

    def test_explorer_cannot_claim_independent_chain_authority(self):
        original=plan.read
        def corrupted(root,path):
            record=original(root,path)
            if path=="contracts/config/420explorer-genesis.json":
                record["indexerConsumer"]["independentChainIngestion"]=True
            return record
        plan.read=corrupted
        try:
            with self.assertRaises(ValueError):
                plan.check_consumers(ROOT)
        finally:
            plan.read=original


    def test_tampered_signed_v4_candidate_is_rejected(self):
        original=plan.read
        def corrupted(root,path):
            record=original(root,path)
            if path=="contracts/config/candidates/genesis-config-commitment-v4-unsigned.json":
                record["approvals"]["independentGenesisApproval"]=True
            return record
        plan.read=corrupted
        try:
            with self.assertRaises(ValueError):
                plan.make_candidate(ROOT,with_artifacts=False)
        finally:
            plan.read=original

    def test_v4_candidate_hash_drift_is_rejected(self):
        original=plan.read
        def corrupted(root,path):
            record=original(root,path)
            if path=="contracts/config/candidates/genesis-config-commitment-v4-unsigned.json":
                record["genesisConfigHash"]="0x"+"00"*32
            return record
        plan.read=corrupted
        try:
            with self.assertRaises(ValueError):
                plan.make_candidate(ROOT,with_artifacts=False)
        finally:
            plan.read=original

    def test_authoritative_source_candidate_is_unapproved(self):
        candidate=plan.make_candidate(ROOT,with_artifacts=False)
        self.assertEqual(candidate["status"],"UNAPPROVED_SOURCE_CANDIDATE_NOT_DEPLOYED")
        self.assertEqual(candidate["proposedV4"]["commitmentPayload"]["domain"],
                         "420/GENESIS/CONFIG/V4")
        self.assertFalse(candidate["proposedV4"]["independentlyApproved"])
        self.assertEqual(len(candidate["consumerIntegrations"]),7)
        self.assertIsNone(candidate["proposedV4"]["approvalSignatures"])
        self.assertTrue(all(x["deployedAddress"] is None for x in candidate["components"]))
        self.assertEqual(sum(x["amount420"] for x in candidate["fundingTransfers"]),5040000)
        self.assertEqual(candidate["unearmarkedProtocolReserve420"],3560000)
        self.assertIn("config/genesis-allocations.json",candidate["sourceDriftFromV3"])
        self.assertIn("contracts/config/system-addresses.json",candidate["sourceDriftFromV3"])

if __name__=="__main__":
    unittest.main(verbosity=2)
