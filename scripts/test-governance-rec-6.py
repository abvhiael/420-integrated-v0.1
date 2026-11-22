#!/usr/bin/env python3
"""GOV-REC-6 fail-closed approval and artifact assertions (offline, no testnet)."""
import importlib.util
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("gov_rec6", ROOT / "scripts/verify-governance-rec-6.py")
rec6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rec6)
ZERO = "0x" + "00" * 32
ROOT_HASH = "0x" + "aa" * 32
VALIDATOR_HASH = "0x" + "bb" * 32
PLAN_HASH = "0x" + "cc" * 32
ZERO_ADDRESS = "0x" + "00" * 20
ENROLLMENT_ADDRESS = "0x" + "aa" * 20
AUTHORITY_ADDRESS = "0x" + "bb" * 20


def approval(plan=ZERO, community=ZERO, community_weight=0, validator=ZERO, validator_weight=0,
             enrollment=ZERO_ADDRESS, authority=ZERO_ADDRESS):
    return {"approvedPlanHash": plan, "communityRoot": community,
            "communityTotalWeight": community_weight,
            "validatorRoot": validator, "validatorTotalWeight": validator_weight,
            "enrollmentContract": enrollment, "electorateAuthority": authority}


class GenesisApprovalBoundary(unittest.TestCase):
    def test_unset_is_valid_for_offline_build_but_not_activation(self):
        values, ready = rec6.approval_values(approval())
        self.assertFalse(ready)
        self.assertEqual(set(values.values()), {0})

    def test_complete_materialization_is_structurally_ready(self):
        values, ready = rec6.approval_values(approval(PLAN_HASH, ROOT_HASH, 2, VALIDATOR_HASH, 2))
        self.assertTrue(ready)
        self.assertEqual(values["validatorTotalWeight"], 2)

    def test_post_genesis_mode_has_no_fabricated_initial_members(self):
        values, ready = rec6.approval_values(
            approval(plan=PLAN_HASH, enrollment=ENROLLMENT_ADDRESS, authority=AUTHORITY_ADDRESS))
        self.assertTrue(ready)
        self.assertEqual(values["communityTotalWeight"], 0)
        self.assertEqual(values["validatorTotalWeight"], 0)

    def test_missing_authority_or_mixed_electorate_modes_fail_closed(self):
        for candidate in [
            approval(plan=PLAN_HASH, enrollment=ENROLLMENT_ADDRESS),
            approval(plan=PLAN_HASH, authority=AUTHORITY_ADDRESS),
            approval(enrollment=ENROLLMENT_ADDRESS, authority=AUTHORITY_ADDRESS),
            approval(plan=PLAN_HASH, community=ROOT_HASH, community_weight=1,
                     validator=VALIDATOR_HASH, validator_weight=1,
                     enrollment=ENROLLMENT_ADDRESS, authority=AUTHORITY_ADDRESS),
        ]:
            with self.subTest(candidate=candidate), self.assertRaises(ValueError):
                rec6.approval_values(candidate)

    def test_single_and_partial_fields_cannot_enable_genesis(self):
        candidates = [
            approval(plan=PLAN_HASH),
            approval(community=ROOT_HASH, community_weight=2),
            approval(plan=PLAN_HASH, community=ROOT_HASH, community_weight=2,
                     validator=VALIDATOR_HASH),
            approval(plan=PLAN_HASH, community=ROOT_HASH, community_weight=2,
                     validator_weight=2),
        ]
        for candidate in candidates:
            with self.subTest(candidate=candidate), self.assertRaisesRegex(ValueError, "partial Genesis bootstrap approval"):
                rec6.approval_values(candidate)

    def test_malformed_hash_and_out_of_range_weight_rejected(self):
        for candidate in [
            approval(plan="0xdead"),
            approval(community_weight=-1),
            approval(community_weight=2**256),
            approval(validator_weight=True),
            approval(plan=PLAN_HASH, community=ROOT_HASH, community_weight=1,
                     validator=VALIDATOR_HASH, validator_weight=2**256),
        ]:
            with self.subTest(candidate=candidate), self.assertRaises(ValueError):
                rec6.approval_values(candidate)

    def test_storage_layout_must_contain_exact_unpacked_field(self):
        good = {"storage": [{"label": "approvedBootstrapPlanHash", "offset": 0, "slot": "4"}]}
        self.assertEqual(rec6.storage_word(good, "approvedBootstrapPlanHash"), "0x" + "00"*31 + "04")
        for bad in [
            {"storage": []},
            {"storage": [good["storage"][0], good["storage"][0]]},
            {"storage": [{"label": "approvedBootstrapPlanHash", "offset": 1, "slot": "4"}]},
        ]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                rec6.storage_word(bad, "approvedBootstrapPlanHash")


if __name__ == "__main__":
    unittest.main(verbosity=2)
