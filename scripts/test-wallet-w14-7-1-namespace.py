#!/usr/bin/env python3
"""Synthetic regression tests for the W14.7.1 address validator.

Run: python3 scripts/test-wallet-w14-7-1-namespace.py
"""
import copy
import importlib.util
import pathlib
import unittest

FILE = pathlib.Path(__file__).with_name("verify-wallet-w14-7-1-namespace.py")
spec = importlib.util.spec_from_file_location("wallet_namespace_validator", FILE)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def address(number):
    return "0x" + format(number, "040x")


def fixture():
    # Synthetic complete registry with no legacy alias or address conflict.
    anchors = [
        ("smart-account-factory", "SmartAccountFactory420", 0x446),
        ("capability-registry", "CapabilityRegistry420", 0x447),
        ("protocol-registry", "ProtocolRegistry", 0x448),
        ("names", "Names420", 0x445),
        ("identity", "Identity420", 0x449),
    ]
    system = [{"address": address(slot), "name": name}
              for slot, name in validator.FROZEN.items()]
    placement = system + [{"address": address(slot), "name": name}
                          for _, name, slot in anchors]
    authority = {
        wallet_key: {"address": address(dict((ident, slot) for ident, _, slot in anchors)[anchor_id])}
        for wallet_key, anchor_id in validator.WALLET_IDS.items()
    }
    return {
        "canonical": {"anchors": [{"id": ident, "contract": name + ".sol",
                                     "address": address(slot)} for ident, name, slot in anchors]},
        "system": {"assignments": copy.deepcopy(system)},
        "system_mirror": {"assignments": copy.deepcopy(system)},
        "bridge": {"assignments": []},
        "predeploy": {"predeploys": copy.deepcopy(placement)},
        "deployment": {"contracts": copy.deepcopy(placement)},
        "wallet": {"walletAuthority": authority, "readyForLiveTestnet": False,
                   "releaseGates": {"canonicalAddressConflictResolved": True}},
    }


class NamespaceRegression(unittest.TestCase):
    def test_clean_namespace(self):
        self.assertEqual(validator.validate(fixture()), [])

    def test_different_contract_at_frozen_address(self):
        docs = fixture()
        docs["canonical"]["anchors"][0]["address"] = address(0x420)
        self.assertTrue(any("address collision" in err for err in validator.validate(docs)))

    def test_same_contract_at_two_addresses(self):
        docs = fixture()
        docs["predeploy"]["predeploys"].append({"address": address(0x460),
                                                   "name": "Names420"})
        self.assertTrue(any("multi-address contract Names420" in err
                            for err in validator.validate(docs)))

    def test_bridge_cannot_claim_consensus_gateway(self):
        docs = fixture()
        docs["bridge"]["assignments"].append({"address": address(0x43c),
                                                "name": "BridgeAssetRegistry"})
        self.assertTrue(any("address collision" in err for err in validator.validate(docs)))

    def test_wallet_inventory_must_match_canonical(self):
        docs = fixture()
        docs["wallet"]["walletAuthority"]["identity420"]["address"] = address(0x424)
        self.assertTrue(any("wallet inventory drift" in err for err in validator.validate(docs)))

    def test_live_release_must_remain_blocked(self):
        docs = fixture()
        docs["wallet"]["readyForLiveTestnet"] = True
        self.assertTrue(any("fail-closed" in err for err in validator.validate(docs)))


if __name__ == "__main__":
    unittest.main()
