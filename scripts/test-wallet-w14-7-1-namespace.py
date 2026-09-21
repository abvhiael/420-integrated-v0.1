#!/usr/bin/env python3
"""Current-authority namespace regression fixtures, not retired W14.7.4 moves."""
import copy
import importlib.util
import pathlib
import unittest

FILE = pathlib.Path(__file__).with_name('verify-wallet-w14-7-1-namespace.py')
spec = importlib.util.spec_from_file_location('wallet_namespace_validator', FILE)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def address(slot):
    return '0x' + format(slot, '040x')


def fixture():
    system = [{'address': address(slot), 'name': name}
              for slot, name in validator.FROZEN.items()]
    # An actual fixed-anchor contract must be in the unchanged frozen system map.
    anchors = [('protocol-registry', 'ProtocolRegistry', 0x434),
               ('names', 'Names420', 0x435), ('identity', 'Identity420', 0x436),
               ('ai-provider-registry', 'AIProviderRegistry', 0x42f)]
    registry = [('smart-account-factory', 'SmartAccountFactory420'),
                ('capability-registry', 'CapabilityRegistry420'),
                ('ai-router', 'AIRouter420')]
    authority = {
        'protocolRegistry': {'address': address(0x434), 'deploymentVerified': False},
        'names420': {'address': address(0x435), 'deploymentVerified': False},
        'identity420': {'address': address(0x436), 'deploymentVerified': False},
        'smartAccountFactory420': {'address': None, 'candidateAddress': address(0x446),
                                   'deploymentVerified': False},
        'capabilityRegistry420': {'address': None, 'candidateAddress': address(0x447),
                                  'deploymentVerified': False},
    }
    return {
        'canonical': {
            'anchors': [{'id': ident, 'contract': name + '.sol', 'address': address(slot)}
                        for ident, name, slot in anchors],
            'registry_resolved': [{'id': ident, 'contract': name + '.sol'}
                                  for ident, name in registry],
            'reserved': [{'id': 'entry-point', 'address': address(0x41f),
                          'status': 'RESERVED_PENDING_PRODUCTION_IMPLEMENTATION'},
                         {'id': 'names-legacy-wallet-proposal', 'address': address(0x445),
                          'status': 'RETIRED_NOT_DEPLOYABLE'}],
        },
        'system': {'assignments': copy.deepcopy(system)},
        'system_mirror': {'assignments': copy.deepcopy(system)},
        'bridge': {'assignments': [], 'retired': [{'name': 'BridgeAssetRegistry',
                                                  'address': address(0x43c)}]},
        'predeploy': {'predeploys': copy.deepcopy(system)},
        'deployment': {'contracts': copy.deepcopy(system)},
        'wallet': {'walletAuthority': authority, 'readyForLiveTestnet': False,
                   'releaseGates': {'canonicalAddressConflictResolved': False}},
    }


class NamespaceRegression(unittest.TestCase):
    def test_clean_current_namespace(self):
        self.assertEqual(validator.validate(fixture()), [])

    def test_application_router_cannot_claim_frozen_ai_slot(self):
        docs = fixture()
        docs['canonical']['registry_resolved'][2]['address'] = address(0x430)
        self.assertTrue(any('registry-resolved' in err for err in validator.validate(docs)))

    def test_different_contract_at_frozen_address(self):
        docs = fixture()
        docs['canonical']['anchors'][0]['address'] = address(0x420)
        self.assertTrue(any('canonical fixed anchor' in err for err in validator.validate(docs)))

    def test_same_contract_at_two_predeploy_addresses(self):
        docs = fixture()
        docs['predeploy']['predeploys'].append({'address': address(0x460), 'name': 'Names420'})
        self.assertTrue(any('predeploy' in err for err in validator.validate(docs)))

    def test_bridge_cannot_claim_consensus_gateway(self):
        docs = fixture()
        docs['bridge']['assignments'].append({'address': address(0x43c), 'name': 'BridgeAssetRegistry'})
        self.assertTrue(any('address collision' in err for err in validator.validate(docs)))

    def test_retired_bridge_proposal_does_not_retire_consensus_predeploy(self):
        self.assertEqual(validator.validate(fixture()), [])

    def test_wallet_inventory_must_match_canonical(self):
        docs = fixture()
        docs['wallet']['walletAuthority']['identity420']['address'] = address(0x424)
        self.assertTrue(any('wallet frozen reference drift' in err for err in validator.validate(docs)))

    def test_unverified_wallet_candidate_must_not_be_published(self):
        docs = fixture()
        docs['wallet']['walletAuthority']['smartAccountFactory420']['address'] = address(0x446)
        self.assertTrue(any('unverified registry-resolved' in err for err in validator.validate(docs)))

    def test_wallet_candidate_cannot_reuse_frozen_slot(self):
        docs = fixture()
        docs['wallet']['walletAuthority']['capabilityRegistry420']['candidateAddress'] = address(0x42f)
        self.assertTrue(any('wallet candidate address collision' in err for err in validator.validate(docs)))

    def test_live_release_must_remain_blocked(self):
        docs = fixture()
        docs['wallet']['readyForLiveTestnet'] = True
        self.assertTrue(any('fail-closed' in err for err in validator.validate(docs)))


if __name__ == '__main__':
    unittest.main()
