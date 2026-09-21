#!/usr/bin/env python3
"""Synthetic tests for proposed global map; these do NOT qualify active deployment."""
import copy
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('candidate_verifier', ROOT / 'scripts/verify-wallet-w14-7-4-candidate.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
BASE = json.loads((ROOT / 'contracts/config/w14-7-4-global-address-reconciliation.json').read_text())

class CandidateMap(unittest.TestCase):
    def test_proposed_map_has_unique_identity_and_location(self):
        self.assertEqual(module.validate(copy.deepcopy(BASE)), [])

    def test_wallet_cannot_take_reward_controller(self):
        data = copy.deepcopy(BASE)
        data['canonicalAuthorities'][0][2] = '0x0420'
        self.assertIn('collision', ' '.join(module.validate(data)))

    def test_bridge_cannot_take_consensus_call(self):
        data = copy.deepcopy(BASE)
        data['bridgeCandidates'][0][1] = '0x043c'
        self.assertIn('collision', ' '.join(module.validate(data)))

    def test_names_reservation_cannot_be_moved(self):
        data = copy.deepcopy(BASE)
        data['canonicalAuthorities'][3][2] = '0x0463'
        self.assertIn('Names420 0x0445', ' '.join(module.validate(data)))

    def test_legacy_application_migration_must_be_complete(self):
        data = copy.deepcopy(BASE)
        data['migratedExistingPredeploys'].pop()
        self.assertIn('eight', ' '.join(module.validate(data)))

    def test_candidate_cannot_be_misrepresented_as_live(self):
        data = copy.deepcopy(BASE)
        data['policy']['walletReadyForLiveTestnet'] = True
        self.assertIn('fail-closed', ' '.join(module.validate(data)))

if __name__ == '__main__':
    unittest.main()
